import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileClock,
  FileText,
  History,
  ListOrdered,
  RefreshCw,
  Search,
  Send,
  Settings,
  UserCheck,
  XCircle,
} from 'lucide-react';

import { schedulingApi } from '../api/schedulingApi.js';
import '../../styles/scheduling/17-activity-config-legacy.css';

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const VIEW_CONFIG = {
  all: { title: 'Tất cả hoạt động', eyebrow: 'Operational Timeline', subtitle: 'Theo dõi toàn bộ thao tác trong workspace Điều phối lịch & Vận hành.', target: '' },
  doctorSchedules: { title: 'Nhật ký lịch làm việc', eyebrow: 'Doctor Schedule Audit', subtitle: 'Tạo lịch, publish, cancel, duplicate, generate slot và preview impact.', target: 'doctor_schedule' },
  appointments: { title: 'Nhật ký lịch hẹn', eyebrow: 'Appointment Timeline', subtitle: 'Tạo, xác nhận, dời, hủy, check-in, no-show và tạo queue.', target: 'appointment' },
  slots: { title: 'Nhật ký slot', eyebrow: 'Slot Activity', subtitle: 'Generate, block, reopen, hold, release, book và capacity changes.', target: 'schedule_slot' },
  queue: { title: 'Nhật ký queue', eyebrow: 'Queue Timeline', subtitle: 'Gọi số, gọi lại, skip, transfer, ưu tiên, start service và no-show.', target: 'queue_ticket' },
  checkIn: { title: 'Nhật ký check-in / điều phối', eyebrow: 'Check-in Flow Audit', subtitle: 'Check-in appointment/walk-in, tạo queue và điều phối bệnh nhân trong ngày.', target: 'check_in' },
};

const actionMeta = {
  create: { icon: FileText, tone: 'blue' },
  update: { icon: Activity, tone: 'amber' },
  publish: { icon: Send, tone: 'green' },
  cancel: { icon: XCircle, tone: 'red' },
  check_in: { icon: UserCheck, tone: 'green' },
  call: { icon: ListOrdered, tone: 'purple' },
  export: { icon: Download, tone: 'blue' },
  settings: { icon: Settings, tone: 'amber' },
};

const demoEvents = [
  { id: 'audit-demo-1', createdAt: new Date(Date.now() - 6 * 60000).toISOString(), actorName: 'Scheduler Nguyễn A', role: 'scheduler', action: 'schedules.publish', module: 'scheduling', targetType: 'doctor_schedule', targetLabel: 'BS. Trần Thanh Hải · Nội tổng quát', status: 'success', severity: 'info', ip: '127.0.0.1', requestId: 'REQ-001', before: { status: 'draft' }, after: { status: 'published' } },
  { id: 'audit-demo-2', createdAt: new Date(Date.now() - 18 * 60000).toISOString(), actorName: 'Receptionist Trần B', role: 'receptionist', action: 'appointments.check_in', module: 'scheduling', targetType: 'appointment', targetLabel: 'APT-20260523-0012', status: 'success', severity: 'info', ip: '127.0.0.1', requestId: 'REQ-002', before: { status: 'confirmed' }, after: { status: 'checked_in' } },
  { id: 'audit-demo-3', createdAt: new Date(Date.now() - 28 * 60000).toISOString(), actorName: 'Điều phối Queue', role: 'scheduler', action: 'queue.called', module: 'queue', targetType: 'queue_ticket', targetLabel: 'NTQ-N008', status: 'success', severity: 'info', ip: '127.0.0.1', requestId: 'REQ-003', before: { status: 'waiting' }, after: { status: 'called' } },
  { id: 'audit-demo-4', createdAt: new Date(Date.now() - 45 * 60000).toISOString(), actorName: 'Admin', role: 'admin', action: 'schedule_slots.block', module: 'scheduling', targetType: 'schedule_slot', targetLabel: '09:30 · BS. Lê Minh Tuấn', status: 'success', severity: 'warning', ip: '127.0.0.1', requestId: 'REQ-004', before: { status: 'available' }, after: { status: 'blocked', reason: 'Bác sĩ họp' } },
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.logs)) return value.logs;
  return [];
}

function unwrap(result) {
  return result?.status === 'fulfilled' ? result.value : null;
}

function sourceArray(...values) {
  for (const value of values) {
    const items = asArray(value);
    if (items.length) return items;
  }
  return [];
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function actionKey(action = '') {
  if (action.includes('publish')) return 'publish';
  if (action.includes('cancel') || action.includes('no_show')) return 'cancel';
  if (action.includes('check')) return 'check_in';
  if (action.includes('call') || action.includes('queue')) return 'call';
  if (action.includes('export')) return 'export';
  if (action.includes('setting')) return 'settings';
  if (action.includes('update') || action.includes('patch') || action.includes('block')) return 'update';
  return 'create';
}

function normalizeAudit(item = {}, index = 0) {
  const action = item.action || item.event_type || item.audit_action || item.type || 'activity';
  const actor = item.actor || item.actor_snapshot || {};
  const target = item.target || item.target_snapshot || {};
  return {
    id: item.audit_log_id || item.id || item._id || `audit-${index}`,
    createdAt: item.created_at || item.timestamp || item.occurred_at || new Date().toISOString(),
    actorName: item.actor_name || actor.full_name || actor.username || item.actor_id || 'System',
    role: item.actor_role || actor.role || item.actor_type || 'actor',
    action,
    module: item.module_key || item.module || inferModule(action),
    targetType: item.target_type || target.type || item.entity_type || inferTarget(action),
    targetId: item.target_id || target.id || item.entity_id,
    targetLabel: item.target_label || target.label || item.entity_name || item.description || 'Target',
    status: item.status || item.result || 'success',
    severity: item.severity || (item.status === 'failed' ? 'error' : 'info'),
    ip: item.ip_address || item.ip || item.request?.ip || '—',
    requestId: item.request_id || item.correlation_id || item.request?.id || '—',
    before: item.before || item.before_state || item.old_value || {},
    after: item.after || item.after_state || item.new_value || {},
    metadata: item.metadata || item.extra || {},
    raw: item,
  };
}

function inferModule(action) {
  if (action.includes('queue')) return 'queue';
  if (action.includes('appointment')) return 'appointments';
  if (action.includes('slot')) return 'slots';
  if (action.includes('setting')) return 'settings';
  return 'scheduling';
}

function inferTarget(action) {
  if (action.includes('queue')) return 'queue_ticket';
  if (action.includes('appointment')) return 'appointment';
  if (action.includes('slot')) return 'schedule_slot';
  if (action.includes('setting')) return 'system_setting';
  return 'doctor_schedule';
}

export function ActivityCommandPage({ view = 'all' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.all;
  const [filters, setFilters] = useState({ dateFrom: daysAgoIso(1), dateTo: todayIso(), query: '', action: 'all' });
  const [state, setState] = useState({ loading: true, error: null, operations: null, scoped: null, audit: null });
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('timeline');

  useEffect(() => {
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      const params = {
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        target_type: config.target || undefined,
        module_key: 'scheduling',
        limit: 150,
      };
      const scopedCall = {
        all: schedulingApi.getOperationsActivity,
        doctorSchedules: schedulingApi.getOperationsActivityDoctorSchedules,
        appointments: schedulingApi.getOperationsActivityAppointments,
        slots: schedulingApi.getOperationsActivitySlots,
        queue: schedulingApi.getOperationsActivityQueue,
        checkIn: schedulingApi.getOperationsActivityCheckIn,
      }[view] || schedulingApi.getOperationsActivity;
      const [operations, scoped, audit] = await Promise.allSettled([
        schedulingApi.getOperationsActivity(params),
        scopedCall(params),
        schedulingApi.listAuditLogs(params),
      ]);
      if (!active) return;
      const legacy = unwrap(audit);
      setState({
        loading: false,
        error: legacy || unwrap(operations) || unwrap(scoped) ? null : [operations, scoped, audit].find((item) => item.status === 'rejected')?.reason?.message,
        operations: unwrap(operations),
        scoped: unwrap(scoped),
        audit: legacy,
      });
    }
    load();
    return () => {
      active = false;
    };
  }, [config.target, filters.dateFrom, filters.dateTo, view]);

  const events = useMemo(() => {
    const source = sourceArray(state.scoped?.items, state.scoped, state.operations?.items, state.operations, state.audit?.items, state.audit);
    const rows = source.length ? source.map(normalizeAudit) : demoEvents;
    const query = filters.query.trim().toLowerCase();
    return rows
      .filter((event) => !config.target || event.targetType === config.target || (config.target === 'check_in' && event.action.includes('check')))
      .filter((event) => filters.action === 'all' || event.action.includes(filters.action))
      .filter((event) => !query || `${event.actorName} ${event.action} ${event.targetLabel} ${event.requestId}`.toLowerCase().includes(query))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [config.target, filters.action, filters.query, state.audit, state.operations, state.scoped]);

  const summary = useMemo(() => ({
    total: events.length,
    success: events.filter((item) => item.status === 'success').length,
    failed: events.filter((item) => item.status === 'failed' || item.severity === 'error').length,
    sensitive: events.filter((item) => item.action.includes('export') || item.action.includes('settings')).length,
    schedules: events.filter((item) => item.targetType === 'doctor_schedule').length,
    appointments: events.filter((item) => item.targetType === 'appointment').length,
    queue: events.filter((item) => item.targetType === 'queue_ticket').length,
    slots: events.filter((item) => item.targetType === 'schedule_slot').length,
  }), [events]);

  return (
    <main className="sched-activity-page">
      <ActivityHeader config={config} filters={filters} setFilters={setFilters} loading={state.loading} error={state.error} />
      <ActivityKpis summary={summary} />
      <ActivityToolbar filters={filters} setFilters={setFilters} mode={mode} setMode={setMode} />
      {mode === 'timeline' ? <ActivityTimeline events={events} loading={state.loading} onSelect={setSelected} /> : <ActivityTable events={events} loading={state.loading} onSelect={setSelected} />}
      {selected ? <ActivityDrawer event={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function ActivityHeader({ config, filters, setFilters, loading, error }) {
  return (
    <section className="sched-activity-hero">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
        <small><i />{loading ? 'Đang tải audit trail' : 'Audit explorer sẵn sàng'}{error ? ` · ${error}` : ''}</small>
      </div>
      <div className="sched-activity-hero__tools">
        <label><span>Từ ngày</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
        <label><span>Đến ngày</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, dateFrom: todayIso(), dateTo: todayIso() }))}><RefreshCw size={16} />Hôm nay</button>
      </div>
    </section>
  );
}

function ActivityKpis({ summary }) {
  const cards = [
    ['Tổng hoạt động', summary.total, FileClock, 'blue'],
    ['Thành công', summary.success, CheckCircle2, 'green'],
    ['Thất bại', summary.failed, XCircle, 'red'],
    ['Nhạy cảm', summary.sensitive, AlertTriangle, 'amber'],
    ['Lịch làm việc', summary.schedules, CalendarDays, 'purple'],
    ['Lịch hẹn', summary.appointments, CalendarCheck2, 'blue'],
    ['Queue', summary.queue, ListOrdered, 'teal'],
    ['Slot', summary.slots, Clock3, 'orange'],
  ];
  return (
    <section className="sched-activity-kpis">
      {cards.map(([label, value, Icon, tone]) => (
        <article className={`is-${tone}`} key={label}><span><Icon size={18} /></span><div><strong>{value}</strong><small>{label}</small></div></article>
      ))}
    </section>
  );
}

function ActivityToolbar({ filters, setFilters, mode, setMode }) {
  return (
    <section className="sched-activity-toolbar">
      <div><Search size={16} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Tìm actor, action, target, request ID..." /></div>
      <select value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}>
        <option value="all">Tất cả action</option>
        <option value="create">Create</option>
        <option value="update">Update</option>
        <option value="publish">Publish</option>
        <option value="check">Check-in</option>
        <option value="queue">Queue</option>
        <option value="export">Export</option>
      </select>
      <button type="button" className={mode === 'timeline' ? 'is-active' : ''} onClick={() => setMode('timeline')}>Timeline</button>
      <button type="button" className={mode === 'table' ? 'is-active' : ''} onClick={() => setMode('table')}>Table</button>
    </section>
  );
}

function ActivityTimeline({ events, loading, onSelect }) {
  if (loading) return <ActivitySkeleton />;
  return (
    <section className="sched-activity-timeline">
      {events.map((event) => {
        const key = actionKey(event.action);
        const meta = actionMeta[key] || actionMeta.create;
        const Icon = meta.icon;
        return (
          <article className={`is-${meta.tone}`} key={event.id} onClick={() => onSelect(event)}>
            <span><Icon size={16} /></span>
            <div>
              <header><strong>{event.actorName}</strong><small>{formatTime(event.createdAt)}</small></header>
              <p>{event.action} · {event.targetLabel}</p>
              <footer><em>{event.module}</em><em>{event.targetType}</em><em>{event.status}</em><em>{event.requestId}</em></footer>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ActivityTable({ events, loading, onSelect }) {
  if (loading) return <ActivitySkeleton />;
  return (
    <section className="sched-activity-table">
      <div><span>Thời gian</span><span>Actor</span><span>Action</span><span>Target</span><span>Status</span><span>IP</span><span>Request</span></div>
      {events.map((event) => (
        <button type="button" key={event.id} onClick={() => onSelect(event)}>
          <span>{formatTime(event.createdAt)}</span>
          <span><strong>{event.actorName}</strong><small>{event.role}</small></span>
          <span>{event.action}</span>
          <span><strong>{event.targetType}</strong><small>{event.targetLabel}</small></span>
          <span>{event.status}</span>
          <span>{event.ip}</span>
          <span>{event.requestId}</span>
        </button>
      ))}
    </section>
  );
}

function ActivityDrawer({ event, onClose }) {
  const before = event.before || {};
  const after = event.after || {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return (
    <aside className="sched-activity-drawer">
      <header>
        <div><span>Audit detail</span><h2>{event.action}</h2><p>{event.actorName} · {formatTime(event.createdAt)}</p></div>
        <button type="button" onClick={onClose}>Đóng</button>
      </header>
      <section>
        <h3>Tổng quan</h3>
        <dl>
          <div><dt>Actor</dt><dd>{event.actorName}</dd></div>
          <div><dt>Vai trò</dt><dd>{event.role}</dd></div>
          <div><dt>Module</dt><dd>{event.module}</dd></div>
          <div><dt>Target</dt><dd>{event.targetType}</dd></div>
          <div><dt>Status</dt><dd>{event.status}</dd></div>
          <div><dt>Request ID</dt><dd>{event.requestId}</dd></div>
          <div><dt>IP</dt><dd>{event.ip}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Before / After</h3>
        <div className="sched-audit-diff">
          {keys.length ? keys.map((key) => (
            <div key={key}>
              <span>{key}</span>
              <code>{String(before[key] ?? '—')}</code>
              <b>→</b>
              <code>{String(after[key] ?? '—')}</code>
            </div>
          )) : <p>Không có diff chi tiết trong audit payload.</p>}
        </div>
      </section>
      <section>
        <h3>Liên kết</h3>
        <div className="sched-activity-links">
          <Link to="/scheduling/today">Lịch hôm nay</Link>
          <Link to="/scheduling/queue">Queue board</Link>
          <Link to="/scheduling/activity">Audit explorer</Link>
        </div>
      </section>
    </aside>
  );
}

function ActivitySkeleton() {
  return (
    <section className="sched-activity-timeline">
      {Array.from({ length: 5 }, (_, index) => <div className="sched-activity-skeleton" key={index} />)}
    </section>
  );
}
