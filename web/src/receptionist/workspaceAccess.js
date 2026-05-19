import { readStoredAuth, writeStoredAuth } from '../lib/storage';

const STAFF_WORKSPACE_PREFERENCE_KEY = 'healthcare.staff.workspace.preference';

const STAFF_WORKSPACE_DEFINITIONS = [
  {
    key: 'admin',
    title: 'Quản trị hệ thống',
    shortTitle: 'Quản trị',
    description: 'Quản lý tài khoản nhân sự, phân quyền, khoa phòng, cấu hình, bảo mật và nhật ký hệ thống.',
    workspaceLabel: 'Workspace quản trị',
    badge: 'Quản trị',
    tone: 'coral',
    icon: 'shield',
    path: '/admin/overview',
    routePrefixes: ['/admin'],
    roles: ['super_admin', 'admin', 'manager'],
    permissionsAny: [
      'system.full_access',
      'users.read',
      'users.create',
      'users.update',
      'roles.read',
      'permissions.read',
      'audit_logs.read',
      'settings.read',
      'departments.create',
      'departments.update',
      'departments.delete',
      'departments.assign_head',
    ],
    permissionPrefixes: ['users.', 'roles.', 'permissions.', 'audit_logs.', 'settings.'],
  },
  {
    key: 'scheduling',
    title: 'Điều phối lịch & vận hành',
    shortTitle: 'Điều phối',
    description: 'Điều phối lịch làm việc, lịch khám, slot, phê duyệt lịch, hàng đợi và vận hành khoa/phòng.',
    workspaceLabel: 'Workspace điều phối',
    badge: 'Điều phối',
    tone: 'blue',
    icon: 'calendar',
    path: '/scheduling/dashboard',
    routePrefixes: ['/scheduling'],
    roles: ['super_admin', 'admin', 'manager', 'department_head', 'scheduler', 'receptionist', 'lab_manager', 'medical_record_staff'],
    permissionsAny: [
      'schedules.read',
      'schedules.create',
      'schedules.update',
      'schedules.publish',
      'schedule_slots.read',
      'schedule_slots.generate',
      'appointments.read_department',
      'queue.read_department',
      'queue.create',
    ],
    permissionPrefixes: ['schedules.', 'schedule_slots.', 'appointments.'],
  },
  {
    key: 'reception',
    title: 'Lễ tân / Tiếp đón',
    shortTitle: 'Lễ tân',
    description: 'Tiếp nhận bệnh nhân, check-in lịch hẹn, điều phối hàng đợi và hỗ trợ tạo cuộc hẹn.',
    workspaceLabel: 'Workspace tiếp đón',
    badge: 'Tiếp đón',
    tone: 'purple',
    icon: 'clipboard',
    path: '/reception/dashboard',
    routePrefixes: ['/reception'],
    roles: ['super_admin', 'receptionist', 'scheduler'],
    permissionsAny: [
      'appointments.checkin',
      'appointments.create',
      'queue.read',
      'queue.read_department',
      'queue.call',
      'queue.create',
      'patients.search',
      'payments.create',
    ],
    permissionPrefixes: ['queue.'],
  },
  {
    key: 'doctor',
    title: 'Bác sĩ / Lâm sàng',
    shortTitle: 'Bác sĩ',
    description: 'Khám bệnh, chẩn đoán, chỉ định, kê đơn và theo dõi hồ sơ lâm sàng.',
    workspaceLabel: 'Workspace lâm sàng',
    badge: 'Lâm sàng',
    tone: 'cyan-blue',
    icon: 'stethoscope',
    path: '/doctor/dashboard',
    routePrefixes: ['/doctor', '/encounters'],
    roles: ['super_admin', 'doctor', 'radiologist'],
    permissionsAny: [
      'consultations.create',
      'diagnoses.create',
      'encounters.read_assigned',
      'clinical_notes.write',
      'orders.read_medication',
      'prescriptions.create',
      'medical_records.read_assigned',
    ],
    permissionPrefixes: ['consultations.', 'diagnoses.', 'clinical_notes.'],
  },
  {
    key: 'nurse',
    title: 'Điều dưỡng',
    shortTitle: 'Điều dưỡng',
    description: 'Theo dõi chăm sóc, sinh hiệu, y lệnh điều dưỡng và hỗ trợ hàng đợi phục vụ.',
    workspaceLabel: 'Workspace điều dưỡng',
    badge: 'Chăm sóc',
    tone: 'teal',
    icon: 'heart-pulse',
    path: '/nurse/dashboard',
    routePrefixes: ['/nurse', '/queue'],
    roles: ['super_admin', 'nurse'],
    permissionsAny: [
      'vital_signs.create',
      'clinical_notes.create_nursing',
      'queue.start_service',
      'queue.start_service_own',
      'care_plans.create',
      'medication_administrations.administer',
      'admissions.read_department',
    ],
    permissionPrefixes: ['vital_signs.', 'care_plans.', 'medication_administrations.'],
  },
  {
    key: 'pharmacy',
    title: 'Nhà thuốc & Kho dược',
    shortTitle: 'Nhà thuốc',
    description: 'Quản lý đơn thuốc, duyệt phát thuốc, kiểm soát tồn kho, lô thuốc và nghiệp vụ kho dược.',
    workspaceLabel: 'Workspace dược',
    badge: 'Dược',
    tone: 'green',
    icon: 'pill',
    path: '/pharmacy/overview',
    routePrefixes: ['/pharmacy', '/prescriptions'],
    roles: ['super_admin', 'manager', 'pharmacist', 'inventory_staff'],
    permissionsAny: [
      'prescriptions.verify',
      'dispenses.read',
      'medications.read',
      'stock_batches.read',
      'inventory_transactions.read',
    ],
    permissionPrefixes: ['dispenses.', 'medications.', 'stock_batches.', 'inventory_transactions.'],
  },
  {
    key: 'lab',
    title: 'Cận lâm sàng và thủ thuật',
    shortTitle: 'Cận lâm sàng',
    description: 'Xử lý mẫu bệnh phẩm, kết quả xét nghiệm, chẩn đoán hình ảnh và thủ thuật cận lâm sàng.',
    workspaceLabel: 'Không gian cận lâm sàng',
    badge: 'Cận lâm sàng',
    tone: 'indigo',
    icon: 'flask',
    path: '/lab/dashboard',
    routePrefixes: ['/lab'],
    roles: ['super_admin', 'lab_technician', 'lab_manager', 'radiologist', 'imaging_technician', 'procedure_staff', 'doctor', 'nurse'],
    permissionsAny: [
      'specimens.read',
      'lab_results.read',
      'imaging_orders.read',
      'imaging_reports.read',
      'procedure_orders.read',
    ],
    permissionPrefixes: ['specimens.', 'lab_results.', 'imaging_orders.', 'imaging_reports.', 'procedure_orders.', 'lab_orders.'],
  },
  {
    key: 'billing',
    title: 'Viện phí và thu tiền',
    shortTitle: 'Viện phí',
    description: 'Quản lý hóa đơn, thu tiền, khoản tính phí, bảo hiểm và đối soát chi phí điều trị.',
    workspaceLabel: 'Không gian viện phí và thu tiền',
    badge: 'Viện phí',
    tone: 'orange',
    icon: 'receipt',
    path: '/billing/dashboard',
    routePrefixes: ['/billing'],
    roles: ['super_admin', 'admin', 'manager', 'cashier', 'billing_staff', 'insurance_staff'],
    permissionsAny: [
      'invoices.read',
      'payments.read',
      'charges.read',
      'insurance_claims.read',
      'insurance_policies.read',
    ],
    permissionPrefixes: ['invoices.', 'payments.', 'charges.', 'insurance_claims.', 'insurance_policies.'],
  },
  {
    key: 'reports',
    title: 'Báo cáo và phân tích',
    shortTitle: 'Báo cáo',
    description: 'Theo dõi chỉ số vận hành, tài chính, hàng đợi, năng lực khoa phòng và hiệu quả dịch vụ.',
    workspaceLabel: 'Không gian báo cáo và phân tích',
    badge: 'Phân tích',
    tone: 'cyan',
    icon: 'chart',
    path: '/reports/dashboard',
    routePrefixes: ['/reports'],
    roles: [
      'super_admin',
      'admin',
      'manager',
      'department_head',
      'billing_staff',
      'insurance_staff',
      'pharmacist',
      'inventory_staff',
      'lab_manager',
      'radiologist',
      'medical_record_staff',
    ],
    permissionsAny: [
      'reports.read',
      'reports.read_all',
      'reports.admin_dashboard.read',
      'reports.appointments.read',
      'reports.billing.read',
      'reports.insurance.read',
      'reports.inventory.read',
      'reports.expiring_stock.read',
      'reports.low_stock.read',
      'reports.queue.read',
      'reports.revenue.read',
      'reports.department_performance.read',
      'reports.doctor_performance.read',
      'reports.medical_records.read',
    ],
    permissionPrefixes: ['reports.'],
  },
];

function safeReadPreference() {
  try {
    const raw = localStorage.getItem(STAFF_WORKSPACE_PREFERENCE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function safeWritePreference(value) {
  try {
    localStorage.setItem(STAFF_WORKSPACE_PREFERENCE_KEY, JSON.stringify(value));
  } catch (error) {
    // Ignore storage errors so auth flow can continue.
  }
}

function safeClearPreference() {
  try {
    localStorage.removeItem(STAFF_WORKSPACE_PREFERENCE_KEY);
  } catch (error) {
    // Ignore storage errors so auth flow can continue.
  }
}

function getStaffRoles(auth = {}) {
  const roles = auth?.user?.roles || auth?.roles || [];
  return Array.isArray(roles) ? roles : [];
}

function getStaffPermissions(auth = {}) {
  const permissions = auth?.user?.permissions || auth?.permissions || [];
  return Array.isArray(permissions) ? permissions : [];
}

function hasAnyRole(availableRoles = [], expectedRoles = []) {
  return expectedRoles.some((role) => availableRoles.includes(role));
}

function hasAnyPermission(availablePermissions = [], expectedPermissions = []) {
  return expectedPermissions.some((permission) => availablePermissions.includes(permission));
}

function hasPermissionPrefix(availablePermissions = [], prefixes = []) {
  return prefixes.some((prefix) => availablePermissions.some((permission) => permission.startsWith(prefix)));
}

function isPathMatched(pathname, routePrefixes = []) {
  return routePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function canAccessWorkspace(auth = {}, workspace) {
  const roles = getStaffRoles(auth);
  if (roles.includes('super_admin')) return true;

  const permissions = getStaffPermissions(auth);

  return (
    hasAnyRole(roles, workspace.roles || [])
    || hasAnyPermission(permissions, workspace.permissionsAny || [])
    || hasPermissionPrefix(permissions, workspace.permissionPrefixes || [])
  );
}

function withWorkspaceFlags(auth = {}, workspace) {
  return {
    ...workspace,
    isActive: auth?.activeWorkspace?.key === workspace.key,
  };
}

export function getStaffWorkspaceDefinitions() {
  return STAFF_WORKSPACE_DEFINITIONS.slice();
}

export function getStaffWorkspaceByKey(key) {
  return STAFF_WORKSPACE_DEFINITIONS.find((workspace) => workspace.key === key) || null;
}

export function getAccessibleStaffWorkspaces(auth = readStoredAuth()) {
  if (!auth || auth.actorType !== 'staff') return [];

  return STAFF_WORKSPACE_DEFINITIONS
    .filter((workspace) => canAccessWorkspace(auth, workspace))
    .map((workspace) => withWorkspaceFlags(auth, workspace));
}

export function hasStaffWorkspaceAccess(auth = readStoredAuth(), workspaceKey) {
  return getAccessibleStaffWorkspaces(auth).some((workspace) => workspace.key === workspaceKey);
}

export function getRememberedStaffWorkspace() {
  const preference = safeReadPreference();
  if (!preference?.key) return null;
  return getStaffWorkspaceByKey(preference.key);
}

export function rememberStaffWorkspace(workspace, remember = true) {
  if (!remember || !workspace?.key) {
    safeClearPreference();
    return;
  }

  safeWritePreference({
    key: workspace.key,
    path: workspace.path,
  });
}

export function clearRememberedStaffWorkspace() {
  safeClearPreference();
}

export function setActiveStaffWorkspace(workspace) {
  if (!workspace?.key) return;

  const currentAuth = readStoredAuth();
  if (!currentAuth || currentAuth.actorType !== 'staff') return;

  writeStoredAuth({
    ...currentAuth,
    activeWorkspace: {
      key: workspace.key,
      path: workspace.path,
      title: workspace.title,
    },
  });
}

export function getCurrentActiveStaffWorkspace(auth = readStoredAuth()) {
  const activeKey = auth?.activeWorkspace?.key;
  if (!activeKey) return null;
  return getAccessibleStaffWorkspaces(auth).find((workspace) => workspace.key === activeKey) || null;
}

export function resolveStaffWorkspaceTarget(auth = readStoredAuth(), options = {}) {
  const accessible = getAccessibleStaffWorkspaces(auth);
  const requestedKey = options.workspaceKey;

  if (requestedKey) {
    return accessible.find((workspace) => workspace.key === requestedKey) || null;
  }

  const activeWorkspace = getCurrentActiveStaffWorkspace(auth);
  if (activeWorkspace) return activeWorkspace;

  if (options.allowRemembered !== false) {
    const remembered = getRememberedStaffWorkspace();
    if (remembered && accessible.some((workspace) => workspace.key === remembered.key)) {
      return accessible.find((workspace) => workspace.key === remembered.key) || null;
    }
  }

  if (accessible.length === 1) {
    return accessible[0];
  }

  return null;
}

export function resolveStaffLandingPath(auth = readStoredAuth(), options = {}) {
  if (!auth || auth.actorType !== 'staff') return '/staff/login';

  const mustChangePassword = Boolean(auth?.user?.must_change_password);
  if (mustChangePassword) {
    const reason = auth?.mustChangePasswordReason || 'required';
    return `/staff/change-password?reason=${encodeURIComponent(reason)}`;
  }

  const accessible = getAccessibleStaffWorkspaces(auth);
  if (!accessible.length) return '/unauthorized';

  const targetWorkspace = resolveStaffWorkspaceTarget(auth, options);
  if (targetWorkspace) return targetWorkspace.path;

  return '/staff/select-workspace';
}

export function canAccessStaffPath(auth = readStoredAuth(), pathname = '') {
  if (!auth || auth.actorType !== 'staff' || typeof pathname !== 'string' || !pathname.startsWith('/')) {
    return false;
  }

  const roles = getStaffRoles(auth);

  if (
    pathname === '/staff/login'
    || pathname === '/staff/access'
    || pathname === '/staff/select-workspace'
    || pathname.startsWith('/staff/select-workspace/')
    || pathname === '/staff/overview'
    || pathname === '/staff/change-password'
    || pathname.startsWith('/staff/change-password')
    || pathname === '/unauthorized'
  ) {
    return true;
  }

  if (pathname === '/super-admin/access' || pathname.startsWith('/super-admin/access/')) {
    return roles.includes('super_admin');
  }

  return getAccessibleStaffWorkspaces(auth).some((workspace) => isPathMatched(pathname, workspace.routePrefixes || []));
}

export function hasRequiredStaffAccess(
  auth = readStoredAuth(),
  {
    requiredWorkspaceKey,
    allowedRoles = [],
    requiredPermissions = [],
    anyPermissions = [],
  } = {},
) {
  if (!auth || auth.actorType !== 'staff') return false;

  const roles = getStaffRoles(auth);
  const permissions = getStaffPermissions(auth);

  if (requiredWorkspaceKey && !hasStaffWorkspaceAccess(auth, requiredWorkspaceKey)) {
    return false;
  }

  if (allowedRoles.length > 0 && !allowedRoles.some((role) => roles.includes(role))) {
    return false;
  }

  if (requiredPermissions.length > 0 && !requiredPermissions.every((permission) => permissions.includes(permission))) {
    return false;
  }

  if (anyPermissions.length > 0 && !anyPermissions.some((permission) => permissions.includes(permission))) {
    return false;
  }

  return true;
}

export function getStaffActorName(auth = readStoredAuth()) {
  return auth?.user?.full_name || auth?.user?.username || 'Nhân sự';
}
