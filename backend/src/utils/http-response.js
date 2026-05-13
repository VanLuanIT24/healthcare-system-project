const ApiResponse = require('../common/responses/api-response');

function successResponse(res, { statusCode = 200, message, data = {} }) {
  return ApiResponse.success(res, data, message, statusCode);
}

function errorResponse(res, error) {
  return ApiResponse.legacyError(res, error);
}

module.exports = {
  successResponse,
  errorResponse,
};
