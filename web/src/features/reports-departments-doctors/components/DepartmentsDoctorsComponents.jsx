import { useState } from 'react';
import { Activity, AlertTriangle, Award, CalendarDays, Clock3, RefreshCw, Stethoscope, UserRound } from 'lucide-react';
import {
  DataErrorStrip,
  DepartmentLoadMatrix,
  ExportReportButton as BaseExportReportButton,
  moneyCell,
  OperationBreakdownBar,
  OperationDetailDrawer,
  OperationKpiCard,
  OperationKpiGrid,
  OperationStatusDonut,
  OperationTable,
  OperationTrendChart,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  SlotEfficiencyGrid,
  minutesCell,
} from '../../reports-operations/components/OperationsComponents';
import { formatCurrency, formatDateTime, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';

export {
  DataErrorStrip,
  OperationDetailDrawer as ReportDetailDrawer,
  OperationTable,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
};

export function DepartmentDoctorFilterBar(props) {
  const { title, subtitle, filters, onChange, onReset, onRefresh, isRefreshing, lastUpdatedAt, exportType } = props;
  const [advanced, setAdvanced] = useState(false);
  const update = (field, value) => onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '' } : {}) });
  return (
    <div className="operation-header">
      <div>
        <span>Khoa & Bác sĩ</span>
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
        <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Khoa/phòng" />
        <input value={filters.doctor_id || ''} onChange={(event) => update('doctor_id', event.target.value)} placeholder="Bác sĩ" />
        <input value={filters.specialty || ''} onChange={(event) => update('specialty', event.target.value)} placeholder="Chuyên khoa" />
        {advanced ? (
          <>
            <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="completed">Hoàn tất</option>
              <option value="cancelled">Đã hủy</option>
              <option value="no_show">No-show</option>
            </select>
            <input value={filters.group_by || ''} onChange={(event) => update('group_by', event.target.value)} placeholder="Group by" />
          </>
        ) : null}
        <button type="button" onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Ẩn lọc nâng cao' : 'Lọc nâng cao'}</button>
        <button type="button" onClick={onReset}>Reset bộ lọc</button>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} />Refresh</button>
        <BaseExportReportButton filters={filters} reportType={exportType} />
        <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export const DepartmentKpiCard = OperationKpiCard;
export const DoctorKpiCard = OperationKpiCard;
export const ExportReportButton = BaseExportReportButton;
export const ReportTrendChart = OperationTrendChart;
export const ReportStatusDonut = OperationStatusDonut;
export const ReportBreakdownBar = OperationBreakdownBar;

export function DepartmentKpiGrid({ cards = [], onOpen }) {
  return <OperationKpiGrid cards={cards} onOpen={onOpen} />;
}

export function DoctorKpiGrid({ cards = [], onOpen }) {
  return <OperationKpiGrid cards={cards} onOpen={onOpen} />;
}

function statusClass(value) {
  if (['overloaded', 'high', 'danger'].includes(value)) return 'danger';
  if (['busy', 'warning', 'low'].includes(value)) return 'warning';
  if (['normal', 'optimal', 'good'].includes(value)) return 'good';
  return 'neutral';
}

function statusText(value) {
  return ({
    overloaded: 'Quá tải',
    busy: 'Tải cao',
    normal: 'Bình thường',
    low: 'Tải thấp',
    high: 'Cao',
    optimal: 'Tối ưu',
    overbooked: 'Overbooked',
  })[value] || 'Theo dõi';
}

export function ReportInsightCard({ insight }) {
  if (!insight) return null;
  const Icon = insight.status === 'danger' ? AlertTriangle : insight.icon || Award;
  return (
    <article className={`dd-insight-card status-${insight.status || 'neutral'}`}>
      <Icon size={18} />
      <div>
        <strong>{insight.title}</strong>
        <p>{insight.description}</p>
      </div>
    </article>
  );
}

export function InsightPanel({ insights = [] }) {
  return (
    <div className="dd-insight-grid">
      {insights.length ? insights.map((insight) => (
        <ReportInsightCard key={insight.title} insight={insight} />
      )) : <ReportEmptyState title="Chưa có insight nổi bật" compact />}
    </div>
  );
}

export function DepartmentPerformanceMatrix({ rows = [], onOpen }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu hiệu suất khoa" />;
  return (
    <div className="dd-performance-matrix">
      {rows.slice(0, 16).map((row) => (
        <button key={row.department_id || row.department_code || row.department_name} type="button" onClick={() => onOpen?.(row)}>
          <header>
            <span>{row.department_code || 'KHOA'}</span>
            <strong>{row.department_name || 'Khoa/phòng'}</strong>
            <em className={`status-${statusClass(row.load_status)}`}>{statusText(row.load_status)}</em>
          </header>
          <div className="dd-score-ring" style={{ '--score': Math.min(100, safeNumber(row.performance_score)) }}>
            <strong>{formatNumber(row.performance_score)}</strong>
            <span>score</span>
          </div>
          <dl>
            <div><dt>Lịch hẹn</dt><dd>{formatNumber(row.appointment_count)}</dd></div>
            <div><dt>Lượt khám</dt><dd>{formatNumber(row.encounter_count)}</dd></div>
            <div><dt>Hoàn tất</dt><dd>{formatPercent(row.completion_rate)}</dd></div>
            <div><dt>No-show</dt><dd>{formatPercent(row.no_show_rate)}</dd></div>
            <div><dt>Chờ TB</dt><dd>{minutesCell(row.queue_waiting_average)}</dd></div>
            <div><dt>Doanh thu</dt><dd>{formatCurrency(row.revenue_amount)}</dd></div>
          </dl>
        </button>
      ))}
    </div>
  );
}

export function DepartmentLoadCard({ department, onOpen }) {
  if (!department) return null;
  return (
    <button type="button" className={`dd-load-card status-${statusClass(department.load_status)}`} onClick={() => onOpen?.(department)}>
      <header>
        <strong>{department.department_name || 'Khoa/phòng'}</strong>
        <span>{statusText(department.load_status)}</span>
      </header>
      <div className="dd-load-card__score">{formatNumber(department.load_score)}</div>
      <p>{department.recommended_action || 'Theo dõi tải khoa theo lịch hẹn, queue và lượt khám.'}</p>
      <footer>
        <em>{formatNumber(department.doctor_count)} bác sĩ</em>
        <em>{formatNumber(department.appointment_count)} lịch</em>
        <em>{formatNumber(department.encounter_count)} lượt khám</em>
      </footer>
    </button>
  );
}

export function DepartmentLoadCards({ rows = [], onOpen }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu tải khoa" />;
  return (
    <div className="dd-load-grid">
      {rows.slice(0, 12).map((row) => <DepartmentLoadCard key={row.department_id || row.department_name} department={row} onOpen={onOpen} />)}
    </div>
  );
}

export function DepartmentRankingTable({ rows = [], onOpen, mode = 'performance' }) {
  const scoreKey = mode === 'load' ? 'load_score' : mode === 'revenue' ? 'revenue_amount' : 'performance_score';
  const sorted = [...rows].sort((a, b) => safeNumber(b[scoreKey]) - safeNumber(a[scoreKey]));
  return (
    <OperationTable
      rows={sorted}
      onRowClick={onOpen}
      columns={[
        { key: 'department_code', label: 'Mã khoa' },
        { key: 'department_name', label: 'Khoa' },
        { key: 'doctor_count', label: 'Bác sĩ', render: (row) => formatNumber(row.doctor_count) },
        { key: 'appointment_count', label: 'Lịch hẹn', render: (row) => formatNumber(row.appointment_count) },
        { key: 'encounter_count', label: 'Lượt khám', render: (row) => formatNumber(row.encounter_count) },
        { key: 'queue_waiting_average', label: 'Chờ TB', render: (row) => minutesCell(row.queue_waiting_average) },
        { key: 'revenue_amount', label: 'Doanh thu', render: (row) => moneyCell(row.revenue_amount) },
        { key: scoreKey, label: mode === 'revenue' ? 'Đóng góp' : 'Score', render: (row) => mode === 'revenue' ? moneyCell(row[scoreKey]) : formatNumber(row[scoreKey]) },
      ]}
    />
  );
}

export function DoctorRankingTable({ rows = [], onOpen }) {
  const sorted = [...rows].sort((a, b) => safeNumber(b.productivity_score) - safeNumber(a.productivity_score));
  return (
    <OperationTable
      rows={sorted}
      onRowClick={onOpen}
      columns={[
        { key: 'doctor_code', label: 'Mã bác sĩ' },
        { key: 'doctor_name', label: 'Bác sĩ' },
        { key: 'department_name', label: 'Khoa' },
        { key: 'specialty', label: 'Chuyên khoa' },
        { key: 'appointment_count', label: 'Lịch hẹn', render: (row) => formatNumber(row.appointment_count) },
        { key: 'encounter_count', label: 'Lượt khám', render: (row) => formatNumber(row.encounter_count) },
        { key: 'completed_encounter_count', label: 'Hoàn tất', render: (row) => formatNumber(row.completed_encounter_count) },
        { key: 'patient_count', label: 'Bệnh nhân', render: (row) => formatNumber(row.patient_count) },
        { key: 'schedule_utilization', label: 'Utilization', render: (row) => formatPercent(row.schedule_utilization) },
        { key: 'no_show_rate', label: 'No-show', render: (row) => formatPercent(row.no_show_rate) },
        { key: 'productivity_score', label: 'Score', render: (row) => formatNumber(row.productivity_score) },
      ]}
    />
  );
}

export function DoctorUtilizationGrid({ rows = [], onOpen }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu utilization bác sĩ" />;
  return (
    <div className="dd-doctor-grid">
      {rows.slice(0, 18).map((row) => (
        <button key={row.doctor_id || row.doctor_name} type="button" className={`status-${statusClass(row.utilization_status)}`} onClick={() => onOpen?.(row)}>
          <header>
            <span><UserRound size={16} /></span>
            <strong>{row.doctor_name || 'Bác sĩ'}</strong>
            <em>{row.department_name || row.specialty || 'Chưa phân khoa'}</em>
          </header>
          <div className="dd-util-bar"><i style={{ width: `${Math.min(100, safeNumber(row.schedule_utilization))}%` }} /></div>
          <footer>
            <b>{formatPercent(row.schedule_utilization)}</b>
            <span>{formatNumber(row.booked_slots)}/{formatNumber(row.total_slots)} slot</span>
            <span>{statusText(row.utilization_status)}</span>
          </footer>
        </button>
      ))}
    </div>
  );
}

export function DoctorPerformanceRadar({ doctor }) {
  if (!doctor) return <ReportEmptyState title="Chưa chọn bác sĩ" compact />;
  const metrics = [
    { label: 'Lượt khám', value: doctor.encounter_count },
    { label: 'Hoàn tất', value: doctor.completion_rate },
    { label: 'Utilization', value: doctor.schedule_utilization },
    { label: 'Bệnh nhân', value: doctor.patient_count },
    { label: 'Score', value: doctor.productivity_score },
  ];
  const max = Math.max(1, ...metrics.map((metric) => safeNumber(metric.value)));
  return (
    <div className="dd-radar">
      <div className="dd-radar__avatar"><Stethoscope size={28} /><strong>{doctor.doctor_name}</strong></div>
      {metrics.map((metric) => (
        <div key={metric.label}>
          <span>{metric.label}</span>
          <i><b style={{ width: `${Math.max(6, (safeNumber(metric.value) / max) * 100)}%` }} /></i>
          <em>{metric.label === 'Hoàn tất' || metric.label === 'Utilization' ? formatPercent(metric.value) : formatNumber(metric.value)}</em>
        </div>
      ))}
    </div>
  );
}

export function DoctorNoShowTable({ rows = [], onOpen }) {
  const sorted = [...rows].sort((a, b) => safeNumber(b.no_show_rate) - safeNumber(a.no_show_rate));
  return (
    <OperationTable
      rows={sorted}
      onRowClick={onOpen}
      columns={[
        { key: 'doctor_name', label: 'Bác sĩ' },
        { key: 'department_name', label: 'Khoa' },
        { key: 'specialty', label: 'Chuyên khoa' },
        { key: 'appointment_count', label: 'Lịch hẹn', render: (row) => formatNumber(row.appointment_count) },
        { key: 'completed_appointment_count', label: 'Hoàn tất', render: (row) => formatNumber(row.completed_appointment_count) },
        { key: 'no_show_count', label: 'No-show', render: (row) => formatNumber(row.no_show_count) },
        { key: 'no_show_rate', label: 'Tỷ lệ no-show', render: (row) => formatPercent(row.no_show_rate) },
        { key: 'recommendation', label: 'Khuyến nghị' },
      ]}
    />
  );
}

export function DepartmentStaffTable({ rows = [], onOpen }) {
  return (
    <OperationTable
      rows={rows}
      onRowClick={onOpen}
      columns={[
        { key: 'department_name', label: 'Khoa' },
        { key: 'department_type', label: 'Loại khoa' },
        { key: 'head_user', label: 'Trưởng khoa', render: (row) => row.head_user?.full_name || row.head_user?.name || 'Chưa cấu hình' },
        { key: 'staff_count', label: 'Nhân sự', render: (row) => formatNumber(row.staff_count) },
        { key: 'doctor_count', label: 'Bác sĩ', render: (row) => formatNumber(row.doctor_count) },
        { key: 'appointment_count', label: 'Lịch hẹn', render: (row) => formatNumber(row.appointment_count) },
        { key: 'encounter_count', label: 'Lượt khám', render: (row) => formatNumber(row.encounter_count) },
        { key: 'load_per_doctor', label: 'Load/bác sĩ', render: (row) => formatNumber(row.encounter_per_doctor || row.load_per_doctor) },
        { key: 'recommended_action', label: 'Khuyến nghị' },
      ]}
    />
  );
}

export function FollowUpBoard({ followUp = {} }) {
  const groups = [
    { key: 'unscheduled_follow_up', label: 'Cần đặt lịch', icon: CalendarDays },
    { key: 'scheduled_follow_up', label: 'Đã đặt lịch', icon: Activity },
    { key: 'due_today', label: 'Đến hạn hôm nay', icon: Clock3 },
    { key: 'overdue_follow_up', label: 'Quá hạn', icon: AlertTriangle },
  ];
  return (
    <div className="executive-kanban dd-follow-up-board">
      {groups.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.key} className="executive-kanban__column">
            <header><strong><Icon size={16} /> {group.label}</strong><span>{formatNumber(followUp.summary?.[group.key])}</span></header>
            {(followUp.items || []).filter((item) => item.status === group.key).slice(0, 8).map((item) => (
              <article key={item.patient_id || item.last_encounter_id} className="executive-task-card">
                <strong>{item.patient_name}</strong>
                <p>{item.doctor_name} - {item.department_name}</p>
              </article>
            ))}
            {!followUp.items?.length ? <p className="dd-kanban-empty">{followUp.empty_reason || 'Chưa có dữ liệu follow-up.'}</p> : null}
          </section>
        );
      })}
    </div>
  );
}

export function PersonalReportPanel({ doctor, data, onOpen }) {
  if (!doctor) return <ReportEmptyState title="Chưa có bác sĩ để hiển thị báo cáo cá nhân" />;
  return (
    <div className="dd-personal-panel">
      <section className="dd-personal-hero">
        <div className="dd-avatar">{String(doctor.doctor_name || 'BS').slice(0, 2).toUpperCase()}</div>
        <div>
          <span>{doctor.doctor_code || 'Báo cáo cá nhân'}</span>
          <h2>{doctor.doctor_name}</h2>
          <p>{doctor.department_name || 'Chưa phân khoa'} · {doctor.specialty || 'Chưa cập nhật chuyên khoa'}</p>
        </div>
      </section>
      <div className="dd-personal-grid">
        <DoctorPerformanceRadar doctor={doctor} />
        <SlotEfficiencyGrid rows={[doctor]} />
        <ReportSectionCard title="Lịch hẹn liên quan">
          <OperationTable rows={data?.lists?.appointments?.items || []} onRowClick={(item) => onOpen?.(item, 'Appointment')} columns={[
            { key: 'appointment_time', label: 'Giờ hẹn' },
            { key: 'status', label: 'Trạng thái' },
            { key: 'appointment_type', label: 'Loại' },
          ]} />
        </ReportSectionCard>
      </div>
    </div>
  );
}
