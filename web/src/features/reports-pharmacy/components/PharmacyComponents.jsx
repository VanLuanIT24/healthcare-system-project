import { useEffect, useState } from 'react';
import { AlertTriangle, Archive, Clock3, Download, PackageCheck, RefreshCw, Search, X } from 'lucide-react';
import {
  DataErrorStrip,
  ExecutiveKpiCard,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
} from '../../reports-overview/components/ExecutiveOverviewComponents';
import { formatCurrency, formatDateTime, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import { reportsPharmacyApi } from '../api/reportsPharmacyApi';
import { abcClass, pharmacyStatusLabel, pharmacyTone } from '../utils/pharmacyFormatters';

export { DataErrorStrip, ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton };

function unitForKey(key = '') {
  if (key.includes('value') || key.includes('amount') || key.includes('cost')) return 'currency';
  if (key.includes('rate') || key.includes('percent')) return 'percent';
  return 'number';
}

export function summaryCards(summary = {}, labels = {}) {
  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: safeNumber(summary?.[key]),
    unit: unitForKey(key),
    status: key.includes('expired') || key.includes('recalled') || key.includes('out_of_stock') || key.includes('waste') ? (safeNumber(summary?.[key]) ? 'danger' : 'good') : 'neutral',
  }));
}

export function PharmacyFilterBar({ title, subtitle, filters, onChange, onReset, onRefresh, isRefreshing, lastUpdatedAt, reportType, onHistory }) {
  const [advanced, setAdvanced] = useState(false);
  const update = (field, value) => onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '' } : {}) });
  return (
    <div className="operation-header pharmacy-header">
      <div>
        <span>Nhà thuốc & Kho dược</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="operation-header__tools">
        {['today', '7d', '30d', 'month', 'quarter', 'custom'].map((range) => (
          <button key={range} type="button" className={filters.range === range ? 'is-active' : ''} onClick={() => update('range', range)}>
            {({ today: 'Hôm nay', '7d': '7 ngày', '30d': '30 ngày', month: 'Tháng này', quarter: 'Quý này', custom: 'Custom' })[range]}
          </button>
        ))}
        {filters.range === 'custom' ? (
          <>
            <input type="date" value={filters.date_from || ''} onChange={(event) => update('date_from', event.target.value)} />
            <input type="date" value={filters.date_to || ''} onChange={(event) => update('date_to', event.target.value)} />
          </>
        ) : null}
        <input value={filters.search || ''} onChange={(event) => update('search', event.target.value)} placeholder="Tìm thuốc/batch" />
        {advanced ? (
          <>
            <input value={filters.warehouse_id || ''} onChange={(event) => update('warehouse_id', event.target.value)} placeholder="Kho" />
            <input value={filters.storage_location || ''} onChange={(event) => update('storage_location', event.target.value)} placeholder="Vị trí" />
            <input value={filters.supplier || ''} onChange={(event) => update('supplier', event.target.value)} placeholder="Nhà cung cấp" />
            <select value={filters.batch_status || ''} onChange={(event) => update('batch_status', event.target.value)}>
              <option value="">Tất cả batch</option>
              <option value="available">Available</option>
              <option value="quarantined">Quarantined</option>
              <option value="expired">Expired</option>
              <option value="recalled">Recalled</option>
              <option value="depleted">Depleted</option>
            </select>
            <select value={filters.transaction_type || ''} onChange={(event) => update('transaction_type', event.target.value)}>
              <option value="">Tất cả transaction</option>
              <option value="receipt">Receipt</option>
              <option value="dispense">Dispense</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
              <option value="transfer">Transfer</option>
              <option value="waste">Waste</option>
              <option value="expire">Expire</option>
              <option value="recall">Recall</option>
            </select>
          </>
        ) : null}
        {['low_stock', 'out_of_stock', 'expired', 'recalled', 'quarantined', 'high_usage'].map((chip) => (
          <button key={chip} type="button" className={filters.quick === chip ? 'is-active' : ''} onClick={() => onChange({ quick: filters.quick === chip ? '' : chip, batch_status: ['expired', 'recalled', 'quarantined'].includes(chip) ? chip : filters.batch_status })}>{chip.replaceAll('_', ' ')}</button>
        ))}
        <label className="pharmacy-toggle"><input type="checkbox" checked={Boolean(filters.auto_refresh)} onChange={(event) => update('auto_refresh', event.target.checked)} />Auto refresh</label>
        <button type="button" onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Ẩn lọc nâng cao' : 'Lọc nâng cao'}</button>
        <button type="button" onClick={onReset}>Reset bộ lọc</button>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} />Refresh</button>
        <ExportReportButton filters={filters} reportType={reportType} />
        <button type="button" onClick={onHistory}><Archive size={15} />Lịch sử export</button>
        <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export function ExportReportButton({ filters, reportType = 'dashboard' }) {
  const [state, setState] = useState('idle');
  async function handleExport(format) {
    setState('loading');
    try {
      const result = await reportsPharmacyApi.exportReport({ ...filters, report_type: reportType, type: reportType, format });
      const content = format === 'csv' ? result?.content : JSON.stringify(result?.data || result, null, 2);
      const blob = new Blob([content || ''], { type: result?.content_type || (format === 'csv' ? 'text/csv' : 'application/json') });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result?.filename || `pharmacy_${reportType}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setState('done');
      window.setTimeout(() => setState('idle'), 1400);
    } catch (error) {
      setState('error');
      window.setTimeout(() => setState('idle'), 1800);
    }
  }
  return (
    <div className="executive-export">
      <button type="button" className="executive-button" onClick={() => handleExport('csv')} disabled={state === 'loading'}><Download size={16} />{state === 'loading' ? 'Đang export' : state === 'error' ? 'Export lỗi' : 'CSV'}</button>
      <button type="button" className="executive-button executive-button--soft" onClick={() => handleExport('json')} disabled={state === 'loading'}>JSON</button>
    </div>
  );
}

export function PharmacyKpiGrid({ cards = [], onOpen }) {
  return <div className="executive-kpi-grid pharmacy-kpi-grid">{cards.map((card, index) => <ExecutiveKpiCard key={card.key || card.label} card={card} index={index} onClick={() => onOpen?.(card, 'KPI kho dược')} />)}</div>;
}

export const PharmacyKpiCard = ExecutiveKpiCard;

export function PharmacyStatusBadge({ status }) {
  return <span className={`executive-badge status-${pharmacyTone(status)}`}>{pharmacyStatusLabel(status)}</span>;
}

export const StockRiskBadge = PharmacyStatusBadge;
export const ExpiryRiskBadge = PharmacyStatusBadge;
export const LowStockSeverityBadge = PharmacyStatusBadge;

export function PharmacyTrendChart({ rows = [], type = 'bar', series }) {
  return <TrendChart data={rows || []} type={type} series={series} />;
}

export const InventoryMovementChart = ({ rows = [] }) => <TrendChart data={rows} series={[{ key: 'receipt_quantity', label: 'Nhập' }, { key: 'dispense_quantity', label: 'Cấp phát' }, { key: 'waste_quantity', label: 'Hủy/hao hụt' }]} />;
export const BatchStatusDonut = ({ rows = [] }) => <TrendChart data={rows} type="donut" />;
export const DispenseStatusDonut = ({ rows = [] }) => <TrendChart data={rows} type="donut" />;

export function PharmacyHealthScore({ data = {} }) {
  const summary = data.summary || {};
  const rows = [
    { key: 'stock', label: 'Stock health', score: Math.max(0, 100 - safeNumber(summary.low_stock_medication_count || summary.low_stock_count) * 5 - safeNumber(summary.out_of_stock_medication_count || summary.out_of_stock_count) * 10) },
    { key: 'expiry', label: 'Expiry risk', score: Math.max(0, 100 - safeNumber(summary.near_expiry_batch_count || summary.expiring_30_days) * 4 - safeNumber(summary.expired_batch_count || summary.expired_batch_count) * 10) },
    { key: 'dispense', label: 'Dispense health', score: safeNumber(summary.completion_rate || 85) },
    { key: 'value', label: 'Value control', score: safeNumber(summary.estimated_waste_value || summary.waste_value) ? 72 : 92 },
  ];
  return (
    <div className="pharmacy-health-grid">
      {rows.map((row) => <article key={row.key} className={row.score < 70 ? 'status-danger' : row.score < 85 ? 'status-warning' : 'status-good'}><span>{row.label}</span><strong>{formatPercent(row.score)}</strong><div><i style={{ width: `${Math.min(100, row.score)}%` }} /></div></article>)}
    </div>
  );
}

export function PharmacyDataTable({ rows = [], columns = [], onRowClick }) {
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });
  const sorted = [...(rows || [])].sort((left, right) => {
    const a = left?.[sort.key] ?? '';
    const b = right?.[sort.key] ?? '';
    return sort.direction === 'asc' ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
  });
  if (!rows?.length) return <ReportEmptyState title="Chưa có dữ liệu bảng" />;
  return (
    <div className="pharmacy-table-wrap">
      <table className="executive-table pharmacy-table">
        <thead><tr>{columns.map((column) => <th key={column.key} className={column.money ? 'is-money' : ''}><button type="button" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>{column.label}</button></th>)}</tr></thead>
        <tbody>{sorted.map((row, index) => <tr key={row.medication_id || row.batch_id || row.transaction_id || row.dispense_id || row.prescription_id || index} onClick={() => onRowClick?.(row)}>{columns.map((column) => <td key={column.key} className={column.money ? 'is-money' : ''}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export const MedicationTable = ({ rows, onOpen }) => <PharmacyDataTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'medication_code', label: 'Mã thuốc' },
  { key: 'medication_name', label: 'Tên thuốc' },
  { key: 'dosage_form', label: 'Dạng' },
  { key: 'unit', label: 'Đơn vị' },
  { key: 'total_on_hand', label: 'Tồn', render: (row) => formatNumber(row.total_on_hand ?? row.current_on_hand) },
  { key: 'min_stock_level', label: 'Min', render: (row) => formatNumber(row.min_stock_level) },
  { key: 'inventory_value', label: 'Giá trị', money: true, render: (row) => formatCurrency(row.inventory_value) },
  { key: 'stock_status', label: 'Trạng thái', render: (row) => <PharmacyStatusBadge status={row.stock_status || row.status || row.severity} /> },
]} />;

export const StockBatchTable = ({ rows, onOpen }) => <PharmacyDataTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'batch_no', label: 'Batch no' },
  { key: 'medication_name', label: 'Thuốc' },
  { key: 'lot_no', label: 'Lot' },
  { key: 'supplier_name', label: 'Supplier' },
  { key: 'quantity_on_hand', label: 'Tồn', render: (row) => formatNumber(row.quantity_on_hand) },
  { key: 'unit_cost', label: 'Unit cost', money: true, render: (row) => formatCurrency(row.unit_cost) },
  { key: 'risk_value', label: 'Risk value', money: true, render: (row) => formatCurrency(row.risk_value || row.value_impact) },
  { key: 'expiry_date', label: 'Hạn dùng', render: (row) => formatDateTime(row.expiry_date) },
  { key: 'status', label: 'Trạng thái', render: (row) => <PharmacyStatusBadge status={row.status || row.severity} /> },
]} />;

export const InventoryTransactionTable = ({ rows, onOpen }) => <PharmacyDataTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'transaction_no', label: 'Transaction no' },
  { key: 'medication_name', label: 'Thuốc' },
  { key: 'batch_no', label: 'Batch' },
  { key: 'transaction_type', label: 'Type', render: (row) => <PharmacyStatusBadge status={row.transaction_type} /> },
  { key: 'direction', label: 'Direction', render: (row) => <PharmacyStatusBadge status={row.direction} /> },
  { key: 'quantity', label: 'Số lượng', render: (row) => formatNumber(row.quantity) },
  { key: 'value', label: 'Giá trị', money: true, render: (row) => formatCurrency(row.value || row.quantity * row.unit_cost) },
  { key: 'occurred_at', label: 'Thời điểm', render: (row) => formatDateTime(row.occurred_at) },
]} />;

export const DispenseTable = ({ rows, onOpen }) => <PharmacyDataTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'dispense_no', label: 'Dispense no' },
  { key: 'prescription_no', label: 'Prescription' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'status', label: 'Trạng thái', render: (row) => <PharmacyStatusBadge status={row.status} /> },
  { key: 'line_count', label: 'Dòng', render: (row) => formatNumber(row.line_count) },
  { key: 'total_quantity', label: 'Số lượng', render: (row) => formatNumber(row.total_quantity) },
  { key: 'estimated_value', label: 'Giá trị', money: true, render: (row) => formatCurrency(row.estimated_value) },
  { key: 'pharmacist_name', label: 'Dược sĩ' },
  { key: 'dispensed_at', label: 'Cấp phát lúc', render: (row) => formatDateTime(row.dispensed_at) },
]} />;

export const PrescriptionTable = ({ rows, onOpen }) => <PharmacyDataTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'prescription_no', label: 'Prescription no' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'doctor_name', label: 'Bác sĩ' },
  { key: 'status', label: 'Trạng thái', render: (row) => <PharmacyStatusBadge status={row.status} /> },
  { key: 'prescribed_at', label: 'Kê lúc', render: (row) => formatDateTime(row.prescribed_at) },
  { key: 'item_count', label: 'Dòng thuốc', render: (row) => formatNumber(row.item_count) },
  { key: 'dispense_status', label: 'Cấp phát', render: (row) => <PharmacyStatusBadge status={row.dispense_status} /> },
]} />;

export const PharmacyAlertTable = ({ rows, onOpen }) => <PharmacyDataTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'title', label: 'Cảnh báo' },
  { key: 'severity', label: 'Mức', render: (row) => <PharmacyStatusBadge status={row.severity} /> },
  { key: 'medication_name', label: 'Thuốc' },
  { key: 'suggested_action', label: 'Gợi ý' },
]} />;

export function UrgentPharmacyWorklist({ rows = [], onOpen }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có việc dược khẩn" compact />;
  return <div className="pharmacy-worklist">{rows.slice(0, 10).map((row, index) => <button key={row.id || index} type="button" className={`status-${pharmacyTone(row.severity || row.status)}`} onClick={() => onOpen?.(row, 'Việc dược khẩn')}><AlertTriangle size={16} /><span>{row.title || row.medication_name || row.batch_no}</span><strong>{row.suggested_action || row.action || 'Xem chi tiết'}</strong></button>)}</div>;
}

export function PharmacyDetailDrawer({ item, type = 'Chi tiết dược', onClose }) {
  if (!item) return null;
  return (
    <aside className="operation-drawer" aria-label="Chi tiết dược">
      <div className="operation-drawer__panel pharmacy-drawer">
        <header><div><span>{type}</span><h2>{item.medication_name || item.batch_no || item.transaction_no || item.dispense_no || item.prescription_no || item.title || 'Chi tiết'}</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header>
        <div className="pharmacy-timeline"><div><PackageCheck size={15} /><span>Status</span><strong>{pharmacyStatusLabel(item.status || item.severity || item.stock_status)}</strong></div><div><Clock3 size={15} /><span>Cập nhật</span><strong>{formatDateTime(item.updated_at || item.occurred_at || item.dispensed_at || item.prescribed_at)}</strong></div><div><Search size={15} /><span>Action</span><strong>{item.suggested_action || 'Mở module liên quan'}</strong></div></div>
        <div className="operation-drawer__body">{Object.entries(item).slice(0, 36).map(([key, value]) => <div key={key}><span>{key}</span><strong>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</strong></div>)}</div>
        <footer><button type="button">Mở module liên quan</button><button type="button">Xem timeline</button><button type="button">Export dòng này</button></footer>
      </div>
    </aside>
  );
}

export const MedicationDetailDrawer = PharmacyDetailDrawer;
export const StockBatchDrawer = PharmacyDetailDrawer;
export const TransactionDrawer = PharmacyDetailDrawer;
export const DispenseDrawer = PharmacyDetailDrawer;
export const PrescriptionDrawer = PharmacyDetailDrawer;
export const AlertDrawer = PharmacyDetailDrawer;

export function ExportHistoryDrawer({ open, onClose, filters }) {
  const [history, setHistory] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    reportsPharmacyApi.exportHistory(filters).then((result) => { if (alive) setHistory(result); }).catch(() => { if (alive) setHistory({ items: [] }); });
    return () => { alive = false; };
  }, [open, filters]);
  if (!open) return null;
  return (
    <aside className="operation-drawer">
      <div className="operation-drawer__panel pharmacy-drawer">
        <header><div><span>Export history</span><h2>Lịch sử xuất báo cáo dược</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header>
        <div className="operation-drawer__body">{(history?.items || []).map((item) => <div key={item.export_id}><span>{item.report_type} / {item.format}</span><strong>{item.exported_by} - {formatDateTime(item.exported_at)}</strong></div>)}</div>
      </div>
    </aside>
  );
}

export function PharmacyInsightGrid({ insights = [] }) {
  if (!insights.length) return null;
  return <div className="pharmacy-insight-grid">{insights.map((item) => <article key={item.title} className={`status-${item.tone || 'neutral'}`}><span>{item.title}</span><p>{item.body}</p></article>)}</div>;
}

export const ReportInsightCard = ({ insight }) => <PharmacyInsightGrid insights={[insight]} />;
export { abcClass };
