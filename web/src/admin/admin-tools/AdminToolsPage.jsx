import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  CloudUpload,
  Code2,
  Database,
  Download,
  Eye,
  FileCog,
  FileJson,
  GitBranch,
  HardDrive,
  KeyRound,
  Network,
  Play,
  RefreshCw,
  Router,
  Search,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Timer,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminToolsGet, adminToolsPost } from './adminToolsApi';

const TOOL_VIEWS = {
  overview: {
    title: 'Admin Tools Overview',
    subtitle: 'Technical Control Plane cho route guard, RBAC, permission, data consistency, indexes, migration, cleanup, cache, export và diagnostics.',
    icon: FileCog,
  },
  routeGuards: {
    code: 'route-guards',
    title: 'Kiểm tra route guards',
    subtitle: 'Quét Express router để phát hiện route thiếu authenticate, authorize, permission cụ thể và validation.',
    icon: Router,
    route: '/admin/admin-tools/route-guards',
  },
  rbacIntegrity: {
    code: 'rbac-integrity',
    title: 'Kiểm tra RBAC integrity',
    subtitle: 'So khớp constants, DB roles, permissions và role-permission links với repair evidence.',
    icon: ShieldCheck,
    route: '/admin/admin-tools/rbac-integrity',
  },
  permissionMap: {
    code: 'permission-map',
    title: 'Kiểm tra permission map',
    subtitle: 'Quét PERMISSION.* trong source, phát hiện missing references và quyền dùng nhưng chưa gán role.',
    icon: TableProperties,
    route: '/admin/admin-tools/permission-map',
  },
  dataConsistency: {
    code: 'data-consistency',
    title: 'Kiểm tra data consistency',
    subtitle: 'Kiểm tra lệch invoice, slot, bed, stock, lab/order, appointment và document export.',
    icon: Database,
    route: '/admin/admin-tools/data-consistency',
  },
  indexes: {
    code: 'indexes',
    title: 'Đồng bộ indexes',
    subtitle: 'Diff schema indexes với MongoDB indexes, xem risk trước khi sync.',
    icon: RefreshCw,
    route: '/admin/admin-tools/indexes',
  },
  systemAccessSync: {
    code: 'system-access-sync',
    title: 'Đồng bộ quyền hệ thống',
    subtitle: 'Preview roles, permissions và role-permission links trước khi seed/sync.',
    icon: KeyRound,
    route: '/admin/admin-tools/system-access-sync',
  },
  migrations: {
    code: 'migrations',
    title: 'Migration tools',
    subtitle: 'Catalog migration nội bộ với dry-run, impact preview, approval và run history.',
    icon: GitBranch,
    route: '/admin/admin-tools/migrations',
  },
  demoData: {
    code: 'demo-data',
    title: 'Demo data tools',
    subtitle: 'Preview seed packs, namespace demo data và khóa production cho dữ liệu demo.',
    icon: Sparkles,
    route: '/admin/admin-tools/demo-data',
  },
  cleanup: {
    code: 'cleanup',
    title: 'Cleanup tools',
    subtitle: 'Dry-run cleanup expired sessions, QR tokens, idempotency records, job logs, notifications và outbox.',
    icon: Archive,
    route: '/admin/admin-tools/cleanup',
  },
  cache: {
    code: 'cache',
    title: 'Rebuild cache',
    subtitle: 'Quan sát và clear/rebuild authorization cache, access context cache và related cache types.',
    icon: RefreshCw,
    route: '/admin/admin-tools/cache',
  },
  exports: {
    code: 'exports',
    title: 'Export hệ thống',
    subtitle: 'Tạo export manifest cấu hình, IAM, audit, diagnostics với mask secret và expiry.',
    icon: CloudUpload,
    route: '/admin/admin-tools/exports',
  },
  developerDiagnostics: {
    code: 'developer-diagnostics',
    title: 'Developer diagnostics',
    subtitle: 'Runtime, database, worker health, integrations và backend diagnostics evidence.',
    icon: HardDrive,
    route: '/admin/admin-tools/developer-diagnostics',
  },
};

const NAV_ITEMS = [
  ['overview', 'Tổng quan', FileCog],
  ['routeGuards', 'Route guards', Router],
  ['rbacIntegrity', 'RBAC', ShieldCheck],
  ['permissionMap', 'Permission map', TableProperties],
  ['dataConsistency', 'Data consistency', Database],
  ['indexes', 'Indexes', RefreshCw],
  ['systemAccessSync', 'System access', KeyRound],
  ['migrations', 'Migrations', GitBranch],
  ['demoData', 'Demo data', Sparkles],
  ['cleanup', 'Cleanup', Archive],
  ['cache', 'Cache', RefreshCw],
  ['exports', 'Exports', CloudUpload],
  ['developerDiagnostics', 'Diagnostics', HardDrive],
];

const STATUS_TONE = {
  success: 'success',
  success_with_warnings: 'warning',
  failed: 'danger',
  cancelled: 'muted',
  running: 'info',
  queued: 'info',
  requires_approval: 'danger',
  partially_applied: 'warning',
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
  info: 'muted',
  danger: 'danger',
};

const RISK_TEXT = {
  info: 'INFO',
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
  danger: 'DANGEROUS',
};

const TAB_ITEMS = [
  ['findings', 'Findings'],
  ['technical', 'Chi tiết kỹ thuật'],
  ['actions', 'Actions / Fix plan'],
  ['runs', 'Run history'],
  ['audit', 'Audit trail'],
];

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('vi-VN');
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    return new Date(text).toLocaleString('vi-VN');
  }
  return text;
}

function formatDuration(ms) {
  const value = Number(ms || 0);
  if (!value) return '-';
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function compactJson(value, limit = 600) {
  const text = JSON.stringify(value || {}, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}\n...` : text;
}

function toolPath(viewKey) {
  if (viewKey === 'overview') return '/admin/admin-tools';
  return TOOL_VIEWS[viewKey]?.route || '/admin/admin-tools';
}

function Badge({ value, tone }) {
  const label = formatValue(value);
  return <span className={`at-badge at-badge--${tone || STATUS_TONE[value] || 'muted'}`}>{label}</span>;
}

function KpiCard({ icon: Icon = Activity, label, value, tone = 'info', hint }) {
  return (
    <article className={`at-kpi at-kpi--${tone}`}>
      <span className="at-kpi__icon"><Icon size={19} /></span>
      <div>
        <span>{label}</span>
        <strong>{formatValue(value)}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </article>
  );
}

function ObjectTable({ rows = [], columns = [] }) {
  if (!rows.length) return <div className="at-empty">Không có dữ liệu kỹ thuật cho lần chạy gần nhất.</div>;
  const keys = columns.length ? columns : Object.keys(rows[0] || {}).slice(0, 8);
  return (
    <div className="at-table-wrap">
      <table className="at-table">
        <thead>
          <tr>{keys.map((key) => <th key={key}>{key.replace(/_/g, ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((row, index) => (
            <tr key={`${row.id || row._id || row.file || row.model || index}`}>
              {keys.map((key) => (
                <td key={key}>{typeof row[key] === 'object' ? compactJson(row[key], 160) : formatValue(row[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TechnicalResult({ result = {} }) {
  if (result.module_matrix) return <ObjectTable rows={result.module_matrix} columns={['file', 'risk', 'route_count', 'has_authenticate', 'has_authorize', 'actor_only_routes', 'missing_specific_permission', 'mutating_routes_missing_validation']} />;
  if (result.role_matrix) return <ObjectTable rows={result.role_matrix} columns={['role_code', 'users', 'iam', 'billing', 'clinical', 'pharmacy', 'admin', 'notifications', 'support', 'total_permissions']} />;
  if (result.coverage) return <ObjectTable rows={result.coverage} columns={['permission_code', 'risk_level', 'assigned_roles', 'route_files']} />;
  if (result.diffs) return <ObjectTable rows={result.diffs} columns={['model', 'collection', 'declared_count', 'existing_count', 'missing_indexes', 'extra_indexes']} />;
  if (result.issues) return <ObjectTable rows={result.issues} columns={['type', 'domain', 'object_type', 'object_id', 'auto_fixable', 'suggested_update']} />;
  if (result.categories) return <ObjectTable rows={result.categories} columns={['category', 'matching_records', 'oldest', 'newest', 'safe_to_delete']} />;
  if (result.catalog) return <ObjectTable rows={result.catalog} columns={['migration_code', 'name', 'domain', 'risk', 'dry_run_supported', 'rollback_supported']} />;
  if (result.packs) return <ObjectTable rows={result.packs} columns={['pack', 'script', 'namespace', 'idempotent', 'risk']} />;
  if (result.cache_types) return <ObjectTable rows={result.cache_types.map((item) => ({ cache_type: item }))} columns={['cache_type']} />;
  return <pre className="at-json">{compactJson(result, 2200)}</pre>;
}

function FindingDrawer({ finding, onClose, onAction }) {
  if (!finding) return null;
  return (
    <aside className="at-drawer" aria-label="Finding detail">
      <div className="at-drawer__header">
        <div>
          <Badge value={finding.severity} />
          <h2>{finding.type}</h2>
          <p>{finding.message}</p>
        </div>
        <button type="button" className="at-icon-button" onClick={onClose} aria-label="Close drawer"><X size={18} /></button>
      </div>
      <div className="at-drawer__grid">
        <span>Tool</span><strong>{finding.tool_code}</strong>
        <span>Domain</span><strong>{formatValue(finding.domain)}</strong>
        <span>File</span><strong>{formatValue(finding.file)}</strong>
        <span>Route</span><strong>{[finding.method, finding.route].filter(Boolean).join(' ') || '-'}</strong>
        <span>Object</span><strong>{[finding.object_type, finding.object_id].filter(Boolean).join(' / ') || '-'}</strong>
        <span>Status</span><strong>{finding.status}</strong>
      </div>
      <section>
        <h3>Evidence</h3>
        <pre className="at-json">{compactJson(finding.evidence, 1800)}</pre>
      </section>
      <section>
        <h3>Suggested fix</h3>
        <pre className="at-json">{compactJson(finding.suggested_fix, 1200)}</pre>
      </section>
      <div className="at-drawer__actions">
        <button type="button" onClick={() => onAction('resolve', finding)}>Mark resolved</button>
        <button type="button" onClick={() => onAction('ignore', finding)}>Ignore</button>
        <button type="button" className="danger" onClick={() => onAction('accept-risk', finding)}>Accept risk</button>
      </div>
    </aside>
  );
}

export function AdminToolsPage({ view = 'overview' }) {
  const config = TOOL_VIEWS[view] || TOOL_VIEWS.overview;
  const toolCode = config.code;
  const Icon = config.icon || FileCog;
  const [overview, setOverview] = useState(null);
  const [tool, setTool] = useState(null);
  const [runs, setRuns] = useState([]);
  const [findings, setFindings] = useState([]);
  const [activeTab, setActiveTab] = useState('findings');
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    const data = await adminToolsGet('');
    setOverview(data);
  }, []);

  const loadTool = useCallback(async () => {
    if (!toolCode) return;
    const [toolData, runsData, findingsData] = await Promise.all([
      adminToolsGet(`/${toolCode}`),
      adminToolsGet('/runs', { tool_code: toolCode, limit: 12 }),
      adminToolsGet('/findings', { tool_code: toolCode, limit: 120 }),
    ]);
    setTool(toolData);
    setRuns(runsData?.items || []);
    setFindings(findingsData?.items || []);
  }, [toolCode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadOverview();
      if (toolCode) await loadTool();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loadOverview, loadTool, toolCode]);

  useEffect(() => {
    setTool(null);
    setRuns([]);
    setFindings([]);
    setSelectedFinding(null);
    setActiveTab('findings');
    loadData();
  }, [loadData, view]);

  const currentRun = runs[0] || tool?.latest_run || null;
  const filteredFindings = useMemo(() => findings.filter((finding) => {
    const haystack = `${finding.type} ${finding.message} ${finding.file} ${finding.object_id}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
      && (!severity || finding.severity === severity)
      && (!status || finding.status === status);
  }), [findings, search, severity, status]);

  const kpis = useMemo(() => {
    if (!toolCode) return overview?.kpis || {};
    return currentRun?.summary || tool?.latest_run?.summary || {};
  }, [currentRun, overview, tool, toolCode]);

  async function runTool(mode) {
    if (!toolCode) return;
    setActionBusy(true);
    setError('');
    try {
      await adminToolsPost(`/${toolCode}/run`, { mode });
      await loadData();
      setActiveTab('runs');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleFindingAction(action, finding) {
    setActionBusy(true);
    setError('');
    try {
      await adminToolsPost(`/findings/${finding._id || finding.id}/${action}`, {
        reason: action === 'accept-risk' ? 'Accepted from Admin Tools console.' : undefined,
      });
      await loadTool();
      setSelectedFinding(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  const heroTone = tool?.risk_level === 'danger' || tool?.risk_level === 'critical' ? 'danger' : tool?.risk_level === 'high' ? 'warning' : 'default';

  return (
    <div className="at-page">
      <header className={`at-hero at-hero--${heroTone}`}>
        <div className="at-hero__icon"><Icon size={30} /></div>
        <div className="at-hero__copy">
          <span>Quản trị hệ thống / Admin Tools</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
          <div className="at-hero__badges">
            <Badge value={tool?.risk_level ? RISK_TEXT[tool.risk_level] : 'CONTROL PLANE'} tone={STATUS_TONE[tool?.risk_level] || 'info'} />
            <span>{tool?.tool_type || 'Technical DevOps Console'}</span>
            <span>Last run: {formatValue(currentRun?.created_at || currentRun?.started_at)}</span>
            <span>Environment: {currentRun?.environment || 'current'}</span>
          </div>
        </div>
        <div className="at-hero__actions">
          <button type="button" onClick={loadData} disabled={loading || actionBusy}><RefreshCw size={16} /> Refresh</button>
          {toolCode ? <button type="button" onClick={() => runTool(tool?.modes?.includes('diagnostic') ? 'diagnostic' : 'scan')} disabled={actionBusy}><Play size={16} /> Run scan</button> : null}
          {toolCode && tool?.modes?.includes('dry_run') ? <button type="button" onClick={() => runTool('dry_run')} disabled={actionBusy}><Eye size={16} /> Dry-run</button> : null}
          {toolCode && tool?.modes?.includes('export') ? <button type="button" onClick={() => runTool('export')} disabled={actionBusy}><Download size={16} /> Export</button> : null}
        </div>
      </header>

      <nav className="at-nav" aria-label="Admin Tools navigation">
        {NAV_ITEMS.map(([key, label, NavIcon]) => (
          <Link key={key} className={`at-nav__item ${key === view ? 'is-active' : ''}`} to={toolPath(key)}>
            <NavIcon size={16} /> {label}
          </Link>
        ))}
      </nav>

      {error ? <div className="at-alert"><AlertTriangle size={17} /> {error}</div> : null}

      <section className="at-kpi-grid">
        {toolCode ? (
          <>
            <KpiCard icon={Code2} label="Total scanned" value={kpis.route_files_scanned || kpis.files_scanned || kpis.models_loaded || kpis.checked_records || kpis.collections_checked || kpis.cleanup_categories || kpis.tools || 0} />
            <KpiCard icon={AlertTriangle} label="Critical" value={kpis.critical_count || kpis.critical_findings || 0} tone="danger" />
            <KpiCard icon={AlertTriangle} label="Warnings / High" value={(kpis.high_count || kpis.high_findings || 0) + (kpis.medium_count || 0)} tone="warning" />
            <KpiCard icon={CheckCircle2} label="Auto-fixable" value={kpis.auto_fixable_count || kpis.auto_fixable_issues || kpis.safe_records || 0} tone="success" />
            <KpiCard icon={Timer} label="Duration" value={formatDuration(currentRun?.duration_ms)} />
            <KpiCard icon={Activity} label="Status" value={currentRun?.status || 'not_run'} tone={STATUS_TONE[currentRun?.status] || 'muted'} />
          </>
        ) : (
          <>
            <KpiCard icon={FileCog} label="Tools" value={kpis.tools || 0} />
            <KpiCard icon={AlertTriangle} label="Critical findings" value={kpis.critical_findings || 0} tone="danger" />
            <KpiCard icon={AlertTriangle} label="High findings" value={kpis.high_findings || 0} tone="warning" />
            <KpiCard icon={FileJson} label="Open findings" value={kpis.open_findings || 0} />
            <KpiCard icon={ShieldCheck} label="Requires approval" value={kpis.requires_approval || 0} tone="danger" />
            <KpiCard icon={HardDrive} label="Notification failed" value={kpis.notification_failed || 0} tone={kpis.notification_failed ? 'warning' : 'success'} />
          </>
        )}
      </section>

      {!toolCode ? (
        <main className="at-overview">
          <section className="at-panel">
            <div className="at-panel__header">
              <h2>Tool grid</h2>
              <p>Mỗi tool có risk, status lần chạy gần nhất và primary action riêng.</p>
            </div>
            <div className="at-tool-grid">
              {(overview?.tools || []).map((item) => {
                const viewKey = Object.entries(TOOL_VIEWS).find(([, value]) => value.code === item.tool_code)?.[0];
                const ToolIcon = NAV_ITEMS.find(([key]) => key === viewKey)?.[2] || FileCog;
                return (
                  <Link to={toolPath(viewKey)} className="at-tool-card" key={item.tool_code}>
                    <span><ToolIcon size={22} /></span>
                    <h3>{item.tool_name}</h3>
                    <p>{item.description}</p>
                    <div>
                      <Badge value={RISK_TEXT[item.risk_level] || item.risk_level} tone={STATUS_TONE[item.risk_level] || 'info'} />
                      <Badge value={item.latest_run?.status || 'not_run'} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
          <section className="at-two-col">
            <div className="at-panel">
              <div className="at-panel__header"><h2>Việc cần xử lý</h2><p>Open/regressed findings mới nhất.</p></div>
              <ObjectTable rows={overview?.work_queue || []} columns={['severity', 'tool_code', 'type', 'message', 'file', 'object_id', 'status']} />
            </div>
            <div className="at-panel">
              <div className="at-panel__header"><h2>Activity timeline</h2><p>Run gần nhất trên toàn bộ tool.</p></div>
              <ObjectTable rows={overview?.recent_runs || []} columns={['tool_code', 'mode', 'status', 'started_at', 'finished_at', 'duration_ms']} />
            </div>
          </section>
        </main>
      ) : (
        <main className="at-console">
          <section className="at-command">
            <label className="at-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search finding, file, route, object..." />
            </label>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="">All severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All status</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
              <option value="accepted_risk">Accepted risk</option>
            </select>
            {tool?.modes?.includes('apply') ? <button type="button" className="danger" onClick={() => runTool('apply')} disabled={actionBusy}>Run apply</button> : null}
          </section>

          <section className="at-panel">
            <div className="at-tabs">
              {TAB_ITEMS.map(([key, label]) => (
                <button type="button" key={key} className={activeTab === key ? 'is-active' : ''} onClick={() => setActiveTab(key)}>{label}</button>
              ))}
            </div>

            {activeTab === 'findings' ? (
              <div className="at-table-wrap">
                <table className="at-table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Type</th>
                      <th>Module / domain</th>
                      <th>File / route</th>
                      <th>Object</th>
                      <th>Status</th>
                      <th>Auto fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFindings.map((finding) => (
                      <tr key={finding._id || finding.id} onClick={() => setSelectedFinding(finding)}>
                        <td><Badge value={finding.severity} /></td>
                        <td><strong>{finding.type}</strong><small>{finding.message}</small></td>
                        <td>{finding.module || finding.domain || '-'}</td>
                        <td>{finding.file || '-'}<small>{[finding.method, finding.route].filter(Boolean).join(' ')}</small></td>
                        <td>{[finding.object_type, finding.object_id].filter(Boolean).join(' / ') || '-'}</td>
                        <td><Badge value={finding.status} /></td>
                        <td>{finding.auto_fixable ? 'Yes' : 'Manual'}</td>
                      </tr>
                    ))}
                    {!filteredFindings.length ? <tr><td colSpan="7"><div className="at-empty">Không có finding phù hợp bộ lọc.</div></td></tr> : null}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === 'technical' ? (
              <div className="at-technical">
                <div className="at-panel__header"><h2>Chi tiết kỹ thuật lần chạy gần nhất</h2><p>{currentRun?.tool_code || toolCode} / {currentRun?.mode || 'scan'} / {currentRun?.status || 'not_run'}</p></div>
                <TechnicalResult result={currentRun?.result || tool?.latest_run?.result || {}} />
              </div>
            ) : null}

            {activeTab === 'actions' ? (
              <div className="at-action-grid">
                <article>
                  <h3>Safety gate</h3>
                  <p>Tool risk: <Badge value={RISK_TEXT[tool?.risk_level] || tool?.risk_level} tone={STATUS_TONE[tool?.risk_level] || 'info'} /></p>
                  <p>Dangerous action cần quyền `admin_tools.run_apply` và production write nếu chạy production.</p>
                </article>
                <article>
                  <h3>Fix plan / export evidence</h3>
                  <pre className="at-json">{compactJson(currentRun?.result?.fix_plan || currentRun?.result?.diff || currentRun?.result?.export_manifest || currentRun?.result || {}, 1800)}</pre>
                </article>
              </div>
            ) : null}

            {activeTab === 'runs' ? (
              <ObjectTable rows={runs} columns={['tool_code', 'mode', 'status', 'risk_level', 'started_at', 'finished_at', 'duration_ms', 'environment']} />
            ) : null}

            {activeTab === 'audit' ? (
              <div className="at-action-grid">
                <article>
                  <h3>Audit posture</h3>
                  <p>Mỗi run/finding action được ghi audit qua backend service, giữ request meta, actor và target id.</p>
                </article>
                <article>
                  <h3>Latest run raw</h3>
                  <pre className="at-json">{compactJson(currentRun, 2200)}</pre>
                </article>
              </div>
            ) : null}
          </section>
        </main>
      )}

      {loading ? <div className="at-loading">Đang tải Admin Tools...</div> : null}
      <FindingDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} onAction={handleFindingAction} />
    </div>
  );
}
