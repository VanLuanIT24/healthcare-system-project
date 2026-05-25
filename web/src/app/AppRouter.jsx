import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PatientRoute, SuperAdminRoute, StaffRoute } from './RouteGuards';
import { createLoginRedirectPath, isPatientSession, isSuperAdminSession } from '../lib/authSession';
import { readStoredAuth } from '../lib/storage';
import { buildRecoveryPath, resolveRecoveryActorFromPath } from '../auth/recovery/recoveryUtils';
import { HealthcareChatbotLayer } from '../components/HealthcareChatbot';

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] || module.default })));
}

function RouteLoading() {
  return (
    <main className="app-route-loading" aria-live="polite">
      <span>Đang tải giao diện...</span>
    </main>
  );
}

const LoginPage = lazyNamed(() => import('../auth/pages/LoginPage'), 'LoginPage');
const RegisterPage = lazyNamed(() => import('../auth/pages/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyNamed(() => import('../auth/pages/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('../auth/pages/ResetPasswordPage'), 'ResetPasswordPage');
const StaffLoginPage = lazyNamed(() => import('../auth/pages/StaffLoginPage'), 'StaffLoginPage');
const BankQrTestPage = lazyNamed(() => import('../dev/BankQrTestPage'), 'BankQrTestPage');
const HomePage = lazyNamed(() => import('../home/HomePage'), 'HomePage');
const SupportPage = lazyNamed(() => import('../info/pages/SupportPage'), 'SupportPage');
const TermsPage = lazyNamed(() => import('../info/pages/TermsPage'), 'TermsPage');
const AboutPage = lazyNamed(() => import('../home/pages/AboutPage'), 'AboutPage');
const SpecialtiesPage = lazyNamed(() => import('../home/pages/SpecialtiesPage'), 'SpecialtiesPage');
const DoctorsPage = lazyNamed(() => import('../home/pages/DoctorsPage'), 'DoctorsPage');
const FaqPage = lazyNamed(() => import('../home/pages/FaqPage'), 'FaqPage');
const NewsPage = lazyNamed(() => import('../home/pages/NewsPage'), 'NewsPage');
const NewsArticlePage = lazyNamed(() => import('../home/pages/NewsPage'), 'NewsArticlePage');
const ContactPage = lazyNamed(() => import('../home/pages/ContactPage'), 'ContactPage');
const StaffAccessPage = lazyNamed(() => import('../receptionist/pages/StaffAccessPage'), 'StaffAccessPage');
const DevPlaceholderPage = lazyNamed(() => import('../receptionist/pages/DevPlaceholderPage'), 'DevPlaceholderPage');
const ReceptionDashboardPage = lazyNamed(() => import('../receptionist/pages/ReceptionDashboardPage'), 'ReceptionDashboardPage');
const StaffOverviewPage = lazyNamed(() => import('../receptionist/pages/StaffOverviewPage'), 'StaffOverviewPage');
const UnauthorizedPage = lazyNamed(() => import('../receptionist/pages/UnauthorizedPage'), 'UnauthorizedPage');
const PatientPage = lazy(() => import('../Patient Page'));
const BillingWorkspace = lazy(() => import('../BillingWorkspace'));
const DoctorWorkspace = lazy(() => import('../DoctorWorkspace'));
const ClinicalOpsWorkspace = lazy(() => import('../ClinicalOpsWorkspace'));
const LabWorkspace = lazy(() => import('../LabWorkspace'));
const NurseWorkspace = lazy(() => import('../NurseWorkspace'));
const PharmacyWorkspace = lazy(() => import('../PharmacyWorkspace'));
const ReportsWorkspace = lazy(() => import('../ReportsWorkspace'));
const CommandCenterPage = lazyNamed(() => import('../admin/command-center/CommandCenterPage'), 'CommandCenterPage');
const OperationsCenterPage = lazyNamed(() => import('../admin/operations/OperationsCenterPage'), 'OperationsCenterPage');
const IntegrationHubPage = lazyNamed(() => import('../admin/integrations/IntegrationHubPage'), 'IntegrationHubPage');
const PatientPortalAdminPage = lazyNamed(() => import('../admin/patient-portal/PatientPortalAdminPage'), 'PatientPortalAdminPage');
const SupportCommunicationPage = lazyNamed(() => import('../admin/support-communication/SupportCommunicationPage'), 'SupportCommunicationPage');
const ChatbotAdminPage = lazyNamed(() => import('../admin/chatbot/ChatbotAdminPage'), 'ChatbotAdminPage');
const AdminToolsPage = lazyNamed(() => import('../admin/admin-tools/AdminToolsPage'), 'AdminToolsPage');
const SecurityCenterPage = lazyNamed(() => import('../admin/security-center/pages/SecurityCenterPage'), 'SecurityCenterPage');
const AuditCompliancePage = lazyNamed(() => import('../admin/audit-compliance/pages/AuditCompliancePage'), 'AuditCompliancePage');
const AdminOverviewPage = lazyNamed(() => import('../admin/pages/AdminOverviewPage'), 'AdminOverviewPage');
const AdminLayout = lazyNamed(() => import('../admin/components/AdminLayout'), 'AdminLayout');
const StaffListPage = lazyNamed(() => import('../admin/staff/pages/StaffListPage'), 'StaffListPage');
const StaffCreatePage = lazyNamed(() => import('../admin/staff/pages/StaffCreatePage'), 'StaffCreatePage');
const StaffDetailPage = lazyNamed(() => import('../admin/staff/pages/StaffDetailPage'), 'StaffDetailPage');
const StaffEditPage = lazyNamed(() => import('../admin/staff/pages/StaffEditPage'), 'StaffEditPage');
const StaffOperationsPage = lazyNamed(() => import('../admin/staff/pages/StaffOperationsPage'), 'StaffOperationsPage');
const WorkspaceAccessControlPlanePage = lazyNamed(() => import('../admin/workspace-access/pages/WorkspaceAccessControlPlanePage'), 'WorkspaceAccessControlPlanePage');
const FacilityControlPlanePage = lazyNamed(() => import('../admin/facilities/pages/FacilityControlPlanePage'), 'FacilityControlPlanePage');
const MasterDataControlPlanePage = lazyNamed(() => import('../admin/master-data/pages/MasterDataControlPlanePage'), 'MasterDataControlPlanePage');
const RoleListPage = lazyNamed(() => import('../admin/roles/pages/RoleListPage'), 'RoleListPage');
const RoleCreatePage = lazyNamed(() => import('../admin/roles/pages/RoleFormPage'), 'RoleCreatePage');
const RoleEditPage = lazyNamed(() => import('../admin/roles/pages/RoleFormPage'), 'RoleEditPage');
const RoleDetailPage = lazyNamed(() => import('../admin/roles/pages/RoleDetailPage'), 'RoleDetailPage');
const RolePermissionsPage = lazyNamed(() => import('../admin/roles/pages/RolePermissionsPage'), 'RolePermissionsPage');
const PermissionListPage = lazyNamed(() => import('../admin/roles/pages/PermissionListPage'), 'PermissionListPage');
const PermissionCreatePage = lazyNamed(() => import('../admin/roles/pages/PermissionFormPage'), 'PermissionCreatePage');
const PermissionEditPage = lazyNamed(() => import('../admin/roles/pages/PermissionFormPage'), 'PermissionEditPage');
const PermissionDetailPage = lazyNamed(() => import('../admin/roles/pages/PermissionDetailPage'), 'PermissionDetailPage');
const IamControlPlanePage = lazyNamed(() => import('../admin/iam/pages/IamControlPlanePage'), 'IamControlPlanePage');
const DepartmentCreatePage = lazyNamed(() => import('../admin/system/pages/DepartmentFormPage'), 'DepartmentCreatePage');
const DepartmentEditPage = lazyNamed(() => import('../admin/system/pages/DepartmentFormPage'), 'DepartmentEditPage');
const DepartmentDetailPage = lazyNamed(() => import('../admin/system/pages/DepartmentDetailPage'), 'DepartmentDetailPage');
const MyProfilePage = lazyNamed(() => import('../admin/system/pages/MyProfilePage'), 'MyProfilePage');
const ChangePasswordPage = lazyNamed(() => import('../admin/system/pages/ChangePasswordPage'), 'ChangePasswordPage');
const MySessionsPage = lazyNamed(() => import('../admin/system/pages/MySessionsPage'), 'MySessionsPage');
const LoginHistoryPage = lazyNamed(() => import('../admin/system/pages/LoginHistoryPage'), 'LoginHistoryPage');
const SystemSettingsPage = lazyNamed(() => import('../admin/system/pages/SystemSettingsPage'), 'SystemSettingsPage');
const AppointmentCommandPage = lazyNamed(() => import('../scheduling'), 'AppointmentCommandPage');
const ActivityCommandPage = lazyNamed(() => import('../scheduling'), 'ActivityCommandPage');
const DoctorScheduleCommandPage = lazyNamed(() => import('../scheduling'), 'DoctorScheduleCommandPage');
const OperationsCommandPage = lazyNamed(() => import('../scheduling'), 'OperationsCommandPage');
const OperationalAlertPage = lazyNamed(() => import('../scheduling'), 'OperationalAlertPage');
const PatientFlowCommandPage = lazyNamed(() => import('../scheduling'), 'PatientFlowCommandPage');
const QueueCommandPage = lazyNamed(() => import('../scheduling'), 'QueueCommandPage');
const ReportCommandPage = lazyNamed(() => import('../scheduling'), 'ReportCommandPage');
const ResourceCommandPage = lazyNamed(() => import('../scheduling'), 'ResourceCommandPage');
const ScheduleBulkCreatePage = lazyNamed(() => import('../scheduling'), 'ScheduleBulkCreatePage');
const ScheduleCreatePage = lazyNamed(() => import('../scheduling'), 'ScheduleCreatePage');
const ScheduleDetailPage = lazyNamed(() => import('../scheduling'), 'ScheduleDetailPage');
const SchedulingApprovalsPage = lazyNamed(() => import('../scheduling'), 'SchedulingApprovalsPage');
const SchedulingCalendarPage = lazyNamed(() => import('../scheduling'), 'SchedulingCalendarPage');
const SchedulingListPage = lazyNamed(() => import('../scheduling'), 'SchedulingListPage');
const SchedulingSettingsCommandPage = lazyNamed(() => import('../scheduling'), 'SchedulingSettingsCommandPage');
const SchedulingShell = lazyNamed(() => import('../scheduling'), 'SchedulingShell');
const SchedulingTasksPage = lazyNamed(() => import('../scheduling'), 'SchedulingTasksPage');
const SlotCapacityCommandPage = lazyNamed(() => import('../scheduling'), 'SlotCapacityCommandPage');

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
      <Suspense fallback={<RouteLoading />}>
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
          <Route index element={<Navigate to="/scheduling/overview" replace />} />
          <Route path="overview" element={<OperationsCommandPage view="dashboard" />} />
          <Route path="dashboard" element={<OperationsCommandPage view="dashboard" />} />
          <Route path="tasks" element={<SchedulingTasksPage />} />
          <Route path="today" element={<OperationsCommandPage view="today" />} />
          <Route path="current-queue" element={<OperationsCommandPage view="queue" />} />
          <Route path="load" element={<OperationsCommandPage view="load" />} />
          <Route path="capacity" element={<OperationsCommandPage view="capacity" />} />
          <Route path="alerts" element={<OperationalAlertPage view="all" />} />
          <Route path="alerts/schedule-slot" element={<OperationalAlertPage view="scheduleSlot" />} />
          <Route path="alerts/queue" element={<OperationalAlertPage view="queue" />} />
          <Route path="alerts/doctor-department" element={<OperationalAlertPage view="doctorDepartment" />} />
          <Route path="alerts/no-show" element={<OperationalAlertPage view="noShow" />} />
          <Route path="alerts/action-center" element={<OperationalAlertPage view="actionCenter" />} />
          <Route path="appointments" element={<AppointmentCommandPage view="list" />} />
          <Route path="appointments/calendar" element={<AppointmentCommandPage view="calendar" />} />
          <Route path="appointments/create" element={<AppointmentCommandPage view="create" />} />
          <Route path="appointments/confirmation" element={<AppointmentCommandPage view="confirmation" />} />
          <Route path="appointments/reschedule-cancel" element={<AppointmentCommandPage view="reschedule" />} />
          <Route path="appointments/check-in" element={<AppointmentCommandPage view="checkIn" />} />
          <Route path="appointments/no-show" element={<AppointmentCommandPage view="noShow" />} />
          <Route path="appointments/waitlist" element={<AppointmentCommandPage view="waitlist" />} />
          <Route path="doctor-schedules" element={<DoctorScheduleCommandPage view="list" />} />
          <Route path="doctor-schedules/calendar" element={<DoctorScheduleCommandPage view="calendar" />} />
          <Route path="doctor-schedules/create" element={<DoctorScheduleCommandPage view="create" />} />
          <Route path="doctor-schedules/bulk-create" element={<DoctorScheduleCommandPage view="bulk" />} />
          <Route path="doctor-schedules/publish" element={<DoctorScheduleCommandPage view="publish" />} />
          <Route path="doctor-schedules/conflicts" element={<DoctorScheduleCommandPage view="conflicts" />} />
          <Route path="doctor-schedules/impact" element={<DoctorScheduleCommandPage view="impact" />} />
          <Route path="slots/generate" element={<SlotCapacityCommandPage view="generate" />} />
          <Route path="slots/blocking" element={<SlotCapacityCommandPage view="blocking" />} />
          <Route path="slots/import-export" element={<SlotCapacityCommandPage view="importExport" />} />
          <Route path="slots/utilization" element={<SlotCapacityCommandPage view="utilization" />} />
          <Route path="slots/activity" element={<SlotCapacityCommandPage view="activity" />} />
          <Route path="queue" element={<QueueCommandPage view="board" />} />
          <Route path="queue/today" element={<QueueCommandPage view="today" />} />
          <Route path="queue/call" element={<QueueCommandPage view="call" />} />
          <Route path="queue/transfer-priority" element={<QueueCommandPage view="transfer" />} />
          <Route path="queue/missed-no-show" element={<QueueCommandPage view="missed" />} />
          <Route path="queue/public-board" element={<QueueCommandPage view="public" />} />
          <Route path="patient-flow" element={<PatientFlowCommandPage view="board" />} />
          <Route path="patient-flow/check-in" element={<PatientFlowCommandPage view="checkIn" />} />
          <Route path="patient-flow/waiting" element={<PatientFlowCommandPage view="waiting" />} />
          <Route path="patient-flow/in-consultation" element={<PatientFlowCommandPage view="inConsultation" />} />
          <Route path="patient-flow/needs-action" element={<PatientFlowCommandPage view="needsAction" />} />
          <Route path="patient-flow/completed" element={<PatientFlowCommandPage view="completed" />} />
          <Route path="schedules" element={<SchedulingListPage />} />
          <Route path="schedules/:scheduleId" element={<ScheduleDetailPage />} />
          <Route path="create" element={<ScheduleCreatePage />} />
          <Route path="bulk-create" element={<ScheduleBulkCreatePage />} />
          <Route path="approvals" element={<SchedulingApprovalsPage />} />
          <Route path="calendar" element={<SchedulingCalendarPage />} />
          <Route path="slots" element={<SlotCapacityCommandPage view="board" />} />
          <Route path="utilization" element={<ReportCommandPage view="dashboard" />} />
          <Route path="doctors" element={<ResourceCommandPage view="doctors" />} />
          <Route path="departments" element={<ResourceCommandPage view="departments" />} />
          <Route path="rooms-locations" element={<ResourceCommandPage view="locations" />} />
          <Route path="doctor-load" element={<ResourceCommandPage view="doctorLoad" />} />
          <Route path="room-status" element={<ResourceCommandPage view="roomStatus" />} />
          <Route path="resources/attention" element={<ResourceCommandPage view="attention" />} />
          <Route path="reports" element={<ReportCommandPage view="dashboard" />} />
          <Route path="reports/appointments" element={<ReportCommandPage view="appointments" />} />
          <Route path="reports/queue" element={<ReportCommandPage view="queue" />} />
          <Route path="reports/utilization" element={<ReportCommandPage view="utilization" />} />
          <Route path="reports/no-show" element={<ReportCommandPage view="noShow" />} />
          <Route path="reports/export" element={<ReportCommandPage view="export" />} />
          <Route path="activity" element={<ActivityCommandPage view="all" />} />
          <Route path="activity/doctor-schedules" element={<ActivityCommandPage view="doctorSchedules" />} />
          <Route path="activity/appointments" element={<ActivityCommandPage view="appointments" />} />
          <Route path="activity/slots" element={<ActivityCommandPage view="slots" />} />
          <Route path="activity/queue" element={<ActivityCommandPage view="queue" />} />
          <Route path="activity/check-in" element={<ActivityCommandPage view="checkIn" />} />
          <Route path="configuration" element={<SchedulingSettingsCommandPage view="general" />} />
          <Route path="configuration/schedule-types" element={<SchedulingSettingsCommandPage view="scheduleTypes" />} />
          <Route path="configuration/templates" element={<SchedulingSettingsCommandPage view="templates" />} />
          <Route path="configuration/slot-rules" element={<SchedulingSettingsCommandPage view="slotRules" />} />
          <Route path="configuration/booking-rules" element={<SchedulingSettingsCommandPage view="bookingRules" />} />
          <Route path="configuration/check-in-rules" element={<SchedulingSettingsCommandPage view="checkInRules" />} />
          <Route path="configuration/cancel-reschedule-no-show" element={<SchedulingSettingsCommandPage view="cancelRules" />} />
          <Route path="configuration/queue-rules" element={<SchedulingSettingsCommandPage view="queueRules" />} />
          <Route path="configuration/policies" element={<SchedulingSettingsCommandPage view="bookingRules" />} />
          <Route path="configuration/exceptions" element={<SchedulingSettingsCommandPage view="exceptions" />} />
          <Route path="configuration/telehealth" element={<SchedulingSettingsCommandPage view="telehealth" />} />
          <Route path="configuration/notifications" element={<SchedulingSettingsCommandPage view="notifications" />} />
          <Route path="configuration/advanced" element={<SchedulingSettingsCommandPage view="advanced" />} />
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
          <Route index element={<Navigate to="/admin/command-center" replace />} />
          <Route path="command-center" element={<CommandCenterPage view="dashboard" />} />
          <Route path="command-center/health" element={<CommandCenterPage view="health" />} />
          <Route path="command-center/tasks" element={<CommandCenterPage view="tasks" />} />
          <Route path="command-center/system-alerts" element={<CommandCenterPage view="systemAlerts" />} />
          <Route path="command-center/security-alerts" element={<CommandCenterPage view="securityAlerts" />} />
          <Route path="command-center/recent-activity" element={<CommandCenterPage view="recentActivity" />} />
          <Route path="command-center/sessions" element={<CommandCenterPage view="sessions" />} />
          <Route path="command-center/workers" element={<CommandCenterPage view="workers" />} />
          <Route path="command-center/realtime" element={<CommandCenterPage view="realtime" />} />
          <Route path="command-center/workspace-map" element={<CommandCenterPage view="workspaceMap" />} />
          <Route path="operations" element={<OperationsCenterPage view="dashboard" />} />
          <Route path="operations/worker-health" element={<OperationsCenterPage view="workerHealth" />} />
          <Route path="operations/jobs" element={<OperationsCenterPage view="jobs" />} />
          <Route path="operations/job-runs" element={<OperationsCenterPage view="jobRuns" />} />
          <Route path="operations/event-outbox" element={<OperationsCenterPage view="eventOutbox" />} />
          <Route path="operations/dead-letter" element={<OperationsCenterPage view="deadLetter" />} />
          <Route path="operations/retry-event" element={<OperationsCenterPage view="retryEvent" />} />
          <Route path="operations/notification-delivery" element={<OperationsCenterPage view="notificationDelivery" />} />
          <Route path="operations/notification-failed" element={<OperationsCenterPage view="notificationFailed" />} />
          <Route path="operations/realtime" element={<OperationsCenterPage view="realtime" />} />
          <Route path="operations/socket-presence" element={<OperationsCenterPage view="socketPresence" />} />
          <Route path="operations/idempotency" element={<OperationsCenterPage view="idempotency" />} />
          <Route path="operations/qr-tokens" element={<OperationsCenterPage view="qrTokens" />} />
          <Route path="operations/file-scans" element={<OperationsCenterPage view="fileScans" />} />
          <Route path="operations/diagnostics" element={<OperationsCenterPage view="diagnostics" />} />
          <Route path="operations/maintenance" element={<OperationsCenterPage view="maintenance" />} />
          <Route path="integrations" element={<IntegrationHubPage view="overview" />} />
          <Route path="integrations/email-provider" element={<IntegrationHubPage view="emailProvider" />} />
          <Route path="integrations/push-provider" element={<IntegrationHubPage view="pushProvider" />} />
          <Route path="integrations/http-notification-channel" element={<IntegrationHubPage view="httpChannel" />} />
          <Route path="integrations/bank-qr-provider" element={<IntegrationHubPage view="bankQr" />} />
          <Route path="integrations/momo-personal-qr" element={<IntegrationHubPage view="momoQr" />} />
          <Route path="integrations/payment-webhook" element={<IntegrationHubPage view="paymentWebhook" />} />
          <Route path="integrations/provider-webhook-events" element={<IntegrationHubPage view="providerWebhookEvents" />} />
          <Route path="integrations/bank-statement-transactions" element={<IntegrationHubPage view="bankTransactions" />} />
          <Route path="integrations/reconciliation-provider" element={<IntegrationHubPage view="reconciliation" />} />
          <Route path="integrations/google-oauth" element={<IntegrationHubPage view="googleOAuth" />} />
          <Route path="integrations/integration-health" element={<IntegrationHubPage view="health" />} />
          <Route path="integrations/integration-logs" element={<IntegrationHubPage view="logs" />} />
          <Route path="patient-portal" element={<PatientPortalAdminPage view="dashboard" />} />
          <Route path="patient-portal/accounts" element={<PatientPortalAdminPage view="accounts" />} />
          <Route path="patient-portal/relatives" element={<PatientPortalAdminPage view="relatives" />} />
          <Route path="patient-portal/authorizations" element={<PatientPortalAdminPage view="authorizations" />} />
          <Route path="patient-portal/profile-field-policies" element={<PatientPortalAdminPage view="profilePolicies" />} />
          <Route path="patient-portal/profile-change-requests" element={<PatientPortalAdminPage view="profileChanges" />} />
          <Route path="patient-portal/documents" element={<PatientPortalAdminPage view="documents" />} />
          <Route path="patient-portal/document-exports" element={<PatientPortalAdminPage view="exports" />} />
          <Route path="patient-portal/insurance-submissions" element={<PatientPortalAdminPage view="insurance" />} />
          <Route path="patient-portal/feature-flags" element={<PatientPortalAdminPage view="featureFlags" />} />
          <Route path="patient-portal/audit" element={<PatientPortalAdminPage view="audit" />} />
          <Route path="support-communication" element={<Navigate to="/admin/support-communication/tickets" replace />} />
          <Route path="support-communication/tickets" element={<SupportCommunicationPage view="tickets" />} />
          <Route path="support-communication/sla" element={<SupportCommunicationPage view="sla" />} />
          <Route path="support-communication/technical" element={<SupportCommunicationPage view="technical" />} />
          <Route path="support-communication/account" element={<SupportCommunicationPage view="account" />} />
          <Route path="support-communication/billing" element={<SupportCommunicationPage view="billing" />} />
          <Route path="support-communication/conversations" element={<SupportCommunicationPage view="conversations" />} />
          <Route path="support-communication/ai-chatbot" element={<ChatbotAdminPage />} />
          <Route path="support-communication/system-messages" element={<SupportCommunicationPage view="systemMessages" />} />
          <Route path="support-communication/notifications" element={<SupportCommunicationPage view="notifications" />} />
          <Route path="support-communication/broadcast" element={<SupportCommunicationPage view="broadcast" />} />
          <Route path="support-communication/notification-templates" element={<SupportCommunicationPage view="notificationTemplates" />} />
          <Route path="support-communication/reply-templates" element={<SupportCommunicationPage view="replyTemplates" />} />
          <Route path="admin-tools" element={<AdminToolsPage view="overview" />} />
          <Route path="admin-tools/route-guards" element={<AdminToolsPage view="routeGuards" />} />
          <Route path="admin-tools/rbac-integrity" element={<AdminToolsPage view="rbacIntegrity" />} />
          <Route path="admin-tools/permission-map" element={<AdminToolsPage view="permissionMap" />} />
          <Route path="admin-tools/data-consistency" element={<AdminToolsPage view="dataConsistency" />} />
          <Route path="admin-tools/indexes" element={<AdminToolsPage view="indexes" />} />
          <Route path="admin-tools/system-access-sync" element={<AdminToolsPage view="systemAccessSync" />} />
          <Route path="admin-tools/migrations" element={<AdminToolsPage view="migrations" />} />
          <Route path="admin-tools/demo-data" element={<AdminToolsPage view="demoData" />} />
          <Route path="admin-tools/cleanup" element={<AdminToolsPage view="cleanup" />} />
          <Route path="admin-tools/cache" element={<AdminToolsPage view="cache" />} />
          <Route path="admin-tools/exports" element={<AdminToolsPage view="exports" />} />
          <Route path="admin-tools/developer-diagnostics" element={<AdminToolsPage view="developerDiagnostics" />} />
          <Route path="security-center" element={<Navigate to="/admin/security-center/dashboard" replace />} />
          <Route path="security-center/dashboard" element={<SecurityCenterPage view="dashboard" />} />
          <Route path="security-center/sessions" element={<SecurityCenterPage view="sessions" />} />
          <Route path="security-center/login-history" element={<SecurityCenterPage view="loginHistory" />} />
          <Route path="security-center/suspicious" element={<SecurityCenterPage view="suspicious" />} />
          <Route path="security-center/risky-accounts" element={<SecurityCenterPage view="riskyAccounts" />} />
          <Route path="security-center/token-risk" element={<SecurityCenterPage view="tokenRisk" />} />
          <Route path="security-center/rate-limit" element={<SecurityCenterPage view="rateLimit" />} />
          <Route path="security-center/break-glass" element={<SecurityCenterPage view="breakGlass" />} />
          <Route path="security-center/consent" element={<SecurityCenterPage view="consent" />} />
          <Route path="security-center/patient-authorization" element={<SecurityCenterPage view="patientAuthorization" />} />
          <Route path="security-center/access-authorization" element={<SecurityCenterPage view="accessAuthorization" />} />
          <Route path="security-center/sensitive-access" element={<SecurityCenterPage view="sensitiveAccess" />} />
          <Route path="security-center/data-policy" element={<SecurityCenterPage view="dataPolicy" />} />
          <Route path="security-center/bulk-revoke" element={<SecurityCenterPage view="bulkRevoke" />} />
          <Route path="audit-compliance" element={<Navigate to="/admin/audit-compliance/audit-log" replace />} />
          <Route path="audit-compliance/audit-log" element={<AuditCompliancePage view="auditLog" />} />
          <Route path="audit-compliance/actor" element={<AuditCompliancePage view="actor" />} />
          <Route path="audit-compliance/user" element={<AuditCompliancePage view="user" />} />
          <Route path="audit-compliance/object" element={<AuditCompliancePage view="object" />} />
          <Route path="audit-compliance/medical-record" element={<AuditCompliancePage view="medicalRecord" />} />
          <Route path="audit-compliance/iam" element={<AuditCompliancePage view="iam" />} />
          <Route path="audit-compliance/system-config" element={<AuditCompliancePage view="systemConfig" />} />
          <Route path="audit-compliance/payment" element={<AuditCompliancePage view="payment" />} />
          <Route path="audit-compliance/sensitive-access" element={<AuditCompliancePage view="sensitiveAccess" />} />
          <Route path="audit-compliance/break-glass" element={<AuditCompliancePage view="breakGlass" />} />
          <Route path="audit-compliance/export" element={<AuditCompliancePage view="exportAudit" />} />
          <Route path="audit-compliance/reports" element={<AuditCompliancePage view="reports" />} />
          <Route path="overview" element={<AdminOverviewPage />} />
          <Route path="staff" element={<StaffListPage />} />
          <Route path="staff/create" element={<StaffCreatePage />} />
          <Route path="staff/:staffId" element={<StaffDetailPage />} />
          <Route path="staff/:staffId/edit" element={<StaffEditPage />} />
          <Route path="system-control/organization/staff" element={<StaffListPage />} />
          <Route path="system-control/organization/staff/create" element={<StaffCreatePage />} />
          <Route path="system-control/organization/staff/:staffId" element={<StaffDetailPage />} />
          <Route path="system-control/organization/doctors" element={<Navigate to="/admin/staff?role=doctor" replace />} />
          <Route path="system-control/organization/pending-activation" element={<Navigate to="/admin/staff?status=pending_activation" replace />} />
          <Route path="system-control/organization/locked" element={<Navigate to="/admin/staff?status=locked" replace />} />
          <Route path="system-control/organization/disabled" element={<Navigate to="/admin/staff?status=disabled" replace />} />
          <Route path="system-control/organization/risk" element={<Navigate to="/admin/staff?risk=high" replace />} />
          <Route path="system-control/organization/departments" element={<Navigate to="/admin/facilities/staff" replace />} />
          <Route path="system-control/organization/transfers" element={<StaffOperationsPage mode="transfer" />} />
          <Route path="system-control/organization/password-reset" element={<StaffOperationsPage mode="passwordReset" />} />
          <Route path="system-control/organization/force-logout" element={<StaffOperationsPage mode="forceLogout" />} />
          <Route path="system-control/organization/login-history" element={<StaffOperationsPage mode="loginHistory" />} />
          <Route path="roles" element={<RoleListPage />} />
          <Route path="roles/create" element={<RoleCreatePage />} />
          <Route path="roles/:roleId" element={<RoleDetailPage />} />
          <Route path="roles/:roleId/edit" element={<RoleEditPage />} />
          <Route path="roles/:roleId/permissions" element={<RolePermissionsPage />} />
          <Route path="permissions" element={<PermissionListPage />} />
          <Route path="permissions/create" element={<PermissionCreatePage />} />
          <Route path="permissions/:permissionId" element={<PermissionDetailPage />} />
          <Route path="permissions/:permissionId/edit" element={<PermissionEditPage />} />
          <Route path="iam/overview" element={<IamControlPlanePage view="overview" />} />
          <Route path="iam/matrix" element={<IamControlPlanePage view="matrix" />} />
          <Route path="iam/assignment" element={<IamControlPlanePage view="assignment" />} />
          <Route path="iam/effective" element={<IamControlPlanePage view="effective" />} />
          <Route path="iam/access-check" element={<IamControlPlanePage view="accessCheck" />} />
          <Route path="iam/context" element={<IamControlPlanePage view="context" />} />
          <Route path="iam/cache" element={<IamControlPlanePage view="cache" />} />
          <Route path="iam/deny-permissions" element={<IamControlPlanePage view="denyPermissions" />} />
          <Route path="iam/deny-roles" element={<IamControlPlanePage view="denyRoles" />} />
          <Route path="iam/audit" element={<IamControlPlanePage view="audit" />} />
          <Route path="iam/seed" element={<IamControlPlanePage view="seed" />} />
          <Route path="workspace-access" element={<Navigate to="/admin/workspace-access/overview" replace />} />
          <Route path="workspace-access/overview" element={<WorkspaceAccessControlPlanePage view="overview" />} />
          <Route path="workspace-access/list" element={<WorkspaceAccessControlPlanePage view="list" />} />
          <Route path="workspace-access/actor" element={<WorkspaceAccessControlPlanePage view="actor" />} />
          <Route path="workspace-access/role" element={<WorkspaceAccessControlPlanePage view="role" />} />
          <Route path="workspace-access/user" element={<WorkspaceAccessControlPlanePage view="user" />} />
          <Route path="workspace-access/department" element={<WorkspaceAccessControlPlanePage view="department" />} />
          <Route path="workspace-access/policies" element={<WorkspaceAccessControlPlanePage view="policies" />} />
          <Route path="workspace-access/sidebar" element={<WorkspaceAccessControlPlanePage view="sidebar" />} />
          <Route path="workspace-access/navigation" element={<WorkspaceAccessControlPlanePage view="navigation" />} />
          <Route path="workspace-access/preferences" element={<WorkspaceAccessControlPlanePage view="preferences" />} />
          <Route path="workspace-access/check" element={<WorkspaceAccessControlPlanePage view="check" />} />
          <Route path="workspace-access/conflicts" element={<WorkspaceAccessControlPlanePage view="conflicts" />} />
          <Route path="workspace-access/diagnostics" element={<WorkspaceAccessControlPlanePage view="diagnostics" />} />
          <Route path="workspace-access/audit" element={<WorkspaceAccessControlPlanePage view="audit" />} />
          <Route path="facilities" element={<Navigate to="/admin/facilities/overview" replace />} />
          <Route path="facilities/overview" element={<FacilityControlPlanePage view="overview" />} />
          <Route path="facilities/departments" element={<FacilityControlPlanePage view="departments" />} />
          <Route path="facilities/departments/:departmentId" element={<FacilityControlPlanePage view="departmentProfile" />} />
          <Route path="facilities/heads" element={<FacilityControlPlanePage view="heads" />} />
          <Route path="facilities/staff" element={<FacilityControlPlanePage view="staff" />} />
          <Route path="facilities/profile" element={<FacilityControlPlanePage view="profile" />} />
          <Route path="facilities/locations" element={<FacilityControlPlanePage view="locations" />} />
          <Route path="facilities/reception" element={<FacilityControlPlanePage view="reception" />} />
          <Route path="facilities/lab" element={<FacilityControlPlanePage view="lab" />} />
          <Route path="facilities/imaging" element={<FacilityControlPlanePage view="imaging" />} />
          <Route path="facilities/procedure" element={<FacilityControlPlanePage view="procedure" />} />
          <Route path="facilities/warehouse" element={<FacilityControlPlanePage view="warehouse" />} />
          <Route path="facilities/status" element={<FacilityControlPlanePage view="status" />} />
          <Route path="facilities/bindings" element={<FacilityControlPlanePage view="bindings" />} />
          <Route path="master-data" element={<Navigate to="/admin/master-data/overview" replace />} />
          <Route path="master-data/overview" element={<MasterDataControlPlanePage view="overview" />} />
          <Route path="master-data/quality" element={<MasterDataControlPlanePage view="quality" />} />
          <Route path="master-data/services" element={<MasterDataControlPlanePage view="services" />} />
          <Route path="master-data/service-prices" element={<MasterDataControlPlanePage view="servicePrices" />} />
          <Route path="master-data/medications" element={<MasterDataControlPlanePage view="medications" />} />
          <Route path="master-data/medication-units" element={<MasterDataControlPlanePage view="medicationUnits" />} />
          <Route path="master-data/dosage-forms" element={<MasterDataControlPlanePage view="dosageForms" />} />
          <Route path="master-data/administration-routes" element={<MasterDataControlPlanePage view="administrationRoutes" />} />
          <Route path="master-data/suppliers" element={<MasterDataControlPlanePage view="suppliers" />} />
          <Route path="master-data/warehouses" element={<MasterDataControlPlanePage view="warehouses" />} />
          <Route path="master-data/storage-locations" element={<MasterDataControlPlanePage view="storageLocations" />} />
          <Route path="master-data/lab-tests" element={<MasterDataControlPlanePage view="labTests" />} />
          <Route path="master-data/specimen-types" element={<MasterDataControlPlanePage view="specimenTypes" />} />
          <Route path="master-data/imaging-catalog" element={<MasterDataControlPlanePage view="imagingCatalog" />} />
          <Route path="master-data/imaging-rooms" element={<MasterDataControlPlanePage view="imagingRooms" />} />
          <Route path="master-data/imaging-equipment" element={<MasterDataControlPlanePage view="imagingEquipment" />} />
          <Route path="master-data/procedures" element={<MasterDataControlPlanePage view="procedures" />} />
          <Route path="master-data/report-templates" element={<MasterDataControlPlanePage view="reportTemplates" />} />
          <Route path="master-data/schedule-types" element={<MasterDataControlPlanePage view="scheduleTypes" />} />
          <Route path="master-data/identifier-rules" element={<MasterDataControlPlanePage view="identifierRules" />} />
          <Route path="master-data/import-export" element={<MasterDataControlPlanePage view="importExport" />} />
          <Route path="master-data/change-requests" element={<MasterDataControlPlanePage view="changeRequests" />} />
          <Route path="master-data/audit" element={<MasterDataControlPlanePage view="audit" />} />
          <Route path="departments" element={<FacilityControlPlanePage view="departments" />} />
          <Route path="departments/create" element={<DepartmentCreatePage />} />
          <Route path="departments/:departmentId" element={<DepartmentDetailPage />} />
          <Route path="departments/:departmentId/edit" element={<DepartmentEditPage />} />
          <Route path="profile" element={<MyProfilePage />} />
          <Route path="security/change-password" element={<ChangePasswordPage />} />
          <Route path="security/sessions" element={<MySessionsPage />} />
          <Route path="logs/login-history" element={<LoginHistoryPage />} />
          <Route path="logs/audit" element={<AuditCompliancePage view="auditLog" />} />
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
      </Suspense>
      <HealthcareChatbotLayer />
    </BrowserRouter>
  );
}
