const appointmentService = require('../services/appointment.service');
const { errorResponse, successResponse } = require('../utils/http-response');

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

function wrap(serviceMethod, successMessage, statusCode = 200) {
  return async function wrapped(req, res) {
    try {
      const result = await serviceMethod(req, res);
      return successResponse(res, { statusCode, message: successMessage, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  };
}

module.exports = {
  createAppointment: wrap((req) => appointmentService.createAppointment(req.body, req.auth, requestMeta(req)), 'Tạo lịch hẹn thành công.', 201),
  createAppointmentFromPatientPortal: wrap(
    (req) => appointmentService.createAppointmentFromPatientPortal(req.body, req.auth, requestMeta(req)),
    'Bệnh nhân tự đặt lịch thành công.',
    201,
  ),
  createAppointmentByStaff: wrap((req) => appointmentService.createAppointmentByStaff(req.body, req.auth, requestMeta(req)), 'Nhân viên tạo lịch hẹn thành công.', 201),
  listAppointments: wrap((req) => appointmentService.listAppointments(req.query), 'Lấy danh sách lịch hẹn thành công.'),
  searchAppointments: wrap((req) => appointmentService.searchAppointments(req.query), 'Tìm kiếm lịch hẹn thành công.'),
  getAppointmentSummary: wrap((req) => appointmentService.getAppointmentSummary(req.query), 'Lấy thống kê lịch hẹn thành công.'),
  getAppointmentTimeline: wrap((req) => appointmentService.getAppointmentTimeline(req.params.appointmentId, req.query), 'Lấy timeline lịch hẹn thành công.'),
  getAppointmentDetail: wrap((req) => appointmentService.getAppointmentDetail(req.params.appointmentId), 'Lấy chi tiết lịch hẹn thành công.'),
  validateAppointmentSlot: wrap((req) => appointmentService.validateAppointmentSlot(req.body), 'Kiểm tra slot lịch hẹn thành công.'),
  checkDoctorAvailability: wrap((req) => appointmentService.checkDoctorAvailability(req.body), 'Kiểm tra lịch khả dụng của bác sĩ thành công.'),
  checkPatientDuplicateBooking: wrap((req) => appointmentService.checkPatientDuplicateBooking(req.body), 'Kiểm tra đặt lịch trùng của bệnh nhân thành công.'),
  validateAppointmentTime: wrap((req) => ({ appointment_time: appointmentService.validateAppointmentTime(req.body.appointment_time) }), 'Kiểm tra thời gian lịch hẹn thành công.'),
  validateAppointmentStatusTransition: wrap(
    (req) => ({
      valid: appointmentService.validateAppointmentStatusTransition(req.body.current_status, req.body.next_status),
      current_status: req.body.current_status,
      next_status: req.body.next_status,
    }),
    'Kiểm tra chuyển trạng thái lịch hẹn thành công.',
  ),
  checkAppointmentConflictForDoctor: wrap((req) => appointmentService.checkAppointmentConflictForDoctor(req.body), 'Kiểm tra xung đột lịch phía bác sĩ thành công.'),
  checkAppointmentConflictForPatient: wrap((req) => appointmentService.checkAppointmentConflictForPatient(req.body), 'Kiểm tra xung đột lịch phía bệnh nhân thành công.'),
  updateAppointment: wrap((req) => appointmentService.updateAppointment(req.params.appointmentId, req.body, req.auth, requestMeta(req)), 'Cập nhật lịch hẹn thành công.'),
  confirmAppointment: wrap((req) => appointmentService.confirmAppointment(req.params.appointmentId, req.auth, requestMeta(req)), 'Xác nhận lịch hẹn thành công.'),
  bulkConfirmAppointments: wrap((req) => appointmentService.bulkConfirmAppointments(req.body.appointment_ids, req.auth, requestMeta(req)), 'Xác nhận hàng loạt lịch hẹn thành công.'),
  cancelAppointment: wrap((req) => appointmentService.cancelAppointment(req.params.appointmentId, req.body, req.auth, requestMeta(req)), 'Hủy lịch hẹn thành công.'),
  bulkCancelAppointments: wrap(
    (req) => appointmentService.bulkCancelAppointments(req.body.appointment_ids, req.body, req.auth, requestMeta(req)),
    'Hủy hàng loạt lịch hẹn thành công.',
  ),
  rescheduleAppointment: wrap((req) => appointmentService.rescheduleAppointment(req.params.appointmentId, req.body, req.auth, requestMeta(req)), 'Đổi lịch hẹn thành công.'),
  checkInAppointment: wrap((req) => appointmentService.checkInAppointment(req.params.appointmentId, req.auth, requestMeta(req)), 'Check-in lịch hẹn thành công.'),
  markAppointmentNoShow: wrap((req) => appointmentService.markAppointmentNoShow(req.params.appointmentId, req.auth, requestMeta(req)), 'Đánh dấu no-show thành công.'),
  completeAppointment: wrap((req) => appointmentService.completeAppointment(req.params.appointmentId, req.auth, requestMeta(req)), 'Hoàn tất lịch hẹn thành công.'),
  listAppointmentsByPatient: wrap((req) => appointmentService.listAppointmentsByPatient(req.params.patientId, req.query), 'Lấy lịch hẹn theo bệnh nhân thành công.'),
  listAppointmentsByDoctor: wrap((req) => appointmentService.listAppointmentsByDoctor(req.params.doctorId, req.query), 'Lấy lịch hẹn theo bác sĩ thành công.'),
  listAppointmentsByDepartment: wrap((req) => appointmentService.listAppointmentsByDepartment(req.params.departmentId, req.query), 'Lấy lịch hẹn theo department thành công.'),
  listAppointmentsByDate: wrap((req) => appointmentService.listAppointmentsByDate(req.query.date, req.query), 'Lấy lịch hẹn theo ngày thành công.'),
  listUpcomingAppointments: wrap((req) => appointmentService.listUpcomingAppointments(req.query), 'Lấy lịch hẹn sắp tới thành công.'),
  listTodayAppointments: wrap((req) => appointmentService.listTodayAppointments(req.query), 'Lấy lịch hẹn hôm nay thành công.'),
  getMyAppointments: wrap((req) => appointmentService.getMyAppointments(req.auth, req.query), 'Lấy lịch hẹn của tôi thành công.'),
  checkAppointmentCanBeUpdated: wrap((req) => appointmentService.checkAppointmentCanBeUpdated(req.params.appointmentId), 'Kiểm tra khả năng cập nhật lịch hẹn thành công.'),
  checkAppointmentCanBeCancelled: wrap((req) => appointmentService.checkAppointmentCanBeCancelled(req.params.appointmentId), 'Kiểm tra khả năng hủy lịch hẹn thành công.'),
  checkAppointmentCanBeRescheduled: wrap((req) => appointmentService.checkAppointmentCanBeRescheduled(req.params.appointmentId), 'Kiểm tra khả năng đổi lịch hẹn thành công.'),
  checkAppointmentCanBeCheckedIn: wrap((req) => appointmentService.checkAppointmentCanBeCheckedIn(req.params.appointmentId), 'Kiểm tra khả năng check-in lịch hẹn thành công.'),
  createQueueTicketFromAppointment: wrap(
    (req) => appointmentService.createQueueTicketFromAppointment(req.params.appointmentId, req.auth, requestMeta(req)),
    'Sinh queue ticket từ lịch hẹn thành công.',
  ),
  createEncounterFromAppointment: wrap(
    (req) => appointmentService.createEncounterFromAppointment(req.params.appointmentId, req.auth, requestMeta(req)),
    'Sinh encounter từ lịch hẹn thành công.',
  ),
  linkAppointmentToEncounter: wrap(
    (req) => appointmentService.linkAppointmentToEncounter(req.params.appointmentId, req.body.encounter_id, req.auth, requestMeta(req)),
    'Liên kết appointment với encounter thành công.',
  ),
};
