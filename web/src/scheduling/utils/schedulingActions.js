export const SCHEDULING_NOTIFICATION_EVENT = 'healthcare:scheduling-notification';

function getFallbackId(prefix = 'scheduling') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function notifyScheduling({
  id,
  title = 'Thông báo lịch khám',
  body = '',
  tone = 'info',
  to = '/scheduling/overview',
  openMenu = false,
  focusTarget = null,
} = {}) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(SCHEDULING_NOTIFICATION_EVENT, {
    detail: {
      id: id || getFallbackId('schedule-notice'),
      title,
      body,
      tone,
      to,
      openMenu,
      focusTarget,
      time: 'Vừa xong',
    },
  }));
}

export function confirmSchedulingAction({
  title = 'Xác nhận thao tác',
  body = 'Bạn có chắc muốn tiếp tục?',
  confirmLabel = 'Tiếp tục',
} = {}) {
  if (typeof window === 'undefined') return true;
  return window.confirm([title, body, `Chọn OK để ${confirmLabel}.`].filter(Boolean).join('\n\n'));
}

export function getActionErrorMessage(error, fallback = 'Không thể thực hiện thao tác.') {
  return error?.message || fallback;
}

export async function runSchedulingAction({
  action,
  confirm,
  pendingMessage = 'Đang xử lý thao tác...',
  successTitle = 'Thao tác thành công',
  successBody = 'Dữ liệu đã được cập nhật.',
  errorTitle = 'Thao tác không thành công',
  errorBody = 'Vui lòng thử lại hoặc kiểm tra quyền truy cập.',
  to = '/scheduling/overview',
  onStatus,
  onSuccess,
  onError,
} = {}) {
  if (typeof action !== 'function') {
    const message = 'Nút thao tác chưa được cấu hình hành động.';
    onStatus?.(message, 'error');
    notifyScheduling({ title: errorTitle, body: message, tone: 'danger', to, openMenu: true });
    return { ok: false, error: new Error(message) };
  }

  if (confirm && !confirmSchedulingAction(confirm)) {
    onStatus?.('Đã hủy thao tác.', 'info');
    return { ok: false, cancelled: true };
  }

  onStatus?.(pendingMessage, 'pending');

  try {
    const result = await action();
    onStatus?.(successBody, 'success');
    notifyScheduling({ title: successTitle, body: successBody, tone: 'success', to });
    onSuccess?.(result);
    return { ok: true, result };
  } catch (error) {
    const message = getActionErrorMessage(error, errorBody);
    onStatus?.(message, 'error');
    notifyScheduling({ title: errorTitle, body: message, tone: 'danger', to, openMenu: true });
    onError?.(error);
    return { ok: false, error };
  }
}

export function downloadJsonFile(filename, payload) {
  if (typeof window === 'undefined') return false;

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
