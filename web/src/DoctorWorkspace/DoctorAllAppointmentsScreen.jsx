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

function displayDate(value) {
  const key = toDateKey(value)
  if (!key) return '--'
  const [, month, day] = key.split('-')
  return `${day}/${month}`
}

function longDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed)
}

function rangeText(appointments = []) {
  const dates = appointments.map((item) => toDateKey(appointmentTime(item))).filter(Boolean).sort()
  if (!dates.length) return `${getTodayDate()} - ${getTodayDate()}`
  const first = dates[0].split('-').reverse().join('/')
  const last = dates[dates.length - 1].split('-').reverse().join('/')
  return `${first} - ${last}`
}

function numberFrom(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function percent(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 1000) / 10
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
  return [gender, age ? `${age} tuổi` : '', patientCode(appointment) ? `#${patientCode(appointment)}` : ''].filter(Boolean).join(' · ')
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
  return appointment.department_name || appointment.specialty || appointment.specialty_name || appointment.department?.department_name || appointment.doctor?.specialty || 'Khoa Khám bệnh'
}

function roomName(appointment = {}) {
  return appointment.room_name || appointment.clinic_room || appointment.room || appointment.location || appointment.encounter?.room_name || 'PK'
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
  return appointment.encounter_code || appointment.encounter?.encounter_code || appointment.encounter_id || ''
}

function checkedInAt(appointment = {}) {
  return appointment.checked_in_at || appointment.check_in_time || appointment.arrived_at || ''
}

function statusInfo(appointment = {}) {
  const raw = String(appointment.status || '').toLowerCase()
  if (['checked_in', 'arrived'].includes(raw)) return { key: 'checked_in', label: 'Đã check-in', tone: 'green' }
  if (['waiting', 'queued', 'pending'].includes(raw)) return { key: 'waiting', label: 'Đang chờ', tone: 'orange' }
  if (['completed', 'done', 'finished'].includes(raw)) return { key: 'completed', label: 'Đã hoàn tất', tone: 'green' }
  if (['no_show'].includes(raw)) return { key: 'no_show', label: 'No-show', tone: 'slate' }
  if (['confirmed'].includes(raw)) return { key: 'confirmed', label: 'Đã xác nhận', tone: 'green' }
  if (['scheduled', 'booked'].includes(raw)) return { key: 'upcoming', label: 'Sắp tới', tone: 'blue' }
  if (['cancelled', 'canceled'].includes(raw)) return { key: 'cancelled', label: 'Đã hủy', tone: 'red' }
  if (['in_progress', 'serving', 'examining'].includes(raw)) return { key: 'in_progress', label: 'Đang khám', tone: 'blue' }
  return { key: raw || 'upcoming', label: raw ? raw.replace(/_/g, ' ') : 'Sắp tới', tone: 'blue' }
}

function isCheckedIn(appointment = {}) {
  const key = statusInfo(appointment).key
  return ['checked_in', 'waiting', 'in_progress', 'completed'].includes(key) || Boolean(checkedInAt(appointment))
}

function isConfirmed(appointment = {}) {
  return ['confirmed', 'checked_in', 'waiting', 'in_progress', 'completed'].includes(statusInfo(appointment).key)
}

function isCompleted(appointment = {}) {
  return statusInfo(appointment).key === 'completed'
}

function peakWindow(appointments = []) {
  const buckets = new Map()
  appointments.forEach((appointment) => {
    const date = new Date(appointmentTime(appointment))
    if (Number.isNaN(date.getTime())) return
    const hour = date.getHours()
    const key = `${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  })
  let best = ''
  let count = 0
  buckets.forEach((value, key) => {
    if (value > count) {
      best = key
      count = value
    }
  })
  return best || '--'
}

function uniqueOptions(appointments, getter) {
  return Array.from(new Set(appointments.map(getter).filter(Boolean))).sort()
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

async function loadAllAppointments(user) {
  const doctorId = getDoctorId(user)
  const [allAppointments, doctorAppointments, todayAppointments, upcomingAppointments, summary] = await Promise.all([
    settledValue(doctorApi.appointments.listAll({ doctor_id: doctorId, limit: 300 }), []),
    doctorId ? settledValue(doctorApi.appointments.listByDoctor(doctorId, { limit: 300 }), []) : Promise.resolve([]),
    settledValue(doctorApi.appointments.listToday({ date: getTodayDate(), doctor_id: doctorId, limit: 200 }), []),
    settledValue(doctorApi.appointments.listUpcoming({ doctor_id: doctorId, limit: 200 }), []),
    settledValue(doctorApi.appointments.getSummary({ doctor_id: doctorId }), null),
  ])

  const deduped = new Map()
  ;[...safeArray(allAppointments), ...safeArray(doctorAppointments), ...safeArray(todayAppointments), ...safeArray(upcomingAppointments)].forEach((appointment) => {
    const id = appointmentIdOf(appointment) || `${appointment.patient_id || patientName(appointment)}-${appointmentTime(appointment)}`
    if (id && !deduped.has(id)) deduped.set(id, appointment)
  })

  const appointments = Array.from(deduped.values()).sort((a, b) => new Date(appointmentTime(a)) - new Date(appointmentTime(b)))
  const readinessEntries = await Promise.all(
    appointments.slice(0, 25).map(async (appointment) => {
      const id = appointmentIdOf(appointment)
      if (!id) return null
      const readiness = await settledValue(doctorApi.appointments.getReadChecks(id), null)
      return [id, readiness]
    }),
  )

  return {
    appointments,
    summary,
    readiness: Object.fromEntries(readinessEntries.filter(Boolean)),
  }
}

function AllAppointmentKpi({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-all-appointment-kpi">
      <span className={`doctor-all-appointment-kpi__icon is-${tone}`}>
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

function AllAppointmentDonut({ total }) {
  return (
    <div className="doctor-all-appointment-donut">
      <div>
        <strong>{total}</strong>
        <span>Tổng lịch hẹn</span>
      </div>
    </div>
  )
}

export function DoctorAllAppointmentsScreen({ user }) {
  const toast = useToast()
  const [state, setState] = useState({ loading: true, error: '', data: { appointments: [], summary: null, readiness: {} } })
  const [actingId, setActingId] = useState('')
  const [filters, setFilters] = useState({ search: '', status: 'all', department: 'all', room: 'all' })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadAllAppointments(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải tất cả lịch hẹn.'),
        data: { appointments: [], summary: null, readiness: {} },
      }))
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadAllAppointments(user)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải tất cả lịch hẹn.'),
            data: { appointments: [], summary: null, readiness: {} },
          })
        }
      })

    return () => {
      active = false
    }
  }, [user])

  const dashboard = useMemo(() => {
    const appointments = safeArray(state.data.appointments)
    const query = filters.search.trim().toLowerCase()
    const filtered = appointments.filter((appointment) => {
      const status = statusInfo(appointment).key
      const text = [patientName(appointment), patientCode(appointment), departmentName(appointment), roomName(appointment), visitReason(appointment), appointmentIdOf(appointment)]
        .join(' ')
        .toLowerCase()
      return (
        (!query || text.includes(query)) &&
        (filters.status === 'all' || status === filters.status) &&
        (filters.department === 'all' || departmentName(appointment) === filters.department) &&
        (filters.room === 'all' || roomName(appointment) === filters.room)
      )
    })
    const summary = state.data.summary || {}
    const total = numberFrom(summary, ['total_appointments', 'appointments_count', 'total'], appointments.length)
    const confirmed = numberFrom(summary, ['confirmed_count', 'confirmed'], appointments.filter(isConfirmed).length)
    const waiting = numberFrom(summary, ['waiting_count', 'pending_count', 'waiting', 'pending'], appointments.filter((item) => ['waiting', 'upcoming'].includes(statusInfo(item).key)).length)
    const checkedIn = numberFrom(summary, ['checked_in_count', 'checkedIn', 'checked_in'], appointments.filter(isCheckedIn).length)
    const completed = numberFrom(summary, ['completed_count', 'completed'], appointments.filter(isCompleted).length)
    const noShow = numberFrom(summary, ['no_show_count', 'noShow', 'no_show'], appointments.filter((item) => statusInfo(item).key === 'no_show').length)
    const first = appointments[0] || null

    return {
      appointments,
      filtered,
      total,
      confirmed,
      waiting,
      checkedIn,
      completed,
      noShow,
      confirmedRate: percent(confirmed, total),
      waitingRate: percent(waiting, total),
      checkedInRate: percent(checkedIn, total),
      completedRate: percent(completed, total),
      noShowRate: percent(noShow, total),
      first,
      peak: peakWindow(appointments),
      departments: uniqueOptions(appointments, departmentName),
      rooms: uniqueOptions(appointments, roomName),
    }
  }, [state.data, filters])

  async function runAction(appointment, type) {
    const id = appointmentIdOf(appointment)
    if (!id) {
      toast.error('Không tìm thấy mã lịch hẹn.')
      return
    }

    const readiness = state.data.readiness[id]
    if (type === 'checkIn' && readiness?.canCheckIn && readiness.canCheckIn.can_check_in === false) {
      toast.warning('Backend chưa cho phép check-in lịch hẹn này.')
      return
    }
    if (type === 'reschedule' && readiness?.canReschedule && readiness.canReschedule.can_reschedule === false) {
      toast.warning('Backend chưa cho phép đổi lịch hẹn này.')
      return
    }
    if (type === 'queue' && !isCheckedIn(appointment)) {
      toast.warning('Chỉ tạo hàng đợi sau khi bệnh nhân đã check-in.')
      return
    }
    if (type === 'encounter' && !isCheckedIn(appointment)) {
      toast.warning('Chỉ tạo phiên khám sau khi bệnh nhân đã check-in.')
      return
    }

    if (type === 'reschedule' || type === 'detail') {
      toast.info(type === 'reschedule' ? 'Endpoint đổi lịch chưa có trong danh sách action được cung cấp.' : 'Chi tiết lịch hẹn sẽ dùng endpoint detail khi mở drawer chi tiết.')
      return
    }

    setActingId(`${type}:${id}`)
    try {
      if (type === 'confirm') await doctorApi.appointments.confirm(id)
      if (type === 'checkIn') await doctorApi.appointments.checkIn(id)
      if (type === 'queue') await doctorApi.appointments.createQueueTicket(id)
      if (type === 'encounter') await doctorApi.appointments.createEncounter(id)
      if (type === 'complete') await doctorApi.appointments.complete(id)
      toast.success('Đã cập nhật lịch hẹn.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác lịch hẹn.'))
    } finally {
      setActingId('')
    }
  }

  return (
    <div className="doctor-all-appointments-page">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

      <section className="doctor-all-appointment-kpis" aria-label="Tổng quan tất cả lịch hẹn">
        <AllAppointmentKpi icon="calendar" tone="blue" label="Tổng lịch hẹn" value={dashboard.total} hint="100% tổng số lịch hẹn" />
        <AllAppointmentKpi icon="check_circle" tone="green" label="Đã xác nhận" value={dashboard.confirmed} hint={`${dashboard.confirmedRate}% tổng số lịch hẹn`} />
        <AllAppointmentKpi icon="clock" tone="orange" label="Đang chờ" value={dashboard.waiting} hint={`${dashboard.waitingRate}% tổng số lịch hẹn`} />
        <AllAppointmentKpi icon="check_circle" tone="purple" label="Đã hoàn tất" value={dashboard.completed} hint={`${dashboard.completedRate}% tổng số lịch hẹn`} />
      </section>

      <section className="doctor-all-appointment-layout">
        <article className="doctor-all-appointment-panel doctor-all-appointment-list">
          <header>
            <h2>Danh sách tất cả lịch hẹn</h2>
          </header>

          <div className="doctor-all-appointment-filters">
            <label>
              <DoctorIcon name="search" />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Tìm bệnh nhân hoặc mã lịch hẹn"
              />
            </label>
            <button type="button"><DoctorIcon name="calendar" /> {rangeText(dashboard.appointments)} <DoctorIcon name="chevron_down" /></button>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="all">Tất cả trạng thái</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="checked_in">Đã check-in</option>
              <option value="waiting">Đang chờ</option>
              <option value="upcoming">Sắp tới</option>
              <option value="completed">Đã hoàn tất</option>
              <option value="no_show">No-show</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <select value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
              <option value="all">Tất cả chuyên khoa</option>
              {dashboard.departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select value={filters.room} onChange={(event) => setFilters((current) => ({ ...current, room: event.target.value }))}>
              <option value="all">Tất cả phòng khám</option>
              {dashboard.rooms.map((room) => <option key={room} value={room}>{room}</option>)}
            </select>
            <button type="button" className="is-filter"><DoctorIcon name="settings" /> Bộ lọc</button>
            <button type="button" onClick={() => setFilters({ search: '', status: 'all', department: 'all', room: 'all' })}><DoctorIcon name="refresh" /> Đặt lại</button>
          </div>

          <div className="doctor-all-appointment-head">
            <span>Ngày</span>
            <span>Giờ hẹn</span>
            <span>Bệnh nhân</span>
            <span>Chuyên khoa / Lý do khám</span>
            <span>Trạng thái</span>
            <span>Xác nhận</span>
            <span>Check-in</span>
            <span>Hàng đợi</span>
            <span>Phiên khám</span>
            <span>Thao tác</span>
          </div>

          <div className="doctor-all-appointment-body">
            {state.loading ? (
              <div className="doctor-appointment-empty">Đang tải tất cả lịch hẹn...</div>
            ) : dashboard.filtered.length ? dashboard.filtered.slice(0, 10).map((appointment, index) => {
              const id = appointmentIdOf(appointment) || `all-appointment-${index}`
              const status = statusInfo(appointment)
              const checkedIn = isCheckedIn(appointment)
              const completed = isCompleted(appointment)
              const canConfirm = !isConfirmed(appointment) && status.key !== 'cancelled'
              const primaryAction = !checkedIn ? 'checkIn' : appointment.encounter_id ? 'detail' : 'encounter'
              const primaryLabel = !checkedIn ? 'Check-in' : appointment.encounter_id ? 'Xem chi tiết' : 'Tạo encounter'
              return (
                <div className="doctor-all-appointment-row" key={id}>
                  <strong>{displayDate(appointmentTime(appointment))}</strong>
                  <span>{formatTime(appointmentTime(appointment))}</span>
                  <span className="doctor-all-appointment-patient">
                    <em>{patientInitials(appointment)}</em>
                    <b>{patientName(appointment)}</b>
                    <small>{patientMeta(appointment)}</small>
                  </span>
                  <span className="doctor-all-appointment-reason">
                    <b>{departmentName(appointment)}</b>
                    <small>{visitReason(appointment)}</small>
                  </span>
                  <span><i className={`is-${status.tone}`}>{status.label}</i></span>
                  <span className="doctor-all-appointment-check">{isConfirmed(appointment) ? <DoctorIcon name="check_circle" /> : '-'}</span>
                  <span className="doctor-all-appointment-check">{checkedInAt(appointment) ? formatTime(checkedInAt(appointment)) : checkedIn ? <DoctorIcon name="check_circle" /> : '-'}</span>
                  <span>{queueNumber(appointment) || '-'}</span>
                  <span>{encounterRoom(appointment) || '-'}</span>
                  <span className="doctor-all-appointment-actions">
                    {canConfirm ? (
                      <button type="button" onClick={() => runAction(appointment, 'confirm')} disabled={Boolean(actingId)}>Xác nhận</button>
                    ) : (
                      <button type="button" onClick={() => runAction(appointment, primaryAction)} disabled={Boolean(actingId) || completed}>{primaryLabel}</button>
                    )}
                    <button type="button" className="is-outline" onClick={() => runAction(appointment, completed ? 'detail' : 'reschedule')}>
                      {completed ? 'Xem chi tiết' : 'Đổi lịch'}
                    </button>
                    <button type="button" className="is-more" aria-label="Thêm thao tác"><DoctorIcon name="more" /></button>
                  </span>
                </div>
              )
            }) : (
              <div className="doctor-appointment-empty">Chưa có lịch hẹn phù hợp bộ lọc.</div>
            )}
          </div>

          <footer className="doctor-all-appointment-footer">
            <button type="button">Hiển thị 10 dòng <DoctorIcon name="chevron_down" /></button>
            <div>
              <button type="button" disabled><DoctorIcon name="chevron_right" /></button>
              <button type="button" className="is-active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">4</button>
              <button type="button">5</button>
              <button type="button"><DoctorIcon name="chevron_right" /></button>
            </div>
            <span>Hiển thị {dashboard.filtered.length ? `1 đến ${Math.min(10, dashboard.filtered.length)}` : '0'} của {dashboard.total} lịch hẹn</span>
          </footer>
        </article>

        <aside className="doctor-all-appointment-side">
          <article className="doctor-all-appointment-panel doctor-all-appointment-overview">
            <header>
              <h2>Tổng quan lịch hẹn</h2>
            </header>
            <div className="doctor-all-appointment-overview__top">
              <AllAppointmentDonut total={dashboard.total} />
              <dl>
                <div><dt><i className="is-green" /> Đã xác nhận</dt><dd>{dashboard.confirmed} ({dashboard.confirmedRate}%)</dd></div>
                <div><dt><i className="is-orange" /> Đang chờ</dt><dd>{dashboard.waiting} ({dashboard.waitingRate}%)</dd></div>
                <div><dt><i className="is-blue" /> Đã check-in</dt><dd>{dashboard.checkedIn} ({dashboard.checkedInRate}%)</dd></div>
                <div><dt><i className="is-purple" /> Đã hoàn tất</dt><dd>{dashboard.completed} ({dashboard.completedRate}%)</dd></div>
              </dl>
            </div>
            <div className="doctor-all-appointment-overview__list">
              <div><DoctorIcon name="check_circle" /><span>Tỷ lệ check-in</span><strong>{dashboard.checkedInRate}% ({dashboard.checkedIn}/{dashboard.total || 0})</strong></div>
              <div><DoctorIcon name="pulse" /><span>Tỷ lệ no-show</span><strong>{dashboard.noShowRate}% ({dashboard.noShow}/{dashboard.total || 0})</strong></div>
              <div><DoctorIcon name="clock" /><span>Khung giờ đông lịch</span><strong>{dashboard.peak}</strong></div>
              <div><DoctorIcon name="patients" /><span>Bác sĩ phụ trách</span><strong>{doctorName(dashboard.first || {}, user)}</strong></div>
              <div><DoctorIcon name="patients" /><span>Khoa / Phòng khám</span><strong>{dashboard.first ? `${departmentName(dashboard.first)} / ${roomName(dashboard.first)}` : '--'}</strong></div>
            </div>
          </article>

          <article className="doctor-all-appointment-panel doctor-all-appointment-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button">
              <span><DoctorIcon name="calendar" /></span>
              <b>Tạo lịch hẹn mới</b>
              <small>Tạo lịch hẹn cho bệnh nhân</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={reload} disabled={state.loading}>
              <span><DoctorIcon name="refresh" /></span>
              <b>Làm mới danh sách</b>
              <small>Cập nhật danh sách lịch hẹn</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={() => toast.info('Chưa có endpoint xuất file trong danh sách API được cung cấp.')}>
              <span><DoctorIcon name="note" /></span>
              <b>Xuất danh sách</b>
              <small>Xuất file Excel danh sách lịch hẹn</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={() => setFilters((current) => ({ ...current, search: '', status: 'waiting' }))}>
              <span><DoctorIcon name="calendar" /></span>
              <b>Xem lịch hẹn hôm nay</b>
              <small>{longDate(new Date())}</small>
              <DoctorIcon name="chevron_right" />
            </button>
          </article>
        </aside>
      </section>
    </div>
  )
}
