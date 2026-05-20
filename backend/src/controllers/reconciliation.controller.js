const reconciliationService = require('../services/reconciliation.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getOverview: wrap((req) => reconciliationService.getOverview(req.query, req.auth), 'Lay tong quan doi soat thanh cong.'),
  listBatches: wrap((req) => reconciliationService.listBatches(req.query, req.auth), 'Lay danh sach batch doi soat thanh cong.'),
  createBatch: wrap((req) => reconciliationService.createBatch(req.body, req.auth, requestMeta(req)), 'Tao batch doi soat thanh cong.', 201),
  getBatchDetail: wrap((req) => reconciliationService.getBatchDetail(req.params.batchId, req.auth), 'Lay chi tiet batch doi soat thanh cong.'),
  closeBatch: wrap((req) => reconciliationService.closeBatch(req.params.batchId, req.body, req.auth, requestMeta(req)), 'Dong batch doi soat thanh cong.'),
  lockBatch: wrap((req) => reconciliationService.lockBatch(req.params.batchId, req.body, req.auth, requestMeta(req)), 'Khoa batch doi soat thanh cong.'),
  importTransactions: wrap((req) => reconciliationService.importTransactions(req.body, req.auth, requestMeta(req)), 'Import sao ke doi soat thanh cong.', 201),
  listTransactions: wrap((req) => reconciliationService.listTransactions(req.query, req.auth), 'Lay danh sach giao dich doi soat thanh cong.'),
  getTransactionDetail: wrap((req) => reconciliationService.getTransactionDetail(req.params.transactionId, req.auth), 'Lay chi tiet giao dich doi soat thanh cong.'),
  getTransactionCandidates: wrap((req) => reconciliationService.getTransactionCandidates(req.params.transactionId, req.auth), 'Lay goi y match giao dich thanh cong.'),
  autoMatch: wrap((req) => reconciliationService.autoMatch(req.body, req.auth, requestMeta(req)), 'Auto match doi soat thanh cong.'),
  matchTransactionToIntent: wrap((req) => reconciliationService.matchTransactionToIntent(req.params.transactionId, req.body, req.auth, requestMeta(req)), 'Match giao dich voi payment intent thanh cong.'),
  matchTransactionToInvoice: wrap((req) => reconciliationService.matchTransactionToInvoice(req.params.transactionId, req.body, req.auth, requestMeta(req)), 'Match giao dich voi invoice thanh cong.'),
  markTransactionUnmatched: wrap((req) => reconciliationService.markTransactionUnmatched(req.params.transactionId, req.body, req.auth, requestMeta(req)), 'Danh dau giao dich chua khop thanh cong.'),
  ignoreTransaction: wrap((req) => reconciliationService.ignoreTransaction(req.params.transactionId, req.body, req.auth, requestMeta(req)), 'Bo qua giao dich doi soat thanh cong.'),
  disputeTransaction: wrap((req) => reconciliationService.disputeTransaction(req.params.transactionId, req.body, req.auth, requestMeta(req)), 'Danh dau giao dich nghi van thanh cong.'),
  getDailyReport: wrap((req) => reconciliationService.getDailyReport(req.query, req.auth), 'Lay bao cao doi soat ngay thanh cong.'),
  getProviderReport: wrap((req) => reconciliationService.getProviderReport(req.query, req.auth), 'Lay bao cao doi soat provider thanh cong.'),
  exportReport: wrap((req) => reconciliationService.exportReport(req.query, req.auth, requestMeta(req)), 'Export bao cao doi soat thanh cong.'),
};
