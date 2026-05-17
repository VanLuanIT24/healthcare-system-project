const RECORD_TYPE = {
  OUTPATIENT: 'outpatient',
  INPATIENT: 'inpatient',
  EMERGENCY: 'emergency',
  LAB: 'lab',
  IMAGING: 'imaging',
  PROCEDURE: 'procedure',
  PHARMACY: 'pharmacy',
  OTHER: 'other',
};

const RECORD_TYPES = Object.values(RECORD_TYPE);

const MEDICAL_RECORD_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  FINALIZED: 'finalized',
  ARCHIVED: 'archived',
  SEALED: 'sealed',
  VOIDED: 'voided',
};

const MEDICAL_RECORD_STATUSES = Object.values(MEDICAL_RECORD_STATUS);

const ATTACHMENT_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
};

const ATTACHMENT_STATUSES = Object.values(ATTACHMENT_STATUS);

const ATTACHMENT_ENTITY_TYPE = {
  PATIENT: 'patient',
  ENCOUNTER: 'encounter',
  MEDICAL_RECORD: 'medical_record',
  ORDER: 'order',
  LAB_RESULT: 'lab_result',
  IMAGING_ORDER: 'imaging_order',
  IMAGING_REPORT: 'imaging_report',
  PROCEDURE_ORDER: 'procedure_order',
  PRESCRIPTION: 'prescription',
  DISPENSE: 'dispense',
  INVOICE: 'invoice',
  PAYMENT: 'payment',
  INSURANCE_CLAIM: 'insurance_claim',
  ADMISSION: 'admission',
  OTHER: 'other',
};

const ATTACHMENT_ENTITY_TYPES = Object.values(ATTACHMENT_ENTITY_TYPE);

const NOTIFICATION_CHANNEL = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
};

const NOTIFICATION_CHANNELS = Object.values(NOTIFICATION_CHANNEL);

const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  ARCHIVED: 'archived',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const NOTIFICATION_STATUSES = Object.values(NOTIFICATION_STATUS);

const NOTIFICATION_RECIPIENT_TYPE = {
  STAFF: 'staff',
  PATIENT: 'patient',
  RELATIVE: 'relative',
  SYSTEM: 'system',
};

const NOTIFICATION_RECIPIENT_TYPES = Object.values(NOTIFICATION_RECIPIENT_TYPE);

const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
  CRITICAL: 'critical',
};

const NOTIFICATION_PRIORITIES = Object.values(NOTIFICATION_PRIORITY);

const NOTIFICATION_TYPE = {
  SYSTEM: 'system',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_RESCHEDULED: 'appointment.rescheduled',
  APPOINTMENT_REMINDER: 'appointment.reminder',
  PATIENT_CHECKED_IN: 'patient.checked_in',
  QUEUE_CALLED: 'queue.called',
  LAB_RESULT_FINAL: 'lab.result_final',
  LAB_RESULT_AMENDED: 'lab.result_amended',
  LAB_RESULT_CRITICAL: 'lab.result_critical',
  LAB_RESULT_RELEASED: 'lab.result_released',
  IMAGING_REPORT_FINAL: 'imaging.report_final',
  IMAGING_REPORT_AMENDED: 'imaging.report_amended',
  IMAGING_REPORT_CRITICAL: 'imaging.report_critical',
  IMAGING_REPORT_RELEASED: 'imaging.report_released',
  PRESCRIPTION_VERIFIED: 'prescription.verified',
  DISPENSE_COMPLETED: 'dispense.completed',
  INVOICE_ISSUED: 'invoice.issued',
  INVOICE_UNPAID: 'invoice.unpaid',
  PAYMENT_RECEIVED: 'payment.received',
  INSURANCE_CLAIM_SUBMITTED: 'insurance.claim_submitted',
  INSURANCE_CLAIM_APPROVED: 'insurance.claim_approved',
  INSURANCE_CLAIM_REJECTED: 'insurance.claim_rejected',
  SCHEDULE_PUBLISHED: 'schedule.published',
  SCHEDULE_CANCELLED: 'schedule.cancelled',
  ADMISSION_CREATED: 'admission.created',
  ADMISSION_DISCHARGED: 'admission.discharged',
  PROCEDURE_ORDER_COMPLETED: 'procedure_order.completed',
  PROCEDURE_ORDER_CANCELLED: 'procedure_order.cancelled',
  PROCEDURE_ORDER_NO_SHOW: 'procedure_order.no_show',
  MEDICAL_RECORD_RELEASED: 'medical_record.released',
};

const NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPE);

module.exports = {
  RECORD_TYPE,
  RECORD_TYPES,
  MEDICAL_RECORD_STATUS,
  MEDICAL_RECORD_STATUSES,
  ATTACHMENT_STATUS,
  ATTACHMENT_STATUSES,
  ATTACHMENT_ENTITY_TYPE,
  ATTACHMENT_ENTITY_TYPES,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_RECIPIENT_TYPE,
  NOTIFICATION_RECIPIENT_TYPES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPE,
  NOTIFICATION_TYPES,
};
