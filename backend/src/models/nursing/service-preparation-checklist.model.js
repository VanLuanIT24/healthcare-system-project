const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const PREPARATION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const PREPARATION_STATUSES = Object.values(PREPARATION_STATUS);

const PREPARATION_ORDER_TYPE = {
  LAB: 'lab',
  IMAGING: 'imaging',
  PROCEDURE: 'procedure',
  SERVICE: 'service',
};

const PREPARATION_ORDER_TYPES = Object.values(PREPARATION_ORDER_TYPE);

const preparationChecklistSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    order_type: { type: String, enum: PREPARATION_ORDER_TYPES, required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    status: { type: String, enum: PREPARATION_STATUSES, default: PREPARATION_STATUS.PENDING, required: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    checklist_items: [{
      key: { type: String, required: true, trim: true },
      label: { type: String, required: true, trim: true },
      required: { type: Boolean, default: true },
      checked: { type: Boolean, default: false },
      checked_by: { type: Schema.Types.ObjectId, ref: 'User' },
      checked_at: { type: Date },
      note: { type: String, trim: true },
    }],
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'service_preparation_checklists' },
);

preparationChecklistSchema.index({ patient_id: 1, created_at: -1 });
preparationChecklistSchema.index({ encounter_id: 1, status: 1 });
preparationChecklistSchema.index({ order_id: 1 }, { unique: true });
preparationChecklistSchema.index({ department_id: 1, status: 1, created_at: -1 });
preparationChecklistSchema.index({ assigned_to: 1, status: 1 });
preparationChecklistSchema.index({ order_type: 1, status: 1 });

module.exports = model('ServicePreparationChecklist', preparationChecklistSchema);
