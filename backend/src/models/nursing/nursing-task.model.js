const { randomInt } = require('crypto');
const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const NURSING_TASK_SOURCE_MODULES = [
  'manual',
  'care_plan',
  'encounter',
  'admission',
  'queue',
  'medication_administration',
  'lab_order',
  'imaging_order',
  'procedure_order',
  'emergency',
  'handoff',
  'system',
];

const NURSING_TASK_TYPES = [
  'vital_sign',
  'nursing_note',
  'medication_admin',
  'post_medication_monitor',
  'pre_lab',
  'specimen_collection',
  'pre_imaging',
  'pre_procedure',
  'post_procedure_monitor',
  'doctor_report',
  'patient_transport',
  'bedside_care',
  'diet',
  'cleaning',
  'round',
  'admission_checklist',
  'discharge_checklist',
  'handoff_followup',
  'emergency_response',
  'other',
  // Legacy values already used by the nursing dashboard.
  'triage',
  'vital',
  'preparation',
  'medication_monitoring',
  'post_procedure_monitoring',
  'inpatient_care',
  'handover',
];

const NURSING_TASK_PRIORITIES = [
  'low',
  'normal',
  'medium',
  'high',
  'urgent',
  'stat',
  'critical',
];

const NURSING_TASK_STATUSES = [
  'draft',
  'assigned',
  'accepted',
  'todo',
  'in_progress',
  'blocked',
  'waiting_doctor',
  'done',
  'cancelled',
  'overdue',
];

const CHECKLIST_ITEM_STATUSES = ['pending', 'done', 'skipped'];
const QUALITY_REVIEW_STATUSES = ['none', 'pending_review', 'approved', 'rejected', 'needs_correction'];

function fallbackTaskCode() {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  return `NT${datePart}${String(Date.now()).slice(-5)}${randomInt(100, 999)}`;
}

const checklistItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    status: { type: String, enum: CHECKLIST_ITEM_STATUSES, default: 'pending', required: true },
    checked_at: { type: Date },
    checked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
  },
  { _id: true, versionKey: false },
);

const nursingTaskSchema = new Schema(
  {
    task_code: { type: String, unique: true, sparse: true, trim: true },

    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    queue_ticket_id: { type: Schema.Types.ObjectId, ref: 'QueueTicket' },
    emergency_case_id: { type: Schema.Types.ObjectId, ref: 'EmergencyCase' },

    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    room_id: { type: Schema.Types.ObjectId, ref: 'Room' },
    bed_id: { type: Schema.Types.ObjectId, ref: 'Bed' },

    source_module: { type: String, enum: NURSING_TASK_SOURCE_MODULES, default: 'manual', required: true },
    source_type: { type: String, trim: true },
    source_id: { type: Schema.Types.ObjectId },

    task_type: { type: String, enum: NURSING_TASK_TYPES, default: 'other', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    priority: { type: String, enum: NURSING_TASK_PRIORITIES, default: 'normal', required: true },
    status: { type: String, enum: NURSING_TASK_STATUSES, default: 'assigned', required: true },

    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_role: { type: String, trim: true },
    assigned_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    assigned_by: { type: Schema.Types.ObjectId, ref: 'User' },

    accepted_at: { type: Date },
    started_at: { type: Date },
    started_by: { type: Schema.Types.ObjectId, ref: 'User' },
    due_at: { type: Date },
    sla_minutes: { type: Number, min: 0 },
    overdue_at: { type: Date },
    completed_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },

    checklist_items: [checklistItemSchema],

    result_note: { type: String, trim: true },
    clinical_note_id: { type: Schema.Types.ObjectId, ref: 'ClinicalNote' },
    conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    handoff_id: { type: Schema.Types.ObjectId, ref: 'NursingHandoff' },

    escalation_level: { type: Number, default: 0, min: 0 },
    escalated_to: { type: Schema.Types.ObjectId, ref: 'User' },
    escalated_at: { type: Date },
    escalated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    escalation_reason: { type: String, trim: true },

    blocked_reason: { type: String, trim: true },
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String, trim: true },

    completed_late_reason: { type: String, trim: true },
    quality_review_status: { type: String, enum: QUALITY_REVIEW_STATUSES, default: 'none', required: true },

    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'nursing_tasks' },
);

nursingTaskSchema.pre('validate', function ensureTaskCode(next) {
  if (!this.task_code) this.task_code = fallbackTaskCode();
  if (!this.assigned_department_id && this.department_id) this.assigned_department_id = this.department_id;
  if (!this.source_module && this.source_type) this.source_module = this.source_type;
  if (!this.source_type && this.source_module) this.source_type = this.source_module;
  next();
});

nursingTaskSchema.index({ assigned_to: 1, status: 1, due_at: 1 });
nursingTaskSchema.index({ patient_id: 1, status: 1, due_at: 1 });
nursingTaskSchema.index({ patient_id: 1, created_at: -1 });
nursingTaskSchema.index({ encounter_id: 1 });
nursingTaskSchema.index({ encounter_id: 1, status: 1 });
nursingTaskSchema.index({ admission_id: 1 });
nursingTaskSchema.index({ admission_id: 1, status: 1 });
nursingTaskSchema.index({ queue_ticket_id: 1, status: 1 });
nursingTaskSchema.index({ emergency_case_id: 1, status: 1 });
nursingTaskSchema.index({ department_id: 1, status: 1, due_at: 1 });
nursingTaskSchema.index({ due_at: 1, status: 1 });
nursingTaskSchema.index({ priority: 1, status: 1 });
nursingTaskSchema.index({ task_type: 1, status: 1 });
nursingTaskSchema.index({ source_module: 1, source_id: 1 });
nursingTaskSchema.index({ handoff_id: 1 });
nursingTaskSchema.index({ quality_review_status: 1, status: 1 });

module.exports = model('NursingTask', nursingTaskSchema);
