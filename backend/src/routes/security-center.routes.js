const express = require('express');
const securityCenterController = require('../controllers/security-center.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('sessionId', validateObjectIdParam);
router.param('accessId', validateObjectIdParam);
router.param('consentId', validateObjectIdParam);
router.param('authorizationId', validateObjectIdParam);
router.param('policyId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

const readAccess = authorize({
  anyPermissions: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.SECURITY_CENTER.READ,
    PERMISSION.COMMAND_CENTER.VIEW_SECURITY,
    PERMISSION.AUDIT_LOGS.READ,
    PERMISSION.AUDIT_LOGS.READ_SECURITY,
    PERMISSION.AUDIT_LOGS.READ_LIMITED,
  ],
});

const sessionActionAccess = authorize({
  anyPermissions: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.SECURITY_CENTER.REVOKE_SESSIONS,
    PERMISSION.SECURITY_CENTER.BULK_ACTIONS,
    PERMISSION.COMMAND_CENTER.FORCE_LOGOUT,
    PERMISSION.USERS.FORCE_LOGOUT,
    PERMISSION.USERS.RESET_PASSWORD,
    PERMISSION.USERS.LOCK,
  ],
});

const breakGlassReviewAccess = authorize({
  anyPermissions: [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.SECURITY_CENTER.REVIEW_BREAK_GLASS, PERMISSION.BREAK_GLASS.READ, PERMISSION.AUDIT_LOGS.READ_SECURITY],
});

const consentManageAccess = authorize({
  anyPermissions: [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.SECURITY_CENTER.MANAGE, PERMISSION.CONSENTS.MANAGE],
});

const authorizationManageAccess = authorize({
  anyPermissions: [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.SECURITY_CENTER.MANAGE, PERMISSION.PATIENT_AUTHORIZATIONS.MANAGE, PERMISSION.PATIENT_AUTHORIZATIONS.APPROVE, PERMISSION.PATIENT_AUTHORIZATIONS.REVOKE],
});

router.get('/dashboard', readAccess, securityCenterController.dashboard);

router.get('/sessions', readAccess, securityCenterController.listSessions);
router.get('/sessions/:sessionId', readAccess, securityCenterController.getSessionDetail);
router.post('/sessions/:sessionId/revoke', sessionActionAccess, securityCenterController.revokeSession);
router.post('/sessions/:sessionId/revoke-family', sessionActionAccess, securityCenterController.revokeSessionFamily);
router.post('/sessions/bulk-revoke/preview', sessionActionAccess, securityCenterController.bulkRevokePreview);
router.post('/sessions/bulk-revoke', sessionActionAccess, securityCenterController.bulkRevokeSessions);

router.get('/login-history', readAccess, securityCenterController.listLoginHistory);
router.get('/login-summary', readAccess, securityCenterController.loginSummary);
router.get('/suspicious-ips', readAccess, securityCenterController.listSuspiciousIps);
router.get('/devices', readAccess, securityCenterController.listDevices);
router.get('/risky-accounts', readAccess, securityCenterController.listRiskyAccounts);

router.get('/token-risks', readAccess, securityCenterController.listTokenFamilies);
router.get('/token-families', readAccess, securityCenterController.listTokenFamilies);
router.get('/token-families/:familyId', readAccess, securityCenterController.getTokenFamily);
router.post('/token-families/:familyId/revoke', sessionActionAccess, securityCenterController.revokeTokenFamily);

router.get('/rate-limit-events', readAccess, securityCenterController.listRateLimitEvents);
router.get('/rate-limit-summary', readAccess, securityCenterController.rateLimitSummary);

router.get('/break-glass', readAccess, securityCenterController.listBreakGlass);
router.post('/break-glass/:accessId/review', breakGlassReviewAccess, securityCenterController.reviewBreakGlass);
router.post('/break-glass/:accessId/escalate', breakGlassReviewAccess, securityCenterController.reviewBreakGlass);

router.get('/consents', readAccess, securityCenterController.listConsents);
router.get('/consents/summary', readAccess, securityCenterController.consentSummary);
router.post('/consents/:consentId/revoke', consentManageAccess, securityCenterController.revokeConsent);

router.get('/patient-authorizations', readAccess, securityCenterController.listPatientAuthorizations);
router.get('/patient-authorizations/summary', readAccess, securityCenterController.patientAuthorizationSummary);
router.post('/patient-authorizations/:authorizationId/approve', authorizationManageAccess, securityCenterController.approvePatientAuthorization);
router.post('/patient-authorizations/:authorizationId/revoke', authorizationManageAccess, securityCenterController.revokePatientAuthorization);

router.get('/access-decisions', readAccess, securityCenterController.listAccessDecisions);
router.get('/sensitive-access-events', readAccess, securityCenterController.listSensitiveAccessEvents);

router.get('/data-access-policies', readAccess, securityCenterController.listDataAccessPolicies);
router.post('/data-access-policies', consentManageAccess, securityCenterController.createDataAccessPolicy);
router.patch('/data-access-policies/:policyId', consentManageAccess, securityCenterController.updateDataAccessPolicy);
router.post('/data-access-policies/:policyId/publish', consentManageAccess, securityCenterController.publishDataAccessPolicy);
router.post('/data-access-policies/:policyId/archive', consentManageAccess, securityCenterController.archiveDataAccessPolicy);

module.exports = router;
