import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Archive,
  Banknote,
  CheckCircle2,
  Clock3,
  CloudUpload,
  Database,
  Download,
  Eye,
  FileClock,
  FileText,
  Fingerprint,
  GitCompare,
  HeartPulse,
  History,
  ListFilter,
  LockKeyhole,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  Vault,
  X,
  XCircle,
} from 'lucide-react';
import { AdminActionConfirmDialog } from '../../components/AdminActionConfirmDialog';
import { formatDateTime, formatNumber } from '../../system/systemUi';
import {
  createAuditExport,
  generateComplianceReport,
  getActorAudit,
  getAuditFacets,
  getAuditLogDetail,
  getAuditSummary,
  getBillingSummary,
  getBreakGlassSummary,
  getBreakGlassTimeline,
  getComplianceDashboard,
  getEntityAudit,
  getIamSummary,
  getPatientAccessSummary,
  getPatientAccessTimeline,
  getRequestTimeline,
  getSensitiveAccessSummary,
  getSensitiveRiskQueue,
  getSessionTimeline,
  getSettingsSummary,
  listAuditExports,
  listAuditLogs,
  listBillingAudit,
  listBreakGlassAudit,
  listComplianceReports,
  listIamAudit,
  listSensitiveAccess,
  listSettingsAudit,
  previewAuditExportCount,
  previewAuditExportSample,
  reviewBreakGlass,
  reviewSensitiveAccess,
} from '../auditComplianceApi';

const VIEW_PATHS = {
  auditLog: '/admin/audit-compliance/audit-log',
  actor: '/admin/audit-compliance/actor',
  user: '/admin/audit-compliance/user',
  object: '/admin/audit-compliance/object',
  medicalRecord: '/admin/audit-compliance/medical-record',
  iam: '/admin/audit-compliance/iam',
  systemConfig: '/admin/audit-compliance/system-config',
  payment: '/admin/audit-compliance/payment',
  sensitiveAccess: '/admin/audit-compliance/sensitive-access',
  breakGlass: '/admin/audit-compliance/break-glass',
  exportAudit: '/admin/audit-compliance/export',
  reports: '/admin/audit-compliance/reports',
};

const NAV_ITEMS = [
  { key: 'auditLog', label: 'Nhật ký audit', icon: FileClock },
  { key: 'actor', label: 'Theo actor', icon: UserRound },
  { key: 'user', label: 'Theo người dùng', icon: UsersRound },
  { key: 'object', label: 'Theo đối tượng', icon: Database },
  { key: 'medicalRecord', label: 'Hồ sơ bệnh án', icon: FileText },
  { key: 'iam', label: 'Phân quyền', icon: ShieldCheck },
  { key: 'systemConfig', label: 'Cấu hình hệ thống', icon: Settings },
  { key: 'payment', label: 'Thanh toán', icon: Banknote },
  { key: 'sensitiveAccess', label: 'Truy cập nhạy cảm', icon: ShieldAlert },
  { key: 'breakGlass', label: 'Truy cập khẩn cấp', icon: Vault },
  { key: 'exportAudit', label: 'Xuất audit', icon: CloudUpload },
  { key: 'reports', label: 'Báo cáo tuân thủ', icon: FileText },
];

const VALUE_LABELS = {
  success: 'Thành công',
  active: 'Đang hoạt động',
  completed: 'Hoàn tất',
  generated: 'Đã tạo',
  legitimate: 'Hợp lệ',
  reviewed: 'Đã rà soát',
  approved: 'Đã duyệt',
  warning: 'Cảnh báo',
  pending: 'Chờ xử lý',
  queued: 'Trong hàng đợi',
  running: 'Đang chạy',
  pending_review: 'Chờ rà soát',
  expired: 'Hết hạn',
  failure: 'Lỗi',
  failed: 'Lỗi',
  critical: 'Nghiêm trọng',
  error: 'Lỗi',
  revoked: 'Đã thu hồi',
  suspicious: 'Đáng ngờ',
  escalated: 'Đã nâng cấp',
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  staff: 'Nhân sự',
  patient: 'Bệnh nhân',
  patient_relative: 'Người thân',
  system: 'Hệ thống',
  service_account: 'Service account',
  sensitive_access: 'Truy cập nhạy cảm',
  break_glass: 'Truy cập khẩn cấp',
};

function normalizeView(view) {
  return VIEW_PATHS[view] ? view : 'auditLog';
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
  return VALUE_LABELS[String(value).toLowerCase()] || String(value).replace(/_/g, ' ');
}

function itemId(item = {}) {
  return item.audit_log_id || item.break_glass_access_id || item._id || item.request_id || item.session_id || item.checksum || JSON.stringify(item).slice(0, 90);
}

function hoursForRange(range) {
  if (range === '1h') return 1;
  if (range === '7d') return 24 * 7;
  if (range === '30d') return 24 * 30;
  if (range === '90d') return 24 * 90;
  return 24;
}

function buildQuery(filters) {
  const from = new Date(Date.now() - hoursForRange(filters.range) * 60 * 60 * 1000).toISOString();
  return {
    limit: 50,
    date_from: from,
    keyword: filters.keyword,
    actor_type: filters.actor_type,
    actor_id: filters.actor_id,
    target_type: filters.target_type,
    target_id: filters.target_id,
    module_key: filters.module_key,
    action: filters.action,
    action_prefix: filters.action_prefix,
    status: filters.status,
    severity: filters.severity,
    request_id: filters.request_id,
    session_id: filters.session_id,
    ip_address: filters.ip_address,
    patient_id: filters.patient_id,
  };
}

function statusTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (['success', 'active', 'completed', 'generated', 'legitimate', 'reviewed', 'approved'].includes(normalized)) return 'success';
  if (['warning', 'pending', 'queued', 'running', 'pending_review', 'expired'].includes(normalized)) return 'warning';
  if (['failure', 'failed', 'critical', 'error', 'revoked', 'suspicious', 'escalated'].includes(normalized)) return 'danger';
  return 'muted';
}

function riskTone(level, score) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'critical' || Number(score) >= 85) return 'critical';
  if (normalized === 'high' || Number(score) >= 65) return 'high';
  if (normalized === 'medium' || Number(score) >= 35) return 'medium';
  return 'low';
}

function StatusBadge({ children, status }) {
  return <span className={`audit-compliance-badge audit-compliance-badge--${statusTone(status || children)}`}>{formatValue(children || status || 'n/a')}</span>;
}

function RiskBadge({ level, score }) {
  return <span className={`audit-compliance-badge audit-compliance-badge--${riskTone(level, score)}`}>{formatValue(level || riskTone(level, score))}{score !== undefined ? ` / ${score}` : ''}</span>;
}

function ActionButton({ icon: Icon, children, tone = 'neutral', ...props }) {
  return (
    <button type="button" className={`audit-compliance-action audit-compliance-action--${tone}`} {...props}>
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone = 'blue' }) {
  return (
    <article className={`audit-compliance-metric audit-compliance-metric--${tone}`}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function JsonBlock({ value }) {
  return <pre className="audit-compliance-json">{JSON.stringify(value || {}, null, 2)}</pre>;
}

function ActorCell({ item = {} }) {
  return (
    <div className="audit-compliance-actor">
      <strong>{item.actor_name || formatValue(item.actor_type || 'system')}</strong>
      <span>{formatValue(item.actor_type || 'system')} / {shortId(item.actor_id)}</span>
    </div>
  );
}

function buildAuditColumns() {
  return [
    { key: 'time', label: 'Thời gian', render: (row) => formatDateTime(row.created_at) },
    { key: 'severity', label: 'Mức độ', render: (row) => <StatusBadge status={row.severity}>{row.severity}</StatusBadge> },
    { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
    { key: 'actor', label: 'Đối tượng', render: (row) => <ActorCell item={row} /> },
    { key: 'action', label: 'Hành động', render: (row) => <strong>{formatValue(row.action)}</strong> },
    { key: 'module', label: 'Module', render: (row) => row.module_key || String(row.action || '').split('.')[0] },
    { key: 'target', label: 'Đích', render: (row) => `${formatValue(row.target_type || 'system')} / ${shortId(row.target_id)}` },
    { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'n/a' },
    { key: 'risk', label: 'Rủi ro', render: (row) => row.risk_score !== undefined ? <RiskBadge level={row.risk_level} score={row.risk_score} /> : <StatusBadge status="muted">n/a</StatusBadge> },
  ];
}

const AUDIT_COLUMNS = buildAuditColumns();

const VIEW_CONFIG = {
  auditLog: {
    title: 'Nhật ký audit',
    subtitle: 'Bảng audit tổng hợp với bộ lọc động, xem diff, timeline request/session và ngăn bằng chứng.',
    icon: FileClock,
    loader: listAuditLogs,
    summaryLoader: getAuditSummary,
    columns: AUDIT_COLUMNS,
  },
  actor: {
    title: 'Audit theo actor',
    subtitle: 'Điều tra hành vi theo nhân sự, bệnh nhân, người thân, hệ thống hoặc service account.',
    icon: UserRound,
    loader: async (query) => query.actor_type && query.actor_id ? getActorAudit(query.actor_type, query.actor_id, query) : listAuditLogs(query),
    summaryLoader: getAuditSummary,
    columns: AUDIT_COLUMNS,
  },
  user: {
    title: 'Audit theo người dùng',
    subtitle: 'Tập trung lịch sử đăng nhập, ngữ cảnh phiên, thay đổi IAM, truy cập nhạy cảm và export/download của một tài khoản.',
    icon: UsersRound,
    loader: async (query) => query.actor_type && query.actor_id ? getActorAudit(query.actor_type, query.actor_id, query) : listAuditLogs(query),
    summaryLoader: getAuditSummary,
    columns: AUDIT_COLUMNS,
  },
  object: {
    title: 'Audit theo đối tượng',
    subtitle: 'Timeline và lịch sử diff quanh bệnh nhân, hóa đơn, encounter, vai trò, system_setting hoặc đối tượng bất kỳ.',
    icon: Database,
    loader: async (query) => query.target_type && query.target_id ? getEntityAudit(query.target_type, query.target_id, query) : listAuditLogs(query),
    summaryLoader: getAuditSummary,
    columns: AUDIT_COLUMNS,
  },
  medicalRecord: {
    title: 'Audit hồ sơ bệnh án',
    subtitle: 'Timeline truy cập bệnh nhân: ai xem hồ sơ, tải gì, lý do, đồng thuận, ủy quyền và truy cập khẩn cấp.',
    icon: FileText,
    loader: async (query) => query.patient_id ? getPatientAccessTimeline(query.patient_id, query) : listSensitiveAccess({ ...query, action_prefix: undefined }),
    summaryLoader: async (query) => query.patient_id ? getPatientAccessSummary(query.patient_id, query) : getSensitiveAccessSummary(query),
    columns: AUDIT_COLUMNS,
  },
  iam: {
    title: 'Audit phân quyền',
    subtitle: 'Vai trò, quyền, gán user-role, deny policy, cache quyền và lịch sử từ chối truy cập.',
    icon: ShieldCheck,
    loader: listIamAudit,
    summaryLoader: getIamSummary,
    columns: AUDIT_COLUMNS,
  },
  systemConfig: {
    title: 'Audit cấu hình hệ thống',
    subtitle: 'Theo dõi SystemSetting, clinical_config, cấu hình nhạy cảm, rollback và thay đổi cần rà soát.',
    icon: Settings,
    loader: listSettingsAudit,
    summaryLoader: getSettingsSummary,
    columns: AUDIT_COLUMNS,
  },
  payment: {
    title: 'Audit thanh toán',
    subtitle: 'Charge, hóa đơn, payment intent, webhook, biên nhận, hoàn tiền, hủy và bằng chứng đối soát.',
    icon: Banknote,
    loader: listBillingAudit,
    summaryLoader: getBillingSummary,
    columns: AUDIT_COLUMNS,
  },
  sensitiveAccess: {
    title: 'Audit truy cập nhạy cảm',
    subtitle: 'Hàng đợi rủi ro cho hồ sơ y tế, tệp đính kèm, xét nghiệm, chẩn đoán hình ảnh, đơn thuốc, hóa đơn và truy cập người thân.',
    icon: ShieldAlert,
    loader: listSensitiveAccess,
    summaryLoader: getSensitiveAccessSummary,
    sideLoader: getSensitiveRiskQueue,
    columns: AUDIT_COLUMNS,
  },
  breakGlass: {
    title: 'Audit truy cập khẩn cấp',
    subtitle: 'Kiểm soát truy cập khẩn cấp đang mở/đã kết thúc, chờ rà soát, timeline bằng chứng và quyết định tuân thủ.',
    icon: Vault,
    loader: listBreakGlassAudit,
    summaryLoader: getBreakGlassSummary,
    detailLoader: (row) => getBreakGlassTimeline(row.break_glass_access_id),
    columns: [
      { key: 'patient', label: 'Bệnh nhân', render: (row) => shortId(row.patient_id) },
      { key: 'staff', label: 'Nhân sự', render: (row) => row.accessed_by_user_id?.full_name || shortId(row.accessed_by_user_id?._id || row.accessed_by_user_id) },
      { key: 'reason', label: 'Lý do', render: (row) => row.reason || 'Thiếu lý do' },
      { key: 'started', label: 'Bắt đầu', render: (row) => formatDateTime(row.started_at) },
      { key: 'duration', label: 'Thời lượng', render: (row) => `${formatNumber(row.duration_minutes || 0)} phút` },
      { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'review', label: 'Rà soát', render: (row) => <StatusBadge status={row.review_status}>{row.review_status}</StatusBadge> },
      { key: 'risk', label: 'Rủi ro', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
    ],
  },
};

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items || [];
}

function ComplianceHero({ dashboard, loading, onRefresh }) {
  const score = dashboard?.compliance_score ?? 0;
  const metrics = dashboard?.metrics || {};
  return (
    <section className={`audit-compliance-hero audit-compliance-hero--${riskTone(dashboard?.risk_level, 100 - score)}`}>
      <div className="audit-compliance-hero__score">
        <FileClock size={26} aria-hidden="true" />
        <strong>{score}</strong>
        <span>Điểm tuân thủ</span>
      </div>
      <div className="audit-compliance-hero__copy">
        <div className="audit-compliance-kicker">Quản trị hệ thống / Audit & Tuân thủ</div>
        <h1>Trung tâm audit & tuân thủ</h1>
        <p>Điều tra audit, truy vết actor/object/bệnh nhân, rà soát truy cập nhạy cảm và truy cập khẩn cấp, tạo gói bằng chứng và báo cáo tuân thủ.</p>
        <div className="audit-compliance-hero__meta">
          <RiskBadge level={dashboard?.risk_level || 'low'} score={100 - score} />
          <span>Sự kiện audit: {formatNumber(metrics.audit_events)}</span>
          <span>Chờ rà soát: {formatNumber(metrics.pending_reviews)}</span>
          <span>Đồng bộ gần nhất: {formatDateTime(new Date())}</span>
        </div>
      </div>
      <div className="audit-compliance-hero__actions">
        <ActionButton icon={RefreshCw} onClick={onRefresh} disabled={loading}>{loading ? 'Đang tải' : 'Làm mới'}</ActionButton>
        <ActionButton icon={Download}>Xuất bằng chứng</ActionButton>
        <ActionButton icon={Play} tone="primary">Tạo điều tra</ActionButton>
      </div>
    </section>
  );
}

function ComplianceNav({ activeView }) {
  return (
    <nav className="audit-compliance-nav" aria-label="Audit và tuân thủ">
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

function FilterBar({ filters, setFilters, onApply, loading, facets }) {
  const actions = facets?.actions || [];
  const modules = facets?.modules || [];
  return (
    <section className="audit-compliance-filter">
      <label>
        <Clock3 size={15} aria-hidden="true" />
        <select value={filters.range} onChange={(event) => setFilters((value) => ({ ...value, range: event.target.value }))}>
          <option value="1h">1 giờ</option>
          <option value="24h">24 giờ</option>
          <option value="7d">7 ngày</option>
          <option value="30d">30 ngày</option>
          <option value="90d">90 ngày</option>
        </select>
      </label>
      <label>
        <UserRound size={15} aria-hidden="true" />
        <select value={filters.actor_type} onChange={(event) => setFilters((value) => ({ ...value, actor_type: event.target.value }))}>
          <option value="">Mọi actor</option>
          <option value="staff">Nhân sự</option>
          <option value="patient">Bệnh nhân</option>
          <option value="patient_relative">Người thân</option>
          <option value="system">Hệ thống</option>
          <option value="service_account">Service account</option>
        </select>
      </label>
      <label>
        <Fingerprint size={15} aria-hidden="true" />
        <input value={filters.actor_id} placeholder="ID actor" onChange={(event) => setFilters((value) => ({ ...value, actor_id: event.target.value }))} />
      </label>
      <label>
        <Database size={15} aria-hidden="true" />
        <input value={filters.target_type} placeholder="Loại đích" onChange={(event) => setFilters((value) => ({ ...value, target_type: event.target.value }))} />
      </label>
      <label>
        <Fingerprint size={15} aria-hidden="true" />
        <input value={filters.target_id} placeholder="ID đích" onChange={(event) => setFilters((value) => ({ ...value, target_id: event.target.value }))} />
      </label>
      <label>
        <HeartPulse size={15} aria-hidden="true" />
        <input value={filters.patient_id} placeholder="ID bệnh nhân" onChange={(event) => setFilters((value) => ({ ...value, patient_id: event.target.value }))} />
      </label>
      <label>
        <Activity size={15} aria-hidden="true" />
        <select value={filters.module_key} onChange={(event) => setFilters((value) => ({ ...value, module_key: event.target.value }))}>
          <option value="">Mọi module</option>
          {modules.slice(0, 20).map((item) => <option key={item._id} value={item._id}>{item._id}</option>)}
        </select>
      </label>
      <label>
        <History size={15} aria-hidden="true" />
        <select value={filters.action} onChange={(event) => setFilters((value) => ({ ...value, action: event.target.value }))}>
          <option value="">Mọi hành động</option>
          {actions.slice(0, 30).map((item) => <option key={item._id} value={item._id}>{item._id}</option>)}
        </select>
      </label>
      <label className="audit-compliance-filter__search">
        <Search size={15} aria-hidden="true" />
        <input value={filters.keyword} placeholder="Từ khóa, request, thông báo..." onChange={(event) => setFilters((value) => ({ ...value, keyword: event.target.value }))} />
      </label>
      <button type="button" onClick={onApply} disabled={loading}>
        <ListFilter size={16} aria-hidden="true" />
        Áp dụng
      </button>
    </section>
  );
}

function SummaryStrip({ dashboard, summary, activeView }) {
  const metrics = dashboard?.metrics || {};
  const cards = [
    { icon: FileClock, label: 'Sự kiện audit', value: summary?.total ?? metrics.audit_events, note: 'Theo filter hiện tại', tone: 'blue' },
    { icon: XCircle, label: 'Sự kiện lỗi', value: summary?.failure_count ?? summary?.failed ?? metrics.failed_events, note: 'Cần điều tra', tone: 'red' },
    { icon: AlertTriangle, label: 'Nghiêm trọng', value: summary?.critical_count ?? metrics.critical_events, note: 'Mức critical', tone: 'red' },
    { icon: ShieldAlert, label: 'Truy cập nhạy cảm', value: summary?.sensitive_access_count ?? summary?.total ?? metrics.sensitive_access, note: activeView === 'sensitiveAccess' ? 'Hàng đợi rủi ro' : 'Đọc/ghi nhạy cảm', tone: 'purple' },
    { icon: Vault, label: 'Truy cập khẩn cấp', value: summary?.break_glass_count ?? summary?.active ?? metrics.break_glass, note: 'Emergency access', tone: 'amber' },
    { icon: Banknote, label: 'Sự kiện thanh toán', value: summary?.payment_event_count ?? metrics.payment_events, note: 'Bằng chứng billing', tone: 'green' },
    { icon: ShieldCheck, label: 'Thay đổi IAM', value: summary?.iam_change_count ?? summary?.total ?? metrics.iam_changes, note: 'RBAC/IAM', tone: 'indigo' },
    { icon: Settings, label: 'Thay đổi cấu hình', value: summary?.system_config_change_count ?? metrics.system_config_changes, note: 'System setting', tone: 'slate' },
  ];
  return (
    <section className="audit-compliance-metrics">
      {cards.map((item) => <MetricCard key={item.label} {...item} value={formatNumber(item.value || 0)} />)}
    </section>
  );
}

function DataTable({ columns, items, loading, onSelect, onAction }) {
  if (loading) {
    return (
      <section className="audit-compliance-state">
        <RefreshCw size={18} aria-hidden="true" />
        <span>Đang tải bằng chứng audit...</span>
      </section>
    );
  }
  if (!items.length) return <EmptyState title="Không có bản ghi" note="Đổi filter hoặc kiểm tra backend đã ghi audit cho phạm vi này." />;
  return (
    <div className="audit-compliance-table-wrap">
      <table className="audit-compliance-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={itemId(item)}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(item) : formatValue(item[column.key])}</td>)}
              <td>
                <div className="audit-compliance-row-actions">
                  <button type="button" onClick={() => onSelect(item)} title="Xem chi tiết"><Eye size={15} /></button>
                  {item.audit_log_id ? <button type="button" onClick={() => onAction('review-audit', item)} title="Đánh dấu đã rà soát"><CheckCircle2 size={15} /></button> : null}
                  {item.break_glass_access_id ? <button type="button" onClick={() => onAction('review-break-glass', item)} title="Rà soát truy cập khẩn cấp"><Vault size={15} /></button> : null}
                  {item.request_id ? <button type="button" onClick={() => onAction('request-timeline', item)} title="Timeline request"><History size={15} /></button> : null}
                  {item.session_id ? <button type="button" onClick={() => onAction('session-timeline', item)} title="Timeline phiên"><GitCompare size={15} /></button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, note }) {
  return (
    <div className="audit-compliance-empty">
      <Database size={18} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  );
}

function DiffViewer({ before, after }) {
  const keys = useMemo(() => [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])], [before, after]);
  if (!keys.length) return <EmptyState title="Không có diff" note="Audit event này không chứa before/after snapshot." />;
  return (
    <div className="audit-compliance-diff">
      {keys.map((key) => {
        const left = before?.[key];
        const right = after?.[key];
        const changed = JSON.stringify(left) !== JSON.stringify(right);
        return (
          <article key={key} className={changed ? 'is-changed' : ''}>
            <span>{key}</span>
            <code>{formatValue(left)}</code>
            <code>{formatValue(right)}</code>
          </article>
        );
      })}
    </div>
  );
}

function DetailDrawer({ item, detail, loading, onClose }) {
  if (!item) return null;
  const payload = detail || item;
  const log = payload.audit_log_id || payload.action ? payload : payload.items?.[0] || item;
  return (
    <aside className="audit-compliance-drawer" aria-label="Chi tiết audit">
      <div className="audit-compliance-drawer__head">
        <div>
          <span>Bằng chứng audit</span>
          <h2>{formatValue(log.action || shortId(itemId(item)))}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><X size={18} /></button>
      </div>
      {loading ? (
        <section className="audit-compliance-state"><RefreshCw size={18} /><span>Đang tải timeline...</span></section>
      ) : (
        <div className="audit-compliance-drawer__body">
          <section>
            <h3>Tổng quan</h3>
            <div className="audit-compliance-detail-grid">
              {Object.entries(log).slice(0, 18).map(([key, value]) => (
                <article key={key}>
                  <span>{key}</span>
                  <strong>{formatValue(value)}</strong>
                </article>
              ))}
            </div>
          </section>
          <section>
            <h3>Diff trước / sau</h3>
            <DiffViewer before={log.before} after={log.after} />
          </section>
          {payload.items?.length ? (
            <section>
              <h3>Timeline liên quan</h3>
              <div className="audit-compliance-evidence">
                {payload.items.map((event) => (
                  <article key={itemId(event)}>
                    <strong>{formatValue(event.action)}</strong>
                    <span>{event.message || formatValue(event.status)}</span>
                    <time>{formatDateTime(event.created_at)}</time>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h3>Metadata / JSON gốc</h3>
            <JsonBlock value={payload} />
          </section>
        </div>
      )}
    </aside>
  );
}

function SideEvidencePanel({ activeView, sideData, facets, onSelect }) {
  const items = extractItems(sideData);
  const topActions = facets?.actions || [];
  return (
    <section className="audit-compliance-panel">
      <div className="audit-compliance-panel__head">
        <div>
          <span>Hàng đợi rủi ro / Facets</span>
          <h2>Điểm nóng điều tra</h2>
        </div>
        <SlidersHorizontal size={18} aria-hidden="true" />
      </div>
      {activeView === 'sensitiveAccess' && items.length ? (
        <div className="audit-compliance-mini-list">
          {items.slice(0, 10).map((item) => (
            <button key={itemId(item)} type="button" onClick={() => onSelect(item)}>
              <div>
                <strong>{formatValue(item.action)}</strong>
                <span>{item.risk_reasons?.join(', ') || item.message || 'Truy cập nhạy cảm'}</span>
              </div>
              <RiskBadge level={item.risk_level} score={item.risk_score} />
            </button>
          ))}
        </div>
      ) : (
        <div className="audit-compliance-mini-list">
          {topActions.slice(0, 10).map((item) => (
            <button key={item._id} type="button">
              <div>
                <strong>{formatValue(item._id)}</strong>
                <span>{formatNumber(item.count)} sự kiện</span>
              </div>
              <StatusBadge status="muted">Facet</StatusBadge>
            </button>
          ))}
          {!topActions.length ? <EmptyState title="Chưa có facets" note="Facets sẽ có sau khi audit summary trả dữ liệu." /> : null}
        </div>
      )}
    </section>
  );
}

function ExportWorkbench({ query, onCreated }) {
  const [form, setForm] = useState({ export_type: 'general', format: 'json', reason: '', include_metadata: true, include_diff: true, include_related_logs: true });
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const payload = useMemo(() => ({
    export_type: form.export_type,
    format: form.format,
    reason: form.reason,
    filters: query,
    include_options: {
      metadata: form.include_metadata,
      diff: form.include_diff,
      related_logs: form.include_related_logs,
    },
  }), [form, query]);

  const loadHistory = useCallback(async () => {
    const data = await listAuditExports({ limit: 20 });
    setHistory(data.items || []);
  }, []);

  useEffect(() => {
    loadHistory().catch(() => {});
  }, [loadHistory]);

  const previewAction = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [count, sample] = await Promise.all([previewAuditExportCount(payload), previewAuditExportSample({ ...payload, limit: 8 })]);
      setPreview({ ...count, sample: sample.items || [] });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createAction = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await createAuditExport(payload);
      setMessage(`Đã tạo export request ${shortId(result._id)} với checksum ${shortId(result.checksum)}.`);
      setConfirmOpen(false);
      await loadHistory();
      onCreated();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="audit-compliance-export">
      <section className="audit-compliance-panel">
        <div className="audit-compliance-panel__head">
          <div>
            <span>Trình xuất audit</span>
            <h2>Tạo gói bằng chứng audit</h2>
          </div>
          <CloudUpload size={18} />
        </div>
        <div className="audit-compliance-form-grid">
          <label>
            <span>Loại export</span>
            <select value={form.export_type} onChange={(event) => setForm((value) => ({ ...value, export_type: event.target.value }))}>
              <option value="general">Audit tổng quát</option>
              <option value="actor">Audit actor</option>
              <option value="patient_access">Truy cập bệnh nhân</option>
              <option value="payment">Audit thanh toán</option>
              <option value="iam">Audit IAM</option>
              <option value="system_config">Cấu hình hệ thống</option>
              <option value="break_glass">Bằng chứng truy cập khẩn cấp</option>
              <option value="sensitive_access">Truy cập nhạy cảm</option>
            </select>
          </label>
          <label>
            <span>Định dạng</span>
            <select value={form.format} onChange={(event) => setForm((value) => ({ ...value, format: event.target.value }))}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="pdf">Tóm tắt PDF</option>
              <option value="zip">Bằng chứng ZIP</option>
            </select>
          </label>
          {['include_metadata', 'include_diff', 'include_related_logs'].map((key) => (
            <label key={key} className="audit-compliance-checkbox">
              <input type="checkbox" checked={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.checked }))} />
              <span>{{
                include_metadata: 'Bao gồm metadata',
                include_diff: 'Bao gồm diff',
                include_related_logs: 'Bao gồm log liên quan',
              }[key]}</span>
            </label>
          ))}
          <label className="audit-compliance-form-grid__wide">
            <span>Lý do</span>
            <textarea rows={4} value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} placeholder="Lý do export phục vụ kiểm toán / điều tra / pháp lý..." />
          </label>
          <div className="audit-compliance-form-grid__actions">
            <ActionButton icon={Eye} onClick={previewAction} disabled={loading}>Xem trước</ActionButton>
            <ActionButton icon={CloudUpload} onClick={() => setConfirmOpen(true)} disabled={loading || !form.reason} tone="primary">Tạo export</ActionButton>
          </div>
          {message ? <p className="audit-compliance-message">{message}</p> : null}
        </div>
      </section>
      <section className="audit-compliance-panel audit-compliance-panel--wide">
        <div className="audit-compliance-panel__head">
          <div>
            <span>Xem trước / Lịch sử</span>
            <h2>Xuất audit</h2>
          </div>
          <StatusBadge status={preview ? 'success' : 'muted'}>{preview ? `${formatNumber(preview.total_records)} bản ghi` : 'Chưa xem trước'}</StatusBadge>
        </div>
        {preview ? <DataTable columns={AUDIT_COLUMNS} items={preview.sample || []} loading={false} onSelect={() => {}} onAction={() => {}} /> : null}
        <div className="audit-compliance-export-history">
          {history.map((item) => (
            <article key={item._id}>
              <strong>{item.export_type} / {item.format}</strong>
              <span>{formatNumber(item.total_records)} bản ghi / {shortId(item.checksum)}</span>
              <StatusBadge status={item.status}>{item.status}</StatusBadge>
            </article>
          ))}
        </div>
      </section>
      <AdminActionConfirmDialog
        open={confirmOpen}
        title="Tạo gói export audit?"
        description="Gói export có thể chứa bằng chứng audit nhạy cảm. Hãy đảm bảo lý do export phù hợp với kiểm toán, điều tra hoặc yêu cầu pháp lý."
        tone="warning"
        confirmLabel="Tạo export"
        details={[
          { label: 'Loại export', value: formatValue(form.export_type) },
          { label: 'Định dạng', value: form.format },
          { label: 'Lý do', value: form.reason },
          { label: 'Số bản ghi dự kiến', value: preview ? formatNumber(preview.total_records) : 'Chưa xem trước' },
        ]}
        submitting={loading}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={createAction}
      />
    </div>
  );
}

function ReportsWorkbench({ dashboard, onGenerated }) {
  const [form, setForm] = useState({ report_type: 'daily_audit', period: '24h' });
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(async () => {
    const data = await listComplianceReports({ limit: 20 });
    setReports(data.items || []);
  }, []);

  useEffect(() => {
    loadReports().catch(() => {});
  }, [loadReports]);

  const generate = async () => {
    setLoading(true);
    setMessage('');
    try {
      const hours = hoursForRange(form.period);
      const result = await generateComplianceReport({
        report_type: form.report_type,
        period_from: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        period_to: new Date().toISOString(),
      });
      setMessage(`Đã tạo báo cáo ${shortId(result._id)}.`);
      await loadReports();
      onGenerated();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="audit-compliance-export">
      <section className="audit-compliance-panel">
        <div className="audit-compliance-panel__head">
          <div>
            <span>Báo cáo tuân thủ</span>
            <h2>Tạo báo cáo</h2>
          </div>
          <FileText size={18} />
        </div>
        <div className="audit-compliance-form-grid">
          <label>
            <span>Loại báo cáo</span>
            <select value={form.report_type} onChange={(event) => setForm((value) => ({ ...value, report_type: event.target.value }))}>
              <option value="daily_audit">Audit hằng ngày</option>
              <option value="medical_record_access">Truy cập hồ sơ y tế</option>
              <option value="sensitive_access">Truy cập nhạy cảm</option>
              <option value="break_glass_review">Rà soát truy cập khẩn cấp</option>
              <option value="consent_coverage">Độ phủ đồng thuận</option>
              <option value="iam_changes">Thay đổi IAM</option>
              <option value="payment_audit">Audit thanh toán</option>
              <option value="system_config_changes">Thay đổi cấu hình hệ thống</option>
              <option value="export_activity">Hoạt động export</option>
              <option value="audit_retention">Lưu trữ audit</option>
            </select>
          </label>
          <label>
            <span>Kỳ báo cáo</span>
            <select value={form.period} onChange={(event) => setForm((value) => ({ ...value, period: event.target.value }))}>
              <option value="24h">24 giờ</option>
              <option value="7d">7 ngày</option>
              <option value="30d">30 ngày</option>
              <option value="90d">90 ngày</option>
            </select>
          </label>
          <ActionButton icon={Play} onClick={generate} disabled={loading} tone="primary">Tạo báo cáo</ActionButton>
          {message ? <p className="audit-compliance-message">{message}</p> : null}
        </div>
      </section>
      <section className="audit-compliance-panel audit-compliance-panel--wide">
        <div className="audit-compliance-panel__head">
          <div>
            <span>Hàng đợi tuân thủ</span>
            <h2>Báo cáo & việc cần xử lý</h2>
          </div>
          <StatusBadge status={dashboard?.risk_level}>{dashboard?.risk_level || 'low'}</StatusBadge>
        </div>
        <div className="audit-compliance-task-grid">
          {(dashboard?.task_queue || []).map((task) => (
            <article key={task.task_key}>
              <span>{task.label}</span>
              <strong>{formatNumber(task.count)}</strong>
              <StatusBadge status={task.severity}>{task.severity}</StatusBadge>
            </article>
          ))}
        </div>
        <div className="audit-compliance-export-history">
          {reports.map((item) => (
            <article key={item._id}>
              <strong>{formatValue(item.report_type)}</strong>
              <span>{formatDateTime(item.generated_at)} / {shortId(item.checksum)}</span>
              <StatusBadge status={item.status}>{item.status}</StatusBadge>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AuditCompliancePage({ view = 'auditLog' }) {
  const activeView = normalizeView(view);
  const config = VIEW_CONFIG[activeView] || VIEW_CONFIG.auditLog;
  const [dashboard, setDashboard] = useState(null);
  const [summary, setSummary] = useState(null);
  const [facets, setFacets] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [sideData, setSideData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [filters, setFilters] = useState({
    range: '24h',
    keyword: '',
    actor_type: '',
    actor_id: '',
    target_type: '',
    target_id: '',
    patient_id: '',
    module_key: '',
    action: '',
    action_prefix: '',
    status: '',
    severity: '',
    request_id: '',
    session_id: '',
    ip_address: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const query = useMemo(() => buildQuery(appliedFilters), [appliedFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const jobs = [
        getComplianceDashboard({ from: query.date_from }),
        getAuditFacets(query),
      ];
      if (config.loader) jobs.push(config.loader(query));
      if (config.summaryLoader) jobs.push(config.summaryLoader(query));
      if (config.sideLoader) jobs.push(config.sideLoader(query));
      const [dashboardResult, facetsResult, dataResult, summaryResult, sideResult] = await Promise.all(jobs);
      setDashboard(dashboardResult);
      setFacets(facetsResult);
      setViewData(dataResult || null);
      setSummary(summaryResult || null);
      setSideData(sideResult || null);
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
    setDetailLoading(true);
    try {
      if (config.detailLoader) {
        setDetail(await config.detailLoader(item));
      } else if (item.audit_log_id || item._id) {
        setDetail(await getAuditLogDetail(item.audit_log_id || item._id));
      }
    } catch (error) {
      setDetail({ error: error.message, item });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (action, item) => {
    if (['review-audit', 'review-break-glass'].includes(action)) {
      setConfirmAction({
        action,
        item,
        title: action === 'review-break-glass' ? 'Đánh dấu truy cập khẩn cấp đã rà soát?' : 'Đánh dấu audit đã rà soát?',
        description: action === 'review-break-glass'
          ? 'Bản ghi truy cập khẩn cấp sẽ được chuyển sang đã rà soát và lưu dấu vết tuân thủ.'
          : 'Bản ghi audit/truy cập nhạy cảm sẽ được đánh dấu đã rà soát.',
        confirmLabel: 'Đánh dấu đã rà soát',
        tone: 'success',
        details: [
          { label: 'Hành động', value: formatValue(item.action || action) },
          { label: 'Mã', value: itemId(item) },
          { label: 'Trạng thái', value: formatValue(item.status || item.review_status || 'Chưa rõ') },
        ],
      });
      return;
    }
    await executeAction(action, item);
  };

  const executeAction = async (action, item) => {
    setMessage('');
    try {
      if (action === 'review-audit') {
        await reviewSensitiveAccess(item.audit_log_id || item._id, { review_type: activeView === 'breakGlass' ? 'break_glass' : 'sensitive_access', review_status: 'reviewed', note: 'Đã rà soát từ giao diện Audit & Tuân thủ.' });
      }
      if (action === 'review-break-glass') {
        await reviewBreakGlass(item.break_glass_access_id, { review_status: 'reviewed', note: 'Đã rà soát từ giao diện Audit & Tuân thủ.' });
      }
      if (action === 'request-timeline') {
        setSelected(item);
        setDetailLoading(true);
        setDetail(await getRequestTimeline(item.request_id));
        setDetailLoading(false);
        return;
      }
      if (action === 'session-timeline') {
        setSelected(item);
        setDetailLoading(true);
        setDetail(await getSessionTimeline(item.session_id));
        setDetailLoading(false);
        return;
      }
      setConfirmAction(null);
      setMessage('Thao tác audit/tuân thủ đã hoàn tất.');
      await load();
    } catch (error) {
      setMessage(error.message);
      setDetailLoading(false);
    }
  };

  const items = extractItems(viewData);
  const PageIcon = config.icon;

  return (
    <div className="audit-compliance-page">
      <ComplianceHero dashboard={dashboard} loading={loading} onRefresh={load} />
      <ComplianceNav activeView={activeView} />
      <FilterBar filters={filters} setFilters={setFilters} onApply={() => setAppliedFilters(filters)} loading={loading} facets={facets} />
      {message ? (
        <section className="audit-compliance-alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}
      <SummaryStrip dashboard={dashboard} summary={summary} activeView={activeView} />

      {activeView === 'exportAudit' ? (
        <ExportWorkbench query={query} onCreated={load} />
      ) : activeView === 'reports' ? (
        <ReportsWorkbench dashboard={dashboard} onGenerated={load} />
      ) : (
        <div className="audit-compliance-content-grid">
          <section className="audit-compliance-panel audit-compliance-panel--wide">
            <div className="audit-compliance-panel__head">
              <div>
                <span>Audit & tuân thủ</span>
                <h2>{config.title}</h2>
                <p>{config.subtitle}</p>
              </div>
              <PageIcon size={20} aria-hidden="true" />
            </div>
            <DataTable columns={config.columns} items={items} loading={loading} onSelect={openDetail} onAction={handleAction} />
          </section>
          <SideEvidencePanel activeView={activeView} sideData={sideData} facets={facets} onSelect={openDetail} />
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
        submitting={loading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => executeAction(confirmAction.action, confirmAction.item)}
      />
    </div>
  );
}
