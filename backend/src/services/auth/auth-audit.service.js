const { buildPaginationMeta, normalizePagination } = require('../../common/helpers/pagination.helper');
const { buildDateRangeFilter } = require('../../common/helpers/query.helper');
const { normalizeActorType } = require('../../constants/statuses');
const { AuditLog } = require('../../models');
const { getActorId } = require('./auth.policy');

const AUTH_AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.refresh_token',
  'auth.password_reset.request',
  'auth.password_reset.complete',
  'auth.change_password',
  'auth.session.revoke',
  'auth.sessions.invalidate_all',
  'auth.account_locked',
  'auth.staff.login',
  'auth.patient.login',
];

async function getLoginHistory(auth = {}, query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const actorId = getActorId(auth);
  const filter = {
    actor_type: auth.actorType || auth.actor_type,
    actor_id: actorId,
    action: { $in: AUTH_AUDIT_ACTIONS },
    ...buildDateRangeFilter('created_at', query.from, query.to),
  };

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      audit_log_id: String(item._id),
      action: item.action,
      status: item.status,
      message: item.message,
      ip_address: item.ip_address,
      user_agent: item.user_agent,
      metadata: item.metadata,
      created_at: item.created_at,
    })),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getAuditLogs(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {
    ...buildDateRangeFilter('created_at', query.from, query.to),
  };

  if (query.actor_type) filter.actor_type = normalizeActorType(query.actor_type);
  if (query.actor_id) filter.actor_id = query.actor_id;
  if (query.action) filter.action = query.action;
  if (query.target_type) filter.target_type = query.target_type;
  if (query.target_id) filter.target_id = query.target_id;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

module.exports = {
  // AUTH_AUDIT_ACTIONS: Định nghĩa hằng số/cấu hình auth audit actions dùng chung trong service.
  AUTH_AUDIT_ACTIONS,
  // getLoginHistory: Lấy lịch sử đăng nhập.
  getLoginHistory,
  // getAuditLogs: Lấy nhật ký kiểm toán.
  getAuditLogs,
};
