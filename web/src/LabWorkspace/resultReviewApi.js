import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method = 'POST', body = {}) {
  return request(path, { method, body }).then(unwrap);
}

const base = '/clinical-results/review';

export const resultReviewApi = {
  summary: (params) => request(`${base}/summary`, { params }).then(unwrap),
  worklist: (params) => request(`${base}/worklist`, { params }).then(unwrap),
  detail: (type, id) => request(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}`).then(unwrap),
  auditTrail: (params) => request(`${base}/audit-trail`, { params }).then(unwrap),
  validateFinalize: (type, id) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/validate-finalize`, 'POST', {}),
  finalize: (type, id) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/finalize`, 'POST', {}),
  releaseToDoctor: (type, id) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/release-to-doctor`, 'POST', {}),
  doctorRead: (type, id) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/doctor-read`, 'POST', {}),
  doctorAcknowledge: (type, id) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/doctor-acknowledge`, 'POST', {}),
  releaseToPatient: (type, id) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/release-to-patient`, 'POST', {}),
  revokePatientRelease: (type, id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/revoke-patient-release`, 'POST', body),
  acknowledgeCritical: (type, id) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/acknowledge-critical`, 'POST', {}),
  requestAmend: (type, id, body = {}) => bodyRequest(`${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/request-amend`, 'POST', body),
  bulkAction: (body = {}) => bodyRequest(`${base}/bulk-action`, 'POST', body),
};

export function getResultReviewErrorMessage(error, fallback = 'Không thể tải dữ liệu duyệt/trả kết quả.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
