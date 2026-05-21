const { AuditLog, User, DocumentExportRequest } = require('../models');
const auditQueryService = require('./audit-query.service');
const reportService = require('./report.service');
const pharmacyReportService = require('./pharmacy-report.service');
const permissionService = require('./permission.service');
const { PERMISSION } = require('../constants/permissions');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const CORE_REPORT_TYPES = [
  { key: 'appointments', label: 'Lịch hẹn', requires_date_range: false },
  { key: 'queue', label: 'Queue', requires_date_range: false },
  { key: 'encounters', label: 'Encounter', requires_date_range: false },
  { key: 'revenue', label: 'Doanh thu', requires_date_range: true },
  { key: 'inventory', label: 'Tồn kho', requires_date_range: false },
  { key: 'departments', label: 'Khoa phòng', requires_date_range: false },
  { key: 'doctors', label: 'Bác sĩ', requires_date_range: false },
];

const PHARMACY_REPORT_TYPES = [
  { key: 'dashboard', label: 'Dashboard kho dược' },
  { key: 'inventory_overview', label: 'Tổng quan tồn kho' },
  { key: 'inventory_movement', label: 'Nhập xuất tồn' },
  { key: 'stock_card', label: 'Thẻ kho' },
  { key: 'dispensing', label: 'Cấp phát thuốc' },
  { key: 'expiring_stock', label: 'Lô sắp hết hạn' },
  { key: 'low_stock', label: 'Low stock' },
  { key: 'reorder_suggestions', label: 'Gợi ý nhập hàng' },
  { key: 'inventory_valuation', label: 'Giá trị tồn kho' },
  { key: 'high_usage_medications', label: 'Thuốc dùng nhiều' },
  { key: 'waste_disposal', label: 'Hủy / hao hụt thuốc' },
  { key: 'loss_waste', label: 'Loss / waste' },
];

const EXPORT_ACTIONS = [
  'reports.export',
  'pharmacy_reports.export',
  'audit_log.export',
  'medical_records.export',
  'record.export_zip',
  'records.export',
  'documents.export',
];

const REPORT_GROUP_LABELS = {
  core: 'Báo cáo hệ thống',
  pharmacy: 'Nhà thuốc & kho dược',
  audit: 'Nhật ký kiểm toán',
  records: 'Hồ sơ & tài liệu',
  custom: 'Báo cáo tùy chỉnh',
  finance: 'Tài chính / viện phí',
  diagnostics: 'Cận lâm sàng',
  inpatient_emergency: 'Nội trú & cấp cứu',
  quality_risk: 'Chất lượng / rủi ro',
};

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions.filter(Boolean));
}

function assertReportAccess(actor = {}) {
  if ((actor.actorType || actor.actor_type) !== 'staff') {
    throw createError('Chỉ tài khoản nhân sự được xem trung tâm xuất báo cáo.', 403);
  }
  if (!hasAnyPermission(actor, [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.EXPORT,
    PERMISSION.AUDIT_LOGS.READ,
    PERMISSION.AUDIT_LOGS.EXPORT,
    PERMISSION.PHARMACY_REPORTS?.EXPORT,
  ])) {
    throw createError('Bạn không có quyền xuất hoặc xem lịch sử xuất báo cáo.', 403);
  }
}

function assertExportAccess(actor = {}) {
  assertReportAccess(actor);
  if (!hasAnyPermission(actor, [
    PERMISSION.REPORTS.EXPORT,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.AUDIT_LOGS.EXPORT,
    PERMISSION.PHARMACY_REPORTS?.EXPORT,
  ])) {
    throw createError('Bạn không có quyền xuất hoặc xem lịch sử xuất báo cáo.', 403);
  }
}

function todayRange() {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  return { from, to: now };
}

function buildDateFilter(query = {}) {
  const range = {};
  if (query.date_from || query.from) {
    const from = new Date(query.date_from || query.from);
    if (!Number.isNaN(from.getTime())) range.$gte = from;
  }
  if (query.date_to || query.to) {
    const to = new Date(query.date_to || query.to);
    if (!Number.isNaN(to.getTime())) range.$lte = to;
  }
  return Object.keys(range).length ? { created_at: range } : {};
}

function inferGroup(action, metadata = {}) {
  const reportType = normalizeString(metadata.report_type || metadata.type).toLowerCase();
  if (action === 'pharmacy_reports.export' || reportType.startsWith('pharmacy')) return 'pharmacy';
  if (action === 'audit_log.export') return 'audit';
  if (action === 'medical_records.export' || action === 'record.export_zip' || action === 'records.export' || action === 'documents.export') return 'records';
  return 'core';
}

function normalizeExportHistoryItem(log = {}, userMap = new Map()) {
  const metadata = log.metadata || {};
  const group = inferGroup(log.action, metadata);
  const actor = userMap.get(String(log.actor_id));
  const format = normalizeString(metadata.format || metadata.content_type || 'json').toLowerCase();
  const exportedAt = log.created_at || log.updated_at;
  return {
    export_id: String(log._id),
    source: 'audit',
    report_group: group,
    report_group_label: REPORT_GROUP_LABELS[group] || group,
    report_type: metadata.report_type || metadata.type || metadata.export_type || group,
    format,
    status: log.status || 'success',
    severity: log.severity || 'info',
    exported_by: actor?.full_name || actor?.username || actor?.employee_code || String(log.actor_id || ''),
    exported_by_id: log.actor_id || null,
    exported_at: exportedAt,
    created_at: exportedAt,
    filters: metadata.filters || metadata.query || {},
    row_count: metadata.exported_count || metadata.row_count || null,
    content_type: format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : null,
    filename: metadata.filename || null,
    expires_at: metadata.expires_at || null,
    download_available: false,
    action: log.action,
    message: log.message,
    request_id: log.request_id,
    audit_log_id: String(log._id),
    metadata,
  };
}

function buildExportHistoryFilter(query = {}) {
  const filter = {
    action: { $in: EXPORT_ACTIONS },
    ...buildDateFilter(query),
  };
  if (query.status) filter.status = normalizeString(query.status).toLowerCase();
  if (query.format) filter['metadata.format'] = normalizeString(query.format).toLowerCase();
  if (query.report_type) filter['metadata.report_type'] = normalizeString(query.report_type).toLowerCase();
  if (query.requested_by || query.actor_id) filter.actor_id = query.requested_by || query.actor_id;

  const search = normalizeString(query.search || query.q);
  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { action: { $regex: pattern, $options: 'i' } },
      { message: { $regex: pattern, $options: 'i' } },
      { 'metadata.report_type': { $regex: pattern, $options: 'i' } },
      { 'metadata.format': { $regex: pattern, $options: 'i' } },
    ];
  }
  return filter;
}

async function hydrateActors(items = []) {
  const actorIds = items.map((item) => item.actor_id).filter(Boolean);
  if (!actorIds.length) return new Map();
  const users = await User.find({ _id: { $in: actorIds } }).select('full_name username employee_code').lean();
  return new Map(users.map((user) => [String(user._id), user]));
}

async function getExportHistory(query = {}, actor = {}) {
  assertReportAccess(actor);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = buildExportHistoryFilter(query);
  const group = normalizeString(query.report_group).toLowerCase();
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const userMap = await hydrateActors(logs);
  let items = logs.map((log) => normalizeExportHistoryItem(log, userMap));
  if (group) items = items.filter((item) => item.report_group === group);

  const today = todayRange();
  const [todayCount, csvCount, jsonCount] = await Promise.all([
    AuditLog.countDocuments({ action: { $in: EXPORT_ACTIONS }, created_at: { $gte: today.from, $lte: today.to } }),
    AuditLog.countDocuments({ action: { $in: EXPORT_ACTIONS }, 'metadata.format': 'csv' }),
    AuditLog.countDocuments({ action: { $in: EXPORT_ACTIONS }, 'metadata.format': 'json' }),
  ]);

  return {
    generated_at: new Date().toISOString(),
    source: 'audit_log_fallback',
    summary: {
      total_exports: total,
      exports_today: todayCount,
      csv_exports: csvCount,
      json_exports: jsonCount,
      pharmacy_exports: items.filter((item) => item.report_group === 'pharmacy').length,
      core_report_exports: items.filter((item) => item.report_group === 'core').length,
      audit_exports: items.filter((item) => item.report_group === 'audit').length,
      records_exports: items.filter((item) => item.report_group === 'records').length,
      failed_exports: items.filter((item) => item.status === 'failure' || item.status === 'failed').length,
    },
    items,
    pagination: buildPagination(page, limit, total),
    backend_todo: [
      'GET /api/reports/exports: export history thống nhất thay vì fallback từ audit logs.',
      'report_export_jobs: lưu status, file_url, progress, retry_count và error_message.',
    ],
  };
}

function exportCatalog() {
  return {
    groups: [
      {
        key: 'core',
        label: REPORT_GROUP_LABELS.core,
        endpoint: '/api/reports/export',
        method: 'GET',
        supported_formats: ['csv', 'json'],
        report_types: CORE_REPORT_TYPES,
      },
      {
        key: 'pharmacy',
        label: REPORT_GROUP_LABELS.pharmacy,
        endpoint: '/api/reports/pharmacy/export',
        method: 'POST',
        supported_formats: ['csv', 'json'],
        report_types: PHARMACY_REPORT_TYPES,
      },
      {
        key: 'audit',
        label: REPORT_GROUP_LABELS.audit,
        endpoint: '/api/audit-logs/export',
        method: 'GET',
        supported_formats: ['csv', 'json'],
        report_types: [{ key: 'audit_logs', label: 'Audit logs' }],
      },
    ],
    unsupported_formats: [
      { format: 'excel', reason: 'Backend chưa có Excel generator và export job async.' },
      { format: 'pdf', reason: 'Backend chưa có PDF renderer cho report center.' },
    ],
  };
}

async function getCsvCenter(query = {}, actor = {}) {
  assertReportAccess(actor);
  const history = await getExportHistory({ ...query, format: 'csv', limit: query.limit || 10 }, actor);
  return {
    generated_at: new Date().toISOString(),
    format: 'csv',
    summary: {
      core_reports_supported: CORE_REPORT_TYPES.length,
      pharmacy_reports_supported: PHARMACY_REPORT_TYPES.length,
      audit_export_supported: 1,
      csv_exports_today: history.summary.exports_today,
      failed_csv_exports: history.summary.failed_exports,
      recent_exports: history.items.length,
    },
    catalog: exportCatalog(),
    validation_rules: [
      'Revenue report bắt buộc date_from và date_to.',
      'Core export chỉ hỗ trợ csv/json qua GET /api/reports/export.',
      'Pharmacy export dùng POST /api/reports/pharmacy/export.',
      'Audit export dùng GET /api/audit-logs/export.',
    ],
    recent_exports: history.items,
    backend_todo: ['POST /api/reports/exports để tạo export job async khi dữ liệu lớn.'],
  };
}

function unsupportedFormatCenter(format) {
  const isExcel = format === 'excel';
  return {
    generated_at: new Date().toISOString(),
    format,
    enabled: false,
    summary: {
      supported_now: 0,
      backend_required: 1,
      async_job_required: 1,
      download_center_required: 1,
    },
    status_card: {
      title: isExcel
        ? 'Backend hiện chưa hỗ trợ export Excel cho report center.'
        : 'Backend hiện chưa hỗ trợ export PDF cho báo cáo tổng hợp.',
      supported_endpoints: [
        '/api/reports/export: json/csv',
        '/api/reports/pharmacy/export: json/csv',
        '/api/audit-logs/export: json/csv',
      ],
    },
    design_options: isExcel
      ? ['include_summary_sheet', 'include_raw_data_sheet', 'include_chart_sheet', 'include_filters_sheet', 'freeze_header', 'auto_column_width', 'currency_vnd_format', 'date_format']
      : ['executive_summary_template', 'table_report_template', 'chart_report_template', 'logo', 'signature', 'watermark', 'include_charts', 'include_filters', 'appendix', 'portrait_or_landscape'],
    suggested_endpoint: {
      method: 'POST',
      path: '/api/reports/exports',
      body: {
        report_group: 'core',
        report_type: 'revenue',
        format,
        filters: { date_from: '2026-05-01', date_to: '2026-05-21' },
        options: isExcel
          ? { include_summary_sheet: true, include_raw_data_sheet: true, include_charts: true, freeze_header: true, auto_column_width: true }
          : { template: 'executive_summary', orientation: 'landscape', include_charts: true, include_filters: true },
      },
    },
    backend_todo: [
      'Thêm model report_export_jobs.',
      isExcel ? 'Tích hợp Excel generator như exceljs.' : 'Tích hợp PDF renderer như puppeteer hoặc pdfkit.',
      'Lưu file_url, file_size, expires_at và trạng thái ready/failed.',
    ],
  };
}

async function getProcessingExports(query = {}, actor = {}) {
  assertReportAccess(actor);
  const portalProcessingCount = await DocumentExportRequest.countDocuments({ status: { $in: ['pending', 'processing'] } });
  return {
    generated_at: new Date().toISOString(),
    summary: {
      pending_exports: 0,
      processing_exports: 0,
      portal_document_exports_processing: portalProcessingCount,
      average_progress: 0,
      long_running_exports: 0,
    },
    items: [],
    empty_state: {
      title: 'Backend hiện chưa có report export job queue cho staff/admin.',
      description: 'Các export core/pharmacy/audit hiện chạy đồng bộ, nên không có trạng thái pending/processing để theo dõi.',
    },
    backend_todo: [
      'POST /api/reports/exports',
      'GET /api/reports/exports?status=pending,processing',
      'POST /api/reports/exports/:exportId/cancel',
    ],
  };
}

async function getFailedExports(query = {}, actor = {}) {
  assertReportAccess(actor);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = {
    ...buildDateFilter(query),
    $or: [
      { action: { $in: EXPORT_ACTIONS }, status: { $in: ['failure', 'failed'] } },
      { action: { $regex: 'export', $options: 'i' }, severity: { $in: ['error', 'critical'] } },
    ],
  };
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const userMap = await hydrateActors(logs);
  const items = logs.map((log) => normalizeExportHistoryItem(log, userMap));
  return {
    generated_at: new Date().toISOString(),
    summary: {
      failed_exports: total,
      failed_today: items.filter((item) => item.created_at && new Date(item.created_at) >= todayRange().from).length,
      failed_csv: items.filter((item) => item.format === 'csv').length,
      failed_excel: items.filter((item) => item.format === 'excel').length,
      failed_pdf: items.filter((item) => item.format === 'pdf').length,
      retryable_failed_exports: 0,
      most_common_error: items[0]?.message || null,
    },
    items,
    pagination: buildPagination(page, limit, total),
    empty_state: total === 0 ? {
      title: 'Chưa có unified failed export report.',
      description: 'Hiện chỉ có thể fallback từ audit logs lỗi liên quan export.',
    } : null,
    backend_todo: [
      'GET /api/reports/exports?status=failed',
      'POST /api/reports/exports/:exportId/retry',
      'Lưu error_code, error_message, retry_count, last_retry_at.',
    ],
  };
}

function todoCollection(kind) {
  const config = {
    schedules: {
      title: 'Backend chưa có report export schedules.',
      summary: { schedules: 0, enabled: 0, paused: 0, failed_last_run: 0, recipients: 0 },
      endpoints: [
        'GET /api/reports/export-schedules',
        'POST /api/reports/export-schedules',
        'PATCH /api/reports/export-schedules/:scheduleId',
        'DELETE /api/reports/export-schedules/:scheduleId',
        'POST /api/reports/export-schedules/:scheduleId/run-now',
        'POST /api/reports/export-schedules/:scheduleId/pause',
        'POST /api/reports/export-schedules/:scheduleId/resume',
      ],
    },
    saved: {
      title: 'Backend chưa có saved reports.',
      summary: { saved_reports: 0, my_reports: 0, shared_reports: 0, pinned_reports: 0, scheduled_reports: 0 },
      endpoints: [
        'GET /api/reports/saved',
        'POST /api/reports/saved',
        'PATCH /api/reports/saved/:savedReportId',
        'DELETE /api/reports/saved/:savedReportId',
        'POST /api/reports/saved/:savedReportId/export',
        'POST /api/reports/saved/:savedReportId/duplicate',
        'POST /api/reports/saved/:savedReportId/pin',
        'POST /api/reports/saved/:savedReportId/unpin',
      ],
    },
  }[kind];

  return {
    generated_at: new Date().toISOString(),
    summary: config.summary,
    items: [],
    empty_state: {
      title: config.title,
      description: 'UI đã dựng sẵn form/bảng/drawer, backend cần thêm endpoint persistence để bật thao tác thật.',
    },
    backend_todo: config.endpoints,
  };
}

function normalizeExportPayload(payload = {}) {
  const reportGroup = normalizeString(payload.report_group || payload.group || 'core').toLowerCase();
  const reportType = normalizeString(payload.report_type || payload.type).toLowerCase();
  const format = normalizeString(payload.format || 'csv').toLowerCase();
  const filters = { ...(payload.filters || {}), ...(payload.query || {}) };
  if (reportType === 'revenue' && (!filters.date_from || !filters.date_to)) {
    throw createError('Revenue export bắt buộc truyền date_from và date_to.', 400);
  }
  if (!['csv', 'json'].includes(format)) {
    throw createError('Backend hiện chỉ hỗ trợ export json/csv. Excel/PDF cần report_export_jobs.', 501);
  }
  return { reportGroup, reportType, format, filters };
}

async function createExport(payload = {}, actor = {}, requestMeta = {}) {
  assertExportAccess(actor);
  const { reportGroup, reportType, format, filters } = normalizeExportPayload(payload);
  if (reportGroup === 'core') {
    if (!CORE_REPORT_TYPES.some((item) => item.key === reportType)) throw createError('Core report_type không được hỗ trợ.', 400);
    return reportService.exportReport({ ...filters, report_type: reportType, format }, actor, requestMeta);
  }
  if (reportGroup === 'pharmacy') {
    if (!PHARMACY_REPORT_TYPES.some((item) => item.key === reportType)) throw createError('Pharmacy report_type không được hỗ trợ.', 400);
    return pharmacyReportService.exportPharmacyReport({ ...filters, report_type: reportType, format }, actor, requestMeta);
  }
  if (reportGroup === 'audit') {
    return auditQueryService.exportAuditLogs({ ...filters, format }, actor, requestMeta);
  }

  await recordAuditLog({
    actor,
    action: 'reports.export',
    targetType: 'report',
    status: 'failure',
    message: 'Export group chưa được hỗ trợ trong export center.',
    requestMeta,
    metadata: { report_group: reportGroup, report_type: reportType, format, filters },
  });
  throw createError('report_group hiện chưa được export center hỗ trợ.', 400);
}

module.exports = {
  getCsvCenter,
  getExcelCenter: (query, actor) => {
    assertReportAccess(actor);
    return unsupportedFormatCenter('excel');
  },
  getPdfCenter: (query, actor) => {
    assertReportAccess(actor);
    return unsupportedFormatCenter('pdf');
  },
  getExportHistory,
  getProcessingExports,
  getFailedExports,
  getSchedules: (query, actor) => {
    assertReportAccess(actor);
    return todoCollection('schedules');
  },
  getSavedReports: (query, actor) => {
    assertReportAccess(actor);
    return todoCollection('saved');
  },
  createExport,
  exportCatalog,
};
