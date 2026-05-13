const ApiResponse = require('../responses/api-response');

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
    deviceId: req.get('x-device-id') || req.body?.device_id || req.body?.deviceId,
    deviceName: req.get('x-device-name') || req.body?.device_name || req.body?.deviceName,
    browser: req.get('x-client-browser') || req.body?.browser,
    os: req.get('x-client-os') || req.body?.os,
    location: req.body?.location,
    loginMethod: req.body?.login_method || req.body?.loginMethod,
  };
}

function markLegacyControllerError(error) {
  if (error && typeof error === 'object') {
    error.legacyControllerResponse = true;
  }
  return error;
}

function sendSuccess(res, { statusCode = 200, message, data = {} } = {}) {
  return ApiResponse.success(res, data, message, statusCode);
}

function controllerHandler(serviceMethod, successMessage, statusCode = 200) {
  return async function wrappedController(req, res, next) {
    try {
      const result = await serviceMethod(req, res, next);
      return sendSuccess(res, {
        statusCode,
        message: successMessage,
        data: result === undefined ? {} : result,
      });
    } catch (error) {
      return next(markLegacyControllerError(error));
    }
  };
}

module.exports = {
  controllerHandler,
  markLegacyControllerError,
  requestMeta,
  sendSuccess,
};
