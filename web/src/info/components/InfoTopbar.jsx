import { Link } from 'react-router-dom';
export function InfoTopbar() {
  return (
    <header className="info-topbar">
      <Link className="info-brand" to="/home">
        Healthcare
      </Link>
      <nav className="info-nav">
        <Link to="/support">Ho tro</Link>
        <Link to="/terms">Dieu khoan</Link>
        <Link to="/login">Quay lai dang nhap</Link>
        <Link className="info-nav__cta" to="/register">
          Tao tai khoan moi
        </Link>
      </nav>
    </header>
  );
}
