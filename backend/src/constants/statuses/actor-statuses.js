const ACTOR_TYPE = {
  STAFF: 'staff',
  PATIENT: 'patient',
  PATIENT_RELATIVE: 'patient_relative',
  SYSTEM: 'system',
  SERVICE_ACCOUNT: 'service_account',
};

const ACTOR_TYPES = Object.values(ACTOR_TYPE);

const LEGACY_ACTOR_TYPE = {
  RELATIVE: 'relative',
};

const ACTOR_TYPE_ALIASES = {
  [LEGACY_ACTOR_TYPE.RELATIVE]: ACTOR_TYPE.PATIENT_RELATIVE,
};

const AUTHENTICATED_ACTOR_TYPES = [
  ACTOR_TYPE.STAFF,
  ACTOR_TYPE.PATIENT,
  ACTOR_TYPE.PATIENT_RELATIVE,
];

function normalizeActorType(actorType) {
  const normalized = String(actorType || '').trim().toLowerCase();
  return ACTOR_TYPE_ALIASES[normalized] || normalized || null;
}

function isActorType(actorType, expectedType) {
  return normalizeActorType(actorType) === normalizeActorType(expectedType);
}

const ACCOUNT_TYPE = {
  STAFF: 'staff',
  PATIENT: 'patient',
  PATIENT_RELATIVE: 'patient_relative',
  SYSTEM: 'system',
  SERVICE_ACCOUNT: 'service_account',
};

const ACCOUNT_TYPES = Object.values(ACCOUNT_TYPE);

module.exports = {
  ACTOR_TYPE,
  ACTOR_TYPES,
  LEGACY_ACTOR_TYPE,
  ACTOR_TYPE_ALIASES,
  AUTHENTICATED_ACTOR_TYPES,
  normalizeActorType,
  isActorType,
  ACCOUNT_TYPE,
  ACCOUNT_TYPES,
};
