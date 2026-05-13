const PERMISSION_ACTION = {
  READ: 'read',
  READ_OWN: 'read_own',
  READ_DEPARTMENT: 'read_department',
  READ_ASSIGNED: 'read_assigned',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
  WRITE: 'write',
  PUBLISH: 'publish',
  APPROVE: 'approve',
  REJECT: 'reject',
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
  PRINT: 'print',
  LOCK: 'lock',
  UNLOCK: 'unlock',
  RESET_PASSWORD: 'reset_password',
  ASSIGN_ROLES: 'assign_roles',
  ASSIGN_PERMISSIONS: 'assign_permissions',
};

const PERMISSION_ACTIONS = Object.values(PERMISSION_ACTION);

module.exports = {
  PERMISSION_ACTION,
  PERMISSION_ACTIONS,
};
