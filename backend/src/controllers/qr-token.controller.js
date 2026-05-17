const qrTokenService = require('../services/qr-token.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  createPaymentQr: wrap((req) => qrTokenService.createPaymentQr(req.params.invoiceId, req.body, req.auth, requestMeta(req)), 'Tạo QR payment thành công.', 201),
  createAppointmentCheckinQr: wrap((req) => qrTokenService.createAppointmentCheckinQr(req.params.appointmentId, req.body, req.auth, requestMeta(req)), 'Tạo QR check-in thành công.', 201),
  createQueueTicketQr: wrap((req) => qrTokenService.createQueueTicketQr(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Tạo QR queue ticket thành công.', 201),
  verifyQrToken: wrap((req) => qrTokenService.verifyQrToken(req.params.token, req.auth || {}, requestMeta(req)), 'Verify QR token thành công.'),
  consumeQrToken: wrap((req) => qrTokenService.consumeQrToken(req.params.token, req.auth, requestMeta(req)), 'Consume QR token thành công.'),
  revokeQrToken: wrap((req) => qrTokenService.revokeQrToken(req.params.token, req.body, req.auth, requestMeta(req)), 'Revoke QR token thành công.'),
};
