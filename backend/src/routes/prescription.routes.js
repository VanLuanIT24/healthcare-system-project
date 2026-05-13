const express = require('express');
const prescriptionController = require('../controllers/prescription.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('prescriptionId', validateObjectIdParam);
router.param('medicationId', validateObjectIdParam);
router.param('batchId', validateObjectIdParam);
router.param('dispenseId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('doctorId', validateObjectIdParam);
router.param('itemId', validateObjectIdParam);

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
router.post('/stock-batches/:batchId/expire', authorize({ permissions: [PERMISSION.STOCK_BATCHES.MARK_EXPIRED] }), prescriptionController.markBatchExpired);
router.post('/stock-batches/:batchId/recall', authorize({ permissions: [PERMISSION.STOCK_BATCHES.RECALL] }), prescriptionController.recallStockBatch);

router.post('/inventory/receipts', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RECEIPT] }), prescriptionController.receiveInventory);
router.post('/inventory/adjustments', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT] }), prescriptionController.adjustInventory);
router.get('/inventory/transactions', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED] }), prescriptionController.listInventoryTransactions);

router.get('/dispenses', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), prescriptionController.listDispenses);
router.get('/dispenses/:dispenseId', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), prescriptionController.getDispenseDetail);
router.post('/dispenses/:dispenseId/complete', authorize({ permissions: [PERMISSION.DISPENSES.COMPLETE] }), prescriptionController.completeDispense);
router.post('/dispenses/:dispenseId/cancel', authorize({ permissions: [PERMISSION.DISPENSES.CANCEL] }), prescriptionController.cancelDispense);

router.get('/', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), prescriptionController.listPrescriptions);
router.get('/search', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), prescriptionController.searchPrescriptions);
router.post('/check-allergy-conflict', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN, PERMISSION.ALLERGIES.READ] }), prescriptionController.checkDrugAllergyConflict);
router.post('/check-interaction-conflict', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.checkDrugInteractionConflict);
router.post('/check-duplicate-medication', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.checkDuplicateMedicationInPrescription);
router.post('/calculate-item-quantity', authorize({ anyPermissions: [PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN] }), prescriptionController.calculatePrescriptionItemQuantity);
router.post('/', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.CREATE] }), prescriptionController.createPrescription);
router.post('/encounters/:encounterId/prescriptions', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.CREATE] }), (req, res, next) => {
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
router.post('/:prescriptionId/dispenses', authorize({ permissions: [PERMISSION.DISPENSES.CREATE] }), prescriptionController.createDispense);
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
