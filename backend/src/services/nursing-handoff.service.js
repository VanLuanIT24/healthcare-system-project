const { Types } = require('mongoose');
const {
  Admission,
  Allergy,
  BedAssignment,
  ClinicalNote,
  MedicationAdministration,
  NursingHandoff,
  NursingTask,
  Order,
  Patient,
  ProblemList,
  VitalSign,
} = require('../models');
const {
  ADMISSION_STATUS,
  ADMINISTRATION_STATUS,
  BED_ASSIGNMENT_STATUS,
  ORDER_STATUS,
} = require('../constants/statuses');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const realtimeService = require('../realtime/realtime.service');

const ACTIVE_ADMISSION_STATUSES = [ADMISSION_STATUS.PLANNED, ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED];
const OPEN_TASK_STATUSES = ['draft', 'assigned', 'accepted', 'todo', 'in_progress', 'blocked', 'waiting_doctor', 'overdue'];
const OPEN_ORDER_STATUSES = [ORDER_STATUS.ORDERED, ORDER_STATUS.ACKNOWLEDGED, ORDER_STATUS.IN_PROGRESS].filter(Boolean);

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function normalizeId(value) {
  if (!value) return null;
  const id = value._id || value.id || value;
  return typeof id.toString === 'function' ? id.toString() : String(id);
}

function sameId(left, right) {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(String(value))) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(String(value));
}

function parseDate(value, fieldName = 'date') {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function dayWindow(value) {
  const date = parseDate(value || new Date(), 'shift_date');
  return { date, start: getStartOfDay(date), end: getEndOfDay(date) };
}

function patientName(patient = {}) {
  return patient?.full_name || patient?.patient_name || 'Bệnh nhân';
}

function vitalSnapshot(vital = {}) {
  if (!vital) return null;
  return {
    vital_sign_id: normalizeId(vital),
    recorded_at: vital.recorded_at || vital.created_at,
    systolic_bp: vital.systolic_bp ?? null,
    diastolic_bp: vital.diastolic_bp ?? null,
    heart_rate: vital.heart_rate ?? null,
    temperature: vital.temperature ?? null,
    spo2: vital.spo2 ?? null,
    respiratory_rate: vital.respiratory_rate ?? null,
    pain_score: vital.pain_score ?? null,
    severity: vital.overall_severity || vital.severity || 'normal',
    abnormal_flags: vital.abnormal_flags || [],
  };
}

function groupByPatient(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeId(item.patient_id);
    if (!key) return;
    map.set(key, [...(map.get(key) || []), item]);
  });
  return map;
}

async function latestVitalsByPatient(patientIds = []) {
  const ids = [...new Set(patientIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const vitals = await VitalSign.find({ patient_id: { $in: ids.map((id) => toObjectId(id, 'patient_id')) } })
    .sort({ recorded_at: -1, created_at: -1 })
    .lean();
  const map = new Map();
  vitals.forEach((vital) => {
    const patientId = normalizeId(vital.patient_id);
    if (!map.has(patientId)) map.set(patientId, vital);
  });
  return map;
}

function buildFilter(query = {}, actor = {}, mode = 'list') {
  const filter = {};
  const departmentId = query.department_id || actorDepartmentId(actor);
  if (departmentId) filter.department_id = toObjectId(departmentId, 'department_id');
  if (query.status) filter.status = query.status;
  if (query.from_shift) filter.from_shift = query.from_shift;
  if (query.to_shift) filter.to_shift = query.to_shift;
  if (query.from_user_id) filter.from_user_id = toObjectId(query.from_user_id, 'from_user_id');
  if (query.to_user_id) filter.to_user_id = toObjectId(query.to_user_id, 'to_user_id');
  if (query.shift_date || query.date || mode === 'active') {
    const { start, end } = dayWindow(query.shift_date || query.date || new Date());
    filter.shift_date = { $gte: start, $lte: end };
  }
  if (mode === 'active') filter.status = { $in: ['draft', 'submitted', 'reopened'] };
  if (mode === 'history') filter.status = query.status || { $in: ['accepted', 'rejected', 'archived', 'reopened', 'submitted'] };
  return filter;
}

function populateHandoffQuery(query) {
  return query
    .populate('department_id', 'department_name department_code')
    .populate('from_user_id', 'full_name employee_code username')
    .populate('to_user_id', 'full_name employee_code username')
    .populate('accepted_by', 'full_name employee_code username')
    .populate('patient_items.patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('patient_items.bed_id', 'bed_label bed_number name')
    .populate('patient_items.pending_task_ids', 'task_code title task_type priority status due_at')
    .populate('patient_items.overdue_task_ids', 'task_code title task_type priority status due_at')
    .populate('task_ids', 'task_code title patient_id priority status due_at');
}

function handoffDto(handoff = {}) {
  const patientItems = (handoff.patient_items || []).map((item) => ({
    item_id: normalizeId(item),
    patient_id: normalizeId(item.patient_id),
    patient: item.patient_id && typeof item.patient_id === 'object' ? {
      patient_id: normalizeId(item.patient_id),
      patient_code: item.patient_id.patient_code,
      full_name: item.patient_id.full_name,
      gender: item.patient_id.gender,
      date_of_birth: item.patient_id.date_of_birth,
    } : null,
    encounter_id: normalizeId(item.encounter_id),
    admission_id: normalizeId(item.admission_id),
    bed_id: normalizeId(item.bed_id),
    bed_label: item.bed_id?.bed_label || item.bed_id?.bed_number || item.bed_id?.name || null,
    situation: item.situation || '',
    background: item.background || '',
    assessment: item.assessment || '',
    recommendation: item.recommendation || '',
    acuity_level: item.acuity_level || 'medium',
    flags: item.flags || {},
    latest_vitals_snapshot: item.latest_vitals_snapshot || null,
    active_problems_snapshot: item.active_problems_snapshot || [],
    allergies_snapshot: item.allergies_snapshot || [],
    pending_task_ids: item.pending_task_ids || [],
    overdue_task_ids: item.overdue_task_ids || [],
    pending_medication_ids: item.pending_medication_ids || [],
    pending_order_ids: item.pending_order_ids || [],
    receiver_acknowledged: Boolean(item.receiver_acknowledged),
    acknowledged_at: item.acknowledged_at || null,
    acknowledged_by: normalizeId(item.acknowledged_by),
    note: item.note || '',
  }));
  return {
    handoff_id: normalizeId(handoff),
    id: normalizeId(handoff),
    handoff_code: handoff.handoff_code,
    department_id: normalizeId(handoff.department_id),
    department_name: handoff.department_id?.department_name || null,
    ward_id: normalizeId(handoff.ward_id),
    shift_date: handoff.shift_date,
    from_shift: handoff.from_shift,
    to_shift: handoff.to_shift,
    from_user_id: normalizeId(handoff.from_user_id),
    from_user_name: handoff.from_user_id?.full_name || null,
    to_user_id: normalizeId(handoff.to_user_id),
    to_user_name: handoff.to_user_id?.full_name || null,
    to_team_role: handoff.to_team_role || null,
    status: handoff.status,
    summary: handoff.summary || '',
    risk_summary: handoff.risk_summary || '',
    patient_items: patientItems,
    task_ids: handoff.task_ids || [],
    submitted_at: handoff.submitted_at || null,
    accepted_at: handoff.accepted_at || null,
    accepted_by: normalizeId(handoff.accepted_by),
    rejected_at: handoff.rejected_at || null,
    rejected_by: normalizeId(handoff.rejected_by),
    rejection_reason: handoff.rejection_reason || null,
    metadata: handoff.metadata || {},
    created_at: handoff.created_at,
    updated_at: handoff.updated_at,
    summary_counts: {
      patients: patientItems.length,
      high_risk: patientItems.filter((item) => ['high', 'critical'].includes(item.acuity_level)).length,
      pending_tasks: patientItems.reduce((sum, item) => sum + (item.pending_task_ids?.length || 0), 0),
      overdue_tasks: patientItems.reduce((sum, item) => sum + (item.overdue_task_ids?.length || 0), 0),
      pending_medications: patientItems.reduce((sum, item) => sum + (item.pending_medication_ids?.length || 0), 0),
      abnormal_vitals: patientItems.filter((item) => item.flags?.critical_vitals).length,
      doctor_report_needed: patientItems.filter((item) => item.flags?.doctor_report_needed).length,
      unacknowledged: patientItems.filter((item) => !item.receiver_acknowledged).length,
    },
  };
}

async function listHandoffs(query = {}, actor = {}, mode = 'list') {
  const filter = buildFilter(query, actor, mode);
  const { page, limit, skip } = getPagination(query, 20, 100);
  const [items, total] = await Promise.all([
    populateHandoffQuery(NursingHandoff.find(filter)).sort({ shift_date: -1, submitted_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    NursingHandoff.countDocuments(filter),
  ]);
  return {
    items: items.map(handoffDto),
    summary: summarizeHandoffs(items.map(handoffDto)),
    pagination: buildPagination(page, limit, total),
  };
}

function summarizeHandoffs(items = []) {
  return {
    total: items.length,
    draft: items.filter((item) => item.status === 'draft').length,
    submitted: items.filter((item) => item.status === 'submitted').length,
    accepted: items.filter((item) => item.status === 'accepted').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    high_risk: items.reduce((sum, item) => sum + item.summary_counts.high_risk, 0),
    overdue_tasks: items.reduce((sum, item) => sum + item.summary_counts.overdue_tasks, 0),
  };
}

async function getHandoff(handoffId) {
  const handoff = await populateHandoffQuery(NursingHandoff.findById(handoffId)).lean();
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  return handoffDto(handoff);
}

async function createHandoff(payload = {}, actor = {}, requestMeta = {}) {
  const departmentId = payload.department_id || actorDepartmentId(actor);
  if (!departmentId) throw createError('department_id là bắt buộc.', 400);
  if (!payload.from_shift || !payload.to_shift) throw createError('from_shift và to_shift là bắt buộc.', 400);
  const shiftDate = parseDate(payload.shift_date || payload.date || new Date(), 'shift_date');
  const handoff = await NursingHandoff.create({
    handoff_code: payload.handoff_code || await generateBusinessCode(CODE_TYPE.NURSING_HANDOFF, { date: shiftDate, sequenceLength: 4 }),
    department_id: toObjectId(departmentId, 'department_id'),
    ward_id: payload.ward_id ? toObjectId(payload.ward_id, 'ward_id') : undefined,
    shift_date: getStartOfDay(shiftDate),
    from_shift: payload.from_shift,
    to_shift: payload.to_shift,
    from_user_id: toObjectId(payload.from_user_id || actorUserId(actor), 'from_user_id'),
    to_user_id: payload.to_user_id ? toObjectId(payload.to_user_id, 'to_user_id') : undefined,
    to_team_role: payload.to_team_role,
    status: payload.status || 'draft',
    summary: payload.summary,
    risk_summary: payload.risk_summary,
    patient_items: payload.patient_items || [],
    task_ids: payload.task_ids || [],
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'nursing_handoff.created', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Tạo bàn giao ca.', requestMeta });
  await emitHandoffEvent('nursing_handoff.created', handoff);
  return getHandoff(handoff._id);
}

async function generateDraft(payload = {}, actor = {}, requestMeta = {}) {
  const departmentId = payload.department_id || actorDepartmentId(actor);
  if (!departmentId) throw createError('department_id là bắt buộc.', 400);
  const shiftDate = parseDate(payload.shift_date || payload.date || new Date(), 'shift_date');
  const admissions = await Admission.find({
    department_id: toObjectId(departmentId, 'department_id'),
    status: { $in: ACTIVE_ADMISSION_STATUSES },
  })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('attending_doctor_id', 'full_name employee_code')
    .lean();
  const admissionIds = admissions.map((item) => normalizeId(item));
  const patientIds = admissions.map((item) => normalizeId(item.patient_id)).filter(Boolean);
  const [
    beds,
    tasks,
    latestVitals,
    allergies,
    problems,
    meds,
    orders,
    notes,
  ] = await Promise.all([
    BedAssignment.find({ admission_id: { $in: admissionIds.map((id) => toObjectId(id, 'admission_id')) }, status: BED_ASSIGNMENT_STATUS.ACTIVE })
      .populate('bed_id', 'bed_label bed_number name')
      .lean(),
    NursingTask.find({ department_id: toObjectId(departmentId, 'department_id'), patient_id: { $in: patientIds.map((id) => toObjectId(id, 'patient_id')) }, status: { $in: OPEN_TASK_STATUSES } }).lean(),
    latestVitalsByPatient(patientIds),
    Allergy.find({ patient_id: { $in: patientIds.map((id) => toObjectId(id, 'patient_id')) }, status: 'active' }).lean(),
    ProblemList.find({ patient_id: { $in: patientIds.map((id) => toObjectId(id, 'patient_id')) }, status: 'active' }).lean(),
    MedicationAdministration.find({ patient_id: { $in: patientIds.map((id) => toObjectId(id, 'patient_id')) }, status: ADMINISTRATION_STATUS.SCHEDULED }).lean(),
    Order.find({ patient_id: { $in: patientIds.map((id) => toObjectId(id, 'patient_id')) }, status: { $in: OPEN_ORDER_STATUSES } }).lean().catch(() => []),
    ClinicalNote.find({ encounter_id: { $in: admissions.map((item) => item.encounter_id).filter(Boolean) } }).sort({ created_at: -1 }).limit(50).lean(),
  ]);
  const bedByAdmission = new Map(beds.map((item) => [normalizeId(item.admission_id), item]));
  const tasksByPatient = groupByPatient(tasks);
  const allergiesByPatient = groupByPatient(allergies);
  const problemsByPatient = groupByPatient(problems);
  const medsByPatient = groupByPatient(meds);
  const ordersByPatient = groupByPatient(orders);
  const notesByEncounter = new Map();
  notes.forEach((note) => {
    const key = normalizeId(note.encounter_id);
    if (key && !notesByEncounter.has(key)) notesByEncounter.set(key, note);
  });

  const patientItems = admissions.map((admission) => {
    const patientId = normalizeId(admission.patient_id);
    const patientTasks = tasksByPatient.get(patientId) || [];
    const pendingTasks = patientTasks.filter((task) => !task.due_at || new Date(task.due_at).getTime() >= Date.now());
    const overdueTasks = patientTasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now());
    const vital = latestVitals.get(patientId);
    const patientAllergies = allergiesByPatient.get(patientId) || [];
    const patientProblems = problemsByPatient.get(patientId) || [];
    const patientMeds = medsByPatient.get(patientId) || [];
    const patientOrders = ordersByPatient.get(patientId) || [];
    const latestNote = notesByEncounter.get(normalizeId(admission.encounter_id));
    const bed = bedByAdmission.get(normalizeId(admission));
    const criticalVitals = ['high', 'critical'].includes(vital?.overall_severity || vital?.severity);
    const medicationAttention = patientMeds.length > 0;
    const doctorReportNeeded = patientTasks.some((task) => task.task_type === 'doctor_report' || task.escalation_level > 0);
    const acuity = criticalVitals || overdueTasks.length > 1 ? 'critical' : overdueTasks.length || patientAllergies.length || medicationAttention ? 'high' : patientTasks.length > 3 ? 'medium' : 'low';
    return {
      patient_id: admission.patient_id?._id || admission.patient_id,
      encounter_id: admission.encounter_id,
      admission_id: admission._id,
      bed_id: bed?.bed_id?._id || bed?.bed_id,
      situation: latestNote?.content || `Bệnh nhân ${patientName(admission.patient_id)} đang được theo dõi trong ca.`,
      background: admission.reason || 'Đang điều trị nội trú.',
      assessment: vital ? `Sinh hiệu gần nhất: HA ${vital.systolic_bp || '--'}/${vital.diastolic_bp || '--'}, Mạch ${vital.heart_rate || '--'}, SpO2 ${vital.spo2 || '--'}%, nhiệt ${vital.temperature || '--'}°C.` : 'Chưa có sinh hiệu mới trong hệ thống.',
      recommendation: pendingTasks.length ? `Ca sau cần tiếp tục ${pendingTasks.length} task pending, trong đó ${overdueTasks.length} task quá hạn.` : 'Tiếp tục theo dõi thường quy.',
      acuity_level: acuity,
      flags: {
        allergy: patientAllergies.length > 0,
        fall_risk: false,
        isolation: false,
        critical_vitals: criticalVitals,
        post_procedure: patientTasks.some((task) => task.task_type === 'post_procedure_monitor'),
        medication_attention: medicationAttention,
        doctor_report_needed: doctorReportNeeded,
      },
      latest_vitals_snapshot: vitalSnapshot(vital),
      active_problems_snapshot: patientProblems.map((item) => ({ problem_name: item.problem_name, severity: item.severity })),
      allergies_snapshot: patientAllergies.map((item) => ({ allergen: item.allergen, reaction: item.reaction, severity: item.severity })),
      pending_task_ids: pendingTasks.map((task) => task._id),
      overdue_task_ids: overdueTasks.map((task) => task._id),
      pending_medication_ids: patientMeds.map((item) => item._id),
      pending_order_ids: patientOrders.map((item) => item._id),
    };
  });
  const taskIds = [...new Set(tasks.map((task) => normalizeId(task)))].map((id) => toObjectId(id, 'task_id'));
  return createHandoff({
    department_id: departmentId,
    shift_date: shiftDate,
    from_shift: payload.from_shift || 'morning',
    to_shift: payload.to_shift || 'afternoon',
    from_user_id: payload.from_user_id || actorUserId(actor),
    to_user_id: payload.to_user_id,
    to_team_role: payload.to_team_role || 'nurse',
    summary: `Bàn giao tự động ${patientItems.length} bệnh nhân, ${taskIds.length} task pending.`,
    risk_summary: buildRiskSummary(patientItems),
    patient_items: patientItems,
    task_ids: taskIds,
    metadata: { generated: true, generated_at: new Date(), source: 'active_admissions' },
  }, actor, requestMeta);
}

function buildRiskSummary(patientItems = []) {
  const critical = patientItems.filter((item) => item.acuity_level === 'critical').length;
  const high = patientItems.filter((item) => item.acuity_level === 'high').length;
  const overdue = patientItems.reduce((sum, item) => sum + item.overdue_task_ids.length, 0);
  const meds = patientItems.reduce((sum, item) => sum + item.pending_medication_ids.length, 0);
  return `Nguy cơ: ${critical} critical, ${high} high, ${overdue} task quá hạn, ${meds} thuốc cần chú ý.`;
}

async function emitHandoffEvent(event, handoff, extra = {}) {
  return realtimeService.emitToScope(event, {
    handoff_id: normalizeId(handoff),
    handoff_code: handoff.handoff_code,
    department_id: normalizeId(handoff.department_id),
    status: handoff.status,
    from_shift: handoff.from_shift,
    to_shift: handoff.to_shift,
    ...extra,
  }, {
    user_id: normalizeId(handoff.to_user_id),
    department_id: normalizeId(handoff.department_id),
    role: handoff.to_team_role || 'nurse',
  });
}

async function updateHandoff(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  const handoff = await NursingHandoff.findById(handoffId);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  ['summary', 'risk_summary', 'to_team_role', 'status'].forEach((field) => {
    if (payload[field] !== undefined) handoff[field] = payload[field];
  });
  if (payload.to_user_id !== undefined) handoff.to_user_id = payload.to_user_id ? toObjectId(payload.to_user_id, 'to_user_id') : undefined;
  if (payload.patient_items) handoff.patient_items = payload.patient_items;
  if (payload.task_ids) handoff.task_ids = payload.task_ids;
  handoff.metadata = { ...(handoff.metadata || {}), ...(payload.metadata || {}) };
  handoff.updated_by = actorUserId(actor);
  await handoff.save();
  await recordAuditLog({ actor, action: 'nursing_handoff.updated', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Cập nhật bàn giao ca.', requestMeta });
  await emitHandoffEvent('nursing_handoff.updated', handoff);
  return getHandoff(handoff._id);
}

async function addPatient(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.patient_id) throw createError('patient_id là bắt buộc.', 400);
  const handoff = await NursingHandoff.findById(handoffId);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  if (handoff.patient_items.some((item) => sameId(item.patient_id, payload.patient_id))) throw createError('Bệnh nhân đã có trong bàn giao.', 409);
  handoff.patient_items.push({
    patient_id: toObjectId(payload.patient_id, 'patient_id'),
    encounter_id: payload.encounter_id ? toObjectId(payload.encounter_id, 'encounter_id') : undefined,
    admission_id: payload.admission_id ? toObjectId(payload.admission_id, 'admission_id') : undefined,
    bed_id: payload.bed_id ? toObjectId(payload.bed_id, 'bed_id') : undefined,
    situation: payload.situation,
    background: payload.background,
    assessment: payload.assessment,
    recommendation: payload.recommendation,
    acuity_level: payload.acuity_level || 'medium',
    flags: payload.flags || {},
    pending_task_ids: payload.pending_task_ids || [],
    overdue_task_ids: payload.overdue_task_ids || [],
    pending_medication_ids: payload.pending_medication_ids || [],
    pending_order_ids: payload.pending_order_ids || [],
    note: payload.note,
  });
  await handoff.save();
  await recordAuditLog({ actor, action: 'nursing_handoff.patient_added', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Thêm bệnh nhân vào bàn giao.', requestMeta });
  await emitHandoffEvent('nursing_handoff.patient_added', handoff, { patient_id: payload.patient_id });
  return getHandoff(handoff._id);
}

async function removePatient(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  const handoff = await NursingHandoff.findById(handoffId);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  const patientId = payload.patient_id || payload.item_id;
  handoff.patient_items = handoff.patient_items.filter((item) => !sameId(item.patient_id, patientId) && !sameId(item._id, patientId));
  await handoff.save();
  await recordAuditLog({ actor, action: 'nursing_handoff.patient_removed', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Xóa bệnh nhân khỏi bàn giao.', requestMeta });
  await emitHandoffEvent('nursing_handoff.patient_removed', handoff, { patient_id: payload.patient_id });
  return getHandoff(handoff._id);
}

async function attachTask(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.task_id) throw createError('task_id là bắt buộc.', 400);
  const [handoff, task] = await Promise.all([NursingHandoff.findById(handoffId), NursingTask.findById(payload.task_id)]);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  if (!task) throw createError('Không tìm thấy task điều dưỡng.', 404);
  if (!handoff.task_ids.some((id) => sameId(id, task._id))) handoff.task_ids.push(task._id);
  const patientItem = handoff.patient_items.find((item) => sameId(item.patient_id, task.patient_id));
  if (patientItem && !patientItem.pending_task_ids.some((id) => sameId(id, task._id))) patientItem.pending_task_ids.push(task._id);
  task.handoff_id = handoff._id;
  await Promise.all([handoff.save(), task.save()]);
  await recordAuditLog({ actor, action: 'nursing_handoff.task_attached', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Gắn task vào bàn giao.', requestMeta });
  await emitHandoffEvent('nursing_handoff.task_attached', handoff, { task_id: normalizeId(task) });
  return getHandoff(handoff._id);
}

async function submitHandoff(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  const handoff = await NursingHandoff.findById(handoffId);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  if (!handoff.patient_items.length) throw createError('Bàn giao cần có ít nhất một bệnh nhân.', 409);
  handoff.status = 'submitted';
  handoff.submitted_at = new Date();
  if (payload.to_user_id) handoff.to_user_id = toObjectId(payload.to_user_id, 'to_user_id');
  if (payload.to_team_role) handoff.to_team_role = payload.to_team_role;
  handoff.updated_by = actorUserId(actor);
  await handoff.save();
  await recordAuditLog({ actor, action: 'nursing_handoff.submitted', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Gửi bàn giao ca.', requestMeta });
  await emitHandoffEvent('nursing_handoff.submitted', handoff);
  return getHandoff(handoff._id);
}

async function ackPatientItem(handoffId, itemId, payload = {}, actor = {}, requestMeta = {}) {
  const handoff = await NursingHandoff.findById(handoffId);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  const item = handoff.patient_items.id(itemId);
  if (!item) throw createError('Không tìm thấy bệnh nhân trong bàn giao.', 404);
  item.receiver_acknowledged = true;
  item.acknowledged_at = new Date();
  item.acknowledged_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'acknowledged_by') : undefined;
  if (payload.note) item.note = payload.note;
  await handoff.save();
  await recordAuditLog({ actor, action: 'nursing_handoff.patient_acknowledged', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Xác nhận từng bệnh nhân bàn giao.', requestMeta, metadata: { item_id: itemId } });
  await emitHandoffEvent('nursing_handoff.patient_acknowledged', handoff, { item_id: itemId, patient_id: normalizeId(item.patient_id) });
  return getHandoff(handoff._id);
}

async function acceptHandoff(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  const handoff = await NursingHandoff.findById(handoffId);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  const unackedCritical = handoff.patient_items.filter((item) => item.acuity_level === 'critical' && !item.receiver_acknowledged);
  if (unackedCritical.length && !payload.force) throw createError('Cần ack tất cả bệnh nhân critical trước khi nhận toàn bộ bàn giao.', 409);
  handoff.status = 'accepted';
  handoff.accepted_at = new Date();
  handoff.accepted_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'accepted_by') : undefined;
  await handoff.save();
  await recordAuditLog({ actor, action: 'nursing_handoff.accepted', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Nhận bàn giao ca.', requestMeta });
  await emitHandoffEvent('nursing_handoff.accepted', handoff);
  return getHandoff(handoff._id);
}

async function rejectHandoff(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.rejection_reason || payload.reason);
  if (!reason) throw createError('rejection_reason là bắt buộc.', 400);
  const handoff = await NursingHandoff.findById(handoffId);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  handoff.status = 'rejected';
  handoff.rejected_at = new Date();
  handoff.rejected_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'rejected_by') : undefined;
  handoff.rejection_reason = reason;
  await handoff.save();
  await recordAuditLog({ actor, action: 'nursing_handoff.rejected', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Từ chối bàn giao ca.', requestMeta });
  await emitHandoffEvent('nursing_handoff.rejected', handoff, { rejection_reason: reason });
  return getHandoff(handoff._id);
}

async function reopenHandoff(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  const handoff = await NursingHandoff.findById(handoffId);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  handoff.status = 'reopened';
  handoff.metadata = { ...(handoff.metadata || {}), reopen_reason: payload.reason, reopened_at: new Date(), reopened_by: actorUserId(actor) };
  await handoff.save();
  await recordAuditLog({ actor, action: 'nursing_handoff.reopened', targetType: 'nursing_handoff', targetId: handoff._id, status: 'success', message: 'Mở lại bàn giao ca.', requestMeta });
  await emitHandoffEvent('nursing_handoff.reopened', handoff);
  return getHandoff(handoff._id);
}

async function cloneHandoff(handoffId, payload = {}, actor = {}, requestMeta = {}) {
  const source = await NursingHandoff.findById(handoffId).lean();
  if (!source) throw createError('Không tìm thấy bàn giao ca.', 404);
  return createHandoff({
    department_id: normalizeId(source.department_id),
    ward_id: normalizeId(source.ward_id),
    shift_date: payload.shift_date || new Date(),
    from_shift: payload.from_shift || source.from_shift,
    to_shift: payload.to_shift || source.to_shift,
    from_user_id: actorUserId(actor),
    to_user_id: payload.to_user_id,
    to_team_role: payload.to_team_role || source.to_team_role,
    summary: payload.summary || source.summary,
    risk_summary: source.risk_summary,
    patient_items: source.patient_items.map((item) => ({
      ...item,
      receiver_acknowledged: false,
      acknowledged_at: undefined,
      acknowledged_by: undefined,
    })),
    task_ids: source.task_ids,
    metadata: { cloned_from_handoff_id: normalizeId(source), ...(payload.metadata || {}) },
  }, actor, requestMeta);
}

async function auditTrail(handoffId, actor = {}) {
  const handoff = await getHandoff(handoffId, actor);
  return {
    handoff_id: handoff.handoff_id,
    handoff_code: handoff.handoff_code,
    items: [
      { type: 'created', at: handoff.created_at, title: 'Tạo bàn giao nháp', actor_id: handoff.from_user_id },
      handoff.submitted_at ? { type: 'submitted', at: handoff.submitted_at, title: 'Gửi bàn giao', actor_id: handoff.from_user_id } : null,
      ...handoff.patient_items.filter((item) => item.acknowledged_at).map((item) => ({
        type: 'patient_acknowledged',
        at: item.acknowledged_at,
        title: `Ack bệnh nhân ${item.patient?.full_name || item.patient_id}`,
        actor_id: item.acknowledged_by,
      })),
      handoff.accepted_at ? { type: 'accepted', at: handoff.accepted_at, title: 'Nhận bàn giao', actor_id: handoff.accepted_by } : null,
      handoff.rejected_at ? { type: 'rejected', at: handoff.rejected_at, title: 'Từ chối bàn giao', note: handoff.rejection_reason } : null,
    ].filter(Boolean).sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)),
  };
}

async function exportPdf(handoffId, actor = {}, requestMeta = {}) {
  const handoff = await getHandoff(handoffId, actor);
  await recordAuditLog({ actor, action: 'nursing_handoff.export_pdf', targetType: 'nursing_handoff', targetId: handoffId, status: 'success', message: 'Xuất PDF bàn giao ca.', requestMeta });
  return {
    handoff_id: handoff.handoff_id,
    handoff_code: handoff.handoff_code,
    file_name: `${handoff.handoff_code || handoff.handoff_id}.pdf`,
    status: 'ready',
    content_type: 'application/pdf',
    generated_at: new Date(),
    note: 'PDF renderer có thể nối vào pipeline export tài liệu hiện có; payload này đã sẵn dữ liệu bàn giao.',
    handoff,
  };
}

module.exports = {
  listHandoffs,
  getActiveHandoffs: (query, actor) => listHandoffs(query, actor, 'active'),
  getHistory: (query, actor) => listHandoffs(query, actor, 'history'),
  getHandoff,
  createHandoff,
  generateDraft,
  updateHandoff,
  addPatient,
  removePatient,
  attachTask,
  submitHandoff,
  acceptHandoff,
  rejectHandoff,
  reopenHandoff,
  ackPatientItem,
  exportPdf,
  auditTrail,
  cloneHandoff,
};
