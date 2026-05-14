import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import { readStoredAuth } from '../lib/storage'

function buildUrl(path, params) {
  const url = new URL(`${API_BASE_URL}${path}`)

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

async function request(path, { method = 'GET', params, body, auth = true, skipRefresh = false } = {}) {
  const storedAuth = readStoredAuth()
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(auth && storedAuth?.tokens?.access_token
      ? { Authorization: `Bearer ${storedAuth.tokens.access_token}` }
      : {}),
  }

  const url = buildUrl(path, params)
  const requestOptions = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }

  const response = auth
    ? await fetchWithAuth(url, { ...requestOptions, skipRefresh })
    : await fetch(url, requestOptions)

  let payload = null
  try {
    payload = await response.json()
  } catch (error) {
    payload = null
  }

  if (!response.ok) {
    const apiError = new Error(payload?.message || 'Không thể kết nối đến máy chủ.')
    apiError.response = { status: response.status, data: payload }
    throw apiError
  }

  return { data: payload }
}

export function unwrapData(response) {
  return response?.data?.data ?? response?.data ?? response
}

export function getApiErrorStatus(error) {
  return Number(error?.response?.status || error?.status || 0)
}

export function getApiErrorMessage(error, fallback = 'Không thể xử lý yêu cầu.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.data?.message ||
    error?.message ||
    fallback
  )
}

export const authAPI = {
  getMe: () => request('/auth/me'),
  updateMyProfile: (body) => request('/auth/me', { method: 'PATCH', body }),
  getMyRoles: () => request('/auth/me/roles'),
  getMyPermissions: () => request('/auth/me/permissions'),
  getCurrentSession: () => request('/auth/me/session'),
  getMySessions: () => request('/auth/me/sessions'),
  getLoginHistory: (params) => request('/auth/me/login-history', { params }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),
  updatePatientAccountEmail: (body) => request('/auth/patient/account/email', { method: 'PATCH', body }),
  updatePatientAccountPhone: (body) => request('/auth/patient/account/phone', { method: 'PATCH', body }),
  updatePatientAccountUsername: (body) => request('/auth/patient/account/username', { method: 'PATCH', body }),
  logout: (refreshToken) =>
    request('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refresh_token: refreshToken } : {},
    }),
  logoutAllDevices: () => request('/auth/logout-all-devices', { method: 'POST', body: {} }),
  revokeOtherSessions: () => request('/auth/me/sessions/others', { method: 'DELETE' }),
  renameMySessionDevice: (sessionId, body) =>
    request(`/auth/me/sessions/${encodeURIComponent(sessionId)}/device`, { method: 'PATCH', body }),
  revokeMySession: (sessionId) => request(`/auth/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  revokeSession: (sessionId) =>
    request('/auth/sessions/revoke', { method: 'POST', body: { session_id: sessionId } }),
}

export const patientAPI = {
  getMyProfile: () => request('/patients/me/profile'),
  updateMyProfile: (body) => request('/patients/me/profile', { method: 'PATCH', body }),
  getMyEncounters: (params) => request('/patients/me/encounters', { params }),
  getMyPrescriptions: (params) => request('/patients/me/prescriptions', { params }),
  list: (params) => request('/patients', { params }),
  search: (params) => request('/patients/search', { params }),
  detail: (patientId) => request(`/patients/${encodeURIComponent(patientId)}`),
  summary: (patientId) => request(`/patients/${encodeURIComponent(patientId)}/summary`),
  encounters: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/encounters`, { params }),
  appointments: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/appointments`, { params }),
  prescriptions: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/prescriptions`, { params }),
  timeline: (patientId) => request(`/patients/${encodeURIComponent(patientId)}/timeline`),
}

export const recordsAPI = {
  getMyMedicalRecords: (params) => request('/records/me/medical-records', { params }),
  getMyMedicalRecordDetail: (recordId) =>
    request(`/records/me/medical-records/${encodeURIComponent(recordId)}`),
  getMyAttachments: (params) => request('/records/me/attachments', { params }),
  getMyAttachmentDetail: (attachmentId) => request(`/records/me/attachments/${encodeURIComponent(attachmentId)}`),
  getMyDocumentTimeline: (params) => request('/records/me/document-timeline', { params }),
  getMyAttachmentDownloadMetadata: (attachmentId) =>
    request(`/records/me/attachments/${encodeURIComponent(attachmentId)}/download`),
}

export const labAPI = {
  getMyResults: (params) => request('/lab/me/results', { params }),
  getResultDetail: (resultId) => request(`/lab/me/results/${encodeURIComponent(resultId)}`),
}

export const imagingAPI = {
  getMyReports: (params) => request('/imaging/me/reports', { params }),
  getReportDetail: (reportId) => request(`/imaging/me/reports/${encodeURIComponent(reportId)}`),
}

export const inpatientAPI = {
  getMyAdmissions: (params) => request('/inpatient/me/admissions', { params }),
  getAdmissionDetail: (admissionId) => request(`/inpatient/me/admissions/${encodeURIComponent(admissionId)}`),
}

export const procedureAPI = {
  getMyHistory: (params) => request('/procedures/me/history', { params }),
  getOrderDetail: (procedureOrderId) => request(`/procedures/me/orders/${encodeURIComponent(procedureOrderId)}`),
}

export const billingAPI = {
  getMySummary: () => request('/billing/me/summary'),
  getMyInvoices: (params) => request('/billing/me/invoices', { params }),
  getMyInvoiceDetail: (invoiceId) => request(`/billing/me/invoices/${encodeURIComponent(invoiceId)}`),
  getMyPayments: (params) => request('/billing/me/payments', { params }),
  getMyPaymentDetail: (paymentId) => request(`/billing/me/payments/${encodeURIComponent(paymentId)}`),
  getMyInsurancePolicies: () => request('/billing/me/insurance-policies'),
  getMyInsurancePolicyDetail: (policyId) =>
    request(`/billing/me/insurance-policies/${encodeURIComponent(policyId)}`),
  getMyInsuranceClaims: (params) => request('/billing/me/insurance-claims', { params }),
  getMyInsuranceClaimDetail: (claimId) =>
    request(`/billing/me/insurance-claims/${encodeURIComponent(claimId)}`),
}

export const notificationAPI = {
  getMyNotifications: (params) => request('/notifications', { params }),
  getUnreadCount: () => request('/notifications/unread-count'),
  markAllRead: () => request('/notifications/read-all', { method: 'POST', body: {} }),
  markRead: (notificationId) =>
    request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST', body: {} }),
  listMine: (params) => request('/notifications', { params }),
  markAllReadWithParams: (params) => request('/notifications/read-all', { method: 'POST', body: {}, params }),
  clearAll: (params) => request('/notifications/read-all', { method: 'POST', body: {}, params }),
}

export const appointmentAPI = {
  getMyAppointments: (params) => request('/appointments/my', { params }),
  getMyAppointmentDetail: (appointmentId) => request(`/appointments/my/${encodeURIComponent(appointmentId)}`),
  cancelMyAppointment: (appointmentId, body = {}) =>
    request(`/appointments/my/${encodeURIComponent(appointmentId)}/cancel`, { method: 'POST', body }),
  rescheduleMyAppointment: (appointmentId, body = {}) =>
    request(`/appointments/my/${encodeURIComponent(appointmentId)}/reschedule`, { method: 'POST', body }),
  listAppointments: (params) => request('/appointments', { params }),
  list: (params) => request('/appointments', { params }),
  search: (params) => request('/appointments/search', { params }),
  listToday: (params) => request('/appointments/today', { params }),
  listByDoctor: (doctorId, params) => request(`/appointments/doctor/${encodeURIComponent(doctorId)}`, { params }),
  detail: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}`),
  summary: (params) => request('/appointments/summary', { params }),
  timeline: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}/timeline`),
  canUpdate: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}/can-update`),
  canCancel: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}/can-cancel`),
  canReschedule: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}/can-reschedule`),
  canCheckIn: (appointmentId) => request(`/appointments/${encodeURIComponent(appointmentId)}/can-check-in`),
  createAppointmentByStaff: (body) => request('/appointments/staff-create', { method: 'POST', body }),
  createFromPortal: (body) => request('/appointments/portal', { method: 'POST', body }),
  confirm: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/confirm`, { method: 'POST', body }),
  confirmAppointment: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/confirm`, { method: 'POST', body }),
  cancel: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, { method: 'POST', body }),
  checkIn: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/check-in`, { method: 'POST', body }),
  noShow: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/no-show`, { method: 'POST', body }),
  markAppointmentNoShow: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/no-show`, { method: 'POST', body }),
  complete: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/complete`, { method: 'POST', body }),
  completeAppointment: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/complete`, { method: 'POST', body }),
}

export const departmentAPI = {
  getActiveDepartments: () => request('/departments/active', { auth: false }),
}

export const scheduleAPI = {
  list: (params) => request('/schedules', { params }),
  getByDateRange: (params) => request('/schedules/public/date-range', { params, auth: false }),
  listByDoctor: (doctorId, params) => request(`/schedules/doctor/${encodeURIComponent(doctorId)}`, { params }),
  calendarByDoctor: (doctorId, params) => request(`/schedules/calendar/doctor/${encodeURIComponent(doctorId)}`, { params }),
  getAvailableSlots: (scheduleId) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/available-slots`, { auth: false }),
  availableSlots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/slots/available`),
  getBookedSlots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/slots/booked`),
  getSystemSummary: (params) => request('/schedules/summary/system', { params }),
  getDepartmentSummary: (params) => request('/schedules/summary/departments', { params }),
  getDateRangeSummary: (params) => request('/schedules/summary/date-range', { params }),
  getActivity: (scheduleId, params) => request(`/schedules/${encodeURIComponent(scheduleId)}/activity`, { params }),
  detail: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}`),
  summary: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/summary`),
  activity: (scheduleId, params) => request(`/schedules/${encodeURIComponent(scheduleId)}/activity`, { params }),
  utilization: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/utilization`),
  canUpdate: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/can-update`),
  canCancel: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/can-cancel`),
  futureAppointments: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/future-appointments`),
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
  boardByDoctor: (doctorId, params) => request(`/queue/doctor/${encodeURIComponent(doctorId)}/board`, { params }),
  detail: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}`),
  timeline: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/timeline`),
  summaryToday: (params) => request('/queue/summary/today', { params }),
  createFromAppointment: (appointmentId) => request(`/queue/appointment/${encodeURIComponent(appointmentId)}`, { method: 'POST', body: {} }),
  callNext: (body = {}) => request('/queue/call-next', { method: 'POST', body }),
  recall: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/recall`, { method: 'POST', body: {} }),
  skip: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/skip`, { method: 'POST', body: {} }),
  startService: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/start-service`, { method: 'POST', body: {} }),
  complete: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/complete`, { method: 'POST', body: {} }),
  cancel: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/cancel`, { method: 'POST', body: {} }),
}

export const dashboardAPI = {
  doctorMe: (params) => request('/dashboard/doctor/me', { params }),
}

export const encounterAPI = {
  list: (params) => request('/encounters', { params }),
  search: (params) => request('/encounters/search', { params }),
  listToday: (params) => request('/encounters/today', { params }),
  listByDoctor: (doctorId, params) => request(`/encounters/doctor/${encodeURIComponent(doctorId)}`, { params }),
  listActiveByDoctor: (doctorId, params) => request(`/encounters/doctor/${encodeURIComponent(doctorId)}/active`, { params }),
  detail: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}`),
  summary: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/summary`),
  timeline: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/timeline`),
  canStart: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/can-start`),
  canComplete: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/can-complete`),
  editable: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/editable`),
  hasSignedConsultation: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/has-signed-consultation`),
  hasActivePrescription: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/has-active-prescription`),
  createFromAppointment: (appointmentId) => request(`/encounters/appointment/${encodeURIComponent(appointmentId)}`, { method: 'POST', body: {} }),
  arrive: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/arrive`, { method: 'POST', body: {} }),
  start: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/start`, { method: 'POST', body: {} }),
  hold: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/hold`, { method: 'POST', body: {} }),
  complete: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/complete`, { method: 'POST', body: {} }),
  cancel: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/cancel`, { method: 'POST', body: {} }),
  reopen: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/reopen`, { method: 'POST', body: {} }),
  listOrders: (encounterId, params) => request(`/encounters/${encodeURIComponent(encounterId)}/orders`, { params }),
  ordersSummary: (encounterId, params) => request(`/encounters/${encodeURIComponent(encounterId)}/orders/summary`, { params }),
}

export const orderAPI = {
  list: (params) => request('/orders', { params }),
  search: (params) => request('/orders/search', { params }),
  summary: (params) => request('/orders', { params }),
  listByDoctor: (doctorId, params) => request(`/orders/doctor/${encodeURIComponent(doctorId)}`, { params }),
  listByDoctorPage: (doctorId, params) => request(`/orders/doctor/${encodeURIComponent(doctorId)}`, { params }),
  detail: (orderId) => request(`/orders/${encodeURIComponent(orderId)}`),
  timeline: (orderId) => request(`/orders/${encodeURIComponent(orderId)}/timeline`),
  createForEncounter: (encounterId, body) => request(`/encounters/${encodeURIComponent(encounterId)}/orders`, { method: 'POST', body }),
  cancel: (orderId, body = {}) => request(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body }),
}

export const clinicalAPI = {
  encounterSummary: (encounterId) => request(`/clinical/encounters/${encodeURIComponent(encounterId)}/summary`),
  listConsultations: (params) => request('/clinical/consultations', { params }),
  consultationDetail: (consultationId) => request(`/clinical/consultations/${encodeURIComponent(consultationId)}`),
  createConsultation: (body) => request('/clinical/consultations', { method: 'POST', body }),
  updateConsultation: (consultationId, body) => request(`/clinical/consultations/${encodeURIComponent(consultationId)}`, { method: 'PATCH', body }),
  startConsultation: (consultationId) => request(`/clinical/consultations/${encodeURIComponent(consultationId)}/start`, { method: 'POST', body: {} }),
  signConsultation: (consultationId) => request(`/clinical/consultations/${encodeURIComponent(consultationId)}/sign`, { method: 'POST', body: {} }),
  amendConsultation: (consultationId, body = {}) => request(`/clinical/consultations/${encodeURIComponent(consultationId)}/amend`, { method: 'POST', body }),
  cancelConsultation: (consultationId) => request(`/clinical/consultations/${encodeURIComponent(consultationId)}/cancel`, { method: 'POST', body: {} }),
  listDiagnoses: (encounterId) => request(`/clinical/encounters/${encodeURIComponent(encounterId)}/diagnoses`),
  createDiagnosis: (body) => request('/clinical/diagnoses', { method: 'POST', body }),
  updateDiagnosis: (diagnosisId, body) => request(`/clinical/diagnoses/${encodeURIComponent(diagnosisId)}`, { method: 'PATCH', body }),
  setPrimaryDiagnosis: (diagnosisId) => request(`/clinical/diagnoses/${encodeURIComponent(diagnosisId)}/set-primary`, { method: 'POST', body: {} }),
  resolveDiagnosis: (diagnosisId) => request(`/clinical/diagnoses/${encodeURIComponent(diagnosisId)}/resolve`, { method: 'POST', body: {} }),
  removeDiagnosis: (diagnosisId) => request(`/clinical/diagnoses/${encodeURIComponent(diagnosisId)}/remove`, { method: 'POST', body: {} }),
  listVitalSigns: (encounterId) => request(`/clinical/encounters/${encodeURIComponent(encounterId)}/vital-signs`),
  latestVitalSigns: (encounterId) => request(`/clinical/encounters/${encodeURIComponent(encounterId)}/vital-signs/latest`),
  createVitalSigns: (body) => request('/clinical/vital-signs', { method: 'POST', body }),
  updateVitalSigns: (vitalSignId, body) => request(`/clinical/vital-signs/${encodeURIComponent(vitalSignId)}`, { method: 'PATCH', body }),
  removeVitalSigns: (vitalSignId) => request(`/clinical/vital-signs/${encodeURIComponent(vitalSignId)}/remove`, { method: 'POST', body: {} }),
  listNotes: (params) => request('/clinical/notes', { params }),
  createNote: (body) => request('/clinical/notes', { method: 'POST', body }),
  updateNote: (noteId, body) => request(`/clinical/notes/${encodeURIComponent(noteId)}`, { method: 'PATCH', body }),
  startNote: (noteId) => request(`/clinical/notes/${encodeURIComponent(noteId)}/start`, { method: 'POST', body: {} }),
  completeNote: (noteId) => request(`/clinical/notes/${encodeURIComponent(noteId)}/complete`, { method: 'POST', body: {} }),
  signNote: (noteId) => request(`/clinical/notes/${encodeURIComponent(noteId)}/sign`, { method: 'POST', body: {} }),
  amendNote: (noteId, body = {}) => request(`/clinical/notes/${encodeURIComponent(noteId)}/amend`, { method: 'POST', body }),
  cancelNote: (noteId) => request(`/clinical/notes/${encodeURIComponent(noteId)}/cancel`, { method: 'POST', body: {} }),
}

export const prescriptionAPI = {
  getMyPrescriptions: (params) => request('/prescriptions/me', { params }),
  getMyPrescriptionDetail: (prescriptionId) => request(`/prescriptions/me/${encodeURIComponent(prescriptionId)}`),
  list: (params) => request('/prescriptions', { params }),
  listByEncounter: (encounterId, params) => request(`/prescriptions/encounter/${encodeURIComponent(encounterId)}`, { params }),
  listByPatient: (patientId, params) => request(`/prescriptions/patient/${encodeURIComponent(patientId)}`, { params }),
  listByDoctor: (doctorId, params) => request(`/prescriptions/doctor/${encodeURIComponent(doctorId)}`, { params }),
  detail: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}`),
  summary: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/summary`),
  create: (body) => request('/prescriptions', { method: 'POST', body }),
  addItem: (body) => request('/prescriptions/items', { method: 'POST', body }),
  listItems: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/items`),
  updateItem: (itemId, body) => request(`/prescriptions/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body }),
  stopItem: (itemId) => request(`/prescriptions/items/${encodeURIComponent(itemId)}/stop`, { method: 'POST', body: {} }),
  cancelItem: (itemId) => request(`/prescriptions/items/${encodeURIComponent(itemId)}/cancel`, { method: 'POST', body: {} }),
  completeItem: (itemId) => request(`/prescriptions/items/${encodeURIComponent(itemId)}/complete`, { method: 'POST', body: {} }),
  removeItem: (itemId) => request(`/prescriptions/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
  searchMedications: (search, params = {}) => request('/prescriptions/medications/search', { params: { ...params, q: search, search } }),
  checkAllergyConflict: (body) => request('/prescriptions/check-allergy-conflict', { method: 'POST', body }),
  checkInteractionConflict: (body) => request('/prescriptions/check-interaction-conflict', { method: 'POST', body }),
  checkDuplicateMedication: (body) => request('/prescriptions/check-duplicate-medication', { method: 'POST', body }),
  calculateItemQuantity: (body) => request('/prescriptions/calculate-item-quantity', { method: 'POST', body }),
  activate: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/activate`, { method: 'POST', body: {} }),
  cancel: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/cancel`, { method: 'POST', body: {} }),
  complete: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/complete`, { method: 'POST', body: {} }),
  duplicate: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/duplicate`, { method: 'POST', body: {} }),
  renew: (prescriptionId, body = {}) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/renew`, { method: 'POST', body }),
}
