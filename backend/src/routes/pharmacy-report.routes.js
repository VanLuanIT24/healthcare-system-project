const express = require('express');
const pharmacyReportController = require('../controllers/pharmacy-report.controller');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

const baseReadPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.INVENTORY_READ,
  PERMISSION.STOCK_BATCHES.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
  PERMISSION.DISPENSES.READ,
];

function readGuard(...permissions) {
  return authorize({
    anyPermissions: [
      ...baseReadPermissions,
      ...permissions.filter(Boolean),
    ],
  });
}

router.get('/dashboard', readGuard(PERMISSION.PHARMACY_REPORTS?.DASHBOARD_READ), pharmacyReportController.getDashboard);
router.get('/inventory-overview', readGuard(PERMISSION.PHARMACY_REPORTS?.INVENTORY_OVERVIEW_READ), pharmacyReportController.getInventoryOverview);
router.get('/inventory-movement', readGuard(PERMISSION.PHARMACY_REPORTS?.INVENTORY_MOVEMENT_READ), pharmacyReportController.getInventoryMovement);
router.get('/stock-card', readGuard(PERMISSION.PHARMACY_REPORTS?.INVENTORY_MOVEMENT_READ), pharmacyReportController.getInventoryMovement);
router.get('/dispensing', readGuard(PERMISSION.PHARMACY_REPORTS?.DISPENSING_READ), pharmacyReportController.getDispensing);
router.get('/expiring-stock', readGuard(PERMISSION.PHARMACY_REPORTS?.EXPIRING_STOCK_READ, PERMISSION.REPORTS.EXPIRING_STOCK_READ), pharmacyReportController.getExpiringStock);
router.get('/expired-recalled-batches', readGuard(PERMISSION.PHARMACY_REPORTS?.EXPIRING_STOCK_READ, PERMISSION.PHARMACY_REPORTS?.WASTE_DISPOSAL_READ), pharmacyReportController.getExpiredRecalledBatches);
router.get('/low-stock', readGuard(PERMISSION.PHARMACY_REPORTS?.LOW_STOCK_READ, PERMISSION.REPORTS.LOW_STOCK_READ), pharmacyReportController.getLowStock);
router.get('/reorder-suggestions', readGuard(PERMISSION.PHARMACY_REPORTS?.LOW_STOCK_READ, PERMISSION.REPORTS.LOW_STOCK_READ), pharmacyReportController.getLowStock);
router.get('/stockout-risk', readGuard(PERMISSION.PHARMACY_REPORTS?.LOW_STOCK_READ, PERMISSION.REPORTS.LOW_STOCK_READ), pharmacyReportController.getStockoutRisk);
router.get('/prescriptions', readGuard(PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT), pharmacyReportController.getPrescriptions);
router.get('/inventory-valuation', readGuard(PERMISSION.PHARMACY_REPORTS?.INVENTORY_VALUATION_READ), pharmacyReportController.getInventoryValuation);
router.get('/high-usage-medications', readGuard(PERMISSION.PHARMACY_REPORTS?.HIGH_USAGE_READ), pharmacyReportController.getHighUsageMedications);
router.get('/turnover', readGuard(PERMISSION.PHARMACY_REPORTS?.HIGH_USAGE_READ, PERMISSION.PHARMACY_REPORTS?.INVENTORY_VALUATION_READ), pharmacyReportController.getTurnover);
router.get('/waste-disposal', readGuard(PERMISSION.PHARMACY_REPORTS?.WASTE_DISPOSAL_READ), pharmacyReportController.getWasteDisposal);
router.post('/export', readGuard(PERMISSION.PHARMACY_REPORTS?.EXPORT, PERMISSION.REPORTS.EXPORT), pharmacyReportController.exportReport);
router.get('/export-history', readGuard(PERMISSION.PHARMACY_REPORTS?.EXPORT, PERMISSION.REPORTS.EXPORT), pharmacyReportController.getExportHistory);

module.exports = router;
