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
import { StaffAccessPage } from '../staff/pages/StaffAccessPage';
import { DevPlaceholderPage } from '../staff/pages/DevPlaceholderPage';
import { ReceptionDashboardPage } from '../staff/pages/ReceptionDashboardPage';
import { StaffOverviewPage } from '../staff/pages/StaffOverviewPage';
import { UnauthorizedPage } from '../staff/pages/UnauthorizedPage';
import PatientPage from '../Patient Page';
import ReceptionistDashboard from '../Receptionist';
import ReceptionistAppointmentsPage from '../Receptionist/ReceptionistAppointments';
import ReceptionistCreateAppointmentPage from '../Receptionist/ReceptionistCreateAppointment';
import ReceptionistWaitingListPage from '../Receptionist/ReceptionistWaitingList';
import ReceptionistQueueListPage from '../Receptionist/ReceptionistQueueList';
import ReceptionistPatientSearchPage from '../Receptionist/ReceptionistPatientSearch';
import ReceptionistAddPatientPage from '../Receptionist/ReceptionistAddPatient';
import ReceptionistPatientDetailPage from '../Receptionist/ReceptionistPatientDetail';
import ReceptionistPatientRecordsPage from '../Receptionist/ReceptionistPatientRecords';
import ReceptionistPatientRecordsDetailPage from '../Receptionist/ReceptionistPatientRecordsDetail';
import ReceptionistCashierPage from '../Receptionist/ReceptionistCashier';
import ReceptionistPaymentHistoryPage from '../Receptionist/ReceptionistPaymentHistory';
import ReceptionistDailyReportPage from '../Receptionist/ReceptionistDailyReport';
import ReceptionistProductivityPage from '../Receptionist/ReceptionistProductivity';
import ReceptionistSystemSettingsPage from '../Receptionist/ReceptionistSystemSettings';
import ReceptionistAccountPage from '../Receptionist/ReceptionistAccount';
import DoctorWorkspace from '../DoctorWorkspace';
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
  { path: '/nurse/dashboard', title: 'Điều dưỡng', workspaceKey: 'nurse', guard: 'staff' },
  { path: '/pharmacy/dashboard', title: 'Nhà thuốc', workspaceKey: 'pharmacy', guard: 'staff' },
  { path: '/lab/dashboard', title: 'Xét nghiệm & CĐHA', workspaceKey: 'lab', guard: 'staff' },
  { path: '/lab/orders', title: 'Chỉ định xét nghiệm & CĐHA', workspaceKey: 'lab', guard: 'staff' },
  { path: '/billing/dashboard', title: 'Viện phí & thanh toán', workspaceKey: 'billing', guard: 'staff' },
  { path: '/billing/invoices', title: 'Hóa đơn viện phí', workspaceKey: 'billing', guard: 'staff' },
  { path: '/reports/dashboard', title: 'Báo cáo & phân tích', workspaceKey: 'reports', guard: 'staff' },
  { path: '/security/overview', title: 'Bảo mật & phiên đăng nhập', workspaceKey: 'admin', guard: 'staff' },
  { path: '/settings/system', title: 'Cài đặt hệ thống', workspaceKey: 'admin', guard: 'staff' },
  { path: '/appointments', title: 'Lịch hẹn', workspaceKey: 'reception', guard: 'staff' },
  { path: '/schedules', title: 'Danh sách lịch khám', workspaceKey: 'scheduling', guard: 'staff' },
  { path: '/queue', title: 'Hàng đợi tiếp nhận', workspaceKey: 'reception', guard: 'staff' },
  { path: '/encounters', title: 'Cuộc khám', workspaceKey: 'doctor', guard: 'staff' },
  { path: '/prescriptions', title: 'Đơn thuốc', workspaceKey: 'pharmacy', guard: 'staff' },
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
    return <DevPlaceholderPage title="Bệnh nhân" route="/patient/dashboard" />;
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
          path="/doctor/*"
          element={
            <StaffRoute requiredWorkspaceKey="doctor">
              <DoctorWorkspace />
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
          path="/receptionist"
          element={
            <StaffRoute>
              <ReceptionistDashboard />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/appointments"
          element={
            <StaffRoute>
              <ReceptionistAppointmentsPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/create"
          element={
            <StaffRoute>
              <ReceptionistCreateAppointmentPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/waiting-list"
          element={
            <StaffRoute>
              <ReceptionistWaitingListPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/queue"
          element={
            <StaffRoute>
              <ReceptionistQueueListPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/patients"
          element={
            <StaffRoute>
              <ReceptionistPatientSearchPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/patients/add"
          element={
            <StaffRoute>
              <ReceptionistAddPatientPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/patients/:patientId"
          element={
            <StaffRoute>
              <ReceptionistPatientDetailPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/patient-records"
          element={
            <StaffRoute>
              <ReceptionistPatientRecordsPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/patient-records/:patientId"
          element={
            <StaffRoute>
              <ReceptionistPatientRecordsDetailPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/cashier"
          element={
            <StaffRoute>
              <ReceptionistCashierPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/payment-history"
          element={
            <StaffRoute>
              <ReceptionistPaymentHistoryPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/daily-report"
          element={
            <StaffRoute>
              <ReceptionistDailyReportPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/productivity"
          element={
            <StaffRoute>
              <ReceptionistProductivityPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/settings"
          element={
            <StaffRoute>
              <ReceptionistSystemSettingsPage />
            </StaffRoute>
          }
        />
        <Route
          path="/receptionist/account"
          element={
            <StaffRoute>
              <ReceptionistAccountPage />
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
