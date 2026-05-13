const express = require('express');
const appointmentController = require('../controllers/appointment.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('appointmentId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('doctorId', validateObjectIdParam);
router.param('departmentId', validateObjectIdParam);

router.use(authenticate);

router.get('/my', authorize({ actorTypes: ['patient'] }), appointmentController.getMyAppointments);
router.post('/portal', authorize({ actorTypes: ['patient'] }), appointmentController.createAppointmentFromPatientPortal);
router.get('/my/:appointmentId', authorize({ actorTypes: ['patient'] }), appointmentController.getAppointmentDetail);
router.post('/my/:appointmentId/cancel', authorize({ actorTypes: ['patient'] }), appointmentController.cancelAppointment);
router.post('/my/:appointmentId/reschedule', authorize({ actorTypes: ['patient'] }), appointmentController.rescheduleAppointment);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.listAppointments);
router.get('/search', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_OWN] }), appointmentController.searchAppointments);
router.get('/summary', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT, PERMISSION.REPORTS.APPOINTMENTS_READ] }), appointmentController.getAppointmentSummary);
router.post('/validate-slot', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE, PERMISSION.SCHEDULE_SLOTS.READ] }), appointmentController.validateAppointmentSlot);
router.post('/check-doctor-availability', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE, PERMISSION.SCHEDULES.READ] }), appointmentController.checkDoctorAvailability);
router.post('/check-patient-duplicate', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE] }), appointmentController.checkPatientDuplicateBooking);
router.post('/validate-time', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE] }), appointmentController.validateAppointmentTime);
router.post('/validate-status-transition', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.UPDATE, PERMISSION.APPOINTMENTS.UPDATE_BASIC] }), appointmentController.validateAppointmentStatusTransition);
router.post('/check-doctor-conflict', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE, PERMISSION.SCHEDULES.READ] }), appointmentController.checkAppointmentConflictForDoctor);
router.post('/check-patient-conflict', authorize({ anyPermissions: [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE] }), appointmentController.checkAppointmentConflictForPatient);
router.post('/', authorize({ permissions: [PERMISSION.APPOINTMENTS.CREATE] }), appointmentController.createAppointment);
router.post('/staff-create', authorize({ permissions: [PERMISSION.APPOINTMENTS.CREATE] }), appointmentController.createAppointmentByStaff);
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
