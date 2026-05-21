import { useMemo, useState } from 'react';
import { BarChart3, Database, Download, Eye, Pin, RefreshCw, Save, Search, Share2, SlidersHorizontal } from 'lucide-react';
import {
  ExecutiveKpiCard,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
} from '../../reports-overview/components/ExecutiveOverviewComponents';
import { formatCurrency, formatDateTime, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import { customLabel, customTone, flattenPreviewRows } from '../utils/customReportFormatters';

export { ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton, TrendChart };

function unitForKey(key = '') {
  if (key.includes('rate') || key.includes('percent')) return 'percent';
  if (key.includes('amount') || key.includes('value') || key.includes('revenue')) return 'currency';
  return 'number';
}

function formatValue(value, key = '') {
  const unit = unitForKey(key);
  if (unit === 'currency') return formatCurrency(value);
  if (unit === 'percent') return formatPercent(value);
  return typeof value === 'number' ? formatNumber(value) : String(value ?? '-');
}

export function DatasetBadge({ value }) {
  return <span className={`executive-badge status-${customTone(value)}`}>{customLabel(value)}</span>;
}

export const ReportVisibilityBadge = DatasetBadge;

export function CustomReportHeader({ title, subtitle, onPreview, onExport, onReset, exportState }) {
  return (
    <div className="operation-header custom-header">
      <div>
        <span>Báo cáo tùy chỉnh</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="operation-header__tools">
        <button type="button" onClick={onPreview}><Eye size={15} />Preview</button>
        <button type="button" onClick={onExport}><Download size={15} />{exportState === 'loading' ? 'Đang export' : 'Export'}</button>
        <button type="button" disabled title="Cần /api/reports/custom/reports"><Save size={15} />Save report</button>
        <button type="button" disabled title="Cần custom report persistence">Duplicate</button>
        <button type="button" onClick={onReset}>Reset builder</button>
        <button type="button" disabled title="Cần custom report engine">Backend requirements</button>
      </div>
    </div>
  );
}

export function CustomReportShell({ children }) {
  return <div className="executive-overview-page operation-page custom-report-page">{children}</div>;
}

export function BuilderStepTabs({ activeStep, onChange }) {
  const steps = [
    ['dataset', '1 Dataset'],
    ['filters', '2 Bộ lọc'],
    ['columns', '3 Cột hiển thị'],
    ['charts', '4 Biểu đồ'],
    ['preview', '5 Preview'],
    ['share', '6 Lưu & chia sẻ'],
  ];
  return (
    <div className="custom-step-tabs">
      {steps.map(([key, label]) => (
        <button key={key} type="button" className={activeStep === key ? 'is-active' : ''} onClick={() => onChange(key)}>{label}</button>
      ))}
    </div>
  );
}

export function DatasetSelector({ datasets = [], selectedKey, onSelect, search, onSearch }) {
  const grouped = useMemo(() => datasets.reduce((acc, dataset) => {
    const key = dataset.module || 'other';
    acc[key] = acc[key] || [];
    acc[key].push(dataset);
    return acc;
  }, {}), [datasets]);

  return (
    <ReportSectionCard title="Dataset selector" subtitle="Chọn nguồn dữ liệu có sẵn từ report API hiện tại">
      <label className="custom-search"><Search size={15} /><input value={search || ''} onChange={(event) => onSearch?.(event.target.value)} placeholder="Tìm dataset..." /></label>
      <div className="custom-dataset-list">
        {Object.entries(grouped).map(([module, rows]) => (
          <div key={module}>
            <h3>{customLabel(module)}</h3>
            {rows.map((dataset) => (
              <button key={dataset.key} type="button" className={selectedKey === dataset.key ? 'is-selected' : ''} onClick={() => onSelect(dataset.key)}>
                <strong>{dataset.label}</strong>
                <span>{dataset.endpoint}</span>
                <small>{formatNumber(dataset.field_count || dataset.fields?.length)} fields · {dataset.supports_export ? 'Export' : 'No export'} · {dataset.requires_date_range ? 'Date range required' : 'Date optional'}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
    </ReportSectionCard>
  );
}

export function DatasetCatalogGrid({ datasets = [], onOpen }) {
  if (!datasets.length) return <ReportEmptyState title="Chưa có dataset" description="Không có dataset phù hợp với bộ lọc." />;
  return (
    <div className="custom-dataset-grid">
      {datasets.map((dataset) => (
        <button key={dataset.key} type="button" onClick={() => onOpen?.(dataset)}>
          <Database size={18} />
          <strong>{dataset.label}</strong>
          <span>{dataset.key}</span>
          <small>{dataset.endpoint}</small>
          <div><DatasetBadge value={dataset.dataset_type} /> <DatasetBadge value={dataset.supports_export ? 'supported' : 'missing_backend'} /></div>
        </button>
      ))}
    </div>
  );
}

export function DatasetSchemaPanel({ schema }) {
  const fields = schema?.fields || [];
  return (
    <ReportSectionCard title="Dataset schema" subtitle={schema?.dataset?.endpoint}>
      {!fields.length ? <ReportEmptyState title="Chưa có schema" /> : (
        <div className="custom-schema-table">
          <table className="executive-table">
            <thead><tr><th>Field</th><th>Type</th><th>Format</th><th>Section</th><th>Flags</th></tr></thead>
            <tbody>{fields.map((field) => (
              <tr key={field.key}>
                <td>{field.key}</td>
                <td>{field.data_type}</td>
                <td>{field.format}</td>
                <td>{field.section}</td>
                <td>{[field.filterable && 'filter', field.sortable && 'sort', field.aggregatable && 'aggregate', field.chartable && 'chart'].filter(Boolean).join(', ')}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </ReportSectionCard>
  );
}

export function FilterPresetBar({ filters, onChange }) {
  const applyRange = (range) => {
    const now = new Date();
    const from = new Date(now);
    const days = { today: 0, '7d': 6, '30d': 29, quarter: 89, year: 364 }[range] ?? 29;
    from.setDate(now.getDate() - days);
    onChange({ range, date_from: from.toISOString().slice(0, 10), date_to: now.toISOString().slice(0, 10) });
  };
  return (
    <div className="custom-chip-row">
      {['today', '7d', '30d', 'week', 'month', 'quarter', 'year'].map((range) => (
        <button key={range} type="button" className={filters.range === range ? 'is-active' : ''} onClick={() => applyRange(range)}>{customLabel(range)}</button>
      ))}
    </div>
  );
}

export function FilterRuleRow({ field, value, onChange }) {
  return (
    <div className="custom-rule-row">
      <span>{field.label || field.key}</span>
      <select value={value?.operator || 'eq'} onChange={(event) => onChange({ ...value, operator: event.target.value })}>
        {['eq', 'neq', 'contains', 'in', 'not_in', 'gte', 'lte', 'between', 'date_range', 'is_empty', 'is_not_empty'].map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <input value={value?.value || ''} onChange={(event) => onChange({ ...value, value: event.target.value })} placeholder="Giá trị" />
    </div>
  );
}

export function FilterBuilder({ schema, filters, onChange }) {
  const fields = schema?.filters || [];
  const update = (field, value) => onChange({ [field]: value });
  return (
    <ReportSectionCard title="Filter builder">
      <FilterPresetBar filters={filters} onChange={onChange} />
      <div className="custom-filter-grid">
        <input type="date" value={filters.date_from || ''} onChange={(event) => update('date_from', event.target.value)} />
        <input type="date" value={filters.date_to || ''} onChange={(event) => update('date_to', event.target.value)} />
        <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Department ID" />
        <input value={filters.doctor_id || ''} onChange={(event) => update('doctor_id', event.target.value)} placeholder="Doctor ID" />
        <input value={filters.patient_id || ''} onChange={(event) => update('patient_id', event.target.value)} placeholder="Patient ID" />
        <input value={filters.status || ''} onChange={(event) => update('status', event.target.value)} placeholder="Status" />
      </div>
      <div className="custom-rule-list">
        {fields.slice(0, 8).map((field) => <FilterRuleRow key={field.key} field={field} value={{}} onChange={() => {}} />)}
      </div>
    </ReportSectionCard>
  );
}

export function ColumnPicker({ schema, selected = [], onChange }) {
  const fields = schema?.fields || [];
  const selectedKeys = new Set((selected || []).map((field) => field.key));
  const toggle = (field) => {
    if (selectedKeys.has(field.key)) onChange((selected || []).filter((item) => item.key !== field.key));
    else onChange([...(selected || []), field]);
  };
  return (
    <ReportSectionCard title="Column picker" subtitle="Chọn cột, format và aggregate cho preview table">
      <div className="custom-column-grid">
        {fields.map((field) => (
          <label key={field.key} className={selectedKeys.has(field.key) ? 'is-selected' : ''}>
            <input type="checkbox" checked={selectedKeys.has(field.key)} onChange={() => toggle(field)} />
            <span>{field.label}</span>
            <small>{field.format} · {field.section}</small>
          </label>
        ))}
      </div>
    </ReportSectionCard>
  );
}

export const ColumnOrderEditor = ColumnPicker;
export const ColumnFormatEditor = ColumnPicker;

export function ChartTypeSelector({ chart, onChange }) {
  return (
    <div className="custom-chart-types">
      {['kpi', 'line', 'bar', 'stacked_bar', 'donut', 'area', 'table', 'heatmap'].map((type) => (
        <button key={type} type="button" className={chart?.type === type ? 'is-active' : ''} onClick={() => onChange({ ...chart, type })}>{type}</button>
      ))}
    </div>
  );
}

export function ChartBuilder({ schema, chart, onChange }) {
  const fields = schema?.fields || [];
  return (
    <ReportSectionCard title="Chart builder">
      <ChartTypeSelector chart={chart} onChange={onChange} />
      <div className="custom-filter-grid">
        <input value={chart?.title || ''} onChange={(event) => onChange({ ...chart, title: event.target.value })} placeholder="Chart title" />
        <select value={chart?.x_axis || ''} onChange={(event) => onChange({ ...chart, x_axis: event.target.value })}>
          <option value="">X axis</option>
          {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
        </select>
        <select value={chart?.y_axis || ''} onChange={(event) => onChange({ ...chart, y_axis: event.target.value })}>
          <option value="">Y axis</option>
          {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
        </select>
        <select value={chart?.aggregation || 'count'} onChange={(event) => onChange({ ...chart, aggregation: event.target.value })}>
          {['count', 'sum', 'avg', 'min', 'max'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="custom-chip-row">
        {(schema?.chart_recommendations || []).map((item) => <span key={item}>{item}</span>)}
      </div>
    </ReportSectionCard>
  );
}

export const ChartConfigPanel = ChartBuilder;

export function ReportKpiPreview({ summary = {} }) {
  const cards = Object.entries(summary).slice(0, 8).map(([key, value]) => ({
    key,
    label: key.replaceAll('_', ' '),
    value: safeNumber(value),
    unit: unitForKey(key),
    status: 'neutral',
  }));
  if (!cards.length) return <ReportEmptyState title="Chưa có KPI preview" />;
  return <div className="executive-kpi-grid custom-kpi-grid">{cards.map((card, index) => <ExecutiveKpiCard key={card.key} card={card} index={index} />)}</div>;
}

export function ReportPreviewTable({ rows = [], columns = [] }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu bảng preview" />;
  const keys = columns.length ? columns.map((column) => column.key) : Object.keys(rows[0] || {}).slice(0, 10);
  return (
    <div className="custom-preview-table">
      <table className="executive-table">
        <thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 30).map((row, index) => (
          <tr key={row.id || row._id || index}>{keys.map((key) => <td key={key}>{typeof row?.[key] === 'object' ? JSON.stringify(row[key]) : formatValue(row?.[key], key)}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function ReportPreviewChart({ preview }) {
  const breakdowns = preview?.preview?.breakdowns || {};
  const first = Object.values(breakdowns).find(Array.isArray);
  if (!first) return <ReportEmptyState title="Dataset này chưa có breakdown phù hợp để vẽ biểu đồ đã chọn." />;
  return <TrendChart data={first.map((row) => ({ ...row, label: row.label || row.date || row.status || row.department_name || row.doctor_name || row.payment_method || row.key, value: row.value || row.count || row.amount }))} type="bar" />;
}

export function ReportPreviewPanel({ preview, isLoading, error }) {
  if (isLoading) return <ReportSkeleton />;
  if (error) return <ReportErrorState error={error} />;
  if (!preview) return <ReportEmptyState title="Chưa preview" description="Chọn dataset và bấm Preview để gọi API report thật." />;
  const rows = flattenPreviewRows(preview);
  return (
    <ReportSectionCard title="Preview panel" subtitle={preview.dataset?.endpoint}>
      <ReportKpiPreview summary={preview.preview?.summary || {}} />
      <div className="custom-preview-grid">
        <ReportSectionCard title="Chart preview"><ReportPreviewChart preview={preview} /></ReportSectionCard>
        <ReportSectionCard title="API request preview">
          <pre>{JSON.stringify(preview.preview?.api_request || {}, null, 2)}</pre>
        </ReportSectionCard>
      </div>
      <ReportPreviewTable rows={rows} columns={preview.columns || []} />
      <details className="custom-json-preview"><summary>Raw JSON preview</summary><pre>{JSON.stringify(preview.report || preview, null, 2)}</pre></details>
    </ReportSectionCard>
  );
}

export function ReportSaveDialog() {
  return <DisabledFeature title="Lưu báo cáo" message="Backend chưa có custom report persistence. Cần thêm /api/reports/custom/reports." />;
}

export function ReportShareDialog() {
  return <DisabledFeature title="Chia sẻ báo cáo" message="Backend chưa có share API. Cần thêm /api/reports/custom/reports/:reportId/share." />;
}

export function ReportPinButton() {
  return <button type="button" disabled title="Cần /api/reports/custom/reports/:reportId/pin"><Pin size={15} />Pin</button>;
}

export function ReportExportButton({ onClick, disabled, status }) {
  return <button type="button" disabled={disabled} onClick={onClick}><Download size={15} />{status === 'loading' ? 'Đang export' : 'Export'}</button>;
}

export function DisabledFeature({ title, message }) {
  return (
    <div className="custom-disabled-feature">
      <SlidersHorizontal size={18} />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function SavedReportCard({ report }) {
  return (
    <div className="custom-saved-card">
      <BarChart3 size={18} />
      <strong>{report?.name || 'Chưa có báo cáo'}</strong>
      <span>{report?.description || 'Cần backend custom report persistence.'}</span>
      <DatasetBadge value={report?.visibility || 'missing_backend'} />
    </div>
  );
}

export function SavedReportTable({ rows = [] }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có báo cáo đã lưu" description="Backend chưa có API lưu/chia sẻ/ghim báo cáo tùy chỉnh." />;
  return (
    <div className="custom-preview-table">
      <table className="executive-table">
        <thead><tr><th>Tên</th><th>Dataset</th><th>Visibility</th><th>Owner</th><th>Updated</th><th>Action</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.dataset_key}</td><td><DatasetBadge value={row.visibility} /></td><td>{row.owner_name}</td><td>{formatDateTime(row.updated_at)}</td><td><button type="button">Open</button></td></tr>)}</tbody>
      </table>
    </div>
  );
}
