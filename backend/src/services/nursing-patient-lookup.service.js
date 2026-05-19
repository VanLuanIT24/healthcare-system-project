const { Types } = require('mongoose');
const {
  Allergy,
  Appointment,
  Attachment,
  ClinicalNote,
  Diagnosis,
  Encounter,
  ImagingOrder,
  ImagingReport,
  Invoice,
  LabOrder,
  LabResult,
  MedicalRecord,
  Order,
  Patient,
  PatientAccount,
  PatientAuthorization,
  PatientIdentifier,
  PatientRelative,
  Prescription,
  ProblemList,
  VitalSign,
} = require('../models');
const permissionChecker = require('../common/permissions/permission-checker');
const { PERMISSION } = require('../constants/permissions');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  ALLERGY_STATUS,
  ATTACHMENT_STATUS,
  CLINICAL_NOTE_STATUS,
  ENCOUNTER_STATUS,
  IMAGING_REPORT_STATUS,
  INVOICE_STATUS,
  LAB_RESULT_STATUS,
  MEDICAL_RECORD_STATUS,
  PRESCRIPTION_STATUS,
  PROBLEM_STATUS,
  VITAL_SIGN_STATUS,
} = require('../constants/statuses');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
} = require('./core.service');

const OPEN_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const FINAL_LAB_STATUSES = [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED];
const FINAL_IMAGING_STATUSES = [IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED];
const ACTIVE_PRESCRIPTION_STATUSES = [
  PRESCRIPTION_STATUS.ACTIVE,
  PRESCRIPTION_STATUS.VERIFIED,
  PRESCRIPTION_STATUS.PARTIALLY_DISPENSED,
];
const UNPAID_INVOICE_STATUSES = [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID];
const SEVERE_ALLERGY_SEVERITIES = ['severe', 'life_threatening'];
const SEVERE_PROBLEM_SEVERITIES = ['severe'];
const ABNORMAL_VITAL_SEVERITIES = ['mild', 'warning', 'high', 'critical'];

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return String(value);
  if (value._id) return normalizeId(value._id);
  if (value.id) return normalizeId(value.id);
  return typeof value.toString === 'function' ? value.toString() : null;
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (value._id) return toObjectId(value._id, fieldName);
  if (!Types.ObjectId.isValid(String(value))) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(String(value));
}

function hasPermission(actor = {}, permissionCode) {
  return permissionChecker.hasPermission(actor, permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionChecker.hasAnyPermission(actor, permissionCodes);
}

function parseBool(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function ageFromDate(value) {
  if (!value) return null;
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function patientLookupReadable(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.READ_ASSIGNED,
    PERMISSION.PATIENTS.SEARCH,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.ENCOUNTERS.READ_ASSIGNED,
    PERMISSION.VITAL_SIGNS.READ,
  ]);
}

function canViewSensitivePatient(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.UPDATE_SENSITIVE,
    PERMISSION.PATIENT_IDENTIFIERS.READ,
    PERMISSION.PATIENT_IDENTIFIERS.MANAGE,
  ]);
}

function buildAllowedActions(actor = {}) {
  return {
    can_update_patient: hasAnyPermission(actor, [PERMISSION.PATIENTS.UPDATE, PERMISSION.PATIENTS.UPDATE_BASIC]),
    can_update_sensitive: hasPermission(actor, PERMISSION.PATIENTS.UPDATE_SENSITIVE),
    can_add_identifier: hasAnyPermission(actor, [PERMISSION.PATIENT_IDENTIFIERS.CREATE, PERMISSION.PATIENT_IDENTIFIERS.MANAGE]),
    can_add_relative: hasPermission(actor, PERMISSION.PATIENT_RELATIVES.CREATE),
    can_create_authorization: hasAnyPermission(actor, [PERMISSION.PATIENT_AUTHORIZATIONS.CREATE, PERMISSION.PATIENT_AUTHORIZATIONS.MANAGE]),
    can_approve_authorization: hasAnyPermission(actor, [PERMISSION.PATIENT_AUTHORIZATIONS.APPROVE, PERMISSION.PATIENT_AUTHORIZATIONS.MANAGE]),
    can_view_clinical_summary: hasAnyPermission(actor, [
      PERMISSION.ALLERGIES.READ,
      PERMISSION.PROBLEMS.READ,
      PERMISSION.VITAL_SIGNS.READ,
      PERMISSION.ENCOUNTERS.READ,
      PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
      PERMISSION.ENCOUNTERS.READ_ASSIGNED,
    ]),
    can_add_allergy: hasPermission(actor, PERMISSION.ALLERGIES.CREATE),
    can_add_problem: hasPermission(actor, PERMISSION.PROBLEMS.CREATE),
    can_record_vitals: hasPermission(actor, PERMISSION.VITAL_SIGNS.CREATE),
    can_update_vitals: hasPermission(actor, PERMISSION.VITAL_SIGNS.UPDATE_OWN),
    can_create_nursing_note: hasAnyPermission(actor, [PERMISSION.CLINICAL_NOTES.CREATE_NURSING, PERMISSION.CLINICAL_NOTES.CREATE]),
    can_view_documents: hasAnyPermission(actor, [
      PERMISSION.MEDICAL_RECORDS.READ,
      PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT,
      PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED,
      PERMISSION.ATTACHMENTS.READ,
      PERMISSION.ATTACHMENTS.READ_DEPARTMENT,
      PERMISSION.DOCUMENTS.TIMELINE_READ,
      PERMISSION.DOCUMENTS.TIMELINE_READ_DEPARTMENT,
    ]),
    can_download_attachment: hasPermission(actor, PERMISSION.ATTACHMENTS.DOWNLOAD),
    can_upload_attachment: hasAnyPermission(actor, [
      PERMISSION.ATTACHMENTS.UPLOAD,
      PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL,
      PERMISSION.ATTACHMENTS.CREATE,
    ]),
    can_export_record: hasPermission(actor, PERMISSION.MEDICAL_RECORDS.EXPORT),
    can_release_document: hasAnyPermission(actor, [
      PERMISSION.MEDICAL_RECORDS.RELEASE_TO_PATIENT,
      PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT,
    ]),
    can_start_break_glass: hasPermission(actor, PERMISSION.BREAK_GLASS.START),
  };
}

function maskValue(value, visible = 4) {
  if (!value) return value;
  const text = String(value);
  if (text.length <= visible) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(text.length - visible, 0))}${text.slice(-visible)}`;
}

function maskPhone(value) {
  if (!value) return value;
  const text = String(value);
  if (text.length <= 4) return '****';
  return `${text.slice(0, 3)}****${text.slice(-3)}`;
}

function userDto(user = {}) {
  if (!user) return null;
  const value = user && typeof user === 'object' ? user : {};
  return {
    user_id: normalizeId(user),
    full_name: value.full_name || value.username || value.employee_code || null,
    employee_code: value.employee_code || null,
  };
}

function departmentDto(department = {}) {
  if (!department) return null;
  const value = department && typeof department === 'object' ? department : {};
  return {
    department_id: normalizeId(department),
    department_code: value.department_code || null,
    department_name: value.department_name || value.name || null,
  };
}

function patientDto(patient = {}, actor = {}) {
  const includeSensitive = canViewSensitivePatient(actor);
  return {
    patient_id: normalizeId(patient),
    patient_code: patient.patient_code || null,
    full_name: patient.full_name || null,
    date_of_birth: patient.date_of_birth || null,
    age: ageFromDate(patient.date_of_birth),
    gender: patient.gender || null,
    phone: includeSensitive ? patient.phone || null : maskPhone(patient.phone),
    email: includeSensitive ? patient.email || null : undefined,
    address: patient.address || null,
    national_id: includeSensitive ? patient.national_id || null : patient.national_id ? maskValue(patient.national_id) : undefined,
    insurance_number: includeSensitive ? patient.insurance_number || null : patient.insurance_number ? maskValue(patient.insurance_number) : undefined,
    identity_verified: Boolean(patient.identity_verified_at),
    identity_verified_at: patient.identity_verified_at || null,
    emergency_contact_name: patient.emergency_contact_name || null,
    emergency_contact_phone: includeSensitive ? patient.emergency_contact_phone || null : maskPhone(patient.emergency_contact_phone),
    status: patient.status || null,
    created_at: patient.created_at || null,
    updated_at: patient.updated_at || null,
  };
}

function identifierDto(identifier = {}, actor = {}) {
  const includeSensitive = canViewSensitivePatient(actor);
  return {
    identifier_id: normalizeId(identifier),
    identifier_type: identifier.identifier_type,
    identifier_value: includeSensitive ? identifier.identifier_value : maskValue(identifier.identifier_value),
    issued_by: identifier.issued_by || null,
    valid_from: identifier.valid_from || null,
    valid_to: identifier.valid_to || null,
    is_primary: Boolean(identifier.is_primary),
    status: identifier.is_deleted ? 'deleted' : 'active',
    created_at: identifier.created_at || null,
  };
}

function relativeDto(relative = {}, actor = {}) {
  const includeSensitive = canViewSensitivePatient(actor);
  return {
    relative_id: normalizeId(relative),
    full_name: relative.full_name,
    relationship: relative.relationship,
    phone: includeSensitive ? relative.phone || null : maskPhone(relative.phone),
    email: includeSensitive ? relative.email || null : undefined,
    address: relative.address || null,
    is_primary_contact: Boolean(relative.is_primary_contact),
    is_emergency_contact: Boolean(relative.is_emergency_contact),
    relationship_verified: Boolean(relative.relationship_verified),
    status: relative.status || null,
  };
}

function accountDto(account = {}) {
  if (!account) return null;
  return {
    account_id: normalizeId(account),
    username: account.username || null,
    status: account.status || null,
    auth_provider: account.auth_provider || null,
    email_verified: Boolean(account.email_verified),
    phone_verified: Boolean(account.phone_verified_at),
    last_login_at: account.last_login_at || null,
  };
}

function encounterDto(encounter = {}) {
  if (!encounter) return null;
  return {
    encounter_id: normalizeId(encounter),
    encounter_code: encounter.encounter_code || null,
    encounter_type: encounter.encounter_type || null,
    status: encounter.status || null,
    nursing_status: encounter.nursing_status || null,
    start_time: encounter.start_time || null,
    end_time: encounter.end_time || null,
    chief_reason: encounter.chief_reason || null,
    department: departmentDto(encounter.department_id),
    attending_doctor: userDto(encounter.attending_doctor_id),
    assigned_nurse: userDto(encounter.assigned_nurse_id),
  };
}

function vitalDto(vital = {}) {
  if (!vital) return null;
  return {
    vital_sign_id: normalizeId(vital),
    patient_id: normalizeId(vital.patient_id),
    encounter_id: normalizeId(vital.encounter_id),
    recorded_by: userDto(vital.recorded_by),
    recorded_at: vital.recorded_at || null,
    temperature: vital.temperature ?? null,
    heart_rate: vital.heart_rate ?? null,
    respiratory_rate: vital.respiratory_rate ?? null,
    systolic_bp: vital.systolic_bp ?? null,
    diastolic_bp: vital.diastolic_bp ?? null,
    spo2: vital.spo2 ?? null,
    weight: vital.weight ?? null,
    height: vital.height ?? null,
    bmi: vital.bmi ?? null,
    pain_score: vital.pain_score ?? null,
    blood_glucose: vital.blood_glucose ?? null,
    map: vital.map ?? null,
    severity: vital.overall_severity || vital.severity || 'normal',
    abnormal_flags: vital.abnormal_flags || [],
    requires_recheck: Boolean(vital.requires_recheck),
    requires_doctor_notification: Boolean(vital.requires_doctor_notification || vital.doctor_notification_required),
    status: vital.status || null,
  };
}

function severityRank(value) {
  return {
    life_threatening: 50,
    critical: 45,
    severe: 40,
    high: 35,
    warning: 30,
    moderate: 20,
    mild: 10,
    unknown: 0,
    normal: 0,
  }[value] || 0;
}

function sortBySeverity(items = []) {
  return [...items].sort((left, right) => (severityRank(right.severity) - severityRank(left.severity)) || new Date(right.created_at || 0) - new Date(left.created_at || 0));
}

async function loadPatient(patientId, actor = {}) {
  if (!patientLookupReadable(actor)) throw createError('Bạn không có quyền tra cứu bệnh nhân.', 403);
  const patient = await Patient.findOne({ _id: toObjectId(patientId, 'patientId'), is_deleted: false }).lean();
  if (!patient) throw createError('Không tìm thấy bệnh nhân.', 404);
  return patient;
}

async function getPatientCore(patientId, actor = {}) {
  const patient = await loadPatient(patientId, actor);
  const patientObjectId = toObjectId(patient._id, 'patient_id');

  const canReadIdentifiers = canViewSensitivePatient(actor);
  const canReadAccount = hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.PATIENT_ACCOUNTS.READ]);
  const canReadRelatives = hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.PATIENT_RELATIVES.READ]);
  const canReadAuthorizations = hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.PATIENT_AUTHORIZATIONS.READ]);

  const [identifiers, account, relatives, authorizations] = await Promise.all([
    canReadIdentifiers
      ? PatientIdentifier.find({ patient_id: patientObjectId, is_deleted: false }).sort({ is_primary: -1, identifier_type: 1, created_at: -1 }).lean()
      : [],
    canReadAccount ? PatientAccount.findOne({ patient_id: patientObjectId, is_deleted: false }).lean() : null,
    canReadRelatives
      ? PatientRelative.find({ patient_id: patientObjectId, is_deleted: false }).sort({ is_primary_contact: -1, is_emergency_contact: -1, created_at: -1 }).lean()
      : [],
    canReadAuthorizations
      ? PatientAuthorization.find({ patient_id: patientObjectId, is_deleted: false }).sort({ created_at: -1 }).populate('relative_id', 'full_name relationship phone').lean()
      : [],
  ]);

  return {
    patient_raw: patient,
    patient: patientDto(patient, actor),
    identifiers: identifiers.map((item) => identifierDto(item, actor)),
    account: accountDto(account),
    relatives: relatives.map((item) => relativeDto(item, actor)),
    authorizations: authorizations.map((item) => ({
      authorization_id: normalizeId(item),
      relative_id: normalizeId(item.relative_id),
      relative: item.relative_id && typeof item.relative_id === 'object' ? relativeDto(item.relative_id, actor) : null,
      authorization_type: item.authorization_type,
      permissions: item.permissions || [],
      valid_from: item.valid_from,
      valid_to: item.valid_to || null,
      approved_by: userDto(item.approved_by),
      approved_at: item.approved_at || null,
      revoked_at: item.revoked_at || null,
      revoke_reason: item.revoke_reason || null,
      status: item.status,
    })),
  };
}

async function loadClinicalRisks(patientId) {
  const patientObjectId = toObjectId(patientId, 'patientId');
  const [allergies, problems] = await Promise.all([
    Allergy.find({ patient_id: patientObjectId, status: ALLERGY_STATUS.ACTIVE })
      .populate('recorded_by', 'full_name employee_code')
      .populate('encounter_id', 'encounter_code start_time status')
      .lean(),
    ProblemList.find({ patient_id: patientObjectId, status: PROBLEM_STATUS.ACTIVE })
      .populate('recorded_by', 'full_name employee_code')
      .populate('encounter_id', 'encounter_code start_time status')
      .lean(),
  ]);
  return {
    active_allergies: sortBySeverity(allergies),
    active_problems: sortBySeverity(problems),
  };
}

async function loadDocumentCounters(patientId) {
  const patientObjectId = toObjectId(patientId, 'patientId');
  const [
    totalRecords,
    finalizedRecords,
    sealedRecords,
    archivedRecords,
    voidedRecords,
    totalAttachments,
    pendingReview,
    scanPending,
    scanFailed,
    releasedAttachments,
    releasedRecords,
  ] = await Promise.all([
    MedicalRecord.countDocuments({ patient_id: patientObjectId }),
    MedicalRecord.countDocuments({ patient_id: patientObjectId, status: MEDICAL_RECORD_STATUS.FINALIZED }),
    MedicalRecord.countDocuments({ patient_id: patientObjectId, status: MEDICAL_RECORD_STATUS.SEALED }),
    MedicalRecord.countDocuments({ patient_id: patientObjectId, status: MEDICAL_RECORD_STATUS.ARCHIVED }),
    MedicalRecord.countDocuments({ patient_id: patientObjectId, status: MEDICAL_RECORD_STATUS.VOIDED }),
    Attachment.countDocuments({ patient_id: patientObjectId, status: { $ne: ATTACHMENT_STATUS.DELETED } }),
    Attachment.countDocuments({ patient_id: patientObjectId, review_status: 'pending' }),
    Attachment.countDocuments({ patient_id: patientObjectId, scan_status: 'pending' }),
    Attachment.countDocuments({ patient_id: patientObjectId, scan_status: { $in: ['failed', 'infected'] } }),
    Attachment.countDocuments({ patient_id: patientObjectId, released_to_patient: true, status: { $ne: ATTACHMENT_STATUS.DELETED } }),
    MedicalRecord.countDocuments({ patient_id: patientObjectId, released_to_patient: true }),
  ]);
  return {
    total_records: totalRecords,
    finalized_records: finalizedRecords,
    sealed_records: sealedRecords,
    archived_records: archivedRecords,
    voided_records: voidedRecords,
    total_attachments: totalAttachments,
    pending_review: pendingReview,
    scan_pending: scanPending,
    scan_failed: scanFailed,
    released_to_patient: releasedAttachments + releasedRecords,
  };
}

async function loadCriticalSignals(patientId) {
  const patientObjectId = toObjectId(patientId, 'patientId');
  const [criticalLab, criticalImaging] = await Promise.all([
    LabResult.countDocuments({
      patient_id: patientObjectId,
      is_critical: true,
      status: { $in: FINAL_LAB_STATUSES },
      $or: [{ critical_acknowledged_at: null }, { critical_acknowledged_at: { $exists: false } }],
    }),
    ImagingReport.countDocuments({
      patient_id: patientObjectId,
      is_critical: true,
      status: { $in: FINAL_IMAGING_STATUSES },
      $or: [{ critical_acknowledged_at: null }, { critical_acknowledged_at: { $exists: false } }],
    }),
  ]);
  return { critical_lab_count: criticalLab, critical_imaging_count: criticalImaging };
}

async function loadBillingWarning(patientId) {
  const patientObjectId = toObjectId(patientId, 'patientId');
  const invoices = await Invoice.find({
    patient_id: patientObjectId,
    status: { $in: UNPAID_INVOICE_STATUSES },
    balance_due: { $gt: 0 },
  }).select('invoice_no status balance_due due_at issued_at currency').sort({ due_at: 1, issued_at: -1 }).limit(5).lean();
  const totalBalanceDue = invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0);
  return {
    has_unpaid_invoice: invoices.length > 0,
    unpaid_count: invoices.length,
    total_balance_due: totalBalanceDue,
    currency: invoices[0]?.currency || 'VND',
    items: invoices,
  };
}

async function loadDuplicateWarning(patient = {}) {
  if (!patient.full_name || !patient.date_of_birth) return { has_duplicate_warning: false, duplicate_count: 0, candidates: [] };
  const candidates = await Patient.find({
    _id: { $ne: patient._id },
    is_deleted: false,
    full_name: patient.full_name,
    date_of_birth: patient.date_of_birth,
  }).select('patient_code full_name date_of_birth gender phone status').limit(5).lean();
  return {
    has_duplicate_warning: candidates.length > 0,
    duplicate_count: candidates.length,
    candidates: candidates.map((item) => patientDto(item, {})),
  };
}

async function loadSnapshotData(patientId, actor = {}, { includeTimeline = false } = {}) {
  const core = await getPatientCore(patientId, actor);
  const patientObjectId = toObjectId(core.patient_raw._id, 'patient_id');
  const now = new Date();

  const [
    risks,
    latestVitals,
    activeEncounter,
    latestEncounter,
    upcomingAppointments,
    prescriptions,
    labResults,
    imagingReports,
    medicalRecords,
    attachments,
    documentCounters,
    criticalSignals,
    billingWarning,
    duplicateWarning,
    recentTimeline,
  ] = await Promise.all([
    loadClinicalRisks(patientObjectId),
    VitalSign.findOne({ patient_id: patientObjectId, status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR } })
      .sort({ recorded_at: -1, created_at: -1 })
      .populate('recorded_by', 'full_name employee_code')
      .lean(),
    Encounter.findOne({ patient_id: patientObjectId, status: { $in: OPEN_ENCOUNTER_STATUSES } })
      .sort({ start_time: -1 })
      .populate('department_id', 'department_code department_name')
      .populate('attending_doctor_id', 'full_name employee_code')
      .populate('assigned_nurse_id', 'full_name employee_code')
      .lean(),
    Encounter.findOne({ patient_id: patientObjectId })
      .sort({ start_time: -1 })
      .populate('department_id', 'department_code department_name')
      .populate('attending_doctor_id', 'full_name employee_code')
      .populate('assigned_nurse_id', 'full_name employee_code')
      .lean(),
    Appointment.find({
      patient_id: patientObjectId,
      is_deleted: false,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      appointment_time: { $gte: now },
    }).sort({ appointment_time: 1 }).limit(5).populate('doctor_id', 'full_name employee_code').populate('department_id', 'department_code department_name').lean(),
    Prescription.find({ patient_id: patientObjectId, status: { $ne: PRESCRIPTION_STATUS.CANCELLED } })
      .sort({ prescribed_at: -1, created_at: -1 })
      .limit(5)
      .populate('prescribed_by', 'full_name employee_code')
      .populate('encounter_id', 'encounter_code start_time status')
      .lean(),
    LabResult.find({ patient_id: patientObjectId, is_current: { $ne: false } })
      .sort({ reported_at: -1, created_at: -1 })
      .limit(5)
      .populate('lab_order_id', 'lab_order_no test_name encounter_id priority status')
      .lean(),
    ImagingReport.find({ patient_id: patientObjectId })
      .sort({ reported_at: -1, created_at: -1 })
      .limit(5)
      .populate('imaging_order_id', 'imaging_order_no modality body_part encounter_id priority status')
      .lean(),
    MedicalRecord.find({ patient_id: patientObjectId, status: { $ne: MEDICAL_RECORD_STATUS.VOIDED } })
      .sort({ opened_at: -1, created_at: -1 })
      .limit(5)
      .populate('custodian_department_id', 'department_code department_name')
      .lean(),
    Attachment.find({ patient_id: patientObjectId, status: { $ne: ATTACHMENT_STATUS.DELETED } })
      .sort({ created_at: -1 })
      .limit(5)
      .lean(),
    loadDocumentCounters(patientObjectId),
    loadCriticalSignals(patientObjectId),
    loadBillingWarning(patientObjectId),
    loadDuplicateWarning(core.patient_raw),
    includeTimeline ? buildRecentPatientTimeline(patientObjectId, { limit: 16 }) : Promise.resolve([]),
  ]);

  const latestVitalDto = vitalDto(latestVitals);
  const activeAllergies = risks.active_allergies || [];
  const activeProblems = risks.active_problems || [];
  const pendingAuthorizations = core.authorizations.filter((authorization) => authorization.status === 'pending');

  const riskFlags = {
    has_active_allergy: activeAllergies.length > 0,
    has_severe_allergy: activeAllergies.some((item) => SEVERE_ALLERGY_SEVERITIES.includes(item.severity)),
    has_active_problem: activeProblems.length > 0,
    has_severe_problem: activeProblems.some((item) => SEVERE_PROBLEM_SEVERITIES.includes(item.severity)),
    has_open_encounter: Boolean(activeEncounter),
    has_abnormal_latest_vitals: Boolean(latestVitalDto && ABNORMAL_VITAL_SEVERITIES.includes(latestVitalDto.severity) && latestVitalDto.severity !== 'normal'),
    has_critical_lab_result: criticalSignals.critical_lab_count > 0,
    has_critical_imaging_result: criticalSignals.critical_imaging_count > 0,
    has_pending_document_review: documentCounters.pending_review > 0,
    has_unpaid_invoice: billingWarning.has_unpaid_invoice,
    identity_not_verified: !core.patient.identity_verified,
    has_duplicate_warning: duplicateWarning.has_duplicate_warning,
    has_pending_relative_authorization: pendingAuthorizations.length > 0,
  };

  return {
    patient: core.patient,
    identifiers: core.identifiers,
    account: core.account,
    relatives: core.relatives,
    authorizations: core.authorizations,
    active_allergies: activeAllergies,
    active_problems: activeProblems,
    latest_vitals: latestVitalDto,
    active_encounter: encounterDto(activeEncounter),
    latest_encounter: encounterDto(latestEncounter),
    upcoming_appointments: upcomingAppointments,
    recent_prescriptions: prescriptions,
    recent_lab_results: labResults,
    recent_imaging_reports: imagingReports,
    recent_documents: [
      ...medicalRecords.map((item) => ({ type: 'medical_record', ...item })),
      ...attachments.map((item) => ({ type: 'attachment', ...item })),
    ].sort((left, right) => new Date(right.created_at || right.opened_at || 0) - new Date(left.created_at || left.opened_at || 0)).slice(0, 8),
    document_counters: documentCounters,
    billing_warning: billingWarning,
    duplicate_warning: duplicateWarning,
    risk_flags: riskFlags,
    allowed_actions: buildAllowedActions(actor),
    recent_timeline: recentTimeline,
  };
}

async function buildRecentPatientTimeline(patientId, { limit = 20 } = {}) {
  const patientObjectId = toObjectId(patientId, 'patientId');
  const [encounters, vitals, records, attachments, labs, imaging, prescriptions] = await Promise.all([
    Encounter.find({ patient_id: patientObjectId }).sort({ start_time: -1 }).limit(limit).lean(),
    VitalSign.find({ patient_id: patientObjectId, status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR } }).sort({ recorded_at: -1 }).limit(limit).lean(),
    MedicalRecord.find({ patient_id: patientObjectId }).sort({ opened_at: -1, created_at: -1 }).limit(limit).lean(),
    Attachment.find({ patient_id: patientObjectId, status: { $ne: ATTACHMENT_STATUS.DELETED } }).sort({ created_at: -1 }).limit(limit).lean(),
    LabResult.find({ patient_id: patientObjectId }).sort({ reported_at: -1, created_at: -1 }).limit(limit).lean(),
    ImagingReport.find({ patient_id: patientObjectId }).sort({ reported_at: -1, created_at: -1 }).limit(limit).lean(),
    Prescription.find({ patient_id: patientObjectId }).sort({ prescribed_at: -1, created_at: -1 }).limit(limit).lean(),
  ]);

  const events = [
    ...encounters.map((item) => timelineEvent('encounter', item.status, item.encounter_code, item.chief_reason, item.start_time, item._id)),
    ...vitals.map((item) => timelineEvent('vital', item.overall_severity || item.severity, 'Sinh hiệu', vitalSummary(item), item.recorded_at, item._id)),
    ...records.map((item) => timelineEvent('medical_record', item.status, item.title || item.record_no, item.summary, item.opened_at || item.created_at, item._id)),
    ...attachments.map((item) => timelineEvent('attachment', item.status, item.original_name || item.file_name, item.description, item.created_at, item._id)),
    ...labs.map((item) => timelineEvent('lab_result', item.status, `Kết quả ${item.result_no}`, item.interpretation, item.reported_at || item.created_at, item._id, { is_critical: item.is_critical })),
    ...imaging.map((item) => timelineEvent('imaging_report', item.status, `CĐHA ${item.report_no}`, item.impression, item.reported_at || item.created_at, item._id, { is_critical: item.is_critical })),
    ...prescriptions.map((item) => timelineEvent('prescription', item.status, `Đơn thuốc ${item.prescription_no}`, item.note, item.prescribed_at || item.created_at, item._id)),
  ].filter((event) => event.occurred_at);

  return events
    .sort((left, right) => new Date(right.occurred_at) - new Date(left.occurred_at))
    .slice(0, limit);
}

function timelineEvent(type, status, title, description, occurredAt, entityId, extra = {}) {
  return {
    event_type: type,
    status,
    title,
    description,
    occurred_at: occurredAt,
    entity_id: normalizeId(entityId),
    ...extra,
  };
}

function vitalSummary(vital = {}) {
  return [
    vital.temperature !== undefined && vital.temperature !== null ? `T ${vital.temperature}°C` : null,
    vital.heart_rate !== undefined && vital.heart_rate !== null ? `M ${vital.heart_rate}` : null,
    vital.systolic_bp && vital.diastolic_bp ? `HA ${vital.systolic_bp}/${vital.diastolic_bp}` : null,
    vital.spo2 !== undefined && vital.spo2 !== null ? `SpO2 ${vital.spo2}%` : null,
  ].filter(Boolean).join(' · ');
}

async function getPatientSnapshot(patientId, actor = {}) {
  return loadSnapshotData(patientId, actor);
}

async function getProfileCenter(patientId, actor = {}) {
  return loadSnapshotData(patientId, actor, { includeTimeline: true });
}

function applyDateRange(filter, query = {}, field = 'start_time') {
  if (query.date_from || query.date_to) {
    filter[field] = {};
    if (query.date_from) filter[field].$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter[field].$lte = getEndOfDay(query.date_to);
  }
}

function intersectObjectIdSets(left = [], right = []) {
  const rightSet = new Set(right.map(normalizeId));
  return left.filter((id) => rightSet.has(normalizeId(id)));
}

function appendEncounterIdConstraint(filter, ids = []) {
  const objectIds = ids.map((id) => toObjectId(id, 'encounter_id')).filter(Boolean);
  if (!objectIds.length) {
    filter._id = { $in: [] };
    return;
  }
  if (filter._id?.$in) {
    filter._id.$in = intersectObjectIdSets(filter._id.$in, objectIds);
    return;
  }
  filter._id = { $in: objectIds };
}

async function encounterIdsWithCriticalResults(patientId) {
  const patientObjectId = toObjectId(patientId, 'patientId');
  const [labRows, imagingRows] = await Promise.all([
    LabResult.aggregate([
      { $match: { patient_id: patientObjectId, is_critical: true } },
      { $lookup: { from: 'lab_orders', localField: 'lab_order_id', foreignField: '_id', as: 'order' } },
      { $unwind: '$order' },
      { $project: { encounter_id: '$order.encounter_id' } },
    ]),
    ImagingReport.aggregate([
      { $match: { patient_id: patientObjectId, is_critical: true } },
      { $lookup: { from: 'imaging_orders', localField: 'imaging_order_id', foreignField: '_id', as: 'order' } },
      { $unwind: '$order' },
      { $project: { encounter_id: '$order.encounter_id' } },
    ]),
  ]);
  return [...new Set([...labRows, ...imagingRows].map((row) => normalizeId(row.encounter_id)).filter(Boolean))];
}

async function applyEncounterHistoryFilters(filter, patientId, query = {}) {
  const patientObjectId = toObjectId(patientId, 'patientId');
  if (parseBool(query.has_lab)) {
    appendEncounterIdConstraint(filter, await LabOrder.distinct('encounter_id', { patient_id: patientObjectId }));
  }
  if (parseBool(query.has_imaging)) {
    appendEncounterIdConstraint(filter, await ImagingOrder.distinct('encounter_id', { patient_id: patientObjectId }));
  }
  if (parseBool(query.has_prescription)) {
    appendEncounterIdConstraint(filter, await Prescription.distinct('encounter_id', { patient_id: patientObjectId }));
  }
  if (parseBool(query.has_document)) {
    const [recordEncounterIds, attachmentEncounterIds] = await Promise.all([
      MedicalRecord.distinct('encounter_id', { patient_id: patientObjectId, encounter_id: { $exists: true } }),
      Attachment.distinct('encounter_id', { patient_id: patientObjectId, encounter_id: { $exists: true }, status: { $ne: ATTACHMENT_STATUS.DELETED } }),
    ]);
    appendEncounterIdConstraint(filter, [...recordEncounterIds, ...attachmentEncounterIds]);
  }
  if (parseBool(query.has_critical)) {
    appendEncounterIdConstraint(filter, await encounterIdsWithCriticalResults(patientObjectId));
  }
}

async function getEncounterMetrics(encounterIds = []) {
  const ids = encounterIds.map((id) => toObjectId(id, 'encounter_id')).filter(Boolean);
  if (!ids.length) {
    return {
      latestVitals: new Map(),
      primaryDiagnoses: new Map(),
      orderCounts: new Map(),
      labCounts: new Map(),
      imagingCounts: new Map(),
      prescriptionCounts: new Map(),
      noteCounts: new Map(),
      documentCounts: new Map(),
      criticalLab: new Set(),
      criticalImaging: new Set(),
      unfinalizedRecord: new Set(),
    };
  }

  const [
    vitals,
    diagnoses,
    orders,
    labOrders,
    imagingOrders,
    prescriptions,
    notes,
    records,
    attachments,
    criticalLabRows,
    criticalImagingRows,
  ] = await Promise.all([
    VitalSign.find({ encounter_id: { $in: ids }, status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR } }).sort({ recorded_at: -1 }).populate('recorded_by', 'full_name employee_code').lean(),
    Diagnosis.find({ encounter_id: { $in: ids }, status: { $ne: 'entered_in_error' } }).sort({ is_primary: -1, created_at: -1 }).lean(),
    Order.aggregate([{ $match: { encounter_id: { $in: ids } } }, { $group: { _id: '$encounter_id', count: { $sum: 1 } } }]),
    LabOrder.aggregate([{ $match: { encounter_id: { $in: ids } } }, { $group: { _id: '$encounter_id', count: { $sum: 1 } } }]),
    ImagingOrder.aggregate([{ $match: { encounter_id: { $in: ids } } }, { $group: { _id: '$encounter_id', count: { $sum: 1 } } }]),
    Prescription.aggregate([{ $match: { encounter_id: { $in: ids }, status: { $ne: PRESCRIPTION_STATUS.CANCELLED } } }, { $group: { _id: '$encounter_id', count: { $sum: 1 } } }]),
    ClinicalNote.aggregate([{ $match: { encounter_id: { $in: ids }, status: { $ne: CLINICAL_NOTE_STATUS.CANCELLED } } }, { $group: { _id: '$encounter_id', count: { $sum: 1 } } }]),
    MedicalRecord.find({ encounter_id: { $in: ids } }).select('encounter_id status').lean(),
    Attachment.aggregate([{ $match: { encounter_id: { $in: ids }, status: { $ne: ATTACHMENT_STATUS.DELETED } } }, { $group: { _id: '$encounter_id', count: { $sum: 1 } } }]),
    LabResult.aggregate([
      { $match: { is_critical: true } },
      { $lookup: { from: 'lab_orders', localField: 'lab_order_id', foreignField: '_id', as: 'order' } },
      { $unwind: '$order' },
      { $match: { 'order.encounter_id': { $in: ids } } },
      { $group: { _id: '$order.encounter_id', count: { $sum: 1 } } },
    ]),
    ImagingReport.aggregate([
      { $match: { is_critical: true } },
      { $lookup: { from: 'imaging_orders', localField: 'imaging_order_id', foreignField: '_id', as: 'order' } },
      { $unwind: '$order' },
      { $match: { 'order.encounter_id': { $in: ids } } },
      { $group: { _id: '$order.encounter_id', count: { $sum: 1 } } },
    ]),
  ]);

  const latestVitals = new Map();
  vitals.forEach((vital) => {
    const key = normalizeId(vital.encounter_id);
    if (!latestVitals.has(key)) latestVitals.set(key, vitalDto(vital));
  });
  const primaryDiagnoses = new Map();
  diagnoses.forEach((diagnosis) => {
    const key = normalizeId(diagnosis.encounter_id);
    if (!primaryDiagnoses.has(key) || diagnosis.is_primary) primaryDiagnoses.set(key, diagnosis);
  });
  const countMap = (rows) => new Map(rows.map((row) => [normalizeId(row._id), row.count]));
  const documentCounts = countMap(attachments);
  records.forEach((record) => {
    const key = normalizeId(record.encounter_id);
    documentCounts.set(key, (documentCounts.get(key) || 0) + 1);
  });

  return {
    latestVitals,
    primaryDiagnoses,
    orderCounts: countMap(orders),
    labCounts: countMap(labOrders),
    imagingCounts: countMap(imagingOrders),
    prescriptionCounts: countMap(prescriptions),
    noteCounts: countMap(notes),
    documentCounts,
    criticalLab: new Set(criticalLabRows.map((row) => normalizeId(row._id))),
    criticalImaging: new Set(criticalImagingRows.map((row) => normalizeId(row._id))),
    unfinalizedRecord: new Set(records.filter((record) => ![MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED, MEDICAL_RECORD_STATUS.ARCHIVED].includes(record.status)).map((record) => normalizeId(record.encounter_id))),
  };
}

async function getEncounterHistory(patientId, query = {}, actor = {}) {
  await loadPatient(patientId, actor);
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = { patient_id: toObjectId(patientId, 'patientId') };
  if (query.encounter_type) filter.encounter_type = query.encounter_type;
  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.department_id) filter.department_id = toObjectId(query.department_id, 'department_id');
  if (query.doctor_id) filter.attending_doctor_id = toObjectId(query.doctor_id, 'doctor_id');
  applyDateRange(filter, query, 'start_time');
  await applyEncounterHistoryFilters(filter, patientId, query);

  const [items, total] = await Promise.all([
    Encounter.find(filter)
      .sort({ start_time: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('department_id', 'department_code department_name')
      .populate('attending_doctor_id', 'full_name employee_code')
      .populate('assigned_nurse_id', 'full_name employee_code')
      .lean(),
    Encounter.countDocuments(filter),
  ]);
  const metrics = await getEncounterMetrics(items.map((item) => item._id));

  return {
    patient_id: normalizeId(patientId),
    items: items.map((encounter) => {
      const id = normalizeId(encounter);
      return {
        ...encounterDto(encounter),
        latest_vitals: metrics.latestVitals.get(id) || null,
        primary_diagnosis: metrics.primaryDiagnoses.get(id) || null,
        orders_count: metrics.orderCounts.get(id) || 0,
        lab_results_count: metrics.labCounts.get(id) || 0,
        imaging_reports_count: metrics.imagingCounts.get(id) || 0,
        prescriptions_count: metrics.prescriptionCounts.get(id) || 0,
        notes_count: metrics.noteCounts.get(id) || 0,
        documents_count: metrics.documentCounts.get(id) || 0,
        has_critical_lab: metrics.criticalLab.has(id),
        has_critical_imaging: metrics.criticalImaging.has(id),
        has_unfinalized_record: metrics.unfinalizedRecord.has(id),
        allowed_actions: buildEncounterAllowedActions(encounter, actor),
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

function buildEncounterAllowedActions(encounter = {}, actor = {}) {
  const isOpen = OPEN_ENCOUNTER_STATUSES.includes(encounter.status);
  return {
    can_open: hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_ASSIGNED]),
    can_hold: isOpen && hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS, PERMISSION.ENCOUNTERS.UPDATE]),
    can_resume: encounter.status === ENCOUNTER_STATUS.ON_HOLD && hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS, PERMISSION.ENCOUNTERS.UPDATE]),
    can_record_vitals: isOpen && hasPermission(actor, PERMISSION.VITAL_SIGNS.CREATE),
    can_create_note: isOpen && hasAnyPermission(actor, [PERMISSION.CLINICAL_NOTES.CREATE_NURSING, PERMISSION.CLINICAL_NOTES.CREATE]),
    can_view_documents: hasAnyPermission(actor, [PERMISSION.MEDICAL_RECORDS.READ, PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT, PERMISSION.ATTACHMENTS.READ_DEPARTMENT]),
  };
}

async function getVitalHistory(patientId, query = {}, actor = {}) {
  await loadPatient(patientId, actor);
  if (!hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.VITAL_SIGNS.READ, PERMISSION.PATIENTS.READ, PERMISSION.ENCOUNTERS.READ])) {
    throw createError('Bạn không có quyền xem lịch sử sinh hiệu.', 403);
  }
  const { page, limit, skip } = getPagination(query, 25, 200);
  const filter = { patient_id: toObjectId(patientId, 'patientId') };
  if (query.encounter_id) filter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  if (query.recorded_by) filter.recorded_by = toObjectId(query.recorded_by, 'recorded_by');
  if (query.status && query.status !== 'all') filter.status = query.status;
  if (!parseBool(query.include_entered_in_error)) filter.status = filter.status || { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR };
  if (query.metric) filter[query.metric] = { $ne: null };
  if (parseBool(query.abnormal_only)) {
    filter.$or = [{ severity: { $ne: 'normal' } }, { overall_severity: { $ne: 'normal' } }];
  }
  if (query.date_from || query.date_to) {
    filter.recorded_at = {};
    const from = parseDate(query.date_from, 'date_from');
    const to = parseDate(query.date_to, 'date_to');
    if (from) filter.recorded_at.$gte = from;
    if (to) filter.recorded_at.$lte = to;
  }

  const [items, total, latest, abnormalCount, amendedCount, enteredErrorCount] = await Promise.all([
    VitalSign.find(filter)
      .sort({ recorded_at: query.sort === 'asc' ? 1 : -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('recorded_by', 'full_name employee_code')
      .populate({
        path: 'encounter_id',
        select: 'encounter_code encounter_type status start_time department_id attending_doctor_id',
        populate: [
          { path: 'department_id', select: 'department_code department_name' },
          { path: 'attending_doctor_id', select: 'full_name employee_code' },
        ],
      })
      .lean(),
    VitalSign.countDocuments(filter),
    VitalSign.findOne({ patient_id: toObjectId(patientId, 'patientId'), status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR } })
      .sort({ recorded_at: -1, created_at: -1 })
      .populate('recorded_by', 'full_name employee_code')
      .populate('encounter_id', 'encounter_code encounter_type status start_time')
      .lean(),
    VitalSign.countDocuments({ ...filter, overall_severity: { $ne: 'normal' } }),
    VitalSign.countDocuments({ ...filter, status: VITAL_SIGN_STATUS.AMENDED }),
    VitalSign.countDocuments({ ...filter, status: VITAL_SIGN_STATUS.ENTERED_IN_ERROR }),
  ]);

  return {
    patient_id: normalizeId(patientId),
    latest: vitalDto(latest),
    summary: {
      total_records: total,
      abnormal_count: abnormalCount,
      amended_count: amendedCount,
      entered_in_error_count: enteredErrorCount,
      latest_recorded_at: latest?.recorded_at || null,
    },
    items: items.map((item) => ({
      vital_sign: vitalDto(item),
      encounter: encounterDto(item.encounter_id),
      recorded_by: userDto(item.recorded_by),
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getClinicalRisks(patientId, actor = {}) {
  await loadPatient(patientId, actor);
  const { active_allergies: allergies, active_problems: problems } = await loadClinicalRisks(patientId);
  const severeAllergies = allergies.filter((item) => SEVERE_ALLERGY_SEVERITIES.includes(item.severity));
  const severeProblems = problems.filter((item) => SEVERE_PROBLEM_SEVERITIES.includes(item.severity));
  const medicationAllergies = allergies.filter((item) => item.allergy_type === 'medication');
  const contrastAllergies = allergies.filter((item) => item.allergy_type === 'contrast');

  return {
    patient_id: normalizeId(patientId),
    active_allergies: allergies,
    active_problems: problems,
    severe_allergies: severeAllergies,
    severe_problems: severeProblems,
    medication_allergies: medicationAllergies,
    contrast_allergies: contrastAllergies,
    risk_summary: {
      allergy_count: allergies.length,
      severe_allergy_count: severeAllergies.length,
      problem_count: problems.length,
      severe_problem_count: severeProblems.length,
      has_contrast_allergy: contrastAllergies.length > 0,
      has_medication_allergy: medicationAllergies.length > 0,
      needs_doctor_alert: severeAllergies.length > 0 || severeProblems.length > 0,
    },
    allowed_actions: buildAllowedActions(actor),
  };
}

async function getDocumentCenter(patientId, query = {}, actor = {}) {
  await loadPatient(patientId, actor);
  if (!buildAllowedActions(actor).can_view_documents) throw createError('Bạn không có quyền xem tài liệu lâm sàng.', 403);
  const patientObjectId = toObjectId(patientId, 'patientId');
  const { page, limit, skip } = getPagination(query, 20, 100);
  const recordFilter = { patient_id: patientObjectId };
  const attachmentFilter = { patient_id: patientObjectId, status: { $ne: ATTACHMENT_STATUS.DELETED } };
  if (query.record_type) recordFilter.record_type = query.record_type;
  if (query.record_status) recordFilter.status = query.record_status;
  if (query.encounter_id) {
    recordFilter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
    attachmentFilter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  }
  if (query.category) attachmentFilter.category = query.category;
  if (query.source) attachmentFilter.source = query.source;
  if (query.review_status) attachmentFilter.review_status = query.review_status;
  if (query.scan_status) attachmentFilter.scan_status = query.scan_status;
  if (query.visibility) attachmentFilter.visibility = query.visibility;
  if (query.released_to_patient !== undefined) {
    const released = parseBool(query.released_to_patient);
    recordFilter.released_to_patient = released;
    attachmentFilter.released_to_patient = released;
  }

  const [counters, records, recordTotal, attachments, attachmentTotal, timeline] = await Promise.all([
    loadDocumentCounters(patientObjectId),
    MedicalRecord.find(recordFilter)
      .sort({ opened_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('encounter_id', 'encounter_code encounter_type status start_time')
      .populate('custodian_department_id', 'department_code department_name')
      .lean(),
    MedicalRecord.countDocuments(recordFilter),
    Attachment.find(attachmentFilter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploaded_by', 'full_name employee_code')
      .lean(),
    Attachment.countDocuments(attachmentFilter),
    buildRecentPatientTimeline(patientObjectId, { limit: 40 }),
  ]);

  return {
    patient_id: normalizeId(patientId),
    counters,
    records,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      can_preview: canPreviewAttachment(attachment),
      preview_blocked_reason: previewBlockedReason(attachment),
    })),
    timeline,
    allowed_actions: buildAllowedActions(actor),
    pagination: {
      records: buildPagination(page, limit, recordTotal),
      attachments: buildPagination(page, limit, attachmentTotal),
    },
  };
}

function canPreviewAttachment(attachment = {}) {
  if (!['clean', 'skipped'].includes(attachment.scan_status)) return false;
  return Boolean(
    attachment.preview_url
      || attachment.thumbnail_url
      || String(attachment.mime_type || '').startsWith('image/')
      || attachment.mime_type === 'application/pdf',
  );
}

function previewBlockedReason(attachment = {}) {
  if (['failed', 'infected'].includes(attachment.scan_status)) return 'scan_failed';
  if (attachment.scan_status === 'pending') return 'scan_pending';
  if (!canPreviewAttachment(attachment)) return 'unsupported_mime_type';
  return null;
}

async function getEncounterSnapshot(encounterId, actor = {}) {
  if (!hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_ASSIGNED])) {
    throw createError('Bạn không có quyền xem encounter snapshot.', 403);
  }
  const encounter = await Encounter.findById(toObjectId(encounterId, 'encounterId'))
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone status')
    .populate('department_id', 'department_code department_name')
    .populate('attending_doctor_id', 'full_name employee_code')
    .populate('assigned_nurse_id', 'full_name employee_code')
    .lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  const [
    diagnoses,
    latestVitals,
    notes,
    allergies,
    problems,
    ordersSummary,
    labSummary,
    imagingSummary,
    prescriptionSummary,
    medicalRecord,
    documentCount,
    timeline,
  ] = await Promise.all([
    Diagnosis.find({ encounter_id: encounter._id, status: { $ne: 'entered_in_error' } }).sort({ is_primary: -1, created_at: -1 }).lean(),
    VitalSign.findOne({ encounter_id: encounter._id, status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR } }).sort({ recorded_at: -1 }).populate('recorded_by', 'full_name employee_code').lean(),
    ClinicalNote.find({ encounter_id: encounter._id, status: { $ne: CLINICAL_NOTE_STATUS.CANCELLED } }).sort({ created_at: -1 }).limit(5).populate('author_id', 'full_name employee_code').lean(),
    Allergy.find({ patient_id: encounter.patient_id?._id || encounter.patient_id, status: ALLERGY_STATUS.ACTIVE }).lean(),
    ProblemList.find({ patient_id: encounter.patient_id?._id || encounter.patient_id, status: PROBLEM_STATUS.ACTIVE }).lean(),
    summarizeOrders(encounter._id),
    summarizeLab(encounter._id),
    summarizeImaging(encounter._id),
    summarizePrescriptions(encounter._id),
    MedicalRecord.findOne({ encounter_id: encounter._id }).sort({ opened_at: -1, created_at: -1 }).lean(),
    Attachment.countDocuments({ encounter_id: encounter._id, status: { $ne: ATTACHMENT_STATUS.DELETED } }),
    buildEncounterTimeline(encounter._id),
  ]);

  const criticalLab = labSummary.critical_count > 0;
  const criticalImaging = imagingSummary.critical_count > 0;
  const vital = vitalDto(latestVitals);
  return {
    encounter: {
      ...encounterDto(encounter),
      patient: patientDto(encounter.patient_id || {}, actor),
    },
    clinical_summary: {
      primary_diagnosis: diagnoses.find((item) => item.is_primary) || diagnoses[0] || null,
      diagnoses,
      latest_vital_signs: vital,
      latest_notes: notes,
      active_allergies: sortBySeverity(allergies),
      active_problems: sortBySeverity(problems),
    },
    orders_summary: ordersSummary,
    lab_summary: labSummary,
    imaging_summary: imagingSummary,
    prescription_summary: prescriptionSummary,
    medical_record: medicalRecord,
    document_count: documentCount + (medicalRecord ? 1 : 0),
    timeline,
    risk_flags: {
      has_abnormal_latest_vitals: Boolean(vital && vital.severity !== 'normal'),
      has_critical_lab_result: criticalLab,
      has_critical_imaging_result: criticalImaging,
      has_severe_allergy: allergies.some((item) => SEVERE_ALLERGY_SEVERITIES.includes(item.severity)),
      has_unfinalized_record: Boolean(medicalRecord && ![MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED, MEDICAL_RECORD_STATUS.ARCHIVED].includes(medicalRecord.status)),
    },
    allowed_actions: buildEncounterAllowedActions(encounter, actor),
  };
}

async function summarizeOrders(encounterId) {
  const rows = await Order.aggregate([
    { $match: { encounter_id: toObjectId(encounterId, 'encounter_id') } },
    { $group: { _id: { status: '$status', order_type: '$order_type' }, count: { $sum: 1 } } },
  ]);
  return rows.reduce((summary, row) => {
    summary.total += row.count;
    summary.by_status[row._id.status] = (summary.by_status[row._id.status] || 0) + row.count;
    summary.by_type[row._id.order_type] = (summary.by_type[row._id.order_type] || 0) + row.count;
    return summary;
  }, { total: 0, by_status: {}, by_type: {} });
}

async function summarizeLab(encounterId) {
  const encounterObjectId = toObjectId(encounterId, 'encounter_id');
  const labOrders = await LabOrder.find({ encounter_id: encounterObjectId }).select('_id status priority test_name').lean();
  const criticalCount = labOrders.length
    ? await LabResult.countDocuments({ lab_order_id: { $in: labOrders.map((item) => item._id) }, is_critical: true })
    : 0;
  return {
    total_lab_orders: labOrders.length,
    critical_count: criticalCount,
    by_status: labOrders.reduce((map, item) => ({ ...map, [item.status]: (map[item.status] || 0) + 1 }), {}),
  };
}

async function summarizeImaging(encounterId) {
  const encounterObjectId = toObjectId(encounterId, 'encounter_id');
  const orders = await ImagingOrder.find({ encounter_id: encounterObjectId }).select('_id status modality body_part').lean();
  const criticalCount = orders.length
    ? await ImagingReport.countDocuments({ imaging_order_id: { $in: orders.map((item) => item._id) }, is_critical: true })
    : 0;
  return {
    total_imaging_orders: orders.length,
    critical_count: criticalCount,
    by_status: orders.reduce((map, item) => ({ ...map, [item.status]: (map[item.status] || 0) + 1 }), {}),
  };
}

async function summarizePrescriptions(encounterId) {
  const rows = await Prescription.aggregate([
    { $match: { encounter_id: toObjectId(encounterId, 'encounter_id') } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  return {
    total_prescriptions: rows.reduce((sum, row) => sum + row.count, 0),
    active_count: rows.filter((row) => ACTIVE_PRESCRIPTION_STATUSES.includes(row._id)).reduce((sum, row) => sum + row.count, 0),
    by_status: rows.reduce((map, row) => ({ ...map, [row._id]: row.count }), {}),
  };
}

async function buildEncounterTimeline(encounterId) {
  const encounterObjectId = toObjectId(encounterId, 'encounter_id');
  const [vitals, diagnoses, notes, records] = await Promise.all([
    VitalSign.find({ encounter_id: encounterObjectId, status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR } }).sort({ recorded_at: -1 }).limit(8).lean(),
    Diagnosis.find({ encounter_id: encounterObjectId, status: { $ne: 'entered_in_error' } }).sort({ created_at: -1 }).limit(8).lean(),
    ClinicalNote.find({ encounter_id: encounterObjectId, status: { $ne: CLINICAL_NOTE_STATUS.CANCELLED } }).sort({ created_at: -1 }).limit(8).lean(),
    MedicalRecord.find({ encounter_id: encounterObjectId }).sort({ created_at: -1 }).limit(8).lean(),
  ]);
  return [
    ...vitals.map((item) => timelineEvent('vital_recorded', item.overall_severity || item.severity, 'Ghi sinh hiệu', vitalSummary(item), item.recorded_at, item._id)),
    ...diagnoses.map((item) => timelineEvent('diagnosis_added', item.status, item.diagnosis_name, item.icd10_code, item.created_at, item._id)),
    ...notes.map((item) => timelineEvent('clinical_note', item.status, item.title || item.note_type, item.content, item.created_at, item._id)),
    ...records.map((item) => timelineEvent('medical_record', item.status, item.title || item.record_no, item.summary, item.opened_at || item.created_at, item._id)),
  ].filter((item) => item.occurred_at).sort((left, right) => new Date(right.occurred_at) - new Date(left.occurred_at));
}

async function checkDuplicateAllergy(patientId, payload = {}, actor = {}) {
  await loadPatient(patientId, actor);
  const allergen = normalizeString(payload.allergen);
  if (!allergen) throw createError('allergen là bắt buộc.', 422);
  const allergyType = normalizeString(payload.allergy_type || 'unknown') || 'unknown';
  const matches = await Allergy.find({
    patient_id: toObjectId(patientId, 'patientId'),
    status: ALLERGY_STATUS.ACTIVE,
    allergen: { $regex: `^${escapeRegex(allergen)}$`, $options: 'i' },
    allergy_type: allergyType,
  }).lean();
  return {
    duplicate: matches.length > 0,
    matches,
    recommended_action: matches.length > 0 ? 'review_existing_or_override_with_reason' : 'create',
  };
}

async function checkDuplicateProblem(patientId, payload = {}, actor = {}) {
  await loadPatient(patientId, actor);
  const problemName = normalizeString(payload.problem_name);
  const icd10Code = normalizeString(payload.icd10_code).toUpperCase();
  if (!problemName && !icd10Code) throw createError('problem_name hoặc icd10_code là bắt buộc.', 422);
  const or = [];
  if (icd10Code) or.push({ icd10_code: icd10Code });
  if (problemName) or.push({ problem_name: { $regex: `^${escapeRegex(problemName)}$`, $options: 'i' } });
  const matches = await ProblemList.find({
    patient_id: toObjectId(patientId, 'patientId'),
    status: PROBLEM_STATUS.ACTIVE,
    $or: or,
  }).lean();
  return {
    duplicate: matches.length > 0,
    matches,
    recommended_action: matches.length > 0 ? 'review_existing_or_override_with_reason' : 'create',
  };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  getPatientSnapshot,
  getProfileCenter,
  getEncounterHistory,
  getVitalHistory,
  getClinicalRisks,
  getDocumentCenter,
  getEncounterSnapshot,
  checkDuplicateAllergy,
  checkDuplicateProblem,
};
