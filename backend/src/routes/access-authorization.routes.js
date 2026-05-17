const express = require('express');
const accessAuthorizationController = require('../controllers/access-authorization.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('consentId', validateObjectIdParam);
router.param('accessId', validateObjectIdParam);

router.use(authenticate);

router.post('/consents', authorize({
  actorTypes: ['patient', 'staff'],
  anyPermissions: [PERMISSION.CONSENTS.SELF_SIGN, PERMISSION.CONSENTS.MANAGE],
}), accessAuthorizationController.signConsent);
router.get('/consents', authorize({
  actorTypes: ['patient', 'staff'],
  anyPermissions: [PERMISSION.CONSENTS.SELF_READ, PERMISSION.CONSENTS.MANAGE],
}), accessAuthorizationController.listConsents);
router.post('/consents/:consentId/revoke', authorize({
  actorTypes: ['patient', 'staff'],
  anyPermissions: [PERMISSION.CONSENTS.SELF_SIGN, PERMISSION.CONSENTS.MANAGE],
}), accessAuthorizationController.revokeConsent);

router.post('/break-glass/start', authorize({
  actorTypes: ['staff'],
  anyPermissions: [PERMISSION.BREAK_GLASS.START],
  sensitive: true,
  allowBreakGlass: true,
}), accessAuthorizationController.startBreakGlass);
router.post('/break-glass/:accessId/end', authorize({
  actorTypes: ['staff'],
  anyPermissions: [PERMISSION.BREAK_GLASS.START],
  sensitive: true,
  allowBreakGlass: true,
}), accessAuthorizationController.endBreakGlass);
router.post('/break-glass/end', authorize({
  actorTypes: ['staff'],
  anyPermissions: [PERMISSION.BREAK_GLASS.START],
  sensitive: true,
  allowBreakGlass: true,
}), accessAuthorizationController.endBreakGlass);
router.get('/break-glass/logs', authorize({
  actorTypes: ['staff'],
  anyPermissions: [PERMISSION.BREAK_GLASS.READ],
  sensitive: true,
  allowBreakGlass: true,
}), accessAuthorizationController.listBreakGlass);

module.exports = router;
