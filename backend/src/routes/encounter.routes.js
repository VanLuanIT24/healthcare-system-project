const express = require('express');
const encounterController = require('../controllers/encounter.controller');
const orderController = require('../controllers/order.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('patientId', validateObjectIdParam);
router.param('doctorId', validateObjectIdParam);
router.param('appointmentId', validateObjectIdParam);
router.param('ticketId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ_DEPARTMENT] }), encounterController.listEncounters);
router.get('/search', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ_DEPARTMENT] }), encounterController.searchEncounters);
router.post('/', authorize({ permissions: [PERMISSION.ENCOUNTERS.CREATE] }), idempotencyRequired({ route: '/api/encounters' }), encounterController.createEncounter);
router.get('/today', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ_DEPARTMENT] }), encounterController.getTodayEncounters);
router.get('/patient/:patientId', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_ASSIGNED, PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED] }), encounterController.getPatientEncounterHistory);
router.get('/doctor/:doctorId', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), encounterController.getDoctorEncounters);
router.get('/doctor/:doctorId/active', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), encounterController.getDoctorActiveEncounter);
router.post('/appointment/:appointmentId', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.CREATE_FROM_CHECKIN, PERMISSION.ENCOUNTERS.CREATE, PERMISSION.APPOINTMENTS.CHECKIN] }), idempotencyRequired({ route: '/api/encounters/appointment/:appointmentId' }), encounterController.createEncounterFromAppointment);
router.post('/queue/:ticketId', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.CREATE_FROM_CHECKIN, PERMISSION.ENCOUNTERS.CREATE, PERMISSION.QUEUE.START_SERVICE] }), idempotencyRequired({ route: '/api/encounters/queue/:ticketId' }), encounterController.createEncounterFromQueueTicket);
router.get('/:encounterId/orders', authorize({ anyPermissions: [PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_OWN, PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), orderController.listOrdersByEncounter);
router.post('/:encounterId/orders', authorize({ anyPermissions: [PERMISSION.ORDERS.CREATE, PERMISSION.ORDERS.CREATE_LAB, PERMISSION.ORDERS.CREATE_IMAGING, PERMISSION.ORDERS.CREATE_PROCEDURE, PERMISSION.ORDERS.CREATE_MEDICATION, PERMISSION.ORDERS.CREATE_SERVICE, PERMISSION.PRESCRIPTIONS.CREATE] }), idempotencyRequired({ route: '/api/encounters/:encounterId/orders' }), orderController.createOrderFromEncounter);
router.get('/:encounterId/orders/summary', authorize({ anyPermissions: [PERMISSION.ORDERS.SUMMARY_READ, PERMISSION.ORDERS.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), orderController.getEncounterOrderSummary);
router.get('/:encounterId', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ_DEPARTMENT] }), encounterController.getEncounterDetail);
router.get('/:encounterId/summary', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ_SUMMARY] }), encounterController.getEncounterSummary);
router.get('/:encounterId/timeline', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_ASSIGNED] }), encounterController.getEncounterTimeline);
router.get('/:encounterId/can-start', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.START] }), encounterController.checkEncounterCanStart);
router.get('/:encounterId/can-complete', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.COMPLETE, PERMISSION.ENCOUNTERS.COMPLETE_OWN] }), encounterController.checkEncounterCanComplete);
router.get('/:encounterId/editable', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE_OWN] }), encounterController.checkEncounterEditable);
router.get('/:encounterId/has-signed-consultation', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.CONSULTATIONS.READ, PERMISSION.CONSULTATIONS.READ_OWN] }), encounterController.checkEncounterHasSignedConsultation);
router.get('/:encounterId/has-active-prescription', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.READ, PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN] }), encounterController.checkEncounterHasActivePrescription);
router.patch('/:encounterId', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE_OWN] }), encounterController.updateEncounter);
router.post('/:encounterId/arrive', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.START, PERMISSION.ENCOUNTERS.UPDATE] }), encounterController.arriveEncounter);
router.post('/:encounterId/start', authorize({ permissions: [PERMISSION.ENCOUNTERS.START] }), encounterController.startEncounter);
router.post('/:encounterId/reopen', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE_OWN] }), encounterController.reopenEncounter);
router.post('/:encounterId/hold', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE_OWN] }), encounterController.holdEncounter);
router.post('/:encounterId/resume', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE_OWN] }), encounterController.resumeEncounter);
router.post('/:encounterId/complete', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.COMPLETE, PERMISSION.ENCOUNTERS.COMPLETE_OWN] }), encounterController.completeEncounter);
router.post('/:encounterId/cancel', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.CANCEL, PERMISSION.ENCOUNTERS.CANCEL_OWN] }), encounterController.cancelEncounter);
router.post('/:encounterId/link-appointment', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.APPOINTMENTS.UPDATE] }), encounterController.linkAppointmentToEncounter);
router.post('/:encounterId/attach-queue-ticket', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.QUEUE.START_SERVICE] }), encounterController.attachQueueTicketToEncounter);

module.exports = router;
