const express = require('express');
const imagingController = require('../controllers/imaging.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('reportId', validateObjectIdParam);
router.param('imagingOrderId', validateObjectIdParam);
router.param('attachmentId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('roomId', validateObjectIdParam);
router.param('equipmentId', validateObjectIdParam);
router.param('templateId', validateObjectIdParam);
router.param('correctionId', validateObjectIdParam);

const imagingReadPermissions = [
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ_OWN,
  PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
];

const imagingChargeCreatePermissions = [
  PERMISSION.ORDERS.CREATE_CHARGE,
  PERMISSION.CHARGES.CREATE,
  PERMISSION.CHARGES.REQUEST_CREATE,
  PERMISSION.CHARGES.MANAGE,
];

router.use(authenticate);

router.get(
  '/me/reports/summary',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED] }),
  imagingController.getMyImagingReportsSummary,
);
router.get(
  '/me/reports',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED] }),
  imagingController.getMyImagingReports,
);
router.get(
  '/me/reports/:reportId/files',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED] }),
  imagingController.getMyImagingReportFiles,
);
router.post(
  '/me/reports/:reportId/mark-viewed',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED] }),
  imagingController.markMyImagingReportViewed,
);
router.get(
  '/me/reports/:reportId',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED] }),
  imagingController.getImagingReportDetail,
);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/dashboard', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingDashboard);
router.get('/worklist-counts', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingWorklistCounts);
router.get('/sla-board', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingSlaBoard);
router.get('/schedule/board', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingScheduleBoard);
router.get('/slots/suggestions', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingSlotSuggestions);

router.get('/rooms', authorize({ anyPermissions: imagingReadPermissions }), imagingController.listImagingRooms);
router.post('/rooms', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.SYSTEM.FULL_ACCESS] }), imagingController.createImagingRoom);
router.patch('/rooms/:roomId', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.SYSTEM.FULL_ACCESS] }), imagingController.updateImagingRoom);
router.get('/equipment', authorize({ anyPermissions: imagingReadPermissions }), imagingController.listImagingEquipment);
router.post('/equipment', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.SYSTEM.FULL_ACCESS] }), imagingController.createImagingEquipment);
router.patch('/equipment/:equipmentId', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.SYSTEM.FULL_ACCESS] }), imagingController.updateImagingEquipment);

router.get('/report-templates', authorize({ anyPermissions: imagingReadPermissions }), imagingController.listImagingReportTemplates);
router.post('/report-templates', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE] }), imagingController.createImagingReportTemplate);
router.patch('/report-templates/:templateId', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE] }), imagingController.updateImagingReportTemplate);

router.get('/report-correction-requests', authorize({ anyPermissions: imagingReadPermissions }), imagingController.listImagingReportCorrections);
router.post('/report-correction-requests/:correctionId/assign', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE] }), imagingController.assignImagingReportCorrection);
router.post('/report-correction-requests/:correctionId/resolve', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE] }), imagingController.resolveImagingReportCorrection);
router.post('/report-correction-requests/:correctionId/cancel', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE] }), imagingController.cancelImagingReportCorrection);

router.get('/critical-board', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getCriticalImagingBoard);
router.get('/files', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.READ_IMAGING, PERMISSION.ATTACHMENTS.READ, ...imagingReadPermissions] }), imagingController.listImagingFiles);
router.post('/files/:attachmentId/review', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT] }), imagingController.reviewImagingFile);
router.post('/files/:attachmentId/release-to-patient', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT] }), imagingController.releaseImagingFileToPatient);
router.post('/files/:attachmentId/archive', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.ATTACHMENTS.DELETE_SOFT] }), imagingController.archiveImagingFile);
router.post('/files/:attachmentId/restore', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RESTORE, PERMISSION.ATTACHMENTS.ARCHIVE] }), imagingController.restoreImagingFile);

router.get('/orders', authorize({ anyPermissions: imagingReadPermissions }), imagingController.listImagingOrders);
router.get('/orders/:imagingOrderId', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingOrderDetail);
router.get('/orders/:imagingOrderId/timeline', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingTimeline);
router.get('/orders/:imagingOrderId/charges', authorize({ anyPermissions: [...imagingReadPermissions, PERMISSION.CHARGES.READ, PERMISSION.CHARGES.MANAGE] }), imagingController.listImagingOrderCharges);
router.post('/orders/:imagingOrderId/schedule', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE] }), imagingController.scheduleImagingOrder);
router.post('/orders/:imagingOrderId/reschedule', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE] }), imagingController.rescheduleImagingOrder);
router.post('/orders/:imagingOrderId/assign-technician', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE] }), imagingController.assignImagingTechnician);
router.post('/orders/:imagingOrderId/assign-radiologist', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS] }), imagingController.assignImagingRadiologist);
router.post('/orders/:imagingOrderId/mark-arrived', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.IMAGING_ORDERS.START] }), imagingController.markImagingArrived);
router.post('/orders/:imagingOrderId/mark-ready', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.IMAGING_ORDERS.START] }), imagingController.markImagingReady);
router.post('/orders/:imagingOrderId/mark-not-ready', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.IMAGING_ORDERS.START] }), imagingController.markImagingNotReady);
router.post('/orders/:imagingOrderId/start', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.START, PERMISSION.ORDERS.START] }), imagingController.startImagingOrder);
router.post('/orders/:imagingOrderId/complete', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.COMPLETE, PERMISSION.ORDERS.START] }), imagingController.completeImagingOrder);
router.post('/orders/:imagingOrderId/cancel', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.ORDERS.CANCEL] }), imagingController.cancelImagingOrder);
router.post('/orders/:imagingOrderId/no-show', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS] }), imagingController.markImagingOrderNoShow);
router.post('/orders/:imagingOrderId/charge', authorize({ anyPermissions: imagingChargeCreatePermissions }), idempotencyRequired({ route: '/api/imaging/orders/:imagingOrderId/charge' }), imagingController.createImagingOrderCharge);

router.get('/orders/:imagingOrderId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.READ_IMAGING, PERMISSION.ATTACHMENTS.READ, ...imagingReadPermissions] }), imagingController.listImagingAttachments);
router.post('/orders/:imagingOrderId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD] }), imagingController.uploadImagingAttachment);
router.post('/orders/:imagingOrderId/files/upload-url', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD] }), imagingController.createImagingUploadUrl);
router.post('/orders/:imagingOrderId/files/complete-upload', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD] }), imagingController.completeImagingFileUpload);
router.delete('/attachments/:attachmentId', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE] }), imagingController.deleteImagingAttachment);

router.post('/orders/:imagingOrderId/reports', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.CREATE] }), imagingController.createImagingReport);
router.get('/reports', authorize({ anyPermissions: imagingReadPermissions }), imagingController.listImagingReports);
router.get('/reports/:reportId', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingReportDetail);
router.get('/reports/:reportId/pdf', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingReportPdf);
router.post('/reports/:reportId/render-pdf', authorize({ anyPermissions: imagingReadPermissions }), imagingController.renderImagingReportPdf);
router.patch('/reports/:reportId', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.UPDATE_OWN] }), imagingController.updateImagingReport);
router.post('/reports/:reportId/validate-finalize', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.FINALIZE] }), imagingController.validateImagingReportFinalize);
router.post('/reports/:reportId/finalize', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.FINALIZE] }), imagingController.finalizeImagingReport);
router.post('/reports/:reportId/amend', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.AMEND] }), imagingController.amendImagingReport);
router.post('/reports/:reportId/cancel', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.CANCEL] }), imagingController.cancelImagingReport);
router.post('/reports/:reportId/release-to-patient', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT] }), imagingController.releaseImagingReportToPatient);
router.post('/reports/:reportId/acknowledge-critical', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.READ_FINAL] }), imagingController.acknowledgeCriticalImagingReport);
router.post('/reports/:reportId/notify-critical', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_REPORTS.WRITE] }), imagingController.notifyCriticalImagingReport);
router.post('/reports/:reportId/escalate-critical', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_REPORTS.WRITE] }), imagingController.escalateCriticalImagingReport);
router.post('/reports/:reportId/correction-requests', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_REPORTS.AMEND] }), imagingController.requestImagingReportCorrection);

router.get('/encounters/:encounterId/orders', authorize({ anyPermissions: imagingReadPermissions }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return imagingController.listImagingOrders(req, res, next);
});
router.get('/encounters/:encounterId/reports', authorize({ anyPermissions: imagingReadPermissions }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return imagingController.listImagingReports(req, res, next);
});
router.get('/encounters/:encounterId/summary', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getEncounterImagingSummary);
router.get('/patients/:patientId/reports', authorize({ anyPermissions: imagingReadPermissions }), (req, res, next) => {
  req.query.patient_id = req.params.patientId;
  return imagingController.listImagingReports(req, res, next);
});

module.exports = router;
