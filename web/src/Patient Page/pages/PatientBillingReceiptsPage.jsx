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

function asObject(value) {
  return value && typeof value === 'object' ? value : {}
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') || ''
}

function getPaymentMethodLabel(method, provider) {
  const normalized = String(method || provider || '').toLowerCase()
  const map = {
    e_wallet: 'Ví điện tử',
    momo: 'MoMo',
    momo_personal_qr: 'MoMo QR',
    bank_qr_manual: 'Chuyển khoản QR',
    qr_manual: 'QR thủ công',
    cash: 'Tiền mặt',
    card: 'Thẻ',
    credit_card: 'Thẻ tín dụng',
    manual: 'Thanh toán thủ công',
  }
  return map[normalized] || method || provider || 'Thanh toán'
}

function getReceiptStatusLabel(status) {
  const map = {
    generated: 'Đã phát hành',
    issued: 'Đã phát hành',
    sent: 'Đã gửi',
    printed: 'Đã in',
    cancelled: 'Đã hủy',
    voided: 'Đã hủy',
  }
  return map[status] || status || 'Đã phát hành'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeFileName(value, fallback = 'bien-lai') {
  return String(value || fallback)
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback
}

function getInvoiceLineItems(source = {}) {
  if (Array.isArray(source.items)) return source.items
  if (Array.isArray(source.invoice_items)) return source.invoice_items
  return []
}

function getInvoiceLineTitle(item = {}) {
  return firstValue(
    item.service_name,
    item.service_id?.service_name,
    item.description,
    item.charge_id?.charge_no,
    'Dòng phí',
  )
}

function getInvoiceLineCode(item = {}) {
  return firstValue(item.service_code, item.service_id?.service_code, item.charge_no, item.charge_id?.charge_no)
}

function getInvoiceLineKind(item = {}) {
  const sourceModule = String(item.charge_id?.source_module || item.source_module || '').toLowerCase()
  const serviceType = String(item.service_id?.service_type || item.service_type || '').toLowerCase()
  if (sourceModule.includes('dispense') || sourceModule.includes('medication') || serviceType.includes('medication')) {
    return 'Thuốc'
  }
  if (serviceType.includes('lab')) return 'Xét nghiệm'
  if (serviceType.includes('imaging')) return 'Chẩn đoán hình ảnh'
  if (serviceType.includes('consultation')) return 'Khám bệnh'
  return 'Dịch vụ'
}

function formatQuantity(value) {
  const quantity = Number(value ?? 0)
  if (!Number.isFinite(quantity)) return '0'
  return Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString('vi-VN')
}

function InvoiceLineItems({ items = [], title = 'Chi tiết thuốc / dịch vụ', emptyText = 'Chưa có dòng phí chi tiết.' }) {
  return (
    <section className="patient-invoice-lines">
      <div className="patient-invoice-lines-head">
        <div>
          <span>Chi tiết thanh toán</span>
          <h3>{title}</h3>
        </div>
        <strong>{items.length} dòng</strong>
      </div>

      {items.length ? (
        <div className="patient-invoice-lines-table" role="table" aria-label={title}>
          <div className="patient-invoice-lines-row is-head" role="row">
            <span role="columnheader">Khoản mục</span>
            <span role="columnheader">SL</span>
            <span role="columnheader">Đơn giá</span>
            <span role="columnheader">Thành tiền</span>
          </div>
          {items.map((item, index) => {
            const code = getInvoiceLineCode(item)
            const key = item._id || item.id || item.charge_id?._id || item.charge_id || `${getInvoiceLineTitle(item)}-${index}`
            return (
              <div className="patient-invoice-lines-row" role="row" key={key}>
                <div className="patient-invoice-line-name" role="cell">
                  <strong>{getInvoiceLineTitle(item)}</strong>
                  <span>{getInvoiceLineKind(item)}{code ? ` - ${code}` : ''}</span>
                </div>
                <span role="cell">{formatQuantity(item.quantity)}</span>
                <span role="cell">{formatMoney(item.unit_price)}</span>
                <strong role="cell">{formatMoney(item.line_total ?? item.total_amount)}</strong>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="patient-invoice-lines-empty">{emptyText}</div>
      )}
    </section>
  )
}

function buildReceiptDownloadHtml(receipt = {}) {
  const payment = asObject(receipt.payment_id)
  const invoice = asObject(receipt.invoice_id)
  const patient = asObject(receipt.patient_id)
  const intent = asObject(receipt.payment_intent_id)
  const receiptItems = getInvoiceLineItems(receipt)
  const method = getPaymentMethodLabel(
    firstValue(receipt.payment_method, payment.payment_method, intent.method),
    firstValue(receipt.payment_provider, payment.payment_provider, intent.provider),
  )
  const transactionRef = firstValue(
    receipt.transaction_ref,
    receipt.transaction_reference,
    payment.transaction_ref,
    payment.transaction_reference,
    intent.transaction_reference,
    payment.provider_transaction_id,
    receipt.provider_transaction_id,
  )
  const paymentNote = firstValue(receipt.payment_note, payment.payment_note, intent.payment_note)
  const amount = firstValue(receipt.amount, payment.amount, invoice.paid_amount)
  const paidAt = firstValue(payment.paid_at, payment.confirmed_at, receipt.issued_at, receipt.created_at)
  const rows = [
    ['Mã biên lai', receipt.receipt_no || 'Chưa có'],
    ['Mã hóa đơn', invoice.invoice_no || 'Chưa có'],
    ['Người bệnh', patient.full_name || 'Bệnh nhân'],
    ['Mã bệnh nhân', patient.patient_code || 'Chưa có'],
    ['Giao dịch', payment.payment_no || receipt.intent_code || intent.intent_code || 'Chưa có'],
    ['Phương thức', method],
    ['Mã tham chiếu', transactionRef || 'Chưa có'],
    ['Ngày thanh toán', formatDateTime(paidAt)],
    ['Ngày phát hành', formatDateTime(receipt.issued_at || receipt.created_at)],
    ['Điện thoại', patient.phone || 'Chưa có'],
  ]

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(receipt.receipt_no || 'Biên lai thanh toán')}</title>
  <style>
    body { margin: 0; padding: 32px; font-family: Arial, sans-serif; color: #102033; background: #eef5ff; }
    .paper { max-width: 820px; margin: 0 auto; padding: 28px; border-radius: 18px; background: #fff; box-shadow: 0 18px 45px rgba(15, 23, 42, .12); }
    .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px dashed #9fb2cc; padding-bottom: 18px; }
    .kicker { color: #64748b; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 8px 0 8px; font-size: 30px; }
    .status { min-width: 170px; padding: 14px; border-radius: 14px; color: #047857; background: #ecfdf5; text-align: center; font-weight: 800; }
    .amount { margin: 20px 0; padding: 20px; border-radius: 16px; color: #fff; background: linear-gradient(135deg, #0d63f3, #084bc2); }
    .amount span { display: block; opacity: .78; font-size: 13px; font-weight: 700; text-transform: uppercase; }
    .amount strong { display: block; margin-top: 8px; font-size: 38px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .cell, .note { padding: 14px; border: 1px solid #dbe7f5; border-radius: 12px; background: #f8fbff; }
    .cell span, .note span { display: block; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .cell strong, .note strong { display: block; margin-top: 6px; overflow-wrap: anywhere; }
    .note { margin-top: 12px; }
    .lines { margin-top: 16px; border: 1px solid #dbe7f5; border-radius: 14px; overflow: hidden; }
    .lines h2 { margin: 0; padding: 14px 16px; font-size: 18px; background: #f8fbff; border-bottom: 1px solid #dbe7f5; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 11px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
    th { color: #64748b; background: #f8fbff; font-size: 12px; text-transform: uppercase; }
    td:nth-child(n + 2), th:nth-child(n + 2) { text-align: right; white-space: nowrap; }
    tr:last-child td { border-bottom: 0; }
    .line-kind { display: block; margin-top: 4px; color: #64748b; font-size: 12px; }
    .footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 18px; padding-top: 14px; border-top: 1px dashed #9fb2cc; color: #64748b; font-size: 13px; }
    @media print { body { background: #fff; padding: 0; } .paper { box-shadow: none; } }
  </style>
</head>
<body>
  <main class="paper">
    <section class="top">
      <div>
        <div class="kicker">Bệnh viện Đa khoa Bộ Y tế</div>
        <h1>Biên lai thu tiền</h1>
        <p>Chứng từ thanh toán điện tử phát hành cho bệnh nhân.</p>
      </div>
      <div class="status">Đã thanh toán<br /><span>${escapeHtml(getReceiptStatusLabel(receipt.status))}</span></div>
    </section>
    <section class="amount"><span>Số tiền đã thu</span><strong>${escapeHtml(formatMoney(amount))}</strong></section>
    <section class="grid">
      ${rows.map(([label, value]) => `<div class="cell"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
    </section>
    ${paymentNote ? `<section class="note"><span>Nội dung thanh toán</span><strong>${escapeHtml(paymentNote)}</strong></section>` : ''}
    ${receiptItems.length ? `<section class="lines">
      <h2>Chi tiết thuốc / dịch vụ</h2>
      <table>
        <thead>
          <tr><th>Khoản mục</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
        </thead>
        <tbody>
          ${receiptItems.map((item) => {
            const code = getInvoiceLineCode(item)
            return `<tr>
              <td>${escapeHtml(getInvoiceLineTitle(item))}<span class="line-kind">${escapeHtml(getInvoiceLineKind(item))}${code ? ` - ${escapeHtml(code)}` : ''}</span></td>
              <td>${escapeHtml(formatQuantity(item.quantity))}</td>
              <td>${escapeHtml(formatMoney(item.unit_price))}</td>
              <td>${escapeHtml(formatMoney(item.line_total ?? item.total_amount))}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </section>` : ''}
    <section class="footer">
      <span>Biên lai này xác nhận khoản thanh toán đã được ghi nhận trong hệ thống.</span>
      <strong>${escapeHtml(receipt._id || receipt.receipt_id || receipt.id || receipt.receipt_no || '')}</strong>
    </section>
  </main>
</body>
</html>`
}

function downloadHtmlFile(html, fileName) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function ReceiptDetailPaper({ receipt }) {
  const payment = asObject(receipt.payment_id)
  const invoice = asObject(receipt.invoice_id)
  const patient = asObject(receipt.patient_id)
  const intent = asObject(receipt.payment_intent_id)
  const method = getPaymentMethodLabel(
    firstValue(receipt.payment_method, payment.payment_method, intent.method),
    firstValue(receipt.payment_provider, payment.payment_provider, intent.provider),
  )
  const transactionRef = firstValue(
    receipt.transaction_ref,
    receipt.transaction_reference,
    payment.transaction_ref,
    payment.transaction_reference,
    intent.transaction_reference,
    payment.provider_transaction_id,
    receipt.provider_transaction_id,
  )
  const paymentNote = firstValue(receipt.payment_note, payment.payment_note, intent.payment_note)
  const isMomoPayment = /momo/i.test(`${method} ${transactionRef} ${paymentNote}`)
  const amount = firstValue(receipt.amount, payment.amount, invoice.paid_amount)
  const paidAt = firstValue(payment.paid_at, payment.confirmed_at, receipt.issued_at, receipt.created_at)
  const receiptItems = getInvoiceLineItems(receipt)

  return (
    <section className="patient-receipt-paper" aria-label="Biên lai thanh toán">
      <div className="patient-receipt-paper-top">
        <div>
          <span>Bệnh viện Đa khoa Bộ Y tế</span>
          <h3>Biên lai thu tiền</h3>
          <p>Chứng từ thanh toán điện tử phát hành cho bệnh nhân.</p>
        </div>
        <div className="patient-receipt-paper-status">
          <PatientIcon name="verified" aria-hidden="true" />
          <strong>Đã thanh toán</strong>
          <span>{getReceiptStatusLabel(receipt.status)}</span>
        </div>
      </div>

      <div className="patient-receipt-paper-amount">
        <span>Số tiền đã thu</span>
        <strong>{formatMoney(amount)}</strong>
        {isMomoPayment ? <em>Thanh toán MoMo</em> : null}
      </div>

      <div className="patient-receipt-paper-grid">
        <div><span>Mã biên lai</span><strong>{receipt.receipt_no || 'Chưa có'}</strong></div>
        <div><span>Mã hóa đơn</span><strong>{invoice.invoice_no || 'Chưa có'}</strong></div>
        <div><span>Người bệnh</span><strong>{patient.full_name || 'Bệnh nhân'}</strong></div>
        <div><span>Mã bệnh nhân</span><strong>{patient.patient_code || 'Chưa có'}</strong></div>
        <div><span>Giao dịch</span><strong>{payment.payment_no || receipt.intent_code || intent.intent_code || 'Chưa có'}</strong></div>
        <div><span>Phương thức</span><strong>{method}</strong></div>
        <div><span>Mã tham chiếu</span><strong>{transactionRef || 'Chưa có'}</strong></div>
        <div><span>Ngày thanh toán</span><strong>{formatDateTime(paidAt)}</strong></div>
        <div><span>Ngày phát hành</span><strong>{formatDateTime(receipt.issued_at || receipt.created_at)}</strong></div>
        <div><span>Điện thoại</span><strong>{patient.phone || 'Chưa có'}</strong></div>
      </div>

      {paymentNote ? (
        <div className="patient-receipt-paper-note">
          <span>Nội dung thanh toán</span>
          <strong>{paymentNote}</strong>
        </div>
      ) : null}

      <InvoiceLineItems
        items={receiptItems}
        title="Chi tiết thuốc / dịch vụ đã thanh toán"
        emptyText="Biên lai này chưa có dòng thuốc hoặc dịch vụ chi tiết từ hóa đơn."
      />

      <div className="patient-receipt-paper-footer">
        <span>Biên lai này xác nhận khoản thanh toán đã được ghi nhận trong hệ thống.</span>
        <strong>{receipt._id || receipt.receipt_id || receipt.id || receipt.receipt_no}</strong>
      </div>
    </section>
  )
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
      const downloadedReceipt = payload?.receipt || payload || receipt
      if (url && payload?.content_type && payload.content_type !== 'application/json') {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        const receiptNo = downloadedReceipt?.receipt_no || receipt.receipt_no || receiptId
        downloadHtmlFile(
          buildReceiptDownloadHtml(downloadedReceipt),
          `${safeFileName(receiptNo, 'bien-lai')}.html`,
        )
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
            <>
              <div className="patient-receipt-detail-grid">
                <div><span>Tổng tiền</span><strong>{formatMoney(detail.data.total_amount)}</strong></div>
                <div><span>Đã thanh toán</span><strong>{formatMoney(detail.data.paid_amount)}</strong></div>
                <div><span>Còn lại</span><strong>{formatMoney(detail.data.balance_due)}</strong></div>
                <div><span>Số dòng phí</span><strong>{getInvoiceLineItems(detail.data).length}</strong></div>
              </div>
              <InvoiceLineItems items={getInvoiceLineItems(detail.data)} />
            </>
          ) : (
            <ReceiptDetailPaper receipt={detail.data} />
          )}
        </aside>
      ) : null}
    </div>
  )
}
