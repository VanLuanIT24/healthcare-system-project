const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const MEDICATION_ADMINISTRATION_EVENT_TYPES = [
  'scheduled_created',
  'scan_verified',
  'administered',
  'held',
  'refused',
  'omitted',
  'rescheduled',
  'reaction_recorded',
  'doctor_notified',
  'pharmacist_reviewed',
  'entered_in_error',
  'resolved',
];

const medicationAdministrationEventSchema = new Schema(
  {
    medication_administration_id: { type: Schema.Types.ObjectId, ref: 'MedicationAdministration', required: true },
    event_type: { type: String, enum: MEDICATION_ADMINISTRATION_EVENT_TYPES, required: true },
    from_status: { type: String, trim: true },
    to_status: { type: String, trim: true },
    actor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    actor_role: { type: String, trim: true },
    occurred_at: { type: Date, default: Date.now, required: true },
    reason_code: { type: String, trim: true },
    note: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'medication_administration_events' },
);

medicationAdministrationEventSchema.index({ medication_administration_id: 1, occurred_at: -1 });
medicationAdministrationEventSchema.index({ event_type: 1, occurred_at: -1 });
medicationAdministrationEventSchema.index({ actor_id: 1, occurred_at: -1 });

module.exports = model('MedicationAdministrationEvent', medicationAdministrationEventSchema);

