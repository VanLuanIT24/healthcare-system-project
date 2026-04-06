const {
  Appointment,
  Encounter,
  Patient,
  PatientAccount,
  PatientIdentifier,
  Prescription,
} = require('../models');
const authService = require('./auth.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  generateCode,
  getPagination,
  normalizeHumanName,
  normalizeLower,
  normalizePhone,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const PATIENT_STATUSES = ['active', 'inactive', 'deceased', 'merged', 'archived'];
const IDENTIFIER_TYPES = ['mrn', 'national_id', 'passport', 'insurance_no', 'external_system_id'];

function normalizePatientData(payload = {}) {
  return {
    full_name: payload.full_name ? normalizeHumanName(payload.full_name) : undefined,
    email: payload.email !== undefined ? normalizeLower(payload.email) || undefined : undefined,
    phone: payload.phone !== undefined ? normalizePhone(payload.phone) || undefined : undefined,
    national_id: payload.national_id !== undefined ? normalizeString(payload.national_id) || undefined : undefined,
    insurance_number: payload.insurance_number !== undefined ? normalizeString(payload.insurance_number) || undefined : undefined,
    address: payload.address !== undefined ? normalizeString(payload.address) || undefined : undefined,
    emergency_contact_name:
      payload.emergency_contact_name !== undefined ? normalizeHumanName(payload.emergency_contact_name) || undefined : undefined,
    emergency_contact_phone:
      payload.emergency_contact_phone !== undefined ? normalizePhone(payload.emergency_contact_phone) || undefined : undefined,
    gender: payload.gender || undefined,
    date_of_birth: payload.date_of_birth || undefined,
  };
}

async function detectDuplicatePatients(payload = {}) {
  const normalized = normalizePatientData(payload);
  const clauses = [];

  if (normalized.phone) clauses.push({ phone: normalized.phone });
  if (normalized.email) clauses.push({ email: normalized.email });
  if (normalized.national_id) clauses.push({ national_id: normalized.national_id });
  if (normalized.insurance_number) clauses.push({ insurance_number: normalized.insurance_number });
  if (normalized.full_name && normalized.date_of_birth) {
    clauses.push({
      full_name: normalized.full_name,
      date_of_birth: new Date(normalized.date_of_birth),
    });
  }

  if (clauses.length === 0) {
    return { items: [] };
  }

  const items = await Patient.find({
    is_deleted: false,
    $or: clauses,
  })
    .sort({ created_at: -1 })
    .limit(20)
    .lean();

  return {
    items: items.map((patient) => ({
      patient_id: String(patient._id),
      patient_code: patient.patient_code,
      full_name: patient.full_name,
      date_of_birth: patient.date_of_birth,
      phone: patient.phone,
      email: patient.email,
      national_id: patient.national_id,
      insurance_number: patient.insurance_number,
      status: patient.status,
    })),
  };
}

async function validatePatientBeforeCreate(payload = {}) {
  const normalized = normalizePatientData(payload);
  if (!normalized.full_name) {
    throw createError('full_name là bắt buộc.');
  }

  if (normalized.gender && !['male', 'female', 'other', 'unknown'].includes(normalized.gender)) {
    throw createError('gender không hợp lệ.');
  }

  return normalized;
}

async function createPatient(payload, actor, requestMeta = {}) {
  const normalized = await validatePatientBeforeCreate(payload);

  const patient = await Patient.create({
    patient_code: payload.patient_code || generateCode('PT'),
    ...normalized,
    status: payload.status || 'active',
    created_by: actor.userId,
  });

  await recordAuditLog({
    actor,
    action: 'patient.create',
    targetType: 'patient',
    targetId: patient._id,
    status: 'success',
    message: 'Tạo hồ sơ bệnh nhân thành công.',
    requestMeta,
  });

  return getPatientDetail(patient._id);
}

async function listPatients(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  const keyword = normalizeString(query.search);

  if (query.status) {
    filter.status = query.status;
  }

  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { patient_code: { $regex: pattern, $options: 'i' } },
      { full_name: { $regex: pattern, $options: 'i' } },
      { phone: { $regex: pattern, $options: 'i' } },
      { email: { $regex: pattern, $options: 'i' } },
      { national_id: { $regex: pattern, $options: 'i' } },
      { insurance_number: { $regex: pattern, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Patient.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);

  return {
    items: items.map((patient) => ({
      patient_id: String(patient._id),
      patient_code: patient.patient_code,
      full_name: patient.full_name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email,
      status: patient.status,
      national_id: patient.national_id,
      insurance_number: patient.insurance_number,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function searchPatients(query = {}) {
  return listPatients(query);
}

async function getPatientDetail(patientId) {
  const patient = await Patient.findById(patientId).lean();
  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }

  const [identifiers, account] = await Promise.all([
    PatientIdentifier.find({ patient_id: patient._id, is_deleted: false }).lean(),
    PatientAccount.findOne({ patient_id: patient._id, is_deleted: false }).lean(),
  ]);

  return {
    patient: {
      patient_id: String(patient._id),
      patient_code: patient.patient_code,
      full_name: patient.full_name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      national_id: patient.national_id,
      insurance_number: patient.insurance_number,
      emergency_contact_name: patient.emergency_contact_name,
      emergency_contact_phone: patient.emergency_contact_phone,
      status: patient.status,
      created_at: patient.created_at,
      updated_at: patient.updated_at,
    },
    identifiers: identifiers.map((item) => ({
      patient_identifier_id: String(item._id),
      identifier_type: item.identifier_type,
      identifier_value: item.identifier_value,
      issued_by: item.issued_by,
      valid_from: item.valid_from,
      valid_to: item.valid_to,
      is_primary: item.is_primary,
    })),
    account: account
      ? {
          patient_account_id: String(account._id),
          username: account.username,
          email: account.email,
          phone: account.phone,
          status: account.status,
          last_login_at: account.last_login_at,
        }
      : null,
  };
}

async function updatePatient(patientId, payload, actor, requestMeta = {}) {
  const patient = await Patient.findById(patientId);
  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }

  const normalized = normalizePatientData(payload);

  for (const [key, value] of Object.entries(normalized)) {
    if (value !== undefined) {
      patient[key] = value;
    }
  }

  patient.updated_by = actor.userId;
  await patient.save();

  await recordAuditLog({
    actor,
    action: 'patient.update',
    targetType: 'patient',
    targetId: patient._id,
    status: 'success',
    message: 'Cập nhật hồ sơ bệnh nhân thành công.',
    requestMeta,
  });

  return getPatientDetail(patient._id);
}

async function updatePatientStatus(patientId, status, actor, requestMeta = {}) {
  if (!PATIENT_STATUSES.includes(status)) {
    throw createError('Trạng thái bệnh nhân không hợp lệ.');
  }

  const patient = await Patient.findById(patientId);
  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }

  patient.status = status;
  patient.updated_by = actor.userId;
  await patient.save();

  await recordAuditLog({
    actor,
    action: 'patient.update_status',
    targetType: 'patient',
    targetId: patient._id,
    status: 'success',
    message: 'Cập nhật trạng thái bệnh nhân thành công.',
    requestMeta,
    metadata: { status },
  });

  return getPatientDetail(patient._id);
}

async function archivePatient(patientId, actor, requestMeta = {}) {
  return updatePatientStatus(patientId, 'archived', actor, requestMeta);
}

async function mergePatients() {
  throw createError('Chức năng gộp hồ sơ bệnh nhân sẽ làm ở phase sau.', 501);
}

async function validatePatientIdentifierUnique(identifierType, identifierValue, excludeId = null) {
  if (!IDENTIFIER_TYPES.includes(identifierType)) {
    throw createError('Loại định danh không hợp lệ.');
  }

  const filter = {
    identifier_type: identifierType,
    identifier_value: normalizeString(identifierValue),
    is_deleted: false,
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existing = await PatientIdentifier.findOne(filter).lean();
  if (existing) {
    throw createError('Định danh đã tồn tại trong hệ thống.', 409);
  }

  return true;
}

async function setPrimaryPatientIdentifier(patientId, identifierId, actor, requestMeta = {}) {
  const identifier = await PatientIdentifier.findOne({
    _id: identifierId,
    patient_id: patientId,
    is_deleted: false,
  });
  if (!identifier) {
    throw createError('Không tìm thấy định danh bệnh nhân.', 404);
  }

  await PatientIdentifier.updateMany(
    { patient_id: patientId, is_deleted: false },
    { $set: { is_primary: false, updated_by: actor.userId } },
  );

  identifier.is_primary = true;
  identifier.updated_by = actor.userId;
  await identifier.save();

  await recordAuditLog({
    actor,
    action: 'patient.identifier.set_primary',
    targetType: 'patient_identifier',
    targetId: identifier._id,
    status: 'success',
    message: 'Đặt định danh chính cho bệnh nhân thành công.',
    requestMeta,
  });

  return listPatientIdentifiers(patientId);
}

async function addPatientIdentifier(patientId, payload, actor, requestMeta = {}) {
  const patient = await Patient.findById(patientId).lean();
  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }

  await validatePatientIdentifierUnique(payload.identifier_type, payload.identifier_value);

  if (payload.is_primary) {
    await PatientIdentifier.updateMany(
      { patient_id: patient._id, is_deleted: false },
      { $set: { is_primary: false, updated_by: actor.userId } },
    );
  }

  const identifier = await PatientIdentifier.create({
    patient_id: patient._id,
    identifier_type: payload.identifier_type,
    identifier_value: normalizeString(payload.identifier_value),
    issued_by: normalizeString(payload.issued_by) || undefined,
    valid_from: payload.valid_from || undefined,
    valid_to: payload.valid_to || undefined,
    is_primary: Boolean(payload.is_primary),
    created_by: actor.userId,
  });

  await recordAuditLog({
    actor,
    action: 'patient.identifier.create',
    targetType: 'patient_identifier',
    targetId: identifier._id,
    status: 'success',
    message: 'Thêm định danh bệnh nhân thành công.',
    requestMeta,
  });

  return listPatientIdentifiers(patient._id);
}

async function listPatientIdentifiers(patientId) {
  const items = await PatientIdentifier.find({ patient_id: patientId, is_deleted: false }).sort({ is_primary: -1, created_at: -1 }).lean();
  return {
    patient_id: String(patientId),
    items: items.map((item) => ({
      patient_identifier_id: String(item._id),
      identifier_type: item.identifier_type,
      identifier_value: item.identifier_value,
      issued_by: item.issued_by,
      valid_from: item.valid_from,
      valid_to: item.valid_to,
      is_primary: item.is_primary,
    })),
  };
}

async function getPatientIdentifierDetail(patientId, identifierId) {
  const identifier = await PatientIdentifier.findOne({
    _id: identifierId,
    patient_id: patientId,
    is_deleted: false,
  }).lean();

  if (!identifier) {
    throw createError('Không tìm thấy định danh bệnh nhân.', 404);
  }

  return {
    patient_identifier_id: String(identifier._id),
    patient_id: String(identifier.patient_id),
    identifier_type: identifier.identifier_type,
    identifier_value: identifier.identifier_value,
    issued_by: identifier.issued_by,
    valid_from: identifier.valid_from,
    valid_to: identifier.valid_to,
    is_primary: identifier.is_primary,
  };
}

async function updatePatientIdentifier(patientId, identifierId, payload, actor, requestMeta = {}) {
  const identifier = await PatientIdentifier.findOne({
    _id: identifierId,
    patient_id: patientId,
    is_deleted: false,
  });
  if (!identifier) {
    throw createError('Không tìm thấy định danh bệnh nhân.', 404);
  }

  if (
    (payload.identifier_type && payload.identifier_type !== identifier.identifier_type) ||
    (payload.identifier_value && normalizeString(payload.identifier_value) !== identifier.identifier_value)
  ) {
    await validatePatientIdentifierUnique(payload.identifier_type || identifier.identifier_type, payload.identifier_value || identifier.identifier_value, identifier._id);
  }

  if (payload.identifier_type) identifier.identifier_type = payload.identifier_type;
  if (payload.identifier_value) identifier.identifier_value = normalizeString(payload.identifier_value);
  if (payload.issued_by !== undefined) identifier.issued_by = normalizeString(payload.issued_by) || undefined;
  if (payload.valid_from !== undefined) identifier.valid_from = payload.valid_from || undefined;
  if (payload.valid_to !== undefined) identifier.valid_to = payload.valid_to || undefined;
  identifier.updated_by = actor.userId;
  await identifier.save();

  if (payload.is_primary) {
    await setPrimaryPatientIdentifier(patientId, identifier._id, actor, requestMeta);
  }

  await recordAuditLog({
    actor,
    action: 'patient.identifier.update',
    targetType: 'patient_identifier',
    targetId: identifier._id,
    status: 'success',
    message: 'Cập nhật định danh bệnh nhân thành công.',
    requestMeta,
  });

  return getPatientIdentifierDetail(patientId, identifier._id);
}

async function removePatientIdentifier(patientId, identifierId, actor, requestMeta = {}) {
  const identifier = await PatientIdentifier.findOne({
    _id: identifierId,
    patient_id: patientId,
    is_deleted: false,
  });
  if (!identifier) {
    throw createError('Không tìm thấy định danh bệnh nhân.', 404);
  }

  identifier.is_deleted = true;
  identifier.deleted_at = new Date();
  identifier.deleted_by = actor.userId;
  identifier.updated_by = actor.userId;
  await identifier.save();

  await recordAuditLog({
    actor,
    action: 'patient.identifier.soft_delete',
    targetType: 'patient_identifier',
    targetId: identifier._id,
    status: 'success',
    message: 'Xóa mềm định danh bệnh nhân thành công.',
    requestMeta,
  });

  return { success: true };
}

async function linkUserAccountToPatient(patientId, patientAccountId, actor, requestMeta = {}) {
  const [patient, account] = await Promise.all([
    Patient.findById(patientId),
    PatientAccount.findById(patientAccountId),
  ]);

  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }
  if (!account || account.is_deleted) {
    throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  }

  if (account.patient_id && String(account.patient_id) !== String(patient._id)) {
    throw createError('Tài khoản này đang liên kết với bệnh nhân khác.', 409);
  }

  account.patient_id = patient._id;
  account.updated_by = actor.userId;
  await account.save();

  await recordAuditLog({
    actor,
    action: 'patient.account.link',
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Liên kết tài khoản với hồ sơ bệnh nhân thành công.',
    requestMeta,
  });

  return getPatientDetail(patient._id);
}

async function getMyPatientProfile(auth) {
  if (auth.actorType !== 'patient') {
    throw createError('Chỉ tài khoản bệnh nhân mới dùng được chức năng này.', 403);
  }

  return getPatientDetail(auth.patientId);
}

async function updateMyPatientProfile(auth, payload, requestMeta = {}) {
  if (auth.actorType !== 'patient') {
    throw createError('Chỉ tài khoản bệnh nhân mới dùng được chức năng này.', 403);
  }

  const profilePayload = {
    full_name: payload.full_name,
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
  };

  await authService.updateMyProfile(auth, profilePayload, requestMeta);
  return getPatientDetail(auth.patientId);
}

async function getPatientAppointmentHistory(patientId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    Appointment.find({ patient_id: patientId, is_deleted: false }).sort({ appointment_time: -1 }).skip(skip).limit(limit).lean(),
    Appointment.countDocuments({ patient_id: patientId, is_deleted: false }),
  ]);

  return {
    patient_id: String(patientId),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function getPatientEncounterHistory(patientId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    Encounter.find({ patient_id: patientId }).sort({ start_time: -1 }).skip(skip).limit(limit).lean(),
    Encounter.countDocuments({ patient_id: patientId }),
  ]);

  return {
    patient_id: String(patientId),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function getPatientPrescriptionHistory(patientId, query = {}) {
  const encounterIds = (await Encounter.find({ patient_id: patientId }).select('_id').lean()).map((item) => item._id);
  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    Prescription.find({ encounter_id: { $in: encounterIds } }).sort({ prescribed_at: -1 }).skip(skip).limit(limit).lean(),
    Prescription.countDocuments({ encounter_id: { $in: encounterIds } }),
  ]);

  return {
    patient_id: String(patientId),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function checkPatientCanBookAppointment(patientId) {
  const patient = await Patient.findById(patientId).lean();
  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }

  if (patient.status !== 'active') {
    throw createError('Bệnh nhân hiện không đủ điều kiện để đặt lịch.', 409);
  }

  return {
    patient_id: String(patient._id),
    can_book: patient.status === 'active',
    status: patient.status,
  };
}

async function getPatientSummary(patientId) {
  const patient = await Patient.findById(patientId).lean();
  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }

  const [appointmentsCount, encounters, prescriptions] = await Promise.all([
    Appointment.countDocuments({ patient_id: patient._id, is_deleted: false }),
    Encounter.find({ patient_id: patient._id }).sort({ start_time: -1 }).limit(1).lean(),
    getPatientPrescriptionHistory(patient._id, { page: 1, limit: 1 }),
  ]);

  const encountersCount = await Encounter.countDocuments({ patient_id: patient._id });

  return {
    patient_id: String(patient._id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    appointments_count: appointmentsCount,
    encounters_count: encountersCount,
    last_encounter: encounters[0] || null,
    last_prescription: prescriptions.items[0] || null,
  };
}

async function checkPatientCanBeMerged(sourcePatientId, targetPatientId) {
  if (String(sourcePatientId) === String(targetPatientId)) {
    throw createError('Không thể merge một hồ sơ vào chính nó.', 409);
  }

  const [source, target] = await Promise.all([
    Patient.findById(sourcePatientId).lean(),
    Patient.findById(targetPatientId).lean(),
  ]);

  if (!source || source.is_deleted || !target || target.is_deleted) {
    throw createError('Không tìm thấy một trong hai hồ sơ bệnh nhân.', 404);
  }

  return {
    can_merge: !['deceased', 'merged'].includes(source.status),
    source_patient_id: String(source._id),
    target_patient_id: String(target._id),
    reason: ['deceased', 'merged'].includes(source.status) ? 'Hồ sơ nguồn không còn phù hợp để merge.' : null,
  };
}

async function previewPatientMerge(sourcePatientId, targetPatientId) {
  const mergeCheck = await checkPatientCanBeMerged(sourcePatientId, targetPatientId);
  const [source, target, sourceIdentifiers, targetIdentifiers] = await Promise.all([
    Patient.findById(sourcePatientId).lean(),
    Patient.findById(targetPatientId).lean(),
    PatientIdentifier.find({ patient_id: sourcePatientId, is_deleted: false }).lean(),
    PatientIdentifier.find({ patient_id: targetPatientId, is_deleted: false }).lean(),
  ]);

  return {
    ...mergeCheck,
    source_patient: source,
    target_patient: target,
    source_identifiers: sourceIdentifiers,
    target_identifiers: targetIdentifiers,
    merged_preview: {
      full_name: target.full_name || source.full_name,
      phone: target.phone || source.phone,
      email: target.email || source.email,
      national_id: target.national_id || source.national_id,
      insurance_number: target.insurance_number || source.insurance_number,
    },
  };
}

async function getPatientTimeline(patientId, query = {}) {
  const patient = await Patient.findById(patientId).lean();
  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }

  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300);
  const [appointments, encounters, prescriptions] = await Promise.all([
    Appointment.find({ patient_id: patient._id, is_deleted: false }).sort({ appointment_time: -1 }).limit(limit).lean(),
    Encounter.find({ patient_id: patient._id }).sort({ start_time: -1 }).limit(limit).lean(),
    getPatientPrescriptionHistory(patient._id, { page: 1, limit }),
  ]);

  const events = [
    ...appointments.map((item) => ({
      type: 'appointment',
      occurred_at: item.appointment_time,
      data: item,
    })),
    ...encounters.map((item) => ({
      type: 'encounter',
      occurred_at: item.start_time,
      data: item,
    })),
    ...prescriptions.items.map((item) => ({
      type: 'prescription',
      occurred_at: item.prescribed_at,
      data: item,
    })),
  ].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));

  return {
    patient_id: String(patient._id),
    items: events,
  };
}

async function listPatientProblems() {
  throw createError('Problem list sẽ làm ở phase 2.', 501);
}

async function addPatientProblem() {
  throw createError('Problem list sẽ làm ở phase 2.', 501);
}

async function updatePatientProblem() {
  throw createError('Problem list sẽ làm ở phase 2.', 501);
}

async function resolvePatientProblem() {
  throw createError('Problem list sẽ làm ở phase 2.', 501);
}

async function listPatientAllergies() {
  throw createError('Allergy module sẽ làm ở phase 2.', 501);
}

async function addPatientAllergy() {
  throw createError('Allergy module sẽ làm ở phase 2.', 501);
}

async function updatePatientAllergy() {
  throw createError('Allergy module sẽ làm ở phase 2.', 501);
}

async function removePatientAllergy() {
  throw createError('Allergy module sẽ làm ở phase 2.', 501);
}

module.exports = {
  normalizePatientData,
  detectDuplicatePatients,
  validatePatientBeforeCreate,
  createPatient,
  listPatients,
  searchPatients,
  getPatientDetail,
  updatePatient,
  updatePatientStatus,
  archivePatient,
  mergePatients,
  addPatientIdentifier,
  listPatientIdentifiers,
  getPatientIdentifierDetail,
  updatePatientIdentifier,
  removePatientIdentifier,
  setPrimaryPatientIdentifier,
  validatePatientIdentifierUnique,
  linkUserAccountToPatient,
  getMyPatientProfile,
  updateMyPatientProfile,
  listPatientProblems,
  addPatientProblem,
  updatePatientProblem,
  resolvePatientProblem,
  listPatientAllergies,
  addPatientAllergy,
  updatePatientAllergy,
  removePatientAllergy,
  getPatientAppointmentHistory,
  getPatientEncounterHistory,
  getPatientPrescriptionHistory,
  getPatientSummary,
  checkPatientCanBeMerged,
  previewPatientMerge,
  getPatientTimeline,
  checkPatientCanBookAppointment,
};
