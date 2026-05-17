const ApiError = require('../common/errors/api-error');

function validationError(message, errors = []) {
  const error = ApiError.validation(message, errors);
  error.legacyControllerResponse = true;
  return error;
}

function assertRequired(value, field, errors, target = 'body') {
  if (value === undefined || value === null || value === '') {
    errors.push({ target, field, message: `${field} is required.` });
  }
}

function requestValidator(validateFn) {
  return function validateRequest(req, res, next) {
    const errors = validateFn(req) || [];
    if (errors.length) {
      return next(validationError('Request validation failed', errors));
    }
    return next();
  };
}

module.exports = {
  assertRequired,
  requestValidator,
  validationError,
};
