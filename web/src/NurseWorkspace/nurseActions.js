export function notifyNurse(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('nurse:toast', {
    detail: {
      tone: detail.tone || 'info',
      title: detail.title || 'Thông báo điều dưỡng',
      message: detail.message || '',
      timeout: detail.timeout,
    },
  }));
}

export function confirmNurseAction({ title = 'Xác nhận thao tác', message = 'Bạn chắc chắn muốn tiếp tục?' } = {}) {
  if (typeof window === 'undefined') return true;
  return window.confirm([title, message].filter(Boolean).join('\n\n'));
}

export function promptNurseText({ title = 'Nhập thông tin', message = '', defaultValue = '' } = {}) {
  if (typeof window === 'undefined') return null;
  return window.prompt([title, message].filter(Boolean).join('\n\n'), defaultValue);
}

export function isDemoRecord(value) {
  if (!value) return false;
  if (typeof value === 'string') return value.startsWith('demo') || value.includes('-demo');
  return ['id', '_id', 'task_id', 'handoff_id', 'preparation_id', 'admission_id', 'case_id', 'vital_sign_id']
    .some((key) => isDemoRecord(value[key]));
}

export function getNurseRecordId(item = {}, keys = []) {
  for (const key of keys) {
    const value = item?.[key];
    if (!value) continue;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (value?._id) return String(value._id);
    if (value?.id) return String(value.id);
  }
  return '';
}

export async function runNurseAction({
  label = 'Thao tác',
  confirm,
  run,
  successMessage,
  errorMessage,
  demoMessage,
  isDemo = false,
  setBusy,
  onSuccess,
  notify = notifyNurse,
} = {}) {
  if (isDemo) {
    notify({ tone: 'warning', title: label, message: demoMessage || 'Đang hiển thị dữ liệu mẫu nên thao tác chưa gửi về hệ thống.' });
    return null;
  }

  if (confirm && !confirmNurseAction(confirm)) return null;

  setBusy?.(true);
  try {
    const result = await run?.();
    notify({ tone: 'success', title: label, message: successMessage || 'Thao tác đã hoàn tất.' });
    onSuccess?.(result);
    return result;
  } catch (error) {
    notify({ tone: 'danger', title: label, message: error?.message || errorMessage || 'Không thể hoàn tất thao tác.' });
    return null;
  } finally {
    setBusy?.(false);
  }
}

export function downloadNurseJson(filename, payload, title = 'Xuất dữ liệu') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload || {}, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `nurse-export-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notifyNurse({ tone: 'success', title, message: 'Đã chuẩn bị tệp tải xuống.' });
}

export function printNurseView(title = 'In màn hình') {
  if (typeof window === 'undefined') return;
  notifyNurse({ tone: 'info', title, message: 'Hộp thoại in của trình duyệt sẽ mở.' });
  window.setTimeout(() => window.print(), 100);
}
