const supportTicketService = require('../services/support-ticket.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  createTicket: wrap((req) => supportTicketService.createTicket(req.body, req.auth, requestMeta(req)), 'Tạo support ticket thành công.', 201),
  listTickets: wrap((req) => supportTicketService.listTickets(req.query, req.auth), 'Lấy danh sách support ticket thành công.'),
  getMySummary: wrap((req) => supportTicketService.getMySummary(req.auth), 'Lấy tổng quan hỗ trợ của tôi thành công.'),
  getTicket: wrap((req) => supportTicketService.getTicket(req.params.ticketId, req.auth), 'Lấy chi tiết support ticket thành công.'),
  replyTicket: wrap((req) => supportTicketService.replyTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Reply support ticket thành công.', 201),
  assignTicket: wrap((req) => supportTicketService.assignTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Assign support ticket thành công.'),
  changePriority: wrap((req) => supportTicketService.changePriority(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Đổi priority support ticket thành công.'),
  resolveTicket: wrap((req) => supportTicketService.resolveTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Resolve support ticket thành công.'),
  closeTicket: wrap((req) => supportTicketService.closeTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Close support ticket thành công.'),
  reopenTicket: wrap((req) => supportTicketService.reopenTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Reopen support ticket thành công.'),
  rateTicket: wrap((req) => supportTicketService.rateTicket(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Gửi đánh giá support ticket thành công.'),
};
