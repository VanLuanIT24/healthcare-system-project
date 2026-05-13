const orderService = require('../services/order.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  createOrder: wrap(
    (req) => orderService.createOrder(req.body.encounter_id, req.body, req.auth, requestMeta(req)),
    'Tạo order thành công.',
    201,
  ),
  createOrderFromEncounter: wrap(
    (req) => orderService.createOrder(req.params.encounterId, req.body, req.auth, requestMeta(req)),
    'Tạo order từ encounter thành công.',
    201,
  ),
  listOrders: wrap((req) => orderService.listOrders(req.query, req.auth), 'Lấy danh sách order thành công.'),
  searchOrders: wrap((req) => orderService.searchOrders(req.query, req.auth), 'Tìm kiếm order thành công.'),
  getOrderDetail: wrap((req) => orderService.getOrderDetail(req.params.orderId, req.auth), 'Lấy chi tiết order thành công.'),
  updateOrder: wrap((req) => orderService.updateOrder(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Cập nhật order thành công.'),
  dispatchOrder: wrap((req) => orderService.dispatchExistingOrder(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Dispatch order thành công.'),
  acknowledgeOrder: wrap((req) => orderService.acknowledgeOrder(req.params.orderId, req.auth, requestMeta(req)), 'Acknowledge order thành công.'),
  startOrder: wrap((req) => orderService.startOrder(req.params.orderId, req.auth, requestMeta(req)), 'Start order thành công.'),
  completeOrder: wrap((req) => orderService.completeOrder(req.params.orderId, req.auth, requestMeta(req), req.body), 'Complete order thành công.'),
  cancelOrder: wrap((req) => orderService.cancelOrder(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Hủy order thành công.'),
  markOrderEnteredInError: wrap((req) => orderService.markOrderEnteredInError(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Đánh dấu order entered_in_error thành công.'),
  createChargeForOrder: wrap((req) => orderService.createChargeForExistingOrder(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Tạo charge cho order thành công.', 201),
  listOrdersByEncounter: wrap((req) => orderService.listOrdersByEncounter(req.params.encounterId, req.query, req.auth), 'Lấy order theo encounter thành công.'),
  listOrdersByPatient: wrap((req) => orderService.listOrdersByPatient(req.params.patientId, req.query, req.auth), 'Lấy order theo bệnh nhân thành công.'),
  listOrdersByDoctor: wrap((req) => orderService.listOrdersByDoctor(req.params.doctorId, req.query, req.auth), 'Lấy order theo bác sĩ thành công.'),
  listOrdersByDepartment: wrap((req) => orderService.listOrdersByDepartment(req.params.departmentId, req.query, req.auth), 'Lấy order theo khoa thành công.'),
  getEncounterOrderSummary: wrap((req) => orderService.getEncounterOrderSummary(req.params.encounterId, req.auth), 'Lấy tổng quan order của encounter thành công.'),
  getOrderTimeline: wrap((req) => orderService.getOrderTimeline(req.params.orderId, req.auth), 'Lấy timeline order thành công.'),
};
