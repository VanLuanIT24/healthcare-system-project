import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { useAuth } from '../context/AuthContext';

export function PatientRegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    gender: 'unknown',
  });
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ error: '', success: '' });
    try {
      const response = await auth.patientRegister(form);
      setFeedback({ error: '', success: response.message });
      navigate('/tai-khoan');
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  }

  return (
    <AuthCard
      eyebrow="Đăng ký bệnh nhân"
      title="Tạo tài khoản bệnh nhân nhanh, rõ ràng và sẵn sàng cho đặt lịch."
      description="Form này bám theo API backend hiện tại và có thể mở rộng thêm ngày sinh, địa chỉ, BHYT khi nối dữ liệu thật."
      aside={<><h3>Đăng ký tự phục vụ</h3><p>Sau khi đăng ký thành công, bệnh nhân được đăng nhập ngay và có thể tiếp tục đặt lịch hoặc cập nhật thông tin cá nhân.</p></>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Họ và tên</span>
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Email</span>
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Số điện thoại</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Mật khẩu</span>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Giới tính</span>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="unknown">Chưa xác định</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </label>
        <button className="cta-button" type="submit">Đăng ký bệnh nhân</button>
        {feedback.success ? <div className="feedback feedback--success">{feedback.success}</div> : null}
        {feedback.error ? <div className="feedback feedback--error">{feedback.error}</div> : null}
        <div className="auth-links">
          <Link to="/dang-nhap-benh-nhan">Đã có tài khoản? Đăng nhập</Link>
        </div>
      </form>
    </AuthCard>
  );
}
