import {
  Building2,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChartNoAxesCombined,
  CheckCheck,
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
  MonitorPlay,
  Moon,
  Search,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  ShieldCheck,
  Sun,
  TreePalm,
  UserCog,
  UsersRound,
  WandSparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';
import { SchedulingDataProvider } from '../context/SchedulingDataContext';

const THEME_STORAGE_KEY = 'healthcare.scheduling.theme';

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
];

const scheduleConfigItems = [
  { label: 'Cấu hình lịch', to: '/scheduling/configuration', icon: Settings },
  { label: 'Mẫu lịch', to: '/scheduling/configuration/templates', icon: CalendarDays },
  { label: 'Quy tắc & Chính sách', to: '/scheduling/configuration/policies', icon: Shield },
  { label: 'Nghỉ / Ngoại lệ', to: '/scheduling/configuration/exceptions', icon: TreePalm },
  { label: 'Telehealth', to: '/scheduling/configuration/telehealth', icon: MonitorPlay },
  { label: 'Thông báo', to: '/scheduling/configuration/notifications', icon: BellRing },
  { label: 'Nâng cao', to: '/scheduling/configuration/advanced', icon: SlidersHorizontal },
];

const adminQuickLinks = [
  { label: 'Tổng quan admin', to: '/admin/overview', hint: 'Dashboard quản trị', icon: LayoutDashboard },
  { label: 'Quản lý nhân sự', to: '/admin/staff', hint: 'Tài khoản và hồ sơ nhân sự', icon: UsersRound },
  { label: 'Hồ sơ quản trị', to: '/admin/profile', hint: 'Thông tin tài khoản của tôi', icon: UserCog },
  { label: 'Phân quyền', to: '/admin/roles', hint: 'Vai trò và quyền truy cập', icon: ShieldCheck },
  { label: 'Thiết lập hệ thống', to: '/admin/settings', hint: 'Cấu hình vận hành', icon: Settings },
];

const notificationSeed = [
  {
    id: 'approval-overdue',
    title: '3 lịch khám sắp quá hạn duyệt',
    body: 'Ưu tiên kiểm tra trước 17:30 hôm nay.',
    time: '5 phút trước',
    tone: 'danger',
    read: false,
    to: '/scheduling/approvals',
  },
  {
    id: 'schedule-published',
    title: 'Batch lịch Tim mạch đã xuất bản',
    body: '20 lịch đã sẵn sàng cho bệnh nhân đặt hẹn.',
    time: '18 phút trước',
    tone: 'success',
    read: false,
    to: '/scheduling/schedules',
  },
  {
    id: 'config-reminder',
    title: 'Cấu hình nghỉ lễ cần rà soát',
    body: 'Kiểm tra ngoại lệ lịch trước khi tạo lịch tháng mới.',
    time: '1 giờ trước',
    tone: 'info',
    read: false,
    to: '/scheduling/configuration/exceptions',
  },
];

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  } catch (error) {
    return 'light';
  }
}

function normalizeSearchValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getRoleLabel(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  if (roles.includes('super_admin')) return 'Super Admin';
  if (roles.includes('admin')) return 'Quản trị viên';
  if (roles.includes('doctor')) return 'Bác sĩ';
  if (roles.includes('receptionist')) return 'Lễ tân';
  return 'Quản trị viên';
}

function buildSearchItems() {
  return [
    ...navItems.map((item) => ({ ...item, group: 'Lịch khám' })),
    ...scheduleConfigItems.map((item) => ({ ...item, group: 'Cấu hình' })),
    ...adminQuickLinks.map((item) => ({ ...item, group: 'Quản trị' })),
  ];
}

const searchItems = buildSearchItems();

export function SchedulingShell() {
  const auth = readStoredAuth();
  const user = auth?.user;
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(readStoredTheme);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const [isTopbarAdminMenuOpen, setIsTopbarAdminMenuOpen] = useState(false);
  const [isRailAdminMenuOpen, setIsRailAdminMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(notificationSeed);
  const [isScheduleConfigOpen, setIsScheduleConfigOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const topbarAdminMenuRef = useRef(null);
  const railAdminMenuRef = useRef(null);
  const notificationsRef = useRef(null);
  const userName = user?.full_name || user?.username || 'Admin';
  const roleLabel = getRoleLabel(user);
  const unreadCount = notifications.filter((item) => !item.read).length;

  const searchResults = useMemo(() => {
    const query = normalizeSearchValue(searchQuery);

    if (!query) return searchItems.slice(0, 7);

    return searchItems
      .filter((item) => {
        const haystack = normalizeSearchValue(`${item.label} ${item.hint || ''} ${item.group || ''}`);
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      // Ignore storage failures in private browsing.
    }
  }, [theme]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }

      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }

      if (topbarAdminMenuRef.current && !topbarAdminMenuRef.current.contains(event.target)) {
        setIsTopbarAdminMenuOpen(false);
      }

      if (railAdminMenuRef.current && !railAdminMenuRef.current.contains(event.target)) {
        setIsRailAdminMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';

      if (isSearchShortcut) {
        event.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      }

      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        setIsNotificationsOpen(false);
        setIsTopbarAdminMenuOpen(false);
        setIsRailAdminMenuOpen(false);
        setIsMobileRailOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setIsMobileRailOpen(false);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setIsTopbarAdminMenuOpen(false);
    setIsRailAdminMenuOpen(false);
  }, [location.pathname]);

  function closeFloatingUi() {
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setIsTopbarAdminMenuOpen(false);
    setIsRailAdminMenuOpen(false);
  }

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  function handleMenuToggle() {
    const isNarrow = window.matchMedia?.('(max-width: 1200px)').matches;

    if (isNarrow) {
      setIsMobileRailOpen((current) => !current);
      return;
    }

    setIsRailCollapsed((current) => !current);
  }

  function handleNavigate(to) {
    navigate(to);
    setSearchQuery('');
    closeFloatingUi();
    setIsMobileRailOpen(false);
  }

  function handleSearchKeyDown(event) {
    if (event.key !== 'Enter') return;
    const [firstResult] = searchResults;

    if (firstResult) {
      event.preventDefault();
      handleNavigate(firstResult.to);
    }
  }

  function handleNotificationOpen() {
    setIsNotificationsOpen((current) => !current);
    setIsTopbarAdminMenuOpen(false);
  }

  function handleNotificationClick(item) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === item.id ? { ...notification, read: true } : notification,
      ),
    );
    handleNavigate(item.to);
  }

  function markAllNotificationsRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }

  function closeAdminMenus() {
    setIsTopbarAdminMenuOpen(false);
    setIsRailAdminMenuOpen(false);
  }

  const moduleClassName = [
    'scheduling-module',
    theme === 'dark' ? 'is-dark-mode' : '',
    isRailCollapsed ? 'is-rail-collapsed' : '',
    isMobileRailOpen ? 'is-rail-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <SchedulingDataProvider>
      <div className={moduleClassName}>
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
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'is-active' : '')}
                  onClick={() => setIsMobileRailOpen(false)}
                >
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

            <div className={`scheduling-nav-group${isScheduleConfigOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="scheduling-nav-group__trigger"
                aria-controls="scheduling-config-menu"
                aria-expanded={isScheduleConfigOpen}
                onClick={() => setIsScheduleConfigOpen((current) => !current)}
              >
                <span className="scheduling-nav-group__icon" aria-hidden="true">
                  <Settings size={20} strokeWidth={2.15} />
                </span>
                <span className="scheduling-nav-group__copy">
                  <strong>Cấu hình lịch</strong>
                  <small>Thiết lập hệ thống</small>
                </span>
                {isScheduleConfigOpen ? (
                  <ChevronUp size={15} strokeWidth={2.35} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
                )}
              </button>

              {isScheduleConfigOpen ? (
                <div className="scheduling-nav-group__menu" id="scheduling-config-menu">
                  {scheduleConfigItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => (isActive ? 'is-active' : '')}
                        onClick={() => setIsMobileRailOpen(false)}
                      >
                        <Icon size={15} strokeWidth={2.15} aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
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
                <img src="/images/scheduling/admin-avatar.png" alt="" />
                <div>
                  <strong>{userName}</strong>
                  <small>{roleLabel}</small>
                </div>
                <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
              </button>

              {isRailAdminMenuOpen ? (
                <div className="scheduling-rail__admin-menu" id="scheduling-rail-admin-menu" role="menu">
                  {adminQuickLinks
                    .filter((item) => item.to !== '/admin/staff')
                    .map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link key={item.to} to={item.to} role="menuitem" onClick={closeAdminMenus}>
                          <Icon size={15} strokeWidth={2.25} aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                  <button type="button" role="menuitem" onClick={handleLogout}>
                    <LogOut size={15} strokeWidth={2.25} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {isMobileRailOpen ? (
          <button
            type="button"
            className="scheduling-rail-backdrop"
            aria-label="Đóng điều hướng"
            onClick={() => setIsMobileRailOpen(false)}
          />
        ) : null}

        <section className="scheduling-workspace">
          <header className="scheduling-topbar">
            <button
              type="button"
              className="scheduling-topbar__menu"
              aria-label={isRailCollapsed || isMobileRailOpen ? 'Mở điều hướng' : 'Thu gọn điều hướng'}
              aria-pressed={isRailCollapsed || isMobileRailOpen}
              onClick={handleMenuToggle}
            >
              {isMobileRailOpen ? (
                <X size={19} strokeWidth={2.25} aria-hidden="true" />
              ) : (
                <Menu size={19} strokeWidth={2.25} aria-hidden="true" />
              )}
            </button>

            <div className="scheduling-topbar__search-wrap" ref={searchRef}>
              <label className={`scheduling-topbar__search${isSearchOpen ? ' is-open' : ''}`}>
                <Search size={18} strokeWidth={2.2} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  placeholder="Tìm lịch, bác sĩ, khoa, bệnh nhân..."
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="scheduling-search-clear"
                    aria-label="Xóa tìm kiếm"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                  >
                    <X size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                ) : (
                  <kbd>Ctrl + K</kbd>
                )}
              </label>

              {isSearchOpen ? (
                <div className="scheduling-search-popover" role="listbox" aria-label="Kết quả tìm kiếm nhanh">
                  <div className="scheduling-search-popover__head">
                    <span>{searchQuery ? `Kết quả cho "${searchQuery}"` : 'Truy cập nhanh'}</span>
                    <small>Enter để mở kết quả đầu tiên</small>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="scheduling-search-results">
                      {searchResults.map((item) => {
                        const Icon = item.icon;

                        return (
                          <button key={`${item.group}-${item.to}`} type="button" onClick={() => handleNavigate(item.to)}>
                            <span aria-hidden="true">
                              <Icon size={16} strokeWidth={2.25} />
                            </span>
                            <div>
                              <strong>{item.label}</strong>
                              <small>{item.group} • {item.hint || item.to}</small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="scheduling-search-empty">
                      <Search size={18} strokeWidth={2.25} aria-hidden="true" />
                      <span>Không tìm thấy màn hình phù hợp.</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="scheduling-topbar__user">
              <button
                type="button"
                className={`scheduling-topbar__theme${theme === 'dark' ? ' is-active' : ''}`}
                aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              >
                {theme === 'dark' ? (
                  <Sun size={18} strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Moon size={18} strokeWidth={2.2} aria-hidden="true" />
                )}
              </button>

              <div className="scheduling-topbar__notifications" ref={notificationsRef}>
                <button
                  type="button"
                  className="scheduling-topbar__notify"
                  aria-label="Thông báo"
                  aria-controls="scheduling-notification-menu"
                  aria-expanded={isNotificationsOpen}
                  aria-haspopup="menu"
                  onClick={handleNotificationOpen}
                >
                  <Bell size={18} strokeWidth={2.2} aria-hidden="true" />
                  {unreadCount > 0 ? <span>{unreadCount}</span> : null}
                </button>

                {isNotificationsOpen ? (
                  <div className="scheduling-notification-menu" id="scheduling-notification-menu" role="menu">
                    <header>
                      <div>
                        <strong>Thông báo</strong>
                        <span>{unreadCount} chưa đọc</span>
                      </div>
                      <button type="button" onClick={markAllNotificationsRead}>
                        <CheckCheck size={15} strokeWidth={2.35} aria-hidden="true" />
                        Đã đọc
                      </button>
                    </header>

                    <div className="scheduling-notification-list">
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={!item.read ? 'is-unread' : ''}
                          role="menuitem"
                          onClick={() => handleNotificationClick(item)}
                        >
                          <span className={`scheduling-notification-dot scheduling-notification-dot--${item.tone}`} />
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.body}</small>
                            <time>{item.time}</time>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="scheduling-topbar__admin" ref={topbarAdminMenuRef}>
                <button
                  type="button"
                  className="scheduling-topbar__admin-trigger"
                  aria-controls="scheduling-admin-menu"
                  aria-expanded={isTopbarAdminMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setIsTopbarAdminMenuOpen((current) => !current);
                    setIsNotificationsOpen(false);
                  }}
                >
                  <div>
                    <strong>{userName}</strong>
                    <small>{roleLabel}</small>
                  </div>
                  <img src="/images/scheduling/admin-avatar.png" alt="" />
                  <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
                </button>

                {isTopbarAdminMenuOpen ? (
                  <div className="scheduling-topbar__admin-menu" id="scheduling-admin-menu" role="menu">
                    {adminQuickLinks.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link key={item.to} to={item.to} role="menuitem" onClick={closeAdminMenus}>
                          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                    <button type="button" role="menuitem" onClick={handleLogout}>
                      <LogOut size={16} strokeWidth={2.25} aria-hidden="true" />
                      Đăng xuất
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          <Outlet />
        </section>
      </div>
    </SchedulingDataProvider>
  );
}
