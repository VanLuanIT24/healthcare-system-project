const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const clinicalNoteStatuses = ['draft', 'in_progress', 'signed', 'amended', 'cancelled'];

const clinicalNoteSchema = new Schema(
  {
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    consultation_id: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    author_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note_type: { type: String, trim: true, default: 'progress_note' },
    title: { type: String, trim: true },
    content: { type: String, required: true },
    status: { type: String, enum: clinicalNoteStatuses, default: 'draft', required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_notes' },
);

clinicalNoteSchema.index({ encounter_id: 1 });
clinicalNoteSchema.index({ consultation_id: 1 });
clinicalNoteSchema.index({ author_id: 1 });
clinicalNoteSchema.index({ status: 1 });

module.exports = model('ClinicalNote', clinicalNoteSchema);
