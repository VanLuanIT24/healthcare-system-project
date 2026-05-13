const { Department, Permission, RolePermission, Role, UserRole, User } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  departmentRepository: Department,
  permissionRepository: Permission,
  rolePermissionRepository: RolePermission,
  roleRepository: Role,
  userRoleRepository: UserRole,
  userRepository: User,
});
