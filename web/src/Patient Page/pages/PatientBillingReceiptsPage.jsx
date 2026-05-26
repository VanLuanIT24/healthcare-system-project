import { useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { billingAPI, getApiErrorMessage, unwrapData } from '../../utils/api'
import { formatDateTime } from '../utils/patientHelpers'

function formatMoney(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function getInvoiceId(invoice = {}) {
  return invoice.invoice_id || invoice._id || invoice.id
}

function getReceiptId(receipt = {}) {
  return receipt.receipt_id || receipt._id || receipt.id
}

function getPaymentId(payment = {}) {
  return payment.payment_id || payment._id || payment.id
}

function getInvoiceStatusLabel(status) {
  const map = {
    draft: 'Nháp',
    issued: 'Chưa thanh toán',
    partially_paid: 'Thanh toán một phần',
    paid: 'Đã thanh toán',
    cancelled: 'Đã hủy',
    voided: 'Đã hủy',
  }
  return map[status] || status || 'Chưa rõ'
}

export default function PatientBillingReceiptsPage({
  error = '',
  invoices = [],
  loading = false,
  payments = [],
  receipts = [],
}) {
  const [activeTab, setActiveTab] = useState('invoices')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState('')
  const [actionError, setActionError] = useState('')

  const unpaidInvoices = useMemo(
    () => invoices.filter((invoice) => Number(invoice.balance_due || 0) > 0),
    [invoices],
  )
  const paidInvoices = useMemo(
    () => invoices.filter((invoice) => Number(invoice.balance_due || 0) <= 0 || invoice.status === 'paid'),
    [invoices],
  )

  const openInvoiceDetail = async (invoice) => {
    const invoiceId = getInvoiceId(invoice)
    if (!invoiceId) return
    setDetailLoading(`invoice-${invoiceId}`)
    setActionError('')
    try {
      const response = await billingAPI.getMyInvoiceDetail(invoiceId)
      setDetail({ type: 'invoice', data: unwrapData(response) })
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Không thể tải chi tiết hóa đơn.'))
    } finally {
      setDetailLoading('')
    }
  }

  const openReceiptDetail = async (receipt) => {
    const receiptId = getReceiptId(receipt)
    if (!receiptId) return
    setDetailLoading(`receipt-${receiptId}`)
    setActionError('')
    try {
      const response = await billingAPI.getMyReceiptDetail(receiptId)
      setDetail({ type: 'receipt', data: unwrapData(response) })
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Không thể tải chi tiết biên lai.'))
    } finally {
      setDetailLoading('')
    }
  }

  const downloadReceipt = async (receipt) => {
    const receiptId = getReceiptId(receipt)
    if (!receiptId) return
    setDetailLoading(`download-${receiptId}`)
    setActionError('')
    try {
      const response = await billingAPI.downloadMyReceipt(receiptId)
      const payload = unwrapData(response)
      const url = payload?.download_url || payload?.url
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setActionError('Backend chưa trả về đường dẫn tải biên lai.')
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Không thể tải biên lai.'))
    } finally {
      setDetailLoading('')
    }
  }

  return (
    <div className="patient-receipts-page">
      <header className="patient-feature-header">
        <div>
          <p className="patient-section-label">Chứng từ viện phí</p>
          <h1>Hóa đơn / Biên lai</h1>
          <p>Tra cứu hóa đơn, biên lai và lịch sử giao dịch từ các endpoint billing self-service.</p>
        </div>
      </header>

      {loading ? <div className="patient-dashboard-state">Đang tải dữ liệu tài chính...</div> : null}
      {!loading && error ? <div className="patient-dashboard-state patient-dashboard-state-error">{error}</div> : null}
      {actionError ? <div className="patient-dashboard-state patient-dashboard-state-error">{actionError}</div> : null}

      <section className="patient-receipts-summary-grid">
        <article className="patient-panel patient-receipts-summary-card">
          <PatientIcon name="receipt_long" aria-hidden="true" />
          <div>
            <span>Tổng hóa đơn</span>
            <strong>{invoices.length}</strong>
          </div>
        </article>
        <article className="patient-panel patient-receipts-summary-card">
          <PatientIcon name="payments" aria-hidden="true" />
          <div>
            <span>Còn phải thu</span>
            <strong>{formatMoney(unpaidInvoices.reduce((sum, item) => sum + Number(item.balance_due || 0), 0))}</strong>
          </div>
        </article>
        <article className="patient-panel patient-receipts-summary-card">
          <PatientIcon name="description" aria-hidden="true" />
          <div>
            <span>Biên lai</span>
            <strong>{receipts.length}</strong>
          </div>
        </article>
      </section>

      <div className="patient-receipts-tabs" role="tablist" aria-label="Hóa đơn và biên lai">
        <button type="button" className={activeTab === 'invoices' ? 'is-active' : ''} onClick={() => setActiveTab('invoices')}>
          Tất cả hóa đơn
        </button>
        <button type="button" className={activeTab === 'unpaid' ? 'is-active' : ''} onClick={() => setActiveTab('unpaid')}>
          Chưa thanh toán
        </button>
        <button type="button" className={activeTab === 'paid' ? 'is-active' : ''} onClick={() => setActiveTab('paid')}>
          Đã thanh toán
        </button>
        <button type="button" className={activeTab === 'receipts' ? 'is-active' : ''} onClick={() => setActiveTab('receipts')}>
          Biên lai
        </button>
        <button type="button" className={activeTab === 'payments' ? 'is-active' : ''} onClick={() => setActiveTab('payments')}>
          Giao dịch
        </button>
      </div>

      {['invoices', 'unpaid', 'paid'].includes(activeTab) ? (
        <section className="patient-receipts-list">
          {(activeTab === 'unpaid' ? unpaidInvoices : activeTab === 'paid' ? paidInvoices : invoices).length === 0 ? (
            <div className="patient-empty-state">Không có hóa đơn phù hợp bộ lọc hiện tại.</div>
          ) : (
            (activeTab === 'unpaid' ? unpaidInvoices : activeTab === 'paid' ? paidInvoices : invoices).map((invoice) => {
              const invoiceId = getInvoiceId(invoice)
              return (
                <article className="patient-panel patient-receipt-row" key={invoiceId}>
                  <div className="patient-receipt-row-icon">
                    <PatientIcon name="receipt_long" aria-hidden="true" />
                  </div>
                  <div className="patient-receipt-row-main">
                    <h3>{invoice.invoice_no || 'Hóa đơn bệnh viện'}</h3>
                    <p>Phát hành: {formatDateTime(invoice.issued_at || invoice.created_at)}</p>
                  </div>
                  <div className="patient-receipt-row-money">
                    <strong>{formatMoney(invoice.total_amount)}</strong>
                    <span>Còn lại {formatMoney(invoice.balance_due)}</span>
                  </div>
                  <span className={`patient-status-pill ${Number(invoice.balance_due || 0) > 0 ? 'soft' : 'good'}`}>
                    {getInvoiceStatusLabel(invoice.status)}
                  </span>
                  <button
                    className="patient-outline-button"
                    type="button"
                    disabled={detailLoading === `invoice-${invoiceId}`}
                    onClick={() => openInvoiceDetail(invoice)}
                  >
                    Chi tiết
                  </button>
                </article>
              )
            })
          )}
        </section>
      ) : null}

      {activeTab === 'receipts' ? (
        <section className="patient-receipts-list">
          {receipts.length === 0 ? (
            <div className="patient-empty-state">Chưa có biên lai được phát hành.</div>
          ) : (
            receipts.map((receipt) => {
              const receiptId = getReceiptId(receipt)
              const invoice = receipt.invoice_id && typeof receipt.invoice_id === 'object' ? receipt.invoice_id : null
              return (
                <article className="patient-panel patient-receipt-row" key={receiptId}>
                  <div className="patient-receipt-row-icon">
                    <PatientIcon name="description" aria-hidden="true" />
                  </div>
                  <div className="patient-receipt-row-main">
                    <h3>{receipt.receipt_no || 'Biên lai'}</h3>
                    <p>{invoice?.invoice_no || receipt.intent_code || 'Chứng từ thanh toán'}</p>
                  </div>
                  <div className="patient-receipt-row-money">
                    <strong>{formatMoney(receipt.amount || receipt.payment_id?.amount)}</strong>
                    <span>{formatDateTime(receipt.issued_at || receipt.created_at)}</span>
                  </div>
                  <button
                    className="patient-outline-button"
                    type="button"
                    disabled={detailLoading === `receipt-${receiptId}`}
                    onClick={() => openReceiptDetail(receipt)}
                  >
                    Chi tiết
                  </button>
                  <button
                    className="patient-hero-button patient-receipt-download"
                    type="button"
                    disabled={detailLoading === `download-${receiptId}`}
                    onClick={() => downloadReceipt(receipt)}
                  >
                    <PatientIcon name="download" aria-hidden="true" />
                    <span>Tải</span>
                  </button>
                </article>
              )
            })
          )}
        </section>
      ) : null}

      {activeTab === 'payments' ? (
        <section className="patient-receipts-list">
          {payments.length === 0 ? (
            <div className="patient-empty-state">Chưa có giao dịch thanh toán.</div>
          ) : (
            payments.map((payment) => (
              <article className="patient-panel patient-receipt-row" key={getPaymentId(payment)}>
                <div className="patient-receipt-row-icon">
                  <PatientIcon name="account_balance_wallet" aria-hidden="true" />
                </div>
                <div className="patient-receipt-row-main">
                  <h3>{payment.payment_no || payment.transaction_ref || 'Giao dịch thanh toán'}</h3>
                  <p>{payment.payment_method || payment.payment_provider || 'Phương thức chưa rõ'}</p>
                </div>
                <div className="patient-receipt-row-money">
                  <strong>{formatMoney(payment.amount)}</strong>
                  <span>{formatDateTime(payment.paid_at || payment.created_at)}</span>
                </div>
                <span className={`patient-status-pill ${payment.status === 'completed' ? 'good' : 'soft'}`}>
                  {payment.status || 'Chưa rõ'}
                </span>
              </article>
            ))
          )}
        </section>
      ) : null}

      {detail ? (
        <aside className="patient-receipt-detail patient-panel">
          <div className="patient-panel-head">
            <div>
              <p className="patient-section-label">{detail.type === 'invoice' ? 'Chi tiết hóa đơn' : 'Chi tiết biên lai'}</p>
              <h2>{detail.data.invoice_no || detail.data.receipt_no || 'Chi tiết chứng từ'}</h2>
            </div>
            <button className="patient-outline-button" type="button" onClick={() => setDetail(null)}>Đóng</button>
          </div>

          {detail.type === 'invoice' ? (
            <div className="patient-receipt-detail-grid">
              <div><span>Tổng tiền</span><strong>{formatMoney(detail.data.total_amount)}</strong></div>
              <div><span>Đã thanh toán</span><strong>{formatMoney(detail.data.paid_amount)}</strong></div>
              <div><span>Còn lại</span><strong>{formatMoney(detail.data.balance_due)}</strong></div>
              <div><span>Số dòng phí</span><strong>{detail.data.items?.length || 0}</strong></div>
            </div>
          ) : (
            <div className="patient-receipt-detail-grid">
              <div><span>Mã biên lai</span><strong>{detail.data.receipt_no || 'Chưa có'}</strong></div>
              <div><span>Mã hóa đơn</span><strong>{detail.data.invoice_id?.invoice_no || 'Chưa có'}</strong></div>
              <div><span>Giao dịch</span><strong>{detail.data.payment_id?.payment_no || detail.data.intent_code || 'Chưa có'}</strong></div>
              <div><span>Ngày phát hành</span><strong>{formatDateTime(detail.data.issued_at || detail.data.created_at)}</strong></div>
            </div>
          )}
        </aside>
      ) : null}
    </div>
  )
}
