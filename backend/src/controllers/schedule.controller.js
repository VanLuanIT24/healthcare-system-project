const scheduleService = require('../services/schedule.service');
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
  createDoctorSchedule: wrap((req) => scheduleService.createDoctorSchedule(req.body, req.auth, requestMeta(req)), 'Tạo lịch làm việc bác sĩ thành công.', 201),
  listDoctorSchedules: wrap((req) => scheduleService.listDoctorSchedules(req.query), 'Lấy danh sách lịch làm việc thành công.'),
  bulkCreateDoctorSchedules: wrap(
    (req) => scheduleService.bulkCreateDoctorSchedules(req.body, req.auth, requestMeta(req)),
    'Tạo hàng loạt lịch làm việc bác sĩ thành công.',
    201,
  ),
  getDoctorScheduleDetail: wrap((req) => scheduleService.getDoctorScheduleDetail(req.params.scheduleId), 'Lấy chi tiết lịch làm việc thành công.'),
  getDoctorScheduleSummary: wrap((req) => scheduleService.getDoctorScheduleSummary(req.params.scheduleId), 'Lấy tổng quan lịch làm việc thành công.'),
  updateDoctorSchedule: wrap((req) => scheduleService.updateDoctorSchedule(req.params.scheduleId, req.body, req.auth, requestMeta(req)), 'Cập nhật lịch làm việc thành công.'),
  publishDoctorSchedule: wrap((req) => scheduleService.publishDoctorSchedule(req.params.scheduleId, req.auth, requestMeta(req)), 'Mở lịch làm việc thành công.'),
  bulkPublishDoctorSchedules: wrap(
    (req) => scheduleService.bulkPublishDoctorSchedules(req.body.schedule_ids, req.auth, requestMeta(req)),
    'Publish hàng loạt lịch làm việc thành công.',
  ),
  cancelDoctorSchedule: wrap((req) => scheduleService.cancelDoctorSchedule(req.params.scheduleId, req.auth, requestMeta(req)), 'Hủy lịch làm việc thành công.'),
  completeDoctorSchedule: wrap((req) => scheduleService.completeDoctorSchedule(req.params.scheduleId, req.auth, requestMeta(req)), 'Hoàn tất lịch làm việc thành công.'),
  duplicateDoctorSchedule: wrap((req) => scheduleService.duplicateDoctorSchedule(req.params.scheduleId, req.body, req.auth, requestMeta(req)), 'Sao chép lịch làm việc thành công.', 201),
  getAvailableSlots: wrap((req) => scheduleService.getAvailableSlots(req.params.scheduleId), 'Lấy danh sách slot trống thành công.'),
  blockScheduleSlot: wrap((req) => scheduleService.blockScheduleSlot(req.params.scheduleId, req.body, req.auth, requestMeta(req)), 'Chặn slot thành công.'),
  reopenScheduleSlot: wrap((req) => scheduleService.reopenScheduleSlot(req.params.scheduleId, req.body, req.auth, requestMeta(req)), 'Mở lại slot thành công.'),
  getBookedSlots: wrap((req) => scheduleService.getBookedSlots(req.params.scheduleId), 'Lấy danh sách slot đã đặt thành công.'),
  checkScheduleCanBeUpdated: wrap((req) => scheduleService.checkScheduleCanBeUpdated(req.params.scheduleId), 'Kiểm tra khả năng cập nhật lịch làm việc thành công.'),
  checkScheduleCanBeCancelled: wrap((req) => scheduleService.checkScheduleCanBeCancelled(req.params.scheduleId), 'Kiểm tra khả năng hủy lịch làm việc thành công.'),
  checkDoctorHasFutureAppointmentsInSchedule: wrap(
    (req) => scheduleService.checkDoctorHasFutureAppointmentsInSchedule(req.params.scheduleId),
    'Kiểm tra lịch hẹn tương lai trong lịch làm việc thành công.',
  ),
  listSchedulesByDoctor: wrap((req) => scheduleService.listSchedulesByDoctor(req.params.doctorId, req.query), 'Lấy lịch theo bác sĩ thành công.'),
  listSchedulesByDepartment: wrap((req) => scheduleService.listSchedulesByDepartment(req.params.departmentId, req.query), 'Lấy lịch theo department thành công.'),
  listSchedulesByDateRange: wrap((req) => scheduleService.listSchedulesByDateRange(req.query.date_from, req.query.date_to, req.query), 'Lấy lịch theo khoảng ngày thành công.'),
  getDoctorCalendarView: wrap((req) => scheduleService.getDoctorCalendarView(req.params.doctorId, req.query), 'Lấy calendar view của bác sĩ thành công.'),
  getScheduleUtilization: wrap((req) => scheduleService.getScheduleUtilization(req.params.scheduleId), 'Lấy tỷ lệ sử dụng lịch thành công.'),
};
