import { useMemo, useState } from 'react';
import { FileText, RefreshCw, Search, X } from 'lucide-react';
import {
  DataErrorStrip,
  ExecutiveKpiCard,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
} from '../../reports-overview/components/ExecutiveOverviewComponents';
import { formatDateTime, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import { formatFileSize, rdLabel, rdTone } from '../utils/recordsDocumentsFormatters';

export { DataErrorStrip, ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton, TrendChart };

function unitForKey(key = '') {
  if (key.includes('percent') || key.includes('rate')) return 'percent';
  if (key.includes('size') || key.includes('bytes')) return 'bytes';
  return 'number';
}

function formatUnitValue(value, unit) {
  if (unit === 'percent') return formatPercent(value);
  if (unit === 'bytes') return formatFileSize(value);
  return formatNumber(value);
}

export function recordsDocumentsCards(summary = {}, labels = {}) {
  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: safeNumber(summary[key]),
    unit: unitForKey(key),
    status: key.includes('missing') || key.includes('void') || key.includes('archive') || key.includes('deleted') || key.includes('failed') || key.includes('infected')
      ? (safeNumber(summary[key]) ? 'danger' : 'good')
      : key.includes('pending') || key.includes('draft') || key.includes('processing')
        ? (safeNumber(summary[key]) ? 'warning' : 'neutral')
        : 'neutral',
  }));
}

export function RecordsDocumentsFilterBar({ title, subtitle, filters, onChange, onReset, onRefresh, isRefreshing, lastUpdatedAt }) {
  const [advanced, setAdvanced] = useState(false);
  const update = (field, value) => onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '' } : {}) });

  return (
    <div className="operation-header rd-header">
      <div>
        <span>Hồ sơ & Tài liệu</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="operation-header__tools">
        {['today', '7d', '30d', 'week', 'month', 'custom'].map((range) => (
          <button key={range} type="button" className={filters.range === range ? 'is-active' : ''} onClick={() => update('range', range)}>
            {({ today: 'Hôm nay', '7d': '7 ngày', '30d': '30 ngày', week: 'Tuần này', month: 'Tháng này', custom: 'Custom' })[range]}
          </button>
        ))}
        {filters.range === 'custom' ? (
          <>
            <input type="date" value={filters.date_from || ''} onChange={(event) => update('date_from', event.target.value)} />
            <input type="date" value={filters.date_to || ''} onChange={(event) => update('date_to', event.target.value)} />
          </>
        ) : null}
        <label className="rd-search"><Search size={15} /><input value={filters.search || ''} onChange={(event) => update('search', event.target.value)} placeholder="Tìm hồ sơ, file, bệnh nhân..." /></label>
        {advanced ? (
          <>
            <input value={filters.patient_id || ''} onChange={(event) => update('patient_id', event.target.value)} placeholder="Patient ID" />
            <input value={filters.encounter_id || ''} onChange={(event) => update('encounter_id', event.target.value)} placeholder="Encounter ID" />
            <input value={filters.admission_id || ''} onChange={(event) => update('admission_id', event.target.value)} placeholder="Admission ID" />
            <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Khoa" />
            <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {['draft', 'active', 'finalized', 'sealed', 'archived', 'voided', 'deleted', 'quarantined', 'pending', 'ready', 'failed', 'expired'].map((item) => <option key={item} value={item}>{rdLabel(item)}</option>)}
            </select>
            <select value={filters.record_type || ''} onChange={(event) => update('record_type', event.target.value)}>
              <option value="">Tất cả loại hồ sơ</option>
              {['outpatient', 'inpatient', 'emergency', 'surgery', 'general'].map((item) => <option key={item} value={item}>{rdLabel(item)}</option>)}
            </select>
            <select value={filters.entity_type || ''} onChange={(event) => update('entity_type', event.target.value)}>
              <option value="">Tất cả entity</option>
              {['medical_record', 'encounter', 'admission', 'lab_result', 'imaging_report', 'procedure_result', 'invoice'].map((item) => <option key={item} value={item}>{rdLabel(item)}</option>)}
            </select>
            <select value={filters.source || ''} onChange={(event) => update('source', event.target.value)}>
              <option value="">Tất cả nguồn</option>
              {['staff_upload', 'patient_upload', 'system_generated', 'external_import'].map((item) => <option key={item} value={item}>{rdLabel(item)}</option>)}
            </select>
            <select value={filters.review_status || ''} onChange={(event) => update('review_status', event.target.value)}>
              <option value="">Review status</option>
              {['pending', 'accepted', 'rejected'].map((item) => <option key={item} value={item}>{rdLabel(item)}</option>)}
            </select>
            <select value={filters.scan_status || ''} onChange={(event) => update('scan_status', event.target.value)}>
              <option value="">Scan status</option>
              {['pending', 'clean', 'infected', 'failed', 'skipped'].map((item) => <option key={item} value={item}>{rdLabel(item)}</option>)}
            </select>
            <select value={filters.visibility || ''} onChange={(event) => update('visibility', event.target.value)}>
              <option value="">Visibility</option>
              {['staff_only', 'patient_visible', 'shared_with_relative'].map((item) => <option key={item} value={item}>{rdLabel(item)}</option>)}
            </select>
            <input value={filters.category || ''} onChange={(event) => update('category', event.target.value)} placeholder="Category" />
            <input value={filters.mime_type || ''} onChange={(event) => update('mime_type', event.target.value)} placeholder="MIME type" />
          </>
        ) : null}
        {['missing', 'pending', 'failed', 'infected', 'finalized', 'released', 'voided', 'archived'].map((chip) => (
          <button key={chip} type="button" className={filters.quick === chip ? 'is-active' : ''} onClick={() => onChange({
            quick: filters.quick === chip ? '' : chip,
            status: ['pending', 'failed', 'finalized', 'voided', 'archived'].includes(chip) ? chip : filters.status,
            scan_status: chip === 'infected' ? 'infected' : filters.scan_status,
            released_to_patient: chip === 'released' ? 'true' : filters.released_to_patient,
          })}
          >
            {rdLabel(chip)}
          </button>
        ))}
        <label className="rd-toggle"><input type="checkbox" checked={Boolean(filters.auto_refresh)} onChange={(event) => update('auto_refresh', event.target.checked)} />Auto refresh</label>
        <button type="button" onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Ẩn lọc nâng cao' : 'Lọc nâng cao'}</button>
        <button type="button" onClick={onReset}>Reset bộ lọc</button>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} />Refresh</button>
        <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export function RecordsDocumentsKpiGrid({ cards = [], onOpen }) {
  return (
    <div className="executive-kpi-grid rd-kpi-grid">
      {cards.map((card, index) => {
        if (card.unit !== 'bytes') {
          return <ExecutiveKpiCard key={card.key || card.label} card={card} index={index} onClick={() => onOpen?.(card, 'KPI hồ sơ/tài liệu')} />;
        }
        return (
          <button key={card.key || card.label} type="button" className={`executive-kpi-card status-${card.status || 'neutral'}`} onClick={() => onOpen?.(card, 'KPI hồ sơ/tài liệu')}>
            <span className="executive-kpi-card__icon"><FileText size={20} /></span>
            <span className="executive-kpi-card__value">{formatUnitValue(card.value, 'bytes')}</span>
            <span className="executive-kpi-card__label">{card.label}</span>
            <span className="executive-kpi-card__meta">Theo dõi</span>
          </button>
        );
      })}
    </div>
  );
}

export const RecordsDocumentsKpiCard = ExecutiveKpiCard;

export function RecordsStatusBadge({ status }) {
  return <span className={`executive-badge status-${rdTone(status)}`}>{rdLabel(status)}</span>;
}

function normalizeChartRows(rows = [], key = 'status') {
  return (rows || []).map((row) => {
    const label = rdLabel(row.label || row[key] || row.category || row.date);
    return { ...row, status: label, label, value: row.value ?? row.count ?? row.total_size };
  });
}

export const RecordsStatusDonut = ({ rows = [] }) => <TrendChart data={normalizeChartRows(rows)} type="donut" />;
export const AttachmentStatusDonut = ({ rows = [] }) => <TrendChart data={normalizeChartRows(rows)} type="donut" />;
export const ReviewStatusDonut = ({ rows = [] }) => <TrendChart data={normalizeChartRows(rows, 'review_status')} type="donut" />;
export const ScanStatusDonut = ({ rows = [] }) => <TrendChart data={normalizeChartRows(rows, 'scan_status')} type="donut" />;
export const DocumentSourceChart = ({ rows = [] }) => <TrendChart data={normalizeChartRows(rows, 'source')} type="bar" />;
export const FileSizeChart = ({ rows = [] }) => <TrendChart data={(rows || []).map((row) => ({ ...row, label: row.bucket || row.label, value: row.count || row.value }))} type="bar" />;
export const RecordsInsightCard = ({ title, children }) => <ReportSectionCard title={title}><div className="rd-insight">{children}</div></ReportSectionCard>;

export function RecordsDocumentsTable({ rows = [], columns = [], onRowClick, pagination, onPageChange }) {
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });
  const sorted = useMemo(() => [...(rows || [])].sort((a, b) => {
    const left = a?.[sort.key] ?? '';
    const right = b?.[sort.key] ?? '';
    return sort.direction === 'asc' ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
  }), [rows, sort]);

  if (!rows?.length) return <ReportEmptyState title="Chưa có dữ liệu bảng" description="Bộ lọc hiện tại không có bản ghi phù hợp." />;

  return (
    <>
      <div className="rd-table-wrap">
        <table className="executive-table rd-table">
          <thead>
            <tr>{columns.map((column) => (
              <th key={column.key}>
                <button type="button" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>{column.label}</button>
              </th>
            ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => (
              <tr key={row.id || row.record_id || row.attachment_id || row.export_id || row.audit_log_id || row.timeline_id || index} onClick={() => onRowClick?.(row)}>
                {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '-'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="rd-pagination">
          <span>Trang {formatNumber(pagination.page)} / {formatNumber(pagination.total_pages || pagination.pages || 1)} · {formatNumber(pagination.total)} bản ghi</span>
          <button type="button" disabled={pagination.page <= 1} onClick={() => onPageChange?.(pagination.page - 1)}>Trước</button>
          <button type="button" disabled={pagination.page >= (pagination.total_pages || pagination.pages || 1)} onClick={() => onPageChange?.(pagination.page + 1)}>Sau</button>
        </div>
      ) : null}
    </>
  );
}

const recordColumns = [
  { key: 'record_no', label: 'Record no' },
  { key: 'title', label: 'Tiêu đề' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'department_name', label: 'Khoa' },
  { key: 'record_type', label: 'Loại', render: (row) => rdLabel(row.record_type) },
  { key: 'status', label: 'Trạng thái', render: (row) => <RecordsStatusBadge status={row.status} /> },
  { key: 'opened_at', label: 'Mở lúc', render: (row) => formatDateTime(row.opened_at) },
  { key: 'finalized_at', label: 'Finalize', render: (row) => formatDateTime(row.finalized_at) },
  { key: 'released_to_patient', label: 'Release', render: (row) => row.released_to_patient ? 'Đã release' : 'Chưa release' },
  { key: 'attachment_count', label: 'Tệp', render: (row) => formatNumber(row.attachment_count) },
  { key: 'missing_document_count', label: 'Thiếu', render: (row) => formatNumber(row.missing_document_count) },
];

export const MedicalRecordTable = ({ rows, onOpen, pagination, onPageChange }) => <RecordsDocumentsTable rows={rows} columns={recordColumns} pagination={pagination} onPageChange={onPageChange} onRowClick={onOpen} />;

export const AttachmentTable = ({ rows, onOpen, pagination, onPageChange }) => <RecordsDocumentsTable rows={rows} pagination={pagination} onPageChange={onPageChange} onRowClick={onOpen} columns={[
  { key: 'file_name', label: 'File name' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'entity_type', label: 'Entity', render: (row) => rdLabel(row.entity_type) },
  { key: 'category', label: 'Category' },
  { key: 'source', label: 'Nguồn', render: (row) => rdLabel(row.source) },
  { key: 'review_status', label: 'Review', render: (row) => <RecordsStatusBadge status={row.review_status} /> },
  { key: 'scan_status', label: 'Scan', render: (row) => <RecordsStatusBadge status={row.scan_status} /> },
  { key: 'visibility', label: 'Visibility', render: (row) => rdLabel(row.visibility) },
  { key: 'released_to_patient', label: 'Release', render: (row) => row.released_to_patient ? 'Đã release' : 'Chưa release' },
  { key: 'file_size', label: 'Dung lượng', render: (row) => formatFileSize(row.file_size) },
  { key: 'download_count', label: 'Download', render: (row) => formatNumber(row.download_count) },
  { key: 'created_at', label: 'Tạo lúc', render: (row) => formatDateTime(row.created_at) },
]} />;

export const MissingDocumentTable = ({ rows, onOpen }) => <RecordsDocumentsTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'expected_file_label', label: 'Tài liệu cần có' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'entity_type', label: 'Entity', render: (row) => rdLabel(row.entity_type) },
  { key: 'severity', label: 'Mức độ', render: (row) => <RecordsStatusBadge status={row.severity} /> },
  { key: 'status', label: 'Trạng thái', render: (row) => <RecordsStatusBadge status={row.status} /> },
  { key: 'due_at', label: 'Due', render: (row) => formatDateTime(row.due_at) },
  { key: 'assigned_to_name', label: 'Assignee' },
]} />;

export const DocumentExportTable = ({ rows, onOpen, pagination, onPageChange }) => <RecordsDocumentsTable rows={rows} pagination={pagination} onPageChange={onPageChange} onRowClick={onOpen} columns={[
  { key: 'request_code', label: 'Request code' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'export_type', label: 'Loại export', render: (row) => rdLabel(row.export_type) },
  { key: 'status', label: 'Trạng thái', render: (row) => <RecordsStatusBadge status={row.status} /> },
  { key: 'requested_by_name', label: 'Requested by' },
  { key: 'selected_attachment_count', label: 'Tệp chọn', render: (row) => formatNumber(row.selected_attachment_count) },
  { key: 'created_at', label: 'Tạo lúc', render: (row) => formatDateTime(row.created_at) },
  { key: 'completed_at', label: 'Ready lúc', render: (row) => formatDateTime(row.completed_at) },
  { key: 'expires_at', label: 'Hết hạn', render: (row) => formatDateTime(row.expires_at) },
]} />;

export const DocumentTimeline = ({ rows = [], onOpen, pagination, onPageChange }) => <RecordsDocumentsTable rows={rows} pagination={pagination} onPageChange={onPageChange} onRowClick={onOpen} columns={[
  { key: 'occurred_at', label: 'Thời điểm', render: (row) => formatDateTime(row.occurred_at || row.created_at) },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'module', label: 'Module', render: (row) => rdLabel(row.module || row.module_key) },
  { key: 'entity_type', label: 'Entity', render: (row) => rdLabel(row.entity_type || row.target_type) },
  { key: 'entity_title', label: 'Tên/Code' },
  { key: 'action', label: 'Action', render: (row) => rdLabel(row.action) },
  { key: 'actor_name', label: 'Actor' },
  { key: 'status', label: 'Status', render: (row) => <RecordsStatusBadge status={row.status || row.result} /> },
  { key: 'message', label: 'Message' },
]} />;

function DetailGrid({ item }) {
  const entries = Object.entries(item || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
  return (
    <dl className="rd-detail-grid">
      {entries.slice(0, 40).map(([key, value]) => (
        <div key={key}>
          <dt>{key.replaceAll('_', ' ')}</dt>
          <dd>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordsDocumentsDetailDrawer({ item, type, onClose }) {
  if (!item) return null;
  return (
    <aside className="rd-drawer" aria-label="Chi tiết hồ sơ tài liệu">
      <header>
        <div>
          <span>{type || 'Chi tiết'}</span>
          <h2>{item.title || item.file_name || item.record_no || item.request_code || item.action || item.id || 'Chi tiết'}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
      </header>
      <div className="rd-drawer__hero">
        <span><FileText size={18} /></span>
        <strong>{rdLabel(item.status || item.scan_status || item.review_status || item.result)}</strong>
        <small>{formatDateTime(item.updated_at || item.created_at || item.occurred_at)}</small>
      </div>
      <DetailGrid item={item} />
    </aside>
  );
}

export const RecordDetailDrawer = RecordsDocumentsDetailDrawer;
export const AttachmentDetailDrawer = RecordsDocumentsDetailDrawer;
export const MissingDocumentDrawer = RecordsDocumentsDetailDrawer;
export const ExportDetailDrawer = RecordsDocumentsDetailDrawer;
export const AuditLogDrawer = RecordsDocumentsDetailDrawer;
export const TimelineEventDrawer = RecordsDocumentsDetailDrawer;
