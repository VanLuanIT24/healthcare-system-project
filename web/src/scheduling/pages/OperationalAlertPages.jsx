import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarX2,
  CheckCircle2,
  Clock3,
  ListOrdered,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRoundX,
  UsersRound,
} from 'lucide-react';

import { schedulingApi } from '../api/schedulingApi.js';
import { runSchedulingAction } from '../utils/schedulingActions.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

const VIEW_CONFIG = {
  all: {
    title: 'Tất cả cảnh báo vận hành',
    eyebrow: 'Operational Alert Center',
    subtitle: 'Theo dõi và xử lý cảnh báo về lịch, slot, queue, bác sĩ, khoa và tài nguyên.',
    category: 'all',
  },
  scheduleSlot: {
    title: 'Cảnh báo lịch / slot',
    eyebrow: 'Schedule & Slot Alerts',
    subtitle: 'Lịch chưa publish, conflict, slot kín, slot bị khóa và low utilization.',
    category: 'schedule',
  },
  queue: {
    title: 'Cảnh báo queue',
    eyebrow: 'Queue Risk Monitor',
    subtitle: 'Queue chờ lâu, missed call, skipped, quá SLA và nghẽn theo khoa/bác sĩ.',
    category: 'queue',
  },
  doctorDepartment: {
    title: 'Cảnh báo bác sĩ / khoa',
    eyebrow: 'Doctor & Department Load Alerts',
    subtitle: 'Bác sĩ quá tải, khoa quá tải, thiếu bác sĩ, lịch chưa publish theo khoa.',
    category: 'doctor_department',
  },
  noShow: {
    title: 'Cảnh báo no-show',
    eyebrow: 'No-show Intelligence',
    subtitle: 'Theo dõi appointment no-show, queue no-show, repeat no-show và follow-up.',
    category: 'no_show',
  },
  actionCenter: {
    title: 'Cảnh báo cần xử lý ngay',
    eyebrow: 'Action Center',
    subtitle: 'Ưu tiên các sự kiện có nguy cơ ảnh hưởng bệnh nhân, lịch khám và vận hành trong ngày.',
    category: 'action',
  },
};

const severityRank = { critical: 0, high: 1, warning: 2, info: 3, resolved: 4 };

const demoAlerts = [
  { id: 'demo-alert-1', category: 'queue', type: 'queue_wait_long', severity: 'critical', status: 'open', title: 'Queue chờ quá SLA - Khoa Nội tổng quát', message: '12 bệnh nhân có nguy cơ chờ quá SLA, chờ lâu nhất 73 phút.', owner: 'Điều phối queue', departmentName: 'Nội tổng quát', doctorName: 'BS. Trần Thanh Hải', affectedCount: 12, detectedAt: new Date(Date.now() - 18 * 60000).toISOString(), suggestedActions: ['Gọi ngay', 'Chuyển queue', 'Báo trưởng khoa'] },
  { id: 'demo-alert-2', category: 'schedule', type: 'unpublished_schedule', severity: 'high', status: 'open', title: '3 lịch chưa publish trước giờ mở khám', message: '42 slot chưa mở cho bệnh nhân đặt lịch.', owner: 'Scheduler', departmentName: 'Nhi khoa', affectedCount: 42, detectedAt: new Date(Date.now() - 40 * 60000).toISOString(), suggestedActions: ['Publish lịch', 'Generate slot'] },
  { id: 'demo-alert-3', category: 'doctor_department', type: 'doctor_overloaded', severity: 'high', status: 'assigned', title: 'BS. Lê Minh Tuấn đang quá tải', message: 'Slot 100%, queue waiting 14, max wait 55 phút.', owner: 'Trưởng khoa Tim mạch', departmentName: 'Tim mạch', doctorName: 'BS. Lê Minh Tuấn', affectedCount: 14, detectedAt: new Date(Date.now() - 25 * 60000).toISOString(), suggestedActions: ['Chuyển appointment', 'Mở thêm ca'] },
  { id: 'demo-alert-4', category: 'no_show', type: 'no_show_spike', severity: 'warning', status: 'open', title: 'No-show tăng trong khung 09:00-10:00', message: 'No-show hôm nay cao hơn trung bình tuần 18%.', owner: 'Front desk', departmentName: 'Khám ngoại trú', affectedCount: 6, detectedAt: new Date(Date.now() - 65 * 60000).toISOString(), suggestedActions: ['Gọi follow-up', 'Dời lịch', 'Đưa vào waitlist'] },
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.alerts)) return value.alerts;
  return [];
}

function unwrap(result) {
  return result?.status === 'fulfilled' ? result.value : null;
}

function firstArray(...values) {
  for (const value of values) {
    const items = asArray(value);
    if (items.length) return items;
  }
  return [];
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function minutesAgo(value) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function normalizeOperationalAlert(item = {}, index = 0) {
  return {
    id: item.alert_id || item.id || item._id || `operational-${index}`,
    source: item.source_type || 'operational',
    category: item.category || item.alert_category || item.entity_type || inferCategory(item.type),
    type: item.type || item.alert_type || 'operational_alert',
    severity: item.severity || item.priority || 'warning',
    status: item.status || 'open',
    title: item.title || item.message || 'Cảnh báo vận hành',
    message: item.message || item.description || 'Cần kiểm tra cảnh báo vận hành.',
    owner: item.assigned_to?.full_name || item.owner_name || item.department_name || 'Operations',
    departmentName: item.department_name || item.department?.name || item.department_id?.name,
    doctorName: item.doctor_name || item.doctor?.name || item.doctor_id?.user_id?.full_name,
    patientName: item.patient_name || item.patient?.full_name || item.patient_id?.full_name,
    affectedCount: safeNumber(item.affected_count || item.count, 1),
    detectedAt: item.first_detected_at || item.detected_at || item.created_at || new Date().toISOString(),
    slaDueAt: item.sla_due_at,
    breachedAt: item.breached_at || item.sla_breached_at,
    suggestedActions: (item.suggested_actions || item.actions || []).map((action) => action.label || action.action || action).slice(0, 4),
    raw: item,
  };
}

function normalizeClinicalAlert(item = {}, index = 0) {
  return {
    id: item.alert_id || item.id || item._id || `clinical-${index}`,
    source: 'clinical',
    category: 'clinical',
    type: item.alert_type || item.type || 'clinical_alert',
    severity: item.severity || 'warning',
    status: item.status || 'open',
    title: item.title || item.message || 'Cảnh báo lâm sàng',
    message: item.message || item.description || 'Cần điều dưỡng/bác sĩ xử lý cảnh báo lâm sàng.',
    owner: item.assigned_to?.full_name || item.department_name || 'Nursing',
    departmentName: item.department_name || item.department?.name,
    doctorName: item.doctor_name,
    patientName: item.patient_name || item.patient?.full_name,
    affectedCount: 1,
    detectedAt: item.created_at || item.detected_at || new Date().toISOString(),
    slaDueAt: item.sla_due_at,
    breachedAt: item.breached_at,
    suggestedActions: ['Acknowledge', 'Notify doctor', 'Resolve'],
    raw: item,
  };
}

function normalizeDiagnosticAlert(item = {}, index = 0) {
  return {
    id: item.alert_id || item.id || item._id || `diagnostic-${index}`,
    source: 'diagnostic',
    category: 'diagnostic',
    type: item.alert_type || item.type || 'diagnostic_alert',
    severity: item.severity || item.priority || 'warning',
    status: item.status || 'open',
    title: item.title || item.message || 'Cảnh báo cận lâm sàng',
    message: item.message || item.description || 'Cần xử lý cảnh báo kết quả/cận lâm sàng.',
    owner: item.assigned_to?.full_name || item.department_name || 'Diagnostics',
    departmentName: item.department_name || item.department?.name,
    doctorName: item.doctor_name,
    patientName: item.patient_name || item.patient?.full_name,
    affectedCount: 1,
    detectedAt: item.created_at || item.detected_at || new Date().toISOString(),
    slaDueAt: item.sla_due_at,
    breachedAt: item.breached_at,
    suggestedActions: ['Acknowledge', 'Assign', 'Resolve'],
    raw: item,
  };
}

function inferCategory(type = '') {
  if (String(type).includes('queue')) return 'queue';
  if (String(type).includes('slot') || String(type).includes('schedule')) return 'schedule';
  if (String(type).includes('doctor') || String(type).includes('department')) return 'doctor_department';
  if (String(type).includes('no_show')) return 'no_show';
  return 'resource';
}

function deriveAlerts({ operational, scheduleSummary, queueTickets, appointments, queueSummary, clinical, diagnostic, nursingAlerts }) {
  const direct = firstArray(operational?.items, operational).map(normalizeOperationalAlert);
  if (direct.length) return direct;

  const scheduleAlerts = asArray(scheduleSummary?.operation_alerts).map((item, index) => normalizeOperationalAlert({
    ...item,
    category: 'schedule',
    source_type: 'schedule_summary',
    severity: item.severity || 'warning',
    title: item.title || item.message || 'Cảnh báo lịch / slot',
  }, index));

  const queueAlerts = asArray(queueTickets)
    .filter((ticket) => ticket.status === 'waiting' || ticket.sla_breached_at || minutesAgo(ticket.checkin_time) > 30)
    .slice(0, 20)
    .map((ticket, index) => normalizeOperationalAlert({
      id: ticket.queue_ticket_id || ticket.id || `queue-alert-${index}`,
      category: 'queue',
      type: ticket.sla_breached_at ? 'queue_sla_breached' : 'queue_wait_long',
      severity: ticket.sla_breached_at || minutesAgo(ticket.checkin_time) > 45 ? 'critical' : 'high',
      title: `Queue ${ticket.display_number || ticket.queue_number || ''} chờ lâu`,
      message: `${ticket.patient_name || ticket.patient?.full_name || 'Bệnh nhân'} đã chờ ${minutesAgo(ticket.checkin_time)} phút.`,
      department_name: ticket.department_name,
      doctor_name: ticket.doctor_name,
      affected_count: 1,
      detected_at: ticket.checkin_time,
    }, index));

  const noShowAlerts = asArray(appointments)
    .filter((appointment) => appointment.status === 'no_show')
    .slice(0, 20)
    .map((appointment, index) => normalizeOperationalAlert({
      id: appointment.appointment_id || appointment.id || `no-show-alert-${index}`,
      category: 'no_show',
      type: 'appointment_no_show',
      severity: 'warning',
      title: 'Appointment no-show',
      message: `${appointment.patient_name || appointment.patient?.full_name || 'Bệnh nhân'} không đến lịch hẹn.`,
      department_name: appointment.department_name,
      doctor_name: appointment.doctor_name,
      affected_count: 1,
      detected_at: appointment.no_show_at || appointment.appointment_time,
    }, index));

  const queueSummaryAlert = queueSummary?.waiting > 20 ? [normalizeOperationalAlert({
    id: 'queue-summary-pressure',
    category: 'queue',
    type: 'queue_spike',
    severity: queueSummary.waiting > 40 ? 'critical' : 'high',
    title: 'Queue waiting tăng cao',
    message: `${queueSummary.waiting} bệnh nhân đang chờ, cần điều phối tải.`,
    affected_count: queueSummary.waiting,
  })] : [];

  const clinicalAlerts = firstArray(clinical?.items, clinical, nursingAlerts).map(normalizeClinicalAlert);
  const diagnosticAlerts = firstArray(diagnostic?.items, diagnostic).map(normalizeDiagnosticAlert);

  const built = [...scheduleAlerts, ...queueAlerts, ...queueSummaryAlert, ...noShowAlerts, ...clinicalAlerts, ...diagnosticAlerts];
  return built.length ? built : demoAlerts;
}

export function OperationalAlertPage({ view = 'all' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.all;
  const [filters, setFilters] = useState({ date: todayIso(), query: '', severity: 'all', status: 'open' });
  const [state, setState] = useState({
    loading: true,
    error: null,
    operational: null,
    summary: null,
    actionCenter: null,
    scheduleSlot: null,
    queue: null,
    doctorDepartment: null,
    noShow: null,
    scheduleSummary: null,
    queueSummary: null,
    queueTickets: null,
    appointments: null,
    clinical: null,
    diagnostic: null,
    nursingAlerts: null,
  });
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      const params = { date: filters.date };
      const results = await Promise.allSettled([
        schedulingApi.getOperationsAlerts(params),
        schedulingApi.getOperationsAlertsSummary(params),
        schedulingApi.getOperationsAlertActionCenter(params),
        schedulingApi.getOperationsScheduleSlotAlerts(params),
        schedulingApi.getOperationsQueueAlerts(params),
        schedulingApi.getOperationsDoctorDepartmentAlerts(params),
        schedulingApi.getOperationsNoShowAlerts(params),
        schedulingApi.getSystemSummary({ preset: 'today' }),
        schedulingApi.getQueueSummaryToday(params),
        schedulingApi.listQueueTickets({ ...params, limit: 200 }),
        schedulingApi.getTodayAppointments(params),
        schedulingApi.listClinicalAlerts({ ...params, limit: 100 }),
        schedulingApi.listDiagnosticAlerts({ ...params, limit: 100 }),
        schedulingApi.getNursingPriorityAlerts(params),
      ]);
      if (!active) return;
      const [
        operational,
        summary,
        actionCenter,
        scheduleSlot,
        queue,
        doctorDepartment,
        noShow,
        scheduleSummary,
        queueSummary,
        queueTickets,
        appointments,
        clinical,
        diagnostic,
        nursingAlerts,
      ] = results.map(unwrap);
      const hasLegacy = scheduleSummary || queueSummary || queueTickets || appointments || clinical || diagnostic || nursingAlerts;
      const firstError = hasLegacy ? null : results.find((item) => item.status === 'rejected')?.reason?.message;
      setState({
        loading: false,
        error: firstError || null,
        operational,
        summary,
        actionCenter,
        scheduleSlot,
        queue,
        doctorDepartment,
        noShow,
        scheduleSummary,
        queueSummary,
        queueTickets,
        appointments,
        clinical,
        diagnostic,
        nursingAlerts,
      });
    }
    load();
    return () => {
      active = false;
    };
  }, [filters.date, reloadKey]);

  const alerts = useMemo(() => {
    const scoped = {
      all: state.operational,
      scheduleSlot: state.scheduleSlot,
      queue: state.queue,
      doctorDepartment: state.doctorDepartment,
      noShow: state.noShow,
      actionCenter: state.actionCenter,
    }[view];
    const direct = firstArray(scoped?.items, scoped).map(normalizeOperationalAlert);
    const base = direct.length ? direct : deriveAlerts({
      operational: state.operational,
      scheduleSummary: state.scheduleSummary,
      queueTickets: firstArray(state.queueTickets?.items, state.queueTickets),
      appointments: firstArray(state.appointments?.items, state.appointments),
      queueSummary: state.queueSummary,
      clinical: state.clinical,
      diagnostic: state.diagnostic,
      nursingAlerts: state.nursingAlerts,
    });
    return base
      .filter((item) => config.category === 'all' || config.category === 'action' || item.category === config.category || (config.category === 'doctor_department' && ['doctor', 'department'].includes(item.category)))
      .sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3) || minutesAgo(b.detectedAt) - minutesAgo(a.detectedAt));
  }, [config.category, state, view]);

  const visible = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return alerts.filter((item) => {
      const text = `${item.title} ${item.message} ${item.departmentName || ''} ${item.doctorName || ''} ${item.patientName || ''}`.toLowerCase();
      const severityOk = filters.severity === 'all' || item.severity === filters.severity;
      const statusOk = filters.status === 'all' || item.status === filters.status || (filters.status === 'open' && !['resolved', 'dismissed'].includes(item.status));
      return severityOk && statusOk && (!query || text.includes(query));
    });
  }, [alerts, filters.query, filters.severity, filters.status]);

  const summary = useMemo(() => ({
    total: alerts.filter((item) => !['resolved', 'dismissed'].includes(item.status)).length,
    critical: alerts.filter((item) => item.severity === 'critical').length,
    high: alerts.filter((item) => item.severity === 'high').length,
    breached: alerts.filter((item) => item.breachedAt || (item.slaDueAt && new Date(item.slaDueAt) < new Date())).length,
    assigned: alerts.filter((item) => item.status === 'assigned').length,
    resolved: alerts.filter((item) => item.status === 'resolved').length,
  }), [alerts]);

  const refreshAlerts = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  const runAlertAction = async (item, action) => {
    const labels = {
      ack: 'acknowledge',
      assign: 'assign',
      resolve: 'resolve',
      dismiss: 'dismiss',
    };
    const label = labels[action] || action;

    await runSchedulingAction({
      action: async () => {
        if (String(item.id).startsWith('demo-') || String(item.id).includes('summary') || String(item.id).includes('queue-alert')) {
          return { local_only: true };
        }
        if (item.source === 'clinical') {
          if (action === 'ack') return schedulingApi.acknowledgeClinicalAlert(item.id, {});
          if (action === 'resolve') return schedulingApi.resolveClinicalAlert(item.id, {});
        } else if (item.source === 'diagnostic') {
          if (action === 'ack') return schedulingApi.acknowledgeDiagnosticAlert(item.id, {});
          if (action === 'assign') return schedulingApi.assignDiagnosticAlert(item.id, {});
          if (action === 'resolve') return schedulingApi.resolveDiagnosticAlert(item.id, {});
          if (action === 'dismiss') return schedulingApi.dismissDiagnosticAlert(item.id, {});
        } else {
          if (action === 'ack') return schedulingApi.acknowledgeOperationAlert(item.id, {});
          if (action === 'assign') return schedulingApi.assignOperationAlert(item.id, {});
          if (action === 'resolve') return schedulingApi.resolveOperationAlert(item.id, {});
          if (action === 'dismiss') return schedulingApi.dismissOperationAlert(item.id, {});
        }
        throw new Error('Hành động cảnh báo chưa được hỗ trợ.');
      },
      confirm: ['resolve', 'dismiss'].includes(action) ? {
        title: `Xác nhận ${label} cảnh báo`,
        body: `${label} cảnh báo "${item.title}".`,
        confirmLabel: label,
      } : null,
      pendingMessage: `Đang ${label} cảnh báo...`,
      successTitle: 'Cảnh báo đã cập nhật',
      successBody: `Đã ${label} cảnh báo.`,
      errorTitle: 'Không xử lý được cảnh báo',
      errorBody: 'Không xử lý được cảnh báo.',
      to: '/scheduling/alerts',
      onStatus: setMessage,
      onSuccess: refreshAlerts,
    });
  };

  return (
    <main className="sched-alert-page">
      <AlertHeader config={config} filters={filters} setFilters={setFilters} loading={state.loading} error={state.error} />
      {message ? <div className="sched-alert-notice">{message}</div> : null}
      <AlertKpis summary={summary} />
      <AlertToolbar filters={filters} setFilters={setFilters} />

      {view === 'actionCenter'
        ? <ActionCenter alerts={visible} loading={state.loading} onSelect={setSelected} runAction={runAlertAction} />
        : <AlertList alerts={visible} loading={state.loading} onSelect={setSelected} runAction={runAlertAction} />}

      {selected ? <AlertDrawer alert={selected} onClose={() => setSelected(null)} runAction={runAlertAction} /> : null}
    </main>
  );
}

function AlertHeader({ config, filters, setFilters, loading, error }) {
  return (
    <section className="sched-alert-hero">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
        <small><i />{loading ? 'Đang đồng bộ alert' : 'Alert center sẵn sàng'}{error ? ` · ${error}` : ''}</small>
      </div>
      <div className="sched-alert-hero__tools">
        <label><span>Ngày</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, date: todayIso() }))}><RefreshCw size={16} />Hôm nay</button>
        <Link to="/scheduling/resources/attention"><ShieldAlert size={16} />Tài nguyên cần chú ý</Link>
      </div>
    </section>
  );
}

function AlertKpis({ summary }) {
  const cards = [
    ['Đang mở', summary.total, BellRing, 'blue'],
    ['Critical', summary.critical, ShieldAlert, 'red'],
    ['High', summary.high, AlertTriangle, 'orange'],
    ['Quá SLA', summary.breached, Clock3, 'red'],
    ['Đã gán', summary.assigned, UsersRound, 'purple'],
    ['Resolved', summary.resolved, CheckCircle2, 'green'],
  ];
  return (
    <section className="sched-alert-kpis">
      {cards.map(([label, value, Icon, tone]) => (
        <article className={`is-${tone}`} key={label}><span><Icon size={18} /></span><div><strong>{value}</strong><small>{label}</small></div></article>
      ))}
    </section>
  );
}

function AlertToolbar({ filters, setFilters }) {
  return (
    <section className="sched-alert-toolbar">
      <div><Search size={16} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Tìm cảnh báo, khoa, bác sĩ, bệnh nhân..." /></div>
      <select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
        <option value="all">Tất cả severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="warning">Warning</option>
        <option value="info">Info</option>
      </select>
      <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
        <option value="open">Đang mở</option>
        <option value="all">Tất cả trạng thái</option>
        <option value="assigned">Đã gán</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </select>
    </section>
  );
}

function AlertList({ alerts, loading, onSelect, runAction }) {
  if (loading) return <AlertSkeleton />;
  return (
    <section className="sched-alert-list">
      {alerts.map((alert) => <AlertCard alert={alert} key={alert.id} onSelect={onSelect} runAction={runAction} />)}
      {!alerts.length ? <div className="sched-alert-empty">Không có cảnh báo phù hợp bộ lọc.</div> : null}
    </section>
  );
}

function ActionCenter({ alerts, loading, onSelect, runAction }) {
  if (loading) return <AlertSkeleton />;
  const lanes = ['critical', 'high', 'warning'];
  return (
    <section className="sched-alert-action-board">
      {lanes.map((severity) => {
        const rows = alerts.filter((item) => item.severity === severity || (severity === 'warning' && !['critical', 'high'].includes(item.severity)));
        return (
          <div className="sched-alert-action-lane" key={severity}>
            <header><strong>{severity}</strong><span>{rows.length}</span></header>
            {rows.map((alert) => <AlertCard alert={alert} key={alert.id} onSelect={onSelect} runAction={runAction} compact />)}
            {!rows.length ? <div className="sched-alert-empty">Không có alert</div> : null}
          </div>
        );
      })}
    </section>
  );
}

function AlertCard({ alert, onSelect, runAction, compact = false }) {
  return (
    <article className={`sched-alert-card is-${alert.severity}`} onClick={() => onSelect(alert)}>
      <header>
        <span>{alert.severity}</span>
        <small>{alert.category} · {alert.type}</small>
      </header>
      <h3>{alert.title}</h3>
      <p>{alert.message}</p>
      {!compact ? (
        <div className="sched-alert-card__meta">
          <span>{alert.departmentName || 'Không rõ khoa'}</span>
          <span>{alert.doctorName || 'Không rõ bác sĩ'}</span>
          <span>Ảnh hưởng {alert.affectedCount}</span>
          <span>{minutesAgo(alert.detectedAt)} phút trước</span>
        </div>
      ) : null}
      <footer onClick={(event) => event.stopPropagation()}>
        {(alert.suggestedActions.length ? alert.suggestedActions : ['Xem chi tiết']).map((action) => <em key={action}>{action}</em>)}
        <button type="button" onClick={() => runAction(alert, 'ack')}>Acknowledge</button>
        <button type="button" onClick={() => runAction(alert, 'resolve')}>Resolve</button>
      </footer>
    </article>
  );
}

function AlertDrawer({ alert, onClose, runAction }) {
  return (
    <aside className="sched-alert-drawer">
      <header>
        <div><span>{alert.category}</span><h2>{alert.title}</h2><p>{alert.message}</p></div>
        <button type="button" onClick={onClose}>Đóng</button>
      </header>
      <section>
        <h3>Tổng quan</h3>
        <dl>
          <div><dt>Severity</dt><dd>{alert.severity}</dd></div>
          <div><dt>Status</dt><dd>{alert.status}</dd></div>
          <div><dt>Nguồn</dt><dd>{alert.source}</dd></div>
          <div><dt>Khoa</dt><dd>{alert.departmentName || '—'}</dd></div>
          <div><dt>Bác sĩ</dt><dd>{alert.doctorName || '—'}</dd></div>
          <div><dt>Ảnh hưởng</dt><dd>{alert.affectedCount}</dd></div>
          <div><dt>Phát hiện</dt><dd>{formatTime(alert.detectedAt)}</dd></div>
          <div><dt>SLA</dt><dd>{alert.slaDueAt ? formatTime(alert.slaDueAt) : '—'}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Gợi ý xử lý</h3>
        <ul>{(alert.suggestedActions.length ? alert.suggestedActions : ['Mở entity liên quan', 'Gán người xử lý', 'Resolve khi hoàn tất']).map((action) => <li key={action}>{action}</li>)}</ul>
      </section>
      <section className="sched-alert-drawer__actions">
        <button type="button" onClick={() => runAction(alert, 'ack')}>Acknowledge</button>
        <button type="button" onClick={() => runAction(alert, 'assign')}>Assign</button>
        <button type="button" onClick={() => runAction(alert, 'resolve')}>Resolve</button>
        <button type="button" onClick={() => runAction(alert, 'dismiss')}>Dismiss</button>
      </section>
      <section>
        <h3>Liên kết nhanh</h3>
        <div className="sched-alert-links">
          <Link to="/scheduling/today"><CalendarX2 size={15} />Lịch hôm nay</Link>
          <Link to="/scheduling/queue"><ListOrdered size={15} />Queue board</Link>
          <Link to="/scheduling/departments"><Stethoscope size={15} />Khoa / bác sĩ</Link>
          <Link to="/scheduling/appointments/no-show"><UserRoundX size={15} />No-show</Link>
        </div>
      </section>
    </aside>
  );
}

function AlertSkeleton() {
  return (
    <section className="sched-alert-list">
      {Array.from({ length: 5 }, (_, index) => <div className="sched-alert-skeleton" key={index} />)}
    </section>
  );
}
