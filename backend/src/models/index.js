const Department = require('./iam/department.model');
const User = require('./iam/user.model');
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

const DoctorSchedule = require('./scheduling/doctor-schedule.model');
const ScheduleSlot = require('./scheduling/schedule-slot.model');
const Appointment = require('./scheduling/appointment.model');
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

const ImagingOrder = require('./imaging/imaging-order.model');
const ImagingReport = require('./imaging/imaging-report.model');

const ProcedureOrder = require('./procedures/procedure-order.model');

const MedicationMaster = require('./pharmacy/medication-master.model');
const Prescription = require('./pharmacy/prescription.model');
const PrescriptionItem = require('./pharmacy/prescription-item.model');
const Dispense = require('./pharmacy/dispense.model');
const DispenseItem = require('./pharmacy/dispense-item.model');
const MedicationAdministration = require('./pharmacy/medication-administration.model');
const StockBatch = require('./pharmacy/stock-batch.model');
const InventoryTransaction = require('./pharmacy/inventory-transaction.model');

const Room = require('./inpatient/room.model');
const Bed = require('./inpatient/bed.model');
const Admission = require('./inpatient/admission.model');
const BedAssignment = require('./inpatient/bed-assignment.model');

const ServiceCatalog = require('./billing/service-catalog.model');
const Charge = require('./billing/charge.model');
const Invoice = require('./billing/invoice.model');
const InvoiceItem = require('./billing/invoice-item.model');
const Payment = require('./billing/payment.model');
const InsurancePolicy = require('./billing/insurance-policy.model');
const InsuranceClaim = require('./billing/insurance-claim.model');

const MedicalRecord = require('./records/medical-record.model');
const Attachment = require('./records/attachment.model');
const Notification = require('./notifications/notification.model');
const { AuthSession, hashRefreshToken } = require('./auth/auth-session.model');
const {
  PasswordResetToken,
  hashResetToken,
  hashResetCode,
  generateResetToken,
  generateResetCode,
} = require('./auth/password-reset-token.model');
const AuditLog = require('./auth/audit-log.model');
const Counter = require('./common/counter.model');

module.exports = {
  Department,
  User,
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
  DoctorSchedule,
  ScheduleSlot,
  Appointment,
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
  ImagingOrder,
  ImagingReport,
  ProcedureOrder,
  MedicationMaster,
  Prescription,
  PrescriptionItem,
  Dispense,
  DispenseItem,
  MedicationAdministration,
  StockBatch,
  InventoryTransaction,
  Room,
  Bed,
  Admission,
  BedAssignment,
  ServiceCatalog,
  Charge,
  Invoice,
  InvoiceItem,
  Payment,
  InsurancePolicy,
  InsuranceClaim,
  MedicalRecord,
  Attachment,
  Notification,
  AuthSession,
  hashRefreshToken,
  PasswordResetToken,
  hashResetToken,
  hashResetCode,
  generateResetToken,
  generateResetCode,
  AuditLog,
  Counter,
};
