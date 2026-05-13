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

  static badRequest(message = 'Bad request', details = null) {
    return new ApiError(400, message, ERROR_CODE.BAD_REQUEST, details);
  }

  static unauthorized(message = 'Unauthorized', details = null) {
    return new ApiError(401, message, ERROR_CODE.UNAUTHORIZED, details);
  }

  static forbidden(message = 'Forbidden', details = null) {
    return new ApiError(403, message, ERROR_CODE.FORBIDDEN, details);
  }

  static notFound(message = 'Resource not found', details = null) {
    return new ApiError(404, message, ERROR_CODE.NOT_FOUND, details);
  }

  static conflict(message = 'Conflict', details = null) {
    return new ApiError(409, message, ERROR_CODE.CONFLICT, details);
  }

  static validation(message = 'Validation failed', details = null) {
    return new ApiError(422, message, ERROR_CODE.VALIDATION_ERROR, details);
  }

  static tooManyRequests(message = 'Too many requests', details = null) {
    return new ApiError(429, message, ERROR_CODE.TOO_MANY_REQUESTS, details);
  }

  static databaseUnavailable(message = 'Database unavailable', details = null) {
    return new ApiError(503, message, ERROR_CODE.DATABASE_UNAVAILABLE, details);
  }

  static internal(message = 'Internal server error', details = null) {
    return new ApiError(500, message, ERROR_CODE.INTERNAL_SERVER_ERROR, details);
  }
}

module.exports = ApiError;
