const {
  Appointment,
  Department,
  Invoice,
  Patient,
  QueueTicket,
  User,
} = require('../models');
const qrTokenService = require('./qr-token.service');
const { createError, recordAuditLog } = require('./core.service');
const {
  mapInvoice,
  mapQueueTicket,
  patientMapFor,
  departmentMapFor,
  userMapFor,
} = require('./reception-dashboard.service');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

async function getPrintTemplates() {
  return {
    items: [
      {
        template_id: 'queue-ticket-standard',
        type: 'queue_ticket',
        name: 'Phiếu số thứ tự tiêu chuẩn',
        paper_size: '80mm',
        fields: ['facility_name', 'queue_number', 'patient_name', 'department_name', 'doctor_name', 'qr'],
      },
      {
        template_id: 'appointment-slip-standard',
        type: 'appointment_slip',
        name: 'Phiếu lịch hẹn',
        paper_size: 'A5',
        fields: ['appointment_time', 'patient_name', 'doctor_name', 'department_name', 'instructions'],
      },
      {
        template_id: 'payment-guide-standard',
        type: 'payment_guide',
        name: 'Hướng dẫn thanh toán QR',
        paper_size: 'A5',
        fields: ['invoice_no', 'amount', 'bank_account', 'payment_note', 'qr'],
      },
      {
        template_id: 'patient-card-standard',
        type: 'patient_card',
        name: 'Thẻ bệnh nhân',
        paper_size: 'A6',
        fields: ['patient_code', 'patient_name', 'date_of_birth', 'phone'],
      },
    ],
  };
}

async function queueTicketPrintPayload(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  const maps = {
    patientMap: await patientMapFor([ticket]),
    departmentMap: await departmentMapFor([ticket]),
    doctorMap: await userMapFor([ticket]),
  };
  const queueTicket = mapQueueTicket(ticket, maps);
  const qr = payload.include_qr === false
    ? null
    : await qrTokenService.createQueueTicketQr(ticket._id, {}, actor, requestMeta).catch(() => null);
  await recordAuditLog({
    actor,
    action: 'reception.print.queue_ticket',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Tạo payload in phiếu queue.',
    requestMeta,
  });
  return {
    template_id: payload.template_id || 'queue-ticket-standard',
    print_type: 'queue_ticket',
    queue_ticket: queueTicket,
    qr,
    issued_at: new Date(),
  };
}

async function appointmentSlipPrintPayload(appointmentId, payload = {}, actor = {}, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment) throw createError('Không tìm thấy appointment.', 404);
  const [patient, department, doctor] = await Promise.all([
    Patient.findById(appointment.patient_id).select('patient_code full_name phone date_of_birth').lean(),
    Department.findById(appointment.department_id).select('department_name department_code').lean(),
    User.findById(appointment.doctor_id).select('full_name employee_code').lean(),
  ]);
  await recordAuditLog({
    actor,
    action: 'reception.print.appointment_slip',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Tạo payload in phiếu lịch hẹn.',
    requestMeta,
  });
  return {
    template_id: payload.template_id || 'appointment-slip-standard',
    print_type: 'appointment_slip',
    appointment: {
      appointment_id: toId(appointment._id),
      appointment_time: appointment.appointment_time,
      status: appointment.status,
      reason: appointment.reason,
    },
    patient,
    department,
    doctor,
    issued_at: new Date(),
  };
}

async function paymentGuidePrintPayload(invoiceId, payload = {}, actor = {}, requestMeta = {}) {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw createError('Không tìm thấy invoice.', 404);
  const patient = await Patient.findById(invoice.patient_id).select('patient_code full_name phone').lean();
  const qr = payload.include_qr === false
    ? null
    : await qrTokenService.createPaymentQr(invoice._id, {}, actor, requestMeta).catch(() => null);
  await recordAuditLog({
    actor,
    action: 'reception.print.payment_guide',
    targetType: 'invoice',
    targetId: invoice._id,
    status: 'success',
    message: 'Tạo payload in hướng dẫn thanh toán.',
    requestMeta,
  });
  return {
    template_id: payload.template_id || 'payment-guide-standard',
    print_type: 'payment_guide',
    invoice: mapInvoice(invoice, patient),
    patient,
    qr,
    payment_note: qr?.metadata?.payment_note || invoice.invoice_no,
    issued_at: new Date(),
  };
}

async function patientCardPrintPayload(patientId, payload = {}, actor = {}, requestMeta = {}) {
  const patient = await Patient.findById(patientId).select('patient_code full_name phone date_of_birth gender status').lean();
  if (!patient) throw createError('Không tìm thấy bệnh nhân.', 404);
  await recordAuditLog({
    actor,
    action: 'reception.print.patient_card',
    targetType: 'patient',
    targetId: patient._id,
    status: 'success',
    message: 'Tạo payload in thẻ bệnh nhân.',
    requestMeta,
  });
  return {
    template_id: payload.template_id || 'patient-card-standard',
    print_type: 'patient_card',
    patient: {
      patient_id: toId(patient._id),
      patient_code: patient.patient_code,
      full_name: patient.full_name,
      phone: patient.phone,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      status: patient.status,
    },
    issued_at: new Date(),
  };
}

async function logPrint(payload = {}, actor = {}, requestMeta = {}) {
  await recordAuditLog({
    actor,
    action: 'reception.print.log',
    targetType: payload.entity_type || payload.print_type || 'print_job',
    targetId: payload.entity_id,
    status: 'success',
    message: payload.note || 'Ghi nhận thao tác in tại lễ tân.',
    requestMeta,
    metadata: payload,
  });
  return {
    logged: true,
    print_type: payload.print_type,
    entity_type: payload.entity_type,
    entity_id: toId(payload.entity_id),
  };
}

module.exports = {
  getPrintTemplates,
  queueTicketPrintPayload,
  appointmentSlipPrintPayload,
  paymentGuidePrintPayload,
  patientCardPrintPayload,
  logPrint,
};
