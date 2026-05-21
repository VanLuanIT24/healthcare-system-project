import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorStatus } from '../../../utils/api';

const DEFAULT_FILTERS = {
  range: 'week',
  timezone: 'Asia/Ho_Chi_Minh',
  page: 1,
  limit: 30,
};

export function useDepartmentDoctorFilters(initial = {}) {
  const [filters, setFiltersState] = useState({ ...DEFAULT_FILTERS, ...initial });
  const setFilters = useCallback((patch) => {
    setFiltersState((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch), page: patch?.page || 1 }));
  }, []);
  const resetFilters = useCallback(() => setFiltersState({ ...DEFAULT_FILTERS, ...initial }), [initial]);
  return { filters, setFilters, resetFilters };
}

export function useDepartmentDoctorReport(loader, initial = {}) {
  const { filters, setFilters, resetFilters } = useDepartmentDoctorFilters(initial);
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
        message: status === 403 ? 'Bạn không có quyền xem báo cáo này.' : requestError?.message || 'Không thể tải báo cáo khoa & bác sĩ.',
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

  return { data, error, filters, setFilters, resetFilters, isLoading, isRefreshing, lastUpdatedAt, refresh: () => load({ silent: true }) };
}
