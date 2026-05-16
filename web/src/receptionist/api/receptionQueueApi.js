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

  listDepartments: (params) => request('/departments/active', { params, auth: false }),
  listDoctors: (params) => request('/staff/doctors', { params }),
};
