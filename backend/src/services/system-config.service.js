const { SystemSetting } = require('../models');
const { SYSTEM_SETTING_STATUS, SYSTEM_SETTING_VALUE_TYPE } = require('../constants/statuses');

const SYSTEM_CONFIG_DEFAULTS = [
  ['appointments.cancellation_window_minutes', 'Appointment cancellation window', 'appointments', SYSTEM_SETTING_VALUE_TYPE.NUMBER, 240],
  ['billing.payment_intent_expiry_minutes', 'Payment intent expiry minutes', 'billing', SYSTEM_SETTING_VALUE_TYPE.NUMBER, 15],
  ['security.qr_expiry_minutes', 'QR token expiry minutes', 'security', SYSTEM_SETTING_VALUE_TYPE.NUMBER, 10],
  ['records.document_export_expiry_hours', 'Document export expiry hours', 'records', SYSTEM_SETTING_VALUE_TYPE.NUMBER, 24],
  ['support.sla_by_priority_minutes', 'Support SLA by priority', 'support', SYSTEM_SETTING_VALUE_TYPE.JSON, {
    urgent: 15,
    high: 120,
    normal: 1440,
    low: 4320,
  }],
  ['files.max_upload_size_bytes', 'Max upload size bytes', 'files', SYSTEM_SETTING_VALUE_TYPE.NUMBER, 10 * 1024 * 1024],
  ['messaging.attachment_allowed_types', 'Message attachment allowed MIME types', 'messaging', SYSTEM_SETTING_VALUE_TYPE.ARRAY, [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ]],
  ['access.break_glass_duration_minutes', 'Break-glass access duration minutes', 'access', SYSTEM_SETTING_VALUE_TYPE.NUMBER, 60],
  ['features.enable_online_payment', 'Enable online payment', 'features', SYSTEM_SETTING_VALUE_TYPE.BOOLEAN, true],
  ['features.enable_patient_chat', 'Enable patient chat', 'features', SYSTEM_SETTING_VALUE_TYPE.BOOLEAN, true],
  ['features.enable_emergency_sos', 'Enable emergency SOS', 'features', SYSTEM_SETTING_VALUE_TYPE.BOOLEAN, true],
  ['features.enable_voice_call_recording', 'Enable voice call recording', 'features', SYSTEM_SETTING_VALUE_TYPE.BOOLEAN, false],
];

async function ensureSystemConfigDefaults() {
  await Promise.all(SYSTEM_CONFIG_DEFAULTS.map(([setting_key, setting_name, module_key, value_type, default_value]) =>
    SystemSetting.updateOne(
      { setting_key },
      {
        $setOnInsert: {
          setting_key,
          setting_name,
          module_key,
          value_type,
          setting_value: default_value,
          default_value,
          is_public: false,
          is_sensitive: false,
          is_encrypted: false,
          status: SYSTEM_SETTING_STATUS.ACTIVE,
        },
      },
      { upsert: true },
    )));
}

async function getConfigValue(settingKey, fallbackValue = null) {
  const setting = await SystemSetting.findOne({
    setting_key: settingKey,
    status: SYSTEM_SETTING_STATUS.ACTIVE,
  }).lean();
  return setting ? setting.setting_value : fallbackValue;
}

async function isFeatureEnabled(flagKey, fallback = false) {
  const settingKey = flagKey.startsWith('features.') ? flagKey : `features.${flagKey}`;
  return Boolean(await getConfigValue(settingKey, fallback));
}

module.exports = {
  SYSTEM_CONFIG_DEFAULTS,
  ensureSystemConfigDefaults,
  getConfigValue,
  isFeatureEnabled,
};
