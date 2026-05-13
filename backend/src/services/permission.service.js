const permissionChecker = require('../common/permissions');
const { isLegacyPermission } = require('../constants/permissions');

module.exports = {
  // ...permissionChecker: Xuất lại các helper kiểm tra quyền dùng chung trong hệ thống.
  ...permissionChecker,
  // isLegacyPermission: Kiểm tra quyền theo cơ chế cũ.
  isLegacyPermission,
};
