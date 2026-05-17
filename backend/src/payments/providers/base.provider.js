const crypto = require('crypto');

function stableStringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return Object.keys(value)
    .sort()
    .map((key) => `${key}=${stableStringify(value[key])}`)
    .join('&');
}

function hmacHex(secret, value, algorithm = 'sha256') {
  return crypto.createHmac(algorithm, secret).update(String(value)).digest('hex');
}

function constantTimeEqual(left, right) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyHmacSignature({ secret, payload, signature, algorithm = 'sha256', signedPayload }) {
  if (!secret) throw new Error('payment_provider_secret_not_configured');
  const expected = hmacHex(secret, signedPayload || stableStringify(payload), algorithm);
  return constantTimeEqual(expected, signature);
}

function defaultCreatePayment(intent) {
  const checkoutUrl = `/billing/checkout/${intent.intent_code}`;
  return {
    checkout_url: checkoutUrl,
    qr_payload: JSON.stringify({
      provider: intent.provider,
      intent_code: intent.intent_code,
      invoice_id: String(intent.invoice_id),
      amount: intent.amount,
      currency: intent.currency,
    }),
    provider_order_id: intent.provider_order_id,
  };
}

async function postProviderJson(url, body, token, action = 'request') {
  if (!url) throw new Error(`payment_provider_${action}_url_not_configured`);
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`payment_provider_${action}_failed:${response.status}${text ? `:${text.slice(0, 200)}` : ''}`);
  }
  return response.json();
}

async function postCreatePayment(url, body, token) {
  return postProviderJson(url, body, token, 'create');
}

async function postQueryTransaction(url, body, token) {
  return postProviderJson(url, body, token, 'query');
}

async function postRefund(url, body, token) {
  return postProviderJson(url, body, token, 'refund');
}

function parseGenericWebhook(payload = {}) {
  return {
    provider_event_id: payload.provider_event_id || payload.event_id || payload.id,
    event_type: payload.event_type || payload.type || 'payment.updated',
    payment_intent_id: payload.payment_intent_id || payload.paymentIntentId,
    provider_order_id: payload.provider_order_id || payload.order_id || payload.orderId || payload.intent_code,
    provider_transaction_id: payload.provider_transaction_id || payload.transaction_id || payload.transId,
    status: payload.status || payload.payment_status || payload.result,
    amount: payload.amount ?? payload.paid_amount ?? payload.total_amount,
    currency: payload.currency,
    paid_at: payload.paid_at,
    failure_reason: payload.failure_reason || payload.message,
    raw: payload,
  };
}

module.exports = {
  stableStringify,
  verifyHmacSignature,
  defaultCreatePayment,
  postCreatePayment,
  postQueryTransaction,
  postRefund,
  parseGenericWebhook,
};
