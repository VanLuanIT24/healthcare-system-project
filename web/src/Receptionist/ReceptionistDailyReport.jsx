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
  if (!response.ok) throw new Error(payload?.message || 'Không thể tải báo cáo ngày.')
  return payload?.data || payload
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function dateKey(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function statusLabel(status) {
  return {
    booked: 'Đã đặt',
    confirmed: 'Đã xác nhận',
    checked_in: 'Đã check-in',
    in_consultation: 'Đang khám',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    no_show: 'Không đến',
    rescheduled: 'Đổi lịch',
  }[status] || status || 'Chưa rõ'
}

function statusTone(status) {
  return {
    booked: 'blue',
    confirmed: 'green',
    checked_in: 'blue',
    in_consultation: 'purple',
    completed: 'green',
    cancelled: 'red',
    no_show: 'red',
    rescheduled: 'orange',
  }[status] || 'orange'
}

function methodLabel(method) {
  return {
    cash: 'Tiền mặt',
    bank_transfer: 'Chuyển khoản',
    card: 'Thẻ',
    qr: 'QR Pay',
    insurance: 'BHYT',
    unknown: 'Chưa rõ',
  }[method] || method || 'Chưa rõ'
}

function getRoomName(appointment) {
  return appointment.department_name || appointment.room_name || appointment.clinic_name || 'Chưa phân phòng'
}

function getDoctorName(appointment) {
  return appointment.doctor_name || appointment.doctorName || 'Chưa có bác sĩ'
}

function getServiceName(appointment) {
  return appointment.reason || appointment.appointment_type || appointment.service_name || 'Khám bệnh'
}

function isPaidInvoice(invoice) {
  return invoice?.status === 'paid' || Number(invoice?.amount_paid || 0) > 0 || invoice?.paid_at
}

export default function ReceptionistDailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [appointments, setAppointments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [summary, setSummary] = useState(null)
  const [room, setRoom] = useState('all')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ date: selectedDate, limit: 300 })
      const invoiceParams = new URLSearchParams({ page: 1, limit: 300 })
      const [appointmentPayload, invoicePayload, summaryPayload] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/appointments?${params}`).then(readJson),
        fetchWithAuth(`${API_BASE_URL}/invoices?${invoiceParams}`).then(readJson).catch(() => []),
        fetchWithAuth(`${API_BASE_URL}/invoices/summary`).then(readJson).catch(() => null),
      ])
      setAppointments(itemsFrom(appointmentPayload))
      setInvoices(itemsFrom(invoicePayload))
      setSummary(summaryPayload)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => { loadData() }, [loadData])

  const dateAppointments = useMemo(
    () => appointments.filter((item) => dateKey(item.appointment_time) === selectedDate || !item.appointment_time),
    [appointments, selectedDate],
  )

  const paidInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const paidDate = dateKey(invoice.paid_at || invoice.updated_at || invoice.created_at)
      return paidDate === selectedDate && isPaidInvoice(invoice)
    })
  }, [invoices, selectedDate])

  const roomOptions = useMemo(() => {
    return [...new Set(dateAppointments.map(getRoomName).filter(Boolean))]
  }, [dateAppointments])

  const filteredAppointments = useMemo(() => {
    return dateAppointments.filter((appointment) => {
      if (room !== 'all' && getRoomName(appointment) !== room) return false
      if (status !== 'all' && appointment.status !== status) return false
      return true
    })
  }, [dateAppointments, room, status])

  const stats = useMemo(() => {
    const total = filteredAppointments.length
    const checkedIn = filteredAppointments.filter((item) => ['checked_in', 'in_consultation', 'completed'].includes(item.status)).length
    const completed = filteredAppointments.filter((item) => item.status === 'completed').length
    const cancelled = filteredAppointments.filter((item) => ['cancelled', 'no_show'].includes(item.status)).length
    const patientCount = new Set(filteredAppointments.map((item) => item.patient_id || item.patient_code || item.patient_phone).filter(Boolean)).size
    const revenue = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || invoice.total_amount || 0), 0)
    return {
      total,
      checkedIn,
      completed,
      cancelled,
      patientCount,
      revenue,
      checkedInRate: total ? Math.round((checkedIn / total) * 100) : 0,
      completedRate: total ? Math.round((completed / total) * 100) : 0,
      cancelledRate: total ? Math.round((cancelled / total) * 100) : 0,
    }
  }, [filteredAppointments, paidInvoices])

  const hourlyRows = useMemo(() => {
    const hours = Array.from({ length: 11 }, (_, index) => 7 + index)
    const max = Math.max(1, ...hours.map((hour) => filteredAppointments.filter((item) => new Date(item.appointment_time).getHours() === hour).length))
    return hours.map((hour) => {
      const items = filteredAppointments.filter((item) => new Date(item.appointment_time).getHours() === hour)
      return {
        hour,
        total: items.length,
        checked: items.filter((item) => ['checked_in', 'in_consultation', 'completed'].includes(item.status)).length,
        max,
      }
    })
  }, [filteredAppointments])

  const statusRows = useMemo(() => {
    const statuses = ['checked_in', 'in_consultation', 'completed', 'confirmed', 'booked', 'cancelled', 'no_show']
    return statuses
      .map((key) => ({ key, label: statusLabel(key), count: filteredAppointments.filter((item) => item.status === key).length }))
      .filter((item) => item.count > 0)
  }, [filteredAppointments])

  const roomRows = useMemo(() => {
    const rows = new Map()
    filteredAppointments.forEach((appointment) => {
      const name = getRoomName(appointment)
      if (!rows.has(name)) {
        rows.set(name, { name, doctor: getDoctorName(appointment), total: 0, checked: 0, completed: 0, waiting: 0, cancelled: 0 })
      }
      const row = rows.get(name)
      row.total += 1
      if (['checked_in', 'in_consultation', 'completed'].includes(appointment.status)) row.checked += 1
      if (appointment.status === 'completed') row.completed += 1
      if (['booked', 'confirmed'].includes(appointment.status)) row.waiting += 1
      if (['cancelled', 'no_show'].includes(appointment.status)) row.cancelled += 1
    })
    return [...rows.values()].sort((a, b) => b.total - a.total)
  }, [filteredAppointments])

  const serviceRows = useMemo(() => {
    const rows = new Map()
    filteredAppointments.forEach((appointment) => {
      const name = getServiceName(appointment)
      rows.set(name, (rows.get(name) || 0) + 1)
    })
    return [...rows.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [filteredAppointments])

  const upcoming = useMemo(() => {
    const now = new Date()
    return filteredAppointments
      .filter((item) => ['booked', 'confirmed', 'checked_in'].includes(item.status))
      .sort((a, b) => new Date(a.appointment_time) - new Date(b.appointment_time))
      .filter((item) => selectedDate !== todayKey() || new Date(item.appointment_time) >= now)
      .slice(0, 4)
  }, [filteredAppointments, selectedDate])

  const methodRows = useMemo(() => {
    const rows = new Map()
    paidInvoices.forEach((invoice) => {
      const key = invoice.payment_method || 'unknown'
      rows.set(key, (rows.get(key) || 0) + Number(invoice.amount_paid || invoice.total_amount || 0))
    })
    return [...rows.entries()].map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total)
  }, [paidInvoices])

  const maxService = Math.max(1, ...serviceRows.map((item) => item.count))
  const maxStatus = Math.max(1, ...statusRows.map((item) => item.count))
  const todaySummaryRevenue = selectedDate === todayKey() ? Number(summary?.total_collected || 0) : 0
  const revenueDisplay = stats.revenue || todaySummaryRevenue

  function changeDate(days) {
    const date = new Date(`${selectedDate}T00:00:00`)
    date.setDate(date.getDate() + days)
    setSelectedDate(date.toISOString().slice(0, 10))
  }

  return (
    <ReceptionistShell
      title="Báo cáo ngày"
      subtitle="Tổng hợp nhanh tình hình vận hành, lịch hẹn và thanh toán trong ngày"
      activeSection="dailyReport"
    >
      <div className="daily-report-layout">
        <div className="daily-report-main">
          <div className="rd-stats daily-report-stats">
            <article className="rd-stat purple">
              <div className="rd-stat-head"><span>Tổng lịch trong ngày</span><div className="rd-stat-icon purple"><Icon name="calendar" /></div></div>
              <div className="rd-stat-body"><strong>{loading ? '...' : stats.total}</strong><span>{formatDate(selectedDate)}</span></div>
            </article>
            <article className="rd-stat blue">
              <div className="rd-stat-head"><span>Đã check-in</span><div className="rd-stat-icon blue"><Icon name="users" /></div></div>
              <div className="rd-stat-body"><strong>{stats.checkedIn}</strong><span>{stats.checkedInRate}% tổng lịch</span></div>
            </article>
            <article className="rd-stat green">
              <div className="rd-stat-head"><span>Hoàn tất</span><div className="rd-stat-icon green"><Icon name="check" /></div></div>
              <div className="rd-stat-body"><strong>{stats.completed}</strong><span>{stats.completedRate}% tổng lịch</span></div>
            </article>
            <article className="rd-stat orange">
              <div className="rd-stat-head"><span>Bệnh nhân có lịch</span><div className="rd-stat-icon orange"><Icon name="patient" /></div></div>
              <div className="rd-stat-body"><strong>{stats.patientCount}</strong><span>Theo lịch hẹn trong ngày</span></div>
            </article>
            <article className="rd-stat red">
              <div className="rd-stat-head"><span>Hủy / no-show</span><div className="rd-stat-icon red"><Icon name="clock" /></div></div>
              <div className="rd-stat-body"><strong>{stats.cancelled}</strong><span>{stats.cancelledRate}% tổng lịch</span></div>
            </article>
            <article className="rd-stat green">
              <div className="rd-stat-head"><span>Doanh thu đã thu</span><div className="rd-stat-icon green"><Icon name="wallet" /></div></div>
              <div className="rd-stat-body"><strong>{formatMoney(revenueDisplay)}</strong><span>{paidInvoices.length || summary?.transaction_count || 0} giao dịch</span></div>
            </article>
          </div>

          <section className="daily-report-filters">
            <button type="button" onClick={() => changeDate(-1)} aria-label="Ngày trước">‹</button>
            <label>
              <span>{formatDate(selectedDate)}</span>
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
            <button type="button" onClick={() => changeDate(1)} aria-label="Ngày sau">›</button>
            <select value={room} onChange={(event) => setRoom(event.target.value)}>
              <option value="all">Tất cả phòng khám</option>
              {roomOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              {statusRows.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
            <button type="button" className="appointment-export" onClick={loadData}><Icon name="file" /> Làm mới</button>
            <button type="button" className="appointment-export" onClick={() => window.print()}><Icon name="receipt" /> In báo cáo</button>
          </section>

          {error && <div className="payment-history-error">{error}</div>}

          <div className="daily-report-chart-grid">
            <section className="productivity-card">
              <header><h2>Lịch hẹn theo khung giờ</h2><div><span>Tổng lịch</span><span>Đã check-in</span></div></header>
              <div className="daily-hour-chart">
                {hourlyRows.map((item) => (
                  <article key={item.hour}>
                    <div>
                      <i className="purple" style={{ height: `${Math.max(6, (item.total / item.max) * 100)}%` }}><b>{item.total}</b></i>
                      <i className="blue" style={{ height: `${Math.max(6, (item.checked / item.max) * 100)}%` }}><b>{item.checked}</b></i>
                    </div>
                    <span>{String(item.hour).padStart(2, '0')}:00</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="productivity-card">
              <header><h2>Trạng thái lịch hẹn</h2></header>
              <div className="daily-status-list">
                {statusRows.length ? statusRows.map((item) => (
                  <article key={item.key}>
                    <span><i className={statusTone(item.key)} />{item.label}</span>
                    <div><b style={{ width: `${(item.count / maxStatus) * 100}%` }} /></div>
                    <strong>{item.count}</strong>
                  </article>
                )) : <p className="rd-muted">Chưa có lịch hẹn trong ngày.</p>}
              </div>
            </section>
          </div>

          <section className="productivity-card">
            <header><h2>Tổng hợp theo phòng khám</h2></header>
            <table className="appointment-table productivity-table">
              <thead>
                <tr>
                  <th>Phòng khám</th>
                  <th>Bác sĩ</th>
                  <th>Tổng lịch</th>
                  <th>Đã check-in</th>
                  <th>Hoàn tất</th>
                  <th>Đang chờ</th>
                  <th>Hủy/no-show</th>
                  <th>Tỷ lệ hoàn tất</th>
                </tr>
              </thead>
              <tbody>
                {roomRows.length ? roomRows.map((item) => (
                  <tr key={item.name}>
                    <td><span className="daily-room-pill">{initials(item.name)}</span> {item.name}</td>
                    <td>{item.doctor}</td>
                    <td>{item.total}</td>
                    <td>{item.checked}</td>
                    <td>{item.completed}</td>
                    <td>{item.waiting}</td>
                    <td>{item.cancelled}</td>
                    <td>{item.total ? Math.round((item.completed / item.total) * 100) : 0}%</td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" className="appointment-empty">Chưa có dữ liệu phòng khám.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="productivity-card">
            <header><h2>Dịch vụ / lý do khám nhiều nhất</h2></header>
            <div className="daily-service-list">
              {serviceRows.length ? serviceRows.map((item) => (
                <article key={item.name}>
                  <span>{item.name}</span>
                  <div><b style={{ width: `${(item.count / maxService) * 100}%` }} /></div>
                  <strong>{item.count}</strong>
                </article>
              )) : <p className="rd-muted">Chưa có dữ liệu dịch vụ trong ngày.</p>}
            </div>
          </section>
        </div>

        <aside className="rd-right daily-report-side">
          <section className="rd-card-list">
            <header><h2>Lịch sắp tới</h2></header>
            {upcoming.length ? upcoming.map((item) => (
              <article key={item.appointment_id || item._id} className="daily-upcoming-row">
                <time>{formatTime(item.appointment_time)}</time>
                <span><strong>{item.patient_name || 'Bệnh nhân'}</strong><small>{getRoomName(item)} · {getDoctorName(item)}</small></span>
                <b className={`appt-badge ${statusTone(item.status)}`}>{statusLabel(item.status)}</b>
              </article>
            )) : <p className="rd-muted">Không còn lịch sắp tới.</p>}
          </section>

          <section className="rd-card-list">
            <header><h2>Tóm tắt thu ngân</h2></header>
            {methodRows.length ? methodRows.map((item) => (
              <article key={item.method} className="daily-money-row">
                <span>{methodLabel(item.method)}</span>
                <strong>{formatMoney(item.total)}</strong>
              </article>
            )) : <p className="rd-muted">Chưa có giao dịch đã thu trong ngày.</p>}
            <footer className="daily-money-total"><span>Tổng cộng</span><strong>{formatMoney(revenueDisplay)}</strong></footer>
          </section>
        </aside>
      </div>
    </ReceptionistShell>
  )
}
