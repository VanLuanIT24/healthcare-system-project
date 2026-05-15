import { useEffect, useMemo, useState } from 'react'
import { doctorApi, getDoctorId } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { DoctorIcon } from './DoctorShell'
import { getApiErrorMessage } from '../utils/api'

const VI_WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const SHIFT_ORDER = ['Ca sáng', 'Ca chiều', 'Ca tối']

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

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

function weekDays(monday) {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

function displayDate(date) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(parsed)
}

function fullDate(date) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed)
}

function weekRangeText(monday) {
  return `${fullDate(monday)} - ${fullDate(addDays(monday, 6))}`
}

function numberFrom(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function minutesBetween(start, end) {
  const from = new Date(start).getTime()
  const to = new Date(end).getTime()
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0
  return Math.round((to - from) / 60000)
}

function durationText(minutes) {
  if (!minutes) return '0 giờ'
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  if (!hours) return `${remain} phút`
  return remain ? `${hours} giờ ${remain} phút` : `${hours} giờ`
}

function shiftLabel(schedule = {}, slot = {}) {
  const raw = String(slot.shift_type || schedule.shift_type || schedule.type || schedule.name || '').toLowerCase()
  if (raw.includes('morning') || raw.includes('sáng')) return 'Ca sáng'
  if (raw.includes('afternoon') || raw.includes('chiều')) return 'Ca chiều'
  if (raw.includes('night') || raw.includes('tối')) return 'Ca tối'
  const value = slot.slot_time || slot.start_time || schedule.shift_start || schedule.start_time
  const hour = new Date(value).getHours()
  if (!Number.isNaN(hour) && hour < 12) return 'Ca sáng'
  if (!Number.isNaN(hour) && hour < 17) return 'Ca chiều'
  return 'Ca tối'
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

function slotStart(slot = {}, schedule = {}) {
  return slot.start_time || slot.slot_start || slot.slot_time || slot.appointment_time || schedule.shift_start || schedule.start_time || ''
}

function slotEnd(slot = {}, schedule = {}) {
  return slot.end_time || slot.slot_end || slot.finish_time || ''
}

function slotTimeText(slot = {}, schedule = {}) {
  const start = slotStart(slot, schedule)
  const end = slotEnd(slot, schedule)
  if (end) return `${formatTime(start)} - ${formatTime(end)}`
  const slotMinutes = Number(slot.duration_minutes || slot.slot_duration_minutes || schedule.slot_duration_minutes || 30)
  const parsed = new Date(start)
  if (!Number.isNaN(parsed.getTime()) && slotMinutes > 0) {
    return `${formatTime(start)} - ${formatTime(new Date(parsed.getTime() + slotMinutes * 60000).toISOString())}`
  }
  return formatTime(start)
}

function statusLabel(slot = {}) {
  const raw = String(slot.status || '').toLowerCase()
  if (raw.includes('block')) return 'Đã chặn'
  if (raw.includes('hold')) return 'Tạm giữ'
  return 'Trống'
}

function statusTone(slot = {}) {
  const label = statusLabel(slot)
  if (label === 'Trống') return 'green'
  if (label === 'Tạm giữ') return 'amber'
  return 'slate'
}

function slotDuration(slot = {}, schedule = {}, totalSlots = 0) {
  const explicit = minutesBetween(slotStart(slot, schedule), slotEnd(slot, schedule))
  if (explicit) return explicit
  const configured = Number(slot.duration_minutes || slot.slot_duration_minutes || schedule.slot_duration_minutes)
  if (Number.isFinite(configured) && configured > 0) return configured
  const shiftMinutes = minutesBetween(schedule.shift_start || schedule.start_time, schedule.shift_end || schedule.end_time)
  if (shiftMinutes && totalSlots) return Math.round(shiftMinutes / totalSlots)
  return 30
}

function countsFrom(summary = {}, allSlots = [], bookedSlots = [], availableSlots = []) {
  const totalSlots = numberFrom(summary, ['total_slots', 'totalSlots', 'slots_count', 'slot_count'], allSlots.length || bookedSlots.length + availableSlots.length)
  const bookedCount = numberFrom(summary, ['booked_slots', 'bookedSlots', 'booked_count'], bookedSlots.length)
  const availableCount = numberFrom(summary, ['available_slots', 'availableSlots', 'empty_slots', 'available_count'], Math.max(totalSlots - bookedCount, availableSlots.length))
  return { totalSlots, bookedCount, availableCount }
}

function normalizeBundle(schedule, detail) {
  const allSlots = safeArray(detail.allSlots)
  const bookedSlots = safeArray(detail.bookedSlots).length
    ? safeArray(detail.bookedSlots)
    : allSlots.filter((slot) => slot.is_booked || slot.patient || slot.patient_name)
  const availableSlots = safeArray(detail.availableSlots).length
    ? safeArray(detail.availableSlots)
    : allSlots.filter((slot) => slot.is_available || String(slot.status || '').toLowerCase() === 'available')
  const counts = countsFrom(detail.summary || {}, allSlots, bookedSlots, availableSlots)
  const fallbackRate = counts.totalSlots ? (counts.bookedCount / counts.totalSlots) * 100 : 0
  const utilization = Math.round(numberFrom(detail.utilization || {}, ['utilization_rate', 'utilization', 'rate', 'percentage'], fallbackRate))

  return {
    schedule,
    allSlots,
    bookedSlots,
    availableSlots,
    ...counts,
    utilization: Math.max(0, Math.min(100, utilization)),
    dateKey: toDateKey(schedule.shift_start || schedule.start_time || schedule.date),
  }
}

async function settledValue(promise, fallback) {
  try {
    return await promise
  } catch {
    return fallback
  }
}

async function loadEmptySchedule(user) {
  const today = getTodayDate()
  const monday = startOfWeek(new Date())
  const date_from = toDateKey(monday)
  const date_to = toDateKey(addDays(monday, 6))
  const doctorId = getDoctorId(user)

  const weekSchedules = await settledValue(doctorApi.schedules.myWeek({ date_from, date_to, limit: 140 }), [])
  const calendarSchedules = doctorId
    ? await settledValue(doctorApi.schedules.getCalendar(doctorId, { date_from, date_to, limit: 140 }), [])
    : []
  const baseSchedules = safeArray(weekSchedules).length ? safeArray(weekSchedules) : safeArray(calendarSchedules)

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

  return { today, monday, schedules }
}

function EmptyKpiCard({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-empty-kpi">
      <span className={`doctor-empty-kpi__icon is-${tone}`}>
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

function EmptyDonut({ percent, value }) {
  return (
    <div className="doctor-empty-donut" style={{ '--empty-percent': `${percent}%` }}>
      <div>
        <strong>{value}</strong>
        <span>Tổng slot trống</span>
      </div>
    </div>
  )
}

function heatTone(value, max) {
  if (!value) return 'none'
  const ratio = max ? value / max : 0
  if (ratio >= .78) return 'high'
  if (ratio >= .48) return 'medium'
  return 'low'
}

export function DoctorEmptyScheduleScreen({ user }) {
  const [state, setState] = useState({ loading: true, error: '', data: { today: getTodayDate(), monday: startOfWeek(new Date()), schedules: [] } })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadEmptySchedule(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải lịch trống.'),
          data: { today: getTodayDate(), monday: startOfWeek(new Date()), schedules: [] },
        })
      })
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))

    loadEmptySchedule(user)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải lịch trống.'),
            data: { today: getTodayDate(), monday: startOfWeek(new Date()), schedules: [] },
          })
        }
      })

    return () => {
      active = false
    }
  }, [user])

  const empty = useMemo(() => {
    const days = weekDays(state.data.monday)
    const schedules = safeArray(state.data.schedules).sort((a, b) => new Date(a.schedule.shift_start || a.schedule.start_time) - new Date(b.schedule.shift_start || b.schedule.start_time))
    const totalSlots = schedules.reduce((sum, item) => sum + item.totalSlots, 0)
    const bookedCount = schedules.reduce((sum, item) => sum + item.bookedCount, 0)
    const availableCount = schedules.reduce((sum, item) => sum + item.availableCount, 0)
    const emptyRate = totalSlots ? Math.round((availableCount / totalSlots) * 100) : 0
    const rooms = new Set(schedules.map((item) => roomName(item.schedule)).filter(Boolean))
    const availableRooms = new Set(schedules.filter((item) => item.availableCount > 0).map((item) => roomName(item.schedule)).filter(Boolean))

    const rows = schedules.flatMap((item) => {
      if (item.availableSlots.length) {
        return item.availableSlots.map((slot) => ({
          slot,
          schedule: item.schedule,
          dateKey: toDateKey(slotStart(slot, item.schedule)) || item.dateKey,
          timeValue: slotStart(slot, item.schedule),
          timeText: slotTimeText(slot, item.schedule),
          shift: shiftLabel(item.schedule, slot),
          room: roomName(item.schedule, slot),
          department: departmentName(item.schedule),
          duration: slotDuration(slot, item.schedule, item.totalSlots),
        }))
      }
      if (item.availableCount > 0) {
        return Array.from({ length: item.availableCount }, (_, index) => ({
          slot: { status: 'available' },
          schedule: item.schedule,
          dateKey: item.dateKey,
          timeValue: item.schedule.shift_start || item.schedule.start_time,
          timeText: `${formatTime(item.schedule.shift_start || item.schedule.start_time)} - ${formatTime(item.schedule.shift_end || item.schedule.end_time)}`,
          shift: shiftLabel(item.schedule),
          room: roomName(item.schedule),
          department: departmentName(item.schedule),
          duration: slotDuration({}, item.schedule, item.totalSlots),
          virtualIndex: index,
        }))
      }
      return []
    }).sort((a, b) => new Date(a.timeValue).getTime() - new Date(b.timeValue).getTime())

    const availableMinutes = rows.reduce((sum, row) => sum + row.duration, 0)
    const byShift = SHIFT_ORDER.map((shift) => ({
      label: shift,
      value: rows.filter((row) => row.shift === shift).length,
    }))
    const maxShift = Math.max(1, ...byShift.map((item) => item.value))
    const dayCounts = days.map((day) => {
      const key = toDateKey(day)
      return {
        date: day,
        key,
        label: `${VI_WEEKDAYS[day.getDay()]} ${displayDate(day)}`,
        value: rows.filter((row) => row.dateKey === key).length,
      }
    })
    const maxDay = Math.max(1, ...dayCounts.map((item) => item.value))
    const mostDay = dayCounts.reduce((best, item) => (item.value > best.value ? item : best), dayCounts[0] || null)
    const leastDay = dayCounts.reduce((best, item) => (item.value < best.value ? item : best), dayCounts[0] || null)

    const heatmap = SHIFT_ORDER.map((shift) => ({
      shift,
      cells: days.map((day) => {
        const key = toDateKey(day)
        return {
          key,
          value: rows.filter((row) => row.dateKey === key && row.shift === shift).length,
        }
      }),
    }))

    return {
      days,
      schedules,
      rows,
      totalSlots,
      bookedCount,
      availableCount,
      emptyRate,
      rooms,
      availableRooms,
      availableMinutes,
      byShift,
      maxShift,
      dayCounts,
      maxDay,
      mostDay,
      leastDay,
      heatmap,
    }
  }, [state.data])

  return (
    <div className="doctor-empty-schedule">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

      <section className="doctor-empty-kpis" aria-label="Tổng quan lịch trống">
        <EmptyKpiCard icon="calendar" tone="blue" label="Tổng slot trống" value={empty.availableCount} hint={`${empty.emptyRate}% tổng slot`} />
        <EmptyKpiCard icon="clock" tone="blue-soft" label="Khung giờ còn trống" value={durationText(empty.availableMinutes)} hint={`${empty.rows.length} khung giờ`} />
        <EmptyKpiCard icon="clipboard" tone="purple" label="Phòng khám khả dụng" value={`${empty.availableRooms.size} / ${empty.rooms.size || 0}`} hint={empty.rooms.size ? `${Math.round((empty.availableRooms.size / empty.rooms.size) * 100)}% đang khả dụng` : '--'} />
        <EmptyKpiCard icon="pulse" tone="purple-soft" label="Tỷ lệ trống" value={`${empty.emptyRate}%`} hint="Theo dữ liệu slot hiện tại" />
      </section>

      <section className="doctor-empty-filters" aria-label="Bộ lọc lịch trống">
        <label>
          <span>Khoảng thời gian</span>
          <button type="button"><DoctorIcon name="calendar" /> {weekRangeText(state.data.monday)} <DoctorIcon name="refresh" /></button>
        </label>
        <label>
          <span>Ca khám</span>
          <button type="button">Tất cả ca <DoctorIcon name="chevron_down" /></button>
        </label>
        <label>
          <span>Phòng khám</span>
          <button type="button">Tất cả phòng khám <DoctorIcon name="chevron_down" /></button>
        </label>
        <label>
          <span>Trạng thái</span>
          <button type="button">Tất cả trạng thái <DoctorIcon name="chevron_down" /></button>
        </label>
      </section>

      <section className="doctor-empty-main">
        <article className="doctor-empty-panel doctor-empty-list">
          <header>
            <h2>Danh sách slot trống <span>{empty.availableCount} slot</span></h2>
          </header>
          <div className="doctor-empty-table-head">
            <span>Thời gian</span>
            <span>Ngày</span>
            <span>Ca khám</span>
            <span>Phòng khám</span>
            <span>Trạng thái</span>
            <span>Thao tác</span>
          </div>
          <div className="doctor-empty-table-body">
            {state.loading ? (
              <div className="doctor-empty-state">Đang tải danh sách slot trống...</div>
            ) : empty.rows.length ? empty.rows.slice(0, 8).map((row, index) => (
              <div className="doctor-empty-row" key={`${scheduleIdOf(row.schedule)}-${row.timeValue}-${row.virtualIndex || index}`}>
                <strong>{row.timeText}</strong>
                <span><b>{fullDate(row.timeValue || row.dateKey)}</b><small>{VI_WEEKDAYS[new Date(row.timeValue || row.dateKey).getDay()] || '--'}</small></span>
                <span><em className={row.shift === 'Ca sáng' ? 'is-blue' : row.shift === 'Ca chiều' ? 'is-purple' : 'is-amber'}>{row.shift}</em></span>
                <span><b>{row.room}</b><small>{row.department}</small></span>
                <span><i className={`is-${statusTone(row.slot)}`}>{statusLabel(row.slot)}</i></span>
                <span className="doctor-empty-actions"><button type="button">Đặt nhanh</button><DoctorIcon name="more" /></span>
              </div>
            )) : (
              <div className="doctor-empty-state">Chưa có slot trống trong tuần này.</div>
            )}
          </div>
          <footer>
            <span>Hiển thị {empty.rows.length ? `1 - ${Math.min(8, empty.rows.length)}` : '0'} trong tổng số {empty.rows.length} slot</span>
            <div>
              <button type="button" disabled><DoctorIcon name="chevron_right" /></button>
              <button type="button" className="is-active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <span>...</span>
              <button type="button"><DoctorIcon name="chevron_right" /></button>
            </div>
            <button type="button">8 / trang <DoctorIcon name="chevron_down" /></button>
          </footer>
        </article>

        <aside className="doctor-empty-side">
          <article className="doctor-empty-panel doctor-empty-summary">
            <header>
              <h2>Tóm tắt slot trống</h2>
              <button type="button">Tuần này <DoctorIcon name="chevron_down" /></button>
            </header>
            <div className="doctor-empty-summary__top">
              <EmptyDonut percent={empty.emptyRate} value={empty.availableCount} />
              <dl>
                {empty.byShift.map((item) => (
                  <div key={item.label}>
                    <dt><i className={item.label === 'Ca sáng' ? 'is-green' : item.label === 'Ca chiều' ? 'is-mint' : 'is-orange'} /> {item.label}</dt>
                    <dd>{item.value} ({empty.availableCount ? Math.round((item.value / empty.availableCount) * 100) : 0}%)</dd>
                  </div>
                ))}
                <div><dt><i className="is-slate" /> Hết slot</dt><dd>{Math.max(0, empty.totalSlots - empty.availableCount - empty.bookedCount)}</dd></div>
              </dl>
            </div>
            <div className="doctor-empty-summary__list">
              <div><span>Tổng khung giờ còn trống</span><strong>{durationText(empty.availableMinutes)}</strong></div>
              <div><span>Phòng khám khả dụng</span><strong>{empty.availableRooms.size} / {empty.rooms.size || 0}</strong></div>
              <div><span>Ca khám có slot trống</span><strong>{empty.byShift.filter((item) => item.value > 0).length} / {SHIFT_ORDER.length}</strong></div>
              <div><span>Ngày nhiều trống nhất</span><strong>{empty.mostDay ? `${empty.mostDay.label} (${empty.mostDay.value})` : '--'}</strong></div>
              <div><span>Ngày ít trống nhất</span><strong>{empty.leastDay ? `${empty.leastDay.label} (${empty.leastDay.value})` : '--'}</strong></div>
            </div>
          </article>

          <article className="doctor-empty-panel doctor-empty-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button">
              <span><DoctorIcon name="calendar" /></span>
              <b>Mở lịch mới</b>
              <small>Tạo lịch làm việc cho ngày mới</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={reload} disabled={state.loading}>
              <span><DoctorIcon name="refresh" /></span>
              <b>Làm mới</b>
              <small>Cập nhật trạng thái slot trống</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button">
              <span><DoctorIcon name="note" /></span>
              <b>Xuất danh sách slot</b>
              <small>Xuất file Excel danh sách slot</small>
              <DoctorIcon name="chevron_right" />
            </button>
          </article>
        </aside>
      </section>

      <article className="doctor-empty-panel doctor-empty-heatmap">
        <header>
          <h2>Lịch trống theo ngày & ca khám <DoctorIcon name="warning" /></h2>
          <div>
            <span><i className="is-high" /> Nhiều trống</span>
            <span><i className="is-medium" /> Trung bình</span>
            <span><i className="is-low" /> Ít trống</span>
            <span><i className="is-none" /> Hết slot</span>
          </div>
        </header>
        <div className="doctor-empty-heatmap__grid" style={{ '--empty-day-count': empty.days.length }}>
          <span>Ca khám</span>
          {empty.days.map((day) => <span key={toDateKey(day)}><b>{VI_WEEKDAYS[day.getDay()].replace('Thứ ', 'T')}</b><small>{displayDate(day)}</small></span>)}
          {empty.heatmap.map((row) => (
            <div className="doctor-empty-heatmap__row" key={row.shift}>
              <strong>{row.shift}</strong>
              {row.cells.map((cell) => (
                <em className={`is-${heatTone(cell.value, empty.maxDay)}`} key={`${row.shift}-${cell.key}`}>{cell.value}</em>
              ))}
            </div>
          ))}
        </div>
        <button type="button">Xem lịch chi tiết theo tuần <DoctorIcon name="chevron_right" /></button>
      </article>
    </div>
  )
}
