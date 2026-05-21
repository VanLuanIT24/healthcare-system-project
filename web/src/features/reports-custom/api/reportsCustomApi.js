import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsCustomApi = {
  datasets: (params) => request('/reports/custom/datasets', { params }).then(unwrap),
  datasetSchema: (datasetKey) => request(`/reports/custom/datasets/${encodeURIComponent(datasetKey)}/schema`).then(unwrap),
  preview: (body) => request('/reports/custom/preview', { method: 'POST', body }).then(unwrap),
  run: (body) => request('/reports/custom/run', { method: 'POST', body }).then(unwrap),
  reports: (params) => request('/reports/custom/reports', { params }).then(unwrap),
  myReports: (params) => request('/reports/custom/my', { params }).then(unwrap),
  sharedReports: (params) => request('/reports/custom/shared', { params }).then(unwrap),
  pinnedReports: (params) => request('/reports/custom/pinned', { params }).then(unwrap),
  exports: (params) => request('/reports/custom/exports', { params }).then(unwrap),
  coreExport: (params) => request('/reports/export', { params }).then(unwrap),
  pharmacyExport: (body) => request('/reports/pharmacy/export', { method: 'POST', body }).then(unwrap),
};
