import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PatientRoute, SuperAdminRoute, StaffRoute } from './RouteGuards';
import { createLoginRedirectPath, isPatientSession, isSuperAdminSession } from '../lib/authSession';
import { readStoredAuth } from '../lib/storage';
import { buildRecoveryPath, resolveRecoveryActorFromPath } from '../auth/recovery/recoveryUtils';
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
import { SpecialtiesPage } from '../home/pages/SpecialtiesPage';
import { DoctorsPage } from '../home/pages/DoctorsPage';
import { FaqPage } from '../home/pages/FaqPage';
import { NewsArticlePage, NewsPage } from '../home/pages/NewsPage';
import { ContactPage } from '../home/pages/ContactPage';
import { BankQrTestPage } from '../dev/BankQrTestPage';
import { StaffAccessPage } from '../receptionist/pages/StaffAccessPage';
import { DevPlaceholderPage } from '../receptionist/pages/DevPlaceholderPage';
import { ReceptionDashboardPage } from '../receptionist/pages/ReceptionDashboardPage';
import { StaffOverviewPage } from '../receptionist/pages/StaffOverviewPage';
import { UnauthorizedPage } from '../receptionist/pages/UnauthorizedPage';
import PatientPage from '../Patient Page';

import BillingWorkspace from '../BillingWorkspace';
import DoctorWorkspace from '../DoctorWorkspace';
import ClinicalOpsWorkspace from '../ClinicalOpsWorkspace';
import LabWorkspace from '../LabWorkspace';
import NurseWorkspace from '../NurseWorkspace';
import PharmacyWorkspace from '../PharmacyWorkspace';
import ReportsWorkspace from '../ReportsWorkspace';
import {
  ScheduleBulkCreatePage,
  ScheduleCreatePage,
  ScheduleDetailPage,
  SchedulingActivityPage,
  SchedulesByDepartmentPage,
  SchedulesByDoctorPage,
  SchedulingApprovalsPage,
  SchedulingCalendarPage,
  SchedulingConfigurationPage,
  SchedulingDashboardPage,
  SchedulingListPage,
  SchedulingShell,
  SchedulingSlotsPage,
  SchedulingTasksPage,
  SchedulingTodayPage,
  SchedulingUtilizationPage,
} from '../scheduling';

const devPlaceholderRoutes = [
  { path: '/security/overview', title: 'Bảo mật & phiên đăng nhập', workspaceKey: 'admin', guard: 'staff' },
  { path: '/settings/system', title: 'Cài đặt hệ thống', workspaceKey: 'admin', guard: 'staff' },
  { path: '/appointments', title: 'Lịch hẹn', workspaceKey: 'reception', guard: 'staff' },
  { path: '/schedules', title: 'Danh sách lịch khám', workspaceKey: 'scheduling', guard: 'staff' },
  { path: '/queue', title: 'Hàng đợi tiếp nhận', workspaceKey: 'reception', guard: 'staff' },
  { path: '/encounters', title: 'Cuộc khám', workspaceKey: 'doctor', guard: 'staff' },
  { path: '/patients', title: 'Danh sách bệnh nhân', workspaceKey: 'admin', guard: 'staff' },
  { path: '/audit-logs', title: 'Nhật ký kiểm toán', workspaceKey: 'admin', guard: 'staff' },
  { path: '/dev/ui-kit', title: 'Dev UI Kit', guard: 'super-admin' },
  { path: '/dev/routes', title: 'Dev Routes', guard: 'super-admin' },
  { path: '/dev/playground', title: 'Dev Playground', guard: 'super-admin' },
];

function PatientDashboardEntry() {
  const location = useLocation();
  const auth = readStoredAuth();

  if (isPatientSession(auth)) {
    return <PatientPage />;
  }

  if (isSuperAdminSession(auth)) {
    return <DevPlaceholderPage title="Cổng bệnh nhân / Người thân" route="/portal/dashboard" />;
  }

  return <Navigate to={createLoginRedirectPath(location)} replace />;
}

function RecoveryRouteRedirect({ mode }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const actorType = resolveRecoveryActorFromPath(location.pathname, searchParams);

  return (
    <Navigate
      to={buildRecoveryPath(actorType, mode, Object.fromEntries(searchParams.entries()))}
      replace
    />
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/bank-qr-test" element={<BankQrTestPage />} />
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/staff/change-password" element={<StaffRoute><ChangePasswordPage standalone /></StaffRoute>} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<RecoveryRouteRedirect mode="forgot" />} />
        <Route path="/reset-password" element={<RecoveryRouteRedirect mode="reset" />} />
        <Route path="/patient/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/staff/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/patient/reset-password" element={<ResetPasswordPage />} />
        <Route path="/staff/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/staff/access"
          element={
            <StaffRoute>
              <StaffAccessPage />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/select-workspace"
          element={
            <StaffRoute>
              <StaffAccessPage />
            </StaffRoute>
          }
        />
        <Route
          path="/super-admin/access"
          element={
            <SuperAdminRoute>
              <StaffAccessPage />
            </SuperAdminRoute>
          }
        />
        {devPlaceholderRoutes.map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={
              item.guard === 'staff' ? (
                <StaffRoute requiredWorkspaceKey={item.workspaceKey}>
                  <DevPlaceholderPage title={item.title} route={item.path} />
                </StaffRoute>
              ) : (
                <SuperAdminRoute>
                  <DevPlaceholderPage title={item.title} route={item.path} />
                </SuperAdminRoute>
              )
            }
          />
        ))}
        <Route
          path="/nurse/*"
          element={
            <StaffRoute requiredWorkspaceKey="nurse">
              <NurseWorkspace />
            </StaffRoute>
          }
        />
        <Route
          path="/clinical-ops/*"
          element={
            <StaffRoute requiredWorkspaceKey="lab">
              <ClinicalOpsWorkspace />
            </StaffRoute>
          }
        />
        <Route
          path="/lab/*"
          element={
            <StaffRoute requiredWorkspaceKey="lab">
              <LabWorkspace />
            </StaffRoute>
          }
        />
        <Route
          path="/billing/*"
          element={
            <StaffRoute requiredWorkspaceKey="billing">
              <BillingWorkspace />
            </StaffRoute>
          }
        />
        <Route
          path="/reports/*"
          element={
            <StaffRoute requiredWorkspaceKey="reports">
              <ReportsWorkspace />
            </StaffRoute>
          }
        />
        <Route
          path="/doctor/*"
          element={
            <StaffRoute requiredWorkspaceKey="doctor">
              <DoctorWorkspace />
            </StaffRoute>
          }
        />
        <Route
          path="/pharmacy/*"
          element={
            <StaffRoute requiredWorkspaceKey="pharmacy">
              <PharmacyWorkspace />
            </StaffRoute>
          }
        />
        <Route
          path="/prescriptions"
          element={
            <StaffRoute requiredWorkspaceKey="pharmacy">
              <Navigate to="/pharmacy/prescriptions/pending-dispense" replace />
            </StaffRoute>
          }
        />
        <Route
          path="/reception/dashboard"
          element={
            <StaffRoute requiredWorkspaceKey="reception">
              <ReceptionDashboardPage />
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
            <StaffRoute requiredWorkspaceKey="scheduling">
              <SchedulingShell />
            </StaffRoute>
          }
        >
          <Route index element={<Navigate to="/scheduling/dashboard" replace />} />
          <Route path="dashboard" element={<SchedulingDashboardPage />} />
          <Route path="tasks" element={<SchedulingTasksPage />} />
          <Route path="today" element={<SchedulingTodayPage />} />
          <Route path="schedules" element={<SchedulingListPage />} />
          <Route path="schedules/:scheduleId" element={<ScheduleDetailPage />} />
          <Route path="create" element={<ScheduleCreatePage />} />
          <Route path="bulk-create" element={<ScheduleBulkCreatePage />} />
          <Route path="approvals" element={<SchedulingApprovalsPage />} />
          <Route path="calendar" element={<SchedulingCalendarPage />} />
          <Route path="slots" element={<SchedulingSlotsPage />} />
          <Route path="utilization" element={<SchedulingUtilizationPage />} />
          <Route path="doctors" element={<SchedulesByDoctorPage />} />
          <Route path="departments" element={<SchedulesByDepartmentPage />} />
          <Route path="activity" element={<SchedulingActivityPage />} />
          <Route path="configuration" element={<SchedulingConfigurationPage />} />
          <Route path="configuration/templates" element={<SchedulingConfigurationPage />} />
          <Route path="configuration/policies" element={<SchedulingConfigurationPage />} />
          <Route path="configuration/exceptions" element={<SchedulingConfigurationPage />} />
          <Route path="configuration/telehealth" element={<SchedulingConfigurationPage />} />
          <Route path="configuration/notifications" element={<SchedulingConfigurationPage />} />
          <Route path="configuration/advanced" element={<SchedulingConfigurationPage />} />
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
          path="/portal"
          element={
            <PatientRoute>
              <PatientPage />
            </PatientRoute>
          }
        />
        <Route path="/portal/dashboard" element={<PatientDashboardEntry />} />
        <Route path="/patient/dashboard" element={<PatientDashboardEntry />} />
        <Route
          path="/admin"
          element={
            <StaffRoute requiredWorkspaceKey="admin">
              <AdminLayout />
            </StaffRoute>
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
        <Route path="/specialties" element={<SpecialtiesPage />} />
        <Route path="/doctors" element={<DoctorsPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsArticlePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
