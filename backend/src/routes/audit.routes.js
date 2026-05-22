const express = require('express');
const auditController = require('../controllers/audit.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('auditLogId', validateObjectIdParam);
router.param('actorId', validateObjectIdParam);
router.param('targetId', validateObjectIdParam);
router.param('sessionId', validateObjectIdParam);

const auditReadPermissions = [
  PERMISSION.AUDIT_LOGS.READ,
  PERMISSION.AUDIT_LOGS.READ_LIMITED,
  PERMISSION.AUDIT_LOGS.READ_SECURITY,
  PERMISSION.AUDIT_LOGS.READ_SCHEDULE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: auditReadPermissions }), auditController.listAuditLogs);
router.get('/export', authorize({ anyPermissions: [PERMISSION.AUDIT_LOGS.EXPORT, PERMISSION.AUDIT_LOGS.READ] }), auditController.exportAuditLogs);
router.get('/summary', authorize({ anyPermissions: auditReadPermissions }), auditController.getAuditSummary);
router.get('/facets', authorize({ anyPermissions: auditReadPermissions }), auditController.getAuditFacets);
router.get('/request/:requestId/timeline', authorize({ anyPermissions: auditReadPermissions }), auditController.getRequestTimeline);
router.get('/session/:sessionId/timeline', authorize({ anyPermissions: auditReadPermissions }), auditController.getSessionTimeline);
router.get('/actor/:actorType/:actorId', authorize({ anyPermissions: [PERMISSION.AUDIT_LOGS.READ, PERMISSION.AUDIT_LOGS.READ_ACTOR, PERMISSION.AUDIT_LOGS.READ_LIMITED] }), auditController.getAuditLogsByActor);
router.get('/entity/:targetType/:targetId', authorize({ anyPermissions: [PERMISSION.AUDIT_LOGS.READ, PERMISSION.AUDIT_LOGS.READ_ENTITY] }), auditController.getAuditLogsByEntity);
router.get('/login-history/:actorType/:actorId', authorize({ anyPermissions: [PERMISSION.AUDIT_LOGS.READ, PERMISSION.AUDIT_LOGS.READ_ACTOR, PERMISSION.AUDIT_LOGS.READ_SECURITY, PERMISSION.AUDIT_LOGS.READ_LIMITED] }), auditController.getLoginHistory);
router.get('/:auditLogId', authorize({ anyPermissions: auditReadPermissions }), auditController.getAuditLogDetail);

module.exports = router;
