import { useAuth } from '../Home/context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-logo">HealthCare</div>
        <div className="dashboard-user">
          <span>Xin chào, {user?.fullName || user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">Đăng xuất</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h2>Chào mừng 👋</h2>
          <p>Bạn đã đăng nhập thành công vào hệ thống quản lý sức khỏe.</p>
          <div className="dashboard-info">
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span>{user?.email}</span>
            </div>
            {user?.phone && (
              <div className="info-item">
                <span className="info-label">Số điện thoại:</span>
                <span>{user.phone}</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
