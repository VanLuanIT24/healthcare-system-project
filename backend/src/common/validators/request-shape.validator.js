const ApiError = require('../errors/api-error');

const METHODS_WITH_OPTIONAL_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nextValidationError(next, message, details = []) {
  const error = ApiError.validation(message, details);
  error.legacyControllerResponse = true;
  return next(error);
}

function validateBodyObject(req, res, next) {
  if (!METHODS_WITH_OPTIONAL_BODY.has(req.method)) {
    return next();
  }

  if (req.body === undefined || req.body === null) {
    req.body = {};
    return next();
  }

  if (!isPlainObject(req.body)) {
    return nextValidationError(next, 'Request body must be an object.', [{
      target: 'body',
      field: '',
      message: 'Request body must be an object.',
    }]);
  }

  return next();
}

function validateQueryObject(req, res, next) {
  if (req.query === undefined || req.query === null || isPlainObject(req.query)) {
    return next();
  }

  return nextValidationError(next, 'Request query must be an object.', [{
    target: 'query',
    field: '',
    message: 'Request query must be an object.',
  }]);
}

function validatePaginationQuery(options = {}) {
  const maxLimit = options.maxLimit || 100;

  return function paginationQueryValidator(req, res, next) {
    const errors = [];

    for (const field of ['page', 'limit']) {
      if (req.query[field] === undefined) continue;
      const value = Number(req.query[field]);
      if (!Number.isInteger(value) || value < 1) {
        errors.push({
          target: 'query',
          field,
          message: `${field} must be a positive integer.`,
        });
        continue;
      }
      if (field === 'limit' && value > maxLimit) {
        errors.push({
          target: 'query',
          field,
          message: `limit must be less than or equal to ${maxLimit}.`,
        });
      }
    }

    if (errors.length) {
      return nextValidationError(next, 'Request validation failed', errors);
    }

    return next();
  };
}

function validateRequestShape() {
  return function requestShapeValidator(req, res, next) {
    return validateQueryObject(req, res, (queryError) => {
      if (queryError) return next(queryError);
      return validateBodyObject(req, res, next);
    });
  };
}

module.exports = {
  validateBodyObject,
  validatePaginationQuery,
  validateQueryObject,
  validateRequestShape,
};
