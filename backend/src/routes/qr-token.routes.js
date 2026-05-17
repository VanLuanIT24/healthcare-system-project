const express = require('express');
const qrTokenController = require('../controllers/qr-token.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { createAuthRateLimit } = require('../middleware/auth-rate-limit');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('invoiceId', validateObjectIdParam);
router.param('appointmentId', validateObjectIdParam);
router.param('ticketId', validateObjectIdParam);

const qrVerifyLimit = createAuthRateLimit({
  scope: 'qr-token-verify',
  limit: 120,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.params.token || req.ip,
  message: 'Quá nhiều yêu cầu verify QR token. Vui lòng thử lại sau.',
});

router.get('/verify/:token', qrVerifyLimit, qrTokenController.verifyQrToken);

router.use(authenticate);

router.post('/payment/:invoiceId', authorize({
  actorTypes: ['patient', 'staff'],
  anyPermissions: [PERMISSION.QR_TOKENS.CREATE, PERMISSION.PAYMENT_INTENTS.SELF_CREATE],
}), qrTokenController.createPaymentQr);
router.post('/appointments/:appointmentId/checkin', authorize({
  actorTypes: ['patient', 'staff'],
  anyPermissions: [PERMISSION.QR_TOKENS.CREATE, PERMISSION.APPOINTMENTS.SELF_READ],
}), qrTokenController.createAppointmentCheckinQr);
router.post('/queue/:ticketId', authorize({
  actorTypes: ['staff'],
  anyPermissions: [PERMISSION.QR_TOKENS.CREATE, PERMISSION.QUEUE.PRINT_TICKET],
}), qrTokenController.createQueueTicketQr);
router.post('/:token/consume', authorize({
  actorTypes: ['staff', 'patient', 'patient_relative'],
  anyPermissions: [PERMISSION.QR_TOKENS.VERIFY],
}), qrTokenController.consumeQrToken);
router.post('/:token/revoke', authorize({
  actorTypes: ['staff'],
  anyPermissions: [PERMISSION.QR_TOKENS.REVOKE],
}), qrTokenController.revokeQrToken);

module.exports = router;
