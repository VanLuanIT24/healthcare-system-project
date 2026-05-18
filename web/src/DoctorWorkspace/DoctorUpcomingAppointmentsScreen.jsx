import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctorApi } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { DoctorIcon } from './DoctorShell'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5
const RANGE_OFFSETS = [0, 1, 2]

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

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function dateRange(offset = 0) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + offset * 7)
  const end = addDays(start, 6)
  return { start, end, date_from: toDateKey(start), date_to: toDateKey(end) }
}

function shortDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(parsed)
}

function rangeText(range) {
  const start = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(range.start)
  const end = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(range.end)
  return `${start} - ${end}`
}

function numberFrom(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
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
  return appointment.department_name || appointment.departmentName || appointment.specialty || appointment.specialty_name || appointment.department?.department_name || '--'
}

function roomName(appointment = {}) {
  return appointment.room_name || appointment.roomName || appointment.clinic_room || appointment.clinicRoom || appointment.room || appointment.location || '--'
}

function doctorName(appointment = {}, user = {}) {
  const doctor = appointment.doctor || {}
  return appointment.doctor_name || doctor.full_name || doctor.name || user.full_name || user.name || 'Bác sĩ'
}

function visitReason(appointment = {}) {
  return appointment.reason || appointment.visit_reason || appointment.note || appointment.notes || appointment.chief_complaint || appointment.appointment_type || '--'
}

function statusInfo(appointment = {}) {
  const raw = String(appointment.status || '').toLowerCase()
  if (['confirmed', 'approved', 'scheduled'].includes(raw)) return { key: 'confirmed', label: 'Đã xác nhận', tone: 'green' }
  if (['pending', 'waiting', 'requested', 'booked'].includes(raw)) return { key: 'pending', label: 'Chờ xác nhận', tone: 'orange' }
  if (['needs_preparation', 'preparation', 'requires_review'].includes(raw)) return { key: 'prepare', label: 'Cần chuẩn bị', tone: 'purple' }
  if (['checked_in', 'checked-in', 'arrived'].includes(raw)) return { key: 'checked_in', label: 'Đã check-in', tone: 'green' }
  if (['completed', 'done', 'finished'].includes(raw)) return { key: 'completed', label: 'Đã hoàn tất', tone: 'green' }
  if (['no_show', 'no-show', 'missed'].includes(raw)) return { key: 'no_show', label: 'No-show', tone: 'slate' }
  if (['cancelled', 'canceled'].includes(raw)) return { key: 'cancelled', label: 'Đã hủy', tone: 'red' }
  if (['rescheduled', 'changed', 'moved'].includes(raw)) return { key: 'rescheduled', label: 'Dời lịch', tone: 'blue' }
  return { key: raw || 'pending', label: raw ? raw.replace(/_/g, ' ') : 'Chờ xác nhận', tone: 'orange' }
}

function needsPreparation(appointment = {}) {
  const raw = String(appointment.status || '').toLowerCase()
  return Boolean(
    appointment.requires_preparation ||
    appointment.needs_preparation ||
    appointment.has_pending_orders ||
    appointment.has_documents_to_review ||
    raw.includes('preparation') ||
    raw.includes('review'),
  )
}

function peakWindow(appointments = []) {
  const buckets = new Map()
  appointments.forEach((appointment) => {
    const date = new Date(appointmentTime(appointment))
    if (Number.isNaN(date.getTime())) return
    const start = date.getHours()
    const key = `${String(start).padStart(2, '0')}:00 - ${String(start + 1).padStart(2, '0')}:00`
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

function busiestDate(appointments = []) {
  const buckets = new Map()
  appointments.forEach((appointment) => {
    const key = toDateKey(appointmentTime(appointment))
    if (!key) return
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
  return best ? `${shortDate(best)} (${count})` : '--'
}

function queueNumber(appointment = {}) {
  return appointment.queue_number || appointment.queue_ticket?.queue_number || appointment.queue?.queue_number || ''
}

function checkedInAt(appointment = {}) {
  return appointment.checkedInAt || appointment.checked_in_at || appointment.check_in_time || appointment.arrived_at || ''
}

function encounterIdOf(appointment = {}) {
  return appointment.encounter_id || appointment.encounter?.encounter_id || appointment.encounter?.id || ''
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

async function loadUpcomingAppointments(rangeOffset = 0) {
  const today = getTodayDate()
  const range = dateRange(rangeOffset)
  const [upcoming, summary] = await Promise.all([
    doctorApi.appointments.listUpcoming({ date_from: range.date_from, date_to: range.date_to, limit: 200 }),
    settledValue(doctorApi.appointments.getSummary({ date_from: range.date_from, date_to: range.date_to }), null),
  ])

  const combined = safeArray(upcoming)
  const deduped = new Map()
  combined.forEach((appointment) => {
    const id = appointmentIdOf(appointment) || `${appointment.patient_id || patientName(appointment)}-${appointmentTime(appointment)}`
    if (id && !deduped.has(id)) deduped.set(id, appointment)
  })

  const appointments = Array.from(deduped.values())
    .filter((appointment) => {
      const value = appointmentTime(appointment)
      if (!value) return true
      const key = toDateKey(value)
      return key >= today && key <= range.date_to
    })
    .sort((a, b) => new Date(appointmentTime(a)) - new Date(appointmentTime(b)))

  return {
    appointments,
    range,
    summary,
    readiness: {},
  }
}

function cycleFilterValue(current, values = []) {
  const options = ['all', ...values.filter(Boolean)]
  const index = options.indexOf(current)
  return options[(index + 1) % options.length] || 'all'
}

function filterLabel(value, fallback) {
  return !value || value === 'all' ? fallback : value
}

function nextRangeOffset(current) {
  const index = RANGE_OFFSETS.indexOf(current)
  return RANGE_OFFSETS[(index + 1) % RANGE_OFFSETS.length] ?? 0
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

function UpcomingKpi({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-upcoming-kpi">
      <span className={`doctor-upcoming-kpi__icon is-${tone}`}>
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

function UpcomingDonut({ total, dashboard }) {
  const confirmed = total ? Math.round((dashboard.confirmed / total) * 100) : 0
  const pending = total ? Math.round((dashboard.pending / total) * 100) : 0
  const cancelled = total ? Math.round((dashboard.cancelled / total) * 100) : 0
  const first = confirmed
  const second = confirmed + pending
  const third = confirmed + pending + cancelled
  return (
    <div
      className="doctor-upcoming-donut"
      style={{ background: `conic-gradient(#35c875 0 ${first}%, #ff9f1a ${first}% ${second}%, #ef4444 ${second}% ${third}%, #7c4dff ${third}% 100%)` }}
    >
      <div>
        <strong>{total}</strong>
        <span>Tổng lịch</span>
      </div>
    </div>
  )
}

export function DoctorUpcomingAppointmentsScreen({ user }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', data: { appointments: [], range: dateRange(), summary: null, readiness: {} } })
  const [actingId, setActingId] = useState('')
  const [rangeOffset, setRangeOffset] = useState(0)
  const [filters, setFilters] = useState({ search: '', department: 'all', status: 'all' })
  const [page, setPage] = useState(1)
  const [detailState, setDetailState] = useState({ loading: false, error: '', appointment: null, timeline: [] })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadUpcomingAppointments(rangeOffset)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải lịch hẹn sắp tới.'),
        data: { appointments: [], range: dateRange(), summary: null, readiness: {} },
      }))
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadUpcomingAppointments(rangeOffset)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải lịch hẹn sắp tới.'),
            data: { appointments: [], range: dateRange(), summary: null, readiness: {} },
          })
        }
      })

    return () => {
      active = false
    }
  }, [rangeOffset])

  const dashboard = useMemo(() => {
    const rawAppointments = safeArray(state.data.appointments)
    const filterOptions = {
      departments: Array.from(new Set(rawAppointments.map(departmentName).filter(Boolean))).sort(),
      statuses: Array.from(new Set(rawAppointments.map((appointment) => statusInfo(appointment).label).filter(Boolean))).sort(),
    }
    const appointments = rawAppointments.filter((appointment) => {
      const search = filters.search.trim().toLowerCase()
      const matchedSearch = !search || [
        appointmentIdOf(appointment),
        patientName(appointment),
        patientCode(appointment),
        departmentName(appointment),
        visitReason(appointment),
      ].some((value) => String(value || '').toLowerCase().includes(search))
      const matchedDepartment = filters.department === 'all' || departmentName(appointment) === filters.department
      const matchedStatus = filters.status === 'all' || statusInfo(appointment).label === filters.status
      return matchedSearch && matchedDepartment && matchedStatus
    })
    const summary = state.data.summary || {}
    const hasClientFilter = Boolean(filters.search.trim()) || filters.department !== 'all' || filters.status !== 'all'
    const total = hasClientFilter ? appointments.length : numberFrom(summary, ['total_upcoming', 'total_appointments', 'appointments_count', 'total'], appointments.length)
    const confirmed = hasClientFilter ? appointments.filter((item) => statusInfo(item).key === 'confirmed').length : numberFrom(summary, ['confirmed_count', 'confirmed'], appointments.filter((item) => statusInfo(item).key === 'confirmed').length)
    const pending = hasClientFilter ? appointments.filter((item) => statusInfo(item).key === 'pending').length : numberFrom(summary, ['pending_count', 'waiting_count', 'pending'], appointments.filter((item) => statusInfo(item).key === 'pending').length)
    const prepare = hasClientFilter ? appointments.filter(needsPreparation).length : numberFrom(summary, ['preparation_count', 'needs_preparation_count', 'requires_review_count'], appointments.filter(needsPreparation).length)
    const cancelled = appointments.filter((item) => statusInfo(item).key === 'cancelled').length
    const rescheduled = appointments.filter((item) => statusInfo(item).key === 'rescheduled').length
    const soon = appointments.filter((item) => ['confirmed', 'pending'].includes(statusInfo(item).key)).length
    const confirmRate = total ? Math.round((confirmed / total) * 1000) / 10 : 0
    const pendingRate = total ? Math.round((pending / total) * 1000) / 10 : 0
    const prepareRate = total ? Math.round((prepare / total) * 1000) / 10 : 0
    const first = appointments[0] || null

    return {
      appointments,
      total,
      confirmed,
      pending,
      prepare,
      cancelled,
      rescheduled,
      soon,
      confirmRate,
      pendingRate,
      prepareRate,
      first,
      peak: peakWindow(appointments),
      busiest: busiestDate(appointments),
      filterOptions,
    }
  }, [state.data, filters])

  const totalPages = Math.max(1, Math.ceil(dashboard.appointments.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedAppointments = dashboard.appointments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = dashboard.appointments.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(currentPage * PAGE_SIZE, dashboard.appointments.length)
  const firstPageButton = Math.max(1, Math.min(currentPage - 1, Math.max(1, totalPages - 3)))
  const pageButtons = Array.from({ length: Math.min(4, totalPages) }, (_, index) => firstPageButton + index)

  useEffect(() => {
    setPage(1)
  }, [filters, state.data.range.date_from])

  async function runAction(appointment, type) {
    const id = appointmentIdOf(appointment)
    if (!id) {
      toast.error('Không tìm thấy mã lịch hẹn.')
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
      if (type === 'noShow') await doctorApi.appointments.noShow(id)
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

  function primaryActionFor(appointment) {
    const status = statusInfo(appointment)
    if (status.key === 'pending') return { type: 'confirm', label: 'Xác nhận', icon: 'check_circle' }
    if (!checkedInAt(appointment) && !['checked_in', 'completed', 'cancelled'].includes(status.key)) return { type: 'checkIn', label: 'Check-in', icon: 'check_circle' }
    if (!queueNumber(appointment) && status.key === 'checked_in') return { type: 'queue', label: 'Tạo hàng đợi', icon: 'message' }
    if (!encounterIdOf(appointment) && ['checked_in', 'confirmed'].includes(status.key)) return { type: 'encounter', label: 'Bắt đầu khám', icon: 'pulse' }
    return { type: 'detail', label: 'Chi tiết', icon: 'note' }
  }

  function exportUpcomingAppointments() {
    downloadCsv(`lich-hen-sap-toi-${state.data.range.date_from}-${state.data.range.date_to}.csv`, [
      ['Ngay hen', 'Gio hen', 'Benh nhan', 'Ma benh nhan', 'Chuyen khoa', 'Ly do kham', 'Phong kham', 'Trang thai', 'Check-in', 'Hang doi', 'Phien kham'],
      ...dashboard.appointments.map((appointment) => [
        shortDate(appointmentTime(appointment)),
        formatTime(appointmentTime(appointment)),
        patientName(appointment),
        patientCode(appointment),
        departmentName(appointment),
        visitReason(appointment),
        roomName(appointment),
        statusInfo(appointment).label,
        checkedInAt(appointment) ? formatTime(checkedInAt(appointment)) : '',
        queueNumber(appointment),
        encounterIdOf(appointment),
      ]),
    ])
  }

  return (
    <div className="doctor-upcoming-page">
      {state.error ? (
        <div className="doctor-today-error">
          <span>{state.error}</span>
          <button type="button" onClick={reload}>Thử lại</button>
        </div>
      ) : null}

      <section className="doctor-upcoming-kpis" aria-label="Tổng quan lịch hẹn sắp tới">
        <UpcomingKpi icon="calendar" tone="blue" label="Tổng lịch sắp tới" value={dashboard.total} hint="Trong 7 ngày tới" />
        <UpcomingKpi icon="check_circle" tone="green" label="Đã xác nhận" value={dashboard.confirmed} hint={`${dashboard.confirmRate}% tổng lịch hẹn`} />
        <UpcomingKpi icon="clock" tone="orange" label="Chờ xác nhận" value={dashboard.pending} hint={`${dashboard.pendingRate}% tổng lịch hẹn`} />
        <UpcomingKpi icon="note" tone="purple" label="Cần chuẩn bị" value={dashboard.prepare} hint="Có chỉ định hoặc hồ sơ cần xem trước" />
      </section>

      <section className="doctor-upcoming-layout">
        <article className="doctor-upcoming-panel doctor-upcoming-list">
          <header>
            <h2>Danh sách lịch hẹn sắp tới</h2>
          </header>

          <div className="doctor-upcoming-filters">
            <label>
              <DoctorIcon name="search" />
              <input
                placeholder="Tìm bệnh nhân hoặc mã lịch hẹn"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </label>
            <button type="button" onClick={() => setRangeOffset((current) => nextRangeOffset(current))}><DoctorIcon name="calendar" /> {rangeText(state.data.range)} <DoctorIcon name="chevron_down" /></button>
            <button type="button" onClick={() => setFilters((current) => ({ ...current, department: cycleFilterValue(current.department, dashboard.filterOptions.departments) }))}>
              {filterLabel(filters.department, 'Tất cả chuyên khoa')} <DoctorIcon name="chevron_down" />
            </button>
            <button type="button" onClick={() => setFilters((current) => ({ ...current, status: cycleFilterValue(current.status, dashboard.filterOptions.statuses) }))}>
              {filterLabel(filters.status, 'Tất cả trạng thái')} <DoctorIcon name="chevron_down" />
            </button>
          </div>

          <div className="doctor-upcoming-table-scroll">
            <div className="doctor-upcoming-table-head">
              <span>Ngày</span>
              <span>Giờ hẹn</span>
              <span>Bệnh nhân</span>
              <span>Chuyên khoa / Lý do khám</span>
              <span>Trạng thái</span>
              <span>Xác nhận</span>
              <span>Phòng khám</span>
              <span>Thao tác</span>
            </div>

            <div className="doctor-upcoming-table-body">
              {state.loading ? (
                <div className="doctor-appointment-empty">Đang tải lịch hẹn sắp tới...</div>
              ) : pagedAppointments.length ? pagedAppointments.map((appointment, index) => {
                const id = appointmentIdOf(appointment) || `upcoming-${index}`
                const status = statusInfo(appointment)
                const confirmed = status.key === 'confirmed'
                const action = primaryActionFor(appointment)
                const actionKey = `${action.type}:${id}`
                return (
                  <div className="doctor-upcoming-row" key={id}>
                    <strong>{shortDate(appointmentTime(appointment))}</strong>
                    <span>{formatTime(appointmentTime(appointment))}</span>
                    <span className="doctor-upcoming-patient">
                      <em>{patientInitials(appointment)}</em>
                      <b>{patientName(appointment)}</b>
                      <small>{patientMeta(appointment)}</small>
                    </span>
                    <span className="doctor-upcoming-reason">
                      <b>{departmentName(appointment)}</b>
                      <small>{visitReason(appointment)}</small>
                    </span>
                    <span><i className={`is-${status.tone}`}>{status.label}</i></span>
                    <span className="doctor-upcoming-confirm">{confirmed ? <DoctorIcon name="check_circle" /> : '-'}</span>
                    <span>{roomName(appointment)}</span>
                    <span className="doctor-upcoming-actions">
                      <button
                        type="button"
                        onClick={() => (action.type === 'detail' ? openAppointmentDetail(appointment) : runAction(appointment, action.type))}
                        disabled={Boolean(actingId) && actingId !== actionKey}
                      >
                        <DoctorIcon name={action.icon} />
                        {actingId === actionKey ? 'Đang xử lý' : action.label}
                      </button>
                      <button type="button" className="is-primary" onClick={() => openAppointmentDetail(appointment)}>Xem chi tiết</button>
                    </span>
                  </div>
                )
              }) : (
                <div className="doctor-appointment-empty">Chưa có lịch hẹn sắp tới.</div>
              )}
            </div>
          </div>

          <footer className="doctor-upcoming-footer">
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

        <aside className="doctor-upcoming-side">
          <article className="doctor-upcoming-panel doctor-upcoming-overview">
            <header>
              <h2>Tổng quan sắp tới</h2>
            </header>
            <div className="doctor-upcoming-overview__top">
              <UpcomingDonut total={dashboard.total} dashboard={dashboard} />
              <dl>
                <div><dt><i className="is-green" /> Đã xác nhận</dt><dd>{dashboard.confirmed} ({dashboard.confirmRate}%)</dd></div>
                <div><dt><i className="is-orange" /> Chờ xác nhận</dt><dd>{dashboard.pending} ({dashboard.pendingRate}%)</dd></div>
                <div><dt><i className="is-blue" /> Sắp đến</dt><dd>{dashboard.soon}</dd></div>
                <div><dt><i className="is-purple" /> Cần chuẩn bị</dt><dd>{dashboard.prepare} ({dashboard.prepareRate}%)</dd></div>
                <div><dt><i className="is-blue" /> Dời lịch</dt><dd>{dashboard.rescheduled}</dd></div>
                <div><dt><i className="is-orange" /> Đã hủy</dt><dd>{dashboard.cancelled}</dd></div>
              </dl>
            </div>
            <div className="doctor-upcoming-overview__list">
              <div><DoctorIcon name="clock" /><span>Khung giờ đông lịch</span><strong>{dashboard.peak}</strong></div>
              <div><DoctorIcon name="calendar" /><span>Ngày nhiều lịch nhất</span><strong>{dashboard.busiest}</strong></div>
              <div><DoctorIcon name="pulse" /><span>Tỷ lệ xác nhận</span><strong>{dashboard.confirmRate}%</strong></div>
              <div><DoctorIcon name="patients" /><span>Bác sĩ phụ trách</span><strong>{doctorName(dashboard.first || {}, user)}</strong></div>
              <div><DoctorIcon name="patients" /><span>Khoa / Phòng khám</span><strong>{dashboard.first ? `${departmentName(dashboard.first)} / ${roomName(dashboard.first)}` : '--'}</strong></div>
            </div>
          </article>

          <article className="doctor-upcoming-panel doctor-upcoming-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => navigate('/doctor/appointments')}>
              <span><DoctorIcon name="calendar" /></span>
              <b>Tạo lịch hẹn mới</b>
              <small>Tạo lịch hẹn cho bệnh nhân</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={reload} disabled={state.loading}>
              <span><DoctorIcon name="refresh" /></span>
              <b>Làm mới danh sách</b>
              <small>Cập nhật lịch hẹn sắp tới từ backend</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={() => toast.info('Chọn từng lịch để xác nhận theo quyền backend.')}>
              <span><DoctorIcon name="patients" /></span>
              <b>Xác nhận hàng loạt</b>
              <small>Xác nhận nhiều lịch hẹn cùng lúc</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={() => toast.info('Chức năng gửi nhắc lịch cần endpoint nhắn tin riêng.')}>
              <span><DoctorIcon name="bell" /></span>
              <b>Gửi nhắc lịch</b>
              <small>Gửi tin nhắn nhắc lịch cho bệnh nhân</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={exportUpcomingAppointments}>
              <span><DoctorIcon name="note" /></span>
              <b>Xuất lịch sắp tới</b>
              <small>Xuất file Excel danh sách lịch sắp tới</small>
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
            aria-label="Chi tiết lịch hẹn sắp tới"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2>Chi tiết lịch hẹn sắp tới</h2>
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
                    <span>{shortDate(appointmentTime(detailState.appointment))} · {formatTime(appointmentTime(detailState.appointment))}</span>
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
