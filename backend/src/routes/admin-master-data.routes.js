const express = require('express');
const masterDataController = require('../controllers/master-data.controller');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

const readPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.SERVICE_CATALOG.READ,
  PERMISSION.PHARMACY_CONFIG?.READ,
  PERMISSION.MEDICATIONS.READ,
  PERMISSION.STOCK_BATCHES.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ,
  PERMISSION.LAB_TEST_CATALOG.READ,
  PERMISSION.SPECIMEN_TYPE_CATALOG.READ,
  PERMISSION.IMAGING_MODALITY_CATALOG.READ,
  PERMISSION.IMAGING_EQUIPMENT.READ,
  PERMISSION.PROCEDURE_CATALOG.READ,
  PERMISSION.RESULT_REPORT_TEMPLATES.READ,
  PERMISSION.CLINICAL_SLA_RULES.READ,
  PERMISSION.SETTINGS.READ,
  PERMISSION.AUDIT_LOGS.READ,
].filter(Boolean);

router.get('/overview', authorize({ anyPermissions: readPermissions }), masterDataController.getOverview);
router.get('/quality-dashboard', authorize({ anyPermissions: readPermissions }), masterDataController.getQualityDashboard);
router.post('/quality-check/run', authorize({ anyPermissions: readPermissions }), masterDataController.runQualityCheck);
router.get('/issues', authorize({ anyPermissions: readPermissions }), masterDataController.getIssues);
router.get('/recent-changes', authorize({ anyPermissions: readPermissions }), masterDataController.getRecentChanges);
router.get('/dependency-graph', authorize({ anyPermissions: readPermissions }), masterDataController.getDependencyGraph);
router.get('/entities/:entity/:id/dependencies', authorize({ anyPermissions: readPermissions }), masterDataController.getEntityDependencies);
router.get('/entities/:entity', authorize({ anyPermissions: readPermissions }), masterDataController.listEntity);

module.exports = router;
