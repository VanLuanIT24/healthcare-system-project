import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorStatus } from '../../../utils/api';
import { reportsExportsApi } from '../api/reportsExportsApi';
import { defaultDateRange, downloadExportPayload } from '../utils/reportsExportsFormatters';

const DEFAULT_FILTERS = {
  range: '30d',
  timezone: 'Asia/Ho_Chi_Minh',
  page: 1,
  limit: 30,
  ...defaultDateRange(),
};

function normalizeError(error) {
  const status = getApiErrorStatus(error);
  return {
    status,
    message: status === 403
      ? 'Bạn không có quyền xuất hoặc xem lịch sử xuất báo cáo'
      : error?.message || 'Không thể tải trung tâm xuất báo cáo.',
  };
}

export function useExportFilters(initial = {}) {
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

function useLoader(loader, initial = {}, options = {}) {
  const { filters, setFilters, resetFilters } = useExportFilters(initial);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(Boolean(options.autoRefresh));
  const stableFilters = useMemo(() => filters, [filters]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    if (silent) setIsRefreshing(true);
    setError(null);
    try {
      const result = await loader(stableFilters);
      setData(result);
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      setError(normalizeError(requestError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loader, stableFilters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => load({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  return {
    data,
    error,
    filters,
    setFilters,
    resetFilters,
    isLoading,
    isRefreshing,
    lastUpdatedAt,
    autoRefresh,
    setAutoRefresh,
    refresh: () => load({ silent: true }),
  };
}

export const useCsvExport = () => useLoader(useCallback((filters) => reportsExportsApi.csvCenter(filters), []));
export const useExcelExport = () => useLoader(useCallback((filters) => reportsExportsApi.excelCenter(filters), []));
export const usePdfExport = () => useLoader(useCallback((filters) => reportsExportsApi.pdfCenter(filters), []));
export const useExportHistory = () => useLoader(useCallback((filters) => reportsExportsApi.history(filters), []));
export const useProcessingExports = () => useLoader(useCallback((filters) => reportsExportsApi.processing(filters), []), {}, { autoRefresh: true });
export const useFailedExports = () => useLoader(useCallback((filters) => reportsExportsApi.failed(filters), []), {}, { autoRefresh: true });
export const useExportSchedules = () => useLoader(useCallback((filters) => reportsExportsApi.schedules(filters), []));
export const useSavedReports = () => useLoader(useCallback((filters) => reportsExportsApi.saved(filters), []));

export function useExportJobDetail() {
  const [item, setItem] = useState(null);
  return { item, setItem, close: () => setItem(null) };
}

export function useExportRequest() {
  const [state, setState] = useState({ status: 'idle', error: null, payload: null });
  const runExport = useCallback(async (body) => {
    if (!window.confirm('Tạo export với cấu hình hiện tại?')) return null;
    setState({ status: 'loading', error: null, payload: null });
    try {
      const result = await reportsExportsApi.createExport(body);
      downloadExportPayload(result);
      setState({ status: 'done', error: null, payload: result });
      window.setTimeout(() => setState({ status: 'idle', error: null, payload: null }), 1800);
      return result;
    } catch (error) {
      const normalized = normalizeError(error);
      setState({ status: 'error', error: normalized.message, payload: null });
      return null;
    }
  }, []);
  return { ...state, runExport };
}
