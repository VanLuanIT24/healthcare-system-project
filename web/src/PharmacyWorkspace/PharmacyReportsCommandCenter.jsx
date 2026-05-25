import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  FileText,
  Layers3,
  PackageCheck,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  TimerOff,
  TrendingUp,
  TriangleAlert,
  WalletCards,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '../utils/api';
import { exportPharmacyReport, loadPharmacyReport } from './pharmacyApi';
import { notifyPharmacy, printPharmacyView } from './pharmacyActions';

const RANGE_OPTIONS = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'month', label: 'Tháng này' },
];

const REPORT_CONFIG = {
  dashboard: {
    title: 'Dashboard báo cáo dược',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược',
    description: 'Bức tranh vận hành kho dược, cấp phát, hạn dùng, giá trị tồn và các việc cần xử lý ngay.',
    icon: BarChart3,
  },
  inventoryOverview: {
    title: 'Tổng quan tồn kho',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Tồn kho',
    description: 'Theo dõi tồn theo thuốc, batch, hạn dùng, min-stock, giá trị và trạng thái lưu hành.',
    icon: Boxes,
  },
  stockMovement: {
    title: 'Nhập xuất tồn',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Nhập xuất tồn',
    description: 'Stock card theo thuốc: tồn đầu kỳ, nhập, xuất, trả, điều chỉnh, hao hụt và tồn cuối kỳ.',
    icon: ArrowLeftRight,
  },
  dispensing: {
    title: 'Thuốc cấp phát',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Cấp phát',
    description: 'Hiệu suất cấp phát theo phiếu, thuốc, trạng thái, dược sĩ, giá trị và hoàn trả.',
    icon: PackageCheck,
  },
  expiringStock: {
    title: 'Thuốc sắp hết hạn',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Lô & hạn dùng',
    description: 'Risk list theo FEFO, số ngày còn lại, giá trị rủi ro, vị trí, supplier và gợi ý xử lý.',
    icon: TimerOff,
  },
  lowStock: {
    title: 'Thuốc dưới tồn tối thiểu',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Reorder',
    description: 'Phát hiện thuốc thiếu, tồn bằng 0, nhu cầu chờ cấp phát và đề xuất nhập lại.',
    icon: TriangleAlert,
  },
  inventoryValuation: {
    title: 'Giá trị tồn kho',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Tài chính kho',
    description: 'Giá trị tồn theo thuốc, supplier, vị trí, trạng thái batch và Pareto 80/20.',
    icon: WalletCards,
  },
  highUsage: {
    title: 'Thuốc dùng nhiều',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Sử dụng thuốc',
    description: 'Xếp hạng thuốc cấp phát nhiều, tăng bất thường, ngày tồn còn lại và rủi ro thiếu hàng.',
    icon: TrendingUp,
  },
  wasteDisposal: {
    title: 'Hao hụt / hủy thuốc',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Hao hụt & hủy',
    description: 'Theo dõi hủy, hết hạn, recall, điều chỉnh âm, giá trị hao hụt và audit người thực hiện.',
    icon: RotateCcw,
  },
  exportHistory: {
    title: 'Xuất báo cáo / lịch sử export',
    crumb: 'Nhà thuốc & Kho dược / Báo cáo dược / Export',
    description: 'Audit các lần xuất báo cáo dược, định dạng, bộ lọc, người xuất và hạn tải.',
    icon: FileText,
  },
};

const KPI_CONFIG = {
  dashboard: [
    ['total_active_medications', 'Thuốc active', 'number', 'success'],
    ['total_batches', 'Tổng lô tồn kho', 'number', 'info'],
    ['inventory_value', 'Giá trị tồn', 'currency', 'purple'],
    ['low_stock_medication_count', 'Dưới min', 'number', 'warning'],
    ['out_of_stock_medication_count', 'Hết tồn', 'number', 'danger'],
    ['near_expiry_batch_count', 'Lô sắp hết hạn', 'number', 'warning'],
    ['dispense_count', 'Phiếu cấp phát', 'number', 'info'],
    ['estimated_waste_value', 'Giá trị hao hụt', 'currency', 'danger'],
  ],
  inventoryOverview: [
    ['total_medications', 'Tổng mã thuốc', 'number', 'info'],
    ['active_medications', 'Thuốc active', 'number', 'success'],
    ['total_batches', 'Tổng lô', 'number', 'info'],
    ['total_stock_on_hand', 'Tổng tồn', 'number', 'purple'],
    ['inventory_value', 'Giá trị tồn', 'currency', 'purple'],
    ['low_stock_medication_count', 'Dưới min', 'number', 'warning'],
    ['near_expiry_batches', 'Lô gần HSD', 'number', 'warning'],
    ['recalled_batches', 'Recall', 'number', 'danger'],
  ],
  stockMovement: [
    ['opening_quantity', 'Tồn đầu kỳ', 'number', 'info'],
    ['receipt_quantity', 'Tổng nhập', 'number', 'success'],
    ['dispense_quantity', 'Xuất cấp phát', 'number', 'warning'],
    ['return_quantity', 'Hoàn trả', 'number', 'success'],
    ['adjustment_in_quantity', 'Điều chỉnh +', 'number', 'info'],
    ['adjustment_out_quantity', 'Điều chỉnh -', 'number', 'danger'],
    ['waste_quantity', 'Hủy / hao hụt', 'number', 'danger'],
    ['closing_value', 'Giá trị cuối kỳ', 'currency', 'purple'],
  ],
  dispensing: [
    ['dispense_count', 'Tổng phiếu', 'number', 'info'],
    ['dispensed_count', 'Đã cấp', 'number', 'success'],
    ['partial_dispensed_count', 'Cấp một phần', 'number', 'warning'],
    ['cancelled_count', 'Đã hủy', 'number', 'danger'],
    ['returned_count', 'Hoàn trả', 'number', 'purple'],
    ['total_dispensed_quantity', 'SL cấp phát', 'number', 'info'],
    ['estimated_dispense_value', 'Giá trị cấp phát', 'currency', 'purple'],
    ['completion_rate', 'Tỷ lệ cấp đủ', 'percent', 'success'],
  ],
  expiringStock: [
    ['expiring_7_days', 'Trong 7 ngày', 'number', 'danger'],
    ['expiring_15_days', 'Trong 15 ngày', 'number', 'danger'],
    ['expiring_30_days', 'Trong 30 ngày', 'number', 'warning'],
    ['expiring_60_days', 'Trong 60 ngày', 'number', 'info'],
    ['expiring_90_days', 'Trong 90 ngày', 'number', 'info'],
    ['total_risk_quantity', 'SL rủi ro', 'number', 'warning'],
    ['total_risk_value', 'Giá trị rủi ro', 'currency', 'danger'],
  ],
  lowStock: [
    ['low_stock_count', 'Dưới min', 'number', 'warning'],
    ['out_of_stock_count', 'Hết tồn', 'number', 'danger'],
    ['critical_shortage_count', 'Thiếu critical', 'number', 'danger'],
    ['total_reorder_suggested_quantity', 'Đề xuất nhập', 'number', 'success'],
  ],
  inventoryValuation: [
    ['total_value', 'Tổng giá trị', 'currency', 'purple'],
    ['available_value', 'Available', 'currency', 'success'],
    ['near_expiry_value', 'Gần HSD', 'currency', 'warning'],
    ['expired_value', 'Hết hạn', 'currency', 'danger'],
    ['recalled_value', 'Recall', 'currency', 'danger'],
    ['depleted_value', 'Depleted', 'currency', 'muted'],
  ],
  highUsage: [
    ['total_dispensed_quantity', 'Tổng SL cấp', 'number', 'info'],
    ['total_dispense_value', 'Tổng giá trị', 'currency', 'purple'],
    ['medication_count', 'Số thuốc', 'number', 'success'],
    ['abnormal_increase_count', 'Tăng bất thường', 'number', 'danger'],
  ],
  wasteDisposal: [
    ['waste_transaction_count', 'Giao dịch hao hụt', 'number', 'danger'],
    ['waste_quantity', 'SL hao hụt', 'number', 'danger'],
    ['waste_value', 'Giá trị hao hụt', 'currency', 'danger'],
    ['expired_quantity', 'Hủy do hết hạn', 'number', 'warning'],
    ['recall_quantity', 'Recall', 'number', 'danger'],
    ['adjustment_out_quantity', 'Điều chỉnh âm', 'number', 'purple'],
  ],
  exportHistory: [],
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

function formatValue(value, type) {
  if (type === 'currency') return formatCurrency(value);
  if (type === 'percent') return `${formatNumber(value)}%`;
  return formatNumber(value);
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

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRows(view, data = {}) {
  if (view === 'inventoryValuation') return data.by_medication || data.items || [];
  if (view === 'dashboard') return data.urgent_worklist || [];
  return data.items || [];
}

function getSummary(view, data = {}) {
  if (view === 'dashboard') return data.summary || {};
  return data.summary || {};
}

function getTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (['critical', 'danger', 'expired', 'recalled', 'out', 'cancelled', 'waste', 'recall'].includes(normalized)) return 'danger';
  if (['high', 'warning', 'low', 'near_expiry', 'active', 'draft'].includes(normalized)) return 'warning';
  if (['medium', 'info', 'dispense', 'transfer', 'adjustment'].includes(normalized)) return 'info';
  if (['success', 'normal', 'available', 'dispensed', 'posted', 'resolved'].includes(normalized)) return 'success';
  if (['purple', 'partial', 'partially_dispensed'].includes(normalized)) return 'purple';
  return 'muted';
}

function StatusBadge({ value, label }) {
  return <span className={`pharmacy-report-badge is-${getTone(value)}`}>{label || value || '--'}</span>;
}

function SparkBars({ values = [] }) {
  const nums = values.map((value) => Math.max(Number(value || 0), 0));
  const max = Math.max(...nums, 1);
  return (
    <span className="pharmacy-report-spark" aria-hidden="true">
      {nums.slice(-12).map((value, index) => (
        <i key={`${value}-${index}`} style={{ height: `${Math.max((value / max) * 100, 12)}%` }} />
      ))}
    </span>
  );
}

function KpiGrid({ view, summary, trend = [], onSelectMetric }) {
  const items = KPI_CONFIG[view] || [];
  if (!items.length) return null;
  const trendValues = trend.map((item) => item.in_quantity || item.dispense_quantity || item.transaction_count || 0);
  return (
    <section className="pharmacy-report-kpis">
      {items.map(([key, label, type, tone]) => (
        <button key={key} type="button" className={`pharmacy-report-kpi is-${tone}`} onClick={() => onSelectMetric?.({ key, label, value: summary[key], type })}>
          <span>{label}</span>
          <strong>{formatValue(summary[key], type)}</strong>
          <em>{Number(summary[key] || 0) > 0 ? 'Có dữ liệu' : 'Chưa phát sinh'}</em>
          <SparkBars values={trendValues} />
        </button>
      ))}
    </section>
  );
}

function HorizontalBars({ title, rows = [], valueKey, labelKey = 'medication_name', format = 'number' }) {
  const max = Math.max(...rows.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <section className="pharmacy-report-panel">
      <header>
        <strong>{title}</strong>
        <span>{rows.length} dòng</span>
      </header>
      <div className="pharmacy-report-bars">
        {rows.slice(0, 8).map((item, index) => (
          <article key={`${item[labelKey] || item.medication_id || index}-${index}`}>
            <div>
              <strong>{item[labelKey] || item.medication_name || item.status || item.transaction_type || 'Không rõ'}</strong>
              <span>{formatValue(item[valueKey], format)}</span>
            </div>
            <i style={{ width: `${Math.max((Number(item[valueKey] || 0) / max) * 100, 4)}%` }} />
          </article>
        ))}
        {!rows.length ? <div className="pharmacy-report-empty-mini">Không có dữ liệu</div> : null}
      </div>
    </section>
  );
}

function TrendPanel({ rows = [] }) {
  const max = Math.max(...rows.map((item) => Math.max(item.in_quantity || 0, item.out_quantity || 0, item.dispense_quantity || 0)), 1);
  return (
    <section className="pharmacy-report-panel pharmacy-report-trend">
      <header>
        <strong>Nhập - xuất - cấp phát theo ngày</strong>
        <span>{rows.length} ngày</span>
      </header>
      <div>
        {rows.slice(-18).map((item) => (
          <article key={item.date}>
            <span>{item.date?.slice(5) || '--'}</span>
            <i className="is-in" style={{ height: `${Math.max(((item.in_quantity || item.receipt_quantity || 0) / max) * 100, 6)}%` }} />
            <i className="is-out" style={{ height: `${Math.max(((item.out_quantity || item.dispense_quantity || 0) / max) * 100, 6)}%` }} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="pharmacy-report-error">
      <AlertTriangle size={17} />
      <span>{error}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="pharmacy-report-state">
      <RefreshCw size={20} className="is-spinning" />
      <span>Đang tải báo cáo dược</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="pharmacy-report-state">
      <FileText size={20} />
      <span>Không có dữ liệu phù hợp bộ lọc.</span>
    </div>
  );
}

function ReportHeader({ view, filters, setFilters, loading, onRefresh, onExport, notice }) {
  const config = REPORT_CONFIG[view] || REPORT_CONFIG.dashboard;
  const Icon = config.icon;
  const canExport = view !== 'exportHistory';
  return (
    <header className="pharmacy-report-header">
      <div className="pharmacy-report-header__title">
        <span>{config.crumb}</span>
        <div>
          <span className="pharmacy-report-header__mark" aria-hidden="true"><Icon size={24} /></span>
          <h1>{config.title}</h1>
        </div>
        <p>{config.description}</p>
      </div>
      <div className="pharmacy-report-header__actions">
        <span className="pharmacy-report-sync"><CheckCircle2 size={15} /> Realtime aggregate</span>
        <button type="button" className="pharmacy-report-icon-button" aria-label="Refresh realtime" onClick={onRefresh}>
          <RefreshCw size={18} className={loading ? 'is-spinning' : ''} />
        </button>
        {canExport ? (
          <>
            <button type="button" className="pharmacy-report-button is-secondary" onClick={() => onExport('csv')}>
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button type="button" className="pharmacy-report-button is-secondary" onClick={() => onExport('json')}>
              <FileJson size={16} /> JSON
            </button>
            <button type="button" className="pharmacy-report-button is-secondary" onClick={() => printPharmacyView('In báo cáo dược')}>
              <Printer size={16} /> In
            </button>
          </>
        ) : null}
        {notice ? <span className="pharmacy-report-notice">{notice}</span> : null}
      </div>
      <div className="pharmacy-report-filters">
        <div className="pharmacy-report-range" role="group" aria-label="Khoảng thời gian">
          {RANGE_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filters.range === item.key && !filters.date ? 'is-active' : ''}
              onClick={() => setFilters((current) => ({ ...current, range: item.key, date: '', page: 1 }))}
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
            aria-label="Ngày báo cáo"
            onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value, page: 1 }))}
          />
        </label>
        <label className="is-wide">
          <Search size={15} aria-hidden="true" />
          <input
            value={filters.search || ''}
            placeholder="Tìm thuốc, batch, supplier"
            aria-label="Tìm thuốc, batch, supplier"
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
          />
        </label>
        <label>
          <TimerOff size={15} aria-hidden="true" />
          <select
            value={filters.nearExpiryDays}
            aria-label="Ngưỡng hạn dùng"
            onChange={(event) => setFilters((current) => ({ ...current, nearExpiryDays: event.target.value, page: 1 }))}
          >
            <option value="7">7 ngày</option>
            <option value="15">15 ngày</option>
            <option value="30">30 ngày</option>
            <option value="60">60 ngày</option>
            <option value="90">90 ngày</option>
            <option value="180">180 ngày</option>
          </select>
        </label>
        {view === 'highUsage' ? (
          <label>
            <Activity size={15} aria-hidden="true" />
            <select
              value={filters.groupBy}
              aria-label="Xếp hạng thuốc dùng nhiều"
              onChange={(event) => setFilters((current) => ({ ...current, groupBy: event.target.value, page: 1 }))}
            >
              <option value="quantity">Theo số lượng</option>
              <option value="value">Theo giá trị</option>
              <option value="prescription_count">Theo số đơn</option>
              <option value="patient_count">Theo số BN</option>
            </select>
          </label>
        ) : null}
      </div>
    </header>
  );
}

function buildColumns(view) {
  const columns = {
    dashboard: [
      ['severity', 'Mức độ', (row) => <StatusBadge value={row.severity} label={row.severity || '--'} />],
      ['issue', 'Vấn đề', (row) => <strong>{row.issue || row.issue_type || '--'}</strong>],
      ['medication_name', 'Thuốc', (row) => <span>{row.medication_name || '--'}<small>{row.batch_no || row.medication_code || ''}</small></span>],
      ['quantity', 'Số lượng', (row) => formatNumber(row.quantity)],
      ['value', 'Giá trị', (row) => row.value ? formatCurrency(row.value) : '--'],
      ['due_date', 'Hạn / thời điểm', (row) => row.days_to_expiry !== undefined ? `${row.days_to_expiry} ngày` : formatDate(row.due_date)],
      ['suggested_action', 'Gợi ý xử lý', (row) => row.suggested_action || '--'],
    ],
    inventoryOverview: [
      ['medication_name', 'Thuốc', (row) => <strong>{row.medication_name}<small>{row.medication_code}</small></strong>],
      ['generic_name', 'Hoạt chất', (row) => row.generic_name || '--'],
      ['form', 'Dạng / hàm lượng', (row) => <span>{row.dosage_form || '--'}<small>{row.strength || row.route_default || ''}</small></span>],
      ['total_on_hand', 'Tổng tồn', (row) => formatNumber(row.total_on_hand)],
      ['min_stock_level', 'Min', (row) => formatNumber(row.min_stock_level)],
      ['batch_count', 'Số lô', (row) => formatNumber(row.batch_count)],
      ['near_expiry_batch_count', 'Gần HSD', (row) => formatNumber(row.near_expiry_batch_count)],
      ['inventory_value', 'Giá trị', (row) => formatCurrency(row.inventory_value)],
      ['stock_status', 'Trạng thái', (row) => <StatusBadge value={row.stock_status} />],
    ],
    stockMovement: [
      ['medication_name', 'Thuốc', (row) => <strong>{row.medication_name}<small>{row.unit || row.medication_code}</small></strong>],
      ['opening_quantity', 'Tồn đầu', (row) => formatNumber(row.opening_quantity)],
      ['receipt_quantity', 'Nhập', (row) => formatNumber(row.receipt_quantity)],
      ['dispense_quantity', 'Xuất', (row) => formatNumber(row.dispense_quantity)],
      ['return_quantity', 'Trả', (row) => formatNumber(row.return_quantity)],
      ['adjustment', 'Điều chỉnh', (row) => <span>+{formatNumber(row.adjustment_in_quantity)}<small>-{formatNumber(row.adjustment_out_quantity)}</small></span>],
      ['waste_quantity', 'Hủy', (row) => formatNumber(row.waste_quantity)],
      ['closing_quantity', 'Tồn cuối', (row) => formatNumber(row.closing_quantity)],
      ['closing_value', 'Giá trị cuối', (row) => formatCurrency(row.closing_value)],
    ],
    dispensing: [
      ['dispense_no', 'Phiếu cấp', (row) => <strong>{row.dispense_no}<small>{row.prescription_no || ''}</small></strong>],
      ['patient_name', 'Bệnh nhân', (row) => <span>{row.patient_name || '--'}<small>{row.patient_code || row.encounter_id || ''}</small></span>],
      ['status', 'Trạng thái', (row) => <StatusBadge value={row.status} />],
      ['line_count', 'Dòng', (row) => formatNumber(row.line_count)],
      ['total_quantity', 'SL thuốc', (row) => formatNumber(row.total_quantity)],
      ['estimated_value', 'Giá trị', (row) => formatCurrency(row.estimated_value)],
      ['pharmacist_name', 'Dược sĩ', (row) => row.pharmacist_name || '--'],
      ['dispensed_at', 'Thời gian', (row) => formatDateTime(row.dispensed_at)],
    ],
    expiringStock: [
      ['severity', 'Mức độ', (row) => <StatusBadge value={row.severity} />],
      ['medication_name', 'Thuốc', (row) => <strong>{row.medication_name}<small>{row.medication_code}</small></strong>],
      ['batch_no', 'Batch / lot', (row) => <span>{row.batch_no}<small>{row.lot_no || ''}</small></span>],
      ['supplier_name', 'Nhà cung cấp', (row) => row.supplier_name || '--'],
      ['storage_location', 'Vị trí', (row) => row.storage_location || '--'],
      ['quantity_on_hand', 'Tồn', (row) => formatNumber(row.quantity_on_hand)],
      ['risk_value', 'Giá trị rủi ro', (row) => formatCurrency(row.risk_value)],
      ['expiry_date', 'HSD', (row) => <span>{formatDate(row.expiry_date)}<small>{row.days_to_expiry} ngày</small></span>],
      ['suggested_action', 'Đề xuất', (row) => row.suggested_action],
    ],
    lowStock: [
      ['severity', 'Mức độ', (row) => <StatusBadge value={row.severity} />],
      ['medication_name', 'Thuốc', (row) => <strong>{row.medication_name}<small>{row.medication_code}</small></strong>],
      ['current_on_hand', 'Tồn', (row) => formatNumber(row.current_on_hand)],
      ['min_stock_level', 'Min', (row) => formatNumber(row.min_stock_level)],
      ['shortage_quantity', 'Thiếu', (row) => formatNumber(row.shortage_quantity)],
      ['pending_dispense_quantity', 'Chờ cấp', (row) => formatNumber(row.pending_dispense_quantity)],
      ['avg_daily_usage_30d', 'Dùng/ngày', (row) => formatNumber(row.avg_daily_usage_30d)],
      ['days_of_stock_remaining', 'Ngày còn lại', (row) => row.days_of_stock_remaining ?? '--'],
      ['suggested_reorder_quantity', 'Đề xuất nhập', (row) => formatNumber(row.suggested_reorder_quantity)],
    ],
    inventoryValuation: [
      ['medication_name', 'Thuốc', (row) => <strong>{row.medication_name}<small>{row.medication_code}</small></strong>],
      ['total_on_hand', 'Tổng tồn', (row) => formatNumber(row.total_on_hand)],
      ['average_unit_cost', 'Đơn giá TB', (row) => formatCurrency(row.average_unit_cost)],
      ['inventory_value', 'Giá trị', (row) => formatCurrency(row.inventory_value)],
      ['total_value_percent', '% tổng', (row) => `${formatNumber(row.total_value_percent)}%`],
      ['batch_count', 'Số lô', (row) => formatNumber(row.batch_count)],
      ['near_expiry_batch_count', 'Gần HSD', (row) => formatNumber(row.near_expiry_batch_count)],
      ['expired_batch_count', 'Hết hạn', (row) => formatNumber(row.expired_batch_count)],
      ['recalled_batch_count', 'Recall', (row) => formatNumber(row.recalled_batch_count)],
    ],
    highUsage: [
      ['rank', 'Hạng', (row) => <strong>#{row.rank}</strong>],
      ['medication_name', 'Thuốc', (row) => <strong>{row.medication_name}<small>{row.medication_code}</small></strong>],
      ['dispensed_quantity', 'SL cấp', (row) => formatNumber(row.dispensed_quantity)],
      ['dispense_count', 'Phiếu', (row) => formatNumber(row.dispense_count)],
      ['patient_count', 'BN', (row) => formatNumber(row.patient_count)],
      ['estimated_value', 'Giá trị', (row) => formatCurrency(row.estimated_value)],
      ['current_on_hand', 'Tồn hiện tại', (row) => formatNumber(row.current_on_hand)],
      ['days_remaining', 'Ngày tồn', (row) => row.days_remaining ?? '--'],
      ['trend_percent', 'Xu hướng', (row) => <StatusBadge value={row.trend_percent >= 80 ? 'danger' : 'success'} label={`${formatNumber(row.trend_percent)}%`} />],
    ],
    wasteDisposal: [
      ['occurred_at', 'Ngày', (row) => formatDateTime(row.occurred_at)],
      ['transaction_type', 'Loại', (row) => <StatusBadge value={row.transaction_type} />],
      ['medication_name', 'Thuốc', (row) => <strong>{row.medication_name}<small>{row.medication_code}</small></strong>],
      ['batch_no', 'Batch', (row) => <span>{row.batch_no || '--'}<small>{row.lot_no || ''}</small></span>],
      ['quantity', 'SL', (row) => formatNumber(row.quantity)],
      ['value', 'Giá trị', (row) => formatCurrency(row.value)],
      ['reason_code', 'Lý do', (row) => row.reason_code || row.note || '--'],
      ['performed_by', 'Người thực hiện', (row) => row.performed_by || '--'],
      ['severity', 'Mức độ', (row) => <StatusBadge value={row.severity} />],
    ],
    exportHistory: [
      ['report_type', 'Loại báo cáo', (row) => <strong>{row.report_type || '--'}</strong>],
      ['exported_by', 'Người xuất', (row) => row.exported_by || '--'],
      ['exported_at', 'Thời gian', (row) => formatDateTime(row.exported_at)],
      ['format', 'Định dạng', (row) => <StatusBadge value="info" label={String(row.format || '--').toUpperCase()} />],
      ['status', 'Trạng thái', (row) => <StatusBadge value={row.status} />],
      ['expires_at', 'Hết hạn tải', (row) => formatDate(row.expires_at)],
    ],
  };
  return columns[view] || columns.dashboard;
}

function ReportTable({ view, rows, onSelect }) {
  const columns = buildColumns(view);
  if (!rows.length) return <EmptyState />;
  return (
    <section className="pharmacy-report-table-wrap">
      <table className="pharmacy-report-table">
        <thead>
          <tr>
            {columns.map(([key, label]) => <th key={key}>{label}</th>)}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.export_id || row.transaction_id || row.dispense_id || row.batch_id || row.medication_id || rowIndex}>
              {columns.map(([key, , render]) => (
                <td key={key}>{render(row)}</td>
              ))}
              <td>
                <button type="button" className="pharmacy-report-row-action" aria-label="Xem chi tiết" onClick={() => onSelect(row)}>
                  <Eye size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DashboardInsights({ data = {} }) {
  const trend = data.trends?.inventory_movement_by_day || [];
  const topLists = data.top_lists || {};
  return (
    <section className="pharmacy-report-dashboard-grid">
      <TrendPanel rows={trend} />
      <HorizontalBars title="Top thuốc cấp phát nhiều" rows={topLists.top_dispensed_medications || []} valueKey="dispensed_quantity" />
      <HorizontalBars title="Top giá trị tồn kho" rows={topLists.top_inventory_value || []} valueKey="inventory_value" format="currency" />
      <HorizontalBars title="Top lô sắp hết hạn theo giá trị" rows={topLists.top_near_expiry_by_value || []} valueKey="risk_value" labelKey="batch_no" format="currency" />
    </section>
  );
}

function ReportInsights({ view, data = {} }) {
  if (view === 'dashboard') return <DashboardInsights data={data} />;
  if (view === 'stockMovement') return <TrendPanel rows={data.trends?.inventory_movement_by_day || []} />;
  if (view === 'dispensing') {
    return (
      <section className="pharmacy-report-dashboard-grid is-two">
        <HorizontalBars title="Cấp phát theo thuốc" rows={data.breakdowns?.by_medication || []} valueKey="total_dispensed_quantity" />
        <HorizontalBars title="Cấp phát theo dược sĩ" rows={data.breakdowns?.by_pharmacist || []} valueKey="count" labelKey="pharmacist_name" />
      </section>
    );
  }
  if (view === 'inventoryValuation') {
    return (
      <section className="pharmacy-report-dashboard-grid is-three">
        <HorizontalBars title="Theo supplier" rows={data.by_supplier || []} valueKey="value" labelKey="supplier_name" format="currency" />
        <HorizontalBars title="Theo vị trí" rows={data.by_storage_location || []} valueKey="value" labelKey="storage_location" format="currency" />
        <HorizontalBars title="Theo trạng thái batch" rows={data.by_batch_status || []} valueKey="value" labelKey="status" format="currency" />
      </section>
    );
  }
  if (view === 'wasteDisposal') {
    return (
      <section className="pharmacy-report-dashboard-grid is-two">
        <HorizontalBars title="Hao hụt theo loại" rows={data.breakdowns?.by_type || []} valueKey="value" labelKey="transaction_type" format="currency" />
        <HorizontalBars title="Top thuốc hao hụt" rows={data.breakdowns?.by_medication || []} valueKey="value" format="currency" />
      </section>
    );
  }
  return null;
}

function ReportDrawer({ row, onClose }) {
  if (!row) return null;
  const entries = Object.entries(row).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object');
  return (
    <aside className="pharmacy-report-drawer" aria-label="Chi tiết dòng báo cáo">
      <header>
        <div>
          <span>Chi tiết báo cáo</span>
          <strong>{row.medication_name || row.dispense_no || row.batch_no || row.report_type || row.issue || 'Dòng dữ liệu'}</strong>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <section>
        <div className="pharmacy-report-keygrid">
          {entries.slice(0, 24).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </div>
        {Array.isArray(row.items) && row.items.length ? (
          <div className="pharmacy-report-drawer-list">
            <strong>Dòng thuốc liên quan</strong>
            {row.items.slice(0, 10).map((item, index) => (
              <article key={item._id || index}>
                <span>{item.medication_id?.brand_name || item.medication_id?.generic_name || item.medication_id?.medication_code || 'Thuốc'}</span>
                <em>{formatNumber(item.quantity)} {item.unit || item.medication_id?.unit || ''}</em>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </aside>
  );
}

export function PharmacyReportsCommandCenterPage({ view = 'dashboard' }) {
  const [filters, setFilters] = useState({
    range: '30d',
    date: '',
    search: '',
    nearExpiryDays: '30',
    groupBy: 'quantity',
    page: 1,
    limit: 30,
  });
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [selectedRow, setSelectedRow] = useState(null);
  const [notice, setNotice] = useState('');
  const config = REPORT_CONFIG[view] || REPORT_CONFIG.dashboard;
  const summary = getSummary(view, state.data || {});
  const rows = getRows(view, state.data || {});
  const trend = state.data?.trends?.inventory_movement_by_day || state.data?.trends?.dispense_by_day || [];

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await loadPharmacyReport(view, filters);
      setState({ loading: false, data, error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: getApiErrorMessage(error, 'Không thể tải báo cáo dược.') });
    }
  }

  async function handleExport(format) {
    try {
      const payload = await exportPharmacyReport(view, format, filters);
      if (payload?.content) {
        const blob = new Blob([payload.content], { type: payload.content_type || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = payload.filename || `pharmacy-report.${format}`;
        link.click();
        URL.revokeObjectURL(url);
      }
      setNotice(format === 'csv' ? 'Đã xuất Excel' : 'Đã xuất JSON');
      notifyPharmacy({ tone: 'success', title: 'Xuất báo cáo dược', message: format === 'csv' ? 'Đã xuất Excel.' : 'Đã xuất JSON.' });
      window.setTimeout(() => setNotice(''), 2800);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không thể export báo cáo.');
      setNotice(message);
      notifyPharmacy({ tone: 'danger', title: 'Xuất báo cáo dược', message });
      window.setTimeout(() => setNotice(''), 3600);
    }
  }

  useEffect(() => {
    setSelectedRow(null);
    refresh();
  }, [view, filterKey]);

  return (
    <section className="pharmacy-report-page">
      <ReportHeader
        view={view}
        filters={filters}
        setFilters={setFilters}
        loading={state.loading}
        onRefresh={refresh}
        onExport={handleExport}
        notice={notice}
      />

      <ErrorBanner error={state.error} />
      {state.loading ? <LoadingState /> : null}

      {!state.loading && !state.error ? (
        <>
          <KpiGrid
            view={view}
            summary={summary}
            trend={trend}
            onSelectMetric={(metric) => {
              const message = `${metric.label}: ${formatValue(metric.value, metric.type)}. Bảng bên dưới đang theo cùng bộ lọc báo cáo.`;
              setNotice(message);
              notifyPharmacy({ title: 'KPI báo cáo dược', message });
              window.setTimeout(() => setNotice(''), 2800);
            }}
          />
          <ReportInsights view={view} data={state.data || {}} />
          <section className="pharmacy-report-panel">
            <header>
              <strong>{view === 'dashboard' ? 'Cần xử lý ngay' : config.title}</strong>
              <span>{formatNumber(rows.length)} dòng</span>
            </header>
            <ReportTable view={view} rows={rows} onSelect={setSelectedRow} />
          </section>
        </>
      ) : null}

      <ReportDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </section>
  );
}
