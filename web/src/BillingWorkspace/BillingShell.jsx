import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  CreditCard,
  FileClock,
  LogOut,
  Menu,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { getStaffActorName } from '../receptionist/workspaceAccess';
import { billingMenuSections, flattenBillingMenu, getBillingPageMeta } from './billingData';
import { billingCashierAPI, getBillingCashierErrorMessage } from './billingCashierApi';

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

const CASHIER_TABS = [
  ['unpaid', 'Chờ thu'],
  ['partial', 'Một phần'],
  ['qr', 'QR / chuyển khoản'],
  ['confirmation', 'Cần xác nhận'],
  ['failed', 'Payment lỗi'],
  ['receipts', 'Biên lai'],
];

const NOTIFICATION_TABS = [
  ['all', 'Tất cả'],
  ['confirmation', 'Payment cần xác nhận'],
  ['failed', 'Payment lỗi'],
  ['overdue', 'Quá hạn'],
  ['mismatch', 'Sai lệch'],
  ['refund', 'Refund / void'],
  ['claim', 'Claim'],
  ['system', 'Hệ thống'],
];

const SEARCH_GROUPS = {
  patients: 'Bệnh nhân',
  invoices: 'Hóa đơn',
  charges: 'Charge',
  payments: 'Payment',
  payment_intents: 'Payment intent',
  receipts: 'Biên lai',
  insurance_claims: 'Bảo hiểm',
  menus: 'Menu',
};

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return `${toNumber(value).toLocaleString('vi-VN')} đ`;
}

function compactNumber(value) {
  const number = toNumber(value);
  if (number >= 1000) return `${Math.round(number / 100) / 10}k`;
  return String(number);
}

function relativeTime(value) {
  if (!value) return 'chưa đồng bộ';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'chưa đồng bộ';
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s trước`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function invoiceId(item = {}) {
  return item.invoice?.id || item.id || item.invoice_id;
}

function invoiceNo(item = {}) {
  return item.invoice?.invoice_no || item.invoice_no || 'Hóa đơn';
}

function invoiceBalance(item = {}) {
  return item.invoice?.balance_due ?? item.balance_due ?? 0;
}

function patientName(item = {}) {
  return item.patient?.full_name || item.invoice?.patient?.full_name || 'Chưa có bệnh nhân';
}

function patientCode(item = {}) {
  return item.patient?.patient_code || item.invoice?.patient?.patient_code || 'BN';
}

function normalizeSearchItem(group, item) {
  if (item.title) return item;
  if (group === 'patients') {
    const patient = item.patient || item;
    return {
      id: patient.id || patient._id || patient.patient_code,
      title: patient.full_name || 'Bệnh nhân',
      subtitle: `${patient.patient_code || 'BN'} · Công nợ ${formatMoney(item.debt?.balance_due)}`,
      route: patient.id ? `/billing/cashier/search-invoice-patient?patient_id=${patient.id}` : '/billing/cashier/search-invoice-patient',
    };
  }
  if (group === 'invoices') {
    const invoice = item.invoice || item;
    return {
      id: invoice.id || invoice._id || invoice.invoice_no,
      title: invoice.invoice_no || 'Hóa đơn',
      subtitle: `${patientName(item)} · còn thu ${formatMoney(invoice.balance_due)} · ${invoice.status}`,
      route: invoice.id ? `/billing/invoices/detail?invoice_id=${invoice.id}` : '/billing/cashier/collect',
    };
  }
  if (group === 'payments') {
    const payment = item.payment || item;
    return {
      id: payment.id || payment._id || payment.payment_no,
      title: payment.payment_no || 'Payment',
      subtitle: `${formatMoney(payment.amount)} · ${payment.payment_method || ''} · ${payment.status || ''}`,
      route: payment.id ? `/billing/payments/detail?payment_id=${payment.id}` : '/billing/payments/all',
    };
  }
  if (group === 'payment_intents') {
    const intent = item.payment_intent || item;
    return {
      id: intent.id || intent._id || intent.intent_code,
      title: intent.intent_code || 'Payment intent',
      subtitle: `${formatMoney(intent.amount)} · ${intent.provider || ''} · ${intent.status || ''}`,
      route: '/billing/cashier/transfer-confirmation',
    };
  }
  return {
    id: item.id || item._id || item.title,
    title: item.title || item.label || 'Kết quả',
    subtitle: item.subtitle || item.description || SEARCH_GROUPS[group],
    route: item.route || item.to || '/billing/dashboard',
  };
}

function notificationMatchesTab(item = {}, tab) {
  const text = normalizeText(`${item.title} ${item.message} ${item.event_type} ${item.notification_type}`);
  if (tab === 'all') return true;
  if (tab === 'confirmation') return text.includes('confirm') || text.includes('xac nhan') || text.includes('payment intent');
  if (tab === 'failed') return text.includes('failed') || text.includes('loi') || text.includes('rejected') || text.includes('expired');
  if (tab === 'overdue') return text.includes('overdue') || text.includes('qua han');
  if (tab === 'mismatch') return text.includes('mismatch') || text.includes('sai lech');
  if (tab === 'refund') return text.includes('refund') || text.includes('void') || text.includes('hoan');
  if (tab === 'claim') return text.includes('claim') || text.includes('bhyt') || text.includes('bao hiem');
  if (tab === 'system') return text.includes('system');
  return true;
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
  const [searchPayload, setSearchPayload] = useState(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState('all');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [topbar, setTopbar] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('connected');
  const [isCashierDrawerOpen, setIsCashierDrawerOpen] = useState(false);
  const [cashierTab, setCashierTab] = useState('unpaid');
  const [cashierWorklist, setCashierWorklist] = useState({ summary: {}, unpaid_invoices: [], partial_invoices: [], payment_confirmations: [], failed_payment_intents: [], recent_receipts: [] });
  const [isCashierLoading, setIsCashierLoading] = useState(false);
  const [cashierBusyId, setCashierBusyId] = useState('');
  const [cashierFeedback, setCashierFeedback] = useState('');
  const [isRiskOpen, setIsRiskOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(billingMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );

  const allMenuItems = useMemo(() => flattenBillingMenu(), []);
  const currentPage = getBillingPageMeta(location.pathname);
  const displayName = topbar?.profile?.display_name || getStaffActorName(auth);
  const roleLabel = topbar?.profile?.roles?.length ? getBillingRoleLabel({ user: { roles: topbar.profile.roles } }) : getBillingRoleLabel(auth);
  const counters = topbar?.counters || {};
  const workspace = topbar?.workspace || {};
  const alertSummary = topbar?.alert_summary || {};
  const notifications = topbar?.notification_preview || [];
  const workspaceSwitcher = workspace?.workspace_switcher?.available_workspaces || [];

  const fallbackSearchPayload = useMemo(() => {
    const query = normalizeText(searchQuery);
    const menus = allMenuItems
      .filter((item) => !query || normalizeText(`${item.label} ${item.sectionLabel}`).includes(query))
      .slice(0, 10)
      .map((item) => ({ id: item.id, title: item.label, subtitle: item.sectionLabel, route: item.to }));
    return { menus };
  }, [allMenuItems, searchQuery]);

  const searchGroups = useMemo(() => {
    const payload = searchPayload || fallbackSearchPayload;
    return Object.entries(SEARCH_GROUPS)
      .map(([key, label]) => ({
        key,
        label,
        items: (payload[key] || []).map((item) => normalizeSearchItem(key, item)).slice(0, 8),
      }))
      .filter((group) => group.items.length);
  }, [searchPayload, fallbackSearchPayload]);

  const drawerItems = useMemo(() => {
    if (cashierTab === 'partial') return cashierWorklist.partial_invoices || [];
    if (cashierTab === 'qr' || cashierTab === 'confirmation') return cashierWorklist.payment_confirmations || [];
    if (cashierTab === 'failed') return cashierWorklist.failed_payment_intents || [];
    if (cashierTab === 'receipts') return cashierWorklist.recent_receipts || [];
    return cashierWorklist.unpaid_invoices || [];
  }, [cashierTab, cashierWorklist]);

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => notificationMatchesTab(item, notificationTab)).slice(0, 10),
    [notifications, notificationTab],
  );

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

  useEffect(() => {
    syncCommandBar({ silent: true });
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        setIsCashierDrawerOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return undefined;
    const timer = window.setTimeout(async () => {
      const query = searchQuery.trim();
      if (query.length < 2) {
        setSearchPayload(null);
        return;
      }
      setIsSearchLoading(true);
      try {
        setSearchPayload(await billingCashierAPI.workspaceSearch({ q: query, limit: 8 }));
      } catch (error) {
        setSearchPayload(null);
      } finally {
        setIsSearchLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [isSearchOpen, searchQuery]);

  async function syncCommandBar({ silent = false } = {}) {
    if (!silent) setIsSyncing(true);
    try {
      const payload = await billingCashierAPI.topbarBootstrap();
      setTopbar(payload);
      setLastSyncedAt(new Date());
      setSyncStatus('connected');
    } catch (error) {
      setSyncStatus('degraded');
      if (!topbar) {
        setTopbar({
          workspace: { cashier_counter: 'Quầy thu 01', shift: 'Ca hiện tại', cash_session_status: 'not_open' },
          counters: {},
          alert_summary: { items: [] },
          notification_preview: [],
        });
      }
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }

  async function openCashierDrawer(tab = cashierTab) {
    setIsCashierDrawerOpen(true);
    setCashierTab(tab);
    setIsCashierLoading(true);
    setCashierFeedback('');
    try {
      const payload = await billingCashierAPI.cashierWorklist({ limit: 30 });
      setCashierWorklist(payload || {});
      setLastSyncedAt(new Date());
    } catch (error) {
      setCashierFeedback(getBillingCashierErrorMessage(error));
      setSyncStatus('degraded');
    } finally {
      setIsCashierLoading(false);
    }
  }

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
    if (to) navigate(to);
  }

  async function collectFullCash(item) {
    const id = invoiceId(item);
    if (!id) return;
    setCashierBusyId(id);
    setCashierFeedback('');
    try {
      await billingCashierAPI.collectPayment(id, {
        amount: invoiceBalance(item),
        payment_method: 'cash',
        status: 'completed',
        print_receipt: true,
        note: 'Thu đủ từ Cashier Command Bar',
      });
      setCashierFeedback(`Đã thu ${invoiceNo(item)} và ghi nhận biên lai.`);
      await openCashierDrawer(cashierTab);
      await syncCommandBar({ silent: true });
    } catch (error) {
      setCashierFeedback(getBillingCashierErrorMessage(error));
    } finally {
      setCashierBusyId('');
    }
  }

  async function createQrIntent(item) {
    const id = invoiceId(item);
    if (!id) return;
    setCashierBusyId(id);
    setCashierFeedback('');
    try {
      await billingCashierAPI.createPaymentIntent(id, {
        amount: invoiceBalance(item),
        provider: 'bank_qr',
        method: 'qr',
        force_new: false,
      });
      setCashierFeedback(`Đã tạo QR cho ${invoiceNo(item)}.`);
      await openCashierDrawer('qr');
      await syncCommandBar({ silent: true });
    } catch (error) {
      setCashierFeedback(getBillingCashierErrorMessage(error));
    } finally {
      setCashierBusyId('');
    }
  }

  function openInvoiceDetail(item) {
    const id = invoiceId(item);
    navigate(id ? `/billing/invoices/detail?invoice_id=${id}` : '/billing/cashier/collect');
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
            <button type="button" className="billing-sidebar__alert" onClick={() => setIsRiskOpen((current) => !current)}>
              <Bell size={17} strokeWidth={2.2} />
              <span>
                <strong>{compactNumber(alertSummary.alert_total)} cảnh báo viện phí</strong>
                <small>Thanh toán lỗi, quá hạn, sai lệch</small>
              </span>
            </button>
          ) : null}
          {isRiskOpen && !isSidebarCollapsed ? (
            <div className="billing-risk-panel">
              <header>
                <strong>Billing Risk Summary</strong>
                <small>{relativeTime(alertSummary.last_updated_at || lastSyncedAt)}</small>
              </header>
              {(alertSummary.items || []).map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    closeMobileSidebar();
                    navigate(item.route);
                  }}
                >
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.severity}</small>
                  </span>
                  <b>{compactNumber(item.count)}</b>
                </button>
              ))}
            </div>
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
              <small>
                Quầy: {workspace.cashier_counter || 'Quầy thu 01'} · {workspace.shift || 'Ca hiện tại'} · {workspace.cash_session_status === 'open' ? 'Quỹ mở' : 'Quỹ chưa mở'} · {syncStatus === 'connected' ? 'Realtime connected' : 'Realtime degraded'}
              </small>
            </div>
          </div>

          <div className="billing-topbar__tools">
            <div className={`billing-search${isSearchOpen ? ' is-open' : ''}`} ref={searchRef}>
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Tìm BN, hóa đơn, payment, charge, QR..."
                aria-label="Tìm bệnh nhân, hóa đơn, payment, receipt, charge, QR, claim"
              />
              <kbd>Ctrl K</kbd>
              {searchQuery ? (
                <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}>
                  <X size={15} strokeWidth={2.2} />
                </button>
              ) : null}

              {isSearchOpen ? (
                <div className="billing-search__panel billing-command-palette">
                  <header>
                    <strong>Billing Global Search</strong>
                    <small>{isSearchLoading ? 'Đang tìm...' : 'Bệnh nhân · hóa đơn · payment · receipt · claim'}</small>
                  </header>
                  <div className="billing-command-palette__body">
                    {searchGroups.map((group) => (
                      <section key={group.key}>
                        <span>{group.label}</span>
                        {group.items.map((item) => (
                          <button key={`${group.key}-${item.id || item.title}`} type="button" onClick={() => navigateFromSearch(item.route)}>
                            <strong>{item.title}</strong>
                            <small>{item.subtitle}</small>
                          </button>
                        ))}
                      </section>
                    ))}
                    {!searchGroups.length ? <div className="billing-search__empty">Không tìm thấy dữ liệu phù hợp.</div> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="billing-topbar__quick"
              onClick={() => openCashierDrawer(counters.pending_bank_confirmations ? 'confirmation' : 'unpaid')}
            >
              <WalletCards size={18} strokeWidth={2.25} />
              <span>Thu tiền</span>
              <strong>{compactNumber(counters.pending_bank_confirmations || counters.unpaid_invoices)}</strong>
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
                {notifications.some((item) => !item.read_at) ? <span className="billing-icon-button__dot" /> : null}
              </button>

              {isNotificationOpen ? (
                <div className="billing-dropdown__panel billing-dropdown__panel--notifications billing-notification-center">
                  <header>
                    <strong>Cảnh báo viện phí</strong>
                    <span>{notifications.filter((item) => !item.read_at).length} mới</span>
                  </header>
                  <div className="billing-notification-tabs">
                    {NOTIFICATION_TABS.map(([key, label]) => (
                      <button key={key} type="button" className={notificationTab === key ? 'is-active' : ''} onClick={() => setNotificationTab(key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="billing-notification-list">
                    {visibleNotifications.map((item) => (
                      <article key={item.id} className={`billing-notification-card is-${item.priority || 'normal'}`}>
                        <span><AlertTriangle size={15} strokeWidth={2.2} /></span>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.message}</p>
                          <small>{relativeTime(item.created_at)} · {item.priority || 'normal'}</small>
                          <footer>
                            <button type="button" onClick={() => navigate(item.route || '/billing/dashboard')}>Mở liên quan</button>
                            <button type="button" onClick={() => openCashierDrawer('confirmation')}>Thu tiền</button>
                          </footer>
                        </div>
                      </article>
                    ))}
                    {!visibleNotifications.length ? <div className="billing-search__empty">Chưa có thông báo trong nhóm này.</div> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={`billing-icon-button billing-sync-button is-${syncStatus}`}
              aria-label="Đồng bộ dữ liệu viện phí"
              title={syncStatus === 'connected' ? `Đã đồng bộ ${relativeTime(lastSyncedAt)}` : 'Realtime degraded, bấm để đồng bộ lại'}
              onClick={() => syncCommandBar()}
            >
              <RefreshCw className={isSyncing ? 'is-spinning' : ''} size={18} strokeWidth={2.2} />
            </button>

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
                      <span>{topbar?.profile?.email || auth?.user?.email || auth?.user?.username || 'Tài khoản nhân sự'}</span>
                    </div>
                  </div>
                  <div className="billing-profile__context">
                    <span>Workspace: Viện phí & Thu tiền</span>
                    <span>Vai trò: {roleLabel}</span>
                    <span>Quầy thu: {workspace.cashier_counter || 'Quầy thu 01'}</span>
                    <span>Phiên quỹ: {workspace.cash_session_status === 'open' ? 'Đang mở' : 'Chưa mở'}</span>
                    <span>Realtime: {syncStatus === 'connected' ? 'Online' : 'Degraded'}</span>
                  </div>
                  <Link to="/staff/account" onClick={() => setIsProfileOpen(false)}>
                    <UserRound size={16} strokeWidth={2.2} />
                    Hồ sơ của tôi
                  </Link>
                  <Link to="/staff/security" onClick={() => setIsProfileOpen(false)}>
                    <ShieldAlert size={16} strokeWidth={2.2} />
                    Tài khoản & bảo mật
                  </Link>
                  <Link to="/billing/cashier/collect" onClick={() => setIsProfileOpen(false)}>
                    <Banknote size={16} strokeWidth={2.2} />
                    Mở / đóng ca thu ngân
                  </Link>
                  <Link to="/billing/reports/export" onClick={() => setIsProfileOpen(false)}>
                    <Receipt size={16} strokeWidth={2.2} />
                    Báo cáo cuối ca
                  </Link>
                  <div className="billing-profile__workspaces">
                    <span>Chọn không gian khác</span>
                    {workspaceSwitcher.slice(0, 8).map((item) => (
                      <Link key={item.code} to={item.route || '/staff/select-workspace'} onClick={() => setIsProfileOpen(false)}>
                        {item.name}
                      </Link>
                    ))}
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

      {isCashierDrawerOpen ? (
        <div className="billing-cashier-drawer" role="dialog" aria-modal="true" aria-label="Cashier drawer">
          <div className="billing-cashier-drawer__backdrop" onClick={() => setIsCashierDrawerOpen(false)} />
          <aside>
            <header>
              <div>
                <span>Cashier drawer</span>
                <strong>Thu tiền nhanh</strong>
                <small>
                  {workspace.cashier_counter || 'Quầy thu 01'} · {workspace.cash_session_status === 'open' ? 'Quỹ mở' : 'Quỹ chưa mở'} · {isCashierLoading ? 'Đang đồng bộ...' : relativeTime(lastSyncedAt)}
                </small>
              </div>
              <button type="button" className="billing-icon-button" aria-label="Đóng drawer" onClick={() => setIsCashierDrawerOpen(false)}>
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>
            <div className="billing-cashier-drawer__tabs">
              {CASHIER_TABS.map(([key, label]) => (
                <button key={key} type="button" className={cashierTab === key ? 'is-active' : ''} onClick={() => setCashierTab(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="billing-cashier-drawer__modes">
              <button type="button"><Banknote size={15} />Tiền mặt</button>
              <button type="button"><QrCode size={15} />Tạo QR</button>
              <button type="button"><CreditCard size={15} />Một phần</button>
              <button type="button"><Printer size={15} />In biên lai</button>
            </div>
            {cashierFeedback ? <div className="billing-cashier-drawer__feedback">{cashierFeedback}</div> : null}
            <div className="billing-cashier-drawer__list">
              {drawerItems.map((item) => {
                const id = invoiceId(item) || item.id || item.payment_intent?.id || item.receipt_no;
                const isReceipt = cashierTab === 'receipts';
                const isIntent = cashierTab === 'qr' || cashierTab === 'confirmation' || cashierTab === 'failed';
                return (
                  <article key={id || JSON.stringify(item)} className="billing-cashier-item">
                    <div className="billing-cashier-item__main">
                      <div>
                        <span>
                          {isReceipt ? 'Biên lai' : isIntent ? 'Payment intent' : 'Hóa đơn'} · {item.status || item.invoice?.status || item.payment_intent?.status || item.receipt_no || 'open'}
                        </span>
                        <strong>{isReceipt ? item.receipt_no : isIntent ? (item.intent_code || item.payment_intent?.intent_code || 'Payment intent') : invoiceNo(item)}</strong>
                        <p>
                          {patientName(item)} · {patientCode(item)} · {isReceipt ? formatMoney(item.amount) : formatMoney(invoiceBalance(item) || item.amount || item.payment_intent?.amount)}
                        </p>
                      </div>
                      <b>{isIntent ? item.provider || item.payment_intent?.provider || 'QR' : formatMoney(invoiceBalance(item))}</b>
                    </div>
                    {!isReceipt && !isIntent ? (
                      <div className="billing-cashier-item__details">
                        <span>Tổng: {formatMoney(item.invoice?.total_amount)}</span>
                        <span>Đã thu: {formatMoney(item.invoice?.paid_amount)}</span>
                        <span>Còn thu: {formatMoney(invoiceBalance(item))}</span>
                        {item.claim_summary?.pending_count ? <span>BHYT đang xử lý</span> : null}
                      </div>
                    ) : null}
                    <div className="billing-cashier-item__actions">
                      {!isReceipt && !isIntent ? (
                        <>
                          <button type="button" disabled={cashierBusyId === invoiceId(item)} onClick={() => collectFullCash(item)}>Thu đủ</button>
                          <button type="button" onClick={() => navigate(`/billing/cashier/collect?invoice_id=${invoiceId(item)}`)}>Thu một phần</button>
                          <button type="button" disabled={cashierBusyId === invoiceId(item)} onClick={() => createQrIntent(item)}>Tạo QR</button>
                          <button type="button" onClick={() => openInvoiceDetail(item)}>Chi tiết</button>
                        </>
                      ) : isIntent ? (
                        <>
                          <button type="button" onClick={() => navigate('/billing/cashier/transfer-confirmation')}>Đối chiếu</button>
                          <button type="button" onClick={() => navigate('/billing/cashier/transfer-confirmation')}>Xác nhận paid</button>
                          <button type="button" onClick={() => navigate('/billing/reconciliation/payment-mismatch')}>Sai lệch</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => navigate('/billing/cashier/print-receipt')}>In lại</button>
                          <button type="button" onClick={() => navigate('/billing/receipts/history')}>Lịch sử</button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
              {!drawerItems.length ? (
                <div className="billing-cashier-empty">
                  {isCashierLoading ? 'Đang tải hàng đợi thu tiền...' : 'Không có dữ liệu trong tab này.'}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
