import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { useAuth } from '../context/AuthContext';

export function StaffLoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ error: '', success: '' });
    try {
      const response = await auth.staffLogin(form);
      setFeedback({ error: '', success: response.message });
      navigate('/tai-khoan');
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  }

  return (
    <AuthCard
      eyebrow="Nhân sự"
      title="Đăng nhập cho super_admin, admin và các vai trò nghiệp vụ."
      description="Dùng tài khoản nhân sự để quản trị hệ thống, tạo tài khoản vai trò khác và truy cập khu vực tác nghiệp nội bộ."
      aside={<><h3>Điểm vào dành cho nội bộ</h3><p>Trang này dành cho quản trị viên, bác sĩ, lễ tân, điều dưỡng, dược sĩ và các vai trò được cấp quyền.</p></>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Tên đăng nhập</span>
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Mật khẩu</span>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="cta-button" type="submit">Đăng nhập nhân sự</button>
        {feedback.success ? <div className="feedback feedback--success">{feedback.success}</div> : null}
        {feedback.error ? <div className="feedback feedback--error">{feedback.error}</div> : null}
        <div className="auth-links">
          <Link to="/tai-khoan">Vào trang tài khoản</Link>
          <Link to="/dang-nhap-benh-nhan">Đăng nhập bệnh nhân</Link>
        </div>
      </form>
    </AuthCard>
  );
}
