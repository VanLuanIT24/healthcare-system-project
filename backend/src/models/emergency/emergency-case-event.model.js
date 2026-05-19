const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const emergencyCaseEventSchema = new Schema(
  {
    case_id: { type: Schema.Types.ObjectId, ref: 'EmergencyCase', required: true },
    event_type: { type: String, required: true, trim: true },
    actor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    from_status: { type: String, trim: true },
    to_status: { type: String, trim: true },
    note: { type: String, trim: true },
    payload: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'emergency_case_events' },
);

emergencyCaseEventSchema.index({ case_id: 1, created_at: -1 });
emergencyCaseEventSchema.index({ event_type: 1, created_at: -1 });
emergencyCaseEventSchema.index({ actor_id: 1, created_at: -1 });

module.exports = model('EmergencyCaseEvent', emergencyCaseEventSchema);
