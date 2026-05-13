function success(res, data = null, message = 'Success', statusCode = 200, meta = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

function created(res, data = null, message = 'Created successfully', meta = null) {
  return success(res, data, message, 201, meta);
}

function noContent(res) {
  return res.status(204).send();
}

function paginated(res, items = [], pagination = {}, message = 'Success') {
  return res.status(200).json({
    success: true,
    message,
    data: items,
    meta: {
      pagination,
    },
  });
}

function error(res, errorObject) {
  const statusCode = errorObject.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: errorObject.message || 'Internal server error',
    code: errorObject.code || 'INTERNAL_SERVER_ERROR',
    ...(errorObject.details ? { details: errorObject.details } : {}),
  });
}

function legacyError(res, errorObject) {
  return res.status(errorObject.statusCode || errorObject.status || 400).json({
    success: false,
    message: errorObject.message || 'Có lỗi xảy ra.',
    code: errorObject.code || 'ERROR',
    ...(errorObject.details ? { details: errorObject.details } : {}),
  });
}

module.exports = {
  success,
  created,
  noContent,
  paginated,
  error,
  legacyError,
};
