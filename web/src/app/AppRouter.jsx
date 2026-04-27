import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PatientRoute, SuperAdminRoute, StaffRoute } from './RouteGuards';
import { LoginPage } from '../auth/pages/LoginPage';
import { RegisterPage } from '../auth/pages/RegisterPage';
import { ForgotPasswordPage } from '../auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../auth/pages/ResetPasswordPage';
import { StaffLoginPage } from '../auth/pages/StaffLoginPage';
import { AdminOverviewPage } from '../admin/pages/AdminOverviewPage';
import { AdminLayout } from '../admin/components/AdminLayout';
import { StaffListPage } from '../admin/staff/pages/StaffListPage';
import { StaffCreatePage } from '../admin/staff/pages/StaffCreatePage';
import { StaffDetailPage } from '../admin/staff/pages/StaffDetailPage';
import { StaffEditPage } from '../admin/staff/pages/StaffEditPage';
import { RoleListPage } from '../admin/roles/pages/RoleListPage';
import { RoleCreatePage, RoleEditPage } from '../admin/roles/pages/RoleFormPage';
import { RoleDetailPage } from '../admin/roles/pages/RoleDetailPage';
import { RolePermissionsPage } from '../admin/roles/pages/RolePermissionsPage';
import { PermissionListPage } from '../admin/roles/pages/PermissionListPage';
import { PermissionCreatePage, PermissionEditPage } from '../admin/roles/pages/PermissionFormPage';
import { PermissionDetailPage } from '../admin/roles/pages/PermissionDetailPage';
import { DepartmentListPage } from '../admin/system/pages/DepartmentListPage';
import { DepartmentCreatePage, DepartmentEditPage } from '../admin/system/pages/DepartmentFormPage';
import { DepartmentDetailPage } from '../admin/system/pages/DepartmentDetailPage';
import { MyProfilePage } from '../admin/system/pages/MyProfilePage';
import { ChangePasswordPage } from '../admin/system/pages/ChangePasswordPage';
import { MySessionsPage } from '../admin/system/pages/MySessionsPage';
import { LoginHistoryPage } from '../admin/system/pages/LoginHistoryPage';
import { AuditLogsPage } from '../admin/system/pages/AuditLogsPage';
import { SystemSettingsPage } from '../admin/system/pages/SystemSettingsPage';
import { HomePage } from '../home/HomePage';
import { SupportPage } from '../info/pages/SupportPage';
import { TermsPage } from '../info/pages/TermsPage';
import { AboutPage } from '../home/pages/AboutPage';
import { FaqPage } from '../home/pages/FaqPage';
import { NewsArticlePage, NewsPage } from '../home/pages/NewsPage';
import { ContactPage } from '../home/pages/ContactPage';
import { StaffAccessPage } from '../staff/pages/StaffAccessPage';
import { StaffOverviewPage } from '../staff/pages/StaffOverviewPage';
import PatientPage from '../Patient Page';
import {
  ScheduleBulkCreatePage,
  ScheduleCreatePage,
  ScheduleDetailPage,
  SchedulesByDepartmentPage,
  SchedulesByDoctorPage,
  SchedulingCalendarPage,
  SchedulingDashboardPage,
  SchedulingListPage,
  SchedulingShell,
  SchedulingSlotsPage,
  SchedulingUtilizationPage,
} from '../scheduling';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/staff/access"
          element={
            <StaffRoute>
              <StaffAccessPage />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/overview"
          element={
            <StaffRoute>
              <StaffOverviewPage />
            </StaffRoute>
          }
        />
        <Route
          path="/scheduling"
          element={
            <StaffRoute>
              <SchedulingShell />
            </StaffRoute>
          }
        >
          <Route index element={<Navigate to="/scheduling/dashboard" replace />} />
          <Route path="dashboard" element={<SchedulingDashboardPage />} />
          <Route path="schedules" element={<SchedulingListPage />} />
          <Route path="schedules/:scheduleId" element={<ScheduleDetailPage />} />
          <Route path="create" element={<ScheduleCreatePage />} />
          <Route path="bulk-create" element={<ScheduleBulkCreatePage />} />
          <Route path="approvals" element={<SchedulingDashboardPage />} />
          <Route path="calendar" element={<SchedulingCalendarPage />} />
          <Route path="slots" element={<SchedulingSlotsPage />} />
          <Route path="utilization" element={<SchedulingUtilizationPage />} />
          <Route path="doctors" element={<SchedulesByDoctorPage />} />
          <Route path="departments" element={<SchedulesByDepartmentPage />} />
          <Route path="activity" element={<SchedulingDashboardPage />} />
        </Route>
        <Route path="/admin/scheduling/*" element={<Navigate to="/scheduling/dashboard" replace />} />
        <Route
          path="/patient"
          element={
            <PatientRoute>
              <PatientPage />
            </PatientRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <SuperAdminRoute>
              <AdminLayout />
            </SuperAdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path="overview" element={<AdminOverviewPage />} />
          <Route path="staff" element={<StaffListPage />} />
          <Route path="staff/create" element={<StaffCreatePage />} />
          <Route path="staff/:staffId" element={<StaffDetailPage />} />
          <Route path="staff/:staffId/edit" element={<StaffEditPage />} />
          <Route path="roles" element={<RoleListPage />} />
          <Route path="roles/create" element={<RoleCreatePage />} />
          <Route path="roles/:roleId" element={<RoleDetailPage />} />
          <Route path="roles/:roleId/edit" element={<RoleEditPage />} />
          <Route path="roles/:roleId/permissions" element={<RolePermissionsPage />} />
          <Route path="permissions" element={<PermissionListPage />} />
          <Route path="permissions/create" element={<PermissionCreatePage />} />
          <Route path="permissions/:permissionId" element={<PermissionDetailPage />} />
          <Route path="permissions/:permissionId/edit" element={<PermissionEditPage />} />
          <Route path="departments" element={<DepartmentListPage />} />
          <Route path="departments/create" element={<DepartmentCreatePage />} />
          <Route path="departments/:departmentId" element={<DepartmentDetailPage />} />
          <Route path="departments/:departmentId/edit" element={<DepartmentEditPage />} />
          <Route path="profile" element={<MyProfilePage />} />
          <Route path="security/change-password" element={<ChangePasswordPage />} />
          <Route path="security/sessions" element={<MySessionsPage />} />
          <Route path="logs/login-history" element={<LoginHistoryPage />} />
          <Route path="logs/audit" element={<AuditLogsPage />} />
          <Route path="settings" element={<SystemSettingsPage />} />
        </Route>
        <Route path="/home" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsArticlePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
