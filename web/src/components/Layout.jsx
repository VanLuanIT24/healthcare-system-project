import { Link, NavLink, Outlet } from 'react-router-dom';
import { navigation } from '../data/siteContent';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { authState, isAuthenticated } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__inner">
          <Link className="brand" to="/">
            <span className="brand__badge">HC</span>
            <div>
              <strong>HealthCare System</strong>
              <small>Đặt lịch khám nhanh, chăm sóc chu đáo</small>
            </div>
          </Link>
          <nav className="nav">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar__actions">
            {isAuthenticated ? (
              <Link className="ghost-button topbar__user" to="/tai-khoan">
                {authState.profile?.full_name || authState.profile?.username || 'Tài khoản'}
              </Link>
            ) : (
              <Link className="ghost-button topbar__user" to="/dang-nhap-nhan-su">
                Đăng nhập
              </Link>
            )}
            <Link className="cta-button" to="/huong-dan-dat-lich">
              Đặt lịch ngay
            </Link>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__grid">
          <div>
            <h3>HealthCare System</h3>
            <p>Website y tế định hướng trải nghiệm bệnh nhân, đặt lịch thuận tiện và theo dõi hành trình khám rõ ràng.</p>
          </div>
          <div>
            <h4>Liên hệ nhanh</h4>
            <p>Hotline: 1900 6868</p>
            <p>Cấp cứu: 115 nội bộ</p>
            <p>Email: support@healthcare.vn</p>
          </div>
          <div>
            <h4>Giờ làm việc</h4>
            <p>Thứ 2 - Thứ 7: 07:00 - 19:00</p>
            <p>Chủ nhật: 07:30 - 12:00</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
