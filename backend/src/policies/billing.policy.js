const { PERMISSION } = require('../constants/permissions');
const { allow, deny, sameId, actorType, hasAnyPermission } = require('./policy-decision');

function canPayInvoice(actor = {}, invoice = {}) {
  if (actorType(actor) === 'patient') {
    return sameId(invoice.patient_id, actor.patientId || actor.patient_id) ? allow() : deny('invoice_patient_scope_denied');
  }
  if (actorType(actor) === 'staff' && hasAnyPermission(actor, [
    PERMISSION.PAYMENTS.CREATE,
    PERMISSION.PAYMENTS.REFUND,
    PERMISSION.PAYMENTS.REVERSE,
    PERMISSION.SYSTEM.FULL_ACCESS,
  ])) return allow();
  return deny('invoice_pay_denied');
}

function canReadInvoice(actor = {}, invoice = {}) {
  if (actorType(actor) === 'patient') {
    return sameId(invoice.patient_id, actor.patientId || actor.patient_id) ? allow() : deny('invoice_patient_scope_denied');
  }
  if (actorType(actor) !== 'staff') return deny('unsupported_actor');
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.INVOICES.READ])) return allow();
  if (hasAnyPermission(actor, [PERMISSION.INVOICES.READ_UNPAID]) && Number(invoice.balance_due || 0) > 0) return allow();
  return deny('invoice_read_denied');
}

module.exports = {
  canPayInvoice,
  canReadInvoice,
};
