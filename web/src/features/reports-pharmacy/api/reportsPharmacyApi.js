import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);
const optional = (promise, label) => promise.then(unwrap).catch((error) => ({
  __optional_error: true,
  label,
  message: error?.message || 'Không thể tải dữ liệu bổ sung.',
}));

async function loadDashboard(params) {
  const [report, overview, alertsSummary, workQueue, dispensingToday, performance] = await Promise.all([
    request('/reports/pharmacy/dashboard', { params }).then(unwrap),
    optional(request('/pharmacy/overview/dashboard', { params }), 'pharmacy_overview_dashboard'),
    optional(request('/pharmacy/alerts/summary', { params }), 'pharmacy_alerts_summary'),
    optional(request('/pharmacy/overview/work-queue', { params }), 'pharmacy_work_queue'),
    optional(request('/pharmacy/overview/dispensing-today', { params }), 'pharmacy_dispensing_today'),
    optional(request('/pharmacy/overview/performance', { params }), 'pharmacy_performance'),
  ]);
  const optionalResponses = { overview, alerts_summary: alertsSummary, work_queue: workQueue, dispensing_today: dispensingToday, performance };
  const dataErrors = Object.entries(optionalResponses)
    .filter(([, value]) => value?.__optional_error)
    .map(([key, value]) => ({ source: key, message: value.message }));
  return {
    ...report,
    raw: {
      ...(report.raw || {}),
      pharmacy_overview: optionalResponses.overview?.__optional_error ? null : optionalResponses.overview,
      alerts_summary: optionalResponses.alerts_summary?.__optional_error ? null : optionalResponses.alerts_summary,
      work_queue: optionalResponses.work_queue?.__optional_error ? null : optionalResponses.work_queue,
      dispensing_today: optionalResponses.dispensing_today?.__optional_error ? null : optionalResponses.dispensing_today,
      performance: optionalResponses.performance?.__optional_error ? null : optionalResponses.performance,
    },
    data_errors: [...(report.data_errors || []), ...dataErrors],
  };
}

export const reportsPharmacyApi = {
  dashboard: loadDashboard,
  inventory: (params) => request('/reports/pharmacy/inventory-overview', { params }).then(unwrap),
  movement: (params) => request('/reports/pharmacy/inventory-movement', { params }).then(unwrap),
  lowStock: (params) => request('/reports/pharmacy/low-stock', { params }).then(unwrap),
  stockoutRisk: (params) => request('/reports/pharmacy/stockout-risk', { params }).then(unwrap),
  expiringBatches: (params) => request('/reports/pharmacy/expiring-stock', { params }).then(unwrap),
  expiredRecalledBatches: (params) => request('/reports/pharmacy/expired-recalled-batches', { params }).then(unwrap),
  dispensing: (params) => request('/reports/pharmacy/dispensing', { params }).then(unwrap),
  prescriptions: (params) => request('/reports/pharmacy/prescriptions', { params }).then(unwrap),
  inventoryValue: (params) => request('/reports/pharmacy/inventory-valuation', { params }).then(unwrap),
  turnover: (params) => request('/reports/pharmacy/turnover', { params }).then(unwrap),
  highUsage: (params) => request('/reports/pharmacy/high-usage-medications', { params }).then(unwrap),
  wasteDisposal: (params) => request('/reports/pharmacy/waste-disposal', { params }).then(unwrap),
  exportReport: (body) => request('/reports/pharmacy/export', { method: 'POST', body }).then(unwrap),
  exportHistory: (params) => request('/reports/pharmacy/export-history', { params }).then(unwrap),
};
