const express = require('express');
const pharmacyConfigController = require('../controllers/pharmacy-config.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('unitId', validateObjectIdParam);
router.param('dosageFormId', validateObjectIdParam);
router.param('routeId', validateObjectIdParam);
router.param('locationId', validateObjectIdParam);
router.param('supplierId', validateObjectIdParam);
router.param('alertRuleId', validateObjectIdParam);
router.param('expiryPolicyId', validateObjectIdParam);
router.param('controlledPolicyId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.PHARMACY_CONFIG?.READ,
  PERMISSION.PHARMACY_POLICY?.READ,
  PERMISSION.CONTROLLED_DRUG_POLICY?.READ,
  PERMISSION.CONTROLLED_DRUG_LEDGER?.READ,
  PERMISSION.MEDICATIONS.READ,
  PERMISSION.STOCK_BATCHES.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
].filter(Boolean);

const writePermissions = [
  PERMISSION.PHARMACY_CONFIG?.CREATE,
  PERMISSION.PHARMACY_CONFIG?.UPDATE,
  PERMISSION.PHARMACY_CONFIG?.MERGE,
  PERMISSION.PHARMACY_POLICY?.CREATE,
  PERMISSION.PHARMACY_POLICY?.UPDATE,
  PERMISSION.PHARMACY_POLICY?.ACTIVATE,
  PERMISSION.PHARMACY_POLICY?.DEACTIVATE,
  PERMISSION.PHARMACY_POLICY?.TEST,
  PERMISSION.CONTROLLED_DRUG_POLICY?.MANAGE,
  PERMISSION.CONTROLLED_DRUG_LEDGER?.CREATE,
  PERMISSION.MEDICATIONS.MANAGE,
  PERMISSION.MEDICATIONS.UPDATE,
  PERMISSION.STOCK_BATCHES.UPDATE,
].filter(Boolean);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/quality-dashboard', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.qualityDashboard);
router.get('/quality-check', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.qualityCheck);
router.post('/quality-check/run', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.runQualityCheck);

router.get('/units/quality-check', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.unitQuality);
router.post('/units/bulk-assign', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.bulkAssignUnits);
router.get('/units', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listUnits);
router.post('/units', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.createUnit);
router.get('/units/:unitId', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.getUnit);
router.patch('/units/:unitId', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.updateUnit);
router.post('/units/:unitId/deprecate', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.deprecateUnit);
router.post('/units/:unitId/merge', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.mergeUnit);
router.get('/units/:unitId/medications', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.unitMedications);

router.get('/dosage-forms/quality-check', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.dosageFormQuality);
router.get('/dosage-forms', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listDosageForms);
router.post('/dosage-forms', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.createDosageForm);
router.get('/dosage-forms/:dosageFormId', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.getDosageForm);
router.patch('/dosage-forms/:dosageFormId', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.updateDosageForm);
router.post('/dosage-forms/:dosageFormId/merge', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.mergeDosageForm);
router.get('/dosage-forms/:dosageFormId/medications', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.dosageFormMedications);
router.post('/dosage-forms/:dosageFormId/route-mapping', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.dosageFormRouteMapping);

router.get('/routes/quality-check', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.routeQuality);
router.post('/routes/compatibility-check', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.compatibilityCheck);
router.post('/routes/bulk-assign-medications', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.bulkAssignRoutes);
router.get('/routes', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listRoutes);
router.post('/routes', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.createRoute);
router.get('/routes/:routeId', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.getRoute);
router.patch('/routes/:routeId', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.updateRoute);
router.post('/routes/:routeId/merge', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.mergeRoute);
router.get('/routes/:routeId/medications', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.routeMedications);

router.post('/storage-locations/bulk-move-batches', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.bulkMoveBatches);
router.get('/storage-locations/quality-check', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.storageLocationQuality);
router.get('/storage-locations', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listStorageLocations);
router.post('/storage-locations', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.createStorageLocation);
router.get('/storage-locations/:locationId', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.getStorageLocation);
router.patch('/storage-locations/:locationId', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.updateStorageLocation);
router.post('/storage-locations/:locationId/lock', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.lockStorageLocation);
router.post('/storage-locations/:locationId/unlock', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.unlockStorageLocation);
router.get('/storage-locations/:locationId/batches', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.storageLocationBatches);
router.get('/storage-locations/:locationId/transactions', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.storageLocationTransactions);
router.post('/storage-locations/:locationId/print-qr', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.storageLocationQr);
router.post('/storage-locations/:locationId/start-count', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.startLocationCount);

router.get('/suppliers/quality-check', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.supplierQuality);
router.get('/suppliers', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listSuppliers);
router.post('/suppliers', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.createSupplier);
router.get('/suppliers/:supplierId', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.getSupplier);
router.patch('/suppliers/:supplierId', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.updateSupplier);
router.post('/suppliers/:supplierId/block', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.blockSupplier);
router.post('/suppliers/:supplierId/unblock', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.unblockSupplier);
router.post('/suppliers/:supplierId/merge', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.mergeSupplier);
router.get('/suppliers/:supplierId/batches', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.supplierBatches);
router.get('/suppliers/:supplierId/transactions', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.supplierTransactions);
router.get('/suppliers/:supplierId/risk-dashboard', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.supplierRiskDashboard);

router.get('/alert-rules/preview', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.previewAlertRules);
router.get('/alert-rules', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listAlertRules);
router.post('/alert-rules', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.createAlertRule);
router.get('/alert-rules/:alertRuleId', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.getAlertRule);
router.patch('/alert-rules/:alertRuleId', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.updateAlertRule);
router.post('/alert-rules/:alertRuleId/test', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.testAlertRule);
router.post('/alert-rules/:alertRuleId/activate', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.activateAlertRule);
router.post('/alert-rules/:alertRuleId/deactivate', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.deactivateAlertRule);

router.get('/expiry-policies', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listExpiryPolicies);
router.post('/expiry-policies', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.createExpiryPolicy);
router.get('/expiry-policies/:expiryPolicyId', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.getExpiryPolicy);
router.patch('/expiry-policies/:expiryPolicyId', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.updateExpiryPolicy);
router.post('/expiry-policies/:expiryPolicyId/test', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.testExpiryPolicy);
router.post('/expiry-policies/:expiryPolicyId/activate', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.activateExpiryPolicy);
router.post('/expiry-policies/:expiryPolicyId/deactivate', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.deactivateExpiryPolicy);
router.get('/fefo-simulator', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.fefoSimulator);
router.get('/expiry-quality-check', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.expiryQualityCheck);
router.post('/batches/mark-expired-bulk', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.markExpiredBulk);

router.get('/controlled-drug-policies', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listControlledPolicies);
router.post('/controlled-drug-policies', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.createControlledPolicy);
router.get('/controlled-drug-policies/:controlledPolicyId', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.getControlledPolicy);
router.patch('/controlled-drug-policies/:controlledPolicyId', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.updateControlledPolicy);
router.post('/controlled-drug-policies/:controlledPolicyId/apply-medications', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.applyControlledPolicy);
router.get('/controlled-drug-ledger', authorize({ anyPermissions: readPermissions }), pharmacyConfigController.listControlledLedger);
router.post('/controlled-drug-ledger/shift-count', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.shiftCountControlledLedger);
router.post('/controlled-drug-ledger/waste-approval', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.wasteApprovalControlledLedger);
router.post('/controlled-drug-ledger/double-check', authorize({ anyPermissions: writePermissions }), pharmacyConfigController.doubleCheckControlledLedger);

module.exports = router;
