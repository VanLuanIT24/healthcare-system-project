import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  Clock3,
  Command,
  ExternalLink,
  HeartPulse,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Menu,
  MonitorDot,
  Search,
  Settings2,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { AppLogo, APP_BRAND_NAME } from '../app/AppLogo';
import { API_BASE_URL } from '../lib/api';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { authAPI, notificationAPI, preferenceAPI, unwrapData } from '../utils/api';
import { getAccessibleStaffWorkspaces, getStaffActorName } from '../receptionist/workspaceAccess';
import { flattenNurseMenu, getNursePageMeta, nurseMenuSections } from './nurseData';
import { nurseTopbarApi, nurseVitalsApi } from './nurseApi';

const NOTIFICATION_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'urgent', label: 'Khẩn cấp' },
  { key: 'nursing', label: 'Điều dưỡng' },
  { key: 'vitals', label: 'Sinh hiệu' },
  { key: 'task', label: 'Task' },
  { key: 'clinical', label: 'Kết quả CLS' },
  { key: 'system', label: 'Hệ thống' },
];

const DEFAULT_VITAL_FORM = {
  heart_rate: '',
  temperature: '',
  spo2: '',
  respiratory_rate: '',
  systolic_bp: '',
  diastolic_bp: '',
  weight: '',
  height: '',
  pain_score: '',
  blood_glucose: '',
  gcs_eye: '',
  gcs_verbal: '',
  gcs_motor: '',
  measurement_position: 'sitting',
  temperature_site: 'axillary',
  device_id: '',
  recorded_at: '',
  note: '',
};

function getInitials(name = '') {
  const initials = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'ĐD';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getNurseRoleLabel(auth, profile) {
  const roles = profile?.roles || auth?.user?.roles || auth?.roles || [];
  if (roles.includes('super_admin')) return 'Super Admin';
  if (roles.includes('department_head')) return 'Điều dưỡng trưởng';
  if (roles.includes('nurse')) return 'Điều dưỡng';
  return 'Nhân sự y tế';
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.notifications)) return value.notifications;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function getId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id || value.id || value.vital_sign_id || value.notification_id || value.queue_ticket_id || value.encounter_id || null;
}

function formatRelativeTime(value) {
  if (!value) return 'Vừa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa cập nhật';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function compactCount(value) {
  const number = Number(value || 0);
  if (number > 99) return '99+';
  return String(number);
}

function unwrapSettled(result, fallback = null) {
  if (result?.status !== 'fulfilled') return fallback;
  try {
    return unwrapData(result.value) ?? fallback;
  } catch (error) {
    return result.value ?? fallback;
  }
}

function notificationCategory(item = {}) {
  const type = normalizeText(`${item.notification_type || ''} ${item.event_type || ''} ${item.title || ''}`);
  if (['critical', 'urgent', 'emergency'].some((key) => type.includes(key))) return 'urgent';
  if (type.includes('vital') || type.includes('sinh hieu')) return 'vitals';
  if (type.includes('task') || type.includes('nhiem vu')) return 'task';
  if (type.includes('lab') || type.includes('imaging') || type.includes('cls')) return 'clinical';
  if (type.includes('nursing') || type.includes('dieu duong')) return 'nursing';
  return 'system';
}

function notificationTone(priority) {
  if (priority === 'critical') return 'critical';
  if (priority === 'high' || priority === 'urgent') return 'high';
  return 'normal';
}

function socketOrigin() {
  if (!API_BASE_URL || API_BASE_URL === '/api') return window.location.origin;
  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch (error) {
    return window.location.origin;
  }
}

function loadSocketIoClient() {
  if (window.io) return Promise.resolve(window.io);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-healthcare-socketio="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.io || null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `${socketOrigin()}/socket.io/socket.io.js`;
    script.async = true;
    script.dataset.healthcareSocketio = 'true';
    script.onload = () => resolve(window.io || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function readDraft() {
  try {
    const raw = localStorage.getItem('healthcare.nurse.quick-vital-draft');
    return raw ? { ...DEFAULT_VITAL_FORM, ...JSON.parse(raw) } : DEFAULT_VITAL_FORM;
  } catch (error) {
    return DEFAULT_VITAL_FORM;
  }
}

function writeDraft(value) {
  try {
    localStorage.setItem('healthcare.nurse.quick-vital-draft', JSON.stringify(value));
  } catch (error) {
    // Draft persistence is best-effort.
  }
}

function clearDraft() {
  try {
    localStorage.removeItem('healthcare.nurse.quick-vital-draft');
  } catch (error) {
    // Ignore storage errors.
  }
}

function NurseNavLink({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      end
      to={item.to}
      title={item.label}
      className={({ isActive }) => `nurse-nav-link${isActive ? ' is-active' : ''}`}
      onClick={onNavigate}
    >
      <span className="nurse-nav-link__icon" aria-hidden="true">
        <Icon size={collapsed ? 18 : 15} strokeWidth={2.2} />
      </span>
      {!collapsed ? <span className="nurse-nav-link__label">{item.label}</span> : null}
    </NavLink>
  );
}

function ShiftAlertSummary({ summary, collapsed, onNavigate }) {
  if (collapsed) return null;
  const items = toArray(summary?.items).filter((item) => Number(item.count || 0) > 0).slice(0, 6);
  const total = Number(summary?.alert_total || 0);

  return (
    <div className="nurse-shift-alert">
      <Link to="/nurse/overview/priority-alerts" className="nurse-sidebar__alert" onClick={() => onNavigate?.('/nurse/overview/priority-alerts')}>
        <BellRing size={17} strokeWidth={2.2} />
        <span>
          <strong>{compactCount(total)} cảnh báo</strong>
          <small>Cần theo dõi trong ca</small>
        </span>
      </Link>
      <div className="nurse-shift-alert__panel">
        <header>
          <strong>Cảnh báo ca trực</strong>
          <span>{summary?.shift === 'all' ? 'Toàn ca' : summary?.shift || 'Ca hiện tại'}</span>
        </header>
        <div className="nurse-shift-alert__stats">
          <span><b>{summary?.critical || 0}</b> critical</span>
          <span><b>{summary?.high || 0}</b> high</span>
        </div>
        {items.length ? items.map((item) => (
          <button key={item.code} type="button" onClick={() => onNavigate?.(item.route)}>
            <span>{item.label}</span>
            <b className={`is-${item.severity || 'normal'}`}>{item.count}</b>
          </button>
        )) : (
          <p>Không có cảnh báo cần xử lý ngay.</p>
        )}
      </div>
    </div>
  );
}

function CommandPalette({ open, query, setQuery, results, loading, onClose, onNavigate, onQuickVital }) {
  const groups = results?.groups || {};
  const [activeIndex, setActiveIndex] = useState(0);
  const flatResults = useMemo(() => [
    ...toArray(groups.patients).map((item) => ({ ...item, kind: 'Bệnh nhân', label: item.patient_name, sub: `${item.patient_code || 'Chưa có mã'} · ${item.current_status || 'Đang xử lý'}`, action: () => onNavigate('/nurse/patient-lookup/profile') })),
    ...toArray(groups.queue_items).map((item) => ({ ...item, kind: 'Queue', label: item.queue_number || item.patient_name, sub: `${item.patient_name || ''} · ${item.status || ''}`, action: () => onNavigate(item.route || '/nurse/overview/realtime-queue') })),
    ...toArray(groups.tasks).map((item) => ({ ...item, kind: 'Task', label: item.title, sub: `${item.patient_name || 'Điều dưỡng'} · ${item.status || ''}`, action: () => onNavigate(item.route || '/nurse/tasks-handover/assigned') })),
    ...toArray(groups.alerts).map((item) => ({ ...item, kind: 'Cảnh báo', label: item.title, sub: `${item.patient_name || 'Ca trực'} · ${item.severity || 'normal'}`, action: () => onNavigate(item.route || '/nurse/overview/priority-alerts') })),
    ...toArray(groups.menus).map((item) => ({ ...item, kind: item.group || 'Menu', label: item.label, sub: item.route, action: () => onNavigate(item.route) })),
    ...toArray(groups.quick_actions).map((item) => ({
      ...item,
      kind: 'Thao tác nhanh',
      label: item.label,
      sub: item.count ? `${item.count} mục cần xử lý` : 'Sẵn sàng',
      action: item.code === 'record_vital' ? onQuickVital : () => onNavigate(item.route),
    })),
  ].filter((item) => item.label), [groups, onNavigate, onQuickVital]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, query]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(flatResults.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter' && flatResults[activeIndex]) {
        event.preventDefault();
        flatResults[activeIndex].action?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, flatResults, onClose, open]);

  if (!open) return null;

  return (
    <div className="nurse-command-palette" role="dialog" aria-modal="true" aria-label="Global Nursing Search">
      <div className="nurse-command-palette__backdrop" onClick={onClose} />
      <section className="nurse-command-palette__surface">
        <header className="nurse-command-palette__search">
          <Search size={20} strokeWidth={2.2} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm bệnh nhân, queue, task, cảnh báo hoặc menu"
          />
          <kbd>Esc</kbd>
        </header>
        <div className="nurse-command-palette__body">
          {loading ? <div className="nurse-command-palette__empty">Đang tìm trong ca trực...</div> : null}
          {!loading && flatResults.length ? flatResults.map((item, index) => (
            <button
              key={`${item.kind}-${item.id || item.route || item.patient_id || item.task_id || index}`}
              type="button"
              className={index === activeIndex ? 'is-active' : ''}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => item.action?.()}
            >
              <span className="nurse-command-palette__kind">{item.kind}</span>
              <span className="nurse-command-palette__main">
                <strong>{item.label}</strong>
                <small>{item.sub}</small>
              </span>
              <span className="nurse-command-palette__go"><ExternalLink size={15} /></span>
            </button>
          )) : null}
          {!loading && !flatResults.length ? <div className="nurse-command-palette__empty">Không có kết quả phù hợp.</div> : null}
        </div>
      </section>
    </div>
  );
}

function NotificationCenter({ open, items, counters, tab, setTab, onNavigate, onMarkRead, onMarkAllRead }) {
  if (!open) return null;
  const filtered = items.filter((item) => tab === 'all' || notificationCategory(item) === tab);
  const unread = counters?.unread_notifications ?? items.filter((item) => !item.read_at && item.status !== 'read').length;

  return (
    <div className="nurse-dropdown__panel nurse-dropdown__panel--notifications nurse-notification-center">
      <header>
        <div>
          <strong>Notification Center</strong>
          <small>{compactCount(unread)} chưa đọc</small>
        </div>
        <button type="button" className="nurse-mini-action" onClick={onMarkAllRead}>Đã đọc</button>
      </header>
      <div className="nurse-notification-tabs" role="tablist">
        {NOTIFICATION_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'is-active' : ''}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="nurse-notification-list">
        {filtered.length ? filtered.slice(0, 10).map((item) => {
          const tone = notificationTone(item.priority);
          return (
            <article key={getId(item) || item.created_at} className={`nurse-notification-card is-${tone}`}>
              <span className="nurse-notification-card__icon">
                {tone === 'critical' ? <AlertTriangle size={17} /> : <Bell size={17} />}
              </span>
              <div>
                <div className="nurse-notification-card__title">
                  <strong>{item.title || 'Thông báo điều dưỡng'}</strong>
                  <small>{formatRelativeTime(item.created_at)}</small>
                </div>
                <p>{item.message || item.body || item.event_type || 'Cần xem lại trong ca trực.'}</p>
                <div className="nurse-notification-card__actions">
                  <button type="button" onClick={() => onNavigate(item.action_url || '/nurse/overview/priority-alerts', item)}>Mở</button>
                  <button type="button" onClick={() => onMarkRead(item)}>Đã xử lý</button>
                </div>
              </div>
            </article>
          );
        }) : <div className="nurse-notification-empty">Không có thông báo trong tab này.</div>}
      </div>
    </div>
  );
}

function NurseToastStack({ items, onClose }) {
  if (!items.length) return null;
  return (
    <div className="nurse-toast-stack" role="status" aria-live="polite">
      {items.map((item) => (
        <article key={item.id} className={`nurse-toast nurse-toast--${item.tone || 'info'}`}>
          <div>
            <strong>{item.title || 'Thông báo điều dưỡng'}</strong>
            {item.message ? <span>{item.message}</span> : null}
          </div>
          <button type="button" aria-label="Đóng thông báo" onClick={() => onClose(item.id)}>
            <X size={14} />
          </button>
        </article>
      ))}
    </div>
  );
}

function QuickVitalModal({ open, pendingItems, onClose, onSaved }) {
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(readDraft);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredItems = useMemo(() => {
    const query = normalizeText(filter);
    return toArray(pendingItems)
      .filter((item) => !query || normalizeText(`${item.patient_name} ${item.patient?.patient_name} ${item.patient_code} ${item.queue_number}`).includes(query))
      .slice(0, 10);
  }, [filter, pendingItems]);

  const selected = useMemo(
    () => filteredItems.find((item) => (item.queue_ticket_id || item.encounter_id || item.patient_id) === selectedId)
      || toArray(pendingItems).find((item) => (item.queue_ticket_id || item.encounter_id || item.patient_id) === selectedId)
      || toArray(pendingItems)[0]
      || null,
    [filteredItems, pendingItems, selectedId],
  );

  useEffect(() => {
    if (!open) return;
    const first = toArray(pendingItems)[0];
    setSelectedId((current) => current || first?.queue_ticket_id || first?.encounter_id || first?.patient_id || '');
    setError('');
    setPreview(null);
  }, [open, pendingItems]);

  useEffect(() => {
    if (!open) return;
    writeDraft(form);
  }, [form, open]);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setPreview(null);
  };

  const bmi = Number(form.weight) > 0 && Number(form.height) > 0
    ? (Number(form.weight) / ((Number(form.height) / 100) ** 2)).toFixed(1)
    : '';
  const gcsTotal = ['gcs_eye', 'gcs_verbal', 'gcs_motor'].every((field) => Number(form[field]) > 0)
    ? Number(form.gcs_eye) + Number(form.gcs_verbal) + Number(form.gcs_motor)
    : '';

  function buildBody() {
    const body = {};
    Object.entries(form).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) body[key] = value;
    });
    if (selected?.encounter_id) body.encounter_id = selected.encounter_id;
    if (selected?.queue_ticket_id) body.queue_ticket_id = selected.queue_ticket_id;
    if (selected?.appointment_id) body.appointment_id = selected.appointment_id;
    if (bmi) body.bmi = bmi;
    if (gcsTotal) body.gcs_total = gcsTotal;
    body.source = body.source || 'manual';
    return body;
  }

  async function runPreview() {
    setError('');
    const body = buildBody();
    try {
      const payload = await nurseVitalsApi.previewVitalSigns(body);
      setPreview(payload);
      return payload;
    } catch (err) {
      setError(err?.message || 'Không thể preview sinh hiệu.');
      return null;
    }
  }

  async function saveVital(alsoNotifyDoctor = false) {
    setSaving(true);
    setError('');
    try {
      const currentPreview = preview || await runPreview();
      if (!currentPreview) return;
      const saved = await nurseVitalsApi.recordVitalSigns(buildBody());
      const vitalId = getId(saved?.vital_sign || saved);
      const needsDoctor = alsoNotifyDoctor || currentPreview.assessment?.doctor_notification_required || currentPreview.assessment?.requires_doctor_notification;
      if (needsDoctor && vitalId) await nurseVitalsApi.notifyDoctorOfVital(vitalId);
      clearDraft();
      setForm(DEFAULT_VITAL_FORM);
      setPreview(null);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Không thể lưu sinh hiệu.');
    } finally {
      setSaving(false);
    }
  }

  const assessment = preview?.assessment || {};
  const isAbnormal = assessment.overall_severity && assessment.overall_severity !== 'normal';

  return (
    <div className="nurse-modal" role="dialog" aria-modal="true" aria-label="Nhập sinh hiệu nhanh">
      <div className="nurse-modal__backdrop" onClick={onClose} />
      <section className="nurse-vital-modal">
        <header className="nurse-vital-modal__header">
          <div>
            <span>Quick action</span>
            <h2>Nhập sinh hiệu</h2>
          </div>
          <button type="button" className="nurse-icon-button" onClick={onClose} aria-label="Đóng modal">
            <X size={18} />
          </button>
        </header>
        <div className="nurse-vital-modal__body">
          <aside className="nurse-vital-patient-list">
            <label>
              <Search size={16} />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Tìm BN / queue" />
            </label>
            <div>
              {filteredItems.length ? filteredItems.map((item) => {
                const id = item.queue_ticket_id || item.encounter_id || item.patient_id;
                return (
                  <button key={id} type="button" className={id === (selected?.queue_ticket_id || selected?.encounter_id || selected?.patient_id) ? 'is-active' : ''} onClick={() => setSelectedId(id)}>
                    <strong>{item.patient_name || item.patient?.patient_name}</strong>
                    <span>{item.queue_number || item.patient?.patient_code || 'Chờ đo'} · {item.waiting_minutes || 0} phút</span>
                  </button>
                );
              }) : <p>Chưa có bệnh nhân chờ đo sinh hiệu.</p>}
            </div>
          </aside>
          <section className="nurse-vital-form">
            <div className="nurse-vital-form__patient">
              <HeartPulse size={20} />
              <div>
                <strong>{selected?.patient_name || selected?.patient?.patient_name || 'Chọn bệnh nhân'}</strong>
                <span>{selected?.queue_number || selected?.patient?.patient_code || selected?.encounter_id || 'Cần queue/encounter hợp lệ để lưu'}</span>
              </div>
            </div>

            {isAbnormal ? (
              <div className={`nurse-vital-warning is-${assessment.overall_severity}`}>
                <AlertTriangle size={18} />
                <div>
                  <strong>Sinh hiệu bất thường - cần báo bác sĩ</strong>
                  <span>{toArray(assessment.abnormal_flags).map((flag) => flag.message || flag.field).join(' · ') || 'Backend đánh giá cần theo dõi.'}</span>
                </div>
              </div>
            ) : null}

            <div className="nurse-vital-grid">
              {[
                ['heart_rate', 'Mạch', 'bpm'],
                ['temperature', 'Nhiệt độ', '°C'],
                ['spo2', 'SpO2', '%'],
                ['respiratory_rate', 'Nhịp thở', '/phút'],
                ['systolic_bp', 'HA tâm thu', 'mmHg'],
                ['diastolic_bp', 'HA tâm trương', 'mmHg'],
                ['weight', 'Cân nặng', 'kg'],
                ['height', 'Chiều cao', 'cm'],
                ['pain_score', 'Đau', '/10'],
                ['blood_glucose', 'Đường huyết', 'mg/dL'],
                ['gcs_eye', 'GCS mắt', '1-4'],
                ['gcs_verbal', 'GCS lời', '1-5'],
                ['gcs_motor', 'GCS vận động', '1-6'],
              ].map(([field, label, unit]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input value={form[field]} onChange={(event) => updateField(field, event.target.value)} inputMode="decimal" placeholder={unit} />
                </label>
              ))}
            </div>

            <div className="nurse-vital-meta-grid">
              <label>
                <span>BMI</span>
                <input value={bmi} readOnly placeholder="Tự tính" />
              </label>
              <label>
                <span>GCS tổng</span>
                <input value={gcsTotal} readOnly placeholder="Tự tính" />
              </label>
              <label>
                <span>Tư thế đo</span>
                <select value={form.measurement_position} onChange={(event) => updateField('measurement_position', event.target.value)}>
                  <option value="sitting">Ngồi</option>
                  <option value="lying">Nằm</option>
                  <option value="standing">Đứng</option>
                </select>
              </label>
              <label>
                <span>Vị trí nhiệt độ</span>
                <select value={form.temperature_site} onChange={(event) => updateField('temperature_site', event.target.value)}>
                  <option value="axillary">Nách</option>
                  <option value="oral">Miệng</option>
                  <option value="tympanic">Tai</option>
                  <option value="forehead">Trán</option>
                  <option value="rectal">Trực tràng</option>
                </select>
              </label>
              <label>
                <span>Thiết bị</span>
                <input value={form.device_id} onChange={(event) => updateField('device_id', event.target.value)} placeholder="Device ID" />
              </label>
              <label>
                <span>Thời điểm</span>
                <input type="datetime-local" value={form.recorded_at} onChange={(event) => updateField('recorded_at', event.target.value)} />
              </label>
            </div>

            <label className="nurse-vital-note">
              <span>Ghi chú điều dưỡng</span>
              <textarea value={form.note} onChange={(event) => updateField('note', event.target.value)} rows={3} placeholder="Ghi chú ngắn cho bác sĩ/ca sau" />
            </label>

            {error ? <div className="nurse-vital-error">{error}</div> : null}

            <footer className="nurse-vital-modal__actions">
              <button type="button" className="nurse-button nurse-button--ghost" onClick={runPreview} disabled={saving}>Preview</button>
              <button type="button" className="nurse-button nurse-button--secondary" onClick={() => saveVital(false)} disabled={saving}>Lưu sinh hiệu</button>
              <button type="button" className="nurse-button nurse-button--danger" onClick={() => saveVital(true)} disabled={saving}>Lưu & báo bác sĩ</button>
            </footer>
          </section>
        </div>
      </section>
    </div>
  );
}

export function NurseShell({ children }) {
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [commandResults, setCommandResults] = useState(null);
  const [commandLoading, setCommandLoading] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState('all');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [quickVitalOpen, setQuickVitalOpen] = useState(false);
  const [shellToasts, setShellToasts] = useState([]);
  const [bootstrap, setBootstrap] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [counters, setCounters] = useState({});
  const [pendingVitals, setPendingVitals] = useState([]);
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(nurseMenuSections.map((section) => [section.id, section.defaultOpen !== false])),
  );

  const allMenuItems = useMemo(() => flattenNurseMenu(), []);
  const currentPage = getNursePageMeta(location.pathname);
  const displayName = bootstrap?.profile?.display_name || getStaffActorName(auth);
  const roleLabel = getNurseRoleLabel(auth, bootstrap?.profile);
  const shiftSummary = bootstrap?.shift_summary || {};
  const availableWorkspaces = bootstrap?.workspace?.available_workspaces?.length
    ? bootstrap.workspace.available_workspaces
    : getAccessibleStaffWorkspaces(auth).map((item) => ({ code: item.key, name: item.title, route: item.path, icon: item.icon, active: item.key === 'nurse' }));

  const fallbackSearchResults = useMemo(() => {
    const query = normalizeText(searchQuery);
    const menus = query
      ? allMenuItems.filter((item) => normalizeText(`${item.label} ${item.sectionLabel}`).includes(query))
      : allMenuItems.slice(0, 8);
    return { groups: { menus: menus.slice(0, 10).map((item) => ({ id: item.id, group: item.sectionLabel, label: item.label, route: item.to })) } };
  }, [allMenuItems, searchQuery]);

  const refreshTopbar = useCallback(async () => {
    const results = await Promise.allSettled([
      nurseTopbarApi.bootstrap(),
      notificationAPI.listMine({ limit: 12 }),
      notificationAPI.getCounters(),
      nurseVitalsApi.getWaitingVitals({ limit: 12 }),
    ]);
    const nextBootstrap = unwrapSettled(results[0]);
    const notificationPayload = unwrapSettled(results[1]);
    const counterPayload = unwrapSettled(results[2]);
    const pendingPayload = unwrapSettled(results[3]);

    if (nextBootstrap) {
      setBootstrap(nextBootstrap);
      setCounters((current) => ({ ...current, ...(nextBootstrap.counters || {}) }));
      setPendingVitals(toArray(nextBootstrap.vitals?.pending_items).length ? toArray(nextBootstrap.vitals.pending_items) : toArray(pendingPayload?.items || pendingPayload));
    }
    if (notificationPayload) setNotifications(toArray(notificationPayload));
    else if (nextBootstrap?.notification_preview) setNotifications(toArray(nextBootstrap.notification_preview));
    if (counterPayload) setCounters((current) => ({ ...current, ...(counterPayload.counters || counterPayload) }));
    if (pendingPayload) setPendingVitals(toArray(pendingPayload.items || pendingPayload));
  }, []);

  useEffect(() => {
    refreshTopbar();
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, [refreshTopbar]);

  useEffect(() => {
    function handleToast(event) {
      const detail = event.detail || {};
      const id = detail.id || `${Date.now()}-${Math.random()}`;
      setShellToasts((current) => [
        ...current.slice(-3),
        {
          id,
          tone: detail.tone || 'info',
          title: detail.title || 'Thông báo điều dưỡng',
          message: detail.message || '',
        },
      ]);
      window.setTimeout(() => {
        setShellToasts((current) => current.filter((item) => item.id !== id));
      }, Number(detail.timeout || 5200));
    }
    window.addEventListener('nurse:toast', handleToast);
    return () => window.removeEventListener('nurse:toast', handleToast);
  }, []);

  useEffect(() => {
    const activeItem = allMenuItems.find((item) => item.to === location.pathname);
    if (!activeItem?.sectionId) return;
    setOpenSections((current) => ({ ...current, [activeItem.sectionId]: true }));
  }, [allMenuItems, location.pathname]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        if (!event.target.closest('.nurse-command-palette')) setIsSearchOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setIsNotificationOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setIsProfileOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return undefined;
    const timeout = window.setTimeout(async () => {
      setCommandLoading(true);
      try {
        const payload = await nurseTopbarApi.search({ q: searchQuery, limit: 8 });
        setCommandResults(payload);
      } catch (error) {
        setCommandResults(fallbackSearchResults);
      } finally {
        setCommandLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [fallbackSearchResults, isSearchOpen, searchQuery]);

  useEffect(() => {
    let socket;
    let cancelled = false;
    const events = [
      'notification.created',
      'notification.updated',
      'notification.read',
      'counter.updated',
      'queue.ticket_created',
      'queue.called',
      'queue.service_started',
      'queue.completed',
      'queue.transferred',
      'queue.no_show',
      'nursing_task.created',
      'nursing_task.assigned',
      'nursing_task.updated',
      'nursing_task.completed',
      'service_preparation.created',
      'service_preparation.assigned',
      'service_preparation.ready',
      'service_preparation.escalated',
      'emergency.created',
      'emergency.escalated',
      'lab_critical_value',
      'imaging_critical_finding',
      'vital_sign.recorded',
      'vital_sign.abnormal',
      'vital_sign.critical',
      'triage.completed',
      'nursing_alert.created',
      'nursing_alert.resolved',
    ];

    async function connectRealtime() {
      const token = readStoredAuth()?.tokens?.access_token;
      if (!token) return;
      const io = await loadSocketIoClient();
      if (!io || cancelled) return;
      socket = io(socketOrigin(), { auth: { token }, transports: ['websocket', 'polling'] });
      const scheduleRefresh = () => {
        if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = window.setTimeout(refreshTopbar, 350);
      };
      events.forEach((eventName) => {
        socket.on(eventName, (envelope) => {
          if (eventName === 'counter.updated') setCounters((current) => ({ ...current, ...(envelope?.data || envelope || {}) }));
          scheduleRefresh();
        });
      });
      socket.on('connect_error', () => {});
    }

    connectRealtime();
    return () => {
      cancelled = true;
      if (socket) socket.disconnect();
    };
  }, [refreshTopbar]);

  function toggleSection(sectionId) {
    setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  function closeMobileSidebar() {
    setIsMobileSidebarOpen(false);
  }

  async function handleLogout() {
    try {
      const refreshToken = readStoredAuth()?.tokens?.refresh_token;
      await authAPI.logout(refreshToken);
    } catch (error) {
      // Local logout still needs to happen if the server session is already gone.
    }
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  function navigateFromSearch(to) {
    if (!to) return;
    setSearchQuery('');
    setIsSearchOpen(false);
    navigate(to);
  }

  async function markNotificationRead(item) {
    const id = getId(item);
    if (!id) return;
    try {
      await notificationAPI.markRead(id);
      setNotifications((current) => current.map((entry) => (getId(entry) === id ? { ...entry, read_at: new Date().toISOString(), status: 'read' } : entry)));
      refreshTopbar();
    } catch (error) {
      // Keep the panel usable even if the read request fails.
    }
  }

  async function markAllRead() {
    try {
      await notificationAPI.markAllReadWithParams({ limit: 50 });
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString(), status: 'read' })));
      setCounters((current) => ({ ...current, unread_notifications: 0 }));
    } catch (error) {
      // No-op.
    }
  }

  async function switchWorkspace(workspace) {
    try {
      await nurseTopbarApi.setCurrentWorkspace(workspace.code || workspace.key);
    } catch (error) {
      try {
        await preferenceAPI.updateMe({ current_workspace: workspace.code || workspace.key });
      } catch (ignored) {
        // Local navigation remains valid for already accessible workspaces.
      }
    }
    navigate(workspace.route || workspace.path || '/staff/select-workspace');
  }

  return (
    <main className={`nurse-workspace${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}${isMobileSidebarOpen ? ' is-mobile-sidebar-open' : ''}`}>
      <aside className="nurse-sidebar" aria-label="Menu điều dưỡng">
        <div className="nurse-sidebar__brand">
          <Link to="/staff/select-workspace" className="nurse-sidebar__brand-link" onClick={closeMobileSidebar}>
            <span className="nurse-sidebar__brand-mark" aria-hidden="true">
              <AppLogo variant="mark" alt="" aria-hidden="true" />
            </span>
            {!isSidebarCollapsed ? (
              <span className="nurse-sidebar__brand-copy">
                <strong>{APP_BRAND_NAME}</strong>
                <small>{bootstrap?.workspace?.current_department_name || 'Không gian điều dưỡng'}</small>
              </span>
            ) : null}
          </Link>
        </div>

        <nav className="nurse-sidebar__nav">
          {nurseMenuSections.map((section) => {
            const Icon = section.icon;
            const isOpen = Boolean(openSections[section.id]) && !isSidebarCollapsed;
            const isActive = section.children?.some((item) => item.to === location.pathname);
            return (
              <div key={section.id} className={`nurse-nav-group${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}>
                <button type="button" className="nurse-nav-group__trigger" title={section.label} aria-expanded={isOpen} onClick={() => toggleSection(section.id)}>
                  <span className="nurse-nav-group__icon" aria-hidden="true"><Icon size={18} strokeWidth={2.2} /></span>
                  {!isSidebarCollapsed ? <span className="nurse-nav-group__label">{section.label}</span> : null}
                  {!isSidebarCollapsed ? <ChevronDown className="nurse-nav-group__chevron" size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
                </button>
                {isOpen ? (
                  <div className="nurse-nav-group__children">
                    {section.children.map((item) => <NurseNavLink key={item.id} item={item} collapsed={isSidebarCollapsed} onNavigate={closeMobileSidebar} />)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="nurse-sidebar__footer">
          <ShiftAlertSummary
            summary={shiftSummary}
            collapsed={isSidebarCollapsed}
            onNavigate={(to) => {
              closeMobileSidebar();
              navigate(to);
            }}
          />
          <button type="button" className="nurse-sidebar__collapse" aria-label={isSidebarCollapsed ? 'Mở rộng menu bên' : 'Thu gọn menu bên'} onClick={() => setIsSidebarCollapsed((current) => !current)}>
            <ChevronsLeft className={isSidebarCollapsed ? 'is-rotated' : ''} size={18} strokeWidth={2.2} />
            {!isSidebarCollapsed ? <span>Thu gọn</span> : null}
          </button>
        </div>
      </aside>

      <div className="nurse-mobile-backdrop" onClick={closeMobileSidebar} />

      <section className="nurse-main">
        <header className="nurse-topbar">
          <div className="nurse-topbar__left">
            <button type="button" className="nurse-icon-button nurse-topbar__menu" aria-label="Mở menu điều dưỡng" onClick={() => setIsMobileSidebarOpen(true)}>
              <Menu size={20} strokeWidth={2.2} />
            </button>
            <div className="nurse-topbar__title">
              <span>{currentPage.sectionLabel}</span>
              <strong>{currentPage.label}</strong>
            </div>
            <div className="nurse-shift-pill">
              <MonitorDot size={15} />
              <span>{bootstrap?.workspace?.current_department_name || 'Khoa hiện tại'}</span>
              <b>{shiftSummary.shift === 'all' ? 'Toàn ca' : shiftSummary.shift || 'Ca trực'}</b>
            </div>
          </div>

          <div className="nurse-topbar__tools">
            <div className={`nurse-search${isSearchOpen ? ' is-open' : ''}`} ref={searchRef}>
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onFocus={() => setIsSearchOpen(true)} placeholder="Tìm BN, queue, task... Ctrl K" aria-label="Global Nursing Search" />
              {searchQuery ? <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}><X size={15} strokeWidth={2.2} /></button> : <kbd>Ctrl K</kbd>}
            </div>

            <button type="button" className="nurse-topbar__quick" onClick={() => setQuickVitalOpen(true)}>
              <HeartPulse size={18} strokeWidth={2.25} />
              <span>Nhập sinh hiệu</span>
              {pendingVitals.length ? <b>{compactCount(pendingVitals.length)}</b> : null}
            </button>

            <div className="nurse-dropdown" ref={notificationRef}>
              <button type="button" className={`nurse-icon-button${shiftSummary.critical ? ' is-pulsing' : ''}`} aria-label="Mở Notification Center" aria-expanded={isNotificationOpen} onClick={() => setIsNotificationOpen((current) => !current)}>
                <Bell size={19} strokeWidth={2.2} />
                {Number(counters.unread_notifications || 0) > 0 ? <span className="nurse-icon-button__badge">{compactCount(counters.unread_notifications)}</span> : null}
              </button>
              <NotificationCenter
                open={isNotificationOpen}
                items={notifications}
                counters={counters}
                tab={notificationTab}
                setTab={setNotificationTab}
                onNavigate={(to, item) => {
                  setIsNotificationOpen(false);
                  markNotificationRead(item);
                  navigate(to || '/nurse/overview/priority-alerts');
                }}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllRead}
              />
            </div>

            <div className="nurse-profile" ref={profileRef}>
              <button type="button" className="nurse-profile__trigger" aria-label="Mở menu tài khoản" aria-expanded={isProfileOpen} onClick={() => setIsProfileOpen((current) => !current)}>
                <span className="nurse-avatar">{getInitials(displayName)}</span>
                <span className="nurse-profile__copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>

              {isProfileOpen ? (
                <div className="nurse-profile__panel nurse-account-panel">
                  <div className="nurse-profile__summary">
                    <span className="nurse-avatar nurse-avatar--large">{getInitials(displayName)}</span>
                    <div>
                      <strong>{displayName}</strong>
                      <span>{auth?.user?.email || bootstrap?.profile?.email || auth?.user?.username || 'Tài khoản nhân sự'}</span>
                    </div>
                  </div>
                  <div className="nurse-account-status">
                    <span><MonitorDot size={14} /> Online</span>
                    <span>{bootstrap?.workspace?.current_department_name || 'Chưa gắn khoa'}</span>
                  </div>
                  <div className="nurse-workspace-switcher">
                    <strong>Không gian làm việc</strong>
                    {availableWorkspaces.slice(0, 6).map((workspace) => (
                      <button key={workspace.code || workspace.key} type="button" className={workspace.active ? 'is-active' : ''} onClick={() => switchWorkspace(workspace)}>
                        <span>{workspace.name || workspace.title}</span>
                        {workspace.badge?.alerts ? <b>{workspace.badge.alerts}</b> : null}
                      </button>
                    ))}
                  </div>
                  <Link to="/admin/profile" onClick={() => setIsProfileOpen(false)}><UserRound size={16} /> Hồ sơ của tôi</Link>
                  <Link to="/admin/security/change-password" onClick={() => setIsProfileOpen(false)}><LockKeyhole size={16} /> Tài khoản & bảo mật</Link>
                  <Link to="/admin/security/sessions" onClick={() => setIsProfileOpen(false)}><ShieldCheck size={16} /> Phiên đăng nhập</Link>
                  <Link to="/staff/select-workspace" onClick={() => setIsProfileOpen(false)}><Users size={16} /> Chọn không gian khác</Link>
                  <Link to="/admin/profile?tab=settings" onClick={() => setIsProfileOpen(false)}><Settings2 size={16} /> Cài đặt thông báo</Link>
                  <Link to="/support" onClick={() => setIsProfileOpen(false)}><LifeBuoy size={16} /> Trợ giúp / báo lỗi</Link>
                  <button type="button" onClick={handleLogout}><LogOut size={16} /> Đăng xuất</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="nurse-content">{children}</div>
      </section>

      <CommandPalette
        open={isSearchOpen}
        query={searchQuery}
        setQuery={setSearchQuery}
        results={commandResults || fallbackSearchResults}
        loading={commandLoading}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={navigateFromSearch}
        onQuickVital={() => {
          setIsSearchOpen(false);
          setQuickVitalOpen(true);
        }}
      />

      <QuickVitalModal
        open={quickVitalOpen}
        pendingItems={pendingVitals}
        onClose={() => setQuickVitalOpen(false)}
        onSaved={refreshTopbar}
      />
      <NurseToastStack
        items={shellToasts}
        onClose={(id) => setShellToasts((current) => current.filter((item) => item.id !== id))}
      />
    </main>
  );
}
