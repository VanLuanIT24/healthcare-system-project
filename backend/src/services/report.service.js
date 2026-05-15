const { Types } = require('mongoose');
const {
  Appointment,
  AuditLog,
  Charge,
  Department,
  DoctorProfile,
  Encounter,
  InventoryTransaction,
  Invoice,
  MedicationMaster,
  Payment,
  QueueTicket,
  ScheduleSlot,
  StockBatch,
  User,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUSES,
  CHARGE_STATUS,
  ENCOUNTER_STATUS,
  ENCOUNTER_STATUSES,
  ENCOUNTER_TYPES,
  INVOICE_STATUS,
  INVENTORY_TRANSACTION_DIRECTION,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  QUEUE_STATUS,
  QUEUE_STATUSES,
  STOCK_BATCH_STATUS,
} = require('../constants/statuses');
const permissionService = require('./permission.service');
const {
  createError,
  getEndOfDay,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DEFAULT_MAX_RANGE_DAYS = 366;

function hasPermission(actor = {}, permission) {
  return permissionService.hasPermission(actor.permissions || [], permission);
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions);
}

function actorId(actor = {}) {
  return actor.userId || actor.actorId || actor.actor_id || actor.id || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function assertStaff(actor = {}) {
  if (actor.actorType !== 'staff' && actor.actor_type !== 'staff') {
    throw createError('Chỉ tài khoản nhân sự được xem reports/dashboard.', 403);
  }
}

function assertAnyReportPermission(actor = {}, permissions = []) {
  assertStaff(actor);
  const allowed = [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    ...permissions,
  ];
  if (!hasAnyPermission(actor, allowed)) {
    throw createError('Tài khoản hiện tại không có quyền xem báo cáo này.', 403);
  }
}

function isBroadReportReader(actor = {}, extraPermissions = []) {
  return hasAnyPermission(actor, [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    ...extraPermissions,
  ]);
}

function hasGlobalRevenueScope(actor = {}) {
  return hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
    || hasPermission(actor, PERMISSION.REPORTS.READ_ALL)
    || !actorDepartmentId(actor);
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function addObjectIdFilter(match, field, value, fieldName = field) {
  if (value) match[field] = toObjectId(value, fieldName);
}

function setScopedObjectId(match, field, value) {
  if (!value) {
    match._id = null;
    return;
  }

  if (match[field] && String(match[field]) !== String(value)) {
    match._id = null;
    return;
  }

  match[field] = toObjectId(value, field);
}

function parseDate(value, fieldName) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function normalizeTimezone(timezone) {
  const value = normalizeString(timezone);
  if (!value) return DEFAULT_TIMEZONE;
  if (!/^[A-Za-z_/-]+$/.test(value)) return DEFAULT_TIMEZONE;
  return value;
}

function normalizeReportFilters(query = {}, { defaultToday = true } = {}) {
  const now = new Date();
  const explicitFrom = parseDate(query.date_from || query.from, 'date_from');
  const explicitTo = parseDate(query.date_to || query.to, 'date_to');
  const date = parseDate(query.date, 'date');

  const dateFrom = date
    ? getStartOfDay(date)
    : explicitFrom
      ? getStartOfDay(explicitFrom)
      : defaultToday
        ? getStartOfDay(now)
        : null;
  const dateTo = date
    ? getEndOfDay(date)
    : explicitTo
      ? getEndOfDay(explicitTo)
      : defaultToday
        ? getEndOfDay(now)
        : null;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw createError('date_from phải nhỏ hơn hoặc bằng date_to.', 400);
  }

  if (dateFrom && dateTo) {
    const rangeDays = (dateTo.getTime() - dateFrom.getTime()) / 86400000;
    const maxDays = Math.min(Math.max(Number(query.max_range_days || DEFAULT_MAX_RANGE_DAYS), 1), 1825);
    if (rangeDays > maxDays) {
      throw createError(`Khoảng thời gian realtime không được vượt quá ${maxDays} ngày.`, 400);
    }
  }

  return {
    date_from: dateFrom,
    date_to: dateTo,
    timezone: normalizeTimezone(query.timezone),
    department_id: normalizeString(query.department_id),
    doctor_id: normalizeString(query.doctor_id),
    patient_id: normalizeString(query.patient_id),
    status: normalizeString(query.status),
    group_by: normalizeString(query.group_by),
    near_expiry_days: Math.min(Math.max(Number(query.near_expiry_days || 30), 1), 365),
  };
}

function assertExplicitRevenueDateRange(query = {}, filters = {}) {
  const hasFrom = Boolean(query.date || query.date_from || query.from);
  const hasTo = Boolean(query.date || query.date_to || query.to);
  if (!hasFrom || !hasTo) throw createError('date_from và date_to là bắt buộc cho revenue report/export.', 400);
  if (filters.date_from && filters.date_to) {
    const rangeDays = (filters.date_to.getTime() - filters.date_from.getTime()) / 86400000;
    if (rangeDays > DEFAULT_MAX_RANGE_DAYS) {
      throw createError(`Revenue report/export chỉ cho phép tối đa ${DEFAULT_MAX_RANGE_DAYS} ngày.`, 400);
    }
  }
}

async function applyRevenueDepartmentScope(paymentMatch, invoiceMatch, chargeMatch, filters = {}, actor = {}) {
  const requestedDepartmentId = filters.department_id;
  const actorDept = actorDepartmentId(actor);
  const departmentId = hasGlobalRevenueScope(actor) ? requestedDepartmentId : actorDept;
  if (!hasGlobalRevenueScope(actor) && requestedDepartmentId && String(requestedDepartmentId) !== String(actorDept)) {
    throw createError('Staff department A không được xem revenue department B.', 403);
  }
  if (!departmentId) return null;
  const encounterIds = (await Encounter.find({ department_id: toObjectId(departmentId, 'department_id') }).select('_id').lean())
    .map((encounter) => encounter._id);
  invoiceMatch.encounter_id = { $in: encounterIds };
  chargeMatch.encounter_id = { $in: encounterIds };
  const invoices = await Invoice.find({ encounter_id: { $in: encounterIds } }).select('_id').lean();
  paymentMatch.invoice_id = { $in: invoices.map((invoice) => invoice._id) };
  return departmentId;
}

function applyDateRange(match, field, filters) {
  if (!filters.date_from && !filters.date_to) return;
  match[field] = {};
  if (filters.date_from) match[field].$gte = filters.date_from;
  if (filters.date_to) match[field].$lte = filters.date_to;
}

function serializeFilters(filters = {}) {
  return {
    ...filters,
    date_from: filters.date_from ? filters.date_from.toISOString() : null,
    date_to: filters.date_to ? filters.date_to.toISOString() : null,
  };
}

function rate(part, total) {
  return total ? Number(((Number(part || 0) / Number(total)) * 100).toFixed(2)) : 0;
}

function roundNumber(value) {
  return Number((Number(value || 0) + Number.EPSILON).toFixed(2));
}

function dayExpression(field, timezone) {
  return {
    $dateToString: {
      format: '%Y-%m-%d',
      date: `$${field}`,
      timezone,
    },
  };
}

function rowsToCountMap(rows = []) {
  return Object.fromEntries(rows.map((row) => [row._id || 'unknown', row.count || 0]));
}

function countRows(rows = [], keyName) {
  return rows.map((row) => ({
    [keyName]: row._id || 'unknown',
    count: row.count || 0,
  }));
}

function sumField(rows = [], field = 'count') {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

async function hydrateDepartmentRows(rows = []) {
  const ids = rows.map((row) => row._id).filter(Boolean);
  const departments = ids.length
    ? await Department.find({ _id: { $in: ids } }).select('department_name department_code').lean()
    : [];
  const map = new Map(departments.map((department) => [String(department._id), department]));

  return rows.map((row) => {
    const department = row._id ? map.get(String(row._id)) : null;
    return {
      department_id: row._id ? String(row._id) : null,
      department_code: department?.department_code || null,
      department_name: department?.department_name || null,
      count: row.count || 0,
      amount: row.amount !== undefined ? roundNumber(row.amount) : undefined,
    };
  });
}

async function hydrateDoctorRows(rows = []) {
  const ids = rows.map((row) => row._id).filter(Boolean);
  const users = ids.length
    ? await User.find({ _id: { $in: ids } }).select('full_name employee_code department_id').lean()
    : [];
  const map = new Map(users.map((user) => [String(user._id), user]));

  return rows.map((row) => {
    const doctor = row._id ? map.get(String(row._id)) : null;
    return {
      doctor_id: row._id ? String(row._id) : null,
      doctor_code: doctor?.employee_code || null,
      doctor_name: doctor?.full_name || null,
      department_id: doctor?.department_id ? String(doctor.department_id) : null,
      count: row.count || 0,
      amount: row.amount !== undefined ? roundNumber(row.amount) : undefined,
    };
  });
}

function applyAppointmentScope(match, filters, actor = {}) {
  addObjectIdFilter(match, 'department_id', filters.department_id, 'department_id');
  addObjectIdFilter(match, 'doctor_id', filters.doctor_id, 'doctor_id');
  addObjectIdFilter(match, 'patient_id', filters.patient_id, 'patient_id');
  if (filters.status) match.status = filters.status;

  if (isBroadReportReader(actor, [PERMISSION.REPORTS.APPOINTMENTS_READ, PERMISSION.APPOINTMENTS.READ])) return;

  if (hasPermission(actor, PERMISSION.APPOINTMENTS.READ_DEPARTMENT)) {
    setScopedObjectId(match, 'department_id', actorDepartmentId(actor));
    return;
  }

  if (hasPermission(actor, PERMISSION.APPOINTMENTS.READ_OWN)) {
    setScopedObjectId(match, 'doctor_id', actorId(actor));
    return;
  }

  throw createError('Tài khoản hiện tại không có scope xem báo cáo lịch hẹn.', 403);
}

function applyQueueScope(match, filters, actor = {}) {
  addObjectIdFilter(match, 'department_id', filters.department_id, 'department_id');
  addObjectIdFilter(match, 'doctor_id', filters.doctor_id, 'doctor_id');
  addObjectIdFilter(match, 'patient_id', filters.patient_id, 'patient_id');
  if (filters.status) match.status = filters.status;

  if (isBroadReportReader(actor, [PERMISSION.REPORTS.QUEUE_READ, PERMISSION.QUEUE.READ])) return;

  if (hasPermission(actor, PERMISSION.QUEUE.READ_DEPARTMENT)) {
    setScopedObjectId(match, 'department_id', actorDepartmentId(actor));
    return;
  }

  if (hasPermission(actor, PERMISSION.QUEUE.READ_OWN)) {
    setScopedObjectId(match, 'doctor_id', actorId(actor));
    return;
  }

  throw createError('Tài khoản hiện tại không có scope xem báo cáo hàng đợi.', 403);
}

function applyEncounterScope(match, filters, actor = {}) {
  addObjectIdFilter(match, 'department_id', filters.department_id, 'department_id');
  addObjectIdFilter(match, 'attending_doctor_id', filters.doctor_id, 'doctor_id');
  addObjectIdFilter(match, 'patient_id', filters.patient_id, 'patient_id');
  if (filters.status) match.status = filters.status;

  if (isBroadReportReader(actor, [PERMISSION.REPORTS.ENCOUNTERS_READ, PERMISSION.ENCOUNTERS.READ])) return;

  if (hasPermission(actor, PERMISSION.ENCOUNTERS.READ_DEPARTMENT)) {
    setScopedObjectId(match, 'department_id', actorDepartmentId(actor));
    return;
  }

  if (hasPermission(actor, PERMISSION.ENCOUNTERS.READ_OWN)) {
    setScopedObjectId(match, 'attending_doctor_id', actorId(actor));
    return;
  }

  throw createError('Tài khoản hiện tại không có scope xem báo cáo encounter.', 403);
}

async function getAppointmentReport(query = {}, actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.APPOINTMENTS_READ, PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN]);
  const filters = normalizeReportFilters(query);
  const match = { is_deleted: false };
  applyDateRange(match, 'appointment_time', filters);
  applyAppointmentScope(match, filters, actor);

  const [byStatus, byDay, byDepartment, byDoctor, byType] = await Promise.all([
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: dayExpression('appointment_time', filters.timezone), count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$department_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$doctor_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$appointment_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const counts = rowsToCountMap(byStatus);
  const total = sumField(byStatus);

  return {
    summary: {
      total_appointments: total,
      booked_count: counts[APPOINTMENT_STATUS.BOOKED] || 0,
      confirmed_count: counts[APPOINTMENT_STATUS.CONFIRMED] || 0,
      checked_in_count: counts[APPOINTMENT_STATUS.CHECKED_IN] || 0,
      in_consultation_count: counts[APPOINTMENT_STATUS.IN_CONSULTATION] || 0,
      completed_count: counts[APPOINTMENT_STATUS.COMPLETED] || 0,
      cancelled_count: counts[APPOINTMENT_STATUS.CANCELLED] || 0,
      no_show_count: counts[APPOINTMENT_STATUS.NO_SHOW] || 0,
      rescheduled_count: counts[APPOINTMENT_STATUS.RESCHEDULED] || 0,
      completion_rate: rate(counts[APPOINTMENT_STATUS.COMPLETED], total),
      no_show_rate: rate(counts[APPOINTMENT_STATUS.NO_SHOW], total),
      cancellation_rate: rate(counts[APPOINTMENT_STATUS.CANCELLED], total),
    },
    breakdowns: {
      by_status: countRows(byStatus, 'status'),
      by_day: countRows(byDay, 'date'),
      by_department: await hydrateDepartmentRows(byDepartment),
      by_doctor: await hydrateDoctorRows(byDoctor),
      by_type: countRows(byType, 'appointment_type'),
    },
    filters: serializeFilters(filters),
  };
}

async function getQueueReport(query = {}, actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.QUEUE_READ, PERMISSION.QUEUE.READ, PERMISSION.QUEUE.READ_DEPARTMENT, PERMISSION.QUEUE.READ_OWN]);
  const filters = normalizeReportFilters(query);
  const match = {};
  applyDateRange(match, 'queue_date', filters);
  applyQueueScope(match, filters, actor);

  const [byStatus, byDepartment, byDoctor, peakHours, timing] = await Promise.all([
    QueueTicket.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    QueueTicket.aggregate([
      { $match: match },
      { $group: { _id: '$department_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    QueueTicket.aggregate([
      { $match: match },
      { $group: { _id: '$doctor_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    QueueTicket.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%H:00', date: { $ifNull: ['$checkin_time', '$created_at'] }, timezone: filters.timezone } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
    QueueTicket.aggregate([
      { $match: match },
      {
        $project: {
          waiting_minutes: {
            $cond: [
              { $and: ['$checkin_time', '$called_time'] },
              { $divide: [{ $subtract: ['$called_time', '$checkin_time'] }, 60000] },
              null,
            ],
          },
          service_minutes: {
            $cond: [
              { $and: [{ $ifNull: ['$service_start_time', '$called_time'] }, '$completed_time'] },
              { $divide: [{ $subtract: ['$completed_time', { $ifNull: ['$service_start_time', '$called_time'] }] }, 60000] },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          average_waiting_time: { $avg: '$waiting_minutes' },
          average_service_time: { $avg: '$service_minutes' },
        },
      },
    ]),
  ]);

  const counts = rowsToCountMap(byStatus);
  const total = sumField(byStatus);
  const timeSummary = timing[0] || {};

  return {
    summary: {
      total_tickets: total,
      waiting_count: counts[QUEUE_STATUS.WAITING] || 0,
      called_count: counts[QUEUE_STATUS.CALLED] || 0,
      in_service_count: counts[QUEUE_STATUS.IN_SERVICE] || 0,
      completed_count: counts[QUEUE_STATUS.COMPLETED] || 0,
      cancelled_count: counts[QUEUE_STATUS.CANCELLED] || 0,
      skipped_count: counts[QUEUE_STATUS.SKIPPED] || 0,
      recalled_count: counts[QUEUE_STATUS.RECALLED] || 0,
      average_waiting_time: roundNumber(timeSummary.average_waiting_time),
      average_service_time: roundNumber(timeSummary.average_service_time),
    },
    breakdowns: {
      by_status: countRows(byStatus, 'status'),
      by_department: await hydrateDepartmentRows(byDepartment),
      by_doctor: await hydrateDoctorRows(byDoctor),
      peak_hours: countRows(peakHours, 'hour'),
    },
    filters: serializeFilters(filters),
  };
}

async function getEncounterReport(query = {}, actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.ENCOUNTERS_READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_OWN]);
  const filters = normalizeReportFilters(query);
  const match = {};
  applyDateRange(match, 'start_time', filters);
  applyEncounterScope(match, filters, actor);

  const [byStatus, byType, byDepartment, byDoctor, byDay, timing] = await Promise.all([
    Encounter.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Encounter.aggregate([
      { $match: match },
      { $group: { _id: '$encounter_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Encounter.aggregate([
      { $match: match },
      { $group: { _id: '$department_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Encounter.aggregate([
      { $match: match },
      { $group: { _id: '$attending_doctor_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Encounter.aggregate([
      { $match: match },
      { $group: { _id: dayExpression('start_time', filters.timezone), count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Encounter.aggregate([
      { $match: { ...match, end_time: { $ne: null }, status: ENCOUNTER_STATUS.COMPLETED } },
      {
        $project: {
          duration_minutes: { $divide: [{ $subtract: ['$end_time', '$start_time'] }, 60000] },
        },
      },
      { $group: { _id: null, average_duration_minutes: { $avg: '$duration_minutes' } } },
    ]),
  ]);

  const counts = rowsToCountMap(byStatus);
  const typeCounts = rowsToCountMap(byType);
  const total = sumField(byStatus);

  return {
    summary: {
      total_encounters: total,
      planned_count: counts[ENCOUNTER_STATUS.PLANNED] || 0,
      arrived_count: counts[ENCOUNTER_STATUS.ARRIVED] || 0,
      in_progress_count: counts[ENCOUNTER_STATUS.IN_PROGRESS] || 0,
      on_hold_count: counts[ENCOUNTER_STATUS.ON_HOLD] || 0,
      completed_count: counts[ENCOUNTER_STATUS.COMPLETED] || 0,
      cancelled_count: counts[ENCOUNTER_STATUS.CANCELLED] || 0,
      outpatient_count: typeCounts.outpatient || 0,
      inpatient_count: typeCounts.inpatient || 0,
      emergency_count: typeCounts.emergency || 0,
      telemedicine_count: typeCounts.telemedicine || 0,
      average_encounter_duration: roundNumber(timing[0]?.average_duration_minutes),
      completion_rate: rate(counts[ENCOUNTER_STATUS.COMPLETED], total),
      cancellation_rate: rate(counts[ENCOUNTER_STATUS.CANCELLED], total),
    },
    breakdowns: {
      by_status: countRows(byStatus, 'status'),
      by_type: countRows(byType, 'encounter_type'),
      by_department: await hydrateDepartmentRows(byDepartment),
      by_doctor: await hydrateDoctorRows(byDoctor),
      by_day: countRows(byDay, 'date'),
    },
    filters: serializeFilters(filters),
  };
}

async function getRevenueReport(query = {}, actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.REVENUE_READ, PERMISSION.REPORTS.BILLING_READ]);
  const filters = normalizeReportFilters(query);
  assertExplicitRevenueDateRange(query, filters);
  const paymentMatch = { status: PAYMENT_STATUS.COMPLETED };
  const invoiceMatch = { status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] } };
  const chargeMatch = { status: { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.BILLED] } };

  applyDateRange(paymentMatch, 'paid_at', filters);
  applyDateRange(invoiceMatch, 'issued_at', filters);
  applyDateRange(chargeMatch, 'charged_at', filters);
  addObjectIdFilter(paymentMatch, 'patient_id', filters.patient_id, 'patient_id');
  addObjectIdFilter(invoiceMatch, 'patient_id', filters.patient_id, 'patient_id');
  addObjectIdFilter(chargeMatch, 'patient_id', filters.patient_id, 'patient_id');
  const effectiveDepartmentId = await applyRevenueDepartmentScope(paymentMatch, invoiceMatch, chargeMatch, filters, actor);

  const [paymentTotals, paymentByMethod, revenueByDay, invoiceTotals, invoiceByStatus, chargeTotals, revenueByDepartment, revenueByServiceType, refundTotals] = await Promise.all([
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, paid_amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: '$payment_method', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: dayExpression('paid_at', filters.timezone), count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      {
        $group: {
          _id: null,
          issued_invoice_amount: { $sum: '$total_amount' },
          outstanding_amount: { $sum: '$balance_due' },
          invoice_count: { $sum: 1 },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$total_amount' }, balance_due: { $sum: '$balance_due' } } },
      { $sort: { _id: 1 } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $group: { _id: null, gross_charges: { $sum: '$total_amount' }, charge_count: { $sum: 1 } } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $lookup: { from: 'service_catalog', localField: 'service_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service.department_id', count: { $sum: 1 }, amount: { $sum: '$total_amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $lookup: { from: 'service_catalog', localField: 'service_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service.service_type', count: { $sum: 1 }, amount: { $sum: '$total_amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Payment.aggregate([
      {
        $match: {
          status: { $in: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.VOIDED] },
          paid_at: paymentMatch.paid_at,
          ...(paymentMatch.invoice_id ? { invoice_id: paymentMatch.invoice_id } : {}),
          ...(paymentMatch.patient_id ? { patient_id: paymentMatch.patient_id } : {}),
        },
      },
      { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const paymentSummary = paymentTotals[0] || {};
  const invoiceSummary = invoiceTotals[0] || {};
  const chargeSummary = chargeTotals[0] || {};
  const refundMap = Object.fromEntries(refundTotals.map((row) => [row._id, row]));

  return {
    summary: {
      gross_charges: roundNumber(chargeSummary.gross_charges),
      charge_count: chargeSummary.charge_count || 0,
      issued_invoice_amount: roundNumber(invoiceSummary.issued_invoice_amount),
      invoice_count: invoiceSummary.invoice_count || 0,
      paid_amount: roundNumber(paymentSummary.paid_amount),
      payment_count: paymentSummary.count || 0,
      outstanding_amount: roundNumber(invoiceSummary.outstanding_amount),
      refund_amount: roundNumber(refundMap[PAYMENT_STATUS.REFUNDED]?.amount),
      voided_amount: roundNumber(refundMap[PAYMENT_STATUS.VOIDED]?.amount),
    },
    breakdowns: {
      payment_by_method: paymentByMethod.map((row) => ({
        payment_method: row._id || 'unknown',
        count: row.count,
        amount: roundNumber(row.amount),
      })),
      revenue_by_day: revenueByDay.map((row) => ({
        date: row._id,
        count: row.count,
        amount: roundNumber(row.amount),
      })),
      invoice_by_status: invoiceByStatus.map((row) => ({
        status: row._id,
        count: row.count,
        amount: roundNumber(row.amount),
        balance_due: roundNumber(row.balance_due),
      })),
      revenue_by_department: await hydrateDepartmentRows(revenueByDepartment),
      revenue_by_service_type: revenueByServiceType.map((row) => ({
        service_type: row._id || 'unknown',
        count: row.count,
        amount: roundNumber(row.amount),
      })),
    },
    filters: {
      ...serializeFilters(filters),
      department_id: effectiveDepartmentId ? String(effectiveDepartmentId) : filters.department_id || null,
    },
  };
}

async function getInventoryReport(query = {}, actor = {}) {
  assertAnyReportPermission(actor, [
    PERMISSION.REPORTS.INVENTORY_READ,
    PERMISSION.REPORTS.LOW_STOCK_READ,
    PERMISSION.REPORTS.EXPIRING_STOCK_READ,
    PERMISSION.STOCK_BATCHES.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ,
  ]);
  const filters = normalizeReportFilters(query);
  const now = new Date();
  const nearExpiryTo = new Date(now.getTime() + filters.near_expiry_days * 86400000);
  const transactionMatch = {};
  applyDateRange(transactionMatch, 'occurred_at', filters);
  addObjectIdFilter(transactionMatch, 'medication_id', query.medication_id, 'medication_id');

  const batchMatch = { is_deleted: false };
  addObjectIdFilter(batchMatch, 'medication_id', query.medication_id, 'medication_id');

  const [medicationCount, stockTotals, lowStock, nearExpiry, expired, recalled, byTransactionType, byDirection] = await Promise.all([
    MedicationMaster.countDocuments({ is_deleted: false }),
    StockBatch.aggregate([
      { $match: batchMatch },
      {
        $group: {
          _id: null,
          total_stock_on_hand: { $sum: '$quantity_on_hand' },
          total_stock_value: { $sum: { $multiply: ['$quantity_on_hand', { $ifNull: ['$unit_cost', 0] }] } },
          batch_count: { $sum: 1 },
        },
      },
    ]),
    StockBatch.countDocuments({
      ...batchMatch,
      quantity_on_hand: { $gt: 0 },
      $expr: { $lte: ['$quantity_on_hand', '$min_stock_level'] },
    }),
    StockBatch.countDocuments({
      ...batchMatch,
      expiry_date: { $gte: now, $lte: nearExpiryTo },
      status: { $nin: [STOCK_BATCH_STATUS.EXPIRED, STOCK_BATCH_STATUS.RECALLED, STOCK_BATCH_STATUS.DEPLETED] },
    }),
    StockBatch.countDocuments({
      ...batchMatch,
      $or: [{ expiry_date: { $lt: now } }, { status: STOCK_BATCH_STATUS.EXPIRED }],
    }),
    StockBatch.countDocuments({ ...batchMatch, status: STOCK_BATCH_STATUS.RECALLED }),
    InventoryTransaction.aggregate([
      { $match: transactionMatch },
      { $group: { _id: '$transaction_type', count: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
      { $sort: { _id: 1 } },
    ]),
    InventoryTransaction.aggregate([
      { $match: transactionMatch },
      { $group: { _id: '$direction', count: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const stock = stockTotals[0] || {};
  const directionMap = Object.fromEntries(byDirection.map((row) => [row._id, row]));

  return {
    summary: {
      total_medications: medicationCount,
      total_batches: stock.batch_count || 0,
      total_stock_on_hand: roundNumber(stock.total_stock_on_hand),
      low_stock_items: lowStock,
      near_expiry_batches: nearExpiry,
      expired_batches: expired,
      recalled_batches: recalled,
      inventory_in_quantity: roundNumber(directionMap[INVENTORY_TRANSACTION_DIRECTION.IN]?.quantity),
      inventory_out_quantity: roundNumber(directionMap[INVENTORY_TRANSACTION_DIRECTION.OUT]?.quantity),
      inventory_value: roundNumber(stock.total_stock_value),
    },
    breakdowns: {
      transactions_by_type: byTransactionType.map((row) => ({
        transaction_type: row._id,
        count: row.count,
        quantity: roundNumber(row.quantity),
      })),
      transactions_by_direction: byDirection.map((row) => ({
        direction: row._id,
        count: row.count,
        quantity: roundNumber(row.quantity),
      })),
    },
    filters: serializeFilters(filters),
  };
}

async function getDepartmentReport(query = {}, actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ, PERMISSION.DEPARTMENTS.READ, PERMISSION.DEPARTMENTS.READ_OWN]);
  const filters = normalizeReportFilters(query);
  const departmentFilter = { is_deleted: false };

  if (isBroadReportReader(actor, [PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ, PERMISSION.DEPARTMENTS.READ])) {
    if (filters.department_id) departmentFilter._id = toObjectId(filters.department_id, 'department_id');
  } else {
    const ownDepartmentId = actorDepartmentId(actor);
    if (!ownDepartmentId) throw createError('Không xác định được department của actor.', 403);
    departmentFilter._id = toObjectId(ownDepartmentId, 'department_id');
  }

  const departments = await Department.find(departmentFilter).select('department_code department_name department_type head_user_id').sort({ department_name: 1 }).lean();
  const departmentIds = departments.map((department) => department._id);
  const baseDepartmentMatch = { department_id: { $in: departmentIds } };

  const appointmentMatch = { is_deleted: false, ...baseDepartmentMatch };
  applyDateRange(appointmentMatch, 'appointment_time', filters);
  const encounterMatch = { ...baseDepartmentMatch };
  applyDateRange(encounterMatch, 'start_time', filters);
  const queueMatch = { ...baseDepartmentMatch };
  applyDateRange(queueMatch, 'queue_date', filters);

  const [appointments, encounters, doctors, queueTiming, revenue] = await Promise.all([
    Appointment.aggregate([
      { $match: appointmentMatch },
      {
        $group: {
          _id: '$department_id',
          appointment_count: { $sum: 1 },
          completed_appointment_count: { $sum: { $cond: [{ $eq: ['$status', APPOINTMENT_STATUS.COMPLETED] }, 1, 0] } },
          no_show_count: { $sum: { $cond: [{ $eq: ['$status', APPOINTMENT_STATUS.NO_SHOW] }, 1, 0] } },
        },
      },
    ]),
    Encounter.aggregate([
      { $match: encounterMatch },
      {
        $group: {
          _id: '$department_id',
          encounter_count: { $sum: 1 },
          completed_encounter_count: { $sum: { $cond: [{ $eq: ['$status', ENCOUNTER_STATUS.COMPLETED] }, 1, 0] } },
        },
      },
    ]),
    DoctorProfile.aggregate([
      { $match: { department_id: { $in: departmentIds }, is_deleted: false, status: 'active' } },
      { $group: { _id: '$department_id', doctor_count: { $sum: 1 } } },
    ]),
    QueueTicket.aggregate([
      { $match: queueMatch },
      {
        $project: {
          department_id: 1,
          waiting_minutes: {
            $cond: [
              { $and: ['$checkin_time', '$called_time'] },
              { $divide: [{ $subtract: ['$called_time', '$checkin_time'] }, 60000] },
              null,
            ],
          },
        },
      },
      { $group: { _id: '$department_id', queue_waiting_average: { $avg: '$waiting_minutes' } } },
    ]),
    Charge.aggregate([
      { $match: { status: { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.BILLED] }, charged_at: { $gte: filters.date_from, $lte: filters.date_to } } },
      { $lookup: { from: 'service_catalog', localField: 'service_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $match: { 'service.department_id': { $in: departmentIds } } },
      { $group: { _id: '$service.department_id', revenue_amount: { $sum: '$total_amount' } } },
    ]),
  ]);

  const appointmentMap = new Map(appointments.map((row) => [String(row._id), row]));
  const encounterMap = new Map(encounters.map((row) => [String(row._id), row]));
  const doctorMap = new Map(doctors.map((row) => [String(row._id), row]));
  const queueMap = new Map(queueTiming.map((row) => [String(row._id), row]));
  const revenueMap = new Map(revenue.map((row) => [String(row._id), row]));

  const items = departments.map((department) => {
    const id = String(department._id);
    const appointment = appointmentMap.get(id) || {};
    const encounter = encounterMap.get(id) || {};
    const doctor = doctorMap.get(id) || {};
    const queue = queueMap.get(id) || {};
    const revenueRow = revenueMap.get(id) || {};

    return {
      department_id: id,
      department_code: department.department_code,
      department_name: department.department_name,
      department_type: department.department_type,
      doctor_count: doctor.doctor_count || 0,
      appointment_count: appointment.appointment_count || 0,
      completed_appointment_count: appointment.completed_appointment_count || 0,
      no_show_count: appointment.no_show_count || 0,
      encounter_count: encounter.encounter_count || 0,
      completed_encounter_count: encounter.completed_encounter_count || 0,
      queue_waiting_average: roundNumber(queue.queue_waiting_average),
      revenue_amount: roundNumber(revenueRow.revenue_amount),
    };
  });

  return {
    summary: {
      department_count: items.length,
      appointment_count: sumField(items, 'appointment_count'),
      encounter_count: sumField(items, 'encounter_count'),
      doctor_count: sumField(items, 'doctor_count'),
      revenue_amount: roundNumber(sumField(items, 'revenue_amount')),
    },
    items,
    filters: serializeFilters(filters),
  };
}

async function getDoctorReport(query = {}, actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ, PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.APPOINTMENTS.READ_OWN]);
  const filters = normalizeReportFilters(query);
  const doctorFilter = { is_deleted: false, status: 'active' };

  if (isBroadReportReader(actor, [PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ])) {
    if (filters.department_id) doctorFilter.department_id = toObjectId(filters.department_id, 'department_id');
    if (filters.doctor_id) doctorFilter.user_id = toObjectId(filters.doctor_id, 'doctor_id');
  } else if (hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_DEPARTMENT])) {
    setScopedObjectId(doctorFilter, 'department_id', actorDepartmentId(actor));
  } else {
    setScopedObjectId(doctorFilter, 'user_id', actorId(actor));
  }

  const profiles = await DoctorProfile.find(doctorFilter).select('user_id department_id specialty').lean();
  const doctorIds = profiles.map((profile) => profile.user_id);
  const doctors = doctorIds.length
    ? await User.find({ _id: { $in: doctorIds } }).select('full_name employee_code department_id').lean()
    : [];
  const departments = profiles.length
    ? await Department.find({ _id: { $in: profiles.map((profile) => profile.department_id) } }).select('department_code department_name').lean()
    : [];

  const doctorMap = new Map(doctors.map((doctor) => [String(doctor._id), doctor]));
  const profileMap = new Map(profiles.map((profile) => [String(profile.user_id), profile]));
  const departmentMap = new Map(departments.map((department) => [String(department._id), department]));

  const appointmentMatch = { is_deleted: false, doctor_id: { $in: doctorIds } };
  applyDateRange(appointmentMatch, 'appointment_time', filters);
  const encounterMatch = { attending_doctor_id: { $in: doctorIds } };
  applyDateRange(encounterMatch, 'start_time', filters);
  const slotMatch = { is_deleted: false, doctor_id: { $in: doctorIds } };
  applyDateRange(slotMatch, 'start_time', filters);

  const [appointments, encounters, slots] = await Promise.all([
    Appointment.aggregate([
      { $match: appointmentMatch },
      {
        $group: {
          _id: '$doctor_id',
          appointment_count: { $sum: 1 },
          completed_appointment_count: { $sum: { $cond: [{ $eq: ['$status', APPOINTMENT_STATUS.COMPLETED] }, 1, 0] } },
          no_show_count: { $sum: { $cond: [{ $eq: ['$status', APPOINTMENT_STATUS.NO_SHOW] }, 1, 0] } },
        },
      },
    ]),
    Encounter.aggregate([
      { $match: encounterMatch },
      {
        $group: {
          _id: '$attending_doctor_id',
          encounter_count: { $sum: 1 },
          completed_encounter_count: { $sum: { $cond: [{ $eq: ['$status', ENCOUNTER_STATUS.COMPLETED] }, 1, 0] } },
          patient_ids: { $addToSet: '$patient_id' },
          average_consultation_duration: {
            $avg: {
              $cond: [
                { $and: ['$start_time', '$end_time', { $eq: ['$status', ENCOUNTER_STATUS.COMPLETED] }] },
                { $divide: [{ $subtract: ['$end_time', '$start_time'] }, 60000] },
                null,
              ],
            },
          },
        },
      },
    ]),
    ScheduleSlot.aggregate([
      { $match: slotMatch },
      {
        $group: {
          _id: '$doctor_id',
          total_slots: { $sum: 1 },
          booked_slots: { $sum: { $cond: [{ $gt: ['$booked_count', 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const appointmentMap = new Map(appointments.map((row) => [String(row._id), row]));
  const encounterMap = new Map(encounters.map((row) => [String(row._id), row]));
  const slotMap = new Map(slots.map((row) => [String(row._id), row]));

  const items = doctorIds.map((doctorId) => {
    const id = String(doctorId);
    const doctor = doctorMap.get(id);
    const profile = profileMap.get(id);
    const department = profile?.department_id ? departmentMap.get(String(profile.department_id)) : null;
    const appointment = appointmentMap.get(id) || {};
    const encounter = encounterMap.get(id) || {};
    const slot = slotMap.get(id) || {};

    return {
      doctor_id: id,
      doctor_code: doctor?.employee_code || null,
      doctor_name: doctor?.full_name || null,
      department_id: profile?.department_id ? String(profile.department_id) : null,
      department_code: department?.department_code || null,
      department_name: department?.department_name || null,
      specialty: profile?.specialty || null,
      appointment_count: appointment.appointment_count || 0,
      completed_appointment_count: appointment.completed_appointment_count || 0,
      no_show_count: appointment.no_show_count || 0,
      encounter_count: encounter.encounter_count || 0,
      completed_encounter_count: encounter.completed_encounter_count || 0,
      patient_count: encounter.patient_ids?.length || 0,
      average_consultation_duration: roundNumber(encounter.average_consultation_duration),
      total_slots: slot.total_slots || 0,
      booked_slots: slot.booked_slots || 0,
      schedule_utilization: rate(slot.booked_slots, slot.total_slots),
    };
  });

  return {
    summary: {
      doctor_count: items.length,
      appointment_count: sumField(items, 'appointment_count'),
      encounter_count: sumField(items, 'encounter_count'),
      completed_encounter_count: sumField(items, 'completed_encounter_count'),
      average_schedule_utilization: items.length
        ? roundNumber(items.reduce((sum, item) => sum + item.schedule_utilization, 0) / items.length)
        : 0,
    },
    items,
    filters: serializeFilters(filters),
  };
}

async function getSystemDashboard(actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.ADMIN_DASHBOARD_READ]);
  const filters = normalizeReportFilters({ date: new Date().toISOString() });
  const appointmentMatch = { is_deleted: false };
  applyDateRange(appointmentMatch, 'appointment_time', filters);
  const paymentMatch = { status: PAYMENT_STATUS.COMPLETED };
  applyDateRange(paymentMatch, 'paid_at', filters);

  const [todayAppointments, todayCheckedIn, activeEncounters, unpaidInvoices, revenue, lowStockCount, recentAuditEvents] = await Promise.all([
    Appointment.countDocuments(appointmentMatch),
    Appointment.countDocuments({ ...appointmentMatch, status: APPOINTMENT_STATUS.CHECKED_IN }),
    Encounter.countDocuments({ status: { $in: [ENCOUNTER_STATUS.ARRIVED, ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.ON_HOLD] } }),
    Invoice.countDocuments({ status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] }, balance_due: { $gt: 0 } }),
    Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    StockBatch.countDocuments({ is_deleted: false, quantity_on_hand: { $gt: 0 }, $expr: { $lte: ['$quantity_on_hand', '$min_stock_level'] } }),
    AuditLog.find({}).sort({ created_at: -1 }).limit(10).select('actor_type action target_type status severity message created_at').lean(),
  ]);

  return {
    cards: [
      { key: 'today_appointments', label: 'Lịch hẹn hôm nay', value: todayAppointments },
      { key: 'today_checked_in', label: 'Đã check-in hôm nay', value: todayCheckedIn },
      { key: 'active_encounters', label: 'Encounter đang xử lý', value: activeEncounters },
      { key: 'unpaid_invoices', label: 'Hóa đơn còn nợ', value: unpaidInvoices },
      { key: 'today_revenue', label: 'Doanh thu thực thu hôm nay', value: roundNumber(revenue[0]?.amount) },
      { key: 'low_stock_count', label: 'Thuốc dưới tồn tối thiểu', value: lowStockCount },
    ],
    recent_audit_events: recentAuditEvents,
    filters: serializeFilters(filters),
  };
}

async function getDepartmentDashboard(departmentId, actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ, PERMISSION.DEPARTMENTS.READ_OWN]);
  const effectiveDepartmentId = departmentId || actorDepartmentId(actor);
  if (!isBroadReportReader(actor, [PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ]) && String(effectiveDepartmentId) !== String(actorDepartmentId(actor))) {
    throw createError('Bạn chỉ được xem dashboard department của mình.', 403);
  }

  const query = { date: new Date().toISOString(), department_id: effectiveDepartmentId };
  const [appointmentReport, queueReport, encounterReport] = await Promise.all([
    getAppointmentReport(query, actor),
    getQueueReport(query, actor),
    getEncounterReport(query, actor),
  ]);

  return {
    cards: [
      { key: 'today_appointments', label: 'Lịch hẹn trong khoa', value: appointmentReport.summary.total_appointments },
      { key: 'active_queue', label: 'Queue đang chờ', value: queueReport.summary.waiting_count + queueReport.summary.called_count + queueReport.summary.in_service_count },
      { key: 'active_encounters', label: 'Encounter đang xử lý', value: encounterReport.summary.arrived_count + encounterReport.summary.in_progress_count + encounterReport.summary.on_hold_count },
      { key: 'completed_today', label: 'Hoàn tất hôm nay', value: encounterReport.summary.completed_count },
    ],
    charts: {
      appointments_by_status: appointmentReport.breakdowns.by_status,
      queue_by_status: queueReport.breakdowns.by_status,
      encounters_by_status: encounterReport.breakdowns.by_status,
    },
    filters: appointmentReport.filters,
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekRangeForDashboard(query = {}) {
  if (query.date_from || query.from || query.date_to || query.to) {
    const filters = normalizeReportFilters(query, { defaultToday: false });
    return {
      start: filters.date_from || getStartOfDay(new Date()),
      end: filters.date_to || getEndOfDay(addDays(filters.date_from || new Date(), 6)),
    };
  }

  const selectedDate = parseDate(query.date, 'date') || new Date();
  const day = selectedDate.getDay();
  const mondayOffset = (day + 6) % 7;
  const start = getStartOfDay(addDays(selectedDate, -mondayOffset));
  const end = getEndOfDay(addDays(start, 6));

  return { start, end };
}

function buildDashboardWeekSeries(rows = [], weekStart) {
  const countByDate = new Map(rows.map((row) => [row.date, Number(row.count || 0)]));

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = toDateKey(date);

    return {
      date: dateKey,
      label: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index],
      total: countByDate.get(dateKey) || 0,
    };
  });
}

async function getDoctorDashboard(query = {}, actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.APPOINTMENTS.READ_OWN]);
  const selectedQuery = { ...query, date: query.date || new Date().toISOString(), doctor_id: actorId(actor) };
  const weekRange = getWeekRangeForDashboard(query);
  const weekQuery = {
    ...query,
    date: undefined,
    date_from: weekRange.start.toISOString(),
    date_to: weekRange.end.toISOString(),
    doctor_id: actorId(actor),
  };
  const [appointmentReport, encounterReport] = await Promise.all([
    getAppointmentReport(selectedQuery, actor),
    getEncounterReport(selectedQuery, actor),
  ]);
  const weekAppointmentReport = await getAppointmentReport(weekQuery, actor);
  const appointmentByDay = weekAppointmentReport.breakdowns.by_day || [];

  return {
    kpis: {
      appointments_today: appointmentReport.summary.total_appointments,
      active_encounters: encounterReport.summary.arrived_count + encounterReport.summary.in_progress_count + encounterReport.summary.on_hold_count,
      encounters_today: encounterReport.summary.total_encounters,
      checked_in_patients: appointmentReport.summary.checked_in_count,
      completed_today: encounterReport.summary.completed_count,
    },
    weekly_overview: {
      start_date: weekRange.start.toISOString(),
      end_date: weekRange.end.toISOString(),
      appointments: buildDashboardWeekSeries(appointmentByDay, weekRange.start),
      total_appointments: weekAppointmentReport.summary.total_appointments,
      appointments_by_status: weekAppointmentReport.breakdowns.by_status,
    },
    cards: [
      { key: 'my_today_appointments', label: 'Lịch hẹn của tôi', value: appointmentReport.summary.total_appointments },
      { key: 'my_checked_in_patients', label: 'Bệnh nhân đã check-in', value: appointmentReport.summary.checked_in_count },
      { key: 'my_active_encounters', label: 'Encounter đang xử lý', value: encounterReport.summary.arrived_count + encounterReport.summary.in_progress_count + encounterReport.summary.on_hold_count },
      { key: 'my_completed_today', label: 'Đã hoàn tất', value: encounterReport.summary.completed_count },
    ],
    charts: {
      appointments_by_status: appointmentReport.breakdowns.by_status,
      encounters_by_status: encounterReport.breakdowns.by_status,
    },
    filters: appointmentReport.filters,
  };
}

async function getBillingDashboard(actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.BILLING_READ, PERMISSION.REPORTS.REVENUE_READ, PERMISSION.PAYMENTS.READ]);
  const filters = normalizeReportFilters({ date: new Date().toISOString() });
  const paymentMatch = { status: PAYMENT_STATUS.COMPLETED };
  const invoiceIssuedMatch = { status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] } };
  applyDateRange(paymentMatch, 'paid_at', filters);
  applyDateRange(invoiceIssuedMatch, 'issued_at', filters);

  const [paymentTotals, invoiceTotals, unpaidTotals, paymentByMethod, recentPayments] = await Promise.all([
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Invoice.aggregate([
      { $match: invoiceIssuedMatch },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$total_amount' } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] }, balance_due: { $gt: 0 } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$balance_due' } } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: '$payment_method', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Payment.find(paymentMatch)
      .sort({ paid_at: -1, created_at: -1 })
      .limit(10)
      .select('payment_no amount payment_method paid_at status invoice_id patient_id')
      .lean(),
  ]);

  const payments = paymentTotals[0] || {};
  const invoices = invoiceTotals[0] || {};
  const unpaid = unpaidTotals[0] || {};

  return {
    cards: [
      { key: 'today_payments', label: 'Giao dịch hôm nay', value: payments.count || 0 },
      { key: 'today_revenue', label: 'Doanh thu thực thu', value: roundNumber(payments.amount) },
      { key: 'issued_invoices', label: 'Hóa đơn phát hành', value: invoices.count || 0 },
      { key: 'unpaid_balance', label: 'Công nợ', value: roundNumber(unpaid.amount) },
    ],
    charts: {
      payment_by_method: paymentByMethod.map((row) => ({
        payment_method: row._id || 'unknown',
        count: row.count,
        amount: roundNumber(row.amount),
      })),
      recent_payments: recentPayments,
    },
    filters: serializeFilters(filters),
  };
}

async function getInventoryDashboard(actor = {}) {
  assertAnyReportPermission(actor, [PERMISSION.REPORTS.INVENTORY_READ, PERMISSION.STOCK_BATCHES.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ]);
  const inventory = await getInventoryReport({ date: new Date().toISOString() }, actor);
  return {
    cards: [
      { key: 'low_stock', label: 'Dưới tồn tối thiểu', value: inventory.summary.low_stock_items },
      { key: 'near_expiry', label: 'Sắp hết hạn', value: inventory.summary.near_expiry_batches },
      { key: 'expired_batches', label: 'Đã hết hạn', value: inventory.summary.expired_batches },
      { key: 'inventory_value', label: 'Giá trị tồn kho', value: inventory.summary.inventory_value },
    ],
    charts: {
      transactions_by_type: inventory.breakdowns.transactions_by_type,
      transactions_by_direction: inventory.breakdowns.transactions_by_direction,
    },
    filters: inventory.filters,
  };
}

const REPORT_HANDLERS = {
  appointments: getAppointmentReport,
  queue: getQueueReport,
  encounters: getEncounterReport,
  revenue: getRevenueReport,
  inventory: getInventoryReport,
  departments: getDepartmentReport,
  doctors: getDoctorReport,
};

function reportToCsv(reportType, report = {}) {
  const rows = [['section', 'key', 'value']];
  Object.entries(report.summary || {}).forEach(([key, value]) => {
    rows.push(['summary', key, value]);
  });
  Object.entries(report.breakdowns || {}).forEach(([key, value]) => {
    rows.push(['breakdown', key, JSON.stringify(value)]);
  });
  if (Array.isArray(report.items)) {
    rows.push(['items', reportType, JSON.stringify(report.items)]);
  }
  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

async function exportReport(query = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  if (!hasAnyPermission(actor, [PERMISSION.REPORTS.EXPORT, PERMISSION.REPORTS.READ_ALL])) {
    throw createError('Tài khoản hiện tại không có quyền export report.', 403);
  }
  const reportType = normalizeString(query.report_type || query.type).toLowerCase();
  const handler = REPORT_HANDLERS[reportType];
  if (!handler) throw createError('report_type không được hỗ trợ.', 400);

  const report = await handler(query, actor);
  const format = normalizeString(query.format || 'json').toLowerCase();

  await recordAuditLog({
    actor,
    action: 'reports.export',
    targetType: 'report',
    status: 'success',
    message: 'Export report.',
    requestMeta,
    metadata: {
      report_type: reportType,
      format,
      filters: query,
    },
  });

  if (format === 'csv') {
    return {
      report_type: reportType,
      format,
      content_type: 'text/csv',
      filename: `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`,
      content: reportToCsv(reportType, report),
    };
  }

  return {
    report_type: reportType,
    format: 'json',
    content_type: 'application/json',
    data: report,
  };
}

module.exports = {
  // normalizeReportFilters: Chuẩn hóa bộ lọc báo cáo.
  normalizeReportFilters,
  // getAppointmentReport: Lấy báo cáo lịch hẹn.
  getAppointmentReport,
  // getQueueReport: Lấy báo cáo hàng đợi.
  getQueueReport,
  // getEncounterReport: Lấy báo cáo lượt khám.
  getEncounterReport,
  // getRevenueReport: Lấy báo cáo doanh thu.
  getRevenueReport,
  // getInventoryReport: Lấy báo cáo tồn kho.
  getInventoryReport,
  // getDepartmentReport: Lấy báo cáo khoa/phòng ban.
  getDepartmentReport,
  // getDoctorReport: Lấy báo cáo bác sĩ.
  getDoctorReport,
  // getSystemDashboard: Lấy dashboard hệ thống.
  getSystemDashboard,
  // getDepartmentDashboard: Lấy dashboard khoa/phòng ban.
  getDepartmentDashboard,
  // getDoctorDashboard: Lấy dashboard bác sĩ.
  getDoctorDashboard,
  // getBillingDashboard: Lấy dashboard viện phí.
  getBillingDashboard,
  // getInventoryDashboard: Lấy dashboard tồn kho.
  getInventoryDashboard,
  // exportReport: Xuất báo cáo.
  exportReport,
};
