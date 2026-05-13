const {
  Allergy,
  CarePlan,
  ClinicalNote,
  Consultation,
  Diagnosis,
  Encounter,
  Patient,
  ProblemList,
  VitalSign,
} = require('../models');
const {
  buildPagination,
  createError,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const {
  ALLERGY_SEVERITIES,
  ALLERGY_SEVERITY,
  ALLERGY_STATUS,
  ALLERGY_TYPES,
  CARE_PLAN_STATUS,
  CLINICAL_NOTE_STATUS,
  CONSULTATION_STATUS,
  DIAGNOSIS_STATUS,
  DIAGNOSIS_TYPES,
  ENCOUNTER_STATUS,
  PROBLEM_SEVERITIES,
  PROBLEM_SEVERITY,
  PROBLEM_STATUS,
  VITAL_SIGN_STATUS,
} = require('../constants/statuses');
const {
  CARE_PLAN_TRANSITIONS,
  CLINICAL_NOTE_TRANSITIONS,
  CONSULTATION_TRANSITIONS,
} = require('../constants/transitions');
const { assertTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');
const { PERMISSION } = require('../constants/permissions');
const permissionService = require('./permission.service');

const CLINICAL_EDITABLE_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const DIRECT_EDIT_DOCUMENT_STATUSES = [
  CONSULTATION_STATUS.DRAFT,
  CONSULTATION_STATUS.IN_PROGRESS,
  CONSULTATION_STATUS.AMENDED,
];

const DIRECT_EDIT_NOTE_STATUSES = [
  CLINICAL_NOTE_STATUS.DRAFT,
  CLINICAL_NOTE_STATUS.IN_PROGRESS,
  CLINICAL_NOTE_STATUS.AMENDED,
];

const SIGNABLE_DOCUMENT_STATUSES = [
  CONSULTATION_STATUS.DRAFT,
  CONSULTATION_STATUS.IN_PROGRESS,
  CONSULTATION_STATUS.AMENDED,
];

const SIGNABLE_NOTE_STATUSES = [
  CLINICAL_NOTE_STATUS.DRAFT,
  CLINICAL_NOTE_STATUS.IN_PROGRESS,
  CLINICAL_NOTE_STATUS.AMENDED,
];

const VITAL_SIGN_FIELDS = [
  'temperature',
  'heart_rate',
  'respiratory_rate',
  'systolic_bp',
  'diastolic_bp',
  'spo2',
  'weight',
  'height',
];

const ALLERGY_SEVERITY_WEIGHT = {
  life_threatening: 5,
  severe: 4,
  moderate: 3,
  mild: 2,
  unknown: 1,
};

const PROBLEM_SEVERITY_WEIGHT = {
  severe: 4,
  moderate: 3,
  mild: 2,
  unknown: 1,
};

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function sameId(left, right) {
  return String(left?._id || left || '') === String(right?._id || right || '');
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : [];
}

function hasRole(actor = {}, roleCode) {
  return actorRoles(actor).includes(roleCode);
}

function hasGlobalClinicalScope(actor = {}) {
  return hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
    || hasRole(actor, 'super_admin')
    || hasRole(actor, 'admin')
    || hasRole(actor, 'manager');
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes);
}

function assertActorUser(actor = {}) {
  if (!actor?.userId) throw createError('Actor hiện tại không phải staff user hợp lệ.', 403);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function nonEmpty(value) {
  return normalizeString(value).length > 0;
}

function ensureEnum(value, allowed, fieldName) {
  if (value !== undefined && value !== null && value !== '' && !allowed.includes(value)) {
    throw createError(`${fieldName} không hợp lệ.`);
  }
}

function validateStatusTransition(transitions, currentStatus, nextStatus, entityName) {
  if (currentStatus === nextStatus) return true;
  return assertTransition(transitions, currentStatus, nextStatus, entityName);
}

async function generateConsultationNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.CONSULTATION, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function generateCarePlanNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.CARE_PLAN, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

function validateConsultationStatusTransition(currentStatus, nextStatus) {
  return validateStatusTransition(CONSULTATION_TRANSITIONS, currentStatus, nextStatus, 'consultation');
}

function validateClinicalNoteStatusTransition(currentStatus, nextStatus) {
  return validateStatusTransition(CLINICAL_NOTE_TRANSITIONS, currentStatus, nextStatus, 'clinical note');
}

function validateCarePlanStatusTransition(currentStatus, nextStatus) {
  return validateStatusTransition(CARE_PLAN_TRANSITIONS, currentStatus, nextStatus, 'care plan');
}

function assertEncounterAccess(encounter, actor = {}, options = {}) {
  if (!actorType(actor)) return true;
  if (hasGlobalClinicalScope(actor)) return true;

  if (hasRole(actor, 'doctor')) {
    if (
      actor.userId
      && sameId(encounter.attending_doctor_id, actor.userId)
      && hasAnyPermission(actor, options.ownPermissions || [])
    ) {
      return true;
    }
    throw createError('Bác sĩ chỉ được thao tác dữ liệu lâm sàng của encounter do mình phụ trách.', 403);
  }

  if (hasAnyPermission(actor, options.globalPermissions || [])) return true;

  if (
    actor.userId
    && sameId(encounter.attending_doctor_id, actor.userId)
    && hasAnyPermission(actor, options.ownPermissions || [])
  ) {
    return true;
  }

  const departmentId = actorDepartmentId(actor);
  if (
    departmentId
    && sameId(encounter.department_id, departmentId)
    && hasAnyPermission(actor, options.departmentPermissions || [])
  ) {
    return true;
  }

  throw createError('Bạn không có quyền thao tác dữ liệu lâm sàng của encounter này.', 403);
}

function assertEncounterClinicalEditable(encounter, options = {}) {
  const allowedStatuses = options.allowedStatuses || CLINICAL_EDITABLE_ENCOUNTER_STATUSES;
  if (!allowedStatuses.includes(encounter.status)) {
    throw createError('Encounter không ở trạng thái được phép ghi/sửa dữ liệu lâm sàng.', 409);
  }
}

async function getEncounterOrThrow(encounterId, session = null) {
  const encounter = await withSession(Encounter.findById(encounterId).lean(), session);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  return encounter;
}

async function assertPatientActive(patientId, session = null) {
  const patient = await withSession(Patient.findById(patientId).lean(), session);
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== 'active') throw createError('Bệnh nhân không active.', 409);
  return patient;
}

async function applyEncounterListScope(filter, actor = {}, options = {}) {
  if (!actorType(actor)) return;
  if (hasGlobalClinicalScope(actor)) return;

  const encounterFilter = {};
  if ((hasRole(actor, 'doctor') || actor.userId) && actor.userId && hasAnyPermission(actor, options.ownPermissions || [])) {
    encounterFilter.attending_doctor_id = actor.userId;
  } else if (hasRole(actor, 'doctor')) {
    throw createError('Bác sĩ chỉ được liệt kê dữ liệu lâm sàng của encounter do mình phụ trách.', 403);
  } else if (hasAnyPermission(actor, options.globalPermissions || [])) {
    return;
  } else {
    const departmentId = actorDepartmentId(actor);
    if (departmentId && hasAnyPermission(actor, options.departmentPermissions || [])) {
      encounterFilter.department_id = departmentId;
    } else {
      throw createError('Bạn không có quyền liệt kê dữ liệu lâm sàng ngoài phạm vi được cấp.', 403);
    }
  }

  const encounters = await Encounter.find(encounterFilter).select('_id').lean();
  filter.encounter_id = { $in: encounters.map((encounter) => encounter._id) };
}

function assertAuthorOrOverride(ownerId, actor = {}, overridePermissions = []) {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (actor?.userId && sameId(ownerId, actor.userId)) return true;
  if (hasAnyPermission(actor, overridePermissions)) return true;
  throw createError('Bạn không có quyền thao tác tài liệu lâm sàng này.', 403);
}

async function assertConsultationAccess(consultation, actor = {}, write = false) {
  const encounter = await getEncounterOrThrow(consultation.encounter_id);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: write
      ? [PERMISSION.CONSULTATIONS.UPDATE, PERMISSION.CONSULTATIONS.SIGN, PERMISSION.CONSULTATIONS.AMEND, PERMISSION.CONSULTATIONS.CANCEL]
      : [PERMISSION.CONSULTATIONS.READ, PERMISSION.ENCOUNTERS.READ],
    ownPermissions: write
      ? [PERMISSION.CONSULTATIONS.UPDATE_OWN, PERMISSION.CONSULTATIONS.SIGN_OWN, PERMISSION.CONSULTATIONS.AMEND_OWN]
      : [PERMISSION.CONSULTATIONS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.CONSULTATIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  return encounter;
}

async function assertClinicalNoteAccess(note, actor = {}, write = false) {
  const encounter = await getEncounterOrThrow(note.encounter_id);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: write
      ? [PERMISSION.CLINICAL_NOTES.WRITE, PERMISSION.CLINICAL_NOTES.SIGN, PERMISSION.CLINICAL_NOTES.AMEND]
      : [PERMISSION.CLINICAL_NOTES.READ, PERMISSION.ENCOUNTERS.READ],
    ownPermissions: write ? [PERMISSION.CLINICAL_NOTES.UPDATE_OWN] : [PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  return encounter;
}

async function assertCarePlanAccess(carePlan, actor = {}, write = false) {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (hasAnyPermission(actor, write
    ? [PERMISSION.CARE_PLANS.MANAGE, PERMISSION.CARE_PLANS.UPDATE, PERMISSION.CARE_PLANS.COMPLETE_TASK]
    : [PERMISSION.CARE_PLANS.READ, PERMISSION.CARE_PLANS.MANAGE, PERMISSION.ENCOUNTERS.READ])) {
    return true;
  }
  if (
    write
    && actor.userId
    && sameId(carePlan.created_by, actor.userId)
    && hasAnyPermission(actor, [PERMISSION.CARE_PLANS.UPDATE_OWN, PERMISSION.CARE_PLANS.COMPLETE_TASK])
  ) {
    return true;
  }
  if (carePlan.encounter_id) {
    const encounter = await getEncounterOrThrow(carePlan.encounter_id);
    assertEncounterAccess(encounter, actor, {
      globalPermissions: write
        ? [PERMISSION.CARE_PLANS.MANAGE, PERMISSION.CARE_PLANS.UPDATE, PERMISSION.CARE_PLANS.COMPLETE_TASK]
        : [PERMISSION.CARE_PLANS.READ, PERMISSION.ENCOUNTERS.READ],
      ownPermissions: write
        ? [PERMISSION.CARE_PLANS.UPDATE_OWN, PERMISSION.CARE_PLANS.COMPLETE_TASK]
        : [PERMISSION.ENCOUNTERS.READ_OWN],
      departmentPermissions: write
        ? [PERMISSION.CARE_PLANS.MANAGE, PERMISSION.CARE_PLANS.UPDATE, PERMISSION.CARE_PLANS.COMPLETE_TASK]
        : [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
    });
    return true;
  }
  throw createError('Bạn không có quyền thao tác care plan này.', 403);
}

async function validateConsultationCreation(payload, actor = {}, options = {}) {
  assertActorUser(actor);
  const encounter = await getEncounterOrThrow(payload.encounter_id, options.session);
  assertEncounterClinicalEditable(encounter, {
    allowedStatuses: [ENCOUNTER_STATUS.ARRIVED, ENCOUNTER_STATUS.IN_PROGRESS],
  });
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE],
    ownPermissions: [PERMISSION.CONSULTATIONS.CREATE],
    departmentPermissions: [],
  });

  if (payload.doctor_id && !sameId(payload.doctor_id, actor.userId) && !hasPermission(actor, PERMISSION.ENCOUNTERS.UPDATE)) {
    throw createError('Không được tạo consultation thay bác sĩ khác.', 403);
  }

  const existing = await withSession(Consultation.findOne({
    encounter_id: encounter._id,
    status: { $ne: CONSULTATION_STATUS.CANCELLED },
  }).lean(), options.session);
  if (existing && !payload.allow_multiple) {
    throw createError('Encounter đã có consultation chưa bị hủy.', 409);
  }

  return {
    encounter,
    normalized: {
      doctor_id: payload.doctor_id || actor.userId,
      chief_complaint: payload.chief_complaint,
      history_present_illness: payload.history_present_illness,
      physical_exam: payload.physical_exam,
      assessment: payload.assessment,
      plan: payload.plan,
      status: [CONSULTATION_STATUS.DRAFT, CONSULTATION_STATUS.IN_PROGRESS].includes(payload.status)
        ? payload.status
        : CONSULTATION_STATUS.DRAFT,
    },
  };
}

async function createConsultation(payload, actor, requestMeta = {}) {
  let consultationId;
  await withOptionalTransaction(async (session) => {
    const validation = await validateConsultationCreation(payload, actor, { session });
    const consultationNo = payload.consultation_no || await generateConsultationNumber({ session });
    const [consultation] = await Consultation.create([{
      encounter_id: validation.encounter._id,
      doctor_id: validation.normalized.doctor_id,
      consultation_no: consultationNo,
      chief_complaint: validation.normalized.chief_complaint,
      history_present_illness: validation.normalized.history_present_illness,
      physical_exam: validation.normalized.physical_exam,
      assessment: validation.normalized.assessment,
      plan: validation.normalized.plan,
      status: validation.normalized.status,
      created_by: actor?.userId,
    }], sessionOptions(session));
    consultationId = consultation._id;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'consultation.create',
    targetType: 'consultation',
    targetId: consultationId,
    status: 'success',
    message: 'Tạo consultation thành công.',
    requestMeta,
  });

  return getConsultationDetail(consultationId, actor);
}

async function listConsultations(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.encounter_id) {
    const encounter = await getEncounterOrThrow(query.encounter_id);
    assertEncounterAccess(encounter, actor, {
      globalPermissions: [PERMISSION.CONSULTATIONS.READ, PERMISSION.ENCOUNTERS.READ],
      ownPermissions: [PERMISSION.CONSULTATIONS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN],
      departmentPermissions: [PERMISSION.CONSULTATIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
    });
    filter.encounter_id = query.encounter_id;
  } else {
    await applyEncounterListScope(filter, actor, {
      globalPermissions: [PERMISSION.CONSULTATIONS.READ, PERMISSION.ENCOUNTERS.READ],
      ownPermissions: [PERMISSION.CONSULTATIONS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN],
      departmentPermissions: [PERMISSION.CONSULTATIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
    });
  }
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Consultation.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Consultation.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
}

async function getConsultationDetail(consultationId, actor = {}) {
  const consultation = await Consultation.findById(consultationId).lean();
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  await assertConsultationAccess(consultation, actor, false);
  const diagnoses = await Diagnosis.find({ consultation_id: consultation._id }).sort({ is_primary: -1, created_at: -1 }).lean();
  return { consultation, diagnoses };
}

async function checkConsultationEditable(consultationId, actor = {}) {
  const consultation = await Consultation.findById(consultationId).lean();
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  const encounter = await assertConsultationAccess(consultation, actor, true);
  const editable = DIRECT_EDIT_DOCUMENT_STATUSES.includes(consultation.status)
    && CLINICAL_EDITABLE_ENCOUNTER_STATUSES.includes(encounter.status)
    && (
      sameId(consultation.doctor_id, actor.userId)
      || hasAnyPermission(actor, [PERMISSION.CONSULTATIONS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE])
    );
  return {
    consultation_id: String(consultation._id),
    editable,
    status: consultation.status,
    encounter_status: encounter.status,
    allowed_fields: editable
      ? ['chief_complaint', 'history_present_illness', 'physical_exam', 'assessment', 'plan']
      : [],
  };
}

async function updateConsultation(consultationId, payload, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  const editable = await checkConsultationEditable(consultation._id, actor);
  if (!editable.editable) throw createError('Consultation hiện không thể chỉnh sửa trực tiếp.', 409);
  assertAuthorOrOverride(consultation.doctor_id, actor, [PERMISSION.CONSULTATIONS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE]);

  const before = consultation.toObject();
  for (const field of editable.allowed_fields) {
    if (payload[field] !== undefined) consultation[field] = payload[field];
  }
  consultation.updated_by = actor?.userId;
  await consultation.save();

  await recordAuditLog({
    actor,
    action: 'consultation.update',
    targetType: 'consultation',
    targetId: consultation._id,
    status: 'success',
    message: 'Cập nhật consultation thành công.',
    requestMeta,
    before,
    after: consultation.toObject(),
  });

  return getConsultationDetail(consultation._id, actor);
}

async function startConsultation(consultationId, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  const encounter = await assertConsultationAccess(consultation, actor, true);
  assertEncounterClinicalEditable(encounter);
  assertAuthorOrOverride(consultation.doctor_id, actor, [PERMISSION.CONSULTATIONS.UPDATE]);
  validateConsultationStatusTransition(consultation.status, CONSULTATION_STATUS.IN_PROGRESS);

  const before = consultation.toObject();
  consultation.status = CONSULTATION_STATUS.IN_PROGRESS;
  consultation.updated_by = actor?.userId;
  await consultation.save();

  await recordAuditLog({
    actor,
    action: 'consultation.start',
    targetType: 'consultation',
    targetId: consultation._id,
    status: 'success',
    message: 'Bắt đầu consultation thành công.',
    requestMeta,
    before,
    after: consultation.toObject(),
  });
  return getConsultationDetail(consultation._id, actor);
}

async function validateConsultationBeforeSign(consultationId, actor = null) {
  const consultation = await Consultation.findById(consultationId).lean();
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  const encounter = await assertConsultationAccess(consultation, actor || {}, true);

  const blocking = [];
  if (!SIGNABLE_DOCUMENT_STATUSES.includes(consultation.status)) blocking.push('Consultation không ở trạng thái ký được.');
  if (![ENCOUNTER_STATUS.ARRIVED, ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.ON_HOLD].includes(encounter.status)) {
    blocking.push('Encounter không ở trạng thái ký consultation.');
  }
  if (actor?.userId && !sameId(consultation.doctor_id, actor.userId) && !hasAnyPermission(actor, [PERMISSION.CONSULTATIONS.SIGN, PERMISSION.ENCOUNTERS.UPDATE])) {
    blocking.push('Chỉ bác sĩ của consultation hoặc người có quyền override mới được ký.');
  }
  if (!nonEmpty(consultation.chief_complaint)) blocking.push('Thiếu lý do khám.');
  if (!nonEmpty(consultation.assessment)) blocking.push('Thiếu assessment.');
  if (!nonEmpty(consultation.plan)) blocking.push('Thiếu plan.');

  const primaryDiagnosisCount = await Diagnosis.countDocuments({
    encounter_id: consultation.encounter_id,
    is_primary: true,
    status: DIAGNOSIS_STATUS.ACTIVE,
  });
  if (primaryDiagnosisCount === 0) blocking.push('Chưa có chẩn đoán chính active.');

  return {
    consultation_id: String(consultation._id),
    can_sign: blocking.length === 0,
    blocking_reasons: blocking,
  };
}

async function signConsultation(consultationId, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  const validation = await validateConsultationBeforeSign(consultation._id, actor);
  if (!validation.can_sign) throw createError(`Consultation chưa đủ điều kiện ký: ${validation.blocking_reasons.join(' ')}`, 409);
  validateConsultationStatusTransition(consultation.status, CONSULTATION_STATUS.SIGNED);

  const before = consultation.toObject();
  consultation.status = CONSULTATION_STATUS.SIGNED;
  consultation.signed_by = actor?.userId;
  consultation.signed_at = new Date();
  consultation.updated_by = actor?.userId;
  await consultation.save();

  await recordAuditLog({
    actor,
    action: 'consultation.sign',
    targetType: 'consultation',
    targetId: consultation._id,
    status: 'success',
    message: 'Ký consultation thành công.',
    requestMeta,
    before,
    after: consultation.toObject(),
  });
  return getConsultationDetail(consultation._id, actor);
}

async function amendConsultation(consultationId, payload, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  await assertConsultationAccess(consultation, actor, true);
  assertAuthorOrOverride(consultation.doctor_id, actor, [PERMISSION.CONSULTATIONS.AMEND, PERMISSION.ENCOUNTERS.UPDATE]);
  if (!nonEmpty(payload.reason || payload.amend_reason)) throw createError('amend_reason là bắt buộc.');
  validateConsultationStatusTransition(consultation.status, CONSULTATION_STATUS.AMENDED);

  const before = consultation.toObject();
  for (const field of ['chief_complaint', 'history_present_illness', 'physical_exam', 'assessment', 'plan']) {
    if (payload[field] !== undefined) consultation[field] = payload[field];
  }
  consultation.status = CONSULTATION_STATUS.AMENDED;
  consultation.amended_by = actor?.userId;
  consultation.amended_at = new Date();
  consultation.amend_reason = payload.reason || payload.amend_reason;
  consultation.updated_by = actor?.userId;
  await consultation.save();

  await recordAuditLog({
    actor,
    action: 'consultation.amend',
    targetType: 'consultation',
    targetId: consultation._id,
    status: 'success',
    message: 'Sửa bổ sung consultation thành công.',
    requestMeta,
    before,
    after: consultation.toObject(),
    metadata: { reason: consultation.amend_reason },
  });
  return getConsultationDetail(consultation._id, actor);
}

async function cancelConsultation(consultationId, payload = {}, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  await assertConsultationAccess(consultation, actor, true);
  if (consultation.status === CONSULTATION_STATUS.SIGNED && !payload.force) {
    throw createError('Consultation đã ký không được hủy thường; cần force/amend workflow.', 409);
  }
  if (consultation.status === CONSULTATION_STATUS.SIGNED && !nonEmpty(payload.reason || payload.cancel_reason)) {
    throw createError('reason là bắt buộc khi force hủy consultation đã ký.');
  }
  if (!(consultation.status === CONSULTATION_STATUS.SIGNED && payload.force)) {
    validateConsultationStatusTransition(consultation.status, CONSULTATION_STATUS.CANCELLED);
  }

  const before = consultation.toObject();
  consultation.status = CONSULTATION_STATUS.CANCELLED;
  consultation.cancelled_by = actor?.userId;
  consultation.cancelled_at = new Date();
  consultation.cancel_reason = payload.reason || payload.cancel_reason;
  consultation.updated_by = actor?.userId;
  await consultation.save();

  await recordAuditLog({
    actor,
    action: 'consultation.cancel',
    targetType: 'consultation',
    targetId: consultation._id,
    status: 'success',
    message: 'Hủy consultation thành công.',
    requestMeta,
    before,
    after: consultation.toObject(),
    metadata: { reason: consultation.cancel_reason || null, forced: Boolean(payload.force) },
  });
  return getConsultationDetail(consultation._id, actor);
}

function validateDiagnosisPayload(payload = {}) {
  if (!nonEmpty(payload.diagnosis_name)) throw createError('diagnosis_name là bắt buộc.');
  ensureEnum(payload.diagnosis_type, DIAGNOSIS_TYPES, 'diagnosis_type');
  const normalized = {
    icd10_code: payload.icd10_code ? normalizeString(payload.icd10_code).toUpperCase() : undefined,
    diagnosis_name: normalizeString(payload.diagnosis_name),
    diagnosis_type: payload.diagnosis_type || 'provisional',
    is_primary: Boolean(payload.is_primary),
    onset_date: payload.onset_date ? new Date(payload.onset_date) : undefined,
    notes: payload.notes,
  };
  if (normalized.onset_date && normalized.onset_date > new Date(Date.now() + 24 * 60 * 60 * 1000)) {
    throw createError('onset_date không được ở tương lai quá xa.');
  }
  return normalized;
}

function normalizeDiagnosisWriteError(error) {
  if (error?.code === 11000) {
    throw createError('Encounter chỉ được có một primary diagnosis active.', 409);
  }
  throw error;
}

async function ensureSinglePrimaryDiagnosis(encounterId, diagnosisIdToKeep = null, actorId = null, options = {}) {
  const session = options.session || null;
  const filter = {
    encounter_id: encounterId,
    status: DIAGNOSIS_STATUS.ACTIVE,
    is_primary: true,
  };
  if (diagnosisIdToKeep) filter._id = { $ne: diagnosisIdToKeep };
  await withSession(Diagnosis.updateMany(filter, { $set: { is_primary: false, updated_by: actorId } }), session);
  if (diagnosisIdToKeep) {
    await withSession(Diagnosis.updateOne(
      { _id: diagnosisIdToKeep, status: DIAGNOSIS_STATUS.ACTIVE },
      { $set: { is_primary: true, updated_by: actorId } },
    ), session);
  }
  return true;
}

async function addDiagnosis(payload, actor, requestMeta = {}) {
  assertActorUser(actor);
  const normalized = validateDiagnosisPayload(payload);
  let diagnosisId;

  try {
    await withOptionalTransaction(async (session) => {
      const encounter = await getEncounterOrThrow(payload.encounter_id, session);
      assertEncounterClinicalEditable(encounter);
      assertEncounterAccess(encounter, actor, {
        globalPermissions: [PERMISSION.DIAGNOSES.MANAGE],
        ownPermissions: [PERMISSION.DIAGNOSES.CREATE],
        departmentPermissions: [PERMISSION.DIAGNOSES.CREATE],
      });

      if (payload.consultation_id) {
        const consultation = await withSession(Consultation.findById(payload.consultation_id).lean(), session);
        if (!consultation || !sameId(consultation.encounter_id, encounter._id)) {
          throw createError('consultation_id không thuộc encounter này.', 409);
        }
      }

      const [diagnosis] = await Diagnosis.create([{
        encounter_id: encounter._id,
        consultation_id: payload.consultation_id || undefined,
        recorded_by: payload.recorded_by || actor?.userId,
        icd10_code: normalized.icd10_code,
        diagnosis_name: normalized.diagnosis_name,
        diagnosis_type: normalized.diagnosis_type,
        is_primary: false,
        onset_date: normalized.onset_date,
        notes: normalized.notes,
        status: DIAGNOSIS_STATUS.ACTIVE,
        created_by: actor?.userId,
      }], sessionOptions(session));

      if (normalized.is_primary) {
        await ensureSinglePrimaryDiagnosis(encounter._id, diagnosis._id, actor?.userId, { session });
      }
      diagnosisId = diagnosis._id;
    }, { fallbackToNoTransaction: true });
  } catch (error) {
    normalizeDiagnosisWriteError(error);
  }

  await recordAuditLog({
    actor,
    action: 'diagnosis.create',
    targetType: 'diagnosis',
    targetId: diagnosisId,
    status: 'success',
    message: 'Thêm chẩn đoán thành công.',
    requestMeta,
  });
  return getDiagnosisDetail(diagnosisId, actor);
}

async function listDiagnosesByEncounter(encounterId, actor = {}) {
  const encounter = await getEncounterOrThrow(encounterId);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.DIAGNOSES.READ, PERMISSION.ENCOUNTERS.READ],
    ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  const items = await Diagnosis.find({ encounter_id: encounterId }).sort({ is_primary: -1, created_at: -1 }).lean();
  return { encounter_id: String(encounterId), items };
}

async function getDiagnosisDetail(diagnosisId, actor = {}) {
  const diagnosis = await Diagnosis.findById(diagnosisId).lean();
  if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  const encounter = await getEncounterOrThrow(diagnosis.encounter_id);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.DIAGNOSES.READ, PERMISSION.ENCOUNTERS.READ],
    ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  return { diagnosis };
}

async function updateDiagnosis(diagnosisId, payload, actor, requestMeta = {}) {
  const diagnosis = await Diagnosis.findById(diagnosisId);
  if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  if (diagnosis.status === DIAGNOSIS_STATUS.ENTERED_IN_ERROR) {
    throw createError('Diagnosis entered_in_error không được sửa.', 409);
  }
  const normalized = validateDiagnosisPayload({ ...diagnosis.toObject(), ...payload });
  const encounter = await getEncounterOrThrow(diagnosis.encounter_id);
  assertEncounterClinicalEditable(encounter);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.DIAGNOSES.MANAGE],
    ownPermissions: [PERMISSION.DIAGNOSES.UPDATE_OWN, PERMISSION.DIAGNOSES.UPDATE],
    departmentPermissions: [PERMISSION.DIAGNOSES.UPDATE],
  });

  const before = diagnosis.toObject();
  try {
    await withOptionalTransaction(async (session) => {
      const promoteToPrimary = payload.is_primary !== undefined && Boolean(payload.is_primary) && !diagnosis.is_primary;
      if (payload.icd10_code !== undefined) diagnosis.icd10_code = normalized.icd10_code;
      if (payload.diagnosis_name !== undefined) diagnosis.diagnosis_name = normalized.diagnosis_name;
      if (payload.diagnosis_type !== undefined) diagnosis.diagnosis_type = normalized.diagnosis_type;
      if (payload.onset_date !== undefined) diagnosis.onset_date = normalized.onset_date;
      if (payload.notes !== undefined) diagnosis.notes = normalized.notes;
      if (payload.is_primary !== undefined) diagnosis.is_primary = promoteToPrimary ? false : Boolean(payload.is_primary);
      diagnosis.updated_by = actor?.userId;
      await diagnosis.save(sessionOptions(session));
      if (payload.is_primary !== undefined && Boolean(payload.is_primary)) {
        await ensureSinglePrimaryDiagnosis(diagnosis.encounter_id, diagnosis._id, actor?.userId, { session });
      }
    }, { fallbackToNoTransaction: true });
  } catch (error) {
    normalizeDiagnosisWriteError(error);
  }

  await recordAuditLog({
    actor,
    action: 'diagnosis.update',
    targetType: 'diagnosis',
    targetId: diagnosis._id,
    status: 'success',
    message: 'Cập nhật chẩn đoán thành công.',
    requestMeta,
    before,
    after: await Diagnosis.findById(diagnosis._id).lean(),
  });
  return getDiagnosisDetail(diagnosis._id, actor);
}

async function setPrimaryDiagnosis(diagnosisId, actor, requestMeta = {}) {
  const diagnosis = await Diagnosis.findById(diagnosisId);
  if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  if (diagnosis.status !== DIAGNOSIS_STATUS.ACTIVE) throw createError('Chỉ diagnosis active mới được đặt primary.', 409);
  const encounter = await getEncounterOrThrow(diagnosis.encounter_id);
  assertEncounterClinicalEditable(encounter);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.DIAGNOSES.MANAGE, PERMISSION.DIAGNOSES.SET_PRIMARY],
    ownPermissions: [PERMISSION.DIAGNOSES.SET_PRIMARY],
    departmentPermissions: [PERMISSION.DIAGNOSES.SET_PRIMARY],
  });

  try {
    await withOptionalTransaction(async (session) => {
      await ensureSinglePrimaryDiagnosis(diagnosis.encounter_id, diagnosis._id, actor?.userId, { session });
    }, { fallbackToNoTransaction: true });
  } catch (error) {
    normalizeDiagnosisWriteError(error);
  }

  await recordAuditLog({
    actor,
    action: 'diagnosis.set_primary',
    targetType: 'diagnosis',
    targetId: diagnosis._id,
    status: 'success',
    message: 'Đặt chẩn đoán chính thành công.',
    requestMeta,
  });
  return getDiagnosisDetail(diagnosis._id, actor);
}

async function resolveDiagnosis(diagnosisId, actor, requestMeta = {}) {
  const diagnosis = await Diagnosis.findById(diagnosisId);
  if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  if (diagnosis.status !== DIAGNOSIS_STATUS.ACTIVE) throw createError('Chỉ diagnosis active mới được resolve.', 409);
  const encounter = await getEncounterOrThrow(diagnosis.encounter_id);
  assertEncounterClinicalEditable(encounter);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.DIAGNOSES.MANAGE, PERMISSION.DIAGNOSES.UPDATE],
    ownPermissions: [PERMISSION.DIAGNOSES.UPDATE_OWN],
    departmentPermissions: [PERMISSION.DIAGNOSES.UPDATE],
  });

  const before = diagnosis.toObject();
  diagnosis.status = DIAGNOSIS_STATUS.RESOLVED;
  diagnosis.is_primary = false;
  diagnosis.resolved_by = actor?.userId;
  diagnosis.resolved_at = new Date();
  diagnosis.updated_by = actor?.userId;
  await diagnosis.save();
  await recordAuditLog({
    actor,
    action: 'diagnosis.resolve',
    targetType: 'diagnosis',
    targetId: diagnosis._id,
    status: 'success',
    message: 'Đánh dấu resolved diagnosis thành công.',
    requestMeta,
    before,
    after: diagnosis.toObject(),
  });
  return getDiagnosisDetail(diagnosis._id, actor);
}

async function removeDiagnosis(diagnosisId, payload = {}, actor, requestMeta = {}) {
  const diagnosis = await Diagnosis.findById(diagnosisId);
  if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  if (diagnosis.status === DIAGNOSIS_STATUS.ENTERED_IN_ERROR) return { diagnosis };
  const encounter = await getEncounterOrThrow(diagnosis.encounter_id);
  assertEncounterClinicalEditable(encounter);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.DIAGNOSES.MANAGE, PERMISSION.DIAGNOSES.ENTERED_IN_ERROR],
    ownPermissions: [PERMISSION.DIAGNOSES.ENTERED_IN_ERROR],
    departmentPermissions: [PERMISSION.DIAGNOSES.ENTERED_IN_ERROR],
  });

  const before = diagnosis.toObject();
  diagnosis.status = DIAGNOSIS_STATUS.ENTERED_IN_ERROR;
  diagnosis.is_primary = false;
  diagnosis.entered_in_error_by = actor?.userId;
  diagnosis.entered_in_error_at = new Date();
  diagnosis.entered_in_error_reason = payload.reason || payload.entered_in_error_reason;
  diagnosis.updated_by = actor?.userId;
  await diagnosis.save();
  await recordAuditLog({
    actor,
    action: 'diagnosis.entered_in_error',
    targetType: 'diagnosis',
    targetId: diagnosis._id,
    status: 'success',
    message: 'Đánh dấu diagnosis entered_in_error thành công.',
    requestMeta,
    before,
    after: diagnosis.toObject(),
    metadata: { reason: diagnosis.entered_in_error_reason || null },
  });
  return getDiagnosisDetail(diagnosis._id, actor);
}

function calculateBMI({ weight, height }) {
  const numericWeight = Number(weight);
  const numericHeight = Number(height);
  if (!numericWeight || !numericHeight || numericWeight <= 0 || numericHeight <= 0) return null;
  const meters = numericHeight > 10 ? numericHeight / 100 : numericHeight;
  if (!meters) return null;
  return Number((numericWeight / (meters * meters)).toFixed(2));
}

function validateVitalSignsPayload(payload = {}) {
  const normalized = {};
  const ranges = {
    temperature: [25, 45],
    heart_rate: [20, 250],
    respiratory_rate: [5, 80],
    systolic_bp: [40, 260],
    diastolic_bp: [20, 160],
    spo2: [50, 100],
    weight: [0.5, 500],
    height: [20, 250],
  };
  let hasAnyValue = false;
  for (const field of VITAL_SIGN_FIELDS) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
      const value = Number(payload[field]);
      const [min, max] = ranges[field];
      if (Number.isNaN(value) || value < min || value > max) throw createError(`${field} ngoài khoảng hợp lệ.`);
      normalized[field] = value;
      hasAnyValue = true;
    }
  }
  if (!hasAnyValue) throw createError('Cần có ít nhất một chỉ số sinh hiệu.');
  if (normalized.systolic_bp !== undefined && normalized.diastolic_bp !== undefined && normalized.systolic_bp <= normalized.diastolic_bp) {
    throw createError('systolic_bp phải lớn hơn diastolic_bp.');
  }
  const recordedAt = payload.recorded_at ? new Date(payload.recorded_at) : new Date();
  if (Number.isNaN(recordedAt.getTime())) throw createError('recorded_at không hợp lệ.');
  if (recordedAt > new Date(Date.now() + 5 * 60 * 1000)) throw createError('recorded_at không được ở tương lai.');
  normalized.recorded_at = recordedAt;
  normalized.bmi = payload.bmi !== undefined ? Number(payload.bmi) : calculateBMI(normalized);
  return normalized;
}

async function recordVitalSigns(payload, actor, requestMeta = {}) {
  assertActorUser(actor);
  const normalized = validateVitalSignsPayload(payload);
  const encounter = await getEncounterOrThrow(payload.encounter_id);
  assertEncounterClinicalEditable(encounter);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.VITAL_SIGNS.CREATE],
    ownPermissions: [PERMISSION.VITAL_SIGNS.CREATE],
    departmentPermissions: [PERMISSION.VITAL_SIGNS.CREATE, PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS],
  });

  const vitalSign = await VitalSign.create({
    patient_id: encounter.patient_id,
    encounter_id: encounter._id,
    recorded_by: payload.recorded_by || actor?.userId,
    ...normalized,
    status: VITAL_SIGN_STATUS.RECORDED,
    created_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'vital_sign.create',
    targetType: 'vital_sign',
    targetId: vitalSign._id,
    status: 'success',
    message: 'Ghi nhận vital signs thành công.',
    requestMeta,
  });
  return getVitalSignDetail(vitalSign._id, actor);
}

async function listVitalSigns(encounterId, actor = {}, query = {}) {
  const encounter = await getEncounterOrThrow(encounterId);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.VITAL_SIGNS.READ, PERMISSION.ENCOUNTERS.READ],
    ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  const filter = { encounter_id: encounterId };
  if (query.status) filter.status = query.status;
  if (!query.include_entered_in_error) filter.status = filter.status || { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR };
  const items = await VitalSign.find(filter).sort({ recorded_at: -1 }).lean();
  return { encounter_id: String(encounterId), items };
}

async function getLatestVitalSigns(encounterId, actor = {}) {
  const encounter = await getEncounterOrThrow(encounterId);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.VITAL_SIGNS.READ, PERMISSION.ENCOUNTERS.READ],
    ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  const item = await VitalSign.findOne({
    encounter_id: encounterId,
    status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR },
  }).sort({ recorded_at: -1 }).lean();
  return { encounter_id: String(encounterId), item };
}

async function getVitalSignDetail(vitalSignId, actor = {}) {
  const vitalSign = await VitalSign.findById(vitalSignId).lean();
  if (!vitalSign) throw createError('Không tìm thấy vital sign.', 404);
  const encounter = await getEncounterOrThrow(vitalSign.encounter_id);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.VITAL_SIGNS.READ, PERMISSION.ENCOUNTERS.READ],
    ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  return { vital_sign: vitalSign };
}

async function updateVitalSigns(vitalSignId, payload, actor, requestMeta = {}) {
  const vitalSign = await VitalSign.findById(vitalSignId);
  if (!vitalSign) throw createError('Không tìm thấy vital sign.', 404);
  if (vitalSign.status === VITAL_SIGN_STATUS.ENTERED_IN_ERROR) {
    throw createError('Vital sign entered_in_error không được sửa.', 409);
  }
  const encounter = await getEncounterOrThrow(vitalSign.encounter_id);
  assertEncounterClinicalEditable(encounter);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.VITAL_SIGNS.UPDATE_OWN],
    ownPermissions: [PERMISSION.VITAL_SIGNS.UPDATE_OWN],
    departmentPermissions: [PERMISSION.VITAL_SIGNS.UPDATE_OWN, PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS],
  });
  assertAuthorOrOverride(vitalSign.recorded_by, actor, [PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS]);

  const nextPayload = {};
  for (const field of VITAL_SIGN_FIELDS) nextPayload[field] = payload[field] !== undefined ? payload[field] : vitalSign[field];
  nextPayload.recorded_at = payload.recorded_at !== undefined ? payload.recorded_at : vitalSign.recorded_at;
  nextPayload.bmi = payload.bmi;
  const normalized = validateVitalSignsPayload(nextPayload);

  const before = vitalSign.toObject();
  for (const field of VITAL_SIGN_FIELDS) {
    vitalSign[field] = normalized[field] !== undefined ? normalized[field] : undefined;
  }
  vitalSign.recorded_at = normalized.recorded_at;
  vitalSign.bmi = normalized.bmi;
  vitalSign.status = VITAL_SIGN_STATUS.AMENDED;
  vitalSign.updated_by = actor?.userId;
  await vitalSign.save();

  await recordAuditLog({
    actor,
    action: 'vital_sign.update',
    targetType: 'vital_sign',
    targetId: vitalSign._id,
    status: 'success',
    message: 'Cập nhật vital signs thành công.',
    requestMeta,
    before,
    after: vitalSign.toObject(),
  });
  return getVitalSignDetail(vitalSign._id, actor);
}

async function deleteVitalSignsRecord(vitalSignId, payload = {}, actor, requestMeta = {}) {
  const vitalSign = await VitalSign.findById(vitalSignId);
  if (!vitalSign) throw createError('Không tìm thấy vital sign.', 404);
  const encounter = await getEncounterOrThrow(vitalSign.encounter_id);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.VITAL_SIGNS.ENTERED_IN_ERROR],
    ownPermissions: [PERMISSION.VITAL_SIGNS.ENTERED_IN_ERROR],
    departmentPermissions: [PERMISSION.VITAL_SIGNS.ENTERED_IN_ERROR, PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS],
  });

  const before = vitalSign.toObject();
  vitalSign.status = VITAL_SIGN_STATUS.ENTERED_IN_ERROR;
  vitalSign.entered_in_error_by = actor?.userId;
  vitalSign.entered_in_error_at = new Date();
  vitalSign.entered_in_error_reason = payload.reason || payload.entered_in_error_reason;
  vitalSign.updated_by = actor?.userId;
  await vitalSign.save();
  await recordAuditLog({
    actor,
    action: 'vital_sign.entered_in_error',
    targetType: 'vital_sign',
    targetId: vitalSign._id,
    status: 'success',
    message: 'Vô hiệu hóa vital sign thành công.',
    requestMeta,
    before,
    after: vitalSign.toObject(),
    metadata: { reason: vitalSign.entered_in_error_reason || null },
  });
  return getVitalSignDetail(vitalSign._id, actor);
}

async function validateClinicalNotePayload(payload = {}, options = {}) {
  if (options.requireContent !== false && !nonEmpty(payload.content)) throw createError('content là bắt buộc.');
  if (payload.consultation_id) {
    const consultation = await Consultation.findById(payload.consultation_id).lean();
    if (!consultation) throw createError('Không tìm thấy consultation.', 404);
    if (payload.encounter_id && !sameId(consultation.encounter_id, payload.encounter_id)) {
      throw createError('consultation_id không thuộc encounter này.', 409);
    }
  }
  return {
    consultation_id: payload.consultation_id || undefined,
    note_type: normalizeString(payload.note_type) || 'progress_note',
    title: payload.title,
    content: payload.content,
    status: [CLINICAL_NOTE_STATUS.DRAFT, CLINICAL_NOTE_STATUS.IN_PROGRESS].includes(payload.status)
      ? payload.status
      : CLINICAL_NOTE_STATUS.DRAFT,
  };
}

async function createClinicalNote(payload, actor, requestMeta = {}) {
  assertActorUser(actor);
  const encounter = await getEncounterOrThrow(payload.encounter_id);
  assertEncounterClinicalEditable(encounter);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.CLINICAL_NOTES.WRITE],
    ownPermissions: [PERMISSION.CLINICAL_NOTES.CREATE, PERMISSION.CLINICAL_NOTES.CREATE_NURSING],
    departmentPermissions: [PERMISSION.CLINICAL_NOTES.CREATE_NURSING, PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS],
  });
  const normalized = await validateClinicalNotePayload(payload);
  const note = await ClinicalNote.create({
    encounter_id: encounter._id,
    consultation_id: normalized.consultation_id,
    author_id: payload.author_id || actor?.userId,
    note_type: normalized.note_type,
    title: normalized.title,
    content: normalized.content,
    status: normalized.status,
    created_by: actor?.userId,
  });
  await recordAuditLog({
    actor,
    action: 'clinical_note.create',
    targetType: 'clinical_note',
    targetId: note._id,
    status: 'success',
    message: 'Tạo clinical note thành công.',
    requestMeta,
  });
  return getClinicalNoteDetail(note._id, actor);
}

async function listClinicalNotes(query = {}, actor = {}) {
  const filter = {};
  if (query.encounter_id) {
    const encounter = await getEncounterOrThrow(query.encounter_id);
    assertEncounterAccess(encounter, actor, {
      globalPermissions: [PERMISSION.CLINICAL_NOTES.READ, PERMISSION.ENCOUNTERS.READ],
      ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
      departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
    });
    filter.encounter_id = query.encounter_id;
  } else {
    await applyEncounterListScope(filter, actor, {
      globalPermissions: [PERMISSION.CLINICAL_NOTES.READ, PERMISSION.ENCOUNTERS.READ],
      ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
      departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
    });
  }
  if (query.consultation_id) filter.consultation_id = query.consultation_id;
  if (query.status) filter.status = query.status;
  const items = await ClinicalNote.find(filter).sort({ created_at: -1 }).lean();
  return { items };
}

async function getClinicalNoteDetail(noteId, actor = {}) {
  const note = await ClinicalNote.findById(noteId).lean();
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  await assertClinicalNoteAccess(note, actor, false);
  return { clinical_note: note };
}

async function checkClinicalNoteEditable(noteId, actor = {}) {
  const note = await ClinicalNote.findById(noteId).lean();
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  const encounter = await assertClinicalNoteAccess(note, actor, true);
  const editable = DIRECT_EDIT_NOTE_STATUSES.includes(note.status)
    && CLINICAL_EDITABLE_ENCOUNTER_STATUSES.includes(encounter.status)
    && (
      sameId(note.author_id, actor.userId)
      || hasAnyPermission(actor, [PERMISSION.CLINICAL_NOTES.WRITE, PERMISSION.CLINICAL_NOTES.AMEND])
    );
  return {
    clinical_note_id: String(note._id),
    editable,
    status: note.status,
    encounter_status: encounter.status,
    allowed_fields: editable ? ['note_type', 'title', 'content'] : [],
  };
}

async function updateClinicalNote(noteId, payload, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  const editable = await checkClinicalNoteEditable(note._id, actor);
  if (!editable.editable) throw createError('Clinical note hiện không thể chỉnh sửa trực tiếp.', 409);
  assertAuthorOrOverride(note.author_id, actor, [PERMISSION.CLINICAL_NOTES.WRITE]);

  const before = note.toObject();
  if (payload.note_type !== undefined) note.note_type = normalizeString(payload.note_type) || note.note_type;
  if (payload.title !== undefined) note.title = payload.title;
  if (payload.content !== undefined) {
    if (!nonEmpty(payload.content)) throw createError('content không được rỗng.');
    note.content = payload.content;
  }
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({
    actor,
    action: 'clinical_note.update',
    targetType: 'clinical_note',
    targetId: note._id,
    status: 'success',
    message: 'Cập nhật clinical note thành công.',
    requestMeta,
    before,
    after: note.toObject(),
  });
  return getClinicalNoteDetail(note._id, actor);
}

async function startClinicalNote(noteId, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  await assertClinicalNoteAccess(note, actor, true);
  assertAuthorOrOverride(note.author_id, actor, [PERMISSION.CLINICAL_NOTES.WRITE]);
  validateClinicalNoteStatusTransition(note.status, CLINICAL_NOTE_STATUS.IN_PROGRESS);
  const before = note.toObject();
  note.status = CLINICAL_NOTE_STATUS.IN_PROGRESS;
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({
    actor,
    action: 'clinical_note.start',
    targetType: 'clinical_note',
    targetId: note._id,
    status: 'success',
    message: 'Bắt đầu clinical note thành công.',
    requestMeta,
    before,
    after: note.toObject(),
  });
  return getClinicalNoteDetail(note._id, actor);
}

async function validateClinicalNoteBeforeSign(noteId, actor = null) {
  const note = await ClinicalNote.findById(noteId).lean();
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  const encounter = await assertClinicalNoteAccess(note, actor || {}, true);
  const blocking = [];
  if (!SIGNABLE_NOTE_STATUSES.includes(note.status)) blocking.push('Clinical note không ở trạng thái ký được.');
  if (encounter.status === ENCOUNTER_STATUS.CANCELLED) blocking.push('Encounter đã hủy.');
  if (!nonEmpty(note.content)) blocking.push('Clinical note phải có nội dung.');
  if (actor?.userId && !sameId(note.author_id, actor.userId) && !hasAnyPermission(actor, [PERMISSION.CLINICAL_NOTES.SIGN, PERMISSION.CLINICAL_NOTES.WRITE])) {
    blocking.push('Chỉ tác giả hoặc người có quyền override mới được ký note.');
  }
  return {
    clinical_note_id: String(note._id),
    can_sign: blocking.length === 0,
    blocking_reasons: blocking,
  };
}

async function signClinicalNote(noteId, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  const validation = await validateClinicalNoteBeforeSign(note._id, actor);
  if (!validation.can_sign) throw createError(`Clinical note chưa đủ điều kiện ký: ${validation.blocking_reasons.join(' ')}`, 409);
  validateClinicalNoteStatusTransition(note.status, CLINICAL_NOTE_STATUS.SIGNED);
  const before = note.toObject();
  note.status = CLINICAL_NOTE_STATUS.SIGNED;
  note.signed_by = actor?.userId;
  note.signed_at = new Date();
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({
    actor,
    action: 'clinical_note.sign',
    targetType: 'clinical_note',
    targetId: note._id,
    status: 'success',
    message: 'Ký clinical note thành công.',
    requestMeta,
    before,
    after: note.toObject(),
  });
  return getClinicalNoteDetail(note._id, actor);
}

async function amendClinicalNote(noteId, payload, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  await assertClinicalNoteAccess(note, actor, true);
  assertAuthorOrOverride(note.author_id, actor, [PERMISSION.CLINICAL_NOTES.AMEND, PERMISSION.CLINICAL_NOTES.WRITE]);
  if (!nonEmpty(payload.reason || payload.amend_reason)) throw createError('amend_reason là bắt buộc.');
  validateClinicalNoteStatusTransition(note.status, CLINICAL_NOTE_STATUS.AMENDED);
  const before = note.toObject();
  if (payload.title !== undefined) note.title = payload.title;
  if (payload.content !== undefined) {
    if (!nonEmpty(payload.content)) throw createError('content không được rỗng.');
    note.content = payload.content;
  }
  if (payload.note_type !== undefined) note.note_type = normalizeString(payload.note_type) || note.note_type;
  note.status = CLINICAL_NOTE_STATUS.AMENDED;
  note.amended_by = actor?.userId;
  note.amended_at = new Date();
  note.amend_reason = payload.reason || payload.amend_reason;
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({
    actor,
    action: 'clinical_note.amend',
    targetType: 'clinical_note',
    targetId: note._id,
    status: 'success',
    message: 'Sửa bổ sung clinical note thành công.',
    requestMeta,
    before,
    after: note.toObject(),
    metadata: { reason: note.amend_reason },
  });
  return getClinicalNoteDetail(note._id, actor);
}

async function cancelClinicalNote(noteId, payload = {}, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  await assertClinicalNoteAccess(note, actor, true);
  assertAuthorOrOverride(note.author_id, actor, [PERMISSION.CLINICAL_NOTES.WRITE, PERMISSION.CLINICAL_NOTES.AMEND]);
  if (note.status === CLINICAL_NOTE_STATUS.SIGNED && !payload.force) {
    throw createError('Clinical note đã ký không được hủy thường; cần force/amend workflow.', 409);
  }
  if (note.status === CLINICAL_NOTE_STATUS.SIGNED && !nonEmpty(payload.reason || payload.cancel_reason)) {
    throw createError('reason là bắt buộc khi force hủy clinical note đã ký.');
  }
  if (!(note.status === CLINICAL_NOTE_STATUS.SIGNED && payload.force)) {
    validateClinicalNoteStatusTransition(note.status, CLINICAL_NOTE_STATUS.CANCELLED);
  }
  const before = note.toObject();
  note.status = CLINICAL_NOTE_STATUS.CANCELLED;
  note.cancelled_by = actor?.userId;
  note.cancelled_at = new Date();
  note.cancel_reason = payload.reason || payload.cancel_reason;
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({
    actor,
    action: 'clinical_note.cancel',
    targetType: 'clinical_note',
    targetId: note._id,
    status: 'success',
    message: 'Hủy clinical note thành công.',
    requestMeta,
    before,
    after: note.toObject(),
    metadata: { reason: note.cancel_reason || null, forced: Boolean(payload.force) },
  });
  return getClinicalNoteDetail(note._id, actor);
}

async function completeClinicalNote(noteId, actor, requestMeta = {}) {
  return signClinicalNote(noteId, actor, requestMeta);
}

async function getEncounterClinicalSummary(encounterId, actor = {}) {
  const encounter = await getEncounterOrThrow(encounterId);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [PERMISSION.ENCOUNTERS.READ_SUMMARY, PERMISSION.ENCOUNTERS.READ, PERMISSION.CONSULTATIONS.READ],
    ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.CONSULTATIONS.READ_OWN],
    departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT, PERMISSION.CONSULTATIONS.READ_DEPARTMENT],
  });

  const [consultations, diagnoses, latestVitals, latestNotes, allergies, problems, carePlans] = await Promise.all([
    Consultation.find({ encounter_id: encounter._id }).sort({ created_at: -1 }).lean(),
    Diagnosis.find({ encounter_id: encounter._id, status: { $ne: DIAGNOSIS_STATUS.ENTERED_IN_ERROR } }).sort({ is_primary: -1, created_at: -1 }).lean(),
    VitalSign.findOne({ encounter_id: encounter._id, status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR } }).sort({ recorded_at: -1 }).lean(),
    ClinicalNote.find({ encounter_id: encounter._id, status: { $ne: CLINICAL_NOTE_STATUS.CANCELLED } }).sort({ created_at: -1 }).limit(5).lean(),
    Allergy.find({ patient_id: encounter.patient_id, status: ALLERGY_STATUS.ACTIVE }).lean(),
    ProblemList.find({ patient_id: encounter.patient_id, status: PROBLEM_STATUS.ACTIVE }).lean(),
    CarePlan.find({ encounter_id: encounter._id, status: { $nin: [CARE_PLAN_STATUS.CANCELLED] } }).sort({ created_at: -1 }).lean(),
  ]);

  return {
    encounter_id: String(encounter._id),
    encounter,
    consultations,
    consultation_status: consultations[0]?.status || null,
    primary_diagnosis: diagnoses.find((diagnosis) => diagnosis.is_primary) || null,
    diagnoses,
    latest_vital_signs: latestVitals,
    latest_notes: latestNotes,
    active_allergies: allergies.sort((left, right) => (ALLERGY_SEVERITY_WEIGHT[right.severity] || 0) - (ALLERGY_SEVERITY_WEIGHT[left.severity] || 0)),
    active_problems: problems.sort((left, right) => (PROBLEM_SEVERITY_WEIGHT[right.severity] || 0) - (PROBLEM_SEVERITY_WEIGHT[left.severity] || 0)),
    care_plans: carePlans,
  };
}

async function getPatientLatestAllergies(patientId, actor = {}) {
  await assertPatientActive(patientId);
  if (actorType(actor) && !hasAnyPermission(actor, [PERMISSION.ALLERGIES.READ, PERMISSION.PATIENTS.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Bạn không có quyền xem allergy của bệnh nhân.', 403);
  }
  const items = await Allergy.find({ patient_id: patientId, status: ALLERGY_STATUS.ACTIVE }).lean();
  return {
    patient_id: String(patientId),
    items: items.sort((left, right) => (ALLERGY_SEVERITY_WEIGHT[right.severity] || 0) - (ALLERGY_SEVERITY_WEIGHT[left.severity] || 0)),
  };
}

async function addPatientAllergy(patientId, payload, actor, requestMeta = {}) {
  assertActorUser(actor);
  await assertPatientActive(patientId);
  if (!nonEmpty(payload.allergen)) throw createError('allergen là bắt buộc.');
  ensureEnum(payload.allergy_type, ALLERGY_TYPES, 'allergy_type');
  ensureEnum(payload.severity, ALLERGY_SEVERITIES, 'severity');
  if (payload.encounter_id) {
    const encounter = await getEncounterOrThrow(payload.encounter_id);
    if (!sameId(encounter.patient_id, patientId)) throw createError('Encounter không thuộc bệnh nhân này.', 409);
    assertEncounterClinicalEditable(encounter);
    assertEncounterAccess(encounter, actor, {
      globalPermissions: [PERMISSION.ALLERGIES.CREATE],
      ownPermissions: [PERMISSION.ALLERGIES.CREATE],
      departmentPermissions: [PERMISSION.ALLERGIES.CREATE],
    });
  } else if (!hasPermission(actor, PERMISSION.ALLERGIES.CREATE)) {
    throw createError('Bạn không có quyền tạo allergy.', 403);
  }

  const allergy = await Allergy.create({
    patient_id: patientId,
    encounter_id: payload.encounter_id || undefined,
    recorded_by: payload.recorded_by || actor?.userId,
    allergy_type: payload.allergy_type || 'unknown',
    allergen: normalizeString(payload.allergen),
    reaction: payload.reaction,
    severity: payload.severity || ALLERGY_SEVERITY.UNKNOWN,
    onset_date: payload.onset_date || undefined,
    notes: payload.notes,
    status: ALLERGY_STATUS.ACTIVE,
    created_by: actor?.userId,
  });
  await recordAuditLog({ actor, action: 'allergy.create', targetType: 'allergy', targetId: allergy._id, status: 'success', message: 'Thêm allergy thành công.', requestMeta });
  return { allergy };
}

async function updatePatientAllergy(allergyId, payload, actor, requestMeta = {}) {
  const allergy = await Allergy.findById(allergyId);
  if (!allergy) throw createError('Không tìm thấy allergy.', 404);
  if (allergy.status === ALLERGY_STATUS.ENTERED_IN_ERROR) throw createError('Allergy entered_in_error không được sửa.', 409);
  if (!hasAnyPermission(actor, [PERMISSION.ALLERGIES.UPDATE, PERMISSION.SYSTEM.FULL_ACCESS])) throw createError('Bạn không có quyền sửa allergy.', 403);
  ensureEnum(payload.allergy_type, ALLERGY_TYPES, 'allergy_type');
  ensureEnum(payload.severity, ALLERGY_SEVERITIES, 'severity');
  const before = allergy.toObject();
  for (const field of ['allergy_type', 'allergen', 'reaction', 'severity', 'onset_date', 'notes']) {
    if (payload[field] !== undefined) allergy[field] = field === 'allergen' ? normalizeString(payload[field]) : payload[field];
  }
  allergy.updated_by = actor?.userId;
  await allergy.save();
  await recordAuditLog({ actor, action: 'allergy.update', targetType: 'allergy', targetId: allergy._id, status: 'success', message: 'Cập nhật allergy thành công.', requestMeta, before, after: allergy.toObject() });
  return { allergy };
}

async function resolvePatientAllergy(allergyId, actor, requestMeta = {}) {
  const allergy = await Allergy.findById(allergyId);
  if (!allergy) throw createError('Không tìm thấy allergy.', 404);
  if (!hasAnyPermission(actor, [PERMISSION.ALLERGIES.RESOLVE, PERMISSION.ALLERGIES.UPDATE, PERMISSION.SYSTEM.FULL_ACCESS])) throw createError('Bạn không có quyền resolve allergy.', 403);
  const before = allergy.toObject();
  allergy.status = ALLERGY_STATUS.RESOLVED;
  allergy.resolved_by = actor?.userId;
  allergy.resolved_at = new Date();
  allergy.updated_by = actor?.userId;
  await allergy.save();
  await recordAuditLog({ actor, action: 'allergy.resolve', targetType: 'allergy', targetId: allergy._id, status: 'success', message: 'Resolve allergy thành công.', requestMeta, before, after: allergy.toObject() });
  return { allergy };
}

async function markAllergyEnteredInError(allergyId, payload = {}, actor, requestMeta = {}) {
  const allergy = await Allergy.findById(allergyId);
  if (!allergy) throw createError('Không tìm thấy allergy.', 404);
  if (!hasAnyPermission(actor, [PERMISSION.ALLERGIES.UPDATE, PERMISSION.SYSTEM.FULL_ACCESS])) throw createError('Bạn không có quyền đánh dấu allergy sai.', 403);
  const before = allergy.toObject();
  allergy.status = ALLERGY_STATUS.ENTERED_IN_ERROR;
  allergy.entered_in_error_by = actor?.userId;
  allergy.entered_in_error_at = new Date();
  allergy.entered_in_error_reason = payload.reason || payload.entered_in_error_reason;
  allergy.updated_by = actor?.userId;
  await allergy.save();
  await recordAuditLog({ actor, action: 'allergy.entered_in_error', targetType: 'allergy', targetId: allergy._id, status: 'success', message: 'Đánh dấu allergy entered_in_error thành công.', requestMeta, before, after: allergy.toObject(), metadata: { reason: allergy.entered_in_error_reason || null } });
  return { allergy };
}

async function getPatientLatestProblems(patientId, actor = {}) {
  await assertPatientActive(patientId);
  if (actorType(actor) && !hasAnyPermission(actor, [PERMISSION.PROBLEMS.READ, PERMISSION.PATIENTS.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Bạn không có quyền xem problem list của bệnh nhân.', 403);
  }
  const items = await ProblemList.find({ patient_id: patientId, status: PROBLEM_STATUS.ACTIVE }).lean();
  return {
    patient_id: String(patientId),
    items: items.sort((left, right) => (PROBLEM_SEVERITY_WEIGHT[right.severity] || 0) - (PROBLEM_SEVERITY_WEIGHT[left.severity] || 0)),
  };
}

async function addPatientProblem(patientId, payload, actor, requestMeta = {}) {
  assertActorUser(actor);
  await assertPatientActive(patientId);
  if (!nonEmpty(payload.problem_name)) throw createError('problem_name là bắt buộc.');
  ensureEnum(payload.severity, PROBLEM_SEVERITIES, 'severity');
  if (payload.encounter_id) {
    const encounter = await getEncounterOrThrow(payload.encounter_id);
    if (!sameId(encounter.patient_id, patientId)) throw createError('Encounter không thuộc bệnh nhân này.', 409);
    assertEncounterClinicalEditable(encounter);
  }
  if (payload.diagnosis_id) {
    const diagnosis = await Diagnosis.findById(payload.diagnosis_id).lean();
    if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  }
  if (!hasAnyPermission(actor, [PERMISSION.PROBLEMS.CREATE, PERMISSION.SYSTEM.FULL_ACCESS])) throw createError('Bạn không có quyền tạo problem.', 403);
  const problem = await ProblemList.create({
    patient_id: patientId,
    encounter_id: payload.encounter_id || undefined,
    diagnosis_id: payload.diagnosis_id || undefined,
    recorded_by: payload.recorded_by || actor?.userId,
    icd10_code: payload.icd10_code ? normalizeString(payload.icd10_code).toUpperCase() : undefined,
    problem_name: normalizeString(payload.problem_name),
    severity: payload.severity || PROBLEM_SEVERITY.UNKNOWN,
    onset_date: payload.onset_date || undefined,
    notes: payload.notes,
    status: PROBLEM_STATUS.ACTIVE,
    created_by: actor?.userId,
  });
  await recordAuditLog({ actor, action: 'problem.create', targetType: 'problem', targetId: problem._id, status: 'success', message: 'Thêm problem thành công.', requestMeta });
  return { problem };
}

async function updatePatientProblem(problemId, payload, actor, requestMeta = {}) {
  const problem = await ProblemList.findById(problemId);
  if (!problem) throw createError('Không tìm thấy problem.', 404);
  if (problem.status === PROBLEM_STATUS.ENTERED_IN_ERROR) throw createError('Problem entered_in_error không được sửa.', 409);
  if (!hasAnyPermission(actor, [PERMISSION.PROBLEMS.UPDATE, PERMISSION.SYSTEM.FULL_ACCESS])) throw createError('Bạn không có quyền sửa problem.', 403);
  ensureEnum(payload.severity, PROBLEM_SEVERITIES, 'severity');
  const before = problem.toObject();
  for (const field of ['icd10_code', 'problem_name', 'severity', 'onset_date', 'notes']) {
    if (payload[field] !== undefined) problem[field] = field === 'icd10_code' ? normalizeString(payload[field]).toUpperCase() : payload[field];
  }
  problem.updated_by = actor?.userId;
  await problem.save();
  await recordAuditLog({ actor, action: 'problem.update', targetType: 'problem', targetId: problem._id, status: 'success', message: 'Cập nhật problem thành công.', requestMeta, before, after: problem.toObject() });
  return { problem };
}

async function resolvePatientProblem(problemId, actor, requestMeta = {}) {
  const problem = await ProblemList.findById(problemId);
  if (!problem) throw createError('Không tìm thấy problem.', 404);
  if (!hasAnyPermission(actor, [PERMISSION.PROBLEMS.RESOLVE, PERMISSION.PROBLEMS.UPDATE, PERMISSION.SYSTEM.FULL_ACCESS])) throw createError('Bạn không có quyền resolve problem.', 403);
  const before = problem.toObject();
  problem.status = PROBLEM_STATUS.RESOLVED;
  problem.resolved_at = new Date();
  problem.resolved_by = actor?.userId;
  problem.updated_by = actor?.userId;
  await problem.save();
  await recordAuditLog({ actor, action: 'problem.resolve', targetType: 'problem', targetId: problem._id, status: 'success', message: 'Resolve problem thành công.', requestMeta, before, after: problem.toObject() });
  return { problem };
}

async function markProblemEnteredInError(problemId, payload = {}, actor, requestMeta = {}) {
  const problem = await ProblemList.findById(problemId);
  if (!problem) throw createError('Không tìm thấy problem.', 404);
  if (!hasAnyPermission(actor, [PERMISSION.PROBLEMS.UPDATE, PERMISSION.SYSTEM.FULL_ACCESS])) throw createError('Bạn không có quyền đánh dấu problem sai.', 403);
  const before = problem.toObject();
  problem.status = PROBLEM_STATUS.ENTERED_IN_ERROR;
  problem.entered_in_error_by = actor?.userId;
  problem.entered_in_error_at = new Date();
  problem.entered_in_error_reason = payload.reason || payload.entered_in_error_reason;
  problem.updated_by = actor?.userId;
  await problem.save();
  await recordAuditLog({ actor, action: 'problem.entered_in_error', targetType: 'problem', targetId: problem._id, status: 'success', message: 'Đánh dấu problem entered_in_error thành công.', requestMeta, before, after: problem.toObject(), metadata: { reason: problem.entered_in_error_reason || null } });
  return { problem };
}

function normalizeCarePlanPayload(payload = {}, partial = false) {
  if (!partial && !nonEmpty(payload.title)) throw createError('title là bắt buộc.');
  const goals = Array.isArray(payload.goals) ? payload.goals.map((goal) => ({
    goal: normalizeString(goal.goal),
    target_date: goal.target_date || undefined,
    status: goal.status,
  })).filter((goal) => nonEmpty(goal.goal)) : undefined;
  const interventions = Array.isArray(payload.interventions) ? payload.interventions.map((item) => ({
    description: normalizeString(item.description),
    responsible_role: item.responsible_role,
    frequency: item.frequency,
  })).filter((item) => nonEmpty(item.description)) : undefined;
  if (payload.goals && goals.length !== payload.goals.length) throw createError('Mỗi goal phải có nội dung.');
  if (payload.interventions && interventions.length !== payload.interventions.length) throw createError('Mỗi intervention phải có description.');
  return { goals, interventions };
}

async function createCarePlan(payload, actor, requestMeta = {}) {
  assertActorUser(actor);
  const patientId = payload.patient_id;
  if (!patientId) throw createError('patient_id là bắt buộc.');
  await assertPatientActive(patientId);
  let encounter = null;
  if (payload.encounter_id) {
    encounter = await getEncounterOrThrow(payload.encounter_id);
    if (!sameId(encounter.patient_id, patientId)) throw createError('Encounter không thuộc patient này.', 409);
    assertEncounterClinicalEditable(encounter);
    assertEncounterAccess(encounter, actor, {
      globalPermissions: [PERMISSION.CARE_PLANS.MANAGE],
      ownPermissions: [PERMISSION.CARE_PLANS.CREATE],
      departmentPermissions: [PERMISSION.CARE_PLANS.CREATE],
    });
  } else if (!hasAnyPermission(actor, [PERMISSION.CARE_PLANS.CREATE, PERMISSION.CARE_PLANS.MANAGE, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Bạn không có quyền tạo care plan.', 403);
  }
  const normalized = normalizeCarePlanPayload(payload);
  const planNo = payload.plan_no || await generateCarePlanNumber();
  const carePlan = await CarePlan.create({
    patient_id: patientId,
    encounter_id: payload.encounter_id || undefined,
    admission_id: payload.admission_id || undefined,
    created_by: actor?.userId,
    plan_no: planNo,
    title: normalizeString(payload.title),
    goals: normalized.goals || [],
    interventions: normalized.interventions || [],
    start_date: payload.start_date || new Date(),
    end_date: payload.end_date || undefined,
    notes: payload.notes,
    status: payload.status === CARE_PLAN_STATUS.ACTIVE ? CARE_PLAN_STATUS.ACTIVE : CARE_PLAN_STATUS.DRAFT,
  });
  await recordAuditLog({ actor, action: 'care_plan.create', targetType: 'care_plan', targetId: carePlan._id, status: 'success', message: 'Tạo care plan thành công.', requestMeta });
  return { care_plan: carePlan };
}

async function listCarePlans(query = {}, actor = {}) {
  const filter = {};
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.encounter_id) {
    const encounter = await getEncounterOrThrow(query.encounter_id);
    assertEncounterAccess(encounter, actor, {
      globalPermissions: [PERMISSION.CARE_PLANS.READ, PERMISSION.ENCOUNTERS.READ],
      ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
      departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
    });
    filter.encounter_id = query.encounter_id;
  } else {
    await applyEncounterListScope(filter, actor, {
      globalPermissions: [PERMISSION.CARE_PLANS.READ, PERMISSION.CARE_PLANS.MANAGE, PERMISSION.ENCOUNTERS.READ],
      ownPermissions: [PERMISSION.ENCOUNTERS.READ_OWN],
      departmentPermissions: [PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
    });
  }
  if (query.admission_id) filter.admission_id = query.admission_id;
  if (query.status) filter.status = query.status;
  const items = await CarePlan.find(filter).sort({ status: 1, created_at: -1 }).lean();
  return { items };
}

async function getCarePlanDetail(carePlanId, actor = {}) {
  const carePlan = await CarePlan.findById(carePlanId).lean();
  if (!carePlan) throw createError('Không tìm thấy care plan.', 404);
  await assertCarePlanAccess(carePlan, actor, false);
  return { care_plan: carePlan };
}

async function updateCarePlan(carePlanId, payload, actor, requestMeta = {}) {
  const carePlan = await CarePlan.findById(carePlanId);
  if (!carePlan) throw createError('Không tìm thấy care plan.', 404);
  await assertCarePlanAccess(carePlan, actor, true);
  if ([CARE_PLAN_STATUS.COMPLETED, CARE_PLAN_STATUS.CANCELLED].includes(carePlan.status)) throw createError('Care plan đã terminal.', 409);
  if (!sameId(carePlan.created_by, actor?.userId) && !hasAnyPermission(actor, [PERMISSION.CARE_PLANS.MANAGE, PERMISSION.CARE_PLANS.UPDATE, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Bạn không có quyền sửa care plan.', 403);
  }
  const normalized = normalizeCarePlanPayload(payload, true);
  const before = carePlan.toObject();
  if (payload.title !== undefined) carePlan.title = normalizeString(payload.title);
  if (normalized.goals !== undefined) carePlan.goals = normalized.goals;
  if (normalized.interventions !== undefined) carePlan.interventions = normalized.interventions;
  if (payload.start_date !== undefined) carePlan.start_date = payload.start_date;
  if (payload.end_date !== undefined) carePlan.end_date = payload.end_date;
  if (payload.notes !== undefined) carePlan.notes = payload.notes;
  carePlan.updated_by = actor?.userId;
  await carePlan.save();
  await recordAuditLog({ actor, action: 'care_plan.update', targetType: 'care_plan', targetId: carePlan._id, status: 'success', message: 'Cập nhật care plan thành công.', requestMeta, before, after: carePlan.toObject() });
  return { care_plan: carePlan };
}

async function completeCarePlan(carePlanId, actor, requestMeta = {}) {
  const carePlan = await CarePlan.findById(carePlanId);
  if (!carePlan) throw createError('Không tìm thấy care plan.', 404);
  await assertCarePlanAccess(carePlan, actor, true);
  validateCarePlanStatusTransition(carePlan.status, CARE_PLAN_STATUS.COMPLETED);
  const before = carePlan.toObject();
  carePlan.status = CARE_PLAN_STATUS.COMPLETED;
  carePlan.completed_by = actor?.userId;
  carePlan.completed_at = new Date();
  carePlan.end_date = carePlan.end_date || carePlan.completed_at;
  carePlan.updated_by = actor?.userId;
  await carePlan.save();
  await recordAuditLog({ actor, action: 'care_plan.complete', targetType: 'care_plan', targetId: carePlan._id, status: 'success', message: 'Hoàn tất care plan thành công.', requestMeta, before, after: carePlan.toObject() });
  return { care_plan: carePlan };
}

async function cancelCarePlan(carePlanId, payload = {}, actor, requestMeta = {}) {
  const carePlan = await CarePlan.findById(carePlanId);
  if (!carePlan) throw createError('Không tìm thấy care plan.', 404);
  await assertCarePlanAccess(carePlan, actor, true);
  validateCarePlanStatusTransition(carePlan.status, CARE_PLAN_STATUS.CANCELLED);
  const before = carePlan.toObject();
  carePlan.status = CARE_PLAN_STATUS.CANCELLED;
  carePlan.cancelled_by = actor?.userId;
  carePlan.cancelled_at = new Date();
  carePlan.cancel_reason = payload.reason || payload.cancel_reason;
  carePlan.updated_by = actor?.userId;
  await carePlan.save();
  await recordAuditLog({ actor, action: 'care_plan.cancel', targetType: 'care_plan', targetId: carePlan._id, status: 'success', message: 'Hủy care plan thành công.', requestMeta, before, after: carePlan.toObject(), metadata: { reason: carePlan.cancel_reason || null } });
  return { care_plan: carePlan };
}

module.exports = {
  // createConsultation: Tạo phiên khám.
  createConsultation,
  // listConsultations: Liệt kê phiên khám.
  listConsultations,
  // getConsultationDetail: Lấy chi tiết phiên khám.
  getConsultationDetail,
  // updateConsultation: Cập nhật phiên khám.
  updateConsultation,
  // startConsultation: Bắt đầu phiên khám.
  startConsultation,
  // signConsultation: Ký xác nhận phiên khám.
  signConsultation,
  // amendConsultation: Sửa đổi/bổ sung phiên khám.
  amendConsultation,
  // cancelConsultation: Hủy phiên khám.
  cancelConsultation,
  // generateConsultationNumber: Sinh/tạo mã phiên khám.
  generateConsultationNumber,
  // validateConsultationCreation: Kiểm tra tính hợp lệ của điều kiện tạo phiên khám.
  validateConsultationCreation,
  // validateConsultationStatusTransition: Kiểm tra tính hợp lệ của chuyển trạng thái phiên khám.
  validateConsultationStatusTransition,
  // checkConsultationEditable: Kiểm tra điều kiện chỉnh sửa phiên khám.
  checkConsultationEditable,
  // addDiagnosis: Thêm chẩn đoán.
  addDiagnosis,
  // listDiagnosesByEncounter: Liệt kê chẩn đoán theo lượt khám.
  listDiagnosesByEncounter,
  // getDiagnosisDetail: Lấy chi tiết chẩn đoán.
  getDiagnosisDetail,
  // updateDiagnosis: Cập nhật chẩn đoán.
  updateDiagnosis,
  // resolveDiagnosis: Xác định/xử lý chẩn đoán.
  resolveDiagnosis,
  // setPrimaryDiagnosis: Thiết lập chẩn đoán chính.
  setPrimaryDiagnosis,
  // removeDiagnosis: Gỡ/xóa chẩn đoán.
  removeDiagnosis,
  // validateDiagnosisPayload: Kiểm tra tính hợp lệ của dữ liệu chẩn đoán.
  validateDiagnosisPayload,
  // ensureSinglePrimaryDiagnosis: Bảo đảm một chẩn đoán chính duy nhất.
  ensureSinglePrimaryDiagnosis,
  // recordVitalSigns: Ghi nhận dấu hiệu sinh tồn.
  recordVitalSigns,
  // listVitalSigns: Liệt kê dấu hiệu sinh tồn.
  listVitalSigns,
  // getLatestVitalSigns: Lấy dấu hiệu sinh tồn mới nhất.
  getLatestVitalSigns,
  // getVitalSignDetail: Lấy chi tiết dấu hiệu sinh tồn.
  getVitalSignDetail,
  // updateVitalSigns: Cập nhật dấu hiệu sinh tồn.
  updateVitalSigns,
  // deleteVitalSignsRecord: Xóa bản ghi dấu hiệu sinh tồn.
  deleteVitalSignsRecord,
  // calculateBMI: Tính toán BMI.
  calculateBMI,
  // validateVitalSignsPayload: Kiểm tra tính hợp lệ của dữ liệu dấu hiệu sinh tồn.
  validateVitalSignsPayload,
  // createClinicalNote: Tạo ghi chú lâm sàng.
  createClinicalNote,
  // listClinicalNotes: Liệt kê ghi chú lâm sàng.
  listClinicalNotes,
  // getClinicalNoteDetail: Lấy chi tiết ghi chú lâm sàng.
  getClinicalNoteDetail,
  // updateClinicalNote: Cập nhật ghi chú lâm sàng.
  updateClinicalNote,
  // startClinicalNote: Bắt đầu ghi chú lâm sàng.
  startClinicalNote,
  // signClinicalNote: Ký xác nhận ghi chú lâm sàng.
  signClinicalNote,
  // completeClinicalNote: Hoàn tất ghi chú lâm sàng.
  completeClinicalNote,
  // amendClinicalNote: Sửa đổi/bổ sung ghi chú lâm sàng.
  amendClinicalNote,
  // cancelClinicalNote: Hủy ghi chú lâm sàng.
  cancelClinicalNote,
  // checkClinicalNoteEditable: Kiểm tra điều kiện chỉnh sửa ghi chú lâm sàng.
  checkClinicalNoteEditable,
  // validateConsultationBeforeSign: Kiểm tra tính hợp lệ của phiên khám trước khi ký.
  validateConsultationBeforeSign,
  // validateClinicalNoteBeforeSign: Kiểm tra tính hợp lệ của ghi chú lâm sàng trước khi ký.
  validateClinicalNoteBeforeSign,
  // getEncounterClinicalSummary: Lấy tổng hợp lâm sàng của lượt khám.
  getEncounterClinicalSummary,
  // getPatientLatestAllergies: Lấy dị ứng mới nhất của bệnh nhân.
  getPatientLatestAllergies,
  // addPatientAllergy: Thêm dị ứng của bệnh nhân.
  addPatientAllergy,
  // updatePatientAllergy: Cập nhật dị ứng của bệnh nhân.
  updatePatientAllergy,
  // resolvePatientAllergy: Xác định/xử lý dị ứng của bệnh nhân.
  resolvePatientAllergy,
  // markAllergyEnteredInError: Đánh dấu thông tin dị ứng là nhập sai.
  markAllergyEnteredInError,
  // getPatientLatestProblems: Lấy vấn đề sức khỏe mới nhất của bệnh nhân.
  getPatientLatestProblems,
  // addPatientProblem: Thêm vấn đề sức khỏe của bệnh nhân.
  addPatientProblem,
  // updatePatientProblem: Cập nhật vấn đề sức khỏe của bệnh nhân.
  updatePatientProblem,
  // resolvePatientProblem: Xác định/xử lý vấn đề sức khỏe của bệnh nhân.
  resolvePatientProblem,
  // markProblemEnteredInError: Đánh dấu vấn đề sức khỏe là nhập sai.
  markProblemEnteredInError,
  // validateClinicalNotePayload: Kiểm tra tính hợp lệ của dữ liệu ghi chú lâm sàng.
  validateClinicalNotePayload,
  // createCarePlan: Tạo kế hoạch chăm sóc.
  createCarePlan,
  // listCarePlans: Liệt kê kế hoạch chăm sóc.
  listCarePlans,
  // getCarePlanDetail: Lấy chi tiết kế hoạch chăm sóc.
  getCarePlanDetail,
  // updateCarePlan: Cập nhật kế hoạch chăm sóc.
  updateCarePlan,
  // completeCarePlan: Hoàn tất kế hoạch chăm sóc.
  completeCarePlan,
  // cancelCarePlan: Hủy kế hoạch chăm sóc.
  cancelCarePlan,
  // generateCarePlanNumber: Sinh/tạo mã kế hoạch chăm sóc.
  generateCarePlanNumber,
};
