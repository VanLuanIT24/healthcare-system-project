import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  LogOut,
  Menu,
  Pill,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { authAPI, getApiErrorMessage, notificationAPI } from '../utils/api';
import {
  flattenPharmacyMenu,
  pharmacyQuickActions,
  pharmacyMenuSections,
  pharmacyNotifications,
} from './pharmacyData';
import {
  hasAnyPermission,
  loadPharmacyIdentity,
  readItems,
  searchPharmacyWorkspace,
} from './pharmacyApi';

const NOTIFICATION_STORAGE_KEY = 'healthcare.pharmacy.notifications';

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

function getRoleLabel(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  if (roles.includes('super_admin')) return 'Super Admin';
  if (roles.includes('pharmacy_manager')) return 'Pharmacy Manager';
  if (roles.includes('inventory_staff')) return 'Quản lý tồn kho';
  if (roles.includes('pharmacist')) return 'Dược sĩ chính';
  return 'Dược sĩ';
}

function readStoredNotifications() {
  try {
    const rawValue = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const storedItems = rawValue ? JSON.parse(rawValue) : null;
    return Array.isArray(storedItems) && storedItems.length ? storedItems : pharmacyNotifications;
  } catch (error) {
    return pharmacyNotifications;
  }
}

function storeNotifications(items) {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
  } catch (error) {
    // Ignore storage failures in private browsing.
  }
}

function PharmacyBadge({ value, tone = 'neutral' }) {
  if (!value) return null;
  return <span className={`pharmacy-nav-badge is-${tone}`}>{value}</span>;
}

function PharmacyNavLink({ item, nested = false, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      end
      to={item.to}
      title={item.label}
      className={({ isActive }) =>
        `pharmacy-nav-link${nested ? ' is-nested' : ''}${isActive ? ' is-active' : ''}`
      }
      onClick={onNavigate}
    >
      <span className="pharmacy-nav-icon" aria-hidden="true">
        <Icon size={nested ? 14 : 17} strokeWidth={2.15} />
      </span>
      <span className="pharmacy-nav-text">{item.label}</span>
      <PharmacyBadge value={item.badge} tone={item.badgeTone} />
    </NavLink>
  );
}

export function PharmacyShell({ children }) {
  const auth = readStoredAuth();
  const user = auth?.user || {};
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const quickActionRef = useRef(null);
  const profileRef = useRef(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(pharmacyMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(readStoredNotifications);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [remoteSearchState, setRemoteSearchState] = useState({ loading: false, groups: [], error: '' });
  const [identity, setIdentity] = useState({
    user,
    roles: Array.isArray(user?.roles) ? user.roles : [],
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
    session: null,
    unreadCount: 0,
    loading: true,
    errors: {},
  });

  const activeUser = identity.user || user;
  const activePermissions = identity.permissions?.length ? identity.permissions : (user?.permissions || []);
  const displayName = activeUser?.full_name || activeUser?.fullName || activeUser?.username || 'Dược sĩ Minh Anh';
  const roleLabel = identity.roles?.length ? getRoleLabel({ roles: identity.roles }) : getRoleLabel(activeUser);
  const unreadCount = Math.max(Number(identity.unreadCount || 0), notifications.filter((item) => !item.read).length);

  function canShowItem(item) {
    if (!item?.permissionAny?.length) return true;
    if (identity.loading || identity.errors?.permissions) return true;
    return hasAnyPermission(activePermissions, item.permissionAny);
  }

  const visibleMenuSections = useMemo(
    () =>
      pharmacyMenuSections
        .map((section) => {
          if (!section.children?.length) return canShowItem(section) ? section : null;

          const children = section.children.filter(canShowItem);
          if (!children.length) return null;
          return { ...section, children };
        })
        .filter(Boolean),
    [activePermissions, identity.errors?.permissions, identity.loading],
  );

  const visibleQuickActions = useMemo(
    () => pharmacyQuickActions.filter(canShowItem),
    [activePermissions, identity.errors?.permissions, identity.loading],
  );

  const searchItems = useMemo(() => flattenPharmacyMenu(visibleMenuSections), [visibleMenuSections]);
  const searchResults = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!query) return searchItems.slice(0, 8);

    return searchItems
      .filter((item) => normalizeText(`${item.label} ${item.groupLabel || ''} ${item.hint || ''}`).includes(query))
      .slice(0, 8);
  }, [searchItems, searchQuery]);

  async function refreshIdentity() {
    setIdentity((current) => ({ ...current, loading: true }));
    try {
      const nextIdentity = await loadPharmacyIdentity();
      setIdentity({
        ...nextIdentity,
        loading: false,
      });
    } catch (error) {
      setIdentity((current) => ({
        ...current,
        loading: false,
        errors: {
          ...(current.errors || {}),
          me: getApiErrorMessage(error, 'Không thể tải thông tin tài khoản.'),
        },
      }));
    }
  }

  useEffect(() => {
    storeNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    refreshIdentity();
  }, []);

  useEffect(() => {
    const keyword = searchQuery.trim();
    if (keyword.length < 2) {
      setRemoteSearchState({ loading: false, groups: [], error: '' });
      return undefined;
    }

    let isActive = true;
    const timer = window.setTimeout(async () => {
      setRemoteSearchState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const groups = await searchPharmacyWorkspace(keyword);
        if (isActive) {
          setRemoteSearchState({ loading: false, groups, error: '' });
        }
      } catch (error) {
        if (isActive) {
          setRemoteSearchState({
            loading: false,
            groups: [],
            error: getApiErrorMessage(error, 'Không thể tìm kiếm dữ liệu nhà thuốc.'),
          });
        }
      }
    }, 320);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
      if (quickActionRef.current && !quickActionRef.current.contains(event.target)) {
        setIsQuickActionOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
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
        setIsNotificationOpen(false);
        setIsQuickActionOpen(false);
        setIsProfileOpen(false);
        setIsMobileSidebarOpen(false);
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
    setIsSearchOpen(false);
    setIsNotificationOpen(false);
    setIsQuickActionOpen(false);
    setIsProfileOpen(false);
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  function closeFloatingUi() {
    setIsSearchOpen(false);
    setIsNotificationOpen(false);
    setIsQuickActionOpen(false);
    setIsProfileOpen(false);
  }

  function handleSidebarToggle() {
    const isNarrow = window.matchMedia?.('(max-width: 1080px)').matches;

    if (isNarrow) {
      setIsMobileSidebarOpen((current) => !current);
      return;
    }

    setIsSidebarCollapsed((current) => !current);
  }

  function handleNavigate(to) {
    navigate(to);
    setSearchQuery('');
    closeFloatingUi();
  }

  function handleSearchKeyDown(event) {
    if (event.key !== 'Enter') return;
    const [firstResult] = searchResults;
    if (!firstResult) return;

    event.preventDefault();
    handleNavigate(firstResult.to);
  }

  async function loadNotifications({ force = false } = {}) {
    if (!force && notificationLoading) return;
    setNotificationLoading(true);
    setNotificationError('');
    try {
      const response = await notificationAPI.listMine({ limit: 8 });
      const items = readItems(response);
      setNotifications(items.length ? items.map((item) => ({
        id: item.notification_id || item._id || item.id,
        title: item.title || 'Thông báo nhà thuốc',
        body: item.message || item.body || item.description || '',
        time: item.occurred_at || item.created_at || item.time || 'Gần đây',
        tone: item.tone || item.severity || 'info',
        read: Boolean(item.is_read ?? item.read),
        to: item.path || item.to || '/pharmacy/overview',
      })) : pharmacyNotifications);
    } catch (error) {
      setNotificationError(getApiErrorMessage(error, 'Không thể tải thông báo.'));
    } finally {
      setNotificationLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await authAPI.logout(auth?.tokens?.refresh_token);
    } catch (error) {
      // Local logout still proceeds when the API session has already expired.
    }
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  async function markAllNotificationsRead() {
    try {
      await notificationAPI.markAllRead({ limit: 8 });
    } catch (error) {
      setNotificationError(getApiErrorMessage(error, 'Không thể đánh dấu đã đọc.'));
    }
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setIdentity((current) => ({ ...current, unreadCount: 0 }));
  }

  async function handleNotificationClick(item) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === item.id ? { ...notification, read: true } : notification,
      ),
    );
    setIdentity((current) => ({
      ...current,
      unreadCount: Math.max(Number(current.unreadCount || 0) - 1, 0),
    }));
    try {
      if (item.id) {
        await notificationAPI.markRead(item.id);
      }
    } catch (error) {
      // The UI has already acknowledged the item locally.
    }
    handleNavigate(item.to || '/pharmacy/overview');
  }

  const shellClassName = [
    'pharmacy-shell',
    isSidebarCollapsed ? 'is-sidebar-collapsed' : '',
    isMobileSidebarOpen ? 'is-sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const workspaceValue = {
    user: activeUser,
    roles: identity.roles || [],
    permissions: activePermissions || [],
    session: identity.session,
    loading: identity.loading,
    errors: identity.errors || {},
    refreshIdentity,
  };

  return (
    <PharmacyWorkspaceContext.Provider value={workspaceValue}>
    <div className={shellClassName}>
      <aside className="pharmacy-sidebar" aria-label="Điều hướng Pharmacy Workspace">
        <div className="pharmacy-brand">
          <Link className="pharmacy-brand-mark" to="/pharmacy/overview" aria-label="Pharmacy Workspace">
            <Pill size={20} strokeWidth={2.35} aria-hidden="true" />
          </Link>
          <div className="pharmacy-brand-copy">
            <strong>Pharmacy Workspace</strong>
          </div>
          <button
            type="button"
            className="pharmacy-sidebar-collapse"
            aria-label={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            onClick={handleSidebarToggle}
          >
            {isMobileSidebarOpen ? (
              <X size={17} strokeWidth={2.3} aria-hidden="true" />
            ) : (
              <ChevronsLeft size={17} strokeWidth={2.3} aria-hidden="true" />
            )}
          </button>
        </div>

        <nav className="pharmacy-nav">
          {visibleMenuSections.map((section) => {
            const Icon = section.icon;
            const hasChildren = section.children?.length > 0;
            const isOpen = openGroups[section.id];
            const isActiveGroup = hasChildren
              ? section.children.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
              : location.pathname === section.to;

            if (!hasChildren) {
              return (
                <div className="pharmacy-nav-section" key={section.id}>
                  <span className="pharmacy-nav-order">{section.order}</span>
                  <PharmacyNavLink item={section} onNavigate={() => setIsMobileSidebarOpen(false)} />
                </div>
              );
            }

            return (
              <div className={`pharmacy-nav-group${isOpen ? ' is-open' : ''}${isActiveGroup ? ' is-active' : ''}`} key={section.id}>
                <button
                  type="button"
                  className="pharmacy-nav-group-trigger"
                  aria-expanded={isOpen}
                  aria-controls={`pharmacy-nav-${section.id}`}
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [section.id]: !current[section.id],
                    }))
                  }
                >
                  <span className="pharmacy-nav-order">{section.order}</span>
                  <span className="pharmacy-nav-icon" aria-hidden="true">
                    <Icon size={17} strokeWidth={2.15} />
                  </span>
                  <span className="pharmacy-nav-text">{section.label}</span>
                  {isOpen ? (
                    <ChevronUp size={14} strokeWidth={2.4} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                  )}
                </button>

                {isOpen ? (
                  <div className="pharmacy-subnav" id={`pharmacy-nav-${section.id}`}>
                    {section.children.map((item) => (
                      <PharmacyNavLink
                        key={item.id}
                        item={item}
                        nested
                        onNavigate={() => setIsMobileSidebarOpen(false)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      {isMobileSidebarOpen ? (
        <button
          type="button"
          className="pharmacy-sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      ) : null}

      <section className="pharmacy-main">
        <header className="pharmacy-topbar">
          <button
            type="button"
            className="pharmacy-topbar-menu"
            aria-label={isSidebarCollapsed || isMobileSidebarOpen ? 'Mở menu' : 'Thu gọn menu'}
            onClick={handleSidebarToggle}
          >
            {isMobileSidebarOpen ? (
              <X size={20} strokeWidth={2.25} aria-hidden="true" />
            ) : (
              <Menu size={20} strokeWidth={2.25} aria-hidden="true" />
            )}
          </button>

          <div className="pharmacy-search-wrap" ref={searchRef}>
            <label className={`pharmacy-search${isSearchOpen ? ' is-open' : ''}`}>
              <Search size={17} strokeWidth={2.25} aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                placeholder="Tìm kiếm đơn thuốc, bệnh nhân, thuốc..."
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
                  className="pharmacy-search-clear"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                >
                  <X size={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
              ) : (
                <kbd>⌘ K</kbd>
              )}
            </label>

            {isSearchOpen ? (
              <div className="pharmacy-search-panel" role="listbox" aria-label="Kết quả tìm kiếm nhanh">
                <header>
                  <strong>{searchQuery ? `Kết quả cho "${searchQuery}"` : 'Truy cập nhanh'}</strong>
                </header>
                {searchResults.length ? (
                  <div className="pharmacy-search-results">
                    {searchResults.map((item) => {
                      const Icon = item.icon || item.groupIcon;

                      return (
                        <button key={`${item.groupLabel || 'main'}-${item.to}`} type="button" onClick={() => handleNavigate(item.to)}>
                          <span aria-hidden="true">
                            <Icon size={16} strokeWidth={2.2} />
                          </span>
                          <div>
                            <strong>{item.label}</strong>
                            <small>{item.groupLabel || item.hint || 'Pharmacy Workspace'}</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {remoteSearchState.loading ? (
                  <div className="pharmacy-search-state">Đang tìm trong dữ liệu nhà thuốc...</div>
                ) : null}

                {remoteSearchState.error ? (
                  <div className="pharmacy-search-state is-error">{remoteSearchState.error}</div>
                ) : null}

                {remoteSearchState.groups.length ? (
                  <div className="pharmacy-search-remote">
                    {remoteSearchState.groups.map((group) => (
                      <section key={group.id}>
                        <strong>{group.label}</strong>
                        <div className="pharmacy-search-results">
                          {group.items.map((item) => (
                            <button key={`${group.id}-${item.id}`} type="button" onClick={() => handleNavigate(item.to)}>
                              <span aria-hidden="true">
                                <Search size={16} strokeWidth={2.2} />
                              </span>
                              <div>
                                <strong>{item.title}</strong>
                                <small>{item.meta || group.label}</small>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : null}

                {!searchResults.length && !remoteSearchState.loading && !remoteSearchState.groups.length ? (
                  <div className="pharmacy-empty-search">
                    <Search size={18} strokeWidth={2.3} aria-hidden="true" />
                    <span>Không tìm thấy màn hình phù hợp.</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="pharmacy-topbar-actions">
            {visibleQuickActions.length ? (
              <div className="pharmacy-quick-action" ref={quickActionRef}>
                <button
                  type="button"
                  className="pharmacy-quick-action-trigger"
                  aria-label="Thao tác nhanh"
                  aria-expanded={isQuickActionOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setIsQuickActionOpen((current) => !current);
                    setIsNotificationOpen(false);
                    setIsProfileOpen(false);
                  }}
                >
                  <Plus size={17} strokeWidth={2.35} aria-hidden="true" />
                  <span>Thao tác</span>
                </button>

                {isQuickActionOpen ? (
                  <div className="pharmacy-floating-menu pharmacy-quick-action-menu" role="menu">
                    {visibleQuickActions.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button key={item.id} type="button" role="menuitem" onClick={() => handleNavigate(item.to)}>
                          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="pharmacy-notification" ref={notificationRef}>
              <button
                type="button"
                className="pharmacy-icon-button"
                aria-label="Thông báo"
                aria-expanded={isNotificationOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setIsNotificationOpen((current) => {
                    const nextOpen = !current;
                    if (nextOpen) loadNotifications();
                    return nextOpen;
                  });
                  setIsQuickActionOpen(false);
                  setIsProfileOpen(false);
                }}
              >
                <Bell size={18} strokeWidth={2.25} aria-hidden="true" />
                {unreadCount ? <span>{unreadCount}</span> : null}
              </button>

              {isNotificationOpen ? (
                <div className="pharmacy-floating-menu pharmacy-notification-menu" role="menu">
                  <header>
                    <div>
                      <strong>Thông báo</strong>
                      <span>{unreadCount ? `${unreadCount} chưa đọc` : 'Không có thông báo mới'}</span>
                    </div>
                    <button type="button" onClick={markAllNotificationsRead}>
                      <CheckCheck size={15} strokeWidth={2.35} aria-hidden="true" />
                      Đã đọc
                    </button>
                  </header>
                  <div className="pharmacy-notification-list">
                    {notificationLoading ? (
                      <div className="pharmacy-search-state">Đang tải thông báo...</div>
                    ) : null}
                    {notificationError ? (
                      <div className="pharmacy-search-state is-error">{notificationError}</div>
                    ) : null}
                    {!notificationLoading && !notifications.length ? (
                      <div className="pharmacy-search-state">Chưa có thông báo.</div>
                    ) : null}
                    {notifications.map((item) => (
                      <button
                        type="button"
                        role="menuitem"
                        key={item.id}
                        className={item.read ? '' : 'is-unread'}
                        onClick={() => handleNotificationClick(item)}
                      >
                        <span className={`pharmacy-notification-dot is-${item.tone}`} />
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

            <div className="pharmacy-profile" ref={profileRef}>
              <button
                type="button"
                className="pharmacy-profile-trigger"
                aria-label="Tài khoản dược sĩ"
                aria-expanded={isProfileOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setIsProfileOpen((current) => !current);
                  setIsNotificationOpen(false);
                }}
              >
                <span className="pharmacy-avatar" aria-hidden="true">{getInitials(displayName)}</span>
                <span className="pharmacy-profile-copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
              </button>

              {isProfileOpen ? (
                <div className="pharmacy-floating-menu pharmacy-profile-menu" role="menu">
                  <div className="pharmacy-profile-card">
                    <span className="pharmacy-avatar is-large" aria-hidden="true">{getInitials(displayName)}</span>
                    <div>
                      <strong>{displayName}</strong>
                      <small>{roleLabel}</small>
                    </div>
                  </div>
                  <Link to="/staff/select-workspace" role="menuitem" onClick={closeFloatingUi}>
                    <UserRound size={16} strokeWidth={2.25} aria-hidden="true" />
                    Chuyển workspace
                  </Link>
                  <button type="button" role="menuitem" onClick={handleLogout}>
                    <LogOut size={16} strokeWidth={2.25} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="pharmacy-content">{children}</main>
      </section>
    </div>
    </PharmacyWorkspaceContext.Provider>
  );
}
