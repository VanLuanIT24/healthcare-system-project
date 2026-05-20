import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LabShell } from './LabShell';
import { flattenLabMenu, getLabPageMeta } from './labData';
import { DiagnosticAlertsPage } from './DiagnosticAlertsPages';
import { PatientClinicalLookupPage } from './PatientClinicalLookupPages';
import { LabWorklistPage } from './LabPages';
import { ImagingWorklistPage } from './ImagingPages';
import { ProcedureWorklistPage } from './ProcedurePages';
import { ResultReviewPage } from './ResultReviewPages';
import { ClinicalFilePage } from './ClinicalFilePages';
import {
  ClinicalOpsDashboardPage,
  CriticalResultsPage,
  OverdueOrdersPage,
  PendingApprovalPage,
  PendingCompletionPage,
  StatUrgentOrdersPage,
  TodayWorklistPage,
} from '../ClinicalOpsWorkspace/ClinicalOpsPages';
import {
  ClinicalOrderTimelinePage,
  ClinicalOrdersAcknowledgedPage,
  ClinicalOrdersAllPage,
  ClinicalOrdersCancelledPage,
  ClinicalOrdersCompletedPage,
  ClinicalOrdersEnteredInErrorPage,
  ClinicalOrdersInProgressPage,
  ClinicalOrdersPendingPage,
} from '../ClinicalOrderCenter/ClinicalOrderCenterPages';
import './lab.css';

const labRoutes = flattenLabMenu().map((item) => ({
  ...item,
  routePath: item.to.replace('/lab/', ''),
}));

function LabTitleScreen({ item }) {
  const Icon = item.icon;

  return (
    <section className="lab-title-screen" aria-labelledby="lab-page-title">
      <div className="lab-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.2} />
      </div>
      <div>
        <span>{item.sectionLabel}</span>
        <h1 id="lab-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function LabFallbackScreen() {
  const location = useLocation();
  return <LabTitleScreen item={getLabPageMeta(location.pathname)} />;
}

export default function LabWorkspace() {
  return (
    <LabShell>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ClinicalOpsDashboardPage />} />
        <Route path="overview/action-items" element={<TodayWorklistPage />} />
        <Route path="overview/urgent-orders" element={<StatUrgentOrdersPage />} />
        <Route path="overview/critical-results" element={<CriticalResultsPage />} />
        <Route path="overview/pending-completion" element={<PendingCompletionPage />} />
        <Route path="overview/pending-approval-signature" element={<PendingApprovalPage />} />
        <Route path="overview/overdue-orders" element={<OverdueOrdersPage />} />
        <Route path="orders/all" element={<ClinicalOrdersAllPage />} />
        <Route path="orders/pending-receive" element={<ClinicalOrdersPendingPage />} />
        <Route path="orders/received" element={<ClinicalOrdersAcknowledgedPage />} />
        <Route path="orders/in-progress" element={<ClinicalOrdersInProgressPage />} />
        <Route path="orders/completed" element={<ClinicalOrdersCompletedPage />} />
        <Route path="orders/cancelled" element={<ClinicalOrdersCancelledPage />} />
        <Route path="orders/entry-errors" element={<ClinicalOrdersEnteredInErrorPage />} />
        <Route path="orders/timeline" element={<ClinicalOrderTimelinePage />} />
        <Route path="tests/orders" element={<LabWorklistPage pageKey="orders" />} />
        <Route path="tests/waiting-specimen" element={<LabWorklistPage pageKey="waitingCollection" />} />
        <Route path="tests/specimen-collected" element={<LabWorklistPage pageKey="collected" />} />
        <Route path="tests/waiting-receive" element={<LabWorklistPage pageKey="waitingReceive" />} />
        <Route path="tests/processing" element={<LabWorklistPage pageKey="inTesting" />} />
        <Route path="tests/result-entry" element={<LabWorklistPage pageKey="resultEntry" />} />
        <Route path="tests/pending-approval" element={<LabWorklistPage pageKey="pendingApproval" />} />
        <Route path="tests/approved-results" element={<LabWorklistPage pageKey="finalResults" />} />
        <Route path="tests/corrections-needed" element={<LabWorklistPage pageKey="corrections" />} />
        <Route path="tests/critical-results" element={<LabWorklistPage pageKey="criticalResults" />} />
        <Route path="specimens" element={<LabWorklistPage pageKey="specimenList" />} />
        <Route path="specimens/waiting-collection" element={<LabWorklistPage pageKey="specimenWaitingCollection" />} />
        <Route path="specimens/collected" element={<LabWorklistPage pageKey="specimenCollected" />} />
        <Route path="specimens/receive" element={<LabWorklistPage pageKey="specimenReceive" />} />
        <Route path="specimens/reject" element={<LabWorklistPage pageKey="specimenRejected" />} />
        <Route path="specimens/testing" element={<LabWorklistPage pageKey="specimenTesting" />} />
        <Route path="specimens/storage" element={<LabWorklistPage pageKey="specimenStored" />} />
        <Route path="specimens/destroyed" element={<LabWorklistPage pageKey="specimenDisposed" />} />
        <Route path="specimens/history" element={<LabWorklistPage pageKey="specimenHistory" />} />
        <Route path="imaging/orders" element={<ImagingWorklistPage pageKey="orders" />} />
        <Route path="imaging/waiting-schedule" element={<ImagingWorklistPage pageKey="waitingSchedule" />} />
        <Route path="imaging/schedule" element={<ImagingWorklistPage pageKey="schedule" />} />
        <Route path="imaging/in-progress" element={<ImagingWorklistPage pageKey="inProgress" />} />
        <Route path="imaging/technical-complete" element={<ImagingWorklistPage pageKey="technicalComplete" />} />
        <Route path="imaging/upload-files" element={<ImagingWorklistPage pageKey="uploadFiles" />} />
        <Route path="imaging/no-show" element={<ImagingWorklistPage pageKey="noShow" />} />
        <Route path="imaging/reports" element={<ImagingWorklistPage pageKey="reports" />} />
        <Route path="imaging/pending-signature" element={<ImagingWorklistPage pageKey="pendingSignature" />} />
        <Route path="imaging/signed-reports" element={<ImagingWorklistPage pageKey="signedReports" />} />
        <Route path="imaging/corrections-needed" element={<ImagingWorklistPage pageKey="corrections" />} />
        <Route path="imaging/critical-findings" element={<ImagingWorklistPage pageKey="criticalFindings" />} />
        <Route path="procedures/orders" element={<ProcedureWorklistPage pageKey="orders" />} />
        <Route path="procedures/waiting-schedule" element={<ProcedureWorklistPage pageKey="waitingSchedule" />} />
        <Route path="procedures/schedule" element={<ProcedureWorklistPage pageKey="calendar" />} />
        <Route path="procedures/preparation" element={<ProcedureWorklistPage pageKey="preparation" />} />
        <Route path="procedures/in-progress" element={<ProcedureWorklistPage pageKey="inProgress" />} />
        <Route path="procedures/results" element={<ProcedureWorklistPage pageKey="results" />} />
        <Route path="procedures/complete" element={<ProcedureWorklistPage pageKey="completed" />} />
        <Route path="procedures/no-show" element={<ProcedureWorklistPage pageKey="noShow" />} />
        <Route path="procedures/files" element={<ProcedureWorklistPage pageKey="files" />} />
        <Route path="procedures/fees" element={<ProcedureWorklistPage pageKey="charges" />} />
        <Route path="settings/lab-test-catalog" element={<LabWorklistPage pageKey="catalog" />} />
        <Route path="approvals/lab" element={<ResultReviewPage pageKey="labPending" />} />
        <Route path="approvals/imaging-signature" element={<ResultReviewPage pageKey="imagingSigning" />} />
        <Route path="approvals/procedure-confirmation" element={<ResultReviewPage pageKey="procedureConfirmation" />} />
        <Route path="approvals/returned-to-doctor" element={<ResultReviewPage pageKey="releasedDoctor" />} />
        <Route path="approvals/returned-to-patient" element={<ResultReviewPage pageKey="releasedPatient" />} />
        <Route path="approvals/amend-needed" element={<ResultReviewPage pageKey="amendNeeded" />} />
        <Route path="approvals/history" element={<ResultReviewPage pageKey="auditHistory" />} />
        <Route path="result-files/imaging" element={<ClinicalFilePage pageKey="imaging" />} />
        <Route path="result-files/procedure" element={<ClinicalFilePage pageKey="procedure" />} />
        <Route path="result-files/lab" element={<ClinicalFilePage pageKey="lab" />} />
        <Route path="result-files/missing" element={<ClinicalFilePage pageKey="missing" />} />
        <Route path="result-files/scan-errors" element={<ClinicalFilePage pageKey="scanErrors" />} />
        <Route path="result-files/pending-review" element={<ClinicalFilePage pageKey="review" />} />
        <Route path="result-files/released" element={<ClinicalFilePage pageKey="released" />} />
        <Route path="alerts" element={<DiagnosticAlertsPage pageKey="all" />} />
        <Route path="alerts/critical-unhandled" element={<DiagnosticAlertsPage pageKey="criticalOpen" />} />
        <Route path="alerts/critical-overdue-confirmation" element={<DiagnosticAlertsPage pageKey="criticalOverdue" />} />
        <Route path="alerts/rejected-specimens" element={<DiagnosticAlertsPage pageKey="rejectedSpecimens" />} />
        <Route path="alerts/overdue-orders" element={<DiagnosticAlertsPage pageKey="overdueOrders" />} />
        <Route path="alerts/corrections-needed" element={<DiagnosticAlertsPage pageKey="corrections" />} />
        <Route path="alerts/missing-result-files" element={<DiagnosticAlertsPage pageKey="missingFiles" />} />
        <Route path="alerts/no-show-abnormal-cancel" element={<DiagnosticAlertsPage pageKey="noShowCancel" />} />
        <Route path="patient-lookup/by-patient" element={<PatientClinicalLookupPage pageKey="byPatient" />} />
        <Route path="patient-lookup/by-visit" element={<PatientClinicalLookupPage pageKey="byEncounter" />} />
        <Route path="patient-lookup/lab-history" element={<PatientClinicalLookupPage pageKey="labHistory" />} />
        <Route path="patient-lookup/imaging-history" element={<PatientClinicalLookupPage pageKey="imagingHistory" />} />
        <Route path="patient-lookup/procedure-history" element={<PatientClinicalLookupPage pageKey="procedureHistory" />} />
        <Route path="patient-lookup/clinical-summary" element={<PatientClinicalLookupPage pageKey="clinicalSummary" />} />
        {labRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<LabTitleScreen item={item} />}
          />
        ))}
        <Route path="*" element={<LabFallbackScreen />} />
      </Routes>
    </LabShell>
  );
}
