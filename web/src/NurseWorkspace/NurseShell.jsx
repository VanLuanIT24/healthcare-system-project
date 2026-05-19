import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  HeartPulse,
  LogOut,
  Menu,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { getStaffActorName } from '../receptionist/workspaceAccess';
import { flattenNurseMenu, getNursePageMeta, nurseMenuSections } from './nurseData';

function getInitials(name = '') {
  const initials = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'ĐD';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getNurseRoleLabel(auth) {
  const roles = auth?.user?.roles || auth?.roles || [];
  if (roles.includes('super_admin')) return 'Quản trị hệ thống';
  if (roles.includes('department_head')) return 'Điều dưỡng trưởng';
  return 'Điều dưỡng';
}

function NurseNavLink({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      end
      to={item.to}
      title={item.label}
      className={({ isActive }) => `nurse-nav-link${isActive ? ' is-active' : ''}`}
      onClick={onNavigate}
    >
      <span className="nurse-nav-link__icon" aria-hidden="true">
        <Icon size={collapsed ? 18 : 15} strokeWidth={2.2} />
      </span>
      {!collapsed ? <span className="nurse-nav-link__label">{item.label}</span> : null}
    </NavLink>
  );
}

export function NurseShell({ children }) {
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(nurseMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );

  const allMenuItems = useMemo(() => flattenNurseMenu(), []);
  const currentPage = getNursePageMeta(location.pathname);
  const displayName = getStaffActorName(auth);
  const roleLabel = getNurseRoleLabel(auth);

  const searchResults = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!query) return allMenuItems.slice(0, 8);

    return allMenuItems
      .filter((item) => normalizeText(`${item.label} ${item.sectionLabel}`).includes(query))
      .slice(0, 10);
  }, [allMenuItems, searchQuery]);

  useEffect(() => {
    const activeItem = allMenuItems.find((item) => item.to === location.pathname);
    if (!activeItem?.sectionId) return;

    setOpenSections((current) => ({
      ...current,
      [activeItem.sectionId]: true,
    }));
  }, [allMenuItems, location.pathname]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) setIsSearchOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setIsNotificationOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setIsProfileOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function toggleSection(sectionId) {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  function closeMobileSidebar() {
    setIsMobileSidebarOpen(false);
  }

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  function navigateFromSearch(to) {
    setSearchQuery('');
    setIsSearchOpen(false);
    navigate(to);
  }

  return (
    <main className={`nurse-workspace${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}${isMobileSidebarOpen ? ' is-mobile-sidebar-open' : ''}`}>
      <aside className="nurse-sidebar" aria-label="Menu điều dưỡng">
        <div className="nurse-sidebar__brand">
          <Link to="/staff/select-workspace" className="nurse-sidebar__brand-link" onClick={closeMobileSidebar}>
            <span className="nurse-sidebar__brand-mark" aria-hidden="true">
              <HeartPulse size={25} strokeWidth={2.4} />
            </span>
            {!isSidebarCollapsed ? (
              <span className="nurse-sidebar__brand-copy">
                <strong>Điều dưỡng</strong>
                <small>Không gian điều dưỡng</small>
              </span>
            ) : null}
          </Link>
        </div>

        <nav className="nurse-sidebar__nav">
          {nurseMenuSections.map((section) => {
            const Icon = section.icon;
            const isOpen = Boolean(openSections[section.id]) && !isSidebarCollapsed;
            const isActive = section.children?.some((item) => item.to === location.pathname);

            return (
              <div key={section.id} className={`nurse-nav-group${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}>
                <button
                  type="button"
                  className="nurse-nav-group__trigger"
                  title={section.label}
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="nurse-nav-group__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  {!isSidebarCollapsed ? <span className="nurse-nav-group__label">{section.label}</span> : null}
                  {!isSidebarCollapsed ? (
                    <ChevronDown className="nurse-nav-group__chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
                  ) : null}
                </button>

                {isOpen ? (
                  <div className="nurse-nav-group__children">
                    {section.children.map((item) => (
                      <NurseNavLink
                        key={item.id}
                        item={item}
                        collapsed={isSidebarCollapsed}
                        onNavigate={closeMobileSidebar}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="nurse-sidebar__footer">
          {!isSidebarCollapsed ? (
            <Link to="/nurse/monitoring-reporting/abnormal-alerts" className="nurse-sidebar__alert" onClick={closeMobileSidebar}>
              <Bell size={17} strokeWidth={2.2} />
              <span>
                <strong>3 cảnh báo</strong>
                <small>Cần theo dõi trong ca</small>
              </span>
            </Link>
          ) : null}

          <button
            type="button"
            className="nurse-sidebar__collapse"
            aria-label={isSidebarCollapsed ? 'Mở rộng menu bên' : 'Thu gọn menu bên'}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <ChevronsLeft className={isSidebarCollapsed ? 'is-rotated' : ''} size={18} strokeWidth={2.2} />
            {!isSidebarCollapsed ? <span>Thu gọn</span> : null}
          </button>
        </div>
      </aside>

      <div className="nurse-mobile-backdrop" onClick={closeMobileSidebar} />

      <section className="nurse-main">
        <header className="nurse-topbar">
          <div className="nurse-topbar__left">
            <button
              type="button"
              className="nurse-icon-button nurse-topbar__menu"
              aria-label="Mở menu điều dưỡng"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu size={20} strokeWidth={2.2} />
            </button>
            <div className="nurse-topbar__title">
              <span>{currentPage.sectionLabel}</span>
              <strong>{currentPage.label}</strong>
            </div>
          </div>

          <div className="nurse-topbar__tools">
            <div className={`nurse-search${isSearchOpen ? ' is-open' : ''}`} ref={searchRef}>
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Tìm menu điều dưỡng"
                aria-label="Tìm menu điều dưỡng"
              />
              {searchQuery ? (
                <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}>
                  <X size={15} strokeWidth={2.2} />
                </button>
              ) : null}

              {isSearchOpen ? (
                <div className="nurse-search__panel">
                  {searchResults.map((item) => (
                    <button key={item.id} type="button" onClick={() => navigateFromSearch(item.to)}>
                      <span>{item.sectionLabel}</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                  {!searchResults.length ? <div className="nurse-search__empty">Không tìm thấy menu phù hợp.</div> : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="nurse-topbar__quick"
              onClick={() => navigate('/nurse/vitals-records/entry')}
            >
              <HeartPulse size={18} strokeWidth={2.25} />
              <span>Nhập sinh hiệu</span>
            </button>

            <div className="nurse-dropdown" ref={notificationRef}>
              <button
                type="button"
                className="nurse-icon-button"
                aria-label="Mở cảnh báo điều dưỡng"
                aria-expanded={isNotificationOpen}
                onClick={() => setIsNotificationOpen((current) => !current)}
              >
                <Bell size={19} strokeWidth={2.2} />
                <span className="nurse-icon-button__dot" />
              </button>

              {isNotificationOpen ? (
                <div className="nurse-dropdown__panel nurse-dropdown__panel--notifications">
                  <header>
                    <strong>Cảnh báo ca trực</strong>
                    <span>3 mới</span>
                  </header>
                  {[
                    ['Sinh hiệu bất thường', '/nurse/vitals-records/abnormal'],
                    ['Ca cần báo khẩn', '/nurse/monitoring-reporting/urgent-cases'],
                    ['Nhiệm vụ quá hạn', '/nurse/tasks-handover/overdue'],
                  ].map(([label, to]) => (
                    <button
                      key={to}
                      type="button"
                      onClick={() => {
                        setIsNotificationOpen(false);
                        navigate(to);
                      }}
                    >
                      <CheckCircle2 size={16} strokeWidth={2.2} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="nurse-profile" ref={profileRef}>
              <button
                type="button"
                className="nurse-profile__trigger"
                aria-label="Mở menu tài khoản"
                aria-expanded={isProfileOpen}
                onClick={() => setIsProfileOpen((current) => !current)}
              >
                <span className="nurse-avatar">{getInitials(displayName)}</span>
                <span className="nurse-profile__copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>

              {isProfileOpen ? (
                <div className="nurse-profile__panel">
                  <div className="nurse-profile__summary">
                    <span className="nurse-avatar nurse-avatar--large">{getInitials(displayName)}</span>
                    <div>
                      <strong>{displayName}</strong>
                      <span>{auth?.user?.email || auth?.user?.username || 'Tài khoản nhân sự'}</span>
                    </div>
                  </div>
                  <Link to="/staff/select-workspace" onClick={() => setIsProfileOpen(false)}>
                    <UserRound size={16} strokeWidth={2.2} />
                    Chọn không gian khác
                  </Link>
                  <button type="button" onClick={handleLogout}>
                    <LogOut size={16} strokeWidth={2.2} />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="nurse-content">
          {children}
        </div>
      </section>
    </main>
  );
}
