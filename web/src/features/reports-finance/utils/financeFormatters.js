export const invoiceStatusLabels = {
  draft: 'Nháp',
  issued: 'Đã phát hành',
  partially_paid: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
  voided: 'Đã hủy/void',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
};

export const paymentStatusLabels = {
  pending: 'Đang chờ',
  pending_manual_confirmation: 'Chờ xác nhận thủ công',
  submitted_receipt: 'Đã gửi biên lai',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
  rejected: 'Bị từ chối',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
  refunded_manual: 'Hoàn tiền thủ công',
  voided: 'Đã void',
};

export const paymentMethodLabels = {
  cash: 'Tiền mặt',
  qr: 'QR',
  card: 'Thẻ',
  bank_transfer: 'Chuyển khoản',
  insurance: 'Bảo hiểm',
  e_wallet: 'Ví điện tử',
  other: 'Khác',
};

export const chargeStatusLabels = {
  pending: 'Đang chờ',
  draft: 'Nháp',
  posted: 'Đã ghi nhận',
  billed: 'Đã lập hóa đơn',
  voided: 'Đã void',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
};

export const claimStatusLabels = {
  draft: 'Nháp',
  submitted: 'Đã gửi',
  under_review: 'Đang duyệt',
  approved: 'Đã duyệt',
  partially_approved: 'Duyệt một phần',
  rejected: 'Bị từ chối',
  settled: 'Đã quyết toán',
  cancelled: 'Đã hủy',
};

export function financeStatusLabel(value, type = 'invoice') {
  const maps = {
    invoice: invoiceStatusLabels,
    payment: paymentStatusLabels,
    method: paymentMethodLabels,
    charge: chargeStatusLabels,
    claim: claimStatusLabels,
  };
  return maps[type]?.[value] || value || 'Không rõ';
}

export function financeStatusTone(value) {
  if (['paid', 'completed', 'confirmed', 'approved', 'settled', 'matched', 'posted', 'billed'].includes(value)) return 'good';
  if (['issued', 'partially_paid', 'pending', 'pending_manual_confirmation', 'submitted_receipt', 'submitted', 'under_review', 'warning'].includes(value)) return 'warning';
  if (['failed', 'rejected', 'expired', 'voided', 'refunded', 'refunded_manual', 'cancelled', 'mismatch', 'danger'].includes(value)) return 'danger';
  return 'neutral';
}

