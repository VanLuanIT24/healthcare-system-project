import { sectionMeta } from '../data/patientPageData'

export default function PatientPlaceholderPage({ activeSection, onBackToDashboard }) {
  const meta = sectionMeta[activeSection]

  return (
    <section className="patient-placeholder patient-panel">
      <div className="patient-placeholder-badge">{meta.eyebrow}</div>
      <h1>{meta.title}</h1>
      <p>{meta.body}</p>
      <div className="patient-placeholder-actions">
        <button className="patient-hero-button" type="button" onClick={onBackToDashboard}>
          Quay lại trang tổng quan
        </button>
      </div>
    </section>
  )
}
