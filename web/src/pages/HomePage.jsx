import { Link } from 'react-router-dom';

const authCards = [
  {
    title: 'Đăng nhập nhân sự',
    description: 'Dành cho super admin, admin, bác sĩ, lễ tân, điều dưỡng và các vai trò nội bộ.',
    to: '/dang-nhap-nhan-su',
  },
  {
    title: 'Đăng nhập bệnh nhân',
    description: 'Truy cập lịch hẹn, hồ sơ cá nhân và thao tác self-service của người bệnh.',
    to: '/dang-nhap-benh-nhan',
  },
  {
    title: 'Đăng ký bệnh nhân mới',
    description: 'Tạo tài khoản bệnh nhân nhanh cho MVP, không cần OTP nhưng vẫn đúng luồng bảo mật.',
    to: '/dang-ky-benh-nhan',
  },
];

export default function HomePage() {
  return (
    <section className="hero-page">
      <div className="hero-copy">
        <span className="eyebrow">Healthcare Authentication Suite</span>
        <h1>Giao diện auth y tế cao cấp, xanh trắng, sạch và bám đúng backend hiện tại.</h1>
        <p>
          Bộ giao diện này nối trực tiếp tới các API auth bạn đang có: login, register, forgot password, reset
          password, me, change password, quản trị staff và audit log.
        </p>

        <div className="hero-actions">
          <Link to="/dang-nhap-nhan-su" className="button primary-button">
            Vào cổng nhân sự
          </Link>
          <Link to="/dang-ky-benh-nhan" className="button secondary-button">
            Đăng ký bệnh nhân
          </Link>
        </div>
      </div>

      <div className="hero-grid">
        {authCards.map((card) => (
          <Link key={card.title} to={card.to} className="glass-card auth-entry-card">
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <span>Xem chức năng</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
