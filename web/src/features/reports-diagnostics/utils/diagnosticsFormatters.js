export const priorityLabels = {
  routine: 'Thường quy',
  urgent: 'Khẩn',
  stat: 'Cấp cứu / STAT',
};

export const statusLabels = {
  draft: 'Nháp',
  ordered: 'Đã chỉ định',
  acknowledged: 'Đã tiếp nhận',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  entered_in_error: 'Nhập sai',
  collected: 'Đã lấy mẫu',
  received: 'Đã nhận mẫu',
  recollection_required: 'Cần lấy lại mẫu',
  rejected: 'Từ chối mẫu',
  planned: 'Dự kiến',
  in_testing: 'Đang xét nghiệm',
  stored: 'Đã lưu trữ',
  disposed: 'Đã hủy mẫu',
  preliminary: 'Sơ bộ',
  final: 'Chính thức',
  amended: 'Đã chỉnh sửa',
  scheduled: 'Đã lên lịch',
  no_show: 'Không đến',
  warning: 'Cảnh báo',
  breached: 'Quá SLA',
  normal: 'Bình thường',
};

export function diagnosticsStatusLabel(status) {
  return statusLabels[status] || priorityLabels[status] || status || 'Chưa cập nhật';
}

export function diagnosticsTone(status) {
  const value = String(status || '').toLowerCase();
  if (['completed', 'final', 'amended', 'stored', 'normal', 'resolved', 'good'].includes(value)) return 'good';
  if (['in_progress', 'in_testing', 'acknowledged', 'scheduled', 'received', 'collected'].includes(value)) return 'neutral';
  if (['ordered', 'draft', 'preliminary', 'planned', 'warning', 'urgent'].includes(value)) return 'warning';
  if (['rejected', 'cancelled', 'entered_in_error', 'no_show', 'breached', 'stat', 'danger', 'critical'].includes(value)) return 'danger';
  return 'neutral';
}

export function diagnosticTypeLabel(type) {
  return {
    lab: 'Lab',
    lab_result: 'Lab result',
    specimen: 'Specimen',
    imaging: 'Imaging',
    imaging_report: 'Imaging report',
    procedure: 'Procedure',
    procedure_result: 'Procedure result',
    alert: 'Alert',
    overdue: 'Overdue',
    pending: 'Pending',
  }[type] || type || 'Cận lâm sàng';
}
