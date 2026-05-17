const env = require('../../config/env');
const { parseGenericWebhook } = require('./base.provider');

function isEnabled() {
  return Boolean(env.manualPaymentEnabled);
}

async function createPayment(intent) {
  if (!isEnabled()) {
    const error = new Error('Payment provider is disabled');
    error.statusCode = 503;
    throw error;
  }

  return {
    checkout_url: null,
    qr_payload: null,
    qr_image_url: null,
    payment_note: intent.payment_note,
    provider_order_id: intent.provider_order_id,
    status: 'pending_manual_confirmation',
    raw_provider_response: {
      mode: 'cash_manual',
    },
  };
}

function disabledExternalOperation() {
  const error = new Error('Payment provider is manual and has no external transaction API');
  error.statusCode = 400;
  throw error;
}

module.exports = {
  isEnabled,
  createPayment,
  verifyWebhookSignature: () => false,
  parseWebhook: parseGenericWebhook,
  queryTransaction: disabledExternalOperation,
  refund: disabledExternalOperation,
};
