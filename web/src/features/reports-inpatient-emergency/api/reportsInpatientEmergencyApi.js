import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsInpatientEmergencyApi = {
  admissions: (params) => request('/reports/inpatient-emergency/admissions', { params }).then(unwrap),
  discharges: (params) => request('/reports/inpatient-emergency/discharges', { params }).then(unwrap),
  bedOccupancy: (params) => request('/reports/inpatient-emergency/bed-occupancy', { params }).then(unwrap),
  bedTurnover: (params) => request('/reports/inpatient-emergency/bed-turnover', { params }).then(unwrap),
  lengthOfStay: (params) => request('/reports/inpatient-emergency/length-of-stay', { params }).then(unwrap),
  inpatientTasks: (params) => request('/reports/inpatient-emergency/inpatient-tasks', { params }).then(unwrap),
  emergencyCases: (params) => request('/reports/inpatient-emergency/emergency-cases', { params }).then(unwrap),
  responseTime: (params) => request('/reports/inpatient-emergency/response-time', { params }).then(unwrap),
  caseResolution: (params) => request('/reports/inpatient-emergency/case-resolution', { params }).then(unwrap),
};
