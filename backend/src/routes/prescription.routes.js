const express = require('express');
const prescriptionController = require('../controllers/prescription.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/medications', authorize({ anyPermissions: ['medications.read', 'prescriptions.write'] }), prescriptionController.listMedications);
router.get('/medications/search', authorize({ anyPermissions: ['medications.read', 'prescriptions.write'] }), prescriptionController.searchMedications);
router.post('/medications', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.createMedication);
router.get('/medications/:medicationId', authorize({ anyPermissions: ['medications.read', 'prescriptions.write'] }), prescriptionController.getMedicationDetail);
router.patch('/medications/:medicationId', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.updateMedication);
router.patch('/medications/:medicationId/status', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.updateMedicationStatus);

router.get('/', authorize({ anyPermissions: ['prescriptions.write', 'encounters.read'] }), prescriptionController.listPrescriptions);
router.get('/search', authorize({ anyPermissions: ['prescriptions.write', 'encounters.read'] }), prescriptionController.searchPrescriptions);
router.post('/check-allergy-conflict', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.checkDrugAllergyConflict);
router.post('/check-interaction-conflict', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.checkDrugInteractionConflict);
router.post('/check-duplicate-medication', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.checkDuplicateMedicationInPrescription);
router.post('/calculate-item-quantity', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.calculatePrescriptionItemQuantity);
router.post('/', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.createPrescription);
router.get('/encounter/:encounterId', authorize({ anyPermissions: ['prescriptions.write', 'encounters.read'] }), prescriptionController.getEncounterPrescriptions);
router.get('/patient/:patientId', authorize({ anyPermissions: ['prescriptions.write', 'patients.read'] }), prescriptionController.getPatientPrescriptionHistory);
router.get('/patient/:patientId/active', authorize({ anyPermissions: ['prescriptions.write', 'patients.read'] }), prescriptionController.getPatientActivePrescriptions);
router.get('/doctor/:doctorId', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.getDoctorPrescriptions);
router.get('/:prescriptionId', authorize({ anyPermissions: ['prescriptions.write', 'encounters.read'] }), prescriptionController.getPrescriptionDetail);
router.get('/:prescriptionId/summary', authorize({ anyPermissions: ['prescriptions.write', 'encounters.read'] }), prescriptionController.getPrescriptionSummary);
router.patch('/:prescriptionId', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.updatePrescription);
router.post('/:prescriptionId/activate', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.activatePrescription);
router.post('/:prescriptionId/cancel', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.cancelPrescription);
router.post('/:prescriptionId/complete', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.completePrescription);
router.post('/:prescriptionId/duplicate', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.duplicatePrescription);
router.post('/:prescriptionId/renew', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.renewPrescription);
router.get('/:prescriptionId/items', authorize({ anyPermissions: ['prescriptions.write', 'encounters.read'] }), prescriptionController.listPrescriptionItems);
router.post('/items', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.addPrescriptionItem);
router.get('/items/:itemId', authorize({ anyPermissions: ['prescriptions.write', 'encounters.read'] }), prescriptionController.getPrescriptionItemDetail);
router.patch('/items/:itemId', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.updatePrescriptionItem);
router.post('/items/:itemId/stop', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.stopPrescriptionItem);
router.post('/items/:itemId/cancel', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.cancelPrescriptionItem);
router.post('/items/:itemId/complete', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.completePrescriptionItem);
router.delete('/items/:itemId', authorize({ permissions: ['prescriptions.write'] }), prescriptionController.removePrescriptionItem);

module.exports = router;
