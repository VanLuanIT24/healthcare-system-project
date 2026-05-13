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
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  INSURANCE: 'insurance',
  E_WALLET: 'e_wallet',
  OTHER: 'other',
};

const PAYMENT_METHODS = Object.values(PAYMENT_METHOD);

const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
};

const PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

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
  CHARGE_STATUS,
  CHARGE_STATUSES,
  INVOICE_STATUS,
  INVOICE_STATUSES,
  PAYMENT_METHOD,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PAYMENT_STATUSES,
  INSURANCE_POLICY_STATUS,
  INSURANCE_POLICY_STATUSES,
  INSURANCE_CLAIM_STATUS,
  INSURANCE_CLAIM_STATUSES,
};
