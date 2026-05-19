const ENCOUNTER_STATUS = {
  PLANNED: 'planned',
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const ENCOUNTER_STATUSES = Object.values(ENCOUNTER_STATUS);

const ENCOUNTER_TYPE = {
  OUTPATIENT: 'outpatient',
  INPATIENT: 'inpatient',
  EMERGENCY: 'emergency',
  TELEMEDICINE: 'telemedicine',
};

const ENCOUNTER_TYPES = Object.values(ENCOUNTER_TYPE);

const NURSING_WORKFLOW_STATUS = {
  NOT_STARTED: 'not_started',
  WAITING_NURSE: 'waiting_nurse',
  NURSE_IN_PROGRESS: 'nurse_in_progress',
  TRIAGE_PENDING: 'triage_pending',
  TRIAGE_IN_PROGRESS: 'triage_in_progress',
  TRIAGE_DONE: 'triage_done',
  VITAL_PENDING: 'vital_pending',
  VITAL_DONE: 'vital_done',
  PREPARATION_PENDING: 'preparation_pending',
  READY_FOR_DOCTOR: 'ready_for_doctor',
  COMPLETED: 'completed',
};

const NURSING_WORKFLOW_STATUSES = Object.values(NURSING_WORKFLOW_STATUS);

const CONSULTATION_STATUS = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  SIGNED: 'signed',
  AMENDED: 'amended',
  CANCELLED: 'cancelled',
};

const CONSULTATION_STATUSES = Object.values(CONSULTATION_STATUS);

const DIAGNOSIS_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  ENTERED_IN_ERROR: 'entered_in_error',
};

const DIAGNOSIS_STATUSES = Object.values(DIAGNOSIS_STATUS);

const DIAGNOSIS_TYPE = {
  PROVISIONAL: 'provisional',
  CONFIRMED: 'confirmed',
  DISCHARGE: 'discharge',
  SECONDARY: 'secondary',
};

const DIAGNOSIS_TYPES = Object.values(DIAGNOSIS_TYPE);

const PROBLEM_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  RESOLVED: 'resolved',
  ENTERED_IN_ERROR: 'entered_in_error',
};

const PROBLEM_STATUSES = Object.values(PROBLEM_STATUS);

const PROBLEM_SEVERITY = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  UNKNOWN: 'unknown',
};

const PROBLEM_SEVERITIES = Object.values(PROBLEM_SEVERITY);

const ALLERGY_TYPE = {
  MEDICATION: 'medication',
  FOOD: 'food',
  ENVIRONMENT: 'environment',
  CONTRAST: 'contrast',
  LATEX: 'latex',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

const ALLERGY_TYPES = Object.values(ALLERGY_TYPE);

const ALLERGY_SEVERITY = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  LIFE_THREATENING: 'life_threatening',
  UNKNOWN: 'unknown',
};

const ALLERGY_SEVERITIES = Object.values(ALLERGY_SEVERITY);

const ALLERGY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  RESOLVED: 'resolved',
  ENTERED_IN_ERROR: 'entered_in_error',
};

const ALLERGY_STATUSES = Object.values(ALLERGY_STATUS);

const VITAL_SIGN_STATUS = {
  RECORDED: 'recorded',
  AMENDED: 'amended',
  ENTERED_IN_ERROR: 'entered_in_error',
};

const VITAL_SIGN_STATUSES = Object.values(VITAL_SIGN_STATUS);

const CLINICAL_NOTE_STATUS = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  SIGNED: 'signed',
  AMENDED: 'amended',
  CANCELLED: 'cancelled',
};

const CLINICAL_NOTE_STATUSES = Object.values(CLINICAL_NOTE_STATUS);

const CARE_PLAN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const CARE_PLAN_STATUSES = Object.values(CARE_PLAN_STATUS);

module.exports = {
  ENCOUNTER_STATUS,
  ENCOUNTER_STATUSES,
  ENCOUNTER_TYPE,
  ENCOUNTER_TYPES,
  NURSING_WORKFLOW_STATUS,
  NURSING_WORKFLOW_STATUSES,
  CONSULTATION_STATUS,
  CONSULTATION_STATUSES,
  DIAGNOSIS_STATUS,
  DIAGNOSIS_STATUSES,
  DIAGNOSIS_TYPE,
  DIAGNOSIS_TYPES,
  PROBLEM_STATUS,
  PROBLEM_STATUSES,
  PROBLEM_SEVERITY,
  PROBLEM_SEVERITIES,
  ALLERGY_TYPE,
  ALLERGY_TYPES,
  ALLERGY_SEVERITY,
  ALLERGY_SEVERITIES,
  ALLERGY_STATUS,
  ALLERGY_STATUSES,
  VITAL_SIGN_STATUS,
  VITAL_SIGN_STATUSES,
  CLINICAL_NOTE_STATUS,
  CLINICAL_NOTE_STATUSES,
  CARE_PLAN_STATUS,
  CARE_PLAN_STATUSES,
};
