import { useState } from 'react'
import { DoctorIcon } from './DoctorShell'

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

function formatDateTime(dateString) {
  if (!dateString) return 'Chưa cập nhật'
  try {
    return new Date(dateString).toLocaleString('vi-VN')
  } catch (e) {
    return dateString
  }
}

export default function DoctorProfilePage({
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
  doctorId,
  doctorName,
  doctorProfile,
  profileForm,
  profileSaving,
  sessions,
  sessionsLoading,
  user,
}) {
  const [expandedSession, setExpandedSession] = useState(null)
  const [expandedHistory, setExpandedHistory] = useState(null)

  return (
    <div className="doctor-profile-container">
      {/* Header Section */}
      <section className="doctor-page-intro">
        <div className="doctor-intro-content">
          <span className="doctor-eyebrow">Quản lý tài khoản</span>
          <h1 className="doctor-intro-title">Hồ sơ và Cài Đặt</h1>
          <p className="doctor-intro-description">
            Quản lý thông tin cá nhân, đổi mật khẩu, phiên đăng nhập và lịch sử truy cập của bạn.
          </p>
        </div>
      </section>

      {/* Feedback Messages */}
      {feedback ? (
        <div className={`doctor-feedback ${feedback.type === 'error' ? 'is-error' : 'is-success'}`}>
          <div className="doctor-feedback-content">
            {feedback.type === 'error' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            <span>{feedback.text}</span>
          </div>
        </div>
      ) : null}

      {accountError ? (
        <div className="doctor-feedback is-error">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{accountError}</span>
        </div>
      ) : null}

      {/* Main Profile Grid */}
      <div className="doctor-profile-grid">
        {/* Left Column - Profile Card */}
        <div className="doctor-profile-column">
          {/* Profile Card */}
          <section className="doctor-panel doctor-profile-card-large">
            <div className="doctor-profile-photo-wrap">
              <div className="doctor-profile-photo">
                <span>{avatarText}</span>
              </div>
              <div className="doctor-profile-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
            </div>

            <h2 className="doctor-profile-name">{doctorName}</h2>
            <p className="doctor-profile-id">Mã bác sĩ: {doctorId}</p>

            {doctorProfile?.specialization && (
              <p className="doctor-profile-specialization">{doctorProfile.specialization}</p>
            )}

            <div className="doctor-profile-stat-grid">
              <article className="doctor-profile-stat">
                <span className="stat-label">Trạng thái</span>
                <strong className="stat-value">{getStatusLabel(user?.status)}</strong>
              </article>
              <article className="doctor-profile-stat">
                <span className="stat-label">Phiên hoạt động</span>
                <strong className="stat-value">{activeSessionCount}</strong>
              </article>
            </div>

            <div className="doctor-profile-actions">
              <button
                className="doctor-hero-button"
                type="submit"
                form="doctor-profile-form"
                disabled={profileSaving}
              >
                <span className="button-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                </span>
                <span>{profileSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
              </button>
              <button className="doctor-soft-button" type="button" onClick={onLogoutAllDevices}>
                <span className="button-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span>Đăng xuất mọi thiết bị</span>
              </button>
            </div>
          </section>

          {/* Verified Panel */}
          <section className="doctor-panel doctor-verified-panel">
            <div className="doctor-verified-head">
              <div className="doctor-verified-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span>Tài khoản bác sĩ xác thực</span>
            </div>
            <div className="doctor-profile-meta-stack">
              <p>
                <strong>Email:</strong>
                <span>{user?.email || 'Chưa cập nhật'}</span>
              </p>
              <p>
                <strong>Số điện thoại:</strong>
                <span>{user?.phone || 'Chưa cập nhật'}</span>
              </p>
              <p>
                <strong>Bộ phận:</strong>
                <span>{doctorProfile?.department || 'Chưa cập nhật'}</span>
              </p>
              <p>
                <strong>Lần đăng nhập gần nhất:</strong>
                <span>{formatDateTime(user?.lastLoginAt)}</span>
              </p>
              <p>
                <strong>Quyền hiện có:</strong>
                <span>{user?.permissions?.length || 0}</span>
              </p>
            </div>
          </section>
        </div>

        {/* Right Column - Forms */}
        <div className="doctor-profile-column doctor-profile-column-wide">
          {/* Personal Information */}
          <section className="doctor-panel">
            <div className="doctor-panel-head">
              <div>
                <p className="doctor-section-label">Thông tin cá nhân</p>
                <h2 className="doctor-panel-title">Hồ sơ bác sĩ</h2>
              </div>
              <div className="doctor-head-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>

            <form id="doctor-profile-form" onSubmit={onProfileSave}>
              <div className="doctor-form-grid">
                <label className="doctor-field">
                  <span className="field-label">Họ và tên</span>
                  <div className="doctor-field-shell">
                    <input
                      type="text"
                      value={profileForm.fullName}
                      onChange={onFieldChange('fullName')}
                      placeholder="Nhập họ và tên"
                    />
                  </div>
                </label>

                <label className="doctor-field">
                  <span className="field-label">Số điện thoại</span>
                  <div className="doctor-field-shell">
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={onFieldChange('phone')}
                      placeholder="Nhập số điện thoại"
                    />
                  </div>
                </label>

                <label className="doctor-field">
                  <span className="field-label">Email</span>
                  <div className="doctor-field-shell">
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={onFieldChange('email')}
                      placeholder="Nhập email"
                    />
                  </div>
                </label>

                <label className="doctor-field">
                  <span className="field-label">Chuyên khoa</span>
                  <div className="doctor-field-shell">
                    <input
                      type="text"
                      value={profileForm.specialization || ''}
                      onChange={onFieldChange('specialization')}
                      placeholder="Nhập chuyên khoa"
                    />
                  </div>
                </label>

                <label className="doctor-field doctor-field-wide">
                  <span className="field-label">Địa chỉ</span>
                  <div className="doctor-field-shell">
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={onFieldChange('address')}
                      placeholder="Nhập địa chỉ"
                    />
                  </div>
                </label>

                <label className="doctor-field doctor-field-wide">
                  <span className="field-label">Số giấy phép hành nghề (nếu có)</span>
                  <div className="doctor-field-shell">
                    <input
                      type="text"
                      value={profileForm.licenseNumber || ''}
                      onChange={onFieldChange('licenseNumber')}
                      placeholder="Nhập số giấy phép"
                    />
                  </div>
                </label>
              </div>
            </form>
          </section>

          {/* Password Section */}
          <section className="doctor-panel">
            <div className="doctor-panel-head">
              <div>
                <p className="doctor-section-label">Bảo mật</p>
                <h2 className="doctor-panel-title">Đổi mật khẩu</h2>
              </div>
              <div className="doctor-head-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            </div>

            <form onSubmit={onPasswordSave}>
              <div className="doctor-form-grid">
                <label className="doctor-field doctor-field-wide">
                  <span className="field-label">Mật khẩu hiện tại</span>
                  <div className="doctor-field-shell">
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={onPasswordFieldChange('currentPassword')}
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                  </div>
                </label>

                <label className="doctor-field doctor-field-wide">
                  <span className="field-label">Mật khẩu mới</span>
                  <div className="doctor-field-shell">
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={onPasswordFieldChange('newPassword')}
                      placeholder="Nhập mật khẩu mới"
                    />
                  </div>
                </label>
              </div>

              <button type="submit" className="doctor-hero-button" disabled={passwordSaving}>
                <span className="button-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                </span>
                <span>{passwordSaving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</span>
              </button>
            </form>
          </section>

          {/* Sessions Section */}
          <section className="doctor-panel">
            <div className="doctor-panel-head">
              <div>
                <p className="doctor-section-label">Phiên làm việc</p>
                <h2 className="doctor-panel-title">Phiên đăng nhập ({sessions?.length || 0})</h2>
              </div>
              <div className="doctor-head-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="2" y1="17" x2="22" y2="17" />
                  <line x1="6" y1="20" x2="18" y2="20" />
                </svg>
              </div>
            </div>

            {sessionsLoading ? (
              <p className="doctor-loading-text">Đang tải phiên...</p>
            ) : sessions && sessions.length > 0 ? (
              <div className="doctor-sessions-list">
                {sessions.map((session, index) => (
                  <div key={session.id || index} className="doctor-session-item">
                    <div className="session-main" onClick={() => setExpandedSession(expandedSession === index ? null : index)}>
                      <div className="session-info">
                        <div className="session-header">
                          <div className="session-device">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                              <line x1="2" y1="17" x2="22" y2="17" />
                              <line x1="6" y1="20" x2="18" y2="20" />
                            </svg>
                            <span className="session-name">{session.deviceName || 'Thiết bị'}</span>
                          </div>
                          <span className={`session-status ${session.isCurrent ? 'is-current' : ''}`}>
                            {session.isCurrent ? '● Phiên hiện tại' : '● Đang hoạt động'}
                          </span>
                        </div>
                        <div className="session-meta">
                          <span>{session.ipAddress || 'IP: N/A'}</span>
                          <span>{session.browser || 'Browser: N/A'}</span>
                        </div>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`expand-icon ${expandedSession === index ? 'is-open' : ''}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>

                    {expandedSession === index && (
                      <div className="session-expanded">
                        <p>Lần cuối hoạt động: {formatDateTime(session.lastActivityAt)}</p>
                        <p>Đăng nhập lúc: {formatDateTime(session.createdAt)}</p>
                        <button
                          type="button"
                          className="doctor-revoke-button"
                          onClick={() => onRevokeSession(session.id)}
                        >
                          Hủy phiên này
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="doctor-empty-text">Không có phiên hoạt động</p>
            )}
          </section>

          {/* Login History Section */}
          <section className="doctor-panel">
            <div className="doctor-panel-head">
              <div>
                <p className="doctor-section-label">Lịch sử</p>
                <h2 className="doctor-panel-title">Lịch sử đăng nhập ({loginHistory?.length || 0})</h2>
              </div>
              <div className="doctor-head-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>

            {loginHistory && loginHistory.length > 0 ? (
              <div className="doctor-history-list">
                {loginHistory.map((record, index) => (
                  <div key={index} className="doctor-history-item">
                    <div className="history-main" onClick={() => setExpandedHistory(expandedHistory === index ? null : index)}>
                      <div className="history-info">
                        <div className="history-header">
                          <span className="history-time">{formatDateTime(record.timestamp)}</span>
                          <span className={`history-status ${record.status === 'success' ? 'is-success' : 'is-failed'}`}>
                            {record.status === 'success' ? '✓ Thành công' : '✗ Thất bại'}
                          </span>
                        </div>
                        <div className="history-meta">
                          <span>{record.ipAddress || 'IP: N/A'}</span>
                          <span>{record.browser || 'Browser: N/A'}</span>
                        </div>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`expand-icon ${expandedHistory === index ? 'is-open' : ''}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>

                    {expandedHistory === index && (
                      <div className="history-expanded">
                        <p><strong>Vị trí:</strong> {record.location || 'Không xác định'}</p>
                        <p><strong>User Agent:</strong> {record.userAgent || 'N/A'}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="doctor-empty-text">Không có lịch sử đăng nhập</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
