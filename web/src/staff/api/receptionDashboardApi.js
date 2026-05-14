import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function request(path, params = {}) {
  const response = await fetchWithAuth(buildUrl(path, params));

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const apiError = new Error(payload?.message || 'Không thể tải dữ liệu dashboard lễ tân.');
    apiError.status = response.status;
    apiError.payload = payload;
    throw apiError;
  }

  return payload?.data || null;
}

export const receptionDashboardApi = {
  getDepartmentDashboard: (departmentId) =>
    request(`/dashboard/department/${encodeURIComponent(departmentId)}`),
  getSystemDashboard: () => request('/dashboard/system'),
  getAppointmentSummary: (params) => request('/appointments/summary', params),
  getTodayAppointments: (params) => request('/appointments/today', params),
  getQueueSummaryToday: (params) => request('/queue/summary/today', params),
  getQueueTickets: (params) => request('/queue', params),
  getSchedulingSystemSummary: (params) => request('/schedules/summary/system', params),
  getSchedulingDepartmentSummary: (params) => request('/schedules/summary/departments', params),
  getSchedulingDateRangeSummary: (params) => request('/schedules/summary/date-range', params),
  getUnreadNotificationsCount: () => request('/notifications/unread-count'),
  getNotifications: (params) => request('/notifications', params),
  getAppointmentReport: (params) => request('/reports/appointments', params),
  getQueueReport: (params) => request('/reports/queue', params),
  getEncounterReport: (params) => request('/reports/encounters', params),
  getDepartmentReport: (params) => request('/reports/departments', params),
  getRevenueReport: (params) => request('/reports/revenue', params),
  getTodayEncounters: (params) => request('/encounters/today', params),
  listInvoices: (params) => request('/billing/invoices', params),
};
