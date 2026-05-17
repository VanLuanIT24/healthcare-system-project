const env = require('../../config/env');
const { parseGenericWebhook } = require('./base.provider');

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || '';
}

function publicPath(value) {
  const normalized = normalizeString(value);
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function isEnabled() {
  return Boolean(
    env.manualPaymentEnabled
    && env.momoPersonalQrEnabled
    && (env.momoPersonalQrImageUrl || env.momoPersonalQrImagePath),
  );
}

async function createPayment(intent) {
  if (!isEnabled()) {
    const error = new Error('Payment provider is disabled');
    error.statusCode = 503;
    throw error;
  }

  const qrImageUrl = publicPath(env.momoPersonalQrImageUrl || env.momoPersonalQrImagePath);
  return {
    checkout_url: qrImageUrl,
    qr_payload: qrImageUrl,
    qr_image_url: qrImageUrl,
    payment_note: intent.payment_note,
    receiver_phone: env.momoPersonalPhone,
    receiver_name: env.momoPersonalAccountName,
    provider_order_id: intent.provider_order_id,
    status: 'pending_manual_confirmation',
    raw_provider_response: {
      mode: 'momo_personal_static_qr',
      receiver_phone: env.momoPersonalPhone,
      receiver_name: env.momoPersonalAccountName,
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
