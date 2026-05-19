import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  FileText,
  LogOut,
  Menu,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { getStaffActorName } from '../receptionist/workspaceAccess';
import { flattenReportsMenu, getReportsPageMeta, reportsMenuSections } from './reportsData';

function getInitials(name = '') {
  const initials = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'BC';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getReportsRoleLabel(auth) {
  const roles = auth?.user?.roles || auth?.roles || [];
  if (roles.includes('super_admin')) return 'Quản trị hệ thống';
  if (roles.includes('department_head')) return 'Trưởng khoa';
  if (roles.includes('manager')) return 'Quản lý vận hành';
  if (roles.includes('billing_staff')) return 'Phân tích tài chính';
  return 'Báo cáo và phân tích';
}

function ReportsNavLink({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      end
      to={item.to}
      title={item.label}
      className={({ isActive }) => `reports-nav-link${isActive ? ' is-active' : ''}`}
      onClick={onNavigate}
    >
      <span className="reports-nav-link__icon" aria-hidden="true">
        <Icon size={collapsed ? 18 : 15} strokeWidth={2.2} />
      </span>
      {!collapsed ? <span className="reports-nav-link__label">{item.label}</span> : null}
    </NavLink>
  );
}

export function ReportsShell({ children }) {
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
    Object.fromEntries(reportsMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );

  const allMenuItems = useMemo(() => flattenReportsMenu(), []);
  const currentPage = getReportsPageMeta(location.pathname);
  const displayName = getStaffActorName(auth);
  const roleLabel = getReportsRoleLabel(auth);

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
    <main className={`reports-workspace${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}${isMobileSidebarOpen ? ' is-mobile-sidebar-open' : ''}`}>
      <aside className="reports-sidebar" aria-label="Menu báo cáo và phân tích">
        <div className="reports-sidebar__brand">
          <Link to="/staff/select-workspace" className="reports-sidebar__brand-link" onClick={closeMobileSidebar}>
            <span className="reports-sidebar__brand-mark" aria-hidden="true">
              <BarChart3 size={25} strokeWidth={2.4} />
            </span>
            {!isSidebarCollapsed ? (
              <span className="reports-sidebar__brand-copy">
                <strong>Báo cáo và phân tích</strong>
                <small>Không gian báo cáo và phân tích</small>
              </span>
            ) : null}
          </Link>
        </div>

        <nav className="reports-sidebar__nav">
          {reportsMenuSections.map((section) => {
            const Icon = section.icon;
            const isOpen = Boolean(openSections[section.id]) && !isSidebarCollapsed;
            const isActive = section.children?.some((item) => item.to === location.pathname);

            return (
              <div key={section.id} className={`reports-nav-group${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}>
                <button
                  type="button"
                  className="reports-nav-group__trigger"
                  title={section.label}
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="reports-nav-group__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  {!isSidebarCollapsed ? <span className="reports-nav-group__label">{section.label}</span> : null}
                  {!isSidebarCollapsed ? (
                    <ChevronDown className="reports-nav-group__chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
                  ) : null}
                </button>

                {isOpen ? (
                  <div className="reports-nav-group__children">
                    {section.children.map((item) => (
                      <ReportsNavLink
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

        <div className="reports-sidebar__footer">
          {!isSidebarCollapsed ? (
            <Link to="/reports/executive-overview/abnormal-alerts" className="reports-sidebar__alert" onClick={closeMobileSidebar}>
              <Bell size={17} strokeWidth={2.2} />
              <span>
                <strong>5 cảnh báo chỉ số</strong>
                <small>Bất thường, mức dịch vụ, nguy cấp</small>
              </span>
            </Link>
          ) : null}

          <button
            type="button"
            className="reports-sidebar__collapse"
            aria-label={isSidebarCollapsed ? 'Mở rộng menu bên' : 'Thu gọn menu bên'}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <ChevronsLeft className={isSidebarCollapsed ? 'is-rotated' : ''} size={18} strokeWidth={2.2} />
            {!isSidebarCollapsed ? <span>Thu gọn</span> : null}
          </button>
        </div>
      </aside>

      <div className="reports-mobile-backdrop" onClick={closeMobileSidebar} />

      <section className="reports-main">
        <header className="reports-topbar">
          <div className="reports-topbar__left">
            <button
              type="button"
              className="reports-icon-button reports-topbar__menu"
              aria-label="Mở menu báo cáo và phân tích"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu size={20} strokeWidth={2.2} />
            </button>
            <div className="reports-topbar__title">
              <span>{currentPage.sectionLabel}</span>
              <strong>{currentPage.label}</strong>
            </div>
          </div>

          <div className="reports-topbar__tools">
            <div className={`reports-search${isSearchOpen ? ' is-open' : ''}`} ref={searchRef}>
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Tìm menu báo cáo và phân tích"
                aria-label="Tìm menu báo cáo và phân tích"
              />
              {searchQuery ? (
                <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}>
                  <X size={15} strokeWidth={2.2} />
                </button>
              ) : null}

              {isSearchOpen ? (
                <div className="reports-search__panel">
                  {searchResults.map((item) => (
                    <button key={item.id} type="button" onClick={() => navigateFromSearch(item.to)}>
                      <span>{item.sectionLabel}</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                  {!searchResults.length ? <div className="reports-search__empty">Không tìm thấy menu phù hợp.</div> : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="reports-topbar__quick"
              onClick={() => navigate('/reports/exports/excel')}
            >
              <FileText size={18} strokeWidth={2.25} />
              <span>Xuất tệp Excel</span>
            </button>

            <div className="reports-dropdown" ref={notificationRef}>
              <button
                type="button"
                className="reports-icon-button"
                aria-label="Mở cảnh báo chỉ số"
                aria-expanded={isNotificationOpen}
                onClick={() => setIsNotificationOpen((current) => !current)}
              >
                <Bell size={19} strokeWidth={2.2} />
                <span className="reports-icon-button__dot" />
              </button>

              {isNotificationOpen ? (
                <div className="reports-dropdown__panel reports-dropdown__panel--notifications">
                  <header>
                    <strong>Cảnh báo chỉ số</strong>
                    <span>5 mới</span>
                  </header>
                  {[
                    ['Cảnh báo bất thường', '/reports/executive-overview/abnormal-alerts'],
                    ['Cảnh báo nguy cấp', '/reports/quality-risk/critical-alerts'],
                    ['Cam kết mức dịch vụ', '/reports/quality-risk/service-commitment'],
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

            <div className="reports-profile" ref={profileRef}>
              <button
                type="button"
                className="reports-profile__trigger"
                aria-label="Mở menu tài khoản"
                aria-expanded={isProfileOpen}
                onClick={() => setIsProfileOpen((current) => !current)}
              >
                <span className="reports-avatar">{getInitials(displayName)}</span>
                <span className="reports-profile__copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>

              {isProfileOpen ? (
                <div className="reports-profile__panel">
                  <div className="reports-profile__summary">
                    <span className="reports-avatar reports-avatar--large">{getInitials(displayName)}</span>
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

        <div className="reports-content">
          {children}
        </div>
      </section>
    </main>
  );
}
