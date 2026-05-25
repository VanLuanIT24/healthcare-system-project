import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  History,
  Layers3,
  PackageCheck,
  PackagePlus,
  Pill,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { getApiErrorMessage, pharmacyOverviewAPI, prescriptionAPI, unwrapData } from '../utils/api';
import { confirmPharmacyAction, downloadPharmacyJson, notifyPharmacy } from './pharmacyActions';

const PAGE_CONFIG = {
  center: {
    title: 'Trung tâm giao dịch kho',
    description: 'Theo dõi nhập, xuất, chuyển, điều chỉnh, hủy và hoàn trả theo batch, FEFO, audit và cảnh báo vận hành.',
    icon: ArrowLeftRight,
    actionLabel: 'Tạo giao dịch',
  },
  receipts: {
    title: 'Nhập kho thuốc',
    description: 'Ghi nhận thuốc nhập mới, bổ sung batch cũ, kiểm tra hạn dùng, đơn giá, vị trí và chứng từ nhập.',
    icon: PackagePlus,
    actionLabel: 'Tạo phiếu nhập',
  },
  issues: {
    title: 'Xuất kho nội bộ',
    description: 'Tạo phiếu xuất thuốc cho khoa/phòng/tủ thuốc nội bộ, tự chọn batch theo FEFO và kiểm soát bàn giao.',
    icon: PackageCheck,
    actionLabel: 'Tạo phiếu xuất',
  },
  transfers: {
    title: 'Chuyển kho',
    description: 'Quản lý chuyển thuốc giữa kho, vị trí lưu trữ và xác nhận nhận hàng theo batch.',
    icon: ArrowLeftRight,
    actionLabel: 'Tạo phiếu chuyển',
  },
  adjustments: {
    title: 'Điều chỉnh tồn',
    description: 'Điều chỉnh tăng/giảm tồn kho theo batch, có lý do, kiểm soát tồn âm và audit đầy đủ.',
    icon: SlidersHorizontal,
    actionLabel: 'Tạo điều chỉnh',
  },
  waste: {
    title: 'Hủy / hao hụt thuốc',
    description: 'Quản lý phiếu hủy, hao hụt, hết hạn, recall và biên bản xử lý thuốc không còn sử dụng.',
    icon: Trash2,
    actionLabel: 'Tạo phiếu hủy',
  },
  returns: {
    title: 'Hoàn trả về kho',
    description: 'Tiếp nhận thuốc hoàn trả, kiểm tra chất lượng, quyết định nhập lại tồn, cách ly hoặc hủy.',
    icon: RotateCcw,
    actionLabel: 'Tạo phiếu hoàn',
  },
  history: {
    title: 'Lịch sử giao dịch kho',
    description: 'Theo dõi mọi biến động tồn kho theo thuốc, batch, người thao tác, reference và thời gian.',
    icon: History,
    actionLabel: '',
  },
};

const TYPE_META = {
  receipt: { label: 'Nhập kho', tone: 'success' },
  issue: { label: 'Xuất nội bộ', tone: 'warning' },
  dispense: { label: 'Cấp phát', tone: 'info' },
  adjustment: { label: 'Điều chỉnh', tone: 'purple' },
  return: { label: 'Hoàn trả', tone: 'success' },
  transfer: { label: 'Chuyển kho', tone: 'info' },
  waste: { label: 'Hủy/hao hụt', tone: 'danger' },
  expire: { label: 'Hết hạn', tone: 'danger' },
  recall: { label: 'Recall', tone: 'danger' },
};

const STATUS_META = {
  draft: { label: 'Nháp', tone: 'muted' },
  pending_review: { label: 'Chờ rà soát', tone: 'warning' },
  pending_approval: { label: 'Chờ duyệt', tone: 'warning' },
  approved: { label: 'Đã duyệt', tone: 'info' },
  picking: { label: 'Đang soạn', tone: 'info' },
  dispatched: { label: 'Đã xuất', tone: 'success' },
  in_transit: { label: 'Đang chuyển', tone: 'info' },
  received: { label: 'Đã nhận', tone: 'success' },
  accepted: { label: 'Đã nhận kiểm', tone: 'success' },
  quarantined: { label: 'Cách ly', tone: 'warning' },
  posted: { label: 'Đã post', tone: 'success' },
  rejected: { label: 'Từ chối', tone: 'danger' },
  cancelled: { label: 'Đã hủy', tone: 'muted' },
  in: { label: 'IN', tone: 'success' },
  out: { label: 'OUT', tone: 'danger' },
  available: { label: 'Available', tone: 'success' },
  expired: { label: 'Expired', tone: 'danger' },
  recalled: { label: 'Recalled', tone: 'danger' },
  depleted: { label: 'Depleted', tone: 'muted' },
};

function readItems(response) {
  const payload = unwrapData(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getId(value = {}) {
  return value?._id || value?.id || value;
}

function getMedication(row = {}) {
  return row.medication_id && typeof row.medication_id === 'object' ? row.medication_id : row.medication || {};
}

function getBatch(row = {}) {
  return row.stock_batch_id && typeof row.stock_batch_id === 'object'
    ? row.stock_batch_id
    : row.from_stock_batch_id && typeof row.from_stock_batch_id === 'object'
      ? row.from_stock_batch_id
      : row.batch || {};
}

function medicationName(medication = {}) {
  return [medication.brand_name || medication.generic_name, medication.strength].filter(Boolean).join(' ') ||
    medication.medication_code ||
    'Thuốc';
}

function documentId(row = {}) {
  return row._id || row.id || row.receipt_no || row.issue_no || row.transfer_no || row.disposal_no || row.return_no || row.transaction_no;
}

function documentNo(row = {}) {
  return row.receipt_no || row.issue_no || row.transfer_no || row.disposal_no || row.return_no || row.transaction_no || '--';
}

function StatusBadge({ value, map = STATUS_META }) {
  const meta = map[value] || STATUS_META[value] || TYPE_META[value] || { label: value || '--', tone: 'muted' };
  return <span className={`pharmacy-inventory-badge is-${meta.tone}`}>{meta.label}</span>;
}

function LoadingState({ text = 'Đang tải dữ liệu nhập xuất kho' }) {
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

function InventoryHeader({ config, onRefresh, onAction, onExport }) {
  const Icon = config.icon;
  return (
    <header className="pharmacy-inventory-header">
      <div className="pharmacy-inventory-header__title">
        <span className="pharmacy-inventory-header__crumb">Nhà thuốc & Kho dược / Nhập và xuất kho</span>
        <div>
          <span className="pharmacy-inventory-header__mark" aria-hidden="true"><Icon size={24} /></span>
          <h1>{config.title}</h1>
        </div>
        <p>{config.description}</p>
      </div>
      <div className="pharmacy-inventory-header__actions">
        <span className="pharmacy-inventory-sync"><CheckCircle2 size={15} /> Theo batch và audit</span>
        <button type="button" className="pharmacy-inventory-icon-button" aria-label="Refresh" onClick={onRefresh}>
          <RefreshCw size={18} />
        </button>
        <button type="button" className="pharmacy-inventory-button is-secondary" onClick={onExport}>
          <Download size={16} /> Export
        </button>
        {config.actionLabel ? (
          <button type="button" className="pharmacy-inventory-button" onClick={onAction}>
            <PackagePlus size={16} /> {config.actionLabel}
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

function InventoryFilters({ filters, setFilters, mode }) {
  return (
    <section className="pharmacy-inventory-filters">
      <label className="pharmacy-inventory-search">
        <Search size={16} />
        <input
          value={filters.search || ''}
          placeholder="Tìm mã phiếu, thuốc, batch, lot, reference"
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
        />
      </label>
      {mode === 'history' ? (
        <>
          <select value={filters.transaction_type || ''} onChange={(event) => setFilters((current) => ({ ...current, transaction_type: event.target.value, page: 1 }))}>
            <option value="">Tất cả loại giao dịch</option>
            {Object.entries(TYPE_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
          <select value={filters.direction || ''} onChange={(event) => setFilters((current) => ({ ...current, direction: event.target.value, page: 1 }))}>
            <option value="">IN/OUT</option>
            <option value="in">IN</option>
            <option value="out">OUT</option>
          </select>
        </>
      ) : (
        <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="pending_approval">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="dispatched">Đã xuất</option>
          <option value="posted">Đã post</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      )}
      <input type="date" value={filters.date_from || ''} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value, page: 1 }))} />
      <input type="date" value={filters.date_to || ''} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value, page: 1 }))} />
      <button type="button" className="pharmacy-inventory-button is-secondary" onClick={() => setFilters({ page: 1, limit: 25 })}>
        <Filter size={16} /> Reset
      </button>
    </section>
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

function DetailDrawer({ item, mode, onClose }) {
  if (!item) return null;
  const batch = getBatch(item);
  const medication = getMedication(item);
  const title = documentNo(item);
  const subtitle = item.reason || item.note || item.reference_type || medicationName(medication);

  return (
    <aside className="pharmacy-inventory-drawer">
      <header>
        <div>
          <span>Chi tiết</span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
        <button type="button" aria-label="Đóng drawer" onClick={onClose}><X size={18} /></button>
      </header>
      <section>
        <KeyValueGrid items={[
          { label: 'Mã chứng từ', value: title },
          { label: 'Trạng thái', value: item.status || item.direction || item.transaction_type },
          { label: 'Loại', value: TYPE_META[item.transaction_type]?.label || mode },
          { label: 'Thuốc', value: medicationName(medication) },
          { label: 'Batch', value: batch.batch_no || item.batch_no },
          { label: 'Lot', value: batch.lot_no || item.lot_no },
          { label: 'HSD', value: formatDate(batch.expiry_date || item.expiry_date) },
          { label: 'Số lượng', value: formatNumber(item.quantity || item.total_quantity || item.total_quantity_requested || item.total_quantity_dispatched || item.total_quantity_returned || item.quantity_requested) },
          { label: 'Tồn sau', value: item.balance_after !== undefined ? formatNumber(item.balance_after) : '--' },
          { label: 'Giá trị', value: formatCurrency(item.total_value || Number(item.quantity || 0) * Number(item.unit_cost || 0)) },
          { label: 'Reference', value: [item.reference_type, item.reference_id].filter(Boolean).join(' / ') || '--' },
          { label: 'Ghi chú', value: item.note || item.reason || '--' },
        ]} />
      </section>
    </aside>
  );
}

async function loadReferenceData() {
  const [medications, batches] = await Promise.allSettled([
    pharmacyOverviewAPI.listPharmacyMedications({ limit: 100, status: 'active' }),
    pharmacyOverviewAPI.listPharmacyStockBatches({ limit: 150, has_stock: true }),
  ]);
  return {
    medications: medications.status === 'fulfilled' ? readItems(medications.value) : [],
    batches: batches.status === 'fulfilled' ? readItems(batches.value) : [],
  };
}

async function loadPageData(mode, filters = {}) {
  if (mode === 'center') {
    const response = await pharmacyOverviewAPI.inventoryCenter({ near_expiry_days: 60, limit: 20 });
    return unwrapData(response);
  }
  if (mode === 'receipts') return unwrapData(await pharmacyOverviewAPI.listInventoryReceipts(filters));
  if (mode === 'issues') return unwrapData(await pharmacyOverviewAPI.listInternalIssues(filters));
  if (mode === 'transfers') return unwrapData(await pharmacyOverviewAPI.listInventoryTransfers(filters));
  if (mode === 'waste') return unwrapData(await pharmacyOverviewAPI.listInventoryDisposals(filters));
  if (mode === 'returns') return unwrapData(await pharmacyOverviewAPI.listInventoryReturns(filters));
  if (mode === 'adjustments') {
    return unwrapData(await pharmacyOverviewAPI.listInventoryTransactions({ ...filters, transaction_type: 'adjustment' }));
  }
  return unwrapData(await pharmacyOverviewAPI.listInventoryTransactions(filters));
}

function useTransactionPageData(mode, filters) {
  const [state, setState] = useState({ loading: true, data: null, references: { medications: [], batches: [] }, error: '' });

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [data, references] = await Promise.all([loadPageData(mode, filters), loadReferenceData()]);
      setState({ loading: false, data, references, error: '' });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getApiErrorMessage(error, 'Không thể tải dữ liệu nhập xuất kho.') }));
    }
  }

  useEffect(() => {
    refresh();
  }, [mode, JSON.stringify(filters)]);

  return { ...state, refresh };
}

function getRows(mode, data) {
  if (!data) return [];
  if (mode === 'center') return data.recent_transactions || [];
  return data.items || data.rows || [];
}

function getKpis(mode, data, rows) {
  const report = data?.report?.summary || data?.report || {};
  if (mode === 'center') {
    const today = data?.today || {};
    const alerts = data?.alerts || [];
    return [
      { key: 'tx', label: 'Tổng giao dịch hôm nay', value: formatNumber(today.transaction_count), icon: History },
      { key: 'in', label: 'Tổng nhập', value: formatNumber(today.in_count), icon: PackagePlus, tone: 'success' },
      { key: 'out', label: 'Tổng xuất', value: formatNumber(today.out_count), icon: PackageCheck, tone: 'warning' },
      { key: 'batches', label: 'Batch ảnh hưởng', value: formatNumber(today.affected_batch_count), icon: Layers3 },
      { key: 'value', label: 'Giá trị tồn kho', value: formatCurrency(report.inventory_value), icon: FileText },
      { key: 'in-qty', label: 'SL nhập kỳ này', value: formatNumber(report.inventory_in_quantity), icon: BadgeCheck, tone: 'success' },
      { key: 'out-qty', label: 'SL xuất kỳ này', value: formatNumber(report.inventory_out_quantity), icon: ArrowLeftRight, tone: 'warning' },
      { key: 'near', label: 'Lô sắp hết hạn', value: formatNumber(report.near_expiry_batches), icon: Clock3, tone: 'warning' },
      { key: 'expired', label: 'Lô hết hạn', value: formatNumber(report.expired_batches), icon: AlertTriangle, tone: 'danger' },
      { key: 'low', label: 'Dưới tồn tối thiểu', value: formatNumber(report.low_stock_items), icon: ShieldAlert, tone: 'danger' },
      { key: 'adjust', label: 'Giao dịch điều chỉnh', value: formatNumber(today.adjustment_count), icon: SlidersHorizontal, tone: 'purple' },
      { key: 'alerts', label: 'Cảnh báo vận hành', value: formatNumber(alerts.length), icon: AlertTriangle, tone: alerts.length ? 'danger' : 'success' },
    ];
  }
  const posted = rows.filter((item) => ['posted', 'dispatched', 'received'].includes(item.status)).length;
  const pending = rows.filter((item) => ['draft', 'pending_review', 'pending_approval', 'approved', 'picking', 'pending_inspection'].includes(item.status)).length;
  const totalQty = rows.reduce((sum, item) => sum + Number(item.total_quantity || item.total_quantity_requested || item.total_quantity_dispatched || item.total_quantity_returned || item.quantity || 0), 0);
  const totalValue = rows.reduce((sum, item) => sum + Number(item.total_value || Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);
  return [
    { key: 'total', label: mode === 'history' || mode === 'adjustments' ? 'Tổng giao dịch' : 'Tổng phiếu', value: formatNumber(rows.length), icon: FileText },
    { key: 'posted', label: 'Đã xử lý', value: formatNumber(posted), icon: CheckCircle2, tone: 'success' },
    { key: 'pending', label: 'Chờ xử lý', value: formatNumber(pending), icon: Clock3, tone: 'warning' },
    { key: 'qty', label: 'Tổng số lượng', value: formatNumber(totalQty), icon: Boxes },
    { key: 'value', label: 'Giá trị ảnh hưởng', value: formatCurrency(totalValue), icon: FileCheck2 },
    { key: 'out', label: 'OUT', value: formatNumber(rows.filter((item) => item.direction === 'out').length), icon: PackageCheck, tone: 'warning' },
    { key: 'in', label: 'IN', value: formatNumber(rows.filter((item) => item.direction === 'in').length), icon: PackagePlus, tone: 'success' },
  ];
}

function WorkQueue({ data, onSelect }) {
  const lanes = [
    { key: 'receipts', label: 'Chờ nhập kho', icon: PackagePlus },
    { key: 'issues', label: 'Chờ xuất nội bộ', icon: PackageCheck },
    { key: 'transfers', label: 'Chờ chuyển kho', icon: ArrowLeftRight },
    { key: 'disposals', label: 'Chờ hủy / hao hụt', icon: Trash2 },
    { key: 'returns', label: 'Chờ kiểm tra hoàn trả', icon: RotateCcw },
  ];
  return (
    <section className="pharmacy-transaction-lanes">
      {lanes.map((lane) => {
        const Icon = lane.icon;
        const items = data?.work_queue?.[lane.key] || [];
        return (
          <article key={lane.key}>
            <header>
              <Icon size={17} />
              <strong>{lane.label}</strong>
              <span>{formatNumber(items.length)}</span>
            </header>
            <div>
              {items.slice(0, 4).map((item) => (
                <button key={documentId(item)} type="button" onClick={() => onSelect?.(item)}>
                  <strong>{documentNo(item)}</strong>
                  <small>{item.reason || item.note || item.status}</small>
                  <StatusBadge value={item.status} />
                </button>
              ))}
              {!items.length ? <small className="pharmacy-inventory-muted">Không có phiếu chờ</small> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function AlertRail({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <section className="pharmacy-inventory-risk-rail">
      {alerts.slice(0, 8).map((alert, index) => (
        <article key={`${alert.type}-${index}`} className={`is-${alert.severity || 'warning'}`}>
          <span>{alert.title}</span>
          <strong>{alert.batch?.batch_no || alert.batch?.medication_id?.medication_code || '--'}</strong>
        </article>
      ))}
    </section>
  );
}

function TransactionTable({ mode, rows, onSelect, onQuickAction }) {
  if (mode === 'history' || mode === 'adjustments' || mode === 'center') {
    return (
      <div className="pharmacy-inventory-table-wrap">
        <table className="pharmacy-inventory-table">
          <thead>
            <tr>
              <th>Mã giao dịch</th>
              <th>Thời gian</th>
              <th>Loại</th>
              <th>Direction</th>
              <th>Thuốc</th>
              <th>Batch / Lot</th>
              <th>Số lượng</th>
              <th>Tồn sau</th>
              <th>Reference</th>
              <th>Người thao tác</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const medication = getMedication(row);
              const batch = getBatch(row);
              return (
                <tr key={documentId(row)} onClick={() => onSelect(row)}>
                  <td><strong>{row.transaction_no}</strong></td>
                  <td>{formatDateTime(row.occurred_at)}</td>
                  <td><StatusBadge value={row.transaction_type} map={TYPE_META} /></td>
                  <td><StatusBadge value={row.direction} /></td>
                  <td><strong>{medicationName(medication)}</strong><small>{medication.medication_code || '--'}</small></td>
                  <td>{batch.batch_no || '--'}<small>{batch.lot_no || '--'}</small></td>
                  <td>{formatNumber(row.quantity)}</td>
                  <td>{formatNumber(row.balance_after)}</td>
                  <td>{row.reference_type || '--'}<small>{row.document_no || row.reference_id || '--'}</small></td>
                  <td>{row.performed_by?.full_name || row.performed_by?.username || '--'}</td>
                  <td>
                    <button
                      type="button"
                      className="pharmacy-inventory-icon-button"
                      aria-label="Xem"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(row);
                      }}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? <EmptyState /> : null}
      </div>
    );
  }

  return (
    <div className="pharmacy-inventory-table-wrap">
      <table className="pharmacy-inventory-table">
        <thead>
          <tr>
            <th>Mã phiếu</th>
            <th>Ngày tạo</th>
            <th>Luồng xử lý</th>
            <th>Đối tượng</th>
            <th>Số lượng</th>
            <th>Giá trị</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={documentId(row)} onClick={() => onSelect(row)}>
              <td><strong>{documentNo(row)}</strong></td>
              <td>{formatDateTime(row.created_at || row.requested_at || row.received_at)}</td>
              <td>{row.return_source || row.disposal_type || row.priority || row.supplier_name || '--'}</td>
              <td>{row.to_location_label || row.supplier_name || row.returned_by_name || row.from_warehouse_id?.name || row.warehouse_id?.name || '--'}</td>
              <td>{formatNumber(row.total_quantity || row.total_quantity_requested || row.total_quantity_dispatched || row.total_quantity_returned)}</td>
              <td>{formatCurrency(row.total_value)}</td>
              <td>{row.reason || row.note || '--'}</td>
              <td><StatusBadge value={row.status} /></td>
              <td>
                <div className="pharmacy-inventory-row-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" title="Xem" onClick={() => onSelect(row)}><Eye size={15} /></button>
                  {['draft', 'approved', 'pending_approval', 'accepted'].includes(row.status) ? (
                    <button type="button" title="Post/dispatch" onClick={() => onQuickAction(row)}><CheckCircle2 size={15} /></button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <EmptyState /> : null}
    </div>
  );
}

function OperationDialog({ mode, references, onClose, onDone }) {
  const firstMedicationId = getId(references.medications?.[0] || {});
  const firstBatchId = getId(references.batches?.[0] || {});
  const [form, setForm] = useState({
    medication_id: firstMedicationId || '',
    stock_batch_id: firstBatchId || '',
    quantity: 1,
    direction: 'out',
    reason: '',
    supplier_name: '',
    batch_no: '',
    lot_no: '',
    expiry_date: '',
    unit_cost: '',
    storage_location: '',
    to_location: '',
    disposal_type: 'damaged',
    return_source: 'department',
    decision: 'restock',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((current) => ({
      ...current,
      medication_id: current.medication_id || firstMedicationId || '',
      stock_batch_id: current.stock_batch_id || firstBatchId || '',
    }));
  }, [firstMedicationId, firstBatchId]);

  const title = {
    center: 'Tạo giao dịch nhanh',
    receipts: 'Tạo phiếu nhập kho',
    issues: 'Tạo phiếu xuất nội bộ',
    transfers: 'Tạo phiếu chuyển kho',
    adjustments: 'Tạo điều chỉnh tồn',
    waste: 'Tạo phiếu hủy / hao hụt',
    returns: 'Tạo phiếu hoàn trả',
  }[mode] || 'Tạo giao dịch';

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const quantity = Number(form.quantity || 0);
      if (mode === 'receipts' || mode === 'center') {
        await pharmacyOverviewAPI.createInventoryReceipt({
          post_now: true,
          supplier_name: form.supplier_name,
          reason: form.reason || 'Nhập kho từ UI',
          items: [{
            medication_id: form.medication_id,
            batch_no: form.batch_no,
            lot_no: form.lot_no,
            expiry_date: form.expiry_date || undefined,
            quantity,
            unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
            storage_location: form.storage_location,
          }],
        });
      } else if (mode === 'issues') {
        await pharmacyOverviewAPI.createInternalIssue({
          post_now: true,
          reason: form.reason || 'Xuất kho nội bộ',
          to_location_label: form.to_location,
          items: [{ medication_id: form.medication_id, quantity_requested: quantity }],
        });
      } else if (mode === 'transfers') {
        await pharmacyOverviewAPI.createInventoryTransfer({
          post_now: true,
          receive_now: true,
          reason: form.reason || 'Chuyển kho/vị trí',
          to_location: form.to_location,
          items: [{ from_stock_batch_id: form.stock_batch_id, quantity_requested: quantity, to_location: form.to_location }],
        });
      } else if (mode === 'adjustments') {
        await prescriptionAPI.adjustStockBatch(form.stock_batch_id, {
          direction: form.direction,
          adjustment_quantity: quantity,
          reason: form.reason || 'Điều chỉnh tồn từ UI',
        });
      } else if (mode === 'waste') {
        await pharmacyOverviewAPI.createInventoryDisposal({
          post_now: true,
          disposal_type: form.disposal_type,
          reason: form.reason || 'Hủy/hao hụt từ UI',
          items: [{ stock_batch_id: form.stock_batch_id, quantity }],
        });
      } else if (mode === 'returns') {
        await pharmacyOverviewAPI.createInventoryReturn({
          post_now: true,
          return_source: form.return_source,
          reason: form.reason || 'Hoàn trả về kho',
          items: [{ stock_batch_id: form.stock_batch_id, quantity_returned: quantity, decision: form.decision }],
        });
      }
      notifyPharmacy({ tone: 'success', title, message: 'Đã tạo và post giao dịch kho.' });
      onDone();
    } catch (error) {
      setError(getApiErrorMessage(error, 'Không thể tạo giao dịch kho.'));
      notifyPharmacy({ tone: 'danger', title, message: getApiErrorMessage(error, 'Không thể tạo giao dịch kho.') });
    } finally {
      setSaving(false);
    }
  }

  const showMedication = ['center', 'receipts', 'issues'].includes(mode);
  const showBatch = ['transfers', 'adjustments', 'waste', 'returns'].includes(mode);
  const showReceiptFields = ['center', 'receipts'].includes(mode);

  return (
    <div className="pharmacy-inventory-modal" role="dialog" aria-modal="true">
      <form className="pharmacy-inventory-action-dialog is-wide" onSubmit={submit}>
        <header>
          <div><span>Nhập / xuất kho</span><strong>{title}</strong></div>
          <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </header>
        <ErrorBanner error={error} />
        {showMedication ? (
          <label>
            <span>Thuốc</span>
            <select value={form.medication_id} onChange={(event) => setForm((current) => ({ ...current, medication_id: event.target.value }))} required>
              <option value="">Chọn thuốc</option>
              {references.medications.map((item) => (
                <option key={getId(item)} value={getId(item)}>{item.medication_code} - {medicationName(item)}</option>
              ))}
            </select>
          </label>
        ) : null}
        {showBatch ? (
          <label>
            <span>Batch / lô</span>
            <select value={form.stock_batch_id} onChange={(event) => setForm((current) => ({ ...current, stock_batch_id: event.target.value }))} required>
              <option value="">Chọn batch</option>
              {references.batches.map((batch) => {
                const medication = getMedication(batch);
                return (
                  <option key={getId(batch)} value={getId(batch)}>
                    {batch.batch_no} / {batch.lot_no || '--'} - {medicationName(medication)} - tồn {formatNumber(batch.quantity_on_hand)}
                  </option>
                );
              })}
            </select>
          </label>
        ) : null}
        {showReceiptFields ? (
          <>
            <label>
              <span>Batch no</span>
              <input value={form.batch_no} onChange={(event) => setForm((current) => ({ ...current, batch_no: event.target.value }))} required />
            </label>
            <label>
              <span>Lot no</span>
              <input value={form.lot_no} onChange={(event) => setForm((current) => ({ ...current, lot_no: event.target.value }))} />
            </label>
            <label>
              <span>Nhà cung cấp</span>
              <input value={form.supplier_name} onChange={(event) => setForm((current) => ({ ...current, supplier_name: event.target.value }))} />
            </label>
            <label>
              <span>Hạn dùng</span>
              <input type="date" value={form.expiry_date} onChange={(event) => setForm((current) => ({ ...current, expiry_date: event.target.value }))} />
            </label>
            <label>
              <span>Đơn giá nhập</span>
              <input type="number" min="0" value={form.unit_cost} onChange={(event) => setForm((current) => ({ ...current, unit_cost: event.target.value }))} />
            </label>
            <label>
              <span>Vị trí lưu kho</span>
              <input value={form.storage_location} onChange={(event) => setForm((current) => ({ ...current, storage_location: event.target.value }))} />
            </label>
          </>
        ) : null}
        {mode === 'adjustments' ? (
          <label>
            <span>Loại điều chỉnh</span>
            <select value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}>
              <option value="out">Giảm tồn</option>
              <option value="in">Tăng tồn</option>
            </select>
          </label>
        ) : null}
        {mode === 'waste' ? (
          <label>
            <span>Loại hủy</span>
            <select value={form.disposal_type} onChange={(event) => setForm((current) => ({ ...current, disposal_type: event.target.value }))}>
              <option value="expired">Hết hạn</option>
              <option value="damaged">Hỏng/vỡ</option>
              <option value="lost">Mất mát</option>
              <option value="recall">Recall</option>
              <option value="temperature_excursion">Sai nhiệt độ</option>
              <option value="other">Khác</option>
            </select>
          </label>
        ) : null}
        {mode === 'returns' ? (
          <>
            <label>
              <span>Nguồn hoàn</span>
              <select value={form.return_source} onChange={(event) => setForm((current) => ({ ...current, return_source: event.target.value }))}>
                <option value="department">Khoa/phòng</option>
                <option value="ward_stock">Tủ thuốc nội trú</option>
                <option value="patient">Bệnh nhân</option>
                <option value="dispense">Cấp phát</option>
                <option value="transfer">Chuyển kho</option>
              </select>
            </label>
            <label>
              <span>Quyết định xử lý</span>
              <select value={form.decision} onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value }))}>
                <option value="restock">Nhập lại tồn</option>
                <option value="quarantine">Cách ly</option>
                <option value="dispose">Hủy</option>
                <option value="reject">Từ chối nhận</option>
              </select>
            </label>
          </>
        ) : null}
        {['issues', 'transfers'].includes(mode) ? (
          <label>
            <span>{mode === 'issues' ? 'Khoa/phòng/tủ nhận' : 'Vị trí/kho đích'}</span>
            <input value={form.to_location} onChange={(event) => setForm((current) => ({ ...current, to_location: event.target.value }))} />
          </label>
        ) : null}
        <label>
          <span>Số lượng</span>
          <input type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
        </label>
        <label>
          <span>Lý do / ghi chú bắt buộc</span>
          <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
        </label>
        <footer>
          <button type="button" className="pharmacy-inventory-button is-secondary" onClick={onClose}>Hủy</button>
          <button type="submit" className="pharmacy-inventory-button" disabled={saving}>{saving ? 'Đang lưu' : 'Xác nhận và post'}</button>
        </footer>
      </form>
    </div>
  );
}

async function runQuickAction(mode, row) {
  const id = getId(row);
  if (mode === 'receipts') return pharmacyOverviewAPI.postInventoryReceipt(id, { reason: row.reason || row.note || 'Post phiếu nhập' });
  if (mode === 'issues') return pharmacyOverviewAPI.dispatchInternalIssue(id, { reason: row.reason || 'Dispatch phiếu xuất nội bộ' });
  if (mode === 'transfers') return pharmacyOverviewAPI.dispatchInventoryTransfer(id, { reason: row.reason || 'Dispatch phiếu chuyển', receive_now: true });
  if (mode === 'waste') return pharmacyOverviewAPI.postInventoryDisposal(id, { reason: row.reason || 'Post phiếu hủy' });
  if (mode === 'returns') return pharmacyOverviewAPI.postInventoryReturn(id, { reason: row.reason || 'Post phiếu hoàn' });
  return null;
}

export function PharmacyTransactionsCommandPage({ mode = 'center' }) {
  const config = PAGE_CONFIG[mode] || PAGE_CONFIG.center;
  const [filters, setFilters] = useState({ page: 1, limit: 25 });
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { loading, data, references, error, refresh } = useTransactionPageData(mode, filters);
  const rows = useMemo(() => getRows(mode, data), [mode, data]);
  const kpis = useMemo(() => getKpis(mode, data, rows), [mode, data, rows]);

  async function handleQuickAction(row) {
    const ok = confirmPharmacyAction({
      title: 'Post phiếu kho',
      message: `Xác nhận xử lý ${documentNo(row)}? Thao tác sẽ ghi nhận biến động tồn kho trên backend.`,
    });
    if (!ok) return;
    try {
      await runQuickAction(mode, row);
      notifyPharmacy({ tone: 'success', title: 'Post phiếu kho', message: `${documentNo(row)} đã được xử lý.` });
      refresh();
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Post phiếu kho', message: getApiErrorMessage(error, 'Không thể post phiếu.') });
    }
  }

  return (
    <section className="pharmacy-inventory-page pharmacy-transaction-page">
      <InventoryHeader
        config={config}
        onRefresh={refresh}
        onAction={() => setDialogOpen(true)}
        onExport={() => downloadPharmacyJson(`giao-dich-kho-${mode}.json`, { mode, filters, kpis, rows, data }, 'Xuất giao dịch kho')}
      />
      <KpiStrip cards={kpis} />
      {mode === 'center' ? (
        <>
          <WorkQueue data={data} onSelect={setSelected} />
          <AlertRail alerts={data?.alerts || []} />
        </>
      ) : (
        <InventoryFilters filters={filters} setFilters={setFilters} mode={mode} />
      )}
      <ErrorBanner error={error} />
      {loading ? <LoadingState /> : <TransactionTable mode={mode} rows={rows} onSelect={setSelected} onQuickAction={handleQuickAction} />}
      <DetailDrawer item={selected} mode={mode} onClose={() => setSelected(null)} />
      {dialogOpen ? (
        <OperationDialog
          mode={mode === 'center' ? 'receipts' : mode}
          references={references}
          onClose={() => setDialogOpen(false)}
          onDone={() => {
            setDialogOpen(false);
            refresh();
          }}
        />
      ) : null}
    </section>
  );
}
