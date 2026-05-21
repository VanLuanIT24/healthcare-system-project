export const recordsDocumentsLabels = {
  draft: 'Nháp',
  active: 'Đang hoạt động',
  finalized: 'Đã finalize',
  archived: 'Đã lưu trữ',
  sealed: 'Đã niêm phong',
  voided: 'Đã void',
  deleted: 'Đã xóa mềm',
  quarantined: 'Cách ly',
  pending: 'Chờ xử lý',
  accepted: 'Đã duyệt',
  rejected: 'Từ chối',
  clean: 'An toàn',
  infected: 'Nhiễm mã độc',
  failed: 'Thất bại',
  skipped: 'Bỏ qua',
  staff_upload: 'Nhân viên tải lên',
  patient_upload: 'Bệnh nhân tải lên',
  system_generated: 'Hệ thống tạo',
  external_import: 'Import bên ngoài',
  staff_only: 'Chỉ nhân viên',
  patient_visible: 'Bệnh nhân thấy được',
  shared_with_relative: 'Chia sẻ với người thân',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng tải',
  expired: 'Hết hạn',
  open: 'Đang mở',
  resolved: 'Đã xử lý',
  waived: 'Đã miễn',
  overdue: 'Quá hạn',
  medical_record: 'Hồ sơ bệnh án',
  attachment: 'Tệp đính kèm',
  missing_document: 'Tài liệu thiếu',
  document_export: 'Export tài liệu',
  audit_log: 'Audit log',
};

export function rdLabel(value) {
  if (value === undefined || value === null || value === '') return 'Chưa rõ';
  return recordsDocumentsLabels[String(value)] || String(value).replaceAll('_', ' ');
}

export function rdTone(value) {
  const status = String(value || '').toLowerCase();
  if (['active', 'finalized', 'sealed', 'accepted', 'clean', 'ready', 'resolved', 'patient_visible', 'success'].includes(status)) return 'good';
  if (['draft', 'pending', 'processing', 'staff_only', 'open', 'skipped'].includes(status)) return 'warning';
  if (['voided', 'archived', 'deleted', 'quarantined', 'rejected', 'infected', 'failed', 'expired', 'overdue'].includes(status)) return 'danger';
  return 'neutral';
}

export function formatFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: index ? 1 : 0 }).format(bytes / (1024 ** index))} ${units[index]}`;
}
