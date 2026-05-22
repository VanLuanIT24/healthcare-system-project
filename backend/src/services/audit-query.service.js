const { AuditLog } = require('../models');
const { PERMISSION } = require('../constants/permissions');
const { ACTOR_TYPES, AUDIT_STATUS, normalizeActorType } = require('../constants/statuses');
const permissionService = require('./permission.service');
const auditPolicy = require('./audit-policy.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const AUDIT_SORT_FIELDS = new Set(['created_at', 'action', 'actor_type', 'target_type', 'status', 'severity']);
const SECURITY_MODULES = ['auth', 'security', 'user', 'users', 'role', 'roles', 'permission', 'permissions'];
const SCHEDULING_MODULES = ['schedule', 'schedules', 'appointment', 'appointments', 'queue'];
const BREAK_GLASS_ACTIONS = ['break_glass.start', 'break_glass.end', 'break_glass.started', 'break_glass.ended'];
const SENSITIVE_ACTIONS = [
  ...auditPolicy.SENSITIVE_READ_ACTIONS,
  ...auditPolicy.SENSITIVE_WRITE_ACTIONS,
];
const PAYMENT_ACTIONS = [
  ...auditPolicy.PAYMENT_ACTIONS,
  'charges.create',
  'charges.post',
  'charges.void',
  'invoices.create_from_charges',
  'invoices.issue',
  'invoices.void',
  'payments.create',
  'payments.void',
  'payments.refund',
  'refund.requested',
  'refund.approved',
  'refund.rejected',
  'receipt.print_log',
  'receipt.viewed',
  'manual_payment.confirmed',
  'manual_payment.rejected',
];
const IAM_ACTION_PREFIXES = ['iam.', 'role.', 'roles.', 'permission.', 'permissions.', 'user_role.', 'access_control.'];
const SYSTEM_CONFIG_ACTIONS = ['system_setting.create', 'system_setting.update', 'system_setting.rollback'];
const SAFE_LIMITED_METADATA_KEYS = [
  'reason',
  'from_status',
  'to_status',
  'previous_status',
  'new_status',
  'department_id',
  'doctor_id',
  'appointment_id',
  'appointment_ids',
  'invoice_id',
  'payment_id',
];

function hasPermission(actor = {}, permission) {
  return permissionService.hasPermission(actor.permissions || [], permission);
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions);
}

function actorId(actor = {}) {
  return actor.userId || actor.patientAccountId || actor.actorId || actor.actor_id || actor.id || null;
}

function assertStaff(actor = {}) {
  if (actor.actorType !== 'staff' && actor.actor_type !== 'staff') {
    throw createError('Chỉ tài khoản nhân sự được xem audit logs.', 403);
  }
}

function canReadAllAudit(actor = {}) {
  return hasPermission(actor, PERMISSION.AUDIT_LOGS.READ);
}

function canReadLimitedAudit(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.AUDIT_LOGS.READ_LIMITED,
    PERMISSION.AUDIT_LOGS.READ_SECURITY,
    PERMISSION.AUDIT_LOGS.READ_SCHEDULE,
  ]);
}

function buildDateRange(query = {}) {
  const filter = {};
  const dateRange = {};

  if (query.date_from) {
    const dateFrom = new Date(query.date_from);
    if (Number.isNaN(dateFrom.getTime())) throw createError('date_from không hợp lệ.', 400);
    dateRange.$gte = dateFrom;
  }

  if (query.date_to) {
    const dateTo = new Date(query.date_to);
    if (Number.isNaN(dateTo.getTime())) throw createError('date_to không hợp lệ.', 400);
    dateRange.$lte = dateTo;
  }

  if (dateRange.$gte && dateRange.$lte && dateRange.$gte > dateRange.$lte) {
    throw createError('Khoảng thời gian audit không hợp lệ.', 400);
  }

  if (Object.keys(dateRange).length > 0) filter.created_at = dateRange;
  return filter;
}

function buildAuditFilter(query = {}) {
  const filter = buildDateRange(query);

  for (const field of ['actor_type', 'action', 'module_key', 'target_type', 'status', 'severity', 'request_id']) {
    if (query[field]) filter[field] = normalizeString(query[field]).toLowerCase();
  }

  if (!filter.action && query.action_prefix) {
    filter.action = { $regex: `^${escapeRegex(normalizeString(query.action_prefix).toLowerCase())}\\.` };
  }

  if (query.actor_id) filter.actor_id = query.actor_id;
  if (query.target_id) filter.target_id = query.target_id;
  if (query.session_id) filter.session_id = query.session_id;

  const keyword = normalizeString(query.keyword || query.search || query.q);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { action: { $regex: pattern, $options: 'i' } },
      { module_key: { $regex: pattern, $options: 'i' } },
      { target_type: { $regex: pattern, $options: 'i' } },
      { message: { $regex: pattern, $options: 'i' } },
      { request_id: { $regex: pattern, $options: 'i' } },
    ];
  }

  return filter;
}

function scopedAuditFilter(filter = {}, actor = {}, mode = 'list') {
  if (canReadAllAudit(actor)) return filter;

  const scopes = [];
  if (hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_SECURITY)) {
    scopes.push({
      $or: [
        { module_key: { $in: SECURITY_MODULES } },
        { action: { $regex: '^(auth|security|user|users|role|roles|permission|permissions)\\.' } },
      ],
    });
  }

  if (hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_SCHEDULE)) {
    scopes.push({
      $or: [
        { module_key: { $in: SCHEDULING_MODULES } },
        { action: { $regex: '^(schedule|appointment|queue)\\.' } },
        { target_type: { $in: ['doctor_schedule', 'schedule_slot', 'appointment', 'queue_ticket'] } },
      ],
    });
  }

  if (hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_LIMITED)) {
    scopes.push({});
  }

  if (mode === 'actor' && hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_ACTOR)) scopes.push({});
  if (mode === 'entity' && hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_ENTITY)) scopes.push({});

  if (scopes.length === 0) {
    throw createError('Tài khoản hiện tại không có quyền xem audit logs.', 403);
  }

  if (scopes.some((scope) => Object.keys(scope).length === 0)) return filter;
  return { $and: [filter, { $or: scopes }] };
}

function pickLimitedMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => SAFE_LIMITED_METADATA_KEYS.includes(key)),
  );
}

function redactLimitedLog(log = {}, actor = {}) {
  if (canReadAllAudit(actor)) return log;

  return {
    ...log,
    before: undefined,
    after: undefined,
    metadata: pickLimitedMetadata(log.metadata),
  };
}

function buildSort(query = {}) {
  const sortBy = AUDIT_SORT_FIELDS.has(query.sort_by) ? query.sort_by : 'created_at';
  const sortDirection = String(query.sort_direction || query.sort || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  return { [sortBy]: sortDirection };
}

function nonEmptyFilter(filter = {}) {
  return filter && Object.keys(filter).length > 0;
}

function andFilter(...filters) {
  const usable = filters.filter(nonEmptyFilter);
  if (usable.length === 0) return {};
  if (usable.length === 1) return usable[0];
  return { $and: usable };
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function scopedBaseFilter(query = {}, actor = {}, mode = 'list') {
  assertStaff(actor);
  if (!canReadAllAudit(actor) && !canReadLimitedAudit(actor)) {
    throw createError('Tài khoản hiện tại không có quyền xem audit logs.', 403);
  }
  return scopedAuditFilter(buildAuditFilter(query), actor, mode);
}

async function aggregateCountBy(filter, field, limit = 12) {
  return AuditLog.aggregate([
    { $match: filter },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { _id: { $nin: [null, ''] } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

function actionPrefixFilter(prefixes = []) {
  return { $or: prefixes.map((prefix) => ({ action: { $regex: `^${escapeRegex(prefix)}` } })) };
}

async function getAuditSummary(query = {}, actor = {}) {
  const baseFilter = scopedBaseFilter(query, actor);
  const todayFilter = andFilter(baseFilter, { created_at: { $gte: startOfToday() } });
  const sensitiveFilter = andFilter(baseFilter, { action: { $in: SENSITIVE_ACTIONS } });
  const breakGlassFilter = andFilter(baseFilter, { action: { $in: BREAK_GLASS_ACTIONS } });
  const paymentFilter = andFilter(baseFilter, { action: { $in: PAYMENT_ACTIONS } });
  const iamFilter = andFilter(baseFilter, actionPrefixFilter(IAM_ACTION_PREFIXES));
  const systemConfigFilter = andFilter(baseFilter, { $or: [{ action: { $in: SYSTEM_CONFIG_ACTIONS } }, { module_key: 'settings' }, { target_type: 'system_setting' }] });

  const [
    total,
    totalToday,
    successCount,
    failureCount,
    warningCount,
    criticalCount,
    sensitiveAccessCount,
    breakGlassCount,
    paymentEventCount,
    iamChangeCount,
    systemConfigChangeCount,
    exportEventCount,
    topActions,
    topModules,
    topActors,
    topIps,
    trendByHour,
  ] = await Promise.all([
    AuditLog.countDocuments(baseFilter),
    AuditLog.countDocuments(todayFilter),
    AuditLog.countDocuments(andFilter(baseFilter, { status: AUDIT_STATUS.SUCCESS })),
    AuditLog.countDocuments(andFilter(baseFilter, { status: 'failure' })),
    AuditLog.countDocuments(andFilter(baseFilter, { severity: 'warning' })),
    AuditLog.countDocuments(andFilter(baseFilter, { severity: 'critical' })),
    AuditLog.countDocuments(sensitiveFilter),
    AuditLog.countDocuments(breakGlassFilter),
    AuditLog.countDocuments(paymentFilter),
    AuditLog.countDocuments(iamFilter),
    AuditLog.countDocuments(systemConfigFilter),
    AuditLog.countDocuments(andFilter(baseFilter, { action: 'audit_log.export' })),
    aggregateCountBy(baseFilter, 'action', 10),
    aggregateCountBy(baseFilter, 'module_key', 10),
    AuditLog.aggregate([
      { $match: baseFilter },
      { $group: { _id: { actor_type: '$actor_type', actor_id: '$actor_id' }, count: { $sum: 1 }, last_seen_at: { $max: '$created_at' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    aggregateCountBy(andFilter(baseFilter, { ip_address: { $nin: [null, ''] } }), 'ip_address', 10),
    AuditLog.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: { $dayOfMonth: '$created_at' },
            hour: { $hour: '$created_at' },
          },
          count: { $sum: 1 },
          failures: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
      { $limit: 48 },
    ]),
  ]);

  return {
    total,
    total_today: totalToday,
    total_24h: total,
    success_count: successCount,
    failure_count: failureCount,
    warning_count: warningCount,
    critical_count: criticalCount,
    sensitive_access_count: sensitiveAccessCount,
    break_glass_count: breakGlassCount,
    payment_event_count: paymentEventCount,
    iam_change_count: iamChangeCount,
    system_config_change_count: systemConfigChangeCount,
    export_event_count: exportEventCount,
    top_actions: topActions,
    top_modules: topModules,
    top_actors: topActors,
    top_ips: topIps,
    trend_by_hour: trendByHour,
  };
}

async function getAuditFacets(query = {}, actor = {}) {
  const baseFilter = scopedBaseFilter(query, actor);
  const [actions, modules, targetTypes, statuses, severities, actorTypes] = await Promise.all([
    aggregateCountBy(baseFilter, 'action', 40),
    aggregateCountBy(baseFilter, 'module_key', 30),
    aggregateCountBy(baseFilter, 'target_type', 30),
    aggregateCountBy(baseFilter, 'status', 12),
    aggregateCountBy(baseFilter, 'severity', 12),
    aggregateCountBy(baseFilter, 'actor_type', 12),
  ]);
  return { actions, modules, target_types: targetTypes, statuses, severities, actor_types: actorTypes };
}

async function getRequestTimeline(requestId, query = {}, actor = {}) {
  if (!requestId) throw createError('requestId là bắt buộc.', 422);
  return listAuditLogs({ ...query, request_id: requestId, sort_by: 'created_at', sort_direction: 'asc', limit: query.limit || 200 }, actor);
}

async function getSessionTimeline(sessionId, query = {}, actor = {}) {
  if (!sessionId) throw createError('sessionId là bắt buộc.', 422);
  return listAuditLogs({ ...query, session_id: sessionId, sort_by: 'created_at', sort_direction: 'asc', limit: query.limit || 200 }, actor);
}

async function listAuditLogs(query = {}, actor = {}) {
  assertStaff(actor);
  const scopeMode = query._scope_mode || 'list';
  const canReadMode = (scopeMode === 'actor' && hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_ACTOR))
    || (scopeMode === 'entity' && hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_ENTITY));

  if (!canReadAllAudit(actor) && !canReadLimitedAudit(actor) && !canReadMode) {
    throw createError('Tài khoản hiện tại không có quyền xem audit logs.', 403);
  }

  const maxLimit = Math.min(Math.max(Number(query._max_limit || 100), 1), 1000);
  const { page, limit, skip } = getPagination(query, 20, maxLimit);
  const filter = scopedAuditFilter(buildAuditFilter(query), actor, scopeMode);
  const sort = buildSort(query);

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => redactLimitedLog(item, actor)),
    pagination: buildPagination(page, limit, total),
  };
}

async function getAuditLogDetail(auditLogId, actor = {}) {
  assertStaff(actor);
  if (!canReadAllAudit(actor) && !canReadLimitedAudit(actor)) {
    throw createError('Tài khoản hiện tại không có quyền xem audit log.', 403);
  }

  const filter = scopedAuditFilter({ _id: auditLogId }, actor, 'list');
  const log = await AuditLog.findOne(filter).lean();
  if (!log) throw createError('Không tìm thấy audit log.', 404);
  return redactLimitedLog(log, actor);
}

async function getAuditLogsByActor(actorType, targetActorId, query = {}, actor = {}) {
  assertStaff(actor);

  const canReadSelf = actorType === (actor.actorType || actor.actor_type)
    && String(targetActorId) === String(actorId(actor))
    && canReadLimitedAudit(actor);

  if (!canReadAllAudit(actor) && !hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_ACTOR) && !canReadSelf) {
    throw createError('Tài khoản hiện tại không có quyền xem audit theo actor.', 403);
  }

  const normalizedActorType = normalizeActorType(actorType);
  if (!ACTOR_TYPES.includes(normalizedActorType)) {
    throw createError('actorType không hợp lệ.', 400);
  }

  return listAuditLogs(
    {
      ...query,
      _scope_mode: 'actor',
      actor_type: normalizedActorType,
      actor_id: targetActorId,
    },
    actor,
  );
}

async function getAuditLogsByEntity(targetType, targetId, query = {}, actor = {}) {
  assertStaff(actor);
  if (!canReadAllAudit(actor) && !hasPermission(actor, PERMISSION.AUDIT_LOGS.READ_ENTITY)) {
    throw createError('Tài khoản hiện tại không có quyền xem audit theo entity.', 403);
  }

  return listAuditLogs(
    {
      ...query,
      _scope_mode: 'entity',
      target_type: normalizeString(targetType).toLowerCase(),
      target_id: targetId,
    },
    actor,
  );
}

async function getLoginHistory(actorType, targetActorId, query = {}, actor = {}) {
  const normalizedActorType = normalizeActorType(actorType);
  if (!ACTOR_TYPES.includes(normalizedActorType)) {
    throw createError('actorType không hợp lệ.', 400);
  }

  return listAuditLogs(
    {
      ...query,
      _scope_mode: 'actor',
      actor_type: normalizedActorType,
      actor_id: targetActorId,
      action: undefined,
      module_key: undefined,
      action_prefix: 'auth',
    },
    actor,
  );
}

function toCsvValue(value) {
  if (value === undefined || value === null) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function auditLogsToCsv(items = []) {
  const headers = [
    'created_at',
    'actor_type',
    'actor_id',
    'action',
    'module_key',
    'target_type',
    'target_id',
    'status',
    'severity',
    'message',
    'ip_address',
    'request_id',
  ];

  return [
    headers.join(','),
    ...items.map((item) => headers.map((header) => toCsvValue(item[header])).join(',')),
  ].join('\n');
}

async function exportAuditLogs(query = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  if (!hasAnyPermission(actor, [PERMISSION.AUDIT_LOGS.EXPORT, PERMISSION.AUDIT_LOGS.READ])) {
    throw createError('Tài khoản hiện tại không có quyền export audit logs.', 403);
  }

  const result = await listAuditLogs(
    { ...query, page: 1, limit: Math.min(Number(query.limit) || 1000, 1000), _max_limit: 1000 },
    actor,
  );
  const format = normalizeString(query.format || 'json').toLowerCase();

  await recordAuditLog({
    actor,
    action: 'audit_log.export',
    targetType: 'audit_log',
    status: AUDIT_STATUS.SUCCESS,
    message: 'Export audit logs.',
    requestMeta,
    metadata: {
      format,
      filters: query,
      exported_count: result.items.length,
    },
  });

  if (format === 'csv') {
    return {
      format,
      content_type: 'text/csv',
      filename: `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`,
      content: auditLogsToCsv(result.items),
    };
  }

  return {
    format: 'json',
    content_type: 'application/json',
    items: result.items,
    pagination: result.pagination,
  };
}

module.exports = {
  // listAuditLogs: Liệt kê nhật ký kiểm toán.
  listAuditLogs,
  // getAuditLogDetail: Lấy chi tiết nhật ký kiểm toán.
  getAuditLogDetail,
  // getAuditLogsByActor: Lấy nhật ký kiểm toán theo tác nhân.
  getAuditLogsByActor,
  // getAuditLogsByEntity: Lấy nhật ký kiểm toán theo đối tượng.
  getAuditLogsByEntity,
  // getLoginHistory: Lấy lịch sử đăng nhập.
  getLoginHistory,
  // getAuditSummary: Tổng hợp KPI, top facets và trend audit.
  getAuditSummary,
  // getAuditFacets: Lấy facets động để build filter UI.
  getAuditFacets,
  // getRequestTimeline: Timeline theo request_id.
  getRequestTimeline,
  // getSessionTimeline: Timeline theo session_id.
  getSessionTimeline,
  // exportAuditLogs: Xuất nhật ký kiểm toán.
  exportAuditLogs,
};
