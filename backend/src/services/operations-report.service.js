const reportService = require('./report.service');
const appointmentService = require('./appointment.service');
const queueService = require('./queue.service');
const encounterService = require('./encounter.service');
const scheduleService = require('./schedule.service');
const clinicalOperationsOverviewService = require('./clinical-operations-overview.service');
const diagnosticAlertService = require('./diagnostic-alert.service');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  return addDays(date, -((date.getDay() + 6) % 7));
}

function startOfMonth(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

function buildRange(query = {}, fallback = 'today') {
  const now = new Date();
  if (query.date_from || query.from || query.date_to || query.to) {
    return {
      start: startOfDay(query.date_from || query.from || now),
      end: endOfDay(query.date_to || query.to || query.date_from || query.from || now),
    };
  }
  const range = String(query.period || query.range || fallback).toLowerCase();
  if (range === '7d') return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (range === '30d') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (range === 'week') return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
  if (range === 'month') return { start: startOfMonth(now), end: endOfDay(now) };
  return { start: startOfDay(query.date || now), end: endOfDay(query.date || now) };
}

function reportQuery(query = {}, range = buildRange(query)) {
  return {
    ...query,
    date: query.date,
    date_from: query.date ? undefined : isoDate(range.start),
    date_to: query.date ? undefined : isoDate(range.end),
    timezone: query.timezone || DEFAULT_TIMEZONE,
  };
}

function listQuery(query = {}, range = buildRange(query)) {
  return {
    ...reportQuery(query, range),
    page: query.page || 1,
    limit: Math.min(Number(query.limit || 30), 100),
  };
}

async function safe(key, fn) {
  try {
    return { key, ok: true, data: await fn() };
  } catch (error) {
    return {
      key,
      ok: false,
      data: null,
      error: {
        status: error.statusCode || error.status || 500,
        message: error.message || 'Không thể tải dữ liệu.',
      },
    };
  }
}

function collect(results = []) {
  return results.reduce((acc, result) => {
    acc[result.key] = result.data;
    if (!result.ok) acc.data_errors.push({ key: result.key, ...result.error });
    return acc;
  }, { data_errors: [] });
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function rate(part, total) {
  return total ? Number(((number(part) / number(total)) * 100).toFixed(2)) : 0;
}

function minutesBetween(start, end) {
  if (!start || !end) return null;
  const left = new Date(start);
  const right = new Date(end);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null;
  return Math.max(0, Math.round((right.getTime() - left.getTime()) / 60000));
}

function percentile(values = [], p = 90) {
  const sorted = values.map(number).filter((value) => value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function byHour(items = [], field) {
  const map = new Map();
  for (const item of items) {
    const raw = item[field];
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    const hour = `${String(date.getHours()).padStart(2, '0')}:00`;
    map.set(hour, (map.get(hour) || 0) + 1);
  }
  return [...map.entries()].map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour.localeCompare(b.hour));
}

function normalizeRows(result) {
  return result?.items || result?.data || [];
}

function top(rows = [], labelKeys = [], valueKeys = [], limit = 10) {
  return [...rows]
    .map((row) => ({
      ...row,
      label: labelKeys.map((key) => row[key]).find(Boolean) || 'Chưa xác định',
      value: valueKeys.map((key) => number(row[key])).find((value) => value > 0) || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function waitBuckets(minutes = []) {
  const buckets = [
    { key: '0-5', label: '0-5 phút', min: 0, max: 5, count: 0 },
    { key: '5-15', label: '5-15 phút', min: 5, max: 15, count: 0 },
    { key: '15-30', label: '15-30 phút', min: 15, max: 30, count: 0 },
    { key: '30-60', label: '30-60 phút', min: 30, max: 60, count: 0 },
    { key: '60+', label: '>60 phút', min: 60, max: Infinity, count: 0 },
  ];
  for (const value of minutes) {
    const bucket = buckets.find((item) => number(value) >= item.min && number(value) < item.max);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

function appointmentCards(report = {}, upcomingTotal = 0) {
  const s = report.summary || {};
  return [
    { key: 'total', label: 'Tổng lịch hẹn', value: s.total_appointments, status: 'neutral' },
    { key: 'booked', label: 'Booked', value: s.booked_count, status: 'neutral' },
    { key: 'confirmed', label: 'Confirmed', value: s.confirmed_count, status: 'good' },
    { key: 'checked_in', label: 'Checked-in', value: s.checked_in_count, status: 'good' },
    { key: 'in_consultation', label: 'In consultation', value: s.in_consultation_count, status: 'neutral' },
    { key: 'completed', label: 'Completed', value: s.completed_count, status: 'good' },
    { key: 'cancelled', label: 'Cancelled', value: s.cancelled_count, status: 'warning' },
    { key: 'no_show', label: 'No-show', value: s.no_show_count, status: 'danger' },
    { key: 'rescheduled', label: 'Rescheduled', value: s.rescheduled_count, status: 'warning' },
    { key: 'completion_rate', label: 'Completion rate', value: s.completion_rate, unit: 'percent', status: 'good' },
    { key: 'no_show_rate', label: 'No-show rate', value: s.no_show_rate, unit: 'percent', status: number(s.no_show_rate) > 15 ? 'danger' : 'warning' },
    { key: 'cancellation_rate', label: 'Cancellation rate', value: s.cancellation_rate, unit: 'percent', status: 'warning' },
    { key: 'upcoming', label: 'Upcoming', value: upcomingTotal, status: 'neutral' },
  ];
}

function encounterCards(report = {}) {
  const s = report.summary || {};
  return [
    { key: 'total', label: 'Tổng lượt khám', value: s.total_encounters, status: 'neutral' },
    { key: 'planned', label: 'Đang chờ tiếp nhận', value: s.planned_count, status: 'neutral' },
    { key: 'arrived', label: 'Đã đến', value: s.arrived_count, status: 'neutral' },
    { key: 'in_progress', label: 'Đang khám', value: s.in_progress_count, status: 'warning' },
    { key: 'on_hold', label: 'Tạm dừng', value: s.on_hold_count, status: 'warning' },
    { key: 'completed', label: 'Đã hoàn tất', value: s.completed_count, status: 'good' },
    { key: 'cancelled', label: 'Đã hủy', value: s.cancelled_count, status: 'danger' },
    { key: 'completion_rate', label: 'Tỷ lệ hoàn tất', value: s.completion_rate, unit: 'percent', status: 'good' },
    { key: 'avg_duration', label: 'Thời lượng TB', value: s.average_encounter_duration || s.average_duration, unit: 'minutes', status: 'neutral' },
    { key: 'outpatient', label: 'Ngoại trú', value: s.outpatient_count, status: 'neutral' },
    { key: 'inpatient', label: 'Nội trú', value: s.inpatient_count, status: 'neutral' },
    { key: 'emergency', label: 'Cấp cứu', value: s.emergency_count, status: 'danger' },
    { key: 'telemedicine', label: 'Telemedicine', value: s.telemedicine_count, status: 'neutral' },
  ];
}

function queueCards(report = {}) {
  const s = report.summary || {};
  const peak = report.breakdowns?.peak_hours?.[0];
  return [
    { key: 'total', label: 'Tổng ticket', value: s.total_tickets, status: 'neutral' },
    { key: 'waiting', label: 'Đang chờ', value: s.waiting_count, status: number(s.waiting_count) > 25 ? 'warning' : 'neutral' },
    { key: 'called', label: 'Đã gọi', value: s.called_count, status: 'neutral' },
    { key: 'in_service', label: 'Đang phục vụ', value: s.in_service_count, status: 'warning' },
    { key: 'completed', label: 'Hoàn tất', value: s.completed_count, status: 'good' },
    { key: 'cancelled', label: 'Hủy', value: s.cancelled_count, status: 'danger' },
    { key: 'skipped', label: 'Bỏ qua', value: s.skipped_count, status: 'warning' },
    { key: 'recalled', label: 'Gọi lại', value: s.recalled_count, status: 'neutral' },
    { key: 'avg_waiting', label: 'Chờ TB', value: s.average_waiting_time, unit: 'minutes', status: number(s.average_waiting_time) > 30 ? 'danger' : 'good' },
    { key: 'avg_service', label: 'Phục vụ TB', value: s.average_service_time, unit: 'minutes', status: 'neutral' },
    { key: 'peak_hour', label: `Peak hour ${peak?.hour || ''}`, value: peak?.count || 0, status: 'warning' },
  ];
}

function buildCheckinCards(appointmentsReport = {}, queueReport = {}) {
  const s = appointmentsReport.summary || {};
  const total = number(s.total_appointments);
  const checked = number(s.checked_in_count) + number(s.in_consultation_count) + number(s.completed_count);
  return [
    { key: 'today', label: 'Lịch hẹn hôm nay', value: total, status: 'neutral' },
    { key: 'checked_in', label: 'Đã check-in', value: checked, status: 'good' },
    { key: 'not_checked_in', label: 'Chưa check-in', value: Math.max(0, total - checked - number(s.cancelled_count) - number(s.no_show_count)), status: 'warning' },
    { key: 'late', label: 'Check-in trễ', value: number(s.booked_count) + number(s.confirmed_count), status: 'warning' },
    { key: 'queued', label: 'Đã đưa vào queue', value: queueReport.summary?.total_tickets, status: 'neutral' },
    { key: 'waiting', label: 'Chờ gọi', value: queueReport.summary?.waiting_count, status: 'warning' },
    { key: 'temp_no_show', label: 'No-show tạm tính', value: s.no_show_count, status: 'danger' },
    { key: 'rate', label: 'Tỷ lệ check-in', value: rate(checked, total), unit: 'percent', status: 'good' },
  ];
}

function departmentLoadRows(report = {}, schedule = {}) {
  const scheduleRows = schedule?.items || schedule?.departments || [];
  const scheduleMap = new Map(scheduleRows.map((row) => [String(row.department_id || row._id || row.id), row]));
  return (report.items || []).map((row) => {
    const scheduleRow = scheduleMap.get(String(row.department_id || row._id || row.id)) || {};
    const loadScore = Math.min(100, Math.round(number(row.appointment_count) * 0.8 + number(row.encounter_count) + number(row.queue_waiting_average) * 1.6));
    return {
      ...row,
      total_slots: scheduleRow.total_slots,
      booked_slots: scheduleRow.booked_slots,
      load_score: loadScore,
      load_status: loadScore >= 80 ? 'overloaded' : loadScore >= 55 ? 'busy' : 'normal',
    };
  });
}

function slotRows(doctorsReport = {}) {
  return (doctorsReport.items || []).map((row) => ({
    ...row,
    available_slots: Math.max(0, number(row.total_slots) - number(row.booked_slots)),
    fill_rate: rate(row.booked_slots, row.total_slots),
    no_show_rate: rate(row.no_show_count, row.appointment_count),
  }));
}

function patientFlow(data = {}) {
  const a = data.appointments?.summary || {};
  const q = data.queue?.summary || {};
  const e = data.encounters?.summary || {};
  const pending = data.today_worklist?.summary?.total || data.today_worklist?.items?.length || 0;
  const stages = [
    { key: 'booked', label: 'Booked appointment', value: a.booked_count || a.total_appointments },
    { key: 'confirmed', label: 'Confirmed', value: a.confirmed_count },
    { key: 'checked_in', label: 'Checked-in', value: a.checked_in_count },
    { key: 'queue_waiting', label: 'Queue waiting', value: q.waiting_count },
    { key: 'called', label: 'Called', value: q.called_count },
    { key: 'in_service', label: 'In service', value: q.in_service_count },
    { key: 'encounter_started', label: 'Encounter started', value: e.in_progress_count + e.arrived_count },
    { key: 'encounter_completed', label: 'Encounter completed', value: e.completed_count },
    { key: 'orders_pending', label: 'Orders pending', value: pending },
  ];
  const bottleneck = [...stages].sort((left, right) => number(right.value) - number(left.value))[0];
  return { stages, bottleneck };
}

async function baseData(query = {}, actor = {}, fallback = 'today') {
  const range = buildRange(query, fallback);
  const rq = reportQuery(query, range);
  const lq = listQuery(query, range);
  const results = await Promise.all([
    safe('appointments', () => reportService.getAppointmentReport(rq, actor)),
    safe('queue', () => reportService.getQueueReport(rq, actor)),
    safe('encounters', () => reportService.getEncounterReport(rq, actor)),
    safe('departments', () => reportService.getDepartmentReport(rq, actor)),
    safe('doctors', () => reportService.getDoctorReport(rq, actor)),
    safe('appointment_list', () => appointmentService.listAppointments(lq, actor)),
    safe('queue_list', () => queueService.listQueueTickets(lq, actor)),
    safe('encounter_list', () => encounterService.listEncounters(lq, actor)),
    safe('schedule_system', () => scheduleService.getSchedulingSystemSummary(rq, actor)),
    safe('schedule_departments', () => scheduleService.getScheduleSummaryByDepartment(rq, actor)),
    safe('schedule_range', () => scheduleService.getScheduleSummaryByDateRange(rq, actor)),
    safe('today_worklist', () => clinicalOperationsOverviewService.getTodayWorklist({ ...rq, limit: 20 }, actor)),
    safe('overdue_orders', () => clinicalOperationsOverviewService.getOverdueOrders({ ...rq, limit: 20 }, actor)),
    safe('no_show_alerts', () => diagnosticAlertService.getNoShowCancellationAlerts({ ...rq, limit: 20 }, actor)),
    safe('diagnostic_overdue_orders', () => diagnosticAlertService.getOverdueOrderAlerts({ ...rq, limit: 20 }, actor)),
  ]);
  return { ...collect(results), filters: { ...query, date_from: isoDate(range.start), date_to: isoDate(range.end), timezone: rq.timezone }, generated_at: new Date() };
}

function assemble(type, data) {
  const appointments = data.appointments || {};
  const queue = data.queue || {};
  const encounters = data.encounters || {};
  const appointmentRows = normalizeRows(data.appointment_list);
  const queueRows = normalizeRows(data.queue_list);
  const encounterRows = normalizeRows(data.encounter_list);
  const waitValues = queueRows.map((row) => row.waiting_minutes ?? minutesBetween(row.checkin_time || row.created_at, row.called_time || row.service_start_time || new Date())).filter((value) => value !== null);
  const serviceValues = queueRows.map((row) => row.service_minutes ?? minutesBetween(row.service_start_time || row.called_time, row.completed_time)).filter((value) => value !== null);
  const loadRows = departmentLoadRows(data.departments, data.schedule_departments);
  const slots = slotRows(data.doctors);
  const flow = patientFlow(data);
  const common = {
    type,
    raw: data,
    reports: { appointments, queue, encounters, departments: data.departments, doctors: data.doctors },
    lists: { appointments: data.appointment_list, queue: data.queue_list, encounters: data.encounter_list },
    charts: {
      appointments_by_day: appointments.breakdowns?.by_day || [],
      appointments_by_status: appointments.breakdowns?.by_status || [],
      appointments_by_type: appointments.breakdowns?.by_type || [],
      queue_by_status: queue.breakdowns?.by_status || [],
      peak_hours: queue.breakdowns?.peak_hours || [],
      encounters_by_day: encounters.breakdowns?.by_day || [],
      encounters_by_status: encounters.breakdowns?.by_status || [],
      encounters_by_type: encounters.breakdowns?.by_type || [],
      department_load: loadRows,
      doctor_load: slots,
      wait_buckets: waitBuckets(waitValues),
      wait_by_hour: data.queue?.breakdowns?.peak_hours || byHour(queueRows, 'checkin_time'),
      appointment_by_hour: byHour(appointmentRows, 'appointment_time'),
    },
    rankings: {
      departments: top(data.departments?.items || [], ['department_name', 'department_code'], ['encounter_count', 'appointment_count', 'revenue_amount']),
      doctors: top(data.doctors?.items || [], ['doctor_name', 'doctor_code'], ['completed_encounter_count', 'encounter_count', 'appointment_count']),
    },
    wait_time: {
      average: queue.summary?.average_waiting_time,
      median: percentile(waitValues, 50),
      p90: percentile(waitValues, 90),
      p95: percentile(waitValues, 95),
      average_service_time: queue.summary?.average_service_time,
      longest_waiting: Math.max(0, ...waitValues.map(number)),
      over_15: waitValues.filter((value) => value > 15).length,
      over_30: waitValues.filter((value) => value > 30).length,
      over_60: waitValues.filter((value) => value > 60).length,
      service_values: serviceValues,
    },
    slot_efficiency: {
      summary: {
        total_slots: slots.reduce((sum, row) => sum + number(row.total_slots), 0),
        booked_slots: slots.reduce((sum, row) => sum + number(row.booked_slots), 0),
        available_slots: slots.reduce((sum, row) => sum + number(row.available_slots), 0),
        average_utilization: slots.length ? slots.reduce((sum, row) => sum + number(row.schedule_utilization), 0) / slots.length : 0,
      },
      items: slots,
    },
    patient_flow: flow,
    generated_at: data.generated_at,
    filters: data.filters,
    data_errors: data.data_errors,
    backend_todo: [
      'GET /api/reports/operations/check-in: unified checkin_time, queue_ticket_id, checkin_source, staff_id.',
      'GET /api/reports/operations/wait-time: median, p90, p95, buckets and SLA breaches from persisted queue timing.',
      'GET /api/reports/operations/patient-flow: unified patient journey appointment -> queue -> encounter -> orders -> billing.',
      'GET /api/reports/operations/bottlenecks and /realtime for live room/clinic load.',
    ],
  };

  const cardsByType = {
    appointments: appointmentCards(appointments, data.appointment_list?.pagination?.total || appointmentRows.length),
    encounters: encounterCards(encounters),
    queue: queueCards(queue),
    check_in: buildCheckinCards(appointments, queue),
    no_show: [
      { key: 'no_show', label: 'Tổng no-show', value: appointments.summary?.no_show_count, status: 'danger' },
      { key: 'no_show_rate', label: 'No-show rate', value: appointments.summary?.no_show_rate, unit: 'percent', status: 'danger' },
      { key: 'today', label: 'No-show hôm nay', value: appointments.summary?.no_show_count, status: 'danger' },
      { key: 'highest_department', label: 'Khoa rủi ro cao', value: common.rankings.departments[0]?.no_show_count || 0, status: 'warning' },
      { key: 'highest_doctor', label: 'Bác sĩ rủi ro cao', value: common.rankings.doctors[0]?.no_show_count || 0, status: 'warning' },
      { key: 'cancel_rate', label: 'Cancellation rate', value: appointments.summary?.cancellation_rate, unit: 'percent', status: 'warning' },
      { key: 'rescheduled', label: 'Rescheduled', value: appointments.summary?.rescheduled_count, status: 'neutral' },
    ],
    wait_time: [
      { key: 'avg', label: 'Avg waiting time', value: common.wait_time.average, unit: 'minutes', status: number(common.wait_time.average) > 30 ? 'danger' : 'good' },
      { key: 'median', label: 'Median waiting time', value: common.wait_time.median, unit: 'minutes', status: 'neutral' },
      { key: 'p90', label: 'P90 waiting time', value: common.wait_time.p90, unit: 'minutes', status: 'warning' },
      { key: 'avg_service', label: 'Avg service time', value: common.wait_time.average_service_time, unit: 'minutes', status: 'neutral' },
      { key: 'longest', label: 'Longest waiting ticket', value: common.wait_time.longest_waiting, unit: 'minutes', status: 'danger' },
      { key: 'over15', label: '> 15 phút', value: common.wait_time.over_15, status: 'warning' },
      { key: 'over30', label: '> 30 phút', value: common.wait_time.over_30, status: 'danger' },
      { key: 'over60', label: '> 60 phút', value: common.wait_time.over_60, status: 'danger' },
    ],
    department_load: [
      { key: 'departments', label: 'Khoa hoạt động', value: loadRows.length, status: 'neutral' },
      { key: 'doctors', label: 'Tổng bác sĩ', value: loadRows.reduce((sum, row) => sum + number(row.doctor_count), 0), status: 'neutral' },
      { key: 'top_load', label: 'Khoa tải cao nhất', value: loadRows[0]?.load_score || 0, status: 'warning' },
      { key: 'top_wait', label: 'Wait time cao nhất', value: Math.max(0, ...loadRows.map((row) => number(row.queue_waiting_average))), unit: 'minutes', status: 'danger' },
      { key: 'top_no_show', label: 'No-show cao nhất', value: Math.max(0, ...loadRows.map((row) => number(row.no_show_count))), status: 'warning' },
    ],
    slot_efficiency: [
      { key: 'total', label: 'Tổng slot', value: common.slot_efficiency.summary.total_slots, status: 'neutral' },
      { key: 'booked', label: 'Slot đã đặt', value: common.slot_efficiency.summary.booked_slots, status: 'good' },
      { key: 'available', label: 'Slot còn trống', value: common.slot_efficiency.summary.available_slots, status: 'neutral' },
      { key: 'utilization', label: 'Utilization TB', value: common.slot_efficiency.summary.average_utilization, unit: 'percent', status: 'good' },
      { key: 'overbooked', label: 'Overbooked', value: 0, status: 'neutral' },
      { key: 'no_show_slots', label: 'No-show slots', value: slots.reduce((sum, row) => sum + number(row.no_show_count), 0), status: 'warning' },
    ],
    patient_flow: [
      { key: 'total', label: 'Tổng bệnh nhân trong luồng', value: appointments.summary?.total_appointments, status: 'neutral' },
      { key: 'checkin', label: 'Đang ở check-in', value: appointments.summary?.confirmed_count, status: 'warning' },
      { key: 'queue', label: 'Đang chờ queue', value: queue.summary?.waiting_count, status: 'warning' },
      { key: 'exam', label: 'Đang được khám', value: encounters.summary?.in_progress_count, status: 'warning' },
      { key: 'pending_ops', label: 'Chờ cận lâm sàng', value: data.today_worklist?.summary?.total || data.today_worklist?.items?.length || 0, status: 'warning' },
      { key: 'completed', label: 'Hoàn tất', value: encounters.summary?.completed_count, status: 'good' },
      { key: 'dropoff', label: 'Drop-off/no-show', value: appointments.summary?.no_show_count, status: 'danger' },
      { key: 'bottleneck', label: `Bottleneck: ${flow.bottleneck?.label || 'N/A'}`, value: flow.bottleneck?.value || 0, status: 'danger' },
    ],
  };

  return { ...common, summary_cards: cardsByType[type] || appointmentCards(appointments) };
}

async function build(type, query = {}, actor = {}, fallback = 'today') {
  const data = await baseData(query, actor, fallback);
  return assemble(type, data);
}

module.exports = {
  getOverview: (query, actor) => build('overview', query, actor, 'today'),
  getEncounters: (query, actor) => build('encounters', query, actor, 'week'),
  getAppointments: (query, actor) => build('appointments', query, actor, 'week'),
  getCheckIn: (query, actor) => build('check_in', { ...query, date: query.date || isoDate(new Date()) }, actor, 'today'),
  getQueue: (query, actor) => build('queue', query, actor, 'today'),
  getNoShow: (query, actor) => build('no_show', { ...query, status: query.status || undefined }, actor, 'week'),
  getWaitTime: (query, actor) => build('wait_time', query, actor, 'today'),
  getDepartmentLoad: (query, actor) => build('department_load', query, actor, 'week'),
  getSlotEfficiency: (query, actor) => build('slot_efficiency', query, actor, 'week'),
  getPatientFlow: (query, actor) => build('patient_flow', query, actor, 'today'),
};
