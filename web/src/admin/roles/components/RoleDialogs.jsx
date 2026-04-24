import { Link } from 'react-router-dom';
import { getPermissionBrief, getPermissionTone, getRoleStatusTone, roleIcon } from '../roleUi';

function RoleDialogShell({ title, subtitle, tone = 'neutral', onClose, children, footer }) {
  return (
    <div className="staff-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className={`staff-dialog role-dialog role-dialog--${tone}`} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="staff-dialog__header">
          <div className="staff-dialog__title">
            <span className="staff-dialog__badge">{tone === 'warning' ? '!' : tone === 'success' ? '✓' : '◉'}</span>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="staff-dialog__close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="staff-dialog__body">{children}</div>
        <footer className="staff-dialog__footer">{footer}</footer>
      </div>
    </div>
  );
}

export function RoleQuickPreviewDialog({ role, permissions = [], onClose }) {
  if (!role) return null;

  const visiblePermissions = permissions.slice(0, 5);
  const hiddenCount = Math.max(permissions.length - visiblePermissions.length, 0);

  return (
    <RoleDialogShell
      title={role.role_name}
      subtitle="Xem nhanh vai trò trước khi đi vào trang chi tiết."
      tone="neutral"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="staff-button staff-button--ghost" onClick={onClose}>
            Đóng
          </button>
          <Link className="staff-button staff-button--primary" to={`/admin/roles/${role.role_id}`}>
            Đi đến chi tiết
          </Link>
        </>
      }
    >
      <section className="role-preview-shell">
        <div className="role-preview-hero">
          <div className="role-preview-hero__icon">{roleIcon(role.role_code)}</div>
          <div className="role-preview-hero__content">
            <strong>{role.role_name}</strong>
            <p>{role.description || 'Vai trò cốt lõi cho phân quyền truy cập lâm sàng.'}</p>
          </div>
        </div>

        <div className="role-preview-stats role-preview-stats--premium">
          <div>
            <span>Số quyền hạn</span>
            <strong>{role.permissions_count || permissions.length}</strong>
          </div>
          <div>
            <span>Nhân sự đang dùng</span>
            <strong>{role.users_count || 0}</strong>
          </div>
        </div>

        <div className="role-preview-permission-block">
          <div className="role-preview-permission-block__title">
            <strong>Danh sách quyền hạn</strong>
          </div>

          <div className="role-preview-permissions role-preview-permissions--premium">
            {visiblePermissions.map((permission) => (
              <span key={permission.permission_code} className={`role-chip role-chip--${getPermissionTone(permission.module_key)}`}>
                {getPermissionBrief(permission)}
              </span>
            ))}
            {hiddenCount > 0 ? <span className="role-chip role-chip--slate">+{hiddenCount} quyền khác</span> : null}
          </div>
        </div>
      </section>
    </RoleDialogShell>
  );
}

export function RoleStatusDialog({ role, action, onClose, onConfirm, isSubmitting }) {
  if (!role || !action) return null;

  const isActivate = action === 'activate';
  const title = isActivate ? 'Kích hoạt vai trò' : 'Vô hiệu hóa vai trò';
  const subtitle = isActivate
    ? 'Vai trò này sẽ có thể được dùng lại để phân quyền trong hệ thống.'
    : 'Vai trò bị vô hiệu hóa sẽ không thể tiếp tục được gán cho người dùng mới.';

  return (
    <RoleDialogShell
      title={title}
      subtitle={subtitle}
      tone={isActivate ? 'success' : 'warning'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="staff-button staff-button--ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Đang xử lý...' : isActivate ? 'Xác nhận kích hoạt' : 'Xác nhận vô hiệu hóa'}
          </button>
        </>
      }
    >
      <div className={`role-preview-card ${isActivate ? 'role-preview-card--activate' : ''}`}>
        <div className="role-preview-card__icon">{roleIcon(role.role_code)}</div>
        <div className="role-preview-card__content">
          <strong>{role.role_name}</strong>
          <code>{role.role_code}</code>
          <p>{role.description || 'Vai trò truy cập nội bộ của hệ thống.'}</p>
        </div>
        <span className={`admin-status-badge admin-status-badge--${getRoleStatusTone(role.status)}`}>{role.status}</span>
      </div>

      <div className={`staff-dialog__notice ${isActivate ? 'staff-dialog__notice--info' : 'staff-dialog__notice--warning'}`}>
        <strong>{isActivate ? 'Thông tin' : 'Thông báo'}</strong>
        <p>
          {isActivate
            ? 'Hành động này sẽ ghi nhận vào nhật ký hệ thống. Sau khi kích hoạt, vai trò có thể được dùng để gán quyền ngay lập tức.'
            : 'Hành động này sẽ được ghi vào nhật ký kiểm toán và ảnh hưởng đến khả năng sử dụng vai trò trong các cấu hình mới.'}
        </p>
      </div>
    </RoleDialogShell>
  );
}
