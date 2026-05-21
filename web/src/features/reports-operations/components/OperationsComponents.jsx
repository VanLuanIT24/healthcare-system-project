import { useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CalendarDays, Clock3, Download, RefreshCw, Search, X } from 'lucide-react';
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

export { DataErrorStrip, ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton, TrendChart };

export function OperationFilterBar({ title, subtitle, filters, onChange, onReset, onRefresh, isRefreshing, lastUpdatedAt, exportType }) {
  const [auto, setAuto] = useState(false);
  const update = (field, value) => onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '' } : {}) });
  return (
    <div className="operation-header">
      <div>
        <span>Vận hành khám bệnh</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="operation-header__tools">
        {['today', '7d', '30d', 'week', 'month', 'custom'].map((range) => (
          <button key={range} type="button" className={filters.range === range ? 'is-active' : ''} onClick={() => update('range', range)}>
            {({ today: 'Hôm nay', '7d': '7 ngày', '30d': '30 ngày', week: 'Tuần này', month: 'Tháng này', custom: 'Custom' })[range]}
          </button>
        ))}
        {filters.range === 'custom' ? (
          <>
            <input type="date" value={filters.date_from || ''} onChange={(event) => update('date_from', event.target.value)} />
            <input type="date" value={filters.date_to || ''} onChange={(event) => update('date_to', event.target.value)} />
          </>
        ) : null}
        <input value={filters.search || ''} onChange={(event) => update('search', event.target.value)} placeholder="Tìm bệnh nhân / mã" />
        <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Khoa" />
        <input value={filters.doctor_id || ''} onChange={(event) => update('doctor_id', event.target.value)} placeholder="Bác sĩ" />
        <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="booked">Booked</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked-in</option>
          <option value="waiting">Waiting</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
        <button type="button" onClick={() => setAuto((value) => !value)}>{auto ? 'Auto refresh bật' : 'Auto refresh tắt'}</button>
        <button type="button" onClick={onReset}>Reset bộ lọc</button>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} />Refresh</button>
        <BaseExportReportButton filters={filters} reportType={exportType} />
        <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export function OperationKpiGrid({ cards = [], onOpen }) {
  return (
    <div className="executive-kpi-grid operation-kpi-grid">
      {cards.map((card, index) => (
        <ExecutiveKpiCard key={card.key || card.label} card={card} index={index} onClick={() => onOpen?.(card)} />
      ))}
    </div>
  );
}

export const OperationKpiCard = ExecutiveKpiCard;
export const ExportReportButton = BaseExportReportButton;

function badgeLabel(value) {
  return ({
    booked: 'Đã đặt',
    confirmed: 'Đã xác nhận',
    checked_in: 'Đã check-in',
    in_consultation: 'Đang khám',
    waiting: 'Đang chờ',
    called: 'Đã gọi',
    in_service: 'Đang phục vụ',
    skipped: 'Bỏ qua',
    recalled: 'Gọi lại',
    planned: 'Dự kiến',
    arrived: 'Đã đến',
    in_progress: 'Đang xử lý',
    on_hold: 'Tạm dừng',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    no_show: 'No-show',
    rescheduled: 'Đổi lịch',
  })[value] || value || 'Không rõ';
}

function statusTone(value) {
  if (['completed', 'checked_in', 'confirmed'].includes(value)) return 'good';
  if (['waiting', 'called', 'in_service', 'in_progress', 'on_hold', 'rescheduled'].includes(value)) return 'warning';
  if (['cancelled', 'no_show', 'skipped'].includes(value)) return 'danger';
  return 'neutral';
}

export function AppointmentStatusBadge({ status }) {
  return <span className={`executive-badge status-${statusTone(status)}`}>{badgeLabel(status)}</span>;
}

export const QueueStatusBadge = AppointmentStatusBadge;
export const EncounterStatusBadge = AppointmentStatusBadge;

export function OperationStatusDonut({ rows }) {
  return <TrendChart data={rows || []} type="donut" />;
}

export function OperationBreakdownBar({ rows }) {
  return <TrendChart data={rows || []} type="bar" />;
}

export function OperationTrendChart({ rows, series }) {
  return <TrendChart data={rows || []} series={series} />;
}

export function OperationTable({ columns = [], rows = [], onRowClick, pagination, onPageChange }) {
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });
  const sorted = [...(rows || [])].sort((left, right) => {
    const a = left?.[sort.key] ?? '';
    const b = right?.[sort.key] ?? '';
    return sort.direction === 'asc' ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
  });
  if (!rows?.length) return <ReportEmptyState title="Chưa có dữ liệu bảng" />;
  return (
    <div className="operation-table-wrap">
      <table className="executive-table operation-table">
        <thead>
          <tr>{columns.map((column) => (
            <th key={column.key}>
              <button type="button" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>
                {column.label}
              </button>
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={row.id || row._id || index} onClick={() => onRowClick?.(row)}>
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

export function OperationDetailDrawer({ item, type, onClose }) {
  if (!item) return null;
  return (
    <aside className="operation-drawer" aria-label="Chi tiết vận hành">
      <div className="operation-drawer__panel">
        <header>
          <div>
            <span>{type}</span>
            <h2>{item.encounter_code || item.appointment_code || item.ticket_code || item.queue_number || item.label || item.key || 'Chi tiết'}</h2>
          </div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="operation-drawer__body">
          {Object.entries(item).slice(0, 28).map(([key, value]) => (
            <div key={key}>
              <span>{key}</span>
              <strong>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</strong>
            </div>
          ))}
        </div>
        <footer>
          <button type="button">Mở module gốc</button>
          <button type="button">Timeline</button>
          <button type="button">Orders</button>
        </footer>
      </div>
    </aside>
  );
}

export function WaitTimeHeatmap({ rows = [] }) {
  const max = Math.max(1, ...rows.map((row) => safeNumber(row.count || row.value)));
  return (
    <div className="operation-heatmap">
      {rows.map((row) => (
        <span key={row.label || row.hour || row.key} style={{ opacity: 0.38 + (safeNumber(row.count || row.value) / max) * 0.62 }}>
          <strong>{row.label || row.hour}</strong>
          <em>{formatNumber(row.count || row.value)}</em>
        </span>
      ))}
    </div>
  );
}

export function DepartmentLoadMatrix({ rows = [], onOpen }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu tải khoa" />;
  return (
    <div className="department-load-matrix">
      {rows.map((row) => (
        <button key={row.department_id || row.label} type="button" className={`load-${row.load_status || 'normal'}`} onClick={() => onOpen?.(row)}>
          <strong>{row.department_name || row.label || 'Khoa/phòng'}</strong>
          <span>Load score {formatNumber(row.load_score)}</span>
          <div>
            <em>{formatNumber(row.appointment_count)} lịch hẹn</em>
            <em>{formatNumber(row.encounter_count)} lượt khám</em>
            <em>{formatMinutes(row.queue_waiting_average)}</em>
          </div>
        </button>
      ))}
    </div>
  );
}

export function SlotEfficiencyGrid({ rows = [] }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu slot" />;
  return (
    <div className="slot-efficiency-grid">
      {rows.slice(0, 18).map((row) => (
        <article key={row.doctor_id || row.doctor_name}>
          <strong>{row.doctor_name || 'Bác sĩ'}</strong>
          <span>{row.department_name || row.specialty || 'Chưa phân khoa'}</span>
          <div><i style={{ width: `${Math.min(100, safeNumber(row.schedule_utilization || row.fill_rate))}%` }} /></div>
          <footer>
            <em>{formatNumber(row.booked_slots)}/{formatNumber(row.total_slots)} slot</em>
            <em>{formatPercent(row.schedule_utilization || row.fill_rate)}</em>
          </footer>
        </article>
      ))}
    </div>
  );
}

export function PatientFlowTimeline({ stages = [] }) {
  if (!stages.length) return <ReportEmptyState title="Chưa có dữ liệu luồng bệnh nhân" />;
  return (
    <div className="patient-flow-timeline">
      {stages.map((stage) => (
        <div key={stage.key}>
          <span><Activity size={17} /></span>
          <strong>{stage.label}</strong>
          <em>{formatNumber(stage.value)}</em>
          <ArrowRight size={16} />
        </div>
      ))}
    </div>
  );
}

export function BottleneckPanel({ data = {}, waitTime = {} }) {
  const items = [
    { title: 'Nghẽn tại check-in', value: data.appointments?.summary?.confirmed_count, threshold: 20 },
    { title: 'Nghẽn tại queue', value: data.queue?.summary?.waiting_count, threshold: 25 },
    { title: 'Nghẽn tại khám', value: data.encounters?.summary?.in_progress_count, threshold: 30 },
    { title: 'Chờ > 30 phút', value: waitTime.over_30, threshold: 1 },
  ];
  return (
    <div className="bottleneck-panel">
      {items.map((item) => (
        <span key={item.title} className={safeNumber(item.value) >= item.threshold ? 'is-danger' : 'is-good'}>
          <AlertTriangle size={16} />
          <strong>{item.title}</strong>
          <em>{formatNumber(item.value)}</em>
        </span>
      ))}
    </div>
  );
}

export function JourneyFunnel({ stages = [] }) {
  const max = Math.max(1, ...stages.map((stage) => safeNumber(stage.value)));
  return (
    <div className="journey-funnel">
      {stages.map((stage) => (
        <div key={stage.key}>
          <span>{stage.label}</span>
          <i style={{ width: `${Math.max(8, (safeNumber(stage.value) / max) * 100)}%` }} />
          <strong>{formatNumber(stage.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function SmartPanel({ title, items = [] }) {
  return (
    <ReportSectionCard title={title}>
      <div className="operation-smart-panel">
        {items.length ? items.map((item) => (
          <span key={item.title}>
            <Clock3 size={16} />
            <strong>{item.title}</strong>
            <em>{item.description}</em>
          </span>
        )) : <ReportEmptyState title="Chưa có cảnh báo thông minh" compact />}
      </div>
    </ReportSectionCard>
  );
}

export function compactPerson(value) {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.full_name || value.name || value.patient_code || value.employee_code || value.department_name || '—';
}

export function dateCell(value) {
  return value ? formatDateTime(value) : '—';
}

export function minutesCell(value) {
  return value === null || value === undefined ? '—' : formatMinutes(value);
}

export function moneyCell(value) {
  return formatByUnit(value, 'currency');
}
