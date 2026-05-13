const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { SYSTEM_SETTING_STATUS, SYSTEM_SETTING_STATUSES, SYSTEM_SETTING_VALUE_TYPE, SYSTEM_SETTING_VALUE_TYPES } = require('../../constants/statuses');

// Bảng system_settings: Lưu cấu hình vận hành hệ thống theo từng module.

const systemSettingSchema = new Schema(
  {
    setting_key: { type: String, required: true, unique: true, trim: true },
    setting_name: { type: String, required: true, trim: true },
    module_key: { type: String, required: true, trim: true },
    value_type: { type: String, enum: SYSTEM_SETTING_VALUE_TYPES, default: SYSTEM_SETTING_VALUE_TYPE.STRING, required: true },
    setting_value: { type: Schema.Types.Mixed },
    default_value: { type: Schema.Types.Mixed },
    description: { type: String },
    is_public: { type: Boolean, default: false, required: true },
    is_sensitive: { type: Boolean, default: false, required: true },
    is_encrypted: { type: Boolean, default: false, required: true },
    status: { type: String, enum: SYSTEM_SETTING_STATUSES, default: SYSTEM_SETTING_STATUS.ACTIVE, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'system_settings' },
);

systemSettingSchema.pre('validate', function validateSettingValue(next) {
  if (this.is_encrypted) {
    return next();
  }

  const valuesToValidate = [
    ['setting_value', this.setting_value],
    ['default_value', this.default_value],
  ];

  for (const [fieldName, value] of valuesToValidate) {
    if (value === undefined || value === null) continue;
    if (this.value_type === 'array' && !Array.isArray(value)) {
      return next(new Error(`${fieldName} phải là array khi value_type = array.`));
    }
    if (this.value_type !== 'array' && this.value_type !== 'json' && typeof value !== this.value_type) {
      return next(new Error(`${fieldName} phải là ${this.value_type}.`));
    }
  }

  return next();
});

systemSettingSchema.index({ module_key: 1 });
systemSettingSchema.index({ status: 1 });
systemSettingSchema.index({ is_public: 1, status: 1 });
systemSettingSchema.index({ module_key: 1, setting_key: 1 });

module.exports = model('SystemSetting', systemSettingSchema);
