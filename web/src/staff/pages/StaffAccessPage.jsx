import { Link, useNavigate } from 'react-router-dom';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';

function hasRole(auth, roleCode) {
  const roles = auth?.user?.roles || [];
  return roles.includes(roleCode);
}

function getInitials(value) {
  return String(value || 'SA')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getRoleLabel(role) {
  const labels = {
    super_admin: 'Quản trị viên cấp cao',
    admin: 'Quản trị viên',
    receptionist: 'Lễ tân',
    doctor: 'Bác sĩ',
    nurse: 'Điều dưỡng',
    pharmacist: 'Dược sĩ',
    lab_technician: 'Kỹ thuật viên xét nghiệm',
  };
  return labels[role] || role;
}

const accessCards = [
  {
    key: 'admin',
    title: 'Bảng quản trị',
    eyebrow: 'Quản trị hệ thống',
    description: 'Quản lý nhân sự, vai trò, quyền, khoa phòng, nhật ký và cấu hình hệ thống.',
    to: '/admin/overview',
    badge: 'Quản trị cấp cao',
    accent: 'indigo',
    roles: ['super_admin'],
  },
  {
    key: 'scheduling',
    title: 'Bảng điều phối lịch khám',
    eyebrow: 'Điều phối lịch khám',
    description: 'Tạo lịch bác sĩ, công khai lịch, xem khung giờ trống, khóa hoặc mở lại khung giờ và xem báo cáo lấp đầy.',
    to: '/scheduling/dashboard',
    badge: 'Vận hành',
    accent: 'teal',
    roles: ['super_admin'],
  },
  {
    key: 'staff',
    title: 'Không gian nhân sự',
    eyebrow: 'Không gian nhân sự',
    description: 'Xem tổng quan cá nhân và truy cập các nghiệp vụ nhân sự phù hợp với vai trò hiện tại.',
    to: '/staff/overview',
    badge: 'Nhân sự',
    accent: 'blue',
    roles: ['super_admin', 'admin', 'receptionist', 'doctor', 'nurse', 'pharmacist', 'lab_technician'],
  },
  {
    key: 'security',
    title: 'Hồ sơ & bảo mật',
    eyebrow: 'Tài khoản của tôi',
    description: 'Cập nhật hồ sơ, đổi mật khẩu, kiểm tra phiên đăng nhập và lịch sử truy cập.',
    to: '/admin/profile',
    badge: 'Tài khoản',
    accent: 'amber',
    roles: ['super_admin'],
  },
];

export function StaffAccessPage() {
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const user = auth?.user;
  const isSuperAdmin = hasRole(auth, 'super_admin');
  const visibleCards = accessCards.filter((card) => card.roles.some((role) => hasRole(auth, role)));

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  return (
    <main className="staff-access-shell">
      <section className="staff-access-hero">
        <div className="staff-access-orb staff-access-orb--one" aria-hidden="true" />
        <div className="staff-access-orb staff-access-orb--two" aria-hidden="true" />

        <div className="staff-access-hero__content">
          <div className="staff-access-kicker">
            <span>Cổng nhân sự y tế</span>
            <strong>{isSuperAdmin ? 'Quyền quản trị cấp cao' : 'Quyền nhân sự'}</strong>
          </div>

          <h1>Chọn khu vực bạn muốn truy cập</h1>
          <p>
            Tài khoản quản trị cấp cao có nhiều khu vực vận hành. Chọn đúng không gian làm việc để
            tránh vào thẳng bảng quản trị khi chỉ cần điều phối lịch hoặc xem thông tin cá nhân.
          </p>

          <div className="staff-access-profile">
            <div className="staff-access-avatar">{getInitials(user?.full_name || user?.username)}</div>
            <div>
              <strong>{user?.full_name || user?.username || 'Quản trị viên'}</strong>
              <span>{(user?.roles || []).map(getRoleLabel).join(' • ') || 'Nhân sự'}</span>
            </div>
          </div>
        </div>

        <button className="staff-access-logout" type="button" onClick={handleLogout}>
          Đăng xuất
        </button>
      </section>

      <section className="staff-access-grid" aria-label="Chọn khu vực truy cập">
        {visibleCards.map((card) => (
          <Link key={card.key} to={card.to} className={`staff-access-card staff-access-card--${card.accent}`}>
            <div className="staff-access-card__top">
              <span>{card.eyebrow}</span>
              <small>{card.badge}</small>
            </div>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <strong>Truy cập ngay</strong>
          </Link>
        ))}
      </section>

      <section className="staff-access-note">
        <strong>Gợi ý phân quyền</strong>
        <p>
          Quản trị viên nên dùng bảng quản trị và bảng điều phối lịch khám. Lễ tân nên vào khu vực
          điều phối hoặc không gian nhân sự để xem lịch và khung giờ. Bác sĩ nên dùng không gian
          nhân sự hoặc lịch cá nhân khi được mở đường dẫn riêng.
        </p>
      </section>
    </main>
  );
}
