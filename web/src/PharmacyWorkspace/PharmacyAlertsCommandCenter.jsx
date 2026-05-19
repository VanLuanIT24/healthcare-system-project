import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  Bell,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Gauge,
  Layers3,
  PackagePlus,
  Pill,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  TimerOff,
  UserCheck,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '../utils/api';
import {
  acknowledgePharmacyAlert,
  bulkActionPharmacyAlerts,
  dismissPharmacyAlert,
  loadPharmacyAlertCommandBoard,
  resolvePharmacyAlert,
  snoozePharmacyAlert,
  startPharmacyAlert,
} from './pharmacyApi';

const BOARD_ALIASES = {
  lowStock: 'low-stock',
  outOfStock: 'out-of-stock',
  expiringBatches: 'expiring-batches',
  expiredBatches: 'expired-batches',
  insufficientStock: 'dispense-shortage',
  'insufficient-stock': 'dispense-shortage',
  dispenseShortage: 'dispense-shortage',
  allergy: 'allergy',
  highUsage: 'high-usage',
  lossWaste: 'waste-loss',
  'loss-waste': 'waste-loss',
  wasteLoss: 'waste-loss',
};

const BOARD_CONFIG = {
  'low-stock': {
    eyebrow: 'Nhà thuốc & Kho dược / Cảnh báo',
    title: 'Sắp hết thuốc',
    description: 'Theo dõi thuốc dưới ngưỡng tồn, tốc độ dùng, nhu cầu chờ cấp phát và số lượng cần bổ sung.',
    icon: AlertTriangle,
    tone: 'warning',
    endpoint: 'low-stock',
    tabs: [
      { key: 'all', label: 'Tất cả' },
      { key: 'critical', label: 'Critical', severity: 'critical' },
      { key: 'pending', label: 'Có đơn chờ', predicate: (item) => Number(item.metrics?.pending_demand || 0) > 0 },
      { key: 'under3', label: '<= 3 ngày', predicate: (item) => item.metrics?.days_of_stock_left !== null && Number(item.metrics?.days_of_stock_left || 0) <= 3 },
      { key: 'under7', label: '<= 7 ngày', predicate: (item) => item.metrics?.days_of_stock_left !== null && Number(item.metrics?.days_of_stock_left || 0) <= 7 },
    ],
    kpis: [
      { key: 'below_min_stock', label: 'Thuốc dưới ngưỡng', icon: AlertTriangle, tone: 'warning' },
      { key: 'under_3_days', label: 'Dưới 3 ngày dùng', icon: Clock3, tone: 'danger' },
      { key: 'under_7_days', label: 'Dưới 7 ngày dùng', icon: CalendarClock, tone: 'info' },
      { key: 'with_pending_dispense', label: 'Có đơn chờ cấp', icon: ClipboardList, tone: 'purple' },
      { key: 'shortage_quantity', label: 'Cần bổ sung', icon: PackagePlus, tone: 'neutral' },
    ],
  },
  'out-of-stock': {
    eyebrow: 'Nhà thuốc & Kho dược / Cảnh báo',
    title: 'Hết thuốc',
    description: 'Phát hiện thuốc không còn tồn khả dụng, còn tồn bị chặn hoặc đang ảnh hưởng tới đơn cấp phát.',
    icon: Ban,
    tone: 'danger',
    endpoint: 'out-of-stock',
    tabs: [
      { key: 'all', label: 'Tất cả' },
      { key: 'system', label: 'Hết toàn hệ thống', predicate: (item) => Number(item.inventory?.total_on_hand || 0) <= 0 },
      { key: 'blocked', label: 'Còn tồn bị chặn', predicate: (item) => Number(item.inventory?.blocked_on_hand || 0) > 0 },
      { key: 'pending', label: 'Có đơn chờ', predicate: (item) => Number(item.metrics?.pending_demand || 0) > 0 },
      { key: 'critical', label: 'Critical', severity: 'critical' },
    ],
    kpis: [
      { key: 'system_out_of_stock', label: 'Hết toàn hệ thống', icon: Ban, tone: 'danger' },
      { key: 'blocked_stock_only', label: 'Tồn bị chặn', icon: ShieldAlert, tone: 'warning' },
      { key: 'affected_prescriptions', label: 'Đơn ảnh hưởng', icon: ClipboardList, tone: 'purple' },
      { key: 'affected_patients', label: 'BN ảnh hưởng', icon: UserCheck, tone: 'info' },
    ],
  },
  'expiring-batches': {
    eyebrow: 'Nhà thuốc & Kho dược / Cảnh báo',
    title: 'Lô sắp hết hạn',
    description: 'Timeline FEFO cho lô còn hạn ngắn, giá trị tồn có nguy cơ hủy và khuyến nghị chuyển/kích hoạt dùng trước.',
    icon: TimerOff,
    tone: 'warning',
    endpoint: 'expiring-batches',
    tabs: [
      { key: 'all', label: 'Tất cả' },
      { key: '7d', label: '<= 7 ngày', predicate: (item) => Number(item.metrics?.days_to_expiry || 0) <= 7 },
      { key: '30d', label: '<= 30 ngày', predicate: (item) => Number(item.metrics?.days_to_expiry || 0) <= 30 },
      { key: '90d', label: '<= 90 ngày', predicate: (item) => Number(item.metrics?.days_to_expiry || 0) <= 90 },
      { key: 'highValue', label: 'Giá trị cao', predicate: (item) => Number(item.metrics?.value_at_risk || 0) >= 10000000 },
    ],
    kpis: [
      { key: 'expiring_7d', label: 'Trong 7 ngày', icon: AlertTriangle, tone: 'danger' },
      { key: 'expiring_30d', label: 'Trong 30 ngày', icon: TimerOff, tone: 'warning' },
      { key: 'expiring_90d', label: 'Trong 90 ngày', icon: CalendarClock, tone: 'info' },
      { key: 'total_value_at_risk', label: 'Giá trị rủi ro', icon: Gauge, tone: 'neutral', currency: true },
      { key: 'fefo_priority', label: 'Cần FEFO', icon: Layers3, tone: 'purple' },
    ],
  },
  'expired-batches': {
    eyebrow: 'Nhà thuốc & Kho dược / Cảnh báo',
    title: 'Lô đã hết hạn',
    description: 'Kiểm soát lô quá hạn, tồn cần hủy, giá trị cần lập biên bản và trạng thái xử lý.',
    icon: AlertTriangle,
    tone: 'danger',
    endpoint: 'expired-batches',
    tabs: [
      { key: 'all', label: 'Tất cả' },
      { key: 'pending', label: 'Chưa xử lý', predicate: (item) => Number(item.metrics?.quantity_on_hand || 0) > 0 || item.batch?.status !== 'expired' },
      { key: 'marked', label: 'Đã mark expired', predicate: (item) => item.batch?.status === 'expired' },
      { key: 'highValue', label: 'Giá trị cao', predicate: (item) => Number(item.metrics?.value_at_risk || 0) >= 10000000 },
    ],
    kpis: [
      { key: 'expired_batches', label: 'Lô hết hạn', icon: AlertTriangle, tone: 'danger' },
      { key: 'pending_processing', label: 'Chưa xử lý', icon: Clock3, tone: 'warning' },
      { key: 'quantity_to_dispose', label: 'SL cần hủy', icon: RotateCcw, tone: 'purple' },
      { key: 'value_to_dispose', label: 'Giá trị cần hủy', icon: Gauge, tone: 'neutral', currency: true },
      { key: 'marked_expired', label: 'Đã mark expired', icon: BadgeCheck, tone: 'success' },
    ],
  },
  'dispense-shortage': {
    eyebrow: 'Nhà thuốc & Kho dược / Cảnh báo',
    title: 'Không đủ thuốc cấp phát',
    description: 'Proactive shortage board tính phần còn phải cấp trên đơn/phiếu và so với tồn khả dụng theo FEFO.',
    icon: ClipboardList,
    tone: 'danger',
    endpoint: 'dispense-shortage',
    tabs: [
      { key: 'all', label: 'Tất cả' },
      { key: 'critical', label: 'Nội trú critical', severity: 'critical' },
      { key: 'partial', label: 'Có thể cấp một phần', predicate: (item) => Number(item.metrics?.available_on_hand || 0) > 0 },
      { key: 'transfer', label: 'Cần chuyển kho', predicate: (item) => (item.suggested_actions || []).includes('request_transfer') },
    ],
    kpis: [
      { key: 'shortage_slips', label: 'Phiếu thiếu thuốc', icon: ClipboardList, tone: 'danger' },
      { key: 'total_shortage_quantity', label: 'Số lượng thiếu', icon: Gauge, tone: 'warning' },
      { key: 'inpatient_critical', label: 'Nội trú critical', icon: ShieldAlert, tone: 'danger' },
      { key: 'partial_possible', label: 'Cấp một phần', icon: Layers3, tone: 'purple' },
      { key: 'need_transfer', label: 'Cần chuyển kho', icon: PackagePlus, tone: 'info' },
    ],
  },
  allergy: {
    eyebrow: 'Nhà thuốc & Kho dược / Cảnh báo',
    title: 'Cảnh báo dị ứng',
    description: 'Gom cảnh báo dị ứng khi duyệt đơn, phản ứng thuốc nặng sau dùng và clinical alert nghi phản vệ.',
    icon: ShieldAlert,
    tone: 'danger',
    endpoint: 'allergy',
    tabs: [
      { key: 'all', label: 'Tất cả' },
      { key: 'allergy', label: 'Nghi dị ứng', predicate: (item) => item.alert_type === 'allergy_conflict' },
      { key: 'reaction', label: 'Phản ứng sau dùng', predicate: (item) => item.alert_type === 'medication_reaction' },
      { key: 'critical', label: 'Nghi phản vệ', severity: 'critical' },
      { key: 'doctor', label: 'Đã báo bác sĩ', predicate: (item) => Boolean(item.impact?.doctor_notified) },
    ],
    kpis: [
      { key: 'high_risk_allergy', label: 'Dị ứng nguy cơ cao', icon: ShieldAlert, tone: 'danger' },
      { key: 'severe_reactions', label: 'Phản ứng nặng', icon: Activity, tone: 'warning' },
      { key: 'suspected_anaphylaxis', label: 'Nghi phản vệ', icon: AlertTriangle, tone: 'danger' },
      { key: 'doctor_notified', label: 'Đã báo bác sĩ', icon: Send, tone: 'info' },
      { key: 'allergy_recorded', label: 'Đã tạo allergy', icon: BadgeCheck, tone: 'success' },
    ],
  },
  'high-usage': {
    eyebrow: 'Nhà thuốc & Kho dược / Cảnh báo',
    title: 'Thuốc dùng nhiều',
    description: 'Phân tích thuốc cấp phát/dùng tăng đột biến, tốc độ tiêu thụ và nguy cơ hết trong vài ngày tới.',
    icon: Activity,
    tone: 'info',
    endpoint: 'high-usage',
    tabs: [
      { key: 'all', label: 'Tất cả' },
      { key: 'spike', label: 'Tăng đột biến', predicate: (item) => Number(item.metrics?.usage_ratio || 0) >= 2 },
      { key: 'risk3', label: 'Nguy cơ hết 3 ngày', predicate: (item) => item.metrics?.days_of_stock_left !== null && Number(item.metrics?.days_of_stock_left || 0) <= 3 },
      { key: 'critical', label: 'Critical', severity: 'critical' },
    ],
    kpis: [
      { key: 'high_usage_today', label: 'Thuốc dùng nhiều', icon: Activity, tone: 'info' },
      { key: 'spike_count', label: 'Tăng đột biến', icon: AlertTriangle, tone: 'warning' },
      { key: 'risk_stockout_3d', label: 'Hết trong 3 ngày', icon: Clock3, tone: 'danger' },
      { key: 'usage_today', label: 'Dùng hôm nay', icon: Gauge, tone: 'purple' },
      { key: 'usage_30d', label: '30 ngày', icon: CalendarClock, tone: 'neutral' },
    ],
  },
  'waste-loss': {
    eyebrow: 'Nhà thuốc & Kho dược / Cảnh báo',
    title: 'Hao hụt / hủy thuốc',
    description: 'Kiểm soát giao dịch waste, expire, recall và adjustment out có giá trị lớn hoặc bất thường.',
    icon: RotateCcw,
    tone: 'warning',
    endpoint: 'waste-loss',
    tabs: [
      { key: 'all', label: 'Tất cả' },
      { key: 'adjustment', label: 'Adjustment OUT', predicate: (item) => item.transaction?.transaction_type === 'adjustment' },
      { key: 'waste', label: 'Waste', predicate: (item) => item.transaction?.transaction_type === 'waste' },
      { key: 'expire', label: 'Expire', predicate: (item) => item.transaction?.transaction_type === 'expire' },
      { key: 'suspicious', label: 'Bất thường', predicate: (item) => Boolean(item.metadata?.suspicious) },
    ],
    kpis: [
      { key: 'transactions_today', label: 'Giao dịch hôm nay', icon: RotateCcw, tone: 'info' },
      { key: 'total_loss_quantity', label: 'SL hao hụt', icon: Gauge, tone: 'warning' },
      { key: 'total_loss_value', label: 'Giá trị hao hụt', icon: FileSpreadsheet, tone: 'neutral', currency: true },
      { key: 'expired_disposal', label: 'Hủy hết hạn', icon: TimerOff, tone: 'danger' },
      { key: 'suspicious_adjustments', label: 'Bất thường', icon: ShieldAlert, tone: 'danger' },
    ],
  },
};

const STATUS_LABELS = {
  new: 'Mới',
  open: 'Mới',
  acknowledged: 'Đã xác nhận',
  assigned: 'Đã gán',
  in_progress: 'Đang xử lý',
  snoozed: 'Snooze',
  escalated: 'Escalated',
  resolved: 'Đã xử lý',
  dismissed: 'Đã bỏ qua',
};

const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function normalizeBoard(board) {
  return BOARD_ALIASES[board] || board || 'low-stock';
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function medicationLabel(item = {}) {
  const medication = item.medication || item.medication_id || {};
  return [medication.brand_name || medication.generic_name, medication.strength].filter(Boolean).join(' ')
    || medication.medication_code
    || item.metadata?.medication_name
    || 'Thuốc';
}

function medicationMeta(item = {}) {
  const medication = item.medication || item.medication_id || {};
  return [medication.medication_code, medication.dosage_form, medication.route_default, medication.unit].filter(Boolean).join(' · ');
}

function batchLabel(item = {}) {
  const batch = item.batch || {};
  return batch.batch_no || item.metadata?.batch_no || '--';
}

function getSeverityTone(severity) {
  if (severity === 'critical') return 'danger';
  if (severity === 'high') return 'warning';
  if (severity === 'medium') return 'info';
  return 'muted';
}

function StatusPill({ value, kind = 'status' }) {
  const label = kind === 'severity' ? SEVERITY_LABELS[value] : STATUS_LABELS[value];
  const tone = kind === 'severity' ? getSeverityTone(value) : value === 'resolved' ? 'success' : value === 'dismissed' ? 'muted' : value === 'snoozed' ? 'purple' : 'info';
  return <span className={`pharmacy-alert-pill is-${tone}`}>{label || value || '--'}</span>;
}

function MetricCard({ item, summary = {} }) {
  const Icon = item.icon || Gauge;
  const value = item.currency ? formatCurrency(summary[item.key]) : formatNumber(summary[item.key]);
  return (
    <article className={`pharmacy-alert-metric is-${item.tone || 'neutral'}`}>
      <span aria-hidden="true"><Icon size={18} /></span>
      <div>
        <strong>{value}</strong>
        <small>{item.label}</small>
      </div>
    </article>
  );
}

function Header({ config, filters, setFilters, onRefresh, onExport }) {
  const Icon = config.icon || ShieldAlert;
  const navigate = useNavigate();
  return (
    <section className={`pharmacy-alert-hero is-${config.tone}`}>
      <div className="pharmacy-alert-hero__title">
        <span>{config.eyebrow}</span>
        <h1><Icon size={30} aria-hidden="true" />{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <div className="pharmacy-alert-hero__ops">
        <div>
          <strong>Realtime</strong>
          <span>Đang hoạt động</span>
        </div>
        <div>
          <strong>Lần đồng bộ</strong>
          <span>{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div>
          <strong>Scope</strong>
          <span>{filters.storageLocation || 'Kho chính / Quầy / Tủ nội trú'}</span>
        </div>
      </div>
      <div className="pharmacy-alert-toolbar" role="search">
        <label className="is-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={filters.search}
            placeholder="Tìm thuốc, mã thuốc, số lô, đơn, bệnh nhân"
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
          />
        </label>
        <label>
          <Filter size={16} aria-hidden="true" />
          <select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value, page: 1 }))}>
            <option value="">Mức độ</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          <BadgeCheck size={16} aria-hidden="true" />
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
            <option value="">Trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          <Boxes size={16} aria-hidden="true" />
          <input value={filters.storageLocation} placeholder="Vị trí kho" onChange={(event) => setFilters((current) => ({ ...current, storageLocation: event.target.value, page: 1 }))} />
        </label>
        <label>
          <PackagePlus size={16} aria-hidden="true" />
          <input value={filters.supplier} placeholder="Nhà cung cấp" onChange={(event) => setFilters((current) => ({ ...current, supplier: event.target.value, page: 1 }))} />
        </label>
        <button type="button" title="Làm mới" aria-label="Làm mới" onClick={onRefresh}><RefreshCw size={17} /></button>
        <button type="button" title="Export CSV" aria-label="Export CSV" onClick={onExport}><Download size={17} /></button>
        <button type="button" title="Cấu hình rule cảnh báo" aria-label="Cấu hình rule cảnh báo" onClick={() => navigate('/pharmacy/settings/alert-thresholds')}><SlidersHorizontal size={17} /></button>
      </div>
    </section>
  );
}

function getPrimaryNumbers(item = {}, board) {
  const metrics = item.metrics || {};
  if (board === 'dispense-shortage') {
    return {
      one: `${formatNumber(item.impact?.required_quantity)} cần cấp`,
      two: `${formatNumber(item.impact?.available_quantity)} có thể cấp`,
      three: `${formatNumber(metrics.shortage_quantity)} thiếu`,
    };
  }
  if (board === 'expiring-batches' || board === 'expired-batches') {
    return {
      one: `${formatNumber(metrics.quantity_on_hand)} tồn`,
      two: `${formatNumber(metrics.days_to_expiry)} ngày`,
      three: formatCurrency(metrics.value_at_risk),
    };
  }
  if (board === 'high-usage') {
    return {
      one: `${formatNumber(metrics.usage_today)} hôm nay`,
      two: `${formatNumber(metrics.usage_30d)} / 30 ngày`,
      three: `${formatNumber(metrics.days_of_stock_left)} ngày tồn`,
    };
  }
  if (board === 'waste-loss') {
    return {
      one: `${formatNumber(item.transaction?.quantity)} ${item.medication?.unit || ''}`,
      two: formatCurrency(metrics.value_at_risk),
      three: `${formatNumber(metrics.anomaly_score)} điểm`,
    };
  }
  return {
    one: `${formatNumber(metrics.available_on_hand)} khả dụng`,
    two: `${formatNumber(metrics.min_stock_level)} ngưỡng`,
    three: `${formatNumber(metrics.days_of_stock_left)} ngày tồn`,
  };
}

function AlertIdentityCell({ item, board }) {
  const patient = item.patient || {};
  return (
    <div className="pharmacy-alert-identity">
      <strong>{board === 'allergy' ? patient.full_name || medicationLabel(item) : medicationLabel(item)}</strong>
      <span>{board === 'allergy' ? [patient.patient_code, medicationLabel(item)].filter(Boolean).join(' · ') : medicationMeta(item)}</span>
    </div>
  );
}

function AlertTable({ board, items, selectedIds, setSelectedIds, onSelect, onAction }) {
  function toggle(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  return (
    <div className="pharmacy-alert-table-wrap">
      <table className="pharmacy-alert-table">
        <thead>
          <tr>
            <th><input type="checkbox" aria-label="Chọn tất cả" checked={items.length > 0 && selectedIds.length === items.length} onChange={(event) => setSelectedIds(event.target.checked ? items.map((item) => item.id).filter(Boolean) : [])} /></th>
            <th>Severity</th>
            <th>Đối tượng</th>
            <th>Rủi ro</th>
            <th>Tồn / nhu cầu</th>
            <th>Nguồn</th>
            <th>SLA</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const numbers = getPrimaryNumbers(item, board);
            return (
              <tr key={item.id || item.dedupe_key}>
                <td><input type="checkbox" aria-label="Chọn cảnh báo" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} /></td>
                <td><StatusPill value={item.severity} kind="severity" /></td>
                <td><AlertIdentityCell item={item} board={board} /></td>
                <td>
                  <strong>{item.title}</strong>
                  <small>{item.message}</small>
                </td>
                <td>
                  <span>{numbers.one}</span>
                  <small>{numbers.two} · {numbers.three}</small>
                </td>
                <td>
                  <span>{item.prescription?.prescription_no || item.dispense?.dispense_no || item.transaction?.transaction_no || batchLabel(item)}</span>
                  <small>{item.metadata?.storage_location || item.batch?.storage_location || item.transaction?.transaction_type || item.source_type}</small>
                </td>
                <td>
                  <span>{formatDateTime(item.due_at)}</span>
                  <small>phát sinh {formatDateTime(item.detected_at || item.created_at)}</small>
                </td>
                <td><StatusPill value={item.status} /></td>
                <td>
                  <div className="pharmacy-alert-row-actions">
                    <button type="button" title="Chi tiết" aria-label="Chi tiết" onClick={() => onSelect(item)}><Eye size={15} /></button>
                    <button type="button" title="Xác nhận" aria-label="Xác nhận" onClick={() => onAction('acknowledge', item)}><BadgeCheck size={15} /></button>
                    <button type="button" title="Đang xử lý" aria-label="Đang xử lý" onClick={() => onAction('start', item)}><Activity size={15} /></button>
                    <button type="button" title="Đóng" aria-label="Đóng" onClick={() => onAction('resolve', item)}><CheckCircle2 size={15} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({ items, onSelect, onAction }) {
  const columns = [
    { key: 'new', label: 'Mới', statuses: ['new', 'open'] },
    { key: 'acknowledged', label: 'Đã xác nhận', statuses: ['acknowledged'] },
    { key: 'progress', label: 'Đang xử lý', statuses: ['assigned', 'in_progress', 'escalated'] },
    { key: 'waiting', label: 'Chờ nhập / snooze', statuses: ['snoozed'] },
    { key: 'resolved', label: 'Đã xử lý', statuses: ['resolved'] },
    { key: 'dismissed', label: 'Bỏ qua', statuses: ['dismissed'] },
  ];
  return (
    <div className="pharmacy-alert-kanban">
      {columns.map((column) => {
        const rows = items.filter((item) => column.statuses.includes(item.status));
        return (
          <section key={column.key}>
            <header><strong>{column.label}</strong><span>{formatNumber(rows.length)}</span></header>
            {rows.map((item) => (
              <article key={item.id} onClick={() => onSelect(item)}>
                <div>
                  <StatusPill value={item.severity} kind="severity" />
                  <StatusPill value={item.status} />
                </div>
                <strong>{item.title}</strong>
                <span>{medicationLabel(item)}</span>
                <small>{formatDateTime(item.due_at)}</small>
                <footer>
                  <button type="button" title="Xác nhận" aria-label="Xác nhận" onClick={(event) => { event.stopPropagation(); onAction('acknowledge', item); }}><BadgeCheck size={14} /></button>
                  <button type="button" title="Đóng" aria-label="Đóng" onClick={(event) => { event.stopPropagation(); onAction('resolve', item); }}><CheckCircle2 size={14} /></button>
                </footer>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function RiskView({ board, items, onSelect }) {
  const maxValue = Math.max(1, ...items.map((item) => Number(item.metrics?.value_at_risk || item.metrics?.shortage_quantity || item.metrics?.usage_today || 1)));
  return (
    <div className="pharmacy-alert-risk-view">
      <section>
        <header>
          <strong>Risk timeline</strong>
          <span>{formatNumber(items.length)} cảnh báo</span>
        </header>
        <div className="pharmacy-alert-timeline">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelect(item)}>
              <i className={`is-${getSeverityTone(item.severity)}`} />
              <span>{formatDate(item.batch?.expiry_date || item.due_at || item.detected_at)}</span>
              <strong>{item.title}</strong>
              <em>{medicationLabel(item)}</em>
            </button>
          ))}
        </div>
      </section>
      <section>
        <header>
          <strong>{board === 'expiring-batches' || board === 'expired-batches' ? 'Giá trị rủi ro' : 'Risk meter'}</strong>
          <span>Top {Math.min(items.length, 12)}</span>
        </header>
        <div className="pharmacy-alert-risk-bars">
          {items.slice(0, 12).map((item) => {
            const value = Number(item.metrics?.value_at_risk || item.metrics?.shortage_quantity || item.metrics?.usage_today || item.metrics?.anomaly_score || 0);
            return (
              <button key={item.id} type="button" onClick={() => onSelect(item)}>
                <span>{medicationLabel(item)}</span>
                <i style={{ width: `${Math.max((value / maxValue) * 100, 6)}%` }} />
                <em>{item.metrics?.value_at_risk ? formatCurrency(value) : formatNumber(value)}</em>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BulkToolbar({ selectedIds, onBulkAction }) {
  if (!selectedIds.length) return null;
  return (
    <div className="pharmacy-alert-bulk">
      <strong>{formatNumber(selectedIds.length)} cảnh báo đã chọn</strong>
      <button type="button" onClick={() => onBulkAction('acknowledge')}><BadgeCheck size={15} />Xác nhận</button>
      <button type="button" onClick={() => onBulkAction('start')}><Activity size={15} />Đang xử lý</button>
      <button type="button" onClick={() => onBulkAction('snooze')}><Clock3 size={15} />Snooze 4h</button>
      <button type="button" onClick={() => onBulkAction('resolve')}><CheckCircle2 size={15} />Đóng</button>
    </div>
  );
}

function EmptyState({ loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="pharmacy-alert-empty">
        <RefreshCw size={22} aria-hidden="true" />
        <strong>Đang đồng bộ cảnh báo</strong>
      </div>
    );
  }
  if (error) {
    return (
      <div className="pharmacy-alert-empty is-error">
        <AlertTriangle size={22} aria-hidden="true" />
        <strong>{error}</strong>
        <button type="button" onClick={onRetry}>Thử lại</button>
      </div>
    );
  }
  return (
    <div className="pharmacy-alert-empty">
      <CheckCircle2 size={22} aria-hidden="true" />
      <strong>Không có cảnh báo phù hợp</strong>
    </div>
  );
}

function DrawerSection({ title, children }) {
  return (
    <section className="pharmacy-alert-drawer-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function DetailDrawer({ item, onClose, onAction }) {
  if (!item) return null;
  const metrics = item.metrics || {};
  const batchRows = item.inventory?.batches || item.inventory?.available_batches || (item.batch ? [item.batch] : []);
  return (
    <aside className="pharmacy-alert-drawer" aria-label="Chi tiết cảnh báo">
      <header>
        <div>
          <span>{item.alert_code || item.reason_code || item.source_type}</span>
          <strong>{item.title}</strong>
          <small>{item.message}</small>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </header>
      <nav>
        <StatusPill value={item.severity} kind="severity" />
        <StatusPill value={item.status} />
        <span>{formatDateTime(item.due_at)}</span>
      </nav>
      <div className="pharmacy-alert-drawer-body">
        <DrawerSection title="Thông tin thuốc">
          <dl>
            <div><dt>Mã thuốc</dt><dd>{item.medication?.medication_code || '--'}</dd></div>
            <div><dt>Tên thuốc</dt><dd>{medicationLabel(item)}</dd></div>
            <div><dt>Dạng / đường</dt><dd>{[item.medication?.dosage_form, item.medication?.route_default].filter(Boolean).join(' · ') || '--'}</dd></div>
            <div><dt>Đơn vị</dt><dd>{item.medication?.unit || '--'}</dd></div>
          </dl>
        </DrawerSection>
        <DrawerSection title="Chỉ số rủi ro">
          <div className="pharmacy-alert-keygrid">
            <article><span>Tồn khả dụng</span><strong>{formatNumber(metrics.available_on_hand)}</strong></article>
            <article><span>Ngưỡng</span><strong>{formatNumber(metrics.min_stock_level)}</strong></article>
            <article><span>Thiếu</span><strong>{formatNumber(metrics.shortage_quantity)}</strong></article>
            <article><span>Ngày còn tồn</span><strong>{metrics.days_of_stock_left === null ? '--' : formatNumber(metrics.days_of_stock_left)}</strong></article>
            <article><span>Ngày tới hạn</span><strong>{metrics.days_to_expiry === null ? '--' : formatNumber(metrics.days_to_expiry)}</strong></article>
            <article><span>Giá trị rủi ro</span><strong>{formatCurrency(metrics.value_at_risk)}</strong></article>
          </div>
        </DrawerSection>
        {item.patient ? (
          <DrawerSection title="Bệnh nhân / đơn ảnh hưởng">
            <dl>
              <div><dt>Bệnh nhân</dt><dd>{[item.patient.patient_code, item.patient.full_name].filter(Boolean).join(' · ') || '--'}</dd></div>
              <div><dt>Đơn thuốc</dt><dd>{item.prescription?.prescription_no || item.metadata?.prescription_no || '--'}</dd></div>
              <div><dt>Phiếu cấp phát</dt><dd>{item.dispense?.dispense_no || item.metadata?.dispense_no || '--'}</dd></div>
            </dl>
          </DrawerSection>
        ) : null}
        {batchRows.length ? (
          <DrawerSection title="Tồn theo lô">
            <div className="pharmacy-alert-mini-table">
              {batchRows.slice(0, 8).map((batch) => (
                <article key={batch.id || batch.batch_no}>
                  <strong>{batch.batch_no || batch.lot_no || '--'}</strong>
                  <span>{formatDate(batch.expiry_date)}</span>
                  <em>{formatNumber(batch.quantity_on_hand)} · {batch.storage_location || '--'}</em>
                </article>
              ))}
            </div>
          </DrawerSection>
        ) : null}
        {item.reaction ? (
          <DrawerSection title="Phản ứng sau dùng thuốc">
            <dl>
              <div><dt>Mức độ</dt><dd>{item.reaction.severity}</dd></div>
              <div><dt>Triệu chứng</dt><dd>{(item.reaction.symptoms || []).join(', ') || '--'}</dd></div>
              <div><dt>Khởi phát</dt><dd>{formatDateTime(item.reaction.onset_at)}</dd></div>
              <div><dt>Đã dừng thuốc</dt><dd>{item.reaction.medication_stopped ? 'Có' : 'Chưa'}</dd></div>
            </dl>
          </DrawerSection>
        ) : null}
        <DrawerSection title="Gợi ý hành động">
          <div className="pharmacy-alert-suggestions">
            {(item.suggested_actions || ['acknowledge', 'resolve']).map((action) => <span key={action}>{action.replaceAll('_', ' ')}</span>)}
          </div>
        </DrawerSection>
      </div>
      <footer>
        <button type="button" onClick={() => onAction('acknowledge', item)}><BadgeCheck size={16} />Xác nhận</button>
        <button type="button" onClick={() => onAction('start', item)}><Activity size={16} />Đang xử lý</button>
        <button type="button" onClick={() => onAction('snooze', item)}><Clock3 size={16} />Snooze 4h</button>
        <button type="button" onClick={() => onAction('resolve', item)}><CheckCircle2 size={16} />Đóng</button>
        <button type="button" onClick={() => onAction('dismiss', item)}><X size={16} />Bỏ qua</button>
      </footer>
    </aside>
  );
}

function exportRows(config, rows) {
  const header = ['type', 'severity', 'status', 'title', 'medication', 'batch', 'available', 'shortage', 'due_at'];
  const body = rows.map((item) => [
    item.alert_type,
    item.severity,
    item.status,
    item.title,
    medicationLabel(item),
    batchLabel(item),
    item.metrics?.available_on_hand || '',
    item.metrics?.shortage_quantity || '',
    item.due_at || '',
  ]);
  const csv = [header, ...body].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${config.endpoint}-alerts.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function PharmacyAlertsCommandCenterPage({ board = 'low-stock' }) {
  const normalizedBoard = normalizeBoard(board);
  const config = BOARD_CONFIG[normalizedBoard] || BOARD_CONFIG['low-stock'];
  const [filters, setFilters] = useState({
    search: '',
    severity: '',
    status: '',
    storageLocation: '',
    supplier: '',
    range: normalizedBoard === 'waste-loss' ? '30d' : '',
    view: 'table',
    tab: 'all',
    page: 1,
  });
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [drawer, setDrawer] = useState(null);

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await loadPharmacyAlertCommandBoard(config.endpoint, filters);
      setState({ loading: false, data, error: '' });
      setSelectedIds([]);
    } catch (error) {
      setState({ loading: false, data: null, error: getApiErrorMessage(error, 'Không thể tải cảnh báo dược.') });
    }
  }

  useEffect(() => {
    refresh();
  }, [config.endpoint, filters.search, filters.severity, filters.status, filters.storageLocation, filters.supplier, filters.range]);

  const items = state.data?.items || [];
  const visibleItems = useMemo(() => {
    const tab = config.tabs.find((item) => item.key === filters.tab) || config.tabs[0];
    if (!tab || tab.key === 'all') return items;
    if (tab.severity) return items.filter((item) => item.severity === tab.severity);
    if (tab.predicate) return items.filter(tab.predicate);
    return items;
  }, [items, config.tabs, filters.tab]);

  async function handleAction(action, item) {
    if (!item?.id) return;
    try {
      if (action === 'acknowledge') await acknowledgePharmacyAlert(item.id, { note: 'Xác nhận từ Pharmacy Alert Center.' });
      if (action === 'start') await startPharmacyAlert(item.id, { note: 'Bắt đầu xử lý từ Pharmacy Alert Center.' });
      if (action === 'snooze') await snoozePharmacyAlert(item.id, { minutes: 240, reason: 'Snooze 4h từ Pharmacy Alert Center.' });
      if (action === 'resolve') await resolvePharmacyAlert(item.id, { resolution_note: 'Đã xử lý từ Pharmacy Alert Center.' });
      if (action === 'dismiss') await dismissPharmacyAlert(item.id, { reason: 'Bỏ qua từ Pharmacy Alert Center.' });
      setDrawer(null);
      refresh();
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Không thể cập nhật cảnh báo.'));
    }
  }

  async function handleBulkAction(action) {
    try {
      const body = {
        alert_ids: selectedIds,
        action,
        note: action === 'snooze' ? 'Snooze 4h từ bulk action.' : 'Bulk action từ Pharmacy Alert Center.',
        minutes: 240,
      };
      await bulkActionPharmacyAlerts(body);
      refresh();
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Không thể xử lý hàng loạt.'));
    }
  }

  const summary = state.data?.summary || {};
  const Icon = config.icon || ShieldAlert;

  return (
    <div className="pharmacy-alert-command-page">
      <Header config={config} filters={filters} setFilters={setFilters} onRefresh={refresh} onExport={() => exportRows(config, visibleItems)} />
      <section className="pharmacy-alert-metric-grid">
        <MetricCard item={{ key: 'total_open', label: 'Tổng cảnh báo mở', icon: Bell, tone: 'info' }} summary={summary} />
        <MetricCard item={{ key: 'critical', label: 'Critical', icon: AlertTriangle, tone: 'danger' }} summary={summary} />
        <MetricCard item={{ key: 'high', label: 'High', icon: Gauge, tone: 'warning' }} summary={summary} />
        {config.kpis.map((item) => <MetricCard key={item.key} item={item} summary={summary} />)}
      </section>
      <section className="pharmacy-alert-controls">
        <div className="pharmacy-alert-tabs">
          {config.tabs.map((tab) => (
            <button key={tab.key} type="button" className={filters.tab === tab.key ? 'is-active' : ''} onClick={() => setFilters((current) => ({ ...current, tab: tab.key }))}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pharmacy-alert-view-switch" role="group" aria-label="Chế độ xem">
          {[
            ['table', ClipboardList],
            ['kanban', Layers3],
            ['risk', Activity],
          ].map(([view, ViewIcon]) => (
            <button key={view} type="button" className={filters.view === view ? 'is-active' : ''} title={view} aria-label={view} onClick={() => setFilters((current) => ({ ...current, view }))}>
              <ViewIcon size={16} />
            </button>
          ))}
        </div>
      </section>
      <BulkToolbar selectedIds={selectedIds} onBulkAction={handleBulkAction} />
      <section className="pharmacy-alert-workspace">
        <header>
          <div>
            <span>{config.eyebrow}</span>
            <h2><Icon size={19} />{config.title}</h2>
          </div>
          <p>{formatNumber(visibleItems.length)} dòng trong chế độ xem hiện tại</p>
        </header>
        {state.loading || state.error || visibleItems.length === 0 ? (
          <EmptyState loading={state.loading} error={state.error} onRetry={refresh} />
        ) : null}
        {!state.loading && !state.error && visibleItems.length > 0 && filters.view === 'table' ? (
          <AlertTable
            board={normalizedBoard}
            items={visibleItems}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onSelect={setDrawer}
            onAction={handleAction}
          />
        ) : null}
        {!state.loading && !state.error && visibleItems.length > 0 && filters.view === 'kanban' ? (
          <KanbanView items={visibleItems} onSelect={setDrawer} onAction={handleAction} />
        ) : null}
        {!state.loading && !state.error && visibleItems.length > 0 && filters.view === 'risk' ? (
          <RiskView board={normalizedBoard} items={visibleItems} onSelect={setDrawer} />
        ) : null}
      </section>
      <DetailDrawer item={drawer} onClose={() => setDrawer(null)} onAction={handleAction} />
    </div>
  );
}
