import PatientIcon from '../components/PatientIcon'
import { formatDateTime, summarizeUserAgent } from '../utils/patientHelpers'

function getStatusLabel(status) {
  if (status === 'active') {
    return 'Đang hoạt động'
  }

  if (status === 'locked') {
    return 'Đang khóa'
  }

  if (status === 'inactive') {
    return 'Tạm ngưng'
  }

  return status || 'Chưa xác định'
}

export default function PatientProfileSettingsPage({
  accountError,
  activeSessionCount,
  avatarText,
  feedback,
  loginHistory,
  onFieldChange,
  onLogoutAllDevices,
  onPasswordFieldChange,
  onPasswordSave,
  onProfileSave,
  onRevokeSession,
  passwordForm,
  passwordSaving,
  patientId,
  patientName,
  patientProfile,
  profileForm,
  profileSaving,
  sessions,
  sessionsLoading,
  user,
}) {
  const patient = patientProfile?.patient

  return (
    <>
      <section className="patient-page-intro">
        <div>
          <span className="patient-eyebrow">Quản lý tài khoản</span>
          <h1>Hồ sơ và cài đặt</h1>
          <p className="patient-hero-copy">
            Màn này đang nối trực tiếp với backend auth cho hồ sơ cá nhân, đổi mật khẩu,
            phiên đăng nhập và lịch sử truy cập.
          </p>
        </div>
      </section>

      {feedback ? (
        <div className={`patient-feedback${feedback.type === 'error' ? ' is-error' : ''}`}>
          {feedback.text}
        </div>
      ) : null}

      {accountError ? <div className="patient-feedback is-error">{accountError}</div> : null}

      <div className="patient-profile-grid">
        <div className="patient-profile-column">
          <section className="patient-panel patient-profile-card-large">
            <div className="patient-profile-photo-wrap">
              <div className="patient-profile-photo">
                <span>{avatarText}</span>
              </div>
            </div>

            <h2>{patientName}</h2>
            <p className="patient-profile-id">Mã bệnh nhân: {patientId}</p>

            <div className="patient-profile-stat-grid">
              <article className="patient-profile-stat">
                <span>Trạng thái</span>
                <strong>{getStatusLabel(user?.status)}</strong>
              </article>
              <article className="patient-profile-stat">
                <span>Phiên hoạt động</span>
                <strong>{activeSessionCount}</strong>
              </article>
            </div>

            <div className="patient-profile-actions">
              <button
                className="patient-hero-button"
                type="submit"
                form="patient-profile-form"
                disabled={profileSaving}
              >
                {profileSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
              <button className="patient-soft-button" type="button" onClick={onLogoutAllDevices}>
                Đăng xuất mọi thiết bị
              </button>
            </div>
          </section>

          <section className="patient-panel patient-verified-panel">
            <div className="patient-verified-head">
              <div className="patient-verified-icon">
                <PatientIcon name="verified_user" aria-hidden="true" />
              </div>
              <span>Tài khoản backend đã xác thực</span>
            </div>
            <div className="patient-profile-meta-stack">
              <p>Email: {user?.email || 'Chưa cập nhật'}</p>
              <p>Số điện thoại: {user?.phone || 'Chưa cập nhật'}</p>
              <p>Lần đăng nhập gần nhất: {formatDateTime(user?.lastLoginAt)}</p>
              <p>Số quyền hiện có: {user?.permissions?.length || 0}</p>
            </div>
          </section>
        </div>

        <div className="patient-profile-column patient-profile-column-wide">
          <section className="patient-panel">
            <div className="patient-panel-head">
              <div>
                <p className="patient-section-label">Thông tin cá nhân</p>
                <h2>Hồ sơ đang đồng bộ</h2>
              </div>
              <div className="patient-head-icon">
                <PatientIcon name="badge" aria-hidden="true" />
              </div>
            </div>

            <form id="patient-profile-form" onSubmit={onProfileSave}>
              <div className="patient-form-grid">
                <label className="patient-field">
                  <span>Họ và tên</span>
                  <div className="patient-field-shell">
                    <input
                      type="text"
                      value={profileForm.fullName}
                      onChange={onFieldChange('fullName')}
                    />
                  </div>
                </label>

                <label className="patient-field">
                  <span>Số điện thoại</span>
                  <div className="patient-field-shell">
                    <input type="tel" value={profileForm.phone} onChange={onFieldChange('phone')} />
                  </div>
                </label>

                <label className="patient-field">
                  <span>Ngày sinh</span>
                  <div className="patient-field-shell">
                    <input
                      type="text"
                      value={
                        patient?.date_of_birth
                          ? formatDateTime(patient.date_of_birth, { timeStyle: undefined })
                          : 'Chưa cập nhật'
                      }
                      readOnly
                    />
                  </div>
                </label>

                <label className="patient-field">
                  <span>Bảo hiểm</span>
                  <div className="patient-field-shell">
                    <input
                      type="text"
                      value={patient?.insurance_number || 'Chưa cập nhật'}
                      readOnly
                    />
                  </div>
                </label>

                <label className="patient-field patient-field-wide">
                  <span>Liên hệ khẩn cấp</span>
                  <div className="patient-field-shell">
                    <input
                      type="tel"
                      value={profileForm.emergencyContactPhone}
                      onChange={onFieldChange('emergencyContactPhone')}
                      placeholder="Nhập số điện thoại liên hệ khẩn cấp"
                    />
                  </div>
                </label>

                <label className="patient-field patient-field-wide">
                  <span>Địa chỉ email</span>
                  <div className="patient-field-shell">
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={onFieldChange('email')}
                    />
                  </div>
                </label>

                <label className="patient-field patient-field-wide">
                  <span>Địa chỉ liên hệ</span>
                  <div className="patient-field-shell">
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={onFieldChange('address')}
                      placeholder="Nhập địa chỉ liên hệ"
                    />
                  </div>
                </label>
              </div>

              <div className="patient-form-actions">
                <button className="patient-hero-button" type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Đang lưu...' : 'Cập nhật hồ sơ'}
                </button>
              </div>
            </form>
          </section>

          <section className="patient-panel">
            <div className="patient-panel-head">
              <div>
                <p className="patient-section-label">Bảo mật</p>
                <h2>Đổi mật khẩu</h2>
              </div>
              <div className="patient-head-icon">
                <PatientIcon name="security" aria-hidden="true" />
              </div>
            </div>

            <form id="patient-password-form" onSubmit={onPasswordSave}>
              <div className="patient-form-grid">
                <label className="patient-field">
                  <span>Mật khẩu hiện tại</span>
                  <div className="patient-field-shell">
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={onPasswordFieldChange('currentPassword')}
                    />
                  </div>
                </label>

                <label className="patient-field">
                  <span>Mật khẩu mới</span>
                  <div className="patient-field-shell">
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={onPasswordFieldChange('newPassword')}
                    />
                  </div>
                </label>
              </div>

              <div className="patient-form-actions">
                <button className="patient-soft-button" type="submit" disabled={passwordSaving}>
                  {passwordSaving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </section>

          <section className="patient-panel">
            <div className="patient-panel-head">
              <div>
                <p className="patient-section-label">Phiên đăng nhập</p>
                <h2>Thiết bị đang truy cập</h2>
              </div>
              <button className="patient-inline-link" type="button" onClick={onLogoutAllDevices}>
                Đăng xuất tất cả
              </button>
            </div>

            {sessionsLoading ? (
              <div className="patient-empty-state">Đang tải phiên đăng nhập...</div>
            ) : sessions.length === 0 ? (
              <div className="patient-empty-state">Chưa có phiên đăng nhập nào.</div>
            ) : (
              <div className="patient-stack-list">
                {sessions.map((session) => (
                  <article key={session.session_id} className="patient-session-item">
                    <div className="patient-session-main">
                      <div>
                        <h3>{summarizeUserAgent(session.user_agent)}</h3>
                        <p>
                          IP {session.ip_address || 'Không rõ'} • Đăng nhập lúc{' '}
                          {formatDateTime(session.login_at)}
                        </p>
                        <p>Hết hạn: {formatDateTime(session.expires_at)}</p>
                      </div>
                      <span className={`patient-pill ${session.is_active ? 'good' : 'soft'}`}>
                        {session.is_active ? 'Đang hoạt động' : 'Đã thu hồi'}
                      </span>
                    </div>

                    <div className="patient-inline-actions">
                      <span className="patient-profile-note">
                        Hoạt động gần nhất: {formatDateTime(session.last_seen_at)}
                      </span>
                      {!session.revoked_at ? (
                        <button
                          className="patient-inline-link"
                          type="button"
                          onClick={() => onRevokeSession(session.session_id)}
                        >
                          Thu hồi phiên
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="patient-panel">
            <div className="patient-panel-head">
              <div>
                <p className="patient-section-label">Lịch sử đăng nhập</p>
                <h2>Nhật ký truy cập gần đây</h2>
              </div>
            </div>

            {sessionsLoading ? (
              <div className="patient-empty-state">Đang tải lịch sử đăng nhập...</div>
            ) : loginHistory.length === 0 ? (
              <div className="patient-empty-state">Chưa có bản ghi đăng nhập nào.</div>
            ) : (
              <div className="patient-history-list">
                {loginHistory.map((item) => (
                  <article key={item.audit_log_id} className="patient-history-item">
                    <div>
                      <h3>{item.message || 'Đăng nhập hệ thống'}</h3>
                      <p>
                        {summarizeUserAgent(item.user_agent)} • IP {item.ip_address || 'Không rõ'}
                      </p>
                    </div>
                    <span>{formatDateTime(item.created_at)}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <footer className="patient-module-footer">
        <p>Clinical Curator © 2024 • Hồ sơ tài khoản kết nối backend auth</p>
      </footer>
    </>
  )
}
