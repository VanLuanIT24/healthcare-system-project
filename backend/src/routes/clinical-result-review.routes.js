const express = require('express');
const clinicalResultReviewController = require('../controllers/clinical-result-review.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('id', validateObjectIdParam);

const reviewReadPermissions = [
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ,
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
];

const finalizePermissions = [
  PERMISSION.LAB_RESULTS.FINALIZE,
  PERMISSION.IMAGING_REPORTS.FINALIZE,
  PERMISSION.PROCEDURE_ORDERS.COMPLETE,
  PERMISSION.PROCEDURE_ORDERS.UPDATE,
];

const releasePermissions = [
  PERMISSION.LAB_RESULTS.RELEASE_TO_PATIENT,
  PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT,
  PERMISSION.PROCEDURE_ORDERS.COMPLETE,
  PERMISSION.PROCEDURE_ORDERS.UPDATE,
];

const amendPermissions = [
  PERMISSION.LAB_RESULTS.AMEND,
  PERMISSION.LAB_RESULTS.WRITE,
  PERMISSION.IMAGING_REPORTS.AMEND,
  PERMISSION.IMAGING_REPORTS.WRITE,
  PERMISSION.PROCEDURE_ORDERS.COMPLETE,
  PERMISSION.PROCEDURE_ORDERS.UPDATE,
];

const criticalPermissions = [
  PERMISSION.LAB_RESULTS.CRITICAL_ACKNOWLEDGE,
  PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.UPDATE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/summary', authorize({ anyPermissions: reviewReadPermissions }), clinicalResultReviewController.getReviewSummary);
router.get('/worklist', authorize({ anyPermissions: reviewReadPermissions }), clinicalResultReviewController.getReviewWorklist);
router.get('/audit-trail', authorize({ anyPermissions: reviewReadPermissions }), clinicalResultReviewController.getAuditTrail);
router.post('/bulk-action', authorize({ anyPermissions: [...finalizePermissions, ...releasePermissions, ...amendPermissions, ...criticalPermissions] }), clinicalResultReviewController.bulkAction);

router.get('/:type/:id', authorize({ anyPermissions: reviewReadPermissions }), clinicalResultReviewController.getReviewDetail);
router.post('/:type/:id/validate-finalize', authorize({ anyPermissions: [...reviewReadPermissions, ...finalizePermissions] }), clinicalResultReviewController.validateFinalize);
router.post('/:type/:id/finalize', authorize({ anyPermissions: finalizePermissions }), clinicalResultReviewController.finalizeResult);
router.post('/:type/:id/release-to-doctor', authorize({ anyPermissions: [...releasePermissions, ...finalizePermissions] }), clinicalResultReviewController.releaseToDoctor);
router.post('/:type/:id/doctor-read', authorize({ anyPermissions: reviewReadPermissions }), clinicalResultReviewController.markDoctorRead);
router.post('/:type/:id/doctor-acknowledge', authorize({ anyPermissions: criticalPermissions }), clinicalResultReviewController.doctorAcknowledge);
router.post('/:type/:id/release-to-patient', authorize({ anyPermissions: releasePermissions }), clinicalResultReviewController.releaseToPatient);
router.post('/:type/:id/revoke-patient-release', authorize({ anyPermissions: releasePermissions }), clinicalResultReviewController.revokePatientRelease);
router.post('/:type/:id/acknowledge-critical', authorize({ anyPermissions: criticalPermissions }), clinicalResultReviewController.acknowledgeCritical);
router.post('/:type/:id/request-amend', authorize({ anyPermissions: amendPermissions }), clinicalResultReviewController.requestAmend);

module.exports = router;
