const mongoose = require('mongoose');
const ApiError = require('../../common/errors/api-error');
const permissionService = require('../permission.service');
const workerHealthService = require('../worker-health.service');
const workspaceAccessService = require('../workspace-access.service');
const realtimeService = require('../../realtime/realtime.service');
const presenceService = require('../../realtime/presence.service');
const { PERMISSION } = require('../../constants/permissions');
const {
  AUDIT_STATUS,
  EVENT_OUTBOX_STATUS,
  IDEMPOTENCY_STATUS,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_STATUS,
  PAYMENT_INTENT_STATUS,
  SUPPORT_TICKET_STATUS,
  USER_STATUS,
} = require('../../constants/statuses');
const {
  Appointment,
  Attachment,
  AuditLog,
  AuthSession,
  BreakGlassAccess,
  Department,
  DiagnosticAlert,
  DoctorProfile,
  Encounter,
  EventOutbox,
  IdempotencyRecord,
  Invoice,
  JobRunLog,
  Notification,
  NotificationDelivery,
  PatientProfileChangeRequest,
  PaymentIntent,
  Permission,
  PharmacyAlert,
  ProviderWebhookEvent,
  QrToken,
  Role,
  SupportTicket,
  User,
  UserRole,
} = require('../../models');

const ACTIVE_ALERT_STATUSES = ['new', 'open', 'acknowledged', 'assigned', 'in_progress', 'escalated'];
const ACTIVE_DIAGNOSTIC_STATUSES = ['open', 'acknowledged', 'assigned', 'in_progress', 'escalated'];
const ACTIVE_SUPPORT_STATUSES = [
  SUPPORT_TICKET_STATUS.OPEN,
  SUPPORT_TICKET_STATUS.WAITING_STAFF,
  SUPPORT_TICKET_STATUS.WAITING_PATIENT,
].filter(Boolean);

const COMMAND_PERMISSIONS = {
  READ: 'command_center.read',
  MANAGE: 'command_center.manage',
  EXPORT: 'command_center.export',
  VIEW_SECURITY: 'command_center.view_security',
  VIEW_OPS: 'command_center.view_ops',
  RETRY_OPS: 'command_center.retry_ops',
  MANAGE_ALERTS: 'command_center.manage_alerts',
  FORCE_LOGOUT: 'command_center.force_logout',
  MAINTENANCE: 'command_center.maintenance',
  VIEW_WORKSPACE_MAP: 'command_center.view_workspace_map',
};

function now() {
  return new Date();
}

function hoursAgo(hours) {
  return new Date(Date.now() - Number(hours || 0) * 60 * 60 * 1000);
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function stringifyId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
}

function cleanObjectId(value, label = 'id') {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`${label} không hợp lệ.`);
  }
  return value;
}

function actorUserId(auth = {}) {
  return auth.userId || auth.user_id || auth.user?._id || auth.actorId || auth.actor_id || null;
}

function actorType(auth = {}) {
  return auth.actorType || auth.actor_type || 'staff';
}

function actorRoles(auth = {}) {
  return Array.isArray(auth.roles) ? auth.roles : [];
}

function hasCommandPermission(auth = {}, permissionCode) {
  return permissionService.hasPermission(auth, permissionCode)
    || permissionService.hasPermission(auth, PERMISSION.SYSTEM.FULL_ACCESS);
}

function permissionsSnapshot(auth = {}) {
  const roles = actorRoles(auth);
  const isSuperAdmin = roles.includes('super_admin') || permissionService.hasPermission(auth, PERMISSION.SYSTEM.FULL_ACCESS);
  const isAdmin = roles.includes('admin') || isSuperAdmin;
  const isManager = roles.includes('manager') || isAdmin;

  return {
    can_read: isManager || hasCommandPermission(auth, COMMAND_PERMISSIONS.READ),
    can_manage: isAdmin || hasCommandPermission(auth, COMMAND_PERMISSIONS.MANAGE),
    can_export: isManager || hasCommandPermission(auth, COMMAND_PERMISSIONS.EXPORT) || permissionService.hasPermission(auth, PERMISSION.REPORTS.EXPORT),
    can_manage_security: isAdmin || hasCommandPermission(auth, COMMAND_PERMISSIONS.VIEW_SECURITY) || permissionService.hasPermission(auth, PERMISSION.AUDIT_LOGS.READ_SECURITY),
    can_view_ops: isAdmin || hasCommandPermission(auth, COMMAND_PERMISSIONS.VIEW_OPS) || permissionService.hasPermission(auth, PERMISSION.AUDIT_LOGS.READ),
    can_retry_jobs: isAdmin || hasCommandPermission(auth, COMMAND_PERMISSIONS.RETRY_OPS) || permissionService.hasPermission(auth, PERMISSION.NOTIFICATIONS.RETRY),
    can_force_logout: isAdmin || hasCommandPermission(auth, COMMAND_PERMISSIONS.FORCE_LOGOUT) || permissionService.hasPermission(auth, PERMISSION.USERS.FORCE_LOGOUT),
    can_enable_maintenance: isSuperAdmin || hasCommandPermission(auth, COMMAND_PERMISSIONS.MAINTENANCE),
    can_view_workspace_map: isManager || hasCommandPermission(auth, COMMAND_PERMISSIONS.VIEW_WORKSPACE_MAP),
  };
}

async function countByStatus(Model, statuses = [], baseFilter = {}) {
  const pairs = await Promise.all(statuses.map(async (status) => [
    status,
    await Model.countDocuments({ ...baseFilter, status }),
  ]));
  return Object.fromEntries(pairs);
}

async function countRecent(Model, filter = {}, hours = 24) {
  return Model.countDocuments({
    ...filter,
    created_at: { $gte: hoursAgo(hours) },
  });
}

function severityWeight(severity) {
  return {
    critical: 4,
    high: 3,
    warning: 2,
    medium: 2,
    low: 1,
    info: 0,
  }[String(severity || '').toLowerCase()] ?? 0;
}

function normalizeSeverity(value, fallback = 'medium') {
  const normalized = String(value || fallback).toLowerCase();
  if (normalized === 'warning') return 'medium';
  if (['critical', 'high', 'medium', 'low', 'info'].includes(normalized)) return normalized;
  return fallback;
}

function statusFromCounts({ critical = 0, high = 0, failed = 0, warning = 0, pending = 0 } = {}) {
  if (safeNumber(critical) > 0 || safeNumber(failed) >= 10) return 'critical';
  if (safeNumber(high) > 0 || safeNumber(failed) > 0 || safeNumber(warning) > 0 || safeNumber(pending) >= 100) return 'degraded';
  return 'healthy';
}

function summarizeOverall(inputs = {}) {
  const scores = [
    inputs.health_status,
    inputs.worker_status,
    inputs.security_status,
    inputs.workspace_status,
  ];
  if (scores.includes('critical')) return 'critical';
  if (scores.includes('degraded')) return 'degraded';
  return 'healthy';
}

function metricCard(key, label, value, options = {}) {
  return {
    key,
    label,
    value: safeNumber(value),
    status: options.status || 'healthy',
    tone: options.tone || options.status || 'neutral',
    helper: options.helper || '',
    route: options.route || null,
    action: options.action || null,
  };
}

function alertItem({
  id,
  severity = 'medium',
  component,
  alert_type,
  title,
  message,
  source_id = null,
  source_type = null,
  count = 1,
  status = 'open',
  created_at = null,
  last_seen_at = null,
  actions = [],
  workspace_code = 'admin',
  metadata = {},
}) {
  return {
    id,
    severity: normalizeSeverity(severity),
    component,
    alert_type,
    title,
    message,
    source_id: stringifyId(source_id),
    source_type,
    count: safeNumber(count),
    status,
    created_at,
    last_seen_at,
    workspace_code,
    actions,
    metadata,
  };
}

function workItem({
  id,
  source_module,
  source_type,
  source_id,
  title,
  description,
  severity = 'medium',
  status = 'new',
  workspace_code = 'admin',
  sla_due_at = null,
  created_at = null,
  updated_at = null,
  assignee = null,
  source_route = null,
  actions = [],
  metadata = {},
}) {
  return {
    id,
    source_module,
    source_type,
    source_id: stringifyId(source_id),
    title,
    description,
    severity: normalizeSeverity(severity),
    status,
    workspace_code,
    sla_due_at,
    created_at,
    updated_at,
    assignee,
    source_route,
    actions,
    metadata,
  };
}

async function getAdminSummary(auth = {}) {
  const [staff, totalDepartments, activeDepartments, totalDoctors, activeDoctors, totalRoles, totalPermissions, activeSessions] = await Promise.all([
    Promise.all([
      User.countDocuments({ is_deleted: false }),
      User.countDocuments({ is_deleted: false, status: USER_STATUS.ACTIVE }),
      User.countDocuments({ is_deleted: false, status: USER_STATUS.LOCKED }),
      User.countDocuments({ is_deleted: false, status: USER_STATUS.DISABLED }),
      User.countDocuments({ is_deleted: false, status: USER_STATUS.SUSPENDED }),
    ]),
    Department.countDocuments({ is_deleted: false }),
    Department.countDocuments({ is_deleted: false, status: 'active' }),
    DoctorProfile.countDocuments({ is_deleted: false }),
    DoctorProfile.countDocuments({ is_deleted: false, status: 'active' }),
    Role.countDocuments({ is_deleted: false }),
    Permission.countDocuments({ is_deleted: false }),
    AuthSession.countDocuments({ actor_type: 'staff', revoked_at: null, expires_at: { $gt: now() } }),
  ]);

  return {
    total_staff: staff[0],
    active_staff: staff[1],
    locked_staff: staff[2],
    disabled_staff: staff[3],
    suspended_staff: staff[4],
    total_departments: totalDepartments,
    active_departments: activeDepartments,
    total_doctors: totalDoctors,
    active_doctors: activeDoctors,
    total_roles: totalRoles,
    total_permissions: totalPermissions,
    active_staff_sessions: activeSessions,
    permissions: permissionsSnapshot(auth),
  };
}

async function getSchedulingSnapshot() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [appointmentsToday, checkinsToday, activeEncounters] = await Promise.all([
    Appointment.countDocuments({ appointment_time: { $gte: todayStart, $lte: todayEnd } }).catch(() => 0),
    Appointment.countDocuments({ checkin_at: { $gte: todayStart, $lte: todayEnd } }).catch(() => 0),
    Encounter.countDocuments({ status: { $in: ['checked_in', 'in_progress', 'active'] } }).catch(() => 0),
  ]);

  return { appointments_today: appointmentsToday, checkins_today: checkinsToday, active_encounters: activeEncounters };
}

async function getBillingSnapshot() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [unpaidInvoices, todayInvoices, manualReview, failedWebhooks] = await Promise.all([
    Invoice.countDocuments({ status: { $in: ['issued', 'partially_paid', 'overdue'] }, balance_due: { $gt: 0 } }).catch(() => 0),
    Invoice.aggregate([
      { $match: { created_at: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } },
    ]).catch(() => []),
    PaymentIntent.countDocuments({
      status: { $in: [PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION, PAYMENT_INTENT_STATUS.MANUAL_REVIEW, PAYMENT_INTENT_STATUS.REQUIRES_ACTION] },
    }).catch(() => 0),
    ProviderWebhookEvent.countDocuments({ status: 'failed', received_at: { $gte: hoursAgo(24) } }).catch(() => 0),
  ]);

  return {
    unpaid_invoices: unpaidInvoices,
    revenue_today: todayInvoices?.[0]?.total || 0,
    manual_payment_pending: manualReview,
    failed_webhooks_24h: failedWebhooks,
  };
}

async function getOpsSnapshot() {
  const [
    workerHealth,
    outboxCounts,
    deliveryCounts,
    notificationCounts,
    failedJobs24h,
    webhookFailed24h,
    idempotencyFailed24h,
    scanFailed24h,
    qrExpired24h,
  ] = await Promise.all([
    workerHealthService.getWorkerHealth(),
    countByStatus(EventOutbox, [
      EVENT_OUTBOX_STATUS.PENDING,
      EVENT_OUTBOX_STATUS.PROCESSING,
      EVENT_OUTBOX_STATUS.FAILED,
      EVENT_OUTBOX_STATUS.DEAD_LETTER,
      EVENT_OUTBOX_STATUS.PUBLISHED,
    ]),
    countByStatus(NotificationDelivery, [
      NOTIFICATION_DELIVERY_STATUS.PENDING,
      NOTIFICATION_DELIVERY_STATUS.SENT,
      NOTIFICATION_DELIVERY_STATUS.DELIVERED,
      NOTIFICATION_DELIVERY_STATUS.FAILED,
      NOTIFICATION_DELIVERY_STATUS.SKIPPED,
    ]),
    countByStatus(Notification, [
      NOTIFICATION_STATUS.QUEUED,
      NOTIFICATION_STATUS.SENT,
      NOTIFICATION_STATUS.DELIVERED,
      NOTIFICATION_STATUS.READ,
      NOTIFICATION_STATUS.FAILED,
      NOTIFICATION_STATUS.CANCELLED,
    ]),
    countRecent(JobRunLog, { status: 'failed' }, 24),
    countRecent(ProviderWebhookEvent, { status: 'failed' }, 24),
    countRecent(IdempotencyRecord, { status: IDEMPOTENCY_STATUS.FAILED }, 24),
    countRecent(Attachment, { scan_status: 'failed' }, 24),
    QrToken.countDocuments({ expires_at: { $gte: hoursAgo(24), $lte: now() }, used_at: null, revoked_at: null }).catch(() => 0),
  ]);

  const failed = safeNumber(outboxCounts.failed)
    + safeNumber(outboxCounts.dead_letter)
    + safeNumber(deliveryCounts.failed)
    + safeNumber(notificationCounts.failed)
    + safeNumber(failedJobs24h)
    + safeNumber(webhookFailed24h)
    + safeNumber(scanFailed24h);

  return {
    worker_health: workerHealth,
    outbox: outboxCounts,
    notification_delivery: deliveryCounts,
    notifications: notificationCounts,
    failed_jobs_24h: failedJobs24h,
    failed_webhooks_24h: webhookFailed24h,
    failed_idempotency_24h: idempotencyFailed24h,
    failed_file_scans_24h: scanFailed24h,
    expired_qr_tokens_24h: qrExpired24h,
    status: statusFromCounts({
      critical: safeNumber(outboxCounts.dead_letter),
      failed,
      pending: safeNumber(outboxCounts.pending) + safeNumber(deliveryCounts.pending) + safeNumber(notificationCounts.queued),
    }),
  };
}

async function getSecuritySnapshot() {
  const failedLoginQuery = {
    created_at: { $gte: hoursAgo(24) },
    $or: [
      { action: { $regex: /login|auth/i } },
      { module_key: 'auth' },
    ],
    status: AUDIT_STATUS.FAILED,
  };

  const [lockedAccounts, failedLogins24h, permissionChanges24h, sensitiveAudit24h, activeBreakGlass, suspiciousAudit] = await Promise.all([
    User.countDocuments({ is_deleted: false, status: USER_STATUS.LOCKED }),
    AuditLog.countDocuments(failedLoginQuery),
    AuditLog.countDocuments({
      created_at: { $gte: hoursAgo(24) },
      action: { $regex: /role|permission|settings|password|force_logout|unlock/i },
    }),
    AuditLog.countDocuments({
      created_at: { $gte: hoursAgo(24) },
      severity: { $in: ['high', 'critical'] },
    }),
    BreakGlassAccess.countDocuments({ status: 'active' }).catch(() => 0),
    AuditLog.find({
      created_at: { $gte: hoursAgo(24) },
      $or: [
        failedLoginQuery,
        { severity: { $in: ['high', 'critical'] } },
        { action: { $regex: /break_glass|force_logout|unlock|reset_password|assign_roles|settings/i } },
      ],
    }).sort({ created_at: -1 }).limit(12).lean(),
  ]);

  const riskScore = Math.min(100, lockedAccounts * 4 + failedLogins24h * 2 + permissionChanges24h * 3 + activeBreakGlass * 25 + sensitiveAudit24h * 4);

  return {
    risk_score: riskScore,
    status: statusFromCounts({
      critical: activeBreakGlass + (riskScore >= 70 ? 1 : 0),
      high: lockedAccounts + permissionChanges24h,
      failed: failedLogins24h,
    }),
    locked_accounts: lockedAccounts,
    failed_logins_24h: failedLogins24h,
    permission_changes_24h: permissionChanges24h,
    sensitive_access_24h: sensitiveAudit24h,
    active_break_glass: activeBreakGlass,
    suspicious_events: suspiciousAudit,
  };
}

async function getActiveSessions(limit = 50) {
  const sessions = await AuthSession.find({
    actor_type: 'staff',
    revoked_at: null,
    expires_at: { $gt: now() },
  }).sort({ last_used_at: -1, created_at: -1 }).limit(Number(limit) || 50).lean();

  const userIds = sessions.map((item) => item.actor_id).filter(Boolean);
  const [users, userRoles] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('full_name username email department_id status last_login_at last_login_ip').lean(),
    UserRole.find({ user_id: { $in: userIds }, is_active: true }).select('user_id role_id').lean(),
  ]);
  const roleIds = [...new Set(userRoles.map((item) => stringifyId(item.role_id)).filter(Boolean))];
  const roles = await Role.find({ _id: { $in: roleIds } }).select('role_code role_name').lean();
  const departments = await Department.find({
    _id: { $in: users.map((user) => user.department_id).filter(Boolean) },
  }).select('department_name department_code').lean();

  const userMap = new Map(users.map((user) => [stringifyId(user._id), user]));
  const roleMap = new Map(roles.map((role) => [stringifyId(role._id), role]));
  const departmentMap = new Map(departments.map((department) => [stringifyId(department._id), department]));
  const rolesByUser = new Map();
  userRoles.forEach((item) => {
    const userId = stringifyId(item.user_id);
    const role = roleMap.get(stringifyId(item.role_id));
    if (!role) return;
    rolesByUser.set(userId, [...(rolesByUser.get(userId) || []), role.role_code]);
  });

  return sessions.map((session) => {
    const user = userMap.get(stringifyId(session.actor_id)) || {};
    const department = departmentMap.get(stringifyId(user.department_id)) || {};
    const presence = presenceService.getPresence('staff', session.actor_id);
    const riskScore = safeNumber(user.status === USER_STATUS.LOCKED ? 35 : 0)
      + safeNumber(session.last_ip && user.last_login_ip && session.last_ip !== user.last_login_ip ? 18 : 0)
      + safeNumber(session.expires_at && new Date(session.expires_at).getTime() - Date.now() < 30 * 60 * 1000 ? 8 : 0);

    return {
      session_id: stringifyId(session._id),
      user_id: stringifyId(session.actor_id),
      full_name: user.full_name || user.username || 'Không rõ nhân sự',
      username: user.username,
      email: user.email,
      roles: rolesByUser.get(stringifyId(session.actor_id)) || [],
      department_id: stringifyId(user.department_id),
      department_name: department.department_name || 'Chưa gán khoa/phòng',
      status: presence ? 'online' : 'active',
      socket_connected: Boolean(presence),
      socket_count: presence?.socket_count || 0,
      device_id: session.device_id,
      device_name: session.device_name || session.browser || session.os || 'Thiết bị chưa định danh',
      browser: session.browser,
      os: session.os,
      ip: session.last_ip || session.created_ip || session.ip_address,
      user_agent: session.user_agent,
      login_at: session.created_at,
      last_seen_at: presence?.last_seen_at || session.last_used_at || session.created_at,
      expires_at: session.expires_at,
      risk_score: Math.min(100, riskScore),
      current_workspace: null,
    };
  });
}

async function getRecentActivities(query = {}, auth = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 40, 1), 100);
  const filter = {};

  if (query.module) filter.module_key = query.module;
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  if (query.actor_id) filter.actor_id = query.actor_id;
  if (query.target_type) filter.target_type = query.target_type;
  if (query.search) {
    const text = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { action: { $regex: text, $options: 'i' } },
      { message: { $regex: text, $options: 'i' } },
      { request_id: { $regex: text, $options: 'i' } },
    ];
  }

  const items = await AuditLog.find(filter).sort({ created_at: -1 }).limit(limit).lean();
  return {
    items,
    summary: {
      total_loaded: items.length,
      failed: items.filter((item) => item.status === AUDIT_STATUS.FAILED).length,
      high_severity: items.filter((item) => ['high', 'critical'].includes(item.severity)).length,
      checked_at: now().toISOString(),
    },
    permissions: permissionsSnapshot(auth),
  };
}

async function buildSummaryCards({ admin, ops, security, scheduling, billing, workItemSummary }) {
  return [
    metricCard('api_health', 'API Health', 1, { status: 'healthy', helper: 'Express API online', route: '/admin/command-center/health' }),
    metricCard('database_health', 'Database Health', mongoose.connection.readyState === 1 ? 1 : 0, {
      status: mongoose.connection.readyState === 1 ? 'healthy' : 'critical',
      helper: mongoose.connection.readyState === 1 ? 'MongoDB connected' : 'MongoDB disconnected',
      route: '/admin/command-center/health',
    }),
    metricCard('worker_health', 'Worker Health', safeNumber(ops.failed_jobs_24h), {
      status: ops.status,
      helper: `${ops.failed_jobs_24h} job lỗi trong 24h`,
      route: '/admin/command-center/workers',
    }),
    metricCard('notification_failed', 'Notification failed', safeNumber(ops.notifications.failed) + safeNumber(ops.notification_delivery.failed), {
      status: safeNumber(ops.notifications.failed) + safeNumber(ops.notification_delivery.failed) > 0 ? 'degraded' : 'healthy',
      helper: 'Notification + delivery failed',
      route: '/admin/command-center/system-alerts',
    }),
    metricCard('dead_letter_events', 'Dead-letter Events', ops.outbox.dead_letter, {
      status: safeNumber(ops.outbox.dead_letter) > 0 ? 'critical' : 'healthy',
      helper: 'Event outbox dead-letter',
      route: '/admin/command-center/workers',
    }),
    metricCard('security_risk', 'Security Risk', security.risk_score, {
      status: security.status,
      helper: `${security.failed_logins_24h} đăng nhập lỗi / 24h`,
      route: '/admin/command-center/security-alerts',
    }),
    metricCard('active_staff_sessions', 'Active Staff Sessions', admin.active_staff_sessions, {
      status: 'healthy',
      helper: 'Phiên staff đang hiệu lực',
      route: '/admin/command-center/sessions',
    }),
    metricCard('pending_admin_tasks', 'Pending Admin Tasks', workItemSummary.total, {
      status: workItemSummary.critical > 0 ? 'critical' : workItemSummary.high > 0 ? 'degraded' : 'healthy',
      helper: `${workItemSummary.critical} critical, ${workItemSummary.overdue} quá SLA`,
      route: '/admin/command-center/tasks',
    }),
    metricCard('locked_staff', 'Tài khoản bị khóa', admin.locked_staff, {
      status: admin.locked_staff > 0 ? 'degraded' : 'healthy',
      helper: 'Nhân sự cần rà soát',
      route: '/admin/command-center/security-alerts',
    }),
    metricCard('appointments_today', 'Lịch hẹn hôm nay', scheduling.appointments_today, { status: 'healthy', helper: 'Scheduling signal' }),
    metricCard('unpaid_invoices', 'Hóa đơn còn nợ', billing.unpaid_invoices, {
      status: billing.unpaid_invoices > 0 ? 'degraded' : 'healthy',
      helper: 'Billing backlog',
    }),
    metricCard('revenue_today', 'Doanh thu hôm nay', billing.revenue_today, { status: 'healthy', helper: 'Tổng invoice hôm nay' }),
  ];
}

async function getWorkItems(query = {}, auth = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 80, 1), 200);
  const createdSince = query.hours ? hoursAgo(Number(query.hours)) : null;
  const baseCreatedFilter = createdSince ? { created_at: { $gte: createdSince } } : {};

  const [
    failedDeliveries,
    failedNotifications,
    outboxEvents,
    failedJobs,
    lockedUsers,
    breakGlass,
    paymentReviews,
    pharmacyAlerts,
    diagnosticAlerts,
    supportTickets,
    profileChanges,
    attachments,
  ] = await Promise.all([
    NotificationDelivery.find({ status: NOTIFICATION_DELIVERY_STATUS.FAILED, ...baseCreatedFilter }).sort({ updated_at: -1, created_at: -1 }).limit(20).lean(),
    Notification.find({ status: NOTIFICATION_STATUS.FAILED, ...baseCreatedFilter }).sort({ updated_at: -1, created_at: -1 }).limit(20).lean(),
    EventOutbox.find({ status: { $in: [EVENT_OUTBOX_STATUS.FAILED, EVENT_OUTBOX_STATUS.DEAD_LETTER] }, ...baseCreatedFilter }).sort({ updated_at: -1, created_at: -1 }).limit(30).lean(),
    JobRunLog.find({ status: 'failed', ...baseCreatedFilter }).sort({ started_at: -1 }).limit(20).lean(),
    User.find({ is_deleted: false, status: USER_STATUS.LOCKED }).select('full_name username email locked_until failed_login_attempts updated_at created_at').sort({ updated_at: -1 }).limit(20).lean(),
    BreakGlassAccess.find({ status: 'active' }).sort({ created_at: -1 }).limit(20).lean().catch(() => []),
    PaymentIntent.find({
      status: { $in: [PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION, PAYMENT_INTENT_STATUS.MANUAL_REVIEW, PAYMENT_INTENT_STATUS.REQUIRES_ACTION] },
    }).sort({ updated_at: -1, created_at: -1 }).limit(20).lean(),
    PharmacyAlert.find({ status: { $in: ACTIVE_ALERT_STATUSES } }).sort({ severity: 1, due_at: 1, created_at: -1 }).limit(20).lean().catch(() => []),
    DiagnosticAlert.find({ status: { $in: ACTIVE_DIAGNOSTIC_STATUSES } }).sort({ severity: 1, sla_due_at: 1, created_at: -1 }).limit(20).lean().catch(() => []),
    SupportTicket.find({ status: { $in: ACTIVE_SUPPORT_STATUSES } }).sort({ sla_due_at: 1, created_at: -1 }).limit(20).lean().catch(() => []),
    PatientProfileChangeRequest.find({ status: 'pending' }).sort({ created_at: -1 }).limit(20).lean().catch(() => []),
    Attachment.find({
      $or: [
        { scan_status: 'failed' },
        { review_status: 'pending' },
      ],
      status: { $ne: 'deleted' },
    }).sort({ created_at: -1 }).limit(20).lean().catch(() => []),
  ]);

  const items = [
    ...failedDeliveries.map((item) => workItem({
      id: `delivery:${item._id}`,
      source_module: 'ops',
      source_type: 'failed_notification_delivery',
      source_id: item._id,
      title: `Delivery ${item.channel || 'notification'} thất bại`,
      description: item.last_error || 'Provider/channel trả lỗi khi gửi notification.',
      severity: item.attempt_count >= item.max_attempt_count ? 'high' : 'medium',
      workspace_code: 'admin',
      created_at: item.created_at,
      updated_at: item.updated_at,
      actions: ['retry_notification_delivery', 'open_source'],
      metadata: { channel: item.channel, provider: item.provider, attempt_count: item.attempt_count },
    })),
    ...failedNotifications.map((item) => workItem({
      id: `notification:${item._id}`,
      source_module: 'ops',
      source_type: 'failed_notification',
      source_id: item._id,
      title: item.title || 'Notification thất bại',
      description: item.failure_reason || item.message || 'Notification đang ở trạng thái failed.',
      severity: item.priority === 'critical' ? 'critical' : item.priority === 'high' ? 'high' : 'medium',
      workspace_code: 'admin',
      created_at: item.created_at,
      updated_at: item.updated_at,
      actions: ['retry_notification', 'open_source'],
      metadata: { priority: item.priority, channel: item.channel, recipient_type: item.recipient_type },
    })),
    ...outboxEvents.map((item) => workItem({
      id: `outbox:${item._id}`,
      source_module: 'ops',
      source_type: item.status === EVENT_OUTBOX_STATUS.DEAD_LETTER ? 'dead_letter_event' : 'failed_event_outbox',
      source_id: item._id,
      title: `${item.event_type || 'Domain event'} ${item.status}`,
      description: item.last_error || 'Event outbox chưa publish thành công.',
      severity: item.status === EVENT_OUTBOX_STATUS.DEAD_LETTER ? 'critical' : 'high',
      workspace_code: 'admin',
      sla_due_at: item.next_retry_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
      actions: ['retry_event', 'open_source'],
      metadata: { aggregate_type: item.aggregate_type, aggregate_id: stringifyId(item.aggregate_id), retry_count: item.retry_count },
    })),
    ...failedJobs.map((item) => workItem({
      id: `job:${item._id}`,
      source_module: 'ops',
      source_type: 'failed_job',
      source_id: item._id,
      title: `${item.job_name || 'Worker job'} thất bại`,
      description: item.error_message || 'Job run kết thúc ở trạng thái failed.',
      severity: 'high',
      workspace_code: 'admin',
      created_at: item.started_at || item.created_at,
      updated_at: item.finished_at || item.updated_at,
      actions: ['view_failed_job', 'open_source'],
      metadata: { queue_name: item.queue_name, duration_ms: item.duration_ms, records_processed: item.records_processed },
    })),
    ...lockedUsers.map((item) => workItem({
      id: `locked-user:${item._id}`,
      source_module: 'security',
      source_type: 'locked_account',
      source_id: item._id,
      title: `${item.full_name || item.username} đang bị khóa`,
      description: `${safeNumber(item.failed_login_attempts)} lần đăng nhập lỗi. Cần kiểm tra trước khi mở khóa.`,
      severity: safeNumber(item.failed_login_attempts) >= 5 ? 'high' : 'medium',
      workspace_code: 'admin',
      created_at: item.updated_at || item.created_at,
      updated_at: item.updated_at,
      source_route: `/admin/staff/${item._id}`,
      actions: ['open_staff', 'unlock_account', 'force_logout'],
      metadata: { username: item.username, email: item.email, locked_until: item.locked_until },
    })),
    ...breakGlass.map((item) => workItem({
      id: `break-glass:${item._id}`,
      source_module: 'security',
      source_type: 'active_break_glass',
      source_id: item._id,
      title: 'Break-glass đang mở',
      description: item.reason || 'Có phiên truy cập khẩn cấp cần review.',
      severity: 'critical',
      workspace_code: 'admin',
      created_at: item.started_at || item.created_at,
      updated_at: item.updated_at,
      actions: ['open_audit_trail', 'resolve_security_alert'],
      metadata: item,
    })),
    ...paymentReviews.map((item) => workItem({
      id: `payment:${item._id}`,
      source_module: 'billing',
      source_type: 'manual_payment_pending',
      source_id: item._id,
      title: `Thanh toán ${item.intent_code || item._id} cần xác nhận`,
      description: item.manual_review_reason || item.failure_reason || 'Payment intent cần nhân sự billing rà soát.',
      severity: item.status === PAYMENT_INTENT_STATUS.MANUAL_REVIEW ? 'high' : 'medium',
      workspace_code: 'billing',
      sla_due_at: item.expires_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
      actions: ['open_source'],
      metadata: { amount: item.amount, provider: item.provider, method: item.method, status: item.status },
    })),
    ...pharmacyAlerts.map((item) => workItem({
      id: `pharmacy-alert:${item._id}`,
      source_module: 'pharmacy',
      source_type: item.alert_type,
      source_id: item._id,
      title: item.title,
      description: item.message || item.reason_code || 'Cảnh báo nhà thuốc đang mở.',
      severity: item.severity,
      status: item.status,
      workspace_code: 'pharmacy',
      sla_due_at: item.due_at,
      created_at: item.detected_at || item.created_at,
      updated_at: item.updated_at,
      actions: ['open_source', 'acknowledge'],
      metadata: { alert_code: item.alert_code, metrics: item.metrics },
    })),
    ...diagnosticAlerts.map((item) => workItem({
      id: `diagnostic-alert:${item._id}`,
      source_module: 'clinical',
      source_type: item.category,
      source_id: item._id,
      title: item.title,
      description: item.message || 'Cảnh báo cận lâm sàng đang mở.',
      severity: item.severity,
      status: item.status,
      workspace_code: 'lab',
      sla_due_at: item.sla_due_at,
      created_at: item.first_detected_at || item.created_at,
      updated_at: item.updated_at,
      actions: ['open_source', 'acknowledge'],
      metadata: { alert_no: item.alert_no, module: item.module, priority: item.priority },
    })),
    ...supportTickets.map((item) => workItem({
      id: `support-ticket:${item._id}`,
      source_module: 'support',
      source_type: 'support_ticket',
      source_id: item._id,
      title: item.subject || item.ticket_code || 'Support ticket',
      description: item.description || 'Ticket hỗ trợ đang chờ xử lý.',
      severity: item.priority === 'urgent' ? 'critical' : item.priority === 'high' ? 'high' : 'medium',
      status: item.status,
      workspace_code: 'admin',
      sla_due_at: item.sla_due_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
      actions: ['open_source', 'assign_to_me'],
      metadata: { ticket_code: item.ticket_code, category: item.category, priority: item.priority },
    })),
    ...profileChanges.map((item) => workItem({
      id: `profile-change:${item._id}`,
      source_module: 'portal',
      source_type: 'profile_change_request',
      source_id: item._id,
      title: `Yêu cầu đổi hồ sơ ${item.change_type || ''}`.trim(),
      description: item.reason || 'Bệnh nhân/người nhà gửi thay đổi hồ sơ cần review.',
      severity: 'medium',
      workspace_code: 'admin',
      created_at: item.created_at,
      updated_at: item.updated_at,
      actions: ['open_source', 'resolve'],
      metadata: { patient_id: stringifyId(item.patient_id), change_type: item.change_type },
    })),
    ...attachments.map((item) => workItem({
      id: `attachment:${item._id}`,
      source_module: 'portal',
      source_type: item.scan_status === 'failed' ? 'file_scan_failed' : 'document_review_pending',
      source_id: item._id,
      title: item.scan_status === 'failed' ? `File scan failed: ${item.original_name || item.file_name}` : `Tài liệu cần review: ${item.original_name || item.file_name}`,
      description: item.review_note || item.scan_result?.message || 'Tài liệu bệnh nhân/staff upload cần xử lý.',
      severity: item.scan_status === 'failed' ? 'high' : 'medium',
      workspace_code: 'admin',
      created_at: item.created_at,
      updated_at: item.updated_at,
      actions: ['open_source', 'resolve'],
      metadata: { scan_status: item.scan_status, review_status: item.review_status, source: item.source },
    })),
  ];

  const filtered = items
    .filter((item) => !query.module || item.source_module === query.module)
    .filter((item) => !query.workspace || item.workspace_code === query.workspace)
    .filter((item) => !query.severity || item.severity === query.severity)
    .filter((item) => !query.status || item.status === query.status)
    .filter((item) => !query.search || `${item.title} ${item.description} ${item.source_type}`.toLowerCase().includes(String(query.search).toLowerCase()))
    .sort((a, b) => {
      const severityDelta = severityWeight(b.severity) - severityWeight(a.severity);
      if (severityDelta) return severityDelta;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    })
    .slice(0, limit);

  const summary = summarizeWorkItems(filtered);
  return { items: filtered, summary, permissions: permissionsSnapshot(auth), checked_at: now().toISOString() };
}

function summarizeWorkItems(items = []) {
  const current = now().getTime();
  return {
    total: items.length,
    critical: items.filter((item) => item.severity === 'critical').length,
    high: items.filter((item) => item.severity === 'high').length,
    medium: items.filter((item) => item.severity === 'medium').length,
    low: items.filter((item) => item.severity === 'low').length,
    overdue: items.filter((item) => item.sla_due_at && new Date(item.sla_due_at).getTime() < current).length,
    assigned_to_me: items.filter((item) => item.assignee?.is_me).length,
    by_module: items.reduce((acc, item) => {
      acc[item.source_module] = safeNumber(acc[item.source_module]) + 1;
      return acc;
    }, {}),
  };
}

async function getSystemAlerts(query = {}, auth = {}) {
  const [ops, webhookFailed, idempotencyFailed, scanFailed, outboxRecent, deliveryRecent, jobRecent, webhookRecent] = await Promise.all([
    getOpsSnapshot(),
    ProviderWebhookEvent.countDocuments({ status: 'failed' }).catch(() => 0),
    IdempotencyRecord.countDocuments({ status: IDEMPOTENCY_STATUS.FAILED }).catch(() => 0),
    Attachment.countDocuments({ scan_status: 'failed' }).catch(() => 0),
    EventOutbox.find({ status: { $in: [EVENT_OUTBOX_STATUS.FAILED, EVENT_OUTBOX_STATUS.DEAD_LETTER] } }).sort({ updated_at: -1, created_at: -1 }).limit(20).lean(),
    NotificationDelivery.find({ status: NOTIFICATION_DELIVERY_STATUS.FAILED }).sort({ updated_at: -1, created_at: -1 }).limit(20).lean(),
    JobRunLog.find({ status: 'failed' }).sort({ started_at: -1 }).limit(20).lean(),
    ProviderWebhookEvent.find({ status: 'failed' }).sort({ received_at: -1 }).limit(20).lean().catch(() => []),
  ]);

  const alerts = [
    alertItem({
      id: 'summary:event-outbox-failed',
      severity: ops.outbox.dead_letter > 0 ? 'critical' : ops.outbox.failed > 0 ? 'high' : 'info',
      component: 'Event Outbox',
      alert_type: 'event_outbox_failed',
      title: 'Event outbox lỗi/dead-letter',
      message: `${ops.outbox.failed || 0} failed, ${ops.outbox.dead_letter || 0} dead-letter.`,
      count: safeNumber(ops.outbox.failed) + safeNumber(ops.outbox.dead_letter),
      actions: ['open_event_outbox', 'retry_event'],
    }),
    alertItem({
      id: 'summary:notification-failed',
      severity: ops.notification_delivery.failed > 0 || ops.notifications.failed > 0 ? 'high' : 'info',
      component: 'Notification Delivery',
      alert_type: 'notification_delivery_failed',
      title: 'Notification delivery thất bại',
      message: `${ops.notification_delivery.failed || 0} delivery failed, ${ops.notifications.failed || 0} notification failed.`,
      count: safeNumber(ops.notification_delivery.failed) + safeNumber(ops.notifications.failed),
      actions: ['open_failed_notifications', 'retry_notification'],
    }),
    alertItem({
      id: 'summary:failed-jobs',
      severity: ops.failed_jobs_24h > 0 ? 'high' : 'info',
      component: 'Worker Queue',
      alert_type: 'worker_job_failed',
      title: 'Worker job failed',
      message: `${ops.failed_jobs_24h} job lỗi trong 24h gần nhất.`,
      count: ops.failed_jobs_24h,
      actions: ['open_failed_jobs'],
    }),
    alertItem({
      id: 'summary:payment-webhook',
      severity: webhookFailed > 0 ? 'high' : 'info',
      component: 'Payment Webhook',
      alert_type: 'payment_webhook_failed',
      title: 'Payment webhook failed',
      message: `${webhookFailed} webhook event đang failed.`,
      count: webhookFailed,
      workspace_code: 'billing',
      actions: ['open_source', 'create_ticket'],
    }),
    alertItem({
      id: 'summary:file-scan',
      severity: scanFailed > 0 ? 'high' : 'info',
      component: 'File Scan',
      alert_type: 'file_scan_failed',
      title: 'File scan failed',
      message: `${scanFailed} file scan thất bại.`,
      count: scanFailed,
      actions: ['open_source'],
    }),
    alertItem({
      id: 'summary:idempotency',
      severity: idempotencyFailed > 0 ? 'medium' : 'info',
      component: 'Idempotency',
      alert_type: 'idempotency_failed',
      title: 'Idempotency conflict/failed',
      message: `${idempotencyFailed} idempotency record failed.`,
      count: idempotencyFailed,
      actions: ['open_source'],
    }),
    ...outboxRecent.map((item) => alertItem({
      id: `outbox:${item._id}`,
      severity: item.status === EVENT_OUTBOX_STATUS.DEAD_LETTER ? 'critical' : 'high',
      component: 'Event Outbox',
      alert_type: item.status,
      title: item.event_type || 'Outbox event lỗi',
      message: item.last_error || 'Event chưa publish thành công.',
      source_id: item._id,
      source_type: 'event_outbox',
      status: item.status,
      created_at: item.created_at,
      last_seen_at: item.updated_at || item.last_attempt_at,
      actions: ['retry_event'],
      metadata: { aggregate_type: item.aggregate_type, retry_count: item.retry_count },
    })),
    ...deliveryRecent.map((item) => alertItem({
      id: `delivery:${item._id}`,
      severity: item.attempt_count >= item.max_attempt_count ? 'high' : 'medium',
      component: 'Notification Delivery',
      alert_type: 'delivery_failed',
      title: `${item.channel || 'delivery'} failed`,
      message: item.last_error || 'Notification delivery failed.',
      source_id: item._id,
      source_type: 'notification_delivery',
      status: item.status,
      created_at: item.created_at,
      last_seen_at: item.updated_at || item.last_attempt_at,
      actions: ['retry_notification_delivery'],
      metadata: { provider: item.provider, attempt_count: item.attempt_count },
    })),
    ...jobRecent.map((item) => alertItem({
      id: `job:${item._id}`,
      severity: 'high',
      component: 'Worker Queue',
      alert_type: 'job_failed',
      title: item.job_name || 'Job failed',
      message: item.error_message || 'Job failed.',
      source_id: item._id,
      source_type: 'job_run_log',
      status: item.status,
      created_at: item.started_at || item.created_at,
      last_seen_at: item.finished_at || item.updated_at,
      actions: ['view_failed_job'],
      metadata: { queue_name: item.queue_name, records_processed: item.records_processed },
    })),
    ...webhookRecent.map((item) => alertItem({
      id: `webhook:${item._id}`,
      severity: 'high',
      component: 'Payment Webhook',
      alert_type: 'provider_webhook_failed',
      title: `${item.provider || 'Provider'} webhook failed`,
      message: item.error_message || item.event_type || 'Webhook xử lý thất bại.',
      source_id: item._id,
      source_type: 'provider_webhook_event',
      status: item.status,
      created_at: item.received_at || item.created_at,
      last_seen_at: item.updated_at || item.processed_at,
      workspace_code: 'billing',
      actions: ['open_source'],
      metadata: { event_id: item.event_id, transaction_ref: item.transaction_ref },
    })),
  ];

  const filtered = filterAlerts(alerts, query);
  return {
    items: filtered,
    summary: summarizeAlerts(filtered),
    permissions: permissionsSnapshot(auth),
    checked_at: now().toISOString(),
  };
}

async function getSecurityAlerts(query = {}, auth = {}) {
  const [security, lockedUsers, suspiciousLogs, sessions] = await Promise.all([
    getSecuritySnapshot(),
    User.find({ is_deleted: false, status: USER_STATUS.LOCKED }).select('full_name username email failed_login_attempts locked_until updated_at created_at').sort({ updated_at: -1 }).limit(30).lean(),
    AuditLog.find({
      created_at: { $gte: hoursAgo(72) },
      $or: [
        { status: AUDIT_STATUS.FAILED, action: { $regex: /login|auth|password/i } },
        { severity: { $in: ['high', 'critical'] } },
        { action: { $regex: /break_glass|force_logout|unlock|reset_password|assign_roles|permissions|settings/i } },
      ],
    }).sort({ created_at: -1 }).limit(40).lean(),
    getActiveSessions(80),
  ]);

  const riskySessions = sessions.filter((item) => item.risk_score >= 20);
  const alerts = [
    alertItem({
      id: 'summary:failed-login-spike',
      severity: security.failed_logins_24h >= 20 ? 'critical' : security.failed_logins_24h > 0 ? 'high' : 'info',
      component: 'Authentication',
      alert_type: 'failed_login_spike',
      title: 'Đăng nhập thất bại bất thường',
      message: `${security.failed_logins_24h} failed login/auth event trong 24h.`,
      count: security.failed_logins_24h,
      actions: ['open_audit', 'create_security_alert'],
    }),
    alertItem({
      id: 'summary:locked-accounts',
      severity: security.locked_accounts > 0 ? 'high' : 'info',
      component: 'IAM',
      alert_type: 'locked_accounts',
      title: 'Tài khoản bị khóa',
      message: `${security.locked_accounts} tài khoản staff đang locked.`,
      count: security.locked_accounts,
      actions: ['open_staff', 'unlock_account'],
    }),
    alertItem({
      id: 'summary:break-glass',
      severity: security.active_break_glass > 0 ? 'critical' : 'info',
      component: 'Break-glass',
      alert_type: 'active_break_glass',
      title: 'Break-glass active',
      message: `${security.active_break_glass} phiên break-glass đang mở.`,
      count: security.active_break_glass,
      actions: ['open_audit'],
    }),
    alertItem({
      id: 'summary:risky-sessions',
      severity: riskySessions.length > 0 ? 'high' : 'info',
      component: 'Sessions',
      alert_type: 'risky_sessions',
      title: 'Session có rủi ro',
      message: `${riskySessions.length} session có risk score >= 20.`,
      count: riskySessions.length,
      actions: ['force_logout', 'revoke_session'],
    }),
    ...lockedUsers.map((item) => alertItem({
      id: `locked-user:${item._id}`,
      severity: safeNumber(item.failed_login_attempts) >= 5 ? 'high' : 'medium',
      component: 'IAM',
      alert_type: 'locked_account',
      title: `${item.full_name || item.username} bị khóa`,
      message: `${safeNumber(item.failed_login_attempts)} failed login attempts.`,
      source_id: item._id,
      source_type: 'user',
      status: 'open',
      created_at: item.updated_at || item.created_at,
      actions: ['open_staff', 'unlock_account', 'force_logout'],
      metadata: { username: item.username, email: item.email, locked_until: item.locked_until },
    })),
    ...riskySessions.map((item) => alertItem({
      id: `session:${item.session_id}`,
      severity: item.risk_score >= 50 ? 'critical' : 'high',
      component: 'Session',
      alert_type: 'session_risk',
      title: `${item.full_name} có session rủi ro`,
      message: `${item.ip || 'IP unknown'} - ${item.device_name}. Risk score ${item.risk_score}.`,
      source_id: item.session_id,
      source_type: 'auth_session',
      status: 'open',
      created_at: item.login_at,
      last_seen_at: item.last_seen_at,
      actions: ['revoke_session', 'force_logout', 'open_audit'],
      metadata: item,
    })),
    ...suspiciousLogs.map((item) => alertItem({
      id: `audit:${item._id}`,
      severity: normalizeSeverity(item.severity, item.status === AUDIT_STATUS.FAILED ? 'high' : 'medium'),
      component: item.module_key || 'Audit',
      alert_type: item.action,
      title: item.message || item.action,
      message: `${item.actor_type || 'actor'} ${item.actor_id || ''}`.trim(),
      source_id: item._id,
      source_type: 'audit_log',
      status: item.status,
      created_at: item.created_at,
      actions: ['open_audit', 'filter_same_actor'],
      metadata: { request_id: item.request_id, ip: item.ip_address, target_type: item.target_type, target_id: stringifyId(item.target_id) },
    })),
  ];

  const filtered = filterAlerts(alerts, query);
  return {
    items: filtered,
    summary: {
      ...summarizeAlerts(filtered),
      risk_score: security.risk_score,
      active_suspicious_sessions: riskySessions.length,
      active_break_glass: security.active_break_glass,
      sensitive_access_24h: security.sensitive_access_24h,
    },
    security_snapshot: security,
    permissions: permissionsSnapshot(auth),
    checked_at: now().toISOString(),
  };
}

function filterAlerts(alerts = [], query = {}) {
  return alerts
    .filter((item) => !query.severity || item.severity === query.severity)
    .filter((item) => !query.component || String(item.component || '').toLowerCase().includes(String(query.component).toLowerCase()))
    .filter((item) => !query.status || item.status === query.status)
    .filter((item) => !query.workspace || item.workspace_code === query.workspace)
    .filter((item) => !query.search || `${item.title} ${item.message} ${item.alert_type}`.toLowerCase().includes(String(query.search).toLowerCase()))
    .filter((item) => item.count > 0 || item.source_id)
    .sort((a, b) => {
      const severityDelta = severityWeight(b.severity) - severityWeight(a.severity);
      if (severityDelta) return severityDelta;
      return new Date(b.last_seen_at || b.created_at || 0) - new Date(a.last_seen_at || a.created_at || 0);
    });
}

function summarizeAlerts(items = []) {
  return {
    total: items.length,
    critical: items.filter((item) => item.severity === 'critical').length,
    high: items.filter((item) => item.severity === 'high').length,
    medium: items.filter((item) => item.severity === 'medium').length,
    low: items.filter((item) => item.severity === 'low').length,
    resolved_today: items.filter((item) => item.status === 'resolved' && item.updated_at && new Date(item.updated_at) >= hoursAgo(24)).length,
    failed_24h: items.filter((item) => item.status === 'failed' || item.alert_type?.includes('failed')).length,
  };
}

async function getHealth(auth = {}) {
  const [ops, security] = await Promise.all([getOpsSnapshot(), getSecuritySnapshot()]);
  const io = realtimeService.getSocketServer();
  const dbHealthy = mongoose.connection.readyState === 1;

  const components = [
    {
      key: 'api',
      name: 'API Server',
      status: 'healthy',
      latency_ms: 0,
      last_checked_at: now().toISOString(),
      owner_module: 'platform',
      action: 'open_diagnostics',
    },
    {
      key: 'database',
      name: 'MongoDB',
      status: dbHealthy ? 'healthy' : 'critical',
      latency_ms: null,
      last_checked_at: now().toISOString(),
      last_error: dbHealthy ? null : 'Mongoose connection is not ready.',
      owner_module: 'database',
      action: 'open_diagnostics',
    },
    {
      key: 'realtime_socket',
      name: 'Realtime socket',
      status: io ? 'healthy' : 'degraded',
      connected_sockets: io?.engine?.clientsCount || 0,
      last_checked_at: now().toISOString(),
      owner_module: 'realtime',
      action: 'test_realtime',
    },
    {
      key: 'worker',
      name: 'Worker / Queue',
      status: ops.status,
      failed: ops.failed_jobs_24h,
      last_checked_at: now().toISOString(),
      owner_module: 'workers',
      action: 'open_failed_jobs',
    },
    {
      key: 'event_outbox',
      name: 'Event Outbox',
      status: statusFromCounts({ critical: ops.outbox.dead_letter, failed: ops.outbox.failed, pending: ops.outbox.pending }),
      pending: ops.outbox.pending || 0,
      failed: ops.outbox.failed || 0,
      dead_letter: ops.outbox.dead_letter || 0,
      last_checked_at: now().toISOString(),
      owner_module: 'events',
      action: 'open_dead_letter_events',
    },
    {
      key: 'notification_delivery',
      name: 'Notification Delivery',
      status: statusFromCounts({ failed: safeNumber(ops.notification_delivery.failed) + safeNumber(ops.notifications.failed), pending: ops.notification_delivery.pending }),
      pending: ops.notification_delivery.pending || 0,
      failed: safeNumber(ops.notification_delivery.failed) + safeNumber(ops.notifications.failed),
      delivered: ops.notification_delivery.delivered || 0,
      last_checked_at: now().toISOString(),
      owner_module: 'notifications',
      action: 'open_notification_failed',
    },
    {
      key: 'payment_webhook',
      name: 'Payment webhook',
      status: ops.failed_webhooks_24h > 0 ? 'degraded' : 'healthy',
      failed: ops.failed_webhooks_24h,
      last_checked_at: now().toISOString(),
      owner_module: 'billing',
      action: 'open_payment_webhook',
    },
    {
      key: 'file_scan',
      name: 'File scan',
      status: ops.failed_file_scans_24h > 0 ? 'degraded' : 'healthy',
      failed: ops.failed_file_scans_24h,
      last_checked_at: now().toISOString(),
      owner_module: 'records',
      action: 'open_file_scan',
    },
    {
      key: 'security',
      name: 'Security monitor',
      status: security.status,
      failed_login_24h: security.failed_logins_24h,
      active_break_glass: security.active_break_glass,
      last_checked_at: now().toISOString(),
      owner_module: 'security',
      action: 'open_security_alerts',
    },
  ];

  return {
    overall_status: summarizeOverall({
      health_status: components.some((item) => item.status === 'critical') ? 'critical' : components.some((item) => item.status === 'degraded') ? 'degraded' : 'healthy',
      worker_status: ops.status,
      security_status: security.status,
    }),
    checked_at: now().toISOString(),
    auto_refresh_options_seconds: [10, 30, 60],
    components,
    trends: {
      failed_jobs_24h: ops.failed_jobs_24h,
      failed_notifications_24h: safeNumber(ops.notification_delivery.failed) + safeNumber(ops.notifications.failed),
      outbox_failed_24h: safeNumber(ops.outbox.failed) + safeNumber(ops.outbox.dead_letter),
      api_error_audit_24h: await AuditLog.countDocuments({ created_at: { $gte: hoursAgo(24) }, status: AUDIT_STATUS.FAILED }),
      security_alert_count: security.sensitive_access_24h,
    },
    permissions: permissionsSnapshot(auth),
  };
}

async function getWorkers(query = {}, auth = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
  const [ops, jobs, outbox, deliveries, idempotency, qrTokens, fileScans] = await Promise.all([
    getOpsSnapshot(),
    JobRunLog.find({}).sort({ started_at: -1 }).limit(limit).lean(),
    EventOutbox.find({}).sort({ created_at: -1 }).limit(limit).lean(),
    NotificationDelivery.find({}).sort({ created_at: -1 }).limit(limit).lean(),
    IdempotencyRecord.find({}).sort({ created_at: -1 }).limit(limit).lean(),
    QrToken.find({}).sort({ created_at: -1 }).limit(limit).lean(),
    Attachment.find({ scan_status: { $in: ['pending', 'failed', 'infected'] } }).sort({ created_at: -1 }).limit(limit).lean(),
  ]);

  return {
    overall_worker_status: ops.status,
    summary: {
      outbox: ops.outbox,
      notification_delivery: ops.notification_delivery,
      notifications: ops.notifications,
      failed_jobs_24h: ops.failed_jobs_24h,
      failed_file_scans_24h: ops.failed_file_scans_24h,
      failed_idempotency_24h: ops.failed_idempotency_24h,
      expired_qr_tokens_24h: ops.expired_qr_tokens_24h,
    },
    tabs: {
      job_run_logs: jobs,
      event_outbox: outbox,
      notification_delivery: deliveries,
      idempotency_records: idempotency,
      qr_tokens: qrTokens,
      file_scans: fileScans,
    },
    checked_at: now().toISOString(),
    permissions: permissionsSnapshot(auth),
  };
}

function getRealtimeRoomSummary(io) {
  if (!io?.sockets?.adapter?.rooms) return [];
  const socketIds = new Set(io.sockets.sockets ? [...io.sockets.sockets.keys()] : []);
  return [...io.sockets.adapter.rooms.entries()]
    .filter(([room]) => !socketIds.has(room))
    .map(([room, sockets]) => ({
      room,
      type: String(room).split(':')[0] || 'custom',
      connected_sockets: sockets?.size || 0,
      last_activity_at: now().toISOString(),
      allowed_actor_types: room.startsWith('patient:') ? ['patient', 'patient_relative'] : ['staff'],
    }))
    .sort((a, b) => b.connected_sockets - a.connected_sockets)
    .slice(0, 100);
}

async function getRealtime(auth = {}) {
  const io = realtimeService.getSocketServer();
  const presence = typeof presenceService.getAllPresence === 'function' ? presenceService.getAllPresence() : [];
  const staffPresence = presence.filter((item) => item.actor_type === 'staff');
  const patientPresence = presence.filter((item) => ['patient', 'patient_relative'].includes(item.actor_type));
  const recentRealtimeEvents = await EventOutbox.find({
    event_type: { $regex: /notification|payment|queue|emergency|realtime|socket|presence|alert/i },
  }).sort({ created_at: -1 }).limit(30).lean();

  return {
    socket_status: io ? 'available' : 'unavailable',
    redis_realtime: 'not_configured',
    connected_clients: io?.engine?.clientsCount || 0,
    online_users: presence.length,
    online_staff: staffPresence.length,
    online_patients: patientPresence.length,
    active_rooms: io?.sockets?.adapter?.rooms?.size || 0,
    last_event_emitted: recentRealtimeEvents[0] || null,
    presence,
    rooms: getRealtimeRoomSummary(io),
    events_recent: recentRealtimeEvents,
    cards: [
      { key: 'socket_server', label: 'Socket server available', value: io ? 1 : 0, status: io ? 'healthy' : 'critical' },
      { key: 'connected_sockets', label: 'Connected sockets', value: io?.engine?.clientsCount || 0, status: 'healthy' },
      { key: 'online_staff', label: 'Online staff', value: staffPresence.length, status: 'healthy' },
      { key: 'online_patients', label: 'Online patients', value: patientPresence.length, status: 'healthy' },
      { key: 'active_rooms', label: 'Active rooms', value: io?.sockets?.adapter?.rooms?.size || 0, status: 'healthy' },
      { key: 'events_last_5m', label: 'Events last 5 minutes', value: recentRealtimeEvents.filter((item) => new Date(item.created_at) >= hoursAgo(5 / 60)).length, status: 'healthy' },
    ],
    checked_at: now().toISOString(),
    permissions: permissionsSnapshot(auth),
  };
}

async function getWorkspaceMap(auth = {}) {
  const [workItems, systemAlerts, securityAlerts, sessions, recentActivities] = await Promise.all([
    getWorkItems({ limit: 200 }, auth),
    getSystemAlerts({}, auth),
    getSecurityAlerts({}, auth),
    getActiveSessions(200),
    AuditLog.find({}).sort({ created_at: -1 }).limit(50).lean(),
  ]);

  const definitions = workspaceAccessService.WORKSPACE_DEFINITIONS || [];
  const available = workspaceAccessService.getAvailableWorkspaces(auth, { current_workspace: 'admin' }).available_workspaces || [];
  const availableSet = new Set(available.map((item) => item.code));
  const sessionsByWorkspace = sessions.reduce((acc, session) => {
    const workspace = session.current_workspace || 'admin';
    acc[workspace] = safeNumber(acc[workspace]) + 1;
    return acc;
  }, {});

  const map = definitions.map((workspace) => {
    const pendingTasks = workItems.items.filter((item) => item.workspace_code === workspace.code).length;
    const systemAlertCount = systemAlerts.items.filter((item) => item.workspace_code === workspace.code).length;
    const securityAlertCount = workspace.code === 'admin' ? securityAlerts.items.length : 0;
    const lastEvent = recentActivities.find((item) => {
      const moduleKey = String(item.module_key || item.action || '').toLowerCase();
      if (workspace.code === 'billing') return moduleKey.includes('billing') || moduleKey.includes('payment') || moduleKey.includes('invoice');
      if (workspace.code === 'pharmacy') return moduleKey.includes('pharmacy') || moduleKey.includes('dispense') || moduleKey.includes('inventory');
      if (workspace.code === 'lab') return moduleKey.includes('lab') || moduleKey.includes('imaging') || moduleKey.includes('procedure') || moduleKey.includes('clinical');
      if (workspace.code === 'scheduling' || workspace.code === 'reception') return moduleKey.includes('schedule') || moduleKey.includes('appointment') || moduleKey.includes('queue');
      return workspace.code === 'admin';
    });
    const alertCount = systemAlertCount + securityAlertCount;
    const status = alertCount > 5 || pendingTasks > 20 ? 'critical' : alertCount > 0 || pendingTasks > 0 ? 'degraded' : 'healthy';

    return {
      ...workspace,
      allowed: availableSet.has(workspace.code),
      status,
      pending_tasks: pendingTasks,
      alerts: alertCount,
      online_users: sessionsByWorkspace[workspace.code] || 0,
      last_activity: lastEvent?.created_at || null,
      last_event: lastEvent ? { action: lastEvent.action, message: lastEvent.message, created_at: lastEvent.created_at } : null,
      permission_prefixes: workspace.permissionPrefixes || [],
      actors: workspace.roles || [],
    };
  });

  const roles = await Role.find({ is_deleted: false }).select('role_code role_name').sort({ priority_level: -1 }).lean();
  const accessMatrix = map.map((workspace) => ({
    workspace_code: workspace.code,
    workspace_name: workspace.name,
    roles: roles.map((role) => ({
      role_code: role.role_code,
      role_name: role.role_name,
      access: workspace.roles?.includes(role.role_code) ? 'allowed' : 'limited',
    })),
  }));

  return {
    summary: {
      total_workspaces: map.length,
      available_to_me: map.filter((item) => item.allowed).length,
      with_alerts: map.filter((item) => item.alerts > 0).length,
      degraded: map.filter((item) => item.status === 'degraded').length,
      critical: map.filter((item) => item.status === 'critical').length,
    },
    workspaces: map,
    access_matrix: accessMatrix,
    dependencies: [
      { from: 'admin', to: 'scheduling', label: 'IAM + policy' },
      { from: 'scheduling', to: 'reception', label: 'appointment flow' },
      { from: 'reception', to: 'doctor', label: 'check-in' },
      { from: 'doctor', to: 'lab', label: 'orders' },
      { from: 'lab', to: 'billing', label: 'charges' },
      { from: 'doctor', to: 'pharmacy', label: 'prescriptions' },
      { from: 'pharmacy', to: 'billing', label: 'dispense charges' },
      { from: 'billing', to: 'reports', label: 'financial data' },
    ],
    checked_at: now().toISOString(),
    permissions: permissionsSnapshot(auth),
  };
}

async function getDashboard(auth = {}) {
  const [admin, ops, security, scheduling, billing, workItems, activities, sessions, realtime, workspaceMap] = await Promise.all([
    getAdminSummary(auth),
    getOpsSnapshot(),
    getSecuritySnapshot(),
    getSchedulingSnapshot(),
    getBillingSnapshot(),
    getWorkItems({ limit: 120 }, auth),
    getRecentActivities({ limit: 20 }, auth),
    getActiveSessions(20),
    getRealtime(auth),
    getWorkspaceMap(auth),
  ]);

  const summaryCards = await buildSummaryCards({
    admin,
    ops,
    security,
    scheduling,
    billing,
    workItemSummary: workItems.summary,
  });
  const criticalAlerts = [
    ...(await getSystemAlerts({}, auth)).items,
    ...(await getSecurityAlerts({}, auth)).items,
  ].filter((item) => ['critical', 'high'].includes(item.severity)).slice(0, 12);

  const overallStatus = summarizeOverall({
    worker_status: ops.status,
    security_status: security.status,
    workspace_status: workspaceMap.summary.critical > 0 ? 'critical' : workspaceMap.summary.degraded > 0 ? 'degraded' : 'healthy',
  });

  return {
    overall_status: overallStatus,
    checked_at: now().toISOString(),
    summary_cards: summaryCards,
    critical_alerts: criticalAlerts,
    workspace_health: workspaceMap.workspaces,
    work_items: workItems.items.slice(0, 30),
    work_item_summary: workItems.summary,
    security_snapshot: security,
    ops_snapshot: ops,
    scheduling_snapshot: scheduling,
    billing_snapshot: billing,
    recent_activities: activities.items,
    active_sessions: sessions,
    realtime,
    permissions: permissionsSnapshot(auth),
  };
}

async function getBootstrap(auth = {}) {
  return getDashboard(auth);
}

async function exportSnapshot(auth = {}) {
  const snapshot = await getDashboard(auth);
  return {
    exported_at: now().toISOString(),
    exported_by: {
      actor_type: actorType(auth),
      actor_id: stringifyId(actorUserId(auth)),
      roles: actorRoles(auth),
    },
    snapshot,
  };
}

async function recordCommandAudit(auth = {}, action, targetType, targetId, status = 'success', metadata = {}, requestMeta = {}) {
  return AuditLog.create({
    actor_type: actorType(auth),
    actor_id: actorUserId(auth),
    action,
    module_key: 'command_center',
    target_type: targetType,
    target_id: mongoose.Types.ObjectId.isValid(targetId) ? targetId : undefined,
    status,
    severity: status === 'failed' ? 'high' : 'info',
    message: action,
    request_id: requestMeta.requestId || requestMeta.request_id,
    session_id: auth.sessionId || auth.session_id,
    ip_address: requestMeta.ipAddress || requestMeta.ip_address,
    user_agent: requestMeta.userAgent || requestMeta.user_agent,
    metadata,
  }).catch(() => null);
}

async function acknowledgeVirtualItem(id, auth = {}, requestMeta = {}) {
  await recordCommandAudit(auth, 'command_center.work_item.acknowledge', 'admin_work_item', id, 'success', { virtual: true }, requestMeta);
  return { id, status: 'acknowledged', virtual: true, acknowledged_at: now().toISOString() };
}

async function updateVirtualItem(id, action, payload = {}, auth = {}, requestMeta = {}) {
  await recordCommandAudit(auth, `command_center.work_item.${action}`, 'admin_work_item', id, 'success', { virtual: true, payload }, requestMeta);
  return { id, status: action === 'resolve' ? 'resolved' : action === 'dismiss' ? 'dismissed' : action, virtual: true, updated_at: now().toISOString() };
}

async function updateVirtualAlert(id, action, payload = {}, auth = {}, requestMeta = {}) {
  await recordCommandAudit(auth, `command_center.alert.${action}`, 'system_alert', id, 'success', { virtual: true, payload }, requestMeta);
  return { id, status: action === 'resolve' ? 'resolved' : action, virtual: true, updated_at: now().toISOString() };
}

async function retryEvent(eventId, auth = {}, requestMeta = {}) {
  cleanObjectId(eventId, 'eventId');
  const event = await EventOutbox.findById(eventId);
  if (!event) throw ApiError.notFound('Không tìm thấy event outbox.');
  event.status = EVENT_OUTBOX_STATUS.PENDING;
  event.next_retry_at = now();
  event.locked_at = undefined;
  event.locked_by = undefined;
  event.last_error = undefined;
  event.dead_letter_at = undefined;
  await event.save();
  await recordCommandAudit(auth, 'command_center.event_outbox.retry', 'event_outbox', event._id, 'success', {
    event_type: event.event_type,
    retry_count: event.retry_count,
  }, requestMeta);
  return event.toObject ? event.toObject() : event;
}

async function retryNotificationDelivery(deliveryId, auth = {}, requestMeta = {}) {
  cleanObjectId(deliveryId, 'deliveryId');
  const delivery = await NotificationDelivery.findById(deliveryId);
  if (delivery) {
    delivery.status = NOTIFICATION_DELIVERY_STATUS.PENDING;
    delivery.next_attempt_at = now();
    delivery.last_error = undefined;
    await delivery.save();
    await recordCommandAudit(auth, 'command_center.notification_delivery.retry', 'notification_delivery', delivery._id, 'success', {
      channel: delivery.channel,
      provider: delivery.provider,
    }, requestMeta);
    return delivery.toObject ? delivery.toObject() : delivery;
  }

  const notification = await Notification.findById(deliveryId);
  if (!notification) throw ApiError.notFound('Không tìm thấy delivery/notification.');
  notification.status = NOTIFICATION_STATUS.QUEUED;
  notification.failed_at = undefined;
  notification.failure_reason = undefined;
  notification.scheduled_at = now();
  await notification.save();
  await recordCommandAudit(auth, 'command_center.notification.retry', 'notification', notification._id, 'success', {}, requestMeta);
  return notification.toObject ? notification.toObject() : notification;
}

async function revokeSession(sessionId, auth = {}, requestMeta = {}) {
  cleanObjectId(sessionId, 'sessionId');
  const session = await AuthSession.findOneAndUpdate(
    { _id: sessionId, revoked_at: null },
    {
      $set: {
        revoked_at: now(),
        revoked_reason: requestMeta.reason || 'Revoked from Command Center',
        revoked_by: actorUserId(auth),
      },
    },
    { new: true },
  ).lean();
  if (!session) throw ApiError.notFound('Không tìm thấy session active.');
  realtimeService.emitToRooms('security.session_revoked', {
    session_id: stringifyId(session._id),
    actor_id: stringifyId(session.actor_id),
  }, [`actor:${session.actor_type}:${session.actor_id}`], {
    request_id: requestMeta.requestId || requestMeta.request_id,
  });
  await recordCommandAudit(auth, 'command_center.session.revoke', 'auth_session', session._id, 'success', {
    actor_type: session.actor_type,
    actor_id: stringifyId(session.actor_id),
  }, requestMeta);
  return session;
}

async function testRealtimeSelf(auth = {}, requestMeta = {}) {
  const userId = actorUserId(auth);
  const rooms = userId ? [`actor:${actorType(auth)}:${userId}`, `user:${userId}`] : [];
  const result = realtimeService.emitToRooms('command_center.test_self', {
    message: 'Command Center realtime test',
    actor_id: stringifyId(userId),
  }, rooms, {
    request_id: requestMeta.requestId || requestMeta.request_id,
  });
  await recordCommandAudit(auth, 'command_center.realtime.test_self', 'realtime', null, 'success', result, requestMeta);
  return result;
}

module.exports = {
  COMMAND_PERMISSIONS,
  getBootstrap,
  getDashboard,
  getHealth,
  getWorkItems,
  getWorkItemsSummary: async (query = {}, auth = {}) => (await getWorkItems(query, auth)).summary,
  getSystemAlerts,
  getSecurityAlerts,
  getRecentActivities,
  getSessions: async (query = {}, auth = {}) => ({
    summary: {
      active_staff_sessions: await AuthSession.countDocuments({ actor_type: 'staff', revoked_at: null, expires_at: { $gt: now() } }),
      suspicious_sessions: (await getActiveSessions(200)).filter((item) => item.risk_score >= 20).length,
      revoked_today: await AuthSession.countDocuments({ revoked_at: { $gte: hoursAgo(24) } }),
    },
    sessions: await getActiveSessions(query.limit || 100),
    permissions: permissionsSnapshot(auth),
    checked_at: now().toISOString(),
  }),
  getWorkers,
  getRealtime,
  getWorkspaceMap,
  exportSnapshot,
  acknowledgeVirtualItem,
  updateVirtualItem,
  updateVirtualAlert,
  retryEvent,
  retryNotificationDelivery,
  revokeSession,
  testRealtimeSelf,
};
