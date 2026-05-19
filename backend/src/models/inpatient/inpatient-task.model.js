const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { INPATIENT_TASK_STATUSES, INPATIENT_TASK_STATUS, INPATIENT_TASK_TYPES, INPATIENT_TASK_TYPE } = require('../../constants/statuses');

// Bảng inpatient_tasks: Task linh hoạt cho round, nursing care, diet, cleaning, checklist.

const inpatientTaskSchema = new Schema(
  {
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    type: { type: String, enum: INPATIENT_TASK_TYPES, default: INPATIENT_TASK_TYPE.OTHER, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', required: true },
    status: { type: String, enum: INPATIENT_TASK_STATUSES, default: INPATIENT_TASK_STATUS.TODO, required: true },
    room_id: { type: Schema.Types.ObjectId, ref: 'Room' },
    bed_id: { type: Schema.Types.ObjectId, ref: 'Bed' },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_by: { type: Schema.Types.ObjectId, ref: 'User' },
    due_at: { type: Date },
    started_at: { type: Date },
    started_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String, trim: true },
    source_module: { type: String, trim: true },
    source_id: { type: Schema.Types.ObjectId },
    sla_due_at: { type: Date },
    requires_acknowledgement: { type: Boolean, default: false },
    acknowledged_at: { type: Date },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'inpatient_tasks' },
);

inpatientTaskSchema.index({ admission_id: 1, status: 1 });
inpatientTaskSchema.index({ patient_id: 1, created_at: -1 });
inpatientTaskSchema.index({ assigned_to: 1, status: 1 });
inpatientTaskSchema.index({ room_id: 1, status: 1 });
inpatientTaskSchema.index({ bed_id: 1, status: 1 });
inpatientTaskSchema.index({ due_at: 1, status: 1 });
inpatientTaskSchema.index({ priority: 1, status: 1 });
inpatientTaskSchema.index({ source_module: 1, source_id: 1 });
inpatientTaskSchema.index({ type: 1, status: 1 });

module.exports = model('InpatientTask', inpatientTaskSchema);
