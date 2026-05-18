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
  return appointment.appointment_time || appointment.scheduled_time || appointment.start_time || appointment.time || appointment.appointmentDate || appointment.appointment_date || appointment.scheduledAt || appointment.scheduled_at || appointment.date_time || ''
}

function patientName(appointment = {}) {
  const patient = appointment.patient || {}
  return appointment.patient_name || appointment.patientName || patient.fullName || patient.full_name || patient.name || appointment.full_name || 'Chưa có tên bệnh nhân'
}

function patientCode(appointment = {}) {
  const patient = appointment.patient || {}
  return appointment.patient_code || appointment.patientCode || patient.patientCode || patient.patient_code || patient.code || appointment.patient_id || ''
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
  return appointment.department_name || appointment.departmentName || appointment.specialty || appointment.specialty_name || appointment.department?.department_name || appointment.doctor?.specialty || '--'
}

function roomName(appointment = {}) {
  return appointment.room_name || appointment.roomName || appointment.clinic_room || appointment.clinicRoom || appointment.room || appointment.location || appointment.encounter?.room_name || '--'
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
  return appointment.encounter_code || appointment.encounter?.encounter_code || appointment.encounter_id || ''
}

function checkedInAt(appointment = {}) {
  return appointment.checkedInAt || appointment.checked_in_at || appointment.check_in_time || appointment.arrived_at || ''
}

function statusInfo(appointment = {}) {
  const raw = String(appointment.status || '').toLowerCase()
  if (['checked_in', 'checked-in', 'arrived'].includes(raw)) return { key: 'checked_in', label: 'Đã check-in', tone: 'green' }
  if (['waiting', 'queued', 'pending', 'requested'].includes(raw)) return { key: 'waiting', label: 'Đang chờ', tone: 'orange' }
  if (['completed', 'done', 'finished'].includes(raw)) return { key: 'completed', label: 'Đã hoàn tất', tone: 'green' }
  if (['no_show', 'no-show', 'missed'].includes(raw)) return { key: 'no_show', label: 'No-show', tone: 'slate' }
  if (['confirmed', 'approved', 'scheduled'].includes(raw)) return { key: 'confirmed', label: 'Đã xác nhận', tone: 'green' }
  if (['scheduled', 'booked'].includes(raw)) return { key: 'upcoming', label: 'Sắp tới', tone: 'blue' }
  if (['cancelled', 'canceled'].includes(raw)) return { key: 'cancelled', label: 'Đã hủy', tone: 'red' }
  if (['rescheduled', 'changed', 'moved'].includes(raw)) return { key: 'rescheduled', label: 'Dời lịch', tone: 'blue' }
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

async function loadAllAppointments() {
  const [searchResult, summary] = await Promise.all([
    doctorApi.appointments.searchPage({ limit: 300 }),
    settledValue(doctorApi.appointments.getSummary({}), null),
  ])

  const deduped = new Map()
  const sourceAppointments = safeArray(searchResult?.items || searchResult)
  sourceAppointments.forEach((appointment) => {
    const id = appointmentIdOf(appointment) || `${appointment.patient_id || patientName(appointment)}-${appointmentTime(appointment)}`
    if (id && !deduped.has(id)) deduped.set(id, appointment)
  })

  const appointments = Array.from(deduped.values()).sort((a, b) => new Date(appointmentTime(a)) - new Date(appointmentTime(b)))

  return {
    appointments,
    summary,
    readiness: {},
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

function AllAppointmentDonut({ total, dashboard }) {
  const confirmed = total ? Math.round((dashboard.confirmed / total) * 100) : 0
  const waiting = total ? Math.round((dashboard.waiting / total) * 100) : 0
  const checkedIn = total ? Math.round((dashboard.checkedIn / total) * 100) : 0
  const first = confirmed
  const second = confirmed + waiting
  const third = confirmed + waiting + checkedIn
  return (
    <div
      className="doctor-all-appointment-donut"
      style={{ background: `conic-gradient(#35c875 0 ${first}%, #ff9f1a ${first}% ${second}%, #2f86ff ${second}% ${third}%, #7c4dff ${third}% 100%)` }}
    >
      <div>
        <strong>{total}</strong>
        <span>Tổng lịch hẹn</span>
      </div>
    </div>
  )
}

export function DoctorAllAppointmentsScreen({ user }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', data: { appointments: [], summary: null, readiness: {} } })
  const [actingId, setActingId] = useState('')
  const [filters, setFilters] = useState({ search: '', status: 'all', department: 'all', room: 'all' })
  const [page, setPage] = useState(1)
  const [detailState, setDetailState] = useState({ loading: false, error: '', appointment: null, timeline: [] })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadAllAppointments()
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải danh sách lịch hẹn. Vui lòng thử lại sau.'),
        data: { appointments: [], summary: null, readiness: {} },
      }))
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadAllAppointments()
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải danh sách lịch hẹn. Vui lòng thử lại sau.'),
            data: { appointments: [], summary: null, readiness: {} },
          })
        }
      })

    return () => {
      active = false
    }
  }, [])

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
    const total = filtered.length
    const confirmed = filtered.filter(isConfirmed).length
    const waiting = filtered.filter((item) => ['waiting', 'upcoming'].includes(statusInfo(item).key)).length
    const checkedIn = filtered.filter(isCheckedIn).length
    const completed = filtered.filter(isCompleted).length
    const noShow = filtered.filter((item) => statusInfo(item).key === 'no_show').length
    const cancelled = filtered.filter((item) => statusInfo(item).key === 'cancelled').length
    const rescheduled = filtered.filter((item) => statusInfo(item).key === 'rescheduled').length
    const first = filtered[0] || null

    return {
      appointments,
      filtered,
      total,
      confirmed,
      waiting,
      checkedIn,
      completed,
      noShow,
      cancelled,
      rescheduled,
      confirmedRate: percent(confirmed, total),
      waitingRate: percent(waiting, total),
      checkedInRate: percent(checkedIn, total),
      completedRate: percent(completed, total),
      noShowRate: percent(noShow, total),
      first,
      peak: peakWindow(filtered),
      departments: uniqueOptions(appointments, departmentName),
      rooms: uniqueOptions(appointments, roomName),
    }
  }, [state.data, filters])

  const totalPages = Math.max(1, Math.ceil(dashboard.filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedAppointments = dashboard.filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = dashboard.filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(currentPage * PAGE_SIZE, dashboard.filtered.length)
  const firstPageButton = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)))
  const pageButtons = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPageButton + index)

  useEffect(() => {
    setPage(1)
  }, [filters])

  async function runAction(appointment, type) {
    const id = appointmentIdOf(appointment)
    if (!id) {
      toast.error('Không tìm thấy mã lịch hẹn.')
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

    if (type === 'detail') {
      openAppointmentDetail(appointment)
      return
    }

    if (type === 'reschedule') {
      toast.info('Endpoint đổi lịch chưa có trong danh sách action được cung cấp.')
      return
    }

    setActingId(`${type}:${id}`)
    try {
      if (type === 'confirm') await doctorApi.appointments.confirm(id)
      if (type === 'checkIn') {
        const readiness = await doctorApi.appointments.canCheckIn(id)
        if (readiness && readiness.can_check_in === false) {
          toast.warning(readiness.reason || readiness.message || 'Backend chưa cho phép check-in lịch hẹn này.')
          return
        }
        await doctorApi.appointments.checkIn(id)
      }
      if (type === 'queue') await doctorApi.appointments.createQueueTicket(id)
      if (type === 'encounter') {
        const encounter = await doctorApi.appointments.createEncounter(id)
        const encounterId = encounter?.encounter_id || encounter?.id || encounter?.encounter?.encounter_id || ''
        if (encounterId) navigate(`/doctor/encounters/${encodeURIComponent(encounterId)}`)
      }
      if (type === 'complete') await doctorApi.appointments.complete(id)
      toast.success('Đã cập nhật lịch hẹn.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác lịch hẹn.'))
    } finally {
      setActingId('')
    }
  }

  async function openAppointmentDetail(appointment) {
    const id = appointmentIdOf(appointment)
    if (!id) {
      setDetailState({ loading: false, error: 'Backend chưa trả mã lịch hẹn thật.', appointment, timeline: [] })
      return
    }

    setDetailState({ loading: true, error: '', appointment, timeline: [] })
    try {
      const [detail, timeline] = await Promise.all([
        doctorApi.appointments.getDetail(id),
        settledValue(doctorApi.appointments.getTimeline(id), []),
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

  function exportAppointments() {
    if (!dashboard.filtered.length) {
      toast.warning('Không có dữ liệu để xuất.')
      return
    }

    downloadCsv(`appointments-${getTodayDate()}.csv`, [
      ['Ngay', 'Gio hen', 'Benh nhan', 'Ma benh nhan', 'Chuyen khoa', 'Ly do kham', 'Trang thai', 'Xac nhan', 'Check-in', 'Hang doi', 'Phong kham', 'Phien kham'],
      ...dashboard.filtered.map((appointment) => {
        const status = statusInfo(appointment)
        return [
          displayDate(appointmentTime(appointment)),
          formatTime(appointmentTime(appointment)),
          patientName(appointment),
          patientCode(appointment),
          departmentName(appointment),
          visitReason(appointment),
          status.label,
          isConfirmed(appointment) ? 'Da xac nhan' : '',
          checkedInAt(appointment) ? formatTime(checkedInAt(appointment)) : isCheckedIn(appointment) ? 'Da check-in' : '',
          queueNumber(appointment),
          roomName(appointment),
          encounterRoom(appointment),
        ]
      }),
    ])
  }

  return (
    <div className="doctor-all-appointments-page">
      {state.error ? (
        <div className="doctor-today-error">
          <span>{state.error}</span>
          <button type="button" onClick={reload}>Thử lại</button>
        </div>
      ) : null}

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
            <button type="button" className="is-filter" onClick={() => setPage(1)}><DoctorIcon name="settings" /> Bộ lọc</button>
            <button type="button" onClick={() => setFilters({ search: '', status: 'all', department: 'all', room: 'all' })}><DoctorIcon name="refresh" /> Đặt lại</button>
          </div>

          <div className="doctor-all-appointment-table-scroll">
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
              ) : pagedAppointments.length ? pagedAppointments.map((appointment, index) => {
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
          </div>

          <footer className="doctor-all-appointment-footer">
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
            <span>Hiển thị {dashboard.filtered.length ? `${pageStart} đến ${pageEnd}` : '0'} của {dashboard.total} lịch hẹn</span>
          </footer>
        </article>

        <aside className="doctor-all-appointment-side">
          <article className="doctor-all-appointment-panel doctor-all-appointment-overview">
            <header>
              <h2>Tổng quan lịch hẹn</h2>
            </header>
            <div className="doctor-all-appointment-overview__top">
              <AllAppointmentDonut total={dashboard.total} dashboard={dashboard} />
              <dl>
                <div><dt><i className="is-green" /> Đã xác nhận</dt><dd>{dashboard.confirmed} ({dashboard.confirmedRate}%)</dd></div>
                <div><dt><i className="is-orange" /> Đang chờ</dt><dd>{dashboard.waiting} ({dashboard.waitingRate}%)</dd></div>
                <div><dt><i className="is-blue" /> Đã check-in</dt><dd>{dashboard.checkedIn} ({dashboard.checkedInRate}%)</dd></div>
                <div><dt><i className="is-purple" /> Đã hoàn tất</dt><dd>{dashboard.completed} ({dashboard.completedRate}%)</dd></div>
                <div><dt><i className="is-orange" /> Đã hủy</dt><dd>{dashboard.cancelled}</dd></div>
                <div><dt><i className="is-blue" /> Dời lịch</dt><dd>{dashboard.rescheduled}</dd></div>
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
            <button type="button" onClick={() => toast.info('Chưa có route tạo lịch hẹn riêng trong doctor workspace.')}>
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
            <button type="button" onClick={exportAppointments}>
              <span><DoctorIcon name="note" /></span>
              <b>Xuất danh sách</b>
              <small>Xuất file Excel danh sách lịch hẹn</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={() => navigate('/doctor/appointments?view=today')}>
              <span><DoctorIcon name="calendar" /></span>
              <b>Xem lịch hẹn hôm nay</b>
              <small>{longDate(new Date())}</small>
              <DoctorIcon name="chevron_right" />
            </button>
          </article>
        </aside>
      </section>
      {detailState.loading || detailState.error || detailState.appointment ? (
        <div
          className="doctor-today-modal-backdrop"
          role="presentation"
          onClick={() => setDetailState({ loading: false, error: '', appointment: null, timeline: [] })}
        >
          <section className="doctor-today-modal" role="dialog" aria-modal="true" aria-labelledby="all-appointment-detail-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2 id="all-appointment-detail-title">Chi tiết lịch hẹn</h2>
                <p>{detailState.appointment ? `${patientName(detailState.appointment)} - ${displayDate(appointmentTime(detailState.appointment))} ${formatTime(appointmentTime(detailState.appointment))}` : 'Đang tải dữ liệu lịch hẹn'}</p>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setDetailState({ loading: false, error: '', appointment: null, timeline: [] })}>×</button>
            </header>

            <div className="doctor-today-modal-schedules">
              {detailState.loading ? (
                <div className="doctor-appointment-empty">Đang tải chi tiết lịch hẹn...</div>
              ) : detailState.error ? (
                <div className="doctor-appointment-empty">{detailState.error}</div>
              ) : detailState.appointment ? (
                <>
                  <div className="doctor-today-modal-info">
                    <span>
                      <strong>{patientName(detailState.appointment)}</strong>
                      <small>{patientCode(detailState.appointment) || appointmentIdOf(detailState.appointment) || '--'}</small>
                    </span>
                    <span>{departmentName(detailState.appointment)}</span>
                    <span>{statusInfo(detailState.appointment).label}</span>
                  </div>
                  <div className="doctor-today-modal-info">
                    <span>
                      <strong>{displayDate(appointmentTime(detailState.appointment))} {formatTime(appointmentTime(detailState.appointment))}</strong>
                      <small>{visitReason(detailState.appointment)}</small>
                    </span>
                    <span>{roomName(detailState.appointment)}</span>
                    <span>{queueNumber(detailState.appointment) || encounterRoom(detailState.appointment) || '--'}</span>
                  </div>
                  {detailState.timeline.length ? detailState.timeline.map((entry, index) => (
                    <div className="doctor-today-modal-info" key={entry.id || entry.timeline_id || index}>
                      <span>
                        <strong>{entry.title || entry.action || entry.status || 'Cập nhật lịch hẹn'}</strong>
                        <small>{entry.note || entry.description || entry.message || '--'}</small>
                      </span>
                      <span>{displayDate(entry.created_at || entry.timestamp || entry.time)}</span>
                      <span>{formatTime(entry.created_at || entry.timestamp || entry.time)}</span>
                    </div>
                  )) : (
                    <div className="doctor-appointment-empty">Chưa có timeline cho lịch hẹn này.</div>
                  )}
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
