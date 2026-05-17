const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const { BREAK_GLASS_STATUSES, BREAK_GLASS_STATUS } = require('../../constants/statuses');

// Bảng break_glass_accesses: Lưu phiên truy cập khẩn cấp vào hồ sơ bệnh nhân.

const breakGlassAccessSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    accessed_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    started_at: { type: Date, default: Date.now, required: true },
    ended_at: { type: Date },
    status: { type: String, enum: BREAK_GLASS_STATUSES, default: BREAK_GLASS_STATUS.ACTIVE, required: true },
    audit_log_ids: [{ type: Schema.Types.ObjectId, ref: 'AuditLog' }],
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'break_glass_accesses' },
);

breakGlassAccessSchema.index({ patient_id: 1, started_at: -1 });
breakGlassAccessSchema.index({ accessed_by_user_id: 1, status: 1 });
breakGlassAccessSchema.index({ status: 1, started_at: -1 });

module.exports = model('BreakGlassAccess', breakGlassAccessSchema);
