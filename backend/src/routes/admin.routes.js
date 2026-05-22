const express = require('express');
const adminCommandCenterRoutes = require('./admin-command-center.routes');
const adminFacilityRoutes = require('./admin-facility.routes');
const adminMasterDataRoutes = require('./admin-master-data.routes');
const adminWorkspaceAccessRoutes = require('./admin-workspace-access.routes');
const adminController = require('../controllers/admin.controller');
const paymentIntentController = require('../controllers/payment-intent.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('userId', validateObjectIdParam);
router.param('departmentId', validateObjectIdParam);
router.param('profileId', validateObjectIdParam);
router.param('paymentId', validateObjectIdParam);

router.get('/settings/public', adminController.getPublicSettings);
router.get('/doctors', adminController.getDoctorsList);
router.use('/command-center', adminCommandCenterRoutes);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));
router.use('/facilities', adminFacilityRoutes);
router.use('/master-data', adminMasterDataRoutes);
router.use('/workspace-access', adminWorkspaceAccessRoutes);

router.get(
  '/overview',
  authorize({ anyPermissions: [PERMISSION.REPORTS.ADMIN_DASHBOARD_READ, PERMISSION.USERS.READ] }),
  adminController.getAdminOverview,
);
router.get(
  '/staff/summary',
  authorize({ anyPermissions: [PERMISSION.REPORTS.ADMIN_DASHBOARD_READ, PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }),
  adminController.getStaffSummary,
);
router.get(
  '/activities/recent',
  authorize({ anyPermissions: [PERMISSION.REPORTS.ADMIN_DASHBOARD_READ, PERMISSION.AUDIT_LOGS.READ] }),
  adminController.getRecentAdminActivities,
);
router.get(
  '/worker-health',
  authorize({ anyPermissions: [PERMISSION.AUDIT_LOGS.READ, PERMISSION.SETTINGS.READ, PERMISSION.SYSTEM.FULL_ACCESS] }),
  adminController.getWorkerHealth,
);

router.get(
  '/payments',
  authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENT_INTENTS.READ, PERMISSION.PAYMENT_RECONCILIATION.READ] }),
  paymentIntentController.listManualPayments,
);
router.patch(
  '/payments/:paymentId/confirm',
  authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_RECONCILIATION.READ] }),
  paymentIntentController.confirmManualPayment,
);
router.patch(
  '/payments/:paymentId/reject',
  authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_INTENTS.CANCEL, PERMISSION.PAYMENT_RECONCILIATION.READ] }),
  paymentIntentController.rejectManualPayment,
);
router.patch(
  '/payments/:paymentId/refund-manual',
  authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND, PERMISSION.PAYMENT_RECONCILIATION.READ] }),
  paymentIntentController.refundManualPayment,
);

router.get('/staff', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), adminController.listStaffAccounts);
router.post('/staff', authorize({ permissions: [PERMISSION.USERS.CREATE] }), adminController.createStaffAccount);
router.get('/staff/search', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT, PERMISSION.USERS.READ_LIMITED] }), adminController.searchStaffAccounts);
router.get('/staff/:userId', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), adminController.getStaffAccountDetail);
router.patch('/staff/:userId', authorize({ permissions: [PERMISSION.USERS.UPDATE] }), adminController.updateStaffAccount);
router.patch('/staff/:userId/status', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), adminController.updateStaffAccountStatus);
router.post('/staff/:userId/activate', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), adminController.activateStaffAccount);
router.post('/staff/:userId/deactivate', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), adminController.deactivateStaffAccount);
router.post('/staff/:userId/unlock', authorize({ permissions: [PERMISSION.USERS.UNLOCK] }), adminController.unlockStaffAccount);
router.post('/staff/:userId/reset-password', authorize({ permissions: [PERMISSION.USERS.RESET_PASSWORD] }), adminController.resetStaffPassword);
router.delete('/staff/:userId', authorize({ permissions: [PERMISSION.USERS.DELETE] }), adminController.deleteStaffAccountSoft);
router.post('/staff/:userId/force-logout', authorize({ anyPermissions: [PERMISSION.USERS.FORCE_LOGOUT, PERMISSION.USERS.RESET_PASSWORD] }), adminController.forceLogoutStaff);
router.post('/staff/:userId/transfer-department', authorize({ anyPermissions: [PERMISSION.USERS.TRANSFER_DEPARTMENT, PERMISSION.USERS.UPDATE] }), adminController.transferStaffDepartment);

router.get('/staff/:userId/roles', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.ROLES.READ] }), adminController.getStaffRoles);
router.post('/staff/:userId/roles', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), adminController.assignRolesToStaff);
router.put('/staff/:userId/roles', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), adminController.syncStaffRoles);
router.delete('/staff/:userId/roles', authorize({ anyPermissions: [PERMISSION.USERS.REMOVE_ROLES, PERMISSION.USERS.ASSIGN_ROLES] }), adminController.removeRolesFromStaff);
router.get('/staff/:userId/permissions', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.PERMISSIONS.READ] }), adminController.getStaffPermissions);
router.get('/staff/:userId/login-history', authorize({ anyPermissions: [PERMISSION.AUDIT_LOGS.READ, PERMISSION.AUDIT_LOGS.READ_LIMITED] }), adminController.getStaffLoginHistory);
router.get('/staff/:userId/audit-logs', authorize({ permissions: [PERMISSION.AUDIT_LOGS.READ] }), adminController.getStaffAuditLogs);

router.get('/departments', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.READ, PERMISSION.DEPARTMENTS.READ_OWN] }), adminController.listDepartments);
router.post('/departments', authorize({ permissions: [PERMISSION.DEPARTMENTS.CREATE] }), adminController.createDepartment);
router.get('/departments/:departmentId', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.READ, PERMISSION.DEPARTMENTS.READ_OWN] }), adminController.getDepartmentDetail);
router.patch('/departments/:departmentId', authorize({ permissions: [PERMISSION.DEPARTMENTS.UPDATE] }), adminController.updateDepartment);
router.patch('/departments/:departmentId/status', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.UPDATE_STATUS, PERMISSION.DEPARTMENTS.UPDATE] }), adminController.updateDepartmentStatus);
router.delete('/departments/:departmentId', authorize({ permissions: [PERMISSION.DEPARTMENTS.DELETE] }), adminController.deleteDepartmentSoft);
router.post('/departments/:departmentId/assign-head', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.ASSIGN_HEAD, PERMISSION.DEPARTMENTS.UPDATE] }), adminController.assignDepartmentHead);
router.get('/departments/:departmentId/staff', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.STAFF_READ, PERMISSION.USERS.READ_DEPARTMENT, PERMISSION.USERS.READ] }), adminController.listDepartmentStaff);
router.get('/departments/:departmentId/summary', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.READ, PERMISSION.DEPARTMENTS.READ_OWN, PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ] }), adminController.getDepartmentSummary);

router.get('/doctor-profiles', authorize({ anyPermissions: [PERMISSION.DOCTOR_PROFILES.READ, PERMISSION.DOCTOR_PROFILES.READ_DEPARTMENT, PERMISSION.DOCTOR_PROFILES.READ_OWN] }), adminController.listDoctorProfiles);
router.post('/doctor-profiles', authorize({ permissions: [PERMISSION.DOCTOR_PROFILES.CREATE] }), adminController.createDoctorProfile);
router.get('/doctor-profiles/:profileId', authorize({ anyPermissions: [PERMISSION.DOCTOR_PROFILES.READ, PERMISSION.DOCTOR_PROFILES.READ_DEPARTMENT, PERMISSION.DOCTOR_PROFILES.READ_OWN] }), adminController.getDoctorProfileDetail);
router.patch('/doctor-profiles/:profileId', authorize({ permissions: [PERMISSION.DOCTOR_PROFILES.UPDATE] }), adminController.updateDoctorProfile);
router.patch('/doctor-profiles/:profileId/status', authorize({ anyPermissions: [PERMISSION.DOCTOR_PROFILES.UPDATE_STATUS, PERMISSION.DOCTOR_PROFILES.UPDATE] }), adminController.updateDoctorProfileStatus);
router.delete('/doctor-profiles/:profileId', authorize({ permissions: [PERMISSION.DOCTOR_PROFILES.DELETE] }), adminController.deleteDoctorProfileSoft);

router.get('/settings', authorize({ permissions: [PERMISSION.SETTINGS.READ] }), adminController.listSystemSettings);
router.post('/settings', authorize({ permissions: [PERMISSION.SETTINGS.CREATE] }), adminController.createSystemSetting);
router.get('/settings/grouped', authorize({ permissions: [PERMISSION.SETTINGS.READ] }), adminController.listSystemSettingsGrouped);
router.get('/settings/:settingKey', authorize({ permissions: [PERMISSION.SETTINGS.READ] }), adminController.getSystemSettingDetail);
router.patch('/settings/:settingKey', authorize({ anyPermissions: [PERMISSION.SETTINGS.UPDATE, PERMISSION.SETTINGS.UPDATE_SENSITIVE] }), adminController.updateSystemSetting);

module.exports = router;
