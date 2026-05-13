const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  LOCKED: 'locked',
  DISABLED: 'disabled',
};

const USER_STATUSES = Object.values(USER_STATUS);

const ROLE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

const ROLE_STATUSES = Object.values(ROLE_STATUS);

const DEPARTMENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

const DEPARTMENT_STATUSES = Object.values(DEPARTMENT_STATUS);

const DOCTOR_PROFILE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  RETIRED: 'retired',
};

const DOCTOR_PROFILE_STATUSES = Object.values(DOCTOR_PROFILE_STATUS);

const SYSTEM_SETTING_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

const SYSTEM_SETTING_STATUSES = Object.values(SYSTEM_SETTING_STATUS);

const SYSTEM_SETTING_VALUE_TYPE = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json',
  ARRAY: 'array',
};

const SYSTEM_SETTING_VALUE_TYPES = Object.values(SYSTEM_SETTING_VALUE_TYPE);

module.exports = {
  USER_STATUS,
  USER_STATUSES,
  ROLE_STATUS,
  ROLE_STATUSES,
  DEPARTMENT_STATUS,
  DEPARTMENT_STATUSES,
  DOCTOR_PROFILE_STATUS,
  DOCTOR_PROFILE_STATUSES,
  SYSTEM_SETTING_STATUS,
  SYSTEM_SETTING_STATUSES,
  SYSTEM_SETTING_VALUE_TYPE,
  SYSTEM_SETTING_VALUE_TYPES,
};
