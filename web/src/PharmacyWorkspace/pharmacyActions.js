export function notifyPharmacy(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pharmacy:toast', {
    detail: {
      tone: detail.tone || 'info',
      title: detail.title || 'Thông báo dược',
      message: detail.message || '',
      timeout: detail.timeout,
    },
  }));
}

export function confirmPharmacyAction({ title = 'Xác nhận thao tác', message = 'Bạn chắc chắn muốn tiếp tục?' } = {}) {
  if (typeof window === 'undefined') return true;
  return window.confirm([title, message].filter(Boolean).join('\n\n'));
}

export function promptPharmacyText({ title = 'Nhập thông tin', message = '', defaultValue = '' } = {}) {
  if (typeof window === 'undefined') return null;
  return window.prompt([title, message].filter(Boolean).join('\n\n'), defaultValue);
}

export function isDemoPharmacyRecord(value) {
  if (!value) return false;
  if (typeof value === 'string') return value.startsWith('demo') || value.includes('-demo');
  return ['id', '_id', 'prescription_id', 'dispense_id', 'stock_batch_id', 'transaction_id', 'alert_id', 'administration_id']
    .some((key) => isDemoPharmacyRecord(value[key]));
}

export async function runPharmacyAction({
  label = 'Thao tác',
  confirm,
  run,
  successMessage,
  errorMessage,
  demoMessage,
  isDemo = false,
  setBusy,
  onSuccess,
  notify = notifyPharmacy,
} = {}) {
  if (isDemo) {
    notify({ tone: 'warning', title: label, message: demoMessage || 'Đang hiển thị dữ liệu mẫu nên thao tác chưa gửi về hệ thống.' });
    return null;
  }

  if (confirm && !confirmPharmacyAction(confirm)) return null;

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

export function downloadPharmacyJson(filename, payload, title = 'Xuất dữ liệu') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload || {}, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `pharmacy-export-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notifyPharmacy({ tone: 'success', title, message: 'Đã chuẩn bị tệp tải xuống.' });
}

export function printPharmacyView(title = 'In màn hình') {
  if (typeof window === 'undefined') return;
  notifyPharmacy({ tone: 'info', title, message: 'Hộp thoại in của trình duyệt sẽ mở.' });
  window.setTimeout(() => window.print(), 100);
}
