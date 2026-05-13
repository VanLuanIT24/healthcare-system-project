const auditService = require('./audit.service');
const codeGeneratorService = require('./code-generator.service');
const { runInTransaction: runWithTransaction } = require('../shared/utils/transaction');
const { createError: createFoundationError } = require('../common/errors/error-factory');
const { startOfDay, endOfDay } = require('../common/helpers/date-time.helper');

const requestIdempotencyStore = new Map();
const bookingLockStore = new Map();

function createError(message, statusCode = 400) {
  return createFoundationError(statusCode, message);
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
  before,
  after,
  metadata,
}) {
  return auditService.recordAuditLog({
    actor,
    actorType,
    actorId,
    action,
    targetType,
    targetId,
    status,
    message,
    requestMeta,
    before,
    after,
    metadata,
  });
}

async function logAuditAction(payload) {
  return auditService.logAuditAction(payload);
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
  return auditService.recordWorkflowEvent({
    actor,
    entityType,
    entityId,
    action,
    fromStatus,
    toStatus,
    requestMeta,
    metadata,
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
  return runWithTransaction(work);
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
  return codeGeneratorService.generateCode(prefix);
}

function getStartOfDay(value) {
  return startOfDay(value);
}

function getEndOfDay(value) {
  return endOfDay(value);
}

module.exports = {
  // createError: Tạo lỗi nghiệp vụ chuẩn.
  createError,
  // normalizeString: Chuẩn hóa chuỗi.
  normalizeString,
  // normalizeLower: Chuẩn hóa chữ thường.
  normalizeLower,
  // normalizePhone: Chuẩn hóa số điện thoại.
  normalizePhone,
  // normalizeHumanName: Chuẩn hóa người tên.
  normalizeHumanName,
  // escapeRegex: Escape chuỗi đầu vào để dùng an toàn trong biểu thức chính quy.
  escapeRegex,
  // getPagination: Lấy thông tin phân trang.
  getPagination,
  // validatePaginationParams: Kiểm tra tính hợp lệ của tham số phân trang.
  validatePaginationParams,
  // buildListQueryOptions: Xây dựng tùy chọn truy vấn danh sách.
  buildListQueryOptions,
  // buildPagination: Xây dựng thông tin phân trang.
  buildPagination,
  // assertEntityExists: Bảo đảm đối tượng exists.
  assertEntityExists,
  // assertEntityActive: Bảo đảm đối tượng đang hoạt động.
  assertEntityActive,
  // sanitizeOutput: Làm sạch dữ liệu dữ liệu trả về.
  sanitizeOutput,
  // recordAuditLog: Ghi nhận nhật ký kiểm toán.
  recordAuditLog,
  // logAuditAction: Ghi log hành động audit.
  logAuditAction,
  // recordWorkflowEvent: Ghi nhận sự kiện quy trình.
  recordWorkflowEvent,
  // runInTransaction: Chạy trong giao dịch.
  runInTransaction,
  // acquireBookingLock: Tạo/giữ khóa đặt lịch.
  acquireBookingLock,
  // releaseBookingLock: Giải phóng khóa đặt lịch.
  releaseBookingLock,
  // ensureIdempotency: Bảo đảm tính idempotent của thao tác.
  ensureIdempotency,
  // getAllowedStatusTransitions: Lấy các chuyển trạng thái được phép.
  getAllowedStatusTransitions,
  // assertValidStatusTransition: Bảo đảm chuyển trạng thái hợp lệ.
  assertValidStatusTransition,
  // generateCode: Sinh/tạo mã.
  generateCode,
  // getStartOfDay: Lấy mốc đầu ngày.
  getStartOfDay,
  // getEndOfDay: Lấy mốc cuối ngày.
  getEndOfDay,
};
