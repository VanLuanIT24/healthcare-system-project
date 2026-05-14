import { API_BASE_URL } from '../lib/api'
import { clearStoredAuth, readStoredAuth } from '../lib/storage'

function buildUrl(path, params) {
  const url = new URL(`${API_BASE_URL}${path}`)

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

async function request(path, { method = 'GET', params, body, auth = true } = {}) {
  const storedAuth = readStoredAuth()
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(auth && storedAuth?.tokens?.access_token
      ? { Authorization: `Bearer ${storedAuth.tokens.access_token}` }
      : {}),
  }

  const response = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let payload = null
  try {
    payload = await response.json()
  } catch (error) {
    payload = null
  }

  if (response.status === 401) {
    clearStoredAuth()
  }

  if (!response.ok) {
    const apiError = new Error(payload?.message || 'Không thể kết nối đến máy chủ.')
    apiError.response = { status: response.status, data: payload }
    throw apiError
  }

  return { data: payload }
}

export const authAPI = {
  getMe: () => request('/auth/me'),
  getMySessions: () => request('/auth/me/sessions'),
  getLoginHistory: (params) => request('/auth/me/login-history', { params }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),
  logout: (refreshToken) =>
    request('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refresh_token: refreshToken } : {},
    }),
  logoutAllDevices: () => request('/auth/logout-all-devices', { method: 'POST', body: {} }),
  revokeSession: (sessionId) =>
    request('/auth/sessions/revoke', { method: 'POST', body: { session_id: sessionId } }),
}

export const patientAPI = {
  getMyProfile: () => request('/patients/me/profile'),
  updateMyProfile: (body) => request('/patients/me/profile', { method: 'PATCH', body }),
  getMyEncounters: (params) => request('/patients/me/encounters', { params }),
  getMyPrescriptions: (params) => request('/patients/me/prescriptions', { params }),
}

export const appointmentAPI = {
  getMyAppointments: (params) => request('/appointments/my', { params }),
  listAppointments: (params) => request('/appointments', { params }),
  createAppointmentByStaff: (body) => request('/appointments/staff-create', { method: 'POST', body }),
  createFromPortal: (body) => request('/appointments/portal', { method: 'POST', body }),
  confirm: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/confirm`, { method: 'POST', body }),
  cancel: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, { method: 'POST', body }),
  checkIn: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/check-in`, { method: 'POST', body }),
  noShow: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/no-show`, { method: 'POST', body }),
  complete: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/complete`, { method: 'POST', body }),
}

export const departmentAPI = {
  getActiveDepartments: () => request('/departments/active', { auth: false }),
}

export const scheduleAPI = {
  getByDateRange: (params) => request('/schedules/date-range', { params, auth: false }),
  getAvailableSlots: (scheduleId) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/available-slots`, { auth: false }),
  getSystemSummary: (params) => request('/schedules/summary/system', { params }),
  getDepartmentSummary: (params) => request('/schedules/summary/departments', { params }),
  getDateRangeSummary: (params) => request('/schedules/summary/date-range', { params }),
  getActivity: (scheduleId, params) => request(`/schedules/${encodeURIComponent(scheduleId)}/activity`, { params }),
  getMyTodaySchedule: (params) => request('/schedules/my/today', { params }),
  getMyWeekSchedule: (params) => request('/schedules/my/week', { params }),
  batchBlockSlots: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/block-slots`, { method: 'POST', body }),
  batchReopenSlots: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/reopen-slots`, { method: 'POST', body }),
  previewImpact: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/preview-impact`, { method: 'POST', body }),
}

export const queueAPI = {
  list: (params) => request('/queue', { params }),
  createFromAppointment: (appointmentId) => request(`/queue/appointment/${encodeURIComponent(appointmentId)}`, { method: 'POST', body: {} }),
  callNext: (body = {}) => request('/queue/call-next', { method: 'POST', body }),
  recall: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/recall`, { method: 'POST', body: {} }),
  skip: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/skip`, { method: 'POST', body: {} }),
  startService: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/start-service`, { method: 'POST', body: {} }),
  complete: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/complete`, { method: 'POST', body: {} }),
  cancel: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/cancel`, { method: 'POST', body: {} }),
}
