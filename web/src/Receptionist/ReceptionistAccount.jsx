import { useNavigate } from 'react-router-dom'
import { clearStoredAuth, readStoredAuth } from '../lib/storage'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'R'
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function getRoleName(auth) {
  return auth?.user?.role?.name || auth?.user?.role || auth?.user?.role_name || auth?.role || 'Receptionist'
}

function formatValue(value) {
  return value || '—'
}

export default function ReceptionistAccountPage() {
  const navigate = useNavigate()
  const auth = readStoredAuth()
  const user = auth?.user || {}
  const accessToken = auth?.accessToken || auth?.token || auth?.access_token
  const displayName = user?.fullName || user?.full_name || user?.name || user?.username || auth?.username || 'Receptionist'
  const permissions = user?.permissions || auth?.permissions || []

  const infoRows = [
    ['Họ tên', displayName],
    ['Tên đăng nhập', user?.username || auth?.username],
    ['Email', user?.email],
    ['Số điện thoại', user?.phone || user?.phone_number],
    ['Mã nhân sự', user?.staff_id || user?.staffId || user?.id || user?._id],
    ['Vai trò', getRoleName(auth)],
  ]

  const sessionRows = [
    ['Trạng thái', accessToken ? 'Đã xác thực' : 'Thiếu token'],
    ['Nguồn đăng nhập', 'Staff portal'],
    ['Quyền chi tiết', Array.isArray(permissions) && permissions.length ? `${permissions.length} quyền` : 'Backend chưa trả'],
  ]

  function handleLogout() {
    clearStoredAuth()
    navigate('/staff/login', { replace: true })
  }

  return (
    <ReceptionistShell
      title="Tài khoản của tôi"
      subtitle="Thông tin phiên làm việc, vai trò và các lối tắt cá nhân"
      activeSection="account"
    >
      <div className="account-layout">
        <section className="account-profile-card">
          <div className="account-avatar">{initials(displayName)}</div>
          <div>
            <h2>{displayName}</h2>
            <p>{getRoleName(auth)}</p>
            <span className={`appt-badge ${accessToken ? 'green' : 'red'}`}>{accessToken ? 'Đang đăng nhập' : 'Chưa xác thực'}</span>
          </div>
          <button type="button" onClick={handleLogout}>Đăng xuất</button>
        </section>

        <div className="account-grid">
          <section className="settings-card">
            <header><h2>Thông tin cá nhân</h2></header>
            {infoRows.map(([label, value]) => (
              <div className="settings-row" key={label}>
                <span>{label}</span>
                <strong>{formatValue(value)}</strong>
              </div>
            ))}
          </section>

          <section className="settings-card">
            <header><h2>Phiên làm việc</h2></header>
            {sessionRows.map(([label, value]) => (
              <div className="settings-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <div className="settings-row">
              <span>Token</span>
              <strong>{accessToken ? `${String(accessToken).slice(0, 12)}...` : '—'}</strong>
            </div>
          </section>

          <section className="settings-card">
            <header><h2>Lối tắt công việc</h2></header>
            <div className="account-shortcuts">
              <button type="button" onClick={() => navigate('/receptionist/appointments')}><Icon name="calendar" /> Lịch hẹn</button>
              <button type="button" onClick={() => navigate('/receptionist/cashier')}><Icon name="wallet" /> Thu ngân</button>
              <button type="button" onClick={() => navigate('/receptionist/daily-report')}><Icon name="chart" /> Báo cáo ngày</button>
              <button type="button" onClick={() => navigate('/receptionist/settings')}><Icon name="settings" /> Trạng thái hệ thống</button>
            </div>
          </section>
        </div>
      </div>
    </ReceptionistShell>
  )
}
