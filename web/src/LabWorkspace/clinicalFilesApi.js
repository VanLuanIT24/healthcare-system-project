import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method = 'POST', body = {}) {
  return request(path, { method, body }).then(unwrap);
}

const base = '/clinical-document-files';

export const clinicalFilesApi = {
  summary: (params) => request(`${base}/summary`, { params }).then(unwrap),
  list: (params) => request(base, { params }).then(unwrap),
  missing: (params) => request(`${base}/missing`, { params }).then(unwrap),
  scanErrors: (params) => request(`${base}/scan-errors`, { params }).then(unwrap),
  reviewQueue: (params) => request(`${base}/review-queue`, { params }).then(unwrap),
  released: (params) => request(`${base}/released`, { params }).then(unwrap),
  detail: (id) => request(`${base}/${encodeURIComponent(id)}`).then(unwrap),
  audit: (id, params) => request(`${base}/${encodeURIComponent(id)}/audit`, { params }).then(unwrap),
  accessLogs: (id, params) => request(`${base}/${encodeURIComponent(id)}/access-logs`, { params }).then(unwrap),
  metadata: (id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(id)}/metadata`, 'PATCH', body),
  review: (id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(id)}/review`, 'POST', body),
  release: (id) => bodyRequest(`${base}/${encodeURIComponent(id)}/release`, 'POST', {}),
  revokeRelease: (id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(id)}/revoke-release`, 'POST', body),
  archive: (id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(id)}/archive`, 'POST', body),
  restore: (id) => bodyRequest(`${base}/${encodeURIComponent(id)}/restore`, 'POST', {}),
  delete: (id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(id)}`, 'DELETE', body),
  rescan: (id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(id)}/rescan`, 'POST', body),
  quarantine: (id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(id)}/quarantine`, 'POST', body),
  skipScan: (id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(id)}/mark-scan-skipped`, 'POST', body),
  bulkAction: (body = {}) => bodyRequest(`${base}/bulk-action`, 'POST', body),
  recomputeMissing: (body = {}) => bodyRequest(`${base}/missing/recompute`, 'POST', body),
  assignMissing: (id, body = {}) => bodyRequest(`${base}/missing/${encodeURIComponent(id)}/assign`, 'POST', body),
  waiveMissing: (id, body = {}) => bodyRequest(`${base}/missing/${encodeURIComponent(id)}/waive`, 'POST', body),
  resolveMissing: (id, body = {}) => bodyRequest(`${base}/missing/${encodeURIComponent(id)}/resolve`, 'POST', body),
};

export function getClinicalFilesErrorMessage(error, fallback = 'Không thể tải dữ liệu file lâm sàng.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
