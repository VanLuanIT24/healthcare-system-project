const express = require('express');
const procedureController = require('../controllers/procedure.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('procedureOrderId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);

const procedureReadPermissions = [
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_OWN,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
];

const procedureChargeCreatePermissions = [
  PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE,
  PERMISSION.CHARGES.CREATE,
  PERMISSION.CHARGES.REQUEST_CREATE,
  PERMISSION.ORDERS.CREATE_CHARGE,
];

router.use(authenticate);

router.get(
  '/me/history',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SELF_READ_COMPLETED] }),
  procedureController.getMyProcedureHistory,
);
router.get(
  '/me/orders/:procedureOrderId',
  authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SELF_READ_COMPLETED] }),
  procedureController.getProcedureOrderDetail,
);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/dashboard/summary', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ, PERMISSION.PROCEDURE_ORDERS.READ] }), procedureController.getProcedureDashboardSummary);

router.get('/orders', authorize({ anyPermissions: procedureReadPermissions }), procedureController.listProcedureOrders);
router.get('/orders/:procedureOrderId', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getProcedureOrderDetail);
router.get('/orders/:procedureOrderId/timeline', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getProcedureTimeline);

router.post('/orders/:procedureOrderId/schedule', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.ORDERS.ACKNOWLEDGE] }), procedureController.scheduleProcedure);
router.post('/orders/:procedureOrderId/start', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.START, PERMISSION.ORDERS.START] }), procedureController.startProcedure);
router.post('/orders/:procedureOrderId/complete', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.ORDERS.COMPLETE] }), procedureController.completeProcedure);
router.post('/orders/:procedureOrderId/cancel', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL] }), procedureController.cancelProcedure);
router.post('/orders/:procedureOrderId/no-show', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.NO_SHOW, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), procedureController.noShowProcedure);

router.get('/orders/:procedureOrderId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.READ_PROCEDURE, PERMISSION.ATTACHMENTS.READ, ...procedureReadPermissions] }), procedureController.listProcedureAttachments);
router.post('/orders/:procedureOrderId/attachments', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD] }), procedureController.uploadProcedureAttachment);

router.get('/orders/:procedureOrderId/charges', authorize({ anyPermissions: [PERMISSION.CHARGES.READ, ...procedureReadPermissions] }), procedureController.listProcedureCharges);
router.post('/orders/:procedureOrderId/charge', authorize({ anyPermissions: procedureChargeCreatePermissions }), procedureController.createProcedureCharge);

router.get('/encounters/:encounterId/orders', authorize({ anyPermissions: procedureReadPermissions }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return procedureController.listProcedureOrders(req, res, next);
});
router.get('/encounters/:encounterId/summary', authorize({ anyPermissions: [PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ, ...procedureReadPermissions] }), procedureController.getEncounterProcedureSummary);
router.get('/patients/:patientId/history', authorize({ anyPermissions: procedureReadPermissions }), procedureController.getPatientProcedureHistory);

module.exports = router;
