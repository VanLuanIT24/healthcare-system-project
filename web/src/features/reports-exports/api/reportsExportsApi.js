import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsExportsApi = {
  createExport: (body) => request('/reports/exports', { method: 'POST', body }).then(unwrap),
  csvCenter: (params) => request('/reports/exports/csv', { params }).then(unwrap),
  excelCenter: (params) => request('/reports/exports/excel', { params }).then(unwrap),
  pdfCenter: (params) => request('/reports/exports/pdf', { params }).then(unwrap),
  history: (params) => request('/reports/exports/history', { params }).then(unwrap),
  processing: (params) => request('/reports/exports/processing', { params }).then(unwrap),
  failed: (params) => request('/reports/exports/failed', { params }).then(unwrap),
  schedules: (params) => request('/reports/exports/schedules', { params }).then(unwrap),
  saved: (params) => request('/reports/exports/saved', { params }).then(unwrap),
};
