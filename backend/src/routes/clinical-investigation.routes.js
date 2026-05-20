const express = require('express');
const clinicalInvestigationController = require('../controllers/clinical-investigation.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('patientId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);

const clinicalInvestigationReadPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.PATIENTS.READ,
  PERMISSION.PATIENTS.READ_LIMITED,
  PERMISSION.PATIENTS.READ_ASSIGNED,
  PERMISSION.ENCOUNTERS.READ,
  PERMISSION.ENCOUNTERS.READ_ASSIGNED,
  PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
  PERMISSION.ENCOUNTERS.READ_OWN,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ_OWN,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ_OWN,
  PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_OWN,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ,
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_LAB,
  PERMISSION.ATTACHMENTS.READ_IMAGING,
  PERMISSION.ATTACHMENTS.READ_PROCEDURE,
].filter(Boolean);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get(
  '/patients/:patientId/overview',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.patientOverview,
);
router.get(
  '/patients/:patientId/snapshot',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.patientSnapshot,
);
router.get(
  '/patients/:patientId/result-matrix',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.patientResultMatrix,
);
router.get(
  '/patients/:patientId/timeline',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.patientTimeline,
);
router.get(
  '/patients/:patientId/pending-actions',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.patientPendingActions,
);
router.get(
  '/patients/:patientId/critical-alerts',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.patientCriticalAlerts,
);
router.get(
  '/patients/:patientId/file-gaps',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.patientFileGaps,
);
router.get(
  '/patients/:patientId/sla-breaches',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.patientSlaBreaches,
);

router.get(
  '/encounters/:encounterId/overview',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.encounterOverview,
);
router.get(
  '/encounters/:encounterId/result-matrix',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.encounterResultMatrix,
);
router.get(
  '/encounters/:encounterId/timeline',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.encounterTimeline,
);
router.get(
  '/encounters/:encounterId/pending-actions',
  authorize({ anyPermissions: clinicalInvestigationReadPermissions }),
  clinicalInvestigationController.encounterPendingActions,
);

module.exports = router;
