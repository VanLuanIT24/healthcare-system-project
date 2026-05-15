import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctorApi, getDoctorId } from './doctorApi'
import { getInitials, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { DoctorIcon } from './DoctorShell'
import { getApiErrorMessage } from '../utils/api'

function scheduleIdOf(schedule = {}) {
  return schedule.doctor_schedule_id || schedule.schedule_id || schedule.id || schedule._id || ''
}

function slotIdOf(slot = {}) {
  return slot.slot_id || slot.schedule_slot_id || slot.appointment_slot_id || slot.id || slot._id || ''
}

function appointmentIdOf(appointment = {}) {
  return appointment.appointment_id || appointment.id || appointment._id || appointment.appointment?.appointment_id || appointment.appointment?.id || ''
}

function appointmentScheduleIdOf(appointment = {}) {
  return appointment.doctor_schedule_id || appointment.schedule_id || appointment.schedule?.doctor_schedule_id || appointment.schedule?.id || ''
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

function addMinutes(value, minutes) {
  if (!value || !minutes) return ''
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    const [hour, minute] = value.split(':').map(Number)
    const total = hour * 60 + minute + minutes
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  parsed.setMinutes(parsed.getMinutes() + minutes)
  return parsed
}

function minutesBetween(start, end) {
  const from = getTimeValue(start)
  const to = getTimeValue(end)
  return to > from ? to - from : 0
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
  return schedule.department_name || schedule.department?.department_name || schedule.specialty || 'Khoa Khám bệnh'
}

function doctorDisplayName(user = {}) {
  return user.fullName || user.full_name || user.name || user.username || user.email || 'Bác sĩ'
}

function doctorDepartment(user = {}, schedule = {}) {
  return (
    schedule.department_name ||
    user.department_name ||
    user.department?.department_name ||
    user.profile?.department_name ||
    'Khoa Khám bệnh'
  )
}

function shiftLabel(schedule = {}) {
  const raw = String(schedule.shift_type || schedule.type || schedule.name || '').toLowerCase()
  if (raw.includes('morning') || raw.includes('sáng')) return 'Ca sáng'
  if (raw.includes('afternoon') || raw.includes('chiều')) return 'Ca chiều'
  if (raw.includes('night') || raw.includes('tối')) return 'Ca tối'
  const hour = Math.floor(getTimeValue(schedule.shift_start || schedule.start_time) / 60)
  if (hour && hour < 12) return 'Ca sáng'
  if (hour && hour < 18) return 'Ca chiều'
  return 'Ca khám'
}

function scheduleState(schedule = {}) {
  const raw = String(schedule.status || '').toLowerCase()
  const now = new Date()
  const today = toDateKey(now)
  const scheduleDate = toDateKey(schedule.shift_start || schedule.start_time || schedule.date)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const start = getTimeValue(schedule.shift_start || schedule.start_time)
  const end = getTimeValue(schedule.shift_end || schedule.end_time)

  if (raw.includes('cancel')) return { label: 'Đã hủy', tone: 'slate', bucket: 'notStarted' }
  if (scheduleDate && scheduleDate !== today) return { label: 'Đã lên lịch', tone: 'blue', bucket: 'upcoming' }
  if (!start || !end) return { label: 'Đã lên lịch', tone: 'blue', bucket: 'upcoming' }
  if (currentMinutes < start) return { label: 'Sắp diễn ra', tone: 'blue', bucket: 'upcoming' }
  if (currentMinutes > end) return { label: 'Đã hoàn thành', tone: 'green', bucket: 'completed' }
  return { label: 'Đang diễn ra', tone: 'green', bucket: 'active' }
}

function slotTime(slot = {}) {
  return slot.slot_time || slot.start_time || slot.appointment_time || slot.time || slot.start || ''
}

function slotEndTime(slot = {}) {
  const direct = slot.end_time || slot.slot_end || slot.end || ''
  if (direct) return direct
  const duration = Number(slot.duration_minutes || slot.duration || slot.minutes)
  return Number.isFinite(duration) && duration > 0 ? addMinutes(slotTime(slot), duration) : ''
}

function slotDuration(slot = {}) {
  const direct = Number(slot.duration_minutes || slot.duration || slot.minutes)
  if (Number.isFinite(direct) && direct > 0) return `${direct} phút`
  const minutes = minutesBetween(slotTime(slot), slotEndTime(slot))
  return minutes ? `${minutes} phút` : '15 phút'
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

function slotReason(slot = {}) {
  return slot.reason || slot.visit_reason || slot.note || slot.chief_complaint || slot.appointment_type || slot.appointment?.reason || slot.appointment?.note || 'Khám bệnh'
}

function slotStatus(slot = {}) {
  const raw = String(slot.status || '').toLowerCase()
  if (raw === 'completed') return { label: 'Đã hoàn thành', tone: 'green', bucket: 'completed' }
  if (['checked_in', 'arrived', 'in_consultation'].includes(raw)) return { label: 'Đang diễn ra', tone: 'green', bucket: 'active' }
  if (['in_progress', 'serving'].includes(raw)) return { label: 'Đang diễn ra', tone: 'green', bucket: 'active' }
  if (raw === 'held') return { label: 'Đang giữ', tone: 'amber', bucket: 'upcoming' }
  if (['booked', 'confirmed'].includes(raw) || slot.is_booked) return { label: raw === 'confirmed' ? 'Đã xác nhận' : 'Đã đặt', tone: 'green', bucket: 'upcoming' }
  if (raw === 'available' || slot.is_available) return { label: 'Chưa bắt đầu', tone: 'slate', bucket: 'notStarted' }
  if (raw === 'blocked') return { label: 'Đã chặn', tone: 'slate', bucket: 'notStarted' }
  if (['cancelled', 'canceled'].includes(raw)) return { label: 'Đã hủy', tone: 'slate', bucket: 'notStarted' }
  if (raw === 'no_show') return { label: 'Không đến', tone: 'slate', bucket: 'notStarted' }
  return { label: raw ? raw.replace(/_/g, ' ') : 'Đã đặt', tone: 'blue' }
}

function isBookedSlot(slot = {}) {
  const raw = String(slot.status || '').toLowerCase()
  return Boolean(slot.is_booked || slot.patient || slot.patient_name || ['booked', 'confirmed', 'checked_in', 'arrived', 'in_progress', 'serving', 'waiting', 'pending'].includes(raw))
}

function isAvailableSlot(slot = {}) {
  const raw = String(slot.status || '').toLowerCase()
  return Boolean(slot.is_available || raw === 'available')
}

function timedState(schedule = {}, startValue, endValue) {
  const now = new Date()
  const scheduleDate = toDateKey(schedule.shift_start || schedule.start_time || schedule.date)
  const today = toDateKey(now)
  const start = getTimeValue(startValue)
  const end = getTimeValue(endValue)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  if (scheduleDate && scheduleDate !== today) return { label: 'Sắp diễn ra', tone: 'blue', bucket: 'upcoming' }
  if (!start || !end) return scheduleState(schedule)
  if (currentMinutes < start) return { label: 'Chưa bắt đầu', tone: 'slate', bucket: 'notStarted' }
  if (currentMinutes > end) return { label: 'Đã hoàn thành', tone: 'green', bucket: 'completed' }
  return { label: 'Đang diễn ra', tone: 'green', bucket: 'active' }
}

function slotRowState(schedule = {}, slot = {}) {
  const status = slotStatus(slot)
  if (status.bucket) return status
  return timedState(schedule, slotTime(slot), slotEndTime(slot) || addMinutes(slotTime(slot), 15))
}

function slotUtilization(slot = {}, scheduleUtilization = 0) {
  const direct = normalizeUtilization(
    slot.utilization_rate ?? slot.utilization ?? slot.fill_rate ?? slot.occupancy_rate,
    Number.NaN,
  )
  if (Number.isFinite(direct)) return Math.max(0, Math.min(100, Math.round(direct)))
  if (isBookedSlot(slot)) return 100
  if (isAvailableSlot(slot)) return 0
  return scheduleUtilization
}

function slotTimeKey(value) {
  const parsed = value ? new Date(value) : null
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString()
  return String(value || '')
}

function mergeSlotWithAppointment(slot, appointment) {
  if (!appointment) return slot
  return {
    ...slot,
    ...appointment,
    appointment,
    slot_time: slot.slot_time || appointment.appointment_time,
    slot_end: slot.slot_end || appointment.slot_end || appointment.end_time,
    status: appointment.status || slot.status,
    is_booked: true,
    is_available: false,
  }
}

function normalizeUtilization(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return numeric > 0 && numeric <= 1 ? numeric * 100 : numeric
}

function normalizeBundle(schedule, detail) {
  const scheduleDetail = detail.detail?.schedule || detail.detail || {}
  const mergedSchedule = {
    ...schedule,
    ...(scheduleDetail && typeof scheduleDetail === 'object' ? scheduleDetail : {}),
    doctor_schedule_id: scheduleIdOf(scheduleDetail) || scheduleIdOf(schedule),
  }
  const summary = detail.summary || {}
  const summaryStats = summary.slots_summary || summary.utilization || mergedSchedule.slots_summary || {}
  const allSlots = safeArray(detail.allSlots)
  const appointmentsToday = safeArray(detail.appointmentsToday)
  const bookedSlots = safeArray(detail.bookedSlots).length
    ? safeArray(detail.bookedSlots).map((slot) => {
        const slotAppointmentId = appointmentIdOf(slot)
        const slotKey = slotTimeKey(slotTime(slot))
        const match = appointmentsToday.find((appointment) => (
          (slotAppointmentId && appointmentIdOf(appointment) === slotAppointmentId) ||
          (slotKey && slotTimeKey(appointment.appointment_time || appointment.scheduled_at) === slotKey)
        ))
        return mergeSlotWithAppointment(slot, match)
      })
    : allSlots.filter((slot) => slot.is_booked || slot.patient || slot.patient_name)
  const availableSlots = safeArray(detail.availableSlots).length
    ? safeArray(detail.availableSlots)
    : allSlots.filter((slot) => slot.is_available || String(slot.status || '').toLowerCase() === 'available')
  const totalSlots = numberFrom(summaryStats, ['total_slots', 'totalSlots', 'slots_count', 'slot_count'], numberFrom(summary, ['total_slots', 'totalSlots', 'slots_count', 'slot_count'], allSlots.length || bookedSlots.length + availableSlots.length))
  const bookedCount = numberFrom(summaryStats, ['booked_slots', 'bookedSlots', 'booked_count'], numberFrom(summary, ['booked_slots', 'bookedSlots', 'booked_count'], bookedSlots.length))
  const availableCount = numberFrom(summaryStats, ['available_slots', 'availableSlots', 'empty_slots', 'available_count'], numberFrom(summary, ['available_slots', 'availableSlots', 'empty_slots', 'available_count'], Math.max(totalSlots - bookedCount, availableSlots.length)))
  const utilizationPayload = detail.utilization || {}
  const rawUtilization = numberFrom(utilizationPayload, ['utilization_rate', 'utilization', 'rate', 'percentage'], numberFrom(summaryStats, ['utilization_rate', 'utilization', 'rate', 'percentage'], totalSlots ? (bookedCount / totalSlots) * 100 : 0))
  const utilization = Math.round(normalizeUtilization(rawUtilization, totalSlots ? (bookedCount / totalSlots) * 100 : 0))
  const bookedByTime = new Map(bookedSlots.map((slot) => [slotTimeKey(slotTime(slot)), slot]))
  const timelineSlots = allSlots.length
    ? allSlots.map((slot) => mergeSlotWithAppointment(slot, bookedByTime.get(slotTimeKey(slotTime(slot)))))
    : [...bookedSlots, ...availableSlots].reduce((items, slot) => {
        const slotId = slotIdOf(slot) || `${slotTime(slot)}-${slotEndTime(slot)}-${slotPatient(slot)}`
        if (items.some((item) => (slotIdOf(item) || `${slotTime(item)}-${slotEndTime(item)}-${slotPatient(item)}`) === slotId)) {
          return items
        }
        return [...items, slot]
      }, [])

  return {
    schedule: mergedSchedule,
    summary,
    detail: detail.detail || null,
    activity: safeArray(detail.activity),
    allSlots,
    bookedSlots,
    availableSlots,
    totalSlots,
    bookedCount,
    availableCount,
    timelineSlots,
    utilization: Math.max(0, Math.min(100, utilization)),
    state: scheduleState(mergedSchedule),
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

  const appointmentsPromise = doctorApi.appointments.listToday({
    date: today,
    limit: 200,
    ...(doctorId ? { doctor_id: doctorId } : {}),
  })
  const todaySchedules = await doctorApi.schedules.myToday({ date: today })
  const weekPromise = doctorApi.schedules.myWeek({ date_from: toDateKey(monday), date_to: toDateKey(sunday), limit: 100 })
  const calendarPromise = doctorId
    ? doctorApi.schedules.getCalendar(doctorId, { date_from: today, date_to: today, limit: 100 })
    : Promise.resolve([])

  const calendarSchedules = await settledValue(calendarPromise, [])
  const appointmentsToday = await settledValue(appointmentsPromise, [])
  const baseSchedules = safeArray(todaySchedules).length
    ? safeArray(todaySchedules)
    : safeArray(calendarSchedules).filter((schedule) => toDateKey(schedule.shift_start || schedule.start_time || schedule.date) === today)

  const schedules = await Promise.all(
    baseSchedules.map(async (schedule) => {
      const scheduleId = scheduleIdOf(schedule)
      const [scheduleDetail, summary, utilization, activity, allSlots, availableSlots, bookedSlots, bookedAlias] = await Promise.all([
        scheduleId ? settledValue(doctorApi.schedules.getDetail(scheduleId), null) : Promise.resolve(null),
        scheduleId ? settledValue(doctorApi.schedules.getSummary(scheduleId), null) : Promise.resolve(null),
        scheduleId ? settledValue(doctorApi.schedules.getUtilization(scheduleId), null) : Promise.resolve(null),
        scheduleId ? settledValue(doctorApi.schedules.getActivity(scheduleId), []) : Promise.resolve([]),
        scheduleId ? settledValue(doctorApi.schedules.getSlots(scheduleId), []) : Promise.resolve([]),
        scheduleId ? settledValue(doctorApi.schedules.getAvailableSlots(scheduleId), []) : Promise.resolve([]),
        scheduleId ? settledValue(doctorApi.schedules.getBookedSlots(scheduleId), []) : Promise.resolve([]),
        scheduleId ? settledValue(doctorApi.schedules.getBookedSlotsAlias(scheduleId), []) : Promise.resolve([]),
      ])

      return normalizeBundle(schedule, {
        detail: scheduleDetail,
        summary,
        utilization,
        activity,
        allSlots,
        availableSlots,
        bookedSlots: safeArray(bookedSlots).length ? bookedSlots : bookedAlias,
        appointmentsToday: safeArray(appointmentsToday).filter((appointment) => {
          const appointmentScheduleId = appointmentScheduleIdOf(appointment)
          return !appointmentScheduleId || String(appointmentScheduleId) === String(scheduleId)
        }),
      })
    }),
  )

  return {
    today,
    schedules,
    weekSchedules: await settledValue(weekPromise, []),
  }
}

function KpiCard({ icon, tone, label, value, hint, accent }) {
  return (
    <article className="doctor-today-kpi">
      <span className={`doctor-today-kpi__icon is-${tone}`}>
        <DoctorIcon name={icon} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span className={accent ? 'is-accent' : ''}>{hint}</span>
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

function minuteToClock(minutes) {
  const normalized = Math.max(0, minutes)
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

function makeScheduleRow(item, scheduleIndex, previousEnd) {
  const scheduleId = scheduleIdOf(item.schedule)
  const start = item.schedule.shift_start || item.schedule.start_time
  const end = item.schedule.shift_end || item.schedule.end_time
  const rows = []

  if (previousEnd) {
    const breakMinutes = minutesBetween(previousEnd, start)
    if (breakMinutes >= 30) {
      rows.push({
        type: 'break',
        id: `break-schedule-${scheduleIndex}`,
        label: `Nghỉ giữa ca ${formatClock(previousEnd)} - ${formatClock(start)}`,
      })
    }
  }

  rows.push({
    type: 'schedule',
    id: scheduleId || `${start}-${scheduleIndex}`,
    scheduleId,
    start,
    end,
    shift: shiftLabel(item.schedule),
    room: roomName(item.schedule),
    state: item.state,
    utilization: item.utilization,
  })

  return rows
}

function buildScheduleRows(schedules) {
  const rows = []
  let previousEnd = ''
  const shiftCounters = {}

  schedules.forEach((item, scheduleIndex) => {
    const slots = safeArray(item.timelineSlots).sort((a, b) => getTimeValue(slotTime(a)) - getTimeValue(slotTime(b)))

    if (!slots.length) {
      const start = item.schedule.shift_start || item.schedule.start_time
      const end = item.schedule.shift_end || item.schedule.end_time
      rows.push(...makeScheduleRow(item, scheduleIndex, previousEnd))
      previousEnd = end
      return
    }

    const scheduleStart = item.schedule.shift_start || item.schedule.start_time || slotTime(slots[0])
    const scheduleEnd = item.schedule.shift_end || item.schedule.end_time || slotEndTime(slots[slots.length - 1])
    const scheduleStartMinute = getTimeValue(scheduleStart)
    const scheduleEndMinute = getTimeValue(scheduleEnd)
    const blockMap = new Map()

    slots.forEach((slot) => {
      const startMinute = getTimeValue(slotTime(slot))
      const bucket = scheduleStartMinute ? Math.max(0, Math.floor((startMinute - scheduleStartMinute) / 60)) : Math.floor(startMinute / 60)
      if (!blockMap.has(bucket)) {
        const blockStartMinute = scheduleStartMinute ? scheduleStartMinute + bucket * 60 : bucket * 60
        blockMap.set(bucket, {
          slots: [],
          startMinute: blockStartMinute,
          endMinute: scheduleEndMinute ? Math.min(blockStartMinute + 60, scheduleEndMinute) : blockStartMinute + 60,
        })
      }
      blockMap.get(bucket).slots.push(slot)
    })

    const blocks = [...blockMap.values()].sort((a, b) => a.startMinute - b.startMinute)
    if (!blocks.length) {
      rows.push(...makeScheduleRow(item, scheduleIndex, previousEnd))
      previousEnd = scheduleEnd
      return
    }

    blocks.forEach((block, blockIndex) => {
      const start = minuteToClock(block.startMinute)
      const end = minuteToClock(block.endMinute)
      if (previousEnd) {
        const breakMinutes = minutesBetween(previousEnd, start)
      if (breakMinutes >= 30) {
        rows.push({
          type: 'break',
            id: `break-${scheduleIndex}-${blockIndex}`,
            label: `Nghỉ giữa ca ${formatClock(previousEnd)} - ${formatClock(start)}`,
        })
      }
    }

      const baseShift = shiftLabel(item.schedule)
      const scheduleId = scheduleIdOf(item.schedule)
      shiftCounters[baseShift] = (shiftCounters[baseShift] || 0) + 1
      const bookedInBlock = block.slots.filter(isBookedSlot).length
      const blockUtilization = block.slots.length ? Math.round((bookedInBlock / block.slots.length) * 100) : item.utilization
      rows.push({
        type: 'block',
        id: `${scheduleId || scheduleIndex}-${start}-${blockIndex}`,
        scheduleId,
        start,
        end,
        shift: `${baseShift} ${shiftCounters[baseShift]}`,
        room: roomName(item.schedule, block.slots[0]),
        state: timedState(item.schedule, start, end),
        utilization: Math.max(0, Math.min(100, blockUtilization)),
      })
      previousEnd = end
    })
  })
  return rows
}

export function DoctorTodayScheduleScreen({ user }) {
  const navigate = useNavigate()
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
    const schedules = safeArray(state.data.schedules).sort((a, b) => getTimeValue(a.schedule.shift_start || a.schedule.start_time) - getTimeValue(b.schedule.shift_start || b.schedule.start_time))
    const rows = buildScheduleRows(schedules)
    const totalSlots = schedules.reduce((sum, item) => sum + item.totalSlots, 0)
    const bookedCount = schedules.reduce((sum, item) => sum + item.bookedCount, 0)
    const availableCount = schedules.reduce((sum, item) => sum + item.availableCount, 0)
    const totalMinutes = schedules.reduce((sum, item) => sum + minutesBetween(item.schedule.shift_start || item.schedule.start_time, item.schedule.shift_end || item.schedule.end_time), 0)
    const utilization = totalSlots ? Math.round((bookedCount / totalSlots) * 100) : 0
    const first = schedules[0]?.schedule || null
    const last = schedules[schedules.length - 1]?.schedule || null
    const bookedSlots = schedules.flatMap((item) => item.bookedSlots.map((slot) => ({ ...slot, schedule: item.schedule })))
    const availableSlots = schedules.flatMap((item) => item.availableSlots.map((slot) => ({ ...slot, schedule: item.schedule })))
    const statusSource = schedules.flatMap((item) =>
      safeArray(item.timelineSlots).map((slot) => ({ slot, schedule: item.schedule })),
    )
    const statusCounts = (statusSource.length ? statusSource : rows.map((row) => ({ row }))).reduce(
      (counts, item) => {
        const bucket = item.slot ? slotRowState(item.schedule, item.slot).bucket : item.row?.state?.bucket
        if (bucket) {
          counts[bucket] += 1
        }
        return counts
      },
      { completed: 0, active: 0, upcoming: 0, notStarted: 0 },
    )
    const ranges = schedules
      .map((item) => `${formatClock(item.schedule.shift_start || item.schedule.start_time)} - ${formatClock(item.schedule.shift_end || item.schedule.end_time)}`)
      .filter((value) => !value.includes('--'))

    return {
      schedules,
      rows,
      totalSlots,
      bookedCount,
      availableCount,
      totalMinutes,
      utilization,
      first,
      last,
      statusCounts,
      timeRange: ranges.length ? ranges.join('  •  ') : '--',
      room: first ? roomName(first) : '--',
      department: first ? departmentName(first) : doctorDepartment(user),
      bookedSlots: bookedSlots.sort((a, b) => getTimeValue(slotTime(a)) - getTimeValue(slotTime(b))),
      availableSlots: availableSlots.sort((a, b) => getTimeValue(slotTime(a)) - getTimeValue(slotTime(b))),
    }
  }, [state.data, user])

  const doctorName = doctorDisplayName(user)
  const primaryScheduleId = scheduleIdOf(dashboard.first || {})

  function openScheduleDetail(scheduleId = primaryScheduleId) {
    if (!scheduleId) return
    navigate(`/doctor/schedules/${encodeURIComponent(scheduleId)}`)
  }

  return (
    <div className="doctor-today-schedule">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

      <section className="doctor-today-kpis" aria-label="Tổng quan lịch hôm nay">
        <KpiCard icon="calendar" tone="blue" label="Ca trực hôm nay" value={dashboard.schedules.length} hint={dashboard.timeRange} />
        <KpiCard icon="patients" tone="green" label="Slot đã đặt" value={dashboard.bookedCount} hint={`${dashboard.totalSlots} tổng slot`} accent />
        <KpiCard icon="doctor" tone="orange" label="Slot còn trống" value={dashboard.availableCount} hint={dashboard.totalSlots ? `${Math.max(0, 100 - dashboard.utilization)}% tổng số slot` : '--'} />
        <KpiCard icon="clock" tone="purple" label="Hiệu suất lịch" value={`${dashboard.utilization}%`} hint="Theo dữ liệu slot hiện tại" accent />
      </section>

      <section className="doctor-today-main">
        <article className="doctor-today-panel doctor-today-timeline">
          <header>
            <h2>Lịch làm việc trong ngày</h2>
          </header>

          <div className="doctor-today-table">
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
              ) : dashboard.rows.length ? (
                dashboard.rows.map((row) => {
                  if (row.type === 'break') {
                    return (
                      <div className="doctor-today-break-row" key={row.id}>
                        <span />
                        <strong>{row.label}</strong>
                        <span />
                      </div>
                    )
                  }

                  return (
                    <div className="doctor-today-row" key={row.id}>
                      <strong>{formatClock(row.start)} - {formatClock(row.end)}</strong>
                      <span>{row.shift}</span>
                      <span>{row.room}</span>
                      <span className={`doctor-today-badge is-${row.state.tone}`}>{row.state.label}</span>
                      <span className="doctor-today-progress-cell">
                        <span className="doctor-today-progress"><i style={{ width: `${row.utilization}%` }} /></span>
                        <b>{row.utilization}%</b>
                        <button
                          className="doctor-today-row-chevron"
                          type="button"
                          aria-label="Xem chi tiết lịch"
                          onClick={() => openScheduleDetail(row.scheduleId)}
                          disabled={!row.scheduleId}
                        >
                          ›
                        </button>
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="doctor-today-empty">Chưa có lịch làm việc trong hôm nay.</div>
              )}
            </div>
          </div>

          <button
            className="doctor-today-link-button"
            type="button"
            onClick={() => openScheduleDetail()}
            disabled={!primaryScheduleId}
          >
            Xem chi tiết lịch trong ngày
            <DoctorIcon name="chevron_right" />
          </button>
        </article>

        <aside className="doctor-today-panel doctor-today-summary">
          <header>
            <h2>Tổng quan lịch hôm nay</h2>
          </header>

          <div className="doctor-today-summary__body">
            <Donut percent={dashboard.utilization} />
            <dl>
              <div><dt><i className="is-teal" />Tổng số slot</dt><dd>{dashboard.totalSlots}</dd></div>
              <div><dt><i className="is-green" />Slot đã đặt</dt><dd>{dashboard.bookedCount}</dd></div>
              <div><dt><i className="is-orange" />Slot còn trống</dt><dd>{dashboard.availableCount}</dd></div>
              <div><dt><i className="is-emerald" />Đã hoàn thành</dt><dd>{dashboard.statusCounts.completed}</dd></div>
              <div><dt><i className="is-blue" />Đang diễn ra</dt><dd>{dashboard.statusCounts.active}</dd></div>
              <div><dt><i className="is-sky" />Sắp diễn ra</dt><dd>{dashboard.statusCounts.upcoming}</dd></div>
              <div><dt><i className="is-slate" />Chưa bắt đầu</dt><dd>{dashboard.statusCounts.notStarted}</dd></div>
            </dl>
          </div>

          <div className="doctor-today-summary__list">
            <div><DoctorIcon name="clock" /><span>Thời gian làm việc</span><strong>{dashboard.timeRange}</strong></div>
            <div><DoctorIcon name="pin" /><span>Phòng khám</span><strong>{dashboard.room}</strong></div>
            <div><DoctorIcon name="patients" /><span>Bác sĩ phụ trách</span><strong>{doctorName}</strong></div>
          </div>
        </aside>
      </section>

      <section className="doctor-today-bottom">
        <article className="doctor-today-panel doctor-today-slots">
          <header>
            <h2>Slot đã đặt ({dashboard.bookedCount})</h2>
            <button type="button">Xem tất cả</button>
          </header>
          <div className="doctor-today-slot-head">
            <span>Thời gian</span>
            <span>Bệnh nhân</span>
            <span>Lý do khám</span>
            <span>Trạng thái</span>
            <span />
          </div>
          <div className="doctor-today-slot-list">
            {dashboard.bookedSlots.slice(0, 3).map((slot, index) => (
              <div className="doctor-today-slot-row" key={`${slotTime(slot)}-${index}`}>
                <strong>{formatClock(slotTime(slot))}</strong>
                <span className="doctor-today-patient-cell">
                  <i>{getInitials(slotPatient(slot)) || 'BN'}</i>
                  <span><b>{slotPatient(slot)}</b><small>{slotPatientMeta(slot)}</small></span>
                </span>
                <small>{slotReason(slot)}</small>
                <SlotBadge slot={slot} />
                <button className="doctor-today-more-button" type="button" aria-label="Tùy chọn slot">
                  <DoctorIcon name="more" />
                </button>
              </div>
            ))}
            {!dashboard.bookedSlots.length ? <div className="doctor-today-empty is-small">Chưa có slot đã đặt.</div> : null}
          </div>
          <button className="doctor-today-link-button" type="button">Xem tất cả slot đã đặt <DoctorIcon name="chevron_right" /></button>
        </article>

        <article className="doctor-today-panel doctor-today-slots">
          <header>
            <h2>Slot còn trống ({dashboard.availableCount})</h2>
            <button type="button">Xem tất cả</button>
          </header>
          <div className="doctor-today-slot-head is-available">
            <span>Thời gian</span>
            <span>Phòng khám</span>
            <span>Thời lượng</span>
            <span>Hành động</span>
          </div>
          <div className="doctor-today-slot-list">
            {dashboard.availableSlots.slice(0, 3).map((slot, index) => (
              <div className="doctor-today-slot-row is-available" key={`${slotTime(slot)}-${index}`}>
                <strong>{formatClock(slotTime(slot))}</strong>
                <span>{roomName(slot.schedule, slot)}</span>
                <small>{slotDuration(slot)}</small>
                <button type="button">Đặt lịch</button>
              </div>
            ))}
            {!dashboard.availableSlots.length ? <div className="doctor-today-empty is-small">Không còn slot trống.</div> : null}
          </div>
          <button className="doctor-today-link-button" type="button">Xem tất cả slot còn trống <DoctorIcon name="chevron_right" /></button>
        </article>

        <aside className="doctor-today-panel doctor-today-actions">
          <h2>Thao tác nhanh</h2>
          <button type="button" onClick={() => openScheduleDetail()} disabled={!primaryScheduleId}>
            <span className="is-blue"><DoctorIcon name="calendar" /></span>
            <b>Xem chi tiết lịch</b>
            <small>Xem chi tiết từng ca và slot</small>
            <DoctorIcon name="chevron_right" />
          </button>
          <button type="button" onClick={reload} disabled={state.loading}>
            <span className="is-green"><DoctorIcon name="refresh" /></span>
            <b>Làm mới dữ liệu</b>
            <small>Cập nhật trạng thái mới nhất</small>
            <DoctorIcon name="chevron_right" />
          </button>
          <button type="button">
            <span className="is-purple"><DoctorIcon name="note" /></span>
            <b>Xuất lịch</b>
            <small>Xuất lịch làm việc hôm nay</small>
            <DoctorIcon name="chevron_right" />
          </button>
        </aside>
      </section>
    </div>
  )
}
