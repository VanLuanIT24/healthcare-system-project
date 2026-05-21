import { useState } from 'react';
import {
  AdmissionTable,
  BedOccupancyGrid,
  BedStatusDonut,
  BedTurnoverTable,
  CriticalStrip,
  DataErrorStrip,
  DischargeReadinessPanel,
  EmergencyCaseTable,
  EmergencyDispatchBoard,
  EmergencySlaBoard,
  EmergencyTriageQueue,
  IeInsightList,
  InpatientEmergencyDetailDrawer,
  InpatientEmergencyFilterBar,
  InpatientEmergencyKpiGrid,
  InpatientEmergencyTable,
  InpatientTaskBoard,
  LengthOfStayChart,
  MedicationDuePanel,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
  summaryCards,
} from '../components/InpatientEmergencyComponents';
import {
  useAdmissionReport,
  useBedOccupancyReport,
  useBedTurnoverReport,
  useCaseResolutionReport,
  useDischargeReport,
  useEmergencyCaseReport,
  useEmergencyResponseTimeReport,
  useInpatientTaskReport,
  useLengthOfStayReport,
} from '../hooks/useInpatientEmergencyReports';
import { formatDateTime, formatNumber, formatPercent } from '../../reports-overview/utils/formatters';
import '../styles/reportsInpatientEmergency.css';

function chartRows(rows = [], keys = ['label', 'status', 'department_name', 'priority', 'source', 'date', 'bucket']) {
  return (rows || []).map((row) => {
    const key = keys.find((item) => row?.[item] !== undefined && row?.[item] !== null);
    return { ...row, label: row.label || row[key] || 'Chưa rõ', value: row.value ?? row.count ?? row.average_los_days ?? row.occupancy_rate };
  });
}

function PageFrame({ query, title, subtitle, children }) {
  const [drawer, setDrawer] = useState(null);
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <div className="executive-overview-page operation-page finance-page ie-page">
      <InpatientEmergencyFilterBar
        title={title}
        subtitle={subtitle}
        filters={query.filters}
        onChange={query.setFilters}
        onReset={query.resetFilters}
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt || query.data?.generated_at}
      />
      <DataErrorStrip errors={query.data?.data_errors} />
      {children(query.data || {}, (item, type = title) => setDrawer({ item, type }), query)}
      <InpatientEmergencyDetailDrawer item={drawer?.item} type={drawer?.type || title} onClose={() => setDrawer(null)} />
    </div>
  );
}

function TodoPanel({ todos = [] }) {
  if (!todos.length) return null;
  return (
    <ReportSectionCard title="Backend TODO analytics">
      <ul className="ie-todo-list">{todos.map((todo) => <li key={todo}>{todo}</li>)}</ul>
    </ReportSectionCard>
  );
}

function StandardPage({ query, title, subtitle, labels, tableTitle, table, children }) {
  return (
    <PageFrame query={query} title={title} subtitle={subtitle}>
      {(data, open) => (
        <>
          <InpatientEmergencyKpiGrid cards={summaryCards(data.summary || {}, labels)} onOpen={open} />
          {children?.(data, open)}
          <ReportSectionCard title={tableTitle}>{table(data, open)}</ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function AdmissionsPage() {
  const query = useAdmissionReport();
  return (
    <StandardPage
      query={query}
      title="Admission"
      subtitle="Theo dõi nhập viện, bệnh nhân đang nằm, phân bổ giường và rủi ro nội trú"
      labels={{
        total_admissions: 'Tổng admission',
        planned_count: 'Planned',
        admitted_count: 'Admitted',
        transferred_count: 'Transferred',
        discharged_count: 'Discharged',
        cancelled_count: 'Cancelled',
        active_admissions: 'Active admissions',
        pending_bed_assignment: 'Pending bed assignment',
        high_risk_patients: 'High risk patients',
        abnormal_vitals: 'Abnormal vitals',
        planned_discharge_today: 'Planned discharge today',
        total_inpatient_charges: 'Tổng charge nội trú',
      }}
      tableTitle="Danh sách admission"
      table={(data, open) => <AdmissionTable rows={data.items || []} onOpen={(item) => open(item, 'Admission')} />}
    >
      {(data) => (
        <>
          {data.summary?.high_risk_patients ? <CriticalStrip>Có {formatNumber(data.summary.high_risk_patients)} bệnh nhân nội trú rủi ro cao cần theo dõi.</CriticalStrip> : null}
          <div className="executive-layout">
            <ReportSectionCard title="Admission trend"><TrendChart data={chartRows(data.charts?.admission_by_day || [], ['date'])} /></ReportSectionCard>
            <ReportSectionCard title="Admission by status"><BedStatusDonut rows={data.charts?.by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Admission by department"><TrendChart data={chartRows(data.charts?.by_department || [], ['department_name'])} /></ReportSectionCard>
          </div>
        </>
      )}
    </StandardPage>
  );
}

export function DischargesPage() {
  const query = useDischargeReport();
  return (
    <StandardPage
      query={query}
      title="Discharge"
      subtitle="Theo dõi xuất viện, readiness, blocker, discharge delay và giải phóng giường"
      labels={{
        total_discharge_scope: 'Tổng discharge scope',
        planned_discharge_today: 'Planned today',
        discharged_today: 'Discharged today',
        discharge_pending: 'Pending',
        discharge_delayed: 'Delayed',
        ready_for_discharge: 'Ready',
        not_ready: 'Not ready',
        readiness_blocker_count: 'Readiness blockers',
        pending_charge_before_discharge: 'Pending charge',
      }}
      tableTitle="Danh sách discharge"
      table={(data, open) => <AdmissionTable rows={data.items || []} onOpen={(item) => open(item, 'Discharge readiness')} />}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Readiness panel"><DischargeReadinessPanel rows={data.items || []} /></ReportSectionCard>
          <ReportSectionCard title="Discharge by day"><TrendChart data={chartRows(data.charts?.discharge_by_day || [], ['date'])} /></ReportSectionCard>
          <ReportSectionCard title="Readiness status"><BedStatusDonut rows={data.charts?.readiness_status || []} /></ReportSectionCard>
        </div>
      )}
    </StandardPage>
  );
}

export function BedOccupancyPage() {
  const query = useBedOccupancyReport();
  return (
    <StandardPage
      query={query}
      title="Bed occupancy"
      subtitle="Công suất giường theo ward map, khoa/phòng, trạng thái giường và shortage"
      labels={{
        total_beds: 'Total beds',
        occupied_beds: 'Occupied',
        available_beds: 'Available',
        reserved_beds: 'Reserved',
        maintenance_beds: 'Maintenance',
        blocked_beds: 'Blocked',
        inactive_beds: 'Inactive',
        occupancy_rate: 'Occupancy rate',
        available_rate: 'Available rate',
        critical_bed_shortage: 'Critical shortage',
      }}
      tableTitle="Danh sách giường"
      table={(data, open) => (
        <InpatientEmergencyTable rows={data.items || []} onRowClick={(item) => open(item, 'Bed')} columns={[
          { key: 'department_name', label: 'Khoa' },
          { key: 'room_name', label: 'Phòng' },
          { key: 'bed_code', label: 'Giường' },
          { key: 'bed_type', label: 'Loại' },
          { key: 'status', label: 'Trạng thái', render: (row) => row.status },
          { key: 'patient_name', label: 'Bệnh nhân' },
          { key: 'admission_no', label: 'Admission' },
          { key: 'los_days', label: 'LOS', render: (row) => formatNumber(row.los_days) },
          { key: 'attending_doctor_name', label: 'Bác sĩ' },
          { key: 'assigned_from', label: 'Gán lúc', render: (row) => formatDateTime(row.assigned_from) },
        ]} />
      )}
    >
      {(data, open) => (
        <>
          <ReportSectionCard title="Ward map"><BedOccupancyGrid rows={data.ward_map || data.items || []} onOpen={open} /></ReportSectionCard>
          <div className="executive-layout">
            <ReportSectionCard title="Bed status"><BedStatusDonut rows={data.charts?.bed_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Occupancy by department"><TrendChart data={chartRows(data.charts?.occupancy_by_department || [], ['department_name'])} /></ReportSectionCard>
            <ReportSectionCard title="Occupancy by room type"><TrendChart data={chartRows(data.charts?.occupancy_by_room_type || [], ['room_type'])} /></ReportSectionCard>
          </div>
        </>
      )}
    </StandardPage>
  );
}

export function BedTurnoverPage() {
  const query = useBedTurnoverReport();
  return (
    <StandardPage
      query={query}
      title="Bed turnover"
      subtitle="Vòng quay giường, transfer/release, thời gian nằm theo giường và điểm turnover"
      labels={{
        bed_assignment_count: 'Assignment count',
        transfer_count: 'Transfer count',
        release_count: 'Release count',
        cancelled_assignment_count: 'Cancelled assignment',
        average_bed_stay_hours: 'Avg bed stay hours',
        same_day_reuse_count: 'Same-day reuse',
        turnover_rate: 'Turnover rate',
        bed_blocked_after_discharge: 'Blocked after discharge',
      }}
      tableTitle="Bed turnover table"
      table={(data, open) => <BedTurnoverTable rows={data.items || []} onOpen={(item) => open(item, 'Bed turnover')} />}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Turnover by day"><TrendChart data={chartRows(data.charts?.turnover_by_day || [], ['date'])} /></ReportSectionCard>
          <ReportSectionCard title="Transfers by department"><TrendChart data={chartRows(data.charts?.transfer_by_department || [], ['department_name'])} /></ReportSectionCard>
          <ReportSectionCard title="Release by department"><TrendChart data={chartRows(data.charts?.release_by_department || [], ['department_name'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPage>
  );
}

export function LengthOfStayPage() {
  const query = useLengthOfStayReport();
  return (
    <StandardPage
      query={query}
      title="Length of stay"
      subtitle="LOS trung bình, median, p90, long-stay và discharge missed theo khoa/bác sĩ"
      labels={{
        average_los_days: 'Average LOS',
        median_los_days: 'Median LOS',
        p90_los_days: 'P90 LOS',
        current_longest_stay_days: 'Longest stay',
        long_stay_patients: 'Long stay patients',
        los_over_3_days: 'LOS > 3 days',
        los_over_7_days: 'LOS > 7 days',
        los_over_14_days: 'LOS > 14 days',
        expected_discharge_missed: 'Expected missed',
      }}
      tableTitle="LOS patient list"
      table={(data, open) => <AdmissionTable rows={data.items || []} onOpen={(item) => open(item, 'Length of stay')} />}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="LOS distribution"><LengthOfStayChart rows={data.charts?.los_distribution || []} /></ReportSectionCard>
          <ReportSectionCard title="LOS by department"><LengthOfStayChart rows={data.charts?.los_by_department || []} /></ReportSectionCard>
          <ReportSectionCard title="LOS by doctor"><LengthOfStayChart rows={data.charts?.los_by_doctor || []} /></ReportSectionCard>
        </div>
      )}
    </StandardPage>
  );
}

export function InpatientTasksPage() {
  const query = useInpatientTaskReport();
  return (
    <StandardPage
      query={query}
      title="Inpatient task"
      subtitle="Task điều dưỡng, medication due/overdue, handover pending và workload nội trú"
      labels={{
        total_tasks: 'Total tasks',
        todo_count: 'Todo',
        in_progress_count: 'In progress',
        done_count: 'Done',
        cancelled_count: 'Cancelled',
        overdue_tasks: 'Overdue',
        open_tasks: 'Open tasks',
        assigned_tasks: 'Assigned',
        unassigned_tasks: 'Unassigned',
        medication_due_now: 'Medication due',
        medication_overdue: 'Medication overdue',
        handover_pending: 'Handover pending',
      }}
      tableTitle="Task detail"
      table={(data, open) => (
        <InpatientEmergencyTable rows={data.items || []} onRowClick={(item) => open(item, 'Task')} columns={[
          { key: 'task_code', label: 'Task code' },
          { key: 'title', label: 'Title' },
          { key: 'patient_name', label: 'Patient' },
          { key: 'assignee_name', label: 'Assignee' },
          { key: 'priority', label: 'Priority' },
          { key: 'status', label: 'Status' },
          { key: 'due_at', label: 'Due at', render: (row) => formatDateTime(row.due_at) },
          { key: 'overdue_minutes', label: 'Overdue phút', render: (row) => formatNumber(row.overdue_minutes) },
          { key: 'completed_at', label: 'Completed', render: (row) => formatDateTime(row.completed_at) },
        ]} />
      )}
    >
      {(data, open) => (
        <>
          <ReportSectionCard title="Task board"><InpatientTaskBoard rows={data.items || []} onOpen={open} /></ReportSectionCard>
          <div className="executive-layout">
            <ReportSectionCard title="Task by status"><BedStatusDonut rows={data.charts?.task_by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Medication panel"><MedicationDuePanel rows={data.medication_items || []} onOpen={open} /></ReportSectionCard>
            <ReportSectionCard title="Handover status"><BedStatusDonut rows={data.charts?.handover_status || []} /></ReportSectionCard>
          </div>
        </>
      )}
    </StandardPage>
  );
}

export function EmergencyCasesPage() {
  const query = useEmergencyCaseReport();
  return (
    <StandardPage
      query={query}
      title="Emergency cases"
      subtitle="Command board ca cấp cứu, triage, dispatch, escalation và risk snapshot"
      labels={{
        open_cases: 'Open cases',
        critical_count: 'Critical',
        urgent_count: 'Urgent',
        unassigned_count: 'Unassigned',
        acknowledged_count: 'Acknowledged',
        triaged_count: 'Triaged',
        dispatched_count: 'Dispatched',
        resolved_count: 'Resolved',
        cancelled_count: 'Cancelled',
        false_alarm_count: 'False alarm',
        patient_sos_count: 'Patient SOS',
        escalated_count: 'Escalated',
        severe_allergy_risk: 'Severe allergy',
      }}
      tableTitle="Emergency cases"
      table={(data, open) => <EmergencyCaseTable rows={data.items || []} onOpen={(item) => open(item, 'Emergency case')} />}
    >
      {(data, open) => (
        <>
          <div className="executive-layout">
            <ReportSectionCard title="Triage queue"><EmergencyTriageQueue rows={data.items || []} onOpen={open} /></ReportSectionCard>
            <ReportSectionCard title="Dispatch board"><EmergencyDispatchBoard rows={data.items || []} onOpen={open} /></ReportSectionCard>
          </div>
          <div className="executive-layout">
            <ReportSectionCard title="By priority"><BedStatusDonut rows={data.charts?.cases_by_priority || []} /></ReportSectionCard>
            <ReportSectionCard title="By status"><BedStatusDonut rows={data.charts?.cases_by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="By department"><TrendChart data={chartRows(data.charts?.cases_by_department || [], ['department_name'])} /></ReportSectionCard>
          </div>
        </>
      )}
    </StandardPage>
  );
}

export function ResponseTimePage() {
  const query = useEmergencyResponseTimeReport();
  return (
    <StandardPage
      query={query}
      title="Response time"
      subtitle="SLA acknowledge, triage, dispatch, resolve, p90 và breach theo khoa/priority"
      labels={{
        median_acknowledge_seconds: 'Median acknowledge',
        avg_acknowledge_seconds: 'Avg acknowledge',
        p90_acknowledge_seconds: 'P90 acknowledge',
        median_triage_seconds: 'Median triage',
        median_dispatch_seconds: 'Median dispatch',
        median_resolve_seconds: 'Median resolve',
        sla_compliance_percent: 'SLA compliance',
        sla_breached: 'SLA breached',
        sla_at_risk: 'SLA at risk',
        escalated: 'Escalated',
        critical_breached: 'Critical breached',
      }}
      tableTitle="Emergency SLA table"
      table={(data, open) => <EmergencyCaseTable rows={data.items || []} onOpen={(item) => open(item, 'Response time')} />}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="SLA status"><EmergencySlaBoard rows={data.charts?.sla_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Response by priority"><TrendChart data={chartRows(data.charts?.response_by_priority || [], ['priority'])} /></ReportSectionCard>
          <ReportSectionCard title="Breach by department"><TrendChart data={chartRows(data.charts?.breach_by_department || [], ['department_name'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPage>
  );
}

export function CaseResolutionPage() {
  const query = useCaseResolutionReport();
  return (
    <StandardPage
      query={query}
      title="Case resolution"
      subtitle="Kết quả xử lý ca cấp cứu: resolved, cancelled, false alarm, escalated và resolution time"
      labels={{
        total_cases: 'Total cases',
        resolved_cases: 'Resolved',
        cancelled_cases: 'Cancelled',
        false_alarm_cases: 'False alarm',
        open_cases: 'Open',
        resolution_rate: 'Resolution rate',
        cancellation_rate: 'Cancellation rate',
        false_alarm_rate: 'False alarm rate',
        escalation_rate: 'Escalation rate',
        average_resolution_seconds: 'Avg resolution seconds',
        critical_resolution_rate: 'Critical resolution rate',
      }}
      tableTitle="Case resolution table"
      table={(data, open) => <EmergencyCaseTable rows={data.items || []} onOpen={(item) => open(item, 'Case resolution')} />}
    >
      {(data) => (
        <>
          <div className="executive-layout">
            <ReportSectionCard title="Resolution by day"><TrendChart data={chartRows(data.charts?.resolution_by_day || [], ['date'])} /></ReportSectionCard>
            <ReportSectionCard title="Final status"><BedStatusDonut rows={data.charts?.final_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Escalated vs non-escalated"><BedStatusDonut rows={data.charts?.escalated_vs_non_escalated || []} /></ReportSectionCard>
          </div>
          {data.summary?.resolution_rate !== undefined ? <IeInsightList insights={[{ title: 'Resolution rate', body: `Tỷ lệ xử lý hiện tại ${formatPercent(data.summary.resolution_rate)} trong kỳ lọc.`, tone: data.summary.resolution_rate < 80 ? 'warning' : 'good' }]} /> : null}
        </>
      )}
    </StandardPage>
  );
}
