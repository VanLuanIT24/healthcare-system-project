export const customLabels = {
  operations: 'Vận hành',
  finance: 'Tài chính',
  departments: 'Khoa',
  doctors: 'Bác sĩ',
  pharmacy: 'Kho dược',
  diagnostics: 'Cận lâm sàng',
  inpatient: 'Nội trú',
  emergency: 'Cấp cứu',
  quality: 'Chất lượng',
  records: 'Hồ sơ',
  core_report: 'Core report',
  pharmacy_report: 'Pharmacy report',
  raw_list: 'Raw/list',
  private: 'Riêng tư',
  shared: 'Dùng chung',
  public_department: 'Công khai trong khoa',
  public_system: 'Toàn hệ thống',
  supported: 'Đã hỗ trợ',
  missing_backend: 'Cần backend custom',
};

export function customLabel(value) {
  if (value === undefined || value === null || value === '') return 'Chưa rõ';
  return customLabels[String(value)] || String(value).replaceAll('_', ' ');
}

export function customTone(value) {
  const key = String(value || '').toLowerCase();
  if (['supported', 'core_report', 'pharmacy_report', 'public_system'].includes(key)) return 'good';
  if (['shared', 'public_department', 'raw_list'].includes(key)) return 'warning';
  if (['missing_backend', 'failed', 'disabled'].includes(key)) return 'danger';
  return 'neutral';
}

export function ensureRevenueDateRange(filters = {}) {
  if (filters.date_from && filters.date_to) return filters;
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 29);
  return {
    ...filters,
    date_from: filters.date_from || from.toISOString().slice(0, 10),
    date_to: filters.date_to || now.toISOString().slice(0, 10),
  };
}

export function flattenPreviewRows(preview = {}) {
  if (Array.isArray(preview?.preview?.rows)) return preview.preview.rows;
  if (Array.isArray(preview?.report?.items)) return preview.report.items;
  return Object.entries(preview?.preview?.summary || {}).map(([key, value]) => ({ key, value }));
}
