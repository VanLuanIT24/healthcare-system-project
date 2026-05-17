const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const {
  ACTOR_TYPES,
  DOCUMENT_EXPORT_STATUS,
  DOCUMENT_EXPORT_STATUSES,
  DOCUMENT_EXPORT_TYPE,
  DOCUMENT_EXPORT_TYPES,
} = require('../../constants/statuses');

// Bảng document_export_requests: Job xuất ZIP/package hồ sơ cho patient portal.

const documentExportRequestSchema = new Schema(
  {
    request_code: { type: String, required: true, unique: true, trim: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    requested_by_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    requested_by_actor_id: { type: Schema.Types.Mixed, required: true },
    export_type: { type: String, enum: DOCUMENT_EXPORT_TYPES, default: DOCUMENT_EXPORT_TYPE.ATTACHMENTS_ZIP, required: true },
    selected_attachment_ids: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    status: { type: String, enum: DOCUMENT_EXPORT_STATUSES, default: DOCUMENT_EXPORT_STATUS.PENDING, required: true },
    file_url: { type: String, trim: true },
    expires_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'document_export_requests' },
);

documentExportRequestSchema.index({ patient_id: 1, created_at: -1 });
documentExportRequestSchema.index({ status: 1, created_at: -1 });
documentExportRequestSchema.index({ expires_at: 1, status: 1 });

module.exports = model('DocumentExportRequest', documentExportRequestSchema);
