const express = require('express');
const nursingController = require('../controllers/nursing.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('ticketId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('vitalSignId', validateObjectIdParam);
router.param('taskId', validateObjectIdParam);
router.param('handoffId', validateObjectIdParam);
router.param('requestId', validateObjectIdParam);
router.param('triageId', validateObjectIdParam);
router.param('preparationId', validateObjectIdParam);
router.param('orderId', validateObjectIdParam);
router.param('itemId', validateObjectIdParam);
router.param('templateId', validateObjectIdParam);
router.param('monitoringId', validateObjectIdParam);
router.param('doctorNotificationId', validateObjectIdParam);
router.param('clinicalAlertId', validateObjectIdParam);
router.param('procedureOrderId', validateObjectIdParam);
router.param('administrationId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

const dashboardReadPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.QUEUE.READ,
  PERMISSION.QUEUE.READ_DEPARTMENT,
  PERMISSION.ENCOUNTERS.READ,
  PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
  PERMISSION.VITAL_SIGNS.READ,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.EMERGENCY.READ,
  PERMISSION.ADMISSIONS.READ_DEPARTMENT,
  PERMISSION.NURSING_TASKS.READ,
  PERMISSION.NURSING_TASKS.READ_OWN,
  PERMISSION.NURSING_TASKS.READ_DEPARTMENT,
  PERMISSION.NURSING_HANDOFFS.READ,
  PERMISSION.NURSING_HANDOFFS.READ_OWN,
  PERMISSION.NURSING_HANDOFFS.READ_DEPARTMENT,
];

const nursingWritePermissions = [
  PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS,
  PERMISSION.ENCOUNTERS.UPDATE,
  PERMISSION.QUEUE.UPDATE,
  PERMISSION.VITAL_SIGNS.CREATE,
  PERMISSION.CLINICAL_NOTES.CREATE_NURSING,
  PERMISSION.NURSING_TASKS.CREATE,
  PERMISSION.NURSING_TASKS.ACCEPT,
  PERMISSION.NURSING_TASKS.START,
  PERMISSION.NURSING_TASKS.COMPLETE,
  PERMISSION.NURSING_TASKS.COMPLETE_OWN,
  PERMISSION.NURSING_TASKS.ESCALATE,
  PERMISSION.NURSING_TASKS.MANAGE,
  PERMISSION.NURSING_HANDOFFS.CREATE,
  PERMISSION.NURSING_HANDOFFS.UPDATE_OWN,
  PERMISSION.NURSING_HANDOFFS.SUBMIT,
  PERMISSION.NURSING_HANDOFFS.ACCEPT,
  PERMISSION.NURSING_HANDOFFS.REJECT,
];

const preparationReadPermissions = [
  ...dashboardReadPermissions,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
  PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.SPECIMENS.READ,
  PERMISSION.ATTACHMENTS.READ_DEPARTMENT,
  PERMISSION.ATTACHMENTS.READ_IMAGING,
];

const preparationWritePermissions = [
  ...nursingWritePermissions,
  PERMISSION.SPECIMENS.COLLECT,
  PERMISSION.LAB_ORDERS.COLLECT,
  PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL,
];

const patientLookupReadPermissions = [
  ...dashboardReadPermissions,
  PERMISSION.PATIENTS.READ,
  PERMISSION.PATIENTS.READ_ASSIGNED,
  PERMISSION.PATIENTS.SEARCH,
  PERMISSION.PATIENT_IDENTIFIERS.READ,
  PERMISSION.PATIENT_RELATIVES.READ,
  PERMISSION.PATIENT_AUTHORIZATIONS.READ,
  PERMISSION.ALLERGIES.READ,
  PERMISSION.PROBLEMS.READ,
  PERMISSION.MEDICAL_RECORDS.READ,
  PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT,
  PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED,
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_DEPARTMENT,
  PERMISSION.DOCUMENTS.TIMELINE_READ,
  PERMISSION.DOCUMENTS.TIMELINE_READ_DEPARTMENT,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.PRESCRIPTIONS.READ,
  PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT,
  PERMISSION.INVOICES.READ,
];

const patientLookupWritePermissions = [
  ...nursingWritePermissions,
  PERMISSION.ALLERGIES.CREATE,
  PERMISSION.PROBLEMS.CREATE,
  PERMISSION.ALLERGIES.UPDATE,
  PERMISSION.PROBLEMS.UPDATE,
];

router.get('/clinical-command', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getClinicalCommandCenter);

router.get('/patients/:patientId/snapshot', authorize({ anyPermissions: patientLookupReadPermissions }), nursingController.getPatientSnapshot);
router.get('/patients/:patientId/profile-center', authorize({ anyPermissions: patientLookupReadPermissions }), nursingController.getPatientProfileCenter);
router.get('/patients/:patientId/encounter-history', authorize({ anyPermissions: patientLookupReadPermissions }), nursingController.getPatientEncounterHistory);
router.get('/patients/:patientId/vital-history', authorize({ anyPermissions: patientLookupReadPermissions }), nursingController.getPatientVitalHistory);
router.get('/patients/:patientId/clinical-risks', authorize({ anyPermissions: patientLookupReadPermissions }), nursingController.getPatientClinicalRisks);
router.get('/patients/:patientId/document-center', authorize({ anyPermissions: patientLookupReadPermissions }), nursingController.getPatientDocumentCenter);
router.post('/patients/:patientId/allergies/check-duplicate', authorize({ anyPermissions: patientLookupWritePermissions }), nursingController.checkDuplicateAllergy);
router.post('/patients/:patientId/problems/check-duplicate', authorize({ anyPermissions: patientLookupWritePermissions }), nursingController.checkDuplicateProblem);
router.get('/encounters/:encounterId/snapshot', authorize({ anyPermissions: patientLookupReadPermissions }), nursingController.getEncounterSnapshot);

router.get('/monitoring', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listMonitoringSessions);
router.post('/monitoring', authorize({ anyPermissions: nursingWritePermissions }), nursingController.createMonitoringSession);
router.get('/monitoring/:monitoringId', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getMonitoringSession);
router.patch('/monitoring/:monitoringId', authorize({ anyPermissions: nursingWritePermissions }), nursingController.updateMonitoringSession);
router.post('/monitoring/:monitoringId/check', authorize({ anyPermissions: nursingWritePermissions }), nursingController.addMonitoringCheck);
router.post('/monitoring/:monitoringId/assign', authorize({ anyPermissions: nursingWritePermissions }), nursingController.assignMonitoringSession);
router.post('/monitoring/:monitoringId/notify-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.notifyDoctorFromMonitoring);
router.post('/monitoring/:monitoringId/escalate', authorize({ anyPermissions: nursingWritePermissions }), nursingController.escalateMonitoringSession);
router.post('/monitoring/:monitoringId/mark-stable', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markMonitoringStable);
router.post('/monitoring/:monitoringId/resolve', authorize({ anyPermissions: nursingWritePermissions }), nursingController.resolveMonitoringSession);
router.post('/monitoring/:monitoringId/cancel', authorize({ anyPermissions: nursingWritePermissions }), nursingController.cancelMonitoringSession);
router.get('/monitoring/:monitoringId/timeline', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getMonitoringTimeline);

router.get('/doctor-notifications', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listDoctorNotifications);
router.post('/doctor-notifications', authorize({ anyPermissions: nursingWritePermissions }), nursingController.createDoctorNotification);
router.get('/doctor-notifications/:doctorNotificationId', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getDoctorNotification);
router.patch('/doctor-notifications/:doctorNotificationId', authorize({ anyPermissions: nursingWritePermissions }), nursingController.updateDoctorNotification);
router.post('/doctor-notifications/:doctorNotificationId/send', authorize({ anyPermissions: nursingWritePermissions }), nursingController.sendDoctorNotification);
router.post('/doctor-notifications/:doctorNotificationId/mark-seen', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markDoctorNotificationSeen);
router.post('/doctor-notifications/:doctorNotificationId/acknowledge', authorize({ anyPermissions: nursingWritePermissions }), nursingController.acknowledgeDoctorNotification);
router.post('/doctor-notifications/:doctorNotificationId/respond', authorize({ anyPermissions: nursingWritePermissions }), nursingController.respondDoctorNotification);
router.post('/doctor-notifications/:doctorNotificationId/escalate', authorize({ anyPermissions: nursingWritePermissions }), nursingController.escalateDoctorNotification);
router.post('/doctor-notifications/:doctorNotificationId/close', authorize({ anyPermissions: nursingWritePermissions }), nursingController.closeDoctorNotification);
router.post('/doctor-notifications/:doctorNotificationId/cancel', authorize({ anyPermissions: nursingWritePermissions }), nursingController.cancelDoctorNotification);
router.get('/doctor-notifications/:doctorNotificationId/timeline', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getDoctorNotificationTimeline);

router.get('/clinical-alerts', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listClinicalAlerts);
router.post('/clinical-alerts', authorize({ anyPermissions: nursingWritePermissions }), nursingController.createClinicalAlert);
router.get('/clinical-alerts/:clinicalAlertId', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getClinicalAlert);
router.post('/clinical-alerts/:clinicalAlertId/acknowledge', authorize({ anyPermissions: nursingWritePermissions }), nursingController.acknowledgeClinicalAlert);
router.post('/clinical-alerts/:clinicalAlertId/notify-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.notifyDoctorClinicalAlert);
router.post('/clinical-alerts/:clinicalAlertId/escalate', authorize({ anyPermissions: nursingWritePermissions }), nursingController.escalateClinicalAlert);
router.post('/clinical-alerts/:clinicalAlertId/resolve', authorize({ anyPermissions: nursingWritePermissions }), nursingController.resolveClinicalAlert);
router.post('/clinical-alerts/:clinicalAlertId/dismiss', authorize({ anyPermissions: nursingWritePermissions }), nursingController.dismissClinicalAlert);
router.post('/clinical-alerts/evaluate/encounter/:encounterId', authorize({ anyPermissions: nursingWritePermissions }), nursingController.evaluateEncounterAlerts);
router.post('/clinical-alerts/evaluate/vital-sign/:vitalSignId', authorize({ anyPermissions: nursingWritePermissions }), nursingController.evaluateVitalSignAlert);

router.get('/post-procedure', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listPostProcedure);
router.get('/post-procedure/:procedureOrderId', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPostProcedure);
router.post('/post-procedure/:procedureOrderId/observations', authorize({ anyPermissions: nursingWritePermissions }), nursingController.addPostProcedureObservation);
router.post('/post-procedure/:procedureOrderId/mark-stable', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markPostProcedureStable);
router.post('/post-procedure/:procedureOrderId/notify-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.notifyDoctorPostProcedure);
router.post('/post-procedure/:procedureOrderId/escalate', authorize({ anyPermissions: nursingWritePermissions }), nursingController.escalatePostProcedure);
router.post('/post-procedure/:procedureOrderId/create-emergency', authorize({ anyPermissions: nursingWritePermissions }), nursingController.createEmergencyFromPostProcedure);

router.get('/post-medication', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listPostMedication);
router.post('/post-medication/:administrationId/reactions', authorize({ anyPermissions: nursingWritePermissions }), nursingController.addMedicationReaction);

router.get('/dashboard/overview', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getDashboardOverview);
router.get('/dashboard/kpis', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getDashboardKpis);
router.get('/dashboard/worklist', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getDashboardWorklist);
router.get('/dashboard/priority-alerts', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPriorityAlerts);

router.get('/pending-patients', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPendingPatients);
router.get('/pending-patients/summary', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPendingPatientsSummary);
router.get('/pending-patients/priority-lane', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPendingPatientsPriorityLane);
router.get('/intake/dashboard', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getIntakeDashboard);
router.get('/intake/worklist', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getIntakeWorklist);
router.get('/intake/queue/:ticketId/context', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getQueueContext);
router.post('/intake/:ticketId/claim', authorize({ anyPermissions: nursingWritePermissions }), nursingController.claimQueueIntake);
router.post('/intake/:ticketId/release', authorize({ anyPermissions: nursingWritePermissions }), nursingController.releaseQueueIntake);
router.post('/intake/:ticketId/start', authorize({ anyPermissions: nursingWritePermissions }), nursingController.startQueueIntake);
router.post('/intake/:ticketId/complete', authorize({ anyPermissions: nursingWritePermissions }), nursingController.completeQueueIntake);
router.post('/work-items/:workItemId/assign-to-me', authorize({ anyPermissions: nursingWritePermissions }), nursingController.assignWorkItemToMe);
router.post('/work-items/:workItemId/complete', authorize({ anyPermissions: nursingWritePermissions }), nursingController.completeWorkItem);

router.get('/priority-alerts', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPriorityAlertCenter);
router.get('/priority-alerts/summary', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPriorityAlertSummary);
router.get('/priority-alerts/:alertId', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPriorityAlertDetail);
router.post('/priority-alerts/:alertId/acknowledge', authorize({ anyPermissions: nursingWritePermissions }), nursingController.acknowledgePriorityAlert);
router.post('/priority-alerts/:alertId/assign-to-me', authorize({ anyPermissions: nursingWritePermissions }), nursingController.assignPriorityAlertToMe);
router.post('/priority-alerts/:alertId/notify-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.notifyDoctorPriorityAlert);
router.post('/priority-alerts/:alertId/resolve', authorize({ anyPermissions: nursingWritePermissions }), nursingController.resolvePriorityAlert);
router.post('/priority-alerts/:alertId/dismiss', authorize({ anyPermissions: nursingWritePermissions }), nursingController.dismissPriorityAlert);

router.get('/queue/board', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getNursingQueueBoard);
router.get('/queue/metrics', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getNursingQueueMetrics);

router.get('/vitals/pending', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPendingVitals);
router.get('/vitals/abnormal', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getAbnormalVitals);
router.post('/vitals/:vitalSignId/acknowledge', authorize({ anyPermissions: nursingWritePermissions }), nursingController.acknowledgeVitalAlert);
router.post('/vitals/:vitalSignId/notify-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.notifyDoctorOfVital);

router.get('/vital-corrections', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listVitalCorrections);
router.get('/vital-corrections/:requestId', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getVitalCorrectionDetail);
router.post('/vital-corrections/:requestId/approve', authorize({ anyPermissions: nursingWritePermissions }), nursingController.approveVitalCorrection);
router.post('/vital-corrections/:requestId/reject', authorize({ anyPermissions: nursingWritePermissions }), nursingController.rejectVitalCorrection);
router.post('/vital-corrections/:requestId/apply', authorize({ anyPermissions: nursingWritePermissions }), nursingController.applyVitalCorrection);
router.post('/vital-corrections/:requestId/cancel', authorize({ anyPermissions: nursingWritePermissions }), nursingController.cancelVitalCorrection);

router.get('/triage/pending', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPendingTriage);
router.get('/triage/worklist', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getTriageWorklist);
router.get('/triage/queue/:ticketId/latest', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getLatestTriageByQueue);
router.post('/triage', authorize({ anyPermissions: nursingWritePermissions }), idempotencyRequired({ route: '/api/nursing/triage' }), nursingController.createTriageAssessment);
router.patch('/triage/:triageId', authorize({ anyPermissions: nursingWritePermissions }), nursingController.updateTriageAssessment);
router.post('/triage/:triageId/start', authorize({ anyPermissions: nursingWritePermissions }), nursingController.startTriageAssessment);
router.post('/triage/:triageId/complete', authorize({ anyPermissions: nursingWritePermissions }), nursingController.completeTriageAssessment);
router.post('/triage/:triageId/cancel', authorize({ anyPermissions: nursingWritePermissions }), nursingController.cancelTriageAssessment);
router.post('/triage/:triageId/mark-entered-in-error', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markTriageEnteredInError);

router.get('/ready-for-doctor', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getReadyForDoctor);
router.post('/queue/:ticketId/unmark-ready-for-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.unmarkReadyForDoctor);
router.post('/queue/:ticketId/notify-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.notifyDoctorQueue);

router.get('/preparations/worklist', authorize({ anyPermissions: preparationReadPermissions }), nursingController.getPreparationWorklist);
router.get('/preparations/dashboard/summary', authorize({ anyPermissions: preparationReadPermissions }), nursingController.getPreparationDashboardSummary);
router.post('/preparations/pre-exam/from-encounter/:encounterId', authorize({ anyPermissions: preparationWritePermissions }), nursingController.createPreExamPreparationFromEncounter);
router.post('/preparations/from-order/:orderId/v2', authorize({ anyPermissions: preparationWritePermissions }), nursingController.createServicePreparationFromOrder);

router.get('/preparations/checklist-templates/preview', authorize({ anyPermissions: preparationReadPermissions }), nursingController.previewPreparationChecklistTemplate);
router.get('/preparations/checklist-templates', authorize({ anyPermissions: preparationReadPermissions }), nursingController.listPreparationChecklistTemplates);
router.post('/preparations/checklist-templates', authorize({ anyPermissions: preparationWritePermissions }), nursingController.createPreparationChecklistTemplate);
router.patch('/preparations/checklist-templates/:templateId', authorize({ anyPermissions: preparationWritePermissions }), nursingController.updatePreparationChecklistTemplate);
router.post('/preparations/checklist-templates/:templateId/clone', authorize({ anyPermissions: preparationWritePermissions }), nursingController.clonePreparationChecklistTemplate);

router.post('/preparations/bulk-assign', authorize({ anyPermissions: preparationWritePermissions }), nursingController.bulkAssignPreparations);
router.post('/preparations/bulk-start', authorize({ anyPermissions: preparationWritePermissions }), nursingController.bulkStartPreparations);
router.post('/preparations/bulk-ready', authorize({ anyPermissions: preparationWritePermissions }), nursingController.bulkReadyPreparations);
router.post('/preparations/bulk-notify', authorize({ anyPermissions: preparationWritePermissions }), nursingController.bulkNotifyPreparations);
router.post('/preparations/bulk-transfer', authorize({ anyPermissions: preparationWritePermissions }), nursingController.bulkTransferPreparations);
router.post('/preparations/bulk-print', authorize({ anyPermissions: preparationWritePermissions }), nursingController.bulkPrintPreparations);

router.get('/preparations/pending', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getPendingPreparations);
router.post('/preparations/from-order/:orderId', authorize({ anyPermissions: preparationWritePermissions }), nursingController.createServicePreparationFromOrder);
router.patch('/preparations/:preparationId/items/:itemKey', authorize({ anyPermissions: nursingWritePermissions }), nursingController.updatePreparationItem);
router.post('/preparations/:preparationId/complete', authorize({ anyPermissions: preparationWritePermissions }), nursingController.completeServicePreparation);

router.get('/preparations/:preparationId', authorize({ anyPermissions: preparationReadPermissions }), nursingController.getPreparationDetail);
router.get('/preparations/:preparationId/checklist', authorize({ anyPermissions: preparationReadPermissions }), nursingController.getPreparationChecklist);
router.get('/preparations/:preparationId/timeline', authorize({ anyPermissions: preparationReadPermissions }), nursingController.getPreparationTimeline);
router.get('/preparations/:preparationId/context', authorize({ anyPermissions: preparationReadPermissions }), nursingController.getPreparationContext);
router.post('/preparations/:preparationId/assign', authorize({ anyPermissions: preparationWritePermissions }), nursingController.assignPreparation);
router.post('/preparations/:preparationId/start', authorize({ anyPermissions: preparationWritePermissions }), nursingController.startPreparation);
router.post('/preparations/:preparationId/block', authorize({ anyPermissions: preparationWritePermissions }), nursingController.blockPreparation);
router.post('/preparations/:preparationId/unblock', authorize({ anyPermissions: preparationWritePermissions }), nursingController.unblockPreparation);
router.post('/preparations/:preparationId/ready', authorize({ anyPermissions: preparationWritePermissions }), nursingController.readyPreparation);
router.post('/preparations/:preparationId/transfer', authorize({ anyPermissions: preparationWritePermissions }), nursingController.transferPreparation);
router.post('/preparations/:preparationId/cancel', authorize({ anyPermissions: preparationWritePermissions }), nursingController.cancelPreparation);
router.post('/preparations/:preparationId/notify-doctor', authorize({ anyPermissions: preparationWritePermissions }), nursingController.notifyDoctorPreparation);
router.post('/preparations/:preparationId/notify-destination', authorize({ anyPermissions: preparationWritePermissions }), nursingController.notifyDestinationPreparation);
router.post('/preparations/:preparationId/add-note', authorize({ anyPermissions: preparationWritePermissions }), nursingController.addPreparationNote);
router.post('/preparations/:preparationId/print-specimen-label', authorize({ anyPermissions: preparationWritePermissions }), nursingController.printPreparationSpecimenLabel);
router.post('/preparations/:preparationId/scan-specimen-label', authorize({ anyPermissions: preparationWritePermissions }), nursingController.scanPreparationSpecimenLabel);
router.post('/preparations/:preparationId/handoff-lab', authorize({ anyPermissions: preparationWritePermissions }), nursingController.handoffPreparationLab);
router.post('/preparations/:preparationId/request-recollect', authorize({ anyPermissions: preparationWritePermissions }), nursingController.requestPreparationRecollect);
router.post('/preparations/:preparationId/link-consent', authorize({ anyPermissions: preparationWritePermissions }), nursingController.linkPreparationConsent);
router.patch('/preparations/:preparationId/checklist/:itemId', authorize({ anyPermissions: preparationWritePermissions }), nursingController.patchPreparationChecklistItem);
router.post('/preparations/:preparationId/checklist/:itemId/done', authorize({ anyPermissions: preparationWritePermissions }), nursingController.donePreparationChecklistItem);
router.post('/preparations/:preparationId/checklist/:itemId/fail', authorize({ anyPermissions: preparationWritePermissions }), nursingController.failPreparationChecklistItem);
router.post('/preparations/:preparationId/checklist/:itemId/waive', authorize({ anyPermissions: preparationWritePermissions }), nursingController.waivePreparationChecklistItem);
router.post('/preparations/:preparationId/checklist/:itemId/attach-evidence', authorize({ anyPermissions: preparationWritePermissions }), nursingController.attachPreparationChecklistEvidence);

router.post('/queue/:ticketId/mark-waiting-nurse', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markQueueWaitingNurse);
router.get('/queue/:ticketId/context', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getQueueContext);
router.get('/queue/:ticketId/available-actions', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getQueueAvailableActions);
router.post('/queue/:ticketId/mark-triage-done', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markQueueTriageDone);
router.post('/queue/:ticketId/mark-vital-done', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markQueueVitalDone);
router.post('/queue/:ticketId/mark-ready-for-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markQueueReadyForDoctor);
router.post('/encounters/:encounterId/mark-ready-for-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.markEncounterReadyForDoctor);

router.get('/tasks', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listTasks);
router.post('/tasks', authorize({ anyPermissions: nursingWritePermissions }), idempotencyRequired({ route: '/api/nursing/tasks' }), nursingController.createTask);
router.get('/tasks/today', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listTodayTasks);
router.get('/tasks/board', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getTasksBoard);
router.get('/tasks/summary', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getTasksSummary);
router.get('/tasks/my', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listMyTasks);
router.get('/tasks/by-patient', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listTasksByPatient);
router.get('/tasks/patient-matrix', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getTasksPatientMatrix);
router.get('/tasks/workload', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getTasksWorkload);
router.get('/tasks/overdue/summary', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getTasksSummary);
router.get('/tasks/overdue', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listOverdueTasks);
router.get('/tasks/completed', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listCompletedTasks);
router.post('/tasks/bulk-complete', authorize({ anyPermissions: nursingWritePermissions }), nursingController.bulkCompleteTasks);
router.post('/tasks/bulk-reassign', authorize({ anyPermissions: nursingWritePermissions }), nursingController.bulkReassignTasks);
router.post('/tasks/bulk-add-to-handoff', authorize({ anyPermissions: nursingWritePermissions }), nursingController.bulkAddTasksToHandoff);
router.get('/tasks/:taskId/audit-trail', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getTaskAuditTrail);
router.get('/tasks/:taskId', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getTaskDetail);
router.post('/tasks/:taskId/assign-to-me', authorize({ anyPermissions: nursingWritePermissions }), nursingController.assignTaskToMe);
router.post('/tasks/:taskId/accept', authorize({ anyPermissions: nursingWritePermissions }), nursingController.acceptTask);
router.post('/tasks/:taskId/start', authorize({ anyPermissions: nursingWritePermissions }), nursingController.startTask);
router.post('/tasks/:taskId/block', authorize({ anyPermissions: nursingWritePermissions }), nursingController.blockTask);
router.post('/tasks/:taskId/resume', authorize({ anyPermissions: nursingWritePermissions }), nursingController.resumeTask);
router.post('/tasks/:taskId/complete', authorize({ anyPermissions: nursingWritePermissions }), nursingController.completeTaskV2);
router.post('/tasks/:taskId/cancel', authorize({ anyPermissions: nursingWritePermissions }), nursingController.cancelTask);
router.post('/tasks/:taskId/reassign', authorize({ anyPermissions: nursingWritePermissions }), nursingController.reassignTask);
router.post('/tasks/:taskId/escalate', authorize({ anyPermissions: nursingWritePermissions }), nursingController.escalateTask);
router.post('/tasks/:taskId/remind', authorize({ anyPermissions: nursingWritePermissions }), nursingController.remindTask);
router.post('/tasks/:taskId/extend', authorize({ anyPermissions: nursingWritePermissions }), nursingController.extendTask);
router.post('/tasks/:taskId/add-note', authorize({ anyPermissions: nursingWritePermissions }), nursingController.addTaskNote);
router.post('/tasks/:taskId/create-clinical-note', authorize({ anyPermissions: nursingWritePermissions }), nursingController.createTaskClinicalNote);
router.post('/tasks/:taskId/report-doctor', authorize({ anyPermissions: nursingWritePermissions }), nursingController.reportDoctorFromTask);
router.post('/tasks/:taskId/add-to-handoff', authorize({ anyPermissions: nursingWritePermissions }), nursingController.addTaskToHandoff);
router.post('/tasks/:taskId/checklist/:itemId/check', authorize({ anyPermissions: nursingWritePermissions }), nursingController.checkTaskChecklistItem);
router.post('/tasks/:taskId/checklist/:itemId/skip', authorize({ anyPermissions: nursingWritePermissions }), nursingController.skipTaskChecklistItem);
router.post('/tasks/:taskId/create-follow-up', authorize({ anyPermissions: nursingWritePermissions }), nursingController.createTaskFollowUp);
router.post('/tasks/:taskId/request-review', authorize({ anyPermissions: nursingWritePermissions }), nursingController.requestTaskReview);
router.post('/tasks/:taskId/approve-review', authorize({ anyPermissions: nursingWritePermissions }), nursingController.approveTaskReview);
router.post('/tasks/:taskId/reject-review', authorize({ anyPermissions: nursingWritePermissions }), nursingController.rejectTaskReview);
router.post('/tasks/:taskId/reopen', authorize({ anyPermissions: nursingWritePermissions }), nursingController.reopenTask);

router.get('/handoffs', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.listHandoffs);
router.post('/handoffs', authorize({ anyPermissions: nursingWritePermissions }), nursingController.createHandoff);
router.post('/handoffs/generate-draft', authorize({ anyPermissions: nursingWritePermissions }), nursingController.generateHandoffDraft);
router.get('/handoffs/active', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getActiveHandoffs);
router.get('/handoffs/history', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getHandoffHistory);
router.get('/handoffs/:handoffId/audit-trail', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getHandoffAuditTrail);
router.get('/handoffs/:handoffId', authorize({ anyPermissions: dashboardReadPermissions }), nursingController.getHandoff);
router.patch('/handoffs/:handoffId', authorize({ anyPermissions: nursingWritePermissions }), nursingController.updateHandoff);
router.post('/handoffs/:handoffId/add-patient', authorize({ anyPermissions: nursingWritePermissions }), nursingController.addHandoffPatient);
router.post('/handoffs/:handoffId/remove-patient', authorize({ anyPermissions: nursingWritePermissions }), nursingController.removeHandoffPatient);
router.post('/handoffs/:handoffId/attach-task', authorize({ anyPermissions: nursingWritePermissions }), nursingController.attachHandoffTask);
router.post('/handoffs/:handoffId/submit', authorize({ anyPermissions: nursingWritePermissions }), nursingController.submitHandoff);
router.post('/handoffs/:handoffId/accept', authorize({ anyPermissions: nursingWritePermissions }), nursingController.acceptHandoff);
router.post('/handoffs/:handoffId/reject', authorize({ anyPermissions: nursingWritePermissions }), nursingController.rejectHandoff);
router.post('/handoffs/:handoffId/reopen', authorize({ anyPermissions: nursingWritePermissions }), nursingController.reopenHandoff);
router.post('/handoffs/:handoffId/patient-items/:itemId/ack', authorize({ anyPermissions: nursingWritePermissions }), nursingController.acknowledgeHandoffPatient);
router.post('/handoffs/:handoffId/export-pdf', authorize({ anyPermissions: nursingWritePermissions }), nursingController.exportHandoffPdf);
router.post('/handoffs/:handoffId/clone', authorize({ anyPermissions: nursingWritePermissions }), nursingController.cloneHandoff);

module.exports = router;
