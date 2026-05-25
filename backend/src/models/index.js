const Department = require('./iam/department.model');
const User = require('./iam/user.model');
const UserPreference = require('./iam/user-preference.model');
const Role = require('./iam/role.model');
const UserRole = require('./iam/user-role.model');
const Permission = require('./iam/permission.model');
const RolePermission = require('./iam/role-permission.model');
const DenyPolicy = require('./iam/deny-policy.model');
const WorkspaceAccessPolicy = require('./workspace/workspace-access-policy.model');
const SecurityRateLimitEvent = require('./security/rate-limit-event.model');
const SecurityDataAccessPolicy = require('./security/data-access-policy.model');
const AuditReview = require('./compliance/audit-review.model');
const AuditExportRequest = require('./compliance/audit-export-request.model');
const ComplianceReport = require('./compliance/compliance-report.model');
const DiagnosticRun = require('./operations/diagnostic-run.model');
const MaintenanceWindow = require('./operations/maintenance-window.model');
const IntegrationLog = require('./integrations/integration-log.model');
const IntegrationHealthCheck = require('./integrations/integration-health-check.model');
const IntegrationDiagnosticRun = require('./integrations/integration-diagnostic-run.model');
const PortalFeatureFlag = require('./portal/portal-feature-flag.model');
const PortalProfileFieldPolicy = require('./portal/portal-profile-field-policy.model');

const DoctorProfile = require('./admin/doctor-profile.model');
const SystemSetting = require('./admin/system-setting.model');
const SystemSettingRevision = require('./admin/system-setting-revision.model');
const AdminToolRun = require('./admin/admin-tool-run.model');
const AdminToolFinding = require('./admin/admin-tool-finding.model');
const AdminToolApproval = require('./admin/admin-tool-approval.model');

const Patient = require('./patients/patient.model');
const PatientIdentifier = require('./patients/patient-identifier.model');
const PatientAccount = require('./patients/patient-account.model');
const PatientRelative = require('./patients/patient-relative.model');
const PatientAuthorization = require('./patients/patient-authorization.model');
const PatientProfileChangeRequest = require('./patients/patient-profile-change-request.model');

const DoctorSchedule = require('./scheduling/doctor-schedule.model');
const ScheduleSlot = require('./scheduling/schedule-slot.model');
const Appointment = require('./scheduling/appointment.model');
const AppointmentWaitlist = require('./scheduling/appointment-waitlist.model');
const QueueTicket = require('./scheduling/queue-ticket.model');

const Encounter = require('./clinical/encounter.model');
const Consultation = require('./clinical/consultation.model');
const ClinicalNote = require('./clinical/clinical-note.model');
const Diagnosis = require('./clinical/diagnosis.model');
const ProblemList = require('./clinical/problem-list.model');
const Allergy = require('./clinical/allergy.model');
const VitalSign = require('./clinical/vital-sign.model');
const CarePlan = require('./clinical/care-plan.model');

const Order = require('./orders/order.model');

const LabOrder = require('./laboratory/lab-order.model');
const Specimen = require('./laboratory/specimen.model');
const LabResult = require('./laboratory/lab-result.model');
const LabResultItem = require('./laboratory/lab-result-item.model');
const LabTestCatalog = require('./laboratory/lab-test-catalog.model');
const LabResultCorrectionRequest = require('./laboratory/lab-result-correction-request.model');
const LabSlaRule = require('./laboratory/lab-sla-rule.model');
const SpecimenCustodyEvent = require('./laboratory/specimen-custody-event.model');

const ImagingOrder = require('./imaging/imaging-order.model');
const ImagingReport = require('./imaging/imaging-report.model');
const ImagingModality = require('./imaging/imaging-modality.model');
const ImagingRoom = require('./imaging/imaging-room.model');
const ImagingEquipment = require('./imaging/imaging-equipment.model');
const ImagingReportTemplate = require('./imaging/imaging-report-template.model');
const ImagingReportCorrectionRequest = require('./imaging/imaging-report-correction-request.model');

const ProcedureOrder = require('./procedures/procedure-order.model');
const ProcedureResult = require('./procedures/procedure-result.model');

const SpecimenTypeCatalog = require('./clinical-config/specimen-type-catalog.model');
const ProcedureCatalog = require('./clinical-config/procedure-catalog.model');
const ResultReportTemplate = require('./clinical-config/result-report-template.model');
const EquipmentDowntime = require('./clinical-config/equipment-downtime.model');

const DiagnosticAlert = require('./diagnostics/diagnostic-alert.model');

const ClinicalOpsEscalation = require('./clinical-operations/clinical-ops-escalation.model');
const ClinicalOpsSlaRule = require('./clinical-operations/clinical-ops-sla-rule.model');
const ClinicalOpsSlaEvent = require('./clinical-operations/clinical-ops-sla-event.model');
const ClinicalOpsWorkItemLock = require('./clinical-operations/clinical-ops-work-item-lock.model');
const ResultSignature = require('./clinical-operations/result-signature.model');
const ResultDelivery = require('./clinical-operations/result-delivery.model');

const MedicationMaster = require('./pharmacy/medication-master.model');
const MedicationUnit = require('./pharmacy/medication-unit.model');
const DosageForm = require('./pharmacy/dosage-form.model');
const AdministrationRoute = require('./pharmacy/administration-route.model');
const Prescription = require('./pharmacy/prescription.model');
const PrescriptionItem = require('./pharmacy/prescription-item.model');
const PrescriptionRefillRequest = require('./pharmacy/prescription-refill-request.model');
const Dispense = require('./pharmacy/dispense.model');
const DispenseItem = require('./pharmacy/dispense-item.model');
const DispenseHold = require('./pharmacy/dispense-hold.model');
const DispenseReturn = require('./pharmacy/dispense-return.model');
const DispenseReturnItem = require('./pharmacy/dispense-return-item.model');
const DispensePrintJob = require('./pharmacy/dispense-print-job.model');
const MedicationLabelTemplate = require('./pharmacy/medication-label-template.model');
const MedicationAdministration = require('./pharmacy/medication-administration.model');
const MedicationAdministrationEvent = require('./pharmacy/medication-administration-event.model');
const MedicationAdministrationPolicy = require('./pharmacy/medication-administration-policy.model');
const MedicationIntervention = require('./pharmacy/medication-intervention.model');
const StockBatch = require('./pharmacy/stock-batch.model');
const InventoryTransaction = require('./pharmacy/inventory-transaction.model');
const Warehouse = require('./pharmacy/warehouse.model');
const StorageLocation = require('./pharmacy/storage-location.model');
const Supplier = require('./pharmacy/supplier.model');
const InventoryReceipt = require('./pharmacy/inventory-receipt.model');
const InventoryReceiptItem = require('./pharmacy/inventory-receipt-item.model');
const InternalIssue = require('./pharmacy/internal-issue.model');
const InternalIssueItem = require('./pharmacy/internal-issue-item.model');
const InventoryTransfer = require('./pharmacy/inventory-transfer.model');
const InventoryTransferItem = require('./pharmacy/inventory-transfer-item.model');
const InventoryDisposal = require('./pharmacy/inventory-disposal.model');
const InventoryDisposalItem = require('./pharmacy/inventory-disposal-item.model');
const InventoryReturn = require('./pharmacy/inventory-return.model');
const InventoryReturnItem = require('./pharmacy/inventory-return-item.model');
const StocktakeSession = require('./pharmacy/stocktake-session.model');
const StocktakeItem = require('./pharmacy/stocktake-item.model');
const PharmacyAlert = require('./pharmacy/pharmacy-alert.model');
const PharmacyAlertRule = require('./pharmacy/pharmacy-alert-rule.model');
const PharmacyAlertActionLog = require('./pharmacy/pharmacy-alert-action-log.model');
const PharmacyAlertAssignment = require('./pharmacy/pharmacy-alert-assignment.model');
const PharmacyAlertSnooze = require('./pharmacy/pharmacy-alert-snooze.model');
const PharmacyAlertResolution = require('./pharmacy/pharmacy-alert-resolution.model');
const PharmacyWorkItem = require('./pharmacy/pharmacy-work-item.model');
const PharmacyExpiryPolicy = require('./pharmacy/pharmacy-expiry-policy.model');
const ControlledDrugPolicy = require('./pharmacy/controlled-drug-policy.model');
const ControlledDrugLedger = require('./pharmacy/controlled-drug-ledger.model');

const Room = require('./inpatient/room.model');
const Bed = require('./inpatient/bed.model');
const Admission = require('./inpatient/admission.model');
const BedAssignment = require('./inpatient/bed-assignment.model');
const InpatientTask = require('./inpatient/inpatient-task.model');
const InpatientHandover = require('./inpatient/inpatient-handover.model');
const NursingIntake = require('./nursing/nursing-intake.model');
const NursingTask = require('./nursing/nursing-task.model');
const NursingHandoff = require('./nursing/nursing-handoff.model');
const NursingTaskTemplate = require('./nursing/nursing-task-template.model');
const TriageAssessment = require('./nursing/triage-assessment.model');
const ServicePreparationChecklist = require('./nursing/service-preparation-checklist.model');
const ServicePreparation = require('./nursing/service-preparation.model');
const PreparationChecklistTemplate = require('./nursing/preparation-checklist-template.model');
const PreparationChecklistItem = require('./nursing/preparation-checklist-item.model');
const PreparationActivity = require('./nursing/preparation-activity.model');
const VitalSignCorrectionRequest = require('./nursing/vital-sign-correction-request.model');
const NursingMonitoringSession = require('./nursing/nursing-monitoring-session.model');
const NursingMonitoringCheck = require('./nursing/nursing-monitoring-check.model');
const DoctorNotificationRequest = require('./nursing/doctor-notification-request.model');
const ClinicalAlert = require('./nursing/clinical-alert.model');
const ClinicalAlertRule = require('./nursing/clinical-alert-rule.model');
const PostProcedureObservation = require('./nursing/post-procedure-observation.model');
const MedicationReactionObservation = require('./nursing/medication-reaction-observation.model');

const ServiceCatalog = require('./billing/service-catalog.model');
const ServicePriceVersion = require('./billing/service-price-version.model');
const Charge = require('./billing/charge.model');
const Invoice = require('./billing/invoice.model');
const InvoiceItem = require('./billing/invoice-item.model');
const Payment = require('./billing/payment.model');
const PaymentRefund = require('./billing/payment-refund.model');
const PaymentIntent = require('./billing/payment-intent.model');
const BankStatementTransaction = require('./billing/bank-statement-transaction.model');
const ReconciliationBatch = require('./billing/reconciliation-batch.model');
const ReconciliationMatch = require('./billing/reconciliation-match.model');
const ReconciliationRule = require('./billing/reconciliation-rule.model');
const ReconciliationException = require('./billing/reconciliation-exception.model');
const SettlementBatch = require('./billing/settlement-batch.model');
const ProviderWebhookEvent = require('./billing/provider-webhook-event.model');
const ClinicalPaymentOverride = require('./billing/clinical-payment-override.model');
const InsurancePolicy = require('./billing/insurance-policy.model');
const InsuranceClaim = require('./billing/insurance-claim.model');
const CashierShift = require('./billing/cashier-shift.model');
const CashDrawerMovement = require('./billing/cash-drawer-movement.model');
const Receipt = require('./billing/receipt.model');
const ReceiptPrintLog = require('./billing/receipt-print-log.model');

const MedicalRecord = require('./records/medical-record.model');
const Attachment = require('./records/attachment.model');
const AttachmentAccessLog = require('./records/attachment-access-log.model');
const RequiredDocumentRule = require('./records/required-document-rule.model');
const MissingDocumentTask = require('./records/missing-document-task.model');
const DocumentExportRequest = require('./records/document-export-request.model');
const Notification = require('./notifications/notification.model');
const NotificationDelivery = require('./notifications/notification-delivery.model');
const NotificationPreference = require('./notifications/notification-preference.model');
const NotificationTemplate = require('./notifications/notification-template.model');
const BroadcastCampaign = require('./notifications/broadcast-campaign.model');
const SupportTicket = require('./support/support-ticket.model');
const SupportReplyTemplate = require('./support/support-reply-template.model');
const ChatbotSession = require('./chatbot/chat-session.model');
const ChatbotMessage = require('./chatbot/chat-message.model');
const ChatbotIntent = require('./chatbot/chatbot-intent.model');
const ChatbotEntityDictionary = require('./chatbot/chatbot-entity-dictionary.model');
const KnowledgeArticle = require('./chatbot/knowledge-article.model');
const ChatbotFallback = require('./chatbot/chatbot-fallback.model');
const ChatbotAppointmentDraft = require('./chatbot/chatbot-appointment-draft.model');
const Conversation = require('./messaging/conversation.model');
const ConversationCall = require('./messaging/conversation-call.model');
const ConversationParticipant = require('./messaging/conversation-participant.model');
const Message = require('./messaging/message.model');
const MessageAttachment = require('./messaging/message-attachment.model');
const { AuthSession, hashRefreshToken } = require('./auth/auth-session.model');
const {
  PasswordResetToken,
  hashResetToken,
  hashResetCode,
  generateResetToken,
  generateResetCode,
} = require('./auth/password-reset-token.model');
const AuditLog = require('./auth/audit-log.model');
const ApprovalRequest = require('./common/approval-request.model');
const Counter = require('./common/counter.model');
const IdempotencyRecord = require('./common/idempotency-record.model');
const JobRunLog = require('./common/job-run-log.model');
const QrToken = require('./common/qr-token.model');
const EventOutbox = require('../events/event-outbox.model');
const ConsentRecord = require('./access/consent-record.model');
const BreakGlassAccess = require('./access/break-glass-access.model');
const EmergencyCase = require('./emergency/emergency-case.model');
const EmergencyCaseEvent = require('./emergency/emergency-case-event.model');
const EmergencyTriage = require('./emergency/emergency-triage.model');
const FacilityLocation = require('./directory/facility-location.model');

module.exports = {
  Department,
  User,
  UserPreference,
  Role,
  UserRole,
  Permission,
  RolePermission,
  DenyPolicy,
  WorkspaceAccessPolicy,
  SecurityRateLimitEvent,
  SecurityDataAccessPolicy,
  AuditReview,
  AuditExportRequest,
  ComplianceReport,
  DiagnosticRun,
  MaintenanceWindow,
  IntegrationLog,
  IntegrationHealthCheck,
  IntegrationDiagnosticRun,
  PortalFeatureFlag,
  PortalProfileFieldPolicy,
  DoctorProfile,
  SystemSetting,
  SystemSettingRevision,
  AdminToolRun,
  AdminToolFinding,
  AdminToolApproval,
  Patient,
  PatientIdentifier,
  PatientAccount,
  PatientRelative,
  PatientAuthorization,
  PatientProfileChangeRequest,
  DoctorSchedule,
  ScheduleSlot,
  Appointment,
  AppointmentWaitlist,
  QueueTicket,
  Encounter,
  Consultation,
  ClinicalNote,
  Diagnosis,
  ProblemList,
  Allergy,
  VitalSign,
  CarePlan,
  Order,
  LabOrder,
  Specimen,
  LabResult,
  LabResultItem,
  LabTestCatalog,
  LabResultCorrectionRequest,
  LabSlaRule,
  SpecimenCustodyEvent,
  ImagingOrder,
  ImagingReport,
  ImagingModality,
  ImagingRoom,
  ImagingEquipment,
  ImagingReportTemplate,
  ImagingReportCorrectionRequest,
  ProcedureOrder,
  ProcedureResult,
  SpecimenTypeCatalog,
  ProcedureCatalog,
  ResultReportTemplate,
  EquipmentDowntime,
  DiagnosticAlert,
  ClinicalOpsEscalation,
  ClinicalOpsSlaRule,
  ClinicalOpsSlaEvent,
  ClinicalOpsWorkItemLock,
  ResultSignature,
  ResultDelivery,
  MedicationMaster,
  MedicationUnit,
  DosageForm,
  AdministrationRoute,
  Prescription,
  PrescriptionItem,
  PrescriptionRefillRequest,
  Dispense,
  DispenseItem,
  DispenseHold,
  DispenseReturn,
  DispenseReturnItem,
  DispensePrintJob,
  MedicationLabelTemplate,
  MedicationAdministration,
  MedicationAdministrationEvent,
  MedicationAdministrationPolicy,
  MedicationIntervention,
  StockBatch,
  InventoryTransaction,
  Warehouse,
  StorageLocation,
  Supplier,
  InventoryReceipt,
  InventoryReceiptItem,
  InternalIssue,
  InternalIssueItem,
  InventoryTransfer,
  InventoryTransferItem,
  InventoryDisposal,
  InventoryDisposalItem,
  InventoryReturn,
  InventoryReturnItem,
  StocktakeSession,
  StocktakeItem,
  PharmacyAlert,
  PharmacyAlertRule,
  PharmacyAlertActionLog,
  PharmacyAlertAssignment,
  PharmacyAlertSnooze,
  PharmacyAlertResolution,
  PharmacyWorkItem,
  PharmacyExpiryPolicy,
  ControlledDrugPolicy,
  ControlledDrugLedger,
  Room,
  Bed,
  Admission,
  BedAssignment,
  InpatientTask,
  InpatientHandover,
  NursingIntake,
  NursingTask,
  NursingHandoff,
  NursingTaskTemplate,
  TriageAssessment,
  ServicePreparationChecklist,
  ServicePreparation,
  PreparationChecklistTemplate,
  PreparationChecklistItem,
  PreparationActivity,
  VitalSignCorrectionRequest,
  NursingMonitoringSession,
  NursingMonitoringCheck,
  DoctorNotificationRequest,
  ClinicalAlert,
  ClinicalAlertRule,
  PostProcedureObservation,
  MedicationReactionObservation,
  ServiceCatalog,
  ServicePriceVersion,
  Charge,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentRefund,
  PaymentIntent,
  BankStatementTransaction,
  ReconciliationBatch,
  ReconciliationMatch,
  ReconciliationRule,
  ReconciliationException,
  SettlementBatch,
  ProviderWebhookEvent,
  ClinicalPaymentOverride,
  InsurancePolicy,
  InsuranceClaim,
  CashierShift,
  CashDrawerMovement,
  Receipt,
  ReceiptPrintLog,
  MedicalRecord,
  Attachment,
  AttachmentAccessLog,
  RequiredDocumentRule,
  MissingDocumentTask,
  DocumentExportRequest,
  Notification,
  NotificationDelivery,
  NotificationPreference,
  NotificationTemplate,
  BroadcastCampaign,
  SupportTicket,
  SupportReplyTemplate,
  ChatbotSession,
  ChatbotMessage,
  ChatbotIntent,
  ChatbotEntityDictionary,
  KnowledgeArticle,
  ChatbotFallback,
  ChatbotAppointmentDraft,
  Conversation,
  ConversationCall,
  ConversationParticipant,
  Message,
  MessageAttachment,
  AuthSession,
  hashRefreshToken,
  PasswordResetToken,
  hashResetToken,
  hashResetCode,
  generateResetToken,
  generateResetCode,
  AuditLog,
  ApprovalRequest,
  Counter,
  IdempotencyRecord,
  JobRunLog,
  QrToken,
  EventOutbox,
  ConsentRecord,
  BreakGlassAccess,
  EmergencyCase,
  EmergencyCaseEvent,
  EmergencyTriage,
  FacilityLocation,
};
