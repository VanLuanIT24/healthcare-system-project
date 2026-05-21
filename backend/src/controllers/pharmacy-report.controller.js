const pharmacyReportService = require('../services/pharmacy-report.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getDashboard: wrap(
    (req) => pharmacyReportService.getPharmacyDashboardReport(req.query, req.auth),
    'Lay dashboard bao cao duoc thanh cong.',
  ),
  getInventoryOverview: wrap(
    (req) => pharmacyReportService.getInventoryOverviewReport(req.query, req.auth),
    'Lay bao cao tong quan ton kho thanh cong.',
  ),
  getInventoryMovement: wrap(
    (req) => pharmacyReportService.getInventoryMovementReport(req.query, req.auth),
    'Lay bao cao nhap xuat ton thanh cong.',
  ),
  getDispensing: wrap(
    (req) => pharmacyReportService.getDispensingReport(req.query, req.auth),
    'Lay bao cao cap phat thuoc thanh cong.',
  ),
  getExpiringStock: wrap(
    (req) => pharmacyReportService.getExpiringStockReport(req.query, req.auth),
    'Lay bao cao thuoc sap het han thanh cong.',
  ),
  getExpiredRecalledBatches: wrap(
    (req) => pharmacyReportService.getExpiredRecalledBatchesReport(req.query, req.auth),
    'Lay bao cao lo het han/thu hoi thanh cong.',
  ),
  getLowStock: wrap(
    (req) => pharmacyReportService.getLowStockReport(req.query, req.auth),
    'Lay bao cao thuoc duoi ton toi thieu thanh cong.',
  ),
  getStockoutRisk: wrap(
    (req) => pharmacyReportService.getStockoutRiskReport(req.query, req.auth),
    'Lay bao cao nguy co het ton thanh cong.',
  ),
  getPrescriptions: wrap(
    (req) => pharmacyReportService.getPrescriptionPharmacyReport(req.query, req.auth),
    'Lay bao cao don thuoc duoc thanh cong.',
  ),
  getInventoryValuation: wrap(
    (req) => pharmacyReportService.getInventoryValuationReport(req.query, req.auth),
    'Lay bao cao gia tri ton kho thanh cong.',
  ),
  getHighUsageMedications: wrap(
    (req) => pharmacyReportService.getHighUsageMedicationReport(req.query, req.auth),
    'Lay bao cao thuoc dung nhieu thanh cong.',
  ),
  getTurnover: wrap(
    (req) => pharmacyReportService.getInventoryTurnoverReport(req.query, req.auth),
    'Lay bao cao vong quay ton kho thanh cong.',
  ),
  getWasteDisposal: wrap(
    (req) => pharmacyReportService.getWasteDisposalReport(req.query, req.auth),
    'Lay bao cao hao hut/huy thuoc thanh cong.',
  ),
  exportReport: wrap(
    (req) => pharmacyReportService.exportPharmacyReport(req.body && Object.keys(req.body).length ? req.body : req.query, req.auth, requestMeta(req)),
    'Export bao cao duoc thanh cong.',
  ),
  getExportHistory: wrap(
    (req) => pharmacyReportService.getExportHistory(req.query, req.auth),
    'Lay lich su export bao cao duoc thanh cong.',
  ),
};
