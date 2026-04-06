const express = require('express');
const appointmentController = require('../controllers/appointment.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);

router.get('/my', authorize({ actorTypes: ['patient'] }), appointmentController.getMyAppointments);
router.post('/portal', authorize({ actorTypes: ['patient'] }), appointmentController.createAppointmentFromPatientPortal);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.listAppointments);
router.get('/search', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.searchAppointments);
router.get('/summary', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.getAppointmentSummary);
router.post('/validate-slot', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.validateAppointmentSlot);
router.post('/check-doctor-availability', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.checkDoctorAvailability);
router.post('/check-patient-duplicate', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.checkPatientDuplicateBooking);
router.post('/validate-time', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.validateAppointmentTime);
router.post('/validate-status-transition', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.validateAppointmentStatusTransition);
router.post('/check-doctor-conflict', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.checkAppointmentConflictForDoctor);
router.post('/check-patient-conflict', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.checkAppointmentConflictForPatient);
router.post('/', authorize({ permissions: ['appointments.write'] }), appointmentController.createAppointment);
router.post('/staff-create', authorize({ permissions: ['appointments.write'] }), appointmentController.createAppointmentByStaff);
router.post('/bulk-confirm', authorize({ permissions: ['appointments.write'] }), appointmentController.bulkConfirmAppointments);
router.post('/bulk-cancel', authorize({ permissions: ['appointments.write'] }), appointmentController.bulkCancelAppointments);
router.get('/patient/:patientId', authorize({ anyPermissions: ['appointments.read', 'patients.read'] }), appointmentController.listAppointmentsByPatient);
router.get('/doctor/:doctorId', authorize({ anyPermissions: ['appointments.read', 'encounters.read'] }), appointmentController.listAppointmentsByDoctor);
router.get('/department/:departmentId', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.listAppointmentsByDepartment);
router.get('/by-date', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.listAppointmentsByDate);
router.get('/upcoming', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.listUpcomingAppointments);
router.get('/today', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.listTodayAppointments);

router.get('/:appointmentId', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.getAppointmentDetail);
router.get('/:appointmentId/timeline', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.getAppointmentTimeline);
router.get('/:appointmentId/can-update', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.checkAppointmentCanBeUpdated);
router.get('/:appointmentId/can-cancel', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.checkAppointmentCanBeCancelled);
router.get('/:appointmentId/can-reschedule', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.checkAppointmentCanBeRescheduled);
router.get('/:appointmentId/can-check-in', authorize({ anyPermissions: ['appointments.read', 'appointments.write'] }), appointmentController.checkAppointmentCanBeCheckedIn);
router.patch('/:appointmentId', authorize({ permissions: ['appointments.write'] }), appointmentController.updateAppointment);
router.post('/:appointmentId/confirm', authorize({ permissions: ['appointments.write'] }), appointmentController.confirmAppointment);
router.post('/:appointmentId/cancel', authorize({ permissions: ['appointments.write'] }), appointmentController.cancelAppointment);
router.post('/:appointmentId/reschedule', authorize({ permissions: ['appointments.write'] }), appointmentController.rescheduleAppointment);
router.post('/:appointmentId/check-in', authorize({ anyPermissions: ['appointments.write', 'queue.manage'] }), appointmentController.checkInAppointment);
router.post('/:appointmentId/no-show', authorize({ permissions: ['appointments.write'] }), appointmentController.markAppointmentNoShow);
router.post('/:appointmentId/complete', authorize({ permissions: ['appointments.write'] }), appointmentController.completeAppointment);
router.post('/:appointmentId/queue-ticket', authorize({ anyPermissions: ['appointments.write', 'queue.manage'] }), appointmentController.createQueueTicketFromAppointment);
router.post('/:appointmentId/encounter', authorize({ anyPermissions: ['appointments.write', 'encounters.write'] }), appointmentController.createEncounterFromAppointment);
router.post('/:appointmentId/link-encounter', authorize({ anyPermissions: ['appointments.write', 'encounters.write'] }), appointmentController.linkAppointmentToEncounter);

module.exports = router;
