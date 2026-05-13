const { authRepository } = require('../repositories');
const { AUDIT_SEVERITY, AUDIT_SEVERITIES, AUDIT_STATUS, AUDIT_STATUSES } = require('../constants/statuses');

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'password_hash',
  'temporary_password',
  'initial_password',
  'new_password',
  'current_password',
  'token',
  'token_hash',
  'access_token',
  'refresh_token',
  'refresh_token_hash',
  'reset_token',
  'reset_token_hash',
  'reset_code',
  'reset_code_hash',
  'otp',
  'otp_code',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'set_cookie',
  'session_secret',
]);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeAuditKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeAction(action) {
  return normalizeAuditKey(action);
}

function normalizeTargetType(targetType) {
  return normalizeAuditKey(targetType);
}

function inferModuleKey({ moduleKey, module_key, action, targetType, target_type }) {
  const explicit = normalizeAuditKey(moduleKey || module_key);
  if (explicit) return explicit;

  const normalizedAction = normalizeAction(action);
  if (normalizedAction.includes('.')) return normalizedAction.split('.')[0];

  const normalizedTargetType = normalizeTargetType(targetType || target_type);
  if (normalizedTargetType.includes('_')) return normalizedTargetType.split('_')[0];
  return normalizedTargetType || 'system';
}

function resolveActor(actor = {}, actorType = 'system', actorId = null) {
  const resolvedActorType = actor.actorType || actor.actor_type || actorType || 'system';
  return {
    actor_type: resolvedActorType,
    actor_id: actor.userId || actor.patientAccountId || actor.actor_id || actor.actorId || actorId,
  };
}

function shouldRedactField(key) {
  const normalized = normalizeAuditKey(key);
  if (SENSITIVE_FIELD_NAMES.has(normalized)) return true;
  if (normalized.endsWith('_token') || normalized.endsWith('_secret')) return true;
  if (normalized.includes('password')) return true;
  return false;
}

function maskSensitiveMetadata(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value.toHexString === 'function') return value;
  if (value._bsontype && typeof value.toString === 'function') return value.toString();

  const plain = typeof value.toObject === 'function' ? value.toObject() : value;
  if (!plain || typeof plain !== 'object') return plain;

  if (seen.has(plain)) return '[Circular]';
  seen.add(plain);

  if (Array.isArray(plain)) {
    const items = plain.map((item) => maskSensitiveMetadata(item, seen));
    seen.delete(plain);
    return items;
  }

  const sanitized = Object.fromEntries(
    Object.entries(plain).map(([key, item]) => [
      key,
      shouldRedactField(key) ? '[REDACTED]' : maskSensitiveMetadata(item, seen),
    ]),
  );

  if (sanitized.setting_key && (sanitized.is_sensitive || sanitized.is_encrypted)) {
    if (Object.prototype.hasOwnProperty.call(sanitized, 'setting_value')) {
      sanitized.setting_value = '[REDACTED]';
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'default_value')) {
      sanitized.default_value = '[REDACTED]';
    }
  }

  seen.delete(plain);
  return sanitized;
}

function sanitizeAuditSnapshot(value) {
  return maskSensitiveMetadata(value);
}

function normalizeAuditStatus(status) {
  return AUDIT_STATUSES.includes(status) ? status : AUDIT_STATUS.SUCCESS;
}

function normalizeAuditSeverity(severity, status) {
  if (AUDIT_SEVERITIES.includes(severity)) return severity;
  return status === AUDIT_STATUS.FAILURE ? AUDIT_SEVERITY.WARNING : AUDIT_SEVERITY.INFO;
}

function resolveRequestMeta(requestMeta = {}, actor = {}) {
  return {
    request_id: requestMeta.requestId || requestMeta.request_id || actor.request_id,
    session_id: requestMeta.sessionId || requestMeta.session_id || actor.sessionId || actor.session_id,
    ip_address: requestMeta.ipAddress || requestMeta.ip || actor.ip,
    user_agent: requestMeta.userAgent || requestMeta.user_agent || actor.user_agent,
  };
}

function changedFields(before = {}, after = {}) {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  const left = typeof before.toObject === 'function' ? before.toObject() : before;
  const right = typeof after.toObject === 'function' ? after.toObject() : after;
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);

  return [...keys].filter((key) => {
    if (key === 'updated_at') return false;
    return JSON.stringify(left?.[key]) !== JSON.stringify(right?.[key]);
  });
}

async function recordAuditLog({
  actor,
  actorType = 'system',
  actorId,
  action,
  moduleKey,
  module_key,
  targetType,
  target_type,
  targetId,
  target_id,
  status = AUDIT_STATUS.SUCCESS,
  severity,
  message,
  requestMeta,
  before,
  after,
  metadata,
  strict = false,
}) {
  try {
    const normalizedAction = normalizeAction(action);
    if (!normalizedAction) {
      throw new Error('Audit action is required.');
    }

    const resolvedActor = resolveActor(actor, actorType, actorId);
    const normalizedStatus = normalizeAuditStatus(status);
    const request = resolveRequestMeta(requestMeta, actor || {});
    const normalizedTargetType = normalizeTargetType(targetType || target_type);
    const normalizedMetadata = maskSensitiveMetadata(metadata);

    return await authRepository.auditLogRepository.create({
      actor_type: resolvedActor.actor_type,
      actor_id: resolvedActor.actor_id,
      action: normalizedAction,
      module_key: inferModuleKey({
        moduleKey,
        module_key,
        action: normalizedAction,
        targetType: normalizedTargetType,
      }),
      target_type: normalizedTargetType,
      target_id: targetId || target_id,
      status: normalizedStatus,
      severity: normalizeAuditSeverity(severity, normalizedStatus),
      message,
      request_id: request.request_id,
      session_id: request.session_id,
      ip_address: request.ip_address,
      user_agent: request.user_agent,
      before: sanitizeAuditSnapshot(before),
      after: sanitizeAuditSnapshot(after),
      metadata: normalizedMetadata,
    });
  } catch (error) {
    if (strict) throw error;
    console.error('Audit log write failed:', error.message);
    return null;
  }
}

function logAuditAction(payload) {
  return recordAuditLog(payload);
}

function writeAuditLog(payload, context = {}) {
  return recordAuditLog({
    ...payload,
    actor: payload.actor || context,
    requestMeta: payload.requestMeta || context,
  });
}

function writeSuccessLog(payload, context = {}) {
  return writeAuditLog(
    {
      ...payload,
      status: AUDIT_STATUS.SUCCESS,
      severity: payload.severity || AUDIT_SEVERITY.INFO,
    },
    context,
  );
}

function writeFailureLog(payload, context = {}) {
  return writeAuditLog(
    {
      ...payload,
      status: AUDIT_STATUS.FAILURE,
      severity: payload.severity || AUDIT_SEVERITY.WARNING,
    },
    context,
  );
}

function auditChange({
  actor,
  action,
  moduleKey,
  target,
  targetType,
  targetId,
  before,
  after,
  message,
  metadata,
  requestMeta,
  strict = false,
}, context = {}) {
  const fields = changedFields(before, after);
  return recordAuditLog({
    actor: actor || context,
    action,
    moduleKey,
    targetType: targetType || target?.type,
    targetId: targetId || target?.id || target?._id,
    status: AUDIT_STATUS.SUCCESS,
    message,
    requestMeta: requestMeta || context,
    before,
    after,
    metadata: {
      changed_fields: fields,
      ...metadata,
    },
    strict,
  });
}

function recordWorkflowEvent({
  actor,
  entityType,
  entityId,
  action,
  fromStatus,
  toStatus,
  requestMeta,
  metadata,
}) {
  return recordAuditLog({
    actor,
    action: `${entityType}.${action}`,
    targetType: entityType,
    targetId: entityId,
    status: AUDIT_STATUS.SUCCESS,
    message: `Workflow ${entityType} chuyển từ ${fromStatus || 'unknown'} sang ${toStatus || 'unknown'}.`,
    requestMeta,
    metadata: {
      from_status: fromStatus,
      to_status: toStatus,
      ...metadata,
    },
  });
}

function recordSecurityEvent(payload) {
  return recordAuditLog({
    status: payload.status || AUDIT_STATUS.SUCCESS,
    targetType: payload.targetType || 'security',
    ...payload,
  });
}

module.exports = {
  // resolveActor: Xác định/xử lý tác nhân.
  resolveActor,
  // sanitizeAuditSnapshot: Làm sạch dữ liệu bản chụp dữ liệu audit.
  sanitizeAuditSnapshot,
  // maskSensitiveMetadata: Che/ẩn metadata nhạy cảm.
  maskSensitiveMetadata,
  // normalizeAction: Chuẩn hóa hành động.
  normalizeAction,
  // normalizeTargetType: Chuẩn hóa loại đối tượng audit.
  normalizeTargetType,
  // inferModuleKey: Suy luận khóa phân hệ audit.
  inferModuleKey,
  // changedFields: Xác định danh sách trường thay đổi giữa dữ liệu trước và sau.
  changedFields,
  // recordAuditLog: Ghi nhận nhật ký kiểm toán.
  recordAuditLog,
  // logAuditAction: Ghi log hành động audit.
  logAuditAction,
  // writeAuditLog: Ghi nhật ký kiểm toán.
  writeAuditLog,
  // writeSuccessLog: Ghi nhật ký audit cho thao tác thành công.
  writeSuccessLog,
  // writeFailureLog: Ghi nhật ký audit cho thao tác thất bại.
  writeFailureLog,
  // auditChange: Ghi audit cho đổi.
  auditChange,
  // recordWorkflowEvent: Ghi nhận sự kiện quy trình.
  recordWorkflowEvent,
  // recordSecurityEvent: Ghi nhận sự kiện bảo mật.
  recordSecurityEvent,
};
