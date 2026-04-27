import {
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ChartNoAxesCombined,
  Clock3,
  FileClock,
  Headphones,
  House,
  LayoutDashboard,
  Layers3,
  Bell,
  CircleCheck,
  LogOut,
  Menu,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { SchedulingDataProvider } from '../context/SchedulingDataContext';

const navItems = [
  { label: 'Tổng quan', to: '/scheduling/dashboard', hint: 'Toàn bộ hệ thống', icon: House },
  { label: 'Danh sách lịch', to: '/scheduling/schedules', hint: 'Quản lý tất cả lịch bác sĩ', icon: CalendarDays },
  { label: 'Tạo lịch', to: '/scheduling/create', hint: 'Tạo lịch mới', icon: WandSparkles },
  { label: 'Tạo hàng loạt', to: '/scheduling/bulk-create', hint: 'Tạo nhiều lịch cùng lúc', icon: Layers3, badge: 'HOT' },
  { label: 'Duyệt & xuất bản', to: '/scheduling/approvals', hint: 'Duyệt và công bố lịch', icon: Send },
  { label: 'Lịch trực quan', to: '/scheduling/calendar', hint: 'Xem lịch theo ngày / tuần', icon: CalendarCheck2 },
  { label: 'Khung giờ & slot', to: '/scheduling/slots', hint: 'Quản lý khung giờ, slot', icon: Clock3 },
  { label: 'Theo bác sĩ', to: '/scheduling/doctors', hint: 'Lịch cá nhân từng bác sĩ', icon: UsersRound },
  { label: 'Theo khoa', to: '/scheduling/departments', hint: 'Lịch theo từng khoa', icon: Building2 },
  { label: 'Báo cáo thống kê', to: '/scheduling/utilization', hint: 'Hiệu suất & phân tích', icon: ChartNoAxesCombined },
  { label: 'Nhật ký hoạt động', to: '/scheduling/activity', hint: 'Lịch sử thay đổi lịch', icon: FileClock },
  { label: 'Cấu hình lịch', to: '/admin/settings', hint: 'Thiết lập hệ thống', icon: Settings },
];

export function SchedulingShell() {
  const [isTopbarAdminMenuOpen, setIsTopbarAdminMenuOpen] = useState(false);
  const [isRailAdminMenuOpen, setIsRailAdminMenuOpen] = useState(false);
  const topbarAdminMenuRef = useRef(null);
  const railAdminMenuRef = useRef(null);

  useEffect(() => {
    if (!isTopbarAdminMenuOpen && !isRailAdminMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (topbarAdminMenuRef.current && !topbarAdminMenuRef.current.contains(event.target)) {
        setIsTopbarAdminMenuOpen(false);
      }

      if (railAdminMenuRef.current && !railAdminMenuRef.current.contains(event.target)) {
        setIsRailAdminMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsTopbarAdminMenuOpen(false);
        setIsRailAdminMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTopbarAdminMenuOpen, isRailAdminMenuOpen]);

  function closeAdminMenus() {
    setIsTopbarAdminMenuOpen(false);
    setIsRailAdminMenuOpen(false);
  }

  return (
    <SchedulingDataProvider>
      <div className="scheduling-module">
        <aside className="scheduling-rail" aria-label="Điều hướng lịch khám">
          <div className="scheduling-rail__head">
            <span className="scheduling-rail__brand-icon" aria-hidden="true">
              <CalendarCheck2 size={22} strokeWidth={2.2} />
            </span>
            <div>
              <strong>LỊCH KHÁM</strong>
              <span>Scheduling System</span>
            </div>
          </div>

          <nav className="scheduling-rail__nav">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                  <span className="scheduling-nav-icon" aria-hidden="true">
                    <Icon size={19} strokeWidth={2.15} />
                  </span>
                  <span className="scheduling-nav-label">
                    <span>{item.label}</span>
                    {item.badge ? <em>{item.badge}</em> : null}
                  </span>
                  <small>{item.hint}</small>
                </NavLink>
              );
            })}
          </nav>

          <div className="scheduling-rail__footer">
            <div className="scheduling-rail__support">
              <div className="scheduling-rail__support-main">
                <span aria-hidden="true">
                  <Headphones size={18} strokeWidth={2.25} />
                </span>
                <div>
                  <small>Trung tâm hỗ trợ</small>
                  <strong>1900 1234</strong>
                </div>
              </div>
              <div className="scheduling-rail__support-line">
                <Clock3 size={14} strokeWidth={2.2} aria-hidden="true" />
                <span>08:30 - 24/04/2026</span>
              </div>
              <div className="scheduling-rail__support-status">
                <CircleCheck size={14} strokeWidth={2.45} aria-hidden="true" />
                <span>Hệ thống hoạt động tốt</span>
              </div>
            </div>

            <div className="scheduling-rail__admin" ref={railAdminMenuRef}>
              <button
                type="button"
                className="scheduling-rail__admin-trigger"
                aria-controls="scheduling-rail-admin-menu"
                aria-expanded={isRailAdminMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsRailAdminMenuOpen((current) => !current)}
              >
                <img src="/images/scheduling/admin-avatar.png" alt="Admin" />
                <div>
                  <strong>Admin</strong>
                  <small>Quản trị viên</small>
                </div>
                <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
              </button>

              {isRailAdminMenuOpen ? (
                <div className="scheduling-rail__admin-menu" id="scheduling-rail-admin-menu" role="menu">
                  <Link to="/admin/overview" role="menuitem" onClick={closeAdminMenus}>
                    <LayoutDashboard size={15} strokeWidth={2.25} aria-hidden="true" />
                    Tổng quan admin
                  </Link>
                  <Link to="/admin/profile" role="menuitem" onClick={closeAdminMenus}>
                    <UserCog size={15} strokeWidth={2.25} aria-hidden="true" />
                    Hồ sơ quản trị
                  </Link>
                  <Link to="/admin/roles" role="menuitem" onClick={closeAdminMenus}>
                    <ShieldCheck size={15} strokeWidth={2.25} aria-hidden="true" />
                    Phân quyền
                  </Link>
                  <Link to="/admin/settings" role="menuitem" onClick={closeAdminMenus}>
                    <Settings size={15} strokeWidth={2.25} aria-hidden="true" />
                    Thiết lập hệ thống
                  </Link>
                  <button type="button" role="menuitem" onClick={closeAdminMenus}>
                    <LogOut size={15} strokeWidth={2.25} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="scheduling-workspace">
          <header className="scheduling-topbar">
            <button type="button" className="scheduling-topbar__menu" aria-label="Mở điều hướng">
              <Menu size={19} strokeWidth={2.25} aria-hidden="true" />
            </button>
            <label className="scheduling-topbar__search">
              <Search size={18} strokeWidth={2.2} aria-hidden="true" />
              <input type="search" placeholder="Tìm lịch, bác sĩ, khoa, bệnh nhân..." />
              <kbd>Ctrl + K</kbd>
            </label>

            <div className="scheduling-topbar__user" ref={topbarAdminMenuRef}>
              <button type="button" className="scheduling-topbar__theme" aria-label="Đổi giao diện">
                <Sun size={18} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <button type="button" className="scheduling-topbar__notify" aria-label="Thông báo">
                <Bell size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>3</span>
              </button>
              <button
                type="button"
                className="scheduling-topbar__admin-trigger"
                aria-controls="scheduling-admin-menu"
                aria-expanded={isTopbarAdminMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsTopbarAdminMenuOpen((current) => !current)}
              >
                <div>
                  <strong>Admin</strong>
                  <small>Quản trị viên</small>
                </div>
                <img src="/images/scheduling/admin-avatar.png" alt="Admin" />
                <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
              </button>

              {isTopbarAdminMenuOpen ? (
                <div className="scheduling-topbar__admin-menu" id="scheduling-admin-menu" role="menu">
                  <Link to="/admin/overview" role="menuitem" onClick={closeAdminMenus}>
                    <LayoutDashboard size={16} strokeWidth={2.25} aria-hidden="true" />
                    Tổng quan admin
                  </Link>
                  <Link to="/admin/staff" role="menuitem" onClick={closeAdminMenus}>
                    <UsersRound size={16} strokeWidth={2.25} aria-hidden="true" />
                    Quản lý nhân sự
                  </Link>
                  <Link to="/admin/profile" role="menuitem" onClick={closeAdminMenus}>
                    <UserCog size={16} strokeWidth={2.25} aria-hidden="true" />
                    Hồ sơ quản trị
                  </Link>
                  <Link to="/admin/roles" role="menuitem" onClick={closeAdminMenus}>
                    <ShieldCheck size={16} strokeWidth={2.25} aria-hidden="true" />
                    Phân quyền
                  </Link>
                  <Link to="/admin/settings" role="menuitem" onClick={closeAdminMenus}>
                    <Settings size={16} strokeWidth={2.25} aria-hidden="true" />
                    Thiết lập hệ thống
                  </Link>
                  <button type="button" role="menuitem" onClick={closeAdminMenus}>
                    <LogOut size={16} strokeWidth={2.25} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </header>
          <Outlet />
        </section>
      </div>
    </SchedulingDataProvider>
  );
}
