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
  { key: 'auditLog', label: 'Audit log', icon: FileClock },
  { key: 'actor', label: 'Theo actor', icon: UserRound },
  { key: 'user', label: 'Theo người dùng', icon: UsersRound },
  { key: 'object', label: 'Theo đối tượng', icon: Database },
  { key: 'medicalRecord', label: 'Hồ sơ bệnh án', icon: FileText },
  { key: 'iam', label: 'Phân quyền', icon: ShieldCheck },
  { key: 'systemConfig', label: 'Cấu hình hệ thống', icon: Settings },
  { key: 'payment', label: 'Thanh toán', icon: Banknote },
  { key: 'sensitiveAccess', label: 'Truy cập nhạy cảm', icon: ShieldAlert },
  { key: 'breakGlass', label: 'Break-glass', icon: Vault },
  { key: 'exportAudit', label: 'Export audit', icon: CloudUpload },
  { key: 'reports', label: 'Báo cáo tuân thủ', icon: FileText },
];

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
  return String(value);
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
  return <span className={`audit-compliance-badge audit-compliance-badge--${statusTone(status || children)}`}>{children || 'n/a'}</span>;
}

function RiskBadge({ level, score }) {
  return <span className={`audit-compliance-badge audit-compliance-badge--${riskTone(level, score)}`}>{level || riskTone(level, score)}{score !== undefined ? ` / ${score}` : ''}</span>;
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
      <strong>{item.actor_name || item.actor_type || 'system'}</strong>
      <span>{item.actor_type || 'system'} / {shortId(item.actor_id)}</span>
    </div>
  );
}

function buildAuditColumns() {
  return [
    { key: 'time', label: 'Time', render: (row) => formatDateTime(row.created_at) },
    { key: 'severity', label: 'Severity', render: (row) => <StatusBadge status={row.severity}>{row.severity}</StatusBadge> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
    { key: 'actor', label: 'Actor', render: (row) => <ActorCell item={row} /> },
    { key: 'action', label: 'Action', render: (row) => <strong>{row.action}</strong> },
    { key: 'module', label: 'Module', render: (row) => row.module_key || String(row.action || '').split('.')[0] },
    { key: 'target', label: 'Target', render: (row) => `${row.target_type || 'system'} / ${shortId(row.target_id)}` },
    { key: 'ip', label: 'IP', render: (row) => row.ip_address || 'n/a' },
    { key: 'risk', label: 'Risk', render: (row) => row.risk_score !== undefined ? <RiskBadge level={row.risk_level} score={row.risk_score} /> : <StatusBadge status="muted">n/a</StatusBadge> },
  ];
}

const AUDIT_COLUMNS = buildAuditColumns();

const VIEW_CONFIG = {
  auditLog: {
    title: 'Audit log',
    subtitle: 'Bảng audit tổng hợp với filter động, diff viewer, request/session timeline và evidence drawer.',
    icon: FileClock,
    loader: listAuditLogs,
    summaryLoader: getAuditSummary,
    columns: AUDIT_COLUMNS,
  },
  actor: {
    title: 'Audit theo actor',
    subtitle: 'Điều tra hành vi theo staff, patient, patient_relative, system hoặc service account.',
    icon: UserRound,
    loader: async (query) => query.actor_type && query.actor_id ? getActorAudit(query.actor_type, query.actor_id, query) : listAuditLogs(query),
    summaryLoader: getAuditSummary,
    columns: AUDIT_COLUMNS,
  },
  user: {
    title: 'Audit theo người dùng',
    subtitle: 'Tập trung login history, session context, IAM changes, sensitive access và export/download của một tài khoản.',
    icon: UsersRound,
    loader: async (query) => query.actor_type && query.actor_id ? getActorAudit(query.actor_type, query.actor_id, query) : listAuditLogs(query),
    summaryLoader: getAuditSummary,
    columns: AUDIT_COLUMNS,
  },
  object: {
    title: 'Audit theo đối tượng',
    subtitle: 'Timeline và diff history quanh patient, invoice, encounter, role, system_setting hoặc object bất kỳ.',
    icon: Database,
    loader: async (query) => query.target_type && query.target_id ? getEntityAudit(query.target_type, query.target_id, query) : listAuditLogs(query),
    summaryLoader: getAuditSummary,
    columns: AUDIT_COLUMNS,
  },
  medicalRecord: {
    title: 'Audit hồ sơ bệnh án',
    subtitle: 'Patient access timeline: ai xem hồ sơ, tải gì, lý do, consent, authorization và break-glass.',
    icon: FileText,
    loader: async (query) => query.patient_id ? getPatientAccessTimeline(query.patient_id, query) : listSensitiveAccess({ ...query, action_prefix: undefined }),
    summaryLoader: async (query) => query.patient_id ? getPatientAccessSummary(query.patient_id, query) : getSensitiveAccessSummary(query),
    columns: AUDIT_COLUMNS,
  },
  iam: {
    title: 'Audit phân quyền',
    subtitle: 'Role, permission, user-role assignment, deny policy, permission cache và access denied history.',
    icon: ShieldCheck,
    loader: listIamAudit,
    summaryLoader: getIamSummary,
    columns: AUDIT_COLUMNS,
  },
  systemConfig: {
    title: 'Audit cấu hình hệ thống',
    subtitle: 'Theo dõi SystemSetting, clinical_config, sensitive config, rollback và thay đổi cần review.',
    icon: Settings,
    loader: listSettingsAudit,
    summaryLoader: getSettingsSummary,
    columns: AUDIT_COLUMNS,
  },
  payment: {
    title: 'Audit thanh toán',
    subtitle: 'Charge, invoice, payment intent, webhook, receipt, refund, void và reconciliation evidence.',
    icon: Banknote,
    loader: listBillingAudit,
    summaryLoader: getBillingSummary,
    columns: AUDIT_COLUMNS,
  },
  sensitiveAccess: {
    title: 'Audit truy cập nhạy cảm',
    subtitle: 'Risk queue cho medical record, attachment, lab, imaging, prescription, invoice và relative access.',
    icon: ShieldAlert,
    loader: listSensitiveAccess,
    summaryLoader: getSensitiveAccessSummary,
    sideLoader: getSensitiveRiskQueue,
    columns: AUDIT_COLUMNS,
  },
  breakGlass: {
    title: 'Audit break-glass',
    subtitle: 'Kiểm soát break-glass active/ended, pending review, evidence timeline và compliance decision.',
    icon: Vault,
    loader: listBreakGlassAudit,
    summaryLoader: getBreakGlassSummary,
    detailLoader: (row) => getBreakGlassTimeline(row.break_glass_access_id),
    columns: [
      { key: 'patient', label: 'Patient', render: (row) => shortId(row.patient_id) },
      { key: 'staff', label: 'Staff', render: (row) => row.accessed_by_user_id?.full_name || shortId(row.accessed_by_user_id?._id || row.accessed_by_user_id) },
      { key: 'reason', label: 'Reason', render: (row) => row.reason || 'Thiếu lý do' },
      { key: 'started', label: 'Started', render: (row) => formatDateTime(row.started_at) },
      { key: 'duration', label: 'Duration', render: (row) => `${formatNumber(row.duration_minutes || 0)} phút` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      { key: 'review', label: 'Review', render: (row) => <StatusBadge status={row.review_status}>{row.review_status}</StatusBadge> },
      { key: 'risk', label: 'Risk', render: (row) => <RiskBadge level={row.risk_level} score={row.risk_score} /> },
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
        <span>Compliance score</span>
      </div>
      <div className="audit-compliance-hero__copy">
        <div className="audit-compliance-kicker">Quản trị hệ thống / Audit & Compliance</div>
        <h1>Audit & Compliance Control Plane</h1>
        <p>Điều tra audit, truy vết actor/object/patient, review sensitive access và break-glass, tạo export evidence và compliance report.</p>
        <div className="audit-compliance-hero__meta">
          <RiskBadge level={dashboard?.risk_level || 'low'} score={100 - score} />
          <span>Audit events: {formatNumber(metrics.audit_events)}</span>
          <span>Pending reviews: {formatNumber(metrics.pending_reviews)}</span>
          <span>Last sync: {formatDateTime(new Date())}</span>
        </div>
      </div>
      <div className="audit-compliance-hero__actions">
        <ActionButton icon={RefreshCw} onClick={onRefresh} disabled={loading}>{loading ? 'Đang tải' : 'Refresh'}</ActionButton>
        <ActionButton icon={Download}>Export evidence</ActionButton>
        <ActionButton icon={Play} tone="primary">Create investigation</ActionButton>
      </div>
    </section>
  );
}

function ComplianceNav({ activeView }) {
  return (
    <nav className="audit-compliance-nav" aria-label="Audit & Compliance">
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
          <option value="staff">Staff</option>
          <option value="patient">Patient</option>
          <option value="patient_relative">Relative</option>
          <option value="system">System</option>
          <option value="service_account">Service</option>
        </select>
      </label>
      <label>
        <Fingerprint size={15} aria-hidden="true" />
        <input value={filters.actor_id} placeholder="Actor ID" onChange={(event) => setFilters((value) => ({ ...value, actor_id: event.target.value }))} />
      </label>
      <label>
        <Database size={15} aria-hidden="true" />
        <input value={filters.target_type} placeholder="Target type" onChange={(event) => setFilters((value) => ({ ...value, target_type: event.target.value }))} />
      </label>
      <label>
        <Fingerprint size={15} aria-hidden="true" />
        <input value={filters.target_id} placeholder="Target ID" onChange={(event) => setFilters((value) => ({ ...value, target_id: event.target.value }))} />
      </label>
      <label>
        <HeartPulse size={15} aria-hidden="true" />
        <input value={filters.patient_id} placeholder="Patient ID" onChange={(event) => setFilters((value) => ({ ...value, patient_id: event.target.value }))} />
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
          <option value="">Mọi action</option>
          {actions.slice(0, 30).map((item) => <option key={item._id} value={item._id}>{item._id}</option>)}
        </select>
      </label>
      <label className="audit-compliance-filter__search">
        <Search size={15} aria-hidden="true" />
        <input value={filters.keyword} placeholder="Keyword, request, message..." onChange={(event) => setFilters((value) => ({ ...value, keyword: event.target.value }))} />
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
    { icon: FileClock, label: 'Audit events', value: summary?.total ?? metrics.audit_events, note: 'Theo filter hiện tại', tone: 'blue' },
    { icon: XCircle, label: 'Failed events', value: summary?.failure_count ?? summary?.failed ?? metrics.failed_events, note: 'Cần điều tra', tone: 'red' },
    { icon: AlertTriangle, label: 'Critical', value: summary?.critical_count ?? metrics.critical_events, note: 'Severity critical', tone: 'red' },
    { icon: ShieldAlert, label: 'Sensitive access', value: summary?.sensitive_access_count ?? summary?.total ?? metrics.sensitive_access, note: activeView === 'sensitiveAccess' ? 'Risk queue' : 'Read/write nhạy cảm', tone: 'purple' },
    { icon: Vault, label: 'Break-glass', value: summary?.break_glass_count ?? summary?.active ?? metrics.break_glass, note: 'Emergency access', tone: 'amber' },
    { icon: Banknote, label: 'Payment events', value: summary?.payment_event_count ?? metrics.payment_events, note: 'Billing evidence', tone: 'green' },
    { icon: ShieldCheck, label: 'IAM changes', value: summary?.iam_change_count ?? summary?.total ?? metrics.iam_changes, note: 'RBAC/IAM', tone: 'indigo' },
    { icon: Settings, label: 'Config changes', value: summary?.system_config_change_count ?? metrics.system_config_changes, note: 'System setting', tone: 'slate' },
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
        <span>Đang tải audit evidence...</span>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={itemId(item)}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(item) : formatValue(item[column.key])}</td>)}
              <td>
                <div className="audit-compliance-row-actions">
                  <button type="button" onClick={() => onSelect(item)} title="Xem detail"><Eye size={15} /></button>
                  {item.audit_log_id ? <button type="button" onClick={() => onAction('review-audit', item)} title="Review"><CheckCircle2 size={15} /></button> : null}
                  {item.break_glass_access_id ? <button type="button" onClick={() => onAction('review-break-glass', item)} title="Review break-glass"><Vault size={15} /></button> : null}
                  {item.request_id ? <button type="button" onClick={() => onAction('request-timeline', item)} title="Request timeline"><History size={15} /></button> : null}
                  {item.session_id ? <button type="button" onClick={() => onAction('session-timeline', item)} title="Session timeline"><GitCompare size={15} /></button> : null}
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
    <aside className="audit-compliance-drawer" aria-label="Audit detail">
      <div className="audit-compliance-drawer__head">
        <div>
          <span>Audit evidence</span>
          <h2>{log.action || shortId(itemId(item))}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng detail"><X size={18} /></button>
      </div>
      {loading ? (
        <section className="audit-compliance-state"><RefreshCw size={18} /><span>Đang tải timeline...</span></section>
      ) : (
        <div className="audit-compliance-drawer__body">
          <section>
            <h3>Summary</h3>
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
            <h3>Before / After diff</h3>
            <DiffViewer before={log.before} after={log.after} />
          </section>
          {payload.items?.length ? (
            <section>
              <h3>Related timeline</h3>
              <div className="audit-compliance-evidence">
                {payload.items.map((event) => (
                  <article key={itemId(event)}>
                    <strong>{event.action}</strong>
                    <span>{event.message || event.status}</span>
                    <time>{formatDateTime(event.created_at)}</time>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h3>Metadata / Raw JSON</h3>
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
          <span>Risk queue / Facets</span>
          <h2>Điểm nóng điều tra</h2>
        </div>
        <SlidersHorizontal size={18} aria-hidden="true" />
      </div>
      {activeView === 'sensitiveAccess' && items.length ? (
        <div className="audit-compliance-mini-list">
          {items.slice(0, 10).map((item) => (
            <button key={itemId(item)} type="button" onClick={() => onSelect(item)}>
              <div>
                <strong>{item.action}</strong>
                <span>{item.risk_reasons?.join(', ') || item.message || 'Sensitive access'}</span>
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
                <strong>{item._id}</strong>
                <span>{formatNumber(item.count)} events</span>
              </div>
              <StatusBadge status="muted">facet</StatusBadge>
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
            <span>Export wizard</span>
            <h2>Tạo audit evidence package</h2>
          </div>
          <CloudUpload size={18} />
        </div>
        <div className="audit-compliance-form-grid">
          <label>
            <span>Export type</span>
            <select value={form.export_type} onChange={(event) => setForm((value) => ({ ...value, export_type: event.target.value }))}>
              <option value="general">General audit</option>
              <option value="actor">Actor audit</option>
              <option value="patient_access">Patient access</option>
              <option value="payment">Payment audit</option>
              <option value="iam">IAM audit</option>
              <option value="system_config">System config</option>
              <option value="break_glass">Break-glass evidence</option>
              <option value="sensitive_access">Sensitive access</option>
            </select>
          </label>
          <label>
            <span>Format</span>
            <select value={form.format} onChange={(event) => setForm((value) => ({ ...value, format: event.target.value }))}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF summary</option>
              <option value="zip">ZIP evidence</option>
            </select>
          </label>
          {['include_metadata', 'include_diff', 'include_related_logs'].map((key) => (
            <label key={key} className="audit-compliance-checkbox">
              <input type="checkbox" checked={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.checked }))} />
              <span>{key}</span>
            </label>
          ))}
          <label className="audit-compliance-form-grid__wide">
            <span>Reason</span>
            <textarea rows={4} value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} placeholder="Lý do export phục vụ kiểm toán / điều tra / pháp lý..." />
          </label>
          <div className="audit-compliance-form-grid__actions">
            <ActionButton icon={Eye} onClick={previewAction} disabled={loading}>Preview</ActionButton>
            <ActionButton icon={CloudUpload} onClick={createAction} disabled={loading || !form.reason} tone="primary">Create export</ActionButton>
          </div>
          {message ? <p className="audit-compliance-message">{message}</p> : null}
        </div>
      </section>
      <section className="audit-compliance-panel audit-compliance-panel--wide">
        <div className="audit-compliance-panel__head">
          <div>
            <span>Preview / History</span>
            <h2>Export audit</h2>
          </div>
          <StatusBadge status={preview ? 'success' : 'muted'}>{preview ? `${formatNumber(preview.total_records)} records` : 'Chưa preview'}</StatusBadge>
        </div>
        {preview ? <DataTable columns={AUDIT_COLUMNS} items={preview.sample || []} loading={false} onSelect={() => {}} onAction={() => {}} /> : null}
        <div className="audit-compliance-export-history">
          {history.map((item) => (
            <article key={item._id}>
              <strong>{item.export_type} / {item.format}</strong>
              <span>{formatNumber(item.total_records)} records / {shortId(item.checksum)}</span>
              <StatusBadge status={item.status}>{item.status}</StatusBadge>
            </article>
          ))}
        </div>
      </section>
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
      setMessage(`Đã generate report ${shortId(result._id)}.`);
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
            <span>Compliance report</span>
            <h2>Generate report</h2>
          </div>
          <FileText size={18} />
        </div>
        <div className="audit-compliance-form-grid">
          <label>
            <span>Report type</span>
            <select value={form.report_type} onChange={(event) => setForm((value) => ({ ...value, report_type: event.target.value }))}>
              <option value="daily_audit">Daily audit</option>
              <option value="medical_record_access">Medical record access</option>
              <option value="sensitive_access">Sensitive access</option>
              <option value="break_glass_review">Break-glass review</option>
              <option value="consent_coverage">Consent coverage</option>
              <option value="iam_changes">IAM changes</option>
              <option value="payment_audit">Payment audit</option>
              <option value="system_config_changes">System config changes</option>
              <option value="export_activity">Export activity</option>
              <option value="audit_retention">Audit retention</option>
            </select>
          </label>
          <label>
            <span>Period</span>
            <select value={form.period} onChange={(event) => setForm((value) => ({ ...value, period: event.target.value }))}>
              <option value="24h">24 giờ</option>
              <option value="7d">7 ngày</option>
              <option value="30d">30 ngày</option>
              <option value="90d">90 ngày</option>
            </select>
          </label>
          <ActionButton icon={Play} onClick={generate} disabled={loading} tone="primary">Generate</ActionButton>
          {message ? <p className="audit-compliance-message">{message}</p> : null}
        </div>
      </section>
      <section className="audit-compliance-panel audit-compliance-panel--wide">
        <div className="audit-compliance-panel__head">
          <div>
            <span>Compliance task queue</span>
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
              <strong>{item.report_type}</strong>
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
    setMessage('');
    try {
      if (action === 'review-audit') {
        await reviewSensitiveAccess(item.audit_log_id || item._id, { review_type: activeView === 'breakGlass' ? 'break_glass' : 'sensitive_access', review_status: 'reviewed', note: 'Reviewed from Audit & Compliance UI.' });
      }
      if (action === 'review-break-glass') {
        await reviewBreakGlass(item.break_glass_access_id, { review_status: 'reviewed', note: 'Reviewed from Audit & Compliance UI.' });
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
      setMessage('Thao tác audit/compliance đã hoàn tất.');
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
                <span>{activeView}</span>
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
    </div>
  );
}
