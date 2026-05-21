import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ReportsShell } from './ReportsShell';
import { flattenReportsMenu, getReportsPageMeta } from './reportsData';
import './reports.css';
import {
  ActionItemsPage,
  AnomalyAlertsPage,
  ComparisonPage,
  ExecutiveDashboardPage,
  KpiPeriodPage,
  KpiTodayPage,
  TrendsPage,
} from '../features/reports-overview/pages/ExecutiveOverviewPages';
import {
  OperationsAppointmentsPage,
  OperationsCheckInPage,
  OperationsDepartmentLoadPage,
  OperationsEncountersPage,
  OperationsNoShowPage,
  OperationsPatientFlowPage,
  OperationsQueuePage,
  OperationsSlotEfficiencyPage,
  OperationsWaitTimePage,
} from '../features/reports-operations/pages/OperationsPages';
import {
  DepartmentAppointmentsPage,
  DepartmentLoadPage,
  DepartmentPerformancePage,
  DepartmentQueuePage,
  DepartmentRevenuePage,
  DepartmentStaffPage,
  DoctorNoShowPage,
  DoctorPerformancePage,
  DoctorUtilizationPage,
  FollowUpPage,
  PersonalReportPage,
} from '../features/reports-departments-doctors/pages/DepartmentsDoctorsPages';
import {
  AccountsReceivablePage,
  ArAgingPage,
  FinanceDashboardPage,
  FinanceInvoicesPage,
  FinancePaymentsPage,
  FinanceRevenuePage,
  InsurancePage,
  PaymentMethodsPage,
  ReconciliationPage,
  RefundVoidPage,
} from '../features/reports-finance/pages/FinancePages';
import {
  CriticalResultsPage,
  DiagnosticsOverviewPage,
  ImagingOrdersPage,
  ImagingTurnaroundTimePage,
  LabOrdersPage,
  LabTurnaroundTimePage,
  OverdueOrdersPage,
  ProcedureOrdersPage,
  ReportPendingPage,
  SpecimensPage,
} from '../features/reports-diagnostics/pages/DiagnosticsPages';
import {
  PharmacyDashboardPage,
  PharmacyDispensingPage,
  PharmacyExpiredRecalledBatchesPage,
  PharmacyExpiringBatchesPage,
  PharmacyInventoryPage,
  PharmacyInventoryValuePage,
  PharmacyLowStockPage,
  PharmacyMovementPage,
  PharmacyPrescriptionsPage,
  PharmacyTurnoverPage,
} from '../features/reports-pharmacy/pages/PharmacyPages';
import {
  AdmissionsPage,
  BedOccupancyPage,
  BedTurnoverPage,
  CaseResolutionPage,
  DischargesPage,
  EmergencyCasesPage,
  InpatientTasksPage,
  LengthOfStayPage,
  ResponseTimePage,
} from '../features/reports-inpatient-emergency/pages/InpatientEmergencyPages';
import {
  BreakGlassPage,
  ComplaintsRatingsPage,
  CriticalAlertsPage as QualityCriticalAlertsPage,
  JobFailurePage,
  NotificationDeliveryPage,
  QualityRiskDashboardPage,
  SecurityAuditPage,
  SensitiveAccessPage,
  SlaPage,
  SupportTicketsPage,
} from '../features/reports-quality-risk/pages/QualityRiskPages';
import {
  AttachmentsPage,
  DocumentTimelinePage,
  FinalizedRecordsPage,
  MedicalRecordsPage,
  RecordExportsPage,
  ReleasedRecordsPage,
  VoidArchivePage,
} from '../features/reports-records-documents/pages/RecordsDocumentsPages';
import {
  CustomChartsPage,
  CustomColumnsPage,
  CustomFiltersPage,
  DatasetsPage,
  MyReportsPage,
  PinnedReportsPage,
  ReportBuilderPage,
  SharedReportsPage,
} from '../features/reports-custom/pages/CustomReportPages';
import {
  CsvExportPage,
  ExcelExportPage,
  ExportHistoryPage,
  ExportSchedulesPage,
  FailedExportsPage,
  PdfExportPage,
  ProcessingExportsPage,
  SavedReportsPage as ExportSavedReportsPage,
} from '../features/reports-exports/pages/ReportsExportsPages';

const reportsRoutes = flattenReportsMenu()
  .filter((item) => !item.to.startsWith('/reports/overview/'))
  .filter((item) => !item.to.startsWith('/reports/operations/'))
  .filter((item) => !item.to.startsWith('/reports/departments-doctors/'))
  .filter((item) => !item.to.startsWith('/reports/finance/'))
  .filter((item) => !item.to.startsWith('/reports/diagnostics/'))
  .filter((item) => !item.to.startsWith('/reports/pharmacy/'))
  .filter((item) => !item.to.startsWith('/reports/inpatient-emergency/'))
  .filter((item) => !item.to.startsWith('/reports/quality-risk/'))
  .filter((item) => !item.to.startsWith('/reports/records-documents/'))
  .filter((item) => !item.to.startsWith('/reports/custom/'))
  .filter((item) => !item.to.startsWith('/reports/exports/'))
  .map((item) => ({
    ...item,
    routePath: item.to.replace('/reports/', ''),
  }));

function ReportsTitleScreen({ item }) {
  const Icon = item.icon;

  return (
    <section className="reports-title-screen" aria-labelledby="reports-page-title">
      <div className="reports-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.2} />
      </div>
      <div>
        <span>{item.sectionLabel}</span>
        <h1 id="reports-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function ReportsFallbackScreen() {
  const location = useLocation();
  return <ReportsTitleScreen item={getReportsPageMeta(location.pathname)} />;
}

export default function ReportsWorkspace() {
  return (
    <ReportsShell>
      <Routes>
        <Route index element={<Navigate to="overview/dashboard" replace />} />
        <Route path="dashboard" element={<Navigate to="overview/dashboard" replace />} />
        <Route path="executive-overview/today-metrics" element={<Navigate to="/reports/overview/kpi-today" replace />} />
        <Route path="executive-overview/week-month-metrics" element={<Navigate to="/reports/overview/kpi-period" replace />} />
        <Route path="executive-overview/previous-period-comparison" element={<Navigate to="/reports/overview/comparison" replace />} />
        <Route path="executive-overview/abnormal-alerts" element={<Navigate to="/reports/overview/anomaly-alerts" replace />} />
        <Route path="executive-overview/key-trends" element={<Navigate to="/reports/overview/trends" replace />} />
        <Route path="executive-overview/attention-items" element={<Navigate to="/reports/overview/action-items" replace />} />
        <Route path="overview/dashboard" element={<ExecutiveDashboardPage />} />
        <Route path="overview/kpi-today" element={<KpiTodayPage />} />
        <Route path="overview/kpi-period" element={<KpiPeriodPage />} />
        <Route path="overview/comparison" element={<ComparisonPage />} />
        <Route path="overview/anomaly-alerts" element={<AnomalyAlertsPage />} />
        <Route path="overview/trends" element={<TrendsPage />} />
        <Route path="overview/action-items" element={<ActionItemsPage />} />
        <Route path="clinical-operations/visits-encounters" element={<Navigate to="/reports/operations/encounters" replace />} />
        <Route path="clinical-operations/appointments" element={<Navigate to="/reports/operations/appointments" replace />} />
        <Route path="clinical-operations/check-in" element={<Navigate to="/reports/operations/check-in" replace />} />
        <Route path="clinical-operations/queue" element={<Navigate to="/reports/operations/queue" replace />} />
        <Route path="clinical-operations/no-show" element={<Navigate to="/reports/operations/no-show" replace />} />
        <Route path="clinical-operations/waiting-time" element={<Navigate to="/reports/operations/wait-time" replace />} />
        <Route path="clinical-operations/department-room-load" element={<Navigate to="/reports/operations/department-load" replace />} />
        <Route path="clinical-operations/slot-efficiency" element={<Navigate to="/reports/operations/slot-efficiency" replace />} />
        <Route path="clinical-operations/patient-flow" element={<Navigate to="/reports/operations/patient-flow" replace />} />
        <Route path="operations/encounters" element={<OperationsEncountersPage />} />
        <Route path="operations/appointments" element={<OperationsAppointmentsPage />} />
        <Route path="operations/check-in" element={<OperationsCheckInPage />} />
        <Route path="operations/queue" element={<OperationsQueuePage />} />
        <Route path="operations/no-show" element={<OperationsNoShowPage />} />
        <Route path="operations/wait-time" element={<OperationsWaitTimePage />} />
        <Route path="operations/department-load" element={<OperationsDepartmentLoadPage />} />
        <Route path="operations/slot-efficiency" element={<OperationsSlotEfficiencyPage />} />
        <Route path="operations/patient-flow" element={<OperationsPatientFlowPage />} />
        <Route path="departments-doctors/department-performance" element={<DepartmentPerformancePage />} />
        <Route path="departments-doctors/department-load" element={<DepartmentLoadPage />} />
        <Route path="departments-doctors/department-appointments" element={<DepartmentAppointmentsPage />} />
        <Route path="departments-doctors/department-queue" element={<DepartmentQueuePage />} />
        <Route path="departments-doctors/department-revenue" element={<DepartmentRevenuePage />} />
        <Route path="departments-doctors/department-staff" element={<DepartmentStaffPage />} />
        <Route path="departments-doctors/doctor-performance" element={<DoctorPerformancePage />} />
        <Route path="departments-doctors/doctor-utilization" element={<DoctorUtilizationPage />} />
        <Route path="departments-doctors/doctor-no-show" element={<DoctorNoShowPage />} />
        <Route path="departments-doctors/follow-up" element={<FollowUpPage />} />
        <Route path="departments-doctors/personal-report" element={<PersonalReportPage />} />
        <Route path="finance-billing/dashboard" element={<Navigate to="/reports/finance/dashboard" replace />} />
        <Route path="finance-billing/revenue" element={<Navigate to="/reports/finance/revenue" replace />} />
        <Route path="finance-billing/debt" element={<Navigate to="/reports/finance/accounts-receivable" replace />} />
        <Route path="finance-billing/debt-aging" element={<Navigate to="/reports/finance/ar-aging" replace />} />
        <Route path="finance-billing/invoices" element={<Navigate to="/reports/finance/invoices" replace />} />
        <Route path="finance-billing/payments" element={<Navigate to="/reports/finance/payments" replace />} />
        <Route path="finance-billing/payment-method" element={<Navigate to="/reports/finance/payment-methods" replace />} />
        <Route path="finance-billing/refund-void" element={<Navigate to="/reports/finance/refund-void" replace />} />
        <Route path="finance-billing/reconciliation" element={<Navigate to="/reports/finance/reconciliation" replace />} />
        <Route path="finance-billing/insurance" element={<Navigate to="/reports/finance/insurance" replace />} />
        <Route path="finance/dashboard" element={<FinanceDashboardPage />} />
        <Route path="finance/revenue" element={<FinanceRevenuePage />} />
        <Route path="finance/accounts-receivable" element={<AccountsReceivablePage />} />
        <Route path="finance/ar-aging" element={<ArAgingPage />} />
        <Route path="finance/invoices" element={<FinanceInvoicesPage />} />
        <Route path="finance/payments" element={<FinancePaymentsPage />} />
        <Route path="finance/payment-methods" element={<PaymentMethodsPage />} />
        <Route path="finance/refund-void" element={<RefundVoidPage />} />
        <Route path="finance/reconciliation" element={<ReconciliationPage />} />
        <Route path="finance/insurance" element={<InsurancePage />} />
        <Route path="clinical-services/overview" element={<Navigate to="/reports/diagnostics/overview" replace />} />
        <Route path="clinical-services/lab-orders" element={<Navigate to="/reports/diagnostics/lab-orders" replace />} />
        <Route path="clinical-services/lab-turnaround-time" element={<Navigate to="/reports/diagnostics/lab-turnaround-time" replace />} />
        <Route path="clinical-services/specimen-report" element={<Navigate to="/reports/diagnostics/specimens" replace />} />
        <Route path="clinical-services/imaging-orders" element={<Navigate to="/reports/diagnostics/imaging-orders" replace />} />
        <Route path="clinical-services/imaging-turnaround-time" element={<Navigate to="/reports/diagnostics/imaging-turnaround-time" replace />} />
        <Route path="clinical-services/report-pending" element={<Navigate to="/reports/diagnostics/report-pending" replace />} />
        <Route path="clinical-services/critical-results" element={<Navigate to="/reports/diagnostics/critical-results" replace />} />
        <Route path="clinical-services/procedure-orders" element={<Navigate to="/reports/diagnostics/procedure-orders" replace />} />
        <Route path="clinical-services/overdue-orders" element={<Navigate to="/reports/diagnostics/overdue-orders" replace />} />
        <Route path="diagnostics/overview" element={<DiagnosticsOverviewPage />} />
        <Route path="diagnostics/lab-orders" element={<LabOrdersPage />} />
        <Route path="diagnostics/lab-turnaround-time" element={<LabTurnaroundTimePage />} />
        <Route path="diagnostics/specimens" element={<SpecimensPage />} />
        <Route path="diagnostics/imaging-orders" element={<ImagingOrdersPage />} />
        <Route path="diagnostics/imaging-turnaround-time" element={<ImagingTurnaroundTimePage />} />
        <Route path="diagnostics/report-pending" element={<ReportPendingPage />} />
        <Route path="diagnostics/critical-results" element={<CriticalResultsPage />} />
        <Route path="diagnostics/procedure-orders" element={<ProcedureOrdersPage />} />
        <Route path="diagnostics/overdue-orders" element={<OverdueOrdersPage />} />
        <Route path="pharmacy-inventory/dashboard" element={<Navigate to="/reports/pharmacy/dashboard" replace />} />
        <Route path="pharmacy-inventory/stock" element={<Navigate to="/reports/pharmacy/inventory" replace />} />
        <Route path="pharmacy-inventory/stock-movement" element={<Navigate to="/reports/pharmacy/movement" replace />} />
        <Route path="pharmacy-inventory/low-stock" element={<Navigate to="/reports/pharmacy/low-stock" replace />} />
        <Route path="pharmacy-inventory/expiring-batches" element={<Navigate to="/reports/pharmacy/expiring-batches" replace />} />
        <Route path="pharmacy-inventory/expired-recalled-batches" element={<Navigate to="/reports/pharmacy/expired-recalled-batches" replace />} />
        <Route path="pharmacy-inventory/dispensing" element={<Navigate to="/reports/pharmacy/dispensing" replace />} />
        <Route path="pharmacy-inventory/prescriptions" element={<Navigate to="/reports/pharmacy/prescriptions" replace />} />
        <Route path="pharmacy-inventory/stock-value" element={<Navigate to="/reports/pharmacy/inventory-value" replace />} />
        <Route path="pharmacy-inventory/stock-turnover" element={<Navigate to="/reports/pharmacy/turnover" replace />} />
        <Route path="pharmacy/dashboard" element={<PharmacyDashboardPage />} />
        <Route path="pharmacy/inventory" element={<PharmacyInventoryPage />} />
        <Route path="pharmacy/movement" element={<PharmacyMovementPage />} />
        <Route path="pharmacy/low-stock" element={<PharmacyLowStockPage />} />
        <Route path="pharmacy/expiring-batches" element={<PharmacyExpiringBatchesPage />} />
        <Route path="pharmacy/expired-recalled-batches" element={<PharmacyExpiredRecalledBatchesPage />} />
        <Route path="pharmacy/dispensing" element={<PharmacyDispensingPage />} />
        <Route path="pharmacy/prescriptions" element={<PharmacyPrescriptionsPage />} />
        <Route path="pharmacy/inventory-value" element={<PharmacyInventoryValuePage />} />
        <Route path="pharmacy/turnover" element={<PharmacyTurnoverPage />} />
        <Route path="inpatient-emergency/admissions" element={<AdmissionsPage />} />
        <Route path="inpatient-emergency/discharges" element={<DischargesPage />} />
        <Route path="inpatient-emergency/discharge" element={<Navigate to="/reports/inpatient-emergency/discharges" replace />} />
        <Route path="inpatient-emergency/bed-occupancy" element={<BedOccupancyPage />} />
        <Route path="inpatient-emergency/bed-turnover" element={<BedTurnoverPage />} />
        <Route path="inpatient-emergency/length-of-stay" element={<LengthOfStayPage />} />
        <Route path="inpatient-emergency/inpatient-tasks" element={<InpatientTasksPage />} />
        <Route path="inpatient-emergency/emergency-cases" element={<EmergencyCasesPage />} />
        <Route path="inpatient-emergency/response-time" element={<ResponseTimePage />} />
        <Route path="inpatient-emergency/case-resolution" element={<CaseResolutionPage />} />
        <Route path="quality-risk/dashboard" element={<QualityRiskDashboardPage />} />
        <Route path="quality-risk/critical-alerts" element={<QualityCriticalAlertsPage />} />
        <Route path="quality-risk/break-glass" element={<BreakGlassPage />} />
        <Route path="quality-risk/break-glass-report" element={<Navigate to="/reports/quality-risk/break-glass" replace />} />
        <Route path="quality-risk/sensitive-access" element={<SensitiveAccessPage />} />
        <Route path="quality-risk/audit-sensitive-access" element={<Navigate to="/reports/quality-risk/sensitive-access" replace />} />
        <Route path="quality-risk/security-audit" element={<SecurityAuditPage />} />
        <Route path="quality-risk/login-security-audit" element={<Navigate to="/reports/quality-risk/security-audit" replace />} />
        <Route path="quality-risk/support-tickets" element={<SupportTicketsPage />} />
        <Route path="quality-risk/complaints-ratings" element={<ComplaintsRatingsPage />} />
        <Route path="quality-risk/complaint-rating" element={<Navigate to="/reports/quality-risk/complaints-ratings" replace />} />
        <Route path="quality-risk/sla" element={<SlaPage />} />
        <Route path="quality-risk/service-commitment" element={<Navigate to="/reports/quality-risk/sla" replace />} />
        <Route path="quality-risk/job-failure" element={<JobFailurePage />} />
        <Route path="quality-risk/notification-delivery" element={<NotificationDeliveryPage />} />
        <Route path="medical-records/records" element={<Navigate to="/reports/records-documents/medical-records" replace />} />
        <Route path="medical-records/finalized" element={<Navigate to="/reports/records-documents/finalized-records" replace />} />
        <Route path="medical-records/released" element={<Navigate to="/reports/records-documents/released-records" replace />} />
        <Route path="medical-records/void-archive" element={<Navigate to="/reports/records-documents/void-archive" replace />} />
        <Route path="medical-records/attachment-report" element={<Navigate to="/reports/records-documents/attachments" replace />} />
        <Route path="medical-records/export" element={<Navigate to="/reports/records-documents/exports" replace />} />
        <Route path="medical-records/document-timeline" element={<Navigate to="/reports/records-documents/timeline" replace />} />
        <Route path="records-documents/medical-records" element={<MedicalRecordsPage />} />
        <Route path="records-documents/finalized-records" element={<FinalizedRecordsPage />} />
        <Route path="records-documents/released-records" element={<ReleasedRecordsPage />} />
        <Route path="records-documents/void-archive" element={<VoidArchivePage />} />
        <Route path="records-documents/attachments" element={<AttachmentsPage />} />
        <Route path="records-documents/exports" element={<RecordExportsPage />} />
        <Route path="records-documents/timeline" element={<DocumentTimelinePage />} />
        <Route path="custom/builder" element={<ReportBuilderPage />} />
        <Route path="custom/datasets" element={<DatasetsPage />} />
        <Route path="custom/dataset" element={<Navigate to="/reports/custom/datasets" replace />} />
        <Route path="custom/filters" element={<CustomFiltersPage />} />
        <Route path="custom/columns" element={<CustomColumnsPage />} />
        <Route path="custom/display-columns" element={<Navigate to="/reports/custom/columns" replace />} />
        <Route path="custom/charts" element={<CustomChartsPage />} />
        <Route path="custom/my-reports" element={<MyReportsPage />} />
        <Route path="custom/shared" element={<SharedReportsPage />} />
        <Route path="custom/shared-reports" element={<Navigate to="/reports/custom/shared" replace />} />
        <Route path="custom/pinned" element={<PinnedReportsPage />} />
        <Route path="custom/pinned-reports" element={<Navigate to="/reports/custom/pinned" replace />} />
        <Route path="exports/csv" element={<CsvExportPage />} />
        <Route path="exports/excel" element={<ExcelExportPage />} />
        <Route path="exports/pdf" element={<PdfExportPage />} />
        <Route path="exports/history" element={<ExportHistoryPage />} />
        <Route path="exports/processing" element={<ProcessingExportsPage />} />
        <Route path="exports/failed" element={<FailedExportsPage />} />
        <Route path="exports/schedules" element={<ExportSchedulesPage />} />
        <Route path="exports/saved" element={<ExportSavedReportsPage />} />
        <Route path="exports/saved-reports" element={<Navigate to="/reports/exports/saved" replace />} />
        {reportsRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<ReportsTitleScreen item={item} />}
          />
        ))}
        <Route path="*" element={<ReportsFallbackScreen />} />
      </Routes>
    </ReportsShell>
  );
}
