const { randomBytes } = require('crypto');
const {
  Admission,
  Allergy,
  Appointment,
  Attachment,
  CarePlan,
  Charge,
  Department,
  Diagnosis,
  Dispense,
  Encounter,
  ImagingOrder,
  ImagingReport,
  InsuranceClaim,
  InsurancePolicy,
  Invoice,
  LabOrder,
  LabResult,
  MedicalRecord,
  MedicationAdministration,
  MedicationMaster,
  Notification,
  Order,
  Patient,
  PatientAccount,
  PatientAuthorization,
  PatientIdentifier,
  PatientRelative,
  Payment,
  PaymentIntent,
  Prescription,
  PrescriptionItem,
  ProblemList,
  ProcedureOrder,
  QueueTicket,
  Specimen,
  User,
  DoctorProfile,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  ADMISSION_STATUS,
  ALLERGY_SEVERITIES,
  ALLERGY_STATUS,
  ALLERGY_STATUSES,
  ALLERGY_TYPES,
  AUTHORIZATION_STATUS,
  AUTHORIZATION_STATUSES,
  AUTHORIZATION_TYPE,
  AUTHORIZATION_TYPES,
  ENCOUNTER_STATUS,
  GENDER,
  GENDERS,
  IDENTIFIER_TYPE,
  IDENTIFIER_TYPES,
  INVOICE_STATUS,
  LAB_RESULT_STATUS,
  IMAGING_REPORT_STATUS,
  MEDICAL_RECORD_STATUS,
  PATIENT_ACCOUNT_STATUS,
  PATIENT_ACCOUNT_STATUSES,
  PATIENT_STATUS,
  PATIENT_STATUSES,
  PAYMENT_INTENT_STATUS,
  PAYMENT_STATUS,
  PRESCRIPTION_STATUS,
  PROBLEM_SEVERITIES,
  PROBLEM_STATUS,
  PROBLEM_STATUSES,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const passwordService = require('./auth/password.service');
const authSessionService = require('./auth/auth-session.service');
const permissionService = require('./permission.service');
const eventBus = require('../events/event-bus.service');
const { withOptionalTransaction } = require('../shared/utils/transaction');
const {
  buildPagination,
  createError,
  escapeRegex,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeHumanName,
  normalizeLower,
  normalizePhone,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const STAFF_BASIC_UPDATE_FIELDS = [
  'phone',
  'email',
  'address',
  'emergency_contact_name',
  'emergency_contact_phone',
];

const STAFF_STANDARD_UPDATE_FIELDS = [
  ...STAFF_BASIC_UPDATE_FIELDS,
  'full_name',
  'date_of_birth',
  'gender',
  'national_id',
  'insurance_number',
];

const PATIENT_IDENTITY_FIELDS = [
  'full_name',
  'date_of_birth',
  'national_id',
  'insurance_number',
];

const PATIENT_SELF_UPDATE_FIELDS = [
  'phone',
  'email',
  'address',
  'emergency_contact_name',
  'emergency_contact_phone',
];

const ACTIVE_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.PLANNED,
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const ACTIVE_ADMISSION_STATUSES = [
  ADMISSION_STATUS.PLANNED,
  ADMISSION_STATUS.ADMITTED,
  ADMISSION_STATUS.TRANSFERRED,
];

const OPEN_INVOICE_STATUSES = [
  INVOICE_STATUS.DRAFT,
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
];

const MERGE_PATIENT_ID_MODELS = [
  ['patient_relatives', PatientRelative],
  ['patient_authorizations', PatientAuthorization],
  ['appointments', Appointment],
  ['queue_tickets', QueueTicket],
  ['encounters', Encounter],
  ['problem_list', ProblemList],
  ['allergies', Allergy],
  ['orders', Order],
  ['lab_orders', LabOrder],
  ['specimens', Specimen],
  ['lab_results', LabResult],
  ['imaging_orders', ImagingOrder],
  ['imaging_reports', ImagingReport],
  ['procedure_orders', ProcedureOrder],
  ['prescriptions', Prescription],
  ['dispenses', Dispense],
  ['medication_administrations', MedicationAdministration],
  ['admissions', Admission],
  ['care_plans', CarePlan],
  ['charges', Charge],
  ['invoices', Invoice],
  ['payments', Payment],
  ['insurance_policies', InsurancePolicy],
  ['insurance_claims', InsuranceClaim],
  ['medical_records', MedicalRecord],
  ['attachments', Attachment],
  ['notifications', Notification],
];

function hasOwn(payload, field) {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

function compactObject(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || undefined;
}

function normalizeIdentifierRaw(value) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.replace(/\s+/g, '') : undefined;
}

function normalizeInsuranceNumber(value) {
  const normalized = normalizeIdentifierRaw(value);
  return normalized ? normalized.toUpperCase() : undefined;
}

function normalizePhoneStrict(value) {
  const normalized = normalizePhone(value);
  return normalized ? normalized.replace(/[.-]+/g, '') : undefined;
}

function normalizeDateValue(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError(`${fieldName} không hợp lệ.`, 422);
  }
  return date;
}

function assertDateNotFuture(date, fieldName) {
  if (date && date > new Date()) {
    throw createError(`${fieldName} không được ở tương lai.`, 422);
  }
}

function validateEmail(email) {
  if (!email) return true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError('email không hợp lệ.', 422);
  }
  return true;
}

function validatePhone(phone) {
  if (!phone) return true;
  if (!/^\+?[0-9]{7,15}$/.test(phone)) {
    throw createError('phone không hợp lệ.', 422);
  }
  return true;
}

function normalizeGender(value, fallback) {
  const gender = normalizeOptionalString(value)?.toLowerCase();
  if (!gender) return fallback;
  if (!GENDERS.includes(gender)) {
    throw createError('gender không hợp lệ.', 422);
  }
  return gender;
}

function normalizePatientData(payload = {}, options = {}) {
  const normalized = {};

  if (hasOwn(payload, 'full_name')) {
    normalized.full_name = payload.full_name ? normalizeHumanName(payload.full_name) : undefined;
  }
  if (hasOwn(payload, 'email')) {
    normalized.email = normalizeLower(payload.email) || undefined;
  }
  if (hasOwn(payload, 'phone')) {
    normalized.phone = normalizePhoneStrict(payload.phone);
  }
  if (hasOwn(payload, 'national_id')) {
    normalized.national_id = normalizeIdentifierRaw(payload.national_id);
  }
  if (hasOwn(payload, 'insurance_number')) {
    normalized.insurance_number = normalizeInsuranceNumber(payload.insurance_number);
  }
  if (hasOwn(payload, 'address')) {
    normalized.address = normalizeOptionalString(payload.address);
  }
  if (hasOwn(payload, 'emergency_contact_name')) {
    normalized.emergency_contact_name = payload.emergency_contact_name
      ? normalizeHumanName(payload.emergency_contact_name)
      : undefined;
  }
  if (hasOwn(payload, 'emergency_contact_phone')) {
    normalized.emergency_contact_phone = normalizePhoneStrict(payload.emergency_contact_phone);
  }
  if (hasOwn(payload, 'gender')) {
    normalized.gender = normalizeGender(payload.gender);
  } else if (options.forCreate) {
    normalized.gender = GENDER.UNKNOWN;
  }
  if (hasOwn(payload, 'date_of_birth')) {
    normalized.date_of_birth = normalizeDateValue(payload.date_of_birth, 'date_of_birth');
    assertDateNotFuture(normalized.date_of_birth, 'date_of_birth');
  }

  validateEmail(normalized.email);
  validatePhone(normalized.phone);
  validatePhone(normalized.emergency_contact_phone);

  return compactObject(normalized);
}

function normalizeIdentifierValue(identifierType, identifierValue) {
  if (identifierType === IDENTIFIER_TYPE.INSURANCE_NO) {
    return normalizeInsuranceNumber(identifierValue);
  }
  return normalizeIdentifierRaw(identifierValue);
}

function normalizeRelativeData(payload = {}) {
  return compactObject({
    full_name: hasOwn(payload, 'full_name') ? normalizeHumanName(payload.full_name) : undefined,
    relationship: hasOwn(payload, 'relationship') ? normalizeOptionalString(payload.relationship) : undefined,
    phone: hasOwn(payload, 'phone') ? normalizePhoneStrict(payload.phone) : undefined,
    email: hasOwn(payload, 'email') ? normalizeLower(payload.email) || undefined : undefined,
    national_id: hasOwn(payload, 'national_id') ? normalizeIdentifierRaw(payload.national_id) : undefined,
    address: hasOwn(payload, 'address') ? normalizeOptionalString(payload.address) : undefined,
    is_emergency_contact: hasOwn(payload, 'is_emergency_contact') ? Boolean(payload.is_emergency_contact) : undefined,
    is_primary_contact: hasOwn(payload, 'is_primary_contact') ? Boolean(payload.is_primary_contact) : undefined,
    relationship_verified: hasOwn(payload, 'relationship_verified') ? Boolean(payload.relationship_verified) : undefined,
    status: hasOwn(payload, 'status') ? normalizeOptionalString(payload.status) : undefined,
  });
}

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function idsEqual(left, right) {
  return Boolean(left && right && toId(left) === toId(right));
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function isStaff(actor = {}) {
  return actor.actorType === 'staff' || actor.actor_type === 'staff';
}

function isPatientActor(actor = {}) {
  return actor.actorType === 'patient' || actor.actor_type === 'patient';
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes);
}

const RELATIVE_AUTHORIZATION_SCOPE_ALIASES = {
  [AUTHORIZATION_TYPE.VIEW_RECORDS]: [
    AUTHORIZATION_TYPE.VIEW_RECORDS,
    AUTHORIZATION_TYPE.RECORD_READ,
    AUTHORIZATION_TYPE.LAB_RESULT_READ,
    AUTHORIZATION_TYPE.IMAGING_REPORT_READ,
    AUTHORIZATION_TYPE.PRESCRIPTION_READ,
  ],
  [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]: [
    AUTHORIZATION_TYPE.BOOK_APPOINTMENTS,
    AUTHORIZATION_TYPE.APPOINTMENT_READ,
    AUTHORIZATION_TYPE.APPOINTMENT_MANAGE,
  ],
  [AUTHORIZATION_TYPE.BILLING]: [
    AUTHORIZATION_TYPE.BILLING,
    AUTHORIZATION_TYPE.BILLING_READ,
    AUTHORIZATION_TYPE.BILLING_PAY,
  ],
};

function expandAuthorizationScopes(scopeOrScopes = AUTHORIZATION_TYPE.VIEW_RECORDS) {
  const requested = Array.isArray(scopeOrScopes) ? scopeOrScopes : [scopeOrScopes];
  const scopes = new Set([AUTHORIZATION_TYPE.FULL_ACCESS]);
  requested
    .map(normalizeOptionalString)
    .filter(Boolean)
    .forEach((scope) => {
      scopes.add(scope);
      (RELATIVE_AUTHORIZATION_SCOPE_ALIASES[scope] || []).forEach((alias) => scopes.add(alias));
    });
  return [...scopes];
}

function hasFullPatientRead(actor = {}) {
  return !actor || hasPermission(actor, PERMISSION.PATIENTS.READ);
}

function hasPatientListAccess(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.READ_LIMITED,
    PERMISSION.PATIENTS.SEARCH,
  ]);
}

function canUseSensitivePatientSearchFilters(actor = {}) {
  if (!actor) return true;
  return hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.UPDATE_SENSITIVE,
    PERMISSION.PATIENT_IDENTIFIERS.READ,
    PERMISSION.PATIENTS.MERGE,
  ]);
}

function canViewSensitivePatientFields(actor = {}) {
  if (!actor) return true;
  if (isPatientActor(actor)) return true;
  return hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.UPDATE,
    PERMISSION.PATIENTS.UPDATE_SENSITIVE,
    PERMISSION.PATIENT_IDENTIFIERS.READ,
  ]);
}

function canViewDuplicateCandidateDetails(actor = {}) {
  if (!actor) return true;
  return hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.MERGE,
    PERMISSION.PATIENTS.UPDATE_SENSITIVE,
  ]);
}

function maskText(value, visibleStart = 0, visibleEnd = 2) {
  if (!value) return value;
  const text = String(value);
  if (text.length <= visibleStart + visibleEnd) return '*'.repeat(text.length);
  return `${text.slice(0, visibleStart)}${'*'.repeat(Math.max(text.length - visibleStart - visibleEnd, 3))}${text.slice(-visibleEnd)}`;
}

function maskPhone(value) {
  return maskText(value, 0, 3);
}

function maskEmail(value) {
  if (!value || !String(value).includes('@')) return value ? maskText(value, 1, 2) : value;
  const [local, domain] = String(value).split('@');
  return `${maskText(local, 1, 1)}@${domain}`;
}

function maskIdentifierValue(value) {
  return maskText(value, 0, 4);
}

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

async function createDocument(Model, payload, session = null) {
  const [created] = await Model.create([payload], sessionOptions(session));
  return created;
}

async function loadPatientOrThrow(patientId, session = null) {
  const patient = await withSession(Patient.findById(patientId), session);
  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }
  return patient;
}

async function isStaffAssignedToPatient(patientId, actor = {}) {
  if (!isStaff(actor) || !actor.userId) return false;
  const departmentId = actorDepartmentId(actor);
  const staffId = actor.userId;
  const staffFilters = [
    Appointment.exists({ patient_id: patientId, doctor_id: staffId, is_deleted: false }),
    QueueTicket.exists({ patient_id: patientId, doctor_id: staffId }),
    Encounter.exists({ patient_id: patientId, attending_doctor_id: staffId }),
    Admission.exists({ patient_id: patientId, attending_doctor_id: staffId }),
  ];

  if (departmentId && hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ_ASSIGNED,
    PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.ADMISSIONS.READ_DEPARTMENT,
  ])) {
    staffFilters.push(
      Appointment.exists({ patient_id: patientId, department_id: departmentId, is_deleted: false }),
      QueueTicket.exists({ patient_id: patientId, department_id: departmentId }),
      Encounter.exists({ patient_id: patientId, department_id: departmentId }),
      Admission.exists({ patient_id: patientId, department_id: departmentId }),
    );
  }

  const matches = await Promise.all(staffFilters);
  return matches.some(Boolean);
}

async function getAssignedPatientIds(actor = {}) {
  if (!isStaff(actor) || !actor.userId) return [];
  const staffId = actor.userId;
  const departmentId = actorDepartmentId(actor);
  const queries = [
    Appointment.distinct('patient_id', { doctor_id: staffId, is_deleted: false }),
    QueueTicket.distinct('patient_id', { doctor_id: staffId }),
    Encounter.distinct('patient_id', { attending_doctor_id: staffId }),
    Admission.distinct('patient_id', { attending_doctor_id: staffId }),
  ];

  if (departmentId && hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ_ASSIGNED,
    PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.ADMISSIONS.READ_DEPARTMENT,
  ])) {
    queries.push(
      Appointment.distinct('patient_id', { department_id: departmentId, is_deleted: false }),
      QueueTicket.distinct('patient_id', { department_id: departmentId }),
      Encounter.distinct('patient_id', { department_id: departmentId }),
      Admission.distinct('patient_id', { department_id: departmentId }),
    );
  }

  const ids = (await Promise.all(queries)).flat().map(toId).filter(Boolean);
  return [...new Set(ids)];
}

async function checkRelativeAuthorization(relativeId, patientId, authorizationType = AUTHORIZATION_TYPE.VIEW_RECORDS) {
  if (!relativeId || !patientId) return false;

  const now = new Date();
  const scopes = expandAuthorizationScopes(authorizationType);
  const authorization = await PatientAuthorization.findOne({
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
          { authorization_type: { $in: scopes } },
          { permissions: { $in: scopes } },
        ],
      },
    ],
  }).lean();

  return Boolean(authorization);
}

async function assertRelativeHasScope(relativeId, patientId, authorizationType = AUTHORIZATION_TYPE.VIEW_RECORDS) {
  if (await checkRelativeAuthorization(relativeId, patientId, authorizationType)) {
    return true;
  }
  throw createError('Người nhà chưa có ủy quyền phù hợp cho phạm vi truy cập này.', 403);
}

async function canReadPatient(patientId, actor = {}, options = {}) {
  if (!actor) return true;

  if (isPatientActor(actor)) {
    return idsEqual(actor.patientId || actor.patient_id, patientId);
  }

  if (actor.relativeId || actor.relative_id) {
    return checkRelativeAuthorization(
      actor.relativeId || actor.relative_id,
      patientId,
      options.authorizationType || AUTHORIZATION_TYPE.VIEW_RECORDS,
    );
  }

  if (hasAnyPermission(actor, options.fullReadPermissions || [PERMISSION.PATIENTS.READ])) {
    return true;
  }

  if (hasPermission(actor, PERMISSION.PATIENTS.READ_LIMITED) && options.allowLimited === true) {
    return true;
  }

  if (hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ_ASSIGNED,
    ...(options.assignedPermissions || []),
  ])) {
    return isStaffAssignedToPatient(patientId, actor);
  }

  return false;
}

async function assertCanReadPatient(patientId, actor = {}, options = {}) {
  if (await canReadPatient(patientId, actor, options)) {
    return true;
  }
  throw createError('Tài khoản hiện tại không có quyền xem hồ sơ bệnh nhân này.', 403);
}

function sanitizePatient(patient, actor = {}, options = {}) {
  const includeSensitive = options.includeSensitive ?? canViewSensitivePatientFields(actor);
  const includeInternal = options.includeInternal || false;

  const output = {
    patient_id: toId(patient._id || patient.id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    status: patient.status,
    created_at: patient.created_at,
    updated_at: patient.updated_at,
  };

  if (includeSensitive) {
    output.address = patient.address;
    output.national_id = patient.national_id;
    output.insurance_number = patient.insurance_number;
    output.identity_verified_at = patient.identity_verified_at;
    output.identity_verified_by = patient.identity_verified_by ? toId(patient.identity_verified_by) : null;
    output.emergency_contact_name = patient.emergency_contact_name;
    output.emergency_contact_phone = patient.emergency_contact_phone;
    output.merged_into_patient_id = patient.merged_into_patient_id ? toId(patient.merged_into_patient_id) : null;
    output.merged_at = patient.merged_at;
    output.archived_at = patient.archived_at;
  }

  if (includeInternal) {
    output.created_by = patient.created_by ? toId(patient.created_by) : null;
    output.updated_by = patient.updated_by ? toId(patient.updated_by) : null;
    output.is_deleted = patient.is_deleted;
    output.deleted_at = patient.deleted_at;
    output.deleted_by = patient.deleted_by ? toId(patient.deleted_by) : null;
  }

  return output;
}

function sanitizeIdentifier(identifier) {
  return {
    patient_identifier_id: toId(identifier._id),
    patient_id: toId(identifier.patient_id),
    identifier_type: identifier.identifier_type,
    identifier_value: identifier.identifier_value,
    issued_by: identifier.issued_by,
    valid_from: identifier.valid_from,
    valid_to: identifier.valid_to,
    is_primary: identifier.is_primary,
    created_at: identifier.created_at,
    updated_at: identifier.updated_at,
  };
}

function sanitizeAccount(account, options = {}) {
  if (!account) return null;
  const output = {
    patient_account_id: toId(account._id),
    patient_id: toId(account.patient_id),
    username: account.username,
    email: account.email,
    phone: account.phone,
    status: account.status,
    last_login_at: account.last_login_at,
    email_verified_at: account.email_verified_at,
    phone_verified_at: account.phone_verified_at,
  };
  if (options.temporaryPassword) {
    output.temporary_password = options.temporaryPassword;
  }
  return output;
}

function sanitizeRelative(relative) {
  return {
    patient_relative_id: toId(relative._id),
    patient_id: toId(relative.patient_id),
    full_name: relative.full_name,
    relationship: relative.relationship,
    phone: relative.phone,
    email: relative.email,
    national_id: relative.national_id,
    address: relative.address,
    is_emergency_contact: relative.is_emergency_contact,
    is_primary_contact: relative.is_primary_contact,
    relationship_verified: Boolean(relative.relationship_verified),
    verified_by: relative.verified_by ? toId(relative.verified_by) : null,
    verified_at: relative.verified_at,
    status: relative.status,
    created_at: relative.created_at,
    updated_at: relative.updated_at,
  };
}

function sanitizeAuthorization(authorization) {
  return {
    patient_authorization_id: toId(authorization._id),
    patient_id: toId(authorization.patient_id),
    relative_id: toId(authorization.relative_id),
    authorization_type: authorization.authorization_type,
    permissions: authorization.permissions || [],
    valid_from: authorization.valid_from,
    valid_to: authorization.valid_to,
    approved_by: authorization.approved_by ? toId(authorization.approved_by) : null,
    approved_at: authorization.approved_at,
    revoked_by: authorization.revoked_by ? toId(authorization.revoked_by) : null,
    revoked_at: authorization.revoked_at,
    revoke_reason: authorization.revoke_reason,
    status: authorization.status,
    created_at: authorization.created_at,
    updated_at: authorization.updated_at,
  };
}

function stripDiacritics(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(left = '', right = '') {
  const a = stripDiacritics(left);
  const b = stripDiacritics(right);
  if (!a || !b) return Math.max(a.length, b.length);
  const matrix = Array.from({ length: a.length + 1 }, (_, row) => [row]);
  for (let col = 1; col <= b.length; col += 1) matrix[0][col] = col;
  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function isFuzzyNameMatch(left, right) {
  const a = stripDiacritics(left);
  const b = stripDiacritics(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const maxLength = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);
  return 1 - distance / maxLength >= 0.82;
}

function dateKey(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function scoreDuplicateCandidate(patient, normalized, identifierMap = new Map()) {
  const matchedFields = [];
  let score = 0;
  const identifiers = identifierMap.get(toId(patient._id)) || [];

  const hasIdentifierMatch = (type, value) => (
    value && identifiers.some((item) => item.identifier_type === type && item.identifier_value === value)
  );

  if (
    normalized.national_id &&
    (patient.national_id === normalized.national_id ||
      hasIdentifierMatch(IDENTIFIER_TYPE.NATIONAL_ID, normalized.national_id))
  ) {
    score += 80;
    matchedFields.push('national_id');
  }

  if (
    normalized.insurance_number &&
    (patient.insurance_number === normalized.insurance_number ||
      hasIdentifierMatch(IDENTIFIER_TYPE.INSURANCE_NO, normalized.insurance_number))
  ) {
    score += 70;
    matchedFields.push('insurance_number');
  }

  if (normalized.phone && patient.phone === normalized.phone) {
    score += 30;
    matchedFields.push('phone');
  }

  if (normalized.email && patient.email === normalized.email) {
    score += 20;
    matchedFields.push('email');
  }

  if (dateKey(normalized.date_of_birth) && dateKey(patient.date_of_birth) === dateKey(normalized.date_of_birth)) {
    score += 30;
    matchedFields.push('date_of_birth');
  }

  if (normalized.full_name && patient.full_name === normalized.full_name) {
    score += 40;
    matchedFields.push('full_name');
  } else if (normalized.full_name && isFuzzyNameMatch(patient.full_name, normalized.full_name)) {
    score += 20;
    matchedFields.push('full_name_fuzzy');
  }

  if (normalized.gender && patient.gender === normalized.gender) {
    score += 10;
    matchedFields.push('gender');
  }

  const level = score >= 80 ? 'high_confidence' : score >= 50 ? 'possible_duplicate' : 'low';
  return { score, matched_fields: matchedFields, level };
}

async function detectDuplicatePatients(payload = {}, actor = null) {
  const normalized = normalizePatientData(payload);
  const includeSensitive = canViewDuplicateCandidateDetails(actor);
  const clauses = [];

  if (normalized.national_id) clauses.push({ national_id: normalized.national_id });
  if (normalized.insurance_number) clauses.push({ insurance_number: normalized.insurance_number });
  if (normalized.email) clauses.push({ email: normalized.email });
  if (normalized.phone && normalized.date_of_birth) {
    clauses.push({ phone: normalized.phone, date_of_birth: normalized.date_of_birth });
  } else if (normalized.phone) {
    clauses.push({ phone: normalized.phone });
  }
  if (normalized.full_name && normalized.date_of_birth) {
    clauses.push({
      full_name: normalized.full_name,
      date_of_birth: normalized.date_of_birth,
      ...(normalized.gender ? { gender: normalized.gender } : {}),
    });
  }
  if (normalized.date_of_birth && normalized.gender) {
    clauses.push({
      date_of_birth: normalized.date_of_birth,
      gender: normalized.gender,
    });
  }

  const identifierClauses = [];
  if (normalized.national_id) {
    identifierClauses.push({
      identifier_type: IDENTIFIER_TYPE.NATIONAL_ID,
      identifier_value: normalized.national_id,
    });
  }
  if (normalized.insurance_number) {
    identifierClauses.push({
      identifier_type: IDENTIFIER_TYPE.INSURANCE_NO,
      identifier_value: normalized.insurance_number,
    });
  }
  if (payload.identifier_type && payload.identifier_value) {
    identifierClauses.push({
      identifier_type: payload.identifier_type,
      identifier_value: normalizeIdentifierValue(payload.identifier_type, payload.identifier_value),
    });
  }

  const candidateMap = new Map();
  if (clauses.length > 0) {
    const patients = await Patient.find({
      is_deleted: false,
      $or: clauses,
    })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();
    patients.forEach((patient) => candidateMap.set(toId(patient._id), patient));
  }

  if (identifierClauses.length > 0) {
    const identifiers = await PatientIdentifier.find({
      is_deleted: false,
      $or: identifierClauses,
    }).lean();
    const patientIds = [...new Set(identifiers.map((item) => toId(item.patient_id)))];
    if (patientIds.length > 0) {
      const patients = await Patient.find({ _id: { $in: patientIds }, is_deleted: false }).lean();
      patients.forEach((patient) => candidateMap.set(toId(patient._id), patient));
    }
  }

  const candidateIds = [...candidateMap.keys()];
  const candidateIdentifiers = candidateIds.length
    ? await PatientIdentifier.find({ patient_id: { $in: candidateIds }, is_deleted: false }).lean()
    : [];
  const identifierMap = candidateIdentifiers.reduce((map, identifier) => {
    const key = toId(identifier.patient_id);
    const bucket = map.get(key) || [];
    bucket.push(identifier);
    map.set(key, bucket);
    return map;
  }, new Map());

  const candidates = [...candidateMap.values()]
    .map((patient) => {
      const score = scoreDuplicateCandidate(patient, normalized, identifierMap);
      const candidate = {
        patient_id: toId(patient._id),
        patient_code: patient.patient_code,
        full_name: patient.full_name,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        phone: includeSensitive ? patient.phone : maskPhone(patient.phone),
        email: includeSensitive ? patient.email : maskEmail(patient.email),
        status: patient.status,
        score: score.score,
        matched_fields: score.matched_fields,
        level: score.level,
      };
      if (includeSensitive) {
        candidate.national_id = patient.national_id;
        candidate.insurance_number = patient.insurance_number;
      }
      return candidate;
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return {
    has_duplicates: candidates.length > 0,
    candidates,
    items: candidates,
  };
}

async function assertPatientIdentityUnique(normalized = {}, excludePatientId = null, session = null) {
  const patientOr = [];
  if (normalized.national_id) patientOr.push({ national_id: normalized.national_id });
  if (normalized.insurance_number) patientOr.push({ insurance_number: normalized.insurance_number });

  if (patientOr.length > 0) {
    const filter = { is_deleted: false, $or: patientOr };
    if (excludePatientId) filter._id = { $ne: excludePatientId };
    const existing = await withSession(Patient.findOne(filter), session).lean();
    if (existing) {
      throw createError('Số giấy tờ hoặc số bảo hiểm đã thuộc hồ sơ bệnh nhân khác.', 409);
    }
  }

  const identifierOr = [];
  if (normalized.national_id) {
    identifierOr.push({
      identifier_type: IDENTIFIER_TYPE.NATIONAL_ID,
      identifier_value: normalized.national_id,
    });
  }
  if (normalized.insurance_number) {
    identifierOr.push({
      identifier_type: IDENTIFIER_TYPE.INSURANCE_NO,
      identifier_value: normalized.insurance_number,
    });
  }

  if (identifierOr.length > 0) {
    const filter = {
      is_deleted: false,
      $or: identifierOr,
    };
    if (excludePatientId) filter.patient_id = { $ne: excludePatientId };
    const existing = await withSession(PatientIdentifier.findOne(filter), session).lean();
    if (existing) {
      throw createError('Định danh bệnh nhân đã tồn tại trong hệ thống.', 409);
    }
  }
}

async function validatePatientBeforeCreate(payload = {}, actor = null) {
  if (actor && isStaff(actor) && !hasPermission(actor, PERMISSION.PATIENTS.CREATE)) {
    throw createError('Tài khoản hiện tại không có quyền tạo bệnh nhân.', 403);
  }

  const normalized = normalizePatientData(payload, { forCreate: true });
  if (!normalized.full_name) {
    throw createError('full_name là bắt buộc.', 422);
  }
  if (normalized.date_of_birth) {
    assertDateNotFuture(normalized.date_of_birth, 'date_of_birth');
  }

  await assertPatientIdentityUnique(normalized);
  const duplicates = await detectDuplicatePatients(normalized);
  const highConfidence = duplicates.candidates.filter((item) => item.level === 'high_confidence');
  const possible = duplicates.candidates.filter((item) => item.level === 'possible_duplicate');

  if (highConfidence.length > 0 && payload.force_create !== true) {
    throw createError('Phát hiện hồ sơ bệnh nhân trùng định danh mạnh. Cần kiểm tra/merge thay vì tạo mới.', 409);
  }

  if (possible.length > 0 && payload.confirm_duplicate_checked !== true && payload.force_create !== true) {
    throw createError('Phát hiện hồ sơ bệnh nhân có thể bị trùng. Vui lòng xác nhận đã kiểm tra trùng.', 409);
  }

  return {
    normalized,
    duplicate_warning: duplicates,
  };
}

function lockVerifiedIdentityFields(patient = {}, changes = {}, actor = {}) {
  if (!patient.identity_verified_at) return true;
  const lockedFields = PATIENT_IDENTITY_FIELDS.filter((field) => hasOwn(changes, field));
  if (lockedFields.length === 0) return true;
  if (actor?.allowVerifiedIdentityOverride === true) return true;
  throw createError('Hồ sơ đã xác minh định danh; không được sửa trực tiếp thông tin định danh. Hãy tạo yêu cầu thay đổi và duyệt theo quy trình.', 409);
}

async function validatePatientIdentifierUnique(identifierType, identifierValue, excludeId = null, session = null) {
  if (!IDENTIFIER_TYPES.includes(identifierType)) {
    throw createError('Loại định danh không hợp lệ.', 422);
  }

  const normalizedValue = normalizeIdentifierValue(identifierType, identifierValue);
  if (!normalizedValue) {
    throw createError('identifier_value là bắt buộc.', 422);
  }

  const filter = {
    identifier_type: identifierType,
    identifier_value: normalizedValue,
    is_deleted: false,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await withSession(PatientIdentifier.findOne(filter), session).lean();
  if (existing) {
    throw createError('Định danh đã tồn tại trong hệ thống.', 409);
  }

  return true;
}

async function syncPatientIdentifier(patientId, identifierType, identifierValue, actor, session = null) {
  const normalizedValue = normalizeIdentifierValue(identifierType, identifierValue);
  if (!normalizedValue) return null;

  const existing = await withSession(PatientIdentifier.findOne({
    patient_id: patientId,
    identifier_type: identifierType,
    is_deleted: false,
  }), session);

  if (existing) {
    if (existing.identifier_value !== normalizedValue) {
      await validatePatientIdentifierUnique(identifierType, normalizedValue, existing._id, session);
      existing.identifier_value = normalizedValue;
      existing.updated_by = actor?.userId;
      await existing.save(sessionOptions(session));
    }
    return existing;
  }

  await validatePatientIdentifierUnique(identifierType, normalizedValue, null, session);
  return createDocument(PatientIdentifier, {
    patient_id: patientId,
    identifier_type: identifierType,
    identifier_value: normalizedValue,
    is_primary: false,
    created_by: actor?.userId,
    updated_by: actor?.userId,
  }, session);
}

function generateTemporaryPassword() {
  return `Pt${randomBytes(6).toString('hex')}9`;
}

async function assertPatientAccountUnique({ username, email, phone }, excludeAccountId = null, session = null) {
  const or = [
    username ? { username } : null,
    email ? { email } : null,
    phone ? { phone } : null,
  ].filter(Boolean);
  if (or.length === 0) return true;

  const filter = { is_deleted: false, $or: or };
  if (excludeAccountId) filter._id = { $ne: excludeAccountId };
  const existing = await withSession(PatientAccount.findOne(filter), session).lean();
  if (existing) {
    throw createError('Email, số điện thoại hoặc username tài khoản bệnh nhân đã được sử dụng.', 409);
  }
  return true;
}

async function createPatientAccountForPatient(patientId, payload = {}, actor = {}, requestMeta = {}, session = null) {
  const patient = await loadPatientOrThrow(patientId, session);
  const existing = await withSession(PatientAccount.findOne({
    patient_id: patient._id,
    is_deleted: false,
  }), session).lean();
  if (existing) {
    throw createError('Bệnh nhân đã có tài khoản portal.', 409);
  }

  const email = hasOwn(payload, 'email') ? normalizeLower(payload.email) || undefined : patient.email;
  const phone = hasOwn(payload, 'phone') ? normalizePhoneStrict(payload.phone) : patient.phone;
  const username = normalizeLower(payload.username) || email || phone || patient.patient_code?.toLowerCase();
  const temporaryPassword = payload.password || payload.temporary_password || generateTemporaryPassword();

  validateEmail(email);
  validatePhone(phone);
  if (!username) {
    throw createError('Cần username, email hoặc phone để tạo tài khoản bệnh nhân.', 422);
  }

  await assertPatientAccountUnique({ username, email, phone }, null, session);
  passwordService.validatePasswordPolicy({
    password: temporaryPassword,
    username,
    email,
    phone,
    actorType: 'patient',
  });

  const account = await createDocument(PatientAccount, {
    patient_id: patient._id,
    username,
    email,
    phone,
    password_hash: await passwordService.hashPassword(temporaryPassword),
    status: payload.status || PATIENT_ACCOUNT_STATUS.PENDING_VERIFICATION,
    password_changed_at: payload.password || payload.temporary_password ? new Date() : undefined,
    created_by: actor?.userId,
    updated_by: actor?.userId,
  }, session);

  if (!session) {
    await recordAuditLog({
      actor,
      action: 'patient.account.create',
      targetType: 'patient_account',
      targetId: account._id,
      status: 'success',
      message: 'Tạo tài khoản portal cho bệnh nhân thành công.',
      requestMeta,
    });
  }

  return {
    account,
    temporary_password: temporaryPassword,
  };
}

async function createPatient(payload, actor = {}, requestMeta = {}) {
  const validation = await validatePatientBeforeCreate(payload, actor);
  let createdAccountPassword = null;
  let patientId = null;

  await withOptionalTransaction(async (session) => {
    const patientCode = payload.patient_code || await generateBusinessCode(CODE_TYPE.PATIENT, { session });
    const patient = await createDocument(Patient, {
      patient_code: patientCode,
      ...validation.normalized,
      status: payload.status || PATIENT_STATUS.ACTIVE,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }, session);
    patientId = patient._id;

    if (validation.normalized.national_id) {
      await syncPatientIdentifier(patient._id, IDENTIFIER_TYPE.NATIONAL_ID, validation.normalized.national_id, actor, session);
    }
    if (validation.normalized.insurance_number) {
      await syncPatientIdentifier(patient._id, IDENTIFIER_TYPE.INSURANCE_NO, validation.normalized.insurance_number, actor, session);
    }

    const relatives = Array.isArray(payload.relatives)
      ? payload.relatives
      : payload.relative
        ? [payload.relative]
        : [];
    for (const relativePayload of relatives) {
      await createPatientRelativeInternal(patient._id, relativePayload, actor, session);
    }

    if (payload.create_account) {
      const accountResult = await createPatientAccountForPatient(
        patient._id,
        payload.account || payload,
        actor,
        requestMeta,
        session,
      );
      createdAccountPassword = accountResult.temporary_password;
    }

    await recordAuditLog({
      actor,
      action: 'patient.create',
      targetType: 'patient',
      targetId: patient._id,
      status: 'success',
      message: 'Tạo hồ sơ bệnh nhân thành công.',
      requestMeta,
      after: patient.toObject(),
    });
  }, { fallbackToNoTransaction: true });

  const detail = await getPatientDetail(patientId, actor);
  if (detail.account && createdAccountPassword) {
    detail.account.temporary_password = createdAccountPassword;
  }
  detail.duplicate_warning = validation.duplicate_warning;
  return detail;
}

function buildPatientKeywordFilter(keyword, actor = {}) {
  const normalized = normalizeOptionalString(keyword);
  if (!normalized) return null;
  const pattern = escapeRegex(normalized);
  const fields = [
    { patient_code: { $regex: pattern, $options: 'i' } },
    { full_name: { $regex: pattern, $options: 'i' } },
  ];
  if (canUseSensitivePatientSearchFilters(actor)) {
    fields.push(
      { phone: { $regex: pattern, $options: 'i' } },
      { email: { $regex: pattern, $options: 'i' } },
      { national_id: { $regex: pattern, $options: 'i' } },
      { insurance_number: { $regex: pattern, $options: 'i' } },
    );
  }
  return fields;
}

async function applyPatientAccessFilter(filter, actor = {}) {
  if (!actor || hasPatientListAccess(actor)) return filter;

  if (isPatientActor(actor)) {
    return { ...filter, _id: actor.patientId };
  }

  if (hasPermission(actor, PERMISSION.PATIENTS.READ_ASSIGNED)) {
    const assignedIds = await getAssignedPatientIds(actor);
    if (assignedIds.length === 0) {
      return { ...filter, _id: { $in: [] } };
    }
    return { ...filter, _id: { $in: assignedIds } };
  }

  throw createError('Tài khoản hiện tại không có quyền danh sách bệnh nhân.', 403);
}

function parseSort(query = {}) {
  const allowed = new Set(['created_at', 'updated_at', 'full_name', 'patient_code', 'date_of_birth', 'status']);
  const sortBy = allowed.has(query.sort_by) ? query.sort_by : 'created_at';
  const direction = String(query.sort_order || query.sort_direction || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  return { [sortBy]: direction };
}

async function listPatients(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  let filter = { is_deleted: false };
  const canSearchSensitive = canUseSensitivePatientSearchFilters(actor);

  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;
  const sensitiveFilters = ['phone', 'email', 'national_id', 'insurance_number'].filter((field) => query[field]);
  if (sensitiveFilters.length > 0 && !canSearchSensitive) {
    throw createError('Quyền hiện tại không được tìm kiếm theo phone/email/national_id/insurance_number.', 403);
  }
  if (query.phone) filter.phone = normalizePhoneStrict(query.phone);
  if (query.email) filter.email = normalizeLower(query.email) || undefined;
  if (query.national_id) filter.national_id = normalizeIdentifierRaw(query.national_id);
  if (query.insurance_number) filter.insurance_number = normalizeInsuranceNumber(query.insurance_number);
  if (query.created_from || query.created_to) {
    filter.created_at = {};
    if (query.created_from) filter.created_at.$gte = getStartOfDay(query.created_from);
    if (query.created_to) filter.created_at.$lte = getEndOfDay(query.created_to);
  }

  const keywordFilter = buildPatientKeywordFilter(query.keyword || query.search, actor);
  if (keywordFilter) filter.$or = keywordFilter;

  if (query.has_account !== undefined) {
    const accountPatientIds = await PatientAccount.distinct('patient_id', { is_deleted: false });
    filter._id = {
      ...(filter._id && typeof filter._id === 'object' ? filter._id : {}),
      [String(query.has_account) === 'true' ? '$in' : '$nin']: accountPatientIds,
    };
  }

  filter = await applyPatientAccessFilter(filter, actor);
  const [items, total] = await Promise.all([
    Patient.find(filter).sort(parseSort(query)).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);

  const includeAccount = query.include_account === 'true' || query.has_account !== undefined;
  const accountMap = includeAccount && items.length
    ? new Map((await PatientAccount.find({
      patient_id: { $in: items.map((item) => item._id) },
      is_deleted: false,
    }).lean()).map((account) => [toId(account.patient_id), account]))
    : new Map();

  return {
    items: items.map((patient) => {
      const includeSensitive = canViewSensitivePatientFields(actor) && query.compact !== 'true';
      const item = sanitizePatient(patient, actor, { includeSensitive });
      if (!includeSensitive) {
        item.phone = maskPhone(item.phone);
        delete item.email;
      }
      return {
        ...item,
        has_account: includeAccount ? accountMap.has(toId(patient._id)) : undefined,
        account_status: includeAccount ? accountMap.get(toId(patient._id))?.status || null : undefined,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function searchPatients(query = {}, actor = {}) {
  const result = await listPatients({
    ...query,
    limit: Math.min(Number(query.limit || 20), 20),
    compact: 'true',
  }, actor);

  return {
    ...result,
    items: result.items.map((patient) => ({
      patient_id: patient.patient_id,
      id: patient.patient_id,
      patient_code: patient.patient_code,
      full_name: patient.full_name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      phone: canViewSensitivePatientFields(actor) ? patient.phone : maskPhone(patient.phone),
      status: patient.status,
    })),
  };
}

async function getPatientDetail(patientId, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    allowLimited: false,
    assignedPermissions: [
      PERMISSION.ENCOUNTERS.READ_ASSIGNED,
      PERMISSION.APPOINTMENTS.READ_OWN,
      PERMISSION.PRESCRIPTIONS.READ_OWN,
    ],
  });

  const includeSensitive = canViewSensitivePatientFields(actor);
  const canReadIdentifiers = includeSensitive || hasPermission(actor, PERMISSION.PATIENT_IDENTIFIERS.READ);
  const canReadAccount = includeSensitive || hasPermission(actor, PERMISSION.PATIENT_ACCOUNTS.READ) || isPatientActor(actor);
  const canReadRelatives = includeSensitive || hasPermission(actor, PERMISSION.PATIENT_RELATIVES.READ) || isPatientActor(actor);
  const canReadAuthorizations = includeSensitive || hasPermission(actor, PERMISSION.PATIENT_AUTHORIZATIONS.READ) || isPatientActor(actor);
  const canReadClinicalSummary = includeSensitive || hasAnyPermission(actor, [
    PERMISSION.ALLERGIES.READ,
    PERMISSION.PROBLEMS.READ,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ENCOUNTERS.READ_ASSIGNED,
  ]) || isPatientActor(actor);

  const [identifiers, account, relatives, authorizations, activeAllergies, activeProblems, upcomingAppointments] = await Promise.all([
    canReadIdentifiers
      ? PatientIdentifier.find({ patient_id: patient._id, is_deleted: false }).sort({ identifier_type: 1, is_primary: -1, created_at: -1 }).lean()
      : [],
    canReadAccount ? PatientAccount.findOne({ patient_id: patient._id, is_deleted: false }).lean() : null,
    canReadRelatives
      ? PatientRelative.find({ patient_id: patient._id, is_deleted: false, status: { $ne: 'blocked' } }).sort({ is_primary_contact: -1, is_emergency_contact: -1, created_at: -1 }).lean()
      : [],
    canReadAuthorizations ? PatientAuthorization.find({ patient_id: patient._id, is_deleted: false }).sort({ created_at: -1 }).lean() : [],
    canReadClinicalSummary
      ? Allergy.find({ patient_id: patient._id, status: ALLERGY_STATUS.ACTIVE }).sort({ severity: -1, created_at: -1 }).limit(10).lean()
      : [],
    canReadClinicalSummary
      ? ProblemList.find({ patient_id: patient._id, status: PROBLEM_STATUS.ACTIVE }).sort({ onset_date: -1, created_at: -1 }).limit(10).lean()
      : [],
    Appointment.find({
      patient_id: patient._id,
      is_deleted: false,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      appointment_time: { $gte: new Date() },
    }).sort({ appointment_time: 1 }).limit(5).lean(),
  ]);

  return {
    patient: sanitizePatient(patient, actor, { includeSensitive }),
    identifiers: identifiers.map(sanitizeIdentifier),
    account: sanitizeAccount(account),
    relatives: relatives.map(sanitizeRelative),
    authorizations: authorizations.map(sanitizeAuthorization),
    summary: {
      active_allergies_count: activeAllergies.length,
      active_problems_count: activeProblems.length,
      upcoming_appointments_count: upcomingAppointments.length,
      active_allergies: canReadClinicalSummary ? activeAllergies : undefined,
      active_problems: canReadClinicalSummary ? activeProblems : undefined,
      upcoming_appointments: upcomingAppointments,
    },
  };
}

function filterPatientUpdatePayload(payload = {}, actor = {}) {
  const normalized = normalizePatientData(payload);
  const requestedFields = Object.keys(normalized);

  if (isPatientActor(actor)) {
    const blocked = requestedFields.filter((field) => !PATIENT_SELF_UPDATE_FIELDS.includes(field));
    if (blocked.length > 0) {
      throw createError('Bệnh nhân không được tự sửa thông tin định danh hoặc hành chính nhạy cảm.', 403);
    }
    return compactObject(Object.fromEntries(
      PATIENT_SELF_UPDATE_FIELDS.map((field) => [field, normalized[field]]),
    ));
  }

  if (hasAnyPermission(actor, [PERMISSION.PATIENTS.UPDATE, PERMISSION.PATIENTS.UPDATE_SENSITIVE])) {
    return compactObject(Object.fromEntries(
      STAFF_STANDARD_UPDATE_FIELDS.map((field) => [field, normalized[field]]),
    ));
  }

  if (hasPermission(actor, PERMISSION.PATIENTS.UPDATE_BASIC)) {
    const blocked = requestedFields.filter((field) => !STAFF_BASIC_UPDATE_FIELDS.includes(field));
    if (blocked.length > 0) {
      throw createError('Quyền update_basic chỉ được sửa thông tin liên hệ cơ bản.', 403);
    }
    return compactObject(Object.fromEntries(
      STAFF_BASIC_UPDATE_FIELDS.map((field) => [field, normalized[field]]),
    ));
  }

  throw createError('Tài khoản hiện tại không có quyền cập nhật bệnh nhân.', 403);
}

async function syncAccountContact(patient, changes = {}, actor = {}, session = null) {
  if (!hasOwn(changes, 'email') && !hasOwn(changes, 'phone')) return;
  const account = await withSession(PatientAccount.findOne({ patient_id: patient._id, is_deleted: false }), session);
  if (!account) return;

  const email = hasOwn(changes, 'email') ? changes.email : account.email;
  const phone = hasOwn(changes, 'phone') ? changes.phone : account.phone;
  const username = account.username || email || phone;

  await assertPatientAccountUnique({ username, email, phone }, account._id, session);
  account.email = email;
  account.phone = phone;
  account.username = username;
  account.updated_by = actor?.userId;
  await account.save(sessionOptions(session));
}

async function updatePatient(patientId, payload, actor = {}, requestMeta = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    allowLimited: false,
    fullReadPermissions: [
      PERMISSION.PATIENTS.READ,
      PERMISSION.PATIENTS.UPDATE,
      PERMISSION.PATIENTS.UPDATE_BASIC,
      PERMISSION.PATIENTS.UPDATE_SENSITIVE,
    ],
  });

  if (isPatientActor(actor) && !idsEqual(actor.patientId, patient._id)) {
    throw createError('Bệnh nhân chỉ được sửa hồ sơ của chính mình.', 403);
  }

  const changes = filterPatientUpdatePayload(payload, actor);
  if (Object.keys(changes).length === 0) {
    return getPatientDetail(patient._id, actor);
  }

  lockVerifiedIdentityFields(patient, changes, actor);
  await assertPatientIdentityUnique(changes, patient._id);
  const before = patient.toObject();

  await withOptionalTransaction(async (session) => {
    const writablePatient = await loadPatientOrThrow(patient._id, session);
    Object.entries(changes).forEach(([field, value]) => {
      writablePatient[field] = value;
    });
    writablePatient.updated_by = actor?.userId || actor?.patientAccountId;
    await writablePatient.save(sessionOptions(session));

    if (hasOwn(changes, 'national_id')) {
      await syncPatientIdentifier(writablePatient._id, IDENTIFIER_TYPE.NATIONAL_ID, changes.national_id, actor, session);
    }
    if (hasOwn(changes, 'insurance_number')) {
      await syncPatientIdentifier(writablePatient._id, IDENTIFIER_TYPE.INSURANCE_NO, changes.insurance_number, actor, session);
    }
    if (hasOwn(changes, 'email') || hasOwn(changes, 'phone')) {
      await syncAccountContact(writablePatient, changes, actor, session);
    }

    await recordAuditLog({
      actor,
      action: isPatientActor(actor) ? 'patient.self.update' : 'patient.update',
      targetType: 'patient',
      targetId: writablePatient._id,
      status: 'success',
      message: 'Cập nhật hồ sơ bệnh nhân thành công.',
      requestMeta,
      before,
      after: writablePatient.toObject(),
    });
  }, { fallbackToNoTransaction: true });

  return getPatientDetail(patient._id, actor);
}

async function updatePatientStatus(patientId, status, actor = {}, requestMeta = {}) {
  if (!PATIENT_STATUSES.includes(status)) {
    throw createError('Trạng thái bệnh nhân không hợp lệ.', 422);
  }
  if (status === PATIENT_STATUS.MERGED) {
    throw createError('Không được chuyển trực tiếp sang merged. Hãy dùng luồng mergePatients.', 409);
  }
  if (status === PATIENT_STATUS.ARCHIVED) {
    return archivePatient(patientId, { reason: 'archive_by_status_update' }, actor, requestMeta);
  }

  const patient = await loadPatientOrThrow(patientId);
  if ([PATIENT_STATUS.MERGED, PATIENT_STATUS.ARCHIVED].includes(patient.status)) {
    throw createError('Hồ sơ đã merged/archived nên không được đổi trạng thái trực tiếp.', 409);
  }

  const before = patient.toObject();
  patient.status = status;
  patient.updated_by = actor?.userId;
  await patient.save();

  await recordAuditLog({
    actor,
    action: 'patient.update_status',
    targetType: 'patient',
    targetId: patient._id,
    status: 'success',
    message: 'Cập nhật trạng thái bệnh nhân thành công.',
    requestMeta,
    before,
    after: patient.toObject(),
    metadata: { status },
  });

  return getPatientDetail(patient._id, actor);
}

async function getArchiveBlockers(patientId) {
  const now = new Date();
  const [futureAppointments, activeEncounters, activeAdmissions, unpaidInvoices, pendingPaymentIntents] = await Promise.all([
    Appointment.countDocuments({
      patient_id: patientId,
      is_deleted: false,
      appointment_time: { $gte: now },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }),
    Encounter.countDocuments({ patient_id: patientId, status: { $in: ACTIVE_ENCOUNTER_STATUSES } }),
    Admission.countDocuments({ patient_id: patientId, status: { $in: ACTIVE_ADMISSION_STATUSES } }),
    Invoice.countDocuments({
      patient_id: patientId,
      status: { $in: OPEN_INVOICE_STATUSES },
      balance_due: { $gt: 0 },
    }),
    PaymentIntent.countDocuments({
      patient_id: patientId,
      status: {
        $in: [
          PAYMENT_INTENT_STATUS.CREATED,
          PAYMENT_INTENT_STATUS.PENDING,
          PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
        ],
      },
    }),
  ]);

  return [
    futureAppointments ? { type: 'future_appointments', count: futureAppointments } : null,
    activeEncounters ? { type: 'active_encounters', count: activeEncounters } : null,
    activeAdmissions ? { type: 'active_admissions', count: activeAdmissions } : null,
    unpaidInvoices ? { type: 'unpaid_invoices', count: unpaidInvoices } : null,
    pendingPaymentIntents ? { type: 'pending_payment_intents', count: pendingPaymentIntents } : null,
  ].filter(Boolean);
}

async function archivePatient(patientId, payload = {}, actor = {}, requestMeta = {}) {
  const patient = await loadPatientOrThrow(patientId);
  const blockers = await getArchiveBlockers(patient._id);
  if (blockers.length > 0) {
    if (payload.force === true) {
      throw createError('Force archive hồ sơ bệnh nhân đang bị vô hiệu hóa vì chưa có quyền riêng.', 403);
    }
    throw createError('Không thể archive bệnh nhân khi còn nghiệp vụ đang mở.', 409);
  }

  const before = patient.toObject();
  await withOptionalTransaction(async (session) => {
    const writablePatient = await loadPatientOrThrow(patient._id, session);
    writablePatient.status = PATIENT_STATUS.ARCHIVED;
    writablePatient.archived_at = new Date();
    writablePatient.archived_by = actor?.userId;
    writablePatient.archive_reason = payload.reason || payload.archive_reason;
    writablePatient.updated_by = actor?.userId;
    await writablePatient.save(sessionOptions(session));

    await PatientAccount.updateMany(
      { patient_id: writablePatient._id, is_deleted: false },
      { $set: { status: PATIENT_ACCOUNT_STATUS.DISABLED, updated_by: actor?.userId } },
      sessionOptions(session),
    );

    await recordAuditLog({
      actor,
      action: 'patient.archive',
      targetType: 'patient',
      targetId: writablePatient._id,
      status: 'success',
      message: 'Lưu trữ hồ sơ bệnh nhân thành công.',
      requestMeta,
      before,
      after: writablePatient.toObject(),
      metadata: { blockers_ignored: payload.force === true, reason: payload.reason || payload.archive_reason },
    });
  }, { fallbackToNoTransaction: true });

  return getPatientDetail(patient._id, actor);
}

async function addPatientIdentifier(patientId, payload, actor = {}, requestMeta = {}) {
  const patient = await loadPatientOrThrow(patientId);
  if (!IDENTIFIER_TYPES.includes(payload.identifier_type)) {
    throw createError('Loại định danh không hợp lệ.', 422);
  }

  const identifierValue = normalizeIdentifierValue(payload.identifier_type, payload.identifier_value);
  await validatePatientIdentifierUnique(payload.identifier_type, identifierValue);
  if (payload.identifier_type === IDENTIFIER_TYPE.NATIONAL_ID) {
    await assertPatientIdentityUnique({ national_id: identifierValue }, patient._id);
  }
  if (payload.identifier_type === IDENTIFIER_TYPE.INSURANCE_NO) {
    await assertPatientIdentityUnique({ insurance_number: identifierValue }, patient._id);
  }

  let identifierId = null;
  await withOptionalTransaction(async (session) => {
    if (payload.is_primary) {
      await PatientIdentifier.updateMany(
        { patient_id: patient._id, identifier_type: payload.identifier_type, is_deleted: false },
        { $set: { is_primary: false, updated_by: actor?.userId } },
        sessionOptions(session),
      );
    }

    const identifier = await createDocument(PatientIdentifier, {
      patient_id: patient._id,
      identifier_type: payload.identifier_type,
      identifier_value: identifierValue,
      issued_by: normalizeOptionalString(payload.issued_by),
      valid_from: normalizeDateValue(payload.valid_from, 'valid_from'),
      valid_to: normalizeDateValue(payload.valid_to, 'valid_to'),
      is_primary: Boolean(payload.is_primary),
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }, session);
    identifierId = identifier._id;

    if (payload.identifier_type === IDENTIFIER_TYPE.NATIONAL_ID) {
      await Patient.updateOne({ _id: patient._id }, { $set: { national_id: identifierValue, updated_by: actor?.userId } }, sessionOptions(session));
    }
    if (payload.identifier_type === IDENTIFIER_TYPE.INSURANCE_NO) {
      await Patient.updateOne({ _id: patient._id }, { $set: { insurance_number: identifierValue, updated_by: actor?.userId } }, sessionOptions(session));
    }

    await recordAuditLog({
      actor,
      action: 'patient.identifier.create',
      targetType: 'patient_identifier',
      targetId: identifier._id,
      status: 'success',
      message: 'Thêm định danh bệnh nhân thành công.',
      requestMeta,
      after: identifier.toObject(),
    });
  }, { fallbackToNoTransaction: true });

  return getPatientIdentifierDetail(patient._id, identifierId, actor);
}

async function listPatientIdentifiers(patientId, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    allowLimited: false,
    fullReadPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENT_IDENTIFIERS.READ],
  });
  const items = await PatientIdentifier.find({ patient_id: patient._id, is_deleted: false })
    .sort({ identifier_type: 1, is_primary: -1, created_at: -1 })
    .lean();
  return {
    patient_id: toId(patient._id),
    items: items.map(sanitizeIdentifier),
  };
}

async function getPatientIdentifierDetail(patientId, identifierId, actor = {}) {
  const identifier = await PatientIdentifier.findOne({
    _id: identifierId,
    patient_id: patientId,
    is_deleted: false,
  }).lean();

  if (!identifier) {
    throw createError('Không tìm thấy định danh bệnh nhân.', 404);
  }
  await assertCanReadPatient(identifier.patient_id, actor, {
    allowLimited: false,
    fullReadPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENT_IDENTIFIERS.READ],
  });
  return sanitizeIdentifier(identifier);
}

async function setPrimaryPatientIdentifier(patientId, identifierId, actor = {}, requestMeta = {}) {
  const identifier = await PatientIdentifier.findOne({
    _id: identifierId,
    patient_id: patientId,
    is_deleted: false,
  });
  if (!identifier) {
    throw createError('Không tìm thấy định danh bệnh nhân.', 404);
  }

  await withOptionalTransaction(async (session) => {
    await PatientIdentifier.updateMany(
      {
        patient_id: identifier.patient_id,
        identifier_type: identifier.identifier_type,
        is_deleted: false,
        _id: { $ne: identifier._id },
      },
      { $set: { is_primary: false, updated_by: actor?.userId } },
      sessionOptions(session),
    );

    identifier.is_primary = true;
    identifier.updated_by = actor?.userId;
    await identifier.save(sessionOptions(session));

    await recordAuditLog({
      actor,
      action: 'patient.identifier.set_primary',
      targetType: 'patient_identifier',
      targetId: identifier._id,
      status: 'success',
      message: 'Đặt định danh chính cho bệnh nhân thành công.',
      requestMeta,
    });
  }, { fallbackToNoTransaction: true });

  return getPatientIdentifierDetail(patientId, identifierId, actor);
}

async function updatePatientIdentifier(patientId, identifierId, payload, actor = {}, requestMeta = {}) {
  const identifier = await PatientIdentifier.findOne({
    _id: identifierId,
    patient_id: patientId,
    is_deleted: false,
  });
  if (!identifier) {
    throw createError('Không tìm thấy định danh bệnh nhân.', 404);
  }

  const nextType = payload.identifier_type || identifier.identifier_type;
  const nextValue = hasOwn(payload, 'identifier_value')
    ? normalizeIdentifierValue(nextType, payload.identifier_value)
    : identifier.identifier_value;
  if (!IDENTIFIER_TYPES.includes(nextType)) {
    throw createError('Loại định danh không hợp lệ.', 422);
  }
  if (!nextValue) {
    throw createError('identifier_value là bắt buộc.', 422);
  }

  if (nextType !== identifier.identifier_type || nextValue !== identifier.identifier_value) {
    await validatePatientIdentifierUnique(nextType, nextValue, identifier._id);
    if (nextType === IDENTIFIER_TYPE.NATIONAL_ID) {
      await assertPatientIdentityUnique({ national_id: nextValue }, identifier.patient_id);
    }
    if (nextType === IDENTIFIER_TYPE.INSURANCE_NO) {
      await assertPatientIdentityUnique({ insurance_number: nextValue }, identifier.patient_id);
    }
  }

  const before = identifier.toObject();
  await withOptionalTransaction(async (session) => {
    identifier.identifier_type = nextType;
    identifier.identifier_value = nextValue;
    if (hasOwn(payload, 'issued_by')) identifier.issued_by = normalizeOptionalString(payload.issued_by);
    if (hasOwn(payload, 'valid_from')) identifier.valid_from = normalizeDateValue(payload.valid_from, 'valid_from');
    if (hasOwn(payload, 'valid_to')) identifier.valid_to = normalizeDateValue(payload.valid_to, 'valid_to');
    identifier.updated_by = actor?.userId;
    await identifier.save(sessionOptions(session));

    if (payload.is_primary) {
      await PatientIdentifier.updateMany(
        {
          patient_id: identifier.patient_id,
          identifier_type: identifier.identifier_type,
          is_deleted: false,
          _id: { $ne: identifier._id },
        },
        { $set: { is_primary: false, updated_by: actor?.userId } },
        sessionOptions(session),
      );
      identifier.is_primary = true;
      await identifier.save(sessionOptions(session));
    }

    if (identifier.identifier_type === IDENTIFIER_TYPE.NATIONAL_ID) {
      await Patient.updateOne({ _id: identifier.patient_id }, { $set: { national_id: identifier.identifier_value, updated_by: actor?.userId } }, sessionOptions(session));
    }
    if (identifier.identifier_type === IDENTIFIER_TYPE.INSURANCE_NO) {
      await Patient.updateOne({ _id: identifier.patient_id }, { $set: { insurance_number: identifier.identifier_value, updated_by: actor?.userId } }, sessionOptions(session));
    }

    await recordAuditLog({
      actor,
      action: 'patient.identifier.update',
      targetType: 'patient_identifier',
      targetId: identifier._id,
      status: 'success',
      message: 'Cập nhật định danh bệnh nhân thành công.',
      requestMeta,
      before,
      after: identifier.toObject(),
    });
  }, { fallbackToNoTransaction: true });

  return getPatientIdentifierDetail(patientId, identifierId, actor);
}

async function removePatientIdentifier(patientId, identifierId, actor = {}, requestMeta = {}) {
  const identifier = await PatientIdentifier.findOne({
    _id: identifierId,
    patient_id: patientId,
    is_deleted: false,
  });
  if (!identifier) {
    throw createError('Không tìm thấy định danh bệnh nhân.', 404);
  }

  let alternative = null;
  if (identifier.is_primary) {
    alternative = await PatientIdentifier.findOne({
      patient_id: identifier.patient_id,
      identifier_type: identifier.identifier_type,
      _id: { $ne: identifier._id },
      is_deleted: false,
    }).sort({ created_at: -1 });
    if (!alternative) {
      throw createError('Không được xóa định danh primary duy nhất của loại này.', 409);
    }
  }

  const before = identifier.toObject();
  identifier.is_deleted = true;
  identifier.deleted_at = new Date();
  identifier.deleted_by = actor?.userId;
  identifier.updated_by = actor?.userId;
  await identifier.save();

  if (alternative) {
    alternative.is_primary = true;
    alternative.updated_by = actor?.userId;
    await alternative.save();
  }

  await recordAuditLog({
    actor,
    action: 'patient.identifier.soft_delete',
    targetType: 'patient_identifier',
    targetId: identifier._id,
    status: 'success',
    message: 'Xóa mềm định danh bệnh nhân thành công.',
    requestMeta,
    before,
    after: identifier.toObject(),
  });

  return { success: true };
}

async function linkUserAccountToPatient(patientId, payloadOrAccountId, actor = {}, requestMeta = {}) {
  const accountId = typeof payloadOrAccountId === 'string'
    ? payloadOrAccountId
    : payloadOrAccountId?.patient_account_id;

  if (!accountId) {
    const result = await createPatientAccountForPatient(patientId, payloadOrAccountId || {}, actor, requestMeta);
    await recordAuditLog({
      actor,
      action: 'patient.account.create',
      targetType: 'patient_account',
      targetId: result.account._id,
      status: 'success',
      message: 'Tạo tài khoản portal cho bệnh nhân thành công.',
      requestMeta,
    });
    return {
      account: sanitizeAccount(result.account, { temporaryPassword: result.temporary_password }),
    };
  }

  const [patient, account] = await Promise.all([
    Patient.findById(patientId),
    PatientAccount.findById(accountId),
  ]);

  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (!account || account.is_deleted) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  if (account.patient_id && !idsEqual(account.patient_id, patient._id)) {
    throw createError('Tài khoản này đang liên kết với bệnh nhân khác.', 409);
  }

  const existing = await PatientAccount.findOne({
    _id: { $ne: account._id },
    patient_id: patient._id,
    is_deleted: false,
  }).lean();
  if (existing) {
    throw createError('Bệnh nhân đã có tài khoản portal khác.', 409);
  }

  account.patient_id = patient._id;
  account.updated_by = actor?.userId;
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

  return getPatientDetail(patient._id, actor);
}

async function getMyPatientProfile(auth = {}) {
  if (!isPatientActor(auth)) {
    throw createError('Chỉ tài khoản bệnh nhân mới dùng được chức năng này.', 403);
  }
  return getPatientDetail(auth.patientId, auth);
}

async function updateMyPatientProfile(auth = {}, payload = {}, requestMeta = {}) {
  if (!isPatientActor(auth)) {
    throw createError('Chỉ tài khoản bệnh nhân mới dùng được chức năng này.', 403);
  }
  return updatePatient(auth.patientId, payload, auth, requestMeta);
}

async function createPatientRelativeInternal(patientId, payload = {}, actor = {}, session = null) {
  const normalized = normalizeRelativeData(payload);
  if (!normalized.full_name) throw createError('full_name người nhà là bắt buộc.', 422);
  if (!normalized.relationship) throw createError('relationship là bắt buộc.', 422);
  validateEmail(normalized.email);
  validatePhone(normalized.phone);

  if (normalized.status && !['active', 'inactive', 'blocked'].includes(normalized.status)) {
    throw createError('Trạng thái người nhà không hợp lệ.', 422);
  }

  if (normalized.is_primary_contact) {
    await PatientRelative.updateMany(
      { patient_id: patientId, is_deleted: false },
      { $set: { is_primary_contact: false, updated_by: actor?.userId } },
      sessionOptions(session),
    );
  }

  return createDocument(PatientRelative, {
    patient_id: patientId,
    ...normalized,
    verified_by: normalized.relationship_verified ? actor?.userId : undefined,
    verified_at: normalized.relationship_verified ? new Date() : undefined,
    status: normalized.status || 'active',
    created_by: actor?.userId,
    updated_by: actor?.userId,
  }, session);
}

async function addPatientRelative(patientId, payload, actor = {}, requestMeta = {}) {
  const patient = await loadPatientOrThrow(patientId);
  let relativeId = null;
  await withOptionalTransaction(async (session) => {
    const relative = await createPatientRelativeInternal(patient._id, payload, actor, session);
    relativeId = relative._id;
    await recordAuditLog({
      actor,
      action: 'patient.relative.create',
      targetType: 'patient_relative',
      targetId: relative._id,
      status: 'success',
      message: 'Thêm người nhà bệnh nhân thành công.',
      requestMeta,
      after: relative.toObject(),
    });
  }, { fallbackToNoTransaction: true });

  return getPatientRelativeDetail(relativeId, actor);
}

async function listPatientRelatives(patientId, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor);
  const items = await PatientRelative.find({ patient_id: patient._id, is_deleted: false })
    .sort({ is_primary_contact: -1, is_emergency_contact: -1, created_at: -1 })
    .lean();
  return {
    patient_id: toId(patient._id),
    items: items.map(sanitizeRelative),
  };
}

async function getPatientRelativeDetail(relativeId, actor = {}) {
  const relative = await PatientRelative.findOne({ _id: relativeId, is_deleted: false }).lean();
  if (!relative) throw createError('Không tìm thấy người nhà bệnh nhân.', 404);
  await assertCanReadPatient(relative.patient_id, actor);
  return sanitizeRelative(relative);
}

async function updatePatientRelative(relativeId, payload, actor = {}, requestMeta = {}) {
  const relative = await PatientRelative.findOne({ _id: relativeId, is_deleted: false });
  if (!relative) throw createError('Không tìm thấy người nhà bệnh nhân.', 404);
  const normalized = normalizeRelativeData(payload);
  const before = relative.toObject();

  await withOptionalTransaction(async (session) => {
    if (normalized.is_primary_contact) {
      await PatientRelative.updateMany(
        { patient_id: relative.patient_id, _id: { $ne: relative._id }, is_deleted: false },
        { $set: { is_primary_contact: false, updated_by: actor?.userId } },
        sessionOptions(session),
      );
    }
    Object.entries(normalized).forEach(([field, value]) => {
      relative[field] = value;
    });
    if (hasOwn(normalized, 'relationship_verified')) {
      relative.verified_by = normalized.relationship_verified ? actor?.userId : undefined;
      relative.verified_at = normalized.relationship_verified ? new Date() : undefined;
    }
    relative.updated_by = actor?.userId;
    await relative.save(sessionOptions(session));

    await recordAuditLog({
      actor,
      action: 'patient.relative.update',
      targetType: 'patient_relative',
      targetId: relative._id,
      status: 'success',
      message: 'Cập nhật người nhà bệnh nhân thành công.',
      requestMeta,
      before,
      after: relative.toObject(),
    });
  }, { fallbackToNoTransaction: true });

  return getPatientRelativeDetail(relative._id, actor);
}

async function deletePatientRelativeSoft(relativeId, actor = {}, requestMeta = {}) {
  const relative = await PatientRelative.findOne({ _id: relativeId, is_deleted: false });
  if (!relative) throw createError('Không tìm thấy người nhà bệnh nhân.', 404);

  const authorizationsToRevoke = await PatientAuthorization.find({
    patient_id: relative.patient_id,
    relative_id: relative._id,
    status: { $in: [AUTHORIZATION_STATUS.ACTIVE, AUTHORIZATION_STATUS.PENDING] },
    is_deleted: false,
  }).lean();

  const before = relative.toObject();
  await withOptionalTransaction(async (session) => {
    await PatientAuthorization.updateMany(
      {
        patient_id: relative.patient_id,
        relative_id: relative._id,
        status: { $in: [AUTHORIZATION_STATUS.ACTIVE, AUTHORIZATION_STATUS.PENDING] },
        is_deleted: false,
      },
      {
        $set: {
          status: AUTHORIZATION_STATUS.REVOKED,
          revoked_by: actor?.userId,
          revoked_at: new Date(),
          revoke_reason: 'relative_deleted',
          updated_by: actor?.userId,
        },
      },
      sessionOptions(session),
    );

    relative.is_deleted = true;
    relative.deleted_at = new Date();
    relative.deleted_by = actor?.userId;
    relative.updated_by = actor?.userId;
    await relative.save(sessionOptions(session));

    await recordAuditLog({
      actor,
      action: 'patient.relative.soft_delete',
      targetType: 'patient_relative',
      targetId: relative._id,
      status: 'success',
      message: 'Xóa mềm người nhà bệnh nhân thành công.',
      requestMeta,
      before,
      after: relative.toObject(),
    });
  }, { fallbackToNoTransaction: true });

  await Promise.all(authorizationsToRevoke.map((authorization) => publishPatientAuthorizationEvent(
    REALTIME_EVENT_TYPE.RELATIVE_ACCESS_REVOKED,
    { ...authorization, status: AUTHORIZATION_STATUS.REVOKED },
    requestMeta,
    { reason: 'relative_deleted' },
  )));
  if (authorizationsToRevoke.length > 0) {
    await authSessionService.invalidateAllUserSessions(
      'patient_relative',
      relative._id,
      requestMeta,
      {
        actorType: actor?.actorType || actor?.actor_type,
        actorId: actor?.userId || actor?.actorId || actor?.actor_id,
        reason: 'relative_deleted',
      },
    );
  }

  return { success: true };
}

function normalizeAuthorizationPayload(payload = {}) {
  const validFrom = normalizeDateValue(payload.valid_from || new Date(), 'valid_from');
  const validTo = normalizeDateValue(payload.valid_to, 'valid_to');
  if (validTo && validFrom && validTo < validFrom) {
    throw createError('valid_to phải lớn hơn hoặc bằng valid_from.', 422);
  }
  const authorizationType = normalizeOptionalString(payload.authorization_type);
  if (!AUTHORIZATION_TYPES.includes(authorizationType)) {
    throw createError('authorization_type không hợp lệ.', 422);
  }
  const status = payload.status || AUTHORIZATION_STATUS.ACTIVE;
  if (!AUTHORIZATION_STATUSES.includes(status)) {
    throw createError('Trạng thái ủy quyền không hợp lệ.', 422);
  }
  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions.map(normalizeOptionalString).filter(Boolean)
    : [];
  const invalidPermissions = permissions.filter((permission) => !AUTHORIZATION_TYPES.includes(permission));
  if (invalidPermissions.length > 0) {
    throw createError(`permissions chứa scope không hợp lệ: ${invalidPermissions.join(', ')}`, 422);
  }
  const explicitPermissions = permissions.length > 0
    ? permissions
    : expandAuthorizationScopes(authorizationType).filter((scope) => scope !== AUTHORIZATION_TYPE.FULL_ACCESS);
  if (authorizationType !== AUTHORIZATION_TYPE.FULL_ACCESS && explicitPermissions.length === 0) {
    throw createError('Ủy quyền người nhà phải có scope cụ thể.', 422);
  }
  return {
    authorization_type: authorizationType,
    permissions: authorizationType === AUTHORIZATION_TYPE.FULL_ACCESS
      ? [...new Set(permissions)]
      : [...new Set(explicitPermissions)],
    valid_from: validFrom,
    valid_to: validTo,
    status,
  };
}

function patientAuthorizationRecipientScope(authorization = {}) {
  return {
    patient_id: authorization.patient_id,
    relative_id: authorization.relative_id,
    recipients: [
      { recipient_type: 'patient', recipient_id: authorization.patient_id, patient_id: authorization.patient_id },
      { recipient_type: 'relative', recipient_id: authorization.relative_id, relative_id: authorization.relative_id, patient_id: authorization.patient_id },
    ],
  };
}

async function publishPatientAuthorizationEvent(eventType, authorization = {}, requestMeta = {}, extraPayload = {}) {
  if (!authorization?._id) return null;
  return eventBus.publishDomainEvent({
    eventType,
    aggregateType: 'patient_authorization',
    aggregateId: authorization._id,
    recipientScope: patientAuthorizationRecipientScope(authorization),
    payload: {
      patient_authorization_id: toId(authorization._id),
      patient_id: toId(authorization.patient_id),
      relative_id: toId(authorization.relative_id),
      status: authorization.status,
      authorization_type: authorization.authorization_type,
      permissions: authorization.permissions || [],
      request_id: requestMeta.requestId || requestMeta.request_id,
      ...extraPayload,
    },
  });
}

async function createPatientAuthorization(patientId, relativeId, payload, actor = {}, requestMeta = {}) {
  if (!relativeId) {
    throw createError('relative_id là bắt buộc.', 422);
  }
  const [patient, relative] = await Promise.all([
    loadPatientOrThrow(patientId),
    PatientRelative.findOne({ _id: relativeId, patient_id: patientId, is_deleted: false }),
  ]);
  if (!relative) throw createError('Không tìm thấy người nhà thuộc bệnh nhân này.', 404);
  if (relative.status !== 'active') {
    throw createError('Người nhà không active nên không thể cấp ủy quyền mới.', 409);
  }

  const normalized = normalizeAuthorizationPayload(payload);
  const authorization = await PatientAuthorization.create({
    patient_id: patient._id,
    relative_id: relative._id,
    ...normalized,
    approved_by: normalized.status === AUTHORIZATION_STATUS.ACTIVE ? actor?.userId : undefined,
    approved_at: normalized.status === AUTHORIZATION_STATUS.ACTIVE ? new Date() : undefined,
    created_by: actor?.userId,
    updated_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'patient.authorization.create',
    targetType: 'patient_authorization',
    targetId: authorization._id,
    status: 'success',
    message: 'Tạo ủy quyền người nhà thành công.',
    requestMeta,
    after: authorization.toObject(),
  });

  if (authorization.status === AUTHORIZATION_STATUS.ACTIVE) {
    await publishPatientAuthorizationEvent(
      REALTIME_EVENT_TYPE.RELATIVE_ACCESS_GRANTED,
      authorization,
      requestMeta,
      { action: 'created' },
    );
  }

  return sanitizeAuthorization(authorization);
}

async function listPatientAuthorizations(patientId, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor);
  const items = await PatientAuthorization.find({ patient_id: patient._id, is_deleted: false })
    .sort({ status: 1, created_at: -1 })
    .lean();
  return {
    patient_id: toId(patient._id),
    items: items.map(sanitizeAuthorization),
  };
}

async function approvePatientAuthorization(authorizationId, actor = {}, requestMeta = {}) {
  const authorization = await PatientAuthorization.findOne({ _id: authorizationId, is_deleted: false });
  if (!authorization) throw createError('Không tìm thấy ủy quyền người nhà.', 404);
  if (authorization.status !== AUTHORIZATION_STATUS.PENDING) {
    throw createError('Chỉ ủy quyền pending mới được approve.', 409);
  }

  const before = authorization.toObject();
  authorization.status = AUTHORIZATION_STATUS.ACTIVE;
  authorization.approved_by = actor?.userId;
  authorization.approved_at = new Date();
  authorization.updated_by = actor?.userId;
  await authorization.save();

  await recordAuditLog({
    actor,
    action: 'patient.authorization.approve',
    targetType: 'patient_authorization',
    targetId: authorization._id,
    status: 'success',
    message: 'Duyệt ủy quyền người nhà thành công.',
    requestMeta,
    before,
    after: authorization.toObject(),
  });

  await publishPatientAuthorizationEvent(
    REALTIME_EVENT_TYPE.RELATIVE_ACCESS_GRANTED,
    authorization,
    requestMeta,
    { action: 'approved' },
  );

  return sanitizeAuthorization(authorization);
}

async function revokePatientAuthorization(authorizationId, reason, actor = {}, requestMeta = {}) {
  const authorization = await PatientAuthorization.findOne({ _id: authorizationId, is_deleted: false });
  if (!authorization) throw createError('Không tìm thấy ủy quyền người nhà.', 404);
  if (![AUTHORIZATION_STATUS.ACTIVE, AUTHORIZATION_STATUS.PENDING].includes(authorization.status)) {
    throw createError('Ủy quyền này không còn ở trạng thái có thể revoke.', 409);
  }

  const before = authorization.toObject();
  authorization.status = AUTHORIZATION_STATUS.REVOKED;
  authorization.revoked_by = actor?.userId;
  authorization.revoked_at = new Date();
  authorization.revoke_reason = reason || 'revoked_by_staff';
  authorization.updated_by = actor?.userId;
  await authorization.save();

  await recordAuditLog({
    actor,
    action: 'patient.authorization.revoke',
    targetType: 'patient_authorization',
    targetId: authorization._id,
    status: 'success',
    message: 'Thu hồi ủy quyền người nhà thành công.',
    requestMeta,
    before,
    after: authorization.toObject(),
  });

  await publishPatientAuthorizationEvent(
    REALTIME_EVENT_TYPE.RELATIVE_ACCESS_REVOKED,
    authorization,
    requestMeta,
    { reason: authorization.revoke_reason },
  );
  await authSessionService.invalidateAllUserSessions(
    'patient_relative',
    authorization.relative_id,
    requestMeta,
    {
      actorType: actor?.actorType || actor?.actor_type,
      actorId: actor?.userId || actor?.actorId || actor?.actor_id,
      reason: 'relative_access_revoked',
    },
  );

  return sanitizeAuthorization(authorization);
}

async function expireAuthorizations(options = {}, actor = {}, requestMeta = {}) {
  const now = options.now || new Date();
  const limit = Math.min(Math.max(Number(options.limit || 100), 1), 500);
  const candidates = await PatientAuthorization.find({
    status: AUTHORIZATION_STATUS.ACTIVE,
    is_deleted: false,
    valid_to: { $lte: now },
  })
    .sort({ valid_to: 1 })
    .limit(limit);

  const expired = [];
  for (const candidate of candidates) {
    const authorization = await PatientAuthorization.findOneAndUpdate(
      {
        _id: candidate._id,
        status: AUTHORIZATION_STATUS.ACTIVE,
        is_deleted: false,
        valid_to: { $lte: now },
      },
      {
        $set: {
          status: AUTHORIZATION_STATUS.EXPIRED,
          updated_by: actor?.userId,
        },
      },
      { new: true },
    );
    if (!authorization) continue;
    expired.push(sanitizeAuthorization(authorization));
    await publishPatientAuthorizationEvent(
      REALTIME_EVENT_TYPE.AUTHORIZATION_EXPIRED,
      authorization,
      requestMeta,
      { expired_at: now },
    );
    await authSessionService.invalidateAllUserSessions(
      'patient_relative',
      authorization.relative_id,
      requestMeta,
      {
        actorType: actor?.actorType || actor?.actor_type,
        actorId: actor?.userId || actor?.actorId || actor?.actor_id,
        reason: 'relative_authorization_expired',
      },
    );
  }

  if (expired.length > 0) {
    await recordAuditLog({
      actor,
      action: 'patient.authorization.expire',
      targetType: 'patient_authorization',
      status: 'success',
      message: 'Tự động hết hạn ủy quyền người nhà.',
      requestMeta,
      metadata: { expired_count: expired.length },
    });
  }

  return { expired_count: expired.length, items: expired };
}

async function validateEncounterBelongsToPatient(patientId, encounterId) {
  if (!encounterId) return null;
  const encounter = await Encounter.findOne({ _id: encounterId, patient_id: patientId }).lean();
  if (!encounter) throw createError('encounter_id không thuộc bệnh nhân này.', 409);
  return encounter;
}

async function assertCanWritePatientClinical(patientId, actor = {}, writePermissions = []) {
  const permissions = Array.isArray(writePermissions) ? writePermissions : [writePermissions];
  if (!hasAnyPermission(actor, permissions)) {
    throw createError('Tài khoản hiện tại không có quyền ghi dữ liệu lâm sàng này.', 403);
  }
  if (hasPermission(actor, PERMISSION.PATIENTS.READ)) {
    return true;
  }
  if (await isStaffAssignedToPatient(patientId, actor)) {
    return true;
  }
  throw createError('Không được ghi dữ liệu lâm sàng cho bệnh nhân ngoài phân công.', 403);
}

async function listPatientProblems(patientId, query = {}, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    assignedPermissions: [PERMISSION.PROBLEMS.READ, PERMISSION.ENCOUNTERS.READ_ASSIGNED],
  });
  const filter = { patient_id: patient._id };
  if (query.status) filter.status = query.status;
  const items = await ProblemList.find(filter)
    .sort({ status: 1, onset_date: -1, created_at: -1 })
    .lean();
  return { patient_id: toId(patient._id), items };
}

async function addPatientProblem(patientId, payload, actor = {}, requestMeta = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanWritePatientClinical(patient._id, actor, PERMISSION.PROBLEMS.CREATE);
  await validateEncounterBelongsToPatient(patient._id, payload.encounter_id);
  if (!payload.problem_name) throw createError('problem_name là bắt buộc.', 422);
  if (payload.severity && !PROBLEM_SEVERITIES.includes(payload.severity)) {
    throw createError('severity không hợp lệ.', 422);
  }
  if (payload.status && !PROBLEM_STATUSES.includes(payload.status)) {
    throw createError('status không hợp lệ.', 422);
  }

  if (payload.diagnosis_id) {
    const diagnosis = await Diagnosis.findById(payload.diagnosis_id).lean();
    if (!diagnosis) throw createError('Không tìm thấy diagnosis.', 404);
    const encounter = await Encounter.findById(diagnosis.encounter_id).lean();
    if (!encounter || !idsEqual(encounter.patient_id, patient._id)) {
      throw createError('diagnosis_id không thuộc bệnh nhân này.', 409);
    }
  }

  const problem = await ProblemList.create({
    patient_id: patient._id,
    encounter_id: payload.encounter_id || undefined,
    diagnosis_id: payload.diagnosis_id || undefined,
    recorded_by: payload.recorded_by || actor?.userId,
    icd10_code: normalizeOptionalString(payload.icd10_code),
    problem_name: normalizeOptionalString(payload.problem_name),
    severity: payload.severity || 'unknown',
    onset_date: normalizeDateValue(payload.onset_date, 'onset_date'),
    notes: normalizeOptionalString(payload.notes),
    status: payload.status || PROBLEM_STATUS.ACTIVE,
    created_by: actor?.userId,
    updated_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'patient.problem.create',
    targetType: 'problem',
    targetId: problem._id,
    status: 'success',
    message: 'Thêm problem cho bệnh nhân thành công.',
    requestMeta,
    after: problem.toObject(),
  });

  return { problem };
}

async function updatePatientProblem(patientId, problemId, payload, actor = {}, requestMeta = {}) {
  const problem = await ProblemList.findOne({ _id: problemId, patient_id: patientId });
  if (!problem) throw createError('Không tìm thấy problem của bệnh nhân.', 404);
  const allowedWritePermissions = payload.status === PROBLEM_STATUS.RESOLVED
    ? [PERMISSION.PROBLEMS.UPDATE, PERMISSION.PROBLEMS.RESOLVE]
    : [PERMISSION.PROBLEMS.UPDATE];
  await assertCanWritePatientClinical(problem.patient_id, actor, allowedWritePermissions);
  if (!hasPermission(actor, PERMISSION.PROBLEMS.UPDATE) && hasPermission(actor, PERMISSION.PROBLEMS.RESOLVE)) {
    const fields = Object.keys(payload || {});
    if (fields.some((field) => field !== 'status')) {
      throw createError('Quyền resolve chỉ được cập nhật trạng thái problem.', 403);
    }
  }
  if (problem.status === PROBLEM_STATUS.ENTERED_IN_ERROR) {
    throw createError('Problem đã entered_in_error nên không được chỉnh sửa thường.', 409);
  }
  if (payload.encounter_id) await validateEncounterBelongsToPatient(patientId, payload.encounter_id);
  if (payload.severity && !PROBLEM_SEVERITIES.includes(payload.severity)) throw createError('severity không hợp lệ.', 422);
  if (payload.status && !PROBLEM_STATUSES.includes(payload.status)) throw createError('status không hợp lệ.', 422);

  const before = problem.toObject();
  const fields = ['encounter_id', 'diagnosis_id', 'icd10_code', 'problem_name', 'severity', 'notes', 'status'];
  fields.forEach((field) => {
    if (hasOwn(payload, field)) problem[field] = normalizeOptionalString(payload[field]) || payload[field];
  });
  if (hasOwn(payload, 'onset_date')) problem.onset_date = normalizeDateValue(payload.onset_date, 'onset_date');
  if (problem.status === PROBLEM_STATUS.RESOLVED && !problem.resolved_at) problem.resolved_at = new Date();
  problem.updated_by = actor?.userId;
  await problem.save();

  await recordAuditLog({
    actor,
    action: 'patient.problem.update',
    targetType: 'problem',
    targetId: problem._id,
    status: 'success',
    message: 'Cập nhật problem của bệnh nhân thành công.',
    requestMeta,
    before,
    after: problem.toObject(),
  });

  return { problem };
}

async function resolvePatientProblem(patientId, problemId, actor = {}, requestMeta = {}) {
  return updatePatientProblem(patientId, problemId, {
    status: PROBLEM_STATUS.RESOLVED,
  }, actor, requestMeta);
}

async function listPatientAllergies(patientId, query = {}, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    assignedPermissions: [PERMISSION.ALLERGIES.READ, PERMISSION.ENCOUNTERS.READ_ASSIGNED],
  });
  const filter = { patient_id: patient._id };
  if (query.status) filter.status = query.status;
  const items = await Allergy.find(filter)
    .sort({ status: 1, severity: -1, created_at: -1 })
    .lean();
  return { patient_id: toId(patient._id), items };
}

async function addPatientAllergy(patientId, payload, actor = {}, requestMeta = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanWritePatientClinical(patient._id, actor, PERMISSION.ALLERGIES.CREATE);
  await validateEncounterBelongsToPatient(patient._id, payload.encounter_id);
  if (!payload.allergen) throw createError('allergen là bắt buộc.', 422);
  if (payload.allergy_type && !ALLERGY_TYPES.includes(payload.allergy_type)) {
    throw createError('allergy_type không hợp lệ.', 422);
  }
  if (payload.severity && !ALLERGY_SEVERITIES.includes(payload.severity)) {
    throw createError('severity không hợp lệ.', 422);
  }
  if (payload.status && !ALLERGY_STATUSES.includes(payload.status)) {
    throw createError('status không hợp lệ.', 422);
  }

  const allergy = await Allergy.create({
    patient_id: patient._id,
    encounter_id: payload.encounter_id || undefined,
    recorded_by: payload.recorded_by || actor?.userId,
    allergy_type: payload.allergy_type || 'unknown',
    allergen: normalizeOptionalString(payload.allergen),
    reaction: normalizeOptionalString(payload.reaction),
    severity: payload.severity || 'unknown',
    onset_date: normalizeDateValue(payload.onset_date, 'onset_date'),
    notes: normalizeOptionalString(payload.notes),
    status: payload.status || ALLERGY_STATUS.ACTIVE,
    created_by: actor?.userId,
    updated_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'patient.allergy.create',
    targetType: 'allergy',
    targetId: allergy._id,
    status: 'success',
    message: 'Thêm dị ứng cho bệnh nhân thành công.',
    requestMeta,
    after: allergy.toObject(),
  });

  return { allergy };
}

async function updatePatientAllergy(patientId, allergyId, payload, actor = {}, requestMeta = {}) {
  const allergy = await Allergy.findOne({ _id: allergyId, patient_id: patientId });
  if (!allergy) throw createError('Không tìm thấy dị ứng của bệnh nhân.', 404);
  const allowedWritePermissions = payload.status === ALLERGY_STATUS.ENTERED_IN_ERROR
    ? [PERMISSION.ALLERGIES.UPDATE, PERMISSION.ALLERGIES.RESOLVE]
    : [PERMISSION.ALLERGIES.UPDATE];
  await assertCanWritePatientClinical(allergy.patient_id, actor, allowedWritePermissions);
  if (!hasPermission(actor, PERMISSION.ALLERGIES.UPDATE) && hasPermission(actor, PERMISSION.ALLERGIES.RESOLVE)) {
    const fields = Object.keys(payload || {});
    if (fields.some((field) => field !== 'status')) {
      throw createError('Quyền resolve chỉ được cập nhật trạng thái allergy.', 403);
    }
  }
  if (payload.encounter_id) await validateEncounterBelongsToPatient(patientId, payload.encounter_id);
  if (payload.allergy_type && !ALLERGY_TYPES.includes(payload.allergy_type)) throw createError('allergy_type không hợp lệ.', 422);
  if (payload.severity && !ALLERGY_SEVERITIES.includes(payload.severity)) throw createError('severity không hợp lệ.', 422);
  if (payload.status && !ALLERGY_STATUSES.includes(payload.status)) throw createError('status không hợp lệ.', 422);

  const before = allergy.toObject();
  const fields = ['encounter_id', 'allergy_type', 'allergen', 'reaction', 'severity', 'notes', 'status'];
  fields.forEach((field) => {
    if (hasOwn(payload, field)) allergy[field] = normalizeOptionalString(payload[field]) || payload[field];
  });
  if (hasOwn(payload, 'onset_date')) allergy.onset_date = normalizeDateValue(payload.onset_date, 'onset_date');
  allergy.updated_by = actor?.userId;
  await allergy.save();

  await recordAuditLog({
    actor,
    action: 'patient.allergy.update',
    targetType: 'allergy',
    targetId: allergy._id,
    status: 'success',
    message: 'Cập nhật dị ứng của bệnh nhân thành công.',
    requestMeta,
    before,
    after: allergy.toObject(),
  });

  return { allergy };
}

async function removePatientAllergy(patientId, allergyId, actor = {}, requestMeta = {}) {
  return updatePatientAllergy(patientId, allergyId, {
    status: ALLERGY_STATUS.ENTERED_IN_ERROR,
  }, actor, requestMeta);
}

async function getPatientAppointmentHistory(patientId, query = {}, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    fullReadPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.APPOINTMENTS.READ],
    assignedPermissions: [PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.APPOINTMENTS.READ_OWN],
  });

  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patient._id, is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.date_from || query.date_to) {
    filter.appointment_time = {};
    if (query.date_from) filter.appointment_time.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.appointment_time.$lte = getEndOfDay(query.date_to);
  }

  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ appointment_time: -1 }).skip(skip).limit(limit).lean(),
    Appointment.countDocuments(filter),
  ]);
  const doctorIds = [...new Set(items.map((item) => toId(item.doctor_id)).filter(Boolean))];
  const departmentIds = [...new Set(items.map((item) => toId(item.department_id)).filter(Boolean))];
  const [doctors, departments] = await Promise.all([
    doctorIds.length ? User.find({ _id: { $in: doctorIds }, is_deleted: false }).select('full_name employee_code').lean() : [],
    departmentIds.length ? Department.find({ _id: { $in: departmentIds }, is_deleted: false }).select('department_name department_code').lean() : [],
  ]);
  const doctorMap = new Map(doctors.map((item) => [toId(item._id), item]));
  const departmentMap = new Map(departments.map((item) => [toId(item._id), item]));

  return {
    patient_id: toId(patient._id),
    items: items.map((item) => ({
      appointment_id: toId(item._id),
      doctor_id: toId(item.doctor_id),
      doctor_name: doctorMap.get(toId(item.doctor_id))?.full_name || null,
      department_id: toId(item.department_id),
      department_name: departmentMap.get(toId(item.department_id))?.department_name || null,
      appointment_time: item.appointment_time,
      appointment_type: item.appointment_type,
      reason: item.reason,
      source: item.source,
      status: item.status,
      notes: isPatientActor(actor) ? undefined : item.notes,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getPatientEncounterHistory(patientId, query = {}, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    fullReadPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.ENCOUNTERS.READ],
    assignedPermissions: [PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ_OWN],
  });

  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patient._id };
  if (query.status) filter.status = query.status;
  if (query.encounter_type) filter.encounter_type = query.encounter_type;
  if (query.date_from || query.date_to) {
    filter.start_time = {};
    if (query.date_from) filter.start_time.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.start_time.$lte = getEndOfDay(query.date_to);
  }

  if (isPatientActor(actor)) {
    filter.status = ENCOUNTER_STATUS.COMPLETED;
  }

  const [items, total] = await Promise.all([
    Encounter.find(filter).sort({ start_time: -1 }).skip(skip).limit(limit).lean(),
    Encounter.countDocuments(filter),
  ]);

  const doctorIds = [...new Set(items.map((item) => toId(item.attending_doctor_id)).filter(Boolean))];
  const departmentIds = [...new Set(items.map((item) => toId(item.department_id)).filter(Boolean))];
  const [doctors, departments, doctorProfiles] = await Promise.all([
    doctorIds.length ? User.find({ _id: { $in: doctorIds }, is_deleted: false }).select('full_name employee_code avatar_url').lean() : [],
    departmentIds.length ? Department.find({ _id: { $in: departmentIds }, is_deleted: false }).select('department_name department_code').lean() : [],
    doctorIds.length
      ? DoctorProfile.find({ user_id: { $in: doctorIds }, is_deleted: false }).select('user_id avatar_url').lean()
      : [],
  ]);
  const doctorMap = new Map(doctors.map((item) => [toId(item._id), item]));
  const departmentMap = new Map(departments.map((item) => [toId(item._id), item]));
  const doctorProfileMap = new Map(doctorProfiles.map((item) => [toId(item.user_id), item]));

  return {
    patient_id: toId(patient._id),
    items: items.map((item) => {
      const doctor = doctorMap.get(toId(item.attending_doctor_id));
      const department = departmentMap.get(toId(item.department_id));
      const doctorProfile = doctorProfileMap.get(toId(item.attending_doctor_id));

      return {
        encounter_id: toId(item._id),
        encounter_code: item.encounter_code,
        appointment_id: item.appointment_id ? toId(item.appointment_id) : null,
        department_id: toId(item.department_id),
        department_name: department?.department_name || null,
        attending_doctor_id: toId(item.attending_doctor_id),
        doctor_id: toId(item.attending_doctor_id),
        doctor_name: doctor?.full_name || null,
        doctor_avatar_url: doctorProfile?.avatar_url || doctor?.avatar_url || null,
        encounter_type: item.encounter_type,
        start_time: item.start_time,
        end_time: item.end_time,
        chief_reason: item.chief_reason,
        status: item.status,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function getPatientPrescriptionHistory(patientId, query = {}, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    fullReadPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PRESCRIPTIONS.READ],
    assignedPermissions: [PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.PRESCRIPTIONS.READ_OWN],
  });

  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patient._id };
  if (query.status) filter.status = query.status;
  if (query.date_from || query.date_to) {
    filter.prescribed_at = {};
    if (query.date_from) filter.prescribed_at.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.prescribed_at.$lte = getEndOfDay(query.date_to);
  }

  const [prescriptions, total] = await Promise.all([
    Prescription.find(filter).sort({ prescribed_at: -1 }).skip(skip).limit(limit).lean(),
    Prescription.countDocuments(filter),
  ]);

  const prescriptionIds = prescriptions.map((item) => item._id);
  const medicationItems = prescriptionIds.length
    ? await PrescriptionItem.find({
      prescription_id: { $in: prescriptionIds },
      status: { $ne: 'cancelled' },
    }).sort({ created_at: 1 }).lean()
    : [];
  const medicationIds = [...new Set(medicationItems.map((item) => toId(item.medication_id)).filter(Boolean))];
  const doctorIds = [...new Set(prescriptions.map((item) => toId(item.prescribed_by)).filter(Boolean))];
  const encounterIds = [...new Set(prescriptions.map((item) => toId(item.encounter_id)).filter(Boolean))];

  const [medications, doctors, encounters] = await Promise.all([
    medicationIds.length ? MedicationMaster.find({ _id: { $in: medicationIds } }).select('generic_name brand_name strength dosage_form').lean() : [],
    doctorIds.length ? User.find({ _id: { $in: doctorIds }, is_deleted: false }).select('full_name').lean() : [],
    encounterIds.length ? Encounter.find({ _id: { $in: encounterIds } }).select('encounter_code department_id encounter_type').lean() : [],
  ]);

  const medicationMap = new Map(medications.map((item) => [toId(item._id), item]));
  const doctorMap = new Map(doctors.map((item) => [toId(item._id), item]));
  const encounterMap = new Map(encounters.map((item) => [toId(item._id), item]));
  const groupedItems = medicationItems.reduce((map, item) => {
    const key = toId(item.prescription_id);
    const bucket = map.get(key) || [];
    bucket.push(item);
    map.set(key, bucket);
    return map;
  }, new Map());

  return {
    patient_id: toId(patient._id),
    items: prescriptions.map((prescription) => {
      const doctor = doctorMap.get(toId(prescription.prescribed_by));
      const encounter = encounterMap.get(toId(prescription.encounter_id));
      return {
        prescription_id: toId(prescription._id),
        prescription_no: prescription.prescription_no,
        prescribed_at: prescription.prescribed_at,
        status: prescription.status,
        note: isPatientActor(actor) ? undefined : prescription.note,
        encounter_id: prescription.encounter_id ? toId(prescription.encounter_id) : null,
        encounter_code: encounter?.encounter_code || null,
        encounter_type: encounter?.encounter_type || null,
        doctor_id: prescription.prescribed_by ? toId(prescription.prescribed_by) : null,
        doctor_name: doctor?.full_name || null,
        items: (groupedItems.get(toId(prescription._id)) || []).map((item) => {
          const medication = medicationMap.get(toId(item.medication_id));
          return {
            prescription_item_id: toId(item._id),
            medication_id: item.medication_id ? toId(item.medication_id) : null,
            medication_name: medication?.brand_name ||
              [medication?.generic_name, medication?.strength].filter(Boolean).join(' ') ||
              'Thuốc chưa định danh',
            dose: item.dose,
            frequency: item.frequency,
            route: item.route,
            duration_days: item.duration_days,
            quantity: item.quantity,
            instructions: item.instructions,
            status: item.status,
          };
        }),
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function getPatientSummary(patientId, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    allowLimited: false,
    assignedPermissions: [
      PERMISSION.PATIENTS.READ_ASSIGNED,
      PERMISSION.ENCOUNTERS.READ_ASSIGNED,
      PERMISSION.APPOINTMENTS.READ_OWN,
    ],
  });

  const canReadClinical = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ENCOUNTERS.READ_ASSIGNED,
    PERMISSION.PROBLEMS.READ,
    PERMISSION.ALLERGIES.READ,
  ]) || isPatientActor(actor);

  const canReadIdentifiers = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENT_IDENTIFIERS.READ,
  ]) || isPatientActor(actor);

  const canReadAppointments = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.READ_ASSIGNED,
    PERMISSION.APPOINTMENTS.READ,
    PERMISSION.APPOINTMENTS.READ_OWN,
  ]) || isPatientActor(actor);

  const canReadPrescriptions = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PRESCRIPTIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ_OWN,
  ]) || isPatientActor(actor);

  const canReadBilling = hasAnyPermission(actor, [
    PERMISSION.INVOICES.READ,
    PERMISSION.INVOICES.SELF_READ,
    PERMISSION.PAYMENTS.READ,
    PERMISSION.PAYMENTS.SELF_READ,
  ]) || isPatientActor(actor);

  const [
    activeAllergies,
    activeProblems,
    upcomingAppointment,
    lastEncounter,
    lastPrescription,
    account,
    identifiers,
    unpaidInvoiceSummary,
  ] = await Promise.all([
    canReadClinical
      ? Allergy.find({ patient_id: patient._id, status: ALLERGY_STATUS.ACTIVE }).sort({ severity: -1, created_at: -1 }).limit(10).lean()
      : [],
    canReadClinical
      ? ProblemList.find({ patient_id: patient._id, status: PROBLEM_STATUS.ACTIVE }).sort({ onset_date: -1, created_at: -1 }).limit(10).lean()
      : [],
    canReadAppointments ? Appointment.findOne({
      patient_id: patient._id,
      is_deleted: false,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      appointment_time: { $gte: new Date() },
    }).sort({ appointment_time: 1 }).lean() : null,
    canReadClinical ? Encounter.findOne({ patient_id: patient._id }).sort({ start_time: -1 }).lean() : null,
    canReadPrescriptions ? Prescription.findOne({ patient_id: patient._id }).sort({ prescribed_at: -1 }).lean() : null,
    PatientAccount.findOne({ patient_id: patient._id, is_deleted: false }).lean(),
    canReadIdentifiers
      ? PatientIdentifier.find({ patient_id: patient._id, is_deleted: false, is_primary: true }).sort({ identifier_type: 1 }).lean()
      : [],
    canReadBilling
      ? Invoice.aggregate([
        { $match: { patient_id: patient._id, status: { $in: OPEN_INVOICE_STATUSES } } },
        { $group: { _id: null, count: { $sum: 1 }, balance_due: { $sum: '$balance_due' } } },
      ])
      : [],
  ]);

  return {
    patient: sanitizePatient(patient, actor, { includeSensitive: canViewSensitivePatientFields(actor) }),
    account_status: account?.status || null,
    primary_identifiers: canReadIdentifiers ? identifiers.map(sanitizeIdentifier) : undefined,
    active_allergies: canReadClinical ? activeAllergies : undefined,
    active_problems: canReadClinical ? activeProblems : undefined,
    upcoming_appointment: canReadAppointments ? upcomingAppointment : undefined,
    last_encounter: canReadClinical ? lastEncounter : undefined,
    last_prescription: canReadPrescriptions ? lastPrescription : undefined,
    billing_summary: canReadBilling
      ? {
        unpaid_invoices_count: unpaidInvoiceSummary[0]?.count || 0,
        balance_due: unpaidInvoiceSummary[0]?.balance_due || 0,
      }
      : undefined,
  };
}

async function checkPatientCanBookAppointment(patientId, payload = {}, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  const reasons = [];

  if (patient.status !== PATIENT_STATUS.ACTIVE) {
    reasons.push('Bệnh nhân hiện không ở trạng thái active.');
  }

  if (isPatientActor(actor) && !idsEqual(actor.patientId, patient._id)) {
    reasons.push('Bệnh nhân chỉ được tự đặt lịch cho chính mình.');
  }

  if (payload.appointment_time) {
    const appointmentTime = normalizeDateValue(payload.appointment_time, 'appointment_time');
    const duplicateFilter = {
      patient_id: patient._id,
      appointment_time: {
        $gte: getStartOfDay(appointmentTime),
        $lte: getEndOfDay(appointmentTime),
      },
      is_deleted: false,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    };
    if (payload.doctor_id) duplicateFilter.doctor_id = payload.doctor_id;
    if (payload.department_id) duplicateFilter.department_id = payload.department_id;
    const duplicate = await Appointment.findOne(duplicateFilter).lean();
    if (duplicate) {
      reasons.push('Bệnh nhân đã có lịch hẹn đang active trong cùng ngày/khoa/bác sĩ.');
    }
  }

  if (payload.schedule_slot_id) {
    const slotDuplicate = await Appointment.findOne({
      patient_id: patient._id,
      schedule_slot_id: payload.schedule_slot_id,
      is_deleted: false,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }).lean();
    if (slotDuplicate) {
      reasons.push('Bệnh nhân đã có lịch hẹn trong slot này.');
    }
  }

  if (reasons.length > 0 && !payload.return_result_only) {
    throw createError(reasons[0], 409);
  }

  return {
    patient_id: toId(patient._id),
    status: patient.status,
    can_book: reasons.length === 0,
    reasons,
  };
}

async function countMergeImpact(sourcePatientId) {
  const entries = await Promise.all(
    MERGE_PATIENT_ID_MODELS.map(async ([name, Model]) => [name, await Model.countDocuments({ patient_id: sourcePatientId })]),
  );
  return Object.fromEntries(entries);
}

async function checkPatientCanBeMerged(sourcePatientId, targetPatientId, actor = {}) {
  if (!sourcePatientId || !targetPatientId) {
    throw createError('source_patient_id và target_patient_id là bắt buộc.', 422);
  }
  if (idsEqual(sourcePatientId, targetPatientId)) {
    throw createError('Không thể merge một hồ sơ vào chính nó.', 409);
  }

  const [source, target] = await Promise.all([
    Patient.findById(sourcePatientId).lean(),
    Patient.findById(targetPatientId).lean(),
  ]);

  if (!source || source.is_deleted || !target || target.is_deleted) {
    throw createError('Không tìm thấy một trong hai hồ sơ bệnh nhân.', 404);
  }

  await assertCanReadPatient(source._id, actor, { allowLimited: false });
  await assertCanReadPatient(target._id, actor, { allowLimited: false });

  const blockers = [];
  const conflicts = [];
  const warnings = [];

  if (source.status === PATIENT_STATUS.MERGED) blockers.push({ type: 'source_already_merged' });
  if (target.status !== PATIENT_STATUS.ACTIVE) blockers.push({ type: 'target_not_active', status: target.status });

  const [activeEncounters, activeAdmissions, targetActiveAdmissions, openInvoices, sourceAccount, targetAccount, sourceIdentifiers, targetIdentifiers] = await Promise.all([
    Encounter.countDocuments({ patient_id: source._id, status: { $in: ACTIVE_ENCOUNTER_STATUSES } }),
    Admission.countDocuments({ patient_id: source._id, status: { $in: ACTIVE_ADMISSION_STATUSES } }),
    Admission.countDocuments({ patient_id: target._id, status: { $in: ACTIVE_ADMISSION_STATUSES } }),
    Invoice.countDocuments({ patient_id: source._id, status: { $in: OPEN_INVOICE_STATUSES }, balance_due: { $gt: 0 } }),
    PatientAccount.findOne({ patient_id: source._id, is_deleted: false }).lean(),
    PatientAccount.findOne({ patient_id: target._id, is_deleted: false }).lean(),
    PatientIdentifier.find({ patient_id: source._id, is_deleted: false }).lean(),
    PatientIdentifier.find({ patient_id: target._id, is_deleted: false }).lean(),
  ]);

  if (activeEncounters) blockers.push({ type: 'source_active_encounters', count: activeEncounters });
  if (activeAdmissions) blockers.push({ type: 'source_active_admissions', count: activeAdmissions });
  if (targetActiveAdmissions) blockers.push({ type: 'target_active_admissions', count: targetActiveAdmissions });
  if (openInvoices) blockers.push({ type: 'source_unpaid_invoices', count: openInvoices });
  if (sourceAccount && targetAccount) blockers.push({ type: 'both_patients_have_portal_accounts' });

  const targetByType = targetIdentifiers.reduce((map, item) => {
    const bucket = map.get(item.identifier_type) || [];
    bucket.push(item.identifier_value);
    map.set(item.identifier_type, bucket);
    return map;
  }, new Map());

  sourceIdentifiers.forEach((identifier) => {
    const targetValues = targetByType.get(identifier.identifier_type) || [];
    if (targetValues.length > 0 && !targetValues.includes(identifier.identifier_value)) {
      conflicts.push({
        type: 'identifier_conflict',
        identifier_type: identifier.identifier_type,
        source_value: identifier.identifier_value,
        target_values: targetValues,
      });
    }
  });

  if (source.national_id && target.national_id && source.national_id !== target.national_id) {
    warnings.push({ type: 'national_id_differs', source_value: source.national_id, target_value: target.national_id });
  }
  if (source.insurance_number && target.insurance_number && source.insurance_number !== target.insurance_number) {
    warnings.push({ type: 'insurance_number_differs', source_value: source.insurance_number, target_value: target.insurance_number });
  }

  return {
    can_merge: blockers.length === 0,
    source_patient_id: toId(source._id),
    target_patient_id: toId(target._id),
    blockers,
    conflicts,
    warnings,
  };
}

async function previewPatientMerge(sourcePatientId, targetPatientId, actor = {}) {
  const mergeCheck = await checkPatientCanBeMerged(sourcePatientId, targetPatientId, actor);
  const [source, target, willMove, sourceIdentifiers, targetIdentifiers] = await Promise.all([
    Patient.findById(sourcePatientId).lean(),
    Patient.findById(targetPatientId).lean(),
    countMergeImpact(sourcePatientId),
    PatientIdentifier.find({ patient_id: sourcePatientId, is_deleted: false }).lean(),
    PatientIdentifier.find({ patient_id: targetPatientId, is_deleted: false }).lean(),
  ]);

  return {
    ...mergeCheck,
    source_patient: sanitizePatient(source, actor, { includeSensitive: true }),
    target_patient: sanitizePatient(target, actor, { includeSensitive: true }),
    will_move: willMove,
    source_identifiers: sourceIdentifiers.map(sanitizeIdentifier),
    target_identifiers: targetIdentifiers.map(sanitizeIdentifier),
    merged_preview: {
      patient_code: target.patient_code,
      full_name: target.full_name || source.full_name,
      phone: target.phone || source.phone,
      email: target.email || source.email,
      national_id: target.national_id || source.national_id,
      insurance_number: target.insurance_number || source.insurance_number,
    },
  };
}

function parseMergeArgs(sourceOrPayload, targetPatientId) {
  if (sourceOrPayload && typeof sourceOrPayload === 'object') {
    return {
      sourcePatientId: sourceOrPayload.source_patient_id || sourceOrPayload.sourcePatientId,
      targetPatientId: sourceOrPayload.target_patient_id || sourceOrPayload.targetPatientId,
      reason: sourceOrPayload.reason || sourceOrPayload.merge_reason,
      confirm: sourceOrPayload.confirm === true || sourceOrPayload.confirm_merge === true,
    };
  }
  return {
    sourcePatientId: sourceOrPayload,
    targetPatientId,
    reason: undefined,
    confirm: true,
  };
}

async function mergePatients(sourceOrPayload, targetPatientIdArg, actor = {}, requestMeta = {}) {
  const { sourcePatientId, targetPatientId, reason, confirm } = parseMergeArgs(sourceOrPayload, targetPatientIdArg);
  if (!confirm) {
    throw createError('Merge hồ sơ cần confirm_merge=true.', 409);
  }

  const check = await checkPatientCanBeMerged(sourcePatientId, targetPatientId, actor);
  if (!check.can_merge) {
    throw createError('Không thể merge hồ sơ bệnh nhân do còn blocker.', 409);
  }

  const source = await loadPatientOrThrow(sourcePatientId);
  const target = await loadPatientOrThrow(targetPatientId);
  const impact = await countMergeImpact(source._id);

  await withOptionalTransaction(async (session) => {
    const sourceIdentifiers = await withSession(PatientIdentifier.find({ patient_id: source._id, is_deleted: false }), session);
    for (const identifier of sourceIdentifiers) {
      const sameOnTarget = await withSession(PatientIdentifier.findOne({
        patient_id: target._id,
        identifier_type: identifier.identifier_type,
        identifier_value: identifier.identifier_value,
        is_deleted: false,
      }), session);
      if (sameOnTarget) {
        identifier.is_deleted = true;
        identifier.deleted_at = new Date();
        identifier.deleted_by = actor?.userId;
      } else {
        identifier.patient_id = target._id;
        identifier.is_primary = false;
      }
      identifier.updated_by = actor?.userId;
      await identifier.save(sessionOptions(session));
    }

    const sourceAccount = await withSession(PatientAccount.findOne({ patient_id: source._id, is_deleted: false }), session);
    const targetAccount = await withSession(PatientAccount.findOne({ patient_id: target._id, is_deleted: false }), session);
    if (sourceAccount && !targetAccount) {
      sourceAccount.patient_id = target._id;
      sourceAccount.updated_by = actor?.userId;
      await sourceAccount.save(sessionOptions(session));
    }

    for (const [, Model] of MERGE_PATIENT_ID_MODELS) {
      await Model.updateMany(
        { patient_id: source._id },
        { $set: { patient_id: target._id, updated_by: actor?.userId } },
        sessionOptions(session),
      );
    }

    const writableSource = await loadPatientOrThrow(source._id, session);
    writableSource.status = PATIENT_STATUS.MERGED;
    writableSource.merged_into_patient_id = target._id;
    writableSource.merged_at = new Date();
    writableSource.merged_by = actor?.userId;
    writableSource.merge_reason = reason;
    writableSource.updated_by = actor?.userId;
    await writableSource.save(sessionOptions(session));

    await recordAuditLog({
      actor,
      action: 'patient.merge',
      targetType: 'patient',
      targetId: target._id,
      status: 'success',
      message: 'Gộp hồ sơ bệnh nhân thành công.',
      requestMeta,
      before: { source: source.toObject(), target: target.toObject() },
      after: { source_patient_id: toId(source._id), target_patient_id: toId(target._id), impact },
      metadata: { source_patient_id: toId(source._id), target_patient_id: toId(target._id), reason, impact },
    });
  }, { fallbackToNoTransaction: true });

  return getPatientDetail(target._id, actor);
}

function pushTimeline(events, event) {
  if (!event.event_time) return;
  events.push(event);
}

async function getPatientTimeline(patientId, query = {}, actor = {}) {
  const patient = await loadPatientOrThrow(patientId);
  await assertCanReadPatient(patient._id, actor, {
    allowLimited: false,
    fullReadPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.MEDICAL_RECORDS.READ],
    assignedPermissions: [PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED],
  });

  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300);
  const patientPortalActor = isPatientActor(actor) || Boolean(actor.relativeId || actor.relative_id);
  const finalLabStatuses = [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].filter(Boolean);
  const finalImagingStatuses = [IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED].filter(Boolean);
  const releasedRecordStatuses = [MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED].filter(Boolean);

  const canReadAppointments = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.READ_ASSIGNED,
    PERMISSION.APPOINTMENTS.READ,
    PERMISSION.APPOINTMENTS.READ_OWN,
  ]) || isPatientActor(actor);
  const canReadEncounters = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.READ_ASSIGNED,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ENCOUNTERS.READ_ASSIGNED,
  ]) || isPatientActor(actor);
  const canReadLabResults = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.LAB_RESULTS.READ,
    PERMISSION.LAB_RESULTS.READ_FINAL,
  ]) || isPatientActor(actor);
  const canReadImagingReports = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.IMAGING_REPORTS.READ,
    PERMISSION.IMAGING_REPORTS.READ_FINAL,
  ]) || isPatientActor(actor);
  const canReadPrescriptions = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PRESCRIPTIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ_OWN,
  ]) || isPatientActor(actor);
  const canReadInvoices = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.INVOICES.READ,
    PERMISSION.INVOICES.SELF_READ,
  ]) || isPatientActor(actor);
  const canReadPayments = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.PAYMENTS.READ,
    PERMISSION.PAYMENTS.SELF_READ,
  ]) || isPatientActor(actor);
  const canReadRecords = hasAnyPermission(actor, [
    PERMISSION.PATIENTS.READ,
    PERMISSION.MEDICAL_RECORDS.READ,
    PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED,
  ]) || isPatientActor(actor);

  const labFilter = { patient_id: patient._id };
  if (patientPortalActor) {
    labFilter.released_to_patient = true;
    labFilter.status = { $in: finalLabStatuses };
  } else if (!hasAnyPermission(actor, [PERMISSION.PATIENTS.READ, PERMISSION.LAB_RESULTS.READ])) {
    labFilter.status = { $in: finalLabStatuses };
  }

  const imagingFilter = { patient_id: patient._id };
  if (patientPortalActor) {
    imagingFilter.released_to_patient = true;
    imagingFilter.status = { $in: finalImagingStatuses };
  } else if (!hasAnyPermission(actor, [PERMISSION.PATIENTS.READ, PERMISSION.IMAGING_REPORTS.READ])) {
    imagingFilter.status = { $in: finalImagingStatuses };
  }

  const recordFilter = { patient_id: patient._id };
  if (patientPortalActor) {
    recordFilter.released_to_patient = true;
    recordFilter.status = { $in: releasedRecordStatuses };
  }

  const [
    appointments,
    encounters,
    labResults,
    imagingReports,
    prescriptions,
    invoices,
    payments,
    records,
  ] = await Promise.all([
    canReadAppointments
      ? Appointment.find({ patient_id: patient._id, is_deleted: false }).sort({ appointment_time: -1 }).limit(limit).lean()
      : [],
    canReadEncounters
      ? Encounter.find({ patient_id: patient._id }).sort({ start_time: -1 }).limit(limit).lean()
      : [],
    canReadLabResults
      ? LabResult.find(labFilter).sort({ reported_at: -1, created_at: -1 }).limit(limit).lean()
      : [],
    canReadImagingReports
      ? ImagingReport.find(imagingFilter).sort({ reported_at: -1, created_at: -1 }).limit(limit).lean()
      : [],
    canReadPrescriptions
      ? Prescription.find({ patient_id: patient._id }).sort({ prescribed_at: -1 }).limit(limit).lean()
      : [],
    canReadInvoices
      ? Invoice.find({ patient_id: patient._id }).sort({ issued_at: -1, created_at: -1 }).limit(limit).lean()
      : [],
    canReadPayments
      ? Payment.find({ patient_id: patient._id }).sort({ paid_at: -1, created_at: -1 }).limit(limit).lean()
      : [],
    canReadRecords
      ? MedicalRecord.find(recordFilter).sort({ opened_at: -1, created_at: -1 }).limit(limit).lean()
      : [],
  ]);

  const events = [];
  pushTimeline(events, {
    event_type: 'patient_created',
    event_time: patient.created_at,
    module: 'patients',
    title: 'Tạo hồ sơ bệnh nhân',
    entity_id: toId(patient._id),
  });
  appointments.forEach((item) => pushTimeline(events, {
    event_type: `appointment_${item.status}`,
    event_time: item.appointment_time,
    module: 'appointments',
    title: 'Lịch hẹn',
    description: item.reason,
    entity_id: toId(item._id),
    status: item.status,
  }));
  encounters.forEach((item) => pushTimeline(events, {
    event_type: `encounter_${item.status}`,
    event_time: item.start_time,
    module: 'encounters',
    title: 'Lần khám',
    description: item.chief_reason,
    entity_id: toId(item._id),
    status: item.status,
  }));
  labResults.forEach((item) => pushTimeline(events, {
    event_type: `lab_result_${item.status}`,
    event_time: item.reported_at || item.created_at,
    module: 'laboratory',
    title: 'Kết quả xét nghiệm',
    entity_id: toId(item._id),
    status: item.status,
    released_to_patient: Boolean(item.released_to_patient),
  }));
  imagingReports.forEach((item) => pushTimeline(events, {
    event_type: `imaging_report_${item.status}`,
    event_time: item.reported_at || item.created_at,
    module: 'imaging',
    title: 'Báo cáo chẩn đoán hình ảnh',
    entity_id: toId(item._id),
    status: item.status,
    released_to_patient: Boolean(item.released_to_patient),
    is_critical: Boolean(item.is_critical),
  }));
  prescriptions.forEach((item) => pushTimeline(events, {
    event_type: `prescription_${item.status}`,
    event_time: item.prescribed_at,
    module: 'pharmacy',
    title: 'Đơn thuốc',
    entity_id: toId(item._id),
    status: item.status,
  }));
  invoices.forEach((item) => pushTimeline(events, {
    event_type: `invoice_${item.status}`,
    event_time: item.issued_at || item.created_at,
    module: 'billing',
    title: 'Hóa đơn',
    entity_id: toId(item._id),
    status: item.status,
  }));
  payments.forEach((item) => pushTimeline(events, {
    event_type: `payment_${item.status}`,
    event_time: item.paid_at || item.created_at,
    module: 'billing',
    title: 'Thanh toán',
    entity_id: toId(item._id),
    status: item.status,
  }));
  records.forEach((item) => pushTimeline(events, {
    event_type: `medical_record_${item.status}`,
    event_time: item.opened_at || item.created_at,
    module: 'medical_records',
    title: item.title || 'Hồ sơ bệnh án',
    entity_id: toId(item._id),
    status: item.status,
    released_to_patient: Boolean(item.released_to_patient),
  }));

  const sorted = events.sort((left, right) => new Date(right.event_time) - new Date(left.event_time));
  return {
    patient_id: toId(patient._id),
    items: sorted.slice(0, limit),
  };
}

module.exports = {
  // normalizePatientData: Chuẩn hóa dữ liệu bệnh nhân.
  normalizePatientData,
  // detectDuplicatePatients: Phát hiện bệnh nhân trùng lặp.
  detectDuplicatePatients,
  // validatePatientBeforeCreate: Kiểm tra tính hợp lệ của bệnh nhân trước khi tạo mới.
  validatePatientBeforeCreate,
  // lockVerifiedIdentityFields: Chặn sửa trực tiếp định danh đã xác minh.
  lockVerifiedIdentityFields,
  // createPatient: Tạo bệnh nhân.
  createPatient,
  // listPatients: Liệt kê bệnh nhân.
  listPatients,
  // searchPatients: Tìm kiếm bệnh nhân.
  searchPatients,
  // getPatientDetail: Lấy chi tiết bệnh nhân.
  getPatientDetail,
  // updatePatient: Cập nhật bệnh nhân.
  updatePatient,
  // updatePatientStatus: Cập nhật trạng thái bệnh nhân.
  updatePatientStatus,
  // archivePatient: Lưu trữ bệnh nhân.
  archivePatient,
  // mergePatients: Gộp bệnh nhân.
  mergePatients,
  // addPatientIdentifier: Thêm định danh bệnh nhân.
  addPatientIdentifier,
  // listPatientIdentifiers: Liệt kê định danh bệnh nhân.
  listPatientIdentifiers,
  // getPatientIdentifierDetail: Lấy chi tiết định danh bệnh nhân.
  getPatientIdentifierDetail,
  // updatePatientIdentifier: Cập nhật định danh bệnh nhân.
  updatePatientIdentifier,
  // removePatientIdentifier: Gỡ/xóa định danh bệnh nhân.
  removePatientIdentifier,
  // setPrimaryPatientIdentifier: Thiết lập định danh chính của bệnh nhân.
  setPrimaryPatientIdentifier,
  // validatePatientIdentifierUnique: Kiểm tra tính hợp lệ của tính duy nhất của định danh bệnh nhân.
  validatePatientIdentifierUnique,
  // createPatientAccountForPatient: Tạo tài khoản đăng nhập cho bệnh nhân.
  createPatientAccountForPatient,
  // linkUserAccountToPatient: Liên kết tài khoản người dùng với hồ sơ bệnh nhân.
  linkUserAccountToPatient,
  // getMyPatientProfile: Lấy hồ sơ bệnh nhân của người dùng hiện tại.
  getMyPatientProfile,
  // updateMyPatientProfile: Cập nhật hồ sơ bệnh nhân của người dùng hiện tại.
  updateMyPatientProfile,
  // addPatientRelative: Thêm người thân của bệnh nhân.
  addPatientRelative,
  // listPatientRelatives: Liệt kê người thân của bệnh nhân.
  listPatientRelatives,
  // getPatientRelativeDetail: Lấy chi tiết người thân của bệnh nhân.
  getPatientRelativeDetail,
  // updatePatientRelative: Cập nhật người thân của bệnh nhân.
  updatePatientRelative,
  // deletePatientRelativeSoft: Xóa mềm thông tin người thân của bệnh nhân.
  deletePatientRelativeSoft,
  // createPatientAuthorization: Tạo ủy quyền bệnh nhân.
  createPatientAuthorization,
  // grantRelativeAccess: Alias nghiệp vụ cho tạo/cấp ủy quyền người nhà.
  grantRelativeAccess: createPatientAuthorization,
  // listPatientAuthorizations: Liệt kê ủy quyền bệnh nhân.
  listPatientAuthorizations,
  // approvePatientAuthorization: Phê duyệt ủy quyền bệnh nhân.
  approvePatientAuthorization,
  // revokePatientAuthorization: Thu hồi ủy quyền bệnh nhân.
  revokePatientAuthorization,
  // revokeRelativeAccess: Alias nghiệp vụ cho thu hồi ủy quyền người nhà.
  revokeRelativeAccess: revokePatientAuthorization,
  // expireAuthorizations: Hết hạn các ủy quyền đã quá hạn và revoke session người nhà.
  expireAuthorizations,
  // checkRelativeAuthorization: Kiểm tra ủy quyền của người thân.
  checkRelativeAuthorization,
  // assertRelativeHasScope: Bắt buộc người thân có scope ủy quyền cụ thể.
  assertRelativeHasScope,
  // listPatientProblems: Liệt kê vấn đề sức khỏe của bệnh nhân.
  listPatientProblems,
  // addPatientProblem: Thêm vấn đề sức khỏe của bệnh nhân.
  addPatientProblem,
  // updatePatientProblem: Cập nhật vấn đề sức khỏe của bệnh nhân.
  updatePatientProblem,
  // resolvePatientProblem: Xác định/xử lý vấn đề sức khỏe của bệnh nhân.
  resolvePatientProblem,
  // listPatientAllergies: Liệt kê dị ứng của bệnh nhân.
  listPatientAllergies,
  // addPatientAllergy: Thêm dị ứng của bệnh nhân.
  addPatientAllergy,
  // updatePatientAllergy: Cập nhật dị ứng của bệnh nhân.
  updatePatientAllergy,
  // removePatientAllergy: Gỡ/xóa dị ứng của bệnh nhân.
  removePatientAllergy,
  // getPatientAppointmentHistory: Lấy lịch sử lịch hẹn của bệnh nhân.
  getPatientAppointmentHistory,
  // getPatientEncounterHistory: Lấy lịch sử lượt khám của bệnh nhân.
  getPatientEncounterHistory,
  // getPatientPrescriptionHistory: Lấy lịch sử đơn thuốc của bệnh nhân.
  getPatientPrescriptionHistory,
  // getPatientSummary: Lấy tổng hợp bệnh nhân.
  getPatientSummary,
  // checkPatientCanBeMerged: Kiểm tra điều kiện gộp hồ sơ bệnh nhân.
  checkPatientCanBeMerged,
  // previewPatientMerge: Xem trước gộp hồ sơ bệnh nhân.
  previewPatientMerge,
  // getPatientTimeline: Lấy dòng thời gian bệnh nhân.
  getPatientTimeline,
  // checkPatientCanBookAppointment: Kiểm tra điều kiện bệnh nhân đặt lịch hẹn.
  checkPatientCanBookAppointment,
};
