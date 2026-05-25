const {
  AuditLog,
  Department,
  Invoice,
  Patient,
  QueueTicket,
  User,
} = require('../models');
const queueService = require('./queue.service');
const { createError, recordAuditLog } = require('./core.service');
const {
  departmentMapFor,
  mapQueueTicket,
  patientMapFor,
  userMapFor,
} = require('./reception-dashboard.service');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

async function getRoutingOptions(query = {}) {
  const departmentFilter = { is_deleted: false, status: 'active' };
  if (query.department_id) departmentFilter._id = query.department_id;
  const [departments, doctors] = await Promise.all([
    Department.find(departmentFilter).select('department_name department_code').sort({ department_name: 1 }).limit(200).lean(),
    User.find({ is_deleted: false, status: 'active' }).select('full_name employee_code department_id').sort({ full_name: 1 }).limit(300).lean(),
  ]);
  return {
    destinations: [
      { type: 'nursing', label: 'Điều dưỡng', required_fields: ['queue_ticket_id', 'department_id'] },
      { type: 'doctor', label: 'Bác sĩ', required_fields: ['queue_ticket_id', 'doctor_id', 'department_id'] },
      { type: 'cashier', label: 'Thu ngân', required_fields: ['patient_id'] },
      { type: 'clinical', label: 'Cận lâm sàng', required_fields: ['patient_id'] },
      { type: 'pharmacy', label: 'Nhà thuốc', required_fields: ['patient_id'] },
    ],
    departments: departments.map((item) => ({
      department_id: toId(item._id),
      department_code: item.department_code,
      department_name: item.department_name,
    })),
    doctors: doctors.map((item) => ({
      user_id: toId(item._id),
      employee_code: item.employee_code,
      full_name: item.full_name,
      department_id: toId(item.department_id),
    })),
  };
}

async function routePatient(payload = {}, actor = {}, requestMeta = {}) {
  const destination = payload.destination || payload.destination_type || payload.route_to;
  if (!destination) throw createError('destination là bắt buộc.', 400);

  if (payload.queue_ticket_id && ['nursing', 'doctor', 'department', 'room'].includes(destination)) {
    const ticket = await queueService.transferQueueTicket(payload.queue_ticket_id, {
      department_id: payload.department_id,
      doctor_id: payload.doctor_id,
      reason: payload.reason,
      note: payload.note,
    }, actor, requestMeta);
    return {
      routed: true,
      destination,
      queue_ticket: ticket.queue_ticket || ticket,
      next_step: destination === 'doctor' ? 'doctor_queue' : 'nursing_queue',
    };
  }

  if (destination === 'cashier') {
    const patientId = payload.patient_id;
    if (!patientId) throw createError('patient_id là bắt buộc khi chuyển thu ngân.', 400);
    const invoices = await Invoice.find({
      patient_id: patientId,
      status: { $in: ['draft', 'issued', 'partially_paid'] },
      balance_due: { $gt: 0 },
    }).sort({ due_at: 1, created_at: -1 }).limit(10).lean();
    await recordAuditLog({
      actor,
      action: 'reception.route.cashier',
      targetType: 'patient',
      targetId: patientId,
      status: 'success',
      message: payload.note || 'Chuyển bệnh nhân sang thu ngân.',
      requestMeta,
      metadata: {
        invoice_ids: invoices.map((invoice) => toId(invoice._id)),
        priority: payload.priority || 'normal',
      },
    });
    return {
      routed: true,
      destination,
      patient_id: toId(patientId),
      invoices: invoices.map((invoice) => ({
        invoice_id: toId(invoice._id),
        invoice_no: invoice.invoice_no,
        balance_due: invoice.balance_due,
        currency: invoice.currency,
        status: invoice.status,
      })),
      next_step: 'cashier_workbench',
    };
  }

  await recordAuditLog({
    actor,
    action: `reception.route.${destination}`,
    targetType: payload.patient_id ? 'patient' : 'queue_ticket',
    targetId: payload.patient_id || payload.queue_ticket_id,
    status: 'success',
    message: payload.note || `Chuyển tuyến ${destination}.`,
    requestMeta,
    metadata: {
      destination,
      department_id: payload.department_id,
      doctor_id: payload.doctor_id,
      priority: payload.priority || 'normal',
    },
  });

  return {
    routed: true,
    destination,
    patient_id: toId(payload.patient_id),
    queue_ticket_id: toId(payload.queue_ticket_id),
    next_step: `${destination}_workspace`,
  };
}

async function routeToNursing(payload = {}, actor = {}, requestMeta = {}) {
  return routePatient({ ...payload, destination: 'nursing' }, actor, requestMeta);
}

async function routeToDoctor(payload = {}, actor = {}, requestMeta = {}) {
  return routePatient({ ...payload, destination: 'doctor' }, actor, requestMeta);
}

async function routeToCashier(payload = {}, actor = {}, requestMeta = {}) {
  return routePatient({ ...payload, destination: 'cashier' }, actor, requestMeta);
}

async function getRoutingHistory(query = {}) {
  const filter = { action: /^reception\.route|queue\.transfer/ };
  if (query.patient_id) {
    const tickets = await QueueTicket.find({ patient_id: query.patient_id }).select('_id').lean();
    filter.$or = [
      { target_type: 'patient', target_id: query.patient_id },
      { target_type: 'queue_ticket', target_id: { $in: tickets.map((ticket) => ticket._id) } },
    ];
  }
  const logs = await AuditLog.find(filter).sort({ created_at: -1 }).limit(Math.min(Number(query.limit || 50), 200)).lean();
  return {
    items: logs.map((item) => ({
      routing_event_id: toId(item._id),
      action: item.action,
      target_type: item.target_type,
      target_id: toId(item.target_id),
      status: item.status,
      message: item.message,
      metadata: item.metadata,
      created_at: item.created_at,
    })),
  };
}

async function getClinicalRoutingReadiness(patientId) {
  if (!patientId) throw createError('patientId là bắt buộc.', 400);
  const patient = await Patient.findById(patientId).select('patient_code full_name status').lean();
  if (!patient) throw createError('Không tìm thấy bệnh nhân.', 404);
  return {
    patient_id: toId(patient._id),
    patient,
    ready: true,
    blockers: [],
    pending_orders: [],
  };
}

async function getPharmacyRoutingReadiness(patientId) {
  if (!patientId) throw createError('patientId là bắt buộc.', 400);
  const patient = await Patient.findById(patientId).select('patient_code full_name status').lean();
  if (!patient) throw createError('Không tìm thấy bệnh nhân.', 404);
  return {
    patient_id: toId(patient._id),
    patient,
    ready: true,
    blockers: [],
    pending_prescriptions: [],
  };
}

module.exports = {
  getRoutingOptions,
  routePatient,
  routeToNursing,
  routeToDoctor,
  routeToCashier,
  getRoutingHistory,
  getClinicalRoutingReadiness,
  getPharmacyRoutingReadiness,
};
