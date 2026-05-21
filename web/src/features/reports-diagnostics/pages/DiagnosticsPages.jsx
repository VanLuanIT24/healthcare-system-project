import { useState } from 'react';
import {
  CriticalResultBoard,
  DataErrorStrip,
  DiagnosticOrderTable,
  DiagnosticsDetailDrawer,
  DiagnosticsFilterBar,
  DiagnosticsHealthScore,
  DiagnosticsInsightGrid,
  DiagnosticsKpiGrid,
  DiagnosticsStatusBoard,
  DiagnosticsTrendChart,
  ModalityBreakdownChart,
  ModuleHealthColumns,
  OrderTypeDonut,
  OverdueOrderTable,
  PriorityDonut,
  ReportEmptyState,
  ReportErrorState,
  ReportPendingTable,
  ReportSectionCard,
  ReportSkeleton,
  SlaBoard,
  SpecimenStatusChart,
  TatMetricTable,
  TurnaroundTimeChart,
} from '../components/DiagnosticsComponents';
import {
  useCriticalResultsReport,
  useDiagnosticsOverviewReport,
  useImagingOrdersReport,
  useImagingTurnaroundTimeReport,
  useLabOrdersReport,
  useLabTurnaroundTimeReport,
  useOverdueOrdersReport,
  useProcedureOrdersReport,
  useReportPendingReport,
  useSpecimenReport,
} from '../hooks/useDiagnosticsReports';
import '../styles/reportsDiagnostics.css';

function PageFrame({ query, title, subtitle, exportType, children }) {
  const [drawer, setDrawer] = useState(null);
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <div className="executive-overview-page operation-page finance-page diagnostics-page">
      <DiagnosticsFilterBar
        title={title}
        subtitle={subtitle}
        filters={query.filters}
        onChange={query.setFilters}
        onReset={query.resetFilters}
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt || query.data?.generated_at}
        exportType={exportType}
      />
      <DataErrorStrip errors={query.data?.data_errors} />
      {children(query.data || {}, (item, type = title) => setDrawer({ item, type }), query)}
      <DiagnosticsDetailDrawer item={drawer?.item} type={drawer?.type || title} onClose={() => setDrawer(null)} />
    </div>
  );
}

function TodoPanel({ todos = [] }) {
  if (!todos.length) return null;
  return (
    <ReportSectionCard title="Backend TODO analytics">
      <ul className="diagnostics-todo-list">
        {todos.map((todo) => <li key={todo}>{todo}</li>)}
      </ul>
    </ReportSectionCard>
  );
}

function OverviewCharts({ data, open }) {
  return (
    <>
      <div className="executive-layout">
        <ReportSectionCard title="Order type"><OrderTypeDonut rows={data.charts?.order_type || []} /></ReportSectionCard>
        <ReportSectionCard title="Priority"><PriorityDonut rows={data.charts?.priority || []} /></ReportSectionCard>
        <ReportSectionCard title="SLA board"><SlaBoard rows={data.charts?.sla_board || []} /></ReportSectionCard>
      </div>
      <div className="executive-layout">
        <ReportSectionCard title="Command center"><DiagnosticsStatusBoard data={data} onOpen={open} /></ReportSectionCard>
        <ReportSectionCard title="Module health"><ModuleHealthColumns data={data} /></ReportSectionCard>
      </div>
    </>
  );
}

function StandardDiagnosticsPage({ query, title, subtitle, exportType, tableTitle, tableRows, children }) {
  return (
    <PageFrame query={query} title={title} subtitle={subtitle} exportType={exportType}>
      {(data, open) => (
        <>
          <DiagnosticsKpiGrid cards={data.summary_cards || []} onOpen={open} />
          {children?.(data, open)}
          <ReportSectionCard title={tableTitle}>
            <DiagnosticOrderTable rows={tableRows(data)} onOpen={(item) => open(item, tableTitle)} />
          </ReportSectionCard>
          <div className="executive-layout">
            <ReportSectionCard title="Health score"><DiagnosticsHealthScore rows={data.diagnostics_health || []} /></ReportSectionCard>
            <ReportSectionCard title="Insight"><DiagnosticsInsightGrid insights={data.insights || []} /></ReportSectionCard>
          </div>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function DiagnosticsOverviewPage() {
  const query = useDiagnosticsOverviewReport();
  return (
    <PageFrame query={query} title="Tổng quan cận lâm sàng & thủ thuật" subtitle="Theo dõi realtime Lab, Imaging, Procedure, SLA, kết quả nguy cấp và order quá hạn" exportType="appointments">
      {(data, open) => (
        <>
          <DiagnosticsKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <OverviewCharts data={data} open={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Critical result board"><CriticalResultBoard rows={data.lists?.critical_results || []} onOpen={open} /></ReportSectionCard>
            <ReportSectionCard title="Order quá hạn"><OverdueOrderTable rows={(data.lists?.overdue_orders || []).slice(0, 8)} onOpen={(item) => open(item, 'Order quá hạn')} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Clinical order center">
            <DiagnosticOrderTable rows={data.lists?.clinical_orders || []} onOpen={(item) => open(item, 'Clinical order')} />
          </ReportSectionCard>
          <ReportSectionCard title="Insight"><DiagnosticsInsightGrid insights={data.insights || []} /></ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function LabOrdersPage() {
  const query = useLabOrdersReport();
  return (
    <StandardDiagnosticsPage
      query={query}
      title="Lab orders"
      subtitle="Theo dõi xét nghiệm, lấy mẫu, nhận mẫu, kết quả và SLA lab"
      exportType="appointments"
      tableTitle="Danh sách lab orders"
      tableRows={(data) => data.items || data.lists?.lab_orders || []}
    >
      {(data, open) => (
        <div className="executive-layout">
          <ReportSectionCard title="Lab order status"><SpecimenStatusChart rows={data.charts?.lab_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Priority"><PriorityDonut rows={data.charts?.priority || []} /></ReportSectionCard>
          <ReportSectionCard title="Overdue lab"><OverdueOrderTable rows={(data.lists?.overdue_orders || []).filter((row) => String(row.type).includes('lab')).slice(0, 6)} onOpen={open} /></ReportSectionCard>
        </div>
      )}
    </StandardDiagnosticsPage>
  );
}

export function LabTurnaroundTimePage() {
  const query = useLabTurnaroundTimeReport();
  return (
    <PageFrame query={query} title="Lab turnaround time" subtitle="Đo TAT xét nghiệm theo các mốc ordered, collected, received, testing, result, final" exportType="appointments">
      {(data, open) => (
        <>
          <DiagnosticsKpiGrid cards={data.summary_cards || []} onOpen={open} />
          {data.tat?.insufficient_data ? <ReportEmptyState title="Chưa đủ dữ liệu TAT chi tiết" description="Backend hiện chưa trả đủ timestamp theo từng stage cho một phần lab order/result/specimen." /> : null}
          <div className="executive-layout">
            <ReportSectionCard title="TAT bucket / rows"><TurnaroundTimeChart rows={data.items || []} /></ReportSectionCard>
            <ReportSectionCard title="TAT by priority"><DiagnosticsTrendChart rows={data.tat?.by_priority || []} /></ReportSectionCard>
            <ReportSectionCard title="TAT by department"><DiagnosticsTrendChart rows={data.tat?.by_department || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Chi tiết Lab TAT"><TatMetricTable rows={data.items || []} onOpen={(item) => open(item, 'Lab TAT')} /></ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function SpecimensPage() {
  const query = useSpecimenReport();
  return (
    <StandardDiagnosticsPage
      query={query}
      title="Specimen report"
      subtitle="Quản trị mẫu bệnh phẩm, rejection, recollection, custody và label"
      exportType="appointments"
      tableTitle="Danh sách specimen"
      tableRows={(data) => data.items || data.lists?.specimens || []}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Specimen status"><SpecimenStatusChart rows={data.charts?.specimen_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Rejected alerts"><DiagnosticOrderTable rows={data.raw?.alerts_rejected_specimens?.items || []} /></ReportSectionCard>
        </div>
      )}
    </StandardDiagnosticsPage>
  );
}

export function ImagingOrdersPage() {
  const query = useImagingOrdersReport();
  return (
    <StandardDiagnosticsPage
      query={query}
      title="Imaging orders"
      subtitle="Theo dõi chỉ định chẩn đoán hình ảnh, phòng, thiết bị, radiologist và SLA"
      exportType="appointments"
      tableTitle="Danh sách imaging orders"
      tableRows={(data) => data.items || data.lists?.imaging_orders || []}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Imaging status"><SpecimenStatusChart rows={data.charts?.imaging_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Modality"><ModalityBreakdownChart rows={data.charts?.modality || []} /></ReportSectionCard>
          <ReportSectionCard title="SLA board"><SlaBoard rows={data.charts?.sla_board || []} /></ReportSectionCard>
        </div>
      )}
    </StandardDiagnosticsPage>
  );
}

export function ImagingTurnaroundTimePage() {
  const query = useImagingTurnaroundTimeReport();
  return (
    <PageFrame query={query} title="Imaging turnaround time" subtitle="Đo TAT CĐHA từ ordered đến schedule, arrive, start, complete, report, final và release" exportType="appointments">
      {(data, open) => (
        <>
          <DiagnosticsKpiGrid cards={data.summary_cards || []} onOpen={open} />
          {data.tat?.insufficient_data ? <ReportEmptyState title="Chưa đủ dữ liệu TAT chi tiết" description="Backend hiện chưa trả đủ timestamp theo từng stage cho một phần imaging order/report." /> : null}
          <div className="executive-layout">
            <ReportSectionCard title="Imaging TAT"><TurnaroundTimeChart rows={data.items || []} /></ReportSectionCard>
            <ReportSectionCard title="TAT by modality"><ModalityBreakdownChart rows={data.charts?.modality || []} /></ReportSectionCard>
            <ReportSectionCard title="SLA compliance"><SlaBoard rows={data.charts?.sla_board || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Chi tiết Imaging TAT"><TatMetricTable rows={data.items || []} onOpen={(item) => open(item, 'Imaging TAT')} /></ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function ReportPendingPage() {
  const query = useReportPendingReport();
  return (
    <PageFrame query={query} title="Report pending" subtitle="Worklist report/result chờ nhập, hoàn thiện, ký, finalize, phát hành hoặc correction" exportType="appointments">
      {(data, open) => (
        <>
          <DiagnosticsKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Pending worklist"><DiagnosticsStatusBoard data={data} onOpen={open} /></ReportSectionCard>
            <ReportSectionCard title="Report status"><DiagnosticsTrendChart rows={data.charts?.status || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Danh sách report pending">
            <ReportPendingTable rows={data.items || data.lists?.pending_reports || []} onOpen={(item) => open(item, 'Report pending')} />
          </ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function CriticalResultsPage() {
  const query = useCriticalResultsReport();
  return (
    <PageFrame query={query} title="Critical results" subtitle="Trung tâm kiểm soát kết quả nguy cấp, acknowledge, escalation và SLA critical" exportType="appointments">
      {(data, open) => (
        <>
          <DiagnosticsKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Critical command board"><CriticalResultBoard rows={data.items || data.lists?.critical_results || []} onOpen={open} /></ReportSectionCard>
            <ReportSectionCard title="Severity / type"><DiagnosticsTrendChart rows={data.charts?.priority || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Critical results table">
            <DiagnosticOrderTable rows={data.items || data.lists?.critical_results || []} onOpen={(item) => open(item, 'Critical result')} />
          </ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function ProcedureOrdersPage() {
  const query = useProcedureOrdersReport();
  return (
    <StandardDiagnosticsPage
      query={query}
      title="Procedure orders"
      subtitle="Theo dõi thủ thuật, lịch thực hiện, performer, kết quả, charge, attachment và no-show"
      exportType="appointments"
      tableTitle="Danh sách procedure orders"
      tableRows={(data) => data.items || data.lists?.procedure_orders || []}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Procedure status"><SpecimenStatusChart rows={data.charts?.procedure_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Priority"><PriorityDonut rows={data.charts?.priority || []} /></ReportSectionCard>
          <ReportSectionCard title="Procedure result pending"><DiagnosticOrderTable rows={(data.lists?.procedure_results || []).slice(0, 8)} /></ReportSectionCard>
        </div>
      )}
    </StandardDiagnosticsPage>
  );
}

export function OverdueOrdersPage() {
  const query = useOverdueOrdersReport();
  return (
    <PageFrame query={query} title="Order quá hạn" subtitle="SLA breach board cho Lab, Imaging, Procedure, STAT/urgent và critical overdue" exportType="appointments">
      {(data, open) => (
        <>
          <DiagnosticsKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Overdue buckets"><DiagnosticsTrendChart rows={data.overdue_buckets || data.charts?.overdue_buckets || []} /></ReportSectionCard>
            <ReportSectionCard title="Overdue by type"><OrderTypeDonut rows={data.charts?.order_type || []} /></ReportSectionCard>
            <ReportSectionCard title="SLA board"><SlaBoard rows={data.charts?.sla_board || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Danh sách order quá hạn">
            <OverdueOrderTable rows={data.items || data.lists?.overdue_orders || []} onOpen={(item) => open(item, 'Order quá hạn')} />
          </ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}
