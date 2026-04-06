const express = require('express');
const encounterController = require('../controllers/encounter.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.listEncounters);
router.get('/search', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.searchEncounters);
router.post('/', authorize({ permissions: ['encounters.write'] }), encounterController.createEncounter);
router.get('/today', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.getTodayEncounters);
router.get('/patient/:patientId', authorize({ anyPermissions: ['encounters.read', 'patients.read'] }), encounterController.getPatientEncounterHistory);
router.get('/doctor/:doctorId', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.getDoctorEncounters);
router.post('/appointment/:appointmentId', authorize({ anyPermissions: ['encounters.write', 'appointments.write'] }), encounterController.createEncounterFromAppointment);
router.post('/queue/:ticketId', authorize({ anyPermissions: ['encounters.write', 'queue.manage'] }), encounterController.createEncounterFromQueueTicket);
router.get('/:encounterId', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.getEncounterDetail);
router.get('/:encounterId/summary', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.getEncounterSummary);
router.get('/:encounterId/timeline', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.getEncounterTimeline);
router.get('/:encounterId/can-start', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.checkEncounterCanStart);
router.get('/:encounterId/can-complete', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.checkEncounterCanComplete);
router.get('/:encounterId/editable', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.checkEncounterEditable);
router.get('/:encounterId/has-signed-consultation', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.checkEncounterHasSignedConsultation);
router.get('/:encounterId/has-active-prescription', authorize({ anyPermissions: ['encounters.read', 'encounters.write'] }), encounterController.checkEncounterHasActivePrescription);
router.patch('/:encounterId', authorize({ permissions: ['encounters.write'] }), encounterController.updateEncounter);
router.post('/:encounterId/arrive', authorize({ permissions: ['encounters.write'] }), encounterController.arriveEncounter);
router.post('/:encounterId/start', authorize({ permissions: ['encounters.write'] }), encounterController.startEncounter);
router.post('/:encounterId/reopen', authorize({ permissions: ['encounters.write'] }), encounterController.reopenEncounter);
router.post('/:encounterId/hold', authorize({ permissions: ['encounters.write'] }), encounterController.holdEncounter);
router.post('/:encounterId/complete', authorize({ permissions: ['encounters.write'] }), encounterController.completeEncounter);
router.post('/:encounterId/cancel', authorize({ permissions: ['encounters.write'] }), encounterController.cancelEncounter);
router.post('/:encounterId/link-appointment', authorize({ anyPermissions: ['encounters.write', 'appointments.write'] }), encounterController.linkAppointmentToEncounter);
router.post('/:encounterId/attach-queue-ticket', authorize({ anyPermissions: ['encounters.write', 'queue.manage'] }), encounterController.attachQueueTicketToEncounter);

module.exports = router;
