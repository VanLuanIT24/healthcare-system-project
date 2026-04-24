import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { billingInvoices, billingOverview, paymentMethods } from '../data/patientPageData'

export default function PatientBillingPage() {
  const [selectedMethod, setSelectedMethod] = useState(paymentMethods[0]?.id || '')

  return (
    <div className="patient-billing-page">
      <section className="patient-billing-summary-grid">
        <article className="patient-panel patient-billing-balance-card">
          <div className="patient-billing-balance-copy">
            <p className="patient-section-label">{billingOverview.outstandingLabel}</p>
            <h1>
              {billingOverview.outstandingAmount}
              <span>{billingOverview.outstandingCurrency}</span>
            </h1>
          </div>

          <div className="patient-billing-balance-actions">
            <button className="patient-hero-button" type="button">
              Thanh toán ngay
            </button>

            <button className="patient-inline-link patient-inline-link-icon" type="button">
              <PatientIcon name="receipt_long" aria-hidden="true" />
              <span>Xem chi tiết</span>
            </button>
          </div>

          <div className="patient-billing-balance-glow" aria-hidden="true" />
        </article>

        <article className="patient-panel patient-billing-settled-card">
          <div className="patient-billing-settled-mark">
            <PatientIcon name="verified" aria-hidden="true" />
          </div>

          <div>
            <p className="patient-section-label">{billingOverview.settledLabel}</p>
            <h2>{billingOverview.settledAmount}</h2>
          </div>

          <p>{billingOverview.settledPeriod}</p>
        </article>
      </section>

      <div className="patient-billing-layout">
        <section className="patient-billing-invoice-column">
          <div className="patient-billing-section-head">
            <h2>Hóa đơn khám bệnh</h2>

            <button className="patient-billing-filter-button" type="button" aria-label="Lọc hóa đơn">
              <PatientIcon name="filter_list" aria-hidden="true" />
            </button>
          </div>

          <div className="patient-panel patient-billing-table-shell">
            <div className="patient-billing-table-wrap">
              <table className="patient-billing-table">
                <thead>
                  <tr>
                    <th>Dịch vụ / Ngày</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                    <th>Tải về</th>
                  </tr>
                </thead>

                <tbody>
                  {billingInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td data-label="Dịch vụ / Ngày">
                        <div className="patient-billing-service">
                          <div className={`patient-billing-service-icon ${invoice.iconTone}`}>
                            <PatientIcon name={invoice.icon} aria-hidden="true" />
                          </div>

                          <div>
                            <strong>{invoice.service}</strong>
                            <p>{invoice.meta}</p>
                          </div>
                        </div>
                      </td>

                      <td className="patient-billing-amount" data-label="Số tiền">
                        {invoice.amount}
                      </td>

                      <td className="patient-billing-status-cell" data-label="Trạng thái">
                        <span className={`patient-status-pill ${invoice.tone}`}>{invoice.status}</span>
                      </td>

                      <td className="patient-billing-download-cell" data-label="Tải về">
                        <button type="button" aria-label={`Tải hóa đơn ${invoice.service}`}>
                          <PatientIcon name="picture_as_pdf" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="patient-billing-side-column">
          <h2>Phương thức thanh toán</h2>

          <section className="patient-panel patient-billing-methods-card">
            <p className="patient-billing-intro">
              Chọn một trong các cổng thanh toán an toàn để hoàn tất hóa đơn của bạn.
            </p>

            <div className="patient-billing-method-list">
              {paymentMethods.map((method) => {
                const active = method.id === selectedMethod

                return (
                  <label
                    key={method.id}
                    className={`patient-billing-method${active ? ' is-selected' : ''}`}
                  >
                    <input
                      checked={active}
                      name="paymentMethod"
                      type="radio"
                      onChange={() => setSelectedMethod(method.id)}
                    />

                    <div className="patient-billing-method-copy">
                      <span>{method.label}</span>

                      <div className="patient-billing-method-badges">
                        <span className={`patient-billing-method-badge ${method.badgeTone}`}>
                          {method.badge}
                        </span>

                        {method.badgeSecondary ? (
                          <span className={`patient-billing-method-badge ${method.badgeTone}`}>
                            {method.badgeSecondary}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="patient-billing-total-box">
              <div className="patient-billing-total-row">
                <span>Tổng thanh toán</span>
                <strong>
                  {billingOverview.outstandingAmount} {billingOverview.outstandingCurrency}
                </strong>
              </div>

              <button className="patient-hero-button patient-billing-pay-button" type="button">
                Thanh toán ngay
              </button>

              <p className="patient-billing-security-note">
                <PatientIcon name="lock" aria-hidden="true" />
                <span>Thanh toán được bảo mật 256-bit SSL bởi hệ thống tài chính Clinical Curator.</span>
              </p>
            </div>
          </section>

          <section className="patient-panel patient-billing-help-card">
            <div className="patient-billing-help-mark">
              <PatientIcon name="help" aria-hidden="true" />
            </div>

            <div>
              <h3>{billingOverview.supportTitle}</h3>
              <p>{billingOverview.supportBody}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
