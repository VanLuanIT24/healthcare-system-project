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
  getMe: () => request('/auth/me'),
  updateMe: (body) => request('/auth/me', { method: 'PATCH', body }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),
  listMySessions: () => request('/auth/me/sessions'),
  revokeMySession: (sessionId) =>
    request(`/auth/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  listInvoices: (params) => request('/billing/invoices', { params }),
  listPayments: (params) => request('/billing/payments', { params }),
  createPayment: (invoiceId, body) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, { method: 'POST', body }),
  refundPayment: (paymentId, body) =>
    request(`/billing/payments/${encodeURIComponent(paymentId)}/refund`, { method: 'POST', body }),
  listNotifications: (params) => request('/notifications', { params }),
  markNotificationRead: (notificationId) =>
    request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
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
