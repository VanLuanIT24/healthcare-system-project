const inpatientEmergencyReportService = require('../services/inpatient-emergency-report.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  admissions: wrap(
    (req) => inpatientEmergencyReportService.getAdmissionsReport(req.query, req.auth),
    'Lay bao cao nhap vien thanh cong.',
  ),
  discharges: wrap(
    (req) => inpatientEmergencyReportService.getDischargesReport(req.query, req.auth),
    'Lay bao cao xuat vien thanh cong.',
  ),
  bedOccupancy: wrap(
    (req) => inpatientEmergencyReportService.getBedOccupancyReport(req.query, req.auth),
    'Lay bao cao cong suat giuong thanh cong.',
  ),
  bedTurnover: wrap(
    (req) => inpatientEmergencyReportService.getBedTurnoverReport(req.query, req.auth),
    'Lay bao cao vong quay giuong thanh cong.',
  ),
  lengthOfStay: wrap(
    (req) => inpatientEmergencyReportService.getLengthOfStayReport(req.query, req.auth),
    'Lay bao cao thoi gian nam vien thanh cong.',
  ),
  inpatientTasks: wrap(
    (req) => inpatientEmergencyReportService.getInpatientTasksReport(req.query, req.auth),
    'Lay bao cao task noi tru thanh cong.',
  ),
  emergencyCases: wrap(
    (req) => inpatientEmergencyReportService.getEmergencyCasesReport(req.query, req.auth),
    'Lay bao cao ca cap cuu thanh cong.',
  ),
  responseTime: wrap(
    (req) => inpatientEmergencyReportService.getResponseTimeReport(req.query, req.auth),
    'Lay bao cao thoi gian phan ung cap cuu thanh cong.',
  ),
  caseResolution: wrap(
    (req) => inpatientEmergencyReportService.getCaseResolutionReport(req.query, req.auth),
    'Lay bao cao ket qua xu ly ca cap cuu thanh cong.',
  ),
};
