import { useState } from 'react';
import { PageHero } from '../components/PageHero';
import { useAuth } from '../context/AuthContext';
import { roleOptions } from '../data/siteContent';

function toggleRole(list, role) {
  return list.includes(role) ? list.filter((item) => item !== role) : [...list, role];
}

export function AdminStaffPage() {
  const auth = useAuth();
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    employee_code: '',
    role_codes: ['doctor'],
    must_change_password: true,
  });
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    role_codes: ['doctor'],
  });
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  async function handleCreate(event) {
    event.preventDefault();
    setFeedback({ error: '', success: '' });
    try {
      const response = await auth.createStaffAccount(createForm);
      setFeedback({ error: '', success: response.message });
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  }

  async function handleAssign(event) {
    event.preventDefault();
    setFeedback({ error: '', success: '' });
    try {
      const response = await auth.assignRoles(assignForm);
      setFeedback({ error: '', success: response.message });
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  }

  return (
    <div>
      <PageHero eyebrow="Quản trị nhân sự" title="Khu vực riêng cho super_admin và admin để tạo tài khoản vai trò khác." description="Tách biệt hoàn toàn khỏi trang login/register để đúng logic vận hành nội bộ." />
      <section className="section">
        <div className="auth-grid">
          <section className="auth-panel">
            <div className="auth-panel__head">
              <h3>Tạo tài khoản nhân sự</h3>
              <p>Phù hợp để tạo bác sĩ, lễ tân, điều dưỡng, dược sĩ và các role tác nghiệp khác.</p>
            </div>
            <form className="auth-form" onSubmit={handleCreate}>
              <label className="form-field"><span>Tên đăng nhập</span><input value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} /></label>
              <label className="form-field"><span>Mật khẩu</span><input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} /></label>
              <label className="form-field"><span>Họ và tên</span><input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} /></label>
              <label className="form-field"><span>Email</span><input value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></label>
              <label className="form-field"><span>Số điện thoại</span><input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /></label>
              <label className="form-field"><span>Mã nhân viên</span><input value={createForm.employee_code} onChange={(e) => setCreateForm({ ...createForm, employee_code: e.target.value })} /></label>
              <div className="role-picker">
                {roleOptions.map((role) => (
                  <button key={role} type="button" className={createForm.role_codes.includes(role) ? 'role-chip role-chip--active' : 'role-chip'} onClick={() => setCreateForm({ ...createForm, role_codes: toggleRole(createForm.role_codes, role) })}>
                    {role}
                  </button>
                ))}
              </div>
              <label className="checkbox-field">
                <input type="checkbox" checked={createForm.must_change_password} onChange={(e) => setCreateForm({ ...createForm, must_change_password: e.target.checked })} />
                <span>Yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên</span>
              </label>
              <button className="cta-button" type="submit">Tạo tài khoản</button>
            </form>
          </section>

          <section className="auth-panel">
            <div className="auth-panel__head">
              <h3>Gán lại vai trò</h3>
              <p>Nhập `user_id` của nhân sự cần cập nhật role và chọn lại tập quyền phù hợp.</p>
            </div>
            <form className="auth-form" onSubmit={handleAssign}>
              <label className="form-field"><span>User ID</span><input value={assignForm.user_id} onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })} /></label>
              <div className="role-picker">
                {roleOptions.map((role) => (
                  <button key={role} type="button" className={assignForm.role_codes.includes(role) ? 'role-chip role-chip--active' : 'role-chip'} onClick={() => setAssignForm({ ...assignForm, role_codes: toggleRole(assignForm.role_codes, role) })}>
                    {role}
                  </button>
                ))}
              </div>
              <button className="cta-button" type="submit">Cập nhật vai trò</button>
            </form>
            <div className="auth-state">
              <p><strong>Tài khoản hiện tại:</strong> {auth.authState.profile?.full_name || auth.authState.profile?.username}</p>
              <p><strong>Vai trò:</strong> {(auth.authState.profile?.roles || []).join(', ')}</p>
            </div>
          </section>
        </div>

        {feedback.success ? <div className="feedback feedback--success">{feedback.success}</div> : null}
        {feedback.error ? <div className="feedback feedback--error">{feedback.error}</div> : null}
      </section>
    </div>
  );
}
