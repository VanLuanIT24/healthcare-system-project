import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Archive,
  Ban,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Eye,
  FileClock,
  FileText,
  Fingerprint,
  Gauge,
  History,
  KeyRound,
  ListFilter,
  LockKeyhole,
  LogOut,
  Network,
  Play,
  RadioTower,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ShieldEllipsis,
  SlidersHorizontal,
  UserLock,
  UsersRound,
  Vault,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import { AdminActionConfirmDialog } from '../../components/AdminActionConfirmDialog';
import { formatDateTime, formatNumber } from '../../system/systemUi';
import {
  approvePatientAuthorization,
  archiveDataAccessPolicy,
  createDataAccessPolicy,
  executeBulkSessionRevoke,
  getSecurityDashboard,
  getSecurityLoginSummary,
  getSecuritySession,
  getTokenFamily,
  listAccessDecisions,
  listBreakGlassAccess,
  listDataAccessPolicies,
  listRateLimitEvents,
  listRiskyAccounts,
  listSecurityConsents,
  listSecurityDevices,
  listSecurityLoginHistory,
  listSecurityPatientAuthorizations,
  listSecuritySessions,
  listSensitiveAccessEvents,
  listSuspiciousIps,
  listTokenFamilies,
  previewBulkSessionRevoke,
  publishDataAccessPolicy,
  reviewBreakGlass,
  revokePatientAuthorization,
  revokeSecurityConsent,
  revokeSecuritySession,
  revokeSecuritySessionFamily,
  revokeTokenFamily,
} from '../securityCenterApi';

const VIEW_PATHS = {
  dashboard: '/admin/security-center/dashboard',
  sessions: '/admin/security-center/sessions',
  loginHistory: '/admin/security-center/login-history',
  suspicious: '/admin/security-center/suspicious',
  riskyAccounts: '/admin/security-center/risky-accounts',
  tokenRisk: '/admin/security-center/token-risk',
  rateLimit: '/admin/security-center/rate-limit',
  breakGlass: '/admin/security-center/break-glass',
  consent: '/admin/security-center/consent',
  patientAuthorization: '/admin/security-center/patient-authorization',
  accessAuthorization: '/admin/security-center/access-authorization',
  sensitiveAccess: '/admin/security-center/sensitive-access',
  dataPolicy: '/admin/security-center/data-policy',
  bulkRevoke: '/admin/security-center/bulk-revoke',
};

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Tổng quan', icon: ShieldAlert },
  { key: 'sessions', label: 'Phiên đăng nhập', icon: RadioTower },
  { key: 'loginHistory', label: 'Lịch sử đăng nhập', icon: History },
  { key: 'suspicious', label: 'Thiết bị / IP', icon: Wifi },
  { key: 'riskyAccounts', label: 'Tài khoản rủi ro', icon: UserLock },
  { key: 'tokenRisk', label: 'Rủi ro token', icon: KeyRound },
  { key: 'rateLimit', label: 'Giới hạn tần suất', icon: Gauge },
  { key: 'breakGlass', label: 'Truy cập khẩn cấp', icon: Vault },
  { key: 'consent', label: 'Đồng thuận', icon: FileText },
  { key: 'patientAuthorization', label: 'Ủy quyền bệnh nhân', icon: UsersRound },
  { key: 'accessAuthorization', label: 'Quyết định truy cập', icon: ShieldEllipsis },
  { key: 'sensitiveAccess', label: 'Truy cập nhạy cảm', icon: ShieldCheck },
  { key: 'dataPolicy', label: 'Chính sách dữ liệu', icon: LockKeyhole },
  { key: 'bulkRevoke', label: 'Thu hồi hàng loạt', icon: ShieldBan },
];

const SECURITY_LABELS = {
  active: 'Đang hoạt động',
  success: 'Thành công',
  failed: 'Lỗi',
  failure: 'Lỗi',
  revoked: 'Đã thu hồi',
  expired: 'Hết hạn',
  locked: 'Bị khóa',
  disabled: 'Đã vô hiệu hóa',
  archived: 'Đã lưu trữ',
  published: 'Đã phát hành',
  reviewed: 'Đã rà soát',
  approved: 'Đã duyệt',
  pending: 'Chờ xử lý',
  pending_review: 'Chờ duyệt',
  violation: 'Vi phạm',
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  staff: 'Nhân sự',
  patient: 'Bệnh nhân',
  patient_relative: 'Người thân',
  anonymous: 'Ẩn danh',
  draft: 'Bản nháp',
  unknown: 'Không rõ',
  warning: 'Cảnh báo',
  error: 'Lỗi',
  device: 'Thiết bị',
  ip: 'IP',
  allowed: 'Được phép',
  blocked: 'Bị chặn',
  required: 'Bắt buộc',
  optional: 'Tùy chọn',
  active_session: 'Phiên hoạt động',
  medical_record: 'Hồ sơ y tế',
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  access_denied: 'Truy cập bị từ chối',
  sensitive_granted: 'Đã cấp truy cập nhạy cảm',
  view: 'Xem',
  'n/a': 'Chưa có',
};

function normalizeView(view) {
  return VIEW_PATHS[view] ? view : 'dashboard';
}

function shortId(value) {
  if (!value) return 'n/a';
  const text = String(value);
  return text.length > 14 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return 'Chưa có';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return formatNumber(value);
  if (Array.isArray(value)) return value.length ? value.join(', ') : '[]';
  if (typeof value === 'object') return JSON.stringify(value);
  return SECURITY_LABELS[String(value).toLowerCase()] || String(value).replace(/_/g, ' ');
}

function riskTone(level, score) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'critical' || Number(score) >= 85) return 'critical';
  if (normalized === 'high' || Number(score) >= 65) return 'high';
  if (normalized === 'medium' || Number(score) >= 35) return 'medium';
  return 'low';
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (['success', 'active', 'published', 'reviewed', 'approved'].includes(normalized)) return 'success';
  if (['warning', 'pending', 'pending_review', 'locked', 'expired'].includes(normalized)) return 'warning';
  if (['failed', 'error', 'critical', 'revoked', 'disabled', 'archived', 'violation'].includes(normalized)) return 'danger';
  return 'muted';
}

function itemId(item = {}) {
  return item.session_id
    || item.token_family_id
    || item.rate_limit_event_id
    || item.break_glass_access_id
    || item.policy_id
    || item._id
    || item.actor_id
    || item.ip_address
    || item.device_id
    || item.request_id
    || item.policy_key
    || JSON.stringify(item).slice(0, 80);
}

function securityActionTarget(item = {}) {
  return item.display_name
    || item.actor_name
    || item.username
    || item.policy_key
    || item.consent_type
    || item.authorization_type
    || item.session_id
    || item.token_family_id
    || item.ip_address
    || itemId(item);
}

function securityActionCopy(action, item = {}) {
  const copies = {
    'revoke-session': ['Thu hồi phiên đăng nhập?', 'Phiên được chọn sẽ bị đăng xuất ngay và ghi vào audit bảo mật.', 'Thu hồi phiên', 'danger', true],
    'revoke-session-family': ['Thu hồi cả nhóm token?', 'Mọi phiên cùng nhóm token liên quan sẽ bị vô hiệu hóa.', 'Thu hồi nhóm token', 'danger', true],
    'revoke-token-family': ['Thu hồi nhóm token?', 'Nhóm refresh token này sẽ không còn hợp lệ.', 'Thu hồi token', 'danger', true],
    'review-break-glass': ['Đánh dấu break-glass đã rà soát?', 'Bản ghi truy cập khẩn cấp sẽ được chuyển sang trạng thái đã review.', 'Đánh dấu đã rà soát', 'success', false],
    'revoke-consent': ['Thu hồi đồng thuận?', 'Đồng thuận đang hiệu lực sẽ bị thu hồi và có thể ảnh hưởng truy cập dữ liệu.', 'Thu hồi đồng thuận', 'danger', true],
    'approve-authorization': ['Duyệt ủy quyền bệnh nhân?', 'Ủy quyền đang chờ sẽ được phê duyệt.', 'Duyệt ủy quyền', 'success', false],
    'revoke-authorization': ['Thu hồi ủy quyền bệnh nhân?', 'Ủy quyền đang hiệu lực sẽ bị thu hồi.', 'Thu hồi ủy quyền', 'danger', true],
    'publish-policy': ['Phát hành chính sách dữ liệu?', 'Chính sách sẽ chuyển sang trạng thái phát hành và ảnh hưởng quyết định truy cập.', 'Phát hành', 'warning', false],
    'archive-policy': ['Lưu trữ chính sách dữ liệu?', 'Chính sách sẽ được lưu trữ và không còn là chính sách vận hành chính.', 'Lưu trữ', 'danger', true],
  };
  const copy = copies[action];
  if (!copy) return null;
  const [title, description, confirmLabel, tone, reasonRequired] = copy;
  return {
    title,
    description,
    confirmLabel,
    tone,
    reasonRequired,
    details: [
      { label: 'Đối tượng', value: securityActionTarget(item) },
      { label: 'ID', value: itemId(item) },
      { label: 'Trạng thái', value: formatValue(item.status || item.review_status || (item.is_active ? 'active' : 'unknown')) },
    ],
  };
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const items = data.items || data.sessions || data.realtime_events || data.events || data.rows || [];
  return Array.isArray(items) ? items : [];
}

function hoursForRange(range) {
  if (range === '1h') return 1;
  if (range === '7d') return 24 * 7;
  if (range === '30d') return 24 * 30;
  return 24;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildQuery(filters) {
  const from = new Date(Date.now() - hoursForRange(filters.range) * 60 * 60 * 1000).toISOString();
  return {
    limit: 40,
    from,
    keyword: filters.keyword,
    actor_type: filters.actor_type,
    status: filters.status,
    risk_level: filters.risk_level,
    ip_address: filters.ip_address,
  };
}

function RiskBadge({ level, score }) {
  const tone = riskTone(level, score);
  return (
    <span className={`security-center-badge security-center-badge--${tone}`}>
      {formatValue(level || tone)}
      {score !== undefined && score !== null ? ` / ${score}` : ''}
    </span>
  );
}

function StatusBadge({ children, status }) {
  return (
    <span className={`security-center-badge security-center-badge--${statusTone(status || children)}`}>
      {formatValue(children || status || 'unknown')}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone = 'blue' }) {
  return (
    <article className={`security-center-metric security-center-metric--${tone}`}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function ActionButton({ icon: Icon, children, tone = 'neutral', ...props }) {
  return (
    <button type="button" className={`security-center-action security-center-action--${tone}`} {...props}>
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

function JsonBlock({ value }) {
  return (
    <pre className="security-center-json">
      {JSON.stringify(value || {}, null, 2)}
    </pre>
  );
}

function ActorCell({ item = {} }) {
  const label = item.display_name || item.actor_name || item.username || item.actor_id || item.actor_type || 'Không rõ đối tượng';
  return (
    <div className="security-center-actor">
      <strong>{label}</strong>
      <span>{formatValue(item.actor_type || item.target_type || 'n/a')} / {shortId(item.actor_id || item.target_id)}</span>
    </div>
  );
}

const VIEW_CONFIG = {
  sessions: {
    title: 'Phiên đăng nhập toàn hệ thống',
    subtitle: 'Quản lý phiên, thiết bị, dịch chuyển IP, nhóm token và thu hồi phiên khi có sự cố.',
    icon: RadioTower,
    loader: listSecuritySessions,
    detailLoader: (row) => getSecuritySession(row.session_id),
    columns: [
      { key: 'session', label: 'Phiên', render: (row) => <strong>{shortId(row.session_id)}</strong> },
      { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
      { key: 'device', label: 'Thiết bị', render: (row) => `${row.device_name || row.browser || 'Không rõ'} / ${row.os || 'HĐH'}` },
      { key: 'ip', label: 'IP', render: (row) => row.last_ip || row.ip_address || row.created_ip || 'Chưa có' },
      { key: 'token', label: 'Nhóm token', render: (row) => shortId(row.token_family_id) },
      { key: 'risk', label: 'Rủi ro', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.is_active ? 'active' : row.revoked_at ? 'revoked' : 'expired'}>{row.is_active ? 'active' : row.revoked_at ? 'revoked' : 'expired'}</StatusBadge> },
      { key: 'last', label: 'Dùng gần nhất', render: (row) => formatDateTime(row.last_used_at) },
    ],
  },
  loginHistory: {
    title: 'Lịch sử đăng nhập toàn hệ thống',
    subtitle: 'Theo dõi đăng nhập thành công, thất bại, khóa tài khoản và các cụm đăng nhập lỗi.',
    icon: History,
    loader: listSecurityLoginHistory,
    summaryLoader: getSecurityLoginSummary,
    columns: [
      { key: 'time', label: 'Thời gian', render: (row) => formatDateTime(row.created_at) },
      { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
      { key: 'action', label: 'Hành động', render: (row) => formatValue(row.action) },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'Chưa có' },
      { key: 'message', label: 'Thông báo', render: (row) => row.message || 'Chưa có' },
      { key: 'request', label: 'Mã yêu cầu', render: (row) => shortId(row.request_id) },
    ],
  },
  suspicious: {
    title: 'Thiết bị / IP đáng ngờ',
    subtitle: 'Phân cụm IP, dấu vân tay thiết bị, truy cập bị từ chối, token replay và hoạt động đa tài khoản.',
    icon: Wifi,
    loader: async (query) => {
      const [ips, devices] = await Promise.all([listSuspiciousIps(query), listSecurityDevices(query)]);
      return {
        items: [
          ...(ips.items || []).map((item) => ({ ...item, row_type: 'ip' })),
          ...(devices.items || []).map((item) => ({ ...item, row_type: 'device' })),
        ],
      };
    },
    columns: [
      { key: 'type', label: 'Loại', render: (row) => <StatusBadge status={row.row_type}>{row.row_type === 'device' ? 'Thiết bị' : 'IP'}</StatusBadge> },
      { key: 'identity', label: 'Định danh', render: (row) => row.ip_address || row.device_id || 'Không rõ' },
      { key: 'events', label: 'Sự kiện / Phiên', render: (row) => formatNumber(row.events || row.session_count || 0) },
      { key: 'failed', label: 'Đăng nhập lỗi / bị chặn', render: (row) => `${formatNumber(row.failed_logins || 0)} / ${formatNumber(row.access_denied || 0)}` },
      { key: 'actors', label: 'Đối tượng', render: (row) => formatNumber(row.distinct_actors || row.actor_count || 0) },
      { key: 'risk', label: 'Rủi ro', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
      { key: 'last', label: 'Thấy gần nhất', render: (row) => formatDateTime(row.last_seen_at) },
    ],
  },
  riskyAccounts: {
    title: 'Tài khoản có rủi ro',
    subtitle: 'Tài khoản bị khóa hoặc vô hiệu hóa nhưng còn phiên, đăng nhập lỗi và phiên hoạt động từ nhiều IP.',
    icon: UserLock,
    loader: listRiskyAccounts,
    columns: [
      { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'failed', label: 'Số lần đăng nhập lỗi', render: (row) => formatNumber(row.failed_login_attempts) },
      { key: 'sessions', label: 'Phiên hoạt động', render: (row) => formatNumber(row.active_sessions) },
      { key: 'ip', label: 'IP gần nhất', render: (row) => row.last_login_ip || 'Chưa có' },
      { key: 'locked', label: 'Khóa đến', render: (row) => formatDateTime(row.locked_until) },
      { key: 'risk', label: 'Rủi ro', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
    ],
  },
  tokenRisk: {
    title: 'Rủi ro token / refresh token',
    subtitle: 'Theo dõi nhóm token, vòng quay refresh, tái sử dụng token, thu hồi nhóm và đăng xuất cưỡng bức.',
    icon: KeyRound,
    loader: listTokenFamilies,
    detailLoader: (row) => getTokenFamily(row.token_family_id),
    columns: [
      { key: 'family', label: 'Nhóm token', render: (row) => <strong>{shortId(row.token_family_id)}</strong> },
      { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
      { key: 'sessions', label: 'Phiên', render: (row) => `${formatNumber(row.active_sessions)} hoạt động / ${formatNumber(row.session_count)} tổng` },
      { key: 'rotation', label: 'Số vòng quay', render: (row) => formatNumber(row.rotation_count) },
      { key: 'replay', label: 'Tái sử dụng', render: (row) => formatNumber(row.replay_count) },
      { key: 'risk', label: 'Rủi ro', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
      { key: 'last', label: 'Xoay gần nhất', render: (row) => formatDateTime(row.last_rotated_at) },
    ],
  },
  rateLimit: {
    title: 'Sự kiện giới hạn tần suất',
    subtitle: 'Các yêu cầu bị chặn do vượt tần suất, phạm vi, nhóm giới hạn, endpoint và IP liên quan.',
    icon: Gauge,
    loader: listRateLimitEvents,
    columns: [
      { key: 'time', label: 'Bị chặn lúc', render: (row) => formatDateTime(row.blocked_at) },
      { key: 'scope', label: 'Phạm vi', render: (row) => row.scope },
      { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
      { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'Chưa có' },
      { key: 'path', label: 'Đường dẫn', render: (row) => row.path || 'Chưa có' },
      { key: 'limit', label: 'Ngưỡng', render: (row) => `${row.limit || 'Chưa có'} / ${Math.round((row.window_ms || 0) / 1000)}s` },
      { key: 'retry', label: 'Thử lại sau', render: (row) => `${row.retry_after_seconds || 0}s` },
    ],
  },
  breakGlass: {
    title: 'Truy cập khẩn cấp',
    subtitle: 'Kiểm soát truy cập khẩn cấp, thời lượng, trạng thái rà soát, bằng chứng audit và leo thang.',
    icon: Vault,
    loader: listBreakGlassAccess,
    columns: [
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'patient', label: 'Bệnh nhân', render: (row) => shortId(row.patient_id) },
      { key: 'staff', label: 'Người truy cập', render: (row) => row.accessed_by_user_id?.full_name || shortId(row.accessed_by_user_id?._id || row.accessed_by_user_id) },
      { key: 'reason', label: 'Lý do', render: (row) => row.reason || 'Thiếu lý do' },
      { key: 'duration', label: 'Thời lượng', render: (row) => `${formatNumber(row.duration_minutes)} phút` },
      { key: 'review', label: 'Rà soát', render: (row) => <StatusBadge status={row.review_status}>{row.review_status}</StatusBadge> },
      { key: 'risk', label: 'Rủi ro', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
    ],
  },
  consent: {
    title: 'Đồng thuận toàn hệ thống',
    subtitle: 'Đồng thuận còn hiệu lực, hết hạn, bị thu hồi, thiếu tệp đính kèm hoặc cần rà soát.',
    icon: FileText,
    loader: listSecurityConsents,
    columns: [
      { key: 'patient', label: 'Bệnh nhân', render: (row) => shortId(row.patient_id) },
      { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
      { key: 'type', label: 'Loại đồng thuận', render: (row) => formatValue(row.consent_type) },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'signed', label: 'Đã ký lúc', render: (row) => formatDateTime(row.signed_at) },
      { key: 'expires', label: 'Hết hạn', render: (row) => formatDateTime(row.expires_at) },
      { key: 'document', label: 'Tài liệu', render: (row) => shortId(row.document_attachment_id) },
    ],
  },
  patientAuthorization: {
    title: 'Ủy quyền bệnh nhân',
    subtitle: 'Ủy quyền người thân, quyền được cấp, hiệu lực và tự động thu hồi phiên khi hủy ủy quyền.',
    icon: UsersRound,
    loader: listSecurityPatientAuthorizations,
    columns: [
      { key: 'patient', label: 'Bệnh nhân', render: (row) => shortId(row.patient_id) },
      { key: 'relative', label: 'Người thân', render: (row) => shortId(row.relative_id) },
      { key: 'type', label: 'Loại ủy quyền', render: (row) => formatValue(row.authorization_type) },
      { key: 'permissions', label: 'Quyền', render: (row) => formatValue(row.permissions) },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'valid', label: 'Hiệu lực đến', render: (row) => formatDateTime(row.valid_to) },
      { key: 'revoked', label: 'Đã thu hồi lúc', render: (row) => formatDateTime(row.revoked_at) },
    ],
  },
  accessAuthorization: {
    title: 'Quyết định truy cập',
    subtitle: 'Mọi quyết định truy cập bị từ chối hoặc truy cập nhạy cảm được cấp từ audit bảo mật.',
    icon: ShieldEllipsis,
    loader: listAccessDecisions,
    columns: [
      { key: 'time', label: 'Thời gian', render: (row) => formatDateTime(row.created_at) },
      { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
      { key: 'action', label: 'Hành động', render: (row) => formatValue(row.action) },
      { key: 'route', label: 'Tuyến / Đích', render: (row) => row.metadata?.path || formatValue(row.target_type || 'n/a') },
      { key: 'decision', label: 'Quyết định', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'severity', label: 'Mức độ', render: (row) => <StatusBadge status={row.severity}>{row.severity}</StatusBadge> },
      { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'Chưa có' },
    ],
  },
  sensitiveAccess: {
    title: 'Sự kiện truy cập nhạy cảm',
    subtitle: 'Hồ sơ y tế, tệp đính kèm, xét nghiệm, hình ảnh, đơn thuốc, hóa đơn và truy cập của người thân.',
    icon: ShieldCheck,
    loader: listSensitiveAccessEvents,
    columns: [
      { key: 'time', label: 'Thời gian', render: (row) => formatDateTime(row.created_at) },
      { key: 'action', label: 'Hành động', render: (row) => formatValue(row.action) },
      { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
      { key: 'target', label: 'Đích', render: (row) => `${formatValue(row.target_type || 'n/a')} / ${shortId(row.target_id)}` },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'severity', label: 'Mức độ', render: (row) => <StatusBadge status={row.severity}>{row.severity}</StatusBadge> },
      { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'Chưa có' },
    ],
  },
  dataPolicy: {
    title: 'Chính sách truy cập dữ liệu',
    subtitle: 'Chính sách động cho dữ liệu nhạy cảm, yêu cầu đồng thuận, truy cập khẩn cấp, audit và lưu trữ.',
    icon: LockKeyhole,
    loader: listDataAccessPolicies,
    columns: [
      { key: 'policy', label: 'Chính sách', render: (row) => <strong>{row.policy_key}</strong> },
      { key: 'resource', label: 'Tài nguyên / Hành động', render: (row) => `${formatValue(row.resource_type)} / ${formatValue(row.action)}` },
      { key: 'permissions', label: 'Quyền bắt buộc', render: (row) => formatValue(row.required_permissions) },
      { key: 'consent', label: 'Đồng thuận', render: (row) => row.require_consent ? 'Bắt buộc' : 'Không' },
      { key: 'break', label: 'Truy cập khẩn cấp', render: (row) => row.allow_break_glass ? 'Được phép' : 'Bị chặn' },
      { key: 'audit', label: 'Nhật ký', render: (row) => row.audit_required ? 'Bắt buộc' : 'Tùy chọn' },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
    ],
  },
};

function SecurityHero({ dashboard, loading, onRefresh }) {
  const score = num(dashboard?.security_score ?? 0);
  const summary = dashboard?.summary || {};
  return (
    <section className={`security-center-hero security-center-hero--${riskTone(dashboard?.risk_level, 100 - score)}`}>
      <div className="security-center-hero__score">
        <ShieldAlert size={26} aria-hidden="true" />
        <strong>{score}</strong>
        <span>Điểm bảo mật</span>
      </div>
      <div className="security-center-hero__copy">
        <div className="security-center-kicker">Quản trị hệ thống / Trung tâm bảo mật</div>
        <h1>Trung tâm điều phối bảo mật</h1>
        <p>
          Trung tâm điều tra phiên, rủi ro đăng nhập, token replay, truy cập khẩn cấp, đồng thuận, ủy quyền bệnh nhân và truy cập nhạy cảm.
        </p>
        <div className="security-center-hero__meta">
          <RiskBadge level={dashboard?.risk_level || 'low'} score={100 - score} />
          <span>Phiên đang hoạt động: {formatNumber(summary.active_sessions)}</span>
          <span>Cảnh báo nghiêm trọng: {formatNumber(num(summary.token_replay_events_24h) + num(summary.active_break_glass))}</span>
          <span>Cập nhật gần nhất: {formatDateTime(new Date())}</span>
        </div>
      </div>
      <div className="security-center-hero__actions">
        <ActionButton icon={RefreshCw} onClick={onRefresh} disabled={loading}>
          {loading ? 'Đang tải' : 'Làm mới'}
        </ActionButton>
        <ActionButton icon={Download}>Xuất bằng chứng</ActionButton>
        <ActionButton icon={Ban} tone="danger">Khóa khẩn cấp</ActionButton>
      </div>
    </section>
  );
}

function SecurityNav({ activeView }) {
  return (
    <nav className="security-center-nav" aria-label="Trung tâm bảo mật">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.key} to={VIEW_PATHS[item.key]} className={activeView === item.key ? 'is-active' : ''}>
            <Icon size={16} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function FilterBar({ filters, setFilters, onApply, loading }) {
  return (
    <section className="security-center-filter">
      <label>
        <Clock3 size={15} aria-hidden="true" />
        <select value={filters.range} onChange={(event) => setFilters((value) => ({ ...value, range: event.target.value }))}>
          <option value="1h">1 giờ</option>
          <option value="24h">24 giờ</option>
          <option value="7d">7 ngày</option>
          <option value="30d">30 ngày</option>
        </select>
      </label>
      <label>
        <UsersRound size={15} aria-hidden="true" />
        <select value={filters.actor_type} onChange={(event) => setFilters((value) => ({ ...value, actor_type: event.target.value }))}>
          <option value="">Mọi đối tượng</option>
          <option value="staff">Nhân sự</option>
          <option value="patient">Bệnh nhân</option>
          <option value="patient_relative">Người thân</option>
          <option value="anonymous">Ẩn danh</option>
        </select>
      </label>
      <label>
        <Activity size={15} aria-hidden="true" />
        <select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}>
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="success">Thành công</option>
          <option value="failed">Lỗi</option>
          <option value="revoked">Đã thu hồi</option>
          <option value="locked">Bị khóa</option>
          <option value="expired">Hết hạn</option>
        </select>
      </label>
      <label>
        <Network size={15} aria-hidden="true" />
        <input value={filters.ip_address} placeholder="IP" onChange={(event) => setFilters((value) => ({ ...value, ip_address: event.target.value }))} />
      </label>
      <label className="security-center-filter__search">
        <Search size={15} aria-hidden="true" />
        <input value={filters.keyword} placeholder="Tìm hành động, yêu cầu, thiết bị..." onChange={(event) => setFilters((value) => ({ ...value, keyword: event.target.value }))} />
      </label>
      <button type="button" onClick={onApply} disabled={loading}>
        <ListFilter size={16} aria-hidden="true" />
        Áp dụng
      </button>
    </section>
  );
}

function SummaryStrip({ activeView, dashboard, summary }) {
  const data = dashboard?.summary || {};
  const cards = [
    { icon: RadioTower, label: 'Phiên hoạt động', value: data.active_sessions, note: `${formatNumber(data.active_staff_sessions)} nhân sự / ${formatNumber(data.active_patient_sessions)} bệnh nhân`, tone: 'blue' },
    { icon: AlertTriangle, label: 'Đăng nhập lỗi 24h', value: data.failed_logins_24h, note: 'Theo dõi đăng nhập bất thường', tone: 'amber' },
    { icon: UserLock, label: 'Tài khoản bị khóa', value: data.locked_accounts, note: 'Nhân sự + bệnh nhân', tone: 'red' },
    { icon: KeyRound, label: 'Token replay 24h', value: data.token_replay_events_24h, note: 'Tái sử dụng refresh token', tone: 'red' },
    { icon: ShieldEllipsis, label: 'Truy cập bị chặn 24h', value: data.access_denied_24h, note: 'Bộ chặn tuyến từ chối', tone: 'amber' },
    { icon: Vault, label: 'Truy cập khẩn cấp đang mở', value: data.active_break_glass, note: 'Chờ rà soát tuân thủ', tone: 'purple' },
    { icon: ShieldCheck, label: 'Truy cập nhạy cảm', value: data.sensitive_access_24h, note: 'Sự kiện audit 24h', tone: 'green' },
    { icon: Gauge, label: 'Bị giới hạn tần suất', value: data.rate_limit_blocked_24h, note: 'Yêu cầu bị chặn', tone: 'slate' },
  ];

  if (activeView === 'loginHistory' && summary) {
    cards.splice(0, 3,
      { icon: CheckCircle2, label: 'Đăng nhập thành công', value: summary.success, note: 'Theo bộ lọc hiện tại', tone: 'green' },
      { icon: XCircle, label: 'Đăng nhập lỗi', value: summary.failed, note: `${Math.round((summary.failed_rate || 0) * 100)}% tỷ lệ lỗi`, tone: 'red' },
      { icon: UserLock, label: 'Tài khoản bị khóa', value: summary.locked, note: 'Do đăng nhập lỗi', tone: 'amber' });
  }

  return (
    <section className="security-center-metrics">
      {cards.map((item) => <MetricCard key={item.label} {...item} value={formatNumber(item.value || 0)} />)}
    </section>
  );
}

function DashboardView({ dashboard, onSelect }) {
  const events = Array.isArray(dashboard?.realtime_events) ? dashboard.realtime_events : [];
  const ips = Array.isArray(dashboard?.top_suspicious_ips) ? dashboard.top_suspicious_ips : [];
  const accounts = Array.isArray(dashboard?.top_risky_accounts) ? dashboard.top_risky_accounts : [];
  const recommendedActions = Array.isArray(dashboard?.recommended_actions) ? dashboard.recommended_actions : [];

  return (
    <div className="security-center-dashboard">
      <section className="security-center-panel security-center-panel--wide">
        <div className="security-center-panel__head">
          <div>
            <span>Luồng thời gian thực</span>
            <h2>Sự kiện bảo mật gần đây</h2>
          </div>
          <StatusBadge status="active">Đang chạy</StatusBadge>
        </div>
        <div className="security-center-stream">
          {events.length ? events.map((event) => (
            <button key={itemId(event)} type="button" onClick={() => onSelect(event)}>
              <span className={`security-center-dot security-center-dot--${statusTone(event.severity || event.status)}`} />
              <strong>{formatValue(event.action)}</strong>
              <small>{event.message || event.ip_address || 'Sự kiện bảo mật'}</small>
              <time>{formatDateTime(event.created_at)}</time>
            </button>
          )) : <EmptyState title="Chưa có sự kiện bảo mật" note="Luồng audit sẽ xuất hiện khi backend ghi log xác thực, truy cập hoặc bảo mật." />}
        </div>
      </section>

      <section className="security-center-panel">
        <div className="security-center-panel__head">
          <div>
            <span>Khuyến nghị xử lý</span>
            <h2>Hành động ưu tiên</h2>
          </div>
          <ShieldAlert size={18} aria-hidden="true" />
        </div>
        <div className="security-center-recommendations">
          {recommendedActions.length ? recommendedActions.map((item) => (
            <article key={item}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{item}</span>
            </article>
          )) : (
            <article className="is-ok">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Không có khuyến nghị khẩn cấp trong 24 giờ gần nhất.</span>
            </article>
          )}
        </div>
      </section>

      <section className="security-center-panel">
        <div className="security-center-panel__head">
          <div>
            <span>Phân tích IP</span>
            <h2>IP rủi ro cao</h2>
          </div>
          <Wifi size={18} aria-hidden="true" />
        </div>
        <MiniList items={ips} primary={(item) => item.ip_address} secondary={(item) => `${formatNumber(item.failed_logins)} failed / ${formatNumber(item.access_denied)} denied`} onSelect={onSelect} />
      </section>

      <section className="security-center-panel">
        <div className="security-center-panel__head">
          <div>
            <span>Tài khoản rủi ro</span>
            <h2>Tài khoản cần rà soát</h2>
          </div>
          <UserLock size={18} aria-hidden="true" />
        </div>
        <MiniList items={accounts} primary={(item) => item.display_name || item.username || item.actor_id} secondary={(item) => `${formatValue(item.actor_type)} / ${formatValue(item.status)} / ${formatNumber(item.failed_login_attempts)} lần lỗi`} onSelect={onSelect} />
      </section>
    </div>
  );
}

function MiniList({ items = [], primary, secondary, onSelect }) {
  if (!items.length) return <EmptyState title="Chưa có dữ liệu" note="Backend chưa ghi nhận item phù hợp với filter hiện tại." />;
  return (
    <div className="security-center-mini-list">
      {items.map((item) => (
        <button key={itemId(item)} type="button" onClick={() => onSelect(item)}>
          <div>
            <strong>{primary(item)}</strong>
            <span>{secondary(item)}</span>
          </div>
          <RiskBadge level={item.risk_level} score={item.risk_score} />
        </button>
      ))}
    </div>
  );
}

function EmptyState({ title, note }) {
  return (
    <div className="security-center-empty">
      <Database size={18} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  );
}

function DataTable({ config, items, loading, onSelect, onAction }) {
  if (loading) {
    return (
      <section className="security-center-state">
        <RefreshCw size={18} aria-hidden="true" />
        <span>Đang tải dữ liệu bảo mật...</span>
      </section>
    );
  }
  if (!items.length) {
    return <EmptyState title="Không có bản ghi" note="Thử đổi filter hoặc kiểm tra backend đã ghi audit/security event chưa." />;
  }
  return (
    <div className="security-center-table-wrap">
      <table className="security-center-table">
        <thead>
          <tr>
            {config.columns.map((column) => <th key={column.key}>{column.label}</th>)}
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={itemId(item)}>
              {config.columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(item) : formatValue(item[column.key])}</td>
              ))}
              <td>
                <div className="security-center-row-actions">
                  <button type="button" onClick={() => onSelect(item)} title="Xem chi tiết">
                    <Eye size={15} aria-hidden="true" />
                  </button>
                  {actionForItem(item, onAction)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function actionForItem(item, onAction) {
  if (item.session_id && item.is_active) {
    return (
      <>
        <button type="button" onClick={() => onAction('revoke-session', item)} title="Thu hồi phiên"><LogOut size={15} aria-hidden="true" /></button>
        {item.token_family_id ? <button type="button" onClick={() => onAction('revoke-session-family', item)} title="Thu hồi nhóm token"><KeyRound size={15} aria-hidden="true" /></button> : null}
      </>
    );
  }
  if (item.token_family_id) return <button type="button" onClick={() => onAction('revoke-token-family', item)} title="Thu hồi nhóm token"><ShieldBan size={15} aria-hidden="true" /></button>;
  if (item.break_glass_access_id) return <button type="button" onClick={() => onAction('review-break-glass', item)} title="Đánh dấu đã rà soát"><CheckCircle2 size={15} aria-hidden="true" /></button>;
  if (item.consent_type && item.status === 'active') return <button type="button" onClick={() => onAction('revoke-consent', item)} title="Thu hồi đồng thuận"><Ban size={15} aria-hidden="true" /></button>;
  if (item.authorization_type && item.status === 'pending') return <button type="button" onClick={() => onAction('approve-authorization', item)} title="Duyệt"><CheckCircle2 size={15} aria-hidden="true" /></button>;
  if (item.authorization_type && item.status === 'active') return <button type="button" onClick={() => onAction('revoke-authorization', item)} title="Thu hồi ủy quyền"><Ban size={15} aria-hidden="true" /></button>;
  if (item.policy_key && item._id) {
    return (
      <>
        <button type="button" onClick={() => onAction('publish-policy', item)} title="Phát hành chính sách"><Play size={15} aria-hidden="true" /></button>
        <button type="button" onClick={() => onAction('archive-policy', item)} title="Lưu trữ chính sách"><Archive size={15} aria-hidden="true" /></button>
      </>
    );
  }
  return null;
}

function DetailDrawer({ item, detail, loading, onClose }) {
  if (!item) return null;
  const payload = detail || item;
  return (
    <aside className="security-center-drawer" aria-label="Chi tiết bảo mật">
      <div className="security-center-drawer__head">
        <div>
          <span>Bằng chứng bảo mật</span>
          <h2>{payload.session?.session_id ? shortId(payload.session.session_id) : shortId(itemId(item))}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {loading ? (
        <section className="security-center-state">
          <RefreshCw size={18} aria-hidden="true" />
          <span>Đang tải chi tiết...</span>
        </section>
      ) : (
        <div className="security-center-drawer__body">
          <section>
            <h3>Tổng quan</h3>
            <div className="security-center-detail-grid">
              {Object.entries(payload.session || item).slice(0, 16).map(([key, value]) => (
                <article key={key}>
                  <span>{key}</span>
                  <strong>{formatValue(value)}</strong>
                </article>
              ))}
            </div>
          </section>
          {payload.actor ? (
            <section>
              <h3>Hồ sơ đối tượng</h3>
              <JsonBlock value={payload.actor} />
            </section>
          ) : null}
          {payload.token_family || payload.sessions ? (
            <section>
              <h3>Nhóm token</h3>
              <JsonBlock value={payload.token_family || payload.sessions} />
            </section>
          ) : null}
          {payload.audit_logs ? (
            <section>
              <h3>Bằng chứng nhật ký</h3>
              <div className="security-center-evidence">
                {payload.audit_logs.map((log) => (
                  <article key={itemId(log)}>
                    <strong>{formatValue(log.action)}</strong>
                    <span>{log.message || formatValue(log.status)}</span>
                    <time>{formatDateTime(log.created_at)}</time>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h3>JSON gốc</h3>
            <JsonBlock value={payload} />
          </section>
        </div>
      )}
    </aside>
  );
}

function DataPolicyWorkbench({ onCreated }) {
  const [form, setForm] = useState({
    policy_key: '',
    resource_type: 'medical_record',
    action: 'view',
    required_permissions: '',
    denied_roles: '',
    require_consent: false,
    require_patient_authorization: true,
    allow_break_glass: true,
    audit_required: true,
    review_required: false,
    retention_days: 3650,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await createDataAccessPolicy({
        ...form,
        required_permissions: form.required_permissions.split(',').map((item) => item.trim()).filter(Boolean),
        denied_roles: form.denied_roles.split(',').map((item) => item.trim()).filter(Boolean),
        retention_days: Number(form.retention_days || 3650),
        status: 'draft',
      });
      setForm((value) => ({ ...value, policy_key: '', required_permissions: '', denied_roles: '' }));
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="security-center-panel">
      <div className="security-center-panel__head">
        <div>
          <span>Trình soạn chính sách</span>
          <h2>Tạo chính sách truy cập dữ liệu</h2>
        </div>
        <LockKeyhole size={18} aria-hidden="true" />
      </div>
      <div className="security-center-policy-form">
        <label>
          <span>Mã chính sách</span>
          <input value={form.policy_key} onChange={(event) => setForm((value) => ({ ...value, policy_key: event.target.value }))} placeholder="medical_record.view" />
        </label>
        <label>
          <span>Tài nguyên</span>
          <input value={form.resource_type} onChange={(event) => setForm((value) => ({ ...value, resource_type: event.target.value }))} />
        </label>
        <label>
          <span>Hành động</span>
          <input value={form.action} onChange={(event) => setForm((value) => ({ ...value, action: event.target.value }))} />
        </label>
        <label>
          <span>Quyền bắt buộc</span>
          <input value={form.required_permissions} onChange={(event) => setForm((value) => ({ ...value, required_permissions: event.target.value }))} placeholder="medical_records.read, attachments.download" />
        </label>
        <label>
          <span>Vai trò bị từ chối</span>
          <input value={form.denied_roles} onChange={(event) => setForm((value) => ({ ...value, denied_roles: event.target.value }))} placeholder="guest, intern" />
        </label>
        <label>
          <span>Số ngày lưu trữ</span>
          <input type="number" value={form.retention_days} onChange={(event) => setForm((value) => ({ ...value, retention_days: event.target.value }))} />
        </label>
        {['require_consent', 'require_patient_authorization', 'allow_break_glass', 'audit_required', 'review_required'].map((key) => (
          <label key={key} className="security-center-checkbox">
            <input type="checkbox" checked={Boolean(form[key])} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.checked }))} />
            <span>{{
              require_consent: 'Yêu cầu đồng thuận',
              require_patient_authorization: 'Yêu cầu ủy quyền bệnh nhân',
              allow_break_glass: 'Cho phép truy cập khẩn cấp',
              audit_required: 'Bắt buộc audit',
              review_required: 'Bắt buộc rà soát',
            }[key]}</span>
          </label>
        ))}
        <ActionButton icon={Play} onClick={submit} disabled={saving || !form.policy_key} tone="primary">
          {saving ? 'Đang tạo' : 'Tạo bản nháp'}
        </ActionButton>
      </div>
    </section>
  );
}

function BulkRevokeWorkbench({ onExecuted }) {
  const [scope, setScope] = useState({
    actor_type: 'staff',
    actor_id: '',
    ip_address: '',
    device_id: '',
    token_family_id: '',
    status: 'active',
  });
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const updateScope = (key, value) => setScope((current) => ({ ...current, [key]: value }));
  const payload = useMemo(() => ({ scope, reason, notify: false }), [scope, reason]);

  const previewAction = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await previewBulkSessionRevoke(payload);
      setPreview(result);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await executeBulkSessionRevoke(payload);
      setPreview(result);
      setMessage(`Đã thu hồi ${formatNumber(result.revoked_count)} phiên.`);
      setConfirmOpen(false);
      onExecuted();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="security-center-bulk">
      <section className="security-center-panel">
        <div className="security-center-panel__head">
          <div>
            <span>Thao tác sự cố</span>
            <h2>Thu hồi phiên hàng loạt</h2>
          </div>
          <ShieldBan size={18} aria-hidden="true" />
        </div>
        <div className="security-center-bulk-form">
          <label>
            <span>Loại đối tượng</span>
            <select value={scope.actor_type} onChange={(event) => updateScope('actor_type', event.target.value)}>
              <option value="">Mọi đối tượng</option>
              <option value="staff">Nhân sự</option>
              <option value="patient">Bệnh nhân</option>
              <option value="patient_relative">Người thân</option>
            </select>
          </label>
          <label>
            <span>ID đối tượng</span>
            <input value={scope.actor_id} onChange={(event) => updateScope('actor_id', event.target.value)} placeholder="ObjectId" />
          </label>
          <label>
            <span>Địa chỉ IP</span>
            <input value={scope.ip_address} onChange={(event) => updateScope('ip_address', event.target.value)} placeholder="10.0.0.1" />
          </label>
          <label>
            <span>ID thiết bị</span>
            <input value={scope.device_id} onChange={(event) => updateScope('device_id', event.target.value)} />
          </label>
          <label>
            <span>Nhóm token</span>
            <input value={scope.token_family_id} onChange={(event) => updateScope('token_family_id', event.target.value)} />
          </label>
          <label>
            <span>Trạng thái</span>
            <select value={scope.status} onChange={(event) => updateScope('status', event.target.value)}>
              <option value="active">Chỉ phiên đang hoạt động</option>
              <option value="revoked">Đã thu hồi</option>
              <option value="expired">Hết hạn</option>
              <option value="">Tất cả</option>
            </select>
          </label>
          <label className="security-center-bulk-form__reason">
            <span>Lý do bắt buộc</span>
            <textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="suspected_compromise / incident code / điều tra..." />
          </label>
          <div className="security-center-bulk-form__actions">
            <ActionButton icon={Eye} onClick={previewAction} disabled={loading}>Xem trước</ActionButton>
            <ActionButton icon={ShieldBan} onClick={() => setConfirmOpen(true)} disabled={loading || !reason || !preview} tone="danger">Thực thi thu hồi</ActionButton>
          </div>
          {message ? <p className="security-center-message">{message}</p> : null}
        </div>
      </section>
      <section className="security-center-panel security-center-panel--wide">
        <div className="security-center-panel__head">
          <div>
            <span>Xem trước tác động</span>
            <h2>Phiên bị ảnh hưởng</h2>
          </div>
          <StatusBadge status={preview?.warnings?.length ? 'warning' : 'success'}>
            {preview ? `${formatNumber(preview.matched_sessions)} phiên` : 'Chưa xem trước'}
          </StatusBadge>
        </div>
        {preview ? (
          <>
            <div className="security-center-impact">
              <article><span>Đối tượng ảnh hưởng</span><strong>{formatNumber(preview.affected_actors)}</strong></article>
              <article><span>Phiên khớp điều kiện</span><strong>{formatNumber(preview.matched_sessions)}</strong></article>
              <article><span>Số phiên sẽ thu hồi</span><strong>{formatNumber(preview.revoked_count || 0)}</strong></article>
            </div>
            {preview.warnings?.length ? (
              <div className="security-center-recommendations">
                {preview.warnings.map((warning) => <article key={warning}><AlertTriangle size={16} /><span>{warning}</span></article>)}
              </div>
            ) : null}
            <DataTable config={VIEW_CONFIG.sessions} items={preview.items || []} loading={false} onSelect={() => {}} onAction={() => {}} />
          </>
        ) : <EmptyState title="Chưa có bản xem trước" note="Nhập phạm vi và bấm Xem trước trước khi thu hồi." />}
      </section>
      <AdminActionConfirmDialog
        open={confirmOpen}
        title="Xác nhận thu hồi phiên hàng loạt?"
        description="Thao tác này sẽ thu hồi các phiên khớp phạm vi đã preview và có thể đăng xuất nhiều người dùng cùng lúc."
        tone="danger"
        confirmLabel="Thu hồi phiên"
        details={[
          { label: 'Đối tượng ảnh hưởng', value: formatNumber(preview?.affected_actors || 0) },
          { label: 'Phiên khớp', value: formatNumber(preview?.matched_sessions || 0) },
          { label: 'Lý do', value: reason },
        ]}
        submitting={loading}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeAction}
      />
    </div>
  );
}

export function SecurityCenterPage({ view = 'dashboard' }) {
  const activeView = normalizeView(view);
  const config = VIEW_CONFIG[activeView];
  const [dashboard, setDashboard] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [filters, setFilters] = useState({ range: '24h', keyword: '', actor_type: '', status: '', ip_address: '', risk_level: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const query = useMemo(() => buildQuery(appliedFilters), [appliedFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const jobs = [getSecurityDashboard()];
      if (config?.loader) jobs.push(config.loader(query));
      if (config?.summaryLoader) jobs.push(config.summaryLoader(query));
      const [dashboardResult, dataResult, summaryResult] = await Promise.all(jobs);
      setDashboard(dashboardResult);
      setViewData(dataResult || null);
      setSummary(summaryResult || null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [config, query]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (item) => {
    setSelected(item);
    setDetail(null);
    if (!config?.detailLoader) return;
    setDetailLoading(true);
    try {
      setDetail(await config.detailLoader(item));
    } catch (error) {
      setDetail({ error: error.message, item });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (action, item) => {
    const copy = securityActionCopy(action, item);
    if (copy) {
      setConfirmAction({ action, item, ...copy });
      return;
    }
    await executeSecurityAction(action, item);
  };

  const executeSecurityAction = async (action, item, reasonInput = '') => {
    const reason = reasonInput || 'security_center_action';
    setMessage('');
    try {
      if (action === 'revoke-session') await revokeSecuritySession(item.session_id, reason);
      if (action === 'revoke-session-family') await revokeSecuritySessionFamily(item.session_id, reason);
      if (action === 'revoke-token-family') await revokeTokenFamily(item.token_family_id, reason);
      if (action === 'review-break-glass') await reviewBreakGlass(item.break_glass_access_id, { review_status: 'reviewed', review_note: 'Đã rà soát từ giao diện Trung tâm bảo mật.' });
      if (action === 'revoke-consent') await revokeSecurityConsent(item._id, reason);
      if (action === 'approve-authorization') await approvePatientAuthorization(item._id);
      if (action === 'revoke-authorization') await revokePatientAuthorization(item._id, reason);
      if (action === 'publish-policy') await publishDataAccessPolicy(item._id);
      if (action === 'archive-policy') await archiveDataAccessPolicy(item._id);
      setConfirmAction(null);
      setMessage('Thao tác trong Trung tâm bảo mật đã hoàn tất.');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const items = extractItems(viewData);
  const PageIcon = config?.icon || ShieldAlert;

  return (
    <div className="security-center-page">
      <SecurityHero dashboard={dashboard} loading={loading} onRefresh={load} />
      <SecurityNav activeView={activeView} />
      <FilterBar filters={filters} setFilters={setFilters} loading={loading} onApply={() => setAppliedFilters(filters)} />

      <section className="security-center-command-deck">
        <article>
          <span>Incident command</span>
          <strong>Investigate → Contain → Revoke → Audit</strong>
          <small>Phiên, token family, IP, thiết bị, break-glass và policy đều dùng endpoint backend thật.</small>
        </article>
        <article>
          <span>Data protection</span>
          <strong>Consent + patient authorization + sensitive access</strong>
          <small>Theo dõi truy cập hồ sơ, đồng thuận, ủy quyền người thân và quyết định allow/deny.</small>
        </article>
        <article>
          <span>Realtime readiness</span>
          <strong>{formatNumber(num(dashboard?.summary?.active_sessions))} phiên đang mở</strong>
          <small>Lọc theo 1h/24h/7d/30d, actor, trạng thái, IP để xử lý sự cố ngay trên màn hình.</small>
        </article>
      </section>

      {message ? (
        <section className="security-center-alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}
      <SummaryStrip activeView={activeView} dashboard={dashboard} summary={summary} />

      {activeView === 'dashboard' ? (
        <DashboardView dashboard={dashboard} onSelect={openDetail} />
      ) : activeView === 'bulkRevoke' ? (
        <BulkRevokeWorkbench onExecuted={load} />
      ) : (
        <div className="security-center-content-grid">
          <section className="security-center-panel security-center-panel--wide">
            <div className="security-center-panel__head">
              <div>
                <span>Phân hệ bảo mật</span>
                <h2>{config.title}</h2>
                <p>{config.subtitle}</p>
              </div>
              <PageIcon size={20} aria-hidden="true" />
            </div>
            <DataTable config={config} items={items} loading={loading} onSelect={openDetail} onAction={handleAction} />
          </section>
          <section className="security-center-panel">
            <div className="security-center-panel__head">
              <div>
                <span>Công cụ bằng chứng</span>
                <h2>Điều tra & thao tác</h2>
              </div>
              <SlidersHorizontal size={18} aria-hidden="true" />
            </div>
            <div className="security-center-toolbox">
              <ActionButton icon={RefreshCw} onClick={load}>Làm mới dữ liệu</ActionButton>
              <ActionButton icon={Download}>Xuất bằng chứng</ActionButton>
              <ActionButton icon={FileClock}>Mở audit trail</ActionButton>
              <ActionButton icon={Fingerprint}>Kiểm tra fingerprint</ActionButton>
            </div>
            <JsonBlock value={{ view: activeView, query, pagination: viewData?.pagination }} />
          </section>
          {activeView === 'dataPolicy' ? <DataPolicyWorkbench onCreated={load} /> : null}
        </div>
      )}

      <DetailDrawer item={selected} detail={detail} loading={detailLoading} onClose={() => setSelected(null)} />
      <AdminActionConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        tone={confirmAction?.tone}
        confirmLabel={confirmAction?.confirmLabel}
        details={confirmAction?.details}
        reasonRequired={confirmAction?.reasonRequired}
        submitting={loading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={(reason) => executeSecurityAction(confirmAction.action, confirmAction.item, reason)}
      />
    </div>
  );
}
