const SUPPORT_CATEGORY = {
  APPOINTMENT: 'appointment',
  BILLING: 'billing',
  INSURANCE: 'insurance',
  MEDICAL_RECORD: 'medical_record',
  TECHNICAL: 'technical',
  COMPLAINT: 'complaint',
  PHARMACY: 'pharmacy',
  OTHER: 'other',
};

const SUPPORT_CATEGORIES = Object.values(SUPPORT_CATEGORY);

const SUPPORT_TICKET_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

const SUPPORT_TICKET_PRIORITIES = Object.values(SUPPORT_TICKET_PRIORITY);

const SUPPORT_TICKET_STATUS = {
  OPEN: 'open',
  WAITING_PATIENT: 'waiting_patient',
  WAITING_STAFF: 'waiting_staff',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

const SUPPORT_TICKET_STATUSES = Object.values(SUPPORT_TICKET_STATUS);

const SUPPORT_TICKET_SLA_MINUTES = {
  [SUPPORT_TICKET_PRIORITY.URGENT]: 15,
  [SUPPORT_TICKET_PRIORITY.HIGH]: 120,
  [SUPPORT_TICKET_PRIORITY.NORMAL]: 1440,
  [SUPPORT_TICKET_PRIORITY.LOW]: 4320,
};

const PAYMENT_PROVIDER = {
  BANK_QR_MANUAL: 'bank_qr_manual',
  MOMO_PERSONAL_QR: 'momo_personal_qr',
  CASH_MANUAL: 'cash_manual',
  BANK_QR: 'bank_qr',
};

const PAYMENT_PROVIDERS = Object.values(PAYMENT_PROVIDER);

const PAYMENT_INTENT_METHOD = {
  QR: 'qr',
  QR_MANUAL: 'qr_manual',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  WALLET: 'wallet',
  CASH: 'cash',
};

const PAYMENT_INTENT_METHODS = Object.values(PAYMENT_INTENT_METHOD);

const PAYMENT_INTENT_STATUS = {
  CREATED: 'created',
  PENDING: 'pending',
  PENDING_MANUAL_CONFIRMATION: 'pending_manual_confirmation',
  SUBMITTED_RECEIPT: 'submitted_receipt',
  REQUIRES_ACTION: 'requires_action',
  CONFIRMED: 'confirmed',
  MANUAL_REVIEW: 'manual_review',
  PAID: 'paid',
  REJECTED: 'rejected',
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUNDED_MANUAL: 'refunded_manual',
};

const PAYMENT_INTENT_STATUSES = Object.values(PAYMENT_INTENT_STATUS);

const QR_TOKEN_TYPE = {
  PAYMENT: 'payment',
  APPOINTMENT_CHECKIN: 'appointment_checkin',
  QUEUE_TICKET: 'queue_ticket',
  PRESCRIPTION_VERIFY: 'prescription_verify',
  LAB_RESULT_VERIFY: 'lab_result_verify',
  RECEIPT_VERIFY: 'receipt_verify',
  PATIENT_CARD: 'patient_card',
};

const QR_TOKEN_TYPES = Object.values(QR_TOKEN_TYPE);

const DOCUMENT_SOURCE = {
  STAFF_UPLOAD: 'staff_upload',
  PATIENT_UPLOAD: 'patient_upload',
  SYSTEM_GENERATED: 'system_generated',
  EXTERNAL_IMPORT: 'external_import',
};

const DOCUMENT_SOURCES = Object.values(DOCUMENT_SOURCE);

const DOCUMENT_REVIEW_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

const DOCUMENT_REVIEW_STATUSES = Object.values(DOCUMENT_REVIEW_STATUS);

const DOCUMENT_VISIBILITY = {
  STAFF_ONLY: 'staff_only',
  PATIENT_VISIBLE: 'patient_visible',
  SHARED_WITH_RELATIVE: 'shared_with_relative',
};

const DOCUMENT_VISIBILITIES = Object.values(DOCUMENT_VISIBILITY);

const DOCUMENT_CATEGORY = {
  IDENTITY_CARD: 'identity_card',
  INSURANCE_CARD: 'insurance_card',
  REFERRAL_LETTER: 'referral_letter',
  EXTERNAL_LAB_RESULT: 'external_lab_result',
  EXTERNAL_IMAGING_RESULT: 'external_imaging_result',
  EXTERNAL_PRESCRIPTION: 'external_prescription',
  DISCHARGE_SUMMARY: 'discharge_summary',
  CONSENT_FORM: 'consent_form',
  PAYMENT_DOCUMENT: 'payment_document',
  OTHER: 'other',
};

const DOCUMENT_CATEGORIES = Object.values(DOCUMENT_CATEGORY);

const DOCUMENT_EXPORT_TYPE = {
  ATTACHMENTS_ZIP: 'attachments_zip',
  MEDICAL_RECORD_PACKAGE: 'medical_record_package',
};

const DOCUMENT_EXPORT_TYPES = Object.values(DOCUMENT_EXPORT_TYPE);

const DOCUMENT_EXPORT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

const DOCUMENT_EXPORT_STATUSES = Object.values(DOCUMENT_EXPORT_STATUS);

const INSURANCE_POLICY_SOURCE = {
  STAFF_CREATED: 'staff_created',
  PATIENT_SUBMITTED: 'patient_submitted',
};

const INSURANCE_POLICY_SOURCES = Object.values(INSURANCE_POLICY_SOURCE);

const INSURANCE_VERIFICATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PENDING_REVIEW: 'pending_review',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

const INSURANCE_VERIFICATION_STATUSES = Object.values(INSURANCE_VERIFICATION_STATUS);

const EMERGENCY_CASE_TYPE = {
  SOS: 'sos',
  MEDICAL_EMERGENCY: 'medical_emergency',
  PANIC: 'panic',
  FALL: 'fall',
  OTHER: 'other',
};

const EMERGENCY_CASE_TYPES = Object.values(EMERGENCY_CASE_TYPE);

const EMERGENCY_STATUS = {
  CREATED: 'created',
  ACKNOWLEDGED: 'acknowledged',
  TRIAGED: 'triaged',
  DISPATCHED: 'dispatched',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
  FALSE_ALARM: 'false_alarm',
};

const EMERGENCY_STATUSES = Object.values(EMERGENCY_STATUS);

const EMERGENCY_PRIORITY = {
  URGENT: 'urgent',
  CRITICAL: 'critical',
};

const EMERGENCY_PRIORITIES = Object.values(EMERGENCY_PRIORITY);

const FACILITY_LOCATION_TYPE = {
  CLINIC: 'clinic',
  PHARMACY: 'pharmacy',
  LAB: 'lab',
  IMAGING: 'imaging',
  HOSPITAL_BRANCH: 'hospital_branch',
};

const FACILITY_LOCATION_TYPES = Object.values(FACILITY_LOCATION_TYPE);

const FACILITY_LOCATION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  CLOSED: 'closed',
};

const FACILITY_LOCATION_STATUSES = Object.values(FACILITY_LOCATION_STATUS);

const CONSENT_TYPE = {
  CONSENT_TO_TREAT: 'consent_to_treat',
  CONSENT_TO_SHARE_RECORD: 'consent_to_share_record',
  CONSENT_FOR_RELATIVE_ACCESS: 'consent_for_relative_access',
  CONSENT_FOR_TELEHEALTH: 'consent_for_telehealth',
  CONSENT_FOR_PAYMENT: 'consent_for_payment',
  CONSENT_FOR_DATA_PROCESSING: 'consent_for_data_processing',
  IMAGING_CONTRAST_CONSENT: 'imaging_contrast_consent',
  PROCEDURE_CONSENT: 'procedure_consent',
};

const CONSENT_TYPES = Object.values(CONSENT_TYPE);

const CONSENT_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
};

const CONSENT_STATUSES = Object.values(CONSENT_STATUS);

const BREAK_GLASS_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
};

const BREAK_GLASS_STATUSES = Object.values(BREAK_GLASS_STATUS);

const APPOINTMENT_WAITLIST_STATUS = {
  WAITING: 'waiting',
  OFFERED: 'offered',
  BOOKED: 'booked',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const APPOINTMENT_WAITLIST_STATUSES = Object.values(APPOINTMENT_WAITLIST_STATUS);

const PRESCRIPTION_REFILL_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const PRESCRIPTION_REFILL_REQUEST_STATUSES = Object.values(PRESCRIPTION_REFILL_REQUEST_STATUS);

const APPROVAL_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const APPROVAL_REQUEST_STATUSES = Object.values(APPROVAL_REQUEST_STATUS);

const APPROVAL_REQUEST_TYPE = {
  LARGE_DISCOUNT: 'large_discount',
  REFUND: 'refund',
  VOID_INVOICE: 'void_invoice',
  ARCHIVE_MEDICAL_DOCUMENT: 'archive_medical_document',
  BREAK_GLASS_REVIEW: 'break_glass_review',
  ROLE_PERMISSION_CHANGE: 'role_permission_change',
  MANUAL_STOCK_ADJUSTMENT: 'manual_stock_adjustment',
  INSURANCE_CLAIM_RESUBMIT: 'insurance_claim_resubmit',
};

const APPROVAL_REQUEST_TYPES = Object.values(APPROVAL_REQUEST_TYPE);

const INPATIENT_TASK_TYPE = {
  ROUND: 'round',
  NURSING_CARE: 'nursing_care',
  DIET: 'diet',
  CLEANING: 'cleaning',
  DISCHARGE_CHECKLIST: 'discharge_checklist',
  VITAL_SIGN: 'vital_sign',
  MEDICATION: 'medication',
  WOUND_CARE: 'wound_care',
  FALL_RISK_CHECK: 'fall_risk_check',
  PRESSURE_ULCER_CHECK: 'pressure_ulcer_check',
  ISOLATION_CHECK: 'isolation_check',
  FLUID_BALANCE: 'fluid_balance',
  INTAKE_OUTPUT: 'intake_output',
  POST_PROCEDURE_MONITORING: 'post_procedure_monitoring',
  DOCTOR_NOTIFY: 'doctor_notify',
  LAB_SAMPLE: 'lab_sample',
  TRANSPORT: 'transport',
  DISCHARGE_EDUCATION: 'discharge_education',
  FAMILY_CALL: 'family_call',
  OTHER: 'other',
};

const INPATIENT_TASK_TYPES = Object.values(INPATIENT_TASK_TYPE);

const INPATIENT_TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled',
};

const INPATIENT_TASK_STATUSES = Object.values(INPATIENT_TASK_STATUS);

const CATALOG_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  RETIRED: 'retired',
};

const CATALOG_STATUSES = Object.values(CATALOG_STATUS);

const NOTIFICATION_PREFERENCE_CHANNEL = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
};

const NOTIFICATION_PREFERENCE_CHANNELS = Object.values(NOTIFICATION_PREFERENCE_CHANNEL);

const EVENT_OUTBOX_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DEAD_LETTER: 'dead_letter',
};

const EVENT_OUTBOX_STATUSES = Object.values(EVENT_OUTBOX_STATUS);

const IDEMPOTENCY_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const IDEMPOTENCY_STATUSES = Object.values(IDEMPOTENCY_STATUS);

const NOTIFICATION_DELIVERY_CHANNEL = {
  IN_APP: 'in_app',
  SOCKET: 'socket',
  EMAIL: 'email',
  PUSH: 'push',
};

const NOTIFICATION_DELIVERY_CHANNELS = Object.values(NOTIFICATION_DELIVERY_CHANNEL);

const NOTIFICATION_DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  SKIPPED: 'skipped',
  FAILED: 'failed',
};

const NOTIFICATION_DELIVERY_STATUSES = Object.values(NOTIFICATION_DELIVERY_STATUS);

const REALTIME_EVENT_TYPE = {
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_UPDATED: 'notification.updated',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_ARCHIVED: 'notification.archived',
  NOTIFICATION_DELIVERY_FAILED: 'notification.delivery_failed',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_READ: 'message.read',
  MESSAGE_EDITED: 'message.edited',
  MESSAGE_DELETED: 'message.deleted',
  TYPING_STARTED: 'typing.started',
  TYPING_STOPPED: 'typing.stopped',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_CLOSED: 'conversation.closed',
  CONVERSATION_REOPENED: 'conversation.reopened',
  CALL_STARTED: 'call.started',
  CALL_ENDED: 'call.ended',
  CALL_TRANSCRIPT_READY: 'call.transcript_ready',
  SUPPORT_TICKET_CREATED: 'support_ticket.created',
  SUPPORT_TICKET_ASSIGNED: 'support_ticket.assigned',
  SUPPORT_TICKET_REPLY_ADDED: 'support_ticket.reply_added',
  SUPPORT_TICKET_PRIORITY_CHANGED: 'support_ticket.priority_changed',
  SUPPORT_TICKET_SLA_WARNING: 'support_ticket.sla_warning',
  SUPPORT_TICKET_SLA_BREACHED: 'support_ticket.sla_breached',
  SUPPORT_TICKET_RESOLVED: 'support_ticket.resolved',
  SUPPORT_TICKET_REOPENED: 'support_ticket.reopened',
  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_RESCHEDULED: 'appointment.rescheduled',
  APPOINTMENT_REMINDER: 'appointment.reminder',
  QUEUE_TICKET_CREATED: 'queue.ticket_created',
  QUEUE_CALLED: 'queue.called',
  QUEUE_RECALLED: 'queue.recalled',
  QUEUE_SKIPPED: 'queue.skipped',
  QUEUE_SERVICE_STARTED: 'queue.service_started',
  QUEUE_COMPLETED: 'queue.completed',
  QUEUE_CANCELLED: 'queue.cancelled',
  QUEUE_NO_SHOW: 'queue.no_show',
  QUEUE_TRANSFERRED: 'queue.transferred',
  QUEUE_ESTIMATED_TIME_UPDATED: 'queue.estimated_time_updated',
  PAYMENT_INTENT_CREATED: 'payment_intent.created',
  PAYMENT_INTENT_PENDING: 'payment_intent.pending',
  PAYMENT_INTENT_PAID: 'payment_intent.paid',
  PAYMENT_INTENT_FAILED: 'payment_intent.failed',
  PAYMENT_INTENT_EXPIRED: 'payment_intent.expired',
  PAYMENT_REFUNDED: 'payment.refunded',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PARTIALLY_PAID: 'invoice.partially_paid',
  RECEIPT_GENERATED: 'receipt.generated',
  LAB_ORDER_CREATED: 'lab_order.created',
  LAB_SAMPLE_COLLECTED: 'lab_sample_collected',
  LAB_RESULT_READY: 'lab_result_ready',
  LAB_RESULT_RELEASED: 'lab_result_released',
  LAB_CRITICAL_VALUE: 'lab_critical_value',
  IMAGING_ORDER_CREATED: 'imaging_order_created',
  IMAGING_REPORT_READY: 'imaging_report_ready',
  IMAGING_REPORT_RELEASED: 'imaging_report_released',
  IMAGING_CRITICAL_FINDING: 'imaging_critical_finding',
  SERVICE_PREPARATION_CREATED: 'service_preparation.created',
  SERVICE_PREPARATION_ASSIGNED: 'service_preparation.assigned',
  SERVICE_PREPARATION_STARTED: 'service_preparation.started',
  SERVICE_PREPARATION_UPDATED: 'service_preparation.updated',
  SERVICE_PREPARATION_BLOCKED: 'service_preparation.blocked',
  SERVICE_PREPARATION_UNBLOCKED: 'service_preparation.unblocked',
  SERVICE_PREPARATION_READY: 'service_preparation.ready',
  SERVICE_PREPARATION_TRANSFERRED: 'service_preparation.transferred',
  SERVICE_PREPARATION_COMPLETED: 'service_preparation.completed',
  SERVICE_PREPARATION_CANCELLED: 'service_preparation.cancelled',
  SERVICE_PREPARATION_CHECKLIST_UPDATED: 'service_preparation.checklist_updated',
  SERVICE_PREPARATION_ESCALATED: 'service_preparation.escalated',
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_REVIEW_REQUESTED: 'document.review_requested',
  DOCUMENT_APPROVED: 'document.approved',
  DOCUMENT_REJECTED: 'document.rejected',
  DOCUMENT_ARCHIVED: 'document.archived',
  DOCUMENT_EXPORT_REQUESTED: 'document.export_requested',
  DOCUMENT_EXPORT_READY: 'document.export_ready',
  DOCUMENT_EXPORT_EXPIRED: 'document.export_expired',
  INSURANCE_VERIFIED: 'insurance.verified',
  INSURANCE_EXPIRING: 'insurance.expiring',
  EMERGENCY_CREATED: 'emergency.created',
  EMERGENCY_ACKNOWLEDGED: 'emergency.acknowledged',
  EMERGENCY_TRIAGED: 'emergency.triaged',
  EMERGENCY_DISPATCHED: 'emergency.dispatched',
  EMERGENCY_ESCALATED: 'emergency.escalated',
  EMERGENCY_RESOLVED: 'emergency.resolved',
  EMERGENCY_CANCELLED: 'emergency.cancelled',
  EMERGENCY_LOCATION_UPDATED: 'emergency.location_updated',
  INVENTORY_LOW_STOCK: 'inventory.low_stock',
  INVENTORY_DRUG_EXPIRING: 'inventory.drug_expiring',
  PHARMACY_ALERT_CREATED: 'pharmacy.alert.created',
  PHARMACY_ALERT_UPDATED: 'pharmacy.alert.updated',
  PHARMACY_ALERT_ACKNOWLEDGED: 'pharmacy.alert.acknowledged',
  PHARMACY_ALERT_ASSIGNED: 'pharmacy.alert.assigned',
  PHARMACY_ALERT_RESOLVED: 'pharmacy.alert.resolved',
  PHARMACY_ALERT_ESCALATED: 'pharmacy.alert.escalated',
  INVENTORY_OUT_OF_STOCK: 'inventory.out_of_stock',
  INVENTORY_BATCH_EXPIRED: 'inventory.batch_expired',
  INVENTORY_DISPENSE_SHORTAGE: 'inventory.dispense_shortage',
  INVENTORY_HIGH_USAGE: 'inventory.high_usage',
  INVENTORY_WASTE_LOSS: 'inventory.waste_loss',
  PHARMACY_ALLERGY_CONFLICT: 'pharmacy.allergy_conflict',
  PHARMACY_MEDICATION_REACTION: 'pharmacy.medication_reaction',
  USER_DISABLED: 'user.disabled',
  USER_ROLE_CHANGED: 'user.role_changed',
  AUTH_SESSION_REVOKED: 'auth.session_revoked',
  AUTH_FORCE_LOGOUT: 'auth.force_logout',
  AUTH_PERMISSION_VERSION_CHANGED: 'auth.permission_version_changed',
  COUNTER_UPDATED: 'counter.updated',
  RELATIVE_ACCESS_GRANTED: 'relative.access_granted',
  RELATIVE_ACCESS_REVOKED: 'relative.access_revoked',
  AUTHORIZATION_EXPIRED: 'authorization.expired',
};

const REALTIME_EVENT_TYPES = Object.values(REALTIME_EVENT_TYPE);

module.exports = {
  SUPPORT_CATEGORY,
  SUPPORT_CATEGORIES,
  SUPPORT_TICKET_PRIORITY,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_SLA_MINUTES,
  PAYMENT_PROVIDER,
  PAYMENT_PROVIDERS,
  PAYMENT_INTENT_METHOD,
  PAYMENT_INTENT_METHODS,
  PAYMENT_INTENT_STATUS,
  PAYMENT_INTENT_STATUSES,
  QR_TOKEN_TYPE,
  QR_TOKEN_TYPES,
  DOCUMENT_SOURCE,
  DOCUMENT_SOURCES,
  DOCUMENT_REVIEW_STATUS,
  DOCUMENT_REVIEW_STATUSES,
  DOCUMENT_VISIBILITY,
  DOCUMENT_VISIBILITIES,
  DOCUMENT_CATEGORY,
  DOCUMENT_CATEGORIES,
  DOCUMENT_EXPORT_TYPE,
  DOCUMENT_EXPORT_TYPES,
  DOCUMENT_EXPORT_STATUS,
  DOCUMENT_EXPORT_STATUSES,
  INSURANCE_POLICY_SOURCE,
  INSURANCE_POLICY_SOURCES,
  INSURANCE_VERIFICATION_STATUS,
  INSURANCE_VERIFICATION_STATUSES,
  EMERGENCY_CASE_TYPE,
  EMERGENCY_CASE_TYPES,
  EMERGENCY_STATUS,
  EMERGENCY_STATUSES,
  EMERGENCY_PRIORITY,
  EMERGENCY_PRIORITIES,
  FACILITY_LOCATION_TYPE,
  FACILITY_LOCATION_TYPES,
  FACILITY_LOCATION_STATUS,
  FACILITY_LOCATION_STATUSES,
  CONSENT_TYPE,
  CONSENT_TYPES,
  CONSENT_STATUS,
  CONSENT_STATUSES,
  BREAK_GLASS_STATUS,
  BREAK_GLASS_STATUSES,
  APPOINTMENT_WAITLIST_STATUS,
  APPOINTMENT_WAITLIST_STATUSES,
  PRESCRIPTION_REFILL_REQUEST_STATUS,
  PRESCRIPTION_REFILL_REQUEST_STATUSES,
  APPROVAL_REQUEST_STATUS,
  APPROVAL_REQUEST_STATUSES,
  APPROVAL_REQUEST_TYPE,
  APPROVAL_REQUEST_TYPES,
  INPATIENT_TASK_TYPE,
  INPATIENT_TASK_TYPES,
  INPATIENT_TASK_STATUS,
  INPATIENT_TASK_STATUSES,
  CATALOG_STATUS,
  CATALOG_STATUSES,
  NOTIFICATION_PREFERENCE_CHANNEL,
  NOTIFICATION_PREFERENCE_CHANNELS,
  EVENT_OUTBOX_STATUS,
  EVENT_OUTBOX_STATUSES,
  IDEMPOTENCY_STATUS,
  IDEMPOTENCY_STATUSES,
  NOTIFICATION_DELIVERY_CHANNEL,
  NOTIFICATION_DELIVERY_CHANNELS,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_DELIVERY_STATUSES,
  REALTIME_EVENT_TYPE,
  REALTIME_EVENT_TYPES,
};
