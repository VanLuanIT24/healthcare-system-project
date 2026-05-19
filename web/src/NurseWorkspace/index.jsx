import { Component } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { NurseShell } from './NurseShell';
import { flattenNurseMenu, getNursePageMeta } from './nurseData';
import { NurseDashboardPage } from './NurseDashboardPage';
import {
  PendingPatientsPage,
  PriorityAlertsPage,
  RealtimeQueuePage,
  TodayWorkPage,
} from './NurseOperationPages';
import {
  CheckedInPatientsPage,
  CreateTriagePage,
  PriorityTransferPage,
  ReadyForDoctorPage,
  WaitingNursePage,
  WaitingTriagePage,
} from './NurseIntakePages';
import {
  AbnormalVitalsPage,
  NursingNotesPage,
  VitalCorrectionsPage,
  VitalEntryPage,
  VitalHistoryPage,
  WaitingVitalsPage,
} from './NurseVitalsRecordsPages';
import {
  PreparationChecklistPage,
  PreExamPreparationPage,
  PreImagingPreparationPage,
  PreLabPreparationPage,
  PreProcedurePreparationPage,
  ServicePreparationWaitingPage,
} from './NurseServicePreparationPages';
import {
  AbnormalAlertsCommandPage,
  DoctorReportingCommandPage,
  MonitoringPatientsPage,
  PostMedicationMonitoringPage,
  PostProcedureMonitoringPage,
  UrgentCasesCommandPage,
} from './NurseMonitoringReportingPages';
import {
  AssignedTasksPage,
  CompletedTasksPage,
  HandoverHistoryPage,
  OverdueTasksPage,
  PatientTasksPage,
  ShiftHandoverPage,
} from './NurseTaskHandoverPages';
import {
  InpatientAdmissionPage,
  InpatientBedAssignmentTransferPage,
  InpatientBedsideMedicationPage,
  InpatientHandoverPage,
  InpatientRoomsBedsPage,
  InpatientTasksPage,
  InpatientWardBoardPage,
} from './NurseInpatientPages';
import {
  EmergencyClosedCasesPage,
  EmergencyEscalationPage,
  EmergencyOpenCasesPage,
  EmergencyResponseCommitmentPage,
  EmergencyResponseCoordinationPage,
  EmergencyTriagePage,
} from './NurseEmergencyPages';
import {
  PatientAllergiesProblemsLookupPage,
  PatientClinicalDocumentsLookupPage,
  PatientEncounterHistoryLookupPage,
  PatientProfileLookupPage,
  PatientVitalsHistoryLookupPage,
} from './NursePatientLookupPages';
import './nurse.css';

const nurseRoutes = flattenNurseMenu().map((item) => ({
  ...item,
  routePath: item.to.replace('/nurse/', ''),
}));

function NurseTitleScreen({ item }) {
  const Icon = item.icon;

  return (
    <section className="nurse-title-screen" aria-labelledby="nurse-page-title">
      <div className="nurse-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.2} />
      </div>
      <div>
        <span>{item.sectionLabel}</span>
        <h1 id="nurse-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function NurseFallbackScreen() {
  const location = useLocation();
  return <NurseTitleScreen item={getNursePageMeta(location.pathname)} />;
}

class NurseWorkspaceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Nurse workspace render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="nurse-title-screen nurse-title-screen--error" aria-labelledby="nurse-render-error-title">
        <div className="nurse-title-screen__mark" aria-hidden="true">
          !
        </div>
        <div>
          <span>Không thể dựng màn hình</span>
          <h1 id="nurse-render-error-title">Trang điều dưỡng cần tải lại</h1>
          <p>{this.state.error?.message || 'Dữ liệu hiển thị chưa đúng định dạng.'}</p>
          <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
        </div>
      </section>
    );
  }
}

export default function NurseWorkspace() {
  const location = useLocation();
  return (
    <NurseShell>
      <NurseWorkspaceErrorBoundary key={location.pathname}>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<NurseDashboardPage />} />
          <Route path="overview/pending-processing" element={<PendingPatientsPage />} />
          <Route path="overview/today-work" element={<TodayWorkPage />} />
          <Route path="overview/priority-alerts" element={<PriorityAlertsPage />} />
          <Route path="overview/realtime-queue" element={<RealtimeQueuePage />} />
          <Route path="reception-triage/checked-in-patients" element={<CheckedInPatientsPage />} />
          <Route path="reception-triage/waiting-nursing" element={<WaitingNursePage />} />
          <Route path="reception-triage/waiting-triage" element={<WaitingTriagePage />} />
          <Route path="reception-triage/create-triage" element={<CreateTriagePage />} />
          <Route path="reception-triage/priority-transfer" element={<PriorityTransferPage />} />
          <Route path="reception-triage/ready-for-doctor" element={<ReadyForDoctorPage />} />
          <Route path="vitals-records/waiting" element={<WaitingVitalsPage />} />
          <Route path="vitals-records/entry" element={<VitalEntryPage />} />
          <Route path="vitals-records/history" element={<VitalHistoryPage />} />
          <Route path="vitals-records/abnormal" element={<AbnormalVitalsPage />} />
          <Route path="vitals-records/corrections-needed" element={<VitalCorrectionsPage />} />
          <Route path="vitals-records/nursing-notes" element={<NursingNotesPage />} />
          <Route path="service-preparation" element={<ServicePreparationWaitingPage />} />
          <Route path="service-preparation/waiting" element={<ServicePreparationWaitingPage />} />
          <Route path="service-preparation/pre-exam" element={<PreExamPreparationPage />} />
          <Route path="service-preparation/pre-lab" element={<PreLabPreparationPage />} />
          <Route path="service-preparation/pre-imaging" element={<PreImagingPreparationPage />} />
          <Route path="service-preparation/pre-procedure" element={<PreProcedurePreparationPage />} />
          <Route path="service-preparation/checklists" element={<PreparationChecklistPage />} />
          <Route path="monitoring-reporting/patients" element={<MonitoringPatientsPage />} />
          <Route path="monitoring-reporting/post-procedure" element={<PostProcedureMonitoringPage />} />
          <Route path="monitoring-reporting/post-medication" element={<PostMedicationMonitoringPage />} />
          <Route path="monitoring-reporting/abnormal-alerts" element={<AbnormalAlertsCommandPage />} />
          <Route path="monitoring-reporting/urgent-cases" element={<UrgentCasesCommandPage />} />
          <Route path="monitoring-reporting/report-doctor" element={<DoctorReportingCommandPage />} />
          <Route path="tasks-handover/assigned" element={<AssignedTasksPage />} />
          <Route path="tasks-handover/by-patient" element={<PatientTasksPage />} />
          <Route path="tasks-handover/overdue" element={<OverdueTasksPage />} />
          <Route path="tasks-handover/completed" element={<CompletedTasksPage />} />
          <Route path="tasks-handover/shift-handover" element={<ShiftHandoverPage />} />
          <Route path="tasks-handover/handover-history" element={<HandoverHistoryPage />} />
          <Route path="inpatient/list" element={<InpatientWardBoardPage />} />
          <Route path="inpatient/admissions" element={<InpatientAdmissionPage />} />
          <Route path="inpatient/rooms-beds" element={<InpatientRoomsBedsPage />} />
          <Route path="inpatient/bed-assignment-transfer" element={<InpatientBedAssignmentTransferPage />} />
          <Route path="inpatient/tasks" element={<InpatientTasksPage />} />
          <Route path="inpatient/bedside-medication" element={<InpatientBedsideMedicationPage />} />
          <Route path="inpatient/handover" element={<InpatientHandoverPage />} />
          <Route path="emergency/open-cases" element={<EmergencyOpenCasesPage />} />
          <Route path="emergency/triage" element={<EmergencyTriagePage />} />
          <Route path="emergency/response-coordination" element={<EmergencyResponseCoordinationPage />} />
          <Route path="emergency/escalation" element={<EmergencyEscalationPage />} />
          <Route path="emergency/response-commitment" element={<EmergencyResponseCommitmentPage />} />
          <Route path="emergency/closed-cases" element={<EmergencyClosedCasesPage />} />
          <Route path="patient-lookup/profile" element={<PatientProfileLookupPage />} />
          <Route path="patient-lookup/encounter-history" element={<PatientEncounterHistoryLookupPage />} />
          <Route path="patient-lookup/vitals-history" element={<PatientVitalsHistoryLookupPage />} />
          <Route path="patient-lookup/allergies-problems" element={<PatientAllergiesProblemsLookupPage />} />
          <Route path="patient-lookup/clinical-documents" element={<PatientClinicalDocumentsLookupPage />} />
          <Route path="service-preparation/before-exam" element={<Navigate to="/nurse/service-preparation/pre-exam" replace />} />
          <Route path="service-preparation/before-lab" element={<Navigate to="/nurse/service-preparation/pre-lab" replace />} />
          <Route path="service-preparation/before-imaging" element={<Navigate to="/nurse/service-preparation/pre-imaging" replace />} />
          <Route path="service-preparation/before-procedure" element={<Navigate to="/nurse/service-preparation/pre-procedure" replace />} />
          <Route path="service-preparation/checklist" element={<Navigate to="/nurse/service-preparation/checklists" replace />} />
          {nurseRoutes.filter((item) => ![
            'dashboard',
            'pending-processing',
            'today-work',
            'priority-alerts',
            'realtime-queue',
            'checked-in-patients',
            'waiting-nursing',
            'waiting-triage',
            'create-triage',
            'priority-transfer',
            'ready-for-doctor',
            'vitals-waiting',
            'vitals-entry',
            'vitals-history',
            'vitals-abnormal',
            'records-corrections',
            'nursing-notes',
            'prep-waiting',
            'prep-exam',
            'prep-lab',
            'prep-imaging',
            'prep-procedure',
            'prep-checklist',
            'monitoring-patients',
            'monitoring-post-procedure',
            'monitoring-post-medication',
            'monitoring-alerts',
            'monitoring-urgent-cases',
            'monitoring-report-doctor',
            'tasks-assigned',
            'tasks-by-patient',
            'tasks-overdue',
            'tasks-completed',
            'shift-handover',
            'handover-history',
            'inpatient-list',
            'inpatient-admission',
            'inpatient-rooms',
            'inpatient-bed-transfer',
            'inpatient-tasks',
            'inpatient-bedside-medication',
            'inpatient-handover',
            'emergency-open-cases',
            'emergency-triage',
            'emergency-response-coordination',
            'emergency-escalation',
            'emergency-response-commitment',
            'emergency-closed-cases',
            'patient-profile',
            'patient-encounter-history',
            'patient-vitals-history',
            'patient-allergies-problems',
            'patient-clinical-documents',
          ].includes(item.id)).map((item) => (
            <Route
              key={item.to}
              path={item.routePath}
              element={<NurseTitleScreen item={item} />}
            />
          ))}
          <Route path="*" element={<NurseFallbackScreen />} />
        </Routes>
      </NurseWorkspaceErrorBoundary>
    </NurseShell>
  );
}
