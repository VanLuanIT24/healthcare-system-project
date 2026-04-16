import PatientIcon from '../components/PatientIcon'
import {
  emergencyContacts,
  emergencyIdentity,
  emergencyProfile,
} from '../data/patientPageData'

export default function PatientEmergencyIdentityPage() {
  return (
    <div className="patient-emergency-page">
      <section className="patient-emergency-head">
        <div>
          <span className="patient-emergency-badge">{emergencyIdentity.badge}</span>
          <h1>{emergencyIdentity.title}</h1>
          <p>{emergencyIdentity.body}</p>
        </div>

        <div className="patient-emergency-head-actions">
          <button className="patient-emergency-print" type="button">
            <PatientIcon name="print" aria-hidden="true" />
            <span>In thẻ y tế</span>
          </button>
        </div>
      </section>

      <div className="patient-emergency-grid">
        <section className="patient-panel patient-emergency-sos-card">
          <div className="patient-emergency-sos-copy">
            <div className="patient-emergency-sos-head">
              <div>
                <PatientIcon name="emergency_share" aria-hidden="true" />
                <h2>{emergencyIdentity.sosTitle}</h2>
              </div>
              <span>Tự động định vị: Đang bật</span>
            </div>
            <p>{emergencyIdentity.sosBody}</p>
          </div>

          <div className="patient-emergency-sos-layout">
            <button className="patient-emergency-sos-trigger" type="button">
              <PatientIcon name="emergency" aria-hidden="true" />
              <strong>SOS khẩn cấp</strong>
            </button>

            <div className="patient-emergency-sos-meta">
              <article>
                <span className="patient-emergency-meta-icon is-location">
                  <PatientIcon name="location_on" aria-hidden="true" />
                </span>
                <div>
                  <small>{emergencyIdentity.locationLabel}</small>
                  <strong>{emergencyIdentity.locationValue}</strong>
                </div>
              </article>

              <article>
                <span className="patient-emergency-meta-icon is-dispatch">
                  <PatientIcon name="phone_forwarded" aria-hidden="true" />
                </span>
                <div>
                  <small>{emergencyIdentity.dispatchLabel}</small>
                  <strong>{emergencyIdentity.dispatchValue}</strong>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="patient-emergency-qr-card">
          <h2>{emergencyIdentity.responderTitle}</h2>
          <p>{emergencyIdentity.responderBody}</p>

          <div className="patient-emergency-qr-frame" aria-hidden="true">
            <div className="patient-emergency-qr-code">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="patient-emergency-qr-verified">
              <PatientIcon name="verified_user" aria-hidden="true" />
            </div>
          </div>

          <div className="patient-emergency-verified-pill">
            <span />
            <strong>{emergencyIdentity.verifiedLabel}</strong>
          </div>
        </section>

        <section className="patient-emergency-profile-grid">
          <article className="patient-panel patient-emergency-profile-card">
            <small>Nhóm máu</small>
            <div className="patient-emergency-blood">
              <strong>{emergencyProfile.bloodType}</strong>
              <span>{emergencyProfile.bloodTypeNote}</span>
            </div>
          </article>

          <article className="patient-panel patient-emergency-profile-card is-alert">
            <PatientIcon name="warning" aria-hidden="true" />
            <small>Dị ứng</small>
            <strong className="patient-emergency-allergy">{emergencyProfile.allergyName}</strong>
            <span>{emergencyProfile.allergySeverity}</span>
          </article>

          <article className="patient-panel patient-emergency-profile-card">
            <small>Bệnh lý nền</small>
            <div className="patient-emergency-condition-list">
              {emergencyProfile.conditions.map((condition, index) => (
                <div key={condition}>
                  <span className={index === 0 ? 'is-primary' : ''} />
                  <strong>{condition}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="patient-panel patient-emergency-contacts-card">
          <h2>Liên hệ khẩn cấp</h2>

          <div className="patient-emergency-contact-list">
            {emergencyContacts.map((contact) => (
              <article key={contact.id} className="patient-emergency-contact-row">
                <div className="patient-emergency-contact-copy">
                  <span className={`patient-emergency-contact-avatar ${contact.tone}`}>
                    {contact.initials}
                  </span>
                  <div>
                    <strong>{contact.name}</strong>
                    <small>{contact.role}</small>
                  </div>
                </div>

                <button type="button" aria-label={`Gọi ${contact.name}`}>
                  <PatientIcon name="call" aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>

          <button className="patient-emergency-add-contact" type="button">
            + Thêm liên hệ mới
          </button>
        </section>

        <section className="patient-panel patient-emergency-map-card">
          <div className="patient-emergency-map-head">
            <div>
              <h2>Dịch vụ cấp cứu lân cận</h2>
              <p>
                Tìm thấy {emergencyProfile.nearbyCount} cơ sở y tế trong bán kính{' '}
                {emergencyProfile.nearbyRadius} dặm tính từ vị trí hiện tại của bạn.
              </p>
            </div>

            <button type="button">Mở bản đồ</button>
          </div>

          <div className="patient-emergency-map-stage">
            <div className="patient-emergency-map-surface" aria-hidden="true" />

            <div className="patient-emergency-map-highlight">
              <span>
                <PatientIcon name="local_hospital" aria-hidden="true" />
              </span>
              <div>
                <strong>{emergencyProfile.mapFacility}</strong>
                <small>{emergencyProfile.mapFacilityMeta}</small>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="patient-emergency-footer">
        <div>
          <p>© 2024 Ethos Health Clinical Curator</p>
          <button type="button">Chính sách bảo mật</button>
          <button type="button">Quy trình khẩn cấp</button>
        </div>

        <span>Trạng thái hệ thống: Ổn định</span>
      </footer>
    </div>
  )
}
