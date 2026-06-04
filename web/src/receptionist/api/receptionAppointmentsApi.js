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
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const headers = {
    ...(body
      ? {
          'Content-Type': 'application/json',
        }
      : {}),
    ...(normalizedMethod === 'POST'
      ? {
          'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        }
      : {}),
  };
  const response = await (auth ? fetchWithAuth : fetch)(buildUrl(path, params), {
    method: normalizedMethod,
    headers: Object.keys(headers).length ? headers : undefined,
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
  getReceptionUpcomingAppointments: (params) => request('/reception/upcoming-appointments', { params }),
  printAppointmentSlip: (appointmentId, body) =>
    request(`/reception/print/appointment-slip/${encodeURIComponent(appointmentId)}`, { method: 'POST', body }),

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
  completeAppointment: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/complete`, { method: 'POST', body }),
  createQueueTicket: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/queue-ticket`, { method: 'POST', body }),
  createEncounter: (appointmentId, body) =>
    request(`/appointments/${encodeURIComponent(appointmentId)}/encounter`, { method: 'POST', body }),
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
  createByStaff: (body) => request('/appointments/staff', { method: 'POST', body }),
  validateTime: (body) => request('/appointments/validate-time', { method: 'POST', body }),
  validateSlot: (body) => request('/appointments/validate-slot', { method: 'POST', body }),
  checkDoctorAvailability: (body) =>
    request('/appointments/check-doctor-availability', { method: 'POST', body }),
  checkPatientDuplicate: (body) =>
    request('/appointments/check-patient-duplicate', { method: 'POST', body }),
  checkDoctorConflict: (body) => request('/appointments/check-doctor-conflict', { method: 'POST', body }),
  checkPatientConflict: (body) => request('/appointments/check-patient-conflict', { method: 'POST', body }),
  getWaitlist: (params) => request('/appointments/waitlist', { params }),
  offerWaitlistSlot: (waitlistId, body) =>
    request(`/appointments/waitlist/${encodeURIComponent(waitlistId)}/offer-slot`, { method: 'POST', body }),
  bookWaitlist: (waitlistId, body) =>
    request(`/appointments/waitlist/${encodeURIComponent(waitlistId)}/book`, { method: 'POST', body }),
  cancelWaitlist: (waitlistId, body) =>
    request(`/appointments/waitlist/${encodeURIComponent(waitlistId)}/cancel`, { method: 'POST', body }),
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
  listDoctors: (params) => request('/staff/doctors', { params }),
  getSchedulingOptions: (params) => request('/schedules/resources/options', { params }),
  listDoctorSchedules: (params) => request('/schedules', { params }),
  getAvailableSlots: (scheduleId, params) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/slots/available`, { params }),
  getScheduleSlots: (params) => request('/schedule-slots', { params }),
  getSlotUtilization: (params) => request('/schedule-slots/utilization', { params }),
  holdScheduleSlot: (slotId, body) =>
    request(`/schedule-slots/${encodeURIComponent(slotId)}/hold`, { method: 'POST', body }),
  releaseSlotHold: (slotId, body) =>
    request(`/schedule-slots/${encodeURIComponent(slotId)}/release-hold`, { method: 'POST', body }),
  blockScheduleSlot: (slotId, body) =>
    request(`/schedule-slots/${encodeURIComponent(slotId)}/block`, { method: 'POST', body }),
  reopenScheduleSlot: (slotId, body) =>
    request(`/schedule-slots/${encodeURIComponent(slotId)}/reopen`, { method: 'POST', body }),
  getScheduleCalendar: (params) => request('/schedules/calendar', { params }),
  getScheduleOperationalList: (params) => request('/schedules/operational-list', { params }),
  getScheduleConflicts: (params) => request('/schedules/conflicts', { params }),
  scanScheduleConflicts: (body) => request('/schedules/conflicts/scan', { method: 'POST', body }),
};
