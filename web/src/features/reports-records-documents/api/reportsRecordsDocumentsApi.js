import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsRecordsDocumentsApi = {
  medicalRecords: (params) => request('/reports/records-documents/medical-records', { params }).then(unwrap),
  finalizedRecords: (params) => request('/reports/records-documents/finalized-records', { params }).then(unwrap),
  releasedRecords: (params) => request('/reports/records-documents/released-records', { params }).then(unwrap),
  voidArchive: (params) => request('/reports/records-documents/void-archive', { params }).then(unwrap),
  attachments: (params) => request('/reports/records-documents/attachments', { params }).then(unwrap),
  exports: (params) => request('/reports/records-documents/exports', { params }).then(unwrap),
  timeline: (params) => request('/reports/records-documents/timeline', { params }).then(unwrap),
};
