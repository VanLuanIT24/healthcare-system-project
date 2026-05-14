import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../utils/api'
import { useToast } from './toast/ToastProvider'
import { guardDoctorAction, handleDoctorApiError, notifyDoctorSuccess, showDoctorToast } from './doctorFeedback'
import { EncounterTable, QueueBoardTable } from './DoctorTables'
import {
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PatientSummaryCard,
  SectionCard,
  StatusBadge,
  DoctorIcon,
  SurfaceHint,
} from './DoctorShell'
import { formatDate, formatTime, getInitials, parseDateValue, safeArray, toLocalDateKey } from './doctorData'
import { doctorApi, getDoctorCapabilities, getDoctorId } from './doctorApi'
import {
  buildScheduleBuckets,
  computeQueueBoard,
  getTodayDate,
  useAsyncResource,
  usePatientMap,
  usePollingReload,
} from './DoctorHooks'

const emptyQueueBoard = {
  waiting: [],
  called: [],
  in_service: [],
  completed: [],
}

function getRangeParams(scope, dateValue, status) {
  const params = {}

  if (scope === 'week') {
    const selected = parseDateValue(dateValue)
    const start = new Date(selected)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    params.date_from = toLocalDateKey(start)
    params.date_to = toLocalDateKey(end)
  } else {
    params.date = toLocalDateKey(dateValue)
  }

  if (status && status !== 'all') {
    params.status = status
  }

  return params
}

function getEncounterBackendStatus(uiStatus) {
  return ['planned', 'arrived', 'in_progress', 'on_hold', 'completed', 'cancelled'].includes(uiStatus)
    ? uiStatus
    : ''
}

const activeEncounterStatuses = ['planned', 'arrived', 'in_progress', 'on_hold', 'waiting']
const completedEncounterStatuses = ['completed']
const cancelledEncounterStatuses = ['cancelled']
const activeAppointmentStatuses = ['booked', 'confirmed', 'checked_in', 'in_consultation', 'rescheduled']

function filterEncountersByUiStatus(items, uiStatus, view = 'active') {
  const scopedItems = items.filter((item) => {
    const currentStatus = item.raw_status || item.status
    if (view === 'completed') {
      return completedEncounterStatuses.includes(currentStatus)
    }
    if (view === 'cancelled') {
      return cancelledEncounterStatuses.includes(currentStatus)
    }
    return activeEncounterStatuses.includes(currentStatus)
  })

  if (!uiStatus || uiStatus === 'all' || view !== 'active') {
    return scopedItems
  }

  if (uiStatus === 'waiting') {
    return scopedItems.filter((item) => ['planned', 'arrived', 'waiting'].includes(item.raw_status || item.status))
  }

  return scopedItems.filter((item) => (item.raw_status || item.status) === uiStatus)
}

function filterAppointmentsByWorklist(items, view, status) {
  const scopedItems =
    view === 'completed'
      ? items.filter((item) => item.status === 'completed')
      : items.filter((item) => activeAppointmentStatuses.includes(item.status))

  if (!status || status === 'all' || view === 'completed') {
    return scopedItems
  }

  return scopedItems.filter((item) => item.status === status)
}

function calculatePatientAge(dateOfBirth) {
  if (!dateOfBirth) {
    return ''
  }

  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) {
    return ''
  }

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return `${age} tuổi`
}

function getScheduleRangeParams(view, anchorDate) {
  const selected = parseDateValue(anchorDate)
  const start = new Date(selected)
  const end = new Date(selected)

  if (view === 'week') {
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    end.setDate(start.getDate() + 6)
  } else {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1, 0)
  }

  return {
    date_from: toLocalDateKey(start),
    date_to: toLocalDateKey(end),
  }
}

function getCalendarDays(anchorDate, schedules, view = 'month') {
  const anchor = parseDateValue(anchorDate)
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = new Date(monthStart)

  if (view === 'week') {
    const weekStart = new Date(anchor)
    const day = weekStart.getDay() || 7
    weekStart.setDate(weekStart.getDate() - day + 1)

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      const dateKey = toLocalDateKey(date)
      const matches = schedules.filter((item) => {
        const value = item.shift_start || item.start_time
        return value && toLocalDateKey(parseDateValue(value)) === dateKey
      })

      return {
        date,
        dateKey,
        isCurrentMonth: date.getMonth() === anchor.getMonth(),
        count: matches.length,
      }
    })
  }

  gridStart.setDate(monthStart.getDate() - monthStart.getDay())

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const dateKey = toLocalDateKey(date)
    const matches = schedules.filter((item) => {
      const value = item.shift_start || item.start_time
      return value && toLocalDateKey(parseDateValue(value)) === dateKey
    })

    return {
      date,
      dateKey,
      isCurrentMonth: date.getMonth() === anchor.getMonth(),
      count: matches.length,
    }
  })
}

function formatRoleLabel(role) {
  const normalized = String(role || 'doctor')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  const map = {
    doctor: 'Bác sĩ',
    receptionist: 'Lễ tân',
    nurse: 'Điều dưỡng',
    pharmacist: 'Dược sĩ',
    admin: 'Quản trị viên',
  }

  return map[normalized] || normalized.replace(/\b\w/g, (character) => character.toUpperCase())
}

function getWeekRange(anchorDate = new Date()) {
  const start = parseDateValue(anchorDate)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return {
    start,
    end,
    startKey: toLocalDateKey(start),
    endKey: toLocalDateKey(end),
  }
}

function formatWeekRange(startDate, endDate) {
  return `${formatDate(startDate, { month: '2-digit', day: '2-digit', year: 'numeric' })} - ${formatDate(endDate, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })}`
}

function formatMinutesAsText(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '--'
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}m`
}

function getMinutesFromNow(targetDate) {
  if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) {
    return null
  }

  return Math.max(0, Math.round((targetDate.getTime() - Date.now()) / 60000))
}

function getElapsedMinutes(dateValue) {
  if (!dateValue) {
    return null
  }

  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000))
}

function getWaitDurationLabel(dateValue) {
  const minutes = getElapsedMinutes(dateValue)
  if (minutes === null) {
    return 'Chưa có thời gian chờ'
  }

  return `Chờ ${formatMinutesAsText(minutes)}`
}

function getEncounterDurationMinutes(encounter = {}) {
  const start = encounter.start_time ? new Date(encounter.start_time) : null
  const end = encounter.end_time ? new Date(encounter.end_time) : new Date()
  if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function getEncounterPrimaryAction(status, readiness = {}) {
  if (['completed', 'cancelled'].includes(status)) {
    return { label: 'Mở chi tiết', action: 'detail', tone: 'secondary' }
  }
  if (['planned', 'arrived', 'on_hold'].includes(status)) {
    return {
      label: status === 'on_hold' ? 'Tiếp tục' : 'Bắt đầu',
      action: 'start',
      tone: readiness.can_start ? 'primary' : 'locked',
    }
  }
  if (status === 'in_progress') {
    return {
      label: 'Hoàn tất',
      action: 'complete',
      tone: readiness.can_complete ? 'success' : 'locked',
    }
  }
  return { label: 'Mở chi tiết', action: 'detail', tone: 'secondary' }
}

function getEncounterReadinessLabel(readiness = {}) {
  if (readiness.error) return 'Chưa tải điều kiện'
  if (readiness.can_complete) return 'Có thể hoàn tất'
  if (readiness.can_start) return 'Có thể bắt đầu'
  if (readiness.editable === false) return 'Đã khóa sửa'
  return 'Đang theo dõi'
}

function pickRelevantSchedule(schedules = []) {
  const now = Date.now()
  const normalized = safeArray(schedules)
    .map((schedule) => {
      const start = new Date(schedule.shift_start || schedule.start_time || '')
      const end = new Date(schedule.shift_end || schedule.end_time || '')
      return {
        ...schedule,
        _start: start,
        _end: end,
      }
    })
    .filter((schedule) => !Number.isNaN(schedule._start.getTime()) && !Number.isNaN(schedule._end.getTime()))
    .sort((left, right) => left._start.getTime() - right._start.getTime())

  if (!normalized.length) {
    return null
  }

  return (
    normalized.find((schedule) => schedule._start.getTime() <= now && schedule._end.getTime() >= now) ||
    normalized.find((schedule) => schedule._start.getTime() > now) ||
    normalized[0]
  )
}

function buildShiftState(schedule) {
  if (!schedule?._start || !schedule?._end) {
    return {
      label: 'Ngoài ca',
      tone: 'neutral',
      remainingText: '--',
      progressPercent: 0,
    }
  }

  const now = Date.now()
  const startTime = schedule._start.getTime()
  const endTime = schedule._end.getTime()
  const totalMinutes = Math.max(1, Math.round((endTime - startTime) / 60000))

  if (now < startTime) {
    return {
      label: 'Sắp vào ca',
      tone: 'blue',
      remainingText: `Bắt đầu sau ${formatMinutesAsText(getMinutesFromNow(schedule._start) || 0)}`,
      progressPercent: 0,
    }
  }

  if (now > endTime) {
    return {
      label: 'Ngoài ca',
      tone: 'neutral',
      remainingText: 'Ca trực đã kết thúc',
      progressPercent: 100,
    }
  }

  const elapsedMinutes = Math.max(0, Math.round((now - startTime) / 60000))
  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes)

  return {
    label: 'Đang trong ca',
    tone: 'green',
    remainingText: `Còn lại ${formatMinutesAsText(remainingMinutes)}`,
    progressPercent: Math.min(100, Math.max(8, Math.round((elapsedMinutes / totalMinutes) * 100))),
  }
}

function buildWeeklySeries(items = [], accessor, startDate) {
  const start = parseDateValue(startDate)
  start.setHours(0, 0, 0, 0)
  const counts = new Map(
    Array.from({ length: 7 }, (_, index) => {
      const current = new Date(start)
      current.setDate(start.getDate() + index)
      return [toLocalDateKey(current), 0]
    }),
  )

  safeArray(items).forEach((item) => {
    const dateValue = accessor(item)
    if (!dateValue) {
      return
    }

    const parsed = new Date(dateValue)
    if (Number.isNaN(parsed.getTime())) {
      return
    }

    const key = toLocalDateKey(parsed)
    if (counts.has(key)) {
      counts.set(key, Number(counts.get(key) || 0) + 1)
    }
  })

  return Array.from(counts.entries()).map(([dateKey, value]) => {
    const currentDate = parseDateValue(dateKey)
    return {
      dateKey,
      value,
      label: new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(currentDate),
    }
  })
}

function DashboardWeekChart({ series = [], loading = false, error = '', total = 0 }) {
  if (loading) {
    return <LoadingState label="Đang tải tổng quan tuần..." />
  }

  if (error && !series.length) {
    return <ErrorState title="Không thể tải tổng quan tuần" message={error} />
  }

  if (!series.length) {
    return (
      <EmptyState
        title="Chưa có dữ liệu tuần"
        description="Biểu đồ tuần sẽ hiển thị khi backend trả về lịch hẹn thực tế trong tuần này."
      />
    )
  }

  const chartWidth = 320
  const chartHeight = 132
  const paddingX = 18
  const paddingTop = 16
  const paddingBottom = 28
  const usableWidth = chartWidth - paddingX * 2
  const usableHeight = chartHeight - paddingTop - paddingBottom
  const maxValue = Math.max(...series.map((item) => item.value), 1)

  const points = series.map((item, index) => {
    const x = paddingX + (usableWidth / Math.max(1, series.length - 1)) * index
    const y = paddingTop + usableHeight - (item.value / maxValue) * usableHeight
    return { ...item, x, y }
  })

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${
    chartHeight - paddingBottom
  } Z`

  return (
    <div className="doctor-dashboard-week-chart">
      <div className="doctor-dashboard-week-chart-head">
        <div>
          <strong>Tổng quan tuần này</strong>
          <small>{total} lượt hẹn theo ngày</small>
        </div>
      </div>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} aria-label="Biểu đồ lịch hẹn theo tuần">
        <defs>
          <linearGradient id="doctor-dashboard-week-area" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.22)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((step) => {
          const y = paddingTop + (usableHeight / 2) * step
          return <line key={step} x1={paddingX} x2={chartWidth - paddingX} y1={y} y2={y} />
        })}
        <path className="doctor-dashboard-week-chart-area" d={areaPath} />
        <path className="doctor-dashboard-week-chart-line" d={linePath} />
        {points.map((point) => (
          <g key={point.dateKey}>
            <circle className="doctor-dashboard-week-chart-point" cx={point.x} cy={point.y} r="4.5" />
            <text x={point.x} y={chartHeight - 6}>
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function DoctorDashboardScreen({ user }) {
  const toast = useToast()
  const navigate = useNavigate()
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const doctorName = user?.fullName || user?.full_name || user?.username || 'Bác sĩ'
  const primaryRole = formatRoleLabel(Array.isArray(user?.roles) && user.roles.length ? user.roles[0] : user?.role)
  const weekRange = useMemo(() => getWeekRange(new Date()), [])
  const [appointmentsState, reloadAppointments] = useAsyncResource(
    async () => doctorApi.dashboard.getAppointmentsToday(doctorId, { date: getTodayDate() }),
    [doctorId],
    [],
    { fallbackMessage: 'Không thể tải lịch hẹn hôm nay.' },
  )
  const [encountersState, reloadEncounters] = useAsyncResource(
    async () => doctorApi.dashboard.getEncountersToday(doctorId, {
      date_from: getTodayDate(),
      date_to: getTodayDate(),
    }),
    [doctorId],
    [],
    { fallbackMessage: 'Không thể tải phiên khám hôm nay.' },
  )
  const [queueState, reloadQueue] = useAsyncResource(
    async () => doctorApi.dashboard.getQueueBoard(doctorId, { date: getTodayDate() }),
    [doctorId],
    emptyQueueBoard,
    { fallbackMessage: 'Không thể tải bảng hàng chờ của bác sĩ.' },
  )
  const [queueSummaryState, reloadQueueSummary] = useAsyncResource(
    async () => doctorApi.queue.getTodaySummary({ date: getTodayDate(), ...(doctorId ? { doctor_id: doctorId } : {}) }),
    [doctorId],
    null,
    { fallbackMessage: 'Không thể tải tổng quan hàng chờ hôm nay.' },
  )
  const [todaySchedulesState, reloadTodaySchedules] = useAsyncResource(
    async () => doctorApi.schedules.myToday(),
    [doctorId],
    [],
    { fallbackMessage: 'Không thể tải lịch làm việc hôm nay.' },
  )
  const [weekSchedulesState] = useAsyncResource(
    async () => doctorApi.schedules.myWeek({ date_from: weekRange.startKey, date_to: weekRange.endKey }),
    [doctorId, weekRange.startKey, weekRange.endKey],
    [],
    { fallbackMessage: 'Không thể tải lịch làm việc tuần này.' },
  )
  const [weeklyAppointmentsState] = useAsyncResource(
    async () =>
      doctorId
        ? doctorApi.appointments.listByDoctor(doctorId, { date_from: weekRange.startKey, date_to: weekRange.endKey })
        : doctorApi.appointments.listAll({ date_from: weekRange.startKey, date_to: weekRange.endKey }),
    [doctorId, weekRange.startKey, weekRange.endKey],
    [],
    { fallbackMessage: 'Không thể tải số liệu tuần của lịch hẹn.' },
  )
  const [prescriptionsState, reloadPrescriptions] = useAsyncResource(
    async () => {
      if (!doctorId || !capabilities.prescriptionsWrite) {
        return []
      }
      return doctorApi.prescriptions.listByDoctor(doctorId)
    },
    [doctorId, capabilities.prescriptionsWrite],
    [],
    { fallbackMessage: 'Không thể tải danh sách đơn thuốc của bác sĩ.' },
  )

  usePollingReload(reloadAppointments, Boolean(doctorId), 60000)
  usePollingReload(reloadEncounters, Boolean(doctorId), 60000)
  usePollingReload(reloadQueue, Boolean(doctorId), 45000)
  usePollingReload(reloadQueueSummary, Boolean(doctorId), 45000)
  usePollingReload(reloadTodaySchedules, Boolean(doctorId), 180000)
  usePollingReload(reloadPrescriptions, Boolean(doctorId && capabilities.prescriptionsWrite), 90000)

  const appointments = safeArray(appointmentsState.data)
  const encounters = safeArray(encountersState.data)
  const schedules = safeArray(todaySchedulesState.data)
  const weeklySchedules = safeArray(weekSchedulesState.data)
  const weeklyAppointments = safeArray(weeklyAppointmentsState.data)
  const prescriptions = safeArray(prescriptionsState.data)
  const queueBoard = computeQueueBoard(queueState.data)
  const queueSummary = queueSummaryState.data || null
  const sortedAppointments = appointments
    .slice()
    .sort((left, right) => new Date(left.appointment_time || 0).getTime() - new Date(right.appointment_time || 0).getTime())
  const sortedAppointmentTimes = sortedAppointments
    .map((item) => item.appointment_time)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())
  const averageWaitMinutes = queueBoard.waiting.length
    ? Math.max(
        0,
        Math.round(
          queueBoard.waiting.reduce((total, item) => {
            const checkInTime = item.checkin_time ? new Date(item.checkin_time).getTime() : Date.now()
            return total + Math.max(0, Date.now() - checkInTime) / 60000
          }, 0) / queueBoard.waiting.length,
        ),
      )
    : 0
  const activeSchedule = pickRelevantSchedule(schedules)
  const scheduleWindowText =
    activeSchedule
      ? `${formatTime(activeSchedule.shift_start)} - ${formatTime(activeSchedule.shift_end)}`
      : sortedAppointmentTimes.length > 0
        ? `${formatTime(sortedAppointmentTimes[0])} - ${formatTime(
            sortedAppointmentTimes[sortedAppointmentTimes.length - 1],
          )}`
        : 'Chưa có ca làm'
  const shiftState = buildShiftState(activeSchedule)
  const doctorDepartment =
    activeSchedule?.department_name ||
    weeklySchedules[0]?.department_name ||
    user?.department_name ||
    user?.departmentName ||
    'Chưa xác định khoa trực'
  const doctorSpecialization =
    user?.specialization || user?.specialty || user?.title || primaryRole || 'Bác sĩ điều trị'
  const patientMap = usePatientMap(
    [...appointments, ...encounters, ...queueBoard.queueItems, ...prescriptions].map((item) => item.patient_id),
  )
  const checkedInCount = appointments.filter((item) => ['checked_in', 'in_consultation'].includes(item.status)).length
  const activeEncounters = encounters
    .filter((item) => activeEncounterStatuses.includes(item.raw_status || item.status))
    .slice()
    .sort((left, right) => new Date(left.start_time || 0).getTime() - new Date(right.start_time || 0).getTime())
  const inServiceCount = queueSummary?.in_service ?? queueBoard.inService.length ?? activeEncounters.length
  const waitingCount = queueSummary?.waiting ?? queueBoard.waiting.length
  const pendingPrescriptions = prescriptions.filter((item) =>
    ['draft', 'active', 'verified', 'partially_dispensed', 'fully_dispensed'].includes(item.status),
  )
  const activePrescriptionCount = capabilities.prescriptionsWrite ? pendingPrescriptions.length : null
  const upcomingAppointments = sortedAppointments.slice(0, 5)
  const activeEncountersToday = encounters
    .filter((item) => activeEncounterStatuses.includes(item.raw_status || item.status))
    .slice()
    .sort((left, right) => new Date(left.start_time || 0).getTime() - new Date(right.start_time || 0).getTime())
    .slice(0, 5)
  const weeklySeries = buildWeeklySeries(weeklyAppointments, (item) => item.appointment_time, weekRange.start)
  const weekTotalAppointments = weeklySeries.reduce((total, item) => total + item.value, 0)
  const currentShiftLabel = activeSchedule?.shift_type || weeklySchedules[0]?.shift_type || 'Ca làm việc hôm nay'
  const todayScheduleCount = schedules.length
  const currentShiftStart = activeSchedule?._start || null
  const currentShiftEnd = activeSchedule?._end || null

  function getPatientLabel(item) {
    const patient = patientMap[item.patient_id]
    return patient?.full_name || item.patient_name || item.patient_id || 'Chưa rõ bệnh nhân'
  }

  function getPatientCode(item) {
    const patient = patientMap[item.patient_id]
    return patient?.patient_code || item.queue_number || item.patient_id || '--'
  }

  function openAppointments(state = {}) {
    navigate('/doctor/appointments', { state })
  }

  function openQueue() {
    navigate('/doctor/queue')
  }

  function openPrescriptions(state = {}) {
    guardDoctorAction({
      allowed: capabilities.prescriptionsWrite,
      toast,
      permission: 'prescriptions.write',
      onAllowed: () => navigate('/doctor/prescriptions', { state }),
    })
  }

  function openEncounterFlow() {
    guardDoctorAction({
      allowed: capabilities.canEncounterActions,
      toast,
      permission: 'encounters.write',
      message: 'Bạn không có quyền tạo phiên khám mới từ dashboard.',
      onAllowed: () =>
        openAppointments({
          focusDate: getTodayDate(),
          selectedStatus: 'checked_in',
          worklistView: 'active',
        }),
    })
  }

  const quickActions = [
    {
      id: 'encounter',
      label: 'Tạo encounter',
      description: 'Mở lịch hẹn đủ điều kiện để khởi tạo phiên khám.',
      icon: 'plus',
      tone: 'blue',
      onClick: openEncounterFlow,
      locked: !capabilities.canEncounterActions,
    },
    {
      id: 'appointments',
      label: 'Xem lịch hẹn',
      description: 'Đi đến danh sách lịch hẹn hôm nay của bác sĩ.',
      icon: 'calendar',
      tone: 'teal',
      onClick: () => openAppointments({ focusDate: getTodayDate() }),
      locked: !capabilities.appointmentsRead,
    },
    {
      id: 'prescriptions',
      label: 'Mở danh sách orders',
      description: 'Theo dõi đơn thuốc hoặc chỉ định đang còn xử lý.',
      icon: 'pill',
      tone: 'purple',
      onClick: () => openPrescriptions(),
      locked: !capabilities.prescriptionsWrite,
    },
    {
      id: 'queue',
      label: 'Bệnh nhân đang chờ',
      description: 'Mở hàng chờ để xem thứ tự và trạng thái phục vụ.',
      icon: 'patients',
      tone: 'amber',
      onClick: () =>
        guardDoctorAction({
          allowed: capabilities.appointmentsRead || capabilities.queueManage,
          toast,
          permission: 'queue.manage',
          message: 'Vai trò hiện tại không có quyền truy cập luồng hàng chờ của bác sĩ.',
          onAllowed: openQueue,
        }),
      locked: !(capabilities.appointmentsRead || capabilities.queueManage),
    },
  ]

  const dashboardCards = [
    {
      id: 'appointments',
      label: 'Lịch hẹn hôm nay',
      value: appointments.length,
      hint: checkedInCount ? `${checkedInCount} lượt đã check-in` : 'Theo dữ liệu lịch hẹn trong ngày',
      icon: 'calendar',
      tone: 'blue',
      onClick: () => openAppointments({ focusDate: getTodayDate() }),
    },
    {
      id: 'encounters',
      label: 'Encounter đang hoạt động',
      value: activeEncounters.length,
      hint: activeEncounters.length ? 'Đang theo dõi trong ca hôm nay' : 'Chưa có encounter active',
      icon: 'pulse',
      tone: 'purple',
      onClick: () => navigate('/doctor/encounters', { state: { encounterView: 'active' } }),
    },
    {
      id: 'queue',
      label: 'Bệnh nhân đang chờ',
      value: waitingCount,
      hint: waitingCount ? `${averageWaitMinutes} phút chờ trung bình` : 'Chưa có bệnh nhân chờ',
      icon: 'patients',
      tone: 'amber',
      onClick: openQueue,
    },
    {
      id: 'orders',
      label: 'Orders chờ xử lý',
      value: activePrescriptionCount ?? '--',
      hint: capabilities.prescriptionsWrite ? 'Đơn thuốc hoặc chỉ định chưa hoàn tất' : 'Route cần quyền prescriptions.write',
      icon: 'pill',
      tone: 'green',
      onClick: () => openPrescriptions(),
    },
  ]

  return (
    <div className="doctor-page-stack doctor-dashboard-redesign">
      <section className="doctor-dashboard-header">
        <div>
          <h1>Tổng quan bác sĩ</h1>
          <p>Chào mừng trở lại, chúc bạn một ngày làm việc hiệu quả!</p>
        </div>
      </section>

      <section className="doctor-dashboard-hero-card">
        <div className="doctor-dashboard-hero-main">
          <div className="doctor-dashboard-hero-profile">
            <div className="doctor-dashboard-hero-avatar">
              <span>{getInitials(doctorName) || 'BS'}</span>
              <span className={`doctor-dashboard-hero-avatar-dot is-${shiftState.tone}`} />
            </div>
            <div className="doctor-dashboard-hero-identity">
              <div className="doctor-dashboard-hero-name">
                <h2>{doctorName}</h2>
                {user?.status === 'active' ? (
                  <span className="doctor-dashboard-verified">
                    <DoctorIcon name="check_circle" />
                  </span>
                ) : null}
              </div>
              <div className="doctor-dashboard-hero-meta">
                <span>{doctorSpecialization}</span>
                <span>{doctorDepartment}</span>
                <span>{currentShiftLabel}</span>
              </div>
              <div className="doctor-dashboard-hero-summary">
                <div>
                  <span>Vai trò</span>
                  <strong>{primaryRole}</strong>
                </div>
                <div>
                  <span>Khoa / phòng khám</span>
                  <strong>{doctorDepartment}</strong>
                </div>
                <div>
                  <span>Ca làm việc</span>
                  <strong>{scheduleWindowText}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className={`doctor-dashboard-shift-card is-${shiftState.tone}`}>
            <div>
              <span className={`doctor-dashboard-shift-badge is-${shiftState.tone}`}>{shiftState.label}</span>
              <dl>
                <div>
                  <dt>Bắt đầu</dt>
                  <dd>{currentShiftStart ? formatTime(currentShiftStart) : '--'}</dd>
                </div>
                <div>
                  <dt>Kết thúc</dt>
                  <dd>{currentShiftEnd ? formatTime(currentShiftEnd) : '--'}</dd>
                </div>
              </dl>
            </div>
            <div
              className="doctor-dashboard-shift-progress"
              style={{ '--doctor-shift-progress': `${shiftState.progressPercent}%` }}
            >
              <strong>{shiftState.remainingText}</strong>
            </div>
          </div>

          <div className="doctor-dashboard-hero-chart">
            <div className="doctor-dashboard-hero-chart-head">
              <div>
                <strong>Tổng quan tuần này</strong>
                <small>{formatWeekRange(weekRange.start, weekRange.end)}</small>
              </div>
              <span>{weekTotalAppointments} lịch hẹn</span>
            </div>
            <DashboardWeekChart
              series={weeklySeries}
              loading={weeklyAppointmentsState.loading}
              error={weeklyAppointmentsState.error}
              total={weekTotalAppointments}
            />
          </div>
        </div>
      </section>

      <section className="doctor-dashboard-kpi-grid">
        {dashboardCards.map((card) => (
          <button key={card.id} className={`doctor-dashboard-kpi-card is-${card.tone}`} type="button" onClick={card.onClick}>
            <span className="doctor-dashboard-kpi-icon">
              <DoctorIcon name={card.icon} />
            </span>
            <div className="doctor-dashboard-kpi-copy">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.hint}</small>
            </div>
          </button>
        ))}
      </section>

      <section className="doctor-dashboard-quick-actions">
        <div className="doctor-dashboard-section-head">
          <h2>Thao tác nhanh</h2>
          <p>Đi thẳng vào các luồng làm việc chính của bác sĩ trong ca hiện tại.</p>
        </div>
        <div className="doctor-dashboard-quick-grid">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className={`doctor-dashboard-quick-card is-${action.tone}${action.locked ? ' is-locked' : ''}`}
              type="button"
              onClick={action.onClick}
            >
              <span className="doctor-dashboard-quick-icon">
                <DoctorIcon name={action.icon} />
              </span>
              <div>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="doctor-dashboard-panels-grid">
        <article className="doctor-dashboard-panel">
          <header className="doctor-dashboard-panel-head">
            <div>
              <h3>Lịch hẹn hôm nay</h3>
              <p>{appointments.length} lịch hẹn từ backend trong ngày hiện tại.</p>
            </div>
            <button className="doctor-link-button" type="button" onClick={() => openAppointments({ focusDate: getTodayDate() })}>
              Xem tất cả lịch hẹn
            </button>
          </header>
          {appointmentsState.loading ? <LoadingState label="Đang tải lịch hẹn hôm nay..." /> : null}
          {appointmentsState.error && !upcomingAppointments.length ? (
            <ErrorState title="Không thể tải lịch hẹn" message={appointmentsState.error} onRetry={reloadAppointments} />
          ) : null}
          {!appointmentsState.loading && !appointmentsState.error && !upcomingAppointments.length ? (
            <EmptyState title="Chưa có lịch hẹn hôm nay" description="Các lịch hẹn của bác sĩ trong ngày sẽ xuất hiện tại đây." />
          ) : null}
          {upcomingAppointments.length ? (
            <div className="doctor-dashboard-compact-list">
              {upcomingAppointments.map((appointment) => {
                const patient = patientMap[appointment.patient_id]
                const label = patient?.full_name || appointment.patient_name || appointment.patient_id || 'Chưa rõ bệnh nhân'
                return (
                  <button
                    key={appointment.appointment_id || appointment.id}
                    className="doctor-dashboard-list-row"
                    type="button"
                    onClick={() =>
                      openAppointments({
                        selectedAppointmentId: appointment.appointment_id || appointment.id,
                        focusDate: appointment.appointment_time,
                      })
                    }
                  >
                    <span className="doctor-dashboard-time-pill">{formatTime(appointment.appointment_time)}</span>
                    <div className="doctor-dashboard-list-copy">
                      <strong>{label}</strong>
                      <small>
                        {getPatientCode(appointment)} • {appointment.appointment_type || 'Lịch khám'}
                      </small>
                    </div>
                    <StatusBadge status={appointment.status || 'booked'} />
                  </button>
                )
              })}
            </div>
          ) : null}
        </article>

        <article className="doctor-dashboard-panel">
          <header className="doctor-dashboard-panel-head">
            <div>
              <h3>Bệnh nhân đang chờ</h3>
              <p>{waitingCount} lượt đang chờ trong hàng đợi của bác sĩ.</p>
            </div>
            <button className="doctor-link-button" type="button" onClick={openQueue}>
              Xem tất cả hàng chờ
            </button>
          </header>
          {queueState.loading ? <LoadingState label="Đang tải hàng chờ..." /> : null}
          {queueState.error && !queueBoard.waiting.length ? (
            <ErrorState title="Không thể tải hàng chờ" message={queueState.error} onRetry={reloadQueue} />
          ) : null}
          {!queueState.loading && !queueState.error && !queueBoard.waiting.length ? (
            <EmptyState title="Hàng chờ đang trống" description="Chưa có bệnh nhân nào đang chờ khám trong ngày hôm nay." />
          ) : null}
          {queueBoard.waiting.length ? (
            <div className="doctor-dashboard-compact-list">
              {queueBoard.waiting.slice(0, 5).map((ticket, index) => (
                <button key={ticket.queue_ticket_id || index} className="doctor-dashboard-list-row" type="button" onClick={openQueue}>
                  <span className={`doctor-dashboard-rank-pill${ticket.priority_flag ? ' is-priority' : ''}`}>
                    {ticket.queue_number || index + 1}
                  </span>
                  <div className="doctor-dashboard-list-copy">
                    <strong>{getPatientLabel(ticket)}</strong>
                    <small>
                      {getPatientCode(ticket)} • {ticket.queue_type || 'Khám ngoại trú'}
                    </small>
                  </div>
                  <div className="doctor-dashboard-list-side">
                    {ticket.priority_flag ? <span className="doctor-dashboard-priority-badge">Ưu tiên</span> : null}
                    <small>{getWaitDurationLabel(ticket.checkin_time)}</small>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="doctor-dashboard-panel">
          <header className="doctor-dashboard-panel-head">
            <div>
              <h3>Encounter đang hoạt động</h3>
              <p>{activeEncounters.length} encounter đang được theo dõi trong ngày.</p>
            </div>
            <button
              className="doctor-link-button"
              type="button"
              onClick={() => navigate('/doctor/encounters', { state: { encounterView: 'active' } })}
            >
              Xem tất cả
            </button>
          </header>
          {encountersState.loading ? <LoadingState label="Đang tải encounter đang hoạt động..." /> : null}
          {encountersState.error && !activeEncountersToday.length ? (
            <ErrorState title="Không thể tải encounter" message={encountersState.error} onRetry={reloadEncounters} />
          ) : null}
          {!encountersState.loading && !encountersState.error && !activeEncountersToday.length ? (
            <EmptyState title="Chưa có encounter active" description="Danh sách encounter đang hoạt động sẽ xuất hiện ở đây." />
          ) : null}
          {activeEncountersToday.length ? (
            <div className="doctor-dashboard-compact-list">
              {activeEncountersToday.map((encounter) => {
                const patient = patientMap[encounter.patient_id]
                const encounterLabel =
                  patient?.full_name || encounter.patient_name || encounter.patient_id || 'Chưa rõ bệnh nhân'
                const encounterId = encounter.encounter_id || encounter.id
                const encounterAge = calculatePatientAge(patient?.date_of_birth)

                return (
                  <button
                    key={encounterId}
                    className="doctor-dashboard-list-row"
                    type="button"
                    onClick={() => navigate(`/doctor/encounters/${encounterId}`)}
                  >
                    <span className="doctor-dashboard-person-avatar">{getInitials(encounterLabel) || 'BN'}</span>
                    <div className="doctor-dashboard-list-copy">
                      <strong>{encounterLabel}</strong>
                      <small>
                        {getPatientCode(encounter)} {encounterAge ? `• ${encounterAge}` : ''} •{' '}
                        {encounter.encounter_type || encounter.encounter_code || 'Phiên khám'}
                      </small>
                    </div>
                    <div className="doctor-dashboard-list-side">
                      <StatusBadge status={encounter.status || 'waiting'} />
                      <small>{getElapsedMinutes(encounter.start_time) ? `${formatMinutesAsText(getElapsedMinutes(encounter.start_time))} xử lý` : '--'}</small>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </article>

        <article className="doctor-dashboard-panel">
          <header className="doctor-dashboard-panel-head">
            <div>
              <h3>Orders chờ xử lý</h3>
              <p>
                {capabilities.prescriptionsWrite
                  ? `${pendingPrescriptions.length} đơn thuốc hoặc chỉ định chưa hoàn tất.`
                  : 'Danh sách này phụ thuộc route kê đơn theo bác sĩ.'}
              </p>
            </div>
            <button className="doctor-link-button" type="button" onClick={() => openPrescriptions()}>
              Xem tất cả
            </button>
          </header>
          {capabilities.prescriptionsWrite && prescriptionsState.loading ? (
            <LoadingState label="Đang tải orders chờ xử lý..." />
          ) : null}
          {capabilities.prescriptionsWrite && prescriptionsState.error && !pendingPrescriptions.length ? (
            <ErrorState
              title="Không thể tải orders"
              message={prescriptionsState.error}
              onRetry={reloadPrescriptions}
            />
          ) : null}
          {!capabilities.prescriptionsWrite ? (
            <EmptyState
              title="Route danh sách đơn thuốc bị giới hạn quyền"
              description="Backend đang bảo vệ GET /prescriptions/doctor/:doctorId bằng quyền prescriptions.write, nên dashboard không gọi route này khi tài khoản không đủ quyền."
            />
          ) : null}
          {capabilities.prescriptionsWrite && !prescriptionsState.loading && !prescriptionsState.error && !pendingPrescriptions.length ? (
            <EmptyState title="Không có order đang chờ xử lý" description="Chưa có đơn thuốc hoặc chỉ định nào còn mở trong ca hiện tại." />
          ) : null}
          {capabilities.prescriptionsWrite && pendingPrescriptions.length ? (
            <div className="doctor-dashboard-compact-list">
              {pendingPrescriptions.slice(0, 5).map((prescription) => {
                const patient = patientMap[prescription.patient_id]
                const patientLabel =
                  patient?.full_name || prescription.patient_name || prescription.patient_id || 'Chưa rõ bệnh nhân'
                const prescriptionId = prescription.prescription_id || prescription.id

                return (
                  <button
                    key={prescriptionId}
                    className="doctor-dashboard-list-row"
                    type="button"
                    onClick={() => openPrescriptions({ selectedPrescriptionId: prescriptionId })}
                  >
                    <span className="doctor-dashboard-order-icon">
                      <DoctorIcon name="pill" />
                    </span>
                    <div className="doctor-dashboard-list-copy">
                      <strong>{prescription.note || prescription.prescription_no || 'Đơn thuốc lâm sàng'}</strong>
                      <small>
                        {patientLabel} • {prescription.encounter_code || getPatientCode(prescription)}
                      </small>
                    </div>
                    <div className="doctor-dashboard-list-side">
                      <StatusBadge status={prescription.status || 'draft'} />
                      <small>{safeArray(prescription.items).length} item</small>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </article>
      </section>

      <section className="doctor-dashboard-footer-strip">
        {todaySchedulesState.error ? <SurfaceHint tone="warning">{todaySchedulesState.error}</SurfaceHint> : null}
        {queueSummaryState.error ? <SurfaceHint tone="warning">{queueSummaryState.error}</SurfaceHint> : null}
        {weeklyAppointmentsState.error && weeklySeries.length ? (
          <SurfaceHint tone="warning">{weeklyAppointmentsState.error}</SurfaceHint>
        ) : null}
        <SurfaceHint tone="neutral">
          {todayScheduleCount ? `Hôm nay có ${todayScheduleCount} ca làm việc được ghi nhận.` : 'Hôm nay chưa có ca làm việc được ghi nhận.'}
        </SurfaceHint>
      </section>
    </div>
  )
}

export function DoctorQueueScreen({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const shouldAutoCallNext = Boolean(location.state?.autoCallNext)
  const [autoCallHandled, setAutoCallHandled] = useState(false)
  const [boardState, reloadBoard] = useAsyncResource(
    async () =>
      doctorId
        ? doctorApi.queue.getBoard(doctorId, { date: getTodayDate() })
        : doctorApi.queue.listAll({ date: getTodayDate() }),
    [doctorId],
    emptyQueueBoard,
      { fallbackMessage: 'Không thể tải bảng hàng chờ.' },
  )
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState('')

  usePollingReload(reloadBoard, true, 30000)

  const queueBoard = computeQueueBoard(boardState.data)
  const patientMap = usePatientMap(queueBoard.queueItems.map((item) => item.patient_id))
  const currentServing = queueBoard.currentServing
  const queueCounts = {
    waiting: queueBoard.waiting.length,
    called: safeArray(queueBoard.called).length,
    inService: queueBoard.inService.length,
    completed: queueBoard.completed.length,
  }
  const currentPatient = currentServing ? patientMap[currentServing.patient_id] : null
  const currentServingId = currentServing?.queue_ticket_id || currentServing?.id || ''
  const upcomingQueueItems = [...queueBoard.waiting, ...queueBoard.called, ...queueBoard.inService].filter((item) => {
    const itemId = item.queue_ticket_id || item.id || ''
    return !currentServingId || itemId !== currentServingId
  })
  const recentCompletedQueueItems = [...queueBoard.completed].slice(-6).reverse()
  const showQueueControls = capabilities.canQueueActions
  const [queueSummaryState, reloadQueueSummary] = useAsyncResource(
    async () => doctorApi.queue.getTodaySummary(doctorId ? { doctor_id: doctorId } : {}),
    [doctorId],
    null,
    { fallbackMessage: 'Không thể tải tổng quan hàng chờ hôm nay.' },
  )
  const [ticketDetailState, reloadTicketDetail] = useAsyncResource(
    async () => (selectedTicketId ? doctorApi.queue.getDetail(selectedTicketId) : null),
    [selectedTicketId],
    null,
    { fallbackMessage: 'Không thể tải chi tiết phiếu hàng chờ.' },
  )
  const [ticketTimelineState, reloadTicketTimeline] = useAsyncResource(
    async () => (selectedTicketId ? doctorApi.queue.getTimeline(selectedTicketId) : []),
    [selectedTicketId],
    [],
    { fallbackMessage: 'Không thể tải timeline phiếu hàng chờ.' },
  )
  const queueSummary = queueSummaryState.data || {}
  const selectedTicketDetail =
    ticketDetailState.data ||
    queueBoard.queueItems.find((item) => (item.queue_ticket_id || item.id) === selectedTicketId) ||
    null
  const selectedTicketTimeline = safeArray(ticketTimelineState.data)

  usePollingReload(reloadQueueSummary, true, 30000)
  usePollingReload(reloadTicketDetail, Boolean(selectedTicketId), 30000)
  usePollingReload(reloadTicketTimeline, Boolean(selectedTicketId), 30000)

  useEffect(() => {
    const queueIds = new Set(
      [...queueBoard.queueItems, ...recentCompletedQueueItems].map((item) => item.queue_ticket_id || item.id).filter(Boolean),
    )
    const hasSelectedTicket = selectedTicketId && queueIds.has(selectedTicketId)

    if (hasSelectedTicket) {
      return
    }

    const firstTicket = currentServing || upcomingQueueItems[0] || recentCompletedQueueItems[0]
    const firstTicketId = firstTicket?.queue_ticket_id || firstTicket?.id || ''
    setSelectedTicketId(firstTicketId || '')
  }, [currentServing, queueBoard.queueItems, recentCompletedQueueItems, selectedTicketId, upcomingQueueItems])

  async function handleCallNext() {
    if (!guardDoctorAction({ allowed: showQueueControls, toast, permission: 'queue.manage' })) {
      return
    }

    setBusy(true)
    try {
      await doctorApi.queue.callNext(doctorId)
      notifyDoctorSuccess(toast, 'Đã gọi bệnh nhân tiếp theo trong hàng chờ.', 'Hàng chờ đã cập nhật')
      reloadBoard()
      reloadQueueSummary()
      reloadTicketDetail()
      reloadTicketTimeline()
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể gọi bệnh nhân tiếp theo.', { permission: 'queue.manage' })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!shouldAutoCallNext || autoCallHandled || boardState.loading || busy || !doctorId || !showQueueControls) {
      return
    }

    setAutoCallHandled(true)
    navigate('/doctor/queue', { replace: true, state: {} })

    if (queueBoard.waiting.length > 0) {
      handleCallNext()
    } else if (!queueBoard.called.length && !queueBoard.inService.length) {
      showDoctorToast(toast, {
        type: 'info',
        title: 'Hàng chờ trống',
        message: 'Không có bệnh nhân đang chờ để gọi trong hàng chờ hôm nay.',
      })
    }
  }, [
    autoCallHandled,
    boardState.loading,
    busy,
    doctorId,
    navigate,
    queueBoard.called.length,
    queueBoard.inService.length,
    queueBoard.waiting.length,
    showQueueControls,
    shouldAutoCallNext,
  ])

  async function handleAction(action, ticket) {
    const ticketId = ticket?.queue_ticket_id || ticket?.id || ticket
    if (!ticketId) {
      return
    }
    if (!guardDoctorAction({ allowed: showQueueControls, toast, permission: 'queue.manage' })) {
      return
    }

    setBusy(true)

    try {
      if (action === 'recall') {
        await doctorApi.queue.recall(ticketId)
      }
      if (action === 'skip') {
        await doctorApi.queue.skip(ticketId)
      }
      if (action === 'complete') {
        await doctorApi.queue.complete(ticketId)
      }
      if (action === 'start-service') {
        const payload = await doctorApi.queue.startService(ticketId)
        let encounterId = payload?.encounter?.encounter_id || payload?.encounter_id || ticket?.encounter_id || ''

        if (!encounterId && ticket?.appointment_id) {
          const created = await doctorApi.encounters.createFromAppointment(ticket.appointment_id)
          encounterId = created?.encounter?.encounter_id || created?.encounter_id || created?.id || ''
        }

        reloadBoard()
        reloadQueueSummary()
        reloadTicketDetail()
        reloadTicketTimeline()
        if (encounterId) {
          notifyDoctorSuccess(toast, 'Đã bắt đầu phục vụ và mở phiên khám liên quan.', 'Đã chuyển vào khám')
          navigate(`/doctor/encounters/${encounterId}`)
          return
        }
      }

      if (action !== 'start-service') {
        const successMessages = {
          recall: 'Đã gọi lại bệnh nhân trong hàng chờ.',
          skip: 'Đã bỏ qua phiếu hàng chờ.',
          complete: 'Đã hoàn tất phiếu hàng chờ.',
        }
        notifyDoctorSuccess(toast, successMessages[action] || 'Đã cập nhật hàng chờ.', 'Hàng chờ đã cập nhật')
      }
      setDialog(null)
      reloadBoard()
      reloadQueueSummary()
      reloadTicketDetail()
      reloadTicketTimeline()
    } catch (error) {
      handleDoctorApiError(error, toast, 'Thao tác hàng chờ thất bại.', { permission: 'queue.manage' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="doctor-page-stack">
      <section className="doctor-queue-command-panel" aria-label="Điều phối hàng chờ">
        <div className="doctor-queue-command-row">
          <div className="doctor-queue-command-copy">
            <span className="doctor-queue-live-chip">API trực tiếp</span>
            <strong>Điều phối nhanh</strong>
            <small>Tự làm mới mỗi 30 giây</small>
          </div>
          {showQueueControls ? (
            <div className="doctor-inline-actions doctor-queue-command-actions">
              <button className="doctor-secondary-button" type="button" onClick={() => currentServing && setDialog({ action: 'skip', ticket: currentServing })} disabled={busy || !currentServing}>
                Bỏ qua
              </button>
              <button className="doctor-secondary-button" type="button" onClick={() => currentServing && handleAction('recall', currentServing)} disabled={busy || !currentServing}>
                Gọi lại
              </button>
              <button className="doctor-primary-button doctor-queue-call-next-button" type="button" onClick={handleCallNext} disabled={busy}>
                Gọi bệnh nhân tiếp theo
              </button>
            </div>
          ) : null}
        </div>

        <div className="doctor-kpi-mini-grid doctor-queue-summary-grid">
          <div className="doctor-kpi-tile doctor-queue-summary-tile">
            <strong>{queueCounts.waiting}</strong>
            <span>Đang chờ</span>
          </div>
          <div className="doctor-kpi-tile doctor-queue-summary-tile">
            <strong>{queueCounts.called}</strong>
            <span>Đã gọi</span>
          </div>
          <div className="doctor-kpi-tile doctor-queue-summary-tile">
            <strong>{queueCounts.inService}</strong>
            <span>Đang phục vụ</span>
          </div>
          <div className="doctor-kpi-tile doctor-queue-summary-tile">
            <strong>{queueCounts.completed}</strong>
            <span>Hoàn tất</span>
          </div>
        </div>
      </section>

      <section className="doctor-dashboard-grid doctor-queue-layout">
        <div className="doctor-panel-stack">
          <SectionCard
            title="Đang phục vụ"
            subtitle="Thông tin trung tâm của bệnh nhân đang được phục vụ tại phòng khám."
            className="doctor-queue-current-shell"
          >
            {currentServing ? (
              <div className="doctor-current-serving doctor-queue-current-card">
                <div className="doctor-queue-current-head">
                  <div className="doctor-current-ticket">{currentServing.queue_number || '--'}</div>
                  <div className="doctor-queue-current-copy">
                    <div className="doctor-queue-current-copy-top">
                        <span className="doctor-queue-stage-label">Đang phục vụ</span>
                      <StatusBadge status={currentServing.status || ''} className="doctor-queue-status-badge" />
                      {currentServing.priority_flag ? (
                          <span className="doctor-queue-priority-pill">Ưu tiên</span>
                      ) : null}
                    </div>
                    <strong>{currentPatient?.full_name || currentServing.patient_name || currentServing.patient_id}</strong>
                    <p>
                      {currentPatient?.patient_code || currentServing.patient_id || '--'} -{' '}
                      {currentServing.queue_type || '--'}
                    </p>
                  </div>
                </div>
                <div className="doctor-kpi-mini-grid doctor-queue-current-stats">
                  <div className="doctor-kpi-tile">
                    <strong>{formatTime(currentServing.checkin_time)}</strong>
                    <span>Giờ vào</span>
                  </div>
                  <div className="doctor-kpi-tile">
                    <strong>{currentServing.queue_type || '--'}</strong>
                    <span>Loại khám</span>
                  </div>
                  <div className="doctor-kpi-tile">
                    <strong>{currentPatient?.patient_code || currentServing.patient_id || '--'}</strong>
                    <span>Mã bệnh nhân</span>
                  </div>
                  <div className="doctor-kpi-tile">
                    <strong>{currentServing.encounter_id || currentServing.appointment_id || '--'}</strong>
                    <span>Hồ sơ liên kết</span>
                  </div>
                </div>
                <div className="doctor-queue-current-toolbar">
                  <div className="doctor-inline-actions doctor-inline-actions-wrap doctor-queue-current-actions">
                    <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/patients/${currentServing.patient_id}`)}>
                      Mở hồ sơ
                    </button>
                    {currentServing.encounter_id ? (
                      <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${currentServing.encounter_id}`)}>
                        Mở phiên khám
                      </button>
                    ) : null}
                    {currentServing.appointment_id && !currentServing.encounter_id ? (
                      <button
                        className="doctor-secondary-button"
                        type="button"
                        onClick={() =>
                          navigate('/doctor/appointments', {
                            state: {
                              selectedAppointmentId: currentServing.appointment_id,
                              focusDate: currentServing.appointment_time || currentServing.checkin_time,
                            },
                          })
                        }
                      >
                        Mở lịch hẹn
                      </button>
                    ) : null}
                  </div>
                  {showQueueControls ? (
                    <div className="doctor-inline-actions doctor-inline-actions-wrap doctor-queue-current-actions">
                      <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'skip', ticket: currentServing })} disabled={busy}>
                        Tạm dừng / Bỏ qua
                      </button>
                      <button className="doctor-primary-button doctor-primary-green" type="button" onClick={() => setDialog({ action: 'complete', ticket: currentServing })} disabled={busy}>
                        Hoàn tất
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Chưa có bệnh nhân đang được phục vụ"
                description="Hãy gọi phiếu tiếp theo để bắt đầu phục vụ."
              />
            )}
          </SectionCard>

        </div>

        <SectionCard
          title={`Bảng hàng chờ trực tiếp (${upcomingQueueItems.length})`}
          subtitle="Các phiếu đang hoạt động được trả về trực tiếp từ queue API."
          actions={<span className="doctor-muted-text">Tự làm mới mỗi 30 giây</span>}
          className="doctor-queue-board-shell"
        >
          {boardState.loading ? <LoadingState label="Đang tải bảng hàng chờ..." /> : null}
          {boardState.error && !upcomingQueueItems.length ? (
            <ErrorState title="Không thể tải hàng chờ" message={boardState.error} onRetry={reloadBoard} />
          ) : null}
          {!boardState.loading ? (
            <QueueBoardTable
              tickets={upcomingQueueItems}
              patientMap={patientMap}
              onRecall={(ticketId) => handleAction('recall', ticketId)}
              onSkip={(ticket) => setDialog({ action: 'skip', ticket })}
              onStartService={(ticket) => handleAction('start-service', ticket)}
              onComplete={(ticket) => setDialog({ action: 'complete', ticket })}
              onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
              showControls={showQueueControls}
            />
          ) : null}
        </SectionCard>
      </section>

      <SectionCard title="Tín hiệu hàng chờ hôm nay" subtitle="Tổng quan và chi tiết phiếu đọc trực tiếp từ backend.">
        {queueSummaryState.loading ? <LoadingState label="Đang tải tổng quan hàng chờ..." /> : null}
        {queueSummaryState.error ? <ErrorState title="Không thể tải tổng quan hàng chờ" message={queueSummaryState.error} /> : null}
        <div className="doctor-kpi-mini-grid">
          <div className="doctor-kpi-tile"><strong>{queueSummary.total ?? queueSummary.total_tickets ?? queueBoard.queueItems.length}</strong><span>Tổng phiếu</span></div>
          <div className="doctor-kpi-tile"><strong>{queueSummary.waiting ?? queueCounts.waiting}</strong><span>Đang chờ</span></div>
          <div className="doctor-kpi-tile"><strong>{queueSummary.in_service ?? queueSummary.inService ?? queueCounts.inService}</strong><span>Đang khám</span></div>
          <div className="doctor-kpi-tile"><strong>{queueSummary.completed ?? queueCounts.completed}</strong><span>Hoàn tất</span></div>
        </div>
        {selectedTicketDetail ? (
          <div className="doctor-overview-panel">
            <div>
              <h4>Phiếu đang xem</h4>
              <p>{selectedTicketDetail.queue_number || selectedTicketId || '--'}</p>
              <p>{selectedTicketDetail.patient_name || selectedTicketDetail.patient_id || '--'} - {selectedTicketDetail.queue_type || '--'}</p>
              {selectedTicketDetail.status ? <StatusBadge status={selectedTicketDetail.status} /> : null}
              <div className="doctor-kpi-mini-grid">
                <div className="doctor-kpi-tile"><strong>{formatTime(selectedTicketDetail.checkin_time)}</strong><span>Check-in</span></div>
                <div className="doctor-kpi-tile"><strong>{selectedTicketDetail.encounter_id || '--'}</strong><span>Encounter</span></div>
                <div className="doctor-kpi-tile"><strong>{selectedTicketDetail.appointment_id || '--'}</strong><span>Lịch hẹn</span></div>
                <div className="doctor-kpi-tile"><strong>{selectedTicketDetail.priority_flag ? 'Có' : 'Không'}</strong><span>Ưu tiên</span></div>
              </div>
              <div className="doctor-inline-actions doctor-inline-actions-wrap">
                {selectedTicketDetail.patient_id ? (
                  <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/patients/${selectedTicketDetail.patient_id}`)}>
                    Mở hồ sơ
                  </button>
                ) : null}
                {selectedTicketDetail.encounter_id ? (
                  <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${selectedTicketDetail.encounter_id}`)}>
                    Mở phiên khám
                  </button>
                ) : null}
                {selectedTicketDetail.appointment_id && !selectedTicketDetail.encounter_id ? (
                  <button
                    className="doctor-secondary-button"
                    type="button"
                    onClick={() =>
                      navigate('/doctor/appointments', {
                        state: {
                          selectedAppointmentId: selectedTicketDetail.appointment_id,
                          focusDate: selectedTicketDetail.appointment_time || selectedTicketDetail.checkin_time,
                        },
                      })
                    }
                  >
                    Mở lịch hẹn
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              <h4>Timeline phiếu</h4>
              {ticketTimelineState.loading ? <LoadingState label="Đang tải timeline phiếu..." /> : null}
              {ticketTimelineState.error ? <ErrorState title="Không thể tải timeline phiếu" message={ticketTimelineState.error} /> : null}
              {selectedTicketTimeline.length ? (
                <div className="doctor-list-stack">
                  {selectedTicketTimeline.slice(0, 5).map((item, index) => (
                    <div key={item.audit_log_id || item.id || index} className="doctor-list-row">
                      <div>
                        <strong>{item.action || item.event_type || item.title || 'Sự kiện hàng chờ'}</strong>
                        <p>{item.message || item.description || item.status || '--'}</p>
                      </div>
                      <span>{item.created_at || item.event_time ? formatTime(item.created_at || item.event_time) : '--'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {!ticketTimelineState.loading && !ticketTimelineState.error && selectedTicketTimeline.length === 0 ? (
                <EmptyState title="Chưa có timeline phiếu" description="Phiếu đã chọn chưa phát sinh sự kiện nào từ backend." />
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyState title="Chưa chọn phiếu hàng chờ" description="Chọn một phiếu trong bảng để xem chi tiết chỉ đọc từ backend." />
        )}
      </SectionCard>

      {recentCompletedQueueItems.length > 0 ? (
        <SectionCard title={`Hoàn tất hôm nay (${recentCompletedQueueItems.length})`} subtitle="Các phiếu hàng chờ hoàn tất gần nhất." className="doctor-queue-completed-shell">
          <div className="doctor-queue-completed-list">
            {recentCompletedQueueItems.map((ticket) => {
              const patient = patientMap[ticket.patient_id]
              const ticketId = ticket.queue_ticket_id || ticket.id

              return (
                <article key={ticketId} className="doctor-queue-completed-card">
                  <div className="doctor-queue-completed-head">
                    <div className="doctor-current-ticket">{ticket.queue_number || '--'}</div>
                    <div className="doctor-queue-current-copy">
                      <div className="doctor-queue-current-copy-top">
                        <span className="doctor-queue-stage-label">Phiếu hoàn tất</span>
                        <StatusBadge status={ticket.status || ''} className="doctor-queue-status-badge" />
                      </div>
                      <strong>{patient?.full_name || ticket.patient_name || ticket.patient_id || '--'}</strong>
                      <p>
                        {patient?.patient_code || ticket.patient_id || '--'} - {ticket.queue_type || '--'}
                      </p>
                    </div>
                  </div>
                  <div className="doctor-queue-completed-meta">
                    <div className="doctor-queue-bottom-meta-card">
                      <span>Hoàn tất</span>
                      <strong>{formatTime(ticket.completed_time)}</strong>
                    </div>
                    <div className="doctor-queue-bottom-meta-card">
                      <span>Mã phiếu</span>
                      <strong>{ticketId}</strong>
                    </div>
                    <div className="doctor-queue-bottom-meta-card">
                      <span>Mã bệnh nhân</span>
                      <strong>{patient?.patient_code || ticket.patient_id || '--'}</strong>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </SectionCard>
      ) : null}

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title={dialog?.action === 'skip' ? 'Bỏ qua phiếu hàng chờ?' : 'Hoàn tất phiếu hàng chờ?'}
        description={
          dialog?.action === 'skip'
            ? 'Thao tác này sẽ đưa bệnh nhân đã chọn ra khỏi luồng hàng chờ đang hoạt động.'
            : 'Thao tác này sẽ đánh dấu phiếu hàng chờ là đã hoàn tất trong bảng hiện tại.'
        }
        confirmLabel={dialog?.action === 'skip' ? 'Bỏ qua phiếu' : 'Hoàn tất phiếu'}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => handleAction(dialog?.action, dialog?.ticket)}
      />
    </div>
  )
}

export function DoctorAppointmentsScreen({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const [scope, setScope] = useState('day')
  const [dateValue, setDateValue] = useState(getTodayDate())
  const [worklistView, setWorklistView] = useState('active')
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [detailState, setDetailState] = useState({ loading: false, error: '', data: null })
  const [detailRefreshToken, setDetailRefreshToken] = useState(0)
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)

  const appointmentQueryStatus = worklistView === 'completed' ? 'completed' : status
  const params = useMemo(() => getRangeParams(scope, dateValue, appointmentQueryStatus), [scope, dateValue, appointmentQueryStatus])
  const [appointmentsState, reloadAppointments] = useAsyncResource(
    async () =>
      doctorId
        ? doctorApi.appointments.listByDoctor(doctorId, params)
        : doctorApi.appointments.listAll(params),
    [doctorId, scope, dateValue, appointmentQueryStatus],
    [],
      { fallbackMessage: 'Không thể tải lịch hẹn trực tiếp.' },
  )
  const [appointmentSummaryState, reloadAppointmentSummary] = useAsyncResource(
    async () => (scope === 'day' ? doctorApi.appointments.getSummary({ doctor_id: doctorId, date: params.date }) : null),
    [doctorId, scope, params.date, params.date_from, params.date_to],
    null,
    { fallbackMessage: 'Không thể tải tổng quan lịch hẹn.' },
  )

  const appointments = safeArray(appointmentsState.data)
  const visibleAppointments = useMemo(
    () => filterAppointmentsByWorklist(appointments, worklistView, status),
    [appointments, worklistView, status],
  )
  const patientMap = usePatientMap(visibleAppointments.map((item) => item.patient_id))
  const sortedAppointments = useMemo(
    () =>
      visibleAppointments
        .slice()
        .sort((left, right) => {
          const leftTime = new Date(left.appointment_time || left.created_at || 0).getTime()
          const rightTime = new Date(right.appointment_time || right.created_at || 0).getTime()
          return leftTime - rightTime
        }),
    [visibleAppointments],
  )
  const appointmentSummary = appointmentSummaryState.data || {}
  const appointmentSummaryMetrics =
    scope === 'day' && appointmentSummaryState.data
      ? {
          total: appointmentSummary.total ?? sortedAppointments.length,
          pending: (appointmentSummary.booked ?? 0) + (appointmentSummary.confirmed ?? 0),
          checked_in: appointmentSummary.checked_in ?? 0,
          in_consultation: appointmentSummary.in_consultation ?? 0,
          completed: appointmentSummary.completed ?? 0,
        }
      : {
          total: sortedAppointments.length,
          pending: sortedAppointments.filter((item) => ['booked', 'confirmed'].includes(item.status)).length,
          checked_in: sortedAppointments.filter((item) => item.status === 'checked_in').length,
          in_consultation: sortedAppointments.filter((item) => item.status === 'in_consultation').length,
          completed: sortedAppointments.filter((item) => item.status === 'completed').length,
        }

  useEffect(() => {
    if (!selectedId) {
      setDetailState({ loading: false, error: '', data: null })
      return
    }

    let active = true

    async function loadDetail() {
      setDetailState({ loading: true, error: '', data: null })

      try {
        const payload = await doctorApi.appointments.getDetail(selectedId)
        if (active) {
          setDetailState({ loading: false, error: '', data: payload })
        }
      } catch (error) {
        if (active) {
          setDetailState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải chi tiết lịch hẹn.'),
            data: null,
          })
        }
      }
    }

    loadDetail()

    return () => {
      active = false
    }
  }, [detailRefreshToken, selectedId])

  function handleAppointmentAction(action, appointmentId) {
    if (
      !guardDoctorAction({
        allowed: capabilities.canAppointmentActions,
        toast,
        permission: 'appointments.write',
      })
    ) {
      return
    }

    setDialog({ action, id: appointmentId })
  }

  async function commitAppointmentAction(action, appointmentId) {
    if (
      !guardDoctorAction({
        allowed: capabilities.canAppointmentActions,
        toast,
        permission: 'appointments.write',
      })
    ) {
      setDialog(null)
      return
    }

    setBusy(true)
    try {
      if (action === 'confirm') {
        await doctorApi.appointments.confirm(appointmentId)
      }
      if (action === 'no-show') {
        await doctorApi.appointments.noShow(appointmentId)
      }
      if (action === 'complete') {
        await doctorApi.appointments.complete(appointmentId)
      }
      notifyDoctorSuccess(
        toast,
        action === 'confirm'
          ? 'Đã xác nhận lịch hẹn.'
          : action === 'no-show'
            ? 'Đã đánh dấu bệnh nhân không đến.'
            : 'Đã hoàn tất lịch hẹn.',
        'Lịch hẹn đã cập nhật',
      )
      refreshAppointmentsWorkspace()
      setDialog(null)
    } catch (error) {
      handleDoctorApiError(error, toast, 'Thao tác lịch hẹn thất bại.', { permission: 'appointments.write' })
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenEncounter(appointment) {
    const existingEncounterId = appointment.encounter_id || appointment.related_encounter_id
    if (existingEncounterId) {
      navigate(`/doctor/encounters/${existingEncounterId}`)
      return
    }

    const currentStatus = String(appointment.status || '').toLowerCase()
    if (['completed', 'cancelled', 'no_show'].includes(currentStatus)) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Không thể mở phiên khám',
        message:
          'Lịch hẹn đã kết thúc nên không thể tạo phiên khám mới. Chỉ có thể mở phiên khám đã liên kết nếu đã tồn tại.',
      })
      return
    }

    setBusy(true)
    try {
      const created = await doctorApi.encounters.createFromAppointment(appointment.appointment_id || appointment.id)
      const encounterId = created?.encounter?.encounter_id || created?.encounter_id || created?.id
      if (encounterId) {
        notifyDoctorSuccess(toast, 'Đã tạo phiên khám từ lịch hẹn và chuyển sang hồ sơ khám.', 'Phiên khám đã sẵn sàng')
        refreshAppointmentsWorkspace()
        navigate(`/doctor/encounters/${encounterId}`)
      }
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể tạo hoặc mở phiên khám từ lịch hẹn.', {
        permission: 'encounters.write',
      })
    } finally {
      setBusy(false)
    }
  }

  const selectedAppointment =
    detailState.data || sortedAppointments.find((item) => (item.appointment_id || item.id) === selectedId) || null
  const selectedPatient =
    patientMap[selectedAppointment?.patient_id] ||
    selectedAppointment?.patient ||
    null
  const selectedPatientName =
    selectedPatient?.full_name ||
    selectedAppointment?.patient_name ||
    selectedAppointment?.patient_id ||
    'Chưa rõ bệnh nhân'
  const selectedAppointmentId = selectedAppointment?.appointment_id || selectedAppointment?.id || selectedId
  const [appointmentTimelineState, reloadAppointmentTimeline] = useAsyncResource(
    async () => (selectedAppointmentId ? doctorApi.appointments.getTimeline(selectedAppointmentId) : []),
    [selectedAppointmentId],
    [],
    { fallbackMessage: 'Không thể tải timeline lịch hẹn từ backend.' },
  )
  const [appointmentChecksState, reloadAppointmentChecks] = useAsyncResource(
    async () => (selectedAppointmentId ? doctorApi.appointments.getReadChecks(selectedAppointmentId) : null),
    [selectedAppointmentId],
    null,
    { fallbackMessage: 'Không thể tải can-* lịch hẹn.' },
  )
  const backendAppointmentTimeline = safeArray(appointmentTimelineState.data)
  const appointmentChecks = appointmentChecksState.data || null

  useEffect(() => {
    const requestedAppointmentId = location.state?.selectedAppointmentId
    const focusDate = location.state?.focusDate
    const selectedStatus = location.state?.selectedStatus
    const nextWorklistView = location.state?.worklistView

    if (!requestedAppointmentId && !focusDate && !selectedStatus && !nextWorklistView) {
      return
    }

    if (focusDate) {
      setScope('day')
      setDateValue(toLocalDateKey(focusDate))
    }
    if (nextWorklistView) {
      setWorklistView(nextWorklistView)
    }
    if (selectedStatus) {
      setStatus(selectedStatus)
    }
    if (requestedAppointmentId) {
      setSelectedId(requestedAppointmentId)
    }

    navigate('/doctor/appointments', { replace: true, state: {} })
  }, [location.state, navigate])

  function refreshAppointmentsWorkspace() {
    reloadAppointments()
    reloadAppointmentSummary()
    reloadAppointmentTimeline()
    reloadAppointmentChecks()
    setDetailRefreshToken((current) => current + 1)
  }

  const appointmentStatusTabs = [
    { value: 'all', label: 'Tất cả' },
    { value: 'booked', label: 'Đã đặt' },
    { value: 'confirmed', label: 'Đã xác nhận' },
    { value: 'checked_in', label: 'Đã check-in' },
    { value: 'in_consultation', label: 'Đang khám' },
  ]
  const appointmentWorklistTabs = [
    { value: 'active', label: 'Cần khám', description: 'Chưa xong' },
    { value: 'completed', label: 'Đã hoàn tất', description: 'completed' },
  ]

  function isAppointmentActionDisabled(action, appointment) {
    const currentStatus = String(appointment?.status || '').toLowerCase()

    if (action === 'confirm') {
      return ['confirmed', 'checked_in', 'in_consultation', 'completed', 'no_show', 'cancelled'].includes(currentStatus)
    }

    if (action === 'no-show') {
      return ['completed', 'no_show', 'cancelled'].includes(currentStatus)
    }

    if (action === 'complete') {
      return ['completed', 'no_show', 'cancelled'].includes(currentStatus)
    }

    return false
  }

  function getAppointmentPatient(appointment) {
    return patientMap[appointment.patient_id] || appointment.patient || null
  }

  function getAppointmentPatientName(appointment) {
    const patient = getAppointmentPatient(appointment)
    return patient?.full_name || appointment.patient_name || appointment.patient_id || 'Chưa rõ bệnh nhân'
  }

  function getAppointmentPatientMeta(appointment) {
    const patient = getAppointmentPatient(appointment)
    return [
      patient?.patient_code || appointment.patient_code || appointment.patient_id,
      patient?.date_of_birth ? calculatePatientAge(patient.date_of_birth) : '',
      patient?.gender || '',
    ].filter(Boolean)
  }

  function buildAppointmentTimeline(appointment) {
    if (!appointment) {
      return []
    }

    const currentStatus = String(appointment.status || '').toLowerCase()
    const isConfirmed = ['confirmed', 'checked_in', 'in_consultation', 'completed'].includes(currentStatus)
    const isCompleted = currentStatus === 'completed'
    const isNoShow = currentStatus === 'no_show'

    return [
      {
        title: 'Đã đặt lịch',
        description: appointment.source ? `Nguồn: ${appointment.source}` : 'Lịch hẹn đã được ghi nhận trên hệ thống.',
        time: appointment.created_at || appointment.appointment_time,
        state: 'done',
      },
      {
        title: isConfirmed ? 'Đã xác nhận' : 'Chờ xác nhận',
        description: isConfirmed ? 'Lịch hẹn đã được xác nhận.' : 'Lịch hẹn đang chờ xác nhận.',
        time: appointment.updated_at || appointment.appointment_time,
        state: isConfirmed ? 'done' : 'pending',
      },
      {
        title: isNoShow ? 'Không đến' : 'Chờ khám',
        description: isNoShow ? 'Bệnh nhân được đánh dấu không đến.' : 'Bệnh nhân đang trong luồng khám.',
        time: appointment.appointment_time,
        state: isNoShow ? 'danger' : isConfirmed ? 'done' : 'pending',
      },
      {
        title: isCompleted ? 'Hoàn tất' : 'Chờ hoàn tất',
        description: isCompleted ? 'Lịch hẹn đã hoàn tất.' : 'Hoàn tất sau khi bác sĩ kết thúc lượt khám.',
        time: appointment.updated_at || appointment.appointment_time,
        state: isCompleted ? 'done' : 'pending',
      },
    ]
  }

  return (
    <div className="doctor-page-stack doctor-appointments-page">
      <section className="doctor-appointment-summary-strip">
        <div className="doctor-kpi-tile">
          <strong>{appointmentSummaryState.loading && scope === 'day' ? '...' : appointmentSummaryMetrics.total}</strong>
          <span>Tổng lịch hẹn</span>
        </div>
        <div className="doctor-kpi-tile">
          <strong>{appointmentSummaryState.loading && scope === 'day' ? '...' : appointmentSummaryMetrics.pending}</strong>
          <span>Chờ / xác nhận</span>
        </div>
        <div className="doctor-kpi-tile">
          <strong>{appointmentSummaryState.loading && scope === 'day' ? '...' : appointmentSummaryMetrics.checked_in}</strong>
          <span>Đã check-in</span>
        </div>
        <div className="doctor-kpi-tile">
          <strong>{appointmentSummaryState.loading && scope === 'day' ? '...' : appointmentSummaryMetrics.in_consultation}</strong>
          <span>Đang khám</span>
        </div>
        <div className="doctor-kpi-tile">
          <strong>{appointmentSummaryState.loading && scope === 'day' ? '...' : appointmentSummaryMetrics.completed}</strong>
          <span>Hoàn tất</span>
        </div>
      </section>

      <section className="doctor-appointment-workspace">
        <SectionCard className="doctor-appointment-list-panel">
          <div className="doctor-appointment-list-command">
            <div className="doctor-appointment-list-command-copy">
              <span>Danh sách lịch hẹn</span>
              <strong>{sortedAppointments.length} lịch trong mục hiện tại</strong>
              <small>{worklistView === 'completed' ? 'Lịch đã hoàn tất chỉ dùng để xem lại, không tạo phiên khám mới.' : 'Chọn lịch hẹn đang xử lý để xem ngữ cảnh bệnh nhân và mở phiên khám.'}</small>
            </div>
            <span className="doctor-appointment-sync-pill">Dữ liệu API trực tiếp</span>
          </div>

          <div className="doctor-appointment-status-tabs doctor-worklist-tabs" role="tablist" aria-label="Nhóm lịch hẹn">
            {appointmentWorklistTabs.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`doctor-appointment-status-tab${worklistView === item.value ? ' is-active' : ''}`}
                onClick={() => {
                  setWorklistView(item.value)
                  setStatus('all')
                  setSelectedId('')
                }}
              >
                <span>{item.label}</span>
                <strong>{item.description}</strong>
              </button>
            ))}
          </div>

          <div className="doctor-appointment-filter-bar">
            <label>
              <span>Phạm vi</span>
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option value="day">Ngày</option>
                <option value="week">Tuần</option>
              </select>
            </label>
            <label>
              <span>Ngày</span>
              <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
            </label>
            {worklistView === 'active' ? (
              <label>
                <span>Trạng thái</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="all">Tất cả trạng thái đang xử lý</option>
                    <option value="booked">Đã đặt</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="checked_in">Đã check-in</option>
                    <option value="in_consultation">Đang khám</option>
                  </select>
              </label>
            ) : (
              <SurfaceHint tone="neutral">Danh sách đã hoàn tất chỉ để xem lại từ backend.</SurfaceHint>
            )}
            <button className="doctor-secondary-button doctor-filter-chip-button" type="button" onClick={reloadAppointments}>
              Làm mới
            </button>
          </div>

          {worklistView === 'active' ? (
          <div className="doctor-appointment-status-tabs" role="tablist" aria-label="Lọc trạng thái lịch hẹn">
            {appointmentStatusTabs.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`doctor-appointment-status-tab${status === item.value ? ' is-active' : ''}`}
                onClick={() => setStatus(item.value)}
              >
                <span>{item.label}</span>
                <strong>
                  {item.value === 'all'
                    ? visibleAppointments.length
                    : visibleAppointments.filter((appointment) => appointment.status === item.value).length}
                </strong>
              </button>
            ))}
          </div>
          ) : null}

          {appointmentsState.loading ? <LoadingState label="Đang tải lịch hẹn..." /> : null}
          {appointmentsState.error && !appointments.length ? (
            <ErrorState title="Không thể tải lịch hẹn" message={appointmentsState.error} onRetry={reloadAppointments} />
          ) : null}
          {!appointmentsState.loading && sortedAppointments.length === 0 ? (
            <div className="doctor-appointment-empty-state">
              <EmptyState
                title={worklistView === 'completed' ? 'Chưa có lịch hẹn đã hoàn tất' : 'Không có lịch hẹn cần xử lý'}
                description={worklistView === 'completed' ? 'Các lịch hẹn completed sẽ được đưa vào đây để xem lại.' : 'Lịch hẹn completed không hiển thị trong danh sách đang xử lý.'}
              />
            </div>
          ) : null}
          {!appointmentsState.loading && sortedAppointments.length > 0 ? (
            <div className="doctor-appointment-list">
              {sortedAppointments.map((appointment) => {
                const appointmentId = appointment.appointment_id || appointment.id
                const patient = getAppointmentPatient(appointment)
                const patientName = getAppointmentPatientName(appointment)
                const patientMeta = getAppointmentPatientMeta(appointment)
                const isSelected = selectedId === appointmentId
                const linkedEncounterId = appointment.encounter_id || appointment.related_encounter_id
                const canOpenEncounter = worklistView === 'active' || Boolean(linkedEncounterId)

                return (
                  <article
                    key={appointmentId}
                    role="button"
                    tabIndex={0}
                    className={`doctor-appointment-card${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(appointmentId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedId(appointmentId)
                      }
                    }}
                  >
                    <div className="doctor-appointment-time-block">
                      <strong>{formatTime(appointment.appointment_time)}</strong>
                      <span>{formatDate(appointment.appointment_time, { year: undefined })}</span>
                    </div>

                    <div className="doctor-appointment-patient-block">
                      <span className="doctor-patient-chip">{getInitials(patientName) || 'PT'}</span>
                      <div>
                        <strong>{patientName}</strong>
                        <p>{patientMeta.join(' | ') || appointment.patient_id || '--'}</p>
                        <small>{appointment.appointment_type || appointment.visit_type || '--'}</small>
                      </div>
                    </div>

                    <div className="doctor-appointment-status-block">
                      <StatusBadge status={appointment.status || ''} />
                      <span>{appointment.reason || appointment.source || 'Không có lý do khám'}</span>
                    </div>

                    <div className="doctor-appointment-card-actions">
                      <button
                        className="doctor-secondary-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedId(appointmentId)
                        }}
                      >
                        Xem
                      </button>
                      <button
                        className="doctor-secondary-button doctor-appointment-open-encounter"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleOpenEncounter(appointment)
                        }}
                        disabled={busy || !canOpenEncounter}
                      >
                        {linkedEncounterId ? 'Xem phiên khám' : 'Mở phiên khám'}
                      </button>
                      {capabilities.canAppointmentActions && worklistView === 'active' ? (
                        <details className="doctor-appointment-more-menu" onClick={(event) => event.stopPropagation()}>
                          <summary aria-label="Thao tác khác">...</summary>
                          <div className="doctor-appointment-more-menu-content">
                          <button
                            className="doctor-secondary-button"
                            type="button"
                            disabled={busy || isAppointmentActionDisabled('confirm', appointment)}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleAppointmentAction('confirm', appointmentId)
                            }}
                          >
                            Xác nhận
                          </button>
                          <button
                            className="doctor-secondary-button doctor-button-danger-soft"
                            type="button"
                            disabled={busy || isAppointmentActionDisabled('no-show', appointment)}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleAppointmentAction('no-show', appointmentId)
                            }}
                          >
                            Không đến
                          </button>
                          <button
                            className="doctor-primary-button doctor-primary-green"
                            type="button"
                            disabled={busy || isAppointmentActionDisabled('complete', appointment)}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleAppointmentAction('complete', appointmentId)
                            }}
                          >
                            Hoàn tất
                          </button>
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Xem trước lịch hẹn" subtitle="Ngữ cảnh lịch hẹn đã chọn cho ca đang xem." className="doctor-appointment-preview-panel">
          {!selectedId && !detailState.loading ? (
            <div className="doctor-appointment-preview-empty">
              <EmptyState title="Chọn một lịch hẹn" description="Hãy chọn một lịch hẹn trong danh sách để xem chi tiết, thao tác nhanh và dòng thời gian." />
            </div>
          ) : null}
          {detailState.loading ? <LoadingState label="Đang tải chi tiết lịch hẹn..." /> : null}
          {detailState.error ? <ErrorState title="Không thể tải chi tiết lịch hẹn" message={detailState.error} /> : null}
          {selectedAppointment ? (
            <div className="doctor-appointment-preview">
              <div className="doctor-appointment-preview-hero">
                <span className="doctor-patient-chip doctor-appointment-preview-avatar">{getInitials(selectedPatientName) || 'PT'}</span>
                <div>
                  <h3>{selectedPatientName}</h3>
                  <p>
                    {[
                      selectedPatient?.patient_code || selectedAppointment.patient_code || selectedAppointment.patient_id,
                      selectedPatient?.date_of_birth ? calculatePatientAge(selectedPatient.date_of_birth) : '',
                      selectedPatient?.gender || '',
                    ].filter(Boolean).join(' | ') || '--'}
                  </p>
                </div>
                <StatusBadge status={selectedAppointment.status || ''} />
              </div>

              <div className="doctor-appointment-info-card">
                <h4>Thông tin lịch hẹn</h4>
                <div className="doctor-appointment-info-grid">
                  <div><span>Thời gian khám</span><strong>{formatTime(selectedAppointment.appointment_time)}</strong><small>{formatDate(selectedAppointment.appointment_time)}</small></div>
                  <div><span>Loại khám</span><strong>{selectedAppointment.appointment_type || selectedAppointment.visit_type || '--'}</strong></div>
                  <div><span>Lý do khám</span><strong>{selectedAppointment.reason || selectedAppointment.note || '--'}</strong></div>
                  <div><span>Nguồn</span><strong>{selectedAppointment.source || '--'}</strong></div>
                  <div><span>Nhóm máu</span><strong>{selectedPatient?.blood_type || '--'}</strong></div>
                  <div><span>Ghi chú</span><strong>{selectedAppointment.note || 'Không có ghi chú'}</strong></div>
                </div>
              </div>

              <div className="doctor-appointment-quick-actions">
                <button className="doctor-secondary-button" type="button" onClick={() => setSelectedId(selectedAppointmentId)}>
                  Xem chi tiết
                </button>
                {(worklistView === 'active' || selectedAppointment.encounter_id || selectedAppointment.related_encounter_id) ? (
                  <button className="doctor-primary-button" type="button" onClick={() => handleOpenEncounter(selectedAppointment)} disabled={busy}>
                    {selectedAppointment.encounter_id || selectedAppointment.related_encounter_id ? 'Xem phiên khám' : 'Mở phiên khám'}
                  </button>
                ) : null}
                {capabilities.canAppointmentActions && worklistView === 'active' ? (
                  <button
                    className="doctor-primary-button doctor-primary-green"
                    type="button"
                    disabled={busy || isAppointmentActionDisabled('complete', selectedAppointment)}
                    onClick={() => handleAppointmentAction('complete', selectedAppointmentId)}
                  >
                    Hoàn tất khám
                  </button>
                ) : null}
              </div>

              <div className="doctor-appointment-timeline-card">
                <h4>Timeline lịch hẹn</h4>
                {appointmentChecksState.loading ? <LoadingState label="Đang tải điều kiện lịch hẹn..." /> : null}
                {appointmentChecks ? (
                  <div className="doctor-kpi-mini-grid">
                    <div className="doctor-kpi-tile"><strong>{appointmentChecks.canUpdate?.can_update ? 'Có' : 'Không'}</strong><span>Có thể cập nhật</span></div>
                    <div className="doctor-kpi-tile"><strong>{appointmentChecks.canCancel?.can_cancel ? 'Có' : 'Không'}</strong><span>Có thể hủy</span></div>
                    <div className="doctor-kpi-tile"><strong>{appointmentChecks.canReschedule?.can_reschedule ? 'Có' : 'Không'}</strong><span>Có thể dời lịch</span></div>
                    <div className="doctor-kpi-tile"><strong>{appointmentChecks.canCheckIn?.can_check_in ? 'Có' : 'Không'}</strong><span>Có thể check-in</span></div>
                  </div>
                ) : null}
                {appointmentChecksState.error ? <SurfaceHint tone="warning">{appointmentChecksState.error}</SurfaceHint> : null}
                {appointmentTimelineState.loading ? <LoadingState label="Đang tải timeline lịch hẹn..." /> : null}
                <div className="doctor-appointment-timeline">
                  {(backendAppointmentTimeline.length ? backendAppointmentTimeline : buildAppointmentTimeline(selectedAppointment)).map((item, index) => (
                    <article key={item.event_id || item.id || item.title || index} className={`doctor-appointment-timeline-item is-${item.state || 'pending'}`}>
                      <span className="doctor-appointment-timeline-dot" />
                      <div>
                        <strong>{item.title || item.event_type || 'Sự kiện lịch hẹn'}</strong>
                        <p>{item.description || item.note || item.status || '--'}</p>
                      </div>
                      <small>{item.time || item.created_at || item.event_time ? formatDate(item.time || item.created_at || item.event_time) : '--'}</small>
                    </article>
                  ))}
                </div>
              </div>

              <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/patients/${selectedAppointment.patient_id}`)}>
                Xem hồ sơ bệnh nhân
              </button>
            </div>
          ) : null}
        </SectionCard>
      </section>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title="Cập nhật trạng thái lịch hẹn?"
        description="Thao tác này sẽ áp dụng thay đổi vòng đời lịch hẹn phía bác sĩ thông qua backend API."
        confirmLabel="Áp dụng thay đổi trạng thái"
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitAppointmentAction(dialog?.action, dialog?.id)}
      />
    </div>
  )
}

export function DoctorSchedulesScreen({ user }) {
  const capabilities = getDoctorCapabilities(user)
  const doctorId = getDoctorId(user)
  const [view, setView] = useState('month')
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const calendarParams = useMemo(() => getScheduleRangeParams(view, selectedDate), [view, selectedDate])
  const dayParams = useMemo(
    () => ({ date_from: selectedDate, date_to: selectedDate }),
    [selectedDate],
  )

  const [calendarState] = useAsyncResource(
    async () =>
      doctorId
        ? doctorApi.schedules.getByDoctor(doctorId, calendarParams)
        : doctorApi.schedules.listAll(calendarParams),
    [doctorId, calendarParams.date_from, calendarParams.date_to],
    [],
      { fallbackMessage: 'Không thể tải lịch dạng lịch.' },
  )
  const [scheduleState] = useAsyncResource(
    async () =>
      doctorId
        ? doctorApi.schedules.getByDoctor(doctorId, dayParams)
        : doctorApi.schedules.listAll(dayParams),
    [doctorId, dayParams.date_from, dayParams.date_to],
    [],
      { fallbackMessage: 'Không thể tải lịch làm việc theo ngày.' },
  )
  const [myTodayState] = useAsyncResource(
    async () => doctorApi.schedules.myToday(),
    [],
    [],
    { fallbackMessage: 'Không thể tải lịch hôm nay của tôi.' },
  )
  const [myWeekState] = useAsyncResource(
    async () => doctorApi.schedules.myWeek(),
    [],
    [],
    { fallbackMessage: 'Không thể tải lịch tuần này của tôi.' },
  )

  const schedules = safeArray(calendarState.data)
  const myTodaySchedules = safeArray(myTodayState.data)
  const myWeekSchedules = safeArray(myWeekState.data)
  const daySchedules = buildScheduleBuckets(scheduleState.data, selectedDate)

  useEffect(() => {
    const hasSelectedSchedule = daySchedules.some((item) => {
      const scheduleId = item.doctor_schedule_id || item.schedule_id
      return scheduleId === selectedScheduleId
    })

    if (hasSelectedSchedule) {
      return
    }

    if (daySchedules[0]) {
      setSelectedScheduleId(daySchedules[0].doctor_schedule_id || daySchedules[0].schedule_id)
      return
    }

    setSelectedScheduleId('')
  }, [daySchedules, selectedScheduleId])

  const [slotsState] = useAsyncResource(
    async () => (selectedScheduleId ? doctorApi.schedules.getSlots(selectedScheduleId) : []),
    [selectedScheduleId],
    [],
      { fallbackMessage: 'Không thể tải khung giờ làm việc.' },
  )
  const [bookedSlotsState] = useAsyncResource(
    async () => (selectedScheduleId ? doctorApi.schedules.getBookedSlots(selectedScheduleId) : []),
    [selectedScheduleId],
    [],
    { fallbackMessage: 'Không thể tải lịch hẹn đã đặt của ca.' },
  )

  const slots = safeArray(slotsState.data)
  const bookedSlots = safeArray(bookedSlotsState.data)
  const calendarDays = useMemo(() => getCalendarDays(selectedDate, schedules, view), [selectedDate, schedules, view])
  const [summaryState] = useAsyncResource(
    async () => (selectedScheduleId ? doctorApi.schedules.getSummary(selectedScheduleId) : null),
    [selectedScheduleId],
    null,
    { fallbackMessage: 'Không thể tải tổng quan ca làm việc.' },
  )
  const [utilizationState] = useAsyncResource(
    async () => (selectedScheduleId ? doctorApi.schedules.getUtilization(selectedScheduleId) : null),
    [selectedScheduleId],
    null,
    { fallbackMessage: 'Không thể tải mức sử dụng ca làm việc.' },
  )
  const [activityState] = useAsyncResource(
    async () => (selectedScheduleId ? doctorApi.schedules.getActivity(selectedScheduleId) : []),
    [selectedScheduleId],
    [],
    { fallbackMessage: 'Không thể tải hoạt động ca làm việc.' },
  )
  const [scheduleChecksState] = useAsyncResource(
    async () => {
      if (!selectedScheduleId) {
        return null
      }

      const [canUpdate, canCancel, futureAppointments] = await Promise.all([
        doctorApi.schedules.getCanUpdate(selectedScheduleId),
        doctorApi.schedules.getCanCancel(selectedScheduleId),
        doctorApi.schedules.getFutureAppointments(selectedScheduleId),
      ])

      return {
        canUpdate,
        canCancel,
        futureAppointments,
      }
    },
    [selectedScheduleId],
    null,
    { fallbackMessage: 'Không thể tải điều kiện lịch làm việc.' },
  )
  const scheduleSummary = summaryState.data || {}
  const utilization = utilizationState.data || {}
  const activities = safeArray(activityState.data)
  const scheduleChecks = scheduleChecksState.data || null
  const selectedSchedule =
    daySchedules.find((item) => (item.doctor_schedule_id || item.schedule_id) === selectedScheduleId) || null
  const slotsSummary = scheduleSummary.slots_summary || scheduleSummary
  const summaryMetrics = [
    { label: 'Tổng slot', value: slotsSummary.total_slots ?? slots.length },
    { label: 'Đã đặt', value: slotsSummary.booked_slots ?? bookedSlots.length ?? slots.filter((slot) => slot.is_booked).length },
    { label: 'Còn trống', value: slotsSummary.available_slots ?? slots.filter((slot) => slot.is_available).length },
    { label: 'Đã chặn', value: slotsSummary.blocked_slots ?? slots.filter((slot) => slot.is_blocked).length },
  ]
  const utilizationRate = utilization.utilization_rate ?? utilization.rate ?? slotsSummary.utilization_rate ?? '--'

  return (
    <div className="doctor-dashboard-grid doctor-schedule-layout">
        <SectionCard
          title="Lịch làm việc"
          subtitle="Lịch chỉ đọc cho các ca trực trong khoảng thời gian đã chọn."
          actions={!capabilities.scheduleRead ? <SurfaceHint tone="warning">Quyền xem lịch bị giới hạn</SurfaceHint> : <SurfaceHint>Chỉ xem</SurfaceHint>}
        >
        <div className="doctor-kpi-mini-grid">
          <div className="doctor-kpi-tile"><strong>{safeArray(myTodayState.data).length}</strong><span>Lịch hôm nay</span></div>
          <div className="doctor-kpi-tile"><strong>{safeArray(myWeekState.data).length}</strong><span>Lịch tuần này</span></div>
          <div className="doctor-kpi-tile"><strong>{utilizationRate}</strong><span>Tải ca</span></div>
        </div>
        <div className="doctor-filter-bar">
          <label>
              <span>Chế độ xem</span>
              <select value={view} onChange={(event) => setView(event.target.value)}>
                <option value="month">Tháng</option>
                <option value="week">Tuần</option>
              </select>
            </label>
            <label>
              <span>Ngày</span>
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </div>
          {calendarState.loading ? <LoadingState label="Đang tải lịch..." /> : null}
        <div className={`doctor-calendar-grid${view === 'week' ? ' is-week' : ''}`}>
          {calendarDays.map((day) => (
            <button
              key={day.dateKey}
              className={`doctor-calendar-cell${selectedDate === day.dateKey ? ' is-selected' : ''}${day.isCurrentMonth ? '' : ' is-muted'}`}
              type="button"
              onClick={() => setSelectedDate(day.dateKey)}
            >
              <span>{day.date.getDate()}</span>
              {day.count > 0 ? <small>{day.count} ca được phân công</small> : <small>Không có ca</small>}
            </button>
          ))}
        </div>
        <div className="doctor-calendar-legend">
          <span><i className="is-blue" /> Ca thường</span>
          <span><i className="is-teal" /> Trực</span>
          <span><i className="is-red" /> Đã chặn / Vắng mặt</span>
        </div>
        <div className="doctor-overview-panel">
          <div>
            <h4>Hôm nay của tôi</h4>
            {myTodayState.loading ? <LoadingState label="Đang tải lịch hôm nay..." /> : null}
            {myTodayState.error ? <SurfaceHint tone="warning">{myTodayState.error}</SurfaceHint> : null}
            {!myTodayState.loading && !myTodaySchedules.length ? <SurfaceHint>Hôm nay chưa có ca làm việc nào.</SurfaceHint> : null}
            {myTodaySchedules.length ? (
              <div className="doctor-list-stack">
                {myTodaySchedules.slice(0, 3).map((schedule, index) => (
                  <div key={schedule.doctor_schedule_id || index} className="doctor-list-row">
                    <div>
                      <strong>{schedule.department_name || 'Ca làm việc'}</strong>
                      <p>{formatTime(schedule.shift_start)} - {formatTime(schedule.shift_end)}</p>
                    </div>
                    <StatusBadge status={schedule.status || 'active'} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <h4>Tuần này của tôi</h4>
            {myWeekState.loading ? <LoadingState label="Đang tải lịch tuần..." /> : null}
            {myWeekState.error ? <SurfaceHint tone="warning">{myWeekState.error}</SurfaceHint> : null}
            {!myWeekState.loading && !myWeekSchedules.length ? <SurfaceHint>Tuần này chưa có lịch được phân công.</SurfaceHint> : null}
            {myWeekSchedules.length ? (
              <div className="doctor-list-stack">
                {myWeekSchedules.slice(0, 4).map((schedule, index) => (
                  <div key={schedule.doctor_schedule_id || index} className="doctor-list-row">
                    <div>
                      <strong>{formatDate(schedule.shift_start, { year: undefined })}</strong>
                      <p>{formatTime(schedule.shift_start)} - {formatTime(schedule.shift_end)}</p>
                    </div>
                    <span>{schedule.department_name || schedule.shift_type || '--'}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={formatDate(selectedDate)} subtitle="Phân rã khung giờ chỉ đọc cho ngày đã chọn.">
        {daySchedules.length === 0 ? (
          <EmptyState title="Không có lịch vào ngày này" description="Bác sĩ không có ca được phân công trong ngày đã chọn." />
        ) : (
          <div className="doctor-panel-stack">
            {selectedSchedule ? (
              <div className="doctor-overview-panel">
                <div>
                  <h4>Ca đang xem</h4>
                  <p>{selectedSchedule.department_name || selectedSchedule.shift_type || 'Ca làm việc'}</p>
                  <p>{formatTime(selectedSchedule.shift_start)} - {formatTime(selectedSchedule.shift_end)}</p>
                </div>
                <div>
                  <h4>Trạng thái</h4>
                  <StatusBadge status={selectedSchedule.status || 'active'} />
                </div>
              </div>
            ) : null}
            <div className="doctor-kpi-mini-grid">
              {summaryMetrics.map((metric) => (
                <div key={metric.label} className="doctor-kpi-tile"><strong>{metric.value ?? '--'}</strong><span>{metric.label}</span></div>
              ))}
            </div>
            {summaryState.error ? <SurfaceHint tone="warning">{summaryState.error}</SurfaceHint> : null}
            {utilizationState.error ? <SurfaceHint tone="warning">{utilizationState.error}</SurfaceHint> : null}
            {activityState.error ? <SurfaceHint tone="warning">{activityState.error}</SurfaceHint> : null}
            {summaryState.data || utilizationState.data ? (
              <div className="doctor-overview-panel">
                <div>
                  <h4>Tổng quan ca trực</h4>
                  <div className="doctor-list-stack">
                    {summaryMetrics.map((metric) => (
                      <div key={metric.label} className="doctor-list-row">
                        <span>{metric.label}</span>
                        <strong>{metric.value ?? '--'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>Sẵn sàng vận hành</h4>
                  <p>Tải ca hiện tại: <strong>{utilizationRate}</strong></p>
                  {scheduleChecks ? (
                    <div className="doctor-list-stack">
                      <div className="doctor-list-row">
                        <span>Có thể cập nhật</span>
                        <strong>{scheduleChecks.canUpdate?.can_update ? 'Có' : 'Không'}</strong>
                      </div>
                      <div className="doctor-list-row">
                        <span>Có thể hủy</span>
                        <strong>{scheduleChecks.canCancel?.can_cancel ? 'Có' : 'Không'}</strong>
                      </div>
                      <div className="doctor-list-row">
                        <span>Lịch hẹn tương lai</span>
                        <strong>{scheduleChecks.futureAppointments?.future_appointments_count ?? 0}</strong>
                      </div>
                      <div className="doctor-list-row">
                        <span>Còn lịch hẹn tương lai</span>
                        <strong>{scheduleChecks.futureAppointments?.has_future_appointments ? 'Có' : 'Không'}</strong>
                      </div>
                    </div>
                  ) : null}
                  {scheduleChecksState.error ? <SurfaceHint tone="warning">{scheduleChecksState.error}</SurfaceHint> : null}
                </div>
                <div>
                  <h4>Hoạt động gần nhất</h4>
                  {activities.length ? (
                    <div className="doctor-list-stack">
                      {activities.slice(0, 4).map((activity, index) => (
                        <div key={activity.audit_log_id || activity.id || index} className="doctor-list-row">
                          <div>
                            <strong>{activity.action || activity.event_type || 'Hoạt động lịch'}</strong>
                            <p>{activity.message || activity.description || '--'}</p>
                          </div>
                          <span>{activity.created_at ? formatDate(activity.created_at) : '--'}</span>
                        </div>
                      ))}
                    </div>
                  ) : <SurfaceHint>Chưa có hoạt động nào cho ca đã chọn.</SurfaceHint>}
                </div>
              </div>
            ) : null}

            <div className="doctor-list-stack">
              {daySchedules.map((schedule) => {
                const scheduleId = schedule.doctor_schedule_id || schedule.schedule_id
                return (
                  <button
                    key={scheduleId}
                    className={`doctor-list-row doctor-list-select${selectedScheduleId === scheduleId ? ' is-selected' : ''}`}
                    type="button"
                    onClick={() => setSelectedScheduleId(scheduleId)}
                  >
                    <div>
                      <strong>{schedule.department_name || '--'}</strong>
                      <p>{formatTime(schedule.shift_start)} - {formatTime(schedule.shift_end)}</p>
                    </div>
                    <span>{schedule.shift_type || '--'}</span>
                  </button>
                )
              })}
            </div>

            {slotsState.loading ? <LoadingState label="Đang tải khung giờ..." /> : null}
            {slotsState.error ? <ErrorState title="Không thể tải khung giờ" message={slotsState.error} /> : null}
            {!slotsState.loading && !slots.length ? (
              <EmptyState title="Chưa có khung giờ" description="Ca làm việc này chưa sinh ra danh sách slot để hiển thị." />
            ) : null}
            {slots.length ? (
              <div className="doctor-list-stack">
                {slots.map((slot) => (
                  <div key={slot.slot_time} className="doctor-slot-row">
                    <div className="doctor-slot-dot" />
                    <div>
                      <strong>{formatTime(slot.slot_time)}</strong>
                      <p>{slot.patient_name || 'Chưa có lịch hẹn nào'}</p>
                    </div>
                    <StatusBadge status={slot.is_blocked ? 'blocked' : slot.is_booked ? 'booked' : 'available'} />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="doctor-overview-panel">
              <div>
                <h4>Lịch hẹn đã đặt ({bookedSlots.length})</h4>
                <p>Danh sách lịch hẹn đã đặt, chỉ đọc từ backend.</p>
              </div>
              <div>
              {bookedSlotsState.loading ? <LoadingState label="Đang tải lịch hẹn đã đặt..." /> : null}
              {bookedSlotsState.error ? <ErrorState title="Không thể tải lịch hẹn đã đặt" message={bookedSlotsState.error} /> : null}
              {bookedSlots.length ? (
                <div className="doctor-list-stack">
                  {bookedSlots.map((slot) => (
                    <div key={slot.appointment_id || slot.slot_time} className="doctor-list-row">
                      <div>
                        <strong>{formatTime(slot.slot_time)}</strong>
                        <p>{slot.patient_name || slot.patient_code || slot.patient_id || '--'}</p>
                      </div>
                      <div className="doctor-inline-actions doctor-inline-actions-wrap">
                        <StatusBadge status={slot.status || 'booked'} />
                        {slot.appointment_id ? (
                          <button
                            className="doctor-secondary-button"
                            type="button"
                            onClick={() =>
                              navigate('/doctor/appointments', {
                                state: {
                                  selectedAppointmentId: slot.appointment_id,
                                  focusDate: slot.slot_time,
                                },
                              })
                            }
                          >
                            Mở lịch hẹn
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="Chưa có lịch hẹn đã đặt" description="Ca làm việc này hiện chưa có bệnh nhân đặt lịch." />}
              </div>
            </div>

          </div>
        )}
      </SectionCard>
    </div>
  )
}

export function DoctorPrescriptionsScreen({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const pageSize = 20
  const [status, setStatus] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setPage(1)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const query = useMemo(
    () => ({
      page,
      limit: pageSize,
      ...(status !== 'all' ? { status } : {}),
      ...(searchTerm ? { search: searchTerm } : {}),
    }),
    [page, searchTerm, status],
  )
  const [prescriptionsState, reloadPrescriptions] = useAsyncResource(
    async () => (doctorId && capabilities.canPrescriptionWrite ? doctorApi.prescriptions.listByDoctorPage(doctorId, query) : { items: [], pagination: null }),
    [doctorId, capabilities.canPrescriptionWrite, query],
    { items: [], pagination: null },
    { fallbackMessage: 'Không thể tải đơn thuốc của bác sĩ.' },
  )
  const [prescriptionSummaryState, reloadPrescriptionSummary] = useAsyncResource(
    async () => {
      if (!doctorId || !capabilities.canPrescriptionWrite) {
        return { total: 0, draft: 0, active: 0, completed: 0, cancelled: 0 }
      }

      const [total, draft, active, completed, cancelled] = await Promise.all([
        doctorApi.prescriptions.listByDoctorPage(doctorId, { limit: 1 }),
        doctorApi.prescriptions.listByDoctorPage(doctorId, { status: 'draft', limit: 1 }),
        doctorApi.prescriptions.listByDoctorPage(doctorId, { status: 'active', limit: 1 }),
        doctorApi.prescriptions.listByDoctorPage(doctorId, { status: 'completed', limit: 1 }),
        doctorApi.prescriptions.listByDoctorPage(doctorId, { status: 'cancelled', limit: 1 }),
      ])

      return {
        total: Number(total?.pagination?.total || 0),
        draft: Number(draft?.pagination?.total || 0),
        active: Number(active?.pagination?.total || 0),
        completed: Number(completed?.pagination?.total || 0),
        cancelled: Number(cancelled?.pagination?.total || 0),
      }
    },
    [doctorId, capabilities.canPrescriptionWrite],
    { total: 0, draft: 0, active: 0, completed: 0, cancelled: 0 },
    { fallbackMessage: 'Không thể tải thống kê đơn thuốc.' },
  )
  const prescriptions = safeArray(prescriptionsState.data?.items)
  const statusCounts = prescriptionSummaryState.data || { total: 0, draft: 0, active: 0, completed: 0, cancelled: 0 }
  const pagination = prescriptionsState.data?.pagination || null
  const currentPage = Number(pagination?.page || page)
  const totalPages = Math.max(Number(pagination?.total_pages || 1), 1)
  const [selectedPrescriptionState, reloadSelectedPrescription] = useAsyncResource(
    async () => (selectedPrescriptionId ? doctorApi.prescriptions.getDetail(selectedPrescriptionId) : null),
    [selectedPrescriptionId],
    null,
    { fallbackMessage: 'Không thể tải chi tiết đơn thuốc.' },
  )
  const [selectedPrescriptionSummaryState, reloadSelectedPrescriptionSummary] = useAsyncResource(
    async () => (selectedPrescriptionId ? doctorApi.prescriptions.getSummary(selectedPrescriptionId) : null),
    [selectedPrescriptionId],
    null,
    { fallbackMessage: 'Không thể tải tổng quan đơn thuốc.' },
  )
  const [selectedPrescriptionItemsState, reloadSelectedPrescriptionItems] = useAsyncResource(
    async () => (selectedPrescriptionId ? doctorApi.prescriptions.listItems(selectedPrescriptionId) : []),
    [selectedPrescriptionId],
    [],
    { fallbackMessage: 'Không thể tải danh sách thuốc trong đơn.' },
  )

  useEffect(() => {
    if (pagination && pagination.total_pages > 0 && page > pagination.total_pages) {
      setPage(pagination.total_pages)
    }
  }, [page, pagination])

  useEffect(() => {
    const requestedPrescriptionId = location.state?.selectedPrescriptionId
    if (!requestedPrescriptionId) {
      return
    }

    setSelectedPrescriptionId(requestedPrescriptionId)
    navigate('/doctor/prescriptions', { replace: true, state: {} })
  }, [location.state, navigate])

  useEffect(() => {
    if (!prescriptions.length) {
      setSelectedPrescriptionId('')
      return
    }

    const hasSelected = prescriptions.some((item) => (item.prescription_id || item.id) === selectedPrescriptionId)
    if (!hasSelected) {
      setSelectedPrescriptionId(prescriptions[0].prescription_id || prescriptions[0].id || '')
    }
  }, [prescriptions, selectedPrescriptionId])

  function openEncounterPrescription(prescription) {
    if (!prescription.encounter_id) {
      return
    }

    navigate(`/doctor/encounters/${prescription.encounter_id}?tab=prescription`, { state: { activeTab: 'prescription' } })
  }

  function refreshPrescriptionsWorkspace() {
    reloadPrescriptions()
    reloadPrescriptionSummary()
    reloadSelectedPrescription()
    reloadSelectedPrescriptionSummary()
    reloadSelectedPrescriptionItems()
  }

  const selectedPrescription =
    selectedPrescriptionState.data ||
    prescriptions.find((item) => (item.prescription_id || item.id) === selectedPrescriptionId) ||
    null
  const selectedPrescriptionSummary = selectedPrescriptionSummaryState.data || null
  const selectedPrescriptionItems = safeArray(selectedPrescriptionItemsState.data).length
    ? safeArray(selectedPrescriptionItemsState.data)
    : safeArray(selectedPrescription?.items)
  const selectedPrescriptionMetrics = selectedPrescriptionSummary
    ? [
        { label: 'Tổng item', value: selectedPrescriptionSummary.items_count ?? selectedPrescriptionItems.length },
        { label: 'Item active', value: selectedPrescriptionSummary.active_items_count ?? selectedPrescriptionItems.filter((item) => item.status === 'active').length },
        { label: 'Hoạt chất/thuốc', value: selectedPrescriptionSummary.total_medications ?? '--' },
      ]
    : [
        { label: 'Tổng item', value: selectedPrescriptionItems.length },
        { label: 'Item active', value: selectedPrescriptionItems.filter((item) => item.status === 'active').length },
        { label: 'Hoạt chất/thuốc', value: '--' },
      ]

  return (
    <div className="doctor-page-stack">
      <section className="doctor-page-heading">
        <div>
          <h2>Đơn thuốc của tôi</h2>
          <p>Theo dõi các prescription do bác sĩ hiện tại kê, lấy từ endpoint doctor-specific của backend.</p>
        </div>
        <button className="doctor-secondary-button" type="button" onClick={refreshPrescriptionsWorkspace}>
          Làm mới
        </button>
      </section>

      <div className="doctor-encounter-command-strip">
        <div className="doctor-kpi-tile"><strong>{prescriptionSummaryState.loading ? '...' : statusCounts.total}</strong><span>Tổng đơn</span></div>
        <div className="doctor-kpi-tile"><strong>{prescriptionSummaryState.loading ? '...' : statusCounts.draft}</strong><span>Bản nháp</span></div>
        <div className="doctor-kpi-tile"><strong>{prescriptionSummaryState.loading ? '...' : statusCounts.active}</strong><span>Đang active</span></div>
        <div className="doctor-kpi-tile"><strong>{prescriptionSummaryState.loading ? '...' : statusCounts.completed}</strong><span>Đã hoàn tất</span></div>
        <div className="doctor-kpi-tile"><strong>{prescriptionSummaryState.loading ? '...' : statusCounts.cancelled}</strong><span>Đã hủy</span></div>
      </div>

      <div className="doctor-two-column">
        <div className="doctor-panel-stack">
          <SectionCard
            title="Danh sách đơn thuốc"
            subtitle="Bác sĩ có thể lọc theo trạng thái, tìm theo mã đơn và chọn một đơn để xem sâu hơn."
            actions={!capabilities.canPrescriptionWrite ? <SurfaceHint tone="warning">Quyền đọc theo bác sĩ bị giới hạn</SurfaceHint> : null}
          >
            <div className="doctor-filter-bar doctor-filter-bar-split">
              <label>
                <span>Trạng thái</span>
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả trạng thái</option>
                  <option value="draft">Bản nháp</option>
                  <option value="active">Active</option>
                  <option value="verified">Verified</option>
                  <option value="partially_dispensed">Phát thuốc một phần</option>
                  <option value="fully_dispensed">Đã phát đủ</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </label>
              <label>
                <span>Tìm mã đơn</span>
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nhập mã đơn thuốc..." />
              </label>
              {searchInput ? (
                <button className="doctor-secondary-button doctor-filter-clear-button" type="button" onClick={() => { setSearchInput(''); setSearchTerm(''); setPage(1) }}>
                  Xóa tìm kiếm
                </button>
              ) : null}
            </div>

            {prescriptionsState.loading ? <LoadingState label="Đang tải đơn thuốc..." /> : null}
            {prescriptionsState.error ? <ErrorState title="Không thể tải đơn thuốc" message={prescriptionsState.error} onRetry={refreshPrescriptionsWorkspace} /> : null}
            {!capabilities.canPrescriptionWrite ? (
              <EmptyState
                title="Không thể đọc danh sách đơn theo bác sĩ"
                description="Route GET /prescriptions/doctor/:doctorId trong backend đang bị chặn bởi authorize({ permissions: ['prescriptions.write'] })."
              />
            ) : null}
            {capabilities.canPrescriptionWrite && !prescriptionsState.loading && !prescriptions.length ? (
              <EmptyState title="Chưa có đơn thuốc phù hợp" description="Không tìm thấy prescription nào theo bộ lọc hiện tại." />
            ) : null}

            {capabilities.canPrescriptionWrite && prescriptions.length ? (
              <div className="doctor-table-wrap">
                <table className="doctor-table">
                  <thead>
                    <tr>
                      <th>Đơn thuốc</th>
                      <th>Bệnh nhân / Encounter</th>
                      <th>Ngày kê</th>
                      <th>Trạng thái</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((item) => {
                      const prescriptionId = item.prescription_id || item.id
                      const isSelected = prescriptionId === selectedPrescriptionId

                      return (
                        <tr
                          key={prescriptionId}
                          className={isSelected ? 'is-selected' : ''}
                          onClick={() => setSelectedPrescriptionId(prescriptionId)}
                        >
                          <td>
                            <div className="doctor-table-cell-stack">
                              <strong>{item.prescription_no || prescriptionId}</strong>
                              <span>{prescriptionId}</span>
                            </div>
                          </td>
                          <td>
                            <div className="doctor-table-cell-stack">
                              <strong>{item.patient_name || item.patient_id || 'Chưa có thông tin bệnh nhân từ API'}</strong>
                              <span>{item.encounter_code || item.encounter_id || '--'}</span>
                            </div>
                          </td>
                          <td>
                            <div className="doctor-table-cell-stack">
                              <strong>{formatDate(item.prescribed_at || item.created_at)}</strong>
                              <span>{item.updated_at ? `Cập nhật ${formatDate(item.updated_at)}` : '--'}</span>
                            </div>
                          </td>
                          <td><StatusBadge status={item.status || 'draft'} /></td>
                          <td>{item.note || '--'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {pagination ? (
              <div className="doctor-pagination-bar">
                <span>
                  Trang {currentPage}/{totalPages} - {pagination.total} đơn thuốc phù hợp.
                </span>
                <div className="doctor-inline-actions">
                  <button className="doctor-secondary-button" type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={prescriptionsState.loading || currentPage <= 1}>
                    Trước
                  </button>
                  <button className="doctor-secondary-button" type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={prescriptionsState.loading || currentPage >= totalPages}>
                    Sau
                  </button>
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>

        <div className="doctor-panel-stack">
          <SectionCard title="Chi tiết đơn thuốc" subtitle="Tóm tắt, thuốc trong đơn và các liên kết công việc liên quan.">
            {!selectedPrescriptionId && !selectedPrescriptionState.loading ? (
              <EmptyState title="Chọn một đơn thuốc" description="Chọn một prescription trong bảng để xem chi tiết, item và điều hướng liên quan." />
            ) : null}
            {selectedPrescriptionState.loading ? <LoadingState label="Đang tải chi tiết đơn thuốc..." /> : null}
            {selectedPrescriptionState.error ? <ErrorState title="Không thể tải chi tiết đơn thuốc" message={selectedPrescriptionState.error} onRetry={reloadSelectedPrescription} /> : null}
            {selectedPrescription ? (
              <div className="doctor-panel-stack">
                <div className="doctor-overview-panel">
                  <div>
                    <h4>{selectedPrescription.prescription_no || selectedPrescription.prescription_id}</h4>
                    <p>{selectedPrescription.note || 'Không có ghi chú đơn thuốc.'}</p>
                  </div>
                  <div>
                    <StatusBadge status={selectedPrescription.status || 'draft'} />
                  </div>
                </div>

                <div className="doctor-kpi-mini-grid">
                  {selectedPrescriptionMetrics.map((item) => (
                    <div key={item.label} className="doctor-kpi-tile">
                      <strong>{item.value ?? '--'}</strong>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                {selectedPrescriptionSummaryState.error ? <SurfaceHint tone="warning">{selectedPrescriptionSummaryState.error}</SurfaceHint> : null}
                {selectedPrescriptionItemsState.error ? <SurfaceHint tone="warning">{selectedPrescriptionItemsState.error}</SurfaceHint> : null}

                <div className="doctor-overview-panel">
                  <div>
                    <h4>Bệnh nhân</h4>
                    <p>{selectedPrescription.patient_name || selectedPrescription.patient_id || '--'}</p>
                    <div className="doctor-inline-actions doctor-inline-actions-wrap">
                      {selectedPrescription.patient_id ? (
                        <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/patients/${selectedPrescription.patient_id}`)}>
                          Mở hồ sơ bệnh nhân
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <h4>Phiên khám liên quan</h4>
                    <p>{selectedPrescription.encounter_code || selectedPrescription.encounter_id || 'Chưa liên kết encounter'}</p>
                    <div className="doctor-inline-actions doctor-inline-actions-wrap">
                      <button className="doctor-secondary-button" type="button" onClick={() => openEncounterPrescription(selectedPrescription)} disabled={!selectedPrescription.encounter_id}>
                        Mở encounter
                      </button>
                    </div>
                  </div>
                </div>

                <div className="doctor-overview-panel">
                  <div>
                    <h4>Thời điểm</h4>
                    <p>Kê đơn: <strong>{formatDate(selectedPrescription.prescribed_at || selectedPrescription.created_at)}</strong></p>
                    <p>Cập nhật: <strong>{selectedPrescription.updated_at ? formatDate(selectedPrescription.updated_at) : '--'}</strong></p>
                  </div>
                  <div>
                    <h4>Tình trạng item</h4>
                    <p>{selectedPrescriptionItems.length ? `${selectedPrescriptionItems.length} item trong đơn.` : 'Chưa có item thuốc nào.'}</p>
                  </div>
                </div>

                {selectedPrescriptionItemsState.loading ? <LoadingState label="Đang tải item thuốc..." /> : null}
                {!selectedPrescriptionItemsState.loading && !selectedPrescriptionItems.length ? (
                  <EmptyState title="Đơn thuốc chưa có item" description="Danh sách thuốc trong prescription này hiện đang trống." />
                ) : null}
                {selectedPrescriptionItems.length ? (
                  <div className="doctor-table-wrap">
                    <table className="doctor-table">
                      <thead>
                        <tr>
                          <th>Thuốc</th>
                          <th>Liều / tần suất</th>
                          <th>Đường dùng</th>
                          <th>Số ngày</th>
                          <th>Số lượng</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPrescriptionItems.map((item) => (
                          <tr key={item.prescription_item_id || item.id}>
                            <td>{item.medication_name || item.medication_id || '--'}</td>
                            <td>{[item.dose, item.frequency].filter(Boolean).join(' | ') || '--'}</td>
                            <td>{item.route || '--'}</td>
                            <td>{item.duration_days ? `${item.duration_days} ngày` : '--'}</td>
                            <td>{item.quantity ?? '--'}</td>
                            <td>{item.status ? <StatusBadge status={item.status} /> : '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

export function DoctorEncountersScreen({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const [encounterView, setEncounterView] = useState(location.state?.encounterView || 'active')
  const [status, setStatus] = useState('all')
  const [readinessFilter, setReadinessFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('start_desc')
  const [searchInput, setSearchInput] = useState('')
  const [dateValue, setDateValue] = useState(getTodayDate())
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [selectedEncounterId, setSelectedEncounterId] = useState('')
  const [readinessMap, setReadinessMap] = useState({})
  const [readinessRefreshToken, setReadinessRefreshToken] = useState(0)
  const pageSize = 10
  const backendStatus =
    encounterView === 'completed'
      ? 'completed'
      : encounterView === 'cancelled'
        ? 'cancelled'
        : getEncounterBackendStatus(status)

  const [encountersState, reloadEncounters] = useAsyncResource(
    async () => {
      const baseParams = backendStatus
        ? { status: backendStatus }
        : encounterView === 'active'
          ? { status: 'planned,arrived,in_progress,on_hold' }
          : {}
      if (encounterView === 'active' && doctorId) {
        return doctorApi.encounters.listActiveByDoctor(doctorId, baseParams)
      }
      return doctorId
        ? doctorApi.encounters.listByDoctor(doctorId, baseParams)
        : doctorApi.encounters.listAll(baseParams)
    },
    [doctorId, backendStatus, encounterView, readinessRefreshToken],
    [],
      { fallbackMessage: 'Không thể tải danh sách phiên khám.' },
  )
  const [encounterCountsState] = useAsyncResource(
    async () => (doctorId ? doctorApi.encounters.listByDoctor(doctorId) : doctorApi.encounters.listAll()),
    [doctorId, readinessRefreshToken],
    [],
    { fallbackMessage: 'Không thể tải số liệu phiên khám.' },
  )
  const [todayEncountersState] = useAsyncResource(
    async () => doctorApi.encounters.listToday(doctorId ? { doctor_id: doctorId } : {}),
    [doctorId, readinessRefreshToken],
    [],
    { fallbackMessage: 'Không thể tải phiên khám hôm nay.' },
  )
  const [activeEncountersState] = useAsyncResource(
    async () => (doctorId ? doctorApi.encounters.listActiveByDoctor(doctorId, { status: 'planned,arrived,in_progress,on_hold' }) : doctorApi.encounters.listAll({ status: 'planned,arrived,in_progress,on_hold' })),
    [doctorId, readinessRefreshToken],
    [],
    { fallbackMessage: 'Không thể tải phiên khám đang hoạt động.' },
  )

  const encounters = safeArray(encountersState.data)
  const encounterCountSource = safeArray(encounterCountsState.data).length ? safeArray(encounterCountsState.data) : encounters
  const todayEncounters = safeArray(todayEncountersState.data)
  const activeEncounters = safeArray(activeEncountersState.data)
  const patientMap = usePatientMap([...encounterCountSource, ...activeEncounters].map((item) => item.patient_id))
  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Map(
          encounterCountSource
            .map((item) => [item.department_id || item.department_name || '', item.department_name || item.department_id || 'Chưa rõ phòng'])
            .filter(([value]) => Boolean(value)),
        ).entries(),
      ),
    [encounterCountSource],
  )
  const baseVisibleEncounters = useMemo(
    () => {
      const filtered = filterEncountersByUiStatus(encounters, status, encounterView)
      const keyword = searchInput.trim().toLowerCase()
      const dayKey = dateValue ? toLocalDateKey(dateValue) : ''

      return filtered
        .filter((item) => {
        const patient = item.patient_id ? patientMap[item.patient_id] : null
        const haystack = [
          item.encounter_code,
          item.encounter_id,
          item.encounter_type,
          item.chief_reason,
          item.status,
          patient?.full_name,
          patient?.patient_code,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        const matchSearch = !keyword || haystack.includes(keyword)
        const matchDate = !dayKey || toLocalDateKey(item.start_time) === dayKey
          const matchDepartment =
            departmentFilter === 'all' || item.department_id === departmentFilter || item.department_name === departmentFilter
          return matchSearch && matchDate && matchDepartment
        })
        .sort((left, right) => {
          const leftTime = new Date(left.start_time || 0).getTime()
          const rightTime = new Date(right.start_time || 0).getTime()
          return sortOrder === 'start_asc' ? leftTime - rightTime : rightTime - leftTime
        })
    },
    [encounters, status, encounterView, searchInput, dateValue, departmentFilter, sortOrder, patientMap],
  )
  const visibleEncounters = useMemo(
    () =>
      baseVisibleEncounters.filter((item) => {
        if (readinessFilter === 'all') return true
        const readiness = readinessMap[item.encounter_id || item.id] || {}
        if (readinessFilter === 'can_start') return readiness.can_start
        if (readinessFilter === 'can_complete') return readiness.can_complete
        if (readinessFilter === 'locked') return readiness.editable === false || readiness.error
        return true
      }),
    [baseVisibleEncounters, readinessFilter, readinessMap],
  )
  const totalPages = Math.max(Math.ceil(visibleEncounters.length / pageSize), 1)
  const currentPage = Math.min(page, totalPages)
  const paginationStart = Math.max(Math.min(currentPage - 2, totalPages - 4), 1)
  const paginationPages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => paginationStart + index)
  const paginatedEncounters = useMemo(
    () => visibleEncounters.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [visibleEncounters, currentPage, pageSize],
  )
  const visibleEncounterIds = useMemo(
    () => (encounterView === 'active' ? baseVisibleEncounters.map((item) => item.encounter_id || item.id).filter(Boolean) : []),
    [encounterView, baseVisibleEncounters],
  )
  useEffect(() => {
    setPage(1)
  }, [encounterView, status, readinessFilter, departmentFilter, searchInput, dateValue, sortOrder])
  useEffect(() => {
    const firstVisibleId = visibleEncounters[0]?.encounter_id || visibleEncounters[0]?.id || ''
    if (!selectedEncounterId || !visibleEncounters.some((item) => (item.encounter_id || item.id) === selectedEncounterId)) {
      setSelectedEncounterId(firstVisibleId)
    }
  }, [visibleEncounters, selectedEncounterId])
  const [selectedDetailState] = useAsyncResource(
    async () => (selectedEncounterId ? doctorApi.encounters.getDetail(selectedEncounterId) : null),
    [selectedEncounterId, readinessRefreshToken],
    null,
    { fallbackMessage: 'Không thể tải chi tiết phiên khám đang chọn.' },
  )
  const [selectedSummaryState] = useAsyncResource(
    async () => (selectedEncounterId ? doctorApi.encounters.getSummary(selectedEncounterId) : null),
    [selectedEncounterId, readinessRefreshToken],
    null,
    { fallbackMessage: 'Không thể tải tổng quan phiên khám đang chọn.' },
  )
  const [selectedTimelineState] = useAsyncResource(
    async () => (selectedEncounterId ? doctorApi.encounters.getTimeline(selectedEncounterId) : []),
    [selectedEncounterId, readinessRefreshToken],
    [],
    { fallbackMessage: 'Không thể tải timeline phiên khám đang chọn.' },
  )
  const [selectedOrdersSummaryState] = useAsyncResource(
    async () => (selectedEncounterId ? doctorApi.orders.getEncounterSummary(selectedEncounterId) : null),
    [selectedEncounterId, readinessRefreshToken],
    null,
    { fallbackMessage: 'Không thể tải tổng quan orders của phiên khám đang chọn.' },
  )
  const [selectedOrdersState] = useAsyncResource(
    async () => (selectedEncounterId ? doctorApi.orders.listByEncounter(selectedEncounterId, { limit: 5 }) : []),
    [selectedEncounterId, readinessRefreshToken],
    [],
    { fallbackMessage: 'Không thể tải orders của phiên khám đang chọn.' },
  )
  const activeEncounterCount = encounterCountSource.filter((item) => activeEncounterStatuses.includes(item.raw_status || item.status)).length
  const completedEncounterCount = encounterCountSource.filter((item) => completedEncounterStatuses.includes(item.raw_status || item.status)).length
  const cancelledEncounterCount = encounterCountSource.filter((item) => cancelledEncounterStatuses.includes(item.raw_status || item.status)).length
  const averageDuration = useMemo(() => {
    const completed = encounterCountSource
      .map((item) => {
        const start = item.start_time ? new Date(item.start_time) : null
        const end = item.end_time ? new Date(item.end_time) : null
        if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
        return Math.max(Math.round((end - start) / 60000), 0)
      })
      .filter(Boolean)
    if (!completed.length) return 0
    return Math.round(completed.reduce((total, item) => total + item, 0) / completed.length)
  }, [encounterCountSource])
  const encounterStatusCounts = {
    waiting: encounterCountSource.filter((item) => ['planned', 'arrived', 'waiting'].includes(item.raw_status || item.status)).length,
    inProgress: encounterCountSource.filter((item) => (item.raw_status || item.status) === 'in_progress').length,
    onHold: encounterCountSource.filter((item) => (item.raw_status || item.status) === 'on_hold').length,
    completed: encounterCountSource.filter((item) => (item.raw_status || item.status) === 'completed').length,
    cancelled: encounterCountSource.filter((item) => (item.raw_status || item.status) === 'cancelled').length,
  }
  const encounterViewTabs = [
    { value: 'active', label: 'Đang xử lý', count: encounterView === 'active' ? visibleEncounters.length : activeEncounterCount },
    { value: 'completed', label: 'Lịch sử đã khám', count: encounterView === 'completed' ? visibleEncounters.length : completedEncounterCount },
    { value: 'cancelled', label: 'Đã hủy', count: encounterView === 'cancelled' ? visibleEncounters.length : cancelledEncounterCount },
  ]
  const encounterViewCopy = {
    active: {
      title: 'Phiên khám đang xử lý',
      subtitle: 'Chỉ hiển thị các phiên khám chưa hoàn tất của bác sĩ hiện tại.',
      emptyTitle: 'Không có phiên khám đang xử lý',
      emptyDescription: 'Các phiên khám completed và cancelled đã được tách khỏi danh sách đang xử lý.',
      note: '',
    },
    completed: {
      title: 'Lịch sử đã khám',
      subtitle: 'Các phiên khám completed được tách riêng để xem lại.',
      emptyTitle: 'Chưa có phiên khám đã hoàn tất',
      emptyDescription: 'Khi encounter chuyển sang completed, phiên khám sẽ xuất hiện ở mục này.',
      note: 'Lịch sử dùng status completed từ backend và không hiển thị Start / Hold / Complete.',
    },
    cancelled: {
      title: 'Phiên khám đã hủy',
      subtitle: 'Các encounter cancelled được tách khỏi luồng đang xử lý để tránh thao tác nhầm.',
      emptyTitle: 'Chưa có phiên khám đã hủy',
      emptyDescription: 'Khi encounter chuyển sang cancelled, phiên khám sẽ xuất hiện ở mục này.',
      note: 'Mục đã hủy dùng status cancelled từ backend và chỉ cho phép mở xem chi tiết.',
    },
  }
  const currentViewCopy = encounterViewCopy[encounterView] || encounterViewCopy.active
  const rightStats = [
    { label: 'Tổng encounter', value: encounterCountSource.length, icon: 'clipboard', tone: 'blue' },
    { label: 'Encounter hôm nay', value: todayEncounters.length, icon: 'calendar', tone: 'teal' },
    { label: 'Đang hoạt động', value: activeEncounters.length || activeEncounterCount, icon: 'patients', tone: 'purple' },
    { label: 'Thời lượng trung bình', value: averageDuration ? `${averageDuration} phút` : '--', icon: 'clock', tone: 'teal' },
  ]
  const selectedEncounter =
    selectedDetailState.data || visibleEncounters.find((item) => (item.encounter_id || item.id) === selectedEncounterId) || null
  const selectedPatient = selectedEncounter?.patient_id ? patientMap[selectedEncounter.patient_id] : null
  const selectedReadiness = selectedEncounterId ? readinessMap[selectedEncounterId] || {} : {}
  const selectedTimeline = safeArray(selectedTimelineState.data)
  const selectedOrdersSummary = selectedOrdersSummaryState.data || null
  const selectedOrders = safeArray(selectedOrdersState.data)
  const activeAlerts = activeEncounters
    .slice()
    .sort((left, right) => {
      const leftStatus = left.raw_status || left.status
      const rightStatus = right.raw_status || right.status
      const leftWeight = leftStatus === 'on_hold' ? 0 : leftStatus === 'in_progress' ? 1 : 2
      const rightWeight = rightStatus === 'on_hold' ? 0 : rightStatus === 'in_progress' ? 1 : 2
      return leftWeight - rightWeight || new Date(left.start_time || 0).getTime() - new Date(right.start_time || 0).getTime()
    })
    .slice(0, 3)

  useEffect(() => {
    if (!visibleEncounterIds.length) {
      setReadinessMap({})
      return
    }

    let active = true
    const idSet = new Set(visibleEncounterIds)
    setReadinessMap((current) =>
      Object.fromEntries(Object.entries(current).filter(([encounterId]) => idSet.has(encounterId))),
    )

    async function loadReadiness() {
      const entries = await Promise.all(
        visibleEncounterIds.map(async (encounterId) => {
          try {
            return [encounterId, await doctorApi.encounters.getReadiness(encounterId)]
          } catch (error) {
            return [encounterId, { error: getApiErrorMessage(error, 'Không thể tải readiness.') }]
          }
        }),
      )

      if (active) {
        setReadinessMap(Object.fromEntries(entries))
      }
    }

    loadReadiness()

    return () => {
      active = false
    }
  }, [visibleEncounterIds.join('|'), readinessRefreshToken])

  async function commitTransition(encounterId, action) {
    setBusy(true)
    try {
      if (action === 'start') {
        await doctorApi.encounters.start(encounterId)
      }
      if (action === 'arrive') {
        await doctorApi.encounters.arrive(encounterId)
      }
      if (action === 'hold') {
        await doctorApi.encounters.hold(encounterId)
      }
      if (action === 'complete') {
        await doctorApi.encounters.complete(encounterId)
      }
      if (action === 'cancel') {
        await doctorApi.encounters.cancel(encounterId)
      }
      if (action === 'reopen') {
        await doctorApi.encounters.reopen(encounterId)
      }
      reloadEncounters()
      setReadinessRefreshToken((current) => current + 1)
      setDialog(null)
      notifyDoctorSuccess(
        toast,
        action === 'arrive'
          ? 'Đã chuyển phiên khám sang trạng thái đã đến.'
          : action === 'start'
            ? 'Đã bắt đầu phiên khám.'
            : action === 'hold'
              ? 'Đã tạm dừng phiên khám.'
              : action === 'complete'
                ? 'Đã hoàn tất phiên khám.'
                : action === 'cancel'
                  ? 'Đã hủy phiên khám.'
                  : 'Đã mở lại phiên khám.',
        'Phiên khám đã cập nhật',
      )
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể cập nhật trạng thái phiên khám.', {
        permission: 'encounters.write',
      })
    } finally {
      setBusy(false)
    }
  }

  function handleTransition(encounterId, action) {
    if (
      action !== 'complete' &&
      !guardDoctorAction({
        allowed: capabilities.canEncounterActions,
        toast,
        permission: 'encounters.write',
      })
    ) {
      return
    }

    if (action === 'start' && !readinessMap[encounterId]?.can_start) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Chưa thể bắt đầu',
        message: 'Backend chưa cho phép bắt đầu phiên khám này. Tôi đang tải lại điều kiện thao tác mới nhất.',
      })
      setReadinessRefreshToken((current) => current + 1)
      return
    }

    if (action === 'complete' && !readinessMap[encounterId]?.can_complete) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Chưa thể hoàn tất',
        message:
          'Backend chưa cho phép hoàn tất phiên khám. Hãy ký consultation, ghi nhận chẩn đoán hoặc kích hoạt đơn thuốc rồi thử lại.',
      })
      setReadinessRefreshToken((current) => current + 1)
      return
    }

    if (
      action === 'complete' &&
      !guardDoctorAction({
        allowed: capabilities.canEncounterActions,
        toast,
        permission: 'encounters.write',
      })
    ) {
      return
    }

    if (['complete', 'cancel'].includes(action)) {
      setDialog({ encounterId, action })
      return
    }
    commitTransition(encounterId, action)
  }

  function refreshEncountersPage() {
    reloadEncounters()
    setReadinessRefreshToken((current) => current + 1)
  }

  return (
    <div className="doctor-page-stack doctor-encounters-redesign">
      <section className="doctor-encounters-page-head">
        <div>
          <span>Bảng điều phối encounter</span>
          <h2>Quản lý phiên khám</h2>
          <p>Theo dõi trạng thái, readiness, timeline và orders từ backend theo thời gian thực.</p>
          <div className="doctor-encounters-head-metrics">
            <strong>{activeEncounters.length || activeEncounterCount} đang hoạt động</strong>
            <strong>{todayEncounters.length} hôm nay</strong>
            <strong>{completedEncounterCount} hoàn tất</strong>
          </div>
        </div>
        <div className="doctor-encounters-head-actions">
          <button
            className="doctor-primary-button"
            type="button"
            onClick={() => {
              if (!guardDoctorAction({ allowed: capabilities.canEncounterActions, toast, permission: 'encounters.write' })) return
              navigate('/doctor/appointments', { state: { worklistView: 'active' } })
            }}
          >
            <DoctorIcon name="plus" />
            Tạo encounter mới
          </button>
          <button className="doctor-secondary-button" type="button" onClick={refreshEncountersPage}>
            <DoctorIcon name="refresh" />
            Làm mới
          </button>
        </div>
      </section>

      <section className="doctor-encounters-kpi-strip">
        {[
          { label: 'Tổng encounter', value: encounterCountSource.length, icon: 'clipboard', tone: 'blue' },
          { label: 'Đang xử lý', value: activeEncounters.length || activeEncounterCount, icon: 'pulse', tone: 'teal' },
          { label: 'Đã hoàn tất', value: completedEncounterCount, icon: 'check_circle', tone: 'green' },
          { label: 'Đã hủy', value: cancelledEncounterCount, icon: 'cancel', tone: 'red' },
          { label: 'Thời lượng TB', value: averageDuration ? `${averageDuration} phút` : '--', icon: 'clock', tone: 'purple' },
        ].map((item) => (
          <article className={`doctor-encounters-kpi is-${item.tone}`} key={item.label}>
            <span><DoctorIcon name={item.icon} /></span>
            <div>
              <strong>{item.value}</strong>
              <p>{item.label}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="doctor-encounters-filter-card">
        <label className="doctor-encounters-search">
          <DoctorIcon name="search" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm theo tên bệnh nhân, PID, triệu chứng..."
          />
        </label>
        <label>
          <span>Trạng thái</span>
          <select
            value={encounterView === 'active' ? status : encounterView}
            onChange={(event) => {
              const next = event.target.value
              if (['completed', 'cancelled'].includes(next)) {
                setEncounterView(next)
                setStatus('all')
              } else {
                setEncounterView('active')
                setStatus(next)
              }
            }}
          >
            <option value="all">Đang hoạt động</option>
            <option value="planned">Đã lên kế hoạch</option>
            <option value="arrived">Đã đến</option>
            <option value="in_progress">Đang khám</option>
            <option value="on_hold">Tạm giữ</option>
            <option value="completed">Đã hoàn tất</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </label>
        <label>
          <span>Điều kiện</span>
          <select value={readinessFilter} onChange={(event) => setReadinessFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="can_start">Có thể bắt đầu</option>
            <option value="can_complete">Có thể hoàn tất</option>
            <option value="locked">Đã khóa</option>
          </select>
        </label>
        <label>
          <span>Phòng khám</span>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            {departmentOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ngày</span>
          <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
        </label>
        <button
          className="doctor-secondary-button doctor-encounters-filter-action"
          type="button"
          onClick={() => {
            setSearchInput('')
            setStatus('all')
            setReadinessFilter('all')
            setDepartmentFilter('all')
            setDateValue(getTodayDate())
          }}
        >
          <DoctorIcon name="settings" />
          Xóa bộ lọc
        </button>
      </section>

      <section className="doctor-encounters-main-grid">
        <div className="doctor-encounters-left">
          <section className="doctor-encounters-list-card">
            <header>
              <div>
                <span>Hiển thị {visibleEncounters.length} encounter</span>
                <p>{currentViewCopy.subtitle}</p>
              </div>
              <div className="doctor-encounters-list-controls">
                <label>
                  <span>Sắp xếp theo:</span>
                  <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                    <option value="start_desc">Thời gian bắt đầu</option>
                    <option value="start_asc">Cũ nhất trước</option>
                  </select>
                </label>
              </div>
            </header>
            <div className="doctor-encounters-tab-strip" role="tablist" aria-label="Nhóm phiên khám">
              {encounterViewTabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={encounterView === item.value ? 'is-active' : ''}
                  onClick={() => {
                    setEncounterView(item.value)
                    setStatus('all')
                  }}
                >
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>
            {encountersState.loading ? <LoadingState label="Đang tải phiên khám..." /> : null}
            {encountersState.error && !encounters.length ? (
              <ErrorState title="Không thể tải phiên khám" message={encountersState.error} onRetry={reloadEncounters} />
            ) : null}
            {!encountersState.loading && !visibleEncounters.length ? (
              <EmptyState title={currentViewCopy.emptyTitle} description={currentViewCopy.emptyDescription} />
            ) : null}
            {!encountersState.loading && visibleEncounters.length > 0 ? (
              <>
                <div className="doctor-encounters-table">
                  <div className="doctor-encounters-table-head">
                    <span>Bệnh nhân</span>
                    <span>Phòng khám</span>
                    <span>Bắt đầu lúc</span>
                    <span>Thời lượng</span>
                    <span>Readiness</span>
                    <span>Trạng thái</span>
                    <span>Thao tác</span>
                  </div>
                  {paginatedEncounters.map((encounter) => {
                  const encounterId = encounter.encounter_id || encounter.id
                  const patient = patientMap[encounter.patient_id]
                  const patientName = patient?.full_name || encounter.patient_name || encounter.patient_id || 'Chưa rõ bệnh nhân'
                  const patientAge = calculatePatientAge(patient?.date_of_birth)
                  const readiness = readinessMap[encounterId] || {}
                  const currentStatus = encounter.raw_status || encounter.status
                  const elapsed = getEncounterDurationMinutes(encounter)
                  const action = getEncounterPrimaryAction(currentStatus, readiness)
                  const isSelected = selectedEncounterId === encounterId

                    return (
                      <article
                        className={`doctor-encounters-row${isSelected ? ' is-selected' : ''}`}
                        key={encounterId}
                        onClick={() => setSelectedEncounterId(encounterId)}
                      >
                        <div className="doctor-encounters-patient">
                          <span>{getInitials(patientName) || 'BN'}</span>
                          <div>
                            <strong>{patientName}</strong>
                            <p>PID: {patient?.patient_code || encounter.patient_id || '--'}</p>
                            <small>{patientAge || encounter.encounter_code || '--'}</small>
                          </div>
                        </div>
                        <div>
                          <strong>{encounter.department_name || encounter.department_id || 'Chưa rõ'}</strong>
                          <small>{encounter.encounter_type || encounter.encounter_code || '--'}</small>
                        </div>
                        <div>
                          <strong>{formatTime(encounter.start_time) || '--'}</strong>
                          <small>{formatDate(encounter.start_time)}</small>
                        </div>
                        <div>
                          <strong>{elapsed ? formatMinutesAsText(elapsed) : '--'}</strong>
                          <small>{encounter.end_time ? 'Đã đóng' : 'Đang mở'}</small>
                        </div>
                        <div className="doctor-readiness-cell">
                          <strong>{getEncounterReadinessLabel(readiness)}</strong>
                          <span className="doctor-readiness-chips">
                            <em className={readiness.has_signed_consultation ? 'is-ok' : 'is-missing'}>Ký</em>
                            <em className={readiness.has_active_prescription ? 'is-ok' : 'is-missing'}>Rx</em>
                            <em className={readiness.editable === false ? 'is-missing' : 'is-ok'}>Sửa</em>
                          </span>
                        </div>
                        <div className="doctor-encounters-row-status">
                          <StatusBadge status={encounter.raw_status || encounter.status || 'waiting'} />
                          <small>{encounter.chief_reason || 'Đang theo dõi'}</small>
                        </div>
                        <div className="doctor-encounters-row-actions">
                          <button
                            className="doctor-secondary-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate(`/doctor/encounters/${encounterId}`)
                            }}
                          >
                            Mở chi tiết
                          </button>
                          {capabilities.canEncounterActions && encounterView === 'active' && !['completed', 'cancelled'].includes(currentStatus) ? (
                            <button
                              className={
                                action.tone === 'success'
                                  ? 'doctor-primary-button doctor-primary-green'
                                  : action.tone === 'locked'
                                    ? 'doctor-secondary-button is-locked'
                                    : 'doctor-primary-button'
                              }
                              type="button"
                              disabled={busy || action.tone === 'locked'}
                              title={action.tone === 'locked' ? 'Backend chưa cho phép thao tác này' : ''}
                              onClick={(event) => {
                                event.stopPropagation()
                                if (action.action === 'detail') {
                                  navigate(`/doctor/encounters/${encounterId}`)
                                  return
                                }
                                handleTransition(encounterId, action.action)
                              }}
                            >
                              {action.label}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
                <footer className="doctor-encounters-pagination">
                  <span>
                    Hiển thị {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, visibleEncounters.length)} của {visibleEncounters.length} encounter
                  </span>
                  <div>
                    <button className="doctor-secondary-button" type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={currentPage <= 1}>
                      Trước
                    </button>
                    {paginationPages.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        className={`doctor-encounters-page-button${currentPage === pageNumber ? ' is-active' : ''}`}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button className="doctor-secondary-button" type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={currentPage >= totalPages}>
                      Sau
                    </button>
                  </div>
                </footer>
              </>
            ) : null}
          </section>
        </div>

        <aside className="doctor-encounters-side">
          <section className="doctor-encounters-side-card">
            <header>
              <strong>Tổng quan encounter</strong>
              <small>Cập nhật {formatTime(new Date())}, {formatDate(new Date())}</small>
            </header>
            {rightStats.map((item) => (
              <article className={`doctor-encounters-side-stat is-${item.tone}`} key={item.label}>
                <span><DoctorIcon name={item.icon} /></span>
                <div>
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                </div>
              </article>
            ))}
          </section>
          <section className="doctor-encounters-side-card doctor-encounters-selected-card">
            <header>
              <strong>Phiên đang chọn</strong>
              <small>{selectedEncounterId ? `ID: ${selectedEncounterId}` : 'Chưa chọn encounter'}</small>
            </header>
            {selectedEncounter ? (
              <div className="doctor-encounters-selected-body">
                <div className="doctor-encounters-selected-patient">
                  <span>{getInitials(selectedPatient?.full_name || selectedEncounter.patient_name || selectedEncounter.patient_id) || 'BN'}</span>
                  <div>
                    <strong>{selectedPatient?.full_name || selectedEncounter.patient_name || selectedEncounter.patient_id || 'Chưa rõ bệnh nhân'}</strong>
                    <p>{selectedPatient?.patient_code || selectedEncounter.encounter_code || selectedEncounter.patient_id || '--'}</p>
                  </div>
                </div>
                <div className="doctor-encounters-selected-grid">
                  <article>
                    <span>Trạng thái</span>
                    <StatusBadge status={selectedEncounter.status || 'waiting'} />
                  </article>
                  <article>
                    <span>Điều kiện</span>
                    <strong>{getEncounterReadinessLabel(selectedReadiness)}</strong>
                  </article>
                  <article>
                    <span>Orders đang xử lý</span>
                    <strong>{selectedOrdersSummary?.pending ?? '--'}</strong>
                  </article>
                  <article>
                    <span>Timeline</span>
                    <strong>{selectedTimeline.length}</strong>
                  </article>
                </div>
                <div className="doctor-readiness-detail-list">
                  {[
                    ['Có thể bắt đầu', selectedReadiness.can_start],
                    ['Có thể hoàn tất', selectedReadiness.can_complete],
                    ['Consultation đã ký', selectedReadiness.has_signed_consultation],
                    ['Prescription active', selectedReadiness.has_active_prescription],
                    ['Có thể chỉnh sửa', selectedReadiness.editable !== false],
                  ].map(([label, ok]) => (
                    <span key={label} className={ok ? 'is-ok' : 'is-missing'}>
                      {label}
                    </span>
                  ))}
                </div>
                {selectedSummaryState.error || selectedOrdersSummaryState.error || selectedOrdersState.error || selectedTimelineState.error ? (
                  <p className="doctor-encounters-side-warning">
                    {selectedSummaryState.error || selectedOrdersSummaryState.error || selectedOrdersState.error || selectedTimelineState.error}
                  </p>
                ) : null}
                <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${selectedEncounterId}`)}>
                  Mở hồ sơ phiên khám
                </button>
              </div>
            ) : (
              <p className="doctor-muted-text">Chọn một dòng encounter để xem readiness, timeline và orders từ backend.</p>
            )}
          </section>
          <section className="doctor-encounters-side-card">
            <header>
              <strong>Orders của encounter</strong>
              <small>{selectedOrdersSummary ? `${selectedOrdersSummary.total || 0} orders | ${selectedOrdersSummary.pending || 0} đang mở` : 'Theo phiên đang chọn'}</small>
            </header>
            <div className="doctor-encounters-alert-list">
              {selectedOrders.map((order) => (
                <button key={order.order_id} type="button" onClick={() => navigate(`/doctor/orders/${order.order_id}`)}>
                  <span><DoctorIcon name="clipboard" /></span>
                  <div>
                    <strong>{order.order_code || order.title || order.order_id}</strong>
                    <p>{order.title || order.order_type || '--'} · {order.status || '--'}</p>
                  </div>
                </button>
              ))}
              {!selectedOrders.length ? <p className="doctor-muted-text">Encounter đang chọn chưa có order.</p> : null}
            </div>
          </section>
          <section className="doctor-encounters-side-card">
            <header>
              <strong>Cảnh báo & Nhắc việc</strong>
            </header>
            <div className="doctor-encounters-alert-list">
              {activeAlerts.map((item) => {
                const patient = patientMap[item.patient_id]
                const duration = getEncounterDurationMinutes(item)
                return (
                  <button key={item.encounter_id} type="button" onClick={() => navigate(`/doctor/encounters/${item.encounter_id}`)}>
                    <span>{(item.raw_status || item.status) === 'on_hold' ? '!' : '•'}</span>
                    <div>
                      <strong>{patient?.full_name || item.patient_name || item.encounter_code || 'Encounter cần theo dõi'}</strong>
                      <p>{patient?.patient_code || item.encounter_code || item.patient_id || '--'} · {duration !== null ? formatMinutesAsText(duration) : '--'}</p>
                    </div>
                  </button>
                )
              })}
              {!activeEncounters.length ? <p className="doctor-muted-text">Không có nhắc việc active.</p> : null}
            </div>
          </section>
        </aside>
      </section>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title={dialog?.action === 'cancel' ? 'Hủy phiên khám?' : 'Hoàn tất phiên khám?'}
        description={dialog?.action === 'cancel' ? 'Thao tác này sẽ hủy phiên khám theo lifecycle backend.' : 'Thao tác này sẽ đóng vòng đời khám của phiên khám đã chọn.'}
        confirmLabel={dialog?.action === 'cancel' ? 'Hủy phiên khám' : 'Hoàn tất phiên khám'}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitTransition(dialog?.encounterId, dialog?.action)}
      />
    </div>
  )
}
