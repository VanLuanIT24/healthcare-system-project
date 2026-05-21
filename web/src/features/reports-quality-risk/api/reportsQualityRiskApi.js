import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsQualityRiskApi = {
  dashboard: (params) => request('/reports/quality-risk/dashboard', { params }).then(unwrap),
  criticalAlerts: (params) => request('/reports/quality-risk/critical-alerts', { params }).then(unwrap),
  breakGlass: (params) => request('/reports/quality-risk/break-glass', { params }).then(unwrap),
  sensitiveAccess: (params) => request('/reports/quality-risk/sensitive-access', { params }).then(unwrap),
  securityAudit: (params) => request('/reports/quality-risk/security-audit', { params }).then(unwrap),
  supportTickets: (params) => request('/reports/quality-risk/support-tickets', { params }).then(unwrap),
  complaintsRatings: (params) => request('/reports/quality-risk/complaints-ratings', { params }).then(unwrap),
  sla: (params) => request('/reports/quality-risk/sla', { params }).then(unwrap),
  jobFailure: (params) => request('/reports/quality-risk/job-failure', { params }).then(unwrap),
  notificationDelivery: (params) => request('/reports/quality-risk/notification-delivery', { params }).then(unwrap),
};
