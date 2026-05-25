import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { AppLogo } from '../../app/AppLogo';
import { API_BASE_URL } from '../../lib/api';
import { inferIdentifierFields, usePasswordPolicyValidation } from '../../lib/passwordPolicy';
import { PasswordPolicyChecklist } from '../components/PasswordPolicyChecklist';
import { RecoveryCodeInput } from '../components/RecoveryCodeInput';
import { evaluatePasswordPolicy, getRecoveryActor } from '../recovery/recoveryConfig';
import {
  parseRetryAfterSeconds,
  readJsonResponse,
  resolveRecoveryActorFromPath,
} from '../recovery/recoveryUtils';

const CODE_LENGTH = 6;

function firstDetailMessage(payload) {
  if (!Array.isArray(payload?.details)) return '';
  const match = payload.details.find((item) => item?.message);
  return match?.message || '';
}

function getResetErrorMessage(payload) {
  const combined = [payload?.message, firstDetailMessage(payload)].filter(Boolean).join(' ');

  if (/Không được dùng lại/i.test(combined)) {
    return 'Bạn không thể sử dụng lại mật khẩu cũ gần đây. Vui lòng chọn mật khẩu khác.';
  }

  if (/Password policy validation failed/i.test(combined) || /Password must/i.test(combined) || /Password is too common/i.test(combined)) {
    return 'Mật khẩu chưa đáp ứng yêu cầu bảo mật. Vui lòng kiểm tra lại các điều kiện bên dưới.';
  }

  return payload?.message || firstDetailMessage(payload) || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.';
}

function isInvalidResetResponse(response, payload) {
  if (response.status === 401) return true;
  const message = [payload?.message, firstDetailMessage(payload)].filter(Boolean).join(' ');
  return /invalid or expired|không hợp lệ|hết hạn/i.test(message);
}

function StepIndicator({ stage }) {
  const states = {
    'verify-code': ['done', 'active', 'pending'],
    'verifying-link': ['done', 'active', 'pending'],
    reset: ['done', 'done', 'active'],
    success: ['done', 'done', 'done'],
    invalid: ['done', 'done', 'error'],
  };

  const items = states[stage] || ['done', 'active', 'pending'];
  const labels = ['Yêu cầu', 'Xác minh', 'Đặt lại'];

  return (
    <div className="auth-recovery-steps auth-recovery-steps--reset">
      {items.map((status, index) => (
        <div key={labels[index]} className={`is-${status}`}>
          <span>
            {status === 'done'
              ? <CheckCircle2 size={16} />
              : status === 'error'
                ? <AlertTriangle size={16} />
                : String(index + 1)}
          </span>
          <strong>{labels[index]}</strong>
        </div>
      ))}
    </div>
  );
}

function RecoveryAlert({ tone = 'info', message, cooldownSeconds = 0 }) {
  if (!message) return null;

  const Icon = tone === 'warning' ? Clock3 : tone === 'error' ? AlertTriangle : Info;

  return (
    <div className={`auth-recovery-note auth-recovery-note--${tone}`}>
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

export function ResetPasswordPage() {
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const routeActorType = useMemo(
    () => resolveRecoveryActorFromPath(location.pathname, searchParams),
    [location.pathname, searchParams],
  );
  const actor = useMemo(() => getRecoveryActor(routeActorType), [routeActorType]);
  const token = useMemo(
    () => searchParams.get('token') || searchParams.get('reset_token') || '',
    [searchParams],
  );
  const identifier = useMemo(
    () => searchParams.get('login') || searchParams.get('identifier') || location.state?.login || '',
    [location.state, searchParams],
  );
  const initialCode = useMemo(
    () => searchParams.get('code') || searchParams.get('reset_code') || location.state?.devResetCode || '',
    [location.state, searchParams],
  );
  const [stage, setStage] = useState(() => (token ? 'verifying-link' : identifier ? 'verify-code' : 'invalid'));
  const [verificationCode, setVerificationCode] = useState(String(initialCode || '').replace(/\D/g, '').slice(0, CODE_LENGTH));
  const [verifiedCredential, setVerifiedCredential] = useState({
    token: token || '',
    code: '',
    identifier,
  });
  const [verifiedActorType, setVerifiedActorType] = useState('');
  const [formState, setFormState] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const effectiveActorType = verifiedActorType || routeActorType;
  const effectiveResetActor = useMemo(
    () => getRecoveryActor(effectiveActorType),
    [effectiveActorType],
  );
  const identifierFields = useMemo(
    () => inferIdentifierFields(verifiedCredential.identifier || identifier),
    [identifier, verifiedCredential.identifier],
  );
  const passwordPolicyValidation = usePasswordPolicyValidation({
    actorType: effectiveActorType,
    password: formState.newPassword,
    username: identifierFields.username,
    email: identifierFields.email,
    phone: identifierFields.phone,
    clientApp: routeActorType === 'staff' ? 'staff-portal' : 'patient-portal',
    enabled: stage === 'reset' && Boolean(formState.newPassword),
  });

  const policyState = useMemo(
    () => evaluatePasswordPolicy(
      effectiveActorType,
      formState.newPassword,
      [verifiedCredential.identifier || identifier],
    ),
    [effectiveActorType, formState.newPassword, identifier, verifiedCredential.identifier],
  );
  const policyPassed = useMemo(
    () => Object.values(policyState).every(Boolean),
    [policyState],
  );
  const passwordValidationMessage = passwordPolicyValidation.messages[0] || '';

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    setVerifiedActorType('');
  }, [routeActorType, token, identifier]);

  useEffect(() => {
    let isCancelled = false;

    async function verifyByToken() {
      setIsBusy(true);
      setAlert(null);
      setStage('verifying-link');

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-reset-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Platform': 'web',
            'X-Client-App': routeActorType === 'staff' ? 'staff-portal' : 'patient-portal',
          },
          body: JSON.stringify({
            actorType: routeActorType,
            token,
          }),
        });

        const payload = await readJsonResponse(response);
        if (!response.ok) {
          if (!isCancelled) {
            setAlert({
              tone: response.status === 429 ? 'warning' : 'error',
              message: response.status === 429
                ? 'Bạn đã xác minh quá nhiều lần. Vui lòng thử lại sau.'
                : 'Liên kết hoặc mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
            });
            const retryAfterSeconds = parseRetryAfterSeconds(response, payload);
            if (retryAfterSeconds > 0) {
              setCooldownSeconds(retryAfterSeconds);
            }
            setStage(response.status === 429 ? 'verifying-link' : 'invalid');
          }
          return;
        }

        if (!isCancelled) {
          setVerifiedActorType(payload?.data?.actor_type || routeActorType);
          setVerifiedCredential({
            token,
            code: '',
            identifier,
          });
          setStage('reset');
        }
      } catch (error) {
        if (!isCancelled) {
          setAlert({
            tone: 'error',
            message: error.message || 'Không thể kết nối đến máy chủ.',
          });
          setStage('verifying-link');
        }
      } finally {
        if (!isCancelled) {
          setIsBusy(false);
        }
      }
    }

    if (token) {
      verifyByToken();
      return () => {
        isCancelled = true;
      };
    }

    setStage(identifier ? 'verify-code' : 'invalid');
    return undefined;
  }, [identifier, routeActorType, token]);

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
    if (alert?.tone !== 'warning') {
      setAlert(null);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();

    if (verificationCode.length < CODE_LENGTH) {
      setAlert({
        tone: 'error',
        message: 'Vui lòng nhập đầy đủ mã xác minh.',
      });
      return;
    }

    setIsBusy(true);
    setAlert(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-reset-token`, {
        method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
        'X-Client-App': routeActorType === 'staff' ? 'staff-portal' : 'patient-portal',
      },
      body: JSON.stringify({
        actorType: routeActorType,
        code: verificationCode,
        login: identifier,
      }),
      });

      const payload = await readJsonResponse(response);

      if (!response.ok) {
        const retryAfterSeconds = parseRetryAfterSeconds(response, payload);
        if (retryAfterSeconds > 0) {
          setCooldownSeconds(retryAfterSeconds);
        }

        if (isInvalidResetResponse(response, payload)) {
          setStage('invalid');
          setAlert({
            tone: 'error',
            message: 'Liên kết hoặc mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
          });
          return;
        }

        setAlert({
          tone: response.status === 429 ? 'warning' : 'error',
          message: response.status === 429
            ? 'Bạn đã xác minh quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.'
            : (payload?.message || 'Không thể xác minh mã đặt lại mật khẩu.'),
        });
        return;
      }

      setVerifiedActorType(payload?.data?.actor_type || routeActorType);
      setVerifiedCredential({
        token: '',
        code: verificationCode,
        identifier,
      });
      setStage('reset');
      setAlert(null);
    } catch (error) {
      setAlert({
        tone: 'error',
        message: error.message || 'Không thể kết nối đến máy chủ.',
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResendCode() {
    if (!identifier || cooldownSeconds > 0) return;

    setIsBusy(true);
    setAlert(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
        'X-Client-App': routeActorType === 'staff' ? 'staff-portal' : 'patient-portal',
      },
      body: JSON.stringify({
        actorType: routeActorType,
        login: identifier,
      }),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        const retryAfterSeconds = parseRetryAfterSeconds(response, payload);
        if (retryAfterSeconds > 0) {
          setCooldownSeconds(retryAfterSeconds);
        }

        setAlert({
          tone: response.status === 429 ? 'warning' : 'error',
          message: response.status === 429
            ? 'Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.'
            : (payload?.message || 'Không thể gửi lại mã xác minh.'),
        });
        return;
      }

      setCooldownSeconds(Math.max(parseRetryAfterSeconds(response, payload), 60));
      setAlert({
        tone: 'info',
        message: 'Nếu tài khoản tồn tại, mã hoặc liên kết mới đã được gửi tới kênh liên hệ đã đăng ký.',
      });
    } catch (error) {
      setAlert({
        tone: 'error',
        message: error.message || 'Không thể kết nối đến máy chủ.',
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setAlert(null);

    if (!formState.newPassword) {
      setAlert({
        tone: 'error',
        message: 'Vui lòng nhập mật khẩu mới.',
      });
      return;
    }

    if (!formState.confirmPassword) {
      setAlert({
        tone: 'error',
        message: 'Vui lòng nhập lại mật khẩu mới.',
      });
      return;
    }

    if (formState.newPassword !== formState.confirmPassword) {
      setAlert({
        tone: 'error',
        message: 'Mật khẩu xác nhận không khớp.',
      });
      return;
    }

    if (!policyPassed) {
      setAlert({
        tone: 'error',
        message: 'Mật khẩu chưa đáp ứng yêu cầu bảo mật. Vui lòng kiểm tra lại các điều kiện bên dưới.',
      });
      return;
    }

    const passwordValidationResult = await passwordPolicyValidation.validateNow();
    if (!passwordValidationResult.valid) {
      setAlert({
        tone: passwordValidationResult.status === 'rate-limited' ? 'warning' : 'error',
        message: passwordValidationResult.messages[0] || 'Mật khẩu chưa đáp ứng chính sách bảo mật.',
      });
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
        'X-Client-App': routeActorType === 'staff' ? 'staff-portal' : 'patient-portal',
      },
      body: JSON.stringify({
          actorType: effectiveActorType,
          ...(verifiedCredential.token
            ? { token: verifiedCredential.token }
            : {
              code: verifiedCredential.code,
              login: verifiedCredential.identifier || identifier,
            }),
          newPassword: formState.newPassword,
        }),
      });

      const payload = await readJsonResponse(response);

      if (!response.ok) {
        const retryAfterSeconds = parseRetryAfterSeconds(response, payload);
        if (retryAfterSeconds > 0) {
          setCooldownSeconds(retryAfterSeconds);
        }

        if (isInvalidResetResponse(response, payload)) {
          setStage('invalid');
          setAlert({
            tone: 'error',
            message: 'Liên kết hoặc mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
          });
          return;
        }

        setAlert({
          tone: response.status === 429 ? 'warning' : 'error',
          message: response.status === 429
            ? 'Bạn đã thử quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.'
            : getResetErrorMessage(payload),
        });
        return;
      }

      setStage('success');
      setAlert(null);
    } catch (error) {
      setAlert({
        tone: 'error',
        message: error.message || 'Không thể kết nối đến máy chủ.',
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="auth-recovery-page">
      <div className="auth-recovery-artwork patient-login-artwork" aria-hidden="true">
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

      <section className="auth-recovery-layout">
        <aside className="auth-recovery-hero">
          <Link className="patient-register-logo auth-recovery-logo" to="/home" aria-label="Bộ Y tế">
            <AppLogo variant="horizontal" />
          </Link>

          <div className="auth-recovery-hero__copy">
            <h1>
              <span>Quản lý thông minh</span>
              <span>Nâng tầm chăm sóc</span>
            </h1>
            <p>Hệ thống y tế số giúp tối ưu quy trình vận hành, nâng cao hiệu suất và chất lượng dịch vụ y tế.</p>
          </div>

          <div className="auth-recovery-hero__chips">
            <span>Bảo mật</span>
            <span>An toàn</span>
            <span>Tuân thủ</span>
          </div>
        </aside>

        <section className="auth-recovery-card" aria-label="Đặt lại mật khẩu">
          <StepIndicator stage={stage} />

          {stage === 'verifying-link' ? (
            <>
              <header className="auth-recovery-card__header">
                <h2>Đang xác minh liên kết</h2>
                <p>Hệ thống đang kiểm tra tính hợp lệ của liên kết đặt lại mật khẩu.</p>
              </header>

              <div className="auth-recovery-loading">
                <div className="auth-recovery-loading__spinner" aria-hidden="true" />
                <p>Vui lòng chờ trong giây lát...</p>
              </div>

              <RecoveryAlert tone={alert?.tone} message={alert?.message} cooldownSeconds={cooldownSeconds} />

              {alert ? (
                <div className="auth-recovery-success-actions">
                  <Link className="auth-recovery-submit auth-recovery-submit--link" to={actor.forgotPath}>
                    <span>Yêu cầu liên kết mới</span>
                    <ArrowRight size={18} />
                  </Link>
                  <Link className="auth-recovery-secondary" to={actor.loginPath}>
                    Quay lại đăng nhập
                  </Link>
                </div>
              ) : null}
            </>
          ) : null}

          {stage === 'verify-code' ? (
            <>
              <header className="auth-recovery-card__header">
                <h2>Xác minh mã đặt lại</h2>
                <p>{actor.verifyHint}</p>
              </header>

              <form className="auth-recovery-form auth-recovery-form--verify" onSubmit={handleVerifyCode} noValidate>
                <label className="auth-recovery-field">
                  <span>Mã xác minh <b>*</b></span>
                  <RecoveryCodeInput
                    value={verificationCode}
                    onChange={(value) => {
                      setVerificationCode(value);
                      if (alert?.tone !== 'warning') {
                        setAlert(null);
                      }
                    }}
                    disabled={isBusy}
                    length={CODE_LENGTH}
                  />
                </label>

                <p className="auth-recovery-inline-note">
                  <Clock3 size={16} />
                  <span>Mã xác minh chỉ có hiệu lực trong thời gian ngắn và chỉ dùng được một lần.</span>
                </p>

                <RecoveryAlert tone={alert?.tone} message={alert?.message} cooldownSeconds={cooldownSeconds} />

                <button
                  type="button"
                  className="auth-recovery-resend auth-recovery-resend--inline"
                  disabled={cooldownSeconds > 0 || isBusy}
                  onClick={handleResendCode}
                >
                  <RefreshCcw size={16} />
                  <span>{cooldownSeconds > 0 ? `Gửi lại sau ${cooldownSeconds} giây` : 'Gửi lại mã'}</span>
                </button>

                <button
                  type="submit"
                  className="auth-recovery-submit"
                  disabled={verificationCode.length !== CODE_LENGTH || isBusy || (alert?.tone === 'warning' && cooldownSeconds > 0)}
                >
                  <span>{isBusy ? 'Đang xác minh...' : 'Xác minh và tiếp tục'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>

              <Link className="auth-recovery-back-link" to={actor.loginPath}>
                Quay lại đăng nhập
              </Link>

              <p className="auth-recovery-footnote">
                <Mail size={16} />
                <span>Bạn cũng có thể mở liên kết đặt lại mật khẩu trong email hoặc tin nhắn nếu đã nhận được.</span>
              </p>
            </>
          ) : null}

          {stage === 'reset' ? (
            <>
              <header className="auth-recovery-card__header">
                <h2>{effectiveResetActor.resetTitle}</h2>
                <p>{effectiveResetActor.resetSubtitle}</p>
              </header>

              <form className="auth-recovery-form auth-recovery-form--reset" onSubmit={handleResetPassword} noValidate>
                <label className="auth-recovery-field">
                  <span>Mật khẩu mới <b>*</b></span>
                  <div className="auth-recovery-input">
                    <Lock size={18} />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={formState.newPassword}
                      placeholder="Nhập mật khẩu mới"
                      autoComplete="new-password"
                      onChange={handlePasswordChange}
                      onBlur={() => passwordPolicyValidation.validateNow().catch(() => {})}
                    />
                    <button
                      type="button"
                      className="auth-recovery-input__toggle"
                      aria-label={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                      onClick={() => setShowNewPassword((current) => !current)}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <label className="auth-recovery-field">
                  <span>Xác nhận mật khẩu <b>*</b></span>
                  <div className="auth-recovery-input">
                    <Lock size={18} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formState.confirmPassword}
                      placeholder="Nhập lại mật khẩu mới"
                      autoComplete="new-password"
                      onChange={handlePasswordChange}
                    />
                    <button
                      type="button"
                      className="auth-recovery-input__toggle"
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                      onClick={() => setShowConfirmPassword((current) => !current)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <RecoveryAlert tone={alert?.tone} message={alert?.message} cooldownSeconds={cooldownSeconds} />

                <PasswordPolicyChecklist
                  actorType={effectiveActorType}
                  password={formState.newPassword}
                  identifiers={[verifiedCredential.identifier || identifier]}
                />

                {passwordPolicyValidation.isChecking ? (
                  <RecoveryAlert tone="info" message="Đang kiểm tra mật khẩu với máy chủ..." />
                ) : null}

                {!passwordPolicyValidation.isChecking && passwordPolicyValidation.status === 'valid' && formState.newPassword ? (
                  <RecoveryAlert tone="info" message="Mật khẩu đáp ứng chính sách bảo mật của hệ thống." />
                ) : null}

                {!passwordPolicyValidation.isChecking && passwordValidationMessage ? (
                  <RecoveryAlert
                    tone={passwordPolicyValidation.status === 'rate-limited' ? 'warning' : 'error'}
                    message={passwordValidationMessage}
                    cooldownSeconds={passwordPolicyValidation.cooldownSeconds}
                  />
                ) : null}

                <button
                  type="submit"
                  className="auth-recovery-submit"
                  disabled={isBusy || passwordPolicyValidation.isChecking || (alert?.tone === 'warning' && cooldownSeconds > 0)}
                >
                  <span>{isBusy ? 'Đang đặt lại mật khẩu...' : 'Đặt lại mật khẩu'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>

              <Link className="auth-recovery-back-link" to={actor.loginPath}>
                Quay lại đăng nhập
              </Link>
            </>
          ) : null}

          {stage === 'success' ? (
            <>
              <header className="auth-recovery-card__header auth-recovery-card__header--success">
                <div className="auth-recovery-card__icon auth-recovery-card__icon--success" aria-hidden="true">
                  <CheckCircle2 size={34} />
                </div>
                <h2>Đặt lại mật khẩu thành công</h2>
                <p>Mật khẩu của bạn đã được cập nhật.</p>
              </header>

              <div className="auth-recovery-note auth-recovery-note--info">
                <Info size={18} />
                <p>Vì lý do bảo mật, tất cả phiên đăng nhập cũ đã bị đăng xuất. Vui lòng đăng nhập lại bằng mật khẩu mới.</p>
              </div>

              <div className="auth-recovery-success-actions">
                <Link className="auth-recovery-submit auth-recovery-submit--link" to={effectiveResetActor.loginPath}>
                  <span>Đăng nhập lại</span>
                  <ArrowRight size={18} />
                </Link>
                <Link className="auth-recovery-secondary" to="/home">
                  Về trang chủ
                </Link>
              </div>

              <p className="auth-recovery-security-copy auth-recovery-security-copy--success">
                <ShieldCheck size={16} />
                <span>Bạn cũng sẽ nhận được thông báo xác nhận thay đổi mật khẩu.</span>
              </p>
            </>
          ) : null}

          {stage === 'invalid' ? (
            <>
              <header className="auth-recovery-card__header auth-recovery-card__header--invalid">
                <div className="auth-recovery-card__icon auth-recovery-card__icon--invalid" aria-hidden="true">
                  <AlertTriangle size={34} />
                </div>
                <h2>Liên kết không hợp lệ hoặc đã hết hạn</h2>
                <p>Liên kết hoặc mã đặt lại mật khẩu không còn hiệu lực. Vui lòng yêu cầu một liên kết mới.</p>
              </header>

              <RecoveryAlert
                tone={alert?.tone || 'warning'}
                message={alert?.message || 'Vì lý do bảo mật, mỗi liên kết chỉ được sử dụng một lần và có thời hạn giới hạn.'}
                cooldownSeconds={cooldownSeconds}
              />

              <div className="auth-recovery-success-actions">
                <Link className="auth-recovery-submit auth-recovery-submit--link" to={actor.forgotPath}>
                  <span>Yêu cầu liên kết mới</span>
                  <ArrowRight size={18} />
                </Link>
                <Link className="auth-recovery-secondary" to={actor.loginPath}>
                  Quay lại đăng nhập
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}
