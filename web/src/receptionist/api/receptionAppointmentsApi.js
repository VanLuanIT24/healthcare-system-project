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
    const apiError = new Error(payload?.message || 'Không thể xử lý dữ liệu lịch hẹn.');
    apiError.status = response.status;
    apiError.payload = payload;
    throw apiError;
  }

  return payload?.data || null;
}

export const receptionAppointmentsApi = {
  listAppointments: (params) => request('/appointments', { params }),
  searchAppointments: (params) => request('/appointments/search', { params }),
  getSummary: (params) => request('/appointments/summary', { params }),
  getTodayAppointments: (params) => request('/appointments/today', { params }),
  getUpcomingAppointments: (params) => request('/appointments/upcoming', { params }),
  getAppointmentDetail: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}`),
  getAppointmentTimeline: (appointmentId, params) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/timeline`, { params }),
  getCanUpdate: (appointmentId, params) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/can-update`, { params }),
  getCanCancel: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}/can-cancel`),
  getCanReschedule: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/can-reschedule`),
  getCanCheckIn: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/can-check-in`),
  confirmAppointment: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/confirm`, { method: 'POST' }),
  cancelAppointment: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, { method: 'POST', body }),
  rescheduleAppointment: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/reschedule`, { method: 'POST', body }),
  checkInAppointment: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/check-in`, { method: 'POST' }),
  markNoShow: (appointmentId) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/no-show`, { method: 'POST' }),
  bulkConfirm: (appointmentIds) =>
    request('/appointments/bulk-confirm', { method: 'POST', body: { appointment_ids: appointmentIds } }),
  bulkCancel: (appointmentIds, body = {}) =>
    request('/appointments/bulk-cancel', {
      method: 'POST',
      body: {
        ...body,
        appointment_ids: appointmentIds,
      },
    }),
  createByStaff: (body) => request('/appointments/staff-create', { method: 'POST', body }),
  validateTime: (body) => request('/appointments/validate-time', { method: 'POST', body }),
  validateSlot: (body) => request('/appointments/validate-slot', { method: 'POST', body }),
  checkDoctorAvailability: (body) =>
    request('/appointments/check-doctor-availability', { method: 'POST', body }),
  checkPatientDuplicate: (body) =>
    request('/appointments/check-patient-duplicate', { method: 'POST', body }),
  checkDoctorConflict: (body) => request('/appointments/check-doctor-conflict', { method: 'POST', body }),
  checkPatientConflict: (body) => request('/appointments/check-patient-conflict', { method: 'POST', body }),
  searchPatients: (params) => request('/patients/search', { params }),
  listPatients: (params) => request('/patients', { params }),
  createPatient: (body) => request('/patients', { method: 'POST', body }),
  getPatientDetail: (patientId) => request(`/patients/${encodeURIComponent(patientId)}`),
  getPatientSummary: (patientId) => request(`/patients/${encodeURIComponent(patientId)}/summary`),
  getPatientTimeline: (patientId, params) =>
    request(`/patients/${encodeURIComponent(patientId)}/timeline`, { params }),
  getPatientAppointments: (patientId, params) =>
    request(`/patients/${encodeURIComponent(patientId)}/appointments`, { params }),
  listDepartments: (params) => request('/departments/active', { params, auth: false }),
  listDoctors: (params) => request('/admin/doctor-profiles', { params }),
  getSchedulingOptions: (params) => request('/schedules/resources/options', { params }),
};
