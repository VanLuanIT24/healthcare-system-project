const reportService = require('./report.service');
const clinicalOperationsOverviewService = require('./clinical-operations-overview.service');
const diagnosticAlertService = require('./diagnostic-alert.service');
const auditQueryService = require('./audit-query.service');
const notificationService = require('./notification.service');
const supportTicketService = require('./support-ticket.service');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  const offset = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
}

function startOfMonth(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

function startOfQuarter(value = new Date()) {
  const date = startOfDay(value);
  date.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
  return date;
}

function rangeDays(start, end) {
  return Math.max(1, Math.round((endOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1);
}

function buildRange(query = {}, fallback = 'today') {
  const now = new Date();
  if (query.date_from || query.from || query.date_to || query.to) {
    const start = startOfDay(query.date_from || query.from || now);
    const end = endOfDay(query.date_to || query.to || start);
    return { start, end };
  }

  const preset = String(query.period || query.range || fallback || 'today').toLowerCase();
  if (preset === '7d' || preset === 'last_7_days') return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (preset === '30d' || preset === 'last_30_days') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (preset === 'week' || preset === 'this_week') return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
  if (preset === 'month' || preset === 'this_month') return { start: startOfMonth(now), end: endOfDay(now) };
  if (preset === 'quarter' || preset === 'this_quarter') return { start: startOfQuarter(now), end: endOfDay(now) };
  return { start: startOfDay(now), end: endOfDay(now) };
}

function previousRange(range) {
  const days = rangeDays(range.start, range.end);
  const end = endOfDay(addDays(range.start, -1));
  const start = startOfDay(addDays(end, -(days - 1)));
  return { start, end };
}

function queryForRange(range, query = {}) {
  return {
    ...query,
    date: undefined,
    date_from: isoDate(range.start),
    date_to: isoDate(range.end),
    from: undefined,
    to: undefined,
    timezone: query.timezone || DEFAULT_TIMEZONE,
  };
}

function todayQuery(query = {}) {
  return {
    ...query,
    date: query.date || isoDate(new Date()),
    timezone: query.timezone || DEFAULT_TIMEZONE,
  };
}

async function safe(key, fn) {
  try {
    return { key, ok: true, data: await fn() };
  } catch (error) {
    return {
      key,
      ok: false,
      error: {
        status: error.statusCode || error.status || 500,
        message: error.message || 'Không thể tải dữ liệu.',
      },
    };
  }
}

function collect(results = []) {
  return results.reduce((acc, item) => {
    if (item.ok) acc[item.key] = item.data;
    else {
      acc[item.key] = null;
      acc.data_errors.push({ key: item.key, ...item.error });
    }
    return acc;
  }, { data_errors: [] });
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function rate(part, total) {
  return total ? Number(((number(part) / number(total)) * 100).toFixed(2)) : 0;
}

function delta(current, previous, polarity = 'higher_good') {
  const change = number(current) - number(previous);
  const changePercent = number(previous) > 0 ? Number(((change / number(previous)) * 100).toFixed(2)) : null;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
  const good = polarity === 'higher_good' ? change >= 0 : change <= 0;
  return { current: number(current), previous: number(previous), change, change_percent: changePercent, direction, status: direction === 'stable' ? 'neutral' : good ? 'good' : 'danger' };
}

function byStatus(summary = {}, aliases = []) {
  return aliases.reduce((sum, key) => sum + number(summary[key]), 0);
}

function activeQueue(queue = {}) {
  const summary = queue.summary || {};
  return number(summary.waiting_count) + number(summary.called_count) + number(summary.in_service_count);
}

function activeEncounters(encounters = {}) {
  const summary = encounters.summary || {};
  return number(summary.arrived_count) + number(summary.in_progress_count) + number(summary.on_hold_count);
}

function revenuePaid(revenue = {}) {
  const summary = revenue.summary || {};
  return number(summary.paid_amount || summary.total_paid || summary.revenue || summary.net_revenue);
}

function outstanding(revenue = {}) {
  const summary = revenue.summary || {};
  return number(summary.outstanding_amount || summary.balance_due || summary.unpaid_amount);
}

function flattenDaySeries(...reports) {
  const map = new Map();
  for (const { key, report } of reports) {
    const rows = report?.breakdowns?.by_day || [];
    for (const row of rows) {
      const date = row.date || row.day || row._id;
      if (!date) continue;
      const bucket = map.get(date) || { date };
      bucket[key] = number(row.count || row.amount || row.total);
      map.set(date, bucket);
    }
  }
  return [...map.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

function topRows(rows = [], labelKeys = [], valueKeys = [], limit = 8) {
  return [...rows]
    .map((row) => ({
      ...row,
      label: labelKeys.map((key) => row[key]).find(Boolean) || 'Chưa xác định',
      value: valueKeys.map((key) => number(row[key])).find((value) => value > 0) || 0,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
}

function buildSummaryCards(data = {}) {
  const appointments = data.appointments?.summary || {};
  const queue = data.queue?.summary || {};
  const encounters = data.encounters?.summary || {};
  const inventory = data.inventory?.summary || {};
  const alerts = data.alerts?.summary || {};
  const failedNotifications = data.failed_notifications?.pagination?.total || data.failed_notifications?.items?.length || 0;
  return [
    { key: 'appointments', label: 'Lịch hẹn hôm nay', value: number(appointments.total_appointments), status: 'neutral', module: 'appointments' },
    { key: 'checked_in', label: 'Đã check-in', value: number(appointments.checked_in_count), status: 'good', module: 'appointments' },
    { key: 'active_encounters', label: 'Encounter đang xử lý', value: activeEncounters(data.encounters), status: activeEncounters(data.encounters) > 30 ? 'warning' : 'good', module: 'encounters' },
    { key: 'completed', label: 'Đã hoàn tất', value: number(encounters.completed_count || appointments.completed_count), status: 'good', module: 'encounters' },
    { key: 'queue_waiting', label: 'Queue đang chờ', value: activeQueue(data.queue), status: activeQueue(data.queue) > 25 ? 'warning' : 'good', module: 'queue' },
    { key: 'avg_waiting', label: 'Chờ trung bình', value: number(queue.average_waiting_time), unit: 'minutes', status: number(queue.average_waiting_time) > 30 ? 'danger' : number(queue.average_waiting_time) > 15 ? 'warning' : 'good', module: 'queue' },
    { key: 'revenue', label: 'Doanh thu thực thu', value: revenuePaid(data.revenue), unit: 'currency', status: 'good', module: 'finance' },
    { key: 'outstanding', label: 'Công nợ', value: outstanding(data.revenue), unit: 'currency', status: outstanding(data.revenue) > 0 ? 'warning' : 'good', module: 'finance' },
    { key: 'low_stock', label: 'Tồn kho thấp', value: number(inventory.low_stock_items), status: number(inventory.low_stock_items) > 0 ? 'warning' : 'good', module: 'inventory' },
    { key: 'critical_alerts', label: 'Critical alerts', value: number(alerts.critical || alerts.critical_open), status: number(alerts.critical || alerts.critical_open) > 0 ? 'danger' : 'good', module: 'quality' },
    { key: 'overdue_orders', label: 'Overdue orders', value: number(alerts.overdue_orders), status: number(alerts.overdue_orders) > 0 ? 'danger' : 'good', module: 'clinical_ops' },
    { key: 'failed_notifications', label: 'Failed notifications', value: number(failedNotifications), status: number(failedNotifications) > 0 ? 'warning' : 'good', module: 'notifications' },
  ];
}

function buildHealth(data = {}) {
  const cards = buildSummaryCards(data);
  const score = (keys) => {
    const selected = cards.filter((card) => keys.includes(card.key));
    if (!selected.length) return 100;
    const penalty = selected.reduce((sum, card) => sum + (card.status === 'danger' ? 30 : card.status === 'warning' ? 14 : 0), 0);
    return Math.max(0, 100 - penalty);
  };
  return {
    queue_health: { score: score(['queue_waiting', 'avg_waiting']), status: score(['queue_waiting', 'avg_waiting']) >= 80 ? 'good' : 'warning' },
    finance_health: { score: score(['revenue', 'outstanding']), status: score(['revenue', 'outstanding']) >= 80 ? 'good' : 'warning' },
    clinical_ops_health: { score: score(['active_encounters', 'overdue_orders', 'critical_alerts']), status: score(['active_encounters', 'overdue_orders', 'critical_alerts']) >= 80 ? 'good' : 'warning' },
    inventory_health: { score: score(['low_stock']), status: score(['low_stock']) >= 90 ? 'good' : 'warning' },
    security_health: { score: score(['failed_notifications']), status: score(['failed_notifications']) >= 90 ? 'good' : 'warning' },
  };
}

function buildRuleBasedAnomalies(data = {}, comparison = null) {
  const anomalies = [];
  const push = (condition, item) => {
    if (condition) anomalies.push({ detected_at: new Date(), owner: 'Điều phối vận hành', ...item });
  };
  const appointments = data.appointments?.summary || {};
  const queue = data.queue?.summary || {};
  const inventory = data.inventory?.summary || {};
  const alerts = data.alerts?.summary || {};
  const failedTotal = data.failed_notifications?.pagination?.total || data.failed_notifications?.items?.length || 0;

  push(number(appointments.no_show_rate) > 15, {
    severity: 'high',
    module: 'appointments',
    title: 'Tỷ lệ no-show vượt ngưỡng',
    metric: 'no_show_rate',
    current: number(appointments.no_show_rate),
    threshold: 15,
    suggested_action: 'Rà soát nhắc lịch, gọi xác nhận và slot dự phòng.',
  });
  push(number(queue.average_waiting_time) > 30, {
    severity: 'high',
    module: 'queue',
    title: 'Thời gian chờ trung bình cao',
    metric: 'average_waiting_time',
    current: number(queue.average_waiting_time),
    threshold: 30,
    suggested_action: 'Mở thêm bàn tiếp nhận hoặc điều phối lại phòng khám.',
  });
  push(number(alerts.ack_overdue || alerts.critical_overdue) > 0, {
    severity: 'critical',
    module: 'diagnostics',
    title: 'Critical result quá hạn xác nhận',
    metric: 'critical_overdue',
    current: number(alerts.ack_overdue || alerts.critical_overdue),
    threshold: 0,
    suggested_action: 'Yêu cầu bác sĩ/kỹ thuật viên xác nhận ngay.',
  });
  push(number(alerts.overdue_orders) > 0, {
    severity: 'critical',
    module: 'clinical_ops',
    title: 'Có chỉ định quá hạn SLA',
    metric: 'overdue_orders',
    current: number(alerts.overdue_orders),
    threshold: 0,
    suggested_action: 'Ưu tiên STAT/Urgent và escalate ca quá hạn.',
  });
  push(number(inventory.low_stock_items) > 0, {
    severity: 'medium',
    module: 'inventory',
    title: 'Có thuốc dưới tồn tối thiểu',
    metric: 'low_stock_items',
    current: number(inventory.low_stock_items),
    threshold: 0,
    suggested_action: 'Tạo yêu cầu bổ sung kho và kiểm tra thuốc thay thế.',
  });
  push(number(failedTotal) > 0, {
    severity: 'medium',
    module: 'notifications',
    title: 'Thông báo gửi thất bại',
    metric: 'failed_notifications',
    current: number(failedTotal),
    threshold: 0,
    suggested_action: 'Retry các kênh lỗi và kiểm tra cấu hình provider.',
  });
  if (comparison?.metrics?.revenue?.change_percent !== null) {
    push(comparison.metrics.revenue.change_percent < -20, {
      severity: 'high',
      module: 'finance',
      title: 'Doanh thu giảm mạnh so với kỳ trước',
      metric: 'revenue_change_percent',
      current: comparison.metrics.revenue.change_percent,
      threshold: -20,
      suggested_action: 'Đối chiếu lượt khám, thanh toán treo và doanh thu theo khoa.',
    });
  }
  return anomalies;
}

function buildActionItems(data = {}, anomalies = []) {
  const items = [];
  const add = (priority, module, title, description, source, severity = 'medium') => {
    items.push({
      id: `${module}-${items.length + 1}`,
      priority,
      module,
      severity,
      title,
      description,
      source,
      status: 'open',
      created_at: new Date(),
      due_at: priority === 'now' ? new Date(Date.now() + 30 * 60000) : new Date(Date.now() + 8 * 60 * 60000),
    });
  };

  for (const anomaly of anomalies) add(anomaly.severity === 'critical' ? 'now' : 'today', anomaly.module, anomaly.title, anomaly.suggested_action, 'rule_engine', anomaly.severity);
  for (const item of (data.critical_open?.items || []).slice(0, 5)) add('now', 'diagnostics', item.title || 'Critical result cần xử lý', item.message || item.critical_summary || 'Mở chi tiết cảnh báo.', item.alert_no || item.id, 'critical');
  for (const item of (data.pending_approval?.items || []).slice(0, 5)) add('today', 'clinical_ops', item.title || 'Kết quả chờ duyệt/ký', item.stage_label || 'Hoàn tất phê duyệt kết quả.', item.entity_id || item.id, 'medium');
  for (const item of (data.pending_completion?.items || []).slice(0, 5)) add('today', 'clinical_ops', item.title || 'Kết quả chờ hoàn tất', item.stage_label || 'Hoàn tất xử lý kết quả.', item.entity_id || item.id, 'medium');
  for (const item of (data.failed_notifications?.items || []).slice(0, 5)) add('watch', 'notifications', item.title || 'Thông báo gửi thất bại', item.error_message || item.channel || 'Kiểm tra và gửi lại thông báo.', item._id || item.id, 'medium');
  for (const item of (data.support_tickets?.items || []).slice(0, 5)) add('watch', 'support', item.subject || 'Ticket hỗ trợ đang mở', item.description || item.ticket_code || 'Theo dõi SLA ticket hỗ trợ.', item.ticket_code || item._id, item.priority === 'urgent' ? 'high' : 'low');
  return items;
}

async function loadOperationalData(query = {}, actor = {}, range = buildRange(query)) {
  const scoped = queryForRange(range, query);
  const today = todayQuery(query);
  const results = await Promise.all([
    safe('system', () => reportService.getSystemDashboard(actor)),
    safe('billing_dashboard', () => reportService.getBillingDashboard(actor)),
    safe('inventory_dashboard', () => reportService.getInventoryDashboard(actor)),
    safe('appointments', () => reportService.getAppointmentReport(query.date ? today : scoped, actor)),
    safe('queue', () => reportService.getQueueReport(query.date ? today : scoped, actor)),
    safe('encounters', () => reportService.getEncounterReport(query.date ? today : scoped, actor)),
    safe('revenue', () => reportService.getRevenueReport(scoped, actor)),
    safe('inventory', () => reportService.getInventoryReport(query.date ? today : scoped, actor)),
    safe('departments', () => reportService.getDepartmentReport(query.date ? today : scoped, actor)),
    safe('doctors', () => reportService.getDoctorReport(query.date ? today : scoped, actor)),
    safe('clinical_ops', () => clinicalOperationsOverviewService.getDashboard(query, actor)),
    safe('today_worklist', () => clinicalOperationsOverviewService.getTodayWorklist(today, actor)),
    safe('alerts', () => diagnosticAlertService.getDiagnosticAlertSummary(query, actor)),
    safe('critical_open', () => diagnosticAlertService.getCriticalOpenAlerts({ ...query, limit: 20 }, actor)),
    safe('critical_overdue', () => diagnosticAlertService.getCriticalOverdueAlerts({ ...query, limit: 20 }, actor)),
    safe('alert_overdue_orders', () => diagnosticAlertService.getOverdueOrderAlerts({ ...query, limit: 20 }, actor)),
    safe('no_show_cancellations', () => diagnosticAlertService.getNoShowCancellationAlerts({ ...query, limit: 20 }, actor)),
    safe('pending_completion', () => clinicalOperationsOverviewService.getPendingCompletion({ ...query, limit: 20 }, actor)),
    safe('pending_approval', () => clinicalOperationsOverviewService.getPendingApproval({ ...query, limit: 20 }, actor)),
    safe('overdue_orders', () => clinicalOperationsOverviewService.getOverdueOrders({ ...query, limit: 20 }, actor)),
    safe('failed_notifications', () => notificationService.listFailedNotifications({ ...query, limit: 20 }, actor)),
    safe('audit_logs', () => auditQueryService.listAuditLogs({ ...query, limit: 20 }, actor)),
    safe('support_tickets', () => supportTicketService.listTickets({ ...query, status: query.status || 'open', limit: 20 }, actor)),
  ]);
  return collect(results);
}

function buildComparison(current, previous) {
  const metrics = {
    appointments: delta(current.appointments?.summary?.total_appointments, previous.appointments?.summary?.total_appointments),
    completed_appointments: delta(current.appointments?.summary?.completed_count, previous.appointments?.summary?.completed_count),
    no_show_rate: delta(current.appointments?.summary?.no_show_rate, previous.appointments?.summary?.no_show_rate, 'lower_good'),
    queue_waiting_avg: delta(current.queue?.summary?.average_waiting_time, previous.queue?.summary?.average_waiting_time, 'lower_good'),
    encounters: delta(current.encounters?.summary?.total_encounters, previous.encounters?.summary?.total_encounters),
    completed_encounters: delta(current.encounters?.summary?.completed_count, previous.encounters?.summary?.completed_count),
    revenue: delta(revenuePaid(current.revenue), revenuePaid(previous.revenue)),
    outstanding_amount: delta(outstanding(current.revenue), outstanding(previous.revenue), 'lower_good'),
    low_stock: delta(current.inventory?.summary?.low_stock_items, previous.inventory?.summary?.low_stock_items, 'lower_good'),
    critical_alerts: delta(current.alerts?.summary?.critical, previous.alerts?.summary?.critical, 'lower_good'),
  };
  return { metrics, generated_at: new Date() };
}

async function getComparison(query = {}, actor = {}) {
  const currentRange = buildRange(query, query.compare || 'week');
  const previous = previousRange(currentRange);
  const [currentData, previousData] = await Promise.all([
    loadOperationalData(queryForRange(currentRange, query), actor, currentRange),
    loadOperationalData(queryForRange(previous, query), actor, previous),
  ]);
  return {
    ...buildComparison(currentData, previousData),
    current_period: { date_from: isoDate(currentRange.start), date_to: isoDate(currentRange.end) },
    previous_period: { date_from: isoDate(previous.start), date_to: isoDate(previous.end) },
    data_errors: [...currentData.data_errors, ...previousData.data_errors],
  };
}

async function getOverview(query = {}, actor = {}) {
  const range = buildRange(query);
  const data = await loadOperationalData(query, actor, range);
  const comparison = await getComparison({ ...query, date_from: isoDate(range.start), date_to: isoDate(range.end) }, actor);
  const anomalyAlerts = buildRuleBasedAnomalies(data, comparison);
  const actionItems = buildActionItems(data, anomalyAlerts);
  return {
    summary_cards: buildSummaryCards(data),
    kpis: {
      appointments: data.appointments?.summary || {},
      queue: data.queue?.summary || {},
      encounters: data.encounters?.summary || {},
      finance: data.revenue?.summary || {},
      inventory: data.inventory?.summary || {},
      quality: data.alerts?.summary || {},
    },
    comparison: comparison.metrics,
    trends: flattenDaySeries(
      { key: 'appointments', report: data.appointments },
      { key: 'encounters', report: data.encounters },
      { key: 'revenue', report: data.revenue },
    ),
    anomaly_alerts: anomalyAlerts,
    action_items: actionItems,
    department_ranking: topRows(data.departments?.items || data.appointments?.breakdowns?.by_department || [], ['department_name', 'department_code'], ['appointment_count', 'encounter_count', 'amount', 'count']),
    doctor_ranking: topRows(data.doctors?.items || data.appointments?.breakdowns?.by_doctor || [], ['doctor_name', 'doctor_code'], ['encounter_count', 'appointment_count', 'count']),
    ...buildHealth(data),
    raw: data,
    generated_at: new Date(),
    filters: { ...query, date_from: isoDate(range.start), date_to: isoDate(range.end), timezone: query.timezone || DEFAULT_TIMEZONE },
    data_errors: [...data.data_errors, ...(comparison.data_errors || [])],
    backend_todo: [
      'POST /api/reports/exports: export Excel/PDF, history, processing, failed, scheduled exports.',
      'Persist KPI targets and thresholds per department/role.',
    ],
  };
}

async function getKpiToday(query = {}, actor = {}) {
  return getOverview({ ...query, date: query.date || isoDate(new Date()) }, actor);
}

async function getKpiPeriod(query = {}, actor = {}) {
  return getOverview({ ...query, period: query.period || 'week' }, actor);
}

async function getAnomalies(query = {}, actor = {}) {
  const overview = await getOverview(query, actor);
  return {
    summary_cards: overview.summary_cards.filter((card) => ['danger', 'warning'].includes(card.status)),
    anomaly_alerts: overview.anomaly_alerts,
    raw_alerts: {
      critical_open: overview.raw.critical_open,
      critical_overdue: overview.raw.critical_overdue,
      overdue_orders: overview.raw.alert_overdue_orders,
      no_show_cancellations: overview.raw.no_show_cancellations,
      failed_notifications: overview.raw.failed_notifications,
      audit_logs: overview.raw.audit_logs,
    },
    generated_at: overview.generated_at,
    filters: overview.filters,
    data_errors: overview.data_errors,
  };
}

async function getTrends(query = {}, actor = {}) {
  return getOverview({ ...query, period: query.period || '30d' }, actor);
}

async function getActionItems(query = {}, actor = {}) {
  const overview = await getOverview(query, actor);
  return {
    action_items: overview.action_items,
    groups: {
      now: overview.action_items.filter((item) => item.priority === 'now'),
      today: overview.action_items.filter((item) => item.priority === 'today'),
      watch: overview.action_items.filter((item) => item.priority === 'watch'),
      stable: overview.action_items.filter((item) => item.priority === 'stable'),
    },
    generated_at: overview.generated_at,
    filters: overview.filters,
    data_errors: overview.data_errors,
  };
}

module.exports = {
  getOverview,
  getKpiToday,
  getKpiPeriod,
  getComparison,
  getAnomalies,
  getTrends,
  getActionItems,
};
