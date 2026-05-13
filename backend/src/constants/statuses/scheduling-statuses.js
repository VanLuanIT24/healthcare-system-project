const SCHEDULE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

const SCHEDULE_STATUSES = Object.values(SCHEDULE_STATUS);

const SCHEDULE_SLOT_STATUS = {
  AVAILABLE: 'available',
  HELD: 'held',
  BOOKED: 'booked',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
};

const SCHEDULE_SLOT_STATUSES = Object.values(SCHEDULE_SLOT_STATUS);

const APPOINTMENT_STATUS = {
  BOOKED: 'booked',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_CONSULTATION: 'in_consultation',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled',
};

const APPOINTMENT_STATUSES = Object.values(APPOINTMENT_STATUS);
const ACTIVE_APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS.BOOKED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.IN_CONSULTATION,
];

const APPOINTMENT_TYPE = {
  OUTPATIENT: 'outpatient',
  INPATIENT_FOLLOWUP: 'inpatient_followup',
  EMERGENCY: 'emergency',
  TELEMEDICINE: 'telemedicine',
  VACCINATION: 'vaccination',
  PROCEDURE: 'procedure',
};

const APPOINTMENT_TYPES = Object.values(APPOINTMENT_TYPE);

const QUEUE_STATUS = {
  WAITING: 'waiting',
  CALLED: 'called',
  IN_SERVICE: 'in_service',
  SKIPPED: 'skipped',
  RECALLED: 'recalled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const QUEUE_STATUSES = Object.values(QUEUE_STATUS);

const ACTIVE_QUEUE_STATUSES = [
  QUEUE_STATUS.WAITING,
  QUEUE_STATUS.CALLED,
  QUEUE_STATUS.IN_SERVICE,
  QUEUE_STATUS.SKIPPED,
  QUEUE_STATUS.RECALLED,
];

const QUEUE_TYPE = {
  NORMAL: 'normal',
  PRIORITY: 'priority',
  VIP: 'vip',
};

const QUEUE_TYPES = Object.values(QUEUE_TYPE);

module.exports = {
  SCHEDULE_STATUS,
  SCHEDULE_STATUSES,
  SCHEDULE_SLOT_STATUS,
  SCHEDULE_SLOT_STATUSES,
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUSES,
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_TYPE,
  APPOINTMENT_TYPES,
  QUEUE_STATUS,
  QUEUE_STATUSES,
  ACTIVE_QUEUE_STATUSES,
  QUEUE_TYPE,
  QUEUE_TYPES,
};
