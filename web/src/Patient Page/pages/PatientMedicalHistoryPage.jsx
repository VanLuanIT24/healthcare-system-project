import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { labResultCards } from '../data/patientPageData'

const historyTabs = [
  { key: 'prescriptions', label: 'Đơn thuốc' },
  { key: 'results', label: 'Kết quả xét nghiệm' },
]

function formatVisitDate(value) {
  if (!value) {
    return 'Chưa có ngày'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có ngày'
  }

  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date)
}

function getEncounterStatusLabel(status) {
  const map = {
    planned: 'Đã lên kế hoạch',
    arrived: 'Đã đến',
    in_progress: 'Đang khám',
    on_hold: 'Tạm dừng',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
  }

  return map[status] || status || 'Chưa xác định'
}

function getPrescriptionStatusLabel(status) {
  const map = {
    draft: 'Nháp',
    active: 'Đang hiệu lực',
    verified: 'Đã duyệt',
    partially_dispensed: 'Cấp phần',
    fully_dispensed: 'Đã cấp đủ',
    cancelled: 'Đã hủy',
    completed: 'Hoàn tất',
  }

  return map[status] || status || 'Chưa cập nhật'
}

function getRouteLabel(route) {
  const map = {
    oral: 'Uống',
    iv: 'Tiêm tĩnh mạch',
    im: 'Tiêm bắp',
    sc: 'Tiêm dưới da',
    topical: 'Bôi ngoài da',
    inhalation: 'Hít',
  }

  return map[String(route || '').toLowerCase()] || route || ''
}

function mapApiEncounter(encounter, index) {
  const id = encounter.encounter_id || encounter._id || `${encounter.start_time}-${index}`
  const status = getEncounterStatusLabel(encounter.status)

  return {
    id,
    latest: index === 0,
    date: formatVisitDate(encounter.start_time),
    doctor:
      encounter.doctor_name ||
      `Bác sĩ ${String(encounter.attending_doctor_id || '').slice(-6)}`,
    specialty:
      encounter.department_name ||
      (encounter.encounter_type === 'emergency' ? 'Cấp cứu' : 'Khám ngoại trú'),
    diagnosis: encounter.chief_reason || status,
    summaryTitle: encounter.encounter_code
      ? `Lượt khám ${encounter.encounter_code}`
      : 'Chi tiết lượt khám',
    recordId: encounter.encounter_code || id,
    symptoms: encounter.chief_reason || 'Chưa cập nhật triệu chứng.',
    notes: [
      `Loại khám: ${encounter.encounter_type || 'outpatient'}`,
      `Trạng thái: ${status}`,
      encounter.end_time
        ? `Kết thúc: ${formatVisitDate(encounter.end_time)}`
        : 'Chưa ghi nhận thời gian kết thúc.',
    ],
    conclusion:
      encounter.status === 'completed'
        ? 'Lượt khám đã hoàn tất. Vui lòng xem thêm kết quả và đơn thuốc khi backend cung cấp dữ liệu chi tiết.'
        : 'Lượt khám đang được đồng bộ từ backend. Kết luận chi tiết sẽ hiển thị khi có dữ liệu lâm sàng.',
  }
}

function mapPrescriptionRows(prescriptions = []) {
  return prescriptions.flatMap((prescription) => {
    const header = [
      prescription.prescription_no ? `Đơn ${prescription.prescription_no}` : '',
      prescription.prescribed_at ? formatVisitDate(prescription.prescribed_at) : '',
      getPrescriptionStatusLabel(prescription.status),
    ]
      .filter(Boolean)
      .join(' • ')

    if (!prescription.items?.length) {
      return [
        {
          id: prescription.prescription_id,
          medication: header || 'Đơn thuốc',
          dosage: 'Chưa có chi tiết',
          usage:
            prescription.note ||
            'Backend chưa trả ra danh sách thuốc trong đơn này.',
          quantity: '-',
        },
      ]
    }

    return prescription.items.map((item) => ({
      id:
        item.prescription_item_id ||
        `${prescription.prescription_id}-${item.medication_name}`,
      medication: item.medication_name || 'Thuốc chưa định danh',
      dosage:
        [item.dose, item.frequency].filter(Boolean).join(' • ') ||
        'Theo chỉ định',
      usage: [
        item.instructions,
        item.route ? `Đường dùng: ${getRouteLabel(item.route)}` : '',
        item.duration_days ? `Số ngày: ${item.duration_days}` : '',
        header,
      ]
        .filter(Boolean)
        .join(' • '),
      quantity: item.quantity ?? '-',
    }))
  })
}

export default function PatientMedicalHistoryPage({
  encounters = [],
  loading = false,
  prescriptions = [],
}) {
  const visits = useMemo(() => encounters.map(mapApiEncounter), [encounters])
  const prescriptionRows = useMemo(
    () => mapPrescriptionRows(prescriptions),
    [prescriptions],
  )
  const defaultVisit = visits.find((visit) => visit.latest)?.id || visits[0]?.id || null
  const [activeVisitId, setActiveVisitId] = useState(defaultVisit)
  const [activeTab, setActiveTab] = useState('prescriptions')

  useEffect(() => {
    if (!visits.length) {
      setActiveVisitId(null)
      return
    }

    if (!visits.some((visit) => visit.id === activeVisitId)) {
      setActiveVisitId(defaultVisit)
    }
  }, [activeVisitId, defaultVisit, visits])

  const activeVisit = visits.find((visit) => visit.id === activeVisitId) || visits[0] || null

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
            {loading ? (
              <div className="patient-empty-state">Đang tải lịch sử khám...</div>
            ) : null}

            {!loading && visits.length === 0 ? (
              <div className="patient-empty-state">
                Chưa có lần khám nào được đồng bộ từ backend.
              </div>
            ) : null}

            {visits.map((visit) => {
              const isActive = visit.id === activeVisit?.id

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
            {activeVisit ? (
              <>
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
              </>
            ) : (
              <div className="patient-empty-state">
                Chưa có chi tiết lần khám để hiển thị.
              </div>
            )}
          </section>

          <section className="patient-panel patient-history-data-panel">
            <div
              className="patient-history-tabbar"
              role="tablist"
              aria-label="Các tab chi tiết y tế"
            >
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
                {prescriptionRows.length === 0 ? (
                  <div className="patient-empty-state">
                    Chưa có đơn thuốc nào từ backend.
                  </div>
                ) : (
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
                      {prescriptionRows.map((item) => (
                        <tr key={item.id}>
                          <td
                            className="patient-history-table-primary"
                            data-label="Tên thuốc"
                          >
                            {item.medication}
                          </td>
                          <td data-label="Liều dùng">{item.dosage}</td>
                          <td data-label="Hướng dẫn sử dụng">{item.usage}</td>
                          <td
                            className="patient-history-table-qty"
                            data-label="Số lượng"
                          >
                            {item.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
                        <span className={`patient-status-pill ${result.badgeTone}`}>
                          {result.badge}
                        </span>
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
                            <strong>
                              Tệp đường tiêu hóa trên đã sẵn sàng để bác sĩ xem lại.
                            </strong>
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

                  <span className={`patient-status-pill ${card.badgeTone}`}>
                    {card.badge}
                  </span>
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
                      Bộ dữ liệu chẩn đoán hình ảnh đã sẵn sàng để xem và tải xuống ở
                      định dạng DICOM.
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
