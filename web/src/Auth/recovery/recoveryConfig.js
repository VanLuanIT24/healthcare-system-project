export const RECOVERY_ACTORS = {
  patient: {
    actorType: 'patient',
    label: 'Bệnh nhân',
    loginPath: '/login',
    forgotPath: '/patient/forgot-password',
    resetPath: '/patient/reset-password',
    forgotTitle: 'Khôi phục mật khẩu bệnh nhân',
    forgotSubtitle: 'Nhập thông tin tài khoản để nhận hướng dẫn đặt lại mật khẩu.',
    resetTitle: 'Đặt lại mật khẩu bệnh nhân',
    resetSubtitle: 'Tạo mật khẩu mới cho tài khoản bệnh nhân của bạn.',
    requestLabel: 'Email / Số điện thoại / Tên đăng nhập',
    requestPlaceholder: 'Nhập email, số điện thoại hoặc tên đăng nhập',
    loginLinkLabel: 'Quay lại đăng nhập',
    successChannelText: 'Vui lòng kiểm tra email hoặc tin nhắn SMS để lấy liên kết hoặc mã xác minh.',
    verifyHint: 'Nhập mã xác minh đã được gửi tới email hoặc số điện thoại của bạn.',
    passwordPolicyTitle: 'Yêu cầu mật khẩu',
    passwordMinLength: 8,
    requireUppercase: false,
    requireSpecial: false,
    policyChecks: [
      { key: 'length', label: 'Ít nhất 8 ký tự' },
      { key: 'lowercase', label: 'Có chữ thường' },
      { key: 'number', label: 'Có số' },
      { key: 'special', label: 'Không chứa email / tên đăng nhập / số điện thoại' },
      { key: 'common', label: 'Không phải mật khẩu phổ biến' },
    ],
  },
  staff: {
    actorType: 'staff',
    label: 'Nhân sự',
    loginPath: '/staff/login',
    forgotPath: '/staff/forgot-password',
    resetPath: '/staff/reset-password',
    forgotTitle: 'Khôi phục mật khẩu nhân sự',
    forgotSubtitle: 'Nhập thông tin tài khoản để nhận hướng dẫn đặt lại mật khẩu.',
    resetTitle: 'Đặt lại mật khẩu nhân sự',
    resetSubtitle: 'Tạo mật khẩu mới cho tài khoản nhân sự của bạn.',
    requestLabel: 'Email / Số điện thoại / Tên đăng nhập / Mã nhân viên',
    requestPlaceholder: 'Nhập email, số điện thoại, tên đăng nhập hoặc mã nhân viên',
    loginLinkLabel: 'Quay lại đăng nhập nhân sự',
    successChannelText: 'Vui lòng kiểm tra email hoặc tin nhắn SMS để lấy liên kết hoặc mã xác minh.',
    verifyHint: 'Nhập mã xác minh đã được gửi tới email hoặc số điện thoại của bạn.',
    passwordPolicyTitle: 'Yêu cầu bảo mật cho nhân sự',
    passwordMinLength: 10,
    requireUppercase: true,
    requireSpecial: true,
    policyChecks: [
      { key: 'length', label: 'Ít nhất 10 ký tự' },
      { key: 'lowercase', label: 'Có chữ thường' },
      { key: 'uppercase', label: 'Có chữ hoa' },
      { key: 'number', label: 'Có số' },
      { key: 'specialChar', label: 'Có ký tự đặc biệt' },
      { key: 'special', label: 'Không chứa email / tên đăng nhập / số điện thoại' },
      { key: 'common', label: 'Không phải mật khẩu phổ biến' },
    ],
  },
};

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  '12345678',
  '123456789',
  'qwerty123',
  'admin123',
  'letmein',
  'welcome1',
]);

export function getRecoveryActor(actorType) {
  return RECOVERY_ACTORS[actorType] || RECOVERY_ACTORS.patient;
}

export function parseRecoveryActor(actorType) {
  return actorType === 'staff' ? 'staff' : 'patient';
}

export function evaluatePasswordPolicy(actorType, password, identifiers = []) {
  const actor = getRecoveryActor(actorType);
  const normalizedPassword = String(password || '');
  const loweredPassword = normalizedPassword.trim().toLowerCase();
  const normalizedIdentifiers = identifiers
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  return {
    length: normalizedPassword.length >= actor.passwordMinLength,
    lowercase: /[a-z]/.test(normalizedPassword),
    uppercase: actor.requireUppercase ? /[A-Z]/.test(normalizedPassword) : true,
    number: /\d/.test(normalizedPassword),
    specialChar: actor.requireSpecial ? /[^A-Za-z0-9]/.test(normalizedPassword) : true,
    special: !normalizedIdentifiers.some((value) => loweredPassword.includes(value)),
    common: loweredPassword.length > 0 && !COMMON_PASSWORDS.has(loweredPassword),
  };
}
