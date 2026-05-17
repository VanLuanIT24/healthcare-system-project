const insuranceSelfService = require('../services/insurance-self-service.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  createMyInsurancePolicy: wrap((req) => insuranceSelfService.createMyInsurancePolicy(req.body, req.auth, requestMeta(req)), 'Tạo insurance policy portal thành công.', 201),
  updateMyInsurancePolicy: wrap((req) => insuranceSelfService.updateMyInsurancePolicy(req.params.policyId, req.body, req.auth, requestMeta(req)), 'Cập nhật insurance policy portal thành công.'),
  submitMyInsurancePolicy: wrap((req) => insuranceSelfService.submitMyInsurancePolicy(req.params.policyId, req.auth, requestMeta(req)), 'Submit insurance policy thành công.'),
  attachMyInsurancePolicyCard: wrap((req) => insuranceSelfService.attachMyInsurancePolicyCard(req.params.policyId, req.body, req.auth, requestMeta(req)), 'Gắn attachment thẻ bảo hiểm thành công.'),
  verifyInsurancePolicy: wrap((req) => insuranceSelfService.verifyInsurancePolicy(req.params.policyId, req.body, req.auth, requestMeta(req)), 'Verify insurance policy thành công.'),
  rejectInsurancePolicy: wrap((req) => insuranceSelfService.rejectInsurancePolicy(req.params.policyId, req.body, req.auth, requestMeta(req)), 'Reject insurance policy thành công.'),
  listMyInsurancePolicies: wrap((req) => insuranceSelfService.listMyInsurancePolicies(req.query, req.auth), 'Lấy insurance policy portal thành công.'),
};
