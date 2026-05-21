import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorStatus } from '../../../utils/api';
import { reportsOverviewApi } from '../api/reportsOverviewApi';

const DEFAULT_FILTERS = {
  range: 'today',
  timezone: 'Asia/Ho_Chi_Minh',
};

export function useExecutiveReport(loader, initialFilters = {}, options = {}) {
  const mountedRef = useRef(true);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...initialFilters });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const stableFilters = useMemo(() => filters, [filters]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    if (silent) setIsRefreshing(true);
    setError(null);
    try {
      const result = await loader(stableFilters);
      if (!mountedRef.current) return;
      setData(result);
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      if (!mountedRef.current) return;
      setError({
        status: getApiErrorStatus(requestError),
        message: getApiErrorStatus(requestError) === 403
          ? 'Bạn không có quyền xem báo cáo này.'
          : requestError?.message || 'Không thể tải dữ liệu báo cáo.',
      });
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [loader, stableFilters]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!options.autoRefreshMs) return undefined;
    const timer = window.setInterval(() => load({ silent: true }), options.autoRefreshMs);
    return () => window.clearInterval(timer);
  }, [load, options.autoRefreshMs]);

  return {
    data,
    error,
    filters,
    isLoading,
    isRefreshing,
    lastUpdatedAt,
    refresh: () => load({ silent: true }),
    setFilters: (updater) => setFilters((current) => (typeof updater === 'function' ? updater(current) : { ...current, ...updater })),
  };
}

export const useExecutiveDashboard = (filters, options) => useExecutiveReport(reportsOverviewApi.overview, filters, options);
export const useKpiToday = (filters, options) => useExecutiveReport(reportsOverviewApi.kpiToday, { range: 'today', ...filters }, options);
export const useKpiPeriod = (filters, options) => useExecutiveReport(reportsOverviewApi.kpiPeriod, { range: 'week', period: 'week', ...filters }, options);
export const useComparison = (filters, options) => useExecutiveReport(reportsOverviewApi.comparison, { range: 'week', ...filters }, options);
export const useAnomalyAlerts = (filters, options) => useExecutiveReport(reportsOverviewApi.anomalies, { range: 'today', ...filters }, options);
export const useTrends = (filters, options) => useExecutiveReport(reportsOverviewApi.trends, { range: '30d', period: '30d', ...filters }, options);
export const useActionItems = (filters, options) => useExecutiveReport(reportsOverviewApi.actionItems, { range: 'today', ...filters }, options);
