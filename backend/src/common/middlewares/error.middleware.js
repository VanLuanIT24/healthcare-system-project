const ApiError = require('../errors/api-error');
const ApiResponse = require('../responses/api-response');

function statusCodeToErrorCode(statusCode) {
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode === 422) return 'VALIDATION_ERROR';
  if (statusCode === 429) return 'TOO_MANY_REQUESTS';
  if (statusCode === 503) return 'SERVICE_UNAVAILABLE';
  return 'INTERNAL_SERVER_ERROR';
}

function normalizeMongooseValidationError(error) {
  const details = Object.values(error.errors || {}).map((item) => ({
    field: item.path,
    message: 'Giá trị không hợp lệ.',
  }));
  return ApiError.validation('Dữ liệu không hợp lệ.', details);
}

function normalizeDuplicateKeyError(error) {
  const fields = Object.keys(error.keyValue || {});
  return ApiError.conflict(
    fields.length
      ? 'Dữ liệu đã tồn tại trong hệ thống.'
      : 'Dữ liệu bị trùng với bản ghi đã có.',
    {
      fields,
    },
  );
}

function isDatabaseConnectivityError(error) {
  const name = String(error?.name || '');
  const code = String(error?.code || '');
  const message = String(error?.message || '');

  return (
    [
      'MongoNetworkError',
      'MongoNetworkTimeoutError',
      'MongoServerSelectionError',
      'MongooseServerSelectionError',
      'MongoTopologyClosedError',
    ].includes(name)
    || ['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code)
    || /getaddrinfo|querysrv|server selection timed out|replicasetnoprimary|mongodb\.net|mongo network/i.test(message)
  );
}

function normalizeError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  if (isDatabaseConnectivityError(error)) {
    return ApiError.databaseUnavailable('Hệ thống tạm thời không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.');
  }

  if (error?.name === 'ValidationError') {
    return normalizeMongooseValidationError(error);
  }

  if (error?.name === 'CastError') {
    return ApiError.badRequest('Định danh không hợp lệ.', {
      field: error.path,
    });
  }

  if (error?.code === 11000) {
    return normalizeDuplicateKeyError(error);
  }

  if (error?.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Phiên đăng nhập không hợp lệ.');
  }

  if (error?.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Phiên đăng nhập đã hết hạn.');
  }

  if (error?.statusCode || error?.status) {
    const statusCode = error.statusCode || error.status;
    return new ApiError(
      statusCode,
      error.message || 'Request failed',
      error.code || statusCodeToErrorCode(statusCode),
      error.details || null,
    );
  }

  return ApiError.internal('Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.');
}

function applyErrorHeaders(res, error) {
  const retryAfterSeconds = Number(error?.details?.retry_after_seconds);
  if (error?.statusCode === 429 && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
  }
}

function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.legacyControllerResponse) {
    const normalizedError = normalizeError(error);
    applyErrorHeaders(res, normalizedError);
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
    return ApiResponse.legacyError(res, normalizedError);
  }

  const normalizedError = normalizeError(error);
  applyErrorHeaders(res, normalizedError);
  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }

  return ApiResponse.error(res, normalizedError);
}

module.exports = {
  errorMiddleware,
  normalizeError,
};
