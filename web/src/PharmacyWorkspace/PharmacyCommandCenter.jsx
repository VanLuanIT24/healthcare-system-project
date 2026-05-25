import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FileText,
  Filter,
  Gauge,
  Layers3,
  PackageCheck,
  PackagePlus,
  Pill,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
  TimerOff,
  UserCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { getApiErrorMessage, unwrapData } from '../utils/api';
import {
  acknowledgePharmacyAlert,
  assignPharmacyWorkItem,
  completeDispenseFromOverview,
  loadPharmacyAlerts,
  loadPharmacyCommandDashboard,
  loadPharmacyDispensingToday,
  loadPharmacyPerformance,
  loadPharmacyWorkQueue,
  previewDispenseCompletionPlanFromOverview,
  pharmacyTopbarApi,
  resolvePharmacyAlert,
  resolvePharmacyWorkItem,
  verifyPrescriptionFromOverview,
} from './pharmacyApi';
import { confirmPharmacyAction, notifyPharmacy } from './pharmacyActions';

const RANGE_OPTIONS = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
];

const PRIORITY_META = {
  critical: { label: 'Critical', tone: 'danger' },
  high: { label: 'High', tone: 'warning' },
  medium: { label: 'Medium', tone: 'info' },
  low: { label: 'Low', tone: 'muted' },
};

const WORK_TYPE_LABELS = {
  prescription_verification: 'Đơn chờ duyệt',
  clinical_review: 'Cần kiểm tra',
  dispense_waiting: 'Chờ cấp phát',
  dispense_preparing: 'Đang chuẩn bị',
  stock_shortage: 'Không đủ tồn',
  near_expiry_batch: 'Lô sắp hết hạn',
  expired_batch: 'Lô hết hạn',
  return_dispense: 'Hoàn trả',
  refill_request: 'Refill',
};

const ALERT_TYPE_LABELS = {
  low_stock: 'Dưới tồn tối thiểu',
  out_of_stock: 'Hết thuốc',
  near_expiry: 'Sắp hết hạn',
  expired: 'Đã hết hạn',
  recalled: 'Thu hồi',
  quarantined: 'Cách ly',
  insufficient_stock: 'Thiếu tồn cấp phát',
  allergy: 'Dị ứng',
  interaction: 'Tương tác',
  duplicate_medication: 'Trùng thuốc',
  high_usage: 'Dùng nhiều',
  waste: 'Hao hụt',
  dispense_sla_breached: 'Quá SLA cấp phát',
  verification_sla_breached: 'Quá SLA duyệt',
};

const DISPENSE_COLUMN_META = [
  { key: 'waiting', label: 'Chờ cấp phát', tone: 'info' },
  { key: 'preparing', label: 'Đang chuẩn bị', tone: 'warning' },
  { key: 'partially_dispensed', label: 'Cấp một phần', tone: 'purple' },
  { key: 'dispensed', label: 'Đã cấp', tone: 'success' },
  { key: 'returned', label: 'Hoàn trả', tone: 'muted' },
  { key: 'cancelled', label: 'Hủy', tone: 'danger' },
];

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

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function normalizeMeta(value, fallback = '--') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.full_name || value.username || value.patient_code || value.medication_code || value.batch_no || fallback;
}

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (['critical', 'expired', 'recalled', 'cancelled'].includes(normalized)) return 'danger';
  if (['high', 'draft', 'active', 'near_expiry', 'acknowledged', 'assigned'].includes(normalized)) return 'warning';
  if (['verified', 'in_progress', 'dispense_waiting'].includes(normalized)) return 'info';
  if (['dispensed', 'resolved', 'completed', 'fully_dispensed'].includes(normalized)) return 'success';
  if (['partially_dispensed'].includes(normalized)) return 'purple';
  return 'muted';
}

function useCommandData(loader, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await loader();
      setState({ loading: false, data, error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: getApiErrorMessage(error, 'Không thể tải dữ liệu nhà thuốc.') });
    }
  }

  useEffect(() => {
    refresh();
  }, deps);

  return { ...state, refresh };
}

function StatusBadge({ value, label }) {
  const meta = PRIORITY_META[value] || { label: label || value || 'Không rõ', tone: getStatusTone(value) };
  return <span className={`pharmacy-command-badge is-${meta.tone}`}>{label || meta.label}</span>;
}

function CommandFilters({ filters, setFilters, onRefresh, children }) {
  return (
    <div className="pharmacy-command-filters">
      <div className="pharmacy-command-range" role="group" aria-label="Khoảng thời gian">
        {RANGE_OPTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filters.range === item.key && !filters.date ? 'is-active' : ''}
            onClick={() => setFilters((current) => ({ ...current, range: item.key, date: '' }))}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label>
        <CalendarDays size={15} aria-hidden="true" />
        <input
          type="date"
          value={filters.date || ''}
          aria-label="Ngày làm việc"
          onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
        />
      </label>
      <label>
        <Boxes size={15} aria-hidden="true" />
        <input
          value={filters.storageLocation || ''}
          placeholder="Vị trí kho"
          aria-label="Vị trí kho"
          onChange={(event) => setFilters((current) => ({ ...current, storageLocation: event.target.value }))}
        />
      </label>
      <label>
        <PackagePlus size={15} aria-hidden="true" />
        <input
          value={filters.supplier || ''}
          placeholder="Nhà cung cấp"
          aria-label="Nhà cung cấp"
          onChange={(event) => setFilters((current) => ({ ...current, supplier: event.target.value }))}
        />
      </label>
      {children}
      <button type="button" className="pharmacy-command-icon-btn" title="Làm mới" aria-label="Làm mới" onClick={onRefresh}>
        <RefreshCw size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function CommandHeader({ eyebrow, title, description, filters, setFilters, onRefresh, children }) {
  const today = new Date().toLocaleDateString('vi-VN');
  return (
    <section className="pharmacy-command-header">
      <div className="pharmacy-command-header__copy">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="pharmacy-command-header__meta">
        <span>Ngày làm việc: {filters.date ? formatDateOnly(filters.date) : today}</span>
        <span>Ca: Sáng / Chiều / Đêm</span>
        <span>Realtime: Online</span>
      </div>
      <CommandFilters filters={filters} setFilters={setFilters} onRefresh={onRefresh}>
        {children}
      </CommandFilters>
    </section>
  );
}

function AlertStrip({ summary = {}, cards = {} }) {
  const items = [
    { label: 'Critical', value: summary.critical ?? cards.expired_batches ?? 0, tone: 'danger' },
    { label: 'High', value: summary.high ?? cards.low_stock_items ?? 0, tone: 'warning' },
    { label: 'Low stock', value: cards.low_stock_items ?? 0, tone: 'warning' },
    { label: 'Near expiry', value: cards.near_expiry_batches ?? 0, tone: 'info' },
    { label: 'Out of stock', value: cards.out_of_stock_items ?? 0, tone: 'danger' },
    { label: 'Insufficient', value: cards.insufficient_for_dispensing ?? 0, tone: 'danger' },
    { label: 'Allergy review', value: cards.allergy_review ?? 0, tone: 'purple' },
    { label: 'Interaction', value: cards.interaction_review ?? 0, tone: 'purple' },
  ];

  return (
    <section className="pharmacy-realtime-strip" aria-label="Cảnh báo realtime">
      {items.map((item) => (
        <span key={item.label} className={`is-${item.tone}`}>
          <strong>{item.label}</strong>
          <em>{formatNumber(item.value)}</em>
        </span>
      ))}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone = 'info', onClick }) {
  return (
    <button type="button" className={`pharmacy-command-metric is-${tone}`} onClick={onClick}>
      <span aria-hidden="true"><Icon size={21} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{hint}</em>
    </button>
  );
}

function Panel({ eyebrow, title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={`pharmacy-command-panel ${className}`}>
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {action || (Icon ? <Icon size={19} aria-hidden="true" /> : null)}
      </header>
      {children}
    </section>
  );
}

function ErrorState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="pharmacy-command-error">
      <AlertTriangle size={17} aria-hidden="true" />
      <span>{error}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="pharmacy-command-empty">
      <CheckCircle2 size={24} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function FunnelChart({ rows = [] }) {
  const max = Math.max(...rows.map((item) => Number(item.count || item.value || 0)), 1);
  return (
    <div className="pharmacy-command-funnel">
      {rows.map((item) => {
        const value = Number(item.count || item.value || 0);
        return (
          <div key={item.status || item.label}>
            <span>{item.label || item.status}</span>
            <i style={{ width: `${Math.max((value / max) * 100, 8)}%` }} />
            <strong>{formatNumber(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function MiniBars({ rows = [], labelKey = 'hour', valueKey = 'count' }) {
  const max = Math.max(...rows.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <div className="pharmacy-command-bars">
      {rows.length ? rows.map((item) => (
        <div key={item[labelKey]}>
          <span style={{ height: `${Math.max((Number(item[valueKey] || 0) / max) * 100, 8)}%` }} />
          <small>{item[labelKey]}</small>
        </div>
      )) : <EmptyState title="Chưa có dữ liệu" body="Biểu đồ sẽ cập nhật khi phát sinh giao dịch." />}
    </div>
  );
}

function QuickActions() {
  const navigate = useNavigate();
  const actions = [
    { label: 'Nhập kho', icon: PackagePlus, to: '/pharmacy/transactions/receive-stock' },
    { label: 'Tạo dispense', icon: PackageCheck, to: '/pharmacy/dispensing/queue' },
    { label: 'Tìm thuốc', icon: Pill, to: '/pharmacy/inventory/medication-catalog' },
    { label: 'Kiểm tra tồn', icon: Boxes, to: '/pharmacy/inventory/current-stock' },
    { label: 'Lô sắp hết hạn', icon: TimerOff, to: '/pharmacy/inventory/expiring-batches' },
    { label: 'Export báo cáo', icon: FileText, to: '/pharmacy/reports/inventory-overview' },
  ];

  return (
    <Panel eyebrow="Quick actions" title="Thao tác nhanh" icon={SlidersHorizontal}>
      <div className="pharmacy-command-actions">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" onClick={() => navigate(item.to)}>
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function WorkQueueTable({ rows = [], onSelect, onAssign, onResolve }) {
  return (
    <div className="pharmacy-command-table-scroll">
      <table className="pharmacy-command-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>SLA</th>
            <th>Loại việc</th>
            <th>Mã tham chiếu</th>
            <th>Bệnh nhân / nguồn</th>
            <th>Rủi ro</th>
            <th>Chờ từ</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row._id || row.reference_no}>
              <td><StatusBadge value={row.priority} /></td>
              <td>
                <span className={row.due_at && new Date(row.due_at) < new Date() ? 'pharmacy-command-sla is-overdue' : 'pharmacy-command-sla'}>
                  {row.due_at && new Date(row.due_at) < new Date() ? 'Quá SLA' : `${row.sla_minutes || '--'} phút`}
                </span>
              </td>
              <td>{WORK_TYPE_LABELS[row.type] || row.type}</td>
              <td><strong>{row.reference_no || row.work_item_code || '--'}</strong></td>
              <td>
                <span>{row.patient_name || row.source_label || '--'}</span>
                <small>{row.source_label || row.description || '--'}</small>
              </td>
              <td>
                <div className="pharmacy-risk-pills">
                  {Object.entries(row.risk_flags || {}).filter(([, value]) => value).slice(0, 3).map(([key]) => (
                    <span key={key}>{key.replace(/_/g, ' ')}</span>
                  ))}
                  {!Object.values(row.risk_flags || {}).some(Boolean) ? <em>Ổn</em> : null}
                </div>
              </td>
              <td>{formatNumber(row.waiting_minutes || 0)} phút</td>
              <td>
                <div className="pharmacy-command-row-actions">
                  <button type="button" title="Xem chi tiết" aria-label="Xem chi tiết" onClick={() => onSelect(row)}>
                    <Eye size={15} />
                  </button>
                  {!row.derived ? (
                    <button type="button" title="Gán cho tôi" aria-label="Gán cho tôi" onClick={() => onAssign(row)}>
                      <UserCheck size={15} />
                    </button>
                  ) : null}
                  {!row.derived ? (
                    <button type="button" title="Đánh dấu xong" aria-label="Đánh dấu xong" onClick={() => onResolve(row)}>
                      <CheckCircle2 size={15} />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkItemDrawer({ item, onClose }) {
  if (!item) return null;
  return (
    <aside className="pharmacy-command-drawer">
      <header>
        <div>
          <span>{WORK_TYPE_LABELS[item.type] || item.type}</span>
          <h3>{item.reference_no || item.work_item_code || item.title}</h3>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="pharmacy-command-drawer__tabs">
        {['Tổng quan', 'Đơn / phiếu / lô', 'Tồn kho', 'Cảnh báo lâm sàng', 'Lịch sử', 'Ghi chú'].map((tab) => (
          <span key={tab}>{tab}</span>
        ))}
      </div>
      <div className="pharmacy-command-drawer__body">
        <dl>
          <div><dt>Ưu tiên</dt><dd><StatusBadge value={item.priority} /></dd></div>
          <div><dt>Trạng thái</dt><dd>{item.status || 'open'}</dd></div>
          <div><dt>Bệnh nhân</dt><dd>{item.patient_name || '--'}</dd></div>
          <div><dt>Nguồn</dt><dd>{item.source_label || item.source_type || '--'}</dd></div>
          <div><dt>SLA</dt><dd>{item.due_at ? formatDateTime(item.due_at) : '--'}</dd></div>
        </dl>
        <p>{item.description || 'Không có ghi chú bổ sung.'}</p>
      </div>
    </aside>
  );
}

function AlertList({ alerts = [], onSelect, onAcknowledge, onResolve }) {
  return (
    <div className="pharmacy-command-alert-list">
      {alerts.map((item) => (
        <article key={item.id || item._id}>
          <span className={`pharmacy-command-alert-severity is-${getStatusTone(item.severity)}`} />
          <div>
            <strong>{item.title}</strong>
            <small>{item.message || item.object_label || '--'}</small>
          </div>
          <StatusBadge value={item.severity} />
          <div className="pharmacy-command-row-actions">
            <button type="button" title="Xem chi tiết" aria-label="Xem chi tiết" onClick={() => onSelect(item)}><Eye size={15} /></button>
            {!item.derived ? (
              <button type="button" title="Xác nhận" aria-label="Xác nhận" onClick={() => onAcknowledge(item)}><BadgeCheck size={15} /></button>
            ) : null}
            {!item.derived ? (
              <button type="button" title="Đóng cảnh báo" aria-label="Đóng cảnh báo" onClick={() => onResolve(item)}><CheckCircle2 size={15} /></button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function FefoPreviewDrawer({ preview, onClose }) {
  if (!preview) return null;
  return (
    <aside className="pharmacy-command-drawer is-wide">
      <header>
        <div>
          <span>FEFO allocation</span>
          <h3>Kế hoạch hoàn tất cấp phát</h3>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="pharmacy-command-drawer__body">
        <div className={`pharmacy-command-plan-status ${preview.can_complete ? 'is-success' : 'is-danger'}`}>
          {preview.can_complete ? 'Có thể hoàn tất cấp phát' : 'Không đủ điều kiện hoàn tất'}
        </div>
        {(preview.allocations || []).map((allocation) => (
          <section key={allocation.prescription_item_id} className="pharmacy-fefo-block">
            <h4>{allocation.medication_name}</h4>
            <span>Cần cấp {formatNumber(allocation.requested_quantity)} {allocation.unit || ''}</span>
            <table className="pharmacy-command-table is-compact">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Lot</th>
                  <th>Hạn dùng</th>
                  <th>Vị trí</th>
                  <th>Số lượng</th>
                  <th>Tồn sau</th>
                </tr>
              </thead>
              <tbody>
                {(allocation.batches || []).map((batch) => (
                  <tr key={batch.stock_batch_id}>
                    <td>{batch.batch_no || '--'}</td>
                    <td>{batch.lot_no || '--'}</td>
                    <td>{formatDateOnly(batch.expiry_date)}</td>
                    <td>{batch.storage_location || '--'}</td>
                    <td>{formatNumber(batch.quantity)}</td>
                    <td>{formatNumber(batch.quantity_on_hand_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <footer className="pharmacy-command-charge-preview">
          <span>Charge preview</span>
          <strong>{formatCurrency(preview.charge_preview?.total_amount || 0)}</strong>
        </footer>
      </div>
    </aside>
  );
}

export function PharmacyDashboardPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ range: 'today', date: '', storageLocation: '', supplier: '' });
  const { loading, data, error, refresh } = useCommandData(() => loadPharmacyCommandDashboard(filters), [
    filters.range,
    filters.date,
    filters.storageLocation,
    filters.supplier,
  ]);
  const cards = data?.cards || {};
  const charts = data?.charts || {};
  const metrics = [
    { label: 'Chờ duyệt dược', value: formatNumber(cards.pending_verification), hint: 'draft + active', icon: ClipboardCheck, tone: 'warning', to: '/pharmacy/overview/action-items' },
    { label: 'Cần kiểm tra', value: formatNumber(cards.needs_review), hint: 'dị ứng / tương tác / trùng thuốc', icon: ShieldAlert, tone: 'danger', to: '/pharmacy/overview/action-items' },
    { label: 'Đã duyệt chờ cấp', value: formatNumber(cards.verified_waiting_dispense), hint: 'có thể tạo phiếu', icon: BadgeCheck, tone: 'info', to: '/pharmacy/overview/today-dispensing' },
    { label: 'Cấp phát một phần', value: formatNumber(cards.partially_dispensed), hint: 'còn thuốc phải cấp', icon: Layers3, tone: 'purple', to: '/pharmacy/overview/today-dispensing' },
    { label: 'Đã cấp hôm nay', value: formatNumber(cards.dispensed_today), hint: `${formatNumber(cards.returned_today)} hoàn trả`, icon: PackageCheck, tone: 'success', to: '/pharmacy/overview/today-dispensing' },
    { label: 'Dưới tồn tối thiểu', value: formatNumber(cards.low_stock_items), hint: 'cần nhập / chuyển kho', icon: AlertTriangle, tone: 'warning', to: '/pharmacy/overview/alerts' },
    { label: 'Lô sắp hết hạn', value: formatNumber(cards.near_expiry_batches), hint: `${formatNumber(cards.expired_batches)} đã hết hạn`, icon: TimerOff, tone: 'danger', to: '/pharmacy/overview/alerts' },
    { label: 'Giá trị tồn kho', value: formatCurrency(cards.inventory_value), hint: 'theo unit_cost', icon: WalletCards, tone: 'neutral', to: '/pharmacy/overview/performance' },
  ];

  return (
    <div className="pharmacy-command-page">
      <CommandHeader
        eyebrow="Nhà thuốc & Kho dược / Tổng quan nhà thuốc"
        title="Dashboard nhà thuốc"
        description="Command Center tổng hợp đơn thuốc, cấp phát, tồn kho, cảnh báo và hiệu suất trong ngày."
        filters={filters}
        setFilters={setFilters}
        onRefresh={refresh}
      />
      <AlertStrip summary={data?.alert_summary} cards={cards} />
      <ErrorState error={error} onRetry={refresh} />
      <section className="pharmacy-command-metric-grid">
        {metrics.map((item) => (
          <MetricCard key={item.label} {...item} value={loading ? '--' : item.value} onClick={() => navigate(item.to)} />
        ))}
      </section>
      <section className="pharmacy-command-layout">
        <div className="pharmacy-command-layout__main">
          <Panel eyebrow="Work queue" title="Việc cần xử lý ưu tiên" icon={ClipboardCheck}>
            {loading ? <EmptyState title="Đang tải work queue" body="Đang tổng hợp từ prescription, dispense và stock batch." /> : null}
            {!loading && (data?.work_queue_preview || []).length ? (
              <WorkQueueTable rows={data.work_queue_preview} onSelect={() => navigate('/pharmacy/overview/action-items')} onAssign={() => {}} onResolve={() => {}} />
            ) : null}
            {!loading && !(data?.work_queue_preview || []).length ? <EmptyState title="Không có việc mở" body="Các luồng nhà thuốc đang ổn định." /> : null}
          </Panel>
          <div className="pharmacy-command-chart-grid">
            <Panel eyebrow="Funnel" title="Luồng đơn thuốc" icon={BarChart3}>
              <FunnelChart rows={charts.prescription_funnel || []} />
            </Panel>
            <Panel eyebrow="Theo giờ" title="Cấp phát hôm nay" icon={Activity}>
              <MiniBars rows={charts.dispense_by_hour || []} />
            </Panel>
          </div>
        </div>
        <aside className="pharmacy-command-layout__side">
          <Panel eyebrow="Realtime" title="Cảnh báo ưu tiên" icon={Bell}>
            <AlertList alerts={data?.alerts_preview || []} onSelect={() => navigate('/pharmacy/overview/alerts')} onAcknowledge={() => {}} onResolve={() => {}} />
          </Panel>
          <QuickActions />
        </aside>
      </section>
    </div>
  );
}

export function PharmacyWorkItemsPage() {
  const [filters, setFilters] = useState({ range: 'today', date: '', storageLocation: '', supplier: '', type: '', priority: '', search: '' });
  const [drawer, setDrawer] = useState(null);
  const { loading, data, error, refresh } = useCommandData(() => loadPharmacyWorkQueue(filters), [
    filters.type,
    filters.priority,
    filters.status,
    filters.search,
  ]);
  const summary = data?.summary || {};

  async function handleAssign(row) {
    try {
      await assignPharmacyWorkItem(row.id || row._id, {});
      refresh();
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Gán việc dược', message: getApiErrorMessage(error, 'Không thể gán việc.') });
    }
  }

  async function handleResolve(row) {
    try {
      await resolvePharmacyWorkItem(row.id || row._id, { note: 'Hoàn tất từ task center.' });
      refresh();
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Xử lý việc dược', message: getApiErrorMessage(error, 'Không thể xử lý việc.') });
    }
  }

  return (
    <div className="pharmacy-command-page">
      <CommandHeader
        eyebrow="Nhà thuốc & Kho dược / Tổng quan nhà thuốc"
        title="Việc cần xử lý"
        description="Task Center gom đơn cần duyệt, cảnh báo lâm sàng, thiếu tồn, lô rủi ro và hoàn trả."
        filters={filters}
        setFilters={setFilters}
        onRefresh={refresh}
      >
        <label>
          <Filter size={15} />
          <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
            <option value="">Loại việc</option>
            {Object.entries(WORK_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          <Gauge size={15} />
          <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
            <option value="">Ưu tiên</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          <Search size={15} />
          <input value={filters.search} placeholder="Tìm việc" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        </label>
      </CommandHeader>
      <section className="pharmacy-command-metric-grid is-compact">
        <MetricCard icon={ClipboardCheck} label="Tổng việc mở" value={formatNumber(summary.total_open)} hint="đang chờ xử lý" tone="info" />
        <MetricCard icon={AlertTriangle} label="Critical" value={formatNumber(summary.critical)} hint="xử lý ngay" tone="danger" />
        <MetricCard icon={Timer} label="Quá SLA" value={formatNumber(summary.overdue)} hint="cần ưu tiên" tone="warning" />
        <MetricCard icon={UserCheck} label="Chưa gán" value={formatNumber(summary.unassigned)} hint="cần điều phối" tone="neutral" />
      </section>
      <Panel eyebrow="Task center" title="Bảng việc cần xử lý" icon={ClipboardCheck}>
        <ErrorState error={error} onRetry={refresh} />
        {loading ? <EmptyState title="Đang tải việc" body="Đang gom từ đơn thuốc, cấp phát và kho." /> : null}
        {!loading && (data?.items || []).length ? (
          <WorkQueueTable rows={data.items} onSelect={setDrawer} onAssign={handleAssign} onResolve={handleResolve} />
        ) : null}
      </Panel>
      <WorkItemDrawer item={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function DispenseCard({ item, onPreview, onComplete, onPrint }) {
  return (
    <article className="pharmacy-dispense-card">
      <header>
        <strong>{item.reference_no || item.prescription_no || '--'}</strong>
        <StatusBadge value={item.status} label={item.status} />
      </header>
      <span>{item.patient_name || '--'}</span>
      <small>{item.prescription_no || `${formatNumber(item.item_count || 0)} thuốc`} · chờ {formatNumber(item.wait_minutes || 0)} phút</small>
      <footer>
        <button type="button" title="Preview FEFO" aria-label="Preview FEFO" onClick={() => onPreview(item)}><Layers3 size={15} /></button>
        {item.type === 'dispense' && ['draft', 'partially_dispensed'].includes(String(item.status || '').toLowerCase()) ? (
          <button type="button" title="Hoàn tất" aria-label="Hoàn tất" onClick={() => onComplete(item)}><CheckCircle2 size={15} /></button>
        ) : null}
        <button type="button" title="In nhãn" aria-label="In nhãn" onClick={() => onPrint(item)}><Printer size={15} /></button>
      </footer>
    </article>
  );
}

export function PharmacyDispensingTodayPage() {
  const [filters, setFilters] = useState({ range: 'today', date: '', storageLocation: '', supplier: '' });
  const [preview, setPreview] = useState(null);
  const { loading, data, error, refresh } = useCommandData(() => loadPharmacyDispensingToday(filters), [
    filters.range,
    filters.date,
  ]);
  const summary = data?.summary || {};

  async function handlePreview(item) {
    if (!item.dispense_id) return;
    try {
      const response = await previewDispenseCompletionPlanFromOverview(item.dispense_id, {});
      setPreview(unwrapData(response));
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Preview FEFO', message: getApiErrorMessage(error, 'Không thể preview FEFO.') });
    }
  }

  async function handleComplete(item) {
    if (!item.dispense_id || !confirmPharmacyAction({ title: 'Hoàn tất cấp phát', message: `Hoàn tất phiếu ${item.reference_no || item.dispense_id}?` })) return;
    try {
      await completeDispenseFromOverview(item.dispense_id, { note: 'Hoàn tất từ Cấp phát hôm nay.' });
      notifyPharmacy({ tone: 'success', title: 'Hoàn tất cấp phát', message: 'Đã hoàn tất phiếu cấp phát.' });
      refresh();
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Hoàn tất cấp phát', message: getApiErrorMessage(error, 'Không thể hoàn tất cấp phát.') });
    }
  }

  async function handlePrint(item) {
    if (!item.dispense_id) {
      notifyPharmacy({ tone: 'warning', title: 'In nhãn', message: 'Cần dispense_id hợp lệ để tạo print job.' });
      return;
    }
    try {
      await pharmacyTopbarApi.printLabels(item.dispense_id, { copy_count: 1 });
      notifyPharmacy({ tone: 'success', title: 'In nhãn', message: 'Đã tạo print job nhãn thuốc.' });
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'In nhãn', message: getApiErrorMessage(error, 'Không thể tạo print job nhãn.') });
    }
  }

  return (
    <div className="pharmacy-command-page">
      <CommandHeader
        eyebrow="Nhà thuốc & Kho dược / Tổng quan nhà thuốc"
        title="Cấp phát hôm nay"
        description="Dispensing Board cho dược sĩ quầy: chờ cấp, đang chuẩn bị, FEFO, hoàn tất, return và hủy."
        filters={filters}
        setFilters={setFilters}
        onRefresh={refresh}
      />
      <section className="pharmacy-command-metric-grid is-compact">
        <MetricCard icon={Clock3} label="Chờ tạo phiếu" value={formatNumber(summary.waiting)} hint="prescription verified" tone="info" />
        <MetricCard icon={PackageCheck} label="Đang chuẩn bị" value={formatNumber(summary.preparing)} hint="dispense draft" tone="warning" />
        <MetricCard icon={Layers3} label="Cấp một phần" value={formatNumber(summary.partially_dispensed)} hint="còn phải cấp" tone="purple" />
        <MetricCard icon={CheckCircle2} label="Đã cấp" value={formatNumber(summary.dispensed)} hint={`${formatNumber(summary.average_minutes)} phút TB`} tone="success" />
        <MetricCard icon={Ban} label="Hoàn trả / hủy" value={formatNumber((summary.returned || 0) + (summary.cancelled || 0))} hint="cần rà charge/tồn" tone="danger" />
      </section>
      <ErrorState error={error} onRetry={refresh} />
      <section className="pharmacy-dispense-board">
        {DISPENSE_COLUMN_META.map((column) => (
          <div key={column.key} className={`pharmacy-dispense-column is-${column.tone}`}>
            <header>
              <strong>{column.label}</strong>
              <span>{formatNumber(data?.columns?.[column.key]?.length || 0)}</span>
            </header>
            {loading ? <EmptyState title="Đang tải" body="Đang tải phiếu cấp phát." /> : null}
            {!loading && (data?.columns?.[column.key] || []).map((item) => (
              <DispenseCard key={item.id} item={item} onPreview={handlePreview} onComplete={handleComplete} onPrint={handlePrint} />
            ))}
          </div>
        ))}
      </section>
      <FefoPreviewDrawer preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

export function PharmacyAlertsPage() {
  const [filters, setFilters] = useState({ range: 'today', date: '', storageLocation: '', supplier: '', alertType: '', severity: '', search: '' });
  const [drawer, setDrawer] = useState(null);
  const { loading, data, error, refresh } = useCommandData(() => loadPharmacyAlerts(filters), [
    filters.alertType,
    filters.severity,
    filters.search,
  ]);
  const summary = data?.summary || {};

  async function handleAcknowledge(item) {
    try {
      await acknowledgePharmacyAlert(item.id || item._id, { note: 'Đã xác nhận từ Alert Center.' });
      refresh();
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Xác nhận cảnh báo', message: getApiErrorMessage(error, 'Không thể xác nhận cảnh báo.') });
    }
  }

  async function handleResolve(item) {
    try {
      await resolvePharmacyAlert(item.id || item._id, { resolution_note: 'Đã xử lý từ Alert Center.' });
      refresh();
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Đóng cảnh báo', message: getApiErrorMessage(error, 'Không thể đóng cảnh báo.') });
    }
  }

  return (
    <div className="pharmacy-command-page">
      <CommandHeader
        eyebrow="Nhà thuốc & Kho dược / Tổng quan nhà thuốc"
        title="Cảnh báo dược"
        description="Risk radar realtime cho tồn kho, hạn dùng, cấp phát, lâm sàng và vận hành."
        filters={filters}
        setFilters={setFilters}
        onRefresh={refresh}
      >
        <label>
          <Bell size={15} />
          <select value={filters.alertType} onChange={(event) => setFilters((current) => ({ ...current, alertType: event.target.value }))}>
            <option value="">Loại cảnh báo</option>
            {Object.entries(ALERT_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          <Gauge size={15} />
          <select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
            <option value="">Mức cảnh báo</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          <Search size={15} />
          <input value={filters.search} placeholder="Tìm cảnh báo" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        </label>
      </CommandHeader>
      <section className="pharmacy-command-metric-grid is-compact">
        <MetricCard icon={ShieldAlert} label="Tổng cảnh báo mở" value={formatNumber(summary.total_open)} hint="open + assigned" tone="info" />
        <MetricCard icon={AlertTriangle} label="Critical" value={formatNumber(summary.critical)} hint="xử lý ngay" tone="danger" />
        <MetricCard icon={Bell} label="High" value={formatNumber(summary.high)} hint="theo dõi sát" tone="warning" />
        <MetricCard icon={CheckCircle2} label="Đã xử lý hôm nay" value={formatNumber(summary.resolved_today)} hint="resolved" tone="success" />
      </section>
      <Panel eyebrow="Alert center" title="Danh sách cảnh báo" icon={ShieldAlert}>
        <ErrorState error={error} onRetry={refresh} />
        {loading ? <EmptyState title="Đang tải cảnh báo" body="Đang đọc lifecycle và cảnh báo phát sinh từ kho." /> : null}
        {!loading && (data?.items || []).length ? (
          <AlertList alerts={data.items} onSelect={setDrawer} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
        ) : null}
      </Panel>
      <WorkItemDrawer item={drawer ? {
        ...drawer,
        type: drawer.alert_type,
        reference_no: drawer.alert_code || drawer.metadata?.batch_no,
        priority: drawer.severity,
        source_label: ALERT_TYPE_LABELS[drawer.alert_type],
        description: drawer.message,
      } : null} onClose={() => setDrawer(null)} />
    </div>
  );
}

export function PharmacyPerformancePage() {
  const [filters, setFilters] = useState({ range: 'today', date: '', storageLocation: '', supplier: '' });
  const { loading, data, error, refresh } = useCommandData(() => loadPharmacyPerformance(filters), [
    filters.range,
    filters.date,
    filters.storageLocation,
    filters.supplier,
  ]);
  const summary = data?.summary || {};

  return (
    <div className="pharmacy-command-page">
      <CommandHeader
        eyebrow="Nhà thuốc & Kho dược / Tổng quan nhà thuốc"
        title="Hiệu suất nhà thuốc"
        description="Performance Analytics cho SLA, dược sĩ, cấp phát, top thuốc, rủi ro tồn và giá trị kho."
        filters={filters}
        setFilters={setFilters}
        onRefresh={refresh}
      />
      <ErrorState error={error} onRetry={refresh} />
      <section className="pharmacy-command-metric-grid is-compact">
        <MetricCard icon={ClipboardCheck} label="Đơn đã duyệt" value={formatNumber(summary.prescriptions_verified)} hint={`${formatNumber(summary.average_verify_minutes)} phút duyệt TB`} tone="info" />
        <MetricCard icon={PackageCheck} label="Phiếu cấp phát" value={formatNumber(summary.dispenses_completed)} hint={`${formatNumber(summary.average_dispense_minutes)} phút cấp TB`} tone="success" />
        <MetricCard icon={Gauge} label="SLA cấp phát" value={`${formatNumber(summary.dispense_sla_rate)}%`} hint="trong 30 phút" tone="warning" />
        <MetricCard icon={WalletCards} label="Giá trị tồn kho" value={formatCurrency(summary.inventory_value)} hint="theo tồn hiện tại" tone="neutral" />
        <MetricCard icon={TimerOff} label="Lô sắp hết hạn" value={formatNumber(summary.near_expiry_batches)} hint="rủi ro tồn kho" tone="danger" />
      </section>
      <section className="pharmacy-command-layout">
        <div className="pharmacy-command-layout__main">
          <div className="pharmacy-command-chart-grid">
            <Panel eyebrow="Theo giờ" title="Cấp phát theo giờ" icon={Activity}>
              <MiniBars rows={data?.by_hour || []} />
            </Panel>
            <Panel eyebrow="Top thuốc" title="Top thuốc cấp nhiều" icon={Pill}>
              <FunnelChart rows={(data?.top_medications || []).map((item) => ({ label: item.medication_name, value: item.quantity }))} />
            </Panel>
          </div>
          <Panel eyebrow="Staff" title="Hiệu suất từng dược sĩ" icon={UserCheck}>
            <div className="pharmacy-command-table-scroll">
              <table className="pharmacy-command-table">
                <thead>
                  <tr>
                    <th>Dược sĩ</th>
                    <th>Phiếu đã cấp</th>
                    <th>Thời gian cấp TB</th>
                    <th>Return</th>
                    <th>Cancel</th>
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.by_staff || []).map((row) => (
                    <tr key={row.staff_id || row.staff_name}>
                      <td><strong>{row.staff_name}</strong></td>
                      <td>{formatNumber(row.dispenses_completed)}</td>
                      <td>{formatNumber(row.average_dispense_minutes)} phút</td>
                      <td>{formatNumber(row.returns)}</td>
                      <td>{formatNumber(row.cancels)}</td>
                      <td>{formatNumber(row.sla_rate)}%</td>
                    </tr>
                  ))}
                  {!loading && !(data?.by_staff || []).length ? (
                    <tr><td colSpan={6}>Chưa có dữ liệu hiệu suất trong bộ lọc này.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <aside className="pharmacy-command-layout__side">
          <Panel eyebrow="Stock risk" title="Rủi ro tồn kho" icon={Boxes}>
            <FunnelChart rows={[
              { label: 'Dưới ngưỡng', value: data?.stock_risk?.low_stock_items || 0 },
              { label: 'Hết tồn', value: data?.stock_risk?.out_of_stock_items || 0 },
              { label: 'Sắp hết hạn', value: data?.stock_risk?.near_expiry_batches || 0 },
              { label: 'Đã hết hạn', value: data?.stock_risk?.expired_batches || 0 },
              { label: 'Recall/cách ly', value: (data?.stock_risk?.recalled_batches || 0) + (data?.stock_risk?.quarantined_batches || 0) },
            ]} />
          </Panel>
          <QuickActions />
        </aside>
      </section>
    </div>
  );
}
