import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Không thể tải hiệu suất làm việc.')
  return payload?.data || payload
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function dateKey(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function hourOf(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? 0 : date.getHours()
}

function buildStaffRows(appointments, doctors) {
  const doctorMap = new Map()
  doctors.forEach((doctor, index) => {
    const id = String(doctor.user_id || doctor._id || doctor.id || `doctor-${index}`)
    doctorMap.set(id, doctor.full_name || doctor.name || doctor.username || `Nhân sự ${index + 1}`)
  })

  const rows = new Map()
  appointments.forEach((appointment) => {
    const doctorId = String(appointment.doctor_id || appointment.doctorId || '')
    const name = appointment.doctor_name || appointment.doctorName || doctorMap.get(doctorId) || 'Chưa rõ nhân sự'
    if (!rows.has(name)) {
      rows.set(name, { name, shift: 'Theo lịch', processed: 0, checkedIn: 0, completed: 0, cancelled: 0 })
    }
    const row = rows.get(name)
    row.processed += 1
    if (['checked_in', 'in_consultation', 'completed'].includes(appointment.status)) row.checkedIn += 1
    if (appointment.status === 'completed') row.completed += 1
    if (['cancelled', 'no_show'].includes(appointment.status)) row.cancelled += 1
  })

  return [...rows.values()]
    .map((row) => ({
      ...row,
      completionRate: row.processed ? Math.round((row.completed / row.processed) * 100) : 0,
      checkInRate: row.processed ? Math.round((row.checkedIn / row.processed) * 100) : 0,
      score: Math.round(row.processed * 0.45 + row.checkedIn * 0.3 + row.completed * 0.25),
    }))
    .sort((a, b) => b.score - a.score)
}

export default function ReceptionistProductivityPage() {
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState('all')

  const today = useMemo(() => new Date(), [])
  const startDate = useMemo(() => {
    const date = new Date(today)
    date.setDate(date.getDate() - 6)
    return date
  }, [today])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [appointmentsPayload, doctorsPayload] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/appointments?limit=300`).then(readJson),
        fetchWithAuth(`${API_BASE_URL}/staff/doctors`).then(readJson).catch(() => []),
      ])
      setAppointments(itemsFrom(appointmentsPayload))
      setDoctors(itemsFrom(doctorsPayload))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const staffRows = useMemo(() => buildStaffRows(appointments, doctors), [appointments, doctors])
  const filteredRows = useMemo(
    () => staff === 'all' ? staffRows : staffRows.filter((row) => row.name === staff),
    [staff, staffRows],
  )

  const stats = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + row.processed, 0)
    const checkedIn = filteredRows.reduce((sum, row) => sum + row.checkedIn, 0)
    const completed = filteredRows.reduce((sum, row) => sum + row.completed, 0)
    const cancelled = filteredRows.reduce((sum, row) => sum + row.cancelled, 0)
    return {
      total,
      checkedIn,
      completed,
      cancelled,
      checkInRate: total ? Math.round((checkedIn / total) * 100) : 0,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      cancelRate: total ? Math.round((cancelled / total) * 100) : 0,
    }
  }, [filteredRows])

  const trendDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + index)
      const key = date.toISOString().slice(0, 10)
      const dayItems = appointments.filter((item) => dateKey(item.appointment_time) === key)
      return {
        label: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        processed: dayItems.length,
        checked: dayItems.filter((item) => ['checked_in', 'in_consultation', 'completed'].includes(item.status)).length,
        completed: dayItems.filter((item) => item.status === 'completed').length,
      }
    })
  }, [appointments, startDate])

  const statusBreakdown = useMemo(() => {
    const labels = {
      booked: 'Đã đặt',
      confirmed: 'Đã xác nhận',
      checked_in: 'Đã check-in',
      in_consultation: 'Đang khám',
      completed: 'Hoàn tất',
      cancelled: 'Đã hủy',
      no_show: 'Không đến',
    }
    return Object.entries(labels)
      .map(([status, label]) => ({ status, label, count: appointments.filter((item) => item.status === status).length }))
      .filter((item) => item.count > 0)
  }, [appointments])

  const heatmap = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, index) => 7 + index)
    const max = Math.max(1, ...hours.map((hour) => appointments.filter((item) => hourOf(item.appointment_time) === hour).length))
    return hours.map((hour) => {
      const count = appointments.filter((item) => hourOf(item.appointment_time) === hour).length
      return { hour, count, intensity: count ? Math.max(0.18, count / max) : 0.08 }
    })
  }, [appointments])

  const maxProcessed = Math.max(1, ...filteredRows.map((row) => row.processed))
  const maxTrend = Math.max(1, ...trendDays.flatMap((item) => [item.processed, item.checked, item.completed]))
  const topStaff = filteredRows.slice(0, 3)

  return (
    <ReceptionistShell
      title="Hiệu suất làm việc"
      subtitle="Theo dõi năng suất tiếp đón và xử lý lịch hẹn dựa trên dữ liệu thực"
      activeSection="productivity"
    >
      <div className="productivity-layout">
        <div className="productivity-main">
          <div className="rd-stats productivity-stats">
            <article className="rd-stat purple">
              <div className="rd-stat-head"><span>Lịch xử lý</span><div className="rd-stat-icon purple"><Icon name="users" /></div></div>
              <div className="rd-stat-body"><strong>{loading ? '...' : stats.total}</strong><span>Tổng lịch tải từ hệ thống</span></div>
            </article>
            <article className="rd-stat blue">
              <div className="rd-stat-head"><span>Đã check-in</span><div className="rd-stat-icon blue"><Icon name="clock" /></div></div>
              <div className="rd-stat-body"><strong>{stats.checkedIn}</strong><span>{stats.checkInRate}% tổng lịch</span></div>
            </article>
            <article className="rd-stat green">
              <div className="rd-stat-head"><span>Hoàn tất</span><div className="rd-stat-icon green"><Icon name="check" /></div></div>
              <div className="rd-stat-body"><strong>{stats.completed}</strong><span>{stats.completionRate}% tổng lịch</span></div>
            </article>
            <article className="rd-stat violet">
              <div className="rd-stat-head"><span>Tỷ lệ hoàn tất</span><div className="rd-stat-icon violet"><Icon name="calendar" /></div></div>
              <div className="rd-stat-body"><strong>{stats.completionRate}%</strong><span>Hoàn tất / tổng lịch</span></div>
            </article>
            <article className="rd-stat red">
              <div className="rd-stat-head"><span>Hủy / Không đến</span><div className="rd-stat-icon red"><Icon name="patient" /></div></div>
              <div className="rd-stat-body"><strong>{stats.cancelled}</strong><span>{stats.cancelRate}% tổng lịch</span></div>
            </article>
          </div>

          <section className="productivity-filters">
            <div className="appointment-search-field">
              <Icon name="calendar" />
              <input readOnly value={`${startDate.toISOString().slice(0, 10)} - ${today.toISOString().slice(0, 10)}`} />
            </div>
            <select value={staff} onChange={(event) => setStaff(event.target.value)}>
              <option value="all">Tất cả nhân sự</option>
              {staffRows.map((row) => <option key={row.name} value={row.name}>{row.name}</option>)}
            </select>
            <button type="button" className="appointment-export" onClick={() => loadData()}><Icon name="file" /> Làm mới dữ liệu</button>
          </section>

          {error && <div className="payment-history-error">{error}</div>}

          <div className="productivity-chart-grid">
            <section className="productivity-card">
              <header><h2>Năng suất theo nhân sự</h2><div><span>Lịch xử lý</span><span>Check-in</span><span>Hoàn tất</span></div></header>
              <div className="productivity-bar-chart">
                {filteredRows.length ? filteredRows.slice(0, 5).map((row) => (
                  <article key={row.name}>
                    <div className="productivity-bars">
                      <i className="purple" style={{ height: `${Math.max(8, (row.processed / maxProcessed) * 100)}%` }}><b>{row.processed}</b></i>
                      <i className="blue" style={{ height: `${Math.max(8, (row.checkedIn / maxProcessed) * 100)}%` }}><b>{row.checkedIn}</b></i>
                      <i className="green" style={{ height: `${Math.max(8, (row.completed / maxProcessed) * 100)}%` }}><b>{row.completed}</b></i>
                    </div>
                    <span>{row.name}</span>
                  </article>
                )) : <p className="productivity-empty">Chưa có dữ liệu lịch hẹn theo nhân sự.</p>}
              </div>
            </section>

            <section className="productivity-card">
              <header><h2>Xu hướng lịch 7 ngày</h2><div><span>Lịch xử lý</span><span>Check-in</span><span>Hoàn tất</span></div></header>
              <div className="productivity-line-chart">
                {trendDays.map((day) => (
                  <article key={day.label}>
                    <div>
                      <i className="purple" style={{ bottom: `${(day.processed / maxTrend) * 100}%` }}>{day.processed}</i>
                      <i className="blue" style={{ bottom: `${(day.checked / maxTrend) * 100}%` }} />
                      <i className="green" style={{ bottom: `${(day.completed / maxTrend) * 100}%` }}>{day.completed}</i>
                    </div>
                    <span>{day.label}</span>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="productivity-bottom-grid">
            <section className="productivity-card">
              <header><h2>Bảng xếp hạng hiệu suất</h2></header>
              <table className="appointment-table productivity-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nhân sự</th>
                    <th>Lịch xử lý</th>
                    <th>Check-in</th>
                    <th>Hoàn tất</th>
                    <th>Hủy/no-show</th>
                    <th>Tỷ lệ check-in</th>
                    <th>Tỷ lệ hoàn tất</th>
                    <th>Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? filteredRows.map((row, index) => (
                    <tr key={row.name}>
                      <td>{index + 1}</td>
                      <td><div className="productivity-staff"><span>{initials(row.name)}</span><strong>{row.name}</strong></div></td>
                      <td>{row.processed}</td>
                      <td>{row.checkedIn}</td>
                      <td>{row.completed}</td>
                      <td>{row.cancelled}</td>
                      <td>{row.checkInRate}%</td>
                      <td>{row.completionRate}%</td>
                      <td><b className={`productivity-rank rank-${Math.min(index + 1, 3)}`}>{row.score}</b></td>
                    </tr>
                  )) : (
                    <tr><td colSpan="9" className="appointment-empty">Chưa có dữ liệu hiệu suất thực.</td></tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="productivity-card">
              <header><h2>Giờ cao điểm tiếp đón</h2><span>Theo lịch hẹn</span></header>
              <div className="productivity-heatmap productivity-hour-bars">
                {heatmap.map((item) => (
                  <div className="productivity-hour-row" key={item.hour}>
                    <time>{String(item.hour).padStart(2, '0')}:00 - {String(item.hour + 1).padStart(2, '0')}:00</time>
                    <i style={{ opacity: item.intensity }} />
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside className="rd-right productivity-side">
          <section className="rd-card-list">
            <header><h2>Top nhân sự</h2></header>
            {topStaff.length ? topStaff.map((row, index) => (
              <article key={row.name} className="productivity-top-row">
                <b>{index + 1}</b>
                <div>{initials(row.name)}</div>
                <span><strong>{row.name}</strong></span>
                <em>{row.score}<small>Điểm</small></em>
              </article>
            )) : <p className="rd-muted">Chưa có dữ liệu nhân sự.</p>}
          </section>

          <section className="rd-card-list productivity-goals">
            <header><h2>Phân bổ trạng thái</h2></header>
            {statusBreakdown.length ? statusBreakdown.map((item) => (
              <article key={item.status}>
                <div><span>{item.label}</span><strong>{item.count}</strong></div>
                <i><b style={{ width: `${Math.min(100, (item.count / Math.max(1, appointments.length)) * 100)}%` }} /></i>
              </article>
            )) : <p className="rd-muted">Chưa có lịch hẹn.</p>}
          </section>

          <section className="rd-card-list">
            <header><h2>Tóm tắt 7 ngày</h2></header>
            {trendDays.map((day) => (
              <article key={day.label} className="productivity-alert-row">
                <div className="is-orange"><Icon name="calendar" /></div>
                <span>{day.label}</span>
                <strong>{day.processed} lịch</strong>
              </article>
            ))}
          </section>
        </aside>
      </div>
    </ReceptionistShell>
  )
}
