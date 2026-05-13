const ApiError = require('../errors/api-error');

const ACTOR_TYPES = new Set(['staff', 'patient']);

const AUTH_META_FIELDS = [
  'device_id',
  'deviceId',
  'device_name',
  'deviceName',
  'browser',
  'os',
  'location',
  'login_method',
  'loginMethod',
];

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function detail(field, message) {
  return {
    target: 'body',
    field,
    message,
  };
}

function hasAny(body, fields) {
  return fields.some((field) => !isBlank(body[field]));
}

function validateActorType(body, errors) {
  const actorType = body.actor_type || body.actorType;
  if (!isBlank(actorType) && !ACTOR_TYPES.has(String(actorType))) {
    errors.push(detail('actor_type', 'actor_type must be staff or patient.'));
  }
}

function validateBody({ allowed = [], required = [], requireAny = [] } = {}) {
  const allowedSet = new Set(allowed);

  return function authBodyValidator(req, res, next) {
    const body = req.body || {};
    const errors = [];
    const sanitized = {};

    Object.keys(body).forEach((field) => {
      if (!allowedSet.has(field)) {
        errors.push(detail(field, 'Unknown field is not allowed.'));
        return;
      }
      sanitized[field] = body[field];
    });

    required.forEach((field) => {
      if (isBlank(body[field])) {
        errors.push(detail(field, `${field} is required.`));
      }
    });

    requireAny.forEach((fields) => {
      if (!hasAny(body, fields)) {
        errors.push(detail(fields.join('|'), `One of ${fields.join(', ')} is required.`));
      }
    });

    validateActorType(body, errors);

    if (errors.length) {
      const error = ApiError.validation('Request validation failed', errors);
      error.legacyControllerResponse = true;
      return next(error);
    }

    req.body = sanitized;
    return next();
  };
}

const loginFields = ['login', 'username', 'identifier', 'password', ...AUTH_META_FIELDS];
const resetTokenFields = [
  'actor_type',
  'actorType',
  'token',
  'reset_token',
  'code',
  'reset_code',
  'login',
  'identifier',
  'email',
  'phone',
  'username',
];

module.exports = {
  staffLogin: validateBody({
    allowed: loginFields,
    requireAny: [['login', 'username', 'identifier']],
    required: ['password'],
  }),
  patientLogin: validateBody({
    allowed: loginFields,
    requireAny: [['login', 'username', 'identifier']],
    required: ['password'],
  }),
  patientRegister: validateBody({
    allowed: [
      'full_name',
      'password',
      'confirm_password',
      'email',
      'phone',
      'username',
      'date_of_birth',
      'gender',
      'address',
      'national_id',
      'insurance_number',
      'emergency_contact_name',
      'emergency_contact_phone',
      ...AUTH_META_FIELDS,
    ],
    required: ['full_name', 'password'],
  }),
  passwordValidate: validateBody({
    allowed: ['password', 'username', 'email', 'phone', 'actor_type', 'actorType'],
    required: ['password'],
  }),
  forgotPassword: validateBody({
    allowed: ['actor_type', 'actorType', 'login', 'identifier', 'email', 'phone', 'username'],
    requireAny: [['login', 'identifier', 'email', 'phone', 'username']],
  }),
  verifyResetToken: validateBody({
    allowed: resetTokenFields,
    requireAny: [['token', 'reset_token', 'code', 'reset_code']],
  }),
  resetPassword: validateBody({
    allowed: [...resetTokenFields, 'new_password', 'newPassword', 'password'],
    requireAny: [
      ['token', 'reset_token', 'code', 'reset_code'],
      ['new_password', 'newPassword', 'password'],
    ],
  }),
  refreshToken: validateBody({
    allowed: ['refresh_token'],
    required: ['refresh_token'],
  }),
  logout: validateBody({
    allowed: ['refresh_token'],
  }),
  changePassword: validateBody({
    allowed: ['current_password', 'currentPassword', 'new_password', 'newPassword'],
    requireAny: [['current_password', 'currentPassword'], ['new_password', 'newPassword']],
  }),
  revokeSession: validateBody({
    allowed: ['refresh_token', 'session_id'],
    requireAny: [['refresh_token', 'session_id']],
  }),
  renameSessionDevice: validateBody({
    allowed: ['device_name', 'deviceName'],
    requireAny: [['device_name', 'deviceName']],
  }),
  updatePatientEmail: validateBody({
    allowed: ['email', 'patient_account_id', 'patientAccountId', 'account_id'],
    required: ['email'],
  }),
  updatePatientPhone: validateBody({
    allowed: ['phone', 'patient_account_id', 'patientAccountId', 'account_id'],
    required: ['phone'],
  }),
  updatePatientUsername: validateBody({
    allowed: ['username', 'patient_account_id', 'patientAccountId', 'account_id'],
    required: ['username'],
  }),
  createPatientAccount: validateBody({
    allowed: ['patient_id', 'patientId', 'password', 'temporary_password', 'email', 'phone', 'username'],
    requireAny: [['patient_id', 'patientId'], ['password', 'temporary_password'], ['username', 'email', 'phone']],
  }),
};
