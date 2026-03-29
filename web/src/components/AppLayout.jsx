import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function NavigationLink({ to, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}>
      {children}
    </NavLink>
  );
}

export default function AppLayout() {
  const { profile, isAuthenticated } = useAuth();
  const canManageStaff = profile?.permissions?.includes('auth.staff.read');
  const canReadAuditLogs = profile?.permissions?.includes('auth.audit.read');

  return (
    <div className="app-shell">
      <div className="app-bg app-bg-one" />
      <div className="app-bg app-bg-two" />

      <header className="site-header">
        <Link to="/" className="brand-mark">
          <span className="brand-mark-icon">+</span>
          <span>
            <strong>Healthcare Auth</strong>
            <small>Cổng truy cập hệ thống y tế</small>
          </span>
        </Link>

        <nav className="site-nav">
          <NavigationLink to="/dang-nhap-nhan-su">Nhân sự</NavigationLink>
          <NavigationLink to="/dang-nhap-benh-nhan">Bệnh nhân</NavigationLink>
          <NavigationLink to="/dang-ky-benh-nhan">Đăng ký</NavigationLink>
          {isAuthenticated && <NavigationLink to="/tai-khoan">Tài khoản</NavigationLink>}
          {canManageStaff && <NavigationLink to="/quan-tri/tai-khoan-nhan-su">Quản trị staff</NavigationLink>}
          {canReadAuditLogs && <NavigationLink to="/quan-tri/audit-logs">Audit logs</NavigationLink>}
        </nav>

        <div className="header-user">
          {isAuthenticated ? (
            <>
              <div className="header-user-badge">
                <span>{profile?.full_name}</span>
                <small>{profile?.actor_type === 'staff' ? 'Nhân sự nội bộ' : 'Bệnh nhân'}</small>
              </div>
              <Link to="/dang-xuat" className="button ghost-button">
                Đăng xuất
              </Link>
            </>
          ) : (
            <Link to="/dang-nhap-nhan-su" className="button primary-button">
              Vào hệ thống
            </Link>
          )}
        </div>
      </header>

      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}
