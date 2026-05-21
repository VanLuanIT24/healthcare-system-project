import { formatDateTime, formatNumber } from '../../reports-overview/utils/formatters';

export const EXPORT_STATUS_LABELS = {
  pending: 'Đang chờ',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng tải',
  success: 'Thành công',
  failure: 'Thất bại',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn',
};

export const FORMAT_LABELS = {
  csv: 'CSV',
  excel: 'Excel',
  pdf: 'PDF',
  json: 'JSON',
  zip: 'ZIP',
};

export const REPORT_GROUP_LABELS = {
  core: 'Báo cáo hệ thống',
  pharmacy: 'Nhà thuốc & kho dược',
  audit: 'Nhật ký kiểm toán',
  records: 'Hồ sơ & tài liệu',
  custom: 'Báo cáo tùy chỉnh',
  finance: 'Tài chính / viện phí',
  diagnostics: 'Cận lâm sàng',
  inpatient_emergency: 'Nội trú & cấp cứu',
  quality_risk: 'Chất lượng / rủi ro',
};

export function exportLabel(value) {
  const key = String(value || '').toLowerCase();
  return EXPORT_STATUS_LABELS[key] || FORMAT_LABELS[key] || REPORT_GROUP_LABELS[key] || String(value || '-').replaceAll('_', ' ');
}

export function exportTone(value) {
  const key = String(value || '').toLowerCase();
  if (['success', 'ready', 'csv', 'json'].includes(key)) return 'success';
  if (['processing', 'pending', 'excel', 'pdf'].includes(key)) return 'info';
  if (['failure', 'failed', 'cancelled', 'expired'].includes(key)) return 'danger';
  if (['pharmacy', 'custom'].includes(key)) return 'purple';
  if (['audit', 'records'].includes(key)) return 'warning';
  return 'neutral';
}

export function formatFileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = bytes;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatExportDate(value) {
  return value ? formatDateTime(value) : '-';
}

export function normalizeExportRows(items = []) {
  return items.map((item) => ({
    ...item,
    export_id: item.export_id || item.id || item._id,
    report_group: item.report_group || 'core',
    report_type: item.report_type || item.type || '-',
    format: item.format || '-',
    status: item.status || 'success',
    exported_at: item.exported_at || item.created_at,
    row_count_label: item.row_count ? formatNumber(item.row_count) : '-',
  }));
}

export function defaultDateRange() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 29);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: now.toISOString().slice(0, 10),
  };
}

export function downloadExportPayload(payload) {
  if (!payload) return;
  const filename = payload.filename || `report_export_${new Date().toISOString().slice(0, 10)}.${payload.format || 'json'}`;
  const text = payload.content || JSON.stringify(payload.data || payload.items || payload, null, 2);
  const blob = new Blob([text], { type: payload.content_type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
