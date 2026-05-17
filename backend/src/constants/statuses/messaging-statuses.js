const CONVERSATION_TYPE = {
  DOCTOR_PATIENT: 'doctor_patient',
  CARE_TEAM_PATIENT: 'care_team_patient',
  SUPPORT: 'support',
  BILLING: 'billing',
  INSURANCE: 'insurance',
  PHARMACY: 'pharmacy',
  LAB: 'lab',
  IMAGING: 'imaging',
  INTERNAL: 'internal',
  EMERGENCY: 'emergency',
};

const CONVERSATION_TYPES = Object.values(CONVERSATION_TYPE);

const CONVERSATION_STATUS = {
  OPEN: 'open',
  PENDING: 'pending',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
};

const CONVERSATION_STATUSES = Object.values(CONVERSATION_STATUS);

const CONVERSATION_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

const CONVERSATION_PRIORITIES = Object.values(CONVERSATION_PRIORITY);

const CONVERSATION_PARTICIPANT_ROLE = {
  OWNER: 'owner',
  MEMBER: 'member',
  ASSIGNEE: 'assignee',
  OBSERVER: 'observer',
};

const CONVERSATION_PARTICIPANT_ROLES = Object.values(CONVERSATION_PARTICIPANT_ROLE);

const MESSAGE_TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  VOICE: 'voice',
  SYSTEM: 'system',
  CLINICAL_NOTE_REF: 'clinical_note_ref',
  PAYMENT_REF: 'payment_ref',
  APPOINTMENT_REF: 'appointment_ref',
  PRESCRIPTION_REF: 'prescription_ref',
};

const MESSAGE_TYPES = Object.values(MESSAGE_TYPE);

const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  DELETED: 'deleted',
};

const MESSAGE_STATUSES = Object.values(MESSAGE_STATUS);

const VOICE_TRANSCRIPT_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const VOICE_TRANSCRIPT_STATUSES = Object.values(VOICE_TRANSCRIPT_STATUS);

const CONVERSATION_CALL_TYPE = {
  VOICE: 'voice',
  VIDEO: 'video',
};

const CONVERSATION_CALL_TYPES = Object.values(CONVERSATION_CALL_TYPE);

const CONVERSATION_CALL_PROVIDER = {
  INTERNAL: 'internal',
  TWILIO: 'twilio',
  AGORA: 'agora',
  ZOOM: 'zoom',
  GOOGLE_MEET: 'google_meet',
};

const CONVERSATION_CALL_PROVIDERS = Object.values(CONVERSATION_CALL_PROVIDER);

const CONVERSATION_CALL_STATUS = {
  SCHEDULED: 'scheduled',
  RINGING: 'ringing',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  MISSED: 'missed',
  FAILED: 'failed',
};

const CONVERSATION_CALL_STATUSES = Object.values(CONVERSATION_CALL_STATUS);

module.exports = {
  CONVERSATION_TYPE,
  CONVERSATION_TYPES,
  CONVERSATION_STATUS,
  CONVERSATION_STATUSES,
  CONVERSATION_PRIORITY,
  CONVERSATION_PRIORITIES,
  CONVERSATION_PARTICIPANT_ROLE,
  CONVERSATION_PARTICIPANT_ROLES,
  MESSAGE_TYPE,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  MESSAGE_STATUSES,
  VOICE_TRANSCRIPT_STATUS,
  VOICE_TRANSCRIPT_STATUSES,
  CONVERSATION_CALL_TYPE,
  CONVERSATION_CALL_TYPES,
  CONVERSATION_CALL_PROVIDER,
  CONVERSATION_CALL_PROVIDERS,
  CONVERSATION_CALL_STATUS,
  CONVERSATION_CALL_STATUSES,
};
