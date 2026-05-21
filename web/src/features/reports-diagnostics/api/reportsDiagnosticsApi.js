import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsDiagnosticsApi = {
  overview: (params) => request('/reports/diagnostics/overview', { params }).then(unwrap),
  labOrders: (params) => request('/reports/diagnostics/lab-orders', { params }).then(unwrap),
  labTurnaroundTime: (params) => request('/reports/diagnostics/lab-turnaround-time', { params }).then(unwrap),
  specimens: (params) => request('/reports/diagnostics/specimens', { params }).then(unwrap),
  imagingOrders: (params) => request('/reports/diagnostics/imaging-orders', { params }).then(unwrap),
  imagingTurnaroundTime: (params) => request('/reports/diagnostics/imaging-turnaround-time', { params }).then(unwrap),
  reportPending: (params) => request('/reports/diagnostics/report-pending', { params }).then(unwrap),
  criticalResults: (params) => request('/reports/diagnostics/critical-results', { params }).then(unwrap),
  procedureOrders: (params) => request('/reports/diagnostics/procedure-orders', { params }).then(unwrap),
  overdueOrders: (params) => request('/reports/diagnostics/overdue-orders', { params }).then(unwrap),
  exportReport: (params) => request('/reports/export', { params }).then(unwrap),
};
