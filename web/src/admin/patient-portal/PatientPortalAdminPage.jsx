import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Eye,
  FileClock,
  FileText,
  Filter,
  Flag,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { portalAdminGet, portalAdminPatch, portalAdminPost } from './patientPortalAdminApi';

const VIEW_CONFIG = {
  dashboard: {
    title: 'Patient Portal Admin',
    subtitle: 'Control plane cho tài khoản bệnh nhân, người thân, hồ sơ tự gửi, tài liệu, bảo hiểm và audit.',
    icon: HeartPulse,
    endpoint: '/dashboard',
  },
  accounts: {
    title: 'Tài khoản bệnh nhân',
    subtitle: 'Account security, trạng thái đăng nhập, xác thực email/phone, Google OAuth và force logout.',
    icon: UserRound,
    endpoint: '/accounts',
    summaryEndpoint: '/accounts/summary',
    detail: (row) => `/accounts/${row.id}`,
  },
  relatives: {
    title: 'Người thân bệnh nhân',
    subtitle: 'Global registry người thân, xác minh quan hệ, duplicate risk và trạng thái access.',
    icon: UsersRound,
    endpoint: '/relatives',
    summaryEndpoint: '/relatives/summary',
    detail: (row) => `/relatives/${row.id}`,
  },
  authorizations: {
    title: 'Ủy quyền người thân',
    subtitle: 'Kanban quyền truy cập người thân, scope matrix, approve/reject/revoke và effective access.',
    icon: ShieldCheck,
    endpoint: '/authorizations',
    summaryEndpoint: '/authorizations/summary',
    detail: (row) => `/authorizations/${row.id}`,
  },
  profilePolicies: {
    title: 'Hồ sơ bệnh nhân tự cập nhật',
    subtitle: 'Field policy center: field nào được sửa, cần duyệt, cần giấy tờ, SLA và risk level.',
    icon: FileText,
    endpoint: '/profile-field-policies',
    detail: (row) => `/profile-field-policies/${row.field_name}`,
  },
  profileChanges: {
    title: 'Yêu cầu cập nhật hồ sơ',
    subtitle: 'Queue duyệt thay đổi thông tin, diff old/new, risk analysis và quyết định review.',
    icon: ClipboardCheck,
    endpoint: '/profile-change-requests',
    summaryEndpoint: '/profile-change-requests/summary',
    detail: (row) => `/profile-change-requests/${row.id}`,
  },
  documents: {
    title: 'Tài liệu bệnh nhân upload',
    subtitle: 'Document review queue, virus scan status, release control, metadata và access log.',
    icon: UploadCloud,
    endpoint: '/documents',
    summaryEndpoint: '/documents/summary',
    detail: (row) => `/documents/${row.id}`,
  },
  exports: {
    title: 'Yêu cầu xuất hồ sơ',
    subtitle: 'Export ZIP requests, worker state, retry, expiry, revoke download và processing logs.',
    icon: Download,
    endpoint: '/document-exports',
    summaryEndpoint: '/document-exports/summary',
    detail: (row) => `/document-exports/${row.id}`,
  },
  insurance: {
    title: 'Bảo hiểm bệnh nhân gửi',
    subtitle: 'Queue xác minh bảo hiểm, ảnh thẻ, duplicate policy, verify/reject và request more info.',
    icon: ShieldAlert,
    endpoint: '/insurance-submissions',
    summaryEndpoint: '/insurance-submissions/summary',
    detail: (row) => `/insurance-submissions/${row.id}`,
  },
  featureFlags: {
    title: 'Portal feature flags',
    subtitle: 'Rollout, dependency, risk level và rollback cho các tính năng self-service portal.',
    icon: Flag,
    endpoint: '/feature-flags',
    detail: (row) => `/feature-flags/${row.key}`,
  },
  audit: {
    title: 'Portal audit',
    subtitle: 'Audit stream cho login, profile change, document, insurance, relative authorization và sensitive access.',
    icon: FileClock,
    endpoint: '/audit',
    summaryEndpoint: '/audit/summary',
    detail: (row) => `/audit/${row.id || row._id}`,
  },
};

const NAV_ITEMS = [
  ['dashboard', 'Dashboard', HeartPulse],
  ['accounts', 'Tài khoản', UserRound],
  ['relatives', 'Người thân', UsersRound],
  ['authorizations', 'Ủy quyền', ShieldCheck],
  ['profilePolicies', 'Field policy', FileText],
  ['profileChanges', 'Cập nhật hồ sơ', ClipboardCheck],
  ['documents', 'Tài liệu upload', UploadCloud],
  ['exports', 'Xuất hồ sơ', Download],
  ['insurance', 'Bảo hiểm', ShieldAlert],
  ['featureFlags', 'Feature flags', Flag],
  ['audit', 'Audit', FileClock],
];

const STATUS_TONE = {
  active: 'success',
  healthy: 'success',
  verified: 'success',
  accepted: 'success',
  approved: 'success',
  ready: 'success',
  success: 'success',
  clean: 'success',
  pending: 'warning',
  pending_review: 'warning',
  submitted: 'warning',
  processing: 'warning',
  pending_verification: 'warning',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
  locked: 'danger',
  disabled: 'muted',
  blocked: 'danger',
  rejected: 'danger',
  revoked: 'danger',
  failed: 'danger',
  infected: 'danger',
  expired: 'muted',
  cancelled: 'muted',
  inactive: 'muted',
  skipped: 'muted',
};

const COLUMNS = {
  accounts: [
    ['patient.full_name', 'Patient'],
    ['patient.patient_code', 'MRN'],
    ['username', 'Username'],
    ['email', 'Email'],
    ['auth_provider', 'Auth'],
    ['status', 'Status', 'status'],
    ['failed_login_attempts', 'Failed'],
    ['active_session_count', 'Sessions'],
    ['last_login_at', 'Last login'],
    ['risk_level', 'Risk', 'status'],
  ],
  relatives: [
    ['full_name', 'Relative'],
    ['relationship', 'Relationship'],
    ['patient.full_name', 'Patient'],
    ['phone', 'Phone'],
    ['relationship_verified', 'Verified'],
    ['authorization_active_count', 'Active auth'],
    ['status', 'Status', 'status'],
    ['created_at', 'Created'],
  ],
  authorizations: [
    ['patient.full_name', 'Patient'],
    ['relative.full_name', 'Relative'],
    ['relative.relationship', 'Relationship'],
    ['authorization_type', 'Type'],
    ['permissions', 'Scopes'],
    ['valid_to', 'Valid to'],
    ['status', 'Status', 'status'],
    ['is_expiring_soon', 'Expiring'],
  ],
  profilePolicies: [
    ['field_name', 'Field'],
    ['group', 'Group'],
    ['patient_editable', 'Editable'],
    ['requires_review', 'Review'],
    ['requires_attachment', 'Attachment'],
    ['sensitive', 'Sensitive'],
    ['sla_hours', 'SLA h'],
    ['risk_level', 'Risk', 'status'],
    ['enabled', 'Enabled'],
  ],
  profileChanges: [
    ['patient.full_name', 'Patient'],
    ['change_type', 'Change type'],
    ['changed_fields', 'Fields'],
    ['requested_by_actor.actor_type', 'Requested by'],
    ['risk_level', 'Risk', 'status'],
    ['status', 'Status', 'status'],
    ['created_at', 'Created'],
    ['reviewed_at', 'Reviewed'],
  ],
  documents: [
    ['original_name', 'File'],
    ['patient.full_name', 'Patient'],
    ['category', 'Category'],
    ['review_status', 'Review', 'status'],
    ['scan_status', 'Scan', 'status'],
    ['visibility', 'Visibility'],
    ['released_to_patient', 'Released'],
    ['file_size', 'Size'],
    ['created_at', 'Uploaded'],
  ],
  exports: [
    ['request_code', 'Request'],
    ['patient.full_name', 'Patient'],
    ['requested_by_actor_type', 'Actor'],
    ['export_type', 'Type'],
    ['attachment_count', 'Files'],
    ['status', 'Status', 'status'],
    ['created_at', 'Created'],
    ['expires_at', 'Expires'],
  ],
  insurance: [
    ['patient.full_name', 'Patient'],
    ['payer_name', 'Payer'],
    ['policy_no_masked', 'Policy'],
    ['coverage_percent', 'Coverage %'],
    ['valid_to', 'Valid to'],
    ['verification_status', 'Verify', 'status'],
    ['missing_front_card', 'No front'],
    ['missing_back_card', 'No back'],
    ['submitted_at', 'Submitted'],
  ],
  featureFlags: [
    ['key', 'Flag key'],
    ['name', 'Name'],
    ['group', 'Group'],
    ['enabled', 'Enabled', 'status'],
    ['rollout_percentage', 'Rollout %'],
    ['risk_level', 'Risk', 'status'],
    ['updated_at', 'Updated'],
  ],
  audit: [
    ['created_at', 'Time'],
    ['actor_type', 'Actor'],
    ['action', 'Action'],
    ['target_type', 'Target'],
    ['status', 'Status', 'status'],
    ['severity', 'Severity', 'status'],
    ['ip_address', 'IP'],
    ['message', 'Message'],
  ],
};

function getNested(row, path) {
  return String(path || '').split('.').reduce((value, key) => (value ? value[key] : undefined), row);
}

function getRowId(row = {}) {
  return row.id || row._id || row.key || row.request_code || row.field_name;
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('vi-VN') : '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('vi-VN');
  if (value instanceof Date) return value.toLocaleString('vi-VN');
  if (typeof value === 'object') return value.full_name || value.patient_code || value.name || value.label || JSON.stringify(value);
  return String(value);
}

function StatusBadge({ value }) {
  const text = value === true ? 'enabled' : value === false ? 'disabled' : value || 'unknown';
  const tone = STATUS_TONE[text] || STATUS_TONE[String(text).toLowerCase()] || 'neutral';
  return <span className={`ppa-badge ppa-badge--${tone}`}>{formatValue(text)}</span>;
}

function KpiCard({ label, value, tone = 'neutral', icon: Icon }) {
  return (
    <article className={`ppa-kpi ppa-kpi--${tone}`}>
      <div className="ppa-kpi__icon">{Icon ? <Icon size={18} strokeWidth={2.3} /> : null}</div>
      <span>{label}</span>
      <strong>{formatValue(value)}</strong>
    </article>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button type="button" className="ppa-icon-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon size={16} strokeWidth={2.25} />
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, variant = 'default', disabled }) {
  return (
    <button type="button" className={`ppa-action ppa-action--${variant}`} onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={16} strokeWidth={2.25} /> : null}
      <span>{label}</span>
    </button>
  );
}

function buildKpis(view, data, summary) {
  if (view === 'dashboard') {
    const kpis = data?.kpis || {};
    return [
      ['Tài khoản active', kpis.active_accounts, 'success', UserRound],
      ['Tài khoản bị khóa', kpis.locked_accounts, kpis.locked_accounts ? 'danger' : 'neutral', LockKeyhole],
      ['Tài khoản rủi ro', kpis.risk_accounts, kpis.risk_accounts ? 'danger' : 'neutral', ShieldAlert],
      ['Profile pending', kpis.profile_change_pending, 'warning', ClipboardCheck],
      ['Document pending', kpis.document_review_pending, 'warning', UploadCloud],
      ['Insurance review', kpis.insurance_pending_review, 'warning', ShieldCheck],
      ['Authorization pending', kpis.authorization_pending, 'warning', UsersRound],
      ['Export failed', kpis.export_failed, kpis.export_failed ? 'danger' : 'neutral', AlertTriangle],
      ['Sensitive access', kpis.sensitive_access_today, kpis.sensitive_access_today ? 'danger' : 'neutral', FileClock],
    ];
  }

  const source = summary || {};
  return Object.entries(source)
    .filter(([, value]) => typeof value !== 'object')
    .slice(0, 10)
    .map(([key, value]) => [
      key.replaceAll('_', ' '),
      value,
      String(key).includes('failed') || String(key).includes('locked') || String(key).includes('risk') ? 'danger' : 'neutral',
      Activity,
    ]);
}

function PatientCell({ row }) {
  const patient = row.patient || {};
  return (
    <div className="ppa-patient-cell">
      <strong>{patient.full_name || row.full_name || '-'}</strong>
      <span>{patient.patient_code || row.patient_code || row.email || row.phone || '-'}</span>
    </div>
  );
}

function DataTable({ view, items, onSelect, onAction }) {
  const columns = COLUMNS[view] || COLUMNS.accounts;
  return (
    <div className="ppa-table-wrap">
      <table className="ppa-table">
        <thead>
          <tr>
            {columns.map(([, label]) => <th key={label}>{label}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="ppa-empty">Chưa có dữ liệu phù hợp bộ lọc.</td>
            </tr>
          ) : items.map((row) => (
            <tr key={getRowId(row)}>
              {columns.map(([path, label, type]) => {
                const value = getNested(row, path);
                return (
                  <td key={`${getRowId(row)}-${label}`}>
                    {type === 'status' ? <StatusBadge value={value} /> : path.includes('patient.full_name') ? <PatientCell row={row} /> : formatValue(value)}
                  </td>
                );
              })}
              <td>
                <div className="ppa-row-actions">
                  <IconButton icon={Eye} label="Xem chi tiết" onClick={() => onSelect(row)} />
                  {row.id || row.key ? <IconButton icon={Copy} label="Copy ID" onClick={() => navigator.clipboard?.writeText(String(row.id || row.key))} /> : null}
                  {quickActions(view, row, onAction)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function quickActions(view, row, onAction) {
  if (view === 'accounts') {
    return (
      <>
        <IconButton icon={row.status === 'locked' ? ShieldCheck : LockKeyhole} label={row.status === 'locked' ? 'Unlock' : 'Lock'} onClick={() => onAction(row.status === 'locked' ? 'unlock' : 'lock', row)} />
        <IconButton icon={KeyRound} label="Reset password" onClick={() => onAction('resetPassword', row)} />
      </>
    );
  }
  if (view === 'relatives') {
    return <IconButton icon={row.relationship_verified ? ShieldX : ShieldCheck} label={row.relationship_verified ? 'Unverify' : 'Verify'} onClick={() => onAction(row.relationship_verified ? 'unverifyRelative' : 'verifyRelative', row)} />;
  }
  if (view === 'authorizations') {
    return (
      <>
        {row.status === 'pending' ? <IconButton icon={CheckCircle2} label="Approve" onClick={() => onAction('approveAuthorization', row)} /> : null}
        <IconButton icon={ShieldX} label="Revoke" onClick={() => onAction('revokeAuthorization', row)} />
      </>
    );
  }
  if (view === 'profileChanges') {
    return (
      <>
        {row.status === 'pending' ? <IconButton icon={CheckCircle2} label="Approve" onClick={() => onAction('approveProfileChange', row)} /> : null}
        {row.status === 'pending' ? <IconButton icon={ShieldX} label="Reject" onClick={() => onAction('rejectProfileChange', row)} /> : null}
      </>
    );
  }
  if (view === 'documents') {
    return (
      <>
        <IconButton icon={ScanLine} label="Rescan" onClick={() => onAction('rescanDocument', row)} />
        {row.review_status === 'pending' ? <IconButton icon={CheckCircle2} label="Approve" onClick={() => onAction('approveDocument', row)} /> : null}
      </>
    );
  }
  if (view === 'exports') return <IconButton icon={RefreshCw} label="Retry export" onClick={() => onAction('retryExport', row)} />;
  if (view === 'insurance') return <IconButton icon={ShieldCheck} label="Verify" onClick={() => onAction('verifyInsurance', row)} />;
  if (view === 'featureFlags') return <IconButton icon={row.enabled ? ShieldX : CheckCircle2} label={row.enabled ? 'Disable' : 'Enable'} onClick={() => onAction('toggleFlag', row)} />;
  return null;
}

function DetailDrawer({ detail, row, view, loading, onClose, onAction }) {
  if (!row) return null;
  const payload = detail || row;
  return (
    <aside className="ppa-drawer" aria-label="Chi tiết Patient Portal Admin">
      <div className="ppa-drawer__head">
        <div>
          <span>Detail drawer</span>
          <strong>{formatValue(row.patient?.full_name || row.full_name || row.key || row.request_code || row.action || getRowId(row))}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
      </div>
      <div className="ppa-drawer__actions">
        {drawerActions(view, row, onAction)}
      </div>
      {loading ? <p className="ppa-muted">Đang tải chi tiết...</p> : (
        <div className="ppa-drawer__body">
          <section>
            <h3>Overview</h3>
            <dl className="ppa-detail-grid">
              {Object.entries(payload).filter(([, value]) => typeof value !== 'object' || value === null).slice(0, 18).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll('_', ' ')}</dt>
                  <dd>{key.includes('status') || key.includes('risk') ? <StatusBadge value={value} /> : formatValue(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>Raw JSON</h3>
            <pre className="ppa-json">{JSON.stringify(payload, null, 2)}</pre>
          </section>
        </div>
      )}
    </aside>
  );
}

function drawerActions(view, row, onAction) {
  const actions = [];
  if (view === 'accounts') actions.push(['forceLogout', 'Force logout', LockKeyhole, 'danger'], ['resetPassword', 'Reset password', KeyRound, 'warning']);
  if (view === 'documents') actions.push(['rescanDocument', 'Rescan', ScanLine, 'warning'], ['approveDocument', 'Approve', CheckCircle2, 'success'], ['rejectDocument', 'Reject', ShieldX, 'danger']);
  if (view === 'profileChanges') actions.push(['approveProfileChange', 'Approve', CheckCircle2, 'success'], ['rejectProfileChange', 'Reject', ShieldX, 'danger']);
  if (view === 'insurance') actions.push(['verifyInsurance', 'Verify', ShieldCheck, 'success'], ['rejectInsurance', 'Reject', ShieldX, 'danger']);
  if (view === 'exports') actions.push(['retryExport', 'Retry', RefreshCw, 'warning'], ['expireExport', 'Expire', Clock3, 'danger']);
  if (view === 'featureFlags') actions.push(['toggleFlag', row.enabled ? 'Disable' : 'Enable', row.enabled ? ShieldX : CheckCircle2, row.enabled ? 'danger' : 'success']);
  return actions.map(([action, label, Icon, variant]) => (
    <ActionButton key={action} icon={Icon} label={label} variant={variant} onClick={() => onAction(action, row)} />
  ));
}

function DashboardView({ data }) {
  const queue = data?.work_queue || [];
  const health = data?.portal_health?.components || [];
  const feed = data?.realtime_activity || [];
  return (
    <div className="ppa-dashboard-grid">
      <section className="ppa-panel">
        <div className="ppa-panel__head">
          <strong>Việc cần xử lý</strong>
          <span>Queue hợp nhất theo SLA</span>
        </div>
        <div className="ppa-work-queue">
          {queue.map((item) => (
            <Link to={item.route} key={item.type} className="ppa-work-item">
              <div>
                <strong>{item.label}</strong>
                <span>{item.sla_overdue || 0} quá SLA</span>
              </div>
              <b>{formatValue(item.count)}</b>
            </Link>
          ))}
        </div>
      </section>
      <section className="ppa-panel">
        <div className="ppa-panel__head">
          <strong>Portal health</strong>
          <span>API, scan, notification, worker và audit</span>
        </div>
        <div className="ppa-health-list">
          {health.map((item) => (
            <div className="ppa-health-row" key={item.code}>
              <StatusBadge value={item.status} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.signal}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="ppa-panel ppa-panel--wide">
        <div className="ppa-panel__head">
          <strong>Realtime activity</strong>
          <span>Audit stream mới nhất liên quan Patient Portal</span>
        </div>
        <div className="ppa-activity-feed">
          {feed.length === 0 ? <p className="ppa-muted">Chưa có hoạt động mới.</p> : feed.map((item) => (
            <div key={item.id || item._id} className="ppa-activity-item">
              <span>{new Date(item.created_at).toLocaleString('vi-VN')}</span>
              <strong>{item.action}</strong>
              <p>{item.message || item.target_type || '-'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PatientPortalAdminPage({ view = 'dashboard' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.dashboard;
  const Icon = config.icon;
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildListParams(view, { search, status });
      const [main, nextSummary] = await Promise.all([
        portalAdminGet(config.endpoint, params),
        config.summaryEndpoint ? portalAdminGet(config.summaryEndpoint) : Promise.resolve(null),
      ]);
      setData(main);
      setSummary(nextSummary);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Không thể tải Patient Portal Admin.');
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.summaryEndpoint, search, status, view]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function selectRow(row) {
    setSelected(row);
    setDetail(row);
    if (!config.detail) return;
    setDetailLoading(true);
    try {
      setDetail(await portalAdminGet(config.detail(row)));
    } catch (err) {
      setDetail({ ...row, detail_error: err.message });
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAction(action, row) {
    const reasonActions = new Set(['lock', 'resetPassword', 'forceLogout', 'revokeAuthorization', 'rejectProfileChange', 'rejectDocument', 'retryExport', 'expireExport', 'rejectInsurance']);
    const reason = reasonActions.has(action) ? window.prompt('Nhập lý do thao tác') : undefined;
    if (reasonActions.has(action) && !reason) return;
    const id = row.id || row._id;
    const key = row.key;
    const body = reason ? { reason } : {};
    const calls = {
      lock: () => portalAdminPost(`/accounts/${id}/lock`, body),
      unlock: () => portalAdminPost(`/accounts/${id}/unlock`, body),
      resetPassword: () => portalAdminPost(`/accounts/${id}/reset-password`, body),
      forceLogout: () => portalAdminPost(`/accounts/${id}/force-logout`, body),
      verifyRelative: () => portalAdminPost(`/relatives/${id}/verify-relationship`, body),
      unverifyRelative: () => portalAdminPost(`/relatives/${id}/unverify-relationship`, body),
      approveAuthorization: () => portalAdminPost(`/authorizations/${id}/approve`, body),
      revokeAuthorization: () => portalAdminPost(`/authorizations/${id}/revoke`, body),
      approveProfileChange: () => portalAdminPost(`/profile-change-requests/${id}/approve`, body),
      rejectProfileChange: () => portalAdminPost(`/profile-change-requests/${id}/reject`, body),
      approveDocument: () => portalAdminPost(`/documents/${id}/approve`, body),
      rejectDocument: () => portalAdminPost(`/documents/${id}/reject`, body),
      rescanDocument: () => portalAdminPost(`/documents/${id}/rescan`, body),
      retryExport: () => portalAdminPost(`/document-exports/${id}/retry`, body),
      expireExport: () => portalAdminPost(`/document-exports/${id}/expire`, body),
      verifyInsurance: () => portalAdminPost(`/insurance-submissions/${id}/verify`, body),
      rejectInsurance: () => portalAdminPost(`/insurance-submissions/${id}/reject`, body),
      toggleFlag: () => portalAdminPatch(`/feature-flags/${key}`, { enabled: !row.enabled }),
    };
    if (!calls[action]) return;
    try {
      await calls[action]();
      await loadData();
      if (selected) await selectRow(selected);
    } catch (err) {
      setError(err.message || 'Thao tác không thành công.');
    }
  }

  const kpis = useMemo(() => buildKpis(view, data, summary), [view, data, summary]);
  const items = data?.items || [];

  return (
    <div className="ppa-shell">
      <header className="ppa-hero">
        <div className="ppa-hero__title">
          <span className="ppa-hero__icon"><Icon size={24} strokeWidth={2.35} /></span>
          <div>
            <p>Quản trị hệ thống / Patient Portal Admin</p>
            <h1>{config.title}</h1>
            <span>{config.subtitle}</span>
          </div>
        </div>
        <div className="ppa-hero__actions">
          <span className="ppa-env-badge">production control plane</span>
          <span className="ppa-health-badge"><Activity size={14} /> {data?.portal_health?.status || data?.status || 'live'}</span>
          <ActionButton icon={RefreshCw} label="Refresh" onClick={loadData} disabled={loading} />
        </div>
      </header>

      <nav className="ppa-nav" aria-label="Patient Portal Admin views">
        {NAV_ITEMS.map(([key, label, NavIcon]) => (
          <Link key={key} to={key === 'dashboard' ? '/admin/patient-portal' : `/admin/patient-portal/${routeForView(key)}`} className={key === view ? 'is-active' : ''}>
            <NavIcon size={15} strokeWidth={2.25} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <section className="ppa-kpi-strip">
        {kpis.map(([label, value, tone, KpiIcon]) => <KpiCard key={label} label={label} value={value} tone={tone} icon={KpiIcon} />)}
      </section>

      {view !== 'dashboard' ? (
        <section className="ppa-filter-bar">
          <div className="ppa-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, MRN, email, ID, action, file, policy..." />
          </div>
          <label>
            <Filter size={15} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {statusOptions(view).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <span className="ppa-muted">Last refresh: {lastUpdated ? lastUpdated.toLocaleTimeString('vi-VN') : '-'}</span>
        </section>
      ) : null}

      {error ? <div className="ppa-alert"><AlertTriangle size={16} /> {error}</div> : null}

      {loading ? (
        <div className="ppa-loading"><RefreshCw size={18} /> Đang tải Patient Portal Admin...</div>
      ) : view === 'dashboard' ? (
        <DashboardView data={data} />
      ) : (
        <DataTable view={view} items={items} onSelect={selectRow} onAction={handleAction} />
      )}

      <DetailDrawer detail={detail} row={selected} view={view} loading={detailLoading} onClose={() => setSelected(null)} onAction={handleAction} />
    </div>
  );
}

function routeForView(view) {
  const routes = {
    accounts: 'accounts',
    relatives: 'relatives',
    authorizations: 'authorizations',
    profilePolicies: 'profile-field-policies',
    profileChanges: 'profile-change-requests',
    documents: 'documents',
    exports: 'document-exports',
    insurance: 'insurance-submissions',
    featureFlags: 'feature-flags',
    audit: 'audit',
  };
  return routes[view] || '';
}

function buildListParams(view, state) {
  if (view === 'dashboard') return {};
  const params = { search: state.search };
  if (view === 'documents') params.review_status = state.status;
  else if (view === 'insurance') params.verification_status = state.status;
  else if (view !== 'featureFlags' && view !== 'profilePolicies') params.status = state.status;
  return params;
}

function statusOptions(view) {
  const map = {
    accounts: ['active', 'pending_verification', 'locked', 'disabled'],
    relatives: ['active', 'inactive', 'blocked'],
    authorizations: ['pending', 'active', 'expired', 'revoked', 'rejected'],
    profileChanges: ['pending', 'approved', 'rejected', 'cancelled'],
    documents: ['pending', 'accepted', 'rejected'],
    exports: ['pending', 'processing', 'ready', 'failed', 'expired'],
    insurance: ['draft', 'submitted', 'pending_review', 'verified', 'rejected', 'expired'],
    audit: ['success', 'failed', 'denied'],
  };
  return map[view] || [];
}
