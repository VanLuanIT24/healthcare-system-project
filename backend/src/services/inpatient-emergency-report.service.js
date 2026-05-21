const {
  Admission,
  Bed,
  BedAssignment,
  Department,
  EmergencyCase,
  EmergencyCaseEvent,
  EmergencyTriage,
  InpatientHandover,
  InpatientTask,
  MedicationAdministration,
  Room,
  User,
} = require('../models');
const {
  ADMISSION_STATUS,
  BED_ASSIGNMENT_STATUS,
  BED_STATUS,
  EMERGENCY_STATUS,
  EMERGENCY_PRIORITY,
  INPATIENT_TASK_STATUS,
  ADMINISTRATION_STATUS,
} = require('../constants/statuses');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const MS_PER_DAY = 86400000;
const MS_PER_HOUR = 3600000;

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

function isoDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(normalizeNumber(value) * factor) / factor;
}

function percentage(part, total) {
  return total > 0 ? round((normalizeNumber(part) / normalizeNumber(total)) * 100, 2) : 0;
}

function average(values = []) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function percentile(values = [], pct = 90) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function buildRange(query = {}, fallback = '30d') {
  const now = new Date();
  if (query.date_from || query.from || query.date_to || query.to) {
    return {
      start: startOfDay(query.date_from || query.from || now),
      end: endOfDay(query.date_to || query.to || query.date_from || query.from || now),
    };
  }
  const range = String(query.period || query.range || fallback).toLowerCase();
  if (range === 'today') return { start: startOfDay(now), end: endOfDay(now) };
  if (range === '7d') return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (range === '30d') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (range === 'week') return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
  if (range === 'month') return { start: startOfMonth(now), end: endOfDay(now) };
  return { start: startOfDay(query.date || now), end: endOfDay(query.date || now) };
}

function buildPagination(query = {}, total = 0, defaultLimit = 30) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || defaultLimit), 1), 200);
  return {
    page,
    limit,
    total,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

function paginate(rows = [], query = {}, defaultLimit = 30) {
  const pagination = buildPagination(query, rows.length, defaultLimit);
  const start = (pagination.page - 1) * pagination.limit;
  return { items: rows.slice(start, start + pagination.limit), pagination };
}

function stringifyId(value) {
  return value?._id ? String(value._id) : (value ? String(value) : null);
}

function patientName(patient = {}) {
  return patient.full_name || patient.patient_name || patient.patient_code || 'Không rõ';
}

function userName(user = {}) {
  return user.full_name || user.username || user.employee_code || 'Chưa gán';
}

function departmentName(department = {}) {
  return department.department_name || department.name || department.department_code || 'Chưa rõ khoa';
}

function roomName(room = {}) {
  return room.room_name || room.room_code || 'Chưa rõ phòng';
}

function bedName(bed = {}) {
  return bed.bed_name || bed.bed_code || 'Chưa rõ giường';
}

function groupCount(rows = [], keyGetter, labelKey = 'label') {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyGetter(row) || 'unknown';
    if (!map.has(key)) map.set(key, { [labelKey]: key, count: 0 });
    map.get(key).count += 1;
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function groupSum(rows = [], keyGetter, valueGetter, labelKey = 'label') {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyGetter(row) || 'unknown';
    if (!map.has(key)) map.set(key, { [labelKey]: key, count: 0, value: 0 });
    const item = map.get(key);
    item.count += 1;
    item.value += normalizeNumber(valueGetter(row));
  });
  return [...map.values()].map((item) => ({ ...item, value: round(item.value, 2) })).sort((a, b) => b.value - a.value);
}

function dateMatch(field, range) {
  return { [field]: { $gte: range.start, $lte: range.end } };
}

function admissionBaseMatch(query = {}, range = buildRange(query)) {
  const match = {};
  if (query.status) match.status = query.status;
  if (query.department_id) match.department_id = query.department_id;
  if (query.doctor_id || query.attending_doctor_id) match.attending_doctor_id = query.doctor_id || query.attending_doctor_id;
  match.$or = [
    dateMatch('created_at', range),
    dateMatch('admitted_at', range),
    dateMatch('discharged_at', range),
    dateMatch('expected_discharge_at', range),
  ];
  return match;
}

function emergencyBaseMatch(query = {}, range = buildRange(query)) {
  const match = { created_at: { $gte: range.start, $lte: range.end } };
  if (query.status) match.status = query.status;
  if (query.priority) match.priority = query.priority;
  if (query.source) match.source = query.source;
  if (query.sla_status) match.sla_status = query.sla_status;
  if (query.department_id) match.assigned_department_id = query.department_id;
  if (query.doctor_id) match.primary_doctor_id = query.doctor_id;
  return match;
}

async function loadAdmissions(query = {}, range = buildRange(query), extraMatch = {}) {
  const match = { ...admissionBaseMatch(query, range), ...extraMatch };
  const rows = await Admission.find(match)
    .sort({ admitted_at: -1, created_at: -1 })
    .limit(1000)
    .populate('patient_id', 'patient_code full_name phone')
    .populate('department_id', 'department_code department_name')
    .populate('attending_doctor_id', 'full_name username employee_code')
    .lean();
  const admissionIds = rows.map((row) => row._id);
  const [assignments, tasks, administrations] = await Promise.all([
    admissionIds.length
      ? BedAssignment.find({ admission_id: { $in: admissionIds }, status: BED_ASSIGNMENT_STATUS.ACTIVE })
        .populate({ path: 'bed_id', select: 'bed_code bed_name bed_type status room_id', populate: { path: 'room_id', select: 'room_code room_name room_type floor building department_id' } })
        .lean()
      : [],
    admissionIds.length
      ? InpatientTask.aggregate([
        { $match: { admission_id: { $in: admissionIds } } },
        { $group: { _id: { admission_id: '$admission_id', status: '$status' }, count: { $sum: 1 } } },
      ])
      : [],
    admissionIds.length
      ? MedicationAdministration.aggregate([
        { $match: { admission_id: { $in: admissionIds } } },
        { $group: { _id: { admission_id: '$admission_id', status: '$status' }, count: { $sum: 1 } } },
      ])
      : [],
  ]);
  const assignmentMap = new Map(assignments.map((row) => [String(row.admission_id), row]));
  const taskMap = new Map();
  tasks.forEach((row) => {
    const key = String(row._id.admission_id);
    if (!taskMap.has(key)) taskMap.set(key, {});
    taskMap.get(key)[row._id.status] = row.count;
  });
  const medMap = new Map();
  administrations.forEach((row) => {
    const key = String(row._id.admission_id);
    if (!medMap.has(key)) medMap.set(key, {});
    medMap.get(key)[row._id.status] = row.count;
  });
  const now = new Date();
  return rows.map((row) => {
    const assignment = assignmentMap.get(String(row._id)) || {};
    const bed = assignment.bed_id || {};
    const room = bed.room_id || {};
    const taskCounts = taskMap.get(String(row._id)) || {};
    const medCounts = medMap.get(String(row._id)) || {};
    const admittedAt = row.admitted_at || row.created_at;
    const endAt = row.discharged_at || now;
    const losHours = admittedAt ? Math.max((new Date(endAt) - new Date(admittedAt)) / MS_PER_HOUR, 0) : 0;
    const highRisk = ['high', 'critical'].includes(row.priority)
      || ['high'].includes(row.fall_risk_level)
      || ['high'].includes(row.infection_risk_level)
      || ['high'].includes(row.pressure_ulcer_risk_level);
    return {
      admission_id: String(row._id),
      admission_no: row.admission_no,
      admission_type: row.admission_type,
      patient_id: stringifyId(row.patient_id),
      patient_code: row.patient_id?.patient_code || null,
      patient_name: patientName(row.patient_id),
      department_id: stringifyId(row.department_id),
      department_name: departmentName(row.department_id),
      attending_doctor_id: stringifyId(row.attending_doctor_id),
      attending_doctor_name: userName(row.attending_doctor_id),
      status: row.status,
      priority: row.priority,
      room_id: stringifyId(room),
      room_name: roomName(room),
      room_code: room.room_code || null,
      bed_id: stringifyId(bed),
      bed_name: bedName(bed),
      bed_code: bed.bed_code || null,
      admitted_at: row.admitted_at,
      expected_discharge_at: row.expected_discharge_at,
      discharged_at: row.discharged_at,
      discharge_planning_status: row.discharge_planning_status,
      discharge_disposition: row.discharge_disposition,
      los_hours: round(losHours, 1),
      los_days: round(losHours / 24, 2),
      high_risk: highRisk,
      abnormal_vitals: row.nursing_acuity_score >= 8 ? 1 : 0,
      open_tasks_count: normalizeNumber(taskCounts[INPATIENT_TASK_STATUS.TODO]) + normalizeNumber(taskCounts[INPATIENT_TASK_STATUS.IN_PROGRESS]),
      overdue_tasks_count: 0,
      medication_due_count: normalizeNumber(medCounts[ADMINISTRATION_STATUS.SCHEDULED]),
      medication_overdue_count: 0,
      charges_total: 0,
      latest_nursing_note: row.nursing_note_summary || null,
    };
  });
}

async function getAdmissionsReport(query = {}) {
  const range = buildRange(query);
  const rows = await loadAdmissions(query, range);
  const today = new Date();
  const summary = {
    total_admissions: rows.length,
    planned_count: rows.filter((row) => row.status === ADMISSION_STATUS.PLANNED).length,
    admitted_count: rows.filter((row) => row.status === ADMISSION_STATUS.ADMITTED).length,
    transferred_count: rows.filter((row) => row.status === ADMISSION_STATUS.TRANSFERRED).length,
    discharged_count: rows.filter((row) => row.status === ADMISSION_STATUS.DISCHARGED).length,
    cancelled_count: rows.filter((row) => row.status === ADMISSION_STATUS.CANCELLED).length,
    active_admissions: rows.filter((row) => [ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED].includes(row.status)).length,
    pending_bed_assignment: rows.filter((row) => !row.bed_id && [ADMISSION_STATUS.PLANNED, ADMISSION_STATUS.ADMITTED].includes(row.status)).length,
    high_risk_patients: rows.filter((row) => row.high_risk).length,
    abnormal_vitals: rows.reduce((sum, row) => sum + normalizeNumber(row.abnormal_vitals), 0),
    planned_discharge_today: rows.filter((row) => row.expected_discharge_at && isoDate(row.expected_discharge_at) === isoDate(today)).length,
    total_inpatient_charges: rows.reduce((sum, row) => sum + normalizeNumber(row.charges_total), 0),
  };
  const { items, pagination } = paginate(rows, query);
  return {
    summary,
    charts: {
      admission_by_day: groupCount(rows, (row) => isoDate(row.admitted_at || row.created_at), 'date'),
      by_department: groupCount(rows, (row) => row.department_name, 'department_name'),
      by_status: groupCount(rows, (row) => row.status, 'status'),
      high_risk_by_department: groupCount(rows.filter((row) => row.high_risk), (row) => row.department_name, 'department_name'),
      planned_vs_admitted: [
        { label: 'planned', count: summary.planned_count },
        { label: 'admitted', count: summary.admitted_count },
      ],
    },
    items,
    pagination,
    filters: { date_from: range.start, date_to: range.end, timezone: query.timezone || DEFAULT_TIMEZONE },
    backend_todo: ['GET /api/reports/inpatient-emergency/admissions should add admission source, inpatient charge totals and vitals severity from a materialized ward-board snapshot.'],
  };
}

async function getDischargesReport(query = {}) {
  const range = buildRange(query);
  const rows = await loadAdmissions({ ...query, status: query.status || undefined }, range);
  const dischargeRows = rows.filter((row) =>
    row.status === ADMISSION_STATUS.DISCHARGED
    || row.expected_discharge_at
    || ['ready', 'delayed', 'in_progress'].includes(row.discharge_planning_status),
  );
  const now = new Date();
  const summary = {
    total_discharge_scope: dischargeRows.length,
    planned_discharge_today: dischargeRows.filter((row) => row.expected_discharge_at && isoDate(row.expected_discharge_at) === isoDate(now)).length,
    discharged_today: dischargeRows.filter((row) => row.discharged_at && isoDate(row.discharged_at) === isoDate(now)).length,
    discharge_pending: dischargeRows.filter((row) => row.status !== ADMISSION_STATUS.DISCHARGED).length,
    discharge_delayed: dischargeRows.filter((row) => row.discharge_planning_status === 'delayed' || (row.expected_discharge_at && !row.discharged_at && new Date(row.expected_discharge_at) < now)).length,
    ready_for_discharge: dischargeRows.filter((row) => row.discharge_planning_status === 'ready').length,
    not_ready: dischargeRows.filter((row) => row.discharge_planning_status !== 'ready' && row.status !== ADMISSION_STATUS.DISCHARGED).length,
    readiness_blocker_count: dischargeRows.reduce((sum, row) => sum + normalizeNumber(row.open_tasks_count), 0),
    pending_charge_before_discharge: dischargeRows.filter((row) => normalizeNumber(row.charges_total) > 0 && row.status !== ADMISSION_STATUS.DISCHARGED).length,
  };
  const { items, pagination } = paginate(dischargeRows, query);
  return {
    summary,
    charts: {
      discharge_by_day: groupCount(dischargeRows.filter((row) => row.discharged_at), (row) => isoDate(row.discharged_at), 'date'),
      by_department: groupCount(dischargeRows, (row) => row.department_name, 'department_name'),
      readiness_status: groupCount(dischargeRows, (row) => row.discharge_planning_status || 'not_started', 'status'),
      planned_vs_actual: [
        { label: 'planned', count: summary.planned_discharge_today },
        { label: 'actual', count: summary.discharged_today },
      ],
    },
    items,
    pagination,
    filters: { date_from: range.start, date_to: range.end, timezone: query.timezone || DEFAULT_TIMEZONE },
    backend_todo: ['GET /api/reports/inpatient-emergency/discharges should persist readiness blockers by clinical, billing, medication, documents and follow-up categories.'],
  };
}

async function getBedOccupancyReport(query = {}) {
  const [beds, rooms, activeAssignments] = await Promise.all([
    Bed.find(query.bed_status ? { status: query.bed_status, is_deleted: false } : { is_deleted: false })
      .populate({ path: 'room_id', select: 'room_code room_name room_type floor building department_id', populate: { path: 'department_id', select: 'department_code department_name' } })
      .lean(),
    Room.find({ is_deleted: false }).populate('department_id', 'department_code department_name').lean(),
    BedAssignment.find({ status: BED_ASSIGNMENT_STATUS.ACTIVE })
      .populate({ path: 'admission_id', select: 'admission_no patient_id attending_doctor_id admitted_at status', populate: [{ path: 'patient_id', select: 'patient_code full_name' }, { path: 'attending_doctor_id', select: 'full_name username employee_code' }] })
      .lean(),
  ]);
  const assignmentMap = new Map(activeAssignments.map((row) => [String(row.bed_id), row]));
  const rows = beds.map((bed) => {
    const room = bed.room_id || {};
    const assignment = assignmentMap.get(String(bed._id)) || {};
    const admission = assignment.admission_id || {};
    const losHours = admission.admitted_at ? Math.max((new Date() - new Date(admission.admitted_at)) / MS_PER_HOUR, 0) : 0;
    return {
      bed_id: String(bed._id),
      bed_code: bed.bed_code,
      bed_name: bedName(bed),
      bed_type: bed.bed_type,
      status: bed.status,
      room_id: stringifyId(room),
      room_code: room.room_code || null,
      room_name: roomName(room),
      room_type: room.room_type,
      floor: room.floor,
      building: room.building,
      department_id: stringifyId(room.department_id),
      department_name: departmentName(room.department_id),
      patient_name: patientName(admission.patient_id || {}),
      admission_no: admission.admission_no || null,
      admission_id: stringifyId(admission),
      attending_doctor_name: userName(admission.attending_doctor_id || {}),
      assigned_from: assignment.assigned_from || null,
      los_hours: round(losHours, 1),
      los_days: round(losHours / 24, 2),
    };
  }).filter((row) => !query.department_id || row.department_id === String(query.department_id));
  const totalBeds = rows.length;
  const summary = {
    total_beds: totalBeds,
    occupied_beds: rows.filter((row) => row.status === BED_STATUS.OCCUPIED).length,
    available_beds: rows.filter((row) => row.status === BED_STATUS.AVAILABLE).length,
    reserved_beds: rows.filter((row) => row.status === BED_STATUS.RESERVED).length,
    maintenance_beds: rows.filter((row) => row.status === BED_STATUS.MAINTENANCE).length,
    blocked_beds: rows.filter((row) => row.status === BED_STATUS.BLOCKED).length,
    inactive_beds: rows.filter((row) => row.status === BED_STATUS.INACTIVE).length,
  };
  summary.occupancy_rate = percentage(summary.occupied_beds, totalBeds);
  summary.available_rate = percentage(summary.available_beds, totalBeds);
  const byDepartment = groupCount(rows, (row) => row.department_name, 'department_name').map((row) => ({
    ...row,
    occupied: rows.filter((item) => item.department_name === row.department_name && item.status === BED_STATUS.OCCUPIED).length,
    total: rows.filter((item) => item.department_name === row.department_name).length,
  })).map((row) => ({ ...row, occupancy_rate: percentage(row.occupied, row.total) }));
  const { items, pagination } = paginate(rows, query);
  return {
    summary: {
      ...summary,
      highest_occupancy_department: byDepartment[0]?.department_name || null,
      critical_bed_shortage: byDepartment.filter((row) => row.occupancy_rate >= 90).length,
      active_rooms: rooms.length,
    },
    charts: {
      bed_status: groupCount(rows, (row) => row.status, 'status'),
      occupancy_by_department: byDepartment,
      occupancy_by_room_type: groupCount(rows, (row) => row.room_type || 'ward', 'room_type'),
    },
    ward_map: rows,
    items,
    pagination,
    backend_todo: ['GET /api/reports/inpatient-emergency/bed-occupancy should add historical occupancy_by_day/hour snapshots and peak occupancy.'],
  };
}

async function getBedTurnoverReport(query = {}) {
  const range = buildRange(query);
  const match = { assigned_from: { $gte: range.start, $lte: range.end } };
  if (query.bed_id) match.bed_id = query.bed_id;
  const assignments = await BedAssignment.find(match)
    .populate({ path: 'bed_id', select: 'bed_code bed_name bed_type status room_id', populate: { path: 'room_id', select: 'room_code room_name room_type department_id', populate: { path: 'department_id', select: 'department_code department_name' } } })
    .populate({ path: 'admission_id', select: 'admission_no patient_id department_id', populate: { path: 'patient_id', select: 'patient_code full_name' } })
    .lean();
  const byBed = new Map();
  assignments.forEach((assignment) => {
    const bed = assignment.bed_id || {};
    const room = bed.room_id || {};
    const key = stringifyId(bed) || String(assignment.bed_id);
    if (!byBed.has(key)) {
      byBed.set(key, {
        bed_id: key,
        bed_code: bed.bed_code,
        bed_name: bedName(bed),
        bed_type: bed.bed_type,
        status: bed.status,
        room_name: roomName(room),
        department_name: departmentName(room.department_id),
        assignment_count: 0,
        transfer_count: 0,
        release_count: 0,
        cancelled_assignment_count: 0,
        occupied_hours: [],
        last_patient: null,
        last_released_at: null,
        next_assigned_at: null,
      });
    }
    const row = byBed.get(key);
    row.assignment_count += 1;
    if (assignment.status === BED_ASSIGNMENT_STATUS.TRANSFERRED) row.transfer_count += 1;
    if (assignment.status === BED_ASSIGNMENT_STATUS.RELEASED) row.release_count += 1;
    if (assignment.status === BED_ASSIGNMENT_STATUS.CANCELLED) row.cancelled_assignment_count += 1;
    const endAt = assignment.assigned_to || new Date();
    row.occupied_hours.push(Math.max((new Date(endAt) - new Date(assignment.assigned_from)) / MS_PER_HOUR, 0));
    row.last_patient = patientName(assignment.admission_id?.patient_id || {});
    row.last_released_at = assignment.assigned_to || row.last_released_at;
  });
  const rows = [...byBed.values()].map((row) => ({
    ...row,
    average_bed_stay_hours: round(average(row.occupied_hours), 1),
    average_bed_idle_hours: null,
    same_day_reuse_count: 0,
    turnover_rate: row.assignment_count,
    turnover_score: round(row.assignment_count + row.transfer_count * 0.5 - row.cancelled_assignment_count * 0.25, 2),
  })).sort((a, b) => b.turnover_score - a.turnover_score);
  const summary = {
    bed_assignment_count: assignments.length,
    transfer_count: rows.reduce((sum, row) => sum + row.transfer_count, 0),
    release_count: rows.reduce((sum, row) => sum + row.release_count, 0),
    cancelled_assignment_count: rows.reduce((sum, row) => sum + row.cancelled_assignment_count, 0),
    average_bed_stay_hours: round(average(rows.map((row) => row.average_bed_stay_hours)), 1),
    average_bed_idle_hours: null,
    same_day_reuse_count: 0,
    turnover_rate: round(average(rows.map((row) => row.turnover_rate)), 2),
    department_highest_turnover: rows[0]?.department_name || null,
    bed_blocked_after_discharge: rows.filter((row) => row.status === BED_STATUS.BLOCKED).length,
  };
  const { items, pagination } = paginate(rows, query);
  return {
    summary,
    charts: {
      turnover_by_day: groupCount(assignments, (row) => isoDate(row.assigned_from), 'date'),
      transfer_by_department: groupSum(rows, (row) => row.department_name, (row) => row.transfer_count, 'department_name'),
      release_by_department: groupSum(rows, (row) => row.department_name, (row) => row.release_count, 'department_name'),
      turnover_by_room_type: groupCount(rows, (row) => row.bed_type, 'bed_type'),
    },
    items,
    pagination,
    filters: { date_from: range.start, date_to: range.end, timezone: query.timezone || DEFAULT_TIMEZONE },
    backend_todo: ['GET /api/reports/inpatient-emergency/bed-turnover should capture cleaning events and next assignment gaps for audited idle-time metrics.'],
  };
}

async function getLengthOfStayReport(query = {}) {
  const range = buildRange(query);
  const rows = await loadAdmissions(query, range);
  const losValues = rows.map((row) => row.los_days);
  const now = new Date();
  const longStay = rows.filter((row) => row.los_days > 7);
  const summary = {
    average_los_days: round(average(losValues), 2),
    median_los_days: round(percentile(losValues, 50), 2),
    p90_los_days: round(percentile(losValues, 90), 2),
    current_longest_stay_days: round(Math.max(0, ...losValues), 2),
    long_stay_patients: longStay.length,
    los_over_3_days: rows.filter((row) => row.los_days > 3).length,
    los_over_7_days: rows.filter((row) => row.los_days > 7).length,
    los_over_14_days: rows.filter((row) => row.los_days > 14).length,
    expected_discharge_missed: rows.filter((row) => row.expected_discharge_at && !row.discharged_at && new Date(row.expected_discharge_at) < now).length,
  };
  const byDepartment = groupSum(rows, (row) => row.department_name, (row) => row.los_days, 'department_name').map((row) => ({
    ...row,
    average_los_days: round(row.value / Math.max(row.count, 1), 2),
  }));
  summary.department_highest_los = byDepartment[0]?.department_name || null;
  const { items, pagination } = paginate(rows.map((row) => ({
    ...row,
    los_bucket: row.los_days > 14 ? '>14 ngày' : row.los_days > 7 ? '7-14 ngày' : row.los_days > 3 ? '3-7 ngày' : '0-3 ngày',
    risk: row.los_days > 14 || row.high_risk ? 'high' : row.los_days > 7 ? 'medium' : 'normal',
    open_blockers: row.open_tasks_count,
  })), query);
  return {
    summary,
    charts: {
      los_distribution: groupCount(rows, (row) => row.los_days > 14 ? '>14 ngày' : row.los_days > 7 ? '7-14 ngày' : row.los_days > 3 ? '3-7 ngày' : '0-3 ngày', 'bucket'),
      los_by_department: byDepartment,
      los_by_doctor: groupSum(rows, (row) => row.attending_doctor_name, (row) => row.los_days, 'doctor_name').map((row) => ({ ...row, average_los_days: round(row.value / Math.max(row.count, 1), 2) })),
      long_stay_by_department: groupCount(longStay, (row) => row.department_name, 'department_name'),
    },
    items,
    pagination,
    filters: { date_from: range.start, date_to: range.end, timezone: query.timezone || DEFAULT_TIMEZONE },
    backend_todo: ['GET /api/reports/inpatient-emergency/length-of-stay should add diagnosis-adjusted expected LOS and department benchmark comparison.'],
  };
}

async function getInpatientTasksReport(query = {}) {
  const range = buildRange(query);
  const taskMatch = { created_at: { $gte: range.start, $lte: range.end } };
  if (query.status) taskMatch.status = query.status;
  if (query.department_id) {
    const admissions = await Admission.find({ department_id: query.department_id }).select('_id').lean();
    taskMatch.admission_id = { $in: admissions.map((row) => row._id) };
  }
  const [tasks, medAdmins, handovers] = await Promise.all([
    InpatientTask.find(taskMatch)
      .sort({ due_at: 1, created_at: -1 })
      .limit(1000)
      .populate('patient_id', 'patient_code full_name')
      .populate('admission_id', 'admission_no department_id')
      .populate('assigned_to', 'full_name username employee_code')
      .lean(),
    MedicationAdministration.find({ scheduled_at: { $gte: range.start, $lte: range.end } })
      .limit(1000)
      .populate('patient_id', 'patient_code full_name')
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .lean(),
    InpatientHandover.find({ shift_date: { $gte: range.start, $lte: range.end } }).sort({ shift_date: -1 }).limit(200).lean(),
  ]);
  const now = new Date();
  const rows = tasks.map((task) => ({
    task_id: String(task._id),
    task_code: task.task_code || String(task._id).slice(-8),
    title: task.title,
    type: task.type,
    admission_id: stringifyId(task.admission_id),
    admission_no: task.admission_id?.admission_no || null,
    patient_id: stringifyId(task.patient_id),
    patient_name: patientName(task.patient_id),
    assignee_id: stringifyId(task.assigned_to),
    assignee_name: userName(task.assigned_to),
    priority: task.priority,
    status: task.status,
    due_at: task.due_at,
    overdue_minutes: task.due_at && ![INPATIENT_TASK_STATUS.DONE, INPATIENT_TASK_STATUS.CANCELLED].includes(task.status)
      ? Math.max(round((now - new Date(task.due_at)) / 60000, 1), 0)
      : 0,
    created_at: task.created_at,
    completed_at: task.completed_at,
  }));
  const summary = {
    total_tasks: rows.length,
    todo_count: rows.filter((row) => row.status === INPATIENT_TASK_STATUS.TODO).length,
    in_progress_count: rows.filter((row) => row.status === INPATIENT_TASK_STATUS.IN_PROGRESS).length,
    done_count: rows.filter((row) => row.status === INPATIENT_TASK_STATUS.DONE).length,
    cancelled_count: rows.filter((row) => row.status === INPATIENT_TASK_STATUS.CANCELLED).length,
    overdue_tasks: rows.filter((row) => row.overdue_minutes > 0).length,
    open_tasks: rows.filter((row) => [INPATIENT_TASK_STATUS.TODO, INPATIENT_TASK_STATUS.IN_PROGRESS].includes(row.status)).length,
    assigned_tasks: rows.filter((row) => row.assignee_id).length,
    unassigned_tasks: rows.filter((row) => !row.assignee_id).length,
    medication_due_now: medAdmins.filter((row) => row.status === ADMINISTRATION_STATUS.SCHEDULED).length,
    medication_overdue: medAdmins.filter((row) => row.status === ADMINISTRATION_STATUS.SCHEDULED && row.scheduled_at && new Date(row.scheduled_at) < now).length,
    handover_pending: handovers.filter((row) => ['draft', 'prepared', 'signed'].includes(row.status)).length,
  };
  const { items, pagination } = paginate(rows, query);
  return {
    summary,
    charts: {
      task_by_status: groupCount(rows, (row) => row.status, 'status'),
      task_by_assignee: groupCount(rows, (row) => row.assignee_name, 'assignee_name'),
      medication_status: groupCount(medAdmins, (row) => row.status, 'status'),
      handover_status: groupCount(handovers, (row) => row.status, 'status'),
    },
    medication_items: medAdmins,
    handovers,
    items,
    pagination,
    filters: { date_from: range.start, date_to: range.end, timezone: query.timezone || DEFAULT_TIMEZONE },
    backend_todo: ['GET /api/reports/inpatient-emergency/inpatient-tasks should add task SLA policy, nursing workload by shift and handover acknowledgement latency.'],
  };
}

async function loadEmergencyCases(query = {}, range = buildRange(query)) {
  const cases = await EmergencyCase.find(emergencyBaseMatch(query, range))
    .sort({ created_at: -1 })
    .limit(1000)
    .populate('patient_id', 'patient_code full_name phone')
    .populate('assigned_department_id', 'department_code department_name')
    .populate('assigned_to_user_id primary_doctor_id primary_nurse_id', 'full_name username employee_code')
    .lean();
  return cases.map((item) => ({
    case_id: String(item._id),
    case_code: item.case_code,
    patient_id: stringifyId(item.patient_id),
    patient_name: patientName(item.patient_id),
    priority: item.priority,
    status: item.status,
    source: item.source,
    type: item.type,
    location_text: item.location_text,
    with_gps: Boolean(item.location_lat && item.location_lng),
    symptoms: item.symptoms,
    assigned_department_id: stringifyId(item.assigned_department_id),
    assigned_department_name: departmentName(item.assigned_department_id),
    assigned_user_id: stringifyId(item.assigned_to_user_id),
    assigned_user_name: userName(item.assigned_to_user_id),
    primary_doctor_name: userName(item.primary_doctor_id),
    created_at: item.created_at,
    acknowledged_at: item.acknowledged_at,
    triaged_at: item.triaged_at,
    dispatched_at: item.dispatched_at,
    resolved_at: item.resolved_at || item.closed_at,
    closed_at: item.closed_at,
    sla_status: item.sla_status,
    sla_next_due_at: item.sla_next_due_at,
    escalation_level: normalizeNumber(item.escalation_level),
    severe_allergy: Boolean(item.metadata?.severe_allergy),
    patient_sos: item.triggered_by_actor_type === 'patient' || item.source === 'patient_app',
    staff_created: item.source === 'staff_created',
    ack_seconds: item.acknowledged_at ? round((new Date(item.acknowledged_at) - new Date(item.created_at)) / 1000, 1) : null,
    triage_seconds: item.triaged_at && item.acknowledged_at ? round((new Date(item.triaged_at) - new Date(item.acknowledged_at)) / 1000, 1) : null,
    dispatch_seconds: item.dispatched_at && item.triaged_at ? round((new Date(item.dispatched_at) - new Date(item.triaged_at)) / 1000, 1) : null,
    resolution_seconds: (item.resolved_at || item.closed_at) ? round((new Date(item.resolved_at || item.closed_at) - new Date(item.created_at)) / 1000, 1) : null,
  }));
}

function emergencySummary(rows = []) {
  return {
    total_cases: rows.length,
    open_cases: rows.filter((row) => ![EMERGENCY_STATUS.RESOLVED, EMERGENCY_STATUS.CANCELLED, EMERGENCY_STATUS.FALSE_ALARM].includes(row.status)).length,
    critical_count: rows.filter((row) => row.priority === EMERGENCY_PRIORITY.CRITICAL).length,
    urgent_count: rows.filter((row) => row.priority === EMERGENCY_PRIORITY.URGENT).length,
    unassigned_count: rows.filter((row) => !row.assigned_user_id).length,
    acknowledged_count: rows.filter((row) => row.status === EMERGENCY_STATUS.ACKNOWLEDGED).length,
    triaged_count: rows.filter((row) => row.status === EMERGENCY_STATUS.TRIAGED).length,
    dispatched_count: rows.filter((row) => row.status === EMERGENCY_STATUS.DISPATCHED).length,
    resolved_count: rows.filter((row) => row.status === EMERGENCY_STATUS.RESOLVED).length,
    cancelled_count: rows.filter((row) => row.status === EMERGENCY_STATUS.CANCELLED).length,
    false_alarm_count: rows.filter((row) => row.status === EMERGENCY_STATUS.FALSE_ALARM).length,
    patient_sos_count: rows.filter((row) => row.patient_sos).length,
    staff_created_count: rows.filter((row) => row.staff_created).length,
    escalated_count: rows.filter((row) => row.escalation_level > 0 || row.sla_status === 'escalated').length,
    severe_allergy_risk: rows.filter((row) => row.severe_allergy).length,
    breached_count: rows.filter((row) => row.sla_status === 'breached').length,
    at_risk_count: rows.filter((row) => row.sla_status === 'at_risk').length,
  };
}

async function getEmergencyCasesReport(query = {}) {
  const range = buildRange(query);
  const rows = await loadEmergencyCases(query, range);
  const { items, pagination } = paginate(rows, query);
  return {
    summary: emergencySummary(rows),
    charts: {
      cases_by_priority: groupCount(rows, (row) => row.priority, 'priority'),
      cases_by_status: groupCount(rows, (row) => row.status, 'status'),
      cases_by_source: groupCount(rows, (row) => row.source, 'source'),
      cases_by_department: groupCount(rows, (row) => row.assigned_department_name, 'department_name'),
      cases_by_day: groupCount(rows, (row) => isoDate(row.created_at), 'date'),
    },
    items,
    pagination,
    filters: { date_from: range.start, date_to: range.end, timezone: query.timezone || DEFAULT_TIMEZONE },
    backend_todo: ['GET /api/reports/inpatient-emergency/emergency-cases should include structured patient risk snapshot and escalation reason taxonomy.'],
  };
}

async function getResponseTimeReport(query = {}) {
  const range = buildRange(query);
  const rows = await loadEmergencyCases(query, range);
  const ack = rows.map((row) => row.ack_seconds).filter((value) => value !== null);
  const triage = rows.map((row) => row.triage_seconds).filter((value) => value !== null);
  const dispatch = rows.map((row) => row.dispatch_seconds).filter((value) => value !== null);
  const resolve = rows.map((row) => row.resolution_seconds).filter((value) => value !== null);
  const summary = {
    median_acknowledge_seconds: round(percentile(ack, 50), 1),
    avg_acknowledge_seconds: round(average(ack), 1),
    p90_acknowledge_seconds: round(percentile(ack, 90), 1),
    median_triage_seconds: round(percentile(triage, 50), 1),
    median_dispatch_seconds: round(percentile(dispatch, 50), 1),
    median_resolve_seconds: round(percentile(resolve, 50), 1),
    sla_compliance_percent: percentage(rows.filter((row) => !['breached', 'at_risk', 'escalated'].includes(row.sla_status)).length, rows.length),
    sla_breached: rows.filter((row) => row.sla_status === 'breached').length,
    sla_at_risk: rows.filter((row) => row.sla_status === 'at_risk').length,
    escalated: rows.filter((row) => row.sla_status === 'escalated' || row.escalation_level > 0).length,
    critical_breached: rows.filter((row) => row.priority === EMERGENCY_PRIORITY.CRITICAL && row.sla_status === 'breached').length,
  };
  const { items, pagination } = paginate(rows, query);
  return {
    summary,
    charts: {
      response_by_priority: groupSum(rows, (row) => row.priority, (row) => row.resolution_seconds || row.ack_seconds || 0, 'priority'),
      sla_status: groupCount(rows, (row) => row.sla_status, 'sla_status'),
      breach_by_department: groupCount(rows.filter((row) => row.sla_status === 'breached'), (row) => row.assigned_department_name, 'department_name'),
      sla_trend_by_day: groupCount(rows.filter((row) => row.sla_status === 'breached'), (row) => isoDate(row.created_at), 'date'),
    },
    items,
    pagination,
    filters: { date_from: range.start, date_to: range.end, timezone: query.timezone || DEFAULT_TIMEZONE },
    backend_todo: ['GET /api/reports/inpatient-emergency/response-time should persist stage timestamps and compute p90/p95 by priority, department and source.'],
  };
}

async function getCaseResolutionReport(query = {}) {
  const range = buildRange(query);
  const rows = await loadEmergencyCases(query, range);
  const closedRows = rows.filter((row) => [EMERGENCY_STATUS.RESOLVED, EMERGENCY_STATUS.CANCELLED, EMERGENCY_STATUS.FALSE_ALARM].includes(row.status));
  const resolutionValues = closedRows.map((row) => row.resolution_seconds).filter((value) => value !== null);
  const summary = {
    total_cases: rows.length,
    resolved_cases: rows.filter((row) => row.status === EMERGENCY_STATUS.RESOLVED).length,
    cancelled_cases: rows.filter((row) => row.status === EMERGENCY_STATUS.CANCELLED).length,
    false_alarm_cases: rows.filter((row) => row.status === EMERGENCY_STATUS.FALSE_ALARM).length,
    open_cases: rows.filter((row) => ![EMERGENCY_STATUS.RESOLVED, EMERGENCY_STATUS.CANCELLED, EMERGENCY_STATUS.FALSE_ALARM].includes(row.status)).length,
    escalation_count: rows.filter((row) => row.escalation_level > 0 || row.sla_status === 'escalated').length,
    average_resolution_seconds: round(average(resolutionValues), 1),
  };
  summary.resolution_rate = percentage(summary.resolved_cases, rows.length);
  summary.cancellation_rate = percentage(summary.cancelled_cases, rows.length);
  summary.false_alarm_rate = percentage(summary.false_alarm_cases, rows.length);
  summary.escalation_rate = percentage(summary.escalation_count, rows.length);
  summary.critical_resolution_rate = percentage(rows.filter((row) => row.priority === EMERGENCY_PRIORITY.CRITICAL && row.status === EMERGENCY_STATUS.RESOLVED).length, rows.filter((row) => row.priority === EMERGENCY_PRIORITY.CRITICAL).length);
  const caseIds = rows.map((row) => row.case_id);
  const events = caseIds.length
    ? await EmergencyCaseEvent.find({ case_id: { $in: caseIds } }).sort({ created_at: 1 }).limit(2000).lean()
    : [];
  const { items, pagination } = paginate(rows, query);
  return {
    summary,
    charts: {
      resolution_by_day: groupCount(closedRows, (row) => isoDate(row.resolved_at || row.closed_at), 'date'),
      resolution_by_priority: groupCount(closedRows, (row) => row.priority, 'priority'),
      resolution_by_source: groupCount(closedRows, (row) => row.source, 'source'),
      final_status: groupCount(rows, (row) => row.status, 'status'),
      escalated_vs_non_escalated: [
        { label: 'escalated', count: summary.escalation_count },
        { label: 'non_escalated', count: Math.max(rows.length - summary.escalation_count, 0) },
      ],
    },
    events,
    items,
    pagination,
    filters: { date_from: range.start, date_to: range.end, timezone: query.timezone || DEFAULT_TIMEZONE },
    backend_todo: ['GET /api/reports/inpatient-emergency/case-resolution should add false-alarm taxonomy, recurrence detection and escalation impact analysis.'],
  };
}

module.exports = {
  getAdmissionsReport,
  getDischargesReport,
  getBedOccupancyReport,
  getBedTurnoverReport,
  getLengthOfStayReport,
  getInpatientTasksReport,
  getEmergencyCasesReport,
  getResponseTimeReport,
  getCaseResolutionReport,
};
