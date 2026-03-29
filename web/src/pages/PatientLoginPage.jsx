import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { useAuth } from '../context/AuthContext';

export function PatientLoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({ login: '', password: '' });
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ error: '', success: '' });
    try {
      const response = await auth.patientLogin(form);
      setFeedback({ error: '', success: response.message });
      navigate('/tai-khoan');
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  }

  return (
    <AuthCard
      eyebrow="Bệnh nhân"
      title="Đăng nhập bệnh nhân để theo dõi lịch khám và hồ sơ cá nhân."
      description="Hỗ trợ email, số điện thoại hoặc username của tài khoản bệnh nhân."
      aside={<><h3>Dành cho bệnh nhân</h3><p>Sau khi đăng nhập, bệnh nhân có thể kiểm tra hồ sơ, làm mới phiên đăng nhập và đổi mật khẩu.</p></>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Email / số điện thoại / username</span>
          <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Mật khẩu</span>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="cta-button" type="submit">Đăng nhập bệnh nhân</button>
        {feedback.success ? <div className="feedback feedback--success">{feedback.success}</div> : null}
        {feedback.error ? <div className="feedback feedback--error">{feedback.error}</div> : null}
        <div className="auth-links">
          <Link to="/dang-ky-benh-nhan">Chưa có tài khoản? Đăng ký ngay</Link>
          <Link to="/dang-nhap-nhan-su">Đăng nhập nhân sự</Link>
        </div>
      </form>
    </AuthCard>
  );
}
