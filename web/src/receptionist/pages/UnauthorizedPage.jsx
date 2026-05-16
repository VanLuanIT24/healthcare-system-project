import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <main className="staff-unauthorized-page">
      <section className="staff-unauthorized-card">
        <span className="staff-unauthorized-card__icon" aria-hidden="true">
          <ShieldAlert size={28} />
        </span>
        <h1>Không có quyền truy cập</h1>
        <p>Tài khoản hiện tại không có dashboard hoặc quyền phù hợp để mở khu vực này.</p>
        <div className="staff-unauthorized-card__actions">
          <Link to="/staff/select-workspace">Chọn workspace khác</Link>
          <Link to="/staff/login">Đăng nhập lại</Link>
        </div>
      </section>
    </main>
  );
}
