const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { CLINICAL_NOTE_STATUS, CLINICAL_NOTE_STATUSES } = require('../../constants/statuses');

// Bảng clinical_notes: Lưu ghi chú lâm sàng dạng văn bản trong quá trình khám/điều trị.

const clinicalNoteSchema = new Schema(
  {
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    consultation_id: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    author_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note_type: { type: String, trim: true, default: 'progress_note' },
    title: { type: String, trim: true },
    content: { type: String, required: true },
    signed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    signed_at: { type: Date },
    amended_by: { type: Schema.Types.ObjectId, ref: 'User' },
    amended_at: { type: Date },
    amend_reason: { type: String },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    status: { type: String, enum: CLINICAL_NOTE_STATUSES, default: CLINICAL_NOTE_STATUS.DRAFT, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_notes' },
);

clinicalNoteSchema.index({ encounter_id: 1 });
clinicalNoteSchema.index({ consultation_id: 1 });
clinicalNoteSchema.index({ author_id: 1 });
clinicalNoteSchema.index({ status: 1 });
clinicalNoteSchema.index({ encounter_id: 1, status: 1 });
clinicalNoteSchema.index({ author_id: 1, status: 1 });

module.exports = model('ClinicalNote', clinicalNoteSchema);
