const SERVICE_TYPE = {
  CONSULTATION: 'consultation',
  LAB: 'lab',
  IMAGING: 'imaging',
  PROCEDURE: 'procedure',
  PHARMACY: 'pharmacy',
  ROOM: 'room',
  NURSING: 'nursing',
  OTHER: 'other',
};

const SERVICE_TYPES = Object.values(SERVICE_TYPE);

const SERVICE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  RETIRED: 'retired',
};

const SERVICE_STATUSES = Object.values(SERVICE_STATUS);

const SERVICE_PRICE_VERSION_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

const SERVICE_PRICE_VERSION_STATUSES = Object.values(SERVICE_PRICE_VERSION_STATUS);

const SERVICE_PRICE_CHANGE_TYPE = {
  NEW: 'new',
  PRICE_INCREASE: 'price_increase',
  PRICE_DECREASE: 'price_decrease',
  RETIRE: 'retire',
  REACTIVATE: 'reactivate',
};

const SERVICE_PRICE_CHANGE_TYPES = Object.values(SERVICE_PRICE_CHANGE_TYPE);

const CHARGE_STATUS = {
  PENDING: 'pending',
  DRAFT: 'draft',
  POSTED: 'posted',
  BILLED: 'billed',
  VOIDED: 'voided',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

const CHARGE_STATUSES = Object.values(CHARGE_STATUS);

const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  VOIDED: 'voided',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

const INVOICE_STATUSES = Object.values(INVOICE_STATUS);

const PAYMENT_METHOD = {
  CASH: 'cash',
  QR: 'qr',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  INSURANCE: 'insurance',
  E_WALLET: 'e_wallet',
  OTHER: 'other',
};

const PAYMENT_METHODS = Object.values(PAYMENT_METHOD);

const PAYMENT_STATUS = {
  PENDING: 'pending',
  PENDING_MANUAL_CONFIRMATION: 'pending_manual_confirmation',
  SUBMITTED_RECEIPT: 'submitted_receipt',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  REFUNDED_MANUAL: 'refunded_manual',
  VOIDED: 'voided',
};

const PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

const PAYMENT_REFUND_STATUS = {
  REQUESTED: 'requested',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const PAYMENT_REFUND_STATUSES = Object.values(PAYMENT_REFUND_STATUS);

const PAYMENT_REFUND_TYPE = {
  FULL: 'full',
  PARTIAL: 'partial',
  OVERPAYMENT: 'overpayment',
  DUPLICATE: 'duplicate',
  SERVICE_CANCELLED: 'service_cancelled',
  WRONG_INVOICE: 'wrong_invoice',
  PATIENT_COMPLAINT: 'patient_complaint',
  INSURANCE_ADJUSTMENT: 'insurance_adjustment',
};

const PAYMENT_REFUND_TYPES = Object.values(PAYMENT_REFUND_TYPE);

const PAYMENT_REFUND_METHOD = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  ORIGINAL_METHOD: 'original_method',
  MANUAL: 'manual',
  CARD: 'card',
  E_WALLET: 'e_wallet',
  INSURANCE: 'insurance',
};

const PAYMENT_REFUND_METHODS = Object.values(PAYMENT_REFUND_METHOD);

const PAYMENT_REFUND_REQUEST_SOURCE = {
  PATIENT_PORTAL: 'patient_portal',
  CASHIER: 'cashier',
  ACCOUNTING: 'accounting',
  ACCOUNTANT: 'accountant',
  ADMIN: 'admin',
  RECONCILIATION: 'reconciliation',
  INSURANCE: 'insurance',
  SYSTEM: 'system',
};

const PAYMENT_REFUND_REQUEST_SOURCES = Object.values(PAYMENT_REFUND_REQUEST_SOURCE);

const RECONCILIATION_TRANSACTION_STATUS = {
  UNMATCHED: 'unmatched',
  MATCHED: 'matched',
  PARTIAL_MATCHED: 'partial_matched',
  IGNORED: 'ignored',
  DISPUTED: 'disputed',
};

const RECONCILIATION_TRANSACTION_STATUSES = Object.values(RECONCILIATION_TRANSACTION_STATUS);

const RECONCILIATION_BATCH_STATUS = {
  DRAFT: 'draft',
  IMPORTED: 'imported',
  MATCHING: 'matching',
  REVIEWING: 'reviewing',
  CLOSED: 'closed',
  LOCKED: 'locked',
};

const RECONCILIATION_BATCH_STATUSES = Object.values(RECONCILIATION_BATCH_STATUS);

const RECONCILIATION_MATCH_STATUS = {
  PROPOSED: 'proposed',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  REVERSED: 'reversed',
};

const RECONCILIATION_MATCH_STATUSES = Object.values(RECONCILIATION_MATCH_STATUS);

const RECONCILIATION_MATCH_TYPE = {
  AUTO: 'auto',
  MANUAL: 'manual',
  FORCED: 'forced',
  PARTIAL: 'partial',
  SPLIT: 'split',
  MERGED: 'merged',
};

const RECONCILIATION_MATCH_TYPES = Object.values(RECONCILIATION_MATCH_TYPE);

const RECONCILIATION_RULE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
};

const RECONCILIATION_RULE_STATUSES = Object.values(RECONCILIATION_RULE_STATUS);

const RECEIPT_STATUS = {
  GENERATED: 'generated',
  PRINTED: 'printed',
  SENT: 'sent',
  DOWNLOADED: 'downloaded',
  VOIDED: 'voided',
  REISSUED: 'reissued',
};

const RECEIPT_STATUSES = Object.values(RECEIPT_STATUS);

const RECEIPT_TYPE = {
  PAYMENT: 'payment',
  REFUND: 'refund',
  VOID: 'void',
  INSURANCE_SETTLEMENT: 'insurance_settlement',
};

const RECEIPT_TYPES = Object.values(RECEIPT_TYPE);

const INSURANCE_POLICY_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  INACTIVE: 'inactive',
};

const INSURANCE_POLICY_STATUSES = Object.values(INSURANCE_POLICY_STATUS);

const INSURANCE_CLAIM_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  PARTIALLY_APPROVED: 'partially_approved',
  REJECTED: 'rejected',
  SETTLED: 'settled',
  CANCELLED: 'cancelled',
};

const INSURANCE_CLAIM_STATUSES = Object.values(INSURANCE_CLAIM_STATUS);

module.exports = {
  SERVICE_TYPE,
  SERVICE_TYPES,
  SERVICE_STATUS,
  SERVICE_STATUSES,
  SERVICE_PRICE_VERSION_STATUS,
  SERVICE_PRICE_VERSION_STATUSES,
  SERVICE_PRICE_CHANGE_TYPE,
  SERVICE_PRICE_CHANGE_TYPES,
  CHARGE_STATUS,
  CHARGE_STATUSES,
  INVOICE_STATUS,
  INVOICE_STATUSES,
  PAYMENT_METHOD,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PAYMENT_STATUSES,
  PAYMENT_REFUND_STATUS,
  PAYMENT_REFUND_STATUSES,
  PAYMENT_REFUND_TYPE,
  PAYMENT_REFUND_TYPES,
  PAYMENT_REFUND_METHOD,
  PAYMENT_REFUND_METHODS,
  PAYMENT_REFUND_REQUEST_SOURCE,
  PAYMENT_REFUND_REQUEST_SOURCES,
  RECONCILIATION_TRANSACTION_STATUS,
  RECONCILIATION_TRANSACTION_STATUSES,
  RECONCILIATION_BATCH_STATUS,
  RECONCILIATION_BATCH_STATUSES,
  RECONCILIATION_MATCH_STATUS,
  RECONCILIATION_MATCH_STATUSES,
  RECONCILIATION_MATCH_TYPE,
  RECONCILIATION_MATCH_TYPES,
  RECONCILIATION_RULE_STATUS,
  RECONCILIATION_RULE_STATUSES,
  RECEIPT_STATUS,
  RECEIPT_STATUSES,
  RECEIPT_TYPE,
  RECEIPT_TYPES,
  INSURANCE_POLICY_STATUS,
  INSURANCE_POLICY_STATUSES,
  INSURANCE_CLAIM_STATUS,
  INSURANCE_CLAIM_STATUSES,
};
