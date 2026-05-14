import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function initials(name = '') {
  const parts = name.trim().split(' ')
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function avatarColor(name = '') {
  const colors = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#00cec9']
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString('vi-VN') + ' đ'
}

function fmtTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? '—' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

async function readJson(r) {
  const p = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(p?.message || 'Lỗi tải dữ liệu')
  return p?.data || p
}

function statusLabel(s) {
  return { pending: 'Chờ thu', partial: 'Thanh toán một phần', paid: 'Đã thu', cancelled: 'Đã hủy', draft: 'Nháp', refunded: 'Hoàn tiền' }[s] || s
}

function statusClass(s) {
  return { paid: 'green', partial: 'blue', pending: 'orange', cancelled: 'red', draft: 'gray', refunded: 'purple' }[s] || 'gray'
}

function isPayableInvoice(invoice) {
  return ['pending', 'partial'].includes(invoice?.status) && Number(invoice?.amount_due || 0) > 0
}

function PayModal({ invoice, onClose, onSuccess }) {
  const [method, setMethod] = useState('cash')
  const [amount, setAmount] = useState(String(invoice.amount_due))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setLoading(true); setError('')
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/invoices/${invoice.invoice_id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), payment_method: method }),
      })
      await readJson(res)
      onSuccess()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#1e293b' }}>Thu tiền hóa đơn</h3>
        <p style={{ fontSize: '0.85rem', color: '#7c8db5', marginBottom: '16px' }}>Hóa đơn: <strong>{invoice.invoice_no}</strong> | Bệnh nhân: <strong>{invoice.patient_name}</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Số tiền cần thu</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e4ef', fontSize: '0.9rem', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Phương thức thanh toán</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e4ef', fontSize: '0.9rem', marginTop: '4px' }}>
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="card">Thẻ ngân hàng</option>
              <option value="qr">QR / Ví điện tử</option>
            </select>
          </div>
          {error && <p style={{ color: '#e17055', fontSize: '0.82rem' }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e0e4ef', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>Hủy</button>
          <button onClick={handlePay} disabled={loading}
            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#514bff', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Đang xử lý...' : 'Xác nhận thu tiền'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReceptionistCashierPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 })
  const [notice, setNotice] = useState('')
  const [payModal, setPayModal] = useState(null)
  const limit = 10

  function showNotice(msg) { setNotice(msg); setTimeout(() => setNotice(''), 2500) }

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchWithAuth(`${API_BASE_URL}/invoices/summary`).then(readJson)
      setSummary(data)
    } catch { /* non-critical */ }
  }, [])

  const loadInvoices = useCallback(async (pg = 1) => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: 1, limit: 200, encounter_only: 'true' })
      const data = await fetchWithAuth(`${API_BASE_URL}/invoices?${params}`).then(readJson)
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      const payable = list
        .filter(isPayableInvoice)
        .filter((invoice) => filterStatus === 'all' || invoice.status === filterStatus)
      setInvoices(payable)
      setPagination({ total: payable.length, total_pages: Math.max(1, Math.ceil(payable.length / limit)) })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { loadInvoices(page); loadSummary() }, [page, loadInvoices, loadSummary])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter(inv =>
      [inv.invoice_no, inv.patient_name, inv.patient_code, inv.patient_phone]
        .filter(Boolean).some(v => v.toLowerCase().includes(q))
    )
  }, [invoices, search])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / limit))
  const currentRows = filtered.slice((page - 1) * limit, page * limit)

  const priority = useMemo(() => invoices.slice(0, 4), [invoices])

  function handlePaySuccess() {
    setPayModal(null)
    showNotice('Thu tiền thành công!')
    loadInvoices(page)
    loadSummary()
  }

  return (
    <ReceptionistShell title="Thu ngân" subtitle="Thu tiền khám chữa bệnh, xác nhận thanh toán và xử lý hóa đơn tại quầy" activeSection="cashier">
      {notice && <div className="rd-toast">{notice}</div>}
      {payModal && <PayModal invoice={payModal} onClose={() => setPayModal(null)} onSuccess={handlePaySuccess} />}

      <div className="rd-content appointment-content">
        {/* Stats */}
        <div className="rd-stats">
          <article className="rd-stat purple">
            <div className="rd-stat-head"><div className="rd-stat-icon purple"><Icon name="clock" /></div><span>Chờ thanh toán</span></div>
            <div className="rd-stat-body"><strong>{summary?.pending_count ?? '—'}</strong><span>Bệnh nhân đang chờ tại quầy</span></div>
          </article>
          <article className="rd-stat green">
            <div className="rd-stat-head"><div className="rd-stat-icon green"><Icon name="wallet" /></div><span>Đã thu hôm nay</span></div>
            <div className="rd-stat-body"><strong style={{ fontSize: '1.1rem' }}>{summary ? summary.total_collected.toLocaleString('vi-VN') : '—'}</strong><span>{summary?.transaction_count ?? 0} giao dịch</span></div>
          </article>
          <article className="rd-stat blue">
            <div className="rd-stat-head"><div className="rd-stat-icon blue"><Icon name="file" /></div><span>BHYT / Bảo hiểm</span></div>
            <div className="rd-stat-body"><strong style={{ fontSize: '1.1rem' }}>{summary ? summary.total_insurance_deduction.toLocaleString('vi-VN') : '—'}</strong><span>{summary?.insurance_count ?? 0} hồ sơ</span></div>
          </article>
          <article className="rd-stat orange">
            <div className="rd-stat-head"><div className="rd-stat-icon" style={{ background: '#fff3e0', color: '#e65100' }}><Icon name="warning" /></div><span>Hoàn tiền / điều chỉnh</span></div>
            <div className="rd-stat-body"><strong>0</strong><span>0 yêu cầu đang xử lý</span></div>
          </article>
          <article className="rd-stat">
            <div className="rd-stat-head"><div className="rd-stat-icon" style={{ background: '#e8f5e9', color: '#2e7d32' }}><Icon name="users" /></div><span>Thu ngân đang hoạt động</span></div>
            <div className="rd-stat-body"><strong>1</strong><span>Ca sáng hôm nay</span></div>
          </article>
        </div>

        {/* Filters */}
        <div className="appointment-filters" style={{ flexWrap: 'wrap' }}>
          <div className="appointment-search-field">
            <Icon name="search" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên, SĐT, mã phiếu thu, mã bệnh nhân..." />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="all">Tất cả đơn cần thu</option>
            <option value="pending">Chờ thu</option>
            <option value="partial">Thanh toán một phần</option>
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="appointment-export" onClick={() => showNotice('In hóa đơn')}><Icon name="file" /> In hóa đơn</button>
          <button type="button" className="appointment-export" onClick={() => showNotice('Xuất danh sách')}><Icon name="file" /> Xuất danh sách</button>
        </div>

        {/* Table */}
        <div className="appointment-table-card">
          {error && <div style={{ padding: '12px 16px', color: '#e17055', fontSize: '0.85rem' }}>{error}</div>}
          <table className="appointment-table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Bệnh nhân</th>
                <th>Dịch vụ / Chi tiết</th>
                <th style={{ textAlign: 'right' }}>Cần thanh toán</th>
                <th style={{ textAlign: 'right' }}>BHYT / Giảm trừ</th>
                <th style={{ textAlign: 'right' }}>Còn thu</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="appointment-loading">Đang tải...</td></tr>
              ) : currentRows.length > 0 ? currentRows.map(inv => (
                <tr key={inv.invoice_id}>
                  <td>
                    <span style={{ color: '#514bff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                      onClick={() => showNotice(`Hóa đơn: ${inv.invoice_no}`)}>{inv.invoice_no}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.68rem', color: '#fff', background: avatarColor(inv.patient_name || ''), flexShrink: 0 }}>
                        {initials(inv.patient_name || '?')}
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.8rem' }}>{inv.patient_name || '—'}</strong><br />
                        <small style={{ color: '#7c8db5' }}>{inv.patient_code}{inv.patient_phone && ` · ${inv.patient_phone}`}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8rem' }}>{inv.line_items?.length > 0 ? inv.line_items[0].description : 'Khám bệnh'}</div>
                    {inv.line_items?.length > 1 && <small style={{ color: '#7c8db5' }}>+{inv.line_items.length - 1} dịch vụ khác</small>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.82rem' }}>{fmtMoney(inv.subtotal)}</td>
                  <td style={{ textAlign: 'right', color: '#059669', fontSize: '0.82rem' }}>{inv.insurance_deduction > 0 ? fmtMoney(inv.insurance_deduction) : '0'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '0.85rem' }}>{fmtMoney(inv.amount_due)}</td>
                  <td><span className={`appt-badge ${statusClass(inv.status)}`}>{statusLabel(inv.status)}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {['pending', 'partial'].includes(inv.status) && (
                        <button type="button" style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: '#dbeafe', color: '#1d4ed8' }}
                          onClick={() => setPayModal(inv)}>Thu tiền</button>
                      )}
                      <button type="button" style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: '#f3f4f6', color: '#374151' }}
                        onClick={() => navigate(`/receptionist/patient-records/${inv.patient_id}`)}>Chi tiết</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="8" className="appointment-empty">Không có hóa đơn cần thu.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="appointment-pagination">
          <span style={{ fontSize: '0.82rem', color: '#7c8db5' }}>
            Hiển thị {filtered.length > 0 ? `${(page - 1) * limit + 1}–${Math.min(page * limit, totalItems)}` : '0'} trong {totalItems} phiếu thu
          </span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
              <button key={n} className={n === page ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
            {totalPages > 5 && <><button disabled>…</button><button onClick={() => setPage(totalPages)}>{totalPages}</button></>}
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="rd-right">
        {/* Payment methods */}
        <section className="rd-card-list">
          <header><h2>Phương thức thanh toán hôm nay</h2></header>
          <div style={{ padding: '8px 12px' }}>
            {summary?.method_breakdown && Object.keys(summary.method_breakdown).length > 0
              ? Object.entries(summary.method_breakdown).map(([method, amount]) => (
                <div key={method} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: avatarColor(method), flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.78rem' }}>{{ cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', card: 'Thẻ', qr: 'QR / Ví điện tử' }[method] || method}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{amount.toLocaleString('vi-VN')} đ</span>
                </div>
              ))
              : <p style={{ fontSize: '0.8rem', color: '#7c8db5' }}>Chưa có giao dịch hôm nay.</p>
            }
            <div style={{ borderTop: '1px solid #e0e4ef', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: '#7c8db5' }}>Tổng thu</span>
              <strong style={{ fontSize: '0.85rem' }}>{summary ? summary.total_collected.toLocaleString('vi-VN') + ' đ' : '—'}</strong>
            </div>
          </div>
        </section>

        {/* Priority invoices */}
        <section className="rd-card-list">
          <header><h2>Hóa đơn cần ưu tiên</h2><button type="button" onClick={() => { setFilterStatus('pending'); setPage(1) }}>Xem tất cả</button></header>
          {priority.length === 0
            ? <p style={{ padding: '8px 12px', color: '#7c8db5', fontSize: '0.8rem' }}>Không có hóa đơn chờ.</p>
            : priority.map(inv => (
              <article key={inv.invoice_id}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.68rem', color: '#fff', background: avatarColor(inv.patient_name || ''), flexShrink: 0 }}>
                  {initials(inv.patient_name || '?')}
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.8rem' }}>{inv.patient_name || '—'}</strong>
                  <p style={{ fontSize: '0.72rem', color: '#7c8db5' }}>{inv.patient_code}</p>
                </div>
                <button type="button" style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', whiteSpace: 'nowrap' }}
                  onClick={() => setPayModal(inv)}>Chờ thu tiền</button>
              </article>
            ))}
        </section>

        {/* Shift reminders */}
        <section className="rd-card-list">
          <header><h2>Nhắc nhở ca trực</h2></header>
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[['Đối soát quỹ cuối ca', false], ['Kiểm tra chứng từ BHYT', true], ['In báo cáo ca', false], ['Bàn giao ca chiều', false]].map(([label, done]) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={done} style={{ accentColor: '#514bff' }} />
                <span style={{ textDecoration: done ? 'line-through' : 'none', color: done ? '#9ca3af' : 'inherit' }}>{label}</span>
              </label>
            ))}
          </div>
        </section>
      </aside>
    </ReceptionistShell>
  )
}
