import { useMemo, useState } from 'react';
import {
  AppointmentStatusBadge,
  BottleneckPanel,
  compactPerson,
  DataErrorStrip,
  dateCell,
  DepartmentLoadMatrix,
  EncounterStatusBadge,
  JourneyFunnel,
  minutesCell,
  OperationBreakdownBar,
  OperationDetailDrawer,
  OperationFilterBar,
  OperationKpiGrid,
  OperationStatusDonut,
  OperationTable,
  OperationTrendChart,
  PatientFlowTimeline,
  QueueStatusBadge,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  SlotEfficiencyGrid,
  SmartPanel,
  WaitTimeHeatmap,
  moneyCell,
} from '../components/OperationsComponents';
import {
  useAppointmentReport,
  useCheckInReport,
  useDepartmentLoadReport,
  useEncounterReport,
  useNoShowReport,
  usePatientFlowReport,
  useQueueReport,
  useSlotEfficiencyReport,
  useWaitTimeReport,
} from '../hooks/useOperationReports';
import '../styles/reportsOperations.css';

function rowsFrom(result) {
  return result?.items || [];
}

function PageFrame({ query, title, subtitle, exportType, children }) {
  const [drawer, setDrawer] = useState(null);
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <div className="executive-overview-page operation-page">
      <OperationFilterBar
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
      {children(query.data || {}, setDrawer, query)}
      <OperationDetailDrawer item={drawer?.item} type={drawer?.type || title} onClose={() => setDrawer(null)} />
    </div>
  );
}

const encounterColumns = [
  { key: 'encounter_code', label: 'Mã encounter' },
  { key: 'patient', label: 'Bệnh nhân', render: (row) => compactPerson(row.patient_id || row.patient) },
  { key: 'doctor', label: 'Bác sĩ', render: (row) => compactPerson(row.attending_doctor_id || row.doctor) },
  { key: 'department', label: 'Khoa', render: (row) => compactPerson(row.department_id || row.department) },
  { key: 'encounter_type', label: 'Loại' },
  { key: 'status', label: 'Trạng thái', render: (row) => <EncounterStatusBadge status={row.status} /> },
  { key: 'start_time', label: 'Bắt đầu', render: (row) => dateCell(row.start_time) },
  { key: 'end_time', label: 'Kết thúc', render: (row) => dateCell(row.end_time) },
  { key: 'duration', label: 'Thời lượng', render: (row) => minutesCell(row.duration_minutes || row.average_duration) },
];

const appointmentColumns = [
  { key: 'appointment_time', label: 'Giờ hẹn', render: (row) => dateCell(row.appointment_time) },
  { key: 'patient', label: 'Bệnh nhân', render: (row) => compactPerson(row.patient_id || row.patient) },
  { key: 'phone', label: 'SĐT', render: (row) => row.patient_id?.phone || row.phone || '—' },
  { key: 'department', label: 'Khoa', render: (row) => compactPerson(row.department_id || row.department) },
  { key: 'doctor', label: 'Bác sĩ', render: (row) => compactPerson(row.doctor_id || row.doctor) },
  { key: 'appointment_type', label: 'Loại' },
  { key: 'status', label: 'Trạng thái', render: (row) => <AppointmentStatusBadge status={row.status} /> },
  { key: 'source', label: 'Nguồn tạo', render: (row) => row.source || row.created_by_actor_type || '—' },
  { key: 'note', label: 'Ghi chú', render: (row) => row.note || row.reason || '—' },
];

const queueColumns = [
  { key: 'queue_number', label: 'Số thứ tự', render: (row) => row.display_number || row.queue_number || row.ticket_no || '—' },
  { key: 'patient', label: 'Bệnh nhân', render: (row) => compactPerson(row.patient_id || row.patient) },
  { key: 'department', label: 'Khoa', render: (row) => compactPerson(row.department_id || row.department) },
  { key: 'doctor', label: 'Bác sĩ', render: (row) => compactPerson(row.doctor_id || row.doctor) },
  { key: 'priority', label: 'Ưu tiên' },
  { key: 'status', label: 'Trạng thái', render: (row) => <QueueStatusBadge status={row.status} /> },
  { key: 'checkin_time', label: 'Check-in', render: (row) => dateCell(row.checkin_time || row.created_at) },
  { key: 'called_time', label: 'Called', render: (row) => dateCell(row.called_time) },
  { key: 'service_start_time', label: 'Service start', render: (row) => dateCell(row.service_start_time) },
  { key: 'completed_time', label: 'Completed', render: (row) => dateCell(row.completed_time) },
  { key: 'waiting_minutes', label: 'Waiting', render: (row) => minutesCell(row.waiting_minutes) },
  { key: 'service_minutes', label: 'Service', render: (row) => minutesCell(row.service_minutes) },
];

function CommonCharts({ data, mode }) {
  return (
    <div className="executive-layout">
      <ReportSectionCard title="Theo ngày">
        <OperationTrendChart
          rows={mode === 'encounters' ? data.charts?.encounters_by_day : data.charts?.appointments_by_day}
          series={[{ key: 'count', label: 'Số lượng' }]}
        />
      </ReportSectionCard>
      <ReportSectionCard title="Trạng thái">
        <OperationStatusDonut rows={mode === 'encounters' ? data.charts?.encounters_by_status : data.charts?.appointments_by_status} />
      </ReportSectionCard>
      <ReportSectionCard title="Theo khoa">
        <OperationBreakdownBar rows={(data.rankings?.departments || []).map((row) => ({ ...row, value: row.value }))} />
      </ReportSectionCard>
    </div>
  );
}

export function OperationsEncountersPage() {
  const query = useEncounterReport();
  return (
    <PageFrame query={query} title="Lượt khám / Encounter" subtitle="Theo dõi toàn bộ lượt khám ngoại trú, nội trú, cấp cứu, telemedicine" exportType="encounters">
      {(data, setDrawer, q) => (
        <>
          <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
          <CommonCharts data={data} mode="encounters" />
          <div className="executive-layout">
            <ReportSectionCard title="Loại encounter"><OperationStatusDonut rows={data.charts?.encounters_by_type || []} /></ReportSectionCard>
            <ReportSectionCard title="Top bác sĩ"><OperationBreakdownBar rows={data.rankings?.doctors || []} /></ReportSectionCard>
            <ReportSectionCard title="Top khoa"><OperationBreakdownBar rows={data.rankings?.departments || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Bảng chi tiết encounter" subtitle="Bấm một dòng để mở drawer chi tiết">
            <OperationTable columns={encounterColumns} rows={rowsFrom(data.lists?.encounters)} pagination={data.lists?.encounters?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => setDrawer({ item, type: 'Encounter' })} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function OperationsAppointmentsPage() {
  const query = useAppointmentReport();
  return (
    <PageFrame query={query} title="Lịch hẹn" subtitle="Phân tích lịch hẹn, trạng thái, loại lịch, nguồn tạo và thao tác vận hành" exportType="appointments">
      {(data, setDrawer, q) => (
        <>
          <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
          <CommonCharts data={data} mode="appointments" />
          <div className="executive-layout">
            <ReportSectionCard title="Loại lịch hẹn"><OperationStatusDonut rows={data.charts?.appointments_by_type || []} /></ReportSectionCard>
            <ReportSectionCard title="Phân bố theo giờ"><WaitTimeHeatmap rows={data.charts?.appointment_by_hour || []} /></ReportSectionCard>
            <SmartPanel title="Smart panels" items={[
              { title: 'Sắp tới trong 2 giờ', description: 'Lọc các lịch hẹn gần giờ để ưu tiên xác nhận.' },
              { title: 'Chưa xác nhận', description: 'Theo dõi booked/confirmed để giảm no-show.' },
              { title: 'Quá giờ chưa check-in', description: 'TODO backend: cần delay_minutes theo appointment.' },
            ]} />
          </div>
          <ReportSectionCard title="Danh sách lịch hẹn">
            <OperationTable columns={appointmentColumns} rows={rowsFrom(data.lists?.appointments)} pagination={data.lists?.appointments?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => setDrawer({ item, type: 'Appointment' })} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function OperationsCheckInPage() {
  const query = useCheckInReport();
  return (
    <PageFrame query={query} title="Check-in" subtitle="Command center cho check-in, queue handoff và các lịch hẹn trễ" exportType="appointments">
      {(data, setDrawer, q) => (
        <>
          <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
          <div className="executive-layout">
            <ReportSectionCard title="Check-in command center"><OperationTable columns={appointmentColumns} rows={rowsFrom(data.lists?.appointments)} pagination={data.lists?.appointments?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => setDrawer({ item, type: 'Check-in' })} /></ReportSectionCard>
            <ReportSectionCard title="Queue handoff"><OperationTable columns={queueColumns.slice(0, 7)} rows={rowsFrom(data.lists?.queue)} onRowClick={(item) => setDrawer({ item, type: 'Queue ticket' })} /></ReportSectionCard>
          </div>
        </>
      )}
    </PageFrame>
  );
}

export function OperationsQueuePage() {
  const query = useQueueReport();
  return (
    <PageFrame query={query} title="Queue" subtitle="Realtime board cho hàng đợi, thời gian chờ và thao tác điều phối" exportType="queue">
      {(data, setDrawer, q) => {
        const rows = rowsFrom(data.lists?.queue);
        const statuses = ['waiting', 'called', 'in_service', 'completed', 'skipped', 'cancelled'];
        return (
          <>
            <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
            <div className="executive-kanban">
              {statuses.map((status) => (
                <section key={status} className="executive-kanban__column">
                  <header><strong>{status}</strong><span>{rows.filter((row) => row.status === status).length}</span></header>
                  {rows.filter((row) => row.status === status).slice(0, 8).map((row) => (
                    <article key={row._id || row.id} className="executive-task-card" onClick={() => setDrawer({ item: row, type: 'Queue' })}>
                      <strong>{row.display_number || row.queue_number}</strong>
                      <p>{compactPerson(row.patient_id)} - {compactPerson(row.department_id)}</p>
                    </article>
                  ))}
                </section>
              ))}
            </div>
            <div className="executive-layout">
              <ReportSectionCard title="Queue status"><OperationStatusDonut rows={data.charts?.queue_by_status || []} /></ReportSectionCard>
              <ReportSectionCard title="Peak hours"><OperationBreakdownBar rows={data.charts?.peak_hours || []} /></ReportSectionCard>
              <ReportSectionCard title="Wait buckets"><WaitTimeHeatmap rows={data.charts?.wait_buckets || []} /></ReportSectionCard>
            </div>
            <ReportSectionCard title="Bảng queue chi tiết">
              <OperationTable columns={queueColumns} rows={rows} pagination={data.lists?.queue?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => setDrawer({ item, type: 'Queue' })} />
            </ReportSectionCard>
          </>
        );
      }}
    </PageFrame>
  );
}

export function OperationsNoShowPage() {
  const query = useNoShowReport();
  return (
    <PageFrame query={query} title="No-show" subtitle="Theo dõi no-show, hủy lịch, reschedule và các điểm rủi ro theo khoa/bác sĩ/khung giờ" exportType="appointments">
      {(data, setDrawer, q) => (
        <>
          <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
          <div className="executive-layout">
            <ReportSectionCard title="No-show trend"><OperationTrendChart rows={data.charts?.appointments_by_day || []} series={[{ key: 'count', label: 'No-show' }]} /></ReportSectionCard>
            <ReportSectionCard title="Theo giờ"><WaitTimeHeatmap rows={data.charts?.appointment_by_hour || []} /></ReportSectionCard>
            <ReportSectionCard title="Alerts no-show/cancel"><OperationTable columns={[{ key: 'title', label: 'Cảnh báo' }, { key: 'severity', label: 'Mức' }, { key: 'status', label: 'Trạng thái' }]} rows={rowsFrom(data.raw?.no_show_alerts)} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Danh sách no-show / hủy lịch">
            <OperationTable columns={appointmentColumns} rows={rowsFrom(data.lists?.appointments)} pagination={data.lists?.appointments?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => setDrawer({ item, type: 'No-show' })} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function OperationsWaitTimePage() {
  const query = useWaitTimeReport();
  return (
    <PageFrame query={query} title="Thời gian chờ" subtitle="Avg, median, P90/P95, bucket distribution và bottleneck theo khoa/bác sĩ/giờ" exportType="queue">
      {(data, setDrawer, q) => (
        <>
          <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
          <div className="executive-layout">
            <ReportSectionCard title="Wait bucket distribution"><WaitTimeHeatmap rows={data.charts?.wait_buckets || []} /></ReportSectionCard>
            <ReportSectionCard title="Wait by hour"><OperationBreakdownBar rows={data.charts?.wait_by_hour || []} /></ReportSectionCard>
            <ReportSectionCard title="Bottleneck"><BottleneckPanel data={data.reports || {}} waitTime={data.wait_time || {}} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Bảng thời gian chờ">
            <OperationTable columns={queueColumns} rows={rowsFrom(data.lists?.queue)} pagination={data.lists?.queue?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => setDrawer({ item, type: 'Wait time' })} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function OperationsDepartmentLoadPage() {
  const query = useDepartmentLoadReport();
  return (
    <PageFrame query={query} title="Tải khoa / phòng" subtitle="Load matrix theo appointment, encounter, queue wait, doctor count và revenue" exportType="departments">
      {(data, setDrawer) => (
        <>
          <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
          <ReportSectionCard title="Department load matrix"><DepartmentLoadMatrix rows={data.charts?.department_load || []} onOpen={(item) => setDrawer({ item, type: 'Department load' })} /></ReportSectionCard>
          <ReportSectionCard title="Bảng tải khoa">
            <OperationTable
              columns={[
                { key: 'department_name', label: 'Khoa' },
                { key: 'doctor_count', label: 'Số bác sĩ' },
                { key: 'appointment_count', label: 'Lịch hẹn' },
                { key: 'encounter_count', label: 'Lượt khám' },
                { key: 'completed_encounter_count', label: 'Hoàn tất' },
                { key: 'no_show_count', label: 'No-show' },
                { key: 'queue_waiting_average', label: 'Avg waiting', render: (row) => minutesCell(row.queue_waiting_average) },
                { key: 'revenue_amount', label: 'Revenue', render: (row) => moneyCell(row.revenue_amount) },
                { key: 'load_score', label: 'Load score' },
              ]}
              rows={data.charts?.department_load || []}
              onRowClick={(item) => setDrawer({ item, type: 'Department load' })}
            />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function OperationsSlotEfficiencyPage() {
  const query = useSlotEfficiencyReport();
  return (
    <PageFrame query={query} title="Hiệu suất slot" subtitle="Utilization theo bác sĩ/khoa, booked vs available và insight hiệu suất lịch khám" exportType="doctors">
      {(data, setDrawer) => (
        <>
          <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
          <ReportSectionCard title="Slot efficiency grid"><SlotEfficiencyGrid rows={data.slot_efficiency?.items || []} /></ReportSectionCard>
          <div className="executive-layout">
            <ReportSectionCard title="Utilization by doctor"><OperationBreakdownBar rows={(data.slot_efficiency?.items || []).map((row) => ({ ...row, label: row.doctor_name, value: row.schedule_utilization }))} /></ReportSectionCard>
            <ReportSectionCard title="Booked vs available"><WaitTimeHeatmap rows={[
              { label: 'Booked', value: data.slot_efficiency?.summary?.booked_slots },
              { label: 'Available', value: data.slot_efficiency?.summary?.available_slots },
            ]} /></ReportSectionCard>
            <SmartPanel title="Insight" items={[
              { title: 'Kín slot nhưng completion thấp', description: 'So sánh booked slots với completed appointment.' },
              { title: 'Slot trống nhiều', description: 'Ưu tiên truyền thông hoặc dồn lịch theo khoa.' },
              { title: 'TODO backend', description: 'Cần by_hour, blocked_slots, overbooked_slots, fill_rate chuẩn.' },
            ]} />
          </div>
          <ReportSectionCard title="Bảng hiệu suất slot">
            <OperationTable
              columns={[
                { key: 'doctor_name', label: 'Bác sĩ' },
                { key: 'department_name', label: 'Khoa' },
                { key: 'specialty', label: 'Chuyên khoa' },
                { key: 'total_slots', label: 'Total slots' },
                { key: 'booked_slots', label: 'Booked' },
                { key: 'available_slots', label: 'Available' },
                { key: 'appointment_count', label: 'Appointments' },
                { key: 'completed_appointment_count', label: 'Completed' },
                { key: 'no_show_count', label: 'No-show' },
                { key: 'schedule_utilization', label: 'Utilization', render: (row) => `${Number(row.schedule_utilization || 0).toFixed(1)}%` },
              ]}
              rows={data.slot_efficiency?.items || []}
              onRowClick={(item) => setDrawer({ item, type: 'Slot efficiency' })}
            />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function OperationsPatientFlowPage() {
  const query = usePatientFlowReport();
  return (
    <PageFrame query={query} title="Luồng bệnh nhân" subtitle="Funnel thống nhất từ appointment -> check-in -> queue -> encounter -> orders" exportType="appointments">
      {(data, setDrawer, q) => (
        <>
          <OperationKpiGrid cards={data.summary_cards || []} onOpen={(item) => setDrawer({ item })} />
          <ReportSectionCard title="Patient journey funnel"><JourneyFunnel stages={data.patient_flow?.stages || []} /></ReportSectionCard>
          <ReportSectionCard title="Timeline luồng bệnh nhân"><PatientFlowTimeline stages={data.patient_flow?.stages || []} /></ReportSectionCard>
          <div className="executive-layout">
            <ReportSectionCard title="Bottleneck cards"><BottleneckPanel data={data.reports || {}} waitTime={data.wait_time || {}} /></ReportSectionCard>
            <ReportSectionCard title="Department patient flow"><DepartmentLoadMatrix rows={data.charts?.department_load || []} onOpen={(item) => setDrawer({ item })} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Danh sách bệnh nhân active">
            <OperationTable columns={appointmentColumns} rows={rowsFrom(data.lists?.appointments)} pagination={data.lists?.appointments?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => setDrawer({ item, type: 'Patient flow' })} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}
