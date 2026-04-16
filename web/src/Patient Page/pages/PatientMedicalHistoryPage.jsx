import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { labResultCards, medicalVisits, prescriptionItems } from '../data/patientPageData'

const historyTabs = [
  { key: 'prescriptions', label: 'Đơn thuốc' },
  { key: 'results', label: 'Kết quả xét nghiệm' },
]

export default function PatientMedicalHistoryPage() {
  const defaultVisit = medicalVisits.find((visit) => visit.latest)?.id || medicalVisits[0]?.id
  const [activeVisitId, setActiveVisitId] = useState(defaultVisit)
  const [activeTab, setActiveTab] = useState('prescriptions')

  const activeVisit = medicalVisits.find((visit) => visit.id === activeVisitId) || medicalVisits[0]

  return (
    <div className="patient-history-page">
      <section className="patient-history-hero">
        <div>
          <p className="patient-eyebrow">Lưu trữ lâm sàng</p>
          <h1>Lịch sử khám</h1>
          <p className="patient-history-copy">
            Xem lại diễn biến sức khỏe, đơn thuốc và kết quả khám gần đây trong
            cùng một không gian dành cho bệnh nhân.
          </p>
        </div>

        <div className="patient-history-hero-actions">
          <button className="patient-soft-action" type="button">
            <PatientIcon name="filter_list" aria-hidden="true" />
            <span>Lọc</span>
          </button>

          <button className="patient-hero-button" type="button">
            <PatientIcon name="download" aria-hidden="true" />
            <span>Tải PDF</span>
          </button>
        </div>
      </section>

      <section className="patient-history-layout">
        <aside className="patient-history-sidebar">
          <h2>Lần khám trước</h2>

          <div className="patient-visit-list">
            {medicalVisits.map((visit) => {
              const isActive = visit.id === activeVisit.id

              return (
                <button
                  key={visit.id}
                  className={`patient-visit-card${isActive ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setActiveVisitId(visit.id)}
                >
                  <div className="patient-visit-card-head">
                    {visit.latest ? (
                      <span className="patient-visit-badge">Mới nhất</span>
                    ) : (
                      <span className="patient-visit-dot" />
                    )}
                    <span className="patient-visit-date">{visit.date}</span>
                  </div>

                  <h3>{visit.doctor}</h3>
                  <p>{visit.specialty}</p>

                  <div className="patient-visit-diagnosis">
                    <span>Chẩn đoán</span>
                    <strong>{visit.diagnosis}</strong>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="patient-history-main">
          <section className="patient-panel patient-history-detail">
            <div className="patient-history-detail-head">
              <div>
                <div className="patient-history-detail-label">
                  <PatientIcon name="medical_services" aria-hidden="true" />
                  <span>Chi tiết lần khám</span>
                </div>
                <h2>{activeVisit.summaryTitle}</h2>
              </div>

              <div className="patient-history-record-meta">
                <span>ID: {activeVisit.recordId}</span>
                <strong>{activeVisit.date}</strong>
              </div>
            </div>

            <div className="patient-history-summary-grid">
              <article className="patient-history-summary-block">
                <span>Triệu chứng</span>
                <p className="patient-history-quote">"{activeVisit.symptoms}"</p>
              </article>

              <article className="patient-history-summary-block">
                <span>Ghi chú lâm sàng</span>
                <ul className="patient-history-note-list">
                  {activeVisit.notes.map((note) => (
                    <li key={note}>
                      <span />
                      <p>{note}</p>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="patient-history-summary-block patient-history-conclusion">
                <span>Kết luận</span>
                <div>
                  <p>{activeVisit.conclusion}</p>
                </div>
              </article>
            </div>
          </section>

          <section className="patient-panel patient-history-data-panel">
            <div className="patient-history-tabbar" role="tablist" aria-label="Các tab chi tiết y tế">
              {historyTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`patient-history-tab${activeTab === tab.key ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'prescriptions' ? (
              <div className="patient-history-table-wrap">
                <table className="patient-history-table">
                  <thead>
                    <tr>
                      <th>Tên thuốc</th>
                      <th>Liều dùng</th>
                      <th>Hướng dẫn sử dụng</th>
                      <th>Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptionItems.map((item) => (
                      <tr key={item.id}>
                        <td className="patient-history-table-primary" data-label="Tên thuốc">
                          {item.medication}
                        </td>
                        <td data-label="Liều dùng">{item.dosage}</td>
                        <td data-label="Hướng dẫn sử dụng">{item.usage}</td>
                        <td className="patient-history-table-qty" data-label="Số lượng">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="patient-history-result-list">
                {labResultCards.map((result) => (
                  <article key={result.id} className="patient-history-result-item">
                    <div className={`patient-history-result-mark ${result.tone}`}>
                      <PatientIcon name={result.icon} aria-hidden="true" />
                    </div>

                    <div className="patient-history-result-copy">
                      <div className="patient-history-result-head">
                        <div>
                          <h3>{result.title}</h3>
                          <p>{result.subtitle}</p>
                        </div>
                        <span className={`patient-status-pill ${result.badgeTone}`}>{result.badge}</span>
                      </div>

                      <div className="patient-history-result-meta">
                        {result.details ? (
                          result.details.map((detail) => (
                            <div key={detail.label}>
                              <span>{detail.label}</span>
                              <strong>{detail.value}</strong>
                            </div>
                          ))
                        ) : (
                          <div>
                            <span>Ghi chú hình ảnh</span>
                            <strong>Tệp đường tiêu hóa trên đã sẵn sàng để bác sĩ xem lại.</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="patient-history-labs">
            {labResultCards.map((card) => (
              <article key={card.id} className="patient-panel patient-lab-card">
                <div className="patient-lab-card-head">
                  <div className="patient-lab-card-title">
                    <div className={`patient-lab-card-icon ${card.tone}`}>
                      <PatientIcon name={card.icon} aria-hidden="true" />
                    </div>

                    <div>
                      <h3>{card.title}</h3>
                      <p>{card.subtitle}</p>
                    </div>
                  </div>

                  <span className={`patient-status-pill ${card.badgeTone}`}>{card.badge}</span>
                </div>

                {card.preview ? (
                  <div className="patient-lab-preview" aria-hidden="true">
                    <div className="patient-lab-preview-scan" />
                    <PatientIcon name="zoom_in" className="patient-lab-preview-icon" />
                  </div>
                ) : null}

                <div className="patient-lab-details">
                  {card.details ? (
                    card.details.map((detail) => (
                      <div key={detail.label} className="patient-lab-detail-row">
                        <span>{detail.label}</span>
                        <strong>{detail.value}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="patient-lab-preview-copy">
                      Bộ dữ liệu chẩn đoán hình ảnh đã sẵn sàng để xem và tải xuống ở định dạng DICOM.
                    </p>
                  )}
                </div>

                <button className="patient-outline-action" type="button">
                  <PatientIcon name={card.actionIcon} aria-hidden="true" />
                  <span>{card.action}</span>
                </button>
              </article>
            ))}
          </section>
        </div>
      </section>
    </div>
  )
}
