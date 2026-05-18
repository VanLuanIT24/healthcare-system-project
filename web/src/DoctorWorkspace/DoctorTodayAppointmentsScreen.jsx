import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctorApi } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { DoctorIcon } from './DoctorShell'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5

function appointmentIdOf(appointment = {}) {
  return appointment.appointment_id || appointment.appointmentId || appointment.id || appointment._id || ''
}

function toDateKey(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-')
}

function numberFrom(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function appointmentTime(appointment = {}) {
  return appointment.appointment_time || appointment.scheduled_time || appointment.scheduled_at || appointment.start_time || appointment.time || appointment.date_time || appointment.appointmentDate || appointment.appointment_date || ''
}

function patientName(appointment = {}) {
  const patient = appointment.patient || {}
  return appointment.patient_name || appointment.patientName || patient.fullName || patient.full_name || patient.name || appointment.full_name || 'Chưa có tên bệnh nhân'
}

function patientCode(appointment = {}) {
  const patient = appointment.patient || {}
  return appointment.patient_code || patient.patient_code || appointment.patient_id || patient.patient_id || ''
}

function patientMeta(appointment = {}) {
  const patient = appointment.patient || {}
  const gender = appointment.patient_gender || appointment.gender || patient.gender
  const age = appointment.patient_age || patient.age
  const ageText = age ? `${age} tuổi` : ''
  return [gender, ageText, patientCode(appointment) ? `#${patientCode(appointment)}` : ''].filter(Boolean).join(' · ')
}

function patientInitials(appointment = {}) {
  return patientName(appointment)
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'BN'
}

function departmentName(appointment = {}) {
  return (
    appointment.department_name ||
    appointment.specialty ||
    appointment.specialty_name ||
    appointment.departmentName ||
    appointment.department?.department_name ||
    appointment.doctor?.specialty ||
    '--'
  )
}

function roomName(appointment = {}) {
  return (
    appointment.room_name ||
    appointment.clinic_room ||
    appointment.room ||
    appointment.location ||
    appointment.encounter?.room_name ||
    'PK'
  )
}

function doctorName(appointment = {}, user = {}) {
  const doctor = appointment.doctor || {}
  return appointment.doctor_name || doctor.full_name || doctor.name || user.full_name || user.name || 'Bác sĩ'
}

function visitReason(appointment = {}) {
  return appointment.reason || appointment.visit_reason || appointment.note || appointment.notes || appointment.chief_complaint || appointment.appointment_type || '--'
}

function queueNumber(appointment = {}) {
  return appointment.queue_number || appointment.queue_ticket?.queue_number || appointment.queue?.queue_number || ''
}

function encounterRoom(appointment = {}) {
  return appointment.encounter_code || appointment.encounter?.encounter_code || appointment.encounter_id || appointment.encounter?.encounter_id || roomName(appointment)
}

function checkedInAt(appointment = {}) {
  return appointment.checkedInAt || appointment.checked_in_at || appointment.check_in_time || appointment.arrived_at || ''
}

function statusInfo(appointment = {}) {
  const raw = String(appointment.status || '').toLowerCase()
  if (['checked_in', 'checked-in', 'arrived'].includes(raw)) return { key: 'checked_in', label: 'Đã check-in', tone: 'green' }
  if (['waiting', 'queued', 'pending', 'scheduled', 'confirmed'].includes(raw)) return { key: 'waiting', label: 'Đang chờ', tone: 'orange' }
  if (['completed', 'done', 'finished'].includes(raw)) return { key: 'completed', label: 'Đã hoàn tất', tone: 'green' }
  if (['no_show', 'no-show', 'missed'].includes(raw)) return { key: 'no_show', label: 'No-show', tone: 'slate' }
  if (['booked'].includes(raw)) return { key: 'upcoming', label: 'Sắp tới', tone: 'blue' }
  if (['cancelled', 'canceled'].includes(raw)) return { key: 'cancelled', label: 'Đã hủy', tone: 'red' }
  if (['in_progress', 'serving', 'examining'].includes(raw)) return { key: 'in_progress', label: 'Đang khám', tone: 'blue' }
  return { key: 'upcoming', label: raw ? raw.replace(/_/g, ' ') : 'Sắp tới', tone: 'blue' }
}

function isCheckedIn(appointment = {}) {
  const key = statusInfo(appointment).key
  return ['checked_in', 'waiting', 'in_progress', 'completed'].includes(key) || Boolean(checkedInAt(appointment))
}

function isCompleted(appointment = {}) {
  return statusInfo(appointment).key === 'completed'
}

function peakWindow(appointments = []) {
  const buckets = new Map()
  appointments.forEach((appointment) => {
    const value = appointmentTime(appointment)
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return
    const startHour = date.getHours()
    const key = `${String(startHour).padStart(2, '0')}:00 - ${String(startHour + 1).padStart(2, '0')}:00`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  })
  let best = ''
  let bestCount = 0
  buckets.forEach((count, key) => {
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  })
  return best || '--'
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

async function loadTodayAppointments(user) {
  const today = getTodayDate()
  const [todayAppointments, summary] = await Promise.all([
    doctorApi.appointments.listToday({ date: today, limit: 200 }),
    settledValue(doctorApi.appointments.getSummary({ date: today }), null),
  ])

  const combined = safeArray(todayAppointments)
  const deduped = new Map()
  combined.forEach((appointment) => {
    const id = appointmentIdOf(appointment) || `${appointment.patient_id || patientName(appointment)}-${appointmentTime(appointment)}`
    if (id && !deduped.has(id)) deduped.set(id, appointment)
  })

  const appointments = Array.from(deduped.values())
    .filter((appointment) => {
      const value = appointmentTime(appointment)
      return !value || toDateKey(value) === today
    })
    .sort((a, b) => new Date(appointmentTime(a)) - new Date(appointmentTime(b)))

  return {
    today,
    appointments,
    summary,
    readiness: {},
  }
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function AppointmentKpi({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-appointment-kpi is-list-mode">
      <span className={`doctor-appointment-kpi__icon is-${tone}`}>
        <DoctorIcon name={icon} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{hint}</span>
      </div>
    </article>
  )
}

function AppointmentDonut({ total, dashboard }) {
  const checked = total ? Math.round((dashboard.checkedIn / total) * 100) : 0
  const waiting = total ? Math.round((dashboard.waiting / total) * 100) : 0
  const completed = total ? Math.round((dashboard.completed / total) * 100) : 0
  const first = checked
  const second = checked + waiting
  const third = checked + waiting + completed
  return (
    <div
      className="doctor-appointment-status-donut"
      style={{
        background: `conic-gradient(#2f86ff 0 ${first}%, #ff9f1a ${first}% ${second}%, #16a34a ${second}% ${third}%, #94a3b8 ${third}% 100%)`,
      }}
    >
      <div>
        <strong>{total}</strong>
        <span>Tổng lịch hẹn</span>
      </div>
    </div>
  )
}

export function DoctorTodayAppointmentsScreen({ user }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', data: { today: getTodayDate(), appointments: [], summary: null, readiness: {} } })
  const [actingId, setActingId] = useState('')
  const [page, setPage] = useState(1)
  const [detailState, setDetailState] = useState({ loading: false, error: '', appointment: null, timeline: [] })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadTodayAppointments(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải lịch hẹn hôm nay.'),
        data: { today: getTodayDate(), appointments: [], summary: null, readiness: {} },
      }))
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadTodayAppointments(user)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải lịch hẹn hôm nay.'),
            data: { today: getTodayDate(), appointments: [], summary: null, readiness: {} },
          })
        }
      })

    return () => {
      active = false
    }
  }, [user])

  const dashboard = useMemo(() => {
    const appointments = safeArray(state.data.appointments)
    const summary = state.data.summary || {}
    const total = numberFrom(summary, ['total_appointments', 'appointments_count', 'total'], appointments.length)
    const checkedIn = numberFrom(summary, ['checked_in_count', 'checkedIn', 'checked_in'], appointments.filter(isCheckedIn).length)
    const completed = numberFrom(summary, ['completed_count', 'completed'], appointments.filter(isCompleted).length)
    const waiting = numberFrom(summary, ['waiting_count', 'waiting', 'pending_count'], appointments.filter((item) => ['waiting', 'upcoming'].includes(statusInfo(item).key)).length)
    const noShow = numberFrom(summary, ['no_show_count', 'noShow', 'no_show'], appointments.filter((item) => statusInfo(item).key === 'no_show').length)
    const upcoming = appointments.filter((item) => statusInfo(item).key === 'upcoming').length
    const checkedRate = total ? Math.round((checkedIn / total) * 1000) / 10 : 0
    const waitingRate = total ? Math.round((waiting / total) * 1000) / 10 : 0
    const completedRate = total ? Math.round((completed / total) * 1000) / 10 : 0
    const noShowRate = total ? Math.round((noShow / total) * 1000) / 10 : 0
    const first = appointments[0] || null

    return {
      appointments,
      total,
      checkedIn,
      waiting,
      completed,
      noShow,
      upcoming,
      checkedRate,
      waitingRate,
      completedRate,
      noShowRate,
      first,
      peak: peakWindow(appointments),
    }
  }, [state.data])

  const totalPages = Math.max(1, Math.ceil(dashboard.appointments.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedAppointments = dashboard.appointments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = dashboard.appointments.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(currentPage * PAGE_SIZE, dashboard.appointments.length)
  const firstPageButton = Math.max(1, Math.min(currentPage - 1, Math.max(1, totalPages - 2)))
  const pageButtons = Array.from({ length: Math.min(3, totalPages) }, (_, index) => firstPageButton + index)

  useEffect(() => {
    setPage(1)
  }, [state.data.today, dashboard.appointments.length])

  async function runAction(appointment, type) {
    const appointmentId = appointmentIdOf(appointment)
    if (!appointmentId) {
      toast.error('Không tìm thấy mã lịch hẹn.')
      return
    }

    if (type === 'queue' && !isCheckedIn(appointment)) {
      toast.warning('Chỉ tạo hàng đợi sau khi bệnh nhân đã check-in.')
      return
    }
    if (type === 'encounter' && !isCheckedIn(appointment)) {
      toast.warning('Chỉ bắt đầu khám sau khi bệnh nhân đã check-in.')
      return
    }

    setActingId(`${type}:${appointmentId}`)
    try {
      if (type === 'checkIn') {
        const readiness = await doctorApi.appointments.canCheckIn(appointmentId)
        if (readiness && readiness.can_check_in === false) {
          toast.warning(readiness.reason || readiness.message || 'Backend chưa cho phép check-in lịch hẹn này.')
          return
        }
        await doctorApi.appointments.checkIn(appointmentId)
      }
      if (type === 'confirm') await doctorApi.appointments.confirm(appointmentId)
      if (type === 'complete') await doctorApi.appointments.complete(appointmentId)
      if (type === 'queue') await doctorApi.appointments.createQueueTicket(appointmentId)
      if (type === 'encounter') {
        const encounter = await doctorApi.appointments.createEncounter(appointmentId)
        const encounterId = encounter?.encounter_id || encounter?.id || encounter?.encounter?.encounter_id || ''
        if (encounterId) navigate(`/doctor/encounters/${encodeURIComponent(encounterId)}`)
      }
      if (type === 'noShow') await doctorApi.appointments.noShow(appointmentId)
      toast.success('Đã cập nhật lịch hẹn.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác lịch hẹn.'))
    } finally {
      setActingId('')
    }
  }

  async function openAppointmentDetail(appointment) {
    const appointmentId = appointmentIdOf(appointment)
    if (!appointmentId) {
      setDetailState({ loading: false, error: 'Backend chưa trả mã lịch hẹn thật.', appointment, timeline: [] })
      return
    }

    setDetailState({ loading: true, error: '', appointment, timeline: [] })
    try {
      const [detail, timeline] = await Promise.all([
        doctorApi.appointments.getDetail(appointmentId),
        settledValue(doctorApi.appointments.getTimeline(appointmentId), []),
      ])
      setDetailState({ loading: false, error: '', appointment: detail || appointment, timeline: safeArray(timeline) })
    } catch (error) {
      setDetailState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải chi tiết lịch hẹn.'),
        appointment,
        timeline: [],
      })
    }
  }

  function exportTodayAppointments() {
    downloadCsv(`lich-hen-hom-nay-${state.data.today || getTodayDate()}.csv`, [
      ['Gio hen', 'Benh nhan', 'Ma benh nhan', 'Chuyen khoa', 'Ly do kham', 'Trang thai', 'Check-in', 'Hang doi', 'Phien kham'],
      ...dashboard.appointments.map((appointment) => {
        const status = statusInfo(appointment)
        return [
          formatTime(appointmentTime(appointment)),
          patientName(appointment),
          patientCode(appointment),
          departmentName(appointment),
          visitReason(appointment),
          status.label,
          checkedInAt(appointment) ? formatTime(checkedInAt(appointment)) : isCheckedIn(appointment) ? 'Da check-in' : '',
          queueNumber(appointment),
          appointment.encounter_id || appointment.encounter?.encounter_id || '',
        ]
      }),
    ])
  }

  function primaryActionFor(appointment) {
    if (!isCheckedIn(appointment)) return { type: 'checkIn', label: 'Check-in', icon: 'check_circle', disabled: false }
    if (!queueNumber(appointment)) return { type: 'queue', label: 'Tạo hàng đợi', icon: 'message', disabled: false }
    if (!appointment.encounter_id && !isCompleted(appointment)) return { type: 'encounter', label: 'Bắt đầu khám', icon: 'pulse', disabled: false }
    return { type: 'detail', label: 'Chi tiết', icon: 'note', disabled: false }
  }

  return (
    <div className="doctor-appointment-today is-appointment-list">
      {state.error ? (
        <div className="doctor-today-error">
          <span>{state.error}</span>
          <button type="button" onClick={reload}>Thử lại</button>
        </div>
      ) : null}

      <section className="doctor-appointment-kpis" aria-label="Tổng quan lịch hẹn hôm nay">
        <AppointmentKpi icon="calendar" tone="blue" label="Tổng lịch hẹn" value={dashboard.total} hint="100% tổng số lịch hẹn" />
        <AppointmentKpi icon="check_circle" tone="green" label="Đã check-in" value={dashboard.checkedIn} hint={`${dashboard.checkedRate}% tổng số lịch hẹn`} />
        <AppointmentKpi icon="clock" tone="orange" label="Đang chờ" value={dashboard.waiting} hint={`${dashboard.waitingRate}% tổng số lịch hẹn`} />
        <AppointmentKpi icon="check_circle" tone="purple" label="Đã hoàn tất" value={dashboard.completed} hint={`${dashboard.completedRate}% tổng số lịch hẹn`} />
      </section>

      <section className="doctor-appointment-layout">
        <article className="doctor-appointment-panel doctor-appointment-list-card">
          <header>
            <h2>Danh sách lịch hẹn hôm nay</h2>
          </header>

          <div className="doctor-appointment-list-head">
            <span>Giờ hẹn</span>
            <span>Bệnh nhân</span>
            <span>Chuyên khoa / Lý do khám</span>
            <span>Trạng thái</span>
            <span>Check-in</span>
            <span>Hàng đợi</span>
            <span>Phiên khám</span>
            <span>Thao tác</span>
          </div>

          <div className="doctor-appointment-list-body">
            {state.loading ? (
              <div className="doctor-appointment-empty">Đang tải lịch hẹn hôm nay...</div>
            ) : pagedAppointments.length ? pagedAppointments.map((appointment, index) => {
              const id = appointmentIdOf(appointment) || `appointment-${index}`
              const status = statusInfo(appointment)
              const action = primaryActionFor(appointment)
              const actionKey = `${action.type}:${id}`
              return (
                <div className="doctor-appointment-list-row" key={id}>
                  <strong>{formatTime(appointmentTime(appointment))}</strong>
                  <span className="doctor-appointment-patient">
                    <em>{patientInitials(appointment)}</em>
                    <b>{patientName(appointment)}</b>
                    <small>{patientMeta(appointment)}</small>
                  </span>
                  <span className="doctor-appointment-reason">
                    <b>{departmentName(appointment)}</b>
                    <small>{visitReason(appointment)}</small>
                  </span>
                  <span><i className={`is-${status.tone}`}>{status.label}</i></span>
                  <span className="doctor-appointment-checkin">{checkedInAt(appointment) ? formatTime(checkedInAt(appointment)) : isCheckedIn(appointment) ? '✓' : '-'}</span>
                  <span>{queueNumber(appointment) || '-'}</span>
                  <span>{appointment.encounter_id ? encounterRoom(appointment) : '-'}</span>
                  <span className="doctor-appointment-row-actions">
                    <button
                      type="button"
                      onClick={() => (action.type === 'detail' ? openAppointmentDetail(appointment) : runAction(appointment, action.type))}
                      disabled={Boolean(actingId) && actingId !== actionKey}
                    >
                      <DoctorIcon name={action.icon} />
                      {actingId === actionKey ? 'Đang xử lý' : action.label}
                    </button>
                  </span>
                </div>
              )
            }) : (
              <div className="doctor-appointment-empty">Chưa có lịch hẹn hôm nay.</div>
            )}
          </div>

          <footer className="doctor-appointment-list-footer">
            <button type="button" disabled>Hiển thị {PAGE_SIZE} dòng</button>
            <div>
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><DoctorIcon name="chevron_right" /></button>
              {pageButtons.map((pageNumber) => (
                <button type="button" className={pageNumber === currentPage ? 'is-active' : ''} key={pageNumber} onClick={() => setPage(pageNumber)}>
                  {pageNumber}
                </button>
              ))}
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><DoctorIcon name="chevron_right" /></button>
            </div>
            <span>Hiển thị {dashboard.appointments.length ? `${pageStart} đến ${pageEnd}` : '0'} của {dashboard.total} lịch hẹn</span>
          </footer>
        </article>

        <aside className="doctor-appointment-side">
          <article className="doctor-appointment-panel doctor-appointment-overview">
            <header>
              <h2>Tổng quan hôm nay</h2>
            </header>
            <div className="doctor-appointment-overview__top">
              <AppointmentDonut total={dashboard.total} dashboard={dashboard} />
              <dl>
                <div><dt><i className="is-blue" /> Đã check-in</dt><dd>{dashboard.checkedIn} ({dashboard.checkedRate}%)</dd></div>
                <div><dt><i className="is-orange" /> Đang chờ</dt><dd>{dashboard.waiting} ({dashboard.waitingRate}%)</dd></div>
                <div><dt><i className="is-green" /> Đã hoàn tất</dt><dd>{dashboard.completed} ({dashboard.completedRate}%)</dd></div>
                <div><dt><i className="is-slate" /> No-show</dt><dd>{dashboard.noShow} ({dashboard.noShowRate}%)</dd></div>
                <div><dt><i className="is-purple" /> Sắp tới</dt><dd>{dashboard.upcoming}</dd></div>
              </dl>
            </div>
            <div className="doctor-appointment-overview__list">
              <div><DoctorIcon name="clock" /><span>Khung giờ cao điểm</span><strong>{dashboard.peak}</strong></div>
              <div><DoctorIcon name="pulse" /><span>Tỷ lệ no-show</span><strong>{dashboard.noShowRate}% ({dashboard.noShow}/{dashboard.total || 0})</strong></div>
              <div><DoctorIcon name="patients" /><span>Bác sĩ phụ trách</span><strong>{doctorName(dashboard.first || {}, user)}</strong></div>
              <div><DoctorIcon name="patients" /><span>Khoa / Phòng khám</span><strong>{dashboard.first ? `${departmentName(dashboard.first)} / ${roomName(dashboard.first)}` : '--'}</strong></div>
            </div>
          </article>

          <article className="doctor-appointment-panel doctor-appointment-actions is-list-mode">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => navigate('/doctor/appointments')}>
              <span><DoctorIcon name="calendar" /></span>
              <b>Tạo lịch hẹn</b>
              <small>Tạo lịch hẹn mới cho bệnh nhân</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={reload} disabled={state.loading}>
              <span><DoctorIcon name="refresh" /></span>
              <b>Làm mới danh sách</b>
              <small>Cập nhật danh sách lịch hẹn</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={exportTodayAppointments}>
              <span><DoctorIcon name="note" /></span>
              <b>Xuất lịch hẹn hôm nay</b>
              <small>Xuất file Excel danh sách lịch hẹn</small>
              <DoctorIcon name="chevron_right" />
            </button>
          </article>
        </aside>
      </section>

      {detailState.loading || detailState.error || detailState.appointment ? (
        <div className="doctor-today-modal-backdrop" role="presentation" onClick={() => setDetailState({ loading: false, error: '', appointment: null, timeline: [] })}>
          <section
            className="doctor-today-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết lịch hẹn"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2>Chi tiết lịch hẹn</h2>
                <p>Dữ liệu lấy từ API chi tiết lịch hẹn và timeline khi có appointmentId.</p>
              </div>
              <button type="button" onClick={() => setDetailState({ loading: false, error: '', appointment: null, timeline: [] })} aria-label="Đóng">×</button>
            </header>
            <div className="doctor-today-modal-schedules">
              {detailState.loading ? (
                <div className="doctor-appointment-empty">Đang tải chi tiết lịch hẹn...</div>
              ) : detailState.error ? (
                <div className="doctor-appointment-empty">{detailState.error}</div>
              ) : (
                <>
                  <button type="button">
                    <b>{patientName(detailState.appointment)}</b>
                    <span>{formatTime(appointmentTime(detailState.appointment))}</span>
                    <small>{statusInfo(detailState.appointment).label}</small>
                  </button>
                  <button type="button">
                    <b>{departmentName(detailState.appointment)}</b>
                    <span>{visitReason(detailState.appointment)}</span>
                    <small>{roomName(detailState.appointment)}</small>
                  </button>
                  {detailState.timeline.length ? detailState.timeline.slice(0, 5).map((item, index) => (
                    <button type="button" key={item.id || item.timeline_id || index}>
                      <b>{item.title || item.action || item.event_type || 'Timeline'}</b>
                      <span>{formatTime(item.created_at || item.time || item.timestamp)}</span>
                      <small>{item.description || item.note || item.status || '--'}</small>
                    </button>
                  )) : null}
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
