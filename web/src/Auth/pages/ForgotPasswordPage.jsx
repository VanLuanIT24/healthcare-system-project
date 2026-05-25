import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BriefcaseMedical,
  CheckCircle2,
  Clock3,
  Info,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppLogo } from '../../app/AppLogo';
import { API_BASE_URL } from '../../lib/api';
import { getRecoveryActor } from '../recovery/recoveryConfig';
import { buildRecoveryPath, parseRetryAfterSeconds, readJsonResponse, resolveRecoveryActorFromPath } from '../recovery/recoveryUtils';

const INITIAL_STATE = {
  login: '',
};

export function ForgotPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const actorType = useMemo(
    () => resolveRecoveryActorFromPath(location.pathname, new URLSearchParams(location.search)),
    [location.pathname, location.search],
  );
  const actor = useMemo(() => getRecoveryActor(actorType), [actorType]);

  const [formState, setFormState] = useState(INITIAL_STATE);
  const [errorMessage, setErrorMessage] = useState('');
  const [successState, setSuccessState] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const canSubmit = useMemo(() => {
    return formState.login.trim().length > 0 && !isSubmitting && cooldownSeconds === 0;
  }, [cooldownSeconds, formState.login, isSubmitting]);

  function handleIdentifierChange(event) {
    setFormState({ login: event.target.value });
    setErrorMessage('');
  }

  async function submitForgotPassword() {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
        'X-Client-App': actorType === 'staff' ? 'staff-portal' : 'patient-portal',
      },
      body: JSON.stringify({
        actorType,
        login: formState.login.trim(),
      }),
    });

    const payload = await readJsonResponse(response);

    if (!response.ok) {
      const retryAfterSeconds = parseRetryAfterSeconds(response, payload);
      if (retryAfterSeconds > 0) {
        setCooldownSeconds(retryAfterSeconds);
      }

      throw new Error(
        response.status === 429
          ? 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.'
          : (payload?.message || 'Không thể gửi yêu cầu khôi phục mật khẩu.'),
      );
    }

    setSuccessState({
      identifier: formState.login.trim(),
      devResetToken: payload?.data?.reset_token || '',
      devResetCode: payload?.data?.reset_code || '',
    });
    setCooldownSeconds(Math.max(parseRetryAfterSeconds(response, payload), 60));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formState.login.trim() || cooldownSeconds > 0) {
      if (!formState.login.trim()) {
        setErrorMessage(`Vui lòng nhập ${actor.requestLabel.toLowerCase()}.`);
      }
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await submitForgotPassword();
    } catch (error) {
      setErrorMessage(error.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldownSeconds > 0 || !successState?.identifier) return;

    setErrorMessage('');
    setIsSubmitting(true);
    setFormState({ login: successState.identifier });

    try {
      await submitForgotPassword();
    } catch (error) {
      setErrorMessage(error.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinue() {
    if (!successState?.identifier) return;

    navigate(
      buildRecoveryPath(actorType, 'reset', {
        mode: 'code',
        login: successState.identifier,
      }),
      {
        state: {
          devResetCode: successState.devResetCode,
          devResetToken: successState.devResetToken,
          login: successState.identifier,
        },
      },
    );
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

        <section className="auth-recovery-card" aria-label="Khôi phục mật khẩu">
          <div className="auth-recovery-steps">
            <div className="is-active">
              <span>1</span>
              <strong>Yêu cầu</strong>
            </div>
            <div className={successState ? 'is-active' : ''}>
              <span>{successState ? <CheckCircle2 size={16} /> : '2'}</span>
              <strong>Xác minh</strong>
            </div>
            <div>
              <span>3</span>
              <strong>Đặt lại</strong>
            </div>
          </div>

          {!successState ? (
            <>
              <header className="auth-recovery-card__header">
                <h2>{actor.forgotTitle}</h2>
                <p>{actor.forgotSubtitle}</p>
              </header>

              <nav className="auth-recovery-actor-tabs" aria-label="Loại tài khoản">
                <Link to="/patient/forgot-password" className={actorType === 'patient' ? 'is-active' : ''}>
                  <UserRound size={18} />
                  <span>Bệnh nhân</span>
                </Link>
                <Link to="/staff/forgot-password" className={actorType === 'staff' ? 'is-active' : ''}>
                  <BriefcaseMedical size={18} />
                  <span>Nhân sự</span>
                </Link>
              </nav>

              <form className="auth-recovery-form" onSubmit={handleSubmit} noValidate>
                <label className="auth-recovery-field">
                  <span>{actor.requestLabel} <b>*</b></span>
                  <div className={`auth-recovery-input ${errorMessage ? 'has-error' : ''}`}>
                    <Mail size={18} />
                    <input
                      type="text"
                      name="login"
                      value={formState.login}
                      placeholder={actor.requestPlaceholder}
                      onChange={handleIdentifierChange}
                    />
                  </div>
                </label>

                {errorMessage ? <p className="auth-recovery-error">{errorMessage}</p> : null}

                <button type="submit" className="auth-recovery-submit" disabled={!canSubmit}>
                  <span>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi hướng dẫn đặt lại mật khẩu'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>

              <Link className="auth-recovery-back-link" to={actor.loginPath}>
                {actor.loginLinkLabel}
              </Link>

              <div className="auth-recovery-note">
                <Info size={18} />
                <p>Nếu thông tin hợp lệ, chúng tôi sẽ gửi liên kết hoặc mã đặt lại mật khẩu.</p>
              </div>
            </>
          ) : (
            <>
              <header className="auth-recovery-card__header auth-recovery-card__header--success">
                <div className="auth-recovery-card__icon auth-recovery-card__icon--success" aria-hidden="true">
                  <CheckCircle2 size={32} />
                </div>
                <h2>Đã ghi nhận yêu cầu</h2>
                <p>Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.</p>
              </header>

              <div className="auth-recovery-note auth-recovery-note--info">
                <Info size={18} />
                <p>{actor.successChannelText}</p>
              </div>

              <p className="auth-recovery-security-copy">
                <ShieldCheck size={16} />
                <span>Vì lý do bảo mật, chúng tôi không hiển thị tài khoản có tồn tại hay không.</span>
              </p>

              <div className="auth-recovery-success-actions">
                <button type="button" className="auth-recovery-submit" onClick={handleContinue}>
                  <span>Tiếp tục</span>
                  <ArrowRight size={18} />
                </button>
                <Link className="auth-recovery-secondary" to={actor.loginPath}>
                  Quay lại đăng nhập
                </Link>
              </div>

              <button
                type="button"
                className="auth-recovery-resend"
                disabled={cooldownSeconds > 0 || isSubmitting}
                onClick={handleResend}
              >
                <Clock3 size={16} />
                <span>{cooldownSeconds > 0 ? `Gửi lại sau ${cooldownSeconds} giây` : 'Gửi lại ngay'}</span>
              </button>

              {errorMessage ? <p className="auth-recovery-error auth-recovery-error--center">{errorMessage}</p> : null}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
