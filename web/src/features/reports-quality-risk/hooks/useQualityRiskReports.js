import { useCallback } from 'react';
import { reportsQualityRiskApi } from '../api/reportsQualityRiskApi';
import { useQualityRiskReport } from './useQualityRiskFilters';

export const useQualityRiskDashboard = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.dashboard(filters), []), { auto_refresh: true });
export const useCriticalAlertsReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.criticalAlerts(filters), []), { auto_refresh: true });
export const useBreakGlassReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.breakGlass(filters), []));
export const useSensitiveAccessReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.sensitiveAccess(filters), []));
export const useSecurityAuditReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.securityAudit(filters), []));
export const useSupportTicketsReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.supportTickets(filters), []));
export const useComplaintsRatingsReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.complaintsRatings(filters), []));
export const useSlaReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.sla(filters), []), { auto_refresh: true });
export const useJobFailureReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.jobFailure(filters), []), { auto_refresh: true });
export const useNotificationDeliveryReport = () => useQualityRiskReport(useCallback((filters) => reportsQualityRiskApi.notificationDelivery(filters), []), { auto_refresh: true });
