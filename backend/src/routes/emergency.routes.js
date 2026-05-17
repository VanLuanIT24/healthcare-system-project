const express = require('express');
const emergencyController = require('../controllers/emergency.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');
const { createActionRateLimit } = require('../middleware/action-rate-limit');

const router = express.Router();

router.param('caseId', validateObjectIdParam);

router.use(authenticate);

const sosLimit = createActionRateLimit({
  action: 'emergency-sos',
  limit: 3,
  windowMs: 5 * 60 * 1000,
  message: 'Bạn đã gửi SOS quá nhiều lần trong thời gian ngắn. Nếu vẫn khẩn cấp, vui lòng gọi trực tiếp số cấp cứu.',
});

router.post('/me/sos', authorize({ actorTypes: ['patient', 'patient_relative'], anyPermissions: [PERMISSION.EMERGENCY.SELF_SOS] }), sosLimit, idempotencyRequired({ route: '/api/emergency/me/sos' }), emergencyController.createSos);
router.get('/cases', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ] }), emergencyController.listCases);
router.get('/cases/:caseId', authorize({ actorTypes: ['staff', 'patient', 'patient_relative'], anyPermissions: [PERMISSION.EMERGENCY.READ, PERMISSION.EMERGENCY.SELF_SOS] }), emergencyController.getCase);
router.post('/cases/:caseId/acknowledge', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.ACKNOWLEDGE] }), emergencyController.acknowledgeCase);
router.post('/cases/:caseId/triage', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.triageCase);
router.post('/cases/:caseId/dispatch', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.dispatchCase);
router.post('/cases/:caseId/resolve', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.resolveCase);
router.post('/cases/:caseId/cancel', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.cancelCase);

module.exports = router;
