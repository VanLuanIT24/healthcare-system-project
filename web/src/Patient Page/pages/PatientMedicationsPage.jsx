import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  medicationAdherence,
  medicationInsights,
  medicationSchedule,
  preferredPharmacy,
} from '../data/patientPageData'

export default function PatientMedicationsPage() {
  const [schedule, setSchedule] = useState(() => medicationSchedule)
  const [activeDoseId, setActiveDoseId] = useState(() => medicationSchedule[0]?.id || null)

  const takenCount = schedule.filter((dose) => dose.taken).length
  const selectedDose = schedule.find((dose) => dose.id === activeDoseId) || schedule[0]
  const selectedMedication =
    medicationInsights[selectedDose?.medicationId] || medicationInsights.amoxicillin

  const toggleDose = (doseId) => {
    setSchedule((current) =>
      current.map((dose) => (dose.id === doseId ? { ...dose, taken: !dose.taken } : dose)),
    )
  }

  return (
    <div className="patient-medications-page">
      <section className="patient-medications-head">
        <div>
          <h1>Theo dõi thuốc</h1>
          <p>Tổng hợp phác đồ điều trị và lịch dùng thuốc của bạn trong ngày 24/10/2023.</p>
        </div>

        <button className="patient-medications-refill" type="button">
          <PatientIcon name="autorenew" aria-hidden="true" />
          <span>Yêu cầu cấp thêm thuốc</span>
        </button>
      </section>

      <div className="patient-medications-layout">
        <section className="patient-medications-main">
          <div className="patient-panel patient-medications-schedule-card">
            <div className="patient-medications-card-head">
              <h2>Lịch dùng trong ngày</h2>
              <div className="patient-medications-count">
                <PatientIcon name="check_circle" aria-hidden="true" />
                <span>
                  {takenCount}/{schedule.length} liều đã dùng hôm nay
                </span>
              </div>
            </div>

            <div className="patient-medications-dose-list">
              {schedule.map((dose) => {
                const isActive = dose.id === activeDoseId

                return (
                  <article
                    key={dose.id}
                    className={`patient-medications-dose${isActive ? ' is-active' : ''}${dose.taken ? ' is-taken' : ''}`}
                  >
                    <button
                      className="patient-medications-dose-body"
                      type="button"
                      onClick={() => setActiveDoseId(dose.id)}
                    >
                      <div className="patient-medications-dose-time">
                        <PatientIcon name={dose.icon} aria-hidden="true" />
                        <strong>{dose.time}</strong>
                      </div>

                      <div className="patient-medications-dose-copy">
                        <h3>
                          {dose.name} <span>{dose.dose}</span>
                        </h3>
                        <p>{dose.note}</p>
                      </div>
                    </button>

                    <button
                      className={`patient-medications-log${dose.taken ? ' is-taken' : ''}`}
                      type="button"
                      onClick={() => {
                        setActiveDoseId(dose.id)
                        toggleDose(dose.id)
                      }}
                    >
                      <span>{dose.taken ? 'Đã dùng' : 'Xác nhận uống'}</span>
                      <span className="patient-medications-log-icon" aria-hidden="true">
                        {dose.taken ? <PatientIcon name="check" /> : null}
                      </span>
                    </button>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="patient-medications-progress-grid">
            <div className="patient-panel patient-medications-progress-card">
              <div className="patient-medications-progress-head">
                <div>
                  <p>{selectedMedication.completionLabel}</p>
                  <h3>{selectedMedication.completionTitle}</h3>
                </div>
                <strong>{selectedMedication.completionPercent}%</strong>
              </div>

              <div className="patient-medications-progress-track">
                <span style={{ width: `${selectedMedication.completionPercent}%` }} />
              </div>

              <small>{selectedMedication.completionNote}</small>
            </div>

            <div className="patient-panel patient-medications-progress-card">
              <div className="patient-medications-progress-head">
                <div>
                  <p>{medicationAdherence.label}</p>
                  <h3>{medicationAdherence.title}</h3>
                </div>
                <strong className="is-secondary">{medicationAdherence.percent}%</strong>
              </div>

              <div className="patient-medications-progress-track is-secondary">
                <span style={{ width: `${medicationAdherence.percent}%` }} />
              </div>

              <small>{medicationAdherence.note}</small>
            </div>
          </div>
        </section>

        <aside className="patient-medications-side">
          <div className="patient-medications-insight-card">
            <div className="patient-medications-insight-hero">
              <div className="patient-medications-insight-mark">
                <PatientIcon name="pill" aria-hidden="true" />
              </div>

              <div>
                <h3>Thông tin thuốc</h3>
                <p>{selectedMedication.prescribedBy}</p>
              </div>
            </div>

            <div className="patient-medications-insight-body">
              <div className="patient-medications-title-block">
                <h2>{selectedMedication.name}</h2>
                <span>{selectedMedication.classLabel}</span>
              </div>

              <div className="patient-medications-info-block">
                <p className="patient-medications-block-label">Liều dùng chính</p>
                <p>{selectedMedication.dosageBody}</p>
              </div>

              <div className="patient-medications-callout">
                <PatientIcon name="info" aria-hidden="true" />
                <div>
                  <strong>{selectedMedication.timingTitle}</strong>
                  <p>{selectedMedication.timingBody}</p>
                </div>
              </div>

              <div className="patient-medications-info-block">
                <p className="patient-medications-block-label">Tác dụng phụ có thể gặp</p>
                <div className="patient-medications-chip-list">
                  {selectedMedication.sideEffects.map((effect) => (
                    <span key={effect}>{effect}</span>
                  ))}
                </div>
              </div>

              <button className="patient-medications-download" type="button">
                Tải hướng dẫn dùng thuốc
              </button>
            </div>
          </div>

          <div className="patient-panel patient-medications-pharmacy-card">
            <p className="patient-medications-block-label">Nhà thuốc ưu tiên</p>

            <div className="patient-medications-map">
              <div className="patient-medications-map-pin">
                <PatientIcon name="location_on" aria-hidden="true" />
              </div>
            </div>

            <h3>{preferredPharmacy.name}</h3>
            <p>{preferredPharmacy.meta}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
