import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import paymentGiftImage from '../assets/payment-gift.png'
import { paymentMethods } from '../data/patientPageData'
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

function getInvoiceId(invoice) {
  return invoice.invoice_id || invoice._id || invoice.id || invoice.invoice_no
}

function getPaymentId(payment = {}) {
  return payment.payment_id || payment._id || payment.id || payment.payment_no || payment.transaction_ref
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

function getPaymentStatusLabel(status) {
  const map = {
    pending: 'Đang chờ',
    processing: 'Đang xử lý',
    completed: 'Đã thanh toán',
    failed: 'Thất bại',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền',
  }
  return map[status] || status || 'Chưa rõ'
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

function providerForMethod(methodId) {
  if (methodId === 'e-wallet' || methodId === 'healthcare-wallet') return 'momo_personal_qr'
  if (methodId === 'over-counter') return 'cash_manual'
  return 'bank_qr_manual'
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatCardNumber(value) {
  return digitsOnly(value).slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value) {
  const digits = digitsOnly(value).slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function isValidExpiry(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})$/)
  if (!match) return false
  const month = Number(match[1])
  return month >= 1 && month <= 12
}

function maskPhone(value) {
  const digits = digitsOnly(value)
  if (digits.length <= 4) return digits
  return `${digits.slice(0, 3)}•••${digits.slice(-3)}`
}

export default function PatientBillingPage({
  billingSummary,
  description = 'Thanh toán nhanh chóng, an toàn và tiện lợi.',
  error = '',
  invoices = [],
  loading = false,
  onOpenHistory,
  onOpenSupportChat,
  onPaymentCompleted,
  payments = [],
  title = 'Thanh toán',
}) {
  const checkoutItems = useMemo(() => invoices.map(mapInvoiceToCheckoutItem), [invoices])
  const billingHistoryItems = useMemo(() => {
    const invoiceRows = invoices.map((invoice) => {
      const balanceDue = Number(invoice.balance_due || 0)
      return {
        id: `invoice-${getInvoiceId(invoice)}`,
        type: 'invoice',
        icon: 'receipt_long',
        title: invoice.invoice_no || 'Hóa đơn bệnh viện',
        subtitle: formatDateTime(invoice.issued_at || invoice.created_at),
        amount: formatMoney(invoice.total_amount ?? invoice.balance_due),
        status: getInvoiceStatusLabel(invoice.status),
        tone: balanceDue > 0 ? 'warn' : 'good',
        sortDate: invoice.issued_at || invoice.created_at,
      }
    })

    const paymentRows = payments.map((payment) => ({
      id: `payment-${getPaymentId(payment)}`,
      type: 'payment',
      icon: 'account_balance_wallet',
      title: payment.payment_no || payment.transaction_ref || 'Giao dịch thanh toán',
      subtitle: payment.payment_method || payment.payment_provider || formatDateTime(payment.paid_at || payment.created_at),
      amount: formatMoney(payment.amount),
      status: getPaymentStatusLabel(payment.status),
      tone: payment.status === 'completed' ? 'good' : 'soft',
      sortDate: payment.paid_at || payment.created_at,
    }))

    return [...invoiceRows, ...paymentRows]
      .sort((a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0))
      .slice(0, 5)
  }, [invoices, payments])
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedMethod, setSelectedMethod] = useState(paymentMethods[0]?.id || '')
  const [paymentIntent, setPaymentIntent] = useState(null)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentFeedback, setPaymentFeedback] = useState(null)
  const [paymentReceipt, setPaymentReceipt] = useState(null)
  const [qrImageFailed, setQrImageFailed] = useState(false)
  const [momoSandboxForm, setMomoSandboxForm] = useState({
    walletPhone: '',
    cardHolder: '',
    cardNumber: '',
    expiry: '',
    otp: '',
  })
  const [momoSandboxOtp, setMomoSandboxOtp] = useState('')

  const currentItem = checkoutItems.find(i => i.id === selectedItem) || checkoutItems[0] || {
    label: 'Chưa có hóa đơn',
    subLabel: 'Không có khoản thanh toán từ backend',
    amount: formatMoney(0),
    rawAmount: 0,
    status: 'none',
  }
  const totalDue = summarizeBillingAmount(billingSummary, 'invoices', 'balance_due')
  const totalPaid = summarizeBillingAmount(billingSummary, 'payments')
  const currentMethod = paymentMethods.find((method) => method.id === selectedMethod) || paymentMethods[0]
  const isMomoSandbox = selectedMethod === 'e-wallet'
  const momoCardDigits = digitsOnly(momoSandboxForm.cardNumber)
  const momoWalletDigits = digitsOnly(momoSandboxForm.walletPhone)
  const momoOtpVerified = !isMomoSandbox || (momoSandboxOtp && momoSandboxForm.otp === momoSandboxOtp)
  const canStartDemoPayment = currentItem.id && currentItem.rawAmount > 0 && currentItem.status !== 'paid'
  const hasSelectedPayableItem = Boolean(currentItem.id && currentItem.status !== 'none')
  const hasSelectedMethod = hasSelectedPayableItem && Boolean(currentMethod?.id)
  const hasPaymentIntent = Boolean(paymentIntent)
  const paymentCompleted = ['succeeded', 'completed', 'paid'].includes(paymentIntent?.status)
    || (paymentFeedback?.type === 'success' && paymentFeedback?.message?.includes('thành công'))
  const activePaymentStep = !hasSelectedPayableItem ? 1 : !hasSelectedMethod ? 2 : hasPaymentIntent || paymentCompleted ? 3 : 2
  const paymentSteps = [
    {
      number: 1,
      icon: 'receipt_long',
      title: 'Chọn khoản thanh toán',
      description: 'Dịch vụ, hóa đơn hoặc đặt cọc',
      done: hasSelectedPayableItem,
    },
    {
      number: 2,
      icon: 'account_balance_wallet',
      title: 'Chọn phương thức',
      description: 'Chọn hình thức thanh toán',
      done: hasSelectedMethod,
    },
    {
      number: 3,
      icon: paymentCompleted ? 'task_alt' : 'help_outline',
      title: 'Xác nhận & thanh toán',
      description: 'Kiểm tra và hoàn tất giao dịch',
      done: paymentCompleted,
    },
  ]
  const invoiceSummaryLabel = currentItem.status === 'none'
    ? 'Chưa có dữ liệu'
    : currentItem.subLabel.replace('Hóa đơn ', '') || currentItem.label

  useEffect(() => {
    if (!checkoutItems.length) {
      setSelectedItem('')
      return
    }

    if (!checkoutItems.some((item) => item.id === selectedItem)) {
      setSelectedItem(checkoutItems[0].id)
    }
  }, [checkoutItems, selectedItem])

  useEffect(() => {
    setPaymentIntent(null)
    setPaymentFeedback(null)
    setPaymentReceipt(null)
    setQrImageFailed(false)
    setMomoSandboxOtp('')
    setMomoSandboxForm((current) => ({ ...current, otp: '' }))
  }, [selectedItem, selectedMethod])

  function getMomoSandboxError({ includeOtp = true } = {}) {
    if (!isMomoSandbox) return ''
    if (momoWalletDigits.length < 9 || momoWalletDigits.length > 11) return 'Vui lòng nhập số ví MoMo hợp lệ.'
    if (!momoSandboxForm.cardHolder.trim()) return 'Vui lòng nhập tên trên thẻ liên kết.'
    if (momoCardDigits.length < 12 || momoCardDigits.length > 19) return 'Vui lòng nhập số thẻ từ 12-19 chữ số.'
    if (!isValidExpiry(momoSandboxForm.expiry)) return 'Vui lòng nhập hạn thẻ theo định dạng MM/YY.'
    if (!includeOtp) return ''
    if (!momoSandboxOtp) return 'Vui lòng gửi OTP giả lập trước khi thanh toán.'
    if (!momoOtpVerified) return 'OTP giả lập không đúng.'
    return ''
  }

  function handleMomoFieldChange(field, value) {
    const normalizers = {
      walletPhone: (input) => digitsOnly(input).slice(0, 11),
      cardNumber: formatCardNumber,
      expiry: formatExpiry,
      otp: (input) => digitsOnly(input).slice(0, 6),
    }
    setMomoSandboxForm((current) => ({
      ...current,
      [field]: normalizers[field] ? normalizers[field](value) : value,
    }))
  }

  function handleSendMomoOtp() {
    const validationError = getMomoSandboxError({ includeOtp: false })
    if (validationError) {
      setPaymentFeedback({ type: 'error', message: validationError })
      return
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    setMomoSandboxOtp(otp)
    setMomoSandboxForm((current) => ({ ...current, otp: '' }))
    setPaymentFeedback({
      type: 'success',
      message: `OTP giả lập đã được tạo cho ví ${maskPhone(momoSandboxForm.walletPhone)}. Nhập mã ${otp} để kiểm thử.`,
    })
  }

  async function handleCreateDemoPayment() {
    if (!canStartDemoPayment || paymentBusy) return

    const momoValidationError = getMomoSandboxError()
    if (momoValidationError) {
      setPaymentFeedback({ type: 'error', message: momoValidationError })
      return
    }

    setPaymentBusy(true)
    setPaymentFeedback(null)

    try {
      const payload = unwrapData(await billingAPI.createMyPaymentIntent(currentItem.id, {
        amount: currentItem.rawAmount,
        provider: providerForMethod(selectedMethod),
        force_new: isMomoSandbox,
        payment_note: isMomoSandbox ? `MOMO DEMO ${currentItem.id}` : `DEMO ${currentItem.id}`,
        metadata: isMomoSandbox ? {
          sandbox: true,
          provider: 'momo',
          wallet_phone_masked: maskPhone(momoSandboxForm.walletPhone),
          linked_card_last4: momoCardDigits.slice(-4),
          otp_verified: true,
        } : undefined,
      }))
      setPaymentIntent(payload?.payment_intent || payload)
      setQrImageFailed(false)
      setPaymentFeedback({
        type: 'success',
        message: isMomoSandbox
          ? 'Đã tạo giao dịch MoMo. Bấm xác nhận để ghi nhận thanh toán và sinh biên lai.'
          : 'Đã tạo giao dịch thử nghiệm. Bạn có thể giả lập thanh toán để hoàn tất.',
      })
    } catch (err) {
      setPaymentFeedback({ type: 'error', message: getApiErrorMessage(err, 'Không tạo được giao dịch thử nghiệm.') })
    } finally {
      setPaymentBusy(false)
    }
  }

  async function handleConfirmDemoPayment() {
    const intentId = paymentIntent?.payment_intent_id || paymentIntent?._id || paymentIntent?.id
    if (!intentId || paymentBusy) return

    const momoValidationError = getMomoSandboxError()
    if (momoValidationError) {
      setPaymentFeedback({ type: 'error', message: momoValidationError })
      return
    }

    setPaymentBusy(true)
    setPaymentFeedback(null)

    try {
      const payload = unwrapData(await billingAPI.confirmMyDemoPaymentIntent(intentId, {
        transaction_reference: isMomoSandbox
          ? `MOMO-SANDBOX-${momoCardDigits.slice(-4)}-${Date.now()}`
          : `DEMO-PAID-${Date.now()}`,
        note: isMomoSandbox
          ? `MoMo OTP verified for ${maskPhone(momoSandboxForm.walletPhone)} / card ****${momoCardDigits.slice(-4)}.`
          : undefined,
      }))
      const nextIntent = payload?.payment_intent || paymentIntent
      const payment = payload?.payment
      const paymentId = payment?.payment_id || payment?._id || payment?.id
      setPaymentIntent(nextIntent)
      setQrImageFailed(false)
      if (paymentId) {
        try {
          const receiptPayload = unwrapData(await billingAPI.getMyPaymentReceipt(paymentId))
          setPaymentReceipt(receiptPayload?.receipt || receiptPayload)
        } catch (receiptErr) {
          setPaymentReceipt(null)
        }
      }
      setPaymentFeedback({
        type: 'success',
        message: paymentId
          ? 'Thanh toán MoMo thành công. Hóa đơn đã cập nhật và biên lai đã sẵn sàng trong mục Hóa đơn / Biên lai.'
          : 'Thanh toán thử nghiệm thành công. Hóa đơn và biên lai đã được cập nhật.',
      })
      await onPaymentCompleted?.()
    } catch (err) {
      setPaymentFeedback({ type: 'error', message: getApiErrorMessage(err, 'Không xác nhận được thanh toán thử nghiệm.') })
    } finally {
      setPaymentBusy(false)
    }
  }

  return (
    <div className="patient-billing-page">
      <header className="pb-header">
        <h1>{title}</h1>
        <p>{description}</p>
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
              {paymentSteps.map((step, index) => {
                const active = activePaymentStep === step.number
                const done = step.done || activePaymentStep > step.number
                const locked = !active && !done
                return (
                  <div className="pb-step-fragment" key={step.number}>
                    <div className={`pb-step ${active ? 'pb-step-active' : ''} ${done ? 'pb-step-done' : ''} ${locked ? 'pb-step-locked' : ''}`}>
                      <div className="pb-step-icon"><PatientIcon name={done && !active ? 'check' : step.icon} aria-hidden="true" /></div>
                      <div className="pb-step-text">
                        <strong>{step.number}. {step.title}</strong>
                        <span>{done && !active ? 'Đã xong' : step.description}</span>
                      </div>
                    </div>
                    {index < paymentSteps.length - 1 ? (
                      <div className={`pb-step-divider ${activePaymentStep > step.number ? 'is-done' : ''}`}></div>
                    ) : null}
                  </div>
                )
              })}
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
                <div className="pb-inline-history">
                  <div className="pb-inline-history-head">
                    <div>
                      <span>Lịch sử gần đây</span>
                      <strong>Hóa đơn và giao dịch</strong>
                    </div>
                    <span className="pb-inline-history-count">{billingHistoryItems.length}</span>
                  </div>

                  {billingHistoryItems.length > 0 ? (
                    <div className="pb-inline-history-list">
                      {billingHistoryItems.map((item) => (
                        <article className="pb-inline-history-row" key={item.id}>
                          <div className={`pb-inline-history-icon ${item.tone}`}>
                            <PatientIcon name={item.icon} aria-hidden="true" />
                          </div>
                          <div className="pb-inline-history-main">
                            <strong>{item.title}</strong>
                            <span>{item.subtitle || 'Chưa có ngày'}</span>
                          </div>
                          <div className="pb-inline-history-side">
                            <strong>{item.amount}</strong>
                            <span className={`pb-inline-history-status ${item.tone}`}>{item.status}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="pb-inline-history-empty">
                      <PatientIcon name="info" aria-hidden="true" />
                      <span>Chưa có hóa đơn hoặc giao dịch nào từ backend.</span>
                    </div>
                  )}
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
                <p>Thanh toán qua ví Bộ Y tế để nhận hoàn tiền và nhiều ưu đãi hấp dẫn.</p>
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
                <strong>{invoiceSummaryLabel}</strong>
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
              {isMomoSandbox ? (
                <div className="pb-momo-sandbox-form">
                  <div className="pb-momo-sandbox-head">
                    <span className="pb-momo-mark">MoMo</span>
                    <div>
                      <strong>Thanh toán MoMo</strong>
                      <small>Nhập thẻ liên kết và OTP giả lập. Không trừ tiền thật.</small>
                    </div>
                  </div>
                  <label>
                    <span>Số ví MoMo</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={momoSandboxForm.walletPhone}
                      onChange={(event) => handleMomoFieldChange('walletPhone', event.target.value)}
                      placeholder="0901234567"
                      disabled={paymentBusy || Boolean(paymentIntent)}
                    />
                  </label>
                  <label>
                    <span>Tên trên thẻ liên kết</span>
                    <input
                      value={momoSandboxForm.cardHolder}
                      onChange={(event) => handleMomoFieldChange('cardHolder', event.target.value)}
                      placeholder="NGUYEN VAN A"
                      disabled={paymentBusy || Boolean(paymentIntent)}
                    />
                  </label>
                  <div className="pb-momo-card-row">
                    <label>
                      <span>Số thẻ liên kết</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={momoSandboxForm.cardNumber}
                        onChange={(event) => handleMomoFieldChange('cardNumber', event.target.value)}
                        placeholder="9704 0000 0000 0018"
                        disabled={paymentBusy || Boolean(paymentIntent)}
                      />
                    </label>
                    <label>
                      <span>MM/YY</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={momoSandboxForm.expiry}
                        onChange={(event) => handleMomoFieldChange('expiry', event.target.value)}
                        placeholder="12/28"
                        disabled={paymentBusy || Boolean(paymentIntent)}
                      />
                    </label>
                  </div>
                  <div className="pb-momo-otp-row">
                    <label>
                      <span>OTP giả lập</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={momoSandboxForm.otp}
                        onChange={(event) => handleMomoFieldChange('otp', event.target.value)}
                        placeholder="6 chữ số"
                        disabled={paymentBusy || Boolean(paymentIntent)}
                      />
                    </label>
                    <button type="button" onClick={handleSendMomoOtp} disabled={paymentBusy || Boolean(paymentIntent)}>
                      Gửi OTP
                    </button>
                  </div>
                  {momoSandboxOtp ? (
                    <p className="pb-momo-otp-hint">
                      OTP MoMo: <strong>{momoSandboxOtp}</strong>
                    </p>
                  ) : null}
                </div>
              ) : null}
              {paymentFeedback ? (
                <div className={`pb-demo-alert ${paymentFeedback.type === 'error' ? 'is-error' : 'is-success'}`}>
                  {paymentFeedback.message}
                </div>
              ) : null}
              {paymentIntent ? (
                <div className="pb-demo-payment-panel">
                  <span className="pb-demo-badge">MoMo</span>
                  <div>
                    <span>Mã giao dịch</span>
                    <strong>{paymentIntent.intent_code || paymentIntent.payment_intent_id}</strong>
                  </div>
                  <div>
                    <span>Nội dung CK</span>
                    <strong>{paymentIntent.payment_note || `DEMO ${currentItem.id}`}</strong>
                  </div>
                  {paymentIntent.qr_image_url && !qrImageFailed ? (
                    <img
                      src={paymentIntent.qr_image_url}
                      alt="QR thanh toán thử nghiệm"
                      onError={() => setQrImageFailed(true)}
                    />
                  ) : (
                    <div className="pb-demo-qr-fallback">
                      <PatientIcon name="qr_code_2" aria-hidden="true" />
                      <strong>{isMomoSandbox ? 'QR MoMo chưa cấu hình' : 'QR chưa có ảnh'}</strong>
                      <span>{paymentIntent.qr_payload || paymentIntent.qr_image_url || paymentIntent.payment_note || 'Có thể tiếp tục xác nhận bằng OTP.'}</span>
                    </div>
                  )}
                  {paymentReceipt ? (
                    <div>
                      <span>Biên lai</span>
                      <strong>{paymentReceipt.receipt_no || paymentReceipt.receipt_id || 'Đã sẵn sàng'}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                className="pb-btn-primary pb-btn-full pb-btn-pay"
                type="button"
                disabled={!canStartDemoPayment || paymentBusy || paymentCompleted}
                onClick={paymentIntent ? handleConfirmDemoPayment : handleCreateDemoPayment}
              >
                <PatientIcon name={paymentIntent ? 'task_alt' : isMomoSandbox ? 'account_balance_wallet' : 'qr_code_scanner'} aria-hidden="true" className="pb-btn-icon" />
                {!canStartDemoPayment
                  ? 'Chưa có hóa đơn để thanh toán'
                  : paymentBusy
                  ? 'Đang xử lý...'
                  : paymentCompleted
                    ? 'Đã thanh toán MoMo'
                  : paymentIntent
                    ? isMomoSandbox ? 'Xác nhận thanh toán MoMo' : 'Giả lập đã thanh toán'
                    : isMomoSandbox ? 'Tạo giao dịch MoMo' : 'Tạo thanh toán thử nghiệm'}
              </button>
              {(paymentCompleted || paymentReceipt) && onOpenHistory ? (
                <button className="pb-btn-outline pb-btn-full pb-receipt-link" type="button" onClick={() => onOpenHistory()}>
                  <PatientIcon name="receipt_long" aria-hidden="true" className="pb-btn-icon" /> Xem hóa đơn / biên lai
                </button>
              ) : null}
              <p className="pb-security-text">
                Chế độ demo dùng để kiểm thử báo cáo, không trừ tiền thật. Phương thức đã chọn: {currentMethod?.label || 'Thanh toán demo'}.
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
                <button className="pb-btn-outline" type="button" onClick={() => onOpenSupportChat?.()}>
                  Liên hệ hỗ trợ
                </button>
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
