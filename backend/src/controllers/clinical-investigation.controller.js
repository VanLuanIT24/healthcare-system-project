const clinicalInvestigationService = require('../services/clinical-investigation.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  patientOverview: wrap(
    (req) => clinicalInvestigationService.getPatientOverview(req.params.patientId, req.query, req.auth),
    'Lấy tổng hợp cận lâm sàng theo bệnh nhân thành công.',
  ),
  patientSnapshot: wrap(
    (req) => clinicalInvestigationService.getPatientSnapshot(req.params.patientId, req.query, req.auth),
    'Lấy snapshot cận lâm sàng theo bệnh nhân thành công.',
  ),
  patientResultMatrix: wrap(
    (req) => clinicalInvestigationService.getPatientResultMatrix(req.params.patientId, req.query, req.auth),
    'Lấy ma trận kết quả cận lâm sàng theo bệnh nhân thành công.',
  ),
  patientTimeline: wrap(
    (req) => clinicalInvestigationService.getPatientTimeline(req.params.patientId, req.query, req.auth),
    'Lấy timeline cận lâm sàng theo bệnh nhân thành công.',
  ),
  patientPendingActions: wrap(
    (req) => clinicalInvestigationService.getPatientPendingActions(req.params.patientId, req.query, req.auth),
    'Lấy việc cần xử lý cận lâm sàng theo bệnh nhân thành công.',
  ),
  patientCriticalAlerts: wrap(
    (req) => clinicalInvestigationService.getPatientCriticalAlerts(req.params.patientId, req.query, req.auth),
    'Lấy critical alerts theo bệnh nhân thành công.',
  ),
  patientFileGaps: wrap(
    (req) => clinicalInvestigationService.getPatientFileGaps(req.params.patientId, req.query, req.auth),
    'Lấy file gaps theo bệnh nhân thành công.',
  ),
  patientSlaBreaches: wrap(
    (req) => clinicalInvestigationService.getPatientSlaBreaches(req.params.patientId, req.query, req.auth),
    'Lấy SLA breaches theo bệnh nhân thành công.',
  ),
  encounterOverview: wrap(
    (req) => clinicalInvestigationService.getEncounterOverview(req.params.encounterId, req.query, req.auth),
    'Lấy tổng hợp cận lâm sàng theo lượt khám thành công.',
  ),
  encounterResultMatrix: wrap(
    (req) => clinicalInvestigationService.getEncounterResultMatrix(req.params.encounterId, req.query, req.auth),
    'Lấy ma trận kết quả cận lâm sàng theo lượt khám thành công.',
  ),
  encounterTimeline: wrap(
    (req) => clinicalInvestigationService.getEncounterTimeline(req.params.encounterId, req.query, req.auth),
    'Lấy timeline cận lâm sàng theo lượt khám thành công.',
  ),
  encounterPendingActions: wrap(
    (req) => clinicalInvestigationService.getEncounterPendingActions(req.params.encounterId, req.query, req.auth),
    'Lấy việc cần xử lý cận lâm sàng theo lượt khám thành công.',
  ),
};
