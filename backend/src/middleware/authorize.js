const {
  hasAllPermissions,
  hasAnyPermission,
  requireActorType,
} = require('../services/access-control.service');
const { ApiError } = require('../common');
const { ROLE_PRIORITY } = require('../constants/permissions');
const auditPolicy = require('../services/audit-policy.service');

function requestMeta(req = {}) {
  return {
    requestId: req.context?.request_id || req.headers?.['x-request-id'],
    sessionId: req.auth?.sessionId || req.auth?.session_id,
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'],
  };
}

function deny(req, next, message, metadata = {}) {
  auditPolicy.auditAccessDenied({
    actor: req.auth,
    action: 'access.denied',
    targetType: 'route',
    requestMeta: requestMeta(req),
    message,
    metadata: {
      method: req.method,
      path: req.originalUrl || req.url,
      ...metadata,
    },
  }).catch(() => {});
  return next(ApiError.forbidden(message));
}

function intersects(left = [], right = []) {
  const rightSet = new Set(right.filter(Boolean));
  return left.some((item) => rightSet.has(item));
}

function actorDeniedPermissions(auth = {}) {
  return auth.deniedPermissions || auth.denied_permissions || auth.explicitDenyPermissions || auth.explicit_deny_permissions || [];
}

function actorDeniedRoles(auth = {}) {
  return auth.deniedRoles || auth.denied_roles || auth.explicitDenyRoles || auth.explicit_deny_roles || [];
}

function maxRolePriority(roleCodes = []) {
  return Math.max(0, ...roleCodes.map((roleCode) => Number(ROLE_PRIORITY[roleCode] || 0)));
}

function evaluateDenyRules(rules = [], req) {
  for (const rule of rules) {
    if (typeof rule !== 'function') continue;
    const result = rule(req);
    if (result === true) return 'Truy cập bị chặn bởi deny policy.';
    if (typeof result === 'string' && result.trim()) return result;
  }
  return null;
}

function authorize({
  roles = [],
  permissions = [],
  allPermissions = [],
  anyPermissions = [],
  actorTypes = [],
  deniedRoles = [],
  deniedPermissions = [],
  denyRules = [],
  minRolePriority = null,
  sensitive = false,
  allowBreakGlass = false,
} = {}) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.auth) {
      return next(ApiError.unauthorized('Bạn chưa được xác thực.'));
    }

    if (!requireActorType(req.auth, actorTypes)) {
      return deny(req, next, 'Loại tài khoản này không được phép thực hiện chức năng này.', { actor_types: actorTypes });
    }

    const effectiveDeniedRoles = [...actorDeniedRoles(req.auth), ...deniedRoles];
    if (intersects(req.auth.roles || [], effectiveDeniedRoles)) {
      return deny(req, next, 'Vai trò hiện tại bị deny policy chặn truy cập chức năng này.', { denied_roles: effectiveDeniedRoles });
    }

    const requiredPermissionCodes = [...permissions, ...allPermissions, ...anyPermissions];
    const effectiveDeniedPermissions = [...actorDeniedPermissions(req.auth), ...deniedPermissions];
    if (intersects(requiredPermissionCodes, effectiveDeniedPermissions)) {
      return deny(req, next, 'Tài khoản hiện tại bị deny policy chặn quyền truy cập này.', { denied_permissions: effectiveDeniedPermissions });
    }

    const denyMessage = evaluateDenyRules(denyRules, req);
    if (denyMessage) {
      return deny(req, next, denyMessage);
    }

    if (minRolePriority !== null && maxRolePriority(req.auth.roles || []) < Number(minRolePriority)) {
      return deny(req, next, 'Vai trò hiện tại không đạt cấp quyền tối thiểu cho chức năng này.', { min_role_priority: minRolePriority });
    }

    if (sensitive && req.context) {
      req.context.authorization = {
        ...(req.context.authorization || {}),
        sensitive: true,
        break_glass: Boolean(req.auth.isBreakGlass || req.auth.is_break_glass),
      };
    }

    if (sensitive && (req.auth.isBreakGlass || req.auth.is_break_glass) && !allowBreakGlass) {
      return deny(req, next, 'Break-glass session không được phép thực hiện chức năng này nếu route chưa bật allowBreakGlass.');
    }

    if (roles.length > 0) {
      const hasAllowedRole = (req.auth.roles || []).some((role) => roles.includes(role));
      if (!hasAllowedRole) {
        return deny(req, next, 'Vai trò hiện tại không được phép thực hiện chức năng này.', { required_roles: roles });
      }
    }

    if (permissions.length > 0 && !hasAllPermissions(req.auth, permissions)) {
      return deny(req, next, 'Tài khoản hiện tại không có quyền truy cập chức năng này.', { required_permissions: permissions });
    }

    if (allPermissions.length > 0 && !hasAllPermissions(req.auth, allPermissions)) {
      return deny(req, next, 'Tài khoản hiện tại chưa có đủ tất cả quyền yêu cầu.', { all_permissions: allPermissions });
    }

    if (anyPermissions.length > 0 && !hasAnyPermission(req.auth, anyPermissions)) {
      return deny(req, next, 'Tài khoản hiện tại không có quyền truy cập chức năng này.', { any_permissions: anyPermissions });
    }

    return next();
  };
}

module.exports = authorize;
