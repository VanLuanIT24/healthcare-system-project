export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatCompactDate(value) {
  if (!value) return 'Chưa có dữ liệu';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function getRoleStatusTone(status) {
  if (status === 'active') return 'active';
  if (status === 'inactive') return 'disabled';
  return 'pending';
}

export function buildRoleCode(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function prettifyRoleCode(code) {
  return String(code || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function roleIcon(roleCode) {
  const normalized = String(roleCode || '').toLowerCase();

  if (normalized.includes('admin')) return '⌘';
  if (normalized.includes('doctor')) return '✚';
  if (normalized.includes('nurse')) return '✦';
  if (normalized.includes('pharmacist')) return '◫';
  if (normalized.includes('reception')) return '◎';
  if (normalized.includes('manager')) return '◈';
  return '◉';
}

export function groupPermissions(items = []) {
  return items.reduce((groups, permission) => {
    const moduleKey = permission.module_key || 'general';
    if (!groups[moduleKey]) groups[moduleKey] = [];
    groups[moduleKey].push(permission);
    return groups;
  }, {});
}

export function getPermissionTone(moduleKey) {
  const normalized = String(moduleKey || '').toLowerCase();
  if (normalized.includes('role') || normalized.includes('permission') || normalized.includes('iam')) return 'violet';
  if (normalized.includes('patient') || normalized.includes('appointment')) return 'blue';
  if (normalized.includes('queue') || normalized.includes('department')) return 'teal';
  if (normalized.includes('staff') || normalized.includes('auth')) return 'indigo';
  if (normalized.includes('prescription') || normalized.includes('encounter')) return 'amber';
  return 'slate';
}

export function getRoleUsageLevel(usersCount) {
  if (usersCount >= 15) return { label: 'Sử dụng cao', tone: 'high' };
  if (usersCount >= 5) return { label: 'Sử dụng trung bình', tone: 'medium' };
  return { label: 'Sử dụng thấp', tone: 'low' };
}

export function getPermissionUsageLevel(rolesCount) {
  if (rolesCount >= 12) return { label: 'Dùng rất nhiều', tone: 'high' };
  if (rolesCount >= 4) return { label: 'Đang sử dụng', tone: 'medium' };
  if (rolesCount >= 1) return { label: 'Ít dùng', tone: 'low' };
  return { label: 'Chưa được gán', tone: 'warning' };
}

const MODULE_TITLES = {
  auth: 'Bảo mật',
  role: 'Vai trò',
  permission: 'Quyền truy cập',
  department: 'Khoa phòng',
  schedule: 'Lịch làm việc',
  appointments: 'Lịch hẹn',
  patients: 'Bệnh nhân',
  queue: 'Hàng đợi',
  encounters: 'Hồ sơ bệnh án',
  consultations: 'Khám lâm sàng',
  diagnoses: 'Chẩn đoán',
  vitals: 'Dấu hiệu sinh tồn',
  medications: 'Thuốc',
  prescriptions: 'Đơn thuốc',
};

const ACTION_PHRASES = {
  read: 'Xem danh sách',
  view: 'Xem chi tiết',
  create: 'Tạo mới',
  write: 'Quản lý',
  update: 'Cập nhật',
  delete: 'Xóa',
  cancel: 'Hủy',
  manage: 'Điều phối',
  publish: 'Xuất bản',
  reset_password: 'Đặt lại mật khẩu',
  update_status: 'Đổi trạng thái',
  assign_permissions: 'Gán quyền',
  create_staff: 'Tạo tài khoản nhân sự',
};

const SUBJECT_PHRASES = {
  self: 'cho chính người dùng',
  patient_self: 'cho bệnh nhân tự thao tác',
  own: 'trên dữ liệu cá nhân',
};

export function getPermissionModuleTitle(moduleKey) {
  return MODULE_TITLES[String(moduleKey || '').toLowerCase()] || prettifyRoleCode(moduleKey);
}

export function getPermissionActionTitle(actionKey) {
  return ACTION_PHRASES[String(actionKey || '').toLowerCase()] || prettifyRoleCode(actionKey);
}

export function getPermissionBrief(permission) {
  const permissionCode = String(permission?.permission_code || '');
  const parts = permissionCode.split('.');
  const moduleKey = String(permission?.module_key || parts[0] || '').toLowerCase();
  const actionKey = String(permission?.action_key || parts[parts.length - 1] || '').toLowerCase();
  const scopeKey = parts.slice(1, -1).join('_').toLowerCase();
  const moduleTitle = getPermissionModuleTitle(moduleKey);
  const actionTitle = ACTION_PHRASES[actionKey] || 'Thao tác';
  const subjectTitle = SUBJECT_PHRASES[scopeKey];

  if (subjectTitle) {
    return `${actionTitle} ${moduleTitle.toLowerCase()} ${subjectTitle}`;
  }

  if (actionKey === 'read') return `${actionTitle} ${moduleTitle.toLowerCase()}`;
  if (actionKey === 'write') return `${actionTitle} ${moduleTitle.toLowerCase()}`;
  if (actionKey === 'manage') return `${actionTitle} ${moduleTitle.toLowerCase()}`;
  if (actionKey === 'create') return `${actionTitle} ${moduleTitle.toLowerCase()}`;
  if (actionKey === 'update') return `${actionTitle} ${moduleTitle.toLowerCase()}`;
  if (actionKey === 'cancel') return `${actionTitle} ${moduleTitle.toLowerCase()}`;
  if (actionKey === 'publish') return `${actionTitle} ${moduleTitle.toLowerCase()}`;

  return `${actionTitle} trong ${moduleTitle.toLowerCase()}`;
}

export function getPermissionDetail(permission) {
  const moduleTitle = getPermissionModuleTitle(permission?.module_key);
  const brief = getPermissionBrief(permission);
  return `Cho phép vai trò ${brief.toLowerCase()} trong module ${moduleTitle.toLowerCase()}.`;
}

export function buildPermissionCode(moduleKey, actionKey) {
  const normalizedModule = String(moduleKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const normalizedAction = String(actionKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalizedModule && !normalizedAction) return '';
  if (!normalizedModule) return normalizedAction;
  if (!normalizedAction) return normalizedModule;
  return `${normalizedModule}.${normalizedAction}`;
}

export function permissionIcon(moduleKey, actionKey) {
  const moduleName = String(moduleKey || '').toLowerCase();
  const actionName = String(actionKey || '').toLowerCase();

  if (moduleName.includes('staff')) return '◉';
  if (moduleName.includes('permission')) return '⌘';
  if (moduleName.includes('role')) return '◈';
  if (moduleName.includes('appointment')) return '◷';
  if (moduleName.includes('patient')) return '◎';
  if (moduleName.includes('schedule')) return '◫';
  if (moduleName.includes('department')) return '▣';
  if (actionName.includes('delete')) return '▲';
  return '✦';
}

export const PERMISSION_MODULE_OPTIONS = [
  'auth',
  'staff',
  'role',
  'permission',
  'department',
  'schedule',
  'appointments',
  'patients',
  'queue',
  'encounters',
  'consultations',
  'diagnoses',
  'vitals',
  'medications',
  'prescriptions',
];

export const PERMISSION_ACTION_OPTIONS = [
  'read',
  'view',
  'create',
  'write',
  'update',
  'delete',
  'manage',
  'assign_permissions',
  'update_status',
  'reset_password',
  'publish',
  'cancel',
];

export const ROLE_PRESETS = {
  doctor: ['appointments.read', 'patients.read', 'encounters.read', 'encounters.write', 'consultations.write', 'diagnoses.write', 'vitals.write', 'prescriptions.write'],
  receptionist: ['appointments.read', 'appointments.write', 'patients.read', 'patients.write', 'queue.manage'],
  nurse: ['appointments.read', 'patients.read', 'encounters.read', 'vitals.write', 'queue.manage'],
  admin: ['auth.staff.create', 'auth.staff.manage_roles', 'auth.staff.read', 'auth.staff.update_status', 'auth.staff.reset_password', 'role.read', 'role.create', 'role.update', 'role.update_status', 'role.assign_permissions', 'permission.read', 'permission.update', 'department.read', 'department.write', 'auth.audit.read'],
  manager: ['auth.staff.read', 'role.read', 'permission.read', 'department.read', 'schedule.read', 'appointments.read', 'patients.read'],
};
