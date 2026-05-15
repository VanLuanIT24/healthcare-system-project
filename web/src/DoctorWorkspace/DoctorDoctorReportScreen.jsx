import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  FileDown,
  Pill,
  RefreshCw,
  Stethoscope,
  Trophy,
  UserRound,
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

function rowDateKey(item = {}) {
  return toDateKey(item.date || item.day || item.report_date || item.created_at || item.started_at || item.completed_at || item.prescribed_at)
}

function statusOf(item = {}) {
  return String(item.status || item.encounter_status || item.appointment_status || '').toLowerCase()
}

function doctorName(item = {}, fallback = 'Bác sĩ') {
  return item.doctor_name || item.full_name || item.name || item.doctor?.full_name || fallback
}

function departmentName(item = {}) {
  return item.department_name || item.specialty_name || item.department || item.doctor?.department_name || 'Khoa Khám bệnh'
}

function normalizeDoctorRows(report, user, totalsFallback) {
  const source = firstArray(report, ['doctors', 'items', 'by_doctor', 'doctor_performance', 'data.doctors', 'data.items'])
  const rows = source.map((item, index) => {
    const encounters = numberFrom(item, ['encounters', 'encounter_count', 'total_encounters', 'total'], 0)
    const completed = numberFrom(item, ['completed', 'completed_count', 'completed_encounters'], 0)
    const prescriptions = numberFrom(item, ['prescriptions', 'prescription_count', 'total_prescriptions'], 0)
    const orders = numberFrom(item, ['orders', 'order_count', 'lab_orders', 'total_orders'], 0)
    const noShow = numberFrom(item, ['no_show', 'no_show_count', 'noshow'], 0)
    return {
      id: item.doctor_id || item.id || item._id || `${index}`,
      name: doctorName(item, `Bác sĩ ${index + 1}`),
      department: departmentName(item),
      avatar: item.avatar_url || item.avatar || item.doctor?.avatar_url || '',
      encounters,
      completed,
      completionRate: numberFrom(item, ['completion_rate', 'completed_rate', 'rate'], percent(completed, encounters)),
      prescriptions,
      orders,
      avgMinutes: numberFrom(item, ['avg_exam_minutes', 'avg_duration_minutes', 'average_exam_minutes'], 0),
      noShow,
      pendingSign: numberFrom(item, ['pending_signature', 'unsigned', 'pending_consultations'], 0),
    }
  }).filter((item) => item.encounters || item.completed || item.prescriptions || item.orders)

  if (rows.length) return rows.sort((a, b) => b.completionRate - a.completionRate).slice(0, 8)

  const identity = userIdentity(user)
  return [{
    id: getDoctorId(user) || 'current',
    name: identity.name,
    department: identity.department,
    avatar: identity.avatar,
    encounters: totalsFallback.encounters,
    completed: totalsFallback.completed,
    completionRate: percent(totalsFallback.completed, totalsFallback.encounters),
    prescriptions: totalsFallback.prescriptions,
    orders: totalsFallback.orders,
    avgMinutes: totalsFallback.avgMinutes,
    noShow: totalsFallback.noShow,
    pendingSign: totalsFallback.pendingSign,
  }]
}

function normalizeDailyRows(range, reports, prescriptions) {
  const rows = new Map(range.map((date) => [toDateKey(date), {
    key: toDateKey(date),
    date,
    encounters: 0,
    prescriptions: 0,
  }]))

  ;[
    ...firstArray(reports.doctors, ['daily', 'by_day', 'days', 'data.daily']),
    ...firstArray(reports.encounters, ['daily', 'by_day', 'days', 'data.daily']),
  ].forEach((item) => {
    const key = rowDateKey(item)
    if (!rows.has(key)) return
    const row = rows.get(key)
    row.encounters += numberFrom(item, ['encounters', 'encounter_count', 'total_encounters', 'total'], 0)
    row.prescriptions += numberFrom(item, ['prescriptions', 'prescription_count', 'total_prescriptions'], 0)
  })

  prescriptions.forEach((item) => {
    const key = rowDateKey(item)
    if (rows.has(key)) rows.get(key).prescriptions += 1
  })

  return Array.from(rows.values())
}

function extractTotals(reports, rows, prescriptions, orders, labOrders) {
  const encounters = numberFrom(reports.doctors, ['total_encounters', 'encounters', 'summary.total_encounters', 'kpis.total_encounters'], numberFrom(reports.encounters, ['total', 'total_encounters', 'summary.total'], rows.reduce((sum, row) => sum + row.encounters, 0)))
  const completed = numberFrom(reports.doctors, ['completed', 'completed_count', 'summary.completed'], numberFrom(reports.encounters, ['completed', 'completed_count', 'summary.completed'], 0))
  const totalPatients = numberFrom(reports.doctors, ['total_patients', 'patients', 'unique_patients', 'summary.total_patients'], 0)
  const prescriptionsCount = numberFrom(reports.doctors, ['prescriptions', 'prescription_count', 'total_prescriptions', 'summary.prescriptions'], prescriptions.length || rows.reduce((sum, row) => sum + row.prescriptions, 0))
  const ordersCount = numberFrom(reports.doctors, ['orders', 'order_count', 'lab_orders', 'total_orders', 'summary.orders'], (orders.length || 0) + (labOrders.length || 0))
  const noShow = numberFrom(reports.appointments, ['no_show', 'no_show_count', 'summary.no_show'], 0)
  const pendingSign = numberFrom(reports.doctors, ['pending_signature', 'unsigned', 'pending_consultations', 'summary.pending_signature'], 0)
  const avgMinutes = numberFrom(reports.doctors, ['avg_exam_minutes', 'avg_duration_minutes', 'average_exam_minutes', 'summary.avg_exam_minutes'], 0)
  return {
    encounters,
    completed: completed || Math.round(encounters * 0),
    totalPatients,
    prescriptions: prescriptionsCount,
    orders: ordersCount,
    noShow,
    pendingSign,
    avgMinutes,
    completionRate: percent(completed, encounters),
  }
}

function extractPrevious(report) {
  const previous = report?.previous || report?.previous_period || report?.compare || {}
  return {
    encounters: numberFrom(previous, ['total_encounters', 'encounters', 'total'], 0),
    patients: numberFrom(previous, ['total_patients', 'patients', 'unique_patients'], 0),
    prescriptions: numberFrom(previous, ['prescriptions', 'total_prescriptions'], 0),
    orders: numberFrom(previous, ['orders', 'total_orders'], 0),
  }
}

function trendText(current, previous, suffix = '%') {
  if (!previous) return 'Dữ liệu kỳ hiện tại'
  const delta = Math.round((current - previous) * 10) / 10
  if (!delta) return `0${suffix} so với kỳ trước`
  return `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toLocaleString('vi-VN')}${suffix} so với kỳ trước`
}

function bestRows(rows) {
  const byRate = [...rows].sort((a, b) => b.completionRate - a.completionRate)[0] || rows[0]
  const byRx = [...rows].sort((a, b) => b.prescriptions - a.prescriptions)[0] || rows[0]
  const pending = rows.reduce((sum, row) => sum + row.pendingSign, 0)
  return { byRate, byRx, pending }
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

function DoctorBars({ rows }) {
  const max = 100
  return (
    <div className="doctor-report-bars">
      {rows.slice(0, 5).map((row) => (
        <div key={row.id}>
          <b>{formatPercent(row.completionRate)}</b>
          <i><em style={{ height: `${Math.max(8, Math.min(100, row.completionRate) / max * 150)}px` }} /></i>
          <span>{row.name}</span>
        </div>
      ))}
    </div>
  )
}

function ActivityLineChart({ rows }) {
  const width = 620
  const height = 224
  const left = 42
  const right = 34
  const top = 22
  const bottom = 34
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const max = Math.max(10, ...rows.flatMap((row) => [row.encounters, row.prescriptions]))
  const point = (row, index, key) => {
    const x = left + (plotWidth / Math.max(1, rows.length - 1)) * index
    const y = top + plotHeight - plotHeight * Math.min(1, row[key] / max)
    return `${x},${y}`
  }
  return (
    <svg className="doctor-performance-linechart doctor-report-linechart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Hoạt động theo thời gian">
      {[0, 1, 2, 3, 4].map((line) => {
        const y = top + (plotHeight / 4) * line
        return <line key={line} x1={left} x2={width - right} y1={y} y2={y} />
      })}
      <polyline className="is-blue" points={rows.map((row, index) => point(row, index, 'encounters')).join(' ')} />
      <polyline className="is-green" points={rows.map((row, index) => point(row, index, 'prescriptions')).join(' ')} />
      {rows.map((row, index) => {
        const [x, y] = point(row, index, 'encounters').split(',')
        const [gx, gy] = point(row, index, 'prescriptions').split(',')
        return (
          <g key={row.key}>
            <circle className="is-blue-dot" cx={x} cy={y} r="4" />
            <circle className="is-green-dot" cx={gx} cy={gy} r="4" />
            <text className="x-label" x={x} y={height - 10}>{formatDate(row.date).slice(0, 5)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DoctorDonut({ totals }) {
  const total = totals.encounters || 1
  const completedEnd = percent(totals.completed, total)
  const pendingEnd = completedEnd + percent(totals.pendingSign, total)
  const rxEnd = pendingEnd + percent(totals.prescriptions, totals.encounters + totals.prescriptions)
  return (
    <div className="doctor-performance-donut-wrap">
      <div
        className="doctor-performance-donut doctor-report-donut"
        style={{
          '--completed-end': `${completedEnd}%`,
          '--pending-end': `${pendingEnd}%`,
          '--rx-end': `${rxEnd}%`,
        }}
      >
        <div><strong>{formatNumber(totals.encounters)}</strong><span>Phiên khám</span></div>
      </div>
      <dl>
        <div><dt><i className="is-green" />Hoàn tất</dt><dd>{formatNumber(totals.completed)} ({formatPercent(percent(totals.completed, total))})</dd></div>
        <div><dt><i className="is-orange" />Chờ ký</dt><dd>{formatNumber(totals.pendingSign)} ({formatPercent(percent(totals.pendingSign, total))})</dd></div>
        <div><dt><i className="is-purple" />Đơn thuốc đang hoạt động</dt><dd>{formatNumber(totals.prescriptions)} ({formatPercent(percent(totals.prescriptions, totals.encounters + totals.prescriptions))})</dd></div>
        <div><dt><i className="is-blue" />Phiên khám hoàn tất</dt><dd>{formatNumber(totals.completed)} ({formatPercent(percent(totals.completed, total))})</dd></div>
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

export function DoctorDoctorReportScreen({ user }) {
  const navigate = useNavigate()
  const toast = useToast()
  const identity = userIdentity(user)
  const [today] = useState(() => toDate(getTodayDate()) || new Date())
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({
    loading: true,
    error: '',
    reports: { doctors: null, encounters: null, appointments: null, queue: null },
    prescriptions: [],
    orders: [],
    labOrders: [],
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
      doctorApi.reports.encounters(params).catch(() => null),
      doctorApi.reports.appointments(params).catch(() => null),
      doctorApi.reports.queue(params).catch(() => null),
      doctorId ? doctorApi.prescriptions.listByDoctor(doctorId, params).catch(() => []) : Promise.resolve([]),
      doctorId ? doctorApi.orders.listByDoctorPage(doctorId, params).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      doctorApi.lab.listOrders(params).catch(() => ({ items: [] })),
    ])
      .then(([doctors, encounters, appointments, queue, prescriptions, orders, labOrders]) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          reports: { doctors, encounters, appointments, queue },
          prescriptions: safeArray(prescriptions),
          orders: safeArray(orders?.items),
          labOrders: safeArray(labOrders?.items),
          fetchedAt: new Date(),
        })
      })
      .catch((error) => {
        if (!active) return
        setState((current) => ({
          ...current,
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải dữ liệu báo cáo bác sĩ.'),
        }))
      })

    return () => {
      active = false
    }
  }, [range.endKey, range.startKey, reloadKey, user])

  const model = useMemo(() => {
    const dailyRows = normalizeDailyRows(range.days, state.reports, state.prescriptions)
    const totals = extractTotals(state.reports, dailyRows, state.prescriptions, state.orders, state.labOrders)
    const doctorRows = normalizeDoctorRows(state.reports.doctors, user, totals)
    const previous = extractPrevious(state.reports.doctors)
    const best = bestRows(doctorRows)
    return { dailyRows, totals, doctorRows, previous, best }
  }, [range.days, state, user])

  const handleExport = () => {
    downloadCsv(`bao-cao-bac-si-${range.startKey}-${range.endKey}.csv`, [
      ['Bác sĩ', 'Chuyên khoa', 'Phiên khám', 'Hoàn tất', 'Tỷ lệ hoàn tất', 'Đơn thuốc', 'Chỉ định', 'Thời gian khám TB', 'No-show'],
      ...model.doctorRows.map((row) => [
        row.name,
        row.department,
        row.encounters,
        row.completed,
        formatPercent(row.completionRate),
        row.prescriptions,
        row.orders,
        `${row.avgMinutes} phút`,
        row.noShow,
      ]),
    ])
    toast.success('Đã xuất báo cáo bác sĩ từ dữ liệu hiện tại.')
  }

  return (
    <div className="doctor-performance-page doctor-report-page">
      <header className="doctor-performance-header">
        <div className="doctor-performance-title">
          <span><UserRound size={24} /></span>
          <div>
            <h1>Báo cáo bác sĩ</h1>
            <p>Báo cáo chi tiết hoạt động và hiệu suất của bác sĩ.</p>
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
        <KpiCard icon={CalendarDays} tone="blue" label="Tổng phiên khám" value={formatNumber(model.totals.encounters)} hint={trendText(model.totals.encounters, model.previous.encounters)} />
        <KpiCard icon={UsersRound} tone="green" label="Tổng bệnh nhân" value={formatNumber(model.totals.totalPatients)} hint={trendText(model.totals.totalPatients, model.previous.patients)} />
        <KpiCard icon={Pill} tone="orange" label="Đơn thuốc đã kê" value={formatNumber(model.totals.prescriptions)} hint={trendText(model.totals.prescriptions, model.previous.prescriptions)} />
        <KpiCard icon={Stethoscope} tone="purple" label="Chỉ định đã tạo" value={formatNumber(model.totals.orders)} hint={trendText(model.totals.orders, model.previous.orders)} />
      </section>

      <main className="doctor-performance-grid">
        <section className="doctor-performance-main">
          <div className="doctor-performance-chart-row">
            <article className="doctor-performance-panel doctor-report-bars-panel">
              <header>
                <h2>So sánh hiệu suất bác sĩ</h2>
                <button type="button">Theo tỷ lệ hoàn tất (%)</button>
              </header>
              <DoctorBars rows={model.doctorRows} />
            </article>

            <article className="doctor-performance-panel doctor-performance-line-panel">
              <header>
                <h2>Hoạt động theo thời gian</h2>
                <nav><button type="button">7 ngày</button><button type="button">30 ngày</button></nav>
              </header>
              <div className="doctor-performance-legend">
                <span><i className="is-blue" /> Phiên khám</span>
                <span><i className="is-green" /> Đơn thuốc</span>
              </div>
              <ActivityLineChart rows={model.dailyRows} />
            </article>
          </div>

          <article className="doctor-performance-panel doctor-performance-table-card">
            <header><h2>Hiệu suất theo bác sĩ</h2></header>
            <div className="doctor-performance-table-wrap">
              <table className="doctor-performance-table doctor-report-table">
                <thead>
                  <tr>
                    <th>Bác sĩ</th>
                    <th>Chuyên khoa</th>
                    <th>Phiên khám</th>
                    <th>Hoàn tất</th>
                    <th>Tỷ lệ hoàn tất (%)</th>
                    <th>Đơn thuốc</th>
                    <th>Chỉ định</th>
                    <th>Thời gian khám TB</th>
                    <th>No-show</th>
                  </tr>
                </thead>
                <tbody>
                  {model.doctorRows.map((row) => (
                    <tr key={row.id}>
                      <td><span className="doctor-report-person">{row.avatar ? <img src={row.avatar} alt={row.name} /> : <i>{initialsFromName(row.name)}</i>}<b>{row.name}</b></span></td>
                      <td>{row.department}</td>
                      <td>{formatNumber(row.encounters)}</td>
                      <td>{formatNumber(row.completed)}</td>
                      <td>{formatPercent(row.completionRate)}</td>
                      <td>{formatNumber(row.prescriptions)}</td>
                      <td>{formatNumber(row.orders)}</td>
                      <td>{formatNumber(row.avgMinutes)} phút</td>
                      <td>{formatNumber(row.noShow)} ({formatPercent(percent(row.noShow, row.encounters + row.noShow))}) <ProgressCell value={100 - percent(row.noShow, row.encounters + row.noShow)} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Tổng</td>
                    <td />
                    <td>{formatNumber(model.totals.encounters)}</td>
                    <td>{formatNumber(model.totals.completed)}</td>
                    <td>{formatPercent(model.totals.completionRate)}</td>
                    <td>{formatNumber(model.totals.prescriptions)}</td>
                    <td>{formatNumber(model.totals.orders)}</td>
                    <td>{formatNumber(model.totals.avgMinutes)} phút</td>
                    <td>{formatNumber(model.totals.noShow)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <section className="doctor-performance-bottom doctor-report-bottom">
            <article className="doctor-performance-panel doctor-performance-mini">
              <h2><Trophy size={20} /> Bác sĩ có hiệu suất cao nhất</h2>
              <strong>{model.best.byRate?.name || '-'}</strong>
              <p>Tỷ lệ hoàn tất <b>{formatPercent(model.best.byRate?.completionRate)}</b></p>
              <small>Phiên khám <b>{formatNumber(model.best.byRate?.encounters)}</b></small>
            </article>
            <article className="doctor-performance-panel doctor-performance-mini">
              <h2><Pill size={20} /> Bác sĩ kê đơn nhiều nhất</h2>
              <strong>{model.best.byRx?.name || '-'}</strong>
              <p>Đơn thuốc đã kê <b>{formatNumber(model.best.byRx?.prescriptions)}</b></p>
              <small>Chiếm <b>{formatPercent(percent(model.best.byRx?.prescriptions, model.totals.prescriptions))}</b></small>
            </article>
            <article className="doctor-performance-panel doctor-performance-mini is-warning">
              <h2><AlertTriangle size={20} /> Cảnh báo cần bổ sung ký</h2>
              <strong>{formatNumber(model.best.pending || model.totals.pendingSign)}</strong>
              <p>Phiên khám <b>{formatNumber(model.best.pending || model.totals.pendingSign)}</b></p>
              <small>Tỷ lệ <b>{formatPercent(percent(model.best.pending || model.totals.pendingSign, model.totals.encounters))}</b></small>
            </article>
          </section>
        </section>

        <aside className="doctor-performance-side">
          <article className="doctor-performance-panel">
            <header><h2>Tổng quan bác sĩ</h2></header>
            <DoctorDonut totals={model.totals} />
          </article>

          <article className="doctor-performance-panel doctor-performance-actions">
            <header><h2>Thao tác nhanh</h2></header>
            <button type="button" onClick={handleExport}><span><FileDown size={18} /></span><b>Xuất báo cáo bác sĩ</b><small>Tải báo cáo chi tiết theo khoảng thời gian</small></button>
            <button type="button" onClick={() => navigate('/doctor/reports?view=performance')}><span><BarChart3 size={18} /></span><b>Xem hiệu suất khám bệnh</b><small>Phân tích chi tiết hiệu suất khám</small></button>
            <button type="button" onClick={() => navigate('/doctor/reports?view=queue')}><span><UsersRound size={18} /></span><b>Xem hàng đợi</b><small>Xem danh sách hàng đợi hiện tại</small></button>
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={state.loading}><span><RefreshCw size={18} /></span><b>Làm mới dữ liệu</b><small>Cập nhật dữ liệu mới nhất</small></button>
          </article>

          <article className="doctor-performance-panel doctor-performance-info">
            <p><CalendarDays size={17} /><span>Thời gian báo cáo</span><b>{state.fetchedAt ? `${formatDate(state.fetchedAt)} - ${formatTime(state.fetchedAt)}` : '-'}</b></p>
            <p><RefreshCw size={17} /><span>Cập nhật lần cuối</span><b>{state.fetchedAt ? `${formatDate(state.fetchedAt)} - ${formatTime(state.fetchedAt)}` : '-'}</b></p>
            <p><Download size={17} /><span>Khoảng thời gian</span><b>{formatDate(range.start)} - {formatDate(range.end)}</b></p>
          </article>
        </aside>
      </main>
    </div>
  )
}
