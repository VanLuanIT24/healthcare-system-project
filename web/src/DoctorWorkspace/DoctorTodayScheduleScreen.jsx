import { useEffect, useMemo, useState } from 'react'
import { doctorApi, getDoctorId } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { DoctorIcon } from './DoctorShell'
import { getApiErrorMessage } from '../utils/api'

function scheduleIdOf(schedule = {}) {
  return schedule.doctor_schedule_id || schedule.schedule_id || schedule.id || schedule._id || ''
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

function minutesBetween(start, end) {
  const from = new Date(start).getTime()
  const to = new Date(end).getTime()
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0
  return Math.round((to - from) / 60000)
}

function durationText(minutes) {
  if (!minutes) return '--'
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  if (!hours) return `${remain} phút`
  return remain ? `${hours}h ${remain}p` : `${hours} giờ`
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

function departmentName(schedule = {}) {
  return schedule.department_name || schedule.department?.department_name || schedule.specialty || 'Khoa khám bệnh'
}

function shiftLabel(schedule = {}) {
  const raw = String(schedule.shift_type || schedule.type || schedule.name || '').toLowerCase()
  if (raw.includes('morning') || raw.includes('sáng')) return 'Ca sáng'
  if (raw.includes('afternoon') || raw.includes('chiều')) return 'Ca chiều'
  if (raw.includes('night') || raw.includes('tối')) return 'Ca tối'
  const hour = new Date(schedule.shift_start || schedule.start_time).getHours()
  if (!Number.isNaN(hour) && hour < 12) return 'Ca sáng'
  if (!Number.isNaN(hour) && hour < 18) return 'Ca chiều'
  return 'Ca khám'
}

function scheduleState(schedule = {}) {
  const raw = String(schedule.status || '').toLowerCase()
  const now = Date.now()
  const start = new Date(schedule.shift_start || schedule.start_time).getTime()
  const end = new Date(schedule.shift_end || schedule.end_time).getTime()
  if (raw.includes('cancel')) return { label: 'Đã hủy', tone: 'slate' }
  if (Number.isNaN(start) || Number.isNaN(end)) return { label: 'Đã lên lịch', tone: 'blue' }
  if (now < start) return { label: 'Sắp diễn ra', tone: 'blue' }
  if (now > end) return { label: 'Đã hoàn thành', tone: 'green' }
  return { label: 'Đang diễn ra', tone: 'green' }
}

function slotTime(slot = {}) {
  return slot.slot_time || slot.start_time || slot.appointment_time || slot.time || slot.start || ''
}

function slotPatient(slot = {}) {
  const patient = slot.patient || slot.appointment?.patient || {}
  return slot.patient_name || patient.full_name || patient.name || slot.appointment?.patient_name || 'Bệnh nhân'
}

function slotPatientMeta(slot = {}) {
  const patient = slot.patient || slot.appointment?.patient || {}
  const year = patient.year_of_birth || patient.birth_year || slot.birth_year
  const gender = patient.gender || slot.gender
  return [year, gender].filter(Boolean).join(' · ')
}

function slotStatus(slot = {}) {
  const raw = String(slot.status || '').toLowerCase()
  if (['checked_in', 'arrived'].includes(raw)) return { label: 'Đã đến', tone: 'green' }
  if (['in_progress', 'serving'].includes(raw)) return { label: 'Đang khám', tone: 'blue' }
  if (['waiting', 'pending'].includes(raw)) return { label: 'Chờ khám', tone: 'amber' }
  if (['cancelled', 'canceled'].includes(raw)) return { label: 'Đã hủy', tone: 'slate' }
  if (slot.is_available || raw === 'available') return { label: 'Còn trống', tone: 'blue' }
  if (slot.is_booked || ['booked', 'confirmed'].includes(raw)) return { label: 'Đã đặt', tone: 'green' }
  return { label: raw ? raw.replace(/_/g, ' ') : 'Đã đặt', tone: 'blue' }
}

function normalizeBundle(schedule, detail) {
  const summary = detail.summary || {}
  const allSlots = safeArray(detail.allSlots)
  const bookedSlots = safeArray(detail.bookedSlots).length
    ? safeArray(detail.bookedSlots)
    : allSlots.filter((slot) => slot.is_booked || slot.patient || slot.patient_name)
  const availableSlots = safeArray(detail.availableSlots).length
    ? safeArray(detail.availableSlots)
    : allSlots.filter((slot) => slot.is_available || String(slot.status || '').toLowerCase() === 'available')
  const totalSlots = numberFrom(summary, ['total_slots', 'totalSlots', 'slots_count', 'slot_count'], allSlots.length || bookedSlots.length + availableSlots.length)
  const bookedCount = numberFrom(summary, ['booked_slots', 'bookedSlots', 'booked_count'], bookedSlots.length)
  const availableCount = numberFrom(summary, ['available_slots', 'availableSlots', 'empty_slots', 'available_count'], Math.max(totalSlots - bookedCount, availableSlots.length))
  const utilizationPayload = detail.utilization || {}
  const utilization = Math.round(numberFrom(utilizationPayload, ['utilization_rate', 'utilization', 'rate', 'percentage'], totalSlots ? (bookedCount / totalSlots) * 100 : 0))

  return {
    schedule,
    summary,
    allSlots,
    bookedSlots,
    availableSlots,
    totalSlots,
    bookedCount,
    availableCount,
    utilization: Math.max(0, Math.min(100, utilization)),
    state: scheduleState(schedule),
  }
}

async function settledValue(promise, fallback) {
  try {
    return await promise
  } catch {
    return fallback
  }
}

async function loadTodaySchedule(user) {
  const today = getTodayDate()
  const doctorId = getDoctorId(user)
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const todaySchedules = await doctorApi.schedules.myToday({ date: today })
  const weekPromise = doctorApi.schedules.myWeek({ date_from: toDateKey(monday), date_to: toDateKey(sunday), limit: 100 })
  const calendarPromise = doctorId
    ? doctorApi.schedules.getCalendar(doctorId, { date_from: today, date_to: today, limit: 100 })
    : Promise.resolve([])

  const calendarSchedules = await settledValue(calendarPromise, [])
  const baseSchedules = safeArray(todaySchedules).length
    ? safeArray(todaySchedules)
    : safeArray(calendarSchedules).filter((schedule) => toDateKey(schedule.shift_start || schedule.start_time) === today)

  const schedules = await Promise.all(
    baseSchedules.map(async (schedule) => {
      const scheduleId = scheduleIdOf(schedule)
      const [summary, utilization, allSlots, availableSlots, bookedSlots, bookedAlias] = await Promise.all([
        scheduleId ? settledValue(doctorApi.schedules.getSummary(scheduleId), null) : Promise.resolve(null),
        scheduleId ? settledValue(doctorApi.schedules.getUtilization(scheduleId), null) : Promise.resolve(null),
        scheduleId ? settledValue(doctorApi.schedules.getSlots(scheduleId), []) : Promise.resolve([]),
        scheduleId ? settledValue(doctorApi.schedules.getAvailableSlots(scheduleId), []) : Promise.resolve([]),
        scheduleId ? settledValue(doctorApi.schedules.getBookedSlots(scheduleId), []) : Promise.resolve([]),
        scheduleId ? settledValue(doctorApi.schedules.getBookedSlotsAlias(scheduleId), []) : Promise.resolve([]),
      ])

      return normalizeBundle(schedule, {
        summary,
        utilization,
        allSlots,
        availableSlots,
        bookedSlots: safeArray(bookedSlots).length ? bookedSlots : bookedAlias,
      })
    }),
  )

  return {
    today,
    schedules,
    weekSchedules: await settledValue(weekPromise, []),
  }
}

function KpiCard({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-today-kpi">
      <span className={`doctor-today-kpi__icon is-${tone}`}>
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

function Donut({ percent }) {
  return (
    <div className="doctor-today-donut" style={{ '--today-percent': `${percent}%` }}>
      <div>
        <strong>{percent}%</strong>
        <span>Hiệu suất</span>
      </div>
    </div>
  )
}

function SlotBadge({ slot }) {
  const status = slotStatus(slot)
  return <span className={`doctor-today-badge is-${status.tone}`}>{status.label}</span>
}

export function DoctorTodayScheduleScreen({ user }) {
  const [state, setState] = useState({ loading: true, error: '', data: { schedules: [], weekSchedules: [] } })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadTodaySchedule(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải lịch làm việc hôm nay.'),
          data: { schedules: [], weekSchedules: [] },
        })
      })
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))

    loadTodaySchedule(user)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải lịch làm việc hôm nay.'),
            data: { schedules: [], weekSchedules: [] },
          })
        }
      })

    return () => {
      active = false
    }
  }, [user])

  const dashboard = useMemo(() => {
    const schedules = safeArray(state.data.schedules).sort((a, b) => new Date(a.schedule.shift_start || a.schedule.start_time) - new Date(b.schedule.shift_start || b.schedule.start_time))
    const totalSlots = schedules.reduce((sum, item) => sum + item.totalSlots, 0)
    const bookedCount = schedules.reduce((sum, item) => sum + item.bookedCount, 0)
    const availableCount = schedules.reduce((sum, item) => sum + item.availableCount, 0)
    const totalMinutes = schedules.reduce((sum, item) => sum + minutesBetween(item.schedule.shift_start || item.schedule.start_time, item.schedule.shift_end || item.schedule.end_time), 0)
    const utilization = totalSlots ? Math.round((bookedCount / totalSlots) * 100) : 0
    const first = schedules[0]?.schedule || null
    const last = schedules[schedules.length - 1]?.schedule || null
    const bookedSlots = schedules.flatMap((item) => item.bookedSlots.map((slot) => ({ ...slot, schedule: item.schedule })))
    const availableSlots = schedules.flatMap((item) => item.availableSlots.map((slot) => ({ ...slot, schedule: item.schedule })))

    return {
      schedules,
      totalSlots,
      bookedCount,
      availableCount,
      totalMinutes,
      utilization,
      first,
      last,
      bookedSlots: bookedSlots.sort((a, b) => new Date(slotTime(a)) - new Date(slotTime(b))),
      availableSlots: availableSlots.sort((a, b) => new Date(slotTime(a)) - new Date(slotTime(b))),
    }
  }, [state.data])

  const updatedAt = useMemo(() => new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date()), [])

  return (
    <div className="doctor-today-schedule">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

      <section className="doctor-today-kpis" aria-label="Tổng quan lịch hôm nay">
        <KpiCard
          icon="calendar"
          tone="blue"
          label="Ca trực hôm nay"
          value={dashboard.first && dashboard.last ? `${formatTime(dashboard.first.shift_start || dashboard.first.start_time)} - ${formatTime(dashboard.last.shift_end || dashboard.last.end_time)}` : '--'}
          hint={durationText(dashboard.totalMinutes)}
        />
        <KpiCard icon="patients" tone="green" label="Slot đã đặt" value={dashboard.bookedCount} hint={`${dashboard.utilization}% tổng slot`} />
        <KpiCard icon="calendar" tone="orange" label="Slot còn trống" value={dashboard.availableCount} hint={dashboard.totalSlots ? `${Math.max(0, 100 - dashboard.utilization)}% tổng slot` : '--'} />
        <KpiCard icon="pulse" tone="purple" label="Hiệu suất lịch" value={`${dashboard.utilization}%`} hint="Theo dữ liệu slot hiện tại" />
      </section>

      <section className="doctor-today-main">
        <article className="doctor-today-panel doctor-today-timeline">
          <header>
            <h2>Lịch làm việc trong ngày</h2>
          </header>

          <div className="doctor-today-table-head">
            <span>Thời gian</span>
            <span>Ca khám</span>
            <span>Phòng khám</span>
            <span>Trạng thái</span>
            <span>Tỷ lệ lấp đầy</span>
          </div>

          <div className="doctor-today-rows">
            {state.loading ? (
              <div className="doctor-today-empty">Đang tải lịch hôm nay...</div>
            ) : dashboard.schedules.length ? (
              dashboard.schedules.map((item) => (
                <div className="doctor-today-row" key={scheduleIdOf(item.schedule) || item.schedule.shift_start}>
                  <span className={`doctor-today-dot is-${item.state.tone}`} />
                  <div className="doctor-today-time">
                    <strong>{formatTime(item.schedule.shift_start || item.schedule.start_time)} - {formatTime(item.schedule.shift_end || item.schedule.end_time)}</strong>
                    <em>{shiftLabel(item.schedule).replace('Ca ', '')}</em>
                  </div>
                  <div>
                    <strong>{shiftLabel(item.schedule)}</strong>
                    <span>{formatTime(item.schedule.shift_start || item.schedule.start_time)} - {formatTime(item.schedule.shift_end || item.schedule.end_time)}</span>
                  </div>
                  <div>
                    <strong>{roomName(item.schedule)}</strong>
                    <span>{departmentName(item.schedule)}</span>
                  </div>
                  <div>
                    <span className={`doctor-today-badge is-${item.state.tone}`}>{item.state.label}</span>
                  </div>
                  <div className="doctor-today-progress-cell">
                    <strong>{item.utilization}%</strong>
                    <span className="doctor-today-progress"><i style={{ width: `${item.utilization}%` }} /></span>
                    <small>{item.bookedCount}/{item.totalSlots || 0} slot</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="doctor-today-empty">Chưa có lịch làm việc trong hôm nay.</div>
            )}
          </div>

          <footer>
            <span>Lịch cập nhật lần cuối: {updatedAt}</span>
            <button type="button" onClick={reload} disabled={state.loading}>
              <DoctorIcon name="refresh" />
              Làm mới
            </button>
          </footer>
        </article>

        <aside className="doctor-today-panel doctor-today-summary">
          <header>
            <h2>Tóm tắt lịch</h2>
            <button type="button">Hôm nay <DoctorIcon name="chevron_down" /></button>
          </header>

          <div className="doctor-today-summary__body">
            <Donut percent={dashboard.utilization} />
            <dl>
              <div><dt>Tổng slot</dt><dd>{dashboard.totalSlots}</dd></div>
              <div><dt><i className="is-green" />Đã đặt</dt><dd>{dashboard.bookedCount} ({dashboard.utilization}%)</dd></div>
              <div><dt><i className="is-orange" />Còn trống</dt><dd>{dashboard.availableCount} ({dashboard.totalSlots ? Math.max(0, 100 - dashboard.utilization) : 0}%)</dd></div>
            </dl>
          </div>

          <div className="doctor-today-summary__list">
            <div><span>Ca trực</span><strong>{dashboard.first && dashboard.last ? `${formatTime(dashboard.first.shift_start || dashboard.first.start_time)} - ${formatTime(dashboard.last.shift_end || dashboard.last.end_time)}` : '--'}</strong></div>
            <div><span>Tổng thời gian</span><strong>{durationText(dashboard.totalMinutes)}</strong></div>
            <div><span>Phòng khám</span><strong>{dashboard.first ? roomName(dashboard.first) : '--'}</strong></div>
            <div><span>Bệnh nhân ước tính</span><strong>{dashboard.bookedCount ? `${dashboard.bookedCount} - ${dashboard.bookedCount + Math.max(2, dashboard.availableCount)}` : '--'}</strong></div>
          </div>

          <button className="doctor-today-detail-button" type="button">
            Xem chi tiết hiệu suất
            <DoctorIcon name="chevron_right" />
          </button>
        </aside>
      </section>

      <section className="doctor-today-bottom">
        <article className="doctor-today-panel doctor-today-slots">
          <header>
            <h2><DoctorIcon name="calendar" /> Slot đã đặt</h2>
            <button type="button">Xem tất cả ({dashboard.bookedSlots.length})</button>
          </header>
          <div className="doctor-today-slot-head">
            <span>Thời gian</span>
            <span>Bệnh nhân</span>
            <span>Trạng thái</span>
            <span>Phòng khám</span>
          </div>
          <div className="doctor-today-slot-list">
            {dashboard.bookedSlots.slice(0, 5).map((slot, index) => (
              <div className="doctor-today-slot-row" key={`${slotTime(slot)}-${index}`}>
                <strong>{formatTime(slotTime(slot))}</strong>
                <span><b>{slotPatient(slot)}</b><small>{slotPatientMeta(slot)}</small></span>
                <SlotBadge slot={slot} />
                <small>{roomName(slot.schedule, slot)}</small>
              </div>
            ))}
            {!dashboard.bookedSlots.length ? <div className="doctor-today-empty is-small">Chưa có slot đã đặt.</div> : null}
          </div>
          <button className="doctor-today-link-button" type="button">Xem tất cả slot đã đặt <DoctorIcon name="chevron_right" /></button>
        </article>

        <article className="doctor-today-panel doctor-today-slots">
          <header>
            <h2><DoctorIcon name="calendar" /> Slot còn trống</h2>
            <button type="button">Xem tất cả ({dashboard.availableSlots.length})</button>
          </header>
          <div className="doctor-today-slot-head is-available">
            <span>Thời gian</span>
            <span>Ca khám</span>
            <span>Phòng khám</span>
            <span>Thao tác</span>
          </div>
          <div className="doctor-today-slot-list">
            {dashboard.availableSlots.slice(0, 5).map((slot, index) => (
              <div className="doctor-today-slot-row is-available" key={`${slotTime(slot)}-${index}`}>
                <strong>{formatTime(slotTime(slot))}</strong>
                <span>{shiftLabel(slot.schedule)}</span>
                <small>{roomName(slot.schedule, slot)}</small>
                <button type="button">Đặt nhanh</button>
              </div>
            ))}
            {!dashboard.availableSlots.length ? <div className="doctor-today-empty is-small">Không còn slot trống.</div> : null}
          </div>
          <button className="doctor-today-link-button" type="button">Xem tất cả slot trống <DoctorIcon name="chevron_right" /></button>
        </article>

        <aside className="doctor-today-panel doctor-today-actions">
          <h2>Thao tác nhanh</h2>
          <button type="button">
            <span><DoctorIcon name="calendar" /></span>
            <b>Xem chi tiết lịch</b>
            <small>Xem toàn bộ lịch trong ngày</small>
            <DoctorIcon name="chevron_right" />
          </button>
          <button type="button" onClick={reload} disabled={state.loading}>
            <span><DoctorIcon name="refresh" /></span>
            <b>Làm mới</b>
            <small>Cập nhật lịch và trạng thái slot</small>
            <DoctorIcon name="chevron_right" />
          </button>
          <button type="button">
            <span><DoctorIcon name="note" /></span>
            <b>Xuất lịch</b>
            <small>Xuất lịch hôm nay (PDF/Excel)</small>
            <DoctorIcon name="chevron_right" />
          </button>
        </aside>
      </section>
    </div>
  )
}
