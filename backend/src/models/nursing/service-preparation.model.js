const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ORDER_PRIORITIES, ORDER_PRIORITY } = require('../../constants/statuses');

const SERVICE_PREPARATION_SOURCE_TYPE = {
  PRE_EXAM: 'pre_exam',
  LAB: 'lab',
  IMAGING: 'imaging',
  PROCEDURE: 'procedure',
  SERVICE: 'service',
  NURSING: 'nursing',
  OTHER: 'other',
};

const SERVICE_PREPARATION_SOURCE_TYPES = Object.values(SERVICE_PREPARATION_SOURCE_TYPE);

const SERVICE_PREPARATION_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  READY: 'ready',
  BLOCKED: 'blocked',
  TRANSFERRED: 'transferred',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const SERVICE_PREPARATION_STATUSES = Object.values(SERVICE_PREPARATION_STATUS);
const SERVICE_PREPARATION_SLA_LEVELS = ['normal', 'warning', 'breached'];

const servicePreparationSchema = new Schema(
  {
    preparation_no: { type: String, required: true, unique: true, trim: true },

    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },

    source_type: { type: String, enum: SERVICE_PREPARATION_SOURCE_TYPES, required: true },

    order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    lab_order_id: { type: Schema.Types.ObjectId, ref: 'LabOrder' },
    imaging_order_id: { type: Schema.Types.ObjectId, ref: 'ImagingOrder' },
    procedure_order_id: { type: Schema.Types.ObjectId, ref: 'ProcedureOrder' },
    queue_ticket_id: { type: Schema.Types.ObjectId, ref: 'QueueTicket' },

    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    destination_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    room_id: { type: Schema.Types.ObjectId, ref: 'Room' },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE },
    status: {
      type: String,
      enum: SERVICE_PREPARATION_STATUSES,
      default: SERVICE_PREPARATION_STATUS.PENDING,
      required: true,
    },

    assigned_nurse_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_at: { type: Date },

    started_by: { type: Schema.Types.ObjectId, ref: 'User' },
    started_at: { type: Date },

    ready_by: { type: Schema.Types.ObjectId, ref: 'User' },
    ready_at: { type: Date },

    transferred_by: { type: Schema.Types.ObjectId, ref: 'User' },
    transferred_at: { type: Date },

    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },

    blocked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    blocked_at: { type: Date },
    blocked_reason_code: { type: String, trim: true },
    blocked_reason_text: { type: String, trim: true },

    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String, trim: true },

    sla_due_at: { type: Date },
    sla_level: { type: String, enum: SERVICE_PREPARATION_SLA_LEVELS, default: 'normal' },

    checklist_total: { type: Number, default: 0, min: 0 },
    checklist_done: { type: Number, default: 0, min: 0 },
    checklist_required_total: { type: Number, default: 0, min: 0 },
    checklist_required_done: { type: Number, default: 0, min: 0 },
    readiness_score: { type: Number, default: 0, min: 0, max: 100 },

    has_safety_risk: { type: Boolean, default: false },
    safety_risk_codes: [{ type: String, trim: true }],

    last_note: { type: String, trim: true },
    last_activity_at: { type: Date },

    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'service_preparations' },
);

servicePreparationSchema.index({ status: 1, priority: 1, sla_due_at: 1 });
servicePreparationSchema.index({ patient_id: 1, created_at: -1 });
servicePreparationSchema.index({ encounter_id: 1 });
servicePreparationSchema.index({ order_id: 1 }, { unique: true, sparse: true });
servicePreparationSchema.index({ lab_order_id: 1 }, { unique: true, sparse: true });
servicePreparationSchema.index({ imaging_order_id: 1 }, { unique: true, sparse: true });
servicePreparationSchema.index({ procedure_order_id: 1 }, { unique: true, sparse: true });
servicePreparationSchema.index({ queue_ticket_id: 1 }, { unique: true, sparse: true });
servicePreparationSchema.index(
  { source_type: 1, encounter_id: 1 },
  { unique: true, partialFilterExpression: { source_type: SERVICE_PREPARATION_SOURCE_TYPE.PRE_EXAM } },
);
servicePreparationSchema.index({ assigned_nurse_id: 1, status: 1 });
servicePreparationSchema.index({ department_id: 1, status: 1, sla_due_at: 1 });
servicePreparationSchema.index({ source_type: 1, status: 1 });
servicePreparationSchema.index({ destination_department_id: 1, status: 1 });
servicePreparationSchema.index({ has_safety_risk: 1, status: 1 });

servicePreparationSchema.statics.STATUS = SERVICE_PREPARATION_STATUS;
servicePreparationSchema.statics.STATUSES = SERVICE_PREPARATION_STATUSES;
servicePreparationSchema.statics.SOURCE_TYPE = SERVICE_PREPARATION_SOURCE_TYPE;
servicePreparationSchema.statics.SOURCE_TYPES = SERVICE_PREPARATION_SOURCE_TYPES;

module.exports = model('ServicePreparation', servicePreparationSchema);
