import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Banknote,
  BellRing,
  CheckCircle2,
  Clock3,
  Database,
  FileClock,
  Fingerprint,
  Gauge,
  Globe2,
  HeartPulse,
  KeyRound,
  Mail,
  Play,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  ServerCog,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  UploadCloud,
  Vault,
  XCircle,
} from 'lucide-react';
import { formatDateTime, formatNumber } from '../systemUi';
import {
  applyPlatformConfig,
  getPlatformConfigDrift,
  getPlatformConfigModule,
  getPlatformConfigOverview,
  getPlatformSecretsStatus,
  getSettingRevisions,
  reloadPlatformConfig,
  rollbackSetting,
  testPlatformConfigModule,
  validatePlatformConfig,
} from '../../platform-config/platformConfigApi';

const MODULE_ICONS = {
  general: Settings,
  features: Sparkles,
  login: KeyRound,
  security: ShieldCheck,
  google_oauth: Globe2,
  notifications: BellRing,
  email_smtp: Mail,
  push_notification: Smartphone,
  realtime: RadioTower,
  file_upload: UploadCloud,
  qr_token: ScanLine,
  payments: Banknote,
  patient_portal: HeartPulse,
  support_sla: Gauge,
  audit_retention: Archive,
};

const SOURCE_LABELS = {
  db: 'DB',
  env: 'ENV',
  default: 'Mặc định',
  runtime: 'Runtime',
};

const PLATFORM_LABELS = {
  healthy: 'Ổn định',
  warning: 'Cảnh báo',
  critical: 'Nghiêm trọng',
  connected: 'Đã kết nối',
  unknown: 'Không rõ',
  development: 'Development',
  configured: 'Đã cấu hình',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  none: 'Không có',
  restart: 'Cần restart',
  runtime: 'Runtime',
};

function platformLabel(value) {
  const text = String(value || '');
  return PLATFORM_LABELS[text] || text;
}

function normalizeTab(value) {
  return String(value || 'general').trim().toLowerCase().replace(/_/g, '-');
}

function routeKeyOf(module = {}) {
  return module.route_key || String(module.module_key || 'general').replace(/_/g, '-');
}

function sourceTone(source) {
  if (source === 'db') return 'success';
  if (source === 'env') return 'warning';
  if (source === 'runtime') return 'info';
  return 'muted';
}

function riskTone(level) {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

function healthTone(status) {
  if (status === 'critical') return 'critical';
  if (status === 'warning') return 'warning';
  return 'healthy';
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return 'Chưa cấu hình';
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  if (typeof value === 'number') return formatNumber(value);
  if (Array.isArray(value)) return value.length ? value.join(', ') : '[]';
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'configured')) {
      return value.configured ? `Đã cấu hình / ${value.fingerprint || 'không có fingerprint'}` : 'Chưa cấu hình';
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function draftValue(setting) {
  if (setting.is_sensitive || setting.is_encrypted) return '';
  const value = setting.setting_value ?? setting.effective_value ?? setting.default_value;
  if (setting.value_type === 'json' || setting.value_type === 'array') {
    return JSON.stringify(value ?? (setting.value_type === 'array' ? [] : {}), null, 2);
  }
  if (setting.value_type === 'boolean') return Boolean(value);
  return value ?? '';
}

function parseDraft(setting, value) {
  if (setting.value_type === 'number') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${setting.setting_key} phải là số hợp lệ.`);
    return parsed;
  }
  if (setting.value_type === 'boolean') return Boolean(value);
  if (setting.value_type === 'json') {
    const parsed = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${setting.setting_key} phải là JSON object.`);
    }
    return parsed;
  }
  if (setting.value_type === 'array') {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) throw new Error(`${setting.setting_key} phải là JSON array.`);
    return parsed;
  }
  return String(value ?? '');
}

function isSettingChanged(setting, drafts, initialDrafts) {
  const current = drafts[setting.setting_key];
  const initial = initialDrafts[setting.setting_key];
  if (setting.is_sensitive || setting.is_encrypted) return String(current || '').trim().length > 0;
  return JSON.stringify(current) !== JSON.stringify(initial);
}

function StatusBadge({ children, tone = 'muted' }) {
  return <span className={`platform-config-badge platform-config-badge--${tone}`}>{children}</span>;
}

function LoadingBlock() {
  return (
    <section className="platform-config-state">
      <RefreshCw size={18} />
      <span>Đang tải control plane cấu hình...</span>
    </section>
  );
}

function ErrorBlock({ message, onRetry }) {
  return (
    <section className="platform-config-state platform-config-state--error">
      <AlertTriangle size={18} />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </section>
  );
}

function SecretField({ setting, value, onChange }) {
  const status = setting.secret_status || {};
  return (
    <div className="platform-config-secret">
      <div>
        <span>{status.configured ? 'Secret đã cấu hình' : 'Secret chưa cấu hình'}</span>
        <strong>{status.fingerprint || 'no fingerprint'}</strong>
      </div>
      <input
        type="password"
        value={value || ''}
        placeholder="Nhập secret mới"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SettingInput({ setting, value, onChange }) {
  if (setting.is_sensitive || setting.is_encrypted) {
    return <SecretField setting={setting} value={value} onChange={onChange} />;
  }

  if (setting.value_type === 'boolean') {
    return (
      <button
        type="button"
        className={`platform-config-switch${value ? ' is-on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={Boolean(value)}
      >
        <span />
      </button>
    );
  }

  if (setting.value_type === 'json' || setting.value_type === 'array') {
    return (
      <textarea
        rows={setting.value_type === 'json' ? 8 : 5}
        value={value || ''}
        spellCheck="false"
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      type={setting.value_type === 'number' ? 'number' : 'text'}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function PlatformMetric({ icon: Icon, label, value, note, tone = 'blue' }) {
  return (
    <article className={`platform-config-metric platform-config-metric--${tone}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

export function SystemSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get('tab') || 'general');
  const [overview, setOverview] = useState(null);
  const [moduleData, setModuleData] = useState(null);
  const [drift, setDrift] = useState(null);
  const [secrets, setSecrets] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [initialDrafts, setInitialDrafts] = useState({});
  const [selectedKey, setSelectedKey] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [filter, setFilter] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [moduleLoading, setModuleLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const activeModule = useMemo(() => {
    const modules = overview?.modules || [];
    return modules.find((item) => normalizeTab(routeKeyOf(item)) === activeTab)
      || modules.find((item) => item.module_key === activeTab.replace(/-/g, '_'))
      || modules[0]
      || { module_key: 'general', route_key: 'general', title: 'Cấu hình chung' };
  }, [activeTab, overview]);

  const settings = moduleData?.settings || [];
  const validationIssues = moduleData?.validation?.issues || [];
  const changedSettings = useMemo(
    () => settings.filter((setting) => isSettingChanged(setting, drafts, initialDrafts)),
    [settings, drafts, initialDrafts],
  );
  const filteredSettings = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return settings;
    return settings.filter((setting) =>
      `${setting.setting_key} ${setting.setting_name} ${setting.description || ''}`.toLowerCase().includes(keyword),
    );
  }, [filter, settings]);

  const selectedSetting = settings.find((setting) => setting.setting_key === selectedKey) || settings[0];
  const selectedModuleIcon = MODULE_ICONS[activeModule?.module_key] || Settings;
  const ActiveIcon = selectedModuleIcon;

  async function loadOverview() {
    setLoading(true);
    setError('');
    try {
      const [overviewData, driftData, secretsData] = await Promise.all([
        getPlatformConfigOverview(),
        getPlatformConfigDrift(),
        getPlatformSecretsStatus(),
      ]);
      setOverview(overviewData);
      setDrift(driftData);
      setSecrets(secretsData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadModule(moduleKey = activeModule?.module_key) {
    if (!moduleKey) return;
    setModuleLoading(true);
    setError('');
    try {
      const data = await getPlatformConfigModule(moduleKey);
      const nextDrafts = Object.fromEntries((data.settings || []).map((setting) => [setting.setting_key, draftValue(setting)]));
      setModuleData(data);
      setDrafts(nextDrafts);
      setInitialDrafts(nextDrafts);
      setSelectedKey((current) => current && data.settings?.some((setting) => setting.setting_key === current)
        ? current
        : data.settings?.[0]?.setting_key || '');
      setTestResult(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setModuleLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (activeModule?.module_key) loadModule(activeModule.module_key);
  }, [activeModule?.module_key]);

  useEffect(() => {
    if (!selectedSetting?.setting_key) return;
    getSettingRevisions(selectedSetting.setting_key)
      .then((data) => setRevisions(data?.items || []))
      .catch(() => setRevisions([]));
  }, [selectedSetting?.setting_key]);

  function openModule(module) {
    setSearchParams(module.route_key === 'general' ? {} : { tab: routeKeyOf(module) });
  }

  function updateDraft(settingKey, value) {
    setDrafts((current) => ({ ...current, [settingKey]: value }));
    setMessage('');
  }

  async function runValidation() {
    setSaving(true);
    try {
      const data = await validatePlatformConfig({ module_key: activeModule.module_key });
      setModuleData((current) => current ? { ...current, validation: data } : current);
      setMessage(data.ok ? 'Validation passed.' : 'Validation có cảnh báo cần xử lý.');
    } catch (validateError) {
      setError(validateError.message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setSaving(true);
    try {
      const result = await testPlatformConfigModule(activeModule.module_key);
      setTestResult(result);
      setMessage(`Test module trả về trạng thái ${result.status}.`);
    } catch (testError) {
      setError(testError.message);
    } finally {
      setSaving(false);
    }
  }

  async function applyChanges() {
    setSaving(true);
    setError('');
    try {
      const changes = changedSettings.map((setting) => ({
        setting_key: setting.setting_key,
        setting_value: parseDraft(setting, drafts[setting.setting_key]),
      }));

      if (!changes.length) {
        setMessage('Không có thay đổi cần áp dụng.');
        return;
      }

        await applyPlatformConfig(changes, changeReason || `Cập nhật ${activeModule.title}`);
      setMessage(`Đã áp dụng ${changes.length} thay đổi.`);
      setChangeReason('');
      await Promise.all([loadOverview(), loadModule(activeModule.module_key)]);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function reloadRuntime() {
    setSaving(true);
    try {
      await reloadPlatformConfig();
      setMessage('Đã đánh dấu reload runtime.');
      await loadOverview();
    } catch (reloadError) {
      setError(reloadError.message);
    } finally {
      setSaving(false);
    }
  }

  async function rollbackRevision(revisionNo) {
    if (!selectedSetting?.setting_key) return;
    setSaving(true);
    try {
      await rollbackSetting(selectedSetting.setting_key, revisionNo, `Khôi phục ${selectedSetting.setting_key} về revision ${revisionNo}`);
      setMessage(`Đã rollback ${selectedSetting.setting_key} về revision ${revisionNo}.`);
      await Promise.all([loadOverview(), loadModule(activeModule.module_key)]);
    } catch (rollbackError) {
      setError(rollbackError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !overview) return <LoadingBlock />;
  if (error && !overview) return <ErrorBlock message={error} onRetry={loadOverview} />;

  const health = overview?.health || {};
  const stats = overview?.stats || {};
  const moduleHealth = healthTone(activeModule?.health || health.status);
  const restartRequired = changedSettings.filter((setting) => setting.requires_restart);
  const affectedServices = [...new Set(changedSettings.flatMap((setting) => setting.affected_services || []))];
  const driftCount = drift?.drift_count || 0;
  const secretCount = secrets?.items?.filter((item) => item.configured).length || 0;

  return (
    <section className="platform-config-page">
      <section className={`platform-config-hero platform-config-hero--${moduleHealth}`}>
        <div className="platform-config-hero__icon">
          <ActiveIcon size={26} strokeWidth={2.25} />
        </div>
        <div className="platform-config-hero__copy">
          <p className="admin-page-header__eyebrow">Quản trị hệ thống / Cấu hình nền tảng</p>
          <h1>{activeModule?.title || 'Cấu hình nền tảng'}</h1>
          <div className="platform-config-hero__meta">
            <StatusBadge tone={healthTone(health.status)}>{platformLabel(health.status || 'healthy')}</StatusBadge>
            <StatusBadge tone="info">Env {overview?.environment?.node_env || 'development'}</StatusBadge>
            <StatusBadge tone={overview?.environment?.database_state === 'connected' ? 'success' : 'warning'}>
              DB {platformLabel(overview?.environment?.database_state || 'unknown')}
            </StatusBadge>
            <StatusBadge tone="muted">
              Tải lại {overview?.environment?.last_reload_at ? formatDateTime(overview.environment.last_reload_at) : 'chưa có'}
            </StatusBadge>
          </div>
        </div>
        <div className="platform-config-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={runValidation} disabled={saving}>
            <ShieldAlert size={16} /> Kiểm tra
          </button>
          <button type="button" className="staff-button staff-button--ghost" onClick={runTest} disabled={saving}>
            <Play size={16} /> Kiểm thử
          </button>
          <button type="button" className="staff-button staff-button--ghost" onClick={reloadRuntime} disabled={saving}>
            <RefreshCw size={16} /> Tải lại
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={applyChanges} disabled={saving || !changedSettings.length}>
            <Save size={16} /> Áp dụng {changedSettings.length ? `(${changedSettings.length})` : ''}
          </button>
        </div>
      </section>

      {validationIssues.length > 0 ? (
        <section className="platform-config-alert-strip">
          {validationIssues.slice(0, 4).map((item) => (
            <article key={`${item.setting_key}-${item.message}`} className={`is-${item.severity}`}>
              <AlertTriangle size={15} />
              <span>{item.message}</span>
            </article>
          ))}
        </section>
      ) : (
        <section className="platform-config-alert-strip platform-config-alert-strip--ok">
          <article>
            <CheckCircle2 size={15} />
            <span>Module hiện tại không có lỗi validation nghiêm trọng.</span>
          </article>
        </section>
      )}

      {error ? <ErrorBlock message={error} onRetry={() => loadModule(activeModule.module_key)} /> : null}
      {message ? <p className="form-message success">{message}</p> : null}

      <section className="platform-config-nav">
        {(overview?.modules || []).map((module) => {
          const Icon = MODULE_ICONS[module.module_key] || Settings;
          const active = activeModule?.module_key === module.module_key;
          return (
            <button key={module.module_key} type="button" className={active ? 'is-active' : ''} onClick={() => openModule(module)}>
              <Icon size={16} />
              <span>{module.title}</span>
              <StatusBadge tone={healthTone(module.health)}>{module.issue_count || 0}</StatusBadge>
            </button>
          );
        })}
      </section>

      <section className="platform-config-metrics">
        <PlatformMetric icon={Database} label="Cấu hình hiệu lực" value={formatNumber(settings.length)} note={`${formatNumber(activeModule?.db_setting_count || 0)} từ DB`} tone="blue" />
        <PlatformMetric icon={AlertTriangle} label="Validation" value={formatNumber(validationIssues.length)} note={`${health?.validation?.counts?.critical || 0} critical toàn hệ thống`} tone={validationIssues.length ? 'amber' : 'green'} />
        <PlatformMetric icon={ServerCog} label="Cần restart" value={formatNumber(activeModule?.requires_restart_count || 0)} note={`${restartRequired.length} thay đổi đang chờ`} tone="violet" />
        <PlatformMetric icon={Vault} label="Secrets" value={formatNumber(secretCount)} note={`${formatNumber(activeModule?.sensitive_count || 0)} trong module`} tone="slate" />
        <PlatformMetric icon={Fingerprint} label="Lệch cấu hình" value={formatNumber(driftCount)} note="DB so với ENV" tone={driftCount ? 'red' : 'green'} />
        <PlatformMetric icon={Clock3} label="Runtime" value={formatNumber(stats.connected_sockets || 0)} note={`${formatNumber(stats.active_sessions || 0)} phiên đang hoạt động`} tone="cyan" />
      </section>

      <section className="platform-config-main">
        <article className="platform-config-panel platform-config-effective">
          <div className="platform-config-panel__head">
            <div>
              <span>Cấu hình hiệu lực</span>
              <strong>{activeModule?.module_key}</strong>
            </div>
            <label className="platform-config-search">
              <Search size={15} />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Tìm khóa cấu hình" />
            </label>
          </div>

          <div className="platform-config-table">
            <div className="platform-config-table__head">
              <span>Cấu hình</span>
              <span>Giá trị</span>
              <span>Nguồn</span>
              <span>Rủi ro</span>
            </div>
            {moduleLoading ? (
              <div className="platform-config-table__empty"><RefreshCw size={16} /> Đang tải module...</div>
            ) : filteredSettings.map((setting) => (
              <button
                type="button"
                key={setting.setting_key}
                className={`platform-config-row${selectedSetting?.setting_key === setting.setting_key ? ' is-selected' : ''}`}
                onClick={() => setSelectedKey(setting.setting_key)}
              >
                <span>
                  <strong>{setting.setting_key}</strong>
                  <small>{setting.setting_name}</small>
                </span>
                <span title={formatValue(setting.effective_value)}>{formatValue(setting.effective_value)}</span>
                <span><StatusBadge tone={sourceTone(setting.effective_source)}>{SOURCE_LABELS[setting.effective_source] || setting.effective_source}</StatusBadge></span>
                <span><StatusBadge tone={riskTone(setting.risk_level)}>{platformLabel(setting.risk_level)}</StatusBadge></span>
              </button>
            ))}
          </div>
        </article>

        <article className="platform-config-panel platform-config-editor">
          <div className="platform-config-panel__head">
            <div>
              <span>Trình chỉnh sửa cấu hình</span>
              <strong>{selectedSetting?.setting_key || 'Chọn setting'}</strong>
            </div>
            {selectedSetting ? (
              <StatusBadge tone={selectedSetting.requires_restart ? 'warning' : 'success'}>
                {selectedSetting.requires_restart ? 'restart' : 'runtime'}
              </StatusBadge>
            ) : null}
          </div>

          <div className="platform-config-editor__list">
            {filteredSettings.map((setting) => (
              <label key={setting.setting_key} className={`platform-config-field${isSettingChanged(setting, drafts, initialDrafts) ? ' is-dirty' : ''}`}>
                <span>
                  <strong>{setting.setting_name}</strong>
                  <small>{setting.setting_key}</small>
                </span>
                <SettingInput
                  setting={setting}
                  value={drafts[setting.setting_key]}
                  onChange={(value) => updateDraft(setting.setting_key, value)}
                />
              </label>
            ))}
          </div>

          <label className="platform-config-reason">
            <span>Lý do thay đổi</span>
            <input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="VD: siết cấu hình SMTP production" />
          </label>
        </article>
      </section>

      <section className="platform-config-secondary">
        <article className="platform-config-panel">
          <div className="platform-config-panel__head">
            <div>
              <span>Kiểm thử / chẩn đoán</span>
              <strong>{testResult?.status || 'Chưa chạy'}</strong>
            </div>
            <button type="button" className="platform-config-icon-button" onClick={runTest} disabled={saving} aria-label="Chạy chẩn đoán">
              <Play size={16} />
            </button>
          </div>
          {testResult ? (
            <pre className="platform-config-json">{JSON.stringify(testResult, null, 2)}</pre>
          ) : (
            <div className="platform-config-empty">
              <ServerCog size={22} />
              <span>Chẩn đoán sẽ chạy bằng endpoint backend của module hiện tại.</span>
            </div>
          )}
        </article>

        <article className="platform-config-panel">
          <div className="platform-config-panel__head">
            <div>
              <span>Xem trước ảnh hưởng</span>
              <strong>{changedSettings.length} thay đổi</strong>
            </div>
            <StatusBadge tone={restartRequired.length ? 'warning' : 'success'}>
              {restartRequired.length ? 'cần restart' : 'có thể tải lại runtime'}
            </StatusBadge>
          </div>
          <div className="platform-config-impact">
            <div>
              <span>Cấu hình đổi</span>
              <strong>{changedSettings.map((item) => item.setting_key).join(', ') || 'Không có'}</strong>
            </div>
            <div>
              <span>Dịch vụ ảnh hưởng</span>
              <strong>{affectedServices.join(', ') || 'Không có'}</strong>
            </div>
            <div>
              <span>Rủi ro cao nhất</span>
              <strong>{platformLabel(changedSettings.some((item) => item.risk_level === 'critical') ? 'critical' : changedSettings.some((item) => item.risk_level === 'high') ? 'high' : changedSettings.length ? 'medium' : 'none')}</strong>
            </div>
          </div>
        </article>

        <article className="platform-config-panel">
          <div className="platform-config-panel__head">
            <div>
              <span>Bảng validation</span>
              <strong>{validationIssues.length ? `${validationIssues.length} vấn đề` : 'đạt'}</strong>
            </div>
            <button type="button" className="platform-config-icon-button" onClick={runValidation} disabled={saving} aria-label="Kiểm tra">
              <ShieldAlert size={16} />
            </button>
          </div>
          <div className="platform-config-issues">
            {validationIssues.length ? validationIssues.map((item) => (
              <article key={`${item.setting_key}-${item.message}`} className={`is-${item.severity}`}>
                {item.severity === 'critical' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                <span>
                  <strong>{item.setting_key}</strong>
                  <small>{item.message}</small>
                </span>
              </article>
            )) : (
              <article className="is-ok">
                <CheckCircle2 size={16} />
                <span><strong>Đạt</strong><small>Không có vấn đề trong module hiện tại.</small></span>
              </article>
            )}
          </div>
        </article>
      </section>

      <section className="platform-config-panel platform-config-audit">
        <div className="platform-config-panel__head">
          <div>
            <span>Audit / dòng thời gian revision</span>
            <strong>{selectedSetting?.setting_key || 'Chọn setting'}</strong>
          </div>
          <button type="button" className="staff-button staff-button--ghost" disabled={!selectedSetting || !revisions.length || saving} onClick={() => rollbackRevision(revisions[0]?.revision_no)}>
            <RotateCcw size={16} /> Khôi phục gần nhất
          </button>
        </div>
        <div className="platform-config-timeline">
          {revisions.length ? revisions.map((revision) => (
            <article key={revision.revision_id}>
              <FileClock size={17} />
              <span>
                <strong>Revision {revision.revision_no} / {revision.action}</strong>
                <small>{revision.created_at ? formatDateTime(revision.created_at) : 'không rõ'} · {(revision.changed_fields || []).join(', ') || 'không có diff'}</small>
              </span>
              <button type="button" onClick={() => rollbackRevision(revision.revision_no)} disabled={saving || revision.action === 'create'}>
                Khôi phục
              </button>
            </article>
          )) : (
            <div className="platform-config-empty">
              <FileClock size={22} />
              <span>Chưa có revision cho setting đang chọn.</span>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
