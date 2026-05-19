const appointmentJobs = require('./appointment.jobs');
const documentJobs = require('./document.jobs');
const emergencyJobs = require('./emergency.jobs');
const insuranceJobs = require('./insurance.jobs');
const inpatientJobs = require('./inpatient.jobs');
const jobQueue = require('./job-queue.service');
const notificationJobs = require('./notification.jobs');
const paymentJobs = require('./payment.jobs');
const pharmacyJobs = require('./pharmacy.jobs');
const nursingTaskJobs = require('./nursing-task.jobs');
const sessionJobs = require('./session.jobs');
const supportJobs = require('./support.jobs');

const JOB_NAMES = {
  EXPIRE_PAYMENT_INTENTS: 'expirePaymentIntents',
  EXPIRE_QR_TOKENS: 'expireQrTokens',
  SEND_APPOINTMENT_REMINDERS: 'sendAppointmentReminders',
  MARK_NO_SHOW_APPOINTMENTS: 'markNoShowAppointments',
  CLOSE_EXPIRED_SCHEDULE_SLOTS: 'closeExpiredScheduleSlots',
  EXPIRE_DOCUMENT_EXPORTS: 'expireDocumentExports',
  PURGE_TEMPORARY_EXPORT_FILES: 'purgeTemporaryExportFiles',
  EXPIRE_SUPPORT_SLA: 'expireSupportSla',
  SEND_INSURANCE_EXPIRY_REMINDER: 'sendInsuranceExpiryReminder',
  DAILY_BED_CHARGE_POSTING: 'dailyBedChargePosting',
  LOW_STOCK_ALERT: 'lowStockAlert',
  DRUG_EXPIRY_ALERT: 'drugExpiryAlert',
  CLEANUP_OLD_SESSIONS: 'cleanupOldSessions',
  ARCHIVE_OLD_NOTIFICATIONS: 'archiveOldNotifications',
  DETECT_OVERDUE_NURSING_TASKS: 'detectOverdueNursingTasks',
};

module.exports = {
  JOB_NAMES,
  jobQueue,
  enqueueJob: jobQueue.enqueueJob,
  createWorker: jobQueue.createWorker,
  publishOutboxEvents: notificationJobs.publishOutboxEvents,
  dispatchQueuedNotifications: notificationJobs.dispatchQueuedNotifications,
  dispatchNotificationDeliveries: notificationJobs.dispatchNotificationDeliveries,
  archiveOldNotifications: notificationJobs.archiveOldNotifications,
  detectOverdueNursingTasks: nursingTaskJobs.detectOverdueNursingTasks,
  expirePaymentIntents: paymentJobs.expirePaymentIntents,
  expireQrTokens: async () => ({ status: 'not_required', message: 'QR verification checks expires_at directly; add cleanup if storage volume requires it.' }),
  sendAppointmentReminders: appointmentJobs.sendAppointmentReminders,
  markNoShowAppointments: appointmentJobs.markNoShowAppointments,
  closeExpiredScheduleSlots: appointmentJobs.closeExpiredScheduleSlots,
  expireDocumentExports: documentJobs.expireDocumentExports,
  markDocumentExportReady: documentJobs.markDocumentExportReady,
  purgeTemporaryExportFiles: documentJobs.purgeTemporaryExportFiles,
  expireSupportSla: supportJobs.expireSupportSla,
  sendInsuranceExpiryReminder: insuranceJobs.sendInsuranceExpiryReminder,
  dailyBedChargePosting: inpatientJobs.dailyBedChargePosting,
  lowStockAlert: pharmacyJobs.lowStockAlert,
  drugExpiryAlert: pharmacyJobs.drugExpiryAlert,
  cleanupOldSessions: sessionJobs.cleanupOldSessions,
  escalateOpenEmergencyCases: emergencyJobs.escalateOpenEmergencyCases,
};
