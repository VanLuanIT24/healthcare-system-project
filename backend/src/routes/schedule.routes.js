const express = require('express');
const scheduleController = require('../controllers/schedule.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('scheduleId', validateObjectIdParam);
router.param('doctorId', validateObjectIdParam);
router.param('departmentId', validateObjectIdParam);

router.get('/:scheduleId/available-slots', scheduleController.getAvailableSlots);
router.get('/public/date-range', scheduleController.listPublicSchedulesByDateRange);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN, PERMISSION.APPOINTMENTS.READ] }), scheduleController.listDoctorSchedules);
router.post('/', authorize({ permissions: [PERMISSION.SCHEDULES.CREATE] }), scheduleController.createDoctorSchedule);
router.get('/options', authorize({ anyPermissions: [PERMISSION.SCHEDULES.CREATE, PERMISSION.SCHEDULES.READ] }), scheduleController.getSchedulingCreateOptions);
router.get('/resources/options', authorize({ anyPermissions: [PERMISSION.SCHEDULES.CREATE, PERMISSION.SCHEDULES.READ] }), scheduleController.getSchedulingCreateOptions);
router.post('/preview', authorize({ permissions: [PERMISSION.SCHEDULES.CREATE] }), scheduleController.previewCreateDoctorSchedule);
router.post('/preview-create', authorize({ permissions: [PERMISSION.SCHEDULES.CREATE] }), scheduleController.previewCreateDoctorSchedule);
router.post('/bulk', authorize({ permissions: [PERMISSION.SCHEDULES.BULK_CREATE] }), scheduleController.bulkCreateDoctorSchedules);
router.post('/bulk/publish', authorize({ permissions: [PERMISSION.SCHEDULES.BULK_PUBLISH] }), scheduleController.bulkPublishDoctorSchedules);
router.post('/bulk-publish', authorize({ permissions: [PERMISSION.SCHEDULES.BULK_PUBLISH] }), scheduleController.bulkPublishDoctorSchedules);
router.get('/summary/system', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.REPORTS.APPOINTMENTS_READ, PERMISSION.REPORTS.QUEUE_READ] }), scheduleController.getSchedulingSystemSummary);
router.get('/summary/departments', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ] }), scheduleController.getScheduleSummaryByDepartment);
router.get('/summary/date-range', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.REPORTS.APPOINTMENTS_READ] }), scheduleController.getScheduleSummaryByDateRange);
router.get('/my/today', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ_OWN, PERMISSION.SCHEDULES.READ, PERMISSION.APPOINTMENTS.READ_OWN] }), scheduleController.getMyTodaySchedule);
router.get('/my/week', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ_OWN, PERMISSION.SCHEDULES.READ, PERMISSION.APPOINTMENTS.READ_OWN] }), scheduleController.getMyWeekSchedule);
router.get('/operational-list', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.getScheduleOperationalList);
router.get('/calendar', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.getScheduleCalendar);
router.get('/conflicts', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.getScheduleConflicts);
router.post('/conflicts/scan', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.scanScheduleConflicts);
router.get('/doctor/:doctorId', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.listSchedulesByDoctor);
router.get('/department/:departmentId', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT] }), scheduleController.listSchedulesByDepartment);
router.get('/date-range', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.listSchedulesByDateRange);
router.get('/calendar/doctor/:doctorId', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.getDoctorCalendarView);
router.get('/:scheduleId', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.getDoctorScheduleDetail);
router.get('/:scheduleId/summary', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.SCHEDULES.READ_OWN] }), scheduleController.getDoctorScheduleSummary);
router.get('/:scheduleId/activity', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.AUDIT_LOGS.READ_SCHEDULE] }), scheduleController.getScheduleActivityLog);
router.get('/:scheduleId/can-update', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.UPDATE] }), scheduleController.checkScheduleCanBeUpdated);
router.get('/:scheduleId/can-cancel', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.CANCEL] }), scheduleController.checkScheduleCanBeCancelled);
router.get('/:scheduleId/future-appointments', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.APPOINTMENTS.READ] }), scheduleController.checkDoctorHasFutureAppointmentsInSchedule);
router.post('/:scheduleId/preview-impact', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.UPDATE, PERMISSION.APPOINTMENTS.READ] }), scheduleController.previewRescheduleImpact);
router.patch('/:scheduleId', authorize({ permissions: [PERMISSION.SCHEDULES.UPDATE] }), scheduleController.updateDoctorSchedule);
router.post('/:scheduleId/publish', authorize({ permissions: [PERMISSION.SCHEDULES.PUBLISH] }), scheduleController.publishDoctorSchedule);
router.post('/:scheduleId/cancel', authorize({ permissions: [PERMISSION.SCHEDULES.CANCEL] }), scheduleController.cancelDoctorSchedule);
router.post('/:scheduleId/complete', authorize({ permissions: [PERMISSION.SCHEDULES.COMPLETE] }), scheduleController.completeDoctorSchedule);
router.post('/:scheduleId/duplicate', authorize({ permissions: [PERMISSION.SCHEDULES.DUPLICATE] }), scheduleController.duplicateDoctorSchedule);
router.post('/:scheduleId/slots/generate', authorize({ permissions: [PERMISSION.SCHEDULE_SLOTS.GENERATE] }), scheduleController.generateScheduleSlots);
router.get('/:scheduleId/slots', authorize({ anyPermissions: [PERMISSION.SCHEDULE_SLOTS.READ, PERMISSION.SCHEDULES.READ] }), scheduleController.getAvailableSlots);
router.get('/:scheduleId/slots/available', authorize({ anyPermissions: [PERMISSION.SCHEDULE_SLOTS.READ, PERMISSION.SCHEDULES.READ] }), scheduleController.getAvailableSlots);
router.get('/:scheduleId/slots/booked', authorize({ anyPermissions: [PERMISSION.SCHEDULE_SLOTS.READ, PERMISSION.APPOINTMENTS.READ] }), scheduleController.getBookedSlots);
router.get('/:scheduleId/booked-slots', authorize({ anyPermissions: [PERMISSION.SCHEDULE_SLOTS.READ, PERMISSION.APPOINTMENTS.READ] }), scheduleController.getBookedSlots);
router.post('/:scheduleId/block-slot', authorize({ permissions: [PERMISSION.SCHEDULE_SLOTS.BLOCK] }), scheduleController.blockScheduleSlot);
router.post('/:scheduleId/reopen-slot', authorize({ permissions: [PERMISSION.SCHEDULE_SLOTS.REOPEN] }), scheduleController.reopenScheduleSlot);
router.post('/:scheduleId/block-slots', authorize({ permissions: [PERMISSION.SCHEDULE_SLOTS.BATCH_BLOCK] }), scheduleController.batchBlockScheduleSlots);
router.post('/:scheduleId/reopen-slots', authorize({ permissions: [PERMISSION.SCHEDULE_SLOTS.BATCH_REOPEN] }), scheduleController.batchReopenScheduleSlots);
router.get('/:scheduleId/utilization', authorize({ anyPermissions: [PERMISSION.SCHEDULES.READ, PERMISSION.REPORTS.APPOINTMENTS_READ] }), scheduleController.getScheduleUtilization);

module.exports = router;
