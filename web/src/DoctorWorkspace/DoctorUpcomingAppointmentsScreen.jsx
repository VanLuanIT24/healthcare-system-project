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

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function dateRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
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
  return appointment.department_name || appointment.specialty || appointment.specialty_name || appointment.department?.department_name || 'Khoa khám bệnh'
}

function roomName(appointment = {}) {
  return appointment.room_name || appointment.clinic_room || appointment.room || appointment.location || 'PK'
}

function doctorName(appointment = {}, user = {}) {
  const doctor = appointment.doctor || {}
  return appointment.doctor_name || doctor.full_name || doctor.name || user.full_name || user.name || 'Bác sĩ'
}

function visitReason(appointment = {}) {
  return appointment.reason || appointment.note || appointment.notes || appointment.chief_complaint || appointment.appointment_type || 'Khám định kỳ'
}

function statusInfo(appointment = {}) {
  const raw = String(appointment.status || '').toLowerCase()
  if (['confirmed'].includes(raw)) return { key: 'confirmed', label: 'Đã xác nhận', tone: 'green' }
  if (['pending', 'booked', 'scheduled'].includes(raw)) return { key: 'pending', label: raw === 'scheduled' ? 'Sắp đến' : 'Chờ xác nhận', tone: raw === 'scheduled' ? 'blue' : 'orange' }
  if (['needs_preparation', 'preparation', 'requires_review'].includes(raw)) return { key: 'prepare', label: 'Cần chuẩn bị', tone: 'purple' }
  if (['checked_in', 'arrived'].includes(raw)) return { key: 'confirmed', label: 'Đã xác nhận', tone: 'green' }
  if (['cancelled', 'canceled'].includes(raw)) return { key: 'cancelled', label: 'Đã hủy', tone: 'red' }
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

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

async function loadUpcomingAppointments(user) {
  const today = getTodayDate()
  const range = dateRange()
  const doctorId = getDoctorId(user)
  const [upcoming, doctorAppointments, summary] = await Promise.all([
    settledValue(doctorApi.appointments.listUpcoming({ date_from: range.date_from, date_to: range.date_to, doctor_id: doctorId, limit: 200 }), []),
    doctorId ? settledValue(doctorApi.appointments.listByDoctor(doctorId, { date_from: range.date_from, date_to: range.date_to, limit: 200 }), []) : Promise.resolve([]),
    settledValue(doctorApi.appointments.getSummary({ date_from: range.date_from, date_to: range.date_to, doctor_id: doctorId }), null),
  ])

  const combined = [...safeArray(upcoming), ...safeArray(doctorAppointments)]
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

  const readinessEntries = await Promise.all(
    appointments.slice(0, 20).map(async (appointment) => {
      const id = appointmentIdOf(appointment)
      if (!id) return null
      const readiness = await settledValue(doctorApi.appointments.getReadChecks(id), null)
      return [id, readiness]
    }),
  )

  return {
    appointments,
    range,
    summary,
    readiness: Object.fromEntries(readinessEntries.filter(Boolean)),
  }
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

function UpcomingDonut({ total }) {
  return (
    <div className="doctor-upcoming-donut">
      <div>
        <strong>{total}</strong>
        <span>Tổng lịch</span>
      </div>
    </div>
  )
}

export function DoctorUpcomingAppointmentsScreen({ user }) {
  const toast = useToast()
  const [state, setState] = useState({ loading: true, error: '', data: { appointments: [], range: dateRange(), summary: null, readiness: {} } })
  const [actingId, setActingId] = useState('')

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadUpcomingAppointments(user)
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
    loadUpcomingAppointments(user)
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
  }, [user])

  const dashboard = useMemo(() => {
    const appointments = safeArray(state.data.appointments)
    const summary = state.data.summary || {}
    const total = numberFrom(summary, ['total_upcoming', 'total_appointments', 'appointments_count', 'total'], appointments.length)
    const confirmed = numberFrom(summary, ['confirmed_count', 'confirmed'], appointments.filter((item) => statusInfo(item).key === 'confirmed').length)
    const pending = numberFrom(summary, ['pending_count', 'waiting_count', 'pending'], appointments.filter((item) => statusInfo(item).key === 'pending').length)
    const prepare = numberFrom(summary, ['preparation_count', 'needs_preparation_count', 'requires_review_count'], appointments.filter(needsPreparation).length)
    const soon = appointments.filter((item) => statusInfo(item).key === 'pending').length
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
      soon,
      confirmRate,
      pendingRate,
      prepareRate,
      first,
      peak: peakWindow(appointments),
    }
  }, [state.data])

  async function runAction(appointment, type) {
    const id = appointmentIdOf(appointment)
    if (!id) {
      toast.error('Không tìm thấy mã lịch hẹn.')
      return
    }

    const readiness = state.data.readiness[id]
    if (type === 'confirm' && readiness?.canUpdate && readiness.canUpdate.can_update === false) {
      toast.warning('Backend không cho phép xác nhận lịch hẹn này.')
      return
    }

    setActingId(`${type}:${id}`)
    try {
      if (type === 'confirm') await doctorApi.appointments.confirm(id)
      if (type === 'checkIn') await doctorApi.appointments.checkIn(id)
      if (type === 'noShow') await doctorApi.appointments.noShow(id)
      toast.success('Đã cập nhật lịch hẹn.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác lịch hẹn.'))
    } finally {
      setActingId('')
    }
  }

  return (
    <div className="doctor-upcoming-page">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

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
            <label><DoctorIcon name="search" /><input placeholder="Tìm bệnh nhân hoặc mã lịch hẹn" /></label>
            <button type="button"><DoctorIcon name="calendar" /> {rangeText(state.data.range)} <DoctorIcon name="chevron_down" /></button>
            <button type="button">Tất cả chuyên khoa <DoctorIcon name="chevron_down" /></button>
            <button type="button">Tất cả trạng thái <DoctorIcon name="chevron_down" /></button>
          </div>

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
            ) : dashboard.appointments.length ? dashboard.appointments.slice(0, 10).map((appointment, index) => {
              const id = appointmentIdOf(appointment) || `upcoming-${index}`
              const status = statusInfo(appointment)
              const confirmed = status.key === 'confirmed'
              const canConfirm = !confirmed && status.key !== 'cancelled'
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
                    <button type="button" onClick={() => runAction(appointment, canConfirm ? 'confirm' : 'checkIn')} disabled={Boolean(actingId) || !canConfirm}>
                      <DoctorIcon name={canConfirm ? 'check_circle' : 'message'} />
                      {canConfirm ? 'Xác nhận' : 'Gọi nhắc'}
                    </button>
                    <button type="button" className="is-primary">Xem chi tiết</button>
                  </span>
                </div>
              )
            }) : (
              <div className="doctor-appointment-empty">Chưa có lịch hẹn sắp tới.</div>
            )}
          </div>

          <footer className="doctor-upcoming-footer">
            <button type="button">Hiển thị 10 dòng <DoctorIcon name="chevron_down" /></button>
            <div>
              <button type="button" disabled><DoctorIcon name="chevron_right" /></button>
              <button type="button" className="is-active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">4</button>
              <button type="button"><DoctorIcon name="chevron_right" /></button>
            </div>
            <span>Hiển thị {dashboard.appointments.length ? `1 đến ${Math.min(10, dashboard.appointments.length)}` : '0'} của {dashboard.total} lịch hẹn</span>
          </footer>
        </article>

        <aside className="doctor-upcoming-side">
          <article className="doctor-upcoming-panel doctor-upcoming-overview">
            <header>
              <h2>Tổng quan sắp tới</h2>
            </header>
            <div className="doctor-upcoming-overview__top">
              <UpcomingDonut total={dashboard.total} />
              <dl>
                <div><dt><i className="is-green" /> Đã xác nhận</dt><dd>{dashboard.confirmed} ({dashboard.confirmRate}%)</dd></div>
                <div><dt><i className="is-orange" /> Chờ xác nhận</dt><dd>{dashboard.pending} ({dashboard.pendingRate}%)</dd></div>
                <div><dt><i className="is-blue" /> Sắp đến</dt><dd>{dashboard.soon}</dd></div>
                <div><dt><i className="is-purple" /> Cần chuẩn bị</dt><dd>{dashboard.prepare} ({dashboard.prepareRate}%)</dd></div>
              </dl>
            </div>
            <div className="doctor-upcoming-overview__list">
              <div><DoctorIcon name="clock" /><span>Khung giờ đông lịch</span><strong>{dashboard.peak}</strong></div>
              <div><DoctorIcon name="pulse" /><span>Tỷ lệ xác nhận</span><strong>{dashboard.confirmRate}%</strong></div>
              <div><DoctorIcon name="patients" /><span>Bác sĩ phụ trách</span><strong>{doctorName(dashboard.first || {}, user)}</strong></div>
              <div><DoctorIcon name="patients" /><span>Khoa / Phòng khám</span><strong>{dashboard.first ? `${departmentName(dashboard.first)} / ${roomName(dashboard.first)}` : '--'}</strong></div>
            </div>
          </article>

          <article className="doctor-upcoming-panel doctor-upcoming-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button">
              <span><DoctorIcon name="calendar" /></span>
              <b>Tạo lịch hẹn mới</b>
              <small>Tạo lịch hẹn cho bệnh nhân</small>
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
            <button type="button">
              <span><DoctorIcon name="note" /></span>
              <b>Xuất lịch sắp tới</b>
              <small>Xuất file Excel danh sách lịch sắp tới</small>
              <DoctorIcon name="chevron_right" />
            </button>
          </article>
        </aside>
      </section>
    </div>
  )
}
