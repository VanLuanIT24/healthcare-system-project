import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import paymentGiftImage from '../assets/payment-gift.png'
import { paymentMethods } from '../data/patientPageData'

function formatMoney(value) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function getInvoiceId(invoice) {
  return invoice.invoice_id || invoice._id || invoice.id || invoice.invoice_no
}

function mapInvoiceToCheckoutItem(invoice) {
  const balanceDue = invoice.balance_due ?? invoice.total_amount ?? 0
  const status = invoice.status || 'unknown'

  return {
    id: getInvoiceId(invoice),
    label: invoice.invoice_no ? `Hóa đơn ${invoice.invoice_no}` : 'Hóa đơn bệnh viện',
    subLabel: status === 'paid' ? 'Đã thanh toán' : status === 'partially_paid' ? 'Còn một phần cần thanh toán' : 'Chờ thanh toán',
    amount: formatMoney(balanceDue),
    rawAmount: Number(balanceDue || 0),
    issuedAt: invoice.issued_at || invoice.created_at,
    status,
    icon: 'receipt_long',
    iconTone: status === 'paid' ? 'green' : 'blue',
  }
}

function summarizeBillingAmount(summary, groupKey, amountKey = 'total_amount') {
  const rows = Array.isArray(summary?.[groupKey]) ? summary[groupKey] : []
  return rows.reduce((total, row) => total + Number(row?.[amountKey] || 0), 0)
}

export default function PatientBillingPage({
  billingSummary,
  error = '',
  invoices = [],
  loading = false,
  payments = [],
}) {
  const checkoutItems = useMemo(() => invoices.map(mapInvoiceToCheckoutItem), [invoices])
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedMethod, setSelectedMethod] = useState(paymentMethods[0]?.id || '')

  const currentItem = checkoutItems.find(i => i.id === selectedItem) || checkoutItems[0] || {
    label: 'Chưa có hóa đơn',
    subLabel: 'Không có khoản thanh toán từ backend',
    amount: formatMoney(0),
    rawAmount: 0,
    status: 'none',
  }
  const totalDue = summarizeBillingAmount(billingSummary, 'invoices', 'balance_due')
  const totalPaid = summarizeBillingAmount(billingSummary, 'payments')

  useEffect(() => {
    if (!checkoutItems.length) {
      setSelectedItem('')
      return
    }

    if (!checkoutItems.some((item) => item.id === selectedItem)) {
      setSelectedItem(checkoutItems[0].id)
    }
  }, [checkoutItems, selectedItem])

  return (
    <div className="patient-billing-page">
      <header className="pb-header">
        <h1>Thanh toán</h1>
        <p>Thanh toán nhanh chóng, an toàn và tiện lợi.</p>
      </header>

      {loading ? (
        <div className="patient-dashboard-state">Đang tải hóa đơn từ backend...</div>
      ) : null}

      {!loading && error ? (
        <div className="patient-dashboard-state patient-dashboard-state-error">{error}</div>
      ) : null}

      <div className="pb-layout">
        <div className="pb-main">
          <div className="pb-stepper-container">
            <div className="pb-stepper">
              <div className="pb-step pb-step-active">
                <div className="pb-step-icon"><PatientIcon name="receipt_long" aria-hidden="true" /></div>
                <div className="pb-step-text">
                  <strong>1. Chọn khoản thanh toán</strong>
                  <span>Dịch vụ, hóa đơn hoặc đặt cọc</span>
                </div>
              </div>
              <div className="pb-step-divider"></div>
              <div className="pb-step">
                <div className="pb-step-icon"><PatientIcon name="account_balance_wallet" aria-hidden="true" /></div>
                <div className="pb-step-text">
                  <strong>2. Chọn phương thức</strong>
                  <span>Chọn hình thức thanh toán</span>
                </div>
              </div>
              <div className="pb-step-divider"></div>
              <div className="pb-step">
                <div className="pb-step-icon"><PatientIcon name="task_alt" aria-hidden="true" /></div>
                <div className="pb-step-text">
                  <strong>3. Xác nhận & thanh toán</strong>
                  <span>Kiểm tra và hoàn tất giao dịch</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pb-columns">
            {/* Left Column */}
            <div className="pb-column">
              <h2>Chọn khoản thanh toán</h2>
              <div className="pb-column-card">
                <div className="pb-options">
                  {checkoutItems.map((item) => {
                    const active = item.id === selectedItem
                    return (
                      <label key={item.id} className={`pb-option ${active ? 'is-selected' : ''}`}>
                        <div className="pb-radio">
                          <input
                            type="radio"
                            name="checkoutItem"
                            checked={active}
                            onChange={() => setSelectedItem(item.id)}
                          />
                          <span className="pb-radio-custom">
                            {active && <span className="pb-radio-dot"></span>}
                          </span>
                        </div>
                        <div className="pb-option-content">
                          <div className={`pb-option-icon ${item.iconTone}`}>
                            <PatientIcon name={item.icon} aria-hidden="true" />
                          </div>
                          <div className="pb-option-text">
                            <strong>{item.label}</strong>
                            <span>{item.subLabel}</span>
                          </div>
                          <div className="pb-option-right">
                            <span className="pb-amount">{item.amount}</span>
                            <span className="pb-details">Chi tiết <PatientIcon name="expand_more" aria-hidden="true" /></span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                  {!loading && checkoutItems.length === 0 ? (
                    <div className="patient-empty-state">
                      Chưa có hóa đơn nào được backend trả về cho tài khoản này.
                    </div>
                  ) : null}
                </div>
                <div className="pb-history-link">
                  <PatientIcon name="info" aria-hidden="true" className="pb-info-icon" />
                  <span>Bạn có thể xem lịch sử giao dịch và hóa đơn tại mục <button className="pb-link-button">Xem lịch sử</button></span>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="pb-column">
              <h2>Chọn phương thức thanh toán</h2>
              <div className="pb-column-card">
                <div className="pb-options">
                  {paymentMethods.map((method) => {
                    const active = method.id === selectedMethod
                    return (
                      <label key={method.id} className={`pb-option ${active ? 'is-selected' : ''}`}>
                        <div className="pb-radio">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={active}
                            onChange={() => setSelectedMethod(method.id)}
                          />
                          <span className="pb-radio-custom">
                            {active && <span className="pb-radio-dot"></span>}
                          </span>
                        </div>
                        <div className="pb-option-content">
                          <div className={`pb-option-icon pb-method-icon ${method.iconTone}`}>
                            <PatientIcon name={method.icon} aria-hidden="true" />
                          </div>
                          <div className="pb-option-text">
                            <strong>{method.label}</strong>
                            <span>{method.subLabel}</span>
                          </div>
                          <div className="pb-option-right pb-option-right-method">
                            {method.recommended && <span className="pb-badge">Đề xuất</span>}
                            {method.logos && (
                              <div className="pb-logos">
                                {method.logos.map((logo, i) => {
                                  // Map logo names to visual representation or text
                                  let logoClass = logo.toLowerCase()
                                  let displayLogo = logo
                                  if (logo === 'VISA') {
                                    return <span key={i} className={`pb-logo-img pb-visa`}>VISA</span>
                                  } else if (logo === 'MC') {
                                    return <div key={i} className="pb-mc-logo"><div className="pb-mc-red"></div><div className="pb-mc-yellow"></div></div>
                                  } else if (logo === 'JCB') {
                                    return <span key={i} className={`pb-logo-img pb-jcb`}>JCB</span>
                                  } else if (logo === 'MoMo') {
                                     return <span key={i} className={`pb-logo-img pb-momo`}>mo<br/>mo</span>
                                  } else if (logo === 'ZaloPay') {
                                     return <span key={i} className={`pb-logo-img pb-zalopay`}>Zalo<br/>Pay</span>
                                  } else if (logo === 'VNPay') {
                                     return <span key={i} className={`pb-logo-img pb-vnpay`}>VN<br/>PAY</span>
                                  }
                                  return <span key={i} className={`pb-logo-badge ${logoClass}`}>{displayLogo}</span>
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <div className="pb-security-text">
                  <PatientIcon name="verified_user" aria-hidden="true" className="pb-shield-green-icon" />
                  <span>Mọi giao dịch đều được mã hóa và bảo mật tuyệt đối.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pb-banner">
            <div className="pb-banner-content">
              <div className="pb-banner-art" aria-hidden="true">
                <img src={paymentGiftImage} alt="" />
              </div>
              <div>
                <h3>Thanh toán nhanh - Nhận nhiều ưu đãi</h3>
                <p>Thanh toán qua ví HealthCare để nhận hoàn tiền và nhiều ưu đãi hấp dẫn.</p>
              </div>
            </div>
            <button className="pb-btn-primary pb-btn-rounded">Nạp ví ngay</button>
          </div>
        </div>

        <aside className="pb-sidebar">
          <div className="pb-card pb-summary-card">
            <div className="pb-payment-graphic" aria-hidden="true">
              <div className="pb-payment-card-visual">
                <span className="pb-payment-chip"></span>
                <PatientIcon name="credit_card" className="pb-payment-card-icon" />
                <span className="pb-payment-card-line is-long"></span>
                <span className="pb-payment-card-line"></span>
              </div>
              <div className="pb-payment-receipt-visual">
                <PatientIcon name="receipt_long" className="pb-payment-receipt-icon" />
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="pb-payment-check-visual">
                <PatientIcon name="check" />
              </div>
            </div>
            <div className="pb-card-header-blue">
              <h3>Tóm tắt thanh toán</h3>
              <span className="pb-summary-header-icon" aria-hidden="true">
                <PatientIcon name="description" />
              </span>
            </div>
            <div className="pb-card-body">
              <div className="pb-summary-section">
                <div className="pb-summary-row">
                  <span>Khoản thanh toán</span>
                </div>
                <div className="pb-summary-row pb-summary-item-name">
                  <strong>{currentItem.label}</strong>
                </div>
              </div>
              
              <div className="pb-summary-row pb-mt-12">
                <span>Hóa đơn</span>
                <strong>{currentItem.subLabel.replace('Hóa đơn ', '') || '#HD2024-000123'}</strong>
              </div>
              <div className="pb-summary-row">
                <span>Ngày tạo</span>
                <strong>
                  {currentItem.issuedAt
                    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(currentItem.issuedAt))
                    : 'Chưa có dữ liệu'}
                </strong>
              </div>
              <div className="pb-divider"></div>
              <div className="pb-summary-row">
                <span>Đã thanh toán</span>
                <strong>{formatMoney(totalPaid)}</strong>
              </div>
              <div className="pb-summary-row">
                <span>Còn phải thu</span>
                <strong>{formatMoney(totalDue)}</strong>
              </div>
              <div className="pb-summary-row">
                <span>Tạm tính</span>
                <strong>{currentItem.amount}</strong>
              </div>
              <div className="pb-summary-row">
                <span>Phí dịch vụ <PatientIcon name="help_outline" aria-hidden="true" className="pb-help-icon" /></span>
                <strong>0 đ</strong>
              </div>
              <div className="pb-divider"></div>
              <div className="pb-summary-row pb-total">
                <span>Tổng thanh toán</span>
                <strong>{currentItem.amount}</strong>
              </div>
              <button className="pb-btn-primary pb-btn-full pb-btn-pay" type="button" disabled>
                <PatientIcon name="lock" aria-hidden="true" className="pb-btn-icon" /> Chưa có API thanh toán online
              </button>
              <p className="pb-security-text">
                Backend hiện hỗ trợ bệnh nhân xem hóa đơn và lịch sử thanh toán; tạo payment vẫn là luồng nhân viên.
              </p>
            </div>
          </div>

          <div className="pb-card pb-security-card">
            <h3><PatientIcon name="gpp_good" aria-hidden="true" className="pb-blue-icon"/> Thanh toán an toàn</h3>
            <ul>
              <li><PatientIcon name="verified" aria-hidden="true" className="pb-blue-icon"/> Bảo mật dữ liệu theo tiêu chuẩn quốc tế</li>
              <li><PatientIcon name="verified" aria-hidden="true" className="pb-blue-icon"/> Xác thực 2 lớp cho mọi giao dịch</li>
              <li><PatientIcon name="lock" aria-hidden="true" className="pb-blue-icon"/> Thông tin được mã hóa 256-bit SSL</li>
            </ul>
          </div>

          <div className="pb-card pb-support-card">
            <div className="pb-support-content">
              <div className="pb-support-text">
                <h3>Cần hỗ trợ?</h3>
                <p>Đội ngũ chăm sóc khách hàng luôn sẵn sàng hỗ trợ bạn 24/7.</p>
                <button className="pb-btn-outline">Liên hệ hỗ trợ</button>
              </div>
              <div className="pb-support-avatar">
                <PatientIcon name="support_agent" aria-hidden="true" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
