import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorStatus } from '../../../utils/api';
import { reportsCustomApi } from '../api/reportsCustomApi';
import { ensureRevenueDateRange } from '../utils/customReportFormatters';

const DEFAULT_FILTERS = {
  range: '30d',
  timezone: 'Asia/Ho_Chi_Minh',
  page: 1,
  limit: 30,
};

function customError(error) {
  const status = getApiErrorStatus(error);
  return {
    status,
    message: status === 403 ? 'Bạn không có quyền xem báo cáo tùy chỉnh này.' : error?.message || 'Không thể tải báo cáo tùy chỉnh.',
  };
}

export function useCustomReportFilters(initial = {}) {
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

function useLoader(loader, initial = {}) {
  const { filters, setFilters, resetFilters } = useCustomReportFilters(initial);
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
      setData(result);
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      setError(customError(requestError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loader, stableFilters]);

  useEffect(() => { load(); }, [load]);

  return { data, error, filters, setFilters, resetFilters, isLoading, isRefreshing, lastUpdatedAt, refresh: () => load({ silent: true }) };
}

export const useCustomReportDatasets = () => useLoader(useCallback((filters) => reportsCustomApi.datasets(filters), []));
export const useMyReports = () => useLoader(useCallback((filters) => reportsCustomApi.myReports(filters), []));
export const useSharedReports = () => useLoader(useCallback((filters) => reportsCustomApi.sharedReports(filters), []));
export const usePinnedReports = () => useLoader(useCallback((filters) => reportsCustomApi.pinnedReports(filters), []));

export function useDatasetSchema(datasetKey) {
  const [state, setState] = useState({ data: null, error: null, isLoading: false });
  useEffect(() => {
    if (!datasetKey) return undefined;
    let active = true;
    setState((current) => ({ ...current, isLoading: true, error: null }));
    reportsCustomApi.datasetSchema(datasetKey)
      .then((data) => { if (active) setState({ data, error: null, isLoading: false }); })
      .catch((error) => { if (active) setState({ data: null, error: customError(error), isLoading: false }); });
    return () => { active = false; };
  }, [datasetKey]);
  return state;
}

export function useReportBuilderState() {
  const [datasetKey, setDatasetKey] = useState('appointments_report');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [columns, setColumns] = useState([]);
  const [charts, setCharts] = useState([]);
  const [activeStep, setActiveStep] = useState('dataset');

  const reset = useCallback(() => {
    setDatasetKey('appointments_report');
    setFilters({ ...DEFAULT_FILTERS });
    setColumns([]);
    setCharts([]);
    setActiveStep('dataset');
  }, []);

  return {
    datasetKey,
    setDatasetKey,
    filters,
    setFilters: (patch) => setFilters((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) })),
    columns,
    setColumns,
    charts,
    setCharts,
    activeStep,
    setActiveStep,
    reset,
  };
}

export function useReportPreview() {
  const [state, setState] = useState({ data: null, error: null, isLoading: false, lastUpdatedAt: null });

  const preview = useCallback(async ({ datasetKey, filters, columns, charts }) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const safeFilters = datasetKey === 'revenue_report' ? ensureRevenueDateRange(filters) : filters;
      const data = await reportsCustomApi.preview({ dataset_key: datasetKey, filters: safeFilters, columns, charts, limit: 50 });
      setState({ data, error: null, isLoading: false, lastUpdatedAt: new Date() });
      return data;
    } catch (error) {
      const normalized = customError(error);
      setState({ data: null, error: normalized, isLoading: false, lastUpdatedAt: null });
      return null;
    }
  }, []);

  return { ...state, preview };
}

export const useCustomReportExport = () => {
  const [state, setState] = useState({ status: 'idle', error: null });
  const exportReport = useCallback(async ({ dataset, filters, format = 'csv' }) => {
    if (!dataset?.supports_export) {
      setState({ status: 'error', error: 'Dataset này chưa hỗ trợ export.' });
      return null;
    }
    if (!window.confirm('Export báo cáo tùy chỉnh với cấu hình hiện tại?')) return null;
    setState({ status: 'loading', error: null });
    try {
      const safeFilters = dataset.key === 'revenue_report' ? ensureRevenueDateRange(filters) : filters;
      const result = dataset.pharmacy_export
        ? await reportsCustomApi.pharmacyExport({ ...safeFilters, dataset_key: dataset.key, format })
        : await reportsCustomApi.coreExport({ ...safeFilters, report_type: dataset.export_type, format });
      setState({ status: 'done', error: null });
      window.setTimeout(() => setState({ status: 'idle', error: null }), 1400);
      return result;
    } catch (error) {
      setState({ status: 'error', error: error?.message || 'Export thất bại.' });
      return null;
    }
  }, []);
  return { ...state, exportReport };
};

export const useColumnBuilder = (schema = []) => schema;
export const useChartBuilder = (schema = []) => schema;
