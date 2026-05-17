const express = require('express');
const paymentIntentController = require('../controllers/payment-intent.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('paymentId', validateObjectIdParam);

router.get('/providers', paymentIntentController.listAvailableProviders);

router.post(
  '/:paymentId/receipt',
  authenticate,
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENTS.SELF_READ, PERMISSION.PAYMENTS.SELF_CREATE_ONLINE] }),
  paymentIntentController.submitManualReceipt,
);

module.exports = router;
