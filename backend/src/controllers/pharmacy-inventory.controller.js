const pharmacyInventoryService = require('../services/pharmacy-inventory.service');
const prescriptionService = require('../services/prescription.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  listMedications: wrap((req) => prescriptionService.listMedications(req.query), 'Lấy danh mục thuốc thành công.'),
  searchMedications: wrap((req) => prescriptionService.searchMedications(req.query), 'Tìm kiếm thuốc thành công.'),
  getMedicationDetail: wrap((req) => prescriptionService.getMedicationDetail(req.params.medicationId), 'Lấy chi tiết thuốc thành công.'),
  stockSelection: wrap((req) => prescriptionService.selectStockBatch(req.params.medicationId, req.query.quantity, req.query), 'Chọn lô FEFO thành công.'),

  listStockBatches: wrap((req) => prescriptionService.listStockBatches(req.query), 'Lấy lô thuốc thành công.'),
  getStockBatchDetail: wrap((req) => prescriptionService.getStockBatchDetail(req.params.batchId), 'Lấy chi tiết lô thuốc thành công.'),
  adjustStockBatch: wrap((req) => prescriptionService.adjustInventory(req.params.batchId || req.body.batch_id, req.body, req.auth, requestMeta(req)), 'Điều chỉnh tồn kho thành công.'),
  expireStockBatch: wrap((req) => prescriptionService.markBatchExpired(req.params.batchId, req.body, req.auth, requestMeta(req)), 'Đánh dấu hết hạn lô thành công.'),
  recallStockBatch: wrap((req) => prescriptionService.recallStockBatch(req.params.batchId, req.body, req.auth, requestMeta(req)), 'Recall lô thuốc thành công.'),
  quarantineStockBatch: wrap((req) => prescriptionService.quarantineStockBatch(req.params.batchId, req.body, req.auth, requestMeta(req)), 'Cách ly lô thuốc thành công.'),
  releaseQuarantineStockBatch: wrap((req) => prescriptionService.releaseQuarantineStockBatch(req.params.batchId, req.body, req.auth, requestMeta(req)), 'Gỡ cách ly lô thuốc thành công.'),
  wasteStockBatch: wrap((req) => prescriptionService.wasteStockBatch(req.params.batchId, req.body, req.auth, requestMeta(req)), 'Ghi nhận hủy/hao hụt lô thành công.'),
  transferStockBatchLocation: wrap((req) => prescriptionService.transferStockBatchLocation(req.params.batchId, req.body, req.auth, requestMeta(req)), 'Chuyển vị trí lô thành công.'),
  stockBatchRecallImpact: wrap((req) => prescriptionService.getStockBatchRecallImpact(req.params.batchId), 'Lấy impact recall thành công.'),

  listTransactions: wrap((req) => prescriptionService.listInventoryTransactions(req.query), 'Lấy lịch sử giao dịch kho thành công.'),
  getTransactionDetail: wrap((req) => pharmacyInventoryService.getTransactionDetail(req.params.transactionId), 'Lấy chi tiết giao dịch kho thành công.'),

  listWarehouses: wrap((req) => pharmacyInventoryService.listWarehouses({ ...req.query, actor: req.auth }), 'Lấy danh sách kho thành công.'),
  listStorageLocations: wrap((req) => pharmacyInventoryService.listStorageLocations({ ...req.query, actor: req.auth }), 'Lấy danh sách vị trí lưu kho thành công.'),
  getInventoryCenter: wrap((req) => pharmacyInventoryService.getInventoryCenter(req.query, req.auth), 'Lấy trung tâm giao dịch kho thành công.'),

  listReceipts: wrap((req) => pharmacyInventoryService.listReceipts({ ...req.query, actor: req.auth }), 'Lấy danh sách phiếu nhập kho thành công.'),
  getReceiptDetail: wrap((req) => pharmacyInventoryService.getReceiptDetail(req.params.receiptId), 'Lấy chi tiết phiếu nhập kho thành công.'),
  createReceipt: wrap((req) => pharmacyInventoryService.createReceipt(req.body, req.auth, requestMeta(req)), 'Tạo phiếu nhập kho thành công.', 201),
  postReceipt: wrap((req) => pharmacyInventoryService.postReceipt(req.params.receiptId, req.body, req.auth, requestMeta(req)), 'Post phiếu nhập kho thành công.'),

  listIssues: wrap((req) => pharmacyInventoryService.listIssues({ ...req.query, actor: req.auth }), 'Lấy phiếu xuất nội bộ thành công.'),
  getIssueDetail: wrap((req) => pharmacyInventoryService.getIssueDetail(req.params.issueId), 'Lấy chi tiết phiếu xuất nội bộ thành công.'),
  createIssue: wrap((req) => pharmacyInventoryService.createIssue(req.body, req.auth, requestMeta(req)), 'Tạo phiếu xuất nội bộ thành công.', 201),
  dispatchIssue: wrap((req) => pharmacyInventoryService.dispatchIssue(req.params.issueId, req.body, req.auth, requestMeta(req)), 'Xuất kho nội bộ thành công.'),

  listTransfers: wrap((req) => pharmacyInventoryService.listTransfers({ ...req.query, actor: req.auth }), 'Lấy phiếu chuyển kho thành công.'),
  getTransferDetail: wrap((req) => pharmacyInventoryService.getTransferDetail(req.params.transferId), 'Lấy chi tiết phiếu chuyển kho thành công.'),
  createTransfer: wrap((req) => pharmacyInventoryService.createTransfer(req.body, req.auth, requestMeta(req)), 'Tạo phiếu chuyển kho thành công.', 201),
  dispatchTransfer: wrap((req) => pharmacyInventoryService.dispatchTransfer(req.params.transferId, req.body, req.auth, requestMeta(req)), 'Dispatch chuyển kho thành công.'),

  listDisposals: wrap((req) => pharmacyInventoryService.listDisposals({ ...req.query, actor: req.auth }), 'Lấy phiếu hủy/hao hụt thành công.'),
  getDisposalDetail: wrap((req) => pharmacyInventoryService.getDisposalDetail(req.params.disposalId), 'Lấy chi tiết phiếu hủy/hao hụt thành công.'),
  createDisposal: wrap((req) => pharmacyInventoryService.createDisposal(req.body, req.auth, requestMeta(req)), 'Tạo phiếu hủy/hao hụt thành công.', 201),
  postDisposal: wrap((req) => pharmacyInventoryService.postDisposal(req.params.disposalId, req.body, req.auth, requestMeta(req)), 'Post phiếu hủy/hao hụt thành công.'),

  listReturns: wrap((req) => pharmacyInventoryService.listReturns({ ...req.query, actor: req.auth }), 'Lấy phiếu hoàn trả kho thành công.'),
  getReturnDetail: wrap((req) => pharmacyInventoryService.getReturnDetail(req.params.returnId), 'Lấy chi tiết phiếu hoàn trả kho thành công.'),
  createReturn: wrap((req) => pharmacyInventoryService.createReturn(req.body, req.auth, requestMeta(req)), 'Tạo phiếu hoàn trả kho thành công.', 201),
  postReturn: wrap((req) => pharmacyInventoryService.postReturn(req.params.returnId, req.body, req.auth, requestMeta(req)), 'Post phiếu hoàn trả kho thành công.'),
};

