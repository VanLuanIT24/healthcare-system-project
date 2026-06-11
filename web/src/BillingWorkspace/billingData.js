import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  History,
  LayoutGrid,
  ReceiptText,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';

const billingMenuCatalog = [
  {
    id: 'overview',
    label: 'Tổng quan',
    icon: LayoutGrid,
    defaultOpen: true,
    children: [
      { id: 'overview-dashboard', label: 'Bảng điều khiển viện phí', to: '/billing/dashboard', icon: LayoutGrid },
      { id: 'overview-action-items', label: 'Việc cần xử lý', to: '/billing/overview/action-items', icon: ClipboardCheck },
      { id: 'overview-today-revenue', label: 'Doanh thu hôm nay', to: '/billing/overview/today-revenue', icon: BarChart3 },
      { id: 'overview-pending-invoices', label: 'Hóa đơn chờ thu', to: '/billing/overview/pending-invoices', icon: ReceiptText },
      { id: 'overview-payment-confirmation', label: 'Thanh toán cần xác nhận', to: '/billing/overview/payment-confirmation-needed', icon: Clock3 },
      { id: 'overview-payment-errors', label: 'Thanh toán lỗi', to: '/billing/overview/payment-errors', icon: AlertTriangle },
      { id: 'overview-debt', label: 'Công nợ', to: '/billing/overview/debt', icon: CircleDollarSign },
      { id: 'overview-recent-transactions', label: 'Giao dịch gần đây', to: '/billing/overview/recent-transactions', icon: History },
    ],
  },
  {
    id: 'cashier-counter',
    label: 'Quầy thu tiền',
    icon: WalletCards,
    defaultOpen: true,
    children: [
      { id: 'counter-collect', label: 'Thu tiền', to: '/billing/cashier/collect', icon: WalletCards },
      { id: 'counter-search', label: 'Tìm hóa đơn / bệnh nhân', to: '/billing/cashier/search-invoice-patient', icon: Search },
      { id: 'counter-unpaid', label: 'Hóa đơn chưa thanh toán', to: '/billing/cashier/unpaid-invoices', icon: Clock3 },
      { id: 'counter-partial', label: 'Hóa đơn thanh toán một phần', to: '/billing/cashier/partial-paid-invoices', icon: Activity },
      { id: 'counter-transfer', label: 'Thanh toán QR / chuyển khoản', to: '/billing/cashier/qr-bank-transfer', icon: ScanLine },
      { id: 'counter-ewallet', label: 'Ví điện tử', to: '/billing/cashier/e-wallet', icon: CreditCard },
      { id: 'counter-transfer-confirm', label: 'Xác nhận chuyển khoản', to: '/billing/cashier/transfer-confirmation', icon: CheckCircle2 },
      { id: 'counter-print-receipt', label: 'In biên lai', to: '/billing/cashier/print-receipt', icon: ReceiptText },
    ],
  },
  {
    id: 'invoices',
    label: 'Hóa đơn',
    icon: ReceiptText,
    defaultOpen: true,
    children: [
      { id: 'invoices-all', label: 'Tất cả hóa đơn', to: '/billing/invoices/all', icon: ClipboardList },
      { id: 'invoices-draft', label: 'Hóa đơn nháp', to: '/billing/invoices/draft', icon: FileText },
      { id: 'invoices-issued', label: 'Hóa đơn đã phát hành', to: '/billing/invoices/issued', icon: FileCheck2 },
      { id: 'invoices-unpaid', label: 'Hóa đơn chưa thanh toán', to: '/billing/invoices/unpaid', icon: Clock3 },
      { id: 'invoices-partial', label: 'Hóa đơn thanh toán một phần', to: '/billing/invoices/partial-paid', icon: Activity },
      { id: 'invoices-paid', label: 'Hóa đơn đã thanh toán', to: '/billing/invoices/paid', icon: BadgeCheck },
      { id: 'invoices-overdue', label: 'Hóa đơn quá hạn', to: '/billing/invoices/overdue', icon: AlertTriangle },
      { id: 'invoices-cancelled', label: 'Hóa đơn đã hủy', to: '/billing/invoices/cancelled', icon: RotateCcw },
      { id: 'invoices-adjustment', label: 'Điều chỉnh hóa đơn', to: '/billing/invoices/adjustments', icon: ClipboardCheck },
    ],
  },
  {
    id: 'charges',
    label: 'Khoản tính phí',
    icon: CircleDollarSign,
    defaultOpen: false,
    children: [
      { id: 'charges-all', label: 'Tất cả khoản tính phí', to: '/billing/charges/all', icon: ClipboardList },
      { id: 'charges-create', label: 'Tạo khoản tính phí', to: '/billing/charges/create', icon: ClipboardPlus },
      { id: 'charges-pending-post', label: 'Khoản tính phí chờ ghi nhận', to: '/billing/charges/pending-post', icon: Clock3 },
      { id: 'charges-posted', label: 'Khoản tính phí đã ghi nhận', to: '/billing/charges/posted', icon: BadgeCheck },
      { id: 'charges-uninvoiced', label: 'Khoản tính phí chưa lên hóa đơn', to: '/billing/charges/uninvoiced', icon: ReceiptText },
      { id: 'charges-invoiced', label: 'Khoản tính phí đã lên hóa đơn', to: '/billing/charges/invoiced', icon: FileCheck2 },
      { id: 'charges-encounter', label: 'Khoản tính phí theo lượt khám', to: '/billing/charges/by-visit', icon: Activity },
      { id: 'charges-service', label: 'Khoản tính phí theo dịch vụ', to: '/billing/charges/by-service', icon: FileText },
      { id: 'charges-void-processing', label: 'Khoản tính phí đã hủy / cần xử lý', to: '/billing/charges/cancelled-needs-processing', icon: AlertTriangle },
    ],
  },
  {
    id: 'payments',
    label: 'Thanh toán',
    icon: CreditCard,
    defaultOpen: true,
    children: [
      { id: 'payments-intents', label: 'Yêu cầu thanh toán', to: '/billing/payments/intents', icon: ClipboardList },
      { id: 'payments-waiting', label: 'Chờ thanh toán', to: '/billing/payments/waiting', icon: Clock3 },
      { id: 'payments-manual-confirmation', label: 'Chờ xác nhận thủ công', to: '/billing/payments/manual-confirmation', icon: ClipboardCheck },
      { id: 'payments-manual-review', label: 'Chờ rà soát thủ công', to: '/billing/payments/manual-review', icon: FileText },
      { id: 'payments-all', label: 'Tất cả thanh toán', to: '/billing/payments/all', icon: CreditCard },
      { id: 'payments-completed', label: 'Thanh toán hoàn tất', to: '/billing/payments/completed', icon: CheckCircle2 },
      { id: 'payments-failed-rejected', label: 'Thanh toán thất bại / bị từ chối', to: '/billing/payments/failed-rejected', icon: AlertTriangle },
      { id: 'payments-expired-cancelled', label: 'Thanh toán hết hạn / đã hủy', to: '/billing/payments/expired-cancelled', icon: Clock3 },
      { id: 'payments-refunded-voided', label: 'Thanh toán đã hoàn tiền / đã hủy', to: '/billing/payments/refunded-cancelled', icon: RotateCcw },
    ],
  },
  {
    id: 'receipts',
    label: 'Biên lai',
    icon: ReceiptText,
    defaultOpen: false,
    children: [
      { id: 'receipts-print', label: 'In biên lai', to: '/billing/receipts/print', icon: ReceiptText },
      { id: 'receipts-reprint', label: 'In lại biên lai', to: '/billing/receipts/reprint', icon: FileCheck2 },
      { id: 'receipts-download', label: 'Tải biên lai', to: '/billing/receipts/download', icon: FileText },
      { id: 'receipts-patient-submitted', label: 'Biên lai bệnh nhân gửi', to: '/billing/receipts/patient-submitted', icon: CheckCircle2 },
      { id: 'receipts-history', label: 'Lịch sử biên lai', to: '/billing/receipts/history', icon: History },
    ],
  },
  {
    id: 'insurance',
    label: 'Bảo hiểm',
    icon: ShieldAlert,
    defaultOpen: false,
    children: [
      { id: 'insurance-policies', label: 'Chính sách bảo hiểm', to: '/billing/insurance/policies', icon: ShieldAlert },
      { id: 'insurance-verification', label: 'Chờ xác minh', to: '/billing/insurance/pending-verification', icon: Clock3 },
      { id: 'insurance-claims', label: 'Hồ sơ yêu cầu bảo hiểm', to: '/billing/insurance/claims', icon: ClipboardList },
      { id: 'insurance-pending', label: 'Yêu cầu bảo hiểm chờ xử lý', to: '/billing/insurance/pending-claims', icon: Clock3 },
      { id: 'insurance-submitted', label: 'Yêu cầu bảo hiểm đã gửi', to: '/billing/insurance/submitted-claims', icon: FileCheck2 },
      { id: 'insurance-reviewing', label: 'Yêu cầu bảo hiểm đang rà soát', to: '/billing/insurance/reviewing-claims', icon: ClipboardCheck },
      { id: 'insurance-approved', label: 'Yêu cầu bảo hiểm được duyệt', to: '/billing/insurance/approved-claims', icon: BadgeCheck },
      { id: 'insurance-rejected', label: 'Yêu cầu bảo hiểm bị từ chối', to: '/billing/insurance/rejected-claims', icon: AlertTriangle },
      { id: 'insurance-settlement', label: 'Quyết toán bảo hiểm', to: '/billing/insurance/settlement', icon: CircleDollarSign },
    ],
  },
  {
    id: 'refunds',
    label: 'Hoàn tiền / hủy',
    icon: RotateCcw,
    defaultOpen: false,
    children: [
      { id: 'refund-request', label: 'Yêu cầu hoàn tiền', to: '/billing/refunds/requests', icon: RotateCcw },
      { id: 'refund-pending', label: 'Hoàn tiền chờ xử lý', to: '/billing/refunds/pending', icon: Clock3 },
      { id: 'refund-processed', label: 'Hoàn tiền đã xử lý', to: '/billing/refunds/processed', icon: CheckCircle2 },
      { id: 'void-payment', label: 'Hủy thanh toán', to: '/billing/refunds/cancel-payment', icon: CreditCard },
      { id: 'void-invoice', label: 'Hủy hóa đơn', to: '/billing/refunds/cancel-invoice', icon: ReceiptText },
      { id: 'refund-void-history', label: 'Lịch sử hoàn tiền / hủy', to: '/billing/refunds/history', icon: History },
    ],
  },
  {
    id: 'reconciliation',
    label: 'Đối soát',
    icon: ArrowLeftRight,
    defaultOpen: false,
    children: [
      { id: 'reconcile-transfer', label: 'Đối soát QR / chuyển khoản', to: '/billing/reconciliation/qr-transfer', icon: ScanLine },
      { id: 'reconcile-manual-match', label: 'Thanh toán thủ công cần khớp', to: '/billing/reconciliation/manual-match-needed', icon: ClipboardCheck },
      { id: 'payment-mismatch', label: 'Sai lệch thanh toán', to: '/billing/reconciliation/payment-mismatch', icon: AlertTriangle },
      { id: 'unmatched-transactions', label: 'Giao dịch chưa khớp', to: '/billing/reconciliation/unmatched-transactions', icon: Clock3 },
      { id: 'reconcile-report', label: 'Báo cáo đối soát', to: '/billing/reconciliation/report', icon: BarChart3 },
    ],
  },
  {
    id: 'price-list',
    label: 'Bảng giá',
    icon: FileText,
    defaultOpen: false,
    children: [
      { id: 'services-catalog', label: 'Danh mục dịch vụ', to: '/billing/price-list/services', icon: ClipboardList },
      { id: 'department-price-list', label: 'Bảng giá theo khoa', to: '/billing/price-list/by-department', icon: Activity },
      { id: 'active-services', label: 'Dịch vụ đang hiệu lực', to: '/billing/price-list/active-services', icon: BadgeCheck },
      { id: 'inactive-services', label: 'Dịch vụ ngừng sử dụng', to: '/billing/price-list/inactive-services', icon: AlertTriangle },
    ],
  },
  {
    id: 'reports',
    label: 'Báo cáo',
    icon: BarChart3,
    defaultOpen: false,
    children: [
      { id: 'reports-overview', label: 'Tổng quan báo cáo', to: '/billing/reports/overview', icon: LayoutGrid },
      { id: 'reports-revenue', label: 'Doanh thu', to: '/billing/reports/revenue', icon: BarChart3 },
      { id: 'reports-debt', label: 'Công nợ', to: '/billing/reports/debt', icon: CircleDollarSign },
      { id: 'reports-payment-method', label: 'Theo phương thức thanh toán', to: '/billing/reports/payment-method', icon: CreditCard },
      { id: 'reports-department', label: 'Theo khoa', to: '/billing/reports/by-department', icon: Activity },
      { id: 'reports-refund-void', label: 'Hoàn tiền / hủy', to: '/billing/reports/refund-cancel', icon: RotateCcw },
      { id: 'reports-insurance', label: 'Bảo hiểm', to: '/billing/reports/insurance', icon: ShieldAlert },
      { id: 'reports-export', label: 'Xuất báo cáo', to: '/billing/reports/export', icon: FileText },
    ],
  },
];

const compactBillingMenuItemsBySection = {
  overview: ['overview-dashboard', 'overview-action-items'],
  'cashier-counter': [
    'counter-collect',
    'counter-search',
    'counter-unpaid',
    'counter-transfer-confirm',
    'counter-print-receipt',
  ],
  invoices: ['invoices-all', 'invoices-unpaid', 'invoices-paid', 'invoices-overdue'],
  payments: ['payments-all', 'payments-manual-confirmation', 'payments-failed-rejected'],
  receipts: ['receipts-reprint', 'receipts-history'],
  reports: ['reports-overview', 'reports-revenue', 'reports-debt'],
};

const compactBillingMenuLabels = {
  'overview-dashboard': 'Bảng điều khiển',
  'counter-unpaid': 'Hóa đơn chờ thu',
  'invoices-unpaid': 'Chưa thanh toán',
  'invoices-paid': 'Đã thanh toán',
  'invoices-overdue': 'Quá hạn',
  'payments-manual-confirmation': 'Cần xác nhận',
  'payments-failed-rejected': 'Thanh toán lỗi',
};

const compactDefaultOpenSections = new Set(['overview', 'cashier-counter']);

export const billingMenuSections = billingMenuCatalog
  .map((section) => {
    const itemIds = compactBillingMenuItemsBySection[section.id];
    if (!itemIds) return null;

    const itemsById = new Map((section.children || []).map((item) => [item.id, item]));
    const children = itemIds
      .map((id) => itemsById.get(id))
      .filter(Boolean)
      .map((item) => ({
        ...item,
        label: compactBillingMenuLabels[item.id] || item.label,
      }));

    return {
      ...section,
      defaultOpen: compactDefaultOpenSections.has(section.id),
      children,
    };
  })
  .filter(Boolean);

export function flattenBillingMenu(sections = billingMenuSections) {
  return sections.flatMap((section) =>
    (section.children || []).map((item) => ({
      ...item,
      sectionId: section.id,
      sectionLabel: section.label,
    })),
  );
}

export function getBillingPageMeta(pathname = '/billing/dashboard') {
  const normalizedPath = pathname === '/billing' ? '/billing/dashboard' : pathname;
  const item =
    flattenBillingMenu().find((entry) => entry.to === normalizedPath) ||
    flattenBillingMenu(billingMenuCatalog).find((entry) => entry.to === normalizedPath);

  return item || {
    id: 'overview-dashboard',
    label: 'Bảng điều khiển viện phí',
    sectionLabel: 'Tổng quan',
    to: '/billing/dashboard',
    icon: LayoutGrid,
  };
}
