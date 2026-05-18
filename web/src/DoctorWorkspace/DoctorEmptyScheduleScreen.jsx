import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctorApi } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { DoctorIcon } from './DoctorShell'
import { getApiErrorMessage } from '../utils/api'

const VI_WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const SHIFT_ORDER = ['Ca sáng', 'Ca chiều', 'Ca tối']
const HEATMAP_SHIFTS = [
  { label: 'Ca sáng 1', time: '07:00 - 09:00', from: 7, to: 9 },
  { label: 'Ca sáng 2', time: '09:00 - 11:30', from: 9, to: 12 },
  { label: 'Ca chiều 1', time: '13:30 - 15:30', from: 12, to: 15 },
  { label: 'Ca chiều 2', time: '15:30 - 17:30', from: 15, to: 18 },
]

const DEFAULT_FILTERS = {
  shift: 'all',
  room: 'all',
  status: 'all',
}
const PAGE_SIZE = 5
const RANGE_OFFSETS = [-1, 0, 1]

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
  const raw = String(slot.status || slot.slotStatus || slot.slot_status || '').toLowerCase()
  if (['available', 'open', 'free', 'empty'].some((value) => raw.includes(value))) return 'Còn trống'
  if (['booked', 'reserved', 'confirmed'].some((value) => raw.includes(value))) return 'Đã đặt'
  if (['held', 'holding', 'pending', 'hold'].some((value) => raw.includes(value))) return 'Giữ tạm'
  if (['full', 'unavailable', 'closed', 'block'].some((value) => raw.includes(value))) return 'Hết slot'
  if (['cancelled', 'canceled'].some((value) => raw.includes(value))) return 'Đã hủy'
  return 'Còn trống'
}

function statusTone(slot = {}) {
  const label = statusLabel(slot)
  if (label === 'Còn trống') return 'green'
  if (label === 'Đã đặt') return 'blue'
  if (label === 'Giữ tạm') return 'amber'
  if (label === 'Hết slot' || label === 'Đã hủy') return 'red'
  return 'slate'
}

function isAvailableSlot(slot = {}) {
  return statusLabel(slot) === 'Còn trống' || slot.is_available === true
}

function isBookedSlot(slot = {}) {
  return statusLabel(slot) === 'Đã đặt' || slot.is_booked === true || Boolean(slot.patient || slot.patient_name)
}

function compactDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return `${VI_WEEKDAYS[parsed.getDay()]}, ${displayDate(parsed)}`
}

function tableShiftLabel(row = {}) {
  const hour = new Date(row.timeValue).getHours()
  if (row.shift === 'Ca sáng') return hour < 9 ? 'Ca sáng 1' : 'Ca sáng 2'
  if (row.shift === 'Ca chiều') return hour < 15 ? 'Ca chiều 1' : 'Ca chiều 2'
  return row.shift
}

function rowActionLabel(slot = {}) {
  return 'Xem chi tiết'
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
  const totalSlots = numberFrom(summary, ['total_slots', 'totalSlots', 'slots_count', 'slot_count', 'slotCount', 'slot_count'], allSlots.length || bookedSlots.length + availableSlots.length)
  const bookedCount = numberFrom(summary, ['booked_slots', 'bookedSlots', 'booked_count', 'bookedSlotCount', 'booked_slot_count'], bookedSlots.length)
  const availableCount = numberFrom(summary, ['available_slots', 'availableSlots', 'empty_slots', 'available_count', 'availableSlotCount', 'available_slot_count'], Math.max(totalSlots - bookedCount, availableSlots.length))
  return { totalSlots, bookedCount, availableCount }
}

function embeddedSlots(schedule = {}) {
  return [
    ...safeArray(schedule.slots),
    ...safeArray(schedule.schedule_slots),
    ...safeArray(schedule.slot_list),
  ]
}

function embeddedAvailableSlots(schedule = {}) {
  return [
    ...safeArray(schedule.availableSlots),
    ...safeArray(schedule.available_slots),
    ...safeArray(schedule.emptySlots),
    ...safeArray(schedule.empty_slots),
  ]
}

function embeddedBookedSlots(schedule = {}) {
  return [
    ...safeArray(schedule.bookedSlots),
    ...safeArray(schedule.booked_slots),
  ]
}

function normalizeBundle(schedule, detail) {
  const allSlots = safeArray(detail.allSlots)
  const bookedSlots = safeArray(detail.bookedSlots).length
    ? safeArray(detail.bookedSlots)
    : allSlots.filter(isBookedSlot)
  const availableSlots = safeArray(detail.availableSlots).length
    ? safeArray(detail.availableSlots)
    : allSlots.filter(isAvailableSlot)
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

async function loadEmptySchedule(user, rangeOffset = 0) {
  const today = getTodayDate()
  const monday = addDays(startOfWeek(new Date()), rangeOffset * 7)
  const date_from = toDateKey(monday)
  const date_to = toDateKey(addDays(monday, 6))

  const weekSchedules = await (
    rangeOffset === 0
      ? doctorApi.schedules.myWeek({ date_from, date_to, limit: 140 })
      : doctorApi.schedules.dateRange({ date_from, date_to, limit: 140 })
  )
  const baseSchedules = safeArray(weekSchedules)

  const schedules = await Promise.all(
    baseSchedules.map(async (schedule) => {
      const scheduleId = scheduleIdOf(schedule)
      const embeddedAll = embeddedSlots(schedule)
      const embeddedAvailable = embeddedAvailableSlots(schedule)
      const embeddedBooked = embeddedBookedSlots(schedule)
      const hasEmbeddedSlots = embeddedAll.length || embeddedAvailable.length || embeddedBooked.length
      const hasSummaryCounts = ['total_slots', 'totalSlots', 'slots_count', 'slot_count', 'available_slots', 'availableSlots', 'availableSlotCount', 'available_slot_count'].some((key) => schedule[key] !== undefined)
      const hasUtilization = ['utilization_rate', 'utilization', 'rate', 'percentage'].some((key) => schedule[key] !== undefined)

      const [summary, utilization, allSlots, availableSlots, bookedSlots, bookedAlias] = await Promise.all([
        scheduleId && !hasSummaryCounts ? settledValue(doctorApi.schedules.getSummary(scheduleId), null) : Promise.resolve(schedule),
        scheduleId && !hasUtilization ? settledValue(doctorApi.schedules.getUtilization(scheduleId), null) : Promise.resolve(schedule),
        scheduleId && !hasEmbeddedSlots && !hasSummaryCounts ? settledValue(doctorApi.schedules.getSlots(scheduleId), []) : Promise.resolve(embeddedAll),
        scheduleId && !embeddedAvailable.length ? settledValue(doctorApi.schedules.getAvailableSlots(scheduleId), []) : Promise.resolve(embeddedAvailable),
        scheduleId && !embeddedBooked.length ? settledValue(doctorApi.schedules.getBookedSlots(scheduleId), []) : Promise.resolve(embeddedBooked),
        scheduleId && !embeddedBooked.length ? settledValue(doctorApi.schedules.getBookedSlotsAlias(scheduleId), []) : Promise.resolve([]),
      ])

      return normalizeBundle(schedule, {
        summary,
        utilization,
        allSlots: safeArray(allSlots).length ? allSlots : embeddedAll,
        availableSlots,
        bookedSlots: safeArray(bookedSlots).length ? bookedSlots : bookedAlias,
      })
    }),
  )

  return { today, monday, schedules }
}

function cycleFilterValue(current, values = []) {
  const options = ['all', ...values.filter(Boolean)]
  const index = options.indexOf(current)
  return options[(index + 1) % options.length] || 'all'
}

function nextRangeOffset(current) {
  const index = RANGE_OFFSETS.indexOf(current)
  return RANGE_OFFSETS[(index + 1) % RANGE_OFFSETS.length] ?? 0
}

function filterLabel(value, fallback = 'Tất cả') {
  return value === 'all' || !value ? fallback : value
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

function EmptyDonut({ percent, value, label = 'Tổng slot trống' }) {
  return (
    <div className="doctor-empty-donut" style={{ '--empty-percent': `${percent}%` }}>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

function heatTone(value, max) {
  if (value <= 0) return 'none'
  if (value >= 10) return 'high'
  if (value >= 5) return 'medium'
  return 'low'
}

export function DoctorEmptyScheduleScreen({ user }) {
  const navigate = useNavigate()
  const heatmapRef = useRef(null)
  const [state, setState] = useState({ loading: true, error: '', data: { today: getTodayDate(), monday: startOfWeek(new Date()), schedules: [] } })
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [pendingFilters, setPendingFilters] = useState(DEFAULT_FILTERS)
  const [rangeOffset, setRangeOffset] = useState(0)
  const [pendingRangeOffset, setPendingRangeOffset] = useState(0)
  const [page, setPage] = useState(1)
  const [detailState, setDetailState] = useState({ loading: false, error: '', schedule: null })
  const [actionNotice, setActionNotice] = useState('')

  function reload(nextRangeOffsetValue = rangeOffset) {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadEmptySchedule(user, nextRangeOffsetValue)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải lịch trống.'),
          data: { today: getTodayDate(), monday: addDays(startOfWeek(new Date()), nextRangeOffsetValue * 7), schedules: [] },
        })
      })
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))

    loadEmptySchedule(user, rangeOffset)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải lịch trống.'),
            data: { today: getTodayDate(), monday: addDays(startOfWeek(new Date()), rangeOffset * 7), schedules: [] },
          })
        }
      })

    return () => {
      active = false
    }
  }, [user, rangeOffset])

  const empty = useMemo(() => {
    const days = weekDays(state.data.monday)
    const allSchedules = safeArray(state.data.schedules).sort((a, b) => new Date(a.schedule.shift_start || a.schedule.start_time) - new Date(b.schedule.shift_start || b.schedule.start_time))
    const allRows = allSchedules.flatMap((item) => {
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
    })
    const filterOptions = {
      shifts: Array.from(new Set(allRows.map((row) => row.shift).filter(Boolean))).sort(),
      rooms: Array.from(new Set(allRows.map((row) => row.room).filter(Boolean))).sort(),
      statuses: Array.from(new Set(allRows.map((row) => statusLabel(row.slot)).filter(Boolean))).sort(),
    }
    const schedules = allSchedules.filter((item) => {
      const itemRows = allRows.filter((row) => row.schedule === item.schedule)
      const shiftMatched = filters.shift === 'all' || itemRows.some((row) => row.shift === filters.shift) || shiftLabel(item.schedule) === filters.shift
      const roomMatched = filters.room === 'all' || itemRows.some((row) => row.room === filters.room) || roomName(item.schedule) === filters.room
      return shiftMatched && roomMatched
    })
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
    })
      .filter((row) => filters.status === 'all' || statusLabel(row.slot) === filters.status)
      .sort((a, b) => new Date(a.timeValue).getTime() - new Date(b.timeValue).getTime())

    const visibleAvailableCount = filters.status === 'all' ? availableCount : rows.length
    const visibleBookedCount = filters.status === 'all' ? bookedCount : rows.filter((row) => statusLabel(row.slot) === 'Đã đặt').length
    const visibleTotalSlots = filters.status === 'all' ? totalSlots : rows.length
    const visibleEmptyRate = visibleTotalSlots ? Math.round((visibleAvailableCount / visibleTotalSlots) * 100) : 0
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

    const heatmap = HEATMAP_SHIFTS.map((shift) => ({
      ...shift,
      cells: days.map((day) => {
        const key = toDateKey(day)
        const value = rows.filter((row) => {
          const hour = new Date(row.timeValue).getHours()
          return row.dateKey === key && hour >= shift.from && hour < shift.to
        }).length
        return {
          key,
          value,
        }
      }),
    }))

    return {
      days,
      schedules,
      rows,
      totalSlots: visibleTotalSlots,
      bookedCount: visibleBookedCount,
      availableCount: visibleAvailableCount,
      emptyRate: visibleEmptyRate,
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
      filterOptions,
    }
  }, [state.data, filters])

  const totalPages = Math.max(1, Math.ceil(empty.rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = empty.rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = empty.rows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(currentPage * PAGE_SIZE, empty.rows.length)
  const firstPageButton = Math.max(1, Math.min(currentPage - 1, Math.max(1, totalPages - 2)))
  const pageButtons = Array.from(
    { length: Math.min(3, totalPages) },
    (_, index) => firstPageButton + index,
  )

  useEffect(() => {
    setPage(1)
  }, [filters, state.data.monday])

  function applyFilters() {
    setFilters(pendingFilters)
    if (pendingRangeOffset !== rangeOffset) {
      setRangeOffset(pendingRangeOffset)
    }
  }

  function resetFilters() {
    setPendingFilters(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    setPendingRangeOffset(0)
    if (rangeOffset !== 0) {
      setRangeOffset(0)
    }
  }

  async function openScheduleDetail(schedule = empty.schedules[0]?.schedule) {
    const scheduleId = scheduleIdOf(schedule)
    if (!scheduleId) {
      setDetailState({ loading: false, error: 'Backend chưa trả scheduleId thật để mở chi tiết.', schedule: schedule || null })
      return
    }

    setDetailState({ loading: true, error: '', schedule })
    try {
      const detail = await doctorApi.schedules.getDetail(scheduleId)
      setDetailState({ loading: false, error: '', schedule: detail || schedule })
    } catch (error) {
      setDetailState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải chi tiết lịch.'),
        schedule,
      })
    }
  }

  function scrollToHeatmap() {
    heatmapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openAppointmentFlow() {
    navigate('/doctor/appointments')
  }

  function showInviteTodo() {
    setActionNotice('TODO: Chưa có endpoint/flow gửi lời mời khám rõ ràng trong doctor workspace, nên chưa thực hiện gửi thật.')
  }

  function exportEmptySlots() {
    downloadCsv(`lich-trong-${toDateKey(state.data.monday)}.csv`, [
      ['Thoi gian', 'Ngay', 'Ca kham', 'Phong kham', 'Trang thai', 'Tong slot', 'Slot trong', 'Slot da dat', 'Khoa/phong ban'],
      ...empty.rows.map((row) => [
        row.timeText,
        compactDate(row.timeValue || row.dateKey),
        tableShiftLabel(row),
        row.room,
        statusLabel(row.slot),
        empty.schedules.find((item) => item.schedule === row.schedule)?.totalSlots || '',
        empty.schedules.find((item) => item.schedule === row.schedule)?.availableCount || '',
        empty.schedules.find((item) => item.schedule === row.schedule)?.bookedCount || '',
        row.department,
      ]),
    ])
  }

  return (
    <div className="doctor-empty-schedule">
      {state.error ? (
        <div className="doctor-today-error">
          <span>{state.error}</span>
          <button type="button" onClick={() => reload()}>Thử lại</button>
        </div>
      ) : null}
      {actionNotice ? (
        <div className="doctor-today-error is-info">
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice('')}>Đóng</button>
        </div>
      ) : null}

      <section className="doctor-empty-kpis" aria-label="Tổng quan lịch trống">
        <EmptyKpiCard icon="calendar" tone="blue" label="Tổng slot trống" value={state.loading ? '--' : empty.availableCount} hint={state.loading ? 'Đang tải dữ liệu...' : `${empty.emptyRate}% tổng slot`} />
        <EmptyKpiCard icon="clock" tone="blue-soft" label="Khung giờ còn trống" value={state.loading ? '--' : durationText(empty.availableMinutes)} hint={state.loading ? 'Đang tải dữ liệu...' : `${empty.rows.length} khung giờ`} />
        <EmptyKpiCard icon="clipboard" tone="purple" label="Phòng khám khả dụng" value={state.loading ? '--' : `${empty.availableRooms.size} / ${empty.rooms.size || 0}`} hint={state.loading ? 'Đang tải dữ liệu...' : empty.rooms.size ? `${Math.round((empty.availableRooms.size / empty.rooms.size) * 100)}% đang khả dụng` : '--'} />
        <EmptyKpiCard icon="pulse" tone="purple-soft" label="Tỷ lệ trống" value={state.loading ? '--' : `${empty.emptyRate}%`} hint={state.loading ? 'Đang tải dữ liệu...' : 'Theo dữ liệu slot hiện tại'} />
      </section>

      <section className="doctor-empty-filters" aria-label="Bộ lọc lịch trống">
        <button
          className="doctor-empty-filter-field is-date"
          type="button"
          onClick={() => setPendingRangeOffset((current) => nextRangeOffset(current))}
          title="Bấm để chuyển khoảng ngày, sau đó chọn Bộ lọc"
        >
          <DoctorIcon name="calendar" />
          <strong>{weekRangeText(addDays(startOfWeek(new Date()), pendingRangeOffset * 7))}</strong>
          <DoctorIcon name="chevron_down" />
        </button>
        <button
          className="doctor-empty-filter-field"
          type="button"
          onClick={() => setPendingFilters((current) => ({ ...current, shift: cycleFilterValue(current.shift, empty.filterOptions.shifts) }))}
        >
          <span>Ca khám</span>
          <strong>{filterLabel(pendingFilters.shift, 'Tất cả ca')}</strong>
          <DoctorIcon name="chevron_down" />
        </button>
        <button
          className="doctor-empty-filter-field"
          type="button"
          onClick={() => setPendingFilters((current) => ({ ...current, room: cycleFilterValue(current.room, empty.filterOptions.rooms) }))}
        >
          <span>Phòng khám</span>
          <strong>{filterLabel(pendingFilters.room, 'Tất cả phòng')}</strong>
          <DoctorIcon name="chevron_down" />
        </button>
        <button
          className="doctor-empty-filter-field"
          type="button"
          onClick={() => setPendingFilters((current) => ({ ...current, status: cycleFilterValue(current.status, empty.filterOptions.statuses) }))}
        >
          <span>Trạng thái</span>
          <strong>{filterLabel(pendingFilters.status, 'Tất cả')}</strong>
          <DoctorIcon name="chevron_down" />
        </button>
        <button className="doctor-empty-filter-action is-primary" type="button" onClick={applyFilters}>
          <DoctorIcon name="settings" />
          Bộ lọc
        </button>
        <button className="doctor-empty-filter-action" type="button" onClick={resetFilters} disabled={state.loading}>
          Đặt lại
        </button>
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
            ) : pagedRows.length ? pagedRows.map((row, index) => (
              <div className="doctor-empty-row" key={`${scheduleIdOf(row.schedule)}-${row.timeValue}-${row.virtualIndex || index}`}>
                <strong>{row.timeText}</strong>
                <span><b>{compactDate(row.timeValue || row.dateKey)}</b></span>
                <span><b>{tableShiftLabel(row)}</b></span>
                <span><b>{row.room}</b></span>
                <span><i className={`is-${statusTone(row.slot)}`}>{statusLabel(row.slot)}</i></span>
                <span className="doctor-empty-actions"><button type="button" onClick={() => openScheduleDetail(row.schedule)}>{rowActionLabel(row.slot)}</button></span>
              </div>
            )) : (
              <div className="doctor-empty-state">Chưa có slot trống trong khoảng thời gian này.</div>
            )}
          </div>
          <footer>
            <span>Hiển thị {empty.rows.length ? `${pageStart} - ${pageEnd}` : '0'} trong tổng số {empty.rows.length} slot</span>
            <div>
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><DoctorIcon name="chevron_right" /></button>
              {pageButtons.map((pageNumber) => (
                <button
                  type="button"
                  className={pageNumber === currentPage ? 'is-active' : ''}
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              {totalPages > 3 ? <span>...</span> : null}
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><DoctorIcon name="chevron_right" /></button>
            </div>
            <span className="doctor-fixed-page-size">Hiển thị <strong>{PAGE_SIZE}</strong> dòng</span>
          </footer>
        </article>

        <article className="doctor-empty-panel doctor-empty-heatmap" ref={heatmapRef}>
          <header>
            <h2>Lịch trống theo ngày & ca khám <span className="doctor-empty-info-mark">i</span></h2>
          </header>
          <div className="doctor-empty-heatmap__grid" style={{ '--empty-day-count': empty.days.length }}>
            <span>Ca khám</span>
            {empty.days.map((day) => <span key={toDateKey(day)}><b>{VI_WEEKDAYS[day.getDay()]}</b><small>{displayDate(day)}</small></span>)}
            {empty.heatmap.map((row) => (
              <div className="doctor-empty-heatmap__row" key={row.label}>
                <strong>{row.label} ({row.time})</strong>
                {row.cells.map((cell) => (
                  <em className={`is-${heatTone(cell.value, empty.maxDay)}`} key={`${row.label}-${cell.key}`}>{cell.value}</em>
                ))}
              </div>
            ))}
          </div>
          <footer>
            <div>
              <span><i className="is-high" /> Nhiều (≥10)</span>
              <span><i className="is-medium" /> Trung bình (5 - 9)</span>
              <span><i className="is-low" /> Ít (1 - 4)</span>
              <span><i className="is-none" /> Hết (0)</span>
            </div>
            <button type="button" onClick={scrollToHeatmap}>Xem lịch theo biểu đồ <DoctorIcon name="chevron_right" /></button>
          </footer>
        </article>

        <aside className="doctor-empty-side">
          <article className="doctor-empty-panel doctor-empty-summary">
            <header>
              <h2>Tổng quan lịch trống</h2>
              <button type="button" onClick={() => openScheduleDetail()}>Xem chi tiết</button>
            </header>
            <div className="doctor-empty-summary__top">
              <EmptyDonut percent={empty.emptyRate} value={`${empty.emptyRate}%`} label="Tỷ lệ trống" />
              <dl>
                <div><dt><i className="is-green" /> Slot trống</dt><dd>{empty.availableCount}</dd></div>
                <div><dt><i className="is-blue" /> Đã đặt</dt><dd>{empty.bookedCount}</dd></div>
                <div><dt><i className="is-orange" /> Giữ tạm</dt><dd>{empty.rows.filter((row) => statusTone(row.slot) === 'amber').length}</dd></div>
                <div><dt><i className="is-red" /> Hết slot</dt><dd>{Math.max(0, empty.totalSlots - empty.availableCount - empty.bookedCount)}</dd></div>
                <div><dt><i className="is-slate" /> Tổng slot</dt><dd>{empty.totalSlots}</dd></div>
              </dl>
            </div>
            <div className="doctor-empty-summary__list">
              <div><span><DoctorIcon name="clock" />Tổng khung giờ trống</span><strong>{durationText(empty.availableMinutes)}</strong></div>
              <div><span><DoctorIcon name="refresh" />Slot trống trung bình mỗi ngày</span><strong>{Math.round(empty.availableCount / Math.max(1, empty.days.length))} slot</strong></div>
              <div><span><DoctorIcon name="patients" />Phòng khám có slot trống</span><strong>{empty.availableRooms.size} / {empty.rooms.size || 0}</strong></div>
              <div><span><DoctorIcon name="pulse" />Tỷ lệ trống trung bình</span><strong>{empty.emptyRate}%</strong></div>
            </div>
          </article>

          <article className="doctor-empty-panel doctor-empty-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={openAppointmentFlow}>
              <span><DoctorIcon name="calendar" /></span>
              <b>Mở lịch hẹn mới</b>
              <small>Tạo lịch hẹn cho bệnh nhân</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={showInviteTodo}>
              <span><DoctorIcon name="message" /></span>
              <b>Gửi lời mời khám</b>
              <small>Gửi lời mời đến bệnh nhân tiềm năng</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={() => navigate('/doctor/schedules/week')}>
              <span><DoctorIcon name="calendar" /></span>
              <b>Xem lịch làm việc</b>
              <small>Xem toàn bộ lịch theo tuần/tháng</small>
              <DoctorIcon name="chevron_right" />
            </button>
            <button type="button" onClick={exportEmptySlots}>
              <span><DoctorIcon name="note" /></span>
              <b>Xuất báo cáo</b>
              <small>Xuất báo cáo slot trống & công suất</small>
              <DoctorIcon name="chevron_right" />
            </button>
          </article>
        </aside>
      </section>

      <article className="doctor-empty-panel doctor-empty-heatmap">
        <header>
          <h2>Lịch trống theo ngày & ca khám <span className="doctor-empty-info-mark">i</span></h2>
        </header>
        <div className="doctor-empty-heatmap__grid" style={{ '--empty-day-count': empty.days.length }}>
          <span>Ca khám</span>
          {empty.days.map((day) => <span key={toDateKey(day)}><b>{VI_WEEKDAYS[day.getDay()]}</b><small>{displayDate(day)}</small></span>)}
          {empty.heatmap.map((row) => (
            <div className="doctor-empty-heatmap__row" key={row.label}>
              <strong>{row.label} ({row.time})</strong>
              {row.cells.map((cell) => (
                <em className={`is-${heatTone(cell.value, empty.maxDay)}`} key={`${row.label}-${cell.key}`}>{cell.value}</em>
              ))}
            </div>
          ))}
        </div>
        <footer>
          <div>
            <span><i className="is-high" /> Nhiều (≥10)</span>
            <span><i className="is-medium" /> Trung bình (5 - 9)</span>
            <span><i className="is-low" /> Ít (1 - 4)</span>
            <span><i className="is-none" /> Hết (0)</span>
          </div>
          <button type="button" onClick={scrollToHeatmap}>Xem lịch theo biểu đồ <DoctorIcon name="chevron_right" /></button>
        </footer>
      </article>

      {detailState.loading || detailState.error || detailState.schedule ? (
        <div className="doctor-today-modal-backdrop" role="presentation" onClick={() => setDetailState({ loading: false, error: '', schedule: null })}>
          <section
            className="doctor-today-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết lịch trống"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2>Chi tiết lịch trống</h2>
                <p>Dữ liệu lấy từ lịch làm việc thật của bác sĩ và API chi tiết lịch khi có scheduleId.</p>
              </div>
              <button type="button" onClick={() => setDetailState({ loading: false, error: '', schedule: null })} aria-label="Đóng">×</button>
            </header>

            <div className="doctor-today-modal-schedules">
              {detailState.loading ? (
                <div className="doctor-empty-state">Đang tải chi tiết lịch...</div>
              ) : detailState.error ? (
                <div className="doctor-empty-state">{detailState.error}</div>
              ) : (
                <button type="button" onClick={() => scheduleIdOf(detailState.schedule) && navigate(`/doctor/schedules/${encodeURIComponent(scheduleIdOf(detailState.schedule))}`)}>
                  <b>{shiftLabel(detailState.schedule)}</b>
                  <span>{formatTime(detailState.schedule?.shift_start || detailState.schedule?.start_time)} - {formatTime(detailState.schedule?.shift_end || detailState.schedule?.end_time)}</span>
                  <small>{roomName(detailState.schedule)}</small>
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
