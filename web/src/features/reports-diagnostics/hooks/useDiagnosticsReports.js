import { reportsDiagnosticsApi } from '../api/reportsDiagnosticsApi';
import { useDiagnosticsReport } from './useDiagnosticsFilters';

export const useDiagnosticsOverviewReport = () => useDiagnosticsReport(reportsDiagnosticsApi.overview, { auto_refresh: true });
export const useLabOrdersReport = () => useDiagnosticsReport(reportsDiagnosticsApi.labOrders);
export const useLabTurnaroundTimeReport = () => useDiagnosticsReport(reportsDiagnosticsApi.labTurnaroundTime, { range: '7d' });
export const useSpecimenReport = () => useDiagnosticsReport(reportsDiagnosticsApi.specimens);
export const useImagingOrdersReport = () => useDiagnosticsReport(reportsDiagnosticsApi.imagingOrders);
export const useImagingTurnaroundTimeReport = () => useDiagnosticsReport(reportsDiagnosticsApi.imagingTurnaroundTime, { range: '7d' });
export const useReportPendingReport = () => useDiagnosticsReport(reportsDiagnosticsApi.reportPending, { auto_refresh: true });
export const useCriticalResultsReport = () => useDiagnosticsReport(reportsDiagnosticsApi.criticalResults, { auto_refresh: true });
export const useProcedureOrdersReport = () => useDiagnosticsReport(reportsDiagnosticsApi.procedureOrders);
export const useOverdueOrdersReport = () => useDiagnosticsReport(reportsDiagnosticsApi.overdueOrders, { auto_refresh: true });
