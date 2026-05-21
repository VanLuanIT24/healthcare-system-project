import { request, unwrapData } from '../../../utils/api';

function unwrap(response) {
  return unwrapData(response);
}

export const reportsOverviewApi = {
  overview: (params) => request('/reports/executive/overview', { params }).then(unwrap),
  kpiToday: (params) => request('/reports/executive/kpi-today', { params }).then(unwrap),
  kpiPeriod: (params) => request('/reports/executive/kpi-period', { params }).then(unwrap),
  comparison: (params) => request('/reports/executive/comparison', { params }).then(unwrap),
  anomalies: (params) => request('/reports/executive/anomalies', { params }).then(unwrap),
  trends: (params) => request('/reports/executive/trends', { params }).then(unwrap),
  actionItems: (params) => request('/reports/executive/action-items', { params }).then(unwrap),
  exportReport: (params) => request('/reports/export', { params }).then(unwrap),
};
