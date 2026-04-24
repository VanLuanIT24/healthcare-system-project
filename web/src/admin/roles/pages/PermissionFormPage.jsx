import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createPermission, getPermissionDetail, updatePermission } from '../roleApi';
import {
  buildPermissionCode,
  getPermissionActionTitle,
  getPermissionBrief,
  getPermissionModuleTitle,
  permissionIcon,
  PERMISSION_ACTION_OPTIONS,
  PERMISSION_MODULE_OPTIONS,
} from '../roleUi';

function PermissionFormPage({ mode }) {
  const { permissionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    permission_name: '',
    permission_code: '',
    module_key: 'staff',
    action_key: 'read',
    description: '',
    is_system: false,
  });

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (mode !== 'edit' || !permissionId) return;
      try {
        const detail = await getPermissionDetail(permissionId);
        if (!active) return;
        setForm({
          permission_name: detail?.permission?.permission_name || '',
          permission_code: detail?.permission?.permission_code || '',
          module_key: detail?.permission?.module_key || 'staff',
          action_key: detail?.permission?.action_key || 'read',
          description: detail?.permission?.description || '',
          is_system: Boolean(detail?.permission?.is_system),
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
  }, [mode, permissionId]);

  const generatedCode = useMemo(() => buildPermissionCode(form.module_key, form.action_key), [form.action_key, form.module_key]);

  function handleFieldChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : value };
      if ((name === 'module_key' || name === 'action_key') && mode === 'create' && !current.permission_code) {
        next.permission_code = buildPermissionCode(name === 'module_key' ? value : current.module_key, name === 'action_key' ? value : current.action_key);
      }
      return next;
    });
  }

  async function savePermission(andContinue = false) {
    if (!form.permission_name || !form.permission_code || !form.module_key) {
      setError('Tên quyền, code và module là bắt buộc.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      let resolvedId = permissionId;

      if (mode === 'create') {
        const created = await createPermission({
          permission_name: form.permission_name,
          permission_code: form.permission_code,
          module_key: form.module_key,
          action_key: form.action_key,
          description: form.description,
          is_system: form.is_system,
        });
        resolvedId = created?.permission?.permission_id;
      } else if (permissionId) {
        await updatePermission(permissionId, {
          permission_name: form.permission_name,
          module_key: form.module_key,
          action_key: form.action_key,
          description: form.description,
        });
        resolvedId = permissionId;
      }

      if (andContinue) {
        navigate('/admin/permissions/create', { replace: true });
        return;
      }

      navigate(resolvedId ? `/admin/permissions/${resolvedId}` : '/admin/permissions', { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="role-page permission-page">
      <section className="role-hero role-form-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">
            {mode === 'create' ? 'Admin / Vai trò & quyền / Quyền / Tạo quyền' : 'Admin / Vai trò & quyền / Quyền / Chỉnh sửa quyền'}
          </p>
          <h1>{mode === 'create' ? 'Tạo quyền' : 'Chỉnh sửa quyền'}</h1>
          <p>Khai báo một quyền mới để mở rộng hệ thống phân quyền nội bộ hoặc cập nhật định nghĩa quyền hiện có.</p>
        </div>

        <div className="role-hero__actions">
          <Link to={location.state?.returnTo || '/admin/permissions'} className="staff-button staff-button--ghost">
            Quay lại danh sách
          </Link>
          <button type="button" className="staff-button staff-button--ghost" onClick={() => savePermission(true)} disabled={submitting}>
            {submitting ? 'Đang lưu...' : mode === 'create' ? 'Lưu & tạo tiếp' : 'Lưu nhanh'}
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={() => savePermission(false)} disabled={submitting}>
            {submitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo quyền' : 'Lưu thay đổi'}
          </button>
        </div>
      </section>

      <section className="role-form-layout">
        <div className="role-form-stack">
          <article className="role-form-card admin-panel permission-form-card">
            <div className="staff-edit-section__header staff-edit-section__header--violet">
              <span />
              <h2>Thông tin quyền</h2>
            </div>

            <div className="staff-create-grid">
              <label className="staff-field">
                <span>Tên quyền</span>
                <input name="permission_name" value={form.permission_name} onChange={handleFieldChange} placeholder="Tạo nhân sự" />
              </label>
              <label className="staff-field">
                <span>Code</span>
                <input name="permission_code" value={form.permission_code} onChange={handleFieldChange} placeholder="staff.create" disabled={mode === 'edit'} />
                <small className="staff-field__hint">Gợi ý theo module.action: {generatedCode || 'staff.read'}</small>
              </label>
              <label className="staff-field">
                <span>Module</span>
                <select name="module_key" value={form.module_key} onChange={handleFieldChange}>
                  {PERMISSION_MODULE_OPTIONS.map((moduleKey) => (
                    <option key={moduleKey} value={moduleKey}>
                      {getPermissionModuleTitle(moduleKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="staff-field">
                <span>Loại thao tác</span>
                <select name="action_key" value={form.action_key} onChange={handleFieldChange}>
                  {PERMISSION_ACTION_OPTIONS.map((actionKey) => (
                    <option key={actionKey} value={actionKey}>
                      {getPermissionActionTitle(actionKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="staff-field staff-field--full">
                <span>Mô tả</span>
                <textarea
                  name="description"
                  rows="5"
                  value={form.description}
                  onChange={handleFieldChange}
                  placeholder="Giải thích rõ permission này được dùng để làm gì và sẽ cấp quyền thao tác nào trong hệ thống."
                />
              </label>
              <label className="staff-field staff-checkbox">
                <input name="is_system" type="checkbox" checked={form.is_system} onChange={handleFieldChange} />
                <span>Đánh dấu là quyền hệ thống</span>
              </label>
            </div>

            {error ? <p className="form-message error">{error}</p> : null}
          </article>
        </div>

        <aside className="role-summary-stack">
          <article className="role-summary-card admin-panel permission-preview-card">
            <div className="role-summary-card__hero">
              <span>{permissionIcon(form.module_key, form.action_key)}</span>
              <div>
                <strong>{getPermissionBrief(form)}</strong>
                <code>{form.permission_code || generatedCode || 'module.action'}</code>
              </div>
            </div>

            <div className="role-summary-grid">
              <div>
                <span>Module</span>
                <strong>{getPermissionModuleTitle(form.module_key)}</strong>
              </div>
              <div>
                <span>Loại thao tác</span>
                <strong>{getPermissionActionTitle(form.action_key)}</strong>
              </div>
              <div>
                <span>Quyền hệ thống</span>
                <strong>{form.is_system ? 'Có' : 'Không'}</strong>
              </div>
              <div>
                <span>Code tự sinh</span>
                <strong>{generatedCode || 'N/A'}</strong>
              </div>
            </div>

            <div className="permission-preview-card__codebox">
              <span>XEM TRƯỚC CODE</span>
              <code>{`permission: "${form.permission_code || generatedCode || 'staff.read'}"`}</code>
              <p>Chuỗi code này sẽ là định danh duy nhất của quyền trong hệ thống.</p>
            </div>
          </article>

          <article className="role-summary-card admin-panel permission-guideline-card">
            <h3>Quy tắc đặt quyền</h3>
            <ul className="role-alert-list">
              <li>Dùng format `module.action` để đồng bộ toàn hệ thống.</li>
              <li>Nên đặt mô tả rõ mục tiêu nghiệp vụ của quyền.</li>
              <li>Tránh tạo quyền trùng nghĩa với quyền đã tồn tại.</li>
            </ul>
          </article>

          <article className="role-summary-card admin-panel permission-warning-card">
            <h3>Cảnh báo bảo mật</h3>
            <p>
              Các quyền dạng ghi dữ liệu, cập nhật trạng thái hoặc thao tác trên IAM cần được rà soát kỹ trước khi phát hành vào môi trường vận hành.
            </p>
          </article>
        </aside>
      </section>
    </section>
  );
}

export function PermissionCreatePage() {
  return <PermissionFormPage mode="create" />;
}

export function PermissionEditPage() {
  return <PermissionFormPage mode="edit" />;
}
