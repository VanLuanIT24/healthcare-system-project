const transitions = {
  ...require('./iam-transitions'),
  ...require('./scheduling-transitions'),
  ...require('./clinical-transitions'),
  ...require('./order-transitions'),
  ...require('./pharmacy-transitions'),
  ...require('./inpatient-transitions'),
  ...require('./billing-transitions'),
};

module.exports = {
  ...transitions,
  APPOINTMENT_STATUS_TRANSITIONS: transitions.APPOINTMENT_TRANSITIONS,
  QUEUE_STATUS_TRANSITIONS: transitions.QUEUE_TRANSITIONS,
  ENCOUNTER_STATUS_TRANSITIONS: transitions.ENCOUNTER_TRANSITIONS,
  CONSULTATION_STATUS_TRANSITIONS: transitions.CONSULTATION_TRANSITIONS,
  CLINICAL_NOTE_STATUS_TRANSITIONS: transitions.CLINICAL_NOTE_TRANSITIONS,
  PRESCRIPTION_STATUS_TRANSITIONS: transitions.PRESCRIPTION_TRANSITIONS,
  STAFF_STATUS_TRANSITIONS: transitions.STAFF_TRANSITIONS,
  SCHEDULE_STATUS_TRANSITIONS: transitions.SCHEDULE_TRANSITIONS,
  ORDER_STATUS_TRANSITIONS: transitions.ORDER_TRANSITIONS,
  LAB_ORDER_STATUS_TRANSITIONS: transitions.LAB_ORDER_TRANSITIONS,
  INVOICE_STATUS_TRANSITIONS: transitions.INVOICE_TRANSITIONS,
  PAYMENT_STATUS_TRANSITIONS: transitions.PAYMENT_TRANSITIONS,
  ADMISSION_STATUS_TRANSITIONS: transitions.ADMISSION_TRANSITIONS,
  BED_ASSIGNMENT_STATUS_TRANSITIONS: transitions.BED_ASSIGNMENT_TRANSITIONS,
};
