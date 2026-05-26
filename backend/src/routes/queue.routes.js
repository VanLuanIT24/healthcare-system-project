const express = require('express');
const queueController = require('../controllers/queue.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('doctorId', validateObjectIdParam);
router.param('departmentId', validateObjectIdParam);
router.param('appointmentId', validateObjectIdParam);
router.param('ticketId', validateObjectIdParam);

router.get('/public/board', queueController.getPublicQueueBoard);

router.use(authenticate);

router.get('/me/current', authorize({ actorTypes: ['patient', 'patient_relative'] }), queueController.getMyCurrentQueue);
router.get('/me/current/detail', authorize({ actorTypes: ['patient', 'patient_relative'] }), queueController.getMyCurrentQueueDetail);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: [PERMISSION.QUEUE.READ, PERMISSION.QUEUE.READ_DEPARTMENT, PERMISSION.QUEUE.READ_OWN, PERMISSION.APPOINTMENTS.READ] }), queueController.listQueueTickets);
router.post('/', authorize({ anyPermissions: [PERMISSION.QUEUE.CREATE, PERMISSION.APPOINTMENTS.CHECKIN] }), idempotencyRequired({ route: '/api/queue' }), queueController.createQueueTicket);
router.post('/check-in', authorize({ anyPermissions: [PERMISSION.QUEUE.CREATE, PERMISSION.APPOINTMENTS.CHECKIN] }), idempotencyRequired({ route: '/api/queue/check-in' }), queueController.checkInPatientToQueue);
router.post('/call-next', authorize({ anyPermissions: [PERMISSION.QUEUE.CALL, PERMISSION.QUEUE.CALL_OWN] }), queueController.callNextQueue);
router.get('/doctor/:doctorId/board', authorize({ anyPermissions: [PERMISSION.QUEUE.READ, PERMISSION.QUEUE.READ_OWN, PERMISSION.APPOINTMENTS.READ] }), queueController.getDoctorQueueBoard);
router.get('/department/:departmentId/board', authorize({ anyPermissions: [PERMISSION.QUEUE.READ, PERMISSION.QUEUE.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ_DEPARTMENT] }), queueController.getDepartmentQueueBoard);
router.get('/summary/today', authorize({ anyPermissions: [PERMISSION.QUEUE.READ, PERMISSION.QUEUE.READ_DEPARTMENT, PERMISSION.REPORTS.QUEUE_READ] }), queueController.getTodayQueueSummary);
router.post('/appointment/:appointmentId', authorize({ anyPermissions: [PERMISSION.QUEUE.CREATE, PERMISSION.APPOINTMENTS.CHECKIN] }), idempotencyRequired({ route: '/api/queue/appointment/:appointmentId' }), queueController.createQueueTicketFromAppointment);
router.get('/:ticketId', authorize({ anyPermissions: [PERMISSION.QUEUE.READ, PERMISSION.QUEUE.READ_DEPARTMENT, PERMISSION.QUEUE.READ_OWN] }), queueController.getQueueTicketDetail);
router.get('/:ticketId/timeline', authorize({ anyPermissions: [PERMISSION.QUEUE.READ, PERMISSION.QUEUE.READ_DEPARTMENT, PERMISSION.QUEUE.READ_OWN] }), queueController.getQueueTimeline);
router.post('/:ticketId/call', authorize({ anyPermissions: [PERMISSION.QUEUE.CALL, PERMISSION.QUEUE.CALL_OWN] }), queueController.callQueueTicket);
router.post('/:ticketId/recall', authorize({ permissions: [PERMISSION.QUEUE.RECALL] }), queueController.recallQueueTicket);
router.post('/:ticketId/skip', authorize({ permissions: [PERMISSION.QUEUE.SKIP] }), queueController.skipQueueTicket);
router.post('/:ticketId/start-service', authorize({ anyPermissions: [PERMISSION.QUEUE.START_SERVICE, PERMISSION.QUEUE.START_SERVICE_OWN] }), queueController.startQueueService);
router.post('/:ticketId/complete', authorize({ permissions: [PERMISSION.QUEUE.COMPLETE] }), queueController.completeQueueTicket);
router.post('/:ticketId/cancel', authorize({ permissions: [PERMISSION.QUEUE.CANCEL] }), queueController.cancelQueueTicket);
router.post('/:ticketId/generate-qr', authorize({ anyPermissions: [PERMISSION.QR_TOKENS.CREATE, PERMISSION.QUEUE.PRINT_TICKET] }), queueController.generateQueueTicketQr);
router.post('/:ticketId/mark-no-show', authorize({ anyPermissions: [PERMISSION.QUEUE.CANCEL, PERMISSION.QUEUE.UPDATE] }), queueController.markQueueTicketNoShow);
router.post('/:ticketId/reorder-priority', authorize({ permissions: [PERMISSION.QUEUE.UPDATE] }), queueController.reorderQueuePriority);
router.post('/:ticketId/transfer', authorize({ permissions: [PERMISSION.QUEUE.UPDATE] }), queueController.transferQueueTicket);

module.exports = router;
