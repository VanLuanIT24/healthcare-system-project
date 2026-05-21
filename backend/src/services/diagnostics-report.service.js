const clinicalOperationsOverviewService = require('./clinical-operations-overview.service');
const clinicalOrderCenterService = require('./clinical-order-center.service');
const laboratoryService = require('./laboratory.service');
const imagingService = require('./imaging.service');
const procedureService = require('./procedure.service');
const diagnosticAlertService = require('./diagnostic-alert.service');
const clinicalResultReviewService = require('./clinical-result-review.service');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const STATUS_PENDING = ['draft', 'preliminary', 'ordered', 'acknowledged', 'in_progress', 'scheduled', 'collected', 'received', 'in_testing', 'recollection_required'];
const OVERDUE_BUCKETS = [
  { key: '0-30', min: 0, max: 30, label: '0-30 phút' },
  { key: '30-60', min: 30, max: 60, label: '30-60 phút' },
  { key: '1-2h', min: 60, max: 120, label: '1-2 giờ' },
  { key: '2-4h', min: 120, max: 240, label: '2-4 giờ' },
  { key: '>4h', min: 240, max: Infinity, label: '>4 giờ' },
];

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function round(value) {
  return Number((number(value) + Number.EPSILON).toFixed(2));
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
  return addDays(date, -((date.getDay() + 6) % 7));
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

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildRange(query = {}) {
  const now = new Date();
  if (query.date_from || query.from || query.date_to || query.to) {
    return {
      start: startOfDay(query.date_from || query.from || now),
      end: endOfDay(query.date_to || query.to || query.date_from || query.from || now),
    };
  }
  const range = String(query.range || query.period || 'today').toLowerCase();
  if (range === 'today') return { start: startOfDay(query.date || now), end: endOfDay(query.date || now) };
  if (range === '7d') return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (range === '30d') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (range === 'month') return { start: startOfMonth(now), end: endOfDay(now) };
  if (range === 'quarter') return { start: startOfQuarter(now), end: endOfDay(now) };
  return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
}

function reportQuery(query = {}, range = buildRange(query)) {
  return {
    ...query,
    date_from: isoDate(range.start),
    date_to: isoDate(range.end),
    from: query.from || isoDate(range.start),
    to: query.to || isoDate(range.end),
    timezone: query.timezone || DEFAULT_TIMEZONE,
  };
}

function listQuery(query = {}, range = buildRange(query), overrides = {}) {
  return {
    ...reportQuery(query, range),
    page: query.page || 1,
    limit: Math.min(Number(query.limit || 50), 100),
    ...overrides,
  };
}

async function safe(key, fn) {
  try {
    return { key, ok: true, data: await fn() };
  } catch (error) {
    return {
      key,
      ok: false,
      data: null,
      error: {
        status: error.statusCode || error.status || 500,
        message: error.message || 'Không thể tải dữ liệu báo cáo cận lâm sàng.',
      },
    };
  }
}

function collect(results = []) {
  return results.reduce((acc, result) => {
    acc[result.key] = result.data;
    if (!result.ok) acc.data_errors.push({ key: result.key, ...result.error });
    return acc;
  }, { data_errors: [] });
}

function itemsOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

function countValue(source, keys = []) {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => acc?.[part], source);
    if (value !== undefined && value !== null) return number(value);
  }
  return 0;
}

function groupCount(rows = [], key, fallback = 'unknown') {
  const map = new Map();
  rows.forEach((row) => {
    const value = typeof key === 'function' ? key(row) : key.split('.').reduce((acc, part) => acc?.[part], row);
    const label = value || fallback;
    const current = map.get(label) || { key: label, label, count: 0, value: 0 };
    current.count += 1;
    current.value += 1;
    map.set(label, current);
  });
  return [...map.values()].sort((left, right) => right.count - left.count);
}

function dateDiffMinutes(start, end) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, round((endDate.getTime() - startDate.getTime()) / 60000));
}

function timestamp(row = {}, keys = []) {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => acc?.[part], row);
    if (value) return value;
  }
  return null;
}

function entityName(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.full_name || value.name || value.patient_code || value.department_name || value.doctor_name || value.code || value._id || null;
}

function orderCode(row = {}) {
  return row.order_no || row.order_code || row.lab_order_no || row.imaging_order_no || row.procedure_order_no || row.result_no || row.report_no || row.alert_code || row.code || row._id;
}

function enrichDiagnosticRow(row = {}, type = row.order_type || row.type || 'diagnostic') {
  const priority = row.priority || row.order_priority || row.urgency || 'routine';
  const status = row.status || row.result_status || row.report_status || row.order_status || 'unknown';
  const orderedAt = timestamp(row, ['ordered_at', 'created_at', 'requested_at', 'order_id.ordered_at']);
  const completedAt = timestamp(row, ['completed_at', 'finalized_at', 'released_at', 'updated_at']);
  const overdueMinutes = number(row.overdue_minutes ?? row.sla?.overdue_minutes ?? row.sla?.breached_minutes);
  return {
    ...row,
    diagnostic_type: type,
    type,
    code: orderCode(row),
    patient_name: entityName(row.patient_id || row.patient),
    doctor_name: entityName(row.doctor_id || row.ordered_by || row.requesting_doctor_id || row.responsible_doctor_id),
    department_name: entityName(row.department_id || row.department),
    priority,
    status,
    ordered_at: orderedAt || row.ordered_at,
    completed_at: completedAt || row.completed_at,
    total_tat_minutes: dateDiffMinutes(orderedAt, completedAt),
    overdue_minutes: overdueMinutes,
    sla_state: row.sla?.state || row.sla_state || (overdueMinutes > 0 ? 'breached' : 'normal'),
  };
}

function buildTatRows(rows = [], type) {
  return rows.map((row) => {
    const enriched = enrichDiagnosticRow(row, type);
    return {
      ...enriched,
      order_to_collect_minutes: dateDiffMinutes(
        timestamp(row, ['ordered_at', 'created_at']),
        timestamp(row, ['collected_at', 'collection_time']),
      ),
      collect_to_receive_minutes: dateDiffMinutes(
        timestamp(row, ['collected_at', 'collection_time']),
        timestamp(row, ['received_at', 'receive_time']),
      ),
      received_to_start_minutes: dateDiffMinutes(
        timestamp(row, ['received_at', 'arrived_at']),
        timestamp(row, ['started_at', 'in_progress_at', 'testing_started_at']),
      ),
      start_to_complete_minutes: dateDiffMinutes(
        timestamp(row, ['started_at', 'in_progress_at', 'testing_started_at']),
        timestamp(row, ['completed_at']),
      ),
      complete_to_final_minutes: dateDiffMinutes(
        timestamp(row, ['completed_at', 'result_created_at', 'report_created_at']),
        timestamp(row, ['finalized_at']),
      ),
      final_to_release_minutes: dateDiffMinutes(
        timestamp(row, ['finalized_at']),
        timestamp(row, ['released_at', 'released_to_patient_at', 'released_to_doctor_at']),
      ),
    };
  });
}

function average(values = []) {
  const valid = values.map(number).filter((value) => value > 0);
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

function percentile(values = [], p = 90) {
  const valid = values.map(number).filter((value) => value > 0).sort((a, b) => a - b);
  if (!valid.length) return 0;
  const index = Math.ceil((p / 100) * valid.length) - 1;
  return round(valid[Math.max(0, Math.min(index, valid.length - 1))]);
}

function summarizeTat(rows = []) {
  const totals = rows.map((row) => row.total_tat_minutes).filter((value) => value !== null && value !== undefined);
  return {
    average_minutes: average(totals),
    median_minutes: percentile(totals, 50),
    p90_minutes: percentile(totals, 90),
    p95_minutes: percentile(totals, 95),
    measured_count: totals.length,
    insufficient_data: !totals.length,
    by_priority: groupCount(rows, 'priority'),
    by_department: groupCount(rows, 'department_name'),
  };
}

function buildOverdueBuckets(rows = []) {
  const buckets = OVERDUE_BUCKETS.map((bucket) => ({ ...bucket, count: 0, value: 0, items: [] }));
  rows.forEach((row) => {
    const minutes = number(row.overdue_minutes);
    const bucket = buckets.find((item) => minutes >= item.min && minutes < item.max) || buckets[buckets.length - 1];
    bucket.count += 1;
    bucket.value += 1;
    bucket.items.push(row);
  });
  return buckets.map(({ min, max, items, ...bucket }) => ({
    ...bucket,
    max_overdue_minutes: Math.max(0, ...items.map((item) => number(item.overdue_minutes))),
  }));
}

function completionRate(rows = []) {
  if (!rows.length) return 0;
  return round((rows.filter((row) => ['completed', 'final', 'amended', 'released'].includes(String(row.status).toLowerCase())).length / rows.length) * 100);
}

function statusCount(rows = [], status) {
  return rows.filter((row) => String(row.status).toLowerCase() === status).length;
}

function statusIn(rows = [], statuses = []) {
  const set = new Set(statuses);
  return rows.filter((row) => set.has(String(row.status).toLowerCase())).length;
}

function rate(part, total) {
  return total ? round((number(part) / number(total)) * 100) : 0;
}

function kpi(key, label, value, unit = 'number', status = 'neutral', subtitle = '') {
  return { key, label, value: number(value), unit, status, subtitle };
}

function backendTodo() {
  return [
    'GET /api/reports/diagnostics/overview gom Lab + Imaging + Procedure + SLA + critical + overdue theo schema report-friendly.',
    'GET /api/reports/diagnostics/lab-turnaround-time tính TAT chuẩn theo ordered/collected/received/testing/result/final/release.',
    'GET /api/reports/diagnostics/imaging-turnaround-time tính TAT chuẩn theo ordered/scheduled/arrived/start/complete/report/final/release.',
    'GET /api/reports/diagnostics/report-pending gom lab result + imaging report + procedure result theo cùng schema.',
    'GET /api/reports/diagnostics/critical-results trả median ack, p90 ack, escalation, SLA compliance và owner assignment.',
    'GET /api/reports/diagnostics/overdue-orders trả unified overdue items, by stage, buckets, bottleneck_reason và recommended_action.',
  ];
}

async function loadBase(query = {}, actor = {}, options = {}) {
  const range = buildRange(query);
  const rq = reportQuery(query, range);
  const lq = listQuery(query, range);
  const limit = Math.min(Number(query.limit || options.limit || 60), 100);
  const results = await Promise.all([
    safe('clinical_dashboard', () => clinicalOperationsOverviewService.getDashboard(rq, actor)),
    safe('today_worklist', () => clinicalOperationsOverviewService.getTodayWorklist(rq, actor)),
    safe('stat_urgent', () => clinicalOperationsOverviewService.getStatUrgent(rq, actor)),
    safe('critical_results', () => clinicalOperationsOverviewService.getCriticalResults(rq, actor)),
    safe('pending_completion', () => clinicalOperationsOverviewService.getPendingCompletion(rq, actor)),
    safe('pending_approval', () => clinicalOperationsOverviewService.getPendingApproval(rq, actor)),
    safe('overdue_orders', () => clinicalOperationsOverviewService.getOverdueOrders(rq, actor)),
    safe('order_summary', () => clinicalOrderCenterService.getSummary(rq, actor)),
    safe('status_board', () => clinicalOrderCenterService.getStatusBoard(rq, actor)),
    safe('clinical_orders', () => clinicalOrderCenterService.getClinicalOrderCenter({ ...lq, limit }, actor)),
    safe('sla_board', () => clinicalOrderCenterService.getSlaBoard({ ...rq, limit: 300 }, actor)),
    safe('missing_files', () => clinicalOrderCenterService.getMissingFiles({ ...lq, limit }, actor)),
    safe('lab_summary', () => laboratoryService.getLabWorkspaceSummary(rq, actor)),
    safe('lab_overdue', () => laboratoryService.getLabWorkspaceOverdue({ ...lq, limit }, actor)),
    safe('lab_orders', () => laboratoryService.listLabOrders({ ...lq, limit, ...(query.status ? { status: query.status } : {}) }, actor)),
    safe('specimen_stats', () => laboratoryService.getSpecimenStats(rq, actor)),
    safe('specimens', () => laboratoryService.listSpecimens({ ...lq, limit }, actor)),
    safe('lab_results', () => laboratoryService.listLabResults({ ...lq, limit }, actor)),
    safe('imaging_dashboard', () => imagingService.getImagingDashboard(rq, actor)),
    safe('imaging_worklist', () => imagingService.getImagingWorklistCounts(rq, actor)),
    safe('imaging_sla', () => imagingService.getImagingSlaBoard(rq, actor)),
    safe('imaging_schedule', () => imagingService.getImagingScheduleBoard(rq, actor)),
    safe('imaging_orders', () => imagingService.listImagingOrders({ ...lq, limit }, actor)),
    safe('imaging_reports', () => imagingService.listImagingReports({ ...lq, limit }, actor)),
    safe('imaging_critical', () => imagingService.getCriticalImagingBoard(rq, actor)),
    safe('procedure_dashboard', () => procedureService.getProcedureDashboardSummary(rq, actor)),
    safe('procedure_worklist', () => procedureService.getProcedureWorklistCounts(rq, actor)),
    safe('procedure_calendar', () => procedureService.getProcedureCalendar(rq, actor)),
    safe('procedure_orders', () => procedureService.listProcedureOrders({ ...lq, limit }, actor)),
    safe('procedure_results', () => procedureService.listProcedureResults({ ...lq, limit }, actor)),
    safe('procedure_charges', () => procedureService.listProcedureWorkspaceCharges({ ...lq, limit }, actor)),
    safe('review_summary', () => clinicalResultReviewService.getReviewSummary(rq, actor)),
    safe('review_worklist', () => clinicalResultReviewService.getReviewWorklist({ ...lq, limit }, actor)),
    safe('alerts_summary', () => diagnosticAlertService.getDiagnosticAlertSummary(rq, actor)),
    safe('alerts_all', () => diagnosticAlertService.listDiagnosticAlerts({ ...lq, limit }, actor)),
    safe('alerts_critical_open', () => diagnosticAlertService.getCriticalOpenAlerts({ ...lq, limit }, actor)),
    safe('alerts_critical_overdue', () => diagnosticAlertService.getCriticalOverdueAlerts({ ...lq, limit }, actor)),
    safe('alerts_rejected_specimens', () => diagnosticAlertService.getRejectedSpecimenAlerts({ ...lq, limit }, actor)),
    safe('alerts_overdue_orders', () => diagnosticAlertService.getOverdueOrderAlerts({ ...lq, limit }, actor)),
    safe('alerts_missing_files', () => diagnosticAlertService.getMissingFileAlerts({ ...lq, limit }, actor)),
    safe('alerts_correction_needed', () => diagnosticAlertService.getCorrectionNeededAlerts({ ...lq, limit }, actor)),
  ]);
  return { ...collect(results), filters: rq, range };
}

function normalizeBase(base) {
  const labOrders = itemsOf(base.lab_orders).map((row) => enrichDiagnosticRow(row, 'lab'));
  const specimens = itemsOf(base.specimens).map((row) => enrichDiagnosticRow(row, 'specimen'));
  const labResults = itemsOf(base.lab_results).map((row) => enrichDiagnosticRow(row, 'lab_result'));
  const imagingOrders = itemsOf(base.imaging_orders).map((row) => enrichDiagnosticRow(row, 'imaging'));
  const imagingReports = itemsOf(base.imaging_reports).map((row) => enrichDiagnosticRow(row, 'imaging_report'));
  const procedureOrders = itemsOf(base.procedure_orders).map((row) => enrichDiagnosticRow(row, 'procedure'));
  const procedureResults = itemsOf(base.procedure_results).map((row) => enrichDiagnosticRow(row, 'procedure_result'));
  const clinicalOrders = itemsOf(base.clinical_orders).map((row) => enrichDiagnosticRow(row, row.order_type || 'clinical_order'));
  const alerts = itemsOf(base.alerts_all).map((row) => enrichDiagnosticRow(row, row.category || 'alert'));
  const criticalAlerts = [
    ...itemsOf(base.alerts_critical_open),
    ...itemsOf(base.alerts_critical_overdue),
    ...itemsOf(base.critical_results),
    ...itemsOf(base.imaging_critical),
  ].map((row) => enrichDiagnosticRow(row, row.type || row.category || 'critical'));
  const overdueItems = [
    ...itemsOf(base.overdue_orders),
    ...itemsOf(base.lab_overdue),
    ...itemsOf(base.alerts_overdue_orders),
    ...itemsOf(base.alerts_critical_overdue),
    ...itemsOf(base.sla_board),
    ...itemsOf(base.sla_board?.items),
  ].map((row) => enrichDiagnosticRow(row, row.order_type || row.type || 'overdue'));
  const pendingItems = [
    ...itemsOf(base.review_worklist),
    ...itemsOf(base.pending_completion),
    ...itemsOf(base.pending_approval),
    ...labResults.filter((row) => STATUS_PENDING.includes(String(row.status).toLowerCase())),
    ...imagingReports.filter((row) => STATUS_PENDING.includes(String(row.status).toLowerCase())),
    ...procedureResults.filter((row) => STATUS_PENDING.includes(String(row.status).toLowerCase())),
  ].map((row) => enrichDiagnosticRow(row, row.type || row.result_type || 'pending'));

  return {
    labOrders,
    specimens,
    labResults,
    imagingOrders,
    imagingReports,
    procedureOrders,
    procedureResults,
    clinicalOrders,
    alerts,
    criticalAlerts,
    overdueItems,
    pendingItems,
    allOrders: [...clinicalOrders, ...labOrders, ...imagingOrders, ...procedureOrders],
    allResults: [...labResults, ...imagingReports, ...procedureResults],
  };
}

function buildHealth(base, data) {
  const totalOrders = data.allOrders.length;
  const completed = data.allOrders.filter((row) => String(row.status).toLowerCase() === 'completed').length;
  const slaBuckets = base.sla_board?.buckets || {};
  const breached = number(slaBuckets.breached) + data.overdueItems.length;
  const critical = data.criticalAlerts.length;
  return [
    { key: 'lab', label: 'Lab health', score: completionRate(data.labOrders), status: completionRate(data.labOrders) >= 80 ? 'good' : 'warning' },
    { key: 'imaging', label: 'Imaging health', score: completionRate(data.imagingOrders), status: completionRate(data.imagingOrders) >= 80 ? 'good' : 'warning' },
    { key: 'procedure', label: 'Procedure health', score: completionRate(data.procedureOrders), status: completionRate(data.procedureOrders) >= 80 ? 'good' : 'warning' },
    { key: 'sla', label: 'SLA health', score: totalOrders ? Math.max(0, round(((completed - breached) / totalOrders) * 100)) : 100, status: breached ? 'danger' : critical ? 'warning' : 'good' },
  ];
}

function buildCharts(base, data) {
  return {
    order_type: [
      { key: 'lab', label: 'Lab', count: data.labOrders.length, value: data.labOrders.length },
      { key: 'imaging', label: 'Imaging', count: data.imagingOrders.length, value: data.imagingOrders.length },
      { key: 'procedure', label: 'Procedure', count: data.procedureOrders.length, value: data.procedureOrders.length },
    ],
    priority: groupCount(data.allOrders, 'priority'),
    status: groupCount(data.allOrders, 'status'),
    lab_status: groupCount(data.labOrders, 'status'),
    specimen_status: groupCount(data.specimens, 'status'),
    imaging_status: groupCount(data.imagingOrders, 'status'),
    procedure_status: groupCount(data.procedureOrders, 'status'),
    modality: groupCount(data.imagingOrders, (row) => row.modality || row.study_modality || row.modality_code),
    overdue_buckets: buildOverdueBuckets(data.overdueItems),
    sla_board: [
      { key: 'normal', label: 'Normal', count: number(base.sla_board?.buckets?.normal), value: number(base.sla_board?.buckets?.normal) },
      { key: 'warning', label: 'Warning', count: number(base.sla_board?.buckets?.warning), value: number(base.sla_board?.buckets?.warning) },
      { key: 'breached', label: 'Breached', count: number(base.sla_board?.buckets?.breached), value: number(base.sla_board?.buckets?.breached) },
      { key: 'completed', label: 'Completed', count: number(base.sla_board?.buckets?.completed), value: number(base.sla_board?.buckets?.completed) },
    ],
  };
}

function buildInsights(data) {
  const critical = data.criticalAlerts.length;
  const overdue = data.overdueItems.length;
  const missing = data.alerts.filter((row) => String(row.category || '').includes('missing')).length;
  const rejected = data.specimens.filter((row) => String(row.status).toLowerCase() === 'rejected').length;
  return [
    critical ? { title: 'Critical result cần xử lý', body: `${critical} cảnh báo/kết quả critical đang mở hoặc quá hạn.`, tone: 'danger' } : { title: 'Critical ổn định', body: 'Chưa ghi nhận critical result đang mở trong dữ liệu tải được.', tone: 'good' },
    overdue ? { title: 'Order quá SLA', body: `${overdue} order/alert đang quá hạn hoặc nằm trong SLA breach board.`, tone: 'danger' } : { title: 'SLA chưa phát sinh overdue', body: 'Không có order quá hạn trong tập dữ liệu hiện tại.', tone: 'good' },
    rejected ? { title: 'Mẫu bị từ chối', body: `${rejected} specimen bị từ chối, cần rà collection/custody.`, tone: 'warning' } : { title: 'Specimen ổn định', body: 'Chưa thấy specimen rejected trong trang hiện tại.', tone: 'good' },
    missing ? { title: 'Thiếu file/report', body: `${missing} cảnh báo thiếu file hoặc cần correction.`, tone: 'warning' } : { title: 'File/report đủ dữ liệu', body: 'Không có cảnh báo thiếu file trong dữ liệu tải được.', tone: 'neutral' },
  ];
}

function baseResponse(type, base, data, extra = {}) {
  return {
    type,
    generated_at: new Date().toISOString(),
    filters: base.filters,
    data_errors: base.data_errors,
    backend_todo: backendTodo(),
    raw: {
      clinical_dashboard: base.clinical_dashboard,
      order_summary: base.order_summary,
      status_board: base.status_board,
      lab_summary: base.lab_summary,
      imaging_dashboard: base.imaging_dashboard,
      procedure_dashboard: base.procedure_dashboard,
      alerts_summary: base.alerts_summary,
      review_summary: base.review_summary,
    },
    diagnostics_health: buildHealth(base, data),
    charts: buildCharts(base, data),
    insights: buildInsights(data),
    lists: {
      clinical_orders: data.clinicalOrders,
      lab_orders: data.labOrders,
      specimens: data.specimens,
      lab_results: data.labResults,
      imaging_orders: data.imagingOrders,
      imaging_reports: data.imagingReports,
      procedure_orders: data.procedureOrders,
      procedure_results: data.procedureResults,
      pending_reports: data.pendingItems,
      critical_results: data.criticalAlerts,
      overdue_orders: data.overdueItems,
      alerts: data.alerts,
    },
    ...extra,
  };
}

async function getOverview(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 60 });
  const data = normalizeBase(base);
  const urgent = data.allOrders.filter((row) => ['urgent', 'stat'].includes(String(row.priority).toLowerCase())).length;
  return baseResponse('overview', base, data, {
    summary_cards: [
      kpi('total_orders', 'Tổng order cận lâm sàng', data.allOrders.length),
      kpi('lab_orders', 'Lab orders', data.labOrders.length),
      kpi('imaging_orders', 'Imaging orders', data.imagingOrders.length),
      kpi('procedure_orders', 'Procedure orders', data.procedureOrders.length),
      kpi('stat_urgent', 'STAT / urgent', countValue(base.stat_urgent, ['summary.total', 'total']) || urgent, 'number', urgent ? 'warning' : 'good'),
      kpi('in_progress', 'Đang thực hiện', statusIn(data.allOrders, ['in_progress', 'in_testing']), 'number', 'neutral'),
      kpi('completed', 'Hoàn tất', statusCount(data.allOrders, 'completed'), 'number', 'good'),
      kpi('pending_reports', 'Report pending', data.pendingItems.length, 'number', data.pendingItems.length ? 'warning' : 'good'),
      kpi('critical', 'Critical unacknowledged', data.criticalAlerts.length, 'number', data.criticalAlerts.length ? 'danger' : 'good'),
      kpi('overdue', 'Overdue orders', data.overdueItems.length, 'number', data.overdueItems.length ? 'danger' : 'good'),
      kpi('sla_breached', 'SLA breached', base.sla_board?.buckets?.breached || 0, 'number', base.sla_board?.buckets?.breached ? 'danger' : 'good'),
      kpi('rejected_specimens', 'Rejected specimens', statusCount(data.specimens, 'rejected'), 'number', statusCount(data.specimens, 'rejected') ? 'warning' : 'good'),
    ],
  });
}

async function getLabOrders(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 80 });
  const data = normalizeBase(base);
  const total = data.labOrders.length;
  const rejected = statusCount(data.labOrders, 'rejected') + statusCount(data.specimens, 'rejected');
  const recollect = statusCount(data.labOrders, 'recollection_required');
  return baseResponse('lab-orders', base, data, {
    summary_cards: [
      kpi('total_lab_orders', 'Tổng lab orders', total),
      kpi('ordered', 'Ordered', statusCount(data.labOrders, 'ordered')),
      kpi('collected', 'Collected', statusCount(data.labOrders, 'collected')),
      kpi('received', 'Received', statusCount(data.labOrders, 'received')),
      kpi('in_progress', 'In progress', statusCount(data.labOrders, 'in_progress')),
      kpi('recollection', 'Cần lấy lại mẫu', recollect, 'number', recollect ? 'warning' : 'good'),
      kpi('completed', 'Completed', statusCount(data.labOrders, 'completed'), 'number', 'good'),
      kpi('rejected', 'Rejected', rejected, 'number', rejected ? 'danger' : 'good'),
      kpi('overdue_lab', 'Overdue lab', itemsOf(base.lab_overdue).length, 'number', itemsOf(base.lab_overdue).length ? 'danger' : 'good'),
      kpi('completion_rate', 'Completion rate', completionRate(data.labOrders), 'percent', completionRate(data.labOrders) >= 80 ? 'good' : 'warning'),
      kpi('recollection_rate', 'Recollection rate', rate(recollect, total), 'percent', recollect ? 'warning' : 'good'),
      kpi('rejection_rate', 'Rejection rate', rate(rejected, total + data.specimens.length), 'percent', rejected ? 'warning' : 'good'),
    ],
    items: data.labOrders,
  });
}

async function getLabTurnaroundTime(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 100 });
  const data = normalizeBase(base);
  const tatRows = buildTatRows([...data.labOrders, ...data.labResults, ...data.specimens], 'lab');
  const tat = summarizeTat(tatRows);
  return baseResponse('lab-turnaround-time', base, data, {
    summary_cards: [
      kpi('avg_total_tat', 'Avg total lab TAT', tat.average_minutes, 'minutes', tat.insufficient_data ? 'warning' : 'good', tat.insufficient_data ? 'Chưa đủ timestamp TAT' : ''),
      kpi('median_tat', 'Median lab TAT', tat.median_minutes, 'minutes'),
      kpi('p90_tat', 'P90 lab TAT', tat.p90_minutes, 'minutes'),
      kpi('sla_compliance', 'SLA compliance', Math.max(0, 100 - rate(base.sla_board?.buckets?.breached, data.labOrders.length || 1)), 'percent', base.sla_board?.buckets?.breached ? 'warning' : 'good'),
      kpi('sla_breached', 'SLA breached count', base.sla_board?.buckets?.breached || 0, 'number', base.sla_board?.buckets?.breached ? 'danger' : 'good'),
      kpi('measured', 'Có đủ mốc đo', tat.measured_count),
    ],
    tat,
    items: tatRows,
  });
}

async function getSpecimens(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 100 });
  const data = normalizeBase(base);
  const rejected = statusCount(data.specimens, 'rejected');
  return baseResponse('specimens', base, data, {
    summary_cards: [
      kpi('total_specimens', 'Tổng specimen', data.specimens.length),
      kpi('planned', 'Planned', statusCount(data.specimens, 'planned')),
      kpi('collected', 'Collected', statusCount(data.specimens, 'collected')),
      kpi('received', 'Received', statusCount(data.specimens, 'received')),
      kpi('rejected', 'Rejected', rejected, 'number', rejected ? 'danger' : 'good'),
      kpi('in_testing', 'In testing', statusCount(data.specimens, 'in_testing')),
      kpi('stored', 'Stored', statusCount(data.specimens, 'stored')),
      kpi('disposed', 'Disposed', statusCount(data.specimens, 'disposed')),
      kpi('rejection_rate', 'Rejection rate', rate(rejected, data.specimens.length), 'percent', rejected ? 'warning' : 'good'),
      kpi('rejected_alerts', 'Rejected specimen alerts', itemsOf(base.alerts_rejected_specimens).length, 'number', itemsOf(base.alerts_rejected_specimens).length ? 'warning' : 'good'),
    ],
    specimen_stats: base.specimen_stats,
    items: data.specimens,
  });
}

async function getImagingOrders(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 100 });
  const data = normalizeBase(base);
  const noShow = statusCount(data.imagingOrders, 'no_show');
  return baseResponse('imaging-orders', base, data, {
    summary_cards: [
      kpi('total_imaging_orders', 'Tổng imaging orders', data.imagingOrders.length),
      kpi('ordered', 'Ordered', statusCount(data.imagingOrders, 'ordered')),
      kpi('scheduled', 'Scheduled', statusCount(data.imagingOrders, 'scheduled')),
      kpi('in_progress', 'In progress', statusCount(data.imagingOrders, 'in_progress')),
      kpi('completed', 'Completed', statusCount(data.imagingOrders, 'completed'), 'number', 'good'),
      kpi('cancelled', 'Cancelled', statusCount(data.imagingOrders, 'cancelled')),
      kpi('no_show', 'No-show', noShow, 'number', noShow ? 'warning' : 'good'),
      kpi('sla_breached', 'SLA breached', base.imaging_sla?.buckets?.breached || base.sla_board?.buckets?.breached || 0, 'number', (base.imaging_sla?.buckets?.breached || base.sla_board?.buckets?.breached) ? 'danger' : 'good'),
      kpi('completion_rate', 'Completion rate', completionRate(data.imagingOrders), 'percent', completionRate(data.imagingOrders) >= 80 ? 'good' : 'warning'),
      kpi('no_show_rate', 'No-show rate', rate(noShow, data.imagingOrders.length), 'percent', noShow ? 'warning' : 'good'),
    ],
    items: data.imagingOrders,
  });
}

async function getImagingTurnaroundTime(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 100 });
  const data = normalizeBase(base);
  const tatRows = buildTatRows([...data.imagingOrders, ...data.imagingReports], 'imaging');
  const tat = summarizeTat(tatRows);
  return baseResponse('imaging-turnaround-time', base, data, {
    summary_cards: [
      kpi('avg_total_tat', 'Avg total imaging TAT', tat.average_minutes, 'minutes', tat.insufficient_data ? 'warning' : 'good', tat.insufficient_data ? 'Chưa đủ timestamp TAT' : ''),
      kpi('median_tat', 'Median imaging TAT', tat.median_minutes, 'minutes'),
      kpi('p90_tat', 'P90 imaging TAT', tat.p90_minutes, 'minutes'),
      kpi('sla_compliance', 'SLA compliance', Math.max(0, 100 - rate(base.imaging_sla?.buckets?.breached || base.sla_board?.buckets?.breached, data.imagingOrders.length || 1)), 'percent'),
      kpi('sla_breached', 'SLA breached count', base.imaging_sla?.buckets?.breached || base.sla_board?.buckets?.breached || 0, 'number', (base.imaging_sla?.buckets?.breached || base.sla_board?.buckets?.breached) ? 'danger' : 'good'),
      kpi('critical_ack_median', 'Critical ack median', 0, 'minutes', 'neutral', 'TODO backend critical ack analytics'),
    ],
    tat,
    items: tatRows,
  });
}

async function getReportPending(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 100 });
  const data = normalizeBase(base);
  const labPending = data.pendingItems.filter((row) => String(row.type).includes('lab')).length;
  const imagingPending = data.pendingItems.filter((row) => String(row.type).includes('imaging')).length;
  const procedurePending = data.pendingItems.filter((row) => String(row.type).includes('procedure')).length;
  return baseResponse('report-pending', base, data, {
    summary_cards: [
      kpi('total_pending', 'Tổng report pending', data.pendingItems.length, 'number', data.pendingItems.length ? 'warning' : 'good'),
      kpi('lab_pending', 'Lab pending', labPending),
      kpi('imaging_pending', 'Imaging pending', imagingPending),
      kpi('procedure_pending', 'Procedure pending', procedurePending),
      kpi('draft', 'Draft', statusCount(data.pendingItems, 'draft')),
      kpi('preliminary', 'Preliminary', statusCount(data.pendingItems, 'preliminary')),
      kpi('pending_approval', 'Pending approval', itemsOf(base.pending_approval).length, 'number', itemsOf(base.pending_approval).length ? 'warning' : 'good'),
      kpi('correction_needed', 'Correction needed', itemsOf(base.alerts_correction_needed).length, 'number', itemsOf(base.alerts_correction_needed).length ? 'warning' : 'good'),
      kpi('missing_files', 'Missing files', itemsOf(base.alerts_missing_files).length + itemsOf(base.missing_files).length, 'number', itemsOf(base.alerts_missing_files).length ? 'warning' : 'good'),
    ],
    items: data.pendingItems,
  });
}

async function getCriticalResults(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 100 });
  const data = normalizeBase(base);
  const overdue = itemsOf(base.alerts_critical_overdue).length;
  return baseResponse('critical-results', base, data, {
    summary_cards: [
      kpi('critical_open', 'Tổng critical open', data.criticalAlerts.length, 'number', data.criticalAlerts.length ? 'danger' : 'good'),
      kpi('critical_lab', 'Critical lab', data.criticalAlerts.filter((row) => String(row.type).includes('lab')).length),
      kpi('critical_imaging', 'Critical imaging', data.criticalAlerts.filter((row) => String(row.type).includes('imaging')).length),
      kpi('unacknowledged', 'Unacknowledged', data.criticalAlerts.filter((row) => !row.acknowledged_at).length, 'number', data.criticalAlerts.some((row) => !row.acknowledged_at) ? 'danger' : 'good'),
      kpi('overdue_critical', 'Overdue critical', overdue, 'number', overdue ? 'danger' : 'good'),
      kpi('escalated', 'Escalated', data.criticalAlerts.filter((row) => number(row.escalation_level) > 0 || row.escalated_at).length, 'number', 'warning'),
      kpi('median_ack_minutes', 'Median acknowledge', 0, 'minutes', 'neutral', 'TODO backend median acknowledge'),
      kpi('sla_compliance', 'Critical SLA compliance', overdue ? 0 : 100, 'percent', overdue ? 'danger' : 'good'),
    ],
    items: data.criticalAlerts,
  });
}

async function getProcedureOrders(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 100 });
  const data = normalizeBase(base);
  const noShow = statusCount(data.procedureOrders, 'no_show');
  return baseResponse('procedure-orders', base, data, {
    summary_cards: [
      kpi('total_procedure_orders', 'Tổng procedure orders', data.procedureOrders.length),
      kpi('ordered', 'Ordered', statusCount(data.procedureOrders, 'ordered')),
      kpi('scheduled', 'Scheduled', statusCount(data.procedureOrders, 'scheduled')),
      kpi('in_progress', 'In progress', statusCount(data.procedureOrders, 'in_progress')),
      kpi('completed', 'Completed', statusCount(data.procedureOrders, 'completed'), 'number', 'good'),
      kpi('cancelled', 'Cancelled', statusCount(data.procedureOrders, 'cancelled')),
      kpi('no_show', 'No-show', noShow, 'number', noShow ? 'warning' : 'good'),
      kpi('result_pending', 'Result pending', data.procedureResults.filter((row) => STATUS_PENDING.includes(String(row.status).toLowerCase())).length),
      kpi('missing_charge', 'Missing charge', Math.max(0, data.procedureOrders.length - itemsOf(base.procedure_charges).length), 'number', 'warning'),
      kpi('completion_rate', 'Completion rate', completionRate(data.procedureOrders), 'percent', completionRate(data.procedureOrders) >= 80 ? 'good' : 'warning'),
      kpi('no_show_rate', 'No-show rate', rate(noShow, data.procedureOrders.length), 'percent', noShow ? 'warning' : 'good'),
    ],
    items: data.procedureOrders,
  });
}

async function getOverdueOrders(query = {}, actor = {}) {
  const base = await loadBase(query, actor, { limit: 100 });
  const data = normalizeBase(base);
  const overdue = data.overdueItems;
  const avg = average(overdue.map((row) => row.overdue_minutes));
  const max = Math.max(0, ...overdue.map((row) => number(row.overdue_minutes)));
  return baseResponse('overdue-orders', base, data, {
    summary_cards: [
      kpi('total_overdue', 'Tổng order quá hạn', overdue.length, 'number', overdue.length ? 'danger' : 'good'),
      kpi('lab_overdue', 'Lab overdue', overdue.filter((row) => String(row.type).includes('lab')).length),
      kpi('imaging_overdue', 'Imaging overdue', overdue.filter((row) => String(row.type).includes('imaging')).length),
      kpi('procedure_overdue', 'Procedure overdue', overdue.filter((row) => String(row.type).includes('procedure')).length),
      kpi('stat_overdue', 'STAT overdue', overdue.filter((row) => String(row.priority).toLowerCase() === 'stat').length, 'number', 'danger'),
      kpi('urgent_overdue', 'Urgent overdue', overdue.filter((row) => String(row.priority).toLowerCase() === 'urgent').length, 'number', 'warning'),
      kpi('critical_overdue', 'Critical overdue', itemsOf(base.alerts_critical_overdue).length, 'number', itemsOf(base.alerts_critical_overdue).length ? 'danger' : 'good'),
      kpi('avg_overdue', 'Avg overdue minutes', avg, 'minutes', avg > 60 ? 'danger' : avg > 0 ? 'warning' : 'good'),
      kpi('max_overdue', 'Max overdue minutes', max, 'minutes', max > 120 ? 'danger' : max > 0 ? 'warning' : 'good'),
    ],
    overdue_buckets: buildOverdueBuckets(overdue),
    items: overdue,
  });
}

module.exports = {
  getOverview,
  getLabOrders,
  getLabTurnaroundTime,
  getSpecimens,
  getImagingOrders,
  getImagingTurnaroundTime,
  getReportPending,
  getCriticalResults,
  getProcedureOrders,
  getOverdueOrders,
};
