import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  canAccessDoctorModule,
  getDefaultAuthenticatedPath,
  isDoctorUser,
  isPatientUser,
} from '../context/authHelpers'

export default function ProtectedRoute({ children, doctorOnly = false, patientOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/dang-nhap" replace />
  }

  if (doctorOnly && !canAccessDoctorModule(user)) {
    return <Navigate to={getDefaultAuthenticatedPath(user)} replace />
  }

  if (patientOnly && !isPatientUser(user)) {
    return <Navigate to={getDefaultAuthenticatedPath(user)} replace />
  }

  if (doctorOnly && isDoctorUser(user)) {
    return children
  }

  return children
}
