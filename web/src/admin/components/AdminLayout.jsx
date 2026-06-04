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
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
      { label: 'Tổng quan hệ thống', icon: Gauge, to: '/admin/overview', exact: true },
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
      { label: 'Tất cả bệnh nhân', icon: UsersRound, to: '/admin/patients', badge: 'Hồ sơ', badgeTone: 'success' },
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
  { label: 'Hàng đợi xử lý', description: 'Mở command queue và các việc ưu tiên', icon: ClipboardCheck, to: '/admin/command-center/tasks', badge: '18', tone: 'warning' },
  { label: 'Hồ sơ của tôi', description: 'Thông tin cá nhân, vai trò, quyền hiệu lực', icon: UserRound, to: '/admin/profile', tone: 'blue' },
  { label: 'Nhật ký audit', description: 'Tra cứu dấu vết thao tác quản trị', icon: FileClock, to: '/admin/logs/audit', tone: 'slate' },
  { label: 'Cấu hình', description: 'Bảo mật, thông báo, file, portal', icon: Settings, to: '/admin/settings', badge: 'Lõi', tone: 'indigo' },
];

const ACCOUNT_PRIMARY_ACTIONS = [
  { label: 'Hồ sơ của tôi', description: 'Xem và cập nhật hồ sơ quản trị viên', icon: UserRound, to: '/admin/profile', tone: 'blue' },
  { label: 'Đổi mật khẩu', description: 'Cập nhật mật khẩu và kiểm tra độ mạnh', icon: KeyRound, to: '/admin/security/change-password', tone: 'indigo' },
  { label: 'Thiết bị & phiên đăng nhập', description: 'Xem phiên hiện tại, thu hồi thiết bị lạ', icon: MonitorCheck, to: '/admin/security/sessions', tone: 'cyan' },
];

const ACCOUNT_OPERATION_ACTIONS = [
  { label: 'Command Center', description: 'Về trung tâm điều phối hệ thống', icon: LayoutDashboard, to: '/admin/command-center', tone: 'blue' },
  { label: 'IAM & phân quyền', description: 'Quản lý vai trò, quyền và policy', icon: ShieldCheck, to: '/admin/iam/overview', tone: 'indigo' },
  { label: 'Lịch sử đăng nhập', description: 'Dòng thời gian đăng nhập của tài khoản', icon: History, to: '/admin/logs/login-history', tone: 'amber' },
  { label: 'Nhật ký audit', description: 'Kiểm tra hoạt động quản trị gần đây', icon: FileClock, to: '/admin/logs/audit', tone: 'slate' },
  { label: 'Cấu hình tài khoản', description: 'Thiết lập bảo mật và tuỳ chọn quản trị', icon: Settings, to: '/admin/settings?tab=security', tone: 'violet' },
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

function AccountActionLink({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link to={item.to} className={`scp-account-action scp-account-action--${item.tone || 'blue'}`} role="menuitem" onClick={onNavigate}>
      <span className="scp-account-action__icon" aria-hidden="true">
        <Icon size={17} strokeWidth={2.35} />
      </span>
      <span className="scp-account-action__body">
        <strong>{item.label}</strong>
        <small>{item.description}</small>
      </span>
      <ChevronRight size={16} strokeWidth={2.35} aria-hidden="true" />
    </Link>
  );
}

function SidebarDockLink({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link to={item.to} className={`scp-dock-action scp-dock-action--${item.tone || 'blue'}`} onClick={onNavigate}>
      <span className="scp-dock-action__icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2.35} />
      </span>
      <span className="scp-dock-action__body">
        <strong>{item.label}</strong>
        <small>{item.description}</small>
      </span>
      {item.badge ? <b>{item.badge}</b> : <ChevronRight size={15} strokeWidth={2.35} aria-hidden="true" />}
    </Link>
  );
}


const ADMIN_LAYOUT_STABILITY_CSS = `
/* AdminLayout hard guard: keeps sidebar/topbar stable across IAM, Settings, Config and all admin pages. */
.scp-shell {
  --scp-sidebar-width: 306px;
  --scp-sidebar-collapsed-width: 78px;
  display: flex !important;
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100vh !important;
  min-height: 100vh !important;
  overflow: hidden !important;
  background: #f4f8fc;
}
.scp-sidebar {
  flex: 0 0 var(--scp-sidebar-width) !important;
  width: var(--scp-sidebar-width) !important;
  min-width: var(--scp-sidebar-width) !important;
  max-width: var(--scp-sidebar-width) !important;
  height: 100vh !important;
  max-height: 100vh !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
.scp-shell.is-collapsed .scp-sidebar {
  flex-basis: var(--scp-sidebar-collapsed-width) !important;
  width: var(--scp-sidebar-collapsed-width) !important;
  min-width: var(--scp-sidebar-collapsed-width) !important;
  max-width: var(--scp-sidebar-collapsed-width) !important;
}
.scp-stage {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  width: auto !important;
  max-width: none !important;
  height: 100vh !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  position: relative !important;
}
.scp-stage > * {
  flex: 0 0 auto;
}
.scp-sidebar__brand,
.scp-sidebar__search {
  flex: 0 0 auto !important;
}
.scp-sidebar__main {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding-right: 4px !important;
  overscroll-behavior: contain !important;
}
.scp-sidebar__main::-webkit-scrollbar { width: 6px !important; }
.scp-sidebar__main::-webkit-scrollbar-thumb {
  background: rgba(37, 99, 235, .2) !important;
  border-radius: 999px !important;
}
.scp-sidebar__footer {
  position: relative !important;
  flex: 0 0 auto !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  padding: 8px 0 0 !important;
  margin: 6px 0 0 !important;
  border-top: 1px solid rgba(148, 163, 184, .18) !important;
  background: linear-gradient(180deg, rgba(248,250,252,.74), rgba(255,255,255,.98)) !important;
  overflow: visible !important;
  z-index: 50 !important;
}
.scp-sidebar__alert,
.scp-sidebar__utilities,
.scp-sidebar__logout {
  display: none !important;
}
.scp-sidebar__dock-trigger {
  appearance: none !important;
  width: 100% !important;
  min-width: 0 !important;
  height: 42px !important;
  min-height: 42px !important;
  border: 1px solid rgba(245, 158, 11, .3) !important;
  border-radius: 15px !important;
  background: linear-gradient(135deg, #fffbeb, #fff7ed) !important;
  color: #92400e !important;
  display: grid !important;
  grid-template-columns: 28px minmax(0, 1fr) 18px !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 6px 9px !important;
  text-align: left !important;
  cursor: pointer !important;
  box-shadow: 0 10px 24px rgba(245, 158, 11, .1) !important;
  overflow: hidden !important;
}
.scp-sidebar__dock-trigger > svg:first-child {
  width: 28px !important;
  height: 28px !important;
  padding: 6px !important;
  border-radius: 11px !important;
  background: rgba(245, 158, 11, .13) !important;
  color: #b45309 !important;
}
.scp-sidebar__dock-trigger span {
  min-width: 0 !important;
  overflow: hidden !important;
}
.scp-sidebar__dock-trigger strong {
  display: block !important;
  max-width: 100% !important;
  font-size: 12.5px !important;
  line-height: 1.1 !important;
  font-weight: 950 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.scp-sidebar__dock-trigger small { display: none !important; }
.scp-sidebar__footer.is-open .scp-sidebar__dock-trigger > svg:last-child {
  transform: rotate(180deg) !important;
}
.scp-sidebar__dock-menu {
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  bottom: calc(100% + 10px) !important;
  z-index: 2000 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
  max-height: min(58vh, 430px) !important;
  overflow-y: auto !important;
  padding: 10px !important;
  border: 1px solid rgba(148, 163, 184, .24) !important;
  border-radius: 20px !important;
  background: rgba(255, 255, 255, .98) !important;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .2) !important;
  backdrop-filter: blur(18px) !important;
}
.scp-sidebar__dock-menu a,
.scp-sidebar__dock-menu button {
  appearance: none !important;
  width: 100% !important;
  min-height: 38px !important;
  border: 0 !important;
  border-radius: 14px !important;
  background: transparent !important;
  color: #334155 !important;
  display: grid !important;
  grid-template-columns: 22px minmax(0, 1fr) auto !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 9px 10px !important;
  font-weight: 850 !important;
  font-size: 13px !important;
  text-decoration: none !important;
  text-align: left !important;
  cursor: pointer !important;
}
.scp-sidebar__dock-menu a:hover,
.scp-sidebar__dock-menu button:hover {
  background: #eef4ff !important;
  color: #1d4ed8 !important;
}
.scp-sidebar__dock-menu span {
  min-width: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.scp-sidebar__dock-menu b {
  padding: 3px 7px !important;
  border-radius: 999px !important;
  background: #eff6ff !important;
  color: #2563eb !important;
  font-size: 11px !important;
}
.scp-sidebar__collapse {
  width: 100% !important;
  height: 38px !important;
  min-height: 38px !important;
  max-height: 38px !important;
  border-radius: 15px !important;
  margin: 0 !important;
}
.scp-shell.is-collapsed .scp-sidebar__dock-trigger {
  grid-template-columns: 1fr !important;
  justify-items: center !important;
  padding: 6px !important;
}
.scp-shell.is-collapsed .scp-sidebar__dock-trigger span,
.scp-shell.is-collapsed .scp-sidebar__dock-trigger > svg:last-child,
.scp-shell.is-collapsed .scp-sidebar__dock-menu,
.scp-shell.is-collapsed .scp-sidebar__collapse span,
.scp-shell.is-collapsed .scp-sidebar__collapse > svg:last-child {
  display: none !important;
}
.scp-topbar {
  position: sticky !important;
  top: 0 !important;
  z-index: 500 !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 10px clamp(12px, 1.2vw, 20px) !important;
  overflow: visible !important;
  isolation: isolate !important;
}
.scp-topbar__context {
  flex: 0 1 214px !important;
  min-width: 148px !important;
  max-width: 214px !important;
  overflow: hidden !important;
}
.scp-topbar__context strong,
.scp-topbar__context small,
.scp-topbar__eyebrow {
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.scp-search {
  flex: 1 1 260px !important;
  min-width: 180px !important;
  max-width: 430px !important;
  width: auto !important;
}
.scp-topbar__meta {
  flex: 0 0 auto !important;
  min-width: 0 !important;
  max-width: none !important;
  margin-left: auto !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  overflow: visible !important;
  white-space: nowrap !important;
}
.scp-health-strip { display: none !important; }
.scp-topbar__actions {
  flex: 0 0 auto !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  overflow: visible !important;
}
.scp-command-button {
  flex: 0 0 auto !important;
  width: auto !important;
  min-width: 142px !important;
  max-width: 154px !important;
  height: 46px !important;
  padding-inline: 13px !important;
  justify-content: center !important;
  white-space: nowrap !important;
  overflow: hidden !important;
}
.scp-command-button span {
  min-width: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.scp-icon-button {
  flex: 0 0 44px !important;
  width: 44px !important;
  min-width: 44px !important;
  max-width: 44px !important;
  height: 44px !important;
  min-height: 44px !important;
  position: relative !important;
  z-index: 2 !important;
}
.scp-topbar__account {
  flex: 0 0 auto !important;
  display: block !important;
  position: relative !important;
  z-index: 800 !important;
  min-width: 0 !important;
  overflow: visible !important;
}
.scp-topbar__profile {
  appearance: none !important;
  display: flex !important;
  align-items: center !important;
  gap: 9px !important;
  width: 186px !important;
  min-width: 186px !important;
  max-width: 186px !important;
  height: 46px !important;
  padding: 5px 7px 5px 11px !important;
  border-radius: 18px !important;
  border: 1px solid rgba(148, 163, 184, .24) !important;
  background: rgba(255,255,255,.92) !important;
  box-shadow: 0 10px 24px rgba(15,23,42,.08) !important;
  overflow: hidden !important;
  text-align: left !important;
  cursor: pointer !important;
}
.scp-topbar__profile > div:first-child {
  display: block !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
  overflow: hidden !important;
}
.scp-topbar__profile strong,
.scp-topbar__profile span {
  display: block !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.scp-topbar__profile > svg {
  display: block !important;
  flex: 0 0 auto !important;
}
.scp-topbar__avatar {
  flex: 0 0 36px !important;
  width: 36px !important;
  height: 36px !important;
}
.scp-account-menu {
  position: fixed !important;
  top: 82px !important;
  right: clamp(12px, 2vw, 30px) !important;
  width: min(430px, calc(100vw - 24px)) !important;
  max-height: calc(100vh - 104px) !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  z-index: 4000 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  padding: 14px !important;
  border: 1px solid rgba(148, 163, 184, .24) !important;
  border-radius: 24px !important;
  background: rgba(255, 255, 255, .98) !important;
  box-shadow: 0 28px 80px rgba(15, 23, 42, .22) !important;
  backdrop-filter: blur(20px) !important;
  color: #0f172a !important;
  white-space: normal !important;
  text-align: left !important;
}
.scp-account-menu,
.scp-account-menu * {
  box-sizing: border-box !important;
}
.scp-account-menu::before {
  content: '' !important;
  position: fixed !important;
  top: 75px !important;
  right: clamp(46px, 4vw, 74px) !important;
  width: 14px !important;
  height: 14px !important;
  transform: rotate(45deg) !important;
  border-left: 1px solid rgba(148, 163, 184, .24) !important;
  border-top: 1px solid rgba(148, 163, 184, .24) !important;
  background: rgba(255, 255, 255, .98) !important;
}
.scp-account-menu__head {
  position: relative !important;
  z-index: 1 !important;
  display: grid !important;
  grid-template-columns: 46px minmax(0, 1fr) 34px !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 10px !important;
  border-radius: 18px !important;
  background: linear-gradient(135deg, #f8fbff, #eef6ff) !important;
  border: 1px solid rgba(219, 234, 254, .9) !important;
}
.scp-account-menu__head .scp-topbar__avatar {
  width: 44px !important;
  height: 44px !important;
  flex-basis: 44px !important;
  border-radius: 15px !important;
}
.scp-account-menu__head strong,
.scp-account-menu__head span {
  display: block !important;
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.scp-account-menu__head strong {
  font-size: 14px !important;
  font-weight: 950 !important;
  color: #0f172a !important;
  line-height: 1.2 !important;
}
.scp-account-menu__head span {
  margin-top: 3px !important;
  font-size: 12.5px !important;
  font-weight: 750 !important;
  color: #64748b !important;
}
.scp-account-menu__close {
  appearance: none !important;
  width: 34px !important;
  height: 34px !important;
  border: 1px solid #dbe3ef !important;
  border-radius: 13px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: rgba(255, 255, 255, .96) !important;
  color: #64748b !important;
  cursor: pointer !important;
}
.scp-account-menu__close:hover {
  background: #eff6ff !important;
  border-color: rgba(37, 99, 235, .22) !important;
  color: #2563eb !important;
}
.scp-account-menu__close svg {
  width: 16px !important;
  height: 16px !important;
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: currentColor !important;
}
.scp-account-menu__meta {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 8px !important;
}
.scp-account-menu__meta span {
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
  padding: 9px 10px !important;
  border-radius: 15px !important;
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  color: #334155 !important;
  font-size: 12px !important;
  font-weight: 850 !important;
  line-height: 1.15 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.scp-account-menu__meta b {
  color: #64748b !important;
  font-size: 10.5px !important;
  font-weight: 900 !important;
  text-transform: uppercase !important;
  letter-spacing: .04em !important;
}
.scp-account-menu__section,
.scp-account-menu__danger {
  display: flex !important;
  flex-direction: column !important;
  gap: 5px !important;
  padding-top: 10px !important;
  border-top: 1px solid #eef2f7 !important;
}
.scp-account-menu__section small {
  display: block !important;
  margin: 0 0 4px !important;
  padding: 0 5px !important;
  color: #94a3b8 !important;
  font-size: 11px !important;
  font-weight: 950 !important;
  text-transform: uppercase !important;
  letter-spacing: .08em !important;
  white-space: nowrap !important;
}
.scp-account-menu__section a,
.scp-account-menu__danger button {
  appearance: none !important;
  width: 100% !important;
  min-height: 42px !important;
  display: grid !important;
  grid-template-columns: 26px minmax(0, 1fr) !important;
  align-items: center !important;
  gap: 9px !important;
  padding: 10px 11px !important;
  border: 0 !important;
  border-radius: 15px !important;
  background: transparent !important;
  color: #334155 !important;
  text-decoration: none !important;
  text-align: left !important;
  font-size: 13.5px !important;
  font-weight: 900 !important;
  line-height: 1.2 !important;
  cursor: pointer !important;
  white-space: normal !important;
}
.scp-account-menu__section a svg,
.scp-account-menu__danger button svg {
  width: 26px !important;
  height: 26px !important;
  padding: 5px !important;
  border-radius: 10px !important;
  background: #eef4ff !important;
  color: #2563eb !important;
}
.scp-account-menu__section a span,
.scp-account-menu__danger button span {
  min-width: 0 !important;
  display: block !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.scp-account-menu__section a:hover {
  background: #eef4ff !important;
  color: #1d4ed8 !important;
}
.scp-account-menu__danger button {
  color: #b91c1c !important;
  background: #fff5f5 !important;
}
.scp-account-menu__danger button svg {
  background: #fee2e2 !important;
  color: #dc2626 !important;
}
.scp-account-menu__danger button:hover {
  background: #fee2e2 !important;
  color: #991b1b !important;
}

.scp-dock-menu__head {
  display: grid !important;
  grid-template-columns: 36px minmax(0, 1fr) !important;
  gap: 10px !important;
  align-items: center !important;
  padding: 8px 8px 10px !important;
  border-bottom: 1px solid #eef2f7 !important;
}
.scp-dock-menu__mark {
  width: 36px !important;
  height: 36px !important;
  border-radius: 14px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: linear-gradient(135deg, #2563eb, #06b6d4) !important;
  color: #fff !important;
  box-shadow: 0 12px 28px rgba(37,99,235,.24) !important;
}
.scp-dock-menu__head strong {
  display: block !important;
  color: #0f172a !important;
  font-size: 13.5px !important;
  font-weight: 950 !important;
  line-height: 1.15 !important;
}
.scp-dock-menu__head small {
  display: block !important;
  margin-top: 3px !important;
  color: #64748b !important;
  font-size: 11.5px !important;
  font-weight: 750 !important;
  line-height: 1.35 !important;
}
.scp-dock-menu__grid {
  display: flex !important;
  flex-direction: column !important;
  gap: 7px !important;
}
.scp-dock-action {
  appearance: none !important;
  width: 100% !important;
  min-height: 58px !important;
  border: 1px solid transparent !important;
  border-radius: 16px !important;
  display: grid !important;
  grid-template-columns: 36px minmax(0, 1fr) auto !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 9px 10px !important;
  background: #f8fafc !important;
  color: #0f172a !important;
  text-decoration: none !important;
  text-align: left !important;
  cursor: pointer !important;
  transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease !important;
}
.scp-dock-action:hover {
  transform: translateY(-1px) !important;
  border-color: rgba(37,99,235,.22) !important;
  background: #eef4ff !important;
  box-shadow: 0 12px 28px rgba(15,23,42,.1) !important;
}
.scp-dock-action__icon,
.scp-account-action__icon {
  width: 36px !important;
  height: 36px !important;
  border-radius: 13px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: #eef4ff !important;
  color: #2563eb !important;
}
.scp-dock-action__body,
.scp-account-action__body {
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 3px !important;
}
.scp-dock-action__body strong,
.scp-account-action__body strong {
  display: block !important;
  color: #0f172a !important;
  font-size: 13.5px !important;
  font-weight: 950 !important;
  line-height: 1.16 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.scp-dock-action__body small,
.scp-account-action__body small {
  display: block !important;
  color: #64748b !important;
  font-size: 11.5px !important;
  font-weight: 750 !important;
  line-height: 1.25 !important;
  white-space: normal !important;
  overflow: hidden !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
}
.scp-dock-action b {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 26px !important;
  height: 26px !important;
  padding: 0 7px !important;
  border-radius: 999px !important;
  background: #dbeafe !important;
  color: #1d4ed8 !important;
  font-size: 12px !important;
  font-weight: 950 !important;
}
.scp-dock-action--warning .scp-dock-action__icon { background: #fef3c7 !important; color: #b45309 !important; }
.scp-dock-action--indigo .scp-dock-action__icon { background: #e0e7ff !important; color: #4338ca !important; }
.scp-dock-action--slate .scp-dock-action__icon { background: #e2e8f0 !important; color: #334155 !important; }
.scp-dock-action--danger { background: #fff5f5 !important; color: #991b1b !important; border-color: rgba(239,68,68,.16) !important; }
.scp-dock-action--danger .scp-dock-action__icon { background: #fee2e2 !important; color: #dc2626 !important; }
.scp-dock-action--danger:hover { background: #fee2e2 !important; border-color: rgba(220,38,38,.28) !important; }
.scp-account-action {
  appearance: none !important;
  width: 100% !important;
  min-height: 62px !important;
  display: grid !important;
  grid-template-columns: 38px minmax(0, 1fr) 18px !important;
  align-items: center !important;
  gap: 11px !important;
  padding: 10px 11px !important;
  border: 1px solid transparent !important;
  border-radius: 17px !important;
  background: #f8fafc !important;
  color: #0f172a !important;
  text-decoration: none !important;
  text-align: left !important;
  cursor: pointer !important;
  transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease !important;
}
.scp-account-action:hover {
  transform: translateY(-1px) !important;
  border-color: rgba(37,99,235,.22) !important;
  background: #eef4ff !important;
  box-shadow: 0 14px 30px rgba(15,23,42,.1) !important;
}
.scp-account-action--cyan .scp-account-action__icon { background: #cffafe !important; color: #0891b2 !important; }
.scp-account-action--indigo .scp-account-action__icon { background: #e0e7ff !important; color: #4338ca !important; }
.scp-account-action--amber .scp-account-action__icon { background: #fef3c7 !important; color: #b45309 !important; }
.scp-account-action--slate .scp-account-action__icon { background: #e2e8f0 !important; color: #334155 !important; }
.scp-account-action--violet .scp-account-action__icon { background: #ede9fe !important; color: #7c3aed !important; }
.scp-account-action--danger {
  background: #fff5f5 !important;
  border-color: rgba(239,68,68,.18) !important;
  color: #991b1b !important;
}
.scp-account-action--danger .scp-account-action__icon { background: #fee2e2 !important; color: #dc2626 !important; }
.scp-account-action--danger:hover { background: #fee2e2 !important; border-color: rgba(220,38,38,.3) !important; }
.scp-account-menu__section a.scp-account-action,
.scp-account-menu__danger button.scp-account-action {
  display: grid !important;
  grid-template-columns: 38px minmax(0, 1fr) 18px !important;
  min-height: 62px !important;
  padding: 10px 11px !important;
  white-space: normal !important;
}
.scp-account-menu__section a.scp-account-action svg,
.scp-account-menu__danger button.scp-account-action svg {
  width: 17px !important;
  height: 17px !important;
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: currentColor !important;
}
.scp-account-menu__section a.scp-account-action > svg,
.scp-account-menu__danger button.scp-account-action > svg {
  color: #94a3b8 !important;
}
.scp-account-menu__section a.scp-account-action span,
.scp-account-menu__danger button.scp-account-action span {
  overflow: visible !important;
  text-overflow: clip !important;
  white-space: normal !important;
}
.scp-account-menu__danger {
  gap: 8px !important;
}

.scp-account-menu__section a.scp-account-action,
.scp-account-menu__danger button.scp-account-action {
  grid-template-columns: 42px minmax(0, 1fr) 18px !important;
  gap: 12px !important;
  align-items: center !important;
  min-height: 64px !important;
}
.scp-account-menu__section a.scp-account-action .scp-account-action__icon,
.scp-account-menu__danger button.scp-account-action .scp-account-action__icon {
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  border-radius: 15px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}
.scp-account-menu__section a.scp-account-action .scp-account-action__icon svg,
.scp-account-menu__danger button.scp-account-action .scp-account-action__icon svg {
  width: 18px !important;
  height: 18px !important;
  min-width: 18px !important;
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: currentColor !important;
}
.scp-account-menu__section a.scp-account-action > svg,
.scp-account-menu__danger button.scp-account-action > svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #94a3b8 !important;
  justify-self: end !important;
}
.scp-account-menu__section a.scp-account-action:hover > svg,
.scp-account-menu__danger button.scp-account-action:hover > svg {
  color: #2563eb !important;
}
.scp-account-menu__danger button.scp-account-action:hover > svg {
  color: #dc2626 !important;
}
.scp-account-menu__section a.scp-account-action .scp-account-action__body,
.scp-account-menu__danger button.scp-account-action .scp-account-action__body {
  min-width: 0 !important;
  overflow: hidden !important;
}
.scp-account-menu__section a.scp-account-action .scp-account-action__body strong,
.scp-account-menu__danger button.scp-account-action .scp-account-action__body strong {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.scp-account-menu__section a.scp-account-action .scp-account-action__body small,
.scp-account-menu__danger button.scp-account-action .scp-account-action__body small {
  overflow: hidden !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
}

.scp-logout-modal {
  position: fixed !important;
  inset: 0 !important;
  z-index: 6000 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 24px !important;
  background: rgba(15, 23, 42, .34) !important;
  backdrop-filter: blur(10px) !important;
}
.scp-logout-modal__panel {
  width: min(460px, 100%) !important;
  border-radius: 26px !important;
  border: 1px solid rgba(148,163,184,.26) !important;
  background: rgba(255,255,255,.98) !important;
  box-shadow: 0 30px 90px rgba(15,23,42,.28) !important;
  padding: 20px !important;
  display: grid !important;
  grid-template-columns: 52px minmax(0, 1fr) !important;
  gap: 14px !important;
}
.scp-logout-modal__icon {
  width: 52px !important;
  height: 52px !important;
  border-radius: 18px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: #fee2e2 !important;
  color: #dc2626 !important;
}
.scp-logout-modal__copy strong {
  display: block !important;
  color: #0f172a !important;
  font-size: 18px !important;
  font-weight: 950 !important;
  line-height: 1.2 !important;
}
.scp-logout-modal__copy span {
  display: block !important;
  margin-top: 6px !important;
  color: #64748b !important;
  font-size: 13px !important;
  font-weight: 750 !important;
  line-height: 1.45 !important;
}
.scp-logout-modal__actions {
  grid-column: 1 / -1 !important;
  display: flex !important;
  justify-content: flex-end !important;
  gap: 10px !important;
  padding-top: 8px !important;
}
.scp-logout-modal__actions button {
  min-height: 42px !important;
  border-radius: 14px !important;
  border: 1px solid #dbe3ef !important;
  background: #fff !important;
  color: #334155 !important;
  padding: 0 16px !important;
  font-weight: 900 !important;
  cursor: pointer !important;
}
.scp-logout-modal__actions button:hover { background: #f8fafc !important; }
.scp-logout-modal__actions button.is-danger {
  border-color: transparent !important;
  background: linear-gradient(135deg, #ef4444, #dc2626) !important;
  color: #fff !important;
  box-shadow: 0 14px 30px rgba(220,38,38,.22) !important;
}

@media (max-width: 1600px) {
  .scp-topbar__context { flex-basis: 196px !important; min-width: 130px !important; max-width: 196px !important; }
  .scp-search { flex-basis: 220px !important; min-width: 150px !important; max-width: 360px !important; }
  .scp-topbar__actions .scp-icon-button:nth-of-type(n+3) { display: none !important; }
}
@media (max-width: 1380px) {
  .scp-topbar__context { flex-basis: 170px !important; min-width: 112px !important; max-width: 170px !important; }
  .scp-search { flex-basis: 180px !important; min-width: 130px !important; max-width: 300px !important; }
  .scp-command-button { min-width: 46px !important; width: 46px !important; max-width: 46px !important; padding-inline: 0 !important; }
  .scp-command-button span { display: none !important; }
  .scp-topbar__actions .scp-icon-button:nth-of-type(n+2) { display: none !important; }
  .scp-topbar__profile { width: 160px !important; min-width: 160px !important; max-width: 160px !important; }
}
@media (max-width: 1120px) {
  .scp-topbar { flex-wrap: wrap !important; }
  .scp-search { order: 3 !important; flex: 1 0 100% !important; max-width: none !important; }
  .scp-topbar__meta { margin-left: auto !important; }
}
@media (max-width: 760px) {
  .scp-topbar__profile { width: 46px !important; min-width: 46px !important; max-width: 46px !important; padding: 5px !important; justify-content: center !important; }
  .scp-topbar__profile > div:first-child,
  .scp-topbar__profile > svg { display: none !important; }
  .scp-topbar__actions .scp-icon-button:nth-of-type(n+2) { display: none !important; }
  .scp-account-menu { top: 76px !important; right: 8px !important; width: calc(100vw - 16px) !important; max-height: calc(100vh - 92px) !important; }
}
`;

export function AdminLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [openSectionIds, setOpenSectionIds] = useState(() => new Set(['command-center', 'organization', 'iam']));
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSidebarDockOpen, setIsSidebarDockOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const sidebarDockRef = useRef(null);
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth?.user;

  const activeTrail = useMemo(() => resolveActiveTrail(location), [location.pathname, location.search]);

  const visibleSections = useMemo(() => {
    const query = normalizeText(sidebarSearchTerm);

    if (!query) return CONTROL_PLANE_SECTIONS;

    return CONTROL_PLANE_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        normalizeText(`${section.title} ${section.subtitle} ${item.label}`).includes(query),
      ),
    })).filter((section) => section.items.length > 0);
  }, [sidebarSearchTerm]);

  function handleLogout() {
    setIsProfileMenuOpen(false);
    setIsSidebarDockOpen(false);
    setIsLogoutConfirmOpen(true);
  }

  function confirmLogout() {
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

  useEffect(() => {
    setIsProfileMenuOpen(false);
    setIsSidebarDockOpen(false);
    setGlobalSearchTerm('');
  }, [location.pathname, location.search]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
        setIsSidebarDockOpen(false);
        setIsLogoutConfirmOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;

      if (isProfileMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }

      if (isSidebarDockOpen && sidebarDockRef.current && !sidebarDockRef.current.contains(target)) {
        setIsSidebarDockOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isProfileMenuOpen, isSidebarDockOpen]);

  return (
    <main className={`scp-shell${isSidebarCollapsed ? ' is-collapsed' : ''}`}>
      <style>{ADMIN_LAYOUT_STABILITY_CSS}</style>
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
            value={sidebarSearchTerm}
            onChange={(event) => setSidebarSearchTerm(event.target.value)}
            placeholder="Tìm module, quyền, audit..."
          />
        </label>

        <div className="scp-sidebar__main">
          <nav className="scp-sidebar__nav" aria-label="Điều hướng quản trị">
            {visibleSections.length > 0 ? (
              visibleSections.map((section) => {
                const SectionIcon = section.icon;
                const isActiveSection = activeTrail.section?.id === section.id;
                const isOpen = Boolean(sidebarSearchTerm) || openSectionIds.has(section.id) || isActiveSection;

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

        <div ref={sidebarDockRef} className={`scp-sidebar__footer${isSidebarDockOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="scp-sidebar__dock-trigger"
            aria-expanded={isSidebarDockOpen}
            onClick={() => setIsSidebarDockOpen((current) => !current)}
            title="Mở trung tâm xử lý nhanh"
          >
            <AlertTriangle size={17} strokeWidth={2.25} aria-hidden="true" />
            <span>
              <strong>Tác vụ nhanh · 18</strong>
              <small>Mở hàng đợi xử lý</small>
            </span>
            <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
          </button>

          {isSidebarDockOpen ? (
            <div className="scp-sidebar__dock-menu" aria-label="Tác vụ nhanh quản trị">
              <div className="scp-dock-menu__head">
                <span className="scp-dock-menu__mark"><Command size={16} strokeWidth={2.35} /></span>
                <div>
                  <strong>Trung tâm tác vụ nhanh</strong>
                  <small>Điều hướng nhanh đến các màn hình xử lý thường dùng</small>
                </div>
              </div>

              <div className="scp-dock-menu__grid">
                {FOOTER_ITEMS.map((item) => (
                  <SidebarDockLink
                    key={item.label}
                    item={item}
                    onNavigate={() => setIsSidebarDockOpen(false)}
                  />
                ))}
              </div>

              <button type="button" className="scp-dock-action scp-dock-action--danger" onClick={handleLogout}>
                <span className="scp-dock-action__icon" aria-hidden="true">
                  <LogOut size={16} strokeWidth={2.35} />
                </span>
                <span className="scp-dock-action__body">
                  <strong>Đăng xuất an toàn</strong>
                  <small>Đóng phiên hiện tại và quay về đăng nhập</small>
                </span>
                <ChevronRight size={15} strokeWidth={2.35} aria-hidden="true" />
              </button>
            </div>
          ) : null}

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
              value={globalSearchTerm}
              onChange={(event) => setGlobalSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setGlobalSearchTerm('');
              }}
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

            <div ref={accountMenuRef} className={`scp-topbar__account${isProfileMenuOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="scp-topbar__profile"
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                onClick={() => setIsProfileMenuOpen((current) => !current)}
              >
                <div>
                  <strong>{user?.full_name || user?.username || 'Quản trị hệ thống'}</strong>
                  <span>{user?.username || 'SUPERADMIN'} · Admin</span>
                </div>
                <div className="scp-topbar__avatar">{getInitials(user?.full_name || user?.username)}</div>
                <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
              </button>

              {isProfileMenuOpen ? (
                <div className="scp-account-menu" role="menu">
                  <div className="scp-account-menu__head">
                    <div className="scp-topbar__avatar">{getInitials(user?.full_name || user?.username)}</div>
                    <div>
                      <strong>{user?.full_name || user?.username || 'Quản trị hệ thống'}</strong>
                      <span>{user?.email || 'system-admin@healthcare.local'}</span>
                    </div>
                    <button
                      type="button"
                      className="scp-account-menu__close"
                      aria-label="Đóng menu tài khoản"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <X size={16} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="scp-account-menu__meta" aria-label="Trạng thái phiên">
                    <span><b>Vai trò</b> Super Admin</span>
                    <span><b>Workspace</b> System Control</span>
                    <span><b>Phiên</b> Realtime</span>
                  </div>

                  <div className="scp-account-menu__section">
                    <small>Tài khoản cá nhân</small>
                    {ACCOUNT_PRIMARY_ACTIONS.map((item) => (
                      <AccountActionLink
                        key={item.label}
                        item={item}
                        onNavigate={() => { setIsProfileMenuOpen(false); setGlobalSearchTerm(''); }}
                      />
                    ))}
                  </div>

                  <div className="scp-account-menu__section">
                    <small>Điều hành nhanh</small>
                    {ACCOUNT_OPERATION_ACTIONS.map((item) => (
                      <AccountActionLink
                        key={item.label}
                        item={item}
                        onNavigate={() => { setIsProfileMenuOpen(false); setGlobalSearchTerm(''); }}
                      />
                    ))}
                  </div>

                  <div className="scp-account-menu__danger">
                    <button type="button" role="menuitem" className="scp-account-action scp-account-action--danger" onClick={handleLogout}>
                      <span className="scp-account-action__icon" aria-hidden="true">
                        <LogOut size={17} strokeWidth={2.35} />
                      </span>
                      <span className="scp-account-action__body">
                        <strong>Đăng xuất an toàn</strong>
                        <small>Đóng phiên trên trình duyệt này và quay lại màn đăng nhập</small>
                      </span>
                      <ChevronRight size={16} strokeWidth={2.35} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {isLogoutConfirmOpen ? (
          <div className="scp-logout-modal" role="dialog" aria-modal="true" aria-label="Xác nhận đăng xuất">
            <div className="scp-logout-modal__panel">
              <span className="scp-logout-modal__icon"><LogOut size={22} strokeWidth={2.35} /></span>
              <div className="scp-logout-modal__copy">
                <strong>Đăng xuất khỏi Control Plane?</strong>
                <span>Hệ thống sẽ đóng phiên quản trị hiện tại. Các thao tác chưa lưu trên form sẽ không được gửi.</span>
              </div>
              <div className="scp-logout-modal__actions">
                <button type="button" onClick={() => setIsLogoutConfirmOpen(false)}>Ở lại</button>
                <button type="button" className="is-danger" onClick={confirmLogout}>Đăng xuất</button>
              </div>
            </div>
          </div>
        ) : null}

        <Outlet />
      </section>
    </main>
  );
}
