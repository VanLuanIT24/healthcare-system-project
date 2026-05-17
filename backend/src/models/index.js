const Department = require('./iam/department.model');
const User = require('./iam/user.model');
const UserPreference = require('./iam/user-preference.model');
const Role = require('./iam/role.model');
const UserRole = require('./iam/user-role.model');
const Permission = require('./iam/permission.model');
const RolePermission = require('./iam/role-permission.model');

const DoctorProfile = require('./admin/doctor-profile.model');
const SystemSetting = require('./admin/system-setting.model');

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

const ImagingOrder = require('./imaging/imaging-order.model');
const ImagingReport = require('./imaging/imaging-report.model');
const ImagingModality = require('./imaging/imaging-modality.model');

const ProcedureOrder = require('./procedures/procedure-order.model');

const MedicationMaster = require('./pharmacy/medication-master.model');
const Prescription = require('./pharmacy/prescription.model');
const PrescriptionItem = require('./pharmacy/prescription-item.model');
const PrescriptionRefillRequest = require('./pharmacy/prescription-refill-request.model');
const Dispense = require('./pharmacy/dispense.model');
const DispenseItem = require('./pharmacy/dispense-item.model');
const MedicationAdministration = require('./pharmacy/medication-administration.model');
const StockBatch = require('./pharmacy/stock-batch.model');
const InventoryTransaction = require('./pharmacy/inventory-transaction.model');

const Room = require('./inpatient/room.model');
const Bed = require('./inpatient/bed.model');
const Admission = require('./inpatient/admission.model');
const BedAssignment = require('./inpatient/bed-assignment.model');
const InpatientTask = require('./inpatient/inpatient-task.model');

const ServiceCatalog = require('./billing/service-catalog.model');
const Charge = require('./billing/charge.model');
const Invoice = require('./billing/invoice.model');
const InvoiceItem = require('./billing/invoice-item.model');
const Payment = require('./billing/payment.model');
const PaymentIntent = require('./billing/payment-intent.model');
const InsurancePolicy = require('./billing/insurance-policy.model');
const InsuranceClaim = require('./billing/insurance-claim.model');

const MedicalRecord = require('./records/medical-record.model');
const Attachment = require('./records/attachment.model');
const DocumentExportRequest = require('./records/document-export-request.model');
const Notification = require('./notifications/notification.model');
const NotificationDelivery = require('./notifications/notification-delivery.model');
const NotificationPreference = require('./notifications/notification-preference.model');
const NotificationTemplate = require('./notifications/notification-template.model');
const SupportTicket = require('./support/support-ticket.model');
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
const FacilityLocation = require('./directory/facility-location.model');

module.exports = {
  Department,
  User,
  UserPreference,
  Role,
  UserRole,
  Permission,
  RolePermission,
  DoctorProfile,
  SystemSetting,
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
  ImagingOrder,
  ImagingReport,
  ImagingModality,
  ProcedureOrder,
  MedicationMaster,
  Prescription,
  PrescriptionItem,
  PrescriptionRefillRequest,
  Dispense,
  DispenseItem,
  MedicationAdministration,
  StockBatch,
  InventoryTransaction,
  Room,
  Bed,
  Admission,
  BedAssignment,
  InpatientTask,
  ServiceCatalog,
  Charge,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentIntent,
  InsurancePolicy,
  InsuranceClaim,
  MedicalRecord,
  Attachment,
  DocumentExportRequest,
  Notification,
  NotificationDelivery,
  NotificationPreference,
  NotificationTemplate,
  SupportTicket,
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
  FacilityLocation,
};
