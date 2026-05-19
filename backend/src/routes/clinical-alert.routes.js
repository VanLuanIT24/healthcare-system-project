const express = require('express');
const nursingController = require('../controllers/nursing.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('clinicalAlertId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('vitalSignId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

const readPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.ENCOUNTERS.READ,
  PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
  PERMISSION.VITAL_SIGNS.READ,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.EMERGENCY.READ,
];

const writePermissions = [
  PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS,
  PERMISSION.ENCOUNTERS.UPDATE,
  PERMISSION.VITAL_SIGNS.CREATE,
  PERMISSION.CLINICAL_NOTES.CREATE_NURSING,
];

router.get('/', authorize({ anyPermissions: readPermissions }), nursingController.listClinicalAlerts);
router.post('/', authorize({ anyPermissions: writePermissions }), nursingController.createClinicalAlert);
router.get('/:clinicalAlertId', authorize({ anyPermissions: readPermissions }), nursingController.getClinicalAlert);
router.post('/:clinicalAlertId/acknowledge', authorize({ anyPermissions: writePermissions }), nursingController.acknowledgeClinicalAlert);
router.post('/:clinicalAlertId/notify-doctor', authorize({ anyPermissions: writePermissions }), nursingController.notifyDoctorClinicalAlert);
router.post('/:clinicalAlertId/escalate', authorize({ anyPermissions: writePermissions }), nursingController.escalateClinicalAlert);
router.post('/:clinicalAlertId/resolve', authorize({ anyPermissions: writePermissions }), nursingController.resolveClinicalAlert);
router.post('/:clinicalAlertId/dismiss', authorize({ anyPermissions: writePermissions }), nursingController.dismissClinicalAlert);
router.post('/evaluate/encounter/:encounterId', authorize({ anyPermissions: writePermissions }), nursingController.evaluateEncounterAlerts);
router.post('/evaluate/vital-sign/:vitalSignId', authorize({ anyPermissions: writePermissions }), nursingController.evaluateVitalSignAlert);

module.exports = router;
