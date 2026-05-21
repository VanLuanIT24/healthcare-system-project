const {
  AuditLog,
  BreakGlassAccess,
  ClinicalAlert,
  DiagnosticAlert,
  EmergencyCase,
  InpatientTask,
  JobRunLog,
  Notification,
  NotificationDelivery,
  SupportTicket,
} = require('../models');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;

const CLOSED_ALERT_STATUSES = new Set(['resolved', 'dismissed']);
const CLOSED_TICKET_STATUSES = new Set(['resolved', 'closed']);
const SENSITIVE_MODULES = new Set(['auth', 'access', 'records', 'patient', 'patients', 'medical_records', 'billing', 'pharmacy', 'documents', 'attachments']);
const SENSITIVE_TARGETS = new Set(['patient', 'medical_record', 'attachment', 'invoice', 'payment', 'break_glass_access', 'prescription', 'lab_result', 'imaging_report']);
const SECURITY_ACTION_PARTS = ['login', 'logout', 'password', 'session', 'mfa', 'otp', 'token', 'auth'];

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  return addDays(date, -((date.getDay() + 6) % 7));
}

function startOfMonth(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

function isoDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(normalizeNumber(value) * factor) / factor;
}

function percentage(part, total) {
  return total > 0 ? round((normalizeNumber(part) / normalizeNumber(total)) * 100, 2) : 0;
}

function average(values = []) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function percentile(values = [], pct = 90) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function minutesBetween(start, end = new Date()) {
  if (!start) return 0;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end || new Date()).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return round((endTime - startTime) / MS_PER_MINUTE, 1);
}

function buildRange(query = {}, fallback = '30d') {
  const now = new Date();
  if (query.date_from || query.from || query.date_to || query.to) {
    return {
      start: startOfDay(query.date_from || query.from || now),
      end: endOfDay(query.date_to || query.to || query.date_from || query.from || now),
    };
  }
  const range = String(query.period || query.range || fallback).toLowerCase();
  if (range === 'today') return { start: startOfDay(now), end: endOfDay(now) };
  if (range === '7d') return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (range === '30d') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (range === 'week') return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
  if (range === 'month') return { start: startOfMonth(now), end: endOfDay(now) };
  return { start: startOfDay(query.date || now), end: endOfDay(query.date || now) };
}

function buildPagination(query = {}, total = 0, defaultLimit = 30) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || defaultLimit), 1), 200);
  return {
    page,
    limit,
    total,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

function paginate(rows = [], query = {}, defaultLimit = 30) {
  const pagination = buildPagination(query, rows.length, defaultLimit);
  const start = (pagination.page - 1) * pagination.limit;
  return { items: rows.slice(start, start + pagination.limit), pagination };
}

function stringifyId(value) {
  return value ? String(value?._id || value) : null;
}

function personName(value, fallback = 'Chua ro') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.full_name || value.name || value.display_name || value.username || value.email || fallback;
}

function patientName(value) {
  if (!value) return 'Chua ro';
  return value.full_name || value.name || value.patient_name || value.display_name || value.phone || 'Chua ro';
}

function departmentName(value) {
  if (!value) return 'Chua ro';
  return value.department_name || value.name || value.code || 'Chua ro';
}

function groupCount(rows = [], key, fallback = 'unknown') {
  const map = new Map();
  rows.forEach((row) => {
    const value = row?.[key] || fallback;
    map.set(value, (map.get(value) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, [key]: label, count, value: count }));
}

function dayTrend(rows = [], dateKey = 'created_at') {
  const map = new Map();
  rows.forEach((row) => {
    const date = isoDate(row?.[dateKey]);
    if (!date) return;
    map.set(date, (map.get(date) || 0) + 1);
  });
  return Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, label: date, count, value: count }));
}

function baseCreatedMatch(range, query = {}) {
  const match = { created_at: { $gte: range.start, $lte: range.end } };
  if (query.status) match.status = query.status;
  if (query.severity) match.severity = query.severity;
  if (query.priority) match.priority = query.priority;
  if (query.department_id) {
    match.$or = [
      { department_id: query.department_id },
      { assigned_department_id: query.department_id },
    ];
  }
  return match;
}

function filterSearch(rows = [], query = {}, fields = []) {
  const term = String(query.search || '').trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) => fields.some((field) => String(row?.[field] || '').toLowerCase().includes(term)));
}

function isOpenAlert(status) {
  return !CLOSED_ALERT_STATUSES.has(String(status || '').toLowerCase());
}

function isBreached(row = {}) {
  const status = String(row.sla_status || row.status || '').toLowerCase();
  if (['breached', 'critical_ack_overdue'].includes(status)) return true;
  if (row.breached_at || row.sla_breached_at) return true;
  if (row.sla_due_at && !CLOSED_ALERT_STATUSES.has(status) && new Date(row.sla_due_at) < new Date()) return true;
  return false;
}

function riskLevelFromCount(count, warning = 1, danger = 5) {
  if (count >= danger) return 'danger';
  if (count >= warning) return 'warning';
  return 'good';
}

function alertDto(alert, type = 'diagnostic') {
  return {
    id: stringifyId(alert._id),
    alert_id: stringifyId(alert._id),
    alert_no: alert.alert_no || alert.rule_code || stringifyId(alert._id),
    type,
    source_type: alert.source_type,
    category: alert.category || alert.rule_code || alert.source_type,
    module: alert.module || (type === 'clinical' ? 'clinical' : undefined),
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    priority: alert.priority || (alert.severity === 'critical' ? 'critical' : 'normal'),
    status: alert.status,
    patient_id: stringifyId(alert.patient_id),
    patient_name: patientName(alert.patient_id),
    department_id: stringifyId(alert.department_id),
    department_name: departmentName(alert.department_id),
    assigned_user_id: stringifyId(alert.assigned_to_user_id),
    assigned_user_name: personName(alert.assigned_to_user_id),
    created_at: alert.created_at || alert.first_detected_at,
    first_detected_at: alert.first_detected_at || alert.created_at,
    acknowledged_at: alert.acknowledged_at,
    resolved_at: alert.resolved_at,
    dismissed_at: alert.dismissed_at,
    sla_due_at: alert.sla_due_at,
    breached_at: alert.breached_at,
    escalation_level: alert.escalation_level || (alert.status === 'escalated' ? 1 : 0),
    ack_minutes: alert.acknowledged_at ? minutesBetween(alert.first_detected_at || alert.created_at, alert.acknowledged_at) : null,
    open_minutes: isOpenAlert(alert.status) ? minutesBetween(alert.first_detected_at || alert.created_at) : null,
    sla_status: isBreached(alert) ? 'breached' : 'within_sla',
    risk_level: alert.severity === 'critical' || isBreached(alert) ? 'danger' : alert.severity === 'high' || alert.severity === 'warning' ? 'warning' : 'good',
  };
}

async function loadDiagnosticAlerts(query = {}) {
  const range = buildRange(query);
  const match = baseCreatedMatch(range, query);
  if (query.module) match.module = query.module;
  const docs = await DiagnosticAlert.find(match)
    .populate('patient_id', 'full_name name patient_code phone')
    .populate('department_id', 'name department_name department_code code')
    .populate('assigned_to_user_id', 'full_name username email')
    .sort({ created_at: -1 })
    .limit(1000)
    .lean();
  return docs.map((item) => alertDto(item, 'diagnostic'));
}

async function loadClinicalAlerts(query = {}) {
  const range = buildRange(query);
  const match = baseCreatedMatch(range, query);
  const docs = await ClinicalAlert.find(match)
    .populate('patient_id', 'full_name name patient_code phone')
    .populate('department_id', 'name department_name department_code code')
    .populate('assigned_to_user_id', 'full_name username email')
    .sort({ created_at: -1 })
    .limit(1000)
    .lean();
  return docs.map((item) => alertDto(item, 'clinical'));
}

function alertSummary(rows = []) {
  const ackMinutes = rows.map((row) => row.ack_minutes).filter(Number.isFinite);
  const open = rows.filter((row) => isOpenAlert(row.status));
  const breached = rows.filter((row) => row.sla_status === 'breached');
  return {
    total_alerts: rows.length,
    critical_alerts: rows.filter((row) => row.severity === 'critical' || row.priority === 'critical').length,
    open_alerts: open.length,
    unacknowledged: rows.filter((row) => !row.acknowledged_at && isOpenAlert(row.status)).length,
    acknowledged: rows.filter((row) => row.acknowledged_at || row.status === 'acknowledged').length,
    escalated: rows.filter((row) => row.status === 'escalated' || normalizeNumber(row.escalation_level) > 0).length,
    resolved: rows.filter((row) => row.status === 'resolved').length,
    dismissed: rows.filter((row) => row.status === 'dismissed').length,
    overdue: breached.length,
    median_acknowledge_minutes: round(percentile(ackMinutes, 50), 1),
    sla_compliance_rate: percentage(rows.length - breached.length, rows.length),
  };
}

async function getCriticalAlertsReport(query = {}) {
  let rows = [
    ...(await loadDiagnosticAlerts({ ...query, severity: query.severity || undefined })),
    ...(await loadClinicalAlerts({ ...query, severity: query.severity || undefined })),
  ].filter((row) => ['critical', 'high'].includes(row.severity) || row.priority === 'critical' || row.sla_status === 'breached');
  rows = filterSearch(rows, query, ['alert_no', 'title', 'message', 'patient_name', 'department_name', 'assigned_user_name']);
  const { items, pagination } = paginate(rows, query);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: alertSummary(rows),
    charts: {
      by_type: groupCount(rows, 'type'),
      by_department: groupCount(rows, 'department_name'),
      by_severity: groupCount(rows, 'severity'),
      by_status: groupCount(rows, 'status'),
      trend: dayTrend(rows),
      ack_bucket: groupCount(rows.map((row) => ({ bucket: row.ack_minutes == null ? 'Chua ack' : row.ack_minutes <= 15 ? '0-15 phut' : row.ack_minutes <= 60 ? '15-60 phut' : '>60 phut' })), 'bucket'),
    },
    boards: {
      new_alerts: rows.filter((row) => row.status === 'open').slice(0, 12),
      unacknowledged: rows.filter((row) => !row.acknowledged_at && isOpenAlert(row.status)).slice(0, 12),
      overdue: rows.filter((row) => row.sla_status === 'breached').slice(0, 12),
      escalated: rows.filter((row) => row.status === 'escalated').slice(0, 12),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/quality-risk/critical-alerts nen gom diagnostic + clinical alerts theo unified timeline/action schema.'],
  };
}

function breakGlassDto(item, relatedAuditLogs = []) {
  const startedAt = item.started_at || item.created_at;
  const endedAt = item.ended_at;
  const durationMinutes = minutesBetween(startedAt, endedAt || new Date());
  const hour = startedAt ? new Date(startedAt).getHours() : 12;
  const afterHours = hour < 7 || hour >= 18;
  const shortReason = String(item.reason || '').trim().length < 15;
  const activeTooLong = item.status === 'active' && durationMinutes > 60;
  return {
    id: stringifyId(item._id),
    access_id: stringifyId(item._id),
    patient_id: stringifyId(item.patient_id),
    patient_name: patientName(item.patient_id),
    accessed_by_user_id: stringifyId(item.accessed_by_user_id),
    accessed_by_user_name: personName(item.accessed_by_user_id),
    reason: item.reason,
    status: item.status,
    started_at: startedAt,
    ended_at: endedAt,
    duration_minutes: durationMinutes,
    audit_log_count: (item.audit_log_ids || []).length,
    ip_address: relatedAuditLogs[0]?.ip_address,
    user_agent: relatedAuditLogs[0]?.user_agent,
    after_hours: afterHours,
    risk_flags: [afterHours && 'Ngoai gio', shortReason && 'Ly do ngan', activeTooLong && 'Active qua lau'].filter(Boolean),
    risk_level: activeTooLong || shortReason ? 'danger' : afterHours ? 'warning' : 'good',
    audit_logs: relatedAuditLogs,
    metadata: item.metadata || {},
  };
}

async function getBreakGlassReport(query = {}) {
  const range = buildRange(query);
  const match = { started_at: { $gte: range.start, $lte: range.end } };
  if (query.status) match.status = query.status;
  if (query.patient_id) match.patient_id = query.patient_id;
  if (query.actor_id || query.user_id) match.accessed_by_user_id = query.actor_id || query.user_id;
  const docs = await BreakGlassAccess.find(match)
    .populate('patient_id', 'full_name name patient_code phone')
    .populate('accessed_by_user_id', 'full_name username email department_id')
    .sort({ started_at: -1 })
    .limit(1000)
    .lean();
  const auditIds = docs.flatMap((item) => item.audit_log_ids || []);
  const auditLogs = auditIds.length ? await AuditLog.find({ _id: { $in: auditIds } }).sort({ created_at: -1 }).lean() : [];
  const auditById = new Map(auditLogs.map((log) => [stringifyId(log._id), log]));
  let rows = docs.map((item) => breakGlassDto(item, (item.audit_log_ids || []).map((id) => auditById.get(stringifyId(id))).filter(Boolean)));
  rows = filterSearch(rows, query, ['patient_name', 'accessed_by_user_name', 'reason', 'status', 'ip_address']);
  const { items, pagination } = paginate(rows, query);
  const active = rows.filter((row) => row.status === 'active');
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_break_glass: rows.length,
      active_sessions: active.length,
      ended_sessions: rows.filter((row) => row.status === 'ended').length,
      today_sessions: rows.filter((row) => isoDate(row.started_at) === isoDate(new Date())).length,
      after_hours_sessions: rows.filter((row) => row.after_hours).length,
      long_active_sessions: active.filter((row) => row.duration_minutes > 60).length,
      audit_actions: rows.reduce((sum, row) => sum + normalizeNumber(row.audit_log_count), 0),
      suspicious_sessions: rows.filter((row) => row.risk_level === 'danger').length,
      average_duration_minutes: round(average(rows.map((row) => row.duration_minutes)), 1),
    },
    charts: {
      by_day: dayTrend(rows, 'started_at'),
      by_status: groupCount(rows, 'status'),
      by_user: groupCount(rows, 'accessed_by_user_name'),
      by_reason: groupCount(rows, 'reason'),
      duration_buckets: groupCount(rows.map((row) => ({ bucket: row.duration_minutes <= 15 ? '0-15 phut' : row.duration_minutes <= 60 ? '15-60 phut' : row.duration_minutes <= 120 ? '1-2 gio' : '>2 gio' })), 'bucket'),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/quality-risk/break-glass nen tinh suspicious_score, after-hours flag va actor department tu backend.'],
  };
}

function isSensitiveAudit(log = {}) {
  const action = String(log.action || '').toLowerCase();
  const moduleKey = String(log.module_key || '').toLowerCase();
  const targetType = String(log.target_type || '').toLowerCase();
  if (SENSITIVE_MODULES.has(moduleKey) || SENSITIVE_TARGETS.has(targetType)) return true;
  return /(read|view|access|export|download|print|release).*(patient|record|billing|invoice|payment|document|attachment|prescription)/.test(action);
}

function auditDto(log) {
  const sensitive = isSensitiveAudit(log);
  return {
    id: stringifyId(log._id),
    audit_log_id: stringifyId(log._id),
    actor_type: log.actor_type,
    actor_id: stringifyId(log.actor_id),
    actor_name: stringifyId(log.actor_id) || log.actor_type,
    action: log.action,
    module_key: log.module_key,
    target_type: log.target_type,
    target_id: stringifyId(log.target_id),
    status: log.status,
    severity: log.severity,
    message: log.message,
    request_id: log.request_id,
    session_id: stringifyId(log.session_id),
    ip_address: log.ip_address,
    user_agent: log.user_agent,
    created_at: log.created_at,
    sensitive,
    risk_note: log.status === 'failure' ? 'Thao tac that bai' : ['warning', 'error', 'critical'].includes(log.severity) ? 'Audit severity cao' : sensitive ? 'Truy cap nhay cam' : '',
    risk_level: log.status === 'failure' || ['error', 'critical'].includes(log.severity) ? 'danger' : log.severity === 'warning' || sensitive ? 'warning' : 'good',
    before: log.before,
    after: log.after,
    metadata: log.metadata,
  };
}

async function loadAuditRows(query = {}, options = {}) {
  const range = buildRange(query);
  const match = { created_at: { $gte: range.start, $lte: range.end } };
  if (query.status) match.status = query.status;
  if (query.severity) match.severity = query.severity;
  if (query.module) match.module_key = query.module;
  if (query.actor_type) match.actor_type = query.actor_type;
  if (query.actor_id) match.actor_id = query.actor_id;
  if (query.target_type) match.target_type = query.target_type;
  if (options.securityOnly) {
    match.$or = SECURITY_ACTION_PARTS.map((part) => ({ action: { $regex: part, $options: 'i' } }))
      .concat([{ module_key: 'auth' }, { module_key: 'security' }]);
  }
  const docs = await AuditLog.find(match).sort({ created_at: -1 }).limit(2000).lean();
  let rows = docs.map(auditDto);
  if (options.sensitiveOnly) rows = rows.filter((row) => row.sensitive);
  rows = filterSearch(rows, query, ['action', 'module_key', 'target_type', 'message', 'actor_id', 'ip_address', 'request_id']);
  return rows;
}

async function getSensitiveAccessReport(query = {}) {
  const rows = await loadAuditRows(query, { sensitiveOnly: true });
  const { items, pagination } = paginate(rows, query);
  const failed = rows.filter((row) => row.status === 'failure');
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      sensitive_access_count: rows.length,
      patient_record_access: rows.filter((row) => ['patient', 'medical_record'].includes(row.target_type)).length,
      billing_access: rows.filter((row) => ['billing', 'invoice', 'payment'].includes(row.module_key) || ['invoice', 'payment'].includes(row.target_type)).length,
      medication_access: rows.filter((row) => row.module_key === 'pharmacy' || row.target_type === 'prescription').length,
      document_access: rows.filter((row) => ['documents', 'attachments'].includes(row.module_key) || row.target_type === 'attachment').length,
      failed_sensitive_access: failed.length,
      warning_severity: rows.filter((row) => ['warning', 'error', 'critical'].includes(row.severity)).length,
      unique_actors: new Set(rows.map((row) => `${row.actor_type}:${row.actor_id}`)).size,
      unique_targets: new Set(rows.map((row) => `${row.target_type}:${row.target_id}`)).size,
    },
    charts: {
      by_module: groupCount(rows, 'module_key'),
      by_actor_type: groupCount(rows, 'actor_type'),
      by_target_type: groupCount(rows, 'target_type'),
      by_status: groupCount(rows, 'status'),
      by_hour: groupCount(rows.map((row) => ({ hour: row.created_at ? `${new Date(row.created_at).getHours()}h` : 'unknown' })), 'hour'),
      failed_trend: dayTrend(failed),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/quality-risk/sensitive-access nen phan loai sensitive access bang policy backend thay vi rule frontend.'],
  };
}

async function getSecurityAuditReport(query = {}) {
  const rows = await loadAuditRows(query, { securityOnly: true });
  const { items, pagination } = paginate(rows, query);
  const loginRows = rows.filter((row) => String(row.action || '').toLowerCase().includes('login'));
  const failed = rows.filter((row) => row.status === 'failure');
  const ipCounts = groupCount(failed, 'ip_address').sort((a, b) => b.count - a.count);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_security_events: rows.length,
      login_events: loginRows.length,
      successful_logins: loginRows.filter((row) => row.status === 'success').length,
      failed_logins: loginRows.filter((row) => row.status === 'failure').length,
      failed_rate: percentage(failed.length, rows.length),
      password_reset_events: rows.filter((row) => String(row.action || '').includes('password')).length,
      session_events: rows.filter((row) => String(row.action || '').includes('session')).length,
      suspicious_ip_count: ipCounts.filter((row) => row.count >= 3).length,
      top_failed_ip_count: ipCounts[0]?.count || 0,
    },
    charts: {
      by_day: dayTrend(rows),
      by_status: groupCount(rows, 'status'),
      by_severity: groupCount(rows, 'severity'),
      by_action: groupCount(rows, 'action'),
      failed_by_ip: ipCounts.slice(0, 12),
      by_hour: groupCount(rows.map((row) => ({ hour: row.created_at ? `${new Date(row.created_at).getHours()}h` : 'unknown' })), 'hour'),
    },
    insights: [
      ipCounts[0] ? `IP ${ipCounts[0].label} co ${ipCounts[0].count} su kien that bai.` : 'Chua co IP that bai noi bat.',
      failed.length ? `${failed.length} security/audit event that bai can xem lai.` : 'Khong co security failure trong ky.',
    ],
    items,
    pagination,
    backend_todo: ['GET /api/reports/quality-risk/security-audit nen tra by_device, suspicious_events va login history theo actor.'],
  };
}

function ticketDto(ticket) {
  const now = new Date();
  const isClosed = CLOSED_TICKET_STATUSES.has(String(ticket.status || '').toLowerCase());
  const overdue = ticket.sla_due_at && !isClosed && new Date(ticket.sla_due_at) < now;
  const resolutionMinutes = ticket.resolved_at ? minutesBetween(ticket.created_at, ticket.resolved_at) : null;
  return {
    id: stringifyId(ticket._id),
    ticket_id: stringifyId(ticket._id),
    ticket_code: ticket.ticket_code,
    patient_id: stringifyId(ticket.patient_id),
    patient_name: patientName(ticket.patient_id),
    created_by_actor_type: ticket.created_by_actor_type,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    assigned_department_id: stringifyId(ticket.assigned_department_id),
    assigned_department_name: departmentName(ticket.assigned_department_id),
    assigned_user_id: stringifyId(ticket.assigned_user_id),
    assigned_user_name: personName(ticket.assigned_user_id),
    sla_due_at: ticket.sla_due_at,
    sla_status: overdue ? 'breached' : isClosed ? 'closed' : 'within_sla',
    overdue_minutes: overdue ? minutesBetween(ticket.sla_due_at) : 0,
    created_at: ticket.created_at,
    resolved_at: ticket.resolved_at,
    closed_at: ticket.closed_at,
    resolution_minutes: resolutionMinutes,
    satisfaction_rating: ticket.satisfaction_rating,
    satisfaction_comment: ticket.satisfaction_comment,
    risk_level: overdue || ['urgent', 'high'].includes(ticket.priority) ? 'warning' : 'good',
    metadata: ticket.metadata || {},
  };
}

async function loadTickets(query = {}) {
  const range = buildRange(query);
  const match = { created_at: { $gte: range.start, $lte: range.end } };
  if (query.status) match.status = query.status;
  if (query.priority) match.priority = query.priority;
  if (query.category) match.category = query.category;
  if (query.department_id) match.assigned_department_id = query.department_id;
  const docs = await SupportTicket.find(match)
    .populate('patient_id', 'full_name name patient_code phone')
    .populate('assigned_department_id', 'name department_name department_code code')
    .populate('assigned_user_id', 'full_name username email')
    .sort({ created_at: -1 })
    .limit(1500)
    .lean();
  return filterSearch(docs.map(ticketDto), query, ['ticket_code', 'patient_name', 'category', 'subject', 'description', 'assigned_user_name', 'assigned_department_name']);
}

async function getSupportTicketsReport(query = {}) {
  const rows = await loadTickets(query);
  const { items, pagination } = paginate(rows, query);
  const closed = rows.filter((row) => row.resolved_at || row.closed_at);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_tickets: rows.length,
      open: rows.filter((row) => row.status === 'open').length,
      pending: rows.filter((row) => row.status === 'pending').length,
      in_progress: rows.filter((row) => row.status === 'in_progress').length,
      resolved: rows.filter((row) => row.status === 'resolved').length,
      closed: rows.filter((row) => row.status === 'closed').length,
      reopened: rows.filter((row) => row.status === 'reopened').length,
      urgent_high_priority: rows.filter((row) => ['urgent', 'high'].includes(row.priority)).length,
      sla_overdue: rows.filter((row) => row.sla_status === 'breached').length,
      average_resolution_minutes: round(average(closed.map((row) => row.resolution_minutes)), 1),
      assigned_tickets: rows.filter((row) => row.assigned_user_id).length,
      unassigned_tickets: rows.filter((row) => !row.assigned_user_id).length,
    },
    charts: {
      by_status: groupCount(rows, 'status'),
      by_category: groupCount(rows, 'category'),
      by_priority: groupCount(rows, 'priority'),
      by_department: groupCount(rows, 'assigned_department_name'),
      by_assignee: groupCount(rows, 'assigned_user_name'),
      overdue_trend: dayTrend(rows.filter((row) => row.sla_status === 'breached'), 'sla_due_at'),
    },
    boards: {
      open: rows.filter((row) => row.status === 'open').slice(0, 12),
      pending: rows.filter((row) => row.status === 'pending').slice(0, 12),
      in_progress: rows.filter((row) => row.status === 'in_progress').slice(0, 12),
      overdue: rows.filter((row) => row.sla_status === 'breached').slice(0, 12),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/quality-risk/support-tickets nen tinh SLA overdue, resolution time va conversation summary backend-side.'],
  };
}

async function getComplaintsRatingsReport(query = {}) {
  const rows = await loadTickets(query);
  const complaintRows = rows.filter((row) => ['complaint', 'other'].includes(row.category) || normalizeNumber(row.satisfaction_rating) <= 2 || String(row.satisfaction_comment || '').trim());
  const rated = rows.filter((row) => Number.isFinite(Number(row.satisfaction_rating)));
  const { items, pagination } = paginate(complaintRows, query);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_rated_tickets: rated.length,
      average_satisfaction_rating: round(average(rated.map((row) => row.satisfaction_rating)), 2),
      one_star_count: rated.filter((row) => row.satisfaction_rating === 1).length,
      two_star_count: rated.filter((row) => row.satisfaction_rating === 2).length,
      three_star_count: rated.filter((row) => row.satisfaction_rating === 3).length,
      four_star_count: rated.filter((row) => row.satisfaction_rating === 4).length,
      five_star_count: rated.filter((row) => row.satisfaction_rating === 5).length,
      negative_feedback_count: rated.filter((row) => normalizeNumber(row.satisfaction_rating) <= 2 || String(row.satisfaction_comment || '').trim()).length,
      complaint_tickets: complaintRows.length,
      complaint_unresolved: complaintRows.filter((row) => !CLOSED_TICKET_STATUSES.has(row.status)).length,
      complaint_sla_overdue: complaintRows.filter((row) => row.sla_status === 'breached').length,
    },
    charts: {
      rating_distribution: groupCount(rated, 'satisfaction_rating'),
      rating_by_day: dayTrend(rated, 'closed_at'),
      rating_by_category: groupCount(rated, 'category'),
      rating_by_department: groupCount(rated, 'assigned_department_name'),
      complaint_trend: dayTrend(complaintRows),
      negative_by_priority: groupCount(complaintRows.filter((row) => normalizeNumber(row.satisfaction_rating) <= 2), 'priority'),
    },
    insights: [
      complaintRows.length ? `${complaintRows.length} ticket co dau hieu complaint/negative feedback.` : 'Chua co complaint noi bat trong ky.',
      rated.length ? `Rating trung binh ${round(average(rated.map((row) => row.satisfaction_rating)), 2)}/5.` : 'Chua co rating trong ky.',
    ],
    items,
    pagination,
    backend_todo: ['GET /api/reports/quality-risk/complaints-ratings nen phan loai complaint bang category/keyword va tinh department score.'],
  };
}

function slaItem(module, entityType, row = {}) {
  const dueAt = row.sla_due_at || row.sla_next_due_at || row.due_at;
  const closed = CLOSED_ALERT_STATUSES.has(row.status) || CLOSED_TICKET_STATUSES.has(row.status) || ['done', 'cancelled', 'resolved', 'closed'].includes(row.status);
  const breached = row.sla_status === 'breached' || row.breached_at || row.sla_breached_at || (dueAt && !closed && new Date(dueAt) < new Date());
  const status = breached ? 'breached' : row.sla_status || (closed ? 'closed' : 'within_sla');
  return {
    id: `${module}:${stringifyId(row._id)}`,
    module,
    entity_type: entityType,
    entity_id: stringifyId(row._id),
    entity_code: row.alert_no || row.ticket_code || row.case_code || row.title || stringifyId(row._id),
    title: row.title || row.subject || row.case_code || row.action,
    priority: row.priority || row.severity || 'normal',
    status: row.status,
    sla_status: status,
    sla_due_at: dueAt,
    breached_at: row.breached_at || row.sla_breached_at,
    breach_minutes: breached ? minutesBetween(row.breached_at || row.sla_breached_at || dueAt) : 0,
    owner: personName(row.assigned_to_user_id || row.assigned_user_id || row.assigned_to),
    department: departmentName(row.department_id || row.assigned_department_id),
    patient: patientName(row.patient_id),
    created_at: row.created_at,
    suggested_action: breached ? 'Can uu tien xu ly va escalate neu chua co owner.' : 'Theo doi trong SLA.',
    risk_level: breached ? 'danger' : ['warning', 'at_risk'].includes(status) ? 'warning' : 'good',
  };
}

async function getSlaReport(query = {}) {
  const range = buildRange(query);
  const createdMatch = { created_at: { $gte: range.start, $lte: range.end } };
  const [diagnosticAlerts, clinicalAlerts, tickets, emergencyCases, tasks] = await Promise.all([
    DiagnosticAlert.find(createdMatch).populate('patient_id', 'full_name name').populate('department_id', 'name department_name').populate('assigned_to_user_id', 'full_name username').limit(600).lean(),
    ClinicalAlert.find(createdMatch).populate('patient_id', 'full_name name').populate('department_id', 'name department_name').populate('assigned_to_user_id', 'full_name username').limit(600).lean(),
    SupportTicket.find(createdMatch).populate('patient_id', 'full_name name').populate('assigned_department_id', 'name department_name').populate('assigned_user_id', 'full_name username').limit(600).lean(),
    EmergencyCase.find(createdMatch).populate('patient_id', 'full_name name').populate('assigned_department_id', 'name department_name').populate('assigned_to_user_id', 'full_name username').limit(600).lean(),
    InpatientTask.find(createdMatch).populate('patient_id', 'full_name name').populate('assigned_to', 'full_name username').limit(600).lean(),
  ]);
  let rows = [
    ...diagnosticAlerts.map((row) => slaItem('diagnostic', 'diagnostic_alert', row)),
    ...clinicalAlerts.map((row) => slaItem('clinical', 'clinical_alert', row)),
    ...tickets.map((row) => slaItem('support', 'support_ticket', row)),
    ...emergencyCases.map((row) => slaItem('emergency', 'emergency_case', row)),
    ...tasks.map((row) => slaItem('inpatient', 'inpatient_task', row)),
  ].filter((row) => row.sla_due_at || row.breached_at || row.sla_status === 'breached');
  if (query.module) rows = rows.filter((row) => row.module === query.module);
  if (query.priority) rows = rows.filter((row) => row.priority === query.priority);
  if (query.sla_status) rows = rows.filter((row) => row.sla_status === query.sla_status);
  rows = filterSearch(rows, query, ['module', 'entity_type', 'entity_code', 'title', 'patient', 'owner', 'department']);
  const { items, pagination } = paginate(rows.sort((a, b) => normalizeNumber(b.breach_minutes) - normalizeNumber(a.breach_minutes)), query);
  const breached = rows.filter((row) => row.sla_status === 'breached');
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_sla_items: rows.length,
      within_sla: rows.filter((row) => ['within_sla', 'on_time', 'normal'].includes(row.sla_status)).length,
      at_risk: rows.filter((row) => ['warning', 'at_risk'].includes(row.sla_status)).length,
      breached: breached.length,
      escalated: rows.filter((row) => row.sla_status === 'escalated' || row.status === 'escalated').length,
      completed: rows.filter((row) => ['completed', 'closed', 'resolved', 'done'].includes(row.sla_status) || ['resolved', 'closed', 'done'].includes(row.status)).length,
      sla_compliance_rate: percentage(rows.length - breached.length, rows.length),
      critical_breach_count: breached.filter((row) => ['critical', 'high', 'urgent'].includes(row.priority)).length,
      average_breach_minutes: round(average(breached.map((row) => row.breach_minutes)), 1),
      longest_breach_minutes: Math.max(0, ...breached.map((row) => normalizeNumber(row.breach_minutes))),
    },
    charts: {
      by_module: groupCount(rows, 'module'),
      by_status: groupCount(rows, 'sla_status'),
      by_priority: groupCount(rows, 'priority'),
      breach_trend: dayTrend(breached, 'sla_due_at'),
      breach_buckets: groupCount(breached.map((row) => ({ bucket: row.breach_minutes <= 30 ? '0-30 phut' : row.breach_minutes <= 120 ? '30-120 phut' : row.breach_minutes <= 1440 ? '2-24 gio' : '>24 gio' })), 'bucket'),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/quality-risk/sla nen gom SLA tu emergency, clinical-order, diagnostic, support, inpatient, pharmacy bang schema chung.'],
  };
}

async function getJobFailureReport(query = {}) {
  const range = buildRange(query);
  const match = { started_at: { $gte: range.start, $lte: range.end } };
  if (query.status) match.status = query.status;
  if (query.job_name) match.job_name = { $regex: query.job_name, $options: 'i' };
  if (query.queue_name) match.queue_name = { $regex: query.queue_name, $options: 'i' };
  if (query.correlation_id) match.correlation_id = query.correlation_id;
  const docs = await JobRunLog.find(match).sort({ started_at: -1 }).limit(2000).lean();
  let rows = docs.map((row) => ({
    id: stringifyId(row._id),
    job_run_id: stringifyId(row._id),
    job_name: row.job_name,
    queue_name: row.queue_name,
    job_id: row.job_id,
    status: row.status,
    started_at: row.started_at,
    finished_at: row.finished_at,
    duration_ms: row.duration_ms,
    duration_seconds: round(normalizeNumber(row.duration_ms) / 1000, 1),
    attempt: row.attempt,
    records_processed: row.records_processed,
    worker_id: row.worker_id,
    correlation_id: row.correlation_id,
    error_message: row.error_message,
    error_stack: row.error_stack,
    result: row.result,
    risk_level: row.status === 'failed' ? 'danger' : row.status === 'running' ? 'warning' : 'good',
  }));
  rows = filterSearch(rows, query, ['job_name', 'queue_name', 'job_id', 'worker_id', 'correlation_id', 'error_message']);
  const failed = rows.filter((row) => row.status === 'failed');
  const { items, pagination } = paginate(rows, query);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_job_runs: rows.length,
      running: rows.filter((row) => row.status === 'running').length,
      success: rows.filter((row) => row.status === 'success').length,
      failed: failed.length,
      failure_rate: percentage(failed.length, rows.length),
      retry_attempts: rows.reduce((sum, row) => sum + Math.max(normalizeNumber(row.attempt) - 1, 0), 0),
      average_duration_seconds: round(average(rows.map((row) => row.duration_seconds)), 1),
      p95_duration_seconds: round(percentile(rows.map((row) => row.duration_seconds), 95), 1),
      records_processed: rows.reduce((sum, row) => sum + normalizeNumber(row.records_processed), 0),
      most_failed_job_count: groupCount(failed, 'job_name').sort((a, b) => b.count - a.count)[0]?.count || 0,
    },
    charts: {
      by_day: dayTrend(rows, 'started_at'),
      by_status: groupCount(rows, 'status'),
      by_job: groupCount(failed, 'job_name'),
      by_queue: groupCount(failed, 'queue_name'),
      duration_by_job: groupCount(rows.map((row) => ({ job_name: row.job_name, count: row.duration_seconds, value: row.duration_seconds })), 'job_name'),
    },
    items,
    pagination,
    backend_todo: ['Endpoint nay da doc truc tiep JobRunLog. Co the mo rong thanh /api/admin/job-runs neu can thao tac retry/correlation drilldown.'],
  };
}

async function getNotificationDeliveryReport(query = {}) {
  const range = buildRange(query);
  const match = { created_at: { $gte: range.start, $lte: range.end } };
  if (query.status) match.status = query.status;
  if (query.channel) match.channel = query.channel;
  if (query.priority) match.priority = query.priority;
  if (query.notification_type) match.notification_type = query.notification_type;
  const [notifications, deliveries] = await Promise.all([
    Notification.find(match).sort({ created_at: -1 }).limit(1500).lean(),
    NotificationDelivery.find({ created_at: { $gte: range.start, $lte: range.end }, ...(query.provider ? { provider: query.provider } : {}) }).sort({ created_at: -1 }).limit(1500).lean(),
  ]);
  const deliveryByNotification = new Map();
  deliveries.forEach((delivery) => {
    const key = stringifyId(delivery.notification_id);
    if (!deliveryByNotification.has(key)) deliveryByNotification.set(key, []);
    deliveryByNotification.get(key).push(delivery);
  });
  let rows = notifications.map((row) => {
    const rowDeliveries = deliveryByNotification.get(stringifyId(row._id)) || [];
    const failedDelivery = rowDeliveries.find((delivery) => delivery.status === 'failed');
    return {
      id: stringifyId(row._id),
      notification_id: stringifyId(row._id),
      recipient_type: row.recipient_type,
      channel: row.channel,
      notification_type: row.notification_type,
      event_type: row.event_type,
      priority: row.priority,
      title: row.title,
      message: row.message,
      status: row.status,
      scheduled_at: row.scheduled_at,
      sent_at: row.sent_at,
      delivered_at: row.delivered_at,
      read_at: row.read_at,
      failed_at: row.failed_at,
      failure_reason: row.failure_reason || failedDelivery?.last_error,
      created_at: row.created_at,
      delivery_attempt_count: rowDeliveries.reduce((sum, delivery) => sum + normalizeNumber(delivery.attempt_count), 0),
      delivery_statuses: rowDeliveries.map((delivery) => delivery.status),
      providers: rowDeliveries.map((delivery) => delivery.provider).filter(Boolean),
      risk_level: row.status === 'failed' || failedDelivery ? 'danger' : row.status === 'queued' ? 'warning' : 'good',
      payload: row.payload || row.data,
    };
  });
  if (query.provider) rows = rows.filter((row) => row.providers.includes(query.provider));
  rows = filterSearch(rows, query, ['title', 'message', 'notification_type', 'event_type', 'failure_reason', 'channel', 'status']);
  const failed = rows.filter((row) => row.status === 'failed' || row.failure_reason);
  const delivered = rows.filter((row) => row.delivered_at || row.status === 'delivered');
  const { items, pagination } = paginate(rows, query);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_notifications: rows.length,
      queued: rows.filter((row) => row.status === 'queued').length,
      sent: rows.filter((row) => row.status === 'sent').length,
      delivered: delivered.length,
      read: rows.filter((row) => row.read_at || row.status === 'read').length,
      failed: failed.length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length,
      delivery_rate: percentage(delivered.length, rows.length),
      read_rate: percentage(rows.filter((row) => row.read_at || row.status === 'read').length, rows.length),
      failure_rate: percentage(failed.length, rows.length),
      retry_pending: deliveries.filter((delivery) => delivery.status === 'failed' && delivery.next_attempt_at).length,
      scheduled_future: rows.filter((row) => row.scheduled_at && new Date(row.scheduled_at) > new Date()).length,
    },
    charts: {
      by_status: groupCount(rows, 'status'),
      by_channel: groupCount(rows, 'channel'),
      by_priority: groupCount(rows, 'priority'),
      by_provider: groupCount(deliveries, 'provider'),
      failed_by_reason: groupCount(failed, 'failure_reason'),
      delivery_trend: dayTrend(rows, 'sent_at'),
      read_trend: dayTrend(rows.filter((row) => row.read_at), 'read_at'),
    },
    panels: {
      failed_recent: failed.slice(0, 15),
      retry_queue: rows.filter((row) => row.status === 'failed' && row.delivery_attempt_count > 0).slice(0, 15),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/quality-risk/notification-delivery nen tra delivery_by_provider, failure_by_reason va attempt timeline truc tiep.'],
  };
}

async function getQualityRiskDashboard(query = {}) {
  const [criticalAlerts, breakGlass, sensitiveAccess, securityAudit, supportTickets, complaints, sla, jobFailure, notificationDelivery] = await Promise.all([
    getCriticalAlertsReport({ ...query, limit: 12 }),
    getBreakGlassReport({ ...query, limit: 12 }),
    getSensitiveAccessReport({ ...query, limit: 12 }),
    getSecurityAuditReport({ ...query, limit: 12 }),
    getSupportTicketsReport({ ...query, limit: 12 }),
    getComplaintsRatingsReport({ ...query, limit: 12 }),
    getSlaReport({ ...query, limit: 12 }),
    getJobFailureReport({ ...query, limit: 12 }),
    getNotificationDeliveryReport({ ...query, limit: 12 }),
  ]);
  const riskInputs = [
    criticalAlerts.summary.overdue * 8,
    criticalAlerts.summary.unacknowledged * 4,
    breakGlass.summary.active_sessions * 6,
    sensitiveAccess.summary.failed_sensitive_access * 5,
    securityAudit.summary.failed_logins * 2,
    supportTickets.summary.sla_overdue * 3,
    sla.summary.breached * 4,
    jobFailure.summary.failed * 3,
    notificationDelivery.summary.failed * 2,
  ];
  const riskScore = Math.min(100, Math.round(riskInputs.reduce((sum, value) => sum + normalizeNumber(value), 0)));
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      critical_alerts_open: criticalAlerts.summary.open_alerts,
      critical_overdue: criticalAlerts.summary.overdue,
      clinical_alerts: criticalAlerts.items.filter((row) => row.type === 'clinical').length,
      break_glass_active: breakGlass.summary.active_sessions,
      sensitive_access: sensitiveAccess.summary.sensitive_access_count,
      audit_warning_error: sensitiveAccess.items.filter((row) => ['warning', 'error', 'critical'].includes(row.severity)).length,
      login_failure: securityAudit.summary.failed_logins,
      support_ticket_open: supportTickets.summary.open,
      support_ticket_overdue: supportTickets.summary.sla_overdue,
      average_rating: complaints.summary.average_satisfaction_rating,
      sla_breached: sla.summary.breached,
      notification_failed: notificationDelivery.summary.failed,
      job_failed: jobFailure.summary.failed,
      risk_score: riskScore,
    },
    risk_panels: [
      { key: 'patient_safety', label: 'Patient safety risk', score: Math.min(100, criticalAlerts.summary.overdue * 10 + criticalAlerts.summary.unacknowledged * 4), status: riskLevelFromCount(criticalAlerts.summary.overdue, 1, 5) },
      { key: 'security_privacy', label: 'Security/privacy risk', score: Math.min(100, breakGlass.summary.active_sessions * 8 + sensitiveAccess.summary.failed_sensitive_access * 8), status: riskLevelFromCount(sensitiveAccess.summary.failed_sensitive_access + breakGlass.summary.active_sessions, 1, 5) },
      { key: 'operational_sla', label: 'Operational SLA risk', score: Math.min(100, sla.summary.breached * 6), status: riskLevelFromCount(sla.summary.breached, 1, 8) },
      { key: 'service_quality', label: 'Support/service quality risk', score: Math.min(100, supportTickets.summary.sla_overdue * 6 + complaints.summary.negative_feedback_count * 4), status: riskLevelFromCount(supportTickets.summary.sla_overdue + complaints.summary.negative_feedback_count, 1, 8) },
      { key: 'system_reliability', label: 'System reliability risk', score: Math.min(100, jobFailure.summary.failed * 8 + notificationDelivery.summary.failed * 3), status: riskLevelFromCount(jobFailure.summary.failed + notificationDelivery.summary.failed, 1, 8) },
    ],
    charts: {
      risk_by_module: [
        { label: 'Critical alerts', value: criticalAlerts.summary.overdue + criticalAlerts.summary.unacknowledged },
        { label: 'Break-glass', value: breakGlass.summary.active_sessions },
        { label: 'Sensitive access', value: sensitiveAccess.summary.failed_sensitive_access },
        { label: 'Support SLA', value: supportTickets.summary.sla_overdue },
        { label: 'Job failure', value: jobFailure.summary.failed },
        { label: 'Notification failed', value: notificationDelivery.summary.failed },
      ],
      alert_severity: criticalAlerts.charts.by_severity,
      sla_status: sla.charts.by_status,
      audit_severity: securityAudit.charts.by_severity,
      support_priority: supportTickets.charts.by_priority,
      notification_channel: notificationDelivery.charts.by_channel,
    },
    action_center: {
      critical_unacknowledged: criticalAlerts.boards.unacknowledged || [],
      break_glass_active: breakGlass.items.filter((row) => row.status === 'active').slice(0, 10),
      audit_warning_error: sensitiveAccess.items.filter((row) => ['warning', 'error', 'critical'].includes(row.severity)).slice(0, 10),
      ticket_sla_overdue: supportTickets.items.filter((row) => row.sla_status === 'breached').slice(0, 10),
      notification_failed: notificationDelivery.panels.failed_recent || [],
      job_failed: jobFailure.items.filter((row) => row.status === 'failed').slice(0, 10),
    },
    backend_todo: ['GET /api/reports/quality-risk/dashboard nen gom risk score, trend va worklist tu cac module bang mot response report-friendly.'],
  };
}

module.exports = {
  getQualityRiskDashboard,
  getCriticalAlertsReport,
  getBreakGlassReport,
  getSensitiveAccessReport,
  getSecurityAuditReport,
  getSupportTicketsReport,
  getComplaintsRatingsReport,
  getSlaReport,
  getJobFailureReport,
  getNotificationDeliveryReport,
};
