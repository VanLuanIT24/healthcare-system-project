import { useEffect, useMemo, useState } from 'react'
import { doctorApi, getDoctorId } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { DoctorIcon } from './DoctorShell'
import { useToast } from './toast/ToastProvider'
import { getApiErrorMessage } from '../utils/api'

function appointmentIdOf(appointment = {}) {
  return appointment.appointment_id || appointment.id || appointment._id || ''
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
  return appointment.appointment_time || appointment.scheduled_at || appointment.start_time || appointment.date_time || ''
}

function patientName(appointment = {}) {
  const patient = appointment.patient || {}
  return appointment.patient_name || patient.full_name || patient.name || appointment.full_name || 'Bệnh nhân'
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
    appointment.department?.department_name ||
    appointment.doctor?.specialty ||
    'Khoa khám bệnh'
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
  return appointment.reason || appointment.note || appointment.notes || appointment.chief_complaint || appointment.appointment_type || 'Khám định kỳ'
}

function queueNumber(appointment = {}) {
  return appointment.queue_number || appointment.queue_ticket?.queue_number || appointment.queue?.queue_number || ''
}

function encounterRoom(appointment = {}) {
  return appointment.encounter_code || appointment.encounter?.encounter_code || appointment.encounter_id || roomName(appointment)
}

function checkedInAt(appointment = {}) {
  return appointment.checked_in_at || appointment.check_in_time || appointment.arrived_at || ''
}

function statusInfo(appointment = {}) {
  const raw = String(appointment.status || '').toLowerCase()
  if (['checked_in', 'arrived'].includes(raw)) return { key: 'checked_in', label: 'Đã check-in', tone: 'green' }
  if (['waiting', 'queued'].includes(raw)) return { key: 'waiting', label: 'Đang chờ', tone: 'orange' }
  if (['completed', 'done', 'finished'].includes(raw)) return { key: 'completed', label: 'Đã hoàn tất', tone: 'green' }
  if (['no_show'].includes(raw)) return { key: 'no_show', label: 'No-show', tone: 'slate' }
  if (['confirmed', 'scheduled', 'booked', 'pending'].includes(raw)) return { key: 'upcoming', label: raw === 'pending' ? 'Đang chờ' : 'Sắp tới', tone: raw === 'pending' ? 'orange' : 'blue' }
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
  const doctorId = getDoctorId(user)
  const [todayAppointments, doctorAppointments, byDateAppointments, upcomingAppointments, summary] = await Promise.all([
    settledValue(doctorApi.appointments.listToday({ date: today, limit: 200 }), []),
    doctorId ? settledValue(doctorApi.appointments.listByDoctor(doctorId, { date: today, limit: 200 }), []) : Promise.resolve([]),
    settledValue(doctorApi.appointments.listByDate({ date: today, limit: 200 }), []),
    settledValue(doctorApi.appointments.listUpcoming({ doctor_id: doctorId, limit: 200 }), []),
    settledValue(doctorApi.appointments.getSummary({ date: today, doctor_id: doctorId }), null),
  ])

  const combined = [...safeArray(todayAppointments), ...safeArray(doctorAppointments), ...safeArray(byDateAppointments)]
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

  const readinessEntries = await Promise.all(
    appointments.slice(0, 20).map(async (appointment) => {
      const id = appointmentIdOf(appointment)
      if (!id) return null
      const readiness = await settledValue(doctorApi.appointments.getReadChecks(id), null)
      return [id, readiness]
    }),
  )

  return {
    today,
    appointments,
    upcomingAppointments: safeArray(upcomingAppointments),
    summary,
    readiness: Object.fromEntries(readinessEntries.filter(Boolean)),
  }
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

function AppointmentDonut({ total }) {
  return (
    <div className="doctor-appointment-status-donut">
      <div>
        <strong>{total}</strong>
        <span>Tổng lịch hẹn</span>
      </div>
    </div>
  )
}

export function DoctorTodayAppointmentsScreen({ user }) {
  const toast = useToast()
  const [state, setState] = useState({ loading: true, error: '', data: { today: getTodayDate(), appointments: [], upcomingAppointments: [], summary: null, readiness: {} } })
  const [actingId, setActingId] = useState('')

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadTodayAppointments(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải lịch hẹn hôm nay.'),
        data: { today: getTodayDate(), appointments: [], upcomingAppointments: [], summary: null, readiness: {} },
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
            data: { today: getTodayDate(), appointments: [], upcomingAppointments: [], summary: null, readiness: {} },
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
    const upcoming = appointments.filter((item) => statusInfo(item).key === 'upcoming').length || safeArray(state.data.upcomingAppointments).length
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

  async function runAction(appointment, type) {
    const appointmentId = appointmentIdOf(appointment)
    if (!appointmentId) {
      toast.error('Không tìm thấy mã lịch hẹn.')
      return
    }

    const readiness = state.data.readiness[appointmentId]
    if (type === 'checkIn' && readiness?.canCheckIn && readiness.canCheckIn.can_check_in === false) {
      toast.warning('Backend chưa cho phép check-in lịch hẹn này.')
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
      if (type === 'checkIn') await doctorApi.appointments.checkIn(appointmentId)
      if (type === 'confirm') await doctorApi.appointments.confirm(appointmentId)
      if (type === 'complete') await doctorApi.appointments.complete(appointmentId)
      if (type === 'queue') await doctorApi.appointments.createQueueTicket(appointmentId)
      if (type === 'encounter') await doctorApi.appointments.createEncounter(appointmentId)
      if (type === 'noShow') await doctorApi.appointments.noShow(appointmentId)
      toast.success('Đã cập nhật lịch hẹn.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác lịch hẹn.'))
    } finally {
      setActingId('')
    }
  }

  return (
    <div className="doctor-appointment-today is-appointment-list">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

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
            ) : dashboard.appointments.length ? dashboard.appointments.slice(0, 10).map((appointment, index) => {
              const id = appointmentIdOf(appointment) || `appointment-${index}`
              const status = statusInfo(appointment)
              const canCheckIn = state.data.readiness[id]?.canCheckIn?.can_check_in !== false && !isCheckedIn(appointment)
              const canStart = isCheckedIn(appointment) && !isCompleted(appointment)
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
                    <button type="button" onClick={() => runAction(appointment, canCheckIn ? 'checkIn' : 'queue')} disabled={Boolean(actingId) || (!canCheckIn && !isCheckedIn(appointment))}>
                      <DoctorIcon name={canCheckIn ? 'check_circle' : 'message'} />
                      {canCheckIn ? 'Check-in' : 'Gọi'}
                    </button>
                    <button type="button" className="is-primary" onClick={() => runAction(appointment, canStart ? 'encounter' : isCompleted(appointment) ? 'complete' : 'confirm')} disabled={Boolean(actingId) || (!canStart && !isCompleted(appointment))}>
                      {isCompleted(appointment) ? 'Hoàn tất' : 'Bắt đầu khám'}
                    </button>
                  </span>
                </div>
              )
            }) : (
              <div className="doctor-appointment-empty">Chưa có lịch hẹn hôm nay.</div>
            )}
          </div>

          <footer className="doctor-appointment-list-footer">
            <button type="button">Hiển thị 10 dòng <DoctorIcon name="chevron_down" /></button>
            <div>
              <button type="button" disabled><DoctorIcon name="chevron_right" /></button>
              <button type="button" className="is-active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button"><DoctorIcon name="chevron_right" /></button>
            </div>
            <span>Hiển thị {dashboard.appointments.length ? `1 đến ${Math.min(10, dashboard.appointments.length)}` : '0'} của {dashboard.total} lịch hẹn</span>
          </footer>
        </article>

        <aside className="doctor-appointment-side">
          <article className="doctor-appointment-panel doctor-appointment-overview">
            <header>
              <h2>Tổng quan hôm nay</h2>
            </header>
            <div className="doctor-appointment-overview__top">
              <AppointmentDonut total={dashboard.total} />
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
            <button type="button">
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
            <button type="button">
              <span><DoctorIcon name="note" /></span>
              <b>Xuất lịch hẹn hôm nay</b>
              <small>Xuất file Excel danh sách lịch hẹn</small>
              <DoctorIcon name="chevron_right" />
            </button>
          </article>
        </aside>
      </section>
    </div>
  )
}
