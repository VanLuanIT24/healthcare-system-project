const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

// Bảng system_setting_revisions: Lưu snapshot raw để audit diff và rollback cấu hình.

const systemSettingRevisionSchema = new Schema(
  {
    setting_id: { type: Schema.Types.ObjectId, ref: 'SystemSetting', required: true, index: true },
    setting_key: { type: String, required: true, trim: true, index: true },
    revision_no: { type: Number, required: true },
    action: { type: String, enum: ['create', 'update', 'rollback'], default: 'update', required: true },
    before_snapshot: { type: Schema.Types.Mixed },
    after_snapshot: { type: Schema.Types.Mixed },
    changed_fields: [{ type: String, trim: true }],
    change_reason: { type: String, trim: true },
    changed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    request_meta: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'system_setting_revisions' },
);

systemSettingRevisionSchema.index({ setting_key: 1, revision_no: -1 }, { unique: true });
systemSettingRevisionSchema.index({ created_at: -1 });

module.exports = model('SystemSettingRevision', systemSettingRevisionSchema);
