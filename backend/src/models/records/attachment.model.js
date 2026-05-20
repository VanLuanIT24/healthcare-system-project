const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_STATUS,
  ATTACHMENT_STATUSES,
  DOCUMENT_REVIEW_STATUS,
  DOCUMENT_REVIEW_STATUSES,
  DOCUMENT_SOURCE,
  DOCUMENT_SOURCES,
  DOCUMENT_VISIBILITIES,
  DOCUMENT_VISIBILITY,
} = require('../../constants/statuses');

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
    storage_provider: { type: String, default: 'local', trim: true },
    storage_key: { type: String, trim: true },
    checksum: { type: String, trim: true },
    checksum_sha256: { type: String, trim: true },
    scan_status: { type: String, enum: ['pending', 'clean', 'infected', 'failed', 'skipped'], default: 'pending' },
    scan_result: { type: Schema.Types.Mixed },
    preview_url: { type: String, trim: true },
    thumbnail_url: { type: String, trim: true },
    download_count: { type: Number, default: 0, min: 0 },
    last_downloaded_at: { type: Date },
    category: { type: String, trim: true },
    description: { type: String },
    source: { type: String, enum: DOCUMENT_SOURCES, default: DOCUMENT_SOURCE.STAFF_UPLOAD, required: true },
    review_status: { type: String, enum: DOCUMENT_REVIEW_STATUSES, default: DOCUMENT_REVIEW_STATUS.ACCEPTED, required: true },
    review_note: { type: String },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    submitted_for_review_at: { type: Date },
    visibility: { type: String, enum: DOCUMENT_VISIBILITIES, default: DOCUMENT_VISIBILITY.STAFF_ONLY, required: true },
    released_to_patient: { type: Boolean, default: false },
    released_at: { type: Date },
    released_by: { type: Schema.Types.ObjectId, ref: 'User' },
    release_revoked_at: { type: Date },
    release_revoked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    release_revoke_reason: { type: String },
    signed_download_token_version: { type: Number, default: 1, min: 1 },
    signed_download_revoked_at: { type: Date },
    archived_by: { type: Schema.Types.ObjectId, ref: 'User' },
    archived_by_patient: { type: Boolean, default: false },
    archived_by_staff: { type: Boolean, default: false },
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
attachmentSchema.index({ storage_provider: 1, storage_key: 1 }, { unique: true, sparse: true });
attachmentSchema.index({ checksum_sha256: 1 });
attachmentSchema.index({ scan_status: 1 });
attachmentSchema.index({ category: 1 });
attachmentSchema.index({ source: 1 });
attachmentSchema.index({ review_status: 1 });
attachmentSchema.index({ visibility: 1 });
attachmentSchema.index({ status: 1 });
attachmentSchema.index({ released_to_patient: 1 });
attachmentSchema.index({ release_revoked_at: 1 });
attachmentSchema.index({ patient_id: 1, entity_type: 1, created_at: -1 });
attachmentSchema.index({ patient_id: 1, created_at: -1 });
attachmentSchema.index({ encounter_id: 1, created_at: -1 });

module.exports = model('Attachment', attachmentSchema);
