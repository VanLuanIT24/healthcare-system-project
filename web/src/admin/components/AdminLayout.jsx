import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';

const PRIMARY_ITEMS = [
  { label: 'Tổng quan', icon: '◫', to: '/admin/overview', match: ['/admin/overview'] },
  { label: 'Nhân sự', icon: '◉', to: '/admin/staff', match: ['/admin/staff'] },
  { label: 'Vai trò & quyền', icon: '⌘', to: '/admin/roles', match: ['/admin/roles', '/admin/permissions'] },
  { label: 'Khoa/Phòng', icon: '▣', to: '/admin/departments', match: ['/admin/departments'] },
  { label: 'Nhật ký', icon: '☰', to: '/admin/logs/login-history', match: ['/admin/logs'] },
  { label: 'Hồ sơ', icon: '◎', to: '/admin/profile', match: ['/admin/profile'] },
  { label: 'Bảo mật', icon: '◌', to: '/admin/security/change-password', match: ['/admin/security'] },
  { label: 'Cấu hình', icon: '⚙', to: '/admin/settings', match: ['/admin/settings'] },
];

const STAFF_CHILDREN = [
  { label: 'Danh sách nhân sự', to: '/admin/staff' },
  { label: 'Tạo nhân sự', to: '/admin/staff/create' },
];

const ROLE_CHILDREN = [
  { label: 'Danh sách vai trò', to: '/admin/roles' },
  { label: 'Tạo vai trò', to: '/admin/roles/create' },
  { label: 'Danh sách quyền', to: '/admin/permissions' },
  { label: 'Tạo quyền', to: '/admin/permissions/create' },
];

const DEPARTMENT_CHILDREN = [
  { label: 'Danh sách khoa/phòng', to: '/admin/departments' },
  { label: 'Tạo khoa/phòng', to: '/admin/departments/create' },
];

const LOG_CHILDREN = [
  { label: 'Lịch sử đăng nhập', to: '/admin/logs/login-history' },
  { label: 'Nhật ký hệ thống', to: '/admin/logs/audit' },
];

const SECURITY_CHILDREN = [
  { label: 'Đổi mật khẩu', to: '/admin/security/change-password' },
  { label: 'Phiên đăng nhập của tôi', to: '/admin/security/sessions' },
];

const FOOTER_ITEMS = [{ label: 'Hỗ trợ', icon: '?' }];

function getInitials(name) {
  return String(name || 'SA')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('');
}

function getTopbarSection(pathname) {
  if (pathname.startsWith('/admin/staff')) {
    if (pathname.endsWith('/create')) return 'Tạo nhân sự';
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa nhân sự';
    if (/\/admin\/staff\/[^/]+$/.test(pathname)) return 'Chi tiết nhân sự';
    return 'Quản lý nhân sự';
  }

  if (pathname.startsWith('/admin/roles')) {
    if (pathname.endsWith('/create')) return 'Tạo vai trò';
    if (pathname.endsWith('/permissions')) return 'Gán quyền';
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa vai trò';
    if (/\/admin\/roles\/[^/]+$/.test(pathname)) return 'Chi tiết vai trò';
    return 'Quản lý vai trò';
  }

  if (pathname.startsWith('/admin/permissions')) {
    if (pathname.endsWith('/create')) return 'Tạo quyền';
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa quyền';
    if (/\/admin\/permissions\/[^/]+$/.test(pathname)) return 'Chi tiết quyền';
    return 'Quản lý quyền';
  }

  if (pathname.startsWith('/admin/departments')) {
    if (pathname.endsWith('/create')) return 'Tạo khoa/phòng';
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa khoa/phòng';
    if (/\/admin\/departments\/[^/]+$/.test(pathname)) return 'Chi tiết khoa/phòng';
    return 'Quản lý khoa/phòng';
  }

  if (pathname.startsWith('/admin/logs/login-history')) return 'Lịch sử đăng nhập';
  if (pathname.startsWith('/admin/logs/audit')) return 'Nhật ký hệ thống';
  if (pathname.startsWith('/admin/profile')) return 'Hồ sơ của tôi';
  if (pathname.startsWith('/admin/security/change-password')) return 'Đổi mật khẩu';
  if (pathname.startsWith('/admin/security/sessions')) return 'Phiên đăng nhập của tôi';
  if (pathname.startsWith('/admin/settings')) return 'Cấu hình hệ thống';

  return 'Tổng quan';
}

function isMatched(pathname, candidates) {
  return candidates.some((candidate) => pathname.startsWith(candidate));
}

function getChildActive(pathname, childTo) {
  return pathname === childTo;
}

function renderChildren(pathname, itemLabel) {
  let items = [];
  if (itemLabel === 'Nhân sự' && pathname.startsWith('/admin/staff')) items = STAFF_CHILDREN;
  if (itemLabel === 'Vai trò & quyền' && (pathname.startsWith('/admin/roles') || pathname.startsWith('/admin/permissions'))) items = ROLE_CHILDREN;
  if (itemLabel === 'Khoa/Phòng' && pathname.startsWith('/admin/departments')) items = DEPARTMENT_CHILDREN;
  if (itemLabel === 'Nhật ký' && pathname.startsWith('/admin/logs')) items = LOG_CHILDREN;
  if (itemLabel === 'Bảo mật' && pathname.startsWith('/admin/security')) items = SECURITY_CHILDREN;

  if (items.length === 0) return null;

  return (
    <div className="admin-sidebar__subnav">
      {items.map((child) => (
        <NavLink key={child.to} to={child.to} end className={getChildActive(pathname, child.to) ? 'is-active' : ''}>
          {child.label}
        </NavLink>
      ))}
    </div>
  );
}

export function AdminLayout() {
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth?.user;

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  return (
    <main className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__main">
          <div className="admin-sidebar__brand">
            <strong>Aura Health</strong>
            <span>Clinical Curator</span>
          </div>

          <nav className="admin-sidebar__nav" aria-label="Admin navigation">
            {PRIMARY_ITEMS.map((item) => (
              <div key={item.label} className="admin-sidebar__group">
                <NavLink to={item.to} className={isMatched(location.pathname, item.match) ? 'is-active' : ''}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
                {renderChildren(location.pathname, item.label)}
              </div>
            ))}
          </nav>
        </div>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__support">
            {FOOTER_ITEMS.map((item) => (
              <button key={item.label} type="button" className="admin-sidebar__placeholder" disabled>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="admin-sidebar__status">Trạng thái hệ thống: Đang hoạt động</div>
        </div>
      </aside>

      <section className="admin-stage">
        <header className="admin-header">
          <label className="admin-search" htmlFor="admin-global-search">
            <span>⌕</span>
            <input id="admin-global-search" type="search" placeholder="Tìm kiếm hệ thống..." />
          </label>

          <div className="admin-header__meta">
            <div className="admin-header__tabs">
              <span>Admin</span>
              <strong>{getTopbarSection(location.pathname)}</strong>
            </div>

            <div className="admin-header__actions">
              <button type="button" aria-label="Thông báo">•</button>
              <button type="button" aria-label="Hỗ trợ">?</button>
            </div>

            <div className="admin-header__profile">
              <div>
                <strong>{user?.full_name || user?.username || 'Quản trị hệ thống'}</strong>
                <span>QUẢN TRỊ VIÊN</span>
              </div>
              <div className="admin-header__avatar">{getInitials(user?.full_name || user?.username)}</div>
            </div>

            <button type="button" className="admin-header__logout" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </header>

        <Outlet />
      </section>
    </main>
  );
}
