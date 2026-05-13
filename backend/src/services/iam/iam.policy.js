const ApiError = require('../../common/errors/api-error');
const { PERMISSION, ROLE_CODE, ROLE_PRIORITY } = require('../../constants/permissions');
const permissionService = require('../permission.service');

const ROLE_CODE_REGEX = /^[a-z][a-z0-9_]{2,49}$/;
const PERMISSION_CODE_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const PROTECTED_ROLE_CODES = new Set([ROLE_CODE.SUPER_ADMIN, ROLE_CODE.ADMIN]);
const STAFF_ONLY_ROLE_CODES = new Set(Object.values(ROLE_CODE).filter((code) => ![
  ROLE_CODE.PATIENT,
  ROLE_CODE.PATIENT_RELATIVE,
].includes(code)));

function getActorId(actor = {}) {
  return actor.userId || actor.actor_id || actor.actorId;
}

function getActorRoleCodes(actor = {}) {
  return actor.roles || [];
}

function getActorPermissionCodes(actor = {}) {
  return actor.permissions || [];
}

function isSuperAdmin(actor = {}) {
  return getActorRoleCodes(actor).includes(ROLE_CODE.SUPER_ADMIN) ||
    permissionService.hasPermission(getActorPermissionCodes(actor), PERMISSION.SYSTEM.FULL_ACCESS);
}

function normalizeRoleCode(roleCode) {
  return String(roleCode || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizePermissionCode(permissionCode) {
  return String(permissionCode || '')
    .trim()
    .toLowerCase();
}

function validateRoleCode(roleCode) {
  if (!ROLE_CODE_REGEX.test(String(roleCode || ''))) {
    throw ApiError.validation('role_code phải ở dạng lowercase snake_case, dài từ 3 đến 50 ký tự.');
  }
}

function validatePermissionCode(permissionCode) {
  if (!PERMISSION_CODE_REGEX.test(String(permissionCode || ''))) {
    throw ApiError.validation('permission_code phải theo format module.action hoặc module.resource.action.');
  }
}

function getRolePriority(role) {
  return Number(role?.priority_level ?? ROLE_PRIORITY[role?.role_code] ?? 0);
}

function getActorMaxRolePriority(actor = {}) {
  if (isSuperAdmin(actor)) return 100;
  const roleDetails = actor.roleDetails || actor.role_details || [];
  if (Array.isArray(roleDetails) && roleDetails.length) {
    return Math.max(
      0,
      ...roleDetails.map((role) => Number(role.priority_level ?? ROLE_PRIORITY[role.role_code] ?? 0)),
    );
  }
  return Math.max(
    0,
    ...getActorRoleCodes(actor).map((roleCode) => ROLE_PRIORITY[roleCode] || 0),
  );
}

function assertCanManageRole(role, actor = {}, actionLabel = 'quản lý role') {
  if (isSuperAdmin(actor)) return true;

  if (role?.role_code === ROLE_CODE.SUPER_ADMIN) {
    throw ApiError.forbidden('Chỉ super_admin mới được quản lý role super_admin.');
  }

  if (getRolePriority(role) >= getActorMaxRolePriority(actor)) {
    throw ApiError.forbidden(`Bạn không được phép ${actionLabel} có cấp quyền bằng hoặc cao hơn mình.`);
  }

  return true;
}

function assertCanAssignRole(role, actor = {}) {
  if (!STAFF_ONLY_ROLE_CODES.has(role.role_code)) {
    throw ApiError.badRequest('Không được gán role patient/patient_relative cho tài khoản staff nội bộ.');
  }

  return assertCanManageRole(role, actor, 'gán role');
}

function assertCanAssignPermission(permission, actor = {}) {
  if (isSuperAdmin(actor)) return true;

  if (permission.permission_code === PERMISSION.SYSTEM.FULL_ACCESS) {
    throw ApiError.forbidden('Chỉ super_admin mới được gán system.full_access.');
  }

  if (!permissionService.hasPermission(getActorPermissionCodes(actor), permission.permission_code)) {
    throw ApiError.forbidden('Bạn không được gán permission mà chính bạn không có.');
  }

  return true;
}

function parsePermissionParts(permissionCode) {
  const [moduleKey, ...actionParts] = String(permissionCode || '').split('.');
  return {
    module_key: moduleKey,
    action_key: actionParts.join('.'),
  };
}

module.exports = {
  // ROLE_CODE_REGEX: Định nghĩa hằng số/cấu hình role code regex dùng chung trong service.
  ROLE_CODE_REGEX,
  // PERMISSION_CODE_REGEX: Định nghĩa hằng số/cấu hình permission code regex dùng chung trong service.
  PERMISSION_CODE_REGEX,
  // PROTECTED_ROLE_CODES: Định nghĩa hằng số/cấu hình protected role codes dùng chung trong service.
  PROTECTED_ROLE_CODES,
  // STAFF_ONLY_ROLE_CODES: Định nghĩa hằng số/cấu hình staff only role codes dùng chung trong service.
  STAFF_ONLY_ROLE_CODES,
  // getActorId: Lấy id của tác nhân.
  getActorId,
  // getActorRoleCodes: Lấy mã vai trò của tác nhân.
  getActorRoleCodes,
  // getActorPermissionCodes: Lấy mã quyền của tác nhân.
  getActorPermissionCodes,
  // isSuperAdmin: Kiểm tra super quản trị.
  isSuperAdmin,
  // normalizeRoleCode: Chuẩn hóa mã vai trò.
  normalizeRoleCode,
  // normalizePermissionCode: Chuẩn hóa mã quyền.
  normalizePermissionCode,
  // validateRoleCode: Kiểm tra tính hợp lệ của mã vai trò.
  validateRoleCode,
  // validatePermissionCode: Kiểm tra tính hợp lệ của mã quyền.
  validatePermissionCode,
  // getRolePriority: Lấy độ ưu tiên vai trò.
  getRolePriority,
  // getActorMaxRolePriority: Lấy độ ưu tiên vai trò cao nhất của tác nhân.
  getActorMaxRolePriority,
  // assertCanManageRole: Bảo đảm quyền quản lý vai trò.
  assertCanManageRole,
  // assertCanAssignRole: Bảo đảm quyền gán vai trò.
  assertCanAssignRole,
  // assertCanAssignPermission: Bảo đảm quyền gán quyền.
  assertCanAssignPermission,
  // parsePermissionParts: Phân tích/chuyển đổi các thành phần của mã quyền.
  parsePermissionParts,
};
