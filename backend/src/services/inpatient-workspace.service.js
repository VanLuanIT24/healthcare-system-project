const { Types } = require('mongoose');
const {
  Admission,
  Allergy,
  Bed,
  BedAssignment,
  Charge,
  ClinicalNote,
  Department,
  InpatientHandover,
  InpatientTask,
  MedicationAdministration,
  MedicationMaster,
  Patient,
  Prescription,
  PrescriptionItem,
  ProblemList,
  Room,
  User,
  VitalSign,
} = require('../models');
const {
  ADMISSION_STATUS,
  ADMINISTRATION_STATUS,
  ALLERGY_STATUS,
  BED_ASSIGNMENT_STATUS,
  BED_STATUS,
  CHARGE_STATUS,
  INPATIENT_TASK_STATUS,
  PROBLEM_STATUS,
  ROOM_STATUS,
} = require('../constants/statuses');
const { PERMISSION } = require('../constants/permissions');
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
const inpatientService = require('./inpatient.service');
const permissionService = require('./permission.service');
const actorContext = require('../common/actors');
const realtimeService = require('../realtime/realtime.service');

const ACTIVE_ADMISSION_STATUSES = [
  ADMISSION_STATUS.PLANNED,
  ADMISSION_STATUS.ADMITTED,
  ADMISSION_STATUS.TRANSFERRED,
];
const WARD_BOARD_STATUSES = [ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED, ADMISSION_STATUS.PLANNED];
const OPEN_INPATIENT_TASK_STATUSES = [INPATIENT_TASK_STATUS.TODO, INPATIENT_TASK_STATUS.IN_PROGRESS];
const TERMINAL_INPATIENT_TASK_STATUSES = [INPATIENT_TASK_STATUS.DONE, INPATIENT_TASK_STATUS.CANCELLED];
const ACTIONABLE_ADMINISTRATION_STATUSES = [ADMINISTRATION_STATUS.SCHEDULED, ADMINISTRATION_STATUS.HELD];

function normalizeId(value) {
  if (!value) return null;
  const id = value._id || value.id || value;
  return typeof id.toString === 'function' ? id.toString() : String(id);
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return undefined;
  const id = normalizeId(value);
  if (!Types.ObjectId.isValid(id)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(id);
}

function sameId(left, right) {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

function parseDate(value, fieldName = 'date') {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function csv(value, fallback = []) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return fallback;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function actorType(actor = {}) {
  return actorContext.getActorType(actor);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions.filter(Boolean));
}

function assertStaffPermission(actor = {}, permissions = [], message = 'Bạn không có quyền thao tác Inpatient Nursing.') {
  if (actorContext.isSystem(actor) || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (actorType(actor) !== 'staff') throw createError(message, 403);
  if (!hasAnyPermission(actor, Array.isArray(permissions) ? permissions : [permissions])) throw createError(message, 403);
  return true;
}

function scopedDepartmentId(actor = {}, globalPermissions = []) {
  if (actorContext.isSystem(actor) || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return null;
  if (hasAnyPermission(actor, globalPermissions)) return null;
  const departmentId = actorDepartmentId(actor);
  if (!departmentId) throw createError('Thiếu department scope của staff.', 403);
  return departmentId;
}

function assertDepartmentAccess(actor = {}, departmentId, globalPermissions = [], message = 'Bạn không có quyền thao tác dữ liệu khoa này.') {
  const departmentScope = scopedDepartmentId(actor, globalPermissions);
  if (departmentScope && !sameId(departmentScope, departmentId)) throw createError(message, 403);
  return true;
}

function dateWindow(value = new Date()) {
  const date = parseDate(value || new Date(), 'date') || new Date();
  return { date, start: getStartOfDay(date), end: getEndOfDay(date) };
}

function patientDto(patient = {}) {
  if (!patient || typeof patient !== 'object') return null;
  return {
    patient_id: normalizeId(patient),
    patient_code: patient.patient_code,
    full_name: patient.full_name || patient.patient_name,
    gender: patient.gender,
    date_of_birth: patient.date_of_birth,
    phone: patient.phone,
  };
}

function userDto(user = {}) {
  if (!user || typeof user !== 'object') return null;
  return {
    user_id: normalizeId(user),
    full_name: user.full_name,
    username: user.username,
    employee_code: user.employee_code,
  };
}

function departmentDto(department = {}) {
  if (!department || typeof department !== 'object') return null;
  return {
    department_id: normalizeId(department),
    department_code: department.department_code,
    department_name: department.department_name,
  };
}

function roomDto(room = {}) {
  if (!room || typeof room !== 'object') return null;
  return {
    room_id: normalizeId(room),
    room_code: room.room_code,
    room_name: room.room_name,
    room_type: room.room_type,
    floor: room.floor,
    building: room.building,
    status: room.status,
    service_id: normalizeId(room.service_id),
  };
}

function bedDto(bed = {}) {
  if (!bed || typeof bed !== 'object') return null;
  return {
    bed_id: normalizeId(bed),
    bed_code: bed.bed_code,
    bed_name: bed.bed_name,
    bed_type: bed.bed_type,
    status: bed.status,
  };
}

function vitalDto(vital = {}) {
  if (!vital) return null;
  return {
    vital_sign_id: normalizeId(vital),
    recorded_at: vital.recorded_at || vital.created_at,
    temperature: vital.temperature ?? null,
    heart_rate: vital.heart_rate ?? null,
    respiratory_rate: vital.respiratory_rate ?? null,
    systolic_bp: vital.systolic_bp ?? null,
    diastolic_bp: vital.diastolic_bp ?? null,
    spo2: vital.spo2 ?? null,
    pain_score: vital.pain_score ?? null,
    severity: vital.overall_severity || vital.severity || 'normal',
    abnormal_flags: vital.abnormal_flags || [],
    requires_recheck: Boolean(vital.requires_recheck),
    requires_doctor_notification: Boolean(vital.requires_doctor_notification || vital.doctor_notification_required),
  };
}

function vitalAlerts(vital = {}) {
  if (!vital) return [];
  const flags = Array.isArray(vital.abnormal_flags) ? vital.abnormal_flags : [];
  const severity = vital.overall_severity || vital.severity;
  const alerts = flags.map((flag) => ({
    field: flag.field,
    level: flag.level || flag.severity || severity,
    message: flag.message || `${flag.field || 'Sinh hiệu'} bất thường`,
    recommendation: flag.recommendation,
  }));
  if (['warning', 'high', 'critical'].includes(severity) && alerts.length === 0) {
    alerts.push({ level: severity, message: `Sinh hiệu mức ${severity}` });
  }
  return alerts;
}

function isAbnormalVital(vital = {}) {
  const severity = vital?.overall_severity || vital?.severity;
  return ['warning', 'high', 'critical'].includes(severity) || (vital?.abnormal_flags || []).length > 0;
}

function minutesFromNow(value) {
  if (!value) return null;
  const diff = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  return Number.isFinite(diff) ? diff : null;
}

function emitInpatientEvent(eventType, payload = {}) {
  const departmentId = payload.department_id || payload.departmentId;
  const patientId = payload.patient_id || payload.patientId;
  const actorId = payload.actor_id || payload.actorId;
  return realtimeService.emitToScope(eventType, {
    event_type: eventType,
    ...payload,
    occurred_at: payload.occurred_at || new Date().toISOString(),
  }, {
    department_id: departmentId,
    patient_id: patientId,
    user_id: actorId,
    roles: ['nurse', 'department_head'],
  });
}

async function latestVitalsByPatient(patientIds = []) {
  const ids = [...new Set(patientIds.map(normalizeId).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await VitalSign.find({ patient_id: { $in: ids.map((id) => toObjectId(id, 'patient_id')) } })
    .sort({ recorded_at: -1, created_at: -1 })
    .lean();
  const map = new Map();
  rows.forEach((row) => {
    const key = normalizeId(row.patient_id);
    if (!map.has(key)) map.set(key, row);
  });
  return map;
}

function groupById(items = [], field) {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeId(typeof field === 'function' ? field(item) : item[field]);
    if (!key) return;
    map.set(key, [...(map.get(key) || []), item]);
  });
  return map;
}

async function buildWardAdmissionFilter(query = {}, actor = {}) {
  let filter = {};
  const statuses = csv(query.status, WARD_BOARD_STATUSES);
  if (statuses.length) filter.status = { $in: statuses };
  if (query.department_id) filter.department_id = toObjectId(query.department_id, 'department_id');
  if (query.admission_type) filter.admission_type = query.admission_type;
  const departmentScope = scopedDepartmentId(actor, [
    PERMISSION.ADMISSIONS.READ,
  ]);
  if (departmentScope && !query.department_id) filter.department_id = toObjectId(departmentScope, 'department_id');
  if (departmentScope && query.department_id && !sameId(departmentScope, query.department_id)) {
    throw createError('Bạn không có quyền xem ward board của department này.', 403);
  }
  const keyword = normalizeString(query.search || query.keyword);
  if (keyword) {
    const patientMatches = await Patient.find({
      $or: [
        { patient_code: { $regex: escapeRegex(keyword), $options: 'i' } },
        { full_name: { $regex: escapeRegex(keyword), $options: 'i' } },
      ],
    }).select('_id').lean();
    filter.$or = [
      { admission_no: { $regex: escapeRegex(keyword), $options: 'i' } },
      { patient_id: { $in: patientMatches.map((patient) => patient._id) } },
    ];
  }
  return filter;
}

async function getWardBoard(query = {}, actor = {}) {
  assertStaffPermission(actor, [
    PERMISSION.WARD_BOARD.READ,
    PERMISSION.ADMISSIONS.READ,
    PERMISSION.ADMISSIONS.READ_DEPARTMENT,
  ]);
  const { page, limit, skip } = getPagination({ ...query, limit: query.limit || 100 }, 100, 300);
  const filter = await buildWardAdmissionFilter(query, actor);
  const now = new Date();
  const dueSoon = new Date(now.getTime() + Number(query.medication_window_minutes || 60) * 60000);

  const [admissions, total, bedAvailability] = await Promise.all([
    Admission.find(filter)
      .sort({ status: 1, admitted_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('encounter_id', 'encounter_code status start_time')
      .populate('department_id', 'department_code department_name')
      .populate('attending_doctor_id', 'full_name username employee_code')
      .lean(),
    Admission.countDocuments(filter),
    inpatientService.getBedAvailability({
      department_id: query.department_id,
      room_id: query.room_id,
      room_type: query.room_type,
      floor: query.floor,
      building: query.building,
      bed_type: query.bed_type,
    }, actor).catch(() => ({ summary: {} })),
  ]);

  const admissionIds = admissions.map((item) => item._id);
  const patientIds = admissions.map((item) => item.patient_id?._id || item.patient_id).filter(Boolean);
  const encounterIds = admissions.map((item) => item.encounter_id?._id || item.encounter_id).filter(Boolean);

  const [
    assignments,
    latestVitals,
    allergies,
    problems,
    latestNotes,
    taskStats,
    medicationStats,
    charges,
  ] = await Promise.all([
    BedAssignment.find({ admission_id: { $in: admissionIds }, status: BED_ASSIGNMENT_STATUS.ACTIVE })
      .populate({ path: 'bed_id', select: 'bed_code bed_name bed_type status room_id', populate: { path: 'room_id', select: 'room_code room_name room_type floor building status department_id service_id' } })
      .lean(),
    latestVitalsByPatient(patientIds),
    Allergy.find({ patient_id: { $in: patientIds }, status: ALLERGY_STATUS.ACTIVE }).lean(),
    ProblemList.find({ patient_id: { $in: patientIds }, status: PROBLEM_STATUS.ACTIVE }).lean(),
    ClinicalNote.find({ encounter_id: { $in: encounterIds } })
      .sort({ created_at: -1 })
      .populate('author_id', 'full_name username employee_code')
      .lean(),
    InpatientTask.aggregate([
      { $match: { admission_id: { $in: admissionIds } } },
      {
        $group: {
          _id: '$admission_id',
          open_tasks_count: { $sum: { $cond: [{ $in: ['$status', OPEN_INPATIENT_TASK_STATUSES] }, 1, 0] } },
          overdue_tasks_count: {
            $sum: {
              $cond: [
                { $and: [{ $in: ['$status', OPEN_INPATIENT_TASK_STATUSES] }, { $lt: ['$due_at', now] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    MedicationAdministration.aggregate([
      { $match: { admission_id: { $in: admissionIds } } },
      {
        $group: {
          _id: '$admission_id',
          medication_due_count: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', ADMINISTRATION_STATUS.SCHEDULED] }, { $lte: ['$scheduled_at', dueSoon] }, { $gte: ['$scheduled_at', now] }] },
                1,
                0,
              ],
            },
          },
          medication_overdue_count: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', ADMINISTRATION_STATUS.SCHEDULED] }, { $lt: ['$scheduled_at', now] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Charge.aggregate([
      { $match: { admission_id: { $in: admissionIds }, source_module: 'inpatient' } },
      {
        $group: {
          _id: '$admission_id',
          count: { $sum: 1 },
          total_amount: { $sum: '$total_amount' },
          pending_count: { $sum: { $cond: [{ $in: ['$status', [CHARGE_STATUS.DRAFT, CHARGE_STATUS.PENDING, CHARGE_STATUS.POSTED].filter(Boolean)] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const assignmentByAdmission = new Map(assignments.map((item) => [normalizeId(item.admission_id), item]));
  const allergiesByPatient = groupById(allergies, 'patient_id');
  const problemsByPatient = groupById(problems, 'patient_id');
  const noteByEncounter = new Map();
  latestNotes.forEach((note) => {
    const key = normalizeId(note.encounter_id);
    if (!noteByEncounter.has(key)) noteByEncounter.set(key, note);
  });
  const taskStatsByAdmission = new Map(taskStats.map((item) => [normalizeId(item._id), item]));
  const medicationStatsByAdmission = new Map(medicationStats.map((item) => [normalizeId(item._id), item]));
  const chargesByAdmission = new Map(charges.map((item) => [normalizeId(item._id), item]));

  const items = admissions.map((admission) => {
    const admissionId = normalizeId(admission);
    const patientId = normalizeId(admission.patient_id);
    const assignment = assignmentByAdmission.get(admissionId) || null;
    const bed = assignment?.bed_id || null;
    const room = bed?.room_id || null;
    const latestVital = latestVitals.get(patientId) || null;
    const taskRow = taskStatsByAdmission.get(admissionId) || {};
    const medicationRow = medicationStatsByAdmission.get(admissionId) || {};
    const chargeRow = chargesByAdmission.get(admissionId) || {};
    const admittedAt = admission.admitted_at || admission.created_at;
    const losHours = admittedAt ? Math.max(0, Math.round((now - new Date(admittedAt)) / 3600000)) : 0;

    return {
      admission,
      admission_id: admissionId,
      patient: patientDto(admission.patient_id),
      encounter: admission.encounter_id,
      department: departmentDto(admission.department_id),
      attending_doctor: userDto(admission.attending_doctor_id),
      current_bed_assignment: assignment,
      room: roomDto(room),
      bed: bedDto(bed),
      latest_vitals: vitalDto(latestVital),
      vital_alerts: vitalAlerts(latestVital),
      allergies: allergiesByPatient.get(patientId) || [],
      problems: problemsByPatient.get(patientId) || [],
      open_tasks_count: taskRow.open_tasks_count || 0,
      overdue_tasks_count: taskRow.overdue_tasks_count || 0,
      medication_due_count: medicationRow.medication_due_count || 0,
      medication_overdue_count: medicationRow.medication_overdue_count || 0,
      latest_nursing_note: noteByEncounter.get(normalizeId(admission.encounter_id)) || null,
      charges_summary: {
        count: chargeRow.count || 0,
        total_amount: chargeRow.total_amount || 0,
        pending_count: chargeRow.pending_count || 0,
      },
      los_hours: losHours,
      los_days: Math.floor(losHours / 24),
      high_risk: admission.priority === 'critical'
        || admission.fall_risk_level === 'high'
        || admission.infection_risk_level === 'high'
        || isAbnormalVital(latestVital)
        || (allergiesByPatient.get(patientId) || []).some((allergy) => ['severe', 'life_threatening'].includes(allergy.severity)),
      allowed_actions: {
        can_view: true,
        can_record_vitals: hasPermission(actor, PERMISSION.VITAL_SIGNS.CREATE),
        can_create_task: hasAnyPermission(actor, [PERMISSION.INPATIENT_TASKS.CREATE, PERMISSION.INPATIENT_TASKS.MANAGE]),
        can_administer_medication: hasPermission(actor, PERMISSION.MEDICATION_ADMINISTRATIONS.ADMINISTER),
        can_transfer_bed: Boolean(assignment) && hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.TRANSFER),
        can_release_bed: Boolean(assignment) && hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.RELEASE),
        can_discharge: hasAnyPermission(actor, [PERMISSION.ADMISSIONS.DISCHARGE, PERMISSION.ADMISSIONS.DISCHARGE_OWN]),
      },
    };
  });

  const summary = {
    active_admissions: admissions.filter((item) => [ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED].includes(item.status)).length,
    pending_bed_assignment: items.filter((item) => !item.current_bed_assignment).length,
    occupied_beds: bedAvailability.summary?.occupied || 0,
    available_beds: bedAvailability.summary?.available || 0,
    reserved_beds: bedAvailability.summary?.reserved || 0,
    maintenance_beds: (bedAvailability.summary?.maintenance || 0) + (bedAvailability.summary?.blocked || 0),
    abnormal_vitals: items.filter((item) => item.vital_alerts.length > 0).length,
    high_risk_patients: items.filter((item) => item.high_risk).length,
    overdue_tasks: items.reduce((sum, item) => sum + item.overdue_tasks_count, 0),
    medication_due_now: items.reduce((sum, item) => sum + item.medication_due_count, 0),
    medication_overdue: items.reduce((sum, item) => sum + item.medication_overdue_count, 0),
    planned_discharge_today: items.filter((item) => {
      if (!item.admission.expected_discharge_at) return false;
      const { start, end } = dateWindow(new Date());
      const expected = new Date(item.admission.expected_discharge_at);
      return expected >= start && expected <= end;
    }).length,
  };

  return { summary, items, pagination: buildPagination(page, limit, total), generated_at: now.toISOString() };
}

async function getWardMap(query = {}, actor = {}) {
  assertStaffPermission(actor, [
    PERMISSION.BEDS.READ,
    PERMISSION.BEDS.READ_DEPARTMENT,
    PERMISSION.ROOMS.READ,
    PERMISSION.ROOMS.READ_DEPARTMENT,
  ]);
  let roomFilter = { is_deleted: false };
  for (const field of ['department_id', 'room_type', 'floor', 'building', 'status']) {
    if (query[field]) roomFilter[field] = query[field];
  }
  const departmentScope = scopedDepartmentId(actor, [PERMISSION.ROOMS.READ, PERMISSION.BEDS.READ, PERMISSION.ROOMS.MANAGE, PERMISSION.BEDS.MANAGE]);
  if (departmentScope && !roomFilter.department_id) roomFilter.department_id = toObjectId(departmentScope, 'department_id');
  if (departmentScope && roomFilter.department_id && !sameId(departmentScope, roomFilter.department_id)) {
    throw createError('Bạn không có quyền xem ward map của department này.', 403);
  }

  const [rooms, availability] = await Promise.all([
    Room.find(roomFilter)
      .sort({ building: 1, floor: 1, room_code: 1 })
      .populate('department_id', 'department_code department_name')
      .populate('service_id', 'service_code service_name unit_price')
      .lean(),
    inpatientService.getBedAvailability(query, actor).catch(() => ({ summary: {} })),
  ]);
  const roomIds = rooms.map((room) => room._id);
  const beds = await Bed.find({ room_id: { $in: roomIds }, is_deleted: false })
    .sort({ bed_code: 1 })
    .lean();
  const assignments = beds.length
    ? await BedAssignment.find({ bed_id: { $in: beds.map((bed) => bed._id) }, status: BED_ASSIGNMENT_STATUS.ACTIVE })
      .populate({
        path: 'admission_id',
        select: 'admission_no patient_id department_id attending_doctor_id status admitted_at priority',
        populate: [
          { path: 'patient_id', select: 'patient_code full_name gender date_of_birth' },
          { path: 'attending_doctor_id', select: 'full_name username employee_code' },
        ],
      })
      .lean()
    : [];

  const assignmentsByBed = new Map(assignments.map((assignment) => [normalizeId(assignment.bed_id), assignment]));
  const bedsByRoom = groupById(beds, 'room_id');
  const buildings = new Map();

  rooms.forEach((room) => {
    const buildingKey = room.building || 'Chưa phân khu';
    const floorKey = room.floor || 'Chưa tầng';
    if (!buildings.has(buildingKey)) buildings.set(buildingKey, new Map());
    const floors = buildings.get(buildingKey);
    if (!floors.has(floorKey)) floors.set(floorKey, []);
    const roomBeds = bedsByRoom.get(normalizeId(room)) || [];
    const bedRows = roomBeds.map((bed) => {
      const assignment = assignmentsByBed.get(normalizeId(bed)) || null;
      const admission = assignment?.admission_id || null;
      return {
        bed,
        current_assignment: assignment,
        admission,
        patient: patientDto(admission?.patient_id),
        warnings: [
          bed.status === BED_STATUS.AVAILABLE && assignment ? 'active_assignment_on_available_bed' : null,
          room.status !== ROOM_STATUS.ACTIVE ? 'room_not_active' : null,
        ].filter(Boolean),
      };
    });
    floors.get(floorKey).push({
      room,
      bed_summary: {
        total_beds: roomBeds.length,
        available: roomBeds.filter((bed) => bed.status === BED_STATUS.AVAILABLE).length,
        occupied: roomBeds.filter((bed) => bed.status === BED_STATUS.OCCUPIED).length,
        reserved: roomBeds.filter((bed) => bed.status === BED_STATUS.RESERVED).length,
        maintenance: roomBeds.filter((bed) => bed.status === BED_STATUS.MAINTENANCE).length,
        blocked: roomBeds.filter((bed) => bed.status === BED_STATUS.BLOCKED).length,
        inactive: roomBeds.filter((bed) => bed.status === BED_STATUS.INACTIVE).length,
      },
      beds: bedRows,
    });
  });

  return {
    summary: {
      total_rooms: rooms.length,
      ...(availability.summary || {}),
    },
    buildings: [...buildings.entries()].map(([building, floors]) => ({
      building,
      floors: [...floors.entries()].map(([floor, floorRooms]) => ({ floor, rooms: floorRooms })),
    })),
  };
}

async function getDischargeReadiness(admissionId, actor = {}) {
  assertStaffPermission(actor, [
    PERMISSION.DISCHARGE_READINESS.READ,
    PERMISSION.ADMISSIONS.READ,
    PERMISSION.ADMISSIONS.READ_DEPARTMENT,
  ]);
  const admission = await Admission.findById(admissionId)
    .populate('patient_id', 'patient_code full_name')
    .populate('department_id', 'department_code department_name')
    .lean();
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  const departmentScope = scopedDepartmentId(actor, [PERMISSION.ADMISSIONS.READ]);
  if (departmentScope && !sameId(departmentScope, admission.department_id)) throw createError('Bạn không có quyền xem discharge readiness này.', 403);

  const now = new Date();
  const [openDischargeTasks, openTasks, pendingMedication, activeCharges, latestVitals] = await Promise.all([
    InpatientTask.find({ admission_id: admission._id, type: 'discharge_checklist', status: { $in: OPEN_INPATIENT_TASK_STATUSES } }).lean(),
    InpatientTask.find({ admission_id: admission._id, status: { $in: OPEN_INPATIENT_TASK_STATUSES } }).lean(),
    MedicationAdministration.find({
      admission_id: admission._id,
      status: ADMINISTRATION_STATUS.SCHEDULED,
      scheduled_at: { $lte: new Date(now.getTime() + 12 * 3600000) },
    }).lean(),
    Charge.find({ admission_id: admission._id, source_module: 'inpatient', status: { $nin: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED].filter(Boolean) } }).lean(),
    VitalSign.findOne({ patient_id: admission.patient_id?._id || admission.patient_id }).sort({ recorded_at: -1, created_at: -1 }).lean(),
  ]);

  const blockers = [];
  const warnings = [];
  const suggestedActions = [];

  if (![ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED].includes(admission.status)) {
    blockers.push('Admission phải ở trạng thái admitted/transferred trước khi ra viện.');
  }
  if (!normalizeString(admission.discharge_summary)) {
    blockers.push('Chưa có discharge_summary.');
    suggestedActions.push('Yêu cầu bác sĩ hoàn tất discharge summary.');
  }
  if (openDischargeTasks.length) {
    blockers.push(`Còn ${openDischargeTasks.length} task discharge_checklist chưa hoàn tất.`);
    suggestedActions.push('Hoàn tất checklist xuất viện.');
  }
  if (pendingMedication.length) {
    blockers.push(`Còn ${pendingMedication.length} lịch dùng thuốc chưa xử lý trong 12 giờ tới.`);
    suggestedActions.push('Rà soát eMAR trước khi ra viện.');
  }
  if (!activeCharges.length) {
    blockers.push('Chưa tạo charge phòng/giường.');
    suggestedActions.push('Tạo room/bed charge.');
  }
  if (openTasks.length > openDischargeTasks.length) {
    warnings.push(`Còn ${openTasks.length - openDischargeTasks.length} task nội trú mở.`);
  }
  if (isAbnormalVital(latestVitals)) {
    warnings.push('Sinh hiệu gần nhất bất thường.');
    suggestedActions.push('Đánh giá lại sinh hiệu trước khi discharge.');
  }

  return {
    can_discharge: blockers.length === 0,
    blockers,
    warnings,
    suggested_actions: [...new Set(suggestedActions)],
    admission,
    latest_vitals: vitalDto(latestVitals),
  };
}

async function validateBedAssignmentPreview(admissionId, payload = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.BED_ASSIGNMENTS.CREATE, PERMISSION.BED_ASSIGNMENTS.TRANSFER]);
  const bedId = payload.bed_id || payload.new_bed_id;
  try {
    const validation = await inpatientService.validateBedAssignment(admissionId, bedId, payload, actor);
    return {
      valid: true,
      errors: [],
      warnings: [],
      preview: {
        admission: validation.admission,
        bed: validation.bed,
        room: validation.room,
        will_set_bed_status: payload.mode === 'reserve' || validation.admission.status === ADMISSION_STATUS.PLANNED ? BED_STATUS.RESERVED : BED_STATUS.OCCUPIED,
      },
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      warnings: [],
      preview: null,
    };
  }
}

async function getBedSuggestions(payload = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.BED_SUGGESTIONS.READ, PERMISSION.BED_SUGGESTIONS.CREATE, PERMISSION.BEDS.AVAILABLE_READ, PERMISSION.BEDS.AVAILABLE_READ_DEPARTMENT]);
  const admissionId = payload.admission_id;
  const admission = await Admission.findById(admissionId).lean();
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  const departmentScope = scopedDepartmentId(actor, [PERMISSION.ADMISSIONS.READ, PERMISSION.BEDS.READ]);
  if (departmentScope && !sameId(departmentScope, admission.department_id)) throw createError('Bạn không có quyền gợi ý giường cho admission này.', 403);
  const available = await inpatientService.getAvailableBeds({
    department_id: payload.department_id || admission.department_id,
    bed_type: payload.bed_type,
    limit: payload.limit || 50,
  }, actor);
  const suggestions = (available.items || []).map((bed) => {
    const room = bed.room_id;
    const reasons = [];
    const warnings = [];
    let score = 60;
    if (sameId(room?.department_id?._id || room?.department_id, admission.department_id)) {
      score += 20;
      reasons.push('Cùng khoa điều trị.');
    } else {
      warnings.push('Giường khác khoa với admission.');
    }
    if (!payload.bed_type || bed.bed_type === payload.bed_type) {
      score += 8;
      reasons.push('Đúng loại giường yêu cầu.');
    }
    if (admission.isolation_required && bed.bed_type === 'isolation') {
      score += 10;
      reasons.push('Phù hợp yêu cầu cách ly.');
    }
    if (admission.isolation_required && bed.bed_type !== 'isolation') warnings.push('Bệnh nhân có yêu cầu cách ly nhưng giường không phải isolation.');
    if (room?.status === ROOM_STATUS.ACTIVE) {
      score += 4;
      reasons.push('Phòng đang active.');
    }
    return { bed, room, score: Math.min(100, score), reasons, warnings };
  }).sort((a, b) => b.score - a.score);

  return { suggestions };
}

function taskDto(task = {}) {
  const dueMinutes = minutesFromNow(task.due_at);
  const isOverdue = OPEN_INPATIENT_TASK_STATUSES.includes(task.status) && dueMinutes !== null && dueMinutes < 0;
  return {
    task_id: normalizeId(task),
    id: normalizeId(task),
    admission_id: normalizeId(task.admission_id),
    admission: task.admission_id && typeof task.admission_id === 'object' ? task.admission_id : null,
    patient_id: normalizeId(task.patient_id),
    patient: patientDto(task.patient_id),
    room_id: normalizeId(task.room_id),
    room: roomDto(task.room_id),
    bed_id: normalizeId(task.bed_id),
    bed: bedDto(task.bed_id),
    type: task.type,
    task_type: task.type,
    title: task.title,
    description: task.description,
    priority: task.priority || 'normal',
    status: isOverdue ? 'overdue' : task.status,
    raw_status: task.status,
    assigned_to: normalizeId(task.assigned_to),
    assigned_to_name: task.assigned_to?.full_name,
    due_at: task.due_at,
    started_at: task.started_at,
    completed_at: task.completed_at,
    cancelled_at: task.cancelled_at,
    overdue_minutes: isOverdue ? Math.abs(dueMinutes) : 0,
    metadata: task.metadata || {},
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

async function buildTaskFilter(query = {}, actor = {}) {
  let filter = {};
  for (const field of ['admission_id', 'patient_id', 'room_id', 'bed_id', 'assigned_to']) {
    if (query[field]) filter[field] = toObjectId(query[field], field);
  }
  if (query.type || query.task_type) filter.type = query.type || query.task_type;
  const statuses = csv(query.status);
  if (statuses.length) filter.status = { $in: statuses.filter((status) => status !== 'overdue') };
  if (query.priority) filter.priority = query.priority;
  if (query.overdue === 'true' || statuses.includes('overdue')) {
    filter.status = { $in: OPEN_INPATIENT_TASK_STATUSES };
    filter.due_at = { $lt: new Date() };
  }
  if (query.due_from || query.due_to || query.date) {
    const window = query.date ? dateWindow(query.date) : {};
    filter.due_at = {
      ...(filter.due_at || {}),
      ...(query.date ? { $gte: window.start, $lte: window.end } : {}),
    };
    const from = parseDate(query.due_from, 'due_from');
    const to = parseDate(query.due_to, 'due_to');
    if (from) filter.due_at.$gte = from;
    if (to) filter.due_at.$lte = to;
  }
  const departmentId = query.department_id || scopedDepartmentId(actor, [
    PERMISSION.INPATIENT_TASKS.READ,
    PERMISSION.INPATIENT_TASKS.MANAGE,
  ]);
  if (departmentId) {
    const admissions = await Admission.find({ department_id: toObjectId(departmentId, 'department_id') }).select('_id').lean();
    filter.admission_id = { $in: admissions.map((item) => item._id) };
  }
  const keyword = normalizeString(query.search || query.keyword);
  if (keyword) {
    filter.$or = [
      { title: { $regex: escapeRegex(keyword), $options: 'i' } },
      { description: { $regex: escapeRegex(keyword), $options: 'i' } },
    ];
  }
  return filter;
}

async function listInpatientTasks(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_TASKS.READ, PERMISSION.INPATIENT_TASKS.READ_DEPARTMENT, PERMISSION.INPATIENT_TASKS.MANAGE]);
  const { page, limit, skip } = getPagination({ ...query, limit: query.limit || 50 }, 50, 200);
  const filter = await buildTaskFilter(query, actor);
  const [items, total, summaryRows] = await Promise.all([
    InpatientTask.find(filter)
      .sort({ due_at: 1, priority: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth')
      .populate('admission_id', 'admission_no status department_id')
      .populate('room_id', 'room_code room_name floor building')
      .populate('bed_id', 'bed_code bed_name bed_type status')
      .populate('assigned_to', 'full_name username employee_code')
      .lean(),
    InpatientTask.countDocuments(filter),
    InpatientTask.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  const summary = {
    total,
    todo: 0,
    in_progress: 0,
    done: 0,
    cancelled: 0,
    overdue: items.filter((item) => OPEN_INPATIENT_TASK_STATUSES.includes(item.status) && item.due_at && new Date(item.due_at) < new Date()).length,
  };
  summaryRows.forEach((row) => { summary[row._id] = row.count; });
  return { items: items.map(taskDto), summary, pagination: buildPagination(page, limit, total) };
}

async function getInpatientTaskDetail(taskId, actor = {}) {
  const task = await InpatientTask.findById(taskId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth')
    .populate('admission_id', 'admission_no status department_id attending_doctor_id')
    .populate('room_id', 'room_code room_name floor building')
    .populate('bed_id', 'bed_code bed_name bed_type status')
    .populate('assigned_to', 'full_name username employee_code')
    .lean();
  if (!task) throw createError('Không tìm thấy inpatient task.', 404);
  assertDepartmentAccess(actor, task.admission_id?.department_id, [
    PERMISSION.INPATIENT_TASKS.READ,
    PERMISSION.INPATIENT_TASKS.MANAGE,
  ], 'Bạn không có quyền xem task nội trú khoa này.');
  return taskDto(task);
}

async function resolveTaskContext(payload = {}, actor = {}) {
  const admission = await Admission.findById(payload.admission_id).lean();
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  assertDepartmentAccess(actor, admission.department_id, [
    PERMISSION.INPATIENT_TASKS.MANAGE,
  ], 'Bạn không có quyền tạo task cho admission này.');
  const assignment = await BedAssignment.findOne({ admission_id: admission._id, status: BED_ASSIGNMENT_STATUS.ACTIVE })
    .populate({ path: 'bed_id', select: 'room_id' })
    .lean();
  return {
    admission,
    patient_id: payload.patient_id || admission.patient_id,
    room_id: payload.room_id || assignment?.bed_id?.room_id,
    bed_id: payload.bed_id || assignment?.bed_id?._id || assignment?.bed_id,
  };
}

async function createInpatientTask(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_TASKS.CREATE, PERMISSION.INPATIENT_TASKS.MANAGE]);
  if (!payload.admission_id) throw createError('admission_id là bắt buộc.', 400);
  if (!normalizeString(payload.title)) throw createError('title là bắt buộc.', 400);
  const context = await resolveTaskContext(payload, actor);
  const task = await InpatientTask.create({
    admission_id: context.admission._id,
    patient_id: context.patient_id,
    type: payload.type || payload.task_type || 'other',
    title: normalizeString(payload.title),
    description: normalizeString(payload.description),
    priority: payload.priority || 'normal',
    status: payload.status || INPATIENT_TASK_STATUS.TODO,
    room_id: context.room_id,
    bed_id: context.bed_id,
    assigned_to: payload.assigned_to || undefined,
    assigned_by: payload.assigned_to ? actorUserId(actor) : undefined,
    due_at: parseDate(payload.due_at, 'due_at'),
    sla_due_at: parseDate(payload.sla_due_at, 'sla_due_at'),
    requires_acknowledgement: parseBoolean(payload.requires_acknowledgement),
    source_module: payload.source_module || 'manual',
    source_id: payload.source_id ? toObjectId(payload.source_id, 'source_id') : undefined,
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'inpatient_task.create', targetType: 'inpatient_task', targetId: task._id, status: 'success', message: 'Tạo inpatient task thành công.', requestMeta });
  emitInpatientEvent('inpatient.task.created', {
    department_id: context.admission.department_id,
    admission_id: context.admission._id,
    patient_id: context.patient_id,
    actor_id: actorUserId(actor),
    data: { task_id: task._id, title: task.title },
  });
  return getInpatientTaskDetail(task._id, actor);
}

async function updateInpatientTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_TASKS.UPDATE, PERMISSION.INPATIENT_TASKS.MANAGE]);
  const task = await InpatientTask.findById(taskId).populate('admission_id');
  if (!task) throw createError('Không tìm thấy inpatient task.', 404);
  assertDepartmentAccess(actor, task.admission_id?.department_id, [
    PERMISSION.INPATIENT_TASKS.MANAGE,
  ], 'Bạn không có quyền cập nhật task nội trú khoa này.');
  const allowedFields = ['title', 'description', 'priority', 'type', 'due_at', 'sla_due_at', 'room_id', 'bed_id', 'metadata'];
  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) task[field] = ['title', 'description'].includes(field) ? normalizeString(payload[field]) : payload[field];
  });
  if (payload.task_type !== undefined) task.type = payload.task_type;
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({ actor, action: 'inpatient_task.update', targetType: 'inpatient_task', targetId: task._id, status: 'success', message: 'Cập nhật inpatient task thành công.', requestMeta });
  return getInpatientTaskDetail(task._id, actor);
}

async function assignInpatientTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_TASKS.ASSIGN, PERMISSION.INPATIENT_TASKS.MANAGE]);
  const task = await InpatientTask.findById(taskId).populate('admission_id');
  if (!task) throw createError('Không tìm thấy inpatient task.', 404);
  assertDepartmentAccess(actor, task.admission_id?.department_id, [
    PERMISSION.INPATIENT_TASKS.MANAGE,
  ], 'Bạn không có quyền giao task nội trú khoa này.');
  const assignee = payload.assigned_to || payload.assigned_to_id;
  if (!assignee) throw createError('assigned_to là bắt buộc.', 400);
  task.assigned_to = toObjectId(assignee, 'assigned_to');
  task.assigned_by = actorUserId(actor);
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({ actor, action: 'inpatient_task.assign', targetType: 'inpatient_task', targetId: task._id, status: 'success', message: 'Giao inpatient task thành công.', requestMeta });
  emitInpatientEvent('inpatient.task.assigned', {
    department_id: task.admission_id?.department_id,
    admission_id: task.admission_id?._id || task.admission_id,
    patient_id: task.patient_id,
    actor_id: actorUserId(actor),
    data: { task_id: task._id, assigned_to: task.assigned_to },
  });
  return getInpatientTaskDetail(task._id, actor);
}

async function startInpatientTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_TASKS.START, PERMISSION.INPATIENT_TASKS.MANAGE]);
  const task = await InpatientTask.findById(taskId).populate('admission_id');
  if (!task) throw createError('Không tìm thấy inpatient task.', 404);
  assertDepartmentAccess(actor, task.admission_id?.department_id, [
    PERMISSION.INPATIENT_TASKS.MANAGE,
  ], 'Bạn không có quyền bắt đầu task nội trú khoa này.');
  if (TERMINAL_INPATIENT_TASK_STATUSES.includes(task.status)) throw createError('Task đã kết thúc, không thể start.', 409);
  task.status = INPATIENT_TASK_STATUS.IN_PROGRESS;
  task.started_at = parseDate(payload.started_at, 'started_at') || new Date();
  task.started_by = actorUserId(actor);
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({ actor, action: 'inpatient_task.start', targetType: 'inpatient_task', targetId: task._id, status: 'success', message: 'Bắt đầu inpatient task thành công.', requestMeta });
  emitInpatientEvent('inpatient.task.started', { department_id: task.admission_id?.department_id, admission_id: task.admission_id?._id || task.admission_id, patient_id: task.patient_id, actor_id: actorUserId(actor), data: { task_id: task._id } });
  return getInpatientTaskDetail(task._id, actor);
}

async function completeInpatientTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_TASKS.COMPLETE, PERMISSION.INPATIENT_TASKS.MANAGE]);
  const task = await InpatientTask.findById(taskId).populate('admission_id');
  if (!task) throw createError('Không tìm thấy inpatient task.', 404);
  assertDepartmentAccess(actor, task.admission_id?.department_id, [
    PERMISSION.INPATIENT_TASKS.MANAGE,
  ], 'Bạn không có quyền hoàn tất task nội trú khoa này.');
  if (task.status === INPATIENT_TASK_STATUS.CANCELLED) throw createError('Task đã hủy, không thể complete.', 409);
  task.status = INPATIENT_TASK_STATUS.DONE;
  task.completed_at = parseDate(payload.completed_at, 'completed_at') || new Date();
  task.completed_by = actorUserId(actor);
  task.metadata = { ...(task.metadata || {}), result_note: normalizeString(payload.result_note || payload.note) || task.metadata?.result_note };
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({ actor, action: 'inpatient_task.complete', targetType: 'inpatient_task', targetId: task._id, status: 'success', message: 'Hoàn tất inpatient task thành công.', requestMeta });
  emitInpatientEvent('inpatient.task.completed', { department_id: task.admission_id?.department_id, admission_id: task.admission_id?._id || task.admission_id, patient_id: task.patient_id, actor_id: actorUserId(actor), data: { task_id: task._id } });
  return getInpatientTaskDetail(task._id, actor);
}

async function cancelInpatientTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_TASKS.CANCEL, PERMISSION.INPATIENT_TASKS.MANAGE]);
  const task = await InpatientTask.findById(taskId).populate('admission_id');
  if (!task) throw createError('Không tìm thấy inpatient task.', 404);
  assertDepartmentAccess(actor, task.admission_id?.department_id, [
    PERMISSION.INPATIENT_TASKS.MANAGE,
  ], 'Bạn không có quyền hủy task nội trú khoa này.');
  if (task.status === INPATIENT_TASK_STATUS.DONE) throw createError('Task đã hoàn tất, không thể cancel.', 409);
  task.status = INPATIENT_TASK_STATUS.CANCELLED;
  task.cancelled_at = parseDate(payload.cancelled_at, 'cancelled_at') || new Date();
  task.cancelled_by = actorUserId(actor);
  task.cancel_reason = normalizeString(payload.reason || payload.cancel_reason);
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({ actor, action: 'inpatient_task.cancel', targetType: 'inpatient_task', targetId: task._id, status: 'success', message: 'Hủy inpatient task thành công.', requestMeta });
  emitInpatientEvent('inpatient.task.cancelled', { department_id: task.admission_id?.department_id, admission_id: task.admission_id?._id || task.admission_id, patient_id: task.patient_id, actor_id: actorUserId(actor), data: { task_id: task._id } });
  return getInpatientTaskDetail(task._id, actor);
}

async function bulkCreateInpatientTasks(payload = {}, actor = {}, requestMeta = {}) {
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  if (!tasks.length) throw createError('tasks là bắt buộc.', 400);
  const created = [];
  for (const taskPayload of tasks) {
    created.push(await createInpatientTask(taskPayload, actor, requestMeta));
  }
  return { items: created, created_count: created.length };
}

async function bulkAssignInpatientTasks(payload = {}, actor = {}, requestMeta = {}) {
  const taskIds = Array.isArray(payload.task_ids) ? payload.task_ids : [];
  const items = [];
  for (const taskId of taskIds) items.push(await assignInpatientTask(taskId, payload, actor, requestMeta));
  return { items, assigned_count: items.length };
}

async function bulkCompleteInpatientTasks(payload = {}, actor = {}, requestMeta = {}) {
  const taskIds = Array.isArray(payload.task_ids) ? payload.task_ids : [];
  const items = [];
  for (const taskId of taskIds) items.push(await completeInpatientTask(taskId, payload, actor, requestMeta));
  return { items, completed_count: items.length };
}

function medicationAdministrationDto(item = {}) {
  const dueMinutes = minutesFromNow(item.scheduled_at);
  return {
    administration_id: normalizeId(item),
    id: normalizeId(item),
    patient_id: normalizeId(item.patient_id),
    patient: patientDto(item.patient_id),
    encounter_id: normalizeId(item.encounter_id),
    admission_id: normalizeId(item.admission_id),
    admission: item.admission_id && typeof item.admission_id === 'object' ? item.admission_id : null,
    prescription_item_id: normalizeId(item.prescription_item_id),
    prescription_item: item.prescription_item_id && typeof item.prescription_item_id === 'object' ? item.prescription_item_id : null,
    medication_id: normalizeId(item.medication_id),
    medication: item.medication_id && typeof item.medication_id === 'object' ? item.medication_id : null,
    administered_by: normalizeId(item.administered_by),
    administered_by_user: userDto(item.administered_by),
    scheduled_at: item.scheduled_at,
    administered_at: item.administered_at,
    dose: item.dose,
    route: item.route,
    site: item.site,
    note: item.note,
    reason_not_given: item.reason_not_given,
    status: item.status,
    due_minutes: dueMinutes,
    is_due_now: item.status === ADMINISTRATION_STATUS.SCHEDULED && dueMinutes !== null && dueMinutes >= -30 && dueMinutes <= 60,
    is_overdue: item.status === ADMINISTRATION_STATUS.SCHEDULED && dueMinutes !== null && dueMinutes < -30,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

async function listMedicationAdministrations(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.MEDICATION_ADMINISTRATIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PRESCRIPTIONS.READ]);
  const { page, limit, skip } = getPagination({ ...query, limit: query.limit || 50 }, 50, 200);
  let filter = {};
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'prescription_item_id', 'medication_id']) {
    if (query[field]) filter[field] = toObjectId(query[field], field);
  }
  const statuses = csv(query.status);
  if (statuses.length) filter.status = { $in: statuses };
  if (query.date) {
    const { start, end } = dateWindow(query.date);
    filter.scheduled_at = { $gte: start, $lte: end };
  }
  if (parseBoolean(query.due_now)) {
    filter.status = ADMINISTRATION_STATUS.SCHEDULED;
    filter.scheduled_at = { $gte: new Date(Date.now() - 30 * 60000), $lte: new Date(Date.now() + 60 * 60000) };
  }
  if (parseBoolean(query.overdue)) {
    filter.status = ADMINISTRATION_STATUS.SCHEDULED;
    filter.scheduled_at = { $lt: new Date(Date.now() - 30 * 60000) };
  }
  const departmentId = query.department_id || scopedDepartmentId(actor, [PERMISSION.ADMISSIONS.READ, PERMISSION.PRESCRIPTIONS.READ]);
  if (departmentId && !filter.admission_id) {
    const admissions = await Admission.find({ department_id: toObjectId(departmentId, 'department_id'), status: { $in: ACTIVE_ADMISSION_STATUSES } }).select('_id').lean();
    filter.admission_id = { $in: admissions.map((admission) => admission._id) };
  }

  const [items, total] = await Promise.all([
    MedicationAdministration.find(filter)
      .sort({ scheduled_at: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth')
      .populate('admission_id', 'admission_no status department_id')
      .populate('prescription_item_id', 'dose frequency route instructions status')
      .populate('medication_id', 'medication_code name generic_name strength dosage_form')
      .populate('administered_by', 'full_name username employee_code')
      .lean(),
    MedicationAdministration.countDocuments(filter),
  ]);
  const dtoItems = items.map(medicationAdministrationDto);
  return {
    items: dtoItems,
    summary: {
      total,
      due_now: dtoItems.filter((item) => item.is_due_now).length,
      overdue: dtoItems.filter((item) => item.is_overdue).length,
      given: dtoItems.filter((item) => item.status === ADMINISTRATION_STATUS.GIVEN).length,
      held: dtoItems.filter((item) => item.status === ADMINISTRATION_STATUS.HELD).length,
      refused: dtoItems.filter((item) => item.status === ADMINISTRATION_STATUS.REFUSED).length,
      omitted: dtoItems.filter((item) => item.status === ADMINISTRATION_STATUS.OMITTED).length,
    },
    pagination: buildPagination(page, limit, total),
  };
}

async function getMedicationAdministrationDetail(administrationId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.MEDICATION_ADMINISTRATIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PRESCRIPTIONS.READ]);
  const item = await MedicationAdministration.findById(administrationId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth')
    .populate('admission_id', 'admission_no status department_id')
    .populate('prescription_item_id', 'dose frequency route instructions status')
    .populate('medication_id', 'medication_code name generic_name strength dosage_form')
    .populate('administered_by', 'full_name username employee_code')
    .lean();
  if (!item) throw createError('Không tìm thấy medication administration.', 404);
  assertDepartmentAccess(actor, item.admission_id?.department_id, [
    PERMISSION.ADMISSIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ,
  ], 'Bạn không có quyền xem eMAR khoa này.');
  return medicationAdministrationDto(item);
}

async function transitionMedicationAdministration(administrationId, nextStatus, payload = {}, actor = {}, requestMeta = {}) {
  const writePermissions = [
    PERMISSION.MEDICATION_ADMINISTRATIONS.ADMINISTER,
    PERMISSION.MEDICATION_ADMINISTRATIONS.HOLD,
    PERMISSION.MEDICATION_ADMINISTRATIONS.REFUSE,
    PERMISSION.MEDICATION_ADMINISTRATIONS.OMIT,
  ];
  assertStaffPermission(actor, writePermissions);
  const item = await MedicationAdministration.findById(administrationId).populate('admission_id');
  if (!item) throw createError('Không tìm thấy medication administration.', 404);
  assertDepartmentAccess(actor, item.admission_id?.department_id, [
    PERMISSION.ADMISSIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ,
  ], 'Bạn không có quyền cập nhật eMAR khoa này.');
  if (!ACTIONABLE_ADMINISTRATION_STATUSES.includes(item.status) && nextStatus !== ADMINISTRATION_STATUS.ENTERED_IN_ERROR) {
    throw createError('Medication administration không còn ở trạng thái có thể cập nhật.', 409);
  }
  item.status = nextStatus;
  item.note = normalizeString(payload.note || item.note);
  if (nextStatus === ADMINISTRATION_STATUS.GIVEN) {
    item.administered_by = actorUserId(actor);
    item.administered_at = parseDate(payload.administered_at, 'administered_at') || new Date();
    if (payload.dose !== undefined) item.dose = normalizeString(payload.dose);
    if (payload.route !== undefined) item.route = normalizeString(payload.route);
    if (payload.site !== undefined) item.site = normalizeString(payload.site);
  } else {
    item.reason_not_given = normalizeString(payload.reason_not_given || payload.reason || item.reason_not_given);
  }
  item.updated_by = actorUserId(actor);
  await item.save();
  const eventByStatus = {
    [ADMINISTRATION_STATUS.GIVEN]: 'inpatient.medication.administered',
    [ADMINISTRATION_STATUS.HELD]: 'inpatient.medication.held',
    [ADMINISTRATION_STATUS.REFUSED]: 'inpatient.medication.refused',
    [ADMINISTRATION_STATUS.OMITTED]: 'inpatient.medication.omitted',
    [ADMINISTRATION_STATUS.ENTERED_IN_ERROR]: 'inpatient.medication.entered_in_error',
  };
  await recordAuditLog({ actor, action: `medication_administration.${nextStatus}`, targetType: 'medication_administration', targetId: item._id, status: 'success', message: 'Cập nhật medication administration thành công.', requestMeta });
  emitInpatientEvent(eventByStatus[nextStatus] || 'inpatient.medication.updated', {
    department_id: item.admission_id?.department_id,
    admission_id: item.admission_id?._id || item.admission_id,
    patient_id: item.patient_id,
    actor_id: actorUserId(actor),
    data: { administration_id: item._id, status: nextStatus },
  });
  return getMedicationAdministrationDetail(item._id, actor);
}

async function rescheduleMedicationAdministration(administrationId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.MEDICATION_ADMINISTRATIONS.HOLD, PERMISSION.MEDICATION_ADMINISTRATIONS.ADMINISTER]);
  const item = await MedicationAdministration.findById(administrationId).populate('admission_id');
  if (!item) throw createError('Không tìm thấy medication administration.', 404);
  assertDepartmentAccess(actor, item.admission_id?.department_id, [
    PERMISSION.ADMISSIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ,
  ], 'Bạn không có quyền reschedule eMAR khoa này.');
  item.scheduled_at = parseDate(payload.scheduled_at, 'scheduled_at');
  if (!item.scheduled_at) throw createError('scheduled_at là bắt buộc.', 400);
  item.status = ADMINISTRATION_STATUS.SCHEDULED;
  item.reason_not_given = undefined;
  item.note = normalizeString(payload.note || item.note);
  item.updated_by = actorUserId(actor);
  await item.save();
  await recordAuditLog({ actor, action: 'medication_administration.reschedule', targetType: 'medication_administration', targetId: item._id, status: 'success', message: 'Reschedule medication administration thành công.', requestMeta });
  return getMedicationAdministrationDetail(item._id, actor);
}

async function generateMedicationScheduleFromPrescription(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.MEDICATION_ADMINISTRATIONS.ADMINISTER, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT]);
  const scheduleTimes = (Array.isArray(payload.scheduled_times) && payload.scheduled_times.length ? payload.scheduled_times : [payload.scheduled_at || new Date()])
    .map((value) => parseDate(value, 'scheduled_at') || new Date());
  let prescriptionItems = [];
  let prescription = null;
  if (payload.prescription_id) {
    prescription = await Prescription.findById(payload.prescription_id).lean();
    if (!prescription) throw createError('Không tìm thấy prescription.', 404);
    prescriptionItems = await PrescriptionItem.find({ prescription_id: prescription._id }).lean();
  } else if (Array.isArray(payload.prescription_item_ids) && payload.prescription_item_ids.length) {
    prescriptionItems = await PrescriptionItem.find({ _id: { $in: payload.prescription_item_ids.map((id) => toObjectId(id, 'prescription_item_id')) } }).lean();
    if (prescriptionItems[0]) prescription = await Prescription.findById(prescriptionItems[0].prescription_id).lean();
  }
  if (!prescriptionItems.length) throw createError('Không có prescription item để tạo eMAR.', 400);
  if (!prescription) throw createError('Không tìm thấy prescription nguồn.', 404);
  const admission = payload.admission_id
    ? await Admission.findById(payload.admission_id).lean()
    : await Admission.findOne({ encounter_id: prescription.encounter_id, status: { $in: ACTIVE_ADMISSION_STATUSES } }).lean();
  if (!admission) throw createError('Không tìm thấy admission nội trú active cho prescription.', 409);
  assertDepartmentAccess(actor, admission.department_id, [
    PERMISSION.ADMISSIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ,
  ], 'Bạn không có quyền tạo lịch eMAR cho khoa này.');

  const created = [];
  for (const item of prescriptionItems) {
    for (const scheduledAt of scheduleTimes) {
      const duplicate = await MedicationAdministration.exists({
        prescription_item_id: item._id,
        admission_id: admission._id,
        scheduled_at: scheduledAt,
      });
      if (duplicate) continue;
      const doc = await MedicationAdministration.create({
        patient_id: prescription.patient_id,
        encounter_id: prescription.encounter_id,
        admission_id: admission._id,
        prescription_item_id: item._id,
        medication_id: item.medication_id,
        scheduled_at: scheduledAt,
        dose: item.dose,
        route: item.route,
        status: ADMINISTRATION_STATUS.SCHEDULED,
        note: normalizeString(payload.note),
        created_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      });
      created.push(doc);
    }
  }
  await recordAuditLog({ actor, action: 'medication_administration.generate_from_prescription', targetType: 'admission', targetId: admission._id, status: 'success', message: 'Tạo lịch eMAR từ prescription thành công.', requestMeta, metadata: { created_count: created.length } });
  return { created_count: created.length, items: await Promise.all(created.map((item) => getMedicationAdministrationDetail(item._id, actor))) };
}

async function verifyMedicationScan(payload = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.MEDICATION_ADMINISTRATIONS.READ, PERMISSION.MEDICATION_ADMINISTRATIONS.ADMINISTER]);
  const administration = await MedicationAdministration.findById(payload.administration_id)
    .populate('patient_id', 'patient_code full_name')
    .populate('admission_id', 'admission_no department_id')
    .populate('medication_id', 'medication_code name generic_name')
    .lean();
  if (!administration) throw createError('Không tìm thấy medication administration.', 404);
  assertDepartmentAccess(actor, administration.admission_id?.department_id, [
    PERMISSION.ADMISSIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ,
  ], 'Bạn không có quyền verify eMAR khoa này.');
  const patientMatch = !payload.patient_id || sameId(payload.patient_id, administration.patient_id);
  const admissionMatch = !payload.admission_id || sameId(payload.admission_id, administration.admission_id);
  const medicationMatch = !payload.medication_id || sameId(payload.medication_id, administration.medication_id);
  const dueMinutes = minutesFromNow(administration.scheduled_at);
  const timeWindowValid = dueMinutes !== null && dueMinutes >= -120 && dueMinutes <= 120;
  const warnings = [];
  if (!timeWindowValid) warnings.push(`Thuốc lệch khung giờ ${Math.abs(dueMinutes || 0)} phút.`);
  if (!patientMatch) warnings.push('QR bệnh nhân không khớp.');
  if (!medicationMatch) warnings.push('Mã thuốc không khớp.');
  if (!admissionMatch) warnings.push('Admission không khớp.');
  return {
    valid: patientMatch && admissionMatch && medicationMatch,
    patient_match: patientMatch,
    admission_match: admissionMatch,
    medication_match: medicationMatch,
    time_window_valid: timeWindowValid,
    dose_match: !payload.dose || normalizeString(payload.dose) === normalizeString(administration.dose),
    route_match: !payload.route || normalizeString(payload.route) === normalizeString(administration.route),
    warnings,
    administration: medicationAdministrationDto(administration),
    patient: patientDto(administration.patient_id),
    medication: administration.medication_id,
  };
}

function handoverDto(handover = {}) {
  return {
    handover_id: normalizeId(handover),
    id: normalizeId(handover),
    handover_no: handover.handover_no,
    department_id: normalizeId(handover.department_id),
    department: departmentDto(handover.department_id),
    shift_date: handover.shift_date,
    from_shift: handover.from_shift,
    to_shift: handover.to_shift,
    outgoing_nurse_id: normalizeId(handover.outgoing_nurse_id),
    outgoing_nurse: userDto(handover.outgoing_nurse_id),
    incoming_nurse_id: normalizeId(handover.incoming_nurse_id),
    incoming_nurse: userDto(handover.incoming_nurse_id),
    status: handover.status,
    summary: handover.summary,
    patient_count: handover.patient_count || 0,
    high_risk_count: handover.high_risk_count || 0,
    abnormal_vital_count: handover.abnormal_vital_count || 0,
    overdue_task_count: handover.overdue_task_count || 0,
    medication_due_count: handover.medication_due_count || 0,
    items: (handover.items || []).map((item) => ({
      item_id: normalizeId(item),
      admission_id: normalizeId(item.admission_id),
      patient_id: normalizeId(item.patient_id),
      bed_assignment_id: normalizeId(item.bed_assignment_id),
      room_id: normalizeId(item.room_id),
      bed_id: normalizeId(item.bed_id),
      priority: item.priority,
      situation: item.situation,
      background: item.background,
      assessment: item.assessment,
      recommendation: item.recommendation,
      open_tasks: item.open_tasks || [],
      medication_warnings: item.medication_warnings || [],
      vital_warnings: item.vital_warnings || [],
      nursing_note: item.nursing_note,
      acknowledged: Boolean(item.acknowledged),
      acknowledged_at: item.acknowledged_at,
      acknowledged_by: normalizeId(item.acknowledged_by),
    })),
    signed_at: handover.signed_at,
    acknowledged_at: handover.acknowledged_at,
    closed_at: handover.closed_at,
    created_at: handover.created_at,
    updated_at: handover.updated_at,
  };
}

function populateHandover(query) {
  return query
    .populate('department_id', 'department_code department_name')
    .populate('outgoing_nurse_id', 'full_name username employee_code')
    .populate('incoming_nurse_id', 'full_name username employee_code');
}

async function listInpatientHandovers(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_HANDOVERS.READ, PERMISSION.INPATIENT_HANDOVERS.READ_DEPARTMENT, PERMISSION.INPATIENT_HANDOVERS.MANAGE]);
  const { page, limit, skip } = getPagination({ ...query, limit: query.limit || 30 }, 30, 100);
  const filter = {};
  if (query.department_id) filter.department_id = toObjectId(query.department_id, 'department_id');
  if (query.status) filter.status = { $in: csv(query.status) };
  if (query.shift_date || query.date) {
    const { start, end } = dateWindow(query.shift_date || query.date);
    filter.shift_date = { $gte: start, $lte: end };
  }
  const departmentScope = scopedDepartmentId(actor, [PERMISSION.INPATIENT_HANDOVERS.READ, PERMISSION.INPATIENT_HANDOVERS.MANAGE]);
  if (departmentScope && !filter.department_id) filter.department_id = toObjectId(departmentScope, 'department_id');
  if (departmentScope && filter.department_id && !sameId(departmentScope, filter.department_id)) throw createError('Bạn không có quyền xem bàn giao khoa này.', 403);

  const [items, total] = await Promise.all([
    populateHandover(InpatientHandover.find(filter).sort({ shift_date: -1, created_at: -1 }).skip(skip).limit(limit)).lean(),
    InpatientHandover.countDocuments(filter),
  ]);
  return {
    items: items.map(handoverDto),
    summary: {
      total,
      draft: items.filter((item) => item.status === 'draft').length,
      prepared: items.filter((item) => item.status === 'prepared').length,
      signed: items.filter((item) => item.status === 'signed').length,
      acknowledged: items.filter((item) => item.status === 'acknowledged').length,
      closed: items.filter((item) => item.status === 'closed').length,
      high_risk: items.reduce((sum, item) => sum + (item.high_risk_count || 0), 0),
      overdue_tasks: items.reduce((sum, item) => sum + (item.overdue_task_count || 0), 0),
    },
    pagination: buildPagination(page, limit, total),
  };
}

async function getInpatientHandoverDetail(handoverId, actor = {}) {
  const handover = await populateHandover(InpatientHandover.findById(handoverId)).lean();
  if (!handover) throw createError('Không tìm thấy handover.', 404);
  assertDepartmentAccess(actor, handover.department_id, [
    PERMISSION.INPATIENT_HANDOVERS.READ,
    PERMISSION.INPATIENT_HANDOVERS.MANAGE,
  ], 'Bạn không có quyền xem bàn giao khoa này.');
  return handoverDto(handover);
}

async function createInpatientHandover(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_HANDOVERS.CREATE, PERMISSION.INPATIENT_HANDOVERS.MANAGE]);
  const departmentId = payload.department_id || actorDepartmentId(actor);
  if (!departmentId) throw createError('department_id là bắt buộc.', 400);
  assertDepartmentAccess(actor, departmentId, [
    PERMISSION.INPATIENT_HANDOVERS.MANAGE,
  ], 'Bạn không có quyền tạo bàn giao khoa này.');
  const handover = await InpatientHandover.create({
    department_id: toObjectId(departmentId, 'department_id'),
    shift_date: parseDate(payload.shift_date || payload.date || new Date(), 'shift_date'),
    from_shift: payload.from_shift || 'morning',
    to_shift: payload.to_shift || 'afternoon',
    outgoing_nurse_id: payload.outgoing_nurse_id || actorUserId(actor),
    incoming_nurse_id: payload.incoming_nurse_id || undefined,
    status: payload.status || 'draft',
    summary: normalizeString(payload.summary),
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'inpatient_handover.create', targetType: 'inpatient_handover', targetId: handover._id, status: 'success', message: 'Tạo inpatient handover thành công.', requestMeta });
  emitInpatientEvent('inpatient.handover.created', { department_id: handover.department_id, actor_id: actorUserId(actor), data: { handover_id: handover._id } });
  return getInpatientHandoverDetail(handover._id, actor);
}

function sbarFromWardItem(item = {}) {
  const patientName = item.patient?.full_name || 'Bệnh nhân';
  const bedLabel = [item.room?.room_code, item.bed?.bed_code].filter(Boolean).join(' / ') || 'chưa có giường';
  const vitals = item.latest_vitals;
  const vitalText = vitals
    ? `HA ${vitals.systolic_bp ?? '--'}/${vitals.diastolic_bp ?? '--'}, mạch ${vitals.heart_rate ?? '--'}, SpO2 ${vitals.spo2 ?? '--'}%, nhiệt ${vitals.temperature ?? '--'}`
    : 'Chưa có sinh hiệu mới.';
  return {
    situation: `${patientName} đang nằm ${bedLabel}, trạng thái ${item.admission?.status || '--'}.`,
    background: `Admission ${item.admission?.admission_no || '--'}, lý do: ${item.admission?.reason || 'chưa ghi nhận'}.`,
    assessment: `Sinh hiệu mới nhất: ${vitalText}. Task mở ${item.open_tasks_count}, quá hạn ${item.overdue_tasks_count}.`,
    recommendation: item.overdue_tasks_count > 0
      ? 'Ưu tiên xử lý task quá hạn và báo bác sĩ nếu tình trạng xấu đi.'
      : 'Tiếp tục theo dõi trong ca tới theo kế hoạch chăm sóc.',
  };
}

async function generateInpatientHandover(handoverId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_HANDOVERS.CREATE, PERMISSION.INPATIENT_HANDOVERS.UPDATE, PERMISSION.INPATIENT_HANDOVERS.MANAGE]);
  const handover = await InpatientHandover.findById(handoverId);
  if (!handover) throw createError('Không tìm thấy handover.', 404);
  assertDepartmentAccess(actor, handover.department_id, [
    PERMISSION.INPATIENT_HANDOVERS.MANAGE,
  ], 'Bạn không có quyền generate bàn giao khoa này.');
  const board = await getWardBoard({ department_id: handover.department_id, limit: 300 }, actor);
  const items = board.items.map((item) => {
    const sbar = sbarFromWardItem(item);
    const priority = item.high_risk ? (item.vital_alerts.some((alert) => alert.level === 'critical') ? 'critical' : 'urgent') : 'normal';
    return {
      admission_id: item.admission_id,
      patient_id: item.patient?.patient_id,
      bed_assignment_id: normalizeId(item.current_bed_assignment),
      room_id: item.room?.room_id,
      bed_id: item.bed?.bed_id,
      priority,
      ...sbar,
      open_tasks: [{ count: item.open_tasks_count, overdue: item.overdue_tasks_count }],
      medication_warnings: [{ due: item.medication_due_count, overdue: item.medication_overdue_count }].filter((row) => row.due || row.overdue),
      vital_warnings: item.vital_alerts,
      nursing_note: item.latest_nursing_note?.content || item.admission?.nursing_note_summary || '',
    };
  });
  handover.items = items;
  handover.patient_count = items.length;
  handover.high_risk_count = items.filter((item) => ['urgent', 'critical'].includes(item.priority)).length;
  handover.abnormal_vital_count = board.summary.abnormal_vitals;
  handover.overdue_task_count = board.summary.overdue_tasks;
  handover.medication_due_count = board.summary.medication_due_now + board.summary.medication_overdue;
  handover.status = 'prepared';
  handover.summary = normalizeString(payload.summary) || `Bàn giao ${items.length} bệnh nhân, ${handover.high_risk_count} nguy cơ cao, ${handover.overdue_task_count} task quá hạn.`;
  handover.updated_by = actorUserId(actor);
  await handover.save();
  await recordAuditLog({ actor, action: 'inpatient_handover.generate', targetType: 'inpatient_handover', targetId: handover._id, status: 'success', message: 'Generate inpatient handover thành công.', requestMeta });
  emitInpatientEvent('inpatient.handover.generated', { department_id: handover.department_id, actor_id: actorUserId(actor), data: { handover_id: handover._id } });
  return getInpatientHandoverDetail(handover._id, actor);
}

async function updateInpatientHandover(handoverId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_HANDOVERS.UPDATE, PERMISSION.INPATIENT_HANDOVERS.MANAGE]);
  const handover = await InpatientHandover.findById(handoverId);
  if (!handover) throw createError('Không tìm thấy handover.', 404);
  assertDepartmentAccess(actor, handover.department_id, [
    PERMISSION.INPATIENT_HANDOVERS.MANAGE,
  ], 'Bạn không có quyền cập nhật bàn giao khoa này.');
  for (const field of ['summary', 'from_shift', 'to_shift', 'incoming_nurse_id', 'outgoing_nurse_id']) {
    if (payload[field] !== undefined) handover[field] = field === 'summary' ? normalizeString(payload[field]) : payload[field];
  }
  handover.updated_by = actorUserId(actor);
  await handover.save();
  await recordAuditLog({ actor, action: 'inpatient_handover.update', targetType: 'inpatient_handover', targetId: handover._id, status: 'success', message: 'Cập nhật inpatient handover thành công.', requestMeta });
  return getInpatientHandoverDetail(handover._id, actor);
}

async function transitionHandover(handoverId, nextStatus, payload = {}, actor = {}, requestMeta = {}) {
  const permissionByStatus = {
    signed: [PERMISSION.INPATIENT_HANDOVERS.SIGN, PERMISSION.INPATIENT_HANDOVERS.MANAGE],
    acknowledged: [PERMISSION.INPATIENT_HANDOVERS.ACKNOWLEDGE, PERMISSION.INPATIENT_HANDOVERS.MANAGE],
    closed: [PERMISSION.INPATIENT_HANDOVERS.CLOSE, PERMISSION.INPATIENT_HANDOVERS.MANAGE],
    reopened: [PERMISSION.INPATIENT_HANDOVERS.REOPEN, PERMISSION.INPATIENT_HANDOVERS.MANAGE],
  };
  assertStaffPermission(actor, permissionByStatus[nextStatus] || [PERMISSION.INPATIENT_HANDOVERS.MANAGE]);
  const handover = await InpatientHandover.findById(handoverId);
  if (!handover) throw createError('Không tìm thấy handover.', 404);
  assertDepartmentAccess(actor, handover.department_id, [
    PERMISSION.INPATIENT_HANDOVERS.MANAGE,
  ], 'Bạn không có quyền cập nhật trạng thái bàn giao khoa này.');
  const now = new Date();
  if (nextStatus === 'signed') {
    if (!['draft', 'prepared', 'reopened'].includes(handover.status)) throw createError('Chỉ draft/prepared/reopened mới được ký.', 409);
    handover.signed_at = now;
    handover.signed_by = actorUserId(actor);
  }
  if (nextStatus === 'acknowledged') {
    if (!['signed', 'prepared'].includes(handover.status)) throw createError('Handover phải signed/prepared trước khi acknowledge.', 409);
    handover.acknowledged_at = now;
    handover.acknowledged_by = actorUserId(actor);
    handover.items.forEach((item) => {
      item.acknowledged = true;
      item.acknowledged_at = now;
      item.acknowledged_by = actorUserId(actor);
    });
  }
  if (nextStatus === 'closed') {
    if (!['signed', 'acknowledged'].includes(handover.status)) throw createError('Handover phải signed/acknowledged trước khi close.', 409);
    handover.closed_at = now;
    handover.closed_by = actorUserId(actor);
  }
  if (nextStatus === 'reopened') {
    if (!['closed', 'acknowledged', 'signed'].includes(handover.status)) throw createError('Chỉ handover đã xử lý mới được reopen.', 409);
    handover.reopened_at = now;
    handover.reopened_by = actorUserId(actor);
    handover.reopen_reason = normalizeString(payload.reason || payload.reopen_reason);
  }
  handover.status = nextStatus;
  handover.updated_by = actorUserId(actor);
  await handover.save();
  await recordAuditLog({ actor, action: `inpatient_handover.${nextStatus}`, targetType: 'inpatient_handover', targetId: handover._id, status: 'success', message: 'Cập nhật trạng thái handover thành công.', requestMeta });
  emitInpatientEvent(`inpatient.handover.${nextStatus}`, { department_id: handover.department_id, actor_id: actorUserId(actor), data: { handover_id: handover._id } });
  return getInpatientHandoverDetail(handover._id, actor);
}

async function acknowledgeHandoverItem(handoverId, itemId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_HANDOVERS.ACKNOWLEDGE, PERMISSION.INPATIENT_HANDOVERS.MANAGE]);
  const handover = await InpatientHandover.findById(handoverId);
  if (!handover) throw createError('Không tìm thấy handover.', 404);
  assertDepartmentAccess(actor, handover.department_id, [
    PERMISSION.INPATIENT_HANDOVERS.MANAGE,
  ], 'Bạn không có quyền xác nhận bàn giao khoa này.');
  const item = handover.items.id(itemId);
  if (!item) throw createError('Không tìm thấy item bàn giao.', 404);
  item.acknowledged = true;
  item.acknowledged_at = parseDate(payload.acknowledged_at, 'acknowledged_at') || new Date();
  item.acknowledged_by = actorUserId(actor);
  if (payload.note !== undefined) item.nursing_note = normalizeString(payload.note);
  handover.updated_by = actorUserId(actor);
  await handover.save();
  await recordAuditLog({ actor, action: 'inpatient_handover.item_acknowledge', targetType: 'inpatient_handover', targetId: handover._id, status: 'success', message: 'Ack item handover thành công.', requestMeta, metadata: { item_id: itemId } });
  return getInpatientHandoverDetail(handover._id, actor);
}

async function updateHandoverItem(handoverId, itemId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_HANDOVERS.UPDATE, PERMISSION.INPATIENT_HANDOVERS.MANAGE]);
  const handover = await InpatientHandover.findById(handoverId);
  if (!handover) throw createError('Không tìm thấy handover.', 404);
  assertDepartmentAccess(actor, handover.department_id, [
    PERMISSION.INPATIENT_HANDOVERS.MANAGE,
  ], 'Bạn không có quyền cập nhật item bàn giao khoa này.');
  const item = handover.items.id(itemId);
  if (!item) throw createError('Không tìm thấy item bàn giao.', 404);
  ['priority', 'situation', 'background', 'assessment', 'recommendation', 'nursing_note'].forEach((field) => {
    if (payload[field] !== undefined) item[field] = ['situation', 'background', 'assessment', 'recommendation', 'nursing_note'].includes(field) ? normalizeString(payload[field]) : payload[field];
  });
  handover.updated_by = actorUserId(actor);
  await handover.save();
  await recordAuditLog({ actor, action: 'inpatient_handover.item_update', targetType: 'inpatient_handover', targetId: handover._id, status: 'success', message: 'Cập nhật item handover thành công.', requestMeta, metadata: { item_id: itemId } });
  return getInpatientHandoverDetail(handover._id, actor);
}

module.exports = {
  getWardBoard,
  getWardMap,
  getDischargeReadiness,
  validateBedAssignmentPreview,
  getBedSuggestions,

  listInpatientTasks,
  getInpatientTaskDetail,
  createInpatientTask,
  updateInpatientTask,
  startInpatientTask,
  completeInpatientTask,
  cancelInpatientTask,
  assignInpatientTask,
  bulkCreateInpatientTasks,
  bulkAssignInpatientTasks,
  bulkCompleteInpatientTasks,

  listMedicationAdministrations,
  getMedicationAdministrationDetail,
  generateMedicationScheduleFromPrescription,
  administerMedication: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, ADMINISTRATION_STATUS.GIVEN, payload, actor, requestMeta),
  holdMedication: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, ADMINISTRATION_STATUS.HELD, payload, actor, requestMeta),
  refuseMedication: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, ADMINISTRATION_STATUS.REFUSED, payload, actor, requestMeta),
  omitMedication: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, ADMINISTRATION_STATUS.OMITTED, payload, actor, requestMeta),
  markMedicationEnteredInError: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, ADMINISTRATION_STATUS.ENTERED_IN_ERROR, payload, actor, requestMeta),
  rescheduleMedicationAdministration,
  verifyMedicationScan,

  listInpatientHandovers,
  getInpatientHandoverDetail,
  createInpatientHandover,
  updateInpatientHandover,
  generateInpatientHandover,
  signInpatientHandover: (id, payload, actor, requestMeta) => transitionHandover(id, 'signed', payload, actor, requestMeta),
  acknowledgeInpatientHandover: (id, payload, actor, requestMeta) => transitionHandover(id, 'acknowledged', payload, actor, requestMeta),
  closeInpatientHandover: (id, payload, actor, requestMeta) => transitionHandover(id, 'closed', payload, actor, requestMeta),
  reopenInpatientHandover: (id, payload, actor, requestMeta) => transitionHandover(id, 'reopened', payload, actor, requestMeta),
  acknowledgeHandoverItem,
  updateHandoverItem,
};
