const dashboardService = require('../services/reception-dashboard.service');
const searchService = require('../services/reception-search.service');
const worklistService = require('../services/reception-worklist.service');
const checkinService = require('../services/reception-checkin.service');
const routingService = require('../services/reception-routing.service');
const printService = require('../services/reception-print.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getBootstrap: wrap((req) => dashboardService.getBootstrap(req.auth), 'Lấy bootstrap lễ tân thành công.'),
  getDashboard: wrap((req) => dashboardService.getDashboard(req.query, req.auth), 'Lấy dashboard lễ tân thành công.'),
  getSidebarCounters: wrap((req) => dashboardService.getSidebarCounters(req.query, req.auth), 'Lấy counters sidebar lễ tân thành công.'),
  getActivityFeed: wrap((req) => dashboardService.getActivityFeed(req.query, req.auth), 'Lấy activity feed lễ tân thành công.'),
  getUpcomingAppointments: wrap((req) => dashboardService.getUpcomingAppointments(req.query, req.auth), 'Lấy lịch hẹn sắp tới cho lễ tân thành công.'),
  getWaitingPatients: wrap((req) => dashboardService.getWaitingPatients(req.query, req.auth), 'Lấy bệnh nhân đang chờ thành công.'),
  getQueueBoard: wrap((req) => dashboardService.getQueueBoard(req.query, req.auth), 'Lấy queue board lễ tân thành công.'),
  getNotifications: wrap((req) => dashboardService.getNotifications(req.query, req.auth), 'Lấy thông báo lễ tân thành công.'),
  getPatientCard: wrap((req) => dashboardService.getPatientCard(req.params.patientId, req.query, req.auth), 'Lấy patient card lễ tân thành công.'),
  getRecentCheckins: wrap((req) => checkinService.recentCheckins(req.query, req.auth), 'Lấy check-in gần đây thành công.'),
  getCheckinErrors: wrap((req) => checkinService.checkinErrors(req.query, req.auth), 'Lấy lỗi check-in thành công.'),
  retryCheckinError: wrap((req) => checkinService.retryCheckinError(req.params.checkinErrorId, req.body, req.auth, requestMeta(req)), 'Retry check-in thành công.'),
  resolveCheckinError: wrap((req) => checkinService.resolveCheckinError(req.params.checkinErrorId, req.body, req.auth, requestMeta(req)), 'Resolve lỗi check-in thành công.'),

  globalSearch: wrap((req) => searchService.globalSearch(req.query, req.auth), 'Tìm kiếm lễ tân thành công.'),
  searchPatients: wrap((req) => searchService.searchPatients(req.query, req.auth), 'Tìm bệnh nhân cho lễ tân thành công.'),
  lookupPhone: wrap((req) => searchService.lookupPhone(req.query, req.auth), 'Tra cứu SĐT thành công.'),
  lookupNationalId: wrap((req) => searchService.lookupNationalId(req.query, req.auth), 'Tra cứu CCCD thành công.'),
  recentLookups: wrap((req) => searchService.recentLookups(req.query, req.auth), 'Lấy lịch sử tra cứu thành công.'),

  getWorklist: wrap((req) => worklistService.getWorklist(req.query, req.auth), 'Lấy worklist lễ tân thành công.'),
  assignWorklistItem: wrap((req) => worklistService.assignWorklistItem(req.params.itemId, req.body, req.auth, requestMeta(req)), 'Giao việc thành công.'),
  resolveWorklistItem: wrap((req) => worklistService.resolveWorklistItem(req.params.itemId, req.body, req.auth, requestMeta(req)), 'Resolve việc thành công.'),
  snoozeWorklistItem: wrap((req) => worklistService.snoozeWorklistItem(req.params.itemId, req.body, req.auth, requestMeta(req)), 'Snooze việc thành công.'),

  quickCheckin: wrap((req) => checkinService.quickCheckin(req.body, req.auth, requestMeta(req)), 'Quick check-in thành công.', 201),
  previewQrCheckin: wrap((req) => checkinService.previewQrCheckin(req.body, req.auth, requestMeta(req)), 'Preview QR check-in thành công.'),
  qrCheckin: wrap((req) => checkinService.qrCheckin(req.body, req.auth, requestMeta(req)), 'QR check-in thành công.', 201),
  walkInCheckin: wrap((req) => checkinService.walkInCheckin(req.body, req.auth, requestMeta(req)), 'Walk-in check-in thành công.', 201),

  getRoutingOptions: wrap((req) => routingService.getRoutingOptions(req.query, req.auth), 'Lấy lựa chọn chuyển tuyến thành công.'),
  routePatient: wrap((req) => routingService.routePatient(req.body, req.auth, requestMeta(req)), 'Chuyển tuyến bệnh nhân thành công.', 201),
  routeToNursing: wrap((req) => routingService.routeToNursing(req.body, req.auth, requestMeta(req)), 'Chuyển điều dưỡng thành công.', 201),
  routeToDoctor: wrap((req) => routingService.routeToDoctor(req.body, req.auth, requestMeta(req)), 'Chuyển bác sĩ thành công.', 201),
  routeToCashier: wrap((req) => routingService.routeToCashier(req.body, req.auth, requestMeta(req)), 'Chuyển thu ngân thành công.', 201),
  routeToClinical: wrap((req) => routingService.routePatient({ ...req.body, destination: 'clinical' }, req.auth, requestMeta(req)), 'Chuyển cận lâm sàng thành công.', 201),
  routeToPharmacy: wrap((req) => routingService.routePatient({ ...req.body, destination: 'pharmacy' }, req.auth, requestMeta(req)), 'Chuyển nhà thuốc thành công.', 201),
  getRoutingHistory: wrap((req) => routingService.getRoutingHistory(req.query, req.auth), 'Lấy lịch sử chuyển tuyến thành công.'),
  getClinicalRoutingReadiness: wrap((req) => routingService.getClinicalRoutingReadiness(req.params.patientId, req.query, req.auth), 'Lấy readiness cận lâm sàng thành công.'),
  getPharmacyRoutingReadiness: wrap((req) => routingService.getPharmacyRoutingReadiness(req.params.patientId, req.query, req.auth), 'Lấy readiness nhà thuốc thành công.'),

  getPrintTemplates: wrap(() => printService.getPrintTemplates(), 'Lấy mẫu in lễ tân thành công.'),
  printQueueTicket: wrap((req) => printService.queueTicketPrintPayload(req.params.ticketId, req.body, req.auth, requestMeta(req)), 'Tạo phiếu in queue thành công.', 201),
  printAppointmentSlip: wrap((req) => printService.appointmentSlipPrintPayload(req.params.appointmentId, req.body, req.auth, requestMeta(req)), 'Tạo phiếu in lịch hẹn thành công.', 201),
  printPaymentGuide: wrap((req) => printService.paymentGuidePrintPayload(req.params.invoiceId, req.body, req.auth, requestMeta(req)), 'Tạo phiếu hướng dẫn thanh toán thành công.', 201),
  printPatientCard: wrap((req) => printService.patientCardPrintPayload(req.params.patientId, req.body, req.auth, requestMeta(req)), 'Tạo thẻ bệnh nhân thành công.', 201),
  logPrint: wrap((req) => printService.logPrint(req.body, req.auth, requestMeta(req)), 'Ghi nhận log in thành công.', 201),

  getDailyOverviewReport: wrap((req) => dashboardService.getDailyOverviewReport(req.query, req.auth), 'Lấy báo cáo tổng quan ngày thành công.'),
  getVisitsReport: wrap((req) => dashboardService.getDailyOverviewReport(req.query, req.auth), 'Lấy báo cáo lượt tiếp đón thành công.'),
  getCheckinsReport: wrap((req) => dashboardService.getDailyOverviewReport(req.query, req.auth), 'Lấy báo cáo check-in thành công.'),
  getNoShowsReport: wrap((req) => dashboardService.getDailyOverviewReport(req.query, req.auth), 'Lấy báo cáo no-show thành công.'),
  getWaitTimesReport: wrap((req) => dashboardService.getDailyOverviewReport(req.query, req.auth), 'Lấy báo cáo thời gian chờ thành công.'),
  getRoutingReport: wrap((req) => dashboardService.getDailyOverviewReport(req.query, req.auth), 'Lấy báo cáo chuyển tuyến thành công.'),
  getCounterPerformanceReport: wrap((req) => dashboardService.getDailyOverviewReport(req.query, req.auth), 'Lấy báo cáo hiệu suất quầy thành công.'),
};
