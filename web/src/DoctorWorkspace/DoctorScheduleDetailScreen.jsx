import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doctorApi } from './doctorApi'
import { safeArray } from './doctorData'
import { DoctorIcon } from './DoctorShell'
import { getApiErrorMessage } from '../utils/api'

function scheduleIdOf(schedule = {}) {
  return schedule.doctor_schedule_id || schedule.schedule_id || schedule.id || schedule._id || ''
}

function slotTime(slot = {}) {
  return slot.slot_time || slot.start_time || slot.appointment_time || slot.time || ''
}

function slotEndTime(slot = {}) {
  return slot.slot_end || slot.end_time || slot.end || ''
}

function timeKey(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    return value.slice(0, 5)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toISOString()
}

function getTimeValue(value) {
  if (!value) return 0
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    const [hour, minute] = value.split(':').map(Number)
    return hour * 60 + minute
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 0
  return parsed.getHours() * 60 + parsed.getMinutes()
}

function formatClock(value) {
  if (!value) return '--'
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    const [hour, minute] = value.split(':')
    return `${hour.padStart(2, '0')}:${minute.slice(0, 2)}`
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value) {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function normalizePercent(value, fallback = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.min(100, Math.round(numeric > 0 && numeric <= 1 ? numeric * 100 : numeric)))
}

function numberFrom(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function roomName(schedule = {}, slot = {}) {
  return (
    slot.room_name ||
    slot.clinic_room ||
    schedule.room_name ||
    schedule.clinic_room ||
    schedule.room ||
    schedule.location ||
    schedule.department_name ||
    'Phòng khám'
  )
}

function shiftLabel(schedule = {}) {
  const raw = String(schedule.shift_type || schedule.schedule_type || schedule.type || '').toLowerCase()
  if (raw.includes('morning') || raw.includes('sáng')) return 'Ca sáng'
  if (raw.includes('afternoon') || raw.includes('chiều')) return 'Ca chiều'
  if (raw.includes('night') || raw.includes('tối')) return 'Ca tối'
  const hour = Math.floor(getTimeValue(schedule.shift_start || schedule.start_time) / 60)
  if (hour && hour < 12) return 'Ca sáng'
  if (hour && hour < 18) return 'Ca chiều'
  return 'Ca khám'
}

function patientName(slot = {}) {
  const patient = slot.patient || slot.appointment?.patient || {}
  return slot.patient_name || patient.full_name || patient.name || slot.appointment?.patient_name || '--'
}

function patientMeta(slot = {}) {
  const patient = slot.patient || slot.appointment?.patient || {}
  return [
    slot.patient_code || patient.patient_code,
    slot.patient_phone || patient.phone,
  ].filter(Boolean).join(' · ')
}

function statusMeta(slot = {}) {
  const raw = String(slot.status || '').toLowerCase()
  if (raw === 'completed') return { label: 'Đã hoàn thành', tone: 'green' }
  if (['checked_in', 'arrived', 'in_consultation', 'in_progress', 'serving'].includes(raw)) {
    return { label: 'Đang diễn ra', tone: 'green' }
  }
  if (['booked', 'confirmed'].includes(raw) || slot.is_booked) {
    return { label: raw === 'confirmed' ? 'Đã xác nhận' : 'Đã đặt', tone: 'blue' }
  }
  if (raw === 'held') return { label: 'Đang giữ', tone: 'amber' }
  if (raw === 'blocked' || slot.is_blocked) return { label: 'Đã chặn', tone: 'slate' }
  if (['cancelled', 'canceled'].includes(raw)) return { label: 'Đã hủy', tone: 'slate' }
  if (raw === 'no_show') return { label: 'Không đến', tone: 'slate' }
  if (raw === 'available' || slot.is_available) return { label: 'Còn trống', tone: 'slate' }
  return { label: raw ? raw.replace(/_/g, ' ') : 'Chưa bắt đầu', tone: 'slate' }
}

function settledValue(result, fallback) {
  return result.status === 'fulfilled' ? result.value : fallback
}

function mergeSlots(slots, bookedSlots, availableSlots) {
  const bookedByTime = new Map(
    safeArray(bookedSlots).map((slot) => [timeKey(slotTime(slot)), slot]),
  )
  const availableByTime = new Map(
    safeArray(availableSlots).map((slot) => [timeKey(slotTime(slot)), slot]),
  )

  const baseRows = safeArray(slots).length
    ? safeArray(slots)
    : [...safeArray(bookedSlots), ...safeArray(availableSlots)]

  const seen = new Set()
  return baseRows
    .map((slot) => {
      const key = timeKey(slotTime(slot))
      seen.add(key)
      return {
        ...availableByTime.get(key),
        ...slot,
        ...bookedByTime.get(key),
      }
    })
    .concat(
      safeArray(bookedSlots)
        .filter((slot) => !seen.has(timeKey(slotTime(slot))))
        .map((slot) => ({ ...slot, is_booked: true, is_available: false })),
    )
    .sort((a, b) => getTimeValue(slotTime(a)) - getTimeValue(slotTime(b)))
}

function KpiCard({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-schedule-detail-kpi">
      <span className={`doctor-schedule-detail-kpi__icon is-${tone}`}>
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

function SlotBadge({ slot }) {
  const meta = statusMeta(slot)
  return <span className={`doctor-today-badge is-${meta.tone}`}>{meta.label}</span>
}

export function DoctorScheduleDetailScreen() {
  const { scheduleId = '' } = useParams()
  const navigate = useNavigate()
  const decodedScheduleId = decodeURIComponent(scheduleId)
  const [state, setState] = useState({
    loading: true,
    error: '',
    schedule: null,
    summary: null,
    utilization: null,
    activity: [],
    slots: [],
    availableSlots: [],
    bookedSlots: [],
  })

  useEffect(() => {
    let ignore = false

    async function loadScheduleDetail() {
      if (!decodedScheduleId) {
        setState((current) => ({ ...current, loading: false, error: 'Không tìm thấy mã lịch làm việc.' }))
        return
      }

      setState((current) => ({ ...current, loading: true, error: '' }))

      try {
        const [
          detailResult,
          summaryResult,
          utilizationResult,
          activityResult,
          slotsResult,
          availableResult,
          bookedResult,
          bookedAliasResult,
        ] = await Promise.allSettled([
          doctorApi.schedules.getDetail(decodedScheduleId),
          doctorApi.schedules.getSummary(decodedScheduleId),
          doctorApi.schedules.getUtilization(decodedScheduleId),
          doctorApi.schedules.getActivity(decodedScheduleId, { limit: 20 }),
          doctorApi.schedules.getSlots(decodedScheduleId),
          doctorApi.schedules.getAvailableSlots(decodedScheduleId),
          doctorApi.schedules.getBookedSlots(decodedScheduleId),
          doctorApi.schedules.getBookedSlotsAlias(decodedScheduleId),
        ])

        if (ignore) return

        const bookedSlots = [
          ...safeArray(settledValue(bookedResult, [])),
          ...safeArray(settledValue(bookedAliasResult, [])),
        ]
        const dedupedBookedSlots = Array.from(
          new Map(bookedSlots.map((slot, index) => [slot.appointment_id || slot.schedule_slot_id || `${slotTime(slot)}-${index}`, slot])).values(),
        )

        setState({
          loading: false,
          error: '',
          schedule: settledValue(detailResult, null),
          summary: settledValue(summaryResult, null),
          utilization: settledValue(utilizationResult, null),
          activity: safeArray(settledValue(activityResult, [])),
          slots: safeArray(settledValue(slotsResult, [])),
          availableSlots: safeArray(settledValue(availableResult, [])),
          bookedSlots: dedupedBookedSlots,
        })
      } catch (error) {
        if (!ignore) {
          setState((current) => ({
            ...current,
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải chi tiết lịch làm việc.'),
          }))
        }
      }
    }

    loadScheduleDetail()
    return () => {
      ignore = true
    }
  }, [decodedScheduleId])

  const view = useMemo(() => {
    const schedule = state.schedule || state.summary || {}
    const utilizationSource = state.utilization || state.summary?.utilization || {}
    const rows = mergeSlots(state.slots, state.bookedSlots, state.availableSlots)
    const totalSlots = numberFrom(utilizationSource, ['total_slots', 'totalSlots'], rows.length)
    const bookedCount = numberFrom(utilizationSource, ['booked_slots', 'bookedSlots'], state.bookedSlots.length)
    const availableCount = numberFrom(utilizationSource, ['available_slots', 'availableSlots'], state.availableSlots.length)
    const utilization = normalizePercent(
      utilizationSource.utilization_rate ?? utilizationSource.utilization ?? utilizationSource.fill_rate,
      totalSlots ? Math.round((bookedCount / totalSlots) * 100) : 0,
    )
    const start = schedule.shift_start || schedule.start_time
    const end = schedule.shift_end || schedule.end_time

    return {
      schedule,
      rows,
      totalSlots,
      bookedCount,
      availableCount,
      utilization,
      date: schedule.schedule_date || schedule.date || start,
      timeRange: `${formatClock(start)} - ${formatClock(end)}`,
      room: roomName(schedule),
      department: schedule.department_name || schedule.department?.department_name || 'Khoa khám bệnh',
      shift: shiftLabel(schedule),
      scheduleCode: schedule.code || schedule.schedule_code || scheduleIdOf(schedule) || decodedScheduleId,
    }
  }, [decodedScheduleId, state])

  return (
    <div className="doctor-schedule-detail-page">
      <button className="doctor-schedule-detail-back" type="button" onClick={() => navigate('/doctor/schedules/today')}>
        <DoctorIcon name="arrow_left" />
        Quay lại lịch hôm nay
      </button>

      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

      <section className="doctor-schedule-detail-hero">
        <div>
          <span>Chi tiết lịch</span>
          <h2>{view.shift}</h2>
          <p>{formatDate(view.date)} · {view.timeRange}</p>
        </div>
        <dl>
          <div><dt>Mã lịch</dt><dd>{view.scheduleCode || '--'}</dd></div>
          <div><dt>Phòng khám</dt><dd>{view.room}</dd></div>
          <div><dt>Khoa</dt><dd>{view.department}</dd></div>
        </dl>
      </section>

      <section className="doctor-schedule-detail-kpis" aria-label="Tổng quan chi tiết lịch">
        <KpiCard icon="calendar" tone="blue" label="Tổng số slot" value={view.totalSlots} hint={view.timeRange} />
        <KpiCard icon="patients" tone="green" label="Slot đã đặt" value={view.bookedCount} hint={`${view.totalSlots} tổng slot`} />
        <KpiCard icon="doctor" tone="orange" label="Slot còn trống" value={view.availableCount} hint="Theo endpoint available" />
        <KpiCard icon="clock" tone="purple" label="Hiệu suất lịch" value={`${view.utilization}%`} hint="Theo endpoint utilization" />
      </section>

      <section className="doctor-schedule-detail-grid">
        <article className="doctor-today-panel doctor-schedule-detail-slots">
          <header>
            <h2>Danh sách slot</h2>
            <button type="button" onClick={() => window.location.reload()} disabled={state.loading}>
              <DoctorIcon name="refresh" />
              Làm mới
            </button>
          </header>

          <div className="doctor-schedule-detail-table">
            <div className="doctor-schedule-detail-table-head">
              <span>Thời gian</span>
              <span>Phòng khám</span>
              <span>Trạng thái</span>
              <span>Bệnh nhân</span>
              <span>Nguồn</span>
            </div>

            <div className="doctor-schedule-detail-table-body">
              {state.loading ? (
                <div className="doctor-today-empty">Đang tải chi tiết lịch làm việc...</div>
              ) : view.rows.length ? (
                view.rows.map((slot, index) => (
                  <div className="doctor-schedule-detail-row" key={`${slot.schedule_slot_id || slot.appointment_id || slotTime(slot)}-${index}`}>
                    <strong>{formatClock(slotTime(slot))} - {formatClock(slotEndTime(slot))}</strong>
                    <span>{roomName(view.schedule, slot)}</span>
                    <SlotBadge slot={slot} />
                    <span className="doctor-schedule-detail-patient">
                      <b>{patientName(slot)}</b>
                      <small>{patientMeta(slot) || (slot.is_available ? 'Slot còn trống' : '--')}</small>
                    </span>
                    <span>{slot.source || slot.appointment_source || '--'}</span>
                  </div>
                ))
              ) : (
                <div className="doctor-today-empty">Chưa có slot trong lịch này.</div>
              )}
            </div>
          </div>
        </article>

        <aside className="doctor-schedule-detail-side">
          <article className="doctor-today-panel">
            <header>
              <h2>Tóm tắt lịch</h2>
            </header>
            <div className="doctor-schedule-detail-summary">
              <div><DoctorIcon name="clock" /><span>Thời gian</span><strong>{view.timeRange}</strong></div>
              <div><DoctorIcon name="pin" /><span>Phòng khám</span><strong>{view.room}</strong></div>
              <div><DoctorIcon name="patients" /><span>Slot đã đặt</span><strong>{view.bookedCount}/{view.totalSlots}</strong></div>
              <div><DoctorIcon name="calendar" /><span>Hiệu suất</span><strong>{view.utilization}%</strong></div>
            </div>
          </article>

          <article className="doctor-today-panel">
            <header>
              <h2>Lịch sử cập nhật</h2>
            </header>
            <div className="doctor-schedule-detail-activity">
              {state.loading ? (
                <div className="doctor-today-empty is-small">Đang tải lịch sử...</div>
              ) : state.activity.length ? (
                state.activity.slice(0, 6).map((item, index) => (
                  <div key={item.activity_id || item.id || index}>
                    <i />
                    <span>
                      <b>{item.action || item.event || item.status || 'Cập nhật lịch'}</b>
                      <small>{formatDate(item.created_at || item.updated_at || item.timestamp)}</small>
                    </span>
                  </div>
                ))
              ) : (
                <div className="doctor-today-empty is-small">Chưa có lịch sử cập nhật.</div>
              )}
            </div>
          </article>
        </aside>
      </section>
    </div>
  )
}
