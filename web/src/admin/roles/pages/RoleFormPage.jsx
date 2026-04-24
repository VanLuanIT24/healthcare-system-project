import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createRole, getRoleDetail, listPermissions, syncRolePermissions, updateRole, updateRoleStatus } from '../roleApi';
import {
  ROLE_PRESETS,
  buildRoleCode,
  getPermissionBrief,
  getPermissionDetail,
  getPermissionModuleTitle,
  getPermissionTone,
  groupPermissions,
  prettifyRoleCode,
  roleIcon,
} from '../roleUi';

function RoleFormPage({ mode }) {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [meta, setMeta] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [openGroups, setOpenGroups] = useState({});
  const [form, setForm] = useState({
    role_name: '',
    role_code: '',
    description: '',
    status: 'active',
    role_type: 'custom',
    note: '',
  });
  const isEdit = mode === 'edit';

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        if (mode === 'create') {
          const permissionsData = await listPermissions('limit=500');
          if (!active) return;
          const permissionItems = permissionsData?.items || [];
          setAllPermissions(permissionItems);
          setOpenGroups(
            Object.keys(groupPermissions(permissionItems)).reduce((accumulator, key) => ({ ...accumulator, [key]: true }), {}),
          );
          return;
        }

        if (!roleId) return;

        const detail = await getRoleDetail(roleId);
        if (!active) return;

        setForm({
          role_name: detail?.role?.role_name || '',
          role_code: detail?.role?.role_code || '',
          description: detail?.role?.description || '',
          status: detail?.role?.status || 'active',
          role_type: detail?.role?.is_system ? 'system' : 'custom',
          note: '',
        });
        setMeta(detail?.role || null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [mode, roleId]);

  const groupedPermissions = useMemo(() => {
    const filtered = allPermissions.filter((item) => {
      if (!permissionSearch) return true;
      const keyword = permissionSearch.toLowerCase();
      return (
        item.permission_code.toLowerCase().includes(keyword) ||
        item.permission_name.toLowerCase().includes(keyword) ||
        getPermissionBrief(item).toLowerCase().includes(keyword)
      );
    });

    return groupPermissions(filtered);
  }, [allPermissions, permissionSearch]);

  const createSummary = useMemo(() => {
    const selectedItems = allPermissions.filter((item) => selectedPermissions.includes(item.permission_code));
    const grouped = groupPermissions(selectedItems);
    const sensitiveCount = selectedItems.filter((item) => ['auth', 'role', 'permission'].includes(String(item.module_key || '').toLowerCase())).length;

    return {
      selectedCount: selectedItems.length,
      moduleCount: Object.keys(grouped).length,
      riskLabel: sensitiveCount > 4 ? 'Cao' : sensitiveCount > 0 ? 'Trung bình' : 'Thấp',
    };
  }, [allPermissions, selectedPermissions]);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'role_name' && mode === 'create' && !current.role_code) {
        next.role_code = buildRoleCode(value);
      }
      return next;
    });
  }

  function handleStatusChange(status) {
    setForm((current) => ({ ...current, status }));
  }

  function handleRoleTypeChange(roleType) {
    setForm((current) => ({ ...current, role_type: roleType }));
  }

  function togglePermission(permissionCode) {
    setSelectedPermissions((current) =>
      current.includes(permissionCode) ? current.filter((item) => item !== permissionCode) : [...current, permissionCode],
    );
  }

  function toggleModule(moduleKey) {
    const items = groupedPermissions[moduleKey] || [];
    const moduleCodes = items.map((item) => item.permission_code);
    const fullySelected = moduleCodes.every((code) => selectedPermissions.includes(code));

    setSelectedPermissions((current) => {
      if (fullySelected) {
        return current.filter((code) => !moduleCodes.includes(code));
      }

      return [...new Set([...current, ...moduleCodes])];
    });
  }

  function applyPreset(presetKey) {
    const codes = ROLE_PRESETS[presetKey] || [];
    setSelectedPermissions((current) => [...new Set([...current, ...codes])]);
  }

  async function saveRole(continueToPermissions = false) {
    if (!form.role_name || !form.role_code) {
      setError('Tên vai trò và mã vai trò là bắt buộc.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let resolvedRoleId = roleId;

      if (mode === 'create') {
        const created = await createRole({
          role_name: form.role_name,
          role_code: form.role_code,
          description: form.description,
          status: form.status,
        });
        resolvedRoleId = created?.role?.role_id;
        if (resolvedRoleId && selectedPermissions.length > 0) {
          await syncRolePermissions(resolvedRoleId, selectedPermissions);
        }
      } else if (roleId) {
        await updateRole(roleId, {
          role_name: form.role_name,
          description: form.description,
        });
        await updateRoleStatus(roleId, form.status);
        resolvedRoleId = roleId;
      }

      if (continueToPermissions && resolvedRoleId) {
        navigate(`/admin/roles/${resolvedRoleId}/permissions`, { replace: true });
        return;
      }

      if (resolvedRoleId) {
        navigate(`/admin/roles/${resolvedRoleId}`, { replace: true });
      } else {
        navigate('/admin/roles', { replace: true });
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="role-page role-form-page">
      <section className="role-hero role-form-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">
            {mode === 'create'
              ? 'Admin / Vai trò & quyền / Tạo vai trò'
              : 'Admin / Vai trò & quyền / Danh sách vai trò / Chỉnh sửa vai trò'}
          </p>
          <h1>{mode === 'create' ? 'Tạo vai trò mới' : 'Chỉnh sửa vai trò'}</h1>
          <p>
            {mode === 'create'
              ? 'Thiết lập vai trò truy cập mới, cấu hình thông tin định danh trước khi chuyển sang bước gán quyền.'
              : 'Cập nhật vai trò: tên, mã, mô tả, trạng thái và lớp cấu hình cơ bản.'}
          </p>
        </div>

        <div className="role-hero__actions">
          <Link to={location.state?.returnTo || (roleId ? `/admin/roles/${roleId}` : '/admin/roles')} className="staff-button staff-button--ghost">
            Hủy
          </Link>
          <button type="button" className="staff-button staff-button--ghost" onClick={() => saveRole(true)} disabled={submitting}>
            {submitting ? 'Đang lưu...' : mode === 'create' ? 'Lưu & gán quyền' : 'Lưu & mở quyền'}
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={() => saveRole(false)} disabled={submitting}>
            {submitting ? 'Đang lưu...' : mode === 'create' ? 'Lưu vai trò' : 'Lưu thay đổi'}
          </button>
        </div>
      </section>

      <section className="role-form-layout">
        <div className="role-form-stack">
          <article className="role-form-card admin-panel role-edit-overview">
            <div className="role-edit-overview__identity">
              <div className="role-edit-overview__icon">{roleIcon(form.role_code)}</div>
              <div>
                <small>{isEdit ? 'Vai trò hiện tại' : 'Vai trò sắp tạo'}</small>
                <strong>{form.role_name || 'Tên vai trò sẽ hiển thị tại đây'}</strong>
                <p>{form.description || 'Vai trò này sẽ được dùng để phân nhóm truy cập và vận hành quyền trong hệ thống y tế.'}</p>
              </div>
            </div>

            <div className="role-edit-overview__meta">
              <div>
                <span>Mã vai trò</span>
                <strong>{form.role_code || 'role_code'}</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <strong>{form.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'}</strong>
              </div>
              <div>
                <span>Loại vai trò</span>
                <strong>{form.role_type === 'system' ? 'Hệ thống' : 'Tùy chỉnh'}</strong>
              </div>
            </div>
          </article>

          <article className="role-form-card admin-panel">
            <div className="staff-edit-section__header staff-edit-section__header--violet">
              <span />
              <h2>{isEdit ? 'Thông tin định danh' : 'Thông tin định danh'}</h2>
            </div>

            <div className="staff-create-grid">
              <label className="staff-field">
                <span>Tên vai trò</span>
                <input name="role_name" value={form.role_name} onChange={handleFieldChange} placeholder="Bác sĩ chuyên khoa" />
              </label>
              <label className="staff-field">
                <span>Mã vai trò</span>
                <input
                  name="role_code"
                  value={form.role_code}
                  onChange={handleFieldChange}
                  placeholder="doctor_core"
                  disabled={mode === 'edit'}
                />
                <small className="staff-field__hint">Mã hiển thị: {prettifyRoleCode(form.role_code || 'role_code')}</small>
              </label>
              <label className="staff-field staff-field--full">
                <span>Mô tả</span>
                <textarea
                  name="description"
                  rows="4"
                  value={form.description}
                  onChange={handleFieldChange}
                  placeholder="Vai trò dành cho bác sĩ thực hiện thăm khám, chẩn đoán và xử lý hồ sơ lâm sàng."
                />
              </label>
            </div>
          </article>

          <article className="role-form-card admin-panel">
            <div className="staff-edit-section__header staff-edit-section__header--mint">
              <span />
              <h2>{isEdit ? 'Cấu hình cơ bản' : 'Mô tả và trạng thái'}</h2>
            </div>

            <div className="staff-create-grid">
              <div className="staff-field">
                <span>Trạng thái vận hành</span>
                <div className="role-edit-choice-grid">
                  <button
                    type="button"
                    className={`role-edit-choice ${form.status === 'active' ? 'is-active' : ''}`}
                    onClick={() => handleStatusChange('active')}
                  >
                    <strong>Đang hoạt động</strong>
                    <small>Vai trò có thể được áp dụng cho tài khoản nội bộ.</small>
                  </button>
                  <button
                    type="button"
                    className={`role-edit-choice ${form.status === 'inactive' ? 'is-active is-muted' : ''}`}
                    onClick={() => handleStatusChange('inactive')}
                  >
                    <strong>Tạm ngưng</strong>
                    <small>Tạm dừng vai trò khỏi luồng gán mới và kiểm soát phát sinh.</small>
                  </button>
                </div>
              </div>

              <div className="staff-field">
                <span>Loại vai trò</span>
                <div className="role-edit-choice-grid role-edit-choice-grid--compact">
                  <button
                    type="button"
                    className={`role-edit-choice ${form.role_type === 'custom' ? 'is-active' : ''}`}
                    onClick={() => handleRoleTypeChange('custom')}
                  >
                    <strong>Tùy chỉnh</strong>
                    <small>Vai trò dành riêng cho cấu hình nội bộ.</small>
                  </button>
                  <button
                    type="button"
                    className={`role-edit-choice ${form.role_type === 'system' ? 'is-active' : ''}`}
                    onClick={() => handleRoleTypeChange('system')}
                  >
                    <strong>Hệ thống</strong>
                    <small>Vai trò nền tảng cần kiểm soát chặt hơn.</small>
                  </button>
                </div>
              </div>

              <label className="staff-field staff-field--full">
                <span>Ghi chú cấu hình</span>
                <textarea
                  name="note"
                  rows="4"
                  value={form.note}
                  onChange={handleFieldChange}
                  placeholder="Ghi chú thêm cho vai trò này, phạm vi sử dụng hoặc cảnh báo dành cho admin nội bộ."
                />
              </label>
            </div>
          </article>

          {!isEdit ? (
            <article className="role-form-card admin-panel role-create-permission-card">
              <div className="role-form-card__top role-form-card__top--stack">
                <div className="staff-edit-section__header staff-edit-section__header--slate">
                  <span />
                  <h2>Cấu hình quyền hạn</h2>
                </div>

                <div className="role-create-permission-card__toolbar">
                  <label className="admin-search role-form-card__search">
                    <span>⌕</span>
                    <input
                      type="search"
                      placeholder="Tìm quyền theo code hoặc mô tả"
                      value={permissionSearch}
                      onChange={(event) => setPermissionSearch(event.target.value)}
                    />
                  </label>

                  <div className="role-template-row">
                    {Object.keys(ROLE_PRESETS).map((presetKey) => (
                      <button key={presetKey} type="button" className="role-template-chip" onClick={() => applyPreset(presetKey)}>
                        Mẫu {prettifyRoleCode(presetKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="role-permission-groups">
                {Object.entries(groupedPermissions).map(([moduleKey, items]) => {
                  const selectedInModule = items.filter((item) => selectedPermissions.includes(item.permission_code)).length;

                  return (
                    <section key={moduleKey} className="role-permission-group role-permission-group--center">
                      <button
                        type="button"
                        className="role-permission-group__head"
                        onClick={() => setOpenGroups((current) => ({ ...current, [moduleKey]: !current[moduleKey] }))}
                      >
                        <div>
                          <strong>{getPermissionModuleTitle(moduleKey)}</strong>
                          <span>{selectedInModule}/{items.length} quyền đã chọn</span>
                        </div>
                        <small>{openGroups[moduleKey] ? '−' : '+'}</small>
                      </button>

                      <div className="role-permission-group__toolbar">
                        <button type="button" className="role-template-chip" onClick={() => toggleModule(moduleKey)}>
                          {items.every((item) => selectedPermissions.includes(item.permission_code)) ? 'Bỏ chọn module' : 'Chọn toàn bộ module'}
                        </button>
                      </div>

                      {openGroups[moduleKey] ? (
                        <div className="role-permission-grid">
                          {items.map((permission) => {
                            const isSelected = selectedPermissions.includes(permission.permission_code);
                            return (
                              <label
                                key={permission.permission_id}
                                className={`role-permission-card ${isSelected ? 'role-permission-card--selected role-permission-card--new' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePermission(permission.permission_code)}
                                />
                                <div>
                                  <strong>{getPermissionBrief(permission)}</strong>
                                  <div className="role-permission-card__meta">
                                    <code className={`role-chip role-chip--${getPermissionTone(permission.module_key)}`}>
                                      {getPermissionModuleTitle(permission.module_key)}
                                    </code>
                                    {isSelected ? <span className="role-permission-state role-permission-state--new">Đã chọn</span> : null}
                                  </div>
                                  <p>{getPermissionDetail(permission)}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </article>
          ) : null}

          {error ? <p className="form-message error">{error}</p> : null}
        </div>

        <aside className="role-summary-stack">
          <article className={`role-summary-card admin-panel role-edit-sidecard ${!isEdit ? 'role-create-preview-card' : ''}`}>
            <div className="role-summary-card__hero">
              <span>{roleIcon(form.role_code)}</span>
              <div>
                <strong>{form.role_name || 'Xem trước vai trò'}</strong>
                <code>{form.role_code || 'role_code'}</code>
              </div>
            </div>

            <div className="role-summary-grid">
              <div>
                <span>Trạng thái</span>
                <strong>{form.status}</strong>
              </div>
              <div>
                <span>Loại vai trò</span>
                <strong>{form.role_type === 'system' ? 'Hệ thống' : 'Tùy chỉnh'}</strong>
              </div>
              <div>
                <span>Ngày tạo</span>
                <strong>{meta?.created_at ? new Date(meta.created_at).toLocaleDateString('vi-VN') : 'Sau khi lưu'}</strong>
              </div>
              <div>
                <span>Bước tiếp theo</span>
                <strong>{isEdit ? 'Gán quyền truy cập' : `${createSummary.selectedCount}/${allPermissions.length || 0} quyền đã chọn`}</strong>
              </div>
            </div>

            {!isEdit ? (
              <div className="role-create-preview-card__risk">
                <div className="role-create-preview-card__riskbar">
                  <span style={{ width: `${Math.min((createSummary.selectedCount / Math.max(allPermissions.length || 1, 1)) * 100, 100)}%` }} />
                </div>
                <small>Mức kiểm soát cấu hình: <strong>{createSummary.riskLabel}</strong> • {createSummary.moduleCount} module được cấp quyền.</small>
              </div>
            ) : null}
          </article>

          <article className="role-summary-card admin-panel role-edit-sidecard role-edit-sidecard--warn">
            <h3>Tác động cấu hình</h3>
            <ul className="role-alert-list">
              <li>Trang này chỉ chỉnh thông tin nhận diện và trạng thái của vai trò.</li>
              <li>Quyền truy cập được quản lý riêng trong màn hình Gán quyền để tránh thao tác nhầm.</li>
              <li>{isEdit ? 'Thay đổi tên hoặc trạng thái vai trò có thể ảnh hưởng trực tiếp tới các tài khoản đang sử dụng vai trò này.' : 'Sau khi lưu vai trò, bạn nên chuyển ngay sang bước gán quyền để vai trò hoạt động đúng mục đích.'}</li>
            </ul>
          </article>

          <article className="role-summary-card admin-panel role-edit-sidecard role-edit-sidecard--action">
            <h3>Bước tiếp theo</h3>
            <p>{isEdit ? 'Sau khi lưu, bạn có thể chuyển sang trung tâm quyền để cập nhật những gì vai trò này được phép làm.' : 'Sau khi tạo xong vai trò, hệ thống sẽ cho bạn chuyển tiếp sang màn hình gán quyền riêng.'}</p>
            <div className="role-edit-sidecard__actions">
              {roleId ? (
                <Link to={`/admin/roles/${roleId}/permissions`} className="staff-button staff-button--ghost">
                  Mở trung tâm quyền
                </Link>
              ) : null}
            </div>
          </article>
        </aside>
      </section>
    </section>
  );
}

export function RoleCreatePage() {
  return <RoleFormPage mode="create" />;
}

export function RoleEditPage() {
  return <RoleFormPage mode="edit" />;
}
