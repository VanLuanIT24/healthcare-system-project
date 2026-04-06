import { useState } from 'react';
import AuthPageFrame from '../components/AuthPageFrame';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { api } from '../lib/api';

export default function ForgotPasswordPage() {
  const [form, setForm] = useState({ actor_type: 'patient', login: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await api.forgotPassword(form);
      setResult(response.data);
      setSuccess(response.message);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Khôi phục truy cập"
      title="Quên mật khẩu"
      description="Luồng reset không OTP cho MVP. Token reset có hạn dùng, chỉ dùng một lần và có thể bị thu hồi."
      side={
        <div className="mini-stat-card">
          <strong>Test nhanh trong local</strong>
          <span>Nếu backend bật `AUTH_EXPOSE_RESET_SECRETS=true`, trang này sẽ hiển thị token và mã reset.</span>
        </div>
      }
    >
      <form className="form-card" onSubmit={handleSubmit}>
        <FormField label="Loại tài khoản" name="actor_type" value={form.actor_type} onChange={handleChange}>
          <select className="field-input" name="actor_type" value={form.actor_type} onChange={handleChange}>
            <option value="patient">Bệnh nhân</option>
            <option value="staff">Nhân sự</option>
          </select>
        </FormField>
        <FormField
          label="Thông tin nhận diện"
          name="login"
          value={form.login}
          onChange={handleChange}
          placeholder="Email, số điện thoại hoặc username"
          required
        />

        <StatusMessage type="error">{error}</StatusMessage>
        <StatusMessage type="success">{success}</StatusMessage>

        {result && (
          <div className="result-panel">
            <div>
              <strong>Hạn dùng:</strong> {result.expires_in_minutes} phút
            </div>
            {result.reset_link && (
              <div className="result-code">
                <span>Reset link</span>
                <code>{result.reset_link}</code>
              </div>
            )}
            {result.reset_token && (
              <div className="result-code">
                <span>Reset token</span>
                <code>{result.reset_token}</code>
              </div>
            )}
            {result.reset_code && (
              <div className="result-code">
                <span>Mã reset</span>
                <code>{result.reset_code}</code>
              </div>
            )}
          </div>
        )}

        <button className="button primary-button wide-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Đang xử lý...' : 'Tạo yêu cầu reset'}
        </button>
      </form>
    </AuthPageFrame>
  );
}
