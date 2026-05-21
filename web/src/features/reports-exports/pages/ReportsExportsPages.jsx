import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, Clock3, Download, FileSpreadsheet, FileText, Save } from 'lucide-react';
import {
  ExportBackendTodoCard,
  ExportErrorPanel,
  ExportFilterBar,
  ExportFormatCard,
  ExportHistoryTable,
  ExportJobDrawer,
  ExportKpiGrid,
  ExportOptionsPanel,
  ExportRequestPanel,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  ReportsExportsHeader,
  ReportsExportsShell,
} from '../components/ReportsExportsComponents';
import {
  useCsvExport,
  useExcelExport,
  useExportHistory,
  useExportJobDetail,
  useExportRequest,
  useExportSchedules,
  useFailedExports,
  usePdfExport,
  useProcessingExports,
  useSavedReports,
} from '../hooks/useReportsExports';
import { defaultDateRange, exportLabel, formatExportDate } from '../utils/reportsExportsFormatters';
import '../styles/reportsExports.css';

function LoadingOrError({ query }) {
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return null;
}

function TodoList({ items = [] }) {
  return <ul className="exports-todo-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

export function CsvExportPage() {
  const navigate = useNavigate();
  const query = useCsvExport();
  const exportRequest = useExportRequest();
  const [requestState, setRequestState] = useState({
    report_group: 'core',
    report_type: 'appointments',
    timezone: 'Asia/Ho_Chi_Minh',
    ...defaultDateRange(),
  });
  const blocked = LoadingOrError({ query });
  if (blocked) return blocked;

  return (
    <ReportsExportsShell>
      <ReportsExportsHeader
        title="Export CSV"
        subtitle="Xuất nhanh dữ liệu báo cáo sang CSV để xử lý bằng Excel hoặc BI tool"
        onRefresh={query.refresh}
        onReset={query.resetFilters}
        onHistory={() => navigate('/reports/exports/history')}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt}
      />
      <ExportKpiGrid summary={query.data?.summary || {}} mode="csv" />
      <div className="exports-main-grid">
        <ExportRequestPanel
          catalog={query.data?.catalog}
          requestState={requestState}
          setRequestState={setRequestState}
          onExport={exportRequest.runExport}
          exportStatus={exportRequest.status}
          exportError={exportRequest.error}
        />
        <ReportSectionCard title="CSV backend đang hỗ trợ" subtitle="Core/pharmacy/audit chỉ dùng format csv/json">
          <div className="exports-format-grid">
            {(query.data?.catalog?.groups || []).map((group) => (
              <ExportFormatCard key={group.key} format="csv" enabled>
                <span>{group.label}</span>
                <small>{group.method} {group.endpoint}</small>
              </ExportFormatCard>
            ))}
          </div>
          <TodoList items={query.data?.backend_todo || []} />
        </ReportSectionCard>
      </div>
      <ReportSectionCard title="Export CSV gần đây" subtitle="Fallback từ audit logs và pharmacy export history">
        <ExportHistoryTable rows={query.data?.recent_exports || []} />
      </ReportSectionCard>
    </ReportsExportsShell>
  );
}

function UnsupportedFormatPage({ title, subtitle, format, hook, icon }) {
  const query = hook();
  const blocked = LoadingOrError({ query });
  if (blocked) return blocked;
  return (
    <ReportsExportsShell>
      <ReportsExportsHeader
        title={title}
        subtitle={subtitle}
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt}
      />
      <ExportKpiGrid summary={query.data?.summary || {}} mode="format" />
      <div className="exports-main-grid">
        <ReportSectionCard title={query.data?.status_card?.title || `${exportLabel(format)} chưa được hỗ trợ`} subtitle="UI đã dựng cấu hình trước, không gọi backend Excel/PDF khi chưa hỗ trợ">
          <ExportFormatCard format={format} enabled={false}>{icon}</ExportFormatCard>
          <div className="exports-endpoint-list">
            {(query.data?.status_card?.supported_endpoints || []).map((endpoint) => <span key={endpoint}>{endpoint}</span>)}
          </div>
        </ReportSectionCard>
        <ExportOptionsPanel data={query.data} format={format} />
      </div>
      <ExportBackendTodoCard
        title="Suggested backend"
        description="Endpoint cần thêm để bật export async enterprise"
        endpoint={query.data?.suggested_endpoint}
        todos={query.data?.backend_todo || []}
      />
    </ReportsExportsShell>
  );
}

export const ExcelExportPage = () => (
  <UnsupportedFormatPage
    title="Export Excel"
    subtitle="Xuất báo cáo dạng Excel nhiều sheet, có filter, freeze header và định dạng nghiệp vụ"
    format="excel"
    hook={useExcelExport}
    icon={<FileSpreadsheet size={18} />}
  />
);

export const PdfExportPage = () => (
  <UnsupportedFormatPage
    title="Export PDF"
    subtitle="Xuất báo cáo PDF chuyên nghiệp để ký duyệt, lưu trữ hoặc gửi định kỳ"
    format="pdf"
    hook={usePdfExport}
    icon={<FileText size={18} />}
  />
);

export function ExportHistoryPage() {
  const query = useExportHistory();
  const drawer = useExportJobDetail();
  const blocked = LoadingOrError({ query });
  if (blocked) return blocked;
  return (
    <ReportsExportsShell>
      <ReportsExportsHeader
        title="Lịch sử export"
        subtitle="Lịch sử xuất báo cáo thống nhất, fallback từ audit logs cho core/audit/records và pharmacy export"
        onRefresh={query.refresh}
        onReset={query.resetFilters}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt}
      />
      <ExportFilterBar filters={query.filters} setFilters={query.setFilters} onReset={query.resetFilters} />
      <ExportKpiGrid summary={query.data?.summary || {}} />
      <ReportSectionCard title="Unified history" subtitle="Bấm một dòng để mở drawer chi tiết export">
        <ExportHistoryTable rows={query.data?.items || []} onOpen={drawer.setItem} />
      </ReportSectionCard>
      <ExportBackendTodoCard title="Backend TODO" description="Cần download center/export job history thật" todos={query.data?.backend_todo || []} />
      <ExportJobDrawer item={drawer.item} onClose={drawer.close} title="Export history detail" />
    </ReportsExportsShell>
  );
}

function EmptyCenter({ data, icon: Icon = AlertTriangle }) {
  return (
    <div className="exports-empty-center">
      <Icon size={34} />
      <h2>{data?.empty_state?.title || 'Chưa có dữ liệu'}</h2>
      <p>{data?.empty_state?.description}</p>
      <TodoList items={data?.backend_todo || []} />
    </div>
  );
}

export function ProcessingExportsPage() {
  const query = useProcessingExports();
  const drawer = useExportJobDetail();
  const blocked = LoadingOrError({ query });
  if (blocked) return blocked;
  return (
    <ReportsExportsShell>
      <ReportsExportsHeader
        title="Export đang xử lý"
        subtitle="Theo dõi export job pending/processing khi backend có report export queue"
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt}
        autoRefresh={query.autoRefresh}
        onToggleAutoRefresh={query.setAutoRefresh}
      />
      <ExportFilterBar filters={query.filters} setFilters={query.setFilters} onReset={query.resetFilters} showAutoRefresh autoRefresh={query.autoRefresh} onToggleAutoRefresh={query.setAutoRefresh} />
      <ExportKpiGrid summary={query.data?.summary || {}} />
      {(query.data?.items || []).length ? (
        <ReportSectionCard title="Processing exports">
          <ExportHistoryTable rows={query.data.items} onOpen={drawer.setItem} />
        </ReportSectionCard>
      ) : <EmptyCenter data={query.data} icon={Clock3} />}
      <ExportJobDrawer item={drawer.item} onClose={drawer.close} title="Processing export detail" />
    </ReportsExportsShell>
  );
}

export function FailedExportsPage() {
  const query = useFailedExports();
  const drawer = useExportJobDetail();
  const blocked = LoadingOrError({ query });
  if (blocked) return blocked;
  return (
    <ReportsExportsShell>
      <ReportsExportsHeader
        title="Export thất bại"
        subtitle="Theo dõi export lỗi, retryable export và lỗi phổ biến khi backend lưu report_export_jobs"
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt}
        autoRefresh={query.autoRefresh}
        onToggleAutoRefresh={query.setAutoRefresh}
      />
      <ExportFilterBar filters={query.filters} setFilters={query.setFilters} onReset={query.resetFilters} showAutoRefresh autoRefresh={query.autoRefresh} onToggleAutoRefresh={query.setAutoRefresh} />
      <ExportKpiGrid summary={query.data?.summary || {}} />
      <ExportErrorPanel error={query.data?.summary?.most_common_error ? `Lỗi gần nhất: ${query.data.summary.most_common_error}` : null} />
      <ReportSectionCard title="Failed exports" subtitle="Hiện fallback từ audit logs severity error/action export">
        <ExportHistoryTable rows={query.data?.items || []} onOpen={drawer.setItem} emptyTitle={query.data?.empty_state?.title || 'Chưa có export thất bại'} />
      </ReportSectionCard>
      <ExportBackendTodoCard title="Backend TODO" description="Cần retry/cancel/error tracking thật" todos={query.data?.backend_todo || []} />
      <ExportJobDrawer item={drawer.item} onClose={drawer.close} title="Failed export detail" />
    </ReportsExportsShell>
  );
}

export function ExportSchedulesPage() {
  const query = useExportSchedules();
  const blocked = LoadingOrError({ query });
  if (blocked) return blocked;
  return (
    <ReportsExportsShell>
      <ReportsExportsHeader title="Lịch gửi định kỳ" subtitle="Tự động xuất và gửi báo cáo theo ngày, tuần, tháng" onRefresh={query.refresh} lastUpdatedAt={query.lastUpdatedAt} />
      <ExportKpiGrid summary={query.data?.summary || {}} />
      <div className="exports-main-grid">
        <ReportSectionCard title="Schedule builder preview" subtitle="Cấu hình trước lịch gửi, thao tác thật bị khóa đến khi có backend">
          <div className="exports-request-grid">
            <label><span>Report group</span><select disabled><option>Core reports</option></select></label>
            <label><span>Report type</span><select disabled><option>revenue</option></select></label>
            <label><span>Format</span><select disabled><option>CSV / Excel / PDF / JSON</option></select></label>
            <label><span>Date range mode</span><select disabled><option>last_7_days</option></select></label>
            <label><span>Frequency</span><select disabled><option>daily / weekly / monthly</option></select></label>
            <label><span>Recipients</span><input disabled value="users, roles, departments" readOnly /></label>
          </div>
          <button type="button" disabled className="exports-disabled-action">Tạo lịch gửi - cần backend</button>
        </ReportSectionCard>
        <EmptyCenter data={query.data} icon={CalendarDays} />
      </div>
    </ReportsExportsShell>
  );
}

export function SavedReportsPage() {
  const query = useSavedReports();
  const blocked = LoadingOrError({ query });
  if (blocked) return blocked;
  return (
    <ReportsExportsShell>
      <ReportsExportsHeader title="Báo cáo đã lưu" subtitle="Quản lý cấu hình báo cáo đã lưu để chạy lại hoặc xuất nhanh" onRefresh={query.refresh} lastUpdatedAt={query.lastUpdatedAt} />
      <ExportKpiGrid summary={query.data?.summary || {}} />
      <div className="exports-main-grid">
        <ReportSectionCard title="Saved report preview" subtitle="Khi có backend sẽ hiển thị report name, owner, visibility, tag, last run/export">
          <div className="exports-saved-preview">
            <Save size={24} />
            <strong>Local draft chỉ nên dùng tạm trên trình duyệt</strong>
            <span>Backend cần `/api/reports/saved` để lưu thật, share, pin, duplicate, schedule và export.</span>
          </div>
          <button type="button" disabled className="exports-disabled-action"><Download size={15} />Export saved report - cần backend</button>
        </ReportSectionCard>
        <EmptyCenter data={query.data} icon={Save} />
      </div>
    </ReportsExportsShell>
  );
}
