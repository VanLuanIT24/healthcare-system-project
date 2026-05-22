const express = require('express');
const controller = require('../controllers/admin-patient-portal.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('accountId', validateObjectIdParam);
router.param('relativeId', validateObjectIdParam);
router.param('authorizationId', validateObjectIdParam);
router.param('requestId', validateObjectIdParam);
router.param('documentId', validateObjectIdParam);
router.param('exportId', validateObjectIdParam);
router.param('policyId', validateObjectIdParam);
router.param('auditLogId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.PATIENT_PORTAL.DASHBOARD_READ,
  PERMISSION.PATIENT_PORTAL.ACCOUNTS_READ,
  PERMISSION.PATIENT_PORTAL.RELATIVES_READ,
  PERMISSION.PATIENT_PORTAL.AUTHORIZATIONS_READ,
  PERMISSION.PATIENT_PORTAL.PROFILE_CHANGES_READ,
  PERMISSION.PATIENT_PORTAL.DOCUMENTS_READ,
  PERMISSION.PATIENT_PORTAL.EXPORTS_READ,
  PERMISSION.PATIENT_PORTAL.INSURANCE_READ,
  PERMISSION.PATIENT_PORTAL.FEATURE_FLAGS_READ,
  PERMISSION.PATIENT_PORTAL.AUDIT_READ,
  PERMISSION.PATIENT_ACCOUNTS.READ,
  PERMISSION.PATIENT_RELATIVES.READ,
  PERMISSION.PATIENT_AUTHORIZATIONS.READ,
  PERMISSION.PATIENTS.READ,
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.DOCUMENTS.TIMELINE_READ,
  PERMISSION.INSURANCE_POLICIES.READ,
  PERMISSION.AUDIT_LOGS.READ,
  PERMISSION.COMMAND_CENTER.READ,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const accountManagePermissions = [
  PERMISSION.PATIENT_PORTAL.ACCOUNTS_MANAGE,
  PERMISSION.PATIENT_ACCOUNTS.UPDATE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const accountSecurityPermissions = [
  PERMISSION.PATIENT_PORTAL.ACCOUNTS_LOCK,
  PERMISSION.PATIENT_PORTAL.ACCOUNTS_FORCE_LOGOUT,
  PERMISSION.PATIENT_ACCOUNTS.LOCK,
  PERMISSION.PATIENT_ACCOUNTS.UNLOCK,
  PERMISSION.USERS.FORCE_LOGOUT,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const relativeManagePermissions = [
  PERMISSION.PATIENT_PORTAL.RELATIVES_MANAGE,
  PERMISSION.PATIENT_RELATIVES.UPDATE,
  PERMISSION.PATIENT_RELATIVES.DELETE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const relativeVerifyPermissions = [
  PERMISSION.PATIENT_PORTAL.RELATIVES_VERIFY,
  PERMISSION.PATIENT_PORTAL.RELATIVES_MANAGE,
  PERMISSION.PATIENT_RELATIVES.UPDATE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const authorizationManagePermissions = [
  PERMISSION.PATIENT_PORTAL.AUTHORIZATIONS_APPROVE,
  PERMISSION.PATIENT_PORTAL.AUTHORIZATIONS_REJECT,
  PERMISSION.PATIENT_PORTAL.AUTHORIZATIONS_REVOKE,
  PERMISSION.PATIENT_AUTHORIZATIONS.APPROVE,
  PERMISSION.PATIENT_AUTHORIZATIONS.REJECT,
  PERMISSION.PATIENT_AUTHORIZATIONS.REVOKE,
  PERMISSION.PATIENT_AUTHORIZATIONS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const profileReviewPermissions = [
  PERMISSION.PATIENT_PORTAL.PROFILE_CHANGES_APPROVE,
  PERMISSION.PATIENT_PORTAL.PROFILE_CHANGES_REJECT,
  PERMISSION.PATIENTS.UPDATE,
  PERMISSION.PATIENTS.UPDATE_BASIC,
  PERMISSION.PATIENTS.UPDATE_SENSITIVE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const documentReviewPermissions = [
  PERMISSION.PATIENT_PORTAL.DOCUMENTS_REVIEW,
  PERMISSION.PATIENT_PORTAL.DOCUMENTS_APPROVE,
  PERMISSION.PATIENT_PORTAL.DOCUMENTS_REJECT,
  PERMISSION.ATTACHMENTS.MANAGE,
  PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const documentRescanPermissions = [
  PERMISSION.PATIENT_PORTAL.DOCUMENTS_RESCAN,
  PERMISSION.PATIENT_PORTAL.DOCUMENTS_REVIEW,
  PERMISSION.ATTACHMENTS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const exportManagePermissions = [
  PERMISSION.PATIENT_PORTAL.EXPORTS_MANAGE,
  PERMISSION.DOCUMENTS.SELF_EXPORT_ZIP,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const insuranceManagePermissions = [
  PERMISSION.PATIENT_PORTAL.INSURANCE_VERIFY,
  PERMISSION.PATIENT_PORTAL.INSURANCE_REJECT,
  PERMISSION.INSURANCE_POLICIES.VERIFY,
  PERMISSION.INSURANCE_POLICIES.REJECT,
  PERMISSION.INSURANCE_POLICIES.UPDATE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const featureFlagUpdatePermissions = [
  PERMISSION.PATIENT_PORTAL.FEATURE_FLAGS_UPDATE,
  PERMISSION.SETTINGS.UPDATE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'], anyPermissions: readPermissions }));

router.get('/dashboard', controller.getDashboard);
router.get('/work-queue', controller.getWorkQueue);
router.get('/health', controller.getHealth);

router.get('/accounts/summary', controller.getAccountsSummary);
router.get('/accounts/:accountId/sessions', controller.listAccountSessions);
router.get('/accounts/:accountId/audit', controller.listAccountAudit);
router.get('/accounts/:accountId/login-history', controller.listAccountLoginHistory);
router.get('/accounts', controller.listAccounts);
router.get('/accounts/:accountId', controller.getAccount);
router.patch('/accounts/:accountId', authorize({ anyPermissions: accountManagePermissions }), controller.updateAccount);
router.post('/accounts/:accountId/lock', authorize({ anyPermissions: accountSecurityPermissions }), controller.lockAccount);
router.post('/accounts/:accountId/unlock', authorize({ anyPermissions: accountSecurityPermissions }), controller.unlockAccount);
router.post('/accounts/:accountId/disable', authorize({ anyPermissions: accountManagePermissions }), controller.disableAccount);
router.post('/accounts/:accountId/enable', authorize({ anyPermissions: accountManagePermissions }), controller.enableAccount);
router.post('/accounts/:accountId/reset-password', authorize({ anyPermissions: [PERMISSION.PATIENT_PORTAL.ACCOUNTS_RESET_PASSWORD, PERMISSION.PATIENT_ACCOUNTS.RESET_PASSWORD, PERMISSION.SYSTEM.FULL_ACCESS] }), controller.resetAccountPassword);
router.post('/accounts/:accountId/force-logout', authorize({ anyPermissions: accountSecurityPermissions }), controller.forceLogoutAccount);
router.post('/accounts/:accountId/resend-verification', authorize({ anyPermissions: accountManagePermissions }), controller.resendVerification);
router.post('/accounts/:accountId/unlink-google', authorize({ anyPermissions: accountManagePermissions }), controller.unlinkGoogle);

router.get('/relatives/summary', controller.getRelativesSummary);
router.get('/relatives/duplicates', controller.getRelativeDuplicates);
router.get('/relatives', controller.listRelatives);
router.get('/relatives/:relativeId', controller.getRelative);
router.patch('/relatives/:relativeId', authorize({ anyPermissions: relativeManagePermissions }), controller.updateRelative);
router.post('/relatives/:relativeId/verify-relationship', authorize({ anyPermissions: relativeVerifyPermissions }), controller.verifyRelative);
router.post('/relatives/:relativeId/unverify-relationship', authorize({ anyPermissions: relativeVerifyPermissions }), controller.unverifyRelative);
router.post('/relatives/:relativeId/block', authorize({ anyPermissions: relativeManagePermissions }), controller.blockRelative);
router.post('/relatives/:relativeId/unblock', authorize({ anyPermissions: relativeManagePermissions }), controller.unblockRelative);
router.get('/relatives/:relativeId/access-history', controller.getRelativeAccessHistory);

router.get('/authorizations/summary', controller.getAuthorizationsSummary);
router.post('/authorizations/bulk-revoke', authorize({ anyPermissions: authorizationManagePermissions }), controller.bulkRevokeAuthorizations);
router.get('/authorizations', controller.listAuthorizations);
router.get('/authorizations/:authorizationId/effective-access', controller.getAuthorizationEffectiveAccess);
router.get('/authorizations/:authorizationId/access-logs', controller.getAuthorizationAccessLogs);
router.get('/authorizations/:authorizationId', controller.getAuthorization);
router.post('/authorizations/:authorizationId/approve', authorize({ anyPermissions: authorizationManagePermissions }), controller.approveAuthorization);
router.post('/authorizations/:authorizationId/reject', authorize({ anyPermissions: authorizationManagePermissions }), controller.rejectAuthorization);
router.post('/authorizations/:authorizationId/revoke', authorize({ anyPermissions: authorizationManagePermissions }), controller.revokeAuthorization);
router.post('/authorizations/:authorizationId/extend', authorize({ anyPermissions: authorizationManagePermissions }), controller.extendAuthorization);
router.post('/authorizations/:authorizationId/update-scopes', authorize({ anyPermissions: authorizationManagePermissions }), controller.updateAuthorizationScopes);

router.get('/profile-field-policies/audit', controller.listProfileFieldPoliciesAudit);
router.post('/profile-field-policies/rebuild-defaults', authorize({ anyPermissions: featureFlagUpdatePermissions }), controller.rebuildProfileFieldPolicies);
router.get('/profile-field-policies', controller.listProfileFieldPolicies);
router.get('/profile-field-policies/:fieldName', controller.getProfileFieldPolicy);
router.patch('/profile-field-policies/:fieldName', authorize({ anyPermissions: featureFlagUpdatePermissions }), controller.updateProfileFieldPolicy);

router.get('/profile-change-requests/summary', controller.getProfileChangeSummary);
router.post('/profile-change-requests/bulk-approve', authorize({ anyPermissions: profileReviewPermissions }), controller.bulkApproveProfileChanges);
router.post('/profile-change-requests/bulk-reject', authorize({ anyPermissions: profileReviewPermissions }), controller.bulkRejectProfileChanges);
router.get('/profile-change-requests', controller.listProfileChangeRequests);
router.get('/profile-change-requests/:requestId', controller.getProfileChangeRequest);
router.post('/profile-change-requests/:requestId/approve', authorize({ anyPermissions: profileReviewPermissions }), controller.approveProfileChangeRequest);
router.post('/profile-change-requests/:requestId/reject', authorize({ anyPermissions: profileReviewPermissions }), controller.rejectProfileChangeRequest);
router.post('/profile-change-requests/:requestId/request-more-info', authorize({ anyPermissions: profileReviewPermissions }), controller.requestMoreInfoProfileChange);
router.post('/profile-change-requests/:requestId/assign', authorize({ anyPermissions: profileReviewPermissions }), controller.assignProfileChangeRequest);

router.get('/documents/summary', controller.getDocumentsSummary);
router.post('/documents/bulk-approve', authorize({ anyPermissions: documentReviewPermissions }), controller.bulkApproveDocuments);
router.post('/documents/bulk-reject', authorize({ anyPermissions: documentReviewPermissions }), controller.bulkRejectDocuments);
router.post('/documents/bulk-rescan', authorize({ anyPermissions: documentRescanPermissions }), controller.bulkRescanDocuments);
router.get('/documents', controller.listDocuments);
router.get('/documents/:documentId/access-logs', controller.getDocumentAccessLogs);
router.get('/documents/:documentId', controller.getDocument);
router.post('/documents/:documentId/approve', authorize({ anyPermissions: documentReviewPermissions }), controller.approveDocument);
router.post('/documents/:documentId/reject', authorize({ anyPermissions: documentReviewPermissions }), controller.rejectDocument);
router.post('/documents/:documentId/rescan', authorize({ anyPermissions: documentRescanPermissions }), controller.rescanDocument);
router.patch('/documents/:documentId/metadata', authorize({ anyPermissions: documentReviewPermissions }), controller.updateDocumentMetadata);
router.post('/documents/:documentId/release', authorize({ anyPermissions: documentReviewPermissions }), controller.releaseDocument);
router.post('/documents/:documentId/revoke-release', authorize({ anyPermissions: documentReviewPermissions }), controller.revokeDocumentRelease);

router.get('/document-exports/summary', controller.getDocumentExportsSummary);
router.get('/document-exports', controller.listDocumentExports);
router.get('/document-exports/:exportId/logs', controller.getDocumentExportLogs);
router.get('/document-exports/:exportId', controller.getDocumentExport);
router.post('/document-exports/:exportId/retry', authorize({ anyPermissions: exportManagePermissions }), controller.retryDocumentExport);
router.post('/document-exports/:exportId/expire', authorize({ anyPermissions: exportManagePermissions }), controller.expireDocumentExport);
router.post('/document-exports/:exportId/extend-expiry', authorize({ anyPermissions: exportManagePermissions }), controller.extendDocumentExport);
router.post('/document-exports/:exportId/revoke', authorize({ anyPermissions: exportManagePermissions }), controller.revokeDocumentExport);

router.get('/insurance-submissions/summary', controller.getInsuranceSubmissionsSummary);
router.get('/insurance-submissions', controller.listInsuranceSubmissions);
router.get('/insurance-submissions/:policyId/duplicate-check', controller.duplicateCheckInsurance);
router.get('/insurance-submissions/:policyId', controller.getInsuranceSubmission);
router.post('/insurance-submissions/:policyId/verify', authorize({ anyPermissions: insuranceManagePermissions }), controller.verifyInsuranceSubmission);
router.post('/insurance-submissions/:policyId/reject', authorize({ anyPermissions: insuranceManagePermissions }), controller.rejectInsuranceSubmission);
router.post('/insurance-submissions/:policyId/request-more-info', authorize({ anyPermissions: insuranceManagePermissions }), controller.requestMoreInfoInsurance);

router.get('/feature-flags/export', controller.exportFeatureFlags);
router.post('/feature-flags/import', authorize({ anyPermissions: featureFlagUpdatePermissions }), controller.importFeatureFlags);
router.post('/feature-flags/rebuild-defaults', authorize({ anyPermissions: featureFlagUpdatePermissions }), controller.rebuildFeatureFlags);
router.get('/feature-flags', controller.listFeatureFlags);
router.get('/feature-flags/:key/audit', controller.listFeatureFlagAudit);
router.get('/feature-flags/:key', controller.getFeatureFlag);
router.patch('/feature-flags/:key', authorize({ anyPermissions: featureFlagUpdatePermissions }), controller.updateFeatureFlag);
router.post('/feature-flags/:key/rollback', authorize({ anyPermissions: featureFlagUpdatePermissions }), controller.rollbackFeatureFlag);

router.get('/audit/summary', controller.getAuditSummary);
router.get('/audit/export', authorize({ anyPermissions: [PERMISSION.PATIENT_PORTAL.AUDIT_EXPORT, PERMISSION.AUDIT_LOGS.EXPORT, PERMISSION.SYSTEM.FULL_ACCESS] }), controller.exportAudit);
router.get('/audit/:auditLogId', controller.getAudit);
router.get('/audit', controller.listAudit);
router.get('/patients/:patientId/access-timeline', controller.getPatientAccessTimeline);

module.exports = router;
