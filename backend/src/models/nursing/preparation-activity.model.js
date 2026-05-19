const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const PREPARATION_ACTIVITY_ACTIONS = [
  'created',
  'assigned',
  'started',
  'checklist_item_done',
  'checklist_item_failed',
  'checklist_item_waived',
  'checklist_item_updated',
  'blocked',
  'unblocked',
  'ready',
  'transferred',
  'completed',
  'cancelled',
  'note_added',
  'doctor_notified',
  'destination_notified',
  'evidence_attached',
];

const preparationActivitySchema = new Schema(
  {
    preparation_id: { type: Schema.Types.ObjectId, ref: 'ServicePreparation', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    actor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: PREPARATION_ACTIVITY_ACTIONS, required: true },
    message: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now },
  },
  {
    ...baseSchemaOptions,
    timestamps: false,
    collection: 'preparation_activities',
  },
);

preparationActivitySchema.index({ preparation_id: 1, created_at: -1 });
preparationActivitySchema.index({ patient_id: 1, created_at: -1 });
preparationActivitySchema.index({ encounter_id: 1, created_at: -1 });
preparationActivitySchema.index({ actor_id: 1, created_at: -1 });
preparationActivitySchema.index({ action: 1, created_at: -1 });

module.exports = model('PreparationActivity', preparationActivitySchema);
