import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  LogOut,
  Menu,
  PackageCheck,
  Pill,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { getStaffActorName } from '../receptionist/workspaceAccess';
import {
  flattenPharmacyMenu,
  getPharmacyPageMeta,
  pharmacyMenuSections,
  pharmacyNotifications,
} from './pharmacyData';

const PharmacyWorkspaceContext = createContext(null);

export function usePharmacyWorkspace() {
  return useContext(PharmacyWorkspaceContext) || {
    user: {},
    roles: [],
    permissions: [],
    session: null,
    loading: false,
    errors: {},
    refreshIdentity: () => {},
  };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getInitials(name = '') {
  const initials = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'DS';
}

function getRoleLabel(auth) {
  const roles = auth?.user?.roles || auth?.roles || [];
  if (roles.includes('super_admin')) return 'Quản trị hệ thống';
  if (roles.includes('inventory_staff')) return 'Quản lý kho dược';
  if (roles.includes('pharmacy_manager')) return 'Quản lý nhà thuốc';
  if (roles.includes('pharmacist')) return 'Dược sĩ';
  return 'Nhà thuốc và kho dược';
}

function PharmacyNavLink({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      end
      to={item.to}
      title={item.label}
      className={({ isActive }) => `pharmacy-v2-nav-link${isActive ? ' is-active' : ''}`}
      onClick={onNavigate}
    >
      <span className="pharmacy-v2-nav-link__icon" aria-hidden="true">
        <Icon size={collapsed ? 18 : 15} strokeWidth={2.2} />
      </span>
      {!collapsed ? <span className="pharmacy-v2-nav-link__label">{item.label}</span> : null}
    </NavLink>
  );
}

export function PharmacyShell({ children }) {
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
    Object.fromEntries(pharmacyMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );

  const allMenuItems = useMemo(() => flattenPharmacyMenu(), []);
  const currentPage = getPharmacyPageMeta(location.pathname);
  const displayName = getStaffActorName(auth);
  const roleLabel = getRoleLabel(auth);
  const notifications = pharmacyNotifications;

  const searchResults = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!query) return allMenuItems.slice(0, 8);

    return allMenuItems
      .filter((item) => normalizeText(`${item.label} ${item.groupLabel}`).includes(query))
      .slice(0, 10);
  }, [allMenuItems, searchQuery]);

  useEffect(() => {
    const activeItem = allMenuItems.find((item) => item.to === location.pathname);
    if (!activeItem?.groupLabel) return;

    const activeSection = pharmacyMenuSections.find((section) => section.label === activeItem.groupLabel);
    if (!activeSection) return;

    setOpenSections((current) => ({
      ...current,
      [activeSection.id]: true,
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

  const contextValue = {
    user: auth?.user || {},
    roles: auth?.user?.roles || auth?.roles || [],
    permissions: auth?.user?.permissions || auth?.permissions || [],
    session: null,
    loading: false,
    errors: {},
    refreshIdentity: () => {},
  };

  return (
    <PharmacyWorkspaceContext.Provider value={contextValue}>
      <main className={`pharmacy-v2-workspace${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}${isMobileSidebarOpen ? ' is-mobile-sidebar-open' : ''}`}>
        <aside className="pharmacy-v2-sidebar" aria-label="Menu nhà thuốc và kho dược">
          <div className="pharmacy-v2-sidebar__brand">
            <Link to="/staff/select-workspace" className="pharmacy-v2-sidebar__brand-link" onClick={closeMobileSidebar}>
              <span className="pharmacy-v2-sidebar__brand-mark" aria-hidden="true">
                <Pill size={25} strokeWidth={2.4} />
              </span>
              {!isSidebarCollapsed ? (
                <span className="pharmacy-v2-sidebar__brand-copy">
                  <strong>Nhà thuốc và kho dược</strong>
                  <small>Không gian nhà thuốc và kho dược</small>
                </span>
              ) : null}
            </Link>
          </div>

          <nav className="pharmacy-v2-sidebar__nav">
            {pharmacyMenuSections.map((section) => {
              const Icon = section.icon;
              const isOpen = Boolean(openSections[section.id]) && !isSidebarCollapsed;
              const isActive = section.children?.some((item) => item.to === location.pathname);

              return (
                <div key={section.id} className={`pharmacy-v2-nav-group${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    className="pharmacy-v2-nav-group__trigger"
                    title={section.label}
                    aria-expanded={isOpen}
                    onClick={() => toggleSection(section.id)}
                  >
                    <span className="pharmacy-v2-nav-group__icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={2.2} />
                    </span>
                    {!isSidebarCollapsed ? <span className="pharmacy-v2-nav-group__label">{section.label}</span> : null}
                    {!isSidebarCollapsed ? (
                      <ChevronDown className="pharmacy-v2-nav-group__chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
                    ) : null}
                  </button>

                  {isOpen ? (
                    <div className="pharmacy-v2-nav-group__children">
                      {section.children.map((item) => (
                        <PharmacyNavLink
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

          <div className="pharmacy-v2-sidebar__footer">
            {!isSidebarCollapsed ? (
              <Link to="/pharmacy/alerts/low-stock" className="pharmacy-v2-sidebar__alert" onClick={closeMobileSidebar}>
                <Bell size={17} strokeWidth={2.2} />
                <span>
                  <strong>8 cảnh báo dược</strong>
                  <small>Sắp hết thuốc, hết hạn, dị ứng</small>
                </span>
              </Link>
            ) : null}

            <button
              type="button"
              className="pharmacy-v2-sidebar__collapse"
              aria-label={isSidebarCollapsed ? 'Mở rộng menu bên' : 'Thu gọn menu bên'}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
            >
              <ChevronsLeft className={isSidebarCollapsed ? 'is-rotated' : ''} size={18} strokeWidth={2.2} />
              {!isSidebarCollapsed ? <span>Thu gọn</span> : null}
            </button>
          </div>
        </aside>

        <div className="pharmacy-v2-mobile-backdrop" onClick={closeMobileSidebar} />

        <section className="pharmacy-v2-main">
          <header className="pharmacy-v2-topbar">
            <div className="pharmacy-v2-topbar__left">
              <button
                type="button"
                className="pharmacy-v2-icon-button pharmacy-v2-topbar__menu"
                aria-label="Mở menu nhà thuốc"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu size={20} strokeWidth={2.2} />
              </button>
              <div className="pharmacy-v2-topbar__title">
                <span>{currentPage.groupLabel}</span>
                <strong>{currentPage.label}</strong>
              </div>
            </div>

            <div className="pharmacy-v2-topbar__tools">
              <div className={`pharmacy-v2-search${isSearchOpen ? ' is-open' : ''}`} ref={searchRef}>
                <Search size={17} strokeWidth={2.2} aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Tìm menu nhà thuốc và kho dược"
                  aria-label="Tìm menu nhà thuốc và kho dược"
                />
                {searchQuery ? (
                  <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}>
                    <X size={15} strokeWidth={2.2} />
                  </button>
                ) : null}

                {isSearchOpen ? (
                  <div className="pharmacy-v2-search__panel">
                    {searchResults.map((item) => (
                      <button key={item.id} type="button" onClick={() => navigateFromSearch(item.to)}>
                        <span>{item.groupLabel}</span>
                        <strong>{item.label}</strong>
                      </button>
                    ))}
                    {!searchResults.length ? <div className="pharmacy-v2-search__empty">Không tìm thấy menu phù hợp.</div> : null}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="pharmacy-v2-topbar__quick"
                onClick={() => navigate('/pharmacy/dispensing/queue')}
              >
                <PackageCheck size={18} strokeWidth={2.25} />
              <span>Hàng đợi cấp phát</span>
              </button>

              <div className="pharmacy-v2-dropdown" ref={notificationRef}>
                <button
                  type="button"
                  className="pharmacy-v2-icon-button"
                  aria-label="Mở cảnh báo dược"
                  aria-expanded={isNotificationOpen}
                  onClick={() => setIsNotificationOpen((current) => !current)}
                >
                  <Bell size={19} strokeWidth={2.2} />
                  <span className="pharmacy-v2-icon-button__dot" />
                </button>

                {isNotificationOpen ? (
                  <div className="pharmacy-v2-dropdown__panel pharmacy-v2-dropdown__panel--notifications">
                    <header>
                      <strong>Cảnh báo dược</strong>
                      <span>{notifications.length} mới</span>
                    </header>
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIsNotificationOpen(false);
                          navigate(item.to);
                        }}
                      >
                        <CheckCircle2 size={16} strokeWidth={2.2} />
                        <span>{item.title}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="pharmacy-v2-profile" ref={profileRef}>
                <button
                  type="button"
                  className="pharmacy-v2-profile__trigger"
                  aria-label="Mở menu tài khoản"
                  aria-expanded={isProfileOpen}
                  onClick={() => setIsProfileOpen((current) => !current)}
                >
                  <span className="pharmacy-v2-avatar">{getInitials(displayName)}</span>
                  <span className="pharmacy-v2-profile__copy">
                    <strong>{displayName}</strong>
                    <small>{roleLabel}</small>
                  </span>
                  <ChevronDown size={16} strokeWidth={2.2} />
                </button>

                {isProfileOpen ? (
                  <div className="pharmacy-v2-profile__panel">
                    <div className="pharmacy-v2-profile__summary">
                      <span className="pharmacy-v2-avatar pharmacy-v2-avatar--large">{getInitials(displayName)}</span>
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

          <div className="pharmacy-v2-content">
            {children}
          </div>
        </section>
      </main>
    </PharmacyWorkspaceContext.Provider>
  );
}
