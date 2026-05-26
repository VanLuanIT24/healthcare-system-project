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

export async function request(
  path,
  { method = 'GET', params, body, auth = true, skipRefresh = false, headers: customHeaders = {} } = {},
) {
  const storedAuth = readStoredAuth()
  const normalizedMethod = String(method || 'GET').toUpperCase()
  const headers = {
    ...customHeaders,
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(normalizedMethod === 'POST' ? { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` } : {}),
    ...(auth && storedAuth?.tokens?.access_token
      ? { Authorization: `Bearer ${storedAuth.tokens.access_token}` }
      : {}),
  }

  const url = buildUrl(path, params)
  const requestOptions = {
    method: normalizedMethod,
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

function getChatbotHeaders() {
  const token = import.meta.env.VITE_CHATBOT_WIDGET_TOKEN
  return token ? { 'X-Chatbot-Widget-Token': token } : {}
}

function chatbotRequest(options = {}) {
  const hasAccessToken = Boolean(readStoredAuth()?.tokens?.access_token)
  return {
    ...options,
    auth: hasAccessToken,
    headers: {
      ...getChatbotHeaders(),
      ...(options.headers || {}),
    },
  }
}

export const authAPI = {
  getMe: () => request('/auth/me'),
  getMyRoles: () => request('/auth/me/roles'),
  getMyPermissions: () => request('/auth/me/permissions'),
  getMySession: () => request('/auth/me/session'),
  getCurrentSession: () => request('/auth/me/session'),
  updateMyProfile: (body) => request('/auth/me', { method: 'PATCH', body }),
  getMySessions: () => request('/auth/me/sessions'),
  getLoginHistory: (params) => request('/auth/me/login-history', { params }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),
  updatePatientAccountEmail: (body) => request('/auth/patient/account/email', { method: 'PATCH', body }),
  updatePatientAccountPhone: (body) => request('/auth/patient/account/phone', { method: 'PATCH', body }),
  updatePatientAccountUsername: (body) => request('/auth/patient/account/username', { method: 'PATCH', body }),
  refreshToken: (refreshToken) =>
    request('/auth/refresh-token', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      auth: false,
      skipRefresh: true,
    }),
  logout: (refreshToken) =>
    request('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refresh_token: refreshToken } : {},
    }),
  logoutAllDevices: () => request('/auth/logout-all-devices', { method: 'POST', body: {} }),
  renameMySessionDevice: (sessionId, body) =>
    request(`/auth/me/sessions/${encodeURIComponent(sessionId)}/device`, { method: 'PATCH', body }),
  revokeMySession: (sessionId) => request(`/auth/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  revokeOtherSessions: () => request('/auth/me/sessions/others', { method: 'DELETE' }),
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
  allergies: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/allergies`, { params }),
  problems: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/problems`, { params }),
  encounters: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/encounters`, { params }),
  appointments: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/appointments`, { params }),
  prescriptions: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/prescriptions`, { params }),
  timeline: (patientId) => request(`/patients/${encodeURIComponent(patientId)}/timeline`),
  appointmentsHistory: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/appointments/history`, { params }),
  encountersHistory: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/encounters/history`, { params }),
  prescriptionsHistory: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/prescriptions/history`, { params }),
  canBookAppointment: (patientId, params) => request(`/patients/${encodeURIComponent(patientId)}/can-book-appointment`, { params }),
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

export const portalAPI = {
  getMyDashboard: (params) => request('/portal/me/dashboard', { params }),
  getMyCounters: () => request('/portal/me/counters'),
  getMyTodos: (params) => request('/portal/me/todos', { params }),
  getMyHealthSummary: () => request('/portal/me/health-summary'),
  getMyVisits: (params) => request('/portal/me/visits', { params }),
  getMyVisitDetail: (visitId) => request(`/portal/me/visits/${encodeURIComponent(visitId)}`),
  getBookingDepartments: (params) => request('/portal/booking/departments', { params }),
  getBookingDoctors: (params) => request('/portal/booking/doctors', { params }),
  getBookingSlots: (params) => request('/portal/booking/slots', { params }),
  getBookingRecentDoctors: (params) => request('/portal/booking/recent-doctors', { params }),
  getBookingRecommendedSlots: (params) => request('/portal/booking/recommended-slots', { params }),
  getMyAccessLogs: (params) => request('/portal/me/access-logs', { params }),
  getMyRelatives: (params) => request('/portal/me/relatives', { params }),
  createMyRelative: (body) => request('/portal/me/relatives', { method: 'POST', body }),
  updateMyRelative: (relativeId, body) =>
    request(`/portal/me/relatives/${encodeURIComponent(relativeId)}`, { method: 'PATCH', body }),
  deleteMyRelative: (relativeId, body = {}) =>
    request(`/portal/me/relatives/${encodeURIComponent(relativeId)}`, { method: 'DELETE', body }),
  getMyAuthorizations: (params) => request('/portal/me/authorizations', { params }),
  createMyAuthorization: (body) => request('/portal/me/authorizations', { method: 'POST', body }),
  revokeMyAuthorization: (authorizationId, body = {}) =>
    request(`/portal/me/authorizations/${encodeURIComponent(authorizationId)}/revoke`, { method: 'POST', body }),
}

export const labAPI = {
  getMyResults: (params) => request('/lab/me/results', { params }),
  getMySummary: () => request('/lab/me/results/summary'),
  getResultDetail: (resultId) => request(`/lab/me/results/${encodeURIComponent(resultId)}`),
  getMyResultItems: (resultId) => request(`/lab/me/results/${encodeURIComponent(resultId)}/items`),
  markMyResultViewed: (resultId) =>
    request(`/lab/me/results/${encodeURIComponent(resultId)}/mark-viewed`, { method: 'POST', body: {} }),
  compareMyResult: (resultId) => request(`/lab/me/results/${encodeURIComponent(resultId)}/compare`),
  listOrders: (params) => request('/lab/orders', { params }),
  orderDetail: (labOrderId) => request(`/lab/orders/${encodeURIComponent(labOrderId)}`),
  listResults: (params) => request('/lab/results', { params }),
  resultDetail: (resultId) => request(`/lab/results/${encodeURIComponent(resultId)}`),
  encounterOrders: (encounterId, params) => request(`/lab/encounters/${encodeURIComponent(encounterId)}/orders`, { params }),
  encounterResults: (encounterId, params) => request(`/lab/encounters/${encodeURIComponent(encounterId)}/results`, { params }),
  encounterSummary: (encounterId) => request(`/lab/encounters/${encodeURIComponent(encounterId)}/summary`),
  patientResults: (patientId, params) => request(`/lab/patients/${encodeURIComponent(patientId)}/results`, { params }),
  acknowledgeCritical: (resultId, body = {}) =>
    request(`/lab/results/${encodeURIComponent(resultId)}/acknowledge-critical`, { method: 'POST', body }),
}

export const imagingAPI = {
  getMyReports: (params) => request('/imaging/me/reports', { params }),
  getMySummary: () => request('/imaging/me/reports/summary'),
  getReportDetail: (reportId) => request(`/imaging/me/reports/${encodeURIComponent(reportId)}`),
  getReportFiles: (reportId) => request(`/imaging/me/reports/${encodeURIComponent(reportId)}/files`),
  markMyReportViewed: (reportId) =>
    request(`/imaging/me/reports/${encodeURIComponent(reportId)}/mark-viewed`, { method: 'POST', body: {} }),
}

export const inpatientAPI = {
  getMyAdmissions: (params) => request('/inpatient/me/admissions', { params }),
  getAdmissionDetail: (admissionId) => request(`/inpatient/me/admissions/${encodeURIComponent(admissionId)}`),
  getMyCurrent: () => request('/inpatient/me/current'),
  getMyHistory: (params) => request('/inpatient/me/history', { params }),
  getMySummary: (admissionId) => request(`/inpatient/me/${encodeURIComponent(admissionId)}/summary`),
  getMyCharges: (admissionId) => request(`/inpatient/me/${encodeURIComponent(admissionId)}/charges`),
  getMyDischargeDocuments: (admissionId, params) =>
    request(`/inpatient/me/${encodeURIComponent(admissionId)}/discharge-documents`, { params }),
}

export const procedureAPI = {
  getMyHistory: (params) => request('/procedures/me/history', { params }),
  getMyOrders: (params) => request('/procedures/me/orders', { params }),
  getOrderDetail: (procedureOrderId) => request(`/procedures/me/orders/${encodeURIComponent(procedureOrderId)}`),
  getMyOrderAttachments: (procedureOrderId) =>
    request(`/procedures/me/orders/${encodeURIComponent(procedureOrderId)}/attachments`),
  getMyResults: (params) => request('/procedures/me/results', { params }),
  getMyResultDetail: (resultId) => request(`/procedures/me/results/${encodeURIComponent(resultId)}`),
  markMyResultViewed: (resultId) =>
    request(`/procedures/me/results/${encodeURIComponent(resultId)}/mark-viewed`, { method: 'POST', body: {} }),
  dashboardSummary: (params) => request('/procedures/dashboard/summary', { params }),
  listOrders: (params) => request('/procedures/orders', { params }),
  orderDetail: (procedureOrderId) => request(`/procedures/orders/${encodeURIComponent(procedureOrderId)}`),
  orderTimeline: (procedureOrderId) => request(`/procedures/orders/${encodeURIComponent(procedureOrderId)}/timeline`),
  encounterOrders: (encounterId, params) => request(`/procedures/encounters/${encodeURIComponent(encounterId)}/orders`, { params }),
  encounterSummary: (encounterId) => request(`/procedures/encounters/${encodeURIComponent(encounterId)}/summary`),
  patientHistory: (patientId, params) => request(`/procedures/patients/${encodeURIComponent(patientId)}/history`, { params }),
}

export const billingAPI = {
  getMySummary: () => request('/billing/me/summary'),
  getMyInvoices: (params) => request('/billing/me/invoices', { params }),
  getMyInvoiceDetail: (invoiceId) => request(`/billing/me/invoices/${encodeURIComponent(invoiceId)}`),
  createMyPaymentIntent: (invoiceId, body = {}) =>
    request(`/billing/me/invoices/${encodeURIComponent(invoiceId)}/payment-intents`, { method: 'POST', body }),
  getMyPaymentIntents: (params) => request('/billing/me/payment-intents', { params }),
  getMyPaymentIntentDetail: (intentId) => request(`/billing/me/payment-intents/${encodeURIComponent(intentId)}`),
  getMyPayments: (params) => request('/billing/me/payments', { params }),
  getMyPaymentDetail: (paymentId) => request(`/billing/me/payments/${encodeURIComponent(paymentId)}`),
  getMyPaymentReceipt: (paymentId) => request(`/billing/me/payments/${encodeURIComponent(paymentId)}/receipt`),
  getMyReceipts: (params) => request('/billing/me/receipts', { params }),
  getMyReceiptDetail: (receiptId) => request(`/billing/me/receipts/${encodeURIComponent(receiptId)}`),
  downloadMyReceipt: (receiptId) => request(`/billing/me/receipts/${encodeURIComponent(receiptId)}/download`),
  getMyInsurancePolicies: () => request('/billing/me/insurance-policies'),
  createMyInsurancePolicy: (body = {}) => request('/billing/me/insurance-policies', { method: 'POST', body }),
  getMyInsurancePolicyDetail: (policyId) =>
    request(`/billing/me/insurance-policies/${encodeURIComponent(policyId)}`),
  updateMyInsurancePolicy: (policyId, body = {}) =>
    request(`/billing/me/insurance-policies/${encodeURIComponent(policyId)}`, { method: 'PATCH', body }),
  submitMyInsurancePolicy: (policyId, body = {}) =>
    request(`/billing/me/insurance-policies/${encodeURIComponent(policyId)}/submit`, { method: 'POST', body }),
  attachMyInsurancePolicyCard: (policyId, body = {}) =>
    request(`/billing/me/insurance-policies/${encodeURIComponent(policyId)}/attachments`, { method: 'POST', body }),
  getMyInsuranceClaims: (params) => request('/billing/me/insurance-claims', { params }),
  getMyInsuranceClaimDetail: (claimId) =>
    request(`/billing/me/insurance-claims/${encodeURIComponent(claimId)}`),
  charges: (params) => request('/billing/charges', { params }),
  createCharge: (body) => request('/billing/charges', { method: 'POST', body }),
  chargeDetail: (chargeId) => request(`/billing/charges/${encodeURIComponent(chargeId)}`),
  postCharge: (chargeId, body = {}) => request(`/billing/charges/${encodeURIComponent(chargeId)}/post`, { method: 'POST', body }),
  voidCharge: (chargeId, body = {}) => request(`/billing/charges/${encodeURIComponent(chargeId)}/void`, { method: 'POST', body }),
  invoices: (params) => request('/billing/invoices', { params }),
  createInvoiceFromCharges: (body) => request('/billing/invoices/from-charges', { method: 'POST', body }),
  invoiceDetail: (invoiceId) => request(`/billing/invoices/${encodeURIComponent(invoiceId)}`),
  invoiceItems: (invoiceId) => request(`/billing/invoices/${encodeURIComponent(invoiceId)}/items`),
  issueInvoice: (invoiceId, body = {}) => request(`/billing/invoices/${encodeURIComponent(invoiceId)}/issue`, { method: 'POST', body }),
  voidInvoice: (invoiceId, body = {}) => request(`/billing/invoices/${encodeURIComponent(invoiceId)}/void`, { method: 'POST', body }),
  createInvoicePayment: (invoiceId, body) => request(`/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, { method: 'POST', body }),
  payments: (params) => request('/billing/payments', { params }),
  paymentDetail: (paymentId) => request(`/billing/payments/${encodeURIComponent(paymentId)}`),
  voidPayment: (paymentId, body = {}) => request(`/billing/payments/${encodeURIComponent(paymentId)}/void`, { method: 'POST', body }),
  refundPayment: (paymentId, body = {}) => request(`/billing/payments/${encodeURIComponent(paymentId)}/refund`, { method: 'POST', body }),
  patientSummary: (patientId) => request(`/billing/patients/${encodeURIComponent(patientId)}/summary`),
}

export const notificationAPI = {
  getMyNotifications: (params) => request('/notifications', { params }),
  getUnreadCount: () => request('/notifications/unread-count'),
  unreadCount: () => request('/notifications/unread-count'),
  getCounters: () => request('/notifications/counters'),
  getMyPreferences: () => request('/notifications/preferences/me'),
  updateMyPreferences: (body) => request('/notifications/preferences/me', { method: 'PATCH', body }),
  detail: (notificationId) => request(`/notifications/${encodeURIComponent(notificationId)}`),
  markAllRead: (params) => request('/notifications/read-all', { method: 'POST', body: {}, params }),
  markRead: (notificationId) =>
    request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST', body: {} }),
  listMine: (params) => request('/notifications', { params }),
  markAllReadWithParams: (params) => request('/notifications/read-all', { method: 'POST', body: {}, params }),
  clearAll: (params) => request('/notifications/read-all', { method: 'POST', body: {}, params }),
}

export const supportAPI = {
  getMySummary: () => request('/support/me/summary'),
  listTickets: (params) => request('/support/tickets', { params }),
  createTicket: (body = {}) => request('/support/tickets', { method: 'POST', body }),
  getTicket: (ticketId) => request(`/support/tickets/${encodeURIComponent(ticketId)}`),
  replyTicket: (ticketId, body = {}) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/reply`, { method: 'POST', body }),
  reopenTicket: (ticketId, body = {}) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/reopen`, { method: 'POST', body }),
  rateTicket: (ticketId, body = {}) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/rating`, { method: 'POST', body }),
}

export const messageAPI = {
  listConversations: (params) => request('/messages/conversations', { params }),
  createConversation: (body = {}) => request('/messages/conversations', { method: 'POST', body }),
  getConversation: (conversationId) => request(`/messages/conversations/${encodeURIComponent(conversationId)}`),
  listMessages: (conversationId, params) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { params }),
  sendMessage: (conversationId, body = {}) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body }),
  markRead: (conversationId) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST', body: {} }),
  addAttachments: (conversationId, body = {}) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/attachments`, { method: 'POST', body }),
}

export const emergencyAPI = {
  createSos: (body = {}) => request('/emergency/me/sos', { method: 'POST', body }),
  getMyCases: (params) => request('/emergency/me/cases', { params }),
  getMyCase: (caseId) => request(`/emergency/me/cases/${encodeURIComponent(caseId)}`),
  cancelMyCase: (caseId, body = {}) =>
    request(`/emergency/me/cases/${encodeURIComponent(caseId)}/cancel`, { method: 'POST', body }),
}

export const preferenceAPI = {
  getMe: () => request('/preferences/me'),
  updateMe: (body) => request('/preferences/me', { method: 'PATCH', body }),
}

export const adminDoctorProfileAPI = {
  list: (params) => request('/admin/doctor-profiles', { params }),
  detail: (profileId) => request(`/admin/doctor-profiles/${encodeURIComponent(profileId)}`),
  update: (profileId, body) =>
    request(`/admin/doctor-profiles/${encodeURIComponent(profileId)}`, { method: 'PATCH', body }),
}

export const doctorProfileAPI = {
  getMe: () => request('/doctor-profiles/me'),
  updateMe: (body) => request('/doctor-profiles/me', { method: 'PATCH', body }),
}

export const appointmentAPI = {
  getMyAppointments: (params) => request('/appointments/my', { params }),
  getMySummary: (params) => request('/appointments/my/summary', { params }),
  getMyAppointmentDetail: (appointmentId) => request(`/appointments/my/${encodeURIComponent(appointmentId)}`),
  getMyAppointmentTimeline: (appointmentId) => request(`/appointments/my/${encodeURIComponent(appointmentId)}/timeline`),
  getMyAppointmentActions: (appointmentId) => request(`/appointments/my/${encodeURIComponent(appointmentId)}/actions`),
  cancelMyAppointment: (appointmentId, body = {}) =>
    request(`/appointments/my/${encodeURIComponent(appointmentId)}/cancel`, { method: 'POST', body }),
  rescheduleMyAppointment: (appointmentId, body = {}) =>
    request(`/appointments/my/${encodeURIComponent(appointmentId)}/reschedule`, { method: 'POST', body }),
  checkInMyAppointment: (appointmentId, body = {}) =>
    request(`/appointments/my/${encodeURIComponent(appointmentId)}/check-in`, { method: 'POST', body }),
  createMyQueueTicket: (appointmentId, body = {}) =>
    request(`/appointments/my/${encodeURIComponent(appointmentId)}/queue-ticket`, { method: 'POST', body }),
  getMyWaitlist: (params) => request('/appointments/me/waitlist', { params }),
  createMyWaitlistRequest: (body = {}) =>
    request('/appointments/me/waitlist', { method: 'POST', body }),
  listAppointments: (params) => request('/appointments', { params }),
  list: (params) => request('/appointments', { params }),
  search: (params) => request('/appointments/search', { params }),
  listToday: (params) => request('/appointments/today', { params }),
  listUpcoming: (params) => request('/appointments/upcoming', { params }),
  listByDoctor: (doctorId, params) => request(`/appointments/doctor/${encodeURIComponent(doctorId)}`, { params }),
  listByDate: (params) => request('/appointments/by-date', { params }),
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
  createQueueTicket: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/queue-ticket`, { method: 'POST', body }),
  createEncounter: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/encounter`, { method: 'POST', body }),
  linkEncounter: (appointmentId, body = {}) => request(`/appointments/${encodeURIComponent(appointmentId)}/link-encounter`, { method: 'POST', body }),
}

export const departmentAPI = {
  getActiveDepartments: () => request('/departments/active', { auth: false }),
}

export const scheduleAPI = {
  list: (params) => request('/schedules', { params }),
  dateRange: (params) => request('/schedules/date-range', { params }),
  getByDateRange: (params) => request('/schedules/public/date-range', { params, auth: false }),
  listByDoctor: (doctorId, params) => request(`/schedules/doctor/${encodeURIComponent(doctorId)}`, { params }),
  calendarByDoctor: (doctorId, params) => request(`/schedules/calendar/doctor/${encodeURIComponent(doctorId)}`, { params }),
  getAvailableSlots: (scheduleId) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/available-slots`, { auth: false }),
  slots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/slots`),
  availableSlots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/slots/available`),
  getBookedSlots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/slots/booked`),
  getBookedSlotsAlias: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/booked-slots`),
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
  getMyCurrent: () => request('/queue/me/current'),
  getMyCurrentDetail: () => request('/queue/me/current/detail'),
  list: (params) => request('/queue', { params }),
  boardByDoctor: (doctorId, params) => request(`/queue/doctor/${encodeURIComponent(doctorId)}/board`, { params }),
  detail: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}`),
  timeline: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/timeline`),
  summaryToday: (params) => request('/queue/summary/today', { params }),
  createFromAppointment: (appointmentId) => request(`/queue/appointment/${encodeURIComponent(appointmentId)}`, { method: 'POST', body: {} }),
  callNext: (body = {}) => request('/queue/call-next', { method: 'POST', body }),
  call: (ticketId, body = {}) => request(`/queue/${encodeURIComponent(ticketId)}/call`, { method: 'POST', body }),
  recall: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/recall`, { method: 'POST', body: {} }),
  skip: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/skip`, { method: 'POST', body: {} }),
  markNoShow: (ticketId, body = {}) => request(`/queue/${encodeURIComponent(ticketId)}/mark-no-show`, { method: 'POST', body }),
  startService: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/start-service`, { method: 'POST', body: {} }),
  complete: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/complete`, { method: 'POST', body: {} }),
  cancel: (ticketId) => request(`/queue/${encodeURIComponent(ticketId)}/cancel`, { method: 'POST', body: {} }),
  transfer: (ticketId, body = {}) => request(`/queue/${encodeURIComponent(ticketId)}/transfer`, { method: 'POST', body }),
}

export const directoryAPI = {
  getLocationNavigation: (locationId) => request(`/directory/locations/${encodeURIComponent(locationId)}/navigation`),
}

export const reportAPI = {
  doctors: (params) => request('/reports/doctors', { params }),
  appointments: (params) => request('/reports/appointments', { params }),
  encounters: (params) => request('/reports/encounters', { params }),
  queue: (params) => request('/reports/queue', { params }),
  inventory: (params) => request('/reports/inventory', { params }),
  export: (params) => request('/reports/export', { params }),
}

export const chatbotAPI = {
  createSession: (body = {}) => request('/chat/sessions', chatbotRequest({ method: 'POST', body })),
  getSession: (sessionId) => request(`/chat/sessions/${encodeURIComponent(sessionId)}`, chatbotRequest()),
  getMessages: (sessionId, params) =>
    request(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, chatbotRequest({ params })),
  sendMessage: (sessionId, body = {}) =>
    request(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, chatbotRequest({ method: 'POST', body })),
  escalate: (sessionId, body = {}) =>
    request(`/chat/sessions/${encodeURIComponent(sessionId)}/escalate`, chatbotRequest({ method: 'POST', body })),
  close: (sessionId) =>
    request(`/chat/sessions/${encodeURIComponent(sessionId)}/close`, chatbotRequest({ method: 'PATCH', body: {} })),
}

export const pharmacyReportAPI = {
  dashboard: (params) => request('/reports/pharmacy/dashboard', { params }),
  inventoryOverview: (params) => request('/reports/pharmacy/inventory-overview', { params }),
  inventoryMovement: (params) => request('/reports/pharmacy/inventory-movement', { params }),
  stockCard: (params) => request('/reports/pharmacy/stock-card', { params }),
  dispensing: (params) => request('/reports/pharmacy/dispensing', { params }),
  expiringStock: (params) => request('/reports/pharmacy/expiring-stock', { params }),
  lowStock: (params) => request('/reports/pharmacy/low-stock', { params }),
  reorderSuggestions: (params) => request('/reports/pharmacy/reorder-suggestions', { params }),
  inventoryValuation: (params) => request('/reports/pharmacy/inventory-valuation', { params }),
  highUsageMedications: (params) => request('/reports/pharmacy/high-usage-medications', { params }),
  wasteDisposal: (params) => request('/reports/pharmacy/waste-disposal', { params }),
  export: (body) => request('/reports/pharmacy/export', { method: 'POST', body }),
  exportHistory: (params) => request('/reports/pharmacy/export-history', { params }),
}

export const pharmacyConfigAPI = {
  qualityDashboard: (params) => request('/pharmacy-config/quality-dashboard', { params }),
  qualityCheck: (params) => request('/pharmacy-config/quality-check', { params }),
  runQualityCheck: (body = {}) => request('/pharmacy-config/quality-check/run', { method: 'POST', body }),

  units: (params) => request('/pharmacy-config/units', { params }),
  createUnit: (body = {}) => request('/pharmacy-config/units', { method: 'POST', body }),
  updateUnit: (unitId, body = {}) => request(`/pharmacy-config/units/${encodeURIComponent(unitId)}`, { method: 'PATCH', body }),
  mergeUnit: (unitId, body = {}) => request(`/pharmacy-config/units/${encodeURIComponent(unitId)}/merge`, { method: 'POST', body }),
  unitMedications: (unitId, params) => request(`/pharmacy-config/units/${encodeURIComponent(unitId)}/medications`, { params }),
  bulkAssignUnits: (body = {}) => request('/pharmacy-config/units/bulk-assign', { method: 'POST', body }),
  unitQuality: () => request('/pharmacy-config/units/quality-check'),

  dosageForms: (params) => request('/pharmacy-config/dosage-forms', { params }),
  createDosageForm: (body = {}) => request('/pharmacy-config/dosage-forms', { method: 'POST', body }),
  updateDosageForm: (dosageFormId, body = {}) => request(`/pharmacy-config/dosage-forms/${encodeURIComponent(dosageFormId)}`, { method: 'PATCH', body }),
  mergeDosageForm: (dosageFormId, body = {}) => request(`/pharmacy-config/dosage-forms/${encodeURIComponent(dosageFormId)}/merge`, { method: 'POST', body }),
  dosageFormMedications: (dosageFormId, params) => request(`/pharmacy-config/dosage-forms/${encodeURIComponent(dosageFormId)}/medications`, { params }),
  dosageFormRouteMapping: (dosageFormId, body = {}) => request(`/pharmacy-config/dosage-forms/${encodeURIComponent(dosageFormId)}/route-mapping`, { method: 'POST', body }),
  dosageFormQuality: () => request('/pharmacy-config/dosage-forms/quality-check'),

  routes: (params) => request('/pharmacy-config/routes', { params }),
  createRoute: (body = {}) => request('/pharmacy-config/routes', { method: 'POST', body }),
  updateRoute: (routeId, body = {}) => request(`/pharmacy-config/routes/${encodeURIComponent(routeId)}`, { method: 'PATCH', body }),
  mergeRoute: (routeId, body = {}) => request(`/pharmacy-config/routes/${encodeURIComponent(routeId)}/merge`, { method: 'POST', body }),
  routeMedications: (routeId, params) => request(`/pharmacy-config/routes/${encodeURIComponent(routeId)}/medications`, { params }),
  compatibilityCheck: (body = {}) => request('/pharmacy-config/routes/compatibility-check', { method: 'POST', body }),
  bulkAssignRoutes: (body = {}) => request('/pharmacy-config/routes/bulk-assign-medications', { method: 'POST', body }),
  routeQuality: () => request('/pharmacy-config/routes/quality-check'),

  storageLocations: (params) => request('/pharmacy-config/storage-locations', { params }),
  createStorageLocation: (body = {}) => request('/pharmacy-config/storage-locations', { method: 'POST', body }),
  updateStorageLocation: (locationId, body = {}) => request(`/pharmacy-config/storage-locations/${encodeURIComponent(locationId)}`, { method: 'PATCH', body }),
  lockStorageLocation: (locationId, body = {}) => request(`/pharmacy-config/storage-locations/${encodeURIComponent(locationId)}/lock`, { method: 'POST', body }),
  unlockStorageLocation: (locationId, body = {}) => request(`/pharmacy-config/storage-locations/${encodeURIComponent(locationId)}/unlock`, { method: 'POST', body }),
  storageLocationBatches: (locationId, params) => request(`/pharmacy-config/storage-locations/${encodeURIComponent(locationId)}/batches`, { params }),
  storageLocationTransactions: (locationId, params) => request(`/pharmacy-config/storage-locations/${encodeURIComponent(locationId)}/transactions`, { params }),
  printStorageLocationQr: (locationId) => request(`/pharmacy-config/storage-locations/${encodeURIComponent(locationId)}/print-qr`, { method: 'POST', body: {} }),
  bulkMoveBatches: (body = {}) => request('/pharmacy-config/storage-locations/bulk-move-batches', { method: 'POST', body }),
  startLocationCount: (locationId, body = {}) => request(`/pharmacy-config/storage-locations/${encodeURIComponent(locationId)}/start-count`, { method: 'POST', body }),
  storageLocationQuality: () => request('/pharmacy-config/storage-locations/quality-check'),

  suppliers: (params) => request('/pharmacy-config/suppliers', { params }),
  createSupplier: (body = {}) => request('/pharmacy-config/suppliers', { method: 'POST', body }),
  updateSupplier: (supplierId, body = {}) => request(`/pharmacy-config/suppliers/${encodeURIComponent(supplierId)}`, { method: 'PATCH', body }),
  blockSupplier: (supplierId, body = {}) => request(`/pharmacy-config/suppliers/${encodeURIComponent(supplierId)}/block`, { method: 'POST', body }),
  unblockSupplier: (supplierId, body = {}) => request(`/pharmacy-config/suppliers/${encodeURIComponent(supplierId)}/unblock`, { method: 'POST', body }),
  mergeSupplier: (supplierId, body = {}) => request(`/pharmacy-config/suppliers/${encodeURIComponent(supplierId)}/merge`, { method: 'POST', body }),
  supplierBatches: (supplierId, params) => request(`/pharmacy-config/suppliers/${encodeURIComponent(supplierId)}/batches`, { params }),
  supplierTransactions: (supplierId, params) => request(`/pharmacy-config/suppliers/${encodeURIComponent(supplierId)}/transactions`, { params }),
  supplierRiskDashboard: (supplierId) => request(`/pharmacy-config/suppliers/${encodeURIComponent(supplierId)}/risk-dashboard`),
  supplierQuality: () => request('/pharmacy-config/suppliers/quality-check'),

  alertRules: (params) => request('/pharmacy-config/alert-rules', { params }),
  createAlertRule: (body = {}) => request('/pharmacy-config/alert-rules', { method: 'POST', body }),
  updateAlertRule: (alertRuleId, body = {}) => request(`/pharmacy-config/alert-rules/${encodeURIComponent(alertRuleId)}`, { method: 'PATCH', body }),
  testAlertRule: (alertRuleId, body = {}) => request(`/pharmacy-config/alert-rules/${encodeURIComponent(alertRuleId)}/test`, { method: 'POST', body }),
  activateAlertRule: (alertRuleId) => request(`/pharmacy-config/alert-rules/${encodeURIComponent(alertRuleId)}/activate`, { method: 'POST', body: {} }),
  deactivateAlertRule: (alertRuleId) => request(`/pharmacy-config/alert-rules/${encodeURIComponent(alertRuleId)}/deactivate`, { method: 'POST', body: {} }),
  alertRulePreview: (params) => request('/pharmacy-config/alert-rules/preview', { params }),

  expiryPolicies: (params) => request('/pharmacy-config/expiry-policies', { params }),
  createExpiryPolicy: (body = {}) => request('/pharmacy-config/expiry-policies', { method: 'POST', body }),
  updateExpiryPolicy: (expiryPolicyId, body = {}) => request(`/pharmacy-config/expiry-policies/${encodeURIComponent(expiryPolicyId)}`, { method: 'PATCH', body }),
  testExpiryPolicy: (expiryPolicyId, body = {}) => request(`/pharmacy-config/expiry-policies/${encodeURIComponent(expiryPolicyId)}/test`, { method: 'POST', body }),
  activateExpiryPolicy: (expiryPolicyId) => request(`/pharmacy-config/expiry-policies/${encodeURIComponent(expiryPolicyId)}/activate`, { method: 'POST', body: {} }),
  deactivateExpiryPolicy: (expiryPolicyId) => request(`/pharmacy-config/expiry-policies/${encodeURIComponent(expiryPolicyId)}/deactivate`, { method: 'POST', body: {} }),
  fefoSimulator: (params) => request('/pharmacy-config/fefo-simulator', { params }),
  expiryQualityCheck: (params) => request('/pharmacy-config/expiry-quality-check', { params }),
  markExpiredBulk: (body = {}) => request('/pharmacy-config/batches/mark-expired-bulk', { method: 'POST', body }),

  controlledDrugPolicies: (params) => request('/pharmacy-config/controlled-drug-policies', { params }),
  createControlledDrugPolicy: (body = {}) => request('/pharmacy-config/controlled-drug-policies', { method: 'POST', body }),
  updateControlledDrugPolicy: (policyId, body = {}) => request(`/pharmacy-config/controlled-drug-policies/${encodeURIComponent(policyId)}`, { method: 'PATCH', body }),
  applyControlledDrugPolicy: (policyId, body = {}) => request(`/pharmacy-config/controlled-drug-policies/${encodeURIComponent(policyId)}/apply-medications`, { method: 'POST', body }),
  controlledDrugLedger: (params) => request('/pharmacy-config/controlled-drug-ledger', { params }),
  shiftCountControlledLedger: (body = {}) => request('/pharmacy-config/controlled-drug-ledger/shift-count', { method: 'POST', body }),
  wasteApprovalControlledLedger: (body = {}) => request('/pharmacy-config/controlled-drug-ledger/waste-approval', { method: 'POST', body }),
  doubleCheckControlledLedger: (body = {}) => request('/pharmacy-config/controlled-drug-ledger/double-check', { method: 'POST', body }),
}

export const dashboardAPI = {
  doctorMe: (params) => request('/dashboard/doctor/me', { params }),
  inventory: (params) => request('/dashboard/inventory', { params }),
}

export const doctorWorkspaceAPI = {
  overview: (params) => request('/doctor-workspace/overview', { params }),
  search: (params) => request('/doctor-workspace/search', { params }),
  tasks: (params) => request('/doctor-workspace/tasks', { params }),
  results: (params) => request('/doctor-workspace/results', { params }),
  patientSummary: (patientId, params) => request(`/doctor-workspace/patients/${encodeURIComponent(patientId)}/summary`, { params }),
  collaboration: (params) => request('/doctor-workspace/collaboration', { params }),
}

export const pharmacyOverviewAPI = {
  prescriptionWorkbench: (params) => request('/pharmacy/prescription-workbench', { params }),
  prescriptionRiskQueue: (params) => request('/pharmacy/prescription-risk-queue', { params }),
  dashboard: (params) => request('/pharmacy/overview/dashboard', { params }),
  workQueue: (params) => request('/pharmacy/overview/work-queue', { params }),
  dispensingToday: (params) => request('/pharmacy/overview/dispensing-today', { params }),
  alertsOverview: (params) => request('/pharmacy/overview/alerts', { params }),
  performance: (params) => request('/pharmacy/overview/performance', { params }),
  dispensingQueue: (params) => request('/pharmacy/dispensing/queue', { params }),
  dispensingQueueSummary: (params) => request('/pharmacy/dispensing/queue-summary', { params }),
  dispensingAnalytics: (params) => request('/pharmacy/dispensing/analytics', { params }),
  dispenseTimeline: (dispenseId) => request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/timeline`),
  listDispenseHolds: (params) => request('/pharmacy/dispense-holds', { params }),
  holdDetail: (holdId) => request(`/pharmacy/dispense-holds/${encodeURIComponent(holdId)}`),
  resolveDispenseHold: (holdId, body = {}) => request(`/pharmacy/dispense-holds/${encodeURIComponent(holdId)}/resolve`, { method: 'POST', body }),
  rejectDispenseHold: (holdId, body = {}) => request(`/pharmacy/dispense-holds/${encodeURIComponent(holdId)}/reject`, { method: 'POST', body }),
  cancelDispenseHold: (holdId, body = {}) => request(`/pharmacy/dispense-holds/${encodeURIComponent(holdId)}/cancel`, { method: 'POST', body }),
  listDispenseReturns: (params) => request('/pharmacy/dispense-returns', { params }),
  returnDetail: (returnId) => request(`/pharmacy/dispense-returns/${encodeURIComponent(returnId)}`),
  approveDispenseReturn: (returnId, body = {}) => request(`/pharmacy/dispense-returns/${encodeURIComponent(returnId)}/approve`, { method: 'POST', body }),
  completeDispenseReturn: (returnId, body = {}) => request(`/pharmacy/dispense-returns/${encodeURIComponent(returnId)}/complete`, { method: 'POST', body }),
  cancelDispenseReturn: (returnId, body = {}) => request(`/pharmacy/dispense-returns/${encodeURIComponent(returnId)}/cancel`, { method: 'POST', body }),
  listPrintJobs: (params) => request('/pharmacy/print-jobs', { params }),
  alertSummary: (params) => request('/pharmacy/alerts/summary', { params }),
  lowStockAlerts: (params) => request('/pharmacy/alerts/low-stock', { params }),
  outOfStockAlerts: (params) => request('/pharmacy/alerts/out-of-stock', { params }),
  expiringBatchAlerts: (params) => request('/pharmacy/alerts/expiring-batches', { params }),
  expiredBatchAlerts: (params) => request('/pharmacy/alerts/expired-batches', { params }),
  dispenseShortageAlerts: (params) => request('/pharmacy/alerts/dispense-shortage', { params }),
  allergyAlerts: (params) => request('/pharmacy/alerts/allergy', { params }),
  highUsageAlerts: (params) => request('/pharmacy/alerts/high-usage', { params }),
  wasteLossAlerts: (params) => request('/pharmacy/alerts/waste-loss', { params }),
  listAlerts: (params) => request('/pharmacy/alerts', { params }),
  createAlert: (body = {}) => request('/pharmacy/alerts', { method: 'POST', body }),
  acknowledgeAlert: (alertId, body = {}) => request(`/pharmacy/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body }),
  assignAlert: (alertId, body = {}) => request(`/pharmacy/alerts/${encodeURIComponent(alertId)}/assign`, { method: 'POST', body }),
  startAlert: (alertId, body = {}) => request(`/pharmacy/alerts/${encodeURIComponent(alertId)}/start`, { method: 'POST', body }),
  snoozeAlert: (alertId, body = {}) => request(`/pharmacy/alerts/${encodeURIComponent(alertId)}/snooze`, { method: 'POST', body }),
  resolveAlert: (alertId, body = {}) => request(`/pharmacy/alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body }),
  dismissAlert: (alertId, body = {}) => request(`/pharmacy/alerts/${encodeURIComponent(alertId)}/dismiss`, { method: 'POST', body }),
  escalateAlert: (alertId, body = {}) => request(`/pharmacy/alerts/${encodeURIComponent(alertId)}/escalate`, { method: 'POST', body }),
  bulkAlertAction: (body = {}) => request('/pharmacy/alerts/bulk-action', { method: 'POST', body }),
  listWorkItems: (params) => request('/pharmacy/work-items', { params }),
  createWorkItem: (body = {}) => request('/pharmacy/work-items', { method: 'POST', body }),
  assignWorkItem: (workItemId, body = {}) => request(`/pharmacy/work-items/${encodeURIComponent(workItemId)}/assign`, { method: 'POST', body }),
  startWorkItem: (workItemId, body = {}) => request(`/pharmacy/work-items/${encodeURIComponent(workItemId)}/start`, { method: 'POST', body }),
  holdWorkItem: (workItemId, body = {}) => request(`/pharmacy/work-items/${encodeURIComponent(workItemId)}/hold`, { method: 'POST', body }),
  escalateWorkItem: (workItemId, body = {}) => request(`/pharmacy/work-items/${encodeURIComponent(workItemId)}/escalate`, { method: 'POST', body }),
  resolveWorkItem: (workItemId, body = {}) => request(`/pharmacy/work-items/${encodeURIComponent(workItemId)}/resolve`, { method: 'POST', body }),
  cancelWorkItem: (workItemId, body = {}) => request(`/pharmacy/work-items/${encodeURIComponent(workItemId)}/cancel`, { method: 'POST', body }),
  medicationSummary: (params) => request('/pharmacy/medications/summary', { params }),
  listPharmacyMedications: (params) => request('/pharmacy/medications', { params }),
  pharmacyMedicationDetail: (medicationId) => request(`/pharmacy/medications/${encodeURIComponent(medicationId)}`),
  pharmacyStockSelection: (medicationId, params) => request(`/pharmacy/medications/${encodeURIComponent(medicationId)}/stock-selection`, { params }),
  listPharmacyStockBatches: (params) => request('/pharmacy/stock-batches', { params }),
  pharmacyStockBatchDetail: (batchId) => request(`/pharmacy/stock-batches/${encodeURIComponent(batchId)}`),
  currentStock: (params) => request('/pharmacy/inventory/current-stock', { params }),
  inventoryCenter: (params) => request('/pharmacy/inventory/center', { params }),
  listInventoryTransactions: (params) => request('/pharmacy/inventory/transactions', { params }),
  inventoryTransactionDetail: (transactionId) => request(`/pharmacy/inventory/transactions/${encodeURIComponent(transactionId)}`),
  listInventoryReceipts: (params) => request('/pharmacy/inventory/receipts', { params }),
  createInventoryReceipt: (body = {}) => request('/pharmacy/inventory/receipts', { method: 'POST', body }),
  postInventoryReceipt: (receiptId, body = {}) => request(`/pharmacy/inventory/receipts/${encodeURIComponent(receiptId)}/post`, { method: 'POST', body }),
  listInternalIssues: (params) => request('/pharmacy/inventory/issues', { params }),
  createInternalIssue: (body = {}) => request('/pharmacy/inventory/issues', { method: 'POST', body }),
  dispatchInternalIssue: (issueId, body = {}) => request(`/pharmacy/inventory/issues/${encodeURIComponent(issueId)}/dispatch`, { method: 'POST', body }),
  listInventoryTransfers: (params) => request('/pharmacy/inventory/transfers', { params }),
  createInventoryTransfer: (body = {}) => request('/pharmacy/inventory/transfers', { method: 'POST', body }),
  dispatchInventoryTransfer: (transferId, body = {}) => request(`/pharmacy/inventory/transfers/${encodeURIComponent(transferId)}/dispatch`, { method: 'POST', body }),
  listInventoryDisposals: (params) => request('/pharmacy/inventory/disposals', { params }),
  createInventoryDisposal: (body = {}) => request('/pharmacy/inventory/disposals', { method: 'POST', body }),
  postInventoryDisposal: (disposalId, body = {}) => request(`/pharmacy/inventory/disposals/${encodeURIComponent(disposalId)}/post`, { method: 'POST', body }),
  listInventoryReturns: (params) => request('/pharmacy/inventory/returns', { params }),
  createInventoryReturn: (body = {}) => request('/pharmacy/inventory/returns', { method: 'POST', body }),
  postInventoryReturn: (returnId, body = {}) => request(`/pharmacy/inventory/returns/${encodeURIComponent(returnId)}/post`, { method: 'POST', body }),
  listWarehouses: (params) => request('/pharmacy/warehouses', { params }),
  listStorageLocations: (params) => request('/pharmacy/storage-locations', { params }),
  expiryRisk: (params) => request('/pharmacy/expiry-risk', { params }),
  listStocktakes: (params) => request('/pharmacy/stocktakes', { params }),
  createStocktake: (body = {}) => request('/pharmacy/stocktakes', { method: 'POST', body }),
  stocktakeDetail: (stocktakeId, params) => request(`/pharmacy/stocktakes/${encodeURIComponent(stocktakeId)}`, { params }),
  startStocktake: (stocktakeId, body = {}) => request(`/pharmacy/stocktakes/${encodeURIComponent(stocktakeId)}/start`, { method: 'POST', body }),
  generateStocktakeItems: (stocktakeId, body = {}) => request(`/pharmacy/stocktakes/${encodeURIComponent(stocktakeId)}/items/generate`, { method: 'POST', body }),
  countStocktakeItem: (stocktakeId, stocktakeItemId, body = {}) => request(`/pharmacy/stocktakes/${encodeURIComponent(stocktakeId)}/items/${encodeURIComponent(stocktakeItemId)}/count`, { method: 'PATCH', body }),
  reviewStocktake: (stocktakeId, body = {}) => request(`/pharmacy/stocktakes/${encodeURIComponent(stocktakeId)}/review`, { method: 'POST', body }),
  postStocktakeAdjustments: (stocktakeId, body = {}) => request(`/pharmacy/stocktakes/${encodeURIComponent(stocktakeId)}/post-adjustments`, { method: 'POST', body }),
  cancelStocktake: (stocktakeId, body = {}) => request(`/pharmacy/stocktakes/${encodeURIComponent(stocktakeId)}/cancel`, { method: 'POST', body }),
  inpatientMedicationScheduleBoard: (params) => request('/pharmacy/inpatient-medications/schedule-board', { params }),
  inpatientMedicationTodayCommandCenter: (params) => request('/pharmacy/inpatient-medications/today-command-center', { params }),
  inpatientMedicationConfirmWorkbench: (params) => request('/pharmacy/inpatient-medications/confirm-workbench', { params }),
  inpatientMedicationExceptions: (params) => request('/pharmacy/inpatient-medications/exceptions', { params }),
  inpatientMedicationReactions: (params) => request('/pharmacy/inpatient-medications/reactions', { params }),
  inpatientMedicationReactionDetail: (reactionId) => request(`/pharmacy/inpatient-medications/reactions/${encodeURIComponent(reactionId)}`),
  pharmacistReviewMedicationReaction: (reactionId, body = {}) => request(`/pharmacy/inpatient-medications/reactions/${encodeURIComponent(reactionId)}/pharmacist-review`, { method: 'POST', body }),
  resolveMedicationReaction: (reactionId, body = {}) => request(`/pharmacy/inpatient-medications/reactions/${encodeURIComponent(reactionId)}/resolve`, { method: 'POST', body }),
  createMedicationIntervention: (body = {}) => request('/pharmacy/inpatient-medications/interventions', { method: 'POST', body }),
}

export const inpatientMedicationAPI = {
  list: (params) => request('/inpatient/medication-administrations', { params }),
  detail: (administrationId) => request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}`),
  byAdmission: (admissionId, params) => request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/medication-administrations`, { params }),
  generateFromPrescription: (body = {}) => request('/inpatient/medication-administrations/generate-from-prescription', { method: 'POST', body }),
  verifyScan: (body = {}) => request('/inpatient/medication-administrations/verify-scan', { method: 'POST', body }),
  administer: (administrationId, body = {}) => request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/administer`, { method: 'POST', body }),
  hold: (administrationId, body = {}) => request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/hold`, { method: 'POST', body }),
  refuse: (administrationId, body = {}) => request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/refuse`, { method: 'POST', body }),
  omit: (administrationId, body = {}) => request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/omit`, { method: 'POST', body }),
  reschedule: (administrationId, body = {}) => request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/reschedule`, { method: 'POST', body }),
  enteredInError: (administrationId, body = {}) => request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/entered-in-error`, { method: 'POST', body }),
  addReaction: (administrationId, body = {}) => request(`/medication-administrations/${encodeURIComponent(administrationId)}/reactions`, { method: 'POST', body }),
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
  resume: (encounterId) => request(`/encounters/${encodeURIComponent(encounterId)}/resume`, { method: 'POST', body: {} }),
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
  listByPatient: (patientId, params) => request(`/orders/patient/${encodeURIComponent(patientId)}`, { params }),
  listByDoctor: (doctorId, params) => request(`/orders/doctor/${encodeURIComponent(doctorId)}`, { params }),
  listByDoctorPage: (doctorId, params) => request(`/orders/doctor/${encodeURIComponent(doctorId)}`, { params }),
  listByDepartment: (departmentId, params) => request(`/orders/department/${encodeURIComponent(departmentId)}`, { params }),
  listByEncounter: (encounterId, params) => request(`/orders/encounter/${encodeURIComponent(encounterId)}`, { params }),
  encounterSummary: (encounterId, params) => request(`/orders/encounter/${encodeURIComponent(encounterId)}/summary`, { params }),
  detail: (orderId) => request(`/orders/${encodeURIComponent(orderId)}`),
  timeline: (orderId) => request(`/orders/${encodeURIComponent(orderId)}/timeline`),
  createForEncounter: (encounterId, body) => request(`/encounters/${encodeURIComponent(encounterId)}/orders`, { method: 'POST', body }),
  update: (orderId, body) => request(`/orders/${encodeURIComponent(orderId)}`, { method: 'PATCH', body }),
  dispatch: (orderId, body = {}) => request(`/orders/${encodeURIComponent(orderId)}/dispatch`, { method: 'POST', body }),
  acknowledge: (orderId, body = {}) => request(`/orders/${encodeURIComponent(orderId)}/acknowledge`, { method: 'POST', body }),
  start: (orderId, body = {}) => request(`/orders/${encodeURIComponent(orderId)}/start`, { method: 'POST', body }),
  complete: (orderId, body = {}) => request(`/orders/${encodeURIComponent(orderId)}/complete`, { method: 'POST', body }),
  cancel: (orderId, body = {}) => request(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body }),
  enteredInError: (orderId, body = {}) => request(`/orders/${encodeURIComponent(orderId)}/entered-in-error`, { method: 'POST', body }),
  createCharge: (orderId, body = {}) => request(`/orders/${encodeURIComponent(orderId)}/create-charge`, { method: 'POST', body }),
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
  getMyPrescriptionDispenseStatus: (prescriptionId) =>
    request(`/prescriptions/me/${encodeURIComponent(prescriptionId)}/dispense-status`),
  getMyPrescriptionInstructions: (prescriptionId) =>
    request(`/prescriptions/me/${encodeURIComponent(prescriptionId)}/instructions`),
  getMyRefillRequests: (params) => request('/prescriptions/me/refill-requests', { params }),
  createMyRefillRequest: (prescriptionId, body = {}) =>
    request(`/prescriptions/me/${encodeURIComponent(prescriptionId)}/refill-requests`, { method: 'POST', body }),
  list: (params) => request('/prescriptions', { params }),
  search: (params) => request('/prescriptions/search', { params }),
  listByEncounter: (encounterId, params) => request(`/prescriptions/encounter/${encodeURIComponent(encounterId)}`, { params }),
  listByPatient: (patientId, params) => request(`/prescriptions/patient/${encodeURIComponent(patientId)}`, { params }),
  listActiveByPatient: (patientId, params) => request(`/prescriptions/patient/${encodeURIComponent(patientId)}/active`, { params }),
  listByDoctor: (doctorId, params) => request(`/prescriptions/doctor/${encodeURIComponent(doctorId)}`, { params }),
  detail: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}`),
  summary: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/summary`),
  create: (body) => request('/prescriptions', { method: 'POST', body }),
  createForEncounter: (encounterId, body) => request(`/prescriptions/encounters/${encodeURIComponent(encounterId)}/prescriptions`, { method: 'POST', body }),
  update: (prescriptionId, body) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}`, { method: 'PATCH', body }),
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
  verify: (prescriptionId, body = {}) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/verify`, { method: 'POST', body }),
  activate: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/activate`, { method: 'POST', body: {} }),
  cancel: (prescriptionId, body = {}) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/cancel`, { method: 'POST', body }),
  complete: (prescriptionId, body = {}) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/complete`, { method: 'POST', body }),
  duplicate: (prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/duplicate`, { method: 'POST', body: {} }),
  renew: (prescriptionId, body = {}) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/renew`, { method: 'POST', body }),
  listRefillRequests: (params) => request('/prescriptions/refill-requests', { params }),
  refillRequestDetail: (refillRequestId) => request(`/prescriptions/refill-requests/${encodeURIComponent(refillRequestId)}`),
  createRefillRequest: (prescriptionId, body = {}) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/refill-requests`, { method: 'POST', body }),
  approveRefillRequest: (refillRequestId, body = {}) => request(`/prescriptions/refill-requests/${encodeURIComponent(refillRequestId)}/approve`, { method: 'POST', body }),
  rejectRefillRequest: (refillRequestId, body = {}) => request(`/prescriptions/refill-requests/${encodeURIComponent(refillRequestId)}/reject`, { method: 'POST', body }),
  sendRefillRequestToDoctor: (refillRequestId, body = {}) => request(`/prescriptions/refill-requests/${encodeURIComponent(refillRequestId)}/send-to-doctor`, { method: 'POST', body }),
  convertRefillRequestToPrescription: (refillRequestId, body = {}) => request(`/prescriptions/refill-requests/${encodeURIComponent(refillRequestId)}/convert-to-prescription`, { method: 'POST', body }),
  listDispenses: (params) => request('/prescriptions/dispenses', { params }),
  dispenseDetail: (dispenseId) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}`),
  createDispense: (prescriptionId, body = {}) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/dispenses`, { method: 'POST', body }),
  previewDispenseCompletionPlan: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/preview-completion-plan`, { method: 'POST', body }),
  completeDispense: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/complete`, { method: 'POST', body }),
  cancelDispense: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/cancel`, { method: 'POST', body }),
  assignDispense: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/assign`, { method: 'POST', body }),
  startDispensePreparation: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/start-preparation`, { method: 'POST', body }),
  changeDispenseStage: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/change-stage`, { method: 'POST', body }),
  lockDispense: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/lock`, { method: 'POST', body }),
  unlockDispense: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/unlock`, { method: 'POST', body }),
  dispenseChecklist: (dispenseId) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/checklist`),
  updateDispenseChecklistItem: (dispenseId, code, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/checklist/${encodeURIComponent(code)}`, { method: 'PATCH', body }),
  completeDispenseChecklist: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/checklist/complete`, { method: 'POST', body }),
  createDispenseHold: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/holds`, { method: 'POST', body }),
  previewDispenseReturn: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/return-preview`, { method: 'POST', body }),
  createDispenseReturn: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/returns`, { method: 'POST', body }),
  labelPreview: (dispenseId) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/label-preview`),
  printLabels: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/print-labels`, { method: 'POST', body }),
  printInstructions: (dispenseId, body = {}) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/print-instructions`, { method: 'POST', body }),
  dispensePrintJobs: (dispenseId) => request(`/prescriptions/dispenses/${encodeURIComponent(dispenseId)}/print-jobs`),
  listMedications: (params) => request('/prescriptions/medications', { params }),
  medicationDetail: (medicationId) => request(`/prescriptions/medications/${encodeURIComponent(medicationId)}`),
  stockSelection: (medicationId, params) => request(`/prescriptions/medications/${encodeURIComponent(medicationId)}/stock-selection`, { params }),
  listStockBatches: (params) => request('/prescriptions/stock-batches', { params }),
  stockBatchDetail: (batchId) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}`),
  adjustStockBatch: (batchId, body = {}) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}/adjustment`, { method: 'POST', body }),
  quarantineStockBatch: (batchId, body = {}) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}/quarantine`, { method: 'POST', body }),
  releaseQuarantineStockBatch: (batchId, body = {}) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}/release-quarantine`, { method: 'POST', body }),
  wasteStockBatch: (batchId, body = {}) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}/waste`, { method: 'POST', body }),
  transferStockBatchLocation: (batchId, body = {}) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}/transfer-location`, { method: 'POST', body }),
  stockBatchRecallImpact: (batchId) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}/recall-impact`),
  markStockBatchExpired: (batchId, body = {}) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}/expire`, { method: 'POST', body }),
  recallStockBatch: (batchId, body = {}) => request(`/prescriptions/stock-batches/${encodeURIComponent(batchId)}/recall`, { method: 'POST', body }),
  listInventoryTransactions: (params) => request('/prescriptions/inventory/transactions', { params }),
  receiveInventory: (body = {}) => request('/prescriptions/inventory/receipts', { method: 'POST', body }),
  adjustInventory: (body = {}) => request('/prescriptions/inventory/adjustments', { method: 'POST', body }),
}
