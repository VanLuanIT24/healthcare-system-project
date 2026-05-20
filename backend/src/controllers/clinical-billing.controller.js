const clinicalBillingService = require('../services/clinical-billing.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getDashboard: wrap((req) => clinicalBillingService.getDashboard(req.query, req.auth), 'Lấy dashboard hóa đơn CLS thành công.'),
  listChargeCandidates: wrap((req) => clinicalBillingService.listChargeCandidates(req.query, req.auth), 'Lấy danh sách order chờ tạo charge thành công.'),
  listCharges: wrap((req) => clinicalBillingService.listClinicalCharges(req.query, req.auth), 'Lấy danh sách charge CLS thành công.'),
  listUnbilledCharges: wrap((req) => clinicalBillingService.listUnbilledCharges(req.query, req.auth), 'Lấy danh sách charge CLS chưa lập hóa đơn thành công.'),
  listInvoices: wrap((req) => clinicalBillingService.listClinicalInvoices(req.query, req.auth), 'Lấy danh sách invoice CLS thành công.'),
  createInvoiceFromSelectedCharges: wrap((req) => clinicalBillingService.createInvoiceFromSelectedCharges(req.body, req.auth, requestMeta(req)), 'Tạo invoice CLS từ charge đã chọn thành công.', 201),
  createInvoiceFromEncounter: wrap((req) => clinicalBillingService.createInvoiceFromEncounter(req.body, req.auth, requestMeta(req)), 'Tạo invoice CLS theo encounter thành công.', 201),
  createChargeForOrder: wrap((req) => clinicalBillingService.createChargeForClinicalOrder(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Tạo charge CLS cho order thành công.', 201),
  createChargeForLabOrder: wrap((req) => clinicalBillingService.createChargeForLabOrder(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Tạo charge xét nghiệm thành công.', 201),
  createChargeForImagingOrder: wrap((req) => clinicalBillingService.createChargeForImagingOrder(req.params.imagingOrderId, req.body, req.auth, requestMeta(req)), 'Tạo charge chẩn đoán hình ảnh thành công.', 201),
  getOrderBillingTrace: wrap((req) => clinicalBillingService.loadOrderTrace(req.params.orderId, req.auth), 'Lấy billing trace của order thành công.'),
  getEncounterBillingSummary: wrap((req) => clinicalBillingService.getEncounterBillingSummary(req.params.encounterId, req.auth), 'Lấy billing summary của encounter thành công.'),
  getReconciliation: wrap((req) => clinicalBillingService.getReconciliation(req.query, req.auth), 'Lấy đối soát order-charge-invoice thành công.'),
  listExceptions: wrap((req) => clinicalBillingService.listExceptions(req.query, req.auth), 'Lấy danh sách lỗi nghiệp vụ billing CLS thành công.'),
  getInvoiceTimeline: wrap((req) => clinicalBillingService.getInvoiceTimeline(req.params.invoiceId, req.auth), 'Lấy timeline invoice CLS thành công.'),
};
