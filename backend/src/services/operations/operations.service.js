const crypto = require('crypto');
const mongoose = require('mongoose');
const os = require('os');
const ApiError = require('../../common/errors/api-error');
const env = require('../../config/env');
const eventBus = require('../../events/event-bus.service');
const jobs = require('../../jobs');
const jobQueue = require('../../jobs/job-queue.service');
const jobRunLogService = require('../../jobs/job-run-log.service');
const notificationDeliveryWorker = require('../../notifications/notification-delivery.worker');
const realtimeService = require('../../realtime/realtime.service');
const presenceService = require('../../realtime/presence.service');
const roomNaming = require('../../realtime/room-naming');
const auditService = require('../audit.service');
const appointmentService = require('../appointment.service');
const clinicalDocumentFilesService = require('../clinical-document-files.service');
const queueService = require('../queue.service');
const scheduleService = require('../schedule.service');
const workerHealthService = require('../worker-health.service');
const { startOfDay, endOfDay } = require('../../common/helpers/date-time.helper');
const {
  EVENT_OUTBOX_STATUS,
  EVENT_OUTBOX_STATUSES,
  IDEMPOTENCY_STATUS,
  IDEMPOTENCY_STATUSES,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_DELIVERY_STATUSES,
  QR_TOKEN_TYPES,
} = require('../../constants/statuses');
const {
  Attachment,
  AuditLog,
  Appointment,
  Charge,
  ClinicalNote,
  ClinicalAlert,
  DiagnosticRun,
  Diagnosis,
  Dispense,
  Encounter,
  EventOutbox,
  DoctorProfile,
  DoctorSchedule,
  FacilityLocation,
  IdempotencyRecord,
  ImagingRoom,
  ImagingOrder,
  ImagingReport,
  Invoice,
  JobRunLog,
  LabOrder,
  LabResult,
  MedicalRecord,
  MaintenanceWindow,
  Notification,
  NotificationDelivery,
  Order,
  Patient,
  Payment,
  Prescription,
  ProcedureOrder,
  ProcedureResult,
  QrToken,
  QueueTicket,
  Receipt,
  Room,
  ScheduleSlot,
  User,
  Department,
} = require('../../models');

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;
const STALE_PROCESSING_MS = 5 * 60 * 1000;

const JOB_REGISTRY = [
  { job_name: 'expirePaymentIntents', domain: 'Billing', queue_name: 'billing-jobs', schedule: 'every 5 minutes', handler: 'expirePaymentIntents', manual: true },
  { job_name: 'expireQrTokens', domain: 'Platform / QR', queue_name: 'platform-jobs', schedule: 'daily cleanup', handler: 'expireQrTokens', manual: true },
  { job_name: 'sendAppointmentReminders', domain: 'Scheduling', queue_name: 'scheduling-jobs', schedule: 'every 15 minutes', handler: 'sendAppointmentReminders', manual: true },
  { job_name: 'markNoShowAppointments', domain: 'Scheduling', queue_name: 'scheduling-jobs', schedule: 'every 15 minutes', handler: 'markNoShowAppointments', manual: true },
  { job_name: 'closeExpiredScheduleSlots', domain: 'Scheduling', queue_name: 'scheduling-jobs', schedule: 'every 5 minutes', handler: 'closeExpiredScheduleSlots', manual: true },
  { job_name: 'expireDocumentExports', domain: 'Patient Portal / Records', queue_name: 'document-jobs', schedule: 'hourly', handler: 'expireDocumentExports', manual: true },
  { job_name: 'purgeTemporaryExportFiles', domain: 'Files', queue_name: 'document-jobs', schedule: 'daily', handler: 'purgeTemporaryExportFiles', manual: true },
  { job_name: 'expireSupportSla', domain: 'Support', queue_name: 'support-jobs', schedule: 'every 10 minutes', handler: 'expireSupportSla', manual: true },
  { job_name: 'sendInsuranceExpiryReminder', domain: 'Insurance', queue_name: 'insurance-jobs', schedule: 'daily', handler: 'sendInsuranceExpiryReminder', manual: true },
  { job_name: 'dailyBedChargePosting', domain: 'Inpatient / Billing', queue_name: 'inpatient-jobs', schedule: 'daily', handler: 'dailyBedChargePosting', manual: true },
  { job_name: 'lowStockAlert', domain: 'Pharmacy', queue_name: 'pharmacy-jobs', schedule: 'hourly', handler: 'lowStockAlert', manual: true },
  { job_name: 'drugExpiryAlert', domain: 'Pharmacy', queue_name: 'pharmacy-jobs', schedule: 'daily', handler: 'drugExpiryAlert', manual: true },
  { job_name: 'cleanupOldSessions', domain: 'Security', queue_name: 'security-jobs', schedule: 'daily', handler: 'cleanupOldSessions', manual: true },
  { job_name: 'archiveOldNotifications', domain: 'Notification', queue_name: 'notification-jobs', schedule: 'hourly', handler: 'archiveOldNotifications', manual: true },
  { job_name: 'detectOverdueNursingTasks', domain: 'Nursing', queue_name: 'nursing-jobs', schedule: 'every 10 minutes', handler: 'detectOverdueNursingTasks', manual: true },
  { job_name: 'diagnosticAlertSlaSweep', domain: 'Clinical Ops', queue_name: 'clinical-ops-jobs', schedule: 'every 5 minutes', handler: 'diagnosticAlertSlaSweep', manual: true },
  { job_name: 'publishOutboxEvents', domain: 'Event Outbox', queue_name: 'event-outbox', schedule: 'polling worker', handler: 'publishOutboxEvents', manual: true },
  { job_name: 'dispatchNotificationDeliveries', domain: 'Notification', queue_name: 'notification-delivery', schedule: 'polling worker', handler: 'dispatchNotificationDeliveries', manual: true },
];

const DIAGNOSTIC_CHECKS = [
  { check_name: 'database', component: 'Database', severity_when_failed: 'critical' },
  { check_name: 'mongo_indexes', component: 'Mongo indexes', severity_when_failed: 'high' },
  { check_name: 'redis_bullmq', component: 'BullMQ / Redis', severity_when_failed: 'medium' },
  { check_name: 'realtime', component: 'Socket.IO', severity_when_failed: 'medium' },
  { check_name: 'smtp', component: 'SMTP provider', severity_when_failed: 'medium' },
  { check_name: 'push_provider', component: 'Push provider', severity_when_failed: 'medium' },
  { check_name: 'outbox_stuck', component: 'Event outbox', severity_when_failed: 'high' },
  { check_name: 'notification_delivery', component: 'Notification delivery', severity_when_failed: 'high' },
  { check_name: 'file_scan_provider', component: 'File scan', severity_when_failed: 'high' },
  { check_name: 'idempotency_stuck', component: 'Idempotency', severity_when_failed: 'medium' },
  { check_name: 'maintenance', component: 'Maintenance mode', severity_when_failed: 'info' },
  { check_name: 'route_guards', component: 'Route guards', severity_when_failed: 'medium' },
  { check_name: 'rbac_integrity', component: 'RBAC integrity', severity_when_failed: 'high' },
  { check_name: 'permission_map', component: 'Permission map', severity_when_failed: 'medium' },
  { check_name: 'data_consistency', component: 'Data consistency', severity_when_failed: 'high' },
];

function now() {
  return new Date();
}

function hoursAgo(hours) {
  return new Date(Date.now() - Number(hours || 0) * 60 * 60 * 1000);
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function toId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
}

function serialize(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  if (!plain || typeof plain !== 'object') return plain;
  const out = { ...plain };
  if (out._id) out.id = toId(out._id);
  return out;
}

function csv(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pagination(query = {}, defaultLimit = DEFAULT_LIMIT) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || defaultLimit), 1), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

function sortSpec(query = {}, fallback = 'created_at') {
  const allowed = new Set([
    'created_at',
    'updated_at',
    'started_at',
    'finished_at',
    'occurred_at',
    'last_attempt_at',
    'next_retry_at',
    'next_attempt_at',
    'expires_at',
    'locked_at',
    'dead_letter_at',
    'duration_ms',
    'retry_count',
    'attempt_count',
  ]);
  const field = allowed.has(String(query.sort_by || '')) ? String(query.sort_by) : fallback;
  const direction = String(query.sort_direction || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  return { [field]: direction };
}

function idFilter(value, extraField) {
  const clauses = [];
  if (mongoose.Types.ObjectId.isValid(value)) clauses.push({ _id: value });
  if (extraField) clauses.push({ [extraField]: value });
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

function textSearch(fields = [], value) {
  const q = String(value || '').trim();
  if (!q) return null;
  const pattern = escapeRegex(q);
  const clauses = fields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } }));
  if (mongoose.Types.ObjectId.isValid(q)) clauses.push({ _id: q });
  return { $or: clauses };
}

function actorSnapshot(auth = {}) {
  return {
    actor_type: auth.actorType || auth.actor_type || 'staff',
    actor_id: auth.userId || auth.user_id || auth.actorId || auth.actor_id || auth.user?._id || null,
  };
}

async function recordOpsAudit(auth = {}, action, targetType, targetId, metadata = {}, requestMeta = {}) {
  return auditService.recordAuditLog({
    actor: auth,
    action,
    moduleKey: 'operations',
    targetType,
    targetId,
    status: 'success',
    severity: metadata?.severity || 'info',
    message: action,
    requestMeta,
    metadata,
  }).catch(() => null);
}

async function countByStatus(Model, statuses = [], baseFilter = {}) {
  const pairs = await Promise.all(statuses.map(async (status) => [
    status,
    await Model.countDocuments({ ...baseFilter, status }).catch(() => 0),
  ]));
  return Object.fromEntries(pairs);
}

async function countByField(Model, field, values = [], baseFilter = {}) {
  const pairs = await Promise.all(values.map(async (value) => [
    value,
    await Model.countDocuments({ ...baseFilter, [field]: value }).catch(() => 0),
  ]));
  return Object.fromEntries(pairs);
}

function statusFromCounts({ deadLetter = 0, failed = 0, pending = 0, processing = 0 } = {}) {
  if (safeNumber(deadLetter) > 0 || safeNumber(failed) >= 10) return 'critical';
  if (safeNumber(failed) > 0 || safeNumber(pending) >= 100 || safeNumber(processing) >= 50) return 'degraded';
  return 'healthy';
}

function ageMs(date) {
  if (!date) return null;
  const at = new Date(date).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(Date.now() - at, 0);
}

function buildComponent(key, name, status, signal, action, counters = {}) {
  return { key, name, status, signal, action, counters };
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '').slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function operationDate(query = {}) {
  return localDateKey(query.date || new Date());
}

async function safeSchedulingRead(label, read, fallback) {
  try {
    return { label, value: await read(), error: null };
  } catch (error) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return { label, value: fallback, error: error.message };
    }
    throw error;
  }
}

function appointmentHour(item = {}) {
  const date = new Date(item.appointment_time || item.time || item.start);
  return Number.isNaN(date.getTime()) ? null : date.getHours();
}

function queueHour(item = {}) {
  const date = new Date(item.checkin_time || item.created_at);
  return Number.isNaN(date.getTime()) ? null : date.getHours();
}

function queueWaitMinutes(item = {}) {
  const start = new Date(item.checkin_time || item.created_at).getTime();
  const end = item.service_start_time ? new Date(item.service_start_time).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 60000);
}

function buildHourlyFlowItems(appointments = [], queueTickets = []) {
  return Array.from({ length: 12 }).map((_, index) => {
    const hour = index + 7;
    const appointmentItems = appointments.filter((item) => appointmentHour(item) === hour);
    const queueItems = queueTickets.filter((item) => queueHour(item) === hour);
    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      appointments: appointmentItems.length,
      checked_in: appointmentItems.filter((item) => item.status === 'checked_in').length,
      queue_waiting: queueItems.filter((item) => item.status === 'waiting').length,
      in_service: queueItems.filter((item) => item.status === 'in_service').length,
      completed: appointmentItems.filter((item) => item.status === 'completed').length,
      no_show: appointmentItems.filter((item) => item.status === 'no_show').length,
    };
  });
}

async function getSchedulingDashboardToday(query = {}, actor = {}) {
  const date = operationDate(query);
  const [scheduleResult, appointmentResult, queueResult, queueListResult] = await Promise.all([
    safeSchedulingRead('schedule', () => scheduleService.getSchedulingSystemSummary({ date_from: date, date_to: date }, actor), {}),
    safeSchedulingRead('appointments', () => appointmentService.getAppointmentSummary({ date }, actor), {}),
    safeSchedulingRead('queue', () => queueService.getTodayQueueSummary({ date }, actor), {}),
    safeSchedulingRead('queue_items', () => queueService.listQueueTickets({ date, limit: 200 }, actor), { items: [] }),
  ]);

  const scheduleOverview = scheduleResult.value?.overview || {};
  const appointmentSummary = appointmentResult.value || {};
  const queueSummary = queueResult.value || {};
  const queueItems = queueListResult.value?.items || [];
  const maxWaitMinutes = queueItems.reduce((max, item) => Math.max(max, queueWaitMinutes(item)), 0);
  const criticalAlerts = [
    Number(queueSummary.waiting || 0) > 20,
    maxWaitMinutes >= 30,
    Number(appointmentSummary.no_show_rate || 0) >= 10,
  ].filter(Boolean).length;
  const warningAlerts = [
    Number(scheduleOverview.unpublished_schedules || 0) > 0,
    Number(queueSummary.skipped || 0) > 0,
    Number(appointmentSummary.cancellation_rate || 0) >= 10,
  ].filter(Boolean).length;

  return {
    date,
    health: {
      status: criticalAlerts > 0 ? 'warning' : 'healthy',
      score: Math.max(50, 100 - criticalAlerts * 12 - warningAlerts * 5),
      critical_alerts: criticalAlerts,
      warning_alerts: warningAlerts,
    },
    schedules: scheduleOverview,
    appointments: appointmentSummary,
    queue: {
      ...queueSummary,
      max_wait_minutes: maxWaitMinutes,
      waiting_over_15m: queueItems.filter((item) => queueWaitMinutes(item) >= 15).length,
      waiting_over_30m: queueItems.filter((item) => queueWaitMinutes(item) >= 30).length,
    },
    partial_errors: [scheduleResult, appointmentResult, queueResult, queueListResult]
      .filter((item) => item.error)
      .map((item) => ({ source: item.label, message: item.error })),
  };
}

async function getSchedulingHourlyFlow(query = {}, actor = {}) {
  const date = operationDate(query);
  const [appointmentsResult, queueResult] = await Promise.all([
    safeSchedulingRead('appointments', () => appointmentService.listAppointments({ date, limit: 500 }, actor), { items: [] }),
    safeSchedulingRead('queue', () => queueService.listQueueTickets({ date, limit: 500 }, actor), { items: [] }),
  ]);

  return {
    date,
    items: buildHourlyFlowItems(appointmentsResult.value?.items || [], queueResult.value?.items || []),
    partial_errors: [appointmentsResult, queueResult]
      .filter((item) => item.error)
      .map((item) => ({ source: item.label, message: item.error })),
  };
}

const PATIENT_FLOW_STEP_DEFINITIONS = [
  { key: 'portal_identity', label: 'Portal / hồ sơ BN' },
  { key: 'appointment_created', label: 'Đặt lịch' },
  { key: 'schedule_published', label: 'Lịch bác sĩ / slot' },
  { key: 'appointment_confirmed', label: 'Booked / confirmed' },
  { key: 'patient_arrived', label: 'Đến viện' },
  { key: 'frontdesk_checkin', label: 'Lễ tân check-in' },
  { key: 'queue_ticket', label: 'Queue ticket' },
  { key: 'nursing_triage', label: 'Điều dưỡng / sinh hiệu' },
  { key: 'ready_for_doctor', label: 'Ready for doctor' },
  { key: 'doctor_called', label: 'Bác sĩ gọi BN' },
  { key: 'encounter_started', label: 'Bắt đầu encounter' },
  { key: 'clinical_documented', label: 'Note / chẩn đoán' },
  { key: 'orders_prescription', label: 'Chỉ định / kê đơn' },
  { key: 'worklists_received', label: 'CLS / nhà thuốc nhận' },
  { key: 'charges_created', label: 'Charge dịch vụ / thuốc' },
  { key: 'invoice_created', label: 'Billing tạo invoice' },
  { key: 'payment_confirmed', label: 'Payment / receipt' },
  { key: 'results_completed', label: 'Kết quả hoàn tất' },
  { key: 'doctor_review_complete', label: 'Bác sĩ hoàn tất' },
  { key: 'record_released', label: 'Hồ sơ finalize / release' },
];

function uniqueIds(values = []) {
  return [...new Set(values.filter(Boolean).map(toId).filter(Boolean))];
}

function byId(items = []) {
  return new Map(items.map((item) => [toId(item._id || item.id), item]));
}

function idsFrom(items = [], fields = []) {
  return uniqueIds(items.flatMap((item) => fields.map((field) => item?.[field])));
}

function patientFlowDateRange(query = {}) {
  const date = operationDate(query);
  return {
    date,
    start: startOfDay(query.date || date),
    end: endOfDay(query.date || date),
  };
}

function scopedFlowFilter(query = {}) {
  const filter = {};
  if (query.department_id) filter.department_id = query.department_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  return filter;
}

function patientLabel(patient = {}) {
  return patient?.full_name || patient?.patient_name || 'Chưa rõ bệnh nhân';
}

function doctorLabel(doctor = {}) {
  return doctor?.full_name || doctor?.name || doctor?.username || 'Chưa phân bác sĩ';
}

function departmentLabel(department = {}) {
  return department?.department_name || department?.name || department?.department_code || 'Chưa rõ khoa';
}

function moneySum(items = [], field = 'total_amount') {
  return items.reduce((sum, item) => sum + safeNumber(item?.[field]), 0);
}

function statusCounts(items = []) {
  return items.reduce((result, item) => {
    const key = item?.status || 'unknown';
    result[key] = safeNumber(result[key]) + 1;
    return result;
  }, {});
}

function allTerminal(items = [], terminal = []) {
  if (!items.length) return false;
  return items.every((item) => terminal.includes(item?.status));
}

function stepStatus(done, current = false, attention = false) {
  if (attention) return 'attention';
  if (done) return 'done';
  if (current) return 'current';
  return 'pending';
}

function queueWaitMinutesFlow(ticket = {}) {
  const start = new Date(ticket.checkin_time || ticket.created_at).getTime();
  const end = ticket.service_start_time ? new Date(ticket.service_start_time).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 60000);
}

function serviceMinutesFlow(ticket = {}, encounter = {}) {
  const start = new Date(ticket.service_start_time || encounter.started_at || encounter.start_time).getTime();
  const end = ticket.completed_time || encounter.end_time || Date.now();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(endMs) || endMs < start) return 0;
  return Math.round((endMs - start) / 60000);
}

function diagnosticCounts({ labOrders = [], labResults = [], imagingOrders = [], imagingReports = [], procedureOrders = [], procedureResults = [] } = {}) {
  const labFinal = labResults.filter((item) => ['final', 'amended'].includes(item.status));
  const imagingFinal = imagingReports.filter((item) => ['final', 'amended'].includes(item.status));
  const procedureFinal = procedureResults.filter((item) => ['final', 'amended'].includes(item.status));
  const totalOrders = labOrders.length + imagingOrders.length + procedureOrders.length;
  const completedOrders = [
    ...labOrders.filter((item) => item.status === 'completed'),
    ...imagingOrders.filter((item) => item.status === 'completed'),
    ...procedureOrders.filter((item) => item.status === 'completed'),
  ].length;

  return {
    total_orders: totalOrders,
    completed_orders: completedOrders,
    pending_orders: totalOrders - completedOrders,
    final_results: labFinal.length + imagingFinal.length + procedureFinal.length,
    critical_results: [
      ...labResults.filter((item) => item.is_critical),
      ...imagingReports.filter((item) => item.is_critical),
      ...procedureResults.filter((item) => item.is_critical),
    ].length,
    lab: { total: labOrders.length, completed: labOrders.filter((item) => item.status === 'completed').length, final: labFinal.length },
    imaging: { total: imagingOrders.length, completed: imagingOrders.filter((item) => item.status === 'completed').length, final: imagingFinal.length },
    procedure: { total: procedureOrders.length, completed: procedureOrders.filter((item) => item.status === 'completed').length, final: procedureFinal.length },
  };
}

function summarizeOrderState(orders = []) {
  return {
    total: orders.length,
    by_type: orders.reduce((result, item) => {
      const key = item.order_type || 'other';
      result[key] = safeNumber(result[key]) + 1;
      return result;
    }, {}),
    by_status: statusCounts(orders),
    open: orders.filter((item) => !['completed', 'cancelled', 'entered_in_error'].includes(item.status)).length,
    completed: orders.filter((item) => item.status === 'completed').length,
  };
}

function summarizePharmacyState({ prescriptions = [], dispenses = [] } = {}) {
  return {
    prescriptions_total: prescriptions.length,
    prescriptions_active: prescriptions.filter((item) => ['verified', 'active', 'partially_dispensed'].includes(item.status)).length,
    dispenses_total: dispenses.length,
    dispenses_pending: dispenses.filter((item) => !['completed', 'cancelled'].includes(item.status)).length,
    dispenses_completed: dispenses.filter((item) => item.status === 'completed').length,
  };
}

function summarizeBillingState({ charges = [], invoices = [], payments = [], receipts = [] } = {}) {
  return {
    charges_total: charges.length,
    charges_amount: moneySum(charges),
    charges_open: charges.filter((item) => ['pending', 'draft', 'posted'].includes(item.status)).length,
    invoices_total: invoices.length,
    invoices_open: invoices.filter((item) => !['paid', 'voided', 'cancelled', 'refunded'].includes(item.status)).length,
    invoices_paid: invoices.filter((item) => item.status === 'paid').length,
    balance_due: moneySum(invoices, 'balance_due'),
    payments_total: payments.length,
    payments_confirmed: payments.filter((item) => ['confirmed', 'completed'].includes(item.status)).length,
    receipts_generated: receipts.length,
  };
}

function summarizeRecordState(records = []) {
  const current = records.find((item) => item.released_to_patient) || records.find((item) => ['finalized', 'sealed'].includes(item.status)) || records[0] || null;
  return {
    total: records.length,
    record_id: toId(current?._id),
    record_no: current?.record_no || '',
    status: current?.status || '',
    finalized: Boolean(current?.finalized_at || ['finalized', 'sealed', 'archived'].includes(current?.status)),
    released_to_patient: Boolean(current?.released_to_patient),
    released_at: current?.released_at || null,
  };
}

function inferFlowStage(parts = {}) {
  const {
    appointment,
    queueTicket,
    encounter,
    orders = [],
    diagnostics = {},
    pharmacy = {},
    billing = {},
    record = {},
  } = parts;
  const appointmentStatus = appointment?.status;
  const queueStatus = queueTicket?.status;
  const nursingStage = queueTicket?.nursing_stage || encounter?.nursing_status;
  const hasOrders = orders.length > 0 || pharmacy.prescriptions_total > 0;
  const diagnosticsPending = diagnostics.total_orders > 0 && diagnostics.final_results < diagnostics.total_orders;
  const billingPending = billing.invoices_open > 0 || billing.charges_open > 0 || billing.balance_due > 0;

  if (['cancelled', 'no_show', 'rescheduled'].includes(appointmentStatus) || ['cancelled', 'no_show', 'skipped'].includes(queueStatus)) return 'exceptions';
  if (record.released_to_patient || record.finalized) return 'finalized';
  if (encounter?.status === 'completed' && !billingPending && !diagnosticsPending) return 'completed';
  if (billingPending) return 'payment_pending';
  if (diagnosticsPending) return 'results_pending';
  if (hasOrders && !allTerminal(orders, ['completed', 'cancelled', 'entered_in_error'])) return 'orders_active';
  if (encounter?.status === 'in_progress' || encounter?.status === 'on_hold' || queueStatus === 'in_service') return 'in_consultation';
  if (queueStatus === 'called' || queueStatus === 'recalled') return 'called';
  if (nursingStage === 'ready_for_doctor' || queueTicket?.ready_for_doctor_at || encounter?.ready_for_doctor_at) return 'ready_for_doctor';
  if (nursingStage && nursingStage !== 'not_started' && queueTicket) return 'waiting_nurse';
  if (queueTicket || appointmentStatus === 'checked_in') return 'checked_in';
  if (appointmentStatus === 'confirmed') return 'confirmed';
  return 'scheduled';
}

function buildWorkflowSteps(parts = {}, currentStage = 'scheduled') {
  const {
    patient,
    appointment,
    queueTicket,
    encounter,
    notes = [],
    diagnoses = [],
    orders = [],
    diagnostics = {},
    pharmacy = {},
    billing = {},
    record = {},
  } = parts;
  const appointmentConfirmed = ['confirmed', 'checked_in', 'in_consultation', 'completed'].includes(appointment?.status);
  const nursingStage = queueTicket?.nursing_stage || encounter?.nursing_status;
  const hasDoctorDocumentation = notes.length > 0 || diagnoses.length > 0;
  const hasClinicalWorklist = diagnostics.total_orders > 0 || pharmacy.prescriptions_total > 0;
  const paymentDone = billing.payments_confirmed > 0 || (billing.invoices_total > 0 && billing.balance_due === 0);
  const resultsDone = diagnostics.total_orders === 0 ? false : diagnostics.final_results >= diagnostics.total_orders;

  const doneByKey = {
    portal_identity: Boolean(patient),
    appointment_created: Boolean(appointment),
    schedule_published: Boolean(appointment?.doctor_schedule_id || appointment?.schedule_slot_id),
    appointment_confirmed: appointmentConfirmed,
    patient_arrived: Boolean(queueTicket || appointment?.checked_in_at),
    frontdesk_checkin: Boolean(appointment?.checked_in_at || queueTicket?.checkin_time),
    queue_ticket: Boolean(queueTicket),
    nursing_triage: ['triage_done', 'vital_done', 'ready_for_doctor', 'completed'].includes(nursingStage) || Boolean(queueTicket?.vital_recorded_at || encounter?.vital_recorded_at),
    ready_for_doctor: nursingStage === 'ready_for_doctor' || Boolean(queueTicket?.ready_for_doctor_at || encounter?.ready_for_doctor_at),
    doctor_called: ['called', 'recalled', 'in_service', 'completed'].includes(queueTicket?.status),
    encounter_started: Boolean(encounter?.started_at || encounter?.status === 'in_progress' || encounter?.status === 'completed'),
    clinical_documented: hasDoctorDocumentation,
    orders_prescription: orders.length > 0 || pharmacy.prescriptions_total > 0,
    worklists_received: hasClinicalWorklist,
    charges_created: billing.charges_total > 0,
    invoice_created: billing.invoices_total > 0,
    payment_confirmed: paymentDone,
    results_completed: resultsDone,
    doctor_review_complete: encounter?.status === 'completed',
    record_released: record.released_to_patient || record.finalized,
  };

  return PATIENT_FLOW_STEP_DEFINITIONS.map((step) => ({
    ...step,
    status: stepStatus(doneByKey[step.key], false, currentStage === 'exceptions' && !doneByKey[step.key]),
  }));
}

function buildFlowAlerts(items = []) {
  return items.flatMap((item) => {
    const alerts = [];
    if (item.current_stage === 'exceptions') {
      alerts.push({
        id: `flow-exception-${item.flow_id}`,
        severity: 'high',
        title: 'Luồng bệnh nhân cần điều phối',
        message: `${item.patient_name} đang ở trạng thái ngoại lệ (${item.appointment_status || item.queue_status || item.current_stage}).`,
        patientName: item.patient_name,
        departmentName: item.department_name,
        queueId: item.queue_ticket_id,
        appointmentId: item.appointment_id,
        type: 'patient_flow_exception',
        flow_id: item.flow_id,
      });
    }
    if (item.waiting_minutes >= 30 && !['completed', 'finalized'].includes(item.current_stage)) {
      alerts.push({
        id: `flow-wait-${item.flow_id}`,
        severity: item.waiting_minutes >= 60 ? 'critical' : 'medium',
        title: 'Bệnh nhân chờ lâu',
        message: `${item.patient_name} đã chờ ${item.waiting_minutes} phút trong luồng ${item.department_name}.`,
        patientName: item.patient_name,
        departmentName: item.department_name,
        queueId: item.queue_ticket_id,
        appointmentId: item.appointment_id,
        type: 'wait_sla',
        flow_id: item.flow_id,
      });
    }
    if (item.billing_summary?.balance_due > 0) {
      alerts.push({
        id: `flow-billing-${item.flow_id}`,
        severity: 'medium',
        title: 'Còn công nợ trong lượt khám',
        message: `${item.patient_name} còn ${item.billing_summary.balance_due.toLocaleString('vi-VN')}đ chưa thanh toán.`,
        patientName: item.patient_name,
        departmentName: item.department_name,
        type: 'billing_pending',
        flow_id: item.flow_id,
      });
    }
    if (item.diagnostic_summary?.critical_results > 0) {
      alerts.push({
        id: `flow-critical-result-${item.flow_id}`,
        severity: 'critical',
        title: 'Có kết quả critical',
        message: `${item.patient_name} có kết quả critical cần bác sĩ xác nhận.`,
        patientName: item.patient_name,
        departmentName: item.department_name,
        type: 'critical_result',
        flow_id: item.flow_id,
      });
    }
    return alerts;
  }).slice(0, 80);
}

function groupFlowColumns(items = []) {
  const keys = ['scheduled', 'confirmed', 'checked_in', 'waiting_nurse', 'ready_for_doctor', 'called', 'in_consultation', 'orders_active', 'payment_pending', 'results_pending', 'completed', 'finalized', 'exceptions'];
  return Object.fromEntries(keys.map((key) => [key, items.filter((item) => item.current_stage === key)]));
}

function summarizePatientFlow(items = []) {
  const count = (stage) => items.filter((item) => item.current_stage === stage).length;
  return {
    total: items.length,
    scheduled: count('scheduled') + count('confirmed'),
    checked_in: count('checked_in') + count('waiting_nurse') + count('ready_for_doctor') + count('called'),
    waiting: count('checked_in') + count('waiting_nurse') + count('ready_for_doctor'),
    ready_for_doctor: count('ready_for_doctor'),
    in_consultation: count('in_consultation'),
    orders_active: count('orders_active'),
    payment_pending: count('payment_pending'),
    results_pending: count('results_pending'),
    completed: count('completed'),
    finalized: count('finalized'),
    no_show: items.filter((item) => item.appointment_status === 'no_show' || item.queue_status === 'no_show').length,
    needs_action: items.filter((item) => item.current_stage === 'exceptions' || item.sla_status === 'breached').length,
  };
}

async function loadPatientFlowBundle(query = {}) {
  const { date, start, end } = patientFlowDateRange(query);
  const appointmentFilter = {
    ...scopedFlowFilter(query),
    is_deleted: false,
    appointment_time: { $gte: start, $lte: end },
  };
  const queueFilter = {
    ...scopedFlowFilter(query),
    queue_date: { $gte: start, $lte: end },
  };

  const [appointments, queueTickets] = await Promise.all([
    Appointment.find(appointmentFilter).sort({ appointment_time: 1 }).limit(700).lean(),
    QueueTicket.find(queueFilter).sort({ checkin_time: 1, queue_number: 1 }).limit(700).lean(),
  ]);

  const appointmentIds = uniqueIds([
    ...appointments.map((item) => item._id),
    ...queueTickets.map((item) => item.appointment_id),
  ]);
  const queueEncounterIds = uniqueIds(queueTickets.map((item) => item.encounter_id));
  const encounterFilter = {
    $or: [
      { start_time: { $gte: start, $lte: end } },
      ...(appointmentIds.length ? [{ appointment_id: { $in: appointmentIds } }] : []),
      ...(queueEncounterIds.length ? [{ _id: { $in: queueEncounterIds } }] : []),
    ],
  };
  if (query.department_id) encounterFilter.department_id = query.department_id;
  if (query.doctor_id) encounterFilter.attending_doctor_id = query.doctor_id;
  const encounters = await Encounter.find(encounterFilter).sort({ start_time: 1 }).limit(700).lean();
  const encounterIds = uniqueIds([
    ...encounters.map((item) => item._id),
    ...queueEncounterIds,
  ]);

  const [
    orders,
    notes,
    diagnoses,
    labOrders,
    baseLabResults,
    imagingOrders,
    baseImagingReports,
    procedureOrders,
    procedureResults,
    prescriptions,
    dispenses,
    charges,
    invoices,
    basePayments,
    baseReceipts,
    records,
  ] = await Promise.all([
    encounterIds.length ? Order.find({ encounter_id: { $in: encounterIds } }).sort({ ordered_at: 1 }).limit(1000).lean() : [],
    encounterIds.length ? ClinicalNote.find({ encounter_id: { $in: encounterIds }, status: { $ne: 'cancelled' } }).select('encounter_id status signed_at').limit(1000).lean() : [],
    encounterIds.length ? Diagnosis.find({ encounter_id: { $in: encounterIds }, status: { $ne: 'entered_in_error' } }).select('encounter_id status is_primary diagnosis_name').limit(1000).lean() : [],
    encounterIds.length ? LabOrder.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
    [],
    encounterIds.length ? ImagingOrder.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
    [],
    encounterIds.length ? ProcedureOrder.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
    encounterIds.length ? ProcedureResult.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
    encounterIds.length ? Prescription.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
    encounterIds.length ? Dispense.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
    encounterIds.length ? Charge.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
    encounterIds.length ? Invoice.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
    [],
    [],
    encounterIds.length ? MedicalRecord.find({ encounter_id: { $in: encounterIds } }).limit(1000).lean() : [],
  ]);

  const labOrderIds = uniqueIds(labOrders.map((item) => item._id));
  const imagingOrderIds = uniqueIds(imagingOrders.map((item) => item._id));
  const invoiceIds = uniqueIds(invoices.map((item) => item._id));
  const [resolvedLabResults, resolvedImagingReports, resolvedPayments, resolvedReceipts] = await Promise.all([
    labOrderIds.length ? LabResult.find({ lab_order_id: { $in: labOrderIds }, is_current: { $ne: false } }).limit(1000).lean() : baseLabResults,
    imagingOrderIds.length ? ImagingReport.find({ imaging_order_id: { $in: imagingOrderIds }, is_current: { $ne: false } }).limit(1000).lean() : baseImagingReports,
    invoiceIds.length ? Payment.find({ invoice_id: { $in: invoiceIds } }).limit(1000).lean() : basePayments,
    invoiceIds.length ? Receipt.find({ invoice_id: { $in: invoiceIds } }).limit(1000).lean() : baseReceipts,
  ]);

  const patientIds = uniqueIds([
    ...idsFrom(appointments, ['patient_id']),
    ...idsFrom(queueTickets, ['patient_id']),
    ...idsFrom(encounters, ['patient_id']),
  ]);
  const doctorIds = uniqueIds([
    ...idsFrom(appointments, ['doctor_id']),
    ...idsFrom(queueTickets, ['doctor_id']),
    ...idsFrom(encounters, ['attending_doctor_id']),
  ]);
  const departmentIds = uniqueIds([
    ...idsFrom(appointments, ['department_id']),
    ...idsFrom(queueTickets, ['department_id']),
    ...idsFrom(encounters, ['department_id']),
  ]);
  const [patients, doctors, departments] = await Promise.all([
    patientIds.length ? Patient.find({ _id: { $in: patientIds } }).select('patient_code full_name date_of_birth gender phone status').lean() : [],
    doctorIds.length ? User.find({ _id: { $in: doctorIds } }).select('full_name employee_code username department_id').lean() : [],
    departmentIds.length ? Department.find({ _id: { $in: departmentIds } }).select('department_name department_code department_type').lean() : [],
  ]);

  return {
    date,
    appointments,
    queueTickets,
    encounters,
    orders,
    notes,
    diagnoses,
    labOrders,
    labResults: resolvedLabResults,
    imagingOrders,
    imagingReports: resolvedImagingReports,
    procedureOrders,
    procedureResults,
    prescriptions,
    dispenses,
    charges,
    invoices,
    payments: resolvedPayments,
    receipts: resolvedReceipts,
    records,
    maps: {
      patients: byId(patients),
      doctors: byId(doctors),
      departments: byId(departments),
    },
  };
}

function buildPatientFlowItems(bundle) {
  const appointmentsById = byId(bundle.appointments);
  const queuesByAppointmentId = new Map(bundle.queueTickets.filter((item) => item.appointment_id).map((item) => [toId(item.appointment_id), item]));
  const encountersByAppointmentId = new Map(bundle.encounters.filter((item) => item.appointment_id).map((item) => [toId(item.appointment_id), item]));
  const encountersById = byId(bundle.encounters);
  const flowKeys = new Map();

  bundle.appointments.forEach((appointment) => {
    flowKeys.set(`appointment:${toId(appointment._id)}`, { appointment });
  });
  bundle.queueTickets.forEach((queueTicket) => {
    const key = queueTicket.appointment_id ? `appointment:${toId(queueTicket.appointment_id)}` : `queue:${toId(queueTicket._id)}`;
    flowKeys.set(key, { ...(flowKeys.get(key) || {}), queueTicket, appointment: appointmentsById.get(toId(queueTicket.appointment_id)) || flowKeys.get(key)?.appointment });
  });
  bundle.encounters.forEach((encounter) => {
    const key = encounter.appointment_id ? `appointment:${toId(encounter.appointment_id)}` : `encounter:${toId(encounter._id)}`;
    flowKeys.set(key, { ...(flowKeys.get(key) || {}), encounter, appointment: appointmentsById.get(toId(encounter.appointment_id)) || flowKeys.get(key)?.appointment });
  });

  return [...flowKeys.values()].map(({ appointment, queueTicket, encounter }) => {
    const resolvedEncounter = encounter || encountersByAppointmentId.get(toId(appointment?._id)) || encountersById.get(toId(queueTicket?.encounter_id));
    const resolvedQueue = queueTicket || queuesByAppointmentId.get(toId(appointment?._id));
    const patientId = toId(appointment?.patient_id || resolvedQueue?.patient_id || resolvedEncounter?.patient_id);
    const doctorId = toId(appointment?.doctor_id || resolvedQueue?.doctor_id || resolvedEncounter?.attending_doctor_id);
    const departmentId = toId(appointment?.department_id || resolvedQueue?.department_id || resolvedEncounter?.department_id);
    const patient = bundle.maps.patients.get(patientId);
    const doctor = bundle.maps.doctors.get(doctorId);
    const department = bundle.maps.departments.get(departmentId);
    const encounterId = toId(resolvedEncounter?._id);
    const invoiceIdsForEncounter = new Set(bundle.invoices.filter((item) => toId(item.encounter_id) === encounterId).map((item) => toId(item._id)));
    const prescriptions = bundle.prescriptions.filter((item) => toId(item.encounter_id) === encounterId);
    const prescriptionIds = new Set(prescriptions.map((item) => toId(item._id)));
    const parts = {
      patient,
      appointment,
      queueTicket: resolvedQueue,
      encounter: resolvedEncounter,
      notes: bundle.notes.filter((item) => toId(item.encounter_id) === encounterId),
      diagnoses: bundle.diagnoses.filter((item) => toId(item.encounter_id) === encounterId),
      orders: bundle.orders.filter((item) => toId(item.encounter_id) === encounterId),
      labOrders: bundle.labOrders.filter((item) => toId(item.encounter_id) === encounterId),
      labResults: bundle.labResults.filter((item) => bundle.labOrders.some((order) => toId(order.encounter_id) === encounterId && toId(order._id) === toId(item.lab_order_id))),
      imagingOrders: bundle.imagingOrders.filter((item) => toId(item.encounter_id) === encounterId),
      imagingReports: bundle.imagingReports.filter((item) => bundle.imagingOrders.some((order) => toId(order.encounter_id) === encounterId && toId(order._id) === toId(item.imaging_order_id))),
      procedureOrders: bundle.procedureOrders.filter((item) => toId(item.encounter_id) === encounterId),
      procedureResults: bundle.procedureResults.filter((item) => toId(item.encounter_id) === encounterId),
      prescriptions,
      dispenses: bundle.dispenses.filter((item) => toId(item.encounter_id) === encounterId || prescriptionIds.has(toId(item.prescription_id))),
      charges: bundle.charges.filter((item) => toId(item.encounter_id) === encounterId),
      invoices: bundle.invoices.filter((item) => toId(item.encounter_id) === encounterId),
      payments: bundle.payments.filter((item) => invoiceIdsForEncounter.has(toId(item.invoice_id))),
      receipts: bundle.receipts.filter((item) => invoiceIdsForEncounter.has(toId(item.invoice_id))),
      records: bundle.records.filter((item) => toId(item.encounter_id) === encounterId),
    };
    const diagnostics = diagnosticCounts(parts);
    const ordersSummary = summarizeOrderState(parts.orders);
    const pharmacy = summarizePharmacyState(parts);
    const billing = summarizeBillingState(parts);
    const record = summarizeRecordState(parts.records);
    const currentStage = inferFlowStage({ ...parts, diagnostics, pharmacy, billing, record });
    const waitingMinutes = resolvedQueue ? queueWaitMinutesFlow(resolvedQueue) : 0;
    const riskTags = [
      resolvedQueue?.sla_breached_at ? 'Quá SLA' : '',
      waitingMinutes >= 30 ? 'Chờ lâu' : '',
      diagnostics.critical_results > 0 ? 'Critical result' : '',
      billing.balance_due > 0 ? 'Chưa thanh toán' : '',
      currentStage === 'exceptions' ? 'Ngoại lệ' : '',
    ].filter(Boolean);

    return {
      flow_id: toId(appointment?._id || resolvedQueue?._id || resolvedEncounter?._id),
      date: bundle.date,
      patient_id: patientId,
      patient_name: patientLabel(patient),
      patient_code: patient?.patient_code || '—',
      patient_meta: [patient?.gender, patient?.status].filter(Boolean).join(' · '),
      appointment_id: toId(appointment?._id),
      appointment_time: appointment?.appointment_time || resolvedEncounter?.start_time || resolvedQueue?.checkin_time,
      appointment_status: appointment?.status,
      appointment_source: appointment?.source || '',
      queue_ticket_id: toId(resolvedQueue?._id),
      queue_number: resolvedQueue?.display_number || resolvedQueue?.queue_number || '',
      queue_status: resolvedQueue?.status,
      nursing_stage: resolvedQueue?.nursing_stage || resolvedEncounter?.nursing_status || 'not_started',
      encounter_id: encounterId,
      encounter_code: resolvedEncounter?.encounter_code || '',
      encounter_status: resolvedEncounter?.status || '',
      doctor_id: doctorId,
      doctor_name: doctorLabel(doctor),
      department_id: departmentId,
      department_name: departmentLabel(department),
      current_stage: currentStage,
      waiting_minutes: waitingMinutes,
      service_minutes: serviceMinutesFlow(resolvedQueue, resolvedEncounter),
      sla_status: resolvedQueue?.sla_breached_at || waitingMinutes >= 60 ? 'breached' : waitingMinutes >= 30 ? 'warning' : 'normal',
      risk_tags: riskTags,
      orders_summary: ordersSummary,
      diagnostic_summary: diagnostics,
      pharmacy_summary: pharmacy,
      billing_summary: billing,
      record_summary: record,
      workflow_steps: buildWorkflowSteps({ ...parts, diagnostics, pharmacy, billing, record }, currentStage),
      related: {
        lab_order_ids: parts.labOrders.map((item) => toId(item._id)),
        imaging_order_ids: parts.imagingOrders.map((item) => toId(item._id)),
        procedure_order_ids: parts.procedureOrders.map((item) => toId(item._id)),
        prescription_ids: parts.prescriptions.map((item) => toId(item._id)),
        invoice_ids: parts.invoices.map((item) => toId(item._id)),
        payment_ids: parts.payments.map((item) => toId(item._id)),
        receipt_ids: parts.receipts.map((item) => toId(item._id)),
      },
    };
  }).sort((left, right) => {
    const leftRisk = left.current_stage === 'exceptions' ? 2 : left.sla_status === 'breached' ? 1 : 0;
    const rightRisk = right.current_stage === 'exceptions' ? 2 : right.sla_status === 'breached' ? 1 : 0;
    if (rightRisk !== leftRisk) return rightRisk - leftRisk;
    return new Date(left.appointment_time || 0) - new Date(right.appointment_time || 0);
  });
}

async function getPatientFlowData(query = {}) {
  const bundle = await loadPatientFlowBundle(query);
  const items = buildPatientFlowItems(bundle);
  const alerts = buildFlowAlerts(items);
  return {
    date: bundle.date,
    items,
    columns: groupFlowColumns(items),
    summary: summarizePatientFlow(items),
    alerts,
    workflow_steps: PATIENT_FLOW_STEP_DEFINITIONS,
    data_source: 'database',
  };
}

async function getPatientFlowToday(query = {}) {
  return getPatientFlowData(query);
}

async function getPatientFlowCheckInMonitor(query = {}) {
  const data = await getPatientFlowData(query);
  return {
    ...data,
    items: data.items.filter((item) => ['scheduled', 'confirmed', 'checked_in', 'exceptions'].includes(item.current_stage)),
  };
}

async function getPatientFlowWaiting(query = {}) {
  const data = await getPatientFlowData(query);
  return {
    ...data,
    items: data.items.filter((item) => ['checked_in', 'waiting_nurse', 'ready_for_doctor', 'called', 'exceptions'].includes(item.current_stage)),
  };
}

async function getPatientFlowInConsultation(query = {}) {
  const data = await getPatientFlowData(query);
  return {
    ...data,
    items: data.items.filter((item) => ['in_consultation', 'orders_active', 'payment_pending', 'results_pending'].includes(item.current_stage)),
  };
}

async function getPatientFlowNeedsAction(query = {}) {
  const data = await getPatientFlowData(query);
  return {
    date: data.date,
    items: data.alerts,
    alerts: data.alerts,
    summary: {
      total: data.alerts.length,
      critical: data.alerts.filter((item) => item.severity === 'critical').length,
      high: data.alerts.filter((item) => item.severity === 'high').length,
      medium: data.alerts.filter((item) => item.severity === 'medium').length,
    },
    data_source: 'database',
  };
}

async function getPatientFlowCompleted(query = {}) {
  const data = await getPatientFlowData(query);
  return {
    ...data,
    items: data.items.filter((item) => ['completed', 'finalized', 'exceptions'].includes(item.current_stage)),
  };
}

async function getPatientFlowContext(flowId, query = {}) {
  const data = await getPatientFlowData(query);
  const item = data.items.find((row) => row.flow_id === flowId || row.appointment_id === flowId || row.queue_ticket_id === flowId || row.encounter_id === flowId);
  if (!item) throw ApiError.notFound('Không tìm thấy patient flow context.');
  return { flow: item };
}

async function acknowledgePatientFlowAlert(alertId, payload = {}, auth = {}, requestMeta = {}) {
  await recordOpsAudit(auth, 'operations.patient_flow.alert_acknowledge', 'patient_flow_alert', alertId, {
    alert_id: alertId,
    note: payload.note,
  }, requestMeta);
  return {
    alert_id: alertId,
    status: 'acknowledged',
    acknowledged_at: now().toISOString(),
  };
}

function operationRange(query = {}) {
  const date = operationDate(query);
  return {
    date,
    start: startOfDay(query.date || date),
    end: endOfDay(query.date || date),
  };
}

function activeQueueStatus(status) {
  return ['waiting', 'called', 'recalled', 'skipped', 'in_service'].includes(String(status || ''));
}

function normalizeOperationQueueTicket(item = {}) {
  const ticket = item.queue_ticket || item;
  const waitingMinutes = safeNumber(ticket.waiting_minutes || queueWaitMinutes(ticket));
  return {
    ...ticket,
    id: toId(ticket.queue_ticket_id || ticket._id || ticket.id),
    queue_ticket_id: toId(ticket.queue_ticket_id || ticket._id || ticket.id),
    display_number: ticket.display_number || ticket.queue_number,
    waiting_minutes: waitingMinutes,
    wait_minutes: waitingMinutes,
    service_minutes: ticket.service_start_time ? queueWaitMinutes({ checkin_time: ticket.service_start_time }) : 0,
    sla_status: ticket.sla_breached_at || waitingMinutes >= 60 ? 'breached' : waitingMinutes >= 30 ? 'warning' : 'normal',
    risk_tags: [
      ticket.queue_type === 'vip' ? 'VIP' : '',
      ticket.queue_type === 'priority' ? 'Ưu tiên' : '',
      waitingMinutes >= 30 ? 'Chờ lâu' : '',
      ticket.status === 'skipped' ? 'Missed call' : '',
      ticket.status === 'no_show' ? 'No-show' : '',
    ].filter(Boolean),
  };
}

function queueBoardSummary(items = []) {
  const waitingItems = items.filter((item) => item.status === 'waiting');
  return {
    total: items.length,
    waiting: waitingItems.length,
    called: items.filter((item) => ['called', 'recalled'].includes(item.status)).length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    in_service: items.filter((item) => item.status === 'in_service').length,
    completed: items.filter((item) => item.status === 'completed').length,
    cancelled: items.filter((item) => item.status === 'cancelled').length,
    no_show: items.filter((item) => item.status === 'no_show').length,
    sla_breached: items.filter((item) => item.sla_status === 'breached').length,
    avg_waiting_minutes: waitingItems.length
      ? Math.round(waitingItems.reduce((sum, item) => sum + safeNumber(item.waiting_minutes), 0) / waitingItems.length)
      : 0,
    max_waiting_minutes: waitingItems.reduce((max, item) => Math.max(max, safeNumber(item.waiting_minutes)), 0),
  };
}

function queueBoardLanes(items = []) {
  return {
    waiting: items.filter((item) => item.status === 'waiting'),
    called: items.filter((item) => ['called', 'recalled'].includes(item.status)),
    skipped: items.filter((item) => item.status === 'skipped'),
    in_service: items.filter((item) => item.status === 'in_service'),
    completed: items.filter((item) => item.status === 'completed'),
    no_show: items.filter((item) => ['no_show', 'cancelled'].includes(item.status)),
  };
}

async function getOperationQueueItems(query = {}, actor = {}) {
  const { date } = operationRange(query);
  const result = await queueService.listQueueTickets({
    date,
    limit: query.limit || 500,
    page: query.page || 1,
    status: query.status,
    department_id: query.department_id,
    doctor_id: query.doctor_id,
  }, actor);
  return {
    date,
    items: (result.items || []).map(normalizeOperationQueueTicket),
    pagination: result.pagination,
  };
}

async function getOperationsQueueBoard(query = {}, actor = {}) {
  const data = await getOperationQueueItems(query, actor);
  return {
    date: data.date,
    items: data.items,
    lanes: queueBoardLanes(data.items),
    summary: queueBoardSummary(data.items),
    pagination: data.pagination,
    data_source: 'database',
  };
}

async function getOperationsQueueCurrent(query = {}, actor = {}) {
  const board = await getOperationsQueueBoard(query, actor);
  const items = board.items.filter((item) => activeQueueStatus(item.status));
  return {
    ...board,
    items,
    lanes: queueBoardLanes(items),
    summary: queueBoardSummary(items),
  };
}

async function getOperationsQueueToday(query = {}, actor = {}) {
  return getOperationsQueueBoard(query, actor);
}

async function getOperationsQueueCallConsole(query = {}, actor = {}) {
  const board = await getOperationsQueueCurrent(query, actor);
  const waiting = board.items
    .filter((item) => item.status === 'waiting')
    .sort((left, right) => {
      const priority = { vip: 0, priority: 1, normal: 2 };
      return (priority[left.queue_type] ?? 2) - (priority[right.queue_type] ?? 2)
        || safeNumber(right.waiting_minutes) - safeNumber(left.waiting_minutes);
    });
  return {
    ...board,
    current_called: board.items.find((item) => ['called', 'recalled'].includes(item.status)) || null,
    current_in_service: board.items.find((item) => item.status === 'in_service') || null,
    next_candidates: waiting.slice(0, 20),
    missed: board.items.filter((item) => item.status === 'skipped'),
  };
}

async function getOperationsQueueTransferCandidates(query = {}, actor = {}) {
  const board = await getOperationsQueueCurrent(query, actor);
  const [departments, doctors] = await Promise.all([
    Department.find({ is_deleted: false, status: { $ne: 'inactive' } }).sort({ department_name: 1 }).limit(300).lean(),
    User.find({ is_deleted: false, status: 'active' }).sort({ full_name: 1 }).limit(500).lean(),
  ]);
  return {
    date: board.date,
    items: board.items.filter((item) => ['waiting', 'called', 'recalled', 'skipped'].includes(item.status)),
    departments: departments.map((item) => serialize(item)),
    doctors: doctors.map((item) => serialize(item)),
    data_source: 'database',
  };
}

async function getOperationsQueueMissedNoShow(query = {}, actor = {}) {
  const board = await getOperationsQueueBoard(query, actor);
  const items = board.items.filter((item) => (
    ['skipped', 'no_show', 'cancelled'].includes(item.status)
    || (['called', 'recalled'].includes(item.status) && safeNumber(item.waiting_minutes) >= 10)
  ));
  return {
    date: board.date,
    items,
    summary: queueBoardSummary(items),
    data_source: 'database',
  };
}

async function getOperationsQueueTicketContext(ticketId, query = {}, actor = {}) {
  const [detail, timeline] = await Promise.all([
    queueService.getQueueTicketDetail(ticketId, actor),
    queueService.getQueueTimeline(ticketId, { limit: query.limit || 100 }, actor).catch(() => ({ items: [] })),
  ]);
  return {
    ticket: normalizeOperationQueueTicket(detail.queue_ticket || detail),
    timeline: timeline.items || [],
    data_source: 'database',
  };
}

async function getOperationsQueueAvailableActions(ticketId, query = {}, actor = {}) {
  const context = await getOperationsQueueTicketContext(ticketId, query, actor);
  const status = context.ticket.status;
  const actions = [
    ['call', ['waiting', 'skipped'].includes(status)],
    ['recall', ['called', 'recalled', 'skipped'].includes(status)],
    ['skip', ['called', 'recalled'].includes(status)],
    ['start_service', ['called', 'recalled'].includes(status)],
    ['complete', status === 'in_service'],
    ['mark_no_show', ['waiting', 'called', 'recalled', 'skipped'].includes(status)],
    ['transfer', ['waiting', 'called', 'recalled', 'skipped'].includes(status)],
  ].map(([action, enabled]) => ({ action, enabled }));
  return {
    ticket_id: ticketId,
    status,
    actions,
    data_source: 'database',
  };
}

function sumSlotStats(schedules = []) {
  return schedules.reduce((result, item) => {
    const stats = item.slots_summary || {};
    result.total += safeNumber(stats.total_slots);
    result.booked += safeNumber(stats.booked_slots);
    result.available += safeNumber(stats.available_slots);
    result.blocked += safeNumber(stats.blocked_slots);
    return result;
  }, { total: 0, booked: 0, available: 0, blocked: 0 });
}

function loadScoreFrom({ utilization = 0, queueWaiting = 0, queueLong = 0 }) {
  return Math.min(100, Math.max(safeNumber(utilization), safeNumber(queueWaiting) * 4, safeNumber(queueLong) * 12));
}

function loadLevelFrom(score) {
  if (score >= 90) return 'critical';
  if (score >= 75) return 'high';
  if (score <= 40) return 'low';
  return 'normal';
}

function formatOperationSlot(slot = {}, maps = {}) {
  const doctor = maps.doctors?.get(toId(slot.doctor_id)) || {};
  const department = maps.departments?.get(toId(slot.department_id)) || {};
  const schedule = maps.schedules?.get(toId(slot.doctor_schedule_id)) || {};
  const patient = maps.patients?.get(toId(slot.patient_id)) || {};
  return {
    slot_id: toId(slot._id),
    schedule_slot_id: toId(slot._id),
    schedule_id: toId(slot.doctor_schedule_id),
    doctor_schedule_id: toId(slot.doctor_schedule_id),
    doctor_id: toId(slot.doctor_id),
    doctor_name: doctor.full_name || doctor.name || doctor.username || schedule.doctor_name || null,
    department_id: toId(slot.department_id),
    department_name: department.department_name || department.name || schedule.department_name || null,
    start_time: slot.start_time,
    end_time: slot.end_time,
    slot_number: slot.slot_number,
    status: slot.status,
    capacity: safeNumber(slot.capacity || 1),
    booked_count: safeNumber(slot.booked_count),
    appointment_id: toId(slot.appointment_id),
    patient_id: toId(slot.patient_id),
    patient_name: patient.full_name || null,
    patient_code: patient.patient_code || null,
    hold_expires_at: slot.hold_expires_at,
    block_reason: slot.block_reason,
    schedule_type: schedule.schedule_type || null,
    work_date: schedule.work_date || null,
    data_source: 'database',
  };
}

async function loadResourceBundle(query = {}, actor = {}) {
  const { date, start, end } = operationRange(query);
  const summary = await scheduleService.getSchedulingSystemSummary({
    date_from: date,
    date_to: date,
    department_id: query.department_id,
    doctor_id: query.doctor_id,
  }, actor);
  const scheduleItems = summary.items || [];
  const scheduleIds = uniqueIds(scheduleItems.map((item) => item.doctor_schedule_id));
  const appointmentRead = appointmentService.listAppointments({
    date,
    limit: query.limit || 1000,
    department_id: query.department_id,
    doctor_id: query.doctor_id,
  }, actor);
  const queueRead = queueService.listQueueTickets({
    date,
    limit: query.limit || 1000,
    department_id: query.department_id,
    doctor_id: query.doctor_id,
  }, actor);
  const slotFilter = {
    is_deleted: false,
    start_time: { $gte: start, $lte: end },
  };
  if (query.department_id) slotFilter.department_id = query.department_id;
  if (query.doctor_id) slotFilter.doctor_id = query.doctor_id;
  if (scheduleIds.length) slotFilter.doctor_schedule_id = { $in: scheduleIds };

  const [appointmentsResult, queueResult, slots] = await Promise.all([
    appointmentRead,
    queueRead,
    ScheduleSlot.find(slotFilter).sort({ start_time: 1, slot_number: 1 }).limit(1500).lean(),
  ]);
  const appointments = appointmentsResult.items || [];
  const queueTickets = (queueResult.items || []).map(normalizeOperationQueueTicket);
  const departmentIds = uniqueIds([
    ...scheduleItems.map((item) => item.department_id),
    ...appointments.map((item) => item.department_id),
    ...queueTickets.map((item) => item.department_id),
    ...slots.map((item) => item.department_id),
  ]);
  const doctorIds = uniqueIds([
    ...scheduleItems.map((item) => item.doctor_id),
    ...appointments.map((item) => item.doctor_id),
    ...queueTickets.map((item) => item.doctor_id),
    ...slots.map((item) => item.doctor_id),
  ]);
  const patientIds = uniqueIds(slots.map((item) => item.patient_id));

  const [departments, doctors, profiles, rooms, locations, imagingRooms, patients] = await Promise.all([
    Department.find({
      is_deleted: false,
      ...(departmentIds.length ? { _id: { $in: departmentIds } } : { status: { $ne: 'inactive' } }),
    }).sort({ department_name: 1 }).limit(300).lean(),
    User.find({
      is_deleted: false,
      ...(doctorIds.length ? { _id: { $in: doctorIds } } : { status: 'active' }),
    }).select('full_name username employee_code department_id status avatar_url').sort({ full_name: 1 }).limit(500).lean(),
    DoctorProfile.find({
      is_deleted: false,
      ...(doctorIds.length ? { user_id: { $in: doctorIds } } : {}),
    }).limit(500).lean(),
    Room.find({
      is_deleted: false,
      ...(departmentIds.length ? { department_id: { $in: departmentIds } } : {}),
    }).limit(500).lean(),
    FacilityLocation.find({
      is_deleted: false,
      ...(departmentIds.length ? { department_id: { $in: departmentIds } } : {}),
    }).limit(500).lean(),
    ImagingRoom.find({}).limit(300).lean(),
    patientIds.length ? Patient.find({ _id: { $in: patientIds }, is_deleted: false }).select('patient_code full_name').lean() : [],
  ]);

  return {
    date,
    start,
    end,
    summary,
    schedules: scheduleItems,
    appointments,
    queueTickets,
    slots,
    rooms,
    locations,
    imagingRooms,
    profiles,
    maps: {
      departments: byId(departments),
      doctors: byId(doctors),
      profilesByUser: new Map(profiles.map((item) => [toId(item.user_id), item])),
      schedules: new Map(scheduleItems.map((item) => [toId(item.doctor_schedule_id), item])),
      patients: byId(patients),
    },
    departments,
    doctors,
  };
}

function resourceDepartmentRows(bundle) {
  const rows = bundle.departments.map((department) => {
    const id = toId(department._id);
    const schedules = bundle.schedules.filter((item) => toId(item.department_id) === id);
    const slots = sumSlotStats(schedules);
    const appointments = bundle.appointments.filter((item) => toId(item.department_id) === id);
    const queues = bundle.queueTickets.filter((item) => toId(item.department_id) === id);
    const queueWaiting = queues.filter((item) => item.status === 'waiting').length;
    const queueLong = queues.filter((item) => safeNumber(item.waiting_minutes) >= 30).length;
    const utilization = slots.total ? Math.round((slots.booked / slots.total) * 100) : 0;
    const score = loadScoreFrom({ utilization, queueWaiting, queueLong });
    const alerts = [
      schedules.some((item) => !['active', 'published'].includes(item.status)) ? { type: 'unpublished_schedule', title: 'Có lịch chưa publish' } : null,
      utilization >= 90 ? { type: 'slot_full', title: 'Slot gần kín' } : null,
      queueLong > 0 ? { type: 'queue_wait_long', title: `${queueLong} queue chờ lâu` } : null,
    ].filter(Boolean);
    return {
      department_id: id,
      id,
      department_name: department.department_name,
      department_code: department.department_code,
      department_type: department.department_type,
      status: department.status,
      today: {
        schedules_count: schedules.length,
        published_schedules: schedules.filter((item) => ['active', 'published'].includes(item.status)).length,
        unpublished_schedules: schedules.filter((item) => !['active', 'published'].includes(item.status)).length,
        appointments_count: appointments.length,
        queue_waiting: queueWaiting,
        queue_in_service: queues.filter((item) => item.status === 'in_service').length,
        queue_completed: queues.filter((item) => item.status === 'completed').length,
      },
      slots: {
        total: slots.total,
        booked: slots.booked,
        available: slots.available,
        blocked: slots.blocked,
        utilization_rate: utilization,
      },
      staff: {
        doctors_count: uniqueIds(schedules.map((item) => item.doctor_id)).length
          || bundle.profiles.filter((item) => toId(item.department_id) === id).length,
      },
      rooms_active: bundle.rooms.filter((item) => toId(item.department_id) === id && item.status !== 'inactive').length
        + bundle.locations.filter((item) => toId(item.department_id) === id && item.status !== 'inactive').length,
      queue_long: queueLong,
      load: { score, level: loadLevelFrom(score) },
      alerts,
      data_source: 'database',
    };
  });
  return rows;
}

function resourceDoctorRows(bundle) {
  const ids = uniqueIds([
    ...bundle.profiles.map((item) => item.user_id),
    ...bundle.schedules.map((item) => item.doctor_id),
    ...bundle.appointments.map((item) => item.doctor_id),
    ...bundle.queueTickets.map((item) => item.doctor_id),
  ]);
  return ids.map((id) => {
    const doctor = bundle.maps.doctors.get(id) || {};
    const profile = bundle.maps.profilesByUser.get(id) || {};
    const department = bundle.maps.departments.get(toId(profile.department_id || doctor.department_id)) || {};
    const schedules = bundle.schedules.filter((item) => toId(item.doctor_id) === id);
    const slots = sumSlotStats(schedules);
    const appointments = bundle.appointments.filter((item) => toId(item.doctor_id) === id);
    const queues = bundle.queueTickets.filter((item) => toId(item.doctor_id) === id);
    const queueWaiting = queues.filter((item) => item.status === 'waiting').length;
    const queueLong = queues.filter((item) => safeNumber(item.waiting_minutes) >= 30).length;
    const utilization = slots.total ? Math.round((slots.booked / slots.total) * 100) : 0;
    const score = loadScoreFrom({ utilization, queueWaiting, queueLong });
    const hourlyLoad = {};
    bundle.slots
      .filter((slot) => toId(slot.doctor_id) === id)
      .forEach((slot) => {
        const hour = new Date(slot.start_time).getHours();
        const key = `${String(hour).padStart(2, '0')}:00`;
        const current = hourlyLoad[key] || { booked: 0, total: 0 };
        current.booked += safeNumber(slot.booked_count);
        current.total += safeNumber(slot.capacity || 1);
        hourlyLoad[key] = current;
      });
    Object.keys(hourlyLoad).forEach((key) => {
      hourlyLoad[key] = hourlyLoad[key].total ? Math.round((hourlyLoad[key].booked / hourlyLoad[key].total) * 100) : 0;
    });
    const alerts = [
      utilization >= 90 ? { type: 'doctor_full', title: 'Kín slot' } : null,
      queueLong > 0 ? { type: 'queue_wait_long', title: 'Queue chờ lâu' } : null,
    ].filter(Boolean);
    return {
      doctor_id: id,
      id,
      full_name: doctor.full_name || doctor.username || 'Chưa rõ bác sĩ',
      employee_code: doctor.employee_code,
      department_id: toId(profile.department_id || doctor.department_id),
      department_name: department.department_name,
      specialty: profile.specialty,
      qualification: profile.qualification,
      avatar_url: profile.avatar_url || doctor.avatar_url,
      status: profile.status || doctor.status,
      today: {
        schedules_count: schedules.length,
        appointments_count: appointments.length,
        queue_waiting: queueWaiting,
        queue_in_service: queues.filter((item) => item.status === 'in_service').length,
        no_show_count: appointments.filter((item) => item.status === 'no_show').length + queues.filter((item) => item.status === 'no_show').length,
      },
      slots: {
        total: slots.total,
        booked: slots.booked,
        available: slots.available,
        blocked: slots.blocked,
        utilization_rate: utilization,
      },
      queue: {
        max_wait_minutes: queues.reduce((max, item) => Math.max(max, safeNumber(item.waiting_minutes)), 0),
      },
      hourly_load: hourlyLoad,
      load: { score, level: loadLevelFrom(score) },
      alerts,
      data_source: 'database',
    };
  });
}

function resourceRoomRows(bundle) {
  const roomRows = bundle.rooms.map((room) => {
    const department = bundle.maps.departments.get(toId(room.department_id)) || {};
    const queues = bundle.queueTickets.filter((item) => toId(item.department_id) === toId(room.department_id));
    return {
      room_id: toId(room._id),
      id: toId(room._id),
      resource_type: room.room_type || 'clinic_room',
      room_name: room.room_name,
      room_code: room.room_code,
      department_id: toId(room.department_id),
      department_name: department.department_name,
      building: room.building,
      floor: room.floor,
      capacity: room.capacity || 1,
      status: room.status === 'active' ? (queues.some((item) => item.status === 'in_service') ? 'in_use' : 'available') : room.status,
      queue_waiting: queues.filter((item) => item.status === 'waiting').length,
      appointments_left: bundle.appointments.filter((item) => toId(item.department_id) === toId(room.department_id) && ['booked', 'confirmed', 'checked_in'].includes(item.status)).length,
      next_free_at: queues.some((item) => item.status === 'in_service') ? null : 'Sẵn sàng',
      alerts: room.status !== 'active' ? [{ type: 'room_status', title: room.status }] : [],
      data_source: 'database',
    };
  });
  const locationRows = bundle.locations.map((location) => {
    const department = bundle.maps.departments.get(toId(location.department_id)) || {};
    return {
      room_id: toId(location._id),
      id: toId(location._id),
      resource_type: location.type || 'location',
      room_name: location.name,
      room_code: location.metadata?.code || location.type || 'LOC',
      department_id: toId(location.department_id),
      department_name: department.department_name,
      building: location.address,
      floor: location.metadata?.floor,
      capacity: safeNumber(location.metadata?.capacity || 1),
      status: location.status === 'active' ? 'available' : location.status,
      queue_waiting: 0,
      appointments_left: 0,
      next_free_at: 'Sẵn sàng',
      alerts: [],
      data_source: 'database',
    };
  });
  const imagingRows = bundle.imagingRooms.map((room) => ({
    room_id: toId(room._id),
    id: toId(room._id),
    resource_type: room.modality || 'imaging_room',
    room_name: room.name,
    room_code: room.code,
    department_name: 'Chẩn đoán hình ảnh',
    building: '',
    floor: room.metadata?.floor,
    capacity: 1,
    status: room.active === false ? 'inactive' : room.maintenance_status === 'maintenance' ? 'maintenance' : 'available',
    queue_waiting: 0,
    appointments_left: 0,
    next_free_at: room.maintenance_status === 'maintenance' ? null : 'Sẵn sàng',
    alerts: room.maintenance_status === 'maintenance' ? [{ type: 'maintenance', title: 'Bảo trì' }] : [],
    data_source: 'database',
  }));
  return [...roomRows, ...locationRows, ...imagingRows];
}

function operationsAttentionFromResources({ departments, doctors, rooms }) {
  return [
    ...departments
      .filter((item) => ['high', 'critical'].includes(item.load.level) || item.alerts.length)
      .map((item) => ({
        id: `department-${item.department_id}`,
        type: 'department',
        resource_type: 'department',
        severity: item.load.level === 'critical' ? 'critical' : 'high',
        title: `${item.department_name} cần chú ý`,
        message: `Utilization ${item.slots.utilization_rate}% · Queue chờ ${item.today.queue_waiting}.`,
        department_id: item.department_id,
        department_name: item.department_name,
        affected_count: item.today.queue_waiting || item.today.appointments_count,
        suggested_actions: [{ label: 'Điều phối tải' }],
        data_source: 'database',
      })),
    ...doctors
      .filter((item) => ['high', 'critical'].includes(item.load.level) || item.today.queue_waiting >= 8)
      .map((item) => ({
        id: `doctor-${item.doctor_id}`,
        type: 'doctor',
        resource_type: 'doctor',
        severity: item.load.level === 'critical' ? 'critical' : 'high',
        title: `${item.full_name} quá tải`,
        message: `Slot ${item.slots.utilization_rate}% · Queue chờ ${item.today.queue_waiting}.`,
        doctor_id: item.doctor_id,
        doctor_name: item.full_name,
        department_id: item.department_id,
        department_name: item.department_name,
        affected_count: item.today.queue_waiting || item.today.appointments_count,
        suggested_actions: [{ label: 'Cân bằng tải' }],
        data_source: 'database',
      })),
    ...rooms
      .filter((item) => ['maintenance', 'inactive'].includes(item.status) || item.queue_waiting >= 8 || item.alerts.length)
      .map((item) => ({
        id: `room-${item.room_id}`,
        type: 'room',
        resource_type: 'room',
        severity: item.status === 'maintenance' ? 'high' : 'warning',
        title: `${item.room_name} cần kiểm tra`,
        message: `${item.status} · Queue chờ ${item.queue_waiting}.`,
        department_id: item.department_id,
        department_name: item.department_name,
        affected_count: item.queue_waiting || 1,
        suggested_actions: [{ label: 'Kiểm tra phòng' }],
        data_source: 'database',
      })),
  ];
}

async function getOperationsResourcesLoad(query = {}, actor = {}) {
  const bundle = await loadResourceBundle(query, actor);
  const departments = resourceDepartmentRows(bundle);
  const doctors = resourceDoctorRows(bundle);
  const rooms = resourceRoomRows(bundle);
  return {
    date: bundle.date,
    departments,
    doctors,
    rooms,
    attention: operationsAttentionFromResources({ departments, doctors, rooms }),
    data_source: 'database',
  };
}

async function getOperationsResourceDepartments(query = {}, actor = {}) {
  const resources = await getOperationsResourcesLoad(query, actor);
  return { date: resources.date, items: resources.departments, data_source: 'database' };
}

async function getOperationsResourceDoctors(query = {}, actor = {}) {
  const resources = await getOperationsResourcesLoad(query, actor);
  return { date: resources.date, items: resources.doctors, data_source: 'database' };
}

async function getOperationsResourceRooms(query = {}, actor = {}) {
  const resources = await getOperationsResourcesLoad(query, actor);
  return { date: resources.date, items: resources.rooms, data_source: 'database' };
}

async function getOperationsDoctorLoad(query = {}, actor = {}) {
  return getOperationsResourceDoctors(query, actor);
}

async function getOperationsRoomStatus(query = {}, actor = {}) {
  return getOperationsResourceRooms(query, actor);
}

async function getOperationsResourceAttention(query = {}, actor = {}) {
  const resources = await getOperationsResourcesLoad(query, actor);
  return { date: resources.date, items: resources.attention, data_source: 'database' };
}

async function getOperationsSlotsCapacity(query = {}, actor = {}) {
  const bundle = await loadResourceBundle(query, actor);
  const items = bundle.slots.map((slot) => formatOperationSlot(slot, bundle.maps));
  const summary = {
    total_slots: items.length,
    total_capacity: items.reduce((sum, item) => sum + safeNumber(item.capacity), 0),
    booked_slots: items.reduce((sum, item) => sum + safeNumber(item.booked_count), 0),
    available_slots: items.filter((item) => item.status === 'available').length,
    blocked_slots: items.filter((item) => item.status === 'blocked').length,
    held_slots: items.filter((item) => item.status === 'held').length,
  };
  summary.utilization_rate = summary.total_capacity ? Math.round((summary.booked_slots / summary.total_capacity) * 100) : 0;
  return {
    date: bundle.date,
    items,
    summary,
    data_source: 'database',
  };
}

async function buildOperationsAlerts(query = {}, actor = {}) {
  const bundle = await loadResourceBundle(query, actor);
  const resources = {
    departments: resourceDepartmentRows(bundle),
    doctors: resourceDoctorRows(bundle),
    rooms: resourceRoomRows(bundle),
  };
  const alerts = [];

  bundle.schedules.forEach((schedule) => {
    const stats = schedule.slots_summary || {};
    if (!['active', 'published'].includes(schedule.status)) {
      alerts.push({
        id: `schedule-unpublished-${schedule.doctor_schedule_id}`,
        category: 'schedule',
        type: 'unpublished_schedule',
        severity: 'high',
        status: 'open',
        title: 'Lịch bác sĩ chưa publish',
        message: `${schedule.doctor_name || 'Bác sĩ'} ngày ${localDateKey(schedule.work_date)} chưa mở cho đặt lịch.`,
        doctor_id: schedule.doctor_id,
        doctor_name: schedule.doctor_name,
        department_id: schedule.department_id,
        department_name: schedule.department_name,
        affected_count: safeNumber(stats.total_slots || 1),
        detected_at: schedule.updated_at || schedule.created_at || now(),
        suggested_actions: [{ label: 'Publish lịch' }, { label: 'Generate slot' }],
        data_source: 'database',
      });
    }
    if (safeNumber(stats.total_slots) > 0 && safeNumber(stats.available_slots) === 0) {
      alerts.push({
        id: `schedule-full-${schedule.doctor_schedule_id}`,
        category: 'schedule',
        type: 'slot_full',
        severity: 'warning',
        status: 'open',
        title: 'Lịch đã kín slot',
        message: `${schedule.doctor_name || 'Bác sĩ'} không còn slot trống trong ca.`,
        doctor_id: schedule.doctor_id,
        doctor_name: schedule.doctor_name,
        department_id: schedule.department_id,
        department_name: schedule.department_name,
        affected_count: safeNumber(stats.booked_slots),
        detected_at: now(),
        suggested_actions: [{ label: 'Mở thêm ca' }, { label: 'Đưa vào waitlist' }],
        data_source: 'database',
      });
    }
  });

  bundle.queueTickets.forEach((ticket) => {
    if (ticket.status === 'waiting' && safeNumber(ticket.waiting_minutes) >= 30) {
      alerts.push({
        id: `queue-wait-${ticket.queue_ticket_id}`,
        category: 'queue',
        type: 'queue_wait_long',
        severity: safeNumber(ticket.waiting_minutes) >= 60 ? 'critical' : 'high',
        status: 'open',
        title: 'Queue chờ quá SLA',
        message: `${ticket.patient_name || ticket.display_number || ticket.queue_number} đã chờ ${ticket.waiting_minutes} phút.`,
        doctor_id: ticket.doctor_id,
        doctor_name: ticket.doctor_name,
        department_id: ticket.department_id,
        department_name: ticket.department_name,
        patient_id: ticket.patient_id,
        patient_name: ticket.patient_name,
        affected_count: 1,
        detected_at: ticket.checkin_time,
        sla_breached_at: safeNumber(ticket.waiting_minutes) >= 60 ? now() : null,
        suggested_actions: [{ label: 'Gọi bệnh nhân' }, { label: 'Chuyển queue' }],
        data_source: 'database',
      });
    }
    if (['skipped', 'no_show'].includes(ticket.status)) {
      alerts.push({
        id: `queue-missed-${ticket.queue_ticket_id}`,
        category: ticket.status === 'no_show' ? 'no_show' : 'queue',
        type: ticket.status === 'no_show' ? 'queue_no_show' : 'missed_call',
        severity: 'warning',
        status: 'open',
        title: ticket.status === 'no_show' ? 'Queue no-show' : 'Missed call',
        message: `${ticket.patient_name || ticket.display_number || ticket.queue_number} cần follow-up.`,
        doctor_id: ticket.doctor_id,
        doctor_name: ticket.doctor_name,
        department_id: ticket.department_id,
        department_name: ticket.department_name,
        patient_id: ticket.patient_id,
        patient_name: ticket.patient_name,
        affected_count: 1,
        detected_at: ticket.updated_at || ticket.checkin_time,
        suggested_actions: [{ label: 'Gọi lại' }, { label: 'Mark no-show' }],
        data_source: 'database',
      });
    }
  });

  bundle.appointments
    .filter((appointment) => appointment.status === 'no_show')
    .forEach((appointment) => {
      alerts.push({
        id: `appointment-no-show-${appointment.appointment_id}`,
        category: 'no_show',
        type: 'appointment_no_show',
        severity: 'warning',
        status: 'open',
        title: 'Appointment no-show',
        message: `${appointment.patient_name || 'Bệnh nhân'} không đến lịch hẹn.`,
        doctor_id: appointment.doctor_id,
        doctor_name: appointment.doctor_name,
        department_id: appointment.department_id,
        department_name: appointment.department_name,
        patient_id: appointment.patient_id,
        patient_name: appointment.patient_name,
        affected_count: 1,
        detected_at: appointment.no_show_at || appointment.appointment_time,
        suggested_actions: [{ label: 'Gọi follow-up' }, { label: 'Đưa waitlist' }],
        data_source: 'database',
      });
    });

  operationsAttentionFromResources(resources).forEach((item) => {
    alerts.push({
      ...item,
      id: `resource-${item.id}`,
      category: item.type === 'doctor' || item.type === 'department' ? 'doctor_department' : 'resource',
      type: `${item.type}_load_attention`,
      status: 'open',
      detected_at: now(),
    });
  });

  const clinicalAlerts = await ClinicalAlert.find({
    status: { $nin: ['resolved', 'dismissed'] },
    created_at: { $gte: bundle.start, $lte: bundle.end },
  }).limit(100).lean().catch(() => []);
  clinicalAlerts.forEach((alert) => {
    alerts.push({
      id: `clinical-${toId(alert._id)}`,
      category: 'clinical',
      type: alert.alert_type || alert.source_type || 'clinical_alert',
      severity: alert.severity || 'warning',
      status: alert.status || 'open',
      title: alert.title || alert.message || 'Cảnh báo lâm sàng',
      message: alert.message || 'Cần xử lý cảnh báo lâm sàng.',
      department_id: toId(alert.department_id),
      patient_id: toId(alert.patient_id),
      affected_count: 1,
      detected_at: alert.created_at,
      data_source: 'database',
    });
  });

  return {
    date: bundle.date,
    items: alerts.sort((left, right) => {
      const rank = { critical: 0, high: 1, warning: 2, info: 3 };
      return (rank[left.severity] ?? 3) - (rank[right.severity] ?? 3)
        || new Date(right.detected_at || 0) - new Date(left.detected_at || 0);
    }),
    data_source: 'database',
  };
}

function summarizeOperationsAlerts(items = []) {
  return {
    total: items.length,
    critical: items.filter((item) => item.severity === 'critical').length,
    high: items.filter((item) => item.severity === 'high').length,
    warning: items.filter((item) => item.severity === 'warning').length,
    open: items.filter((item) => !['resolved', 'dismissed'].includes(item.status)).length,
    breached: items.filter((item) => item.sla_breached_at || item.breached_at).length,
  };
}

async function getOperationsAlerts(query = {}, actor = {}) {
  const data = await buildOperationsAlerts(query, actor);
  return { ...data, summary: summarizeOperationsAlerts(data.items) };
}

async function getOperationsAlertsSummary(query = {}, actor = {}) {
  const data = await getOperationsAlerts(query, actor);
  return data.summary;
}

async function getOperationsAlertsByCategory(category, query = {}, actor = {}) {
  const data = await getOperationsAlerts(query, actor);
  const items = data.items.filter((item) => (
    category === 'action'
      ? ['critical', 'high'].includes(item.severity)
      : item.category === category || (category === 'doctor_department' && ['doctor', 'department'].includes(item.type))
  ));
  return { ...data, items, summary: summarizeOperationsAlerts(items) };
}

async function getOperationsAlertDetail(alertId, query = {}, actor = {}) {
  const data = await getOperationsAlerts(query, actor);
  const alert = data.items.find((item) => item.id === alertId || toId(item._id) === alertId);
  if (!alert) throw ApiError.notFound('Không tìm thấy cảnh báo vận hành.');
  return { alert, data_source: 'database' };
}

async function operationAlertAction(alertId, action, payload = {}, auth = {}, requestMeta = {}) {
  await recordOpsAudit(auth, `operations.alert.${action}`, 'operation_alert', alertId, {
    alert_id: alertId,
    action,
    note: payload.note || payload.reason,
    assignee_id: payload.assignee_id,
  }, requestMeta);
  return {
    alert_id: alertId,
    status: action === 'resolve' ? 'resolved' : action === 'dismiss' ? 'dismissed' : action === 'assign' ? 'assigned' : 'acknowledged',
    action,
    updated_at: now().toISOString(),
    data_source: 'database',
  };
}

async function acknowledgeResourceAttention(attentionId, payload = {}, auth = {}, requestMeta = {}) {
  return operationAlertAction(attentionId, 'acknowledge_resource', payload, auth, requestMeta);
}

async function assignResourceAttention(attentionId, payload = {}, auth = {}, requestMeta = {}) {
  return operationAlertAction(attentionId, 'assign_resource', payload, auth, requestMeta);
}

async function resolveResourceAttention(attentionId, payload = {}, auth = {}, requestMeta = {}) {
  return operationAlertAction(attentionId, 'resolve_resource', payload, auth, requestMeta);
}

async function getHealth() {
  const [workerHealth, fileScanCounts, idempotencyCounts, qrCounts, activeMaintenance] = await Promise.all([
    workerHealthService.getWorkerHealth(),
    countByField(Attachment, 'scan_status', ['pending', 'clean', 'infected', 'failed', 'skipped'], {}),
    countByStatus(IdempotencyRecord, IDEMPOTENCY_STATUSES, {}),
    Promise.all([
      QrToken.countDocuments({ revoked_at: null, used_at: null, $or: [{ expires_at: null }, { expires_at: { $gt: now() } }] }).catch(() => 0),
      QrToken.countDocuments({ expires_at: { $lte: now() }, used_at: null, revoked_at: null }).catch(() => 0),
      QrToken.countDocuments({ used_at: { $ne: null } }).catch(() => 0),
      QrToken.countDocuments({ revoked_at: { $ne: null } }).catch(() => 0),
    ]),
    MaintenanceWindow.countDocuments({ status: 'active', starts_at: { $lte: now() }, $or: [{ ends_at: null }, { ends_at: { $gt: now() } }] }).catch(() => 0),
  ]);

  const outbox = workerHealth.outbox || {};
  const deliveries = workerHealth.notification_delivery || {};
  const recentJobs = workerHealth.job_runs || [];
  const failedJobs = recentJobs.filter((item) => item.status === 'failed').length;
  const oldestPending = await EventOutbox.findOne({ status: EVENT_OUTBOX_STATUS.PENDING }).sort({ created_at: 1 }).select('created_at event_type event_id').lean();
  const oldestPendingAgeMs = ageMs(oldestPending?.created_at);

  const components = [
    buildComponent(
      'event_outbox_worker',
      'Event outbox worker',
      statusFromCounts({ deadLetter: outbox.dead_letter, failed: outbox.failed, pending: outbox.pending, processing: outbox.processing }),
      `${safeNumber(outbox.failed)} failed, ${safeNumber(outbox.dead_letter)} dead-letter`,
      'open_outbox',
      outbox,
    ),
    buildComponent(
      'notification_worker',
      'Notification worker',
      statusFromCounts({ failed: deliveries.failed, pending: deliveries.pending }),
      `${safeNumber(deliveries.delivered)} delivered, ${safeNumber(deliveries.failed)} failed`,
      'open_deliveries',
      deliveries,
    ),
    buildComponent(
      'job_runner',
      'Job runner',
      failedJobs > 0 ? 'degraded' : 'healthy',
      `${failedJobs} failed runs in recent sample`,
      'open_job_runs',
      { failed_recent: failedJobs, sampled: recentJobs.length },
    ),
    buildComponent(
      'realtime_socket',
      'Realtime socket',
      realtimeService.getSocketServer() ? 'healthy' : 'unknown',
      realtimeService.getSocketServer() ? 'Socket.IO server available' : 'Socket.IO server not attached',
      'open_realtime',
      { connected_sockets: realtimeService.getSocketServer()?.engine?.clientsCount || 0 },
    ),
    buildComponent(
      'redis_queue',
      'Redis queue',
      jobQueue.isQueueEnabled() ? 'healthy' : 'unknown',
      jobQueue.isQueueEnabled() ? 'BullMQ enabled' : 'Interval fallback or Redis missing',
      'open_queues',
      { bullmq_enabled: jobQueue.isQueueEnabled() ? 1 : 0 },
    ),
    buildComponent(
      'file_scan',
      'File scan',
      safeNumber(fileScanCounts.infected) > 0 || safeNumber(fileScanCounts.failed) > 0 ? 'critical' : safeNumber(fileScanCounts.pending) > 0 ? 'degraded' : 'healthy',
      `${safeNumber(fileScanCounts.pending)} pending, ${safeNumber(fileScanCounts.failed)} failed`,
      'open_file_scan',
      fileScanCounts,
    ),
    buildComponent(
      'idempotency',
      'Idempotency',
      safeNumber(idempotencyCounts.processing) > 50 ? 'degraded' : 'healthy',
      `${safeNumber(idempotencyCounts.processing)} processing records`,
      'open_idempotency',
      idempotencyCounts,
    ),
    buildComponent(
      'maintenance',
      'Maintenance mode',
      activeMaintenance > 0 ? 'degraded' : 'healthy',
      activeMaintenance > 0 ? `${activeMaintenance} active maintenance window` : 'Off',
      'open_maintenance',
      { active: activeMaintenance },
    ),
  ];

  const overall = components.some((item) => item.status === 'critical')
    ? 'critical'
    : components.some((item) => item.status === 'degraded')
      ? 'degraded'
      : 'healthy';

  return {
    status: overall,
    score: overall === 'healthy' ? 96 : overall === 'degraded' ? 72 : 38,
    environment: env.nodeEnv || 'development',
    mode: jobQueue.isQueueEnabled() ? 'bullmq' : 'interval_fallback',
    counters: {
      outbox,
      notification_delivery: deliveries,
      file_scans: fileScanCounts,
      idempotency: idempotencyCounts,
      qr_tokens: {
        active: qrCounts[0],
        expired: qrCounts[1],
        used: qrCounts[2],
        revoked: qrCounts[3],
      },
      oldest_pending_event_age_ms: oldestPendingAgeMs,
    },
    warnings: components.filter((item) => item.status === 'degraded'),
    criticals: components.filter((item) => item.status === 'critical'),
    components,
    recent_job_runs: recentJobs,
    checked_at: now().toISOString(),
  };
}

async function getDashboard() {
  const [health, events, deliveries, jobsSummary, failures, realtime] = await Promise.all([
    getHealth(),
    getEventOutboxSummary(),
    getNotificationDeliveriesSummary(),
    getJobs({ limit: 20 }),
    getNotificationFailureGroups({ limit: 8 }),
    getRealtimeStatus(),
  ]);

  return {
    health,
    event_outbox: events,
    notification_delivery: deliveries,
    jobs: jobsSummary,
    notification_failures: failures,
    realtime,
    checked_at: now().toISOString(),
  };
}

async function getJobs(query = {}) {
  const runs = await JobRunLog.aggregate([
    { $sort: { started_at: -1 } },
    {
      $group: {
        _id: '$job_name',
        last_run: { $first: '$$ROOT' },
        total_runs: { $sum: 1 },
        failed_runs: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        success_runs: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        avg_duration_ms: { $avg: '$duration_ms' },
        records_processed: { $sum: '$records_processed' },
      },
    },
  ]).catch(() => []);
  const runMap = new Map(runs.map((item) => [item._id, item]));
  const registry = JOB_REGISTRY.map((job) => {
    const stats = runMap.get(job.job_name) || {};
    const total = safeNumber(stats.total_runs);
    const failed = safeNumber(stats.failed_runs);
    return {
      ...job,
      enabled: typeof jobs[job.handler] === 'function',
      queue_enabled: jobQueue.isQueueEnabled(),
      last_run: serialize(stats.last_run),
      success_rate: total ? Math.round(((total - failed) / total) * 100) : null,
      avg_duration_ms: Math.round(safeNumber(stats.avg_duration_ms)),
      total_runs: total,
      failed_runs: failed,
      records_processed: safeNumber(stats.records_processed),
    };
  });
  const queues = await listQueues(query);
  return {
    mode: jobQueue.isQueueEnabled() ? 'bullmq' : 'interval_fallback',
    redis_configured: Boolean(env.redisUrl),
    concurrency: env.jobWorkerConcurrency,
    registry,
    queues: queues.items,
    summary: {
      total_jobs: registry.length,
      enabled_jobs: registry.filter((item) => item.enabled).length,
      failed_jobs_24h: await JobRunLog.countDocuments({ status: 'failed', started_at: { $gte: hoursAgo(24) } }).catch(() => 0),
      avg_duration_ms: Math.round(safeNumber(registry.reduce((sum, item) => sum + safeNumber(item.avg_duration_ms), 0) / Math.max(registry.filter((item) => item.avg_duration_ms).length, 1))),
    },
    checked_at: now().toISOString(),
  };
}

function findJob(jobName) {
  const registry = JOB_REGISTRY.find((item) => item.job_name === jobName || item.handler === jobName);
  if (!registry) throw ApiError.notFound('Không tìm thấy job trong registry Operations Center.');
  const handler = jobs[registry.handler];
  if (typeof handler !== 'function') throw ApiError.badRequest('Job này chưa có handler có thể chạy thủ công.');
  return { registry, handler };
}

async function runJobNow(jobName, payload = {}, auth = {}, requestMeta = {}) {
  const { registry, handler } = findJob(jobName);
  const correlationId = payload.correlation_id || payload.correlationId || `ops-job-${crypto.randomUUID()}`;

  if (payload.enqueue === true && jobQueue.isQueueEnabled()) {
    const queued = await jobQueue.enqueueJob(registry.queue_name, registry.job_name, { ...payload, correlation_id: correlationId });
    await recordOpsAudit(auth, 'operations.jobs.enqueue', 'job', registry.job_name, { queued, correlation_id: correlationId }, requestMeta);
    return { mode: 'bullmq', queued, job: registry, correlation_id: correlationId };
  }

  const run = await jobRunLogService.startJobRun({
    jobName: registry.job_name,
    queueName: registry.queue_name,
    jobId: payload.job_id || `manual:${crypto.randomUUID()}`,
    correlationId,
  });
  try {
    const result = await handler(payload);
    const finished = await jobRunLogService.finishJobRun(run, result);
    await recordOpsAudit(auth, 'operations.jobs.run_now', 'job_run_log', finished._id, {
      job_name: registry.job_name,
      correlation_id: correlationId,
    }, requestMeta);
    return { mode: 'inline', job: registry, run: serialize(finished), result };
  } catch (error) {
    const failed = await jobRunLogService.failJobRun(run, error);
    await recordOpsAudit(auth, 'operations.jobs.run_now_failed', 'job_run_log', failed?._id, {
      job_name: registry.job_name,
      error: error.message,
      severity: 'high',
      correlation_id: correlationId,
    }, requestMeta);
    throw error;
  }
}

async function listJobRuns(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status) filter.status = { $in: csv(query.status) };
  if (query.queue_name) filter.queue_name = query.queue_name;
  if (query.job_name) filter.job_name = query.job_name;
  if (query.worker_id) filter.worker_id = query.worker_id;
  if (query.correlation_id) filter.correlation_id = query.correlation_id;
  if (query.has_error === 'true') filter.error_message = { $exists: true, $ne: '' };
  if (query.search) Object.assign(filter, textSearch(['job_name', 'queue_name', 'job_id', 'worker_id', 'correlation_id', 'error_message'], query.search));
  if (query.from || query.to) {
    filter.started_at = {};
    if (query.from) filter.started_at.$gte = new Date(query.from);
    if (query.to) filter.started_at.$lte = new Date(query.to);
  }

  const [items, total, summary] = await Promise.all([
    JobRunLog.find(filter).sort(sortSpec(query, 'started_at')).skip(skip).limit(limit).lean(),
    JobRunLog.countDocuments(filter),
    countByStatus(JobRunLog, ['running', 'success', 'failed'], {}),
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }, summary };
}

async function getJobRun(runId) {
  const run = await JobRunLog.findById(runId).lean();
  if (!run) throw ApiError.notFound('Không tìm thấy job run log.');
  const [events, deliveries] = await Promise.all([
    run.correlation_id ? EventOutbox.find({ correlation_id: run.correlation_id }).sort({ created_at: -1 }).limit(50).lean() : [],
    run.correlation_id ? NotificationDelivery.find({ 'payload.correlation_id': run.correlation_id }).sort({ created_at: -1 }).limit(50).lean() : [],
  ]);
  return { run: serialize(run), related: { event_outbox: events.map(serialize), notification_deliveries: deliveries.map(serialize) } };
}

async function retryJobRun(runId, payload = {}, auth = {}, requestMeta = {}) {
  const run = await JobRunLog.findById(runId).lean();
  if (!run) throw ApiError.notFound('Không tìm thấy job run log.');
  return runJobNow(run.job_name, { ...payload, correlation_id: payload.correlation_id || run.correlation_id }, auth, requestMeta);
}

async function listQueues(query = {}) {
  const queueNames = [...new Set(JOB_REGISTRY.map((item) => item.queue_name).filter(Boolean))];
  const items = await Promise.all(queueNames.map(async (queueName) => getQueueStats(queueName)));
  return {
    mode: jobQueue.isQueueEnabled() ? 'bullmq' : 'interval_fallback',
    items,
    checked_at: now().toISOString(),
  };
}

async function getQueueStats(queueName) {
  if (!jobQueue.isQueueEnabled()) {
    return {
      queue_name: queueName,
      mode: 'interval_fallback',
      status: 'unavailable',
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      paused: false,
      reason: env.redisUrl ? 'bullmq_unavailable' : 'redis_unconfigured',
    };
  }
  try {
    const queue = jobQueue.getQueue(queueName);
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
    const paused = await queue.isPaused();
    return { queue_name: queueName, mode: 'bullmq', status: paused ? 'paused' : 'online', ...counts, paused };
  } catch (error) {
    return { queue_name: queueName, mode: 'bullmq', status: 'error', error: error.message };
  }
}

async function queueAction(queueName, action, auth = {}, requestMeta = {}) {
  if (!jobQueue.isQueueEnabled()) {
    return { queue_name: queueName, action, skipped: true, reason: env.redisUrl ? 'bullmq_unavailable' : 'redis_unconfigured' };
  }
  const queue = jobQueue.getQueue(queueName);
  if (!queue) throw ApiError.notFound('Không tìm thấy queue.');
  if (action === 'pause') await queue.pause();
  else if (action === 'resume') await queue.resume();
  else if (action === 'drain') await queue.drain();
  else throw ApiError.badRequest('Queue action không hỗ trợ.');
  await recordOpsAudit(auth, `operations.queues.${action}`, 'queue', queueName, { queue_name: queueName }, requestMeta);
  return getQueueStats(queueName);
}

async function getEventOutboxSummary() {
  const [statuses, eventTypes, aggregateTypes, oldestPending, retryDueNow, recentFailed] = await Promise.all([
    countByStatus(EventOutbox, EVENT_OUTBOX_STATUSES, {}),
    EventOutbox.aggregate([
      { $group: { _id: { event_type: '$event_type', status: '$status' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 40 },
    ]).catch(() => []),
    EventOutbox.aggregate([
      { $group: { _id: { aggregate_type: '$aggregate_type', status: '$status' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]).catch(() => []),
    EventOutbox.findOne({ status: EVENT_OUTBOX_STATUS.PENDING }).sort({ created_at: 1 }).lean(),
    EventOutbox.countDocuments({
      status: { $in: [EVENT_OUTBOX_STATUS.PENDING, EVENT_OUTBOX_STATUS.FAILED] },
      $or: [{ next_retry_at: null }, { next_retry_at: { $exists: false } }, { next_retry_at: { $lte: now() } }],
    }).catch(() => 0),
    EventOutbox.countDocuments({ status: { $in: [EVENT_OUTBOX_STATUS.FAILED, EVENT_OUTBOX_STATUS.DEAD_LETTER] }, updated_at: { $gte: hoursAgo(0.25) } }).catch(() => 0),
  ]);
  return {
    statuses,
    event_types: eventTypes,
    aggregate_types: aggregateTypes,
    oldest_pending: serialize(oldestPending),
    oldest_pending_age_ms: ageMs(oldestPending?.created_at),
    retry_due_now: retryDueNow,
    failed_last_15m: recentFailed,
    status: statusFromCounts({ deadLetter: statuses.dead_letter, failed: statuses.failed, pending: statuses.pending, processing: statuses.processing }),
    checked_at: now().toISOString(),
  };
}

async function listEventOutbox(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status) filter.status = { $in: csv(query.status) };
  if (query.event_type) filter.event_type = query.event_type;
  if (query.aggregate_type) filter.aggregate_type = query.aggregate_type;
  if (query.aggregate_id) filter.aggregate_id = query.aggregate_id;
  if (query.correlation_id) filter.correlation_id = query.correlation_id;
  if (query.request_id) filter.request_id = query.request_id;
  if (query.retry_due === 'true') {
    filter.$or = [{ next_retry_at: null }, { next_retry_at: { $exists: false } }, { next_retry_at: { $lte: now() } }];
  }
  if (query.search) Object.assign(filter, textSearch(['event_id', 'event_type', 'aggregate_type', 'correlation_id', 'request_id', 'last_error', 'idempotency_key'], query.search));
  if (query.from || query.to) {
    filter.created_at = {};
    if (query.from) filter.created_at.$gte = new Date(query.from);
    if (query.to) filter.created_at.$lte = new Date(query.to);
  }
  const [items, total, summary] = await Promise.all([
    EventOutbox.find(filter).sort(sortSpec(query, 'created_at')).skip(skip).limit(limit).lean(),
    EventOutbox.countDocuments(filter),
    getEventOutboxSummary(),
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }, summary };
}

async function findOutboxEvent(eventId) {
  const event = await EventOutbox.findOne(idFilter(eventId, 'event_id'));
  if (!event) throw ApiError.notFound('Không tìm thấy event outbox.');
  return event;
}

async function getEventOutboxDetail(eventId) {
  const event = await findOutboxEvent(eventId);
  const [deliveries, siblings, audit] = await Promise.all([
    NotificationDelivery.find({
      $or: [
        { 'payload.event_id': event.event_id },
        { 'payload.correlation_id': event.correlation_id },
      ],
    }).sort({ created_at: -1 }).limit(50).lean(),
    event.correlation_id ? EventOutbox.find({ correlation_id: event.correlation_id, _id: { $ne: event._id } }).sort({ created_at: -1 }).limit(50).lean() : [],
    AuditLog.find({ target_type: { $in: ['event_outbox', 'operations'] }, target_id: event._id }).sort({ created_at: -1 }).limit(30).lean(),
  ]);
  return { event: serialize(event), related: { notification_deliveries: deliveries.map(serialize), correlation_events: siblings.map(serialize), audit: audit.map(serialize) } };
}

async function retryEvent(eventId, payload = {}, auth = {}, requestMeta = {}) {
  const event = await findOutboxEvent(eventId);
  event.status = EVENT_OUTBOX_STATUS.PENDING;
  event.next_retry_at = now();
  event.locked_at = undefined;
  event.locked_by = undefined;
  event.dead_letter_at = undefined;
  event.last_error = undefined;
  await event.save();

  let dispatch = null;
  let ok = true;
  if (payload.dispatch_now !== false) {
    try {
      dispatch = await eventBus.publishOutboxEvent(event._id, `ops:${os.hostname()}:${process.pid}`);
    } catch (error) {
      ok = false;
      dispatch = { delivered: false, error: error.message };
    }
  }
  const fresh = await EventOutbox.findById(event._id).lean();
  await recordOpsAudit(auth, 'operations.event_outbox.retry', 'event_outbox', event._id, {
    event_type: event.event_type,
    ok,
    reason: payload.reason,
  }, requestMeta);
  return { ok, event: serialize(fresh), dispatch };
}

async function replayEvent(eventId, payload = {}, auth = {}, requestMeta = {}) {
  const source = await findOutboxEvent(eventId);
  const clone = await EventOutbox.create({
    event_type: payload.event_type || source.event_type,
    aggregate_type: payload.aggregate_type || source.aggregate_type,
    aggregate_id: payload.aggregate_id || source.aggregate_id,
    actor: payload.actor || source.actor,
    recipients: payload.recipients || source.recipients || [],
    recipient_scope: payload.recipient_scope || source.recipient_scope || {},
    payload: payload.payload || source.payload || {},
    occurred_at: now(),
    correlation_id: payload.correlation_id || source.correlation_id || `ops-replay-${crypto.randomUUID()}`,
    request_id: payload.request_id || requestMeta.requestId || requestMeta.request_id,
    status: EVENT_OUTBOX_STATUS.PENDING,
    next_retry_at: now(),
    max_retry_count: payload.max_retry_count || source.max_retry_count || 10,
    idempotency_key: payload.idempotency_key,
  });

  let dispatch = null;
  let ok = true;
  if (payload.dispatch_now === true) {
    try {
      dispatch = await eventBus.publishOutboxEvent(clone._id, `ops:${os.hostname()}:${process.pid}`);
    } catch (error) {
      ok = false;
      dispatch = { delivered: false, error: error.message };
    }
  }
  await recordOpsAudit(auth, 'operations.event_outbox.replay', 'event_outbox', clone._id, {
    source_event_id: toId(source._id),
    event_type: clone.event_type,
    ok,
    reason: payload.reason,
  }, requestMeta);
  return { ok, source: serialize(source), replayed_event: serialize(await EventOutbox.findById(clone._id).lean()), dispatch };
}

async function unlockEvent(eventId, payload = {}, auth = {}, requestMeta = {}) {
  const event = await findOutboxEvent(eventId);
  event.status = payload.status || EVENT_OUTBOX_STATUS.PENDING;
  event.locked_at = undefined;
  event.locked_by = undefined;
  event.next_retry_at = now();
  await event.save();
  await recordOpsAudit(auth, 'operations.event_outbox.unlock', 'event_outbox', event._id, { reason: payload.reason }, requestMeta);
  return serialize(event);
}

async function markEventDeadLetter(eventId, payload = {}, auth = {}, requestMeta = {}) {
  const event = await findOutboxEvent(eventId);
  event.status = EVENT_OUTBOX_STATUS.DEAD_LETTER;
  event.dead_letter_at = event.dead_letter_at || now();
  event.last_error = payload.reason || payload.last_error || event.last_error;
  event.locked_at = undefined;
  event.locked_by = undefined;
  await event.save();
  await recordOpsAudit(auth, 'operations.event_outbox.mark_dead_letter', 'event_outbox', event._id, { reason: payload.reason, severity: 'high' }, requestMeta);
  return serialize(event);
}

async function bulkRetryEvents(payload = {}, auth = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.event_ids) ? payload.event_ids : Array.isArray(payload.ids) ? payload.ids : [];
  if (!ids.length) throw ApiError.badRequest('event_ids là bắt buộc.');
  const results = [];
  for (const id of ids) {
    try {
      results.push({ id, ok: true, data: await retryEvent(id, { ...payload, dispatch_now: payload.dispatch_now === true }, auth, requestMeta) });
    } catch (error) {
      results.push({ id, ok: false, message: error.message });
    }
  }
  return { total: results.length, success: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}

async function listDeadLetterEvents(query = {}) {
  return listEventOutbox({ ...query, status: EVENT_OUTBOX_STATUS.DEAD_LETTER });
}

async function retryPreview(payload = {}) {
  const eventId = payload.event_id || payload.eventId;
  if (!eventId) throw ApiError.badRequest('event_id là bắt buộc.');
  const event = await findOutboxEvent(eventId);
  const relatedDeliveries = await NotificationDelivery.countDocuments({
    $or: [
      { 'payload.event_id': event.event_id },
      { 'payload.correlation_id': event.correlation_id },
    ],
  }).catch(() => 0);
  const sideEffectRisk = /payment|invoice|refund|clinical|lab_result|imaging|security|auth/i.test(event.event_type)
    ? 'high'
    : 'medium';
  return {
    event: serialize(event),
    precheck: {
      current_status: event.status,
      retry_count: event.retry_count,
      max_retry_count: event.max_retry_count,
      idempotency_key: event.idempotency_key,
      related_notification_deliveries: relatedDeliveries,
      side_effect_risk: sideEffectRisk,
      confirmation_phrase: sideEffectRisk === 'high' && /payment|invoice|refund/i.test(event.event_type)
        ? 'REPLAY PAYMENT EVENT'
        : 'RETRY EVENT',
      warnings: [
        ...(event.status === EVENT_OUTBOX_STATUS.PUBLISHED ? ['Event đã published; replay có thể tạo tác dụng phụ trùng lặp.'] : []),
        ...(event.retry_count >= event.max_retry_count ? ['Event đã chạm max retry count.'] : []),
        ...(event.idempotency_key ? ['Event có idempotency_key; replay nên dùng key mới hoặc bỏ key.'] : []),
      ],
    },
  };
}

async function getNotificationDeliveriesSummary() {
  const [statuses, channels, providers, retryDueNow, oldestPending] = await Promise.all([
    countByStatus(NotificationDelivery, NOTIFICATION_DELIVERY_STATUSES, {}),
    NotificationDelivery.aggregate([{ $group: { _id: { channel: '$channel', status: '$status' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]).catch(() => []),
    NotificationDelivery.aggregate([{ $group: { _id: { provider: '$provider', status: '$status' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 30 }]).catch(() => []),
    NotificationDelivery.countDocuments({
      status: NOTIFICATION_DELIVERY_STATUS.PENDING,
      $or: [{ next_attempt_at: null }, { next_attempt_at: { $exists: false } }, { next_attempt_at: { $lte: now() } }],
    }).catch(() => 0),
    NotificationDelivery.findOne({ status: NOTIFICATION_DELIVERY_STATUS.PENDING }).sort({ created_at: 1 }).lean(),
  ]);
  return {
    statuses,
    channels,
    providers,
    retry_due_now: retryDueNow,
    oldest_pending: serialize(oldestPending),
    oldest_pending_age_ms: ageMs(oldestPending?.created_at),
    status: statusFromCounts({ failed: statuses.failed, pending: statuses.pending }),
    provider_health: {
      email_enabled: Boolean(env.smtpEnabled),
      push_enabled: Boolean(env.pushProviderUrl),
      smtp_host_configured: Boolean(env.smtpHost),
      push_provider_configured: Boolean(env.pushProviderUrl),
    },
    checked_at: now().toISOString(),
  };
}

async function listNotificationDeliveries(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status) filter.status = { $in: csv(query.status) };
  if (query.channel) filter.channel = { $in: csv(query.channel) };
  if (query.provider) filter.provider = query.provider;
  if (query.notification_id && mongoose.Types.ObjectId.isValid(query.notification_id)) filter.notification_id = query.notification_id;
  if (query.search) Object.assign(filter, textSearch(['channel', 'provider', 'status', 'last_error'], query.search));
  if (query.from || query.to) {
    filter.created_at = {};
    if (query.from) filter.created_at.$gte = new Date(query.from);
    if (query.to) filter.created_at.$lte = new Date(query.to);
  }
  const [items, total, summary] = await Promise.all([
    NotificationDelivery.find(filter).sort(sortSpec(query, 'created_at')).skip(skip).limit(limit).lean(),
    NotificationDelivery.countDocuments(filter),
    getNotificationDeliveriesSummary(),
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }, summary };
}

async function getNotificationDeliveryDetail(deliveryId) {
  const delivery = await NotificationDelivery.findById(deliveryId).lean();
  if (!delivery) throw ApiError.notFound('Không tìm thấy notification delivery.');
  const notification = delivery.notification_id ? await Notification.findById(delivery.notification_id).lean().catch(() => null) : null;
  const event = delivery.payload?.event_id
    ? await EventOutbox.findOne({ event_id: delivery.payload.event_id }).lean().catch(() => null)
    : null;
  return { delivery: serialize(delivery), related: { notification: serialize(notification), event: serialize(event) } };
}

async function retryNotificationDelivery(deliveryId, payload = {}, auth = {}, requestMeta = {}) {
  const delivery = await NotificationDelivery.findById(deliveryId);
  if (!delivery) throw ApiError.notFound('Không tìm thấy notification delivery.');
  delivery.status = NOTIFICATION_DELIVERY_STATUS.PENDING;
  delivery.next_attempt_at = now();
  delivery.last_error = undefined;
  delivery.payload = {
    ...(delivery.payload || {}),
    processing_at: null,
    processing_by: null,
  };
  await delivery.save();
  let result = null;
  let ok = true;
  if (payload.dispatch_now !== false) {
    try {
      result = await notificationDeliveryWorker.dispatchDelivery(delivery._id, { workerId: `ops:${os.hostname()}:${process.pid}` });
    } catch (error) {
      ok = false;
      result = { delivered: false, error: error.message };
    }
  }
  await recordOpsAudit(auth, 'operations.notification_delivery.retry', 'notification_delivery', delivery._id, {
    channel: delivery.channel,
    provider: delivery.provider,
    ok,
    reason: payload.reason,
  }, requestMeta);
  return { ok, delivery: serialize(await NotificationDelivery.findById(delivery._id).lean()), dispatch: result };
}

async function bulkRetryNotificationDeliveries(payload = {}, auth = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.delivery_ids) ? payload.delivery_ids : Array.isArray(payload.ids) ? payload.ids : [];
  if (!ids.length) throw ApiError.badRequest('delivery_ids là bắt buộc.');
  const results = [];
  for (const id of ids) {
    try {
      results.push({ id, ok: true, data: await retryNotificationDelivery(id, payload, auth, requestMeta) });
    } catch (error) {
      results.push({ id, ok: false, message: error.message });
    }
  }
  return { total: results.length, success: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}

async function markNotificationDeliverySkipped(deliveryId, payload = {}, auth = {}, requestMeta = {}) {
  const delivery = await NotificationDelivery.findById(deliveryId);
  if (!delivery) throw ApiError.notFound('Không tìm thấy notification delivery.');
  delivery.status = NOTIFICATION_DELIVERY_STATUS.SKIPPED;
  delivery.last_error = payload.reason || delivery.last_error;
  delivery.next_attempt_at = undefined;
  await delivery.save();
  await recordOpsAudit(auth, 'operations.notification_delivery.mark_skipped', 'notification_delivery', delivery._id, { reason: payload.reason }, requestMeta);
  return serialize(delivery);
}

function normalizeFailureKey(item = {}) {
  return [
    item.channel || 'unknown_channel',
    item.provider || 'unknown_provider',
    String(item.last_error || 'unknown_error').slice(0, 120),
  ].join('|');
}

async function getNotificationFailureGroups(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 30), 1), 100);
  const failed = await NotificationDelivery.find({ status: NOTIFICATION_DELIVERY_STATUS.FAILED })
    .sort({ updated_at: -1 })
    .limit(1000)
    .lean();
  const groups = new Map();
  failed.forEach((item) => {
    const key = normalizeFailureKey(item);
    const group = groups.get(key) || {
      group_key: key,
      channel: item.channel,
      provider: item.provider,
      last_error: item.last_error || 'unknown_error',
      count: 0,
      first_seen_at: item.created_at,
      last_seen_at: item.updated_at || item.last_attempt_at || item.created_at,
      affected_notifications: new Set(),
      sample_delivery_id: toId(item._id),
      suggested_fix: String(item.last_error || '').includes('provider_disabled')
        ? 'Kiểm tra cấu hình provider hoặc tắt channel trong template.'
        : 'Retry nhóm sau khi đã xác nhận provider hoạt động bình thường.',
    };
    group.count += 1;
    if (item.notification_id) group.affected_notifications.add(toId(item.notification_id));
    if (new Date(item.created_at) < new Date(group.first_seen_at)) group.first_seen_at = item.created_at;
    if (new Date(item.updated_at || item.last_attempt_at || item.created_at) > new Date(group.last_seen_at)) {
      group.last_seen_at = item.updated_at || item.last_attempt_at || item.created_at;
    }
    groups.set(key, group);
  });
  return {
    items: [...groups.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((group) => ({ ...group, affected_notifications: group.affected_notifications.size })),
    summary: {
      total_failed: failed.length,
      total_groups: groups.size,
      email_failed: failed.filter((item) => item.channel === 'email').length,
      push_failed: failed.filter((item) => item.channel === 'push').length,
      socket_failed: failed.filter((item) => item.channel === 'socket').length,
    },
  };
}

async function retryNotificationFailureGroup(groupKey, payload = {}, auth = {}, requestMeta = {}) {
  const [channel, provider, error] = String(groupKey || '').split('|');
  const filter = {
    status: NOTIFICATION_DELIVERY_STATUS.FAILED,
    channel,
    last_error: error,
  };
  if (provider !== 'unknown_provider') filter.provider = provider;
  const deliveries = await NotificationDelivery.find(filter).sort({ updated_at: -1 }).limit(Number(payload.limit || 100)).lean();
  return bulkRetryNotificationDeliveries({ ...payload, delivery_ids: deliveries.map((item) => toId(item._id)) }, auth, requestMeta);
}

async function getRealtimeStatus() {
  const io = realtimeService.getSocketServer();
  const presence = presenceService.getAllPresence();
  const rooms = listRealtimeRooms();
  const recent = await EventOutbox.find({
    event_type: { $regex: /notification|payment|queue|emergency|realtime|socket|presence|alert/i },
  }).sort({ created_at: -1 }).limit(50).lean();
  return {
    socket_status: io ? 'available' : 'unavailable',
    redis_adapter_status: env.redisUrl && env.realtimeRedisEnabled ? 'configured' : 'not_configured',
    realtime_redis_enabled: Boolean(env.realtimeRedisEnabled),
    connected_sockets: io?.engine?.clientsCount || 0,
    active_rooms: rooms.length,
    online_actors: presence.length,
    online_staff: presence.filter((item) => item.actor_type === 'staff').length,
    online_patients: presence.filter((item) => ['patient', 'patient_relative'].includes(item.actor_type)).length,
    rooms,
    presence,
    events_recent: recent.map(serialize),
    checked_at: now().toISOString(),
  };
}

function listRealtimeRooms() {
  const io = realtimeService.getSocketServer();
  if (!io?.sockets?.adapter?.rooms) return [];
  const socketIds = new Set(io.sockets.sockets ? [...io.sockets.sockets.keys()] : []);
  return [...io.sockets.adapter.rooms.entries()]
    .filter(([room]) => !socketIds.has(room))
    .map(([room, sockets]) => ({
      room,
      type: String(room).split(':')[0] || 'custom',
      socket_count: sockets?.size || 0,
      socket_ids: [...(sockets || [])],
      last_activity_at: now().toISOString(),
    }))
    .sort((a, b) => b.socket_count - a.socket_count)
    .slice(0, 200);
}

async function resolveRealtimeRooms(payload = {}) {
  const scope = payload.scope || payload.recipient_scope || payload;
  const rooms = roomNaming.buildRoomsFromScope(scope);
  const roomStats = listRealtimeRooms();
  const statsByRoom = new Map(roomStats.map((item) => [item.room, item]));
  return {
    rooms,
    total_rooms: rooms.length,
    total_sockets: rooms.reduce((sum, room) => sum + safeNumber(statsByRoom.get(room)?.socket_count), 0),
    room_stats: rooms.map((room) => statsByRoom.get(room) || { room, socket_count: 0 }),
  };
}

async function testRealtimeEmit(payload = {}, auth = {}, requestMeta = {}) {
  const eventName = payload.event_name || payload.event || 'operations.test_emit';
  const resolved = await resolveRealtimeRooms(payload);
  if (payload.dry_run !== false) return { dry_run: true, event: eventName, ...resolved };
  const result = realtimeService.emitToRooms(eventName, payload.payload || { message: 'Operations Center test emit' }, resolved.rooms, {
    request_id: requestMeta.requestId || requestMeta.request_id,
  });
  await recordOpsAudit(auth, 'operations.realtime.test_emit', 'realtime', null, { event: eventName, rooms: resolved.rooms }, requestMeta);
  return { dry_run: false, event: eventName, ...resolved, result };
}

async function listSocketPresence(query = {}) {
  let items = presenceService.getAllPresence();
  if (query.actor_type) items = items.filter((item) => item.actor_type === query.actor_type);
  if (query.actor_id) items = items.filter((item) => item.actor_id === String(query.actor_id));
  if (query.search) {
    const q = String(query.search).toLowerCase();
    items = items.filter((item) => `${item.actor_type} ${item.actor_id} ${(item.rooms || []).join(' ')}`.toLowerCase().includes(q));
  }
  return {
    items,
    summary: {
      online_actors: items.length,
      online_staff: items.filter((item) => item.actor_type === 'staff').length,
      online_patients: items.filter((item) => ['patient', 'patient_relative'].includes(item.actor_type)).length,
      total_sockets: items.reduce((sum, item) => sum + safeNumber(item.socket_count), 0),
      avg_sockets_per_actor: items.length ? Number((items.reduce((sum, item) => sum + safeNumber(item.socket_count), 0) / items.length).toFixed(2)) : 0,
      stale_presence: items.filter((item) => new Date(item.expires_at) < now()).length,
    },
    checked_at: now().toISOString(),
  };
}

async function disconnectSocket(socketId, payload = {}, auth = {}, requestMeta = {}) {
  const io = realtimeService.getSocketServer();
  const socket = io?.sockets?.sockets?.get(socketId);
  if (socket) socket.disconnect(true);
  const presence = realtimeService.disconnectSocket(socketId);
  await recordOpsAudit(auth, 'operations.socket.disconnect', 'socket', socketId, { reason: payload.reason, found: Boolean(socket) }, requestMeta);
  return { socket_id: socketId, disconnected: Boolean(socket || presence), presence };
}

async function pruneSocketPresence() {
  presenceService.pruneExpired();
  return listSocketPresence();
}

async function listIdempotencyRecords(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status) filter.status = { $in: csv(query.status) };
  if (query.route) filter.route = { $regex: escapeRegex(query.route), $options: 'i' };
  if (query.method) filter.method = String(query.method).toUpperCase();
  if (query.actor_type) filter.actor_type = query.actor_type;
  if (query.actor_id) filter.actor_id = query.actor_id;
  if (query.stuck === 'true') {
    filter.status = IDEMPOTENCY_STATUS.PROCESSING;
    filter.locked_at = { $lte: new Date(Date.now() - STALE_PROCESSING_MS) };
  }
  if (query.search) Object.assign(filter, textSearch(['key', 'actor_type', 'actor_id', 'actor_fingerprint', 'route', 'method', 'request_hash'], query.search));
  const [items, total, summary] = await Promise.all([
    IdempotencyRecord.find(filter).sort(sortSpec(query, 'created_at')).skip(skip).limit(limit).lean(),
    IdempotencyRecord.countDocuments(filter),
    getIdempotencySummary(),
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }, summary };
}

async function getIdempotencySummary() {
  const [statuses, stuck, expiredSoon, topRoutes] = await Promise.all([
    countByStatus(IdempotencyRecord, IDEMPOTENCY_STATUSES, {}),
    IdempotencyRecord.countDocuments({ status: IDEMPOTENCY_STATUS.PROCESSING, locked_at: { $lte: new Date(Date.now() - STALE_PROCESSING_MS) } }).catch(() => 0),
    IdempotencyRecord.countDocuments({ expires_at: { $lte: new Date(Date.now() + 60 * 60 * 1000), $gt: now() } }).catch(() => 0),
    IdempotencyRecord.aggregate([{ $group: { _id: { route: '$route', method: '$method' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]).catch(() => []),
  ]);
  return { statuses, stuck_processing: stuck, expired_soon: expiredSoon, top_routes: topRoutes };
}

async function getIdempotencyRecord(id) {
  const record = await IdempotencyRecord.findById(id).lean();
  if (!record) throw ApiError.notFound('Không tìm thấy idempotency record.');
  return serialize(record);
}

async function unlockIdempotencyRecord(id, payload = {}, auth = {}, requestMeta = {}) {
  const record = await IdempotencyRecord.findById(id);
  if (!record) throw ApiError.notFound('Không tìm thấy idempotency record.');
  record.status = IDEMPOTENCY_STATUS.FAILED;
  record.failed_at = now();
  record.locked_at = undefined;
  record.expires_at = payload.expire_now === false ? record.expires_at : new Date(Date.now() - 1000);
  await record.save();
  await recordOpsAudit(auth, 'operations.idempotency.unlock', 'idempotency_record', record._id, { reason: payload.reason }, requestMeta);
  return serialize(record);
}

async function expireIdempotencyRecord(id, payload = {}, auth = {}, requestMeta = {}) {
  const record = await IdempotencyRecord.findById(id);
  if (!record) throw ApiError.notFound('Không tìm thấy idempotency record.');
  record.expires_at = new Date(Date.now() - 1000);
  record.locked_at = undefined;
  await record.save();
  await recordOpsAudit(auth, 'operations.idempotency.expire', 'idempotency_record', record._id, { reason: payload.reason }, requestMeta);
  return serialize(record);
}

async function cleanupExpiredIdempotencyRecords(payload = {}, auth = {}, requestMeta = {}) {
  const result = await IdempotencyRecord.deleteMany({ expires_at: { $lte: now() } });
  await recordOpsAudit(auth, 'operations.idempotency.cleanup_expired', 'idempotency_record', null, { deleted_count: result.deletedCount || 0 }, requestMeta);
  return { deleted_count: result.deletedCount || 0 };
}

async function listQrTokens(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.type) filter.type = { $in: csv(query.type) };
  if (query.target_type) filter.target_type = query.target_type;
  if (query.target_id && mongoose.Types.ObjectId.isValid(query.target_id)) filter.target_id = query.target_id;
  if (query.actor_type) filter.actor_type = query.actor_type;
  if (query.active === 'true') filter.revoked_at = null, filter.used_at = null, filter.$or = [{ expires_at: null }, { expires_at: { $gt: now() } }];
  if (query.status === 'expired') filter.expires_at = { $lte: now() };
  if (query.status === 'used') filter.used_at = { $ne: null };
  if (query.status === 'revoked') filter.revoked_at = { $ne: null };
  if (query.search) Object.assign(filter, textSearch(['token', 'type', 'target_type'], query.search));
  const [items, total, summary] = await Promise.all([
    QrToken.find(filter).sort(sortSpec(query, 'created_at')).skip(skip).limit(limit).lean(),
    QrToken.countDocuments(filter),
    getQrTokensSummary(),
  ]);
  return {
    items: items.map((item) => ({ ...serialize(item), token_preview: `${String(item.token || '').slice(0, 8)}...${String(item.token || '').slice(-6)}` })),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    summary,
  };
}

async function getQrTokensSummary() {
  const activeFilter = { revoked_at: null, used_at: null, $or: [{ expires_at: null }, { expires_at: { $gt: now() } }] };
  const [active, expired, used, revoked, byType, verifyRecent] = await Promise.all([
    QrToken.countDocuments(activeFilter).catch(() => 0),
    QrToken.countDocuments({ expires_at: { $lte: now() }, used_at: null, revoked_at: null }).catch(() => 0),
    QrToken.countDocuments({ used_at: { $ne: null } }).catch(() => 0),
    QrToken.countDocuments({ revoked_at: { $ne: null } }).catch(() => 0),
    QrToken.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).catch(() => []),
    AuditLog.countDocuments({ action: 'qr_tokens.verify', created_at: { $gte: new Date(Date.now() - 15 * 60 * 1000) } }).catch(() => 0),
  ]);
  return { active, expired, used, revoked, by_type: byType, verify_requests_last_15m: verifyRecent, supported_types: QR_TOKEN_TYPES };
}

async function getQrToken(id) {
  const token = await QrToken.findOne(idFilter(id, 'token')).lean();
  if (!token) throw ApiError.notFound('Không tìm thấy QR token.');
  return serialize(token);
}

async function revokeQrToken(id, payload = {}, auth = {}, requestMeta = {}) {
  const token = await QrToken.findOne(idFilter(id, 'token'));
  if (!token) throw ApiError.notFound('Không tìm thấy QR token.');
  token.revoked_at = token.revoked_at || now();
  token.metadata = { ...(token.metadata || {}), revoked_reason: payload.reason || payload.revoked_reason };
  await token.save();
  await recordOpsAudit(auth, 'operations.qr_tokens.revoke', 'qr_token', token._id, { reason: payload.reason }, requestMeta);
  return serialize(token);
}

async function bulkRevokeQrTokens(payload = {}, auth = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.qr_token_ids) ? payload.qr_token_ids : Array.isArray(payload.ids) ? payload.ids : [];
  if (!ids.length) throw ApiError.badRequest('qr_token_ids là bắt buộc.');
  const results = [];
  for (const id of ids) {
    try {
      results.push({ id, ok: true, data: await revokeQrToken(id, payload, auth, requestMeta) });
    } catch (error) {
      results.push({ id, ok: false, message: error.message });
    }
  }
  return { total: results.length, success: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}

async function cleanupExpiredQrTokens(payload = {}, auth = {}, requestMeta = {}) {
  const result = await QrToken.updateMany(
    { expires_at: { $lte: now() }, used_at: null, revoked_at: null },
    { $set: { revoked_at: now(), metadata: { cleanup_reason: payload.reason || 'expired_cleanup' } } },
  );
  await recordOpsAudit(auth, 'operations.qr_tokens.cleanup_expired', 'qr_token', null, { modified_count: result.modifiedCount || 0 }, requestMeta);
  return { modified_count: result.modifiedCount || 0 };
}

async function getFileScansSummary() {
  const [statuses, oldestPending, providerHealth] = await Promise.all([
    countByField(Attachment, 'scan_status', ['pending', 'clean', 'infected', 'failed', 'skipped'], {}),
    Attachment.findOne({ scan_status: 'pending' }).sort({ created_at: 1 }).lean(),
    getFileScanProviderHealth(),
  ]);
  return {
    statuses,
    oldest_pending: serialize(oldestPending),
    oldest_pending_age_ms: ageMs(oldestPending?.created_at),
    quarantined: await Attachment.countDocuments({ status: 'quarantined' }).catch(() => 0),
    provider_health: providerHealth,
    checked_at: now().toISOString(),
  };
}

async function listFileScans(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.scan_status) filter.scan_status = { $in: csv(query.scan_status) };
  if (query.source) filter.source = query.source;
  if (query.entity_type) filter.entity_type = query.entity_type;
  if (query.search) Object.assign(filter, textSearch(['file_name', 'original_name', 'mime_type', 'storage_provider', 'checksum', 'checksum_sha256'], query.search));
  const [items, total, summary] = await Promise.all([
    Attachment.find(filter).sort(sortSpec(query, 'created_at')).skip(skip).limit(limit).lean(),
    Attachment.countDocuments(filter),
    getFileScansSummary(),
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }, summary };
}

async function getFileScanProviderHealth() {
  return {
    provider: process.env.FILE_SCAN_PROVIDER || 'manual',
    enabled: Boolean(process.env.FILE_SCAN_PROVIDER && process.env.FILE_SCAN_PROVIDER !== 'manual'),
    clamav_configured: Boolean(process.env.CLAMAV_HOST || process.env.CLAMAV_SOCKET),
    manual_mode: !process.env.FILE_SCAN_PROVIDER || process.env.FILE_SCAN_PROVIDER === 'manual',
  };
}

async function bulkFileScanAction(action, payload = {}, auth = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.attachment_ids) ? payload.attachment_ids : Array.isArray(payload.ids) ? payload.ids : [];
  if (!ids.length) throw ApiError.badRequest('attachment_ids là bắt buộc.');
  const results = [];
  for (const id of ids) {
    try {
      let data;
      if (action === 'rescan') data = await clinicalDocumentFilesService.rescanFile(id, payload, auth, requestMeta);
      else if (action === 'quarantine') data = await clinicalDocumentFilesService.quarantineFile(id, payload, auth, requestMeta);
      else throw ApiError.badRequest('File scan action không hỗ trợ.');
      results.push({ id, ok: true, data });
    } catch (error) {
      results.push({ id, ok: false, message: error.message });
    }
  }
  return { total: results.length, success: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}

async function runDiagnosticCheck(checkName) {
  const findings = [];
  const details = {};
  if (checkName === 'database') {
    details.ready_state = mongoose.connection.readyState;
    details.db_name = mongoose.connection.name;
    if (mongoose.connection.readyState !== 1) {
      findings.push({ severity: 'critical', component: 'Database', check: checkName, message: 'MongoDB chưa ở trạng thái connected.', evidence: details, suggested_fix: 'Kiểm tra MONGODB_URI và kết nối database.', can_auto_fix: false });
    }
  } else if (checkName === 'mongo_indexes') {
    const models = [EventOutbox, JobRunLog, NotificationDelivery, IdempotencyRecord, QrToken, Attachment];
    details.collections = await Promise.all(models.map(async (Model) => ({
      collection: Model.collection.name,
      index_count: (await Model.collection.indexes().catch(() => [])).length,
    })));
    if (details.collections.some((item) => item.index_count <= 1)) {
      findings.push({ severity: 'medium', component: 'Mongo indexes', check: checkName, message: 'Một số collection vận hành có ít index.', evidence: details.collections, suggested_fix: 'Chạy npm run sync:indexes trong backend sau khi review.', can_auto_fix: false });
    }
  } else if (checkName === 'redis_bullmq') {
    details.redis_configured = Boolean(env.redisUrl);
    details.jobs_redis_enabled = Boolean(env.jobsRedisEnabled);
    details.bullmq_enabled = jobQueue.isQueueEnabled();
    if (!details.bullmq_enabled) findings.push({ severity: 'medium', component: 'BullMQ / Redis', check: checkName, message: 'Queue đang ở interval fallback hoặc Redis/BullMQ chưa khả dụng.', evidence: details, suggested_fix: 'Cấu hình REDIS_URL và JOBS_REDIS_ENABLED=true cho production.', can_auto_fix: false });
  } else if (checkName === 'realtime') {
    const realtime = await getRealtimeStatus();
    details.connected_sockets = realtime.connected_sockets;
    details.redis_adapter_status = realtime.redis_adapter_status;
    if (realtime.socket_status !== 'available') findings.push({ severity: 'medium', component: 'Socket.IO', check: checkName, message: 'Socket.IO server chưa attached.', evidence: realtime, suggested_fix: 'Kiểm tra initializeSocketServer trong server bootstrap.', can_auto_fix: false });
  } else if (checkName === 'smtp') {
    details.smtp_enabled = Boolean(env.smtpEnabled);
    details.smtp_host_configured = Boolean(env.smtpHost);
    if (!env.smtpEnabled) findings.push({ severity: 'medium', component: 'SMTP provider', check: checkName, message: 'SMTP provider đang disabled.', evidence: details, suggested_fix: 'Cấu hình SMTP_ENABLED, SMTP_HOST và SMTP_FROM_EMAIL nếu cần gửi email.', can_auto_fix: false });
  } else if (checkName === 'push_provider') {
    details.push_provider_configured = Boolean(env.pushProviderUrl);
    if (!env.pushProviderUrl) findings.push({ severity: 'low', component: 'Push provider', check: checkName, message: 'Push provider URL chưa cấu hình.', evidence: details, suggested_fix: 'Cấu hình PUSH_PROVIDER_URL nếu dùng push notification.', can_auto_fix: false });
  } else if (checkName === 'outbox_stuck') {
    details.processing_stale = await EventOutbox.countDocuments({ status: EVENT_OUTBOX_STATUS.PROCESSING, locked_at: { $lte: new Date(Date.now() - STALE_PROCESSING_MS) } });
    details.dead_letter = await EventOutbox.countDocuments({ status: EVENT_OUTBOX_STATUS.DEAD_LETTER });
    details.failed_without_retry = await EventOutbox.countDocuments({ status: EVENT_OUTBOX_STATUS.FAILED, $or: [{ next_retry_at: null }, { next_retry_at: { $exists: false } }] });
    if (details.dead_letter > 0 || details.processing_stale > 0 || details.failed_without_retry > 0) findings.push({ severity: details.dead_letter > 0 ? 'critical' : 'high', component: 'Event outbox', check: checkName, message: 'Có event outbox cần can thiệp.', evidence: details, suggested_fix: 'Mở Event outbox hoặc Dead-letter events để retry/unlock sau khi kiểm tra payload.', can_auto_fix: false });
  } else if (checkName === 'notification_delivery') {
    details.failed = await NotificationDelivery.countDocuments({ status: NOTIFICATION_DELIVERY_STATUS.FAILED });
    details.pending_due = await NotificationDelivery.countDocuments({ status: NOTIFICATION_DELIVERY_STATUS.PENDING, $or: [{ next_attempt_at: null }, { next_attempt_at: { $exists: false } }, { next_attempt_at: { $lte: now() } }] });
    if (details.failed > 0) findings.push({ severity: 'high', component: 'Notification delivery', check: checkName, message: 'Có notification delivery failed.', evidence: details, suggested_fix: 'Kiểm tra provider/channel và retry theo nhóm lỗi.', can_auto_fix: false });
  } else if (checkName === 'file_scan_provider') {
    details.provider = await getFileScanProviderHealth();
    details.failed = await Attachment.countDocuments({ scan_status: 'failed' });
    details.infected = await Attachment.countDocuments({ scan_status: 'infected' });
    if (details.failed > 0 || details.infected > 0 || details.provider.manual_mode) findings.push({ severity: details.infected > 0 ? 'critical' : 'medium', component: 'File scan', check: checkName, message: 'File scan cần review.', evidence: details, suggested_fix: 'Cấu hình scanner thật cho production và xử lý failed/infected files.', can_auto_fix: false });
  } else if (checkName === 'idempotency_stuck') {
    details.stuck = await IdempotencyRecord.countDocuments({ status: IDEMPOTENCY_STATUS.PROCESSING, locked_at: { $lte: new Date(Date.now() - STALE_PROCESSING_MS) } });
    if (details.stuck > 0) findings.push({ severity: 'medium', component: 'Idempotency', check: checkName, message: 'Có idempotency record processing quá lâu.', evidence: details, suggested_fix: 'Mở Idempotency records và expire/unlock record bị kẹt.', can_auto_fix: false });
  } else if (checkName === 'maintenance') {
    details.active = await MaintenanceWindow.countDocuments({ status: 'active', starts_at: { $lte: now() }, $or: [{ ends_at: null }, { ends_at: { $gt: now() } }] });
    if (details.active > 0) findings.push({ severity: 'info', component: 'Maintenance mode', check: checkName, message: 'Maintenance mode đang bật ở ít nhất một scope.', evidence: details, suggested_fix: 'Xác nhận thời gian kết thúc và bypass policy.', can_auto_fix: false });
  } else {
    details.script_backed = true;
    findings.push({ severity: 'info', component: 'Backend scripts', check: checkName, message: 'Check này có script backend tương ứng nhưng chưa chạy từ API vì cần sandbox executor riêng.', evidence: { script: `src/scripts/check-${checkName.replace(/_/g, '-')}.js` }, suggested_fix: 'Chạy script trong CI hoặc tạo executor allowlist trước khi bật auto-run từ UI.', can_auto_fix: false });
  }
  return { check_name: checkName, status: findings.some((item) => ['critical', 'high'].includes(item.severity)) ? 'degraded' : 'healthy', findings, details };
}

async function getDiagnostics() {
  const lastRuns = await DiagnosticRun.find({}).sort({ started_at: -1 }).limit(30).lean().catch(() => []);
  return {
    checks: DIAGNOSTIC_CHECKS,
    last_runs: lastRuns.map(serialize),
    checked_at: now().toISOString(),
  };
}

async function runDiagnostics(payload = {}, auth = {}, requestMeta = {}) {
  const requested = payload.check_name || payload.checkName || payload.checks || 'all';
  const checkNames = requested === 'all'
    ? DIAGNOSTIC_CHECKS.map((item) => item.check_name)
    : csv(requested);
  const results = [];
  for (const checkName of checkNames) {
    const run = await DiagnosticRun.create({
      run_id: `diag-${crypto.randomUUID()}`,
      check_name: checkName,
      status: 'running',
      actor: actorSnapshot(auth),
      started_at: now(),
    });
    try {
      const result = await runDiagnosticCheck(checkName);
      const finishedAt = now();
      run.status = 'success';
      run.finished_at = finishedAt;
      run.duration_ms = finishedAt.getTime() - new Date(run.started_at).getTime();
      run.findings_count = result.findings.length;
      run.critical_count = result.findings.filter((item) => item.severity === 'critical').length;
      run.warning_count = result.findings.filter((item) => ['high', 'medium'].includes(item.severity)).length;
      run.result = result;
      await run.save();
      results.push(serialize(run));
    } catch (error) {
      const finishedAt = now();
      run.status = 'failed';
      run.finished_at = finishedAt;
      run.duration_ms = finishedAt.getTime() - new Date(run.started_at).getTime();
      run.error = error.message;
      await run.save();
      results.push(serialize(run));
    }
  }
  await recordOpsAudit(auth, 'operations.diagnostics.run', 'diagnostic_run', null, { check_names: checkNames }, requestMeta);
  return {
    runs: results,
    summary: {
      total: results.length,
      critical_count: results.reduce((sum, item) => sum + safeNumber(item.critical_count), 0),
      warning_count: results.reduce((sum, item) => sum + safeNumber(item.warning_count), 0),
      findings_count: results.reduce((sum, item) => sum + safeNumber(item.findings_count), 0),
    },
  };
}

async function listDiagnosticRuns(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status) filter.status = { $in: csv(query.status) };
  if (query.check_name) filter.check_name = query.check_name;
  const [items, total] = await Promise.all([
    DiagnosticRun.find(filter).sort(sortSpec(query, 'started_at')).skip(skip).limit(limit).lean(),
    DiagnosticRun.countDocuments(filter),
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
}

async function getDiagnosticRun(runId) {
  const run = await DiagnosticRun.findOne({ $or: [{ run_id: runId }, ...(mongoose.Types.ObjectId.isValid(runId) ? [{ _id: runId }] : [])] }).lean();
  if (!run) throw ApiError.notFound('Không tìm thấy diagnostic run.');
  return serialize(run);
}

async function getMaintenance() {
  const [active, recent] = await Promise.all([
    MaintenanceWindow.find({ status: 'active', starts_at: { $lte: now() }, $or: [{ ends_at: null }, { ends_at: { $gt: now() } }] }).sort({ starts_at: -1 }).lean(),
    MaintenanceWindow.find({}).sort({ created_at: -1 }).limit(50).lean(),
  ]);
  return {
    active: active.map(serialize),
    recent: recent.map(serialize),
    status: active.length > 0 ? 'on' : 'off',
    checked_at: now().toISOString(),
  };
}

async function startMaintenance(payload = {}, auth = {}, requestMeta = {}) {
  const scope = payload.scope || 'global';
  const existing = await MaintenanceWindow.findOne({ scope, status: 'active', starts_at: { $lte: now() }, $or: [{ ends_at: null }, { ends_at: { $gt: now() } }] }).lean();
  if (existing) throw ApiError.conflict('Scope maintenance này đang active.');
  const actor = actorSnapshot(auth);
  const window = await MaintenanceWindow.create({
    scope,
    status: payload.starts_at && new Date(payload.starts_at) > now() ? 'scheduled' : 'active',
    message: payload.message || 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
    starts_at: payload.starts_at ? new Date(payload.starts_at) : now(),
    ends_at: payload.ends_at ? new Date(payload.ends_at) : undefined,
    allowed_actor_types: payload.allowed_actor_types || [],
    allowed_roles: payload.allowed_roles || [],
    allowed_permissions: payload.allowed_permissions || [],
    allow_webhooks: payload.allow_webhooks !== false,
    allow_health_check: payload.allow_health_check !== false,
    allow_emergency: payload.allow_emergency !== false,
    allow_admin_bypass: payload.allow_admin_bypass !== false,
    created_by: mongoose.Types.ObjectId.isValid(actor.actor_id) ? actor.actor_id : undefined,
    metadata: payload.metadata || {},
  });
  await recordOpsAudit(auth, 'operations.maintenance.start', 'maintenance_window', window._id, { scope, message: window.message, severity: 'high' }, requestMeta);
  return serialize(window);
}

async function endMaintenance(idOrScope, payload = {}, auth = {}, requestMeta = {}) {
  const filter = mongoose.Types.ObjectId.isValid(idOrScope) ? { _id: idOrScope } : { scope: idOrScope, status: 'active' };
  const actor = actorSnapshot(auth);
  const window = await MaintenanceWindow.findOne(filter);
  if (!window) throw ApiError.notFound('Không tìm thấy maintenance window active.');
  window.status = 'ended';
  window.ended_at = now();
  window.ends_at = window.ends_at || window.ended_at;
  window.ended_by = mongoose.Types.ObjectId.isValid(actor.actor_id) ? actor.actor_id : undefined;
  window.metadata = { ...(window.metadata || {}), end_reason: payload.reason };
  await window.save();
  await recordOpsAudit(auth, 'operations.maintenance.end', 'maintenance_window', window._id, { scope: window.scope, reason: payload.reason }, requestMeta);
  return serialize(window);
}

async function updateMaintenance(id, payload = {}, auth = {}, requestMeta = {}) {
  const window = await MaintenanceWindow.findById(id);
  if (!window) throw ApiError.notFound('Không tìm thấy maintenance window.');
  ['message', 'scope', 'status'].forEach((field) => {
    if (payload[field] !== undefined) window[field] = payload[field];
  });
  if (payload.starts_at !== undefined) window.starts_at = new Date(payload.starts_at);
  if (payload.ends_at !== undefined) window.ends_at = payload.ends_at ? new Date(payload.ends_at) : undefined;
  ['allow_webhooks', 'allow_health_check', 'allow_emergency', 'allow_admin_bypass'].forEach((field) => {
    if (payload[field] !== undefined) window[field] = Boolean(payload[field]);
  });
  ['allowed_actor_types', 'allowed_roles', 'allowed_permissions'].forEach((field) => {
    if (payload[field] !== undefined) window[field] = Array.isArray(payload[field]) ? payload[field] : csv(payload[field]);
  });
  if (payload.metadata) window.metadata = { ...(window.metadata || {}), ...payload.metadata };
  await window.save();
  await recordOpsAudit(auth, 'operations.maintenance.update', 'maintenance_window', window._id, { scope: window.scope }, requestMeta);
  return serialize(window);
}

async function previewMaintenance(payload = {}) {
  const scope = payload.scope || 'global';
  const message = payload.message || 'Hệ thống đang bảo trì. Vui lòng quay lại sau.';
  return {
    scope,
    patient_portal_banner: scope === 'global' || scope === 'patient_portal' ? message : null,
    staff_workspace_banner: message,
    api_response: {
      status: 503,
      body: {
        success: false,
        message,
        code: 'MAINTENANCE_MODE',
      },
    },
    mobile_app_message: message,
    affected_routes: affectedMaintenanceRoutes(scope),
  };
}

function affectedMaintenanceRoutes(scope) {
  const map = {
    global: ['/api/*'],
    patient_portal: ['/api/portal/*', '/api/records/me/*', '/api/patients/me/*'],
    billing: ['/api/billing/*', '/api/payments/*', '/api/billing-workspace/*'],
    clinical: ['/api/clinical/*', '/api/lab/*', '/api/imaging/*', '/api/procedures/*', '/api/orders/*'],
    pharmacy: ['/api/pharmacy/*', '/api/prescriptions/*'],
    scheduling: ['/api/appointments/*', '/api/schedules/*', '/api/queue/*'],
    admin: ['/api/admin/*', '/api/iam/*'],
    realtime: ['/socket.io/*'],
    payment_provider: ['/api/payments/*'],
    file_upload: ['/api/clinical-document-files/*', '/api/records/*'],
  };
  return map[scope] || [];
}

const SCHEDULING_ACTIVITY_MODULES = ['scheduling', 'schedule', 'schedules', 'schedule_slots', 'appointments', 'appointment', 'queue', 'settings', 'operations'];
const SCHEDULING_ACTIVITY_TARGETS = ['doctor_schedule', 'schedule_slot', 'appointment', 'queue_ticket', 'system_setting'];
const SCHEDULING_ACTIVITY_ACTION_REGEX = '^(schedule|schedules|schedule_slots|appointment|appointments|queue|scheduling_config|settings)\\.';

function dateRangeFilter(query = {}) {
  const range = {};
  if (query.date_from || query.from) {
    const from = new Date(query.date_from || query.from);
    if (Number.isNaN(from.getTime())) throw ApiError.badRequest('date_from không hợp lệ.');
    range.$gte = startOfDay(from);
  }
  if (query.date_to || query.to) {
    const to = new Date(query.date_to || query.to);
    if (Number.isNaN(to.getTime())) throw ApiError.badRequest('date_to không hợp lệ.');
    range.$lte = endOfDay(to);
  }
  return Object.keys(range).length ? { created_at: range } : {};
}

function activitySearchFilter(query = {}) {
  const keyword = String(query.keyword || query.search || query.q || '').trim();
  if (!keyword) return {};
  const pattern = escapeRegex(keyword);
  return {
    $or: [
      { action: { $regex: pattern, $options: 'i' } },
      { module_key: { $regex: pattern, $options: 'i' } },
      { target_type: { $regex: pattern, $options: 'i' } },
      { message: { $regex: pattern, $options: 'i' } },
      { request_id: { $regex: pattern, $options: 'i' } },
      { ip_address: { $regex: pattern, $options: 'i' } },
    ],
  };
}

function buildSchedulingActivityFilter(query = {}, scope = {}) {
  const targetTypes = scope.targetTypes || csv(query.target_type);
  const filters = [
    {
      $or: [
        { module_key: { $in: SCHEDULING_ACTIVITY_MODULES } },
        { target_type: { $in: SCHEDULING_ACTIVITY_TARGETS } },
        { action: { $regex: SCHEDULING_ACTIVITY_ACTION_REGEX } },
      ],
    },
    dateRangeFilter(query),
    activitySearchFilter(query),
  ].filter((item) => Object.keys(item).length > 0);

  if (targetTypes.length) {
    filters.push({ target_type: { $in: targetTypes } });
  }

  if (scope.actionRegex) {
    filters.push({ action: { $regex: scope.actionRegex, $options: 'i' } });
  } else if (query.action && query.action !== 'all') {
    filters.push({ action: { $regex: escapeRegex(query.action), $options: 'i' } });
  }

  if (query.status) filters.push({ status: query.status });
  if (query.severity) filters.push({ severity: query.severity });
  if (query.request_id) filters.push({ request_id: query.request_id });
  if (query.actor_id) filters.push({ actor_id: query.actor_id });

  if (filters.length === 0) return {};
  if (filters.length === 1) return filters[0];
  return { $and: filters };
}

function activityScope(scopeName) {
  const scopes = {
    all: {},
    doctorSchedules: { targetTypes: ['doctor_schedule'], actionRegex: 'schedule|schedules' },
    appointments: { targetTypes: ['appointment'], actionRegex: 'appointment|appointments' },
    slots: { targetTypes: ['schedule_slot'], actionRegex: 'slot|schedule_slots' },
    queue: { targetTypes: ['queue_ticket'], actionRegex: 'queue' },
    checkIn: { targetTypes: ['appointment', 'queue_ticket'], actionRegex: 'check[_-]?in|checkin|queue\\.appointment|queue\\.check' },
  };
  return scopes[scopeName] || scopes.all;
}

async function actorNameMap(items = []) {
  const actorIds = uniqueIds(items.map((item) => item.actor_id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!actorIds.length) return new Map();
  const users = await User.find({ _id: { $in: actorIds } })
    .select('full_name username email employee_code')
    .lean()
    .catch(() => []);
  return new Map(users.map((user) => [
    toId(user._id),
    user.full_name || user.username || user.email || user.employee_code || toId(user._id),
  ]));
}

function serializeActivityLog(item = {}, actors = new Map()) {
  const actorId = toId(item.actor_id);
  const actorName = actors.get(actorId) || item.metadata?.actor_name || item.actor_type || 'System';
  return {
    audit_log_id: toId(item._id),
    id: toId(item._id),
    created_at: item.created_at,
    actor_type: item.actor_type,
    actor_id: actorId,
    actor_name: actorName,
    actor_role: item.metadata?.actor_role || item.actor_type,
    action: item.action,
    module_key: item.module_key,
    target_type: item.target_type,
    target_id: toId(item.target_id),
    target_label: item.metadata?.target_label || item.metadata?.label || item.message || toId(item.target_id) || item.target_type,
    status: item.status,
    severity: item.severity,
    message: item.message,
    request_id: item.request_id,
    session_id: toId(item.session_id),
    ip_address: item.ip_address,
    user_agent: item.user_agent,
    before: item.before,
    after: item.after,
    metadata: item.metadata,
  };
}

function activitySummary(items = []) {
  return {
    total: items.length,
    success: items.filter((item) => item.status === 'success').length,
    failed: items.filter((item) => item.status === 'failure' || item.status === 'failed').length,
    warning: items.filter((item) => item.severity === 'warning').length,
    critical: items.filter((item) => item.severity === 'critical').length,
    schedules: items.filter((item) => item.target_type === 'doctor_schedule').length,
    appointments: items.filter((item) => item.target_type === 'appointment').length,
    slots: items.filter((item) => item.target_type === 'schedule_slot').length,
    queue: items.filter((item) => item.target_type === 'queue_ticket').length,
    settings: items.filter((item) => item.target_type === 'system_setting' || item.action?.startsWith('settings.')).length,
  };
}

async function getOperationsActivity(query = {}, actor = {}, scopeName = 'all') {
  const { page, limit, skip } = pagination(query, 80);
  const filter = buildSchedulingActivityFilter(query, activityScope(scopeName));
  const sort = sortSpec(query, 'created_at');
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const actors = await actorNameMap(items);
  const serialized = items.map((item) => serializeActivityLog(item, actors));
  return {
    items: serialized,
    summary: activitySummary(serialized),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    generated_at: now().toISOString(),
    scope: scopeName,
  };
}

async function getOperationsActivityDetail(activityId, query = {}, actor = {}) {
  const baseFilter = buildSchedulingActivityFilter(query, activityScope('all'));
  const idClause = mongoose.Types.ObjectId.isValid(activityId)
    ? { _id: activityId }
    : { request_id: activityId };
  const filter = Object.keys(baseFilter).length ? { $and: [baseFilter, idClause] } : idClause;
  const item = await AuditLog.findOne(filter).lean();
  if (!item) throw ApiError.notFound('Không tìm thấy activity log.');
  const actors = await actorNameMap([item]);
  return serializeActivityLog(item, actors);
}

function activitiesToCsv(items = []) {
  const headers = ['created_at', 'actor_name', 'action', 'module_key', 'target_type', 'target_id', 'status', 'severity', 'ip_address', 'request_id'];
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...items.map((item) => headers.map((field) => quote(item[field])).join(',')),
  ].join('\n');
}

async function exportOperationsActivity(query = {}, actor = {}) {
  const result = await getOperationsActivity({ ...query, page: 1, limit: Math.min(Number(query.limit) || 1000, 1000) }, actor, query.scope || 'all');
  const format = String(query.format || 'json').toLowerCase();
  if (format === 'csv') {
    return {
      format,
      content_type: 'text/csv',
      filename: `scheduling_activity_${new Date().toISOString().slice(0, 10)}.csv`,
      content: activitiesToCsv(result.items),
    };
  }
  return { format: 'json', ...result };
}

module.exports = {
  getDashboard,
  getSchedulingDashboardToday,
  getSchedulingHourlyFlow,
  getOperationsQueueCurrent,
  getOperationsQueueBoard,
  getOperationsQueueToday,
  getOperationsQueueCallConsole,
  getOperationsQueueTransferCandidates,
  getOperationsQueueMissedNoShow,
  getOperationsQueueTicketContext,
  getOperationsQueueAvailableActions,
  getPatientFlowToday,
  getPatientFlowCheckInMonitor,
  getPatientFlowWaiting,
  getPatientFlowInConsultation,
  getPatientFlowNeedsAction,
  getPatientFlowCompleted,
  getPatientFlowContext,
  acknowledgePatientFlowAlert,
  getOperationsResourcesLoad,
  getOperationsResourceDepartments,
  getOperationsResourceDoctors,
  getOperationsResourceRooms,
  getOperationsDoctorLoad,
  getOperationsRoomStatus,
  getOperationsResourceAttention,
  acknowledgeResourceAttention,
  assignResourceAttention,
  resolveResourceAttention,
  getOperationsSlotsCapacity,
  getOperationsAlerts,
  getOperationsAlertsSummary,
  getOperationsAlertsByCategory,
  getOperationsAlertDetail,
  operationAlertAction,
  getHealth,
  getJobs,
  runJobNow,
  listJobRuns,
  getJobRun,
  retryJobRun,
  listQueues,
  getQueueStats,
  queueAction,
  listEventOutbox,
  getEventOutboxSummary,
  getEventOutboxDetail,
  retryEvent,
  replayEvent,
  unlockEvent,
  markEventDeadLetter,
  bulkRetryEvents,
  listDeadLetterEvents,
  retryPreview,
  listNotificationDeliveries,
  getNotificationDeliveriesSummary,
  getNotificationDeliveryDetail,
  retryNotificationDelivery,
  bulkRetryNotificationDeliveries,
  markNotificationDeliverySkipped,
  getNotificationFailureGroups,
  retryNotificationFailureGroup,
  getRealtimeStatus,
  listRealtimeRooms,
  resolveRealtimeRooms,
  testRealtimeEmit,
  listSocketPresence,
  disconnectSocket,
  pruneSocketPresence,
  listIdempotencyRecords,
  getIdempotencySummary,
  getIdempotencyRecord,
  unlockIdempotencyRecord,
  expireIdempotencyRecord,
  cleanupExpiredIdempotencyRecords,
  listQrTokens,
  getQrTokensSummary,
  getQrToken,
  revokeQrToken,
  bulkRevokeQrTokens,
  cleanupExpiredQrTokens,
  listFileScans,
  getFileScansSummary,
  getFileScanProviderHealth,
  bulkFileScanAction,
  getDiagnostics,
  runDiagnostics,
  listDiagnosticRuns,
  getDiagnosticRun,
  getMaintenance,
  startMaintenance,
  endMaintenance,
  updateMaintenance,
  previewMaintenance,
  getOperationsActivity,
  getOperationsActivityDoctorSchedules: (query, actor) => getOperationsActivity(query, actor, 'doctorSchedules'),
  getOperationsActivityAppointments: (query, actor) => getOperationsActivity(query, actor, 'appointments'),
  getOperationsActivitySlots: (query, actor) => getOperationsActivity(query, actor, 'slots'),
  getOperationsActivityQueue: (query, actor) => getOperationsActivity(query, actor, 'queue'),
  getOperationsActivityCheckIn: (query, actor) => getOperationsActivity(query, actor, 'checkIn'),
  getOperationsActivityDetail,
  exportOperationsActivity,
};
