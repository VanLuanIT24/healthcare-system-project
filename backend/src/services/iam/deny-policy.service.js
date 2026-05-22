const ApiError = require('../../common/errors/api-error');
const { mongoose } = require('../../config/database');
const { buildPaginationMeta, normalizePagination } = require('../../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../../common/helpers/query.helper');
const { DenyPolicy, Role, User, UserRole } = require('../../models');
const { bumpUsersPermissionVersion } = require('../access-control.service');
const sessionService = require('../auth/auth-session.service');
const { recordIamAudit } = require('./iam-audit.helper');
const { getActorId, isSuperAdmin } = require('./iam.policy');

const SUBJECT_TYPES = new Set(['user', 'role', 'department', 'workspace']);
const DENY_TYPES = new Set(['permission', 'role', 'module', 'route', 'workspace']);
const STATUSES = new Set(['draft', 'active', 'inactive', 'expired']);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

function normalizeText(value = '') {
  return String(value || '').trim();
}

function normalizeLower(value = '') {
  return normalizeText(value).toLowerCase();
}

function parseDateOrNull(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw ApiError.validation('Ngày hiệu lực không hợp lệ.');
  return date;
}

function assertValidPolicyPayload(payload = {}, options = {}) {
  const required = options.partial ? [] : ['subject_type', 'subject_id', 'deny_type', 'deny_value', 'reason'];
  required.forEach((field) => {
    if (!normalizeText(payload[field])) throw ApiError.validation(`${field} là bắt buộc.`);
  });

  if (payload.subject_type !== undefined && !SUBJECT_TYPES.has(payload.subject_type)) {
    throw ApiError.validation('subject_type không hợp lệ.');
  }
  if (payload.deny_type !== undefined && !DENY_TYPES.has(payload.deny_type)) {
    throw ApiError.validation('deny_type không hợp lệ.');
  }
  if (payload.status !== undefined && !STATUSES.has(payload.status)) {
    throw ApiError.validation('status không hợp lệ.');
  }
  if (payload.severity !== undefined && !SEVERITIES.has(payload.severity)) {
    throw ApiError.validation('severity không hợp lệ.');
  }
}

function serializeDenyPolicy(policy, extra = {}) {
  const plain = typeof policy.toObject === 'function' ? policy.toObject() : policy;
  return {
    deny_policy_id: String(plain._id || plain.id),
    id: String(plain._id || plain.id),
    subject_type: plain.subject_type,
    subject_id: plain.subject_id,
    subject_label: plain.subject_label,
    deny_type: plain.deny_type,
    deny_value: plain.deny_value,
    scope: plain.scope || null,
    reason: plain.reason,
    severity: plain.severity,
    status: plain.status,
    effective_from: plain.effective_from,
    effective_to: plain.effective_to,
    approved_by: plain.approved_by ? String(plain.approved_by) : null,
    approved_at: plain.approved_at,
    metadata: plain.metadata || {},
    created_by: plain.created_by ? String(plain.created_by) : null,
    updated_by: plain.updated_by ? String(plain.updated_by) : null,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
    ...extra,
  };
}

function buildActiveTimeFilter(now = new Date()) {
  return {
    status: 'active',
    is_deleted: false,
    $and: [
      { $or: [{ effective_from: { $exists: false } }, { effective_from: null }, { effective_from: { $lte: now } }] },
      { $or: [{ effective_to: { $exists: false } }, { effective_to: null }, { effective_to: { $gte: now } }] },
    ],
  };
}

async function findDenyPolicyById(policyId) {
  if (!mongoose.Types.ObjectId.isValid(policyId)) throw ApiError.notFound('Không tìm thấy deny policy.');
  const policy = await DenyPolicy.findOne({ _id: policyId, is_deleted: false });
  if (!policy) throw ApiError.notFound('Không tìm thấy deny policy.');
  return policy;
}

async function getAffectedUserIdsForPolicy(policyLike = {}) {
  const subjectType = policyLike.subject_type;
  const subjectId = normalizeText(policyLike.subject_id);

  if (!subjectType || !subjectId) return [];

  if (subjectType === 'user') {
    if (!mongoose.Types.ObjectId.isValid(subjectId)) return [];
    const user = await User.findOne({ _id: subjectId, is_deleted: false }).select('_id').lean();
    return user ? [String(user._id)] : [];
  }

  if (subjectType === 'role') {
    const roleFilter = { is_deleted: false };
    if (mongoose.Types.ObjectId.isValid(subjectId)) roleFilter.$or = [{ _id: subjectId }, { role_code: normalizeLower(subjectId) }];
    else roleFilter.role_code = normalizeLower(subjectId);
    const role = await Role.findOne(roleFilter).select('_id').lean();
    if (!role) return [];
    const assignments = await UserRole.find({ role_id: role._id, is_active: true }).select('user_id').lean();
    return [...new Set(assignments.map((assignment) => String(assignment.user_id)))];
  }

  if (subjectType === 'department') {
    if (!mongoose.Types.ObjectId.isValid(subjectId)) return [];
    const users = await User.find({ department_id: subjectId, is_deleted: false }).select('_id').lean();
    return users.map((user) => String(user._id));
  }

  return [];
}

async function refreshAffectedAuthorization(policyLike = {}, actor = {}, requestMeta = {}, options = {}) {
  const userIds = await getAffectedUserIdsForPolicy(policyLike);
  if (!userIds.length) return { affected_user_ids: [], bumped_users: 0, revoked_sessions: 0 };

  const bumpedUsers = await bumpUsersPermissionVersion(userIds);
  let revokedSessions = 0;

  if (options.revokeSessions !== false) {
    for (const userId of userIds) {
      const result = await sessionService.invalidateAllUserSessions('staff', userId, requestMeta, {
        actorType: actor.actorType,
        actorId: getActorId(actor),
        reason: options.reason || 'deny_policy_changed',
        audit: false,
      });
      revokedSessions += result.revoked_count || 0;
    }
  }

  return {
    affected_user_ids: userIds,
    bumped_users: bumpedUsers,
    revoked_sessions: revokedSessions,
  };
}

async function listDenyPolicies(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = { is_deleted: false };

  if (query.subject_type) filter.subject_type = query.subject_type;
  if (query.subject_id) filter.subject_id = String(query.subject_id);
  if (query.deny_type) filter.deny_type = query.deny_type;
  if (query.deny_value) filter.deny_value = normalizeLower(query.deny_value);
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  if (query.active_only === 'true' || query.active_only === true) Object.assign(filter, buildActiveTimeFilter());

  const keyword = query.keyword || query.search;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [{ subject_id: regex }, { subject_label: regex }, { deny_value: regex }, { reason: regex }];
  }

  const [items, total] = await Promise.all([
    DenyPolicy.find(filter).sort({ severity: 1, created_at: -1 }).skip(skip).limit(limit).lean(),
    DenyPolicy.countDocuments(filter),
  ]);

  return {
    items: await Promise.all(items.map(async (item) => {
      const affectedUserIds = await getAffectedUserIdsForPolicy(item);
      return serializeDenyPolicy(item, { affected_user_count: affectedUserIds.length });
    })),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function previewDenyPolicy(payload = {}) {
  assertValidPolicyPayload(payload);
  const draft = {
    subject_type: payload.subject_type,
    subject_id: normalizeText(payload.subject_id),
    deny_type: payload.deny_type,
    deny_value: normalizeLower(payload.deny_value),
  };
  const affectedUserIds = await getAffectedUserIdsForPolicy(draft);
  const users = affectedUserIds.length
    ? await User.find({ _id: { $in: affectedUserIds } })
      .select('_id username full_name email status department_id permission_version')
      .limit(12)
      .lean()
    : [];

  return {
    policy: {
      ...draft,
      reason: normalizeText(payload.reason),
      severity: payload.severity || 'medium',
      status: payload.status || 'draft',
      effective_from: payload.effective_from || null,
      effective_to: payload.effective_to || null,
    },
    impact: {
      affected_user_count: affectedUserIds.length,
      affected_users: users.map((user) => ({
        user_id: String(user._id),
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        status: user.status,
        department_id: user.department_id ? String(user.department_id) : null,
        permission_version: Number(user.permission_version || 1),
      })),
      authorization_refresh_required: affectedUserIds.length > 0,
      session_revoke_recommended: affectedUserIds.length > 0,
    },
  };
}

async function createDenyPolicy(payload = {}, actor = {}, requestMeta = {}) {
  assertValidPolicyPayload(payload);

  const policy = await DenyPolicy.create({
    subject_type: payload.subject_type,
    subject_id: normalizeText(payload.subject_id),
    subject_label: normalizeText(payload.subject_label),
    deny_type: payload.deny_type,
    deny_value: normalizeLower(payload.deny_value),
    scope: payload.scope,
    reason: normalizeText(payload.reason),
    severity: payload.severity || 'medium',
    status: payload.status || 'draft',
    effective_from: parseDateOrNull(payload.effective_from),
    effective_to: parseDateOrNull(payload.effective_to),
    approved_by: payload.status === 'active' ? getActorId(actor) : undefined,
    approved_at: payload.status === 'active' ? new Date() : undefined,
    metadata: payload.metadata,
    created_by: getActorId(actor),
  });

  const impact = policy.status === 'active'
    ? await refreshAffectedAuthorization(policy, actor, requestMeta, { reason: 'deny_policy_created' })
    : await previewDenyPolicy(policy);

  await recordIamAudit({
    actor,
    action: 'deny_policies.create',
    targetType: 'deny_policy',
    targetId: policy._id,
    after: policy,
    message: 'Tạo deny policy thành công.',
    requestMeta,
    metadata: {
      impact,
    },
  });

  return { policy: serializeDenyPolicy(policy), impact };
}

async function updateDenyPolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  assertValidPolicyPayload(payload, { partial: true });
  const policy = await findDenyPolicyById(policyId);
  const before = policy.toObject();

  if (payload.status !== undefined && payload.status !== policy.status) {
    throw ApiError.validation('Đổi status deny policy phải dùng endpoint activate/deactivate.');
  }

  ['subject_type', 'deny_type', 'severity'].forEach((field) => {
    if (payload[field] !== undefined) policy[field] = payload[field];
  });
  if (payload.subject_id !== undefined) policy.subject_id = normalizeText(payload.subject_id);
  if (payload.subject_label !== undefined) policy.subject_label = normalizeText(payload.subject_label);
  if (payload.deny_value !== undefined) policy.deny_value = normalizeLower(payload.deny_value);
  if (payload.scope !== undefined) policy.scope = payload.scope;
  if (payload.reason !== undefined) policy.reason = normalizeText(payload.reason);
  if (payload.effective_from !== undefined) policy.effective_from = parseDateOrNull(payload.effective_from);
  if (payload.effective_to !== undefined) policy.effective_to = parseDateOrNull(payload.effective_to);
  if (payload.metadata !== undefined) policy.metadata = payload.metadata;
  policy.updated_by = getActorId(actor);
  await policy.save();

  const impact = policy.status === 'active'
    ? await refreshAffectedAuthorization(policy, actor, requestMeta, { reason: 'deny_policy_updated' })
    : await previewDenyPolicy(policy);

  await recordIamAudit({
    actor,
    action: 'deny_policies.update',
    targetType: 'deny_policy',
    targetId: policy._id,
    before,
    after: policy,
    message: 'Cập nhật deny policy thành công.',
    requestMeta,
    metadata: { impact },
  });

  return { policy: serializeDenyPolicy(policy), impact };
}

async function setDenyPolicyStatus(policyId, status, actor = {}, requestMeta = {}) {
  if (!['active', 'inactive'].includes(status)) throw ApiError.validation('Trạng thái deny policy không hợp lệ.');
  const policy = await findDenyPolicyById(policyId);
  const before = policy.toObject();

  if (status === 'active' && !isSuperAdmin(actor) && policy.severity === 'critical') {
    throw ApiError.forbidden('Chỉ super_admin mới được activate deny policy critical.');
  }

  policy.status = status;
  policy.approved_by = status === 'active' ? getActorId(actor) : policy.approved_by;
  policy.approved_at = status === 'active' ? new Date() : policy.approved_at;
  policy.updated_by = getActorId(actor);
  await policy.save();

  const impact = await refreshAffectedAuthorization(policy, actor, requestMeta, {
    reason: status === 'active' ? 'deny_policy_activated' : 'deny_policy_deactivated',
  });

  await recordIamAudit({
    actor,
    action: `deny_policies.${status}`,
    targetType: 'deny_policy',
    targetId: policy._id,
    before,
    after: policy,
    message: status === 'active' ? 'Kích hoạt deny policy thành công.' : 'Vô hiệu hóa deny policy thành công.',
    requestMeta,
    metadata: { impact },
  });

  return { policy: serializeDenyPolicy(policy), impact };
}

async function deleteDenyPolicySoft(policyId, actor = {}, requestMeta = {}) {
  const policy = await findDenyPolicyById(policyId);
  const before = policy.toObject();
  policy.is_deleted = true;
  policy.deleted_at = new Date();
  policy.deleted_by = getActorId(actor);
  policy.status = 'inactive';
  policy.updated_by = getActorId(actor);
  await policy.save();

  const impact = await refreshAffectedAuthorization(policy, actor, requestMeta, { reason: 'deny_policy_deleted' });

  await recordIamAudit({
    actor,
    action: 'deny_policies.delete_soft',
    targetType: 'deny_policy',
    targetId: policy._id,
    before,
    after: policy,
    message: 'Xóa mềm deny policy thành công.',
    requestMeta,
    metadata: { impact },
  });

  return { success: true, impact };
}

async function resolveActiveDenyPoliciesForActor(actor = {}) {
  const userId = actor.userId || actor.user_id || actor.actor_id || actor.actorId;
  const roles = actor.roles || [];
  const roleDetails = actor.roleDetails || actor.role_details || [];
  const roleSubjectIds = [
    ...roles,
    ...roleDetails.map((role) => role.role_code),
    ...roleDetails.map((role) => role.role_id),
  ].filter(Boolean).map(String);
  const departmentId = actor.departmentId || actor.department_id || actor.user?.department_id;

  const subjectClauses = [];
  if (userId) subjectClauses.push({ subject_type: 'user', subject_id: String(userId) });
  if (roleSubjectIds.length) subjectClauses.push({ subject_type: 'role', subject_id: { $in: [...new Set(roleSubjectIds)] } });
  if (departmentId) subjectClauses.push({ subject_type: 'department', subject_id: String(departmentId) });

  if (!subjectClauses.length) {
    return {
      policies: [],
      deniedRoles: [],
      deniedPermissions: [],
      deniedModules: [],
      deniedRoutes: [],
      deniedWorkspaces: [],
    };
  }

  const policies = await DenyPolicy.find({
    ...buildActiveTimeFilter(),
    $or: subjectClauses,
  }).lean();

  const byType = policies.reduce((accumulator, policy) => {
    const value = policy.deny_value;
    if (policy.deny_type === 'role') accumulator.deniedRoles.push(value);
    if (policy.deny_type === 'permission') accumulator.deniedPermissions.push(value);
    if (policy.deny_type === 'module') accumulator.deniedModules.push(value);
    if (policy.deny_type === 'route') accumulator.deniedRoutes.push(value);
    if (policy.deny_type === 'workspace') accumulator.deniedWorkspaces.push(value);
    return accumulator;
  }, {
    policies: policies.map((policy) => serializeDenyPolicy(policy)),
    deniedRoles: [],
    deniedPermissions: [],
    deniedModules: [],
    deniedRoutes: [],
    deniedWorkspaces: [],
  });

  return {
    policies: byType.policies,
    deniedRoles: [...new Set(byType.deniedRoles)],
    deniedPermissions: [...new Set(byType.deniedPermissions)],
    deniedModules: [...new Set(byType.deniedModules)],
    deniedRoutes: [...new Set(byType.deniedRoutes)],
    deniedWorkspaces: [...new Set(byType.deniedWorkspaces)],
  };
}

module.exports = {
  serializeDenyPolicy,
  listDenyPolicies,
  previewDenyPolicy,
  createDenyPolicy,
  updateDenyPolicy,
  setDenyPolicyStatus,
  deleteDenyPolicySoft,
  resolveActiveDenyPoliciesForActor,
  getAffectedUserIdsForPolicy,
};
