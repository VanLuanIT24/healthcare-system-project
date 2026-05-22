const { AUDIT_SEVERITY, AUDIT_STATUS } = require('../constants/statuses');
const auditService = require('./audit.service');

const SENSITIVE_READ_ACTIONS = new Set([
  'medical_record.view',
  'medical_record.download',
  'attachment.download',
  'lab_result.view',
  'imaging_report.view',
  'prescription.view',
  'invoice.view',
  'patient_relative.access',
]);

const SENSITIVE_WRITE_ACTIONS = new Set([
  'message.clinical_advice',
  'break_glass.start',
  'break_glass.end',
  'break_glass.started',
  'break_glass.ended',
  'patient_relative.access_grant',
  'patient_relative.access_revoke',
]);

const PAYMENT_ACTIONS = new Set([
  'invoice.payment',
  'payment.intent_created',
  'payment.intent_provider_query',
  'payment.refund_requested',
  'payment.refund',
]);

function normalizeAction(action) {
  return String(action || '').trim().toLowerCase();
}

function severityForAction(action, fallback = AUDIT_SEVERITY.INFO) {
  const normalized = normalizeAction(action);
  if (SENSITIVE_WRITE_ACTIONS.has(normalized) || PAYMENT_ACTIONS.has(normalized)) {
    return AUDIT_SEVERITY.WARNING;
  }
  if (SENSITIVE_READ_ACTIONS.has(normalized)) return AUDIT_SEVERITY.INFO;
  return fallback;
}

function auditSensitiveRead({
  actor,
  action,
  targetType,
  targetId,
  requestMeta,
  metadata,
  message = 'Sensitive data read.',
}) {
  return auditService.recordAuditLog({
    actor,
    action,
    targetType,
    targetId,
    status: AUDIT_STATUS.SUCCESS,
    severity: severityForAction(action),
    message,
    requestMeta,
    metadata,
  });
}

function auditSensitiveWrite({
  actor,
  action,
  targetType,
  targetId,
  before,
  after,
  requestMeta,
  metadata,
  message = 'Sensitive data changed.',
}) {
  return auditService.recordAuditLog({
    actor,
    action,
    targetType,
    targetId,
    status: AUDIT_STATUS.SUCCESS,
    severity: severityForAction(action, AUDIT_SEVERITY.WARNING),
    message,
    before,
    after,
    requestMeta,
    metadata,
  });
}

function auditPaymentEvent({
  actor,
  action,
  targetType = 'payment',
  targetId,
  requestMeta,
  metadata,
  status = AUDIT_STATUS.SUCCESS,
  message = 'Payment audit event.',
}) {
  return auditService.recordAuditLog({
    actor,
    action,
    targetType,
    targetId,
    status,
    severity: status === AUDIT_STATUS.FAILURE ? AUDIT_SEVERITY.WARNING : severityForAction(action, AUDIT_SEVERITY.WARNING),
    message,
    requestMeta,
    metadata,
  });
}

function auditAccessDenied({
  actor,
  action = 'access.denied',
  targetType = 'route',
  targetId,
  requestMeta,
  metadata,
  message = 'Access denied by policy.',
}) {
  return auditService.recordAuditLog({
    actor,
    action,
    targetType,
    targetId,
    status: AUDIT_STATUS.FAILURE,
    severity: AUDIT_SEVERITY.WARNING,
    message,
    requestMeta,
    metadata,
  });
}

module.exports = {
  SENSITIVE_READ_ACTIONS,
  SENSITIVE_WRITE_ACTIONS,
  PAYMENT_ACTIONS,
  auditSensitiveRead,
  auditSensitiveWrite,
  auditPaymentEvent,
  auditAccessDenied,
};
