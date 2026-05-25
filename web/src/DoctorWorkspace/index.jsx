import { useNavigate } from 'react-router-dom'
import { useAuth } from './doctorAuth'
import { DoctorWorkspaceExperience } from './DoctorWorkspaceExperience'
import { ToastProvider } from './ToastProvider'
import './doctor.css'
import './doctor-font.css'

export default function DoctorWorkspace() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/staff/login', { replace: true })
  }

  return (
    <div className="doctor-workspace-font-root">
      <ToastProvider>
        <DoctorWorkspaceExperience
          user={user}
          onLogout={handleLogout}
          onNavigateHome={() => navigate('/home')}
        />
      </ToastProvider>
    </div>
  )
}
