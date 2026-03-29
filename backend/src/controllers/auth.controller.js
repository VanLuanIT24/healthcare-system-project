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
    const result = await authService.createStaffAccount(req.body, req.auth);
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
    const result = await authService.assignRolesToStaff(req.body, req.auth);
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

async function logout(req, res) {
  try {
    const result = await authService.logout(req.body);
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
    const result = await authService.changePassword(req.auth, req.body);
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

module.exports = {
  staffLogin,
  createStaffAccount,
  assignRoles,
  registerPatient,
  patientLogin,
  refreshToken,
  logout,
  changePassword,
  me,
};
