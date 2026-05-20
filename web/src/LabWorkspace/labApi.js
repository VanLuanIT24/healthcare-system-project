import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method = 'POST', body = {}) {
  return request(path, { method, body }).then(unwrap);
}

export const labWorkspaceAPI = {
  workspaceSummary: (params) => request('/lab/workspace/summary', { params }).then(unwrap),
  overdue: (params) => request('/lab/workspace/overdue', { params }).then(unwrap),

  listOrders: (params) => request('/lab/orders', { params }).then(unwrap),
  orderDetail: (labOrderId) => request(`/lab/orders/${encodeURIComponent(labOrderId)}`).then(unwrap),
  acknowledgeOrder: (labOrderId, body = {}) => bodyRequest(`/lab/orders/${encodeURIComponent(labOrderId)}/acknowledge`, 'POST', body),
  cancelOrder: (labOrderId, body = {}) => bodyRequest(`/lab/orders/${encodeURIComponent(labOrderId)}/cancel`, 'POST', body),
  createSpecimen: (labOrderId, body = {}) => bodyRequest(`/lab/orders/${encodeURIComponent(labOrderId)}/specimens`, 'POST', body),
  collectOrder: (labOrderId, body = {}) => bodyRequest(`/lab/orders/${encodeURIComponent(labOrderId)}/collect`, 'POST', body),
  printOrderLabels: (labOrderId, body = {}) => bodyRequest(`/lab/orders/${encodeURIComponent(labOrderId)}/print-labels`, 'POST', body),

  listSpecimens: (params) => request('/lab/specimens', { params }).then(unwrap),
  specimenStats: (params) => request('/lab/specimens/stats', { params }).then(unwrap),
  lookupSpecimen: (params) => request('/lab/specimens/lookup', { params }).then(unwrap),
  specimenDetail: (specimenId) => request(`/lab/specimens/${encodeURIComponent(specimenId)}`).then(unwrap),
  specimenTimeline: (specimenId) => request(`/lab/specimens/${encodeURIComponent(specimenId)}/timeline`).then(unwrap),
  specimenCustody: (specimenId) => request(`/lab/specimens/${encodeURIComponent(specimenId)}/custody`).then(unwrap),
  receiveSpecimen: (specimenId, body = {}) => bodyRequest(`/lab/specimens/${encodeURIComponent(specimenId)}/receive`, 'POST', body),
  rejectSpecimen: (specimenId, body = {}) => bodyRequest(`/lab/specimens/${encodeURIComponent(specimenId)}/reject`, 'POST', body),
  processSpecimen: (specimenId, body = {}) => bodyRequest(`/lab/specimens/${encodeURIComponent(specimenId)}/process`, 'POST', body),
  storeSpecimen: (specimenId, body = {}) => bodyRequest(`/lab/specimens/${encodeURIComponent(specimenId)}/store`, 'POST', body),
  disposeSpecimen: (specimenId, body = {}) => bodyRequest(`/lab/specimens/${encodeURIComponent(specimenId)}/dispose`, 'POST', body),
  printSpecimenLabel: (specimenId, body = {}) => bodyRequest(`/lab/specimens/${encodeURIComponent(specimenId)}/print-label`, 'POST', body),
  printSpecimenLabels: (body = {}) => bodyRequest('/lab/specimens/bulk/print-labels', 'POST', body),
  bulkReceiveSpecimens: (body = {}) => bodyRequest('/lab/specimens/bulk/receive', 'POST', body),
  bulkRejectSpecimens: (body = {}) => bodyRequest('/lab/specimens/bulk/reject', 'POST', body),
  requestSpecimenRecollection: (specimenId, body = {}) => bodyRequest(`/lab/specimens/${encodeURIComponent(specimenId)}/request-recollection`, 'POST', body),

  listResults: (params) => request('/lab/results', { params }).then(unwrap),
  resultDetail: (resultId) => request(`/lab/results/${encodeURIComponent(resultId)}`).then(unwrap),
  createResult: (labOrderId, body = {}) => bodyRequest(`/lab/orders/${encodeURIComponent(labOrderId)}/results`, 'POST', body),
  updateResult: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}`, 'PATCH', body),
  finalizeResult: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}/finalize`, 'POST', body),
  amendResult: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}/amend`, 'POST', body),
  acknowledgeCritical: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}/acknowledge-critical`, 'POST', body),
  cancelResult: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}/cancel`, 'POST', body),
  enteredInError: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}/entered-in-error`, 'POST', body),
  releaseResult: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}/release-to-patient`, 'POST', body),
  requestCorrection: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}/request-correction`, 'POST', body),
  printResult: (resultId, body = {}) => bodyRequest(`/lab/results/${encodeURIComponent(resultId)}/print`, 'POST', body),
  resultVersions: (resultId) => request(`/lab/results/${encodeURIComponent(resultId)}/versions`).then(unwrap),

  listCorrections: (params) => request('/lab/result-corrections', { params }).then(unwrap),
  correctionDetail: (correctionId) => request(`/lab/result-corrections/${encodeURIComponent(correctionId)}`).then(unwrap),
  resolveCorrection: (correctionId, body = {}) => bodyRequest(`/lab/result-corrections/${encodeURIComponent(correctionId)}/resolve`, 'POST', body),
  cancelCorrection: (correctionId, body = {}) => bodyRequest(`/lab/result-corrections/${encodeURIComponent(correctionId)}/cancel`, 'POST', body),

  listCatalogTests: (params) => request('/lab/catalog/tests', { params }).then(unwrap),
  catalogTestDetail: (catalogTestId) => request(`/lab/catalog/tests/${encodeURIComponent(catalogTestId)}`).then(unwrap),
  createCatalogTest: (body = {}) => bodyRequest('/lab/catalog/tests', 'POST', body),
  updateCatalogTest: (catalogTestId, body = {}) => bodyRequest(`/lab/catalog/tests/${encodeURIComponent(catalogTestId)}`, 'PATCH', body),
  activateCatalogTest: (catalogTestId) => bodyRequest(`/lab/catalog/tests/${encodeURIComponent(catalogTestId)}/activate`, 'POST', {}),
  deactivateCatalogTest: (catalogTestId) => bodyRequest(`/lab/catalog/tests/${encodeURIComponent(catalogTestId)}/deactivate`, 'POST', {}),

  listSlaRules: (params) => request('/lab/sla/rules', { params }).then(unwrap),
};

export function getLabErrorMessage(error, fallback = 'Không thể tải dữ liệu xét nghiệm.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
