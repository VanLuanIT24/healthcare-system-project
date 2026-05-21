export function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(safeNumber(value));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(safeNumber(value));
}

export function formatPercent(value) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(safeNumber(value))}%`;
}

export function formatMinutes(value) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(safeNumber(value))} phút`;
}

export function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatByUnit(value, unit) {
  if (unit === 'currency') return formatCurrency(value);
  if (unit === 'percent') return formatPercent(value);
  if (unit === 'minutes') return formatMinutes(value);
  return formatNumber(value);
}

export function statusLabel(status) {
  return {
    good: 'Ổn định',
    warning: 'Cần theo dõi',
    danger: 'Ưu tiên cao',
    neutral: 'Theo dõi',
  }[status] || 'Theo dõi';
}

export function getMetricLabel(key) {
  return {
    appointments: 'Lịch hẹn',
    completed_appointments: 'Lịch hẹn hoàn tất',
    no_show_rate: 'Tỷ lệ no-show',
    queue_waiting_avg: 'Chờ trung bình',
    encounters: 'Encounter',
    completed_encounters: 'Encounter hoàn tất',
    revenue: 'Doanh thu',
    outstanding_amount: 'Công nợ',
    low_stock: 'Tồn kho thấp',
    critical_alerts: 'Critical alerts',
  }[key] || key;
}

export function metricUnit(key) {
  if (['revenue', 'outstanding_amount'].includes(key)) return 'currency';
  if (key.includes('rate') || key.includes('percent')) return 'percent';
  if (key.includes('waiting')) return 'minutes';
  return 'number';
}
