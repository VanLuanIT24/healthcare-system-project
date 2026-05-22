const iamService = require('../services/iam.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

async function createRole(req, res, next) {
  try {
    const result = await iamService.createRole(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Tạo role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listRoles(req, res, next) {
  try {
    const result = await iamService.listRoles(req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getRoleDetail(req, res, next) {
  try {
    const result = await iamService.getRoleDetail(req.params.roleId);
    return sendSuccess(res, {
      message: 'Lấy chi tiết role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateRole(req, res, next) {
  try {
    const result = await iamService.updateRole(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Cập nhật role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateRoleStatus(req, res, next) {
  try {
    const result = await iamService.updateRoleStatus(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Cập nhật trạng thái role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function assignPermissionsToRole(req, res, next) {
  try {
    const result = await iamService.assignPermissionsToRole(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Gán permission cho role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getRolePermissions(req, res, next) {
  try {
    const result = await iamService.getRolePermissions(req.params.roleId);
    return sendSuccess(res, {
      message: 'Lấy permission của role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listPermissions(req, res, next) {
  try {
    const result = await iamService.listPermissions(req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách permission thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listPermissionsGrouped(req, res, next) {
  try {
    const result = await iamService.listPermissionsGrouped(req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách permission theo module thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function createPermission(req, res, next) {
  try {
    const result = await iamService.createPermission(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Tạo permission thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getPermissionDetail(req, res, next) {
  try {
    const result = await iamService.getPermissionDetail(req.params.permissionId);
    return sendSuccess(res, {
      message: 'Lấy chi tiết permission thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updatePermission(req, res, next) {
  try {
    const result = await iamService.updatePermission(req.params.permissionId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Cập nhật permission thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function removePermissionsFromRole(req, res, next) {
  try {
    const result = await iamService.removePermissionsFromRole(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Gỡ permission khỏi role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function syncRolePermissions(req, res, next) {
  try {
    const result = await iamService.syncRolePermissions(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Đồng bộ permission cho role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function removeRolesFromStaff(req, res, next) {
  try {
    const result = await iamService.removeRolesFromStaff(req.params.userId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Gỡ role khỏi staff thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function syncStaffRoles(req, res, next) {
  try {
    const result = await iamService.syncStaffRoles(req.params.userId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Đồng bộ role cho staff thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffRoles(req, res, next) {
  try {
    const result = await iamService.getStaffRoles(req.params.userId);
    return sendSuccess(res, {
      message: 'Lấy role của staff thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getUsersByRole(req, res, next) {
  try {
    const result = await iamService.getUsersByRole(req.params.roleId, req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách user theo role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffPermissions(req, res, next) {
  try {
    const result = await iamService.getStaffPermissions(req.params.userId);
    return sendSuccess(res, {
      message: 'Lấy permission của staff thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffAccessContext(req, res, next) {
  try {
    const result = await iamService.buildStaffPermissionContext(req.params.userId);
    return sendSuccess(res, {
      message: 'Lấy access context của staff thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function rebuildUserPermissionCache(req, res, next) {
  try {
    const result = await iamService.rebuildUserPermissionCache(req.params.userId);
    return sendSuccess(res, {
      message: 'Làm mới permission map của user thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function checkStaffPermission(req, res, next) {
  try {
    const result = await iamService.checkStaffPermission(req.params.userId, req.query.permission_code);
    return sendSuccess(res, {
      message: 'Kiểm tra permission thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function seedSystemAccess(req, res, next) {
  try {
    const result = await iamService.seedSystemAccess(req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Seed role và permission mặc định thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getRoleUsageSummary(req, res, next) {
  try {
    const result = await iamService.getRoleUsageSummary(req.params.roleId);
    return sendSuccess(res, {
      message: 'Lấy thống kê sử dụng role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getPermissionUsageSummary(req, res, next) {
  try {
    const result = await iamService.getPermissionUsageSummary(req.params.permissionId);
    return sendSuccess(res, {
      message: 'Lấy thống kê sử dụng permission thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deleteRoleSoft(req, res, next) {
  try {
    const result = await iamService.deleteRoleSoft(req.params.roleId, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Xóa mềm role thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deletePermissionSoft(req, res, next) {
  try {
    const result = await iamService.deletePermissionSoft(req.params.permissionId, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Xóa mềm permission thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

const getIamOverview = wrap(
  (req) => iamService.getIamOverview(req.query),
  'Lấy tổng quan IAM thành công.',
);

const getIamMatrix = wrap(
  (req) => iamService.getIamMatrix(req.query),
  'Lấy ma trận quyền thành công.',
);

const previewRolePermissionChange = wrap(
  (req) => iamService.previewRolePermissionChange(req.body, req.auth),
  'Preview thay đổi phân quyền thành công.',
);

const applyRolePermissionMatrix = wrap(
  (req) => iamService.applyRolePermissionMatrix(req.body, req.auth, requestMeta(req)),
  'Áp dụng thay đổi ma trận quyền thành công.',
);

const previewStaffRoleChange = wrap(
  (req) => iamService.previewStaffRoleChange(req.params.userId, req.body, req.auth),
  'Preview thay đổi vai trò nhân sự thành công.',
);

const getStaffEffectivePermissions = wrap(
  (req) => iamService.getStaffEffectivePermissions(req.params.userId, req.query),
  'Lấy quyền hiệu lực kèm nguồn cấp thành công.',
);

const explainAccess = wrap(
  (req) => iamService.explainAccess(req.body, req.auth),
  'Giải thích quyết định truy cập thành công.',
);

const getCacheStatus = wrap(
  () => iamService.getCacheStatus(),
  'Lấy trạng thái cache quyền thành công.',
);

const rebuildUserPermissionContext = wrap(
  (req) => iamService.rebuildUserPermissionContext(req.params.userId, req.body, req.auth, requestMeta(req)),
  'Rebuild permission context của user thành công.',
);

const rebuildRolePermissionContext = wrap(
  (req) => iamService.rebuildRolePermissionContext(req.params.roleId, req.body, req.auth, requestMeta(req)),
  'Rebuild permission context theo role thành công.',
);

const rebuildAllPermissionContexts = wrap(
  (req) => iamService.rebuildAllPermissionContexts(req.body, req.auth, requestMeta(req)),
  'Rebuild permission context toàn hệ thống thành công.',
);

const seedSystemAccessDryRun = wrap(
  () => iamService.seedSystemAccessDryRun(),
  'Preview seed system access thành công.',
);

const getIamAudit = wrap(
  (req) => iamService.getIamAudit(req.query),
  'Lấy audit IAM thành công.',
);

const listDenyPolicies = wrap(
  (req) => iamService.listDenyPolicies(req.query),
  'Lấy danh sách deny policy thành công.',
);

const previewDenyPolicy = wrap(
  (req) => iamService.previewDenyPolicy(req.body),
  'Preview deny policy thành công.',
);

const createDenyPolicy = wrap(
  (req) => iamService.createDenyPolicy(req.body, req.auth, requestMeta(req)),
  'Tạo deny policy thành công.',
  201,
);

const updateDenyPolicy = wrap(
  (req) => iamService.updateDenyPolicy(req.params.denyPolicyId, req.body, req.auth, requestMeta(req)),
  'Cập nhật deny policy thành công.',
);

const activateDenyPolicy = wrap(
  (req) => iamService.setDenyPolicyStatus(req.params.denyPolicyId, 'active', req.auth, requestMeta(req)),
  'Kích hoạt deny policy thành công.',
);

const deactivateDenyPolicy = wrap(
  (req) => iamService.setDenyPolicyStatus(req.params.denyPolicyId, 'inactive', req.auth, requestMeta(req)),
  'Vô hiệu hóa deny policy thành công.',
);

const deleteDenyPolicySoft = wrap(
  (req) => iamService.deleteDenyPolicySoft(req.params.denyPolicyId, req.auth, requestMeta(req)),
  'Xóa mềm deny policy thành công.',
);

module.exports = {
  getIamOverview,
  getIamMatrix,
  previewRolePermissionChange,
  applyRolePermissionMatrix,
  previewStaffRoleChange,
  getStaffEffectivePermissions,
  explainAccess,
  getCacheStatus,
  rebuildUserPermissionContext,
  rebuildRolePermissionContext,
  rebuildAllPermissionContexts,
  seedSystemAccessDryRun,
  getIamAudit,
  listDenyPolicies,
  previewDenyPolicy,
  createDenyPolicy,
  updateDenyPolicy,
  activateDenyPolicy,
  deactivateDenyPolicy,
  deleteDenyPolicySoft,
  createRole,
  createPermission,
  listRoles,
  getRoleDetail,
  updateRole,
  updateRoleStatus,
  assignPermissionsToRole,
  syncRolePermissions,
  getRolePermissions,
  listPermissions,
  listPermissionsGrouped,
  getPermissionDetail,
  updatePermission,
  removePermissionsFromRole,
  removeRolesFromStaff,
  syncStaffRoles,
  getStaffRoles,
  getUsersByRole,
  getStaffPermissions,
  getStaffAccessContext,
  rebuildUserPermissionCache,
  checkStaffPermission,
  seedSystemAccess,
  getRoleUsageSummary,
  getPermissionUsageSummary,
  deleteRoleSoft,
  deletePermissionSoft,
};
