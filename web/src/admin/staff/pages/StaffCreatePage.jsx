import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createStaffAccount, getAssignableRoles, getDepartments } from '../staffApi';
import { StaffSuccessDialog } from '../components/StaffDialogs';

const INITIAL_FORM = {
  full_name: '',
  email: '',
  phone: '',
  username: '',
  gender: '',
  date_of_birth: '',
  department_id: '',
  employee_code: '',
  role_codes: [],
  status: 'active',
  password: '',
  confirm_password: '',
  send_activation_email: false,
  must_change_password: true,
  activate_now: true,
  note: '',
};

export function StaffCreatePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState(INITIAL_FORM);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadMeta() {
      try {
        const [rolesData, departmentsData] = await Promise.all([getAssignableRoles(), getDepartments()]);
        if (!active) return;

        const roleItems = rolesData?.items || [];
        const departmentItems = departmentsData?.items || [];
        setRoles(roleItems);
        setDepartments(departmentItems);

        const roleQuery = searchParams.get('role');
        const departmentQuery = searchParams.get('department');

        setForm((current) => ({
          ...current,
          role_codes:
            roleQuery && roleItems.some((item) => item.role_code === roleQuery) ? [roleQuery] : current.role_codes,
          department_id:
            departmentQuery && departmentItems.some((item) => item.department_id === departmentQuery)
              ? departmentQuery
              : current.department_id,
        }));
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      }
    }

    loadMeta();
    return () => {
      active = false;
    };
  }, [searchParams]);

  const selectedRoleLabels = useMemo(
    () => roles.filter((item) => form.role_codes.includes(item.role_code)).map((item) => item.role_name),
    [form.role_codes, roles],
  );

  const selectedDepartment = departments.find((item) => item.department_id === form.department_id);
  const previewStatus = form.activate_now ? 'Đang hoạt động' : form.status === 'suspended' ? 'Đang tiếp nhận' : form.status;

  function handleFieldChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function toggleRole(roleCode) {
    setForm((current) => ({
      ...current,
      role_codes: current.role_codes.includes(roleCode)
        ? current.role_codes.filter((item) => item !== roleCode)
        : [...current.role_codes, roleCode],
    }));
  }

  function clearPrefill() {
    searchParams.delete('role');
    searchParams.delete('department');
    setSearchParams(searchParams);
  }

  async function submitForm(event, keepCreating = false) {
    event.preventDefault();
    setError('');

    if (!form.full_name || !form.email || !form.phone || !form.username || form.role_codes.length === 0) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc và chọn ít nhất một role.');
      return;
    }

    if (form.password && form.password !== form.confirm_password) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        username: form.username,
        department_id: form.department_id || undefined,
        employee_code: form.employee_code || undefined,
        role_codes: form.role_codes,
        password: form.password || undefined,
        must_change_password: form.must_change_password,
      };

      const result = await createStaffAccount(payload);
      const createdUser = result?.user;
      const temporaryPassword = result?.initial_password || form.password || 'Mật khẩu đã được tạo';

      if (keepCreating) {
        setSuccess({
          userId: createdUser?.user_id,
          title: 'Tạo tài khoản thành công',
      summary: [
        { label: 'Tên nhân sự', value: createdUser?.full_name || payload.full_name },
        { label: 'Email đăng nhập', value: createdUser?.email || payload.email },
        { label: 'Vai trò ban đầu', value: selectedRoleLabels.join(', ') || form.role_codes.join(', ') },
        { label: 'Mật khẩu tạm thời', value: temporaryPassword },
          ],
        });
        setForm((current) => ({
          ...INITIAL_FORM,
          role_codes: current.role_codes,
          department_id: current.department_id,
        }));
      } else {
        navigate(`/admin/staff/${createdUser?.user_id || ''}`, { replace: true });
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="staff-create-shell">
        <div className="staff-create-shell__main">
          <section className="staff-create-topbar">
            <div>
              <p className="admin-page-header__eyebrow">Admin / Nhân sự / Tạo nhân sự</p>
              <h1>Tạo tài khoản nhân sự</h1>
              <p>Tạo tài khoản nhân sự nội bộ, gán vai trò ban đầu và chuẩn bị tiếp nhận an toàn.</p>
            </div>
            <div className="admin-page-header__actions">
              <Link to="/admin/staff" className="staff-button staff-button--ghost">
                Hủy
              </Link>
              {(searchParams.get('role') || searchParams.get('department')) ? (
                <button type="button" className="staff-button staff-button--ghost" onClick={clearPrefill}>
                  Bỏ dữ liệu gợi ý
                </button>
              ) : null}
            </div>
          </section>

          <form id="staff-create-form" className="staff-create-form" onSubmit={(event) => submitForm(event, false)}>
            <article className="staff-create-section">
              <div className="staff-create-section__header staff-create-section__header--blue">
                <span />
                <h2>Thông tin cơ bản</h2>
              </div>
              <div className="staff-create-grid">
                <label className="staff-create-field">
                  <span>Họ và tên</span>
                  <input name="full_name" value={form.full_name} onChange={handleFieldChange} placeholder="Ví dụ: BS. Nguyễn Minh An" />
                </label>
                <label className="staff-create-field">
                  <span>Địa chỉ email</span>
                  <input name="email" type="email" value={form.email} onChange={handleFieldChange} placeholder="nguyen.an@auralumina.vn" />
                </label>
                <label className="staff-create-field">
                  <span>Số điện thoại</span>
                  <input name="phone" value={form.phone} onChange={handleFieldChange} placeholder="+84 9xx xxx xxx" />
                </label>
                <label className="staff-create-field">
                  <span>Tên đăng nhập</span>
                  <input name="username" value={form.username} onChange={handleFieldChange} placeholder="nguyenan_admin" />
                </label>
                <label className="staff-create-field">
                  <span>Giới tính</span>
                  <select name="gender" value={form.gender} onChange={handleFieldChange}>
                    <option value="">Chọn giới tính</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
                <label className="staff-create-field">
                  <span>Ngày sinh</span>
                  <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleFieldChange} />
                </label>
              </div>
            </article>

            <article className="staff-create-section">
              <div className="staff-create-section__header staff-create-section__header--green">
                <span />
                <h2>Tổ chức & vai trò</h2>
              </div>
              <div className="staff-create-grid">
                <label className="staff-create-field">
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
                <label className="staff-create-field">
                  <span>Mã nhân viên / chức danh</span>
                  <input name="employee_code" value={form.employee_code} onChange={handleFieldChange} placeholder="BSCC / EMP-001" />
                </label>
              </div>

              <div className="staff-create-role-picker">
                <div className="staff-create-role-picker__column">
                  <span>Vai trò ban đầu</span>
                  <div className="staff-create-role-picker__grid">
                    {roles.map((item) => (
                      <button
                        key={item.role_code}
                        type="button"
                        className={form.role_codes.includes(item.role_code) ? 'is-active' : ''}
                        onClick={() => toggleRole(item.role_code)}
                      >
                        <strong>{item.role_name}</strong>
                        <small>{item.description || item.role_code}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="staff-create-role-picker__column">
                  <span>Trạng thái ban đầu</span>
                  <div className="staff-create-status-pills">
                    <label className={form.status === 'suspended' ? 'is-active' : ''}>
                      <input type="radio" name="status" value="suspended" checked={form.status === 'suspended'} onChange={handleFieldChange} />
                      <span>Đang tiếp nhận</span>
                    </label>
                    <label className={form.status === 'active' ? 'is-active' : ''}>
                      <input type="radio" name="status" value="active" checked={form.status === 'active'} onChange={handleFieldChange} />
                      <span>Đang hoạt động</span>
                    </label>
                    <label className={form.status === 'disabled' ? 'is-active' : ''}>
                      <input type="radio" name="status" value="disabled" checked={form.status === 'disabled'} onChange={handleFieldChange} />
                      <span>Không hoạt động</span>
                    </label>
                  </div>
                </div>
              </div>
            </article>

            <article className="staff-create-section">
              <div className="staff-create-section__header staff-create-section__header--orange">
                <span />
                <h2>Bảo mật tài khoản</h2>
              </div>
              <div className="staff-create-grid">
                <label className="staff-create-field">
                  <span>Mật khẩu tạm thời</span>
                  <input name="password" type="password" value={form.password} onChange={handleFieldChange} placeholder="Để trống để tự tạo" />
                </label>
                <label className="staff-create-field">
                  <span>Xác nhận mật khẩu</span>
                  <input name="confirm_password" type="password" value={form.confirm_password} onChange={handleFieldChange} placeholder="Nhập lại mật khẩu" />
                </label>
              </div>

              <div className="staff-create-toggle-grid">
                <label className={`staff-create-toggle ${form.send_activation_email ? 'is-on' : ''}`}>
                  <div>
                    <strong>Gửi email</strong>
                    <span>Gửi liên kết kích hoạt tài khoản qua email.</span>
                  </div>
                  <input name="send_activation_email" type="checkbox" checked={form.send_activation_email} onChange={handleFieldChange} />
                </label>

                <label className={`staff-create-toggle ${form.must_change_password ? 'is-on' : ''}`}>
                  <div>
                    <strong>Bắt buộc đổi</strong>
                    <span>Người dùng phải đổi mật khẩu khi đăng nhập.</span>
                  </div>
                  <input name="must_change_password" type="checkbox" checked={form.must_change_password} onChange={handleFieldChange} />
                </label>

                <label className={`staff-create-toggle ${form.activate_now ? 'is-on' : ''}`}>
                  <div>
                    <strong>Kích hoạt ngay</strong>
                    <span>Tài khoản có thể sử dụng ngay sau khi tạo.</span>
                  </div>
                  <input name="activate_now" type="checkbox" checked={form.activate_now} onChange={handleFieldChange} />
                </label>
              </div>
            </article>

            <article className="staff-create-section">
              <div className="staff-create-section__header staff-create-section__header--slate">
                <span />
                <h2>Ghi chú nội bộ</h2>
              </div>
              <label className="staff-create-field staff-create-field--full">
                <textarea
                  name="note"
                  rows="5"
                  value={form.note}
                  onChange={handleFieldChange}
                  placeholder="Nhập ghi chú bảo mật về tài khoản hoặc quá trình tiếp nhận nhân sự..."
                />
              </label>
            </article>

            {error ? <p className="form-message error">{error}</p> : null}
          </form>
        </div>

        <aside className="staff-create-shell__aside">
          <article className="staff-create-preview">
            <div className="staff-create-preview__cover" />
            <div className="staff-create-preview__avatar">◉</div>
            <div className="staff-create-preview__body">
              <strong>{form.full_name || 'Nhân sự mới'}</strong>
              <span>{form.email || 'Đang chờ thông tin...'}</span>
              <div className="staff-create-preview__badges">
                <span>{selectedRoleLabels[0] || 'Chưa gán'}</span>
                <span>{previewStatus}</span>
              </div>
              <div className="staff-create-preview__meta">
                <div>
                  <small>Khoa/Phòng</small>
                  <strong>{selectedDepartment?.department_name || '—'}</strong>
                </div>
                <div>
                  <small>Mã NV</small>
                  <strong>{form.employee_code || 'LUM-AUTO-002'}</strong>
                </div>
              </div>
            </div>
          </article>

          <article className="staff-create-guidelines">
            <h3>Hướng dẫn nhanh</h3>
            <ul>
              <li>Ưu tiên dùng email nội bộ của bệnh viện để tăng bảo mật.</li>
              <li>Mật khẩu nên có ít nhất 12 ký tự, chữ hoa và ký tự đặc biệt.</li>
              <li>Chọn đúng vai trò để cấu hình quyền truy cập ban đầu.</li>
              <li>Trạng thái tiếp nhận phù hợp khi tài khoản chưa nên truy cập đầy đủ.</li>
            </ul>
          </article>
        </aside>
      </section>

      <footer className="staff-create-footer">
        <span>Thông tin sẽ được lưu khi bạn xác nhận tạo tài khoản</span>
        <div className="staff-create-footer__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={(event) => submitForm(event, true)} disabled={submitting}>
            Lưu nháp
          </button>
          <button type="submit" form="staff-create-form" className="staff-button staff-button--primary" disabled={submitting}>
            {submitting ? 'Đang tạo...' : 'Tạo nhân sự'}
          </button>
        </div>
      </footer>

      {success ? (
        <StaffSuccessDialog
          title={success.title}
          summary={success.summary}
          onClose={() => setSuccess(null)}
          actions={
            <>
              <Link to={`/admin/staff/${success.userId}`} className="staff-button staff-button--ghost">
                Đi đến chi tiết nhân sự
              </Link>
              <button
                type="button"
                className="staff-button staff-button--primary"
                onClick={() => {
                  setSuccess(null);
                  navigate('/admin/staff/create', { replace: true });
                }}
              >
                Tạo nhân sự mới
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
