const accessAuthorizationService = require('../services/access-authorization.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  signConsent: wrap((req) => accessAuthorizationService.signConsent(req.body, req.auth, requestMeta(req)), 'Ký consent thành công.', 201),
  listConsents: wrap((req) => accessAuthorizationService.listConsents(req.query, req.auth), 'Lấy consent thành công.'),
  revokeConsent: wrap((req) => accessAuthorizationService.revokeConsent(req.params.consentId, req.body, req.auth, requestMeta(req)), 'Thu hồi consent thành công.'),
  startBreakGlass: wrap((req) => accessAuthorizationService.startBreakGlass(req.body, req.auth, requestMeta(req)), 'Bắt đầu break-glass thành công.', 201),
  endBreakGlass: wrap((req) => accessAuthorizationService.endBreakGlass(req.params.accessId, req.body, req.auth, requestMeta(req)), 'Kết thúc break-glass thành công.'),
  listBreakGlass: wrap((req) => accessAuthorizationService.listBreakGlass(req.query, req.auth), 'Lấy break-glass logs thành công.'),
};
