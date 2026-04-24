import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getRoleDetail, listPermissions, syncRolePermissions } from '../roleApi';
import {
  ROLE_PRESETS,
  getPermissionBrief,
  getPermissionDetail,
  getPermissionModuleTitle,
  getPermissionTone,
  getRoleStatusTone,
  groupPermissions,
  prettifyRoleCode,
  roleIcon,
} from '../roleUi';

export function RolePermissionsPage() {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const [roleDetail, setRoleDetail] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [initialPermissions, setInitialPermissions] = useState([]);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [openGroups, setOpenGroups] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [detail, permissionsData] = await Promise.all([getRoleDetail(roleId), listPermissions('limit=500')]);
        if (!active) return;

        const items = permissionsData?.items || [];
        setRoleDetail(detail);
        setAllPermissions(items);
        const initiallyAssigned = (detail?.permissions || []).map((item) => item.permission_code);
        setSelectedPermissions(initiallyAssigned);
        setInitialPermissions(initiallyAssigned);
        setOpenGroups(
          Object.keys(groupPermissions(items)).reduce((accumulator, key) => ({ ...accumulator, [key]: true }), {}),
        );
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [roleId]);

  const groupedPermissions = useMemo(() => {
    const filtered = allPermissions.filter((item) => {
      if (moduleFilter && item.module_key !== moduleFilter) return false;
      if (!permissionSearch) return true;
      const keyword = permissionSearch.toLowerCase();
      return (
        item.permission_code.toLowerCase().includes(keyword) ||
        item.permission_name.toLowerCase().includes(keyword) ||
        getPermissionBrief(item).toLowerCase().includes(keyword)
      );
    });

    return groupPermissions(filtered);
  }, [allPermissions, moduleFilter, permissionSearch]);

  const summary = useMemo(() => {
    const selectedItems = allPermissions.filter((item) => selectedPermissions.includes(item.permission_code));
    const grouped = groupPermissions(selectedItems);
    const sensitiveCount = selectedItems.filter((item) => ['auth', 'role', 'permission'].includes(String(item.module_key || '').toLowerCase())).length;
    const newlyAddedCount = selectedPermissions.filter((code) => !initialPermissions.includes(code)).length;
    const removedCount = initialPermissions.filter((code) => !selectedPermissions.includes(code)).length;

    return {
      selectedCount: selectedItems.length,
      moduleCount: Object.keys(grouped).length,
      heavyModule: Object.entries(grouped).sort((left, right) => right[1].length - left[1].length)[0]?.[0] || '',
      sensitiveCount,
      newlyAddedCount,
      removedCount,
    };
  }, [allPermissions, initialPermissions, selectedPermissions]);

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

  async function savePermissions() {
    setSubmitting(true);
    setError('');
    try {
      await syncRolePermissions(roleId, selectedPermissions);
      const refreshed = await getRoleDetail(roleId);
      const refreshedAssigned = (refreshed?.permissions || []).map((item) => item.permission_code);
      setRoleDetail(refreshed);
      setSelectedPermissions(refreshedAssigned);
      setInitialPermissions(refreshedAssigned);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <section className="staff-loading-panel">Đang tải cấu hình quyền của vai trò...</section>;
  if (!roleDetail?.role) return <section className="staff-loading-panel">{error || 'Không tìm thấy vai trò.'}</section>;

  const role = roleDetail.role;

  return (
    <section className="role-page role-permissions-page">
      <section className="role-hero role-permissions-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">Admin / Vai trò & quyền / Danh sách vai trò / Gán quyền</p>
          <h1>Gán quyền cho vai trò</h1>
          <p>Thiết lập chính xác vai trò này được xem gì, tạo gì, sửa gì và truy cập được module nào trong hệ thống.</p>
        </div>

        <div className="role-hero__actions">
          <Link to={`/admin/roles/${role.role_id}`} className="staff-button staff-button--ghost">
            Quay về chi tiết
          </Link>
          <Link to={`/admin/roles/${role.role_id}/edit`} className="staff-button staff-button--ghost">
            Chỉnh sửa vai trò
          </Link>
          <button type="button" className="staff-button staff-button--primary" onClick={savePermissions} disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Lưu phân quyền'}
          </button>
        </div>
      </section>

      <section className="role-permissions-layout">
        <div className="role-form-stack">
          <article className="admin-panel role-permissions-header-card">
            <div className="role-summary-card__hero">
              <span>{roleIcon(role.role_code)}</span>
              <div>
                <strong>{role.role_name}</strong>
                <code>{role.role_code}</code>
              </div>
            </div>
            <div className="role-permissions-header-card__meta">
              <span className={`admin-status-badge admin-status-badge--${getRoleStatusTone(role.status)}`}>{role.status}</span>
              <small>{role.description || 'Vai trò đang được cấu hình quyền truy cập chuyên sâu.'}</small>
            </div>
          </article>

          <article className="admin-panel role-permissions-panel">
            <div className="role-permissions-toolbar">
              <div>
                <h2>Trung tâm quyền</h2>
                <p>Nhóm theo module để admin dễ rà soát, chọn quyền và tránh cấp sai phạm vi truy cập.</p>
              </div>
              <div className="role-permissions-toolbar__actions">
                <label className="admin-search">
                  <span>⌕</span>
                  <input
                    type="search"
                    placeholder="Tìm quyền"
                    value={permissionSearch}
                    onChange={(event) => setPermissionSearch(event.target.value)}
                  />
                </label>
                <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
                  <option value="">Tất cả module</option>
                  {Object.keys(groupPermissions(allPermissions)).map((moduleKey) => (
                    <option key={moduleKey} value={moduleKey}>
                      {getPermissionModuleTitle(moduleKey)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="role-template-row">
              {Object.keys(ROLE_PRESETS).map((presetKey) => (
                <button key={presetKey} type="button" className="role-template-chip" onClick={() => applyPreset(presetKey)}>
                  Mẫu {prettifyRoleCode(presetKey)}
                </button>
              ))}
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
                        <span>{selectedInModule}/{items.length} quyền đang chọn</span>
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
                          const wasAssigned = initialPermissions.includes(permission.permission_code);
                          const isNewlySelected = isSelected && !wasAssigned;
                          const isRemoved = !isSelected && wasAssigned;
                          return (
                            <label
                              key={permission.permission_id}
                              className={`role-permission-card ${isSelected ? 'role-permission-card--selected' : ''} ${
                                wasAssigned ? 'role-permission-card--existing' : ''
                              } ${isNewlySelected ? 'role-permission-card--new' : ''} ${isRemoved ? 'role-permission-card--removed' : ''}`}
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
                                  {wasAssigned && !isRemoved ? <span className="role-permission-state role-permission-state--existing">Đã cấp</span> : null}
                                  {isNewlySelected ? <span className="role-permission-state role-permission-state--new">Mới chọn</span> : null}
                                  {isRemoved ? <span className="role-permission-state role-permission-state--removed">Sẽ gỡ</span> : null}
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

          {error ? <p className="form-message error">{error}</p> : null}
        </div>

        <aside className="role-summary-stack">
          <article className="role-summary-card admin-panel role-permissions-summary">
            <h3>Tóm tắt phân quyền</h3>
            <div className="role-summary-grid">
              <div>
                <span>Tổng quyền đã chọn</span>
                <strong>{summary.selectedCount}</strong>
              </div>
              <div>
                <span>Số module được cấp</span>
                <strong>{summary.moduleCount}</strong>
              </div>
              <div>
                <span>Module nhiều quyền nhất</span>
                <strong>{summary.heavyModule ? getPermissionModuleTitle(summary.heavyModule) : 'Chưa có'}</strong>
              </div>
              <div>
                <span>Quyền nhạy cảm</span>
                <strong>{summary.sensitiveCount}</strong>
              </div>
              <div>
                <span>Mới chọn chưa lưu</span>
                <strong>{summary.newlyAddedCount}</strong>
              </div>
              <div>
                <span>Sẽ gỡ sau khi lưu</span>
                <strong>{summary.removedCount}</strong>
              </div>
            </div>
          </article>

          <article className="role-summary-card admin-panel">
            <h3>Cảnh báo kiểm soát</h3>
            <ul className="role-alert-list">
              <li>{summary.selectedCount === 0 ? 'Vai trò chưa được cấp quyền nào.' : 'Vai trò đã có quyền nền tảng để vận hành.'}</li>
              <li>{summary.sensitiveCount > 0 ? 'Vai trò đang chứa quyền nhạy cảm liên quan IAM hoặc bảo mật.' : 'Chưa phát hiện quyền nhạy cảm.'}</li>
              <li>{summary.newlyAddedCount > 0 ? 'Các quyền gắn nhãn "Mới chọn" chưa được ghi xuống backend cho tới khi bạn bấm lưu.' : 'Chưa có quyền mới nào đang chờ lưu.'}</li>
              <li>{summary.removedCount > 0 ? 'Các quyền gắn nhãn "Sẽ gỡ" vẫn còn hiệu lực cho tới khi bạn lưu thay đổi.' : 'Không có quyền nào bị loại bỏ tạm thời.'}</li>
              <li>Quyền nên được rà soát theo module thay vì chọn dàn trải để tránh cấp quyền thừa.</li>
            </ul>
          </article>
        </aside>
      </section>
    </section>
  );
}
