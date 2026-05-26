import { useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { formatDateTime } from '../utils/patientHelpers'

const authorizationOptions = [
  { value: 'view_records', label: 'Xem hồ sơ' },
  { value: 'book_appointments', label: 'Đặt lịch' },
  { value: 'billing', label: 'Tài chính' },
  { value: 'receive_notifications', label: 'Nhận thông báo' },
  { value: 'full_access', label: 'Toàn quyền' },
]

const statusLabels = {
  active: 'Đang hoạt động',
  pending: 'Chờ duyệt',
  revoked: 'Đã thu hồi',
  expired: 'Hết hạn',
  rejected: 'Bị từ chối',
  inactive: 'Tạm ngưng',
  blocked: 'Bị khóa',
}

const emptyRelativeForm = {
  full_name: '',
  relationship: '',
  phone: '',
  email: '',
  is_emergency_contact: false,
  is_primary_contact: false,
}

function getRelativeId(relative = {}) {
  return relative.relative_id || relative._id || relative.id
}

function getAuthorizationId(authorization = {}) {
  return authorization.authorization_id || authorization._id || authorization.id
}

export default function PatientRelativesAuthorizationPage({
  authorizations = [],
  busyAction = '',
  error = '',
  feedback = null,
  loading = false,
  onCreateAuthorization,
  onCreateRelative,
  onRevokeAuthorization,
  relatives = [],
}) {
  const [activeTab, setActiveTab] = useState('relatives')
  const [relativeForm, setRelativeForm] = useState(emptyRelativeForm)
  const [authorizationForm, setAuthorizationForm] = useState({
    relative_id: '',
    authorization_type: 'view_records',
    valid_to: '',
  })
  const activeAuthorizations = useMemo(
    () => authorizations.filter((item) => item.status === 'active').length,
    [authorizations],
  )
  const pendingAuthorizations = useMemo(
    () => authorizations.filter((item) => item.status === 'pending').length,
    [authorizations],
  )
  const firstRelativeId = getRelativeId(relatives[0])
  const selectedRelativeId = authorizationForm.relative_id || firstRelativeId || ''

  const handleRelativeSubmit = async (event) => {
    event.preventDefault()
    await onCreateRelative?.(relativeForm)
    setRelativeForm(emptyRelativeForm)
  }

  const handleAuthorizationSubmit = async (event) => {
    event.preventDefault()
    if (!selectedRelativeId) return
    await onCreateAuthorization?.({
      ...authorizationForm,
      relative_id: selectedRelativeId,
      valid_to: authorizationForm.valid_to || undefined,
    })
    setAuthorizationForm({ relative_id: selectedRelativeId, authorization_type: 'view_records', valid_to: '' })
  }

  return (
    <div className="patient-relatives-page">
      <header className="patient-feature-header">
        <div>
          <p className="patient-section-label">Ủy quyền hồ sơ</p>
          <h1>Người thân / Ủy quyền</h1>
          <p>Quản lý người thân và phạm vi quyền truy cập hồ sơ bệnh nhân bằng dữ liệu portal self-service.</p>
        </div>
      </header>

      {loading ? <div className="patient-dashboard-state">Đang tải người thân và ủy quyền...</div> : null}
      {!loading && error ? <div className="patient-dashboard-state patient-dashboard-state-error">{error}</div> : null}
      {feedback?.context === 'relatives' ? (
        <div className={`patient-dashboard-state${feedback.type === 'error' ? ' patient-dashboard-state-error' : ''}`}>
          {feedback.message}
        </div>
      ) : null}

      <section className="patient-relatives-summary-grid">
        <article className="patient-panel patient-relatives-summary-card">
          <PatientIcon name="person" aria-hidden="true" />
          <div>
            <span>Người thân</span>
            <strong>{relatives.length}</strong>
          </div>
        </article>
        <article className="patient-panel patient-relatives-summary-card">
          <PatientIcon name="verified_user" aria-hidden="true" />
          <div>
            <span>Ủy quyền hoạt động</span>
            <strong>{activeAuthorizations}</strong>
          </div>
        </article>
        <article className="patient-panel patient-relatives-summary-card">
          <PatientIcon name="schedule" aria-hidden="true" />
          <div>
            <span>Chờ duyệt</span>
            <strong>{pendingAuthorizations}</strong>
          </div>
        </article>
      </section>

      <div className="patient-relatives-tabs" role="tablist" aria-label="Người thân và ủy quyền">
        <button type="button" className={activeTab === 'relatives' ? 'is-active' : ''} onClick={() => setActiveTab('relatives')}>
          Người thân của tôi
        </button>
        <button type="button" className={activeTab === 'authorizations' ? 'is-active' : ''} onClick={() => setActiveTab('authorizations')}>
          Quyền ủy quyền
        </button>
      </div>

      {activeTab === 'relatives' ? (
        <section className="patient-relatives-layout">
          <form className="patient-panel patient-relatives-form" onSubmit={handleRelativeSubmit}>
            <div className="patient-panel-head">
              <div>
                <p className="patient-section-label">Thêm người thân</p>
                <h2>Thông tin liên hệ</h2>
              </div>
            </div>
            <label>
              Họ tên
              <input
                value={relativeForm.full_name}
                onChange={(event) => setRelativeForm((form) => ({ ...form, full_name: event.target.value }))}
                required
              />
            </label>
            <label>
              Mối quan hệ
              <input
                value={relativeForm.relationship}
                onChange={(event) => setRelativeForm((form) => ({ ...form, relationship: event.target.value }))}
                required
              />
            </label>
            <label>
              Số điện thoại
              <input
                value={relativeForm.phone}
                onChange={(event) => setRelativeForm((form) => ({ ...form, phone: event.target.value }))}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={relativeForm.email}
                onChange={(event) => setRelativeForm((form) => ({ ...form, email: event.target.value }))}
              />
            </label>
            <div className="patient-relatives-checks">
              <label>
                <input
                  type="checkbox"
                  checked={relativeForm.is_primary_contact}
                  onChange={(event) => setRelativeForm((form) => ({ ...form, is_primary_contact: event.target.checked }))}
                />
                Liên hệ chính
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={relativeForm.is_emergency_contact}
                  onChange={(event) => setRelativeForm((form) => ({ ...form, is_emergency_contact: event.target.checked }))}
                />
                Liên hệ khẩn cấp
              </label>
            </div>
            <button className="patient-hero-button" type="submit" disabled={busyAction === 'create-relative'}>
              <PatientIcon name="add_circle" aria-hidden="true" />
              <span>{busyAction === 'create-relative' ? 'Đang thêm...' : 'Thêm người thân'}</span>
            </button>
          </form>

          <div className="patient-relatives-list">
            {relatives.length === 0 ? (
              <div className="patient-empty-state">Chưa có người thân nào trong hồ sơ portal.</div>
            ) : (
              relatives.map((relative) => (
                <article className="patient-panel patient-relative-card" key={getRelativeId(relative)}>
                  <div className="patient-relative-avatar">
                    <PatientIcon name="person" aria-hidden="true" />
                  </div>
                  <div>
                    <h3>{relative.full_name}</h3>
                    <p>{relative.relationship || 'Chưa cập nhật quan hệ'}</p>
                    <div className="patient-relative-meta">
                      <span>{relative.phone || 'Chưa có SĐT'}</span>
                      <span>{relative.email || 'Chưa có email'}</span>
                    </div>
                  </div>
                  <span className={`patient-status-pill ${relative.relationship_verified ? 'good' : 'soft'}`}>
                    {relative.relationship_verified ? 'Đã xác thực' : 'Chưa xác thực'}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      ) : (
        <section className="patient-relatives-layout">
          <form className="patient-panel patient-relatives-form" onSubmit={handleAuthorizationSubmit}>
            <div className="patient-panel-head">
              <div>
                <p className="patient-section-label">Tạo yêu cầu</p>
                <h2>Ủy quyền truy cập</h2>
              </div>
            </div>
            <label>
              Người thân
              <select
                value={selectedRelativeId}
                onChange={(event) => setAuthorizationForm((form) => ({ ...form, relative_id: event.target.value }))}
                disabled={!relatives.length}
              >
                {relatives.map((relative) => (
                  <option key={getRelativeId(relative)} value={getRelativeId(relative)}>
                    {relative.full_name} · {relative.relationship}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phạm vi quyền
              <select
                value={authorizationForm.authorization_type}
                onChange={(event) => setAuthorizationForm((form) => ({ ...form, authorization_type: event.target.value }))}
              >
                {authorizationOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Hiệu lực đến
              <input
                type="date"
                value={authorizationForm.valid_to}
                onChange={(event) => setAuthorizationForm((form) => ({ ...form, valid_to: event.target.value }))}
              />
            </label>
            <button className="patient-hero-button" type="submit" disabled={!relatives.length || busyAction === 'create-authorization'}>
              <PatientIcon name="verified_user" aria-hidden="true" />
              <span>{busyAction === 'create-authorization' ? 'Đang gửi...' : 'Gửi yêu cầu ủy quyền'}</span>
            </button>
          </form>

          <div className="patient-relatives-list">
            {authorizations.length === 0 ? (
              <div className="patient-empty-state">Chưa có yêu cầu ủy quyền nào.</div>
            ) : (
              authorizations.map((authorization) => {
                const authorizationId = getAuthorizationId(authorization)
                return (
                  <article className="patient-panel patient-authorization-card" key={authorizationId}>
                    <div>
                      <p className="patient-section-label">{authorization.relative?.full_name || 'Người thân'}</p>
                      <h3>{authorizationOptions.find((option) => option.value === authorization.authorization_type)?.label || authorization.authorization_type}</h3>
                      <p>
                        Hiệu lực từ {formatDateTime(authorization.valid_from, { timeStyle: undefined })}
                        {authorization.valid_to ? ` đến ${formatDateTime(authorization.valid_to, { timeStyle: undefined })}` : ''}
                      </p>
                    </div>
                    <span className={`patient-status-pill ${authorization.status === 'active' ? 'good' : authorization.status === 'pending' ? 'soft' : 'rose'}`}>
                      {statusLabels[authorization.status] || authorization.status}
                    </span>
                    {['active', 'pending'].includes(authorization.status) ? (
                      <button
                        className="patient-outline-button"
                        type="button"
                        disabled={busyAction === `revoke-${authorizationId}`}
                        onClick={() => onRevokeAuthorization?.(authorizationId)}
                      >
                        Thu hồi
                      </button>
                    ) : null}
                  </article>
                )
              })
            )}
          </div>
        </section>
      )}
    </div>
  )
}
