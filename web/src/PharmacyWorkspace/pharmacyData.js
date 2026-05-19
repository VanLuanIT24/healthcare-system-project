import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  History,
  PackageCheck,
  PackagePlus,
  Pill,
  RotateCcw,
  Settings,
  ShieldAlert,
  TimerOff,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';

export const pharmacyMenuSections = [
  {
    id: 'overview',
    label: 'Tổng quan nhà thuốc',
    icon: BarChart3,
    defaultOpen: true,
    children: [
      { id: 'overview-dashboard', label: 'Bảng điều khiển nhà thuốc', to: '/pharmacy/overview', icon: BarChart3 },
      { id: 'overview-action-items', label: 'Việc cần xử lý', to: '/pharmacy/overview/action-items', icon: ClipboardCheck },
      { id: 'overview-today-dispensing', label: 'Cấp phát hôm nay', to: '/pharmacy/overview/today-dispensing', icon: PackageCheck },
      { id: 'overview-pharmacy-alerts', label: 'Cảnh báo dược', to: '/pharmacy/overview/alerts', icon: ShieldAlert },
      { id: 'overview-performance', label: 'Hiệu suất nhà thuốc', to: '/pharmacy/overview/performance', icon: Activity },
    ],
  },
  {
    id: 'prescriptions',
    label: 'Đơn thuốc',
    icon: ClipboardList,
    defaultOpen: true,
    children: [
      { id: 'prescriptions-approval', label: 'Chờ duyệt dược', to: '/pharmacy/prescriptions/pharmacy-approval', icon: ClipboardCheck },
      { id: 'prescriptions-review', label: 'Cần kiểm tra', to: '/pharmacy/prescriptions/review-needed', icon: AlertTriangle },
      { id: 'prescriptions-pending-dispense', label: 'Chờ cấp phát', to: '/pharmacy/prescriptions/pending-dispense', icon: Clock3 },
      { id: 'prescriptions-partial-dispense', label: 'Cấp phát một phần', to: '/pharmacy/prescriptions/partial-dispense', icon: Activity },
      { id: 'prescriptions-dispensed', label: 'Đã cấp phát', to: '/pharmacy/prescriptions/dispensed', icon: FileCheck2 },
      { id: 'prescriptions-cancelled', label: 'Đã hủy', to: '/pharmacy/prescriptions/cancelled', icon: RotateCcw },
      { id: 'prescriptions-refill', label: 'Yêu cầu cấp lại thuốc', to: '/pharmacy/prescriptions/refill-requests', icon: PackagePlus },
      { id: 'prescriptions-history', label: 'Lịch sử đơn thuốc', to: '/pharmacy/prescriptions/history', icon: History },
    ],
  },
  {
    id: 'dispensing',
    label: 'Cấp phát thuốc',
    icon: PackageCheck,
    defaultOpen: true,
    children: [
      { id: 'dispensing-queue', label: 'Hàng đợi cấp phát', to: '/pharmacy/dispensing/queue', icon: ClipboardList },
      { id: 'dispensing-preparing', label: 'Phiếu đang chuẩn bị', to: '/pharmacy/dispensing/preparing-slips', icon: FileText },
      { id: 'dispensing-pending-completion', label: 'Chờ hoàn tất cấp phát', to: '/pharmacy/dispensing/pending-completion', icon: Clock3 },
      { id: 'dispensing-completed', label: 'Đã cấp phát', to: '/pharmacy/dispensing/completed', icon: CheckCircle2 },
      { id: 'dispensing-held-rejected', label: 'Tạm giữ / từ chối', to: '/pharmacy/dispensing/held-rejected', icon: AlertTriangle },
      { id: 'dispensing-returns', label: 'Hoàn trả thuốc', to: '/pharmacy/dispensing/returns', icon: RotateCcw },
      { id: 'dispensing-labels-instructions', label: 'In nhãn và hướng dẫn', to: '/pharmacy/dispensing/labels-instructions', icon: FileCheck2 },
    ],
  },
  {
    id: 'inventory',
    label: 'Kho thuốc',
    icon: Boxes,
    defaultOpen: true,
    children: [
      { id: 'inventory-medications', label: 'Danh mục thuốc', to: '/pharmacy/inventory/medication-catalog', icon: Pill },
      { id: 'inventory-current', label: 'Tồn kho hiện tại', to: '/pharmacy/inventory/current-stock', icon: Boxes },
      { id: 'inventory-batches', label: 'Lô thuốc', to: '/pharmacy/inventory/batches', icon: PackageCheck },
      { id: 'inventory-valid-batches', label: 'Lô còn hạn', to: '/pharmacy/inventory/valid-batches', icon: BadgeCheck },
      { id: 'inventory-expiring-batches', label: 'Lô sắp hết hạn', to: '/pharmacy/inventory/expiring-batches', icon: TimerOff },
      { id: 'inventory-expired-batches', label: 'Lô đã hết hạn', to: '/pharmacy/inventory/expired-batches', icon: AlertTriangle },
      { id: 'inventory-empty-batches', label: 'Lô hết tồn', to: '/pharmacy/inventory/empty-batches', icon: TriangleAlert },
      { id: 'inventory-quarantine', label: 'Cách ly / thu hồi', to: '/pharmacy/inventory/quarantine-recall', icon: ShieldAlert },
      { id: 'inventory-count', label: 'Kiểm kê', to: '/pharmacy/inventory/stock-count', icon: ClipboardCheck },
    ],
  },
  {
    id: 'transactions',
    label: 'Nhập và xuất kho',
    icon: ArrowLeftRight,
    defaultOpen: false,
    children: [
      { id: 'transactions-receive', label: 'Nhập kho', to: '/pharmacy/transactions/receive-stock', icon: PackagePlus },
      { id: 'transactions-internal-issue', label: 'Xuất kho nội bộ', to: '/pharmacy/transactions/internal-issue', icon: PackageCheck },
      { id: 'transactions-transfer', label: 'Chuyển kho', to: '/pharmacy/transactions/stock-transfer', icon: ArrowLeftRight },
      { id: 'transactions-adjust', label: 'Điều chỉnh tồn kho', to: '/pharmacy/transactions/stock-adjustment', icon: ClipboardCheck },
      { id: 'transactions-loss', label: 'Hủy / hao hụt', to: '/pharmacy/transactions/loss-waste', icon: RotateCcw },
      { id: 'transactions-return-stock', label: 'Hoàn trả về kho', to: '/pharmacy/transactions/return-to-stock', icon: FileCheck2 },
      { id: 'transactions-history', label: 'Lịch sử giao dịch', to: '/pharmacy/transactions/history', icon: History },
    ],
  },
  {
    id: 'inpatient-medication',
    label: 'Dùng thuốc nội trú',
    icon: CalendarDays,
    defaultOpen: false,
    children: [
      { id: 'inpatient-medication-schedule', label: 'Lịch dùng thuốc', to: '/pharmacy/inpatient-medication/schedule', icon: CalendarDays },
      { id: 'inpatient-medication-today', label: 'Thuốc cần dùng hôm nay', to: '/pharmacy/inpatient-medication/today-medications', icon: Pill },
      { id: 'inpatient-medication-confirm', label: 'Xác nhận dùng thuốc', to: '/pharmacy/inpatient-medication/confirm', icon: CheckCircle2 },
      { id: 'inpatient-medication-exceptions', label: 'Tạm hoãn / từ chối / bỏ liều', to: '/pharmacy/inpatient-medication/defer-refuse-missed', icon: AlertTriangle },
      { id: 'inpatient-medication-abnormal', label: 'Bất thường dùng thuốc', to: '/pharmacy/inpatient-medication/abnormal-events', icon: ShieldAlert },
    ],
  },
  {
    id: 'reports',
    label: 'Báo cáo dược',
    icon: BarChart3,
    defaultOpen: false,
    children: [
      { id: 'reports-inventory-overview', label: 'Tổng quan tồn kho', to: '/pharmacy/reports/inventory-overview', icon: BarChart3 },
      { id: 'reports-movement', label: 'Nhập xuất tồn', to: '/pharmacy/reports/stock-movement', icon: ArrowLeftRight },
      { id: 'reports-dispensed', label: 'Thuốc đã cấp phát', to: '/pharmacy/reports/dispensed-medications', icon: PackageCheck },
      { id: 'reports-expiring', label: 'Thuốc sắp hết hạn', to: '/pharmacy/reports/expiring-medications', icon: TimerOff },
      { id: 'reports-below-minimum', label: 'Thuốc dưới tồn tối thiểu', to: '/pharmacy/reports/below-minimum-stock', icon: TriangleAlert },
      { id: 'reports-stock-value', label: 'Giá trị tồn kho', to: '/pharmacy/reports/stock-value', icon: WalletCards },
      { id: 'reports-high-usage', label: 'Thuốc dùng nhiều', to: '/pharmacy/reports/high-usage', icon: Activity },
      { id: 'reports-loss-waste', label: 'Hao hụt / hủy thuốc', to: '/pharmacy/reports/loss-waste', icon: RotateCcw },
    ],
  },
  {
    id: 'alerts',
    label: 'Cảnh báo',
    icon: ShieldAlert,
    defaultOpen: false,
    children: [
      { id: 'alerts-low-stock', label: 'Sắp hết thuốc', to: '/pharmacy/alerts/low-stock', icon: TriangleAlert },
      { id: 'alerts-out-of-stock', label: 'Hết thuốc', to: '/pharmacy/alerts/out-of-stock', icon: AlertTriangle },
      { id: 'alerts-expiring-batches', label: 'Lô sắp hết hạn', to: '/pharmacy/alerts/expiring-batches', icon: TimerOff },
      { id: 'alerts-expired-batches', label: 'Lô đã hết hạn', to: '/pharmacy/alerts/expired-batches', icon: AlertTriangle },
      { id: 'alerts-insufficient', label: 'Không đủ thuốc cấp phát', to: '/pharmacy/alerts/insufficient-stock', icon: ClipboardList },
      { id: 'alerts-allergy', label: 'Cảnh báo dị ứng', to: '/pharmacy/alerts/allergy', icon: ShieldAlert },
      { id: 'alerts-high-usage', label: 'Thuốc dùng nhiều', to: '/pharmacy/alerts/high-usage', icon: Activity },
      { id: 'alerts-loss-waste', label: 'Hao hụt / hủy thuốc', to: '/pharmacy/alerts/loss-waste', icon: RotateCcw },
    ],
  },
  {
    id: 'settings',
    label: 'Cấu hình dược',
    icon: Settings,
    defaultOpen: false,
    children: [
      { id: 'settings-medication-units', label: 'Đơn vị thuốc', to: '/pharmacy/settings/medication-units', icon: Pill },
      { id: 'settings-dosage-forms', label: 'Dạng bào chế', to: '/pharmacy/settings/dosage-forms', icon: FileText },
      { id: 'settings-administration-routes', label: 'Đường dùng', to: '/pharmacy/settings/routes-of-administration', icon: Activity },
      { id: 'settings-storage-locations', label: 'Vị trí lưu kho', to: '/pharmacy/settings/storage-locations', icon: Boxes },
      { id: 'settings-suppliers', label: 'Nhà cung cấp', to: '/pharmacy/settings/suppliers', icon: PackagePlus },
      { id: 'settings-alert-thresholds', label: 'Ngưỡng cảnh báo', to: '/pharmacy/settings/alert-thresholds', icon: Bell },
      { id: 'settings-expiry-policy', label: 'Chính sách xuất trước theo hạn dùng', to: '/pharmacy/settings/expiry-policy', icon: TimerOff },
      { id: 'settings-controlled-medications', label: 'Chính sách thuốc kiểm soát', to: '/pharmacy/settings/controlled-medication-policy', icon: ShieldAlert },
    ],
  },
];

export const pharmacyQuickActions = [
  { id: 'dispensing-queue', label: 'Hàng đợi cấp phát', to: '/pharmacy/dispensing/queue', icon: PackageCheck },
  { id: 'action-items', label: 'Việc cần xử lý', to: '/pharmacy/overview/action-items', icon: ClipboardCheck },
  { id: 'receive-stock', label: 'Nhập kho', to: '/pharmacy/transactions/receive-stock', icon: PackagePlus },
  { id: 'stock-count', label: 'Kiểm kê', to: '/pharmacy/inventory/stock-count', icon: ClipboardCheck },
];

export const pharmacyNotifications = [
  {
    id: 'pending-prescriptions',
    title: 'Đơn thuốc chờ cấp phát',
    body: 'Ưu tiên các đơn có cảnh báo tương tác hoặc thiếu tồn kho.',
    time: '5 phút trước',
    tone: 'warning',
    read: false,
    to: '/pharmacy/prescriptions/pending-dispense',
  },
  {
    id: 'low-stock',
    title: 'Sắp hết thuốc',
    body: 'Một số thuốc đã xuống dưới ngưỡng tối thiểu.',
    time: '17 phút trước',
    tone: 'danger',
    read: false,
    to: '/pharmacy/alerts/low-stock',
  },
  {
    id: 'expiring-batches',
    title: 'Lô sắp hết hạn',
    body: 'Kiểm tra hạn dùng và kế hoạch cách ly hoặc thu hồi.',
    time: '1 giờ trước',
    tone: 'info',
    read: false,
    to: '/pharmacy/inventory/expiring-batches',
  },
];

export function flattenPharmacyMenu(sections = pharmacyMenuSections) {
  return sections.flatMap((section) =>
    (section.children || []).map((item) => ({
      ...item,
      groupLabel: section.label,
      groupIcon: section.icon,
    })),
  );
}

export function getPharmacyPageMeta(pathname = '/pharmacy/overview') {
  const normalizedPath = pathname === '/pharmacy' || pathname === '/pharmacy/dashboard'
    ? '/pharmacy/overview'
    : pathname;
  const allItems = flattenPharmacyMenu();
  const exactMatch = allItems.find((item) => item.to === normalizedPath);
  if (exactMatch) return exactMatch;

  const prefixMatch = [...allItems]
    .sort((first, second) => second.to.length - first.to.length)
    .find((item) => normalizedPath.startsWith(`${item.to}/`));

  return prefixMatch || allItems[0];
}
