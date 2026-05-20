const express = require('express');
const procedureController = require('../controllers/procedure.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('procedureOrderId', validateObjectIdParam);
router.param('resultId', validateObjectIdParam);
router.param('attachmentId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);

const procedureReadPermissions = [
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_OWN,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
];

const procedureChargeCreatePermissions = [
  PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE,
  PERMISSION.CHARGES.CREATE,
  PERMISSION.CHARGES.REQUEST_CREATE,
  PERMISSION.ORDERS.CREATE_CHARGE,
];

router.use(authenticate);

router.get(
  '/me/history',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SELF_READ_COMPLETED] }),
  procedureController.getMyProcedureHistory,
);
router.get(
  '/me/orders/:procedureOrderId',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SELF_READ_COMPLETED] }),
  procedureController.getProcedureOrderDetail,
);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/dashboard/summary', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ, PERMISSION.PROCEDURE_ORDERS.READ] }), procedureController.getProcedureDashboardSummary);
router.get('/worklist-counts', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ, PERMISSION.PROCEDURE_ORDERS.READ] }), procedureController.getProcedureWorklistCounts);
router.get('/calendar', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getProcedureCalendar);

router.get('/files', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.READ_PROCEDURE, PERMISSION.ATTACHMENTS.READ, ...procedureReadPermissions] }), procedureController.listProcedureFiles);
router.post('/files/:attachmentId/review', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.reviewProcedureFile);
router.post('/files/:attachmentId/release-to-patient', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.releaseProcedureFileToPatient);
router.post('/files/:attachmentId/revoke-release', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.revokeProcedureFileRelease);
router.post('/files/:attachmentId/archive', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.archiveProcedureFile);
router.post('/files/:attachmentId/restore', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RESTORE, PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.restoreProcedureFile);
router.delete('/files/:attachmentId', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.deleteProcedureAttachment);

router.get('/charges', authorize({ anyPermissions: [PERMISSION.CHARGES.READ, ...procedureReadPermissions] }), procedureController.listProcedureWorkspaceCharges);

router.get('/results', authorize({ anyPermissions: procedureReadPermissions }), procedureController.listProcedureResults);
router.get('/results/:resultId', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getProcedureResultDetail);
router.patch('/results/:resultId', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.updateProcedureResult);
router.post('/results/:resultId/finalize', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.finalizeProcedureResult);
router.post('/results/:resultId/sign', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.signProcedureResult);
router.post('/results/:resultId/amend', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.amendProcedureResult);
router.post('/results/:resultId/release-to-doctor', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), (req, res, next) => {
  req.body = { ...req.body, target: 'doctor' };
  return procedureController.releaseProcedureResult(req, res, next);
});
router.post('/results/:resultId/release-to-patient', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), (req, res, next) => {
  req.body = { ...req.body, target: 'patient' };
  return procedureController.releaseProcedureResult(req, res, next);
});
router.post('/results/:resultId/cancel', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.cancelProcedureResult);

router.get('/orders', authorize({ anyPermissions: procedureReadPermissions }), procedureController.listProcedureOrders);
router.get('/orders/:procedureOrderId', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getProcedureOrderDetail);
router.get('/orders/:procedureOrderId/timeline', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getProcedureTimeline);

router.post('/orders/:procedureOrderId/schedule', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.ORDERS.ACKNOWLEDGE] }), procedureController.scheduleProcedure);
router.post('/orders/:procedureOrderId/reschedule', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.PROCEDURE_ORDERS.UPDATE, PERMISSION.ORDERS.ACKNOWLEDGE] }), procedureController.rescheduleProcedure);
router.patch('/orders/:procedureOrderId/assign-performer', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.assignProcedurePerformer);
router.post('/orders/:procedureOrderId/start', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.START, PERMISSION.ORDERS.START] }), procedureController.startProcedure);
router.post('/orders/:procedureOrderId/complete', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.ORDERS.COMPLETE] }), procedureController.completeProcedure);
router.post('/orders/:procedureOrderId/cancel', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL] }), procedureController.cancelProcedure);
router.post('/orders/:procedureOrderId/no-show', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.NO_SHOW, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.noShowProcedure);

router.get('/orders/:procedureOrderId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.READ_PROCEDURE, PERMISSION.ATTACHMENTS.READ, ...procedureReadPermissions] }), procedureController.listProcedureAttachments);
router.post('/orders/:procedureOrderId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD] }), procedureController.uploadProcedureAttachment);
router.post('/orders/:procedureOrderId/attachments/:attachmentId/submit-review', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.submitProcedureFileReview);
router.post('/orders/:procedureOrderId/attachments/:attachmentId/approve', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.approveProcedureFile);
router.post('/orders/:procedureOrderId/attachments/:attachmentId/reject', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.rejectProcedureFile);
router.post('/orders/:procedureOrderId/attachments/:attachmentId/release-to-patient', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.releaseProcedureFileToPatient);
router.post('/orders/:procedureOrderId/attachments/:attachmentId/revoke-release', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.revokeProcedureFileRelease);
router.post('/orders/:procedureOrderId/attachments/:attachmentId/archive', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.archiveProcedureFile);
router.delete('/orders/:procedureOrderId/attachments/:attachmentId', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.deleteProcedureAttachment);

router.get('/orders/:procedureOrderId/charges', authorize({ anyPermissions: [PERMISSION.CHARGES.READ, ...procedureReadPermissions] }), procedureController.listProcedureCharges);
router.post('/orders/:procedureOrderId/charge', authorize({ anyPermissions: procedureChargeCreatePermissions }), procedureController.createProcedureCharge);

router.get('/orders/:procedureOrderId/result', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getProcedureResultByOrder);
router.post('/orders/:procedureOrderId/result', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.createProcedureResult);

router.get('/encounters/:encounterId/orders', authorize({ anyPermissions: procedureReadPermissions }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return procedureController.listProcedureOrders(req, res, next);
});
router.get('/encounters/:encounterId/summary', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ, ...procedureReadPermissions] }), procedureController.getEncounterProcedureSummary);
router.get('/patients/:patientId/history', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getPatientProcedureHistory);

module.exports = router;
