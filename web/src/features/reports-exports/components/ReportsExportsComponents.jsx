import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
} from 'lucide-react';
import {
  ExecutiveKpiCard,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
} from '../../reports-overview/components/ExecutiveOverviewComponents';
import { formatNumber, formatPercent } from '../../reports-overview/utils/formatters';
import {
  exportLabel,
  exportTone,
  formatExportDate,
  formatFileSize,
  normalizeExportRows,
  REPORT_GROUP_LABELS,
} from '../utils/reportsExportsFormatters';

export { ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton, TrendChart };

export function ExportStatusBadge({ value }) {
  return <span className={`executive-badge status-${exportTone(value)}`}>{exportLabel(value)}</span>;
}

export const ExportFormatBadge = ExportStatusBadge;
export const ReportGroupBadge = ExportStatusBadge;

export function ExportProgressBar({ value = 0 }) {
  const width = Math.max(0, Math.min(Number(value || 0), 100));
  return (
    <div className="exports-progress">
      <span style={{ width: `${width}%` }} />
      <strong>{formatPercent(width / 100)}</strong>
    </div>
  );
}

export function ReportsExportsShell({ children }) {
  return <div className="executive-overview-page operation-page reports-exports-page">{children}</div>;
}

export function ReportsExportsHeader({
  title,
  subtitle,
  onRefresh,
  onReset,
  onHistory,
  isRefreshing,
  lastUpdatedAt,
  autoRefresh,
  onToggleAutoRefresh,
}) {
  return (
    <div className="operation-header exports-header">
      <div>
        <span>Báo cáo & Phân tích / Xuất báo cáo</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="operation-header__tools">
        {lastUpdatedAt ? <small>Cập nhật {formatExportDate(lastUpdatedAt)}</small> : null}
        {onToggleAutoRefresh ? (
          <label className="exports-toggle">
            <input type="checkbox" checked={Boolean(autoRefresh)} onChange={(event) => onToggleAutoRefresh(event.target.checked)} />
            Auto refresh
          </label>
        ) : null}
        {onHistory ? <button type="button" onClick={onHistory}><Clock3 size={15} />Lịch sử</button> : null}
        {onReset ? <button type="button" onClick={onReset}><RotateCcw size={15} />Reset</button> : null}
        {onRefresh ? <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />Refresh</button> : null}
      </div>
    </div>
  );
}

export function ExportKpiCard({ label, value, icon: Icon = FileText, tone = 'neutral', subtitle }) {
  void Icon;
  void subtitle;
  return (
    <ExecutiveKpiCard
      card={{
        label,
        value: typeof value === 'number' ? value : value ?? '-',
        unit: typeof value === 'number' ? 'number' : 'text',
        status: tone,
      }}
    />
  );
}

export function ExportKpiGrid({ summary = {}, mode = 'history' }) {
  const rows = useMemo(() => {
    if (mode === 'csv') {
      return [
        ['Core reports hỗ trợ CSV', summary.core_reports_supported, Database, 'success'],
        ['Pharmacy reports hỗ trợ CSV', summary.pharmacy_reports_supported, FileText, 'success'],
        ['Audit export hỗ trợ CSV', summary.audit_export_supported, FileText, 'info'],
        ['Export CSV hôm nay', summary.csv_exports_today, CalendarDays, 'info'],
        ['CSV thất bại', summary.failed_csv_exports, AlertTriangle, 'danger'],
        ['Export gần đây', summary.recent_exports, Clock3, 'neutral'],
      ];
    }
    if (mode === 'format') {
      return [
        ['Đang hỗ trợ', summary.supported_now, FileText, 'danger'],
        ['Cần backend', summary.backend_required, Settings, 'warning'],
        ['Cần async job', summary.async_job_required, Clock3, 'info'],
        ['Cần download center', summary.download_center_required, Download, 'info'],
      ];
    }
    return Object.entries(summary).slice(0, 10).map(([key, value]) => [key.replaceAll('_', ' '), value, FileText, 'neutral']);
  }, [mode, summary]);

  return (
    <div className="operation-kpi-grid exports-kpi-grid">
      {rows.map(([label, value, Icon, tone]) => <ExportKpiCard key={label} label={label} value={value} icon={Icon} tone={tone} />)}
    </div>
  );
}

export function ExportFilterBar({ filters, setFilters, onReset, showStatus = true, showAutoRefresh, autoRefresh, onToggleAutoRefresh }) {
  const applyRange = (range) => {
    const now = new Date();
    const from = new Date(now);
    const days = { today: 0, '7d': 6, '30d': 29, week: 6, month: 29, quarter: 89 }[range] ?? 29;
    from.setDate(now.getDate() - days);
    setFilters({ range, date_from: from.toISOString().slice(0, 10), date_to: now.toISOString().slice(0, 10) });
  };

  return (
    <ReportSectionCard title="Bộ lọc export" subtitle="Lọc theo kỳ, nhóm báo cáo, format, trạng thái và người xuất">
      <div className="exports-filter-grid">
        <label><span>Từ ngày</span><input type="date" value={filters.date_from || ''} onChange={(event) => setFilters({ date_from: event.target.value })} /></label>
        <label><span>Đến ngày</span><input type="date" value={filters.date_to || ''} onChange={(event) => setFilters({ date_to: event.target.value })} /></label>
        <label>
          <span>Nhóm báo cáo</span>
          <select value={filters.report_group || ''} onChange={(event) => setFilters({ report_group: event.target.value })}>
            <option value="">Tất cả</option>
            {Object.entries(REPORT_GROUP_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label><span>Report type</span><input value={filters.report_type || ''} onChange={(event) => setFilters({ report_type: event.target.value })} placeholder="revenue, dashboard..." /></label>
        <label>
          <span>Format</span>
          <select value={filters.format || ''} onChange={(event) => setFilters({ format: event.target.value })}>
            <option value="">Tất cả</option>
            {['csv', 'json', 'excel', 'pdf', 'zip'].map((format) => <option key={format} value={format}>{exportLabel(format)}</option>)}
          </select>
        </label>
        {showStatus ? (
          <label>
            <span>Trạng thái</span>
            <select value={filters.status || ''} onChange={(event) => setFilters({ status: event.target.value })}>
              <option value="">Tất cả</option>
              {['success', 'failure', 'pending', 'processing', 'ready', 'failed', 'cancelled', 'expired'].map((status) => <option key={status} value={status}>{exportLabel(status)}</option>)}
            </select>
          </label>
        ) : null}
        <label className="exports-search"><span>Tìm kiếm</span><div><Search size={15} /><input value={filters.search || ''} onChange={(event) => setFilters({ search: event.target.value })} placeholder="report, actor, request..." /></div></label>
      </div>
      <div className="exports-chip-row">
        {['today', '7d', '30d', 'week', 'month', 'quarter'].map((range) => (
          <button key={range} type="button" className={filters.range === range ? 'is-active' : ''} onClick={() => applyRange(range)}>{exportLabel(range)}</button>
        ))}
        <button type="button" onClick={onReset}>Reset</button>
        {showAutoRefresh ? (
          <label><input type="checkbox" checked={Boolean(autoRefresh)} onChange={(event) => onToggleAutoRefresh?.(event.target.checked)} /> Auto refresh 30s</label>
        ) : null}
      </div>
    </ReportSectionCard>
  );
}

export function ReportTypeSelector({ catalog, value, onChange }) {
  const groups = catalog?.groups || [];
  const group = groups.find((item) => item.key === value.report_group) || groups[0];
  const reportTypes = group?.report_types || [];
  return (
    <div className="exports-selector">
      <label>
        <span>Nhóm báo cáo</span>
        <select value={value.report_group || group?.key || 'core'} onChange={(event) => onChange({ report_group: event.target.value, report_type: '' })}>
          {groups.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label>
        <span>Report type</span>
        <select value={value.report_type || reportTypes[0]?.key || ''} onChange={(event) => onChange({ report_type: event.target.value })}>
          {reportTypes.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
    </div>
  );
}

export function ExportRequestPanel({ catalog, requestState, setRequestState, onExport, exportStatus, exportError }) {
  const selectedGroup = catalog?.groups?.find((group) => group.key === requestState.report_group) || catalog?.groups?.[0];
  const selectedReport = selectedGroup?.report_types?.find((report) => report.key === requestState.report_type) || selectedGroup?.report_types?.[0];
  const nextRequest = {
    report_group: requestState.report_group || selectedGroup?.key || 'core',
    report_type: requestState.report_type || selectedReport?.key || 'appointments',
    format: 'csv',
    filters: {
      date_from: requestState.date_from,
      date_to: requestState.date_to,
      timezone: requestState.timezone || 'Asia/Ho_Chi_Minh',
      department_id: requestState.department_id || undefined,
      doctor_id: requestState.doctor_id || undefined,
      patient_id: requestState.patient_id || undefined,
      status: requestState.status || undefined,
      near_expiry_days: requestState.near_expiry_days || undefined,
      max_range_days: requestState.max_range_days || undefined,
    },
  };
  const invalidRevenue = nextRequest.report_type === 'revenue' && (!nextRequest.filters.date_from || !nextRequest.filters.date_to);

  return (
    <ReportSectionCard title="Export request" subtitle="Tạo CSV bằng backend hiện có, không tự động export khi mở trang">
      <ReportTypeSelector catalog={catalog} value={requestState} onChange={(patch) => setRequestState((current) => ({ ...current, ...patch }))} />
      <div className="exports-request-grid">
        <label><span>Date from</span><input type="date" value={requestState.date_from || ''} onChange={(event) => setRequestState((current) => ({ ...current, date_from: event.target.value }))} /></label>
        <label><span>Date to</span><input type="date" value={requestState.date_to || ''} onChange={(event) => setRequestState((current) => ({ ...current, date_to: event.target.value }))} /></label>
        <label><span>Timezone</span><input value={requestState.timezone || 'Asia/Ho_Chi_Minh'} onChange={(event) => setRequestState((current) => ({ ...current, timezone: event.target.value }))} /></label>
        <label><span>Department ID</span><input value={requestState.department_id || ''} onChange={(event) => setRequestState((current) => ({ ...current, department_id: event.target.value }))} /></label>
        <label><span>Doctor ID</span><input value={requestState.doctor_id || ''} onChange={(event) => setRequestState((current) => ({ ...current, doctor_id: event.target.value }))} /></label>
        <label><span>Patient ID</span><input value={requestState.patient_id || ''} onChange={(event) => setRequestState((current) => ({ ...current, patient_id: event.target.value }))} /></label>
        <label><span>Status</span><input value={requestState.status || ''} onChange={(event) => setRequestState((current) => ({ ...current, status: event.target.value }))} /></label>
        <label><span>Near expiry days</span><input type="number" value={requestState.near_expiry_days || ''} onChange={(event) => setRequestState((current) => ({ ...current, near_expiry_days: event.target.value }))} /></label>
      </div>
      {invalidRevenue ? <div className="exports-error-inline">Revenue export bắt buộc date_from và date_to.</div> : null}
      <div className="exports-preview-box">
        <div>
          <strong>{selectedGroup?.method} {selectedGroup?.endpoint}</strong>
          <span>{selectedGroup?.key === 'pharmacy' ? 'Body POST qua export center' : 'Request proxy qua /api/reports/exports'}</span>
        </div>
        <pre>{JSON.stringify(nextRequest, null, 2)}</pre>
      </div>
      <div className="exports-actions">
        <button type="button" className="exports-primary" disabled={invalidRevenue || exportStatus === 'loading'} onClick={() => onExport(nextRequest)}>
          <Download size={15} />{exportStatus === 'loading' ? 'Đang export...' : 'Export CSV'}
        </button>
        <button type="button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(nextRequest, null, 2))}><Copy size={15} />Copy request</button>
        <button type="button" disabled title="Cần /api/reports/saved">Lưu cấu hình</button>
      </div>
      {exportError ? <div className="exports-error-inline">{exportError}</div> : null}
    </ReportSectionCard>
  );
}

export function ExportBackendTodoCard({ title, description, todos = [], endpoint }) {
  return (
    <ReportSectionCard title={title} subtitle={description}>
      {endpoint ? <pre>{JSON.stringify(endpoint, null, 2)}</pre> : null}
      <ul className="exports-todo-list">
        {todos.map((todo) => <li key={todo}>{todo}</li>)}
      </ul>
    </ReportSectionCard>
  );
}

export function ExportOptionsPanel({ data, format }) {
  return (
    <ReportSectionCard title={`${exportLabel(format)} design preview`} subtitle="Cho phép cấu hình trước, nút export thật bị khóa đến khi backend hỗ trợ">
      <div className="exports-options-grid">
        {(data?.design_options || []).map((option) => (
          <label key={option}><input type="checkbox" defaultChecked /> {option.replaceAll('_', ' ')}</label>
        ))}
      </div>
      <button type="button" disabled className="exports-disabled-action">Export {exportLabel(format)} - cần backend</button>
    </ReportSectionCard>
  );
}

export function ExportHistoryTable({ rows = [], onOpen, emptyTitle = 'Chưa có lịch sử export phù hợp' }) {
  const normalized = normalizeExportRows(rows);
  if (!normalized.length) return <ReportEmptyState title={emptyTitle} description="Điều chỉnh bộ lọc hoặc kiểm tra backend export history." />;
  return (
    <div className="exports-table-wrap">
      <table className="executive-table exports-table">
        <thead>
          <tr>
            <th>Export id</th>
            <th>Source</th>
            <th>Report group</th>
            <th>Report type</th>
            <th>Format</th>
            <th>Status</th>
            <th>Exported by</th>
            <th>Exported at</th>
            <th>Rows</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          {normalized.map((item) => (
            <tr key={item.export_id} onClick={() => onOpen?.(item)}>
              <td>{item.export_id}</td>
              <td>{item.source || 'audit'}</td>
              <td><ReportGroupBadge value={item.report_group} /></td>
              <td>{item.report_type}</td>
              <td><ExportFormatBadge value={item.format} /></td>
              <td><ExportStatusBadge value={item.status} /></td>
              <td>{item.exported_by || '-'}</td>
              <td>{formatExportDate(item.exported_at)}</td>
              <td className="text-right">{item.row_count_label}</td>
              <td>{item.download_available ? 'Có' : 'Không'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const ProcessingExportTable = ExportHistoryTable;
export const FailedExportTable = ExportHistoryTable;
export const ExportScheduleTable = ExportHistoryTable;
export const SavedReportTable = ExportHistoryTable;

export function ExportJobDrawer({ item, onClose, title = 'Export detail' }) {
  if (!item) return null;
  return (
    <aside className="exports-drawer">
      <div>
        <button type="button" onClick={onClose}>Đóng</button>
        <h2>{title}</h2>
        <p>{item.message || item.report_type || item.export_id}</p>
      </div>
      <dl>
        <dt>Export id</dt><dd>{item.export_id || '-'}</dd>
        <dt>Report group</dt><dd>{exportLabel(item.report_group)}</dd>
        <dt>Report type</dt><dd>{item.report_type || '-'}</dd>
        <dt>Format</dt><dd>{exportLabel(item.format)}</dd>
        <dt>Status</dt><dd>{exportLabel(item.status)}</dd>
        <dt>Exported by</dt><dd>{item.exported_by || '-'}</dd>
        <dt>Exported at</dt><dd>{formatExportDate(item.exported_at || item.created_at)}</dd>
        <dt>File size</dt><dd>{formatFileSize(item.file_size)}</dd>
      </dl>
      <ReportSectionCard title="Filters snapshot">
        <pre>{JSON.stringify(item.filters || item.metadata || {}, null, 2)}</pre>
      </ReportSectionCard>
      <div className="exports-actions">
        <button type="button" disabled title="Cần /api/reports/exports/:exportId/retry">Retry</button>
        <button type="button" disabled title="Cần /api/reports/exports/:exportId/cancel">Cancel</button>
        <button type="button" disabled title="Cần download center thống nhất">Download</button>
      </div>
    </aside>
  );
}

export const ExportScheduleDrawer = ExportJobDrawer;
export const SavedReportDrawer = ExportJobDrawer;

export function ExportErrorPanel({ error }) {
  if (!error) return null;
  return <div className="exports-error-panel"><AlertTriangle size={18} />{typeof error === 'string' ? error : error.message}</div>;
}

export function ExportFormatCard({ format, enabled, children }) {
  const Icon = format === 'excel' ? FileSpreadsheet : FileText;
  return (
    <div className={`exports-format-card ${enabled ? 'is-enabled' : 'is-disabled'}`}>
      <Icon size={22} />
      <div>
        <strong>{exportLabel(format)}</strong>
        <span>{enabled ? 'Backend đang hỗ trợ' : 'Cần backend export center'}</span>
      </div>
      {children}
    </div>
  );
}
