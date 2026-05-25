import { Link } from 'react-router-dom';
import { AppLogo } from '../../app/AppLogo';

export function InfoTopbar() {
  return (
    <header className="info-topbar">
      <Link className="info-brand" to="/home" aria-label="Bộ Y tế">
        <AppLogo variant="horizontal" />
      </Link>
      <nav className="info-nav">
        <Link to="/support">Hỗ trợ</Link>
        <Link to="/terms">Điều khoản</Link>
        <Link to="/login">Quay lại đăng nhập</Link>
        <Link className="info-nav__cta" to="/register">
          Tạo tài khoản mới
        </Link>
      </nav>
    </header>
  );
}
