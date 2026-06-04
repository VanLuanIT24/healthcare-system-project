const doctorWorkspaceService = require('../services/doctor-workspace.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  getOverview: wrap(
    (req) => doctorWorkspaceService.getOverview(req.query, req.auth),
    'Lấy tổng quan Doctor Workspace thành công.',
  ),
  search: wrap(
    (req) => doctorWorkspaceService.searchWorkspace(req.query, req.auth),
    'Tìm kiếm Doctor Workspace thành công.',
  ),
  getQueue: wrap(
    (req) => doctorWorkspaceService.getQueue(req.query, req.auth),
    'Lấy queue bác sĩ thành công.',
  ),
  getTodaySchedule: wrap(
    (req) => doctorWorkspaceService.getTodaySchedule(req.query, req.auth),
    'Lấy lịch khám hôm nay của bác sĩ thành công.',
  ),
  getDoctorPatients: wrap(
    (req) => doctorWorkspaceService.getDoctorPatients(req.query, req.auth),
    'Lấy danh sách bệnh nhân của bác sĩ thành công.',
  ),
  getDoctorEncounters: wrap(
    (req) => doctorWorkspaceService.getDoctorEncounters(req.query, req.auth),
    'Lấy encounter workspace của bác sĩ thành công.',
  ),
  getTasks: wrap(
    (req) => doctorWorkspaceService.getTasks(req.query, req.auth),
    'Lấy việc cần hoàn tất của bác sĩ thành công.',
  ),
  getResults: wrap(
    (req) => doctorWorkspaceService.getResults(req.query, req.auth),
    'Lấy inbox kết quả của bác sĩ thành công.',
  ),
  getPatientSummary: wrap(
    (req) => doctorWorkspaceService.getPatientSummary(req.params.patientId, req.query, req.auth),
    'Lấy tóm tắt lâm sàng bệnh nhân thành công.',
  ),
  getCollaboration: wrap(
    (req) => doctorWorkspaceService.getCollaboration(req.query, req.auth),
    'Lấy trao đổi lâm sàng của bác sĩ thành công.',
  ),
};
