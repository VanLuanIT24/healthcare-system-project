const billingService = require('../services/billing.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  createServiceCatalog: wrap((req) => billingService.createServiceCatalog(req.body, req.auth, requestMeta(req)), 'Tạo service catalog thành công.', 201),
  listServiceCatalog: wrap((req) => billingService.listServiceCatalog(req.query, req.auth), 'Lấy danh sách service catalog thành công.'),
  getServiceCatalogDetail: wrap((req) => billingService.getServiceCatalogDetail(req.params.serviceId, req.auth), 'Lấy chi tiết service catalog thành công.'),
  updateServiceCatalog: wrap((req) => billingService.updateServiceCatalog(req.params.serviceId, req.body, req.auth, requestMeta(req)), 'Cập nhật service catalog thành công.'),
  retireServiceCatalog: wrap((req) => billingService.retireServiceCatalog(req.params.serviceId, req.body, req.auth, requestMeta(req)), 'Retire service catalog thành công.'),

  createCharge: wrap((req) => billingService.createCharge(req.body, req.auth, requestMeta(req)), 'Tạo charge thành công.', 201),
  listCharges: wrap((req) => billingService.listCharges(req.query, req.auth), 'Lấy danh sách charge thành công.'),
  getChargeDetail: wrap((req) => billingService.getChargeDetail(req.params.chargeId, req.auth), 'Lấy chi tiết charge thành công.'),
  postCharge: wrap((req) => billingService.postCharge(req.params.chargeId, req.auth, requestMeta(req)), 'Post charge thành công.'),
  voidCharge: wrap((req) => billingService.voidCharge(req.params.chargeId, req.body, req.auth, requestMeta(req)), 'Void charge thành công.'),

  createInvoiceFromCharges: wrap((req) => billingService.createInvoiceFromCharges(req.body, req.auth, requestMeta(req)), 'Tạo invoice từ charges thành công.', 201),
  listInvoices: wrap((req) => billingService.listInvoices(req.query, req.auth), 'Lấy danh sách invoice thành công.'),
  getInvoiceDetail: wrap((req) => billingService.getInvoiceDetail(req.params.invoiceId, req.auth), 'Lấy chi tiết invoice thành công.'),
  issueInvoice: wrap((req) => billingService.issueInvoice(req.params.invoiceId, req.auth, requestMeta(req)), 'Issue invoice thành công.'),
  voidInvoice: wrap((req) => billingService.voidInvoice(req.params.invoiceId, req.body, req.auth, requestMeta(req)), 'Void invoice thành công.'),
  getPatientBillingSummary: wrap((req) => billingService.getPatientBillingSummary(req.params.patientId, req.auth), 'Lấy billing summary của patient thành công.'),
  getMyBillingSummary: wrap((req) => billingService.getPatientBillingSummary(req.auth.patientId || req.auth.patient_id, req.auth), 'Lấy billing summary của tôi thành công.'),
  getMyInvoices: wrap((req) => billingService.listInvoices({ ...req.query, patient_id: req.auth.patientId || req.auth.patient_id }, req.auth), 'Lấy invoice của tôi thành công.'),

  createPayment: wrap((req) => billingService.createPayment(req.params.invoiceId, req.body, req.auth, requestMeta(req)), 'Tạo payment thành công.', 201),
  listPayments: wrap((req) => billingService.listPayments(req.query, req.auth), 'Lấy danh sách payment thành công.'),
  getPaymentDetail: wrap((req) => billingService.getPaymentDetail(req.params.paymentId, req.auth), 'Lấy chi tiết payment thành công.'),
  voidPayment: wrap((req) => billingService.voidPayment(req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Void payment thành công.'),
  refundPayment: wrap((req) => billingService.refundPayment(req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Refund payment thành công.'),
  getMyPayments: wrap((req) => billingService.listPayments({ ...req.query, patient_id: req.auth.patientId || req.auth.patient_id }, req.auth), 'Lấy payment của tôi thành công.'),

  createInsurancePolicy: wrap((req) => billingService.createInsurancePolicy(req.params.patientId, req.body, req.auth, requestMeta(req)), 'Tạo insurance policy thành công.', 201),
  listInsurancePolicies: wrap((req) => billingService.listInsurancePolicies(req.params.patientId, req.auth), 'Lấy danh sách insurance policy thành công.'),
  getInsurancePolicyDetail: wrap((req) => billingService.getInsurancePolicyDetail(req.params.policyId, req.auth), 'Lấy chi tiết insurance policy thành công.'),
  updateInsurancePolicy: wrap((req) => billingService.updateInsurancePolicy(req.params.policyId, req.body, req.auth, requestMeta(req)), 'Cập nhật insurance policy thành công.'),
  cancelInsurancePolicy: wrap((req) => billingService.cancelInsurancePolicy(req.params.policyId, req.body, req.auth, requestMeta(req)), 'Cancel insurance policy thành công.'),
  getMyInsurancePolicies: wrap((req) => billingService.listInsurancePolicies(req.auth.patientId || req.auth.patient_id, req.auth), 'Lấy insurance policy của tôi thành công.'),

  createInsuranceClaim: wrap((req) => billingService.createInsuranceClaim(req.params.invoiceId, req.body, req.auth, requestMeta(req)), 'Tạo insurance claim thành công.', 201),
  listInsuranceClaims: wrap((req) => billingService.listInsuranceClaims(req.query, req.auth), 'Lấy danh sách insurance claim thành công.'),
  getInsuranceClaimDetail: wrap((req) => billingService.getInsuranceClaimDetail(req.params.claimId, req.auth), 'Lấy chi tiết insurance claim thành công.'),
  submitClaim: wrap((req) => billingService.submitClaim(req.params.claimId, req.auth, requestMeta(req)), 'Submit insurance claim thành công.'),
  markClaimUnderReview: wrap((req) => billingService.markClaimUnderReview(req.params.claimId, req.auth, requestMeta(req)), 'Mark claim under review thành công.'),
  approveClaim: wrap((req) => billingService.approveClaim(req.params.claimId, req.body, req.auth, requestMeta(req)), 'Approve insurance claim thành công.'),
  rejectClaim: wrap((req) => billingService.rejectClaim(req.params.claimId, req.body, req.auth, requestMeta(req)), 'Reject insurance claim thành công.'),
  settleClaim: wrap((req) => billingService.settleClaim(req.params.claimId, req.body, req.auth, requestMeta(req)), 'Settle insurance claim thành công.'),
  cancelClaim: wrap((req) => billingService.cancelClaim(req.params.claimId, req.body, req.auth, requestMeta(req)), 'Cancel insurance claim thành công.'),
  getMyInsuranceClaims: wrap((req) => billingService.listInsuranceClaims({ ...req.query, patient_id: req.auth.patientId || req.auth.patient_id }, req.auth), 'Lấy insurance claim của tôi thành công.'),
};
