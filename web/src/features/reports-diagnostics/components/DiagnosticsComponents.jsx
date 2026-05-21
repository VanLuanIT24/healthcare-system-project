import { useState } from 'react';
import { Activity, AlertTriangle, BellRing, Clock3, FileWarning, FlaskConical, RefreshCw, ScanLine, Stethoscope, X } from 'lucide-react';
import {
  DataErrorStrip,
  ExecutiveKpiCard,
  ExportReportButton as BaseExportReportButton,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
} from '../../reports-overview/components/ExecutiveOverviewComponents';
import { formatByUnit, formatDateTime, formatMinutes, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import { diagnosticTypeLabel, diagnosticsStatusLabel, diagnosticsTone } from '../utils/diagnosticsFormatters';

export { DataErrorStrip, ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton };

export function DiagnosticsFilterBar({ title, subtitle, filters, onChange, onReset, onRefresh, isRefreshing, lastUpdatedAt, exportType }) {
  const [advanced, setAdvanced] = useState(false);
  const update = (field, value) => onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '' } : {}) });
  return (
    <div className="operation-header diagnostics-header">
      <div>
        <span>Cận lâm sàng & Thủ thuật</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="operation-header__tools">
        {['today', '7d', 'week', 'month', 'quarter', 'custom'].map((range) => (
          <button key={range} type="button" className={filters.range === range ? 'is-active' : ''} onClick={() => update('range', range)}>
            {({ today: 'Hôm nay', '7d': '7 ngày', week: 'Tuần này', month: 'Tháng này', quarter: 'Quý này', custom: 'Custom' })[range]}
          </button>
        ))}
        {filters.range === 'custom' ? (
          <>
            <input type="date" value={filters.date_from || ''} onChange={(event) => update('date_from', event.target.value)} />
            <input type="date" value={filters.date_to || ''} onChange={(event) => update('date_to', event.target.value)} />
          </>
        ) : null}
        <select value={filters.order_type || ''} onChange={(event) => update('order_type', event.target.value)}>
          <option value="">Tất cả loại order</option>
          <option value="lab">Lab</option>
          <option value="imaging">Imaging</option>
          <option value="procedure">Procedure</option>
        </select>
        <select value={filters.priority || ''} onChange={(event) => update('priority', event.target.value)}>
          <option value="">Tất cả ưu tiên</option>
          <option value="routine">Thường quy</option>
          <option value="urgent">Khẩn</option>
          <option value="stat">STAT</option>
        </select>
        {advanced ? (
          <>
            <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Khoa" />
            <input value={filters.doctor_id || ''} onChange={(event) => update('doctor_id', event.target.value)} placeholder="Bác sĩ" />
            <input value={filters.patient_id || ''} onChange={(event) => update('patient_id', event.target.value)} placeholder="Bệnh nhân" />
            <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="ordered">Đã chỉ định</option>
              <option value="acknowledged">Đã tiếp nhận</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="completed">Hoàn tất</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </>
        ) : null}
        {['stat', 'urgent', 'critical', 'overdue'].map((chip) => (
          <button key={chip} type="button" className={filters.quick === chip ? 'is-active' : ''} onClick={() => onChange({ quick: filters.quick === chip ? '' : chip, priority: chip === 'stat' || chip === 'urgent' ? chip : filters.priority })}>{chip.toUpperCase()}</button>
        ))}
        <label className="diagnostics-toggle">
          <input type="checkbox" checked={Boolean(filters.auto_refresh)} onChange={(event) => update('auto_refresh', event.target.checked)} />
          Auto refresh
        </label>
        <button type="button" onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Ẩn lọc nâng cao' : 'Lọc nâng cao'}</button>
        <button type="button" onClick={onReset}>Reset bộ lọc</button>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} />Refresh</button>
        <BaseExportReportButton filters={filters} reportType={exportType || 'appointments'} />
        <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export function DiagnosticsKpiGrid({ cards = [], onOpen }) {
  return (
    <div className="executive-kpi-grid diagnostics-kpi-grid">
      {cards.map((card, index) => (
        <ExecutiveKpiCard key={card.key || card.label} card={card} index={index} onClick={() => onOpen?.(card, 'KPI cận lâm sàng')} />
      ))}
    </div>
  );
}

export const DiagnosticsKpiCard = ExecutiveKpiCard;
export const ExportReportButton = BaseExportReportButton;

export function DiagnosticsStatusBadge({ status }) {
  return <span className={`executive-badge status-${diagnosticsTone(status)}`}>{diagnosticsStatusLabel(status)}</span>;
}

export function DiagnosticsHealthScore({ rows = [] }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có health score" compact />;
  return (
    <div className="diagnostics-health-grid">
      {rows.map((row) => (
        <article key={row.key} className={`status-${row.status || 'neutral'}`}>
          <span>{row.label}</span>
          <strong>{formatPercent(row.score)}</strong>
          <div><i style={{ width: `${Math.min(100, safeNumber(row.score))}%` }} /></div>
        </article>
      ))}
    </div>
  );
}

export function DiagnosticsTrendChart({ rows = [], type = 'bar', series }) {
  return <TrendChart data={rows || []} type={type} series={series} />;
}

export const OrderTypeDonut = ({ rows = [] }) => <TrendChart data={rows} type="donut" />;
export const PriorityDonut = ({ rows = [] }) => <TrendChart data={rows} type="donut" />;
export const SpecimenStatusChart = ({ rows = [] }) => <TrendChart data={rows} type="donut" />;
export const ModalityBreakdownChart = ({ rows = [] }) => <TrendChart data={rows} type="bar" />;
export const TurnaroundTimeChart = ({ rows = [] }) => <TrendChart data={rows} type="bar" series={[{ key: 'total_tat_minutes', label: 'Total TAT' }]} />;

export function SlaBoard({ rows = [] }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có SLA board" compact />;
  return (
    <div className="diagnostics-status-board">
      {rows.map((row) => (
        <article key={row.key} className={`status-${diagnosticsTone(row.key)}`}>
          <span>{row.label}</span>
          <strong>{formatNumber(row.count || row.value)}</strong>
        </article>
      ))}
    </div>
  );
}

export function DiagnosticsStatusBoard({ data = {}, onOpen }) {
  const cards = [
    { key: 'critical', label: 'Critical cần xác nhận', value: data.lists?.critical_results?.length || 0, icon: BellRing, tone: 'danger' },
    { key: 'overdue', label: 'Order quá hạn', value: data.lists?.overdue_orders?.length || 0, icon: Clock3, tone: 'danger' },
    { key: 'pending', label: 'Report pending', value: data.lists?.pending_reports?.length || 0, icon: FileWarning, tone: 'warning' },
    { key: 'missing', label: 'Missing files', value: (data.lists?.alerts || []).filter((row) => String(row.category || '').includes('missing')).length, icon: AlertTriangle, tone: 'warning' },
  ];
  return (
    <div className="diagnostics-command-grid">
      {cards.map(({ icon: Icon, ...card }) => (
        <button key={card.key} type="button" className={`diagnostics-command-card status-${card.tone}`} onClick={() => onOpen?.(card, card.label)}>
          <Icon size={18} />
          <span>{card.label}</span>
          <strong>{formatNumber(card.value)}</strong>
        </button>
      ))}
    </div>
  );
}

export function DiagnosticsDataTable({ columns = [], rows = [], onRowClick, pagination, onPageChange }) {
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });
  const sorted = [...(rows || [])].sort((left, right) => {
    const a = left?.[sort.key] ?? '';
    const b = right?.[sort.key] ?? '';
    return sort.direction === 'asc' ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
  });
  if (!rows?.length) return <ReportEmptyState title="Chưa có dữ liệu bảng" />;
  return (
    <div className="finance-table-wrap diagnostics-table-wrap">
      <table className="executive-table finance-table diagnostics-table">
        <thead>
          <tr>{columns.map((column) => (
            <th key={column.key}>
              <button type="button" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>{column.label}</button>
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={row._id || row.id || row.code || row.alert_id || index} onClick={() => onRowClick?.(row)}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination ? (
        <div className="operation-pagination">
          <button type="button" disabled={(pagination.page || 1) <= 1} onClick={() => onPageChange?.((pagination.page || 1) - 1)}>Trước</button>
          <span>Trang {pagination.page || 1} / {pagination.total_pages || pagination.pages || 1}</span>
          <button type="button" disabled={(pagination.page || 1) >= (pagination.total_pages || pagination.pages || 1)} onClick={() => onPageChange?.((pagination.page || 1) + 1)}>Sau</button>
        </div>
      ) : null}
    </div>
  );
}

export function DiagnosticOrderTable({ rows = [], onOpen }) {
  return (
    <DiagnosticsDataTable
      rows={rows}
      onRowClick={onOpen}
      columns={[
        { key: 'code', label: 'Mã order' },
        { key: 'type', label: 'Loại', render: (row) => diagnosticTypeLabel(row.type) },
        { key: 'patient_name', label: 'Bệnh nhân', render: (row) => row.patient_name || row.patient_id?.full_name || '—' },
        { key: 'department_name', label: 'Khoa', render: (row) => row.department_name || row.department_id?.department_name || '—' },
        { key: 'doctor_name', label: 'Bác sĩ', render: (row) => row.doctor_name || row.ordered_by?.full_name || '—' },
        { key: 'priority', label: 'Ưu tiên', render: (row) => <DiagnosticsStatusBadge status={row.priority} /> },
        { key: 'status', label: 'Trạng thái', render: (row) => <DiagnosticsStatusBadge status={row.status} /> },
        { key: 'ordered_at', label: 'Ordered at', render: (row) => formatDateTime(row.ordered_at || row.created_at) },
        { key: 'sla_state', label: 'SLA', render: (row) => <DiagnosticsStatusBadge status={row.sla_state} /> },
        { key: 'overdue_minutes', label: 'Overdue', render: (row) => row.overdue_minutes ? formatMinutes(row.overdue_minutes) : '—' },
      ]}
    />
  );
}

export const OverdueOrderTable = DiagnosticOrderTable;
export const ReportPendingTable = DiagnosticOrderTable;

export function CriticalResultBoard({ rows = [], onOpen }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có critical result đang mở" compact />;
  return (
    <div className="diagnostics-critical-list">
      {rows.slice(0, 8).map((row, index) => (
        <button key={row.alert_id || row._id || index} type="button" onClick={() => onOpen?.(row, 'Critical result')}>
          <AlertTriangle size={17} />
          <span>{row.code || row.alert_code || 'Critical'}</span>
          <strong>{row.patient_name || row.patient_id?.full_name || row.title || 'Chưa cập nhật'}</strong>
          <em>{formatDateTime(row.created_at || row.ordered_at)}</em>
        </button>
      ))}
    </div>
  );
}

export function ReportInsightCard({ insight }) {
  if (!insight) return null;
  return (
    <article className={`diagnostics-insight status-${insight.tone || 'neutral'}`}>
      <span>{insight.title}</span>
      <p>{insight.body}</p>
    </article>
  );
}

export function DiagnosticsInsightGrid({ insights = [] }) {
  if (!insights.length) return <ReportEmptyState title="Chưa có insight" compact />;
  return <div className="diagnostics-insight-grid">{insights.map((insight) => <ReportInsightCard key={insight.title} insight={insight} />)}</div>;
}

export function DiagnosticsDetailDrawer({ item, type = 'Chi tiết cận lâm sàng', onClose }) {
  if (!item) return null;
  return (
    <aside className="operation-drawer" aria-label="Chi tiết cận lâm sàng">
      <div className="operation-drawer__panel diagnostics-drawer">
        <header>
          <div>
            <span>{type}</span>
            <h2>{item.code || item.order_no || item.lab_order_no || item.imaging_order_no || item.procedure_order_no || item.alert_code || item.label || 'Chi tiết'}</h2>
          </div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="diagnostics-timeline">
          <div><Activity size={15} /><span>Ordered</span><strong>{formatDateTime(item.ordered_at || item.created_at)}</strong></div>
          <div><Clock3 size={15} /><span>Current status</span><strong>{diagnosticsStatusLabel(item.status || item.sla_state)}</strong></div>
          <div><Stethoscope size={15} /><span>Owner</span><strong>{item.doctor_name || item.assigned_owner || item.owner || 'Chưa phân công'}</strong></div>
        </div>
        <div className="operation-drawer__body">
          {Object.entries(item).slice(0, 34).map(([key, value]) => (
            <div key={key}>
              <span>{key}</span>
              <strong>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</strong>
            </div>
          ))}
        </div>
        <footer>
          <button type="button">Mở full detail</button>
          <button type="button">Xem timeline</button>
          <button type="button">Xuất dòng này</button>
        </footer>
      </div>
    </aside>
  );
}

export const LabOrderDrawer = DiagnosticsDetailDrawer;
export const SpecimenDrawer = DiagnosticsDetailDrawer;
export const LabResultDrawer = DiagnosticsDetailDrawer;
export const ImagingOrderDrawer = DiagnosticsDetailDrawer;
export const ImagingReportDrawer = DiagnosticsDetailDrawer;
export const ProcedureOrderDrawer = DiagnosticsDetailDrawer;
export const ProcedureResultDrawer = DiagnosticsDetailDrawer;
export const DiagnosticAlertDrawer = DiagnosticsDetailDrawer;

export function ModuleHealthColumns({ data = {} }) {
  const modules = [
    { key: 'lab', title: 'Lab health', icon: FlaskConical, rows: data.lists?.lab_orders || [] },
    { key: 'imaging', title: 'Imaging health', icon: ScanLine, rows: data.lists?.imaging_orders || [] },
    { key: 'procedure', title: 'Procedure health', icon: Stethoscope, rows: data.lists?.procedure_orders || [] },
    { key: 'risk', title: 'Risk / SLA', icon: AlertTriangle, rows: data.lists?.overdue_orders || [] },
  ];
  return (
    <div className="diagnostics-module-grid">
      {modules.map(({ key, title, icon: Icon, rows }) => (
        <article key={key}>
          <header><Icon size={18} /><span>{title}</span></header>
          <strong>{formatNumber(rows.length)}</strong>
          <p>Completion {formatPercent(rows.length ? (rows.filter((row) => row.status === 'completed').length / rows.length) * 100 : 0)}</p>
          <div><i style={{ width: `${Math.min(100, rows.length ? (rows.filter((row) => row.status === 'completed').length / rows.length) * 100 : 0)}%` }} /></div>
        </article>
      ))}
    </div>
  );
}

export function TatMetricTable({ rows = [], onOpen }) {
  return (
    <DiagnosticsDataTable
      rows={rows}
      onRowClick={onOpen}
      columns={[
        { key: 'code', label: 'Order/report' },
        { key: 'patient_name', label: 'Bệnh nhân' },
        { key: 'priority', label: 'Ưu tiên', render: (row) => <DiagnosticsStatusBadge status={row.priority} /> },
        { key: 'ordered_at', label: 'Ordered', render: (row) => formatDateTime(row.ordered_at || row.created_at) },
        { key: 'completed_at', label: 'Completed', render: (row) => formatDateTime(row.completed_at || row.finalized_at) },
        { key: 'total_tat_minutes', label: 'Total TAT', render: (row) => row.total_tat_minutes ? formatMinutes(row.total_tat_minutes) : 'Chưa đủ dữ liệu' },
        { key: 'sla_state', label: 'SLA', render: (row) => <DiagnosticsStatusBadge status={row.sla_state} /> },
      ]}
    />
  );
}
