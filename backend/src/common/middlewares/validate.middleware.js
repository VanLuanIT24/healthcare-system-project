const ApiError = require('../errors/api-error');

function formatPath(path) {
  if (Array.isArray(path)) return path.join('.');
  return path || '';
}

function normalizeJoiDetails(error, target) {
  return (error.details || []).map((detail) => ({
    target,
    field: formatPath(detail.path),
    message: detail.message,
  }));
}

function normalizeZodDetails(error, target) {
  return (error.issues || error.errors || []).map((issue) => ({
    target,
    field: formatPath(issue.path),
    message: issue.message,
  }));
}

function runSchemaValidation(schema, value, target) {
  if (!schema) {
    return { value };
  }

  if (typeof schema.validate === 'function') {
    const result = schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (result.error) {
      return {
        errors: normalizeJoiDetails(result.error, target),
      };
    }

    return { value: result.value };
  }

  if (typeof schema.parse === 'function') {
    try {
      return { value: schema.parse(value) };
    } catch (error) {
      return {
        errors: normalizeZodDetails(error, target),
      };
    }
  }

  if (typeof schema === 'function') {
    const result = schema(value);
    if (result?.error) {
      return {
        errors: normalizeJoiDetails(result.error, target),
      };
    }
    if (result?.errors) {
      return { errors: result.errors };
    }
    return { value: result?.value === undefined ? value : result.value };
  }

  return { value };
}

function validate(schema = {}) {
  return function validateRequest(req, res, next) {
    const validationTargets = ['body', 'params', 'query'];
    const errors = [];

    validationTargets.forEach((target) => {
      if (!schema[target]) return;

      const result = runSchemaValidation(schema[target], req[target], target);
      if (result.errors?.length) {
        errors.push(...result.errors);
        return;
      }

      req[target] = result.value;
    });

    if (errors.length) {
      const error = ApiError.validation('Request validation failed', errors);
      error.legacyControllerResponse = true;
      return next(error);
    }

    return next();
  };
}

module.exports = validate;
