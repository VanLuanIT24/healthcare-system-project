import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CountryCodeSelect } from '../components/CountryCodeSelect';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { GenderSelect } from '../components/GenderSelect';
import { AddressSelect } from '../components/AddressSelect';
import { ADDRESS_OPTIONS } from '../data/addressOptions';
import { API_BASE_URL } from '../../lib/api';
import { writeStoredAuth } from '../../lib/storage';
import { composeAddress } from '../utils';
export function RegisterPage() {
  const navigate = useNavigate();
  const [formState, setFormState] = useState({
    full_name: '',
    phone_country_code: 'VN|+84',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'unknown',
    address_city: '',
    address_district: '',
    address_ward: '',
    address_line: '',
    password: '',
    confirm_password: '',
    accept_terms: false,
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      formState.full_name.trim() &&
      (formState.email.trim() || formState.phone.trim()) &&
      formState.password.trim() &&
      formState.confirm_password.trim() &&
      formState.accept_terms
    );
  }, [formState]);

  const cityOptions = ADDRESS_OPTIONS;
  const selectedCity = cityOptions.find((city) => city.name === formState.address_city);
  const districtOptions = selectedCity?.districts || [];
  const selectedDistrict = districtOptions.find((district) => district.name === formState.address_district);
  const wardOptions = selectedDistrict?.wards || [];

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    if (name === 'address_city') {
      const nextCity = cityOptions.find((city) => city.name === nextValue) || cityOptions[0];
      const nextDistrict = nextCity?.districts?.[0];
      setFormState((current) => ({
        ...current,
        address_city: nextCity?.name || '',
        address_district: nextDistrict?.name || '',
        address_ward: nextDistrict?.wards?.[0] || '',
      }));
      return;
    }

    if (name === 'address_district') {
      const nextDistrict = districtOptions.find((district) => district.name === nextValue) || districtOptions[0];
      setFormState((current) => ({
        ...current,
        address_district: nextDistrict?.name || '',
        address_ward: nextDistrict?.wards?.[0] || '',
      }));
      return;
    }

    if (name === 'address_ward') {
      setFormState((current) => ({ ...current, address_ward: nextValue }));
      return;
    }

    setFormState((current) => ({ ...current, [name]: nextValue }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!formState.accept_terms) {
      setErrorMessage('Bạn cần đồng ý với điều khoản và chính sách bảo mật trước khi tạo tài khoản.');
      return;
    }

    setIsSubmitting(true);

    try {
      const phoneDigits = formState.phone.trim();
      const phoneDialCode = formState.phone_country_code.split('|')[1];
      const normalizedPhone = phoneDigits ? `${phoneDialCode}${phoneDigits}`.trim() : undefined;
      const normalizedAddress = composeAddress(formState);

      const response = await fetch(`${API_BASE_URL}/auth/patients/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formState.full_name.trim(),
          email: formState.email.trim(),
          phone: normalizedPhone,
          date_of_birth: formState.date_of_birth || undefined,
          gender: formState.gender,
          address: normalizedAddress || undefined,
          password: formState.password,
          confirm_password: formState.confirm_password,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || 'Đăng ký thất bại.');
      }

      const authData = {
        actorType: 'patient',
        patient: payload?.data?.patient || null,
        tokens: payload?.data?.tokens || null,
      };

      writeStoredAuth(authData);
      setSuccessMessage('Tạo tài khoản thành công. Đang chuyển đến trang chủ...');
      window.setTimeout(() => {
        navigate('/home', { replace: true });
      }, 900);
    } catch (error) {
      setErrorMessage(error.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell register-shell">
      <Link className="page-home-button" to="/home">
        Về trang chủ
      </Link>

      <div className="login-background" aria-hidden="true">
        <div className="background-orb orb-left" />
        <div className="background-orb orb-right" />
        <div className="aurora-band aurora-band--one" />
        <div className="aurora-band aurora-band--two" />
        <div className="aurora-band aurora-band--three" />
        <div className="halo halo-left" />
        <div className="halo halo-right" />
        <div className="pulse-ring pulse-ring--one" />
        <div className="pulse-ring pulse-ring--two" />
        <div className="light-column light-column--one" />
        <div className="light-column light-column--two" />
        <div className="scanner scanner--one" />
        <div className="scanner scanner--two" />
        <div className="background-grid" />
        <div className="particle-cluster">
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="particle"
              style={{
                '--size': `${8 + (index % 4) * 4}px`,
                '--x': `${8 + (index % 6) * 11}%`,
                '--y': `${12 + Math.floor(index / 3) * 11}%`,
                '--delay': `${index * 0.35}s`,
              }}
            />
          ))}
        </div>
        <div className="spark-trail spark-trail--one" />
        <div className="spark-trail spark-trail--two" />
        <div className="micro-stars">
          {Array.from({ length: 14 }).map((_, index) => (
            <span
              key={`register-star-${index}`}
              className="micro-star"
              style={{
                '--star-x': `${4 + (index % 7) * 13}%`,
                '--star-y': `${8 + Math.floor(index / 2) * 11}%`,
                '--star-delay': `${index * 0.45}s`,
              }}
            />
          ))}
        </div>
      </div>

      <section className="hero-panel register-hero">
        <div className="medical-illustration" aria-hidden="true">
          <div className="medical-badge">
            <span className="badge-glow" />
            <span className="badge-backplate" />
            <span className="badge-shell" />
            <span className="badge-clip" />
            <span className="badge-topbar" />
            <span className="badge-shine" />
            <span className="badge-cross badge-cross--vertical" />
            <span className="badge-cross badge-cross--horizontal" />
            <span className="badge-ecg" />
            <span className="badge-chip" />
            <span className="badge-dot badge-dot--one" />
            <span className="badge-dot badge-dot--two" />
            <span className="badge-line badge-line--one" />
            <span className="badge-line badge-line--two" />
            <span className="badge-pulse-ring" />
            <span className="badge-orbit badge-orbit--one" />
            <span className="badge-orbit badge-orbit--two" />
            <span className="badge-orbit badge-orbit--three" />
          </div>
        </div>

        <div className="hero-copy register-copy">
          <p className="eyebrow">Patient Registration</p>
          <h1>
            <span>Tạo tài khoản</span>
            <span>bệnh nhân mới</span>
          </h1>
          <p className="register-subcopy">
            Đăng ký nhanh để quản lý hồ sơ sức khỏe, lịch hẹn và thông tin cá nhân
            trên cùng một cổng truy cập.
          </p>
          <ul className="register-highlights">
            <li>Xác thực thông tin nhanh, giao diện rõ ràng.</li>
            <li>Theo dõi hồ sơ khám và lịch hẹn dễ hơn.</li>
            <li>Bảo mật tài khoản với đăng nhập cá nhân riêng.</li>
          </ul>
        </div>
      </section>

      <section className="login-card register-card" aria-label="Register form">
        <div className="card-highlight" aria-hidden="true" />
        <div className="card-frame" aria-hidden="true" />

        <div className="login-card__content register-card__content">
          <p className="form-kicker">Patient Registration</p>
          <h2>Đăng ký</h2>

          <form className="login-form register-form" onSubmit={handleSubmit}>
            <div className="register-grid">
              <label className="field">
                <span>Họ và tên</span>
                <input
                  type="text"
                  name="full_name"
                  placeholder="Nguyễn Văn A"
                  value={formState.full_name}
                  onChange={handleChange}
                />
              </label>

              <label className="field">
                <span>Số điện thoại</span>
                <div className="phone-field">
                  <CountryCodeSelect value={formState.phone_country_code} onChange={handleChange} />
                  <input
                    type="text"
                    name="phone"
                    placeholder="Số điện thoại"
                    value={formState.phone}
                    onChange={handleChange}
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="benhnhan@gmail.com"
                  value={formState.email}
                  onChange={handleChange}
                />
              </label>

              <label className="field">
                <span>Ngày sinh</span>
                <CustomDatePicker value={formState.date_of_birth} onChange={handleChange} />
              </label>

              <label className="field">
                <span>Giới tính</span>
                <GenderSelect value={formState.gender} onChange={handleChange} />
              </label>

              <label className="field field--full">
                <span>Địa chỉ</span>
                <div className="address-stack">
                  <div className="address-grid">
                    <AddressSelect
                      name="address_city"
                      value={formState.address_city}
                      placeholder="Tỉnh / Thành phố"
                      options={cityOptions.map((city) => city.name)}
                      onChange={handleChange}
                    />
                    <AddressSelect
                      name="address_district"
                      value={formState.address_district}
                      placeholder="Quận / Huyện"
                      options={districtOptions.map((district) => district.name)}
                      onChange={handleChange}
                      disabled={!formState.address_city}
                    />
                    <AddressSelect
                      name="address_ward"
                      value={formState.address_ward}
                      placeholder="Phường / Xã"
                      options={wardOptions}
                      onChange={handleChange}
                      disabled={!formState.address_district}
                    />
                  </div>
                  <input
                    type="text"
                    name="address_line"
                    placeholder="Số nhà, tên đường"
                    value={formState.address_line}
                    onChange={handleChange}
                  />
                </div>
              </label>

              <label className="field">
                <span>Mật khẩu</span>
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Mật khẩu"
                    value={formState.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 102.8 2.8" />
                        <path d="M9.9 5.1A10.9 10.9 0 0112 5c5.2 0 9.3 4.1 10 7-.3 1.3-1.4 3.2-3.2 4.8" />
                        <path d="M6.2 6.3C4.1 7.7 2.7 9.8 2 12c.4 1.7 2.1 4.4 5 6" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              <label className="field">
                <span>Xác nhận mật khẩu</span>
                <div className="password-field">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm_password"
                    placeholder="Xác nhận mật khẩu"
                    value={formState.confirm_password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                    onClick={() => setShowConfirmPassword((value) => !value)}
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 102.8 2.8" />
                        <path d="M9.9 5.1A10.9 10.9 0 0112 5c5.2 0 9.3 4.1 10 7-.3 1.3-1.4 3.2-3.2 4.8" />
                        <path d="M6.2 6.3C4.1 7.7 2.7 9.8 2 12c.4 1.7 2.1 4.4 5 6" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>
            </div>

              {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
              {successMessage ? <p className="form-message success">{successMessage}</p> : null}

              <label className="terms-check">
                <input
                  type="checkbox"
                  name="accept_terms"
                  checked={formState.accept_terms}
                  onChange={handleChange}
                />
                <span>
                  Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của hệ thống.
                </span>
              </label>

              <button type="submit" className="login-button" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              </button>
          </form>

          <div className="login-links">
            <Link to="/login">Đã có tài khoản? Đăng nhập</Link>
            <Link to="/forgot-password">Quên mật khẩu</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
