import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function readItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload)) return payload
  return []
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Không thể tải lịch sử thanh toán.')
  return payload?.data || payload
}

function initials(name = '') {
  const parts = name.trim().split(' ').filter(Boolean)
  if (!parts.length) return '?'
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function avatarColor(name = '') {
  const colors = ['#e94696', '#00b8a9', '#ff934a', '#64748b', '#6c5ce7', '#14b8a6', '#7c3aed']
  let hash = 0
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('vi-VN')
}

function methodLabel(method) {
  return {
    cash: 'Tiền mặt',
    bank_transfer: 'Chuyển khoản',
    card: 'Thẻ',
    qr: 'QR Pay',
    insurance: 'Bảo hiểm',
  }[method] || 'Chưa chọn'
}

function methodIcon(method) {
  return method === 'cash' ? 'wallet' : method === 'card' ? 'file' : method === 'qr' ? 'logo' : 'home'
}

function statusLabel(status) {
  return {
    paid: 'Thành công',
    pending: 'Chờ thu',
    partial: 'Đang xử lý',
    cancelled: 'Đã hủy',
    refunded: 'Hoàn tiền',
    draft: 'Nháp',
  }[status] || status
}

function statusClass(status) {
  return {
    paid: 'green',
    pending: 'orange',
    partial: 'orange',
    cancelled: 'red',
    refunded: 'red',
    draft: 'blue',
  }[status] || 'blue'
}

function hasPaymentActivity(invoice) {
  if (!invoice) return false
  if (['pending', 'draft'].includes(invoice.status)) return false
  return Boolean(
    invoice.paid_at
    || invoice.payment_method
    || Number(invoice.amount_paid || 0) > 0
    || ['paid', 'partial', 'refunded', 'cancelled'].includes(invoice.status),
  )
}

export default function ReceptionistPaymentHistoryPage() {
  const [invoices, setInvoices] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('today')
  const [method, setMethod] = useState('all')
  const [status, setStatus] = useState('all')
  const [cashier, setCashier] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 8

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: 1, limit: 120 })
      const [invoicePayload, summaryPayload] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/invoices?${params}`).then(readJson),
        fetchWithAuth(`${API_BASE_URL}/invoices/summary`).then(readJson).catch(() => null),
      ])
      setInvoices(readItems(invoicePayload).filter(hasPaymentActivity))
      setSummary(summaryPayload)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const cashiers = useMemo(() => {
    const names = invoices.map((item) => item.cashier_name || item.cashier_id).filter(Boolean)
    return [...new Set(names)]
  }, [invoices])

  const filtered = useMemo(() => {
    const now = new Date()
    const query = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const paidDate = new Date(invoice.paid_at || invoice.updated_at || invoice.created_at)
      if (period === 'today' && paidDate.toDateString() !== now.toDateString()) return false
      if (period === 'week' && now - paidDate > 7 * 24 * 60 * 60 * 1000) return false
      if (method !== 'all' && invoice.payment_method !== method) return false
      if (status !== 'all' && invoice.status !== status) return false
      if (cashier !== 'all' && (invoice.cashier_name || invoice.cashier_id) !== cashier) return false
      if (!query) return true
      return [invoice.invoice_no, invoice.patient_name, invoice.patient_code, invoice.patient_phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [cashier, invoices, method, period, search, status])

  const stats = useMemo(() => {
    const paid = filtered.filter((item) => item.status === 'paid')
    const refunded = filtered.filter((item) => ['refunded', 'cancelled'].includes(item.status))
    const collected = paid.reduce((sum, item) => sum + Number(item.amount_paid || item.total_amount || 0), 0)
    const methodTotals = filtered.reduce((map, item) => {
      const key = item.payment_method || 'unknown'
      map[key] = (map[key] || 0) + Number(item.amount_paid || item.total_amount || 0)
      return map
    }, {})
    return {
      total: filtered.length,
      paidCount: paid.length,
      refundedCount: refunded.length,
      collected,
      issued: filtered.filter((item) => item.invoice_no).length,
      methodTotals,
    }
  }, [filtered])

  const pages = Math.max(1, Math.ceil(filtered.length / limit))
  const currentRows = filtered.slice((page - 1) * limit, page * limit)
  const topMethods = Object.entries(stats.methodTotals).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const totalByMethod = Math.max(topMethods.reduce((sum, [, value]) => sum + value, 0), 1)
  const donutStops = topMethods.reduce((acc, [key, value], index) => {
    const colors = ['#12b981', '#4d74ff', '#8b5cf6', '#ff943d']
    const start = acc.offset
    const end = start + (value / totalByMethod) * 100
    acc.parts.push(`${colors[index]} ${start}% ${end}%`)
    acc.offset = end
    return acc
  }, { offset: 0, parts: [] }).parts.join(', ')

  function notice(message) {
    window.alert(message)
  }

  useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])

  return (
    <ReceptionistShell
      title="Lịch sử thanh toán"
      subtitle="Theo dõi giao dịch, tra cứu hóa đơn và kiểm tra trạng thái thanh toán"
      activeSection="paymentHistory"
    >
      <div className="payment-history-layout">
        <div className="payment-history-main">
          <div className="rd-stats payment-history-stats">
            <article className="rd-stat purple">
              <div className="rd-stat-head"><span>Tổng giao dịch hôm nay</span><div className="rd-stat-icon purple"><Icon name="users" /></div></div>
              <div className="rd-stat-body"><strong>{stats.total || summary?.transaction_count || 0}</strong><span>↑ Tăng {Math.max(0, stats.total - stats.paidCount)} giao dịch</span></div>
            </article>
            <article className="rd-stat green">
              <div className="rd-stat-head"><span>Doanh thu đã ghi nhận</span><div className="rd-stat-icon green"><Icon name="wallet" /></div></div>
              <div className="rd-stat-body"><strong>{formatMoney(stats.collected || summary?.total_collected)}</strong><span>Tất cả phương thức</span></div>
            </article>
            <article className="rd-stat blue">
              <div className="rd-stat-head"><span>Thanh toán thành công</span><div className="rd-stat-icon blue"><Icon name="check" /></div></div>
              <div className="rd-stat-body"><strong>{stats.paidCount}</strong><span>{stats.total ? Math.round((stats.paidCount / stats.total) * 100) : 0}% tổng giao dịch</span></div>
            </article>
            <article className="rd-stat orange">
              <div className="rd-stat-head"><span>Hoàn tiền / hủy giao dịch</span><div className="rd-stat-icon orange"><Icon name="clock" /></div></div>
              <div className="rd-stat-body"><strong>{stats.refundedCount}</strong><span>{formatMoney(filtered.filter((item) => ['refunded', 'cancelled'].includes(item.status)).reduce((sum, item) => sum + Number(item.total_amount || 0), 0))}</span></div>
            </article>
            <article className="rd-stat">
              <div className="rd-stat-head"><span>Hóa đơn điện tử đã phát hành</span><div className="rd-stat-icon blue"><Icon name="file" /></div></div>
              <div className="rd-stat-body"><strong>{stats.issued}</strong><span>Đồng bộ trong ngày</span></div>
            </article>
          </div>

          <section className="payment-history-panel">
            <div className="appointment-filters payment-history-filters">
              <div className="appointment-search-field">
                <Icon name="search" />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm theo mã giao dịch, tên bệnh nhân, số điện thoại..." />
              </div>
              <select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1) }}>
                <option value="today">Hôm nay</option>
                <option value="week">7 ngày qua</option>
                <option value="all">Tất cả thời gian</option>
              </select>
              <select value={method} onChange={(event) => { setMethod(event.target.value); setPage(1) }}>
                <option value="all">Tất cả phương thức</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
                <option value="qr">QR Pay</option>
                <option value="card">Thẻ</option>
              </select>
              <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
                <option value="all">Tất cả trạng thái</option>
                <option value="paid">Thành công</option>
                <option value="partial">Đang xử lý</option>
                <option value="cancelled">Đã hủy</option>
              </select>
              <select value={cashier} onChange={(event) => { setCashier(event.target.value); setPage(1) }}>
                <option value="all">Tất cả thu ngân</option>
                {cashiers.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button type="button" className="appointment-export" onClick={() => notice('Bộ lọc đã áp dụng')}><Icon name="search" /> Bộ lọc</button>
            </div>

            <div className="payment-history-actions">
              <button type="button" className="appointment-export" onClick={() => notice('Đối soát giao dịch')}><Icon name="check" /> Đối soát</button>
              <button type="button" className="appointment-export" onClick={() => notice('Xuất báo cáo thanh toán')}><Icon name="file" /> Xuất báo cáo</button>
            </div>

            <div className="appointment-table-card">
              {error && <div className="payment-history-error">{error}</div>}
              <table className="appointment-table payment-history-table">
                <thead>
                  <tr>
                    <th>Mã GD</th>
                    <th>Bệnh nhân</th>
                    <th>Nội dung thanh toán</th>
                    <th>Phương thức</th>
                    <th style={{ textAlign: 'right' }}>Số tiền</th>
                    <th>Thời gian</th>
                    <th>Thu ngân</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="9" className="appointment-loading">Đang tải lịch sử thanh toán...</td></tr>
                  ) : currentRows.length ? currentRows.map((invoice, index) => (
                    <tr key={invoice.invoice_id || invoice.invoice_no}>
                      <td><button type="button" className="payment-link" onClick={() => notice(invoice.invoice_no)}>{invoice.invoice_no || `GD-${index + 1}`}</button></td>
                      <td>
                        <div className="payment-patient-cell">
                          <div style={{ background: avatarColor(invoice.patient_name || invoice.patient_code) }}>{initials(invoice.patient_name)}</div>
                          <span><strong>{invoice.patient_name || '—'}</strong><small>{invoice.patient_code || '—'} · {invoice.patient_phone || '—'}</small></span>
                        </div>
                      </td>
                      <td><strong>{invoice.line_items?.[0]?.description || 'Khám nội tổng quát'}</strong><small>{invoice.line_items?.length > 1 ? `+${invoice.line_items.length - 1} khoản khác` : invoice.encounter_id ? `Ca khám ${String(invoice.encounter_id).slice(-6)}` : 'Hóa đơn viện phí'}</small></td>
                      <td><span className="payment-method-pill"><Icon name={methodIcon(invoice.payment_method)} /> {methodLabel(invoice.payment_method)}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatMoney(invoice.amount_paid || invoice.total_amount)}</td>
                      <td><strong>{formatTime(invoice.paid_at || invoice.updated_at || invoice.created_at)}</strong><small>{formatDate(invoice.paid_at || invoice.updated_at || invoice.created_at)}</small></td>
                      <td>{invoice.cashier_name || (invoice.cashier_id ? `NV ${String(invoice.cashier_id).slice(-4)}` : '—')}</td>
                      <td><span className={`appt-badge ${statusClass(invoice.status)}`}>{statusLabel(invoice.status)}</span></td>
                      <td>
                        <button type="button" onClick={() => notice('Chi tiết giao dịch')}>Chi tiết</button>
                        <button type="button" onClick={() => notice('Biên lai')}>Biên lai</button>
                        <button type="button" aria-label="Thêm thao tác">⋮</button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="9" className="appointment-empty">Không có giao dịch phù hợp.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="appointment-pagination">
              <span>Hiển thị {currentRows.length ? `${(page - 1) * limit + 1} - ${Math.min(page * limit, filtered.length)}` : '0'} trong {filtered.length} giao dịch</span>
              <div>
                <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
                {Array.from({ length: Math.min(pages, 4) }, (_, i) => i + 1).map((item) => (
                  <button key={item} className={item === page ? 'active' : ''} onClick={() => setPage(item)}>{item}</button>
                ))}
                {pages > 4 && <><button disabled>...</button><button onClick={() => setPage(pages)}>{pages}</button></>}
                <button disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>›</button>
              </div>
            </div>
          </section>
        </div>

        <aside className="rd-right payment-history-side">
          <section className="rd-card-list payment-method-card">
            <header><h2>Doanh thu theo phương thức</h2></header>
            <div className="payment-donut-row">
              <div className="payment-donut" style={{ background: donutStops ? `conic-gradient(${donutStops})` : '#edf2ff' }} />
              <div className="payment-method-list">
                {topMethods.length ? topMethods.map(([key, value]) => (
                  <div key={key}><span>{methodLabel(key)}</span><strong>{Math.round((value / totalByMethod) * 100)}%</strong><small>{formatMoney(value)}</small></div>
                )) : <p className="rd-muted">Chưa có dữ liệu.</p>}
              </div>
            </div>
            <footer><span>Tổng thu</span><strong>{formatMoney(stats.collected || summary?.total_collected)}</strong></footer>
          </section>

          <section className="rd-card-list">
            <header><h2>Giao dịch bất thường</h2><button type="button">Xem tất cả</button></header>
            {[
              ['Hóa đơn hoàn tiền', stats.refundedCount, '#ef4444'],
              ['Giao dịch chờ xác nhận', filtered.filter((item) => item.status === 'partial').length, '#ff943d'],
              ['Lệch đối soát', filtered.filter((item) => item.amount_due > 0 && item.status === 'paid').length, '#12b981'],
              ['Thanh toán thất bại', filtered.filter((item) => item.status === 'cancelled').length, '#ef4444'],
            ].map(([label, count, color]) => (
              <article key={label} className="payment-alert-row">
                <div style={{ color }}><Icon name="clock" /></div>
                <div><strong>{label}</strong><p>{count} giao dịch</p></div>
                <b>{formatMoney(count * 450000)}</b>
              </article>
            ))}
          </section>

          <section className="rd-card-list">
            <header><h2>Mốc thời gian cao điểm</h2><button type="button">Xem tất cả</button></header>
            {['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '14:00 - 15:00'].map((slot, index) => (
              <article key={slot}>
                <div style={{ color: '#514bff' }}><Icon name="clock" /></div>
                <div><strong>{slot}</strong></div>
                <p>{Math.max(0, Math.round(filtered.length / (index + 1)))} giao dịch</p>
              </article>
            ))}
          </section>
        </aside>
      </div>
    </ReceptionistShell>
  )
}
