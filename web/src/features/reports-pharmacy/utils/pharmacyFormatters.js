export const pharmacyStatusLabels = {
  active: 'Đang dùng',
  inactive: 'Ngưng dùng',
  recalled: 'Đã thu hồi',
  discontinued: 'Dừng lưu hành',
  draft: 'Nháp',
  verified: 'Đã xác minh',
  partially_dispensed: 'Cấp phát một phần',
  fully_dispensed: 'Đã cấp phát đủ',
  cancelled: 'Đã hủy',
  completed: 'Hoàn tất',
  held: 'Tạm giữ',
  stopped: 'Đã dừng',
  dispensed: 'Đã cấp phát',
  returned: 'Đã trả thuốc',
  available: 'Có thể dùng',
  quarantined: 'Đang cách ly',
  expired: 'Hết hạn',
  depleted: 'Hết tồn',
  receipt: 'Nhập kho',
  issue: 'Xuất nội bộ',
  dispense: 'Cấp phát',
  adjustment: 'Điều chỉnh',
  return: 'Trả kho',
  transfer: 'Chuyển kho',
  waste: 'Hủy / hao hụt',
  expire: 'Hết hạn',
  recall: 'Thu hồi',
  in: 'Nhập',
  out: 'Xuất',
  open: 'Đã mở',
  counting: 'Đang kiểm',
  review: 'Chờ duyệt',
  posted: 'Đã ghi sổ',
  critical: 'Nguy cấp',
  high: 'Cao',
  medium: 'Trung bình',
  watch: 'Theo dõi',
  fast_moving: 'Luân chuyển nhanh',
  normal_moving: 'Bình thường',
  slow_moving: 'Luân chuyển chậm',
  dead_stock: 'Dead stock',
  abnormal_increase: 'Tăng bất thường',
};

export function pharmacyStatusLabel(status) {
  return pharmacyStatusLabels[status] || status || 'Chưa cập nhật';
}

export function pharmacyTone(status) {
  const value = String(status || '').toLowerCase();
  if (['available', 'active', 'dispensed', 'posted', 'completed', 'normal', 'normal_moving'].includes(value)) return 'good';
  if (['open', 'counting', 'in_progress', 'partially_dispensed', 'fast_moving'].includes(value)) return 'neutral';
  if (['low', 'near_expiry', 'pending', 'review', 'medium', 'watch', 'slow_moving', 'held'].includes(value)) return 'warning';
  if (['out_of_stock', 'expired', 'recalled', 'waste', 'critical', 'high', 'dead_stock', 'abnormal_increase', 'cancelled'].includes(value)) return 'danger';
  if (['controlled', 'high_usage'].includes(value)) return 'purple';
  return 'neutral';
}

export function abcClass(cumulativePercent) {
  const value = Number(cumulativePercent) || 0;
  if (value <= 80) return 'A';
  if (value <= 95) return 'B';
  return 'C';
}
