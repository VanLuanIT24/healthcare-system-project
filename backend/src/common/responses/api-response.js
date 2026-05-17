function responseContext(res) {
  const context = res?.req?.context || {};
  return {
    request_id: context.request_id || res?.req?.headers?.['x-request-id'] || null,
    correlation_id: context.correlation_id || res?.req?.headers?.['x-correlation-id'] || null,
    actor_id: context.actor_id || context.actor?.actor_id || null,
    session_id: context.session_id || context.session?.session_id || null,
  };
}

function buildMeta(res, meta = null) {
  const context = responseContext(res);
  return {
    ...(meta && typeof meta === 'object' ? meta : {}),
    correlation_id: context.correlation_id,
    actor_id: context.actor_id,
    session_id: context.session_id,
  };
}

function success(res, data = null, message = 'Success', statusCode = 200, meta = null) {
  const context = responseContext(res);
  return res.status(statusCode).json({
    success: true,
    data,
    meta: buildMeta(res, meta),
    request_id: context.request_id,
    timestamp: new Date().toISOString(),
    message,
  });
}

function created(res, data = null, message = 'Created successfully', meta = null) {
  return success(res, data, message, 201, meta);
}

function noContent(res) {
  return res.status(204).send();
}

function paginated(res, items = [], pagination = {}, message = 'Success') {
  const context = responseContext(res);
  return res.status(200).json({
    success: true,
    data: items,
    meta: buildMeta(res, {
      pagination,
    }),
    request_id: context.request_id,
    timestamp: new Date().toISOString(),
    message,
  });
}

function error(res, errorObject) {
  const statusCode = errorObject.statusCode || 500;
  const context = responseContext(res);
  const errorBody = {
    code: errorObject.code || 'INTERNAL_SERVER_ERROR',
    message: errorObject.message || 'Internal server error',
    details: errorObject.details || null,
    trace_id: errorObject.trace_id || context.correlation_id || context.request_id,
  };

  return res.status(statusCode).json({
    success: false,
    error: errorBody,
    request_id: context.request_id,
    timestamp: new Date().toISOString(),
    message: errorBody.message,
    code: errorBody.code,
  });
}

function legacyError(res, errorObject) {
  const context = responseContext(res);
  const errorBody = {
    code: errorObject.code || 'ERROR',
    message: errorObject.message || 'Có lỗi xảy ra.',
    details: errorObject.details || null,
    trace_id: errorObject.trace_id || context.correlation_id || context.request_id,
  };

  return res.status(errorObject.statusCode || errorObject.status || 400).json({
    success: false,
    error: errorBody,
    request_id: context.request_id,
    timestamp: new Date().toISOString(),
    message: errorBody.message,
    code: errorBody.code,
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
