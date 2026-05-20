import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

export const patientClinicalLookupAPI = {
  searchPatients: (params) => request('/patients/search', { params }).then(unwrap),
  patientOverview: (patientId, params) =>
    request(`/clinical-investigation/patients/${encodeURIComponent(patientId)}/overview`, { params }).then(unwrap),
  patientSnapshot: (patientId, params) =>
    request(`/clinical-investigation/patients/${encodeURIComponent(patientId)}/snapshot`, { params }).then(unwrap),
  patientMatrix: (patientId, params) =>
    request(`/clinical-investigation/patients/${encodeURIComponent(patientId)}/result-matrix`, { params }).then(unwrap),
  patientTimeline: (patientId, params) =>
    request(`/clinical-investigation/patients/${encodeURIComponent(patientId)}/timeline`, { params }).then(unwrap),
  patientPendingActions: (patientId, params) =>
    request(`/clinical-investigation/patients/${encodeURIComponent(patientId)}/pending-actions`, { params }).then(unwrap),
  patientCriticalAlerts: (patientId, params) =>
    request(`/clinical-investigation/patients/${encodeURIComponent(patientId)}/critical-alerts`, { params }).then(unwrap),
  patientFileGaps: (patientId, params) =>
    request(`/clinical-investigation/patients/${encodeURIComponent(patientId)}/file-gaps`, { params }).then(unwrap),
  encounterOverview: (encounterId, params) =>
    request(`/clinical-investigation/encounters/${encodeURIComponent(encounterId)}/overview`, { params }).then(unwrap),
  acknowledgeLabCritical: (resultId, body = {}) =>
    request(`/laboratory/results/${encodeURIComponent(resultId)}/acknowledge-critical`, { method: 'POST', body }).then(unwrap),
  acknowledgeImagingCritical: (reportId, body = {}) =>
    request(`/imaging/reports/${encodeURIComponent(reportId)}/acknowledge-critical`, { method: 'POST', body }).then(unwrap),
  releaseLabResult: (resultId, body = {}) =>
    request(`/laboratory/results/${encodeURIComponent(resultId)}/release-to-patient`, { method: 'POST', body }).then(unwrap),
  releaseImagingReport: (reportId, body = {}) =>
    request(`/imaging/reports/${encodeURIComponent(reportId)}/release-to-patient`, { method: 'POST', body }).then(unwrap),
  releaseProcedureResult: (resultId, body = {}) =>
    request(`/procedures/results/${encodeURIComponent(resultId)}/release-to-patient`, { method: 'POST', body }).then(unwrap),
  createProcedureCharge: (procedureOrderId, body = {}) =>
    request(`/procedures/orders/${encodeURIComponent(procedureOrderId)}/charge`, { method: 'POST', body }).then(unwrap),
};

export function getPatientClinicalLookupError(error, fallback = 'Không thể tải dữ liệu tra cứu cận lâm sàng.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
