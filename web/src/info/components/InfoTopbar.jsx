import { Link, useNavigate } from 'react-router-dom';
import { AppLogo } from '../../app/AppLogo';
import { clearStoredAuth } from '../../lib/storage';

export function InfoTopbar() {
  const navigate = useNavigate();

  function handleLoginBack() {
    clearStoredAuth();
    navigate('/login', { replace: true });
  }

  return (
    <header className="info-topbar">
      <Link className="info-brand" to="/home" aria-label="Bộ Y tế">
        <AppLogo variant="horizontal" />
      </Link>
      <nav className="info-nav">
        <Link to="/support">Hỗ trợ</Link>
        <Link to="/terms">Điều khoản</Link>
        <button type="button" className="info-nav__link" onClick={handleLoginBack}>
          Quay lại đăng nhập
        </button>
        <Link className="info-nav__cta" to="/register">
          Tạo tài khoản mới
        </Link>
      </nav>
    </header>
  );
}
