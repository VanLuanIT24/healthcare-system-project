import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Trophy,
  UserRoundX,
  UsersRound,
} from 'lucide-react'
import { doctorApi, getDoctorId } from './doctorApi'
import { safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const DAY_MS = 86400000
const REPORT_DAYS = 7

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(value) {
  const date = toDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function formatDate(value) {
  const date = toDate(value)
  return date ? date.toLocaleDateString('vi-VN') : '-'
}

function formatTime(value) {
  const date = toDate(value)
  return date ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function formatPercent(value) {
  return `${(Math.round(Number(value || 0) * 10) / 10).toLocaleString('vi-VN')}%`
}

function initialsFromName(name = '') {
  return String(name || 'BS')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'BS'
}

function userIdentity(user = {}) {
  const profile = user.profile || user.doctor || {}
  const name = user.full_name || user.fullName || user.name || profile.full_name || profile.name || 'BS. Nguyễn Văn An'
  return {
    name,
    department: user.department_name || profile.department_name || user.department || profile.department || 'Khoa Khám bệnh',
    avatar: user.avatar_url || user.avatar || profile.avatar_url || profile.avatar || '',
    initials: initialsFromName(name),
  }
}

function percent(part, total) {
  if (!total) return 0
  return Math.round((Number(part || 0) / Number(total || 0)) * 1000) / 10
}

function getByPath(source, path) {
  return String(path)
    .split('.')
    .reduce((node, key) => (node && node[key] !== undefined ? node[key] : undefined), source)
}

function numberFrom(source, keys = [], fallback = 0) {
  for (const key of keys) {
    const value = getByPath(source, key)
    if (value !== undefined && value !== null && value !== '') {
      const normalized = Number(value)
      if (!Number.isNaN(normalized)) return normalized
    }
  }
  return fallback
}

function firstArray(source, keys = []) {
  for (const key of keys) {
    const value = getByPath(source, key)
    if (Array.isArray(value)) return value
    if (Array.isArray(value?.items)) return value.items
    if (Array.isArray(value?.data)) return value.data
  }
  if (Array.isArray(source)) return source
  if (Array.isArray(source?.items)) return source.items
  if (Array.isArray(source?.data)) return source.data
  return []
}

function statusOf(item = {}) {
  return String(item.status || item.appointment_status || item.encounter_status || '').toLowerCase()
}

function durationMinutes(item = {}) {
  const direct = numberFrom(item, [
    'avg_duration_minutes',
    'average_duration_minutes',
    'avg_exam_minutes',
    'duration_minutes',
    'consultation_minutes',
  ], NaN)
  if (!Number.isNaN(direct)) return direct
  const start = toDate(item.start_time || item.started_at || item.service_started_at)
  const end = toDate(item.end_time || item.completed_at || item.finished_at || item.service_completed_at)
  if (!start || !end) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function rowDateKey(item = {}) {
  return toDateKey(
    item.date ||
      item.day ||
      item.report_date ||
      item.appointment_date ||
      item.encounter_date ||
      item.created_at ||
      item.start_time ||
      item.started_at ||
      item.completed_at,
  )
}

function extractDailyPayload(reports) {
  return [
    ...firstArray(reports.encounters, ['daily', 'by_day', 'days', 'items', 'data.daily', 'data.by_day']),
    ...firstArray(reports.appointments, ['daily', 'by_day', 'days', 'items', 'data.daily', 'data.by_day']),
    ...firstArray(reports.doctors, ['daily', 'by_day', 'days', 'performance_by_day', 'data.daily']),
    ...firstArray(reports.queue, ['daily', 'by_day', 'days', 'data.daily']),
  ]
}

function normalizeDailyRows(range, reports, rawEncounters = [], rawAppointments = []) {
  const rowsByDate = new Map(range.map((date) => [toDateKey(date), {
    key: toDateKey(date),
    date,
    appointments: 0,
    encounters: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0,
    pending: 0,
    avgMinutes: 0,
  }]))

  extractDailyPayload(reports).forEach((item) => {
    const key = rowDateKey(item)
    if (!rowsByDate.has(key)) return
    const row = rowsByDate.get(key)
    const completed = numberFrom(item, ['completed', 'completed_count', 'completed_encounters', 'done'], 0)
    const noShow = numberFrom(item, ['no_show', 'no_show_count', 'noshow', 'missed'], 0)
    const cancelled = numberFrom(item, ['cancelled', 'canceled', 'cancelled_count', 'patient_cancelled'], 0)
    const pending = numberFrom(item, ['pending', 'waiting', 'scheduled', 'in_progress'], 0)
    row.appointments += numberFrom(item, ['appointments', 'appointment_count', 'scheduled_count', 'total_appointments'], 0)
    row.encounters += numberFrom(item, ['encounters', 'encounter_count', 'total_encounters', 'total'], completed + noShow + cancelled + pending)
    row.completed += completed
    row.noShow += noShow
    row.cancelled += cancelled
    row.pending += pending
    row.avgMinutes = numberFrom(item, ['avg_minutes', 'avg_duration_minutes', 'average_exam_minutes', 'avg_exam_minutes'], row.avgMinutes)
  })

  rawAppointments.forEach((appointment) => {
    const key = rowDateKey(appointment)
    if (!rowsByDate.has(key)) return
    const row = rowsByDate.get(key)
    row.appointments += 1
    if (['no_show', 'noshow', 'missed'].includes(statusOf(appointment))) row.noShow += 1
    if (['cancelled', 'canceled'].includes(statusOf(appointment))) row.cancelled += 1
  })

  rawEncounters.forEach((encounter) => {
    const key = rowDateKey(encounter)
    if (!rowsByDate.has(key)) return
    const row = rowsByDate.get(key)
    row.encounters += 1
    const status = statusOf(encounter)
    if (['completed', 'complete', 'done', 'finished'].includes(status)) row.completed += 1
    else if (['cancelled', 'canceled'].includes(status)) row.cancelled += 1
    else row.pending += 1
    const duration = durationMinutes(encounter)
    if (duration) row.avgMinutes = row.avgMinutes ? Math.round((row.avgMinutes + duration) / 2) : duration
  })

  return Array.from(rowsByDate.values()).map((row) => ({
    ...row,
    appointments: Math.max(row.appointments, row.encounters + row.noShow),
    completionRate: percent(row.completed, row.encounters || row.completed + row.pending + row.cancelled),
    noShowRate: percent(row.noShow, row.appointments || row.encounters + row.noShow),
  }))
}

function extractSpecialties(reports, dailyRows) {
  const source = [
    ...firstArray(reports.encounters, ['by_department', 'departments', 'specialties', 'by_specialty', 'department_performance']),
    ...firstArray(reports.doctors, ['by_department', 'departments', 'specialties', 'by_specialty', 'department_performance']),
  ]
  const rows = source.map((item, index) => ({
    name: item.department_name || item.specialty_name || item.name || item.label || `Chuyên khoa ${index + 1}`,
    value: numberFrom(item, ['encounters', 'encounter_count', 'total_encounters', 'total', 'value'], 0),
  })).filter((item) => item.value > 0)

  if (rows.length) return rows.sort((a, b) => b.value - a.value).slice(0, 6)
  const total = dailyRows.reduce((sum, row) => sum + row.encounters, 0)
  return total ? [{ name: 'Chưa phân khoa', value: total }] : []
}

function extractTotals(reports, dailyRows, queueSummary) {
  const totalEncounters = numberFrom(reports.encounters, [
    'total_encounters',
    'total',
    'summary.total_encounters',
    'summary.total',
    'kpis.total_encounters',
  ], dailyRows.reduce((sum, row) => sum + row.encounters, 0))
  const completed = numberFrom(reports.encounters, [
    'completed',
    'completed_count',
    'summary.completed',
    'summary.completed_count',
    'kpis.completed',
  ], dailyRows.reduce((sum, row) => sum + row.completed, 0))
  const noShow = numberFrom(reports.appointments, [
    'no_show',
    'no_show_count',
    'summary.no_show',
    'summary.no_show_count',
    'kpis.no_show',
  ], dailyRows.reduce((sum, row) => sum + row.noShow, 0))
  const cancelled = numberFrom(reports.encounters, [
    'cancelled',
    'canceled',
    'cancelled_count',
    'summary.cancelled',
    'kpis.cancelled',
  ], dailyRows.reduce((sum, row) => sum + row.cancelled, 0))
  const pending = numberFrom(reports.encounters, [
    'pending',
    'waiting',
    'summary.pending',
    'kpis.pending',
  ], Math.max(0, totalEncounters - completed - cancelled))
  const appointments = numberFrom(reports.appointments, [
    'total_appointments',
    'appointments',
    'total',
    'summary.total',
  ], dailyRows.reduce((sum, row) => sum + row.appointments, 0))
  const avgMinutes = numberFrom(reports.encounters, [
    'avg_duration_minutes',
    'avg_exam_minutes',
    'average_exam_minutes',
    'summary.avg_duration_minutes',
  ], Math.round(dailyRows.reduce((sum, row) => sum + row.avgMinutes, 0) / Math.max(1, dailyRows.filter((row) => row.avgMinutes).length)))
  return {
    totalEncounters,
    completed,
    noShow,
    cancelled,
    pending,
    appointments,
    avgMinutes,
    completionRate: percent(completed, totalEncounters),
    noShowRate: percent(noShow, appointments || totalEncounters + noShow),
    queueWaiting: numberFrom(queueSummary, ['waiting', 'waiting_count', 'summary.waiting'], 0),
  }
}

function extractPrevious(reports) {
  const previous = reports.encounters?.previous || reports.encounters?.previous_period || reports.doctors?.previous || {}
  return {
    totalEncounters: numberFrom(previous, ['total_encounters', 'total'], 0),
    completed: numberFrom(previous, ['completed', 'completed_count'], 0),
    avgMinutes: numberFrom(previous, ['avg_duration_minutes', 'avg_exam_minutes'], 0),
    noShowRate: numberFrom(previous, ['no_show_rate', 'noshow_rate'], 0),
  }
}

function trendText(current, previous, suffix = '%') {
  if (!previous) return 'Dữ liệu kỳ hiện tại'
  const delta = Math.round((current - previous) * 10) / 10
  if (!delta) return `0${suffix} so với kỳ trước`
  return `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toLocaleString('vi-VN')}${suffix} so với kỳ trước`
}

function flattenQueueBoard(board = {}) {
  const normalizedBoard = board || {}
  return [
    ...safeArray(normalizedBoard.waiting),
    ...safeArray(normalizedBoard.called),
    ...safeArray(normalizedBoard.in_service),
    ...safeArray(normalizedBoard.serving),
    ...safeArray(normalizedBoard.completed),
    ...safeArray(normalizedBoard.skipped),
    ...safeArray(normalizedBoard.cancelled),
  ]
}

function extractHourly(queueTickets = [], reports = {}) {
  const hourlyPayload = firstArray(reports.queue, ['hourly', 'by_hour', 'hours', 'data.hourly'])
  const hours = new Map()
  hourlyPayload.forEach((item) => {
    const hour = Number(item.hour ?? item.time ?? item.label)
    if (!Number.isNaN(hour)) hours.set(hour, numberFrom(item, ['count', 'tickets', 'encounters', 'total', 'value'], 0))
  })
  queueTickets.forEach((ticket) => {
    const date = toDate(ticket.checkin_time || ticket.created_at || ticket.called_time || ticket.completed_time)
    if (!date) return
    const hour = date.getHours()
    hours.set(hour, (hours.get(hour) || 0) + 1)
  })
  return Array.from({ length: 11 }, (_, index) => {
    const hour = index + 7
    return { hour, count: hours.get(hour) || 0 }
  })
}

function bestAndWorstDay(rows) {
  const active = rows.filter((row) => row.encounters || row.appointments)
  const sorted = [...active].sort((a, b) => b.completionRate - a.completionRate)
  const noShowSorted = [...active].sort((a, b) => b.noShowRate - a.noShowRate || a.completionRate - b.completionRate)
  return {
    best: sorted[0] || rows[0],
    worst: noShowSorted[0] || rows[0],
  }
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

function KpiCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <article className={`doctor-performance-kpi is-${tone}`}>
      <span><Icon size={30} /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  )
}

function PerformanceDonut({ totals }) {
  const total = totals.totalEncounters || 1
  const completedEnd = percent(totals.completed, total)
  const noShowEnd = completedEnd + percent(totals.noShow, total)
  const cancelledEnd = noShowEnd + percent(totals.cancelled, total)
  return (
    <div className="doctor-performance-donut-wrap">
      <div
        className="doctor-performance-donut"
        style={{
          '--completed-end': `${completedEnd}%`,
          '--noshow-end': `${noShowEnd}%`,
          '--cancelled-end': `${cancelledEnd}%`,
        }}
      >
        <div><strong>{formatNumber(totals.totalEncounters)}</strong><span>Tổng phiên khám</span></div>
      </div>
      <dl>
        <div><dt><i className="is-green" />Hoàn tất</dt><dd>{formatNumber(totals.completed)} ({formatPercent(totals.completionRate)})</dd></div>
        <div><dt><i className="is-red" />No-show</dt><dd>{formatNumber(totals.noShow)} ({formatPercent(totals.noShowRate)})</dd></div>
        <div><dt><i className="is-orange" />Hủy bởi bệnh nhân</dt><dd>{formatNumber(totals.cancelled)} ({formatPercent(percent(totals.cancelled, total))})</dd></div>
        <div><dt><i className="is-purple" />Đang chờ</dt><dd>{formatNumber(totals.pending)} ({formatPercent(percent(totals.pending, total))})</dd></div>
      </dl>
    </div>
  )
}

function LineChart({ rows }) {
  const width = 620
  const height = 224
  const left = 42
  const right = 40
  const top = 22
  const bottom = 34
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxCount = Math.max(10, ...rows.map((row) => row.encounters))
  const point = (row, index, type) => {
    const x = left + (plotWidth / Math.max(1, rows.length - 1)) * index
    const yValue = type === 'rate' ? row.completionRate / 100 : row.encounters / maxCount
    const y = top + plotHeight - plotHeight * Math.min(1, yValue)
    return `${x},${y}`
  }

  return (
    <svg className="doctor-performance-linechart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Hiệu suất theo thời gian">
      {[0, 1, 2, 3, 4].map((line) => {
        const y = top + (plotHeight / 4) * line
        return <line key={line} x1={left} x2={width - right} y1={y} y2={y} />
      })}
      <text x={left} y={16}>Phiên khám</text>
      <text x={width - right - 34} y={16}>Tỷ lệ (%)</text>
      <polyline className="is-blue" points={rows.map((row, index) => point(row, index, 'count')).join(' ')} />
      <polyline className="is-green" points={rows.map((row, index) => point(row, index, 'rate')).join(' ')} />
      {rows.map((row, index) => {
        const [cx, cy] = point(row, index, 'count').split(',')
        const [rx, ry] = point(row, index, 'rate').split(',')
        return (
          <g key={row.key}>
            <circle className="is-blue-dot" cx={cx} cy={cy} r="4" />
            <circle className="is-green-dot" cx={rx} cy={ry} r="4" />
            <text className="x-label" x={cx} y={height - 10}>{formatDate(row.date).slice(0, 5)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ProgressCell({ value }) {
  const tone = value < 85 ? 'orange' : 'green'
  return (
    <span className="doctor-performance-progress">
      <b>{formatPercent(value)}</b>
      <i><em className={`is-${tone}`} style={{ width: `${Math.min(100, value)}%` }} /></i>
    </span>
  )
}

export function DoctorPerformanceReportScreen({ user }) {
  const navigate = useNavigate()
  const toast = useToast()
  const identity = userIdentity(user)
  const [today] = useState(() => toDate(getTodayDate()) || new Date())
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({
    loading: true,
    error: '',
    reports: { doctors: null, appointments: null, encounters: null, queue: null },
    queueSummary: null,
    queueBoard: null,
    labOrders: [],
    labResults: [],
    fetchedAt: null,
  })

  const range = useMemo(() => {
    const end = today
    const start = addDays(end, -(REPORT_DAYS - 1))
    const days = Array.from({ length: REPORT_DAYS }, (_, index) => addDays(start, index))
    return { start, end, days, startKey: toDateKey(start), endKey: toDateKey(end) }
  }, [today])

  useEffect(() => {
    let active = true
    const doctorId = getDoctorId(user)
    const params = {
      doctor_id: doctorId,
      doctorId,
      from: range.startKey,
      to: range.endKey,
      date_from: range.startKey,
      date_to: range.endKey,
    }

    setState((current) => ({ ...current, loading: true, error: '' }))
    Promise.all([
      doctorApi.reports.doctors(params).catch(() => null),
      doctorApi.reports.appointments(params).catch(() => null),
      doctorApi.reports.encounters(params).catch(() => null),
      doctorApi.reports.queue(params).catch(() => null),
      doctorApi.queue.getTodaySummary({ doctor_id: doctorId, doctorId }).catch(() => null),
      doctorId ? doctorApi.queue.getBoard(doctorId, params).catch(() => null) : Promise.resolve(null),
      doctorApi.lab.listOrders(params).catch(() => ({ items: [] })),
      doctorApi.lab.listResults(params).catch(() => ({ items: [] })),
    ])
      .then(([doctors, appointments, encounters, queue, queueSummary, queueBoard, labOrders, labResults]) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          reports: { doctors, appointments, encounters, queue },
          queueSummary,
          queueBoard,
          labOrders: safeArray(labOrders?.items),
          labResults: safeArray(labResults?.items),
          fetchedAt: new Date(),
        })
      })
      .catch((error) => {
        if (!active) return
        setState((current) => ({
          ...current,
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải dữ liệu báo cáo hiệu suất.'),
        }))
      })

    return () => {
      active = false
    }
  }, [range.endKey, range.startKey, reloadKey, user])

  const model = useMemo(() => {
    const dailyRows = normalizeDailyRows(range.days, state.reports)
    const totals = extractTotals(state.reports, dailyRows, state.queueSummary)
    const previous = extractPrevious(state.reports)
    const specialties = extractSpecialties(state.reports, dailyRows)
    const queueTickets = flattenQueueBoard(state.queueBoard)
    const hourly = extractHourly(queueTickets, state.reports)
    const peak = [...hourly].sort((a, b) => b.count - a.count)[0] || { hour: 9, count: 0 }
    const { best, worst } = bestAndWorstDay(dailyRows)
    const labOrdersCount = numberFrom(state.reports.queue, ['lab_orders', 'summary.lab_orders'], state.labOrders.length)
    const labCritical = state.labResults.filter((item) => item.is_critical || item.is_abnormal).length
    return { dailyRows, totals, previous, specialties, hourly, peak, best, worst, labOrdersCount, labCritical }
  }, [range.days, state])

  const handleExport = () => {
    downloadCsv(`hieu-suat-kham-benh-${range.startKey}-${range.endKey}.csv`, [
      ['Ngày', 'Lịch hẹn', 'Encounter', 'Hoàn tất', 'Thời gian khám TB', 'No-show', 'Tỷ lệ no-show', 'Hiệu suất'],
      ...model.dailyRows.map((row) => [
        formatDate(row.date),
        row.appointments,
        row.encounters,
        row.completed,
        `${row.avgMinutes} phút`,
        row.noShow,
        formatPercent(row.noShowRate),
        formatPercent(row.completionRate),
      ]),
    ])
    toast.success('Đã xuất báo cáo hiệu suất từ dữ liệu hiện tại.')
  }

  return (
    <div className="doctor-performance-page">
      <header className="doctor-performance-header">
        <div className="doctor-performance-title">
          <span><BarChart3 size={24} /></span>
          <div>
            <h1>Hiệu suất khám bệnh</h1>
            <p>Báo cáo hiệu suất hoạt động của phòng khám và bác sĩ theo thời gian.</p>
          </div>
        </div>
        <div className="doctor-performance-top-actions">
          <button type="button" className="doctor-performance-range">
            <CalendarDays size={18} />
            {formatDate(range.start)} - {formatDate(range.end)}
            <ChevronDown size={17} />
          </button>
          <div className="doctor-performance-user">
            {identity.avatar ? <img src={identity.avatar} alt={identity.name} /> : <span>{identity.initials}</span>}
            <div>
              <strong>{identity.name}</strong>
              <small>{identity.department}</small>
            </div>
            <ChevronDown size={17} />
          </div>
        </div>
      </header>

      {state.error ? <p className="doctor-performance-error">{state.error}</p> : null}

      <section className="doctor-performance-kpis">
        <KpiCard icon={CalendarDays} tone="blue" label="Tổng phiên khám" value={formatNumber(model.totals.totalEncounters)} hint={trendText(model.totals.totalEncounters, model.previous.totalEncounters)} />
        <KpiCard icon={CheckCircle2} tone="green" label="Tỷ lệ hoàn tất" value={formatPercent(model.totals.completionRate)} hint={trendText(model.totals.completionRate, percent(model.previous.completed, model.previous.totalEncounters))} />
        <KpiCard icon={Clock3} tone="orange" label="Thời gian khám TB" value={`${formatNumber(model.totals.avgMinutes)} phút`} hint={model.previous.avgMinutes ? trendText(model.totals.avgMinutes, model.previous.avgMinutes, ' phút') : 'Tính từ encounter hoàn tất'} />
        <KpiCard icon={UserRoundX} tone="purple" label="Tỷ lệ no-show" value={formatPercent(model.totals.noShowRate)} hint={trendText(model.totals.noShowRate, model.previous.noShowRate)} />
      </section>

      <main className="doctor-performance-grid">
        <section className="doctor-performance-main">
          <div className="doctor-performance-chart-row">
            <article className="doctor-performance-panel doctor-performance-line-panel">
              <header>
                <h2>Hiệu suất theo thời gian</h2>
                <nav><button type="button">7 ngày</button><button type="button">30 ngày</button></nav>
              </header>
              <div className="doctor-performance-legend">
                <span><i className="is-blue" /> Tổng phiên khám</span>
                <span><i className="is-green" /> Tỷ lệ hoàn tất (%)</span>
              </div>
              <LineChart rows={model.dailyRows} />
            </article>

            <article className="doctor-performance-panel doctor-performance-specialty">
              <header>
                <h2>Hiệu suất theo chuyên khoa</h2>
                <button type="button">Tổng phiên khám</button>
              </header>
              <div>
                {model.specialties.map((item) => {
                  const max = Math.max(1, ...model.specialties.map((row) => row.value))
                  return (
                    <p key={item.name}>
                      <span>{item.name}</span>
                      <i><em style={{ width: `${(item.value / max) * 100}%` }} /></i>
                      <b>{formatNumber(item.value)} ({formatPercent(percent(item.value, model.totals.totalEncounters))})</b>
                    </p>
                  )
                })}
                {!model.specialties.length ? <small>Backend chưa trả dữ liệu chuyên khoa trong kỳ này.</small> : null}
              </div>
            </article>
          </div>

          <article className="doctor-performance-panel doctor-performance-table-card">
            <header><h2>Báo cáo hiệu suất theo ngày</h2></header>
            <div className="doctor-performance-table-wrap">
              <table className="doctor-performance-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Ngày khám</th>
                    <th>Lịch hẹn</th>
                    <th>Encounter (khám)</th>
                    <th>Hoàn tất</th>
                    <th>Thời gian khám TB</th>
                    <th>No-show</th>
                    <th>Tỷ lệ no-show</th>
                    <th>Hiệu suất (hoàn tất)</th>
                  </tr>
                </thead>
                <tbody>
                  {model.dailyRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.date.toLocaleDateString('vi-VN', { weekday: 'long' })}</td>
                      <td>{formatDate(row.date)}</td>
                      <td>{formatNumber(row.appointments)}</td>
                      <td>{formatNumber(row.encounters)}</td>
                      <td>{formatNumber(row.completed)}</td>
                      <td>{formatNumber(row.avgMinutes)} phút</td>
                      <td>{formatNumber(row.noShow)}</td>
                      <td>{formatPercent(row.noShowRate)}</td>
                      <td><ProgressCell value={row.completionRate} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2">Tổng</td>
                    <td>{formatNumber(model.dailyRows.reduce((sum, row) => sum + row.appointments, 0))}</td>
                    <td>{formatNumber(model.totals.totalEncounters)}</td>
                    <td>{formatNumber(model.totals.completed)}</td>
                    <td>{formatNumber(model.totals.avgMinutes)} phút</td>
                    <td>{formatNumber(model.totals.noShow)}</td>
                    <td>{formatPercent(model.totals.noShowRate)}</td>
                    <td><ProgressCell value={model.totals.completionRate} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <section className="doctor-performance-bottom">
            <article className="doctor-performance-panel doctor-performance-mini">
              <h2><Clock3 size={20} /> Khung giờ cao điểm</h2>
              <strong>{String(model.peak.hour).padStart(2, '0')}:00 - {String(model.peak.hour + 2).padStart(2, '0')}:00</strong>
              <p>Avg {formatNumber(model.peak.count)} phiên/giờ</p>
              <small>Tỷ lệ hoàn tất <b>{formatPercent(model.totals.completionRate)}</b></small>
              <div>{model.hourly.map((item) => <i key={item.hour} style={{ height: `${18 + percent(item.count, Math.max(1, model.peak.count)) * 0.62}px` }} />)}</div>
            </article>
            <article className="doctor-performance-panel doctor-performance-mini">
              <h2><Trophy size={20} /> Hiệu suất cao nhất</h2>
              <strong>{model.best?.date?.toLocaleDateString('vi-VN', { weekday: 'long' })} - {formatDate(model.best?.date)}</strong>
              <p>Tỷ lệ hoàn tất <b>{formatPercent(model.best?.completionRate)}</b></p>
              <small>Thời gian khám TB <b>{formatNumber(model.best?.avgMinutes)} phút</b></small>
            </article>
            <article className="doctor-performance-panel doctor-performance-mini is-warning">
              <h2><AlertTriangle size={20} /> Cảnh báo giảm hiệu suất</h2>
              <strong>{model.worst?.date?.toLocaleDateString('vi-VN', { weekday: 'long' })} - {formatDate(model.worst?.date)}</strong>
              <p>Tỷ lệ hoàn tất <b>{formatPercent(model.worst?.completionRate)}</b></p>
              <small>No-show <b>{formatPercent(model.worst?.noShowRate)}</b></small>
            </article>
          </section>
        </section>

        <aside className="doctor-performance-side">
          <article className="doctor-performance-panel">
            <header><h2>Tổng quan hiệu suất</h2></header>
            <PerformanceDonut totals={model.totals} />
          </article>

          <article className="doctor-performance-panel doctor-performance-actions">
            <header><h2>Thao tác nhanh</h2></header>
            <button type="button" onClick={handleExport}><span><FileDown size={18} /></span><b>Xuất báo cáo</b><small>Tải báo cáo hiệu suất (CSV)</small></button>
            <button type="button" onClick={() => navigate('/doctor/queue')}><span><UsersRound size={18} /></span><b>Xem hàng đợi</b><small>Xem danh sách hàng đợi hiện tại</small></button>
            <button type="button" onClick={() => navigate('/doctor/reports?view=doctor')}><span><Search size={18} /></span><b>Xem báo cáo bác sĩ</b><small>Báo cáo chi tiết theo từng bác sĩ</small></button>
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={state.loading}><span><RefreshCw size={18} /></span><b>Làm mới dữ liệu</b><small>Cập nhật dữ liệu mới nhất</small></button>
          </article>

          <article className="doctor-performance-panel doctor-performance-info">
            <p><CalendarDays size={17} /><span>Khoảng thời gian</span><b>{formatDate(range.start)} - {formatDate(range.end)} ({REPORT_DAYS} ngày)</b></p>
            <p><RefreshCw size={17} /><span>Cập nhật lần cuối</span><b>{state.fetchedAt ? `${formatDate(state.fetchedAt)} ${formatTime(state.fetchedAt)}` : '-'}</b></p>
            <p><Download size={17} /><span>Chỉ định lab trong kỳ</span><b>{formatNumber(model.labOrdersCount)}</b></p>
            <p><AlertTriangle size={17} /><span>Kết quả lab cần chú ý</span><b>{formatNumber(model.labCritical)}</b></p>
          </article>
        </aside>
      </main>
    </div>
  )
}
