import {
  Activity,
  AlertTriangle,
  Archive,
  Banknote,
  BarChart3,
  BellRing,
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
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';

const panelRoute = (panel) => `/admin/overview?panel=${panel}`;
const settingsRoute = (tab) => `/admin/settings?tab=${tab}`;
const auditRoute = (scope) => `/admin/logs/audit?scope=${scope}`;

const CONTROL_PLANE_SECTIONS = [
  {
    id: 'command-center',
    title: 'Command Center',
    subtitle: 'Điều phối thời gian thực',
    icon: Command,
    tone: 'cyan',
    items: [
      { label: 'Dashboard quản trị', icon: LayoutDashboard, to: '/admin/command-center', exact: true },
      { label: 'Sức khỏe hệ thống', icon: Activity, to: '/admin/command-center/health', badge: 'OK', badgeTone: 'success' },
      { label: 'Việc cần xử lý', icon: ClipboardCheck, to: '/admin/command-center/tasks', badge: 'Live', badgeTone: 'warning' },
      { label: 'Cảnh báo hệ thống', icon: AlertTriangle, to: '/admin/command-center/system-alerts', badge: 'Ops', badgeTone: 'danger' },
      { label: 'Cảnh báo bảo mật', icon: ShieldAlert, to: '/admin/command-center/security-alerts', badge: 'Risk', badgeTone: 'danger' },
      { label: 'Hoạt động gần đây', icon: History, to: '/admin/command-center/recent-activity' },
      { label: 'Phiên đăng nhập realtime', icon: RadioTower, to: '/admin/command-center/sessions', badge: 'Live', badgeTone: 'info' },
      { label: 'Tình trạng worker / queue', icon: ServerCog, to: '/admin/command-center/workers' },
      { label: 'Tình trạng realtime', icon: Wifi, to: '/admin/command-center/realtime' },
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
      { label: 'Tạo tài khoản nhân viên', icon: UserPlus, to: '/admin/staff/create', exact: true, badge: 'New', badgeTone: 'success' },
      { label: 'Hồ sơ nhân sự', icon: IdCard, to: '/admin/staff?view=profiles' },
      { label: 'Bác sĩ', icon: Stethoscope, to: '/admin/staff?role=doctor' },
      { label: 'Nhân sự theo khoa', icon: Building2, to: '/admin/departments?view=staff' },
      { label: 'Tài khoản chờ kích hoạt', icon: UserCheck, to: '/admin/staff?status=pending_activation' },
      { label: 'Tài khoản bị khóa', icon: UserLock, to: '/admin/staff?status=locked', badge: 'Risk', badgeTone: 'danger' },
      { label: 'Tài khoản bị vô hiệu hóa', icon: ShieldBan, to: '/admin/staff?status=disabled' },
      { label: 'Tài khoản rủi ro', icon: ShieldAlert, to: '/admin/staff?risk=high', badge: 'Hot', badgeTone: 'danger' },
      { label: 'Chuyển khoa / điều chuyển', icon: RefreshCw, to: panelRoute('staff-transfer') },
      { label: 'Reset mật khẩu', icon: KeyRound, to: panelRoute('staff-password-reset') },
      { label: 'Force logout', icon: LogOut, to: panelRoute('staff-force-logout') },
      { label: 'Lịch sử đăng nhập nhân viên', icon: FileClock, to: '/admin/logs/login-history' },
    ],
  },
  {
    id: 'iam',
    title: 'IAM & phân quyền',
    subtitle: 'RBAC, deny policy, cache',
    icon: ShieldCheck,
    tone: 'indigo',
    items: [
      { label: 'Tổng quan IAM', icon: Gauge, to: '/admin/roles?view=iam-overview' },
      { label: 'Vai trò hệ thống', icon: ShieldCheck, to: '/admin/roles' },
      { label: 'Tạo vai trò', icon: Sparkles, to: '/admin/roles/create', exact: true },
      { label: 'Quyền hệ thống', icon: KeyRound, to: '/admin/permissions' },
      { label: 'Ma trận quyền', icon: TableProperties, to: '/admin/roles?view=permission-matrix' },
      { label: 'Gán vai trò', icon: UserCog, to: '/admin/roles?view=assignment' },
      { label: 'Quyền hiệu lực theo người dùng', icon: Fingerprint, to: '/admin/permissions?view=effective-user' },
      { label: 'Kiểm tra quyền truy cập', icon: ScanLine, to: panelRoute('permission-checker') },
      { label: 'Access context viewer', icon: FileText, to: panelRoute('access-context-viewer') },
      { label: 'Rebuild permission cache', icon: RefreshCw, to: panelRoute('permission-cache-rebuild'), badge: 'Ops', badgeTone: 'info' },
      { label: 'Deny permissions', icon: ShieldBan, to: panelRoute('deny-permissions') },
      { label: 'Deny roles', icon: LockKeyhole, to: panelRoute('deny-roles') },
      { label: 'Lịch sử thay đổi quyền', icon: History, to: auditRoute('iam') },
      { label: 'Seed system access', icon: Database, to: panelRoute('seed-system-access') },
    ],
  },
  {
    id: 'workspace-access',
    title: 'Workspace access',
    subtitle: 'Actor, sidebar, default workspace',
    icon: Network,
    tone: 'blue',
    items: [
      { label: 'Danh sách workspace', icon: MonitorCheck, to: panelRoute('workspace-list') },
      { label: 'Workspace theo actor', icon: UserRound, to: panelRoute('workspace-by-actor') },
      { label: 'Workspace theo vai trò', icon: ShieldCheck, to: panelRoute('workspace-by-role') },
      { label: 'Workspace theo người dùng', icon: UsersRound, to: panelRoute('workspace-by-user') },
      { label: 'Workspace theo khoa', icon: Building2, to: panelRoute('workspace-by-department') },
      { label: 'Quyền truy cập workspace', icon: KeyRound, to: panelRoute('workspace-permissions') },
      { label: 'Cấu hình sidebar theo actor', icon: SlidersHorizontal, to: panelRoute('actor-sidebar-config') },
      { label: 'Điều hướng cross-workspace', icon: Router, to: '/super-admin/access' },
      { label: 'User preference / default workspace', icon: UserCog, to: panelRoute('default-workspace') },
      { label: 'Kiểm tra khả dụng workspace', icon: CheckCircle2, to: panelRoute('workspace-availability'), badge: 'OK', badgeTone: 'success' },
    ],
  },
  {
    id: 'facilities',
    title: 'Khoa phòng & cơ sở vận hành',
    subtitle: 'Khoa, phòng, điểm dịch vụ',
    icon: Hospital,
    tone: 'teal',
    items: [
      { label: 'Danh sách khoa phòng', icon: Building2, to: '/admin/departments' },
      { label: 'Tạo khoa phòng', icon: Sparkles, to: '/admin/departments/create', exact: true },
      { label: 'Trưởng khoa', icon: UserCheck, to: '/admin/departments?view=heads' },
      { label: 'Nhân sự theo khoa', icon: UsersRound, to: '/admin/departments?view=staff' },
      { label: 'Tổng quan khoa', icon: BarChart3, to: '/admin/departments?view=overview' },
      { label: 'Phòng khám / địa điểm', icon: Hospital, to: panelRoute('clinic-locations') },
      { label: 'Khu vực tiếp nhận', icon: ListChecks, to: panelRoute('reception-areas') },
      { label: 'Phòng xét nghiệm', icon: TestTube2, to: panelRoute('lab-rooms') },
      { label: 'Phòng CĐHA', icon: Activity, to: panelRoute('imaging-rooms') },
      { label: 'Phòng thủ thuật', icon: BriefcaseMedical, to: panelRoute('procedure-rooms') },
      { label: 'Kho / nhà thuốc', icon: Store, to: panelRoute('warehouse-pharmacy') },
      { label: 'Trạng thái hoạt động', icon: MonitorCheck, to: panelRoute('facility-operating-status') },
      { label: 'Cấu hình địa điểm dịch vụ', icon: Settings, to: panelRoute('service-location-config') },
    ],
  },
  {
    id: 'master-data',
    title: 'Master Data',
    subtitle: 'Danh mục lõi y tế',
    icon: Database,
    tone: 'amber',
    items: [
      { label: 'Dịch vụ y tế', icon: HeartPulse, to: panelRoute('medical-services') },
      { label: 'Bảng giá dịch vụ', icon: ReceiptText, to: panelRoute('service-price-list') },
      { label: 'Danh mục thuốc', icon: Pill, to: panelRoute('medication-catalog') },
      { label: 'Đơn vị thuốc', icon: PackageCheck, to: panelRoute('medication-units') },
      { label: 'Dạng bào chế', icon: FileCog, to: panelRoute('dosage-forms') },
      { label: 'Đường dùng thuốc', icon: Router, to: panelRoute('administration-routes') },
      { label: 'Nhà cung cấp', icon: Store, to: panelRoute('suppliers') },
      { label: 'Kho dược', icon: Archive, to: panelRoute('pharmacy-warehouses') },
      { label: 'Danh mục xét nghiệm', icon: TestTube2, to: panelRoute('lab-test-catalog') },
      { label: 'Loại mẫu bệnh phẩm', icon: ClipboardList, to: panelRoute('specimen-types') },
      { label: 'Danh mục CĐHA', icon: Activity, to: panelRoute('imaging-catalog') },
      { label: 'Thiết bị CĐHA', icon: MonitorCheck, to: panelRoute('imaging-equipment') },
      { label: 'Danh mục thủ thuật', icon: BriefcaseMedical, to: panelRoute('procedure-catalog') },
      { label: 'Mẫu báo cáo kết quả', icon: FileText, to: panelRoute('result-report-templates') },
      { label: 'Loại lịch / slot', icon: CalendarClock, to: panelRoute('schedule-slot-types') },
      { label: 'Quy tắc mã định danh', icon: Fingerprint, to: panelRoute('identifier-rules') },
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
      { label: 'Feature flags', icon: Sparkles, to: settingsRoute('feature-flags'), badge: 'Flags', badgeTone: 'info' },
      { label: 'Cấu hình đăng nhập', icon: KeyRound, to: settingsRoute('login') },
      { label: 'Cấu hình bảo mật', icon: ShieldCheck, to: settingsRoute('security') },
      { label: 'Cấu hình Google OAuth', icon: Globe2, to: settingsRoute('google-oauth') },
      { label: 'Cấu hình thông báo', icon: BellRing, to: settingsRoute('notifications') },
      { label: 'Cấu hình email / SMTP', icon: Mail, to: settingsRoute('email-smtp') },
      { label: 'Cấu hình push notification', icon: Smartphone, to: settingsRoute('push-notification') },
      { label: 'Cấu hình realtime', icon: RadioTower, to: settingsRoute('realtime') },
      { label: 'Cấu hình file / upload', icon: UploadCloud, to: settingsRoute('file-upload') },
      { label: 'Cấu hình QR token', icon: ScanLine, to: settingsRoute('qr-token') },
      { label: 'Cấu hình thanh toán', icon: Banknote, to: settingsRoute('payments') },
      { label: 'Cấu hình patient portal', icon: HeartPulse, to: settingsRoute('patient-portal') },
      { label: 'Cấu hình support SLA', icon: TicketCheck, to: settingsRoute('support-sla') },
      { label: 'Cấu hình audit retention', icon: Archive, to: settingsRoute('audit-retention') },
    ],
  },
  {
    id: 'security-center',
    title: 'Security Center',
    subtitle: 'Phiên, rủi ro, consent, access',
    icon: ShieldAlert,
    tone: 'red',
    items: [
      { label: 'Security dashboard', icon: ShieldAlert, to: panelRoute('security-dashboard') },
      { label: 'Phiên đăng nhập', icon: RadioTower, to: '/admin/security/sessions' },
      { label: 'Login history', icon: History, to: '/admin/logs/login-history' },
      { label: 'Thiết bị / IP đáng ngờ', icon: Wifi, to: panelRoute('suspicious-device-ip'), badge: 'Watch', badgeTone: 'warning' },
      { label: 'Tài khoản có rủi ro', icon: UserLock, to: '/admin/staff?risk=high' },
      { label: 'Token / refresh token risk', icon: KeyRound, to: panelRoute('token-risk') },
      { label: 'Rate limit events', icon: Gauge, to: panelRoute('rate-limit-events') },
      { label: 'Break-glass access', icon: Vault, to: panelRoute('break-glass-access'), badge: 'Strict', badgeTone: 'danger' },
      { label: 'Consent', icon: FileText, to: panelRoute('consent') },
      { label: 'Patient authorization', icon: HeartPulse, to: panelRoute('patient-authorization') },
      { label: 'Access authorization', icon: ShieldEllipsis, to: panelRoute('access-authorization') },
      { label: 'Sensitive access events', icon: ShieldAlert, to: auditRoute('sensitive-access') },
      { label: 'Chính sách truy cập dữ liệu', icon: LockKeyhole, to: panelRoute('data-access-policy') },
      { label: 'Thu hồi phiên hàng loạt', icon: ShieldBan, to: panelRoute('bulk-session-revoke') },
    ],
  },
  {
    id: 'audit-compliance',
    title: 'Audit & Compliance',
    subtitle: 'Dấu vết và báo cáo tuân thủ',
    icon: FileClock,
    tone: 'slate',
    items: [
      { label: 'Audit log', icon: FileClock, to: '/admin/logs/audit' },
      { label: 'Audit theo actor', icon: UserRound, to: auditRoute('actor') },
      { label: 'Audit theo người dùng', icon: UsersRound, to: auditRoute('user') },
      { label: 'Audit theo đối tượng', icon: Database, to: auditRoute('object') },
      { label: 'Audit hồ sơ bệnh án', icon: FileText, to: auditRoute('medical-record') },
      { label: 'Audit phân quyền', icon: ShieldCheck, to: auditRoute('iam') },
      { label: 'Audit cấu hình hệ thống', icon: Settings, to: auditRoute('system-config') },
      { label: 'Audit thanh toán', icon: ReceiptText, to: auditRoute('payment') },
      { label: 'Audit truy cập nhạy cảm', icon: ShieldAlert, to: auditRoute('sensitive-access') },
      { label: 'Audit break-glass', icon: Vault, to: auditRoute('break-glass') },
      { label: 'Export audit', icon: CloudUpload, to: panelRoute('audit-export') },
      { label: 'Báo cáo tuân thủ', icon: FileText, to: panelRoute('compliance-reports') },
    ],
  },
  {
    id: 'operations',
    title: 'Operations Center',
    subtitle: 'Jobs, queue, realtime, diagnostics',
    icon: ServerCog,
    tone: 'orange',
    items: [
      { label: 'Worker health', icon: Activity, to: panelRoute('worker-health'), badge: 'Live', badgeTone: 'info' },
      { label: 'Jobs / Workers', icon: ServerCog, to: panelRoute('jobs-workers') },
      { label: 'Job run logs', icon: FileClock, to: panelRoute('job-run-logs') },
      { label: 'Event outbox', icon: Archive, to: panelRoute('event-outbox') },
      { label: 'Dead-letter events', icon: AlertTriangle, to: panelRoute('dead-letter-events'), badge: 'DLQ', badgeTone: 'danger' },
      { label: 'Retry event', icon: RefreshCw, to: panelRoute('retry-event') },
      { label: 'Notification delivery', icon: BellRing, to: panelRoute('notification-delivery') },
      { label: 'Notification failed', icon: ShieldAlert, to: panelRoute('notification-failed') },
      { label: 'Realtime status', icon: Wifi, to: panelRoute('ops-realtime-status') },
      { label: 'Socket presence', icon: RadioTower, to: panelRoute('socket-presence') },
      { label: 'Idempotency records', icon: Fingerprint, to: panelRoute('idempotency-records') },
      { label: 'QR tokens', icon: ScanLine, to: panelRoute('qr-tokens') },
      { label: 'File scan status', icon: ScanLine, to: panelRoute('file-scan-status') },
      { label: 'System diagnostics', icon: HardDrive, to: panelRoute('system-diagnostics') },
      { label: 'Maintenance mode', icon: SlidersHorizontal, to: panelRoute('maintenance-mode') },
    ],
  },
  {
    id: 'integrations',
    title: 'Integration Hub',
    subtitle: 'Providers, webhook, reconciliation',
    icon: Webhook,
    tone: 'pink',
    items: [
      { label: 'Email provider', icon: Mail, to: panelRoute('email-provider') },
      { label: 'Push provider', icon: Smartphone, to: panelRoute('push-provider') },
      { label: 'HTTP notification channel', icon: Webhook, to: panelRoute('http-notification-channel') },
      { label: 'Bank QR provider', icon: Banknote, to: panelRoute('bank-qr-provider') },
      { label: 'MoMo personal QR', icon: Smartphone, to: panelRoute('momo-personal-qr') },
      { label: 'Payment webhook', icon: Link2, to: panelRoute('payment-webhook') },
      { label: 'Provider webhook events', icon: FileClock, to: panelRoute('provider-webhook-events') },
      { label: 'Bank statement transactions', icon: Landmark, to: panelRoute('bank-statement-transactions') },
      { label: 'Reconciliation provider', icon: RefreshCw, to: panelRoute('reconciliation-provider') },
      { label: 'Google OAuth', icon: Globe2, to: settingsRoute('google-oauth') },
      { label: 'Integration health', icon: Activity, to: panelRoute('integration-health'), badge: 'OK', badgeTone: 'success' },
      { label: 'Integration logs', icon: FileClock, to: panelRoute('integration-logs') },
    ],
  },
  {
    id: 'patient-portal',
    title: 'Patient Portal Admin',
    subtitle: 'Bệnh nhân, người thân, dữ liệu tự gửi',
    icon: HeartPulse,
    tone: 'rose',
    items: [
      { label: 'Tài khoản bệnh nhân', icon: UserRound, to: panelRoute('patient-accounts') },
      { label: 'Người thân bệnh nhân', icon: UsersRound, to: panelRoute('patient-relatives') },
      { label: 'Ủy quyền người thân', icon: ShieldCheck, to: panelRoute('relative-authorization') },
      { label: 'Hồ sơ bệnh nhân tự cập nhật', icon: FileText, to: panelRoute('patient-self-updated-profile') },
      { label: 'Yêu cầu cập nhật hồ sơ', icon: ClipboardCheck, to: panelRoute('profile-change-requests') },
      { label: 'Tài liệu bệnh nhân upload', icon: UploadCloud, to: panelRoute('patient-uploaded-documents') },
      { label: 'Yêu cầu xuất hồ sơ', icon: CloudUpload, to: panelRoute('record-export-requests') },
      { label: 'Bảo hiểm bệnh nhân gửi', icon: ReceiptText, to: panelRoute('patient-submitted-insurance') },
      { label: 'Portal feature flags', icon: Sparkles, to: settingsRoute('portal-feature-flags') },
      { label: 'Portal audit', icon: FileClock, to: auditRoute('portal') },
    ],
  },
  {
    id: 'support-communication',
    title: 'Support & Communication',
    subtitle: 'Tickets, hội thoại, broadcast',
    icon: MessageSquare,
    tone: 'lime',
    items: [
      { label: 'Support tickets', icon: TicketCheck, to: panelRoute('support-tickets') },
      { label: 'Ticket quá SLA', icon: AlertTriangle, to: panelRoute('support-over-sla'), badge: 'SLA', badgeTone: 'danger' },
      { label: 'Ticket kỹ thuật', icon: ServerCog, to: panelRoute('technical-tickets') },
      { label: 'Ticket liên quan tài khoản', icon: UserRound, to: panelRoute('account-tickets') },
      { label: 'Ticket liên quan thanh toán', icon: ReceiptText, to: panelRoute('payment-tickets') },
      { label: 'Hội thoại nội bộ', icon: MessageSquare, to: panelRoute('internal-conversations') },
      { label: 'Tin nhắn hệ thống', icon: BellRing, to: panelRoute('system-messages') },
      { label: 'Thông báo hệ thống', icon: BellRing, to: panelRoute('system-notifications') },
      { label: 'Broadcast notification', icon: RadioTower, to: panelRoute('broadcast-notification') },
      { label: 'Notification templates', icon: FileText, to: panelRoute('notification-templates') },
      { label: 'Mẫu phản hồi hỗ trợ', icon: BookOpen, to: panelRoute('support-response-templates') },
    ],
  },
  {
    id: 'admin-tools',
    title: 'Admin Tools',
    subtitle: 'Integrity, migration, diagnostics',
    icon: FileCog,
    tone: 'steel',
    items: [
      { label: 'Kiểm tra route guards', icon: Router, to: panelRoute('check-route-guards') },
      { label: 'Kiểm tra RBAC integrity', icon: ShieldCheck, to: panelRoute('check-rbac-integrity') },
      { label: 'Kiểm tra permission map', icon: TableProperties, to: panelRoute('check-permission-map') },
      { label: 'Kiểm tra data consistency', icon: Database, to: panelRoute('check-data-consistency') },
      { label: 'Đồng bộ indexes', icon: RefreshCw, to: panelRoute('sync-indexes') },
      { label: 'Đồng bộ quyền hệ thống', icon: KeyRound, to: panelRoute('sync-system-permissions') },
      { label: 'Migration tools', icon: GitBranchIcon, to: panelRoute('migration-tools') },
      { label: 'Demo data tools', icon: Sparkles, to: panelRoute('demo-data-tools') },
      { label: 'Cleanup tools', icon: Archive, to: panelRoute('cleanup-tools') },
      { label: 'Rebuild cache', icon: RefreshCw, to: panelRoute('rebuild-cache') },
      { label: 'Export hệ thống', icon: CloudUpload, to: panelRoute('system-export') },
      { label: 'Developer diagnostics', icon: HardDrive, to: panelRoute('developer-diagnostics') },
    ],
  },
];

function GitBranchIcon(props) {
  return <Network {...props} />;
}

const FOOTER_ITEMS = [
  { label: 'Hồ sơ của tôi', icon: UserRound, to: '/admin/profile' },
  { label: 'Audit log', icon: FileClock, to: '/admin/logs/audit' },
  { label: 'Cấu hình', icon: Settings, to: '/admin/settings', badge: 'Core', badgeTone: 'info' },
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
      <aside className="scp-sidebar" aria-label="System Control Plane">
        <div className="scp-sidebar__brand">
          <Link to="/admin/command-center" className="scp-brand-mark" aria-label="System Control Plane dashboard">
            <Command size={22} strokeWidth={2.35} aria-hidden="true" />
          </Link>
          <div className="scp-brand-copy">
            <span>Quản trị hệ thống</span>
            <strong>System Control Plane</strong>
          </div>
          <span className="scp-live-badge">
            <span aria-hidden="true" />
            LIVE
          </span>
        </div>

        <div className="scp-sidebar__main">
          <nav className="scp-sidebar__nav" aria-label="Admin navigation">
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
              <span className="scp-health-chip scp-health-chip--green">Realtime 99.8%</span>
              <span className="scp-health-chip scp-health-chip--blue">IAM cache fresh</span>
              <span className="scp-health-chip scp-health-chip--amber">Queue 24</span>
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
                <span>CONTROL PLANE ADMIN</span>
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
