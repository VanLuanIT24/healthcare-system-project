const service = require('../services/admin-support-communication.service');
const messageService = require('../services/message.service');
const notificationService = require('../services/notification.service');
const supportTicketService = require('../services/support-ticket.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

function withExtraPermissions(actor = {}, permissions = []) {
  return {
    ...actor,
    permissions: [...new Set([...(actor.permissions || []), ...permissions])],
  };
}

function messagingActor(req) {
  return withExtraPermissions(req.auth, [
    'messages.staff.read',
    'messages.staff.send',
    'messages.internal.read',
    'messages.internal.send',
    'messages.assign',
    'messages.close',
    'messages.manage',
  ]);
}

function notificationActor(req) {
  return withExtraPermissions(req.auth, [
    'notifications.read',
    'notifications.create',
    'notifications.create_system',
    'notifications.broadcast',
    'notifications.cancel',
    'notifications.retry',
    'notifications.dispatch',
    'notifications.manage',
    'notifications.read_failed',
  ]);
}

module.exports = {
  getOverview: wrap((req) => service.getOverview(req.query, req.auth), 'Lấy Support & Communication overview thành công.'),

  listTickets: wrap((req) => service.listTickets(req.query, req.auth), 'Lấy danh sách support tickets thành công.'),
  getTicket: wrap((req) => service.getTicket(req.params.ticketId, req.auth), 'Lấy chi tiết support ticket thành công.'),
  replyTicket: wrap((req) => supportTicketService.replyTicket(req.params.ticketId, req.body, messagingActor(req), requestMeta(req)), 'Reply support ticket thành công.', 201),
  assignTicket: wrap((req) => service.assignTicketAdmin(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Assign support ticket thành công.'),
  changePriority: wrap((req) => supportTicketService.changePriority(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Đổi priority support ticket thành công.'),
  resolveTicket: wrap((req) => supportTicketService.resolveTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Resolve support ticket thành công.'),
  closeTicket: wrap((req) => supportTicketService.closeTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Close support ticket thành công.'),
  reopenTicket: wrap((req) => supportTicketService.reopenTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Reopen support ticket thành công.'),
  getTicketTimeline: wrap((req) => service.getTicketTimeline(req.params.ticketId, req.auth), 'Lấy timeline ticket thành công.'),
  getTicketContext: wrap((req) => service.getTicketContext(req.params.ticketId, req.auth), 'Lấy context ticket thành công.'),
  getAccountContext: wrap((req) => service.getAccountContext(req.params.ticketId, req.auth), 'Lấy account context thành công.'),
  getPaymentContext: wrap((req) => service.getPaymentContext(req.params.ticketId, req.auth), 'Lấy payment context thành công.'),
  addInternalNote: wrap((req) => service.addInternalNote(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Thêm internal note thành công.', 201),
  escalateTicket: wrap((req) => service.escalateTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Escalate ticket thành công.'),
  markFalseBreach: wrap((req) => service.markFalseBreach(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Đánh dấu false breach thành công.'),
  linkSystemLog: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { linked_system_log: req.body }, 'support.ticket_link_system_log', req.auth, requestMeta(req)), 'Link system log thành công.'),
  linkAuditLog: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { linked_audit_log_id: req.body.audit_log_id }, 'support.ticket_link_audit_log', req.auth, requestMeta(req)), 'Link audit log thành công.'),
  markKnownIssue: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { known_issue: true, known_issue_note: req.body.note || req.body.reason }, 'support.ticket_mark_known_issue', req.auth, requestMeta(req)), 'Mark known issue thành công.'),
  resolveDuplicate: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { duplicate_of_ticket_id: req.body.duplicate_of_ticket_id, duplicate_reason: req.body.reason }, 'support.ticket_resolve_duplicate', req.auth, requestMeta(req)), 'Resolve duplicate thành công.'),
  linkInvoice: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { invoice_id: req.body.invoice_id }, 'support.ticket_link_invoice', req.auth, requestMeta(req)), 'Link invoice thành công.'),
  linkPaymentIntent: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { payment_intent_id: req.body.payment_intent_id, intent_code: req.body.intent_code }, 'support.ticket_link_payment_intent', req.auth, requestMeta(req)), 'Link payment intent thành công.'),
  linkBankTransaction: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { bank_transaction_id: req.body.bank_transaction_id }, 'support.ticket_link_bank_transaction', req.auth, requestMeta(req)), 'Link bank transaction thành công.'),
  resolveWithPaymentAction: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { payment_action_taken: req.body.payment_action_taken, payment_action_note: req.body.note }, 'support.ticket_resolve_with_payment_action', req.auth, requestMeta(req)), 'Resolve ticket với payment action thành công.'),
  linkUser: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { linked_user_id: req.body.user_id }, 'support.ticket_link_user', req.auth, requestMeta(req)), 'Link user thành công.'),
  linkPatientAccount: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { linked_patient_account_id: req.body.patient_account_id }, 'support.ticket_link_patient_account', req.auth, requestMeta(req)), 'Link patient account thành công.'),
  linkRelative: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { linked_relative_id: req.body.relative_id }, 'support.ticket_link_relative', req.auth, requestMeta(req)), 'Link relative thành công.'),
  escalateSecurity: wrap((req) => service.patchTicketMetadata(req.params.ticketId, { security_escalated_at: new Date(), security_escalation_reason: req.body.reason }, 'support.ticket_escalate_security', req.auth, requestMeta(req)), 'Escalate security thành công.'),

  bulkAssign: wrap((req) => service.bulkUpdateTickets(req.body.ticket_ids || [], 'assign', req.body, req.auth, requestMeta(req)), 'Bulk assign tickets thành công.'),
  bulkPriority: wrap((req) => service.bulkUpdateTickets(req.body.ticket_ids || [], 'priority', req.body, req.auth, requestMeta(req)), 'Bulk change priority thành công.'),
  bulkResolve: wrap((req) => service.bulkUpdateTickets(req.body.ticket_ids || [], 'resolve', req.body, req.auth, requestMeta(req)), 'Bulk resolve tickets thành công.'),
  bulkClose: wrap((req) => service.bulkUpdateTickets(req.body.ticket_ids || [], 'close', req.body, req.auth, requestMeta(req)), 'Bulk close tickets thành công.'),

  getSlaOverview: wrap((req) => service.getSlaOverview(req.query, req.auth), 'Lấy SLA overview thành công.'),
  listOverdueTickets: wrap((req) => service.listOverdueTickets(req.query, req.auth), 'Lấy ticket quá SLA thành công.'),
  listSlaRiskTickets: wrap((req) => service.listSlaRiskTickets(req.query, req.auth), 'Lấy ticket SLA risk thành công.'),
  scanSla: wrap((req) => service.scanSla(req.body, req.auth, requestMeta(req)), 'Scan SLA thành công.'),
  getTechnicalOverview: wrap((req) => service.getTechnicalOverview(req.query, req.auth), 'Lấy technical support overview thành công.'),
  listTechnicalTickets: wrap((req) => service.getSpecializedTicketList('technical', req.query), 'Lấy technical tickets thành công.'),
  listAccountTickets: wrap((req) => service.getSpecializedTicketList('account', req.query), 'Lấy account tickets thành công.'),
  listBillingTickets: wrap((req) => service.getSpecializedTicketList('billing', req.query), 'Lấy billing tickets thành công.'),

  listConversations: wrap((req) => service.listConversations(req.query, req.auth), 'Lấy conversations thành công.'),
  createConversation: wrap((req) => messageService.createConversation(req.body, messagingActor(req), requestMeta(req)), 'Tạo conversation thành công.', 201),
  getConversation: wrap((req) => service.getConversation(req.params.conversationId, req.auth), 'Lấy conversation thành công.'),
  listConversationMessages: wrap((req) => service.listConversationMessages(req.params.conversationId, req.query, req.auth), 'Lấy messages thành công.'),
  sendConversationMessage: wrap((req) => messageService.sendMessage(req.params.conversationId, req.body, messagingActor(req), requestMeta(req)), 'Gửi message thành công.', 201),
  markConversationRead: wrap((req) => messageService.markConversationRead(req.params.conversationId, req.body, messagingActor(req), requestMeta(req)), 'Mark conversation read thành công.'),
  archiveConversation: wrap((req) => messageService.archiveConversation(req.params.conversationId, messagingActor(req), requestMeta(req)), 'Archive conversation thành công.'),
  assignConversation: wrap((req) => messageService.assignConversation(req.params.conversationId, req.body, messagingActor(req), requestMeta(req)), 'Assign conversation thành công.'),
  escalateConversation: wrap((req) => messageService.escalateConversation(req.params.conversationId, req.body, messagingActor(req), requestMeta(req)), 'Escalate conversation thành công.'),
  closeConversation: wrap((req) => messageService.closeConversation(req.params.conversationId, req.body, messagingActor(req), requestMeta(req)), 'Close conversation thành công.'),
  reopenConversation: wrap((req) => messageService.reopenConversation(req.params.conversationId, req.body, messagingActor(req), requestMeta(req)), 'Reopen conversation thành công.'),

  listSystemMessages: wrap((req) => service.listSystemMessages(req.query, req.auth), 'Lấy system messages thành công.'),
  createSystemMessage: wrap((req) => service.createSystemMessage(req.body, req.auth, requestMeta(req)), 'Tạo system message thành công.', 201),
  acknowledgeSystemMessage: wrap((req) => service.acknowledgeSystemMessage(req.params.messageId, req.body, req.auth, requestMeta(req)), 'Ack system message thành công.'),

  getNotificationsOverview: wrap((req) => service.getNotificationsOverview(req.query, req.auth), 'Lấy notifications overview thành công.'),
  listNotifications: wrap((req) => service.listNotifications(req.query, req.auth), 'Lấy notifications thành công.'),
  getNotification: wrap((req) => service.getNotification(req.params.notificationId, req.auth), 'Lấy notification thành công.'),
  createNotification: wrap((req) => notificationService.createNotification(req.body, notificationActor(req), requestMeta(req)), 'Tạo notification thành công.', 201),
  createBulkNotifications: wrap((req) => notificationService.createBulkNotifications(req.body.recipients || [], req.body.payload || req.body, notificationActor(req), requestMeta(req)), 'Tạo bulk notifications thành công.', 201),
  cancelNotification: wrap((req) => notificationService.cancelNotification(req.params.notificationId, req.body, notificationActor(req), requestMeta(req)), 'Cancel notification thành công.'),
  retryNotification: wrap((req) => notificationService.retryFailedNotification(req.params.notificationId, notificationActor(req), requestMeta(req)), 'Retry notification thành công.'),
  dispatchNotification: wrap((req) => notificationService.dispatchNotification(req.params.notificationId, notificationActor(req), requestMeta(req)), 'Dispatch notification thành công.'),
  dispatchQueuedNotifications: wrap((req) => notificationService.dispatchQueuedNotifications(req.body.limit || req.query.limit, notificationActor(req)), 'Dispatch queued notifications thành công.'),
  listNotificationDeliveries: wrap((req) => service.listNotificationDeliveries(req.query, req.auth), 'Lấy notification deliveries thành công.'),
  retryNotificationDelivery: wrap((req) => service.retryNotificationDelivery(req.params.deliveryId, req.body, req.auth, requestMeta(req)), 'Retry delivery thành công.'),
  cancelNotificationDelivery: wrap((req) => service.cancelNotificationDelivery(req.params.deliveryId, req.body, req.auth, requestMeta(req)), 'Cancel delivery thành công.'),

  previewBroadcast: wrap((req) => service.previewBroadcast(req.body, req.auth), 'Preview broadcast thành công.'),
  createBroadcast: wrap((req) => service.createBroadcastCampaign(req.body, req.auth, requestMeta(req)), 'Tạo broadcast campaign thành công.', 201),
  listBroadcasts: wrap((req) => service.listBroadcastCampaigns(req.query, req.auth), 'Lấy broadcast campaigns thành công.'),
  getBroadcast: wrap((req) => service.getBroadcastCampaign(req.params.campaignId, req.auth), 'Lấy broadcast campaign thành công.'),
  testBroadcast: wrap((req) => service.testBroadcastCampaign(req.params.campaignId, req.body, req.auth, requestMeta(req)), 'Test broadcast thành công.', 201),
  approveBroadcast: wrap((req) => service.approveBroadcastCampaign(req.params.campaignId, req.body, req.auth, requestMeta(req)), 'Approve broadcast thành công.'),
  sendBroadcast: wrap((req) => service.sendBroadcastCampaign(req.params.campaignId, req.auth, requestMeta(req)), 'Send broadcast thành công.'),
  cancelBroadcast: wrap((req) => service.cancelBroadcastCampaign(req.params.campaignId, req.body, req.auth, requestMeta(req)), 'Cancel broadcast thành công.'),
  cloneBroadcast: wrap((req) => service.cloneBroadcastCampaign(req.params.campaignId, req.auth, requestMeta(req)), 'Clone broadcast thành công.', 201),

  listNotificationTemplates: wrap((req) => service.listNotificationTemplates(req.query, req.auth), 'Lấy notification templates thành công.'),
  createNotificationTemplate: wrap((req) => service.createNotificationTemplate(req.body, req.auth, requestMeta(req)), 'Tạo notification template thành công.', 201),
  getNotificationTemplate: wrap((req) => service.getNotificationTemplate(req.params.templateId, req.auth), 'Lấy notification template thành công.'),
  updateNotificationTemplate: wrap((req) => service.updateNotificationTemplate(req.params.templateId, req.body, req.auth, requestMeta(req)), 'Cập nhật notification template thành công.'),
  deleteNotificationTemplate: wrap((req) => service.deleteNotificationTemplate(req.params.templateId, req.auth, requestMeta(req)), 'Xóa notification template thành công.'),
  previewNotificationTemplate: wrap((req) => service.previewNotificationTemplate(req.params.templateId, req.body, req.auth), 'Preview notification template thành công.'),
  testSendNotificationTemplate: wrap((req) => service.previewNotificationTemplate(req.params.templateId, req.body, req.auth), 'Test notification template thành công.'),
  seedNotificationTemplates: wrap((req) => service.seedNotificationTemplates(req.auth, requestMeta(req)), 'Seed notification templates thành công.'),
  validateNotificationTemplates: wrap((req) => service.validateNotificationTemplates(req.query, req.auth), 'Validate notification templates thành công.'),

  listReplyTemplates: wrap((req) => service.listReplyTemplates(req.query, req.auth), 'Lấy reply templates thành công.'),
  createReplyTemplate: wrap((req) => service.createReplyTemplate(req.body, req.auth, requestMeta(req)), 'Tạo reply template thành công.', 201),
  getReplyTemplate: wrap((req) => service.getReplyTemplate(req.params.replyTemplateId, req.auth), 'Lấy reply template thành công.'),
  updateReplyTemplate: wrap((req) => service.updateReplyTemplate(req.params.replyTemplateId, req.body, req.auth, requestMeta(req)), 'Cập nhật reply template thành công.'),
  deleteReplyTemplate: wrap((req) => service.deleteReplyTemplate(req.params.replyTemplateId, req.auth, requestMeta(req)), 'Xóa reply template thành công.'),
  previewReplyTemplate: wrap((req) => service.previewReplyTemplate(req.params.replyTemplateId, req.body, req.auth), 'Preview reply template thành công.'),
  useReplyTemplate: wrap((req) => service.useReplyTemplate(req.params.replyTemplateId, req.body, req.auth, requestMeta(req)), 'Dùng reply template thành công.'),
  seedReplyTemplates: wrap((req) => service.seedReplyTemplates(req.auth, requestMeta(req)), 'Seed reply templates thành công.'),

  getLogs: wrap((req) => service.getLogs(req.query, req.auth), 'Lấy communication logs thành công.'),
};
