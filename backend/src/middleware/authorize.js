const {
  hasAllPermissions,
  hasAnyPermission,
  requireActorType,
} = require('../services/access-control.service');

function authorize({ roles = [], permissions = [], allPermissions = [], anyPermissions = [], actorTypes = [] } = {}) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.auth) {
      return res.status(401).json({ success: false, message: 'Bạn chưa được xác thực.' });
    }

    if (!requireActorType(req.auth, actorTypes)) {
      return res.status(403).json({ success: false, message: 'Loại tài khoản này không được phép thực hiện chức năng này.' });
    }

    if (roles.length > 0) {
      const hasAllowedRole = req.auth.roles.some((role) => roles.includes(role));
      if (!hasAllowedRole) {
        return res.status(403).json({ success: false, message: 'Vai trò hiện tại không được phép thực hiện chức năng này.' });
      }
    }

    if (permissions.length > 0 && !hasAllPermissions(req.auth, permissions)) {
      return res.status(403).json({ success: false, message: 'Tài khoản hiện tại không có quyền truy cập chức năng này.' });
    }

    if (allPermissions.length > 0 && !hasAllPermissions(req.auth, allPermissions)) {
      return res.status(403).json({ success: false, message: 'Tài khoản hiện tại chưa có đủ tất cả quyền yêu cầu.' });
    }

    if (anyPermissions.length > 0 && !hasAnyPermission(req.auth, anyPermissions)) {
        return res.status(403).json({ success: false, message: 'Tài khoản hiện tại không có quyền truy cập chức năng này.' });
    }

    return next();
  };
}

module.exports = authorize;
