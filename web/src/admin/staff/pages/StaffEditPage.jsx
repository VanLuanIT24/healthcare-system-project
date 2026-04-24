import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDepartments, getStaffAccountDetail, updateStaffAccount, updateStaffStatus } from '../staffApi';
import { formatDateTime, getInitials } from '../staffUi';

export function StaffEditPage() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [departments, setDepartments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRoles, setCurrentRoles] = useState([]);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department_id: '',
    employee_code: '',
    note: '',
    status: '',
    date_of_birth: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [detailData, departmentsData] = await Promise.all([getStaffAccountDetail(staffId), getDepartments()]);
        if (!active) return;
        const user = detailData?.user;
        setCurrentUser(user);
        setCurrentRoles(detailData?.roles || []);
        setDepartments(departmentsData?.items || []);
        setForm({
          full_name: user?.full_name || '',
          email: user?.email || '',
          phone: user?.phone || '',
          department_id: user?.department_id || '',
          employee_code: user?.employee_code || '',
          note: '',
          status: user?.status || 'active',
          date_of_birth: '',
        });
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [staffId]);

  const returnTo = location.state?.returnTo || `/admin/staff/${staffId}`;
  const selectedDepartment = departments.find((item) => item.department_id === form.department_id);

  const hasChanges = useMemo(() => {
    if (!currentUser) return false;
    return (
      form.full_name !== (currentUser.full_name || '') ||
      form.email !== (currentUser.email || '') ||
      form.phone !== (currentUser.phone || '') ||
      form.department_id !== (currentUser.department_id || '') ||
      form.employee_code !== (currentUser.employee_code || '') ||
      form.status !== (currentUser.status || '')
    );
  }, [currentUser, form]);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await updateStaffAccount(staffId, {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        department_id: form.department_id || null,
        employee_code: form.employee_code,
      });

      if (form.status !== currentUser.status) {
        await updateStaffStatus(staffId, form.status);
      }

      navigate(returnTo, { replace: true, state: { toast: 'Cập nhật nhân sự thành công' } });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentUser) {
    return <section className="staff-loading-panel">{error || 'Đang tải hồ sơ nhân sự...'}</section>;
  }

  return (
    <>
      <section className="staff-edit-shell">
        <div className="staff-edit-shell__main">
          <section className="staff-edit-topbar">
            <div>
              <p className="admin-page-header__eyebrow">Admin / Nhân sự / Chi tiết / Chỉnh sửa</p>
              <h1>Chỉnh sửa hồ sơ nhân sự</h1>
              <p>Cập nhật thông tin quản trị và tổ chức cho {currentUser.full_name || currentUser.username}.</p>
            </div>
          </section>

          <form id="staff-edit-form" className="staff-edit-form" onSubmit={handleSubmit}>
            <article className="staff-edit-section">
              <div className="staff-edit-section__header staff-edit-section__header--violet">
                <span />
                <h2>Thông tin định danh quản trị</h2>
              </div>

              <div className="staff-edit-grid">
                <label className="staff-edit-field">
                  <span>Họ và tên</span>
                  <input name="full_name" value={form.full_name} onChange={handleFieldChange} />
                </label>

                <label className="staff-edit-field">
                  <span>Ngày sinh</span>
                  <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleFieldChange} />
                </label>

                <label className="staff-edit-field staff-edit-field--full">
                  <span>Email công việc</span>
                  <div className="staff-edit-field__locked">
                    <input name="email" type="email" value={form.email} onChange={handleFieldChange} />
                    <small>Đã khóa bởi hệ thống</small>
                  </div>
                  <em>Thông tin định danh chính cần được cập nhật thông qua bộ phận quản trị CNTT.</em>
                </label>

                <label className="staff-edit-field staff-edit-field--full">
                  <span>Số điện thoại liên hệ</span>
                  <input name="phone" value={form.phone} onChange={handleFieldChange} />
                </label>
              </div>
            </article>

            <article className="staff-edit-section">
              <div className="staff-edit-section__header staff-edit-section__header--mint">
                <span />
                <h2>Tổ chức & phân công</h2>
              </div>

              <div className="staff-edit-grid">
                <label className="staff-edit-field">
                  <span>Khoa/Phòng</span>
                  <select name="department_id" value={form.department_id} onChange={handleFieldChange}>
                    <option value="">Chọn khoa/phòng</option>
                    {departments.map((item) => (
                      <option key={item.department_id} value={item.department_id}>
                        {item.department_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="staff-edit-field">
                  <span>Chức danh / mã nhân sự</span>
                  <input name="employee_code" value={form.employee_code} onChange={handleFieldChange} placeholder="Bác sĩ tư vấn cao cấp" />
                </label>
              </div>
            </article>

            <article className="staff-edit-section">
              <div className="staff-edit-section__header staff-edit-section__header--peach">
                <span />
                <h2>Trạng thái tài khoản</h2>
              </div>

              <div className="staff-edit-status-grid">
                {[
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'disabled', label: 'Không hoạt động' },
                  { value: 'suspended', label: 'Tạm đình chỉ' },
                ].map((item) => (
                  <label key={item.value} className={`staff-edit-status-card ${form.status === item.value ? 'is-active' : ''}`}>
                    <input type="radio" name="status" value={item.value} checked={form.status === item.value} onChange={handleFieldChange} />
                    <strong>{item.label}</strong>
                  </label>
                ))}
              </div>
            </article>

            <article className="staff-edit-section">
              <div className="staff-edit-section__header staff-edit-section__header--slate">
                <span />
                <h2>Ghi chú nội bộ</h2>
              </div>

              <label className="staff-edit-field staff-edit-field--full">
                <textarea
                  name="note"
                  rows="5"
                  value={form.note}
                  onChange={handleFieldChange}
                  placeholder="Ghi chú vai trò phụ trách, phân công hành chính hoặc thông tin tổ chức tại đây..."
                />
              </label>
            </article>

            {error ? <p className="form-message error">{error}</p> : null}
          </form>
        </div>

        <aside className="staff-edit-shell__aside">
          <article className="staff-edit-profile-card">
            <div className="staff-edit-profile-card__avatar">{getInitials(currentUser.full_name || currentUser.username)}</div>
            <strong>{currentUser.full_name || currentUser.username}</strong>
            <span>{currentRoles[0]?.role_name || currentRoles[0]?.role_code || 'Bác sĩ tư vấn cao cấp'}</span>

            <div className="staff-edit-profile-card__meta">
              <div>
                <small>Khoa/Phòng</small>
                <strong>{selectedDepartment?.department_name || currentUser.department_name || 'Chưa gán khoa/phòng'}</strong>
              </div>
              <div>
                <small>Cập nhật cuối</small>
                <strong>{formatDateTime(currentUser.updated_at)}</strong>
              </div>
            </div>

            <div className="staff-edit-profile-card__status">
              <span>Trạng thái hồ sơ hệ thống</span>
              <div>
                <strong>Mã NV</strong>
                <small>{currentUser.employee_code || 'AL-8829'}</small>
              </div>
              <div>
                <strong>Thâm niên</strong>
                <small>4,2 năm</small>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <footer className="staff-edit-footer">
        <div />
        <div className="staff-edit-footer__actions">
          <Link to={returnTo} className="staff-button staff-button--ghost">
            Hủy thay đổi
          </Link>
          <button type="submit" form="staff-edit-form" className="staff-button staff-button--primary" disabled={!hasChanges || submitting}>
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </footer>
    </>
  );
}
