const ApiError = require('../errors/api-error');

const ROLE_STATUSES = new Set(['active', 'inactive']);

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function detail(field, message) {
  return {
    target: 'body',
    field,
    message,
  };
}

function parseBooleanLike(value) {
  return typeof value === 'boolean' || ['true', 'false'].includes(String(value).trim().toLowerCase());
}

function hasAnyField(body, fields) {
  return fields.some((field) => body[field] !== undefined);
}

function validateBody({ allowed = [], required = [], requireAny = [], custom = null } = {}) {
  const allowedSet = new Set(allowed);

  return function iamBodyValidator(req, res, next) {
    const body = req.body || {};
    const errors = [];

    Object.keys(body).forEach((field) => {
      if (!allowedSet.has(field)) {
        errors.push(detail(field, 'Unknown field is not allowed.'));
      }
    });

    required.forEach((field) => {
      if (isBlank(body[field])) {
        errors.push(detail(field, `${field} is required.`));
      }
    });

    requireAny.forEach((fields) => {
      if (!hasAnyField(body, fields)) {
        errors.push(detail(fields.join('|'), `One of ${fields.join(', ')} is required.`));
      }
    });

    if (typeof custom === 'function') {
      custom(body, errors);
    }

    if (errors.length) {
      const error = ApiError.validation('Request validation failed', errors);
      error.legacyControllerResponse = true;
      return next(error);
    }

    return next();
  };
}

function validateRoleFields(body, errors) {
  if (body.role_code !== undefined && isBlank(body.role_code)) {
    errors.push(detail('role_code', 'role_code không được rỗng.'));
  }
  if (body.role_name !== undefined && isBlank(body.role_name)) {
    errors.push(detail('role_name', 'role_name không được rỗng.'));
  }
  if (body.status !== undefined && !ROLE_STATUSES.has(body.status)) {
    errors.push(detail('status', 'status không hợp lệ.'));
  }
  if (body.priority_level !== undefined) {
    const priority = Number(body.priority_level);
    if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
      errors.push(detail('priority_level', 'priority_level phải là số nguyên từ 0 đến 100.'));
    }
  }
}

function validatePermissionFields(body, errors) {
  if (body.permission_code !== undefined && isBlank(body.permission_code)) {
    errors.push(detail('permission_code', 'permission_code không được rỗng.'));
  }
  if (body.permission_name !== undefined && isBlank(body.permission_name)) {
    errors.push(detail('permission_name', 'permission_name không được rỗng.'));
  }
  if (body.module_key !== undefined && isBlank(body.module_key)) {
    errors.push(detail('module_key', 'module_key không được rỗng.'));
  }
  if (body.action_key !== undefined && isBlank(body.action_key)) {
    errors.push(detail('action_key', 'action_key không được rỗng.'));
  }
  if (body.is_system !== undefined && !parseBooleanLike(body.is_system)) {
    errors.push(detail('is_system', 'is_system phải là boolean.'));
  }
}

function validateStringArrayField(body, errors, fieldNames, label) {
  const fieldName = fieldNames.find((field) => body[field] !== undefined);
  if (!fieldName) {
    errors.push(detail(fieldNames.join('|'), `${label} là bắt buộc.`));
    return;
  }

  const value = body[fieldName];
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(detail(fieldName, `${label} phải là mảng không rỗng.`));
    return;
  }

  if (value.some((item) => isBlank(item))) {
    errors.push(detail(fieldName, `${label} chứa giá trị không hợp lệ.`));
  }
}

module.exports = {
  createRole: validateBody({
    allowed: ['role_code', 'role_name', 'description', 'status', 'priority_level'],
    required: ['role_code', 'role_name'],
    custom: validateRoleFields,
  }),
  updateRole: validateBody({
    allowed: ['role_code', 'role_name', 'description', 'priority_level'],
    requireAny: [['role_code', 'role_name', 'description', 'priority_level']],
    custom: validateRoleFields,
  }),
  updateRoleStatus: validateBody({
    allowed: ['status'],
    required: ['status'],
    custom: validateRoleFields,
  }),
  createPermission: validateBody({
    allowed: ['permission_code', 'permission_name', 'module_key', 'action_key', 'description', 'is_system'],
    required: ['permission_code', 'permission_name'],
    custom: validatePermissionFields,
  }),
  updatePermission: validateBody({
    allowed: ['permission_code', 'permission_name', 'description'],
    requireAny: [['permission_code', 'permission_name', 'description']],
    custom: validatePermissionFields,
  }),
  permissionCodes: validateBody({
    allowed: ['permission_codes', 'permission_ids', 'permissionIds'],
    custom: (body, errors) => validateStringArrayField(body, errors, ['permission_codes', 'permission_ids', 'permissionIds'], 'permission_codes hoặc permission_ids'),
  }),
  roleCodes: validateBody({
    allowed: ['role_codes', 'role_ids', 'roleIds'],
    custom: (body, errors) => validateStringArrayField(body, errors, ['role_codes', 'role_ids', 'roleIds'], 'role_codes hoặc role_ids'),
  }),
};
