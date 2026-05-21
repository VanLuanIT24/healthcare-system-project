const reportService = require('./report.service');
const departmentService = require('./department.service');
const appointmentService = require('./appointment.service');
const queueService = require('./queue.service');
const encounterService = require('./encounter.service');
const scheduleService = require('./schedule.service');
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

function startOfQuarter(value = new Date()) {
  const date = startOfDay(value);
  date.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
  return date;
}

function buildRange(query = {}, fallback = 'week') {
  const now = new Date();
  if (query.date_from || query.from || query.date_to || query.to) {
    return {
      start: startOfDay(query.date_from || query.from || now),
      end: endOfDay(query.date_to || query.to || query.date_from || query.from || now),
    };
  }
  const range = String(query.period || query.range || fallback).toLowerCase();
  if (range === 'today') return { start: startOfDay(query.date || now), end: endOfDay(query.date || now) };
  if (range === '7d') return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (range === '30d') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (range === 'month') return { start: startOfMonth(now), end: endOfDay(now) };
  if (range === 'quarter') return { start: startOfQuarter(now), end: endOfDay(now) };
  return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
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

function round(value) {
  return Number((number(value) + Number.EPSILON).toFixed(2));
}

function normalizeScore(value, max = 100) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (number(value) / max) * 100));
}

function top(rows = [], valueKey, direction = 'desc') {
  return [...rows].sort((a, b) => (direction === 'desc' ? number(b[valueKey]) - number(a[valueKey]) : number(a[valueKey]) - number(b[valueKey])))[0] || null;
}

function enhanceDepartmentRows(rows = []) {
  const maxRevenue = Math.max(1, ...rows.map((row) => number(row.revenue_amount)));
  const maxEncounter = Math.max(1, ...rows.map((row) => number(row.encounter_count)));
  return rows.map((row) => {
    const doctorCount = Math.max(1, number(row.doctor_count));
    const completionRate = rate(row.completed_encounter_count, row.encounter_count);
    const noShowRate = rate(row.no_show_count, row.appointment_count);
    const revenuePerDoctor = number(row.revenue_amount) / doctorCount;
    const encounterPerDoctor = number(row.encounter_count) / doctorCount;
    const performanceScore = round(
      completionRate * 0.35
      + (100 - Math.min(100, noShowRate * 4)) * 0.2
      + (100 - Math.min(100, number(row.queue_waiting_average) * 2)) * 0.15
      + normalizeScore(row.revenue_amount, maxRevenue) * 0.15
      + normalizeScore(row.encounter_count, maxEncounter) * 0.15,
    );
    const appointmentPerDoctor = number(row.appointment_count) / doctorCount;
    const loadScore = round(appointmentPerDoctor * 0.25 + encounterPerDoctor * 0.35 + number(row.queue_waiting_average) * 0.25 + noShowRate * 0.15);
    return {
      ...row,
      completion_rate: completionRate,
      no_show_rate: noShowRate,
      revenue_per_doctor: round(revenuePerDoctor),
      encounter_per_doctor: round(encounterPerDoctor),
      appointment_per_doctor: round(appointmentPerDoctor),
      performance_score: performanceScore,
      load_score: loadScore,
      load_status: loadScore >= 80 ? 'overloaded' : loadScore >= 55 ? 'high' : loadScore >= 25 ? 'normal' : 'low',
      recommended_action: loadScore >= 80
        ? 'Tăng slot/bác sĩ hoặc điều phối bớt bệnh nhân.'
        : noShowRate > 15
          ? 'Tăng nhắc lịch tự động và xác nhận trước giờ hẹn.'
          : number(row.queue_waiting_average) > 30
            ? 'Rà soát quy trình queue và phân bổ phòng.'
            : 'Duy trì vận hành hiện tại.',
    };
  });
}

function enhanceDoctorRows(rows = []) {
  const maxCompleted = Math.max(1, ...rows.map((row) => number(row.completed_encounter_count)));
  const maxPatients = Math.max(1, ...rows.map((row) => number(row.patient_count)));
  return rows.map((row) => {
    const completionRate = rate(row.completed_encounter_count, row.encounter_count);
    const noShowRate = rate(row.no_show_count, row.appointment_count);
    const availableSlots = Math.max(0, number(row.total_slots) - number(row.booked_slots));
    const productivityScore = round(
      normalizeScore(row.completed_encounter_count, maxCompleted) * 0.35
      + normalizeScore(row.patient_count, maxPatients) * 0.2
      + number(row.schedule_utilization) * 0.25
      - noShowRate * 0.2,
    );
    const utilizationStatus = number(row.schedule_utilization) > 100 ? 'overbooked' : number(row.schedule_utilization) >= 85 ? 'high' : number(row.schedule_utilization) >= 60 ? 'optimal' : 'low';
    return {
      ...row,
      completion_rate: completionRate,
      no_show_rate: noShowRate,
      available_slots: availableSlots,
      fill_rate: rate(row.booked_slots, row.total_slots),
      productivity_score: Math.max(0, productivityScore),
      utilization_status: utilizationStatus,
      recommendation: utilizationStatus === 'high' || utilizationStatus === 'overbooked'
        ? 'Theo dõi quá tải và cân bằng lịch khám.'
        : utilizationStatus === 'low'
          ? 'Có thể tăng lịch hoặc điều phối thêm bệnh nhân.'
          : 'Utilization đang ở vùng tối ưu.',
    };
  });
}

function buildCards(type, data, departments, doctors) {
  const deptSummary = data.departments?.summary || {};
  const doctorSummary = data.doctors?.summary || {};
  const appointmentSummary = data.appointments?.summary || {};
  const queueSummary = data.queue?.summary || {};
  const revenueSummary = data.revenue?.summary || {};
  const bestDepartment = top(departments, 'performance_score');
  const attentionDepartment = top(departments, 'performance_score', 'asc');
  const topDoctor = top(doctors, 'productivity_score');
  const lowDoctor = top(doctors, 'productivity_score', 'asc');
  const totalRevenue = number(deptSummary.revenue_amount || revenueSummary.paid_amount || revenueSummary.gross_charges);

  const sharedDepartment = [
    { key: 'department_count', label: 'Tổng số khoa', value: deptSummary.department_count || departments.length, status: 'neutral' },
    { key: 'doctor_count', label: 'Tổng bác sĩ', value: deptSummary.doctor_count || doctorSummary.doctor_count, status: 'neutral' },
    { key: 'appointment_count', label: 'Tổng lịch hẹn', value: deptSummary.appointment_count || appointmentSummary.total_appointments, status: 'neutral' },
    { key: 'encounter_count', label: 'Tổng lượt khám', value: deptSummary.encounter_count, status: 'neutral' },
    { key: 'completed_encounter_count', label: 'Hoàn tất', value: departments.reduce((sum, row) => sum + number(row.completed_encounter_count), 0), status: 'good' },
    { key: 'no_show', label: 'No-show', value: departments.reduce((sum, row) => sum + number(row.no_show_count), 0), status: 'warning' },
    { key: 'avg_wait', label: 'Chờ trung bình', value: queueSummary.average_waiting_time || average(departments, 'queue_waiting_average'), unit: 'minutes', status: number(queueSummary.average_waiting_time) > 30 ? 'danger' : 'good' },
    { key: 'revenue', label: 'Doanh thu', value: totalRevenue, unit: 'currency', status: 'good' },
    { key: 'best', label: `Tốt nhất: ${bestDepartment?.department_name || 'N/A'}`, value: bestDepartment?.performance_score || 0, status: 'good' },
    { key: 'attention', label: `Cần chú ý: ${attentionDepartment?.department_name || 'N/A'}`, value: attentionDepartment?.performance_score || 0, status: 'warning' },
  ];

  const sharedDoctor = [
    { key: 'doctor_count', label: 'Tổng bác sĩ', value: doctorSummary.doctor_count || doctors.length, status: 'neutral' },
    { key: 'appointments', label: 'Tổng appointment', value: doctorSummary.appointment_count, status: 'neutral' },
    { key: 'encounters', label: 'Tổng encounter', value: doctorSummary.encounter_count, status: 'neutral' },
    { key: 'completed', label: 'Completed encounter', value: doctorSummary.completed_encounter_count, status: 'good' },
    { key: 'patients', label: 'Patient unique', value: doctors.reduce((sum, row) => sum + number(row.patient_count), 0), status: 'neutral' },
    { key: 'avg_duration', label: 'Consultation TB', value: average(doctors, 'average_consultation_duration'), unit: 'minutes', status: 'neutral' },
    { key: 'avg_utilization', label: 'Utilization TB', value: doctorSummary.average_schedule_utilization, unit: 'percent', status: 'good' },
    { key: 'top_doctor', label: `Top: ${topDoctor?.doctor_name || 'N/A'}`, value: topDoctor?.productivity_score || 0, status: 'good' },
    { key: 'attention_doctor', label: `Cần chú ý: ${lowDoctor?.doctor_name || 'N/A'}`, value: lowDoctor?.productivity_score || 0, status: 'warning' },
  ];

  const map = {
    department_performance: sharedDepartment,
    department_load: [
      { key: 'active', label: 'Khoa đang hoạt động', value: departments.length, status: 'neutral' },
      { key: 'overloaded', label: 'Quá tải', value: departments.filter((row) => row.load_status === 'overloaded').length, status: 'danger' },
      { key: 'high', label: 'Tải cao', value: departments.filter((row) => row.load_status === 'high').length, status: 'warning' },
      { key: 'normal', label: 'Bình thường', value: departments.filter((row) => row.load_status === 'normal').length, status: 'good' },
      { key: 'low', label: 'Tải thấp', value: departments.filter((row) => row.load_status === 'low').length, status: 'neutral' },
      { key: 'active_doctors', label: 'Bác sĩ active', value: deptSummary.doctor_count || doctorSummary.doctor_count, status: 'neutral' },
      { key: 'waiting', label: 'Bệnh nhân đang chờ', value: queueSummary.waiting_count, status: 'warning' },
      { key: 'avg_wait', label: 'Chờ TB toàn viện', value: queueSummary.average_waiting_time, unit: 'minutes', status: number(queueSummary.average_waiting_time) > 30 ? 'danger' : 'good' },
    ],
    department_appointments: [
      { key: 'total', label: 'Tổng lịch hẹn', value: appointmentSummary.total_appointments, status: 'neutral' },
      { key: 'booked', label: 'Booked', value: appointmentSummary.booked_count, status: 'neutral' },
      { key: 'confirmed', label: 'Confirmed', value: appointmentSummary.confirmed_count, status: 'good' },
      { key: 'checked_in', label: 'Checked-in', value: appointmentSummary.checked_in_count, status: 'good' },
      { key: 'in_consultation', label: 'In consultation', value: appointmentSummary.in_consultation_count, status: 'warning' },
      { key: 'completed', label: 'Completed', value: appointmentSummary.completed_count, status: 'good' },
      { key: 'cancelled', label: 'Cancelled', value: appointmentSummary.cancelled_count, status: 'warning' },
      { key: 'no_show', label: 'No-show', value: appointmentSummary.no_show_count, status: 'danger' },
      { key: 'completion_rate', label: 'Completion rate', value: appointmentSummary.completion_rate, unit: 'percent', status: 'good' },
      { key: 'top_dept', label: `Nhiều lịch nhất: ${top(departments, 'appointment_count')?.department_name || 'N/A'}`, value: top(departments, 'appointment_count')?.appointment_count || 0, status: 'neutral' },
    ],
    department_queue: [
      { key: 'total', label: 'Tổng ticket', value: queueSummary.total_tickets, status: 'neutral' },
      { key: 'waiting', label: 'Đang chờ', value: queueSummary.waiting_count, status: 'warning' },
      { key: 'called', label: 'Đã gọi', value: queueSummary.called_count, status: 'neutral' },
      { key: 'in_service', label: 'Đang phục vụ', value: queueSummary.in_service_count, status: 'warning' },
      { key: 'completed', label: 'Hoàn tất', value: queueSummary.completed_count, status: 'good' },
      { key: 'skipped', label: 'Skipped', value: queueSummary.skipped_count, status: 'warning' },
      { key: 'avg_wait', label: 'Avg waiting', value: queueSummary.average_waiting_time, unit: 'minutes', status: 'warning' },
      { key: 'avg_service', label: 'Avg service', value: queueSummary.average_service_time, unit: 'minutes', status: 'neutral' },
      { key: 'longest_dept', label: `Queue dài: ${top(departments, 'appointment_count')?.department_name || 'N/A'}`, value: top(departments, 'appointment_count')?.appointment_count || 0, status: 'warning' },
    ],
    department_revenue: [
      { key: 'revenue', label: 'Tổng doanh thu', value: totalRevenue, unit: 'currency', status: 'good' },
      { key: 'revenue_departments', label: 'Khoa có doanh thu', value: departments.filter((row) => number(row.revenue_amount) > 0).length, status: 'neutral' },
      { key: 'top', label: `Cao nhất: ${top(departments, 'revenue_amount')?.department_name || 'N/A'}`, value: top(departments, 'revenue_amount')?.revenue_amount || 0, unit: 'currency', status: 'good' },
      { key: 'bottom', label: `Thấp nhất: ${top(departments, 'revenue_amount', 'asc')?.department_name || 'N/A'}`, value: top(departments, 'revenue_amount', 'asc')?.revenue_amount || 0, unit: 'currency', status: 'warning' },
      { key: 'rev_doc', label: 'Revenue/doctor TB', value: average(departments, 'revenue_per_doctor'), unit: 'currency', status: 'neutral' },
      { key: 'rev_enc', label: 'Revenue/encounter TB', value: totalRevenue / Math.max(1, number(deptSummary.encounter_count)), unit: 'currency', status: 'neutral' },
      { key: 'outstanding', label: 'Outstanding', value: revenueSummary.outstanding_amount, unit: 'currency', status: 'warning' },
      { key: 'payment_count', label: 'Payment count', value: revenueSummary.payment_count || revenueSummary.count, status: 'neutral' },
    ],
    department_staff: [
      { key: 'departments', label: 'Tổng khoa', value: departments.length, status: 'neutral' },
      { key: 'staff', label: 'Tổng nhân sự', value: departments.reduce((sum, row) => sum + number(row.staff_count || row.doctor_count), 0), status: 'neutral' },
      { key: 'active_doctor', label: 'Bác sĩ active', value: doctorSummary.doctor_count || doctors.length, status: 'neutral' },
      { key: 'most_staff', label: `Nhiều nhân sự: ${top(departments, 'staff_count')?.department_name || 'N/A'}`, value: top(departments, 'staff_count')?.staff_count || 0, status: 'neutral' },
      { key: 'least_staff', label: `Ít nhân sự: ${top(departments, 'staff_count', 'asc')?.department_name || 'N/A'}`, value: top(departments, 'staff_count', 'asc')?.staff_count || 0, status: 'warning' },
      { key: 'understaffed', label: 'Khoa thiếu bác sĩ', value: departments.filter((row) => row.load_status === 'overloaded').length, status: 'danger' },
    ],
    doctor_performance: sharedDoctor,
    doctor_utilization: [
      { key: 'avg', label: 'Average utilization', value: doctorSummary.average_schedule_utilization, unit: 'percent', status: 'good' },
      { key: 'slots', label: 'Tổng slot', value: doctors.reduce((sum, row) => sum + number(row.total_slots), 0), status: 'neutral' },
      { key: 'booked', label: 'Booked slots', value: doctors.reduce((sum, row) => sum + number(row.booked_slots), 0), status: 'good' },
      { key: 'available', label: 'Available slots', value: doctors.reduce((sum, row) => sum + number(row.available_slots), 0), status: 'neutral' },
      { key: 'highest', label: `Cao nhất: ${top(doctors, 'schedule_utilization')?.doctor_name || 'N/A'}`, value: top(doctors, 'schedule_utilization')?.schedule_utilization || 0, unit: 'percent', status: 'warning' },
      { key: 'lowest', label: `Thấp nhất: ${top(doctors, 'schedule_utilization', 'asc')?.doctor_name || 'N/A'}`, value: top(doctors, 'schedule_utilization', 'asc')?.schedule_utilization || 0, unit: 'percent', status: 'neutral' },
      { key: 'over', label: 'Over-utilized', value: doctors.filter((row) => ['high', 'overbooked'].includes(row.utilization_status)).length, status: 'warning' },
      { key: 'under', label: 'Under-utilized', value: doctors.filter((row) => row.utilization_status === 'low').length, status: 'neutral' },
    ],
    doctor_no_show: [
      { key: 'total', label: 'Tổng no-show', value: doctors.reduce((sum, row) => sum + number(row.no_show_count), 0), status: 'danger' },
      { key: 'avg_rate', label: 'No-show rate TB', value: average(doctors, 'no_show_rate'), unit: 'percent', status: 'warning' },
      { key: 'top_doctor', label: `Bác sĩ cao nhất: ${top(doctors, 'no_show_rate')?.doctor_name || 'N/A'}`, value: top(doctors, 'no_show_rate')?.no_show_rate || 0, unit: 'percent', status: 'danger' },
      { key: 'top_dept', label: `Khoa cao nhất: ${top(departments, 'no_show_rate')?.department_name || 'N/A'}`, value: top(departments, 'no_show_rate')?.no_show_rate || 0, unit: 'percent', status: 'danger' },
      { key: 'cancelled', label: 'Tổng cancelled', value: appointmentSummary.cancelled_count, status: 'warning' },
      { key: 'rescheduled', label: 'Tổng rescheduled', value: appointmentSummary.rescheduled_count, status: 'neutral' },
    ],
    personal_report: sharedDoctor,
    follow_up: [
      { key: 'total', label: 'Follow-up cần theo dõi', value: 0, status: 'neutral' },
      { key: 'scheduled', label: 'Đã đặt lịch', value: 0, status: 'good' },
      { key: 'unscheduled', label: 'Chưa đặt lịch', value: 0, status: 'warning' },
      { key: 'overdue', label: 'Quá hạn', value: 0, status: 'danger' },
      { key: 'today', label: 'Hôm nay', value: 0, status: 'neutral' },
      { key: 'next7', label: '7 ngày tới', value: 0, status: 'neutral' },
    ],
  };
  return map[type] || sharedDepartment;
}

function average(rows = [], key) {
  if (!rows.length) return 0;
  return round(rows.reduce((sum, row) => sum + number(row[key]), 0) / rows.length);
}

function buildInsights(departments, doctors) {
  return [
    { title: 'Khoa doanh thu cao nhất', description: top(departments, 'revenue_amount')?.department_name || 'Chưa có dữ liệu' },
    { title: 'Queue chờ lâu nhất', description: top(departments, 'queue_waiting_average')?.department_name || 'Chưa có dữ liệu' },
    { title: 'No-show cao nhất', description: top(departments, 'no_show_rate')?.department_name || top(doctors, 'no_show_rate')?.doctor_name || 'Chưa có dữ liệu' },
    { title: 'Encounter/bác sĩ cao nhất', description: top(departments, 'encounter_per_doctor')?.department_name || 'Chưa có dữ liệu' },
    { title: 'Completed rate thấp nhất', description: top(departments, 'completion_rate', 'asc')?.department_name || 'Chưa có dữ liệu' },
  ];
}

async function loadStaffRows(departments = [], actor = {}) {
  const selected = departments.slice(0, 20);
  const rows = await Promise.all(selected.map(async (department) => {
    const departmentId = department.department_id;
    const [head, staffCount] = await Promise.all([
      safe('head', () => departmentService.getDepartmentHead(departmentId, actor)),
      safe('staff_count', () => departmentService.countDepartmentStaff(departmentId, actor)),
    ]);
    return {
      ...department,
      head_user: head.data?.head || head.data || null,
      staff_count: staffCount.data?.total_staff || department.doctor_count || 0,
      active_staff_count: staffCount.data?.active_staff || 0,
      workload_per_staff: round(number(department.encounter_count) / Math.max(1, number(staffCount.data?.total_staff || department.doctor_count))),
      workload_per_doctor: round(number(department.encounter_count) / Math.max(1, number(department.doctor_count))),
      staffing_status: department.load_status === 'overloaded' ? 'thiếu' : department.load_status === 'low' ? 'dư' : 'đủ tải',
    };
  }));
  return rows;
}

async function baseData(query = {}, actor = {}, type = 'department_performance') {
  const range = buildRange(query, 'week');
  const rq = reportQuery(query, range);
  const lq = listQuery(query, range);
  const results = await Promise.all([
    safe('departments', () => reportService.getDepartmentReport(rq, actor)),
    safe('doctors', () => reportService.getDoctorReport(rq, actor)),
    safe('appointments', () => reportService.getAppointmentReport(rq, actor)),
    safe('queue', () => reportService.getQueueReport(rq, actor)),
    safe('encounters', () => reportService.getEncounterReport(rq, actor)),
    safe('revenue', () => reportService.getRevenueReport(rq, actor)),
    safe('appointment_list', () => appointmentService.listAppointments(lq, actor)),
    safe('queue_list', () => queueService.listQueueTickets(lq, actor)),
    safe('encounter_list', () => encounterService.listEncounters(lq, actor)),
    safe('schedule_system', () => scheduleService.getSchedulingSystemSummary(rq, actor)),
    safe('schedule_departments', () => scheduleService.getScheduleSummaryByDepartment(rq, actor)),
    safe('schedule_range', () => scheduleService.getScheduleSummaryByDateRange(rq, actor)),
    safe('no_show_alerts', () => diagnosticAlertService.getNoShowCancellationAlerts({ ...rq, limit: 20 }, actor)),
  ]);
  const data = collect(results);
  const departments = enhanceDepartmentRows(data.departments?.items || []);
  const doctors = enhanceDoctorRows(data.doctors?.items || []);
  const staffRows = type === 'department_staff' ? await loadStaffRows(departments, actor) : [];
  const personalDoctorId = query.doctor_id;
  const personalDoctor = personalDoctorId
    ? doctors.find((doctor) => String(doctor.doctor_id) === String(personalDoctorId)) || doctors[0] || null
    : doctors[0] || null;

  return {
    type,
    summary_cards: buildCards(type, data, type === 'department_staff' ? staffRows : departments, doctors),
    departments: type === 'department_staff' ? staffRows : departments,
    doctors,
    personal_doctor: personalDoctor,
    follow_up: {
      summary: {
        total_follow_up: 0,
        scheduled_follow_up: 0,
        unscheduled_follow_up: 0,
        overdue_follow_up: 0,
        due_today: 0,
        due_next_7_days: 0,
      },
      items: [],
      breakdowns: { by_department: [], by_doctor: [], by_status: [], by_due_date: [] },
      empty_reason: 'Backend chưa có dữ liệu follow-up chuyên biệt.',
    },
    reports: {
      departments: data.departments,
      doctors: data.doctors,
      appointments: data.appointments,
      queue: data.queue,
      encounters: data.encounters,
      revenue: data.revenue,
      schedule_system: data.schedule_system,
      schedule_departments: data.schedule_departments,
      schedule_range: data.schedule_range,
    },
    lists: {
      appointments: data.appointment_list,
      queue: data.queue_list,
      encounters: data.encounter_list,
      no_show_alerts: data.no_show_alerts,
    },
    charts: {
      appointment_by_day: data.appointments?.breakdowns?.by_day || [],
      appointment_by_department: data.appointments?.breakdowns?.by_department || [],
      appointment_by_status: data.appointments?.breakdowns?.by_status || [],
      queue_by_department: data.queue?.breakdowns?.by_department || [],
      queue_by_status: data.queue?.breakdowns?.by_status || [],
      queue_peak_hours: data.queue?.breakdowns?.peak_hours || [],
      encounter_by_day: data.encounters?.breakdowns?.by_day || [],
      encounter_by_department: data.encounters?.breakdowns?.by_department || [],
      encounter_by_status: data.encounters?.breakdowns?.by_status || [],
      revenue_by_day: data.revenue?.breakdowns?.by_day || data.revenue?.charts?.revenue_by_day || [],
      revenue_by_department: data.revenue?.breakdowns?.by_department || [],
      no_show_by_doctor: doctors.map((doctor) => ({ label: doctor.doctor_name, value: doctor.no_show_count, ...doctor })),
      utilization_by_doctor: doctors.map((doctor) => ({ label: doctor.doctor_name, value: doctor.schedule_utilization, ...doctor })),
      performance_by_doctor: doctors.map((doctor) => ({ label: doctor.doctor_name, value: doctor.productivity_score, ...doctor })),
    },
    insights: buildInsights(departments, doctors),
    generated_at: new Date(),
    filters: { ...query, date_from: isoDate(range.start), date_to: isoDate(range.end), timezone: rq.timezone },
    data_errors: data.data_errors,
    backend_todo: [
      'GET /api/reports/departments-doctors/department-performance: backend-owned performance_score and percentile.',
      'GET /api/reports/departments-doctors/department-load: current waiting, in-service, active rooms, active doctors today.',
      'GET /api/reports/departments-doctors/doctor-performance: productivity score, rank, percentile, department average comparison.',
      'GET /api/reports/departments-doctors/follow-up: real follow-up model and overdue status.',
      'GET /api/reports/departments-doctors/personal-report/:doctorId: unified doctor profile, schedules, queue, appointments, encounters.',
    ],
  };
}

module.exports = {
  getOverview: (query, actor) => baseData(query, actor, 'overview'),
  getDepartmentPerformance: (query, actor) => baseData(query, actor, 'department_performance'),
  getDepartmentLoad: (query, actor) => baseData(query, actor, 'department_load'),
  getDepartmentAppointments: (query, actor) => baseData(query, actor, 'department_appointments'),
  getDepartmentQueue: (query, actor) => baseData(query, actor, 'department_queue'),
  getDepartmentRevenue: (query, actor) => baseData(query, actor, 'department_revenue'),
  getDepartmentStaff: (query, actor) => baseData(query, actor, 'department_staff'),
  getDoctorPerformance: (query, actor) => baseData(query, actor, 'doctor_performance'),
  getDoctorUtilization: (query, actor) => baseData(query, actor, 'doctor_utilization'),
  getDoctorNoShow: (query, actor) => baseData(query, actor, 'doctor_no_show'),
  getFollowUp: (query, actor) => baseData(query, actor, 'follow_up'),
  getPersonalReport: (query, actor) => baseData(query, actor, 'personal_report'),
};
