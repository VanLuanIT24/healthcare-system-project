import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  LogOut,
  Menu,
  Search,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { getStaffActorName } from '../receptionist/workspaceAccess';
import { billingMenuSections, flattenBillingMenu, getBillingPageMeta } from './billingData';

function getInitials(name = '') {
  const initials = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'VP';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getBillingRoleLabel(auth) {
  const roles = auth?.user?.roles || auth?.roles || [];
  if (roles.includes('super_admin')) return 'Quản trị hệ thống';
  if (roles.includes('manager')) return 'Quản lý viện phí';
  if (roles.includes('insurance_staff')) return 'Nhân sự bảo hiểm';
  if (roles.includes('billing_staff')) return 'Nhân sự viện phí';
  return 'Thu ngân';
}

function BillingNavLink({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      end
      to={item.to}
      title={item.label}
      className={({ isActive }) => `billing-nav-link${isActive ? ' is-active' : ''}`}
      onClick={onNavigate}
    >
      <span className="billing-nav-link__icon" aria-hidden="true">
        <Icon size={collapsed ? 18 : 15} strokeWidth={2.2} />
      </span>
      {!collapsed ? <span className="billing-nav-link__label">{item.label}</span> : null}
    </NavLink>
  );
}

export function BillingShell({ children }) {
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
    Object.fromEntries(billingMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );

  const allMenuItems = useMemo(() => flattenBillingMenu(), []);
  const currentPage = getBillingPageMeta(location.pathname);
  const displayName = getStaffActorName(auth);
  const roleLabel = getBillingRoleLabel(auth);

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
    <main className={`billing-workspace${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}${isMobileSidebarOpen ? ' is-mobile-sidebar-open' : ''}`}>
      <aside className="billing-sidebar" aria-label="Menu viện phí và thu tiền">
        <div className="billing-sidebar__brand">
          <Link to="/staff/select-workspace" className="billing-sidebar__brand-link" onClick={closeMobileSidebar}>
            <span className="billing-sidebar__brand-mark" aria-hidden="true">
              <WalletCards size={25} strokeWidth={2.4} />
            </span>
            {!isSidebarCollapsed ? (
              <span className="billing-sidebar__brand-copy">
                <strong>Viện phí và thu tiền</strong>
                <small>Không gian viện phí và thu tiền</small>
              </span>
            ) : null}
          </Link>
        </div>

        <nav className="billing-sidebar__nav">
          {billingMenuSections.map((section) => {
            const Icon = section.icon;
            const isOpen = Boolean(openSections[section.id]) && !isSidebarCollapsed;
            const isActive = section.children?.some((item) => item.to === location.pathname);

            return (
              <div key={section.id} className={`billing-nav-group${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}>
                <button
                  type="button"
                  className="billing-nav-group__trigger"
                  title={section.label}
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="billing-nav-group__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  {!isSidebarCollapsed ? <span className="billing-nav-group__label">{section.label}</span> : null}
                  {!isSidebarCollapsed ? (
                    <ChevronDown className="billing-nav-group__chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
                  ) : null}
                </button>

                {isOpen ? (
                  <div className="billing-nav-group__children">
                    {section.children.map((item) => (
                      <BillingNavLink
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

        <div className="billing-sidebar__footer">
          {!isSidebarCollapsed ? (
            <Link to="/billing/overview/payment-errors" className="billing-sidebar__alert" onClick={closeMobileSidebar}>
              <Bell size={17} strokeWidth={2.2} />
              <span>
                <strong>4 cảnh báo viện phí</strong>
                <small>Thanh toán lỗi, quá hạn, sai lệch</small>
              </span>
            </Link>
          ) : null}

          <button
            type="button"
            className="billing-sidebar__collapse"
            aria-label={isSidebarCollapsed ? 'Mở rộng menu bên' : 'Thu gọn menu bên'}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <ChevronsLeft className={isSidebarCollapsed ? 'is-rotated' : ''} size={18} strokeWidth={2.2} />
            {!isSidebarCollapsed ? <span>Thu gọn</span> : null}
          </button>
        </div>
      </aside>

      <div className="billing-mobile-backdrop" onClick={closeMobileSidebar} />

      <section className="billing-main">
        <header className="billing-topbar">
          <div className="billing-topbar__left">
            <button
              type="button"
              className="billing-icon-button billing-topbar__menu"
              aria-label="Mở menu viện phí và thu tiền"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu size={20} strokeWidth={2.2} />
            </button>
            <div className="billing-topbar__title">
              <span>{currentPage.sectionLabel}</span>
              <strong>{currentPage.label}</strong>
            </div>
          </div>

          <div className="billing-topbar__tools">
            <div className={`billing-search${isSearchOpen ? ' is-open' : ''}`} ref={searchRef}>
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Tìm menu viện phí và thu tiền"
                aria-label="Tìm menu viện phí và thu tiền"
              />
              {searchQuery ? (
                <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}>
                  <X size={15} strokeWidth={2.2} />
                </button>
              ) : null}

              {isSearchOpen ? (
                <div className="billing-search__panel">
                  {searchResults.map((item) => (
                    <button key={item.id} type="button" onClick={() => navigateFromSearch(item.to)}>
                      <span>{item.sectionLabel}</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                  {!searchResults.length ? <div className="billing-search__empty">Không tìm thấy menu phù hợp.</div> : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="billing-topbar__quick"
              onClick={() => navigate('/billing/cashier/collect')}
            >
              <WalletCards size={18} strokeWidth={2.25} />
              <span>Thu tiền</span>
            </button>

            <div className="billing-dropdown" ref={notificationRef}>
              <button
                type="button"
                className="billing-icon-button"
                aria-label="Mở cảnh báo viện phí"
                aria-expanded={isNotificationOpen}
                onClick={() => setIsNotificationOpen((current) => !current)}
              >
                <Bell size={19} strokeWidth={2.2} />
                <span className="billing-icon-button__dot" />
              </button>

              {isNotificationOpen ? (
                <div className="billing-dropdown__panel billing-dropdown__panel--notifications">
                  <header>
                    <strong>Cảnh báo viện phí</strong>
                    <span>4 mới</span>
                  </header>
                  {[
                    ['Thanh toán lỗi', '/billing/payments/failed-rejected'],
                    ['Hóa đơn quá hạn', '/billing/invoices/overdue'],
                    ['Sai lệch thanh toán', '/billing/reconciliation/payment-mismatch'],
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

            <div className="billing-profile" ref={profileRef}>
              <button
                type="button"
                className="billing-profile__trigger"
                aria-label="Mở menu tài khoản"
                aria-expanded={isProfileOpen}
                onClick={() => setIsProfileOpen((current) => !current)}
              >
                <span className="billing-avatar">{getInitials(displayName)}</span>
                <span className="billing-profile__copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>

              {isProfileOpen ? (
                <div className="billing-profile__panel">
                  <div className="billing-profile__summary">
                    <span className="billing-avatar billing-avatar--large">{getInitials(displayName)}</span>
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

        <div className="billing-content">
          {children}
        </div>
      </section>
    </main>
  );
}
