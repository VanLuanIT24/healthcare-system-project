import { request, unwrapData, getApiErrorMessage } from '../../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function id(value) {
  return encodeURIComponent(value);
}

function get(path, params) {
  return request(path, { params }).then(unwrap);
}

function post(path, body = {}) {
  return request(path, { method: 'POST', body }).then(unwrap);
}

function patch(path, body = {}) {
  return request(path, { method: 'PATCH', body }).then(unwrap);
}

function del(path, body = {}) {
  return request(path, { method: 'DELETE', body }).then(unwrap);
}

export const receptionPatientAdminApi = {
  globalSearch: (params) => get('/reception/search/global', params),
  searchReceptionPatients: (params) => get('/reception/search/patients', params),
  lookupPhone: (params) => get('/reception/lookup/phone', params),
  lookupNationalId: (params) => get('/reception/lookup/national-id', params),
  recentLookups: (params) => get('/reception/recent-lookups', params),
  patientCard: (patientId, params) => get(`/reception/patients/${id(patientId)}/card`, params),
  routePatient: (body) => post('/reception/route-patient', body),
  routingOptions: (params) => get('/reception/routing-options', params),
  quickCheckin: (body) => post('/reception/checkin/quick', body),
  qrCheckin: (body) => post('/reception/checkin/qr', body),
  walkInCheckin: (body) => post('/reception/walk-in-checkin', body),
  printPatientCard: (patientId, body = {}) => post(`/reception/print/patient-card/${id(patientId)}`, body),
  printQueueTicket: (ticketId, body = {}) => post(`/reception/print/queue-ticket/${id(ticketId)}`, body),

  listPatients: (params) => get('/patients', params),
  searchPatients: (params) => get('/patients/search', params),
  createPatient: (body) => post('/patients', body),
  getPatient: (patientId) => get(`/patients/${id(patientId)}`),
  getPatientSummary: (patientId) => get(`/patients/${id(patientId)}/summary`),
  getPatientTimeline: (patientId, params) => get(`/patients/${id(patientId)}/timeline`, params),
  updatePatient: (patientId, body) => patch(`/patients/${id(patientId)}`, body),
  updatePatientStatus: (patientId, body) => patch(`/patients/${id(patientId)}/status`, body),
  archivePatient: (patientId, body = {}) => post(`/patients/${id(patientId)}/archive`, body),
  detectDuplicates: (body) => post('/patients/duplicates', body),
  mergeCheck: (params) => get('/patients/merge/check', params),
  mergePreview: (body) => post('/patients/merge/preview', body),
  mergePatients: (body) => post('/patients/merge', body),

  identifiers: (patientId) => get(`/patients/${id(patientId)}/identifiers`),
  addIdentifier: (patientId, body) => post(`/patients/${id(patientId)}/identifiers`, body),
  updateIdentifier: (patientId, identifierId, body) => patch(`/patients/${id(patientId)}/identifiers/${id(identifierId)}`, body),
  deleteIdentifier: (patientId, identifierId) => del(`/patients/${id(patientId)}/identifiers/${id(identifierId)}`),
  setPrimaryIdentifier: (patientId, identifierId) => post(`/patients/${id(patientId)}/identifiers/${id(identifierId)}/set-primary`),

  relatives: (patientId) => get(`/patients/${id(patientId)}/relatives`),
  addRelative: (patientId, body) => post(`/patients/${id(patientId)}/relatives`, body),
  updateRelative: (relativeId, body) => patch(`/patients/relatives/${id(relativeId)}`, body),
  deleteRelative: (relativeId) => del(`/patients/relatives/${id(relativeId)}`),
  authorizations: (patientId) => get(`/patients/${id(patientId)}/authorizations`),
  createAuthorization: (patientId, body) => post(`/patients/${id(patientId)}/authorizations`, body),
  approveAuthorization: (authorizationId) => post(`/patients/authorizations/${id(authorizationId)}/approve`),
  revokeAuthorization: (authorizationId, body = {}) => post(`/patients/authorizations/${id(authorizationId)}/revoke`, body),

  createPortalAccount: (patientId, body) => post(`/patients/${id(patientId)}/account`, body),
  listPortalAccounts: (params) => get('/admin/patient-portal/accounts', params),
  updatePortalAccount: (accountId, body) => patch(`/admin/patient-portal/accounts/${id(accountId)}`, body),
  lockPortalAccount: (accountId, body = {}) => post(`/admin/patient-portal/accounts/${id(accountId)}/lock`, body),
  unlockPortalAccount: (accountId) => post(`/admin/patient-portal/accounts/${id(accountId)}/unlock`),
  disablePortalAccount: (accountId, body = {}) => post(`/admin/patient-portal/accounts/${id(accountId)}/disable`, body),
  enablePortalAccount: (accountId) => post(`/admin/patient-portal/accounts/${id(accountId)}/enable`),
  resetPortalPassword: (accountId, body = {}) => post(`/admin/patient-portal/accounts/${id(accountId)}/reset-password`, body),
  forceLogoutPortalAccount: (accountId, body = {}) => post(`/admin/patient-portal/accounts/${id(accountId)}/force-logout`, body),
  resendPortalVerification: (accountId, body = {}) => post(`/admin/patient-portal/accounts/${id(accountId)}/resend-verification`, body),
  unlinkGoogleAccount: (accountId) => post(`/admin/patient-portal/accounts/${id(accountId)}/unlink-google`),

  profileChangeSummary: () => get('/admin/patient-portal/profile-change-requests/summary'),
  profileChangeRequests: (params) => get('/admin/patient-portal/profile-change-requests', params),
  profileChangeRequest: (requestId) => get(`/admin/patient-portal/profile-change-requests/${id(requestId)}`),
  approveProfileChange: (requestId, body = {}) => post(`/admin/patient-portal/profile-change-requests/${id(requestId)}/approve`, body),
  rejectProfileChange: (requestId, body = {}) => post(`/admin/patient-portal/profile-change-requests/${id(requestId)}/reject`, body),
  requestMoreInfoProfileChange: (requestId, body = {}) =>
    post(`/admin/patient-portal/profile-change-requests/${id(requestId)}/request-more-info`, body),
  assignProfileChange: (requestId, body = {}) => post(`/admin/patient-portal/profile-change-requests/${id(requestId)}/assign`, body),

  documentsSummary: () => get('/admin/patient-portal/documents/summary'),
  documents: (params) => get('/admin/patient-portal/documents', params),
  document: (documentId) => get(`/admin/patient-portal/documents/${id(documentId)}`),
  approveDocument: (documentId, body = {}) => post(`/admin/patient-portal/documents/${id(documentId)}/approve`, body),
  rejectDocument: (documentId, body = {}) => post(`/admin/patient-portal/documents/${id(documentId)}/reject`, body),
  rescanDocument: (documentId, body = {}) => post(`/admin/patient-portal/documents/${id(documentId)}/rescan`, body),
  updateDocumentMetadata: (documentId, body = {}) => patch(`/admin/patient-portal/documents/${id(documentId)}/metadata`, body),
  releaseDocument: (documentId, body = {}) => post(`/admin/patient-portal/documents/${id(documentId)}/release`, body),
  revokeDocumentRelease: (documentId, body = {}) => post(`/admin/patient-portal/documents/${id(documentId)}/revoke-release`, body),

  missingDocuments: (params) => get('/clinical-document-files/missing', params),
  recomputeMissingDocuments: (body = {}) => post('/clinical-document-files/missing/recompute', body),
  assignMissingDocument: (taskId, body = {}) => post(`/clinical-document-files/missing/${id(taskId)}/assign`, body),
  waiveMissingDocument: (taskId, body = {}) => post(`/clinical-document-files/missing/${id(taskId)}/waive`, body),
  resolveMissingDocument: (taskId, body = {}) => post(`/clinical-document-files/missing/${id(taskId)}/resolve`, body),
  reviewQueue: (params) => get('/clinical-document-files/review-queue', params),
  scanQueue: (params) => get('/clinical-document-files/scan-queue', params),
  scanErrors: (params) => get('/clinical-document-files/scan-errors', params),
  reviewAttachment: (attachmentId, body = {}) => post(`/clinical-document-files/${id(attachmentId)}/review`, body),
  rescanAttachment: (attachmentId, body = {}) => post(`/clinical-document-files/${id(attachmentId)}/rescan`, body),
  quarantineAttachment: (attachmentId, body = {}) => post(`/clinical-document-files/${id(attachmentId)}/quarantine`, body),

  insurancePolicies: (params) => get('/billing/insurance-policies', params),
  insurancePolicySummary: (params) => get('/billing/insurance-policies/summary', params),
  patientInsurancePolicies: (patientId) => get(`/billing/patients/${id(patientId)}/insurance-policies`),
  createPatientInsurancePolicy: (patientId, body) => post(`/billing/patients/${id(patientId)}/insurance-policies`, body),
  updateInsurancePolicy: (policyId, body) => patch(`/billing/insurance-policies/${id(policyId)}`, body),
  verifyInsurancePolicy: (policyId, body = {}) => post(`/billing/insurance-policies/${id(policyId)}/verify`, body),
  rejectInsurancePolicy: (policyId, body = {}) => post(`/billing/insurance-policies/${id(policyId)}/reject`, body),
  cancelInsurancePolicy: (policyId, body = {}) => post(`/billing/insurance-policies/${id(policyId)}/cancel`, body),
  insuranceSubmissions: (params) => get('/admin/patient-portal/insurance-submissions', params),
  insuranceSubmissionsSummary: () => get('/admin/patient-portal/insurance-submissions/summary'),
  verifyInsuranceSubmission: (policyId, body = {}) => post(`/admin/patient-portal/insurance-submissions/${id(policyId)}/verify`, body),
  rejectInsuranceSubmission: (policyId, body = {}) => post(`/admin/patient-portal/insurance-submissions/${id(policyId)}/reject`, body),
  requestMoreInfoInsurance: (policyId, body = {}) => post(`/admin/patient-portal/insurance-submissions/${id(policyId)}/request-more-info`, body),
};

export function getReceptionPatientAdminError(error, fallback = 'Không thể xử lý dữ liệu lễ tân.') {
  return getApiErrorMessage(error, fallback);
}
