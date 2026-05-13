module.exports = {
  // policy: Xuất nhóm chính sách, hằng số và helper kiểm tra quyền/xác thực.
  policy: require('./iam.policy'),
  // roleService: Xuất các hàm quản lý vai trò IAM.
  roleService: require('./role.service'),
  // permissionService: Xuất các hàm quản lý quyền IAM.
  permissionService: require('./permission.service'),
  // rolePermissionService: Xuất các hàm gán và đồng bộ quyền cho vai trò.
  rolePermissionService: require('./role-permission.service'),
  // userRoleService: Xuất các hàm gán và truy vấn vai trò của nhân sự.
  userRoleService: require('./user-role.service'),
  // accessContextService: Xuất các hàm dựng ngữ cảnh quyền truy cập IAM.
  accessContextService: require('./access-context.service'),
  // seedService: Xuất hàm khởi tạo dữ liệu quyền/vai trò hệ thống.
  seedService: require('./iam-seed.service'),
};
