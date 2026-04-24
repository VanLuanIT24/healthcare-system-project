const express = require('express');
const patientController = require('../controllers/patient.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);

router.get('/me/profile', authorize({ actorTypes: ['patient'] }), patientController.getMyPatientProfile);
router.patch('/me/profile', authorize({ actorTypes: ['patient'] }), patientController.updateMyPatientProfile);
router.get('/me/appointments', authorize({ actorTypes: ['patient'] }), patientController.getMyAppointments);
router.get('/me/encounters', authorize({ actorTypes: ['patient'] }), patientController.getMyEncounters);
router.get('/me/prescriptions', authorize({ actorTypes: ['patient'] }), patientController.getMyPrescriptions);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: ['patients.read', 'patients.write'] }), patientController.listPatients);
router.get('/search', authorize({ anyPermissions: ['patients.read', 'patients.write'] }), patientController.searchPatients);
router.post('/', authorize({ permissions: ['patients.write'] }), patientController.createPatient);
router.get('/duplicates', authorize({ anyPermissions: ['patients.read', 'patients.write'] }), patientController.detectDuplicatePatients);
router.get('/:patientId', authorize({ anyPermissions: ['patients.read', 'patients.write'] }), patientController.getPatientDetail);
router.get('/:patientId/summary', authorize({ anyPermissions: ['patients.read', 'patients.write'] }), patientController.getPatientSummary);
router.get('/:patientId/timeline', authorize({ anyPermissions: ['patients.read', 'patients.write'] }), patientController.getPatientTimeline);
router.get('/:patientId/can-book', authorize({ anyPermissions: ['patients.read', 'patients.write', 'appointments.read'] }), patientController.checkPatientCanBookAppointment);
router.patch('/:patientId', authorize({ permissions: ['patients.write'] }), patientController.updatePatient);
router.patch('/:patientId/status', authorize({ permissions: ['patients.write'] }), patientController.updatePatientStatus);
router.post('/:patientId/archive', authorize({ permissions: ['patients.write'] }), patientController.archivePatient);

router.post('/:patientId/identifiers', authorize({ permissions: ['patients.write'] }), patientController.addPatientIdentifier);
router.get('/:patientId/identifiers', authorize({ anyPermissions: ['patients.read', 'patients.write'] }), patientController.listPatientIdentifiers);
router.get(
  '/:patientId/identifiers/:identifierId',
  authorize({ anyPermissions: ['patients.read', 'patients.write'] }),
  patientController.getPatientIdentifierDetail,
);
router.patch('/:patientId/identifiers/:identifierId', authorize({ permissions: ['patients.write'] }), patientController.updatePatientIdentifier);
router.delete('/:patientId/identifiers/:identifierId', authorize({ permissions: ['patients.write'] }), patientController.removePatientIdentifier);
router.post(
  '/:patientId/identifiers/:identifierId/set-primary',
  authorize({ permissions: ['patients.write'] }),
  patientController.setPrimaryPatientIdentifier,
);

router.post('/:patientId/link-account', authorize({ permissions: ['patients.write'] }), patientController.linkUserAccountToPatient);
router.get('/:patientId/appointments', authorize({ anyPermissions: ['patients.read', 'appointments.read'] }), patientController.getPatientAppointmentHistory);
router.get('/:patientId/encounters', authorize({ anyPermissions: ['patients.read', 'encounters.read'] }), patientController.getPatientEncounterHistory);
router.get('/:patientId/prescriptions', authorize({ anyPermissions: ['patients.read', 'prescriptions.write'] }), patientController.getPatientPrescriptionHistory);

module.exports = router;
