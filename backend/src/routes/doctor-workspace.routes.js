const express = require('express');
const doctorWorkspaceController = require('../controllers/doctor-workspace.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('patientId', validateObjectIdParam);

const workspaceReadPermissions = [
  PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ,
  PERMISSION.APPOINTMENTS.READ_OWN,
  PERMISSION.QUEUE.READ_OWN,
  PERMISSION.ENCOUNTERS.READ_OWN,
  PERMISSION.ENCOUNTERS.READ_ASSIGNED,
  PERMISSION.CLINICAL_NOTES.READ,
  PERMISSION.CONSULTATIONS.READ_OWN,
  PERMISSION.DIAGNOSES.READ,
  PERMISSION.PROBLEMS.READ,
  PERMISSION.ALLERGIES.READ,
  PERMISSION.CARE_PLANS.READ,
  PERMISSION.VITAL_SIGNS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.PROCEDURE_ORDERS.READ_OWN,
  PERMISSION.PRESCRIPTIONS.READ_OWN,
  PERMISSION.PATIENTS.READ_ASSIGNED,
  PERMISSION.PATIENTS.SEARCH,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/overview', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getOverview);
router.get('/search', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.search);
router.get('/queue', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getQueue);
router.get('/schedules/today', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getTodaySchedule);
router.get('/patients', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getDoctorPatients);
router.get('/encounters', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getDoctorEncounters);
router.get('/tasks', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getTasks);
router.get('/results', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getResults);
router.get('/collaboration', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getCollaboration);
router.get('/patients/:patientId/summary', authorize({ anyPermissions: workspaceReadPermissions }), doctorWorkspaceController.getPatientSummary);

module.exports = router;
