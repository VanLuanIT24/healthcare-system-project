import { sectionMeta } from '../data/patientPageData'

export default function PatientPlaceholderPage({ activeSection, onBackToDashboard }) {
  const meta = sectionMeta[activeSection] || {
    eyebrow: 'Chưa có giao diện',
    title: 'Chưa có giao diện',
    body: 'Mục này chưa có màn hình hoặc API phù hợp nên chưa được liên kết sang giao diện khác.',
  }

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
