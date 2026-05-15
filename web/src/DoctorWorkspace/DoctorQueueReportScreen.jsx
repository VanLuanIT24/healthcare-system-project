import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileDown,
  ListChecks,
  RefreshCw,
  Timer,
  UsersRound,
} from 'lucide-react'
import { doctorApi, getDoctorId } from './doctorApi'
import { safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './toast/ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const REPORT_DAYS = 7

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(value) {
  const date = toDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

function queueStatus(ticket = {}) {
  return String(ticket.status || ticket.queue_status || '').toLowerCase()
}

function ticketDateKey(ticket = {}) {
  return toDateKey(ticket.checkin_time || ticket.checked_in_at || ticket.called_time || ticket.completed_time || ticket.created_at)
}

function waitMinutes(ticket = {}) {
  const direct = numberFrom(ticket, ['wait_minutes', 'waiting_minutes', 'avg_wait_minutes', 'tat_minutes'], NaN)
  if (!Number.isNaN(direct)) return direct
  const start = toDate(ticket.checkin_time || ticket.checked_in_at || ticket.created_at)
  const end = toDate(ticket.called_time || ticket.service_started_at || ticket.started_at || ticket.completed_time || ticket.updated_at)
  if (!start || !end) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function roomName(ticket = {}) {
  return ticket.room_name || ticket.clinic_room || ticket.room_code || ticket.department_name || ticket.department?.department_name || 'Chưa phân phòng'
}

function flattenBoard(board = {}) {
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

function flattenGroupedQueue(grouped = {}) {
  const normalizedGrouped = grouped || {}
  return [
    ...safeArray(normalizedGrouped.waiting),
    ...safeArray(normalizedGrouped.called),
    ...safeArray(normalizedGrouped.in_service),
    ...safeArray(normalizedGrouped.completed),
    ...safeArray(normalizedGrouped.skipped),
    ...safeArray(normalizedGrouped.cancelled),
  ]
}

function ticketKey(ticket = {}, index = 0) {
  return ticket.queue_ticket_id || ticket.ticket_id || ticket.id || ticket._id || `${ticket.patient_id || ''}-${ticket.checkin_time || ticket.created_at || index}`
}

function uniqueTickets(tickets = []) {
  const seen = new Set()
  return tickets.filter((ticket, index) => {
    const key = ticketKey(ticket, index)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function statusGroup(status) {
  if (['waiting', 'queued', 'pending'].includes(status)) return 'waiting'
  if (['called', 'recalled'].includes(status)) return 'called'
  if (['in_service', 'serving', 'examining', 'in_progress'].includes(status)) return 'serving'
  if (['completed', 'done', 'finished'].includes(status)) return 'completed'
  if (['skipped', 'skip'].includes(status)) return 'skipped'
  if (['cancelled', 'canceled'].includes(status)) return 'skipped'
  return 'waiting'
}

function dailyPayload(report) {
  return firstArray(report, ['daily', 'by_day', 'days', 'queue_by_day', 'data.daily', 'data.by_day'])
}

function normalizeDailyRows(range, report, tickets) {
  const rows = new Map(range.map((date) => [toDateKey(date), {
    key: toDateKey(date),
    date,
    total: 0,
    waiting: 0,
    called: 0,
    serving: 0,
    completed: 0,
    skipped: 0,
    avgWait: 0,
    maxWait: 0,
  }]))

  dailyPayload(report).forEach((item) => {
    const key = toDateKey(item.date || item.day || item.report_date || item.created_at)
    if (!rows.has(key)) return
    const row = rows.get(key)
    row.waiting += numberFrom(item, ['waiting', 'waiting_count', 'pending'], 0)
    row.called += numberFrom(item, ['called', 'calling', 'called_count'], 0)
    row.serving += numberFrom(item, ['serving', 'in_service', 'examining', 'in_progress'], 0)
    row.completed += numberFrom(item, ['completed', 'served', 'done', 'completed_count'], 0)
    row.skipped += numberFrom(item, ['skipped', 'skip', 'cancelled', 'canceled'], 0)
    row.total += numberFrom(item, ['total', 'total_queue', 'queue_count', 'tickets'], row.waiting + row.called + row.serving + row.completed + row.skipped)
    row.avgWait = numberFrom(item, ['avg_wait_minutes', 'average_wait_minutes', 'avg_wait', 'wait_avg'], row.avgWait)
    row.maxWait = numberFrom(item, ['max_wait_minutes', 'longest_wait_minutes', 'max_wait'], row.maxWait)
  })

  tickets.forEach((ticket) => {
    const key = ticketDateKey(ticket)
    if (!rows.has(key)) return
    const row = rows.get(key)
    const group = statusGroup(queueStatus(ticket))
    row.total += 1
    row[group] += 1
    const wait = waitMinutes(ticket)
    if (wait) {
      row.avgWait = row.avgWait ? Math.round((row.avgWait + wait) / 2) : wait
      row.maxWait = Math.max(row.maxWait, wait)
    }
  })

  return Array.from(rows.values()).map((row) => ({
    ...row,
    total: Math.max(row.total, row.waiting + row.called + row.serving + row.completed + row.skipped),
    completionRate: percent(row.completed, row.total),
  }))
}

function extractTotals(report, summary, rows) {
  const total = numberFrom(report, ['total', 'total_queue', 'summary.total', 'kpis.total'], rows.reduce((sum, row) => sum + row.total, 0))
  const waiting = numberFrom(summary, ['waiting', 'waiting_count', 'summary.waiting'], numberFrom(report, ['waiting', 'waiting_count', 'summary.waiting'], rows.reduce((sum, row) => sum + row.waiting, 0)))
  const called = numberFrom(report, ['called', 'called_count', 'summary.called'], rows.reduce((sum, row) => sum + row.called, 0))
  const serving = numberFrom(report, ['serving', 'in_service', 'examining', 'summary.serving'], rows.reduce((sum, row) => sum + row.serving, 0))
  const completed = numberFrom(report, ['completed', 'served', 'completed_count', 'summary.completed'], rows.reduce((sum, row) => sum + row.completed, 0))
  const skipped = numberFrom(report, ['skipped', 'skip', 'cancelled', 'summary.skipped'], rows.reduce((sum, row) => sum + row.skipped, 0))
  const avgWait = numberFrom(report, ['avg_wait_minutes', 'average_wait_minutes', 'summary.avg_wait_minutes'], Math.round(rows.reduce((sum, row) => sum + row.avgWait, 0) / Math.max(1, rows.filter((row) => row.avgWait).length)))
  const maxWait = Math.max(numberFrom(report, ['max_wait_minutes', 'longest_wait_minutes', 'summary.max_wait_minutes'], 0), ...rows.map((row) => row.maxWait))
  return {
    total,
    waiting,
    called,
    serving,
    completed,
    skipped,
    avgWait,
    maxWait,
    completionRate: percent(completed, total),
  }
}

function extractPrevious(report) {
  const previous = report?.previous || report?.previous_period || report?.compare || {}
  return {
    total: numberFrom(previous, ['total', 'total_queue'], 0),
    waiting: numberFrom(previous, ['waiting', 'waiting_count'], 0),
    completed: numberFrom(previous, ['completed', 'served'], 0),
    avgWait: numberFrom(previous, ['avg_wait_minutes', 'average_wait_minutes'], 0),
  }
}

function trendText(current, previous, suffix = '%') {
  if (!previous) return 'Dữ liệu kỳ hiện tại'
  const delta = Math.round((current - previous) * 10) / 10
  if (!delta) return `0${suffix} so với kỳ trước`
  return `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toLocaleString('vi-VN')}${suffix} so với kỳ trước`
}

function extractRoomRows(report, tickets, total) {
  const payload = firstArray(report, ['by_room', 'rooms', 'by_clinic_room', 'room_distribution', 'data.by_room'])
  const rows = payload.map((item, index) => ({
    name: item.room_name || item.room_code || item.name || item.label || `PK ${index + 1}`,
    value: numberFrom(item, ['total', 'tickets', 'queue_count', 'value'], 0),
  })).filter((item) => item.value > 0)
  if (rows.length) return rows.sort((a, b) => b.value - a.value).slice(0, 5)

  const grouped = new Map()
  tickets.forEach((ticket) => grouped.set(roomName(ticket), (grouped.get(roomName(ticket)) || 0) + 1))
  return Array.from(grouped.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)
    || (total ? [{ name: 'Chưa phân phòng', value: total }] : [])
}

function extractHourly(report, tickets) {
  const payload = firstArray(report, ['hourly', 'by_hour', 'hours', 'data.hourly'])
  const map = new Map()
  payload.forEach((item) => {
    const hour = Number(item.hour ?? item.time ?? item.label)
    if (!Number.isNaN(hour)) map.set(hour, numberFrom(item, ['count', 'total', 'tickets', 'value'], 0))
  })
  tickets.forEach((ticket) => {
    const date = toDate(ticket.checkin_time || ticket.checked_in_at || ticket.created_at)
    if (!date) return
    map.set(date.getHours(), (map.get(date.getHours()) || 0) + 1)
  })
  return Array.from({ length: 10 }, (_, index) => {
    const hour = index + 7
    return { hour, count: map.get(hour) || 0 }
  })
}

function bestWorst(rows) {
  const active = rows.filter((row) => row.total)
  const best = [...active].sort((a, b) => a.avgWait - b.avgWait || b.completionRate - a.completionRate)[0] || rows[0]
  const worst = [...active].sort((a, b) => b.avgWait - a.avgWait || b.waiting - a.waiting)[0] || rows[0]
  return { best, worst }
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

function QueueLineChart({ rows }) {
  const width = 620
  const height = 224
  const left = 42
  const right = 44
  const top = 22
  const bottom = 34
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxCount = Math.max(10, ...rows.map((row) => row.total))
  const maxWait = Math.max(10, ...rows.map((row) => row.avgWait))
  const point = (row, index, type) => {
    const x = left + (plotWidth / Math.max(1, rows.length - 1)) * index
    const yValue = type === 'wait' ? row.avgWait / maxWait : row.total / maxCount
    const y = top + plotHeight - plotHeight * Math.min(1, yValue)
    return `${x},${y}`
  }

  return (
    <svg className="doctor-performance-linechart doctor-queue-linechart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Xu hướng hàng đợi theo thời gian">
      {[0, 1, 2, 3, 4].map((line) => {
        const y = top + (plotHeight / 4) * line
        return <line key={line} x1={left} x2={width - right} y1={y} y2={y} />
      })}
      <text x={left} y={16}>Lượt</text>
      <text x={width - right - 18} y={16}>Phút</text>
      <polyline className="is-blue" points={rows.map((row, index) => point(row, index, 'total')).join(' ')} />
      <polyline className="is-green" points={rows.map((row, index) => point(row, index, 'wait')).join(' ')} />
      {rows.map((row, index) => {
        const [cx, cy] = point(row, index, 'total').split(',')
        const [wx, wy] = point(row, index, 'wait').split(',')
        return (
          <g key={row.key}>
            <circle className="is-blue-dot" cx={cx} cy={cy} r="4" />
            <circle className="is-green-dot" cx={wx} cy={wy} r="4" />
            <text className="x-label" x={cx} y={height - 10}>{formatDate(row.date).slice(0, 5)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function QueueDonut({ totals }) {
  const total = totals.total || 1
  const waitingEnd = percent(totals.waiting, total)
  const calledEnd = waitingEnd + percent(totals.called, total)
  const servingEnd = calledEnd + percent(totals.serving, total)
  const completedEnd = servingEnd + percent(totals.completed, total)
  return (
    <div className="doctor-performance-donut-wrap">
      <div
        className="doctor-performance-donut doctor-queue-donut"
        style={{
          '--waiting-end': `${waitingEnd}%`,
          '--called-end': `${calledEnd}%`,
          '--serving-end': `${servingEnd}%`,
          '--completed-end': `${completedEnd}%`,
        }}
      >
        <div><strong>{formatNumber(totals.total)}</strong><span>Tổng lượt</span></div>
      </div>
      <dl>
        <div><dt><i className="is-orange" />Đang chờ</dt><dd>{formatNumber(totals.waiting)} ({formatPercent(percent(totals.waiting, total))})</dd></div>
        <div><dt><i className="is-blue" />Đang gọi</dt><dd>{formatNumber(totals.called)} ({formatPercent(percent(totals.called, total))})</dd></div>
        <div><dt><i className="is-purple" />Đang khám</dt><dd>{formatNumber(totals.serving)} ({formatPercent(percent(totals.serving, total))})</dd></div>
        <div><dt><i className="is-green" />Hoàn tất</dt><dd>{formatNumber(totals.completed)} ({formatPercent(percent(totals.completed, total))})</dd></div>
        <div><dt><i className="is-slate" />Bỏ qua</dt><dd>{formatNumber(totals.skipped)} ({formatPercent(percent(totals.skipped, total))})</dd></div>
      </dl>
    </div>
  )
}

function ProgressCell({ value }) {
  return (
    <span className="doctor-performance-progress">
      <b>{formatPercent(value)}</b>
      <i><em className={value < 84 ? 'is-orange' : 'is-green'} style={{ width: `${Math.min(100, value)}%` }} /></i>
    </span>
  )
}

export function DoctorQueueReportScreen({ user }) {
  const navigate = useNavigate()
  const toast = useToast()
  const identity = userIdentity(user)
  const [today] = useState(() => toDate(getTodayDate()) || new Date())
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({
    loading: true,
    error: '',
    report: null,
    summary: null,
    board: null,
    grouped: null,
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
      doctorApi.reports.queue(params).catch(() => null),
      doctorApi.queue.getTodaySummary({ doctor_id: doctorId, doctorId }).catch(() => null),
      doctorId ? doctorApi.queue.getBoard(doctorId, params).catch(() => null) : Promise.resolve(null),
      doctorApi.queue.listAll(params).catch(() => null),
      doctorApi.lab.listOrders(params).catch(() => ({ items: [] })),
      doctorApi.lab.listResults(params).catch(() => ({ items: [] })),
    ])
      .then(([report, summary, board, grouped, labOrders, labResults]) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          report,
          summary,
          board,
          grouped,
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
          error: getApiErrorMessage(error, 'Không thể tải dữ liệu báo cáo hàng đợi.'),
        }))
      })

    return () => {
      active = false
    }
  }, [range.endKey, range.startKey, reloadKey, user])

  const model = useMemo(() => {
    const tickets = uniqueTickets([...flattenBoard(state.board), ...flattenGroupedQueue(state.grouped)])
    const dailyRows = normalizeDailyRows(range.days, state.report, tickets)
    const totals = extractTotals(state.report, state.summary, dailyRows)
    const previous = extractPrevious(state.report)
    const rooms = extractRoomRows(state.report, tickets, totals.total)
    const hourly = extractHourly(state.report, tickets)
    const peak = [...hourly].sort((a, b) => b.count - a.count)[0] || { hour: 9, count: 0 }
    const { best, worst } = bestWorst(dailyRows)
    const labPending = state.labOrders.filter((item) => ['pending', 'ordered', 'waiting'].includes(String(item.status || '').toLowerCase())).length
    const labCritical = state.labResults.filter((item) => item.is_critical || item.is_abnormal).length
    return { tickets, dailyRows, totals, previous, rooms, hourly, peak, best, worst, labPending, labCritical }
  }, [range.days, state])

  const handleExport = () => {
    downloadCsv(`bao-cao-hang-doi-${range.startKey}-${range.endKey}.csv`, [
      ['Ngày', 'Tổng lượt', 'Đã phục vụ', 'Bỏ qua', 'Chờ TB', 'Chờ lâu nhất', 'Tỷ lệ hoàn tất'],
      ...model.dailyRows.map((row) => [
        formatDate(row.date),
        row.total,
        row.completed,
        row.skipped,
        `${row.avgWait} phút`,
        `${row.maxWait} phút`,
        formatPercent(row.completionRate),
      ]),
    ])
    toast.success('Đã xuất báo cáo hàng đợi từ dữ liệu hiện tại.')
  }

  return (
    <div className="doctor-performance-page doctor-queue-report-page">
      <header className="doctor-performance-header">
        <div className="doctor-performance-title">
          <span><UsersRound size={24} /></span>
          <div>
            <h1>Hàng đợi</h1>
            <p>Báo cáo hiệu suất hàng đợi và thời gian chờ theo thời gian.</p>
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
        <KpiCard icon={UsersRound} tone="blue" label="Tổng lượt hàng đợi" value={formatNumber(model.totals.total)} hint={trendText(model.totals.total, model.previous.total)} />
        <KpiCard icon={Clock3} tone="orange" label="Đang chờ" value={formatNumber(model.totals.waiting)} hint={trendText(model.totals.waiting, model.previous.waiting)} />
        <KpiCard icon={CheckCircle2} tone="green" label="Đã hoàn tất" value={formatNumber(model.totals.completed)} hint={trendText(model.totals.completed, model.previous.completed)} />
        <KpiCard icon={Timer} tone="purple" label="Thời gian chờ trung bình" value={`${formatNumber(model.totals.avgWait)} phút`} hint={model.previous.avgWait ? trendText(model.totals.avgWait, model.previous.avgWait, ' phút') : 'Tính từ ticket hàng đợi'} />
      </section>

      <main className="doctor-performance-grid">
        <section className="doctor-performance-main">
          <div className="doctor-performance-chart-row">
            <article className="doctor-performance-panel doctor-performance-line-panel">
              <header>
                <h2>Xu hướng hàng đợi theo thời gian</h2>
                <nav><button type="button">7 ngày</button><button type="button">30 ngày</button></nav>
              </header>
              <div className="doctor-performance-legend">
                <span><i className="is-blue" /> Tổng lượt hàng đợi</span>
                <span><i className="is-green" /> Thời gian chờ trung bình (phút)</span>
              </div>
              <QueueLineChart rows={model.dailyRows} />
            </article>

            <article className="doctor-performance-panel doctor-performance-specialty doctor-queue-room-panel">
              <header>
                <h2>Phân bổ theo phòng khám</h2>
                <button type="button">Tổng lượt</button>
              </header>
              <div>
                {model.rooms.map((item) => {
                  const max = Math.max(1, ...model.rooms.map((row) => row.value))
                  return (
                    <p key={item.name}>
                      <span>{item.name}</span>
                      <i><em style={{ width: `${(item.value / max) * 100}%` }} /></i>
                      <b>{formatNumber(item.value)} ({formatPercent(percent(item.value, model.totals.total))})</b>
                    </p>
                  )
                })}
                {!model.rooms.length ? <small>Backend chưa trả dữ liệu phòng khám trong kỳ này.</small> : null}
              </div>
            </article>
          </div>

          <article className="doctor-performance-panel doctor-performance-table-card">
            <header><h2>Báo cáo hàng đợi theo ngày</h2></header>
            <div className="doctor-performance-table-wrap">
              <table className="doctor-performance-table doctor-queue-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Tổng lượt</th>
                    <th>Đã phục vụ</th>
                    <th>Bỏ qua</th>
                    <th>Chờ TB</th>
                    <th>Chờ lâu nhất</th>
                    <th>Tỷ lệ hoàn tất</th>
                  </tr>
                </thead>
                <tbody>
                  {model.dailyRows.map((row) => (
                    <tr key={row.key}>
                      <td>{formatDate(row.date)}</td>
                      <td>{formatNumber(row.total)}</td>
                      <td>{formatNumber(row.completed)}</td>
                      <td>{formatNumber(row.skipped)}</td>
                      <td>{formatNumber(row.avgWait)} phút</td>
                      <td>{formatNumber(row.maxWait)} phút</td>
                      <td><ProgressCell value={row.completionRate} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Tổng</td>
                    <td>{formatNumber(model.totals.total)}</td>
                    <td>{formatNumber(model.totals.completed)}</td>
                    <td>{formatNumber(model.totals.skipped)}</td>
                    <td>{formatNumber(model.totals.avgWait)} phút</td>
                    <td>{formatNumber(model.totals.maxWait)} phút</td>
                    <td><ProgressCell value={model.totals.completionRate} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <section className="doctor-performance-bottom doctor-queue-bottom">
            <article className="doctor-performance-panel doctor-performance-mini">
              <h2><Timer size={20} /> Khung giờ đông nhất</h2>
              <strong>{String(model.peak.hour).padStart(2, '0')}:00 - {String(model.peak.hour + 1).padStart(2, '0')}:00</strong>
              <p>Tổng lượt: {formatNumber(model.peak.count)} lượt</p>
              <small>Chiếm <b>{formatPercent(percent(model.peak.count, model.totals.total))}</b> tổng lượt hàng đợi</small>
              <div>{model.hourly.map((item) => <i key={item.hour} style={{ height: `${18 + percent(item.count, Math.max(1, model.peak.count)) * 0.62}px` }} />)}</div>
            </article>
            <article className="doctor-performance-panel doctor-performance-mini">
              <h2><CalendarDays size={20} /> Ngày có thời gian chờ thấp nhất</h2>
              <strong>{formatDate(model.best?.date)}</strong>
              <p>Thời gian chờ TB <b>{formatNumber(model.best?.avgWait)} phút</b></p>
              <small>Chờ lâu nhất <b>{formatNumber(model.best?.maxWait)} phút</b></small>
            </article>
            <article className="doctor-performance-panel doctor-performance-mini is-warning">
              <h2><AlertTriangle size={20} /> Cảnh báo quá tải</h2>
              <strong>{model.rooms[0]?.name || 'Phòng khám'} - {String(model.worst?.date?.getHours?.() || model.peak.hour).padStart(2, '0')}:00</strong>
              <p>Dự báo thời gian chờ <b>{model.worst?.avgWait > 45 ? `> ${formatNumber(model.worst.avgWait)} phút` : `${formatNumber(model.worst?.avgWait)} phút`}</b></p>
              <small>Lượt đang chờ <b>{formatNumber(model.totals.waiting)} lượt</b></small>
            </article>
          </section>
        </section>

        <aside className="doctor-performance-side">
          <article className="doctor-performance-panel">
            <header><h2>Tổng quan hàng đợi</h2></header>
            <QueueDonut totals={model.totals} />
          </article>

          <article className="doctor-performance-panel doctor-performance-actions">
            <header><h2>Thao tác nhanh</h2></header>
            <button type="button" onClick={handleExport}><span><FileDown size={18} /></span><b>Xuất báo cáo</b><small>Tải báo cáo hàng đợi (CSV)</small></button>
            <button type="button" onClick={() => navigate('/doctor/queue')}><span><ListChecks size={18} /></span><b>Xem bảng hàng đợi</b><small>Xem hàng đợi hiện tại theo phòng khám</small></button>
            <button type="button" onClick={() => navigate('/doctor/queue?view=history')}><span><Clock3 size={18} /></span><b>Xem lịch sử hàng đợi</b><small>Xem lịch sử hàng đợi theo thời gian</small></button>
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={state.loading}><span><RefreshCw size={18} /></span><b>Làm mới dữ liệu</b><small>Cập nhật dữ liệu mới nhất</small></button>
          </article>

          <article className="doctor-performance-panel doctor-performance-info">
            <p><CalendarDays size={17} /><span>Khoảng thời gian</span><b>{formatDate(range.start)} - {formatDate(range.end)} ({REPORT_DAYS} ngày)</b></p>
            <p><RefreshCw size={17} /><span>Cập nhật lần cuối</span><b>{state.fetchedAt ? `${formatDate(state.fetchedAt)} ${formatTime(state.fetchedAt)}` : '-'}</b></p>
            <p><Download size={17} /><span>Lab đang chờ</span><b>{formatNumber(model.labPending)}</b></p>
            <p><AlertTriangle size={17} /><span>Kết quả lab cần chú ý</span><b>{formatNumber(model.labCritical)}</b></p>
          </article>
        </aside>
      </main>
    </div>
  )
}
