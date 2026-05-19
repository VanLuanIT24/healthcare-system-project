const express = require('express');
const controller = require('../controllers/medication-administration.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('administrationId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

const readPermissions = [
  PERMISSION.MEDICATION_ADMINISTRATIONS.READ,
  PERMISSION.PRESCRIPTIONS.READ,
  PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT,
];

const writePermissions = [
  PERMISSION.MEDICATION_ADMINISTRATIONS.ADMINISTER,
  PERMISSION.MEDICATION_ADMINISTRATIONS.HOLD,
  PERMISSION.MEDICATION_ADMINISTRATIONS.REFUSE,
  PERMISSION.MEDICATION_ADMINISTRATIONS.OMIT,
  PERMISSION.PRESCRIPTIONS.UPDATE_OWN,
  PERMISSION.CLINICAL_NOTES.CREATE_NURSING,
];

router.get('/', authorize({ anyPermissions: readPermissions }), controller.listAdministrations);
router.post('/', authorize({ anyPermissions: writePermissions }), controller.createAdministration);
router.get('/:administrationId', authorize({ anyPermissions: readPermissions }), controller.getAdministration);
router.post('/:administrationId/give', authorize({ anyPermissions: writePermissions }), controller.giveAdministration);
router.post('/:administrationId/hold', authorize({ anyPermissions: writePermissions }), controller.holdAdministration);
router.post('/:administrationId/refuse', authorize({ anyPermissions: writePermissions }), controller.refuseAdministration);
router.post('/:administrationId/omit', authorize({ anyPermissions: writePermissions }), controller.omitAdministration);
router.post('/:administrationId/cancel', authorize({ anyPermissions: writePermissions }), controller.cancelAdministration);
router.post('/:administrationId/entered-in-error', authorize({ anyPermissions: writePermissions }), controller.markEnteredInError);
router.post('/:administrationId/reactions', authorize({ anyPermissions: writePermissions }), controller.addReaction);

router.get('/encounters/:encounterId', authorize({ anyPermissions: readPermissions }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return controller.listAdministrations(req, res, next);
});

router.get('/patients/:patientId', authorize({ anyPermissions: readPermissions }), (req, res, next) => {
  req.query.patient_id = req.params.patientId;
  return controller.listAdministrations(req, res, next);
});

module.exports = router;
