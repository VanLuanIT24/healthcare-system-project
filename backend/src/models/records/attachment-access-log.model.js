const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const ATTACHMENT_ACCESS_ACTIONS = ['view', 'preview', 'download', 'signed_download', 'release', 'revoke_release', 'review', 'rescan', 'archive', 'restore', 'delete', 'metadata_update'];
const ATTACHMENT_ACCESS_RESULTS = ['success', 'failed', 'denied'];

const attachmentAccessLogSchema = new Schema(
  {
    attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    actor_type: { type: String, trim: true },
    actor_id: { type: Schema.Types.Mixed },
    action: { type: String, enum: ATTACHMENT_ACCESS_ACTIONS, required: true },
    result: { type: String, enum: ATTACHMENT_ACCESS_RESULTS, default: 'success', required: true },
    ip: { type: String },
    user_agent: { type: String },
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed },
    occurred_at: { type: Date, default: Date.now, required: true },
  },
  { ...baseSchemaOptions, collection: 'attachment_access_logs' },
);

attachmentAccessLogSchema.index({ attachment_id: 1, occurred_at: -1 });
attachmentAccessLogSchema.index({ patient_id: 1, occurred_at: -1 });
attachmentAccessLogSchema.index({ actor_type: 1, actor_id: 1, occurred_at: -1 });
attachmentAccessLogSchema.index({ action: 1, result: 1, occurred_at: -1 });

module.exports = model('AttachmentAccessLog', attachmentAccessLogSchema);
