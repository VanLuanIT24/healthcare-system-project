export const qualityRiskLabels = {
  info: 'Thông tin',
  warning: 'Cảnh báo',
  error: 'Lỗi',
  critical: 'Nghiêm trọng',
  high: 'Cao',
  success: 'Thành công',
  failure: 'Thất bại',
  active: 'Đang active',
  ended: 'Đã kết thúc',
  open: 'Đang mở',
  pending: 'Đang chờ',
  in_progress: 'Đang xử lý',
  acknowledged: 'Đã tiếp nhận',
  assigned: 'Đã phân công',
  escalated: 'Đã leo thang',
  resolved: 'Đã xử lý',
  dismissed: 'Đã bỏ qua',
  closed: 'Đã đóng',
  reopened: 'Mở lại',
  low: 'Thấp',
  normal: 'Bình thường',
  urgent: 'Khẩn cấp',
  queued: 'Đang chờ gửi',
  unread: 'Chưa đọc',
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  read: 'Đã đọc',
  archived: 'Đã lưu trữ',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
  running: 'Đang chạy',
  within_sla: 'Trong SLA',
  on_time: 'Đúng hạn',
  at_risk: 'Sắp quá hạn',
  breached: 'Quá hạn',
  completed: 'Hoàn tất',
  diagnostic: 'Cận lâm sàng',
  clinical: 'Lâm sàng',
  support: 'Hỗ trợ',
  emergency: 'Cấp cứu',
  inpatient: 'Nội trú',
  auth: 'Xác thực',
  billing: 'Viện phí',
  records: 'Hồ sơ',
};

export function qrLabel(value) {
  if (value === undefined || value === null || value === '') return 'Chưa rõ';
  return qualityRiskLabels[String(value)] || String(value).replaceAll('_', ' ');
}

export function qrTone(value) {
  const status = String(value || '').toLowerCase();
  if (['success', 'resolved', 'closed', 'delivered', 'read', 'completed', 'within_sla', 'on_time', 'good', 'ended'].includes(status)) return 'good';
  if (['warning', 'pending', 'queued', 'sent', 'acknowledged', 'assigned', 'in_progress', 'at_risk', 'running', 'active', 'high'].includes(status)) return 'warning';
  if (['error', 'critical', 'failure', 'failed', 'breached', 'escalated', 'cancelled', 'dismissed', 'danger', 'urgent'].includes(status)) return 'danger';
  return 'neutral';
}
