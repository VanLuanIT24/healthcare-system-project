const { model } = require('mongoose');
const { baseSchemaOptions, Schema } = require('../common/base-model');
const {
  ACTOR_TYPE,
  AUDIT_SEVERITIES,
  AUDIT_SEVERITY,
  AUDIT_STATUS,
  AUDIT_STATUSES,
} = require('../../constants/statuses');

// Bảng audit_logs: Lưu nhật ký thao tác hệ thống, đối tượng tác động và dữ liệu trước/sau.

const auditLogSchema = new Schema(
  {
    actor_type: {
      type: String,
      enum: [
        ACTOR_TYPE.STAFF,
        ACTOR_TYPE.PATIENT,
        ACTOR_TYPE.PATIENT_RELATIVE,
        ACTOR_TYPE.SYSTEM,
        ACTOR_TYPE.SERVICE_ACCOUNT,
      ],
      required: true,
    },
    actor_id: { type: Schema.Types.Mixed },
    action: { type: String, required: true, trim: true },
    module_key: { type: String, trim: true, lowercase: true },
    target_type: { type: String, trim: true },
    target_id: { type: Schema.Types.ObjectId },
    status: { type: String, enum: AUDIT_STATUSES, default: AUDIT_STATUS.SUCCESS, required: true },
    severity: { type: String, enum: AUDIT_SEVERITIES, default: AUDIT_SEVERITY.INFO, required: true },
    message: { type: String, trim: true },
    request_id: { type: String, trim: true },
    session_id: { type: Schema.Types.ObjectId, ref: 'AuthSession' },
    ip_address: { type: String },
    user_agent: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'audit_logs' },
);

auditLogSchema.index({ actor_type: 1, actor_id: 1, created_at: -1 });
auditLogSchema.index({ action: 1, created_at: -1 });
auditLogSchema.index({ target_type: 1, target_id: 1, created_at: -1 });
auditLogSchema.index({ status: 1, created_at: -1 });
auditLogSchema.index({ module_key: 1, created_at: -1 });
auditLogSchema.index({ severity: 1, created_at: -1 });
auditLogSchema.index({ request_id: 1 });
auditLogSchema.index({ created_at: -1 });

module.exports = model('AuditLog', auditLogSchema);
