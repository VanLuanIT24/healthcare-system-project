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
router.param('triageId', validateObjectIdParam);

router.use(authenticate);

const sosLimit = createActionRateLimit({
  action: 'emergency-sos',
  limit: 3,
  windowMs: 5 * 60 * 1000,
  message: 'Bạn đã gửi SOS quá nhiều lần trong thời gian ngắn. Nếu vẫn khẩn cấp, vui lòng gọi trực tiếp số cấp cứu.',
});

router.post('/me/sos', authorize({ actorTypes: ['patient', 'patient_relative'], anyPermissions: [PERMISSION.EMERGENCY.SELF_SOS] }), sosLimit, idempotencyRequired({ route: '/api/emergency/me/sos' }), emergencyController.createSos);
router.get('/me/cases', authorize({ actorTypes: ['patient', 'patient_relative'], anyPermissions: [PERMISSION.EMERGENCY.SELF_SOS] }), emergencyController.listMyCases);
router.get('/me/cases/:caseId', authorize({ actorTypes: ['patient', 'patient_relative'], anyPermissions: [PERMISSION.EMERGENCY.SELF_SOS] }), emergencyController.getMyCase);
router.post('/me/cases/:caseId/cancel', authorize({ actorTypes: ['patient', 'patient_relative'], anyPermissions: [PERMISSION.EMERGENCY.SELF_SOS] }), emergencyController.cancelMyCase);
router.get('/dashboard/open-summary', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ] }), emergencyController.getOpenSummary);
router.get('/triage-queue', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ, PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.getTriageQueue);
router.get('/dispatch-board', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ, PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.getDispatchBoard);
router.get('/escalations', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ, PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.getEscalations);
router.get('/escalations/open', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ, PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.getEscalations);
router.get('/sla/board', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ] }), emergencyController.getSlaBoard);
router.get('/sla/summary', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ] }), emergencyController.getSlaBoard);
router.post('/cases', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.ACKNOWLEDGE, PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), idempotencyRequired({ route: '/api/emergency/cases' }), emergencyController.createCase);
router.get('/cases/open', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ] }), emergencyController.listOpenCases);
router.get('/cases/closed', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ] }), emergencyController.listClosedCases);
router.get('/cases', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ] }), emergencyController.listCases);
router.get('/cases/:caseId', authorize({ actorTypes: ['staff', 'patient', 'patient_relative'], anyPermissions: [PERMISSION.EMERGENCY.READ, PERMISSION.EMERGENCY.SELF_SOS] }), emergencyController.getCase);
router.post('/cases/:caseId/acknowledge', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.ACKNOWLEDGE] }), emergencyController.acknowledgeCase);
router.post('/cases/:caseId/triage', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.triageCase);
router.get('/cases/:caseId/triage', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.READ, PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.getCaseTriage);
router.post('/cases/:caseId/triage/start', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.startEmergencyTriage);
router.post('/cases/:caseId/triage/save-draft', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.saveEmergencyTriageDraft);
router.post('/cases/:caseId/triage/complete', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.completeEmergencyTriage);
router.post('/cases/:caseId/dispatch', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.dispatchCase);
router.post('/cases/:caseId/assign', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.ACKNOWLEDGE, PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.assignCase);
router.patch('/cases/:caseId/assignment', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.ACKNOWLEDGE, PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.assignCase);
router.patch('/cases/:caseId/priority', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.updateCasePriority);
router.post('/cases/:caseId/escalate', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.escalateCase);
router.post('/cases/:caseId/update-location', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.ACKNOWLEDGE, PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.updateCaseLocation);
router.post('/cases/:caseId/location', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.ACKNOWLEDGE, PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.updateCaseLocation);
router.post('/cases/:caseId/add-note', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.ACKNOWLEDGE, PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.addCaseNote);
router.get('/cases/:caseId/timeline', authorize({ actorTypes: ['staff', 'patient', 'patient_relative'], anyPermissions: [PERMISSION.EMERGENCY.READ, PERMISSION.EMERGENCY.SELF_SOS] }), emergencyController.getCaseTimeline);
router.post('/cases/:caseId/notify-doctor', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE, PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.notifyDoctor);
router.post('/cases/:caseId/resolve', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.resolveCase);
router.post('/cases/:caseId/cancel', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.RESOLVE] }), emergencyController.cancelCase);
router.patch('/triages/:triageId', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.updateEmergencyTriage);
router.post('/triages/:triageId/sign', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.EMERGENCY.TRIAGE] }), emergencyController.signEmergencyTriage);

module.exports = router;
