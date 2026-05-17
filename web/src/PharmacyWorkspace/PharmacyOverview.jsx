import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Eye,
  FileCheck2,
  Filter,
  PackageCheck,
  PackagePlus,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TimerOff,
  TriangleAlert,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '../utils/api';
import {
  PHARMACY_PERMISSIONS,
  cancelDispenseFromOverview,
  cancelPrescriptionFromOverview,
  completeDispenseFromOverview,
  hasAnyPermission,
  loadPharmacyOverviewData,
  markStockBatchExpiredFromOverview,
  recallStockBatchFromOverview,
  runPrescriptionSafetyChecks,
  verifyPrescriptionFromOverview,
} from './pharmacyApi';
import { usePharmacyWorkspace } from './PharmacyShell';

const RANGE_OPTIONS = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
];

const PRESCRIPTION_STATUS_META = {
  draft: { label: 'Chờ xác minh', tone: 'warning' },
  active: { label: 'Chờ xác minh', tone: 'warning' },
  pending: { label: 'Chờ xác minh', tone: 'warning' },
  pending_verification: { label: 'Chờ xác minh', tone: 'warning' },
  verified: { label: 'Sẵn sàng cấp phát', tone: 'info' },
  ready_to_dispense: { label: 'Sẵn sàng cấp phát', tone: 'info' },
  preparing: { label: 'Đang chuẩn bị', tone: 'purple' },
  partially_dispensed: { label: 'Đang chuẩn bị', tone: 'purple' },
  fully_dispensed: { label: 'Đã cấp phát', tone: 'success' },
  dispensed: { label: 'Đã cấp phát', tone: 'success' },
  completed: { label: 'Đã cấp phát', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'muted' },
};

const DISPENSE_STATUS_META = {
  draft: { label: 'Chờ chuẩn bị', tone: 'warning' },
  preparing: { label: 'Đang chuẩn bị', tone: 'purple' },
  ready: { label: 'Sẵn sàng giao', tone: 'info' },
  partially_dispensed: { label: 'Đang chuẩn bị', tone: 'purple' },
  dispensed: { label: 'Đã giao', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'muted' },
  returned: { label: 'Đã trả', tone: 'muted' },
  stockout: { label: 'Thiếu tồn kho', tone: 'danger' },
};

const TRANSACTION_TYPE_META = {
  receipt: { label: 'Nhập kho', tone: 'info' },
  adjustment: { label: 'Điều chỉnh', tone: 'warning' },
  adjustment_in: { label: 'Điều chỉnh tăng', tone: 'success' },
  adjustment_out: { label: 'Điều chỉnh giảm', tone: 'warning' },
  dispense: { label: 'Cấp phát', tone: 'purple' },
  return: { label: 'Hoàn trả', tone: 'success' },
  transfer: { label: 'Chuyển kho', tone: 'info' },
  waste: { label: 'Hủy bỏ', tone: 'danger' },
  expire: { label: 'Hết hạn', tone: 'muted' },
  recall: { label: 'Thu hồi', tone: 'danger' },
};

const BATCH_STATUS_META = {
  active: { label: 'Khả dụng', tone: 'success' },
  available: { label: 'Khả dụng', tone: 'success' },
  expiring: { label: 'Sắp hết hạn', tone: 'warning' },
  expired: { label: 'Đã hết hạn', tone: 'danger' },
  recalled: { label: 'Thu hồi', tone: 'danger' },
  depleted: { label: 'Hết tồn', tone: 'muted' },
  quarantined: { label: 'Cách ly', tone: 'warning' },
};

function getId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || value.value || '';
}

function getPersonName(value, fallback = 'Chưa rõ') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.full_name || value.fullName || value.name || value.username || value.patient_name || fallback;
}

function getMedicationName(value) {
  if (!value) return 'Thuốc';
  if (typeof value === 'string') return value;
  return [value.brand_name || value.generic_name, value.strength].filter(Boolean).join(' ') || value.medication_code || 'Thuốc';
}

function getPrescriptionId(row) {
  return row.prescription_id || row._id || row.id || '';
}

function getDispenseId(row) {
  return row.dispense_id || row._id || row.id || '';
}

function getBatchId(row) {
  return getId(row.stock_batch_id) || row.batch_id || row._id || row.id || '';
}

function getBatchNo(row) {
  return row.batch_no || row.lot_no || row.stock_batch_id?.batch_no || row.stock_batch_id?.lot_no || 'Lô thuốc';
}

function getDateValue(row) {
  return row.prescribed_at || row.created_at || row.updated_at || row.dispensed_at || row.occurred_at || '';
}

function parseDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatDateTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatShortDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
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

function getStatusMeta(status, map = PRESCRIPTION_STATUS_META) {
  return map[String(status || '').toLowerCase()] || { label: status || 'Không rõ', tone: 'muted' };
}

function isPendingPrescription(item) {
  return ['draft', 'active', 'pending', 'pending_verification'].includes(String(item.status || '').toLowerCase());
}

function isReadyPrescription(item) {
  return ['verified', 'ready_to_dispense'].includes(String(item.status || '').toLowerCase());
}

function isDispensedPrescription(item) {
  return ['fully_dispensed', 'dispensed', 'completed'].includes(String(item.status || '').toLowerCase());
}

function getPatientAge(patient) {
  const birthDate = parseDate(patient?.date_of_birth || patient?.dateOfBirth);
  if (!birthDate) return '';
  return Math.max(new Date().getFullYear() - birthDate.getFullYear(), 0);
}

function isExpiringBatch(item, days = 30) {
  const expiryDate = parseDate(item.expiry_date);
  if (!expiryDate) return false;
  const now = new Date();
  const threshold = new Date(now.getTime() + days * 86400000);
  return expiryDate >= now && expiryDate <= threshold;
}

function daysUntil(value) {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return Math.ceil((parsed.getTime() - Date.now()) / 86400000);
}

function getAvailableQuantity(item) {
  return Number(
    item.quantity_on_hand ??
      item.available_quantity ??
      item.available_qty ??
      item.current_stock ??
      item.stock_on_hand ??
      item.quantity ??
      0,
  );
}

function getMinStockLevel(item) {
  return Number(item.min_stock_level ?? item.reorder_level ?? item.minimum_stock ?? 0);
}

function getDispenseItemCount(row) {
  return row.items_count ?? row.item_count ?? row.items?.length ?? row.dispense_items?.length ?? '--';
}

function isUnavailableStock(item) {
  const status = String(item.status || item.stock_status || '').toLowerCase();
  const availableBatches = item.available_batches ?? item.available_batch_count;
  if (['depleted', 'out_of_stock', 'stockout', 'unavailable'].includes(status)) return true;
  if (availableBatches !== undefined && Number(availableBatches) <= 0) return true;
  return getAvailableQuantity(item) <= 0;
}

function safeCountBy(items, predicate) {
  return items.filter(predicate).length;
}

function getLocalDateKey(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildDailySeries(items, { days = 7, dateAccessor = getDateValue, valueAccessor = () => 1 } = {}) {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: getLocalDateKey(date),
      label: formatShortDate(date),
      value: 0,
    };
  });
  const bucketMap = new Map(buckets.map((item) => [item.key, item]));

  items.forEach((item) => {
    const key = getLocalDateKey(dateAccessor(item));
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    bucket.value += Number(valueAccessor(item) || 0);
  });

  return buckets;
}

function DashboardSkeleton({ rows = 1 }) {
  return (
    <div className="pharmacy-skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <span className="pharmacy-skeleton" key={index} />
      ))}
    </div>
  );
}

function WidgetError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="pharmacy-widget-error">
      <AlertTriangle size={16} strokeWidth={2.25} aria-hidden="true" />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="pharmacy-overview-empty">
      <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}

function StatusBadge({ status, map = PRESCRIPTION_STATUS_META }) {
  const meta = getStatusMeta(status, map);
  return <span className={`pharmacy-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

function KpiCard({ item, loading, onClick }) {
  const Icon = item.icon;

  return (
    <button type="button" className={`pharmacy-kpi-card is-${item.tone}`} onClick={onClick}>
      <span className="pharmacy-kpi-icon" aria-hidden="true">
        <Icon size={21} strokeWidth={2.25} />
      </span>
      <span className="pharmacy-kpi-copy">
        <small>{item.label}</small>
        {loading ? <span className="pharmacy-kpi-skeleton" /> : <strong>{item.value}</strong>}
        <em>{item.hint}</em>
      </span>
      <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

function OperationsStrip({ items, loading }) {
  return (
    <section className="pharmacy-ops-strip" aria-label="Chỉ số vận hành nhanh">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.label} type="button" onClick={item.onClick}>
            <span className={`pharmacy-mini-stat-icon is-${item.tone}`} aria-hidden="true">
              <Icon size={18} strokeWidth={2.25} />
            </span>
            <span>
              <small>{item.label}</small>
              {loading ? <em className="pharmacy-mini-stat-skeleton" /> : <strong>{item.value}</strong>}
              <em>{item.hint}</em>
            </span>
          </button>
        );
      })}
    </section>
  );
}

function DonutChart({ data }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let cursor = 0;
  const colors = ['#f59e0b', '#0ea5e9', '#8b5cf6', '#10b981', '#94a3b8'];
  const gradient = total
    ? data.map((item, index) => {
        const start = cursor;
        const next = cursor + (Number(item.value || 0) / total) * 100;
        cursor = next;
        return `${colors[index % colors.length]} ${start}% ${next}%`;
      }).join(', ')
    : '#e8eef4 0 100%';

  return (
    <div className="pharmacy-donut-wrap">
      <div className="pharmacy-donut" style={{ '--pharmacy-donut': `conic-gradient(${gradient})` }}>
        <span>
          <strong>{formatNumber(total)}</strong>
          <small>đơn</small>
        </span>
      </div>
      <div className="pharmacy-chart-legend">
        {data.map((item, index) => (
          <div key={item.label}>
            <span style={{ '--legend-color': colors[index % colors.length] }} />
            <strong>{item.label}</strong>
            <em>{formatNumber(item.value)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourlyBarChart({ items }) {
  const hourBuckets = [8, 9, 10, 11, 13, 14, 15, 16].map((hour) => ({
    hour,
    value: items.filter((item) => {
      const parsed = parseDate(getDateValue(item));
      return parsed?.getHours() === hour;
    }).length,
  }));
  const max = Math.max(...hourBuckets.map((item) => item.value), 1);

  return (
    <div className="pharmacy-hour-bars">
      {hourBuckets.map((item) => (
        <div key={item.hour}>
          <span style={{ height: `${Math.max((item.value / max) * 100, 8)}%` }} />
          <small>{item.hour}h</small>
        </div>
      ))}
    </div>
  );
}

function TrendLineChart({ series, compact = false }) {
  const width = compact ? 220 : 360;
  const height = compact ? 72 : 170;
  const padding = compact ? 8 : 28;
  const values = series.map((item) => Number(item.value || 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const bottom = height - padding;
  const points = series.map((item, index) => {
    const x = padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
    const y = bottom - ((Number(item.value || 0) - min) / range) * (height - padding * 2);
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(1) || padding} ${bottom} L ${points[0]?.x.toFixed(1) || padding} ${bottom} Z`;
  const gridValues = compact ? [] : [max, Math.round((max + min) / 2), min];

  return (
    <div className={compact ? 'pharmacy-sparkline' : 'pharmacy-trend-chart'}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ xu hướng">
        <defs>
          <linearGradient id={compact ? 'pharmacy-spark-area' : 'pharmacy-trend-area'} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0aa6b7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0aa6b7" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {!compact ? (
          <>
            {gridValues.map((value) => {
              const y = bottom - ((value - min) / range) * (height - padding * 2);
              return (
                <g key={value}>
                  <line x1={padding} x2={width - padding} y1={y} y2={y} />
                  <text x={4} y={y + 4}>{formatNumber(value)}</text>
                </g>
              );
            })}
          </>
        ) : null}
        <path className="pharmacy-line-area" d={areaPath} fill={`url(#${compact ? 'pharmacy-spark-area' : 'pharmacy-trend-area'})`} />
        <path className="pharmacy-line-path" d={linePath} />
        {!compact ? points.map((point, index) => (
          <g className="pharmacy-line-point" key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" />
            <text x={point.x} y={point.y - 9}>{formatNumber(point.value)}</text>
            <text className="pharmacy-line-label" x={point.x} y={height - 6}>{index % 2 === 0 ? point.label : ''}</text>
          </g>
        )) : null}
      </svg>
    </div>
  );
}

function PrescriptionStatusCard({ chartData, loading, error, onRetry }) {
  return (
    <section className="pharmacy-overview-card pharmacy-status-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Tình trạng</span>
          <h2>Đơn thuốc</h2>
        </div>
        <BarChart3 size={19} strokeWidth={2.25} aria-hidden="true" />
      </header>
      <WidgetError message={error} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={4} /> : <DonutChart data={chartData} />}
    </section>
  );
}

function DispenseTrendCard({ series, loading, error, onRetry }) {
  const latest = series[series.length - 1]?.value || 0;
  const previous = series[series.length - 2]?.value || 0;
  const delta = latest - previous;
  const deltaLabel = `${delta >= 0 ? '+' : ''}${formatNumber(delta)} so với hôm qua`;

  return (
    <section className="pharmacy-overview-card pharmacy-trend-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Xu hướng</span>
          <h2>Cấp phát 7 ngày</h2>
        </div>
        <PackageCheck size={19} strokeWidth={2.25} aria-hidden="true" />
      </header>
      <WidgetError message={error} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={4} /> : (
        <>
          <div className="pharmacy-trend-summary">
            <strong>{formatNumber(latest)}</strong>
            <span>{deltaLabel}</span>
          </div>
          <TrendLineChart series={series} />
        </>
      )}
    </section>
  );
}

function InventoryRiskChart({
  loading,
  lowStockCount,
  nearExpiryCount,
  expiredCount,
  recalledCount,
  unavailableCount,
  onOpen,
}) {
  const rows = [
    { label: 'Sắp hết hàng', value: Number(lowStockCount || 0), tone: 'danger', to: '/pharmacy/inventory/low-stock' },
    { label: 'Sắp hết hạn', value: Number(nearExpiryCount || 0), tone: 'warning', to: '/pharmacy/inventory/expiring' },
    { label: 'Đã hết hạn', value: Number(expiredCount || 0), tone: 'muted', to: '/pharmacy/inventory/expiring?status=expired' },
    { label: 'Bị thu hồi', value: Number(recalledCount || 0), tone: 'danger', to: '/pharmacy/inventory/recalls' },
    { label: 'Không còn lô cấp phát', value: Number(unavailableCount || 0), tone: 'warning', to: '/pharmacy/inventory/batches?status=depleted' },
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="pharmacy-overview-card pharmacy-risk-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Biểu đồ tồn kho</span>
          <h2>Trạng thái lô thuốc</h2>
        </div>
        <Boxes size={19} strokeWidth={2.25} aria-hidden="true" />
      </header>
      {loading ? <DashboardSkeleton rows={4} /> : (
        <div className="pharmacy-risk-bars">
          {rows.map((row) => (
            <button key={row.label} type="button" onClick={() => onOpen(row.to)}>
              <span>
                <strong>{row.label}</strong>
                <em>{formatNumber(row.value)}</em>
              </span>
              <i className={`is-${row.tone}`} style={{ width: `${Math.max((row.value / max) * 100, 7)}%` }} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function PriorityAlerts({ alerts, loading, error, onRetry, onOpenAll }) {
  return (
    <section className="pharmacy-overview-card pharmacy-alert-panel">
      <header className="pharmacy-card-head">
        <div>
          <span>Cảnh báo ưu tiên</span>
          <h2>Cần xử lý</h2>
        </div>
        <ShieldAlert size={19} strokeWidth={2.2} aria-hidden="true" />
      </header>
      <WidgetError message={error} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={4} /> : null}
      {!loading && !error && alerts.length === 0 ? (
        <EmptyState
          title="Tồn kho đang ổn định"
          description="Không có thuốc sắp hết hàng hoặc lô sắp hết hạn trong bộ lọc hiện tại."
        />
      ) : null}
      {!loading && alerts.length ? (
        <>
          <div className="pharmacy-priority-list">
            {alerts.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={item.onClick}>
                  <span className={`pharmacy-priority-icon is-${item.tone}`} aria-hidden="true">
                    <Icon size={17} strokeWidth={2.25} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <em>{item.level}</em>
                </button>
              );
            })}
          </div>
          <button className="pharmacy-card-link" type="button" onClick={onOpenAll}>
            Xem tất cả cảnh báo
            <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </>
      ) : null}
    </section>
  );
}

function PendingPrescriptionsTable({ rows, loading, error, permissions, onRetry, onCheck, onVerify, onCancel }) {
  const canVerify = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.prescriptionsVerify);
  const canCreateDispense = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.dispensesCreate);
  const canCancel = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.prescriptionsCancel);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(Math.ceil(rows.length / pageSize), 1);
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize]);

  return (
    <section className="pharmacy-overview-card pharmacy-table-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Đơn thuốc</span>
          <h2>Chờ xác minh</h2>
        </div>
        <button type="button" onClick={() => navigate('/pharmacy/prescriptions/pending-verification')}>
          Xem tất cả
        </button>
      </header>
      <WidgetError message={error} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={6} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="Không có đơn thuốc chờ xác minh"
          description="Tất cả đơn thuốc mới đã được xử lý."
          action={(
            <button type="button" onClick={() => navigate('/pharmacy/dispensing/queue')}>
              Đến hàng chờ cấp phát
            </button>
          )}
        />
      ) : null}
      {!loading && rows.length ? (
        <div className="pharmacy-table-scroll">
          <table className="pharmacy-overview-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Chọn tất cả đơn thuốc" /></th>
                <th>Mã đơn</th>
                <th>Bệnh nhân</th>
                <th>Bác sĩ kê</th>
                <th>Khoa</th>
                <th>Thời gian kê</th>
                <th>Số thuốc</th>
                <th>Cảnh báo</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const patient = row.patient_id || row.patient || {};
                const encounter = row.encounter_id || {};
                const prescriptionId = getPrescriptionId(row);
                const age = getPatientAge(patient);
                const hasWarning = row.has_allergy_conflict || row.has_interaction_conflict || row.warning_count;

                return (
                  <tr key={prescriptionId || row.prescription_no}>
                    <td><input type="checkbox" aria-label={`Chọn ${row.prescription_no || 'đơn thuốc'}`} /></td>
                    <td>
                      <strong>{row.prescription_no || prescriptionId || '--'}</strong>
                    </td>
                    <td>
                      <span>{getPersonName(patient, row.patient_name || 'Bệnh nhân')}</span>
                      <small>{[age ? `${age} tuổi` : '', patient.gender].filter(Boolean).join(' / ') || patient.patient_code || '--'}</small>
                    </td>
                    <td>{getPersonName(row.prescribed_by, row.doctor_name || 'Bác sĩ')}</td>
                    <td>{encounter.department_name || encounter.department_id?.department_name || '--'}</td>
                    <td>{formatDateTime(row.prescribed_at || row.created_at)}</td>
                    <td>{row.items_count ?? row.item_count ?? row.items?.length ?? '--'}</td>
                    <td>
                      {hasWarning ? (
                        <span className="pharmacy-warning-pill">
                          <TriangleAlert size={13} strokeWidth={2.3} aria-hidden="true" />
                          Cần kiểm tra
                        </span>
                      ) : (
                        <span className="pharmacy-muted-text">Ổn</span>
                      )}
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>
                      <div className="pharmacy-row-actions">
                        <button type="button" title="Xem chi tiết" onClick={() => navigate(`/pharmacy/prescriptions/${prescriptionId}`)}>
                          <Eye size={15} strokeWidth={2.25} aria-hidden="true" />
                        </button>
                        <button type="button" title="Kiểm tra an toàn thuốc" onClick={() => onCheck(row)}>
                          <ShieldAlert size={15} strokeWidth={2.25} aria-hidden="true" />
                        </button>
                        {canVerify ? (
                          <button type="button" title="Xác minh nhanh" onClick={() => onVerify(row)}>
                            <BadgeCheck size={15} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                        {canCreateDispense ? (
                          <button type="button" title="Tạo phiếu cấp phát" onClick={() => navigate(`/pharmacy/dispensing/create?prescription_id=${encodeURIComponent(prescriptionId)}`)}>
                            <PackageCheck size={15} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                        {canCancel ? (
                          <button className="is-danger" type="button" title="Hủy đơn" onClick={() => onCancel(row)}>
                            <Ban size={15} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <footer className="pharmacy-table-footer">
            <label>
              Hiển thị
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={5}>5 dòng</option>
                <option value={10}>10 dòng</option>
                <option value={20}>20 dòng</option>
              </select>
            </label>
            <div className="pharmacy-table-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                Trước
              </button>
              <span>{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>
                Sau
              </button>
            </div>
          </footer>
        </div>
      ) : null}
    </section>
  );
}

function DispenseQueueTable({ rows, loading, error, permissions, onRetry, onComplete, onCancel }) {
  const navigate = useNavigate();
  const canComplete = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.dispensesComplete);
  const canCancel = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.dispensesCancel);

  return (
    <section className="pharmacy-overview-card pharmacy-table-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Cấp phát</span>
          <h2>Hàng chờ</h2>
        </div>
        <button type="button" onClick={() => navigate('/pharmacy/dispensing/queue')}>
          Mở hàng chờ
        </button>
      </header>
      <WidgetError message={error} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={4} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="Không có phiếu cấp phát đang chờ" description="Các phiếu cấp phát đã được hoàn tất hoặc chưa phát sinh mới." />
      ) : null}
      {!loading && rows.length ? (
        <div className="pharmacy-table-scroll">
          <table className="pharmacy-overview-table is-compact">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Mã đơn</th>
                <th>Bệnh nhân</th>
                <th>Số thuốc</th>
                <th>Trạng thái</th>
                <th>Người tạo</th>
                <th>Thời gian</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dispenseId = getDispenseId(row);
                return (
                  <tr key={dispenseId || row.dispense_no}>
                    <td><strong>{row.dispense_no || dispenseId || 'Phiếu cấp phát'}</strong></td>
                    <td>{row.prescription_id?.prescription_no || row.prescription_no || '--'}</td>
                    <td>{getPersonName(row.patient_id || row.patient, row.patient_name || 'Bệnh nhân')}</td>
                    <td>{getDispenseItemCount(row)}</td>
                    <td><StatusBadge status={row.status} map={DISPENSE_STATUS_META} /></td>
                    <td>{getPersonName(row.created_by, row.created_by_name || '--')}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>
                      <div className="pharmacy-row-actions">
                        <button type="button" title="Xem phiếu cấp phát" onClick={() => navigate(`/pharmacy/dispensing/${dispenseId}`)}>
                          <Eye size={15} strokeWidth={2.25} aria-hidden="true" />
                        </button>
                        {canComplete ? (
                          <button className="is-success" type="button" title="Hoàn tất cấp phát" onClick={() => onComplete(row)}>
                            <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                        {canCancel ? (
                          <button className="is-danger" type="button" title="Hủy cấp phát" onClick={() => onCancel(row)}>
                            <Ban size={15} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function InventorySnapshot({
  lowStockItems,
  expiringBatches,
  recalledBatches,
  unavailableItems,
  transactions,
  loading,
  errors,
  onRetry,
}) {
  const navigate = useNavigate();

  return (
    <section className="pharmacy-overview-card pharmacy-inventory-snapshot">
      <header className="pharmacy-card-head">
        <div>
          <span>Tồn kho nhanh</span>
          <h2>Inventory Snapshot</h2>
        </div>
        <Boxes size={19} strokeWidth={2.25} aria-hidden="true" />
      </header>
      <WidgetError message={errors.stockBatches || errors.transactions} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={5} /> : null}
      {!loading ? (
        <div className="pharmacy-snapshot-grid">
          <div>
            <h3>Thuốc sắp hết hàng</h3>
            {lowStockItems.length ? lowStockItems.slice(0, 4).map((item) => (
              <article key={item._id || item.id || item.batch_no}>
                <strong>{getMedicationName(item.medication_id)}</strong>
                <span>Còn {formatNumber(getAvailableQuantity(item))} | Ngưỡng {formatNumber(getMinStockLevel(item))}</span>
                <button type="button" onClick={() => navigate('/pharmacy/inventory/receipts')}>
                  Nhập kho
                </button>
              </article>
            )) : (
              <small className="pharmacy-muted-text">Không có thuốc dưới ngưỡng trong dữ liệu hiện tại.</small>
            )}
          </div>
          <div>
            <h3>Lô sắp hết hạn</h3>
            {expiringBatches.length ? expiringBatches.slice(0, 4).map((item) => {
              const remainingDays = daysUntil(item.expiry_date);
              return (
                <article key={item._id || item.id || item.batch_no}>
                  <strong>{item.batch_no || item.lot_no || 'Lô thuốc'}</strong>
                  <span>{getMedicationName(item.medication_id)} | {remainingDays !== null ? `${remainingDays} ngày` : '--'}</span>
                  <button type="button" onClick={() => navigate(`/pharmacy/inventory/batches/${item._id || item.id}`)}>
                    Xem lô
                  </button>
                </article>
              );
            }) : (
              <small className="pharmacy-muted-text">Không có lô sắp hết hạn.</small>
            )}
          </div>
          <div>
            <h3>Lô bị thu hồi</h3>
            {recalledBatches.length ? recalledBatches.slice(0, 4).map((item) => (
              <article className="is-danger" key={item._id || item.id || item.batch_no}>
                <strong>{getBatchNo(item)}</strong>
                <span>{getMedicationName(item.medication_id)} | Còn {formatNumber(getAvailableQuantity(item))}</span>
                <button type="button" onClick={() => navigate(`/pharmacy/inventory/batches/${getBatchId(item)}`)}>
                  Xem lô
                </button>
              </article>
            )) : (
              <small className="pharmacy-muted-text">Không có lô bị thu hồi.</small>
            )}
          </div>
          <div>
            <h3>Không còn lô khả dụng</h3>
            {unavailableItems.length ? unavailableItems.slice(0, 4).map((item) => (
              <article key={item._id || item.id || item.medication_code || item.batch_no}>
                <strong>{getMedicationName(item.medication_id || item)}</strong>
                <span>{item.medication_code || getBatchNo(item)} | Cần kiểm tra tồn khả dụng</span>
                <button type="button" onClick={() => navigate('/pharmacy/inventory/batches?status=depleted')}>
                  Xem tồn kho
                </button>
              </article>
            )) : (
              <small className="pharmacy-muted-text">Tất cả thuốc đang có lô khả dụng.</small>
            )}
          </div>
          <div>
            <h3>Giao dịch gần đây</h3>
            {transactions.length ? transactions.slice(0, 4).map((item) => {
              const meta = TRANSACTION_TYPE_META[item.transaction_type] || TRANSACTION_TYPE_META.adjustment;
              return (
                <article key={item.transaction_id || item._id || item.id}>
                  <strong>{meta.label}</strong>
                  <span>{getMedicationName(item.medication_id)} | {formatNumber(item.quantity)}</span>
                  <StatusBadge status={item.transaction_type} map={TRANSACTION_TYPE_META} />
                </article>
              );
            }) : (
              <small className="pharmacy-muted-text">Chưa có giao dịch kho gần đây.</small>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RecentTransactionsTable({ rows, loading, error, onRetry }) {
  const navigate = useNavigate();

  return (
    <section className="pharmacy-overview-card pharmacy-table-card pharmacy-transaction-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Kho thuốc</span>
          <h2>Giao dịch gần đây</h2>
        </div>
        <button type="button" onClick={() => navigate('/pharmacy/inventory/transactions')}>
          Xem tất cả
        </button>
      </header>
      <WidgetError message={error} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={5} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="Chưa có giao dịch kho" description="Giao dịch nhập kho, điều chỉnh hoặc cấp phát sẽ xuất hiện tại đây." />
      ) : null}
      {!loading && rows.length ? (
        <div className="pharmacy-table-scroll">
          <table className="pharmacy-overview-table is-compact is-transactions">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Loại giao dịch</th>
                <th>Thuốc</th>
                <th>Lô</th>
                <th>Số lượng</th>
                <th>Người thực hiện</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 6).map((row) => (
                <tr key={row.transaction_id || row._id || row.id}>
                  <td>{formatDateTime(row.occurred_at || row.created_at)}</td>
                  <td><StatusBadge status={row.transaction_type} map={TRANSACTION_TYPE_META} /></td>
                  <td>{getMedicationName(row.medication_id)}</td>
                  <td>{row.stock_batch_id?.batch_no || row.stock_batch_id?.lot_no || row.batch_no || '--'}</td>
                  <td>{row.direction === 'out' ? '-' : '+'}{formatNumber(row.quantity)}</td>
                  <td>{getPersonName(row.performed_by, row.performed_by_name || '--')}</td>
                  <td>{row.note || row.reason || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function InventoryCompactRiskCard({ lowStockItems, expiringBatches, loading, error, onRetry }) {
  const navigate = useNavigate();

  return (
    <section className="pharmacy-overview-card pharmacy-stock-risk-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Tồn kho</span>
          <h2>Thuốc sắp hết hàng & lô sắp hết hạn</h2>
        </div>
        <button type="button" onClick={() => navigate('/pharmacy/inventory/low-stock')}>
          Xem tất cả
        </button>
      </header>
      <WidgetError message={error} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={4} /> : (
        <div className="pharmacy-stock-risk-grid">
          <section>
            <div className="pharmacy-stock-risk-tabs">
              <strong>Sắp hết hàng</strong>
              <span>&lt; 10</span>
            </div>
            {lowStockItems.length ? (
              <table className="pharmacy-mini-table">
                <thead>
                  <tr>
                    <th>Thuốc</th>
                    <th>ĐVT</th>
                    <th>Còn</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.slice(0, 5).map((item) => (
                    <tr key={item._id || item.id || item.batch_no || getMedicationName(item.medication_id)}>
                      <td>{getMedicationName(item.medication_id || item)}</td>
                      <td>{item.unit || item.medication_id?.unit || item.medication_id?.dosage_form || 'Hộp'}</td>
                      <td>{formatNumber(getAvailableQuantity(item))}</td>
                      <td>
                        <button type="button" onClick={() => navigate('/pharmacy/inventory/receipts')}>
                          Nhập
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <small className="pharmacy-muted-text">Không có thuốc dưới ngưỡng.</small>
            )}
          </section>
          <section>
            <div className="pharmacy-stock-risk-tabs">
              <strong>Lô sắp hết hạn</strong>
              <span>&lt; 30 ngày</span>
            </div>
            {expiringBatches.length ? (
              <table className="pharmacy-mini-table">
                <thead>
                  <tr>
                    <th>Thuốc</th>
                    <th>Lô</th>
                    <th>HSD</th>
                    <th>Còn lại</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringBatches.slice(0, 5).map((item) => {
                    const remainingDays = daysUntil(item.expiry_date);
                    return (
                      <tr key={getBatchId(item) || getBatchNo(item)}>
                        <td>{getMedicationName(item.medication_id)}</td>
                        <td>{getBatchNo(item)}</td>
                        <td>{formatDateOnly(item.expiry_date)}</td>
                        <td>{remainingDays !== null ? `${formatNumber(Math.max(remainingDays, 0))} ngày` : '--'}</td>
                        <td>
                          <button type="button" onClick={() => navigate(`/pharmacy/inventory/batches/${getBatchId(item)}`)}>
                            Xem
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <small className="pharmacy-muted-text">Không có lô sắp hết hạn.</small>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function BatchRiskTable({ rows, loading, error, permissions, onRetry, onExpire, onRecall }) {
  const navigate = useNavigate();
  const canExpire = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.stockBatchesMarkExpired);
  const canRecall = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.stockBatchesRecall);
  const canAdjust = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.inventoryAdjust);

  return (
    <section className="pharmacy-overview-card pharmacy-table-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Lô thuốc</span>
          <h2>Sắp hết hạn và cần xử lý</h2>
        </div>
        <button type="button" onClick={() => navigate('/pharmacy/inventory/expiring')}>
          Xem tất cả
        </button>
      </header>
      <WidgetError message={error} onRetry={onRetry} />
      {loading ? <DashboardSkeleton rows={4} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="Không có lô cần xử lý" description="Không có lô sắp hết hạn, đã hết hạn hoặc bị thu hồi trong bộ lọc hiện tại." />
      ) : null}
      {!loading && rows.length ? (
        <div className="pharmacy-table-scroll">
          <table className="pharmacy-overview-table is-compact">
            <thead>
              <tr>
                <th>Mã lô</th>
                <th>Thuốc</th>
                <th>Ngày hết hạn</th>
                <th>Còn lại</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row) => {
                const batchId = getBatchId(row);
                const remainingDays = daysUntil(row.expiry_date);
                const derivedStatus = String(row.status || '').toLowerCase() || (remainingDays !== null && remainingDays < 0 ? 'expired' : 'expiring');
                return (
                  <tr key={batchId || getBatchNo(row)}>
                    <td><strong>{getBatchNo(row)}</strong></td>
                    <td>{getMedicationName(row.medication_id)}</td>
                    <td>{formatDateTime(row.expiry_date)}</td>
                    <td>{remainingDays !== null ? `${remainingDays} ngày` : formatNumber(getAvailableQuantity(row))}</td>
                    <td><StatusBadge status={derivedStatus} map={BATCH_STATUS_META} /></td>
                    <td>
                      <div className="pharmacy-row-actions">
                        <button type="button" title="Xem lô" onClick={() => navigate(`/pharmacy/inventory/batches/${batchId}`)}>
                          <Eye size={15} strokeWidth={2.25} aria-hidden="true" />
                        </button>
                        {canExpire ? (
                          <button type="button" title="Đánh dấu hết hạn" onClick={() => onExpire(row)}>
                            <TimerOff size={15} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                        {canRecall ? (
                          <button className="is-danger" type="button" title="Thu hồi lô" onClick={() => onRecall(row)}>
                            <Ban size={15} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                        {canAdjust ? (
                          <button type="button" title="Điều chỉnh kho" onClick={() => navigate(`/pharmacy/inventory/adjustments?batch_id=${encodeURIComponent(batchId)}`)}>
                            <SlidersHorizontal size={15} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function BillingMiniCard({ charges, invoices, payments, loading, error }) {
  const navigate = useNavigate();
  const unpaidInvoices = invoices.filter((item) => !['paid', 'voided', 'cancelled'].includes(String(item.status || '').toLowerCase()));
  const revenue = payments.reduce((sum, item) => sum + Number(item.amount || item.payment_amount || 0), 0);
  const sparkSeries = buildDailySeries(payments.length ? payments : charges, {
    days: 7,
    dateAccessor: (item) => item.paid_at || item.payment_date || item.occurred_at || item.created_at,
    valueAccessor: (item) => item.amount || item.payment_amount || item.total_amount || item.charge_amount || 0,
  });
  const recentPayments = [...payments]
    .sort((first, second) => (parseDate(second.paid_at || second.created_at)?.getTime() || 0) - (parseDate(first.paid_at || first.created_at)?.getTime() || 0))
    .slice(0, 3);

  return (
    <section className="pharmacy-overview-card pharmacy-billing-card">
      <header className="pharmacy-card-head">
        <div>
          <span>Thanh toán</span>
          <h2>Nhanh</h2>
        </div>
        <button type="button" onClick={() => navigate('/pharmacy/billing/charges')}>
          Xem chi tiết
        </button>
      </header>
      <WidgetError message={error} />
      {loading ? <DashboardSkeleton rows={3} /> : (
        <div className="pharmacy-billing-quick">
          <div className="pharmacy-billing-metrics">
            <article>
              <small>Doanh thu thuốc hôm nay</small>
              <strong>{formatCurrency(revenue)}</strong>
            </article>
            <TrendLineChart series={sparkSeries} compact />
          </div>
          <div className="pharmacy-billing-secondary">
            <span>
              <small>Hóa đơn chưa thanh toán</small>
              <strong>{formatNumber(unpaidInvoices.length)}</strong>
            </span>
            <span>
              <small>Charge gần đây</small>
              <strong>{formatNumber(charges.length)}</strong>
            </span>
          </div>
          <div className="pharmacy-payment-list">
            <strong>Payment gần đây</strong>
            {recentPayments.length ? recentPayments.map((item) => (
              <button
                type="button"
                key={item.payment_id || item._id || item.id}
                onClick={() => navigate(`/pharmacy/billing/payments/${item.payment_id || item._id || item.id}`)}
              >
                <span>
                  <small>{item.payment_no || item.invoice_id?.invoice_no || item.invoice_no || 'Payment'}</small>
                  <em>{formatTime(item.paid_at || item.payment_date || item.created_at)}</em>
                </span>
                <strong>{formatCurrency(item.amount || item.payment_amount)}</strong>
              </button>
            )) : (
              <small className="pharmacy-muted-text">Chưa có payment trong bộ lọc hiện tại.</small>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SafetyDialog({ state, busy, onCancel, onConfirm }) {
  if (!state) return null;

  return (
    <div className="pharmacy-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="pharmacy-dialog" role="dialog" aria-modal="true" aria-labelledby="pharmacy-safety-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Cảnh báo an toàn thuốc</span>
            <h2 id="pharmacy-safety-title">{state.prescription?.prescription_no || 'Đơn thuốc'}</h2>
          </div>
          <button type="button" aria-label="Đóng hộp thoại" onClick={onCancel}>
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </header>
        <div className="pharmacy-dialog-findings">
          {state.findings.length ? state.findings.map((item, index) => (
            <article className={`is-${item.tone}`} key={`${item.title}-${index}`}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </article>
          )) : (
            <article className="is-success">
              <strong>Không phát hiện cảnh báo nghiêm trọng</strong>
              <span>Các kiểm tra an toàn thuốc đã hoàn tất.</span>
            </article>
          )}
        </div>
        {state.mode === 'verify' ? (
          <p>Bạn có muốn tiếp tục xác minh đơn thuốc này không?</p>
        ) : null}
        <footer>
          <button type="button" onClick={onCancel} disabled={busy}>Đóng</button>
          {state.mode === 'verify' ? (
            <button className="is-primary" type="button" onClick={onConfirm} disabled={busy}>
              {busy ? 'Đang xác minh...' : 'Tiếp tục xác minh'}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

export function PharmacyOverview() {
  const navigate = useNavigate();
  const { permissions } = usePharmacyWorkspace();
  const [filters, setFilters] = useState({
    range: 'today',
    date: '',
    warehouse: '',
    department: '',
    pharmacist: '',
    prescriptionStatus: '',
    inventoryStatus: '',
  });
  const [state, setState] = useState({
    loading: true,
    data: null,
    errors: {},
  });
  const [safetyDialog, setSafetyDialog] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function loadData() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const data = await loadPharmacyOverviewData(filters);
      setState({ loading: false, data, errors: data.errors || {} });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        errors: {
          ...(current.errors || {}),
          overview: getApiErrorMessage(error, 'Không thể tải Pharmacy Overview.'),
        },
      }));
    }
  }

  useEffect(() => {
    loadData();
  }, [
    filters.range,
    filters.date,
    filters.warehouse,
    filters.department,
    filters.pharmacist,
    filters.prescriptionStatus,
    filters.inventoryStatus,
  ]);

  const data = state.data || {};
  const prescriptions = data.prescriptions || [];
  const dispenses = data.dispenses || [];
  const stockBatches = data.stockBatches || [];
  const expiringBatches = data.expiringBatches?.length ? data.expiringBatches : stockBatches.filter((item) => isExpiringBatch(item, 30));
  const transactions = data.transactions || [];
  const inventorySummary = data.inventoryReport?.summary || {};
  const dashboardCards = Object.fromEntries((data.inventoryDashboard?.cards || []).map((item) => [item.key, item.value]));

  const prescriptionCounts = useMemo(() => {
    if (data.prescriptionStatusTotals) {
      return {
        pending: Number(data.prescriptionStatusTotals.pending || 0),
        ready: Number(data.prescriptionStatusTotals.ready || 0),
        dispensed: Number(data.prescriptionStatusTotals.dispensed || 0),
        cancelled: Number(data.prescriptionStatusTotals.cancelled || 0),
        preparing: Number(data.prescriptionStatusTotals.preparing || 0),
      };
    }
    const pending = safeCountBy(prescriptions, isPendingPrescription);
    const ready = safeCountBy(prescriptions, isReadyPrescription);
    const dispensed = safeCountBy(prescriptions, isDispensedPrescription);
    const cancelled = safeCountBy(prescriptions, (item) => String(item.status || '').toLowerCase() === 'cancelled');
    const preparing = safeCountBy(prescriptions, (item) => ['preparing', 'partially_dispensed'].includes(String(item.status || '').toLowerCase()));
    return { pending, ready, dispensed, cancelled, preparing };
  }, [data.prescriptionStatusTotals, prescriptions]);

  const pendingRows = useMemo(
    () => (data.pendingPrescriptions?.length ? data.pendingPrescriptions : prescriptions.filter(isPendingPrescription)),
    [data.pendingPrescriptions, prescriptions],
  );

  const dispenseRows = useMemo(
    () =>
      dispenses
        .filter((item) => !['dispensed', 'cancelled', 'returned'].includes(String(item.status || '').toLowerCase()))
        .slice(0, 6),
    [dispenses],
  );

  const lowStockItems = useMemo(
    () =>
      stockBatches
        .filter((item) => getAvailableQuantity(item) > 0 && getAvailableQuantity(item) <= getMinStockLevel(item))
        .slice(0, 8),
    [stockBatches],
  );

  const recalledBatches = stockBatches.filter((item) => String(item.status || '').toLowerCase() === 'recalled');
  const expiredBatches = stockBatches.filter((item) => String(item.status || '').toLowerCase() === 'expired' || daysUntil(item.expiry_date) < 0);
  const riskBatches = [...expiringBatches, ...expiredBatches, ...recalledBatches]
    .filter((item, index, items) => {
      const key = getBatchId(item) || getBatchNo(item);
      return items.findIndex((candidate) => (getBatchId(candidate) || getBatchNo(candidate)) === key) === index;
    });
  const unavailableItems = [
    ...(data.medications || []).filter(isUnavailableStock),
    ...stockBatches.filter(isUnavailableStock),
  ].filter((item, index, items) => {
    const key = getId(item.medication_id || item) || getBatchId(item) || item.medication_code || item.batch_no;
    return items.findIndex((candidate) => (getId(candidate.medication_id || candidate) || getBatchId(candidate) || candidate.medication_code || candidate.batch_no) === key) === index;
  });
  const inventoryValue = inventorySummary.inventory_value ?? dashboardCards.inventory_value ?? 0;
  const lowStockCount = inventorySummary.low_stock_items ?? dashboardCards.low_stock ?? lowStockItems.length;
  const nearExpiryCount = inventorySummary.near_expiry_batches ?? dashboardCards.near_expiry ?? expiringBatches.length;
  const expiredCount = inventorySummary.expired_batches ?? dashboardCards.expired_batches ?? expiredBatches.length;
  const recalledCount = inventorySummary.recalled_batches ?? recalledBatches.length;
  const totalBatchCount = inventorySummary.total_batches ?? stockBatches.length;
  const unavailableCount = inventorySummary.unavailable_medications ?? unavailableItems.length;

  const kpis = [
    {
      label: 'Tổng đơn thuốc hôm nay',
      value: formatNumber(data.prescriptionsTotal || prescriptions.length),
      hint: `${formatNumber(data.dispensesTotal || dispenses.length)} phiếu cấp phát`,
      icon: ClipboardCheck,
      tone: 'info',
      to: '/pharmacy/prescriptions',
    },
    {
      label: 'Chờ xác minh',
      value: formatNumber(prescriptionCounts.pending),
      hint: 'Ưu tiên kiểm tra an toàn thuốc',
      icon: Clock3,
      tone: 'warning',
      to: '/pharmacy/prescriptions/pending-verification',
    },
    {
      label: 'Sẵn sàng cấp phát',
      value: formatNumber(prescriptionCounts.ready),
      hint: 'Có thể tạo phiếu cấp phát',
      icon: CheckCircle2,
      tone: 'info',
      to: '/pharmacy/prescriptions/ready-to-dispense',
    },
    {
      label: 'Đã cấp phát',
      value: formatNumber(prescriptionCounts.dispensed),
      hint: `${formatNumber(prescriptionCounts.cancelled)} đơn đã hủy`,
      icon: FileCheck2,
      tone: 'success',
      to: '/pharmacy/prescriptions/dispensed',
    },
    {
      label: 'Tổng mặt hàng thuốc',
      value: formatNumber(inventorySummary.total_medications || data.medications?.length || 0),
      hint: `${formatNumber(inventorySummary.total_batches || stockBatches.length)} lô thuốc`,
      icon: Pill,
      tone: 'neutral',
      to: '/pharmacy/medications',
    },
    {
      label: 'Sắp hết hàng',
      value: formatNumber(lowStockCount),
      hint: 'Dưới ngưỡng tồn tối thiểu',
      icon: TriangleAlert,
      tone: 'danger',
      to: '/pharmacy/inventory/low-stock',
    },
    {
      label: 'Sắp hết hạn',
      value: formatNumber(nearExpiryCount),
      hint: `${formatNumber(expiredCount)} lô đã hết hạn`,
      icon: TimerOff,
      tone: 'warning',
      to: '/pharmacy/inventory/expiring',
    },
    {
      label: 'Bị thu hồi',
      value: formatNumber(recalledCount),
      hint: `${formatNumber(expiredCount)} lô đã hết hạn`,
      icon: Ban,
      tone: 'danger',
      to: '/pharmacy/inventory/recalls',
    },
  ];

  const operations = [
    {
      label: 'Tổng lô thuốc',
      value: formatNumber(totalBatchCount),
      hint: 'Theo dữ liệu tồn kho',
      icon: Boxes,
      tone: 'info',
      onClick: () => navigate('/pharmacy/inventory/batches'),
    },
    {
      label: 'Giao dịch kho hôm nay',
      value: formatNumber(transactions.length),
      hint: 'Nhập, điều chỉnh, cấp phát',
      icon: SlidersHorizontal,
      tone: 'success',
      onClick: () => navigate('/pharmacy/inventory/transactions'),
    },
    {
      label: 'Giá trị tồn kho ước tính',
      value: formatCurrency(inventoryValue),
      hint: 'Từ dashboard/report inventory',
      icon: CircleDollarSign,
      tone: 'neutral',
      onClick: () => navigate('/pharmacy/reports/inventory'),
    },
    {
      label: 'Không có lô khả dụng',
      value: formatNumber(unavailableCount),
      hint: 'Cần nhập hoặc điều chỉnh',
      icon: PackagePlus,
      tone: 'warning',
      onClick: () => navigate('/pharmacy/inventory/batches?status=depleted'),
    },
  ];

  const chartData = [
    { label: 'Chờ xác minh', value: prescriptionCounts.pending },
    { label: 'Sẵn sàng cấp phát', value: prescriptionCounts.ready },
    { label: 'Đang chuẩn bị', value: prescriptionCounts.preparing },
    { label: 'Đã cấp phát', value: prescriptionCounts.dispensed },
    { label: 'Đã hủy', value: prescriptionCounts.cancelled },
  ];
  const dispenseTrendSeries = buildDailySeries(dispenses.length ? dispenses : prescriptions, {
    days: 7,
    dateAccessor: (item) => item.dispensed_at || item.completed_at || item.created_at || item.prescribed_at,
    valueAccessor: () => 1,
  });

  const alerts = [
    prescriptionCounts.pending > 0 ? {
      id: 'pending-prescriptions',
      icon: Clock3,
      tone: 'warning',
      level: 'High',
      title: `${formatNumber(prescriptionCounts.pending)} đơn chờ xác minh`,
      description: 'Kiểm tra dị ứng, tương tác và thuốc trùng trước khi verify.',
      onClick: () => navigate('/pharmacy/prescriptions/pending-verification'),
    } : null,
    Number(lowStockCount) > 0 ? {
      id: 'low-stock',
      icon: TriangleAlert,
      tone: 'danger',
      level: 'High',
      title: `${formatNumber(lowStockCount)} thuốc sắp hết hàng`,
      description: 'Một số thuốc đã dưới ngưỡng tồn tối thiểu.',
      onClick: () => navigate('/pharmacy/inventory/low-stock'),
    } : null,
    Number(nearExpiryCount) > 0 ? {
      id: 'near-expiry',
      icon: TimerOff,
      tone: 'warning',
      level: 'Medium',
      title: `${formatNumber(nearExpiryCount)} lô sắp hết hạn`,
      description: 'Theo dõi hạn dùng trong 30 ngày tới.',
      onClick: () => navigate('/pharmacy/inventory/expiring'),
    } : null,
    Number(recalledCount) > 0 ? {
      id: 'recalled',
      icon: Ban,
      tone: 'danger',
      level: 'High',
      title: `${formatNumber(recalledCount)} lô bị thu hồi`,
      description: 'Ngừng cấp phát và rà soát giao dịch liên quan.',
      onClick: () => navigate('/pharmacy/inventory/recalls'),
    } : null,
    Number(unavailableCount) > 0 ? {
      id: 'unavailable-stock',
      icon: PackagePlus,
      tone: 'warning',
      level: 'Medium',
      title: `${formatNumber(unavailableCount)} thuốc chưa có lô khả dụng`,
      description: 'Không thể chọn lô cấp phát nếu chưa nhập hoặc điều chỉnh tồn.',
      onClick: () => navigate('/pharmacy/inventory/batches?status=depleted'),
    } : null,
  ].filter(Boolean);

  async function handleSafetyCheck(row, mode = 'check') {
    const prescriptionId = getPrescriptionId(row);
    if (!prescriptionId) return;
    setActionBusy(true);
    setToast('');
    try {
      const safety = await runPrescriptionSafetyChecks(prescriptionId);
      setSafetyDialog({
        prescription: row,
        findings: safety.findings,
        mode,
      });
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể kiểm tra an toàn thuốc.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmVerify() {
    const prescriptionId = getPrescriptionId(safetyDialog?.prescription);
    if (!prescriptionId) return;
    setActionBusy(true);
    setToast('');
    try {
      await verifyPrescriptionFromOverview(prescriptionId, {
        override_allergy: safetyDialog.findings?.some((item) => item.title === 'Cảnh báo dị ứng') || undefined,
        override_interaction_warning_reason: safetyDialog.findings?.length ? 'Đã rà soát cảnh báo an toàn thuốc tại Pharmacy Overview.' : undefined,
      });
      setSafetyDialog(null);
      setToast('Đã xác minh đơn thuốc.');
      await loadData();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể xác minh đơn thuốc.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCancelPrescription(row) {
    const prescriptionId = getPrescriptionId(row);
    if (!prescriptionId || !window.confirm(`Hủy đơn ${row.prescription_no || prescriptionId}?`)) return;
    setActionBusy(true);
    setToast('');
    try {
      await cancelPrescriptionFromOverview(prescriptionId, { cancel_reason: 'Hủy từ Pharmacy Overview.' });
      setToast('Đã hủy đơn thuốc.');
      await loadData();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể hủy đơn thuốc.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCompleteDispense(row) {
    const dispenseId = getDispenseId(row);
    if (!dispenseId || !window.confirm(`Hoàn tất phiếu cấp phát ${row.dispense_no || dispenseId}?`)) return;
    setActionBusy(true);
    setToast('');
    try {
      await completeDispenseFromOverview(dispenseId, { note: 'Hoàn tất từ Pharmacy Overview.' });
      setToast('Đã hoàn tất phiếu cấp phát.');
      await loadData();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể hoàn tất phiếu cấp phát.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCancelDispense(row) {
    const dispenseId = getDispenseId(row);
    if (!dispenseId || !window.confirm(`Hủy phiếu cấp phát ${row.dispense_no || dispenseId}?`)) return;
    setActionBusy(true);
    setToast('');
    try {
      await cancelDispenseFromOverview(dispenseId, { cancel_reason: 'Hủy từ Pharmacy Overview.' });
      setToast('Đã hủy phiếu cấp phát.');
      await loadData();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể hủy phiếu cấp phát.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleExpireBatch(row) {
    const batchId = getBatchId(row);
    if (!batchId || !window.confirm(`Đánh dấu hết hạn lô ${getBatchNo(row)}?`)) return;
    setActionBusy(true);
    setToast('');
    try {
      await markStockBatchExpiredFromOverview(batchId, { expire_reason: 'Đánh dấu hết hạn từ Pharmacy Overview.' });
      setToast('Đã đánh dấu lô thuốc hết hạn.');
      await loadData();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể đánh dấu lô hết hạn.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRecallBatch(row) {
    const batchId = getBatchId(row);
    if (!batchId || !window.confirm(`Thu hồi lô ${getBatchNo(row)}?`)) return;
    setActionBusy(true);
    setToast('');
    try {
      await recallStockBatchFromOverview(batchId, { recall_reason: 'Thu hồi từ Pharmacy Overview.' });
      setToast('Đã thu hồi lô thuốc.');
      await loadData();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể thu hồi lô thuốc.'));
    } finally {
      setActionBusy(false);
    }
  }

  const mainError = state.errors.overview;
  const prescriptionError = state.errors.prescriptions;
  const inventoryError = state.errors.inventoryReport || state.errors.inventoryDashboard;
  const stockError = state.errors.stockBatches || state.errors.expiringBatches;

  return (
    <div className="pharmacy-overview-page">
      {toast ? (
        <button type="button" className="pharmacy-overview-toast" onClick={() => setToast('')}>
          <span>{toast}</span>
          <X size={14} strokeWidth={2.3} aria-hidden="true" />
        </button>
      ) : null}

      <section className="pharmacy-overview-header">
        <div>
          <span>Pharmacy Overview</span>
          <h1>Tổng quan nhà thuốc</h1>
          <p>Theo dõi đơn thuốc, cấp phát và tồn kho trong ngày.</p>
        </div>
        <div className="pharmacy-overview-filters">
          <div className="pharmacy-range-control" role="group" aria-label="Khoảng thời gian">
            {RANGE_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={filters.range === item.key ? 'is-active' : ''}
                onClick={() => setFilters((current) => ({ ...current, range: item.key, date: '' }))}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label>
            <CalendarDays size={15} strokeWidth={2.25} aria-hidden="true" />
            <input
              type="date"
              value={filters.date}
              onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value, range: 'custom' }))}
              aria-label="Lọc theo ngày"
            />
          </label>
          <label>
            <Boxes size={15} strokeWidth={2.25} aria-hidden="true" />
            <input
              value={filters.warehouse}
              onChange={(event) => setFilters((current) => ({ ...current, warehouse: event.target.value }))}
              placeholder="Kho thuốc"
              aria-label="Lọc theo kho thuốc"
            />
          </label>
          <label>
            <Search size={15} strokeWidth={2.25} aria-hidden="true" />
            <input
              value={filters.department}
              onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}
              placeholder="Khoa kê đơn"
              aria-label="Lọc theo khoa kê đơn"
            />
          </label>
          <label>
            <Pill size={15} strokeWidth={2.25} aria-hidden="true" />
            <input
              value={filters.pharmacist}
              onChange={(event) => setFilters((current) => ({ ...current, pharmacist: event.target.value }))}
              placeholder="Bác sĩ/Dược sĩ"
              aria-label="Lọc theo bác sĩ hoặc dược sĩ"
            />
          </label>
          <label>
            <Filter size={15} strokeWidth={2.25} aria-hidden="true" />
            <select
              value={filters.prescriptionStatus}
              onChange={(event) => setFilters((current) => ({ ...current, prescriptionStatus: event.target.value }))}
            >
              <option value="">Trạng thái đơn</option>
              <option value="draft">Chờ xác minh</option>
              <option value="verified">Sẵn sàng cấp phát</option>
              <option value="fully_dispensed">Đã cấp phát</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </label>
          <label>
            <TriangleAlert size={15} strokeWidth={2.25} aria-hidden="true" />
            <select
              value={filters.inventoryStatus}
              onChange={(event) => setFilters((current) => ({ ...current, inventoryStatus: event.target.value }))}
            >
              <option value="">Trạng thái tồn kho</option>
              <option value="active">Khả dụng</option>
              <option value="expiring">Sắp hết hạn</option>
              <option value="expired">Đã hết hạn</option>
              <option value="recalled">Thu hồi</option>
              <option value="depleted">Hết tồn</option>
            </select>
          </label>
          <button type="button" className="pharmacy-refresh-button" onClick={loadData}>
            <RefreshCw size={16} strokeWidth={2.25} aria-hidden="true" />
            Làm mới
          </button>
        </div>
      </section>

      <WidgetError message={mainError} onRetry={loadData} />

      <section className="pharmacy-kpi-grid" aria-label="KPI nhà thuốc">
        {kpis.map((item) => (
          <KpiCard key={item.label} item={item} loading={state.loading} onClick={() => navigate(item.to)} />
        ))}
      </section>

      <section className="pharmacy-overview-analytics-grid">
        <PrescriptionStatusCard
          chartData={chartData}
          loading={state.loading}
          error={prescriptionError}
          onRetry={loadData}
        />
        <DispenseTrendCard
          series={dispenseTrendSeries}
          loading={state.loading}
          error={state.errors.dispenses}
          onRetry={loadData}
        />
        <PriorityAlerts
          alerts={alerts}
          loading={state.loading}
          error={inventoryError && !prescriptionError ? inventoryError : ''}
          onRetry={loadData}
          onOpenAll={() => navigate('/pharmacy/notifications')}
        />
        <BillingMiniCard
          charges={data.charges || []}
          invoices={data.invoices || []}
          payments={data.payments || []}
          loading={state.loading}
          error={state.errors.billing}
        />
      </section>

      <PendingPrescriptionsTable
        rows={pendingRows}
        loading={state.loading}
        error={prescriptionError}
        permissions={permissions}
        onRetry={loadData}
        onCheck={(row) => handleSafetyCheck(row, 'check')}
        onVerify={(row) => handleSafetyCheck(row, 'verify')}
        onCancel={handleCancelPrescription}
      />

      <section className="pharmacy-overview-bottom-grid">
        <RecentTransactionsTable
          rows={transactions}
          loading={state.loading}
          error={state.errors.transactions}
          onRetry={loadData}
        />
        <InventoryCompactRiskCard
          lowStockItems={lowStockItems}
          expiringBatches={expiringBatches}
          loading={state.loading}
          error={stockError}
          onRetry={loadData}
        />
      </section>

      <SafetyDialog
        state={safetyDialog}
        busy={actionBusy}
        onCancel={() => setSafetyDialog(null)}
        onConfirm={confirmVerify}
      />
    </div>
  );
}
