import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctorApi } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { DoctorIcon } from './DoctorShell'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const VI_WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

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
  if (!date || Number.isNaN(new Date(date).getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date)
}

function weekdayName(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return VI_WEEKDAYS[parsed.getDay()]
}

function weekRangeText(monday) {
  const sunday = addDays(monday, 6)
  return `${displayDate(monday)} - ${displayDate(sunday)}/${sunday.getFullYear()}`
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

function roomName(schedule = {}) {
  return (
    schedule.room_name ||
    schedule.clinic_room ||
    schedule.room ||
    schedule.location ||
    schedule.department_name ||
    'Phòng khám'
  )
}

function scheduleState(schedule = {}) {
  const raw = String(schedule.status || '').toLowerCase()
  const now = Date.now()
  const start = new Date(schedule.shift_start || schedule.start_time).getTime()
  const end = new Date(schedule.shift_end || schedule.end_time).getTime()
  if (raw.includes('cancel')) return { label: 'Không làm việc', tone: 'slate' }
  if (Number.isNaN(start) || Number.isNaN(end)) return { label: 'Đã lên lịch', tone: 'blue' }
  if (now < start) return { label: 'Sắp diễn ra', tone: 'amber' }
  if (now > end) return { label: 'Đã hoàn thành', tone: 'green' }
  return { label: 'Đang diễn ra', tone: 'blue' }
}

function slotListFromSummary(summary = {}, allSlots = [], bookedSlots = [], availableSlots = []) {
  const totalSlots = numberFrom(summary, ['total_slots', 'totalSlots', 'slots_count', 'slot_count'], allSlots.length || bookedSlots.length + availableSlots.length)
  const bookedCount = numberFrom(summary, ['booked_slots', 'bookedSlots', 'booked_count'], bookedSlots.length)
  const availableCount = numberFrom(summary, ['available_slots', 'availableSlots', 'empty_slots', 'available_count'], Math.max(totalSlots - bookedCount, availableSlots.length))
  return { totalSlots, bookedCount, availableCount }
}

function normalizeBundle(schedule, detail) {
  const summary = detail.summary || schedule.slots_summary || schedule.summary || {}
  const allSlots = safeArray(detail.allSlots)
  const bookedSlots = safeArray(detail.bookedSlots).length
    ? safeArray(detail.bookedSlots)
    : allSlots.filter((slot) => slot.is_booked || slot.patient || slot.patient_name)
  const availableSlots = safeArray(detail.availableSlots).length
    ? safeArray(detail.availableSlots)
    : allSlots.filter((slot) => slot.is_available || String(slot.status || '').toLowerCase() === 'available')
  const counts = slotListFromSummary(summary, allSlots, bookedSlots, availableSlots)
  const fallbackRate = counts.totalSlots ? (counts.bookedCount / counts.totalSlots) * 100 : 0
  const utilization = Math.round(numberFrom(detail.utilization || schedule, ['utilization_rate', 'utilization', 'rate', 'percentage'], fallbackRate))

  return {
    schedule,
    allSlots,
    bookedSlots,
    availableSlots,
    ...counts,
    utilization: Math.max(0, Math.min(100, utilization)),
    dateKey: toDateKey(schedule.shift_start || schedule.start_time || schedule.date),
    shiftName: shiftLabel(schedule),
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

async function loadWeekSchedule(weekOffset = 0) {
  const today = getTodayDate()
  const monday = addDays(startOfWeek(new Date()), weekOffset * 7)
  const date_from = toDateKey(monday)
  const date_to = toDateKey(addDays(monday, 6))
  const weekSchedules = await settledValue(doctorApi.schedules.myWeek({ date_from, date_to, limit: 120 }), [])
  const baseSchedules = safeArray(weekSchedules)

  const schedules = await Promise.all(
    baseSchedules.map(async (schedule) => {
      const scheduleId = scheduleIdOf(schedule)
      const [allSlots, availableSlots, bookedSlots, bookedAlias] = scheduleId && !schedule.slots_summary
        ? await Promise.all([
            settledValue(doctorApi.schedules.getSlots(scheduleId), []),
            settledValue(doctorApi.schedules.getAvailableSlots(scheduleId), []),
            settledValue(doctorApi.schedules.getBookedSlotsAlias(scheduleId), []),
            settledValue(doctorApi.schedules.getBookedSlots(scheduleId), []),
          ])
        : [[], [], [], []]

      return normalizeBundle(schedule, {
        allSlots,
        availableSlots,
        bookedSlots: safeArray(bookedSlots).length ? bookedSlots : bookedAlias,
      })
    }),
  )

  return { today, monday, schedules }
}

function WeekKpiCard({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-week-kpi">
      <span className={`doctor-week-kpi__icon is-${tone}`}>
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

function WeekDonut({ percent }) {
  return (
    <div className="doctor-week-donut" style={{ '--week-percent': `${percent}%` }}>
      <div>
        <strong>{percent}%</strong>
        <span>Hiệu suất</span>
      </div>
    </div>
  )
}

function WeekSummaryRing({ percent }) {
  return (
    <div className="doctor-week-ref-ring" style={{ '--week-ring-percent': `${percent}%` }}>
      <div>
        <strong>{percent}%</strong>
        <span>Hiệu suất</span>
      </div>
    </div>
  )
}

function ScheduleCell({ bundle, onOpen }) {
  if (!bundle) {
    return (
      <div className="doctor-week-cell is-empty">
        <span>-</span>
        <em>Không làm việc</em>
      </div>
    )
  }

  return (
    <div className={`doctor-week-cell is-${bundle.state.tone}`} role="button" tabIndex={0} onClick={() => onOpen?.(scheduleIdOf(bundle.schedule))} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') onOpen?.(scheduleIdOf(bundle.schedule))
    }}>
      <strong>{roomName(bundle.schedule)}</strong>
      <span>{bundle.bookedCount}/{bundle.totalSlots || 0} slot</span>
      <i><b style={{ width: `${bundle.utilization}%` }} /></i>
      <em>{bundle.state.label}</em>
    </div>
  )
}

function shiftPeriodOf(bundle = {}) {
  const raw = String(bundle.schedule?.shift_type || bundle.schedule?.type || bundle.shiftName || '').toLowerCase()
  if (raw.includes('morning') || raw.includes('sáng')) return 'morning'
  if (raw.includes('afternoon') || raw.includes('chiều')) return 'afternoon'
  const hour = new Date(bundle.schedule?.shift_start || bundle.schedule?.start_time).getHours()
  if (!Number.isNaN(hour) && hour < 12) return 'morning'
  return 'afternoon'
}

function WeekShiftPreview({ bundle }) {
  if (!bundle) {
    return (
      <div className="doctor-week-ref-shift is-empty">
        <i />
        <span>Không làm việc</span>
      </div>
    )
  }

  return (
    <div className={`doctor-week-ref-shift is-${bundle.state.tone}`}>
      <div>
        <strong>{roomName(bundle.schedule)}</strong>
        <small>{bundle.bookedCount}/{bundle.totalSlots || 0} slot</small>
      </div>
      <em>{bundle.state.label}</em>
      <b><span style={{ width: `${bundle.utilization}%` }} /></b>
    </div>
  )
}

function HighlightLevel({ percent }) {
  if (percent >= 85) return { label: 'Cao điểm', tone: 'red' }
  if (percent >= 70) return { label: 'Cao', tone: 'orange' }
  if (percent >= 45) return { label: 'Trung bình', tone: 'amber' }
  return { label: 'Thấp', tone: 'green' }
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

export function DoctorWeekScheduleScreen({ user }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [weekOffset, setWeekOffset] = useState(0)
  const [state, setState] = useState({ loading: true, error: '', data: { today: getTodayDate(), monday: startOfWeek(new Date()), schedules: [] } })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadWeekSchedule(weekOffset)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải lịch làm việc tuần này.'),
          data: { today: getTodayDate(), monday: startOfWeek(new Date()), schedules: [] },
        })
      })
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))

    loadWeekSchedule(weekOffset)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải lịch làm việc tuần này.'),
            data: { today: getTodayDate(), monday: startOfWeek(new Date()), schedules: [] },
          })
        }
      })

    return () => {
      active = false
    }
  }, [weekOffset])

  const week = useMemo(() => {
    const days = weekDays(state.data.monday)
    const schedules = safeArray(state.data.schedules).sort((a, b) => new Date(a.schedule.shift_start || a.schedule.start_time) - new Date(b.schedule.shift_start || b.schedule.start_time))
    const byDay = new Map()
    const shiftRows = new Map()

    schedules.forEach((bundle) => {
      const start = bundle.schedule.shift_start || bundle.schedule.start_time
      const end = bundle.schedule.shift_end || bundle.schedule.end_time
      const dateKey = bundle.dateKey || toDateKey(start)
      const shiftKey = `${formatTime(start)}-${formatTime(end)}`
      const row = shiftRows.get(shiftKey) || {
        key: shiftKey,
        label: bundle.shiftName,
        time: `${formatTime(start)} - ${formatTime(end)}`,
        start: new Date(start).getTime(),
      }
      shiftRows.set(shiftKey, row)
      byDay.set(`${dateKey}:${shiftKey}`, bundle)
    })

    const rows = Array.from(shiftRows.values()).sort((a, b) => a.start - b.start)
    const totalSlots = schedules.reduce((sum, item) => sum + item.totalSlots, 0)
    const bookedCount = schedules.reduce((sum, item) => sum + item.bookedCount, 0)
    const availableCount = schedules.reduce((sum, item) => sum + item.availableCount, 0)
    const utilization = totalSlots ? Math.round((bookedCount / totalSlots) * 100) : 0
    const workDays = new Set(schedules.map((item) => item.dateKey).filter(Boolean)).size
    const primaryRoom = schedules.find((item) => roomName(item.schedule))?.schedule
    const upcoming = schedules.filter((item) => new Date(item.schedule.shift_start || item.schedule.start_time).getTime() >= Date.now()).slice(0, 5)
    const daySummaries = days.map((day) => {
      const dateKey = toDateKey(day)
      const dayBundles = schedules.filter((item) => item.dateKey === dateKey)
      const morning = dayBundles.find((item) => shiftPeriodOf(item) === 'morning')
      const afternoon = dayBundles.find((item) => shiftPeriodOf(item) === 'afternoon')
      const dayTotal = dayBundles.reduce((sum, item) => sum + item.totalSlots, 0)
      const dayBooked = dayBundles.reduce((sum, item) => sum + item.bookedCount, 0)
      return {
        day,
        dateKey,
        morning,
        afternoon,
        totalSlots: dayTotal,
        bookedCount: dayBooked,
        utilization: dayTotal ? Math.round((dayBooked / dayTotal) * 100) : 0,
      }
    })
    const highlighted = schedules
      .map((item) => ({
        time: `${formatTime(item.schedule.shift_start || item.schedule.start_time)} - ${formatTime(item.schedule.shift_end || item.schedule.end_time)}`,
        percent: item.utilization,
        level: HighlightLevel({ percent: item.utilization }),
        day: weekdayName(item.schedule.shift_start || item.schedule.start_time),
      }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 4)

    return {
      days,
      rows,
      daySummaries,
      byDay,
      schedules,
      totalSlots,
      bookedCount,
      availableCount,
      utilization,
      workDays,
      primaryRoom,
      upcoming,
      highlighted,
    }
  }, [state.data])

  function openScheduleDetail(scheduleId) {
    if (!scheduleId) {
      toast.info('Backend chưa trả scheduleId thật nên chưa thể mở chi tiết ca làm.')
      return
    }
    navigate(`/doctor/schedules/${encodeURIComponent(scheduleId)}`)
  }

  function showNeedsData(message = 'Không có dữ liệu lịch tuần thật từ backend nên thao tác này chưa hoạt động.') {
    toast.info(message)
  }

  function goWeek(offset) {
    setWeekOffset((current) => current + offset)
  }

  function goCurrentWeek() {
    if (weekOffset === 0) {
      refreshWeek()
      return
    }
    setWeekOffset(0)
  }

  function exportWeekSchedule() {
    if (state.loading) {
      toast.info('Dữ liệu lịch tuần đang tải, chưa thể xuất lịch.')
      return
    }
    if (!week.schedules.length) {
      toast.info('Không có dữ liệu lịch tuần thật từ backend nên chưa thể xuất lịch.')
      return
    }
    downloadCsv(`lich-lam-viec-tuan-${toDateKey(state.data.monday)}.csv`, [
      ['Ngay', 'Ca kham', 'Thoi gian', 'Phong kham', 'Trang thai', 'Tong slot', 'Slot da dat', 'Slot con trong', 'Hieu suat'],
      ...week.schedules.map((item) => [
        displayDate(new Date(item.schedule.shift_start || item.schedule.start_time || item.dateKey)),
        item.shiftName,
        `${formatTime(item.schedule.shift_start || item.schedule.start_time)} - ${formatTime(item.schedule.shift_end || item.schedule.end_time)}`,
        roomName(item.schedule),
        item.state.label,
        item.totalSlots,
        item.bookedCount,
        item.availableCount,
        `${item.utilization}%`,
      ]),
    ])
    toast.success('Đã xuất lịch tuần từ dữ liệu hiện tại.')
  }

  function refreshWeek() {
    if (state.loading) {
      toast.info('Dữ liệu lịch tuần đang tải, vui lòng chờ trong giây lát.')
      return
    }
    reload()
  }

  function openFirstSchedule(message = 'Không có dữ liệu lịch tuần thật từ backend để mở chi tiết.') {
    if (state.loading) {
      toast.info('Dữ liệu lịch tuần đang tải, vui lòng chờ trong giây lát.')
      return
    }
    const first = week.upcoming[0] || week.schedules[0]
    if (!first) {
      toast.info(message)
      return
    }
    openScheduleDetail(scheduleIdOf(first.schedule))
  }

  function showWeekList() {
    if (state.loading) {
      toast.info('Dữ liệu lịch tuần đang tải, vui lòng chờ trong giây lát.')
      return
    }
    if (!week.schedules.length) {
      toast.info('Không có dữ liệu lịch tuần thật từ backend để hiển thị.')
      return
    }
    toast.info('Danh sách ca làm trong tuần đang hiển thị ở bảng lịch phía dưới.')
  }

  return (
    <div className="doctor-week-schedule">
      {state.error ? (
        <div className="doctor-today-error">
          <span>{state.error}</span>
          <button type="button" onClick={reload}>Thử lại</button>
        </div>
      ) : null}

      <section className="doctor-week-kpis" aria-label="Tổng quan lịch tuần này">
        <WeekKpiCard icon="calendar" tone="blue" label="Ca trực trong tuần" value={week.schedules.length} hint={`${week.workDays} ngày làm việc`} />
        <WeekKpiCard icon="patients" tone="green" label="Tổng slot đã đặt" value={week.bookedCount} hint={`${week.utilization}% tổng slot`} />
        <WeekKpiCard icon="calendar" tone="orange" label="Slot còn trống" value={week.availableCount} hint={week.totalSlots ? `${Math.max(0, 100 - week.utilization)}% tổng slot` : '--'} />
        <WeekKpiCard icon="pulse" tone="purple" label="Hiệu suất tuần" value={`${week.utilization}%`} hint="Theo dữ liệu slot hiện tại" />
      </section>

      <section className="doctor-week-reference-layout">
        <div className="doctor-week-reference-left">
          <article className="doctor-week-panel doctor-week-reference-calendar">
            <header>
              <h2>Lịch làm việc trong tuần</h2>
            </header>

            <div className="doctor-week-ref-table">
              <div className="doctor-week-ref-head">
                <span>Ngày</span>
                <span>Buổi sáng</span>
                <span>Buổi chiều</span>
                <span>Tổng quan</span>
              </div>
              {state.loading ? (
                <div className="doctor-week-loading">Đang tải lịch tuần này...</div>
              ) : week.daySummaries.map((dayItem) => (
                <div className="doctor-week-ref-row" key={dayItem.dateKey}>
                  <div className="doctor-week-ref-day">
                    <strong>{VI_WEEKDAYS[dayItem.day.getDay()]}</strong>
                    <small>{displayDate(dayItem.day)}</small>
                  </div>
                  <WeekShiftPreview bundle={dayItem.morning} />
                  <WeekShiftPreview bundle={dayItem.afternoon} />
                  <div className="doctor-week-ref-total">
                    <div>
                      <strong>{dayItem.bookedCount}/{dayItem.totalSlots || 0}</strong>
                      <small>{dayItem.utilization}%</small>
                    </div>
                    <b><span style={{ width: `${dayItem.utilization}%` }} /></b>
                    <DoctorIcon name="chevron_right" />
                  </div>
                </div>
              ))}
            </div>

            <div className="doctor-week-ref-footer">
              <button className="doctor-week-ref-link" type="button" onClick={showWeekList}>
                Xem lịch trong tuần <DoctorIcon name="chevron_right" />
              </button>
            </div>
          </article>

          <div className="doctor-week-reference-bottom">
            <article className="doctor-week-panel doctor-week-upcoming">
              <header>
                <h2>Lịch sắp tới trong tuần</h2>
                <button className="doctor-week-ref-link" type="button" onClick={showWeekList}>Xem tất cả</button>
              </header>
              <div className="doctor-week-ref-upcoming-list">
                {(week.upcoming.length ? week.upcoming : week.schedules.slice(0, 4)).map((item) => (
                  <div className="doctor-week-ref-upcoming-row" role="button" tabIndex={0} onClick={() => openScheduleDetail(scheduleIdOf(item.schedule))} onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') openScheduleDetail(scheduleIdOf(item.schedule))
                  }} key={scheduleIdOf(item.schedule) || `${item.dateKey}-${item.shiftName}`}>
                    <span><strong>{weekdayName(item.schedule.shift_start || item.schedule.start_time)}</strong><small>{displayDate(new Date(item.schedule.shift_start || item.schedule.start_time))}</small></span>
                    <span><small>{formatTime(item.schedule.shift_start || item.schedule.start_time)} - {formatTime(item.schedule.shift_end || item.schedule.end_time)}</small></span>
                    <span><strong>{roomName(item.schedule)}</strong><small>{item.bookedCount}/{item.totalSlots || 0} slot đã đặt</small></span>
                    <b className={`is-${item.state.tone}`}>{item.state.label}</b>
                  </div>
                ))}
                {!week.schedules.length && !state.loading ? <div className="doctor-week-empty">Chưa có lịch sắp tới.</div> : null}
              </div>
              <button className="doctor-week-link-button" type="button" onClick={showWeekList}>Xem lịch đầy đủ <DoctorIcon name="chevron_right" /></button>
            </article>

            <article className="doctor-week-panel doctor-week-highlight">
              <header>
                <h2>Khung giờ nổi bật</h2>
                <button className="doctor-week-ref-link" type="button" onClick={() => openFirstSchedule('Không có ca làm thật từ backend để xem chi tiết.')}>Xem chi tiết</button>
              </header>
              <div className="doctor-week-ref-highlight-list">
                {(week.highlighted.length ? week.highlighted.slice(0, 3) : [{ time: '--', percent: 0, day: '--', level: HighlightLevel({ percent: 0 }) }]).map((item, index) => (
                  <div className={`doctor-week-ref-highlight-row is-${item.level.tone}`} key={`${item.time}-${index}`}>
                    <span><DoctorIcon name={index === 1 ? 'clock' : index === 2 ? 'pulse' : 'check_circle'} /></span>
                    <div>
                      <strong>{index === 0 ? 'Giờ cao điểm' : index === 1 ? 'Giờ thấp điểm' : 'Hiệu suất cao nhất'}</strong>
                      <small>{item.time} (Tỷ lệ đặt: {item.percent}%)</small>
                    </div>
                    <em>{item.day}</em>
                  </div>
                ))}
              </div>
              <button className="doctor-week-link-button" type="button" onClick={() => showNeedsData('Phân tích chi tiết đang dùng dữ liệu tuần hiện tại; chưa có endpoint riêng để mở báo cáo sâu hơn.')}>Xem phân tích chi tiết <DoctorIcon name="chevron_right" /></button>
            </article>

          </div>
        </div>

        <aside className="doctor-week-reference-side">
          <article className="doctor-week-panel doctor-week-ref-overview">
            <h2>Tổng quan tuần</h2>
            <div className="doctor-week-ref-overview-main">
              <WeekSummaryRing percent={week.utilization} />
              <dl className="doctor-week-ref-legend">
                <div><dt><i className="is-green" />Tổng số slot</dt><dd>{week.totalSlots}</dd></div>
                <div><dt><i className="is-blue" />Slot đã đặt</dt><dd>{week.bookedCount}</dd></div>
                <div><dt><i className="is-orange" />Slot còn trống</dt><dd>{week.availableCount}</dd></div>
                <div><dt><i className="is-green" />Đã hoàn thành</dt><dd>{week.schedules.filter((item) => item.state.tone === 'green').length}</dd></div>
                <div><dt><i className="is-blue" />Đang diễn ra</dt><dd>{week.schedules.filter((item) => item.state.tone === 'blue').length}</dd></div>
                <div><dt><i className="is-amber" />Sắp diễn ra</dt><dd>{week.schedules.filter((item) => item.state.tone === 'amber').length}</dd></div>
                <div><dt><i className="is-slate" />Không làm việc</dt><dd>{Math.max(0, (week.days.length * 2) - week.schedules.length)}</dd></div>
              </dl>
            </div>
            <div className="doctor-week-ref-summary-list">
              <div><span><DoctorIcon name="clock" /></span><b>Thời gian làm việc</b><strong>{Math.round((week.schedules.reduce((sum, item) => sum + minutesBetween(item.schedule.shift_start || item.schedule.start_time, item.schedule.shift_end || item.schedule.end_time), 0)) / 60)} giờ</strong></div>
              <div><span><DoctorIcon name="pin" /></span><b>Phòng khám chính</b><strong>{week.primaryRoom ? roomName(week.primaryRoom) : '--'}</strong></div>
              <div><span><DoctorIcon name="doctor" /></span><b>Bác sĩ phụ trách</b><strong>{user?.full_name || user?.name || 'Bác sĩ'}</strong></div>
            </div>
          </article>

          <article className="doctor-week-panel doctor-week-ref-actions">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => week.availableCount ? showWeekList() : showNeedsData('Không có dữ liệu slot trống thật từ backend trong tuần này.')}>
              <span className="is-blue"><DoctorIcon name="calendar" /></span>
              <div><strong>Xem lịch trống trong tuần</strong><small>Tìm khung giờ còn trống để đặt thêm</small></div>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={() => showNeedsData('Tạo ca làm việc mới cần endpoint ghi lịch và quyền phù hợp; trang bác sĩ hiện chỉ đọc lịch cá nhân.')}>
              <span className="is-green"><DoctorIcon name="plus" /></span>
              <div><strong>Tạo ca làm việc mới</strong><small>Thêm ca trực hoặc khung giờ làm việc</small></div>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={exportWeekSchedule}>
              <span className="is-purple"><DoctorIcon name="note" /></span>
              <div><strong>Xuất báo cáo tuần</strong><small>Tải báo cáo hiệu suất làm việc tuần</small></div>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={refreshWeek}>
              <span className="is-green"><DoctorIcon name="refresh" /></span>
              <div><strong>Đồng bộ lịch cá nhân</strong><small>Kết nối với Google Calendar / Outlook</small></div>
              <DoctorIcon name="chevron_right" />
            </button>
          </article>
        </aside>
      </section>

      <section className="doctor-week-main">
        <article className="doctor-week-panel doctor-week-calendar">
          <header>
            <h2>Lịch làm việc theo tuần</h2>
            <div className="doctor-week-range">
              <button type="button" aria-label="Tuần trước" onClick={() => goWeek(-1)}><DoctorIcon name="chevron_right" /></button>
              <strong>{weekRangeText(state.data.monday)}</strong>
              <button type="button" aria-label="Tuần sau" onClick={() => goWeek(1)}><DoctorIcon name="chevron_right" /></button>
            </div>
            <button className="doctor-week-today-button" type="button" onClick={goCurrentWeek}>
              Tuần này <DoctorIcon name="calendar" />
            </button>
          </header>

          <div className="doctor-week-grid" style={{ '--week-day-count': week.days.length }}>
            <div className="doctor-week-grid__head is-time">Thời gian</div>
            {week.days.map((day) => {
              const dateKey = toDateKey(day)
              const isToday = dateKey === state.data.today
              return (
                <div className={`doctor-week-grid__head${isToday ? ' is-today' : ''}`} key={dateKey}>
                  <strong>{VI_WEEKDAYS[day.getDay()]}</strong>
                  <span>{displayDate(day)}</span>
                  {isToday ? <em>Hôm nay</em> : null}
                </div>
              )
            })}

            {state.loading ? (
              <div className="doctor-week-loading">Đang tải lịch tuần này...</div>
            ) : week.rows.length ? week.rows.map((row) => (
              <div className="doctor-week-grid__row" key={row.key}>
                <div className="doctor-week-time-cell">
                  <strong>{row.time}</strong>
                  <span>{row.label.replace('Ca ', '')}</span>
                </div>
                {week.days.map((day) => (
                  <ScheduleCell
                    key={`${toDateKey(day)}:${row.key}`}
                    bundle={week.byDay.get(`${toDateKey(day)}:${row.key}`)}
                    onOpen={openScheduleDetail}
                  />
                ))}
              </div>
            )) : (
              <div className="doctor-week-loading">Chưa có lịch làm việc trong tuần này.</div>
            )}

            {week.rows.length ? (
              <div className="doctor-week-grid__row is-total">
                <div className="doctor-week-time-cell"><strong>Tổng slot</strong></div>
                {week.days.map((day) => {
                  const dateKey = toDateKey(day)
                  const dayBundles = week.schedules.filter((item) => item.dateKey === dateKey)
                  const total = dayBundles.reduce((sum, item) => sum + item.totalSlots, 0)
                  const booked = dayBundles.reduce((sum, item) => sum + item.bookedCount, 0)
                  return <div className="doctor-week-total-cell" key={dateKey}>{booked}/{total}</div>
                })}
              </div>
            ) : null}
          </div>

          <footer>
            <span><i className="is-blue" /> Đang diễn ra</span>
            <span><i className="is-green" /> Đã hoàn thành</span>
            <span><i className="is-orange" /> Sắp diễn ra</span>
            <span><i className="is-slate" /> Không làm việc</span>
          </footer>
        </article>

        <aside className="doctor-week-panel doctor-week-summary">
          <header>
            <h2>Tóm tắt tuần</h2>
            <button type="button" onClick={goCurrentWeek}>Tuần này <DoctorIcon name="chevron_down" /></button>
          </header>
          <div className="doctor-week-summary__body">
            <WeekDonut percent={week.utilization} />
            <dl>
              <div><dt>Tổng slot</dt><dd>{week.totalSlots}</dd></div>
              <div><dt><i className="is-green" /> Đã đặt</dt><dd>{week.bookedCount} ({week.utilization}%)</dd></div>
              <div><dt><i className="is-orange" /> Còn trống</dt><dd>{week.availableCount} ({week.totalSlots ? Math.max(0, 100 - week.utilization) : 0}%)</dd></div>
            </dl>
          </div>
          <div className="doctor-week-summary__list">
            <div><span>Số ngày làm việc</span><strong>{week.workDays}/7 ngày</strong></div>
            <div><span>Tổng ca trực</span><strong>{week.schedules.length} ca</strong></div>
            <div><span>Phòng khám chính</span><strong>{week.primaryRoom ? roomName(week.primaryRoom) : '--'}</strong></div>
            <div><span>Hiệu suất trung bình/ngày</span><strong>{week.utilization}%</strong></div>
          </div>
          <button className="doctor-week-detail-button" type="button" onClick={() => showNeedsData('Chi tiết hiệu suất đang được tính từ dữ liệu tuần hiện tại; chưa có endpoint báo cáo sâu hơn.')}>Xem chi tiết hiệu suất <DoctorIcon name="chevron_right" /></button>
        </aside>
      </section>

      <section className="doctor-week-bottom">
        <article className="doctor-week-panel doctor-week-upcoming">
          <header>
            <h2>Lịch sắp tới trong tuần</h2>
          </header>
          <div className="doctor-week-table">
            <div className="doctor-week-table__head">
              <span>Thời gian</span>
              <span>Ca khám</span>
              <span>Phòng khám</span>
              <span>Trạng thái</span>
              <span>Đã đặt / Tổng slot</span>
            </div>
            {(week.upcoming.length ? week.upcoming : week.schedules.slice(0, 5)).map((item) => (
              <div className="doctor-week-table__row" role="button" tabIndex={0} onClick={() => openScheduleDetail(scheduleIdOf(item.schedule))} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') openScheduleDetail(scheduleIdOf(item.schedule))
              }} key={scheduleIdOf(item.schedule) || `${item.dateKey}-${item.shiftName}`}>
                <span><strong>{weekdayName(item.schedule.shift_start || item.schedule.start_time)}, {displayDate(new Date(item.schedule.shift_start || item.schedule.start_time))}</strong><small>{formatTime(item.schedule.shift_start || item.schedule.start_time)} - {formatTime(item.schedule.shift_end || item.schedule.end_time)}</small></span>
                <span>{item.shiftName}</span>
                <span>{roomName(item.schedule)}</span>
                <span><b className={`is-${item.state.tone}`}>{item.state.label}</b></span>
                <span className="doctor-week-mini-progress"><i><b style={{ width: `${item.utilization}%` }} /></i>{item.bookedCount}/{item.totalSlots || 0}</span>
              </div>
            ))}
            {!week.schedules.length && !state.loading ? <div className="doctor-week-empty">Chưa có lịch sắp tới.</div> : null}
          </div>
          <button className="doctor-week-link-button" type="button" onClick={showWeekList}>Xem toàn bộ lịch tuần <DoctorIcon name="chevron_right" /></button>
        </article>

        <article className="doctor-week-panel doctor-week-highlight">
          <header>
            <h2>Khung giờ nổi bật</h2>
          </header>
          <div className="doctor-week-highlight__list">
            {(week.highlighted.length ? week.highlighted : [{ time: '--', percent: 0, level: HighlightLevel({ percent: 0 }) }]).map((item, index) => (
              <div className="doctor-week-highlight__row" key={`${item.time}-${index}`}>
                <strong>{item.time}</strong>
                <span className={`is-${item.level.tone}`}>{item.level.label}</span>
                <em>{item.percent}%</em>
                <i><b className={`is-${item.level.tone}`} style={{ width: `${item.percent}%` }} /></i>
              </div>
            ))}
          </div>
          <button className="doctor-week-link-button" type="button" onClick={() => showNeedsData('Chi tiết khung giờ đang dùng dữ liệu tuần hiện tại; chưa có endpoint riêng để mở thêm.')}>Xem chi tiết khung giờ <DoctorIcon name="chevron_right" /></button>
        </article>

        <aside className="doctor-week-panel doctor-week-actions">
          <h2>Thao tác nhanh</h2>
          <button type="button" onClick={showWeekList}>
            <span><DoctorIcon name="calendar" /></span>
            <b>Xem lịch chi tiết</b>
            <small>Xem toàn bộ lịch theo ngày</small>
            <DoctorIcon name="chevron_right" />
          </button>
          <button type="button" onClick={refreshWeek}>
            <span><DoctorIcon name="refresh" /></span>
            <b>Làm mới</b>
            <small>Cập nhật lịch và trạng thái slot</small>
            <DoctorIcon name="chevron_right" />
          </button>
          <button type="button" onClick={exportWeekSchedule}>
            <span><DoctorIcon name="note" /></span>
            <b>Xuất lịch tuần</b>
            <small>Xuất lịch tuần (PDF/Excel)</small>
            <DoctorIcon name="chevron_right" />
          </button>
        </aside>
      </section>
    </div>
  )
}
