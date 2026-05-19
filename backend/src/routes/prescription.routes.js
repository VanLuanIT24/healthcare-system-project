const express = require('express');
const prescriptionController = require('../controllers/prescription.controller');
const pharmacyDispensingController = require('../controllers/pharmacy-dispensing.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('prescriptionId', validateObjectIdParam);
router.param('medicationId', validateObjectIdParam);
router.param('batchId', validateObjectIdParam);
router.param('dispenseId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('doctorId', validateObjectIdParam);
router.param('itemId', validateObjectIdParam);
router.param('refillRequestId', validateObjectIdParam);

router.use(authenticate);

router.get('/me', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PRESCRIPTIONS.SELF_READ] }), prescriptionController.getMyPrescriptions);
router.get('/me/:prescriptionId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PRESCRIPTIONS.SELF_READ] }), prescriptionController.getPrescriptionDetail);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/medications', authorize({ permissions: [PERMISSION.MEDICATIONS.READ] }), prescriptionController.listMedications);
router.get('/medications/search', authorize({ permissions: [PERMISSION.MEDICATIONS.READ] }), prescriptionController.searchMedications);
router.post('/medications', authorize({ permissions: [PERMISSION.MEDICATIONS.CREATE] }), prescriptionController.createMedication);
router.get('/medications/:medicationId/stock-selection', authorize({ anyPermissions: [PERMISSION.STOCK_BATCHES.SELECT_FOR_DISPENSE, PERMISSION.STOCK_BATCHES.READ] }), prescriptionController.selectStockBatch);
router.get('/medications/:medicationId', authorize({ permissions: [PERMISSION.MEDICATIONS.READ] }), prescriptionController.getMedicationDetail);
router.patch('/medications/:medicationId', authorize({ permissions: [PERMISSION.MEDICATIONS.UPDATE] }), prescriptionController.updateMedication);
router.patch('/medications/:medicationId/status', authorize({ anyPermissions: [PERMISSION.MEDICATIONS.UPDATE, PERMISSION.MEDICATIONS.MANAGE] }), prescriptionController.updateMedicationStatus);
router.post('/medications/:medicationId/retire', authorize({ anyPermissions: [PERMISSION.MEDICATIONS.RETIRE, PERMISSION.MEDICATIONS.MANAGE] }), prescriptionController.retireMedication);

router.get('/stock-batches', authorize({ permissions: [PERMISSION.STOCK_BATCHES.READ] }), prescriptionController.listStockBatches);
router.post('/stock-batches', authorize({ permissions: [PERMISSION.STOCK_BATCHES.CREATE] }), prescriptionController.createStockBatch);
router.get('/stock-batches/:batchId', authorize({ permissions: [PERMISSION.STOCK_BATCHES.READ] }), prescriptionController.getStockBatchDetail);
router.patch('/stock-batches/:batchId', authorize({ permissions: [PERMISSION.STOCK_BATCHES.UPDATE] }), prescriptionController.updateStockBatch);
router.post('/stock-batches/:batchId/adjustment', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT] }), prescriptionController.adjustInventory);
router.post('/stock-batches/:batchId/quarantine', authorize({ permissions: [PERMISSION.STOCK_BATCHES.QUARANTINE] }), prescriptionController.quarantineStockBatch);
router.post('/stock-batches/:batchId/release-quarantine', authorize({ permissions: [PERMISSION.STOCK_BATCHES.QUARANTINE] }), prescriptionController.releaseQuarantineStockBatch);
router.post('/stock-batches/:batchId/waste', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_DISPOSAL] }), prescriptionController.wasteStockBatch);
router.post('/stock-batches/:batchId/transfer-location', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_OUT] }), prescriptionController.transferStockBatchLocation);
router.get('/stock-batches/:batchId/recall-impact', authorize({ permissions: [PERMISSION.STOCK_BATCHES.READ] }), prescriptionController.getStockBatchRecallImpact);
router.post('/stock-batches/:batchId/expire', authorize({ permissions: [PERMISSION.STOCK_BATCHES.MARK_EXPIRED] }), prescriptionController.markBatchExpired);
router.post('/stock-batches/:batchId/recall', authorize({ permissions: [PERMISSION.STOCK_BATCHES.RECALL] }), prescriptionController.recallStockBatch);

router.post('/inventory/receipts', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RECEIPT] }), prescriptionController.receiveInventory);
router.post('/inventory/adjustments', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT] }), prescriptionController.adjustInventory);
router.get('/inventory/transactions', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED] }), prescriptionController.listInventoryTransactions);

router.get('/refill-requests', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PRESCRIPTIONS.VERIFY] }), prescriptionController.listRefillRequests);
router.get('/refill-requests/:refillRequestId', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PRESCRIPTIONS.VERIFY] }), prescriptionController.getRefillRequestDetail);
router.post('/refill-requests/:refillRequestId/approve', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.VERIFY, PERMISSION.PRESCRIPTIONS.CREATE] }), prescriptionController.approveRefillRequest);
router.post('/refill-requests/:refillRequestId/reject', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.VERIFY, PERMISSION.PRESCRIPTIONS.CREATE] }), prescriptionController.rejectRefillRequest);
router.post('/refill-requests/:refillRequestId/send-to-doctor', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.VERIFY, PERMISSION.PRESCRIPTIONS.CREATE] }), prescriptionController.sendRefillRequestToDoctor);
router.post('/refill-requests/:refillRequestId/convert-to-prescription', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.CREATE] }), prescriptionController.convertRefillRequestToPrescription);

router.get('/dispenses', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), prescriptionController.listDispenses);
router.get('/dispenses/:dispenseId', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), prescriptionController.getDispenseDetail);
router.post('/dispenses/:dispenseId/preview-completion-plan', authorize({ anyPermissions: [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.COMPLETE] }), prescriptionController.previewDispenseCompletionPlan);
router.post('/dispenses/:dispenseId/complete', authorize({ permissions: [PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/prescriptions/dispenses/:dispenseId/complete' }), prescriptionController.completeDispense);
router.post('/dispenses/:dispenseId/cancel', authorize({ permissions: [PERMISSION.DISPENSES.CANCEL] }), prescriptionController.cancelDispense);
router.post('/dispenses/:dispenseId/assign', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.CREATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.assignDispense);
router.post('/dispenses/:dispenseId/start-preparation', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.startPreparation);
router.post('/dispenses/:dispenseId/change-stage', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.changeStage);
router.post('/dispenses/:dispenseId/lock', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.lockDispense);
router.post('/dispenses/:dispenseId/unlock', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.unlockDispense);
router.get('/dispenses/:dispenseId/checklist', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), pharmacyDispensingController.getChecklist);
router.patch('/dispenses/:dispenseId/checklist/:code', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.updateChecklistItem);
router.post('/dispenses/:dispenseId/checklist/complete', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.completeChecklist);
router.post('/dispenses/:dispenseId/holds', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.CANCEL, PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/prescriptions/dispenses/:dispenseId/holds' }), pharmacyDispensingController.createHold);
router.post('/dispenses/:dispenseId/return-preview', authorize({ anyPermissions: [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.RETURN] }), pharmacyDispensingController.previewReturn);
router.post('/dispenses/:dispenseId/returns', authorize({ permissions: [PERMISSION.DISPENSES.RETURN] }), idempotencyRequired({ route: '/api/prescriptions/dispenses/:dispenseId/returns' }), pharmacyDispensingController.createReturn);
router.get('/dispenses/:dispenseId/label-preview', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), pharmacyDispensingController.labelPreview);
router.post('/dispenses/:dispenseId/print-labels', authorize({ anyPermissions: [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/prescriptions/dispenses/:dispenseId/print-labels' }), pharmacyDispensingController.printLabels);
router.post('/dispenses/:dispenseId/print-instructions', authorize({ anyPermissions: [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/prescriptions/dispenses/:dispenseId/print-instructions' }), pharmacyDispensingController.printInstructions);
router.get('/dispenses/:dispenseId/print-jobs', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), pharmacyDispensingController.getDispensePrintJobs);

router.get('/', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), prescriptionController.listPrescriptions);
router.get('/search', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), prescriptionController.searchPrescriptions);
router.post('/check-allergy-conflict', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN, PERMISSION.ALLERGIES.READ] }), prescriptionController.checkDrugAllergyConflict);
router.post('/check-interaction-conflict', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.checkDrugInteractionConflict);
router.post('/check-duplicate-medication', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.checkDuplicateMedicationInPrescription);
router.post('/calculate-item-quantity', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.calculatePrescriptionItemQuantity);
router.post('/', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.CREATE] }), idempotencyRequired({ route: '/api/prescriptions' }), prescriptionController.createPrescription);
router.post('/encounters/:encounterId/prescriptions', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.CREATE] }), idempotencyRequired({ route: '/api/prescriptions/encounters/:encounterId/prescriptions' }), (req, res, next) => {
  req.body.encounter_id = req.params.encounterId;
  return prescriptionController.createPrescription(req, res, next);
});
router.get('/encounter/:encounterId', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), prescriptionController.getEncounterPrescriptions);
router.get('/patient/:patientId', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED] }), prescriptionController.getPatientPrescriptionHistory);
router.get('/patient/:patientId/active', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED] }), prescriptionController.getPatientActivePrescriptions);
router.get('/doctor/:doctorId', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN] }), prescriptionController.getDoctorPrescriptions);
router.get('/:prescriptionId', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), prescriptionController.getPrescriptionDetail);
router.get('/:prescriptionId/summary', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), prescriptionController.getPrescriptionSummary);
router.patch('/:prescriptionId', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.updatePrescription);
router.post('/:prescriptionId/activate', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.CREATE] }), prescriptionController.activatePrescription);
router.post('/:prescriptionId/verify', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.VERIFY] }), prescriptionController.verifyPrescription);
router.post('/:prescriptionId/cancel', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CANCEL, PERMISSION.PRESCRIPTIONS.CANCEL_OWN, PERMISSION.PRESCRIPTIONS.CANCEL_BY_POLICY] }), prescriptionController.cancelPrescription);
router.post('/:prescriptionId/complete', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.UPDATE_OWN, PERMISSION.PRESCRIPTIONS.VERIFY] }), prescriptionController.completePrescription);
router.post('/:prescriptionId/dispenses', authorize({ permissions: [PERMISSION.DISPENSES.CREATE] }), idempotencyRequired({ route: '/api/prescriptions/:prescriptionId/dispenses' }), prescriptionController.createDispense);
router.post('/:prescriptionId/refill-requests', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.SELF_READ] }), prescriptionController.createRefillRequest);
router.post('/:prescriptionId/duplicate', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.CREATE] }), prescriptionController.duplicatePrescription);
router.post('/:prescriptionId/renew', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.CREATE] }), prescriptionController.renewPrescription);
router.get('/:prescriptionId/items', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), prescriptionController.listPrescriptionItems);
router.post('/:prescriptionId/items', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.addPrescriptionItems);
router.post('/items', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.addPrescriptionItem);
router.get('/items/:itemId', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.ENCOUNTERS.READ] }), prescriptionController.getPrescriptionItemDetail);
router.patch('/items/:itemId', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.updatePrescriptionItem);
router.post('/items/:itemId/stop', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.stopPrescriptionItem);
router.post('/items/:itemId/cancel', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CANCEL_OWN, PERMISSION.PRESCRIPTIONS.CANCEL_BY_POLICY] }), prescriptionController.cancelPrescriptionItem);
router.post('/items/:itemId/complete', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.completePrescriptionItem);
router.delete('/items/:itemId', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.removePrescriptionItem);

module.exports = router;
