import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  FileText,
  FlaskConical,
  HeartPulse,
  History,
  LayoutGrid,
  Monitor,
  Pill,
  ScanLine,
  ShieldAlert,
  Stethoscope,
  UserSquare2,
  Users,
} from 'lucide-react';

export const nurseMenuSections = [
  {
    id: 'overview',
    label: 'Tổng quan',
    icon: LayoutGrid,
    defaultOpen: true,
    children: [
      { id: 'dashboard', label: 'Bảng điều khiển', to: '/nurse/dashboard', icon: LayoutGrid },
      { id: 'pending-processing', label: 'Bệnh nhân chờ xử lý', to: '/nurse/overview/pending-processing', icon: Users },
      { id: 'today-work', label: 'Việc cần làm hôm nay', to: '/nurse/overview/today-work', icon: CalendarDays },
      { id: 'priority-alerts', label: 'Cảnh báo ưu tiên', to: '/nurse/overview/priority-alerts', icon: AlertTriangle },
      { id: 'realtime-queue', label: 'Hàng đợi thời gian thực', to: '/nurse/overview/realtime-queue', icon: Monitor },
    ],
  },
  {
    id: 'reception-triage',
    label: 'Tiếp nhận và phân loại',
    icon: ClipboardPlus,
    defaultOpen: true,
    children: [
      { id: 'checked-in-patients', label: 'Bệnh nhân đã tiếp nhận', to: '/nurse/reception-triage/checked-in-patients', icon: CheckCircle2 },
      { id: 'waiting-nursing', label: 'Chờ điều dưỡng', to: '/nurse/reception-triage/waiting-nursing', icon: Users },
      { id: 'waiting-triage', label: 'Chờ phân loại', to: '/nurse/reception-triage/waiting-triage', icon: Clock3 },
      { id: 'create-triage', label: 'Tạo phiếu phân loại', to: '/nurse/reception-triage/create-triage', icon: ClipboardPlus },
      { id: 'priority-transfer', label: 'Ưu tiên / chuyển tuyến', to: '/nurse/reception-triage/priority-transfer', icon: AlertTriangle },
      { id: 'ready-for-doctor', label: 'Sẵn sàng gặp bác sĩ', to: '/nurse/reception-triage/ready-for-doctor', icon: Stethoscope },
    ],
  },
  {
    id: 'vitals-records',
    label: 'Sinh hiệu và ghi nhận',
    icon: HeartPulse,
    defaultOpen: true,
    children: [
      { id: 'vitals-waiting', label: 'Chờ đo sinh hiệu', to: '/nurse/vitals-records/waiting', icon: Clock3 },
      { id: 'vitals-entry', label: 'Nhập sinh hiệu', to: '/nurse/vitals-records/entry', icon: HeartPulse },
      { id: 'vitals-history', label: 'Lịch sử sinh hiệu', to: '/nurse/vitals-records/history', icon: Activity },
      { id: 'vitals-abnormal', label: 'Sinh hiệu bất thường', to: '/nurse/vitals-records/abnormal', icon: AlertTriangle },
      { id: 'records-corrections', label: 'Bản ghi cần sửa', to: '/nurse/vitals-records/corrections-needed', icon: FileText },
      { id: 'nursing-notes', label: 'Ghi chú điều dưỡng', to: '/nurse/vitals-records/nursing-notes', icon: ClipboardCheck },
    ],
  },
  {
    id: 'service-preparation',
    label: 'Chuẩn bị dịch vụ',
    icon: ClipboardCheck,
    defaultOpen: false,
    children: [
      { id: 'prep-waiting', label: 'Chờ chuẩn bị', to: '/nurse/service-preparation/waiting', icon: Users },
      { id: 'prep-exam', label: 'Trước khám', to: '/nurse/service-preparation/pre-exam', icon: ClipboardCheck },
      { id: 'prep-lab', label: 'Trước xét nghiệm', to: '/nurse/service-preparation/pre-lab', icon: FlaskConical },
      { id: 'prep-imaging', label: 'Trước CĐHA', to: '/nurse/service-preparation/pre-imaging', icon: ScanLine },
      { id: 'prep-procedure', label: 'Trước thủ thuật', to: '/nurse/service-preparation/pre-procedure', icon: Stethoscope },
      { id: 'prep-checklist', label: 'Bảng kiểm chuẩn bị', to: '/nurse/service-preparation/checklists', icon: ClipboardList },
    ],
  },
  {
    id: 'monitoring-reporting',
    label: 'Theo dõi và báo bác sĩ',
    icon: Activity,
    defaultOpen: false,
    children: [
      { id: 'monitoring-patients', label: 'Bệnh nhân đang theo dõi', to: '/nurse/monitoring-reporting/patients', icon: Users },
      { id: 'monitoring-post-procedure', label: 'Sau thủ thuật', to: '/nurse/monitoring-reporting/post-procedure', icon: ClipboardCheck },
      { id: 'monitoring-post-medication', label: 'Sau dùng thuốc', to: '/nurse/monitoring-reporting/post-medication', icon: Pill },
      { id: 'monitoring-alerts', label: 'Cảnh báo bất thường', to: '/nurse/monitoring-reporting/abnormal-alerts', icon: Bell },
      { id: 'monitoring-urgent-cases', label: 'Ca cần báo khẩn', to: '/nurse/monitoring-reporting/urgent-cases', icon: ShieldAlert },
      { id: 'monitoring-report-doctor', label: 'Báo bác sĩ', to: '/nurse/monitoring-reporting/report-doctor', icon: Stethoscope },
    ],
  },
  {
    id: 'tasks-handover',
    label: 'Nhiệm vụ và bàn giao',
    icon: ClipboardList,
    defaultOpen: false,
    children: [
      { id: 'tasks-assigned', label: 'Nhiệm vụ được giao', to: '/nurse/tasks-handover/assigned', icon: ClipboardList },
      { id: 'tasks-by-patient', label: 'Nhiệm vụ theo bệnh nhân', to: '/nurse/tasks-handover/by-patient', icon: Users },
      { id: 'tasks-overdue', label: 'Nhiệm vụ quá hạn', to: '/nurse/tasks-handover/overdue', icon: Clock3 },
      { id: 'tasks-completed', label: 'Nhiệm vụ đã hoàn tất', to: '/nurse/tasks-handover/completed', icon: CheckCircle2 },
      { id: 'shift-handover', label: 'Bàn giao ca', to: '/nurse/tasks-handover/shift-handover', icon: UserSquare2 },
      { id: 'handover-history', label: 'Lịch sử bàn giao', to: '/nurse/tasks-handover/handover-history', icon: History },
    ],
  },
  {
    id: 'inpatient',
    label: 'Nội trú',
    icon: UserSquare2,
    defaultOpen: false,
    children: [
      { id: 'inpatient-list', label: 'Danh sách nội trú', to: '/nurse/inpatient/list', icon: Users },
      { id: 'inpatient-admission', label: 'Nhập viện', to: '/nurse/inpatient/admissions', icon: ClipboardPlus },
      { id: 'inpatient-rooms', label: 'Phòng / giường', to: '/nurse/inpatient/rooms-beds', icon: UserSquare2 },
      { id: 'inpatient-bed-transfer', label: 'Phân giường / chuyển giường', to: '/nurse/inpatient/bed-assignment-transfer', icon: CheckCircle2 },
      { id: 'inpatient-tasks', label: 'Nhiệm vụ nội trú', to: '/nurse/inpatient/tasks', icon: ClipboardList },
      { id: 'inpatient-bedside-medication', label: 'Cấp thuốc tại giường', to: '/nurse/inpatient/bedside-medication', icon: Pill },
      { id: 'inpatient-handover', label: 'Bàn giao nội trú', to: '/nurse/inpatient/handover', icon: UserSquare2 },
    ],
  },
  {
    id: 'emergency',
    label: 'Cấp cứu',
    icon: ShieldAlert,
    defaultOpen: false,
    children: [
      { id: 'emergency-open-cases', label: 'Ca khẩn đang mở', to: '/nurse/emergency/open-cases', icon: ShieldAlert },
      { id: 'emergency-triage', label: 'Phân loại cấp cứu', to: '/nurse/emergency/triage', icon: ClipboardPlus },
      { id: 'emergency-response-coordination', label: 'Điều phối phản ứng', to: '/nurse/emergency/response-coordination', icon: Activity },
      { id: 'emergency-escalation', label: 'Báo khẩn nâng cấp', to: '/nurse/emergency/escalation', icon: AlertTriangle },
      { id: 'emergency-response-commitment', label: 'Theo dõi cam kết phản ứng', to: '/nurse/emergency/response-commitment', icon: Clock3 },
      { id: 'emergency-closed-cases', label: 'Ca đã kết thúc', to: '/nurse/emergency/closed-cases', icon: CheckCircle2 },
    ],
  },
  {
    id: 'patient-lookup',
    label: 'Tra cứu bệnh nhân',
    icon: FileText,
    defaultOpen: false,
    children: [
      { id: 'patient-profile', label: 'Hồ sơ bệnh nhân', to: '/nurse/patient-lookup/profile', icon: UserSquare2 },
      { id: 'patient-encounter-history', label: 'Lịch sử lượt khám', to: '/nurse/patient-lookup/encounter-history', icon: History },
      { id: 'patient-vitals-history', label: 'Lịch sử sinh hiệu', to: '/nurse/patient-lookup/vitals-history', icon: HeartPulse },
      { id: 'patient-allergies-problems', label: 'Dị ứng / vấn đề đang có', to: '/nurse/patient-lookup/allergies-problems', icon: ShieldAlert },
      { id: 'patient-clinical-documents', label: 'Tài liệu lâm sàng', to: '/nurse/patient-lookup/clinical-documents', icon: FileText },
    ],
  },
];

export function flattenNurseMenu(sections = nurseMenuSections) {
  return sections.flatMap((section) =>
    (section.children || []).map((item) => ({
      ...item,
      sectionId: section.id,
      sectionLabel: section.label,
    })),
  );
}

export function getNursePageMeta(pathname = '/nurse/dashboard') {
  const normalizedPath = pathname === '/nurse' ? '/nurse/dashboard' : pathname;
  const item = flattenNurseMenu().find((entry) => entry.to === normalizedPath);

  return item || {
    id: 'dashboard',
    label: 'Bảng điều khiển',
    sectionLabel: 'Tổng quan',
    to: '/nurse/dashboard',
    icon: LayoutGrid,
  };
}
