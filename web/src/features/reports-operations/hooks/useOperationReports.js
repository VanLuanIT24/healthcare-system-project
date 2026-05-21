import { reportsOperationsApi } from '../api/reportsOperationsApi';
import { useOperationReport } from './useOperationFilters';

export const useEncounterReport = () => useOperationReport(reportsOperationsApi.encounters, { range: 'week' });
export const useAppointmentReport = () => useOperationReport(reportsOperationsApi.appointments, { range: 'week' });
export const useCheckInReport = () => useOperationReport(reportsOperationsApi.checkIn, { range: 'today' }, { autoRefreshMs: 60000 });
export const useQueueReport = () => useOperationReport(reportsOperationsApi.queue, { range: 'today' }, { autoRefreshMs: 45000 });
export const useNoShowReport = () => useOperationReport(reportsOperationsApi.noShow, { range: 'week' });
export const useWaitTimeReport = () => useOperationReport(reportsOperationsApi.waitTime, { range: 'today' }, { autoRefreshMs: 60000 });
export const useDepartmentLoadReport = () => useOperationReport(reportsOperationsApi.departmentLoad, { range: 'week' });
export const useSlotEfficiencyReport = () => useOperationReport(reportsOperationsApi.slotEfficiency, { range: 'week' });
export const usePatientFlowReport = () => useOperationReport(reportsOperationsApi.patientFlow, { range: 'today' }, { autoRefreshMs: 60000 });
