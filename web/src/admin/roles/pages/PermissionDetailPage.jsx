import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAuditLogs, getPermissionDetail, getPermissionUsageSummary, getRoleDetail, listPermissions, listRoles } from '../roleApi';
import {
  formatCompactDate,
  formatDateTime,
  formatNumber,
  getPermissionActionTitle,
  getPermissionBrief,
  getPermissionDetail as getPermissionDescription,
  getPermissionModuleTitle,
  getPermissionTone,
  getPermissionUsageLevel,
  permissionIcon,
} from '../roleUi';

export function PermissionDetailPage() {
  const { permissionId } = useParams();
  const [permissionDetail, setPermissionDetail] = useState(null);
  const [usage, setUsage] = useState(null);
  const [relatedPermissions, setRelatedPermissions] = useState([]);
  const [rolesUsing, setRolesUsing] = useState([]);
  const [auditItems, setAuditItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [detail, usageData, permissionsData, rolesData, auditData] = await Promise.all([
          getPermissionDetail(permissionId),
          getPermissionUsageSummary(permissionId),
          listPermissions('limit=200'),
          listRoles('limit=100'),
          getAuditLogs('limit=120'),
        ]);
        if (!active) return;

        const currentPermission = detail?.permission;
        setPermissionDetail(detail);
        setUsage(usageData);
        setRelatedPermissions(
          (permissionsData?.items || [])
            .filter((item) => item.permission_id !== permissionId && item.module_key === currentPermission?.module_key)
            .slice(0, 6),
        );

        const roleItems = rolesData?.items || [];
        const roleDetails = await Promise.all(
          roleItems.map(async (role) => {
            try {
              const roleDetail = await getRoleDetail(role.role_id);
              return roleDetail;
            } catch {
              return null;
            }
          }),
        );
        if (!active) return;

        const matchedRoles = roleDetails
          .filter(Boolean)
          .filter((item) => (item?.permissions || []).some((permission) => permission.permission_id === permissionId))
          .map((item) => item.role);
        setRolesUsing(matchedRoles);
        setAuditItems(
          (auditData?.items || [])
            .filter((item) => item.target_type === 'permission' && String(item.target_id) === String(permissionId))
            .slice(0, 5),
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
  }, [permissionId]);

  const usageLevel = useMemo(() => getPermissionUsageLevel(usage?.roles_count || permissionDetail?.roles_count || 0), [permissionDetail, usage]);

  if (loading) return <section className="staff-loading-panel">Đang tải chi tiết quyền...</section>;
  if (!permissionDetail?.permission) return <section className="staff-loading-panel">{error || 'Không tìm thấy quyền.'}</section>;

  const permission = permissionDetail.permission;

  return (
    <section className="role-page permission-page">
      <section className="role-detail-hero role-detail-hero--premium admin-panel">
        <div className="role-detail-hero__main">
          <p className="admin-page-header__eyebrow">Admin / Vai trò & quyền / Quyền / Chi tiết quyền</p>
          <div className="role-detail-hero__identity">
            <span>{permissionIcon(permission.module_key, permission.action_key)}</span>
            <div>
              <h1>{getPermissionBrief(permission)}</h1>
              <code>{permission.permission_code}</code>
              <div className="role-detail-hero__meta">
                <span className={`role-chip role-chip--${getPermissionTone(permission.module_key)}`}>{getPermissionModuleTitle(permission.module_key)}</span>
                <span className="permission-action-pill">{getPermissionActionTitle(permission.action_key)}</span>
                <small>{permission.is_system ? 'Quyền hệ thống' : 'Quyền tùy chỉnh'}</small>
              </div>
              <p>{permission.description || getPermissionDescription(permission)}</p>
            </div>
          </div>
        </div>

        <div className="role-detail-hero__actions">
          <Link to="/admin/permissions" className="staff-button staff-button--ghost">
            Quay lại danh sách
          </Link>
          <button type="button" className="staff-button staff-button--ghost" onClick={() => navigator.clipboard?.writeText(permission.permission_code)}>
            Sao chép code
          </button>
          <Link to={`/admin/permissions/${permission.permission_id}/edit`} className="staff-button staff-button--primary">
            Chỉnh sửa
          </Link>
        </div>
      </section>

      <section className="role-detail-metrics">
        <article className="role-detail-metric admin-panel">
          <span className="role-detail-metric__icon role-chip role-chip--indigo">⌘</span>
          <div>
            <small>Vai trò đang dùng</small>
            <strong>{formatNumber(usage?.roles_count || permissionDetail.roles_count || 0)}</strong>
          </div>
        </article>
        <article className="role-detail-metric admin-panel">
          <span className="role-detail-metric__icon role-chip role-chip--teal">▣</span>
          <div>
            <small>Module</small>
            <strong>{getPermissionModuleTitle(permission.module_key)}</strong>
          </div>
        </article>
        <article className="role-detail-metric admin-panel">
          <span className="role-detail-metric__icon role-chip role-chip--amber">↗</span>
          <div>
            <small>Mức sử dụng</small>
            <strong>{usageLevel.label}</strong>
          </div>
        </article>
      </section>

      <section className="role-detail-workspace">
        <article className="admin-panel role-detail-content">
          <div className="role-detail-content__head">
            <h2>Thông tin cơ bản</h2>
          </div>

          <div className="role-detail-basic-grid">
            <div>
              <span>Tên quyền</span>
              <strong>{permission.permission_name}</strong>
            </div>
            <div>
              <span>Code</span>
              <strong>{permission.permission_code}</strong>
            </div>
            <div>
              <span>Module</span>
              <strong>{getPermissionModuleTitle(permission.module_key)}</strong>
            </div>
            <div>
              <span>Loại thao tác</span>
              <strong>{getPermissionActionTitle(permission.action_key)}</strong>
            </div>
            <div>
              <span>Loại quyền</span>
              <strong>{permission.is_system ? 'Hệ thống' : 'Tùy chỉnh'}</strong>
            </div>
            <div>
              <span>Ngày tạo</span>
              <strong>{formatCompactDate(permission.created_at)}</strong>
            </div>
            <div className="role-detail-basic-grid__full">
              <span>Mô tả</span>
              <p>{permission.description || getPermissionDescription(permission)}</p>
            </div>
          </div>

          <div className="role-detail-content__head role-detail-content__head--section">
            <h2>Quyền liên quan</h2>
          </div>

          <div className="role-detail-permission-chips">
            {relatedPermissions.map((item) => (
              <Link key={item.permission_id} to={`/admin/permissions/${item.permission_id}`} className={`role-chip role-chip--${getPermissionTone(item.module_key)}`}>
                {getPermissionBrief(item)}
              </Link>
            ))}
          </div>
        </article>

        <aside className="role-detail-side">
          <article className="admin-panel role-detail-side__card">
            <div className="admin-panel__heading">
              <h2>Vai trò đang dùng</h2>
            </div>
            <div className="role-detail-side__staff">
              {rolesUsing.length === 0 ? <p className="permission-side-empty">Quyền này chưa được gán cho vai trò nào.</p> : null}
              {rolesUsing.map((role) => (
                <Link key={role.role_id} to={`/admin/roles/${role.role_id}`} className="role-side-person">
                  <span className="admin-avatar">{String(role.role_name || 'R').slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{role.role_name}</strong>
                    <span>{role.role_code}</span>
                  </div>
                </Link>
              ))}
            </div>
          </article>

          <article className="admin-panel role-detail-side__card">
            <div className="admin-panel__heading">
              <h2>Nhật ký thay đổi</h2>
            </div>
            <div className="role-side-audit">
              {auditItems.length === 0 ? <p className="permission-side-empty">Chưa có nhật ký kiểm toán riêng cho quyền này.</p> : null}
              {auditItems.map((item) => (
                <div key={item._id || item.audit_log_id} className="role-side-audit__item">
                  <span />
                  <div>
                    <strong>{item.message || item.action}</strong>
                    <small>{formatDateTime(item.created_at)} • {item.actor_type}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </section>
  );
}
