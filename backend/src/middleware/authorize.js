function authorize({ roles = [], permissions = [], actorTypes = [] } = {}) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.auth) {
      return res.status(401).json({ success: false, message: 'Bạn chưa được xác thực.' });
    }

    if (actorTypes.length > 0 && !actorTypes.includes(req.auth.actorType)) {
      return res.status(403).json({ success: false, message: 'Loại tài khoản này không được phép thực hiện chức năng này.' });
    }

    if (roles.length > 0) {
      const hasAllowedRole = req.auth.roles.some((role) => roles.includes(role));
      if (!hasAllowedRole) {
        return res.status(403).json({ success: false, message: 'Vai trò hiện tại không được phép thực hiện chức năng này.' });
      }
    }

    if (permissions.length > 0) {
      const authPermissions = req.auth.permissions || [];
      const hasPermission = permissions.every((permission) => authPermissions.includes(permission));
      if (!hasPermission) {
        return res.status(403).json({ success: false, message: 'Tài khoản hiện tại không có quyền truy cập chức năng này.' });
      }
    }

    return next();
  };
}

module.exports = authorize;
