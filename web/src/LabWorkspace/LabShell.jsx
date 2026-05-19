import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  FileText,
  FlaskConical,
  LogOut,
  Menu,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { getStaffActorName } from '../receptionist/workspaceAccess';
import {
  flattenLabMenu,
  getLabMenuSectionsForRoles,
  getLabPageMeta,
  getLabRoles,
  labMenuSections,
} from './labData';

function getInitials(name = '') {
  const initials = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'CL';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getLabRoleLabel(auth) {
  const roles = auth?.user?.roles || auth?.roles || [];
  if (roles.includes('super_admin')) return 'Quản trị hệ thống';
  if (roles.includes('lab_manager')) return 'Quản lý cận lâm sàng';
  if (roles.includes('radiologist')) return 'Bác sĩ chẩn đoán hình ảnh';
  if (roles.includes('imaging_technician')) return 'Kỹ thuật viên chẩn đoán hình ảnh';
  if (roles.includes('procedure_staff')) return 'Nhân sự thủ thuật';
  if (roles.includes('doctor')) return 'Bác sĩ';
  if (roles.includes('nurse')) return 'Điều dưỡng';
  return 'Kỹ thuật viên xét nghiệm';
}

function LabNavLink({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      end
      to={item.to}
      title={item.label}
      className={({ isActive }) => `lab-nav-link${isActive ? ' is-active' : ''}`}
      onClick={onNavigate}
    >
      <span className="lab-nav-link__icon" aria-hidden="true">
        <Icon size={collapsed ? 18 : 15} strokeWidth={2.2} />
      </span>
      {!collapsed ? <span className="lab-nav-link__label">{item.label}</span> : null}
    </NavLink>
  );
}

export function LabShell({ children }) {
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
    Object.fromEntries(labMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );

  const roles = getLabRoles(auth);
  const rolesKey = roles.join('|');
  const visibleMenuSections = useMemo(() => getLabMenuSectionsForRoles(roles), [rolesKey]);
  const visibleMenuItems = useMemo(() => flattenLabMenu(visibleMenuSections), [visibleMenuSections]);
  const allMenuItems = useMemo(() => flattenLabMenu(), []);
  const currentPage = getLabPageMeta(location.pathname);
  const displayName = getStaffActorName(auth);
  const roleLabel = getLabRoleLabel(auth);
  const quickAction = useMemo(() => {
    const priorityIds = [
      'tests-result-entry',
      'imaging-upload',
      'procedures-orders',
      'overview-action-items',
      'lookup-by-patient',
      'nursing-patient-preparation',
    ];

    return priorityIds
      .map((id) => visibleMenuItems.find((item) => item.id === id))
      .find(Boolean) || visibleMenuItems[0] || allMenuItems[0];
  }, [allMenuItems, visibleMenuItems]);

  const searchResults = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!query) return visibleMenuItems.slice(0, 8);

    return visibleMenuItems
      .filter((item) => normalizeText(`${item.label} ${item.sectionLabel}`).includes(query))
      .slice(0, 10);
  }, [searchQuery, visibleMenuItems]);

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
    <main className={`lab-workspace${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}${isMobileSidebarOpen ? ' is-mobile-sidebar-open' : ''}`}>
      <aside className="lab-sidebar" aria-label="Menu cận lâm sàng và thủ thuật">
        <div className="lab-sidebar__brand">
          <Link to="/staff/select-workspace" className="lab-sidebar__brand-link" onClick={closeMobileSidebar}>
            <span className="lab-sidebar__brand-mark" aria-hidden="true">
              <FlaskConical size={25} strokeWidth={2.4} />
            </span>
            {!isSidebarCollapsed ? (
              <span className="lab-sidebar__brand-copy">
                <strong>Cận lâm sàng và thủ thuật</strong>
                <small>Không gian cận lâm sàng và thủ thuật</small>
              </span>
            ) : null}
          </Link>
        </div>

        <nav className="lab-sidebar__nav">
          {visibleMenuSections.map((section) => {
            const Icon = section.icon;
            const isOpen = Boolean(openSections[section.id]) && !isSidebarCollapsed;
            const isActive = section.children?.some((item) => item.to === location.pathname);

            return (
              <div key={section.id} className={`lab-nav-group${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}>
                <button
                  type="button"
                  className="lab-nav-group__trigger"
                  title={section.label}
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="lab-nav-group__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  {!isSidebarCollapsed ? <span className="lab-nav-group__label">{section.label}</span> : null}
                  {!isSidebarCollapsed ? (
                    <ChevronDown className="lab-nav-group__chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
                  ) : null}
                </button>

                {isOpen ? (
                  <div className="lab-nav-group__children">
                    {section.children.map((item) => (
                      <LabNavLink
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

        <div className="lab-sidebar__footer">
          {!isSidebarCollapsed ? (
            <Link to="/lab/alerts/critical-unhandled" className="lab-sidebar__alert" onClick={closeMobileSidebar}>
              <Bell size={17} strokeWidth={2.2} />
              <span>
                <strong>7 cảnh báo cận lâm sàng</strong>
                <small>Nguy cấp, quá hạn, thiếu tệp</small>
              </span>
            </Link>
          ) : null}

          <button
            type="button"
            className="lab-sidebar__collapse"
            aria-label={isSidebarCollapsed ? 'Mở rộng menu bên' : 'Thu gọn menu bên'}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <ChevronsLeft className={isSidebarCollapsed ? 'is-rotated' : ''} size={18} strokeWidth={2.2} />
            {!isSidebarCollapsed ? <span>Thu gọn</span> : null}
          </button>
        </div>
      </aside>

      <div className="lab-mobile-backdrop" onClick={closeMobileSidebar} />

      <section className="lab-main">
        <header className="lab-topbar">
          <div className="lab-topbar__left">
            <button
              type="button"
              className="lab-icon-button lab-topbar__menu"
              aria-label="Mở menu cận lâm sàng"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu size={20} strokeWidth={2.2} />
            </button>
            <div className="lab-topbar__title">
              <span>{currentPage.sectionLabel}</span>
              <strong>{currentPage.label}</strong>
            </div>
          </div>

          <div className="lab-topbar__tools">
            <div className={`lab-search${isSearchOpen ? ' is-open' : ''}`} ref={searchRef}>
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Tìm menu cận lâm sàng và thủ thuật"
                aria-label="Tìm menu cận lâm sàng và thủ thuật"
              />
              {searchQuery ? (
                <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}>
                  <X size={15} strokeWidth={2.2} />
                </button>
              ) : null}

              {isSearchOpen ? (
                <div className="lab-search__panel">
                  {searchResults.map((item) => (
                    <button key={item.id} type="button" onClick={() => navigateFromSearch(item.to)}>
                      <span>{item.sectionLabel}</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                  {!searchResults.length ? <div className="lab-search__empty">Không tìm thấy menu phù hợp.</div> : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="lab-topbar__quick"
              onClick={() => navigate(quickAction.to)}
            >
              <FileText size={18} strokeWidth={2.25} />
              <span>{quickAction.label}</span>
            </button>

            <div className="lab-dropdown" ref={notificationRef}>
              <button
                type="button"
                className="lab-icon-button"
                aria-label="Mở cảnh báo cận lâm sàng"
                aria-expanded={isNotificationOpen}
                onClick={() => setIsNotificationOpen((current) => !current)}
              >
                <Bell size={19} strokeWidth={2.2} />
                <span className="lab-icon-button__dot" />
              </button>

              {isNotificationOpen ? (
                <div className="lab-dropdown__panel lab-dropdown__panel--notifications">
                  <header>
                    <strong>Cảnh báo cận lâm sàng</strong>
                    <span>7 mới</span>
                  </header>
                  {[
                    ['Kết quả nguy cấp', '/lab/alerts/critical-unhandled'],
                    ['Chỉ định quá hạn', '/lab/alerts/overdue-orders'],
                    ['Thiếu tệp kết quả', '/lab/alerts/missing-result-files'],
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

            <div className="lab-profile" ref={profileRef}>
              <button
                type="button"
                className="lab-profile__trigger"
                aria-label="Mở menu tài khoản"
                aria-expanded={isProfileOpen}
                onClick={() => setIsProfileOpen((current) => !current)}
              >
                <span className="lab-avatar">{getInitials(displayName)}</span>
                <span className="lab-profile__copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>

              {isProfileOpen ? (
                <div className="lab-profile__panel">
                  <div className="lab-profile__summary">
                    <span className="lab-avatar lab-avatar--large">{getInitials(displayName)}</span>
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

        <div className="lab-content">
          {children}
        </div>
      </section>
    </main>
  );
}
