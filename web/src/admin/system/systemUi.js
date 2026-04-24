export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatCompactDate(value) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatRelativeTime(value) {
  if (!value) return 'Chưa có dữ liệu';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export function getInitials(value) {
  return String(value || 'AD')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('');
}

export function getStatusTone(status) {
  const map = {
    active: 'green',
    inactive: 'slate',
    disabled: 'red',
    locked: 'amber',
    suspended: 'orange',
    success: 'green',
    failed: 'red',
  };

  return map[String(status || '').toLowerCase()] || 'blue';
}

export function getDepartmentTypeLabel(value) {
  const map = {
    clinical: 'Lâm sàng',
    non_clinical: 'Hành chính',
    admin: 'Quản trị',
    pharmacy: 'Dược',
    lab: 'Xét nghiệm',
    imaging: 'Chẩn đoán hình ảnh',
  };

  return map[String(value || '').toLowerCase()] || value || 'Chưa phân loại';
}

export function getActionLabel(action) {
  const normalized = String(action || '').toLowerCase();
  if (!normalized) return 'Khác';
  if (normalized.includes('create')) return 'Tạo mới';
  if (normalized.includes('update')) return 'Cập nhật';
  if (normalized.includes('delete')) return 'Xóa';
  if (normalized.includes('assign')) return 'Gán';
  if (normalized.includes('reset')) return 'Reset';
  if (normalized.includes('deactivate')) return 'Vô hiệu hóa';
  if (normalized.includes('activate')) return 'Kích hoạt';
  if (normalized.includes('login')) return 'Đăng nhập';
  if (normalized.includes('logout')) return 'Đăng xuất';
  return action;
}

export function getDeviceLabel(userAgent = '') {
  const lower = String(userAgent).toLowerCase();
  if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) return 'Di động';
  if (lower.includes('ipad') || lower.includes('tablet')) return 'Máy tính bảng';
  return 'Máy tính';
}

export function getBrowserLabel(userAgent = '') {
  const lower = String(userAgent).toLowerCase();
  if (lower.includes('edg')) return 'Edge';
  if (lower.includes('chrome')) return 'Chrome';
  if (lower.includes('firefox')) return 'Firefox';
  if (lower.includes('safari')) return 'Safari';
  return 'Trình duyệt';
}
