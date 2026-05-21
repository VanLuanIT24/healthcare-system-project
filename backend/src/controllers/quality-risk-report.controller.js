const qualityRiskReportService = require('../services/quality-risk-report.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  dashboard: wrap(
    (req) => qualityRiskReportService.getQualityRiskDashboard(req.query, req.auth),
    'Lay dashboard chat luong/rui ro thanh cong.',
  ),
  criticalAlerts: wrap(
    (req) => qualityRiskReportService.getCriticalAlertsReport(req.query, req.auth),
    'Lay bao cao critical alerts thanh cong.',
  ),
  breakGlass: wrap(
    (req) => qualityRiskReportService.getBreakGlassReport(req.query, req.auth),
    'Lay bao cao break-glass thanh cong.',
  ),
  sensitiveAccess: wrap(
    (req) => qualityRiskReportService.getSensitiveAccessReport(req.query, req.auth),
    'Lay bao cao sensitive access thanh cong.',
  ),
  securityAudit: wrap(
    (req) => qualityRiskReportService.getSecurityAuditReport(req.query, req.auth),
    'Lay bao cao security audit thanh cong.',
  ),
  supportTickets: wrap(
    (req) => qualityRiskReportService.getSupportTicketsReport(req.query, req.auth),
    'Lay bao cao support tickets thanh cong.',
  ),
  complaintsRatings: wrap(
    (req) => qualityRiskReportService.getComplaintsRatingsReport(req.query, req.auth),
    'Lay bao cao complaint/rating thanh cong.',
  ),
  sla: wrap(
    (req) => qualityRiskReportService.getSlaReport(req.query, req.auth),
    'Lay bao cao SLA thanh cong.',
  ),
  jobFailure: wrap(
    (req) => qualityRiskReportService.getJobFailureReport(req.query, req.auth),
    'Lay bao cao job failure thanh cong.',
  ),
  notificationDelivery: wrap(
    (req) => qualityRiskReportService.getNotificationDeliveryReport(req.query, req.auth),
    'Lay bao cao notification delivery thanh cong.',
  ),
};
