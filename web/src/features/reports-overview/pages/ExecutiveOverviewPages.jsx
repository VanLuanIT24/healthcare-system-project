import {
  ActionItemBoard,
  AnomalyAlertTable,
  buildKpiGroups,
  ComparisonTable,
  DataErrorStrip,
  DepartmentRankingTable,
  DoctorRankingTable,
  DrilldownKpiGrid,
  ExecutiveFilterBar,
  FinanceMiniTable,
  HealthScoreCard,
  KpiDetailTable,
  PeakHourHeatmap,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
} from '../components/ExecutiveOverviewComponents';
import {
  useActionItems,
  useAnomalyAlerts,
  useComparison,
  useExecutiveDashboard,
  useKpiPeriod,
  useKpiToday,
  useTrends,
} from '../hooks/useExecutiveOverview';
import '../styles/reportsOverview.css';

function PageFrame({ query, title, subtitle, exportType = 'appointments', children, showPeriod = true }) {
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <div className="executive-overview-page">
      <ExecutiveFilterBar
        title={title}
        subtitle={subtitle}
        filters={query.filters}
        onChange={query.setFilters}
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt || query.data?.generated_at}
        exportType={exportType}
        showPeriod={showPeriod}
      />
      <DataErrorStrip errors={query.data?.data_errors} />
      {children(query.data || {})}
    </div>
  );
}

function HealthPanel({ data }) {
  return (
    <div className="executive-health-grid">
      <HealthScoreCard title="Queue health" health={data.queue_health} />
      <HealthScoreCard title="Clinical ops" health={data.clinical_ops_health} />
      <HealthScoreCard title="Finance" health={data.finance_health} />
      <HealthScoreCard title="Inventory" health={data.inventory_health} />
      <HealthScoreCard title="Security/System" health={data.security_health} />
    </div>
  );
}

function MainDashboard({ data }) {
  const raw = data.raw || {};
  return (
    <>
      <DrilldownKpiGrid cards={data.summary_cards || []} />
      <div className="executive-layout executive-layout--wide">
        <ReportSectionCard title="Hoạt động theo ngày" subtitle="Appointments, encounters và doanh thu theo kỳ lọc">
          <TrendChart
            data={data.trends || []}
            series={[
              { key: 'appointments', label: 'Lịch hẹn' },
              { key: 'encounters', label: 'Encounter' },
              { key: 'revenue', label: 'Doanh thu' },
            ]}
          />
        </ReportSectionCard>
        <ReportSectionCard title="Trạng thái lịch hẹn">
          <TrendChart data={raw.appointments?.breakdowns?.by_status || []} type="donut" />
        </ReportSectionCard>
      </div>
      <div className="executive-layout">
        <ReportSectionCard title="Trạng thái queue">
          <TrendChart data={raw.queue?.breakdowns?.by_status || []} type="donut" />
        </ReportSectionCard>
        <ReportSectionCard title="Doanh thu theo khoa">
          <TrendChart data={(raw.revenue?.breakdowns?.by_department || data.department_ranking || []).map((row) => ({ ...row, value: row.amount || row.value || row.count }))} type="bar" />
        </ReportSectionCard>
        <ReportSectionCard title="Top khoa tải cao">
          <DepartmentRankingTable rows={data.department_ranking || []} />
        </ReportSectionCard>
      </div>
      <div className="executive-layout">
        <ReportSectionCard title="Operational health">
          <HealthPanel data={data} />
        </ReportSectionCard>
        <ReportSectionCard title="Ranking bác sĩ">
          <DoctorRankingTable rows={data.doctor_ranking || []} />
        </ReportSectionCard>
        <ReportSectionCard title="Alert center" className="executive-section-card--danger">
          <AnomalyAlertTable items={(data.anomaly_alerts || []).slice(0, 5)} />
        </ReportSectionCard>
      </div>
      <ReportSectionCard title="Việc cần xử lý" subtitle="Gom từ overdue orders, critical alerts, pending approvals, failed notification và ticket hỗ trợ">
        <ActionItemBoard items={data.action_items || []} />
      </ReportSectionCard>
    </>
  );
}

export function ExecutiveDashboardPage() {
  const query = useExecutiveDashboard();
  return (
    <PageFrame
      query={query}
      title="Tổng quan điều hành"
      subtitle="Tình hình vận hành bệnh viện theo thời gian thực"
      exportType="appointments"
    >
      {(data) => <MainDashboard data={data} />}
    </PageFrame>
  );
}

export function KpiTodayPage() {
  const query = useKpiToday();
  return (
    <PageFrame query={query} title="KPI hôm nay" subtitle="Theo dõi vận hành, queue, encounter, tài chính, kho và chất lượng trong ngày" exportType="appointments">
      {(data) => (
        <>
          <DrilldownKpiGrid cards={data.summary_cards || []} />
          <div className="executive-kpi-groups">
            {buildKpiGroups(data.kpis).map((group) => (
              <ReportSectionCard key={group.title} title={group.title}>
                <div className="executive-metric-list">
                  {group.items.map((item) => (
                    <span key={item.label} className={`status-${item.status || 'neutral'}`}>
                      <strong>{item.label}</strong>
                      <em>{item.unit === 'currency' ? item.value?.toLocaleString?.('vi-VN') : item.value ?? 0}</em>
                    </span>
                  ))}
                </div>
              </ReportSectionCard>
            ))}
          </div>
          <ReportSectionCard title="Bảng chi tiết KPI" subtitle="Target hiện ghi Chưa cấu hình cho đến khi backend có KPI target service">
            <KpiDetailTable groups={buildKpiGroups(data.kpis)} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function KpiPeriodPage() {
  const query = useKpiPeriod();
  const raw = query.data?.raw || {};
  return (
    <PageFrame query={query} title="KPI tuần / tháng" subtitle="Tổng hợp KPI theo tuần, tháng, quý hoặc custom range" exportType="encounters">
      {(data) => (
        <>
          <DrilldownKpiGrid cards={data.summary_cards || []} />
          <div className="executive-layout executive-layout--wide">
            <ReportSectionCard title="KPI theo ngày trong kỳ">
              <TrendChart
                data={data.trends || []}
                series={[
                  { key: 'appointments', label: 'Lịch hẹn' },
                  { key: 'encounters', label: 'Encounter' },
                  { key: 'revenue', label: 'Doanh thu' },
                ]}
              />
            </ReportSectionCard>
            <ReportSectionCard title="Peak hours">
              <PeakHourHeatmap rows={raw.queue?.breakdowns?.peak_hours || []} />
            </ReportSectionCard>
          </div>
          <div className="executive-layout">
            <ReportSectionCard title="KPI theo khoa">
              <DepartmentRankingTable rows={data.department_ranking || []} />
            </ReportSectionCard>
            <ReportSectionCard title="KPI theo bác sĩ">
              <DoctorRankingTable rows={data.doctor_ranking || []} />
            </ReportSectionCard>
            <ReportSectionCard title="Payment method">
              <FinanceMiniTable revenue={raw.revenue || {}} />
            </ReportSectionCard>
          </div>
          <ReportSectionCard title="Inventory movement">
            <TrendChart data={raw.inventory?.breakdowns?.transactions_by_type || raw.inventory?.breakdowns?.transactions_by_direction || []} type="bar" />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function ComparisonPage() {
  const query = useComparison();
  return (
    <PageFrame query={query} title="So sánh kỳ trước" subtitle="Tự tính current period và previous period ở backend aggregate" exportType="appointments">
      {(data) => (
        <>
          <div className="executive-comparison-grid">
            {Object.entries(data.metrics || {}).map(([key, value]) => (
              <div key={key} className={`executive-comparison-card status-${value.status}`}>
                <span>{key}</span>
                <strong>{value.current}</strong>
                <em>{value.change_percent === null ? 'N/A' : `${value.change_percent}%`}</em>
              </div>
            ))}
          </div>
          <ReportSectionCard title="Current vs previous">
            <TrendChart
              data={Object.entries(data.metrics || {}).map(([label, value]) => ({ label, current: value.current, previous: value.previous, value: Math.max(value.current, value.previous) }))}
              type="bar"
            />
          </ReportSectionCard>
          <ReportSectionCard title="Bảng so sánh chi tiết" subtitle="No-show, waiting time, outstanding, low stock và critical alerts tăng được đánh dấu bất lợi">
            <ComparisonTable metrics={data.metrics || {}} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function AnomalyAlertsPage() {
  const query = useAnomalyAlerts();
  return (
    <PageFrame query={query} title="Cảnh báo bất thường" subtitle="Rule-based anomaly board cho vận hành, tài chính, queue, tồn kho, critical results và audit" exportType="queue">
      {(data) => (
        <>
          <DrilldownKpiGrid cards={data.summary_cards || []} />
          <ReportSectionCard title="Severity board">
            <AnomalyAlertTable items={data.anomaly_alerts || []} />
          </ReportSectionCard>
          <ReportSectionCard title="Raw alerts từ backend">
            <div className="executive-alert-raw-grid">
              {Object.entries(data.raw_alerts || {}).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}</strong>
                  <span>{value?.summary?.total ?? value?.pagination?.total ?? value?.items?.length ?? 0}</span>
                </div>
              ))}
            </div>
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function TrendsPage() {
  const query = useTrends();
  const raw = query.data?.raw || {};
  return (
    <PageFrame query={query} title="Xu hướng chính" subtitle="Trend 7/30 ngày, peak hour, top khoa tăng tải và insight vận hành" exportType="revenue">
      {(data) => (
        <>
          <DrilldownKpiGrid cards={data.summary_cards || []} />
          <ReportSectionCard title="Trend nhiều series">
            <TrendChart
              data={data.trends || []}
              series={[
                { key: 'appointments', label: 'Lịch hẹn' },
                { key: 'encounters', label: 'Encounter' },
                { key: 'revenue', label: 'Doanh thu' },
              ]}
            />
          </ReportSectionCard>
          <div className="executive-layout">
            <ReportSectionCard title="Top khoa">
              <TrendChart data={(data.department_ranking || []).map((row) => ({ ...row, value: row.value || row.count }))} type="bar" />
            </ReportSectionCard>
            <ReportSectionCard title="Top bác sĩ">
              <DoctorRankingTable rows={data.doctor_ranking || []} />
            </ReportSectionCard>
            <ReportSectionCard title="Peak hours">
              <PeakHourHeatmap rows={raw.queue?.breakdowns?.peak_hours || []} />
            </ReportSectionCard>
          </div>
          <ReportSectionCard title="Insight panel">
            <div className="executive-insights">
              {(data.anomaly_alerts || []).slice(0, 6).map((item) => <span key={`${item.module}-${item.metric}`}>{item.title}: {item.suggested_action}</span>)}
              {!(data.anomaly_alerts || []).length ? <span>Chưa có insight bất thường trong kỳ lọc.</span> : null}
            </div>
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function ActionItemsPage() {
  const query = useActionItems();
  return (
    <PageFrame query={query} title="Việc cần chú ý" subtitle="Kanban điều hành gom critical results, overdue orders, pending approvals, failed notifications và support tickets" exportType="inventory">
      {(data) => (
        <ReportSectionCard title="Action item board" subtitle="Sắp xếp theo mức ưu tiên và SLA gần nhất">
          <ActionItemBoard items={data.action_items || []} groups={data.groups} />
        </ReportSectionCard>
      )}
    </PageFrame>
  );
}
