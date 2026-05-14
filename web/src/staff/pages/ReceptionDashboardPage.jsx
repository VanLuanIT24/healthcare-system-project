import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  CreditCard,
  Headset,
  KeyRound,
  LayoutGrid,
  LogOut,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Users,
  UserSquare2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';
import { getStaffActorName } from '../workspaceAccess';
import { receptionDashboardApi } from '../api/receptionDashboardApi';
import { staffAuthApi } from '../api/staffAuthApi';
import { ReceptionAppointmentsPanel } from './ReceptionAppointmentsPanel';
import { ReceptionCheckInQueuePanel } from './ReceptionCheckInQueuePanel';

const SIDEBAR_SECTIONS = [
  { key: 'overview', label: 'Tổng quan', icon: LayoutGrid },
  {
    key: 'appointments',
    label: 'Lịch hẹn',
    icon: CalendarDays,
    children: [
      { key: 'appointments-all', label: 'Tất cả lịch hẹn' },
      { key: 'appointments-today', label: 'Lịch hôm nay' },
      { key: 'appointments-upcoming', label: 'Lịch sắp tới' },
      { key: 'appointments-create', label: 'Tạo lịch hẹn' },
      { key: 'appointments-confirm', label: 'Xác nhận lịch' },
      { key: 'appointments-reschedule', label: 'Dời lịch' },
      { key: 'appointments-cancelled', label: 'Lịch đã hủy' },
      { key: 'appointments-no-show', label: 'Lịch no-show' },
    ],
  },
  {
    key: 'checkin',
    label: 'Check-in',
    icon: CheckCircle2,
    children: [
      { key: 'checkin-quick', label: 'Check-in nhanh' },
      { key: 'checkin-waiting', label: 'Danh sách chờ check-in' },
      { key: 'checkin-done', label: 'Đã check-in' },
      { key: 'checkin-print', label: 'In phiếu tiếp nhận' },
    ],
  },
  {
    key: 'queue',
    label: 'Hàng đợi',
    icon: Users,
    children: [
      { key: 'queue-board', label: 'Bảng hàng đợi' },
      { key: 'queue-call', label: 'Gọi số tiếp theo' },
      { key: 'queue-waiting', label: 'Đang chờ' },
      { key: 'queue-called', label: 'Đang gọi' },
      { key: 'queue-in_service', label: 'Đang phục vụ' },
      { key: 'queue-skipped', label: 'Bỏ qua' },
      { key: 'queue-completed', label: 'Đã hoàn tất' },
      { key: 'queue-cancelled', label: 'Đã hủy' },
      { key: 'queue-transfer', label: 'Chuyển hàng đợi' },
    ],
  },
  {
    key: 'patients',
    label: 'Bệnh nhân',
    icon: UserSquare2,
    children: [
      { key: 'patients-search', label: 'Tìm bệnh nhân' },
      { key: 'patients-create', label: 'Tạo bệnh nhân mới' },
      { key: 'patients-record', label: 'Hồ sơ bệnh nhân' },
      { key: 'patients-priority', label: 'Bệnh nhân ưu tiên' },
    ],
  },
  {
    key: 'doctors',
    label: 'Bác sĩ trực',
    icon: Stethoscope,
    children: [
      { key: 'doctors-schedule', label: 'Lịch bác sĩ hôm nay' },
      { key: 'doctors-departments', label: 'Theo khoa' },
      { key: 'doctors-rooms', label: 'Theo phòng' },
      { key: 'doctors-active', label: 'Bác sĩ đang trực' },
    ],
  },
  {
    key: 'payments',
    label: 'Thanh toán',
    icon: CreditCard,
    children: [
      { key: 'payments-collect', label: 'Thu thanh toán' },
      { key: 'payments-pending', label: 'Hóa đơn chờ xử lý' },
      { key: 'payments-complete', label: 'Đã thanh toán' },
      { key: 'payments-refund', label: 'Hoàn tiền' },
    ],
  },
  {
    key: 'notifications',
    label: 'Thông báo',
    icon: Bell,
    badge: '5',
    children: [
      { key: 'notifications-all', label: 'Tất cả thông báo' },
      { key: 'notifications-unread', label: 'Chưa đọc' },
      { key: 'notifications-appointments', label: 'Lịch hẹn' },
      { key: 'notifications-payments', label: 'Thanh toán' },
      { key: 'notifications-system', label: 'Hệ thống' },
    ],
  },
  {
    key: 'reports',
    label: 'Báo cáo',
    icon: BarChart3,
    children: [
      { key: 'reports-daily', label: 'Tổng quan ngày' },
      { key: 'reports-appointments', label: 'Lịch hẹn' },
      { key: 'reports-checkin', label: 'Check-in' },
      { key: 'reports-revenue', label: 'Doanh thu' },
    ],
  },
  {
    key: 'settings',
    label: 'Cài đặt',
    icon: Settings,
    children: [
      { key: 'settings-account', label: 'Tài khoản' },
      { key: 'settings-ui', label: 'Giao diện' },
      { key: 'settings-permissions', label: 'Phân quyền' },
      { key: 'settings-system', label: 'Tùy chọn hệ thống' },
    ],
  },
];

const APPOINTMENT_MENU_MODES = {
  'appointments-all': 'all',
  'appointments-today': 'today',
  'appointments-upcoming': 'upcoming',
  'appointments-create': 'create',
  'appointments-confirm': 'confirm',
  'appointments-reschedule': 'reschedule',
  'appointments-cancelled': 'cancelled',
  'appointments-no-show': 'no_show',
};

const STATUS_META = {
  appointment: {
    booked: { label: 'Booked', color: '#4F83FF', tone: 'info' },
    confirmed: { label: 'Confirmed', color: '#55C087', tone: 'success' },
    checked_in: { label: 'Checked-in', color: '#37B8FF', tone: 'teal' },
    in_consultation: { label: 'In consultation', color: '#9B87F5', tone: 'violet' },
    completed: { label: 'Completed', color: '#70D6A3', tone: 'success' },
    cancelled: { label: 'Cancelled', color: '#FF9E44', tone: 'warning' },
    no_show: { label: 'No show', color: '#FF6B7A', tone: 'danger' },
    rescheduled: { label: 'Rescheduled', color: '#B08FF5', tone: 'violet' },
  },
  queue: {
    waiting: { label: 'Waiting', color: '#4F83FF', tone: 'info' },
    called: { label: 'Called', color: '#68B9FF', tone: 'teal' },
    recalled: { label: 'Recalled', color: '#A38CFF', tone: 'violet' },
    in_service: { label: 'In service', color: '#55C087', tone: 'success' },
    completed: { label: 'Completed', color: '#8ADBAF', tone: 'success' },
    cancelled: { label: 'Cancelled', color: '#FFB74D', tone: 'warning' },
    skipped: { label: 'Skipped', color: '#FF7A59', tone: 'danger' },
  },
  encounter: {
    planned: { label: 'Planned', color: '#9BB6FF', tone: 'info' },
    arrived: { label: 'Arrived', color: '#6DD3A6', tone: 'success' },
    in_progress: { label: 'In progress', color: '#4F83FF', tone: 'info' },
    on_hold: { label: 'On hold', color: '#FFC86B', tone: 'warning' },
    completed: { label: 'Completed', color: '#74D3C0', tone: 'success' },
    cancelled: { label: 'Cancelled', color: '#FF7A59', tone: 'danger' },
  },
};

function getDateKey(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDateRange(days = 7) {
  return {
    date_from: getDateKey(-(days - 1)),
    date_to: getDateKey(0),
  };
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readCardValue(cards = [], key, fallback = 0) {
  const card = Array.isArray(cards) ? cards.find((item) => item?.key === key) : null;
  return card ? toNumber(card.value, fallback) : fallback;
}

function formatCurrency(amount = 0) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(toNumber(amount));
}

function formatCompactCurrency(amount = 0) {
  const numeric = toNumber(amount);
  if (Math.abs(numeric) >= 1000000000) {
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(numeric / 1000000000)} tỷ`;
  }
  if (Math.abs(numeric) >= 1000000) {
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(numeric / 1000000)} tr`;
  }
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(numeric);
}

function formatInteger(value = 0) {
  return new Intl.NumberFormat('vi-VN').format(toNumber(value));
}

function formatPercent(value = 0) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(toNumber(value))}%`;
}

function formatClock(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function formatMinutesBetween(start, end = new Date()) {
  if (!start) return '--';
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return '--';
  const minutes = Math.max(0, Math.round((endTime - startTime) / 60000));
  return `${minutes} phút`;
}

function computeDelta(current, previous) {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (previousValue <= 0) {
    return {
      text: 'Không có dữ liệu hôm qua',
      trend: 'neutral',
    };
  }

  const delta = ((currentValue - previousValue) / previousValue) * 100;
  if (Math.abs(delta) < 0.05) {
    return {
      text: 'Không đổi so với hôm qua',
      trend: 'neutral',
    };
  }

  return {
    text: `${delta > 0 ? '+' : ''}${formatPercent(delta)} so với hôm qua`,
    trend: delta > 0 ? 'up' : 'down',
  };
}

function createSparkPoints(values = []) {
  return values
    .map((value) => toNumber(value))
    .filter((value) => Number.isFinite(value))
    .slice(-8);
}

function normalizeBreakdown(items = [], type) {
  const typeMeta = STATUS_META[type] || {};
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const key = item?.status || item?.encounter_type || item?.appointment_type || item?.payment_method || 'unknown';
      const meta = typeMeta[key] || {
        label: String(key || 'Unknown'),
        color: '#A7B7D1',
        tone: 'neutral',
      };
      return {
        key,
        label: meta.label,
        color: meta.color,
        tone: meta.tone,
        value: toNumber(item?.count),
      };
    })
    .filter((item) => item.value > 0);
}

function buildBreakdownFromSummary(summary = {}, mapping = [], type) {
  return normalizeBreakdown(
    mapping.map((item) => ({
      status: item.status,
      count: summary?.[item.field],
    })),
    type,
  );
}

function buildConicGradient(items = []) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return 'conic-gradient(#e9f1fb 0deg 360deg)';

  let cursor = 0;
  const segments = items.map((item) => {
    const portion = (item.value / total) * 360;
    const segment = `${item.color} ${cursor}deg ${cursor + portion}deg`;
    cursor += portion;
    return segment;
  });

  return `conic-gradient(${segments.join(', ')})`;
}

function normalizeLineSeries(items = [], valueField = 'amount') {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      key: item?.date || item?.label || '',
      label: item?.label || formatShortDate(item?.date),
      value: toNumber(item?.[valueField]),
    }))
    .filter((item) => item.label);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getInitials(name = '') {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getActorDepartmentId(auth = {}) {
  return auth?.user?.department_id || auth?.department_id || auth?.departmentId || '';
}

function getProfileUser(profile = null, auth = {}) {
  return profile?.user || auth?.user || {};
}

function normalizeRoleCodes(roles = []) {
  return safeArray(roles)
    .map((role) => (typeof role === 'string' ? role : role?.role_code || role?.code || role?.name))
    .filter(Boolean);
}

function normalizeRoleLabels(roles = []) {
  return safeArray(roles)
    .map((role) => {
      if (typeof role === 'string') return role;
      return role?.role_name || role?.name || role?.role_code || role?.code;
    })
    .filter(Boolean);
}

function getSessionDeviceLabel(session = {}) {
  return session?.device_name
    || [session?.browser, session?.os].filter(Boolean).join(' / ')
    || 'Thiết bị hiện tại';
}

function getLoginStatusText(item = {}) {
  const status = String(item?.status || '').toLowerCase();
  if (status.includes('success')) return 'Đăng nhập thành công';
  if (status.includes('failed') || status.includes('fail')) return 'Đăng nhập thất bại';
  return item?.message || item?.action || 'Hoạt động đăng nhập';
}

async function safeOptionalRequest(factory) {
  try {
    return await factory();
  } catch (error) {
    return null;
  }
}

function mapNotifications(items = []) {
  return safeArray(items).slice(0, 4).map((item) => ({
    id: item?._id || item?.notification_id || item?.id || Math.random().toString(36).slice(2),
    title: item?.title || 'Thông báo hệ thống',
    message: item?.message || '',
    created_at: item?.created_at || item?.scheduled_at || null,
    status: item?.status || 'sent',
  }));
}

function mapAppointmentRows(items = []) {
  return safeArray(items)
    .slice()
    .sort((left, right) => new Date(left?.appointment_time) - new Date(right?.appointment_time))
    .slice(0, 5)
    .map((item) => ({
      id: item?.appointment_id || item?.id,
      time: formatClock(item?.appointment_time),
      patientName: item?.patient_name || 'Chưa rõ',
      doctorName: item?.doctor_name || 'Chưa gán bác sĩ',
      departmentName: item?.department_name || 'Chưa gán khoa',
      status: item?.status || 'booked',
      statusLabel: (STATUS_META.appointment[item?.status] || {}).label || item?.status || 'Unknown',
    }));
}

function mapQueueRows(items = []) {
  return safeArray(items)
    .filter((item) => ['waiting', 'called', 'recalled', 'in_service'].includes(item?.status))
    .slice(0, 5)
    .map((item, index) => ({
      id: item?.queue_ticket_id || item?.id,
      order: index + 1,
      queueNumber: item?.queue_number || '--',
      patientName: item?.patient_name || 'Chưa rõ',
      departmentName: item?.department_name || 'Chưa gán khoa',
      waitingTime: formatMinutesBetween(item?.checkin_time),
      status: item?.status || 'waiting',
      statusLabel: (STATUS_META.queue[item?.status] || {}).label || item?.status || 'Unknown',
    }));
}

function mapEncounterRows(items = []) {
  return safeArray(items)
    .filter((item) => ['arrived', 'in_progress', 'on_hold'].includes(item?.status))
    .slice()
    .sort((left, right) => new Date(left?.start_time) - new Date(right?.start_time))
    .slice(0, 5)
    .map((item) => ({
      id: item?.encounter_id || item?.id,
      patientName: item?.patient?.full_name || 'Chưa rõ',
      doctorName: item?.attending_doctor?.full_name || 'Chưa gán bác sĩ',
      departmentName: item?.department?.department_name || 'Chưa gán khoa',
      status: item?.status || 'arrived',
      statusLabel: (STATUS_META.encounter[item?.status] || {}).label || item?.status || 'Unknown',
      elapsed: formatMinutesBetween(item?.start_time),
    }));
}

function mapScheduleDoctors(items = []) {
  return safeArray(items).slice(0, 5).map((item) => ({
    id: item?.id || item?.doctor_id || item?.label,
    name: item?.label || item?.doctor_name || 'Chưa xác định',
    utilizationRate: toNumber(item?.utilization_rate),
    bookedSlots: toNumber(item?.booked_slots),
    totalSlots: toNumber(item?.total_slots),
    schedulesCount: toNumber(item?.schedules_count),
  }));
}

function mapTodaySchedules(items = []) {
  return safeArray(items).slice(0, 4).map((item) => ({
    id: item?.doctor_schedule_id || item?.id,
    doctorName: item?.doctor_name || 'Chưa xác định',
    departmentName: item?.department_name || 'Chưa gán khoa',
    shift: `${formatClock(item?.shift_start)} - ${formatClock(item?.shift_end)}`,
    utilizationRate: toNumber(item?.utilization_rate),
  }));
}

function mapDepartmentRows(items = []) {
  return safeArray(items).slice(0, 6).map((item) => ({
    id: item?.department_id || item?.id,
    name: item?.department_name || 'Chưa xác định',
    appointments: toNumber(item?.appointment_count),
    completedAppointments: toNumber(item?.completed_appointment_count),
    encounters: toNumber(item?.encounter_count),
    completedEncounters: toNumber(item?.completed_encounter_count),
    noShows: toNumber(item?.no_show_count),
    waitAverage: toNumber(item?.queue_waiting_average),
    revenue: toNumber(item?.revenue_amount),
  }));
}

function mapDashboardCards(cards = []) {
  const toneByKey = {
    today_appointments: 'info',
    today_checked_in: 'success',
    active_encounters: 'info',
    unpaid_invoices: 'danger',
    today_revenue: 'success',
    low_stock_count: 'warning',
    active_queue: 'warning',
    completed_today: 'success',
  };

  return safeArray(cards).slice(0, 6).map((item) => ({
    key: item?.key || item?.label,
    label: item?.label || 'Chỉ số',
    value: item?.key === 'today_revenue' || String(item?.label || '').toLowerCase().includes('doanh thu')
      ? formatCurrency(item?.value)
      : formatInteger(item?.value),
    tone: toneByKey[item?.key] || 'info',
  }));
}

function mapSystemEvents(auditEvents = [], operationAlerts = []) {
  const auditItems = safeArray(auditEvents).map((item) => ({
    id: item?._id || item?.audit_log_id || item?.id || `${item?.action}-${item?.created_at}`,
    time: item?.created_at,
    title: item?.message || item?.action || 'Hoạt động hệ thống',
  }));
  const alertItems = safeArray(operationAlerts).map((item) => ({
    id: item?.id || item?.key || item?.message || Math.random().toString(36).slice(2),
    time: item?.created_at || item?.time || null,
    title: item?.message || item?.title || item?.label || 'Cảnh báo vận hành',
  }));

  return [...auditItems, ...alertItems]
    .filter((item) => item.title)
    .sort((left, right) => new Date(right.time || 0) - new Date(left.time || 0))
    .slice(0, 5);
}

function mapScheduleDepartments(items = []) {
  return safeArray(items).slice(0, 5).map((item) => ({
    id: item?.department_id || item?.id || item?.label,
    name: item?.label || item?.department_name || 'Chưa xác định',
    schedules: toNumber(item?.schedules_count),
    bookedSlots: toNumber(item?.booked_slots),
    totalSlots: toNumber(item?.total_slots),
    utilizationRate: toNumber(item?.utilization_rate),
  }));
}

function Sparkline({ points = [], colorClass = 'is-info' }) {
  const normalized = createSparkPoints(points);
  const max = Math.max(...normalized, 1);
  const min = Math.min(...normalized, 0);
  const range = Math.max(max - min, 1);
  const path = normalized
    .map((point, index) => {
      const x = (index / Math.max(normalized.length - 1, 1)) * 100;
      const y = 100 - ((point - min) / range) * 100;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg className={`reception-kpi-card__sparkline ${colorClass}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function SidebarMenuItem({
  item,
  collapsed,
  activeKey,
  isActive,
  isOpen,
  onActivate,
  onToggle,
}) {
  const Icon = item.icon;
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  return (
    <div className={`reception-sidebar__item ${isActive ? 'is-active' : ''} ${hasChildren ? 'has-children' : ''} ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="reception-sidebar__button"
        onClick={() => {
          onActivate(item.key);
          if (hasChildren) onToggle(item.key);
        }}
      >
        <span className="reception-sidebar__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        {!collapsed ? <span className="reception-sidebar__label">{item.label}</span> : null}
        {!collapsed && item.badge ? <span className="reception-sidebar__badge">{item.badge}</span> : null}
        {!collapsed && hasChildren ? (
          <span className="reception-sidebar__chevron" aria-hidden="true">
            <ChevronDown size={16} />
          </span>
        ) : null}
      </button>

      {!collapsed && hasChildren && isOpen ? (
        <div className="reception-sidebar__submenu">
          {item.children.map((child) => (
            <button
              key={child.key}
              type="button"
              className={`reception-sidebar__submenu-item ${activeKey === child.key ? 'is-active' : ''}`}
              onClick={() => onActivate(child.key)}
            >
              <span />
              <span>{child.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DonutPanel({ title, items, total, emptyText = 'Không có dữ liệu' }) {
  const normalizedItems = safeArray(items);
  const totalValue = normalizedItems.reduce((sum, item) => sum + toNumber(item.value), 0) || toNumber(total);

  return (
    <article className="reception-panel">
      <header className="reception-panel__header reception-panel__header--compact">
        <div>
          <h2>{title}</h2>
        </div>
      </header>
      {normalizedItems.length ? (
        <div className="reception-donut-panel">
          <div className="reception-donut-panel__chart">
            <div className="reception-donut" style={{ background: buildConicGradient(normalizedItems) }}>
              <div className="reception-donut__center">
                <span>Tổng</span>
                <strong>{formatInteger(totalValue)}</strong>
              </div>
            </div>
          </div>
          <div className="reception-donut-panel__legend">
            {normalizedItems.map((item) => {
              const percent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
              return (
                <div key={item.key} className="reception-legend-row">
                  <span className="reception-legend-row__dot" style={{ backgroundColor: item.color }} />
                  <span className="reception-legend-row__label">{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{formatPercent(percent)}</small>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="reception-empty-panel">{emptyText}</div>
      )}
    </article>
  );
}

function LineTrendPanel({ title, totalLabel, totalValue, series, emptyText = 'Không có dữ liệu doanh thu' }) {
  const items = safeArray(series);
  const max = Math.max(...items.map((item) => item.value), 1);
  const path = items
    .map((item, index) => {
      const x = (index / Math.max(items.length - 1, 1)) * 100;
      const y = 100 - (item.value / max) * 100;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <article className="reception-panel">
      <header className="reception-panel__header reception-panel__header--compact">
        <div>
          <h2>{title}</h2>
          <p>{totalLabel}</p>
          <strong className="reception-trend-panel__value">{totalValue}</strong>
        </div>
      </header>
      {items.length ? (
        <div className="reception-trend-panel">
          <svg className="reception-trend-panel__chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="reception-trend-panel__area" d={`${path} L 100 100 L 0 100 Z`} />
            <path className="reception-trend-panel__line" d={path} />
          </svg>
          <div className="reception-trend-panel__axis">
            {items.map((item) => (
              <span key={item.key}>{item.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="reception-empty-panel">{emptyText}</div>
      )}
    </article>
  );
}

function StatusBadge({ status, category }) {
  const meta = STATUS_META[category]?.[status] || { label: status || 'Unknown', tone: 'neutral' };
  return <span className={`reception-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

export function ReceptionDashboardPage() {
  const navigate = useNavigate();
  const auth = readStoredAuth();
  const actorName = getStaffActorName(auth);
  const actorDepartmentId = getActorDepartmentId(auth);
  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [activeMenu, setActiveMenu] = useState('overview');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authContext, setAuthContext] = useState({
    loading: true,
    error: '',
    profile: null,
    roles: [],
    permissions: [],
    session: null,
    loginHistory: [],
  });
  const [openMenus, setOpenMenus] = useState({
    appointments: true,
    checkin: true,
    queue: true,
    patients: false,
    doctors: true,
    payments: false,
    notifications: false,
    reports: false,
    settings: false,
  });
  const [dashboardState, setDashboardState] = useState({
    loading: true,
    error: '',
    data: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadAuthContext() {
      setAuthContext((current) => ({
        ...current,
        loading: true,
        error: '',
      }));

      try {
        const [profilePayload, rolesPayload, permissionsPayload, sessionPayload, loginHistoryPayload] = await Promise.all([
          staffAuthApi.getMe(),
          safeOptionalRequest(() => staffAuthApi.getMyRoles()),
          safeOptionalRequest(() => staffAuthApi.getMyPermissions()),
          safeOptionalRequest(() => staffAuthApi.getCurrentSession()),
          safeOptionalRequest(() => staffAuthApi.getMyLoginHistory({ limit: 3, page: 1 })),
        ]);

        if (!isMounted) return;

        setAuthContext({
          loading: false,
          error: '',
          profile: profilePayload?.profile || null,
          roles: safeArray(rolesPayload?.roles),
          permissions: safeArray(permissionsPayload?.permissions),
          session: sessionPayload?.session || null,
          loginHistory: safeArray(loginHistoryPayload?.items),
        });
      } catch (error) {
        if (!isMounted) return;

        setAuthContext({
          loading: false,
          error: error?.message || 'Không thể tải thông tin phiên đăng nhập.',
          profile: null,
          roles: [],
          permissions: [],
          session: null,
          loginHistory: [],
        });
      }
    }

    loadAuthContext();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setDashboardState((current) => ({
        ...current,
        loading: true,
        error: '',
      }));

      try {
        const today = getDateKey(0);
        const yesterday = getDateKey(-1);
        const last7Days = buildDateRange(7);

        const [departmentDashboard, systemDashboard] = await Promise.all([
          actorDepartmentId
            ? safeOptionalRequest(() => receptionDashboardApi.getDepartmentDashboard(actorDepartmentId))
            : Promise.resolve(null),
          safeOptionalRequest(() => receptionDashboardApi.getSystemDashboard()),
        ]);
        const scopedDashboard = departmentDashboard || systemDashboard;

        const [
          appointmentSummary,
          appointmentSummaryYesterday,
          appointmentsToday,
          queueSummary,
          queueSummaryYesterday,
          queueTickets,
          appointmentReport,
          queueReport,
          encounterReport,
          encountersToday,
          revenueTodayReport,
          revenueTrendReport,
          schedulingSummary,
          schedulingDepartmentSummary,
          schedulingDateRangeSummary,
          unreadNotifications,
          notifications,
          departmentReport,
        ] = await Promise.all([
          receptionDashboardApi.getAppointmentSummary({ date: today }),
          receptionDashboardApi.getAppointmentSummary({ date: yesterday }),
          receptionDashboardApi.getTodayAppointments({ limit: 8, page: 1 }),
          receptionDashboardApi.getQueueSummaryToday({ date: today }),
          receptionDashboardApi.getQueueSummaryToday({ date: yesterday }),
          receptionDashboardApi.getQueueTickets({ date: today, limit: 10, page: 1 }),
          safeOptionalRequest(() => receptionDashboardApi.getAppointmentReport({ date: today })),
          safeOptionalRequest(() => receptionDashboardApi.getQueueReport({ date: today })),
          safeOptionalRequest(() => receptionDashboardApi.getEncounterReport({ date: today })),
          safeOptionalRequest(() => receptionDashboardApi.getTodayEncounters({ limit: 10, page: 1 })),
          safeOptionalRequest(() => receptionDashboardApi.getRevenueReport({ date_from: today, date_to: today })),
          safeOptionalRequest(() => receptionDashboardApi.getRevenueReport(last7Days)),
          safeOptionalRequest(() => receptionDashboardApi.getSchedulingSystemSummary({ preset: 'today', ...(actorDepartmentId ? { department_id: actorDepartmentId } : {}) })),
          safeOptionalRequest(() => receptionDashboardApi.getSchedulingDepartmentSummary({ preset: 'today' })),
          safeOptionalRequest(() => receptionDashboardApi.getSchedulingDateRangeSummary({ ...last7Days })),
          safeOptionalRequest(() => receptionDashboardApi.getUnreadNotificationsCount()),
          safeOptionalRequest(() => receptionDashboardApi.getNotifications({ limit: 4, page: 1 })),
          safeOptionalRequest(() => receptionDashboardApi.getDepartmentReport({ date: today })),
        ]);

        const activeEncounters =
          encounterReport
            ? toNumber(encounterReport?.summary?.arrived_count)
              + toNumber(encounterReport?.summary?.in_progress_count)
              + toNumber(encounterReport?.summary?.on_hold_count)
            : readCardValue(scopedDashboard?.cards, 'active_encounters');

        const completedToday =
          encounterReport
            ? toNumber(encounterReport?.summary?.completed_count)
            : readCardValue(scopedDashboard?.cards, 'completed_today');

        const todayRevenue =
          revenueTodayReport?.summary?.paid_amount !== undefined
            ? toNumber(revenueTodayReport.summary.paid_amount)
            : readCardValue(scopedDashboard?.cards, 'today_revenue');

        const encounterYesterday = await safeOptionalRequest(() => receptionDashboardApi.getEncounterReport({ date: yesterday }));
        const activeEncountersYesterday =
          encounterYesterday
            ? toNumber(encounterYesterday?.summary?.arrived_count)
              + toNumber(encounterYesterday?.summary?.in_progress_count)
              + toNumber(encounterYesterday?.summary?.on_hold_count)
            : 0;
        const completedYesterday =
          encounterYesterday ? toNumber(encounterYesterday?.summary?.completed_count) : 0;
        const revenueYesterday = await safeOptionalRequest(() => receptionDashboardApi.getRevenueReport({
          date_from: yesterday,
          date_to: yesterday,
        }));
        const paidYesterday = toNumber(revenueYesterday?.summary?.paid_amount);
        const appointmentBreakdown = normalizeBreakdown(
          appointmentReport?.breakdowns?.by_status,
          'appointment',
        );
        const queueBreakdown = normalizeBreakdown(queueReport?.breakdowns?.by_status, 'queue');
        const encounterBreakdown = normalizeBreakdown(
          scopedDashboard?.charts?.encounters_by_status || encounterReport?.breakdowns?.by_status,
          'encounter',
        );
        const fallbackAppointmentBreakdown = buildBreakdownFromSummary(
          appointmentSummary,
          [
            { status: 'booked', field: 'booked' },
            { status: 'confirmed', field: 'confirmed' },
            { status: 'checked_in', field: 'checked_in' },
            { status: 'in_consultation', field: 'in_consultation' },
            { status: 'completed', field: 'completed' },
            { status: 'cancelled', field: 'cancelled' },
            { status: 'no_show', field: 'no_show' },
            { status: 'rescheduled', field: 'rescheduled' },
          ],
          'appointment',
        );
        const fallbackQueueBreakdown = buildBreakdownFromSummary(
          queueSummary,
          [
            { status: 'waiting', field: 'waiting' },
            { status: 'called', field: 'called' },
            { status: 'recalled', field: 'recalled' },
            { status: 'in_service', field: 'in_service' },
            { status: 'completed', field: 'completed' },
            { status: 'cancelled', field: 'cancelled' },
            { status: 'skipped', field: 'skipped' },
          ],
          'queue',
        );
        const fallbackEncounterBreakdown = buildBreakdownFromSummary(
          encounterReport?.summary,
          [
            { status: 'planned', field: 'planned_count' },
            { status: 'arrived', field: 'arrived_count' },
            { status: 'in_progress', field: 'in_progress_count' },
            { status: 'on_hold', field: 'on_hold_count' },
            { status: 'completed', field: 'completed_count' },
            { status: 'cancelled', field: 'cancelled_count' },
          ],
          'encounter',
        );

        const metrics = [
          {
            key: 'appointments',
            label: 'Lịch hẹn hôm nay',
            value: formatInteger(appointmentSummary?.total),
            icon: CalendarDays,
            tone: 'info',
            delta: computeDelta(appointmentSummary?.total, appointmentSummaryYesterday?.total),
            spark: createSparkPoints(appointmentReport?.breakdowns?.by_day?.map((item) => item?.count) || []),
          },
          {
            key: 'checked-in',
            label: 'Đã check-in hôm nay',
            value: formatInteger(appointmentSummary?.checked_in),
            icon: CheckCircle2,
            tone: 'success',
            delta: computeDelta(appointmentSummary?.checked_in, appointmentSummaryYesterday?.checked_in),
            spark: createSparkPoints(appointmentReport?.breakdowns?.by_status?.map((item) => item?.count) || []),
          },
          {
            key: 'encounters-active',
            label: 'Encounter đang xử lý',
            value: formatInteger(activeEncounters),
            icon: Activity,
            tone: 'info',
            delta: computeDelta(activeEncounters, activeEncountersYesterday),
            spark: createSparkPoints(encounterReport?.breakdowns?.by_day?.map((item) => item?.count) || []),
          },
          {
            key: 'completed',
            label: 'Hoàn tất hôm nay',
            value: formatInteger(completedToday),
            icon: CheckCircle2,
            tone: 'success',
            delta: computeDelta(completedToday, completedYesterday),
            spark: createSparkPoints([
              toNumber(encounterReport?.summary?.arrived_count),
              toNumber(encounterReport?.summary?.in_progress_count),
              toNumber(encounterReport?.summary?.completed_count),
            ]),
          },
          {
            key: 'queue',
            label: 'Queue đang chờ',
            value: formatInteger(queueSummary?.waiting),
            icon: Users,
            tone: 'warning',
            delta: computeDelta(queueSummary?.waiting, queueSummaryYesterday?.waiting),
            spark: createSparkPoints(queueReport?.breakdowns?.peak_hours?.map((item) => item?.count) || []),
          },
          {
            key: 'notifications',
            label: 'Thông báo chưa đọc',
            value: formatInteger(unreadNotifications?.unread_count),
            icon: Bell,
            tone: 'danger',
            delta: {
              text: toNumber(unreadNotifications?.unread_count) > 0 ? 'Cần rà soát ngay trong ca' : 'Không có cảnh báo mới',
              trend: toNumber(unreadNotifications?.unread_count) > 0 ? 'up' : 'neutral',
            },
            spark: createSparkPoints([0, 0, toNumber(unreadNotifications?.unread_count)]),
          },
        ];

        const normalizedData = {
          today,
          metrics,
          appointmentStatus: appointmentBreakdown.length ? appointmentBreakdown : fallbackAppointmentBreakdown,
          queueStatus: queueBreakdown.length ? queueBreakdown : fallbackQueueBreakdown,
          encounterStatus: encounterBreakdown.length ? encounterBreakdown : fallbackEncounterBreakdown,
          revenue: {
            total: todayRevenue,
            series: normalizeLineSeries(revenueTrendReport?.breakdowns?.revenue_by_day, 'amount'),
          },
          tables: {
            appointments: mapAppointmentRows(appointmentsToday?.items),
            queue: mapQueueRows(queueTickets?.items),
            encounters: mapEncounterRows(encountersToday?.items),
          },
          scheduleOverview: {
            overview: schedulingSummary?.overview || null,
            todaySchedules: mapTodaySchedules(schedulingSummary?.today_schedules),
            topDoctors: mapScheduleDoctors(schedulingSummary?.by_doctor),
            departments: mapScheduleDepartments(
              schedulingDepartmentSummary?.items
              || schedulingDepartmentSummary?.by_department
              || schedulingSummary?.by_department,
            ),
            rangeSeries: normalizeLineSeries(schedulingDateRangeSummary?.utilization_series, 'value'),
          },
          departments: {
            summary: departmentReport?.summary || null,
            items: mapDepartmentRows(departmentReport?.items),
          },
          systemReport: {
            cards: mapDashboardCards((systemDashboard || scopedDashboard)?.cards),
            events: mapSystemEvents(systemDashboard?.recent_audit_events, schedulingSummary?.operation_alerts),
          },
          notifications: mapNotifications(notifications?.items),
          scopedDashboard,
        };

        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: '',
          data: normalizedData,
        });
      } catch (error) {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: error?.message || 'Không thể tải dashboard lễ tân.',
          data: null,
        });
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [actorDepartmentId]);

  const data = dashboardState.data;
  const todayLabel = useMemo(() => formatDateLabel(new Date()), []);
  const unreadCount = useMemo(
    () => safeArray(data?.metrics).find((item) => item.key === 'notifications')?.value || '0',
    [data],
  );
  const topbarUser = getProfileUser(authContext.profile, auth);
  const topbarName = topbarUser?.full_name || actorName;
  const availableRoles = authContext.roles.length ? authContext.roles : topbarUser?.roles;
  const roleCodes = normalizeRoleCodes(availableRoles);
  const roleLabels = normalizeRoleLabels(availableRoles);
  const permissionCount = authContext.permissions.length || safeArray(topbarUser?.permissions).length || 0;
  const isReceptionistRole = roleCodes.includes('receptionist')
    || safeArray(authContext.permissions).some((permission) => (
      permission === 'appointments.checkin'
      || permission === 'queue.read'
      || permission === 'queue.call'
      || permission === 'patients.search'
    ));
  const topbarRoleLabel = isReceptionistRole
    ? 'Receptionist'
    : (roleLabels[0] || 'Staff');
  const departmentName = authContext.profile?.department?.department_name
    || (actorDepartmentId ? 'Khoa phụ trách' : 'Toàn hệ thống');
  const latestLogin = authContext.loginHistory[0];
  const appointmentMode = APPOINTMENT_MENU_MODES[activeMenu] || null;
  const workflowMode = !appointmentMode && (activeMenu.startsWith('checkin-') || activeMenu.startsWith('queue-'))
    ? activeMenu
    : null;

  function handleToggleMenu(key) {
    setOpenMenus((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function handleActivateMenu(key) {
    setActiveMenu(key);
  }

  async function handleLogout() {
    const refreshToken = readStoredAuth()?.tokens?.refresh_token;

    try {
      await staffAuthApi.logout(refreshToken);
    } catch (error) {
      // Backend logout is best-effort here; clearing local auth still ends the UI session.
    }

    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  return (
    <main className={`reception-dashboard ${collapsedSidebar ? 'is-sidebar-collapsed' : ''}`}>
      <aside className="reception-sidebar" aria-label="Menu lễ tân">
        <div className="reception-sidebar__brand">
          <Link className="reception-sidebar__brand-link" to="/staff/select-workspace">
            <span className="reception-sidebar__brand-mark" aria-hidden="true">
              <span />
            </span>
            {!collapsedSidebar ? (
              <span className="reception-sidebar__brand-text">
                <strong>MedCare HMS</strong>
                <small>Reception Workspace</small>
              </span>
            ) : null}
          </Link>
        </div>

        <nav className="reception-sidebar__nav">
          {SIDEBAR_SECTIONS.map((item) => {
            const resolvedItem = item.key === 'notifications'
              ? { ...item, badge: unreadCount === '0' ? '' : unreadCount }
              : item;
            const isOpen = Boolean(openMenus[item.key]);
            const isActive = activeMenu === item.key || item.children?.some((child) => child.key === activeMenu);

            return (
              <SidebarMenuItem
                key={item.key}
                item={resolvedItem}
                collapsed={collapsedSidebar}
                activeKey={activeMenu}
                isActive={isActive}
                isOpen={isOpen}
                onActivate={handleActivateMenu}
                onToggle={handleToggleMenu}
              />
            );
          })}
        </nav>

        <div className="reception-sidebar__support">
          {!collapsedSidebar ? (
            <div className="reception-sidebar__support-card">
              <Headset size={18} />
              <div>
                <strong>Trợ giúp và hỗ trợ</strong>
                <span>Cập nhật quy trình tiếp nhận</span>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="reception-sidebar__collapse"
            onClick={() => setCollapsedSidebar((current) => !current)}
          >
            <ChevronLeft size={18} className={collapsedSidebar ? 'is-rotated' : ''} />
            {!collapsedSidebar ? <span>Thu gọn menu</span> : null}
          </button>
        </div>
      </aside>

      <div className="reception-main">
        <header className="reception-header">
          <div className="reception-header__heading">
            <h1>Dashboard Receptionist</h1>
            <p>{departmentName} · {formatInteger(permissionCount)} quyền khả dụng</p>
          </div>

          <div className="reception-header__search">
            <Search size={18} />
            <input type="search" placeholder="Tìm bệnh nhân, lịch hẹn, mã hồ sơ..." />
          </div>

          <div className="reception-header__filters">
            <button type="button" className="reception-toolbar-pill">
              <CalendarDays size={16} />
              <span>{todayLabel}</span>
            </button>
            <button type="button" className="reception-toolbar-pill">
              <MapPin size={16} />
              <span>{actorDepartmentId ? 'Theo khoa phụ trách' : 'Toàn hệ thống'}</span>
            </button>
          </div>

          <div className="reception-header__profile">
            <button type="button" className="reception-header__alert" aria-label="Thông báo chưa đọc">
              <Bell size={18} />
              <span>{formatInteger(data?.metrics?.find((item) => item.key === 'notifications')?.value || 0)}</span>
            </button>

            <div className={`reception-topbar-profile ${isProfileOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="reception-topbar-profile__trigger"
                onClick={() => setIsProfileOpen((current) => !current)}
                aria-expanded={isProfileOpen}
              >
                <span className="reception-avatar-badge reception-avatar-badge--cyan">{getInitials(topbarName)}</span>
                <span className="reception-topbar-profile__copy">
                  <strong>{topbarName}</strong>
                  <span>{topbarRoleLabel}</span>
                </span>
                <ChevronDown size={16} />
              </button>

              {isProfileOpen ? (
                <div className="reception-topbar-profile__menu">
                  <div className="reception-topbar-profile__summary">
                    <span className="reception-avatar-badge reception-avatar-badge--cyan">{getInitials(topbarName)}</span>
                    <div>
                      <strong>{topbarName}</strong>
                      <span>{topbarUser?.email || topbarUser?.username || 'Tài khoản nhân sự'}</span>
                    </div>
                  </div>

                  {authContext.error ? (
                    <div className="reception-topbar-profile__warning">
                      <ShieldAlert size={15} />
                      <span>{authContext.error}</span>
                    </div>
                  ) : null}

                  <div className="reception-topbar-profile__meta">
                    <div>
                      <ShieldCheck size={16} />
                      <span>{roleLabels.slice(0, 2).join(', ') || topbarRoleLabel}</span>
                    </div>
                    <div>
                      <KeyRound size={16} />
                      <span>{formatInteger(permissionCount)} quyền</span>
                    </div>
                    <div>
                      <Monitor size={16} />
                      <span>{getSessionDeviceLabel(authContext.session)}</span>
                    </div>
                    <div>
                      <Clock3 size={16} />
                      <span>
                        {authContext.session?.last_used_at
                          ? `Hoạt động ${formatClock(authContext.session.last_used_at)}`
                          : 'Phiên hiện tại'}
                      </span>
                    </div>
                  </div>

                  {latestLogin ? (
                    <div className="reception-topbar-profile__login">
                      <strong>Lần đăng nhập gần nhất</strong>
                      <span>{getLoginStatusText(latestLogin)}</span>
                      <small>
                        {formatDateLabel(latestLogin.created_at)} {formatClock(latestLogin.created_at)}
                        {' · '}
                        {latestLogin.ip_address || 'IP không rõ'}
                      </small>
                    </div>
                  ) : null}

                  <button type="button" className="reception-topbar-profile__logout" onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {appointmentMode ? (
          <ReceptionAppointmentsPanel mode={appointmentMode} onNavigate={handleActivateMenu} />
        ) : workflowMode ? (
          <ReceptionCheckInQueuePanel mode={workflowMode} onNavigate={handleActivateMenu} />
        ) : (
          <>
        {dashboardState.error ? (
          <section className="reception-panel reception-panel--error">
            <div className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Không tải được dashboard</h2>
                <p>{dashboardState.error}</p>
              </div>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => window.location.reload()}>
                <RefreshCw size={16} />
                <span>Tải lại</span>
              </button>
            </div>
          </section>
        ) : null}

        <section className="reception-kpi-grid" aria-label="Chỉ số điều hành">
          {safeArray(data?.metrics).map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.key} className={`reception-kpi-card is-${metric.tone}`}>
                <div className="reception-kpi-card__header">
                  <div>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                  <span className="reception-kpi-card__icon">
                    <Icon size={20} />
                  </span>
                </div>
                <div className="reception-kpi-card__footer">
                  <small className={`is-${metric.delta?.trend || 'neutral'}`}>{metric.delta?.text || 'Không có biến động'}</small>
                  <Sparkline
                    points={metric.spark}
                    colorClass={metric.tone === 'success' ? 'is-success' : metric.tone === 'warning' ? 'is-warning' : metric.tone === 'danger' ? 'is-danger' : 'is-info'}
                  />
                </div>
              </article>
            );
          })}
          {dashboardState.loading && !data ? (
            Array.from({ length: 6 }).map((_, index) => (
              <article key={`loading-kpi-${index}`} className="reception-kpi-card is-loading">
                <div className="reception-skeleton-block reception-skeleton-block--title" />
                <div className="reception-skeleton-block reception-skeleton-block--value" />
              </article>
            ))
          ) : null}
        </section>

        <section className="reception-dashboard-grid reception-dashboard-grid--analytics">
          <DonutPanel
            title="Lịch hẹn theo trạng thái"
            items={data?.appointmentStatus}
            total={data?.appointmentStatus?.reduce((sum, item) => sum + item.value, 0)}
          />
          <DonutPanel
            title="Queue theo trạng thái"
            items={data?.queueStatus}
            total={data?.queueStatus?.reduce((sum, item) => sum + item.value, 0)}
          />
          <DonutPanel
            title="Encounter theo trạng thái"
            items={data?.encounterStatus}
            total={data?.encounterStatus?.reduce((sum, item) => sum + item.value, 0)}
          />
          <LineTrendPanel
            title="Doanh thu thực thu"
            totalLabel="Tổng thu trong 7 ngày gần nhất"
            totalValue={formatCurrency(data?.revenue?.total)}
            series={data?.revenue?.series}
          />
        </section>

        <section className="reception-dashboard-grid reception-dashboard-grid--tables">
          <article className="reception-panel">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Lịch hẹn hôm nay</h2>
                <p>Các lịch cần tiếp nhận và theo dõi trong ngày.</p>
              </div>
            </header>
            <div className="reception-data-table-wrap">
              <table className="reception-data-table">
                <thead>
                  <tr>
                    <th>Giờ hẹn</th>
                    <th>Bệnh nhân</th>
                    <th>Bác sĩ</th>
                    <th>Khoa</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {safeArray(data?.tables?.appointments).map((item) => (
                    <tr key={item.id}>
                      <td>{item.time}</td>
                      <td>{item.patientName}</td>
                      <td>{item.doctorName}</td>
                      <td>{item.departmentName}</td>
                      <td><StatusBadge status={item.status} category="appointment" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!safeArray(data?.tables?.appointments).length && !dashboardState.loading ? (
                <div className="reception-empty-panel">Không có lịch hẹn trong ngày.</div>
              ) : null}
            </div>
          </article>

          <article className="reception-panel">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Queue đang chờ</h2>
                <p>Bệnh nhân đã check-in và đang chờ được gọi tiếp theo.</p>
              </div>
            </header>
            <div className="reception-data-table-wrap">
              <table className="reception-data-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Số thứ tự</th>
                    <th>Bệnh nhân</th>
                    <th>Khoa</th>
                    <th>Thời gian chờ</th>
                  </tr>
                </thead>
                <tbody>
                  {safeArray(data?.tables?.queue).map((item) => (
                    <tr key={item.id}>
                      <td>{item.order}</td>
                      <td>{item.queueNumber}</td>
                      <td>{item.patientName}</td>
                      <td>{item.departmentName}</td>
                      <td>{item.waitingTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!safeArray(data?.tables?.queue).length && !dashboardState.loading ? (
                <div className="reception-empty-panel">Không có bệnh nhân đang chờ.</div>
              ) : null}
            </div>
          </article>

          <article className="reception-panel">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Encounter đang xử lý</h2>
                <p>Theo dõi các lượt khám đang diễn ra trong ngày.</p>
              </div>
            </header>
            <div className="reception-data-table-wrap">
              <table className="reception-data-table">
                <thead>
                  <tr>
                    <th>Bệnh nhân</th>
                    <th>Bác sĩ</th>
                    <th>Khoa</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {safeArray(data?.tables?.encounters).map((item) => (
                    <tr key={item.id}>
                      <td>{item.patientName}</td>
                      <td>{item.doctorName}</td>
                      <td>{item.departmentName}</td>
                      <td><StatusBadge status={item.status} category="encounter" /></td>
                      <td>{item.elapsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!safeArray(data?.tables?.encounters).length && !dashboardState.loading ? (
                <div className="reception-empty-panel">Không có encounter đang xử lý trong ngày.</div>
              ) : null}
            </div>
          </article>
        </section>

        <section className="reception-dashboard-grid reception-dashboard-grid--secondary">
          <article className="reception-panel">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Tổng quan scheduling hôm nay</h2>
                <p>Tình trạng lịch làm việc, slot khám và công suất phòng khám.</p>
              </div>
            </header>
            {data?.scheduleOverview?.overview ? (
              <>
                <div className="reception-mini-stat-grid">
                  <div className="reception-mini-stat-card">
                    <span>Tổng lịch làm việc</span>
                    <strong>{formatInteger(data.scheduleOverview.overview.schedules_count)}</strong>
                  </div>
                  <div className="reception-mini-stat-card">
                    <span>Tổng slot</span>
                    <strong>{formatInteger(data.scheduleOverview.overview.total_slots)}</strong>
                  </div>
                  <div className="reception-mini-stat-card">
                    <span>Đã đặt chỗ</span>
                    <strong>{formatInteger(data.scheduleOverview.overview.booked_slots)}</strong>
                  </div>
                  <div className="reception-mini-stat-card">
                    <span>Còn trống</span>
                    <strong>{formatInteger(data.scheduleOverview.overview.available_slots)}</strong>
                  </div>
                </div>
                <div className="reception-schedule-list">
                  {safeArray(data.scheduleOverview.todaySchedules).slice(0, 3).map((item) => (
                    <div key={item.id} className="reception-schedule-list__item">
                      <div>
                        <strong>{item.doctorName}</strong>
                        <span>{item.departmentName}</span>
                      </div>
                      <div>
                        <strong>{item.shift}</strong>
                        <span>{formatPercent(item.utilizationRate)} công suất</span>
                      </div>
                    </div>
                  ))}
                  {!safeArray(data.scheduleOverview.todaySchedules).length
                    ? safeArray(data.scheduleOverview.departments).map((item) => (
                      <div key={item.id} className="reception-schedule-list__item">
                        <div>
                          <strong>{item.name}</strong>
                          <span>{formatInteger(item.schedules)} lịch làm việc</span>
                        </div>
                        <div>
                          <strong>{formatInteger(item.bookedSlots)}/{formatInteger(item.totalSlots)} slot</strong>
                          <span>{formatPercent(item.utilizationRate)} công suất</span>
                        </div>
                      </div>
                    ))
                    : null}
                </div>
                {safeArray(data.scheduleOverview.rangeSeries).length ? (
                  <div className="reception-range-bars" aria-label="Công suất lịch 7 ngày gần nhất">
                    {data.scheduleOverview.rangeSeries.slice(-7).map((item) => (
                      <div key={item.key || item.label} className="reception-range-bars__item">
                        <span>{item.label}</span>
                        <i>
                          <b style={{ width: `${Math.min(100, Math.max(0, item.value))}%` }} />
                        </i>
                        <strong>{formatPercent(item.value)}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="reception-empty-panel">Tài khoản hiện tại chưa có quyền xem tổng quan scheduling.</div>
            )}
          </article>

          <article className="reception-panel">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Báo cáo khoa/phòng</h2>
                <p>Hiệu suất tiếp nhận, khám và doanh thu theo khoa trong ngày.</p>
              </div>
            </header>
            {safeArray(data?.departments?.items).length ? (
              <div className="reception-data-table-wrap">
                <table className="reception-data-table reception-data-table--compact">
                  <thead>
                    <tr>
                      <th>Khoa</th>
                      <th>Lịch hẹn</th>
                      <th>Hoàn tất</th>
                      <th>Encounter</th>
                      <th>Hoàn tất Encounter</th>
                      <th>No-show</th>
                      <th>Chờ TB</th>
                      <th>Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.departments.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{formatInteger(item.appointments)}</td>
                        <td>{formatInteger(item.completedAppointments)}</td>
                        <td>{formatInteger(item.encounters)}</td>
                        <td>{formatInteger(item.completedEncounters)}</td>
                        <td>{formatInteger(item.noShows)}</td>
                        <td>{item.waitAverage ? `${formatInteger(item.waitAverage)} phút` : '--'}</td>
                        <td>{formatCompactCurrency(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="reception-empty-panel">Chưa có dữ liệu báo cáo khoa/phòng hoặc tài khoản không có quyền truy cập.</div>
            )}
          </article>

          <article className="reception-panel">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Top bác sĩ theo lịch hôm nay</h2>
                <p>Bác sĩ có lịch làm việc và slot đã đặt nhiều nhất.</p>
              </div>
            </header>
            {safeArray(data?.scheduleOverview?.topDoctors).length ? (
              <div className="reception-ranking-list">
                {data.scheduleOverview.topDoctors.map((item) => (
                  <div key={item.id} className="reception-ranking-list__item">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatInteger(item.bookedSlots)}/{formatInteger(item.totalSlots)} slot đã đặt</span>
                    </div>
                    <div>
                      <strong>{formatPercent(item.utilizationRate)}</strong>
                      <span>{formatInteger(item.schedulesCount)} lịch</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="reception-empty-panel">Chưa có dữ liệu bác sĩ trực trong hôm nay.</div>
            )}
          </article>

          <article className="reception-panel">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Thông báo gần đây</h2>
                <p>Cập nhật mới nhất cần lễ tân chú ý trong ca trực.</p>
              </div>
            </header>
            {safeArray(data?.notifications).length ? (
              <div className="reception-notification-feed">
                {data.notifications.map((item) => (
                  <div key={item.id} className="reception-notification-feed__item">
                    <span className={`reception-notification-feed__badge is-${item.status === 'read' ? 'neutral' : 'info'}`}>
                      <Bell size={14} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                    </div>
                    <small>{formatShortDate(item.created_at)} {formatClock(item.created_at)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="reception-empty-panel">Chưa có thông báo nào để hiển thị.</div>
            )}
          </article>

          <article className="reception-panel reception-panel--span-2">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Báo cáo tổng quan hệ thống</h2>
                <p>Tổng hợp nhanh theo phạm vi dữ liệu tài khoản lễ tân được phép xem.</p>
              </div>
            </header>
            {safeArray(data?.systemReport?.cards).length || safeArray(data?.systemReport?.events).length ? (
              <div className="reception-system-report">
                <div className="reception-system-report__cards">
                  {safeArray(data?.systemReport?.cards).map((item) => (
                    <div key={item.key} className={`reception-system-card is-${item.tone}`}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="reception-system-report__events">
                  <h3>Sự kiện hệ thống mới nhất</h3>
                  {safeArray(data?.systemReport?.events).length ? data.systemReport.events.map((item) => (
                    <div key={item.id} className="reception-system-event">
                      <span>{item.time ? formatClock(item.time) : '--:--'}</span>
                      <strong>{item.title}</strong>
                    </div>
                  )) : (
                    <div className="reception-empty-panel reception-empty-panel--compact">
                      Chưa có sự kiện mới.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="reception-empty-panel">Chưa có dữ liệu tổng quan phù hợp với quyền hiện tại.</div>
            )}
          </article>

          <article className="reception-panel reception-panel--span-2">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>Hiệu suất theo khoa hôm nay</h2>
                <p>Đối chiếu lịch làm việc, slot đã đặt và công suất theo khoa.</p>
              </div>
            </header>
            {safeArray(data?.scheduleOverview?.departments).length ? (
              <div className="reception-schedule-department-grid">
                {data.scheduleOverview.departments.map((item) => (
                  <div key={item.id} className="reception-schedule-department">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatInteger(item.schedules)} lịch làm việc</span>
                    </div>
                    <div className="reception-utilization-track">
                      <span style={{ width: `${Math.min(100, Math.max(0, item.utilizationRate))}%` }} />
                    </div>
                    <div>
                      <span>{formatInteger(item.bookedSlots)}/{formatInteger(item.totalSlots)} slot</span>
                      <strong>{formatPercent(item.utilizationRate)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="reception-empty-panel">Chưa có dữ liệu scheduling theo khoa.</div>
            )}
          </article>
        </section>

        <footer className="reception-footer-note">
          <ShieldAlert size={16} />
          <span>
            Số liệu dashboard được đồng bộ theo quyền truy cập hiện tại của tài khoản lễ tân.
          </span>
        </footer>
          </>
        )}
      </div>
    </main>
  );
}
