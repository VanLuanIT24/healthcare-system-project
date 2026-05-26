import { useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const caseStatusLabels = {
  created: 'Đã gửi',
  acknowledged: 'Đã tiếp nhận',
  triaged: 'Đã phân loại',
  dispatched: 'Đã điều phối',
  resolved: 'Đã xử lý',
  cancelled: 'Đã hủy',
  false_alarm: 'Báo động nhầm',
}

function getPatient(patientProfile) {
  return patientProfile?.patient || patientProfile?.profile || patientProfile || {}
}

function formatDate(value) {
  if (!value) return 'Chưa có thời gian'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function firstText(items = [], fieldNames = []) {
  const item = Array.isArray(items) ? items[0] : null
  if (!item) return 'Chưa ghi nhận'
  for (const field of fieldNames) {
    if (item[field]) return item[field]
  }
  return 'Chưa ghi nhận'
}

export default function PatientEmergencyIdentityPage({
  cases = [],
  feedback = null,
  healthSummary = null,
  loading = false,
  onCancelCase,
  onCreateSos,
  patientProfile = null,
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const patient = getPatient(patientProfile)
  const openCases = useMemo(
    () => cases.filter((item) => !['resolved', 'cancelled', 'false_alarm'].includes(String(item.status || '').toLowerCase())),
    [cases],
  )

  const allergies = healthSummary?.allergies || patientProfile?.allergies || []
  const problems = healthSummary?.problem_list || healthSummary?.problems || patientProfile?.problem_list || []
  const recentVitals = healthSummary?.recent_vitals || {}
  const emergencyPhone = patient.emergency_contact_phone || patient.phone || ''

  const sendSos = async (includeLocation = false) => {
    setSending(true)
    let location = null
    if (includeLocation && navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
        })
        location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
      } catch (error) {
        location = null
      }
    }

    const saved = await onCreateSos?.({
      reason: reason.trim() || 'Bệnh nhân yêu cầu hỗ trợ khẩn cấp',
      contact_phone: emergencyPhone,
      location,
    })
    setSending(false)
    if (saved !== false) {
      setShowConfirm(false)
      setReason('')
    }
  }

  return (
    <div className="patient-emergency-page">
      <section className="patient-emergency-head">
        <div>
          <span className="patient-emergency-badge">Cấp cứu</span>
          <h1>Hỗ trợ khẩn cấp</h1>
          <p>Mở xác nhận trước khi gửi SOS để hạn chế bấm nhầm.</p>
        </div>

        <div className="patient-emergency-head-actions">
          <button className="patient-emergency-print" type="button" onClick={() => window.print()}>
            <PatientIcon name="print" aria-hidden="true" />
            <span>In thẻ y tế</span>
          </button>
        </div>
      </section>

      {feedback?.context === 'emergency' ? (
        <div className={`patient-dashboard-state ${feedback.type === 'error' ? 'patient-dashboard-state-error' : ''}`}>
          {feedback.message || feedback.text}
        </div>
      ) : null}

      <div className="patient-emergency-grid">
        <section className="patient-panel patient-emergency-sos-card">
          <div className="patient-emergency-sos-copy">
            <div className="patient-emergency-sos-head">
              <div>
                <PatientIcon name="emergency_share" aria-hidden="true" />
                <h2>Bạn cần hỗ trợ khẩn cấp?</h2>
              </div>
              <span>{openCases.length ? `${openCases.length} ca đang mở` : 'Chưa có ca đang mở'}</span>
            </div>
            <p>Chọn một hành động trong modal xác nhận. SOS sẽ tạo ca cấp cứu gắn với bệnh nhân hiện tại.</p>
          </div>

          <div className="patient-emergency-sos-layout">
            <button className="patient-emergency-sos-trigger" type="button" onClick={() => setShowConfirm(true)}>
              <PatientIcon name="emergency" aria-hidden="true" />
              <strong>SOS khẩn cấp</strong>
            </button>

            <div className="patient-emergency-sos-meta">
              <article>
                <span className="patient-emergency-meta-icon is-location">
                  <PatientIcon name="person" aria-hidden="true" />
                </span>
                <div>
                  <small>Bệnh nhân</small>
                  <strong>{patient.full_name || 'Chưa cập nhật'}</strong>
                </div>
              </article>

              <article>
                <span className="patient-emergency-meta-icon is-dispatch">
                  <PatientIcon name="phone_forwarded" aria-hidden="true" />
                </span>
                <div>
                  <small>Điện thoại liên hệ</small>
                  <strong>{emergencyPhone || 'Chưa cập nhật'}</strong>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="patient-emergency-profile-grid">
          <article className="patient-panel patient-emergency-profile-card">
            <small>Nhóm máu</small>
            <div className="patient-emergency-blood">
              <strong>{patient.blood_type || healthSummary?.blood_type || '--'}</strong>
              <span>{recentVitals?.recorded_at ? `Sinh hiệu gần nhất ${formatDate(recentVitals.recorded_at)}` : 'Chưa có sinh hiệu gần nhất'}</span>
            </div>
          </article>

          <article className="patient-panel patient-emergency-profile-card is-alert">
            <PatientIcon name="warning" aria-hidden="true" />
            <small>Dị ứng</small>
            <strong className="patient-emergency-allergy">{firstText(allergies, ['allergen', 'allergen_name', 'name'])}</strong>
            <span>{firstText(allergies, ['severity', 'reaction'])}</span>
          </article>

          <article className="patient-panel patient-emergency-profile-card">
            <small>Bệnh lý nền</small>
            <div className="patient-emergency-condition-list">
              {(Array.isArray(problems) && problems.length ? problems.slice(0, 3) : [{ problem_name: 'Chưa ghi nhận' }]).map((condition, index) => (
                <div key={condition._id || condition.problem_name || index}>
                  <span className={index === 0 ? 'is-primary' : ''} />
                  <strong>{condition.problem_name || condition.name || condition.diagnosis_name || 'Chưa ghi nhận'}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="patient-panel patient-emergency-contacts-card">
          <h2>Ca cấp cứu của tôi</h2>
          <div className="patient-emergency-contact-list">
            {loading ? <div className="patient-emergency-contact-row">Đang tải ca cấp cứu...</div> : null}
            {!loading && !cases.length ? <div className="patient-emergency-contact-row">Chưa có ca cấp cứu.</div> : null}
            {cases.map((item) => (
              <article key={item._id || item.case_code} className="patient-emergency-contact-row">
                <div className="patient-emergency-contact-copy">
                  <span className="patient-emergency-contact-avatar red">
                    <PatientIcon name="emergency" aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{item.case_code}</strong>
                    <small>{caseStatusLabels[item.status] || item.status} | {formatDate(item.created_at)}</small>
                  </div>
                </div>

                {!['resolved', 'cancelled', 'false_alarm'].includes(String(item.status || '').toLowerCase()) ? (
                  <button type="button" aria-label="Hủy SOS" onClick={() => onCancelCase?.(item._id, { reason: 'Bệnh nhân hủy từ portal.' })}>
                    <PatientIcon name="close" aria-hidden="true" />
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="patient-panel patient-emergency-map-card">
          <div className="patient-emergency-map-head">
            <div>
              <h2>Hành động nhanh</h2>
              <p>Gọi cấp cứu, gửi SOS cho phòng khám, chia sẻ vị trí hoặc liên hệ người thân khẩn cấp.</p>
            </div>
          </div>

          <div className="patient-emergency-map-stage">
            <div className="patient-emergency-map-surface" aria-hidden="true" />
            <div className="patient-emergency-map-highlight">
              <span>
                <PatientIcon name="local_hospital" aria-hidden="true" />
              </span>
              <div>
                <strong>Trung tâm điều phối cấp cứu</strong>
                <small>Luôn xác nhận trước khi tạo ca SOS</small>
              </div>
            </div>
          </div>
        </section>
      </div>

      {showConfirm ? (
        <div className="patient-emergency-modal" role="dialog" aria-modal="true" aria-labelledby="patient-emergency-modal-title">
          <div className="patient-emergency-modal-card">
            <button type="button" aria-label="Đóng" onClick={() => setShowConfirm(false)}>
              <PatientIcon name="close" aria-hidden="true" />
            </button>
            <h2 id="patient-emergency-modal-title">Bạn cần hỗ trợ khẩn cấp?</h2>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Lý do: khó thở, đau ngực, té ngã..."
              rows="3"
            />
            <div>
              <button type="button" onClick={() => { window.location.href = 'tel:115' }}>
                <PatientIcon name="call" aria-hidden="true" />
                Gọi cấp cứu
              </button>
              <button type="button" disabled={sending} onClick={() => sendSos(false)}>
                <PatientIcon name="emergency_share" aria-hidden="true" />
                Gửi SOS cho phòng khám
              </button>
              <button type="button" disabled={sending} onClick={() => sendSos(true)}>
                <PatientIcon name="location_on" aria-hidden="true" />
                Gửi vị trí hiện tại
              </button>
              <button type="button" disabled={!emergencyPhone} onClick={() => { if (emergencyPhone) window.location.href = `tel:${emergencyPhone}` }}>
                <PatientIcon name="contacts" aria-hidden="true" />
                Gọi người thân khẩn cấp
              </button>
              <button type="button">
                <PatientIcon name="health_and_safety" aria-hidden="true" />
                Xem hướng dẫn sơ cứu
              </button>
              <button type="button" onClick={() => setShowConfirm(false)}>Hủy</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
