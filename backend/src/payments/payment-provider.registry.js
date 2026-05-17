const { PAYMENT_PROVIDER } = require('../constants/statuses');

const providers = {
  [PAYMENT_PROVIDER.BANK_QR_MANUAL]: require('./providers/bank-qr.provider'),
  [PAYMENT_PROVIDER.MOMO_PERSONAL_QR]: require('./providers/momo-personal-qr.provider'),
  [PAYMENT_PROVIDER.CASH_MANUAL]: require('./providers/cash-manual.provider'),
  [PAYMENT_PROVIDER.BANK_QR]: require('./providers/bank-qr.provider'),
};

const providerMetadata = {
  [PAYMENT_PROVIDER.BANK_QR_MANUAL]: { type: 'manual', public: true },
  [PAYMENT_PROVIDER.MOMO_PERSONAL_QR]: { type: 'manual', public: true },
  [PAYMENT_PROVIDER.CASH_MANUAL]: { type: 'manual', public: false },
  [PAYMENT_PROVIDER.BANK_QR]: { type: 'manual', public: false },
};

function providerError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = statusCode === 400 ? 'PAYMENT_PROVIDER_UNSUPPORTED' : 'PAYMENT_PROVIDER_DISABLED';
  return error;
}

function isProviderEnabled(provider) {
  const adapter = providers[provider];
  if (!adapter) return false;
  return typeof adapter.isEnabled === 'function' ? Boolean(adapter.isEnabled()) : true;
}

function getProvider(provider, options = {}) {
  const { requireEnabled = true } = options;
  const adapter = providers[provider];
  if (!adapter) throw providerError(`Unsupported payment provider: ${provider}`, 400);
  for (const method of ['createPayment', 'verifyWebhookSignature', 'parseWebhook', 'queryTransaction', 'refund']) {
    if (typeof adapter[method] !== 'function') {
      throw new Error(`Payment provider ${provider} is missing ${method}.`);
    }
  }
  if (requireEnabled && !isProviderEnabled(provider)) {
    throw providerError('Payment provider is disabled', 503);
  }
  return adapter;
}

function listProviders(options = {}) {
  const { includeDisabled = false, includePrivate = false } = options;
  return Object.keys(providers)
    .filter((provider) => includePrivate || providerMetadata[provider]?.public !== false)
    .map((provider) => ({
      provider,
      enabled: isProviderEnabled(provider),
      type: providerMetadata[provider]?.type || 'external',
    }))
    .filter((item) => includeDisabled || item.enabled);
}

module.exports = {
  getProvider,
  isProviderEnabled,
  listProviders,
};
