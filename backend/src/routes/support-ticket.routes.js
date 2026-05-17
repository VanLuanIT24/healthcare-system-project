const express = require('express');
const supportTicketController = require('../controllers/support-ticket.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');
const { createActionRateLimit } = require('../middleware/action-rate-limit');

const router = express.Router();

router.param('ticketId', validateObjectIdParam);

router.use(authenticate);

const supportCreateLimit = createActionRateLimit({
  action: 'support-ticket-create',
  limit: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Bạn đã tạo quá nhiều ticket hỗ trợ. Vui lòng thử lại sau.',
});

router.post('/tickets', authorize({
  actorTypes: ['patient', 'patient_relative', 'staff'],
  anyPermissions: [PERMISSION.SUPPORT_TICKETS.SELF_CREATE, PERMISSION.SUPPORT_TICKETS.MANAGE],
}), supportCreateLimit, idempotencyRequired({ route: '/api/support/tickets' }), supportTicketController.createTicket);
router.get('/tickets', authorize({
  actorTypes: ['patient', 'patient_relative', 'staff'],
  anyPermissions: [PERMISSION.SUPPORT_TICKETS.SELF_READ, PERMISSION.SUPPORT_TICKETS.MANAGE],
}), supportTicketController.listTickets);
router.get('/tickets/:ticketId', authorize({
  actorTypes: ['patient', 'patient_relative', 'staff'],
  anyPermissions: [PERMISSION.SUPPORT_TICKETS.SELF_READ, PERMISSION.SUPPORT_TICKETS.MANAGE],
}), supportTicketController.getTicket);
router.post('/tickets/:ticketId/reply', authorize({
  actorTypes: ['patient', 'patient_relative', 'staff'],
  anyPermissions: [PERMISSION.SUPPORT_TICKETS.REPLY, PERMISSION.SUPPORT_TICKETS.MANAGE],
}), supportTicketController.replyTicket);

router.post('/tickets/:ticketId/assign', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.SUPPORT_TICKETS.ASSIGN, PERMISSION.SUPPORT_TICKETS.MANAGE] }), supportTicketController.assignTicket);
router.post('/tickets/:ticketId/change-priority', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.SUPPORT_TICKETS.MANAGE] }), supportTicketController.changePriority);
router.post('/tickets/:ticketId/resolve', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.SUPPORT_TICKETS.RESOLVE, PERMISSION.SUPPORT_TICKETS.MANAGE] }), supportTicketController.resolveTicket);
router.post('/tickets/:ticketId/close', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.SUPPORT_TICKETS.RESOLVE, PERMISSION.SUPPORT_TICKETS.MANAGE] }), supportTicketController.closeTicket);
router.post('/tickets/:ticketId/reopen', authorize({ actorTypes: ['patient', 'staff'], anyPermissions: [PERMISSION.SUPPORT_TICKETS.REPLY, PERMISSION.SUPPORT_TICKETS.MANAGE] }), supportTicketController.reopenTicket);
router.post('/tickets/:ticketId/rating', authorize({ actorTypes: ['patient', 'patient_relative'], anyPermissions: [PERMISSION.SUPPORT_TICKETS.SELF_READ] }), supportTicketController.rateTicket);

module.exports = router;
