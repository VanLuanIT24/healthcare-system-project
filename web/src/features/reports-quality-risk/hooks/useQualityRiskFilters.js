import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorStatus } from '../../../utils/api';

const DEFAULT_FILTERS = {
  range: '30d',
  timezone: 'Asia/Ho_Chi_Minh',
  page: 1,
  limit: 30,
  auto_refresh: false,
};

export function useQualityRiskFilters(initial = {}) {
  const [filters, setFiltersState] = useState({ ...DEFAULT_FILTERS, ...initial });
  const setFilters = useCallback((patch) => {
    setFiltersState((current) => {
      const nextPatch = typeof patch === 'function' ? patch(current) : patch;
      return { ...current, ...nextPatch, page: nextPatch?.page || 1 };
    });
  }, []);
  const resetFilters = useCallback(() => setFiltersState({ ...DEFAULT_FILTERS, ...initial }), [initial]);
  return { filters, setFilters, resetFilters };
}

export function useQualityRiskReport(loader, initial = {}) {
  const { filters, setFilters, resetFilters } = useQualityRiskFilters(initial);
  const stableFilters = useMemo(() => filters, [filters]);
  const mountedRef = useRef(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

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
      const status = getApiErrorStatus(requestError);
      setError({
        status,
        message: status === 403
          ? 'Bạn không có quyền xem báo cáo chất lượng/rủi ro này.'
          : requestError?.message || 'Không thể tải báo cáo chất lượng/rủi ro.',
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
    return () => { mountedRef.current = false; };
  }, [load]);

  useEffect(() => {
    if (!stableFilters.auto_refresh) return undefined;
    const timer = window.setInterval(() => load({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [load, stableFilters.auto_refresh]);

  return { data, error, filters, setFilters, resetFilters, isLoading, isRefreshing, lastUpdatedAt, refresh: () => load({ silent: true }) };
}
