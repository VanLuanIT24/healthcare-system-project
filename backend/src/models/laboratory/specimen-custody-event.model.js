const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const SPECIMEN_CUSTODY_EVENT_TYPES = [
  'created',
  'collected',
  'handed_over',
  'transported',
  'received',
  'rejected',
  'in_testing',
  'stored',
  'moved',
  'disposed',
  'issue',
];

const specimenCustodyEventSchema = new Schema(
  {
    specimen_id: { type: Schema.Types.ObjectId, ref: 'Specimen', required: true },
    lab_order_id: { type: Schema.Types.ObjectId, ref: 'LabOrder', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    event_type: { type: String, enum: SPECIMEN_CUSTODY_EVENT_TYPES, required: true, trim: true },
    from_user: { type: Schema.Types.ObjectId, ref: 'User' },
    to_user: { type: Schema.Types.ObjectId, ref: 'User' },
    from_location: { type: String, trim: true },
    to_location: { type: String, trim: true },
    event_at: { type: Date, default: Date.now },
    condition: { type: String, trim: true },
    temperature_celsius: { type: Number },
    note: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'specimen_custody_events' },
);

specimenCustodyEventSchema.index({ specimen_id: 1, event_at: -1 });
specimenCustodyEventSchema.index({ lab_order_id: 1, event_at: -1 });
specimenCustodyEventSchema.index({ patient_id: 1, event_at: -1 });
specimenCustodyEventSchema.index({ event_type: 1, event_at: -1 });

module.exports = model('SpecimenCustodyEvent', specimenCustodyEventSchema);
