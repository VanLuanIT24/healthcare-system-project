import { useMemo, useState } from 'react';
import {
  BuilderStepTabs,
  ChartBuilder,
  ColumnPicker,
  CustomReportHeader,
  CustomReportShell,
  DatasetCatalogGrid,
  DatasetSchemaPanel,
  DatasetSelector,
  DisabledFeature,
  FilterBuilder,
  ReportErrorState,
  ReportPreviewPanel,
  ReportSectionCard,
  ReportSkeleton,
  SavedReportCard,
  SavedReportTable,
} from '../components/CustomReportComponents';
import {
  useCustomReportDatasets,
  useCustomReportExport,
  useDatasetSchema,
  useMyReports,
  usePinnedReports,
  useReportBuilderState,
  useReportPreview,
  useSharedReports,
} from '../hooks/useCustomReports';
import { customLabel } from '../utils/customReportFormatters';
import { formatNumber } from '../../reports-overview/utils/formatters';
import '../styles/reportsCustom.css';

function chartRows(rows = []) {
  return (rows || []).map((row) => ({ ...row, label: customLabel(row.label || row.module || row.type || row.dataset_type), value: row.value || row.count }));
}

function KpiStrip({ summary = {} }) {
  const rows = Object.entries(summary);
  return (
    <div className="custom-kpi-strip">
      {rows.map(([key, value]) => (
        <div key={key}>
          <strong>{formatNumber(value)}</strong>
          <span>{key.replaceAll('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}

function DatasetPageFrame({ title, subtitle, children }) {
  return (
    <CustomReportShell>
      <div className="operation-header custom-header">
        <div>
          <span>Báo cáo tùy chỉnh</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </CustomReportShell>
  );
}

export function ReportBuilderPage() {
  const datasetsQuery = useCustomReportDatasets();
  const builder = useReportBuilderState();
  const schemaQuery = useDatasetSchema(builder.datasetKey);
  const previewQuery = useReportPreview();
  const exportState = useCustomReportExport();
  const [datasetSearch, setDatasetSearch] = useState('');
  const [chart, setChart] = useState({ type: 'bar', aggregation: 'count' });
  const datasets = datasetsQuery.data?.items || [];
  const selectedDataset = datasets.find((item) => item.key === builder.datasetKey) || datasets[0];
  const visibleDatasets = datasets.filter((dataset) => `${dataset.key} ${dataset.label} ${dataset.endpoint}`.toLowerCase().includes(datasetSearch.toLowerCase()));

  const doPreview = () => previewQuery.preview({
    datasetKey: builder.datasetKey,
    filters: builder.filters,
    columns: builder.columns,
    charts: [chart],
  });

  return (
    <CustomReportShell>
      <CustomReportHeader
        title="Report builder"
        subtitle="Tự tạo báo cáo từ dataset hiện có, preview bằng API thật và chuẩn bị cấu hình cho custom report engine"
        onPreview={doPreview}
        onExport={() => exportState.exportReport({ dataset: selectedDataset, filters: builder.filters })}
        onReset={builder.reset}
        exportState={exportState.status}
      />
      <BuilderStepTabs activeStep={builder.activeStep} onChange={builder.setActiveStep} />
      <div className="custom-builder-layout">
        <DatasetSelector datasets={visibleDatasets} selectedKey={builder.datasetKey} onSelect={builder.setDatasetKey} search={datasetSearch} onSearch={setDatasetSearch} />
        <div className="custom-builder-config">
          <FilterBuilder schema={schemaQuery.data} filters={builder.filters} onChange={builder.setFilters} />
          <ColumnPicker schema={schemaQuery.data} selected={builder.columns} onChange={builder.setColumns} />
          <ChartBuilder schema={schemaQuery.data} chart={chart} onChange={setChart} />
          <ReportSectionCard title="Lưu & chia sẻ">
            <div className="custom-action-grid">
              <DisabledFeature title="Save report" message="Cần POST /api/reports/custom/reports và model custom_report_definitions." />
              <DisabledFeature title="Share report" message="Cần /api/reports/custom/reports/:reportId/share." />
              <DisabledFeature title="Pin report" message="Cần /api/reports/custom/reports/:reportId/pin." />
            </div>
          </ReportSectionCard>
        </div>
        <ReportPreviewPanel preview={previewQuery.data} isLoading={previewQuery.isLoading} error={previewQuery.error} />
      </div>
    </CustomReportShell>
  );
}

export function DatasetsPage() {
  const query = useCustomReportDatasets();
  const [drawer, setDrawer] = useState(null);
  const schemaQuery = useDatasetSchema(drawer?.key);
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <DatasetPageFrame title="Dataset" subtitle="Catalog dataset từ core report và pharmacy report hiện có">
      <KpiStrip summary={query.data?.summary || {}} />
      <div className="custom-dashboard-grid">
        <ReportSectionCard title="Dataset by module"><DatasetCatalogGrid datasets={query.data?.items || []} onOpen={setDrawer} /></ReportSectionCard>
        <ReportSectionCard title="Backend TODO">
          <ul className="custom-todo-list">{(query.data?.backend_todo || []).map((todo) => <li key={todo}>{todo}</li>)}</ul>
        </ReportSectionCard>
      </div>
      {drawer ? (
        <aside className="custom-drawer">
          <button type="button" onClick={() => setDrawer(null)}>Đóng</button>
          <h2>{drawer.label}</h2>
          <p>{drawer.endpoint}</p>
          <DatasetSchemaPanel schema={schemaQuery.data} />
        </aside>
      ) : null}
    </DatasetPageFrame>
  );
}

function BuilderFocusedPage({ title, subtitle, focus }) {
  const datasetsQuery = useCustomReportDatasets();
  const builder = useReportBuilderState();
  const schemaQuery = useDatasetSchema(builder.datasetKey);
  const previewQuery = useReportPreview();
  const datasets = datasetsQuery.data?.items || [];
  const selectedDataset = datasets.find((item) => item.key === builder.datasetKey);
  const [chart, setChart] = useState({ type: 'bar', aggregation: 'count' });

  const focusComponent = useMemo(() => ({
    filters: <FilterBuilder schema={schemaQuery.data} filters={builder.filters} onChange={builder.setFilters} />,
    columns: <ColumnPicker schema={schemaQuery.data} selected={builder.columns} onChange={builder.setColumns} />,
    charts: <ChartBuilder schema={schemaQuery.data} chart={chart} onChange={setChart} />,
  }[focus]), [focus, schemaQuery.data, builder.filters, builder.columns, chart]);

  return (
    <DatasetPageFrame title={title} subtitle={subtitle}>
      <div className="custom-two-column">
        <DatasetSelector datasets={datasets} selectedKey={builder.datasetKey} onSelect={builder.setDatasetKey} />
        <div>
          {focusComponent}
          <ReportSectionCard title="Validation / API query">
            <pre>{JSON.stringify({
              dataset_key: builder.datasetKey,
              endpoint: selectedDataset?.endpoint,
              filters: builder.filters,
              revenue_requires_date_range: builder.datasetKey === 'revenue_report',
            }, null, 2)}</pre>
          </ReportSectionCard>
          <button type="button" className="custom-primary-action" onClick={() => previewQuery.preview({ datasetKey: builder.datasetKey, filters: builder.filters, columns: builder.columns, charts: [chart] })}>Apply filter & preview</button>
          <ReportPreviewPanel preview={previewQuery.data} isLoading={previewQuery.isLoading} error={previewQuery.error} />
        </div>
      </div>
    </DatasetPageFrame>
  );
}

export const CustomFiltersPage = () => <BuilderFocusedPage title="Bộ lọc" subtitle="Xây filter builder, preset range và query params từ dataset schema" focus="filters" />;
export const CustomColumnsPage = () => <BuilderFocusedPage title="Cột hiển thị" subtitle="Chọn cột, format, aggregate và preview table với sticky header" focus="columns" />;
export const CustomChartsPage = () => <BuilderFocusedPage title="Biểu đồ" subtitle="Cấu hình chart type, axis, aggregation và preview từ breakdown thật" focus="charts" />;

function SavedReportsPage({ title, subtitle, hook, emptyTitle }) {
  const query = hook();
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <DatasetPageFrame title={title} subtitle={subtitle}>
      <KpiStrip summary={query.data?.summary || {}} />
      <div className="custom-dashboard-grid">
        <ReportSectionCard title={emptyTitle}>
          <SavedReportTable rows={query.data?.items || []} />
        </ReportSectionCard>
        <ReportSectionCard title="Disabled state">
          <SavedReportCard report={{ name: emptyTitle, description: query.data?.persistence?.message, visibility: 'missing_backend' }} />
          <ul className="custom-todo-list">{(query.data?.backend_todo || []).map((todo) => <li key={todo}>{todo}</li>)}</ul>
        </ReportSectionCard>
      </div>
    </DatasetPageFrame>
  );
}

export const MyReportsPage = () => <SavedReportsPage title="Báo cáo của tôi" subtitle="Danh sách report riêng, local draft và trạng thái backend persistence" hook={useMyReports} emptyTitle="Backend chưa có API lưu báo cáo tùy chỉnh" />;
export const SharedReportsPage = () => <SavedReportsPage title="Báo cáo dùng chung" subtitle="Báo cáo được chia sẻ theo user, role, department và quyền export/edit" hook={useSharedReports} emptyTitle="Backend chưa có API chia sẻ báo cáo tùy chỉnh" />;
export const PinnedReportsPage = () => <SavedReportsPage title="Báo cáo được ghim" subtitle="Pinned dashboard cho quick run, mini chart preview và reorder khi có backend" hook={usePinnedReports} emptyTitle="Backend chưa có API ghim báo cáo tùy chỉnh" />;

