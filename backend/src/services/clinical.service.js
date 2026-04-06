const {
  ClinicalNote,
  Consultation,
  Diagnosis,
  Encounter,
  User,
  VitalSign,
} = require('../models');
const {
  buildPagination,
  createError,
  generateCode,
  getPagination,
  recordAuditLog,
} = require('./core.service');

const CONSULTATION_STATUS_TRANSITIONS = {
  draft: ['in_progress', 'signed', 'cancelled'],
  in_progress: ['signed', 'cancelled'],
  signed: ['amended'],
  amended: ['signed'],
  cancelled: [],
};

const CLINICAL_NOTE_STATUS_TRANSITIONS = {
  draft: ['in_progress', 'signed', 'cancelled'],
  in_progress: ['signed', 'cancelled'],
  signed: ['amended'],
  amended: ['signed'],
  cancelled: [],
};

function generateConsultationNumber() {
  return generateCode('CON');
}

function validateConsultationStatusTransition(currentStatus, nextStatus) {
  const allowed = CONSULTATION_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw createError(`Không thể chuyển trạng thái consultation từ ${currentStatus} sang ${nextStatus}.`, 409);
  }
  return true;
}

function validateClinicalNoteStatusTransition(currentStatus, nextStatus) {
  const allowed = CLINICAL_NOTE_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw createError(`Không thể chuyển trạng thái clinical note từ ${currentStatus} sang ${nextStatus}.`, 409);
  }
  return true;
}

async function validateConsultationCreation(payload) {
  const [encounter, doctor] = await Promise.all([
    Encounter.findById(payload.encounter_id).lean(),
    User.findById(payload.doctor_id).lean(),
  ]);

  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') throw createError('Không tìm thấy bác sĩ.', 404);
  return { encounter, doctor };
}

async function checkConsultationEditable(consultationId) {
  const consultation = await Consultation.findById(consultationId).lean();
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  return {
    consultation_id: String(consultation._id),
    editable: ['draft', 'in_progress', 'amended'].includes(consultation.status),
    status: consultation.status,
  };
}

async function createConsultation(payload, actor, requestMeta = {}) {
  await validateConsultationCreation(payload);

  const consultation = await Consultation.create({
    encounter_id: payload.encounter_id,
    doctor_id: payload.doctor_id,
    consultation_no: payload.consultation_no || generateConsultationNumber(),
    chief_complaint: payload.chief_complaint,
    history_present_illness: payload.history_present_illness,
    physical_exam: payload.physical_exam,
    assessment: payload.assessment,
    plan: payload.plan,
    status: payload.status || 'draft',
    created_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'consultation.create',
    targetType: 'consultation',
    targetId: consultation._id,
    status: 'success',
    message: 'Tạo consultation thành công.',
    requestMeta,
  });

  return getConsultationDetail(consultation._id);
}

async function listConsultations(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.encounter_id) filter.encounter_id = query.encounter_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Consultation.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Consultation.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
}

async function getConsultationDetail(consultationId) {
  const consultation = await Consultation.findById(consultationId).lean();
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  const diagnoses = await Diagnosis.find({ consultation_id: consultation._id }).sort({ created_at: -1 }).lean();
  return { consultation, diagnoses };
}

async function updateConsultation(consultationId, payload, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  const editable = await checkConsultationEditable(consultation._id);
  if (!editable.editable) throw createError('Consultation hiện không thể chỉnh sửa.', 409);

  if (payload.chief_complaint !== undefined) consultation.chief_complaint = payload.chief_complaint;
  if (payload.history_present_illness !== undefined) consultation.history_present_illness = payload.history_present_illness;
  if (payload.physical_exam !== undefined) consultation.physical_exam = payload.physical_exam;
  if (payload.assessment !== undefined) consultation.assessment = payload.assessment;
  if (payload.plan !== undefined) consultation.plan = payload.plan;
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
  });

  return getConsultationDetail(consultation._id);
}

async function startConsultation(consultationId, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  validateConsultationStatusTransition(consultation.status, 'in_progress');
  consultation.status = 'in_progress';
  consultation.updated_by = actor?.userId;
  await consultation.save();
  await recordAuditLog({ actor, action: 'consultation.start', targetType: 'consultation', targetId: consultation._id, status: 'success', message: 'Bắt đầu consultation thành công.', requestMeta });
  return getConsultationDetail(consultation._id);
}

async function signConsultation(consultationId, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  await validateConsultationBeforeSign(consultation._id, actor);
  validateConsultationStatusTransition(consultation.status, 'signed');
  consultation.status = 'signed';
  consultation.updated_by = actor?.userId;
  await consultation.save();
  await recordAuditLog({ actor, action: 'consultation.sign', targetType: 'consultation', targetId: consultation._id, status: 'success', message: 'Ký consultation thành công.', requestMeta });
  return getConsultationDetail(consultation._id);
}

async function amendConsultation(consultationId, payload, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  validateConsultationStatusTransition(consultation.status, 'amended');
  consultation.status = 'amended';
  if (payload.chief_complaint !== undefined) consultation.chief_complaint = payload.chief_complaint;
  if (payload.history_present_illness !== undefined) consultation.history_present_illness = payload.history_present_illness;
  if (payload.physical_exam !== undefined) consultation.physical_exam = payload.physical_exam;
  if (payload.assessment !== undefined) consultation.assessment = payload.assessment;
  if (payload.plan !== undefined) consultation.plan = payload.plan;
  consultation.updated_by = actor?.userId;
  await consultation.save();
  await recordAuditLog({ actor, action: 'consultation.amend', targetType: 'consultation', targetId: consultation._id, status: 'success', message: 'Sửa bổ sung consultation thành công.', requestMeta });
  return getConsultationDetail(consultation._id);
}

async function cancelConsultation(consultationId, actor, requestMeta = {}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);
  validateConsultationStatusTransition(consultation.status, 'cancelled');
  consultation.status = 'cancelled';
  consultation.updated_by = actor?.userId;
  await consultation.save();
  await recordAuditLog({ actor, action: 'consultation.cancel', targetType: 'consultation', targetId: consultation._id, status: 'success', message: 'Hủy consultation thành công.', requestMeta });
  return getConsultationDetail(consultation._id);
}

function validateDiagnosisPayload(payload = {}) {
  if (!payload.diagnosis_name) throw createError('diagnosis_name là bắt buộc.');
  return true;
}

async function ensureSinglePrimaryDiagnosis(encounterId, diagnosisIdToKeep = null, actorId = null) {
  const filter = { encounter_id: encounterId, is_primary: true };
  if (diagnosisIdToKeep) filter._id = { $ne: diagnosisIdToKeep };
  await Diagnosis.updateMany(filter, { $set: { is_primary: false, updated_by: actorId } });
}

async function addDiagnosis(payload, actor, requestMeta = {}) {
  validateDiagnosisPayload(payload);
  const encounter = await Encounter.findById(payload.encounter_id).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (payload.is_primary) await ensureSinglePrimaryDiagnosis(payload.encounter_id, null, actor?.userId);

  const diagnosis = await Diagnosis.create({
    encounter_id: payload.encounter_id,
    consultation_id: payload.consultation_id || undefined,
    recorded_by: payload.recorded_by || actor?.userId,
    icd10_code: payload.icd10_code,
    diagnosis_name: payload.diagnosis_name,
    diagnosis_type: payload.diagnosis_type || 'provisional',
    is_primary: Boolean(payload.is_primary),
    onset_date: payload.onset_date || undefined,
    notes: payload.notes,
    status: payload.status || 'active',
    created_by: actor?.userId,
  });

  await recordAuditLog({ actor, action: 'diagnosis.create', targetType: 'diagnosis', targetId: diagnosis._id, status: 'success', message: 'Thêm chẩn đoán thành công.', requestMeta });
  return getDiagnosisDetail(diagnosis._id);
}

async function listDiagnosesByEncounter(encounterId) {
  const items = await Diagnosis.find({ encounter_id: encounterId }).sort({ is_primary: -1, created_at: -1 }).lean();
  return { encounter_id: String(encounterId), items };
}

async function getDiagnosisDetail(diagnosisId) {
  const diagnosis = await Diagnosis.findById(diagnosisId).lean();
  if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  return { diagnosis };
}

async function updateDiagnosis(diagnosisId, payload, actor, requestMeta = {}) {
  const diagnosis = await Diagnosis.findById(diagnosisId);
  if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  if (payload.is_primary) await ensureSinglePrimaryDiagnosis(diagnosis.encounter_id, diagnosis._id, actor?.userId);

  if (payload.icd10_code !== undefined) diagnosis.icd10_code = payload.icd10_code;
  if (payload.diagnosis_name !== undefined) diagnosis.diagnosis_name = payload.diagnosis_name;
  if (payload.diagnosis_type !== undefined) diagnosis.diagnosis_type = payload.diagnosis_type;
  if (payload.is_primary !== undefined) diagnosis.is_primary = Boolean(payload.is_primary);
  if (payload.onset_date !== undefined) diagnosis.onset_date = payload.onset_date || undefined;
  if (payload.notes !== undefined) diagnosis.notes = payload.notes;
  if (payload.status !== undefined) diagnosis.status = payload.status;
  diagnosis.updated_by = actor?.userId;
  await diagnosis.save();

  await recordAuditLog({ actor, action: 'diagnosis.update', targetType: 'diagnosis', targetId: diagnosis._id, status: 'success', message: 'Cập nhật chẩn đoán thành công.', requestMeta });
  return getDiagnosisDetail(diagnosis._id);
}

async function setPrimaryDiagnosis(diagnosisId, actor, requestMeta = {}) {
  const diagnosis = await Diagnosis.findById(diagnosisId);
  if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
  await ensureSinglePrimaryDiagnosis(diagnosis.encounter_id, diagnosis._id, actor?.userId);
  diagnosis.is_primary = true;
  diagnosis.updated_by = actor?.userId;
  await diagnosis.save();
  await recordAuditLog({ actor, action: 'diagnosis.set_primary', targetType: 'diagnosis', targetId: diagnosis._id, status: 'success', message: 'Đặt chẩn đoán chính thành công.', requestMeta });
  return getDiagnosisDetail(diagnosis._id);
}

async function resolveDiagnosis(diagnosisId, actor, requestMeta = {}) {
  return updateDiagnosis(diagnosisId, { status: 'resolved' }, actor, requestMeta);
}

async function removeDiagnosis(diagnosisId, actor, requestMeta = {}) {
  return updateDiagnosis(diagnosisId, { status: 'entered_in_error', is_primary: false }, actor, requestMeta);
}

function calculateBMI({ weight, height }) {
  const numericWeight = Number(weight);
  const numericHeight = Number(height);
  if (!numericWeight || !numericHeight) return null;
  const meters = numericHeight > 10 ? numericHeight / 100 : numericHeight;
  if (!meters) return null;
  return Number((numericWeight / (meters * meters)).toFixed(2));
}

function validateVitalSignsPayload(payload = {}) {
  if (!payload.encounter_id) throw createError('encounter_id là bắt buộc.');
  if (!payload.recorded_at) throw createError('recorded_at là bắt buộc.');
  return true;
}

async function recordVitalSigns(payload, actor, requestMeta = {}) {
  validateVitalSignsPayload(payload);
  const encounter = await Encounter.findById(payload.encounter_id).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  const bmi = payload.bmi !== undefined ? payload.bmi : calculateBMI({ weight: payload.weight, height: payload.height });

  const vitalSign = await VitalSign.create({
    encounter_id: payload.encounter_id,
    recorded_by: payload.recorded_by || actor?.userId,
    temperature: payload.temperature,
    heart_rate: payload.heart_rate,
    respiratory_rate: payload.respiratory_rate,
    systolic_bp: payload.systolic_bp,
    diastolic_bp: payload.diastolic_bp,
    spo2: payload.spo2,
    weight: payload.weight,
    height: payload.height,
    bmi,
    recorded_at: new Date(payload.recorded_at),
    status: payload.status || 'recorded',
  });

  await recordAuditLog({ actor, action: 'vital_sign.create', targetType: 'vital_sign', targetId: vitalSign._id, status: 'success', message: 'Ghi nhận vital signs thành công.', requestMeta });
  return getVitalSignDetail(vitalSign._id);
}

async function listVitalSigns(encounterId) {
  const items = await VitalSign.find({ encounter_id: encounterId }).sort({ recorded_at: -1 }).lean();
  return { encounter_id: String(encounterId), items };
}

async function getLatestVitalSigns(encounterId) {
  const item = await VitalSign.findOne({ encounter_id: encounterId }).sort({ recorded_at: -1 }).lean();
  return { encounter_id: String(encounterId), item };
}

async function getVitalSignDetail(vitalSignId) {
  const vitalSign = await VitalSign.findById(vitalSignId).lean();
  if (!vitalSign) throw createError('Không tìm thấy vital sign.', 404);
  return { vital_sign: vitalSign };
}

async function updateVitalSigns(vitalSignId, payload, actor, requestMeta = {}) {
  const vitalSign = await VitalSign.findById(vitalSignId);
  if (!vitalSign) throw createError('Không tìm thấy vital sign.', 404);
  const fields = ['temperature', 'heart_rate', 'respiratory_rate', 'systolic_bp', 'diastolic_bp', 'spo2', 'weight', 'height', 'status'];
  for (const field of fields) {
    if (payload[field] !== undefined) vitalSign[field] = payload[field];
  }
  if (payload.recorded_at !== undefined) vitalSign.recorded_at = payload.recorded_at;
  vitalSign.bmi = payload.bmi !== undefined ? payload.bmi : calculateBMI({ weight: vitalSign.weight, height: vitalSign.height });
  vitalSign.updated_by = actor?.userId;
  await vitalSign.save();
  await recordAuditLog({ actor, action: 'vital_sign.update', targetType: 'vital_sign', targetId: vitalSign._id, status: 'success', message: 'Cập nhật vital signs thành công.', requestMeta });
  return getVitalSignDetail(vitalSign._id);
}

async function deleteVitalSignsRecord(vitalSignId, actor, requestMeta = {}) {
  return updateVitalSigns(vitalSignId, { status: 'entered_in_error' }, actor, requestMeta);
}

function validateClinicalNotePayload(payload = {}) {
  if (!payload.encounter_id) throw createError('encounter_id là bắt buộc.');
  if (!payload.content) throw createError('content là bắt buộc.');
  return true;
}

async function createClinicalNote(payload, actor, requestMeta = {}) {
  validateClinicalNotePayload(payload);
  const encounter = await Encounter.findById(payload.encounter_id).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  const note = await ClinicalNote.create({
    encounter_id: payload.encounter_id,
    consultation_id: payload.consultation_id || undefined,
    author_id: payload.author_id || actor?.userId,
    note_type: payload.note_type || 'progress_note',
    title: payload.title,
    content: payload.content,
    status: payload.status || 'draft',
    created_by: actor?.userId,
  });
  await recordAuditLog({ actor, action: 'clinical_note.create', targetType: 'clinical_note', targetId: note._id, status: 'success', message: 'Tạo clinical note thành công.', requestMeta });
  return getClinicalNoteDetail(note._id);
}

async function listClinicalNotes(query = {}) {
  const filter = {};
  if (query.encounter_id) filter.encounter_id = query.encounter_id;
  if (query.consultation_id) filter.consultation_id = query.consultation_id;
  if (query.status) filter.status = query.status;
  const items = await ClinicalNote.find(filter).sort({ created_at: -1 }).lean();
  return { items };
}

async function getClinicalNoteDetail(noteId) {
  const note = await ClinicalNote.findById(noteId).lean();
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  return { clinical_note: note };
}

async function updateClinicalNote(noteId, payload, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  if (!['draft', 'in_progress', 'amended'].includes(note.status)) throw createError('Clinical note hiện không thể chỉnh sửa.', 409);
  if (payload.note_type !== undefined) note.note_type = payload.note_type;
  if (payload.title !== undefined) note.title = payload.title;
  if (payload.content !== undefined) note.content = payload.content;
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({ actor, action: 'clinical_note.update', targetType: 'clinical_note', targetId: note._id, status: 'success', message: 'Cập nhật clinical note thành công.', requestMeta });
  return getClinicalNoteDetail(note._id);
}

async function startClinicalNote(noteId, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  validateClinicalNoteStatusTransition(note.status, 'in_progress');
  note.status = 'in_progress';
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({ actor, action: 'clinical_note.start', targetType: 'clinical_note', targetId: note._id, status: 'success', message: 'Bắt đầu clinical note thành công.', requestMeta });
  return getClinicalNoteDetail(note._id);
}

async function signClinicalNote(noteId, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  await validateClinicalNoteBeforeSign(note._id, actor);
  validateClinicalNoteStatusTransition(note.status, 'signed');
  note.status = 'signed';
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({ actor, action: 'clinical_note.sign', targetType: 'clinical_note', targetId: note._id, status: 'success', message: 'Ký clinical note thành công.', requestMeta });
  return getClinicalNoteDetail(note._id);
}

async function amendClinicalNote(noteId, payload, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  validateClinicalNoteStatusTransition(note.status, 'amended');
  note.status = 'amended';
  if (payload.title !== undefined) note.title = payload.title;
  if (payload.content !== undefined) note.content = payload.content;
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({ actor, action: 'clinical_note.amend', targetType: 'clinical_note', targetId: note._id, status: 'success', message: 'Sửa bổ sung clinical note thành công.', requestMeta });
  return getClinicalNoteDetail(note._id);
}

async function cancelClinicalNote(noteId, actor, requestMeta = {}) {
  const note = await ClinicalNote.findById(noteId);
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  validateClinicalNoteStatusTransition(note.status, 'cancelled');
  note.status = 'cancelled';
  note.updated_by = actor?.userId;
  await note.save();
  await recordAuditLog({ actor, action: 'clinical_note.cancel', targetType: 'clinical_note', targetId: note._id, status: 'success', message: 'Hủy clinical note thành công.', requestMeta });
  return getClinicalNoteDetail(note._id);
}

async function completeClinicalNote(noteId, actor, requestMeta = {}) {
  return signClinicalNote(noteId, actor, requestMeta);
}

async function validateConsultationBeforeSign(consultationId, actor = null) {
  const consultation = await Consultation.findById(consultationId).lean();
  if (!consultation) throw createError('Không tìm thấy consultation.', 404);

  const encounter = await Encounter.findById(consultation.encounter_id).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (encounter.status === 'completed') {
    throw createError('Encounter đã completed nên không thể ký consultation mới.', 409);
  }
  if (actor?.userId && String(consultation.doctor_id) !== String(actor.userId) && !(actor.roles || []).includes('super_admin')) {
    throw createError('Chỉ bác sĩ phụ trách hoặc super_admin mới được ký consultation này.', 403);
  }
  if (!String(consultation.assessment || '').trim() && !String(consultation.plan || '').trim()) {
    throw createError('Consultation cần có assessment hoặc plan trước khi ký.', 409);
  }

  return {
    consultation_id: String(consultation._id),
    can_sign: true,
  };
}

async function validateClinicalNoteBeforeSign(noteId, actor = null) {
  const note = await ClinicalNote.findById(noteId).lean();
  if (!note) throw createError('Không tìm thấy clinical note.', 404);
  if (!String(note.content || '').trim()) {
    throw createError('Clinical note phải có nội dung trước khi ký.', 409);
  }
  if (actor?.userId && String(note.author_id) !== String(actor.userId) && !(actor.roles || []).includes('super_admin')) {
    throw createError('Chỉ tác giả hoặc super_admin mới được ký clinical note này.', 403);
  }
  return {
    clinical_note_id: String(note._id),
    can_sign: true,
  };
}

async function getEncounterClinicalSummary(encounterId) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  const [consultation, diagnosis, latestVitals, latestNotes] = await Promise.all([
    Consultation.findOne({ encounter_id: encounter._id }).sort({ created_at: -1 }).lean(),
    Diagnosis.findOne({ encounter_id: encounter._id, is_primary: true }).sort({ created_at: -1 }).lean(),
    VitalSign.findOne({ encounter_id: encounter._id }).sort({ recorded_at: -1 }).lean(),
    ClinicalNote.find({ encounter_id: encounter._id }).sort({ created_at: -1 }).limit(5).lean(),
  ]);

  return {
    encounter_id: String(encounter._id),
    consultation,
    primary_diagnosis: diagnosis,
    latest_vital_signs: latestVitals,
    latest_notes: latestNotes,
  };
}

async function getPatientLatestAllergies(patientId) {
  return {
    patient_id: String(patientId),
    implemented: false,
    items: [],
    message: 'Module dị ứng chưa được triển khai schema riêng ở phase hiện tại.',
  };
}

async function getPatientLatestProblems(patientId) {
  return {
    patient_id: String(patientId),
    implemented: false,
    items: [],
    message: 'Module problem list chưa được triển khai schema riêng ở phase hiện tại.',
  };
}

async function createCarePlan() { throw createError('Care plan sẽ làm ở phase sau.', 501); }
async function listCarePlans() { throw createError('Care plan sẽ làm ở phase sau.', 501); }
async function getCarePlanDetail() { throw createError('Care plan sẽ làm ở phase sau.', 501); }
async function updateCarePlan() { throw createError('Care plan sẽ làm ở phase sau.', 501); }
async function completeCarePlan() { throw createError('Care plan sẽ làm ở phase sau.', 501); }
async function cancelCarePlan() { throw createError('Care plan sẽ làm ở phase sau.', 501); }

module.exports = {
  createConsultation,
  listConsultations,
  getConsultationDetail,
  updateConsultation,
  startConsultation,
  signConsultation,
  amendConsultation,
  cancelConsultation,
  generateConsultationNumber,
  validateConsultationCreation,
  validateConsultationStatusTransition,
  checkConsultationEditable,
  addDiagnosis,
  listDiagnosesByEncounter,
  getDiagnosisDetail,
  updateDiagnosis,
  resolveDiagnosis,
  setPrimaryDiagnosis,
  removeDiagnosis,
  validateDiagnosisPayload,
  ensureSinglePrimaryDiagnosis,
  recordVitalSigns,
  listVitalSigns,
  getLatestVitalSigns,
  getVitalSignDetail,
  updateVitalSigns,
  deleteVitalSignsRecord,
  calculateBMI,
  validateVitalSignsPayload,
  createClinicalNote,
  listClinicalNotes,
  getClinicalNoteDetail,
  updateClinicalNote,
  startClinicalNote,
  signClinicalNote,
  completeClinicalNote,
  amendClinicalNote,
  cancelClinicalNote,
  validateConsultationBeforeSign,
  validateClinicalNoteBeforeSign,
  getEncounterClinicalSummary,
  getPatientLatestAllergies,
  getPatientLatestProblems,
  validateClinicalNotePayload,
  createCarePlan,
  listCarePlans,
  getCarePlanDetail,
  updateCarePlan,
  completeCarePlan,
  cancelCarePlan,
};
