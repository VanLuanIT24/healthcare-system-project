import { useMemo, useState } from 'react';
import {
  DataErrorStrip,
  DepartmentDoctorFilterBar,
  DepartmentKpiGrid,
  DepartmentLoadCards,
  DepartmentPerformanceMatrix,
  DepartmentRankingTable,
  DepartmentStaffTable,
  DoctorKpiGrid,
  DoctorNoShowTable,
  DoctorPerformanceRadar,
  DoctorRankingTable,
  DoctorUtilizationGrid,
  FollowUpBoard,
  InsightPanel,
  OperationTable,
  PersonalReportPanel,
  ReportBreakdownBar,
  ReportDetailDrawer,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  ReportStatusDonut,
  ReportTrendChart,
} from '../components/DepartmentsDoctorsComponents';
import {
  useDepartmentAppointmentsReport,
  useDepartmentLoadReport,
  useDepartmentPerformanceReport,
  useDepartmentQueueReport,
  useDepartmentRevenueReport,
  useDepartmentStaffReport,
  useDoctorNoShowReport,
  useDoctorPerformanceReport,
  useDoctorUtilizationReport,
  useFollowUpReport,
  usePersonalDoctorReport,
} from '../hooks/useDepartmentDoctorReports';
import { formatCurrency, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import '../styles/reportsDepartmentsDoctors.css';

function pageRows(value) {
  return value?.items || [];
}

function minutes(value) {
  return value === null || value === undefined ? '—' : `${formatNumber(value)} phút`;
}

function PageFrame({ query, title, subtitle, exportType, children }) {
  const [drawer, setDrawer] = useState(null);
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <div className="executive-overview-page operation-page departments-doctors-page">
      <DepartmentDoctorFilterBar
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
      <ReportDetailDrawer item={drawer?.item} type={drawer?.type || title} onClose={() => setDrawer(null)} />
    </div>
  );
}

const departmentColumns = [
  { key: 'department_code', label: 'Mã khoa' },
  { key: 'department_name', label: 'Khoa' },
  { key: 'department_type', label: 'Loại' },
  { key: 'doctor_count', label: 'Bác sĩ', render: (row) => formatNumber(row.doctor_count) },
  { key: 'appointment_count', label: 'Lịch hẹn', render: (row) => formatNumber(row.appointment_count) },
  { key: 'completed_appointment_count', label: 'LH hoàn tất', render: (row) => formatNumber(row.completed_appointment_count) },
  { key: 'encounter_count', label: 'Lượt khám', render: (row) => formatNumber(row.encounter_count) },
  { key: 'completed_encounter_count', label: 'LK hoàn tất', render: (row) => formatNumber(row.completed_encounter_count) },
  { key: 'no_show_count', label: 'No-show', render: (row) => formatNumber(row.no_show_count) },
  { key: 'queue_waiting_average', label: 'Chờ TB', render: (row) => minutes(row.queue_waiting_average) },
  { key: 'revenue_amount', label: 'Doanh thu', render: (row) => formatCurrency(row.revenue_amount) },
  { key: 'completion_rate', label: 'Completion', render: (row) => formatPercent(row.completion_rate) },
  { key: 'no_show_rate', label: 'No-show %', render: (row) => formatPercent(row.no_show_rate) },
  { key: 'performance_score', label: 'Score', render: (row) => formatNumber(row.performance_score) },
];

const doctorColumns = [
  { key: 'doctor_code', label: 'Mã BS' },
  { key: 'doctor_name', label: 'Bác sĩ' },
  { key: 'department_name', label: 'Khoa' },
  { key: 'specialty', label: 'Chuyên khoa' },
  { key: 'appointment_count', label: 'Lịch hẹn', render: (row) => formatNumber(row.appointment_count) },
  { key: 'completed_appointment_count', label: 'LH hoàn tất', render: (row) => formatNumber(row.completed_appointment_count) },
  { key: 'no_show_count', label: 'No-show', render: (row) => formatNumber(row.no_show_count) },
  { key: 'encounter_count', label: 'Lượt khám', render: (row) => formatNumber(row.encounter_count) },
  { key: 'completed_encounter_count', label: 'LK hoàn tất', render: (row) => formatNumber(row.completed_encounter_count) },
  { key: 'patient_count', label: 'Bệnh nhân', render: (row) => formatNumber(row.patient_count) },
  { key: 'average_consultation_duration', label: 'Tư vấn TB', render: (row) => minutes(row.average_consultation_duration) },
  { key: 'schedule_utilization', label: 'Utilization', render: (row) => formatPercent(row.schedule_utilization) },
  { key: 'productivity_score', label: 'Score', render: (row) => formatNumber(row.productivity_score) },
];

function TodoPanel({ todos = [] }) {
  if (!todos.length) return null;
  return (
    <ReportSectionCard title="Backend TODO enterprise">
      <ul className="dd-todo-list">
        {todos.map((todo) => <li key={todo}>{todo}</li>)}
      </ul>
    </ReportSectionCard>
  );
}

function DepartmentCharts({ data, revenue = false }) {
  const appointmentByDepartment = data.charts?.appointment_by_department?.length
    ? data.charts.appointment_by_department
    : (data.departments || []).map((row) => ({ label: row.department_name, value: row.appointment_count }));
  const encounterByDepartment = data.charts?.encounter_by_department?.length
    ? data.charts.encounter_by_department
    : (data.departments || []).map((row) => ({ label: row.department_name, value: row.encounter_count }));
  return (
    <div className="executive-layout">
      <ReportSectionCard title="Lịch hẹn theo khoa"><ReportBreakdownBar rows={appointmentByDepartment} /></ReportSectionCard>
      <ReportSectionCard title="Lượt khám theo khoa"><ReportBreakdownBar rows={encounterByDepartment} /></ReportSectionCard>
      <ReportSectionCard title={revenue ? 'Doanh thu theo ngày' : 'Queue wait / trạng thái'}>{revenue ? <ReportTrendChart rows={data.charts?.revenue_by_day || []} series={[{ key: 'amount', label: 'Doanh thu' }, { key: 'value', label: 'Doanh thu' }]} /> : <ReportStatusDonut rows={data.charts?.queue_by_status || []} />}</ReportSectionCard>
    </div>
  );
}

function DoctorCharts({ data }) {
  return (
    <div className="executive-layout">
      <ReportSectionCard title="Top bác sĩ theo hiệu suất"><ReportBreakdownBar rows={data.charts?.performance_by_doctor || []} /></ReportSectionCard>
      <ReportSectionCard title="Utilization theo bác sĩ"><ReportBreakdownBar rows={data.charts?.utilization_by_doctor || []} /></ReportSectionCard>
      <ReportSectionCard title="No-show theo bác sĩ"><ReportBreakdownBar rows={data.charts?.no_show_by_doctor || []} /></ReportSectionCard>
    </div>
  );
}

export function DepartmentPerformancePage() {
  const query = useDepartmentPerformanceReport();
  return (
    <PageFrame query={query} title="Hiệu suất khoa" subtitle="So sánh hiệu suất vận hành, khám bệnh, doanh thu và chất lượng giữa các khoa" exportType="departments">
      {(data, open) => (
        <>
          <DepartmentKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI khoa')} />
          <DepartmentPerformanceMatrix rows={data.departments || []} onOpen={(item) => open(item, 'Khoa')} />
          <DepartmentCharts data={data} />
          <ReportSectionCard title="Ma trận hiệu suất khoa" subtitle="Bấm một dòng để mở drawer chi tiết khoa">
            <OperationTable columns={departmentColumns} rows={data.departments || []} onRowClick={(item) => open(item, 'Khoa')} />
          </ReportSectionCard>
          <ReportSectionCard title="Insight điều hành"><InsightPanel insights={data.insights || []} /></ReportSectionCard>
          <TodoPanel todos={data.backend_todo} />
        </>
      )}
    </PageFrame>
  );
}

export function DepartmentLoadPage() {
  const query = useDepartmentLoadReport();
  return (
    <PageFrame query={query} title="Tải khoa" subtitle="Đánh giá mức tải theo lịch hẹn, lượt khám, queue, bác sĩ và no-show" exportType="departments">
      {(data, open) => (
        <>
          <DepartmentKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI tải khoa')} />
          <DepartmentLoadCards rows={data.departments || []} onOpen={(item) => open(item, 'Tải khoa')} />
          <div className="executive-layout">
            <ReportSectionCard title="Heatmap tải khoa"><DepartmentPerformanceMatrix rows={(data.departments || []).slice(0, 8)} onOpen={(item) => open(item, 'Tải khoa')} /></ReportSectionCard>
            <ReportSectionCard title="Queue waiting theo khoa"><ReportBreakdownBar rows={data.departments?.map((row) => ({ label: row.department_name, value: row.queue_waiting_average })) || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Load matrix"><DepartmentRankingTable rows={data.departments || []} mode="load" onOpen={(item) => open(item, 'Tải khoa')} /></ReportSectionCard>
          <ReportSectionCard title="Khuyến nghị"><InsightPanel insights={data.insights || []} /></ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function DepartmentAppointmentsPage() {
  const query = useDepartmentAppointmentsReport();
  return (
    <PageFrame query={query} title="Lịch hẹn theo khoa" subtitle="Breakdown lịch hẹn, completed, cancelled, no-show và xu hướng theo khoa" exportType="appointments">
      {(data, open) => (
        <>
          <DepartmentKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI lịch hẹn')} />
          <DepartmentCharts data={data} />
          <ReportSectionCard title="Bảng lịch hẹn theo khoa">
            <OperationTable columns={departmentColumns.filter((column) => !['revenue_amount', 'performance_score'].includes(column.key))} rows={data.departments || []} onRowClick={(item) => open(item, 'Lịch hẹn khoa')} />
          </ReportSectionCard>
          <ReportSectionCard title="Danh sách lịch hẹn mẫu">
            <OperationTable rows={pageRows(data.lists?.appointments)} pagination={data.lists?.appointments?.pagination} columns={[
              { key: 'appointment_time', label: 'Giờ hẹn' },
              { key: 'status', label: 'Trạng thái' },
              { key: 'appointment_type', label: 'Loại hẹn' },
              { key: 'source', label: 'Nguồn' },
            ]} onRowClick={(item) => open(item, 'Appointment')} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function DepartmentQueuePage() {
  const query = useDepartmentQueueReport();
  return (
    <PageFrame query={query} title="Queue theo khoa" subtitle="Theo dõi queue pressure, waiting, in-service, peak hour và SLA theo từng khoa" exportType="queue">
      {(data, open) => (
        <>
          <DepartmentKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI queue')} />
          <div className="executive-layout">
            <ReportSectionCard title="Queue status"><ReportStatusDonut rows={data.charts?.queue_by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Queue theo khoa"><ReportBreakdownBar rows={data.charts?.queue_by_department || data.departments || []} /></ReportSectionCard>
            <ReportSectionCard title="Peak hours"><ReportBreakdownBar rows={data.charts?.queue_peak_hours || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Queue pressure theo khoa"><DepartmentRankingTable rows={data.departments || []} mode="load" onOpen={(item) => open(item, 'Queue khoa')} /></ReportSectionCard>
          <ReportSectionCard title="Realtime ticket sample">
            <OperationTable rows={pageRows(data.lists?.queue)} pagination={data.lists?.queue?.pagination} columns={[
              { key: 'queue_number', label: 'Số thứ tự' },
              { key: 'status', label: 'Trạng thái' },
              { key: 'priority', label: 'Ưu tiên' },
              { key: 'waiting_minutes', label: 'Waiting', render: (row) => minutes(row.waiting_minutes) },
            ]} onRowClick={(item) => open(item, 'Queue ticket')} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function DepartmentRevenuePage() {
  const query = useDepartmentRevenueReport();
  return (
    <PageFrame query={query} title="Doanh thu theo khoa" subtitle="Phân tích doanh thu, đóng góp, revenue per doctor và revenue per encounter" exportType="revenue">
      {(data, open) => (
        <>
          <DepartmentKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI doanh thu')} />
          <DepartmentCharts data={data} revenue />
          <ReportSectionCard title="Bảng doanh thu khoa">
            <DepartmentRankingTable rows={data.departments || []} mode="revenue" onOpen={(item) => open(item, 'Doanh thu khoa')} />
          </ReportSectionCard>
          <ReportSectionCard title="Insight tài chính theo khoa"><InsightPanel insights={data.insights || []} /></ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function DepartmentStaffPage() {
  const query = useDepartmentStaffReport();
  return (
    <PageFrame query={query} title="Nhân sự theo khoa" subtitle="Theo dõi trưởng khoa, staff count, doctor count và workload theo khoa" exportType="departments">
      {(data, open) => (
        <>
          <DepartmentKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI nhân sự')} />
          <ReportSectionCard title="Nhân sự và workload theo khoa">
            <DepartmentStaffTable rows={data.departments || []} onOpen={(item) => open(item, 'Nhân sự khoa')} />
          </ReportSectionCard>
          <ReportSectionCard title="Khuyến nghị phân bổ nhân sự"><InsightPanel insights={data.insights || []} /></ReportSectionCard>
          <TodoPanel todos={data.backend_todo} />
        </>
      )}
    </PageFrame>
  );
}

export function DoctorPerformancePage() {
  const query = useDoctorPerformanceReport();
  const bestDoctor = useMemo(() => [...(query.data?.doctors || [])].sort((a, b) => safeNumber(b.productivity_score) - safeNumber(a.productivity_score))[0], [query.data]);
  return (
    <PageFrame query={query} title="Hiệu suất bác sĩ" subtitle="Ranking năng suất, lượt khám, bệnh nhân, thời lượng tư vấn và utilization" exportType="doctors">
      {(data, open) => (
        <>
          <DoctorKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI bác sĩ')} />
          <div className="executive-layout">
            <ReportSectionCard title="Bác sĩ nổi bật"><DoctorPerformanceRadar doctor={bestDoctor || data.doctors?.[0]} /></ReportSectionCard>
            <ReportSectionCard title="Top productivity"><ReportBreakdownBar rows={data.charts?.performance_by_doctor || []} /></ReportSectionCard>
            <ReportSectionCard title="Utilization"><ReportBreakdownBar rows={data.charts?.utilization_by_doctor || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Doctor ranking table"><DoctorRankingTable rows={data.doctors || []} onOpen={(item) => open(item, 'Bác sĩ')} /></ReportSectionCard>
          <DoctorCharts data={data} />
        </>
      )}
    </PageFrame>
  );
}

export function DoctorUtilizationPage() {
  const query = useDoctorUtilizationReport();
  return (
    <PageFrame query={query} title="Utilization bác sĩ" subtitle="Slot đã đặt, slot trống, utilization bucket và khuyến nghị tối ưu lịch làm việc" exportType="doctors">
      {(data, open) => (
        <>
          <DoctorKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI utilization')} />
          <DoctorUtilizationGrid rows={data.doctors || []} onOpen={(item) => open(item, 'Utilization bác sĩ')} />
          <DoctorCharts data={data} />
          <ReportSectionCard title="Utilization table"><OperationTable columns={doctorColumns} rows={data.doctors || []} onRowClick={(item) => open(item, 'Bác sĩ')} /></ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function DoctorNoShowPage() {
  const query = useDoctorNoShowReport();
  return (
    <PageFrame query={query} title="No-show theo bác sĩ" subtitle="Theo dõi tỷ lệ no-show, cancellation risk và danh sách lịch cần chăm sóc lại" exportType="appointments">
      {(data, open) => (
        <>
          <DoctorKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI no-show')} />
          <DoctorCharts data={data} />
          <ReportSectionCard title="No-show ranking"><DoctorNoShowTable rows={data.doctors || []} onOpen={(item) => open(item, 'No-show bác sĩ')} /></ReportSectionCard>
          <ReportSectionCard title="No-show appointments sample">
            <OperationTable rows={pageRows(data.lists?.appointments)} pagination={data.lists?.appointments?.pagination} columns={[
              { key: 'appointment_time', label: 'Giờ hẹn' },
              { key: 'status', label: 'Trạng thái' },
              { key: 'appointment_type', label: 'Loại hẹn' },
            ]} onRowClick={(item) => open(item, 'Appointment no-show')} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function FollowUpPage() {
  const query = useFollowUpReport();
  return (
    <PageFrame query={query} title="Follow-up" subtitle="Theo dõi tái khám cần đặt lịch, đã đặt lịch, đến hạn hôm nay và quá hạn" exportType="follow-up">
      {(data) => (
        <>
          <DoctorKpiGrid cards={data.summary_cards || []} />
          <FollowUpBoard followUp={data.follow_up} />
          {!data.follow_up?.items?.length ? (
            <ReportSectionCard title="Dữ liệu follow-up">
              <ReportEmptyState title={data.follow_up?.empty_reason || 'Backend chưa có dữ liệu follow-up chuyên biệt.'} />
            </ReportSectionCard>
          ) : null}
          <ReportSectionCard title="TODO backend follow-up">
            <ul className="dd-todo-list">
              <li>GET /api/reports/departments-doctors/follow-up cần trả summary, items, by_department, by_doctor, by_status, by_due_date.</li>
              <li>Không mock cứng dữ liệu follow-up khi backend chưa có model chuyên biệt.</li>
            </ul>
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function PersonalReportPage() {
  const query = usePersonalDoctorReport();
  return (
    <PageFrame query={query} title="Báo cáo cá nhân" subtitle="Dashboard cá nhân của bác sĩ: lịch, lượt khám, queue, slot và no-show" exportType="doctors">
      {(data, open) => (
        <>
          <DoctorKpiGrid cards={data.summary_cards || []} onOpen={(item) => open(item, 'KPI cá nhân')} />
          <PersonalReportPanel doctor={data.personal_doctor} data={data} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Appointment trend"><ReportTrendChart rows={data.charts?.appointment_by_day || []} series={[{ key: 'count', label: 'Lịch hẹn' }, { key: 'value', label: 'Lịch hẹn' }]} /></ReportSectionCard>
            <ReportSectionCard title="Encounter trend"><ReportTrendChart rows={data.charts?.encounter_by_day || []} series={[{ key: 'count', label: 'Lượt khám' }, { key: 'value', label: 'Lượt khám' }]} /></ReportSectionCard>
            <ReportSectionCard title="Completed vs no-show"><ReportStatusDonut rows={[
              { label: 'Completed appointment', value: data.personal_doctor?.completed_appointment_count },
              { label: 'No-show', value: data.personal_doctor?.no_show_count },
            ]} /></ReportSectionCard>
          </div>
        </>
      )}
    </PageFrame>
  );
}
