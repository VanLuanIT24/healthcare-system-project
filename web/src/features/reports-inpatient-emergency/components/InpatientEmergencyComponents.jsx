import { useState } from 'react';
import { Activity, AlertTriangle, Bed, Clock3, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
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
import { ieLabel, ieTone } from '../utils/inpatientEmergencyFormatters';

export { DataErrorStrip, ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton };
export { TrendChart };

function unitForKey(key = '') {
  if (key.includes('rate') || key.includes('percent')) return 'percent';
  if (key.includes('charge') || key.includes('amount')) return 'currency';
  return 'number';
}

export function summaryCards(summary = {}, labels = {}) {
  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: safeNumber(summary[key]),
    unit: unitForKey(key),
    status: key.includes('breached') || key.includes('overdue') || key.includes('critical') || key.includes('delayed') ? (safeNumber(summary[key]) ? 'danger' : 'good') : 'neutral',
  }));
}

export function InpatientEmergencyFilterBar({ title, subtitle, filters, onChange, onReset, onRefresh, isRefreshing, lastUpdatedAt }) {
  const [advanced, setAdvanced] = useState(false);
  const update = (field, value) => onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '' } : {}) });
  return (
    <div className="operation-header ie-header">
      <div>
        <span>Nội trú & Cấp cứu</span>
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
        <input value={filters.search || ''} onChange={(event) => update('search', event.target.value)} placeholder="Tìm bệnh nhân/mã ca" />
        {advanced ? (
          <>
            <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Khoa" />
            <input value={filters.room_id || ''} onChange={(event) => update('room_id', event.target.value)} placeholder="Phòng" />
            <input value={filters.bed_id || ''} onChange={(event) => update('bed_id', event.target.value)} placeholder="Giường" />
            <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {['planned', 'admitted', 'transferred', 'discharged', 'cancelled', 'created', 'acknowledged', 'triaged', 'dispatched', 'resolved', 'false_alarm', 'todo', 'in_progress', 'done'].map((status) => (
                <option key={status} value={status}>{ieLabel(status)}</option>
              ))}
            </select>
            <select value={filters.priority || ''} onChange={(event) => update('priority', event.target.value)}>
              <option value="">Tất cả mức ưu tiên</option>
              <option value="critical">Nguy kịch</option>
              <option value="urgent">Khẩn cấp</option>
              <option value="routine">Thường quy</option>
            </select>
            <select value={filters.sla_status || ''} onChange={(event) => update('sla_status', event.target.value)}>
              <option value="">Tất cả SLA</option>
              {['on_time', 'at_risk', 'breached', 'escalated', 'closed'].map((status) => <option key={status} value={status}>{ieLabel(status)}</option>)}
            </select>
          </>
        ) : null}
        {['critical', 'urgent', 'breached', 'at_risk', 'occupied', 'available', 'overdue'].map((chip) => (
          <button key={chip} type="button" className={filters.quick === chip ? 'is-active' : ''} onClick={() => onChange({ quick: filters.quick === chip ? '' : chip, priority: ['critical', 'urgent'].includes(chip) ? chip : filters.priority, sla_status: ['breached', 'at_risk'].includes(chip) ? chip : filters.sla_status, bed_status: ['occupied', 'available'].includes(chip) ? chip : filters.bed_status })}>
            {ieLabel(chip)}
          </button>
        ))}
        <label className="ie-toggle"><input type="checkbox" checked={Boolean(filters.auto_refresh)} onChange={(event) => update('auto_refresh', event.target.checked)} />Auto refresh</label>
        <button type="button" onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Ẩn lọc nâng cao' : 'Lọc nâng cao'}</button>
        <button type="button" onClick={onReset}>Reset bộ lọc</button>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} />Refresh</button>
        <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export function InpatientEmergencyKpiGrid({ cards = [], onOpen }) {
  return <div className="executive-kpi-grid ie-kpi-grid">{cards.map((card, index) => <ExecutiveKpiCard key={card.key || card.label} card={card} index={index} onClick={() => onOpen?.(card, 'KPI nội trú/cấp cứu')} />)}</div>;
}

export const InpatientEmergencyKpiCard = ExecutiveKpiCard;

export function IeStatusBadge({ status }) {
  return <span className={`executive-badge status-${ieTone(status)}`}>{ieLabel(status)}</span>;
}

export function InpatientEmergencyTable({ rows = [], columns = [], onRowClick }) {
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });
  const sorted = [...(rows || [])].sort((a, b) => {
    const left = a?.[sort.key] ?? '';
    const right = b?.[sort.key] ?? '';
    return sort.direction === 'asc' ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
  });
  if (!rows?.length) return <ReportEmptyState title="Chưa có dữ liệu bảng" />;
  return (
    <div className="ie-table-wrap">
      <table className="executive-table ie-table">
        <thead><tr>{columns.map((column) => <th key={column.key} className={column.money ? 'is-money' : ''}><button type="button" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>{column.label}</button></th>)}</tr></thead>
        <tbody>{sorted.map((row, index) => <tr key={row.admission_id || row.bed_id || row.task_id || row.case_id || index} onClick={() => onRowClick?.(row)}>{columns.map((column) => <td key={column.key} className={column.money ? 'is-money' : ''}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export const AdmissionTable = ({ rows, onOpen }) => <InpatientEmergencyTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'admission_no', label: 'Admission no' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'department_name', label: 'Khoa' },
  { key: 'attending_doctor_name', label: 'Bác sĩ' },
  { key: 'status', label: 'Trạng thái', render: (row) => <IeStatusBadge status={row.status} /> },
  { key: 'room_name', label: 'Phòng' },
  { key: 'bed_name', label: 'Giường' },
  { key: 'admitted_at', label: 'Nhập viện', render: (row) => formatDateTime(row.admitted_at) },
  { key: 'los_days', label: 'LOS ngày', render: (row) => formatNumber(row.los_days) },
  { key: 'open_tasks_count', label: 'Task mở', render: (row) => formatNumber(row.open_tasks_count) },
  { key: 'charges_total', label: 'Charges', money: true, render: (row) => formatCurrency(row.charges_total) },
]} />;

export const BedOccupancyGrid = ({ rows = [], onOpen }) => (
  <div className="ie-bed-grid">
    {rows.slice(0, 80).map((bed) => (
      <button key={bed.bed_id} type="button" className={`status-${ieTone(bed.status)}`} onClick={() => onOpen?.(bed, 'Bed')}>
        <Bed size={16} />
        <strong>{bed.bed_code || bed.bed_name}</strong>
        <span>{bed.room_name}</span>
      </button>
    ))}
  </div>
);

export const WardMapVisualizer = BedOccupancyGrid;

export const BedStatusDonut = ({ rows = [] }) => <TrendChart data={(rows || []).map((row) => ({ ...row, label: ieLabel(row.status || row.label), value: row.count || row.value }))} type="donut" />;
export const LengthOfStayChart = ({ rows = [] }) => <TrendChart data={(rows || []).map((row) => ({ ...row, label: row.bucket || row.department_name || row.doctor_name || row.label, value: row.count || row.average_los_days || row.value }))} />;
export const EmergencySlaBoard = ({ rows = [] }) => <TrendChart data={(rows || []).map((row) => ({ ...row, label: ieLabel(row.sla_status || row.label), value: row.count || row.value }))} type="donut" />;
export const EmergencySummaryCards = InpatientEmergencyKpiGrid;
export const WardBoardSummaryCards = InpatientEmergencyKpiGrid;

export const BedTurnoverTable = ({ rows, onOpen }) => <InpatientEmergencyTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'bed_code', label: 'Giường' },
  { key: 'room_name', label: 'Phòng' },
  { key: 'department_name', label: 'Khoa' },
  { key: 'assignment_count', label: 'Assignments', render: (row) => formatNumber(row.assignment_count) },
  { key: 'transfer_count', label: 'Transfers', render: (row) => formatNumber(row.transfer_count) },
  { key: 'release_count', label: 'Release', render: (row) => formatNumber(row.release_count) },
  { key: 'average_bed_stay_hours', label: 'Avg stay giờ', render: (row) => formatNumber(row.average_bed_stay_hours) },
  { key: 'turnover_score', label: 'Score', render: (row) => formatNumber(row.turnover_score) },
]} />;

export const InpatientTaskBoard = ({ rows = [], onOpen }) => {
  const groups = ['todo', 'in_progress', 'done', 'cancelled'];
  return (
    <div className="ie-task-board">
      {groups.map((status) => (
        <section key={status}>
          <h3>{ieLabel(status)}</h3>
          {(rows || []).filter((row) => row.status === status).slice(0, 8).map((task) => (
            <button type="button" key={task.task_id} onClick={() => onOpen?.(task, 'Task')}>
              <strong>{task.title}</strong>
              <span>{task.patient_name} · {formatDateTime(task.due_at)}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
};

export const MedicationDuePanel = ({ rows = [], onOpen }) => <InpatientEmergencyTable rows={rows} onRowClick={(item) => onOpen?.(item, 'Medication administration')} columns={[
  { key: 'patient_id', label: 'Patient' },
  { key: 'status', label: 'Status', render: (row) => <IeStatusBadge status={row.status} /> },
  { key: 'scheduled_at', label: 'Scheduled', render: (row) => formatDateTime(row.scheduled_at) },
  { key: 'administered_at', label: 'Administered', render: (row) => formatDateTime(row.administered_at) },
]} />;

export const EmergencyCaseTable = ({ rows, onOpen }) => <InpatientEmergencyTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'case_code', label: 'Case code' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'priority', label: 'Priority', render: (row) => <IeStatusBadge status={row.priority} /> },
  { key: 'status', label: 'Status', render: (row) => <IeStatusBadge status={row.status} /> },
  { key: 'source', label: 'Source' },
  { key: 'assigned_department_name', label: 'Khoa' },
  { key: 'assigned_user_name', label: 'Phụ trách' },
  { key: 'created_at', label: 'Tạo lúc', render: (row) => formatDateTime(row.created_at) },
  { key: 'sla_status', label: 'SLA', render: (row) => <IeStatusBadge status={row.sla_status} /> },
  { key: 'escalation_level', label: 'Escalation', render: (row) => formatNumber(row.escalation_level) },
]} />;

export const EmergencyTriageQueue = ({ rows = [], onOpen }) => <EmergencyCaseTable rows={(rows || []).filter((row) => ['created', 'acknowledged'].includes(row.status))} onOpen={onOpen} />;
export const EmergencyDispatchBoard = ({ rows = [], onOpen }) => <EmergencyCaseTable rows={(rows || []).filter((row) => ['triaged', 'dispatched'].includes(row.status))} onOpen={onOpen} />;

export function InpatientEmergencyDetailDrawer({ item, type = 'Chi tiết', onClose }) {
  if (!item) return null;
  return (
    <aside className="operation-drawer">
      <div className="operation-drawer__panel ie-drawer">
        <header><div><span>{type}</span><h2>{item.admission_no || item.case_code || item.bed_code || item.task_code || item.patient_name || 'Chi tiết'}</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header>
        <div className="ie-timeline">
          <div><Activity size={15} /><span>Status</span><strong>{ieLabel(item.status || item.sla_status || item.priority)}</strong></div>
          <div><Clock3 size={15} /><span>Cập nhật</span><strong>{formatDateTime(item.updated_at || item.created_at || item.admitted_at || item.scheduled_at)}</strong></div>
          <div><Search size={15} /><span>Drill-down</span><strong>Mở module liên quan</strong></div>
        </div>
        <div className="operation-drawer__body">{Object.entries(item).slice(0, 40).map(([key, value]) => <div key={key}><span>{key}</span><strong>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</strong></div>)}</div>
        <footer><button type="button">Mở hồ sơ gốc</button><button type="button">Xem timeline</button><button type="button">Copy mã</button></footer>
      </div>
    </aside>
  );
}

export const EmergencyTimelineDrawer = InpatientEmergencyDetailDrawer;
export const AdmissionDetailDrawer = InpatientEmergencyDetailDrawer;
export const BedDetailDrawer = InpatientEmergencyDetailDrawer;
export const TaskDetailDrawer = InpatientEmergencyDetailDrawer;
export const MedicationAdministrationDrawer = InpatientEmergencyDetailDrawer;
export const HandoverDrawer = InpatientEmergencyDetailDrawer;

export function DischargeReadinessPanel({ rows = [] }) {
  const ready = rows.filter((row) => row.discharge_planning_status === 'ready').length;
  const delayed = rows.filter((row) => row.discharge_planning_status === 'delayed').length;
  return (
    <div className="ie-readiness">
      {[
        ['Clinical ready', ready],
        ['Billing ready', rows.filter((row) => !safeNumber(row.charges_total)).length],
        ['Medication ready', rows.filter((row) => !safeNumber(row.medication_due_count)).length],
        ['Documents ready', ready],
        ['Delayed', delayed],
      ].map(([label, count]) => <article key={label}><span>{label}</span><strong>{formatNumber(count)}</strong></article>)}
    </div>
  );
}

export function ReportInsightCard({ title, body, tone = 'neutral' }) {
  return <article className={`ie-insight status-${tone}`}><ShieldAlert size={16} /><div><strong>{title}</strong><p>{body}</p></div></article>;
}

export function IeInsightList({ insights = [] }) {
  if (!insights.length) return null;
  return <div className="ie-insight-list">{insights.map((insight) => <ReportInsightCard key={insight.title} {...insight} />)}</div>;
}

export function CriticalStrip({ children }) {
  return <div className="ie-critical-strip"><AlertTriangle size={16} />{children}</div>;
}
