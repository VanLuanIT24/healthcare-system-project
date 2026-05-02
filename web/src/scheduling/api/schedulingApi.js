import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildUrl(path, params) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function request(path, { method = 'GET', params, body, auth = true } = {}) {
  const fetcher = auth ? fetchWithAuth : fetch;
  let response;
  try {
    response = await fetcher(buildUrl(path, params), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error('Không gọi được API lịch khám. Kiểm tra backend http://localhost:3000 có đang chạy không.');
  }
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(payload?.message || 'Phiên đăng nhập nhân sự đã hết hạn hoặc thiếu token truy cập.');
    }
    if (response.status === 403) {
      throw new Error(payload?.message || 'Tài khoản hiện tại chưa có quyền thao tác lịch khám.');
    }
    throw new Error(payload?.message || 'Máy chủ lịch khám trả về lỗi không hợp lệ.');
  }

  return payload?.data;
}

export const schedulingApi = {
  getSystemSummary: (params) => request('/schedules/summary/system', { params }),
  getDepartmentSummary: (params) => request('/schedules/summary/departments', { params }),
  getDateRangeSummary: (params) => request('/schedules/summary/date-range', { params }),
  getCreateOptions: (params) => request('/schedules/resources/options', { params, auth: false }),
  listSchedules: (params) => request('/schedules', { params }),
  getScheduleDetail: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}`),
  getScheduleActivity: (scheduleId, params) => request(`/schedules/${encodeURIComponent(scheduleId)}/activity`, { params }),
  getAvailableSlots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/available-slots`, { auth: false }),
  getBookedSlots: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/booked-slots`, { auth: false }),
  getMyTodaySchedule: (params) => request('/schedules/my/today', { params }),
  getMyWeekSchedule: (params) => request('/schedules/my/week', { params }),
  previewCreateSchedule: (body) => request('/schedules/preview-create', { method: 'POST', body, auth: false }),
  createSchedule: (body) => request('/schedules', { method: 'POST', body }),
  bulkCreateSchedules: (body) => request('/schedules/bulk', { method: 'POST', body }),
  bulkPublishSchedules: (scheduleIds) =>
    request('/schedules/bulk-publish', { method: 'POST', body: { schedule_ids: scheduleIds } }),
  updateSchedule: (scheduleId, body) => request(`/schedules/${encodeURIComponent(scheduleId)}`, { method: 'PATCH', body }),
  publishSchedule: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/publish`, { method: 'POST', body: {} }),
  cancelSchedule: (scheduleId) => request(`/schedules/${encodeURIComponent(scheduleId)}/cancel`, { method: 'POST', body: {} }),
  duplicateSchedule: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/duplicate`, { method: 'POST', body }),
  blockSlot: (scheduleId, body) => request(`/schedules/${encodeURIComponent(scheduleId)}/block-slot`, { method: 'POST', body }),
  reopenSlot: (scheduleId, body) => request(`/schedules/${encodeURIComponent(scheduleId)}/reopen-slot`, { method: 'POST', body }),
  batchBlockSlots: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/block-slots`, { method: 'POST', body }),
  batchReopenSlots: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/reopen-slots`, { method: 'POST', body }),
  previewImpact: (scheduleId, body) =>
    request(`/schedules/${encodeURIComponent(scheduleId)}/preview-impact`, { method: 'POST', body }),
};
