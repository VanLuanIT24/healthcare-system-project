import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const receptionistService = {
  // Patient APIs
  patients: {
    list: (params = {}) => api.get('/patients', { params }),
    search: (query) => api.get('/patients/search', { params: { query } }),
    get: (patientId) => api.get(`/patients/${patientId}`),
    getDetail: (patientId) => api.get(`/patients/${patientId}/summary`),
    getTimeline: (patientId) => api.get(`/patients/${patientId}/timeline`),
    create: (patientData) => api.post('/patients', patientData),
    update: (patientId, patientData) => api.patch(`/patients/${patientId}`, patientData),
  },

  // Staff/Doctor APIs - Updated to use /staff/doctors endpoint
  staff: {
    list: (params = {}) => api.get('/staff/doctors', { params }),
    search: (query) => api.get('/staff/search', { params: { query } }),
    get: (staffId) => api.get(`/staff/${staffId}`),
    getSchedule: (staffId, date) => api.get(`/staff/${staffId}/schedule`, { params: { date } }),
    getAvailableSlots: (staffId, date) => api.get(`/staff/${staffId}/available-slots`, { params: { date } }),
  },

  // Appointment APIs
  appointments: {
    list: (params = {}) => api.get('/appointments', { params }),
    search: (query) => api.get('/appointments/search', { params: { query } }),
    get: (appointmentId) => api.get(`/appointments/${appointmentId}`),
    create: (appointmentData) => api.post('/appointments', appointmentData),
    update: (appointmentId, appointmentData) => api.patch(`/appointments/${appointmentId}`, appointmentData),
    checkin: (appointmentId) => api.post(`/appointments/${appointmentId}/check-in`),
    cancel: (appointmentId, reason) => api.post(`/appointments/${appointmentId}/cancel`, { reason }),
    confirm: (appointmentId) => api.post(`/appointments/${appointmentId}/confirm`),
    decline: (appointmentId, reason = 'Declined by receptionist') => api.post(`/appointments/${appointmentId}/cancel`, { reason }),
    getByDate: (date) => api.get('/appointments', { params: { date } }),
    getPending: () => api.get('/appointments', { params: { status: ['booked', 'confirmed'] } }),
    getUpcoming: () => api.get('/appointments/upcoming', {}),
  },

  // Queue APIs
  queue: {
    list: () => api.get('/queue'),
    getDepartments: () => api.get('/queue/departments'),
    getByDepartment: (departmentId) => api.get(`/queue/departments/${departmentId}`),
    callNext: (departmentId) => api.post(`/queue/departments/${departmentId}/call-next`),
    issueTicket: (ticketData) => api.post('/queue/issue-ticket', ticketData),
    updateStatus: (ticketId, status) => api.patch(`/queue/tickets/${ticketId}/status`, { status }),
    getStats: () => api.get('/queue/stats'),
    getTodayQueueSummary: () => api.get('/queue/summary/today'),
  },

  // Schedule APIs
  schedules: {
    list: (params = {}) => api.get('/schedules', { params }),
    get: (scheduleId) => api.get(`/schedules/${scheduleId}`),
    getByDoctor: (doctorId, date) => api.get(`/schedules`, { params: { doctorId, date } }),
    create: (scheduleData) => api.post('/schedules', scheduleData),
    update: (scheduleId, scheduleData) => api.patch(`/schedules/${scheduleId}`, scheduleData),
  },

  // Department APIs
  departments: {
    list: () => api.get('/departments'),
    get: (departmentId) => api.get(`/departments/${departmentId}`),
  },

  // Dashboard APIs
  dashboard: {
    getStats: () => api.get('/dashboard/stats'),
    getRecentActivity: () => api.get('/dashboard/recent-activity'),
    getUpcomingAppointments: () => api.get('/dashboard/upcoming-appointments'),
    getDoctorStatus: () => api.get('/dashboard/doctor-status'),
  },

  // Generic error handler
  handleError: (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      window.location.href = '/dang-nhap'
      return
    }

    const message = error.response?.data?.message || error.message || 'Lỗi không xác định'
    console.error('API Error:', message)
    throw error
  },
}

export default receptionistService
