const {
  Admission,
  Attachment,
  Charge,
  Consultation,
  Diagnosis,
  Dispense,
  Encounter,
  ImagingOrder,
  ImagingReport,
  InsuranceClaim,
  Invoice,
  LabOrder,
  LabResult,
  MedicalRecord,
  Order,
  Patient,
  PatientAuthorization,
  PatientRelative,
  Payment,
  Prescription,
  ProcedureOrder,
  Department,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ADMISSION_STATUS,
  ATTACHMENT_ENTITY_TYPE,
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_STATUS,
  AUTHORIZATION_STATUS,
  AUTHORIZATION_TYPE,
  CONSULTATION_STATUS,
  DIAGNOSIS_STATUS,
  ENCOUNTER_STATUS,
  IMAGING_REPORT_STATUS,
  INVOICE_STATUS,
  LAB_RESULT_STATUS,
  MEDICAL_RECORD_STATUS,
  PATIENT_STATUS,
  RECORD_TYPE,
  RELATIVE_STATUS,
} = require('../constants/statuses');
const path = require('path');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const permissionService = require('./permission.service');
const notificationService = require('./notification.service');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const ACTIVE_RECORD_STATUSES = [
  MEDICAL_RECORD_STATUS.DRAFT,
  MEDICAL_RECORD_STATUS.ACTIVE,
  MEDICAL_RECORD_STATUS.FINALIZED,
  MEDICAL_RECORD_STATUS.SEALED,
];

const FINALIZED_RECORD_STATUSES = [
  MEDICAL_RECORD_STATUS.FINALIZED,
  MEDICAL_RECORD_STATUS.SEALED,
  MEDICAL_RECORD_STATUS.ARCHIVED,
];

const READABLE_ATTACHMENT_STATUSES = [
  ATTACHMENT_STATUS.ACTIVE,
  ATTACHMENT_STATUS.ARCHIVED,
];

const FINAL_LAB_STATUSES = [
  LAB_RESULT_STATUS.FINAL,
  LAB_RESULT_STATUS.AMENDED,
];

const FINAL_IMAGING_STATUSES = [
  IMAGING_REPORT_STATUS.FINAL,
  IMAGING_REPORT_STATUS.AMENDED,
];

const MAX_EXPORT_LIMIT = 1000;
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const SAFE_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.tif',
  '.tiff',
  '.dicom',
  '.dcm',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);
const SAFE_ATTACHMENT_MIME_EXTENSIONS = new Map([
  ['application/pdf', ['.pdf']],
  ['image/png', ['.png']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/webp', ['.webp']],
  ['image/tiff', ['.tif', '.tiff']],
  ['application/dicom', ['.dicom', '.dcm']],
  ['application/dicom+json', ['.dicom', '.dcm']],
  ['text/plain', ['.txt']],
  ['text/csv', ['.csv']],
  ['application/msword', ['.doc']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['.docx']],
  ['application/vnd.ms-excel', ['.xls']],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['.xlsx']],
]);

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function sameId(left, right) {
  if (!left || !right) return false;
  return String(left?._id || left) === String(right?._id || right);
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function isDuplicateKeyError(error) {
  return Boolean(error && (error.code === 11000 || error.code === 11001));
}

function isRelativeActor(actor = {}) {
  return [ 'relative', 'patient_relative' ].includes(actorType(actor));
}

function hasActiveRelativeAuthorization(relativeId, patientId, authorizationType = AUTHORIZATION_TYPE.VIEW_RECORDS, session = null) {
  if (!relativeId || !patientId) return Promise.resolve(false);
  const now = new Date();
  return withSession(PatientAuthorization.exists({
    patient_id: patientId,
    relative_id: relativeId,
    status: AUTHORIZATION_STATUS.ACTIVE,
    is_deleted: false,
    valid_from: { $lte: now },
    $and: [
      {
        $or: [
          { valid_to: null },
          { valid_to: { $exists: false } },
          { valid_to: { $gte: now } },
        ],
      },
      {
        $or: [
          { authorization_type: AUTHORIZATION_TYPE.FULL_ACCESS },
          { authorization_type: authorizationType },
          { permissions: authorizationType },
        ],
      },
    ],
  }), session).then(Boolean);
}

function hasSensitiveAttachmentField(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return [
    'password',
    'password_hash',
    'token',
    'token_hash',
    'access_token',
    'refresh_token',
    'refresh_token_hash',
    'reset_token',
    'reset_token_hash',
    'reset_code',
    'reset_code_hash',
    'otp',
    'otp_code',
    'secret',
    'api_key',
    'apikey',
  ].includes(normalized) || normalized.endsWith('_token') || normalized.endsWith('_secret') || normalized.includes('password');
}

function sanitizeAttachmentFileName(fileName) {
  const normalized = normalizeString(fileName);
  if (!normalized) throw createError('file_name là bắt buộc.', 400);
  if (normalized.includes('\0')) throw createError('file_name không hợp lệ.', 400);
  if (normalized !== path.basename(normalized) || normalized !== path.win32.basename(normalized)) {
    throw createError('file_name không được chứa đường dẫn.', 400);
  }
  if (/[<>:"|?*]/.test(normalized)) throw createError('file_name chứa ký tự không hợp lệ.', 400);
  if (normalized === '.' || normalized === '..') throw createError('file_name không hợp lệ.', 400);
  return normalized;
}

function sanitizeAttachmentStoragePath(storagePath) {
  const normalized = normalizeString(storagePath);
  if (!normalized) throw createError('storage_path là bắt buộc.', 400);
  if (normalized.includes('\0')) throw createError('storage_path không hợp lệ.', 400);
  const normalizedPath = path.normalize(normalized);
  if (normalizedPath.includes('..')) throw createError('storage_path không được chứa path traversal.', 400);
  return normalizedPath;
}

function validateAttachmentMimeAndSize(mimeType, fileSize, fileName, sourceLabel = 'attachment') {
  if (!mimeType) throw createError(`mime_type là bắt buộc với ${sourceLabel}.`, 400);
  if (!Number.isFinite(fileSize) || fileSize <= 0) throw createError(`file_size không hợp lệ với ${sourceLabel}.`, 400);
  if (fileSize > MAX_ATTACHMENT_SIZE_BYTES) throw createError(`file_size vượt quá giới hạn ${Math.floor(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))}MB.`, 400);

  const ext = path.extname(fileName).toLowerCase();
  if (!ext || !SAFE_ATTACHMENT_EXTENSIONS.has(ext)) throw createError(`Định dạng file ${ext || 'unknown'} không được hỗ trợ.`, 400);

  const allowedExtensions = SAFE_ATTACHMENT_MIME_EXTENSIONS.get(String(mimeType).trim().toLowerCase());
  if (!allowedExtensions || !allowedExtensions.includes(ext)) {
    throw createError('mime_type và extension file không khớp hoặc không được hỗ trợ.', 400);
  }
}

function normalizeAttachmentPayload(payload = {}, file = null) {
  const fileName = sanitizeAttachmentFileName(payload.file_name || file?.filename || file?.originalname);
  const originalName = normalizeString(payload.original_name || file?.originalname || fileName);
  const storagePath = sanitizeAttachmentStoragePath(payload.storage_path || file?.path);
  const mimeType = normalizeString(payload.mime_type || file?.mimetype);
  const fileSize = Number(payload.file_size ?? file?.size ?? 0);
  validateAttachmentMimeAndSize(mimeType, fileSize, originalName || fileName, 'attachment');
  if (hasSensitiveAttachmentField(path.basename(fileName, path.extname(fileName)))) {
    throw createError('file_name không được chứa ký hiệu nhạy cảm.', 400);
  }
  return {
    file_name: fileName,
    original_name: originalName,
    mime_type: mimeType,
    file_size: fileSize,
    storage_path: storagePath,
    checksum: normalizeString(payload.checksum),
    category: normalizeString(payload.category || 'document'),
    description: normalizeString(payload.description),
  };
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
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

function assertStaffPermission(actor = {}, permissions = [], message = 'Bạn không có quyền thao tác Medical Records Module.') {
  if (actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (actorType(actor) !== 'staff') throw createError(message, 403);
  if (!hasAnyPermission(actor, Array.isArray(permissions) ? permissions : [permissions])) {
    throw createError(message, 403);
  }
  return true;
}

function assertPatientSelf(actor = {}, patientId, permission = PERMISSION.MEDICAL_RECORDS.SELF_READ_RELEASED) {
  if (actorType(actor) !== 'patient') return false;
  if (!hasPermission(actor, permission)) throw createError('Tài khoản bệnh nhân không có quyền xem tài liệu này.', 403);
  if (!sameId(actor.patientId || actor.patient_id, patientId)) throw createError('Bạn chỉ được xem tài liệu của chính mình.', 403);
  return true;
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function sanitizeAttachment(attachment, { includeStorage = false } = {}) {
  if (!attachment) return attachment;
  const plain = typeof attachment.toObject === 'function' ? attachment.toObject() : { ...attachment };
  if (!includeStorage) delete plain.storage_path;
  return plain;
}

async function generateMedicalRecordNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.MEDICAL_RECORD, options);
}

async function assertPatientActive(patientId, session = null) {
  const patient = await withSession(Patient.findById(patientId), session);
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy patient.', 404);
  if (patient.status !== PATIENT_STATUS.ACTIVE) throw createError('Patient không active.', 409);
  return patient;
}

async function assertDepartmentActive(departmentId, session = null) {
  if (!departmentId) return null;
  const department = await withSession(Department.findById(departmentId), session);
  if (!department || department.is_deleted) throw createError('Không tìm thấy custodian department.', 404);
  if (department.status && department.status !== 'active') throw createError('Custodian department không active.', 409);
  return department;
}

async function assertRelativeAuthorizationScope(recordOrPatientId, actor = {}, authorizationType = AUTHORIZATION_TYPE.VIEW_RECORDS, session = null) {
  if (!isRelativeActor(actor)) return true;
  const patientId = recordOrPatientId?.patient_id || recordOrPatientId?.patientId || recordOrPatientId;
  const relativeId = actor.relativeId || actor.relative_id;
  if (!relativeId || !patientId) throw createError('Thiếu scope người nhà hoặc patient.', 403);
  const authorized = await hasActiveRelativeAuthorization(relativeId, patientId, authorizationType, session);
  if (!authorized) throw createError('Người nhà không còn ủy quyền hợp lệ cho patient này.', 403);
  return true;
}

async function validateMedicalRecordCreation(encounterId, payload = {}, actor = {}, session = null) {
  assertStaffPermission(actor, [PERMISSION.MEDICAL_RECORDS.CREATE, PERMISSION.MEDICAL_RECORDS.CREATE_SUMMARY]);
  const encounter = await withSession(Encounter.findById(encounterId), session);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  const patient = await assertPatientActive(encounter.patient_id, session);
  if (payload.patient_id && !sameId(payload.patient_id, patient._id)) {
    throw createError('patient_id không khớp encounter.', 409);
  }
  let admission = null;
  if (payload.admission_id) {
    admission = await withSession(Admission.findById(payload.admission_id), session);
    if (!admission) throw createError('Không tìm thấy admission.', 404);
    if (!sameId(admission.patient_id, patient._id)) throw createError('Admission không thuộc patient của encounter.', 409);
    if (admission.encounter_id && !sameId(admission.encounter_id, encounter._id)) throw createError('Admission không khớp encounter.', 409);
  }
  if (payload.department_id && !sameId(payload.department_id, admission?.department_id || encounter.department_id)) {
    throw createError('department_id không khớp encounter/admission.', 409);
  }
  if (payload.doctor_id && !sameId(payload.doctor_id, encounter.attending_doctor_id)) {
    throw createError('doctor_id không khớp encounter.', 409);
  }
  if (
    hasPermission(actor, PERMISSION.MEDICAL_RECORDS.CREATE_SUMMARY)
    && !hasPermission(actor, PERMISSION.MEDICAL_RECORDS.CREATE)
    && !sameId(encounter.attending_doctor_id, actor.userId)
  ) {
    throw createError('Doctor chỉ được tạo medical record cho encounter của mình.', 403);
  }
  const duplicate = await withSession(MedicalRecord.findOne({ encounter_id: encounter._id }).sort({ created_at: -1 }), session);
  if (duplicate) {
    return {
      encounter,
      patient,
      admission,
      custodianDepartmentId: duplicate.custodian_department_id || admission?.department_id || encounter.department_id,
      duplicate,
    };
  }
  const custodianDepartmentId = payload.custodian_department_id || admission?.department_id || encounter.department_id;
  await assertDepartmentActive(custodianDepartmentId, session);
  return { encounter, patient, admission, custodianDepartmentId };
}

function buildDefaultRecordTitle(recordType, encounter, admission) {
  const dateText = new Date().toISOString().slice(0, 10);
  if (recordType === RECORD_TYPE.INPATIENT || admission) return `Nội trú - ${dateText}`;
  if (recordType === RECORD_TYPE.EMERGENCY) return `Cấp cứu - ${dateText}`;
  if (recordType === RECORD_TYPE.LAB) return `Hồ sơ xét nghiệm - ${dateText}`;
  if (recordType === RECORD_TYPE.IMAGING) return `Hồ sơ chẩn đoán hình ảnh - ${dateText}`;
  return `Ngoại trú - ${dateText}`;
}

async function createMedicalRecordFromEncounter(encounterId, payload = {}, actor = {}, requestMeta = {}) {
  let recordId;
  let idempotent = false;
  await withOptionalTransaction(async (session) => {
    const validation = await validateMedicalRecordCreation(encounterId, payload, actor, session);
    if (validation.duplicate) {
      recordId = validation.duplicate._id;
      idempotent = true;
      return;
    }
    const recordType = payload.record_type || (validation.admission ? RECORD_TYPE.INPATIENT : RECORD_TYPE.OUTPATIENT);
    const recordNo = payload.record_no || await generateMedicalRecordNumber({ session });
    try {
      const [record] = await MedicalRecord.create([{
        patient_id: validation.patient._id,
        encounter_id: validation.encounter._id,
        admission_id: validation.admission?._id,
        custodian_department_id: validation.custodianDepartmentId,
        record_no: recordNo,
        record_type: recordType,
        title: normalizeString(payload.title) || buildDefaultRecordTitle(recordType, validation.encounter, validation.admission),
        summary: normalizeString(payload.summary),
        opened_at: parseDate(payload.opened_at, 'opened_at') || new Date(),
        status: payload.status || MEDICAL_RECORD_STATUS.ACTIVE,
        created_by: actor.userId,
        updated_by: actor.userId,
      }], sessionOptions(session));
      recordId = record._id;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await withSession(MedicalRecord.findOne({ encounter_id: validation.encounter._id }).sort({ created_at: -1 }), session);
      if (!existing) throw error;
      recordId = existing._id;
    }
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'medical_records.create',
    targetType: 'medical_record',
    targetId: recordId,
    status: 'success',
    message: 'Tạo medical record thành công.',
    requestMeta,
    metadata: { idempotent },
  });
  return getMedicalRecordDetail(recordId, actor);
}

async function loadRecordAccessContext(record, session = null) {
  const [encounter, admission] = await Promise.all([
    record.encounter_id ? withSession(Encounter.findById(record.encounter_id).lean(), session) : Promise.resolve(null),
    record.admission_id ? withSession(Admission.findById(record.admission_id).lean(), session) : Promise.resolve(null),
  ]);
  return { encounter, admission };
}

async function assertMedicalRecordAccess(record, actor = {}, action = 'read', session = null) {
  if (actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (actorType(actor) === 'patient') {
    assertPatientSelf(actor, record.patient_id, PERMISSION.MEDICAL_RECORDS.SELF_READ_RELEASED);
    if (record.status === MEDICAL_RECORD_STATUS.VOIDED || !record.released_to_patient) {
      throw createError('Medical record chưa được release cho patient.', 403);
    }
    return true;
  }
  if (isRelativeActor(actor)) {
    if (action !== 'read' && action !== 'export') throw createError('Người nhà chỉ được xem hồ sơ khi được ủy quyền.', 403);
    if (!hasPermission(actor, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED)) {
      throw createError('Người nhà không có quyền xem medical record.', 403);
    }
    if (!record.released_to_patient || !FINALIZED_RECORD_STATUSES.includes(record.status)) {
      throw createError('Medical record chưa được release cho người nhà xem.', 403);
    }
    const authorized = await hasActiveRelativeAuthorization(actor.relativeId || actor.relative_id, record.patient_id, AUTHORIZATION_TYPE.VIEW_RECORDS, session);
    if (!authorized) throw createError('Người nhà không còn ủy quyền hợp lệ cho patient này.', 403);
    return true;
  }
  const context = await loadRecordAccessContext(record, session);
  if (action === 'read') {
    if (hasPermission(actor, PERMISSION.MEDICAL_RECORDS.READ)) return true;
    if (hasAnyPermission(actor, [PERMISSION.MEDICAL_RECORDS.READ_OWN, PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED])
      && (sameId(context.encounter?.attending_doctor_id, actor.userId) || sameId(context.admission?.attending_doctor_id, actor.userId))) return true;
    if (hasPermission(actor, PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT)
      && sameId(record.custodian_department_id || context.encounter?.department_id || context.admission?.department_id, actorDepartmentId(actor))) return true;
  }
  if (action === 'update' && hasAnyPermission(actor, [PERMISSION.MEDICAL_RECORDS.UPDATE, PERMISSION.MEDICAL_RECORDS.AMEND, PERMISSION.MEDICAL_RECORDS.AMEND_BY_POLICY])) return true;
  if (action === 'finalize' && hasAnyPermission(actor, [PERMISSION.MEDICAL_RECORDS.FINALIZE, PERMISSION.MEDICAL_RECORDS.FINALIZE_BY_POLICY])) return true;
  if (action === 'finalize' && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.FINALIZE_OWN)
    && sameId(context.encounter?.attending_doctor_id, actor.userId)) return true;
  if (action === 'seal' && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.SEAL)) return true;
  if (action === 'archive' && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.ARCHIVE)) return true;
  if (action === 'void' && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.VOID)) return true;
  if (action === 'export' && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.EXPORT)) return true;
  if (action === 'release' && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.RELEASE_TO_PATIENT)) return true;
  throw createError('Bạn không có quyền truy cập medical record này.', 403);
}

function appendAndFilter(filter, condition) {
  filter.$and = filter.$and || [];
  filter.$and.push(condition);
}

async function applyStaffRecordScope(filter, actor = {}) {
  if (actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return;
  if (hasPermission(actor, PERMISSION.MEDICAL_RECORDS.READ)) return;
  if (hasPermission(actor, PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT)) {
    const departmentId = actorDepartmentId(actor);
    if (!departmentId) throw createError('Thiếu department scope cho medical record.', 403);
    appendAndFilter(filter, { custodian_department_id: departmentId });
    return;
  }
  if (hasAnyPermission(actor, [PERMISSION.MEDICAL_RECORDS.READ_OWN, PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED])) {
    const [encounterIds, admissionIds] = await Promise.all([
      Encounter.distinct('_id', { attending_doctor_id: actor.userId }),
      Admission.distinct('_id', { attending_doctor_id: actor.userId }),
    ]);
    appendAndFilter(filter, {
      $or: [
        { encounter_id: { $in: encounterIds } },
        { admission_id: { $in: admissionIds } },
      ],
    });
    return;
  }
  throw createError('Bạn không có quyền xem danh sách medical record.', 403);
}

async function getMedicalRecordByEncounter(encounterId, actor = {}) {
  const record = await MedicalRecord.findOne({ encounter_id: encounterId, status: { $ne: MEDICAL_RECORD_STATUS.VOIDED } })
    .sort({ opened_at: -1, created_at: -1 })
    .lean();
  if (!record) return null;
  return getMedicalRecordDetail(record._id, actor);
}

async function listPatientMedicalRecords(patientId, query = {}, actor = {}) {
  if (actorType(actor) === 'patient') {
    assertPatientSelf(actor, patientId, PERMISSION.MEDICAL_RECORDS.SELF_READ_RELEASED);
  } else if (isRelativeActor(actor)) {
    await assertRelativeAuthorizationScope(patientId, actor, AUTHORIZATION_TYPE.VIEW_RECORDS);
  } else {
    assertStaffPermission(actor, [PERMISSION.MEDICAL_RECORDS.READ, PERMISSION.MEDICAL_RECORDS.READ_OWN, PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT, PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED]);
  }
  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patientId };
  for (const field of ['record_type', 'status', 'custodian_department_id']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.date_from || query.date_to) {
    filter.opened_at = {};
    const from = parseDate(query.date_from, 'date_from');
    const to = parseDate(query.date_to, 'date_to');
    if (from) filter.opened_at.$gte = from;
    if (to) filter.opened_at.$lte = to;
  }
  if (actorType(actor) === 'patient') {
    filter.released_to_patient = true;
    filter.status = { $in: [MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED, MEDICAL_RECORD_STATUS.ARCHIVED] };
  } else if (isRelativeActor(actor)) {
    filter.released_to_patient = true;
    filter.status = { $in: [MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED, MEDICAL_RECORD_STATUS.ARCHIVED] };
  }
  if (actorType(actor) === 'staff') await applyStaffRecordScope(filter, actor);
  const [items, total] = await Promise.all([
    MedicalRecord.find(filter)
      .sort({ opened_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('custodian_department_id', 'department_code department_name')
      .lean(),
    MedicalRecord.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listMedicalRecords(query = {}, actor = {}) {
  if (actorType(actor) === 'patient') return listPatientMedicalRecords(actor.patientId || actor.patient_id, query, actor);
  assertStaffPermission(actor, [PERMISSION.MEDICAL_RECORDS.READ, PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT, PERMISSION.MEDICAL_RECORDS.READ_OWN, PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED]);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'custodian_department_id', 'record_type', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  const keyword = normalizeString(query.keyword || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { record_no: { $regex: pattern, $options: 'i' } },
      { title: { $regex: pattern, $options: 'i' } },
    ];
  }
  await applyStaffRecordScope(filter, actor);
  const [items, total] = await Promise.all([
    MedicalRecord.find(filter)
      .sort({ opened_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name')
      .populate('custodian_department_id', 'department_code department_name')
      .lean(),
    MedicalRecord.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getRelatedSummary(record) {
  const filter = {};
  if (record.encounter_id) filter.encounter_id = record.encounter_id;
  const [consultations, diagnoses, labResults, imagingReports, prescriptions, invoices, attachments] = await Promise.all([
    record.encounter_id ? Consultation.countDocuments({ encounter_id: record.encounter_id }) : 0,
    record.encounter_id ? Diagnosis.countDocuments({ encounter_id: record.encounter_id }) : 0,
    LabResult.countDocuments({ patient_id: record.patient_id, ...(record.encounter_id ? {} : {}) }),
    ImagingReport.countDocuments({ patient_id: record.patient_id }),
    record.encounter_id ? Prescription.countDocuments({ encounter_id: record.encounter_id }) : 0,
    Invoice.countDocuments({ patient_id: record.patient_id, ...(record.encounter_id ? { encounter_id: record.encounter_id } : {}) }),
    Attachment.countDocuments({
      $or: [
        { medical_record_id: record._id },
        { entity_type: ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD, entity_id: record._id },
        ...(record.encounter_id ? [{ encounter_id: record.encounter_id }] : []),
      ],
      status: { $ne: ATTACHMENT_STATUS.DELETED },
    }),
  ]);
  return { consultations, diagnoses, lab_results: labResults, imaging_reports: imagingReports, prescriptions, invoices, attachments };
}

async function getMedicalRecordDetail(recordId, actor = {}) {
  const record = await MedicalRecord.findById(recordId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender')
    .populate('encounter_id', 'encounter_code encounter_type status start_time attending_doctor_id department_id')
    .populate('admission_id', 'admission_no status admitted_at discharged_at department_id attending_doctor_id')
    .populate('custodian_department_id', 'department_code department_name')
    .populate('sealed_by finalized_by released_by archived_by voided_by', 'full_name username employee_code')
    .lean();
  if (!record) throw createError('Không tìm thấy medical record.', 404);
  const normalizedRecord = {
    ...record,
    patient_id: record.patient_id?._id || record.patient_id,
    encounter_id: record.encounter_id?._id || record.encounter_id,
    admission_id: record.admission_id?._id || record.admission_id,
    custodian_department_id: record.custodian_department_id?._id || record.custodian_department_id,
  };
  await assertMedicalRecordAccess(normalizedRecord, actor, 'read');
  const attachmentFilter = {
    $or: [
      { medical_record_id: record._id },
      { entity_type: ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD, entity_id: record._id },
      ...(record.encounter_id ? [{ encounter_id: record.encounter_id?._id || record.encounter_id }] : []),
    ],
    status: actorType(actor) === 'patient' || isRelativeActor(actor) ? ATTACHMENT_STATUS.ACTIVE : { $ne: ATTACHMENT_STATUS.DELETED },
  };
  if (actorType(actor) === 'patient' || isRelativeActor(actor)) attachmentFilter.released_to_patient = true;
  const [attachments, related_summary] = await Promise.all([
    Attachment.find(attachmentFilter).sort({ created_at: -1 }).lean(),
    getRelatedSummary(normalizedRecord),
  ]);
  return {
    ...record,
    attachments: attachments.map((attachment) => sanitizeAttachment(attachment)),
    related_summary,
    allowed_actions: buildMedicalRecordAllowedActions(normalizedRecord, actor),
  };
}

function buildMedicalRecordAllowedActions(record, actor = {}) {
  if (actorType(actor) === 'patient') {
    return { can_export: record.released_to_patient && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.SELF_READ_RELEASED) };
  }
  if (isRelativeActor(actor)) {
    return { can_export: record.released_to_patient && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED) };
  }
  return {
    can_update: [MEDICAL_RECORD_STATUS.DRAFT, MEDICAL_RECORD_STATUS.ACTIVE].includes(record.status) && hasAnyPermission(actor, [PERMISSION.MEDICAL_RECORDS.UPDATE, PERMISSION.MEDICAL_RECORDS.AMEND]),
    can_finalize: [MEDICAL_RECORD_STATUS.DRAFT, MEDICAL_RECORD_STATUS.ACTIVE].includes(record.status) && hasAnyPermission(actor, [PERMISSION.MEDICAL_RECORDS.FINALIZE, PERMISSION.MEDICAL_RECORDS.FINALIZE_BY_POLICY, PERMISSION.MEDICAL_RECORDS.FINALIZE_OWN]),
    can_seal: record.status === MEDICAL_RECORD_STATUS.FINALIZED && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.SEAL),
    can_archive: [MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED].includes(record.status) && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.ARCHIVE),
    can_void: ![MEDICAL_RECORD_STATUS.VOIDED, MEDICAL_RECORD_STATUS.ARCHIVED].includes(record.status) && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.VOID),
    can_release: FINALIZED_RECORD_STATUSES.includes(record.status) && hasPermission(actor, PERMISSION.MEDICAL_RECORDS.RELEASE_TO_PATIENT),
    can_export: hasPermission(actor, PERMISSION.MEDICAL_RECORDS.EXPORT),
    can_upload_attachment: ![MEDICAL_RECORD_STATUS.SEALED, MEDICAL_RECORD_STATUS.ARCHIVED, MEDICAL_RECORD_STATUS.VOIDED].includes(record.status) && hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.ATTACHMENTS.CREATE]),
  };
}

async function updateMedicalRecord(recordId, payload = {}, actor = {}, requestMeta = {}) {
  const record = await MedicalRecord.findById(recordId);
  if (!record) throw createError('Không tìm thấy medical record.', 404);
  await assertMedicalRecordAccess(record, actor, 'update');
  if (![MEDICAL_RECORD_STATUS.DRAFT, MEDICAL_RECORD_STATUS.ACTIVE].includes(record.status)) {
    throw createError('Chỉ medical record draft/active mới được update thường.', 409);
  }
  const before = record.toObject();
  if (payload.title !== undefined) record.title = normalizeString(payload.title);
  if (payload.summary !== undefined) record.summary = normalizeString(payload.summary);
  if (payload.custodian_department_id !== undefined) {
    await assertDepartmentActive(payload.custodian_department_id);
    record.custodian_department_id = payload.custodian_department_id;
  }
  record.updated_by = actor.userId;
  await record.save();
  await recordAuditLog({ actor, action: 'medical_records.update', targetType: 'medical_record', targetId: record._id, status: 'success', message: 'Cập nhật medical record thành công.', requestMeta, before, after: record.toObject() });
  return getMedicalRecordDetail(record._id, actor);
}

async function checkMedicalRecordCanFinalize(recordId, payload = {}, actor = {}, session = null) {
  const record = await withSession(MedicalRecord.findById(recordId), session);
  if (!record) throw createError('Không tìm thấy medical record.', 404);
  await assertMedicalRecordAccess(record, actor, 'finalize', session);
  if (![MEDICAL_RECORD_STATUS.DRAFT, MEDICAL_RECORD_STATUS.ACTIVE].includes(record.status)) {
    throw createError('Medical record phải draft/active trước khi finalize.', 409);
  }
  const blockers = [];
  const warnings = [];
  const [encounter, admission] = await Promise.all([
    record.encounter_id ? withSession(Encounter.findById(record.encounter_id).lean(), session) : Promise.resolve(null),
    record.admission_id ? withSession(Admission.findById(record.admission_id).lean(), session) : Promise.resolve(null),
  ]);
  if (encounter && encounter.status !== ENCOUNTER_STATUS.COMPLETED && !payload.allow_incomplete_encounter) blockers.push('Encounter chưa completed.');
  if (admission && admission.status !== ADMISSION_STATUS.DISCHARGED && record.record_type === RECORD_TYPE.INPATIENT && !payload.allow_active_admission) blockers.push('Admission nội trú chưa discharged.');
  if (payload.strict_clinical_checks && record.encounter_id) {
    const [signedConsultation, primaryDiagnosis] = await Promise.all([
      withSession(Consultation.exists({ encounter_id: record.encounter_id, status: { $in: [CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.AMENDED] } }), session),
      withSession(Diagnosis.exists({ encounter_id: record.encounter_id, is_primary: true, status: DIAGNOSIS_STATUS.ACTIVE }), session),
    ]);
    if (!signedConsultation) blockers.push('Chưa có consultation signed/amended.');
    if (!primaryDiagnosis) blockers.push('Chưa có primary diagnosis active.');
  }
  if (blockers.length > 0) return { record, can_finalize: false, blockers, warnings };
  return { record, can_finalize: true, blockers, warnings };
}

async function finalizeMedicalRecord(recordId, payload = {}, actor = {}, requestMeta = {}) {
  await withOptionalTransaction(async (session) => {
    const validation = await checkMedicalRecordCanFinalize(recordId, payload, actor, session);
    if (!validation.can_finalize) throw createError(`Không thể finalize medical record: ${validation.blockers.join(' ')}`, 409);
    const record = validation.record;
    record.status = MEDICAL_RECORD_STATUS.FINALIZED;
    record.closed_at = parseDate(payload.closed_at, 'closed_at') || record.closed_at || new Date();
    record.finalized_by = actor.userId;
    record.finalized_at = new Date();
    if (payload.summary !== undefined) record.summary = normalizeString(payload.summary);
    record.updated_by = actor.userId;
    await record.save(sessionOptions(session));
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'medical_records.finalize', targetType: 'medical_record', targetId: recordId, status: 'success', message: 'Finalize medical record thành công.', requestMeta });
  return getMedicalRecordDetail(recordId, actor);
}

async function sealMedicalRecord(recordId, actor = {}, requestMeta = {}) {
  const record = await MedicalRecord.findById(recordId);
  if (!record) throw createError('Không tìm thấy medical record.', 404);
  await assertMedicalRecordAccess(record, actor, 'seal');
  if (record.status !== MEDICAL_RECORD_STATUS.FINALIZED || !record.closed_at) throw createError('Medical record phải finalized trước khi seal.', 409);
  record.status = MEDICAL_RECORD_STATUS.SEALED;
  record.sealed_by = actor.userId;
  record.sealed_at = new Date();
  record.updated_by = actor.userId;
  await record.save();
  await recordAuditLog({ actor, action: 'medical_records.seal', targetType: 'medical_record', targetId: record._id, status: 'success', message: 'Seal medical record thành công.', requestMeta });
  return getMedicalRecordDetail(record._id, actor);
}

async function archiveMedicalRecord(recordId, payload = {}, actor = {}, requestMeta = {}) {
  const record = await MedicalRecord.findById(recordId);
  if (!record) throw createError('Không tìm thấy medical record.', 404);
  await assertMedicalRecordAccess(record, actor, 'archive');
  if (![MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED].includes(record.status)) throw createError('Chỉ record finalized/sealed mới được archive.', 409);
  record.status = MEDICAL_RECORD_STATUS.ARCHIVED;
  record.archived_by = actor.userId;
  record.archived_at = new Date();
  record.archive_reason = normalizeString(payload.reason || payload.archive_reason);
  record.updated_by = actor.userId;
  await record.save();
  await recordAuditLog({ actor, action: 'medical_records.archive', targetType: 'medical_record', targetId: record._id, status: 'success', message: 'Archive medical record thành công.', requestMeta, metadata: { reason: record.archive_reason } });
  return getMedicalRecordDetail(record._id, actor);
}

async function voidMedicalRecord(recordId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.reason || payload.void_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const record = await MedicalRecord.findById(recordId);
  if (!record) throw createError('Không tìm thấy medical record.', 404);
  await assertMedicalRecordAccess(record, actor, 'void');
  if (record.status === MEDICAL_RECORD_STATUS.SEALED && !payload.allow_void_sealed) throw createError('Record sealed cần allow_void_sealed=true và quyền void.', 409);
  if ([MEDICAL_RECORD_STATUS.VOIDED, MEDICAL_RECORD_STATUS.ARCHIVED].includes(record.status)) throw createError('Record đã terminal.', 409);
  record.status = MEDICAL_RECORD_STATUS.VOIDED;
  record.closed_at = record.closed_at || new Date();
  record.voided_by = actor.userId;
  record.voided_at = new Date();
  record.void_reason = reason;
  record.updated_by = actor.userId;
  await record.save();
  await recordAuditLog({ actor, action: 'medical_records.void', targetType: 'medical_record', targetId: record._id, status: 'success', message: 'Void medical record thành công.', requestMeta, metadata: { reason } });
  return getMedicalRecordDetail(record._id, actor);
}

async function releaseMedicalRecordToPatient(recordId, actor = {}, requestMeta = {}) {
  const record = await MedicalRecord.findById(recordId);
  if (!record) throw createError('Không tìm thấy medical record.', 404);
  await assertMedicalRecordAccess(record, actor, 'release');
  if (!FINALIZED_RECORD_STATUSES.includes(record.status)) throw createError('Chỉ record finalized/sealed/archived mới được release.', 409);
  if (record.status === MEDICAL_RECORD_STATUS.VOIDED) throw createError('Không release record voided.', 409);
  record.released_to_patient = true;
  record.released_at = new Date();
  record.released_by = actor.userId;
  record.updated_by = actor.userId;
  await record.save();
  await recordAuditLog({ actor, action: 'medical_records.release_to_patient', targetType: 'medical_record', targetId: record._id, status: 'success', message: 'Release medical record to patient thành công.', requestMeta });
  await notificationService.notifyMedicalRecordReleased(record._id, actor);
  return getMedicalRecordDetail(record._id, actor);
}

async function resolveEntityForAttachment(entityType, entityId, session = null) {
  if (!ATTACHMENT_ENTITY_TYPES.includes(entityType)) throw createError('entity_type không hợp lệ.', 400);
  if (!entityId) throw createError('entity_id là bắt buộc.', 400);
  const base = { entity_type: entityType, entity_id: entityId };
  switch (entityType) {
    case ATTACHMENT_ENTITY_TYPE.PATIENT: {
      const patient = await withSession(Patient.findById(entityId).lean(), session);
      if (!patient || patient.is_deleted) throw createError('Không tìm thấy patient.', 404);
      return { ...base, patient_id: patient._id };
    }
    case ATTACHMENT_ENTITY_TYPE.ENCOUNTER: {
      const encounter = await withSession(Encounter.findById(entityId).lean(), session);
      if (!encounter) throw createError('Không tìm thấy encounter.', 404);
      return { ...base, patient_id: encounter.patient_id, encounter_id: encounter._id, department_id: encounter.department_id };
    }
    case ATTACHMENT_ENTITY_TYPE.ADMISSION: {
      const admission = await withSession(Admission.findById(entityId).lean(), session);
      if (!admission) throw createError('Không tìm thấy admission.', 404);
      return { ...base, patient_id: admission.patient_id, encounter_id: admission.encounter_id, admission_id: admission._id, department_id: admission.department_id };
    }
    case ATTACHMENT_ENTITY_TYPE.ORDER: {
      const order = await withSession(Order.findById(entityId).lean(), session);
      if (!order) throw createError('Không tìm thấy order.', 404);
      return { ...base, patient_id: order.patient_id, encounter_id: order.encounter_id, order_id: order._id, admission_id: order.admission_id, department_id: order.department_id };
    }
    case ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD: {
      const record = await withSession(MedicalRecord.findById(entityId).lean(), session);
      if (!record) throw createError('Không tìm thấy medical record.', 404);
      return { ...base, patient_id: record.patient_id, encounter_id: record.encounter_id, admission_id: record.admission_id, medical_record_id: record._id, department_id: record.custodian_department_id, medical_record: record };
    }
    case ATTACHMENT_ENTITY_TYPE.LAB_RESULT: {
      const result = await withSession(LabResult.findById(entityId).lean(), session);
      if (!result) throw createError('Không tìm thấy lab result.', 404);
      const labOrder = await withSession(LabOrder.findById(result.lab_order_id).lean(), session);
      const order = labOrder?.order_id ? await withSession(Order.findById(labOrder.order_id).lean(), session) : null;
      return { ...base, patient_id: result.patient_id, encounter_id: labOrder?.encounter_id, order_id: labOrder?.order_id, department_id: order?.department_id || undefined };
    }
    case ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER: {
      const imagingOrder = await withSession(ImagingOrder.findById(entityId).lean(), session);
      if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);
      const order = imagingOrder.order_id ? await withSession(Order.findById(imagingOrder.order_id).lean(), session) : null;
      return { ...base, patient_id: imagingOrder.patient_id, encounter_id: imagingOrder.encounter_id, order_id: imagingOrder.order_id, department_id: order?.department_id || undefined };
    }
    case ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT: {
      const report = await withSession(ImagingReport.findById(entityId).lean(), session);
      if (!report) throw createError('Không tìm thấy imaging report.', 404);
      const imagingOrder = await withSession(ImagingOrder.findById(report.imaging_order_id).lean(), session);
      const order = imagingOrder?.order_id ? await withSession(Order.findById(imagingOrder.order_id).lean(), session) : null;
      return { ...base, patient_id: report.patient_id, encounter_id: imagingOrder?.encounter_id, order_id: imagingOrder?.order_id, department_id: order?.department_id || undefined };
    }
    case ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER: {
      const procedureOrder = await withSession(ProcedureOrder.findById(entityId).lean(), session);
      if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);
      return { ...base, patient_id: procedureOrder.patient_id, encounter_id: procedureOrder.encounter_id, order_id: procedureOrder.order_id, department_id: procedureOrder.department_id };
    }
    case ATTACHMENT_ENTITY_TYPE.PRESCRIPTION: {
      const prescription = await withSession(Prescription.findById(entityId).lean(), session);
      if (!prescription) throw createError('Không tìm thấy prescription.', 404);
      const order = prescription.order_id ? await withSession(Order.findById(prescription.order_id).lean(), session) : null;
      return { ...base, patient_id: prescription.patient_id, encounter_id: prescription.encounter_id, order_id: prescription.order_id, department_id: order?.department_id || undefined };
    }
    case ATTACHMENT_ENTITY_TYPE.DISPENSE: {
      const dispense = await withSession(Dispense.findById(entityId).lean(), session);
      if (!dispense) throw createError('Không tìm thấy dispense.', 404);
      const prescription = dispense.prescription_id ? await withSession(Prescription.findById(dispense.prescription_id).lean(), session) : null;
      const order = prescription?.order_id ? await withSession(Order.findById(prescription.order_id).lean(), session) : null;
      return { ...base, patient_id: dispense.patient_id, encounter_id: dispense.encounter_id || prescription?.encounter_id, order_id: prescription?.order_id, department_id: order?.department_id || undefined };
    }
    case ATTACHMENT_ENTITY_TYPE.INVOICE: {
      const invoice = await withSession(Invoice.findById(entityId).lean(), session);
      if (!invoice) throw createError('Không tìm thấy invoice.', 404);
      const encounter = invoice.encounter_id ? await withSession(Encounter.findById(invoice.encounter_id).lean(), session) : null;
      const admission = invoice.admission_id ? await withSession(Admission.findById(invoice.admission_id).lean(), session) : null;
      return { ...base, patient_id: invoice.patient_id, encounter_id: invoice.encounter_id, admission_id: invoice.admission_id, department_id: admission?.department_id || encounter?.department_id || undefined };
    }
    case ATTACHMENT_ENTITY_TYPE.PAYMENT: {
      const payment = await withSession(Payment.findById(entityId).lean(), session);
      if (!payment) throw createError('Không tìm thấy payment.', 404);
      const invoice = payment.invoice_id ? await withSession(Invoice.findById(payment.invoice_id).lean(), session) : null;
      const encounter = invoice?.encounter_id ? await withSession(Encounter.findById(invoice.encounter_id).lean(), session) : null;
      const admission = invoice?.admission_id ? await withSession(Admission.findById(invoice.admission_id).lean(), session) : null;
      return { ...base, patient_id: payment.patient_id, encounter_id: invoice?.encounter_id, admission_id: invoice?.admission_id, department_id: admission?.department_id || encounter?.department_id || undefined };
    }
    case ATTACHMENT_ENTITY_TYPE.INSURANCE_CLAIM: {
      const claim = await withSession(InsuranceClaim.findById(entityId).lean(), session);
      if (!claim) throw createError('Không tìm thấy insurance claim.', 404);
      const invoice = await withSession(Invoice.findById(claim.invoice_id).lean(), session);
      const encounter = invoice?.encounter_id ? await withSession(Encounter.findById(invoice.encounter_id).lean(), session) : null;
      const admission = invoice?.admission_id ? await withSession(Admission.findById(invoice.admission_id).lean(), session) : null;
      return { ...base, patient_id: claim.patient_id, encounter_id: invoice?.encounter_id, admission_id: invoice?.admission_id, department_id: admission?.department_id || encounter?.department_id || undefined };
    }
    case ATTACHMENT_ENTITY_TYPE.OTHER:
      if (!base.patient_id) return base;
      return base;
    default:
      throw createError('entity_type chưa được hỗ trợ.', 400);
  }
}

function uploadPermissionsForEntity(entityType) {
  const common = [PERMISSION.ATTACHMENTS.CREATE, PERMISSION.ATTACHMENTS.UPLOAD];
  if ([ATTACHMENT_ENTITY_TYPE.LAB_RESULT].includes(entityType)) return [...common, PERMISSION.ATTACHMENTS.UPLOAD_LAB];
  if ([ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER, ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT].includes(entityType)) return [...common, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT];
  if (entityType === ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER) return [...common, PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE];
  if ([ATTACHMENT_ENTITY_TYPE.INVOICE, ATTACHMENT_ENTITY_TYPE.PAYMENT, ATTACHMENT_ENTITY_TYPE.INSURANCE_CLAIM].includes(entityType)) return [...common, PERMISSION.ATTACHMENTS.UPLOAD_INSURANCE];
  return [...common, PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL];
}

async function assertAttachmentEntityScope(entity, attachment, actor = {}, action = 'read', session = null) {
  if (actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;

  const patientId = entity?.patient_id || attachment?.patient_id;
  if (!patientId) throw createError('Thiếu patient scope cho attachment.', 403);

  if (actorType(actor) === 'patient') {
    assertPatientSelf(actor, patientId, action === 'download' ? PERMISSION.ATTACHMENTS.SELF_DOWNLOAD_RELEASED : PERMISSION.ATTACHMENTS.SELF_READ_RELEASED);
    if (!attachment?.released_to_patient || attachment?.status !== ATTACHMENT_STATUS.ACTIVE) {
      throw createError('Attachment chưa được release cho patient.', 403);
    }
    return true;
  }

  if (isRelativeActor(actor)) {
    if (!hasPermission(actor, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED)) {
      throw createError('Người nhà không có quyền truy cập attachment này.', 403);
    }
    await assertRelativeAuthorizationScope(patientId, actor, AUTHORIZATION_TYPE.VIEW_RECORDS, session);
    if (!attachment?.released_to_patient || attachment?.status !== ATTACHMENT_STATUS.ACTIVE) {
      throw createError('Attachment chưa được release cho người nhà xem.', 403);
    }
    return true;
  }

  if (actorType(actor) !== 'staff') throw createError('Loại tài khoản không hỗ trợ attachment.', 403);

  const departmentId = actorDepartmentId(actor);
  const entityDepartmentId = entity?.department_id || entity?.admission_id?.department_id || entity?.encounter_id?.department_id || entity?.medical_record?.custodian_department_id;
  const isGlobalRead = hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.READ, PERMISSION.ATTACHMENTS.DOWNLOAD, PERMISSION.ATTACHMENTS.MANAGE]);
  if (action === 'upload') {
    if (hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.SYSTEM.FULL_ACCESS])) return true;
    if (!hasAnyPermission(actor, uploadPermissionsForEntity(entity?.entity_type))) {
      throw createError('Bạn không có quyền upload attachment này.', 403);
    }
    if (!departmentId) return true;
    if (!entityDepartmentId || sameId(entityDepartmentId, departmentId)) return true;
    throw createError('Bạn không có quyền upload attachment cho department này.', 403);
  }

  if (isGlobalRead) return true;
  if (!departmentId) throw createError('Thiếu department scope cho attachment.', 403);
  if (entityDepartmentId && sameId(entityDepartmentId, departmentId)) return true;
  throw createError('Bạn không có quyền truy cập attachment này.', 403);
}

async function assertAttachmentAccess(attachment, actor = {}, action = 'read') {
  if (actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (actorType(actor) === 'patient') {
    const permission = action === 'download' ? PERMISSION.ATTACHMENTS.SELF_DOWNLOAD_RELEASED : PERMISSION.ATTACHMENTS.SELF_READ_RELEASED;
    assertPatientSelf(actor, attachment.patient_id, permission);
    if (attachment.status !== ATTACHMENT_STATUS.ACTIVE || !attachment.released_to_patient) {
      throw createError('Attachment chưa được release cho patient.', 403);
    }
    return true;
  }
  if (isRelativeActor(actor)) {
    if (!hasPermission(actor, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED)) throw createError('Người nhà không có quyền truy cập attachment này.', 403);
    if (attachment.status !== ATTACHMENT_STATUS.ACTIVE || !attachment.released_to_patient) {
      throw createError('Attachment chưa được release cho người nhà xem.', 403);
    }
    return true;
  }
  if (action === 'upload') return assertStaffPermission(actor, uploadPermissionsForEntity(attachment.entity_type));
  if (action === 'download' && hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.DOWNLOAD, PERMISSION.ATTACHMENTS.READ])) return true;
  if (action === 'archive' && hasPermission(actor, PERMISSION.ATTACHMENTS.ARCHIVE)) return true;
  if (action === 'delete' && hasPermission(actor, PERMISSION.ATTACHMENTS.DELETE_SOFT)) return true;
  if (action === 'restore' && hasPermission(actor, PERMISSION.ATTACHMENTS.RESTORE)) return true;
  if (action === 'release' && hasPermission(actor, PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT)) return true;
  if (hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.READ, PERMISSION.ATTACHMENTS.READ_BY_ENTITY])) return true;
  const entityReadPermissions = {
    [ATTACHMENT_ENTITY_TYPE.LAB_RESULT]: [PERMISSION.ATTACHMENTS.READ_LAB],
    [ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER]: [PERMISSION.ATTACHMENTS.READ_IMAGING],
    [ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT]: [PERMISSION.ATTACHMENTS.READ_IMAGING],
    [ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER]: [PERMISSION.ATTACHMENTS.READ_PROCEDURE],
    [ATTACHMENT_ENTITY_TYPE.INVOICE]: [PERMISSION.ATTACHMENTS.READ_INSURANCE],
    [ATTACHMENT_ENTITY_TYPE.INSURANCE_CLAIM]: [PERMISSION.ATTACHMENTS.READ_INSURANCE],
  };
  if (hasAnyPermission(actor, entityReadPermissions[attachment.entity_type] || [])) return true;
  throw createError('Bạn không có quyền truy cập attachment này.', 403);
}

async function uploadAttachment(payload = {}, file = null, actor = {}, requestMeta = {}) {
  const entityType = payload.entity_type;
  const entityId = payload.entity_id;
  const normalized = normalizeAttachmentPayload(payload, file);
  let attachmentId;
  await withOptionalTransaction(async (session) => {
    const entity = await resolveEntityForAttachment(entityType, entityId, session);
    await assertAttachmentEntityScope(entity, { entity_type: entityType, patient_id: entity.patient_id }, actor, 'upload', session);
    if (entity.medical_record && [MEDICAL_RECORD_STATUS.SEALED, MEDICAL_RECORD_STATUS.ARCHIVED, MEDICAL_RECORD_STATUS.VOIDED].includes(entity.medical_record.status) && !payload.allow_sealed_record_attachment) {
      throw createError('Không upload attachment thường vào medical record sealed/archived/voided.', 409);
    }
    const duplicate = normalized.checksum
      ? await withSession(Attachment.exists({
        entity_type: entityType,
        entity_id: entityId,
        checksum: normalized.checksum,
        status: { $ne: ATTACHMENT_STATUS.DELETED },
      }), session)
      : null;
    if (duplicate && !payload.allow_duplicate) throw createError('Attachment trùng checksum trên entity này.', 409);
    try {
      const [attachment] = await Attachment.create([{
        patient_id: payload.patient_id || entity.patient_id,
        encounter_id: payload.encounter_id || entity.encounter_id,
        medical_record_id: payload.medical_record_id || entity.medical_record_id,
        order_id: payload.order_id || entity.order_id,
        entity_type: entityType,
        entity_id: entityId,
        uploaded_by: actor.userId,
        ...normalized,
        status: ATTACHMENT_STATUS.ACTIVE,
        created_by: actor.userId,
        updated_by: actor.userId,
      }], sessionOptions(session));
      attachmentId = attachment._id;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await withSession(Attachment.findOne({
        entity_type: entityType,
        entity_id: entityId,
        checksum: normalized.checksum,
        status: { $ne: ATTACHMENT_STATUS.DELETED },
      }).sort({ created_at: -1 }).lean(), session);
      if (!existing) throw error;
      attachmentId = existing._id;
    }
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'attachments.upload',
    targetType: 'attachment',
    targetId: attachmentId,
    status: 'success',
    message: 'Upload attachment metadata thành công.',
    requestMeta,
    metadata: { entity_type: entityType, entity_id: entityId, idempotent: true },
  });
  return getAttachmentDetail(attachmentId, actor);
}

async function getAttachmentDetail(attachmentId, actor = {}) {
  const attachment = await Attachment.findById(attachmentId)
    .populate('uploaded_by released_by archived_by deleted_by', 'full_name username employee_code')
    .lean();
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  if (attachment.status === ATTACHMENT_STATUS.DELETED && !hasPermission(actor, PERMISSION.ATTACHMENTS.RESTORE)) throw createError('Attachment đã deleted.', 404);
  await assertAttachmentAccess(attachment, actor, 'read');
  const entity = await resolveEntityForAttachment(attachment.entity_type, attachment.entity_id);
  await assertAttachmentEntityScope(entity, attachment, actor, 'read');
  return sanitizeAttachment(attachment);
}

async function downloadAttachment(attachmentId, actor = {}, requestMeta = {}) {
  const attachment = await Attachment.findById(attachmentId).lean();
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  if (attachment.status === ATTACHMENT_STATUS.DELETED) throw createError('Attachment đã deleted.', 404);
  await assertAttachmentAccess(attachment, actor, 'download');
  const entity = await resolveEntityForAttachment(attachment.entity_type, attachment.entity_id);
  await assertAttachmentEntityScope(entity, attachment, actor, 'download');
  await recordAuditLog({ actor, action: 'attachments.download', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Download attachment được ghi nhận.', requestMeta });
  return {
    attachment: sanitizeAttachment(attachment),
    download: {
      mode: 'backend_stream_required',
      file_name: attachment.original_name || attachment.file_name,
      mime_type: attachment.mime_type,
      file_size: attachment.file_size,
    },
  };
}

async function getAttachmentsByEntity(entityType, entityId, query = {}, actor = {}) {
  const entity = await resolveEntityForAttachment(entityType, entityId);
  if (actorType(actor) === 'patient') assertPatientSelf(actor, entity.patient_id, PERMISSION.ATTACHMENTS.SELF_READ_RELEASED);
  if (isRelativeActor(actor)) await assertRelativeAuthorizationScope(entity.patient_id, actor, AUTHORIZATION_TYPE.VIEW_RECORDS);
  else assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.READ, PERMISSION.ATTACHMENTS.READ_BY_ENTITY, PERMISSION.ATTACHMENTS.READ_CLINICAL, PERMISSION.ATTACHMENTS.READ_LAB, PERMISSION.ATTACHMENTS.READ_IMAGING, PERMISSION.ATTACHMENTS.READ_PROCEDURE, PERMISSION.ATTACHMENTS.READ_INSURANCE]);
  const filter = { entity_type: entityType, entity_id: entityId };
  filter.status = query.status || ATTACHMENT_STATUS.ACTIVE;
  if (actorType(actor) === 'patient' || isRelativeActor(actor)) filter.released_to_patient = true;
  const attachments = await Attachment.find(filter).sort({ created_at: -1 }).lean();
  for (const attachment of attachments) {
    await assertAttachmentAccess(attachment, actor, 'read');
    const scopedEntity = await resolveEntityForAttachment(attachment.entity_type, attachment.entity_id);
    await assertAttachmentEntityScope(scopedEntity, attachment, actor, 'read');
  }
  return attachments.map((attachment) => sanitizeAttachment(attachment));
}

async function listPatientAttachments(patientId, query = {}, actor = {}) {
  if (actorType(actor) === 'patient') assertPatientSelf(actor, patientId, PERMISSION.ATTACHMENTS.SELF_READ_RELEASED);
  else if (isRelativeActor(actor)) await assertRelativeAuthorizationScope(patientId, actor, AUTHORIZATION_TYPE.VIEW_RECORDS);
  else assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.READ, PERMISSION.ATTACHMENTS.READ_DEPARTMENT]);
  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patientId };
  for (const field of ['category', 'entity_type', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (!filter.status) filter.status = actorType(actor) === 'patient' ? ATTACHMENT_STATUS.ACTIVE : { $ne: ATTACHMENT_STATUS.DELETED };
  if (actorType(actor) === 'patient' || isRelativeActor(actor)) filter.released_to_patient = true;
  if (actorType(actor) === 'staff' && !hasPermission(actor, PERMISSION.ATTACHMENTS.READ)) {
    const departmentId = actorDepartmentId(actor);
    if (!departmentId) throw createError('Thiếu department scope cho attachment.', 403);
    const [encounterIds, medicalRecordIds] = await Promise.all([
      Encounter.distinct('_id', { patient_id: patientId, department_id: departmentId }),
      MedicalRecord.distinct('_id', { patient_id: patientId, custodian_department_id: departmentId }),
    ]);
    appendAndFilter(filter, {
      $or: [
        { encounter_id: { $in: encounterIds } },
        { medical_record_id: { $in: medicalRecordIds } },
        { entity_type: ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD, entity_id: { $in: medicalRecordIds } },
      ],
    });
  }
  if (query.date_from || query.date_to) {
    filter.created_at = {};
    const from = parseDate(query.date_from, 'date_from');
    const to = parseDate(query.date_to, 'date_to');
    if (from) filter.created_at.$gte = from;
    if (to) filter.created_at.$lte = to;
  }
  const [items, total] = await Promise.all([
    Attachment.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Attachment.countDocuments(filter),
  ]);
  for (const attachment of items) {
    await assertAttachmentAccess(attachment, actor, 'read');
    const scopedEntity = await resolveEntityForAttachment(attachment.entity_type, attachment.entity_id);
    await assertAttachmentEntityScope(scopedEntity, attachment, actor, 'read');
  }
  return { items: items.map((attachment) => sanitizeAttachment(attachment)), pagination: buildPagination(page, limit, total) };
}

async function archiveAttachment(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  await assertAttachmentAccess(attachment, actor, 'archive');
  const entity = await resolveEntityForAttachment(attachment.entity_type, attachment.entity_id);
  await assertAttachmentEntityScope(entity, attachment, actor, 'archive');
  if (attachment.status !== ATTACHMENT_STATUS.ACTIVE) throw createError('Chỉ attachment active mới được archive.', 409);
  if (attachment.medical_record_id) {
    const record = await MedicalRecord.findById(attachment.medical_record_id).lean();
    if (record && [MEDICAL_RECORD_STATUS.SEALED, MEDICAL_RECORD_STATUS.ARCHIVED, MEDICAL_RECORD_STATUS.VOIDED].includes(record.status) && !payload.allow_archive_from_sealed_record) {
      throw createError('Không archive attachment thuộc medical record sealed/archived/voided nếu không có override.', 409);
    }
  }
  attachment.status = ATTACHMENT_STATUS.ARCHIVED;
  attachment.archived_by = actor.userId;
  attachment.archived_at = new Date();
  attachment.archive_reason = normalizeString(payload.reason || payload.archive_reason);
  attachment.updated_by = actor.userId;
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachments.archive', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Archive attachment thành công.', requestMeta, metadata: { reason: attachment.archive_reason } });
  return getAttachmentDetail(attachment._id, actor);
}

async function softDeleteAttachment(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.reason || payload.delete_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  await assertAttachmentAccess(attachment, actor, 'delete');
  const entity = await resolveEntityForAttachment(attachment.entity_type, attachment.entity_id);
  await assertAttachmentEntityScope(entity, attachment, actor, 'delete');
  if (attachment.status === ATTACHMENT_STATUS.DELETED) throw createError('Attachment đã deleted.', 409);
  if (attachment.medical_record_id) {
    const record = await MedicalRecord.findById(attachment.medical_record_id).lean();
    if (record && record.status === MEDICAL_RECORD_STATUS.SEALED && !payload.allow_delete_from_sealed_record) {
      throw createError('Không soft-delete attachment thuộc sealed record nếu không có override.', 409);
    }
  }
  attachment.status = ATTACHMENT_STATUS.DELETED;
  attachment.deleted_by = actor.userId;
  attachment.deleted_at = new Date();
  attachment.delete_reason = reason;
  attachment.updated_by = actor.userId;
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachments.soft_delete', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Soft delete attachment thành công.', requestMeta, metadata: { reason } });
  return { deleted: true, attachment_id: String(attachment._id) };
}

async function restoreAttachment(attachmentId, actor = {}, requestMeta = {}) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  await assertAttachmentAccess(attachment, actor, 'restore');
  const entity = await resolveEntityForAttachment(attachment.entity_type, attachment.entity_id);
  await assertAttachmentEntityScope(entity, attachment, actor, 'restore');
  if (![ATTACHMENT_STATUS.DELETED, ATTACHMENT_STATUS.ARCHIVED].includes(attachment.status)) throw createError('Attachment không ở trạng thái restore được.', 409);
  attachment.status = ATTACHMENT_STATUS.ACTIVE;
  attachment.deleted_by = undefined;
  attachment.deleted_at = undefined;
  attachment.delete_reason = undefined;
  attachment.updated_by = actor.userId;
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachments.restore', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Restore attachment thành công.', requestMeta });
  return getAttachmentDetail(attachment._id, actor);
}

async function releaseAttachmentToPatient(attachmentId, actor = {}, requestMeta = {}) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  await assertAttachmentAccess(attachment, actor, 'release');
  const entity = await resolveEntityForAttachment(attachment.entity_type, attachment.entity_id);
  await assertAttachmentEntityScope(entity, attachment, actor, 'release');
  if (attachment.status !== ATTACHMENT_STATUS.ACTIVE) throw createError('Chỉ attachment active mới được release.', 409);
  attachment.released_to_patient = true;
  attachment.released_at = new Date();
  attachment.released_by = actor.userId;
  attachment.updated_by = actor.userId;
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachments.release_to_patient', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Release attachment to patient thành công.', requestMeta });
  return getAttachmentDetail(attachment._id, actor);
}

async function exportMedicalRecord(recordId, options = {}, actor = {}, requestMeta = {}) {
  const record = await MedicalRecord.findById(recordId).lean();
  if (!record) throw createError('Không tìm thấy medical record.', 404);
  const exportFrom = parseDate(options.date_from, 'date_from');
  const exportTo = parseDate(options.date_to, 'date_to');
  if (exportFrom && exportTo && exportFrom > exportTo) throw createError('date_from phải nhỏ hơn date_to.', 400);
  const exportLimit = options.limit !== undefined ? Number(options.limit) : undefined;
  if (exportLimit !== undefined && (!Number.isFinite(exportLimit) || exportLimit < 1 || exportLimit > MAX_EXPORT_LIMIT)) {
    throw createError(`limit export phải nằm trong khoảng 1-${MAX_EXPORT_LIMIT}.`, 400);
  }
  if (options.record_type && normalizeString(options.record_type) !== record.record_type) {
    throw createError('record_type không khớp hồ sơ cần export.', 409);
  }
  if (exportFrom && record.opened_at && record.opened_at < exportFrom) throw createError('Record nằm ngoài date_from export.', 409);
  if (exportTo && record.opened_at && record.opened_at > exportTo) throw createError('Record nằm ngoài date_to export.', 409);
  if (actorType(actor) === 'patient') await assertMedicalRecordAccess(record, actor, 'read');
  else await assertMedicalRecordAccess(record, actor, 'export');
  const detail = await getMedicalRecordDetail(recordId, actor);
  const exportMeta = {
    record_id: String(record._id),
    record_no: record.record_no,
    format: options.format || 'json',
    include_attachments: options.include_attachments !== false,
    include_billing: Boolean(options.include_billing && hasAnyPermission(actor, [PERMISSION.INVOICES.READ, PERMISSION.REPORTS.BILLING_READ])),
    limit: exportLimit,
    generated_at: new Date(),
    delivery: 'metadata_only',
  };
  await recordAuditLog({ actor, action: 'medical_records.export', targetType: 'medical_record', targetId: record._id, status: 'success', message: 'Export medical record metadata thành công.', requestMeta, metadata: exportMeta });
  return { export: exportMeta, record: detail };
}

function timelineEvent(event) {
  return {
    event_type: event.event_type,
    title: event.title,
    description: event.description,
    occurred_at: event.occurred_at || event.created_at,
    entity_type: event.entity_type,
    entity_id: event.entity_id ? String(event.entity_id) : undefined,
    status: event.status,
  };
}

async function buildDocumentTimelineScope(patientId, actor = {}) {
  if (actorType(actor) === 'patient' || isRelativeActor(actor) || actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    return { global: true };
  }
  if (hasAnyPermission(actor, [PERMISSION.DOCUMENTS.TIMELINE_READ, PERMISSION.MEDICAL_RECORDS.READ])) {
    return { global: true };
  }
  const scopedFilter = { patient_id: patientId };
  if (hasAnyPermission(actor, [PERMISSION.DOCUMENTS.TIMELINE_READ_DEPARTMENT, PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT])) {
    const departmentId = actorDepartmentId(actor);
    if (!departmentId) throw createError('Thiếu department scope cho document timeline.', 403);
    scopedFilter.department_id = departmentId;
  } else if (hasAnyPermission(actor, [PERMISSION.DOCUMENTS.TIMELINE_READ_OWN, PERMISSION.MEDICAL_RECORDS.READ_OWN, PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED])) {
    scopedFilter.attending_doctor_id = actor.userId;
  } else {
    throw createError('Bạn không có quyền xem document timeline của patient này.', 403);
  }

  const [encounterIds, admissionIds] = await Promise.all([
    Encounter.distinct('_id', scopedFilter),
    Admission.distinct('_id', scopedFilter),
  ]);
  const [recordIds, labOrderIds, imagingOrderIds] = await Promise.all([
    MedicalRecord.distinct('_id', {
      patient_id: patientId,
      $or: [
        { encounter_id: { $in: encounterIds } },
        { admission_id: { $in: admissionIds } },
        ...(scopedFilter.department_id ? [{ custodian_department_id: scopedFilter.department_id }] : []),
      ],
    }),
    LabOrder.distinct('_id', { patient_id: patientId, encounter_id: { $in: encounterIds } }),
    ImagingOrder.distinct('_id', { patient_id: patientId, encounter_id: { $in: encounterIds } }),
  ]);
  return { global: false, encounterIds, admissionIds, recordIds, labOrderIds, imagingOrderIds };
}

function applyTimelineScope(filter, scope, entityType) {
  if (!scope || scope.global) return filter;
  if (entityType === 'medical_record') {
    appendAndFilter(filter, {
      $or: [
        { _id: { $in: scope.recordIds } },
        { encounter_id: { $in: scope.encounterIds } },
        { admission_id: { $in: scope.admissionIds } },
      ],
    });
  }
  if (entityType === 'attachment') {
    appendAndFilter(filter, {
      $or: [
        { encounter_id: { $in: scope.encounterIds } },
        { medical_record_id: { $in: scope.recordIds } },
        { entity_type: ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD, entity_id: { $in: scope.recordIds } },
        { entity_type: ATTACHMENT_ENTITY_TYPE.ADMISSION, entity_id: { $in: scope.admissionIds } },
      ],
    });
  }
  if (entityType === 'lab_result') filter.lab_order_id = { $in: scope.labOrderIds };
  if (entityType === 'imaging_report') filter.imaging_order_id = { $in: scope.imagingOrderIds };
  if (entityType === 'prescription') filter.encounter_id = { $in: scope.encounterIds };
  if (entityType === 'invoice') {
    appendAndFilter(filter, {
      $or: [
        { encounter_id: { $in: scope.encounterIds } },
        { admission_id: { $in: scope.admissionIds } },
      ],
    });
  }
  return filter;
}

async function getPatientDocumentTimeline(patientId, query = {}, actor = {}) {
  if (actorType(actor) === 'patient') assertPatientSelf(actor, patientId, PERMISSION.DOCUMENTS.TIMELINE_READ_OWN);
  else if (isRelativeActor(actor)) await assertRelativeAuthorizationScope(patientId, actor, AUTHORIZATION_TYPE.VIEW_RECORDS);
  else assertStaffPermission(actor, [
    PERMISSION.DOCUMENTS.TIMELINE_READ,
    PERMISSION.DOCUMENTS.TIMELINE_READ_DEPARTMENT,
    PERMISSION.DOCUMENTS.TIMELINE_READ_OWN,
    PERMISSION.MEDICAL_RECORDS.READ,
    PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT,
    PERMISSION.MEDICAL_RECORDS.READ_OWN,
    PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED,
  ]);
  const scope = await buildDocumentTimelineScope(patientId, actor);
  const patientFilter = { patient_id: patientId };
  const isSelfPortalActor = actorType(actor) === 'patient' || isRelativeActor(actor);
  const recordFilter = applyTimelineScope({
    ...patientFilter,
    ...(isSelfPortalActor ? { released_to_patient: true, status: { $ne: MEDICAL_RECORD_STATUS.VOIDED } } : {}),
  }, scope, 'medical_record');
  const attachmentFilter = applyTimelineScope({
    ...patientFilter,
    status: isSelfPortalActor ? ATTACHMENT_STATUS.ACTIVE : { $ne: ATTACHMENT_STATUS.DELETED },
    ...(isSelfPortalActor ? { released_to_patient: true } : {}),
  }, scope, 'attachment');
  const labResultFilter = applyTimelineScope({
    ...patientFilter,
    status: { $in: FINAL_LAB_STATUSES },
    ...(isSelfPortalActor ? { released_to_patient: true } : {}),
  }, scope, 'lab_result');
  const imagingReportFilter = applyTimelineScope({
    ...patientFilter,
    status: { $in: FINAL_IMAGING_STATUSES },
    ...(isSelfPortalActor ? { released_to_patient: true } : {}),
  }, scope, 'imaging_report');
  const prescriptionFilter = isRelativeActor(actor) ? null : applyTimelineScope({ ...patientFilter }, scope, 'prescription');
  const invoiceFilter = isRelativeActor(actor) ? null : applyTimelineScope({
    ...patientFilter,
    ...(actorType(actor) === 'patient' ? { status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] } } : {}),
  }, scope, 'invoice');
  const [
    records,
    attachments,
    labResults,
    imagingReports,
    prescriptions,
    invoices,
  ] = await Promise.all([
    MedicalRecord.find(recordFilter).lean(),
    Attachment.find(attachmentFilter).lean(),
    hasAnyPermission(actor, [PERMISSION.LAB_RESULTS.READ_FINAL, PERMISSION.MEDICAL_RECORDS.READ, PERMISSION.DOCUMENTS.TIMELINE_READ, PERMISSION.DOCUMENTS.TIMELINE_READ_OWN])
      ? LabResult.find(labResultFilter).lean()
      : Promise.resolve([]),
    hasAnyPermission(actor, [PERMISSION.IMAGING_REPORTS.READ_FINAL, PERMISSION.MEDICAL_RECORDS.READ, PERMISSION.DOCUMENTS.TIMELINE_READ, PERMISSION.DOCUMENTS.TIMELINE_READ_OWN])
      ? ImagingReport.find(imagingReportFilter).lean()
      : Promise.resolve([]),
    prescriptionFilter && hasAnyPermission(actor, [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.SELF_READ, PERMISSION.MEDICAL_RECORDS.READ])
      ? Prescription.find(prescriptionFilter).lean()
      : Promise.resolve([]),
    invoiceFilter && hasAnyPermission(actor, [PERMISSION.INVOICES.READ, PERMISSION.INVOICES.SELF_READ, PERMISSION.MEDICAL_RECORDS.READ])
      ? Invoice.find(invoiceFilter).lean()
      : Promise.resolve([]),
  ]);
  const events = [
    ...records.map((record) => timelineEvent({
      event_type: 'medical_record',
      title: record.title,
      description: record.summary,
      occurred_at: record.closed_at || record.opened_at || record.created_at,
      entity_type: ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD,
      entity_id: record._id,
      status: record.status,
    })),
    ...attachments.map((attachment) => timelineEvent({
      event_type: 'attachment',
      title: attachment.original_name || attachment.file_name,
      description: attachment.description,
      occurred_at: attachment.created_at,
      entity_type: attachment.entity_type,
      entity_id: attachment.entity_id,
      status: attachment.status,
    })),
    ...labResults.map((result) => timelineEvent({
      event_type: 'lab_result_final',
      title: `Kết quả xét nghiệm ${result.result_no}`,
      description: result.interpretation,
      occurred_at: result.reported_at || result.verified_at || result.created_at,
      entity_type: ATTACHMENT_ENTITY_TYPE.LAB_RESULT,
      entity_id: result._id,
      status: result.status,
    })),
    ...imagingReports.map((report) => timelineEvent({
      event_type: 'imaging_report_final',
      title: `Báo cáo CĐHA ${report.report_no}`,
      description: report.impression,
      occurred_at: report.reported_at || report.verified_at || report.created_at,
      entity_type: ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT,
      entity_id: report._id,
      status: report.status,
    })),
    ...prescriptions.map((prescription) => timelineEvent({
      event_type: 'prescription',
      title: `Đơn thuốc ${prescription.prescription_no}`,
      description: prescription.note,
      occurred_at: prescription.prescribed_at || prescription.created_at,
      entity_type: ATTACHMENT_ENTITY_TYPE.PRESCRIPTION,
      entity_id: prescription._id,
      status: prescription.status,
    })),
    ...invoices.map((invoice) => timelineEvent({
      event_type: 'invoice',
      title: `Invoice ${invoice.invoice_no}`,
      description: `Total: ${invoice.total_amount}`,
      occurred_at: invoice.issued_at || invoice.created_at,
      entity_type: ATTACHMENT_ENTITY_TYPE.INVOICE,
      entity_id: invoice._id,
      status: invoice.status,
    })),
  ].filter((event) => event.occurred_at);
  events.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
  const { page, limit, skip } = getPagination(query);
  return {
    items: events.slice(skip, skip + limit),
    pagination: buildPagination(page, limit, events.length),
  };
}

module.exports = {
  // generateMedicalRecordNumber: Sinh/tạo mã hồ sơ bệnh án.
  generateMedicalRecordNumber,
  // validateMedicalRecordCreation: Kiểm tra tính hợp lệ của điều kiện tạo hồ sơ bệnh án.
  validateMedicalRecordCreation,
  // createMedicalRecordFromEncounter: Tạo hồ sơ bệnh án từ lượt khám.
  createMedicalRecordFromEncounter,
  // getMedicalRecordByEncounter: Lấy hồ sơ bệnh án theo lượt khám.
  getMedicalRecordByEncounter,
  // listMedicalRecords: Liệt kê hồ sơ bệnh án.
  listMedicalRecords,
  // listPatientMedicalRecords: Liệt kê hồ sơ bệnh án của bệnh nhân.
  listPatientMedicalRecords,
  // getMedicalRecordDetail: Lấy chi tiết hồ sơ bệnh án.
  getMedicalRecordDetail,
  // updateMedicalRecord: Cập nhật hồ sơ bệnh án.
  updateMedicalRecord,
  // checkMedicalRecordCanFinalize: Kiểm tra điều kiện hoàn tất hồ sơ bệnh án.
  checkMedicalRecordCanFinalize,
  // finalizeMedicalRecord: Hoàn tất hồ sơ bệnh án để chuyển sang trạng thái chốt.
  finalizeMedicalRecord,
  // sealMedicalRecord: Niêm phong hồ sơ bệnh án sau khi hoàn tất.
  sealMedicalRecord,
  // archiveMedicalRecord: Lưu trữ hồ sơ bệnh án.
  archiveMedicalRecord,
  // voidMedicalRecord: Hủy hiệu lực hồ sơ bệnh án.
  voidMedicalRecord,
  // releaseMedicalRecordToPatient: Phát hành hồ sơ bệnh án cho bệnh nhân xem.
  releaseMedicalRecordToPatient,
  // exportMedicalRecord: Xuất hồ sơ bệnh án.
  exportMedicalRecord,
  // resolveEntityForAttachment: Xác định/xử lý đối tượng gắn tệp đính kèm.
  resolveEntityForAttachment,
  // uploadAttachment: Tải lên tệp đính kèm.
  uploadAttachment,
  // getAttachmentDetail: Lấy chi tiết tệp đính kèm.
  getAttachmentDetail,
  // downloadAttachment: Tải xuống tệp đính kèm.
  downloadAttachment,
  // getAttachmentsByEntity: Lấy tệp đính kèm theo đối tượng.
  getAttachmentsByEntity,
  // listPatientAttachments: Liệt kê tệp đính kèm của bệnh nhân.
  listPatientAttachments,
  // archiveAttachment: Lưu trữ tệp đính kèm.
  archiveAttachment,
  // softDeleteAttachment: Xóa mềm tệp đính kèm.
  softDeleteAttachment,
  // restoreAttachment: Khôi phục tệp đính kèm đã xóa mềm.
  restoreAttachment,
  // releaseAttachmentToPatient: Phát hành tệp đính kèm cho bệnh nhân xem.
  releaseAttachmentToPatient,
  // getPatientDocumentTimeline: Lấy dòng thời gian tài liệu của bệnh nhân.
  getPatientDocumentTimeline,
};
