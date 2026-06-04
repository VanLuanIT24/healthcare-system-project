import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function request(path, { method = 'GET', params, body } = {}) {
  const response = await fetchWithAuth(buildUrl(path, params), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const apiError = new Error(payload?.message || 'Không thể tải dữ liệu.');
    apiError.status = response.status;
    apiError.payload = payload;
    throw apiError;
  }

  return payload?.data || null;
}

export const receptionDataApi = {
  getReceptionBootstrap: () => request('/reception/bootstrap'),
  getReceptionDashboard: (params) => request('/reception/dashboard', { params }),
  getReceptionSidebarCounters: (params) => request('/reception/sidebar-counters', { params }),
  getReceptionActivityFeed: (params) => request('/reception/activity-feed', { params }),
  globalSearch: (params) => request('/reception/search', { params }),
  getPatientCard: (patientId, params) =>
    request(`/reception/patients/${encodeURIComponent(patientId)}/card`, { params }),
  getReceptionWorklist: (params) => request('/reception/worklist', { params }),
  getReceptionQueueBoard: (params) => request('/reception/queue-board', { params }),
  getReceptionWaitingPatients: (params) => request('/reception/waiting-patients', { params }),
  getReceptionRecentCheckins: (params) => request('/reception/checkins/recent', { params }),
  getReceptionCheckinErrors: (params) => request('/reception/checkins/errors', { params }),
  quickCheckin: (body) => request('/reception/checkin/quick', { method: 'POST', body }),
  qrCheckin: (body) => request('/reception/checkin/qr', { method: 'POST', body }),
  walkInCheckin: (body) => request('/reception/walk-in-checkin', { method: 'POST', body }),
  getReceptionRoutingOptions: (params) => request('/reception/routing-options', { params }),
  routePatient: (body) => request('/reception/route-patient', { method: 'POST', body }),
  getReceptionPrintTemplates: () => request('/reception/print/templates'),
  printQueueTicket: (ticketId, body) =>
    request(`/reception/print/queue-ticket/${encodeURIComponent(ticketId)}`, { method: 'POST', body }),
  printPaymentGuide: (invoiceId, body) =>
    request(`/reception/print/payment-guide/${encodeURIComponent(invoiceId)}`, { method: 'POST', body }),
  routeToCashier: (body) => request('/reception/route-to-cashier', { method: 'POST', body }),
  getMe: () => request('/auth/me'),
  updateMe: (body) => request('/auth/me', { method: 'PATCH', body }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),
  listMySessions: () => request('/auth/me/sessions'),
  revokeMySession: (sessionId) =>
    request(`/auth/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  listInvoices: (params) => request('/billing/invoices', { params }),
  getInvoiceDetail: (invoiceId, params) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceId)}`, { params }),
  listCashierUnpaidInvoices: (params) => request('/billing/cashier/unpaid-invoices', { params }),
  searchCashierBilling: (params) => request('/billing/cashier/search', { params }),
  getCashierWorkbench: (params) => request('/billing/cashier/workbench', { params }),
  collectCashierPayment: (invoiceId, body) =>
    request(`/billing/cashier/invoices/${encodeURIComponent(invoiceId)}/collect`, { method: 'POST', body }),
  listPayments: (params) => request('/billing/payments', { params }),
  getPaymentDetail: (paymentId, params) =>
    request(`/billing/payments/${encodeURIComponent(paymentId)}`, { params }),
  createPayment: (invoiceId, body) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, { method: 'POST', body }),
  refundPayment: (paymentId, body) =>
    request(`/billing/payments/${encodeURIComponent(paymentId)}/refund`, { method: 'POST', body }),
  createPaymentIntent: (invoiceId, body) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceId)}/payment-intents`, { method: 'POST', body }),
  listPaymentIntents: (params) => request('/billing/payment-intents', { params }),
  getPaymentIntent: (intentId, params) =>
    request(`/billing/payment-intents/${encodeURIComponent(intentId)}`, { params }),
  getPaymentIntentProviderStatus: (intentId, params) =>
    request(`/billing/payment-intents/${encodeURIComponent(intentId)}/provider-status`, { params }),
  confirmBankTransfer: (intentId, body) =>
    request(`/billing/payment-intents/${encodeURIComponent(intentId)}/confirm-bank-transfer`, { method: 'POST', body }),
  rejectBankTransfer: (intentId, body) =>
    request(`/billing/payment-intents/${encodeURIComponent(intentId)}/reject-bank-transfer`, { method: 'POST', body }),
  markPaymentIntentManualReview: (intentId, body) =>
    request(`/billing/payment-intents/${encodeURIComponent(intentId)}/manual-review`, { method: 'POST', body }),
  listManualPayments: (params) => request('/billing/manual-payments', { params }),
  listCashierManualPayments: (params) => request('/billing/cashier/manual-payments', { params }),
  confirmManualPayment: (intentId, body) =>
    request(`/billing/manual-payments/${encodeURIComponent(intentId)}/confirm`, { method: 'POST', body }),
  rejectManualPayment: (intentId, body) =>
    request(`/billing/manual-payments/${encodeURIComponent(intentId)}/reject`, { method: 'POST', body }),
  confirmCashierManualPayment: (paymentId, body) =>
    request(`/billing/cashier/manual-payments/${encodeURIComponent(paymentId)}/confirm`, { method: 'POST', body }),
  rejectCashierManualPayment: (paymentId, body) =>
    request(`/billing/cashier/manual-payments/${encodeURIComponent(paymentId)}/reject`, { method: 'POST', body }),
  checkCashierTransactionRef: (params) => request('/billing/cashier/transaction-ref-check', { params }),
  listPaymentProviders: (params) => request('/payments/providers', { params }),

  searchReceptionPatients: (params) => request('/reception/search/patients', { params }),
  searchPatients: (params) => request('/patients/search', { params }),
  createPatientPortalAccount: (patientId, body) =>
    request(`/patients/${encodeURIComponent(patientId)}/account`, { method: 'POST', body }),
  linkPatientPortalAccount: (patientId, body) =>
    request(`/patients/${encodeURIComponent(patientId)}/link-account`, { method: 'POST', body }),
  listPatientPortalAccounts: (params) => request('/admin/patient-portal/accounts', { params }),
  getPatientPortalAccount: (accountId, params) =>
    request(`/admin/patient-portal/accounts/${encodeURIComponent(accountId)}`, { params }),
  resetPatientPortalPassword: (accountId, body) =>
    request(`/admin/patient-portal/accounts/${encodeURIComponent(accountId)}/reset-password`, { method: 'POST', body }),
  resendPatientPortalVerification: (accountId, body) =>
    request(`/admin/patient-portal/accounts/${encodeURIComponent(accountId)}/resend-verification`, { method: 'POST', body }),
  unlockPatientPortalAccount: (accountId, body) =>
    request(`/admin/patient-portal/accounts/${encodeURIComponent(accountId)}/unlock`, { method: 'POST', body }),
  forceLogoutPatientPortalAccount: (accountId, body) =>
    request(`/admin/patient-portal/accounts/${encodeURIComponent(accountId)}/force-logout`, { method: 'POST', body }),
  getPatientAppointments: (patientId, params) =>
    request(`/appointments/patient/${encodeURIComponent(patientId)}`, { params }),

  listSupportTickets: (params) => request('/support/tickets', { params }),
  createSupportTicket: (body) => request('/support/tickets', { method: 'POST', body }),
  getSupportTicket: (ticketId, params) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}`, { params }),
  replySupportTicket: (ticketId, body) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/reply`, { method: 'POST', body }),
  assignSupportTicket: (ticketId, body) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/assign`, { method: 'POST', body }),
  changeSupportTicketPriority: (ticketId, body) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/change-priority`, { method: 'POST', body }),
  resolveSupportTicket: (ticketId, body) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/resolve`, { method: 'POST', body }),
  closeSupportTicket: (ticketId, body) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/close`, { method: 'POST', body }),
  reopenSupportTicket: (ticketId, body) =>
    request(`/support/tickets/${encodeURIComponent(ticketId)}/reopen`, { method: 'POST', body }),
  getSupportOverview: (params) => request('/admin/support-communication/overview', { params }),
  getSupportSlaOverview: (params) => request('/admin/support-communication/sla/overview', { params }),
  getSupportTicketContext: (ticketId, params) =>
    request(`/admin/support-communication/tickets/${encodeURIComponent(ticketId)}/context`, { params }),
  getSupportTicketPaymentContext: (ticketId, params) =>
    request(`/admin/support-communication/tickets/${encodeURIComponent(ticketId)}/payment-context`, { params }),
  getSupportTicketAccountContext: (ticketId, params) =>
    request(`/admin/support-communication/tickets/${encodeURIComponent(ticketId)}/account-context`, { params }),
  addSupportInternalNote: (ticketId, body) =>
    request(`/admin/support-communication/tickets/${encodeURIComponent(ticketId)}/internal-note`, { method: 'POST', body }),
  escalateSupportTicket: (ticketId, body) =>
    request(`/admin/support-communication/tickets/${encodeURIComponent(ticketId)}/escalate`, { method: 'POST', body }),
  linkSupportInvoice: (ticketId, body) =>
    request(`/admin/support-communication/tickets/${encodeURIComponent(ticketId)}/link-invoice`, { method: 'POST', body }),
  linkSupportPaymentIntent: (ticketId, body) =>
    request(`/admin/support-communication/tickets/${encodeURIComponent(ticketId)}/link-payment-intent`, { method: 'POST', body }),

  listConversations: (params) => request('/messages/conversations', { params }),
  createConversation: (body) => request('/messages/conversations', { method: 'POST', body }),
  getConversation: (conversationId, params) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}`, { params }),
  listConversationMessages: (conversationId, params) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { params }),
  sendConversationMessage: (conversationId, body) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body }),
  markConversationRead: (conversationId, body) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST', body }),
  assignConversation: (conversationId, body) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/assign`, { method: 'POST', body }),
  escalateConversation: (conversationId, body) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/escalate`, { method: 'POST', body }),
  closeConversation: (conversationId, body) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/close`, { method: 'POST', body }),
  reopenConversation: (conversationId, body) =>
    request(`/messages/conversations/${encodeURIComponent(conversationId)}/reopen`, { method: 'POST', body }),

  listNotifications: (params) => request('/notifications', { params }),
  createNotification: (body) => request('/notifications', { method: 'POST', body }),
  createBulkNotifications: (body) => request('/notifications/bulk', { method: 'POST', body }),
  getNotificationCounters: (params) => request('/notifications/counters', { params }),
  listAdminNotifications: (params) => request('/notifications/admin', { params }),
  listFailedNotifications: (params) => request('/notifications/admin/failed', { params }),
  listNotificationTemplates: (params) =>
    request('/admin/support-communication/notification-templates', { params }),
  listNotificationDeliveries: (params) =>
    request('/admin/support-communication/notifications/deliveries', { params }),
  retryNotificationDelivery: (deliveryId, body) =>
    request(`/admin/support-communication/notifications/deliveries/${encodeURIComponent(deliveryId)}/retry`, { method: 'POST', body }),
  markNotificationRead: (notificationId) =>
    request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
  getMyPreferences: () => request('/preferences/me'),
  updateMyPreferences: (body) => request('/preferences/me', { method: 'PATCH', body }),
  listSchedules: (params) => request('/schedules', { params }),
  getScheduleSystemSummary: (params) => request('/schedules/summary/system', { params }),
  getDepartmentScheduleSummary: (params) => request('/schedules/summary/departments', { params }),
  getAppointmentReport: (params) => request('/reports/appointments', { params }),
  getQueueReport: (params) => request('/reports/queue', { params }),
  getRevenueReport: (params) => request('/reports/revenue', { params }),
  listSystemSettingsGrouped: (params) => request('/admin/settings/grouped', { params }),
  updateSystemSetting: (settingKey, body) =>
    request(`/admin/settings/${encodeURIComponent(settingKey)}`, { method: 'PATCH', body }),
};
