import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AuthPageFrame from '../components/AuthPageFrame';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';

export default function PatientLoginPage() {
  const navigate = useNavigate();
  const { loginPatient } = useAuth();
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
      await loginPatient(form);
      navigate('/tai-khoan', { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Patient Access"
      title="Đăng nhập bệnh nhân"
      description="Đăng nhập bằng email hoặc số điện thoại để truy cập các chức năng self-service của chính bệnh nhân."
      side={
        <div className="feature-list">
          <div className="feature-item">Chỉ thấy dữ liệu của chính mình.</div>
          <div className="feature-item">Có thể đổi mật khẩu và dùng luồng quên mật khẩu không OTP.</div>
          <div className="feature-item">Luồng phù hợp cho MVP nhưng vẫn đủ sạch về bảo mật.</div>
        </div>
      }
    >
      <form className="form-card" onSubmit={handleSubmit}>
        <FormField
          label="Email hoặc số điện thoại"
          name="login"
          value={form.login}
          onChange={handleChange}
          placeholder="you@example.com hoặc 09xxxxxxxx"
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
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập bệnh nhân'}
        </button>

        <div className="form-links">
          <Link to="/dang-ky-benh-nhan">Chưa có tài khoản?</Link>
          <Link to="/quen-mat-khau">Quên mật khẩu</Link>
        </div>
      </form>
    </AuthPageFrame>
  );
}
