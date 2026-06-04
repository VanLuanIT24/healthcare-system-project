import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function request(path, { method = 'GET', params, body, auth = true } = {}) {
  const response = await (auth ? fetchWithAuth : fetch)(buildUrl(path, params), {
    method,
    headers: body
      ? {
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const apiError = new Error(payload?.message || 'Không thể xử lý dữ liệu tiếp nhận.');
    apiError.status = response.status;
    apiError.payload = payload;
    throw apiError;
  }

  return payload?.data || null;
}

export const receptionQueueApi = {
  globalReceptionSearch: (params) => request('/reception/search/global', { params }),
  searchReceptionPatients: (params) => request('/reception/search/patients', { params }),
  getPatientCard: (patientId) => request(`/reception/patients/${encodeURIComponent(patientId)}/card`),
  getReceptionUpcomingAppointments: (params) => request('/reception/upcoming-appointments', { params }),
  getReceptionWaitingPatients: (params) => request('/reception/waiting-patients', { params }),
  getReceptionQueueBoard: (params) => request('/reception/queue-board', { params }),
  getRecentCheckins: (params) => request('/reception/checkins/recent', { params }),
  getCheckinHistory: (params) => request('/reception/checkins/history', { params }),
  getCheckinErrors: (params) => request('/reception/checkin-errors', { params }),
  retryCheckinError: (checkinErrorId, body) =>
    request(`/reception/checkin-errors/${encodeURIComponent(checkinErrorId)}/retry`, { method: 'POST', body }),
  resolveCheckinError: (checkinErrorId, body) =>
    request(`/reception/checkin-errors/${encodeURIComponent(checkinErrorId)}/resolve`, { method: 'POST', body }),
  quickCheckin: (body) => request('/reception/checkin/quick', { method: 'POST', body }),
  previewQrCheckin: (body) => request('/reception/checkin/qr/preview', { method: 'POST', body }),
  qrCheckin: (body) => request('/reception/checkin/qr', { method: 'POST', body }),
  walkInCheckin: (body) => request('/reception/walk-in-checkin', { method: 'POST', body }),
  getRoutingOptions: (params) => request('/reception/routing-options', { params }),
  routePatient: (body) => request('/reception/route-patient', { method: 'POST', body }),
  routeToNursing: (body) => request('/reception/route-to-nursing', { method: 'POST', body }),
  routeToDoctor: (body) => request('/reception/route-to-doctor', { method: 'POST', body }),
  routeToCashier: (body) => request('/reception/route-to-cashier', { method: 'POST', body }),
  routeToClinical: (body) => request('/reception/route-to-clinical', { method: 'POST', body }),
  routeToPharmacy: (body) => request('/reception/route-to-pharmacy', { method: 'POST', body }),
  getRoutingHistory: (params) => request('/reception/routing-history', { params }),
  getClinicalRoutingReadiness: (patientId, params) =>
    request(`/reception/patients/${encodeURIComponent(patientId)}/clinical-routing-readiness`, { params }),
  getPharmacyRoutingReadiness: (patientId, params) =>
    request(`/reception/patients/${encodeURIComponent(patientId)}/pharmacy-routing-readiness`, { params }),
  printQueueTicket: (ticketId, body) =>
    request(`/reception/print/queue-ticket/${encodeURIComponent(ticketId)}`, { method: 'POST', body }),
  printAppointmentSlip: (appointmentId, body) =>
    request(`/reception/print/appointment-slip/${encodeURIComponent(appointmentId)}`, { method: 'POST', body }),
  printPaymentGuide: (invoiceId, body) =>
    request(`/reception/print/payment-guide/${encodeURIComponent(invoiceId)}`, { method: 'POST', body }),
  printPatientCard: (patientId, body) =>
    request(`/reception/print/patient-card/${encodeURIComponent(patientId)}`, { method: 'POST', body }),
  logPrint: (body) => request('/reception/print/log', { method: 'POST', body }),

  searchAppointments: (params) => request('/appointments/search', { params }),
  listAppointments: (params) => request('/appointments', { params }),
  getTodayAppointments: (params) => request('/appointments/today', { params }),
  getAppointmentSummary: (params) => request('/appointments/summary', { params }),
  getAppointmentDetail: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}`),
  getAppointmentTimeline: (appointmentId, params) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/timeline`, { params }),
  getCanCheckIn: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/can-check-in`),
  checkInAppointment: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/check-in`, { method: 'POST' }),
  confirmAppointment: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/confirm`, { method: 'POST' }),
  cancelAppointment: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, { method: 'POST', body }),
  rescheduleAppointment: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/reschedule`, { method: 'POST', body }),
  markNoShow: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/no-show`, { method: 'POST' }),

  listQueue: (params) => request('/queue', { params }),
  getQueueSummaryToday: (params) => request('/queue/summary/today', { params }),
  getQueueTicket: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}`),
  getQueueTimeline: (ticketId, params) =>
    request(`/queue/${encodeURIComponent(ticketId)}/timeline`, { params }),
  createQueueTicket: (body) => request('/queue', { method: 'POST', body }),
  checkInPatientToQueue: (body) => request('/queue/check-in', { method: 'POST', body }),
  createQueueFromAppointment: (appointmentId) =>
    request(`/queue/appointment/${encodeURIComponent(appointmentId)}`, { method: 'POST' }),
  generateQueueQr: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/generate-qr`, { method: 'POST', body }),
  markQueueNoShow: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/mark-no-show`, { method: 'POST', body }),
  callNextQueue: (body) => request('/queue/call-next', { method: 'POST', body }),
  callQueueTicket: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/call`, { method: 'POST' }),
  recallQueueTicket: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/recall`, { method: 'POST' }),
  skipQueueTicket: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/skip`, { method: 'POST', body }),
  startQueueService: (ticketId) =>
    request(`/queue/${encodeURIComponent(ticketId)}/start-service`, { method: 'POST' }),
  completeQueueTicket: (ticketId) =>
    request(`/queue/${encodeURIComponent(ticketId)}/complete`, { method: 'POST' }),
  cancelQueueTicket: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/cancel`, { method: 'POST', body }),
  reorderQueuePriority: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/reorder-priority`, { method: 'POST', body }),
  transferQueueTicket: (ticketId, body) =>
    request(`/queue/${encodeURIComponent(ticketId)}/transfer`, { method: 'POST', body }),
  getDoctorQueueBoard: (doctorId, params) =>
    request(`/queue/doctor/${encodeURIComponent(doctorId)}/board`, { params }),
  getDepartmentQueueBoard: (departmentId, params) =>
    request(`/queue/department/${encodeURIComponent(departmentId)}/board`, { params }),
  getPublicQueueBoard: (params) => request('/queue/public/board', { params, auth: false }),

  listDepartments: (params) => request('/departments/active', { params, auth: false }),
  listDoctors: (params) => request('/staff/doctors', { params }),
};
