const env = require('../../config/env');

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || '';
}

function resolveBankQrConfig(options = {}) {
  return {
    bankBin: normalizeString(options.bank_bin || options.bankBin || env.bankQrBankBin),
    accountNo: normalizeString(options.account_no || options.accountNo || env.bankQrAccountNo),
    accountName: normalizeString(options.account_name || options.accountName || env.bankQrAccountName),
    template: normalizeString(options.template || env.bankQrTemplate) || 'compact2',
  };
}

function isEnabled() {
  return Boolean(env.manualPaymentEnabled && env.bankQrBankBin && env.bankQrAccountNo);
}

function maskAccountNo(accountNo) {
  return String(accountNo || '').replace(/.(?=.{4})/g, '*');
}

async function createPayment(intent, options = {}) {
  const config = resolveBankQrConfig(options);
  if (!isEnabled() && (!config.bankBin || !config.accountNo)) {
    const error = new Error('Payment provider is disabled');
    error.statusCode = 503;
    throw error;
  }
  const addInfo = encodeURIComponent(intent.payment_note || intent.intent_code);
  const accountName = encodeURIComponent(config.accountName);
  const qrImageUrl = `https://img.vietqr.io/image/${config.bankBin}-${config.accountNo}-${config.template}.png?amount=${intent.amount}&addInfo=${addInfo}${accountName ? `&accountName=${accountName}` : ''}`;
  return {
    checkout_url: qrImageUrl,
    qr_payload: qrImageUrl,
    qr_image_url: qrImageUrl,
    payment_note: intent.payment_note,
    receiver_name: config.accountName,
    receiver_bank_bin: config.bankBin,
    receiver_account_no: config.accountNo,
    receiver_account_name: config.accountName,
    provider_order_id: intent.provider_order_id,
    status: 'pending_manual_confirmation',
    raw_provider_response: {
      mode: 'vietqr_static_payload_generated',
      bank_bin: config.bankBin,
      account_no_masked: maskAccountNo(config.accountNo),
      account_name: config.accountName,
      template: config.template,
    },
  };
}

function disabledExternalOperation() {
  const error = new Error('Bank QR manual provider does not support webhook, query, refund, or reconciliation APIs');
  error.statusCode = 400;
  throw error;
}

module.exports = {
  isEnabled,
  createPayment,
  resolveBankQrConfig,
  verifyWebhookSignature: () => false,
  parseWebhook: disabledExternalOperation,
  queryTransaction: disabledExternalOperation,
  refund: disabledExternalOperation,
};
