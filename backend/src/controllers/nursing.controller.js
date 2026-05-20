const nursingDashboardService = require('../services/nursing-dashboard.service');
const nursingPreparationService = require('../services/nursing-preparation.service');
const nursingClinicalCommandService = require('../services/nursing-clinical-command.service');
const nursingPatientLookupService = require('../services/nursing-patient-lookup.service');
const nursingTaskService = require('../services/nursing-task.service');
const nursingHandoffService = require('../services/nursing-handoff.service');
const vitalCorrectionService = require('../services/vital-correction.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');
const { NURSING_WORKFLOW_STATUS } = require('../constants/statuses');

module.exports = {
  getPatientSnapshot: wrap(
    (req) => nursingPatientLookupService.getPatientSnapshot(req.params.patientId, req.auth),
    'Lấy snapshot tra cứu bệnh nhân thành công.',
  ),
  getPatientProfileCenter: wrap(
    (req) => nursingPatientLookupService.getProfileCenter(req.params.patientId, req.auth),
    'Lấy trung tâm hồ sơ bệnh nhân thành công.',
  ),
  getPatientEncounterHistory: wrap(
    (req) => nursingPatientLookupService.getEncounterHistory(req.params.patientId, req.query, req.auth),
    'Lấy lịch sử encounter cho điều dưỡng thành công.',
  ),
  getPatientVitalHistory: wrap(
    (req) => nursingPatientLookupService.getVitalHistory(req.params.patientId, req.query, req.auth),
    'Lấy lịch sử sinh hiệu cho điều dưỡng thành công.',
  ),
  getPatientClinicalRisks: wrap(
    (req) => nursingPatientLookupService.getClinicalRisks(req.params.patientId, req.auth),
    'Lấy risk center lâm sàng bệnh nhân thành công.',
  ),
  getPatientDocumentCenter: wrap(
    (req) => nursingPatientLookupService.getDocumentCenter(req.params.patientId, req.query, req.auth),
    'Lấy document center bệnh nhân thành công.',
  ),
  getEncounterSnapshot: wrap(
    (req) => nursingPatientLookupService.getEncounterSnapshot(req.params.encounterId, req.auth),
    'Lấy snapshot encounter cho điều dưỡng thành công.',
  ),
  checkDuplicateAllergy: wrap(
    (req) => nursingPatientLookupService.checkDuplicateAllergy(req.params.patientId, req.body, req.auth),
    'Kiểm tra trùng dị ứng thành công.',
  ),
  checkDuplicateProblem: wrap(
    (req) => nursingPatientLookupService.checkDuplicateProblem(req.params.patientId, req.body, req.auth),
    'Kiểm tra trùng problem thành công.',
  ),
  getClinicalCommandCenter: wrap(
    (req) => nursingClinicalCommandService.getMonitoringCommandCenter(req.query, req.auth),
    'Lấy command center theo dõi điều dưỡng thành công.',
  ),
  listMonitoringSessions: wrap(
    (req) => nursingClinicalCommandService.listMonitoringSessions(req.query, req.auth),
    'Lấy danh sách phiên theo dõi điều dưỡng thành công.',
  ),
  createMonitoringSession: wrap(
    (req) => nursingClinicalCommandService.createMonitoringSession(req.body, req.auth, requestMeta(req)),
    'Tạo phiên theo dõi điều dưỡng thành công.',
    201,
  ),
  getMonitoringSession: wrap(
    (req) => nursingClinicalCommandService.getMonitoringSession(req.params.monitoringId, req.auth),
    'Lấy phiên theo dõi điều dưỡng thành công.',
  ),
  updateMonitoringSession: wrap(
    (req) => nursingClinicalCommandService.updateMonitoringSession(req.params.monitoringId, req.body, req.auth, requestMeta(req)),
    'Cập nhật phiên theo dõi điều dưỡng thành công.',
  ),
  addMonitoringCheck: wrap(
    (req) => nursingClinicalCommandService.addMonitoringCheck(req.params.monitoringId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận check theo dõi điều dưỡng thành công.',
    201,
  ),
  assignMonitoringSession: wrap(
    (req) => nursingClinicalCommandService.assignMonitoringSession(req.params.monitoringId, req.body, req.auth, requestMeta(req)),
    'Phân công phiên theo dõi điều dưỡng thành công.',
  ),
  notifyDoctorFromMonitoring: wrap(
    (req) => nursingClinicalCommandService.notifyDoctorFromMonitoring(req.params.monitoringId, req.body, req.auth, requestMeta(req)),
    'Báo bác sĩ từ phiên theo dõi thành công.',
  ),
  escalateMonitoringSession: wrap(
    (req) => nursingClinicalCommandService.escalateMonitoringSession(req.params.monitoringId, req.body, req.auth, requestMeta(req)),
    'Escalate phiên theo dõi điều dưỡng thành công.',
  ),
  markMonitoringStable: wrap(
    (req) => nursingClinicalCommandService.markMonitoringStable(req.params.monitoringId, req.body, req.auth, requestMeta(req)),
    'Đánh dấu bệnh nhân ổn định thành công.',
  ),
  resolveMonitoringSession: wrap(
    (req) => nursingClinicalCommandService.resolveMonitoringSession(req.params.monitoringId, req.body, req.auth, requestMeta(req)),
    'Resolve phiên theo dõi điều dưỡng thành công.',
  ),
  cancelMonitoringSession: wrap(
    (req) => nursingClinicalCommandService.cancelMonitoringSession(req.params.monitoringId, req.body, req.auth, requestMeta(req)),
    'Hủy phiên theo dõi điều dưỡng thành công.',
  ),
  getMonitoringTimeline: wrap(
    (req) => nursingClinicalCommandService.getMonitoringTimeline(req.params.monitoringId, req.auth),
    'Lấy timeline phiên theo dõi thành công.',
  ),
  listDoctorNotifications: wrap(
    (req) => nursingClinicalCommandService.listDoctorNotifications(req.query, req.auth),
    'Lấy danh sách báo bác sĩ thành công.',
  ),
  createDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.createDoctorNotificationRequest(req.body, req.auth, requestMeta(req)),
    'Tạo yêu cầu báo bác sĩ thành công.',
    201,
  ),
  getDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.getDoctorNotificationRequest(req.params.doctorNotificationId, req.auth),
    'Lấy yêu cầu báo bác sĩ thành công.',
  ),
  updateDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.updateDoctorNotificationRequest(req.params.doctorNotificationId, req.body, req.auth, requestMeta(req)),
    'Cập nhật yêu cầu báo bác sĩ thành công.',
  ),
  sendDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.sendDoctorNotificationRequest(req.params.doctorNotificationId, req.body, req.auth, requestMeta(req)),
    'Gửi yêu cầu báo bác sĩ thành công.',
  ),
  markDoctorNotificationSeen: wrap(
    (req) => nursingClinicalCommandService.markDoctorNotificationSeen(req.params.doctorNotificationId, req.body, req.auth, requestMeta(req)),
    'Đánh dấu bác sĩ đã xem thành công.',
  ),
  acknowledgeDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.acknowledgeDoctorNotification(req.params.doctorNotificationId, req.body, req.auth, requestMeta(req)),
    'Bác sĩ xác nhận yêu cầu thành công.',
  ),
  respondDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.respondDoctorNotification(req.params.doctorNotificationId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận phản hồi bác sĩ thành công.',
  ),
  escalateDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.escalateDoctorNotification(req.params.doctorNotificationId, req.body, req.auth, requestMeta(req)),
    'Escalate yêu cầu báo bác sĩ thành công.',
  ),
  closeDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.closeDoctorNotification(req.params.doctorNotificationId, req.body, req.auth, requestMeta(req)),
    'Đóng yêu cầu báo bác sĩ thành công.',
  ),
  cancelDoctorNotification: wrap(
    (req) => nursingClinicalCommandService.cancelDoctorNotification(req.params.doctorNotificationId, req.body, req.auth, requestMeta(req)),
    'Hủy yêu cầu báo bác sĩ thành công.',
  ),
  getDoctorNotificationTimeline: wrap(
    (req) => nursingClinicalCommandService.getDoctorNotificationTimeline(req.params.doctorNotificationId, req.auth),
    'Lấy timeline báo bác sĩ thành công.',
  ),
  listClinicalAlerts: wrap(
    (req) => nursingClinicalCommandService.listClinicalAlerts(req.query, req.auth),
    'Lấy danh sách cảnh báo lâm sàng thành công.',
  ),
  createClinicalAlert: wrap(
    (req) => nursingClinicalCommandService.createClinicalAlert(req.body, req.auth, requestMeta(req)),
    'Tạo cảnh báo lâm sàng thành công.',
    201,
  ),
  getClinicalAlert: wrap(
    (req) => nursingClinicalCommandService.getClinicalAlert(req.params.clinicalAlertId, req.auth),
    'Lấy cảnh báo lâm sàng thành công.',
  ),
  acknowledgeClinicalAlert: wrap(
    (req) => nursingClinicalCommandService.acknowledgeClinicalAlert(req.params.clinicalAlertId, req.body, req.auth, requestMeta(req)),
    'Xác nhận cảnh báo lâm sàng thành công.',
  ),
  notifyDoctorClinicalAlert: wrap(
    (req) => nursingClinicalCommandService.notifyDoctorClinicalAlert(req.params.clinicalAlertId, req.body, req.auth, requestMeta(req)),
    'Báo bác sĩ từ cảnh báo lâm sàng thành công.',
  ),
  escalateClinicalAlert: wrap(
    (req) => nursingClinicalCommandService.escalateClinicalAlert(req.params.clinicalAlertId, req.body, req.auth, requestMeta(req)),
    'Escalate cảnh báo lâm sàng thành công.',
  ),
  resolveClinicalAlert: wrap(
    (req) => nursingClinicalCommandService.resolveClinicalAlert(req.params.clinicalAlertId, req.body, req.auth, requestMeta(req)),
    'Resolve cảnh báo lâm sàng thành công.',
  ),
  dismissClinicalAlert: wrap(
    (req) => nursingClinicalCommandService.dismissClinicalAlert(req.params.clinicalAlertId, req.body, req.auth, requestMeta(req)),
    'Dismiss cảnh báo lâm sàng thành công.',
  ),
  evaluateEncounterAlerts: wrap(
    (req) => nursingClinicalCommandService.evaluateEncounterAlerts(req.params.encounterId, req.auth, requestMeta(req)),
    'Đánh giá cảnh báo theo encounter thành công.',
  ),
  evaluateVitalSignAlert: wrap(
    (req) => nursingClinicalCommandService.evaluateVitalSign(req.params.vitalSignId, req.auth, requestMeta(req)),
    'Đánh giá cảnh báo theo sinh hiệu thành công.',
  ),
  listPostProcedure: wrap(
    (req) => nursingClinicalCommandService.listPostProcedure(req.query, req.auth),
    'Lấy danh sách theo dõi hậu thủ thuật thành công.',
  ),
  getPostProcedure: wrap(
    (req) => nursingClinicalCommandService.getPostProcedure(req.params.procedureOrderId, req.auth),
    'Lấy chi tiết theo dõi hậu thủ thuật thành công.',
  ),
  addPostProcedureObservation: wrap(
    (req) => nursingClinicalCommandService.addPostProcedureObservation(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận hậu thủ thuật thành công.',
    201,
  ),
  markPostProcedureStable: wrap(
    (req) => nursingClinicalCommandService.markPostProcedureStable(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)),
    'Đánh dấu hậu thủ thuật ổn định thành công.',
  ),
  notifyDoctorPostProcedure: wrap(
    (req) => nursingClinicalCommandService.notifyDoctorPostProcedure(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)),
    'Báo bác sĩ hậu thủ thuật thành công.',
  ),
  escalatePostProcedure: wrap(
    (req) => nursingClinicalCommandService.escalatePostProcedure(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)),
    'Escalate hậu thủ thuật thành công.',
  ),
  createEmergencyFromPostProcedure: wrap(
    (req) => nursingClinicalCommandService.createEmergencyFromPostProcedure(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)),
    'Tạo ca khẩn từ hậu thủ thuật thành công.',
    201,
  ),
  listPostMedication: wrap(
    (req) => nursingClinicalCommandService.listMedicationAdministrations(req.query, req.auth),
    'Lấy danh sách theo dõi sau dùng thuốc thành công.',
  ),
  addMedicationReaction: wrap(
    (req) => nursingClinicalCommandService.addMedicationReaction(req.params.administrationId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận phản ứng sau dùng thuốc thành công.',
    201,
  ),
  getPreparationWorklist: wrap(
    (req) => nursingPreparationService.listPreparationsWorklist(req.query, req.auth),
    'Lấy worklist chuẩn bị dịch vụ thành công.',
  ),
  getPreparationDashboardSummary: wrap(
    (req) => nursingPreparationService.getDashboardSummary(req.query, req.auth),
    'Lấy tổng quan chuẩn bị dịch vụ thành công.',
  ),
  getPreparationDetail: wrap(
    (req) => nursingPreparationService.getPreparationDetail(req.params.preparationId, req.auth),
    'Lấy chi tiết chuẩn bị dịch vụ thành công.',
  ),
  getPreparationChecklist: wrap(
    (req) => nursingPreparationService.getPreparationChecklist(req.params.preparationId, req.auth),
    'Lấy checklist chuẩn bị dịch vụ thành công.',
  ),
  getPreparationTimeline: wrap(
    (req) => nursingPreparationService.getPreparationTimeline(req.params.preparationId, req.auth),
    'Lấy timeline chuẩn bị dịch vụ thành công.',
  ),
  getPreparationContext: wrap(
    (req) => nursingPreparationService.getPreparationContext(req.params.preparationId, req.auth),
    'Lấy ngữ cảnh chuẩn bị dịch vụ thành công.',
  ),
  createServicePreparationFromOrder: wrap(
    (req) => nursingPreparationService.createPreparationFromOrder(req.params.orderId, req.body, req.auth, requestMeta(req)),
    'Tạo ca chuẩn bị dịch vụ từ order thành công.',
    201,
  ),
  createPreExamPreparationFromEncounter: wrap(
    (req) => nursingPreparationService.createPreExamFromEncounter(req.params.encounterId, req.body, req.auth, requestMeta(req)),
    'Tạo ca chuẩn bị trước khám thành công.',
    201,
  ),
  assignPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'assign', req.body, req.auth, requestMeta(req)),
    'Phân công ca chuẩn bị dịch vụ thành công.',
  ),
  startPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'start', req.body, req.auth, requestMeta(req)),
    'Bắt đầu chuẩn bị dịch vụ thành công.',
  ),
  blockPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'block', req.body, req.auth, requestMeta(req)),
    'Block ca chuẩn bị dịch vụ thành công.',
  ),
  unblockPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'unblock', req.body, req.auth, requestMeta(req)),
    'Gỡ block ca chuẩn bị dịch vụ thành công.',
  ),
  readyPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'ready', req.body, req.auth, requestMeta(req)),
    'Đánh dấu sẵn sàng thành công.',
  ),
  transferPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'transfer', req.body, req.auth, requestMeta(req)),
    'Chuyển ca chuẩn bị dịch vụ thành công.',
  ),
  completeServicePreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'complete', req.body, req.auth, requestMeta(req)),
    'Hoàn tất ca chuẩn bị dịch vụ thành công.',
  ),
  cancelPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'cancel', req.body, req.auth, requestMeta(req)),
    'Hủy ca chuẩn bị dịch vụ thành công.',
  ),
  notifyDoctorPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'notify-doctor', req.body, req.auth, requestMeta(req)),
    'Báo bác sĩ từ ca chuẩn bị dịch vụ thành công.',
  ),
  notifyDestinationPreparation: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'notify-destination', req.body, req.auth, requestMeta(req)),
    'Báo điểm đến từ ca chuẩn bị dịch vụ thành công.',
  ),
  addPreparationNote: wrap(
    (req) => nursingPreparationService.transitionPreparation(req.params.preparationId, 'add-note', req.body, req.auth, requestMeta(req)),
    'Thêm ghi chú chuẩn bị dịch vụ thành công.',
  ),
  patchPreparationChecklistItem: wrap(
    (req) => nursingPreparationService.updateChecklistItem(req.params.preparationId, req.params.itemId, req.body, req.auth, requestMeta(req)),
    'Cập nhật mục checklist chuẩn bị thành công.',
  ),
  donePreparationChecklistItem: wrap(
    (req) => nursingPreparationService.updateChecklistItem(req.params.preparationId, req.params.itemId, req.body, req.auth, requestMeta(req), 'done'),
    'Hoàn tất mục checklist chuẩn bị thành công.',
  ),
  failPreparationChecklistItem: wrap(
    (req) => nursingPreparationService.updateChecklistItem(req.params.preparationId, req.params.itemId, req.body, req.auth, requestMeta(req), 'failed'),
    'Đánh dấu fail mục checklist chuẩn bị thành công.',
  ),
  waivePreparationChecklistItem: wrap(
    (req) => nursingPreparationService.updateChecklistItem(req.params.preparationId, req.params.itemId, req.body, req.auth, requestMeta(req), 'waived'),
    'Waive mục checklist chuẩn bị thành công.',
  ),
  attachPreparationChecklistEvidence: wrap(
    (req) => nursingPreparationService.attachChecklistEvidence(req.params.preparationId, req.params.itemId, req.body, req.auth, requestMeta(req)),
    'Gắn bằng chứng checklist chuẩn bị thành công.',
  ),
  printPreparationSpecimenLabel: wrap(
    (req) => nursingPreparationService.printSpecimenLabel(req.params.preparationId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận in nhãn mẫu thành công.',
  ),
  scanPreparationSpecimenLabel: wrap(
    (req) => nursingPreparationService.scanSpecimenLabel(req.params.preparationId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận quét nhãn mẫu thành công.',
  ),
  handoffPreparationLab: wrap(
    (req) => nursingPreparationService.handoffLab(req.params.preparationId, req.body, req.auth, requestMeta(req)),
    'Bàn giao mẫu cho lab thành công.',
  ),
  requestPreparationRecollect: wrap(
    (req) => nursingPreparationService.requestRecollect(req.params.preparationId, req.body, req.auth, requestMeta(req)),
    'Yêu cầu lấy lại mẫu thành công.',
  ),
  linkPreparationConsent: wrap(
    (req) => nursingPreparationService.linkConsent(req.params.preparationId, req.body, req.auth, requestMeta(req)),
    'Liên kết consent chuẩn bị thành công.',
  ),
  bulkAssignPreparations: wrap(
    (req) => nursingPreparationService.bulkAssign(req.body, req.auth, requestMeta(req)),
    'Phân công hàng loạt chuẩn bị dịch vụ thành công.',
  ),
  bulkStartPreparations: wrap(
    (req) => nursingPreparationService.bulkStart(req.body, req.auth, requestMeta(req)),
    'Bắt đầu hàng loạt chuẩn bị dịch vụ thành công.',
  ),
  bulkReadyPreparations: wrap(
    (req) => nursingPreparationService.bulkReady(req.body, req.auth, requestMeta(req)),
    'Đánh dấu sẵn sàng hàng loạt thành công.',
  ),
  bulkNotifyPreparations: wrap(
    (req) => nursingPreparationService.bulkNotify(req.body, req.auth, requestMeta(req)),
    'Báo hàng loạt từ chuẩn bị dịch vụ thành công.',
  ),
  bulkTransferPreparations: wrap(
    (req) => nursingPreparationService.bulkTransfer(req.body, req.auth, requestMeta(req)),
    'Chuyển hàng loạt chuẩn bị dịch vụ thành công.',
  ),
  bulkPrintPreparations: wrap(
    (req) => nursingPreparationService.bulkPrint(req.body, req.auth, requestMeta(req)),
    'Tạo batch in chuẩn bị dịch vụ thành công.',
  ),
  listPreparationChecklistTemplates: wrap(
    (req) => nursingPreparationService.listChecklistTemplates(req.query, req.auth),
    'Lấy template checklist chuẩn bị thành công.',
  ),
  createPreparationChecklistTemplate: wrap(
    (req) => nursingPreparationService.createChecklistTemplate(req.body, req.auth, requestMeta(req)),
    'Tạo template checklist chuẩn bị thành công.',
    201,
  ),
  updatePreparationChecklistTemplate: wrap(
    (req) => nursingPreparationService.updateChecklistTemplate(req.params.templateId, req.body, req.auth, requestMeta(req)),
    'Cập nhật template checklist chuẩn bị thành công.',
  ),
  clonePreparationChecklistTemplate: wrap(
    (req) => nursingPreparationService.cloneChecklistTemplate(req.params.templateId, req.body, req.auth, requestMeta(req)),
    'Clone template checklist chuẩn bị thành công.',
    201,
  ),
  previewPreparationChecklistTemplate: wrap(
    (req) => nursingPreparationService.previewChecklistTemplate(req.query, req.auth),
    'Preview checklist chuẩn bị thành công.',
  ),
  getDashboardOverview: wrap(
    (req) => nursingDashboardService.getOverview(req.query, req.auth),
    'Lấy dashboard điều dưỡng thành công.',
  ),
  getDashboardKpis: wrap(
    (req) => nursingDashboardService.getKpis(req.query, req.auth),
    'Lấy KPI điều dưỡng thành công.',
  ),
  getDashboardWorklist: wrap(
    (req) => nursingDashboardService.getWorklist(req.query, req.auth),
    'Lấy worklist điều dưỡng thành công.',
  ),
  getPriorityAlerts: wrap(
    (req) => nursingDashboardService.getPriorityAlerts(req.query, req.auth),
    'Lấy cảnh báo ưu tiên điều dưỡng thành công.',
  ),
  getTopbarBootstrap: wrap(
    (req) => nursingDashboardService.getTopbarBootstrap(req.query, req.auth),
    'Lấy bootstrap topbar điều dưỡng thành công.',
  ),
  search: wrap(
    (req) => nursingDashboardService.search(req.query, req.auth),
    'Tìm kiếm command điều dưỡng thành công.',
  ),
  getShiftSummary: wrap(
    (req) => nursingDashboardService.getShiftSummary(req.query, req.auth),
    'Lấy tóm tắt ca trực điều dưỡng thành công.',
  ),
  getPendingPatients: wrap(
    (req) => nursingDashboardService.getPendingPatients(req.query, req.auth),
    'Lấy danh sách bệnh nhân chờ xử lý thành công.',
  ),
  getPendingPatientsSummary: wrap(
    (req) => nursingDashboardService.getPendingPatientsSummary(req.query, req.auth),
    'Lấy tổng quan bệnh nhân chờ xử lý thành công.',
  ),
  getPendingPatientsPriorityLane: wrap(
    (req) => nursingDashboardService.getPendingPatientsPriorityLane(req.query, req.auth),
    'Lấy priority lane bệnh nhân chờ xử lý thành công.',
  ),
  getIntakeDashboard: wrap(
    (req) => nursingDashboardService.getIntakeDashboard(req.query, req.auth),
    'Lấy dashboard tiếp nhận điều dưỡng thành công.',
  ),
  getIntakeWorklist: wrap(
    (req) => nursingDashboardService.getIntakeWorklist(req.query, req.auth),
    'Lấy worklist tiếp nhận điều dưỡng thành công.',
  ),
  getQueueContext: wrap(
    (req) => nursingDashboardService.getQueueContext(req.params.ticketId, req.auth),
    'Lấy ngữ cảnh tiếp nhận bệnh nhân thành công.',
  ),
  getQueueAvailableActions: wrap(
    (req) => nursingDashboardService.getQueueContext(req.params.ticketId, req.auth).then((context) => context.available_actions),
    'Lấy hành động khả dụng cho queue thành công.',
  ),
  claimQueueIntake: wrap(
    (req) => nursingDashboardService.claimQueueIntake(req.params.ticketId, req.auth, requestMeta(req)),
    'Nhận tiếp nhận bệnh nhân thành công.',
  ),
  releaseQueueIntake: wrap(
    (req) => nursingDashboardService.releaseQueueIntake(req.params.ticketId, req.auth, requestMeta(req)),
    'Trả tiếp nhận bệnh nhân thành công.',
  ),
  startQueueIntake: wrap(
    (req) => nursingDashboardService.startQueueIntake(req.params.ticketId, req.auth, requestMeta(req)),
    'Bắt đầu tiếp nhận bệnh nhân thành công.',
  ),
  completeQueueIntake: wrap(
    (req) => nursingDashboardService.completeQueueIntake(req.params.ticketId, req.body, req.auth, requestMeta(req)),
    'Hoàn tất tiếp nhận bệnh nhân thành công.',
  ),
  assignWorkItemToMe: wrap(
    (req) => nursingDashboardService.assignWorkItemToMe(req.params.workItemId, req.auth, requestMeta(req)),
    'Nhận xử lý work item thành công.',
  ),
  completeWorkItem: wrap(
    (req) => nursingDashboardService.completeWorkItem(req.params.workItemId, req.body, req.auth, requestMeta(req)),
    'Hoàn tất work item thành công.',
  ),
  getPendingVitals: wrap(
    (req) => nursingDashboardService.getPendingVitals(req.query, req.auth),
    'Lấy danh sách chờ đo sinh hiệu thành công.',
  ),
  getAbnormalVitals: wrap(
    (req) => nursingDashboardService.getAbnormalVitals(req.query, req.auth),
    'Lấy danh sách sinh hiệu bất thường thành công.',
  ),
  getPendingTriage: wrap(
    (req) => nursingDashboardService.getPendingTriage(req.query, req.auth),
    'Lấy danh sách chờ triage thành công.',
  ),
  getTriageWorklist: wrap(
    (req) => nursingDashboardService.getTriageWorklist(req.query, req.auth),
    'Lấy worklist triage điều dưỡng thành công.',
  ),
  getLatestTriageByQueue: wrap(
    (req) => nursingDashboardService.getLatestTriageByQueue(req.params.ticketId, req.auth),
    'Lấy phiếu triage mới nhất theo queue thành công.',
  ),
  createTriageAssessment: wrap(
    (req) => nursingDashboardService.createTriageAssessment(req.body, req.auth, requestMeta(req)),
    'Tạo phiếu triage điều dưỡng thành công.',
    201,
  ),
  updateTriageAssessment: wrap(
    (req) => nursingDashboardService.updateTriageAssessment(req.params.triageId, req.body, req.auth, requestMeta(req)),
    'Cập nhật phiếu triage điều dưỡng thành công.',
  ),
  startTriageAssessment: wrap(
    (req) => nursingDashboardService.startTriageAssessment(req.params.triageId, req.auth, requestMeta(req)),
    'Bắt đầu phiếu triage điều dưỡng thành công.',
  ),
  completeTriageAssessment: wrap(
    (req) => nursingDashboardService.completeTriageAssessment(req.params.triageId, req.body, req.auth, requestMeta(req)),
    'Hoàn tất phiếu triage điều dưỡng thành công.',
  ),
  cancelTriageAssessment: wrap(
    (req) => nursingDashboardService.cancelTriageAssessment(req.params.triageId, req.body, req.auth, requestMeta(req)),
    'Hủy phiếu triage điều dưỡng thành công.',
  ),
  markTriageEnteredInError: wrap(
    (req) => nursingDashboardService.markTriageEnteredInError(req.params.triageId, req.body, req.auth, requestMeta(req)),
    'Đánh dấu phiếu triage nhập sai thành công.',
  ),
  getReadyForDoctor: wrap(
    (req) => nursingDashboardService.getReadyForDoctor(req.query, req.auth),
    'Lấy danh sách sẵn sàng gặp bác sĩ thành công.',
  ),
  unmarkReadyForDoctor: wrap(
    (req) => nursingDashboardService.unmarkReadyForDoctor(req.params.ticketId, req.auth, requestMeta(req)),
    'Thu hồi sẵn sàng gặp bác sĩ thành công.',
  ),
  notifyDoctorQueue: wrap(
    (req) => nursingDashboardService.notifyDoctorQueue(req.params.ticketId, req.body, req.auth, requestMeta(req)),
    'Báo bác sĩ bệnh nhân sẵn sàng thành công.',
  ),
  getPendingPreparations: wrap(
    (req) => nursingDashboardService.getPendingPreparations(req.query, req.auth),
    'Lấy danh sách chờ chuẩn bị dịch vụ thành công.',
  ),
  createPreparationFromOrder: wrap(
    (req) => nursingDashboardService.createPreparationFromOrder(req.params.orderId, req.body, req.auth, requestMeta(req)),
    'Tạo checklist chuẩn bị dịch vụ thành công.',
    201,
  ),
  updatePreparationItem: wrap(
    (req) => nursingDashboardService.updatePreparationItem(req.params.preparationId, req.params.itemKey, req.body, req.auth, requestMeta(req)),
    'Cập nhật checklist chuẩn bị dịch vụ thành công.',
  ),
  completePreparation: wrap(
    (req) => nursingDashboardService.completePreparation(req.params.preparationId, req.auth, requestMeta(req)),
    'Hoàn tất checklist chuẩn bị dịch vụ thành công.',
  ),
  acknowledgeVitalAlert: wrap(
    (req) => nursingDashboardService.acknowledgeVitalAlert(req.params.vitalSignId, req.auth, requestMeta(req)),
    'Xác nhận cảnh báo sinh hiệu thành công.',
  ),
  notifyDoctorOfVital: wrap(
    (req) => nursingDashboardService.notifyDoctorOfVital(req.params.vitalSignId, req.auth, requestMeta(req)),
    'Báo bác sĩ về sinh hiệu bất thường thành công.',
  ),
  listVitalCorrections: wrap(
    (req) => vitalCorrectionService.listCorrections(req.query, req.auth),
    'Lấy danh sách yêu cầu sửa sinh hiệu thành công.',
  ),
  getVitalCorrectionDetail: wrap(
    (req) => vitalCorrectionService.getCorrectionDetail(req.params.requestId, req.auth),
    'Lấy chi tiết yêu cầu sửa sinh hiệu thành công.',
  ),
  approveVitalCorrection: wrap(
    (req) => vitalCorrectionService.approveCorrection(req.params.requestId, req.body, req.auth, requestMeta(req)),
    'Duyệt yêu cầu sửa sinh hiệu thành công.',
  ),
  rejectVitalCorrection: wrap(
    (req) => vitalCorrectionService.rejectCorrection(req.params.requestId, req.body, req.auth, requestMeta(req)),
    'Từ chối yêu cầu sửa sinh hiệu thành công.',
  ),
  applyVitalCorrection: wrap(
    (req) => vitalCorrectionService.applyCorrection(req.params.requestId, req.body, req.auth, requestMeta(req)),
    'Áp dụng yêu cầu sửa sinh hiệu thành công.',
  ),
  cancelVitalCorrection: wrap(
    (req) => vitalCorrectionService.cancelCorrection(req.params.requestId, req.body, req.auth, requestMeta(req)),
    'Hủy yêu cầu sửa sinh hiệu thành công.',
  ),
  markQueueWaitingNurse: wrap(
    (req) => nursingDashboardService.markQueueStage(req.params.ticketId, NURSING_WORKFLOW_STATUS.WAITING_NURSE, req.auth, requestMeta(req)),
    'Cập nhật queue chờ điều dưỡng thành công.',
  ),
  markQueueTriageDone: wrap(
    (req) => nursingDashboardService.markQueueStage(req.params.ticketId, NURSING_WORKFLOW_STATUS.TRIAGE_DONE, req.auth, requestMeta(req)),
    'Cập nhật phân loại điều dưỡng thành công.',
  ),
  markQueueVitalDone: wrap(
    (req) => nursingDashboardService.markQueueStage(req.params.ticketId, NURSING_WORKFLOW_STATUS.VITAL_DONE, req.auth, requestMeta(req)),
    'Cập nhật sinh hiệu hoàn tất thành công.',
  ),
  markQueueReadyForDoctor: wrap(
    (req) => nursingDashboardService.markQueueStage(req.params.ticketId, NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR, req.auth, requestMeta(req)),
    'Cập nhật sẵn sàng gặp bác sĩ thành công.',
  ),
  markEncounterReadyForDoctor: wrap(
    (req) => nursingDashboardService.markEncounterReadyForDoctor(req.params.encounterId, req.auth, requestMeta(req)),
    'Đánh dấu encounter sẵn sàng gặp bác sĩ thành công.',
  ),
  listTodayTasks: wrap(
    (req) => nursingDashboardService.listTasks(req.query, req.auth, 'today'),
    'Lấy task điều dưỡng hôm nay thành công.',
  ),
  getTasksBoard: wrap(
    (req) => nursingDashboardService.getTasksBoard(req.query, req.auth),
    'Lấy task board điều dưỡng thành công.',
  ),
  listTasks: wrap(
    (req) => nursingTaskService.listTasks(req.query, req.auth, req.query.scope || 'today'),
    'Lấy danh sách task điều dưỡng thành công.',
  ),
  getTasksSummary: wrap(
    (req) => nursingTaskService.getTaskSummary(req.query, req.auth),
    'Lấy tổng quan task điều dưỡng thành công.',
  ),
  getTaskDetail: wrap(
    (req) => nursingTaskService.getTask(req.params.taskId, req.auth),
    'Lấy chi tiết task điều dưỡng thành công.',
  ),
  listMyTasks: wrap(
    (req) => nursingTaskService.listMyTasks(req.query, req.auth),
    'Lấy task điều dưỡng của tôi thành công.',
  ),
  listOverdueTasks: wrap(
    (req) => nursingTaskService.listOverdueTasks(req.query, req.auth),
    'Lấy task điều dưỡng quá hạn thành công.',
  ),
  listCompletedTasks: wrap(
    (req) => nursingTaskService.listCompletedTasks(req.query, req.auth),
    'Lấy task điều dưỡng đã hoàn tất thành công.',
  ),
  listTasksByPatient: wrap(
    (req) => nursingTaskService.tasksByPatient(req.query, req.auth),
    'Lấy task điều dưỡng theo bệnh nhân thành công.',
  ),
  getTasksPatientMatrix: wrap(
    (req) => nursingTaskService.patientMatrix(req.query, req.auth),
    'Lấy ma trận task theo bệnh nhân thành công.',
  ),
  getTasksWorkload: wrap(
    (req) => nursingTaskService.workload(req.query, req.auth),
    'Lấy workload điều dưỡng thành công.',
  ),
  getTaskAuditTrail: wrap(
    (req) => nursingTaskService.auditTrail(req.params.taskId, req.auth),
    'Lấy audit trail task điều dưỡng thành công.',
  ),
  createTask: wrap(
    (req) => nursingTaskService.createTask(req.body, req.auth, requestMeta(req)),
    'Tạo task điều dưỡng thành công.',
    201,
  ),
  assignTaskToMe: wrap(
    (req) => nursingTaskService.acceptTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Nhận task điều dưỡng thành công.',
  ),
  acceptTask: wrap(
    (req) => nursingTaskService.acceptTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Nhận task điều dưỡng thành công.',
  ),
  startTask: wrap(
    (req) => nursingTaskService.startTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Bắt đầu task điều dưỡng thành công.',
  ),
  blockTask: wrap(
    (req) => nursingTaskService.blockTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Block task điều dưỡng thành công.',
  ),
  resumeTask: wrap(
    (req) => nursingTaskService.resumeTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Tiếp tục task điều dưỡng thành công.',
  ),
  completeTask: wrap(
    (req) => nursingDashboardService.completeTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Hoàn tất task điều dưỡng thành công.',
  ),
  completeTaskV2: wrap(
    (req) => nursingTaskService.completeTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Hoàn tất task điều dưỡng thành công.',
  ),
  reassignTask: wrap(
    (req) => nursingTaskService.reassignTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Giao lại task điều dưỡng thành công.',
  ),
  escalateTask: wrap(
    (req) => nursingTaskService.escalateTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Báo/escalate task điều dưỡng thành công.',
  ),
  remindTask: wrap(
    (req) => nursingTaskService.remindTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Nhắc task điều dưỡng thành công.',
  ),
  extendTask: wrap(
    (req) => nursingTaskService.extendTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Gia hạn task điều dưỡng thành công.',
  ),
  addTaskNote: wrap(
    (req) => nursingTaskService.addTaskNote(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Thêm ghi chú task điều dưỡng thành công.',
  ),
  createTaskClinicalNote: wrap(
    (req) => nursingTaskService.createClinicalNoteFromTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Tạo clinical note từ task thành công.',
    201,
  ),
  reportDoctorFromTask: wrap(
    (req) => nursingTaskService.reportDoctor(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Báo bác sĩ từ task thành công.',
  ),
  addTaskToHandoff: wrap(
    (req) => nursingTaskService.addToHandoff(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Thêm task vào bàn giao thành công.',
  ),
  checkTaskChecklistItem: wrap(
    (req) => nursingTaskService.updateChecklistItem(req.params.taskId, req.params.itemId, req.body, req.auth, requestMeta(req), 'done'),
    'Hoàn tất checklist item task thành công.',
  ),
  skipTaskChecklistItem: wrap(
    (req) => nursingTaskService.updateChecklistItem(req.params.taskId, req.params.itemId, req.body, req.auth, requestMeta(req), 'skipped'),
    'Bỏ qua checklist item task thành công.',
  ),
  cancelTask: wrap(
    (req) => nursingTaskService.cancelTask(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Hủy task điều dưỡng thành công.',
  ),
  reopenTask: wrap(
    (req) => nursingDashboardService.reopenTask(req.params.taskId, req.auth, requestMeta(req)),
    'Mở lại task điều dưỡng thành công.',
  ),
  bulkCompleteTasks: wrap(
    (req) => nursingTaskService.bulkComplete(req.body, req.auth, requestMeta(req)),
    'Hoàn tất hàng loạt task điều dưỡng thành công.',
  ),
  bulkReassignTasks: wrap(
    (req) => nursingTaskService.bulkReassign(req.body, req.auth, requestMeta(req)),
    'Giao lại hàng loạt task điều dưỡng thành công.',
  ),
  bulkAddTasksToHandoff: wrap(
    (req) => nursingTaskService.bulkAddToHandoff(req.body, req.auth, requestMeta(req)),
    'Thêm hàng loạt task vào bàn giao thành công.',
  ),
  createTaskFollowUp: wrap(
    (req) => nursingTaskService.createFollowUp(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Tạo task follow-up thành công.',
    201,
  ),
  requestTaskReview: wrap(
    (req) => nursingTaskService.requestReview(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Yêu cầu review task thành công.',
  ),
  approveTaskReview: wrap(
    (req) => nursingTaskService.approveReview(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Duyệt review task thành công.',
  ),
  rejectTaskReview: wrap(
    (req) => nursingTaskService.rejectReview(req.params.taskId, req.body, req.auth, requestMeta(req)),
    'Yêu cầu chỉnh sửa task thành công.',
  ),
  listHandoffs: wrap(
    (req) => nursingHandoffService.listHandoffs(req.query, req.auth),
    'Lấy danh sách bàn giao ca thành công.',
  ),
  createHandoff: wrap(
    (req) => nursingHandoffService.createHandoff(req.body, req.auth, requestMeta(req)),
    'Tạo bàn giao ca thành công.',
    201,
  ),
  generateHandoffDraft: wrap(
    (req) => nursingHandoffService.generateDraft(req.body, req.auth, requestMeta(req)),
    'Tạo draft bàn giao tự động thành công.',
    201,
  ),
  getActiveHandoffs: wrap(
    (req) => nursingHandoffService.getActiveHandoffs(req.query, req.auth),
    'Lấy bàn giao ca đang hoạt động thành công.',
  ),
  getHandoffHistory: wrap(
    (req) => nursingHandoffService.getHistory(req.query, req.auth),
    'Lấy lịch sử bàn giao ca thành công.',
  ),
  getHandoff: wrap(
    (req) => nursingHandoffService.getHandoff(req.params.handoffId, req.auth),
    'Lấy chi tiết bàn giao ca thành công.',
  ),
  updateHandoff: wrap(
    (req) => nursingHandoffService.updateHandoff(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Cập nhật bàn giao ca thành công.',
  ),
  addHandoffPatient: wrap(
    (req) => nursingHandoffService.addPatient(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Thêm bệnh nhân vào bàn giao ca thành công.',
  ),
  removeHandoffPatient: wrap(
    (req) => nursingHandoffService.removePatient(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Xóa bệnh nhân khỏi bàn giao ca thành công.',
  ),
  attachHandoffTask: wrap(
    (req) => nursingHandoffService.attachTask(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Gắn task vào bàn giao ca thành công.',
  ),
  submitHandoff: wrap(
    (req) => nursingHandoffService.submitHandoff(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Gửi bàn giao ca thành công.',
  ),
  acceptHandoff: wrap(
    (req) => nursingHandoffService.acceptHandoff(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Nhận bàn giao ca thành công.',
  ),
  rejectHandoff: wrap(
    (req) => nursingHandoffService.rejectHandoff(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Từ chối bàn giao ca thành công.',
  ),
  reopenHandoff: wrap(
    (req) => nursingHandoffService.reopenHandoff(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Mở lại bàn giao ca thành công.',
  ),
  acknowledgeHandoffPatient: wrap(
    (req) => nursingHandoffService.ackPatientItem(req.params.handoffId, req.params.itemId, req.body, req.auth, requestMeta(req)),
    'Ack bệnh nhân trong bàn giao thành công.',
  ),
  exportHandoffPdf: wrap(
    (req) => nursingHandoffService.exportPdf(req.params.handoffId, req.auth, requestMeta(req)),
    'Xuất PDF bàn giao ca thành công.',
  ),
  getHandoffAuditTrail: wrap(
    (req) => nursingHandoffService.auditTrail(req.params.handoffId, req.auth),
    'Lấy audit trail bàn giao ca thành công.',
  ),
  cloneHandoff: wrap(
    (req) => nursingHandoffService.cloneHandoff(req.params.handoffId, req.body, req.auth, requestMeta(req)),
    'Clone bàn giao ca thành công.',
    201,
  ),
  getPriorityAlertCenter: wrap(
    (req) => nursingDashboardService.getPriorityAlertCenter(req.query, req.auth),
    'Lấy trung tâm cảnh báo ưu tiên thành công.',
  ),
  getPriorityAlertSummary: wrap(
    (req) => nursingDashboardService.getPriorityAlertSummary(req.query, req.auth),
    'Lấy tổng quan cảnh báo ưu tiên thành công.',
  ),
  getPriorityAlertDetail: wrap(
    (req) => nursingDashboardService.getPriorityAlertDetail(req.params.alertId, req.query, req.auth),
    'Lấy chi tiết cảnh báo ưu tiên thành công.',
  ),
  acknowledgePriorityAlert: wrap(
    (req) => nursingDashboardService.updatePriorityAlertAction(req.params.alertId, 'acknowledge', req.body, req.auth, requestMeta(req)),
    'Xác nhận cảnh báo ưu tiên thành công.',
  ),
  assignPriorityAlertToMe: wrap(
    (req) => nursingDashboardService.updatePriorityAlertAction(req.params.alertId, 'assign_to_me', req.body, req.auth, requestMeta(req)),
    'Nhận xử lý cảnh báo ưu tiên thành công.',
  ),
  notifyDoctorPriorityAlert: wrap(
    (req) => nursingDashboardService.updatePriorityAlertAction(req.params.alertId, 'notify_doctor', req.body, req.auth, requestMeta(req)),
    'Báo bác sĩ từ cảnh báo ưu tiên thành công.',
  ),
  resolvePriorityAlert: wrap(
    (req) => nursingDashboardService.updatePriorityAlertAction(req.params.alertId, 'resolve', req.body, req.auth, requestMeta(req)),
    'Resolve cảnh báo ưu tiên thành công.',
  ),
  dismissPriorityAlert: wrap(
    (req) => nursingDashboardService.updatePriorityAlertAction(req.params.alertId, 'dismiss', req.body, req.auth, requestMeta(req)),
    'Bỏ qua cảnh báo ưu tiên thành công.',
  ),
  getNursingQueueBoard: wrap(
    (req) => nursingDashboardService.getNursingQueueBoard(req.query, req.auth),
    'Lấy queue realtime điều dưỡng thành công.',
  ),
  getNursingQueueMetrics: wrap(
    (req) => nursingDashboardService.getNursingQueueMetrics(req.query, req.auth),
    'Lấy queue metrics điều dưỡng thành công.',
  ),
};
