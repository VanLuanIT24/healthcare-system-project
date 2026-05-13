const AUTH_SESSION_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
};

const AUTH_SESSION_STATUSES = Object.values(AUTH_SESSION_STATUS);

const PASSWORD_RESET_TOKEN_STATUS = {
  ACTIVE: 'active',
  USED: 'used',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
};

const PASSWORD_RESET_TOKEN_STATUSES = Object.values(PASSWORD_RESET_TOKEN_STATUS);

const AUDIT_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
};

const AUDIT_STATUSES = Object.values(AUDIT_STATUS);

const AUDIT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

const AUDIT_SEVERITIES = Object.values(AUDIT_SEVERITY);

const AUDIT_ACTION = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  SOFT_DELETE: 'soft_delete',
  RESTORE: 'restore',
  LOGIN: 'login',
  LOGOUT: 'logout',
  REFRESH_TOKEN: 'refresh_token',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
  PASSWORD_RESET_COMPLETE: 'password_reset_complete',
  ASSIGN_ROLE: 'assign_role',
  REMOVE_ROLE: 'remove_role',
  ASSIGN_PERMISSION: 'assign_permission',
  REMOVE_PERMISSION: 'remove_permission',
  PUBLISH: 'publish',
  CANCEL: 'cancel',
  COMPLETE: 'complete',
  SIGN: 'sign',
  AMEND: 'amend',
  VERIFY: 'verify',
  FINALIZE: 'finalize',
  ISSUE: 'issue',
  PAY: 'pay',
  REFUND: 'refund',
  VOID: 'void',
  EXPORT: 'export',
};

const AUDIT_ACTIONS = Object.values(AUDIT_ACTION);

module.exports = {
  AUTH_SESSION_STATUS,
  AUTH_SESSION_STATUSES,
  PASSWORD_RESET_TOKEN_STATUS,
  PASSWORD_RESET_TOKEN_STATUSES,
  AUDIT_STATUS,
  AUDIT_STATUSES,
  AUDIT_SEVERITY,
  AUDIT_SEVERITIES,
  AUDIT_ACTION,
  AUDIT_ACTIONS,
};
