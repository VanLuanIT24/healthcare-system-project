const ApiError = require('../errors/api-error');
const actorContext = require('../actors');
const permissionChecker = require('../permissions');
const { PatientAuthorization } = require('../../models');
const { AUTHORIZATION_STATUS, AUTHORIZATION_TYPE } = require('../../constants/statuses');
const { PERMISSION } = require('../../constants/permissions');

const DATA_SCOPE = {
  ALL: 'all',
  SELF: 'self',
  OWN: 'own',
  ASSIGNED: 'assigned',
  DEPARTMENT: 'department',
  RELATIVE_AUTHORIZED: 'relative_authorized',
};

const RESOURCE_SCOPE_RULES = {
  'patient:self': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['_id', 'id', 'patient_id', 'patientId'],
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'department:own': {
    scopes: [DATA_SCOPE.DEPARTMENT],
    departmentFields: ['_id', 'id', 'department_id', 'departmentId'],
    broadPermissions: [PERMISSION.DEPARTMENTS.READ],
  },
  'doctor:own': {
    scopes: [DATA_SCOPE.OWN],
    ownerFields: ['_id', 'id', 'user_id', 'doctor_id', 'attending_doctor_id'],
  },
  'appointment:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.DEPARTMENT],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['doctor_id'],
    departmentFields: ['department_id'],
    broadPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.REPORTS.APPOINTMENTS_READ],
  },
  'encounter:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.ASSIGNED, DATA_SCOPE.DEPARTMENT],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['attending_doctor_id', 'doctor_id'],
    assignedFields: ['attending_doctor_id', 'assigned_doctor_id', 'assigned_to'],
    departmentFields: ['department_id'],
    broadPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.REPORTS.ENCOUNTERS_READ],
  },
  'invoice:read': {
    scopes: [DATA_SCOPE.SELF],
    patientFields: ['patient_id', 'patientId'],
    broadPermissions: [PERMISSION.INVOICES.READ],
  },
  'payment:read': {
    scopes: [DATA_SCOPE.SELF],
    patientFields: ['patient_id', 'patientId'],
    broadPermissions: [PERMISSION.PAYMENTS.READ],
  },
  'lab_result:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.ASSIGNED, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['performed_by', 'verified_by', 'reported_by', 'ordered_by', 'created_by'],
    assignedFields: ['ordered_by', 'doctor_id', 'attending_doctor_id', 'assigned_doctor_id'],
    departmentFields: ['department_id', 'departmentId', 'ordering_department_id', 'lab_department_id'],
    broadPermissions: [PERMISSION.LAB_RESULTS.READ],
    requirePatientRelease: true,
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'imaging_report:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.ASSIGNED, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['radiologist_id', 'technician_id', 'verified_by', 'created_by'],
    assignedFields: ['radiologist_id', 'doctor_id', 'attending_doctor_id', 'assigned_doctor_id'],
    departmentFields: ['department_id', 'departmentId', 'ordering_department_id', 'imaging_department_id'],
    broadPermissions: [PERMISSION.IMAGING_REPORTS.READ],
    requirePatientRelease: true,
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'prescription:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['prescribed_by', 'verified_by', 'created_by'],
    departmentFields: ['department_id', 'departmentId'],
    broadPermissions: [PERMISSION.PRESCRIPTIONS.READ],
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'medical_record:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.ASSIGNED, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['finalized_by', 'created_by'],
    assignedFields: ['attending_doctor_id', 'assigned_doctor_id', 'doctor_id'],
    departmentFields: ['custodian_department_id', 'department_id', 'departmentId'],
    broadPermissions: [PERMISSION.MEDICAL_RECORDS.READ],
    requirePatientRelease: true,
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'attachment:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['uploaded_by', 'created_by'],
    departmentFields: ['department_id', 'departmentId', 'custodian_department_id'],
    broadPermissions: [PERMISSION.ATTACHMENTS.READ],
    requirePatientRelease: true,
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'order:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.ASSIGNED, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['ordered_by', 'created_by'],
    assignedFields: ['ordered_by', 'doctor_id', 'attending_doctor_id'],
    departmentFields: ['department_id', 'departmentId'],
    broadPermissions: [PERMISSION.ORDERS.READ],
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'admission:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.ASSIGNED, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['attending_doctor_id', 'admitted_by', 'discharged_by'],
    assignedFields: ['attending_doctor_id', 'assigned_doctor_id'],
    departmentFields: ['department_id', 'departmentId'],
    broadPermissions: [PERMISSION.ADMISSIONS.READ],
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'dispense:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['dispensed_by', 'completed_by', 'created_by'],
    departmentFields: ['department_id', 'departmentId', 'pharmacy_department_id'],
    broadPermissions: [PERMISSION.DISPENSES.READ],
    authorizationPermission: AUTHORIZATION_TYPE.VIEW_RECORDS,
  },
  'insurance_claim:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.DEPARTMENT, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    ownerFields: ['reviewed_by', 'created_by'],
    departmentFields: ['department_id', 'departmentId', 'billing_department_id'],
    broadPermissions: [PERMISSION.INSURANCE_CLAIMS.READ],
    authorizationPermission: AUTHORIZATION_TYPE.BILLING,
  },
  'notification:read': {
    scopes: [DATA_SCOPE.SELF, DATA_SCOPE.OWN, DATA_SCOPE.RELATIVE_AUTHORIZED],
    patientFields: ['patient_id', 'patientId'],
    accountFields: ['patient_account_id', 'patientAccountId'],
    ownerFields: ['recipient_user_id', 'recipientUserId'],
    relativeFields: ['relative_id', 'relativeId'],
    broadPermissions: [PERMISSION.NOTIFICATIONS.READ],
    authorizationPermission: AUTHORIZATION_TYPE.RECEIVE_NOTIFICATIONS,
  },
  'audit_log:read': {
    scopes: [DATA_SCOPE.OWN],
    ownerFields: ['actor_id', 'actorId', 'user_id', 'userId'],
    broadPermissions: [PERMISSION.AUDIT_LOGS.READ],
  },
};

function normalizeId(value) {
  return actorContext.normalizeId(value);
}

function idsEqual(left, right) {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

function firstMatchingField(resource = {}, fieldNames = []) {
  return fieldNames.find((fieldName) => resource[fieldName] !== undefined && resource[fieldName] !== null);
}

function readResourceField(resource = {}, fieldNames = []) {
  const fieldName = firstMatchingField(resource, fieldNames);
  return fieldName ? resource[fieldName] : null;
}

function isReleasedToPatient(resource = {}, options = {}) {
  const releaseFields = options.releaseFields || ['released_to_patient', 'releasedToPatient', 'is_released_to_patient'];
  const releasedValue = readResourceField(resource, releaseFields);
  if (releasedValue !== null) return releasedValue === true;
  return Boolean(readResourceField(resource, options.releaseDateFields || ['released_at', 'releasedAt']));
}

function releaseRequiredForScope(actor = {}, scope, options = {}) {
  if (!options.requirePatientRelease) return false;
  return (
    (scope === DATA_SCOPE.SELF && actorContext.isPatient(actor)) ||
    (scope === DATA_SCOPE.RELATIVE_AUTHORIZED && actorContext.isPatientRelative(actor))
  );
}

function isSystemActor(actor = {}) {
  return actorContext.isSystem(actor) || actorContext.isSuperAdmin(actor);
}

function isSelfScope(actor = {}, resource = {}, options = {}) {
  const patientValue = readResourceField(resource, options.patientFields || ['patient_id', 'patientId', '_id', 'id']);
  const accountValue = readResourceField(resource, options.accountFields || ['patient_account_id', 'patientAccountId', 'account_id', 'accountId']);

  return (
    idsEqual(actorContext.getPatientId(actor), patientValue) ||
    idsEqual(actorContext.getPatientAccountId(actor), accountValue)
  );
}

function isOwnScope(actor = {}, resource = {}, options = {}) {
  const ownerFields = options.ownerFields || [
    'created_by',
    'updated_by',
    'doctor_id',
    'attending_doctor_id',
    'ordered_by',
    'prescribed_by',
    'recorded_by',
    'performed_by',
    'user_id',
  ];
  return ownerFields.some((fieldName) => idsEqual(actorContext.getStaffId(actor), resource[fieldName]));
}

function isAssignedScope(actor = {}, resource = {}, options = {}) {
  const assignedFields = options.assignedFields || [
    'assigned_to',
    'assigned_user_id',
    'assigned_doctor_id',
    'doctor_id',
    'attending_doctor_id',
    'nurse_id',
  ];
  return assignedFields.some((fieldName) => idsEqual(actorContext.getStaffId(actor), resource[fieldName]));
}

function isDepartmentScope(actor = {}, resource = {}, options = {}) {
  const departmentFields = options.departmentFields || ['department_id', 'departmentId'];
  const actorDepartmentIds = actorContext.getDepartmentIds(actor);
  return departmentFields.some((fieldName) => {
    const resourceDepartmentId = normalizeId(resource[fieldName]);
    return Boolean(resourceDepartmentId && actorDepartmentIds.includes(resourceDepartmentId));
  });
}

async function isRelativeAuthorizedScope(actor = {}, resource = {}, options = {}) {
  const patientValue = readResourceField(resource, options.patientFields || ['patient_id', 'patientId', '_id', 'id']);
  const patientId = normalizeId(patientValue);
  const relativeId = actorContext.getRelativeId(actor);

  if (!patientId || !relativeId) return false;

  const relativeValue = readResourceField(resource, options.relativeFields || ['relative_id', 'relativeId']);
  if (relativeValue && !idsEqual(relativeId, relativeValue)) return false;

  const now = new Date();
  const filter = {
    patient_id: patientId,
    relative_id: relativeId,
    status: AUTHORIZATION_STATUS.ACTIVE,
    is_deleted: false,
    valid_from: { $lte: now },
    $and: [
      { $or: [{ valid_to: null }, { valid_to: { $exists: false } }, { valid_to: { $gte: now } }] },
    ],
  };

  if (options.authorizationPermission) {
    filter.$and.push({
      $or: [
        { authorization_type: AUTHORIZATION_TYPE.FULL_ACCESS },
        { authorization_type: options.authorizationPermission },
        { permissions: options.authorizationPermission },
      ],
    });
  }

  const authorization = await PatientAuthorization.findOne(filter).lean();
  return Boolean(authorization);
}

async function matchesScope(actor = {}, resource = {}, scope, options = {}) {
  if (isSystemActor(actor) || scope === DATA_SCOPE.ALL) return true;
  if (scope === DATA_SCOPE.SELF) {
    const matched = isSelfScope(actor, resource, options);
    return matched && (!releaseRequiredForScope(actor, scope, options) || isReleasedToPatient(resource, options));
  }
  if (scope === DATA_SCOPE.OWN) return isOwnScope(actor, resource, options);
  if (scope === DATA_SCOPE.ASSIGNED) return isAssignedScope(actor, resource, options);
  if (scope === DATA_SCOPE.DEPARTMENT) return isDepartmentScope(actor, resource, options);
  if (scope === DATA_SCOPE.RELATIVE_AUTHORIZED) {
    const matched = await isRelativeAuthorizedScope(actor, resource, options);
    return matched && (!releaseRequiredForScope(actor, scope, options) || isReleasedToPatient(resource, options));
  }
  return false;
}

async function hasAnyScope(actor = {}, resource = {}, scopes = [], options = {}) {
  for (const scope of scopes) {
    if (await matchesScope(actor, resource, scope, options)) return true;
  }
  return false;
}

async function assertScope(actor = {}, resource = {}, scopes = [], options = {}) {
  if (await hasAnyScope(actor, resource, scopes, options)) return true;
  throw ApiError.forbidden(options.message || 'Tài khoản hiện tại không có phạm vi truy cập dữ liệu này.');
}

function applyScopeFilter(actor = {}, baseFilter = {}, scope, options = {}) {
  if (isSystemActor(actor) || scope === DATA_SCOPE.ALL) return { ...baseFilter };

  if (scope === DATA_SCOPE.SELF) {
    return { ...baseFilter, [options.patientField || 'patient_id']: actorContext.getPatientId(actor) };
  }

  if (scope === DATA_SCOPE.OWN) {
    return { ...baseFilter, [options.ownerField || 'created_by']: actorContext.getStaffId(actor) };
  }

  if (scope === DATA_SCOPE.ASSIGNED) {
    return { ...baseFilter, [options.assignedField || 'assigned_to']: actorContext.getStaffId(actor) };
  }

  if (scope === DATA_SCOPE.DEPARTMENT) {
    return { ...baseFilter, [options.departmentField || 'department_id']: actorContext.getDepartmentId(actor) };
  }

  return { ...baseFilter };
}

async function assertPatientSelf(actor = {}, patientId, options = {}) {
  return assertScope(
    actor,
    { patient_id: patientId },
    [DATA_SCOPE.SELF, ...(options.allowRelative ? [DATA_SCOPE.RELATIVE_AUTHORIZED] : [])],
    {
      authorizationPermission: options.authorizationPermission || AUTHORIZATION_TYPE.VIEW_RECORDS,
      message: options.message || 'Bạn chỉ được truy cập dữ liệu của chính bệnh nhân này.',
    },
  );
}

function assertDepartmentScope(actor = {}, departmentId, options = {}) {
  if (isSystemActor(actor)) return true;
  if (permissionChecker.hasAnyPermission(actor, options.broadPermissions || [])) return true;
  if (!actorContext.getDepartmentIds(actor).includes(normalizeId(departmentId))) {
    throw ApiError.forbidden(options.message || 'Bạn chỉ được truy cập dữ liệu thuộc department của mình.');
  }
  return true;
}

function assertDoctorOwnScope(actor = {}, doctorId, options = {}) {
  if (isSystemActor(actor)) return true;
  if (permissionChecker.hasAnyPermission(actor, options.broadPermissions || [])) return true;
  if (!idsEqual(actorContext.getStaffId(actor), doctorId)) {
    throw ApiError.forbidden(options.message || 'Bạn chỉ được truy cập dữ liệu bác sĩ của chính mình.');
  }
  return true;
}

async function assertNamedScope(actor = {}, resource = {}, scopeKey, options = {}) {
  const rule = {
    ...(RESOURCE_SCOPE_RULES[scopeKey] || {}),
    ...options,
  };

  if (!RESOURCE_SCOPE_RULES[scopeKey] && !rule.scopes) {
    throw ApiError.internal(`Scope rule chưa được cấu hình: ${scopeKey}`);
  }

  if (isSystemActor(actor) || permissionChecker.hasAnyPermission(actor, rule.broadPermissions || [])) {
    return true;
  }

  return assertScope(actor, resource, rule.scopes || [], {
    ...rule,
    message: rule.message || 'Tài khoản hiện tại không có scope truy cập dữ liệu này.',
  });
}

module.exports = {
  DATA_SCOPE,
  RESOURCE_SCOPE_RULES,
  normalizeId,
  idsEqual,
  firstMatchingField,
  actorStaffId: actorContext.getStaffId,
  actorPatientId: actorContext.getPatientId,
  actorDepartmentId: actorContext.getDepartmentId,
  hasRole: actorContext.hasRole,
  isSystemActor,
  isSelfScope,
  isOwnScope,
  isAssignedScope,
  isDepartmentScope,
  isRelativeAuthorizedScope,
  isReleasedToPatient,
  matchesScope,
  hasAnyScope,
  assertScope,
  applyScopeFilter,
  assertPatientSelf,
  assertDepartmentScope,
  assertDoctorOwnScope,
  assertAssignedEncounter: (actor, encounter, options = {}) => assertNamedScope(actor, encounter, 'encounter:read', options),
  assertNamedScope,
};
