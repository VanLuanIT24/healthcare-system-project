import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  Layers3,
  PackageCheck,
  PackagePlus,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TimerOff,
  Trash2,
  X,
} from 'lucide-react';
import { getApiErrorMessage, unwrapData } from '../utils/api';
import { confirmPharmacyAction, downloadPharmacyJson, notifyPharmacy } from './pharmacyActions';
import {
  adjustBatchFromConsole,
  createStocktakeFromConsole,
  expireBatchFromConsole,
  generateStocktakeItemsFromConsole,
  loadCurrentStock,
  loadMedicationCatalog,
  loadMedicationDetail,
  loadStockBatchConsole,
  loadStockBatchDetail,
  loadStocktakeDetail,
  loadStocktakes,
  postStocktakeAdjustmentsFromConsole,
  quarantineBatchFromConsole,
  recallBatchFromConsole,
  receiveInventoryFromConsole,
  releaseQuarantineFromConsole,
  reviewStocktakeFromConsole,
  startStocktakeFromConsole,
  transferBatchLocationFromConsole,
  wasteBatchFromConsole,
} from './pharmacyApi';

const BATCH_VIEW_CONFIG = {
  all: {
    title: 'Lô thuốc',
    description: 'Theo dõi batch, hạn dùng, tồn thực tế, vị trí, supplier và ledger nhập xuất.',
    icon: PackageCheck,
    params: {},
  },
  valid: {
    title: 'Lô còn hạn',
    description: 'Danh sách lô khả dụng, còn tồn và ưu tiên cấp phát theo FEFO.',
    icon: BadgeCheck,
    params: { valid: true, hasStock: true },
  },
  nearExpiry: {
    title: 'Lô sắp hết hạn',
    description: 'Risk bucket hạn dùng, giá trị tồn nguy cơ và gợi ý xử lý trước hao hụt.',
    icon: TimerOff,
    params: { nearExpiry: true, nearExpiryDays: 60, hasStock: true },
  },
  expired: {
    title: 'Lô đã hết hạn',
    description: 'Kiểm soát batch expired, transaction expire, lý do và biên bản xử lý.',
    icon: AlertTriangle,
    params: { expired: true },
  },
  depleted: {
    title: 'Lô hết tồn',
    description: 'Truy vết batch đã về 0, tốc độ tiêu thụ và nguồn giao dịch cuối.',
    icon: Ban,
    params: { depleted: true },
  },
  quarantine: {
    title: 'Cách ly / thu hồi',
    description: 'Batch đang cách ly, recalled và impact cần xử lý theo quy trình an toàn thuốc.',
    icon: ShieldAlert,
    params: {},
  },
};

const STOCK_STATUS_META = {
  normal: { label: 'Đủ tồn', tone: 'success' },
  watch: { label: 'Theo dõi', tone: 'warning' },
  low: { label: 'Tồn thấp', tone: 'danger' },
  out: { label: 'Hết khả dụng', tone: 'danger' },
  risk: { label: 'Rủi ro', tone: 'purple' },
};

const BATCH_STATUS_META = {
  available: { label: 'Available', tone: 'success' },
  quarantined: { label: 'Quarantine', tone: 'warning' },
  expired: { label: 'Expired', tone: 'danger' },
  recalled: { label: 'Recalled', tone: 'danger' },
  depleted: { label: 'Depleted', tone: 'muted' },
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'muted' },
  discontinued: { label: 'Discontinued', tone: 'muted' },
};

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

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntil(value) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function medicineName(medication = {}) {
  if (!medication) return 'Thuốc';
  return [medication.brand_name || medication.generic_name, medication.strength].filter(Boolean).join(' ') ||
    medication.medication_code ||
    'Thuốc';
}

function getBatchMedication(batch = {}) {
  return batch.medication_id && typeof batch.medication_id === 'object' ? batch.medication_id : batch.medication || {};
}

function getBatchId(batch = {}) {
  return batch._id || batch.id || batch.stock_batch_id || batch.batch_id;
}

function getMedicationId(medication = {}) {
  return medication._id || medication.id || medication.medication_id;
}

function useInventoryLoader(loader, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await loader();
      setState({ loading: false, data, error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: getApiErrorMessage(error, 'Không thể tải dữ liệu kho thuốc.') });
    }
  }

  useEffect(() => {
    refresh();
  }, deps);

  return { ...state, refresh };
}

function StatusBadge({ value, fallback }) {
  const meta = BATCH_STATUS_META[value] || STOCK_STATUS_META[value] || { label: fallback || value || '--', tone: 'muted' };
  return <span className={`pharmacy-inventory-badge is-${meta.tone}`}>{meta.label}</span>;
}

function RiskBadge({ expiryDate, status }) {
  if (['expired', 'recalled'].includes(String(status || '').toLowerCase())) {
    return <StatusBadge value={status} />;
  }
  const days = daysUntil(expiryDate);
  if (days === null) return <span className="pharmacy-inventory-badge is-muted">Không HSD</span>;
  if (days < 0) return <span className="pharmacy-inventory-badge is-danger">Quá hạn {Math.abs(days)} ngày</span>;
  if (days <= 7) return <span className="pharmacy-inventory-badge is-danger">{days} ngày</span>;
  if (days <= 30) return <span className="pharmacy-inventory-badge is-warning">{days} ngày</span>;
  if (days <= 60) return <span className="pharmacy-inventory-badge is-info">{days} ngày</span>;
  return <span className="pharmacy-inventory-badge is-success">{days} ngày</span>;
}

function InventoryHeader({ icon: Icon, title, description, realtime = 'đang đồng bộ', onRefresh, onCommand, onExport, actionLabel, onAction }) {
  const handleMissingAction = () => notifyPharmacy({
    tone: 'warning',
    title: actionLabel || 'Thao tác kho dược',
    message: 'Thao tác này cần thêm dữ liệu hoặc quyền nghiệp vụ trước khi gửi lên hệ thống.',
  });

  return (
    <header className="pharmacy-inventory-header">
      <div className="pharmacy-inventory-header__title">
        <span className="pharmacy-inventory-header__crumb">Nhà thuốc & Kho dược / Kho thuốc</span>
        <div>
          <span className="pharmacy-inventory-header__mark" aria-hidden="true"><Icon size={24} /></span>
          <h1>{title}</h1>
        </div>
        <p>{description}</p>
      </div>
      <div className="pharmacy-inventory-header__actions">
        <span className="pharmacy-inventory-sync"><CheckCircle2 size={15} /> Realtime: {realtime}</span>
        <button type="button" className="pharmacy-inventory-icon-button" aria-label="Refresh" onClick={onRefresh}>
          <RefreshCw size={18} />
        </button>
        {onCommand ? (
          <button type="button" className="pharmacy-inventory-button is-secondary" onClick={onCommand}>
            <Search size={16} /> Ctrl K
          </button>
        ) : null}
        <button type="button" className="pharmacy-inventory-button is-secondary" onClick={onExport}>
          <Download size={16} /> Export
        </button>
        {actionLabel ? (
          <button type="button" className="pharmacy-inventory-button" onClick={onAction || handleMissingAction}>
            <PackagePlus size={16} /> {actionLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function KpiStrip({ cards = [] }) {
  return (
    <section className="pharmacy-inventory-kpis">
      {cards.map((card) => {
        const Icon = card.icon || Boxes;
        return (
          <article key={card.key} className={`pharmacy-inventory-kpi is-${card.tone || 'neutral'}`}>
            <span><Icon size={18} /></span>
            <div>
              <small>{card.label}</small>
              <strong>{card.value}</strong>
              {card.hint ? <em>{card.hint}</em> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function InventoryFilters({ filters, setFilters, children }) {
  return (
    <section className="pharmacy-inventory-filters">
      <label className="pharmacy-inventory-search">
        <Search size={16} />
        <input
          value={filters.search || ''}
          placeholder="Tìm thuốc, batch, lot, vị trí"
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
        />
      </label>
      {children}
      <button
        type="button"
        className="pharmacy-inventory-button is-secondary"
        onClick={() => setFilters((current) => ({ ...current, search: '', status: '', stockStatus: '', storageLocation: '', supplier: '', page: 1 }))}
      >
        <Filter size={16} /> Reset
      </button>
    </section>
  );
}

function LoadingState({ text = 'Đang tải dữ liệu kho thuốc' }) {
  return (
    <div className="pharmacy-inventory-state">
      <RefreshCw size={20} className="is-spinning" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ text = 'Không có dữ liệu phù hợp' }) {
  return (
    <div className="pharmacy-inventory-state">
      <FileText size={20} />
      <span>{text}</span>
    </div>
  );
}

function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="pharmacy-inventory-error">
      <AlertTriangle size={17} />
      <span>{error}</span>
    </div>
  );
}

function CommandPalette({ open, onClose, onSelect }) {
  const actions = [
    { key: 'receive', label: 'Nhập kho', icon: PackagePlus },
    { key: 'adjust', label: 'Điều chỉnh tồn', icon: SlidersHorizontal },
    { key: 'recall', label: 'Recall batch', icon: ShieldAlert },
    { key: 'expire', label: 'Mark expired', icon: TimerOff },
    { key: 'stocktake', label: 'Tạo kỳ kiểm kê', icon: ClipboardCheck },
  ];

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onSelect('open');
      }
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, onSelect]);

  if (!open) return null;
  return (
    <div className="pharmacy-inventory-modal" role="dialog" aria-modal="true">
      <div className="pharmacy-inventory-command">
        <header>
          <Search size={18} />
          <strong>Command palette</strong>
          <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </header>
        <div>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.key} type="button" onClick={() => onSelect(action.key)}>
                <Icon size={17} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function runInventoryCommand(command, navigate, onClose) {
  if (command === 'open') return;
  const routes = {
    receive: '/pharmacy/transactions/receive-stock',
    adjust: '/pharmacy/transactions/stock-adjustment',
    recall: '/pharmacy/inventory/quarantine-recall',
    expire: '/pharmacy/inventory/expired-batches',
    stocktake: '/pharmacy/inventory/stock-count',
  };
  const labels = {
    receive: 'Nhập kho',
    adjust: 'Điều chỉnh tồn',
    recall: 'Recall batch',
    expire: 'Lô hết hạn',
    stocktake: 'Kiểm kê',
  };
  const target = routes[command];
  onClose?.();
  if (!target) {
    notifyPharmacy({ tone: 'warning', title: 'Command palette', message: 'Chưa nhận diện được thao tác kho dược.' });
    return;
  }
  notifyPharmacy({ title: 'Command palette', message: `Đã mở ${labels[command] || 'nghiệp vụ kho dược'}.` });
  navigate(target);
}

function DetailDrawer({ title, subtitle, open, onClose, tabs = [] }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'overview');

  useEffect(() => {
    setActiveTab(tabs[0]?.key || 'overview');
  }, [open, tabs[0]?.key]);

  if (!open) return null;
  const active = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  return (
    <aside className="pharmacy-inventory-drawer">
      <header>
        <div>
          <span>Chi tiết</span>
          <strong>{title}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
        <button type="button" aria-label="Đóng drawer" onClick={onClose}><X size={18} /></button>
      </header>
      <nav>
        {tabs.map((tab) => (
          <button key={tab.key} type="button" className={tab.key === activeTab ? 'is-active' : ''} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </nav>
      <section>{active?.content}</section>
    </aside>
  );
}

function KeyValueGrid({ items = [] }) {
  return (
    <dl className="pharmacy-inventory-keygrid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? '--'}</dd>
        </div>
      ))}
    </dl>
  );
}

function MiniTimeline({ items = [] }) {
  if (!items.length) return <EmptyState text="Chưa có giao dịch liên quan" />;
  return (
    <div className="pharmacy-inventory-timeline">
      {items.map((item) => (
        <article key={item._id || item.id || item.transaction_no}>
          <span />
          <div>
            <strong>{item.transaction_no || item.transaction_type}</strong>
            <small>{item.transaction_type} · {item.direction} · {formatDate(item.occurred_at)}</small>
            <p>{formatNumber(item.quantity)} | balance {formatNumber(item.balance_after)} | {item.note || '--'}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function BatchActionDialog({ action, batch, onClose, onDone }) {
  const [form, setForm] = useState({
    quantity: action === 'transfer' || action === 'waste' ? 1 : '',
    direction: 'out',
    reason: '',
    to_location: '',
    force: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!action || !batch) return null;
  const actionTitle = {
    receive: 'Nhập kho',
    adjust: 'Điều chỉnh tồn',
    expire: 'Mark expired',
    recall: 'Recall batch',
    quarantine: 'Cách ly batch',
    release: 'Gỡ cách ly',
    waste: 'Hủy / hao hụt',
    transfer: 'Chuyển vị trí',
  }[action] || 'Thao tác batch';

  async function submit(event) {
    event.preventDefault();
    if (['expire', 'recall', 'quarantine', 'release', 'waste'].includes(action)) {
      const ok = confirmPharmacyAction({
        title: actionTitle,
        message: `Xác nhận thao tác với batch ${batch.batch_no || batch.lot_no || getBatchId(batch)}?`,
      });
      if (!ok) return;
    }
    setSaving(true);
    setError('');
    try {
      if (action === 'receive') {
        await receiveInventoryFromConsole({
          medication_id: getBatchMedication(batch)?._id || batch.medication_id,
          batch_no: batch.batch_no,
          quantity: Number(form.quantity),
          reason: form.reason,
          unit_cost: batch.unit_cost,
          storage_location: batch.storage_location,
        });
      }
      if (action === 'adjust') {
        await adjustBatchFromConsole(getBatchId(batch), {
          direction: form.direction,
          adjustment_quantity: Number(form.quantity),
          reason: form.reason,
        });
      }
      if (action === 'expire') await expireBatchFromConsole(getBatchId(batch), { reason: form.reason, force: form.force });
      if (action === 'recall') await recallBatchFromConsole(getBatchId(batch), { reason: form.reason });
      if (action === 'quarantine') await quarantineBatchFromConsole(getBatchId(batch), { reason: form.reason });
      if (action === 'release') await releaseQuarantineFromConsole(getBatchId(batch), { reason: form.reason });
      if (action === 'waste') await wasteBatchFromConsole(getBatchId(batch), { quantity: Number(form.quantity), reason: form.reason });
      if (action === 'transfer') await transferBatchLocationFromConsole(getBatchId(batch), {
        quantity: Number(form.quantity),
        from_location: batch.storage_location,
        to_location: form.to_location,
        reason: form.reason,
      });
      notifyPharmacy({ tone: 'success', title: actionTitle, message: 'Đã cập nhật batch thuốc trên backend.' });
      onDone();
    } catch (err) {
      const message = getApiErrorMessage(err, 'Không thể thực hiện thao tác batch.');
      setError(message);
      notifyPharmacy({ tone: 'danger', title: actionTitle, message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pharmacy-inventory-modal" role="dialog" aria-modal="true">
      <form className="pharmacy-inventory-action-dialog" onSubmit={submit}>
        <header>
          <div>
            <span>{batch.batch_no || batch.lot_no}</span>
            <strong>{actionTitle}</strong>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </header>
        <ErrorBanner error={error} />
        {['receive', 'adjust', 'waste', 'transfer'].includes(action) ? (
          <label>
            <span>Số lượng</span>
            <input type="number" min="0" step="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
          </label>
        ) : null}
        {action === 'adjust' ? (
          <label>
            <span>Direction</span>
            <select value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}>
              <option value="out">Xuất giảm</option>
              <option value="in">Nhập tăng</option>
            </select>
          </label>
        ) : null}
        {action === 'transfer' ? (
          <label>
            <span>Vị trí mới</span>
            <input value={form.to_location} onChange={(event) => setForm((current) => ({ ...current, to_location: event.target.value }))} required />
          </label>
        ) : null}
        {action === 'expire' ? (
          <label className="pharmacy-inventory-checkbox">
            <input type="checkbox" checked={form.force} onChange={(event) => setForm((current) => ({ ...current, force: event.target.checked }))} />
            <span>Force nếu batch chưa tới HSD</span>
          </label>
        ) : null}
        <label>
          <span>Lý do</span>
          <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
        </label>
        <footer>
          <button type="button" className="pharmacy-inventory-button is-secondary" onClick={onClose}>Hủy</button>
          <button type="submit" className="pharmacy-inventory-button" disabled={saving}>{saving ? 'Đang lưu' : 'Xác nhận'}</button>
        </footer>
      </form>
    </div>
  );
}

export function MedicationCatalogPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ page: 1, limit: 30 });
  const [commandOpen, setCommandOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailState, setDetailState] = useState({ loading: false, data: null });
  const { loading, data, error, refresh } = useInventoryLoader(() => loadMedicationCatalog(filters), [JSON.stringify(filters)]);
  const summary = data?.summary || {};

  async function openMedication(medication) {
    setSelected(medication);
    setDetailState({ loading: true, data: null });
    const detail = await loadMedicationDetail(getMedicationId(medication));
    setDetailState({ loading: false, data: detail });
  }

  const kpis = [
    { key: 'total', label: 'Tổng thuốc', value: formatNumber(summary.total_medications), icon: Pill },
    { key: 'active', label: 'Active', value: formatNumber(summary.active), icon: CheckCircle2, tone: 'success' },
    { key: 'missing-price', label: 'Chưa có giá', value: formatNumber(summary.missing_price), icon: FileText, tone: 'warning' },
    { key: 'missing-service', label: 'Chưa map viện phí', value: formatNumber(summary.missing_service), icon: Layers3, tone: 'warning' },
    { key: 'low', label: 'Dưới ngưỡng', value: formatNumber(summary.below_min_stock), icon: AlertTriangle, tone: 'danger' },
    { key: 'nostock', label: 'Không có lô khả dụng', value: formatNumber(summary.without_available_stock), icon: Ban, tone: 'danger' },
    { key: 'near', label: 'Lô sắp hết hạn', value: formatNumber(summary.near_expiry_batches), icon: TimerOff, tone: 'warning' },
  ];

  return (
    <section className="pharmacy-inventory-page">
      <InventoryHeader
        icon={Pill}
        title="Danh mục thuốc"
        description="Master thuốc, giá bán, viện phí, tồn tổng, trạng thái và lô liên quan."
        onRefresh={refresh}
        onCommand={() => setCommandOpen(true)}
        onExport={() => downloadPharmacyJson('danh-muc-thuoc.json', { filters, summary, medications: data?.medications || [] }, 'Xuất danh mục thuốc')}
        actionLabel="Tạo thuốc"
        onAction={() => {
          notifyPharmacy({
            title: 'Tạo thuốc',
            message: 'Mở cấu hình dược để chuẩn hóa đơn vị, dạng bào chế và route trước khi tạo thuốc mới.',
          });
          navigate('/pharmacy/config');
        }}
      />
      <KpiStrip cards={kpis} />
      <InventoryFilters filters={filters} setFilters={setFilters}>
        <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="recalled">Recalled</option>
          <option value="discontinued">Discontinued</option>
        </select>
        <button type="button" className={filters.belowMinStock ? 'is-active' : ''} onClick={() => setFilters((current) => ({ ...current, belowMinStock: !current.belowMinStock, page: 1 }))}>Dưới ngưỡng</button>
        <button type="button" className={filters.missingPrice ? 'is-active' : ''} onClick={() => setFilters((current) => ({ ...current, missingPrice: !current.missingPrice, page: 1 }))}>Thiếu giá</button>
        <button type="button" className={filters.hasNearExpiry ? 'is-active' : ''} onClick={() => setFilters((current) => ({ ...current, hasNearExpiry: !current.hasNearExpiry, page: 1 }))}>Sắp hết hạn</button>
      </InventoryFilters>
      <ErrorBanner error={error || data?.errors?.medications || data?.errors?.summary} />
      {loading ? <LoadingState /> : (
        <div className="pharmacy-inventory-table-wrap">
          <table className="pharmacy-inventory-table">
            <thead>
              <tr>
                <th>Mã thuốc</th>
                <th>Hoạt chất / biệt dược</th>
                <th>Hàm lượng</th>
                <th>Dạng / đường dùng</th>
                <th>Giá bán</th>
                <th>Tồn tổng</th>
                <th>Lô khả dụng</th>
                <th>Sắp hết hạn</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.medications || []).map((item) => (
                <tr key={getMedicationId(item)} onClick={() => openMedication(item)}>
                  <td><strong>{item.medication_code}</strong></td>
                  <td>
                    <strong>{item.generic_name}</strong>
                    <small>{item.brand_name || '--'}</small>
                  </td>
                  <td>{item.strength || '--'}<small>{item.unit || ''}</small></td>
                  <td>{item.dosage_form || '--'}<small>{item.route_default || '--'}</small></td>
                  <td>{item.sale_price ? formatCurrency(item.sale_price) : <span className="pharmacy-inventory-muted">Chưa có</span>}</td>
                  <td>{formatNumber(item.stock_summary?.total_on_hand)}</td>
                  <td>{formatNumber(item.stock_summary?.available_batches)}</td>
                  <td>{formatNumber(item.stock_summary?.near_expiry_batches)}</td>
                  <td><StatusBadge value={item.status} /></td>
                  <td>
                    <button
                      type="button"
                      className="pharmacy-inventory-icon-button"
                      aria-label="Xem chi tiết"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMedication(item);
                      }}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.medications?.length ? <EmptyState /> : null}
        </div>
      )}
      <DetailDrawer
        open={Boolean(selected)}
        title={selected ? medicineName(selected) : ''}
        subtitle={selected?.medication_code}
        onClose={() => setSelected(null)}
        tabs={[
          {
            key: 'overview',
            label: 'Tổng quan',
            content: detailState.loading ? <LoadingState /> : (
              <KeyValueGrid items={[
                { label: 'Mã thuốc', value: selected?.medication_code },
                { label: 'Hoạt chất', value: selected?.generic_name },
                { label: 'Biệt dược', value: selected?.brand_name },
                { label: 'Giá bán', value: selected?.sale_price ? formatCurrency(selected.sale_price) : 'Chưa có' },
                { label: 'Service viện phí', value: selected?.service_id || 'Chưa map' },
                { label: 'Tồn tổng', value: formatNumber(detailState.data?.detail?.stock_summary?.total_on_hand ?? selected?.stock_summary?.total_on_hand) },
                { label: 'Ngưỡng tồn', value: formatNumber(selected?.min_stock_level) },
                { label: 'Trạng thái', value: selected?.status },
              ]} />
            ),
          },
          {
            key: 'batches',
            label: 'Lô thuốc',
            content: <BatchMiniList batches={detailState.data?.batches || []} />,
          },
          {
            key: 'ledger',
            label: 'Ledger',
            content: <MiniTimeline items={detailState.data?.transactions || []} />,
          },
        ]}
      />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onSelect={(key) => runInventoryCommand(key, navigate, () => setCommandOpen(false))} />
    </section>
  );
}

function BatchMiniList({ batches = [] }) {
  if (!batches.length) return <EmptyState text="Chưa có lô liên quan" />;
  return (
    <div className="pharmacy-inventory-mini-list">
      {batches.map((batch) => (
        <article key={getBatchId(batch)}>
          <div>
            <strong>{batch.batch_no}</strong>
            <span>{batch.lot_no || '--'} · {formatDate(batch.expiry_date)}</span>
          </div>
          <StatusBadge value={batch.status} />
          <b>{formatNumber(batch.quantity_on_hand)}</b>
        </article>
      ))}
    </div>
  );
}

export function CurrentStockPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ page: 1, limit: 30, nearExpiryDays: 30 });
  const [commandOpen, setCommandOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const { loading, data, error, refresh } = useInventoryLoader(() => loadCurrentStock(filters), [JSON.stringify(filters)]);
  const report = data?.report || {};

  const kpis = [
    { key: 'med', label: 'Tổng thuốc', value: formatNumber(report.total_medications || report.total_active_medications), icon: Pill },
    { key: 'batches', label: 'Tổng lô', value: formatNumber(report.total_batches), icon: PackageCheck },
    { key: 'qty', label: 'Tổng tồn', value: formatNumber(report.total_stock_on_hand), icon: Boxes, tone: 'success' },
    { key: 'value', label: 'Giá trị tồn', value: formatCurrency(report.inventory_value), icon: FileText },
    { key: 'low', label: 'Dưới ngưỡng', value: formatNumber(report.low_stock_items), icon: AlertTriangle, tone: 'danger' },
    { key: 'near', label: 'Sắp hết hạn', value: formatNumber(report.near_expiry_batches), icon: TimerOff, tone: 'warning' },
    { key: 'expired', label: 'Expired', value: formatNumber(report.expired_batches), icon: Ban, tone: 'danger' },
    { key: 'recalled', label: 'Recall', value: formatNumber(report.recalled_batches), icon: ShieldAlert, tone: 'danger' },
  ];

  return (
    <section className="pharmacy-inventory-page">
      <InventoryHeader
        icon={Boxes}
        title="Tồn kho hiện tại"
        description="Matrix tồn kho theo thuốc, FEFO batch, giá trị tồn, vị trí và mức rủi ro."
        onRefresh={refresh}
        onCommand={() => setCommandOpen(true)}
        onExport={() => downloadPharmacyJson('ton-kho-hien-tai.json', { filters, report, items: data?.items || [] }, 'Xuất tồn kho hiện tại')}
        actionLabel="Nhập kho"
        onAction={() => navigate('/pharmacy/transactions/receive-stock')}
      />
      <KpiStrip cards={kpis} />
      <InventoryFilters filters={filters} setFilters={setFilters}>
        <select value={filters.stockStatus || ''} onChange={(event) => setFilters((current) => ({ ...current, stockStatus: event.target.value, page: 1 }))}>
          <option value="">Tất cả tình trạng</option>
          <option value="normal">Đủ tồn</option>
          <option value="watch">Theo dõi</option>
          <option value="low">Tồn thấp</option>
          <option value="out">Hết khả dụng</option>
          <option value="risk">Rủi ro</option>
        </select>
        <input value={filters.storageLocation || ''} placeholder="Vị trí" onChange={(event) => setFilters((current) => ({ ...current, storageLocation: event.target.value, page: 1 }))} />
      </InventoryFilters>
      <ErrorBanner error={error || data?.errors?.currentStock || data?.errors?.report} />
      {loading ? <LoadingState /> : (
        <div className="pharmacy-inventory-table-wrap">
          <table className="pharmacy-inventory-table">
            <thead>
              <tr>
                <th>Thuốc</th>
                <th>Tổng tồn</th>
                <th>Tồn khả dụng</th>
                <th>Lô</th>
                <th>FEFO</th>
                <th>Vị trí</th>
                <th>Risk</th>
                <th>Giá trị</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((row) => (
                <tr key={getMedicationId(row.medication)} onClick={() => setSelected(row)}>
                  <td><strong>{medicineName(row.medication)}</strong><small>{row.medication?.medication_code}</small></td>
                  <td>{formatNumber(row.total_on_hand)}</td>
                  <td>{formatNumber(row.available_on_hand)}</td>
                  <td>{formatNumber(row.batch_count)}<small>{formatNumber(row.available_batch_count)} available</small></td>
                  <td>{row.fefo_batch?.batch_no || '--'}<small>{formatDate(row.fefo_batch?.expiry_date)}</small></td>
                  <td>{row.storage_locations?.slice(0, 2).join(', ') || '--'}</td>
                  <td><StatusBadge value={row.stock_status} /></td>
                  <td>{formatCurrency(row.inventory_value)}</td>
                  <td>
                    <button
                      type="button"
                      className="pharmacy-inventory-icon-button"
                      aria-label="Xem"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(row);
                      }}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.items?.length ? <EmptyState /> : null}
        </div>
      )}
      <DetailDrawer
        open={Boolean(selected)}
        title={selected ? medicineName(selected.medication) : ''}
        subtitle={selected?.medication?.medication_code}
        onClose={() => setSelected(null)}
        tabs={[
          {
            key: 'overview',
            label: 'Tổng quan',
            content: <KeyValueGrid items={[
              { label: 'Tổng tồn', value: formatNumber(selected?.total_on_hand) },
              { label: 'Tồn khả dụng', value: formatNumber(selected?.available_on_hand) },
              { label: 'Lô khả dụng', value: formatNumber(selected?.available_batch_count) },
              { label: 'Sắp hết hạn', value: formatNumber(selected?.near_expiry_batch_count) },
              { label: 'Expired', value: formatNumber(selected?.expired_batch_count) },
              { label: 'Quarantine', value: formatNumber(selected?.quarantined_batch_count) },
              { label: 'Recall', value: formatNumber(selected?.recalled_batch_count) },
              { label: 'FEFO', value: selected?.fefo_batch?.batch_no || '--' },
            ]} />,
          },
          { key: 'ledger', label: 'Ledger gần đây', content: <MiniTimeline items={data?.transactions || []} /> },
        ]}
      />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onSelect={(key) => runInventoryCommand(key, navigate, () => setCommandOpen(false))} />
    </section>
  );
}

export function StockBatchPage({ view = 'all' }) {
  const navigate = useNavigate();
  const config = BATCH_VIEW_CONFIG[view] || BATCH_VIEW_CONFIG.all;
  const [filters, setFilters] = useState({ page: 1, limit: 30, nearExpiryDays: config.params.nearExpiryDays || 30, ...config.params });
  const [commandOpen, setCommandOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailState, setDetailState] = useState({ loading: false, data: null });
  const [action, setAction] = useState(null);
  const { loading, data, error, refresh } = useInventoryLoader(() => loadStockBatchConsole(filters), [JSON.stringify(filters)]);
  const report = data?.report || {};

  useEffect(() => {
    setFilters({ page: 1, limit: 30, nearExpiryDays: config.params.nearExpiryDays || 30, ...config.params });
  }, [view]);

  async function openBatch(batch) {
    setSelected(batch);
    setDetailState({ loading: true, data: null });
    const detail = await loadStockBatchDetail(getBatchId(batch));
    setDetailState({ loading: false, data: detail });
  }

  const visibleBatches = useMemo(() => {
    if (view !== 'quarantine') return data?.batches || [];
    return (data?.batches || []).filter((batch) => ['quarantined', 'recalled'].includes(String(batch.status).toLowerCase()));
  }, [data?.batches, view]);

  const kpis = [
    { key: 'batches', label: 'Tổng lô', value: formatNumber(report.total_batches), icon: PackageCheck },
    { key: 'available', label: 'Available', value: formatNumber(report.available_batches), icon: BadgeCheck, tone: 'success' },
    { key: 'qty', label: 'Tổng tồn', value: formatNumber(report.total_stock_on_hand), icon: Boxes },
    { key: 'value', label: 'Giá trị tồn', value: formatCurrency(report.inventory_value), icon: FileText },
    { key: 'near', label: 'Sắp hết hạn', value: formatNumber(report.near_expiry_batches), icon: TimerOff, tone: 'warning' },
    { key: 'expired', label: 'Expired', value: formatNumber(report.expired_batches), icon: AlertTriangle, tone: 'danger' },
    { key: 'quarantine', label: 'Quarantine', value: formatNumber(report.quarantined_batches), icon: ShieldAlert, tone: 'warning' },
    { key: 'recalled', label: 'Recalled', value: formatNumber(report.recalled_batches), icon: ShieldAlert, tone: 'danger' },
  ];

  return (
    <section className="pharmacy-inventory-page">
      <InventoryHeader
        icon={config.icon}
        title={config.title}
        description={config.description}
        onRefresh={refresh}
        onCommand={() => setCommandOpen(true)}
        onExport={() => downloadPharmacyJson(`lo-thuoc-${view}.json`, { view, filters, report, batches: visibleBatches }, 'Xuất lô thuốc')}
        actionLabel="Nhập kho"
        onAction={() => navigate('/pharmacy/transactions/receive-stock')}
      />
      <KpiStrip cards={kpis} />
      <InventoryFilters filters={filters} setFilters={setFilters}>
        <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
          <option value="">Tất cả status</option>
          <option value="available">Available</option>
          <option value="quarantined">Quarantined</option>
          <option value="expired">Expired</option>
          <option value="recalled">Recalled</option>
          <option value="depleted">Depleted</option>
        </select>
        <input value={filters.storageLocation || ''} placeholder="Vị trí" onChange={(event) => setFilters((current) => ({ ...current, storageLocation: event.target.value, page: 1 }))} />
        <input value={filters.supplier || ''} placeholder="Supplier" onChange={(event) => setFilters((current) => ({ ...current, supplier: event.target.value, page: 1 }))} />
      </InventoryFilters>
      <ErrorBanner error={error || data?.errors?.batches || data?.errors?.report || data?.errors?.expiryRisk} />
      {view === 'nearExpiry' && data?.expiryRisk?.summary ? <ExpiryRiskRail summary={data.expiryRisk.summary} /> : null}
      {loading ? <LoadingState /> : (
        <div className="pharmacy-inventory-table-wrap">
          <table className="pharmacy-inventory-table">
            <thead>
              <tr>
                <th>Risk</th>
                <th>Batch / Lot</th>
                <th>Thuốc</th>
                <th>Supplier</th>
                <th>HSD</th>
                <th>SL nhập</th>
                <th>SL còn</th>
                <th>Giá trị</th>
                <th>Vị trí</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleBatches.map((batch) => {
                const medication = getBatchMedication(batch);
                return (
                  <tr key={getBatchId(batch)} onClick={() => openBatch(batch)}>
                    <td><RiskBadge expiryDate={batch.expiry_date} status={batch.status} /></td>
                    <td><strong>{batch.batch_no}</strong><small>{batch.lot_no || '--'}</small></td>
                    <td><strong>{medicineName(medication)}</strong><small>{medication.medication_code || '--'}</small></td>
                    <td>{batch.supplier_name || '--'}</td>
                    <td>{formatDate(batch.expiry_date)}</td>
                    <td>{formatNumber(batch.quantity_received)}</td>
                    <td>{formatNumber(batch.quantity_on_hand)}</td>
                    <td>{formatCurrency(Number(batch.quantity_on_hand || 0) * Number(batch.unit_cost || 0))}</td>
                    <td>{batch.storage_location || '--'}</td>
                    <td><StatusBadge value={batch.status} /></td>
                    <td>
                      <div className="pharmacy-inventory-row-actions" onClick={(event) => event.stopPropagation()}>
                        <button type="button" title="Điều chỉnh" onClick={() => { setSelected(batch); setAction('adjust'); }}><SlidersHorizontal size={15} /></button>
                        <button type="button" title="Cách ly" onClick={() => { setSelected(batch); setAction(batch.status === 'quarantined' ? 'release' : 'quarantine'); }}><ShieldAlert size={15} /></button>
                        <button type="button" title="Recall" onClick={() => { setSelected(batch); setAction('recall'); }}><AlertTriangle size={15} /></button>
                        <button type="button" title="Hủy" onClick={() => { setSelected(batch); setAction('waste'); }}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleBatches.length ? <EmptyState /> : null}
        </div>
      )}
      <DetailDrawer
        open={Boolean(selected) && !action}
        title={selected?.batch_no || ''}
        subtitle={selected ? medicineName(getBatchMedication(selected)) : ''}
        onClose={() => setSelected(null)}
        tabs={[
          {
            key: 'overview',
            label: 'Tổng quan',
            content: detailState.loading ? <LoadingState /> : (
              <KeyValueGrid items={[
                { label: 'Batch no', value: selected?.batch_no },
                { label: 'Lot no', value: selected?.lot_no },
                { label: 'Supplier', value: selected?.supplier_name },
                { label: 'NSX', value: formatDate(selected?.manufacture_date) },
                { label: 'HSD', value: formatDate(selected?.expiry_date) },
                { label: 'SL nhập', value: formatNumber(selected?.quantity_received) },
                { label: 'SL còn', value: formatNumber(selected?.quantity_on_hand) },
                { label: 'Giá trị', value: formatCurrency(Number(selected?.quantity_on_hand || 0) * Number(selected?.unit_cost || 0)) },
                { label: 'Vị trí', value: selected?.storage_location },
                { label: 'Status', value: selected?.status },
              ]} />
            ),
          },
          { key: 'ledger', label: 'Ledger', content: <MiniTimeline items={detailState.data?.transactions || []} /> },
          {
            key: 'impact',
            label: 'Recall impact',
            content: <KeyValueGrid items={[
              { label: 'Bệnh nhân ảnh hưởng', value: formatNumber(detailState.data?.impact?.affected_patient_count) },
              { label: 'Số lượng ảnh hưởng', value: formatNumber(detailState.data?.impact?.affected_quantity) },
              { label: 'Dispense liên quan', value: formatNumber(detailState.data?.impact?.dispenses?.length) },
              { label: 'Khuyến nghị', value: (detailState.data?.impact?.recommended_actions || []).join(', ') || '--' },
            ]} />,
          },
        ]}
      />
      <BatchActionDialog action={action} batch={selected} onClose={() => setAction(null)} onDone={() => { setAction(null); setSelected(null); refresh(); }} />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onSelect={(key) => runInventoryCommand(key, navigate, () => setCommandOpen(false))} />
    </section>
  );
}

function ExpiryRiskRail({ summary = {} }) {
  const cards = [
    { label: '0-7 ngày', value: summary.within_7_days, tone: 'danger' },
    { label: '8-15 ngày', value: summary.within_15_days, tone: 'warning' },
    { label: '16-30 ngày', value: summary.within_30_days, tone: 'info' },
    { label: '31-60 ngày', value: summary.within_60_days, tone: 'neutral' },
    { label: 'SL nguy cơ', value: summary.risk_quantity, tone: 'warning' },
    { label: 'Giá trị nguy cơ', value: formatCurrency(summary.risk_value), tone: 'danger' },
  ];
  return (
    <section className="pharmacy-inventory-risk-rail">
      {cards.map((card) => (
        <article key={card.label} className={`is-${card.tone}`}>
          <span>{card.label}</span>
          <strong>{typeof card.value === 'number' ? formatNumber(card.value) : card.value}</strong>
        </article>
      ))}
    </section>
  );
}

export function StocktakePage() {
  const [filters, setFilters] = useState({ page: 1, limit: 20 });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [dialog, setDialog] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ scope_type: 'full', scope_value: '', note: '' });
  const { loading, data, error, refresh } = useInventoryLoader(() => loadStocktakes(filters), [JSON.stringify(filters)]);
  const stocktakes = data?.items || [];
  const summary = useMemo(() => ({
    open: stocktakes.filter((item) => ['open', 'counting'].includes(item.status)).length,
    review: stocktakes.filter((item) => item.status === 'review').length,
    posted: stocktakes.filter((item) => item.status === 'posted').length,
    lines: stocktakes.reduce((sum, item) => sum + Number(item.item_count || 0), 0),
    counted: stocktakes.reduce((sum, item) => sum + Number(item.counted_count || 0), 0),
    variance: stocktakes.reduce((sum, item) => sum + Number(item.variance_count || 0), 0),
    varianceValue: stocktakes.reduce((sum, item) => sum + Number(item.variance_value || 0), 0),
  }), [stocktakes]);

  async function openStocktake(stocktake) {
    setSelected(stocktake);
    setDetail(null);
    setDetail(await loadStocktakeDetail(stocktake._id || stocktake.id));
  }

  async function stocktakeAction(type, stocktake = selected) {
    if (!stocktake) return;
    if (type === 'post') {
      const ok = confirmPharmacyAction({
        title: 'Post điều chỉnh kiểm kê',
        message: `Ghi nhận chênh lệch tồn kho cho kỳ ${stocktake.stocktake_no || stocktake._id || stocktake.id}?`,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const id = stocktake._id || stocktake.id;
      if (type === 'start') await startStocktakeFromConsole(id);
      if (type === 'generate') await generateStocktakeItemsFromConsole(id);
      if (type === 'review') await reviewStocktakeFromConsole(id);
      if (type === 'post') await postStocktakeAdjustmentsFromConsole(id);
      const nextDetail = await loadStocktakeDetail(id);
      setDetail(nextDetail);
      notifyPharmacy({ tone: 'success', title: 'Kiểm kê kho dược', message: 'Đã cập nhật kỳ kiểm kê.' });
      refresh();
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Kiểm kê kho dược', message: getApiErrorMessage(error, 'Không thể cập nhật kỳ kiểm kê.') });
    } finally {
      setSaving(false);
    }
  }

  async function createStocktake(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await createStocktakeFromConsole({
        scope_type: form.scope_type,
        scope_value: form.scope_value ? form.scope_value.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
        note: form.note,
      });
      const payload = unwrapData(response);
      setDialog('');
      notifyPharmacy({ tone: 'success', title: 'Tạo kỳ kiểm kê', message: 'Đã tạo kỳ kiểm kê mới.' });
      refresh();
      if (payload?.stocktake) openStocktake(payload.stocktake);
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Tạo kỳ kiểm kê', message: getApiErrorMessage(error, 'Không thể tạo kỳ kiểm kê.') });
    } finally {
      setSaving(false);
    }
  }

  const kpis = [
    { key: 'open', label: 'Kỳ đang mở', value: formatNumber(summary.open), icon: ClipboardCheck, tone: 'info' },
    { key: 'review', label: 'Chờ duyệt', value: formatNumber(summary.review), icon: Clock3, tone: 'warning' },
    { key: 'posted', label: 'Đã hoàn tất', value: formatNumber(summary.posted), icon: CheckCircle2, tone: 'success' },
    { key: 'lines', label: 'Dòng cần đếm', value: formatNumber(summary.lines), icon: Boxes },
    { key: 'counted', label: 'Đã đếm', value: formatNumber(summary.counted), icon: BadgeCheck, tone: 'success' },
    { key: 'variance', label: 'Dòng lệch', value: formatNumber(summary.variance), icon: AlertTriangle, tone: 'danger' },
    { key: 'variance-value', label: 'Giá trị lệch', value: formatCurrency(summary.varianceValue), icon: FileText, tone: 'warning' },
  ];

  return (
    <section className="pharmacy-inventory-page">
      <InventoryHeader
        icon={ClipboardCheck}
        title="Kiểm kê"
        description="Kỳ kiểm kê, dòng đếm theo batch, variance và post adjustment có audit."
        onRefresh={refresh}
        onExport={() => downloadPharmacyJson('kiem-ke-kho-duoc.json', { filters, summary, stocktakes }, 'Xuất kiểm kê')}
        actionLabel="Tạo kỳ kiểm kê"
        onAction={() => setDialog('create')}
      />
      <KpiStrip cards={kpis} />
      <InventoryFilters filters={filters} setFilters={setFilters}>
        <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
          <option value="">Tất cả status</option>
          <option value="draft">Draft</option>
          <option value="counting">Counting</option>
          <option value="review">Review</option>
          <option value="posted">Posted</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </InventoryFilters>
      <ErrorBanner error={error} />
      {loading ? <LoadingState /> : (
        <div className="pharmacy-inventory-table-wrap">
          <table className="pharmacy-inventory-table">
            <thead>
              <tr>
                <th>Mã kỳ</th>
                <th>Phạm vi</th>
                <th>Ngày bắt đầu</th>
                <th>Dòng</th>
                <th>Đã đếm</th>
                <th>Lệch</th>
                <th>Giá trị lệch</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stocktakes.map((item) => (
                <tr key={item._id || item.id} onClick={() => openStocktake(item)}>
                  <td><strong>{item.stocktake_no}</strong></td>
                  <td>{item.scope_type}<small>{Array.isArray(item.scope_value) ? item.scope_value.join(', ') : item.scope_value || '--'}</small></td>
                  <td>{formatDate(item.started_at || item.created_at)}</td>
                  <td>{formatNumber(item.item_count)}</td>
                  <td>{formatNumber(item.counted_count)}</td>
                  <td>{formatNumber(item.variance_count)}</td>
                  <td>{formatCurrency(item.variance_value)}</td>
                  <td><StatusBadge value={item.status} fallback={item.status} /></td>
                  <td>
                    <div className="pharmacy-inventory-row-actions" onClick={(event) => event.stopPropagation()}>
                      <button type="button" title="Start" onClick={() => stocktakeAction('start', item)}><CheckCircle2 size={15} /></button>
                      <button type="button" title="Generate items" onClick={() => stocktakeAction('generate', item)}><Boxes size={15} /></button>
                      <button type="button" title="Review" onClick={() => stocktakeAction('review', item)}><Eye size={15} /></button>
                      <button type="button" title="Post" onClick={() => stocktakeAction('post', item)}><PackageCheck size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!stocktakes.length ? <EmptyState /> : null}
        </div>
      )}
      <DetailDrawer
        open={Boolean(selected)}
        title={selected?.stocktake_no || ''}
        subtitle={selected?.status}
        onClose={() => setSelected(null)}
        tabs={[
          {
            key: 'overview',
            label: 'Tổng quan',
            content: <KeyValueGrid items={[
              { label: 'Phạm vi', value: selected?.scope_type },
              { label: 'Dòng cần đếm', value: formatNumber(selected?.item_count) },
              { label: 'Đã đếm', value: formatNumber(selected?.counted_count) },
              { label: 'Dòng lệch', value: formatNumber(selected?.variance_count) },
              { label: 'Giá trị lệch', value: formatCurrency(selected?.variance_value) },
              { label: 'Người tạo', value: selected?.created_by?.full_name || selected?.created_by?.username },
              { label: 'Ngày start', value: formatDate(selected?.started_at) },
              { label: 'Ngày post', value: formatDate(selected?.posted_at) },
            ]} />,
          },
          {
            key: 'items',
            label: 'Dòng kiểm kê',
            content: <StocktakeItems items={detail?.items || []} />,
          },
        ]}
      />
      {dialog === 'create' ? (
        <div className="pharmacy-inventory-modal" role="dialog" aria-modal="true">
          <form className="pharmacy-inventory-action-dialog" onSubmit={createStocktake}>
            <header>
              <div><span>Stocktake</span><strong>Tạo kỳ kiểm kê</strong></div>
              <button type="button" aria-label="Đóng" onClick={() => setDialog('')}><X size={18} /></button>
            </header>
            <label>
              <span>Phạm vi</span>
              <select value={form.scope_type} onChange={(event) => setForm((current) => ({ ...current, scope_type: event.target.value }))}>
                <option value="full">Toàn kho</option>
                <option value="location">Theo vị trí</option>
                <option value="selected_batches">Chọn batch</option>
                <option value="medication_group">Nhóm thuốc</option>
              </select>
            </label>
            <label>
              <span>Scope value</span>
              <input value={form.scope_value} onChange={(event) => setForm((current) => ({ ...current, scope_value: event.target.value }))} />
            </label>
            <label>
              <span>Ghi chú</span>
              <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
            </label>
            <footer>
              <button type="button" className="pharmacy-inventory-button is-secondary" onClick={() => setDialog('')}>Hủy</button>
              <button type="submit" className="pharmacy-inventory-button" disabled={saving}>{saving ? 'Đang tạo' : 'Tạo kỳ'}</button>
            </footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function StocktakeItems({ items = [] }) {
  if (!items.length) return <EmptyState text="Chưa sinh dòng kiểm kê" />;
  return (
    <div className="pharmacy-inventory-mini-list is-stocktake">
      {items.slice(0, 120).map((item) => (
        <article key={item._id || item.id}>
          <div>
            <strong>{medicineName(item.medication_id)}</strong>
            <span>{item.stock_batch_id?.batch_no} · {item.stock_batch_id?.storage_location || '--'}</span>
          </div>
          <b>{formatNumber(item.system_quantity)} / {item.counted_quantity ?? '--'}</b>
          <StatusBadge value={item.status} fallback={item.status} />
        </article>
      ))}
    </div>
  );
}
