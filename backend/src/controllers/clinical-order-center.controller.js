const clinicalOrderCenterService = require('../services/clinical-order-center.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  list: wrap((req) => clinicalOrderCenterService.getClinicalOrderCenter(req.query, req.auth), 'Lấy Clinical Order Center thành công.'),
  summary: wrap((req) => clinicalOrderCenterService.getSummary(req.query, req.auth), 'Lấy tổng hợp Clinical Order Center thành công.'),
  statusBoard: wrap((req) => clinicalOrderCenterService.getStatusBoard(req.query, req.auth), 'Lấy status board Clinical Order Center thành công.'),
  pending: wrap((req) => clinicalOrderCenterService.getPending(req.query, req.auth), 'Lấy order chờ tiếp nhận thành công.'),
  acknowledged: wrap((req) => clinicalOrderCenterService.getAcknowledged(req.query, req.auth), 'Lấy order đã tiếp nhận thành công.'),
  inProgress: wrap((req) => clinicalOrderCenterService.getInProgress(req.query, req.auth), 'Lấy order đang thực hiện thành công.'),
  inProgressLive: wrap((req) => clinicalOrderCenterService.getInProgressLive(req.query, req.auth), 'Lấy live board order đang thực hiện thành công.'),
  completed: wrap((req) => clinicalOrderCenterService.getCompleted(req.query, req.auth), 'Lấy order hoàn tất thành công.'),
  cancelled: wrap((req) => clinicalOrderCenterService.getCancelled(req.query, req.auth), 'Lấy order bị hủy thành công.'),
  enteredInError: wrap((req) => clinicalOrderCenterService.getEnteredInError(req.query, req.auth), 'Lấy order nhập sai thành công.'),
  missingFiles: wrap((req) => clinicalOrderCenterService.getMissingFiles(req.query, req.auth), 'Lấy danh sách thiếu file thành công.'),
  slaBoard: wrap((req) => clinicalOrderCenterService.getSlaBoard(req.query, req.auth), 'Lấy SLA board thành công.'),
  fullDetail: wrap((req) => clinicalOrderCenterService.getOrderFullDetail(req.params.orderId, req.auth), 'Lấy chi tiết đầy đủ order thành công.'),
  fullTimeline: wrap((req) => clinicalOrderCenterService.getOrderFullTimeline(req.params.orderId, req.query, req.auth), 'Lấy timeline đầy đủ order thành công.'),
  accept: wrap((req) => clinicalOrderCenterService.acceptOrder(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Tiếp nhận order thành công.'),
  assign: wrap((req) => clinicalOrderCenterService.assignOrder(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Gán order thành công.'),
  notifyDoctor: wrap((req) => clinicalOrderCenterService.notifyDoctor(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Gửi thông báo bác sĩ thành công.'),
  bulkAction: wrap((req) => clinicalOrderCenterService.bulkAction(req.body, req.auth, requestMeta(req)), 'Thực hiện bulk action thành công.'),
};
