const { model } = require('mongoose');
const { baseSchemaOptions, Schema } = require('../common/base-model');

const auditLogSchema = new Schema(
  {
    actor_type: { type: String, enum: ['staff', 'patient', 'system'], required: true },
    actor_id: { type: Schema.Types.ObjectId },
    action: { type: String, required: true, trim: true },
    target_type: { type: String, trim: true },
    target_id: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ['success', 'failure'], required: true },
    message: { type: String, trim: true },
    ip_address: { type: String },
    user_agent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'audit_logs' },
);

auditLogSchema.index({ actor_type: 1, actor_id: 1, created_at: -1 });
auditLogSchema.index({ action: 1, created_at: -1 });
auditLogSchema.index({ target_type: 1, target_id: 1, created_at: -1 });
auditLogSchema.index({ status: 1, created_at: -1 });

module.exports = model('AuditLog', auditLogSchema);
