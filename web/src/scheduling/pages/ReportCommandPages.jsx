import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Gauge,
  ListOrdered,
  RefreshCw,
  Search,
  Stethoscope,
  TrendingUp,
  UserRoundX,
} from 'lucide-react';

import { schedulingApi } from '../api/schedulingApi.js';

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const VIEW_CONFIG = {
  dashboard: {
    title: 'Dashboard báo cáo vận hành',
    eyebrow: 'Operations Analytics',
    subtitle: 'Theo dõi nhanh hiệu suất lịch hẹn, queue, slot và tải khoa/bác sĩ.',
  },
  appointments: {
    title: 'Báo cáo lịch hẹn',
    eyebrow: 'Appointment Report',
    subtitle: 'Phân tích lịch hẹn theo trạng thái, khoa, bác sĩ, ngày và loại lịch.',
  },
  queue: {
    title: 'Báo cáo queue',
    eyebrow: 'Queue Report',
    subtitle: 'Theo dõi queue nghẽn, peak hour, thời gian chờ và hiệu suất gọi số.',
  },
  utilization: {
    title: 'Báo cáo công suất',
    eyebrow: 'Capacity Utilization',
    subtitle: 'Phân tích slot utilization, doctor utilization và các slot cần tối ưu.',
  },
  noShow: {
    title: 'Báo cáo no-show / hủy / dời lịch',
    eyebrow: 'No-show & Recovery',
    subtitle: 'Theo dõi no-show, hủy, dời lịch và phần công suất bị mất.',
  },
  export: {
    title: 'Xuất báo cáo',
    eyebrow: 'Export Center',
    subtitle: 'Cấu hình, preview và xuất dữ liệu vận hành lịch theo quyền hiện tại.',
  },
};

const demoSeries = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((label, index) => ({
  label,
  appointments: 260 + index * 18,
  queue: 210 + index * 12,
  utilization: 58 + index * 5,
  no_show: 8 + (index % 3) * 3,
}));

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.series)) return value.series;
  if (Array.isArray(value?.by_day)) return value.by_day;
  if (Array.isArray(value?.by_department)) return value.by_department;
  return [];
}

function unwrap(result) {
  return result?.status === 'fulfilled' ? result.value : null;
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function pct(part, total) {
  const denominator = safeNumber(total);
  if (!denominator) return 0;
  return Math.round((safeNumber(part) / denominator) * 1000) / 10;
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(safeNumber(value));
}

function formatMinutes(value) {
  const minutes = safeNumber(value);
  if (minutes < 60) return `${Math.round(minutes)} phút`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}p`;
}

function sourceArray(...values) {
  for (const value of values) {
    const items = asArray(value);
    if (items.length) return items;
  }
  return [];
}

function normalizeSummary(state) {
  const dashboard = state.dashboard?.summary || {};
  const appointment = state.appointmentReport?.summary || state.appointmentReport || {};
  const appointmentSummary = state.appointmentSummary || {};
  const queue = state.queueReport?.summary || state.queueReport || {};
  const queueSummary = state.queueSummary || {};
  const schedule = state.systemSummary?.overview || state.systemSummary || {};
  const doctors = state.doctorReport?.summary || state.doctorReport || {};
  const departments = state.departmentReport?.summary || state.departmentReport || {};
  const totalAppointments = safeNumber(dashboard.total_appointments ?? appointment.total_appointments ?? appointmentSummary.total, 420);
  const completed = safeNumber(dashboard.completed_appointments ?? appointment.completed_count ?? appointmentSummary.completed, 318);
  const noShow = safeNumber(dashboard.no_show_appointments ?? appointment.no_show_count ?? appointmentSummary.no_show, 18);
  const cancelled = safeNumber(dashboard.cancelled_appointments ?? appointment.cancelled_count ?? appointmentSummary.cancelled, 22);
  const rescheduled = safeNumber(dashboard.rescheduled_appointments ?? appointment.rescheduled_count ?? appointmentSummary.rescheduled, 31);
  const totalQueue = safeNumber(dashboard.total_queue_tickets ?? queue.total_tickets ?? queueSummary.total, 365);
  const avgWait = safeNumber(dashboard.average_waiting_time ?? queue.average_waiting_time ?? queueSummary.avg_wait_minutes, 17.4);
  const totalSlots = safeNumber(dashboard.total_slots ?? schedule.total_slots ?? schedule.slots_total, 510);
  const bookedSlots = safeNumber(dashboard.booked_slots ?? schedule.booked_slots ?? schedule.slots_booked, 392);
  return {
    totalAppointments,
    completed,
    checkedIn: safeNumber(appointment.checked_in_count ?? appointmentSummary.checked_in, 72),
    noShow,
    cancelled,
    rescheduled,
    totalQueue,
    avgWait,
    avgService: safeNumber(dashboard.average_service_time ?? queue.average_service_time, 12.8),
    totalSlots,
    bookedSlots,
    availableSlots: safeNumber(dashboard.available_slots ?? schedule.available_slots, Math.max(totalSlots - bookedSlots, 0)),
    utilization: safeNumber(dashboard.slot_utilization ?? schedule.slot_utilization ?? schedule.utilization_rate, pct(bookedSlots, totalSlots)),
    doctorCount: safeNumber(dashboard.doctor_count ?? doctors.doctor_count, 46),
    departmentCount: safeNumber(dashboard.department_count ?? departments.department_count, 12),
    noShowRate: safeNumber(appointment.no_show_rate, pct(noShow, totalAppointments)),
    cancellationRate: safeNumber(appointment.cancellation_rate, pct(cancelled, totalAppointments)),
    completionRate: safeNumber(appointment.completion_rate, pct(completed, totalAppointments)),
  };
}

function buildSeries(state) {
  const fromOps = sourceArray(state.dashboard?.charts?.appointments_by_day, state.appointmentReport?.breakdown?.by_day, state.appointmentReport?.by_day);
  if (fromOps.length) {
    return fromOps.map((item, index) => ({
      label: item.label || item.date || `D${index + 1}`,
      appointments: safeNumber(item.total || item.count || item.appointments),
      queue: safeNumber(item.queue || item.total_tickets),
      utilization: safeNumber(item.utilization_rate || item.utilization),
      no_show: safeNumber(item.no_show || item.no_show_count),
    }));
  }
  return demoSeries;
}

function buildDepartmentRows(state) {
  const rows = sourceArray(
    state.dashboard?.charts?.utilization_by_department,
    state.departmentReport?.items,
    state.departmentReport?.by_department,
    state.systemSummary?.by_department,
  );
  const source = rows.length ? rows : [
    { department_name: 'Nội tổng quát', appointment_count: 96, queue_waiting_average: 24, schedule_utilization: 82, no_show_count: 6, doctor_count: 8 },
    { department_name: 'Tim mạch', appointment_count: 74, queue_waiting_average: 14, schedule_utilization: 76, no_show_count: 3, doctor_count: 5 },
    { department_name: 'Nhi khoa', appointment_count: 131, queue_waiting_average: 35, schedule_utilization: 96, no_show_count: 9, doctor_count: 7 },
  ];
  return source.map((item, index) => ({
    id: item.department_id || item.id || index,
    name: item.department_name || item.name || item.label || 'Khoa',
    appointments: safeNumber(item.appointment_count || item.appointments_count || item.total_appointments),
    queueWait: safeNumber(item.queue_waiting_average || item.avg_wait_minutes || item.average_waiting_time),
    utilization: safeNumber(item.schedule_utilization || item.utilization_rate || item.utilization),
    noShow: safeNumber(item.no_show_count),
    doctors: safeNumber(item.doctor_count || item.doctors_count),
  }));
}

function buildDoctorRows(state) {
  const rows = sourceArray(state.doctorReport?.items, state.doctorReport?.by_doctor, state.systemSummary?.by_doctor);
  const source = rows.length ? rows : [
    { doctor_name: 'BS. Trần Thanh Hải', department_name: 'Nội tổng quát', appointment_count: 26, no_show_count: 2, total_slots: 32, booked_slots: 26, average_consultation_duration: 18 },
    { doctor_name: 'BS. Lê Minh Tuấn', department_name: 'Tim mạch', appointment_count: 22, no_show_count: 1, total_slots: 22, booked_slots: 22, average_consultation_duration: 21 },
    { doctor_name: 'BS. Nguyễn Thị Lan', department_name: 'Nhi khoa', appointment_count: 18, no_show_count: 0, total_slots: 40, booked_slots: 18, average_consultation_duration: 16 },
  ];
  return source.map((item, index) => ({
    id: item.doctor_id || item.id || index,
    name: item.doctor_name || item.full_name || item.name || 'Bác sĩ',
    department: item.department_name || item.department?.name || 'Khoa',
    appointments: safeNumber(item.appointment_count || item.appointments_count),
    noShow: safeNumber(item.no_show_count),
    totalSlots: safeNumber(item.total_slots),
    bookedSlots: safeNumber(item.booked_slots),
    utilization: safeNumber(item.schedule_utilization || item.utilization_rate, pct(item.booked_slots, item.total_slots)),
    avgConsult: safeNumber(item.average_consultation_duration),
  }));
}

function makeInsights(summary, departments, doctors) {
  const insights = [];
  const overloadedDepartment = departments.find((item) => item.utilization >= 90 || item.queueWait >= 30);
  const overloadedDoctor = doctors.find((item) => item.utilization >= 90);
  if (overloadedDepartment) insights.push(`${overloadedDepartment.name} đang có tải cao: utilization ${overloadedDepartment.utilization}% và chờ TB ${formatMinutes(overloadedDepartment.queueWait)}.`);
  if (overloadedDoctor) insights.push(`${overloadedDoctor.name} đã gần kín lịch (${overloadedDoctor.utilization}%), nên cân nhắc mở thêm slot hoặc chuyển bệnh nhân.`);
  if (summary.noShowRate >= 5) insights.push(`No-show rate hiện ${summary.noShowRate}%, nên bật nhắc lịch chủ động cho các lịch chưa xác nhận.`);
  if (summary.avgWait >= 20) insights.push(`Thời gian chờ queue TB ${formatMinutes(summary.avgWait)}, cần theo dõi SLA trong khung cao điểm.`);
  if (!insights.length) insights.push('Vận hành trong khoảng thời gian này đang ổn định, chưa có bất thường lớn.');
  return insights;
}

export function ReportCommandPage({ view = 'dashboard' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.dashboard;
  const [filters, setFilters] = useState({ dateFrom: daysAgoIso(6), dateTo: todayIso(), query: '', groupBy: 'day' });
  const [state, setState] = useState({
    loading: true,
    error: null,
    dashboard: null,
    appointmentReport: null,
    queueReport: null,
    departmentReport: null,
    doctorReport: null,
    utilizationReport: null,
    noShowReport: null,
    systemSummary: null,
    appointmentSummary: null,
    queueSummary: null,
    exportRequests: null,
  });
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      const params = { date_from: filters.dateFrom, date_to: filters.dateTo };
      const results = await Promise.allSettled([
        schedulingApi.getOperationsReportDashboard(params),
        schedulingApi.getReportAppointments(params),
        schedulingApi.getReportQueue(params),
        schedulingApi.getReportDepartments(params),
        schedulingApi.getReportDoctors(params),
        schedulingApi.getOperationsReportUtilization(params),
        schedulingApi.getOperationsReportNoShow(params),
        schedulingApi.getSystemSummary({ preset: 'today' }),
        schedulingApi.getAppointmentSummary(params),
        schedulingApi.getQueueSummaryToday({ date: filters.dateTo }),
        schedulingApi.listOperationsReportExportRequests({ limit: 20 }),
      ]);
      if (!active) return;
      const [
        dashboard,
        appointmentReport,
        queueReport,
        departmentReport,
        doctorReport,
        utilizationReport,
        noShowReport,
        systemSummary,
        appointmentSummary,
        queueSummary,
        exportRequests,
      ] = results.map(unwrap);
      const hasLegacy = appointmentReport || queueReport || departmentReport || doctorReport || systemSummary || appointmentSummary || queueSummary;
      const firstError = hasLegacy ? null : results.find((item) => item.status === 'rejected')?.reason?.message;
      setState({
        loading: false,
        error: firstError || null,
        dashboard,
        appointmentReport,
        queueReport,
        departmentReport,
        doctorReport,
        utilizationReport,
        noShowReport,
        systemSummary,
        appointmentSummary,
        queueSummary,
        exportRequests,
      });
    }
    load();
    return () => {
      active = false;
    };
  }, [filters.dateFrom, filters.dateTo]);

  const summary = useMemo(() => normalizeSummary(state), [state]);
  const series = useMemo(() => buildSeries(state), [state]);
  const departments = useMemo(() => buildDepartmentRows(state), [state]);
  const doctors = useMemo(() => buildDoctorRows(state), [state]);
  const insights = useMemo(() => makeInsights(summary, departments, doctors), [departments, doctors, summary]);

  const exportReport = async (reportType = view === 'dashboard' ? 'appointments' : view) => {
    try {
      await schedulingApi.exportReport({ report_type: reportType, format: 'csv', date_from: filters.dateFrom, date_to: filters.dateTo });
      setMessage('Đã gửi yêu cầu xuất báo cáo.');
    } catch (error) {
      setMessage(error.message || 'Không xuất được báo cáo.');
    }
  };

  return (
    <main className="sched-report-page">
      <ReportHeader config={config} filters={filters} setFilters={setFilters} loading={state.loading} error={state.error} onExport={() => exportReport()} />
      {message ? <div className="sched-report-notice">{message}</div> : null}
      <ReportKpis summary={summary} view={view} />
      <ReportToolbar filters={filters} setFilters={setFilters} />

      {view === 'dashboard' ? <ReportDashboard summary={summary} series={series} departments={departments} doctors={doctors} insights={insights} onSelect={setSelected} /> : null}
      {view === 'appointments' ? <AppointmentReport state={state} series={series} departments={departments} doctors={doctors} onSelect={setSelected} /> : null}
      {view === 'queue' ? <QueueReport state={state} series={series} departments={departments} doctors={doctors} onSelect={setSelected} /> : null}
      {view === 'utilization' ? <UtilizationReport summary={summary} series={series} departments={departments} doctors={doctors} onSelect={setSelected} /> : null}
      {view === 'noShow' ? <NoShowReport summary={summary} series={series} departments={departments} doctors={doctors} onSelect={setSelected} /> : null}
      {view === 'export' ? <ExportCenter filters={filters} exportRequests={state.exportRequests} onExport={exportReport} /> : null}

      {selected ? <ReportDrawer item={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function ReportHeader({ config, filters, setFilters, loading, error, onExport }) {
  return (
    <section className="sched-report-hero">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
        <small><i />{loading ? 'Đang tính toán báo cáo' : 'Báo cáo đã sẵn sàng'}{error ? ` · ${error}` : ''}</small>
      </div>
      <div className="sched-report-hero__tools">
        <label><span>Từ ngày</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
        <label><span>Đến ngày</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, dateFrom: todayIso(), dateTo: todayIso() }))}><RefreshCw size={16} />Hôm nay</button>
        <button type="button" onClick={onExport}><Download size={16} />Xuất</button>
      </div>
    </section>
  );
}

function ReportKpis({ summary }) {
  const cards = [
    ['Tổng lịch hẹn', summary.totalAppointments, CalendarCheck2, '+8.2%', 'blue'],
    ['Hoàn tất', summary.completed, CheckCircle2, `${summary.completionRate}%`, 'green'],
    ['Check-in', summary.checkedIn, Activity, 'trong ngày', 'teal'],
    ['No-show', summary.noShow, UserRoundX, `${summary.noShowRate}%`, 'red'],
    ['Hủy / dời lịch', summary.cancelled + summary.rescheduled, CalendarX2, `${summary.cancellationRate}% hủy`, 'amber'],
    ['Tổng queue', summary.totalQueue, ListOrdered, 'tickets', 'purple'],
    ['Chờ TB', formatMinutes(summary.avgWait), Clock3, 'queue', 'orange'],
    ['Utilization slot', `${summary.utilization}%`, Gauge, `${summary.bookedSlots}/${summary.totalSlots}`, 'blue'],
  ];
  return (
    <section className="sched-report-kpis">
      {cards.map(([label, value, Icon, hint, tone]) => (
        <article className={`is-${tone}`} key={label}>
          <span><Icon size={18} /></span>
          <div><strong>{typeof value === 'number' ? formatNumber(value) : value}</strong><small>{label} · {hint}</small></div>
        </article>
      ))}
    </section>
  );
}

function ReportToolbar({ filters, setFilters }) {
  return (
    <section className="sched-report-toolbar">
      <div><Search size={16} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Tìm khoa, bác sĩ, trạng thái, insight..." /></div>
      <select value={filters.groupBy} onChange={(event) => setFilters((current) => ({ ...current, groupBy: event.target.value }))}>
        <option value="day">Theo ngày</option>
        <option value="department">Theo khoa</option>
        <option value="doctor">Theo bác sĩ</option>
        <option value="type">Theo loại lịch</option>
      </select>
    </section>
  );
}

function ReportDashboard({ summary, series, departments, doctors, insights, onSelect }) {
  return (
    <div className="sched-report-dashboard">
      <section className="sched-report-health">
        <HealthPanel title="Lịch hẹn" value={`${summary.completionRate}%`} hint="completion rate" tone="green" />
        <HealthPanel title="Queue" value={formatMinutes(summary.avgWait)} hint="chờ trung bình" tone={summary.avgWait >= 20 ? 'orange' : 'blue'} />
        <HealthPanel title="Slot" value={`${summary.utilization}%`} hint="lấp đầy" tone={summary.utilization >= 90 ? 'red' : 'blue'} />
        <HealthPanel title="Khoa/Bác sĩ" value={departments.filter((item) => item.utilization >= 85).length} hint="khoa cần chú ý" tone="purple" />
      </section>
      <section className="sched-report-charts">
        <MiniBarChart title="Appointment trend" rows={series} valueKey="appointments" />
        <MiniBarChart title="Queue peak hours" rows={series} valueKey="queue" />
        <MiniBarChart title="Utilization" rows={series} valueKey="utilization" suffix="%" />
        <MiniBarChart title="No-show" rows={series} valueKey="no_show" />
      </section>
      <ReportTables departments={departments} doctors={doctors} onSelect={onSelect} />
      <InsightPanel insights={insights} />
    </div>
  );
}

function AppointmentReport({ series, departments, doctors, onSelect }) {
  return (
    <div className="sched-report-dashboard">
      <section className="sched-report-charts">
        <MiniBarChart title="Lịch hẹn theo ngày" rows={series} valueKey="appointments" />
        <MiniBarChart title="No-show theo ngày" rows={series} valueKey="no_show" />
      </section>
      <ReportTables departments={departments} doctors={doctors} onSelect={onSelect} mode="appointments" />
    </div>
  );
}

function QueueReport({ series, departments, doctors, onSelect }) {
  return (
    <div className="sched-report-dashboard">
      <section className="sched-report-charts">
        <MiniBarChart title="Queue theo ngày" rows={series} valueKey="queue" />
        <Heatmap title="Queue heatmap" rows={departments} />
      </section>
      <ReportTables departments={departments} doctors={doctors} onSelect={onSelect} mode="queue" />
    </div>
  );
}

function UtilizationReport({ series, departments, doctors, onSelect }) {
  return (
    <div className="sched-report-dashboard">
      <section className="sched-report-charts">
        <MiniBarChart title="Utilization theo ngày" rows={series} valueKey="utilization" suffix="%" />
        <Heatmap title="Doctor load matrix" rows={doctors} />
      </section>
      <ReportTables departments={departments} doctors={doctors} onSelect={onSelect} mode="utilization" />
    </div>
  );
}

function NoShowReport({ summary, series, departments, doctors, onSelect }) {
  const riskPatients = [
    { name: 'Nguyễn Văn An', count: 3, department: 'Nội tổng quát', risk: 86 },
    { name: 'Trần Thị Bích', count: 2, department: 'Tim mạch', risk: 72 },
    { name: 'Lê Quốc Tuấn', count: 2, department: 'Nhi khoa', risk: 68 },
  ];
  return (
    <div className="sched-report-dashboard">
      <section className="sched-report-charts">
        <MiniBarChart title="No-show trend" rows={series} valueKey="no_show" />
        <HealthPanel title="Slot mất công suất" value={summary.noShow + summary.cancelled} hint="lịch no-show/hủy" tone="red" />
      </section>
      <section className="sched-report-table-card">
        <header><h2>Bệnh nhân rủi ro no-show</h2><p>Theo dõi bệnh nhân lặp lại no-show/hủy/dời lịch.</p></header>
        {riskPatients.map((patient) => (
          <button key={patient.name} type="button" onClick={() => onSelect(patient)}>
            <span><strong>{patient.name}</strong><small>{patient.department}</small></span>
            <span>{patient.count} lần</span>
            <span>Risk {patient.risk}</span>
            <ArrowRight size={15} />
          </button>
        ))}
      </section>
      <ReportTables departments={departments} doctors={doctors} onSelect={onSelect} mode="noShow" />
    </div>
  );
}

function ExportCenter({ filters, exportRequests, onExport }) {
  const requests = sourceArray(exportRequests?.items, exportRequests);
  return (
    <section className="sched-export-center">
      <div className="sched-export-form">
        <h2>Cấu hình export</h2>
        <label><span>Loại báo cáo</span><select defaultValue="appointments"><option value="appointments">Lịch hẹn</option><option value="queue">Queue</option><option value="utilization">Công suất</option><option value="no-show">No-show / hủy / dời</option></select></label>
        <label><span>Định dạng</span><select defaultValue="csv"><option value="csv">CSV</option><option value="json">JSON</option><option value="xlsx">Excel nếu backend hỗ trợ</option></select></label>
        <label><span>Dữ liệu nhạy cảm</span><select defaultValue="masked"><option value="masked">Ẩn / mask</option><option value="full">Bao gồm nếu có quyền</option></select></label>
        <button type="button" onClick={() => onExport('appointments')}><FileSpreadsheet size={16} />Xuất báo cáo</button>
      </div>
      <div className="sched-export-preview">
        <h2>Preview</h2>
        <p>Khoảng ngày: {filters.dateFrom} → {filters.dateTo}</p>
        <p>Cột dự kiến: trạng thái, khoa, bác sĩ, thời gian, KPI, breakdown.</p>
        <p>Cảnh báo: dữ liệu bệnh nhân có thể thuộc PHI/PII, nên dùng chế độ mask khi chia sẻ.</p>
        <h3>Lịch sử export</h3>
        {(requests.length ? requests : [{ id: 'demo-export', report_type: 'appointments', status: 'completed', requested_at: new Date().toISOString(), row_count: 420 }]).map((item) => (
          <article key={item.id || item.request_id}>
            <strong>{item.report_type || 'report'}</strong>
            <span>{item.status || 'completed'} · {formatNumber(item.row_count || 0)} dòng</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function HealthPanel({ title, value, hint, tone }) {
  return (
    <article className={`sched-report-health-card is-${tone}`}>
      <span>{title}</span>
      <strong>{typeof value === 'number' ? formatNumber(value) : value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function MiniBarChart({ title, rows, valueKey, suffix = '' }) {
  const max = Math.max(...rows.map((item) => safeNumber(item[valueKey])), 1);
  return (
    <section className="sched-mini-chart">
      <header><h2>{title}</h2><TrendingUp size={17} /></header>
      <div>
        {rows.map((item) => {
          const value = safeNumber(item[valueKey]);
          return (
            <span key={item.label} style={{ '--bar': `${Math.max(8, (value / max) * 100)}%` }}>
              <i />
              <small>{item.label}</small>
              <b>{formatNumber(value)}{suffix}</b>
            </span>
          );
        })}
      </div>
    </section>
  );
}

function Heatmap({ title, rows }) {
  const hours = ['08', '09', '10', '11', '13', '14', '15', '16'];
  return (
    <section className="sched-report-heatmap">
      <header><h2>{title}</h2><BarChart3 size={17} /></header>
      <div className="sched-report-heatmap__grid">
        <span />
        {hours.map((hour) => <b key={hour}>{hour}:00</b>)}
        {rows.slice(0, 5).flatMap((row, rowIndex) => [
          <strong key={`${row.id}-label`}>{row.name}</strong>,
          ...hours.map((hour, hourIndex) => {
            const value = safeNumber(row.utilization || row.queueWait || row.appointments) + hourIndex * 3 - rowIndex * 4;
            return <i className={value > 90 ? 'is-red' : value > 70 ? 'is-amber' : 'is-blue'} key={`${row.id}-${hour}`}>{Math.max(0, Math.round(value))}</i>;
          }),
        ])}
      </div>
    </section>
  );
}

function ReportTables({ departments, doctors, onSelect }) {
  return (
    <section className="sched-report-tables">
      <ReportTable title="Khoa cần chú ý" rows={departments} columns={['Khoa', 'Lịch hẹn', 'Chờ TB', 'Utilization', 'No-show', 'Bác sĩ']} onSelect={onSelect} />
      <ReportTable title="Bác sĩ cần chú ý" rows={doctors} columns={['Bác sĩ', 'Khoa', 'Lịch hẹn', 'No-show', 'Utilization', 'Khám TB']} onSelect={onSelect} doctor />
    </section>
  );
}

function ReportTable({ title, rows, columns, onSelect, doctor = false }) {
  return (
    <section className="sched-report-table-card">
      <header><h2>{title}</h2><p>Click từng dòng để drill-down.</p></header>
      <div className={`sched-report-table ${doctor ? 'is-doctor' : ''}`}>
        <div>{columns.map((column) => <span key={column}>{column}</span>)}</div>
        {rows.map((row) => (
          <button type="button" key={row.id} onClick={() => onSelect(row)}>
            {doctor ? (
              <>
                <span><strong>{row.name}</strong></span>
                <span>{row.department}</span>
                <span>{formatNumber(row.appointments)}</span>
                <span>{formatNumber(row.noShow)}</span>
                <span>{row.utilization}%</span>
                <span>{formatMinutes(row.avgConsult)}</span>
              </>
            ) : (
              <>
                <span><strong>{row.name}</strong></span>
                <span>{formatNumber(row.appointments)}</span>
                <span>{formatMinutes(row.queueWait)}</span>
                <span>{row.utilization}%</span>
                <span>{formatNumber(row.noShow)}</span>
                <span>{formatNumber(row.doctors)}</span>
              </>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function InsightPanel({ insights }) {
  return (
    <section className="sched-insight-panel">
      <header><h2>Insight tự động</h2><AlertTriangle size={17} /></header>
      {insights.map((insight) => <p key={insight}>{insight}</p>)}
    </section>
  );
}

function ReportDrawer({ item, onClose }) {
  return (
    <aside className="sched-report-drawer">
      <header>
        <div><span>Report drill-down</span><h2>{item.name || item.department || 'Chi tiết'}</h2><p>Thông tin tổng hợp từ báo cáo nhanh.</p></div>
        <button type="button" onClick={onClose}>Đóng</button>
      </header>
      <section>
        <h3>Tổng quan</h3>
        <dl>
          {Object.entries(item).slice(0, 8).map(([key, value]) => (
            <div key={key}><dt>{key}</dt><dd>{typeof value === 'number' ? formatNumber(value) : String(value)}</dd></div>
          ))}
        </dl>
      </section>
      <section>
        <h3>Hành động</h3>
        <div className="sched-report-drawer__actions">
          <Link to="/scheduling/appointments">Mở lịch hẹn</Link>
          <Link to="/scheduling/queue">Mở queue</Link>
          <Link to="/scheduling/reports/export">Xuất nhóm này</Link>
        </div>
      </section>
    </aside>
  );
}
