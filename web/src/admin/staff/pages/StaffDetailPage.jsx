import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  activateStaffAccount,
  checkStaffPermission,
  deactivateStaffAccount,
  forceLogoutStaff,
  getAssignableRoles,
  getStaffAccountDetail,
  getStaffAuditLogs,
  getStaffLoginHistory,
  getStaffPermissions,
  getStaffRoles,
  resetStaffPassword,
  syncStaffRoles,
  unlockStaffAccount,
} from '../staffApi';
import { formatDateTime, getInitials, getStatusTone, groupPermissions } from '../staffUi';
import { ResetPasswordDialog, StaffStatusDialog } from '../components/StaffDialogs';

const TABS = [
  { id: 'general', label: 'Thông tin chung' },
  { id: 'security', label: 'Bảo mật & truy cập' },
  { id: 'clearance', label: 'Phân quyền hệ thống' },
  { id: 'activity', label: 'Nhật ký hoạt động' },
  { id: 'sessions', label: 'Phiên hoạt động' },
];

function getPrimaryRole(roles = []) {
  return roles[0]?.role_name || roles[0]?.role_code || 'Nhân sự lâm sàng';
}

function getAuditTone(action = '', status = 'success') {
  if (status === 'failure') return 'failed';
  if (action.includes('reset_password')) return 'warning';
  if (action.includes('unlock')) return 'success';
  if (action.includes('update_status') || action.includes('deactivate')) return 'danger';
  return 'info';
}

function buildSecurityScore(user, permissions = []) {
  let score = 84;
  if (user?.status === 'active') score += 6;
  if (user?.must_change_password === false) score += 3;
  if ((permissions || []).length > 10) score += 2;
  return Math.min(score, 97);
}

export function StaffDetailPage() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('general');
  const [detail, setDetail] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [roleState, setRoleState] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [permissionCheck, setPermissionCheck] = useState('');
  const [permissionResult, setPermissionResult] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [detailData, rolesData, permissionsData, loginData, auditData, assignableRoles] = await Promise.all([
          getStaffAccountDetail(staffId),
          getStaffRoles(staffId),
          getStaffPermissions(staffId),
          getStaffLoginHistory(staffId),
          getStaffAuditLogs(staffId),
          getAssignableRoles(),
        ]);

        if (!active) return;

        setDetail({
          user: detailData?.user,
          roles: rolesData?.roles || detailData?.roles || [],
          permissions: permissionsData?.permissions || detailData?.permissions || [],
        });
        setRoleState((rolesData?.roles || []).map((item) => item.role_code));
        setLoginHistory(loginData?.items || []);
        setAuditLogs(auditData?.items || []);
        setAvailableRoles(assignableRoles?.items || []);
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

  const groupedPermissions = useMemo(() => groupPermissions(detail?.permissions || []), [detail?.permissions]);
  const user = detail?.user;
  const roles = detail?.roles || [];
  const permissions = detail?.permissions || [];
  const primaryRole = getPrimaryRole(roles);
  const securityScore = buildSecurityScore(user, permissions);
  const recentAudit = auditLogs.slice(0, 3);
  const recentSessions = loginHistory.slice(0, 4);

  useEffect(() => {
    const modal = searchParams.get('modal');
    if (!modal || !user) return;
    if (['reset-password', 'activate', 'deactivate', 'unlock'].includes(modal)) {
      setDialog({ type: modal === 'reset-password' ? 'reset' : modal, staff: user });
    }
  }, [searchParams, user]);

  async function refreshDetail() {
    const [detailData, rolesData, permissionsData, loginData, auditData] = await Promise.all([
      getStaffAccountDetail(staffId),
      getStaffRoles(staffId),
      getStaffPermissions(staffId),
      getStaffLoginHistory(staffId),
      getStaffAuditLogs(staffId),
    ]);

    setDetail({
      user: detailData?.user,
      roles: rolesData?.roles || detailData?.roles || [],
      permissions: permissionsData?.permissions || detailData?.permissions || [],
    });
    setRoleState((rolesData?.roles || []).map((item) => item.role_code));
    setLoginHistory(loginData?.items || []);
    setAuditLogs(auditData?.items || []);
  }

  function openDialog(type) {
    const params = new URLSearchParams(searchParams);
    params.set('modal', type === 'reset' ? 'reset-password' : type);
    setSearchParams(params);
    setDialog({ type, staff: user });
  }

  function closeDialog() {
    const params = new URLSearchParams(searchParams);
    params.delete('modal');
    setSearchParams(params);
    setDialog(null);
  }

  async function handleStatusAction(action) {
    setSubmitting(true);
    setError('');
    try {
      if (action === 'activate') await activateStaffAccount(staffId);
      if (action === 'deactivate') await deactivateStaffAccount(staffId);
      if (action === 'unlock') await unlockStaffAccount(staffId);
      closeDialog();
      await refreshDetail();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(payload) {
    setSubmitting(true);
    setError('');
    try {
      await resetStaffPassword(staffId, payload);
      closeDialog();
      await refreshDetail();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSyncRoles() {
    setSubmitting(true);
    setError('');
    try {
      await syncStaffRoles(staffId, roleState);
      await refreshDetail();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckPermission() {
    if (!permissionCheck.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      setPermissionResult(await checkStaffPermission(staffId, permissionCheck.trim()));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForceLogout() {
    setSubmitting(true);
    setError('');
    try {
      await forceLogoutStaff(staffId);
      await refreshDetail();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleRole(roleCode) {
    setRoleState((current) =>
      current.includes(roleCode) ? current.filter((item) => item !== roleCode) : [...current, roleCode],
    );
  }

  if (!detail) {
    return <section className="staff-loading-panel">{error || 'Đang tải hồ sơ nhân sự...'}</section>;
  }

  return (
    <>
      <section className="staff-detail-page">
        <div className="staff-detail-breadcrumb">
          <Link to="/admin/staff">Nhân sự</Link>
          <span>›</span>
          <span>Hồ sơ nhân sự</span>
          <span>›</span>
          <strong>{user?.full_name || user?.username}</strong>
        </div>

        <section className="staff-detail-hero">
          <div className="staff-detail-hero__media">
            <div className="staff-detail-hero__portrait">{getInitials(user?.full_name || user?.username)}</div>
            <span className="staff-detail-hero__verified">✓</span>
          </div>

          <div className="staff-detail-hero__main">
            <div className="staff-detail-hero__heading">
              <h1>{user?.full_name || user?.username}</h1>
              <span>{primaryRole}</span>
            </div>

            <div className="staff-detail-hero__facts">
              <div>
                <small>Mã nhân sự</small>
                <strong>{user?.employee_code || `LUM-${staffId?.slice?.(0, 6)?.toUpperCase?.() || 'AUTO'}`}</strong>
              </div>
              <div>
                <small>Khoa/Phòng</small>
                <strong>{user?.department_name || 'Chưa gán khoa/phòng'}</strong>
              </div>
              <div>
                <small>Trạng thái hệ thống</small>
                <strong className={`staff-status-dot staff-status-dot--${getStatusTone(user?.status)}`}><span />{user?.status}</strong>
              </div>
              <div>
                <small>Cấp truy cập</small>
                <strong>Cấp 4 (quyền chính)</strong>
              </div>
            </div>
          </div>

          <div className="staff-detail-hero__actions">
            <Link to={`/admin/staff/${staffId}/edit`} state={{ returnTo: `/admin/staff/${staffId}` }} className="staff-button staff-button--primary">
              Chỉnh sửa hồ sơ
            </Link>
            <button type="button" className="staff-button staff-button--ghost" onClick={() => openDialog('reset')}>
              Đặt lại đăng nhập
            </button>
            {user?.status === 'active' ? (
              <button type="button" className="staff-button staff-button--danger" onClick={() => openDialog('deactivate')}>
                Vô hiệu hóa tài khoản
              </button>
            ) : user?.status === 'locked' ? (
              <button type="button" className="staff-button staff-button--ghost" onClick={() => openDialog('unlock')}>
                Mở khóa tài khoản
              </button>
            ) : (
              <button type="button" className="staff-button staff-button--primary" onClick={() => openDialog('activate')}>
                Kích hoạt tài khoản
              </button>
            )}
          </div>
        </section>

        <section className="staff-detail-tabsbar">
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </section>

        {error ? <p className="form-message error">{error}</p> : null}

        {tab === 'general' ? (
          <section className="staff-detail-general-layout">
            <div className="staff-detail-column">
              <article className="staff-detail-surface">
                <div className="staff-detail-surface__header">
                  <h2>Thông tin cá nhân</h2>
                </div>
                <div className="staff-detail-info-grid">
                  {[
                    ['Họ tên pháp lý', user?.full_name || 'Chưa có'],
                    ['Chức danh chuyên môn', primaryRole],
                    ['Địa chỉ email', user?.email || 'Chưa có'],
                    ['Số liên hệ', user?.phone || 'Chưa có'],
                    ['Khoa/Phòng chính', user?.department_name || 'Chưa gán khoa/phòng'],
                    ['Ngày tạo tài khoản', formatDateTime(user?.created_at)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </article>

              <div className="staff-detail-card-grid">
                <article className="staff-detail-surface">
                  <div className="staff-detail-surface__header">
                    <h2>Thông tin chuyên môn</h2>
                  </div>
                  <ul className="staff-detail-bullet-list">
                    <li>{primaryRole}</li>
                    <li>Đăng ký chuyên môn: {user?.status === 'active' ? 'Đang hiệu lực' : 'Bị giới hạn'}</li>
                    <li>Mã giấy phép/chuyên môn: {user?.employee_code || 'Chưa gán'}</li>
                  </ul>
                </article>

                <article className="staff-detail-surface">
                  <div className="staff-detail-surface__header">
                    <h2>Tình trạng bảo mật</h2>
                    <span className="staff-detail-chip">Rất tốt</span>
                  </div>
                  <div className="staff-detail-score-card">
                    <div className="staff-detail-score-card__ring" style={{ '--score': `${securityScore}%` }}>
                      <strong>{securityScore}%</strong>
                    </div>
                    <p>
                      MFA và trạng thái truy cập đang ổn định. Lần cập nhật mật khẩu gần nhất:{' '}
                      {formatDateTime(user?.password_changed_at)}.
                    </p>
                  </div>
                </article>
              </div>
            </div>

            <div className="staff-detail-side-column">
              <article className="staff-detail-surface staff-detail-surface--clearance">
                <div className="staff-detail-surface__cover">
                  <small>Phân quyền hệ thống</small>
                  <strong>Cấp 5 Alpha</strong>
                </div>
                <div className="staff-detail-clearance-list">
                  <div>
                    <span>Truy cập dữ liệu lâm sàng</span>
                    <strong>Không giới hạn</strong>
                    <b style={{ width: '100%' }} />
                  </div>
                  <div>
                    <span>Báo cáo tài chính</span>
                    <strong>Giới hạn</strong>
                    <b style={{ width: '42%' }} />
                  </div>
                  <div>
                    <span>Dữ liệu nhân sự</span>
                    <strong>Toàn quyền ghi</strong>
                    <b style={{ width: '78%' }} />
                  </div>
                </div>
              </article>

              <article className="staff-detail-surface">
                <div className="staff-detail-surface__header">
                  <h2>Hoạt động gần đây</h2>
                  <button type="button" onClick={() => setTab('activity')}>Xem tất cả</button>
                </div>
                <div className="staff-detail-mini-timeline">
                  {recentAudit.map((item, index) => (
                    <div key={`${item._id || item.created_at}-${index}`}>
                      <span className={`staff-detail-mini-timeline__dot staff-detail-mini-timeline__dot--${getAuditTone(item.action, item.status)}`} />
                      <div>
                        <small>{formatDateTime(item.created_at)}</small>
                        <strong>{item.message || item.action}</strong>
                        <p>{item.user_agent || 'Sự kiện nhật ký'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {tab === 'security' ? (
          <section className="staff-detail-security-layout">
            <article className="staff-detail-surface">
              <div className="staff-detail-surface__header">
                <h2>Bảo mật & truy cập</h2>
              </div>
              <div className="staff-security-grid">
                <div><span>Trạng thái tài khoản</span><strong>{user?.status}</strong></div>
                <div><span>Số lần đăng nhập thất bại</span><strong>{user?.failed_login_attempts ?? 0}</strong></div>
                <div><span>Thời điểm đổi mật khẩu</span><strong>{formatDateTime(user?.password_changed_at)}</strong></div>
                <div><span>Lần đăng nhập cuối</span><strong>{formatDateTime(user?.last_login_at)}</strong></div>
                <div><span>IP đăng nhập cuối</span><strong>{user?.last_login_ip || 'Chưa có'}</strong></div>
                <div><span>Khóa đến lúc</span><strong>{formatDateTime(user?.locked_until)}</strong></div>
              </div>
            </article>

            <article className="staff-detail-surface">
              <div className="staff-detail-surface__header">
                <h2>Kiểm tra quyền nhanh</h2>
              </div>
              <div className="staff-detail-checker">
                <label className="staff-field">
                  <span>Mã quyền</span>
                  <input value={permissionCheck} onChange={(event) => setPermissionCheck(event.target.value)} placeholder="auth.staff.read" />
                </label>
                <button type="button" className="staff-button staff-button--primary" onClick={handleCheckPermission} disabled={submitting}>
                  Kiểm tra
                </button>
              </div>
              {permissionResult ? (
                <div className={`staff-permission-check staff-permission-check--${permissionResult.allowed ? 'allow' : 'deny'}`}>
                  <strong>{permissionResult.allowed ? 'Được cấp quyền' : 'Không có quyền'}</strong>
                  <span>{permissionResult.permission_code}</span>
                </div>
              ) : null}
            </article>
          </section>
        ) : null}

        {tab === 'clearance' ? (
          <section className="staff-detail-clearance-layout">
            <article className="staff-detail-surface">
              <div className="staff-detail-surface__header">
                <h2>Vai trò đã gán</h2>
                <button type="button" onClick={handleSyncRoles} disabled={submitting}>Đồng bộ vai trò</button>
              </div>
              <div className="staff-role-grid">
                {availableRoles.map((role) => (
                  <label key={role.role_code} className={`staff-role-editor__item ${roleState.includes(role.role_code) ? 'is-active' : ''}`}>
                    <input type="checkbox" checked={roleState.includes(role.role_code)} onChange={() => toggleRole(role.role_code)} />
                    <div>
                      <strong>{role.role_name}</strong>
                      <span>{role.description || role.role_code}</span>
                    </div>
                    <small>{role.role_code}</small>
                  </label>
                ))}
              </div>
            </article>

            <article className="staff-detail-surface">
              <div className="staff-detail-surface__header">
                <h2>Nhóm quyền</h2>
              </div>
              <div className="staff-permission-groups">
                {Object.entries(groupedPermissions).map(([moduleKey, codes]) => (
                  <div key={moduleKey} className="staff-permission-group">
                    <div className="staff-permission-group__head">
                      <h3>{moduleKey.toUpperCase()}</h3>
                      <span>{codes.length} quyền</span>
                    </div>
                    <div className="staff-role-badges">
                      {codes.map((code) => (
                        <span key={code}>{code}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {tab === 'activity' ? (
          <article className="staff-detail-surface">
            <div className="staff-detail-surface__header">
              <h2>Nhật ký hoạt động</h2>
            </div>
            <div className="staff-audit-timeline">
              {auditLogs.map((item, index) => (
                <div key={`${item._id || item.created_at}-${index}`} className="staff-audit-timeline__item">
                  <div className={`staff-audit-timeline__icon staff-audit-timeline__icon--${getAuditTone(item.action, item.status)}`}>
                    {item.status === 'failure' ? '!' : '+'}
                  </div>
                  <div className="staff-audit-timeline__content">
                    <strong>{item.message || item.action}</strong>
                    <p>{item.action}</p>
                    <div className="staff-audit-timeline__meta">
                      <span>{formatDateTime(item.created_at)}</span>
                      <span>Người thao tác: {item.actor_type || 'system'}</span>
                      <span>Đối tượng: {item.target_type || 'user'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        {tab === 'sessions' ? (
          <article className="staff-detail-surface staff-detail-surface--sessions">
            <div className="staff-detail-surface__header">
              <div>
                <h2>Phiên thiết bị đang hoạt động</h2>
                <p>Theo dõi thời gian thực các điểm truy cập còn hiệu lực.</p>
              </div>
              <button type="button" className="staff-button staff-button--danger" onClick={handleForceLogout} disabled={submitting}>
                Đăng xuất tất cả phiên
              </button>
            </div>
            <div className="staff-session-list staff-session-list--large">
              {recentSessions.map((item, index) => (
                <div key={`${item._id || item.created_at}-${index}`} className="staff-session-card staff-session-card--large">
                  <div className={`staff-session-card__icon staff-session-card__icon--${item.status === 'failure' ? 'failed' : 'active'}`}>
                    {item.status === 'failure' ? '!' : '◉'}
                  </div>
                  <div className="staff-session-card__content">
                    <strong>{item.user_agent || 'Máy trạm lâm sàng'}</strong>
                    <div className="staff-session-card__meta">
                      <span>{item.ip_address || 'Không rõ IP'}</span>
                      <span>{formatDateTime(item.created_at)}</span>
                      <span>{index === 0 ? 'Phiên hiện tại' : 'Phiên trước đó'}</span>
                    </div>
                  </div>
                  <span className="staff-soft-badge">{index === 0 ? 'Đang hoạt động' : 'Gần đây'}</span>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </section>

      {dialog?.type === 'reset' ? (
        <ResetPasswordDialog staff={dialog.staff} onClose={closeDialog} onSubmit={handleResetPassword} isSubmitting={submitting} />
      ) : null}

      {['activate', 'deactivate', 'unlock'].includes(dialog?.type) ? (
        <StaffStatusDialog
          action={dialog.type}
          staff={dialog.staff}
          onClose={closeDialog}
          onConfirm={() => handleStatusAction(dialog.type)}
          isSubmitting={submitting}
        />
      ) : null}
    </>
  );
}
