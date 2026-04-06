const queueService = require('../services/queue.service');
const { errorResponse, successResponse } = require('../utils/http-response');

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

function wrap(serviceMethod, successMessage, statusCode = 200) {
  return async function wrapped(req, res) {
    try {
      const result = await serviceMethod(req, res);
      return successResponse(res, { statusCode, message: successMessage, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  };
}

module.exports = {
  createQueueTicket: wrap((req) => queueService.createQueueTicket(req.body, req.auth, requestMeta(req)), 'Tạo queue ticket thành công.', 201),
  listQueueTickets: wrap((req) => queueService.listQueueTickets(req.query), 'Lấy danh sách queue ticket thành công.'),
  getQueueTicketDetail: wrap((req) => queueService.getQueueTicketDetail(req.params.ticketId), 'Lấy chi tiết queue ticket thành công.'),
  callNextQueue: wrap((req) => queueService.callNextQueue(req.body, req.auth, requestMeta(req)), 'Gọi số tiếp theo thành công.'),
  recallQueueTicket: wrap((req) => queueService.recallQueueTicket(req.params.ticketId, req.auth, requestMeta(req)), 'Gọi lại số thành công.'),
  skipQueueTicket: wrap((req) => queueService.skipQueueTicket(req.params.ticketId, req.auth, requestMeta(req)), 'Bỏ qua queue ticket thành công.'),
  startQueueService: wrap((req) => queueService.startQueueService(req.params.ticketId, req.auth, requestMeta(req)), 'Bắt đầu phục vụ queue ticket thành công.'),
  completeQueueTicket: wrap((req) => queueService.completeQueueTicket(req.params.ticketId, req.auth, requestMeta(req)), 'Hoàn tất queue ticket thành công.'),
  cancelQueueTicket: wrap((req) => queueService.cancelQueueTicket(req.params.ticketId, req.auth, requestMeta(req)), 'Hủy queue ticket thành công.'),
  getDoctorQueueBoard: wrap((req) => queueService.getDoctorQueueBoard(req.params.doctorId, req.query), 'Lấy bảng hàng chờ theo bác sĩ thành công.'),
  getDepartmentQueueBoard: wrap((req) => queueService.getDepartmentQueueBoard(req.params.departmentId, req.query), 'Lấy bảng hàng chờ theo department thành công.'),
  getTodayQueueSummary: wrap((req) => queueService.getTodayQueueSummary(req.query), 'Lấy tổng quan queue hôm nay thành công.'),
  createQueueTicketFromAppointment: wrap(
    (req) => queueService.createQueueTicketFromAppointment(req.params.appointmentId, req.auth, requestMeta(req)),
    'Tạo queue ticket từ appointment thành công.',
  ),
  checkInPatientToQueue: wrap((req) => queueService.checkInPatientToQueue(req.body, req.auth, requestMeta(req)), 'Check-in bệnh nhân vào hàng chờ thành công.'),
  getQueueTimeline: wrap((req) => queueService.getQueueTimeline(req.params.ticketId, req.query), 'Lấy timeline queue ticket thành công.'),
};
