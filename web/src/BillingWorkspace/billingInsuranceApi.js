import { getApiErrorMessage, request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function id(value) {
  return encodeURIComponent(value);
}

export const billingInsuranceAPI = {
  policies: (params) => request('/billing/insurance-policies', { params }).then(unwrap),
  policySummary: (params) => request('/billing/insurance-policies/summary', { params }).then(unwrap),
  policyDetail: (policyId) => request(`/billing/insurance-policies/${id(policyId)}`).then(unwrap),
  updatePolicy: (policyId, body) =>
    request(`/billing/insurance-policies/${id(policyId)}`, { method: 'PATCH', body }).then(unwrap),
  attachPolicyCard: (policyId, body) =>
    request(`/billing/insurance-policies/${id(policyId)}/attachments`, { method: 'POST', body }).then(unwrap),
  verifyPolicy: (policyId, body = {}) =>
    request(`/billing/insurance-policies/${id(policyId)}/verify`, { method: 'POST', body }).then(unwrap),
  rejectPolicy: (policyId, body = {}) =>
    request(`/billing/insurance-policies/${id(policyId)}/reject`, { method: 'POST', body }).then(unwrap),
  cancelPolicy: (policyId, body = {}) =>
    request(`/billing/insurance-policies/${id(policyId)}/cancel`, { method: 'POST', body }).then(unwrap),

  patientPolicies: (patientId) => request(`/billing/patients/${id(patientId)}/insurance-policies`).then(unwrap),
  createPatientPolicy: (patientId, body) =>
    request(`/billing/patients/${id(patientId)}/insurance-policies`, { method: 'POST', body }).then(unwrap),

  claims: (params) => request('/billing/insurance-claims', { params }).then(unwrap),
  claimSummary: (params) => request('/billing/insurance-claims/summary', { params }).then(unwrap),
  claimDetail: (claimId) => request(`/billing/insurance-claims/${id(claimId)}`).then(unwrap),
  updateClaim: (claimId, body) =>
    request(`/billing/insurance-claims/${id(claimId)}`, { method: 'PATCH', body }).then(unwrap),
  claimReadiness: (claimId) => request(`/billing/insurance-claims/${id(claimId)}/readiness`).then(unwrap),
  claimSettlements: (claimId) => request(`/billing/insurance-claims/${id(claimId)}/settlements`).then(unwrap),
  createClaim: (invoiceId, body) =>
    request(`/billing/invoices/${id(invoiceId)}/insurance-claims`, { method: 'POST', body }).then(unwrap),
  submitClaim: (claimId) =>
    request(`/billing/insurance-claims/${id(claimId)}/submit`, { method: 'POST', body: {} }).then(unwrap),
  markUnderReview: (claimId) =>
    request(`/billing/insurance-claims/${id(claimId)}/under-review`, { method: 'POST', body: {} }).then(unwrap),
  approveClaim: (claimId, body) =>
    request(`/billing/insurance-claims/${id(claimId)}/approve`, { method: 'POST', body }).then(unwrap),
  rejectClaim: (claimId, body) =>
    request(`/billing/insurance-claims/${id(claimId)}/reject`, { method: 'POST', body }).then(unwrap),
  settleClaim: (claimId, body) =>
    request(`/billing/insurance-claims/${id(claimId)}/settle`, { method: 'POST', body }).then(unwrap),
  cancelClaim: (claimId, body) =>
    request(`/billing/insurance-claims/${id(claimId)}/cancel`, { method: 'POST', body }).then(unwrap),
};

export function getBillingInsuranceErrorMessage(error, fallback = 'Không thể xử lý dữ liệu bảo hiểm.') {
  return getApiErrorMessage(error, fallback);
}
