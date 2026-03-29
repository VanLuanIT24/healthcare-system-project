import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AuthPageFrame from '../components/AuthPageFrame';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';

const initialForm = {
  full_name: '',
  phone: '',
  email: '',
  password: '',
  confirm_password: '',
  date_of_birth: '',
  gender: 'unknown',
  address: '',
};

export default function PatientRegisterPage() {
  const navigate = useNavigate();
  const { registerPatient } = useAuth();
  const [form, setForm] = useState(initialForm);
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
      await registerPatient(form);
      navigate('/tai-khoan', { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Đăng ký bệnh nhân"
      title="Tạo tài khoản bệnh nhân mới"
      description="Một luồng đăng ký tối ưu cho MVP: form rõ ràng, ít bước, vẫn tuân thủ password policy từ backend."
      side={
        <div className="feature-list">
          <div className="feature-item">Bắt buộc ít nhất email hoặc số điện thoại.</div>
          <div className="feature-item">Tự động tạo luôn hồ sơ bệnh nhân gốc và account đăng nhập.</div>
          <div className="feature-item">Không dùng OTP nhưng kiến trúc vẫn sạch để nâng cấp sau.</div>
        </div>
      }
    >
      <form className="form-card form-grid" onSubmit={handleSubmit}>
        <FormField label="Họ và tên" name="full_name" value={form.full_name} onChange={handleChange} required />
        <FormField label="Số điện thoại" name="phone" value={form.phone} onChange={handleChange} placeholder="09xxxxxxxx" />
        <FormField label="Email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
        <FormField label="Ngày sinh" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} type="date" />
        <FormField label="Giới tính" name="gender" value={form.gender} onChange={handleChange}>
          <select className="field-input" name="gender" value={form.gender} onChange={handleChange}>
            <option value="unknown">Chưa xác định</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </FormField>
        <FormField label="Địa chỉ" name="address" value={form.address} onChange={handleChange} />
        <FormField label="Mật khẩu" name="password" value={form.password} onChange={handleChange} type="password" required />
        <FormField
          label="Xác nhận mật khẩu"
          name="confirm_password"
          value={form.confirm_password}
          onChange={handleChange}
          type="password"
          required
        />

        <StatusMessage type="error">{error}</StatusMessage>

        <button className="button primary-button wide-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký ngay'}
        </button>

        <div className="form-links">
          <Link to="/dang-nhap-benh-nhan">Đã có tài khoản?</Link>
          <Link to="/dang-nhap-nhan-su">Tôi là nhân sự</Link>
        </div>
      </form>
    </AuthPageFrame>
  );
}
