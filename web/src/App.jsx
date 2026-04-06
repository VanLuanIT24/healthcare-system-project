import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import StaffLoginPage from './pages/StaffLoginPage';
import PatientLoginPage from './pages/PatientLoginPage';
import PatientRegisterPage from './pages/PatientRegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountPage from './pages/AccountPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AuditLogsPage from './pages/AuditLogsPage';
import RolesPage from './pages/RolesPage';
import RoleDetailPage from './pages/RoleDetailPage';
import PermissionsPage from './pages/PermissionsPage';
import LogoutPage from './pages/LogoutPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/dang-nhap-nhan-su" element={<StaffLoginPage />} />
            <Route path="/dang-nhap-benh-nhan" element={<PatientLoginPage />} />
            <Route path="/dang-ky-benh-nhan" element={<PatientRegisterPage />} />
            <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
            <Route path="/dat-lai-mat-khau" element={<ResetPasswordPage />} />
            <Route path="/khong-co-quyen" element={<UnauthorizedPage />} />
            <Route path="/dang-xuat" element={<LogoutPage />} />
            <Route
              path="/tai-khoan"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quan-tri/tai-khoan-nhan-su"
              element={
                <ProtectedRoute permissions={['auth.staff.read']}>
                  <AdminStaffPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quan-tri/audit-logs"
              element={
                <ProtectedRoute permissions={['auth.audit.read']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quan-tri/roles"
              element={
                <ProtectedRoute permissions={['role.read']}>
                  <RolesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quan-tri/roles/:roleId"
              element={
                <ProtectedRoute permissions={['role.read']}>
                  <RoleDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quan-tri/permissions"
              element={
                <ProtectedRoute permissions={['permission.read']}>
                  <PermissionsPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
