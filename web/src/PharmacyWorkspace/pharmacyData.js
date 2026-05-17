import {
  Activity,
  Archive,
  ArrowLeftRight,
  Ban,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  History,
  House,
  ListChecks,
  PackageCheck,
  PackagePlus,
  PauseCircle,
  Pill,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  TimerOff,
  TriangleAlert,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { PHARMACY_PERMISSIONS } from './pharmacyApi';

export const pharmacyMenuSections = [
  {
    id: 'overview',
    order: '1.',
    label: 'Tổng quan',
    to: '/pharmacy/overview',
    icon: House,
    hint: 'Bảng điều khiển nhà thuốc',
  },
  {
    id: 'prescriptions',
    order: '2.',
    label: 'Đơn thuốc',
    icon: ClipboardList,
    defaultOpen: true,
    children: [
      { id: 'prescriptions-all', label: 'Tất cả đơn', to: '/pharmacy/prescriptions', icon: FileText, permissionAny: PHARMACY_PERMISSIONS.prescriptionsRead },
      { id: 'prescriptions-verify', label: 'Chờ xác minh', to: '/pharmacy/prescriptions/pending-verification', icon: Clock3, badge: 18, badgeTone: 'danger', permissionAny: PHARMACY_PERMISSIONS.prescriptionsVerify },
      { id: 'prescriptions-ready', label: 'Sẵn sàng cấp phát', to: '/pharmacy/prescriptions/ready-to-dispense', icon: CheckCircle2, badge: 12, badgeTone: 'warning', permissionAny: PHARMACY_PERMISSIONS.dispensesRead },
      { id: 'prescriptions-dispensed', label: 'Đã cấp phát', to: '/pharmacy/prescriptions/dispensed', icon: FileCheck2, badge: 156, badgeTone: 'neutral', permissionAny: PHARMACY_PERMISSIONS.dispensesRead },
      { id: 'prescriptions-cancelled', label: 'Đã hủy', to: '/pharmacy/prescriptions/cancelled', icon: Ban, badge: 8, badgeTone: 'neutral', permissionAny: PHARMACY_PERMISSIONS.prescriptionsRead },
    ],
  },
  {
    id: 'dispensing',
    order: '3.',
    label: 'Cấp phát thuốc',
    icon: PackageCheck,
    defaultOpen: true,
    children: [
      { id: 'dispensing-queue', label: 'Hàng chờ cấp phát', to: '/pharmacy/dispensing/queue', icon: ListChecks, badge: 24, badgeTone: 'danger', permissionAny: PHARMACY_PERMISSIONS.dispensesRead },
      { id: 'dispensing-create', label: 'Tạo phiếu cấp phát', to: '/pharmacy/dispensing/create', icon: Plus, permissionAny: PHARMACY_PERMISSIONS.dispensesCreate },
      { id: 'dispensing-completed', label: 'Hoàn tất cấp phát', to: '/pharmacy/dispensing/completed', icon: ClipboardCheck, permissionAny: PHARMACY_PERMISSIONS.dispensesRead },
    ],
  },
  {
    id: 'medications',
    order: '4.',
    label: 'Danh mục thuốc',
    icon: Pill,
    defaultOpen: true,
    children: [
      { id: 'medications-all', label: 'Tất cả thuốc', to: '/pharmacy/medications', icon: Boxes, permissionAny: PHARMACY_PERMISSIONS.medicationsRead },
      { id: 'medications-new', label: 'Thêm thuốc', to: '/pharmacy/medications/create', icon: PackagePlus, permissionAny: PHARMACY_PERMISSIONS.medicationsCreate },
      { id: 'medications-inactive', label: 'Thuốc ngưng dùng', to: '/pharmacy/medications/retired', icon: PauseCircle, permissionAny: PHARMACY_PERMISSIONS.medicationsRead },
    ],
  },
  {
    id: 'inventory',
    order: '5.',
    label: 'Tồn kho',
    icon: Archive,
    defaultOpen: true,
    children: [
      { id: 'inventory-batches', label: 'Lô thuốc', to: '/pharmacy/inventory/batches', icon: Boxes, permissionAny: PHARMACY_PERMISSIONS.stockBatchesRead },
      { id: 'inventory-receipts', label: 'Nhập kho', to: '/pharmacy/inventory/receipts', icon: PackagePlus, permissionAny: PHARMACY_PERMISSIONS.inventoryReceipt },
      { id: 'inventory-adjustments', label: 'Điều chỉnh kho', to: '/pharmacy/inventory/adjustments', icon: SlidersHorizontal, permissionAny: PHARMACY_PERMISSIONS.inventoryAdjust },
      { id: 'inventory-transactions', label: 'Giao dịch kho', to: '/pharmacy/inventory/transactions', icon: ArrowLeftRight, permissionAny: PHARMACY_PERMISSIONS.inventoryRead },
      { id: 'inventory-low-stock', label: 'Sắp hết hàng', to: '/pharmacy/inventory/low-stock', icon: TriangleAlert, badge: 21, badgeTone: 'danger', permissionAny: PHARMACY_PERMISSIONS.stockBatchesRead },
      { id: 'inventory-expiring', label: 'Sắp hết hạn', to: '/pharmacy/inventory/expiring', icon: TimerOff, badge: 9, badgeTone: 'warning', permissionAny: PHARMACY_PERMISSIONS.stockBatchesRead },
      { id: 'inventory-recalls', label: 'Thu hồi', to: '/pharmacy/inventory/recalls', icon: RotateCcw, permissionAny: PHARMACY_PERMISSIONS.stockBatchesRecall },
    ],
  },
  {
    id: 'patients',
    order: '6.',
    label: 'Bệnh nhân',
    icon: UsersRound,
    defaultOpen: true,
    children: [
      { id: 'patients-search', label: 'Tìm bệnh nhân', to: '/pharmacy/patients', icon: Search, permissionAny: ['patients.search', 'patients.read'] },
      { id: 'patients-history', label: 'Lịch sử thuốc', to: '/pharmacy/patients/history', icon: History, permissionAny: PHARMACY_PERMISSIONS.prescriptionsRead },
      { id: 'patients-active', label: 'Đơn đang hoạt động', to: '/pharmacy/patients/active-prescriptions', icon: Activity, permissionAny: PHARMACY_PERMISSIONS.prescriptionsRead },
      { id: 'patients-allergies', label: 'Dị ứng', to: '/pharmacy/patients/allergies', icon: ShieldAlert, permissionAny: ['patients.read', 'allergies.read'] },
    ],
  },
  {
    id: 'billing',
    order: '7.',
    label: 'Thanh toán',
    icon: WalletCards,
    defaultOpen: true,
    children: [
      { id: 'billing-fees', label: 'Chi phí thuốc', to: '/pharmacy/billing/charges', icon: CircleDollarSign, permissionAny: ['CHARGES.READ'] },
      { id: 'billing-invoices', label: 'Hóa đơn', to: '/pharmacy/billing/invoices', icon: ReceiptText, permissionAny: ['INVOICES.READ'] },
      { id: 'billing-payments', label: 'Thanh toán', to: '/pharmacy/billing/payments', icon: CreditCard, permissionAny: ['PAYMENTS.READ'] },
    ],
  },
  {
    id: 'reports',
    order: '8.',
    label: 'Báo cáo',
    icon: BarChart3,
    defaultOpen: true,
    children: [
      { id: 'reports-stock', label: 'Báo cáo tồn kho', to: '/pharmacy/reports/inventory', icon: BarChart3, permissionAny: ['REPORTS.INVENTORY.READ', 'STOCK_BATCHES.READ'] },
      { id: 'reports-prescriptions', label: 'Báo cáo đơn thuốc', to: '/pharmacy/reports/prescriptions', icon: ClipboardList, permissionAny: PHARMACY_PERMISSIONS.prescriptionsRead },
      { id: 'reports-low-stock', label: 'Sắp hết hàng', to: '/pharmacy/reports/low-stock', icon: TriangleAlert, permissionAny: ['REPORTS.LOW_STOCK.READ', 'STOCK_BATCHES.READ'] },
      { id: 'reports-expiring', label: 'Sắp hết hạn', to: '/pharmacy/reports/expiring', icon: TimerOff, permissionAny: ['REPORTS.EXPIRING_STOCK.READ', 'STOCK_BATCHES.READ'] },
    ],
  },
  {
    id: 'notifications',
    order: '9.',
    label: 'Thông báo',
    to: '/pharmacy/notifications',
    icon: Bell,
    hint: 'Cảnh báo vận hành',
    permissionAny: PHARMACY_PERMISSIONS.notificationsRead,
  },
  {
    id: 'settings',
    order: '10.',
    label: 'Cài đặt',
    to: '/pharmacy/settings',
    icon: Settings,
    hint: 'Thiết lập nhà thuốc',
  },
];

export const pharmacyQuickActions = [
  {
    id: 'receive-inventory',
    label: 'Nhập kho',
    to: '/pharmacy/inventory/receipts',
    icon: PackagePlus,
    permissionAny: PHARMACY_PERMISSIONS.inventoryReceipt,
  },
  {
    id: 'create-medication',
    label: 'Tạo thuốc',
    to: '/pharmacy/medications/create',
    icon: Pill,
    permissionAny: PHARMACY_PERMISSIONS.medicationsCreate,
  },
  {
    id: 'adjust-inventory',
    label: 'Điều chỉnh kho',
    to: '/pharmacy/inventory/adjustments',
    icon: SlidersHorizontal,
    permissionAny: PHARMACY_PERMISSIONS.inventoryAdjust,
  },
  {
    id: 'create-dispense',
    label: 'Tạo phiếu cấp phát',
    to: '/pharmacy/dispensing/create',
    icon: PackageCheck,
    permissionAny: PHARMACY_PERMISSIONS.dispensesCreate,
  },
];

export const pharmacyDashboardStats = [
  { label: 'Chờ xác minh', value: '18', trend: '+4 hôm nay', tone: 'danger', icon: Clock3 },
  { label: 'Sẵn sàng cấp phát', value: '12', trend: 'Ưu tiên trước 11:30', tone: 'warning', icon: CheckCircle2 },
  { label: 'Đã cấp phát', value: '156', trend: '92% đúng hạn', tone: 'success', icon: PackageCheck },
  { label: 'Sắp hết hạn', value: '9', trend: 'Cần kiểm tra lô', tone: 'info', icon: TimerOff },
];

export const pharmacyQueueItems = [
  { code: 'RX-2405-018', patient: 'Nguyễn Thị An', status: 'Chờ xác minh', time: '09:24', tone: 'danger' },
  { code: 'RX-2405-021', patient: 'Trần Quốc Bảo', status: 'Sẵn sàng cấp phát', time: '09:36', tone: 'warning' },
  { code: 'RX-2405-025', patient: 'Lê Minh Khoa', status: 'Đang soạn thuốc', time: '09:45', tone: 'info' },
  { code: 'RX-2405-028', patient: 'Phạm Hồng Nhung', status: 'Đợi thanh toán', time: '10:02', tone: 'neutral' },
];

export const pharmacyInventoryAlerts = [
  { title: 'Paracetamol 500mg', meta: 'Còn 34 hộp | Ngưỡng tối thiểu 50', tone: 'warning' },
  { title: 'Amoxicillin 250mg', meta: 'Lô AMX-042 hết hạn sau 21 ngày', tone: 'danger' },
  { title: 'Omeprazole 20mg', meta: 'Nhập kho mới 120 hộp sáng nay', tone: 'success' },
];

export const pharmacyNotifications = [
  {
    id: 'verify-prescriptions',
    title: '18 đơn thuốc cần xác minh',
    body: 'Ưu tiên các đơn có cảnh báo tương tác thuốc.',
    time: '5 phút trước',
    tone: 'danger',
    read: false,
    to: '/pharmacy/prescriptions/pending-verification',
  },
  {
    id: 'ready-dispense',
    title: '12 đơn sẵn sàng cấp phát',
    body: 'Quầy số 2 đang có tải cao hơn bình thường.',
    time: '17 phút trước',
    tone: 'warning',
    read: false,
    to: '/pharmacy/prescriptions/ready-to-dispense',
  },
  {
    id: 'batch-expiring',
    title: '9 lô thuốc sắp hết hạn',
    body: 'Kiểm tra hạn dùng và kế hoạch thu hồi.',
    time: '1 giờ trước',
    tone: 'info',
    read: false,
    to: '/pharmacy/inventory/expiring',
  },
];

export function flattenPharmacyMenu(sections = pharmacyMenuSections) {
  return sections.flatMap((section) => {
    if (!section.children?.length) return [section];
    return section.children.map((item) => ({
      ...item,
      groupLabel: section.label,
      groupIcon: section.icon,
    }));
  });
}

export function getPharmacyPageMeta(pathname) {
  const allItems = flattenPharmacyMenu();
  const exactMatch = allItems.find((item) => item.to === pathname);
  if (exactMatch) return exactMatch;

  const prefixMatch = [...allItems]
    .sort((first, second) => second.to.length - first.to.length)
    .find((item) => pathname.startsWith(`${item.to}/`));

  return prefixMatch || pharmacyMenuSections[0];
}
