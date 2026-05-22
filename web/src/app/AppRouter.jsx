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
import { CommandCenterPage } from '../admin/command-center/CommandCenterPage';
import { OperationsCenterPage } from '../admin/operations/OperationsCenterPage';
import { IntegrationHubPage } from '../admin/integrations/IntegrationHubPage';
import { PatientPortalAdminPage } from '../admin/patient-portal/PatientPortalAdminPage';
import { SupportCommunicationPage } from '../admin/support-communication/SupportCommunicationPage';
import { AdminToolsPage } from '../admin/admin-tools/AdminToolsPage';
import { SecurityCenterPage } from '../admin/security-center/pages/SecurityCenterPage';
import { AuditCompliancePage } from '../admin/audit-compliance/pages/AuditCompliancePage';
import { AdminOverviewPage } from '../admin/pages/AdminOverviewPage';
import { AdminLayout } from '../admin/components/AdminLayout';
import { StaffListPage } from '../admin/staff/pages/StaffListPage';
import { StaffCreatePage } from '../admin/staff/pages/StaffCreatePage';
import { StaffDetailPage } from '../admin/staff/pages/StaffDetailPage';
import { StaffEditPage } from '../admin/staff/pages/StaffEditPage';
import { StaffOperationsPage } from '../admin/staff/pages/StaffOperationsPage';
import { WorkspaceAccessControlPlanePage } from '../admin/workspace-access/pages/WorkspaceAccessControlPlanePage';
import { FacilityControlPlanePage } from '../admin/facilities/pages/FacilityControlPlanePage';
import { MasterDataControlPlanePage } from '../admin/master-data/pages/MasterDataControlPlanePage';
import { RoleListPage } from '../admin/roles/pages/RoleListPage';
import { RoleCreatePage, RoleEditPage } from '../admin/roles/pages/RoleFormPage';
import { RoleDetailPage } from '../admin/roles/pages/RoleDetailPage';
import { RolePermissionsPage } from '../admin/roles/pages/RolePermissionsPage';
import { PermissionListPage } from '../admin/roles/pages/PermissionListPage';
import { PermissionCreatePage, PermissionEditPage } from '../admin/roles/pages/PermissionFormPage';
import { PermissionDetailPage } from '../admin/roles/pages/PermissionDetailPage';
import { IamControlPlanePage } from '../admin/iam/pages/IamControlPlanePage';
import { DepartmentListPage } from '../admin/system/pages/DepartmentListPage';
import { DepartmentCreatePage, DepartmentEditPage } from '../admin/system/pages/DepartmentFormPage';
import { DepartmentDetailPage } from '../admin/system/pages/DepartmentDetailPage';
import { MyProfilePage } from '../admin/system/pages/MyProfilePage';
import { ChangePasswordPage } from '../admin/system/pages/ChangePasswordPage';
import { MySessionsPage } from '../admin/system/pages/MySessionsPage';
import { LoginHistoryPage } from '../admin/system/pages/LoginHistoryPage';
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
    </BrowserRouter>
  );
}
