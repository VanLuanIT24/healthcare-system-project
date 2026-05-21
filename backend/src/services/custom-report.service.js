const reportService = require('./report.service');
const pharmacyReportService = require('./pharmacy-report.service');
const { createError, normalizeString } = require('./core.service');

const CORE_EXPORT_TYPES = new Set(['appointments', 'queue', 'encounters', 'revenue', 'inventory', 'departments', 'doctors']);

const DATASETS = [
  {
    key: 'appointments_report',
    label: 'Lịch hẹn',
    module: 'operations',
    dataset_type: 'core_report',
    endpoint: '/api/reports/appointments',
    method: 'GET',
    export_type: 'appointments',
    supports_export: true,
    supports_chart: true,
    requires_date_range: false,
    permission_note: 'reports.read hoặc reports.appointments.read',
    fields: [
      'total_appointments', 'booked_count', 'confirmed_count', 'checked_in_count', 'completed_count',
      'cancelled_count', 'no_show_count', 'completion_rate', 'no_show_rate', 'cancellation_rate',
      'by_status', 'by_day', 'by_department', 'by_doctor', 'by_type',
    ],
    filters: ['date_from', 'date_to', 'department_id', 'doctor_id', 'patient_id', 'status', 'timezone'],
    recommended_charts: ['line:by_day', 'donut:by_status', 'bar:by_department', 'bar:by_doctor'],
  },
  {
    key: 'queue_report',
    label: 'Hàng đợi',
    module: 'operations',
    dataset_type: 'core_report',
    endpoint: '/api/reports/queue',
    method: 'GET',
    export_type: 'queue',
    supports_export: true,
    supports_chart: true,
    requires_date_range: false,
    permission_note: 'reports.read hoặc reports.queue.read',
    fields: ['total_tickets', 'waiting_count', 'called_count', 'in_service_count', 'completed_count', 'cancelled_count', 'skipped_count', 'recalled_count', 'average_waiting_time', 'average_service_time', 'by_status', 'by_department', 'by_doctor', 'peak_hours'],
    filters: ['date_from', 'date_to', 'department_id', 'doctor_id', 'patient_id', 'status', 'timezone'],
    recommended_charts: ['donut:by_status', 'bar:peak_hours', 'bar:by_department'],
  },
  {
    key: 'encounters_report',
    label: 'Encounter',
    module: 'operations',
    dataset_type: 'core_report',
    endpoint: '/api/reports/encounters',
    method: 'GET',
    export_type: 'encounters',
    supports_export: true,
    supports_chart: true,
    requires_date_range: false,
    permission_note: 'reports.read hoặc reports.encounters.read',
    fields: ['total_encounters', 'planned_count', 'arrived_count', 'in_progress_count', 'on_hold_count', 'completed_count', 'cancelled_count', 'outpatient_count', 'inpatient_count', 'emergency_count', 'telemedicine_count', 'average_encounter_duration', 'completion_rate', 'cancellation_rate', 'by_status', 'by_type', 'by_department', 'by_doctor', 'by_day'],
    filters: ['date_from', 'date_to', 'department_id', 'doctor_id', 'patient_id', 'status', 'timezone'],
    recommended_charts: ['line:by_day', 'donut:by_status', 'donut:by_type', 'bar:by_department'],
  },
  {
    key: 'revenue_report',
    label: 'Doanh thu',
    module: 'finance',
    dataset_type: 'core_report',
    endpoint: '/api/reports/revenue',
    method: 'GET',
    export_type: 'revenue',
    supports_export: true,
    supports_chart: true,
    requires_date_range: true,
    permission_note: 'reports.revenue.read; bắt buộc date_from/date_to',
    fields: ['gross_charges', 'charge_count', 'issued_invoice_amount', 'invoice_count', 'paid_amount', 'payment_count', 'outstanding_amount', 'refund_amount', 'voided_amount', 'payment_by_method', 'revenue_by_day', 'invoice_by_status', 'revenue_by_department', 'revenue_by_service_type'],
    filters: ['date_from', 'date_to', 'department_id', 'patient_id', 'timezone'],
    recommended_charts: ['line:revenue_by_day', 'donut:payment_by_method', 'donut:invoice_by_status', 'bar:revenue_by_department'],
  },
  {
    key: 'inventory_report',
    label: 'Tồn kho',
    module: 'pharmacy',
    dataset_type: 'core_report',
    endpoint: '/api/reports/inventory',
    method: 'GET',
    export_type: 'inventory',
    supports_export: true,
    supports_chart: true,
    requires_date_range: false,
    permission_note: 'reports.inventory.read',
    fields: ['medication_count', 'batch_count', 'total_on_hand', 'inventory_value', 'low_stock_count', 'near_expiry_count', 'expired_count', 'recalled_count', 'by_batch_status', 'low_stock_items', 'near_expiry_batches'],
    filters: ['date', 'near_expiry_days', 'timezone'],
    recommended_charts: ['donut:by_batch_status', 'table:low_stock_items', 'table:near_expiry_batches'],
  },
  {
    key: 'departments_report',
    label: 'Khoa phòng',
    module: 'departments',
    dataset_type: 'core_report',
    endpoint: '/api/reports/departments',
    method: 'GET',
    export_type: 'departments',
    supports_export: true,
    supports_chart: true,
    requires_date_range: false,
    permission_note: 'reports.department_performance.read',
    fields: ['department_count', 'appointment_count', 'encounter_count', 'doctor_count', 'revenue_amount', 'items'],
    filters: ['date_from', 'date_to', 'department_id', 'timezone'],
    recommended_charts: ['bar:items.revenue_amount', 'bar:items.encounter_count'],
  },
  {
    key: 'doctors_report',
    label: 'Bác sĩ',
    module: 'doctors',
    dataset_type: 'core_report',
    endpoint: '/api/reports/doctors',
    method: 'GET',
    export_type: 'doctors',
    supports_export: true,
    supports_chart: true,
    requires_date_range: false,
    permission_note: 'reports.doctor_performance.read',
    fields: ['doctor_count', 'appointment_count', 'encounter_count', 'completed_encounter_count', 'average_schedule_utilization', 'items'],
    filters: ['date_from', 'date_to', 'department_id', 'doctor_id', 'timezone'],
    recommended_charts: ['bar:items.encounter_count', 'bar:items.schedule_utilization'],
  },
  {
    key: 'pharmacy_dashboard',
    label: 'Dashboard kho dược',
    module: 'pharmacy',
    dataset_type: 'pharmacy_report',
    endpoint: '/api/reports/pharmacy/dashboard',
    method: 'GET',
    pharmacy_export: true,
    supports_export: true,
    supports_chart: true,
    requires_date_range: false,
    permission_note: 'pharmacy_reports.dashboard.read',
    fields: ['total_active_medications', 'total_batches', 'total_on_hand', 'inventory_value', 'low_stock_medication_count', 'out_of_stock_medication_count', 'near_expiry_batch_count', 'expired_batch_count', 'recalled_batch_count', 'receipt_quantity', 'dispense_quantity', 'waste_quantity', 'dispense_count', 'estimated_waste_value', 'trends', 'breakdowns', 'top_lists', 'urgent_worklist'],
    filters: ['date_from', 'date_to', 'warehouse_id', 'storage_location_id', 'medication_id', 'timezone'],
    recommended_charts: ['line:inventory_movement_by_day', 'line:dispense_by_day', 'donut:transactions_by_type'],
  },
  { key: 'pharmacy_inventory_overview', label: 'Tổng quan tồn kho dược', module: 'pharmacy', dataset_type: 'pharmacy_report', endpoint: '/api/reports/pharmacy/inventory-overview', method: 'GET', pharmacy_export: true, supports_export: true, supports_chart: true, requires_date_range: false, fields: ['summary', 'breakdowns', 'items'], filters: ['warehouse_id', 'storage_location_id', 'medication_id', 'batch_status'] },
  { key: 'pharmacy_inventory_movement', label: 'Nhập xuất tồn dược', module: 'pharmacy', dataset_type: 'pharmacy_report', endpoint: '/api/reports/pharmacy/inventory-movement', method: 'GET', pharmacy_export: true, supports_export: true, supports_chart: true, requires_date_range: false, fields: ['summary', 'charts', 'stock_cards', 'transactions'], filters: ['date_from', 'date_to', 'transaction_type', 'direction', 'warehouse_id'] },
  { key: 'pharmacy_dispensing', label: 'Cấp phát thuốc', module: 'pharmacy', dataset_type: 'pharmacy_report', endpoint: '/api/reports/pharmacy/dispensing', method: 'GET', pharmacy_export: true, supports_export: true, supports_chart: true, requires_date_range: false, fields: ['summary', 'charts', 'items', 'queue'], filters: ['date_from', 'date_to', 'status', 'pharmacist_id'] },
  { key: 'pharmacy_low_stock', label: 'Low stock dược', module: 'pharmacy', dataset_type: 'pharmacy_report', endpoint: '/api/reports/pharmacy/low-stock', method: 'GET', pharmacy_export: true, supports_export: true, supports_chart: true, requires_date_range: false, fields: ['summary', 'charts', 'items', 'reorder_suggestions'], filters: ['warehouse_id', 'supplier_id', 'severity'] },
  { key: 'pharmacy_expiring_stock', label: 'Lô sắp hết hạn', module: 'pharmacy', dataset_type: 'pharmacy_report', endpoint: '/api/reports/pharmacy/expiring-stock', method: 'GET', pharmacy_export: true, supports_export: true, supports_chart: true, requires_date_range: false, fields: ['summary', 'charts', 'items'], filters: ['near_expiry_days', 'warehouse_id', 'supplier_id'] },
  { key: 'pharmacy_inventory_valuation', label: 'Giá trị tồn kho dược', module: 'pharmacy', dataset_type: 'pharmacy_report', endpoint: '/api/reports/pharmacy/inventory-valuation', method: 'GET', pharmacy_export: true, supports_export: true, supports_chart: true, requires_date_range: false, fields: ['summary', 'charts', 'items', 'pareto'], filters: ['warehouse_id', 'storage_location_id', 'medication_id'] },
  { key: 'pharmacy_high_usage_medications', label: 'Thuốc dùng nhiều', module: 'pharmacy', dataset_type: 'pharmacy_report', endpoint: '/api/reports/pharmacy/high-usage-medications', method: 'GET', pharmacy_export: true, supports_export: true, supports_chart: true, requires_date_range: false, fields: ['summary', 'charts', 'items'], filters: ['date_from', 'date_to', 'medication_id', 'department_id'] },
  { key: 'pharmacy_waste_disposal', label: 'Hủy / hao hụt thuốc', module: 'pharmacy', dataset_type: 'pharmacy_report', endpoint: '/api/reports/pharmacy/waste-disposal', method: 'GET', pharmacy_export: true, supports_export: true, supports_chart: true, requires_date_range: false, fields: ['summary', 'charts', 'items'], filters: ['date_from', 'date_to', 'reason', 'warehouse_id'] },
];

const HANDLERS = {
  appointments_report: reportService.getAppointmentReport,
  queue_report: reportService.getQueueReport,
  encounters_report: reportService.getEncounterReport,
  revenue_report: reportService.getRevenueReport,
  inventory_report: reportService.getInventoryReport,
  departments_report: reportService.getDepartmentReport,
  doctors_report: reportService.getDoctorReport,
  pharmacy_dashboard: pharmacyReportService.getPharmacyDashboardReport,
  pharmacy_inventory_overview: pharmacyReportService.getInventoryOverviewReport,
  pharmacy_inventory_movement: pharmacyReportService.getInventoryMovementReport,
  pharmacy_dispensing: pharmacyReportService.getDispensingReport,
  pharmacy_low_stock: pharmacyReportService.getLowStockReport,
  pharmacy_expiring_stock: pharmacyReportService.getExpiringStockReport,
  pharmacy_inventory_valuation: pharmacyReportService.getInventoryValuationReport,
  pharmacy_high_usage_medications: pharmacyReportService.getHighUsageMedicationReport,
  pharmacy_waste_disposal: pharmacyReportService.getWasteDisposalReport,
};

function datasetFor(key) {
  const dataset = DATASETS.find((item) => item.key === key);
  if (!dataset) throw createError('Dataset không được hỗ trợ.', 404);
  return dataset;
}

function buildFieldSchema(dataset) {
  return (dataset.fields || []).map((field, index) => {
    const lower = String(field).toLowerCase();
    const isMoney = lower.includes('amount') || lower.includes('revenue') || lower.includes('value') || lower.includes('cost');
    const isPercent = lower.includes('rate') || lower.includes('percent') || lower.includes('utilization');
    const isDuration = lower.includes('time') || lower.includes('duration') || lower.includes('minutes');
    return {
      key: field,
      label: field.replace(/_/g, ' '),
      path: field,
      data_type: isMoney || isPercent || isDuration || lower.includes('count') || lower.includes('total') ? 'number' : 'mixed',
      format: isMoney ? 'currency_vnd' : isPercent ? 'percent' : isDuration ? 'duration_minutes' : lower.includes('date') ? 'date' : 'text',
      section: field.startsWith('by_') || field.includes('breakdown') ? 'breakdowns' : field === 'items' ? 'items' : 'summary',
      filterable: (dataset.filters || []).includes(field),
      sortable: true,
      aggregatable: true,
      chartable: dataset.supports_chart,
      default_visible: index < 8,
      description: `Field ${field} từ dataset ${dataset.key}.`,
    };
  });
}

function normalizePreviewQuery(payload = {}) {
  const filters = { ...(payload.filters || {}), ...(payload.query || {}) };
  const dataset = datasetFor(payload.dataset_key || payload.datasetKey || filters.dataset_key || 'appointments_report');
  if (dataset.requires_date_range && !(filters.date_from || filters.from) && !(filters.date_to || filters.to)) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 29);
    filters.date_from = from.toISOString().slice(0, 10);
    filters.date_to = now.toISOString().slice(0, 10);
  }
  return { dataset, filters };
}

function flattenRows(report = {}) {
  if (Array.isArray(report.items)) return report.items;
  if (Array.isArray(report.stock_cards)) return report.stock_cards;
  if (Array.isArray(report.transactions)) return report.transactions;
  if (Array.isArray(report.urgent_worklist)) return report.urgent_worklist;
  const topLists = report.top_lists || {};
  const firstTopList = Object.values(topLists).find(Array.isArray);
  if (firstTopList) return firstTopList;
  return Object.entries(report.summary || {}).map(([key, value]) => ({ key, metric: key, value }));
}

function responseShape(report = {}) {
  return {
    has_summary: Boolean(report.summary || report.kpis || report.cards),
    has_breakdowns: Boolean(report.breakdowns || report.charts),
    has_items: Array.isArray(report.items) || Array.isArray(report.stock_cards) || Array.isArray(report.transactions),
    top_level_keys: Object.keys(report),
  };
}

function listDatasets(query = {}) {
  const search = normalizeString(query.search).toLowerCase();
  const module = normalizeString(query.module);
  const datasetType = normalizeString(query.dataset_type);
  const exportSupport = query.supports_export;
  const rows = DATASETS.filter((dataset) => {
    if (search && !`${dataset.key} ${dataset.label} ${dataset.endpoint}`.toLowerCase().includes(search)) return false;
    if (module && dataset.module !== module) return false;
    if (datasetType && dataset.dataset_type !== datasetType) return false;
    if (exportSupport !== undefined && exportSupport !== '' && Boolean(dataset.supports_export) !== (exportSupport === true || exportSupport === 'true')) return false;
    return true;
  });
  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_datasets: DATASETS.length,
      core_report_datasets: DATASETS.filter((item) => item.dataset_type === 'core_report').length,
      pharmacy_report_datasets: DATASETS.filter((item) => item.dataset_type === 'pharmacy_report').length,
      raw_list_datasets: DATASETS.filter((item) => item.dataset_type === 'raw_list').length,
      exportable_datasets: DATASETS.filter((item) => item.supports_export).length,
      date_range_required_datasets: DATASETS.filter((item) => item.requires_date_range).length,
      backend_custom_required: 8,
      missing_schema_datasets: 0,
    },
    items: rows.map((dataset) => ({
      ...dataset,
      field_count: dataset.fields?.length || 0,
      filter_count: dataset.filters?.length || 0,
      schema_endpoint: `/api/reports/custom/datasets/${dataset.key}/schema`,
      backend_todo: dataset.dataset_type === 'core_report' || dataset.dataset_type === 'pharmacy_report'
        ? []
        : ['Cần custom report engine để query raw/list dataset an toàn.'],
    })),
    charts: {
      by_module: Object.entries(rows.reduce((acc, dataset) => ({ ...acc, [dataset.module]: (acc[dataset.module] || 0) + 1 }), {})).map(([moduleKey, count]) => ({ module: moduleKey, label: moduleKey, count, value: count })),
      by_type: Object.entries(rows.reduce((acc, dataset) => ({ ...acc, [dataset.dataset_type]: (acc[dataset.dataset_type] || 0) + 1 }), {})).map(([type, count]) => ({ type, label: type, count, value: count })),
    },
    backend_todo: [
      'GET /api/reports/custom/datasets có thể chuyển sang schema động từ DB khi có custom engine.',
      'Cần permissions reports.datasets.read và reports.custom.* nếu muốn quản trị dataset.',
    ],
  };
}

function getDatasetSchema(datasetKey) {
  const dataset = datasetFor(datasetKey);
  return {
    generated_at: new Date().toISOString(),
    dataset,
    fields: buildFieldSchema(dataset),
    filters: (dataset.filters || []).map((key) => ({
      key,
      label: key.replace(/_/g, ' '),
      operators: key.includes('date') ? ['date_range', 'gte', 'lte', 'between'] : ['eq', 'neq', 'in', 'not_in', 'contains'],
      data_type: key.includes('date') ? 'date' : 'text',
    })),
    chart_recommendations: dataset.recommended_charts || [],
    backend_todo: [
      'Custom schema hiện là metadata tĩnh trên backend, chưa có model report_datasets.',
      'Khi thêm custom engine nên lưu schema field/filter/chart trong DB hoặc registry versioned.',
    ],
  };
}

async function preview(payload = {}, actor = {}) {
  const { dataset, filters } = normalizePreviewQuery(payload);
  const handler = HANDLERS[dataset.key];
  if (!handler) throw createError('Dataset này chưa có preview handler.', 400);
  const started = Date.now();
  const report = await handler(filters, actor);
  const rows = flattenRows(report).slice(0, Number(payload.limit || filters.limit || 50));
  return {
    generated_at: new Date().toISOString(),
    dataset,
    filters,
    columns: payload.columns || buildFieldSchema(dataset).filter((field) => field.default_visible),
    charts: payload.charts || dataset.recommended_charts || [],
    report,
    preview: {
      summary: report.summary || report.kpis || {},
      breakdowns: report.breakdowns || report.charts || {},
      rows,
      row_count: rows.length,
      response_shape: responseShape(report),
      api_request: {
        endpoint: dataset.endpoint,
        method: dataset.method,
        query_params: filters,
        export_type: dataset.export_type || null,
        pharmacy_export: Boolean(dataset.pharmacy_export),
      },
      duration_ms: Date.now() - started,
    },
    persistence: {
      supported: false,
      message: 'Backend chưa có custom report persistence. Cần thêm /api/reports/custom/reports.',
    },
  };
}

async function run(payload = {}, actor = {}) {
  const result = await preview(payload, actor);
  return {
    ...result,
    run: {
      status: 'success',
      dataset_key: result.dataset.key,
      row_count: result.preview.row_count,
      duration_ms: result.preview.duration_ms,
      persisted: false,
      backend_todo: 'Cần custom_report_runs để lưu lịch sử run.',
    },
  };
}

function emptyReportCollection(type) {
  const labels = {
    reports: 'Backend chưa có API lưu báo cáo tùy chỉnh.',
    my: 'Backend chưa có API Báo cáo của tôi.',
    shared: 'Backend chưa có API chia sẻ báo cáo tùy chỉnh.',
    pinned: 'Backend chưa có API ghim báo cáo tùy chỉnh.',
    exports: 'Backend chưa có custom report export history.',
  };
  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_reports: 0,
      private_reports: 0,
      shared_reports: 0,
      pinned_reports: 0,
      recently_updated: 0,
      exported_reports: 0,
    },
    items: [],
    persistence: {
      supported: false,
      message: labels[type] || labels.reports,
    },
    backend_todo: [
      'Tạo model custom_report_definitions.',
      'Tạo model custom_report_runs, custom_report_exports, custom_report_activity_logs.',
      'Bổ sung CRUD /api/reports/custom/reports và my/shared/pinned.',
    ],
  };
}

module.exports = {
  CORE_EXPORT_TYPES,
  DATASETS,
  listDatasets,
  getDatasetSchema,
  preview,
  run,
  emptyReportCollection,
};
