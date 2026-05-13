const express = require('express');
const imagingController = require('../controllers/imaging.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('reportId', validateObjectIdParam);
router.param('imagingOrderId', validateObjectIdParam);
router.param('attachmentId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);

const imagingReadPermissions = [
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ_OWN,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
];

router.use(authenticate);

router.get(
  '/me/reports',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED] }),
  imagingController.getMyImagingReports,
);
router.get(
  '/me/reports/:reportId',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED] }),
  imagingController.getImagingReportDetail,
);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/orders', authorize({ anyPermissions: imagingReadPermissions }), imagingController.listImagingOrders);
router.get('/orders/:imagingOrderId', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingOrderDetail);
router.get('/orders/:imagingOrderId/timeline', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingTimeline);
router.post('/orders/:imagingOrderId/schedule', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE] }), imagingController.scheduleImagingOrder);
router.post('/orders/:imagingOrderId/start', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.START, PERMISSION.ORDERS.START] }), imagingController.startImagingOrder);
router.post('/orders/:imagingOrderId/complete', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.COMPLETE, PERMISSION.ORDERS.START] }), imagingController.completeImagingOrder);
router.post('/orders/:imagingOrderId/cancel', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.ORDERS.CANCEL] }), imagingController.cancelImagingOrder);
router.post('/orders/:imagingOrderId/no-show', authorize({ anyPermissions: [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS] }), imagingController.markImagingOrderNoShow);

router.get('/orders/:imagingOrderId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.READ_IMAGING, PERMISSION.ATTACHMENTS.READ, ...imagingReadPermissions] }), imagingController.listImagingAttachments);
router.post('/orders/:imagingOrderId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD] }), imagingController.uploadImagingAttachment);
router.delete('/attachments/:attachmentId', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE] }), imagingController.deleteImagingAttachment);

router.post('/orders/:imagingOrderId/reports', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.CREATE] }), imagingController.createImagingReport);
router.get('/reports', authorize({ anyPermissions: imagingReadPermissions }), imagingController.listImagingReports);
router.get('/reports/:reportId', authorize({ anyPermissions: imagingReadPermissions }), imagingController.getImagingReportDetail);
router.patch('/reports/:reportId', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.UPDATE_OWN] }), imagingController.updateImagingReport);
router.post('/reports/:reportId/finalize', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.FINALIZE] }), imagingController.finalizeImagingReport);
router.post('/reports/:reportId/amend', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.AMEND] }), imagingController.amendImagingReport);
router.post('/reports/:reportId/cancel', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.CANCEL] }), imagingController.cancelImagingReport);
router.post('/reports/:reportId/release-to-patient', authorize({ permissions: [PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT] }), imagingController.releaseImagingReportToPatient);
router.post('/reports/:reportId/acknowledge-critical', authorize({ anyPermissions: [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.READ_FINAL] }), imagingController.acknowledgeCriticalImagingReport);

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
