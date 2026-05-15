import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from './toast/ToastProvider'
import { doctorApi, getDoctorCapabilities, getDoctorId } from './doctorApi'
import { formatDate, formatTime, getInitials, safeArray } from './doctorData'
import { useAsyncResource, getTodayDate, usePollingReload } from './DoctorHooks'
import { guardDoctorAction } from './doctorFeedback'
import { DoctorIcon, EmptyState, ErrorState, LoadingState, StatusBadge } from './DoctorShell'

const ACTIVE_ORDER_STATUS_QUERY = 'draft,confirmed,in_progress,result_ready'
const WEEK_FILTER_OPTIONS = [
  { value: -1, label: 'Tuần trước' },
  { value: 0, label: 'Tuần này' },
  { value: 1, label: 'Tuần sau' },
]
const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function asSettledValue(result, fallback) {
  return result.status === 'fulfilled' ? result.value : fallback
}

function formatRoleLabel(roleCode = '') {
  if (!roleCode) return 'Bác sĩ'
  const value = typeof roleCode === 'object'
    ? roleCode.role_name || roleCode.roleName || roleCode.role_code || roleCode.roleCode || 'Bác sĩ'
    : roleCode

  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getWeekRangeLabel(payload) {
  if (!payload?.start_date || !payload?.end_date) return 'Chưa có khoảng tuần'
  return `${formatDate(payload.start_date)} - ${formatDate(payload.end_date)}`
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getWeekRangeForDate(value = new Date()) {
  const current = new Date(value)
  const day = current.getDay()
  const mondayOffset = (day + 6) % 7
  const start = addDays(current, -mondayOffset)
  const end = addDays(start, 6)
  return {
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  }
}

function getWeekFilterDate(offset = 0) {
  return toDateKey(addDays(new Date(), offset * 7))
}

function parseDateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildWeeklySeries(overview, weekRange) {
  const rangeStart = parseDateKey(overview?.start_date || weekRange?.startDate)
  if (!rangeStart) return []

  const sourceRows = safeArray(overview?.appointments).length
    ? safeArray(overview.appointments)
    : safeArray(overview?.by_day || overview?.appointments_by_day || overview?.charts?.by_day)
  const rowsByDate = new Map(sourceRows.map((item) => [
    String(item.date || item.appointment_date || '').slice(0, 10),
    item,
  ]))

  return WEEKDAY_LABELS.map((fallbackLabel, index) => {
    const date = addDays(rangeStart, index)
    const dateKey = toDateKey(date)
    const item = rowsByDate.get(dateKey) || {}

    return {
      label: item.label || fallbackLabel,
      value: Number(item.total ?? item.count ?? item.value ?? item.appointments ?? 0),
    }
  })
}

function getMinutesDiff(from, to = Date.now()) {
  if (!from) return null
  const parsed = new Date(from).getTime()
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.round((to - parsed) / 60000))
}

function getElapsedText(startTime) {
  const minutes = getMinutesDiff(startTime)
  if (minutes === null) return '--'
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  return remain ? `${hours}h ${remain}p` : `${hours}h`
}

function getWaitText(checkinTime) {
  const minutes = getMinutesDiff(checkinTime)
  return minutes === null ? '--' : `Chờ ${minutes} phút`
}

function buildShiftState(schedule) {
  if (!schedule?.shift_start || !schedule?.shift_end) {
    return { label: 'Chưa có ca', tone: 'red', progressPercent: 0, remainingText: '--' }
  }

  if (schedule.status === 'cancelled') {
    return { label: 'Ngừng hoạt động', tone: 'red', progressPercent: 0, remainingText: '--' }
  }

  if (schedule.status === 'completed') {
    return { label: 'Đã kết thúc', tone: 'red', progressPercent: 100, remainingText: 'Hết ca' }
  }

  const now = Date.now()
  const start = new Date(schedule.shift_start).getTime()
  const end = new Date(schedule.shift_end).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return { label: 'Tạm dừng', tone: 'amber', progressPercent: 0, remainingText: '--' }
  }

  if (now < start) {
    const remainingMinutes = Math.max(0, Math.round((start - now) / 60000))
    return {
      label: 'Sắp vào ca',
      tone: 'amber',
      progressPercent: 0,
      remainingText: remainingMinutes >= 60 ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}p` : `${remainingMinutes}p`,
    }
  }

  if (now > end) {
    return { label: 'Ngoài ca', tone: 'red', progressPercent: 100, remainingText: 'Hết ca' }
  }

  const remainingMinutes = Math.max(0, Math.round((end - now) / 60000))
  return {
    label: 'Đang trong ca',
    tone: 'green',
    progressPercent: Math.min(100, Math.round(((now - start) / (end - start)) * 100)),
    remainingText: remainingMinutes >= 60 ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}p` : `${remainingMinutes}p`,
  }
}

function buildAccountState(status) {
  const normalized = String(status || '').toLowerCase()
  if (['active', 'enabled', 'verified'].includes(normalized)) {
    return { label: 'Tài khoản hoạt động', tone: 'green', active: true }
  }
  if (['pending', 'draft', 'invited'].includes(normalized)) {
    return { label: 'Tài khoản chờ kích hoạt', tone: 'amber', active: false }
  }
  if (['inactive', 'disabled', 'blocked', 'suspended', 'locked', 'cancelled'].includes(normalized)) {
    return { label: 'Tài khoản không hoạt động', tone: 'red', active: false }
  }
  return { label: 'Chưa rõ trạng thái tài khoản', tone: 'slate', active: false }
}

function pickCurrentShift(dashboardShift, todaySchedules = []) {
  if (dashboardShift) return dashboardShift
  const now = Date.now()
  return todaySchedules.find((schedule) => {
    const start = new Date(schedule.shift_start).getTime()
    const end = new Date(schedule.shift_end).getTime()
    return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && now <= end
  }) || todaySchedules[0] || null
}

function flattenQueueBoard(board) {
  if (!board) return []
  return [
    ...safeArray(board.waiting),
    ...safeArray(board.called),
    ...safeArray(board.in_service),
  ]
}

function getSummaryNumber(summary, keys = []) {
  for (const key of keys) {
    const value = summary?.[key]
    if (value !== undefined && value !== null && value !== '') {
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : value
    }
  }
  return undefined
}

function mergeDashboardPayload({
  dashboard,
  todaySchedules,
  weekSchedules,
  appointmentsToday,
  appointmentSummary,
  encountersToday,
  activeEncountersPage,
  queueSummary,
  queueBoard,
  ordersPage,
  unreadCount,
}) {
  const activeEncounters = safeArray(activeEncountersPage)
  const dashboardQueue = safeArray(dashboard?.waiting_queue)
  const boardQueue = flattenQueueBoard(queueBoard)
  const orders = safeArray(ordersPage?.items)
  const dashboardAppointments = safeArray(dashboard?.appointments_today)
  const resolvedAppointments = dashboardAppointments.length ? dashboardAppointments : safeArray(appointmentsToday)
  const dashboardActiveEncounters = safeArray(dashboard?.active_encounters)
  const resolvedActiveEncounters = dashboardActiveEncounters.length
    ? dashboardActiveEncounters
    : activeEncounters.length
      ? activeEncounters
      : safeArray(encountersToday).filter((item) => ['in_progress', 'active', 'examining'].includes(item.status))
  const resolvedQueue = dashboardQueue.length ? dashboardQueue : boardQueue

  return {
    doctor: dashboard?.doctor || null,
    today_shift: pickCurrentShift(dashboard?.today_shift, todaySchedules),
    today_schedules: todaySchedules,
    week_schedules: weekSchedules,
    appointment_summary: appointmentSummary || null,
    queue_summary: queueSummary || null,
    queue_board: queueBoard || null,
    encounters_today: safeArray(encountersToday),
    notification_unread_count: unreadCount,
    kpis: {
      ...(dashboard?.kpis || {}),
      appointments_today:
        dashboard?.kpis?.appointments_today ??
        getSummaryNumber(appointmentSummary, ['today', 'today_count', 'appointments_today', 'total_today', 'total']) ??
        resolvedAppointments.length,
      active_encounters: dashboard?.kpis?.active_encounters ?? resolvedActiveEncounters.length,
      encounters_today:
        dashboard?.kpis?.encounters_today ??
        getSummaryNumber(encountersToday, ['total', 'today_count']) ??
        safeArray(encountersToday).length,
      waiting_patients:
        dashboard?.kpis?.waiting_patients ??
        getSummaryNumber(queueSummary, ['waiting', 'waiting_count', 'total_waiting', 'total']) ??
        resolvedQueue.length,
      pending_orders: dashboard?.kpis?.pending_orders ?? ordersPage?.pagination?.total ?? orders.length,
      unread_notifications: Number(unreadCount || 0),
    },
    appointments_today: resolvedAppointments,
    waiting_queue: resolvedQueue,
    active_encounters: resolvedActiveEncounters,
    pending_orders: safeArray(dashboard?.pending_orders).length ? safeArray(dashboard.pending_orders) : orders,
    weekly_overview: dashboard?.weekly_overview || null,
  }
}

async function loadDoctorDashboard({ doctorId, canReadOrders, dashboardDate, weekRange }) {
  const today = getTodayDate()
  const loadWeekDashboard = dashboardDate === today
    ? Promise.resolve(null)
    : doctorApi.dashboard.getMe({ date: dashboardDate })
  const results = await Promise.allSettled([
    doctorApi.dashboard.getMe({ date: today }),
    loadWeekDashboard,
    doctorApi.schedules.myToday({ date: getTodayDate() }),
    doctorApi.schedules.myWeek({ date_from: weekRange.startDate, date_to: weekRange.endDate, limit: 100 }),
    doctorApi.appointments.listToday({ date: today, doctor_id: doctorId, limit: 8 }),
    doctorApi.appointments.getSummary({ date: today, doctor_id: doctorId }),
    doctorApi.encounters.listToday({ date: today, doctor_id: doctorId, limit: 8 }),
    doctorId ? doctorApi.encounters.listActiveByDoctor(doctorId, { limit: 8 }) : Promise.resolve([]),
    doctorApi.queue.getTodaySummary({ doctor_id: doctorId }),
    doctorId ? doctorApi.queue.getBoard(doctorId, { limit: 8 }) : Promise.resolve(null),
    doctorId && canReadOrders
      ? doctorApi.orders.listByDoctorPage(doctorId, { status: ACTIVE_ORDER_STATUS_QUERY, limit: 8 })
      : Promise.resolve({ items: [], pagination: null }),
    doctorApi.notifications.getUnreadCount(),
  ])

  const dashboard = asSettledValue(results[0], null)
  const weekDashboard = asSettledValue(results[1], null)
  const hardFailures = results.filter((result) => result.status === 'rejected')
  if (!dashboard && hardFailures.length === results.length) {
    throw hardFailures[0].reason
  }

  return mergeDashboardPayload({
    dashboard: dashboard ? { ...dashboard, weekly_overview: weekDashboard?.weekly_overview || dashboard.weekly_overview } : weekDashboard,
    todaySchedules: asSettledValue(results[2], []),
    weekSchedules: asSettledValue(results[3], []),
    appointmentsToday: asSettledValue(results[4], []),
    appointmentSummary: asSettledValue(results[5], null),
    encountersToday: asSettledValue(results[6], []),
    activeEncountersPage: asSettledValue(results[7], []),
    queueSummary: asSettledValue(results[8], null),
    queueBoard: asSettledValue(results[9], null),
    ordersPage: asSettledValue(results[10], { items: [], pagination: null }),
    unreadCount: asSettledValue(results[11], 0),
  })
}

function DashboardWeekChart({ series, loading, error }) {
  if (loading) return <LoadingState label="Đang tải biểu đồ tuần..." />
  if (error && !series.length) return <SurfaceChartState message="Không thể tải dữ liệu tuần." />
  if (!series.length) return <SurfaceChartState message="Chưa có dữ liệu lịch hẹn trong tuần này." />

  const width = 300
  const height = 112
  const paddingLeft = 34
  const paddingRight = 12
  const paddingTop = 10
  const paddingBottom = 22
  const chartHeight = height - paddingTop - paddingBottom
  const rawMax = Math.max(...series.map((item) => item.value), 1)
  const max = Math.max(10, Math.ceil(rawMax / 50) * 50)
  const axisValues = [max, Math.round(max * 2 / 3), Math.round(max / 3), 0]
  const stepX = series.length > 1 ? (width - paddingLeft - paddingRight) / (series.length - 1) : 0
  const points = series.map((item, index) => ({
    ...item,
    x: paddingLeft + stepX * index,
    y: paddingTop + (1 - item.value / max) * chartHeight,
  }))
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${path} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`

  return (
    <div className="doctor-dashboard-week-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="doctor-dashboard-week-chart-svg" role="img" aria-label="Biểu đồ lịch hẹn tuần">
        {axisValues.map((value) => {
          const y = paddingTop + (1 - value / max) * chartHeight
          return (
            <g key={value}>
              <text x="4" y={y + 4}>{value}</text>
              <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} />
            </g>
          )
        })}
        <path d={areaPath} className="doctor-dashboard-week-chart-area" />
        <path d={path} className="doctor-dashboard-week-chart-line" />
        {points.map((point) => (
          <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="4" className="doctor-dashboard-week-chart-point" />
        ))}
      </svg>
      <div className="doctor-dashboard-week-labels">
        {series.map((item) => <span key={item.label}>{item.label}</span>)}
      </div>
    </div>
  )
}

function SurfaceChartState({ message }) {
  return <div className="doctor-dashboard-chart-empty">{message}</div>
}

function DashboardKpiCard({ item }) {
  return (
    <button className={`doctor-dashboard-kpi-card is-${item.tone}`} type="button" onClick={item.onClick}>
      <span className="doctor-dashboard-kpi-icon"><DoctorIcon name={item.icon} /></span>
      <span className="doctor-dashboard-kpi-copy">
        <span>{item.label}</span>
        <strong>{item.value}</strong>
        <small className={item.deltaTone ? `is-${item.deltaTone}` : ''}>{item.hint}</small>
      </span>
    </button>
  )
}

function QuickActionButton({ action }) {
  return (
    <button className={`doctor-dashboard-quick-card is-${action.tone}${action.locked ? ' is-locked' : ''}`} type="button" onClick={action.onClick}>
      <span className="doctor-dashboard-quick-icon"><DoctorIcon name={action.icon} /></span>
      <strong>{action.label}</strong>
    </button>
  )
}

function DashboardPanel({ title, linkLabel = 'Xem tất cả', onLink, loading, error, empty, children, footer }) {
  return (
    <article className="doctor-dashboard-panel">
      <header className="doctor-dashboard-panel-head">
        <h3>{title}</h3>
        {onLink ? <button className="doctor-dashboard-panel-link" type="button" onClick={onLink}>{linkLabel}</button> : null}
      </header>
      <div className="doctor-dashboard-panel-body">
        {loading ? <LoadingState label="Đang tải dữ liệu..." /> : null}
        {!loading && error ? <ErrorState title="Không thể tải dữ liệu" message={error} /> : null}
        {!loading && !error && empty ? empty : null}
        {!loading && !error ? children : null}
      </div>
      {footer ? <footer className="doctor-dashboard-panel-footer">{footer}</footer> : null}
    </article>
  )
}

function CompactEmpty({ title, description }) {
  return <EmptyState title={title} description={description} />
}

export function DoctorDashboardScreen({ user }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [weekOffset, setWeekOffset] = useState(0)
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const canReadOrders = capabilities.encountersRead || capabilities.canEncounterActions
  const dashboardDate = useMemo(() => getWeekFilterDate(weekOffset), [weekOffset])
  const selectedWeekRange = useMemo(() => getWeekRangeForDate(dashboardDate), [dashboardDate])
  const selectedWeekLabel = WEEK_FILTER_OPTIONS.find((item) => item.value === weekOffset)?.label || 'Tuần này'

  const [dashboardState, reloadDashboard] = useAsyncResource(
    () => loadDoctorDashboard({ doctorId, canReadOrders, dashboardDate, weekRange: selectedWeekRange }),
    [doctorId, canReadOrders, dashboardDate, selectedWeekRange.startDate, selectedWeekRange.endDate],
    {
      doctor: null,
      today_shift: null,
      today_schedules: [],
      week_schedules: [],
      kpis: null,
      appointments_today: [],
      waiting_queue: [],
      active_encounters: [],
      pending_orders: [],
      weekly_overview: null,
    },
    { fallbackMessage: 'Không thể tải doctor dashboard.' },
  )

  usePollingReload(reloadDashboard, Boolean(doctorId), 60000)

  const dashboard = dashboardState.data || {}
  const doctor = dashboard.doctor || null
  const shift = dashboard.today_shift || null
  const appointments = safeArray(dashboard.appointments_today)
  const waitingQueue = safeArray(dashboard.waiting_queue)
  const activeEncounters = safeArray(dashboard.active_encounters)
  const pendingOrders = safeArray(dashboard.pending_orders)
  const weekSchedules = safeArray(dashboard.week_schedules)
  const kpis = dashboard.kpis || {}
  const shiftState = buildShiftState(shift)
  const accountState = buildAccountState(doctor?.status || user?.status)

  const weeklySeries = useMemo(
    () => buildWeeklySeries(dashboard.weekly_overview, selectedWeekRange),
    [dashboard.weekly_overview, selectedWeekRange.startDate],
  )

  const doctorName = doctor?.full_name || user?.fullName || user?.full_name || user?.username || 'Bác sĩ'
  const primaryRole = formatRoleLabel(Array.isArray(user?.roles) && user.roles.length ? user.roles[0] : user?.role)
  const doctorDepartment = shift?.department_name || user?.department_name || user?.departmentName || 'Chưa có phòng khám'
  const doctorSpecialization = user?.specialization || user?.specialty || user?.title || primaryRole
  const scheduleWindowText = shift ? `${formatTime(shift.shift_start)} - ${formatTime(shift.shift_end)}` : 'Chưa có ca làm'
  const doctorAvatar = doctor?.avatar_url || doctor?.avatar || user?.avatar_url || user?.avatar || ''
  const checkedInCount = appointments.filter((item) => ['checked_in', 'in_consultation'].includes(item.status)).length
  const averageWaitMinutes = waitingQueue.length
    ? Math.round(waitingQueue.reduce((total, item) => total + (getMinutesDiff(item.checkin_time) || 0), 0) / waitingQueue.length)
    : 0
  const activeWeekSchedules = weekSchedules.filter((schedule) => ['published', 'active', 'confirmed', 'available'].includes(schedule.status) || !schedule.status)

  function openAppointments(state = {}) {
    navigate('/doctor/appointments', { state })
  }

  function openQueue() {
    guardDoctorAction({
      allowed: capabilities.appointmentsRead || capabilities.queueManage,
      toast,
      permission: 'queue.manage',
      message: 'Vai trò hiện tại không có quyền truy cập hàng chờ.',
      onAllowed: () => navigate('/doctor/queue'),
    })
  }

  function openOrders(state = {}) {
    guardDoctorAction({
      allowed: canReadOrders,
      toast,
      permission: 'encounters.read',
      message: 'Vai trò hiện tại không có quyền truy cập orders.',
      onAllowed: () => navigate('/doctor/orders', { state }),
    })
  }

  function openEncounterFlow() {
    guardDoctorAction({
      allowed: capabilities.canEncounterActions,
      toast,
      permission: 'encounters.write',
      message: 'Bạn không có quyền tạo encounter mới từ dashboard.',
      onAllowed: () => openAppointments({ focusDate: getTodayDate(), selectedStatus: 'checked_in', worklistView: 'active' }),
    })
  }

  const dashboardCards = [
    {
      id: 'appointments',
      label: 'Lịch hẹn hôm nay',
      value: kpis.appointments_today ?? appointments.length,
      hint: checkedInCount ? `${checkedInCount} lượt đã check-in` : 'Theo lịch hẹn trong ngày',
      icon: 'calendar',
      tone: 'blue',
      deltaTone: 'green',
      onClick: () => openAppointments({ focusDate: getTodayDate() }),
    },
    {
      id: 'encounters',
      label: 'Encounter đang hoạt động',
      value: kpis.active_encounters ?? activeEncounters.length,
      hint: activeEncounters.length ? 'Đang xử lý trong ca' : 'Chưa có encounter active',
      icon: 'patients',
      tone: 'purple',
      onClick: () => navigate('/doctor/encounters', { state: { encounterView: 'active' } }),
    },
    {
      id: 'queue',
      label: 'Bệnh nhân đang chờ',
      value: kpis.waiting_patients ?? waitingQueue.length,
      hint: waitingQueue.length ? `${averageWaitMinutes} phút chờ trung bình` : 'Chưa có bệnh nhân chờ',
      icon: 'doctor',
      tone: 'amber',
      deltaTone: waitingQueue.length ? 'red' : undefined,
      onClick: openQueue,
    },
    {
      id: 'orders',
      label: 'Orders chờ xử lý',
      value: canReadOrders ? kpis.pending_orders ?? pendingOrders.length : '--',
      hint: canReadOrders ? 'Chỉ định đang còn mở' : 'Cần encounters.read',
      icon: 'clipboard',
      tone: 'green',
      deltaTone: 'green',
      onClick: () => openOrders(),
    },
  ]

  const quickActions = [
    { id: 'encounter', label: 'Tạo encounter', icon: 'plus', tone: 'blue', onClick: openEncounterFlow, locked: !capabilities.canEncounterActions },
    { id: 'appointments', label: 'Xem lịch hẹn', icon: 'calendar', tone: 'outline-blue', onClick: () => openAppointments({ focusDate: getTodayDate() }), locked: !capabilities.appointmentsRead },
    { id: 'orders', label: 'Mở danh sách orders', icon: 'clipboard', tone: 'purple', onClick: () => openOrders(), locked: !canReadOrders },
    { id: 'queue', label: 'Bệnh nhân đang chờ', icon: 'doctor', tone: 'orange', onClick: openQueue, locked: !(capabilities.appointmentsRead || capabilities.queueManage) },
  ]

  return (
    <div className="doctor-page-stack doctor-dashboard-redesign">
      <section className="doctor-dashboard-hero-card">
        <div className="doctor-dashboard-hero-profile">
          <div className="doctor-dashboard-hero-avatar">
            {doctorAvatar ? <img src={doctorAvatar} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : null}
            <span>{getInitials(doctorName) || 'BS'}</span>
            <i className={`doctor-dashboard-hero-avatar-dot is-${accountState.tone}`} title={accountState.label} aria-label={accountState.label} />
          </div>
          <div className="doctor-dashboard-hero-identity">
            <div className="doctor-dashboard-hero-name">
              <h2>{doctorName}</h2>
              {accountState.active ? <span title={accountState.label}><DoctorIcon name="check_circle" /></span> : null}
            </div>
            <p className="doctor-dashboard-specialty"><DoctorIcon name="pulse" />{doctorSpecialization}</p>
            <div className="doctor-dashboard-hero-details">
              <div className="doctor-dashboard-hero-detail">
                <DoctorIcon name="pin" />
                <span><small>Phòng khám</small><strong>{doctorDepartment}</strong></span>
              </div>
              <div className="doctor-dashboard-hero-detail">
                <DoctorIcon name="calendar" />
                <span><small>Ca làm việc</small><strong>{scheduleWindowText}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className={`doctor-dashboard-shift-card is-${shiftState.tone}`}>
          <div>
            <span className="doctor-dashboard-shift-badge"><i />{shiftState.label}</span>
            <dl>
              <div><dt>Bắt đầu</dt><dd>{shift?.shift_start ? formatTime(shift.shift_start) : '--'}</dd></div>
              <div><dt>Kết thúc</dt><dd>{shift?.shift_end ? formatTime(shift.shift_end) : '--'}</dd></div>
            </dl>
          </div>
          <div className="doctor-dashboard-shift-progress" style={{ '--doctor-shift-progress': `${shiftState.progressPercent}%` }}>
            <span>Còn lại</span>
            <strong>{shiftState.remainingText}</strong>
          </div>
        </div>

        <div className="doctor-dashboard-hero-chart">
          <header>
            <span>
              <strong>Tổng quan {selectedWeekLabel.toLowerCase()}</strong>
              <small>{getWeekRangeLabel(dashboard.weekly_overview)}</small>
            </span>
            <label className="doctor-dashboard-week-filter">
              <select value={weekOffset} onChange={(event) => setWeekOffset(Number(event.target.value))}>
                {WEEK_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <DoctorIcon name="chevron_down" />
            </label>
          </header>
          <DashboardWeekChart series={weeklySeries} loading={dashboardState.loading} error={dashboardState.error} />
          <div className="doctor-dashboard-week-schedule-strip" aria-label="Lịch làm việc theo tuần">
            <span>{activeWeekSchedules.length} ca làm</span>
            <small>{selectedWeekRange.startDate} - {selectedWeekRange.endDate}</small>
          </div>
        </div>
      </section>

      <section className="doctor-dashboard-kpi-grid" aria-label="Chỉ số dashboard">
        {dashboardCards.map((card) => <DashboardKpiCard key={card.id} item={card} />)}
      </section>

      <section className="doctor-dashboard-quick-actions">
        <h2>Thao tác nhanh</h2>
        <div className="doctor-dashboard-quick-grid">
          {quickActions.map((action) => <QuickActionButton key={action.id} action={action} />)}
        </div>
      </section>

      <section className="doctor-dashboard-panels-grid">
        <DashboardPanel
          title="Lịch hẹn hôm nay"
          onLink={() => openAppointments({ focusDate: getTodayDate() })}
          loading={dashboardState.loading}
          error={dashboardState.error && !appointments.length ? dashboardState.error : ''}
          empty={!appointments.length ? <CompactEmpty title="Chưa có lịch hẹn" description="Không có lịch hẹn nào trong ngày hôm nay." /> : null}
          footer={<button type="button" onClick={() => openAppointments({ focusDate: getTodayDate() })}>Xem tất cả lịch hẹn <span>→</span></button>}
        >
          <div className="doctor-dashboard-timeline-list">
            {appointments.slice(0, 5).map((appointment, index) => (
              <button
                key={appointment.appointment_id || appointment.id || index}
                type="button"
                className="doctor-dashboard-appointment-row"
                onClick={() => openAppointments({ focusDate: getTodayDate(), selectedAppointmentId: appointment.appointment_id || appointment.id })}
              >
                <span className="doctor-dashboard-time">{formatTime(appointment.appointment_time)}</span>
                <span className="doctor-dashboard-timeline"><i /></span>
                <span className="doctor-dashboard-list-copy">
                  <strong>{appointment.patient_name || appointment.patient_id || 'Chưa rõ bệnh nhân'}</strong>
                  <small>{appointment.patient_code || appointment.patient_id || '--'}</small>
                </span>
                <StatusBadge status={appointment.status || 'booked'} />
              </button>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Bệnh nhân đang chờ"
          onLink={openQueue}
          loading={dashboardState.loading}
          error={dashboardState.error && !waitingQueue.length ? dashboardState.error : ''}
          empty={!waitingQueue.length ? <CompactEmpty title="Chưa có bệnh nhân chờ" description="Không có ticket chờ nào trong hàng đợi của bác sĩ." /> : null}
          footer={<button type="button" onClick={openQueue}>Xem tất cả hàng chờ <span>→</span></button>}
        >
          <div className="doctor-dashboard-compact-list">
            {waitingQueue.slice(0, 5).map((ticket, index) => (
              <button key={ticket.queue_ticket_id || ticket.id || index} type="button" className="doctor-dashboard-list-row" onClick={openQueue}>
                <span className={`doctor-dashboard-rank-pill${ticket.priority_flag ? ' is-priority' : ''}`}>{ticket.queue_number || index + 1}</span>
                <span className="doctor-dashboard-list-copy">
                  <strong>{ticket.patient_name || ticket.patient_id || 'Chưa rõ bệnh nhân'}</strong>
                  <small>{ticket.patient_code || ticket.patient_id || '--'}</small>
                </span>
                <span className="doctor-dashboard-list-side">
                  {ticket.priority_flag ? <em>Ưu tiên cao</em> : <StatusBadge status={ticket.status || 'waiting'} />}
                  <small>{getWaitText(ticket.checkin_time)}</small>
                </span>
              </button>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Encounter đang hoạt động"
          onLink={() => navigate('/doctor/encounters?view=active')}
          loading={dashboardState.loading}
          error={dashboardState.error && !activeEncounters.length ? dashboardState.error : ''}
          empty={!activeEncounters.length ? <CompactEmpty title="Chưa có encounter active" description="Các phiên khám đang hoạt động sẽ hiển thị tại đây." /> : null}
          footer={<button type="button" onClick={openEncounterFlow}>Tạo encounter mới <span>→</span></button>}
        >
          <div className="doctor-dashboard-compact-list">
            {activeEncounters.slice(0, 5).map((encounter) => (
              <button key={encounter.encounter_id || encounter.id} type="button" className="doctor-dashboard-list-row" onClick={() => navigate(`/doctor/encounters?encounterId=${encodeURIComponent(encounter.encounter_id || encounter.id)}`)}>
                <span className="doctor-dashboard-person-avatar">{getInitials(encounter.patient_name || 'BN')}</span>
                <span className="doctor-dashboard-list-copy">
                  <strong>{encounter.patient_name || encounter.patient_id || 'Chưa rõ bệnh nhân'}</strong>
                  <small>
                    {encounter.patient_code || encounter.patient_id || '--'}
                    {encounter.patient_age ? ` · ${encounter.patient_age} tuổi` : ''}
                  </small>
                </span>
                <span className="doctor-dashboard-list-side">
                  <StatusBadge status={encounter.raw_status || encounter.status || 'in_progress'} />
                  <small>{getElapsedText(encounter.start_time)}</small>
                </span>
              </button>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Orders chờ xử lý"
          onLink={() => openOrders()}
          loading={dashboardState.loading}
          error={dashboardState.error && canReadOrders && !pendingOrders.length ? dashboardState.error : ''}
          empty={!canReadOrders
            ? <CompactEmpty title="Không thể hiển thị orders" description="Role hiện tại cần encounters.read để đọc module orders." />
            : !pendingOrders.length
              ? <CompactEmpty title="Không có order đang mở" description="Các chỉ định đang xử lý sẽ hiển thị ở đây." />
              : null}
          footer={<button type="button" onClick={() => openOrders()}>Xem tất cả orders <span>→</span></button>}
        >
          <div className="doctor-dashboard-compact-list">
            {pendingOrders.slice(0, 5).map((order) => (
              <button key={order.order_id || order.id} type="button" className="doctor-dashboard-list-row" onClick={() => openOrders({ selectedOrderId: order.order_id || order.id })}>
                <span className="doctor-dashboard-order-icon"><DoctorIcon name="clipboard" /></span>
                <span className="doctor-dashboard-list-copy">
                  <strong>{order.title || order.order_code || order.order_id || 'Order'}</strong>
                  <small>{order.patient_name || order.patient_code || order.patient_id || '--'}</small>
                </span>
                <span className="doctor-dashboard-list-side">
                  <StatusBadge status={order.status || 'draft'} />
                  {order.items_count ? <small>{order.items_count} dịch vụ</small> : null}
                </span>
              </button>
            ))}
          </div>
        </DashboardPanel>
      </section>
    </div>
  )
}
