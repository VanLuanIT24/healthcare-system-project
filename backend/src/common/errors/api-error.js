const ERROR_CODE = require('./error-codes');

class ApiError extends Error {
  constructor(statusCode, message, code = ERROR_CODE.ERROR, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details = null, code = ERROR_CODE.BAD_REQUEST) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Unauthorized', details = null, code = ERROR_CODE.UNAUTHORIZED) {
    return new ApiError(401, message, code, details);
  }

  static forbidden(message = 'Forbidden', details = null, code = ERROR_CODE.FORBIDDEN) {
    return new ApiError(403, message, code, details);
  }

  static notFound(message = 'Resource not found', details = null, code = ERROR_CODE.NOT_FOUND) {
    return new ApiError(404, message, code, details);
  }

  static conflict(message = 'Conflict', details = null, code = ERROR_CODE.CONFLICT) {
    return new ApiError(409, message, code, details);
  }

  static validation(message = 'Validation failed', details = null, code = ERROR_CODE.VALIDATION_ERROR) {
    return new ApiError(422, message, code, details);
  }

  static tooManyRequests(message = 'Too many requests', details = null, code = ERROR_CODE.TOO_MANY_REQUESTS) {
    return new ApiError(429, message, code, details);
  }

  static databaseUnavailable(message = 'Database unavailable', details = null, code = ERROR_CODE.DATABASE_UNAVAILABLE) {
    return new ApiError(503, message, code, details);
  }

  static internal(message = 'Internal server error', details = null, code = ERROR_CODE.INTERNAL_SERVER_ERROR) {
    return new ApiError(500, message, code, details);
  }

  static withCode(statusCode, code, message = 'Request failed', details = null) {
    return new ApiError(statusCode, message, code || ERROR_CODE.ERROR, details);
  }
}

module.exports = ApiError;
