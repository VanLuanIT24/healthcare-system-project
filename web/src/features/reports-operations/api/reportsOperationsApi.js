import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsOperationsApi = {
  overview: (params) => request('/reports/operations/overview', { params }).then(unwrap),
  encounters: (params) => request('/reports/operations/encounters', { params }).then(unwrap),
  appointments: (params) => request('/reports/operations/appointments', { params }).then(unwrap),
  checkIn: (params) => request('/reports/operations/check-in', { params }).then(unwrap),
  queue: (params) => request('/reports/operations/queue', { params }).then(unwrap),
  noShow: (params) => request('/reports/operations/no-show', { params }).then(unwrap),
  waitTime: (params) => request('/reports/operations/wait-time', { params }).then(unwrap),
  departmentLoad: (params) => request('/reports/operations/department-load', { params }).then(unwrap),
  slotEfficiency: (params) => request('/reports/operations/slot-efficiency', { params }).then(unwrap),
  patientFlow: (params) => request('/reports/operations/patient-flow', { params }).then(unwrap),
  appointmentTimeline: (id) => request(`/appointments/${encodeURIComponent(id)}/timeline`).then(unwrap),
  queueTimeline: (id) => request(`/queue/${encodeURIComponent(id)}/timeline`).then(unwrap),
  encounterTimeline: (id) => request(`/encounters/${encodeURIComponent(id)}/timeline`).then(unwrap),
  encounterSummary: (id) => request(`/encounters/${encodeURIComponent(id)}/summary`).then(unwrap),
  encounterOrdersSummary: (id) => request(`/encounters/${encodeURIComponent(id)}/orders/summary`).then(unwrap),
  exportReport: (params) => request('/reports/export', { params }).then(unwrap),
};
