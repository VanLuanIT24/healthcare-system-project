import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero';

export function UnauthorizedPage() {
  return (
    <div>
      <PageHero eyebrow="Không có quyền" title="Tài khoản hiện tại không được phép truy cập khu vực này." description="Trang này dùng khi người dùng đã đăng nhập nhưng không đủ role để vào trang quản trị." />
      <section className="section">
        <div className="auth-panel">
          <p>Hãy quay lại trang tài khoản hoặc đăng nhập bằng tài khoản có quyền phù hợp.</p>
          <div className="hero-actions">
            <Link className="ghost-button" to="/tai-khoan">Về trang tài khoản</Link>
            <Link className="cta-button" to="/dang-nhap-nhan-su">Đăng nhập lại</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
