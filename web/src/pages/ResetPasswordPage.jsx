import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthPageFrame from '../components/AuthPageFrame';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { api } from '../lib/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    reset_token: '',
    reset_code: '',
    new_password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setForm((current) => ({ ...current, reset_token: token }));
    }
  }, [searchParams]);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await api.resetPassword(form);
      setSuccess(response.message);
      setForm((current) => ({ ...current, reset_code: '', new_password: '' }));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Password Recovery"
      title="Đặt lại mật khẩu"
      description="Nhập token reset, mã reset và mật khẩu mới. Sau khi thành công, các phiên cũ sẽ bị thu hồi."
    >
      <form className="form-card" onSubmit={handleSubmit}>
        <FormField
          label="Reset token"
          name="reset_token"
          value={form.reset_token}
          onChange={handleChange}
          placeholder="Token reset"
          required
        />
        <FormField
          label="Mã reset"
          name="reset_code"
          value={form.reset_code}
          onChange={handleChange}
          placeholder="Mã 6 chữ số"
          required
        />
        <FormField
          label="Mật khẩu mới"
          name="new_password"
          type="password"
          value={form.new_password}
          onChange={handleChange}
          placeholder="Nhập mật khẩu mạnh"
          required
        />

        <StatusMessage type="error">{error}</StatusMessage>
        <StatusMessage type="success">{success}</StatusMessage>

        <button className="button primary-button wide-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
        </button>
      </form>
    </AuthPageFrame>
  );
}
