import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AuthPageFrame from '../components/AuthPageFrame';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginStaff } = useAuth();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await loginStaff(form);
      const nextPath =
        location.state?.from || (result.user.permissions.includes('auth.staff.read') ? '/quan-tri/tai-khoan-nhan-su' : '/tai-khoan');
      navigate(nextPath, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Cổng nội bộ"
      title="Đăng nhập nhân sự"
      description="Đăng nhập bằng username hoặc email. Hệ thống kiểm tra trạng thái tài khoản, session và permission ngay tại backend."
      side={
        <div className="info-stack">
          <div className="mini-stat-card">
            <strong>Đúng luồng nghiệp vụ</strong>
            <span>Staff không tự đăng ký, tài khoản do admin hoặc super_admin cấp.</span>
          </div>
          <div className="mini-stat-card">
            <strong>Bảo mật rõ ràng</strong>
            <span>Khóa tạm khi đăng nhập sai nhiều lần, có refresh token và audit log.</span>
          </div>
        </div>
      }
    >
      <form className="form-card" onSubmit={handleSubmit}>
        <FormField
          label="Tên đăng nhập hoặc email"
          name="login"
          value={form.login}
          onChange={handleChange}
          placeholder="superadmin hoặc admin@hospital.vn"
          required
        />
        <FormField
          label="Mật khẩu"
          name="password"
          value={form.password}
          onChange={handleChange}
          type="password"
          placeholder="Nhập mật khẩu"
          required
        />

        <StatusMessage type="error">{error}</StatusMessage>

        <button className="button primary-button wide-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập nhân sự'}
        </button>

        <div className="form-links">
          <Link to="/quen-mat-khau">Quên mật khẩu</Link>
          <Link to="/dang-nhap-benh-nhan">Tôi là bệnh nhân</Link>
        </div>
      </form>
    </AuthPageFrame>
  );
}
