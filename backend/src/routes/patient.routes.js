const express = require('express');
const patientController = require('../controllers/patient.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('relativeId', validateObjectIdParam);
router.param('authorizationId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('identifierId', validateObjectIdParam);
router.param('problemId', validateObjectIdParam);
router.param('allergyId', validateObjectIdParam);

router.use(authenticate);

router.get('/me/profile', authorize({ actorTypes: ['patient'] }), patientController.getMyPatientProfile);
router.patch('/me/profile', authorize({ actorTypes: ['patient'] }), patientController.updateMyPatientProfile);
router.get('/me/appointments', authorize({ actorTypes: ['patient'] }), patientController.getMyAppointments);
router.get('/me/encounters', authorize({ actorTypes: ['patient'] }), patientController.getMyEncounters);
router.get('/me/prescriptions', authorize({ actorTypes: ['patient'] }), patientController.getMyPrescriptions);

router.use(authorize({ actorTypes: ['staff'] }));

router.get(
  '/',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_LIMITED, PERMISSION.PATIENTS.READ_ASSIGNED] }),
  patientController.listPatients,
);
router.get(
  '/search',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.SEARCH, PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_LIMITED] }),
  patientController.searchPatients,
);
router.post('/', authorize({ permissions: [PERMISSION.PATIENTS.CREATE] }), patientController.createPatient);
router.get(
  '/duplicates',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.CREATE, PERMISSION.PATIENTS.MERGE] }),
  patientController.detectDuplicatePatients,
);
router.post(
  '/duplicates',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.CREATE, PERMISSION.PATIENTS.MERGE] }),
  patientController.detectDuplicatePatients,
);

router.get('/merge/check', authorize({ permissions: [PERMISSION.PATIENTS.MERGE] }), patientController.checkPatientCanBeMerged);
router.get('/merge/preview', authorize({ permissions: [PERMISSION.PATIENTS.MERGE] }), patientController.previewPatientMerge);
router.post('/merge/preview', authorize({ permissions: [PERMISSION.PATIENTS.MERGE] }), patientController.previewPatientMerge);
router.post('/merge', authorize({ permissions: [PERMISSION.PATIENTS.MERGE] }), patientController.mergePatients);

router.patch(
  '/relatives/:relativeId',
  authorize({ permissions: [PERMISSION.PATIENT_RELATIVES.UPDATE] }),
  patientController.updatePatientRelative,
);
router.get(
  '/relatives/:relativeId',
  authorize({ anyPermissions: [PERMISSION.PATIENT_RELATIVES.READ, PERMISSION.PATIENTS.READ] }),
  patientController.getPatientRelativeDetail,
);
router.delete(
  '/relatives/:relativeId',
  authorize({ permissions: [PERMISSION.PATIENT_RELATIVES.DELETE] }),
  patientController.deletePatientRelativeSoft,
);
router.post(
  '/authorizations/:authorizationId/approve',
  authorize({ anyPermissions: [PERMISSION.PATIENT_AUTHORIZATIONS.APPROVE, PERMISSION.PATIENT_AUTHORIZATIONS.MANAGE] }),
  patientController.approvePatientAuthorization,
);
router.post(
  '/authorizations/:authorizationId/revoke',
  authorize({ anyPermissions: [PERMISSION.PATIENT_AUTHORIZATIONS.REVOKE, PERMISSION.PATIENT_AUTHORIZATIONS.MANAGE] }),
  patientController.revokePatientAuthorization,
);

router.get(
  '/:patientId',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_LIMITED, PERMISSION.PATIENTS.READ_ASSIGNED] }),
  patientController.getPatientDetail,
);
router.get(
  '/:patientId/summary',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_LIMITED, PERMISSION.PATIENTS.READ_ASSIGNED] }),
  patientController.getPatientSummary,
);
router.get(
  '/:patientId/timeline',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED] }),
  patientController.getPatientTimeline,
);
router.get(
  '/:patientId/can-book',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_LIMITED, PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE] }),
  patientController.checkPatientCanBookAppointment,
);
router.get(
  '/:patientId/can-book-appointment',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_LIMITED, PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.CREATE] }),
  patientController.checkPatientCanBookAppointment,
);
router.patch(
  '/:patientId',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.UPDATE, PERMISSION.PATIENTS.UPDATE_BASIC] }),
  patientController.updatePatient,
);
router.patch(
  '/:patientId/status',
  authorize({ permissions: [PERMISSION.PATIENTS.UPDATE_SENSITIVE] }),
  patientController.updatePatientStatus,
);
router.post(
  '/:patientId/archive',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.ARCHIVE, PERMISSION.PATIENTS.UPDATE_SENSITIVE] }),
  patientController.archivePatient,
);

router.post(
  '/:patientId/identifiers',
  authorize({ permissions: [PERMISSION.PATIENT_IDENTIFIERS.CREATE] }),
  patientController.addPatientIdentifier,
);
router.get(
  '/:patientId/identifiers',
  authorize({ anyPermissions: [PERMISSION.PATIENT_IDENTIFIERS.READ, PERMISSION.PATIENTS.READ] }),
  patientController.listPatientIdentifiers,
);
router.get(
  '/:patientId/identifiers/:identifierId',
  authorize({ anyPermissions: [PERMISSION.PATIENT_IDENTIFIERS.READ, PERMISSION.PATIENTS.READ] }),
  patientController.getPatientIdentifierDetail,
);
router.patch(
  '/:patientId/identifiers/:identifierId',
  authorize({ permissions: [PERMISSION.PATIENT_IDENTIFIERS.UPDATE] }),
  patientController.updatePatientIdentifier,
);
router.delete(
  '/:patientId/identifiers/:identifierId',
  authorize({ permissions: [PERMISSION.PATIENT_IDENTIFIERS.DELETE] }),
  patientController.removePatientIdentifier,
);
router.post(
  '/:patientId/identifiers/:identifierId/set-primary',
  authorize({ permissions: [PERMISSION.PATIENT_IDENTIFIERS.MANAGE] }),
  patientController.setPrimaryPatientIdentifier,
);

router.post(
  '/:patientId/link-account',
  authorize({ anyPermissions: [PERMISSION.PATIENT_ACCOUNTS.CREATE, PERMISSION.PATIENTS.UPDATE_SENSITIVE] }),
  patientController.linkUserAccountToPatient,
);
router.post(
  '/:patientId/account',
  authorize({ anyPermissions: [PERMISSION.PATIENT_ACCOUNTS.CREATE, PERMISSION.PATIENTS.UPDATE_SENSITIVE] }),
  patientController.linkUserAccountToPatient,
);

router.get(
  '/:patientId/relatives',
  authorize({ anyPermissions: [PERMISSION.PATIENT_RELATIVES.READ, PERMISSION.PATIENTS.READ] }),
  patientController.listPatientRelatives,
);
router.post(
  '/:patientId/relatives',
  authorize({ permissions: [PERMISSION.PATIENT_RELATIVES.CREATE] }),
  patientController.addPatientRelative,
);
router.get(
  '/:patientId/relatives/:relativeId/authorization/check',
  authorize({ anyPermissions: [PERMISSION.PATIENT_AUTHORIZATIONS.READ, PERMISSION.PATIENT_AUTHORIZATIONS.MANAGE, PERMISSION.PATIENTS.READ] }),
  patientController.checkRelativeAuthorization,
);

router.get(
  '/:patientId/authorizations',
  authorize({ anyPermissions: [PERMISSION.PATIENT_AUTHORIZATIONS.READ, PERMISSION.PATIENTS.READ] }),
  patientController.listPatientAuthorizations,
);
router.post(
  '/:patientId/authorizations',
  authorize({ anyPermissions: [PERMISSION.PATIENT_AUTHORIZATIONS.CREATE, PERMISSION.PATIENT_AUTHORIZATIONS.MANAGE] }),
  patientController.createPatientAuthorization,
);

router.get(
  '/:patientId/problems',
  authorize({ anyPermissions: [PERMISSION.PROBLEMS.READ, PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED] }),
  patientController.listPatientProblems,
);
router.post('/:patientId/problems', authorize({ permissions: [PERMISSION.PROBLEMS.CREATE] }), patientController.addPatientProblem);
router.patch('/:patientId/problems/:problemId', authorize({ permissions: [PERMISSION.PROBLEMS.UPDATE] }), patientController.updatePatientProblem);
router.post(
  '/:patientId/problems/:problemId/resolve',
  authorize({ anyPermissions: [PERMISSION.PROBLEMS.RESOLVE, PERMISSION.PROBLEMS.UPDATE] }),
  patientController.resolvePatientProblem,
);

router.get(
  '/:patientId/allergies',
  authorize({ anyPermissions: [PERMISSION.ALLERGIES.READ, PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED] }),
  patientController.listPatientAllergies,
);
router.post('/:patientId/allergies', authorize({ permissions: [PERMISSION.ALLERGIES.CREATE] }), patientController.addPatientAllergy);
router.patch('/:patientId/allergies/:allergyId', authorize({ permissions: [PERMISSION.ALLERGIES.UPDATE] }), patientController.updatePatientAllergy);
router.delete(
  '/:patientId/allergies/:allergyId',
  authorize({ anyPermissions: [PERMISSION.ALLERGIES.RESOLVE, PERMISSION.ALLERGIES.UPDATE] }),
  patientController.removePatientAllergy,
);

router.get(
  '/:patientId/appointments',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.APPOINTMENTS.READ] }),
  patientController.getPatientAppointmentHistory,
);
router.get(
  '/:patientId/appointments/history',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.APPOINTMENTS.READ] }),
  patientController.getPatientAppointmentHistory,
);
router.get(
  '/:patientId/encounters',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_ASSIGNED] }),
  patientController.getPatientEncounterHistory,
);
router.get(
  '/:patientId/encounters/history',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_ASSIGNED] }),
  patientController.getPatientEncounterHistory,
);
router.get(
  '/:patientId/prescriptions',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN] }),
  patientController.getPatientPrescriptionHistory,
);
router.get(
  '/:patientId/prescriptions/history',
  authorize({ anyPermissions: [PERMISSION.PATIENTS.READ, PERMISSION.PATIENTS.READ_ASSIGNED, PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_OWN] }),
  patientController.getPatientPrescriptionHistory,
);

module.exports = router;
