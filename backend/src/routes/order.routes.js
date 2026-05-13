const express = require('express');
const orderController = require('../controllers/order.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('patientId', validateObjectIdParam);
router.param('doctorId', validateObjectIdParam);
router.param('departmentId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('orderId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.ORDERS.READ_MEDICATION,
  PERMISSION.ORDERS.READ_SERVICE,
];

const createPermissions = [
  PERMISSION.ORDERS.CREATE,
  PERMISSION.ORDERS.CREATE_LAB,
  PERMISSION.ORDERS.CREATE_IMAGING,
  PERMISSION.ORDERS.CREATE_PROCEDURE,
  PERMISSION.ORDERS.CREATE_MEDICATION,
  PERMISSION.ORDERS.CREATE_SERVICE,
  PERMISSION.PRESCRIPTIONS.CREATE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: readPermissions }), orderController.listOrders);
router.get('/search', authorize({ anyPermissions: readPermissions }), orderController.searchOrders);
router.post('/', authorize({ anyPermissions: createPermissions }), orderController.createOrder);
router.get('/patient/:patientId', authorize({ anyPermissions: [...readPermissions, PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED] }), orderController.listOrdersByPatient);
router.get('/doctor/:doctorId', authorize({ anyPermissions: [PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_OWN] }), orderController.listOrdersByDoctor);
router.get('/department/:departmentId', authorize({ anyPermissions: [PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_DEPARTMENT] }), orderController.listOrdersByDepartment);
router.get('/encounter/:encounterId', authorize({ anyPermissions: [...readPermissions, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), orderController.listOrdersByEncounter);
router.get('/encounter/:encounterId/summary', authorize({ anyPermissions: [PERMISSION.ORDERS.SUMMARY_READ, PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_OWN, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), orderController.getEncounterOrderSummary);
router.get('/:orderId', authorize({ anyPermissions: readPermissions }), orderController.getOrderDetail);
router.get('/:orderId/timeline', authorize({ anyPermissions: [PERMISSION.ORDERS.TIMELINE_READ, ...readPermissions] }), orderController.getOrderTimeline);
router.patch('/:orderId', authorize({ anyPermissions: [PERMISSION.ORDERS.UPDATE, PERMISSION.ORDERS.CREATE] }), orderController.updateOrder);
router.post('/:orderId/dispatch', authorize({ anyPermissions: [PERMISSION.ORDERS.DISPATCH, ...createPermissions] }), orderController.dispatchOrder);
router.post('/:orderId/acknowledge', authorize({ anyPermissions: [PERMISSION.ORDERS.ACKNOWLEDGE, PERMISSION.LAB_ORDERS.ACKNOWLEDGE, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.PROCEDURE_ORDERS.UPDATE] }), orderController.acknowledgeOrder);
router.post('/:orderId/start', authorize({ anyPermissions: [PERMISSION.ORDERS.START, PERMISSION.LAB_ORDERS.PROCESS, PERMISSION.IMAGING_ORDERS.START, PERMISSION.PROCEDURE_ORDERS.START] }), orderController.startOrder);
router.post('/:orderId/complete', authorize({ anyPermissions: [PERMISSION.ORDERS.COMPLETE, PERMISSION.LAB_ORDERS.UPDATE_STATUS, PERMISSION.IMAGING_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.COMPLETE] }), orderController.completeOrder);
router.post('/:orderId/cancel', authorize({ anyPermissions: [PERMISSION.ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL_OWN, PERMISSION.ORDERS.CANCEL_DEPARTMENT] }), orderController.cancelOrder);
router.post('/:orderId/entered-in-error', authorize({ permissions: [PERMISSION.ORDERS.ENTERED_IN_ERROR] }), orderController.markOrderEnteredInError);
router.post('/:orderId/create-charge', authorize({ anyPermissions: [PERMISSION.ORDERS.CREATE_CHARGE, PERMISSION.CHARGES.CREATE, PERMISSION.CHARGES.MANAGE] }), orderController.createChargeForOrder);

module.exports = router;
