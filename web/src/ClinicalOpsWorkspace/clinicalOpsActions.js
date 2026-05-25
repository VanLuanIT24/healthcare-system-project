export function notifyClinicalOps(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('clinical-ops:toast', {
    detail: {
      tone: detail.tone || 'info',
      title: detail.title || 'Thông báo cận lâm sàng',
      message: detail.message || '',
      timeout: detail.timeout,
    },
  }));
}

export function confirmClinicalOpsAction({ title = 'Xác nhận thao tác', message = 'Bạn chắc chắn muốn tiếp tục?' } = {}) {
  if (typeof window === 'undefined') return true;
  return window.confirm([title, message].filter(Boolean).join('\n\n'));
}

export function promptClinicalOpsText({ title = 'Nhập thông tin', message = '', defaultValue = '' } = {}) {
  if (typeof window === 'undefined') return null;
  return window.prompt([title, message].filter(Boolean).join('\n\n'), defaultValue);
}

export async function runClinicalOpsAction({
  label = 'Thao tác cận lâm sàng',
  confirm,
  run,
  successMessage,
  errorMessage,
  setBusy,
  onSuccess,
  notify = notifyClinicalOps,
} = {}) {
  if (confirm && !confirmClinicalOpsAction(confirm)) return null;
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

export function downloadClinicalOpsJson(filename, payload, title = 'Xuất dữ liệu') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload || {}, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `clinical-ops-export-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notifyClinicalOps({ tone: 'success', title, message: 'Đã chuẩn bị tệp tải xuống.' });
}

export function downloadClinicalOpsCsv(filename, rows = [], title = 'Xuất dữ liệu') {
  if (typeof document === 'undefined') return;
  const safeRows = Array.isArray(rows) ? rows : [];
  const keys = Array.from(new Set(safeRows.flatMap((row) => Object.keys(row || {}))));
  const body = [
    keys,
    ...safeRows.map((row) => keys.map((key) => row?.[key] ?? '')),
  ]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `clinical-ops-export-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notifyClinicalOps({ tone: 'success', title, message: `Đã xuất ${safeRows.length} dòng.` });
}

export function printClinicalOpsView(title = 'In màn hình') {
  if (typeof window === 'undefined') return;
  notifyClinicalOps({ tone: 'info', title, message: 'Hộp thoại in của trình duyệt sẽ mở.' });
  window.setTimeout(() => window.print(), 100);
}
