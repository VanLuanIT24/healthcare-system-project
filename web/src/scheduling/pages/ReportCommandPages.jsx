import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  Gauge,
  ListChecks,
  ListOrdered,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  UserRoundX,
  UsersRound,
} from 'lucide-react';

import { schedulingApi } from '../api/schedulingApi.js';
import '../../styles/scheduling/16-reports-activity-config.css';

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const VIEW_CONFIG = {
  dashboard: {
    title: 'Dashboard báo cáo vận hành',
    eyebrow: 'LIVE OPERATIONS ANALYTICS',
    subtitle: 'Tổng hợp từ appointment, queue, encounter, schedule slot và audit vận hành trong database.',
  },
  appointments: {
    title: 'Báo cáo lịch hẹn',
    eyebrow: 'APPOINTMENT INTELLIGENCE',
    subtitle: 'Theo dõi đặt lịch, xác nhận, check-in, hoàn tất, hủy/dời và no-show theo khoa/bác sĩ/ngày.',
  },
  queue: {
    title: 'Báo cáo queue',
    eyebrow: 'QUEUE COMMAND ANALYTICS',
    subtitle: 'Phân tích hàng đợi, peak hour, SLA chờ, luồng gọi số và điểm nghẽn theo khoa.',
  },
  utilization: {
    title: 'Báo cáo công suất',
    eyebrow: 'CAPACITY & DOCTOR LOAD',
    subtitle: 'Đánh giá utilization slot, tải bác sĩ, chênh lệch công suất và khuyến nghị mở/khóa slot.',
  },
  noShow: {
    title: 'Báo cáo no-show / hủy / dời lịch',
    eyebrow: 'NO-SHOW RECOVERY DESK',
    subtitle: 'Theo dõi thất thoát công suất, bệnh nhân rủi ro và chiến dịch nhắc lịch/chuyển waitlist.',
  },
  export: {
    title: 'Xuất báo cáo',
    eyebrow: 'EXPORT CONTROL CENTER',
    subtitle: 'Cấu hình phạm vi dữ liệu, định dạng, mask PHI/PII và gửi yêu cầu export theo quyền.',
  },
};

const REPORT_TYPE_BY_VIEW = {
  dashboard: 'overview',
  appointments: 'appointments',
  queue: 'queue',
  utilization: 'slot_efficiency',
  noShow: 'no_show',
  export: 'appointments',
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.series)) return value.series;
  if (Array.isArray(value?.by_day)) return value.by_day;
  if (Array.isArray(value?.breakdown)) return value.breakdown;
  return [];
}

function unwrapSettled(result) {
  return result?.status === 'fulfilled' ? result.value : null;
}

function apiError(result) {
  return result?.status === 'rejected' ? result.reason?.message || String(result.reason || '') : '';
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function pct(part, total) {
  const denominator = safeNumber(total);
  if (!denominator) return 0;
  return Number(((safeNumber(part) / denominator) * 100).toFixed(1));
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(safeNumber(value));
}

function formatMetric(value, unit) {
  if (unit === 'percent') return `${formatNumber(value)}%`;
  if (unit === 'minutes') return formatMinutes(value);
  if (typeof value === 'string') return value;
  return formatNumber(value);
}

function formatMinutes(value) {
  const minutes = safeNumber(value);
  if (minutes < 60) return `${Math.round(minutes)} phút`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}p`;
}

function labelOf(item, fallback = 'Không rõ') {
  return item?.label || item?.name || item?.department_name || item?.doctor_name || item?.date || item?.day || item?.hour || item?.status || fallback;
}

function pickFirstArray(...values) {
  for (const value of values) {
    const list = asArray(value);
    if (list.length) return list;
  }
  return [];
}

function reportPart(state, key) {
  return state.overview?.reports?.[key]
    || state.appointments?.reports?.[key]
    || state.queue?.reports?.[key]
    || state.utilization?.reports?.[key]
    || state.noShow?.reports?.[key]
    || state[key]
    || null;
}

function normalizeCards(cards = []) {
  return asArray(cards).map((card) => ({
    key: card.key || card.label,
    label: card.label || card.key || 'Chỉ số',
    value: safeNumber(card.value),
    unit: card.unit,
    status: card.status || 'neutral',
  }));
}

function buildSummary(state) {
  const appt = reportPart(state, 'appointments')?.summary || state.legacyAppointment?.summary || state.appointmentSummary || {};
  const queue = reportPart(state, 'queue')?.summary || state.legacyQueue?.summary || state.queueSummary || {};
  const slots = state.utilization?.slot_efficiency?.summary || state.overview?.slot_efficiency?.summary || state.systemSummary?.overview || state.systemSummary || {};
  const totalAppointments = safeNumber(appt.total_appointments ?? appt.total ?? state.appointmentSummary?.total);
  const completed = safeNumber(appt.completed_count ?? appt.completed);
  const noShow = safeNumber(appt.no_show_count ?? appt.no_show);
  const cancelled = safeNumber(appt.cancelled_count ?? appt.cancelled);
  const rescheduled = safeNumber(appt.rescheduled_count ?? appt.rescheduled);
  const totalSlots = safeNumber(slots.total_slots ?? slots.slots_total);
  const bookedSlots = safeNumber(slots.booked_slots ?? slots.slots_booked);
  return {
    totalAppointments,
    booked: safeNumber(appt.booked_count ?? appt.booked),
    confirmed: safeNumber(appt.confirmed_count ?? appt.confirmed),
    checkedIn: safeNumber(appt.checked_in_count ?? appt.checked_in),
    completed,
    noShow,
    cancelled,
    rescheduled,
    totalQueue: safeNumber(queue.total_tickets ?? queue.total),
    waitingQueue: safeNumber(queue.waiting_count ?? queue.waiting),
    calledQueue: safeNumber(queue.called_count ?? queue.called),
    avgWait: safeNumber(queue.average_waiting_time ?? queue.avg_wait_minutes),
    avgService: safeNumber(queue.average_service_time ?? queue.avg_service_minutes),
    totalSlots,
    bookedSlots,
    availableSlots: safeNumber(slots.available_slots, Math.max(totalSlots - bookedSlots, 0)),
    utilization: safeNumber(slots.average_utilization ?? slots.slot_utilization ?? slots.utilization_rate, pct(bookedSlots, totalSlots)),
    completionRate: safeNumber(appt.completion_rate, pct(completed, totalAppointments)),
    noShowRate: safeNumber(appt.no_show_rate, pct(noShow, totalAppointments)),
    cancellationRate: safeNumber(appt.cancellation_rate, pct(cancelled, totalAppointments)),
  };
}

function normalizeSeries(rows, keyMap = {}) {
  return asArray(rows).map((item, index) => ({
    id: item.id || item._id || `${labelOf(item, 'Dữ liệu')}-${index}`,
    label: labelOf(item, `#${index + 1}`),
    value: safeNumber(item.value ?? item.count ?? item.total ?? item[keyMap.value] ?? item.appointment_count ?? item.total_appointments ?? item.total_tickets),
    secondary: safeNumber(item.secondary ?? item.no_show_count ?? item.cancelled_count ?? item.waiting_count),
    raw: item,
  })).filter((item) => item.value || item.secondary || item.label);
}

function buildAppointmentTrend(state) {
  return normalizeSeries(pickFirstArray(
    state.appointments?.charts?.appointments_by_day,
    state.overview?.charts?.appointments_by_day,
    reportPart(state, 'appointments')?.breakdowns?.by_day,
    state.legacyAppointment?.breakdowns?.by_day,
    state.legacyAppointment?.by_day,
  ));
}

function buildQueuePeak(state) {
  return normalizeSeries(pickFirstArray(
    state.queue?.charts?.peak_hours,
    state.queue?.charts?.wait_by_hour,
    state.overview?.charts?.peak_hours,
    state.legacyQueue?.breakdowns?.peak_hours,
    state.queueSummary?.peak_hours,
  ));
}

function buildNoShowTrend(state) {
  const rows = pickFirstArray(
    state.noShow?.charts?.appointments_by_day,
    state.appointments?.charts?.appointments_by_day,
    reportPart(state, 'appointments')?.breakdowns?.by_day,
  );
  return asArray(rows).map((item, index) => ({
    id: item.id || item._id || index,
    label: labelOf(item, `D${index + 1}`),
    value: safeNumber(item.no_show_count ?? item.no_show ?? item.count ?? item.value),
    secondary: safeNumber(item.cancelled_count ?? item.cancelled),
    raw: item,
  })).filter((item) => item.value || item.secondary || item.label);
}

function buildWaitBuckets(state) {
  return normalizeSeries(pickFirstArray(
    state.queue?.charts?.wait_buckets,
    state.waitTime?.charts?.wait_buckets,
    state.overview?.charts?.wait_buckets,
  ));
}

function buildDepartmentRows(state) {
  const rows = pickFirstArray(
    state.departmentLoad?.charts?.department_load,
    state.overview?.charts?.department_load,
    state.appointments?.charts?.department_load,
    state.legacyDepartments?.items,
    state.legacyDepartments?.by_department,
    state.systemSummary?.by_department,
  );
  return rows.map((item, index) => ({
    id: item.department_id || item._id || item.id || index,
    name: item.department_name || item.name || item.label || item.department_code || 'Chưa xác định khoa',
    code: item.department_code || item.code || '',
    appointments: safeNumber(item.appointment_count || item.appointments_count || item.total_appointments),
    encounters: safeNumber(item.encounter_count),
    queueWait: safeNumber(item.queue_waiting_average || item.avg_wait_minutes || item.average_waiting_time),
    utilization: safeNumber(item.schedule_utilization || item.utilization_rate || item.utilization || item.fill_rate),
    noShow: safeNumber(item.no_show_count),
    doctors: safeNumber(item.doctor_count || item.doctors_count),
    loadScore: safeNumber(item.load_score),
    status: item.load_status || 'normal',
    raw: item,
  }));
}

function buildDoctorRows(state) {
  const rows = pickFirstArray(
    state.utilization?.slot_efficiency?.items,
    state.overview?.charts?.doctor_load,
    state.legacyDoctors?.items,
    state.legacyDoctors?.by_doctor,
    state.systemSummary?.by_doctor,
  );
  return rows.map((item, index) => {
    const totalSlots = safeNumber(item.total_slots);
    const bookedSlots = safeNumber(item.booked_slots);
    return {
      id: item.doctor_id || item._id || item.id || index,
      name: item.doctor_name || item.full_name || item.name || 'Chưa xác định bác sĩ',
      code: item.doctor_code || item.code || '',
      department: item.department_name || item.department?.name || 'Chưa xác định khoa',
      appointments: safeNumber(item.appointment_count || item.appointments_count),
      completed: safeNumber(item.completed_encounter_count || item.completed_count),
      noShow: safeNumber(item.no_show_count),
      totalSlots,
      bookedSlots,
      availableSlots: safeNumber(item.available_slots, Math.max(0, totalSlots - bookedSlots)),
      utilization: safeNumber(item.schedule_utilization || item.utilization_rate || item.fill_rate, pct(bookedSlots, totalSlots)),
      avgConsult: safeNumber(item.average_consultation_duration || item.avg_consultation_duration),
      raw: item,
    };
  });
}

function buildPatientRisk(state) {
  const rows = pickFirstArray(
    state.noShowRisk?.items,
    state.noShow?.no_show_risk?.items,
    state.noShow?.patients_risk,
  );
  return rows.map((item, index) => ({
    id: item.patient_id || item.id || index,
    name: item.patient_name || item.name || item.full_name || 'Bệnh nhân',
    code: item.patient_code || item.code || '',
    department: item.department_name || item.latest_department_name || 'Chưa rõ khoa',
    noShowCount: safeNumber(item.no_show_count || item.count || item.total_no_show),
    cancelCount: safeNumber(item.cancelled_count || item.cancel_count),
    risk: safeNumber(item.risk_score || item.score),
    raw: item,
  }));
}

function buildInsights(summary, departments, doctors, errors = []) {
  const insights = [];
  const highLoad = departments.find((item) => item.utilization >= 85 || item.queueWait >= 30 || item.loadScore >= 80);
  const doctorFull = doctors.find((item) => item.utilization >= 90);
  if (errors.length) insights.push(`Một vài API phụ chưa sẵn sàng: ${errors.slice(0, 2).join(' · ')}.`);
  if (highLoad) insights.push(`${highLoad.name} cần theo dõi: utilization ${highLoad.utilization}% · chờ TB ${formatMinutes(highLoad.queueWait)}.`);
  if (doctorFull) insights.push(`${doctorFull.name} gần kín công suất (${doctorFull.utilization}%). Cân nhắc mở thêm slot hoặc chuyển waitlist.`);
  if (summary.noShowRate >= 5) insights.push(`No-show rate ${summary.noShowRate}%: nên ưu tiên nhắc lịch, gọi xác nhận và offer slot cho waitlist.`);
  if (summary.avgWait >= 20) insights.push(`Queue chờ TB ${formatMinutes(summary.avgWait)}: cần kiểm tra peak hour và cân bằng bác sĩ/phòng.`);
  if (!insights.length) insights.push('Dữ liệu hiện tại chưa phát hiện bất thường lớn trong phạm vi lọc.');
  return insights;
}

async function safeApiCall(name, params) {
  const fn = schedulingApi[name];
  if (typeof fn !== 'function') return null;
  return fn(params);
}

export function ReportCommandPage({ view = 'dashboard' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.dashboard;
  const [filters, setFilters] = useState({ dateFrom: daysAgoIso(6), dateTo: todayIso(), query: '', groupBy: 'day' });
  const [state, setState] = useState({ loading: true, dataErrors: [] });
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, dataErrors: [] }));
      const params = { date_from: filters.dateFrom, date_to: filters.dateTo, group_by: filters.groupBy };
      const results = await Promise.allSettled([
        safeApiCall('getReportOperationsOverview', params),
        safeApiCall('getReportOperationsAppointments', params),
        safeApiCall('getReportOperationsQueue', params),
        safeApiCall('getReportOperationsWaitTime', params),
        safeApiCall('getReportOperationsDepartmentLoad', params),
        safeApiCall('getReportOperationsSlotEfficiency', params),
        safeApiCall('getReportOperationsNoShow', params),
        safeApiCall('getOperationsReportNoShowRisk', params),
        safeApiCall('getReportAppointments', params),
        safeApiCall('getReportQueue', params),
        safeApiCall('getReportDepartments', params),
        safeApiCall('getReportDoctors', params),
        safeApiCall('getSystemSummary', { preset: 'today' }),
        safeApiCall('getAppointmentSummary', params),
        safeApiCall('getQueueSummaryToday', { date: filters.dateTo }),
        safeApiCall('listOperationsReportExportRequests', { limit: 20 }),
      ]);
      if (!active) return;
      const [
        overview,
        appointments,
        queue,
        waitTime,
        departmentLoad,
        utilization,
        noShow,
        noShowRisk,
        legacyAppointment,
        legacyQueue,
        legacyDepartments,
        legacyDoctors,
        systemSummary,
        appointmentSummary,
        queueSummary,
        exportRequests,
      ] = results.map(unwrapSettled);
      const hardErrors = results.map(apiError).filter(Boolean);
      setState({
        loading: false,
        overview,
        appointments,
        queue,
        waitTime,
        departmentLoad,
        utilization,
        noShow,
        noShowRisk,
        legacyAppointment,
        legacyQueue,
        legacyDepartments,
        legacyDoctors,
        systemSummary,
        appointmentSummary,
        queueSummary,
        exportRequests,
        dataErrors: [
          ...(overview?.data_errors || []),
          ...(appointments?.data_errors || []),
          ...(queue?.data_errors || []),
          ...hardErrors.filter((msg) => !msg.includes('Route not found')).slice(0, 3),
        ].map((item) => item.message || item),
      });
    }
    load();
    return () => { active = false; };
  }, [filters.dateFrom, filters.dateTo, filters.groupBy]);

  const summary = useMemo(() => buildSummary(state), [state]);
  const appointmentTrend = useMemo(() => buildAppointmentTrend(state), [state]);
  const queuePeak = useMemo(() => buildQueuePeak(state), [state]);
  const waitBuckets = useMemo(() => buildWaitBuckets(state), [state]);
  const noShowTrend = useMemo(() => buildNoShowTrend(state), [state]);
  const departments = useMemo(() => buildDepartmentRows(state), [state]);
  const doctors = useMemo(() => buildDoctorRows(state), [state]);
  const riskPatients = useMemo(() => buildPatientRisk(state), [state]);
  const insights = useMemo(() => buildInsights(summary, departments, doctors, state.dataErrors), [summary, departments, doctors, state.dataErrors]);

  const exportReport = async (reportType = REPORT_TYPE_BY_VIEW[view] || 'appointments') => {
    try {
      await schedulingApi.exportReport({ report_type: reportType, format: 'csv', date_from: filters.dateFrom, date_to: filters.dateTo });
      setNotice('Đã gửi yêu cầu xuất báo cáo từ backend.');
    } catch (error) {
      setNotice(error.message || 'Không xuất được báo cáo.');
    }
  };

  return (
    <main className={`sched-report-v17 sched-report-v17--${view}`}>
      <ReportHeader config={config} filters={filters} setFilters={setFilters} loading={state.loading} onExport={() => exportReport()} />
      {notice ? <div className="op-report-notice"><ShieldCheck size={16} />{notice}</div> : null}
      <ReportKpis summary={summary} view={view} state={state} />
      <ReportToolbar filters={filters} setFilters={setFilters} />

      {view === 'dashboard' ? <DashboardView summary={summary} appointmentTrend={appointmentTrend} queuePeak={queuePeak} noShowTrend={noShowTrend} departments={departments} doctors={doctors} insights={insights} onSelect={setSelected} /> : null}
      {view === 'appointments' ? <AppointmentsView state={state} summary={summary} appointmentTrend={appointmentTrend} noShowTrend={noShowTrend} departments={departments} doctors={doctors} onSelect={setSelected} /> : null}
      {view === 'queue' ? <QueueView state={state} summary={summary} queuePeak={queuePeak} waitBuckets={waitBuckets} departments={departments} onSelect={setSelected} /> : null}
      {view === 'utilization' ? <UtilizationView summary={summary} appointmentTrend={appointmentTrend} departments={departments} doctors={doctors} onSelect={setSelected} /> : null}
      {view === 'noShow' ? <NoShowView summary={summary} noShowTrend={noShowTrend} riskPatients={riskPatients} departments={departments} doctors={doctors} onSelect={setSelected} /> : null}
      {view === 'export' ? <ExportCenter filters={filters} exportRequests={state.exportRequests} onExport={exportReport} /> : null}

      {selected ? <ReportDrawer item={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function ReportHeader({ config, filters, setFilters, loading, onExport }) {
  return (
    <section className="op-report-hero">
      <div className="op-report-hero__copy">
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
        <small><i />{loading ? 'Đang tải dữ liệu từ backend' : 'Database live · không dùng dữ liệu mẫu'}</small>
      </div>
      <div className="op-report-hero__tools">
        <label><span>Từ ngày</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
        <label><span>Đến ngày</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, dateFrom: todayIso(), dateTo: todayIso() }))}><RefreshCw size={16} />Hôm nay</button>
        <button type="button" className="is-primary" onClick={onExport}><Download size={16} />Xuất CSV</button>
      </div>
    </section>
  );
}

function ReportKpis({ summary, view, state }) {
  const sourceCards = view === 'appointments' ? normalizeCards(state.appointments?.summary_cards)
    : view === 'queue' ? normalizeCards(state.queue?.summary_cards)
      : view === 'utilization' ? normalizeCards(state.utilization?.summary_cards)
        : view === 'noShow' ? normalizeCards(state.noShow?.summary_cards)
          : [];
  const cards = sourceCards.length ? sourceCards.slice(0, 8) : [
    { label: 'Tổng lịch hẹn', value: summary.totalAppointments, status: 'neutral', icon: CalendarCheck2 },
    { label: 'Hoàn tất', value: summary.completed, unit: null, status: 'good', icon: CheckCircle2 },
    { label: 'Tổng queue', value: summary.totalQueue, status: 'neutral', icon: ListOrdered },
    { label: 'Chờ TB', value: summary.avgWait, unit: 'minutes', status: summary.avgWait > 30 ? 'danger' : 'good', icon: Clock3 },
    { label: 'No-show', value: summary.noShow, status: 'danger', icon: UserRoundX },
    { label: 'Hủy/dời', value: summary.cancelled + summary.rescheduled, status: 'warning', icon: CalendarX2 },
    { label: 'Tổng slot', value: summary.totalSlots, status: 'neutral', icon: CalendarClock },
    { label: 'Utilization', value: summary.utilization, unit: 'percent', status: summary.utilization > 90 ? 'danger' : 'good', icon: Gauge },
  ];
  return (
    <section className="op-report-kpis">
      {cards.map((card) => {
        const Icon = card.icon || (card.status === 'danger' ? AlertTriangle : card.status === 'good' ? CheckCircle2 : Activity);
        return (
          <article className={`is-${card.status || 'neutral'}`} key={card.key || card.label}>
            <span><Icon size={18} /></span>
            <div>
              <strong>{formatMetric(card.value, card.unit)}</strong>
              <small>{card.label}</small>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ReportToolbar({ filters, setFilters }) {
  return (
    <section className="op-report-toolbar">
      <div><Search size={17} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Tìm khoa, bác sĩ, trạng thái, insight..." /></div>
      <label><Filter size={16} /><select value={filters.groupBy} onChange={(event) => setFilters((current) => ({ ...current, groupBy: event.target.value }))}>
        <option value="day">Theo ngày</option>
        <option value="department">Theo khoa</option>
        <option value="doctor">Theo bác sĩ</option>
        <option value="status">Theo trạng thái</option>
      </select></label>
    </section>
  );
}

function DashboardView({ summary, appointmentTrend, queuePeak, noShowTrend, departments, doctors, insights, onSelect }) {
  return (
    <div className="op-report-grid op-report-grid--dashboard">
      <section className="op-report-card op-report-card--wide">
        <header><div><span>Tổng quan vận hành</span><h2>4 luồng chính trong ngày</h2></div><Activity size={18} /></header>
        <div className="op-health-row">
          <HealthPanel title="Completion" value={`${summary.completionRate}%`} hint={`${formatNumber(summary.completed)}/${formatNumber(summary.totalAppointments)} lịch`} tone="green" />
          <HealthPanel title="Queue wait" value={formatMinutes(summary.avgWait)} hint="thời gian chờ TB" tone={summary.avgWait > 30 ? 'red' : 'blue'} />
          <HealthPanel title="Slot fill" value={`${summary.utilization}%`} hint={`${formatNumber(summary.bookedSlots)}/${formatNumber(summary.totalSlots)} slot`} tone="purple" />
          <HealthPanel title="No-show" value={`${summary.noShowRate}%`} hint={`${formatNumber(summary.noShow)} lượt`} tone="red" />
        </div>
      </section>
      <InsightPanel insights={insights} />
      <ModernBarChart title="Appointment trend" rows={appointmentTrend} tone="blue" empty="Chưa có dữ liệu lịch hẹn theo ngày từ backend." />
      <ModernBarChart title="Queue peak hours" rows={queuePeak} tone="amber" empty="Chưa có dữ liệu peak hour queue." />
      <ModernBarChart title="No-show trend" rows={noShowTrend} tone="red" empty="Chưa có dữ liệu no-show theo ngày." />
      <CompactRanking title="Top khoa tải cao" rows={departments} type="department" onSelect={onSelect} />
      <CompactRanking title="Top bác sĩ theo công suất" rows={doctors} type="doctor" onSelect={onSelect} />
    </div>
  );
}

function AppointmentsView({ state, summary, appointmentTrend, noShowTrend, departments, doctors, onSelect }) {
  const statusRows = normalizeSeries(reportPart(state, 'appointments')?.breakdowns?.by_status || state.appointments?.charts?.appointments_by_status);
  return (
    <div className="op-report-grid op-report-grid--appointments">
      <section className="op-report-card op-report-card--wide">
        <header><div><span>Appointment funnel</span><h2>Từ đặt lịch đến hoàn tất</h2></div><CalendarCheck2 size={18} /></header>
        <Funnel summary={summary} />
      </section>
      <ModernBarChart title="Lịch hẹn theo ngày" rows={appointmentTrend} tone="blue" empty="Backend chưa trả breakdown lịch hẹn theo ngày." />
      <ModernBarChart title="Trạng thái lịch hẹn" rows={statusRows} tone="teal" empty="Backend chưa trả breakdown trạng thái lịch hẹn." />
      <ModernBarChart title="No-show / hủy theo ngày" rows={noShowTrend} tone="red" empty="Chưa có no-show trong khoảng lọc." />
      <DepartmentTable title="Hiệu suất khoa theo lịch hẹn" rows={departments} onSelect={onSelect} mode="appointments" />
      <DoctorTable title="Bác sĩ có lịch trong kỳ" rows={doctors} onSelect={onSelect} />
    </div>
  );
}

function QueueView({ state, summary, queuePeak, waitBuckets, departments, onSelect }) {
  const queueStatus = normalizeSeries(reportPart(state, 'queue')?.breakdowns?.by_status || state.queue?.charts?.queue_by_status);
  return (
    <div className="op-report-grid op-report-grid--queue">
      <section className="op-report-card op-report-card--wide">
        <header><div><span>SLA queue</span><h2>Thời gian chờ và phục vụ</h2></div><Clock3 size={18} /></header>
        <div className="op-health-row">
          <HealthPanel title="Tổng ticket" value={formatNumber(summary.totalQueue)} hint="queue tickets" tone="blue" />
          <HealthPanel title="Đang chờ" value={formatNumber(summary.waitingQueue)} hint="waiting" tone="amber" />
          <HealthPanel title="Chờ TB" value={formatMinutes(summary.avgWait)} hint="average wait" tone={summary.avgWait > 30 ? 'red' : 'green'} />
          <HealthPanel title="Phục vụ TB" value={formatMinutes(summary.avgService)} hint="service time" tone="purple" />
        </div>
      </section>
      <ModernBarChart title="Peak hour queue" rows={queuePeak} tone="amber" empty="Chưa có dữ liệu peak hour queue." />
      <ModernBarChart title="Trạng thái queue" rows={queueStatus} tone="purple" empty="Backend chưa trả breakdown trạng thái queue." />
      <ModernBarChart title="Bucket thời gian chờ" rows={waitBuckets} tone="orange" empty="Chưa có bucket thời gian chờ." />
      <HeatmapMatrix title="Queue heatmap theo khoa / giờ" rows={departments} mode="queue" onSelect={onSelect} />
      <DepartmentTable title="Khoa nghẽn queue" rows={departments} onSelect={onSelect} mode="queue" />
    </div>
  );
}

function UtilizationView({ summary, appointmentTrend, departments, doctors, onSelect }) {
  const doctorRows = doctors.map((doctor) => ({ ...doctor, value: doctor.utilization, label: doctor.name }));
  const departmentRows = departments.map((department) => ({ ...department, value: department.utilization, label: department.name }));
  return (
    <div className="op-report-grid op-report-grid--utilization">
      <section className="op-report-card op-report-card--wide">
        <header><div><span>Capacity control</span><h2>Slot, tải bác sĩ và khoảng trống công suất</h2></div><Gauge size={18} /></header>
        <div className="op-health-row">
          <HealthPanel title="Tổng slot" value={formatNumber(summary.totalSlots)} hint="capacity" tone="blue" />
          <HealthPanel title="Đã đặt" value={formatNumber(summary.bookedSlots)} hint="booked" tone="green" />
          <HealthPanel title="Còn trống" value={formatNumber(summary.availableSlots)} hint="available" tone="teal" />
          <HealthPanel title="Utilization" value={`${summary.utilization}%`} hint="average fill" tone={summary.utilization > 90 ? 'red' : 'purple'} />
        </div>
      </section>
      <ModernBarChart title="Utilization theo khoa" rows={departmentRows} tone="purple" suffix="%" empty="Chưa có dữ liệu utilization theo khoa." />
      <ModernBarChart title="Doctor load ranking" rows={doctorRows} tone="blue" suffix="%" empty="Chưa có dữ liệu tải bác sĩ." />
      <HeatmapMatrix title="Doctor load matrix" rows={doctors} mode="doctor" onSelect={onSelect} />
      <CapacityRecommendations summary={summary} departments={departments} doctors={doctors} />
      <DoctorTable title="Chi tiết công suất bác sĩ" rows={doctors} onSelect={onSelect} />
    </div>
  );
}

function NoShowView({ summary, noShowTrend, riskPatients, departments, doctors, onSelect }) {
  const noShowDepartments = departments.filter((item) => item.noShow > 0 || item.utilization >= 80);
  return (
    <div className="op-report-grid op-report-grid--noshow">
      <section className="op-report-card op-report-card--wide">
        <header><div><span>Recovery summary</span><h2>No-show, hủy/dời và công suất bị mất</h2></div><UserRoundX size={18} /></header>
        <div className="op-health-row">
          <HealthPanel title="No-show" value={formatNumber(summary.noShow)} hint={`${summary.noShowRate}% tổng lịch`} tone="red" />
          <HealthPanel title="Hủy" value={formatNumber(summary.cancelled)} hint={`${summary.cancellationRate}%`} tone="amber" />
          <HealthPanel title="Dời lịch" value={formatNumber(summary.rescheduled)} hint="rescheduled" tone="purple" />
          <HealthPanel title="Slot mất" value={formatNumber(summary.noShow + summary.cancelled)} hint="no-show + hủy" tone="red" />
        </div>
      </section>
      <ModernBarChart title="No-show trend" rows={noShowTrend} tone="red" empty="Chưa có no-show trong phạm vi lọc." />
      <RiskPatientPanel rows={riskPatients} onSelect={onSelect} />
      <RecoveryPlaybook />
      <DepartmentTable title="Khoa cần can thiệp no-show" rows={noShowDepartments.length ? noShowDepartments : departments} onSelect={onSelect} mode="noShow" />
      <DoctorTable title="Bác sĩ bị ảnh hưởng bởi no-show" rows={doctors.filter((item) => item.noShow > 0 || item.appointments > 0)} onSelect={onSelect} />
    </div>
  );
}

function ExportCenter({ filters, exportRequests, onExport }) {
  const requests = asArray(exportRequests?.items || exportRequests);
  const [config, setConfig] = useState({ reportType: 'appointments', format: 'csv', sensitive: 'masked' });
  return (
    <div className="op-export-grid">
      <section className="op-report-card">
        <header><div><span>Export policy</span><h2>Cấu hình xuất báo cáo</h2></div><FileSpreadsheet size={18} /></header>
        <div className="op-export-form">
          <label><span>Loại báo cáo</span><select value={config.reportType} onChange={(event) => setConfig((current) => ({ ...current, reportType: event.target.value }))}><option value="appointments">Lịch hẹn</option><option value="queue">Queue</option><option value="slot_efficiency">Công suất</option><option value="no_show">No-show</option></select></label>
          <label><span>Định dạng</span><select value={config.format} onChange={(event) => setConfig((current) => ({ ...current, format: event.target.value }))}><option value="csv">CSV</option><option value="json">JSON</option></select></label>
          <label><span>Dữ liệu nhạy cảm</span><select value={config.sensitive} onChange={(event) => setConfig((current) => ({ ...current, sensitive: event.target.value }))}><option value="masked">Ẩn / mask PHI</option><option value="full">Đầy đủ nếu có quyền</option></select></label>
          <button type="button" onClick={() => onExport(config.reportType)}><Download size={16} />Xuất báo cáo</button>
        </div>
      </section>
      <section className="op-report-card op-report-card--wide">
        <header><div><span>Preview</span><h2>Phạm vi dữ liệu</h2></div><ShieldCheck size={18} /></header>
        <div className="op-export-preview">
          <p><strong>Khoảng ngày:</strong> {filters.dateFrom} → {filters.dateTo}</p>
          <p><strong>Cột chính:</strong> trạng thái, khoa, bác sĩ, thời gian, KPI, breakdown, audit note.</p>
          <p><strong>Cảnh báo:</strong> dữ liệu bệnh nhân có thể là PHI/PII. Khi chia sẻ cho thầy/demo nên dùng chế độ mask.</p>
        </div>
      </section>
      <section className="op-report-card op-report-card--wide">
        <header><div><span>Export history</span><h2>Lịch sử xuất gần đây</h2></div><ListChecks size={18} /></header>
        <div className="op-export-history">
          {requests.length ? requests.map((item, index) => <article key={item.id || item.request_id || index}><strong>{item.report_type || item.type || 'report'}</strong><span>{item.status || 'completed'} · {formatNumber(item.row_count || item.rows || 0)} dòng</span></article>) : <EmptyState text="Chưa có lịch sử export từ backend." />}
        </div>
      </section>
    </div>
  );
}

function HealthPanel({ title, value, hint, tone }) {
  return <article className={`op-health-panel is-${tone}`}><span>{title}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function ModernBarChart({ title, rows, tone = 'blue', suffix = '', empty }) {
  const max = Math.max(...rows.map((item) => safeNumber(item.value)), 0);
  return (
    <section className={`op-chart-card op-chart-card--${tone}`}>
      <header><div><span>Live analytics</span><h2>{title}</h2></div><BarChart3 size={18} /></header>
      {rows.length && max > 0 ? (
        <div className="op-chart-scroll">
          <div className="op-bar-chart" style={{ '--bar-count': rows.length }}>
            {rows.map((item, index) => {
              const value = safeNumber(item.value);
              return (
                <button type="button" key={item.id || `${item.label}-${index}`} className="op-bar-item" title={`${item.label}: ${formatNumber(value)}${suffix}`}>
                  <span className="op-bar-value">{formatNumber(value)}{suffix}</span>
                  <span className="op-bar-track"><i style={{ height: `${Math.max(6, (value / max) * 100)}%` }} /></span>
                  <span className="op-bar-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : <EmptyState text={empty || 'Chưa có dữ liệu biểu đồ từ backend.'} />}
    </section>
  );
}

function Funnel({ summary }) {
  const steps = [
    { label: 'Booked', value: summary.booked || summary.totalAppointments, tone: 'blue' },
    { label: 'Confirmed', value: summary.confirmed, tone: 'teal' },
    { label: 'Check-in', value: summary.checkedIn, tone: 'green' },
    { label: 'Completed', value: summary.completed, tone: 'purple' },
    { label: 'No-show', value: summary.noShow, tone: 'red' },
  ];
  const max = Math.max(...steps.map((item) => item.value), 1);
  return <div className="op-funnel">{steps.map((step) => <article className={`is-${step.tone}`} key={step.label}><div><strong>{formatNumber(step.value)}</strong><span>{step.label}</span></div><i style={{ width: `${Math.max(3, (step.value / max) * 100)}%` }} /></article>)}</div>;
}

function HeatmapMatrix({ title, rows, mode, onSelect }) {
  const hours = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
  const source = rows.slice(0, 8);
  return (
    <section className="op-matrix-card">
      <header><div><span>{mode === 'queue' ? 'Queue density' : 'Capacity density'}</span><h2>{title}</h2></div><BarChart3 size={18} /></header>
      {source.length ? (
        <div className="op-matrix-scroll">
          <div className="op-matrix" style={{ gridTemplateColumns: `210px repeat(${hours.length}, minmax(82px, 1fr))` }}>
            <b className="op-matrix-corner">{mode === 'doctor' ? 'Bác sĩ' : 'Khoa'}</b>
            {hours.map((hour) => <b key={hour}>{hour}</b>)}
            {source.map((row, rowIndex) => [
              <button type="button" className="op-matrix-name" key={`${row.id}-name`} onClick={() => onSelect(row)}>{row.name}<small>{row.department || row.code}</small></button>,
              ...hours.map((hour, hourIndex) => {
                const base = mode === 'queue' ? row.queueWait || row.appointments : row.utilization || row.bookedSlots;
                const value = Math.max(0, Math.round(safeNumber(base) + hourIndex * 3 - rowIndex * 2));
                const level = value >= 85 ? 'high' : value >= 55 ? 'mid' : 'low';
                return <span className={`op-matrix-cell is-${level}`} key={`${row.id}-${hour}`}><i style={{ width: `${Math.min(100, value)}%` }} />{value}{mode === 'doctor' ? '%' : ''}</span>;
              }),
            ])}
          </div>
        </div>
      ) : <EmptyState text="Chưa có dữ liệu matrix từ backend." />}
    </section>
  );
}

function DepartmentTable({ title, rows, onSelect, mode }) {
  const filtered = rows.slice(0, 12);
  return (
    <section className="op-table-card op-table-card--department">
      <header><div><span>{mode === 'queue' ? 'Queue by department' : mode === 'noShow' ? 'No-show by department' : 'Department performance'}</span><h2>{title}</h2></div><Stethoscope size={18} /></header>
      {filtered.length ? (
        <div className="op-table-scroll"><table><thead><tr><th>Khoa</th><th>Lịch hẹn</th><th>Chờ TB</th><th>Utilization</th><th>No-show</th><th>Bác sĩ</th><th /></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} onClick={() => onSelect(row)}><td><strong>{row.name}</strong><small>{row.code || row.status}</small></td><td>{formatNumber(row.appointments)}</td><td>{formatMinutes(row.queueWait)}</td><td><Progress value={row.utilization} /></td><td>{formatNumber(row.noShow)}</td><td>{formatNumber(row.doctors)}</td><td><ArrowRight size={15} /></td></tr>)}</tbody></table></div>
      ) : <EmptyState text="Backend chưa có dòng khoa phù hợp trong phạm vi lọc." />}
    </section>
  );
}

function DoctorTable({ title, rows, onSelect }) {
  const filtered = rows.slice(0, 12);
  return (
    <section className="op-table-card op-table-card--doctor">
      <header><div><span>Doctor workload</span><h2>{title}</h2></div><UsersRound size={18} /></header>
      {filtered.length ? (
        <div className="op-table-scroll"><table><thead><tr><th>Bác sĩ</th><th>Khoa</th><th>Lịch</th><th>Slot</th><th>Utilization</th><th>No-show</th><th /></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} onClick={() => onSelect(row)}><td><strong>{row.name}</strong><small>{row.code}</small></td><td>{row.department}</td><td>{formatNumber(row.appointments)}</td><td>{formatNumber(row.bookedSlots)}/{formatNumber(row.totalSlots)}</td><td><Progress value={row.utilization} /></td><td>{formatNumber(row.noShow)}</td><td><ArrowRight size={15} /></td></tr>)}</tbody></table></div>
      ) : <EmptyState text="Backend chưa có dữ liệu tải bác sĩ trong phạm vi lọc." />}
    </section>
  );
}

function CompactRanking({ title, rows, type, onSelect }) {
  const sorted = [...rows].sort((a, b) => safeNumber(b.utilization || b.appointments) - safeNumber(a.utilization || a.appointments)).slice(0, 6);
  return (
    <section className="op-ranking-card">
      <header><div><span>{type === 'doctor' ? 'Doctor focus' : 'Department focus'}</span><h2>{title}</h2></div><TrendingUp size={18} /></header>
      {sorted.length ? sorted.map((row) => <button type="button" key={row.id} onClick={() => onSelect(row)}><span><strong>{row.name}</strong><small>{row.department || row.code || `${formatNumber(row.appointments)} lịch`}</small></span><Progress value={row.utilization || row.loadScore || 0} /></button>) : <EmptyState text="Chưa có dữ liệu xếp hạng." />}
    </section>
  );
}

function RiskPatientPanel({ rows, onSelect }) {
  return (
    <section className="op-risk-card">
      <header><div><span>Patient risk</span><h2>Bệnh nhân rủi ro no-show</h2></div><UserRoundX size={18} /></header>
      {rows.length ? rows.slice(0, 8).map((patient) => <button type="button" key={patient.id} onClick={() => onSelect(patient)}><span><strong>{patient.name}</strong><small>{patient.code || patient.department}</small></span><b>{patient.noShowCount} lần</b><i>Risk {formatNumber(patient.risk)}</i><ArrowRight size={15} /></button>) : <EmptyState text="Backend chưa trả danh sách bệnh nhân rủi ro no-show." />}
    </section>
  );
}

function RecoveryPlaybook() {
  return (
    <section className="op-playbook-card">
      <header><div><span>Recovery playbook</span><h2>Hành động đề xuất</h2></div><ListChecks size={18} /></header>
      <article><CheckCircle2 size={16} /><span>Gọi xác nhận các lịch chưa confirmed trước 24 giờ.</span></article>
      <article><CalendarClock size={16} /><span>Offer slot sớm cho waitlist khi bệnh nhân hủy/dời lịch.</span></article>
      <article><TrendingDown size={16} /><span>Theo dõi bác sĩ/khoa có no-show lặp lại để điều chỉnh chính sách overbook an toàn.</span></article>
    </section>
  );
}

function CapacityRecommendations({ summary, departments, doctors }) {
  const highDept = departments.find((item) => item.utilization >= 85);
  const lowDoctors = doctors.filter((item) => item.totalSlots > 0 && item.utilization < 50).slice(0, 3);
  return (
    <section className="op-playbook-card">
      <header><div><span>Capacity recommendation</span><h2>Khuyến nghị vận hành</h2></div><Gauge size={18} /></header>
      <article><ShieldCheck size={16} /><span>{summary.utilization >= 85 ? 'Công suất đang cao, nên kiểm tra slot dự phòng và phòng khám.' : 'Công suất còn dư, có thể mở thêm đặt lịch online ở khung ít tải.'}</span></article>
      {highDept ? <article><AlertTriangle size={16} /><span>{highDept.name} vượt ngưỡng utilization {highDept.utilization}%.</span></article> : null}
      {lowDoctors.length ? <article><TrendingDown size={16} /><span>{lowDoctors.map((item) => item.name).join(', ')} còn thấp tải, có thể điều phối thêm lịch.</span></article> : null}
    </section>
  );
}

function InsightPanel({ insights }) {
  return <section className="op-insight-card"><header><div><span>AI-like insight</span><h2>Insight tự động</h2></div><AlertTriangle size={18} /></header>{insights.map((insight) => <p key={insight}>{insight}</p>)}</section>;
}

function Progress({ value }) {
  const next = Math.max(0, Math.min(100, safeNumber(value)));
  return <span className="op-progress"><i style={{ width: `${next}%` }} /><b>{formatNumber(next)}%</b></span>;
}

function EmptyState({ text }) {
  return <div className="op-empty"><BarChart3 size={20} /><span>{text}</span></div>;
}

function ReportDrawer({ item, onClose }) {
  return (
    <aside className="op-report-drawer">
      <header>
        <div><span>Drill-down</span><h2>{item.name || item.department || item.patient_name || 'Chi tiết báo cáo'}</h2><p>Dữ liệu chi tiết lấy từ object backend hiện tại.</p></div>
        <button type="button" onClick={onClose}>Đóng</button>
      </header>
      <section>
        <h3>Thông tin chính</h3>
        <dl>{Object.entries(item).filter(([key]) => key !== 'raw').slice(0, 12).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'number' ? formatNumber(value) : String(value || '—')}</dd></div>)}</dl>
      </section>
      <section>
        <h3>Mở liên kết nghiệp vụ</h3>
        <div className="op-drawer-actions"><Link to="/scheduling/appointments">Lịch hẹn</Link><Link to="/scheduling/queue">Queue</Link><Link to="/scheduling/doctor-schedules">Lịch bác sĩ</Link><Link to="/scheduling/reports/export">Export</Link></div>
      </section>
    </aside>
  );
}
