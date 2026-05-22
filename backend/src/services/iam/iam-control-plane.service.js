const ApiError = require('../../common/errors/api-error');
const { mongoose } = require('../../config/database');
const { buildPaginationMeta, normalizePagination } = require('../../common/helpers/pagination.helper');
const { buildDateRangeFilter, buildRegexSearch } = require('../../common/helpers/query.helper');
const {
  CANONICAL_PERMISSION_CODES,
  CORE_ROLES,
  LEGACY_PERMISSION_CODES,
  PERMISSION,
  ROLE_PERMISSION_MAP,
  getPermissionDefinition,
} = require('../../constants/permissions');
const { AuditLog, AuthSession, DenyPolicy, Permission, Role, RolePermission, User, UserRole } = require('../../models');
const permissionChecker = require('../permission.service');
const {
  buildUserAuthorizationSnapshot,
  bumpUserPermissionVersion,
  bumpUsersPermissionVersion,
  clearAllAuthorizationCache,
  clearUserAuthorizationCache,
  getAuthorizationCacheStatus,
} = require('../access-control.service');
const sessionService = require('../auth/auth-session.service');
const workspaceAccess = require('../workspace-access.service');
const accessContextService = require('./access-context.service');
const roleService = require('./role.service');
const rolePermissionService = require('./role-permission.service');
const userRoleService = require('./user-role.service');
const { seedSystemAccess } = require('./iam-seed.service');
const { recordIamAudit } = require('./iam-audit.helper');
const { getActorId } = require('./iam.policy');
const { getPermissionRisk, summarizePermissionRisk } = require('./iam-risk.helper');
const denyPolicyService = require('./deny-policy.service');

function toId(value) {
  return value ? String(value) : null;
}

function unique(values = []) {
  return [...new Set(values.map(String).filter(Boolean))];
}

function serializeAuditLog(item = {}) {
  return {
    audit_log_id: toId(item._id || item.id),
    actor_type: item.actor_type,
    actor_id: item.actor_id ? String(item.actor_id) : null,
    action: item.action,
    module_key: item.module_key,
    target_type: item.target_type,
    target_id: item.target_id ? String(item.target_id) : null,
    status: item.status,
    severity: item.severity,
    message: item.message,
    ip_address: item.ip_address,
    user_agent: item.user_agent,
    before: item.before,
    after: item.after,
    metadata: item.metadata,
    created_at: item.created_at,
  };
}

function actorLikeForUser(user, roles = [], permissions = []) {
  return {
    actorType: 'staff',
    userId: String(user._id || user.id),
    departmentId: user.department_id ? String(user.department_id) : null,
    roles: roles.map((role) => role.role_code || role),
    roleDetails: roles.map((role) => ({
      role_id: toId(role._id || role.role_id),
      role_code: role.role_code,
      role_name: role.role_name,
      priority_level: Number(role.priority_level || 0),
    })),
    permissions,
    user,
  };
}

function workspaceAccessMatrix(roles = [], permissions = []) {
  const roleCodes = roles.map((role) => role.role_code || role);
  const permissionCodes = Array.isArray(permissions) ? permissions : [];

  return workspaceAccess.WORKSPACE_DEFINITIONS.map((workspace) => {
    const roleMatch = roleCodes.find((roleCode) => workspace.roles?.includes(roleCode));
    const permissionMatch = (workspace.permissionsAny || []).find((permissionCode) =>
      permissionChecker.hasPermission(permissionCodes, permissionCode),
    );
    const prefixMatch = (workspace.permissionPrefixes || []).find((prefix) =>
      permissionCodes.some((permissionCode) => String(permissionCode).startsWith(prefix)),
    );
    const fullAccess = permissionChecker.hasPermission(permissionCodes, PERMISSION.SYSTEM.FULL_ACCESS);
    const allowed = Boolean(fullAccess || roleMatch || permissionMatch || prefixMatch);

    return {
      code: workspace.code,
      name: workspace.name,
      icon: workspace.icon,
      route: workspace.route,
      allowed,
      reason: fullAccess
        ? 'system.full_access'
        : roleMatch
          ? `role:${roleMatch}`
          : permissionMatch
            ? `permission:${permissionMatch}`
            : prefixMatch
              ? `permission_prefix:${prefixMatch}`
              : 'missing_role_or_permission',
    };
  });
}

function permissionImpactedWorkspaces(permissionCode) {
  return workspaceAccess.WORKSPACE_DEFINITIONS
    .filter((workspace) =>
      (workspace.permissionsAny || []).includes(permissionCode) ||
      (workspace.permissionPrefixes || []).some((prefix) => String(permissionCode).startsWith(prefix)),
    )
    .map((workspace) => ({
      code: workspace.code,
      name: workspace.name,
      route: workspace.route,
    }));
}

async function getUserIdsByRoleIds(roleIds = []) {
  if (!roleIds.length) return [];
  const assignments = await UserRole.find({ role_id: { $in: roleIds }, is_active: true }).select('user_id').lean();
  return unique(assignments.map((assignment) => assignment.user_id));
}

async function getRolePermissionCodesMap(roleIds = []) {
  const rolePermissions = await RolePermission.find({ role_id: { $in: roleIds }, is_active: true }).lean();
  const permissionIds = unique(rolePermissions.map((item) => item.permission_id));
  const permissions = permissionIds.length
    ? await Permission.find({ _id: { $in: permissionIds }, is_deleted: false }).lean()
    : [];
  const permissionById = new Map(permissions.map((permission) => [String(permission._id), permission]));
  const map = new Map();

  rolePermissions.forEach((item) => {
    const permission = permissionById.get(String(item.permission_id));
    if (!permission) return;
    const roleId = String(item.role_id);
    if (!map.has(roleId)) map.set(roleId, []);
    map.get(roleId).push(permission.permission_code);
  });

  return map;
}

async function getIamOverview(query = {}) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [roles, permissions, activeUserRoles, activeRolePermissions, staffTotal, recentChanges, recentDenied] = await Promise.all([
    Role.find({ is_deleted: false }).sort({ priority_level: -1, role_code: 1 }).lean(),
    Permission.find({ is_deleted: false }).sort({ module_key: 1, permission_code: 1 }).lean(),
    UserRole.find({ is_active: true }).lean(),
    RolePermission.find({ is_active: true }).lean(),
    User.countDocuments({ is_deleted: false }),
    AuditLog.find({
      action: /^(roles|permissions|role_permissions|user_roles|iam|deny_policies)\./,
      created_at: { $gte: dayAgo },
    }).sort({ created_at: -1 }).limit(10).lean(),
    AuditLog.find({
      action: 'access.denied',
      created_at: { $gte: dayAgo },
    }).sort({ created_at: -1 }).limit(10).lean(),
  ]);

  const roleIdsWithUsers = new Set(activeUserRoles.map((item) => String(item.role_id)));
  const userIdsWithRoles = new Set(activeUserRoles.map((item) => String(item.user_id)));
  const permissionIdsWithRoles = new Set(activeRolePermissions.map((item) => String(item.permission_id)));
  const activeRoleIds = new Set(roles.filter((role) => role.status === 'active').map((role) => String(role._id)));
  const permissionById = new Map(permissions.map((permission) => [String(permission._id), permission]));
  const rolePermissionCodes = new Map();

  activeRolePermissions.forEach((item) => {
    const permission = permissionById.get(String(item.permission_id));
    if (!permission) return;
    const roleId = String(item.role_id);
    if (!rolePermissionCodes.has(roleId)) rolePermissionCodes.set(roleId, []);
    rolePermissionCodes.get(roleId).push(permission.permission_code);
  });

  const fullAccessPermission = permissions.find((permission) => permission.permission_code === PERMISSION.SYSTEM.FULL_ACCESS);
  const fullAccessRoleIds = fullAccessPermission
    ? activeRolePermissions
      .filter((item) => String(item.permission_id) === String(fullAccessPermission._id))
      .map((item) => String(item.role_id))
    : [];
  const fullAccessUserIds = new Set(
    activeUserRoles
      .filter((item) => fullAccessRoleIds.includes(String(item.role_id)))
      .map((item) => String(item.user_id)),
  );

  const [staffWithoutRole, accessDeniedToday, activeDenyPolicies] = await Promise.all([
    User.countDocuments({ is_deleted: false, _id: { $nin: [...userIdsWithRoles] } }),
    AuditLog.countDocuments({ action: 'access.denied', created_at: { $gte: today } }),
    DenyPolicy.countDocuments({
      status: 'active',
      is_deleted: false,
      $and: [
        { $or: [{ effective_from: { $exists: false } }, { effective_from: null }, { effective_from: { $lte: now } }] },
        { $or: [{ effective_to: { $exists: false } }, { effective_to: null }, { effective_to: { $gte: now } }] },
      ],
    }),
  ]);

  const roleRiskItems = roles.map((role) => {
    const permissionCodes = rolePermissionCodes.get(String(role._id)) || [];
    const risk = summarizePermissionRisk(permissionCodes);
    return {
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      priority_level: Number(role.priority_level || 0),
      user_count: activeUserRoles.filter((item) => String(item.role_id) === String(role._id)).length,
      permission_count: permissionCodes.length,
      risk,
    };
  });

  const dangerousPermissions = permissions
    .map((permission) => ({ permission, risk: getPermissionRisk(permission.permission_code) }))
    .filter((item) => ['critical', 'high', 'medium'].includes(item.risk.level));

  const roleSegments = roles.slice(0, 8).map((role) => ({
    role_id: String(role._id),
    role_code: role.role_code,
    role_name: role.role_name,
    count: activeUserRoles.filter((item) => String(item.role_id) === String(role._id)).length,
  }));

  return {
    generated_at: now,
    roles: {
      total: roles.length,
      active: roles.filter((role) => role.status === 'active').length,
      inactive: roles.filter((role) => role.status !== 'active').length,
      system: roles.filter((role) => role.is_system).length,
      custom: roles.filter((role) => !role.is_system).length,
      locked: roles.filter((role) => role.is_mutable === false).length,
      without_users: roles.filter((role) => !roleIdsWithUsers.has(String(role._id))).length,
      critical: roleRiskItems.filter((item) => item.risk.max_level === 'critical').length,
      high: roleRiskItems.filter((item) => item.risk.max_level === 'high').length,
    },
    permissions: {
      total: permissions.length,
      system: permissions.filter((permission) => permission.is_system).length,
      custom: permissions.filter((permission) => !permission.is_system).length,
      deprecated: permissions.filter((permission) => permission.deprecated_at && permission.deprecated_at <= now).length,
      orphan: permissions.filter((permission) => !permissionIdsWithRoles.has(String(permission._id))).length,
      sensitive: dangerousPermissions.length,
      critical: dangerousPermissions.filter((item) => item.risk.level === 'critical').length,
      high: dangerousPermissions.filter((item) => item.risk.level === 'high').length,
    },
    assignments: {
      user_role_count: activeUserRoles.length,
      role_permission_count: activeRolePermissions.length,
      staff_total: staffTotal,
      staff_without_role: staffWithoutRole,
      users_with_full_access: fullAccessUserIds.size,
      active_role_ids: activeRoleIds.size,
    },
    risk: {
      critical_roles: roleRiskItems.filter((item) => item.risk.max_level === 'critical').length,
      critical_users: fullAccessUserIds.size,
      dangerous_permissions: dangerousPermissions.length,
      access_denied_today: accessDeniedToday,
      iam_changes_24h: recentChanges.length,
      active_deny_policies: activeDenyPolicies,
    },
    top_roles: roleRiskItems.sort((left, right) => right.risk.score - left.risk.score).slice(0, 8),
    role_segments: roleSegments,
    module_breakdown: Object.values(permissions.reduce((accumulator, permission) => {
      const moduleKey = permission.module_key || 'general';
      if (!accumulator[moduleKey]) {
        accumulator[moduleKey] = { module_key: moduleKey, permission_count: 0, critical_count: 0, high_count: 0 };
      }
      const risk = getPermissionRisk(permission.permission_code);
      accumulator[moduleKey].permission_count += 1;
      if (risk.level === 'critical') accumulator[moduleKey].critical_count += 1;
      if (risk.level === 'high') accumulator[moduleKey].high_count += 1;
      return accumulator;
    }, {})).sort((left, right) => right.permission_count - left.permission_count),
    recent_changes: recentChanges.map(serializeAuditLog),
    recent_denied: recentDenied.map(serializeAuditLog),
    flags: {
      include_samples: query.include_samples !== 'false',
      cache: getAuthorizationCacheStatus(),
    },
  };
}

async function getIamMatrix(query = {}) {
  const roleFilter = { is_deleted: false };
  const permissionFilter = { is_deleted: false };
  if (query.role_status) roleFilter.status = query.role_status;
  if (query.module_key) permissionFilter.module_key = query.module_key;

  const keyword = query.keyword || query.search;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    permissionFilter.$or = [{ permission_code: regex }, { permission_name: regex }];
  }

  const [roles, permissions, rolePermissions, userRoles] = await Promise.all([
    Role.find(roleFilter).sort({ priority_level: -1, role_code: 1 }).lean(),
    Permission.find(permissionFilter).sort({ module_key: 1, permission_code: 1 }).lean(),
    RolePermission.find({ is_active: true }).lean(),
    UserRole.find({ is_active: true }).lean(),
  ]);

  const roleIds = roles.map((role) => String(role._id));
  const permissionIds = permissions.map((permission) => String(permission._id));
  const permissionById = new Map(permissions.map((permission) => [String(permission._id), permission]));
  const grantsByRole = roleIds.reduce((accumulator, roleId) => ({ ...accumulator, [roleId]: [] }), {});
  const rolesByPermission = permissionIds.reduce((accumulator, permissionId) => ({ ...accumulator, [permissionId]: [] }), {});

  rolePermissions.forEach((item) => {
    const roleId = String(item.role_id);
    const permissionId = String(item.permission_id);
    const permission = permissionById.get(permissionId);
    if (!roleIds.includes(roleId) || !permissionIds.includes(permissionId) || !permission) return;
    grantsByRole[roleId].push(permission.permission_code);
    rolesByPermission[permissionId].push(roleId);
  });

  const userCountByRole = userRoles.reduce((accumulator, item) => {
    const roleId = String(item.role_id);
    accumulator[roleId] = (accumulator[roleId] || 0) + 1;
    return accumulator;
  }, {});

  return {
    generated_at: new Date(),
    roles: roles.map((role) => {
      const permissionCodes = grantsByRole[String(role._id)] || [];
      return {
        role_id: String(role._id),
        role_code: role.role_code,
        role_name: role.role_name,
        status: role.status,
        is_system: Boolean(role.is_system),
        is_mutable: role.is_mutable !== false,
        priority_level: Number(role.priority_level || 0),
        user_count: userCountByRole[String(role._id)] || 0,
        permission_count: permissionCodes.length,
        risk: summarizePermissionRisk(permissionCodes),
      };
    }),
    permissions: permissions.map((permission) => ({
      permission_id: String(permission._id),
      permission_code: permission.permission_code,
      permission_name: permission.permission_name,
      module_key: permission.module_key,
      action_key: permission.action_key,
      is_system: Boolean(permission.is_system),
      is_mutable: permission.is_mutable !== false,
      deprecated_at: permission.deprecated_at,
      role_count: (rolesByPermission[String(permission._id)] || []).length,
      risk: getPermissionRisk(permission.permission_code),
      workspaces: permissionImpactedWorkspaces(permission.permission_code),
    })),
    modules: Object.values(permissions.reduce((accumulator, permission) => {
      const moduleKey = permission.module_key || 'general';
      if (!accumulator[moduleKey]) accumulator[moduleKey] = { module_key: moduleKey, permission_count: 0 };
      accumulator[moduleKey].permission_count += 1;
      return accumulator;
    }, {})),
    grants: Object.fromEntries(
      Object.entries(grantsByRole).map(([roleId, permissionCodes]) => [roleId, unique(permissionCodes).sort()]),
    ),
  };
}

async function previewRolePermissionChange(payload = {}, actor = {}) {
  const roleId = payload.role_id || payload.roleId;
  const permissionCodes = payload.permission_codes || payload.permissionCodes || [];
  if (!roleId || !Array.isArray(permissionCodes)) {
    throw ApiError.validation('role_id và permission_codes là bắt buộc.');
  }

  const role = await roleService.findRoleByIdOrCode(roleId);
  const before = await rolePermissionService.getRolePermissions(role._id, { grouped: false });
  const currentCodes = new Set(before.permission_codes || []);
  const nextCodes = new Set(permissionCodes.map(String));
  const added = [...nextCodes].filter((code) => !currentCodes.has(code));
  const removed = [...currentCodes].filter((code) => !nextCodes.has(code));
  const unchanged = [...nextCodes].filter((code) => currentCodes.has(code));
  const usage = await roleService.getRoleUsageSummary(role._id);

  return {
    role: {
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      status: role.status,
      priority_level: Number(role.priority_level || 0),
    },
    before: {
      permission_count: currentCodes.size,
      permission_codes: [...currentCodes].sort(),
      risk: summarizePermissionRisk([...currentCodes]),
    },
    after: {
      permission_count: nextCodes.size,
      permission_codes: [...nextCodes].sort(),
      risk: summarizePermissionRisk([...nextCodes]),
    },
    diff: {
      added_permission_codes: added.sort(),
      removed_permission_codes: removed.sort(),
      unchanged_permission_codes: unchanged.sort(),
      sensitive_added: added.map((code) => ({ permission_code: code, risk: getPermissionRisk(code) })).filter((item) => item.risk.sensitive),
      sensitive_removed: removed.map((code) => ({ permission_code: code, risk: getPermissionRisk(code) })).filter((item) => item.risk.sensitive),
    },
    impact: {
      affected_user_count: usage.user_count || 0,
      active_user_count: usage.active_user_count || 0,
      sessions_to_revoke_estimate: usage.active_user_count || 0,
      permission_cache_versions_to_bump: usage.user_count || 0,
    },
    actor_limits: {
      actor_roles: actor.roles || [],
      actor_permission_count: (actor.permissions || []).length,
    },
  };
}

async function applyRolePermissionMatrix(payload = {}, actor = {}, requestMeta = {}) {
  if (payload.role_id || payload.roleId) {
    const roleId = payload.role_id || payload.roleId;
    const permissionCodes = payload.permission_codes || payload.permissionCodes || [];
    const preview = await previewRolePermissionChange({ role_id: roleId, permission_codes: permissionCodes }, actor);
    const result = await rolePermissionService.syncRolePermissions(roleId, { permission_codes: permissionCodes }, actor, requestMeta);
    return { preview, result };
  }

  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  if (!changes.length) throw ApiError.validation('changes hoặc role_id + permission_codes là bắt buộc.');

  const byRole = changes.reduce((accumulator, change) => {
    const roleId = String(change.role_id || change.roleId || '');
    if (!roleId) return accumulator;
    if (!accumulator[roleId]) accumulator[roleId] = [];
    accumulator[roleId].push(change);
    return accumulator;
  }, {});

  const applied = [];
  for (const [roleId, roleChanges] of Object.entries(byRole)) {
    const current = await rolePermissionService.getRolePermissions(roleId, { grouped: false });
    const codes = new Set(current.permission_codes || []);
    roleChanges.forEach((change) => {
      const code = String(change.permission_code || change.permissionCode || '');
      if (!code) return;
      if (change.granted === false || change.action === 'remove') codes.delete(code);
      else codes.add(code);
    });
    const preview = await previewRolePermissionChange({ role_id: roleId, permission_codes: [...codes] }, actor);
    const result = await rolePermissionService.syncRolePermissions(roleId, { permission_codes: [...codes] }, actor, requestMeta);
    applied.push({ role_id: roleId, preview, result });
  }

  return { applied };
}

async function getStaffEffectivePermissions(userId, query = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');

  const roles = await accessContextService.getActiveRolesForUser(user._id);
  const roleIds = roles.map((role) => role._id);
  const rolePermissions = roleIds.length
    ? await RolePermission.find({ role_id: { $in: roleIds }, is_active: true }).lean()
    : [];
  const permissionIds = unique(rolePermissions.map((item) => item.permission_id));
  const permissions = permissionIds.length
    ? await Permission.find({ _id: { $in: permissionIds }, is_deleted: false }).lean()
    : [];

  const roleById = new Map(roles.map((role) => [String(role._id), role]));
  const permissionById = new Map(permissions.map((permission) => [String(permission._id), permission]));
  const sourceMap = new Map();

  rolePermissions.forEach((item) => {
    const permission = permissionById.get(String(item.permission_id));
    const role = roleById.get(String(item.role_id));
    if (!permission || !role) return;
    const code = permission.permission_code;
    if (!sourceMap.has(code)) {
      sourceMap.set(code, {
        permission,
        granted_by_roles: [],
      });
    }
    sourceMap.get(code).granted_by_roles.push({
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      priority_level: Number(role.priority_level || 0),
    });
  });

  const permissionCodes = [...sourceMap.keys()].sort();
  const denyContext = await denyPolicyService.resolveActiveDenyPoliciesForActor(actorLikeForUser(user, roles, permissionCodes));
  const deniedPermissionSet = new Set(denyContext.deniedPermissions || []);
  const deniedModules = denyContext.deniedModules || [];
  const items = permissionCodes.map((code) => {
    const item = sourceMap.get(code);
    const deniedBy = denyContext.policies.filter((policy) =>
      (policy.deny_type === 'permission' && policy.deny_value === code) ||
      (policy.deny_type === 'module' && (code === policy.deny_value || code.startsWith(`${policy.deny_value}.`))),
    );
    return {
      permission_id: String(item.permission._id),
      permission_code: code,
      permission_name: item.permission.permission_name,
      module_key: item.permission.module_key,
      action_key: item.permission.action_key,
      description: item.permission.description,
      is_system: Boolean(item.permission.is_system),
      is_mutable: item.permission.is_mutable !== false,
      granted_by_roles: item.granted_by_roles,
      denied: deniedPermissionSet.has(code) || deniedModules.some((moduleKey) => code === moduleKey || code.startsWith(`${moduleKey}.`)),
      denied_by: deniedBy,
      risk: getPermissionRisk(code),
      workspaces: permissionImpactedWorkspaces(code),
    };
  });

  return {
    user: {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      department_id: user.department_id ? String(user.department_id) : null,
      status: user.status,
      permission_version: Number(user.permission_version || 1),
      must_change_password: Boolean(user.must_change_password),
    },
    roles: roles.map((role) => ({
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      priority_level: Number(role.priority_level || 0),
      status: role.status,
      is_system: Boolean(role.is_system),
    })),
    permissions: query.includeSources === false || query.include_sources === 'false'
      ? items.map(({ granted_by_roles, denied_by, ...item }) => item)
      : items,
    permission_codes: permissionCodes,
    has_full_access: permissionChecker.hasPermission(permissionCodes, PERMISSION.SYSTEM.FULL_ACCESS),
    risk: summarizePermissionRisk(permissionCodes),
    deny_context: denyContext,
    workspaces: workspaceAccessMatrix(roles, permissionCodes),
  };
}

async function previewStaffRoleChange(userId, payload = {}, actor = {}) {
  const roleCodes = payload.role_codes || payload.roleIds || payload.role_ids || [];
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');

  const beforeRoles = await accessContextService.getActiveRolesForUser(user._id);
  const beforePermissionCodes = await accessContextService.getEffectivePermissionsForRoles(beforeRoles.map((role) => role._id));
  const nextRoles = roleCodes.length ? await userRoleService.validateRoleAssignable(roleCodes, actor) : [];
  const afterPermissionCodes = await accessContextService.getEffectivePermissionsForRoles(nextRoles.map((role) => role._id));
  const beforeSet = new Set(beforePermissionCodes);
  const afterSet = new Set(afterPermissionCodes);

  return {
    user: {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      status: user.status,
      department_id: user.department_id ? String(user.department_id) : null,
      permission_version: Number(user.permission_version || 1),
    },
    before: {
      roles: beforeRoles.map((role) => role.role_code),
      permission_count: beforePermissionCodes.length,
      risk: summarizePermissionRisk(beforePermissionCodes),
      workspaces: workspaceAccessMatrix(beforeRoles, beforePermissionCodes),
    },
    after: {
      roles: nextRoles.map((role) => role.role_code),
      permission_count: afterPermissionCodes.length,
      risk: summarizePermissionRisk(afterPermissionCodes),
      workspaces: workspaceAccessMatrix(nextRoles, afterPermissionCodes),
    },
    diff: {
      added_permissions: afterPermissionCodes.filter((code) => !beforeSet.has(code)).sort(),
      removed_permissions: beforePermissionCodes.filter((code) => !afterSet.has(code)).sort(),
      sensitive_added: afterPermissionCodes
        .filter((code) => !beforeSet.has(code))
        .map((code) => ({ permission_code: code, risk: getPermissionRisk(code) }))
        .filter((item) => item.risk.sensitive),
    },
    impact: {
      sessions_to_revoke_estimate: 1,
      permission_version_will_increment: true,
      realtime_event: 'user.role_changed',
    },
  };
}

async function explainAccess(payload = {}, actor = {}) {
  const userId = payload.user_id || payload.userId;
  const requiredPermissions = unique([
    ...(payload.permission_codes || payload.permissionCodes || []),
    payload.permission_code || payload.permissionCode,
  ]);
  if (!userId) throw ApiError.validation('user_id là bắt buộc.');
  if (!requiredPermissions.length) throw ApiError.validation('permission_code hoặc permission_codes là bắt buộc.');

  const context = await getStaffEffectivePermissions(userId, { includeSources: true });
  const permissionCodes = context.permission_codes || [];
  const missingPermissions = requiredPermissions.filter((permissionCode) =>
    !permissionChecker.hasPermission(permissionCodes, permissionCode),
  );
  const matchedPermissions = requiredPermissions.filter((permissionCode) =>
    permissionChecker.hasPermission(permissionCodes, permissionCode),
  );
  const deniedBy = context.deny_context.policies.filter((policy) =>
    requiredPermissions.some((permissionCode) =>
      (policy.deny_type === 'permission' && policy.deny_value === permissionCode) ||
      (policy.deny_type === 'module' && (permissionCode === policy.deny_value || permissionCode.startsWith(`${policy.deny_value}.`))),
    ),
  );

  const workspaceCode = payload.workspace || payload.workspace_code;
  const workspaceResult = workspaceCode
    ? context.workspaces.find((workspace) => workspace.code === workspaceCode) || {
      code: workspaceCode,
      allowed: false,
      reason: 'workspace_not_defined',
    }
    : null;

  const deniedByPolicy = deniedBy.length > 0;
  const deniedByWorkspace = workspaceResult && !workspaceResult.allowed;
  const allowed = missingPermissions.length === 0 && !deniedByPolicy && !deniedByWorkspace;
  const explain = [
    `User ${context.user.username || context.user.user_id} có ${context.roles.length} role active.`,
    context.has_full_access ? 'User có system.full_access nên pass mọi permission nếu không bị deny policy.' : `User có ${permissionCodes.length} permission hiệu lực.`,
    matchedPermissions.length ? `Matched: ${matchedPermissions.join(', ')}.` : 'Không match permission yêu cầu trực tiếp.',
    missingPermissions.length ? `Missing: ${missingPermissions.join(', ')}.` : 'Không thiếu permission yêu cầu.',
    deniedByPolicy ? `Deny policy chặn: ${deniedBy.map((policy) => policy.deny_value).join(', ')}.` : 'Không có deny policy chặn permission yêu cầu.',
    workspaceResult ? `Workspace ${workspaceResult.code}: ${workspaceResult.allowed ? 'allowed' : 'denied'} (${workspaceResult.reason}).` : 'Không kiểm tra workspace.',
    `Kết luận: ${allowed ? 'ALLOW' : 'DENY'}.`,
  ];

  return {
    allowed,
    decision: allowed ? 'allow' : 'deny',
    reason: deniedByPolicy
      ? 'deny_policy'
      : deniedByWorkspace
        ? 'workspace_denied'
        : missingPermissions.length
          ? 'missing_permission'
          : 'matched_permission',
    required_permissions: requiredPermissions,
    matched_permissions: matchedPermissions,
    missing_permissions: missingPermissions,
    roles: context.roles,
    granted_by: context.permissions
      .filter((permission) => requiredPermissions.includes(permission.permission_code))
      .flatMap((permission) => permission.granted_by_roles.map((role) => ({
        permission_code: permission.permission_code,
        ...role,
      }))),
    denied_by: deniedBy,
    workspace_result: workspaceResult,
    explain,
    diagnostic: {
      actor_requester: {
        actor_type: actor.actorType,
        user_id: actor.userId,
        roles: actor.roles || [],
      },
      target_user: context.user,
    },
  };
}

async function getCacheStatus() {
  const [activeSessions, staleSessions] = await Promise.all([
    AuthSession.countDocuments({ actor_type: 'staff', revoked_at: null, expires_at: { $gt: new Date() } }),
    AuthSession.countDocuments({ actor_type: 'staff', revoked_at: { $ne: null } }),
  ]);

  return {
    authorization_cache: getAuthorizationCacheStatus(),
    sessions: {
      active_staff_sessions: activeSessions,
      revoked_staff_sessions: staleSessions,
    },
    notes: [
      'Authorization cache hiện là in-memory theo user_id + permission_version.',
      'Rebuild user sẽ clear cache tiến trình hiện tại và có thể bump permission_version để token/session nhận quyền mới.',
    ],
  };
}

async function rebuildUserPermissionContext(userId, payload = {}, actor = {}, requestMeta = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');

  clearUserAuthorizationCache(user._id);
  let permissionVersion = Number(user.permission_version || 1);
  if (payload.bump_version !== false && payload.bumpVersion !== false) {
    permissionVersion = await bumpUserPermissionVersion(user._id);
  }

  const snapshot = await buildUserAuthorizationSnapshot(user._id, permissionVersion);
  let revoked = { revoked_count: 0 };
  if (payload.force_logout || payload.forceLogout) {
    revoked = await sessionService.invalidateAllUserSessions('staff', user._id, requestMeta, {
      actorType: actor.actorType,
      actorId: getActorId(actor),
      reason: 'permission_cache_rebuild',
      audit: false,
    });
  }

  await recordIamAudit({
    actor,
    action: 'iam.cache.rebuild_user',
    targetType: 'user',
    targetId: user._id,
    message: 'Rebuild permission context cho user thành công.',
    requestMeta,
    metadata: {
      permission_version: permissionVersion,
      force_logout: Boolean(payload.force_logout || payload.forceLogout),
      revoked_sessions: revoked.revoked_count || 0,
    },
  });

  return {
    user_id: String(user._id),
    permission_version: permissionVersion,
    snapshot,
    revoked_sessions: revoked.revoked_count || 0,
    cache_rebuilt: true,
  };
}

async function rebuildRolePermissionContext(roleIdOrCode, payload = {}, actor = {}, requestMeta = {}) {
  const role = await roleService.findRoleByIdOrCode(roleIdOrCode);
  const assignments = await UserRole.find({ role_id: role._id, is_active: true }).lean();
  const userIds = unique(assignments.map((assignment) => assignment.user_id));
  userIds.forEach(clearUserAuthorizationCache);

  let bumpedUsers = 0;
  if (payload.bump_version !== false && payload.bumpVersion !== false) {
    bumpedUsers = await bumpUsersPermissionVersion(userIds);
  }

  let revokedSessions = 0;
  if (payload.force_logout || payload.forceLogout) {
    for (const userId of userIds) {
      const result = await sessionService.invalidateAllUserSessions('staff', userId, requestMeta, {
        actorType: actor.actorType,
        actorId: getActorId(actor),
        reason: 'role_permission_cache_rebuild',
        audit: false,
      });
      revokedSessions += result.revoked_count || 0;
    }
  }

  await recordIamAudit({
    actor,
    action: 'iam.cache.rebuild_role',
    targetType: 'role',
    targetId: role._id,
    message: 'Rebuild permission context cho role thành công.',
    requestMeta,
    metadata: {
      affected_user_count: userIds.length,
      bumped_users: bumpedUsers,
      revoked_sessions: revokedSessions,
    },
  });

  return {
    role_id: String(role._id),
    role_code: role.role_code,
    affected_user_count: userIds.length,
    bumped_users: bumpedUsers,
    revoked_sessions: revokedSessions,
    cache_rebuilt: true,
  };
}

async function rebuildAllPermissionContexts(payload = {}, actor = {}, requestMeta = {}) {
  const users = await User.find({ is_deleted: false }).select('_id').lean();
  const userIds = users.map((user) => String(user._id));
  const clearedEntries = clearAllAuthorizationCache();
  let bumpedUsers = 0;
  if (payload.bump_version !== false && payload.bumpVersion !== false) {
    bumpedUsers = await bumpUsersPermissionVersion(userIds);
  }

  await recordIamAudit({
    actor,
    action: 'iam.cache.rebuild_all',
    targetType: 'system',
    message: 'Rebuild permission context toàn hệ thống thành công.',
    requestMeta,
    metadata: {
      affected_user_count: userIds.length,
      bumped_users: bumpedUsers,
      cleared_entries: clearedEntries,
    },
  });

  return {
    affected_user_count: userIds.length,
    bumped_users: bumpedUsers,
    cleared_entries: clearedEntries,
    cache_rebuilt: true,
  };
}

async function seedSystemAccessDryRun() {
  const [roles, permissions, rolePermissions] = await Promise.all([
    Role.find({}).lean(),
    Permission.find({}).lean(),
    RolePermission.find({}).lean(),
  ]);
  const roleByCode = new Map(roles.map((role) => [role.role_code, role]));
  const permissionByCode = new Map(permissions.map((permission) => [permission.permission_code, permission]));
  const permissionById = new Map(permissions.map((permission) => [String(permission._id), permission]));
  const roleById = new Map(roles.map((role) => [String(role._id), role]));
  const activeRolePermissionKeys = new Set(
    rolePermissions
      .filter((item) => item.is_active)
      .map((item) => `${String(item.role_id)}:${String(item.permission_id)}`),
  );

  const rolesToCreate = [];
  const rolesToUpdate = [];
  CORE_ROLES.forEach((definition) => {
    const current = roleByCode.get(definition.role_code);
    if (!current) rolesToCreate.push(definition);
    else {
      const changes = [];
      ['role_name', 'priority_level'].forEach((field) => {
        if (String(current[field]) !== String(definition[field])) changes.push(field);
      });
      if (!current.is_system || current.is_deleted || current.status !== 'active') changes.push('system/status');
      if (changes.length) rolesToUpdate.push({ role_code: definition.role_code, changes });
    }
  });

  const permissionsToCreate = [];
  const permissionsToUpdate = [];
  CANONICAL_PERMISSION_CODES.forEach((permissionCode) => {
    const definition = getPermissionDefinition(permissionCode);
    const current = permissionByCode.get(permissionCode);
    if (!current) permissionsToCreate.push(definition);
    else {
      const changes = [];
      ['permission_name', 'module_key', 'action_key'].forEach((field) => {
        if (String(current[field] || '') !== String(definition[field] || '')) changes.push(field);
      });
      if (!current.is_system || current.is_deleted) changes.push('system/deleted');
      if (changes.length) permissionsToUpdate.push({ permission_code: permissionCode, changes });
    }
  });

  const legacyPermissionsToRetire = permissions
    .filter((permission) => LEGACY_PERMISSION_CODES.includes(permission.permission_code) && !permission.is_deleted)
    .map((permission) => ({
      permission_id: String(permission._id),
      permission_code: permission.permission_code,
    }));
  const legacyIds = new Set(legacyPermissionsToRetire.map((permission) => permission.permission_id));
  const legacyRolePermissionsToDeactivate = rolePermissions
    .filter((item) => item.is_active && legacyIds.has(String(item.permission_id)))
    .map((item) => {
      const permission = permissionById.get(String(item.permission_id));
      const role = roleById.get(String(item.role_id));
      return {
        role_permission_id: String(item._id),
        role_code: role?.role_code,
        permission_code: permission?.permission_code,
      };
    });

  const rolePermissionsToUpsert = [];
  Object.entries(ROLE_PERMISSION_MAP).forEach(([roleCode, permissionCodes]) => {
    const role = roleByCode.get(roleCode);
    permissionCodes.forEach((permissionCode) => {
      const permission = permissionByCode.get(permissionCode);
      if (!role || !permission) {
        rolePermissionsToUpsert.push({ role_code: roleCode, permission_code: permissionCode, missing_dependency: true });
        return;
      }
      const key = `${String(role._id)}:${String(permission._id)}`;
      if (!activeRolePermissionKeys.has(key)) {
        rolePermissionsToUpsert.push({ role_code: roleCode, permission_code: permissionCode, missing_dependency: false });
      }
    });
  });

  return {
    roles_to_create: rolesToCreate,
    roles_to_update: rolesToUpdate,
    permissions_to_create: permissionsToCreate,
    permissions_to_update: permissionsToUpdate,
    legacy_permissions_to_retire: legacyPermissionsToRetire,
    legacy_role_permissions_to_deactivate: legacyRolePermissionsToDeactivate,
    role_permissions_to_upsert: rolePermissionsToUpsert,
    summary: {
      roles_to_create: rolesToCreate.length,
      roles_to_update: rolesToUpdate.length,
      permissions_to_create: permissionsToCreate.length,
      permissions_to_update: permissionsToUpdate.length,
      legacy_permissions_to_retire: legacyPermissionsToRetire.length,
      legacy_role_permissions_to_deactivate: legacyRolePermissionsToDeactivate.length,
      role_permissions_to_upsert: rolePermissionsToUpsert.length,
    },
  };
}

async function getIamAudit(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {
    action: /^(roles|permissions|role_permissions|user_roles|iam|deny_policies)\./,
    ...buildDateRangeFilter('created_at', query.from, query.to),
  };
  if (query.action) filter.action = query.action;
  if (query.target_type) filter.target_type = query.target_type;
  if (query.actor_id) filter.actor_id = query.actor_id;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map(serializeAuditLog),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function runSeedSystemAccess(actor = {}, requestMeta = {}) {
  return seedSystemAccess(actor, requestMeta);
}

module.exports = {
  getIamOverview,
  getIamMatrix,
  previewRolePermissionChange,
  applyRolePermissionMatrix,
  getStaffEffectivePermissions,
  previewStaffRoleChange,
  explainAccess,
  getCacheStatus,
  rebuildUserPermissionContext,
  rebuildRolePermissionContext,
  rebuildAllPermissionContexts,
  seedSystemAccessDryRun,
  runSeedSystemAccess,
  getIamAudit,
};
