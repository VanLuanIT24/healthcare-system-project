const express = require('express');
const appointmentController = require('../controllers/appointment.controller');
const appointmentWaitlistController = require('../controllers/appointment-waitlist.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');
const domainValidators = require('../validators');

const router = express.Router();

router.param('appointmentId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('doctorId', validateObjectIdParam);
router.param('departmentId', validateObjectIdParam);
router.param('waitlistId', validateObjectIdParam);

router.use(authenticate);

router.get('/my', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.getMyAppointments);
router.get('/my/summary', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.getMyAppointmentSummary);
router.post('/portal', authorize({ actorTypes: ['patient', 'patient_relative'] }), domainValidators.appointment.request.booking, idempotencyRequired({ route: '/api/appointments/portal' }), appointmentController.createAppointmentFromPatientPortal);
router.post('/me/waitlist', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.APPOINTMENTS.SELF_CREATE] }), appointmentWaitlistController.createWaitlist);
router.get('/me/waitlist', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.APPOINTMENTS.SELF_READ] }), appointmentWaitlistController.listWaitlist);
router.get('/my/:appointmentId', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.getAppointmentDetail);
router.get('/my/:appointmentId/timeline', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.getMyAppointmentTimeline);
router.get('/my/:appointmentId/actions', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.getMyAppointmentActions);
router.post('/my/:appointmentId/cancel', authorize({ actorTypes: ['patient'] }), appointmentController.cancelAppointment);
router.post('/my/:appointmentId/reschedule', authorize({ actorTypes: ['patient'] }), appointmentController.rescheduleAppointment);
router.post('/my/:appointmentId/check-in', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.checkInAppointment);
router.post('/my/:appointmentId/queue-ticket', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.createQueueTicketFromAppointment);
router.post('/me/:appointmentId/check-in', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.checkInAppointment);
router.post('/me/:appointmentId/queue-ticket', authorize({ actorTypes: ['patient', 'patient_relative'] }), appointmentController.createQueueTicketFromAppointment);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.listAppointments);
router.get('/search', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.searchAppointments);
router.get('/summary', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.REPORTS.APPOINTMENTS_READ] }), appointmentController.getAppointmentSummary);
router.post('/validate-slot', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE, PERMISSION.SCHEDULE_SLOTS.READ] }), appointmentController.validateAppointmentSlot);
router.post('/check-doctor-availability', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE, PERMISSION.SCHEDULES.READ] }), appointmentController.checkDoctorAvailability);
router.post('/check-patient-duplicate', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE] }), appointmentController.checkPatientDuplicateBooking);
router.post('/validate-time', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE] }), appointmentController.validateAppointmentTime);
router.post('/validate-status-transition', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.UPDATE, PERMISSION.APPOINTMENTS.UPDATE_BASIC] }), domainValidators.appointment.request.statusTransition, appointmentController.validateAppointmentStatusTransition);
router.post('/check-doctor-conflict', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE, PERMISSION.SCHEDULES.READ] }), appointmentController.checkAppointmentConflictForDoctor);
router.post('/check-patient-conflict', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE] }), appointmentController.checkAppointmentConflictForPatient);
router.post('/', authorize({ permissions: [PERMISSION.APPOINTMENTS.CREATE] }), domainValidators.appointment.request.booking, idempotencyRequired({ route: '/api/appointments' }), appointmentController.createAppointment);
router.post('/staff-create', authorize({ permissions: [PERMISSION.APPOINTMENTS.CREATE] }), domainValidators.appointment.request.booking, idempotencyRequired({ route: '/api/appointments/staff-create' }), appointmentController.createAppointmentByStaff);
router.get('/waitlist', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT] }), appointmentWaitlistController.listWaitlist);
router.post('/waitlist/:waitlistId/offer-slot', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.CREATE, PERMISSION.SCHEDULE_SLOTS.READ] }), appointmentWaitlistController.offerSlot);
router.post('/waitlist/:waitlistId/book', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.CREATE] }), appointmentWaitlistController.bookWaitlist);
router.post('/waitlist/:waitlistId/cancel', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.CANCEL, PERMISSION.APPOINTMENTS.CANCEL_BY_POLICY] }), appointmentWaitlistController.cancelWaitlist);
router.post('/bulk-confirm', authorize({ permissions: [PERMISSION.APPOINTMENTS.CONFIRM] }), appointmentController.bulkConfirmAppointments);
router.post('/bulk-cancel', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.CANCEL, PERMISSION.APPOINTMENTS.CANCEL_BY_POLICY] }), appointmentController.bulkCancelAppointments);
router.get('/patient/:patientId', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED] }), appointmentController.listAppointmentsByPatient);
router.get('/doctor/:doctorId', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_OWN, PERMISSION.ENCOUNTERS.READ] }), appointmentController.listAppointmentsByDoctor);
router.get('/department/:departmentId', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT] }), appointmentController.listAppointmentsByDepartment);
router.get('/by-date', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.listAppointmentsByDate);
router.get('/upcoming', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.listUpcomingAppointments);
router.get('/today', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.listTodayAppointments);

router.get('/:appointmentId', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.getAppointmentDetail);
router.get('/:appointmentId/timeline', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.getAppointmentTimeline);
router.get('/:appointmentId/can-update', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.UPDATE, PERMISSION.APPOINTMENTS.UPDATE_BASIC] }), appointmentController.checkAppointmentCanBeUpdated);
router.get('/:appointmentId/can-cancel', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CANCEL, PERMISSION.APPOINTMENTS.CANCEL_BY_POLICY] }), appointmentController.checkAppointmentCanBeCancelled);
router.get('/:appointmentId/can-reschedule', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.RESCHEDULE, PERMISSION.APPOINTMENTS.RESCHEDULE_BY_POLICY] }), appointmentController.checkAppointmentCanBeRescheduled);
router.get('/:appointmentId/can-check-in', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CHECKIN] }), appointmentController.checkAppointmentCanBeCheckedIn);
router.patch('/:appointmentId', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.UPDATE, PERMISSION.APPOINTMENTS.UPDATE_BASIC] }), appointmentController.updateAppointment);
router.post('/:appointmentId/confirm', authorize({ permissions: [PERMISSION.APPOINTMENTS.CONFIRM] }), appointmentController.confirmAppointment);
router.post('/:appointmentId/cancel', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.CANCEL, PERMISSION.APPOINTMENTS.CANCEL_BY_POLICY] }), appointmentController.cancelAppointment);
router.post('/:appointmentId/reschedule', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.RESCHEDULE, PERMISSION.APPOINTMENTS.RESCHEDULE_BY_POLICY] }), appointmentController.rescheduleAppointment);
router.post('/:appointmentId/check-in', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.CHECKIN, PERMISSION.QUEUE.CREATE] }), appointmentController.checkInAppointment);
router.post('/:appointmentId/no-show', authorize({ permissions: [PERMISSION.APPOINTMENTS.NO_SHOW] }), appointmentController.markAppointmentNoShow);
router.post('/:appointmentId/complete', authorize({ permissions: [PERMISSION.APPOINTMENTS.COMPLETE] }), appointmentController.completeAppointment);
router.post('/:appointmentId/queue-ticket', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.CHECKIN, PERMISSION.QUEUE.CREATE] }), appointmentController.createQueueTicketFromAppointment);
router.post('/:appointmentId/encounter', authorize({ anyPermissions: [PERMISSION.ENCOUNTERS.CREATE_FROM_CHECKIN, PERMISSION.ENCOUNTERS.CREATE] }), appointmentController.createEncounterFromAppointment);
router.post('/:appointmentId/link-encounter', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE] }), appointmentController.linkAppointmentToEncounter);

module.exports = router;
