import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './Home/context/AuthContext'
import HomePage from './Home'
import ProfilePage from './Home/ProfilePage'
import LoginPage from './Auth/Login'
import RegisterPage from './Auth/Register'
import ForgotPasswordPage from './Auth/ForgotPassword'
import ResetPasswordPage from './Auth/ResetPassword'
import PatientPage from './Patient Page'
import DoctorWorkspace from './DoctorWorkspace'
import ProtectedRoute from './Home/components/ProtectedRoute'

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dang-nhap" element={<LoginPage />} />
          <Route path="/dang-ky" element={<RegisterPage />} />
          <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
          <Route path="/dat-lai-mat-khau" element={<ResetPasswordPage />} />
          <Route
            path="/tai-khoan"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/ho-so" element={<Navigate to="/tai-khoan" replace />} />
          <Route path="/cai-dat" element={<Navigate to="/tai-khoan" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute patientOnly>
                <PatientPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/*"
            element={
              <ProtectedRoute doctorOnly>
                <DoctorWorkspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointment-center"
            element={
              <ProtectedRoute doctorOnly>
                <Navigate to="/doctor/dashboard" replace />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
