import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  FileClock,
  FileText,
  Gauge,
  HeartPulse,
  HelpCircle,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  ListChecks,
  LockKeyhole,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TestTube2,
  UserCog,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';

const MENU_SECTIONS = [
  {
    title: 'TỔNG QUAN',
    items: [
      { label: 'Bảng điều khiển', icon: LayoutDashboard, to: '/admin/overview', match: ['/admin/overview'] },
      { label: 'Trung tâm điều hành', icon: Gauge, to: '/super-admin/access', match: ['/super-admin/access'] },
      {
        label: 'Cảnh báo hệ thống',
        icon: AlertTriangle,
        to: '/security/overview',
        badge: '12',
        badgeTone: 'danger',
      },
      { label: 'Hoạt động gần đây', icon: History, to: '/admin/logs/audit', match: ['/admin/logs/audit'] },
      { label: 'KPI & chỉ số nhanh', icon: BarChart3, to: '/reports/dashboard', badge: 'Mới', badgeTone: 'success' },
    ],
  },
  {
    title: 'QUẢN TRỊ TỔ CHỨC',
    items: [
      {
        label: 'Nhân sự',
        icon: UsersRound,
        to: '/admin/staff',
        match: ['/admin/staff'],
        children: [
          { label: 'Danh sách nhân sự', icon: UsersRound, to: '/admin/staff', exact: true },
          { label: 'Tạo nhân sự', icon: UserCog, to: '/admin/staff/create', exact: true },
          { label: 'Phân quyền nhân sự', icon: ShieldCheck, to: '/admin/roles' },
          { label: 'Lịch sử tài khoản', icon: FileClock, to: '/admin/logs/login-history' },
        ],
      },
      {
        label: 'Khoa phòng',
        icon: Building2,
        to: '/admin/departments',
        match: ['/admin/departments'],
        children: [
          { label: 'Danh sách khoa/phòng', icon: Building2, to: '/admin/departments', exact: true },
          { label: 'Tạo khoa/phòng', icon: Sparkles, to: '/admin/departments/create', exact: true },
        ],
      },
      {
        label: 'Vai trò & quyền',
        icon: KeyRound,
        to: '/admin/roles',
        match: ['/admin/roles', '/admin/permissions'],
        children: [
          { label: 'Danh sách vai trò', icon: ShieldCheck, to: '/admin/roles', exact: true },
          { label: 'Tạo vai trò', icon: Sparkles, to: '/admin/roles/create', exact: true },
          { label: 'Danh sách quyền', icon: KeyRound, to: '/admin/permissions', exact: true },
          { label: 'Tạo quyền', icon: LockKeyhole, to: '/admin/permissions/create', exact: true },
        ],
      },
      {
        label: 'Tài khoản bệnh nhân',
        icon: UserRound,
        to: '/patients',
        children: [
          { label: 'Danh sách bệnh nhân', icon: UserRound, to: '/patients' },
          { label: 'Cổng bệnh nhân', icon: HeartPulse, to: '/patient/dashboard' },
        ],
      },
      {
        label: 'Danh mục hệ thống',
        icon: Database,
        to: '/admin/settings',
        children: [
          { label: 'Thiết lập chung', icon: Settings, to: '/admin/settings' },
          { label: 'Khoa/phòng', icon: Building2, to: '/admin/departments' },
          { label: 'Vai trò', icon: ShieldCheck, to: '/admin/roles' },
        ],
      },
    ],
  },
  {
    title: 'VẬN HÀNH KHÁM CHỮA BỆNH',
    items: [
      {
        label: 'Bệnh nhân',
        icon: UserRound,
        to: '/patients',
        children: [
          { label: 'Danh sách bệnh nhân', icon: UserRound, to: '/patients' },
          { label: 'Hồ sơ bệnh nhân', icon: FileText, to: '/patient/dashboard' },
        ],
      },
      {
        label: 'Lịch khám',
        icon: CalendarDays,
        to: '/scheduling/dashboard',
        children: [
          { label: 'Tổng quan lịch', icon: CalendarCheck2, to: '/scheduling/dashboard' },
          { label: 'Lịch theo bác sĩ', icon: UsersRound, to: '/scheduling/doctors' },
          { label: 'Lịch theo khoa', icon: Building2, to: '/scheduling/departments' },
          { label: 'Lịch chờ duyệt', icon: ClipboardList, to: '/scheduling/approvals', badge: 'Mới', badgeTone: 'purple' },
          { label: 'Lịch đã xuất bản', icon: CalendarClock, to: '/scheduling/schedules' },
          { label: 'Xem ảnh hưởng thay đổi', icon: Activity, to: '/scheduling/activity' },
          { label: 'AI xếp lịch', icon: Sparkles, to: '/scheduling/bulk-create', badge: 'Beta', badgeTone: 'purple' },
        ],
      },
      { label: 'Cuộc hẹn', icon: CalendarCheck2, to: '/appointments' },
      { label: 'Hàng đợi', icon: ListChecks, to: '/queue' },
      { label: 'Hồ sơ khám', icon: ClipboardList, to: '/encounters' },
      { label: 'Đơn thuốc & thuốc', icon: Pill, to: '/prescriptions' },
      { label: 'Xét nghiệm', icon: TestTube2, to: '/lab/orders', badge: 'Mới', badgeTone: 'success' },
      { label: 'Thanh toán & hóa đơn', icon: ReceiptText, to: '/billing/invoices' },
    ],
  },
  {
    title: 'HỆ THỐNG & BẢO MẬT',
    items: [
      {
        label: 'Bảo mật & nhật ký',
        icon: ShieldAlert,
        to: '/admin/security/change-password',
        match: ['/admin/security', '/admin/logs'],
        flyoutPlacement: 'bottom',
        children: [
          { label: 'Chính sách bảo mật', icon: LockKeyhole, to: '/admin/security/change-password' },
          { label: 'Phiên đăng nhập', icon: UsersRound, to: '/admin/security/sessions' },
          { label: 'Nhật ký đăng nhập', icon: History, to: '/admin/logs/login-history' },
          { label: 'Audit log', icon: FileClock, to: '/admin/logs/audit' },
          { label: 'Thiết bị tin cậy', icon: ShieldCheck, to: '/security/overview' },
          { label: 'Cảnh báo bảo mật', icon: AlertTriangle, to: '/security/overview' },
        ],
      },
      { label: 'Thông báo', icon: Bell, to: '/admin/settings' },
      { label: 'Cấu hình hệ thống', icon: Settings, to: '/admin/settings', match: ['/admin/settings'] },
      { label: 'Báo cáo & phân tích', icon: BarChart3, to: '/reports/dashboard', badge: 'Pro', badgeTone: 'purple' },
      { label: 'Tích hợp & đồng bộ', icon: Link2, to: '/settings/system', badge: 'Beta', badgeTone: 'warning' },
    ],
  },
];

const FOOTER_ITEMS = [
  { label: 'Hỗ trợ', icon: LifeBuoy, to: '/support' },
  { label: 'Tài liệu', icon: BookOpen, to: '/terms' },
  { label: 'Cài đặt nhanh', icon: SlidersHorizontal, to: '/admin/settings', badge: 'Mới', badgeTone: 'success' },
];

function getInitials(name) {
  return String(name || 'SA')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('');
}

function getTopbarSection(pathname) {
  if (pathname.startsWith('/admin/staff')) {
    if (pathname.endsWith('/create')) return 'Tạo nhân sự';
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa nhân sự';
    if (/\/admin\/staff\/[^/]+$/.test(pathname)) return 'Chi tiết nhân sự';
    return 'Quản lý nhân sự';
  }

  if (pathname.startsWith('/admin/roles')) {
    if (pathname.endsWith('/create')) return 'Tạo vai trò';
    if (pathname.endsWith('/permissions')) return 'Gán quyền';
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa vai trò';
    if (/\/admin\/roles\/[^/]+$/.test(pathname)) return 'Chi tiết vai trò';
    return 'Quản lý vai trò';
  }

  if (pathname.startsWith('/admin/permissions')) {
    if (pathname.endsWith('/create')) return 'Tạo quyền';
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa quyền';
    if (/\/admin\/permissions\/[^/]+$/.test(pathname)) return 'Chi tiết quyền';
    return 'Quản lý quyền';
  }

  if (pathname.startsWith('/admin/departments')) {
    if (pathname.endsWith('/create')) return 'Tạo khoa/phòng';
    if (pathname.endsWith('/edit')) return 'Chỉnh sửa khoa/phòng';
    if (/\/admin\/departments\/[^/]+$/.test(pathname)) return 'Chi tiết khoa/phòng';
    return 'Quản lý khoa/phòng';
  }

  if (pathname.startsWith('/admin/logs/login-history')) return 'Lịch sử đăng nhập';
  if (pathname.startsWith('/admin/logs/audit')) return 'Nhật ký hệ thống';
  if (pathname.startsWith('/admin/profile')) return 'Hồ sơ của tôi';
  if (pathname.startsWith('/admin/security/change-password')) return 'Đổi mật khẩu';
  if (pathname.startsWith('/admin/security/sessions')) return 'Phiên đăng nhập của tôi';
  if (pathname.startsWith('/admin/settings')) return 'Cấu hình hệ thống';

  return 'Tổng quan';
}

function isPathMatch(pathname, candidate) {
  return pathname === candidate || pathname.startsWith(`${candidate}/`);
}

function isMenuItemActive(pathname, item) {
  if (item.exact) return pathname === item.to;

  const candidates = item.match || [item.to];
  const isOwnRouteActive = candidates.some((candidate) => isPathMatch(pathname, candidate));
  const isChildRouteActive = item.children?.some((child) => isMenuItemActive(pathname, child));

  return Boolean(isOwnRouteActive || isChildRouteActive);
}

function Badge({ value, tone = 'default' }) {
  if (!value) return null;

  return <span className={`admin-sidebar__badge admin-sidebar__badge--${tone}`}>{value}</span>;
}

function MenuLink({ item, pathname, onNavigate }) {
  const Icon = item.icon;
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const isActive = isMenuItemActive(pathname, item);

  return (
    <div
      className={[
        'admin-menu-item',
        isActive ? 'is-active' : '',
        hasChildren ? 'has-flyout' : '',
        item.flyoutPlacement === 'bottom' ? 'has-bottom-flyout' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <NavLink to={item.to} className="admin-menu-link" onClick={onNavigate}>
        <span className="admin-menu-link__icon" aria-hidden="true">
          <Icon size={15.5} strokeWidth={2.25} />
        </span>
        <span className="admin-menu-link__label">{item.label}</span>
        <Badge value={item.badge} tone={item.badgeTone} />
        {hasChildren ? (
          <ChevronRight className="admin-menu-link__chevron" size={14} strokeWidth={2.35} aria-hidden="true" />
        ) : null}
      </NavLink>

      {hasChildren ? (
        <div className="admin-sidebar__flyout" role="menu" aria-label={item.label}>
          {item.children.map((child) => {
            const ChildIcon = child.icon;

            return (
              <NavLink
                key={`${item.label}-${child.label}`}
                to={child.to}
                className={isMenuItemActive(pathname, child) ? 'is-active' : ''}
                onClick={onNavigate}
                role="menuitem"
              >
                <ChildIcon size={14} strokeWidth={2.2} aria-hidden="true" />
                <span>{child.label}</span>
                <Badge value={child.badge} tone={child.badgeTone} />
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AdminLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth?.user;

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  return (
    <main className={`admin-dashboard${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar__main">
          <nav className="admin-sidebar__nav" aria-label="Admin navigation">
            {MENU_SECTIONS.map((section, sectionIndex) => (
              <section key={section.title} className="admin-sidebar__section">
                <div className="admin-sidebar__section-head">
                  <span>{section.title}</span>
                  {sectionIndex === 0 ? <ChevronDown size={12} strokeWidth={2.4} aria-hidden="true" /> : null}
                </div>

                <div className="admin-sidebar__section-list">
                  {section.items.map((item) => (
                    <MenuLink key={`${section.title}-${item.label}`} item={item} pathname={location.pathname} />
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </div>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__support">
            {FOOTER_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.label} to={item.to} className="admin-sidebar__placeholder">
                  <span className="admin-menu-link__icon" aria-hidden="true">
                    <Icon size={15.5} strokeWidth={2.25} />
                  </span>
                  <span className="admin-menu-link__label">{item.label}</span>
                  <Badge value={item.badge} tone={item.badgeTone} />
                </Link>
              );
            })}
          </div>

          <button type="button" className="admin-sidebar__logout" onClick={handleLogout}>
            <LogOut size={15.5} strokeWidth={2.35} aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>

          <button
            type="button"
            className="admin-sidebar__collapse"
            aria-pressed={isSidebarCollapsed}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={16} strokeWidth={2.3} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={16} strokeWidth={2.3} aria-hidden="true" />
            )}
            <span>{isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}</span>
            <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <section className="admin-stage">
        <header className="admin-header">
          <label className="admin-search" htmlFor="admin-global-search">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <input id="admin-global-search" type="search" placeholder="Tìm kiếm hệ thống..." />
          </label>

          <div className="admin-header__meta">
            <div className="admin-header__tabs">
              <span>Admin</span>
              <strong>{getTopbarSection(location.pathname)}</strong>
            </div>

            <div className="admin-header__actions">
              <button type="button" aria-label="Thông báo">
                <BellRing size={18} strokeWidth={2.25} aria-hidden="true" />
              </button>
              <button type="button" aria-label="Hỗ trợ">
                <HelpCircle size={18} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </div>

            <div className="admin-header__profile">
              <div>
                <strong>{user?.full_name || user?.username || 'Quản trị hệ thống'}</strong>
                <span>QUẢN TRỊ VIÊN</span>
              </div>
              <div className="admin-header__avatar">{getInitials(user?.full_name || user?.username)}</div>
            </div>

            <button type="button" className="admin-header__logout" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </header>

        <Outlet />
      </section>
    </main>
  );
}
