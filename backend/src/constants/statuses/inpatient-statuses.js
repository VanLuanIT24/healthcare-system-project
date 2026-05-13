const ROOM_TYPE = {
  CONSULTATION: 'consultation',
  WARD: 'ward',
  PROCEDURE: 'procedure',
  OPERATING: 'operating',
  LAB: 'lab',
  IMAGING: 'imaging',
  PHARMACY: 'pharmacy',
  STORAGE: 'storage',
  OTHER: 'other',
};

const ROOM_TYPES = Object.values(ROOM_TYPE);

const ROOM_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  CLOSED: 'closed',
};

const ROOM_STATUSES = Object.values(ROOM_STATUS);

const BED_TYPE = {
  STANDARD: 'standard',
  ICU: 'icu',
  PEDIATRIC: 'pediatric',
  MATERNITY: 'maternity',
  ISOLATION: 'isolation',
  OTHER: 'other',
};

const BED_TYPES = Object.values(BED_TYPE);

const BED_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  MAINTENANCE: 'maintenance',
  BLOCKED: 'blocked',
  INACTIVE: 'inactive',
};

const BED_STATUSES = Object.values(BED_STATUS);

const ADMISSION_TYPE = {
  ELECTIVE: 'elective',
  EMERGENCY: 'emergency',
  TRANSFER: 'transfer',
  OBSERVATION: 'observation',
  DAY_CASE: 'day_case',
};

const ADMISSION_TYPES = Object.values(ADMISSION_TYPE);

const ADMISSION_STATUS = {
  PLANNED: 'planned',
  ADMITTED: 'admitted',
  TRANSFERRED: 'transferred',
  DISCHARGED: 'discharged',
  CANCELLED: 'cancelled',
};

const ADMISSION_STATUSES = Object.values(ADMISSION_STATUS);

const BED_ASSIGNMENT_STATUS = {
  ACTIVE: 'active',
  TRANSFERRED: 'transferred',
  RELEASED: 'released',
  CANCELLED: 'cancelled',
};

const BED_ASSIGNMENT_STATUSES = Object.values(BED_ASSIGNMENT_STATUS);

module.exports = {
  ROOM_TYPE,
  ROOM_TYPES,
  ROOM_STATUS,
  ROOM_STATUSES,
  BED_TYPE,
  BED_TYPES,
  BED_STATUS,
  BED_STATUSES,
  ADMISSION_TYPE,
  ADMISSION_TYPES,
  ADMISSION_STATUS,
  ADMISSION_STATUSES,
  BED_ASSIGNMENT_STATUS,
  BED_ASSIGNMENT_STATUSES,
};
