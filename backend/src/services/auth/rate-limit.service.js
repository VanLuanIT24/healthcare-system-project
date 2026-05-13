const ApiError = require('../../common/errors/api-error');

const buckets = new Map();

const DEFAULT_LIMITS = {
  loginIp: { limit: 30, windowMs: 15 * 60 * 1000 },
  loginIdentifier: { limit: 10, windowMs: 15 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  publicAuthEndpoint: { limit: 60, windowMs: 15 * 60 * 1000 },
  otp: { limit: 5, windowMs: 10 * 60 * 1000 },
};

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function pruneBucket(bucket, now) {
  while (bucket.length && bucket[0] <= now) {
    bucket.shift();
  }
}

function consumeRateLimit(key, options, message) {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return true;

  const now = Date.now();
  const resetAt = now + options.windowMs;
  const bucketKey = `${options.scope}:${normalizedKey}`;
  const bucket = buckets.get(bucketKey) || [];
  pruneBucket(bucket, now);

  if (bucket.length >= options.limit) {
    throw ApiError.tooManyRequests(message || 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', {
      key: options.scope,
      retry_after_seconds: Math.ceil((bucket[0] - now) / 1000),
    });
  }

  bucket.push(resetAt);
  buckets.set(bucketKey, bucket);
  return true;
}

function checkRateLimit(scope, key, options = {}, message) {
  return consumeRateLimit(key, {
    scope,
    ...DEFAULT_LIMITS.publicAuthEndpoint,
    ...options,
  }, message);
}

function checkLoginRateLimitByIp(ip, options = {}) {
  return consumeRateLimit(ip, {
    scope: 'login:ip',
    ...DEFAULT_LIMITS.loginIp,
    ...options,
  }, 'Quá nhiều lần đăng nhập từ IP này. Vui lòng thử lại sau.');
}

function checkLoginRateLimitByIdentifier(identifier, actorType, options = {}) {
  return consumeRateLimit(`${actorType}:${identifier}`, {
    scope: 'login:identifier',
    ...DEFAULT_LIMITS.loginIdentifier,
    ...options,
  }, 'Quá nhiều lần đăng nhập cho tài khoản này. Vui lòng thử lại sau.');
}

function checkPasswordResetRateLimit(identifier, actorType, options = {}) {
  return consumeRateLimit(`${actorType}:${identifier}`, {
    scope: 'password-reset',
    ...DEFAULT_LIMITS.passwordReset,
    ...options,
  }, 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.');
}

function checkOtpRateLimit(identifier, purpose = 'otp', options = {}) {
  return consumeRateLimit(`${purpose}:${identifier}`, {
    scope: 'otp',
    ...DEFAULT_LIMITS.otp,
    ...options,
  }, 'Quá nhiều yêu cầu OTP. Vui lòng thử lại sau.');
}

function resetRateLimitForTests() {
  buckets.clear();
}

module.exports = {
  // checkRateLimit: Kiểm tra giới hạn tần suất chung theo scope/key.
  checkRateLimit,
  // checkLoginRateLimitByIp: Kiểm tra giới hạn đăng nhập theo IP.
  checkLoginRateLimitByIp,
  // checkLoginRateLimitByIdentifier: Kiểm tra giới hạn đăng nhập theo định danh.
  checkLoginRateLimitByIdentifier,
  // checkPasswordResetRateLimit: Kiểm tra giới hạn yêu cầu đặt lại mật khẩu.
  checkPasswordResetRateLimit,
  // checkOtpRateLimit: Kiểm tra giới hạn gửi OTP.
  checkOtpRateLimit,
  // resetRateLimitForTests: Reset bộ đếm rate limit phục vụ kiểm thử.
  resetRateLimitForTests,
};
