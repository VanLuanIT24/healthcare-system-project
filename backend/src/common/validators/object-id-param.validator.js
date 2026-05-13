const { assertValidObjectId } = require('../helpers/object-id.helper');

function nextValidationError(next, error) {
  if (error && typeof error === 'object') {
    error.legacyControllerResponse = true;
  }
  return next(error);
}

function validateObjectIdParam(req, res, next, value, name) {
  try {
    assertValidObjectId(value, name);
    return next();
  } catch (error) {
    return nextValidationError(next, error);
  }
}

function validateObjectIdParams(paramNames = []) {
  const names = Array.isArray(paramNames) ? paramNames : [paramNames];

  return function objectIdParamMiddleware(req, res, next) {
    try {
      for (const name of names) {
        if (req.params[name] !== undefined) {
          assertValidObjectId(req.params[name], name);
        }
      }
      return next();
    } catch (error) {
      return nextValidationError(next, error);
    }
  };
}

module.exports = {
  validateObjectIdParam,
  validateObjectIdParams,
};
