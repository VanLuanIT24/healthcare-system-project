import {
  Activity,
  AlertTriangle,
  Archive,
  Banknote,
  BarChart3,
  BellRing,
  Bot,
  BookOpen,
  BriefcaseMedical,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CloudUpload,
  Command,
  Database,
  FileClock,
  FileCog,
  FileText,
  Fingerprint,
  Gauge,
  Globe2,
  HardDrive,
  HeartPulse,
  HelpCircle,
  History,
  Hospital,
  IdCard,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Link2,
  ListChecks,
  LockKeyhole,
  LogOut,
  Mail,
  Map,
  MessageSquare,
  MonitorCheck,
  Network,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  RadioTower,
  ReceiptText,
  RefreshCw,
  Router,
  ScanLine,
  Search,
  ServerCog,
  Settings,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ShieldEllipsis,
  SlidersHorizontal,
  Sparkles,
  Smartphone,
  Stethoscope,
  Store,
  TableProperties,
  TestTube2,
  TicketCheck,
  UploadCloud,
  UserCheck,
  UserCog,
  UserLock,
  UserPlus,
  UserRound,
  UsersRound,
  Vault,
  Webhook,
  Wifi,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppLogo, APP_BRAND_NAME, APP_BRAND_SUBTITLE } from '../../app/AppLogo';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';

const panelRoute = (panel) => `/admin/overview?panel=${panel}`;
const settingsRoute = (tab) => `/admin/settings?tab=${tab}`;
const auditRoute = (scope) => `/admin/logs/audit?scope=${scope}`;

const CONTROL_PLANE_SECTIONS = [
  {
    id: 'command-center',
    title: 'Trung tâm điều phối',
    subtitle: 'Điều phối thời gian thực',
    icon: Command,
    tone: 'cyan',
    items: [
      { label: 'Bảng điều khiển quản trị', icon: LayoutDashboard, to: '/admin/command-center', exact: true },
      { label: 'Sức khỏe hệ thống', icon: Activity, to: '/admin/command-center/health', badge: 'OK', badgeTone: 'success' },
      { label: 'Việc cần xử lý', icon: ClipboardCheck, to: '/admin/command-center/tasks', badge: 'Trực tiếp', badgeTone: 'warning' },
      { label: 'Cảnh báo hệ thống', icon: AlertTriangle, to: '/admin/command-center/system-alerts', badge: 'Vận hành', badgeTone: 'danger' },
      { label: 'Cảnh báo bảo mật', icon: ShieldAlert, to: '/admin/command-center/security-alerts', badge: 'Rủi ro', badgeTone: 'danger' },
      { label: 'Hoạt động gần đây', icon: History, to: '/admin/command-center/recent-activity' },
      { label: 'Phiên đăng nhập thời gian thực', icon: RadioTower, to: '/admin/command-center/sessions', badge: 'Trực tiếp', badgeTone: 'info' },
      { label: 'Tình trạng worker / hàng đợi', icon: ServerCog, to: '/admin/command-center/workers' },
      { label: 'Tình trạng thời gian thực', icon: Wifi, to: '/admin/command-center/realtime' },
      { label: 'Bản đồ workspace', icon: Map, to: '/admin/command-center/workspace-map' },
    ],
  },
  {
    id: 'organization',
    title: 'Tổ chức & nhân sự',
    subtitle: 'Tài khoản, hồ sơ, điều chuyển',
    icon: UsersRound,
    tone: 'green',
    items: [
      { label: 'Tất cả nhân sự', icon: UsersRound, to: '/admin/staff' },
      { label: 'Tạo tài khoản nhân viên', icon: UserPlus, to: '/admin/staff/create', exact: true, badge: 'Mới', badgeTone: 'success' },
      { label: 'Hồ sơ nhân sự', icon: IdCard, to: '/admin/staff?view=profiles' },
      { label: 'Bác sĩ', icon: Stethoscope, to: '/admin/staff?role=doctor' },
      { label: 'Nhân sự theo khoa', icon: Building2, to: '/admin/facilities/staff' },
      { label: 'Tài khoản chờ kích hoạt', icon: UserCheck, to: '/admin/staff?status=pending_activation' },
      { label: 'Tài khoản bị khóa', icon: UserLock, to: '/admin/staff?status=locked', badge: 'Rủi ro', badgeTone: 'danger' },
      { label: 'Tài khoản bị vô hiệu hóa', icon: ShieldBan, to: '/admin/staff?status=disabled' },
      { label: 'Tài khoản rủi ro', icon: ShieldAlert, to: '/admin/staff?risk=high', badge: 'Cao', badgeTone: 'danger' },
      { label: 'Chuyển khoa / điều chuyển', icon: RefreshCw, to: '/admin/system-control/organization/transfers' },
      { label: 'Đặt lại mật khẩu', icon: KeyRound, to: '/admin/system-control/organization/password-reset' },
      { label: 'Buộc đăng xuất', icon: LogOut, to: '/admin/system-control/organization/force-logout' },
      { label: 'Lịch sử đăng nhập nhân viên', icon: FileClock, to: '/admin/system-control/organization/login-history' },
    ],
  },
  {
    id: 'iam',
    title: 'IAM & phân quyền',
    subtitle: 'RBAC, chính sách chặn, cache',
    icon: ShieldCheck,
    tone: 'indigo',
    items: [
      { label: 'Tổng quan IAM', icon: Gauge, to: '/admin/iam/overview' },
      { label: 'Vai trò hệ thống', icon: ShieldCheck, to: '/admin/roles' },
      { label: 'Tạo vai trò', icon: Sparkles, to: '/admin/roles/create', exact: true },
      { label: 'Quyền hệ thống', icon: KeyRound, to: '/admin/permissions' },
      { label: 'Ma trận quyền', icon: TableProperties, to: '/admin/iam/matrix' },
      { label: 'Gán vai trò', icon: UserCog, to: '/admin/iam/assignment' },
      { label: 'Quyền hiệu lực theo người dùng', icon: Fingerprint, to: '/admin/iam/effective' },
      { label: 'Kiểm tra quyền truy cập', icon: ScanLine, to: '/admin/iam/access-check' },
      { label: 'Xem ngữ cảnh truy cập', icon: FileText, to: '/admin/iam/context' },
      { label: 'Tạo lại cache quyền', icon: RefreshCw, to: '/admin/iam/cache', badge: 'Vận hành', badgeTone: 'info' },
      { label: 'Quyền bị chặn', icon: ShieldBan, to: '/admin/iam/deny-permissions' },
      { label: 'Vai trò bị chặn', icon: LockKeyhole, to: '/admin/iam/deny-roles' },
      { label: 'Lịch sử thay đổi quyền', icon: History, to: '/admin/iam/audit' },
      { label: 'Khởi tạo quyền hệ thống', icon: Database, to: '/admin/iam/seed' },
    ],
  },
  {
    id: 'workspace-access',
    title: 'Truy cập workspace',
    subtitle: 'Đối tượng, sidebar, workspace mặc định',
    icon: Network,
    tone: 'blue',
    items: [
      { label: 'Tổng quan truy cập workspace', icon: LayoutDashboard, to: '/admin/workspace-access/overview' },
      { label: 'Danh sách workspace', icon: MonitorCheck, to: '/admin/workspace-access/list' },
      { label: 'Workspace theo đối tượng', icon: UserRound, to: '/admin/workspace-access/actor' },
      { label: 'Workspace theo vai trò', icon: ShieldCheck, to: '/admin/workspace-access/role' },
      { label: 'Workspace theo người dùng', icon: UsersRound, to: '/admin/workspace-access/user' },
      { label: 'Workspace theo khoa', icon: Building2, to: '/admin/workspace-access/department' },
      { label: 'Quyền truy cập workspace', icon: KeyRound, to: '/admin/workspace-access/policies' },
      { label: 'Cấu hình sidebar theo actor', icon: SlidersHorizontal, to: '/admin/workspace-access/sidebar' },
      { label: 'Điều hướng liên workspace', icon: Router, to: '/admin/workspace-access/navigation' },
      { label: 'Tùy chọn người dùng / workspace mặc định', icon: UserCog, to: '/admin/workspace-access/preferences' },
      { label: 'Kiểm tra khả dụng workspace', icon: CheckCircle2, to: '/admin/workspace-access/check', badge: 'OK', badgeTone: 'success' },
      { label: 'Xung đột chính sách truy cập', icon: AlertTriangle, to: '/admin/workspace-access/conflicts', badge: 'Quét', badgeTone: 'warning' },
      { label: 'Chẩn đoán workspace', icon: Activity, to: '/admin/workspace-access/diagnostics' },
      { label: 'Audit workspace', icon: FileClock, to: '/admin/workspace-access/audit' },
    ],
  },
  {
    id: 'facilities',
    title: 'Khoa phòng & cơ sở vận hành',
    subtitle: 'Khoa, phòng, điểm dịch vụ',
    icon: Hospital,
    tone: 'teal',
    items: [
      { label: 'Tổng quan khoa phòng', icon: Gauge, to: '/admin/facilities/overview' },
      { label: 'Danh sách khoa phòng', icon: Building2, to: '/admin/facilities/departments' },
      { label: 'Tạo khoa phòng', icon: Sparkles, to: '/admin/departments/create', exact: true },
      { label: 'Trưởng khoa', icon: UserCheck, to: '/admin/facilities/heads' },
      { label: 'Nhân sự theo khoa', icon: UsersRound, to: '/admin/facilities/staff' },
      { label: 'Tổng quan khoa', icon: BarChart3, to: '/admin/facilities/profile' },
      { label: 'Phòng khám / địa điểm', icon: Hospital, to: '/admin/facilities/locations' },
      { label: 'Khu vực tiếp nhận', icon: ListChecks, to: '/admin/facilities/reception' },
      { label: 'Phòng xét nghiệm', icon: TestTube2, to: '/admin/facilities/lab' },
      { label: 'Phòng CĐHA', icon: Activity, to: '/admin/facilities/imaging' },
      { label: 'Phòng thủ thuật', icon: BriefcaseMedical, to: '/admin/facilities/procedure' },
      { label: 'Kho / nhà thuốc', icon: Store, to: '/admin/facilities/warehouse' },
      { label: 'Trạng thái hoạt động', icon: MonitorCheck, to: '/admin/facilities/status' },
      { label: 'Cấu hình địa điểm dịch vụ', icon: Settings, to: '/admin/facilities/bindings' },
    ],
  },
  {
    id: 'master-data',
    title: 'Dữ liệu danh mục',
    subtitle: 'Danh mục lõi y tế',
    icon: Database,
    tone: 'amber',
    items: [
      { label: 'Tổng quan dữ liệu danh mục', icon: Gauge, to: '/admin/master-data/overview' },
      { label: 'Trung tâm chất lượng dữ liệu', icon: ShieldAlert, to: '/admin/master-data/quality', badge: 'Quét', badgeTone: 'warning' },
      { label: 'Dịch vụ y tế', icon: HeartPulse, to: '/admin/master-data/services' },
      { label: 'Bảng giá dịch vụ', icon: ReceiptText, to: '/admin/master-data/service-prices' },
      { label: 'Danh mục thuốc', icon: Pill, to: '/admin/master-data/medications' },
      { label: 'Đơn vị thuốc', icon: PackageCheck, to: '/admin/master-data/medication-units' },
      { label: 'Dạng bào chế', icon: FileCog, to: '/admin/master-data/dosage-forms' },
      { label: 'Đường dùng thuốc', icon: Router, to: '/admin/master-data/administration-routes' },
      { label: 'Nhà cung cấp', icon: Store, to: '/admin/master-data/suppliers' },
      { label: 'Kho dược', icon: Archive, to: '/admin/master-data/warehouses' },
      { label: 'Vị trí lưu kho', icon: HardDrive, to: '/admin/master-data/storage-locations' },
      { label: 'Danh mục xét nghiệm', icon: TestTube2, to: '/admin/master-data/lab-tests' },
      { label: 'Loại mẫu bệnh phẩm', icon: ClipboardList, to: '/admin/master-data/specimen-types' },
      { label: 'Danh mục CĐHA', icon: Activity, to: '/admin/master-data/imaging-catalog' },
      { label: 'Phòng CĐHA', icon: Hospital, to: '/admin/master-data/imaging-rooms' },
      { label: 'Thiết bị CĐHA', icon: MonitorCheck, to: '/admin/master-data/imaging-equipment' },
      { label: 'Danh mục thủ thuật', icon: BriefcaseMedical, to: '/admin/master-data/procedures' },
      { label: 'Mẫu báo cáo kết quả', icon: FileText, to: '/admin/master-data/report-templates' },
      { label: 'Loại lịch / slot', icon: CalendarClock, to: '/admin/master-data/schedule-types' },
      { label: 'Quy tắc mã định danh', icon: Fingerprint, to: '/admin/master-data/identifier-rules' },
      { label: 'Nhập / Xuất', icon: UploadCloud, to: '/admin/master-data/import-export' },
      { label: 'Yêu cầu thay đổi', icon: GitBranchIcon, to: '/admin/master-data/change-requests' },
      { label: 'Audit dữ liệu danh mục', icon: FileClock, to: '/admin/master-data/audit' },
    ],
  },
  {
    id: 'platform-config',
    title: 'Cấu hình nền tảng',
    subtitle: 'Bảo mật, thông báo, file, portal',
    icon: Settings,
    tone: 'violet',
    items: [
      { label: 'Cấu hình chung', icon: Settings, to: '/admin/settings' },
      { label: 'Cờ tính năng', icon: Sparkles, to: settingsRoute('feature-flags'), badge: 'Cờ', badgeTone: 'info' },
      { label: 'Cấu hình đăng nhập', icon: KeyRound, to: settingsRoute('login') },
      { label: 'Cấu hình bảo mật', icon: ShieldCheck, to: settingsRoute('security') },
      { label: 'Cấu hình Google OAuth', icon: Globe2, to: settingsRoute('google-oauth') },
      { label: 'Cấu hình thông báo', icon: BellRing, to: settingsRoute('notifications') },
      { label: 'Cấu hình email / SMTP', icon: Mail, to: settingsRoute('email-smtp') },
      { label: 'Cấu hình thông báo đẩy', icon: Smartphone, to: settingsRoute('push-notification') },
      { label: 'Cấu hình thời gian thực', icon: RadioTower, to: settingsRoute('realtime') },
      { label: 'Cấu hình tệp / tải lên', icon: UploadCloud, to: settingsRoute('file-upload') },
      { label: 'Cấu hình QR token', icon: ScanLine, to: settingsRoute('qr-token') },
      { label: 'Cấu hình thanh toán', icon: Banknote, to: settingsRoute('payments') },
      { label: 'Cấu hình cổng bệnh nhân', icon: HeartPulse, to: settingsRoute('patient-portal') },
      { label: 'Cấu hình SLA hỗ trợ', icon: TicketCheck, to: settingsRoute('support-sla') },
      { label: 'Cấu hình lưu trữ audit', icon: Archive, to: settingsRoute('audit-retention') },
    ],
  },
  {
    id: 'security-center',
    title: 'Trung tâm bảo mật',
    subtitle: 'Phiên, rủi ro, đồng thuận, truy cập',
    icon: ShieldAlert,
    tone: 'red',
    items: [
      { label: 'Bảng điều khiển bảo mật', icon: ShieldAlert, to: '/admin/security-center/dashboard' },
      { label: 'Phiên đăng nhập', icon: RadioTower, to: '/admin/security-center/sessions' },
      { label: 'Lịch sử đăng nhập', icon: History, to: '/admin/security-center/login-history' },
      { label: 'Thiết bị / IP đáng ngờ', icon: Wifi, to: '/admin/security-center/suspicious', badge: 'Theo dõi', badgeTone: 'warning' },
      { label: 'Tài khoản có rủi ro', icon: UserLock, to: '/admin/security-center/risky-accounts' },
      { label: 'Rủi ro token / refresh token', icon: KeyRound, to: '/admin/security-center/token-risk' },
      { label: 'Sự kiện giới hạn tần suất', icon: Gauge, to: '/admin/security-center/rate-limit' },
      { label: 'Truy cập break-glass', icon: Vault, to: '/admin/security-center/break-glass', badge: 'Nghiêm', badgeTone: 'danger' },
      { label: 'Đồng thuận', icon: FileText, to: '/admin/security-center/consent' },
      { label: 'Ủy quyền bệnh nhân', icon: HeartPulse, to: '/admin/security-center/patient-authorization' },
      { label: 'Ủy quyền truy cập', icon: ShieldEllipsis, to: '/admin/security-center/access-authorization' },
      { label: 'Sự kiện truy cập nhạy cảm', icon: ShieldAlert, to: '/admin/security-center/sensitive-access' },
      { label: 'Chính sách truy cập dữ liệu', icon: LockKeyhole, to: '/admin/security-center/data-policy' },
      { label: 'Thu hồi phiên hàng loạt', icon: ShieldBan, to: '/admin/security-center/bulk-revoke' },
    ],
  },
  {
    id: 'audit-compliance',
    title: 'Audit & tuân thủ',
    subtitle: 'Dấu vết và báo cáo tuân thủ',
    icon: FileClock,
    tone: 'slate',
    items: [
      { label: 'Nhật ký audit', icon: FileClock, to: '/admin/audit-compliance/audit-log' },
      { label: 'Audit theo actor', icon: UserRound, to: '/admin/audit-compliance/actor' },
      { label: 'Audit theo người dùng', icon: UsersRound, to: '/admin/audit-compliance/user' },
      { label: 'Audit theo đối tượng', icon: Database, to: '/admin/audit-compliance/object' },
      { label: 'Audit hồ sơ bệnh án', icon: FileText, to: '/admin/audit-compliance/medical-record' },
      { label: 'Audit phân quyền', icon: ShieldCheck, to: '/admin/audit-compliance/iam' },
      { label: 'Audit cấu hình hệ thống', icon: Settings, to: '/admin/audit-compliance/system-config' },
      { label: 'Audit thanh toán', icon: ReceiptText, to: '/admin/audit-compliance/payment' },
      { label: 'Audit truy cập nhạy cảm', icon: ShieldAlert, to: '/admin/audit-compliance/sensitive-access' },
      { label: 'Audit break-glass', icon: Vault, to: '/admin/audit-compliance/break-glass' },
      { label: 'Xuất audit', icon: CloudUpload, to: '/admin/audit-compliance/export' },
      { label: 'Báo cáo tuân thủ', icon: FileText, to: '/admin/audit-compliance/reports' },
    ],
  },
  {
    id: 'operations',
    title: 'Trung tâm vận hành',
    subtitle: 'Tác vụ nền, hàng đợi, thời gian thực, chẩn đoán',
    icon: ServerCog,
    tone: 'orange',
    items: [
      { label: 'Sức khỏe worker', icon: Activity, to: '/admin/operations/worker-health', badge: 'Trực tiếp', badgeTone: 'info' },
      { label: 'Tác vụ / worker', icon: ServerCog, to: '/admin/operations/jobs' },
      { label: 'Nhật ký chạy tác vụ', icon: FileClock, to: '/admin/operations/job-runs' },
      { label: 'Outbox sự kiện', icon: Archive, to: '/admin/operations/event-outbox' },
      { label: 'Sự kiện dead-letter', icon: AlertTriangle, to: '/admin/operations/dead-letter', badge: 'DLQ', badgeTone: 'danger' },
      { label: 'Chạy lại sự kiện', icon: RefreshCw, to: '/admin/operations/retry-event' },
      { label: 'Gửi thông báo', icon: BellRing, to: '/admin/operations/notification-delivery' },
      { label: 'Thông báo lỗi', icon: ShieldAlert, to: '/admin/operations/notification-failed' },
      { label: 'Trạng thái thời gian thực', icon: Wifi, to: '/admin/operations/realtime' },
      { label: 'Hiện diện socket', icon: RadioTower, to: '/admin/operations/socket-presence' },
      { label: 'Bản ghi idempotency', icon: Fingerprint, to: '/admin/operations/idempotency' },
      { label: 'QR tokens', icon: ScanLine, to: '/admin/operations/qr-tokens' },
      { label: 'Trạng thái quét tệp', icon: ScanLine, to: '/admin/operations/file-scans' },
      { label: 'Chẩn đoán hệ thống', icon: HardDrive, to: '/admin/operations/diagnostics' },
      { label: 'Chế độ bảo trì', icon: SlidersHorizontal, to: '/admin/operations/maintenance' },
    ],
  },
  {
    id: 'integrations',
    title: 'Trung tâm tích hợp',
    subtitle: 'Nhà cung cấp, webhook, đối soát',
    icon: Webhook,
    tone: 'pink',
    items: [
      { label: 'Tổng quan tích hợp', icon: Gauge, to: '/admin/integrations', exact: true },
      { label: 'Nhà cung cấp email', icon: Mail, to: '/admin/integrations/email-provider' },
      { label: 'Nhà cung cấp push', icon: Smartphone, to: '/admin/integrations/push-provider' },
      { label: 'Kênh thông báo HTTP', icon: Webhook, to: '/admin/integrations/http-notification-channel' },
      { label: 'Nhà cung cấp Bank QR', icon: Banknote, to: '/admin/integrations/bank-qr-provider' },
      { label: 'MoMo personal QR', icon: Smartphone, to: '/admin/integrations/momo-personal-qr' },
      { label: 'Webhook thanh toán', icon: Link2, to: '/admin/integrations/payment-webhook' },
      { label: 'Sự kiện webhook nhà cung cấp', icon: FileClock, to: '/admin/integrations/provider-webhook-events' },
      { label: 'Giao dịch sao kê ngân hàng', icon: Landmark, to: '/admin/integrations/bank-statement-transactions' },
      { label: 'Nhà cung cấp đối soát', icon: RefreshCw, to: '/admin/integrations/reconciliation-provider' },
      { label: 'Google OAuth', icon: Globe2, to: '/admin/integrations/google-oauth' },
      { label: 'Sức khỏe tích hợp', icon: Activity, to: '/admin/integrations/integration-health', badge: 'OK', badgeTone: 'success' },
      { label: 'Nhật ký tích hợp', icon: FileClock, to: '/admin/integrations/integration-logs' },
    ],
  },
  {
    id: 'patient-portal',
    title: 'Quản trị cổng bệnh nhân',
    subtitle: 'Bệnh nhân, người thân, dữ liệu tự gửi',
    icon: HeartPulse,
    tone: 'rose',
    items: [
      { label: 'Bảng điều khiển cổng bệnh nhân', icon: LayoutDashboard, to: '/admin/patient-portal', exact: true, badge: 'Trực tiếp', badgeTone: 'info' },
      { label: 'Tài khoản bệnh nhân', icon: UserRound, to: '/admin/patient-portal/accounts' },
      { label: 'Người thân bệnh nhân', icon: UsersRound, to: '/admin/patient-portal/relatives' },
      { label: 'Ủy quyền người thân', icon: ShieldCheck, to: '/admin/patient-portal/authorizations' },
      { label: 'Hồ sơ bệnh nhân tự cập nhật', icon: FileText, to: '/admin/patient-portal/profile-field-policies' },
      { label: 'Yêu cầu cập nhật hồ sơ', icon: ClipboardCheck, to: '/admin/patient-portal/profile-change-requests', badge: 'Hàng đợi', badgeTone: 'warning' },
      { label: 'Tài liệu bệnh nhân tải lên', icon: UploadCloud, to: '/admin/patient-portal/documents' },
      { label: 'Yêu cầu xuất hồ sơ', icon: CloudUpload, to: '/admin/patient-portal/document-exports' },
      { label: 'Bảo hiểm bệnh nhân gửi', icon: ReceiptText, to: '/admin/patient-portal/insurance-submissions' },
      { label: 'Cờ tính năng cổng bệnh nhân', icon: Sparkles, to: '/admin/patient-portal/feature-flags' },
      { label: 'Audit cổng bệnh nhân', icon: FileClock, to: '/admin/patient-portal/audit' },
    ],
  },
  {
    id: 'support-communication',
    title: 'Hỗ trợ & truyền thông',
    subtitle: 'Ticket, hội thoại, phát thông báo',
    icon: MessageSquare,
    tone: 'lime',
    items: [
      { label: 'Ticket hỗ trợ', icon: TicketCheck, to: '/admin/support-communication/tickets' },
      { label: 'Ticket quá SLA', icon: AlertTriangle, to: '/admin/support-communication/sla', badge: 'SLA', badgeTone: 'danger' },
      { label: 'Ticket kỹ thuật', icon: ServerCog, to: '/admin/support-communication/technical' },
      { label: 'Ticket liên quan tài khoản', icon: UserRound, to: '/admin/support-communication/account' },
      { label: 'Ticket liên quan thanh toán', icon: ReceiptText, to: '/admin/support-communication/billing' },
      { label: 'Hội thoại nội bộ', icon: MessageSquare, to: '/admin/support-communication/conversations' },
      { label: 'AI Chatbot', icon: Bot, to: '/admin/support-communication/ai-chatbot', badge: 'AI', badgeTone: 'info' },
      { label: 'Tin nhắn hệ thống', icon: BellRing, to: '/admin/support-communication/system-messages' },
      { label: 'Thông báo hệ thống', icon: BellRing, to: '/admin/support-communication/notifications' },
      { label: 'Phát thông báo hàng loạt', icon: RadioTower, to: '/admin/support-communication/broadcast' },
      { label: 'Mẫu thông báo', icon: FileText, to: '/admin/support-communication/notification-templates' },
      { label: 'Mẫu phản hồi hỗ trợ', icon: BookOpen, to: '/admin/support-communication/reply-templates' },
    ],
  },
  {
    id: 'admin-tools',
    title: 'Công cụ quản trị',
    subtitle: 'Toàn vẹn, migration, chẩn đoán',
    icon: FileCog,
    tone: 'steel',
    items: [
      { label: 'Kiểm tra bảo vệ route', icon: Router, to: '/admin/admin-tools/route-guards' },
      { label: 'Kiểm tra toàn vẹn RBAC', icon: ShieldCheck, to: '/admin/admin-tools/rbac-integrity' },
      { label: 'Kiểm tra bản đồ quyền', icon: TableProperties, to: '/admin/admin-tools/permission-map' },
      { label: 'Kiểm tra nhất quán dữ liệu', icon: Database, to: '/admin/admin-tools/data-consistency' },
      { label: 'Đồng bộ chỉ mục', icon: RefreshCw, to: '/admin/admin-tools/indexes', badge: 'Rủi ro', badgeTone: 'danger' },
      { label: 'Đồng bộ quyền hệ thống', icon: KeyRound, to: '/admin/admin-tools/system-access-sync' },
      { label: 'Công cụ migration', icon: GitBranchIcon, to: '/admin/admin-tools/migrations' },
      { label: 'Công cụ dữ liệu demo', icon: Sparkles, to: '/admin/admin-tools/demo-data' },
      { label: 'Công cụ dọn dẹp', icon: Archive, to: '/admin/admin-tools/cleanup' },
      { label: 'Tạo lại cache', icon: RefreshCw, to: '/admin/admin-tools/cache' },
      { label: 'Export hệ thống', icon: CloudUpload, to: '/admin/admin-tools/exports' },
      { label: 'Chẩn đoán cho lập trình viên', icon: HardDrive, to: '/admin/admin-tools/developer-diagnostics' },
    ],
  },
];

function GitBranchIcon(props) {
  return <Network {...props} />;
}

const FOOTER_ITEMS = [
  { label: 'Hồ sơ của tôi', icon: UserRound, to: '/admin/profile' },
  { label: 'Nhật ký audit', icon: FileClock, to: '/admin/logs/audit' },
  { label: 'Cấu hình', icon: Settings, to: '/admin/settings', badge: 'Lõi', badgeTone: 'info' },
];

function getInitials(name) {
  return String(name || 'SA')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('');
}

function splitRoute(to = '') {
  const [pathname, search = ''] = to.split('?');
  return {
    pathname,
    search: search ? `?${search}` : '',
  };
}

function isPathMatch(pathname, candidate) {
  return pathname === candidate || pathname.startsWith(`${candidate}/`);
}

function getRouteMatchScore(location, item) {
  const candidates = item.match || [item.to];

  return candidates.reduce((score, candidate) => {
    const route = splitRoute(candidate);

    if (route.search) {
      return location.pathname === route.pathname && location.search === route.search
        ? Math.max(score, 10000 + route.pathname.length + route.search.length)
        : score;
    }

    if (item.exact) {
      return location.pathname === route.pathname && !location.search
        ? Math.max(score, 8000 + route.pathname.length)
        : score;
    }

    if (location.search && location.pathname === route.pathname) {
      return score;
    }

    if (location.pathname === route.pathname) {
      return Math.max(score, 5000 + route.pathname.length);
    }

    return isPathMatch(location.pathname, route.pathname)
      ? Math.max(score, 1000 + route.pathname.length)
      : score;
  }, 0);
}

function isRouteActive(location, item) {
  return getRouteMatchScore(location, item) > 0;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function resolveActiveTrail(location) {
  let bestMatch = null;

  for (const section of CONTROL_PLANE_SECTIONS) {
    for (const item of section.items) {
      const score = getRouteMatchScore(location, item);

      if (score > (bestMatch?.score || 0)) {
        bestMatch = { section, item, score };
      }
    }
  }

  return bestMatch || {
    section: CONTROL_PLANE_SECTIONS[0],
    item: CONTROL_PLANE_SECTIONS[0].items[0],
  };
}

function Badge({ value, tone = 'default' }) {
  if (!value) return null;

  return <span className={`scp-badge scp-badge--${tone}`}>{value}</span>;
}

function MenuItem({ item, isActive }) {
  const Icon = item.icon;

  return (
    <Link to={item.to} className={`scp-menu-link${isActive ? ' is-active' : ''}`} title={item.label}>
      <span className="scp-menu-link__icon" aria-hidden="true">
        <Icon size={17} strokeWidth={2.25} />
      </span>
      <span className="scp-menu-link__body">
        <span className="scp-menu-link__label">{item.label}</span>
      </span>
      <Badge value={item.badge} tone={item.badgeTone} />
    </Link>
  );
}

function UtilityLink({ item, location }) {
  const Icon = item.icon;
  const isActive = isRouteActive(location, item);

  return (
    <Link to={item.to} className={`scp-utility-link${isActive ? ' is-active' : ''}`} title={item.label}>
      <span className="scp-menu-link__icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2.25} />
      </span>
      <span className="scp-menu-link__label">{item.label}</span>
      <Badge value={item.badge} tone={item.badgeTone} />
    </Link>
  );
}

export function AdminLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openSectionIds, setOpenSectionIds] = useState(() => new Set(['command-center', 'organization', 'iam']));
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth?.user;

  const activeTrail = useMemo(() => resolveActiveTrail(location), [location.pathname, location.search]);

  const visibleSections = useMemo(() => {
    const query = normalizeText(searchTerm);

    if (!query) return CONTROL_PLANE_SECTIONS;

    return CONTROL_PLANE_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        normalizeText(`${section.title} ${section.subtitle} ${item.label}`).includes(query),
      ),
    })).filter((section) => section.items.length > 0);
  }, [searchTerm]);

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  function toggleSection(sectionId) {
    setOpenSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  return (
    <main className={`scp-shell${isSidebarCollapsed ? ' is-collapsed' : ''}`}>
      <aside className="scp-sidebar" aria-label="Bảng điều khiển hệ thống">
        <div className="scp-sidebar__brand">
          <Link to="/admin/command-center" className="scp-brand-mark" aria-label="Bảng điều khiển hệ thống">
            <AppLogo variant="mark" alt="" aria-hidden="true" />
          </Link>
          <div className="scp-brand-copy">
            <span>{APP_BRAND_NAME}</span>
            <strong>{APP_BRAND_SUBTITLE}</strong>
          </div>
          <span className="scp-live-badge">
            <span aria-hidden="true" />
            Trực tiếp
          </span>
        </div>

        <label className="scp-sidebar__search" htmlFor="admin-sidebar-search">
          <Search size={16} strokeWidth={2.2} aria-hidden="true" />
          <input
            id="admin-sidebar-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm module, quyền, audit..."
          />
        </label>

        <div className="scp-sidebar__main">
          <nav className="scp-sidebar__nav" aria-label="Điều hướng quản trị">
            {visibleSections.length > 0 ? (
              visibleSections.map((section) => {
                const SectionIcon = section.icon;
                const isActiveSection = activeTrail.section?.id === section.id;
                const isOpen = Boolean(searchTerm) || openSectionIds.has(section.id) || isActiveSection;

                return (
                  <section
                    key={section.id}
                    className={`scp-section scp-section--${section.tone}${isOpen ? ' is-open' : ''}${isActiveSection ? ' is-current' : ''}`}
                  >
                    <button
                      type="button"
                      className="scp-section__head"
                      aria-expanded={isOpen}
                      onClick={() => toggleSection(section.id)}
                      title={section.title}
                    >
                      <span className="scp-section__icon" aria-hidden="true">
                        <SectionIcon size={17} strokeWidth={2.25} />
                      </span>
                      <span className="scp-section__copy">
                        <strong>{section.title}</strong>
                        <small>{section.subtitle}</small>
                      </span>
                      <span className="scp-section__count">{section.items.length}</span>
                      <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
                    </button>

                    <div className="scp-section__list">
                      {section.items.map((item) => (
                        <MenuItem
                          key={`${section.id}-${item.label}`}
                          item={item}
                          isActive={activeTrail.item === item}
                        />
                      ))}
                    </div>
                  </section>
                );
              })
            ) : (
              <div className="scp-sidebar__empty">
                <Search size={18} strokeWidth={2.25} aria-hidden="true" />
                <span>Không có mục phù hợp</span>
              </div>
            )}
          </nav>
        </div>

        <div className="scp-sidebar__footer">
          <Link to="/admin/command-center/tasks" className="scp-sidebar__alert">
            <AlertTriangle size={17} strokeWidth={2.25} aria-hidden="true" />
            <span>
              <strong>18 việc cần xử lý</strong>
              <small>Ưu tiên hệ thống & bảo mật</small>
            </span>
          </Link>

          <div className="scp-sidebar__utilities">
            {FOOTER_ITEMS.map((item) => (
              <UtilityLink key={item.label} item={item} location={location} />
            ))}
          </div>

          <button type="button" className="scp-sidebar__logout" onClick={handleLogout} title="Đăng xuất">
            <LogOut size={16} strokeWidth={2.35} aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>

          <button
            type="button"
            className="scp-sidebar__collapse"
            aria-pressed={isSidebarCollapsed}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={17} strokeWidth={2.3} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={17} strokeWidth={2.3} aria-hidden="true" />
            )}
            <span>{isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}</span>
            <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <section className="scp-stage">
        <header className="scp-topbar">
          <div className="scp-topbar__context">
            <span className="scp-topbar__eyebrow">{activeTrail.section?.title}</span>
            <strong>{activeTrail.item?.label}</strong>
            <small>{activeTrail.section?.subtitle}</small>
          </div>

          <label className="scp-search" htmlFor="admin-global-search">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <input
              id="admin-global-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm menu, quyền, audit, workspace..."
            />
          </label>

          <div className="scp-topbar__meta">
            <div className="scp-health-strip" aria-label="Tín hiệu vận hành">
              <span className="scp-health-chip scp-health-chip--green">Thời gian thực 99.8%</span>
              <span className="scp-health-chip scp-health-chip--blue">Cache IAM mới</span>
              <span className="scp-health-chip scp-health-chip--amber">Hàng đợi 24</span>
            </div>

            <div className="scp-topbar__actions">
              <Link to="/admin/staff/create" className="scp-command-button">
                <UserPlus size={16} strokeWidth={2.25} aria-hidden="true" />
                <span>Tạo nhân sự</span>
              </Link>
              <Link to="/admin/roles/create" className="scp-icon-button" aria-label="Tạo vai trò">
                <ShieldCheck size={18} strokeWidth={2.25} aria-hidden="true" />
              </Link>
              <Link to="/admin/settings" className="scp-icon-button" aria-label="Cấu hình hệ thống">
                <Settings size={18} strokeWidth={2.25} aria-hidden="true" />
              </Link>
              <button type="button" className="scp-icon-button" aria-label="Thông báo hệ thống">
                <BellRing size={18} strokeWidth={2.25} aria-hidden="true" />
              </button>
              <Link to="/support" className="scp-icon-button" aria-label="Hỗ trợ">
                <HelpCircle size={18} strokeWidth={2.25} aria-hidden="true" />
              </Link>
            </div>

            <div className="scp-topbar__profile">
              <div>
                <strong>{user?.full_name || user?.username || 'Quản trị hệ thống'}</strong>
                <span>QUẢN TRỊ HỆ THỐNG</span>
              </div>
              <div className="scp-topbar__avatar">{getInitials(user?.full_name || user?.username)}</div>
            </div>

            <button type="button" className="scp-topbar__logout" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </header>

        <Outlet />
      </section>
    </main>
  );
}
