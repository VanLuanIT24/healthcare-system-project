const express = require('express');
const laboratoryController = require('../controllers/laboratory.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('resultId', validateObjectIdParam);
router.param('labOrderId', validateObjectIdParam);
router.param('specimenId', validateObjectIdParam);
router.param('itemId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('correctionId', validateObjectIdParam);
router.param('catalogTestId', validateObjectIdParam);
router.param('slaRuleId', validateObjectIdParam);

const labReadPermissions = [
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ_OWN,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
];

router.use(authenticate);

router.get(
  '/me/results',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.LAB_RESULTS.SELF_READ_RELEASED] }),
  laboratoryController.getMyLabResults,
);
router.get(
  '/me/results/:resultId',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.LAB_RESULTS.SELF_READ_RELEASED] }),
  laboratoryController.getLabResultDetail,
);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/workspace/summary', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getLabWorkspaceSummary);
router.get('/workspace/overdue', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getLabWorkspaceOverdue);

router.get('/catalog/tests', authorize({ anyPermissions: labReadPermissions }), laboratoryController.listLabTestCatalog);
router.post('/catalog/tests', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.createLabTestCatalog);
router.get('/catalog/tests/:catalogTestId', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getLabTestCatalogDetail);
router.patch('/catalog/tests/:catalogTestId', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.updateLabTestCatalog);
router.post('/catalog/tests/:catalogTestId/activate', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.activateLabTestCatalog);
router.post('/catalog/tests/:catalogTestId/deactivate', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.deactivateLabTestCatalog);

router.get('/sla/rules', authorize({ anyPermissions: labReadPermissions }), laboratoryController.listLabSlaRules);
router.post('/sla/rules', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.createLabSlaRule);
router.patch('/sla/rules/:slaRuleId', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.updateLabSlaRule);

router.get('/result-corrections', authorize({ anyPermissions: labReadPermissions }), laboratoryController.listLabResultCorrections);
router.get('/result-corrections/:correctionId', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getLabResultCorrectionDetail);
router.post('/result-corrections/:correctionId/resolve', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.resolveLabResultCorrection);
router.post('/result-corrections/:correctionId/cancel', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.cancelLabResultCorrection);

router.get('/orders', authorize({ anyPermissions: labReadPermissions }), laboratoryController.listLabOrders);
router.get('/orders/:labOrderId', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getLabOrderDetail);
router.post('/orders/:labOrderId/acknowledge', authorize({ anyPermissions: [PERMISSION.LAB_ORDERS.ACKNOWLEDGE, PERMISSION.ORDERS.ACKNOWLEDGE] }), laboratoryController.acknowledgeLabOrder);
router.post('/orders/:labOrderId/cancel', authorize({ anyPermissions: [PERMISSION.LAB_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL] }), laboratoryController.cancelLabOrder);
router.post('/orders/:labOrderId/print-labels', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT] }), laboratoryController.printLabOrderLabels);

router.post('/orders/:labOrderId/specimens', authorize({ anyPermissions: [PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT] }), laboratoryController.createSpecimen);
router.post('/orders/:labOrderId/collect', authorize({ anyPermissions: [PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT] }), laboratoryController.collectLabOrderSpecimen);

router.get('/specimens', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, ...labReadPermissions] }), laboratoryController.listSpecimens);
router.get('/specimens/stats', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, ...labReadPermissions] }), laboratoryController.getSpecimenStats);
router.get('/specimens/lookup', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, ...labReadPermissions] }), laboratoryController.lookupSpecimen);
router.post('/specimens/bulk/print-labels', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT] }), laboratoryController.printSpecimenLabels);
router.post('/specimens/bulk/receive', authorize({ permissions: [PERMISSION.SPECIMENS.RECEIVE] }), laboratoryController.bulkReceiveSpecimens);
router.post('/specimens/bulk/reject', authorize({ permissions: [PERMISSION.SPECIMENS.REJECT] }), laboratoryController.bulkRejectSpecimens);
router.get('/specimens/:specimenId', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, ...labReadPermissions] }), laboratoryController.getSpecimenDetail);
router.get('/specimens/:specimenId/timeline', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, ...labReadPermissions] }), laboratoryController.getSpecimenTimeline);
router.get('/specimens/:specimenId/custody', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, ...labReadPermissions] }), laboratoryController.getSpecimenCustody);
router.post('/specimens/:specimenId/custody-events', authorize({ anyPermissions: [PERMISSION.SPECIMENS.COLLECT, PERMISSION.SPECIMENS.RECEIVE, PERMISSION.SPECIMENS.STORE] }), laboratoryController.createSpecimenCustodyEvent);
router.post('/specimens/:specimenId/print-label', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT] }), laboratoryController.printSpecimenLabel);
router.get('/specimens/:specimenId/label-pdf', authorize({ anyPermissions: [PERMISSION.SPECIMENS.READ, ...labReadPermissions] }), laboratoryController.getSpecimenLabelPdf);
router.post('/specimens/:specimenId/request-recollection', authorize({ anyPermissions: [PERMISSION.SPECIMENS.CREATE, PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT] }), laboratoryController.requestSpecimenRecollection);
router.post('/specimens/:specimenId/receive', authorize({ permissions: [PERMISSION.SPECIMENS.RECEIVE] }), laboratoryController.receiveSpecimen);
router.post('/specimens/:specimenId/reject', authorize({ permissions: [PERMISSION.SPECIMENS.REJECT] }), laboratoryController.rejectSpecimen);
router.post('/specimens/:specimenId/process', authorize({ anyPermissions: [PERMISSION.SPECIMENS.PROCESS, PERMISSION.LAB_ORDERS.PROCESS] }), laboratoryController.processSpecimen);
router.post('/specimens/:specimenId/store', authorize({ permissions: [PERMISSION.SPECIMENS.STORE] }), laboratoryController.storeSpecimen);
router.post('/specimens/:specimenId/dispose', authorize({ permissions: [PERMISSION.SPECIMENS.DISPOSE] }), laboratoryController.disposeSpecimen);

router.post('/orders/:labOrderId/results', authorize({ permissions: [PERMISSION.LAB_RESULTS.CREATE] }), laboratoryController.createLabResult);
router.get('/results', authorize({ anyPermissions: labReadPermissions }), laboratoryController.listLabResults);
router.get('/results/:resultId', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getLabResultDetail);
router.get('/results/:resultId/pdf', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getLabResultPdf);
router.post('/results/:resultId/print', authorize({ anyPermissions: labReadPermissions }), laboratoryController.printLabResult);
router.get('/results/:resultId/versions', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getLabResultVersions);
router.patch('/results/:resultId', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.WRITE, PERMISSION.LAB_RESULTS.UPDATE_OWN] }), laboratoryController.updateLabResult);
router.post('/results/:resultId/validate-finalize', authorize({ permissions: [PERMISSION.LAB_RESULTS.FINALIZE] }), laboratoryController.validateLabResultFinalize);
router.post('/results/:resultId/finalize', authorize({ permissions: [PERMISSION.LAB_RESULTS.FINALIZE] }), laboratoryController.finalizeLabResult);
router.post('/results/:resultId/amend', authorize({ permissions: [PERMISSION.LAB_RESULTS.AMEND] }), laboratoryController.amendLabResult);
router.post('/results/:resultId/request-correction', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.requestLabResultCorrection);
router.post('/results/:resultId/acknowledge-critical', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.CRITICAL_ACKNOWLEDGE, PERMISSION.LAB_RESULTS.READ_FINAL] }), laboratoryController.acknowledgeCriticalLabResult);
router.post('/results/:resultId/cancel', authorize({ permissions: [PERMISSION.LAB_RESULTS.CANCEL] }), laboratoryController.cancelLabResult);
router.post('/results/:resultId/entered-in-error', authorize({ permissions: [PERMISSION.LAB_RESULTS.ENTERED_IN_ERROR] }), laboratoryController.markLabResultEnteredInError);
router.post('/results/:resultId/release-to-patient', authorize({ permissions: [PERMISSION.LAB_RESULTS.RELEASE_TO_PATIENT] }), laboratoryController.releaseLabResultToPatient);
router.get('/results/:resultId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.READ_LAB, PERMISSION.ATTACHMENTS.READ, ...labReadPermissions] }), laboratoryController.listLabResultAttachments);
router.post('/results/:resultId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_LAB, PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.ATTACHMENTS.CREATE] }), laboratoryController.uploadLabResultAttachment);

router.post('/results/:resultId/items', authorize({ permissions: [PERMISSION.LAB_RESULT_ITEMS.CREATE] }), laboratoryController.createLabResultItem);
router.patch('/result-items/:itemId', authorize({ anyPermissions: [PERMISSION.LAB_RESULT_ITEMS.UPDATE, PERMISSION.LAB_RESULTS.WRITE] }), laboratoryController.updateLabResultItem);
router.delete('/result-items/:itemId', authorize({ permissions: [PERMISSION.LAB_RESULT_ITEMS.DELETE] }), laboratoryController.removeLabResultItem);

router.get('/encounters/:encounterId/orders', authorize({ anyPermissions: labReadPermissions }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return laboratoryController.listLabOrders(req, res, next);
});
router.get('/encounters/:encounterId/results', authorize({ anyPermissions: labReadPermissions }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return laboratoryController.listLabResults(req, res, next);
});
router.get('/encounters/:encounterId/summary', authorize({ anyPermissions: labReadPermissions }), laboratoryController.getEncounterLabSummary);
router.get('/patients/:patientId/results', authorize({ anyPermissions: labReadPermissions }), (req, res, next) => {
  req.query.patient_id = req.params.patientId;
  return laboratoryController.listLabResults(req, res, next);
});

module.exports = router;
