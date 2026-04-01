import { useEffect, useState } from 'react';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function AccountPage() {
  const { profile, session, changePassword, refreshProfile } = useAuth();
  const accessToken = session?.accessToken;
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  });
  const [myRoles, setMyRoles] = useState([]);
  const [myPermissions, setMyPermissions] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [permissionCheck, setPermissionCheck] = useState('');
  const [loadingPanels, setLoadingPanels] = useState(false);

  useEffect(() => {
    setProfileForm({
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      address: profile?.address || '',
    });
  }, [profile]);

  useEffect(() => {
    async function loadSelfData() {
      if (!accessToken) return;
      setLoadingPanels(true);
      try {
        const [rolesRes, permissionsRes, sessionsRes, historyRes] = await Promise.all([
          api.getMyRoles(accessToken),
          api.getMyPermissions(accessToken),
          api.getMySessions(accessToken),
          api.getLoginHistory({}, accessToken),
        ]);
        setMyRoles(rolesRes.data.roles || []);
        setMyPermissions(permissionsRes.data.permissions || []);
        setMySessions(sessionsRes.data.items || []);
        setLoginHistory(historyRes.data.items || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingPanels(false);
      }
    }

    loadSelfData();
  }, [accessToken]);

  function handleProfileChange(event) {
    setProfileForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handlePasswordChange(event) {
    setPasswordForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const response = await api.updateMyProfile(profileForm, accessToken);
      await refreshProfile();
      setSuccess(response.message);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const response = await changePassword(passwordForm);
      setSuccess(`${response.message} Vui lòng đăng nhập lại.`);
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleRevokeSession(sessionId) {
    setError('');
    setSuccess('');
    try {
      const response = await api.revokeSession({ session_id: sessionId }, accessToken);
      setSuccess(response.message);
      const sessionsRes = await api.getMySessions(accessToken);
      setMySessions(sessionsRes.data.items || []);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleLogoutAllDevices() {
    setError('');
    setSuccess('');
    try {
      const response = await api.logoutAllDevices(accessToken);
      setSuccess(response.message);
      const sessionsRes = await api.getMySessions(accessToken);
      setMySessions(sessionsRes.data.items || []);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="page-headline">
        <span className="eyebrow">My Account Center</span>
        <h1>Tài khoản, quyền và phiên đăng nhập</h1>
        <p>Trang này gom toàn bộ chức năng self-service có thể đưa lên giao diện: hồ sơ, quyền, sessions, login history và đổi mật khẩu.</p>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{success}</StatusMessage>

      <div className="dashboard-grid three-column-grid">
        <div className="glass-card profile-card">
          <h2>Thông tin hiện tại</h2>
          <div className="profile-grid">
            <div><span>Loại tài khoản</span><strong>{profile?.actor_type}</strong></div>
            <div><span>Họ và tên</span><strong>{profile?.full_name}</strong></div>
            <div><span>Email</span><strong>{profile?.email || 'Chưa có'}</strong></div>
            <div><span>Số điện thoại</span><strong>{profile?.phone || 'Chưa có'}</strong></div>
            <div><span>Trạng thái</span><strong>{profile?.status}</strong></div>
            <div><span>Lần đăng nhập gần nhất</span><strong>{profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString('vi-VN') : 'Chưa có'}</strong></div>
          </div>
        </div>

        <div className="glass-card">
          <h2>Cập nhật hồ sơ</h2>
          <form className="form-card compact-form" onSubmit={handleProfileSubmit}>
            <FormField label="Họ và tên" name="full_name" value={profileForm.full_name} onChange={handleProfileChange} />
            <FormField label="Email" name="email" value={profileForm.email} onChange={handleProfileChange} />
            <FormField label="Số điện thoại" name="phone" value={profileForm.phone} onChange={handleProfileChange} />
            <FormField label="Địa chỉ" name="address" value={profileForm.address} onChange={handleProfileChange} />
            <button className="button primary-button" type="submit">Lưu hồ sơ</button>
          </form>
        </div>

        <div className="glass-card">
          <h2>Đổi mật khẩu</h2>
          <form className="form-card compact-form" onSubmit={handlePasswordSubmit}>
            <FormField label="Mật khẩu hiện tại" name="current_password" type="password" value={passwordForm.current_password} onChange={handlePasswordChange} required />
            <FormField label="Mật khẩu mới" name="new_password" type="password" value={passwordForm.new_password} onChange={handlePasswordChange} required />
            <button className="button primary-button" type="submit">Đổi mật khẩu</button>
          </form>
        </div>

        <div className="glass-card">
          <div className="section-header-inline">
            <h2>Vai trò hiện tại</h2>
            {loadingPanels && <span className="subtle-text">Đang tải...</span>}
          </div>
          <div className="tag-cloud">
            {myRoles.map((role) => (
              <span key={role.role_code} className="tag role-tag">
                {role.role_code}
              </span>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h2>Permission hiện tại</h2>
          <div className="tag-cloud">
            {myPermissions.map((permission) => (
              <span key={permission} className="tag permission-tag">
                {permission}
              </span>
            ))}
          </div>
          <div className="inline-note">Tổng số quyền: {myPermissions.length}</div>
        </div>

        <div className="glass-card">
          <div className="section-header-inline">
            <h2>Phiên đăng nhập</h2>
            <button className="button secondary-button" type="button" onClick={handleLogoutAllDevices}>
              Logout all
            </button>
          </div>
          <div className="audit-list">
            {mySessions.map((sessionItem) => (
              <article key={sessionItem.session_id} className="audit-item">
                <div className="audit-item-head">
                  <strong>{sessionItem.is_active ? 'Đang hoạt động' : 'Không còn hiệu lực'}</strong>
                  <span className={`tag ${sessionItem.is_active ? 'success-tag' : 'danger-tag'}`}>
                    {sessionItem.is_active ? 'active' : 'revoked'}
                  </span>
                </div>
                <p>{sessionItem.user_agent || 'Không có user-agent'}</p>
                <small>{sessionItem.ip_address || 'Không có IP'} | {sessionItem.login_at ? new Date(sessionItem.login_at).toLocaleString('vi-VN') : 'N/A'}</small>
                <button className="button ghost-button small-button" type="button" onClick={() => handleRevokeSession(sessionItem.session_id)}>
                  Thu hồi phiên
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="glass-card span-two-columns">
          <h2>Lịch sử đăng nhập</h2>
          <div className="audit-list">
            {loginHistory.map((item) => (
              <article key={item.audit_log_id} className="audit-item">
                <div className="audit-item-head">
                  <strong>{item.action}</strong>
                  <span className={`tag ${item.status === 'success' ? 'success-tag' : 'danger-tag'}`}>{item.status}</span>
                </div>
                <p>{item.message}</p>
                <small>{item.ip_address || 'Không có IP'} | {new Date(item.created_at).toLocaleString('vi-VN')}</small>
              </article>
            ))}
          </div>
        </div>

        {permissionCheck ? <div className="inline-note">{permissionCheck}</div> : null}
      </div>
    </section>
  );
}
