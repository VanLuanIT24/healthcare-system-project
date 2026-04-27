const express = require('express');
const scheduleController = require('../controllers/schedule.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.get('/doctor/:doctorId', scheduleController.listSchedulesByDoctor);
router.get('/department/:departmentId', scheduleController.listSchedulesByDepartment);
router.get('/date-range', scheduleController.listSchedulesByDateRange);
router.get('/calendar/doctor/:doctorId', scheduleController.getDoctorCalendarView);
router.get('/:scheduleId/available-slots', scheduleController.getAvailableSlots);
router.get('/:scheduleId/booked-slots', scheduleController.getBookedSlots);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.listDoctorSchedules);
router.post('/', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.createDoctorSchedule);
router.post('/bulk', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.bulkCreateDoctorSchedules);
router.post('/bulk-publish', authorize({ anyPermissions: ['schedule.publish', 'appointments.write'] }), scheduleController.bulkPublishDoctorSchedules);
router.get('/summary/system', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getSchedulingSystemSummary);
router.get('/summary/departments', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getScheduleSummaryByDepartment);
router.get('/summary/date-range', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getScheduleSummaryByDateRange);
router.get('/my/today', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getMyTodaySchedule);
router.get('/my/week', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getMyWeekSchedule);
router.get('/:scheduleId', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getDoctorScheduleDetail);
router.get('/:scheduleId/summary', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getDoctorScheduleSummary);
router.get('/:scheduleId/activity', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getScheduleActivityLog);
router.get('/:scheduleId/can-update', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.checkScheduleCanBeUpdated);
router.get('/:scheduleId/can-cancel', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.checkScheduleCanBeCancelled);
router.get('/:scheduleId/future-appointments', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.checkDoctorHasFutureAppointmentsInSchedule);
router.post('/:scheduleId/preview-impact', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.previewRescheduleImpact);
router.patch('/:scheduleId', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.updateDoctorSchedule);
router.post('/:scheduleId/publish', authorize({ anyPermissions: ['schedule.publish', 'appointments.write'] }), scheduleController.publishDoctorSchedule);
router.post('/:scheduleId/cancel', authorize({ anyPermissions: ['schedule.cancel', 'appointments.write'] }), scheduleController.cancelDoctorSchedule);
router.post('/:scheduleId/complete', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.completeDoctorSchedule);
router.post('/:scheduleId/duplicate', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.duplicateDoctorSchedule);
router.post('/:scheduleId/block-slot', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.blockScheduleSlot);
router.post('/:scheduleId/reopen-slot', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.reopenScheduleSlot);
router.post('/:scheduleId/block-slots', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.batchBlockScheduleSlots);
router.post('/:scheduleId/reopen-slots', authorize({ anyPermissions: ['schedule.write', 'appointments.write'] }), scheduleController.batchReopenScheduleSlots);
router.get('/:scheduleId/utilization', authorize({ anyPermissions: ['schedule.read', 'appointments.read'] }), scheduleController.getScheduleUtilization);

module.exports = router;
