import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../utils/api'
import { AppointmentTable, EncounterTable, QueueBoardTable } from './DoctorTables'
import {
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PatientSummaryCard,
  SectionCard,
  StatCard,
  StatusBadge,
} from './DoctorShell'
import { formatDate, formatTime, parseDateValue, safeArray, toLocalDateKey } from './doctorData'
import { doctorApi, getDoctorCapabilities, getDoctorId } from './doctorApi'
import {
  buildScheduleBuckets,
  computeQueueBoard,
  getTodayDate,
  useAsyncResource,
  usePatientMap,
  usePollingReload,
} from './DoctorHooks'

const emptyQueueBoard = {
  waiting: [],
  called: [],
  in_service: [],
  completed: [],
}

function getRangeParams(scope, dateValue, status) {
  const params = {}

  if (scope === 'week') {
    const selected = parseDateValue(dateValue)
    const start = new Date(selected)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    params.date_from = toLocalDateKey(start)
    params.date_to = toLocalDateKey(end)
  } else {
    params.date = toLocalDateKey(dateValue)
  }

  if (status && status !== 'all') {
    params.status = status
  }

  return params
}

function getScheduleRangeParams(view, anchorDate) {
  const selected = parseDateValue(anchorDate)
  const start = new Date(selected)
  const end = new Date(selected)

  if (view === 'week') {
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    end.setDate(start.getDate() + 6)
  } else {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1, 0)
  }

  return {
    date_from: toLocalDateKey(start),
    date_to: toLocalDateKey(end),
  }
}

function getCalendarDays(anchorDate, schedules) {
  const anchor = parseDateValue(anchorDate)
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - monthStart.getDay())

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const dateKey = toLocalDateKey(date)
    const matches = schedules.filter((item) => {
      const value = item.shift_start || item.start_time
      return value && toLocalDateKey(parseDateValue(value)) === dateKey
    })

    return {
      date,
      dateKey,
      isCurrentMonth: date.getMonth() === anchor.getMonth(),
      count: matches.length,
    }
  })
}

function QueueTrendBars({ waitingCount, calledCount, inServiceCount, completedCount }) {
  const live = [waitingCount, calledCount, inServiceCount, completedCount]
  const maxValue = Math.max(...live, 1)

  return (
    <div className="doctor-traffic-chart" aria-label="Biểu đồ lưu lượng hàng chờ">
      {live.map((value, index) => (
        <span key={index} style={{ height: `${22 + Math.round((value / maxValue) * 64)}px` }} />
      ))}
    </div>
  )
}

export function DoctorDashboardScreen({ user }) {
  const navigate = useNavigate()
  const [appointmentsState] = useAsyncResource(
    async () => doctorApi.dashboard.getAppointmentsToday(),
    [],
    [],
    { fallbackMessage: 'Không thể tải lịch hẹn hôm nay.' },
  )
  const [encountersState] = useAsyncResource(
    async () => doctorApi.dashboard.getEncountersToday(),
    [],
    [],
    { fallbackMessage: 'Không thể tải phiên khám hôm nay.' },
  )
  const [queueState] = useAsyncResource(
    async () => doctorApi.dashboard.getQueueBoard({ date: getTodayDate() }),
    [],
    emptyQueueBoard,
    { fallbackMessage: 'Không thể tải bảng hàng chờ của bác sĩ.' },
  )

  const appointments = safeArray(appointmentsState.data)
  const encounters = safeArray(encountersState.data)
  const queueBoard = computeQueueBoard(queueState.data)
  const sortedAppointmentTimes = appointments
    .map((item) => item.appointment_time)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())
  const averageWaitMinutes = queueBoard.waiting.length
    ? Math.max(
        0,
        Math.round(
          queueBoard.waiting.reduce((total, item) => {
            const checkInTime = item.checkin_time ? new Date(item.checkin_time).getTime() : Date.now()
            return total + Math.max(0, Date.now() - checkInTime) / 60000
          }, 0) / queueBoard.waiting.length,
        ),
      )
    : 0
  const scheduleWindowText =
    sortedAppointmentTimes.length > 0
      ? `${formatTime(sortedAppointmentTimes[0])} - ${formatTime(
          sortedAppointmentTimes[sortedAppointmentTimes.length - 1],
        )}`
      : 'Không có lịch hẹn trong phạm vi'
  const patientMap = usePatientMap(
    [...appointments, ...encounters, ...queueBoard.queueItems].map((item) => item.patient_id),
  )

  return (
    <div className="doctor-page-stack">
      <section className="doctor-page-heading">
        <div>
          <h2>Tổng quan lâm sàng</h2>
          <p>Chào mừng quay lại. Đây là không gian làm việc của bác sĩ cho luồng bệnh nhân hôm nay.</p>
        </div>
        <div className="doctor-inline-actions">
          <button className="doctor-secondary-button" type="button" onClick={() => navigate('/doctor/queue')}>
            Xem bảng hàng chờ
          </button>
          <button className="doctor-primary-button" type="button" onClick={() => navigate('/doctor/appointments')}>
            Mở danh sách lịch hẹn
          </button>
        </div>
      </section>

      <section className="doctor-kpi-grid">
        <StatCard label="Lịch hẹn hôm nay" value={appointments.length} hint={scheduleWindowText} icon="calendar" />
        <StatCard
          label="Bệnh nhân chờ"
          value={queueBoard.waiting.length}
          hint={queueBoard.waiting.length ? `${averageWaitMinutes} phút chờ trung bình` : 'Không có hàng chờ'}
          tone="amber"
          icon="queue"
        />
        <StatCard label="Đang xử lý" value={encounters.filter((item) => item.status === 'in_progress').length} hint="Phiên khám đang hoạt động" tone="teal" icon="doctor" />
        <StatCard label="Hoàn tất" value={encounters.filter((item) => item.status === 'completed').length} hint="Đã hoàn tất hôm nay" tone="green" icon="check_circle" />
      </section>

      <section className="doctor-dashboard-grid doctor-dashboard-grid-wide">
        <div className="doctor-panel-stack">
          <SectionCard
            title="Lịch hẹn hôm nay"
            subtitle="Xem nhanh các lịch hẹn live được trả về từ endpoint hôm nay."
            actions={
              <button className="doctor-link-button" type="button" onClick={() => navigate('/doctor/schedules')}>
                Xem toàn bộ lịch
              </button>
            }
          >
            {appointmentsState.loading ? <LoadingState label="Đang tải lịch hẹn..." /> : null}
            {appointmentsState.error && !appointments.length ? (
              <ErrorState title="Không thể tải lịch hẹn" message={appointmentsState.error} />
            ) : null}
            {appointments.length > 0 ? (
              <div className="doctor-table-wrap">
                <table className="doctor-table doctor-dashboard-appointments-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tên bệnh nhân</th>
                      <th>Ngày</th>
                      <th>Giờ</th>
                      <th>Loại khám</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appointment) => {
                      const appointmentId = appointment.appointment_id || appointment.id
                      const patient = patientMap[appointment.patient_id]
                      return (
                        <tr key={appointmentId}>
                          <td>
                            <div className="doctor-table-cell-stack">
                              <strong className="doctor-table-id">
                                {patient?.patient_code || appointment.patient_id || '--'}
                              </strong>
                              <span className="doctor-table-secondary">{appointmentId}</span>
                            </div>
                          </td>
                          <td>
                            <div className="doctor-table-cell-stack">
                              <strong>{patient?.full_name || appointment.patient_name || appointment.patient_id}</strong>
                              <span className="doctor-table-secondary">{appointment.reason || appointment.notes || '--'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="doctor-table-inline-meta">
                              {formatDate(appointment.appointment_time)}
                            </span>
                          </td>
                          <td>
                            <strong className="doctor-table-time">
                              {formatTime(appointment.appointment_time)}
                            </strong>
                          </td>
                          <td>{appointment.appointment_type || '--'}</td>
                          <td>
                            <StatusBadge status={appointment.status || ''} />
                          </td>
                          <td>
                            <button className="doctor-secondary-button" type="button" onClick={() => navigate('/doctor/appointments')}>
                              Mở
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {!appointmentsState.loading && appointments.length === 0 ? (
              <EmptyState title="Không có lịch hẹn hôm nay" description="Lịch bác sĩ đang trống trong ngày đã chọn." />
            ) : null}
          </SectionCard>
        </div>

        <div className="doctor-panel-stack">
          <SectionCard title="Phiên khám chờ xử lý" subtitle="Tiếp tục ghi chép hoặc hoàn tất các lượt khám đang mở.">
            {encounters.length === 0 && !encountersState.loading ? (
              <EmptyState title="Không có phiên khám đang hoạt động" description="Phiên khám sẽ hiển thị ở đây khi bắt đầu phục vụ." />
            ) : null}
            {encounters.slice(0, 2).map((encounter) => {
              const encounterId = encounter.encounter_id || encounter.id
              const patient = patientMap[encounter.patient_id]
              return (
                <div key={encounterId} className="doctor-pending-encounter-card">
                  <div className="doctor-pending-encounter-top">
                    <div>
                      <div className="doctor-inline-actions">
                        <span className="doctor-card-eyebrow">{encounter.encounter_code || encounterId}</span>
                        <StatusBadge status={encounter.status || ''} />
                      </div>
                      <strong>{patient?.full_name || encounter.patient_name || encounter.patient_id}</strong>
                      <p>{encounter.encounter_type || '--'}</p>
                    </div>
                    <span className="doctor-muted-text">bắt đầu lúc {formatTime(encounter.start_time)}</span>
                  </div>
                  <div className="doctor-inline-actions">
                    <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${encounterId}`)}>
                      Tiếp tục ghi chép
                    </button>
                    <button className="doctor-icon-button" type="button" onClick={() => navigate(`/doctor/encounters/${encounterId}`)} aria-label="Mở phiên khám">
                      <span>+</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </SectionCard>

          <SectionCard title="Tổng quan hàng chờ" subtitle="Phân bố hàng chờ live từ dữ liệu thật hôm nay.">
            {queueBoard.queueItems.length > 0 ? (
              <QueueTrendBars
                waitingCount={queueBoard.waiting.length}
                calledCount={queueBoard.called.length}
                inServiceCount={queueBoard.inService.length}
                completedCount={queueBoard.completed.length}
              />
            ) : (
              <EmptyState title="Không có hoạt động hàng chờ" description="Phân bố hàng chờ sẽ xuất hiện khi có phiếu trong bảng hiện tại." />
            )}
          </SectionCard>
        </div>
      </section>
    </div>
  )
}

export function DoctorQueueScreen({ user }) {
  const navigate = useNavigate()
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const [boardState, reloadBoard] = useAsyncResource(
    async () => doctorApi.queue.listAll({ date: getTodayDate() }),
    [],
    emptyQueueBoard,
      { fallbackMessage: 'Không thể tải bảng hàng chờ.' },
  )
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  usePollingReload(reloadBoard, true, 30000)

  const queueBoard = computeQueueBoard(boardState.data)
  const patientMap = usePatientMap(queueBoard.queueItems.map((item) => item.patient_id))
  const currentServing = queueBoard.currentServing
  const queueCounts = {
    waiting: queueBoard.waiting.length,
    called: safeArray(queueBoard.called).length,
    inService: queueBoard.inService.length,
    completed: queueBoard.completed.length,
  }
  const currentPatient = currentServing ? patientMap[currentServing.patient_id] : null
  const currentServingId = currentServing?.queue_ticket_id || currentServing?.id || ''
  const upcomingQueueItems = [...queueBoard.waiting, ...queueBoard.called, ...queueBoard.inService].filter((item) => {
    const itemId = item.queue_ticket_id || item.id || ''
    return !currentServingId || itemId !== currentServingId
  })
  const recentCompletedQueueItems = [...queueBoard.completed].slice(-6).reverse()
  const showQueueControls = true

  async function handleCallNext() {
    setBusy(true)
    setFeedback('')
    try {
      await doctorApi.queue.callNext(doctorId)
      reloadBoard()
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể gọi bệnh nhân tiếp theo.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleAction(action, ticket) {
    const ticketId = ticket?.queue_ticket_id || ticket?.id || ticket
    if (!ticketId) {
      return
    }

    setBusy(true)
    setFeedback('')

    try {
      if (action === 'recall') {
        await doctorApi.queue.recall(ticketId)
      }
      if (action === 'skip') {
        await doctorApi.queue.skip(ticketId)
      }
      if (action === 'complete') {
        await doctorApi.queue.complete(ticketId)
      }
      if (action === 'start-service') {
        const payload = await doctorApi.queue.startService(ticketId)
        let encounterId = payload?.encounter?.encounter_id || payload?.encounter_id || ticket?.encounter_id || ''

        if (!encounterId && ticket?.appointment_id) {
          const created = await doctorApi.encounters.createFromAppointment(ticket.appointment_id)
          encounterId = created?.encounter?.encounter_id || created?.encounter_id || created?.id || ''
        }

        reloadBoard()
        if (encounterId) {
          navigate(`/doctor/encounters/${encounterId}`)
          return
        }
      }

      setDialog(null)
      reloadBoard()
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Thao tác hàng chờ thất bại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="doctor-page-stack">
      <section className="doctor-page-heading">
        <div>
          <h2>Quản lý hàng chờ</h2>
          <p>Gọi, gọi lại và điều phối bệnh nhân vào khám.</p>
        </div>
      </section>

      {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}

      <section className="doctor-page-heading doctor-queue-subheading">
        <div>
          <h2>Quản lý hàng chờ</h2>
          <p>Bảng hàng chờ trung tâm cho luồng gọi bệnh nhân và phục vụ.</p>
        </div>
        <div className="doctor-inline-actions">
          <button className="doctor-secondary-button" type="button" onClick={() => currentServing && setDialog({ action: 'skip', ticket: currentServing })} disabled={busy || !currentServing}>
            Bỏ qua
          </button>
          <button className="doctor-secondary-button" type="button" onClick={() => currentServing && handleAction('recall', currentServing)} disabled={busy || !currentServing}>
            Gọi lại
          </button>
          <button className="doctor-primary-button" type="button" onClick={handleCallNext} disabled={busy}>
            Gọi bệnh nhân tiếp theo
          </button>
        </div>
      </section>

      <section className="doctor-kpi-mini-grid doctor-queue-summary-grid">
        <div className="doctor-kpi-tile doctor-queue-summary-tile">
          <strong>{queueCounts.waiting}</strong>
          <span>Đang chờ</span>
        </div>
        <div className="doctor-kpi-tile doctor-queue-summary-tile">
          <strong>{queueCounts.called}</strong>
          <span>Đã gọi</span>
        </div>
        <div className="doctor-kpi-tile doctor-queue-summary-tile">
          <strong>{queueCounts.inService}</strong>
          <span>Đang phục vụ</span>
        </div>
        <div className="doctor-kpi-tile doctor-queue-summary-tile">
          <strong>{queueCounts.completed}</strong>
          <span>Hoàn tất</span>
        </div>
      </section>

      <section className="doctor-dashboard-grid doctor-queue-layout">
        <div className="doctor-panel-stack">
          <SectionCard
            title="Đang phục vụ"
            subtitle="Thông tin trung tâm của bệnh nhân đang được phục vụ tại phòng khám."
            className="doctor-queue-current-shell"
          >
            {currentServing ? (
              <div className="doctor-current-serving doctor-queue-current-card">
                <div className="doctor-queue-current-head">
                  <div className="doctor-current-ticket">{currentServing.queue_number || '--'}</div>
                  <div className="doctor-queue-current-copy">
                    <div className="doctor-queue-current-copy-top">
                        <span className="doctor-queue-stage-label">Đang phục vụ</span>
                      <StatusBadge status={currentServing.status || ''} className="doctor-queue-status-badge" />
                      {currentServing.priority_flag ? (
                          <span className="doctor-queue-priority-pill">Ưu tiên</span>
                      ) : null}
                    </div>
                    <strong>{currentPatient?.full_name || currentServing.patient_name || currentServing.patient_id}</strong>
                    <p>
                      {currentPatient?.patient_code || currentServing.patient_id || '--'} -{' '}
                      {currentServing.queue_type || '--'}
                    </p>
                  </div>
                </div>
                <div className="doctor-kpi-mini-grid doctor-queue-current-stats">
                  <div className="doctor-kpi-tile">
                    <strong>{formatTime(currentServing.checkin_time)}</strong>
                    <span>Giờ vào</span>
                  </div>
                  <div className="doctor-kpi-tile">
                    <strong>{currentServing.queue_type || '--'}</strong>
                    <span>Loại khám</span>
                  </div>
                  <div className="doctor-kpi-tile">
                    <strong>{currentPatient?.patient_code || currentServing.patient_id || '--'}</strong>
                    <span>Mã bệnh nhân</span>
                  </div>
                  <div className="doctor-kpi-tile">
                    <strong>{currentServing.encounter_id || currentServing.appointment_id || '--'}</strong>
                    <span>Hồ sơ liên kết</span>
                  </div>
                </div>
                <div className="doctor-queue-current-toolbar">
                  <div className="doctor-inline-actions doctor-inline-actions-wrap doctor-queue-current-actions">
                    <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/patients/${currentServing.patient_id}`)}>
                      Mở hồ sơ
                    </button>
                    {currentServing.encounter_id ? (
                      <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${currentServing.encounter_id}`)}>
                        Mở phiên khám
                      </button>
                    ) : null}
                    {currentServing.appointment_id && !currentServing.encounter_id ? (
                      <button className="doctor-secondary-button" type="button" onClick={() => navigate('/doctor/appointments')}>
                        Mở lịch hẹn
                      </button>
                    ) : null}
                  </div>
                  {showQueueControls ? (
                    <div className="doctor-inline-actions doctor-inline-actions-wrap doctor-queue-current-actions">
                      <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'skip', ticket: currentServing })} disabled={busy}>
                        Tạm dừng / Bỏ qua
                      </button>
                      <button className="doctor-primary-button doctor-primary-green" type="button" onClick={() => setDialog({ action: 'complete', ticket: currentServing })} disabled={busy}>
                        Hoàn tất
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Chưa có bệnh nhân đang được phục vụ"
                description="Hãy gọi phiếu tiếp theo để bắt đầu phục vụ."
              />
            )}
          </SectionCard>

        </div>

        <SectionCard
          title={`Bảng hàng chờ trực tiếp (${upcomingQueueItems.length})`}
          subtitle="Các phiếu đang hoạt động được trả về từ queue API live."
          actions={<span className="doctor-muted-text">Tự làm mới mỗi 30 giây</span>}
          className="doctor-queue-board-shell"
        >
          {boardState.loading ? <LoadingState label="Đang tải bảng hàng chờ..." /> : null}
          {boardState.error && !upcomingQueueItems.length ? (
            <ErrorState title="Không thể tải hàng chờ" message={boardState.error} onRetry={reloadBoard} />
          ) : null}
          {!boardState.loading ? (
            <QueueBoardTable
              tickets={upcomingQueueItems}
              patientMap={patientMap}
              onRecall={(ticketId) => handleAction('recall', ticketId)}
              onSkip={(ticket) => setDialog({ action: 'skip', ticket })}
              onStartService={(ticket) => handleAction('start-service', ticket)}
              onComplete={(ticket) => setDialog({ action: 'complete', ticket })}
            />
          ) : null}
        </SectionCard>
      </section>

      {recentCompletedQueueItems.length > 0 ? (
        <SectionCard title={`Hoàn tất hôm nay (${recentCompletedQueueItems.length})`} subtitle="Các phiếu hàng chờ hoàn tất gần nhất." className="doctor-queue-completed-shell">
          <div className="doctor-queue-completed-list">
            {recentCompletedQueueItems.map((ticket) => {
              const patient = patientMap[ticket.patient_id]
              const ticketId = ticket.queue_ticket_id || ticket.id

              return (
                <article key={ticketId} className="doctor-queue-completed-card">
                  <div className="doctor-queue-completed-head">
                    <div className="doctor-current-ticket">{ticket.queue_number || '--'}</div>
                    <div className="doctor-queue-current-copy">
                      <div className="doctor-queue-current-copy-top">
                        <span className="doctor-queue-stage-label">Phiếu hoàn tất</span>
                        <StatusBadge status={ticket.status || ''} className="doctor-queue-status-badge" />
                      </div>
                      <strong>{patient?.full_name || ticket.patient_name || ticket.patient_id || '--'}</strong>
                      <p>
                        {patient?.patient_code || ticket.patient_id || '--'} - {ticket.queue_type || '--'}
                      </p>
                    </div>
                  </div>
                  <div className="doctor-queue-completed-meta">
                    <div className="doctor-queue-bottom-meta-card">
                      <span>Hoàn tất</span>
                      <strong>{formatTime(ticket.completed_time)}</strong>
                    </div>
                    <div className="doctor-queue-bottom-meta-card">
                      <span>Mã phiếu</span>
                      <strong>{ticketId}</strong>
                    </div>
                    <div className="doctor-queue-bottom-meta-card">
                      <span>Mã bệnh nhân</span>
                      <strong>{patient?.patient_code || ticket.patient_id || '--'}</strong>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </SectionCard>
      ) : null}

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title={dialog?.action === 'skip' ? 'Bỏ qua phiếu hàng chờ?' : 'Hoàn tất phiếu hàng chờ?'}
        description={
          dialog?.action === 'skip'
            ? 'Thao tác này sẽ đưa bệnh nhân đã chọn ra khỏi luồng hàng chờ đang hoạt động.'
            : 'Thao tác này sẽ đánh dấu phiếu hàng chờ là đã hoàn tất trong bảng hiện tại.'
        }
        confirmLabel={dialog?.action === 'skip' ? 'Bỏ qua phiếu' : 'Hoàn tất phiếu'}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => handleAction(dialog?.action, dialog?.ticket)}
      />
    </div>
  )
}

export function DoctorAppointmentsScreen({ user }) {
  const navigate = useNavigate()
  const capabilities = getDoctorCapabilities(user)
  const [scope, setScope] = useState('day')
  const [dateValue, setDateValue] = useState(getTodayDate())
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [detailState, setDetailState] = useState({ loading: false, error: '', data: null })
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  const params = useMemo(() => getRangeParams(scope, dateValue, status), [scope, dateValue, status])
  const [appointmentsState, reloadAppointments] = useAsyncResource(
    async () => doctorApi.appointments.listAll(params),
    [scope, dateValue, status],
    [],
      { fallbackMessage: 'Không thể tải lịch hẹn live.' },
  )

  const appointments = safeArray(appointmentsState.data)
  const patientMap = usePatientMap(appointments.map((item) => item.patient_id))

  useEffect(() => {
    if (!selectedId) {
      setDetailState({ loading: false, error: '', data: null })
      return
    }

    let active = true

    async function loadDetail() {
      setDetailState({ loading: true, error: '', data: null })

      try {
        const payload = await doctorApi.appointments.getDetail(selectedId)
        if (active) {
          setDetailState({ loading: false, error: '', data: payload })
        }
      } catch (error) {
        if (active) {
          setDetailState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải chi tiết lịch hẹn.'),
            data: null,
          })
        }
      }
    }

    loadDetail()

    return () => {
      active = false
    }
  }, [selectedId])

  function handleAppointmentAction(action, appointmentId) {
    setDialog({ action, id: appointmentId })
  }

  async function commitAppointmentAction(action, appointmentId) {
    setBusy(true)
    setFeedback('')
    try {
      if (action === 'confirm') {
        await doctorApi.appointments.confirm(appointmentId)
      }
      if (action === 'no-show') {
        await doctorApi.appointments.noShow(appointmentId)
      }
      if (action === 'complete') {
        await doctorApi.appointments.complete(appointmentId)
      }
      reloadAppointments()
      setDialog(null)
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Thao tác lịch hẹn thất bại.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenEncounter(appointment) {
    const existingEncounterId = appointment.encounter_id || appointment.related_encounter_id
    if (existingEncounterId) {
      navigate(`/doctor/encounters/${existingEncounterId}`)
      return
    }

    setBusy(true)
    setFeedback('')
    try {
      const created = await doctorApi.encounters.createFromAppointment(appointment.appointment_id || appointment.id)
      const encounterId = created?.encounter?.encounter_id || created?.encounter_id || created?.id
      if (encounterId) {
        navigate(`/doctor/encounters/${encounterId}`)
      }
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể tạo hoặc mở phiên khám từ lịch hẹn.'))
    } finally {
      setBusy(false)
    }
  }

  const selectedPatient = patientMap[detailState.data?.patient_id]

  return (
    <div className="doctor-page-stack">
      <section className="doctor-page-heading">
        <div>
          <span className="doctor-card-eyebrow">Sổ đăng ký trung tâm</span>
          <h2>Lịch hẹn bệnh nhân</h2>
        </div>
      </section>

      {!capabilities.canAppointmentActions ? <div className="doctor-readonly-note">Các thao tác vòng đời lịch hẹn đang bị ẩn với vai trò Bác sĩ. Hãy dùng màn này để xem lịch hẹn và mở phiên khám lâm sàng.</div> : null}
      {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}

      <section className="doctor-dashboard-grid">
        <SectionCard title="Lịch hẹn" subtitle="Danh sách lịch hẹn theo ngày và tuần cho bác sĩ này.">
          <div className="doctor-filter-bar">
            <label>
              <span>Phạm vi</span>
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option value="day">Ngày</option>
                <option value="week">Tuần</option>
              </select>
            </label>
            <label>
              <span>Ngày</span>
              <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
            </label>
            <label>
              <span>Trạng thái</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">Tất cả trạng thái</option>
                  <option value="booked">Đã đặt</option>
                  <option value="confirmed">Đã xác nhận</option>
                  <option value="checked_in">Đã check-in</option>
                  <option value="in_consultation">Đang khám</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="no_show">Không đến</option>
                </select>
            </label>
          </div>
          {appointmentsState.loading ? <LoadingState label="Đang tải lịch hẹn..." /> : null}
          {appointmentsState.error && !appointments.length ? (
            <ErrorState title="Không thể tải lịch hẹn" message={appointmentsState.error} onRetry={reloadAppointments} />
          ) : null}
          {!appointmentsState.loading ? (
            <AppointmentTable
              appointments={appointments}
              patientMap={patientMap}
              canManageAppointments={capabilities.canAppointmentActions}
              onOpenDetail={setSelectedId}
              onOpenEncounter={handleOpenEncounter}
              onAppointmentAction={handleAppointmentAction}
            />
          ) : null}
        </SectionCard>

        <SectionCard title="Tóm tắt bệnh nhân" subtitle="Ngữ cảnh lịch hẹn đã chọn cho ca đang xem.">
          {!selectedId && !detailState.loading ? (
            <EmptyState title="Chọn một lịch hẹn" description="Hãy chọn một dòng lịch hẹn để xem ngữ cảnh bệnh nhân." />
          ) : null}
          {detailState.loading ? <LoadingState label="Đang tải chi tiết lịch hẹn..." /> : null}
          {detailState.error ? <ErrorState title="Không thể tải chi tiết lịch hẹn" message={detailState.error} /> : null}
          {detailState.data ? (
            <div className="doctor-panel-stack">
              <PatientSummaryCard patient={selectedPatient} compact>
                <div className="doctor-summary-meta-grid">
                  <div>
                      <span>Nhóm máu</span>
                    <strong>{selectedPatient?.blood_type || '--'}</strong>
                  </div>
                  <div>
                      <span>Thời gian hẹn</span>
                    <strong>{detailState.data.appointment_time ? formatDate(detailState.data.appointment_time) : '--'}</strong>
                  </div>
                </div>
              </PatientSummaryCard>

              <div className="doctor-appointment-notes">
                <h4>Ghi chú lịch hẹn</h4>
                <ul>
                  <li>{detailState.data.note || 'Chưa có ghi chú lịch hẹn.'}</li>
                  <li>
                    {selectedPatient?.allergies?.length
                      ? `Ghi chú dị ứng: ${selectedPatient.allergies.join(', ')}`
                      : 'Chưa có dị ứng được ghi nhận trong hồ sơ bệnh nhân hiện tại.'}
                  </li>
                </ul>
              </div>

              <div className="doctor-panel-stack">
                <button className="doctor-primary-button" type="button" onClick={() => handleOpenEncounter(detailState.data)} disabled={busy}>
                  Mở phiên khám lâm sàng
                </button>
                <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/patients/${detailState.data.patient_id}`)}>
                  Xem toàn bộ bệnh sử
                </button>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </section>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title="Cập nhật trạng thái lịch hẹn?"
        description="Thao tác này sẽ áp dụng thay đổi vòng đời lịch hẹn phía bác sĩ thông qua backend API."
        confirmLabel="Áp dụng thay đổi trạng thái"
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitAppointmentAction(dialog?.action, dialog?.id)}
      />
    </div>
  )
}

export function DoctorSchedulesScreen({ user }) {
  const [view, setView] = useState('month')
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const calendarParams = useMemo(() => getScheduleRangeParams(view, selectedDate), [view, selectedDate])
  const dayParams = useMemo(
    () => ({ date_from: selectedDate, date_to: selectedDate }),
    [selectedDate],
  )

  const [calendarState] = useAsyncResource(
    async () => doctorApi.schedules.listAll(calendarParams),
    [calendarParams.date_from, calendarParams.date_to],
    [],
      { fallbackMessage: 'Không thể tải lịch dạng lịch.' },
  )
  const [scheduleState] = useAsyncResource(
    async () => doctorApi.schedules.listAll(dayParams),
    [dayParams.date_from, dayParams.date_to],
    [],
      { fallbackMessage: 'Không thể tải lịch làm việc theo ngày.' },
  )

  const schedules = safeArray(calendarState.data)
  const daySchedules = buildScheduleBuckets(scheduleState.data, selectedDate)

  useEffect(() => {
    const hasSelectedSchedule = daySchedules.some((item) => {
      const scheduleId = item.doctor_schedule_id || item.schedule_id
      return scheduleId === selectedScheduleId
    })

    if (hasSelectedSchedule) {
      return
    }

    if (daySchedules[0]) {
      setSelectedScheduleId(daySchedules[0].doctor_schedule_id || daySchedules[0].schedule_id)
      return
    }

    setSelectedScheduleId('')
  }, [daySchedules, selectedScheduleId])

  const [slotsState] = useAsyncResource(
    async () => (selectedScheduleId ? doctorApi.schedules.getSlots(selectedScheduleId) : []),
    [selectedScheduleId],
    [],
      { fallbackMessage: 'Không thể tải khung giờ làm việc.' },
  )

  const slots = safeArray(slotsState.data)
  const calendarDays = useMemo(() => getCalendarDays(selectedDate, schedules), [selectedDate, schedules])

  return (
    <div className="doctor-dashboard-grid doctor-schedule-layout">
        <SectionCard title="Lịch làm việc" subtitle="Lịch chỉ đọc cho các ca trực live trong khoảng thời gian đã chọn.">
        <div className="doctor-filter-bar">
          <label>
              <span>Chế độ xem</span>
              <select value={view} onChange={(event) => setView(event.target.value)}>
                <option value="month">Tháng</option>
                <option value="week">Tuần</option>
              </select>
            </label>
            <label>
              <span>Ngày</span>
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </div>
          {calendarState.loading ? <LoadingState label="Đang tải lịch..." /> : null}
        <div className={`doctor-calendar-grid${view === 'week' ? ' is-week' : ''}`}>
          {calendarDays.map((day) => (
            <button
              key={day.dateKey}
              className={`doctor-calendar-cell${selectedDate === day.dateKey ? ' is-selected' : ''}${day.isCurrentMonth ? '' : ' is-muted'}`}
              type="button"
              onClick={() => setSelectedDate(day.dateKey)}
            >
              <span>{day.date.getDate()}</span>
              {day.count > 0 ? <small>{day.count} ca được phân công</small> : <small>Không có ca</small>}
            </button>
          ))}
        </div>
        <div className="doctor-calendar-legend">
          <span><i className="is-blue" /> Ca thường</span>
          <span><i className="is-teal" /> Trực</span>
          <span><i className="is-red" /> Đã chặn / Vắng mặt</span>
        </div>
      </SectionCard>

      <SectionCard title={formatDate(selectedDate)} subtitle="Phân rã khung giờ chỉ đọc cho ngày đã chọn.">
        {daySchedules.length === 0 ? (
          <EmptyState title="Không có lịch vào ngày này" description="Bác sĩ không có ca được phân công trong ngày đã chọn." />
        ) : (
          <div className="doctor-panel-stack">
            <div className="doctor-kpi-mini-grid">
              <div className="doctor-kpi-tile"><strong>{slots.filter((slot) => slot.is_booked).length}</strong><span>Đã đặt</span></div>
              <div className="doctor-kpi-tile"><strong>{slots.filter((slot) => slot.is_available).length}</strong><span>Còn trống</span></div>
              <div className="doctor-kpi-tile"><strong>{slots.filter((slot) => slot.is_blocked).length}</strong><span>Đã chặn</span></div>
            </div>

            <div className="doctor-list-stack">
              {daySchedules.map((schedule) => {
                const scheduleId = schedule.doctor_schedule_id || schedule.schedule_id
                return (
                  <button
                    key={scheduleId}
                    className={`doctor-list-row doctor-list-select${selectedScheduleId === scheduleId ? ' is-selected' : ''}`}
                    type="button"
                    onClick={() => setSelectedScheduleId(scheduleId)}
                  >
                    <div>
                      <strong>{schedule.department_name || '--'}</strong>
                      <p>{formatTime(schedule.shift_start)} - {formatTime(schedule.shift_end)}</p>
                    </div>
                    <span>{schedule.shift_type || '--'}</span>
                  </button>
                )
              })}
            </div>

            <div className="doctor-list-stack">
              {slots.map((slot) => (
                <div key={slot.slot_time} className="doctor-slot-row">
                  <div className="doctor-slot-dot" />
                  <div>
                    <strong>{formatTime(slot.slot_time)}</strong>
                      <p>{slot.patient_name || 'Chưa có lịch hẹn nào'}</p>
                  </div>
                  <StatusBadge status={slot.is_blocked ? 'blocked' : slot.is_booked ? 'booked' : 'available'} />
                </div>
              ))}
            </div>

              <div className="doctor-readonly-note">Màn hình này ở chế độ chỉ đọc cho vai trò Bác sĩ. Các thao tác tạo, sửa và xóa lịch làm việc được cố ý ẩn đi.</div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

export function DoctorEncountersScreen({ user }) {
  const navigate = useNavigate()
  const capabilities = getDoctorCapabilities(user)
  const [status, setStatus] = useState('all')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)

  const [encountersState, reloadEncounters] = useAsyncResource(
    async () => doctorApi.encounters.listAll(status !== 'all' ? { status } : {}),
    [status],
    [],
      { fallbackMessage: 'Không thể tải danh sách phiên khám.' },
  )

  const encounters = safeArray(encountersState.data)
  const patientMap = usePatientMap(encounters.map((item) => item.patient_id))

  async function commitTransition(encounterId, action) {
    setBusy(true)
    setFeedback('')
    try {
      if (action === 'start') {
        await doctorApi.encounters.start(encounterId)
      }
      if (action === 'hold') {
        await doctorApi.encounters.hold(encounterId)
      }
      if (action === 'complete') {
        await doctorApi.encounters.complete(encounterId)
      }
      reloadEncounters()
      setDialog(null)
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể cập nhật trạng thái phiên khám.'))
    } finally {
      setBusy(false)
    }
  }

  function handleTransition(encounterId, action) {
    if (action === 'complete') {
      setDialog({ encounterId, action })
      return
    }
    commitTransition(encounterId, action)
  }

  return (
    <div className="doctor-page-stack">
      <section className="doctor-page-heading">
        <div>
          <h2>Không gian phiên khám</h2>
          <p>Quản lý vòng đời lượt khám đang hoạt động, hồ sơ và hoàn tất phiên khám.</p>
        </div>
      </section>

      {!capabilities.canEncounterActions ? (
        <div className="doctor-permission-banner">
          Các thao tác phiên khám không khả dụng vì tài khoản hiện tại thiếu quyền <code>encounters.write</code>.
        </div>
      ) : null}
      {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}

      <SectionCard title="Danh sách phiên khám" subtitle="Các phiên khám đang hoạt động và lịch sử của bác sĩ hiện tại.">
        <div className="doctor-filter-bar">
          <label>
              <span>Trạng thái</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="waiting">Đang chờ</option>
                <option value="in_progress">Đang xử lý</option>
                <option value="on_hold">Tạm dừng</option>
                <option value="completed">Hoàn tất</option>
              </select>
            </label>
          </div>
        {encountersState.loading ? <LoadingState label="Đang tải phiên khám..." /> : null}
        {encountersState.error && !encounters.length ? (
          <ErrorState title="Không thể tải phiên khám" message={encountersState.error} onRetry={reloadEncounters} />
        ) : null}
        {!encountersState.loading ? (
          <EncounterTable
            encounters={encounters}
            patientMap={patientMap}
            onOpen={(encounterId) => navigate(`/doctor/encounters/${encounterId}`)}
            onTransition={handleTransition}
          />
        ) : null}
      </SectionCard>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title="Hoàn tất phiên khám?"
        description="Thao tác này sẽ đóng vòng đời khám của phiên khám đã chọn."
        confirmLabel="Hoàn tất phiên khám"
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitTransition(dialog?.encounterId, dialog?.action)}
      />
    </div>
  )
}
