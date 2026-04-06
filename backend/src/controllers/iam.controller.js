const iamService = require('../services/iam.service');
const { errorResponse, successResponse } = require('../utils/http-response');

async function createRole(req, res) {
  try {
    const result = await iamService.createRole(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      statusCode: 201,
      message: 'Tạo role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listRoles(req, res) {
  try {
    const result = await iamService.listRoles(req.query);
    return successResponse(res, {
      message: 'Lấy danh sách role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getRoleDetail(req, res) {
  try {
    const result = await iamService.getRoleDetail(req.params.roleId);
    return successResponse(res, {
      message: 'Lấy chi tiết role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateRole(req, res) {
  try {
    const result = await iamService.updateRole(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Cập nhật role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateRoleStatus(req, res) {
  try {
    const result = await iamService.updateRoleStatus(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Cập nhật trạng thái role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function assignPermissionsToRole(req, res) {
  try {
    const result = await iamService.assignPermissionsToRole(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Gán permission cho role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getRolePermissions(req, res) {
  try {
    const result = await iamService.getRolePermissions(req.params.roleId);
    return successResponse(res, {
      message: 'Lấy permission của role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listPermissions(req, res) {
  try {
    const result = await iamService.listPermissions(req.query);
    return successResponse(res, {
      message: 'Lấy danh sách permission thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function createPermission(req, res) {
  try {
    const result = await iamService.createPermission(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      statusCode: 201,
      message: 'Tạo permission thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getPermissionDetail(req, res) {
  try {
    const result = await iamService.getPermissionDetail(req.params.permissionId);
    return successResponse(res, {
      message: 'Lấy chi tiết permission thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updatePermission(req, res) {
  try {
    const result = await iamService.updatePermission(req.params.permissionId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Cập nhật permission thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function removePermissionsFromRole(req, res) {
  try {
    const result = await iamService.removePermissionsFromRole(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Gỡ permission khỏi role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function syncRolePermissions(req, res) {
  try {
    const result = await iamService.syncRolePermissions(req.params.roleId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đồng bộ permission cho role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function removeRolesFromStaff(req, res) {
  try {
    const result = await iamService.removeRolesFromStaff(req.params.userId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Gỡ role khỏi staff thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function syncStaffRoles(req, res) {
  try {
    const result = await iamService.syncStaffRoles(req.params.userId, req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đồng bộ role cho staff thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffRoles(req, res) {
  try {
    const result = await iamService.getStaffRoles(req.params.userId);
    return successResponse(res, {
      message: 'Lấy role của staff thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getUsersByRole(req, res) {
  try {
    const result = await iamService.getUsersByRole(req.params.roleId, req.query);
    return successResponse(res, {
      message: 'Lấy danh sách user theo role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffPermissions(req, res) {
  try {
    const result = await iamService.getStaffPermissions(req.params.userId);
    return successResponse(res, {
      message: 'Lấy permission của staff thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function rebuildUserPermissionCache(req, res) {
  try {
    const result = await iamService.rebuildUserPermissionCache(req.params.userId);
    return successResponse(res, {
      message: 'Làm mới permission map của user thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function checkStaffPermission(req, res) {
  try {
    const result = await iamService.checkStaffPermission(req.params.userId, req.query.permission_code);
    return successResponse(res, {
      message: 'Kiểm tra permission thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function seedSystemAccess(req, res) {
  try {
    const result = await iamService.seedSystemAccess(req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Seed role và permission mặc định thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getRoleUsageSummary(req, res) {
  try {
    const result = await iamService.getRoleUsageSummary(req.params.roleId);
    return successResponse(res, {
      message: 'Lấy thống kê sử dụng role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getPermissionUsageSummary(req, res) {
  try {
    const result = await iamService.getPermissionUsageSummary(req.params.permissionId);
    return successResponse(res, {
      message: 'Lấy thống kê sử dụng permission thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function deleteRoleSoft(req, res) {
  try {
    const result = await iamService.deleteRoleSoft(req.params.roleId, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Xóa mềm role thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function deletePermissionSoft(req, res) {
  try {
    const result = await iamService.deletePermissionSoft(req.params.permissionId, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Xóa mềm permission thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
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
  getPermissionDetail,
  updatePermission,
  removePermissionsFromRole,
  removeRolesFromStaff,
  syncStaffRoles,
  getStaffRoles,
  getUsersByRole,
  getStaffPermissions,
  rebuildUserPermissionCache,
  checkStaffPermission,
  seedSystemAccess,
  getRoleUsageSummary,
  getPermissionUsageSummary,
  deleteRoleSoft,
  deletePermissionSoft,
};
