const express = require('express');
const complianceController = require('../controllers/compliance.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('auditLogId', validateObjectIdParam);
router.param('accessId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('reportId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

const readAccess = authorize({
  anyPermissions: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.AUDIT_LOGS.READ,
    PERMISSION.AUDIT_LOGS.READ_SECURITY,
    PERMISSION.COMPLIANCE.DASHBOARD_READ,
    PERMISSION.COMPLIANCE.SENSITIVE_ACCESS_READ,
    PERMISSION.COMPLIANCE.PATIENT_ACCESS_READ,
  ],
});

const reviewAccess = authorize({
  anyPermissions: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.COMPLIANCE.SENSITIVE_ACCESS_REVIEW,
    PERMISSION.COMPLIANCE.BREAK_GLASS_REVIEW,
    PERMISSION.SECURITY_CENTER.REVIEW_SENSITIVE_ACCESS,
    PERMISSION.SECURITY_CENTER.REVIEW_BREAK_GLASS,
  ],
});

const exportAccess = authorize({
  anyPermissions: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.AUDIT_LOGS.EXPORT,
    PERMISSION.COMPLIANCE.AUDIT_EXPORTS_CREATE,
    PERMISSION.COMPLIANCE.AUDIT_EXPORTS_DOWNLOAD,
  ],
});

const reportAccess = authorize({
  anyPermissions: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.EXPORT,
    PERMISSION.COMPLIANCE.REPORTS_READ,
    PERMISSION.COMPLIANCE.REPORTS_GENERATE,
  ],
});

router.get('/dashboard', readAccess, complianceController.dashboard);

router.get('/sensitive-access', readAccess, complianceController.sensitiveAccess);
router.get('/sensitive-access/summary', readAccess, complianceController.sensitiveAccessSummary);
router.get('/sensitive-access/risk-queue', readAccess, complianceController.sensitiveAccessRiskQueue);
router.post('/sensitive-access/:auditLogId/review', reviewAccess, complianceController.reviewAuditLog);

router.get('/break-glass', readAccess, complianceController.breakGlass);
router.get('/break-glass/summary', readAccess, complianceController.breakGlassSummary);
router.get('/break-glass/:accessId/timeline', readAccess, complianceController.breakGlassTimeline);
router.post('/break-glass/:accessId/review', reviewAccess, complianceController.reviewBreakGlass);

router.get('/patients/:patientId/access-timeline', readAccess, complianceController.patientAccessTimeline);
router.get('/patients/:patientId/summary', readAccess, complianceController.patientAccessSummary);

router.get('/billing/summary', readAccess, complianceController.billingSummary);
router.get('/billing/audit', readAccess, complianceController.billingAudit);
router.get('/iam/summary', readAccess, complianceController.iamSummary);
router.get('/iam/audit', readAccess, complianceController.iamAudit);
router.get('/settings/summary', readAccess, complianceController.settingsSummary);
router.get('/settings/audit', readAccess, complianceController.settingsAudit);

router.post('/audit-exports/preview-count', exportAccess, complianceController.previewExportCount);
router.post('/audit-exports/preview-sample', exportAccess, complianceController.previewExportSample);
router.post('/audit-exports', exportAccess, complianceController.createAuditExport);
router.get('/audit-exports', exportAccess, complianceController.listAuditExports);

router.post('/reports/generate', reportAccess, complianceController.generateComplianceReport);
router.get('/reports', reportAccess, complianceController.listComplianceReports);
router.get('/reports/:reportId', reportAccess, complianceController.getComplianceReport);

module.exports = router;
