import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildUrl(path, params) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function createIdempotencyKey(method, path) {
  if (String(method).toUpperCase() !== 'POST') return undefined;
  const randomValue = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `scheduling:${path}:${randomValue}`;
}

async function request(path, { method = 'GET', params, body, auth = true } = {}) {
  const fetcher = auth ? fetchWithAuth : fetch;
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  };
  const idempotencyKey = createIdempotencyKey(method, path);
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  let response;
  try {
    response = await fetcher(buildUrl(path, params), {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error('Không gọi được API lịch khám. Kiểm tra backend http://localhost:3000 có đang chạy không.');
  }
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(payload?.message || 'Phiên đăng nhập nhân sự đã hết hạn hoặc thiếu token truy cập.');
    }
    if (response.status === 403) {
      throw new Error(payload?.message || 'Tài khoản hiện tại chưa có quyền thao tác lịch khám.');
    }
    throw new Error(payload?.message || 'Máy chủ lịch khám trả về lỗi không hợp lệ.');
  }

  return payload?.data;
}

export const schedulingApi = {
  getOperationsDashboardToday: (params) => request('/operations/dashboard/today', { params }),
  getOperationsHourlyFlow: (params) => request('/operations/hourly-flow', { params }),
  getOperationsQueueCurrent: (params) => request('/operations/queue/current', { params }),
  getOperationsQueueBoard: (params) => request('/operations/queue/board', { params }),
  getOperationsQueueToday: (params) => request('/operations/queue/today', { params }),
  getOperationsQueueCallConsole: (params) => request('/operations/queue/call-console', { params }),
  getOperationsQueueTransferCandidates: (params) => request('/operations/queue/transfer-candidates', { params }),
  getOperationsQueueMissedNoShow: (params) => request('/operations/queue/missed-no-show', { params }),
  getOperationsQueueTicketContext: (ticketId, params) =>
    request(`/operations/queue/${encodeURIComponent(ticketId)}/context`, { params }),
  getOperationsQueueAvailableActions: (ticketId, params) =>
    request(`/operations/queue/${encodeURIComponent(ticketId)}/available-actions`, { params }),
  previewQueueTransfer: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/preview-transfer`, { method: 'POST', body }),
  setQueuePriority: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/set-priority`, { method: 'POST', body }),
  getPatientFlowToday: (params) => request('/operations/patient-flow/today', { params }),
  getPatientFlowCheckInMonitor: (params) => request('/operations/patient-flow/check-in-monitor', { params }),
  getPatientFlowWaiting: (params) => request('/operations/patient-flow/waiting', { params }),
  getPatientFlowInConsultation: (params) => request('/operations/patient-flow/in-consultation', { params }),
  getPatientFlowNeedsAction: (params) => request('/operations/patient-flow/needs-action', { params }),
  getPatientFlowCompleted: (params) => request('/operations/patient-flow/completed', { params }),
  getPatientFlowContext: (flowId, params) =>
    request(`/operations/patient-flow/${encodeURIComponent(flowId)}/context`, { params }),
  acknowledgePatientFlowAlert: (alertId, body) =>
    request(`/operations/patient-flow/actions/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body }),
  assignPatientFlowAlertToMe: (alertId, body) =>
    request(`/operations/patient-flow/actions/${encodeURIComponent(alertId)}/assign-to-me`, { method: 'POST', body }),
  resolvePatientFlowAlert: (alertId, body) =>
    request(`/operations/patient-flow/actions/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body }),
  getOperationsResourcesLoad: (params) => request('/operations/resources/load', { params }),
  getOperationsResourceDepartments: (params) => request('/operations/resources/departments', { params }),
  getOperationsResourceDoctors: (params) => request('/operations/resources/doctors', { params }),
  getOperationsResourceRooms: (params) => request('/operations/resources/rooms', { params }),
  getOperationsDoctorLoad: (params) => request('/operations/resources/doctor-load', { params }),
  getOperationsRoomStatus: (params) => request('/operations/resources/room-status', { params }),
  getOperationsResourceAttention: (params) => request('/operations/resources/attention', { params }),
  acknowledgeResourceAttention: (attentionId, body) =>
    request(`/operations/resources/attention/${encodeURIComponent(attentionId)}/acknowledge`, { method: 'POST', body }),
  assignResourceAttention: (attentionId, body) =>
    request(`/operations/resources/attention/${encodeURIComponent(attentionId)}/assign`, { method: 'POST', body }),
  resolveResourceAttention: (attentionId, body) =>
    request(`/operations/resources/attention/${encodeURIComponent(attentionId)}/resolve`, { method: 'POST', body }),
  getOperationsSlotsCapacity: (params) => request('/operations/slots/capacity', { params }),
  getOperationsAlerts: (params) => request('/operations/alerts', { params }),
  getOperationsAlertsSummary: (params) => request('/operations/alerts/summary', { params }),
  getOperationsAlertActionCenter: (params) => request('/operations/alerts/action-center', { params }),
  getOperationsScheduleSlotAlerts: (params) => request('/operations/alerts/schedule-slot', { params }),
  getOperationsQueueAlerts: (params) => request('/operations/alerts/queue', { params }),
  getOperationsDoctorDepartmentAlerts: (params) => request('/operations/alerts/doctor-department', { params }),
  getOperationsNoShowAlerts: (params) => request('/operations/alerts/no-show', { params }),
  getOperationsAlertDetail: (alertId, params) =>
    request(`/operations/alerts/${encodeURIComponent(alertId)}`, { params }),
  acknowledgeOperationAlert: (alertId, body) =>
    request(`/operations/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body }),
  assignOperationAlert: (alertId, body) =>
    request(`/operations/alerts/${encodeURIComponent(alertId)}/assign`, { method: 'POST', body }),
  escalateOperationAlert: (alertId, body) =>
    request(`/operations/alerts/${encodeURIComponent(alertId)}/escalate`, { method: 'POST', body }),
  resolveOperationAlert: (alertId, body) =>
    request(`/operations/alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body }),
  dismissOperationAlert: (alertId, body) =>
    request(`/operations/alerts/${encodeURIComponent(alertId)}/dismiss`, { method: 'POST', body }),
  executeOperationAlertAction: (alertId, body) =>
    request(`/operations/alerts/${encodeURIComponent(alertId)}/execute-action`, { method: 'POST', body }),
  getOperationsActionItems: (params) => request('/operations/action-items', { params }),
  listDepartments: (params) => request('/departments', { params }),
  listActiveDepartments: (params) => request('/departments/active', { params }),
  getDepartmentOperationalSummary: (departmentId, params) =>
    request(`/departments/${encodeURIComponent(departmentId)}/summary`, { params }),
  getDepartmentStaff: (departmentId, params) =>
    request(`/departments/${encodeURIComponent(departmentId)}/staff`, { params }),
  getDepartmentFutureSchedules: (departmentId, params) =>
    request(`/departments/${encodeURIComponent(departmentId)}/future-schedules`, { params }),
  getDepartmentFutureAppointments: (departmentId, params) =>
    request(`/departments/${encodeURIComponent(departmentId)}/future-appointments`, { params }),
  listDoctorProfiles: (params) => request('/admin/doctor-profiles', { params }),
  listAdminDoctors: (params) => request('/admin/doctors', { params }),
  listFacilityLocations: (params) => request('/directory/clinics', { params }),
  listInpatientRooms: (params) => request('/inpatient/rooms', { params }),
  listImagingRooms: (params) => request('/imaging/rooms', { params }),
  listClinicalAlerts: (params) => request('/clinical-alerts', { params }),
  acknowledgeClinicalAlert: (alertId, body) =>
    request(`/clinical-alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body }),
  resolveClinicalAlert: (alertId, body) =>
    request(`/clinical-alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body }),
  dismissClinicalAlert: (alertId, body) =>
    request(`/clinical-alerts/${encodeURIComponent(alertId)}/dismiss`, { method: 'POST', body }),
  listDiagnosticAlerts: (params) => request('/diagnostic-alerts', { params }),
  getDiagnosticAlertsSummary: (params) => request('/diagnostic-alerts/summary', { params }),
  acknowledgeDiagnosticAlert: (alertId, body) =>
    request(`/diagnostic-alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body }),
  assignDiagnosticAlert: (alertId, body) =>
    request(`/diagnostic-alerts/${encodeURIComponent(alertId)}/assign`, { method: 'POST', body }),
  resolveDiagnosticAlert: (alertId, body) =>
    request(`/diagnostic-alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body }),
  dismissDiagnosticAlert: (alertId, body) =>
    request(`/diagnostic-alerts/${encodeURIComponent(alertId)}/dismiss`, { method: 'POST', body }),
  getScheduleOperationalList: (params) => request('/schedules/operational-list', { params }),
  getScheduleCalendar: (params) => request('/schedules/calendar', { params }),
  getScheduleConflicts: (params) => request('/schedules/conflicts', { params }),
  scanScheduleConflicts: (body) => request('/schedules/conflicts/scan', { method: 'POST', body }),
  getSystemSummary: (params) => request('/schedules/summary/system', { params }),
  getDepartmentSummary: (params) => request('/schedules/summary/departments', { params }),
  getDateRangeSummary: (params) => request('/schedules/summary/date-range', { params }),
  getCreateOptions: (params) => request('/schedules/options', { params }),
  listSchedules: (params) => request('/schedules', { params }),
  getScheduleDetail: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}`),
  getScheduleSummary: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/summary`),
  getScheduleActivity: (scheduleId, params) => request(`/schedules/${encodeURIComponent(scheduleId)}/activity`, { params }),
  getAvailableSlots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/available-slots`, { auth: false }),
  getBookedSlots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/booked-slots`, { auth: false }),
  getScheduleSlots: (scheduleId, params) => request(`/schedules/${encodeURIComponent(scheduleId)}/slots`, { params }),
  getScheduleSlotsAvailable: (scheduleId, params) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/slots/available`, { params }),
  getScheduleSlotsBooked: (scheduleId, params) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/slots/booked`, { params }),
  checkScheduleCanUpdate: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/can-update`),
  checkScheduleCanCancel: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/can-cancel`),
  getScheduleFutureAppointments: (scheduleId, params) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/future-appointments`, { params }),
  getMyTodaySchedule: (params) => request('/schedules/my/today', { params }),
  getMyWeekSchedule: (params) => request('/schedules/my/week', { params }),
  previewCreateSchedule: (body) => request('/schedules/preview-create', { method: 'POST', body }),
  createSchedule: (body) => request('/schedules', { method: 'POST', body }),
  bulkCreateSchedules: (body) => request('/schedules/bulk', { method: 'POST', body }),
  bulkPublishSchedules: (scheduleIds) =>
    request('/schedules/bulk-publish', { method: 'POST', body: { schedule_ids: scheduleIds } }),
  updateSchedule: (scheduleId, body) => request(`/schedules/${encodeURIComponent(scheduleId)}`, { method: 'PATCH', body }),
  publishSchedule: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/publish`, { method: 'POST', body: {} }),
  cancelSchedule: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/cancel`, { method: 'POST', body: {} }),
  completeSchedule: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/complete`, { method: 'POST', body: {} }),
  duplicateSchedule: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/duplicate`, { method: 'POST', body }),
  generateScheduleSlots: (scheduleId) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/slots/generate`, { method: 'POST', body: {} }),
  previewGenerateScheduleSlots: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/slots/preview-generate`, { method: 'POST', body }),
  blockSlot: (scheduleId, body) => request(`/schedules/${encodeURIComponent(scheduleId)}/block-slot`, { method: 'POST', body }),
  reopenSlot: (scheduleId, body) => request(`/schedules/${encodeURIComponent(scheduleId)}/reopen-slot`, { method: 'POST', body }),
  batchBlockSlots: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/block-slots`, { method: 'POST', body }),
  batchReopenSlots: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/reopen-slots`, { method: 'POST', body }),
  previewImpact: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/preview-impact`, { method: 'POST', body }),
  getScheduleUtilization: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/utilization`),
  listScheduleSlots: (params) => request('/schedule-slots', { params }),
  getScheduleSlot: (slotId) => request(`/schedule-slots/${encodeURIComponent(slotId)}`),
  getScheduleSlotPatients: (slotId, params) => request(`/schedule-slots/${encodeURIComponent(slotId)}/patients`, { params }),
  getScheduleSlotTimeline: (slotId, params) => request(`/schedule-slots/${encodeURIComponent(slotId)}/timeline`, { params }),
  holdScheduleSlot: (slotId, body) => request(`/schedule-slots/${encodeURIComponent(slotId)}/hold`, { method: 'POST', body }),
  releaseScheduleSlotHold: (slotId, body) =>
    request(`/schedule-slots/${encodeURIComponent(slotId)}/release-hold`, { method: 'POST', body }),
  blockScheduleSlotById: (slotId, body) => request(`/schedule-slots/${encodeURIComponent(slotId)}/block`, { method: 'POST', body }),
  reopenScheduleSlotById: (slotId, body) => request(`/schedule-slots/${encodeURIComponent(slotId)}/reopen`, { method: 'POST', body }),
  updateScheduleSlotCapacity: (slotId, body) => request(`/schedule-slots/${encodeURIComponent(slotId)}/capacity`, { method: 'PATCH', body }),
  bulkBlockScheduleSlots: (body) => request('/schedule-slots/bulk-block', { method: 'POST', body }),
  bulkReopenScheduleSlots: (body) => request('/schedule-slots/bulk-reopen', { method: 'POST', body }),
  previewScheduleSlotBlocking: (body) => request('/schedule-slots/blocking/preview', { method: 'POST', body }),
  getScheduleSlotUtilization: (params) => request('/schedule-slots/utilization', { params }),
  getScheduleSlotActivity: (params) => request('/schedule-slots/activity', { params }),
  getScheduleSlotImportTemplate: (params) => request('/schedule-slots/import-template', { params }),
  previewScheduleSlotImport: (body) => request('/schedule-slots/import-excel/preview', { method: 'POST', body }),
  importScheduleSlots: (body) => request('/schedule-slots/import-excel', { method: 'POST', body }),
  exportScheduleSlots: (params) => request('/schedule-slots/export', { params }),
  listAppointments: (params) => request('/appointments', { params }),
  searchAppointments: (params) => request('/appointments/search', { params }),
  getAppointmentSummary: (params) => request('/appointments/summary', { params }),
  getTodayAppointments: (params) => request('/appointments/today', { params }),
  getUpcomingAppointments: (params) => request('/appointments/upcoming', { params }),
  getAppointmentDetail: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}`),
  getAppointmentTimeline: (appointmentId, params) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/timeline`, { params }),
  confirmAppointment: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/confirm`, { method: 'POST', body: {} }),
  cancelAppointment: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, { method: 'POST', body }),
  rescheduleAppointment: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/reschedule`, { method: 'POST', body }),
  checkInAppointment: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/check-in`, { method: 'POST', body: {} }),
  markAppointmentNoShow: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/no-show`, { method: 'POST', body: {} }),
  createAppointmentByStaff: (body) => request('/appointments/staff-create', { method: 'POST', body }),
  bulkConfirmAppointments: (appointmentIds) =>
    request('/appointments/bulk-confirm', { method: 'POST', body: { appointment_ids: appointmentIds } }),
  bulkCancelAppointments: (appointmentIds, body = {}) =>
    request('/appointments/bulk-cancel', { method: 'POST', body: { ...body, appointment_ids: appointmentIds } }),
  validateAppointmentSlot: (body) => request('/appointments/validate-slot', { method: 'POST', body }),
  checkDoctorAvailability: (body) => request('/appointments/check-doctor-availability', { method: 'POST', body }),
  checkPatientDuplicate: (body) => request('/appointments/check-patient-duplicate', { method: 'POST', body }),
  checkDoctorConflict: (body) => request('/appointments/check-doctor-conflict', { method: 'POST', body }),
  checkPatientConflict: (body) => request('/appointments/check-patient-conflict', { method: 'POST', body }),
  listAppointmentWaitlist: (params) => request('/appointments/waitlist', { params }),
  offerWaitlistSlot: (waitlistId, body) =>
    request(`/appointments/waitlist/${encodeURIComponent(waitlistId)}/offer-slot`, { method: 'POST', body }),
  bookWaitlist: (waitlistId, body) =>
    request(`/appointments/waitlist/${encodeURIComponent(waitlistId)}/book`, { method: 'POST', body }),
  cancelWaitlist: (waitlistId, body) =>
    request(`/appointments/waitlist/${encodeURIComponent(waitlistId)}/cancel`, { method: 'POST', body }),
  getQueueSummaryToday: (params) => request('/queue/summary/today', { params }),
  listQueueTickets: (params) => request('/queue', { params }),
  getQueueTicket: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}`),
  getQueueTimeline: (ticketId, params) => request(`/queue/${encodeURIComponent(ticketId)}/timeline`, { params }),
  callNextQueue: (body) => request('/queue/call-next', { method: 'POST', body }),
  callQueueTicket: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/call`, { method: 'POST', body: {} }),
  recallQueueTicket: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/recall`, { method: 'POST', body: {} }),
  skipQueueTicket: (ticketId, body) => request(`/queue/${encodeURIComponent(ticketId)}/skip`, { method: 'POST', body }),
  startQueueService: (ticketId) =>
    request(`/queue/${encodeURIComponent(ticketId)}/start-service`, { method: 'POST', body: {} }),
  completeQueueTicket: (ticketId) =>
    request(`/queue/${encodeURIComponent(ticketId)}/complete`, { method: 'POST', body: {} }),
  cancelQueueTicket: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/cancel`, { method: 'POST', body }),
  markQueueNoShow: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/mark-no-show`, { method: 'POST', body }),
  reorderQueuePriority: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/reorder-priority`, { method: 'POST', body }),
  transferQueueTicket: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/transfer`, { method: 'POST', body }),
  getDepartmentQueueBoard: (departmentId, params) =>
    request(`/queue/department/${encodeURIComponent(departmentId)}/board`, { params }),
  getDoctorQueueBoard: (doctorId, params) =>
    request(`/queue/doctor/${encodeURIComponent(doctorId)}/board`, { params }),
  getPublicQueueBoard: (params) => request('/queue/public/board', { params, auth: false }),
  createQueueTicket: (body) => request('/queue', { method: 'POST', body }),
  checkInPatientToQueue: (body) => request('/queue/check-in', { method: 'POST', body }),
  createQueueFromAppointment: (appointmentId, body = {}) =>
    request(`/queue/appointment/${encodeURIComponent(appointmentId)}`, { method: 'POST', body }),
  generateQueueQr: (ticketId, body = {}) =>
    request(`/queue/${encodeURIComponent(ticketId)}/generate-qr`, { method: 'POST', body }),
  getNursingQueueBoard: (params) => request('/nursing/queue/board', { params }),
  getNursingQueueMetrics: (params) => request('/nursing/queue/metrics', { params }),
  getNursingIntakeDashboard: (params) => request('/nursing/intake/dashboard', { params }),
  getNursingIntakeWorklist: (params) => request('/nursing/intake/worklist', { params }),
  getNursingQueueContext: (ticketId, params) =>
    request(`/nursing/queue/${encodeURIComponent(ticketId)}/context`, { params }),
  getNursingQueueAvailableActions: (ticketId, params) =>
    request(`/nursing/queue/${encodeURIComponent(ticketId)}/available-actions`, { params }),
  getNursingReadyForDoctor: (params) => request('/nursing/ready-for-doctor', { params }),
  getNursingPendingPatients: (params) => request('/nursing/pending-patients', { params }),
  getNursingPriorityAlerts: (params) => request('/nursing/priority-alerts', { params }),
  getNursingAbnormalVitals: (params) => request('/nursing/vitals/abnormal', { params }),
  markQueueWaitingNurse: (ticketId, body = {}) =>
    request(`/nursing/queue/${encodeURIComponent(ticketId)}/mark-waiting-nurse`, { method: 'POST', body }),
  markQueueTriageDone: (ticketId, body = {}) =>
    request(`/nursing/queue/${encodeURIComponent(ticketId)}/mark-triage-done`, { method: 'POST', body }),
  markQueueVitalDone: (ticketId, body = {}) =>
    request(`/nursing/queue/${encodeURIComponent(ticketId)}/mark-vital-done`, { method: 'POST', body }),
  markQueueReadyForDoctor: (ticketId, body = {}) =>
    request(`/nursing/queue/${encodeURIComponent(ticketId)}/mark-ready-for-doctor`, { method: 'POST', body }),
  unmarkQueueReadyForDoctor: (ticketId, body = {}) =>
    request(`/nursing/queue/${encodeURIComponent(ticketId)}/unmark-ready-for-doctor`, { method: 'POST', body }),
  notifyDoctorQueue: (ticketId, body = {}) =>
    request(`/nursing/queue/${encodeURIComponent(ticketId)}/notify-doctor`, { method: 'POST', body }),
  getOperationsReportDashboard: (params) => request('/operations/reports/dashboard', { params }),
  getOperationsReportInsights: (params) => request('/operations/reports/insights', { params }),
  getOperationsReportCompare: (params) => request('/operations/reports/compare', { params }),
  getOperationsReportAppointments: (params) => request('/operations/reports/appointments', { params }),
  getOperationsReportAppointmentsDrilldown: (params) => request('/operations/reports/appointments/drilldown', { params }),
  getOperationsReportQueue: (params) => request('/operations/reports/queue', { params }),
  getOperationsReportQueueHeatmap: (params) => request('/operations/reports/queue/heatmap', { params }),
  getOperationsReportQueueSla: (params) => request('/operations/reports/queue/sla', { params }),
  getOperationsReportUtilization: (params) => request('/operations/reports/utilization', { params }),
  getOperationsReportNoShow: (params) => request('/operations/reports/no-show', { params }),
  getOperationsReportNoShowRisk: (params) => request('/operations/reports/no-show/patients-risk', { params }),
  previewOperationsReportExport: (body) => request('/operations/reports/export-preview', { method: 'POST', body }),
  createOperationsReportExportRequest: (body) => request('/operations/reports/export-requests', { method: 'POST', body }),
  listOperationsReportExportRequests: (params) => request('/operations/reports/export-requests', { params }),
  getReportAppointments: (params) => request('/reports/appointments', { params }),
  getReportQueue: (params) => request('/reports/queue', { params }),
  getReportDepartments: (params) => request('/reports/departments', { params }),
  getReportDoctors: (params) => request('/reports/doctors', { params }),
  exportReport: (params) => request('/reports/export', { params }),
  getOperationsActivity: (params) => request('/operations/activity', { params }),
  getOperationsActivityDoctorSchedules: (params) => request('/operations/activity/doctor-schedules', { params }),
  getOperationsActivityAppointments: (params) => request('/operations/activity/appointments', { params }),
  getOperationsActivitySlots: (params) => request('/operations/activity/slots', { params }),
  getOperationsActivityQueue: (params) => request('/operations/activity/queue', { params }),
  getOperationsActivityCheckIn: (params) => request('/operations/activity/check-in', { params }),
  getOperationsActivityDetail: (activityId, params) =>
    request(`/operations/activity/${encodeURIComponent(activityId)}`, { params }),
  exportOperationsActivity: (params) => request('/operations/activity/export', { params }),
  listAuditLogs: (params) => request('/audit', { params }),
  exportAuditLogs: (params) => request('/audit/export', { params }),
  getAuditLog: (auditLogId) => request(`/audit/${encodeURIComponent(auditLogId)}`),
  getAuditActorLogs: (actorType, actorId, params) =>
    request(`/audit/actor/${encodeURIComponent(actorType)}/${encodeURIComponent(actorId)}`, { params }),
  getAuditEntityLogs: (targetType, targetId, params) =>
    request(`/audit/entity/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, { params }),
  getSchedulingConfigOverview: (params) => request('/scheduling-config/overview', { params }),
  getSchedulingConfigSettings: (params) => request('/scheduling-config/settings', { params }),
  updateSchedulingConfigSettings: (body) => request('/scheduling-config/settings', { method: 'PATCH', body }),
  getSchedulingConfigScheduleTypes: (params) => request('/scheduling-config/schedule-types', { params }),
  createSchedulingConfigScheduleType: (body) => request('/scheduling-config/schedule-types', { method: 'POST', body }),
  updateSchedulingConfigScheduleType: (id, body) =>
    request(`/scheduling-config/schedule-types/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  getSchedulingConfigTemplates: (params) => request('/scheduling-config/templates', { params }),
  createSchedulingConfigTemplate: (body) => request('/scheduling-config/templates', { method: 'POST', body }),
  previewSchedulingConfigTemplate: (id, body) =>
    request(`/scheduling-config/templates/${encodeURIComponent(id)}/preview`, { method: 'POST', body }),
  applySchedulingConfigTemplate: (id, body) =>
    request(`/scheduling-config/templates/${encodeURIComponent(id)}/apply`, { method: 'POST', body }),
  getSchedulingConfigSlotRules: (params) => request('/scheduling-config/slot-rules', { params }),
  updateSchedulingConfigSlotRules: (body) => request('/scheduling-config/slot-rules', { method: 'PATCH', body }),
  testSchedulingConfigSlotRules: (body) => request('/scheduling-config/slot-rules/test', { method: 'POST', body }),
  getSchedulingConfigBookingRules: (params) => request('/scheduling-config/booking-rules', { params }),
  updateSchedulingConfigBookingRules: (body) => request('/scheduling-config/booking-rules', { method: 'PATCH', body }),
  testSchedulingConfigBookingRules: (body) => request('/scheduling-config/booking-rules/test', { method: 'POST', body }),
  getSchedulingConfigCheckInRules: (params) => request('/scheduling-config/check-in-rules', { params }),
  updateSchedulingConfigCheckInRules: (body) => request('/scheduling-config/check-in-rules', { method: 'PATCH', body }),
  testSchedulingConfigCheckInRules: (body) => request('/scheduling-config/check-in-rules/test', { method: 'POST', body }),
  getSchedulingConfigCancelRules: (params) => request('/scheduling-config/cancel-reschedule-no-show', { params }),
  updateSchedulingConfigCancelRules: (body) => request('/scheduling-config/cancel-reschedule-no-show', { method: 'PATCH', body }),
  previewSchedulingConfigCancelRuleImpact: (body) =>
    request('/scheduling-config/cancel-reschedule-no-show/impact-preview', { method: 'POST', body }),
  getSchedulingConfigQueueRules: (params) => request('/scheduling-config/queue-rules', { params }),
  updateSchedulingConfigQueueRules: (body) => request('/scheduling-config/queue-rules', { method: 'PATCH', body }),
  simulateSchedulingConfigQueueRules: (body) => request('/scheduling-config/queue-rules/simulate-call-next', { method: 'POST', body }),
  getSchedulingConfigExceptions: (params) => request('/scheduling-config/exceptions', { params }),
  createSchedulingConfigException: (body) => request('/scheduling-config/exceptions', { method: 'POST', body }),
  previewSchedulingConfigExceptionImpact: (body) => request('/scheduling-config/exceptions/preview-impact', { method: 'POST', body }),
  getSchedulingConfigTelehealth: (params) => request('/scheduling-config/telehealth', { params }),
  updateSchedulingConfigTelehealth: (body) => request('/scheduling-config/telehealth', { method: 'PATCH', body }),
  testSchedulingConfigTelehealthProvider: (body) => request('/scheduling-config/telehealth/test-provider', { method: 'POST', body }),
  getSchedulingConfigNotifications: (params) => request('/scheduling-config/notifications', { params }),
  updateSchedulingConfigNotifications: (body) => request('/scheduling-config/notifications', { method: 'PATCH', body }),
  testSchedulingConfigNotification: (body) => request('/scheduling-config/notifications/test', { method: 'POST', body }),
  listSystemSettings: (params) => request('/admin/settings', { params }),
  createSystemSetting: (body) => request('/admin/settings', { method: 'POST', body }),
  getGroupedSystemSettings: (params) => request('/admin/settings/grouped', { params }),
  getSystemSetting: (settingKey) => request(`/admin/settings/${encodeURIComponent(settingKey)}`),
  updateSystemSetting: (settingKey, body) => request(`/admin/settings/${encodeURIComponent(settingKey)}`, { method: 'PATCH', body }),
};
