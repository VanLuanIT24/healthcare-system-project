const encounterService = require('../services/encounter.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  createEncounter: wrap((req) => encounterService.createEncounter(req.body, req.auth, requestMeta(req)), 'Tạo encounter thành công.', 201),
  listEncounters: wrap((req) => encounterService.listEncounters(req.query, req.auth), 'Lấy danh sách encounter thành công.'),
  searchEncounters: wrap((req) => encounterService.searchEncounters(req.query, req.auth), 'Tìm kiếm encounter thành công.'),
  getEncounterDetail: wrap((req) => encounterService.getEncounterDetail(req.params.encounterId, req.auth), 'Lấy chi tiết encounter thành công.'),
  getEncounterSummary: wrap((req) => encounterService.getEncounterSummary({ ...req.query, encounter_id: req.params.encounterId }, req.auth), 'Lấy tổng quan encounter thành công.'),
  getEncounterTimeline: wrap((req) => encounterService.getEncounterTimeline(req.params.encounterId, req.query, req.auth), 'Lấy timeline encounter thành công.'),
  updateEncounter: wrap((req) => encounterService.updateEncounter(req.params.encounterId, req.body, req.auth, requestMeta(req)), 'Cập nhật encounter thành công.'),
  arriveEncounter: wrap((req) => encounterService.arriveEncounter(req.params.encounterId, req.auth, requestMeta(req)), 'Đánh dấu arrived encounter thành công.'),
  startEncounter: wrap((req) => encounterService.startEncounter(req.params.encounterId, req.auth, requestMeta(req)), 'Bắt đầu encounter thành công.'),
  reopenEncounter: wrap((req) => encounterService.reopenEncounter(req.params.encounterId, req.body, req.auth, requestMeta(req)), 'Mở lại encounter thành công.'),
  holdEncounter: wrap((req) => encounterService.holdEncounter(req.params.encounterId, req.body, req.auth, requestMeta(req)), 'Tạm dừng encounter thành công.'),
  resumeEncounter: wrap((req) => encounterService.resumeEncounter(req.params.encounterId, req.auth, requestMeta(req)), 'Tiếp tục encounter thành công.'),
  completeEncounter: wrap((req) => encounterService.completeEncounter(req.params.encounterId, req.body, req.auth, requestMeta(req)), 'Hoàn tất encounter thành công.'),
  cancelEncounter: wrap((req) => encounterService.cancelEncounter(req.params.encounterId, req.body, req.auth, requestMeta(req)), 'Hủy encounter thành công.'),
  createEncounterFromAppointment: wrap(
    (req) => encounterService.createEncounterFromAppointment(req.params.appointmentId, req.auth, requestMeta(req)),
    'Tạo encounter từ appointment thành công.',
  ),
  createEncounterFromQueueTicket: wrap(
    (req) => encounterService.createEncounterFromQueueTicket(req.params.ticketId, req.auth, requestMeta(req)),
    'Tạo encounter từ queue ticket thành công.',
  ),
  linkAppointmentToEncounter: wrap(
    (req) => encounterService.linkAppointmentToEncounter(req.params.encounterId, req.body.appointment_id, req.auth, requestMeta(req)),
    'Liên kết appointment với encounter thành công.',
  ),
  attachQueueTicketToEncounter: wrap(
    (req) => encounterService.attachQueueTicketToEncounter(req.params.encounterId, req.body.queue_ticket_id, req.auth, requestMeta(req)),
    'Liên kết queue ticket với encounter thành công.',
  ),
  getPatientEncounterHistory: wrap((req) => encounterService.getPatientEncounterHistory(req.params.patientId, req.query, req.auth), 'Lấy lịch sử encounter theo bệnh nhân thành công.'),
  getDoctorEncounters: wrap((req) => encounterService.getDoctorEncounters(req.params.doctorId, req.query, req.auth), 'Lấy encounter theo bác sĩ thành công.'),
  getDoctorActiveEncounter: wrap((req) => encounterService.getDoctorActiveEncounter(req.params.doctorId, req.auth), 'Lấy encounter active theo bác sĩ thành công.'),
  getTodayEncounters: wrap((req) => encounterService.getTodayEncounters(req.query, req.auth), 'Lấy encounter hôm nay thành công.'),
  checkEncounterCanStart: wrap((req) => encounterService.checkEncounterCanStart(req.params.encounterId, req.auth), 'Kiểm tra khả năng bắt đầu encounter thành công.'),
  checkEncounterCanComplete: wrap((req) => encounterService.checkEncounterCanComplete(req.params.encounterId, req.auth), 'Kiểm tra khả năng hoàn tất encounter thành công.'),
  checkEncounterEditable: wrap((req) => encounterService.checkEncounterEditable(req.params.encounterId, req.auth), 'Kiểm tra khả năng chỉnh sửa encounter thành công.'),
  checkEncounterHasSignedConsultation: wrap(
    (req) => encounterService.checkEncounterHasSignedConsultation(req.params.encounterId),
    'Kiểm tra consultation đã ký của encounter thành công.',
  ),
  checkEncounterHasActivePrescription: wrap(
    (req) => encounterService.checkEncounterHasActivePrescription(req.params.encounterId),
    'Kiểm tra prescription active của encounter thành công.',
  ),
};
