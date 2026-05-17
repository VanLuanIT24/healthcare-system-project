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
    status: { type: String, enum: INPATIENT_TASK_STATUSES, default: INPATIENT_TASK_STATUS.TODO, required: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    due_at: { type: Date },
    completed_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'inpatient_tasks' },
);

inpatientTaskSchema.index({ admission_id: 1, status: 1 });
inpatientTaskSchema.index({ patient_id: 1, created_at: -1 });
inpatientTaskSchema.index({ assigned_to: 1, status: 1 });
inpatientTaskSchema.index({ due_at: 1, status: 1 });
inpatientTaskSchema.index({ type: 1, status: 1 });

module.exports = model('InpatientTask', inpatientTaskSchema);
