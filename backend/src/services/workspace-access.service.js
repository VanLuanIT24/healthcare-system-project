const ApiError = require('../common/errors/api-error');
const permissionService = require('./permission.service');

const DISABLED_WORKSPACE_CODES = new Set(['nursing', 'lab', 'reports']);

const WORKSPACE_DEFINITIONS = [
  {
    code: 'admin',
    name: 'Quản trị hệ thống',
    icon: 'shield',
    route: '/admin/overview',
    roles: ['super_admin', 'admin', 'manager'],
    permissionsAny: ['system.full_access', 'users.read', 'roles.read', 'permissions.read', 'audit_logs.read', 'settings.read'],
    permissionPrefixes: ['users.', 'roles.', 'permissions.', 'audit_logs.', 'settings.'],
  },
  {
    code: 'scheduling',
    name: 'Điều phối lịch & vận hành',
    icon: 'calendar',
    route: '/scheduling/dashboard',
    roles: ['super_admin', 'admin', 'manager', 'department_head', 'scheduler', 'receptionist'],
    permissionsAny: ['schedules.read', 'schedule_slots.read', 'appointments.read_department', 'queue.read_department'],
    permissionPrefixes: ['schedules.', 'schedule_slots.', 'appointments.'],
  },
  {
    code: 'reception',
    name: 'Lễ tân / Tiếp đón',
    icon: 'clipboard',
    route: '/reception/dashboard',
    roles: ['super_admin', 'receptionist', 'scheduler'],
    permissionsAny: ['appointments.checkin', 'appointments.create', 'queue.read', 'queue.create', 'patients.search'],
    permissionPrefixes: ['queue.'],
  },
  {
    code: 'doctor',
    name: 'Bác sĩ / Lâm sàng',
    icon: 'stethoscope',
    route: '/doctor/dashboard',
    roles: ['super_admin', 'doctor', 'radiologist'],
    permissionsAny: ['consultations.create', 'diagnoses.create', 'encounters.read_assigned', 'clinical_notes.write'],
    permissionPrefixes: ['consultations.', 'diagnoses.', 'clinical_notes.'],
  },
  {
    code: 'nursing',
    name: 'Điều dưỡng',
    icon: 'heart-pulse',
    route: '/nurse/dashboard',
    roles: ['super_admin', 'nurse', 'department_head'],
    permissionsAny: ['vital_signs.create', 'clinical_notes.create_nursing', 'queue.start_service', 'admissions.read_department'],
    permissionPrefixes: ['vital_signs.', 'nursing_tasks.', 'nursing_handoffs.', 'care_plans.', 'medication_administrations.'],
  },
  {
    code: 'lab',
    name: 'Cận lâm sàng & Thủ thuật',
    icon: 'flask',
    route: '/clinical-ops/overview/dashboard',
    roles: ['super_admin', 'lab_technician', 'lab_manager', 'radiologist', 'imaging_technician', 'procedure_staff', 'doctor', 'nurse'],
    permissionsAny: ['specimens.read', 'lab_results.read', 'imaging_orders.read', 'imaging_reports.read', 'procedure_orders.read'],
    permissionPrefixes: ['specimens.', 'lab_results.', 'imaging_orders.', 'imaging_reports.', 'procedure_orders.', 'lab_orders.'],
  },
  {
    code: 'pharmacy',
    name: 'Nhà thuốc & Kho dược',
    icon: 'pill',
    route: '/pharmacy/overview',
    roles: ['super_admin', 'manager', 'pharmacist', 'inventory_staff'],
    permissionsAny: ['prescriptions.verify', 'dispenses.read', 'medications.read', 'stock_batches.read', 'inventory_transactions.read'],
    permissionPrefixes: ['dispenses.', 'medications.', 'stock_batches.', 'inventory_transactions.'],
  },
  {
    code: 'billing',
    name: 'Viện phí & Thu tiền',
    icon: 'receipt',
    route: '/billing/dashboard',
    roles: ['super_admin', 'admin', 'manager', 'cashier', 'billing_staff', 'insurance_staff'],
    permissionsAny: ['invoices.read', 'payments.read', 'charges.read', 'insurance_claims.read', 'insurance_policies.read'],
    permissionPrefixes: ['invoices.', 'payments.', 'charges.', 'insurance_claims.', 'insurance_policies.'],
  },
  {
    code: 'reports',
    name: 'Báo cáo & Phân tích',
    icon: 'chart',
    route: '/reports/dashboard',
    roles: ['super_admin', 'admin', 'manager', 'department_head', 'billing_staff', 'insurance_staff', 'pharmacist', 'lab_manager', 'medical_record_staff'],
    permissionsAny: ['reports.read', 'reports.read_all', 'reports.billing.read', 'reports.insurance.read', 'reports.revenue.read'],
    permissionPrefixes: ['reports.'],
  },
].filter((workspace) => !DISABLED_WORKSPACE_CODES.has(workspace.code));

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : actor.user?.roles || [];
}

function actorPermissions(actor = {}) {
  return Array.isArray(actor.permissions) ? actor.permissions : [];
}

function hasPermissionPrefix(permissions = [], prefixes = []) {
  return prefixes.some((prefix) => permissions.some((permission) => String(permission).startsWith(prefix)));
}

function canAccessWorkspace(actor = {}, workspace = {}) {
  const roles = actorRoles(actor);
  const permissions = actorPermissions(actor);
  if (roles.includes('super_admin') || permissionService.hasPermission(permissions, 'system.full_access')) return true;
  return roles.some((role) => workspace.roles?.includes(role))
    || permissionService.hasAnyPermission(permissions, workspace.permissionsAny || [])
    || hasPermissionPrefix(permissions, workspace.permissionPrefixes || []);
}

function getAvailableWorkspaces(actor = {}, options = {}) {
  const currentWorkspace = options.current_workspace || options.currentWorkspace || 'reception';
  const badges = options.badges || {};
  const available = WORKSPACE_DEFINITIONS
    .filter((workspace) => canAccessWorkspace(actor, workspace))
    .map((workspace) => ({
      code: workspace.code,
      name: workspace.name,
      icon: workspace.icon,
      route: workspace.route,
      allowed: true,
      reason: null,
      active: workspace.code === currentWorkspace,
      badge: badges[workspace.code] || null,
    }));

  return {
    current_workspace: currentWorkspace,
    available_workspaces: available,
  };
}

function assertWorkspaceAvailable(workspaceCode, actor = {}) {
  const workspace = WORKSPACE_DEFINITIONS.find((item) => item.code === workspaceCode);
  if (!workspace) throw ApiError.badRequest('Workspace không hợp lệ.');
  if (!canAccessWorkspace(actor, workspace)) throw ApiError.forbidden('Bạn không có quyền chuyển sang workspace này.');
  return workspace;
}

module.exports = {
  WORKSPACE_DEFINITIONS,
  getAvailableWorkspaces,
  assertWorkspaceAvailable,
};
