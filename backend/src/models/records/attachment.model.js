const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ATTACHMENT_ENTITY_TYPES, ATTACHMENT_STATUS, ATTACHMENT_STATUSES } = require('../../constants/statuses');

// Bảng attachments: Lưu file đính kèm bệnh án và liên kết linh hoạt tới các nghiệp vụ khác.

const attachmentSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    medical_record_id: { type: Schema.Types.ObjectId, ref: 'MedicalRecord' },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    entity_type: { type: String, enum: ATTACHMENT_ENTITY_TYPES, trim: true, required: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    uploaded_by: { type: Schema.Types.ObjectId, ref: 'User' },
    file_name: { type: String, required: true, trim: true },
    original_name: { type: String, trim: true },
    mime_type: { type: String, trim: true },
    file_size: { type: Number, min: 0 },
    storage_path: { type: String, required: true },
    checksum: { type: String, trim: true },
    category: { type: String, trim: true },
    description: { type: String },
    released_to_patient: { type: Boolean, default: false },
    released_at: { type: Date },
    released_by: { type: Schema.Types.ObjectId, ref: 'User' },
    archived_by: { type: Schema.Types.ObjectId, ref: 'User' },
    archived_at: { type: Date },
    archive_reason: { type: String },
    deleted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    deleted_at: { type: Date },
    delete_reason: { type: String },
    status: { type: String, enum: ATTACHMENT_STATUSES, default: ATTACHMENT_STATUS.ACTIVE, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'attachments' },
);

attachmentSchema.index({ patient_id: 1 });
attachmentSchema.index({ encounter_id: 1 });
attachmentSchema.index({ medical_record_id: 1 });
attachmentSchema.index({ order_id: 1 });
attachmentSchema.index({ entity_type: 1, entity_id: 1 });
attachmentSchema.index({ entity_type: 1, entity_id: 1, checksum: 1 }, { unique: true, sparse: true });
attachmentSchema.index({ uploaded_by: 1 });
attachmentSchema.index({ mime_type: 1 });
attachmentSchema.index({ checksum: 1 });
attachmentSchema.index({ category: 1 });
attachmentSchema.index({ status: 1 });
attachmentSchema.index({ released_to_patient: 1 });
attachmentSchema.index({ patient_id: 1, entity_type: 1, created_at: -1 });
attachmentSchema.index({ patient_id: 1, created_at: -1 });
attachmentSchema.index({ encounter_id: 1, created_at: -1 });

module.exports = model('Attachment', attachmentSchema);
