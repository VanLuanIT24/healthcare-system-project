import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorStatus } from '../../../utils/api';

export const DEFAULT_OPERATION_FILTERS = {
  range: 'today',
  timezone: 'Asia/Ho_Chi_Minh',
  page: 1,
  limit: 30,
};

export function useOperationFilters(initial = {}) {
  const [filters, setFilters] = useState({ ...DEFAULT_OPERATION_FILTERS, ...initial });
  const updateFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch), page: patch?.page || 1 }));
  }, []);
  const resetFilters = useCallback(() => setFilters({ ...DEFAULT_OPERATION_FILTERS, ...initial }), [initial]);
  return { filters, setFilters: updateFilters, resetFilters };
}

export function useOperationReport(loader, initialFilters = {}, options = {}) {
  const { filters, setFilters, resetFilters } = useOperationFilters(initialFilters);
  const mountedRef = useRef(true);
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
      const status = getApiErrorStatus(requestError);
      setError({
        status,
        message: status === 403 ? 'Bạn không có quyền xem báo cáo này.' : requestError?.message || 'Không thể tải báo cáo vận hành.',
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

  return { data, error, filters, isLoading, isRefreshing, lastUpdatedAt, refresh: () => load({ silent: true }), setFilters, resetFilters };
}
