const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

const GENDERS = Object.values(GENDER);

const PATIENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DECEASED: 'deceased',
  MERGED: 'merged',
  ARCHIVED: 'archived',
};

const PATIENT_STATUSES = Object.values(PATIENT_STATUS);

const IDENTIFIER_TYPE = {
  MRN: 'mrn',
  NATIONAL_ID: 'national_id',
  PASSPORT: 'passport',
  INSURANCE_NO: 'insurance_no',
  EXTERNAL_SYSTEM_ID: 'external_system_id',
};

const IDENTIFIER_TYPES = Object.values(IDENTIFIER_TYPE);

const PATIENT_ACCOUNT_STATUS = {
  ACTIVE: 'active',
  PENDING_VERIFICATION: 'pending_verification',
  LOCKED: 'locked',
  DISABLED: 'disabled',
};

const PATIENT_ACCOUNT_STATUSES = Object.values(PATIENT_ACCOUNT_STATUS);

const RELATIVE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
};

const RELATIVE_STATUSES = Object.values(RELATIVE_STATUS);

const AUTHORIZATION_TYPE = {
  VIEW_RECORDS: 'view_records',
  BOOK_APPOINTMENTS: 'book_appointments',
  BILLING: 'billing',
  RECEIVE_NOTIFICATIONS: 'receive_notifications',
  FULL_ACCESS: 'full_access',
  APPOINTMENT_READ: 'appointment.read',
  APPOINTMENT_MANAGE: 'appointment.manage',
  BILLING_READ: 'billing.read',
  BILLING_PAY: 'billing.pay',
  RECORD_READ: 'record.read',
  LAB_RESULT_READ: 'lab_result.read',
  IMAGING_REPORT_READ: 'imaging_report.read',
  PRESCRIPTION_READ: 'prescription.read',
  MESSAGE_SEND: 'message.send',
  EMERGENCY_CREATE: 'emergency.create',
  INSURANCE_READ: 'insurance.read',
};

const AUTHORIZATION_TYPES = Object.values(AUTHORIZATION_TYPE);

const AUTHORIZATION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
};

const AUTHORIZATION_STATUSES = Object.values(AUTHORIZATION_STATUS);

const PATIENT_PROFILE_CHANGE_TYPE = {
  BASIC_INFO: 'basic_info',
  CONTACT: 'contact',
  ADDRESS: 'address',
  IDENTITY: 'identity',
  EMERGENCY_CONTACT: 'emergency_contact',
};

const PATIENT_PROFILE_CHANGE_TYPES = Object.values(PATIENT_PROFILE_CHANGE_TYPE);

const PATIENT_PROFILE_CHANGE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const PATIENT_PROFILE_CHANGE_STATUSES = Object.values(PATIENT_PROFILE_CHANGE_STATUS);

module.exports = {
  GENDER,
  GENDERS,
  PATIENT_STATUS,
  PATIENT_STATUSES,
  IDENTIFIER_TYPE,
  IDENTIFIER_TYPES,
  PATIENT_ACCOUNT_STATUS,
  PATIENT_ACCOUNT_STATUSES,
  RELATIVE_STATUS,
  RELATIVE_STATUSES,
  AUTHORIZATION_TYPE,
  AUTHORIZATION_TYPES,
  AUTHORIZATION_STATUS,
  AUTHORIZATION_STATUSES,
  PATIENT_PROFILE_CHANGE_TYPE,
  PATIENT_PROFILE_CHANGE_TYPES,
  PATIENT_PROFILE_CHANGE_STATUS,
  PATIENT_PROFILE_CHANGE_STATUSES,
};
