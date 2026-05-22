const express = require('express');
const workspaceAccessAdminController = require('../controllers/workspace-access-admin.controller');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

const readWorkspaceAccess = authorize({
  anyPermissions: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.COMMAND_CENTER.VIEW_WORKSPACE_MAP,
    PERMISSION.USERS.READ,
    PERMISSION.ROLES.READ,
    PERMISSION.PERMISSIONS.READ,
    PERMISSION.SETTINGS.READ,
    PERMISSION.AUDIT_LOGS.READ,
  ],
});

const manageWorkspaceAccess = authorize({
  anyPermissions: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.SETTINGS.UPDATE,
    PERMISSION.ROLES.ASSIGN_PERMISSIONS,
    PERMISSION.USERS.ASSIGN_ROLES,
  ],
});

router.param('policyId', validateObjectIdParam);

router.use(readWorkspaceAccess);

router.get('/overview', workspaceAccessAdminController.getOverview);
router.get('/workspaces', workspaceAccessAdminController.listWorkspaces);
router.get('/workspaces/:workspaceCode', workspaceAccessAdminController.getWorkspaceDetail);
router.get('/by-actor', workspaceAccessAdminController.getByActor);
router.get('/by-role', workspaceAccessAdminController.getByRole);
router.get('/users', workspaceAccessAdminController.getByUser);
router.get('/departments', workspaceAccessAdminController.getByDepartment);
router.get('/policies', workspaceAccessAdminController.listPolicies);
router.post('/policies', manageWorkspaceAccess, workspaceAccessAdminController.createPolicy);
router.post('/policies/validate', workspaceAccessAdminController.validatePolicies);
router.patch('/policies/:policyId', manageWorkspaceAccess, workspaceAccessAdminController.updatePolicy);
router.delete('/policies/:policyId', manageWorkspaceAccess, workspaceAccessAdminController.deletePolicy);
router.get('/conflicts', workspaceAccessAdminController.getConflicts);
router.post('/conflicts/scan', workspaceAccessAdminController.getConflicts);
router.get('/sidebars', workspaceAccessAdminController.getSidebarConfigs);
router.get('/navigation-rules', workspaceAccessAdminController.getNavigationRules);
router.get('/preferences', workspaceAccessAdminController.listPreferences);
router.get('/diagnostics', workspaceAccessAdminController.getDiagnostics);
router.post('/diagnostics/run', workspaceAccessAdminController.runDiagnostics);
router.get('/audit', workspaceAccessAdminController.getAudit);
router.post('/check', workspaceAccessAdminController.checkAccess);
router.post('/explain', workspaceAccessAdminController.explainAccess);

module.exports = router;
