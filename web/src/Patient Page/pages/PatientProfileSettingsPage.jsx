import { useEffect, useRef, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { formatDateTime, summarizeUserAgent } from '../utils/patientHelpers'

function getStatusLabel(status) {
  if (status === 'active') return 'Đang hoạt động'
  if (status === 'locked') return 'Đang khóa'
  if (status === 'inactive') return 'Tạm ngưng'
  return status || 'Chưa xác định'
}

function formatDateOnly(value) {
  return formatDateTime(value, { timeStyle: undefined })
}

function getAge(value) {
  if (!value) return ''

  const birthDate = new Date(value)
  if (Number.isNaN(birthDate.getTime())) return ''

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age > 0 ? ` (${age} tuổi)` : ''
}

function getUpdatedLabel(value) {
  return value ? 'Đã cập nhật' : 'Chưa cập nhật'
}

function getGenderLabel(value) {
  const labels = {
    male: 'Nam',
    female: 'Nữ',
    other: 'Khác',
    unknown: 'Chưa cập nhật',
  }

  return labels[value] || value || 'Chưa cập nhật'
}

function getAppointmentStatusLabel(value) {
  const labels = {
    booked: 'Đã đặt',
    confirmed: 'Đã xác nhận',
    checked_in: 'Đã check-in',
    in_consultation: 'Đang khám',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
    no_show: 'Vắng mặt',
    rescheduled: 'Đổi lịch',
  }

  return labels[value] || value || 'Chưa có dữ liệu'
}

function getIdentifierLabel(type) {
  const labels = {
    mrn: 'Mã hồ sơ',
    national_id: 'CCCD/CMND',
    passport: 'Hộ chiếu',
    insurance_no: 'Bảo hiểm',
    external_system_id: 'Mã hệ thống',
  }

  return labels[type] || type || 'Định danh'
}

function PatientProfileRow({ label, value, verified }) {
  return (
    <div className="patient-profile-info-row">
      <span>{label}</span>
      <strong>{value || 'Chưa cập nhật'}</strong>
      {verified ? <em>Đã xác thực</em> : null}
    </div>
  )
}

function ProfileSection({ title, action = null, onAction, children, className = '' }) {
  return (
    <section className={`patient-profile-section-card${className ? ` ${className}` : ''}`}>
      <div className="patient-profile-section-head">
        <h2>{title}</h2>
        {action ? (
          onAction ? (
            <button type="button" onClick={onAction}>
              {action}
            </button>
          ) : (
            <span>{action}</span>
          )
        ) : null}
      </div>
      {children}
    </section>
  )
}

function SecurityRow({ icon, label, status }) {
  return (
    <div className="patient-profile-security-row">
      <div>
        <span>
          <PatientIcon name={icon} aria-hidden="true" />
        </span>
        <strong>{label}</strong>
      </div>
      <em>{status}</em>
      <PatientIcon name="chevron_right" aria-hidden="true" />
    </div>
  )
}

export default function PatientProfileSettingsPage({
  accountError,
  activeSessionCount,
  avatarText,
  feedback,
  loginHistory,
  onLogoutAllDevices,
  onPasswordFieldChange,
  onPasswordSave,
  onProfileSave,
  onRevokeSession,
  passwordForm,
  passwordSaving,
  patientAppointments = [],
  patientDataLoading,
  patientEncounters = [],
  patientId,
  patientName,
  patientPrescriptions = [],
  patientProfile,
  profileForm,
  profileSaving,
  sessions,
  sessionsLoading,
  user,
}) {
  const [isProfileEditing, setIsProfileEditing] = useState(false)
  const [draftForm, setDraftForm] = useState(() => ({ ...profileForm }))
  const [profileSaveComplete, setProfileSaveComplete] = useState(false)
  const profileEditRef = useRef(null)
  const patient = patientProfile?.patient
  const birthText = patient?.date_of_birth
    ? `${formatDateOnly(patient.date_of_birth)}${getAge(patient.date_of_birth)}`
    : 'Chưa cập nhật'
  const phone = patient?.phone || user?.phone || ''
  const email = patient?.email || user?.email || ''
  const address = patient?.address || ''
  const nationalId = patient?.national_id || ''
  const insuranceNumber = patient?.insurance_number || ''
  const emergencyName = patient?.emergency_contact_name || ''
  const emergencyPhone = patient?.emergency_contact_phone || ''
  const latestAppointment = patientAppointments[0] || null
  const latestEncounter = patientEncounters[0] || null
  const latestPrescription = patientPrescriptions[0] || null
  const identifiers = patientProfile?.identifiers || []
  const account = patientProfile?.account || null
  const profileFields = [
    patientName,
    patientId,
    phone,
    email,
    address,
    patient?.date_of_birth,
    nationalId,
    insuranceNumber,
    emergencyName,
    emergencyPhone,
  ]
  const completion = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100)
  const recentSession = sessions.find((session) => session.is_active) || sessions[0]

  useEffect(() => {
    if (!isProfileEditing) {
      setDraftForm({ ...profileForm })
    }
  }, [isProfileEditing, profileForm])

  const openProfileEditor = () => {
    setDraftForm({ ...profileForm })
    setProfileSaveComplete(false)
    setIsProfileEditing(true)

    window.requestAnimationFrame(() => {
      profileEditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      profileEditRef.current?.querySelector('input')?.focus({ preventScroll: true })
    })
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()

    const saved = await onProfileSave(draftForm)

    if (saved) {
      setProfileSaveComplete(true)
      setIsProfileEditing(false)
    }
  }

  const handleProfileFieldChange = (field) => (event) => {
    setProfileSaveComplete(false)
    setDraftForm((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  const handleCancelProfileEdit = () => {
    setDraftForm({ ...profileForm })
    setProfileSaveComplete(false)
    setIsProfileEditing(false)
  }

  const profileUpdated =
    profileSaveComplete ||
    (feedback?.type === 'success' && feedback?.text?.toLowerCase().includes('hồ sơ'))

  return (
    <div className="patient-profile-dashboard">
      {feedback ? (
        <div className={`patient-feedback${feedback.type === 'error' ? ' is-error' : ''}`}>
          {feedback.text}
        </div>
      ) : null}

      {accountError ? <div className="patient-feedback is-error">{accountError}</div> : null}

      <section className="patient-profile-overview-card">
        <div className="patient-profile-avatar-wrap">
          <div className="patient-profile-avatar-large">
            <span>{avatarText}</span>
          </div>
        </div>

        <div className="patient-profile-overview-copy">
          <div className="patient-profile-name-line">
            <h1>{patientName}</h1>
            <PatientIcon name="verified" aria-hidden="true" />
          </div>

          <div className="patient-profile-identity-line">
            <span>Bệnh nhân ưu tiên</span>
            <p>Mã bệnh nhân: {patientId}</p>
          </div>

          <div className="patient-profile-meta-line">
            <span>
              <PatientIcon name="person" aria-hidden="true" />
              {getGenderLabel(patient?.gender)}
            </span>
            <span>
              <PatientIcon name="calendar_month" aria-hidden="true" />
              {birthText}
            </span>
            <span>
              <PatientIcon name="bloodtype" aria-hidden="true" />
              {insuranceNumber ? 'Có BHYT' : 'Chưa có BHYT'}
            </span>
            <span>
              <PatientIcon name="location_on" aria-hidden="true" />
              {address || 'Chưa cập nhật địa chỉ'}
            </span>
          </div>
        </div>

        <button
          className={`patient-profile-edit-main${profileUpdated ? ' is-saved' : ''}`}
          type="button"
          onClick={openProfileEditor}
          disabled={profileSaving}
        >
          <PatientIcon name="edit_square" aria-hidden="true" />
          {profileSaving
            ? 'Đang lưu...'
            : profileUpdated
              ? 'Đã cập nhật'
              : isProfileEditing
                ? 'Đang chỉnh sửa'
                : 'Chỉnh sửa hồ sơ'}
        </button>
      </section>

      <div className="patient-profile-layout">
        <main className="patient-profile-main">
          <ProfileSection title="Thông tin cá nhân" action="Chỉnh sửa" onAction={openProfileEditor}>
            <div className="patient-profile-info-list">
              <PatientProfileRow label="Số điện thoại" value={phone} verified={Boolean(phone)} />
              <PatientProfileRow label="Email" value={email} verified={Boolean(email)} />
              <PatientProfileRow label="CCCD/CMND" value={nationalId} />
              <PatientProfileRow label="Ngày sinh" value={birthText} />
              <PatientProfileRow label="Giới tính" value={getGenderLabel(patient?.gender)} />
              <PatientProfileRow label="Địa chỉ" value={address} />
              <PatientProfileRow label="Trạng thái hồ sơ" value={getStatusLabel(patient?.status || user?.status)} />
            </div>
          </ProfileSection>

          <ProfileSection title="Bảo hiểm y tế" action="Chỉnh sửa" onAction={openProfileEditor}>
            <div className="patient-profile-info-list">
              <PatientProfileRow label="Loại bảo hiểm" value={insuranceNumber ? 'Bảo hiểm y tế (BHYT)' : ''} />
              <PatientProfileRow label="Số thẻ" value={insuranceNumber} />
              <PatientProfileRow label="Định danh bảo hiểm" value={identifiers.find((item) => item.identifier_type === 'insurance_no')?.identifier_value} />
              <PatientProfileRow label="Nguồn dữ liệu" value="Đồng bộ từ hồ sơ bệnh viện" />
            </div>
            {insuranceNumber ? (
              <div className="patient-profile-valid-line">
                <PatientIcon name="verified_user" aria-hidden="true" />
                <span>Đã có số bảo hiểm trong hồ sơ</span>
              </div>
            ) : null}
          </ProfileSection>

          <ProfileSection title="Liên hệ khẩn cấp" action="Chỉnh sửa" onAction={openProfileEditor}>
            <div className="patient-profile-info-list">
              <PatientProfileRow label="Họ và tên" value={emergencyName} />
              <PatientProfileRow label="Số điện thoại" value={emergencyPhone} />
              <PatientProfileRow label="Địa chỉ" value={address} />
            </div>
          </ProfileSection>

          <ProfileSection title="Lịch khám gần nhất" action="Đồng bộ" className="patient-profile-compact-card">
            {latestAppointment ? (
              <>
                <div className="patient-profile-clinic-card">
                  <div className="patient-profile-clinic-photo">
                    <PatientIcon name="event_available" aria-hidden="true" />
                  </div>
                  <div>
                    <strong>{latestAppointment.department_name || 'Chưa có khoa/phòng'}</strong>
                    <p>{latestAppointment.doctor_name || 'Chưa có bác sĩ'}</p>
                    <span>{formatDateTime(latestAppointment.appointment_time)}</span>
                  </div>
                  <em>{getAppointmentStatusLabel(latestAppointment.status)}</em>
                </div>
                <div className="patient-profile-valid-line">
                  <PatientIcon name="verified_user" aria-hidden="true" />
                  <span>Đồng bộ từ lịch khám bệnh viện</span>
                </div>
              </>
            ) : (
              <div className="patient-profile-api-empty">
                <PatientIcon name="event_busy" aria-hidden="true" />
                <div>
                  <strong>Chưa có lịch khám</strong>
                  <p>{patientDataLoading ? 'Đang tải dữ liệu lịch hẹn...' : 'Chưa có lịch hẹn được đồng bộ.'}</p>
                </div>
              </div>
            )}
          </ProfileSection>

          <ProfileSection title="Tùy chọn liên lạc" action="Chỉnh sửa" onAction={openProfileEditor} className="patient-profile-compact-card">
            <div className="patient-profile-contact-options">
              {[
                ['mail', 'Email tài khoản', account?.email || email || 'Chưa cập nhật'],
                ['phone_iphone', 'Số điện thoại', account?.phone || phone || 'Chưa cập nhật'],
                ['verified_user', 'Trạng thái tài khoản', getStatusLabel(account?.status || user?.status)],
              ].map(([icon, title, body]) => (
                <article key={title}>
                  <PatientIcon name={icon} aria-hidden="true" />
                  <div>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </div>
                  <em>
                    <PatientIcon name="check_circle" aria-hidden="true" />
                  </em>
                </article>
              ))}
            </div>
          </ProfileSection>

          <ProfileSection title="Định danh hồ sơ" action="Đồng bộ" className="patient-profile-family-card">
            {identifiers.length ? (
              <div className="patient-profile-family-list">
                {identifiers.map((identifier) => (
                  <article key={identifier.patient_identifier_id}>
                    <div className="patient-profile-family-avatar">
                      {getIdentifierLabel(identifier.identifier_type).charAt(0)}
                    </div>
                    <div>
                      <strong>{getIdentifierLabel(identifier.identifier_type)}</strong>
                      <span>
                        {identifier.identifier_value} • {identifier.issued_by || 'Chưa có nơi cấp'}
                      </span>
                    </div>
                    <em>{identifier.is_primary ? 'Chính' : 'Phụ'}</em>
                    <PatientIcon name="chevron_right" aria-hidden="true" />
                  </article>
                ))}
              </div>
            ) : (
              <div className="patient-profile-api-empty">
                <PatientIcon name="badge" aria-hidden="true" />
                <div>
                  <strong>Chưa có định danh phụ</strong>
                  <p>Hồ sơ bệnh viện chưa có định danh bổ sung cho bệnh nhân này.</p>
                </div>
              </div>
            )}
          </ProfileSection>

          <section
            className={`patient-profile-edit-panel${isProfileEditing ? ' is-open' : ''}`}
            ref={profileEditRef}
          >
            <div className="patient-profile-section-head">
              <h2>Cập nhật nhanh</h2>
              <span>Cập nhật vào hồ sơ bệnh viện</span>
            </div>

            {isProfileEditing ? (
              <form id="patient-profile-form" onSubmit={handleProfileSubmit}>
              {feedback ? (
                <div className={`patient-profile-edit-feedback${feedback.type === 'error' ? ' is-error' : ''}`}>
                  {feedback.text}
                </div>
              ) : null}
              <div className="patient-profile-form-grid">
                <label>
                  <span>Họ và tên</span>
                  <input type="text" value={draftForm.fullName} onChange={handleProfileFieldChange('fullName')} />
                </label>
                <label>
                  <span>Số điện thoại</span>
                  <input type="tel" value={draftForm.phone} onChange={handleProfileFieldChange('phone')} />
                </label>
                <label>
                  <span>Email</span>
                  <input type="email" value={draftForm.email} onChange={handleProfileFieldChange('email')} />
                </label>
                <label>
                  <span>CCCD/CMND</span>
                  <input type="text" value={draftForm.nationalId} onChange={handleProfileFieldChange('nationalId')} />
                </label>
                <label>
                  <span>Số bảo hiểm</span>
                  <input
                    type="text"
                    value={draftForm.insuranceNumber}
                    onChange={handleProfileFieldChange('insuranceNumber')}
                  />
                </label>
                <label>
                  <span>Giới tính</span>
                  <select value={draftForm.gender} onChange={handleProfileFieldChange('gender')}>
                    <option value="unknown">Chưa cập nhật</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
                <label>
                  <span>Ngày sinh</span>
                  <input
                    type="date"
                    value={draftForm.dateOfBirth}
                    onChange={handleProfileFieldChange('dateOfBirth')}
                  />
                </label>
                <label>
                  <span>Tên liên hệ khẩn cấp</span>
                  <input
                    type="text"
                    value={draftForm.emergencyContactName}
                    onChange={handleProfileFieldChange('emergencyContactName')}
                    placeholder="Chưa cập nhật"
                  />
                </label>
                <label>
                  <span>Liên hệ khẩn cấp</span>
                  <input
                    type="tel"
                    value={draftForm.emergencyContactPhone}
                    onChange={handleProfileFieldChange('emergencyContactPhone')}
                    placeholder="Chưa cập nhật"
                  />
                </label>
                <label className="wide">
                  <span>Địa chỉ</span>
                  <input
                    type="text"
                    value={draftForm.address}
                    onChange={handleProfileFieldChange('address')}
                    placeholder="Nhập địa chỉ liên hệ"
                  />
                </label>
              </div>
              <div className="patient-profile-edit-actions">
                <button
                  className={`patient-hero-button${profileUpdated ? ' is-saved' : ''}`}
                  type="submit"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Đang lưu...' : profileUpdated ? 'Đã cập nhật' : 'Lưu thay đổi'}
                </button>
                <button
                  className="patient-soft-button"
                  type="button"
                  onClick={handleCancelProfileEdit}
                >
                  Hủy
                </button>
              </div>
            </form>
            ) : (
              <div className="patient-profile-edit-placeholder">
                <PatientIcon name="edit_square" aria-hidden="true" />
                <p>Bấm “Chỉnh sửa hồ sơ” ở thẻ trên để cập nhật thông tin cá nhân.</p>
              </div>
            )}
          </section>
        </main>

        <aside className="patient-profile-side">
          <section className="patient-profile-side-card patient-profile-completion-card">
            <h2>Hoàn tất hồ sơ</h2>
            <div className="patient-profile-completion-body">
              <div
                className="patient-profile-ring"
                style={{ '--patient-profile-completion': `${completion}%` }}
              >
                <strong>{completion}%</strong>
                <span>Hoàn tất</span>
              </div>
              <p>Hồ sơ của bạn đã hoàn thiện. Cập nhật đủ thông tin giúp cá nhân hóa dịch vụ tốt hơn.</p>
            </div>
            <button type="button" onClick={openProfileEditor}>
              Bổ sung hồ sơ
              <PatientIcon name="arrow_forward" aria-hidden="true" />
            </button>
          </section>

          <section className="patient-profile-side-card">
            <h2>Dữ liệu y tế đồng bộ</h2>
            <div className="patient-profile-api-summary">
              <article>
                <span>Lịch hẹn</span>
                <strong>{patientAppointments.length}</strong>
                <p>{latestAppointment ? formatDateTime(latestAppointment.appointment_time) : 'Chưa có lịch hẹn'}</p>
              </article>
              <article>
                <span>Lần khám</span>
                <strong>{patientEncounters.length}</strong>
                <p>{latestEncounter ? formatDateTime(latestEncounter.start_time) : 'Chưa có lần khám'}</p>
              </article>
              <article>
                <span>Đơn thuốc</span>
                <strong>{patientPrescriptions.length}</strong>
                <p>{latestPrescription?.prescription_no || 'Chưa có đơn thuốc'}</p>
              </article>
            </div>
          </section>

          <section className="patient-profile-side-card">
            <h2>Bảo mật tài khoản</h2>
            <div className="patient-profile-security-list">
              <SecurityRow icon="mail" label="Email tài khoản" status={getUpdatedLabel(email)} />
              <SecurityRow icon="phone_iphone" label="Số điện thoại" status={getUpdatedLabel(phone)} />
              <SecurityRow icon="lock" label="Mật khẩu" status="Đã thiết lập" />
              <SecurityRow icon="admin_panel_settings" label="Xác thực 2 lớp (2FA)" status="Chưa hỗ trợ" />
            </div>
          </section>

          <section className="patient-profile-side-card">
            <h2>Đổi mật khẩu</h2>
            <form className="patient-profile-password-form" onSubmit={onPasswordSave}>
              <label>
                <span>Mật khẩu hiện tại</span>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={onPasswordFieldChange('currentPassword')}
                />
              </label>
              <label>
                <span>Mật khẩu mới</span>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={onPasswordFieldChange('newPassword')}
                />
              </label>
              <button className="patient-soft-button" type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
              </button>
            </form>
          </section>
        </aside>
      </div>

      <section className="patient-profile-account-panel">
        <div className="patient-profile-section-head">
          <h2>Phiên đăng nhập và nhật ký truy cập</h2>
          <button type="button" onClick={onLogoutAllDevices}>
            Đăng xuất tất cả
          </button>
        </div>

        {sessionsLoading ? (
          <div className="patient-empty-state">Đang tải phiên đăng nhập...</div>
        ) : (
          <div className="patient-profile-account-grid">
            <article>
              <span>Phiên hiện tại</span>
              <strong>{activeSessionCount} phiên đang hoạt động</strong>
              <p>
                {recentSession
                  ? `${summarizeUserAgent(recentSession.user_agent)} • IP ${recentSession.ip_address || 'Không rõ'}`
                  : 'Chưa có phiên đăng nhập nào.'}
              </p>
            </article>
            <article>
              <span>Lần đăng nhập gần nhất</span>
              <strong>{formatDateTime(user?.lastLoginAt || recentSession?.login_at)}</strong>
              <p>{loginHistory[0]?.message || 'Hoạt động đăng nhập được đồng bộ từ backend auth.'}</p>
            </article>
          </div>
        )}

        {!sessionsLoading && sessions.length ? (
          <div className="patient-profile-session-strip">
            {sessions.slice(0, 3).map((session) => (
              <article key={session.session_id}>
                <div>
                  <strong>{summarizeUserAgent(session.user_agent)}</strong>
                  <span>Hết hạn: {formatDateTime(session.expires_at)}</span>
                </div>
                {!session.revoked_at ? (
                  <button type="button" onClick={() => onRevokeSession(session.session_id)}>
                    Thu hồi
                  </button>
                ) : (
                  <em>Đã thu hồi</em>
                )}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
