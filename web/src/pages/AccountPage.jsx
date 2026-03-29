import { useState } from 'react';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';

export default function AccountPage() {
  const { profile, changePassword } = useAuth();
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    setPasswordForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await changePassword(passwordForm);
      setSuccess(`${response.message} Vui lòng đăng nhập lại.`);
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="page-headline">
        <span className="eyebrow">My Account</span>
        <h1>Tài khoản hiện tại</h1>
        <p>Trang này lấy dữ liệu từ `GET /api/auth/me` và hiển thị chính xác role, permission của actor đang đăng nhập.</p>
      </div>

      <div className="dashboard-grid">
        <div className="glass-card profile-card">
          <h2>Thông tin hồ sơ</h2>
          <div className="profile-grid">
            <div>
              <span>Loại tài khoản</span>
              <strong>{profile?.actor_type}</strong>
            </div>
            <div>
              <span>Họ và tên</span>
              <strong>{profile?.full_name}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profile?.email || 'Chưa có'}</strong>
            </div>
            <div>
              <span>Số điện thoại</span>
              <strong>{profile?.phone || 'Chưa có'}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>{profile?.status}</strong>
            </div>
            <div>
              <span>Lần đăng nhập gần nhất</span>
              <strong>{profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString('vi-VN') : 'Chưa có'}</strong>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h2>Vai trò và quyền</h2>
          <div className="tag-cloud">
            {(profile?.roles || []).map((role) => (
              <span key={role} className="tag role-tag">
                {role}
              </span>
            ))}
          </div>
          <div className="tag-cloud">
            {(profile?.permissions || []).map((permission) => (
              <span key={permission} className="tag permission-tag">
                {permission}
              </span>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h2>Đổi mật khẩu</h2>
          <form className="form-card compact-form" onSubmit={handleSubmit}>
            <FormField
              label="Mật khẩu hiện tại"
              name="current_password"
              type="password"
              value={passwordForm.current_password}
              onChange={handleChange}
              required
            />
            <FormField
              label="Mật khẩu mới"
              name="new_password"
              type="password"
              value={passwordForm.new_password}
              onChange={handleChange}
              required
            />

            <StatusMessage type="error">{error}</StatusMessage>
            <StatusMessage type="success">{success}</StatusMessage>

            <button className="button primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
