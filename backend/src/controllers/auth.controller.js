const authService = require('../services/auth.service');
const { errorResponse, successResponse } = require('../utils/http-response');

async function staffLogin(req, res) {
  try {
    const result = await authService.loginStaff(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đăng nhập nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function createStaffAccount(req, res) {
  try {
    const result = await authService.createStaffAccount(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      statusCode: 201,
      message: 'Tạo tài khoản nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function registerPatient(req, res) {
  try {
    const result = await authService.registerPatient(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      statusCode: 201,
      message: 'Đăng ký tài khoản bệnh nhân thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function patientLogin(req, res) {
  try {
    const result = await authService.loginPatient(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đăng nhập bệnh nhân thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function assignRoles(req, res) {
  try {
    const result = await authService.assignRolesToStaff(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Cập nhật vai trò cho tài khoản nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function refreshToken(req, res) {
  try {
    const result = await authService.refreshAccessToken(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Làm mới phiên đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function forgotPassword(req, res) {
  try {
    const result = await authService.requestPasswordReset(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Yêu cầu quên mật khẩu đã được ghi nhận.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function resetPassword(req, res) {
  try {
    const result = await authService.resetPassword(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đặt lại mật khẩu thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function logout(req, res) {
  try {
    const result = await authService.logout(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đăng xuất thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function changePassword(req, res) {
  try {
    const result = await authService.changePassword(req.auth, req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã bị thu hồi.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function me(req, res) {
  try {
    const profile = await authService.getCurrentProfile(req.auth);
    return successResponse(res, {
      message: 'Lấy thông tin tài khoản thành công.',
      data: { profile },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function myRoles(req, res) {
  try {
    const result = await authService.getMyRoles(req.auth);
    return successResponse(res, {
      message: 'Lấy danh sách vai trò hiện tại thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function myPermissions(req, res) {
  try {
    const result = await authService.getMyPermissions(req.auth);
    return successResponse(res, {
      message: 'Lấy danh sách quyền hiện tại thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateMyProfile(req, res) {
  try {
    const result = await authService.updateMyProfile(req.auth, req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Cập nhật hồ sơ cá nhân thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function revokeRefreshToken(req, res) {
  try {
    const result = await authService.revokeRefreshToken(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Thu hồi refresh token thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function logoutAllDevices(req, res) {
  try {
    const result = await authService.logoutAllDevices(req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đăng xuất khỏi toàn bộ thiết bị thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function mySessions(req, res) {
  try {
    const result = await authService.getMySessions(req.auth);
    return successResponse(res, {
      message: 'Lấy danh sách phiên đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function myLoginHistory(req, res) {
  try {
    const result = await authService.getLoginHistory(req.auth, req.query);
    return successResponse(res, {
      message: 'Lấy lịch sử đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listStaffAccounts(req, res) {
  try {
    const result = await authService.listStaffAccounts(req.query);
    return successResponse(res, {
      message: 'Lấy danh sách tài khoản nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateStaffStatus(req, res) {
  try {
    const result = await authService.updateStaffAccountStatus(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Cập nhật trạng thái tài khoản nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function unlockStaffAccount(req, res) {
  try {
    const result = await authService.unlockStaffAccount(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Mở khóa tài khoản nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function activateStaffAccount(req, res) {
  try {
    const result = await authService.activateStaffAccount(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Kích hoạt tài khoản nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function deactivateStaffAccount(req, res) {
  try {
    const result = await authService.deactivateStaffAccount(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Vô hiệu hóa tài khoản nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function resetStaffPassword(req, res) {
  try {
    const result = await authService.resetStaffPassword(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return successResponse(res, {
      message: 'Đặt lại mật khẩu tài khoản nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getAuditLogs(req, res) {
  try {
    const result = await authService.getAuditLogs(req.query);
    return successResponse(res, {
      message: 'Lấy nhật ký bảo mật thành công.',
      data: result,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
  staffLogin,
  myRoles,
  myPermissions,
  updateMyProfile,
  revokeRefreshToken,
  logoutAllDevices,
  mySessions,
  myLoginHistory,
  registerPatient,
  patientLogin,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  changePassword,
  me,
  getAuditLogs,
};
