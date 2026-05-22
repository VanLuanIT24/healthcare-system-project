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
  { key: 'dashboard', label: 'Dashboard', icon: ShieldAlert },
  { key: 'sessions', label: 'Phiên đăng nhập', icon: RadioTower },
  { key: 'loginHistory', label: 'Login history', icon: History },
  { key: 'suspicious', label: 'Thiết bị / IP', icon: Wifi },
  { key: 'riskyAccounts', label: 'Tài khoản rủi ro', icon: UserLock },
  { key: 'tokenRisk', label: 'Token risk', icon: KeyRound },
  { key: 'rateLimit', label: 'Rate limit', icon: Gauge },
  { key: 'breakGlass', label: 'Break-glass', icon: Vault },
  { key: 'consent', label: 'Consent', icon: FileText },
  { key: 'patientAuthorization', label: 'Ủy quyền bệnh nhân', icon: UsersRound },
  { key: 'accessAuthorization', label: 'Access authorization', icon: ShieldEllipsis },
  { key: 'sensitiveAccess', label: 'Sensitive access', icon: ShieldCheck },
  { key: 'dataPolicy', label: 'Chính sách dữ liệu', icon: LockKeyhole },
  { key: 'bulkRevoke', label: 'Bulk revoke', icon: ShieldBan },
];

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
  return String(value);
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

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items || data.sessions || data.realtime_events || [];
}

function hoursForRange(range) {
  if (range === '1h') return 1;
  if (range === '7d') return 24 * 7;
  if (range === '30d') return 24 * 30;
  return 24;
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
      {level || tone}
      {score !== undefined && score !== null ? ` / ${score}` : ''}
    </span>
  );
}

function StatusBadge({ children, status }) {
  return (
    <span className={`security-center-badge security-center-badge--${statusTone(status || children)}`}>
      {children || 'unknown'}
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
  const label = item.display_name || item.actor_name || item.username || item.actor_id || item.actor_type || 'Không rõ actor';
  return (
    <div className="security-center-actor">
      <strong>{label}</strong>
      <span>{item.actor_type || item.target_type || 'n/a'} / {shortId(item.actor_id || item.target_id)}</span>
    </div>
  );
}

const VIEW_CONFIG = {
  sessions: {
    title: 'Phiên đăng nhập toàn hệ thống',
    subtitle: 'Quản lý session, thiết bị, IP drift, token family và thu hồi phiên khi có incident.',
    icon: RadioTower,
    loader: listSecuritySessions,
    detailLoader: (row) => getSecuritySession(row.session_id),
    columns: [
      { key: 'session', label: 'Session', render: (row) => <strong>{shortId(row.session_id)}</strong> },
      { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
      { key: 'device', label: 'Thiết bị', render: (row) => `${row.device_name || row.browser || 'Unknown'} / ${row.os || 'OS'}` },
      { key: 'ip', label: 'IP', render: (row) => row.last_ip || row.ip_address || row.created_ip || 'n/a' },
      { key: 'token', label: 'Token family', render: (row) => shortId(row.token_family_id) },
      { key: 'risk', label: 'Risk', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.is_active ? 'active' : row.revoked_at ? 'revoked' : 'expired'}>{row.is_active ? 'active' : row.revoked_at ? 'revoked' : 'expired'}</StatusBadge> },
      { key: 'last', label: 'Last used', render: (row) => formatDateTime(row.last_used_at) },
    ],
  },
  loginHistory: {
    title: 'Login history toàn hệ thống',
    subtitle: 'Theo dõi đăng nhập thành công, thất bại, khóa tài khoản và các cụm failed login.',
    icon: History,
    loader: listSecurityLoginHistory,
    summaryLoader: getSecurityLoginSummary,
    columns: [
      { key: 'time', label: 'Thời gian', render: (row) => formatDateTime(row.created_at) },
      { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
      { key: 'action', label: 'Action', render: (row) => row.action },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'n/a' },
      { key: 'message', label: 'Message', render: (row) => row.message || 'n/a' },
      { key: 'request', label: 'Request', render: (row) => shortId(row.request_id) },
    ],
  },
  suspicious: {
    title: 'Thiết bị / IP đáng ngờ',
    subtitle: 'Phân cụm IP, device fingerprint, access denied, token replay và multi-account activity.',
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
      { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.row_type}>{row.row_type === 'device' ? 'Device' : 'IP'}</StatusBadge> },
      { key: 'identity', label: 'Định danh', render: (row) => row.ip_address || row.device_id || 'unknown' },
      { key: 'events', label: 'Events/Sessions', render: (row) => formatNumber(row.events || row.session_count || 0) },
      { key: 'failed', label: 'Failed / Denied', render: (row) => `${formatNumber(row.failed_logins || 0)} / ${formatNumber(row.access_denied || 0)}` },
      { key: 'actors', label: 'Actors', render: (row) => formatNumber(row.distinct_actors || row.actor_count || 0) },
      { key: 'risk', label: 'Risk', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
      { key: 'last', label: 'Last seen', render: (row) => formatDateTime(row.last_seen_at) },
    ],
  },
  riskyAccounts: {
    title: 'Tài khoản có rủi ro',
    subtitle: 'Account bị khóa, disabled nhưng còn session, failed attempts và active session từ nhiều IP.',
    icon: UserLock,
    loader: listRiskyAccounts,
    columns: [
      { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'failed', label: 'Failed attempts', render: (row) => formatNumber(row.failed_login_attempts) },
      { key: 'sessions', label: 'Active sessions', render: (row) => formatNumber(row.active_sessions) },
      { key: 'ip', label: 'Last IP', render: (row) => row.last_login_ip || 'n/a' },
      { key: 'locked', label: 'Locked until', render: (row) => formatDateTime(row.locked_until) },
      { key: 'risk', label: 'Risk', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
    ],
  },
  tokenRisk: {
    title: 'Token / refresh token risk',
    subtitle: 'Theo dõi token family, refresh rotation, replay, revoke family và forced logout.',
    icon: KeyRound,
    loader: listTokenFamilies,
    detailLoader: (row) => getTokenFamily(row.token_family_id),
    columns: [
      { key: 'family', label: 'Token family', render: (row) => <strong>{shortId(row.token_family_id)}</strong> },
      { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
      { key: 'sessions', label: 'Sessions', render: (row) => `${formatNumber(row.active_sessions)} active / ${formatNumber(row.session_count)} total` },
      { key: 'rotation', label: 'Rotations', render: (row) => formatNumber(row.rotation_count) },
      { key: 'replay', label: 'Replay', render: (row) => formatNumber(row.replay_count) },
      { key: 'risk', label: 'Risk', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
      { key: 'last', label: 'Last rotated', render: (row) => formatDateTime(row.last_rotated_at) },
    ],
  },
  rateLimit: {
    title: 'Rate limit events',
    subtitle: 'Các request bị chặn do vượt tần suất, scope, bucket, endpoint và IP liên quan.',
    icon: Gauge,
    loader: listRateLimitEvents,
    columns: [
      { key: 'time', label: 'Blocked at', render: (row) => formatDateTime(row.blocked_at) },
      { key: 'scope', label: 'Scope', render: (row) => row.scope },
      { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
      { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'n/a' },
      { key: 'path', label: 'Path', render: (row) => row.path || 'n/a' },
      { key: 'limit', label: 'Limit', render: (row) => `${row.limit || 'n/a'} / ${Math.round((row.window_ms || 0) / 1000)}s` },
      { key: 'retry', label: 'Retry after', render: (row) => `${row.retry_after_seconds || 0}s` },
    ],
  },
  breakGlass: {
    title: 'Break-glass access',
    subtitle: 'Kiểm soát truy cập khẩn cấp, duration, review status, audit evidence và escalation.',
    icon: Vault,
    loader: listBreakGlassAccess,
    columns: [
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'patient', label: 'Patient', render: (row) => shortId(row.patient_id) },
      { key: 'staff', label: 'Accessed by', render: (row) => row.accessed_by_user_id?.full_name || shortId(row.accessed_by_user_id?._id || row.accessed_by_user_id) },
      { key: 'reason', label: 'Reason', render: (row) => row.reason || 'Thiếu lý do' },
      { key: 'duration', label: 'Duration', render: (row) => `${formatNumber(row.duration_minutes)} phút` },
      { key: 'review', label: 'Review', render: (row) => <StatusBadge status={row.review_status}>{row.review_status}</StatusBadge> },
      { key: 'risk', label: 'Risk', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
    ],
  },
  consent: {
    title: 'Consent toàn hệ thống',
    subtitle: 'Consent còn hiệu lực, hết hạn, bị thu hồi, thiếu attachment hoặc cần rà soát.',
    icon: FileText,
    loader: listSecurityConsents,
    columns: [
      { key: 'patient', label: 'Patient', render: (row) => shortId(row.patient_id) },
      { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
      { key: 'type', label: 'Consent type', render: (row) => row.consent_type },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'signed', label: 'Signed', render: (row) => formatDateTime(row.signed_at) },
      { key: 'expires', label: 'Expires', render: (row) => formatDateTime(row.expires_at) },
      { key: 'document', label: 'Document', render: (row) => shortId(row.document_attachment_id) },
    ],
  },
  patientAuthorization: {
    title: 'Patient authorization',
    subtitle: 'Ủy quyền người thân, quyền được cấp, hiệu lực và revoke session tự động khi thu hồi.',
    icon: UsersRound,
    loader: listSecurityPatientAuthorizations,
    columns: [
      { key: 'patient', label: 'Patient', render: (row) => shortId(row.patient_id) },
      { key: 'relative', label: 'Relative', render: (row) => shortId(row.relative_id) },
      { key: 'type', label: 'Type', render: (row) => row.authorization_type },
      { key: 'permissions', label: 'Permissions', render: (row) => formatValue(row.permissions) },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'valid', label: 'Valid to', render: (row) => formatDateTime(row.valid_to) },
      { key: 'revoked', label: 'Revoked', render: (row) => formatDateTime(row.revoked_at) },
    ],
  },
  accessAuthorization: {
    title: 'Access authorization',
    subtitle: 'Mọi quyết định truy cập bị deny hoặc sensitive granted được gom từ audit security.',
    icon: ShieldEllipsis,
    loader: listAccessDecisions,
    columns: [
      { key: 'time', label: 'Time', render: (row) => formatDateTime(row.created_at) },
      { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
      { key: 'action', label: 'Action', render: (row) => row.action },
      { key: 'route', label: 'Route', render: (row) => row.metadata?.path || row.target_type || 'n/a' },
      { key: 'decision', label: 'Decision', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'severity', label: 'Severity', render: (row) => <StatusBadge status={row.severity}>{row.severity}</StatusBadge> },
      { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'n/a' },
    ],
  },
  sensitiveAccess: {
    title: 'Sensitive access events',
    subtitle: 'Medical record, attachment, lab, imaging, prescription, invoice và relative access.',
    icon: ShieldCheck,
    loader: listSensitiveAccessEvents,
    columns: [
      { key: 'time', label: 'Time', render: (row) => formatDateTime(row.created_at) },
      { key: 'action', label: 'Action', render: (row) => row.action },
      { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
      { key: 'target', label: 'Target', render: (row) => `${row.target_type || 'target'} / ${shortId(row.target_id)}` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'severity', label: 'Severity', render: (row) => <StatusBadge status={row.severity}>{row.severity}</StatusBadge> },
      { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'n/a' },
    ],
  },
  dataPolicy: {
    title: 'Chính sách truy cập dữ liệu',
    subtitle: 'Policy động cho sensitive data, consent requirement, break-glass, audit và retention.',
    icon: LockKeyhole,
    loader: listDataAccessPolicies,
    columns: [
      { key: 'policy', label: 'Policy', render: (row) => <strong>{row.policy_key}</strong> },
      { key: 'resource', label: 'Resource / Action', render: (row) => `${row.resource_type} / ${row.action}` },
      { key: 'permissions', label: 'Required permissions', render: (row) => formatValue(row.required_permissions) },
      { key: 'consent', label: 'Consent', render: (row) => row.require_consent ? 'Required' : 'No' },
      { key: 'break', label: 'Break-glass', render: (row) => row.allow_break_glass ? 'Allowed' : 'Blocked' },
      { key: 'audit', label: 'Audit', render: (row) => row.audit_required ? 'Required' : 'Optional' },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
    ],
  },
};

function SecurityHero({ dashboard, loading, onRefresh }) {
  const score = dashboard?.security_score ?? 0;
  const summary = dashboard?.summary || {};
  return (
    <section className={`security-center-hero security-center-hero--${riskTone(dashboard?.risk_level, 100 - score)}`}>
      <div className="security-center-hero__score">
        <ShieldAlert size={26} aria-hidden="true" />
        <strong>{score}</strong>
        <span>Security score</span>
      </div>
      <div className="security-center-hero__copy">
        <div className="security-center-kicker">Quản trị hệ thống / Security Center</div>
        <h1>Security Command Center</h1>
        <p>
          Trung tâm điều tra phiên, login risk, token replay, break-glass, consent, patient authorization và sensitive access.
        </p>
        <div className="security-center-hero__meta">
          <RiskBadge level={dashboard?.risk_level || 'low'} score={100 - score} />
          <span>Active sessions: {formatNumber(summary.active_sessions)}</span>
          <span>Critical alerts: {formatNumber(summary.token_replay_events_24h + summary.active_break_glass)}</span>
          <span>Last refresh: {formatDateTime(new Date())}</span>
        </div>
      </div>
      <div className="security-center-hero__actions">
        <ActionButton icon={RefreshCw} onClick={onRefresh} disabled={loading}>
          {loading ? 'Đang tải' : 'Refresh'}
        </ActionButton>
        <ActionButton icon={Download}>Export</ActionButton>
        <ActionButton icon={Ban} tone="danger">Emergency lockdown</ActionButton>
      </div>
    </section>
  );
}

function SecurityNav({ activeView }) {
  return (
    <nav className="security-center-nav" aria-label="Security Center">
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
          <option value="">Mọi actor</option>
          <option value="staff">Staff</option>
          <option value="patient">Patient</option>
          <option value="patient_relative">Relative</option>
          <option value="anonymous">Anonymous</option>
        </select>
      </label>
      <label>
        <Activity size={15} aria-hidden="true" />
        <select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}>
          <option value="">Mọi trạng thái</option>
          <option value="active">Active</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="revoked">Revoked</option>
          <option value="locked">Locked</option>
          <option value="expired">Expired</option>
        </select>
      </label>
      <label>
        <Network size={15} aria-hidden="true" />
        <input value={filters.ip_address} placeholder="IP" onChange={(event) => setFilters((value) => ({ ...value, ip_address: event.target.value }))} />
      </label>
      <label className="security-center-filter__search">
        <Search size={15} aria-hidden="true" />
        <input value={filters.keyword} placeholder="Tìm action, request, device..." onChange={(event) => setFilters((value) => ({ ...value, keyword: event.target.value }))} />
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
    { icon: RadioTower, label: 'Active sessions', value: data.active_sessions, note: `${formatNumber(data.active_staff_sessions)} staff / ${formatNumber(data.active_patient_sessions)} patient`, tone: 'blue' },
    { icon: AlertTriangle, label: 'Failed login 24h', value: data.failed_logins_24h, note: 'Burst login monitor', tone: 'amber' },
    { icon: UserLock, label: 'Locked accounts', value: data.locked_accounts, note: 'Staff + patient', tone: 'red' },
    { icon: KeyRound, label: 'Token replay 24h', value: data.token_replay_events_24h, note: 'Refresh token reuse', tone: 'red' },
    { icon: ShieldEllipsis, label: 'Access denied 24h', value: data.access_denied_24h, note: 'Route guard denied', tone: 'amber' },
    { icon: Vault, label: 'Break-glass active', value: data.active_break_glass, note: 'Pending compliance review', tone: 'purple' },
    { icon: ShieldCheck, label: 'Sensitive access', value: data.sensitive_access_24h, note: '24h audit events', tone: 'green' },
    { icon: Gauge, label: 'Rate limited', value: data.rate_limit_blocked_24h, note: 'Blocked requests', tone: 'slate' },
  ];

  if (activeView === 'loginHistory' && summary) {
    cards.splice(0, 3,
      { icon: CheckCircle2, label: 'Login success', value: summary.success, note: 'Theo filter hiện tại', tone: 'green' },
      { icon: XCircle, label: 'Login failed', value: summary.failed, note: `${Math.round((summary.failed_rate || 0) * 100)}% failed rate`, tone: 'red' },
      { icon: UserLock, label: 'Account locked', value: summary.locked, note: 'Do failed attempts', tone: 'amber' });
  }

  return (
    <section className="security-center-metrics">
      {cards.map((item) => <MetricCard key={item.label} {...item} value={formatNumber(item.value || 0)} />)}
    </section>
  );
}

function DashboardView({ dashboard, onSelect }) {
  const events = dashboard?.realtime_events || [];
  const ips = dashboard?.top_suspicious_ips || [];
  const accounts = dashboard?.top_risky_accounts || [];
  const recommendedActions = dashboard?.recommended_actions || [];

  return (
    <div className="security-center-dashboard">
      <section className="security-center-panel security-center-panel--wide">
        <div className="security-center-panel__head">
          <div>
            <span>Realtime stream</span>
            <h2>Sự kiện bảo mật gần đây</h2>
          </div>
          <StatusBadge status="active">Live</StatusBadge>
        </div>
        <div className="security-center-stream">
          {events.length ? events.map((event) => (
            <button key={itemId(event)} type="button" onClick={() => onSelect(event)}>
              <span className={`security-center-dot security-center-dot--${statusTone(event.severity || event.status)}`} />
              <strong>{event.action}</strong>
              <small>{event.message || event.ip_address || 'Security event'}</small>
              <time>{formatDateTime(event.created_at)}</time>
            </button>
          )) : <EmptyState title="Chưa có security event" note="Audit stream sẽ xuất hiện khi backend ghi log auth/access/security." />}
        </div>
      </section>

      <section className="security-center-panel">
        <div className="security-center-panel__head">
          <div>
            <span>Recommended actions</span>
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
            <span>IP intelligence</span>
            <h2>IP rủi ro cao</h2>
          </div>
          <Wifi size={18} aria-hidden="true" />
        </div>
        <MiniList items={ips} primary={(item) => item.ip_address} secondary={(item) => `${formatNumber(item.failed_logins)} failed / ${formatNumber(item.access_denied)} denied`} onSelect={onSelect} />
      </section>

      <section className="security-center-panel">
        <div className="security-center-panel__head">
          <div>
            <span>Risk accounts</span>
            <h2>Tài khoản cần rà soát</h2>
          </div>
          <UserLock size={18} aria-hidden="true" />
        </div>
        <MiniList items={accounts} primary={(item) => item.display_name || item.username || item.actor_id} secondary={(item) => `${item.actor_type} / ${item.status} / ${formatNumber(item.failed_login_attempts)} failed`} onSelect={onSelect} />
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
            <th>Actions</th>
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
        <button type="button" onClick={() => onAction('revoke-session', item)} title="Revoke session"><LogOut size={15} aria-hidden="true" /></button>
        {item.token_family_id ? <button type="button" onClick={() => onAction('revoke-session-family', item)} title="Revoke token family"><KeyRound size={15} aria-hidden="true" /></button> : null}
      </>
    );
  }
  if (item.token_family_id) return <button type="button" onClick={() => onAction('revoke-token-family', item)} title="Revoke family"><ShieldBan size={15} aria-hidden="true" /></button>;
  if (item.break_glass_access_id) return <button type="button" onClick={() => onAction('review-break-glass', item)} title="Mark reviewed"><CheckCircle2 size={15} aria-hidden="true" /></button>;
  if (item.consent_type && item.status === 'active') return <button type="button" onClick={() => onAction('revoke-consent', item)} title="Revoke consent"><Ban size={15} aria-hidden="true" /></button>;
  if (item.authorization_type && item.status === 'pending') return <button type="button" onClick={() => onAction('approve-authorization', item)} title="Approve"><CheckCircle2 size={15} aria-hidden="true" /></button>;
  if (item.authorization_type && item.status === 'active') return <button type="button" onClick={() => onAction('revoke-authorization', item)} title="Revoke authorization"><Ban size={15} aria-hidden="true" /></button>;
  if (item.policy_key && item._id) {
    return (
      <>
        <button type="button" onClick={() => onAction('publish-policy', item)} title="Publish policy"><Play size={15} aria-hidden="true" /></button>
        <button type="button" onClick={() => onAction('archive-policy', item)} title="Archive policy"><Archive size={15} aria-hidden="true" /></button>
      </>
    );
  }
  return null;
}

function DetailDrawer({ item, detail, loading, onClose }) {
  if (!item) return null;
  const payload = detail || item;
  return (
    <aside className="security-center-drawer" aria-label="Security detail">
      <div className="security-center-drawer__head">
        <div>
          <span>Security evidence</span>
          <h2>{payload.session?.session_id ? shortId(payload.session.session_id) : shortId(itemId(item))}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng detail">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {loading ? (
        <section className="security-center-state">
          <RefreshCw size={18} aria-hidden="true" />
          <span>Đang tải detail...</span>
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
              <h3>Actor profile</h3>
              <JsonBlock value={payload.actor} />
            </section>
          ) : null}
          {payload.token_family || payload.sessions ? (
            <section>
              <h3>Token family</h3>
              <JsonBlock value={payload.token_family || payload.sessions} />
            </section>
          ) : null}
          {payload.audit_logs ? (
            <section>
              <h3>Audit evidence</h3>
              <div className="security-center-evidence">
                {payload.audit_logs.map((log) => (
                  <article key={itemId(log)}>
                    <strong>{log.action}</strong>
                    <span>{log.message || log.status}</span>
                    <time>{formatDateTime(log.created_at)}</time>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h3>Raw JSON</h3>
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
          <span>Policy editor</span>
          <h2>Tạo data access policy</h2>
        </div>
        <LockKeyhole size={18} aria-hidden="true" />
      </div>
      <div className="security-center-policy-form">
        <label>
          <span>Policy key</span>
          <input value={form.policy_key} onChange={(event) => setForm((value) => ({ ...value, policy_key: event.target.value }))} placeholder="medical_record.view" />
        </label>
        <label>
          <span>Resource</span>
          <input value={form.resource_type} onChange={(event) => setForm((value) => ({ ...value, resource_type: event.target.value }))} />
        </label>
        <label>
          <span>Action</span>
          <input value={form.action} onChange={(event) => setForm((value) => ({ ...value, action: event.target.value }))} />
        </label>
        <label>
          <span>Required permissions</span>
          <input value={form.required_permissions} onChange={(event) => setForm((value) => ({ ...value, required_permissions: event.target.value }))} placeholder="medical_records.read, attachments.download" />
        </label>
        <label>
          <span>Denied roles</span>
          <input value={form.denied_roles} onChange={(event) => setForm((value) => ({ ...value, denied_roles: event.target.value }))} placeholder="guest, intern" />
        </label>
        <label>
          <span>Retention days</span>
          <input type="number" value={form.retention_days} onChange={(event) => setForm((value) => ({ ...value, retention_days: event.target.value }))} />
        </label>
        {['require_consent', 'require_patient_authorization', 'allow_break_glass', 'audit_required', 'review_required'].map((key) => (
          <label key={key} className="security-center-checkbox">
            <input type="checkbox" checked={Boolean(form[key])} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.checked }))} />
            <span>{key}</span>
          </label>
        ))}
        <ActionButton icon={Play} onClick={submit} disabled={saving || !form.policy_key} tone="primary">
          {saving ? 'Đang tạo' : 'Tạo draft policy'}
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
            <span>Incident action</span>
            <h2>Thu hồi phiên hàng loạt</h2>
          </div>
          <ShieldBan size={18} aria-hidden="true" />
        </div>
        <div className="security-center-bulk-form">
          <label>
            <span>Actor type</span>
            <select value={scope.actor_type} onChange={(event) => updateScope('actor_type', event.target.value)}>
              <option value="">Mọi actor</option>
              <option value="staff">Staff</option>
              <option value="patient">Patient</option>
              <option value="patient_relative">Relative</option>
            </select>
          </label>
          <label>
            <span>Actor ID</span>
            <input value={scope.actor_id} onChange={(event) => updateScope('actor_id', event.target.value)} placeholder="ObjectId" />
          </label>
          <label>
            <span>IP address</span>
            <input value={scope.ip_address} onChange={(event) => updateScope('ip_address', event.target.value)} placeholder="10.0.0.1" />
          </label>
          <label>
            <span>Device ID</span>
            <input value={scope.device_id} onChange={(event) => updateScope('device_id', event.target.value)} />
          </label>
          <label>
            <span>Token family</span>
            <input value={scope.token_family_id} onChange={(event) => updateScope('token_family_id', event.target.value)} />
          </label>
          <label>
            <span>Status</span>
            <select value={scope.status} onChange={(event) => updateScope('status', event.target.value)}>
              <option value="active">Active only</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
              <option value="">All</option>
            </select>
          </label>
          <label className="security-center-bulk-form__reason">
            <span>Reason bắt buộc</span>
            <textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="suspected_compromise / incident code / điều tra..." />
          </label>
          <div className="security-center-bulk-form__actions">
            <ActionButton icon={Eye} onClick={previewAction} disabled={loading}>Preview</ActionButton>
            <ActionButton icon={ShieldBan} onClick={executeAction} disabled={loading || !reason || !preview} tone="danger">Execute revoke</ActionButton>
          </div>
          {message ? <p className="security-center-message">{message}</p> : null}
        </div>
      </section>
      <section className="security-center-panel security-center-panel--wide">
        <div className="security-center-panel__head">
          <div>
            <span>Impact preview</span>
            <h2>Phiên bị ảnh hưởng</h2>
          </div>
          <StatusBadge status={preview?.warnings?.length ? 'warning' : 'success'}>
            {preview ? `${formatNumber(preview.matched_sessions)} sessions` : 'Chưa preview'}
          </StatusBadge>
        </div>
        {preview ? (
          <>
            <div className="security-center-impact">
              <article><span>Affected actors</span><strong>{formatNumber(preview.affected_actors)}</strong></article>
              <article><span>Matched sessions</span><strong>{formatNumber(preview.matched_sessions)}</strong></article>
              <article><span>Revoked count</span><strong>{formatNumber(preview.revoked_count || 0)}</strong></article>
            </div>
            {preview.warnings?.length ? (
              <div className="security-center-recommendations">
                {preview.warnings.map((warning) => <article key={warning}><AlertTriangle size={16} /><span>{warning}</span></article>)}
              </div>
            ) : null}
            <DataTable config={VIEW_CONFIG.sessions} items={preview.items || []} loading={false} onSelect={() => {}} onAction={() => {}} />
          </>
        ) : <EmptyState title="Chưa có preview" note="Nhập scope và bấm Preview trước khi execute revoke." />}
      </section>
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
    const reason = 'security_center_action';
    setMessage('');
    try {
      if (action === 'revoke-session') await revokeSecuritySession(item.session_id, reason);
      if (action === 'revoke-session-family') await revokeSecuritySessionFamily(item.session_id, reason);
      if (action === 'revoke-token-family') await revokeTokenFamily(item.token_family_id, reason);
      if (action === 'review-break-glass') await reviewBreakGlass(item.break_glass_access_id, { review_status: 'reviewed', review_note: 'Reviewed from Security Center UI.' });
      if (action === 'revoke-consent') await revokeSecurityConsent(item._id, reason);
      if (action === 'approve-authorization') await approvePatientAuthorization(item._id);
      if (action === 'revoke-authorization') await revokePatientAuthorization(item._id, reason);
      if (action === 'publish-policy') await publishDataAccessPolicy(item._id);
      if (action === 'archive-policy') await archiveDataAccessPolicy(item._id);
      setMessage('Thao tác Security Center đã hoàn tất.');
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
                <span>{activeView}</span>
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
                <span>Evidence tools</span>
                <h2>Điều tra & thao tác</h2>
              </div>
              <SlidersHorizontal size={18} aria-hidden="true" />
            </div>
            <div className="security-center-toolbox">
              <ActionButton icon={RefreshCw} onClick={load}>Refresh data</ActionButton>
              <ActionButton icon={Download}>Export evidence</ActionButton>
              <ActionButton icon={FileClock}>Open audit trail</ActionButton>
              <ActionButton icon={Fingerprint}>Inspect fingerprint</ActionButton>
            </div>
            <JsonBlock value={{ view: activeView, query, pagination: viewData?.pagination }} />
          </section>
          {activeView === 'dataPolicy' ? <DataPolicyWorkbench onCreated={load} /> : null}
        </div>
      )}

      <DetailDrawer item={selected} detail={detail} loading={detailLoading} onClose={() => setSelected(null)} />
    </div>
  );
}
