export const inpatientEmergencyLabels = {
  planned: 'Dự kiến nhập viện',
  admitted: 'Đang nội trú',
  transferred: 'Đã chuyển giường/khoa',
  discharged: 'Đã xuất viện',
  cancelled: 'Đã hủy',
  available: 'Trống',
  occupied: 'Đang sử dụng',
  reserved: 'Đã giữ chỗ',
  maintenance: 'Bảo trì',
  blocked: 'Khóa',
  inactive: 'Ngưng dùng',
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  done: 'Hoàn tất',
  scheduled: 'Đã lên lịch',
  given: 'Đã dùng thuốc',
  administered: 'Đã dùng thuốc',
  held: 'Tạm giữ',
  refused: 'Bệnh nhân từ chối',
  omitted: 'Bỏ liều',
  entered_in_error: 'Nhập sai',
  created: 'Mới tạo',
  acknowledged: 'Đã tiếp nhận',
  triaged: 'Đã phân loại',
  dispatched: 'Đã điều phối',
  resolved: 'Đã xử lý',
  false_alarm: 'Báo động giả',
  critical: 'Nguy kịch',
  urgent: 'Khẩn cấp',
  routine: 'Thường quy',
  on_time: 'Đúng hạn',
  at_risk: 'Sắp quá hạn',
  breached: 'Quá hạn',
  escalated: 'Đã leo thang',
  closed: 'Đã đóng',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Bình thường',
  low: 'Thấp',
};

export function ieLabel(value) {
  return inpatientEmergencyLabels[value] || value || 'Chưa cập nhật';
}

export function ieTone(value) {
  const status = String(value || '').toLowerCase();
  if (['admitted', 'occupied', 'in_progress', 'acknowledged', 'triaged', 'dispatched'].includes(status)) return 'neutral';
  if (['discharged', 'available', 'done', 'given', 'administered', 'resolved', 'closed', 'on_time', 'ready'].includes(status)) return 'good';
  if (['planned', 'reserved', 'todo', 'scheduled', 'held', 'at_risk', 'medium', 'delayed'].includes(status)) return 'warning';
  if (['cancelled', 'maintenance', 'blocked', 'refused', 'omitted', 'entered_in_error', 'critical', 'urgent', 'breached', 'escalated', 'high'].includes(status)) return 'danger';
  return 'neutral';
}
