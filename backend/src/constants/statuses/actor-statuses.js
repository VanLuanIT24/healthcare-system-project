const ACTOR_TYPE = {
  STAFF: 'staff',
  PATIENT: 'patient',
  RELATIVE: 'relative',
  PATIENT_RELATIVE: 'patient_relative',
  SYSTEM: 'system',
};

const ACTOR_TYPES = Object.values(ACTOR_TYPE);

const ACCOUNT_TYPE = {
  STAFF: 'staff',
  PATIENT: 'patient',
  RELATIVE: 'relative',
  SYSTEM: 'system',
};

const ACCOUNT_TYPES = Object.values(ACCOUNT_TYPE);

module.exports = {
  ACTOR_TYPE,
  ACTOR_TYPES,
  ACCOUNT_TYPE,
  ACCOUNT_TYPES,
};
