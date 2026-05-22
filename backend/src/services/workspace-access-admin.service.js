const ApiError = require('../common/errors/api-error');
const { escapeRegex, getPagination, buildPagination } = require('./core.service');
const auditService = require('./audit.service');
const permissionService = require('./permission.service');
const workspaceAccessService = require('./workspace-access.service');
const {
  AuditLog,
  Department,
  Permission,
  Role,
  RolePermission,
  User,
  UserPreference,
  UserRole,
  WorkspaceAccessPolicy,
} = require('../models');

const SYSTEM_FULL_ACCESS = 'system.full_access';
const INTERNAL_ACTOR_TYPES = ['staff'];
const PORTAL_ACTOR_TYPES = ['patient', 'patient_relative'];
const NO_UI_ACTOR_TYPES = ['system', 'service_account'];

const WORKSPACE_GROUPS = {
  admin: 'platform',
  scheduling: 'operations',
  reception: 'front-office',
  doctor: 'clinical',
  nursing: 'clinical',
  lab: 'clinical-ops',
  pharmacy: 'pharmacy',
  billing: 'finance',
  reports: 'analytics',
};

const DEPARTMENT_WORKSPACE_HINTS = [
  { match: ['xet nghiem', 'laboratory', 'lab'], workspaces: ['lab'] },
  { match: ['chan doan', 'imaging', 'cdha', 'radiology'], workspaces: ['lab', 'doctor'] },
  { match: ['thu thuat', 'procedure'], workspaces: ['lab', 'nursing'] },
  { match: ['duoc', 'pharmacy', 'nha thuoc', 'kho'], workspaces: ['pharmacy'] },
  { match: ['tai chinh', 'vien phi', 'billing', 'cashier', 'bao hiem'], workspaces: ['billing', 'reports'] },
  { match: ['cntt', 'it', 'hanh chinh', 'admin'], workspaces: ['admin', 'reports'] },
  { match: ['kham', 'clinical', 'noi', 'ngoai', 'san', 'nhi'], workspaces: ['scheduling', 'reception', 'doctor', 'nursing'] },
];

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeVietnamese(value) {
  return normalizeLower(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toId(value) {
  return value ? String(value) : null;
}

function unique(values = []) {
  return [...new Set(values.map(String).filter(Boolean))];
}

function getActorId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || actor.sub || null;
}

function workspaceDefinitions() {
  return workspaceAccessService.WORKSPACE_DEFINITIONS.map((workspace, index) => ({
    ...workspace,
    group_key: WORKSPACE_GROUPS[workspace.code] || 'general',
    status: 'active',
    order: index + 1,
    is_system: true,
    is_mutable: false,
  }));
}

function findWorkspace(code) {
  const workspace = workspaceDefinitions().find((item) => item.code === normalizeLower(code));
  if (!workspace) throw ApiError.notFound('Workspace không tồn tại.');
  return workspace;
}

function serializeWorkspace(workspace, extra = {}) {
  return {
    code: workspace.code,
    name: workspace.name,
    icon: workspace.icon,
    route: workspace.route,
    group_key: workspace.group_key || WORKSPACE_GROUPS[workspace.code] || 'general',
    status: workspace.status || 'active',
    is_system: workspace.is_system !== false,
    is_mutable: workspace.is_mutable === true,
    roles: workspace.roles || [],
    permissions_any: workspace.permissionsAny || workspace.permissions_any || [],
    permission_prefixes: workspace.permissionPrefixes || workspace.permission_prefixes || [],
    ...extra,
  };
}

function serializePolicy(policy = {}) {
  return {
    policy_id: toId(policy._id || policy.id),
    policy_name: policy.policy_name,
    workspace_code: policy.workspace_code,
    subject_type: policy.subject_type,
    subject_id: policy.subject_id ? String(policy.subject_id) : null,
    subject_code: policy.subject_code,
    effect: policy.effect,
    priority: policy.priority,
    conditions: policy.conditions || {},
    reason: policy.reason,
    valid_from: policy.valid_from,
    valid_to: policy.valid_to,
    status: policy.status,
    metadata: policy.metadata || {},
    created_by: policy.created_by ? String(policy.created_by) : null,
    updated_by: policy.updated_by ? String(policy.updated_by) : null,
    created_at: policy.created_at,
    updated_at: policy.updated_at,
  };
}

function isPolicyInWindow(policy = {}, now = new Date()) {
  if (policy.status !== 'active') return false;
  if (policy.valid_from && new Date(policy.valid_from) > now) return false;
  if (policy.valid_to && new Date(policy.valid_to) < now) return false;
  return true;
}

function baseWorkspaceDecision({ roles = [], permissions = [] }, workspace) {
  const roleCodes = unique(roles);
  const permissionCodes = unique(permissions);
  const fullAccess = roleCodes.includes('super_admin') || permissionService.hasPermission(permissionCodes, SYSTEM_FULL_ACCESS);
  const matchedRoles = roleCodes.filter((roleCode) => (workspace.roles || []).includes(roleCode));
  const matchedPermissions = (workspace.permissionsAny || []).filter((permissionCode) =>
    permissionService.hasPermission(permissionCodes, permissionCode),
  );
  const matchedPrefixes = (workspace.permissionPrefixes || []).filter((prefix) =>
    permissionCodes.some((permissionCode) => String(permissionCode).startsWith(prefix)),
  );
  const allowed = Boolean(fullAccess || matchedRoles.length || matchedPermissions.length || matchedPrefixes.length);

  return {
    allowed,
    full_access: fullAccess,
    matched_roles: matchedRoles,
    matched_permissions: matchedPermissions,
    matched_prefixes: matchedPrefixes,
    reason: fullAccess
      ? 'system.full_access'
      : matchedRoles.length
        ? `role:${matchedRoles.join(',')}`
        : matchedPermissions.length
          ? `permission:${matchedPermissions.join(',')}`
          : matchedPrefixes.length
            ? `permission_prefix:${matchedPrefixes.join(',')}`
            : 'missing_role_or_permission',
  };
}

function policyMatchesContext(policy, context = {}) {
  if (!isPolicyInWindow(policy)) return false;
  if (![context.workspace_code, '*', 'all'].includes(policy.workspace_code)) return false;

  const subjectCode = normalizeLower(policy.subject_code);
  const subjectId = policy.subject_id ? String(policy.subject_id) : null;
  const roles = unique(context.roles).map(normalizeLower);
  const permissions = unique(context.permissions).map(normalizeLower);

  if (policy.subject_type === 'actor_type') return subjectCode === normalizeLower(context.actor_type || 'staff');
  if (policy.subject_type === 'role') return roles.includes(subjectCode) || roles.includes(subjectId);
  if (policy.subject_type === 'user') {
    return [context.user_id, context.username, context.email].map((item) => normalizeLower(item)).includes(subjectCode)
      || String(context.user_id || '') === subjectId;
  }
  if (policy.subject_type === 'department') {
    return String(context.department_id || '') === subjectId
      || normalizeLower(context.department_code) === subjectCode;
  }
  if (policy.subject_type === 'permission') return permissions.includes(subjectCode);
  if (policy.subject_type === 'permission_prefix') return permissions.some((permission) => permission.startsWith(subjectCode));
  return false;
}

async function loadRbacMaps(userIds = null) {
  const [roles, permissions, rolePermissions, userRoles] = await Promise.all([
    Role.find({ is_deleted: false }).sort({ priority_level: -1, role_code: 1 }).lean(),
    Permission.find({ is_deleted: false }).lean(),
    RolePermission.find({ is_active: true }).lean(),
    UserRole.find({
      is_active: true,
      ...(Array.isArray(userIds) && userIds.length ? { user_id: { $in: userIds } } : {}),
    }).lean(),
  ]);

  const permissionById = new Map(permissions.map((permission) => [String(permission._id), permission]));
  const roleById = new Map(roles.map((role) => [String(role._id), role]));
  const rolePermissionsMap = new Map();
  rolePermissions.forEach((item) => {
    const roleId = String(item.role_id);
    const permission = permissionById.get(String(item.permission_id));
    if (!permission) return;
    const next = rolePermissionsMap.get(roleId) || [];
    next.push(permission.permission_code);
    rolePermissionsMap.set(roleId, next);
  });

  const userRolesMap = new Map();
  userRoles.forEach((item) => {
    const userId = String(item.user_id);
    const role = roleById.get(String(item.role_id));
    if (!role) return;
    const next = userRolesMap.get(userId) || [];
    next.push(role);
    userRolesMap.set(userId, next);
  });

  return {
    roles,
    permissions,
    roleById,
    rolePermissionsMap,
    userRolesMap,
  };
}

function permissionCodesForRoles(roles = [], rolePermissionsMap = new Map()) {
  return unique(roles.flatMap((role) => rolePermissionsMap.get(String(role._id || role.role_id || role.id)) || []));
}

async function loadPolicies(query = {}) {
  return WorkspaceAccessPolicy.find({ is_deleted: false, ...query }).sort({ priority: -1, updated_at: -1 }).lean();
}

async function explainWorkspaceAccess(input = {}) {
  const workspace = findWorkspace(input.workspace_code || input.workspace || 'admin');
  let context = {
    actor_type: input.actor_type || 'staff',
    workspace_code: workspace.code,
    user_id: input.user_id || null,
    username: input.username || null,
    email: input.email || null,
    department_id: input.department_id || null,
    department_code: input.department_code || null,
    roles: unique(input.roles || []),
    permissions: unique(input.permissions || []),
  };

  if (input.user_id) {
    const user = await User.findById(input.user_id).lean();
    if (!user || user.is_deleted) throw ApiError.notFound('Không tìm thấy nhân sự để kiểm tra workspace.');
    const rbac = await loadRbacMaps([user._id]);
    const roles = rbac.userRolesMap.get(String(user._id)) || [];
    context = {
      ...context,
      user_id: String(user._id),
      username: user.username,
      email: user.email,
      department_id: user.department_id ? String(user.department_id) : null,
      roles: roles.map((role) => role.role_code),
      permissions: permissionCodesForRoles(roles, rbac.rolePermissionsMap),
      user,
    };
  } else if (input.role_code) {
    const role = await Role.findOne({ role_code: normalizeLower(input.role_code), is_deleted: false }).lean();
    if (!role) throw ApiError.notFound('Không tìm thấy role để kiểm tra workspace.');
    const rbac = await loadRbacMaps();
    context = {
      ...context,
      roles: [role.role_code],
      permissions: permissionCodesForRoles([role], rbac.rolePermissionsMap),
    };
  }

  const base = baseWorkspaceDecision(context, workspace);
  const policies = await loadPolicies({
    workspace_code: { $in: [workspace.code, '*', 'all'] },
  });
  const matchedPolicies = policies.filter((policy) => policyMatchesContext(policy, context));
  const denyPolicies = matchedPolicies.filter((policy) => policy.effect === 'deny' || policy.effect === 'hide');
  const allowPolicies = matchedPolicies.filter((policy) => ['allow', 'readonly', 'maintenance_bypass'].includes(policy.effect));
  const allowed = denyPolicies.length ? false : allowPolicies.length ? true : base.allowed;
  const decision = allowed ? 'allow' : 'deny';
  const reason = denyPolicies.length
    ? 'deny_policy'
    : allowPolicies.length
      ? 'allow_policy'
      : base.reason;

  return {
    allowed,
    final_decision: decision,
    reason,
    workspace: serializeWorkspace(workspace),
    actor: {
      actor_type: context.actor_type,
      user_id: context.user_id,
      username: context.username,
      department_id: context.department_id,
      roles: context.roles,
      permission_count: context.permissions.length,
    },
    matched_roles: base.matched_roles,
    matched_permissions: base.matched_permissions,
    matched_prefixes: base.matched_prefixes,
    allowed_by: allowPolicies.map(serializePolicy),
    denied_by: denyPolicies.map(serializePolicy),
    policies_evaluated: matchedPolicies.map(serializePolicy),
    missing_roles: base.allowed ? [] : workspace.roles || [],
    missing_permissions: base.allowed ? [] : workspace.permissionsAny || [],
    explain: [
      `Workspace ${workspace.code} được định nghĩa trong code registry.`,
      `Actor type: ${context.actor_type}.`,
      `Roles hiệu lực: ${context.roles.length ? context.roles.join(', ') : 'không có role'}.`,
      `Permissions hiệu lực: ${context.permissions.length}.`,
      base.full_access ? 'Có super_admin hoặc system.full_access.' : `Base rule: ${base.reason}.`,
      denyPolicies.length ? `Deny policy: ${denyPolicies.map((item) => item.policy_name).join(', ')}.` : 'Không có deny policy đang hiệu lực.',
      allowPolicies.length ? `Allow policy: ${allowPolicies.map((item) => item.policy_name).join(', ')}.` : 'Không có allow policy override đang hiệu lực.',
      `Kết luận: ${decision.toUpperCase()}.`,
    ],
    recommendation: allowed
      ? ['Theo dõi audit nếu workspace thuộc nhóm nhạy cảm.', 'Validate sidebar/route guard sau khi đổi policy.']
      : ['Gán role phù hợp, thêm permission direct/prefix hoặc tạo allow policy có thời hạn.', 'Kiểm tra deny policy trước khi force đổi default workspace.'],
  };
}

async function getWorkspaceCoverage(rbac = null) {
  const maps = rbac || await loadRbacMaps();
  const users = await User.find({ is_deleted: false, status: { $ne: 'disabled' } }).select('_id status department_id username full_name').lean();
  const coverage = workspaceDefinitions().map((workspace) => ({
    ...serializeWorkspace(workspace),
    user_count: 0,
    active_user_count: 0,
    role_count: workspace.roles.length,
    direct_permission_count: workspace.permissionsAny.length,
    prefix_count: workspace.permissionPrefixes.length,
  }));
  const coverageByCode = new Map(coverage.map((item) => [item.code, item]));

  users.forEach((user) => {
    const roles = maps.userRolesMap.get(String(user._id)) || [];
    const permissions = permissionCodesForRoles(roles, maps.rolePermissionsMap);
    workspaceDefinitions().forEach((workspace) => {
      const decision = baseWorkspaceDecision({ roles: roles.map((role) => role.role_code), permissions }, workspace);
      if (!decision.allowed) return;
      const item = coverageByCode.get(workspace.code);
      item.user_count += 1;
      if (user.status === 'active') item.active_user_count += 1;
    });
  });

  return coverage;
}

async function getRoleWorkspaceMatrix() {
  const rbac = await loadRbacMaps();
  return rbac.roles.map((role) => {
    const permissions = permissionCodesForRoles([role], rbac.rolePermissionsMap);
    const workspaces = workspaceDefinitions().map((workspace) => {
      const decision = baseWorkspaceDecision({ roles: [role.role_code], permissions }, workspace);
      const source = decision.full_access
        ? 'FULL'
        : decision.matched_roles.length
          ? 'R'
          : decision.matched_permissions.length
            ? 'P'
            : decision.matched_prefixes.length
              ? 'PF'
              : 'DENY';
      return {
        code: workspace.code,
        name: workspace.name,
        allowed: decision.allowed,
        source,
        reason: decision.reason,
        matched_roles: decision.matched_roles,
        matched_permissions: decision.matched_permissions,
        matched_prefixes: decision.matched_prefixes,
      };
    });
    return {
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      priority_level: role.priority_level,
      status: role.status,
      permission_count: permissions.length,
      workspace_count: workspaces.filter((item) => item.allowed).length,
      workspaces,
    };
  });
}

async function getOverview() {
  const [rbac, policies, preferences, departments] = await Promise.all([
    loadRbacMaps(),
    loadPolicies(),
    UserPreference.find({ actor_type: 'staff' }).lean(),
    Department.find({ is_deleted: false }).lean(),
  ]);
  const coverage = await getWorkspaceCoverage(rbac);
  const matrix = await getRoleWorkspaceMatrix();
  const workspaceCodes = new Set(workspaceDefinitions().map((workspace) => workspace.code));
  const invalidPreferences = preferences.filter((preference) =>
    preference.current_workspace && !workspaceCodes.has(preference.current_workspace),
  );
  const roleRisks = matrix
    .filter((role) => role.workspace_count >= 5 || role.workspaces.some((workspace) => workspace.code === 'admin' && workspace.allowed))
    .slice(0, 8)
    .map((role) => ({
      severity: role.workspace_count >= 7 || role.role_code === 'super_admin' ? 'critical' : 'high',
      type: 'role_workspace_breadth',
      subject: role.role_code,
      message: `Role mở ${role.workspace_count} workspace.`,
      recommendation: 'Rà soát role priority, permission prefix và admin workspace.',
    }));
  const conflicts = scanPolicyConflictItems(policies);

  return {
    summary: {
      total_workspaces: workspaceCodes.size,
      active_workspaces: workspaceCodes.size,
      maintenance_workspaces: 0,
      hidden_workspaces: 0,
      role_count: rbac.roles.length,
      users_with_workspace: Math.max(...coverage.map((item) => item.user_count), 0),
      users_without_workspace: 0,
      invalid_preferences: invalidPreferences.length,
      policy_allow: policies.filter((policy) => policy.effect === 'allow').length,
      policy_deny: policies.filter((policy) => policy.effect === 'deny').length,
      policy_conflicts: conflicts.length,
      sidebar_errors: 0,
    },
    workspace_coverage: coverage,
    role_workspace_matrix: matrix,
    risk_items: [
      ...roleRisks,
      ...invalidPreferences.slice(0, 5).map((preference) => ({
        severity: 'medium',
        type: 'invalid_current_workspace',
        subject: String(preference.actor_id),
        message: `current_workspace=${preference.current_workspace} không còn hợp lệ.`,
        recommendation: 'Reset current/default workspace cho user.',
      })),
    ],
    recent_changes: await getAudit({ limit: 8 }),
    diagnostics: await getDiagnostics(),
  };
}

async function listWorkspaces() {
  const [coverage, policies] = await Promise.all([getWorkspaceCoverage(), loadPolicies()]);
  const coverageByCode = new Map(coverage.map((item) => [item.code, item]));
  return {
    items: workspaceDefinitions().map((workspace) => {
      const item = coverageByCode.get(workspace.code) || {};
      const workspacePolicies = policies.filter((policy) => policy.workspace_code === workspace.code);
      return serializeWorkspace(workspace, {
        user_count: item.user_count || 0,
        active_user_count: item.active_user_count || 0,
        policy_count: workspacePolicies.length,
        allow_policy_count: workspacePolicies.filter((policy) => policy.effect === 'allow').length,
        deny_policy_count: workspacePolicies.filter((policy) => policy.effect === 'deny').length,
        sidebar_config_status: 'generated',
        health: 'ok',
        risk_level: workspace.code === 'admin' ? 'critical' : ['billing', 'reports'].includes(workspace.code) ? 'high' : 'medium',
      });
    }),
  };
}

async function getWorkspaceDetail(code) {
  const workspace = findWorkspace(code);
  const [matrix, policies, audit] = await Promise.all([
    getRoleWorkspaceMatrix(),
    loadPolicies({ workspace_code: workspace.code }),
    getAudit({ workspace_code: workspace.code, limit: 10 }),
  ]);
  return serializeWorkspace(workspace, {
    roles_matrix: matrix.filter((role) => role.workspaces.some((item) => item.code === workspace.code && item.allowed)),
    policies: policies.map(serializePolicy),
    diagnostics: (await getDiagnostics()).items.filter((item) => item.workspace_code === workspace.code),
    audit,
  });
}

async function getByActor() {
  const workspaces = workspaceDefinitions();
  const actorTypes = [
    ...INTERNAL_ACTOR_TYPES,
    ...PORTAL_ACTOR_TYPES,
    ...NO_UI_ACTOR_TYPES,
  ];
  return {
    actor_types: actorTypes.map((actorType) => ({
      actor_type: actorType,
      boundary: INTERNAL_ACTOR_TYPES.includes(actorType) ? 'internal-workspace' : PORTAL_ACTOR_TYPES.includes(actorType) ? 'portal' : 'api-only',
      workspaces: workspaces.map((workspace) => ({
        code: workspace.code,
        name: workspace.name,
        allowed: actorType === 'staff',
        state: actorType === 'staff' ? 'allowed_by_internal_boundary' : 'blocked_by_actor_boundary',
        default_route: actorType === 'staff' ? workspace.route : null,
      })),
    })),
  };
}

async function getByRole() {
  return {
    workspaces: workspaceDefinitions().map(serializeWorkspace),
    roles: await getRoleWorkspaceMatrix(),
  };
}

async function listUsersAccess(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 80);
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.department_id) filter.department_id = query.department_id;
  const keyword = normalizeText(query.keyword || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = ['username', 'full_name', 'email', 'employee_code'].map((field) => ({ [field]: { $regex: pattern, $options: 'i' } }));
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ updated_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const rbac = await loadRbacMaps(users.map((user) => user._id));
  const preferences = await UserPreference.find({ actor_type: 'staff', actor_id: { $in: users.map((user) => user._id) } }).lean();
  const preferenceByUser = new Map(preferences.map((preference) => [String(preference.actor_id), preference]));
  const departments = await Department.find({ _id: { $in: users.map((user) => user.department_id).filter(Boolean) } }).lean();
  const departmentById = new Map(departments.map((department) => [String(department._id), department]));

  return {
    items: users.map((user) => {
      const roles = rbac.userRolesMap.get(String(user._id)) || [];
      const permissions = permissionCodesForRoles(roles, rbac.rolePermissionsMap);
      const workspaces = workspaceDefinitions().map((workspace) => {
        const decision = baseWorkspaceDecision({ roles: roles.map((role) => role.role_code), permissions }, workspace);
        return {
          code: workspace.code,
          name: workspace.name,
          route: workspace.route,
          allowed: decision.allowed,
          reason: decision.reason,
        };
      });
      const preference = preferenceByUser.get(String(user._id));
      return {
        user_id: String(user._id),
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        employee_code: user.employee_code,
        status: user.status,
        department_id: user.department_id ? String(user.department_id) : null,
        department_name: user.department_id ? departmentById.get(String(user.department_id))?.department_name || null : null,
        roles: roles.map((role) => role.role_code),
        permission_count: permissions.length,
        current_workspace: preference?.current_workspace || null,
        default_workspace: preference?.workspace_preferences?.default_workspace || preference?.current_workspace || null,
        available_workspaces: workspaces.filter((workspace) => workspace.allowed),
        workspace_count: workspaces.filter((workspace) => workspace.allowed).length,
        invalid_current_workspace: Boolean(preference?.current_workspace && !workspaces.some((workspace) => workspace.code === preference.current_workspace && workspace.allowed)),
        last_login_at: user.last_login_at,
        permission_version: user.permission_version,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

function inferDepartmentWorkspaces(department = {}) {
  const searchable = normalizeVietnamese([
    department.department_name,
    department.department_code,
    department.department_type,
  ].join(' '));
  const matched = DEPARTMENT_WORKSPACE_HINTS.find((item) => item.match.some((word) => searchable.includes(word)));
  return matched?.workspaces || ['scheduling', 'nursing', 'reports'];
}

async function getByDepartment() {
  const [departments, users] = await Promise.all([
    Department.find({ is_deleted: false }).sort({ department_name: 1 }).lean(),
    User.find({ is_deleted: false }).select('_id department_id status').lean(),
  ]);
  const usersByDepartment = users.reduce((map, user) => {
    const key = String(user.department_id || 'none');
    const value = map.get(key) || { total: 0, active: 0 };
    value.total += 1;
    if (user.status === 'active') value.active += 1;
    map.set(key, value);
    return map;
  }, new Map());

  return {
    departments: departments.map((department) => {
      const workspaces = inferDepartmentWorkspaces(department);
      const counts = usersByDepartment.get(String(department._id)) || { total: 0, active: 0 };
      return {
        department_id: String(department._id),
        department_code: department.department_code,
        department_name: department.department_name,
        department_type: department.department_type,
        status: department.status,
        head_user_id: department.head_user_id ? String(department.head_user_id) : null,
        active_staff_count: counts.active,
        staff_count: counts.total,
        default_workspace: workspaces[0],
        allowed_workspaces: workspaces.map((code) => workspaceDefinitions().find((workspace) => workspace.code === code)).filter(Boolean).map(serializeWorkspace),
        denied_workspaces: [],
        mapping_source: 'heuristic_from_department_type',
        risk_level: workspaces.includes('admin') ? 'high' : 'medium',
      };
    }),
  };
}

async function listPolicies(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = { is_deleted: false };
  if (query.workspace_code) filter.workspace_code = normalizeLower(query.workspace_code);
  if (query.effect) filter.effect = query.effect;
  if (query.subject_type) filter.subject_type = query.subject_type;
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    WorkspaceAccessPolicy.find(filter).sort({ priority: -1, updated_at: -1 }).skip(skip).limit(limit).lean(),
    WorkspaceAccessPolicy.countDocuments(filter),
  ]);
  return {
    items: items.map(serializePolicy),
    pagination: buildPagination(page, limit, total),
  };
}

function normalizePolicyPayload(payload = {}) {
  const workspaceCode = normalizeLower(payload.workspace_code || payload.workspace || '*');
  if (workspaceCode !== '*' && !workspaceDefinitions().some((workspace) => workspace.code === workspaceCode)) {
    throw ApiError.badRequest('workspace_code không hợp lệ.');
  }
  const subjectType = normalizeLower(payload.subject_type);
  if (!['actor_type', 'role', 'user', 'department', 'permission', 'permission_prefix'].includes(subjectType)) {
    throw ApiError.badRequest('subject_type không hợp lệ.');
  }
  const effect = normalizeLower(payload.effect || 'allow');
  if (!['allow', 'deny', 'hide', 'readonly', 'maintenance_bypass'].includes(effect)) {
    throw ApiError.badRequest('effect không hợp lệ.');
  }
  return {
    policy_name: normalizeText(payload.policy_name || payload.name || `${effect} ${workspaceCode} ${subjectType}`),
    workspace_code: workspaceCode,
    subject_type: subjectType,
    subject_id: payload.subject_id || payload.subjectId,
    subject_code: normalizeLower(payload.subject_code || payload.subjectCode || ''),
    effect,
    priority: Number(payload.priority || 100),
    conditions: payload.conditions || {},
    reason: normalizeText(payload.reason),
    valid_from: payload.valid_from || payload.validFrom || undefined,
    valid_to: payload.valid_to || payload.validTo || undefined,
    status: payload.status || 'active',
    metadata: payload.metadata || {},
  };
}

async function createPolicy(payload = {}, actor = {}, requestMeta = {}) {
  const data = normalizePolicyPayload(payload);
  const actorId = getActorId(actor);
  const policy = await WorkspaceAccessPolicy.create({ ...data, created_by: actorId, updated_by: actorId });
  await auditService.recordAuditLog({
    actor,
    action: 'workspace.policy.created',
    targetType: 'workspace_access_policy',
    targetId: policy._id,
    status: 'success',
    message: 'Tạo workspace access policy.',
    requestMeta,
    after: policy,
    metadata: { workspace_code: policy.workspace_code, effect: policy.effect },
  });
  return serializePolicy(policy.toObject());
}

async function updatePolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  const policy = await WorkspaceAccessPolicy.findById(policyId);
  if (!policy || policy.is_deleted) throw ApiError.notFound('Không tìm thấy workspace access policy.');
  const before = policy.toObject();
  Object.assign(policy, normalizePolicyPayload({ ...before, ...payload }), { updated_by: getActorId(actor) });
  await policy.save();
  await auditService.recordAuditLog({
    actor,
    action: 'workspace.policy.updated',
    targetType: 'workspace_access_policy',
    targetId: policy._id,
    status: 'success',
    message: 'Cập nhật workspace access policy.',
    requestMeta,
    before,
    after: policy,
    metadata: { workspace_code: policy.workspace_code, effect: policy.effect },
  });
  return serializePolicy(policy.toObject());
}

async function deletePolicy(policyId, actor = {}, requestMeta = {}) {
  const policy = await WorkspaceAccessPolicy.findById(policyId);
  if (!policy || policy.is_deleted) throw ApiError.notFound('Không tìm thấy workspace access policy.');
  policy.is_deleted = true;
  policy.deleted_at = new Date();
  policy.deleted_by = getActorId(actor);
  await policy.save();
  await auditService.recordAuditLog({
    actor,
    action: 'workspace.policy.deleted',
    targetType: 'workspace_access_policy',
    targetId: policy._id,
    status: 'success',
    message: 'Xóa mềm workspace access policy.',
    requestMeta,
    before: policy,
    metadata: { workspace_code: policy.workspace_code, effect: policy.effect },
  });
  return { deleted: true, policy_id: String(policy._id) };
}

function scanPolicyConflictItems(policies = []) {
  const active = policies.filter((policy) => isPolicyInWindow(policy));
  const bySubject = new Map();
  active.forEach((policy) => {
    const key = [
      policy.workspace_code,
      policy.subject_type,
      policy.subject_id ? String(policy.subject_id) : policy.subject_code,
    ].join(':');
    const items = bySubject.get(key) || [];
    items.push(policy);
    bySubject.set(key, items);
  });
  return [...bySubject.entries()].flatMap(([key, items]) => {
    const hasAllow = items.some((item) => item.effect === 'allow');
    const hasDeny = items.some((item) => item.effect === 'deny' || item.effect === 'hide');
    if (!hasAllow || !hasDeny) return [];
    const [workspaceCode, subjectType, subject] = key.split(':');
    return [{
      conflict_id: key,
      conflict_type: 'allow_vs_deny',
      workspace_code: workspaceCode,
      subject_type: subjectType,
      subject,
      policies: items.map(serializePolicy),
      final_decision: items.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0].effect,
      severity: 'high',
      affected_users: null,
      detected_at: new Date(),
      recommendation: 'Giữ một policy có priority rõ ràng hoặc disable policy trùng effect ngược chiều.',
    }];
  });
}

async function getConflicts() {
  const policies = await loadPolicies();
  return {
    summary: {
      total_conflicts: scanPolicyConflictItems(policies).length,
      duplicate_policies: 0,
      expired_active_policies: policies.filter((policy) => policy.status === 'active' && policy.valid_to && new Date(policy.valid_to) < new Date()).length,
      unused_policies: 0,
    },
    items: scanPolicyConflictItems(policies),
  };
}

async function getSidebarConfigs() {
  return {
    items: workspaceDefinitions().map((workspace) => ({
      workspace_code: workspace.code,
      workspace_name: workspace.name,
      actor_type: 'staff',
      version: 'generated-from-registry',
      status: 'published',
      item_count: 5,
      items: [
        { key: `${workspace.code}.dashboard`, label: 'Dashboard', route: workspace.route, required_roles: workspace.roles, required_permissions: workspace.permissionsAny.slice(0, 2), visible: true },
        { key: `${workspace.code}.worklist`, label: 'Worklist', route: workspace.route.replace('/dashboard', '/worklist'), required_roles: workspace.roles, required_permissions: workspace.permissionsAny.slice(0, 1), visible: true },
        { key: `${workspace.code}.reports`, label: 'Báo cáo', route: '/reports/dashboard', required_permissions: ['reports.read'], visible: workspace.code === 'reports' || workspace.roles.includes('manager') },
      ],
      diagnostics: [],
    })),
  };
}

async function getNavigationRules() {
  return {
    items: [
      { rule_id: 'lab-to-billing-charge', from_workspace: 'lab', to_workspace: 'billing', source_entity_type: 'clinical_order', target_entity_type: 'charge', action_key: 'view_charge', route_template: '/billing/charges/:chargeId', required_permissions: ['charges.read'], open_mode: 'drawer', status: 'generated', risk_level: 'medium' },
      { rule_id: 'billing-to-record', from_workspace: 'billing', to_workspace: 'reports', source_entity_type: 'invoice', target_entity_type: 'report', action_key: 'view_revenue_report', route_template: '/reports/billing/:invoiceId', required_permissions: ['reports.billing.read'], open_mode: 'new_tab', status: 'generated', risk_level: 'high' },
      { rule_id: 'admin-to-iam-context', from_workspace: 'admin', to_workspace: 'admin', source_entity_type: 'user', target_entity_type: 'access_context', action_key: 'open_access_context', route_template: '/admin/iam/context?userId=:userId', required_permissions: ['users.read', 'roles.read'], open_mode: 'drawer', status: 'generated', risk_level: 'high' },
    ],
  };
}

async function listPreferences(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const [preferences, total] = await Promise.all([
    UserPreference.find({ actor_type: 'staff' }).sort({ updated_at: -1 }).skip(skip).limit(limit).lean(),
    UserPreference.countDocuments({ actor_type: 'staff' }),
  ]);
  const users = await User.find({ _id: { $in: preferences.map((item) => item.actor_id).filter(Boolean) } }).lean();
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const workspaceCodes = new Set(workspaceDefinitions().map((workspace) => workspace.code));
  return {
    items: preferences.map((preference) => {
      const user = userById.get(String(preference.actor_id));
      const defaultWorkspace = preference.workspace_preferences?.default_workspace || preference.current_workspace;
      return {
        preference_id: String(preference._id),
        actor_type: preference.actor_type,
        actor_id: String(preference.actor_id),
        user: user ? {
          user_id: String(user._id),
          username: user.username,
          full_name: user.full_name,
          department_id: user.department_id ? String(user.department_id) : null,
          status: user.status,
        } : null,
        current_workspace: preference.current_workspace,
        default_workspace: defaultWorkspace,
        pinned_workspaces: preference.workspace_preferences?.pinned_workspaces || [],
        hidden_workspaces: preference.workspace_preferences?.hidden_workspaces || [],
        valid: (!preference.current_workspace || workspaceCodes.has(preference.current_workspace))
          && (!defaultWorkspace || workspaceCodes.has(defaultWorkspace)),
        updated_at: preference.updated_at,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function getDiagnostics() {
  const definitions = workspaceDefinitions();
  const [roles, permissions, preferences, policies] = await Promise.all([
    Role.find({ is_deleted: false }).select('role_code').lean(),
    Permission.find({ is_deleted: false }).select('permission_code').lean(),
    UserPreference.find({ actor_type: 'staff' }).lean(),
    loadPolicies(),
  ]);
  const roleCodes = new Set(roles.map((role) => role.role_code));
  const permissionCodes = new Set(permissions.map((permission) => permission.permission_code));
  const workspaceCodes = new Set(definitions.map((workspace) => workspace.code));
  const items = [];

  definitions.forEach((workspace) => {
    (workspace.roles || []).filter((role) => !roleCodes.has(role)).forEach((role) => {
      items.push({ check_key: `workspace.${workspace.code}.role.${role}`, workspace_code: workspace.code, group: 'iam_mapping', severity: 'high', status: 'failed', message: `Role ${role} chưa tồn tại trong role registry.`, recommendation: 'Seed system access hoặc sửa WORKSPACE_DEFINITIONS.' });
    });
    (workspace.permissionsAny || []).filter((permission) => !permissionCodes.has(permission)).forEach((permission) => {
      items.push({ check_key: `workspace.${workspace.code}.permission.${permission}`, workspace_code: workspace.code, group: 'iam_mapping', severity: 'medium', status: 'warning', message: `Permission ${permission} chưa tồn tại trong permission registry.`, recommendation: 'Seed permission hoặc loại khỏi workspace rule.' });
    });
    (workspace.permissionPrefixes || []).filter((prefix) => ['users.', 'roles.', 'permissions.', 'settings.'].includes(prefix)).forEach((prefix) => {
      items.push({ check_key: `workspace.${workspace.code}.prefix.${prefix}`, workspace_code: workspace.code, group: 'risk', severity: 'high', status: 'warning', message: `Permission prefix ${prefix} mở vùng quản trị rộng.`, recommendation: 'Ưu tiên permission direct hoặc deny policy bổ sung.' });
    });
  });

  preferences.filter((preference) => preference.current_workspace && !workspaceCodes.has(preference.current_workspace)).forEach((preference) => {
    items.push({ check_key: `preference.${preference._id}.current_workspace`, workspace_code: preference.current_workspace, group: 'preference', severity: 'medium', status: 'failed', message: `Preference current_workspace ${preference.current_workspace} không hợp lệ.`, recommendation: 'Reset current workspace cho actor.' });
  });

  policies.filter((policy) => policy.workspace_code !== '*' && !workspaceCodes.has(policy.workspace_code)).forEach((policy) => {
    items.push({ check_key: `policy.${policy._id}.workspace`, workspace_code: policy.workspace_code, group: 'policy', severity: 'high', status: 'failed', message: `Policy trỏ tới workspace ${policy.workspace_code} không tồn tại.`, recommendation: 'Disable hoặc sửa policy.' });
  });

  return {
    summary: {
      total_checks: definitions.length * 5 + preferences.length + policies.length,
      failed: items.filter((item) => item.status === 'failed').length,
      warnings: items.filter((item) => item.status === 'warning').length,
      ok: Math.max(definitions.length * 5 - items.length, 0),
    },
    items,
  };
}

async function getAudit(query = {}) {
  const limit = Math.min(Number(query.limit || 20), 100);
  const filter = { action: { $regex: '^workspace\\.' } };
  if (query.workspace_code) filter['metadata.workspace_code'] = query.workspace_code;
  const items = await AuditLog.find(filter).sort({ created_at: -1 }).limit(limit).lean();
  return items.map((item) => ({
    audit_log_id: String(item._id),
    actor_type: item.actor_type,
    actor_id: item.actor_id ? String(item.actor_id) : null,
    action: item.action,
    target_type: item.target_type,
    target_id: item.target_id ? String(item.target_id) : null,
    status: item.status,
    severity: item.severity,
    message: item.message,
    ip_address: item.ip_address,
    user_agent: item.user_agent,
    metadata: item.metadata,
    created_at: item.created_at,
  }));
}

async function checkAccess(payload = {}) {
  return explainWorkspaceAccess(payload);
}

async function validatePolicies() {
  const [conflicts, diagnostics] = await Promise.all([getConflicts(), getDiagnostics()]);
  return {
    valid: conflicts.items.length === 0 && diagnostics.summary.failed === 0,
    conflicts: conflicts.items,
    diagnostics: diagnostics.items,
  };
}

module.exports = {
  getOverview,
  listWorkspaces,
  getWorkspaceDetail,
  getByActor,
  getByRole,
  listUsersAccess,
  getByDepartment,
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  validatePolicies,
  getConflicts,
  getSidebarConfigs,
  getNavigationRules,
  listPreferences,
  getDiagnostics,
  getAudit,
  checkAccess,
  explainWorkspaceAccess,
};
