const express = require('express');
const controller = require('../controllers/admin-tools.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('runId', validateObjectIdParam);
router.param('findingId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.ADMIN_TOOLS.READ,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const runPermissions = [
  PERMISSION.ADMIN_TOOLS.RUN_SCAN,
  PERMISSION.ADMIN_TOOLS.RUN_DRY_RUN,
  PERMISSION.ADMIN_TOOLS.DEVELOPER_DIAGNOSTICS,
  PERMISSION.ADMIN_TOOLS.READ,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const applyPermissions = [
  PERMISSION.ADMIN_TOOLS.RUN_APPLY,
  PERMISSION.ADMIN_TOOLS.PRODUCTION_WRITE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const approvalPermissions = [
  PERMISSION.ADMIN_TOOLS.APPROVE,
  PERMISSION.ADMIN_TOOLS.PRODUCTION_WRITE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const cancelPermissions = [
  PERMISSION.ADMIN_TOOLS.CANCEL,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const exportPermissions = [
  PERMISSION.ADMIN_TOOLS.EXPORT,
  PERMISSION.ADMIN_TOOLS.READ,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const findingMutationPermissions = [
  PERMISSION.ADMIN_TOOLS.ACCEPT_RISK,
  PERMISSION.ADMIN_TOOLS.IGNORE_FINDING,
  PERMISSION.ADMIN_TOOLS.RUN_SCAN,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'], anyPermissions: readPermissions }));

router.get('/', controller.getOverview);
router.get('/tools', controller.listTools);

router.get('/runs', controller.listRuns);
router.get('/runs/:runId', controller.getRun);
router.get('/runs/:runId/findings', controller.listRunFindings);
router.get('/runs/:runId/logs', controller.getRun);
router.get('/runs/:runId/export', authorize({ anyPermissions: exportPermissions }), controller.exportRun);
router.post('/runs/:runId/cancel', authorize({ anyPermissions: cancelPermissions }), controller.cancelRun);
router.post('/runs/:runId/approve', authorize({ anyPermissions: approvalPermissions }), controller.approveRun);
router.post('/runs/:runId/apply', authorize({ anyPermissions: applyPermissions }), controller.applyRun);

router.get('/findings', controller.listFindings);
router.post('/findings/:findingId/resolve', authorize({ anyPermissions: findingMutationPermissions }), controller.resolveFinding);
router.post('/findings/:findingId/ignore', authorize({ anyPermissions: findingMutationPermissions }), controller.ignoreFinding);
router.post('/findings/:findingId/accept-risk', authorize({ anyPermissions: findingMutationPermissions }), controller.acceptRisk);

router.get('/:toolCode', controller.getTool);
router.post('/:toolCode/run', authorize({ anyPermissions: runPermissions }), controller.runTool);

module.exports = router;
