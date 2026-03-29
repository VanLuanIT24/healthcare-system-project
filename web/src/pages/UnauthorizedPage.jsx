import { Link } from 'react-router-dom';

export default function UnauthorizedPage() {
  return (
    <section className="center-panel">
      <div className="glass-card narrow-card">
        <span className="eyebrow">403 Access Control</span>
        <h1>Bạn không có quyền truy cập</h1>
        <p>Tài khoản hiện tại không có permission phù hợp để dùng chức năng này.</p>
        <div className="hero-actions">
          <Link to="/tai-khoan" className="button primary-button">
            Về trang tài khoản
          </Link>
          <Link to="/" className="button secondary-button">
            Về trang chính
          </Link>
        </div>
      </div>
    </section>
  );
}
