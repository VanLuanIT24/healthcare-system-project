import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  ClipboardCheck,
  Clock3,
  FileText,
  LogOut,
  Menu,
  PackageCheck,
  Pill,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../lib/api';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { getStaffActorName } from '../receptionist/workspaceAccess';
import {
  flattenPharmacyMenu,
  getPharmacyPageMeta,
  pharmacyMenuSections,
  pharmacyNotifications,
} from './pharmacyData';
import {
  getApiErrorMessage,
  loadPharmacyIdentity,
  pharmacyTopbarApi,
  searchPharmacyWorkspace,
} from './pharmacyApi';

const PharmacyWorkspaceContext = createContext(null);

const QUEUE_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'verify', label: 'Chờ duyệt' },
  { id: 'waiting', label: 'Chờ cấp phát' },
  { id: 'preparing', label: 'Đang chuẩn bị' },
  { id: 'partial', label: 'Cấp phát một phần' },
  { id: 'shortage', label: 'Thiếu tồn' },
  { id: 'warning', label: 'Có cảnh báo' },
  { id: 'overdue', label: 'Quá SLA' },
];

const NOTIFICATION_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'urgent', label: 'Khẩn cấp' },
  { id: 'dispense', label: 'Cấp phát' },
  { id: 'verify', label: 'Duyệt dược' },
  { id: 'stock', label: 'Tồn kho' },
  { id: 'expiry', label: 'Hết hạn' },
  { id: 'safety', label: 'Dị ứng / tương tác' },
  { id: 'refill', label: 'Refill' },
  { id: 'system', label: 'Hệ thống' },
];

const SOCKET_EVENTS = [
  'notification.created',
  'notification.updated',
  'notification.read',
  'counter.updated',
  'prescription.created',
  'prescription.verified',
  'prescription.rejected',
  'prescription.held',
  'prescription.ready_for_dispense',
  'dispense.created',
  'dispense.item_dispensed',
  'dispense.partially_dispensed',
  'dispense.completed',
  'dispense.returned',
  'dispense.cancelled',
  'inventory.low_stock',
  'inventory.drug_expiring',
  'inventory.expired',
  'inventory.recalled',
  'inventory.quarantined',
  'inventory.transaction_created',
  'pharmacy.refill_requested',
  'pharmacy.refill_approved',
  'pharmacy.refill_rejected',
  'drug_safety.allergy_warning',
  'drug_safety.interaction_warning',
  'drug_safety.duplicate_therapy_warning',
  'pharmacy.alert.created',
  'pharmacy.alert.updated',
  'pharmacy.alert.resolved',
];

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response;
}

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

function getRoleLabel(auth, roles = []) {
  const roleList = roles.length ? roles : auth?.user?.roles || auth?.roles || [];
  if (roleList.includes('super_admin')) return 'Quản trị hệ thống';
  if (roleList.includes('inventory_staff')) return 'Quản lý kho dược';
  if (roleList.includes('pharmacy_manager')) return 'Quản lý nhà thuốc';
  if (roleList.includes('pharmacist')) return 'Dược sĩ';
  return 'Nhà thuốc và kho dược';
}

function formatCount(value) {
  const count = Number(value || 0);
  if (count > 99) return '99+';
  return String(count);
}

function timeAgo(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function toId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return toId(value._id);
  if (value.id) return toId(value.id);
  return String(value);
}

function normalizeSearchGroups(payload, allMenuItems = []) {
  const groups = [];
  const labels = {
    medications: 'Thuốc',
    prescriptions: 'Đơn thuốc',
    dispenses: 'Phiếu cấp phát',
    stock_batches: 'Lô thuốc',
    inventory_transactions: 'Giao dịch kho',
    patients: 'Bệnh nhân',
    menus: 'Menu',
    quick_actions: 'Thao tác nhanh',
  };

  Object.entries(labels).forEach(([key, label]) => {
    const rows = Array.isArray(payload?.[key]) ? payload[key] : [];
    if (!rows.length) return;
    groups.push({
      id: key,
      label,
      items: rows.map((item) => ({
        id: item.id || item.route || item.to || `${key}-${item.title || item.label}`,
        title: item.title || item.label || item.name,
        meta: item.meta || item.description || item.group || item.groupLabel,
        to: item.route || item.to || '#',
        status: item.status || item.priority,
        actions: item.actions || [],
      })),
    });
  });

  if (!groups.length && allMenuItems.length) {
    groups.push({
      id: 'menus',
      label: 'Menu',
      items: allMenuItems.slice(0, 8).map((item) => ({
        id: item.id,
        title: item.label,
        meta: item.groupLabel,
        to: item.to,
      })),
    });
  }

  return groups;
}

function normalizeNotifications(items = []) {
  return items.map((item) => ({
    id: item.notification_id || item._id || item.id || item.title,
    title: item.title || 'Thông báo dược',
    body: item.body || item.message || item.description || '',
    time: item.time || timeAgo(item.created_at),
    priority: item.priority || item.tone || 'normal',
    type: item.type || item.notification_type || item.event_type || 'system',
    read: Boolean(item.read_at || item.read),
    to: item.action_url || item.to || item.data?.route || item.payload?.route || '/pharmacy/overview/alerts',
  }));
}

function categorizeNotification(item = {}) {
  const haystack = normalizeText(`${item.type} ${item.title} ${item.body}`);
  if (['critical', 'high', 'danger'].includes(String(item.priority || '').toLowerCase())) return 'urgent';
  if (haystack.includes('dispense') || haystack.includes('cap phat')) return 'dispense';
  if (haystack.includes('verify') || haystack.includes('duyet')) return 'verify';
  if (haystack.includes('stock') || haystack.includes('ton kho') || haystack.includes('thieu ton')) return 'stock';
  if (haystack.includes('expiry') || haystack.includes('het han')) return 'expiry';
  if (haystack.includes('allergy') || haystack.includes('di ung') || haystack.includes('interaction') || haystack.includes('tuong tac')) return 'safety';
  if (haystack.includes('refill') || haystack.includes('cap lai')) return 'refill';
  return 'system';
}

function queueItemId(item = {}) {
  return toId(item.dispense?._id || item.dispense?.dispense_id || item.dispense_id || item.prescription?._id || item.prescription?.prescription_id || item.prescription_id || item._id);
}

function normalizeQueueItem(item = {}) {
  const prescription = item.prescription || item.prescription_id || item;
  const dispense = item.dispense || item.dispense_id || {};
  const patient = item.patient || prescription.patient || prescription.patient_id || item.patient_id || {};
  const doctor = item.doctor || item.prescriber || prescription.prescribed_by || {};
  const stockSummary = item.stock_summary || {};
  const safetySummary = item.safety_summary || {};
  const sla = item.sla || {};
  const warningCount = Number(stockSummary.shortage_count || 0)
    + Number(safetySummary.allergy_count || safetySummary.allergy_warning || 0)
    + Number(safetySummary.interaction_count || safetySummary.interaction_warning || 0);

  return {
    raw: item,
    id: queueItemId(item),
    prescription_id: toId(prescription._id || prescription.prescription_id),
    dispense_id: toId(dispense._id || dispense.dispense_id),
    prescription_no: prescription.prescription_no || item.prescription_no || 'Đơn thuốc',
    dispense_no: dispense.dispense_no || item.dispense_no,
    patient_name: patient.full_name || patient.patient_name || 'Bệnh nhân',
    patient_meta: [patient.patient_code, patient.gender, patient.age ? `${patient.age} tuổi` : null].filter(Boolean).join(' · '),
    doctor_name: doctor.full_name || doctor.name || doctor.username || item.doctor_name,
    department: item.department?.name || item.department_name || item.encounter?.department_name || 'Khoa khám bệnh',
    status: dispense.status || prescription.status || item.status || 'waiting',
    workflow_stage: dispense.workflow_stage || item.workflow_stage,
    priority: dispense.priority || item.priority || prescription.priority || 'medium',
    item_count: Number(item.items_summary?.total_items || item.items?.length || prescription.item_count || 0),
    wait_minutes: Number(sla.wait_minutes || item.wait_minutes || 0),
    over_sla: Boolean(sla.overdue || sla.is_overdue || item.over_sla),
    warning_count: warningCount,
    shortage_count: Number(stockSummary.shortage_count || 0),
    allergy_count: Number(safetySummary.allergy_count || safetySummary.allergy_warning || 0),
    interaction_count: Number(safetySummary.interaction_count || safetySummary.interaction_warning || 0),
  };
}

function getQueueParams(tabId) {
  if (tabId === 'verify') return { status: 'active' };
  if (tabId === 'waiting') return { status: 'verified' };
  if (tabId === 'preparing') return { workflow_stage: 'picking,checking,assigned' };
  if (tabId === 'partial') return { status: 'partially_dispensed' };
  if (tabId === 'shortage') return { issue: 'stock_shortage' };
  if (tabId === 'warning') return { issue: 'safety_warning' };
  if (tabId === 'overdue') return { overdue: true };
  return {};
}

function getSocketOrigin() {
  if (!API_BASE_URL || API_BASE_URL.startsWith('/')) return window.location.origin;
  try {
    return new URL(API_BASE_URL).origin;
  } catch (error) {
    return window.location.origin;
  }
}

function loadSocketScript(origin) {
  if (window.io) return Promise.resolve(window.io);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pharmacy-socket]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.io), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `${origin}/socket.io/socket.io.js`;
    script.async = true;
    script.dataset.pharmacySocket = 'true';
    script.onload = () => resolve(window.io);
    script.onerror = reject;
    document.head.appendChild(script);
  });
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

function PharmacyCommandPalette({
  groups,
  loading,
  error,
  query,
  selectedIndex,
  onSelect,
  onClose,
}) {
  const flattened = groups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: group.label })));

  return (
    <div className="pharmacy-command-palette" role="dialog" aria-label="Tìm kiếm nhà thuốc">
      <div className="pharmacy-command-palette__backdrop" onClick={onClose} />
      <section className="pharmacy-command-palette__panel">
        <header>
          <div>
            <strong>Pharmacy Command</strong>
            <span>Thuốc, đơn, bệnh nhân, lô, phiếu cấp phát, giao dịch kho</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng tìm kiếm">
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>
        {loading ? <div className="pharmacy-command-palette__state">Đang tìm kiếm...</div> : null}
        {error ? <div className="pharmacy-command-palette__state is-error">{error}</div> : null}
        {!loading && !error && !flattened.length ? (
          <div className="pharmacy-command-palette__state">Không tìm thấy kết quả phù hợp.</div>
        ) : null}
        <div className="pharmacy-command-palette__groups">
          {groups.map((group) => (
            <section key={group.id}>
              <strong>{group.label}</strong>
              {group.items.map((item) => {
                const flatIndex = flattened.findIndex((entry) => entry.id === item.id && entry.to === item.to);
                return (
                  <button
                    key={`${group.id}-${item.id}-${item.to}`}
                    type="button"
                    className={flatIndex === selectedIndex ? 'is-active' : ''}
                    onClick={() => onSelect(item)}
                  >
                    <span>{item.title}</span>
                    <small>{[item.meta, item.status].filter(Boolean).join(' · ')}</small>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
        <footer>
          <span>{query?.trim()?.length >= 2 ? 'Enter để mở kết quả đang chọn' : 'Gõ ít nhất 2 ký tự để tìm dữ liệu nghiệp vụ'}</span>
          <span>Esc đóng</span>
        </footer>
      </section>
    </div>
  );
}

function DispenseQueueDrawer({
  open,
  loading,
  error,
  items,
  summary,
  activeTab,
  onTabChange,
  onClose,
  onRefresh,
  onAction,
}) {
  if (!open) return null;

  const normalized = items.map(normalizeQueueItem);

  return (
    <aside className="pharmacy-dispense-drawer" aria-label="Hàng đợi cấp phát">
      <header>
        <div>
          <span>Realtime queue</span>
          <h2>Hàng đợi cấp phát</h2>
          <small>
            {formatCount(summary?.waiting_dispense || summary?.draft_dispenses || normalized.length)} chờ cấp phát
            {summary?.over_sla ? ` · ${summary.over_sla} quá SLA` : ''}
          </small>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng hàng đợi">
          <X size={18} strokeWidth={2.2} />
        </button>
      </header>

      <div className="pharmacy-dispense-drawer__tabs">
        {QUEUE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pharmacy-dispense-drawer__body">
        {loading ? <div className="pharmacy-dispense-drawer__state">Đang tải hàng đợi...</div> : null}
        {error ? (
          <div className="pharmacy-dispense-drawer__state is-error">
            <span>{error}</span>
            <button type="button" onClick={onRefresh}>Thử lại</button>
          </div>
        ) : null}
        {!loading && !error && !normalized.length ? (
          <div className="pharmacy-dispense-drawer__state">Không có đơn trong nhóm này.</div>
        ) : null}
        {normalized.map((item) => (
          <article key={item.id} className={`pharmacy-dispense-card is-${item.priority}`}>
            <div className="pharmacy-dispense-card__head">
              <div>
                <strong>{item.prescription_no}</strong>
                <span>{item.patient_name} · {item.patient_meta || item.department}</span>
              </div>
              <em>{item.priority === 'critical' ? 'STAT' : item.status}</em>
            </div>
            <dl>
              <div>
                <dt>Khoa / bác sĩ</dt>
                <dd>{[item.department, item.doctor_name].filter(Boolean).join(' · ') || 'Chưa rõ'}</dd>
              </div>
              <div>
                <dt>Số thuốc</dt>
                <dd>{item.item_count || '-'} thuốc</dd>
              </div>
              <div>
                <dt>Chờ</dt>
                <dd className={item.over_sla ? 'is-danger' : ''}>{item.wait_minutes ? `${item.wait_minutes} phút` : '-'}</dd>
              </div>
            </dl>
            <div className="pharmacy-dispense-card__chips">
              {item.allergy_count ? <span className="is-danger">Dị ứng {item.allergy_count}</span> : null}
              {item.interaction_count ? <span className="is-warning">Tương tác {item.interaction_count}</span> : null}
              {item.shortage_count ? <span className="is-danger">Thiếu tồn {item.shortage_count}</span> : null}
              {item.over_sla ? <span className="is-warning">Quá SLA</span> : null}
            </div>
            <footer>
              <button type="button" onClick={() => onAction('claim', item)}>Nhận xử lý</button>
              <button type="button" onClick={() => onAction('view', item)}>Xem đơn</button>
              <button type="button" onClick={() => onAction('verify', item)}>Duyệt dược</button>
              <button type="button" onClick={() => onAction('prepare', item)}>Chuẩn bị</button>
              <button type="button" onClick={() => onAction('print', item)}>In nhãn</button>
              <button type="button" onClick={() => onAction('hold', item)}>Tạm giữ</button>
            </footer>
          </article>
        ))}
      </div>
    </aside>
  );
}

export function PharmacyShell({ children }) {
  const storedAuth = readStoredAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const alertRef = useRef(null);
  const socketRef = useRef(null);

  const [identity, setIdentity] = useState(() => ({
    user: storedAuth?.user || {},
    roles: storedAuth?.user?.roles || storedAuth?.roles || [],
    permissions: storedAuth?.user?.permissions || storedAuth?.permissions || [],
    session: null,
    unreadCount: 0,
    errors: {},
  }));
  const [topbar, setTopbar] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchGroups, setSearchGroups] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState('all');
  const [notifications, setNotifications] = useState(() => normalizeNotifications(pharmacyNotifications));
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [queueTab, setQueueTab] = useState('all');
  const [queueState, setQueueState] = useState({ loading: false, error: '', items: [], summary: {} });
  const [actionError, setActionError] = useState('');
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(pharmacyMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );

  const allMenuItems = useMemo(() => flattenPharmacyMenu(), []);
  const currentPage = getPharmacyPageMeta(location.pathname);
  const displayName = topbar?.profile?.display_name || getStaffActorName({ user: identity.user, roles: identity.roles }) || getStaffActorName(storedAuth);
  const roleLabel = getRoleLabel(storedAuth, identity.roles);
  const counters = topbar?.counters || {};
  const alertSummary = topbar?.alert_summary || topbar?.shift_summary || {};
  const workspace = topbar?.workspace || {};
  const queueBadge = Number(counters.waiting_dispense || counters.pending_verify || 0);
  const notificationUnread = notifications.filter((item) => !item.read).length || identity.unreadCount || 0;

  const filteredNotifications = useMemo(() => {
    if (notificationTab === 'all') return notifications;
    return notifications.filter((item) => categorizeNotification(item) === notificationTab);
  }, [notificationTab, notifications]);

  const flatSearchResults = useMemo(
    () => searchGroups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: group.label }))),
    [searchGroups],
  );

  const refreshTopbar = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setBootstrapLoading(true);
      setBootstrapError('');
    }
    const [identityResult, bootstrapResult, notificationsResult] = await Promise.allSettled([
      loadPharmacyIdentity(),
      pharmacyTopbarApi.bootstrap({ workspace: 'pharmacy' }),
      pharmacyTopbarApi.notifications({ limit: 8 }),
    ]);

    if (identityResult.status === 'fulfilled') {
      setIdentity(identityResult.value);
    }

    if (bootstrapResult.status === 'fulfilled') {
      const payload = unwrap(bootstrapResult.value);
      setTopbar(payload);
      if (Array.isArray(payload?.notification_preview) && payload.notification_preview.length) {
        setNotifications(normalizeNotifications(payload.notification_preview));
      }
    } else if (!silent) {
      setBootstrapError(getApiErrorMessage(bootstrapResult.reason, 'Không thể tải command bar nhà thuốc.'));
    }

    if (notificationsResult.status === 'fulfilled') {
      const payload = unwrap(notificationsResult.value);
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.notifications)
          ? payload.notifications
          : Array.isArray(payload)
            ? payload
            : [];
      if (rows.length) setNotifications(normalizeNotifications(rows));
    }

    if (!silent) setBootstrapLoading(false);
  }, []);

  const loadQueue = useCallback(async (tab = queueTab) => {
    setQueueState((current) => ({ ...current, loading: true, error: '' }));
    const [itemsResult, summaryResult] = await Promise.allSettled([
      pharmacyTopbarApi.dispenseQueue({ ...getQueueParams(tab), limit: 16 }),
      pharmacyTopbarApi.dispenseQueueSummary({}),
    ]);
    const next = { loading: false, error: '', items: [], summary: {} };
    if (itemsResult.status === 'fulfilled') {
      const payload = unwrap(itemsResult.value);
      next.items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
    } else {
      next.error = getApiErrorMessage(itemsResult.reason, 'Không thể tải hàng đợi cấp phát.');
    }
    if (summaryResult.status === 'fulfilled') {
      next.summary = unwrap(summaryResult.value) || {};
    }
    setQueueState(next);
  }, [queueTab]);

  useEffect(() => {
    refreshTopbar();
  }, [refreshTopbar]);

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
      if (searchRef.current && !searchRef.current.contains(event.target) && !event.target.closest('.pharmacy-command-palette')) setIsSearchOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setIsNotificationOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setIsProfileOpen(false);
      if (alertRef.current && !alertRef.current.contains(event.target)) setIsAlertPanelOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    function handleKeyboard(event) {
      const isCtrlK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isCtrlK) {
        event.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchRef.current?.querySelector('input')?.focus(), 0);
        return;
      }
      if (!isSearchOpen) return;
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedSearchIndex((current) => Math.min(current + 1, Math.max(flatSearchResults.length - 1, 0)));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedSearchIndex((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === 'Enter' && flatSearchResults[selectedSearchIndex]) {
        event.preventDefault();
        navigateFromSearch(flatSearchResults[selectedSearchIndex].to);
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [flatSearchResults, isSearchOpen, selectedSearchIndex]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const query = searchQuery.trim();
    setSelectedSearchIndex(0);
    if (query.length < 2) {
      setSearchGroups(normalizeSearchGroups({}, allMenuItems));
      setSearchLoading(false);
      setSearchError('');
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError('');
    const timeout = window.setTimeout(async () => {
      try {
        const response = await pharmacyTopbarApi.search({ q: query, limit: 7 });
        if (!cancelled) setSearchGroups(normalizeSearchGroups(unwrap(response), allMenuItems));
      } catch (error) {
        try {
          const fallback = await searchPharmacyWorkspace(query);
          if (!cancelled) setSearchGroups(fallback);
        } catch (fallbackError) {
          if (!cancelled) {
            setSearchError(getApiErrorMessage(error, 'Không thể tìm kiếm dữ liệu nhà thuốc.'));
            setSearchGroups([]);
          }
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [allMenuItems, isSearchOpen, searchQuery]);

  useEffect(() => {
    if (isQueueOpen) loadQueue(queueTab);
  }, [isQueueOpen, loadQueue, queueTab]);

  useEffect(() => {
    const token = readStoredAuth()?.tokens?.access_token;
    if (!token) return undefined;
    let disposed = false;

    loadSocketScript(getSocketOrigin())
      .then((io) => {
        if (disposed || !io) return;
        const socket = io(getSocketOrigin(), {
          auth: { token },
          transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;
        const refresh = () => {
          refreshTopbar({ silent: true });
          if (isQueueOpen) loadQueue(queueTab);
        };
        SOCKET_EVENTS.forEach((eventName) => socket.on(eventName, refresh));
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (socketRef.current) {
        SOCKET_EVENTS.forEach((eventName) => socketRef.current.off(eventName));
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isQueueOpen, loadQueue, queueTab, refreshTopbar]);

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
    if (!to || to === '#') return;
    setSearchQuery('');
    setIsSearchOpen(false);
    navigate(to);
  }

  async function handleNotificationClick(item) {
    setNotifications((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
    if (item.id && !String(item.id).startsWith('pending-')) {
      pharmacyTopbarApi.markNotificationRead(item.id).catch(() => {});
    }
    setIsNotificationOpen(false);
    navigate(item.to || '/pharmacy/overview/alerts');
  }

  async function handleQueueAction(action, item) {
    setActionError('');
    try {
      if (action === 'claim') {
        if (item.prescription_id) {
          await pharmacyTopbarApi.claimPrescription(item.prescription_id, { priority: item.priority });
        } else if (item.dispense_id) {
          await pharmacyTopbarApi.assignDispense(item.dispense_id, {});
          await pharmacyTopbarApi.lockDispense(item.dispense_id, {});
        }
        await loadQueue(queueTab);
        await refreshTopbar({ silent: true });
        return;
      }
      if (action === 'verify' && item.prescription_id) {
        await pharmacyTopbarApi.verifyPrescription(item.prescription_id, {});
        await loadQueue(queueTab);
        await refreshTopbar({ silent: true });
        return;
      }
      if (action === 'prepare' && item.dispense_id) {
        await pharmacyTopbarApi.startPreparation(item.dispense_id, {});
        await loadQueue(queueTab);
        return;
      }
      if (action === 'print' && item.dispense_id) {
        await pharmacyTopbarApi.printLabels(item.dispense_id, {});
        return;
      }
      if (action === 'hold' && item.dispense_id) {
        await pharmacyTopbarApi.createHold(item.dispense_id, { reason: 'Tạm giữ từ Pharmacy Command Bar', hold_type: 'other' });
        await loadQueue(queueTab);
        return;
      }
      const target = item.dispense_id
        ? `/pharmacy/dispensing/queue?dispense_id=${item.dispense_id}`
        : `/pharmacy/prescriptions/${item.prescription_id}`;
      navigate(target);
      setIsQueueOpen(false);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Không thể xử lý thao tác cấp phát.'));
    }
  }

  async function handleWorkspaceSwitch(workspaceItem) {
    if (!workspaceItem?.route) return;
    try {
      await pharmacyTopbarApi.setCurrentWorkspace(workspaceItem.code);
    } catch (error) {
      // Switcher should remain usable even if preference persistence is unavailable.
    }
    setIsProfileOpen(false);
    navigate(workspaceItem.route);
  }

  const contextValue = {
    user: identity.user || {},
    roles: identity.roles || [],
    permissions: identity.permissions || [],
    session: identity.session || null,
    loading: bootstrapLoading,
    errors: { ...identity.errors, topbar: bootstrapError },
    refreshIdentity: refreshTopbar,
    topbar,
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
                  <small>{workspace.current_store || 'Quầy thuốc ngoại trú'}</small>
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

          <div className="pharmacy-v2-sidebar__footer" ref={alertRef}>
            {!isSidebarCollapsed ? (
              <button
                type="button"
                className="pharmacy-v2-sidebar__alert"
                onClick={() => setIsAlertPanelOpen((current) => !current)}
              >
                <Bell size={17} strokeWidth={2.2} />
                <span>
                  <strong>{formatCount(alertSummary.alert_total || counters.low_stock || 0)} cảnh báo dược</strong>
                  <small>Sắp hết thuốc, hết hạn, dị ứng</small>
                </span>
              </button>
            ) : null}

            {isAlertPanelOpen && !isSidebarCollapsed ? (
              <div className="pharmacy-shift-alert-panel">
                <header>
                  <strong>Cảnh báo dược</strong>
                  <span>{workspace.current_shift || 'Ca trực'}</span>
                </header>
                {(alertSummary.items || []).map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setIsAlertPanelOpen(false);
                      navigate(item.route || '/pharmacy/overview/alerts');
                    }}
                  >
                    <span>{item.label}</span>
                    <strong className={`is-${item.severity}`}>{formatCount(item.count)}</strong>
                  </button>
                ))}
              </div>
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
                <small>{workspace.current_store || 'Quầy thuốc ngoại trú'} · {workspace.current_shift || 'Ca trực'}</small>
              </div>
            </div>

            <div className="pharmacy-v2-topbar__tools">
              <div className={`pharmacy-v2-search${isSearchOpen ? ' is-open' : ''}`} ref={searchRef}>
                <Search size={17} strokeWidth={2.2} aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Thuốc, đơn, bệnh nhân, lô, phiếu cấp phát..."
                  aria-label="Tìm kiếm nhà thuốc và kho dược"
                />
                {searchQuery ? (
                  <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}>
                    <X size={15} strokeWidth={2.2} />
                  </button>
                ) : <kbd>Ctrl K</kbd>}
              </div>

              <button
                type="button"
                className={`pharmacy-v2-topbar__quick${counters.over_sla ? ' is-warning' : ''}`}
                onClick={() => setIsQueueOpen(true)}
              >
                <PackageCheck size={18} strokeWidth={2.25} />
                <span>Hàng đợi cấp phát</span>
                {queueBadge ? <strong>{formatCount(queueBadge)}</strong> : null}
              </button>

              <div className="pharmacy-v2-dropdown" ref={notificationRef}>
                <button
                  type="button"
                  className={`pharmacy-v2-icon-button${notificationUnread ? ' is-pulsing' : ''}`}
                  aria-label="Mở cảnh báo dược"
                  aria-expanded={isNotificationOpen}
                  onClick={() => setIsNotificationOpen((current) => !current)}
                >
                  <Bell size={19} strokeWidth={2.2} />
                  {notificationUnread ? <span className="pharmacy-v2-icon-button__badge">{formatCount(notificationUnread)}</span> : null}
                </button>

                {isNotificationOpen ? (
                  <div className="pharmacy-v2-dropdown__panel pharmacy-v2-dropdown__panel--notifications">
                    <header>
                      <strong>Notification Center</strong>
                      <span>{formatCount(notificationUnread)} chưa đọc</span>
                    </header>
                    <div className="pharmacy-notification-tabs">
                      {NOTIFICATION_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          className={notificationTab === tab.id ? 'is-active' : ''}
                          onClick={() => setNotificationTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="pharmacy-notification-list">
                      {filteredNotifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`pharmacy-notification-card is-${item.priority}${item.read ? ' is-read' : ''}`}
                          onClick={() => handleNotificationClick(item)}
                        >
                          <span className="pharmacy-notification-card__icon">
                            {categorizeNotification(item) === 'stock' ? <Boxes size={16} /> : categorizeNotification(item) === 'safety' ? <ShieldAlert size={16} /> : <Bell size={16} />}
                          </span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.body}</small>
                            <em>{item.time}</em>
                          </span>
                        </button>
                      ))}
                      {!filteredNotifications.length ? <div className="pharmacy-v2-search__empty">Không có thông báo trong nhóm này.</div> : null}
                    </div>
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
                  <div className="pharmacy-v2-profile__panel pharmacy-v2-profile__panel--wide">
                    <div className="pharmacy-v2-profile__summary">
                      <span className="pharmacy-v2-avatar pharmacy-v2-avatar--large">{getInitials(displayName)}</span>
                      <div>
                        <strong>{displayName}</strong>
                        <span>{identity.user?.email || identity.user?.username || 'Tài khoản nhân sự'}</span>
                      </div>
                    </div>
                    <div className="pharmacy-profile-context">
                      <span>Workspace: {workspace.name || 'Nhà thuốc & Kho dược'}</span>
                      <span>Quầy/kho: {workspace.current_store || 'Quầy thuốc ngoại trú'}</span>
                      <span>Ca trực: {workspace.current_shift || 'Ca trực'}</span>
                      <span>Trạng thái: Online</span>
                    </div>
                    <Link to="/staff/profile" onClick={() => setIsProfileOpen(false)}><UserRound size={16} />Hồ sơ của tôi</Link>
                    <Link to="/staff/security" onClick={() => setIsProfileOpen(false)}><ShieldAlert size={16} />Tài khoản & bảo mật</Link>
                    <Link to="/staff/sessions" onClick={() => setIsProfileOpen(false)}><Clock3 size={16} />Phiên đăng nhập</Link>
                    <Link to="/staff/login-history" onClick={() => setIsProfileOpen(false)}><FileText size={16} />Lịch sử đăng nhập</Link>
                    <Link to="/pharmacy/config" onClick={() => setIsProfileOpen(false)}><Boxes size={16} />Cấu hình quầy/kho mặc định</Link>
                    <div className="pharmacy-workspace-switcher">
                      <strong>Chọn không gian khác</strong>
                      {(workspace.available_workspaces || []).map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          className={item.code === workspace.current_workspace ? 'is-active' : ''}
                          onClick={() => handleWorkspaceSwitch(item)}
                        >
                          <span>{item.name}</span>
                          {item.badge?.alerts ? <em>{formatCount(item.badge.alerts)}</em> : null}
                        </button>
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

          {bootstrapError ? (
            <div className="pharmacy-command-bar-error">
              <AlertTriangle size={16} />
              <span>{bootstrapError}</span>
              <button type="button" onClick={() => refreshTopbar()}>Tải lại</button>
            </div>
          ) : null}

          {actionError ? (
            <div className="pharmacy-command-bar-error">
              <AlertTriangle size={16} />
              <span>{actionError}</span>
              <button type="button" onClick={() => setActionError('')}>Đóng</button>
            </div>
          ) : null}

          <div className="pharmacy-v2-content">
            {children}
          </div>
        </section>

        {isSearchOpen ? (
          <PharmacyCommandPalette
            groups={searchGroups}
            loading={searchLoading}
            error={searchError}
            query={searchQuery}
            selectedIndex={selectedSearchIndex}
            onSelect={(item) => navigateFromSearch(item.to)}
            onClose={() => setIsSearchOpen(false)}
          />
        ) : null}

        <DispenseQueueDrawer
          open={isQueueOpen}
          loading={queueState.loading}
          error={queueState.error}
          items={queueState.items}
          summary={{ ...counters, ...queueState.summary }}
          activeTab={queueTab}
          onTabChange={setQueueTab}
          onClose={() => setIsQueueOpen(false)}
          onRefresh={() => loadQueue(queueTab)}
          onAction={handleQueueAction}
        />
      </main>
    </PharmacyWorkspaceContext.Provider>
  );
}
