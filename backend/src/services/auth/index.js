module.exports = {
  // policy: Xuất nhóm chính sách, hằng số và helper kiểm tra quyền/xác thực.
  policy: require('./auth.policy'),
  // tokenService: Xuất các hàm tạo, xác minh và băm token xác thực.
  tokenService: require('./token.service'),
  // passwordService: Xuất các hàm kiểm tra chính sách và xử lý mật khẩu.
  passwordService: require('./password.service'),
  // loginSecurityService: Xuất các hàm kiểm soát an toàn đăng nhập và khóa tài khoản.
  loginSecurityService: require('./login-security.service'),
  // sessionService: Xuất các hàm quản lý phiên đăng nhập và refresh token.
  sessionService: require('./auth-session.service'),
  // staffAuthService: Xuất các hàm xác thực và quản lý tài khoản nhân sự.
  staffAuthService: require('./staff-auth.service'),
  // patientAuthService: Xuất các hàm xác thực và quản lý tài khoản bệnh nhân.
  patientAuthService: require('./patient-auth.service'),
  // passwordResetService: Xuất các hàm yêu cầu, xác minh và hoàn tất đặt lại mật khẩu.
  passwordResetService: require('./password-reset.service'),
  // currentProfileService: Xuất các hàm đọc/cập nhật hồ sơ của người dùng hiện tại.
  currentProfileService: require('./current-profile.service'),
  // authAuditService: Xuất các hàm truy vấn nhật ký xác thực.
  authAuditService: require('./auth-audit.service'),
  // rateLimitService: Xuất các hàm giới hạn tần suất thao tác xác thực.
  rateLimitService: require('./rate-limit.service'),
  // authNotificationService: Xuất các hàm gửi thông báo liên quan đến xác thực.
  authNotificationService: require('./auth-notification.service'),
};
