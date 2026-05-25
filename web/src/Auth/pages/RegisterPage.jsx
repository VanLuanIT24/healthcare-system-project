import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  Home,
  Info,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { AppLogo } from '../../app/AppLogo';
import { API_BASE_URL } from '../../lib/api';
import { usePasswordPolicyValidation } from '../../lib/passwordPolicy';

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

const GENDER_OPTIONS = [
  { value: '', label: 'Chọn giới tính' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
  { value: 'unknown', label: 'Không muốn tiết lộ' },
];

const INITIAL_FORM_STATE = {
  full_name: '',
  email: '',
  phone: '',
  username: '',
  password: '',
  confirm_password: '',
  date_of_birth: '',
  gender: '',
  address: '',
  national_id: '',
  insurance_number: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{9,11}$/;

function normalizePhoneInput(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeLowerInput(value) {
  return String(value || '').trim().toLowerCase();
}

function hasValue(value) {
  return String(value || '').trim() !== '';
}

function getPasswordChecks(formState) {
  const password = formState.password || '';
  const normalizedPassword = password.trim().toLowerCase();
  const identifiers = [
    normalizeLowerInput(formState.username),
    normalizeLowerInput(formState.email),
    normalizePhoneInput(formState.phone),
  ].filter(Boolean);

  return [
    {
      key: 'min-length',
      label: 'Ít nhất 8 ký tự',
      error: 'Mật khẩu phải có ít nhất 8 ký tự.',
      valid: password.length >= 8,
    },
    {
      key: 'max-length',
      label: 'Không quá 128 ký tự',
      error: 'Mật khẩu không được quá 128 ký tự.',
      valid: password.length <= 128,
    },
    {
      key: 'lowercase',
      label: 'Có ít nhất 1 chữ thường',
      error: 'Mật khẩu phải có ít nhất 1 chữ thường.',
      valid: /[a-z]/.test(password),
    },
    {
      key: 'number',
      label: 'Có ít nhất 1 số',
      error: 'Mật khẩu phải có ít nhất 1 số.',
      valid: /[0-9]/.test(password),
    },
    {
      key: 'common',
      label: 'Không phải mật khẩu quá phổ biến',
      error: 'Mật khẩu quá phổ biến.',
      valid: password.length > 0 && !COMMON_PASSWORDS.has(normalizedPassword),
    },
    {
      key: 'identifier',
      label: 'Không chứa email, số điện thoại hoặc tên đăng nhập',
      error: 'Mật khẩu không được chứa email, số điện thoại hoặc tên đăng nhập.',
      valid: !identifiers.some((identifier) => normalizedPassword.includes(identifier)),
    },
  ];
}

function validateAccount(formState, passwordChecks) {
  const fieldErrors = {};
  let accountError = '';
  const email = formState.email.trim();
  const phone = normalizePhoneInput(formState.phone);
  const username = formState.username.trim();

  if (!formState.full_name.trim()) {
    fieldErrors.full_name = 'Vui lòng nhập họ và tên.';
  }

  if (!email && !phone && !username) {
    accountError = 'Vui lòng nhập ít nhất Email, Số điện thoại hoặc Tên đăng nhập.';
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'Email không hợp lệ.';
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    fieldErrors.phone = 'Số điện thoại chỉ gồm 9-11 chữ số.';
  }

  if (!formState.password) {
    fieldErrors.password = 'Vui lòng nhập mật khẩu.';
  }

  const passwordErrors = formState.password
    ? passwordChecks.filter((item) => !item.valid).map((item) => item.error)
    : [];

  if (!formState.confirm_password) {
    fieldErrors.confirm_password = 'Vui lòng nhập lại mật khẩu.';
  } else if (formState.password !== formState.confirm_password) {
    fieldErrors.confirm_password = 'Mật khẩu xác nhận không khớp.';
  }

  return {
    fieldErrors,
    accountError,
    passwordErrors,
    isValid: !Object.keys(fieldErrors).length && !accountError && passwordErrors.length === 0,
  };
}

function validateProfile(formState) {
  const fieldErrors = {};
  const emergencyPhone = normalizePhoneInput(formState.emergency_contact_phone);

  if (formState.date_of_birth) {
    const selectedDate = new Date(`${formState.date_of_birth}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      fieldErrors.date_of_birth = 'Ngày sinh không được lớn hơn ngày hiện tại.';
    }
  }

  if (emergencyPhone && !PHONE_PATTERN.test(emergencyPhone)) {
    fieldErrors.emergency_contact_phone = 'Số điện thoại liên hệ khẩn cấp chỉ gồm 9-11 chữ số.';
  }

  return {
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
  };
}

function setIfPresent(payload, field, value) {
  if (hasValue(value)) {
    payload[field] = String(value).trim();
  }
}

function buildRegistrationPayload(formState, includeProfile) {
  const payload = {
    full_name: formState.full_name.trim(),
    password: formState.password,
    confirm_password: formState.confirm_password,
  };

  setIfPresent(payload, 'email', normalizeLowerInput(formState.email));
  setIfPresent(payload, 'phone', normalizePhoneInput(formState.phone));
  setIfPresent(payload, 'username', normalizeLowerInput(formState.username));

  if (includeProfile) {
    setIfPresent(payload, 'date_of_birth', formState.date_of_birth);
    setIfPresent(payload, 'gender', formState.gender);
    setIfPresent(payload, 'address', formState.address);
    setIfPresent(payload, 'national_id', formState.national_id);
    setIfPresent(payload, 'insurance_number', formState.insurance_number);
    setIfPresent(payload, 'emergency_contact_name', formState.emergency_contact_name);
    setIfPresent(payload, 'emergency_contact_phone', normalizePhoneInput(formState.emergency_contact_phone));
  }

  return payload;
}

function translateBackendMessage(message) {
  const normalized = String(message || '');

  if (normalized === 'full_name và password là bắt buộc.') {
    return 'Vui lòng nhập họ tên và mật khẩu.';
  }

  if (normalized === 'Cần có email, phone hoặc username để tạo tài khoản bệnh nhân.') {
    return 'Vui lòng nhập ít nhất email, số điện thoại hoặc tên đăng nhập.';
  }

  if (normalized === 'Password policy validation failed') {
    return 'Mật khẩu chưa đáp ứng chính sách bảo mật.';
  }

  if (/getaddrinfo|mongodb\.net|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT/i.test(normalized)) {
    return 'Hệ thống tạm thời không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.';
  }

  if (normalized === 'full_name is required.') return 'Vui lòng nhập họ và tên.';
  if (normalized === 'password is required.') return 'Vui lòng nhập mật khẩu.';
  if (normalized.includes('One of email, phone, username is required')) {
    return 'Vui lòng nhập ít nhất email, số điện thoại hoặc tên đăng nhập.';
  }

  if (normalized.includes('at least 8 characters')) return 'Mật khẩu phải có ít nhất 8 ký tự.';
  if (normalized.includes('not exceed 128 characters')) return 'Mật khẩu không được quá 128 ký tự.';
  if (normalized.includes('lowercase letter')) return 'Mật khẩu phải có ít nhất 1 chữ thường.';
  if (normalized.includes('contain number')) return 'Mật khẩu phải có ít nhất 1 số.';
  if (normalized.includes('too common')) return 'Mật khẩu quá phổ biến.';
  if (normalized.includes('not contain username, email, or phone')) {
    return 'Mật khẩu không được chứa email, số điện thoại hoặc tên đăng nhập.';
  }

  return normalized || 'Đăng ký thất bại.';
}

function fieldFromBackendMessage(message) {
  if (message === 'Mật khẩu xác nhận không khớp.') return 'confirm_password';
  if (message === 'Số giấy tờ tùy thân đã tồn tại trong hệ thống.') return 'national_id';
  return '';
}

function StepIndicator({ step }) {
  const isSuccess = step === 'success';
  const isProfile = step === 'profile' || isSuccess;

  return (
    <div className="patient-register-steps" aria-label="Tiến trình đăng ký">
      <div className={`patient-register-step ${isProfile ? 'is-complete' : 'is-active'}`}>
        <span>{isProfile ? <Check size={18} /> : '1'}</span>
        <strong>1. Tạo tài khoản</strong>
      </div>
      <div className={`patient-register-step ${isProfile ? 'is-active' : ''}`}>
        <span>2</span>
        <strong>2. Hoàn thiện hồ sơ</strong>
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="patient-register-brand">
      <Link className="patient-register-logo" to="/home" aria-label="Bộ Y tế">
        <AppLogo variant="horizontal" />
      </Link>
    </header>
  );
}

function FieldError({ message }) {
  if (!message) return null;

  return (
    <p className="patient-field-error">
      <AlertCircle size={15} />
      {message}
    </p>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  icon: Icon,
  required = false,
  error,
  note,
  children,
  autoComplete,
  inputMode,
}) {
  return (
    <label className={`patient-register-field ${error ? 'has-error' : ''}`}>
      <span className="patient-register-field__label">
        {label} {required ? <b>*</b> : null}
      </span>
      <span className="patient-input-shell">
        {Icon ? <Icon className="patient-input-shell__icon" size={19} /> : null}
        {children || (
          <input
            type={type}
            name={name}
            value={value}
            placeholder={placeholder}
            autoComplete={autoComplete}
            inputMode={inputMode}
            onChange={onChange}
          />
        )}
      </span>
      <FieldError message={error} />
      {!error && note ? <small className="patient-field-note">{note}</small> : null}
    </label>
  );
}

function FormNotice({ tone = 'info', children }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle : Info;

  return (
    <div className={`patient-form-notice patient-form-notice--${tone}`}>
      <Icon size={19} />
      <div>{children}</div>
    </div>
  );
}

function BackgroundArtwork() {
  return (
    <div className="patient-register-artwork" aria-hidden="true">
      <div className="patient-artwork__molecules">
        {Array.from({ length: 10 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="patient-artwork__hospital">
        <span className="patient-artwork__tower patient-artwork__tower--left" />
        <span className="patient-artwork__tower patient-artwork__tower--main" />
        <span className="patient-artwork__tower patient-artwork__tower--right" />
        <span className="patient-artwork__cross" />
        <span className="patient-artwork__shield" />
        <span className="patient-artwork__ecg" />
      </div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('account');
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [showAccountErrors, setShowAccountErrors] = useState(false);
  const [showProfileErrors, setShowProfileErrors] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState({});
  const [serverAccountError, setServerAccountError] = useState('');
  const [apiMessage, setApiMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState(null);
  const [submittedWithProfile, setSubmittedWithProfile] = useState(false);

  const passwordPolicyValidation = usePasswordPolicyValidation({
    actorType: 'patient',
    password: formState.password,
    username: formState.username,
    email: formState.email,
    phone: normalizePhoneInput(formState.phone),
    clientApp: 'patient-portal',
    enabled: step === 'account' && Boolean(formState.password),
  });
  const passwordChecks = useMemo(() => getPasswordChecks(formState), [formState]);
  const accountValidation = useMemo(
    () => validateAccount(formState, passwordChecks),
    [formState, passwordChecks],
  );
  const profileValidation = useMemo(() => validateProfile(formState), [formState]);

  const visibleAccountErrors = showAccountErrors ? accountValidation.fieldErrors : {};
  const visibleProfileErrors = showProfileErrors ? profileValidation.fieldErrors : {};
  const passwordErrors = useMemo(() => {
    const localErrors = showAccountErrors ? accountValidation.passwordErrors : [];
    const remoteErrors = passwordPolicyValidation.status === 'invalid' ? passwordPolicyValidation.messages : [];
    return Array.from(new Set([...localErrors, ...remoteErrors]));
  }, [accountValidation.passwordErrors, passwordPolicyValidation.messages, passwordPolicyValidation.status, showAccountErrors]);
  const accountGroupError = (showAccountErrors ? accountValidation.accountError : '') || serverAccountError;
  const passwordPolicyFeedback = useMemo(() => {
    if (!formState.password) return null;
    if (passwordPolicyValidation.isChecking) {
      return { tone: 'info', message: 'Đang kiểm tra mật khẩu với máy chủ...', details: [] };
    }
    if (passwordPolicyValidation.status === 'valid') {
      return { tone: 'success', message: 'Mật khẩu đáp ứng chính sách bảo mật của hệ thống.', details: [] };
    }
    if (passwordPolicyValidation.status === 'rate-limited') {
      return { tone: 'error', message: passwordPolicyValidation.messages[0] || 'Bạn đã kiểm tra mật khẩu quá nhiều lần. Vui lòng thử lại sau.', details: [] };
    }
    if (passwordPolicyValidation.status === 'error') {
      return { tone: 'error', message: passwordPolicyValidation.messages[0] || 'Không thể kiểm tra mật khẩu lúc này.', details: [] };
    }
    return null;
  }, [formState.password, passwordPolicyValidation.isChecking, passwordPolicyValidation.messages, passwordPolicyValidation.status]);

  const profileProgress = useMemo(() => {
    const personalFields = ['date_of_birth', 'gender', 'address', 'national_id', 'insurance_number'];
    const emergencyFields = ['emergency_contact_name', 'emergency_contact_phone'];
    const personalFilled = personalFields.filter((field) => hasValue(formState[field])).length;
    const emergencyFilled = emergencyFields.filter((field) => hasValue(formState[field])).length;
    const sections = [1, personalFilled / personalFields.length, emergencyFilled / emergencyFields.length];

    return Math.round((sections.reduce((total, item) => total + item, 0) / sections.length) * 100);
  }, [formState]);

  function clearServerError(name) {
    if (serverFieldErrors[name]) {
      setServerFieldErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }

    if (['email', 'phone', 'username'].includes(name)) {
      setServerAccountError('');
    }

    setApiMessage(null);
  }

  function clearPasswordPolicyServerError() {
    setServerFieldErrors((current) => {
      if (!current.password) return current;
      const next = { ...current };
      delete next.password;
      return next;
    });
    setApiMessage((current) => (current?.source === 'password-policy' ? null : current));
  }

  function handleChange(event) {
    const { name, value } = event.target;
    let nextValue = value;

    if (name === 'phone' || name === 'emergency_contact_phone') {
      nextValue = normalizePhoneInput(value);
    }

    if (name === 'username') {
      nextValue = normalizeLowerInput(value).replace(/\s+/g, '');
    }

    if (name === 'email') {
      nextValue = value.trimStart().toLowerCase();
    }

    setFormState((current) => ({ ...current, [name]: nextValue }));
    clearServerError(name);
    if (['password', 'username', 'email', 'phone'].includes(name)) {
      clearPasswordPolicyServerError();
    }
  }

  function applyPasswordPolicyFailure(result) {
    setServerFieldErrors((current) => ({
      ...current,
      password: result.messages[0] || 'Mật khẩu chưa đáp ứng chính sách bảo mật.',
    }));
    setApiMessage({
      tone: result.status === 'rate-limited' ? 'error' : 'error',
      source: 'password-policy',
      message: result.status === 'rate-limited'
        ? (result.messages[0] || 'Bạn đã kiểm tra mật khẩu quá nhiều lần. Vui lòng thử lại sau.')
        : 'Mật khẩu chưa đáp ứng chính sách bảo mật.',
      details: result.messages || [],
    });
    setStep('account');
  }

  async function goToProfile(event) {
    event?.preventDefault();
    setShowAccountErrors(true);
    setServerAccountError('');
    setApiMessage(null);

    if (!accountValidation.isValid) return;

    const validationResult = await passwordPolicyValidation.validateNow();
    if (!validationResult.valid) {
      applyPasswordPolicyFailure(validationResult);
      return;
    }
    clearPasswordPolicyServerError();

    setStep('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitAccountOnly(event) {
    event.preventDefault();
    submitRegistration(false);
  }

  function applyApiError(payload) {
    const message = translateBackendMessage(payload?.message);
    const details = Array.isArray(payload?.details) ? payload.details : [];
    const nextFieldErrors = {};
    const detailMessages = details.map((item) => translateBackendMessage(item?.message)).filter(Boolean);
    let nextAccountError = '';

    details.forEach((item) => {
      const field = item?.field;
      const translated = translateBackendMessage(item?.message);

      if (!field || !translated) return;

      if (String(field).includes('email') && String(field).includes('phone')) {
        nextAccountError = translated;
        return;
      }

      if (field === 'password') {
        nextFieldErrors.password = translated;
        return;
      }

      nextFieldErrors[field] = translated;
    });

    if (payload?.message === 'Email, số điện thoại hoặc tên đăng nhập đã được sử dụng.') {
      nextAccountError = payload.message;
    }

    const messageField = fieldFromBackendMessage(payload?.message);
    if (messageField) {
      nextFieldErrors[messageField] = payload.message;
    }

    setServerFieldErrors(nextFieldErrors);
    setServerAccountError(nextAccountError);
    setApiMessage({
      tone: 'error',
      message,
      details: detailMessages.length ? detailMessages : [],
    });

    if (
      nextFieldErrors.date_of_birth
      || nextFieldErrors.gender
      || nextFieldErrors.address
      || nextFieldErrors.national_id
      || nextFieldErrors.insurance_number
      || nextFieldErrors.emergency_contact_name
      || nextFieldErrors.emergency_contact_phone
    ) {
      setStep('profile');
      setShowProfileErrors(true);
    } else {
      setStep('account');
      setShowAccountErrors(true);
    }
  }

  async function submitRegistration(includeProfile) {
    setShowAccountErrors(true);
    setServerAccountError('');
    setApiMessage(null);

    if (!accountValidation.isValid) {
      setStep('account');
      return;
    }

    const validationResult = await passwordPolicyValidation.validateNow();
    if (!validationResult.valid) {
      applyPasswordPolicyFailure(validationResult);
      return;
    }
    clearPasswordPolicyServerError();

    if (includeProfile) {
      setShowProfileErrors(true);
      if (!profileValidation.isValid) return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/patients/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildRegistrationPayload(formState, includeProfile)),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        applyApiError(payload || { message: 'Đăng ký thất bại.' });
        return;
      }

      setRegisteredPatient(payload?.data?.patient || payload?.patient || null);
      setSubmittedWithProfile(includeProfile);
      setStep('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setApiMessage({
        tone: 'error',
        message: error.message || 'Không thể kết nối đến máy chủ.',
        details: [],
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function submitProfile(event) {
    event.preventDefault();
    submitRegistration(true);
  }

  const displayUsername = (
    normalizeLowerInput(formState.username)
    || normalizeLowerInput(formState.email)
    || normalizePhoneInput(formState.phone)
  );
  const displayPatient = registeredPatient || {};

  return (
    <main className="patient-register-page">
      <BackgroundArtwork />
      <BrandHeader />

      {step === 'account' ? (
        <section className="patient-register-card patient-register-card--account" aria-label="Đăng ký tài khoản bệnh nhân">
          <StepIndicator step={step} />

          <div className="patient-register-heading">
            <span className="patient-register-heading__icon">
              <User size={24} />
            </span>
            <div>
              <h1>Thông tin tài khoản</h1>
              <p>Đăng ký tài khoản bệnh nhân để truy cập cổng thông tin cá nhân.</p>
            </div>
          </div>

          <form className="patient-register-form" onSubmit={submitAccountOnly} noValidate>
            <InputField
              label="Họ và tên"
              name="full_name"
              value={formState.full_name}
              placeholder="Nhập họ và tên của bạn"
              icon={User}
              required
              autoComplete="name"
              error={visibleAccountErrors.full_name || serverFieldErrors.full_name}
              onChange={handleChange}
            />

            <div className="patient-register-grid">
              <InputField
                label="Email"
                name="email"
                value={formState.email}
                placeholder="Ví dụ: name@example.com"
                icon={Mail}
                type="email"
                autoComplete="email"
                error={visibleAccountErrors.email || serverFieldErrors.email}
                onChange={handleChange}
              />

              <InputField
                label="Số điện thoại"
                name="phone"
                value={formState.phone}
                placeholder="Ví dụ: 0901234567"
                icon={Phone}
                inputMode="numeric"
                autoComplete="tel"
                note="Chỉ nhập số, 9-11 ký tự."
                error={visibleAccountErrors.phone || serverFieldErrors.phone}
                onChange={handleChange}
              />
            </div>

            <InputField
              label="Tên đăng nhập"
              name="username"
              value={formState.username}
              placeholder="Ví dụ: nguyenvana123"
              icon={User}
              autoComplete="username"
              note="Không bắt buộc. Tên đăng nhập sẽ được chuyển về chữ thường."
              error={visibleAccountErrors.username || serverFieldErrors.username}
              onChange={handleChange}
            />

            <div className="patient-register-grid">
              <InputField
                label="Mật khẩu"
                name="password"
                value={formState.password}
                placeholder="Nhập mật khẩu"
                icon={Lock}
                required
                autoComplete="new-password"
                error={visibleAccountErrors.password || serverFieldErrors.password}
                onChange={handleChange}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formState.password}
                  placeholder="Nhập mật khẩu"
                  autoComplete="new-password"
                  onChange={handleChange}
                  onBlur={() => passwordPolicyValidation.validateNow().catch(() => {})}
                />
                <button
                  type="button"
                  className="patient-password-toggle"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </InputField>

              <InputField
                label="Nhập lại mật khẩu"
                name="confirm_password"
                value={formState.confirm_password}
                placeholder="Nhập lại mật khẩu"
                icon={Lock}
                required
                autoComplete="new-password"
                error={visibleAccountErrors.confirm_password || serverFieldErrors.confirm_password}
                onChange={handleChange}
              >
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm_password"
                  value={formState.confirm_password}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="patient-password-toggle"
                  aria-label={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                  onClick={() => setShowConfirmPassword((value) => !value)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </InputField>
            </div>

            {passwordErrors.length ? (
              <ul className="patient-password-errors">
                {passwordErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}

            {accountGroupError ? (
              <FormNotice tone="error">{accountGroupError}</FormNotice>
            ) : (
              <FormNotice>Vui lòng nhập ít nhất Email, Số điện thoại hoặc Tên đăng nhập.</FormNotice>
            )}

            <section className={`patient-password-policy ${showAccountErrors && passwordErrors.length ? 'has-error' : ''}`}>
              <span className="patient-password-policy__badge">
                <Shield size={24} />
              </span>
              <div>
                <h2>Mật khẩu phải đảm bảo:</h2>
                <div className="patient-password-policy__list">
                  {passwordChecks.map((item) => {
                    const isInvalid = showAccountErrors && !item.valid;
                    return (
                      <span
                        key={item.key}
                        className={`patient-password-check ${item.valid ? 'is-valid' : ''} ${isInvalid ? 'is-invalid' : ''}`}
                      >
                        <Check size={16} />
                        {item.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </section>

            {passwordPolicyFeedback ? (
              <FormNotice tone={passwordPolicyFeedback.tone}>
                <p>{passwordPolicyFeedback.message}</p>
              </FormNotice>
            ) : null}

            {apiMessage ? (
              <FormNotice tone={apiMessage.tone}>
                <p>{apiMessage.message}</p>
                {apiMessage.details.length ? (
                  <ul>
                    {apiMessage.details.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </FormNotice>
            ) : null}

            <div className="patient-account-actions">
              <button type="submit" className="register-primary-button" disabled={isSubmitting}>
                <UserPlus size={21} />
                {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
              </button>
              <button type="button" className="register-tertiary-button" disabled={isSubmitting} onClick={goToProfile}>
                Hoàn thiện hồ sơ trước khi gửi
              </button>
            </div>
          </form>

          <p className="patient-register-login-link">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </section>
      ) : null}

      {step === 'profile' ? (
        <div className="patient-register-profile-layout">
          <section className="patient-register-card patient-register-card--profile" aria-label="Hoàn thiện hồ sơ bệnh nhân">
            <StepIndicator step={step} />

            <div className="patient-register-heading">
              <span className="patient-register-heading__icon">
                <User size={24} />
              </span>
              <div>
                <h1>Hoàn thiện hồ sơ bệnh nhân</h1>
                <p>Các trường này không bắt buộc nhưng giúp bệnh viện hỗ trợ bạn tốt hơn.</p>
              </div>
            </div>

            <form className="patient-register-form" onSubmit={submitProfile} noValidate>
              <fieldset className="patient-profile-group">
                <legend>
                  <Users size={20} />
                  1. Thông tin cá nhân
                </legend>

                <div className="patient-register-grid">
                  <InputField
                    label="Ngày sinh"
                    name="date_of_birth"
                    value={formState.date_of_birth}
                    type="date"
                    icon={Calendar}
                    error={visibleProfileErrors.date_of_birth || serverFieldErrors.date_of_birth}
                    onChange={handleChange}
                  />

                  <label className={`patient-register-field ${visibleProfileErrors.gender || serverFieldErrors.gender ? 'has-error' : ''}`}>
                    <span className="patient-register-field__label">Giới tính</span>
                    <span className="patient-input-shell">
                      <User className="patient-input-shell__icon" size={19} />
                      <select name="gender" value={formState.gender} onChange={handleChange}>
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </span>
                    <FieldError message={visibleProfileErrors.gender || serverFieldErrors.gender} />
                  </label>
                </div>

                <InputField
                  label="Địa chỉ"
                  name="address"
                  value={formState.address}
                  placeholder="Ví dụ: 123 Nguyễn Văn Linh, Đà Nẵng"
                  icon={MapPin}
                  error={visibleProfileErrors.address || serverFieldErrors.address}
                  onChange={handleChange}
                />

                <div className="patient-register-grid">
                  <InputField
                    label="CCCD / CMND / Hộ chiếu"
                    name="national_id"
                    value={formState.national_id}
                    placeholder="Ví dụ: 012345678901"
                    icon={FileText}
                    error={visibleProfileErrors.national_id || serverFieldErrors.national_id}
                    onChange={handleChange}
                  />

                  <InputField
                    label="Số bảo hiểm y tế"
                    name="insurance_number"
                    value={formState.insurance_number}
                    placeholder="Ví dụ: DN123456789"
                    icon={Shield}
                    error={visibleProfileErrors.insurance_number || serverFieldErrors.insurance_number}
                    onChange={handleChange}
                  />
                </div>
              </fieldset>

              <fieldset className="patient-profile-group">
                <legend>
                  <HeartPulse size={20} />
                  2. Liên hệ khẩn cấp
                </legend>

                <div className="patient-register-grid">
                  <InputField
                    label="Người liên hệ khẩn cấp"
                    name="emergency_contact_name"
                    value={formState.emergency_contact_name}
                    placeholder="Ví dụ: Nguyễn Thị B"
                    icon={Users}
                    error={visibleProfileErrors.emergency_contact_name || serverFieldErrors.emergency_contact_name}
                    onChange={handleChange}
                  />

                  <InputField
                    label="Số điện thoại liên hệ khẩn cấp"
                    name="emergency_contact_phone"
                    value={formState.emergency_contact_phone}
                    placeholder="Ví dụ: 0912345678"
                    icon={Phone}
                    note="Chỉ nhập số, 9-11 ký tự."
                    error={visibleProfileErrors.emergency_contact_phone || serverFieldErrors.emergency_contact_phone}
                    onChange={handleChange}
                  />
                </div>
              </fieldset>

              <FormNotice>Các trường hồ sơ bổ sung sẽ không được gửi nếu bạn để trống.</FormNotice>

              {apiMessage ? (
                <FormNotice tone={apiMessage.tone}>
                  <p>{apiMessage.message}</p>
                  {apiMessage.details.length ? (
                    <ul>
                      {apiMessage.details.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  ) : null}
                </FormNotice>
              ) : null}

              <div className="patient-register-actions">
                <button
                  type="button"
                  className="register-secondary-button"
                  disabled={isSubmitting}
                  onClick={() => submitRegistration(false)}
                >
                  Bỏ qua
                </button>
                <button type="submit" className="register-primary-button" disabled={isSubmitting}>
                  <Save size={20} />
                  {isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ'}
                </button>
              </div>
            </form>
          </section>

          <aside className="patient-profile-progress-card" aria-label="Tiến độ hồ sơ">
            <h2>Hồ sơ của bạn</h2>
            <div className="patient-profile-progress" style={{ '--progress': `${profileProgress}%` }}>
              <strong>{profileProgress}%</strong>
              <span>hoàn tất</span>
            </div>
            <ul>
              <li>
                <CheckCircle size={18} />
                <span>Thông tin tài khoản</span>
                <b>100%</b>
              </li>
              <li>
                <span className="patient-progress-dot" />
                <span>Thông tin cá nhân</span>
                <b>{Math.round(((['date_of_birth', 'gender', 'address', 'national_id', 'insurance_number'].filter((field) => hasValue(formState[field])).length) / 5) * 100)}%</b>
              </li>
              <li>
                <span className="patient-progress-dot patient-progress-dot--muted" />
                <span>Liên hệ khẩn cấp</span>
                <b>{Math.round(((['emergency_contact_name', 'emergency_contact_phone'].filter((field) => hasValue(formState[field])).length) / 2) * 100)}%</b>
              </li>
            </ul>
            <FormNotice>
              Thông tin của bạn được dùng cho mục đích chăm sóc sức khỏe và hỗ trợ liên hệ khi cần.
            </FormNotice>
          </aside>
        </div>
      ) : null}

      {step === 'success' ? (
        <section className="patient-register-card patient-register-card--success" aria-label="Đăng ký thành công">
          <StepIndicator step={step} />

          <div className="patient-success-icon" aria-hidden="true">
            <CheckCircle size={78} />
          </div>

          <h1>Đăng ký tài khoản thành công</h1>
          <p className="patient-success-copy">
            Tài khoản bệnh nhân của bạn đã được tạo thành công.
            Vui lòng đăng nhập để tiếp tục sử dụng hệ thống.
          </p>

          <dl className="patient-success-summary">
            <div>
              <dt>
                <User size={19} />
                Họ và tên:
              </dt>
              <dd>{displayPatient.full_name || formState.full_name.trim()}</dd>
            </div>
            <div>
              <dt>
                <User size={19} />
                Tên đăng nhập:
              </dt>
              <dd>{displayUsername}</dd>
            </div>
            {displayPatient.email || formState.email ? (
              <div>
                <dt>
                  <Mail size={19} />
                  Email:
                </dt>
                <dd>{displayPatient.email || normalizeLowerInput(formState.email)}</dd>
              </div>
            ) : null}
            {displayPatient.phone || formState.phone ? (
              <div>
                <dt>
                  <Phone size={19} />
                  Số điện thoại:
                </dt>
                <dd>{displayPatient.phone || normalizePhoneInput(formState.phone)}</dd>
              </div>
            ) : null}
          </dl>

          <FormNotice tone="success">
            {submittedWithProfile
              ? 'Hồ sơ bổ sung đã được gửi cùng thông tin đăng ký.'
              : 'Bạn có thể hoàn thiện thêm hồ sơ bệnh nhân sau khi đăng nhập.'}
          </FormNotice>

          <div className="patient-success-actions">
            <button type="button" className="register-primary-button" onClick={() => navigate('/login', { replace: true })}>
              <LogIn size={21} />
              Đăng nhập ngay
            </button>
            <Link className="register-secondary-button" to="/home">
              <Home size={20} />
              Quay lại trang chủ
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
