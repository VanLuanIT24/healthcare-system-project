const express = require('express');
const queueController = require('../controllers/queue.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: ['queue.manage', 'appointments.read'] }), queueController.listQueueTickets);
router.post('/', authorize({ anyPermissions: ['queue.manage', 'appointments.write'] }), queueController.createQueueTicket);
router.post('/check-in', authorize({ anyPermissions: ['queue.manage', 'appointments.write'] }), queueController.checkInPatientToQueue);
router.post('/call-next', authorize({ permissions: ['queue.manage'] }), queueController.callNextQueue);
router.get('/doctor/:doctorId/board', authorize({ anyPermissions: ['queue.manage', 'appointments.read'] }), queueController.getDoctorQueueBoard);
router.get('/department/:departmentId/board', authorize({ anyPermissions: ['queue.manage', 'appointments.read'] }), queueController.getDepartmentQueueBoard);
router.get('/summary/today', authorize({ anyPermissions: ['queue.manage', 'appointments.read'] }), queueController.getTodayQueueSummary);
router.post('/appointment/:appointmentId', authorize({ anyPermissions: ['queue.manage', 'appointments.write'] }), queueController.createQueueTicketFromAppointment);
router.get('/:ticketId', authorize({ anyPermissions: ['queue.manage', 'appointments.read'] }), queueController.getQueueTicketDetail);
router.get('/:ticketId/timeline', authorize({ anyPermissions: ['queue.manage', 'appointments.read'] }), queueController.getQueueTimeline);
router.post('/:ticketId/recall', authorize({ permissions: ['queue.manage'] }), queueController.recallQueueTicket);
router.post('/:ticketId/skip', authorize({ permissions: ['queue.manage'] }), queueController.skipQueueTicket);
router.post('/:ticketId/start-service', authorize({ permissions: ['queue.manage'] }), queueController.startQueueService);
router.post('/:ticketId/complete', authorize({ permissions: ['queue.manage'] }), queueController.completeQueueTicket);
router.post('/:ticketId/cancel', authorize({ permissions: ['queue.manage'] }), queueController.cancelQueueTicket);

module.exports = router;
