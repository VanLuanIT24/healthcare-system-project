const { PERMISSION } = require('../../constants/permissions');

const CRITICAL_PERMISSION_CODES = new Set([
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.USERS.ASSIGN_ROLES,
  PERMISSION.ROLES.ASSIGN_PERMISSIONS,
  PERMISSION.PERMISSIONS.CREATE,
  PERMISSION.PERMISSIONS.UPDATE,
  PERMISSION.PERMISSIONS.DELETE,
  PERMISSION.AUDIT_LOGS?.EXPORT,
].filter(Boolean));

const HIGH_PERMISSION_PATTERNS = [
  /^break_glass\./,
  /^settings\.(update|update_sensitive|create)/,
  /^users\.(reset_password|force_logout|lock|unlock|delete)/,
  /^payments\.(refund|reconcile|void|adjust)/,
  /^invoices\.(void|write_off|approve|adjust)/,
  /^medical_records\.(read_all|export|delete)/,
  /^audit_logs\.(read|export|read_security)/,
];

const MEDIUM_PERMISSION_PATTERNS = [
  /^reports\.(export|write|manage)/,
  /^notifications\.(broadcast|manage|create)/,
  /^roles\.(create|update|delete)/,
  /^users\.(create|update|update_status|transfer_department)/,
  /^departments\.(create|update|delete|assign_head)/,
];

function normalizePermissionCode(permissionOrCode = '') {
  if (typeof permissionOrCode === 'string') return permissionOrCode;
  return permissionOrCode.permission_code || '';
}

function getPermissionRisk(permissionOrCode = '') {
  const code = normalizePermissionCode(permissionOrCode).toLowerCase();
  if (!code) return { level: 'low', score: 1, sensitive: false, reasons: [] };

  if (CRITICAL_PERMISSION_CODES.has(code)) {
    return {
      level: 'critical',
      score: 100,
      sensitive: true,
      reasons: ['Quyền có thể kiểm soát toàn hệ thống hoặc thay đổi IAM lõi.'],
    };
  }

  if (HIGH_PERMISSION_PATTERNS.some((pattern) => pattern.test(code))) {
    return {
      level: 'high',
      score: 75,
      sensitive: true,
      reasons: ['Quyền tác động tới bảo mật, tài chính, hồ sơ y tế hoặc audit.'],
    };
  }

  if (MEDIUM_PERMISSION_PATTERNS.some((pattern) => pattern.test(code))) {
    return {
      level: 'medium',
      score: 45,
      sensitive: true,
      reasons: ['Quyền thay đổi dữ liệu vận hành hoặc cấu hình quan trọng.'],
    };
  }

  if (/\.(read|read_own|read_department|public\.read|self\.read)/.test(code)) {
    return { level: 'low', score: 8, sensitive: false, reasons: ['Quyền đọc phạm vi thấp.'] };
  }

  return { level: 'low', score: 18, sensitive: false, reasons: ['Quyền nghiệp vụ thông thường.'] };
}

function summarizePermissionRisk(permissionCodes = []) {
  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    sensitive: 0,
    max_level: 'low',
    score: 0,
  };

  const rank = { low: 1, medium: 2, high: 3, critical: 4 };
  permissionCodes.forEach((permissionCode) => {
    const risk = getPermissionRisk(permissionCode);
    summary[risk.level] += 1;
    if (risk.sensitive) summary.sensitive += 1;
    summary.score += risk.score;
    if (rank[risk.level] > rank[summary.max_level]) summary.max_level = risk.level;
  });

  return summary;
}

module.exports = {
  getPermissionRisk,
  summarizePermissionRisk,
};
