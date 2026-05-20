const express = require('express');
const pharmacyInventoryController = require('../controllers/pharmacy-inventory.controller');
const pharmacyInpatientMedicationController = require('../controllers/pharmacy-inpatient-medication.controller');
const pharmacyOverviewController = require('../controllers/pharmacy-overview.controller');
const pharmacyDispensingController = require('../controllers/pharmacy-dispensing.controller');
const pharmacyAlertController = require('../controllers/pharmacy-alert.controller');
const prescriptionController = require('../controllers/prescription.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('alertId', validateObjectIdParam);
router.param('workItemId', validateObjectIdParam);
router.param('prescriptionId', validateObjectIdParam);
router.param('dispenseId', validateObjectIdParam);
router.param('holdId', validateObjectIdParam);
router.param('returnId', validateObjectIdParam);
router.param('stocktakeId', validateObjectIdParam);
router.param('stocktakeItemId', validateObjectIdParam);
router.param('medicationId', validateObjectIdParam);
router.param('batchId', validateObjectIdParam);
router.param('transactionId', validateObjectIdParam);
router.param('receiptId', validateObjectIdParam);
router.param('issueId', validateObjectIdParam);
router.param('transferId', validateObjectIdParam);
router.param('disposalId', validateObjectIdParam);
router.param('returnId', validateObjectIdParam);
router.param('reactionId', validateObjectIdParam);

const pharmacyReadPermissions = [
  PERMISSION.MEDICATIONS.READ,
  PERMISSION.PRESCRIPTIONS.READ,
  PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT,
  PERMISSION.DISPENSES.READ,
  PERMISSION.STOCK_BATCHES.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
  PERMISSION.REPORTS.INVENTORY_READ,
  PERMISSION.REPORTS.LOW_STOCK_READ,
  PERMISSION.REPORTS.EXPIRING_STOCK_READ,
  PERMISSION.MEDICATION_ADMINISTRATIONS.READ,
  PERMISSION.WARD_BOARD.READ,
  PERMISSION.ADMISSIONS.READ_DEPARTMENT,
];

const pharmacyOperatePermissions = [
  PERMISSION.PRESCRIPTIONS.VERIFY,
  PERMISSION.DISPENSES.CREATE,
  PERMISSION.DISPENSES.COMPLETE,
  PERMISSION.STOCK_BATCHES.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/topbar/bootstrap', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getTopbarBootstrap);
router.get('/search', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.searchWorkspace);
router.get('/dispense-queue/summary', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.getQueueSummary);
router.get('/dispense-queue', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.getQueue);
router.get('/alert-summary', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getAlertSummary);

router.get('/prescription-workbench', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getPrescriptionWorkbench);
router.get('/prescription-risk-queue', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getPrescriptionRiskQueue);

router.get('/overview/dashboard', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getDashboard);
router.get('/overview/work-queue', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getWorkQueue);
router.get('/overview/dispensing-today', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getDispensingToday);
router.get('/overview/alerts', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getAlertsOverview);
router.get('/overview/performance', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getPerformance);

router.get('/medications', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listMedications);
router.get('/medications/search', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.searchMedications);
router.get('/medications/summary', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getMedicationSummary);
router.get('/medications/:medicationId/stock-selection', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.stockSelection);
router.get('/medications/:medicationId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getMedicationDetail);

router.get('/warehouses', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listWarehouses);
router.get('/storage-locations', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listStorageLocations);

router.get('/stock-batches', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listStockBatches);
router.get('/stock-batches/:batchId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getStockBatchDetail);
router.post('/stock-batches/:batchId/adjustment', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT] }), pharmacyInventoryController.adjustStockBatch);
router.post('/stock-batches/:batchId/quarantine', authorize({ permissions: [PERMISSION.STOCK_BATCHES.QUARANTINE] }), pharmacyInventoryController.quarantineStockBatch);
router.post('/stock-batches/:batchId/release-quarantine', authorize({ permissions: [PERMISSION.STOCK_BATCHES.QUARANTINE] }), pharmacyInventoryController.releaseQuarantineStockBatch);
router.post('/stock-batches/:batchId/waste', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_DISPOSAL] }), pharmacyInventoryController.wasteStockBatch);
router.post('/stock-batches/:batchId/transfer-location', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_OUT] }), pharmacyInventoryController.transferStockBatchLocation);
router.get('/stock-batches/:batchId/recall-impact', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.stockBatchRecallImpact);
router.post('/stock-batches/:batchId/expire', authorize({ permissions: [PERMISSION.STOCK_BATCHES.MARK_EXPIRED] }), pharmacyInventoryController.expireStockBatch);
router.post('/stock-batches/:batchId/recall', authorize({ permissions: [PERMISSION.STOCK_BATCHES.RECALL] }), pharmacyInventoryController.recallStockBatch);

router.get('/inventory/center', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getInventoryCenter);
router.get('/inventory/current-stock', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getCurrentStock);
router.get('/inventory/transactions', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listTransactions);
router.get('/inventory/transactions/:transactionId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getTransactionDetail);
router.post('/inventory/adjustments', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT] }), pharmacyInventoryController.adjustStockBatch);
router.get('/inventory/receipts', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listReceipts);
router.post('/inventory/receipts', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RECEIPT] }), pharmacyInventoryController.createReceipt);
router.get('/inventory/receipts/:receiptId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getReceiptDetail);
router.post('/inventory/receipts/:receiptId/post', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RECEIPT] }), pharmacyInventoryController.postReceipt);
router.get('/inventory/issues', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listIssues);
router.post('/inventory/issues', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ISSUE] }), pharmacyInventoryController.createIssue);
router.get('/inventory/issues/:issueId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getIssueDetail);
router.post('/inventory/issues/:issueId/dispatch', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ISSUE] }), pharmacyInventoryController.dispatchIssue);
router.get('/inventory/transfers', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listTransfers);
router.post('/inventory/transfers', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_OUT] }), pharmacyInventoryController.createTransfer);
router.get('/inventory/transfers/:transferId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getTransferDetail);
router.post('/inventory/transfers/:transferId/dispatch', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_OUT] }), pharmacyInventoryController.dispatchTransfer);
router.get('/inventory/disposals', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listDisposals);
router.post('/inventory/disposals', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_DISPOSAL] }), pharmacyInventoryController.createDisposal);
router.get('/inventory/disposals/:disposalId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getDisposalDetail);
router.post('/inventory/disposals/:disposalId/post', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_DISPOSAL] }), pharmacyInventoryController.postDisposal);
router.get('/inventory/returns', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.listReturns);
router.post('/inventory/returns', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RETURN_IN] }), pharmacyInventoryController.createReturn);
router.get('/inventory/returns/:returnId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInventoryController.getReturnDetail);
router.post('/inventory/returns/:returnId/post', authorize({ permissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RETURN_IN] }), pharmacyInventoryController.postReturn);
router.get('/expiry-risk', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getExpiryRisk);

router.get('/inpatient-medications/schedule-board', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInpatientMedicationController.getScheduleBoard);
router.get('/inpatient-medications/today-command-center', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInpatientMedicationController.getTodayCommandCenter);
router.get('/inpatient-medications/confirm-workbench', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInpatientMedicationController.getConfirmWorkbench);
router.get('/inpatient-medications/exceptions', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInpatientMedicationController.getExceptionCenter);
router.get('/inpatient-medications/reactions', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInpatientMedicationController.listReactions);
router.get('/inpatient-medications/reactions/:reactionId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyInpatientMedicationController.getReactionDetail);
router.post('/inpatient-medications/reactions/:reactionId/pharmacist-review', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyInpatientMedicationController.pharmacistReviewReaction);
router.post('/inpatient-medications/reactions/:reactionId/resolve', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyInpatientMedicationController.resolveReaction);
router.post('/inpatient-medications/interventions', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyInpatientMedicationController.createIntervention);

router.get('/stocktakes', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.listStocktakes);
router.post('/stocktakes', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT, PERMISSION.INVENTORY_TRANSACTIONS.READ] }), pharmacyOverviewController.createStocktake);
router.get('/stocktakes/:stocktakeId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getStocktakeDetail);
router.post('/stocktakes/:stocktakeId/start', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT, PERMISSION.INVENTORY_TRANSACTIONS.READ] }), pharmacyOverviewController.startStocktake);
router.post('/stocktakes/:stocktakeId/items/generate', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT, PERMISSION.INVENTORY_TRANSACTIONS.READ] }), pharmacyOverviewController.generateStocktakeItems);
router.patch('/stocktakes/:stocktakeId/items/:stocktakeItemId/count', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT, PERMISSION.INVENTORY_TRANSACTIONS.READ] }), pharmacyOverviewController.countStocktakeItem);
router.post('/stocktakes/:stocktakeId/review', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT, PERMISSION.INVENTORY_TRANSACTIONS.READ] }), pharmacyOverviewController.reviewStocktake);
router.post('/stocktakes/:stocktakeId/post-adjustments', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT] }), pharmacyOverviewController.postStocktakeAdjustments);
router.post('/stocktakes/:stocktakeId/cancel', authorize({ anyPermissions: [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT, PERMISSION.INVENTORY_TRANSACTIONS.READ] }), pharmacyOverviewController.cancelStocktake);

router.get('/dispensing/queue', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.getQueue);
router.get('/dispensing/queue-summary', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.getQueueSummary);
router.get('/dispensing/analytics', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.getAnalytics);
router.post('/prescriptions/:prescriptionId/verify', authorize({ permissions: [PERMISSION.PRESCRIPTIONS.VERIFY] }), prescriptionController.verifyPrescription);
router.post('/prescriptions/:prescriptionId/claim', authorize({ anyPermissions: [PERMISSION.DISPENSES.CREATE, PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/pharmacy/prescriptions/:prescriptionId/claim' }), pharmacyOverviewController.claimPrescriptionForDispense);
router.post('/prescriptions/:prescriptionId/dispenses', authorize({ permissions: [PERMISSION.DISPENSES.CREATE] }), idempotencyRequired({ route: '/api/pharmacy/prescriptions/:prescriptionId/dispenses' }), prescriptionController.createDispense);
router.get('/dispenses/:dispenseId', authorize({ anyPermissions: pharmacyReadPermissions }), prescriptionController.getDispenseDetail);
router.get('/dispenses/:dispenseId/timeline', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.getTimeline);
router.post('/dispenses/:dispenseId/preview-completion-plan', authorize({ anyPermissions: [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.COMPLETE] }), prescriptionController.previewDispenseCompletionPlan);
router.post('/dispenses/:dispenseId/assign', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.CREATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.assignDispense);
router.post('/dispenses/:dispenseId/start-preparation', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.startPreparation);
router.post('/dispenses/:dispenseId/change-stage', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.changeStage);
router.post('/dispenses/:dispenseId/lock', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.lockDispense);
router.post('/dispenses/:dispenseId/unlock', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.unlockDispense);
router.get('/dispenses/:dispenseId/checklist', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), pharmacyDispensingController.getChecklist);
router.patch('/dispenses/:dispenseId/checklist/:code', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.updateChecklistItem);
router.post('/dispenses/:dispenseId/checklist/complete', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.completeChecklist);
router.post('/dispenses/:dispenseId/holds', authorize({ anyPermissions: [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.CANCEL, PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/pharmacy/dispenses/:dispenseId/holds' }), pharmacyDispensingController.createHold);
router.post('/dispenses/:dispenseId/return-preview', authorize({ anyPermissions: [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.RETURN] }), pharmacyDispensingController.previewReturn);
router.post('/dispenses/:dispenseId/returns', authorize({ permissions: [PERMISSION.DISPENSES.RETURN] }), idempotencyRequired({ route: '/api/pharmacy/dispenses/:dispenseId/returns' }), pharmacyDispensingController.createReturn);
router.get('/dispenses/:dispenseId/label-preview', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), pharmacyDispensingController.labelPreview);
router.post('/dispenses/:dispenseId/print-labels', authorize({ anyPermissions: [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/pharmacy/dispenses/:dispenseId/print-labels' }), pharmacyDispensingController.printLabels);
router.post('/dispenses/:dispenseId/print-instructions', authorize({ anyPermissions: [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/pharmacy/dispenses/:dispenseId/print-instructions' }), pharmacyDispensingController.printInstructions);
router.get('/dispenses/:dispenseId/print-jobs', authorize({ permissions: [PERMISSION.DISPENSES.READ] }), pharmacyDispensingController.getDispensePrintJobs);
router.post('/dispenses/:dispenseId/complete', authorize({ permissions: [PERMISSION.DISPENSES.COMPLETE] }), idempotencyRequired({ route: '/api/pharmacy/dispenses/:dispenseId/complete' }), prescriptionController.completeDispense);
router.post('/dispenses/:dispenseId/cancel', authorize({ permissions: [PERMISSION.DISPENSES.CANCEL] }), prescriptionController.cancelDispense);

router.get('/dispense-holds', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.listHolds);
router.get('/dispense-holds/:holdId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.getHoldDetail);
router.post('/dispense-holds/:holdId/resolve', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyDispensingController.resolveHold);
router.post('/dispense-holds/:holdId/reject', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyDispensingController.rejectHold);
router.post('/dispense-holds/:holdId/cancel', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyDispensingController.cancelHold);

router.get('/dispense-returns', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.listReturns);
router.get('/dispense-returns/:returnId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.getReturnDetail);
router.post('/dispense-returns/:returnId/approve', authorize({ anyPermissions: [PERMISSION.DISPENSES.RETURN, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.approveReturn);
router.post('/dispense-returns/:returnId/complete', authorize({ anyPermissions: [PERMISSION.DISPENSES.RETURN, PERMISSION.DISPENSES.COMPLETE] }), pharmacyDispensingController.completeReturn);
router.post('/dispense-returns/:returnId/cancel', authorize({ anyPermissions: [PERMISSION.DISPENSES.RETURN, PERMISSION.DISPENSES.CANCEL] }), pharmacyDispensingController.cancelReturn);

router.get('/print-jobs', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyDispensingController.listPrintJobs);

router.get('/alerts/summary', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.summary);
router.get('/alerts/low-stock', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.lowStock);
router.get('/alerts/out-of-stock', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.outOfStock);
router.get('/alerts/expiring-batches', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.expiringBatches);
router.get('/alerts/expired-batches', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.expiredBatches);
router.get('/alerts/dispense-shortage', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.dispenseShortage);
router.get('/alerts/insufficient-stock', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.dispenseShortage);
router.get('/alerts/allergy', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.allergy);
router.get('/alerts/high-usage', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.highUsage);
router.get('/alerts/waste-loss', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.wasteLoss);
router.get('/alerts/loss-waste', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.wasteLoss);
router.get('/alerts', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.list);
router.post('/alerts', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyOverviewController.createAlert);
router.post('/alerts/bulk-action', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyAlertController.bulkAction);
router.get('/alerts/:alertId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyAlertController.detail);
router.post('/alerts/:alertId/acknowledge', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyAlertController.acknowledge);
router.post('/alerts/:alertId/assign', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyAlertController.assign);
router.post('/alerts/:alertId/start', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyAlertController.start);
router.post('/alerts/:alertId/snooze', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyAlertController.snooze);
router.post('/alerts/:alertId/resolve', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyAlertController.resolve);
router.post('/alerts/:alertId/dismiss', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyAlertController.dismiss);
router.post('/alerts/:alertId/escalate', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyAlertController.escalate);

router.get('/work-items', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.listWorkItems);
router.post('/work-items', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyOverviewController.createWorkItem);
router.get('/work-items/:workItemId', authorize({ anyPermissions: pharmacyReadPermissions }), pharmacyOverviewController.getWorkItemDetail);
router.post('/work-items/:workItemId/assign', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyOverviewController.assignWorkItem);
router.post('/work-items/:workItemId/start', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyOverviewController.startWorkItem);
router.post('/work-items/:workItemId/hold', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyOverviewController.holdWorkItem);
router.post('/work-items/:workItemId/escalate', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyOverviewController.escalateWorkItem);
router.post('/work-items/:workItemId/resolve', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyOverviewController.resolveWorkItem);
router.post('/work-items/:workItemId/cancel', authorize({ anyPermissions: pharmacyOperatePermissions }), pharmacyOverviewController.cancelWorkItem);

module.exports = router;
