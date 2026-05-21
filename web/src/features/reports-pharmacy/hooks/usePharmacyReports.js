import { reportsPharmacyApi } from '../api/reportsPharmacyApi';
import { usePharmacyReport } from './usePharmacyFilters';

export const usePharmacyDashboardReport = () => usePharmacyReport(reportsPharmacyApi.dashboard, { auto_refresh: true });
export const useInventoryReport = () => usePharmacyReport(reportsPharmacyApi.inventory);
export const useInventoryMovementReport = () => usePharmacyReport(reportsPharmacyApi.movement);
export const useLowStockReport = () => usePharmacyReport(reportsPharmacyApi.lowStock, { auto_refresh: true });
export const useExpiringBatchesReport = () => usePharmacyReport(reportsPharmacyApi.expiringBatches, { auto_refresh: true });
export const useExpiredRecalledBatchesReport = () => usePharmacyReport(reportsPharmacyApi.expiredRecalledBatches, { auto_refresh: true });
export const useDispensingReport = () => usePharmacyReport(reportsPharmacyApi.dispensing);
export const usePrescriptionPharmacyReport = () => usePharmacyReport(reportsPharmacyApi.prescriptions);
export const useInventoryValueReport = () => usePharmacyReport(reportsPharmacyApi.inventoryValue);
export const useInventoryTurnoverReport = () => usePharmacyReport(reportsPharmacyApi.turnover);
