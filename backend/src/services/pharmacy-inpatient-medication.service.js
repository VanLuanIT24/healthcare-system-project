const { Types } = require('mongoose');
const {
  Admission,
  DispenseItem,
  MedicationAdministrationEvent,
  MedicationIntervention,
  MedicationReactionObservation,
} = require('../models');
const {
  ADMINISTRATION_STATUS,
} = require('../constants/statuses');
const {
  buildPagination,
  createError,
  escapeRegex,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const inpatientWorkspaceService = require('./inpatient-workspace.service');

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return String(value);
  if (value._id) return normalizeId(value._id);
  if (value.id) return normalizeId(value.id);
  return typeof value.toString === 'function' ? value.toString() : null;
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return undefined;
  const id = normalizeId(value);
  if (!Types.ObjectId.isValid(id)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(id);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.user?._id || actor.user?.id || null;
}

function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function dateWindow(value = new Date()) {
  const date = parseDate(value || new Date(), 'date') || new Date();
  return { start: getStartOfDay(date), end: getEndOfDay(date) };
}

function csv(value, fallback = []) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  const text = normalizeString(value);
  return text ? text.split(',').map((item) => item.trim()).filter(Boolean) : fallback;
}

function safeText(value, fallback = 'Chưa rõ') {
  return normalizeString(value) || fallback;
}

function medicationDisplay(medication = {}) {
  if (!medication || typeof medication !== 'object') return 'Chưa rõ thuốc';
  return [medication.brand_name || medication.name || medication.generic_name, medication.strength]
    .filter(Boolean)
    .join(' ') || medication.medication_code || 'Chưa rõ thuốc';
}

function minutesFromNow(value) {
  if (!value) return null;
  const diff = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  return Number.isFinite(diff) ? diff : null;
}

function firstByAdministration(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const key = normalizeId(row.medication_administration_id);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function allergyRisk(admin, allergies = []) {
  const medication = admin.medication || {};
  const haystack = [
    medication.generic_name,
    medication.brand_name,
    medication.name,
    medication.medication_code,
  ].filter(Boolean).map((item) => String(item).toLowerCase());
  if (!haystack.length) return false;
  return allergies.some((allergy) => {
    const allergen = String(allergy.allergen || allergy.substance || allergy.name || '').toLowerCase();
    return allergen && haystack.some((name) => name.includes(allergen) || allergen.includes(name));
  });
}

function formatDispenseReadiness(admin, dispenseItem = null) {
  const linkedBatch = admin.stock_batch || dispenseItem?.stock_batch_id || null;
  const hasDirectLink = Boolean(admin.dispense_item_id || admin.dispense_id);
  if (!dispenseItem && !hasDirectLink) {
    return {
      status: 'not_dispensed',
      label: 'Chưa liên kết cấp phát',
      warning: true,
      dispense: null,
      dispense_item: null,
      stock_batch: linkedBatch,
    };
  }
  const dispense = dispenseItem?.dispense_id || null;
  const isDispensed = dispenseItem?.status === 'dispensed' || ['dispensed', 'partially_dispensed'].includes(dispense?.status);
  return {
    status: isDispensed ? 'dispensed' : (dispenseItem?.status || dispense?.status || 'linked'),
    label: isDispensed ? 'Đã cấp phát' : 'Đã liên kết cấp phát',
    warning: !isDispensed,
    dispense,
    dispense_item: dispenseItem,
    stock_batch: linkedBatch,
  };
}

function formatSafety(admin, wardRow = null, reactions = [], dispense = null) {
  const medication = admin.medication || {};
  const allergies = wardRow?.allergies || [];
  const latestReaction = reactions[0] || null;
  const highAlert = Boolean(medication.high_alert_medication || medication.requires_double_check);
  const controlledDrug = Boolean(medication.controlled_drug);
  const notDispensed = admin.status === ADMINISTRATION_STATUS.SCHEDULED && dispense?.status !== 'dispensed';
  const allergyAlert = allergyRisk(admin, allergies);
  const reactionCritical = ['severe', 'life_threatening'].includes(latestReaction?.severity);
  const critical = (admin.is_overdue && (highAlert || allergyAlert)) || reactionCritical;
  const high = admin.is_overdue || allergyAlert || notDispensed || highAlert || controlledDrug;
  return {
    high_alert: highAlert,
    controlled_drug: controlledDrug,
    double_check_required: Boolean(admin.double_check_required || medication.requires_double_check || medication.high_alert_medication),
    vital_before_required: Boolean(medication.requires_vital_before_admin),
    vital_after_required: Boolean(medication.requires_vital_after_admin),
    blood_glucose_required: Boolean(medication.requires_blood_glucose),
    pain_score_required: Boolean(medication.requires_pain_score),
    allergy_alert: allergyAlert,
    allergy_count: allergies.length,
    not_dispensed: notDispensed,
    reaction_critical: reactionCritical,
    priority: critical ? 'critical' : high ? 'high' : admin.is_due_now ? 'medium' : admin.status === ADMINISTRATION_STATUS.GIVEN ? 'success' : 'normal',
  };
}

function compactWardPatient(wardRow = null) {
  if (!wardRow) return {};
  return {
    room: wardRow.room || null,
    bed: wardRow.bed || null,
    department: wardRow.department || null,
    attending_doctor: wardRow.attending_doctor || null,
    latest_vitals: wardRow.latest_vitals || null,
    vital_alerts: wardRow.vital_alerts || [],
    allergies: wardRow.allergies || [],
    problems: wardRow.problems || [],
    high_risk: Boolean(wardRow.high_risk),
    allowed_actions: wardRow.allowed_actions || {},
  };
}

async function buildWardMap(query = {}, actor = {}) {
  try {
    const board = await inpatientWorkspaceService.getWardBoard({
      department_id: query.department_id,
      search: query.search,
      limit: query.ward_limit || 300,
    }, actor);
    return {
      board,
      byAdmission: new Map((board.items || []).map((row) => [normalizeId(row.admission_id || row.admission), row])),
    };
  } catch (error) {
    return { board: { summary: {}, items: [] }, byAdmission: new Map(), error: error.message };
  }
}

async function loadDispenseItems(admins = []) {
  const prescriptionItemIds = admins.map((item) => normalizeId(item.prescription_item_id)).filter(Boolean);
  const dispenseItemIds = admins.map((item) => normalizeId(item.dispense_item_id)).filter(Boolean);
  const clauses = [];
  if (prescriptionItemIds.length) clauses.push({ prescription_item_id: { $in: prescriptionItemIds.map((id) => toObjectId(id, 'prescription_item_id')) } });
  if (dispenseItemIds.length) clauses.push({ _id: { $in: dispenseItemIds.map((id) => toObjectId(id, 'dispense_item_id')) } });
  if (!clauses.length) return new Map();
  const rows = await DispenseItem.find({ $or: clauses, is_deleted: false })
    .sort({ created_at: -1 })
    .populate('dispense_id', 'dispense_no status workflow_stage dispensed_at completed_at priority')
    .populate('stock_batch_id', 'batch_no lot_no expiry_date status storage_location')
    .lean();
  const map = new Map();
  rows.forEach((row) => {
    const directKey = normalizeId(row._id);
    if (directKey) map.set(`dispense:${directKey}`, row);
    const itemKey = normalizeId(row.prescription_item_id);
    if (itemKey && !map.has(`prescription:${itemKey}`)) map.set(`prescription:${itemKey}`, row);
  });
  return map;
}

async function loadReactions(admins = []) {
  const adminIds = admins.map((item) => normalizeId(item)).filter(Boolean);
  if (!adminIds.length) return new Map();
  const rows = await MedicationReactionObservation.find({
    medication_administration_id: { $in: adminIds.map((id) => toObjectId(id, 'medication_administration_id')) },
  })
    .sort({ observed_at: -1 })
    .populate('observed_by', 'full_name username employee_code')
    .lean();
  return firstByAdministration(rows);
}

async function loadEvents(admins = []) {
  const adminIds = admins.map((item) => normalizeId(item)).filter(Boolean);
  if (!adminIds.length) return new Map();
  const rows = await MedicationAdministrationEvent.find({
    medication_administration_id: { $in: adminIds.map((id) => toObjectId(id, 'medication_administration_id')) },
  })
    .sort({ occurred_at: -1 })
    .populate('actor_id', 'full_name username employee_code')
    .lean();
  return firstByAdministration(rows);
}

async function loadInterventions(admins = []) {
  const adminIds = admins.map((item) => normalizeId(item)).filter(Boolean);
  if (!adminIds.length) return new Map();
  const rows = await MedicationIntervention.find({
    medication_administration_id: { $in: adminIds.map((id) => toObjectId(id, 'medication_administration_id')) },
    is_deleted: false,
  })
    .sort({ created_at: -1 })
    .populate('created_by reviewed_by_doctor', 'full_name username employee_code')
    .lean();
  return firstByAdministration(rows);
}

async function enrichAdministrations(admins = [], query = {}, actor = {}) {
  const [{ byAdmission, board }, dispenseMap, reactionMap, eventMap, interventionMap] = await Promise.all([
    buildWardMap(query, actor),
    loadDispenseItems(admins),
    loadReactions(admins),
    loadEvents(admins),
    loadInterventions(admins),
  ]);
  const enriched = admins.map((admin) => {
    const adminId = normalizeId(admin);
    const wardRow = byAdmission.get(normalizeId(admin.admission_id)) || null;
    const dispenseItem = dispenseMap.get(`dispense:${normalizeId(admin.dispense_item_id)}`)
      || dispenseMap.get(`prescription:${normalizeId(admin.prescription_item_id)}`)
      || null;
    const reactions = reactionMap.get(adminId) || [];
    const events = eventMap.get(adminId) || [];
    const interventions = interventionMap.get(adminId) || [];
    const dispensing = formatDispenseReadiness(admin, dispenseItem);
    const safety = formatSafety(admin, wardRow, reactions, dispensing);
    return {
      ...admin,
      medication_display: medicationDisplay(admin.medication),
      room_bed: wardRow?.room || wardRow?.bed ? [wardRow?.room?.room_code || wardRow?.room?.room_name, wardRow?.bed?.bed_code || wardRow?.bed?.bed_name].filter(Boolean).join(' / ') : null,
      patient_context: compactWardPatient(wardRow),
      dispensing,
      safety,
      latest_reaction: reactions[0] || null,
      reactions: reactions.slice(0, 5),
      audit_timeline: events.slice(0, 8),
      interventions,
    };
  });
  return { items: enriched, ward_board_summary: board.summary || {}, ward_board_warning: board.error };
}

async function listEnrichedAdministrations(query = {}, actor = {}) {
  const result = await inpatientWorkspaceService.listMedicationAdministrations({
    ...query,
    limit: query.limit || 200,
  }, actor);
  const enriched = await enrichAdministrations(result.items || [], query, actor);
  return {
    ...result,
    items: enriched.items,
    ward_board_summary: enriched.ward_board_summary,
  };
}

function buildSummary(items = []) {
  return {
    total_doses: items.length,
    scheduled: items.filter((item) => item.status === ADMINISTRATION_STATUS.SCHEDULED).length,
    due_now: items.filter((item) => item.is_due_now).length,
    overdue: items.filter((item) => item.is_overdue).length,
    given: items.filter((item) => item.status === ADMINISTRATION_STATUS.GIVEN).length,
    held: items.filter((item) => item.status === ADMINISTRATION_STATUS.HELD).length,
    refused: items.filter((item) => item.status === ADMINISTRATION_STATUS.REFUSED).length,
    omitted: items.filter((item) => item.status === ADMINISTRATION_STATUS.OMITTED).length,
    allergy_alerts: items.filter((item) => item.safety?.allergy_alert).length,
    high_alert_count: items.filter((item) => item.safety?.high_alert).length,
    not_dispensed_count: items.filter((item) => item.safety?.not_dispensed).length,
    double_check_required: items.filter((item) => item.safety?.double_check_required).length,
    reaction_count: items.filter((item) => item.latest_reaction).length,
    pharmacist_review_pending: items.filter((item) => item.requires_pharmacist_review && item.pharmacist_review_status !== 'reviewed').length,
  };
}

function buildAlerts(items = []) {
  return items
    .filter((item) => ['critical', 'high'].includes(item.safety?.priority))
    .slice(0, 40)
    .map((item) => ({
      administration_id: item.id,
      patient: item.patient,
      medication: item.medication_display,
      scheduled_at: item.scheduled_at,
      priority: item.safety.priority,
      reasons: [
        item.is_overdue ? 'Quá giờ dùng thuốc' : null,
        item.safety.high_alert ? 'Thuốc high-alert/double-check' : null,
        item.safety.allergy_alert ? 'Có nguy cơ dị ứng' : null,
        item.safety.not_dispensed ? 'Chưa liên kết cấp phát' : null,
        item.latest_reaction ? 'Có phản ứng thuốc' : null,
      ].filter(Boolean),
    }));
}

function buildTimeSlots(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const date = item.scheduled_at ? new Date(item.scheduled_at) : null;
    const key = date && !Number.isNaN(date.getTime())
      ? `${String(date.getHours()).padStart(2, '0')}:00`
      : 'Chưa giờ';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([time, administrations]) => ({ time, count: administrations.length, administrations }));
}

function buildPatients(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeId(item.admission_id) || normalizeId(item.patient_id);
    if (!key || map.has(key)) return;
    map.set(key, {
      admission_id: item.admission_id,
      patient: item.patient,
      room: item.patient_context?.room,
      bed: item.patient_context?.bed,
      department: item.patient_context?.department,
      high_risk: item.patient_context?.high_risk,
      allergies: item.patient_context?.allergies || [],
      latest_vitals: item.patient_context?.latest_vitals,
    });
  });
  return [...map.values()];
}

async function getScheduleBoard(query = {}, actor = {}) {
  const result = await listEnrichedAdministrations({
    ...query,
    date: query.date || new Date().toISOString(),
    limit: query.limit || 240,
  }, actor);
  return {
    summary: buildSummary(result.items),
    time_slots: buildTimeSlots(result.items),
    patients: buildPatients(result.items),
    administrations: result.items,
    alerts: buildAlerts(result.items),
    dispensing_readiness: result.items.map((item) => ({
      administration_id: item.id,
      medication: item.medication_display,
      status: item.dispensing?.status,
      label: item.dispensing?.label,
      stock_batch: item.dispensing?.stock_batch,
    })),
    pagination: result.pagination,
    generated_at: new Date().toISOString(),
  };
}

async function getTodayCommandCenter(query = {}, actor = {}) {
  const result = await listEnrichedAdministrations({
    ...query,
    date: query.date || new Date().toISOString(),
    limit: query.limit || 260,
  }, actor);
  const items = result.items;
  return {
    summary: buildSummary(items),
    overdue: items.filter((item) => item.is_overdue),
    due_now: items.filter((item) => item.is_due_now),
    due_next_2h: items.filter((item) => item.status === ADMINISTRATION_STATUS.SCHEDULED && item.due_minutes > 60 && item.due_minutes <= 120),
    high_alert: items.filter((item) => item.safety?.high_alert),
    allergy_risk: items.filter((item) => item.safety?.allergy_alert),
    not_dispensed: items.filter((item) => item.safety?.not_dispensed),
    held: items.filter((item) => item.status === ADMINISTRATION_STATUS.HELD),
    refused: items.filter((item) => item.status === ADMINISTRATION_STATUS.REFUSED),
    omitted: items.filter((item) => item.status === ADMINISTRATION_STATUS.OMITTED),
    done: items.filter((item) => item.status === ADMINISTRATION_STATUS.GIVEN),
    items,
    alerts: buildAlerts(items),
    generated_at: new Date().toISOString(),
  };
}

function buildSafetyChecklist(item = null) {
  if (!item) return [];
  const scanPassed = item.scan_result === 'pass' || item.scan_result === 'warning';
  return [
    { code: 'right_patient', label: 'Đúng bệnh nhân', status: item.verified_patient_scan_at ? 'pass' : 'pending' },
    { code: 'right_admission', label: 'Đúng admission', status: scanPassed ? 'pass' : 'pending' },
    { code: 'right_medication', label: 'Đúng thuốc', status: item.verified_medication_scan_at ? 'pass' : 'pending' },
    { code: 'right_dose', label: 'Đúng liều', status: item.dose ? 'pass' : 'warning' },
    { code: 'right_route', label: 'Đúng đường dùng', status: item.route ? 'pass' : 'warning' },
    { code: 'right_time', label: 'Đúng thời điểm', status: item.is_overdue ? 'warning' : 'pass' },
    { code: 'right_batch', label: 'Đúng lô thuốc', status: item.stock_batch_id || item.batch_no_snapshot ? 'pass' : 'pending' },
    { code: 'expiry_valid', label: 'Lô chưa hết hạn', status: item.stock_batch?.status === 'expired' ? 'fail' : 'pass' },
    { code: 'not_recalled', label: 'Lô không recall/cách ly', status: ['recalled', 'quarantined'].includes(item.stock_batch?.status) ? 'fail' : 'pass' },
    { code: 'allergy_safe', label: 'Không có dị ứng nghiêm trọng', status: item.safety?.allergy_alert ? 'fail' : 'pass' },
    { code: 'vital_ready', label: 'Đủ điều kiện sinh hiệu', status: item.safety?.vital_before_required && !item.patient_context?.latest_vitals ? 'warning' : 'pass' },
    { code: 'double_check', label: 'Double-check nếu cần', status: item.safety?.double_check_required && !item.double_checked_at ? 'warning' : 'pass' },
  ];
}

async function getConfirmWorkbench(query = {}, actor = {}) {
  let selected = null;
  if (query.administration_id) {
    selected = await inpatientWorkspaceService.getMedicationAdministrationDetail(query.administration_id, actor);
    selected = (await enrichAdministrations([selected], query, actor)).items[0];
  } else {
    const today = await getTodayCommandCenter(query, actor);
    selected = today.overdue[0] || today.due_now[0] || today.high_alert[0] || today.not_dispensed[0] || today.items[0] || null;
  }
  return {
    selected,
    checklist: buildSafetyChecklist(selected),
    scan_requirements: {
      patient_scan: true,
      medication_scan: true,
      stock_batch_scan: Boolean(selected?.stock_batch_id || selected?.dispensing?.stock_batch),
      double_check: Boolean(selected?.safety?.double_check_required),
    },
    generated_at: new Date().toISOString(),
  };
}

async function getExceptionCenter(query = {}, actor = {}) {
  const status = query.status || 'held,refused,omitted,entered_in_error';
  const result = await listEnrichedAdministrations({
    ...query,
    status,
    limit: query.limit || 220,
  }, actor);
  return {
    summary: buildSummary(result.items),
    items: result.items,
    needs_doctor_review: result.items.filter((item) => item.requires_doctor_review),
    needs_pharmacist_review: result.items.filter((item) => item.requires_pharmacist_review && item.pharmacist_review_status !== 'reviewed'),
    unresolved: result.items.filter((item) => !item.resolved_at),
    pagination: result.pagination,
    generated_at: new Date().toISOString(),
  };
}

function reactionFilter(query = {}) {
  const filter = {};
  if (query.reaction_id) filter._id = toObjectId(query.reaction_id, 'reaction_id');
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.admission_id) filter.admission_id = toObjectId(query.admission_id, 'admission_id');
  if (query.medication_administration_id) filter.medication_administration_id = toObjectId(query.medication_administration_id, 'medication_administration_id');
  const severities = csv(query.severity);
  if (severities.length) filter.severity = { $in: severities };
  const statuses = csv(query.status);
  if (statuses.length) filter.status = { $in: statuses };
  if (query.suspected_allergy !== undefined) filter.suspected_allergy = ['true', true, '1', 1].includes(query.suspected_allergy);
  if (query.date) {
    const { start, end } = dateWindow(query.date);
    filter.observed_at = { $gte: start, $lte: end };
  } else {
    if (query.date_from) filter.observed_at = { ...(filter.observed_at || {}), $gte: parseDate(query.date_from, 'date_from') };
    if (query.date_to) filter.observed_at = { ...(filter.observed_at || {}), $lte: parseDate(query.date_to, 'date_to') };
  }
  return filter;
}

function formatReaction(row = {}) {
  const administration = row.medication_administration_id && typeof row.medication_administration_id === 'object'
    ? row.medication_administration_id
    : null;
  const patient = row.patient_id && typeof row.patient_id === 'object' ? row.patient_id : administration?.patient_id;
  const medication = row.suspected_medication_id && typeof row.suspected_medication_id === 'object'
    ? row.suspected_medication_id
    : administration?.medication_id;
  return {
    reaction_id: normalizeId(row),
    id: normalizeId(row),
    medication_administration_id: normalizeId(administration || row.medication_administration_id),
    patient_id: normalizeId(patient || row.patient_id),
    patient: patient && typeof patient === 'object' ? {
      patient_id: normalizeId(patient),
      patient_code: patient.patient_code,
      full_name: patient.full_name || patient.patient_name,
      gender: patient.gender,
      date_of_birth: patient.date_of_birth,
    } : null,
    admission_id: normalizeId(row.admission_id || administration?.admission_id),
    encounter_id: normalizeId(row.encounter_id || administration?.encounter_id),
    medication_id: normalizeId(medication || row.suspected_medication_id),
    medication,
    medication_display: medicationDisplay(medication),
    administration: administration ? {
      scheduled_at: administration.scheduled_at,
      administered_at: administration.administered_at,
      dose: administration.dose,
      route: administration.route,
      status: administration.status,
    } : null,
    observed_by: row.observed_by,
    observed_at: row.observed_at,
    symptoms: row.symptoms || [],
    onset_at: row.onset_at,
    severity: row.severity,
    suspected_allergy: Boolean(row.suspected_allergy),
    vital_sign: row.vital_sign_id,
    intervention_note: row.intervention_note,
    medication_stopped: Boolean(row.medication_stopped),
    allergy_created_id: normalizeId(row.allergy_created_id),
    doctor_notification_request_id: normalizeId(row.doctor_notification_request_id),
    emergency_case_id: normalizeId(row.emergency_case_id),
    status: row.status,
    metadata: row.metadata || {},
    priority: row.severity === 'life_threatening' ? 'critical' : row.severity === 'severe' ? 'high' : row.severity === 'moderate' ? 'medium' : 'normal',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function reactionSummary(items = []) {
  return {
    total: items.length,
    today: items.filter((item) => {
      const { start, end } = dateWindow(new Date());
      const observed = item.observed_at ? new Date(item.observed_at) : null;
      return observed && observed >= start && observed <= end;
    }).length,
    suspected_allergy: items.filter((item) => item.suspected_allergy).length,
    severe: items.filter((item) => ['severe', 'life_threatening'].includes(item.severity)).length,
    doctor_notified: items.filter((item) => item.doctor_notification_request_id || item.status === 'doctor_notified').length,
    allergy_created: items.filter((item) => item.allergy_created_id || item.status === 'allergy_recorded').length,
    unresolved: items.filter((item) => !['resolved'].includes(item.status)).length,
  };
}

async function listMedicationReactions(query = {}, actor = {}) {
  await inpatientWorkspaceService.listMedicationAdministrations({ limit: 1 }, actor);
  const { page, limit, skip } = getPagination({ ...query, limit: query.limit || 80 }, 80, 200);
  const filter = reactionFilter(query);
  if (query.department_id && !filter.admission_id) {
    const admissions = await Admission.find({ department_id: toObjectId(query.department_id, 'department_id') }).select('_id').lean();
    filter.admission_id = { $in: admissions.map((item) => item._id) };
  }
  const keyword = normalizeString(query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { symptoms: { $elemMatch: { $regex: pattern, $options: 'i' } } },
      { intervention_note: { $regex: pattern, $options: 'i' } },
    ];
  }
  const [rows, total] = await Promise.all([
    MedicationReactionObservation.find(filter)
      .sort({ observed_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'medication_administration_id',
        select: 'patient_id admission_id encounter_id medication_id scheduled_at administered_at dose route status',
        populate: [
          { path: 'patient_id', select: 'patient_code full_name gender date_of_birth' },
          { path: 'medication_id', select: 'medication_code generic_name brand_name strength dosage_form route_default high_alert_medication' },
        ],
      })
      .populate('patient_id', 'patient_code full_name gender date_of_birth')
      .populate('suspected_medication_id', 'medication_code generic_name brand_name strength dosage_form route_default high_alert_medication')
      .populate('observed_by', 'full_name username employee_code')
      .populate('vital_sign_id', 'recorded_at temperature heart_rate respiratory_rate systolic_bp diastolic_bp spo2 pain_score overall_severity')
      .lean(),
    MedicationReactionObservation.countDocuments(filter),
  ]);
  const items = rows.map(formatReaction);
  return {
    items,
    summary: reactionSummary(items),
    pagination: buildPagination(page, limit, total),
  };
}

async function getMedicationReactionDetail(reactionId, actor = {}) {
  const result = await listMedicationReactions({ reaction_id: reactionId, limit: 1 }, actor);
  let item = result.items.find((row) => row.id === normalizeId(reactionId));
  if (!item) {
    const row = await MedicationReactionObservation.findById(reactionId)
      .populate({
        path: 'medication_administration_id',
        select: 'patient_id admission_id encounter_id medication_id scheduled_at administered_at dose route status',
        populate: [
          { path: 'patient_id', select: 'patient_code full_name gender date_of_birth' },
          { path: 'medication_id', select: 'medication_code generic_name brand_name strength dosage_form route_default high_alert_medication' },
        ],
      })
      .populate('patient_id', 'patient_code full_name gender date_of_birth')
      .populate('suspected_medication_id', 'medication_code generic_name brand_name strength dosage_form route_default high_alert_medication')
      .populate('observed_by', 'full_name username employee_code')
      .populate('vital_sign_id', 'recorded_at temperature heart_rate respiratory_rate systolic_bp diastolic_bp spo2 pain_score overall_severity')
      .lean();
    if (!row) throw createError('Không tìm thấy phản ứng thuốc.', 404);
    item = formatReaction(row);
  }
  const events = item.medication_administration_id
    ? await MedicationAdministrationEvent.find({ medication_administration_id: toObjectId(item.medication_administration_id, 'medication_administration_id') })
      .sort({ occurred_at: -1 })
      .limit(30)
      .populate('actor_id', 'full_name username employee_code')
      .lean()
    : [];
  return { ...item, audit_timeline: events };
}

async function updateReactionReview(reactionId, payload = {}, actor = {}, requestMeta = {}) {
  await inpatientWorkspaceService.listMedicationAdministrations({ limit: 1 }, actor);
  const reaction = await MedicationReactionObservation.findById(reactionId);
  if (!reaction) throw createError('Không tìm thấy phản ứng thuốc.', 404);
  reaction.metadata = {
    ...(reaction.metadata || {}),
    pharmacist_review: {
      status: payload.status || 'reviewed',
      note: payload.note,
      reviewed_by: actorUserId(actor),
      reviewed_at: new Date(),
      recommendation: payload.recommendation,
    },
  };
  if (payload.status === 'resolved') reaction.status = 'resolved';
  reaction.updated_by = actorUserId(actor);
  await reaction.save();
  await MedicationAdministrationEvent.create({
    medication_administration_id: reaction.medication_administration_id,
    event_type: 'pharmacist_reviewed',
    actor_id: actorUserId(actor),
    actor_role: (actor.roles || actor.roleCodes || [])[0],
    note: payload.note || payload.recommendation,
    metadata: { medication_reaction_observation_id: reaction._id, status: payload.status || 'reviewed' },
  });
  await recordAuditLog({
    actor,
    action: 'medication_reaction.pharmacist_review',
    targetType: 'medication_reaction_observation',
    targetId: reaction._id,
    status: 'success',
    message: 'Dược sĩ review phản ứng thuốc.',
    requestMeta,
  });
  return getMedicationReactionDetail(reaction._id, actor);
}

async function resolveReaction(reactionId, payload = {}, actor = {}, requestMeta = {}) {
  await inpatientWorkspaceService.listMedicationAdministrations({ limit: 1 }, actor);
  const reaction = await MedicationReactionObservation.findById(reactionId);
  if (!reaction) throw createError('Không tìm thấy phản ứng thuốc.', 404);
  reaction.status = 'resolved';
  reaction.metadata = {
    ...(reaction.metadata || {}),
    resolution: {
      note: payload.note,
      resolved_by: actorUserId(actor),
      resolved_at: new Date(),
    },
  };
  reaction.updated_by = actorUserId(actor);
  await reaction.save();
  await MedicationAdministrationEvent.create({
    medication_administration_id: reaction.medication_administration_id,
    event_type: 'resolved',
    actor_id: actorUserId(actor),
    actor_role: (actor.roles || actor.roleCodes || [])[0],
    note: payload.note,
    metadata: { medication_reaction_observation_id: reaction._id },
  });
  await recordAuditLog({
    actor,
    action: 'medication_reaction.resolve',
    targetType: 'medication_reaction_observation',
    targetId: reaction._id,
    status: 'success',
    message: 'Đóng case phản ứng thuốc.',
    requestMeta,
  });
  return getMedicationReactionDetail(reaction._id, actor);
}

async function createMedicationIntervention(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.patient_id) throw createError('patient_id là bắt buộc.', 400);
  if (!payload.intervention_type) throw createError('intervention_type là bắt buộc.', 400);
  if (!payload.recommendation) throw createError('recommendation là bắt buộc.', 400);
  const intervention = await MedicationIntervention.create({
    patient_id: toObjectId(payload.patient_id, 'patient_id'),
    admission_id: payload.admission_id ? toObjectId(payload.admission_id, 'admission_id') : undefined,
    prescription_id: payload.prescription_id ? toObjectId(payload.prescription_id, 'prescription_id') : undefined,
    prescription_item_id: payload.prescription_item_id ? toObjectId(payload.prescription_item_id, 'prescription_item_id') : undefined,
    medication_administration_id: payload.medication_administration_id ? toObjectId(payload.medication_administration_id, 'medication_administration_id') : undefined,
    intervention_type: payload.intervention_type,
    severity: payload.severity || 'medium',
    recommendation: safeText(payload.recommendation),
    status: payload.status || 'open',
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  if (intervention.medication_administration_id) {
    await MedicationAdministrationEvent.create({
      medication_administration_id: intervention.medication_administration_id,
      event_type: 'pharmacist_reviewed',
      actor_id: actorUserId(actor),
      actor_role: (actor.roles || actor.roleCodes || [])[0],
      note: intervention.recommendation,
      metadata: { medication_intervention_id: intervention._id, intervention_type: intervention.intervention_type },
    });
  }
  await recordAuditLog({
    actor,
    action: 'medication_intervention.create',
    targetType: 'medication_intervention',
    targetId: intervention._id,
    status: 'success',
    message: 'Tạo can thiệp dược nội trú.',
    requestMeta,
  });
  return intervention.toObject();
}

module.exports = {
  listEnrichedAdministrations,
  getScheduleBoard,
  getTodayCommandCenter,
  getConfirmWorkbench,
  getExceptionCenter,
  listMedicationReactions,
  getMedicationReactionDetail,
  updateReactionReview,
  resolveReaction,
  createMedicationIntervention,
};
