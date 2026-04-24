import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../Home/context/AuthContext'
import { getDefaultAuthenticatedPath, isDoctorUser } from '../Home/context/authHelpers'
import { DoctorProfileScreen } from '../DoctorWorkspace/DoctorProfileScreen'
import '../DoctorWorkspace/doctor-profile.css'

function formatRoleLabel(role) {
  return String(role || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function getMainAreaPath(user) {
  if (user?.actor_type === 'patient') {
    return '/dashboard'
  }

  return getDefaultAuthenticatedPath(user)
}

function getMainAreaLabel(user) {
  if (user?.actor_type === 'patient') {
    return 'Mo dashboard benh nhan'
  }

  return isDoctorUser(user) ? 'Mo doctor workspace' : 'Ve trang chu'
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (user?.actor_type === 'patient') {
    return <Navigate to="/dashboard" replace />
  }

  // Show doctor profile for doctors
  if (isDoctorUser(user)) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        padding: '24px',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
        }}>
          <DoctorProfileScreen user={user} />
        </div>
      </div>
    )
  }

  const displayName = user?.full_name || user?.fullName || user?.email || 'Nguoi dung'
  const accountType = user?.actor_type === 'staff' ? 'Nhan su' : 'Benh nhan'
  const roles = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [user?.actor_type || 'patient']
  const workAreaPath = getMainAreaPath(user)
  const workAreaLabel = getMainAreaLabel(user)

  const handleLogout = async () => {
    await logout()
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-logo">HealthCare</div>
        <div className="dashboard-user">
          <span>Ho so tai khoan cua {displayName}</span>
          <button onClick={handleLogout} className="btn-logout">
            Dang xuat
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h2>Thong tin ca nhan</h2>
          <p>Trang nay hien thi thong tin tai khoan dang dang nhap tu session auth hien tai.</p>

          <div className="dashboard-badges">
            <span className="dashboard-badge">{accountType}</span>
            {roles.map((role) => (
              <span key={role} className="dashboard-badge subtle">
                {formatRoleLabel(role)}
              </span>
            ))}
          </div>

          <div className="dashboard-info">
            <div className="info-item">
              <span className="info-label">Ho va ten:</span>
              <span>{displayName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span>{user?.email || 'Chua cap nhat'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">So dien thoai:</span>
              <span>{user?.phone || 'Chua cap nhat'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Trang thai:</span>
              <span>{user?.status || 'active'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Loai tai khoan:</span>
              <span>{user?.actor_type || 'patient'}</span>
            </div>
            {user?.employee_code && (
              <div className="info-item">
                <span className="info-label">Ma nhan su:</span>
                <span>{user.employee_code}</span>
              </div>
            )}
            {user?.department_id && (
              <div className="info-item">
                <span className="info-label">Ma khoa:</span>
                <span>{user.department_id}</span>
              </div>
            )}
            {user?.patient_code && (
              <div className="info-item">
                <span className="info-label">Ma benh nhan:</span>
                <span>{user.patient_code}</span>
              </div>
            )}
          </div>

          <div className="dashboard-actions">
            <Link to="/" className="hc-btn-login">
              Ve trang chu
            </Link>
            <Link to={workAreaPath} className="hc-btn-outline">
              {workAreaLabel}
            </Link>
            <button onClick={handleLogout} className="hc-btn-register">
              Dang xuat khoi he thong
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
