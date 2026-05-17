const ApiError = require('./api-error');

function createError(statusCode = 500, message = 'Internal server error', details = null, code = null) {
  if (code) return ApiError.withCode(statusCode, code, message, details);
  if (statusCode === 400) return ApiError.badRequest(message, details);
  if (statusCode === 401) return ApiError.unauthorized(message, details);
  if (statusCode === 403) return ApiError.forbidden(message, details);
  if (statusCode === 404) return ApiError.notFound(message, details);
  if (statusCode === 409) return ApiError.conflict(message, details);
  if (statusCode === 422) return ApiError.validation(message, details);
  if (statusCode === 429) return ApiError.tooManyRequests(message, details);
  if (statusCode === 503) return ApiError.databaseUnavailable(message, details);
  return ApiError.internal(message, details);
}

module.exports = {
  createError,
};
