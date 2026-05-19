import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PharmacyShell } from './PharmacyShell';
import {
  flattenPharmacyMenu,
  getPharmacyPageMeta,
} from './pharmacyData';
import {
  PharmacyAlertsPage,
  PharmacyDashboardPage,
  PharmacyDispensingTodayPage,
  PharmacyPerformancePage,
  PharmacyWorkItemsPage,
} from './PharmacyCommandCenter';
import { PharmacyDispensingCommandCenterPage } from './PharmacyDispensingCommandCenter';
import { PharmacyInpatientMedicationPage } from './PharmacyInpatientMedicationCenter';
import {
  CurrentStockPage,
  MedicationCatalogPage,
  StockBatchPage,
  StocktakePage,
} from './PharmacyInventoryCommandCenter';
import { PrescriptionCommandCenterPage } from './PharmacyPrescriptionCommandCenter';
import { PharmacyReportsCommandCenterPage } from './PharmacyReportsCommandCenter';
import { PharmacyTransactionsCommandPage } from './PharmacyTransactionsCommandCenter';
import { PharmacyAlertsCommandCenterPage } from './PharmacyAlertsCommandCenter';
import { PharmacyConfigPage } from './PharmacyConfigCenter';
import './pharmacy.css';

const pharmacyRoutes = flattenPharmacyMenu().map((item) => ({
  ...item,
  routePath: item.to.replace('/pharmacy/', ''),
}));

function PharmacyTitleScreen({ item }) {
  const Icon = item.icon;
  const groupLabel = item.groupLabel || 'Nhà thuốc và kho dược';

  return (
    <section className="pharmacy-title-screen" aria-labelledby="pharmacy-page-title">
      <div className="pharmacy-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.25} />
      </div>
      <div>
        <span>{groupLabel}</span>
        <h1 id="pharmacy-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function PharmacyFallbackScreen() {
  const location = useLocation();
  const item = getPharmacyPageMeta(location.pathname);
  return <PharmacyTitleScreen item={item} />;
}

export default function PharmacyWorkspace() {
  return (
    <PharmacyShell>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="dashboard" element={<Navigate to="/pharmacy/overview" replace />} />
        <Route path="overview" element={<PharmacyDashboardPage />} />
        <Route path="overview/dashboard" element={<PharmacyDashboardPage />} />
        <Route path="overview/action-items" element={<PharmacyWorkItemsPage />} />
        <Route path="overview/work-items" element={<PharmacyWorkItemsPage />} />
        <Route path="overview/today-dispensing" element={<PharmacyDispensingTodayPage />} />
        <Route path="overview/dispensing-today" element={<PharmacyDispensingTodayPage />} />
        <Route path="overview/alerts" element={<PharmacyAlertsPage />} />
        <Route path="overview/performance" element={<PharmacyPerformancePage />} />
        <Route path="prescriptions/pharmacy-approval" element={<PrescriptionCommandCenterPage group="pending_verification" />} />
        <Route path="prescriptions/review-needed" element={<PrescriptionCommandCenterPage group="need_review" />} />
        <Route path="prescriptions/pending-dispense" element={<PrescriptionCommandCenterPage group="waiting_dispense" />} />
        <Route path="prescriptions/partial-dispense" element={<PrescriptionCommandCenterPage group="partially_dispensed" />} />
        <Route path="prescriptions/dispensed" element={<PrescriptionCommandCenterPage group="dispensed" />} />
        <Route path="prescriptions/cancelled" element={<PrescriptionCommandCenterPage group="cancelled" />} />
        <Route path="prescriptions/refill-requests" element={<PrescriptionCommandCenterPage group="refill" />} />
        <Route path="prescriptions/history" element={<PrescriptionCommandCenterPage group="history" />} />
        <Route path="dispensing/queue" element={<PharmacyDispensingCommandCenterPage view="queue" />} />
        <Route path="dispensing/preparing-slips" element={<PharmacyDispensingCommandCenterPage view="preparing" />} />
        <Route path="dispensing/pending-completion" element={<PharmacyDispensingCommandCenterPage view="pendingCompletion" />} />
        <Route path="dispensing/completed" element={<PharmacyDispensingCommandCenterPage view="completed" />} />
        <Route path="dispensing/held-rejected" element={<PharmacyDispensingCommandCenterPage view="heldRejected" />} />
        <Route path="dispensing/returns" element={<PharmacyDispensingCommandCenterPage view="returns" />} />
        <Route path="dispensing/labels-instructions" element={<PharmacyDispensingCommandCenterPage view="labels" />} />
        <Route path="inventory/medication-catalog" element={<MedicationCatalogPage />} />
        <Route path="inventory/current-stock" element={<CurrentStockPage />} />
        <Route path="inventory/batches" element={<StockBatchPage view="all" />} />
        <Route path="inventory/valid-batches" element={<StockBatchPage view="valid" />} />
        <Route path="inventory/expiring-batches" element={<StockBatchPage view="nearExpiry" />} />
        <Route path="inventory/expired-batches" element={<StockBatchPage view="expired" />} />
        <Route path="inventory/empty-batches" element={<StockBatchPage view="depleted" />} />
        <Route path="inventory/quarantine-recall" element={<StockBatchPage view="quarantine" />} />
        <Route path="inventory/stock-count" element={<StocktakePage />} />
        <Route path="transactions/center" element={<PharmacyTransactionsCommandPage mode="center" />} />
        <Route path="transactions/receive-stock" element={<PharmacyTransactionsCommandPage mode="receipts" />} />
        <Route path="transactions/internal-issue" element={<PharmacyTransactionsCommandPage mode="issues" />} />
        <Route path="transactions/stock-transfer" element={<PharmacyTransactionsCommandPage mode="transfers" />} />
        <Route path="transactions/stock-adjustment" element={<PharmacyTransactionsCommandPage mode="adjustments" />} />
        <Route path="transactions/loss-waste" element={<PharmacyTransactionsCommandPage mode="waste" />} />
        <Route path="transactions/return-to-stock" element={<PharmacyTransactionsCommandPage mode="returns" />} />
        <Route path="transactions/history" element={<PharmacyTransactionsCommandPage mode="history" />} />
        <Route path="alerts/low-stock" element={<PharmacyAlertsCommandCenterPage board="low-stock" />} />
        <Route path="alerts/out-of-stock" element={<PharmacyAlertsCommandCenterPage board="out-of-stock" />} />
        <Route path="alerts/expiring-batches" element={<PharmacyAlertsCommandCenterPage board="expiring-batches" />} />
        <Route path="alerts/expired-batches" element={<PharmacyAlertsCommandCenterPage board="expired-batches" />} />
        <Route path="alerts/dispense-shortage" element={<PharmacyAlertsCommandCenterPage board="dispense-shortage" />} />
        <Route path="alerts/insufficient-stock" element={<Navigate to="/pharmacy/alerts/dispense-shortage" replace />} />
        <Route path="alerts/allergy" element={<PharmacyAlertsCommandCenterPage board="allergy" />} />
        <Route path="alerts/high-usage" element={<PharmacyAlertsCommandCenterPage board="high-usage" />} />
        <Route path="alerts/waste-loss" element={<PharmacyAlertsCommandCenterPage board="waste-loss" />} />
        <Route path="alerts/loss-waste" element={<Navigate to="/pharmacy/alerts/waste-loss" replace />} />
        <Route path="reports/dashboard" element={<PharmacyReportsCommandCenterPage view="dashboard" />} />
        <Route path="reports/inventory-overview" element={<PharmacyReportsCommandCenterPage view="inventoryOverview" />} />
        <Route path="reports/stock-movement" element={<PharmacyReportsCommandCenterPage view="stockMovement" />} />
        <Route path="reports/dispensed-medications" element={<PharmacyReportsCommandCenterPage view="dispensing" />} />
        <Route path="reports/expiring-medications" element={<PharmacyReportsCommandCenterPage view="expiringStock" />} />
        <Route path="reports/below-minimum-stock" element={<PharmacyReportsCommandCenterPage view="lowStock" />} />
        <Route path="reports/stock-value" element={<PharmacyReportsCommandCenterPage view="inventoryValuation" />} />
        <Route path="reports/high-usage" element={<PharmacyReportsCommandCenterPage view="highUsage" />} />
        <Route path="reports/loss-waste" element={<PharmacyReportsCommandCenterPage view="wasteDisposal" />} />
        <Route path="reports/export-history" element={<PharmacyReportsCommandCenterPage view="exportHistory" />} />
        <Route path="config" element={<PharmacyConfigPage view="overview" />} />
        <Route path="config/units" element={<PharmacyConfigPage view="units" />} />
        <Route path="config/dosage-forms" element={<PharmacyConfigPage view="dosageForms" />} />
        <Route path="config/routes" element={<PharmacyConfigPage view="routes" />} />
        <Route path="config/storage-locations" element={<PharmacyConfigPage view="storageLocations" />} />
        <Route path="config/suppliers" element={<PharmacyConfigPage view="suppliers" />} />
        <Route path="config/alert-thresholds" element={<PharmacyConfigPage view="alertThresholds" />} />
        <Route path="config/expiry-policies" element={<PharmacyConfigPage view="expiryPolicies" />} />
        <Route path="config/controlled-drugs" element={<PharmacyConfigPage view="controlledDrugs" />} />
        <Route path="settings/medication-units" element={<PharmacyConfigPage view="units" />} />
        <Route path="settings/dosage-forms" element={<PharmacyConfigPage view="dosageForms" />} />
        <Route path="settings/routes-of-administration" element={<PharmacyConfigPage view="routes" />} />
        <Route path="settings/storage-locations" element={<PharmacyConfigPage view="storageLocations" />} />
        <Route path="settings/suppliers" element={<PharmacyConfigPage view="suppliers" />} />
        <Route path="settings/alert-thresholds" element={<PharmacyConfigPage view="alertThresholds" />} />
        <Route path="settings/expiry-policy" element={<PharmacyConfigPage view="expiryPolicies" />} />
        <Route path="settings/controlled-medication-policy" element={<PharmacyConfigPage view="controlledDrugs" />} />
        <Route path="inpatient-medication/schedule" element={<PharmacyInpatientMedicationPage view="schedule" />} />
        <Route path="inpatient-medication/today-medications" element={<PharmacyInpatientMedicationPage view="today" />} />
        <Route path="inpatient-medication/confirm" element={<PharmacyInpatientMedicationPage view="confirm" />} />
        <Route path="inpatient-medication/defer-refuse-missed" element={<PharmacyInpatientMedicationPage view="exceptions" />} />
        <Route path="inpatient-medication/abnormal-events" element={<PharmacyInpatientMedicationPage view="reactions" />} />
        {pharmacyRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<PharmacyTitleScreen item={item} />}
          />
        ))}
        <Route path="*" element={<PharmacyFallbackScreen />} />
      </Routes>
    </PharmacyShell>
  );
}
