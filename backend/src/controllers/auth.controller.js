const authService = require('../services/auth.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

async function staffLogin(req, res, next) {
  try {
    const result = await authService.loginStaff(req.body, requestMeta(req));
    return sendSuccess(res, {
      message: 'Đăng nhập nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function registerPatient(req, res, next) {
  try {
    const result = await authService.registerPatient(req.body, requestMeta(req));
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Đăng ký tài khoản bệnh nhân thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function patientLogin(req, res, next) {
  try {
    const result = await authService.loginPatient(req.body, requestMeta(req));
    return sendSuccess(res, {
      message: 'Đăng nhập bệnh nhân thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function refreshToken(req, res, next) {
  try {
    const result = await authService.refreshAccessToken(req.body, requestMeta(req));
    return sendSuccess(res, {
      message: 'Làm mới phiên đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function validatePasswordPolicy(req, res, next) {
  try {
    const payload = req.body || {};
    authService.validatePasswordPolicy(payload, payload.actor_type || payload.actorType);
    return sendSuccess(res, {
      message: 'Mật khẩu đáp ứng chính sách bảo mật.',
      data: { valid: true },
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.requestPasswordReset(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Yêu cầu quên mật khẩu đã được ghi nhận.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Đặt lại mật khẩu thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function verifyResetToken(req, res, next) {
  try {
    const result = await authService.verifyPasswordResetToken(req.body);
    return sendSuccess(res, {
      message: 'Reset token hợp lệ.',
      data: {
        valid: true,
        actor_type: result.resetRecord.actor_type,
      },
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function logout(req, res, next) {
  try {
    const result = await authService.logout(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Đăng xuất thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function revokeMySession(req, res, next) {
  try {
    const result = await authService.revokeRefreshToken(
      { session_id: req.params.sessionId },
      req.auth,
      {
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
      },
    );
    return sendSuccess(res, {
      message: 'Thu hồi phiên đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function renameMySessionDevice(req, res, next) {
  try {
    const result = await authService.renameSessionDevice(req.params.sessionId, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, {
      message: 'Đổi tên thiết bị đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function revokeOtherSessions(req, res, next) {
  try {
    const result = await authService.revokeOtherSessions(req.auth, requestMeta(req));
    return sendSuccess(res, {
      message: 'Thu hồi các phiên đăng nhập khác thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function revokeExpiredSessions(req, res, next) {
  try {
    const result = await authService.revokeExpiredSessions(requestMeta(req));
    return sendSuccess(res, {
      message: 'Thu hồi phiên hết hạn thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function cleanupExpiredSessions(req, res, next) {
  try {
    const result = await authService.cleanupExpiredSessions(requestMeta(req));
    return sendSuccess(res, {
      message: 'Dọn phiên hết hạn thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword(req.auth, req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã bị thu hồi.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updatePatientAccountEmail(req, res, next) {
  try {
    const result = await authService.updatePatientAccountEmail({
      ...req.body,
      patient_account_id: req.params.accountId || req.body.patient_account_id,
    }, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật email tài khoản bệnh nhân thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updatePatientAccountPhone(req, res, next) {
  try {
    const result = await authService.updatePatientAccountPhone({
      ...req.body,
      patient_account_id: req.params.accountId || req.body.patient_account_id,
    }, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật số điện thoại tài khoản bệnh nhân thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function changePatientUsername(req, res, next) {
  try {
    const result = await authService.changePatientUsername({
      ...req.body,
      patient_account_id: req.params.accountId || req.body.patient_account_id,
    }, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Đổi username tài khoản bệnh nhân thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function createPatientAccountForExistingPatient(req, res, next) {
  try {
    const result = await authService.createPatientAccountForExistingPatient(req.body, req.auth, requestMeta(req));
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Tạo tài khoản cho hồ sơ bệnh nhân có sẵn thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deactivatePatientAccount(req, res, next) {
  try {
    const result = await authService.deactivatePatientAccount({ patient_account_id: req.params.accountId }, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Vô hiệu hóa tài khoản bệnh nhân thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function lockPatientAccount(req, res, next) {
  try {
    const result = await authService.lockPatientAccount({ patient_account_id: req.params.accountId }, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Khóa tài khoản bệnh nhân thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function unlockPatientAccount(req, res, next) {
  try {
    const result = await authService.unlockPatientAccount({ patient_account_id: req.params.accountId }, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Mở khóa tài khoản bệnh nhân thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function me(req, res, next) {
  try {
    const profile = await authService.getCurrentProfile(req.auth);
    return sendSuccess(res, {
      message: 'Lấy thông tin tài khoản thành công.',
      data: { profile },
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function myRoles(req, res, next) {
  try {
    const result = await authService.getMyRoles(req.auth);
    return sendSuccess(res, {
      message: 'Lấy danh sách vai trò hiện tại thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function myPermissions(req, res, next) {
  try {
    const result = await authService.getMyPermissions(req.auth);
    return sendSuccess(res, {
      message: 'Lấy danh sách quyền hiện tại thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const result = await authService.updateMyProfile(req.auth, req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Cập nhật hồ sơ cá nhân thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function revokeRefreshToken(req, res, next) {
  try {
    const result = await authService.revokeRefreshToken(req.body, req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Thu hồi refresh token thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function logoutAllDevices(req, res, next) {
  try {
    const result = await authService.logoutAllDevices(req.auth, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return sendSuccess(res, {
      message: 'Đăng xuất khỏi toàn bộ thiết bị thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function mySessions(req, res, next) {
  try {
    const result = await authService.getMySessions(req.auth);
    return sendSuccess(res, {
      message: 'Lấy danh sách phiên đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function currentSession(req, res, next) {
  try {
    const result = await authService.getCurrentSessionDetail(req.auth);
    return sendSuccess(res, {
      message: 'Lấy phiên đăng nhập hiện tại thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function myLoginHistory(req, res, next) {
  try {
    const result = await authService.getLoginHistory(req.auth, req.query);
    return sendSuccess(res, {
      message: 'Lấy lịch sử đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const result = await authService.getAuditLogs(req.query);
    return sendSuccess(res, {
      message: 'Lấy nhật ký bảo mật thành công.',
      data: result,
    });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

module.exports = {
  staffLogin,
  myRoles,
  myPermissions,
  updateMyProfile,
  revokeRefreshToken,
  revokeMySession,
  renameMySessionDevice,
  revokeOtherSessions,
  revokeExpiredSessions,
  cleanupExpiredSessions,
  logoutAllDevices,
  currentSession,
  mySessions,
  myLoginHistory,
  updatePatientAccountEmail,
  updatePatientAccountPhone,
  changePatientUsername,
  createPatientAccountForExistingPatient,
  deactivatePatientAccount,
  lockPatientAccount,
  unlockPatientAccount,
  registerPatient,
  patientLogin,
  validatePasswordPolicy,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  refreshToken,
  logout,
  changePassword,
  me,
  getAuditLogs,
};
