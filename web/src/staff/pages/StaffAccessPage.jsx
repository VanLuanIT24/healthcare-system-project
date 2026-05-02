import {
  Activity,
  ArrowRight,
  Beaker,
  Boxes,
  CalendarDays,
  ChevronRight,
  FlaskConical,
  Gamepad2,
  Gauge,
  Grid3X3,
  HeartHandshake,
  KeyRound,
  Layers3,
  Link as LinkIcon,
  LockKeyhole,
  LogOut,
  Microscope,
  Pill,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  User,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';

function hasRole(auth, roleCode) {
  const roles = auth?.user?.roles || [];
  return Array.isArray(roles) && roles.includes(roleCode);
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
    super_admin: 'System Super Admin',
    admin: 'Quản trị viên',
    receptionist: 'Lễ tân',
    doctor: 'Bác sĩ',
    nurse: 'Điều dưỡng',
    pharmacist: 'Dược sĩ',
    lab_technician: 'Kỹ thuật viên xét nghiệm',
  };

  return labels[role] || role;
}

const accessTabs = [
  { label: 'Tất cả khu vực', icon: Grid3X3 },
  { label: 'Dashboard chính', icon: Gauge },
  { label: 'Module nghiệp vụ', icon: Layers3 },
  { label: 'Cấu hình hệ thống', icon: Settings },
  { label: 'Màn hình thử nghiệm', icon: Beaker },
  { label: 'Recently used', icon: Activity },
];

const moduleCards = [
  {
    letter: 'A',
    title: 'Bảng quản trị hệ thống',
    description: 'Quản lý nhân sự, vai trò, quyền, khoa phòng, audit log và cấu hình hệ thống.',
    route: '/admin/overview',
    moduleRoute: '/admin/staff',
    status: 'Ready',
    statusTone: 'green',
    accent: 'violet',
    icon: ShieldCheck,
  },
  {
    letter: 'B',
    title: 'Điều phối lịch khám',
    description: 'Quản lý lịch làm việc, lịch khám, khung giờ, slot và xuất bản lịch.',
    route: '/scheduling/approvals',
    moduleRoute: '/scheduling/dashboard',
    status: 'Ready',
    statusTone: 'green',
    accent: 'green',
    icon: CalendarDays,
  },
  {
    letter: 'C',
    title: 'Lễ tân & tiếp nhận',
    description: 'Xem lịch hôm nay, check-in bệnh nhân, lấy số thứ tự và tiếp nhận walk-in.',
    route: '/reception/dashboard',
    moduleRoute: '/appointments',
    status: 'Beta',
    statusTone: 'orange',
    accent: 'orange',
    icon: UsersRound,
  },
  {
    letter: 'D',
    title: 'Bác sĩ lâm sàng',
    description: 'Quản lý cuộc khám, chẩn đoán, kế hoạch điều trị và đơn thuốc.',
    route: '/doctor/dashboard',
    moduleRoute: '/encounters',
    status: 'Beta',
    statusTone: 'orange',
    accent: 'blue',
    icon: Stethoscope,
  },
  {
    letter: 'E',
    title: 'Điều dưỡng',
    description: 'Theo dõi phân loại, dấu hiệu sinh tồn, hỗ trợ hàng đợi và chuẩn bị bệnh nhân.',
    route: '/nurse/dashboard',
    moduleRoute: '/queue',
    status: 'In progress',
    statusTone: 'blue',
    accent: 'purple',
    icon: HeartHandshake,
  },
  {
    letter: 'F',
    title: 'Bệnh nhân',
    description: 'Cổng thông tin bệnh nhân, lịch hẹn, hồ sơ và lịch sử khám chữa bệnh.',
    route: '/patient/dashboard',
    moduleRoute: '/patients',
    status: 'Beta',
    statusTone: 'orange',
    accent: 'cyan',
    icon: UserRound,
  },
  {
    letter: 'G',
    title: 'Nhà thuốc',
    description: 'Quản lý đơn thuốc, xuất thuốc, cảnh báo tương tác thuốc và tồn kho.',
    route: '/pharmacy/dashboard',
    moduleRoute: '/prescriptions',
    status: 'In progress',
    statusTone: 'blue',
    accent: 'green',
    icon: Pill,
  },
  {
    letter: 'H',
    title: 'Xét nghiệm & CĐHA',
    description: 'Quản lý chỉ định, xét nghiệm, chẩn đoán hình ảnh và theo dõi kết quả.',
    route: '/lab/dashboard',
    moduleRoute: '/lab/orders',
    status: 'In progress',
    statusTone: 'blue',
    accent: 'purple',
    icon: FlaskConical,
  },
  {
    letter: 'I',
    title: 'Viện phí & thanh toán',
    description: 'Quản lý viện phí, hóa đơn, thanh toán và bảo hiểm y tế.',
    route: '/billing/dashboard',
    moduleRoute: '/billing/invoices',
    status: 'Planned',
    statusTone: 'slate',
    accent: 'orange',
    icon: ReceiptText,
  },
  {
    letter: 'J',
    title: 'Báo cáo & phân tích',
    description: 'Báo cáo KPI, vận hành, sử dụng dịch vụ và tài chính.',
    route: '/reports/dashboard',
    moduleRoute: '/admin/logs/audit',
    status: 'Beta',
    statusTone: 'orange',
    accent: 'green',
    icon: Activity,
  },
  {
    letter: 'K',
    title: 'Bảo mật & phiên đăng nhập',
    description: 'Quản lý phiên, lịch sử đăng nhập, phân quyền và kiểm soát bảo mật.',
    route: '/security/overview',
    moduleRoute: '/admin/security/sessions',
    status: 'Ready',
    statusTone: 'green',
    accent: 'blue',
    icon: LockKeyhole,
  },
  {
    letter: 'L',
    title: 'Cài đặt hệ thống',
    description: 'Cấu hình tổ chức, feature flags, dữ liệu danh mục và tích hợp.',
    route: '/settings/system',
    moduleRoute: '/admin/settings',
    status: 'Ready',
    statusTone: 'green',
    accent: 'cyan',
    icon: Settings,
  },
];

const quickLinks = [
  { label: '/admin/staff', to: '/admin/staff', icon: UsersRound },
  { label: '/appointments', to: '/appointments', icon: CalendarDays },
  { label: '/admin/roles', to: '/admin/roles', icon: UserCog },
  { label: '/schedules', to: '/schedules', icon: Layers3 },
  { label: '/admin/permissions', to: '/admin/permissions', icon: ShieldCheck },
  { label: '/queue', to: '/queue', icon: Boxes },
  { label: '/admin/departments', to: '/admin/departments', icon: WalletCards },
  { label: '/encounters', to: '/encounters', icon: Stethoscope },
  { label: '/prescriptions', to: '/prescriptions', icon: Pill },
  { label: '/patients', to: '/patients', icon: UserRound },
  { label: '/profile', to: '/admin/profile', icon: User },
  { label: '/audit-logs', to: '/audit-logs', icon: ReceiptText },
  { label: '/dev/ui-kit', to: '/dev/ui-kit', icon: TestTube2 },
  { label: '/dev/routes', to: '/dev/routes', icon: LinkIcon },
  { label: '/dev/playground', to: '/dev/playground', icon: Gamepad2 },
];

const overviewStats = [
  { label: 'Dashboard', value: '12', icon: Grid3X3, tone: 'blue' },
  { label: 'Module', value: '38', icon: Layers3, tone: 'green' },
  { label: 'Routes', value: '124', icon: LinkIcon, tone: 'purple' },
  { label: 'Màn hình Beta', value: '7', icon: FlaskConical, tone: 'orange' },
];

export function StaffAccessPage() {
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const user = auth?.user;
  const isSuperAdmin = hasRole(auth, 'super_admin');
  const roles = (user?.roles || []).map(getRoleLabel).join(' • ') || 'Nhân sự';

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  return (
    <main className="super-access-shell">
      <section className="super-access-hero">
        <div className="super-access-hero__copy">
          <div className="super-access-badges">
            <span>Cổng truy cập Super Admin</span>
            <strong>
              <Sparkles size={15} strokeWidth={2.25} aria-hidden="true" />
              Dev mode
            </strong>
          </div>
          <h1>Chọn khu vực bạn muốn truy cập</h1>
          <p>
            Tài khoản Super Admin có thể truy cập nhanh tất cả dashboard, module và màn hình thử
            nghiệm trong giai đoạn phát triển.
          </p>

          <nav className="super-access-tabs" aria-label="Lọc khu vực truy cập">
            {accessTabs.map((tab, index) => {
              const Icon = tab.icon;

              return (
                <button key={tab.label} type="button" className={index === 0 ? 'is-active' : ''}>
                  <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <aside className="super-access-profile-card" aria-label="Thông tin Super Admin">
          <div className="super-access-profile-card__main">
            <span>{getInitials(user?.full_name || user?.username)}</span>
            <div>
              <strong>{user?.full_name || user?.username || 'System Super Admin'}</strong>
              <small>{isSuperAdmin ? 'Quyền quản trị cao nhất' : roles}</small>
            </div>
          </div>
          <div className="super-access-profile-card__actions">
            <Link to="/admin/profile">
              <User size={16} strokeWidth={2.2} aria-hidden="true" />
              Tài khoản
            </Link>
            <button type="button" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={2.25} aria-hidden="true" />
              Đăng xuất
            </button>
          </div>
        </aside>
      </section>

      <section className="super-access-workspace">
        <div className="super-access-module-grid" aria-label="Danh sách khu vực phát triển">
          {moduleCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.letter} className={`super-access-card super-access-card--${card.accent}`}>
                <span className="super-access-card__letter">{card.letter}</span>
                <div className="super-access-card__icon">
                  <Icon size={34} strokeWidth={2.1} aria-hidden="true" />
                </div>
                <div className="super-access-card__copy">
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </div>
                <div className="super-access-route-row">
                  <code>{card.route}</code>
                  <span className={`super-access-status super-access-status--${card.statusTone}`}>
                    {card.status}
                  </span>
                </div>
                <div className="super-access-card__actions">
                  <Link className="super-access-primary-link" to={card.route}>
                    Mở dashboard
                  </Link>
                  <Link to={card.moduleRoute}>
                    Xem module
                    <ArrowRight size={15} strokeWidth={2.3} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="super-access-quick-card">
          <header>
            <span>
              <Sparkles size={18} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <div>
              <h2>Liên kết nhanh trong quá trình phát triển</h2>
              <p>Truy cập nhanh các màn hình và route quan trọng</p>
            </div>
          </header>
          <div className="super-access-quick-grid">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.label} to={item.to}>
                  <span>
                    <Icon size={16} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  {item.label}
                  <ChevronRight size={16} strokeWidth={2.25} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="super-access-summary">
        <div className="super-access-summary__copy">
          <Microscope size={22} strokeWidth={2.2} aria-hidden="true" />
          <div>
            <h2>Môi trường phát triển</h2>
            <p>Tổng quan nhanh về hệ thống trong môi trường DEV.</p>
          </div>
        </div>
        {overviewStats.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.label} className={`super-access-stat super-access-stat--${item.tone}`}>
              <span>
                <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <strong>{item.value}</strong>
              <small>{item.label}</small>
            </article>
          );
        })}
        <div className="super-access-tip">
          <KeyRound size={20} strokeWidth={2.25} aria-hidden="true" />
          <p>
            <strong>Tip:</strong> Chọn đúng không gian làm việc để tránh đi sâu vào module không cần thiết.
          </p>
        </div>
      </section>
    </main>
  );
}
