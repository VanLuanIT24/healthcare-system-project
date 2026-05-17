const ApiError = require('../common/errors/api-error');
const ERROR_CODE = require('../common/errors/error-codes');
const { requestValidator } = require('./validator-result');
const { INVOICE_STATUS, PAYMENT_INTENT_STATUS } = require('../constants/statuses');

const PAYABLE_INVOICE_STATUSES = [
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
];

function validatePaymentIntentRequest(req) {
  const errors = [];
  if (req.body?.amount !== undefined && (!Number.isInteger(Number(req.body.amount)) || Number(req.body.amount) <= 0)) {
    errors.push({ target: 'body', field: 'amount', message: 'amount must be positive integer minor units.' });
  }
  if (req.body?.provider !== undefined && !String(req.body.provider).trim()) {
    errors.push({ target: 'body', field: 'provider', message: 'provider must not be empty.' });
  }
  return errors;
}

function assertInvoicePayable(invoice) {
  if (!invoice) throw ApiError.notFound('Không tìm thấy invoice.');
  if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
    throw ApiError.conflict('Invoice không ở trạng thái thanh toán.', {
      invoice_id: String(invoice._id || invoice.id),
      status: invoice.status,
    });
  }
  if (Number(invoice.balance_due || 0) <= 0) {
    throw ApiError.conflict('Invoice đã thanh toán đủ.');
  }
  return true;
}

function assertPaymentIntentActive(intent) {
  if (!intent) throw ApiError.notFound('Không tìm thấy payment intent.');
  if (intent.status === PAYMENT_INTENT_STATUS.EXPIRED || (intent.expires_at && intent.expires_at <= new Date())) {
    throw ApiError.conflict('Payment intent đã hết hạn.', {
      payment_intent_id: String(intent._id || intent.id),
      expires_at: intent.expires_at,
    }, ERROR_CODE.PAYMENT_INTENT_EXPIRED);
  }
  return true;
}

function assertInvoicePaymentScope(actor = {}, invoice = {}) {
  const actorType = actor.actorType || actor.actor_type;
  if (actorType === 'patient' && String(invoice.patient_id) !== String(actor.patientId || actor.patient_id)) {
    throw ApiError.forbidden('Bạn chỉ được thanh toán invoice của chính mình.', null, ERROR_CODE.POLICY_DECISION_DENIED);
  }
  return true;
}

module.exports = {
  request: {
    validatePaymentIntentRequest,
    createPaymentIntent: requestValidator(validatePaymentIntentRequest),
  },
  business: {
    assertInvoicePayable,
  },
  state: {
    assertPaymentIntentActive,
  },
  scope: {
    assertInvoicePaymentScope,
  },
};
