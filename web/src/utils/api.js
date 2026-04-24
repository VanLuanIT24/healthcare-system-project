import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const AUTH_WHITELIST = [
  '/auth/patients/login',
  '/auth/staff/login',
  '/auth/patients/register',
  '/auth/refresh-token',
  '/auth/forgot-password',
  '/auth/reset-password',
]

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise = null

function getStoredToken() {
  return localStorage.getItem('token')
}

function getStoredRefreshToken() {
  return localStorage.getItem('refreshToken')
}

function setStoredTokens(accessToken, refreshToken) {
  localStorage.setItem('token', accessToken)
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken)
  }
}

function clearStoredAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.pathname !== '/dang-nhap') {
    window.location.replace('/dang-nhap')
  }
}

function isAuthWhitelisted(url = '') {
  return AUTH_WHITELIST.some((path) => url.includes(path))
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.')

    if (!payload) {
      return null
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    return JSON.parse(window.atob(padded))
  } catch {
    return null
  }
}

function isTokenExpiringSoon(token, thresholdSeconds = 30) {
  const payload = decodeJwtPayload(token)

  if (!payload?.exp) {
    return false
  }

  const nowInSeconds = Math.floor(Date.now() / 1000)
  return payload.exp <= nowInSeconds + thresholdSeconds
}

async function requestTokenRefresh() {
  const refreshToken = getStoredRefreshToken()

  if (!refreshToken) {
    throw new Error('Thiếu refresh token.')
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh-token`,
        { refresh_token: refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      .then((response) => {
        const tokens = response.data?.data

        if (!tokens?.access_token || !tokens?.refresh_token) {
          throw new Error('Không thể làm mới phiên đăng nhập.')
        }

        setStoredTokens(tokens.access_token, tokens.refresh_token)
        return tokens.access_token
      })
      .catch((error) => {
        clearStoredAuth()
        redirectToLogin()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

api.interceptors.request.use(async (config) => {
  let token = getStoredToken()

  if (token && !isAuthWhitelisted(config.url) && isTokenExpiringSoon(token)) {
    token = await requestTokenRefresh()
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthWhitelisted(originalRequest.url)
    ) {
      try {
        originalRequest._retry = true
        const newToken = await requestTokenRefresh()
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        clearStoredAuth()
        redirectToLogin()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

function get(url, params = {}) {
  return api.get(url, { params })
}

function post(url, payload = {}) {
  return api.post(url, payload)
}

function patch(url, payload = {}) {
  return api.patch(url, payload)
}

export function unwrapData(response) {
  return response?.data?.data ?? null
}

export function getApiErrorStatus(error) {
  return error?.response?.status || 0
}

export function getApiErrorMessage(error, fallback = 'Có lỗi xảy ra.') {
  const payload = error?.response?.data

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const firstError = payload.errors[0]
    if (typeof firstError === 'string') {
      return firstError
    }
    if (firstError?.message) {
      return firstError.message
    }
  }

  return payload?.message || error?.message || fallback
}

export const authAPI = {
  login: (login, password) => post('/auth/patients/login', { login, password }),
  loginPatient: (login, password) => post('/auth/patients/login', { login, password }),
  loginStaff: (login, password) => post('/auth/staff/login', { login, password }),
  register: (userData) => post('/auth/patients/register', userData),
  forgotPassword: (payload) => post('/auth/forgot-password', payload),
  resetPassword: (payload) => post('/auth/reset-password', payload),
  logout: (refreshToken) => post('/auth/logout', { refresh_token: refreshToken }),
  refreshToken: (refreshToken) => post('/auth/refresh-token', { refresh_token: refreshToken }),
  me: () => get('/auth/me'),
  updateMyProfile: (payload) => patch('/auth/me', payload),
  changePassword: (payload) => post('/auth/change-password', payload),
  getMySessions: () => get('/auth/me/sessions'),
  getLoginHistory: (params = {}) => get('/auth/me/login-history', params),
  revokeSession: (sessionId) => post('/auth/sessions/revoke', { session_id: sessionId }),
  logoutAllDevices: () => post('/auth/logout-all-devices'),
}

export const patientAPI = {
  getMyProfile: () => get('/patients/me/profile'),
  updateMyProfile: (payload) => patch('/patients/me/profile', payload),
  getMyAppointments: (params = {}) => get('/patients/me/appointments', params),
  getMyEncounters: (params = {}) => get('/patients/me/encounters', params),
  getMyPrescriptions: (params = {}) => get('/patients/me/prescriptions', params),
  list: (params = {}) => get('/patients', params),
  search: (params = {}) => get('/patients/search', params),
  detail: (patientId) => get(`/patients/${patientId}`),
  summary: (patientId) => get(`/patients/${patientId}/summary`),
  timeline: (patientId) => get(`/patients/${patientId}/timeline`),
  canBook: (patientId) => get(`/patients/${patientId}/can-book`),
  appointments: (patientId, params = {}) => get(`/patients/${patientId}/appointments`, params),
  encounters: (patientId, params = {}) => get(`/patients/${patientId}/encounters`, params),
  prescriptions: (patientId, params = {}) => get(`/patients/${patientId}/prescriptions`, params),
}

export const appointmentAPI = {
  getMyAppointments: (params = {}) => get('/appointments/my', params),
  createFromPortal: (payload) => post('/appointments/portal', payload),
  list: (params = {}) => get('/appointments', params),
  search: (params = {}) => get('/appointments/search', params),
  summary: (params = {}) => get('/appointments/summary', params),
  listByPatient: (patientId, params = {}) => get(`/appointments/patient/${patientId}`, params),
  listByDoctor: (doctorId, params = {}) => get(`/appointments/doctor/${doctorId}`, params),
  listByDepartment: (departmentId, params = {}) =>
    get(`/appointments/department/${departmentId}`, params),
  listByDate: (params = {}) => get('/appointments/by-date', params),
  listUpcoming: (params = {}) => get('/appointments/upcoming', params),
  listToday: (params = {}) => get('/appointments/today', params),
  detail: (appointmentId) => get(`/appointments/${appointmentId}`),
  timeline: (appointmentId, params = {}) => get(`/appointments/${appointmentId}/timeline`, params),
  canUpdate: (appointmentId) => get(`/appointments/${appointmentId}/can-update`),
  canCancel: (appointmentId) => get(`/appointments/${appointmentId}/can-cancel`),
  canReschedule: (appointmentId) => get(`/appointments/${appointmentId}/can-reschedule`),
  canCheckIn: (appointmentId) => get(`/appointments/${appointmentId}/can-check-in`),
  validateSlot: (payload) => post('/appointments/validate-slot', payload),
  checkDoctorAvailability: (payload) => post('/appointments/check-doctor-availability', payload),
  checkPatientDuplicateBooking: (payload) => post('/appointments/check-patient-duplicate', payload),
  validateAppointmentTime: (payload) => post('/appointments/validate-time', payload),
  validateAppointmentStatusTransition: (payload) =>
    post('/appointments/validate-status-transition', payload),
  checkAppointmentConflictForDoctor: (payload) => post('/appointments/check-doctor-conflict', payload),
  checkAppointmentConflictForPatient: (payload) =>
    post('/appointments/check-patient-conflict', payload),
  create: (payload) => post('/appointments', payload),
  createAppointmentByStaff: (payload) => post('/appointments/staff-create', payload),
  updateAppointment: (appointmentId, payload) => patch(`/appointments/${appointmentId}`, payload),
  confirmAppointment: (appointmentId) => post(`/appointments/${appointmentId}/confirm`),
  cancelAppointment: (appointmentId, payload = {}) =>
    post(`/appointments/${appointmentId}/cancel`, payload),
  rescheduleAppointment: (appointmentId, payload = {}) =>
    post(`/appointments/${appointmentId}/reschedule`, payload),
  checkInAppointment: (appointmentId) => post(`/appointments/${appointmentId}/check-in`),
  markAppointmentNoShow: (appointmentId) => post(`/appointments/${appointmentId}/no-show`),
  completeAppointment: (appointmentId) => post(`/appointments/${appointmentId}/complete`),
  createEncounter: (appointmentId) => post(`/appointments/${appointmentId}/encounter`),
}

export const encounterAPI = {
  list: (params = {}) => get('/encounters', params),
  search: (params = {}) => get('/encounters/search', params),
  listToday: (params = {}) => get('/encounters/today', params),
  detail: (encounterId) => get(`/encounters/${encounterId}`),
  summary: (encounterId) => get(`/encounters/${encounterId}/summary`),
  timeline: (encounterId) => get(`/encounters/${encounterId}/timeline`),
  listByPatient: (patientId, params = {}) => get(`/encounters/patient/${patientId}`, params),
  listByDoctor: (doctorId, params = {}) => get(`/encounters/doctor/${doctorId}`, params),
  create: (payload) => post('/encounters', payload),
  createFromAppointment: (appointmentId) => post(`/encounters/appointment/${appointmentId}`),
  start: (encounterId) => post(`/encounters/${encounterId}/start`),
  hold: (encounterId) => post(`/encounters/${encounterId}/hold`),
  complete: (encounterId) => post(`/encounters/${encounterId}/complete`),
}

export const clinicalAPI = {
  listConsultations: (params = {}) => get('/clinical/consultations', params),
  consultationDetail: (consultationId) => get(`/clinical/consultations/${consultationId}`),
  createConsultation: (payload) => post('/clinical/consultations', payload),
  updateConsultation: (consultationId, payload) =>
    patch(`/clinical/consultations/${consultationId}`, payload),
  startConsultation: (consultationId) => post(`/clinical/consultations/${consultationId}/start`),
  signConsultation: (consultationId) => post(`/clinical/consultations/${consultationId}/sign`),
  amendConsultation: (consultationId, payload = {}) =>
    post(`/clinical/consultations/${consultationId}/amend`, payload),
  listDiagnoses: (encounterId) => get(`/clinical/encounters/${encounterId}/diagnoses`),
  createDiagnosis: (payload) => post('/clinical/diagnoses', payload),
  updateDiagnosis: (diagnosisId, payload) => patch(`/clinical/diagnoses/${diagnosisId}`, payload),
  setPrimaryDiagnosis: (diagnosisId) => post(`/clinical/diagnoses/${diagnosisId}/set-primary`),
  resolveDiagnosis: (diagnosisId) => post(`/clinical/diagnoses/${diagnosisId}/resolve`),
  listVitalSigns: (encounterId) => get(`/clinical/encounters/${encounterId}/vital-signs`),
  latestVitalSigns: (encounterId) => get(`/clinical/encounters/${encounterId}/vital-signs/latest`),
  createVitalSigns: (payload) => post('/clinical/vital-signs', payload),
  updateVitalSigns: (vitalSignId, payload) => patch(`/clinical/vital-signs/${vitalSignId}`, payload),
  listNotes: (params = {}) => get('/clinical/notes', params),
  createNote: (payload) => post('/clinical/notes', payload),
  signNote: (noteId) => post(`/clinical/notes/${noteId}/sign`),
}

export const prescriptionAPI = {
  list: (params = {}) => get('/prescriptions', params),
  listByEncounter: (encounterId) => get(`/prescriptions/encounter/${encounterId}`),
  listByPatient: (patientId) => get(`/prescriptions/patient/${patientId}`),
  detail: (prescriptionId) => get(`/prescriptions/${prescriptionId}`),
  create: (payload) => post('/prescriptions', payload),
  addItem: (payload) => post('/prescriptions/items', payload),
  searchMedications: (search) => get('/prescriptions/medications/search', { search }),
  checkAllergyConflict: (payload) => post('/prescriptions/check-allergy-conflict', payload),
  activate: (prescriptionId) => post(`/prescriptions/${prescriptionId}/activate`),
  cancel: (prescriptionId) => post(`/prescriptions/${prescriptionId}/cancel`),
  duplicate: (prescriptionId) => post(`/prescriptions/${prescriptionId}/duplicate`),
}

export const queueAPI = {
  list: (params = {}) => get('/queue', params),
  boardByDoctor: (doctorId, params = {}) => get(`/queue/doctor/${doctorId}/board`, params),
  callNext: (payload = {}) => post('/queue/call-next', payload),
  recall: (ticketId) => post(`/queue/${ticketId}/recall`),
  skip: (ticketId) => post(`/queue/${ticketId}/skip`),
  startService: (ticketId) => post(`/queue/${ticketId}/start-service`),
  complete: (ticketId) => post(`/queue/${ticketId}/complete`),
}

export const scheduleAPI = {
  getByDateRange: (params = {}) => get('/schedules/date-range', params),
  getByDepartment: (departmentId, params = {}) =>
    get(`/schedules/department/${departmentId}`, params),
  getAvailableSlots: (scheduleId) => get(`/schedules/${scheduleId}/available-slots`),
  list: (params = {}) => get('/schedules', params),
  calendarByDoctor: (doctorId, params = {}) => get(`/schedules/calendar/doctor/${doctorId}`, params),
  listByDoctor: (doctorId, params = {}) => get(`/schedules/doctor/${doctorId}`, params),
  availableSlots: (scheduleId) => get(`/schedules/${scheduleId}/available-slots`),
}

export const departmentAPI = {
  getActiveDepartments: () => get('/departments/active'),
  listActive: () => get('/departments/active'),
}

export const staffAPI = {
  listDoctors: () => get('/staff/doctors'),
}

export default api
