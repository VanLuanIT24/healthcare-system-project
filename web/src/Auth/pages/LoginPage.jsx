import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Info,
  Lock,
  LogIn,
  ShieldCheck,
  User,
} from 'lucide-react';
import { API_BASE_URL } from '../../lib/api';
import { resolvePostLoginRedirect } from '../../lib/authSession';
import { readStoredAuth, writeStoredAuth } from '../../lib/storage';

const INITIAL_FORM_STATE = {
  login: '',
  password: '',
  remember_device: false,
};

function parseRetryAfterSeconds(response, payload) {
  const headerValue = Number(response.headers.get('Retry-After'));
  if (Number.isFinite(headerValue) && headerValue > 0) return headerValue;

  const retryAfter = Number(payload?.details?.retry_after_seconds);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;

  return 0;
}

function buildAuthData(payload) {
  const data = payload?.data || {};

  return {
    actorType: data.actor_type || 'patient',
    patient: data.patient || null,
    permissions: data.permissions || [],
    roles: data.roles || [],
    tokens: data.tokens || {
      access_token: data.access_token || '',
      refresh_token: data.refresh_token || '',
      token_type: data.token_type || 'Bearer',
      expires_in: data.expires_in || 0,
    },
  };
}

function mapLoginError(response, payload) {
  if (response.status === 429) {
    return {
      tone: 'warning',
      message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.',
    };
  }

  if (response.status === 401) {
    return {
      tone: 'error',
      message: payload?.message || 'Thông tin tài khoản hoặc mật khẩu không chính xác.',
    };
  }

  if (response.status >= 500) {
    return {
      tone: 'error',
      message: 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.',
    };
  }

  return {
    tone: 'error',
    message: payload?.message || 'Đăng nhập thất bại. Vui lòng thử lại.',
  };
}

function BackgroundArtwork() {
  return (
    <div className="patient-register-artwork patient-login-artwork" aria-hidden="true">
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

function BrandHeader() {
  return (
    <header className="patient-register-brand patient-login-brand">
      <Link className="patient-register-logo" to="/home" aria-label="MedCare Portal">
        <span className="patient-register-logo__mark" aria-hidden="true">
          <span />
        </span>
        <span>
          <strong>
            MedCare <em>Portal</em>
          </strong>
          <small>Cổng thông tin chăm sóc sức khỏe của bạn</small>
        </span>
      </Link>
    </header>
  );
}

function FieldError({ message }) {
  if (!message) return null;

  return (
    <p className="patient-login-field-error">
      <AlertCircle size={15} />
      <span>{message}</span>
    </p>
  );
}

function FormAlert({ tone = 'info', message, cooldownSeconds = 0 }) {
  if (!message) return null;

  const Icon = tone === 'warning' ? AlertCircle : tone === 'error' ? AlertCircle : Info;

  return (
    <div className={`patient-login-alert patient-login-alert--${tone}`}>
      <Icon size={18} />
      <div>
        <p>{message}</p>
        {tone === 'warning' && cooldownSeconds > 0 ? (
          <small>Vui lòng thử lại sau khoảng {cooldownSeconds} giây.</small>
        ) : null}
      </div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formAlert, setFormAlert] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const redirectTarget = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('redirect');
  }, [location.search]);

  useEffect(() => {
    const auth = readStoredAuth();
    if (auth?.tokens?.access_token) {
      navigate(resolvePostLoginRedirect(redirectTarget, auth), { replace: true });
    }
  }, [navigate, redirectTarget]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const canSubmit = useMemo(() => {
    return formState.login.trim() && formState.password.length > 0 && !isSubmitting && cooldownSeconds === 0;
  }, [cooldownSeconds, formState.login, formState.password, isSubmitting]);

  function clearFieldError(name) {
    if (!fieldErrors[name]) return;

    setFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    setFormState((current) => ({
      ...current,
      [name]: nextValue,
    }));

    if (type !== 'checkbox') {
      clearFieldError(name);
    }

    if (formAlert?.tone !== 'warning') {
      setFormAlert(null);
    }
  }

  function validateForm() {
    const errors = {};

    if (!formState.login.trim()) {
      errors.login = 'Vui lòng nhập email, số điện thoại hoặc tên đăng nhập.';
    }

    if (!formState.password.length) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    }

    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validateForm();
    setFieldErrors(errors);
    setFormAlert(null);

    if (Object.keys(errors).length > 0 || cooldownSeconds > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/patient/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: formState.login.trim(),
          password: formState.password,
        }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        const retryAfterSeconds = parseRetryAfterSeconds(response, payload);
        if (retryAfterSeconds > 0) {
          setCooldownSeconds(retryAfterSeconds);
        }

        setFormAlert(mapLoginError(response, payload));
        return;
      }

      const authData = buildAuthData(payload);
      writeStoredAuth(authData, { persist: formState.remember_device });
      navigate(resolvePostLoginRedirect(redirectTarget, authData), { replace: true });
    } catch (error) {
      setFormAlert({
        tone: 'error',
        message: error.message || 'Không thể kết nối đến máy chủ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="patient-login-page">
      <BackgroundArtwork />
      <BrandHeader />

      <section className="patient-login-card" aria-label="Đăng nhập bệnh nhân">
        <div className="patient-login-card__icon" aria-hidden="true">
          <User size={28} />
        </div>

        <div className="patient-login-card__header">
          <h1>Đăng nhập bệnh nhân</h1>
          <p>Truy cập hồ sơ, lịch hẹn và dịch vụ chăm sóc sức khỏe của bạn.</p>
        </div>

        <form className="patient-login-form" onSubmit={handleSubmit} noValidate>
          <label className={`patient-login-field ${fieldErrors.login ? 'has-error' : ''}`}>
            <span className="patient-login-field__label">
              Email / Số điện thoại / Tên đăng nhập <b>*</b>
            </span>
            <span className="patient-login-input">
              <User className="patient-login-input__icon" size={19} />
              <input
                type="text"
                name="login"
                value={formState.login}
                placeholder="Nhập email, số điện thoại hoặc tên đăng nhập"
                autoComplete="username"
                onChange={handleChange}
              />
            </span>
            <FieldError message={fieldErrors.login} />
          </label>

          <label className={`patient-login-field ${fieldErrors.password ? 'has-error' : ''}`}>
            <span className="patient-login-field__label">
              Mật khẩu <b>*</b>
            </span>
            <span className="patient-login-input">
              <Lock className="patient-login-input__icon" size={19} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formState.password}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                onChange={handleChange}
              />
              <button
                type="button"
                className="patient-login-input__toggle"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
            <FieldError message={fieldErrors.password} />
          </label>

          <div className="patient-login-alert patient-login-alert--info">
            <Info size={18} />
            <p>Bạn có thể dùng email, số điện thoại hoặc tên đăng nhập để đăng nhập.</p>
          </div>

          <FormAlert tone={formAlert?.tone} message={formAlert?.message} cooldownSeconds={cooldownSeconds} />

          <div className="patient-login-actions-row">
            <label className="patient-login-checkbox">
              <input
                type="checkbox"
                name="remember_device"
                checked={formState.remember_device}
                onChange={handleChange}
              />
              <span className="patient-login-checkbox__box" aria-hidden="true">
                {formState.remember_device ? <Check size={14} /> : null}
              </span>
              <span>Ghi nhớ thiết bị này</span>
            </label>

            <Link className="patient-login-link" to="/patient/forgot-password">
              Quên mật khẩu?
            </Link>
          </div>

          <div className="patient-login-security">
            <div className="patient-login-security__icon" aria-hidden="true">
              <ShieldCheck size={22} />
            </div>
            <div className="patient-login-security__content">
              <strong>Bảo mật đăng nhập</strong>
              <ul>
                <li>Không chia sẻ mật khẩu của bạn với người khác.</li>
                <li>Hệ thống hỗ trợ đăng nhập bằng email, số điện thoại hoặc tên đăng nhập.</li>
              </ul>
            </div>
          </div>

          <button type="submit" className="patient-login-submit" disabled={!canSubmit}>
            <LogIn size={20} />
            <span>
              {isSubmitting
                ? 'Đang đăng nhập...'
                : cooldownSeconds > 0
                  ? `Thử lại sau ${cooldownSeconds}s`
                  : 'Đăng nhập'}
            </span>
          </button>

          <p className="patient-login-register">
            Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
