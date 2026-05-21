import { reportsInpatientEmergencyApi } from '../api/reportsInpatientEmergencyApi';
import { useInpatientEmergencyReport } from './useInpatientEmergencyFilters';

export const useAdmissionReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.admissions, { auto_refresh: true });
export const useDischargeReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.discharges);
export const useBedOccupancyReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.bedOccupancy, { auto_refresh: true });
export const useBedTurnoverReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.bedTurnover);
export const useLengthOfStayReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.lengthOfStay);
export const useInpatientTaskReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.inpatientTasks, { auto_refresh: true });
export const useEmergencyCaseReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.emergencyCases, { auto_refresh: true });
export const useEmergencyResponseTimeReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.responseTime, { auto_refresh: true });
export const useCaseResolutionReport = () => useInpatientEmergencyReport(reportsInpatientEmergencyApi.caseResolution);
