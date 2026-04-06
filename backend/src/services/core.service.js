const { mongoose } = require('../config/database');
const { AuditLog } = require('../models');

const requestIdempotencyStore = new Map();
const bookingLockStore = new Map();

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : '';
}

function normalizePhone(value) {
  return normalizeString(value).replace(/\s+/g, '');
}

function normalizeHumanName(value) {
  return normalizeString(value).replace(/\s+/g, ' ');
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPagination(query = {}, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || defaultLimit), 1), maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function validatePaginationParams(query = {}, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || defaultLimit), 1), maxLimit);
  const sort_by = normalizeString(query.sort_by) || 'created_at';
  const sort_direction = String(query.sort_direction || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort: { [sort_by]: sort_direction },
  };
}

function buildListQueryOptions({
  query = {},
  defaultLimit = 20,
  maxLimit = 100,
  allowedFilters = [],
  keywordFields = [],
  searchKey = 'search',
  baseFilter = {},
}) {
  const options = validatePaginationParams(query, defaultLimit, maxLimit);
  const filter = { ...baseFilter };

  for (const field of allowedFilters) {
    if (query[field] !== undefined && query[field] !== '') {
      filter[field] = query[field];
    }
  }

  const keyword = normalizeString(query[searchKey]);
  if (keyword && keywordFields.length > 0) {
    const pattern = escapeRegex(keyword);
    filter.$or = keywordFields.map((field) => ({
      [field]: { $regex: pattern, $options: 'i' },
    }));
  }

  return {
    filter,
    sort: options.sort,
    page: options.page,
    limit: options.limit,
    skip: options.skip,
  };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
  };
}

async function recordAuditLog({
  actor,
  actorType = 'system',
  actorId,
  action,
  targetType,
  targetId,
  status,
  message,
  requestMeta,
  metadata,
}) {
  try {
    await AuditLog.create({
      actor_type: actor?.actorType || actorType,
      actor_id: actor?.userId || actor?.patientAccountId || actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      status,
      message,
      ip_address: requestMeta?.ipAddress,
      user_agent: requestMeta?.userAgent,
      metadata,
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

async function logAuditAction(payload) {
  return recordAuditLog(payload);
}

async function recordWorkflowEvent({
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
    action: `workflow.${entityType}.${action}`,
    targetType: entityType,
    targetId: entityId,
    status: 'success',
    message: `Workflow ${entityType} chuyển từ ${fromStatus || 'unknown'} sang ${toStatus || 'unknown'}.`,
    requestMeta,
    metadata: {
      from_status: fromStatus,
      to_status: toStatus,
      ...metadata,
    },
  });
}

async function assertEntityExists(Model, id, message = 'Không tìm thấy dữ liệu.') {
  const entity = await Model.findById(id);
  if (!entity) {
    throw createError(message, 404);
  }
  return entity;
}

async function assertEntityActive(Model, id, {
  messageNotFound = 'Không tìm thấy dữ liệu.',
  messageInactive = 'Dữ liệu hiện không ở trạng thái active.',
  activeStatuses = ['active'],
  statusField = 'status',
  softDeleteField = 'is_deleted',
} = {}) {
  const entity = await assertEntityExists(Model, id, messageNotFound);
  if (softDeleteField && entity[softDeleteField]) {
    throw createError(messageNotFound, 404);
  }
  if (activeStatuses.length > 0 && !activeStatuses.includes(entity[statusField])) {
    throw createError(messageInactive, 409);
  }
  return entity;
}

function sanitizeOutput(payload, hiddenFields = ['password_hash', 'refresh_token_hash', 'reset_token', 'token_hash']) {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeOutput(item, hiddenFields));
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const plain = typeof payload.toObject === 'function' ? payload.toObject() : payload;
  const output = {};

  for (const [key, value] of Object.entries(plain)) {
    if (hiddenFields.includes(key)) {
      continue;
    }
    output[key] = sanitizeOutput(value, hiddenFields);
  }

  return output;
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

function acquireBookingLock(lockKey, ttlMs = 15000) {
  const current = bookingLockStore.get(lockKey);
  if (current && current.expiresAt > Date.now()) {
    throw createError('Slot đang được xử lý bởi một yêu cầu khác, vui lòng thử lại sau.', 409);
  }

  bookingLockStore.set(lockKey, {
    expiresAt: Date.now() + ttlMs,
  });

  return lockKey;
}

function releaseBookingLock(lockKey) {
  bookingLockStore.delete(lockKey);
  return true;
}

function ensureIdempotency(idempotencyKey, work, ttlMs = 30000) {
  if (!idempotencyKey) {
    return work();
  }

  const existing = requestIdempotencyStore.get(idempotencyKey);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.promise;
  }

  const promise = Promise.resolve().then(work);
  requestIdempotencyStore.set(idempotencyKey, {
    expiresAt: Date.now() + ttlMs,
    promise,
  });
  return promise.finally(() => {
    const latest = requestIdempotencyStore.get(idempotencyKey);
    if (latest && latest.promise === promise) {
      requestIdempotencyStore.delete(idempotencyKey);
    }
  });
}

function getAllowedStatusTransitions(statusMap, currentStatus) {
  return statusMap[currentStatus] || [];
}

function assertValidStatusTransition(statusMap, currentStatus, nextStatus, entityLabel = 'Dữ liệu') {
  const allowed = getAllowedStatusTransitions(statusMap, currentStatus);
  if (!allowed.includes(nextStatus)) {
    throw createError(`${entityLabel} không thể chuyển từ ${currentStatus} sang ${nextStatus}.`, 409);
  }
  return true;
}

function generateCode(prefix) {
  return `${prefix}${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
}

function getStartOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getEndOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

module.exports = {
  createError,
  normalizeString,
  normalizeLower,
  normalizePhone,
  normalizeHumanName,
  escapeRegex,
  getPagination,
  validatePaginationParams,
  buildListQueryOptions,
  buildPagination,
  assertEntityExists,
  assertEntityActive,
  sanitizeOutput,
  recordAuditLog,
  logAuditAction,
  recordWorkflowEvent,
  runInTransaction,
  acquireBookingLock,
  releaseBookingLock,
  ensureIdempotency,
  getAllowedStatusTransitions,
  assertValidStatusTransition,
  generateCode,
  getStartOfDay,
  getEndOfDay,
};
