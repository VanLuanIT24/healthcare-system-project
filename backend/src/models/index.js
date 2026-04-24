const Department = require('./iam/department.model');
const User = require('./iam/user.model');
const Role = require('./iam/role.model');
const UserRole = require('./iam/user-role.model');
const Permission = require('./iam/permission.model');
const RolePermission = require('./iam/role-permission.model');

const Patient = require('./patients/patient.model');
const PatientIdentifier = require('./patients/patient-identifier.model');
const PatientAccount = require('./patients/patient-account.model');

const DoctorSchedule = require('./scheduling/doctor-schedule.model');
const Appointment = require('./scheduling/appointment.model');
const QueueTicket = require('./scheduling/queue-ticket.model');

const Encounter = require('./clinical/encounter.model');
const Consultation = require('./clinical/consultation.model');
const ClinicalNote = require('./clinical/clinical-note.model');
const Diagnosis = require('./clinical/diagnosis.model');
const VitalSign = require('./clinical/vital-sign.model');

const MedicationMaster = require('./pharmacy/medication-master.model');
const Prescription = require('./pharmacy/prescription.model');
const PrescriptionItem = require('./pharmacy/prescription-item.model');
const { AuthSession, hashRefreshToken } = require('./auth/auth-session.model');
const {
  PasswordResetToken,
  hashResetToken,
  generateResetToken,
  generateResetCode,
} = require('./auth/password-reset-token.model');
const AuditLog = require('./auth/audit-log.model');

module.exports = {
  Department,
  User,
  Role,
  UserRole,
  Permission,
  RolePermission,
  Patient,
  PatientIdentifier,
  PatientAccount,
  DoctorSchedule,
  Appointment,
  QueueTicket,
  Encounter,
  Consultation,
  ClinicalNote,
  Diagnosis,
  VitalSign,
  MedicationMaster,
  Prescription,
  PrescriptionItem,
  AuthSession,
  hashRefreshToken,
  PasswordResetToken,
  hashResetToken,
  generateResetToken,
  generateResetCode,
  AuditLog,
};
