const { AuditLog } = require('../models');
const { PERMISSION } = require('../constants/permissions');
const { AUDIT_STATUS } = require('../constants/statuses');
const permissionService = require('./permission.service');
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

  const normalizedActorType = normalizeString(actorType).toLowerCase();
  if (!['staff', 'patient', 'relative', 'patient_relative', 'system'].includes(normalizedActorType)) {
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
  const normalizedActorType = normalizeString(actorType).toLowerCase();
  if (!['staff', 'patient', 'relative', 'patient_relative', 'system'].includes(normalizedActorType)) {
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
  // exportAuditLogs: Xuất nhật ký kiểm toán.
  exportAuditLogs,
};
