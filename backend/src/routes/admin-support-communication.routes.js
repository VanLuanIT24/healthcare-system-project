const express = require('express');
const controller = require('../controllers/admin-support-communication.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('ticketId', validateObjectIdParam);
router.param('conversationId', validateObjectIdParam);
router.param('messageId', validateObjectIdParam);
router.param('notificationId', validateObjectIdParam);
router.param('deliveryId', validateObjectIdParam);
router.param('campaignId', validateObjectIdParam);
router.param('templateId', validateObjectIdParam);
router.param('replyTemplateId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.SUPPORT_COMMUNICATION.READ,
  PERMISSION.SUPPORT_COMMUNICATION.ANALYTICS_READ,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.MESSAGES.MANAGE,
  PERMISSION.NOTIFICATIONS.READ,
  PERMISSION.NOTIFICATIONS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const managePermissions = [
  PERMISSION.SUPPORT_COMMUNICATION.MANAGE,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.MESSAGES.MANAGE,
  PERMISSION.NOTIFICATIONS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const bulkPermissions = [
  PERMISSION.SUPPORT_COMMUNICATION.BULK_ACTION,
  PERMISSION.SUPPORT_COMMUNICATION.MANAGE,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const slaPermissions = [
  PERMISSION.SUPPORT_COMMUNICATION.SLA_MANAGE,
  PERMISSION.SUPPORT_COMMUNICATION.MANAGE,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const broadcastPermissions = [
  PERMISSION.SUPPORT_COMMUNICATION.BROADCAST_MANAGE,
  PERMISSION.SUPPORT_COMMUNICATION.MANAGE,
  PERMISSION.NOTIFICATIONS.BROADCAST,
  PERMISSION.NOTIFICATIONS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const templatePermissions = [
  PERMISSION.SUPPORT_COMMUNICATION.TEMPLATE_MANAGE,
  PERMISSION.SUPPORT_COMMUNICATION.MANAGE,
  PERMISSION.NOTIFICATIONS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const replyTemplatePermissions = [
  PERMISSION.SUPPORT_COMMUNICATION.REPLY_TEMPLATE_MANAGE,
  PERMISSION.SUPPORT_COMMUNICATION.MANAGE,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'], anyPermissions: readPermissions }));

router.get('/overview', controller.getOverview);
router.get('/logs', authorize({ anyPermissions: [PERMISSION.SUPPORT_COMMUNICATION.EXPORT, ...readPermissions] }), controller.getLogs);

router.get('/sla/overview', controller.getSlaOverview);
router.post('/sla/scan', authorize({ anyPermissions: slaPermissions }), controller.scanSla);
router.get('/tickets/overdue', controller.listOverdueTickets);
router.get('/tickets/sla-risk', controller.listSlaRiskTickets);
router.get('/technical/overview', controller.getTechnicalOverview);
router.get('/technical/tickets', controller.listTechnicalTickets);
router.get('/account/tickets', controller.listAccountTickets);
router.get('/billing/tickets', controller.listBillingTickets);

router.post('/tickets/bulk-assign', authorize({ anyPermissions: bulkPermissions }), controller.bulkAssign);
router.post('/tickets/bulk-priority', authorize({ anyPermissions: bulkPermissions }), controller.bulkPriority);
router.post('/tickets/bulk-resolve', authorize({ anyPermissions: bulkPermissions }), controller.bulkResolve);
router.post('/tickets/bulk-close', authorize({ anyPermissions: bulkPermissions }), controller.bulkClose);
router.get('/tickets', controller.listTickets);
router.get('/tickets/:ticketId', controller.getTicket);
router.post('/tickets/:ticketId/reply', authorize({ anyPermissions: managePermissions }), controller.replyTicket);
router.post('/tickets/:ticketId/assign', authorize({ anyPermissions: managePermissions }), controller.assignTicket);
router.post('/tickets/:ticketId/change-priority', authorize({ anyPermissions: managePermissions }), controller.changePriority);
router.post('/tickets/:ticketId/resolve', authorize({ anyPermissions: managePermissions }), controller.resolveTicket);
router.post('/tickets/:ticketId/close', authorize({ anyPermissions: managePermissions }), controller.closeTicket);
router.post('/tickets/:ticketId/reopen', authorize({ anyPermissions: managePermissions }), controller.reopenTicket);
router.get('/tickets/:ticketId/timeline', controller.getTicketTimeline);
router.get('/tickets/:ticketId/context', controller.getTicketContext);
router.get('/tickets/:ticketId/account-context', controller.getAccountContext);
router.get('/tickets/:ticketId/payment-context', controller.getPaymentContext);
router.post('/tickets/:ticketId/internal-note', authorize({ anyPermissions: managePermissions }), controller.addInternalNote);
router.post('/tickets/:ticketId/escalate', authorize({ anyPermissions: managePermissions }), controller.escalateTicket);
router.post('/tickets/:ticketId/escalate-sla', authorize({ anyPermissions: slaPermissions }), controller.escalateTicket);
router.post('/tickets/:ticketId/mark-false-breach', authorize({ anyPermissions: slaPermissions }), controller.markFalseBreach);
router.post('/tickets/:ticketId/link-system-log', authorize({ anyPermissions: managePermissions }), controller.linkSystemLog);
router.post('/tickets/:ticketId/link-audit-log', authorize({ anyPermissions: managePermissions }), controller.linkAuditLog);
router.post('/tickets/:ticketId/mark-known-issue', authorize({ anyPermissions: managePermissions }), controller.markKnownIssue);
router.post('/tickets/:ticketId/resolve-duplicate', authorize({ anyPermissions: managePermissions }), controller.resolveDuplicate);
router.post('/tickets/:ticketId/link-invoice', authorize({ anyPermissions: managePermissions }), controller.linkInvoice);
router.post('/tickets/:ticketId/link-payment-intent', authorize({ anyPermissions: managePermissions }), controller.linkPaymentIntent);
router.post('/tickets/:ticketId/link-bank-transaction', authorize({ anyPermissions: managePermissions }), controller.linkBankTransaction);
router.post('/tickets/:ticketId/resolve-with-payment-action', authorize({ anyPermissions: managePermissions }), controller.resolveWithPaymentAction);
router.post('/tickets/:ticketId/link-user', authorize({ anyPermissions: managePermissions }), controller.linkUser);
router.post('/tickets/:ticketId/link-patient-account', authorize({ anyPermissions: managePermissions }), controller.linkPatientAccount);
router.post('/tickets/:ticketId/link-relative', authorize({ anyPermissions: managePermissions }), controller.linkRelative);
router.post('/tickets/:ticketId/escalate-security', authorize({ anyPermissions: managePermissions }), controller.escalateSecurity);

router.get('/conversations', controller.listConversations);
router.post('/conversations', authorize({ anyPermissions: managePermissions }), controller.createConversation);
router.get('/conversations/:conversationId', controller.getConversation);
router.get('/conversations/:conversationId/messages', controller.listConversationMessages);
router.post('/conversations/:conversationId/messages', authorize({ anyPermissions: managePermissions }), controller.sendConversationMessage);
router.post('/conversations/:conversationId/read', authorize({ anyPermissions: managePermissions }), controller.markConversationRead);
router.post('/conversations/:conversationId/archive', authorize({ anyPermissions: managePermissions }), controller.archiveConversation);
router.post('/conversations/:conversationId/assign', authorize({ anyPermissions: managePermissions }), controller.assignConversation);
router.post('/conversations/:conversationId/escalate', authorize({ anyPermissions: managePermissions }), controller.escalateConversation);
router.post('/conversations/:conversationId/close', authorize({ anyPermissions: managePermissions }), controller.closeConversation);
router.post('/conversations/:conversationId/reopen', authorize({ anyPermissions: managePermissions }), controller.reopenConversation);

router.get('/system-messages', controller.listSystemMessages);
router.post('/system-messages', authorize({ anyPermissions: managePermissions }), controller.createSystemMessage);
router.post('/system-messages/:messageId/ack', authorize({ anyPermissions: managePermissions }), controller.acknowledgeSystemMessage);
router.post('/system-messages/:messageId/resend', authorize({ anyPermissions: managePermissions }), controller.acknowledgeSystemMessage);

router.get('/notifications/overview', controller.getNotificationsOverview);
router.get('/notifications/deliveries', controller.listNotificationDeliveries);
router.post('/notifications/deliveries/:deliveryId/retry', authorize({ anyPermissions: managePermissions }), controller.retryNotificationDelivery);
router.post('/notifications/deliveries/:deliveryId/cancel', authorize({ anyPermissions: managePermissions }), controller.cancelNotificationDelivery);
router.get('/notifications', controller.listNotifications);
router.post('/notifications', authorize({ anyPermissions: managePermissions }), controller.createNotification);
router.post('/notifications/bulk', authorize({ anyPermissions: broadcastPermissions }), controller.createBulkNotifications);
router.post('/notifications/dispatch-queued', authorize({ anyPermissions: managePermissions }), controller.dispatchQueuedNotifications);
router.get('/notifications/:notificationId', controller.getNotification);
router.post('/notifications/:notificationId/cancel', authorize({ anyPermissions: managePermissions }), controller.cancelNotification);
router.post('/notifications/:notificationId/retry', authorize({ anyPermissions: managePermissions }), controller.retryNotification);
router.post('/notifications/:notificationId/dispatch', authorize({ anyPermissions: managePermissions }), controller.dispatchNotification);

router.post('/broadcasts/preview', authorize({ anyPermissions: broadcastPermissions }), controller.previewBroadcast);
router.post('/broadcasts', authorize({ anyPermissions: broadcastPermissions }), controller.createBroadcast);
router.get('/broadcasts', controller.listBroadcasts);
router.get('/broadcasts/:campaignId', controller.getBroadcast);
router.post('/broadcasts/:campaignId/test', authorize({ anyPermissions: broadcastPermissions }), controller.testBroadcast);
router.post('/broadcasts/:campaignId/approve', authorize({ anyPermissions: broadcastPermissions }), controller.approveBroadcast);
router.post('/broadcasts/:campaignId/send', authorize({ anyPermissions: broadcastPermissions }), controller.sendBroadcast);
router.post('/broadcasts/:campaignId/cancel', authorize({ anyPermissions: broadcastPermissions }), controller.cancelBroadcast);
router.post('/broadcasts/:campaignId/clone', authorize({ anyPermissions: broadcastPermissions }), controller.cloneBroadcast);

router.post('/notification-templates/seed-defaults', authorize({ anyPermissions: templatePermissions }), controller.seedNotificationTemplates);
router.post('/notification-templates/validate-all', authorize({ anyPermissions: templatePermissions }), controller.validateNotificationTemplates);
router.get('/notification-templates', controller.listNotificationTemplates);
router.post('/notification-templates', authorize({ anyPermissions: templatePermissions }), controller.createNotificationTemplate);
router.get('/notification-templates/:templateId', controller.getNotificationTemplate);
router.patch('/notification-templates/:templateId', authorize({ anyPermissions: templatePermissions }), controller.updateNotificationTemplate);
router.delete('/notification-templates/:templateId', authorize({ anyPermissions: templatePermissions }), controller.deleteNotificationTemplate);
router.post('/notification-templates/:templateId/preview', authorize({ anyPermissions: templatePermissions }), controller.previewNotificationTemplate);
router.post('/notification-templates/:templateId/test-send', authorize({ anyPermissions: templatePermissions }), controller.testSendNotificationTemplate);

router.post('/reply-templates/seed-defaults', authorize({ anyPermissions: replyTemplatePermissions }), controller.seedReplyTemplates);
router.get('/reply-templates', controller.listReplyTemplates);
router.post('/reply-templates', authorize({ anyPermissions: replyTemplatePermissions }), controller.createReplyTemplate);
router.get('/reply-templates/:replyTemplateId', controller.getReplyTemplate);
router.patch('/reply-templates/:replyTemplateId', authorize({ anyPermissions: replyTemplatePermissions }), controller.updateReplyTemplate);
router.delete('/reply-templates/:replyTemplateId', authorize({ anyPermissions: replyTemplatePermissions }), controller.deleteReplyTemplate);
router.post('/reply-templates/:replyTemplateId/preview', authorize({ anyPermissions: replyTemplatePermissions }), controller.previewReplyTemplate);
router.post('/reply-templates/:replyTemplateId/use', authorize({ anyPermissions: replyTemplatePermissions }), controller.useReplyTemplate);

module.exports = router;
