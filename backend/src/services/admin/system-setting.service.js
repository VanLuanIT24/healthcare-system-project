const crypto = require('crypto');
const ApiError = require('../../common/errors/api-error');
const { normalizePagination, buildPaginationMeta } = require('../../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../../common/helpers/query.helper');
const { normalizeString } = require('../../common/helpers/string.helper');
const env = require('../../config/env');
const {
  SYSTEM_SETTING_STATUS,
  SYSTEM_SETTING_STATUSES,
  SYSTEM_SETTING_VALUE_TYPE,
  SYSTEM_SETTING_VALUE_TYPES,
} = require('../../constants/statuses');
const { PERMISSION } = require('../../constants/permissions');
const { SystemSetting } = require('../../models');
const auditService = require('../audit.service');
const { getActorId, isSuperAdmin } = require('../auth/auth.policy');
const permissionService = require('../permission.service');

const SETTING_KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const ENCRYPTION_PREFIX = 'enc:v1:';

function getEncryptionKey() {
  const secret = process.env.SYSTEM_SETTING_ENCRYPTION_SECRET || env.jwtRefreshSecret || env.jwtAccessSecret;
  if (!secret || String(secret).length < 16) {
    throw ApiError.internal('SYSTEM_SETTING_ENCRYPTION_SECRET hoặc JWT secret đủ mạnh là bắt buộc để mã hóa setting.');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptSettingValue(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX.slice(0, -1),
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

function decryptSettingValue(value) {
  const text = String(value || '');
  if (!text.startsWith(ENCRYPTION_PREFIX)) return value;

  const [, , ivText, authTagText, ciphertextText] = text.split(':');
  if (!ivText || !authTagText || !ciphertextText) {
    throw ApiError.internal('Encrypted system setting value is malformed.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagText, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(plaintext);
}

function parseSettingValue(value, valueType) {
  if (value === undefined || value === null) return value;

  if (valueType === SYSTEM_SETTING_VALUE_TYPE.STRING) return String(value);
  if (valueType === SYSTEM_SETTING_VALUE_TYPE.NUMBER) {
    const number = Number(value);
    if (Number.isNaN(number)) throw ApiError.validation('setting_value phải là number.');
    return number;
  }
  if (valueType === SYSTEM_SETTING_VALUE_TYPE.BOOLEAN) {
    if (typeof value === 'boolean') return value;
    if (['true', '1', 'yes'].includes(String(value).toLowerCase())) return true;
    if (['false', '0', 'no'].includes(String(value).toLowerCase())) return false;
    throw ApiError.validation('setting_value phải là boolean.');
  }
  if (valueType === SYSTEM_SETTING_VALUE_TYPE.JSON) {
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(String(value));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid json object.');
      }
      return parsed;
    } catch (error) {
      throw ApiError.validation('setting_value phải là JSON object hợp lệ.');
    }
  }
  if (valueType === SYSTEM_SETTING_VALUE_TYPE.ARRAY) {
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(String(value));
      if (!Array.isArray(parsed)) throw new Error('Invalid array.');
      return parsed;
    } catch (error) {
      throw ApiError.validation('setting_value phải là array hợp lệ.');
    }
  }

  throw ApiError.badRequest('value_type không hợp lệ.');
}

function serializeSetting(setting, options = {}) {
  const plain = typeof setting.toObject === 'function' ? setting.toObject() : setting;
  const hideValue = plain.is_sensitive && !options.includeSensitive;
  const readableValue = hideValue ? null : readStoredSettingValue(plain, 'setting_value');
  const readableDefaultValue = hideValue ? null : readStoredSettingValue(plain, 'default_value');

  return {
    setting_id: String(plain._id || plain.id),
    setting_key: plain.setting_key,
    setting_name: plain.setting_name,
    module_key: plain.module_key,
    value_type: plain.value_type,
    setting_value: readableValue,
    default_value: readableDefaultValue,
    description: plain.description,
    is_public: Boolean(plain.is_public),
    is_sensitive: Boolean(plain.is_sensitive),
    is_encrypted: Boolean(plain.is_encrypted),
    status: plain.status,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

function serializePublicSetting(setting) {
  const plain = typeof setting.toObject === 'function' ? setting.toObject() : setting;
  return {
    setting_key: plain.setting_key,
    setting_name: plain.setting_name,
    module_key: plain.module_key,
    value_type: plain.value_type,
    setting_value: readStoredSettingValue(plain, 'setting_value'),
    description: plain.description,
  };
}

function validateSettingKey(settingKey) {
  if (!SETTING_KEY_REGEX.test(String(settingKey || ''))) {
    throw ApiError.validation('setting_key phải theo format module.key_name, lowercase snake_case.');
  }
}

async function findSetting(settingKey, options = {}) {
  const setting = await SystemSetting.findOne({ setting_key: settingKey });
  if (!setting && options.required !== false) {
    throw ApiError.notFound('Không tìm thấy system setting.');
  }
  return setting;
}

function canUpdateSensitiveSetting(actor = {}) {
  return isSuperAdmin(actor) ||
    permissionService.hasPermission(actor.permissions || [], PERMISSION.SETTINGS.UPDATE_SENSITIVE);
}

function assertCanManageSensitiveSetting(settingOrPayload = {}, actor = {}) {
  if ((settingOrPayload.is_sensitive || settingOrPayload.is_encrypted) && !canUpdateSensitiveSetting(actor)) {
    throw ApiError.forbidden('Thiếu quyền cập nhật setting nhạy cảm.');
  }
}

function prepareStoredSettingValue(value, valueType, isEncrypted) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const parsed = parseSettingValue(value, valueType);
  return isEncrypted ? encryptSettingValue(parsed) : parsed;
}

function readStoredSettingValue(setting = {}, fieldName = 'setting_value') {
  const value = setting[fieldName];
  if (value === undefined || value === null) return value;
  const plainValue = setting.is_encrypted ? decryptSettingValue(value) : value;
  return parseSettingValue(plainValue, setting.value_type);
}

async function createSystemSetting(payload = {}, actor = {}, requestMeta = {}) {
  const settingKey = normalizeString(payload.setting_key);
  const settingName = normalizeString(payload.setting_name);
  const moduleKey = normalizeString(payload.module_key || String(settingKey || '').split('.')[0]);
  const valueType = payload.value_type || SYSTEM_SETTING_VALUE_TYPE.STRING;

  validateSettingKey(settingKey);
  if (!settingName) throw ApiError.validation('setting_name là bắt buộc.');
  if (!moduleKey) throw ApiError.validation('module_key là bắt buộc.');
  if (!SYSTEM_SETTING_VALUE_TYPES.includes(valueType)) throw ApiError.badRequest('value_type không hợp lệ.');
  if (payload.status && !SYSTEM_SETTING_STATUSES.includes(payload.status)) throw ApiError.badRequest('Trạng thái setting không hợp lệ.');
  assertCanManageSensitiveSetting(payload, actor);

  if (payload.is_public && (payload.is_sensitive || payload.is_encrypted)) {
    throw ApiError.conflict('Không được public setting nhạy cảm hoặc encrypted.');
  }

  const existed = await findSetting(settingKey, { required: false });
  if (existed) throw ApiError.conflict('setting_key đã tồn tại.');

  const setting = await SystemSetting.create({
    setting_key: settingKey,
    setting_name: settingName,
    module_key: moduleKey,
    value_type: valueType,
    setting_value: prepareStoredSettingValue(payload.setting_value, valueType, Boolean(payload.is_encrypted)),
    default_value: prepareStoredSettingValue(payload.default_value, valueType, Boolean(payload.is_encrypted)),
    description: payload.description,
    is_public: Boolean(payload.is_public),
    is_sensitive: Boolean(payload.is_sensitive),
    is_encrypted: Boolean(payload.is_encrypted),
    status: payload.status || SYSTEM_SETTING_STATUS.ACTIVE,
    created_by: getActorId(actor),
  });

  await auditService.recordAuditLog({
    actor,
    action: 'settings.create',
    targetType: 'system_setting',
    targetId: setting._id,
    after: setting,
    message: 'System setting created.',
    requestMeta,
  });

  return { setting: serializeSetting(setting, { includeSensitive: canUpdateSensitiveSetting(actor) }) };
}

async function listSystemSettings(query = {}, actor = {}, options = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {};

  if (query.module_key) filter.module_key = query.module_key;
  if (query.status) filter.status = query.status;
  if (query.is_public !== undefined) filter.is_public = query.is_public === true || query.is_public === 'true';
  if (options.publicOnly) {
    filter.is_public = true;
    filter.status = SYSTEM_SETTING_STATUS.ACTIVE;
    filter.is_encrypted = false;
    filter.is_sensitive = false;
  }

  const keyword = normalizeString(query.keyword || query.search);
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [{ setting_key: regex }, { setting_name: regex }, { module_key: regex }];
  }

  const [settings, total] = await Promise.all([
    SystemSetting.find(filter).sort({ module_key: 1, setting_key: 1 }).skip(skip).limit(limit).lean(),
    SystemSetting.countDocuments(filter),
  ]);

  return {
    items: settings.map((setting) => (options.publicOnly
      ? serializePublicSetting(setting)
      : serializeSetting(setting, {
        includeSensitive: canUpdateSensitiveSetting(actor),
      }))),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function listSystemSettingsGrouped(query = {}, actor = {}, options = {}) {
  const filter = {};
  if (query.module_key) filter.module_key = query.module_key;
  if (options.publicOnly) {
    filter.is_public = true;
    filter.status = SYSTEM_SETTING_STATUS.ACTIVE;
    filter.is_encrypted = false;
    filter.is_sensitive = false;
  }

  const settings = await SystemSetting.find(filter).sort({ module_key: 1, setting_key: 1 }).lean();
  const grouped = {};
  settings.forEach((setting) => {
    if (!grouped[setting.module_key]) grouped[setting.module_key] = {};
    grouped[setting.module_key][setting.setting_key] = options.publicOnly
      ? serializePublicSetting(setting)
      : serializeSetting(setting, {
        includeSensitive: canUpdateSensitiveSetting(actor),
      });
  });

  return { grouped };
}

async function getSystemSetting(settingKey, options = {}) {
  const setting = await findSetting(settingKey, { required: !Object.prototype.hasOwnProperty.call(options, 'defaultValue') });
  if (!setting) return options.defaultValue;
  if (setting.status !== SYSTEM_SETTING_STATUS.ACTIVE && !options.includeInactive) {
    if (Object.prototype.hasOwnProperty.call(options, 'defaultValue')) return options.defaultValue;
    throw ApiError.notFound('System setting đang inactive.');
  }
  return readStoredSettingValue(setting, 'setting_value');
}

async function getSystemSettingDetail(settingKey, actor = {}) {
  const setting = await findSetting(settingKey);
  return { setting: serializeSetting(setting, { includeSensitive: canUpdateSensitiveSetting(actor) }) };
}

async function updateSystemSetting(settingKey, payload = {}, actor = {}, requestMeta = {}) {
  const setting = await findSetting(settingKey);
  assertCanManageSensitiveSetting(setting, actor);

  const before = setting.toObject();
  const nextValueType = payload.value_type !== undefined ? payload.value_type : setting.value_type;
  const nextIsSensitive = payload.is_sensitive !== undefined ? Boolean(payload.is_sensitive) : setting.is_sensitive;
  const nextIsEncrypted = payload.is_encrypted !== undefined ? Boolean(payload.is_encrypted) : setting.is_encrypted;
  const nextIsPublic = payload.is_public !== undefined ? Boolean(payload.is_public) : setting.is_public;

  if (!SYSTEM_SETTING_VALUE_TYPES.includes(nextValueType)) throw ApiError.badRequest('value_type không hợp lệ.');
  if (payload.status !== undefined && !SYSTEM_SETTING_STATUSES.includes(payload.status)) throw ApiError.badRequest('Trạng thái setting không hợp lệ.');
  if (nextIsPublic && (nextIsSensitive || nextIsEncrypted)) {
    throw ApiError.conflict('Không được public setting nhạy cảm hoặc encrypted.');
  }
  if ((payload.is_sensitive !== undefined || payload.is_encrypted !== undefined) && !canUpdateSensitiveSetting(actor)) {
    throw ApiError.forbidden('Thiếu quyền cập nhật cờ sensitive/encrypted.');
  }
  if (nextIsEncrypted && !setting.is_encrypted) {
    assertCanManageSensitiveSetting({ is_encrypted: true }, actor);
  }
  if (payload.value_type !== undefined && payload.value_type !== setting.value_type) {
    const missingFields = [];
    if (setting.setting_value !== undefined && payload.setting_value === undefined) missingFields.push('setting_value');
    if (setting.default_value !== undefined && payload.default_value === undefined) missingFields.push('default_value');
    if (missingFields.length) {
      throw ApiError.validation(
        'Khi đổi value_type, cần truyền lại toàn bộ value hiện có để tránh ép kiểu sai.',
        missingFields.map((field) => ({
          field,
          message: `${field} must be provided when value_type changes.`,
        })),
      );
    }
  }

  if (payload.setting_name !== undefined) setting.setting_name = normalizeString(payload.setting_name);
  if (payload.module_key !== undefined) setting.module_key = normalizeString(payload.module_key);
  if (payload.description !== undefined) setting.description = payload.description;
  if (payload.status !== undefined) setting.status = payload.status;
  setting.is_public = nextIsPublic;
  setting.is_sensitive = nextIsSensitive;
  setting.is_encrypted = nextIsEncrypted;
  setting.value_type = nextValueType;

  if (payload.setting_value !== undefined) {
    setting.setting_value = prepareStoredSettingValue(payload.setting_value, setting.value_type, setting.is_encrypted);
  } else if (payload.is_encrypted !== undefined && before.setting_value !== undefined) {
    setting.setting_value = prepareStoredSettingValue(readStoredSettingValue(before, 'setting_value'), setting.value_type, setting.is_encrypted);
  }

  if (payload.default_value !== undefined) {
    setting.default_value = prepareStoredSettingValue(payload.default_value, setting.value_type, setting.is_encrypted);
  } else if (payload.is_encrypted !== undefined && before.default_value !== undefined) {
    setting.default_value = prepareStoredSettingValue(readStoredSettingValue(before, 'default_value'), setting.value_type, setting.is_encrypted);
  }
  setting.updated_by = getActorId(actor);
  await setting.save();

  await auditService.recordAuditLog({
    actor,
    action: 'settings.update',
    targetType: 'system_setting',
    targetId: setting._id,
    before,
    after: setting,
    message: 'System setting updated.',
    requestMeta,
  });

  return { setting: serializeSetting(setting, { includeSensitive: canUpdateSensitiveSetting(actor) }) };
}

async function getPublicSettings(query = {}) {
  return listSystemSettingsGrouped(query, {}, { publicOnly: true });
}

module.exports = {
  // parseSettingValue: Phân tích/chuyển đổi giá trị cấu hình hệ thống.
  parseSettingValue,
  // encryptSettingValue: Mã hóa giá trị cấu hình hệ thống.
  encryptSettingValue,
  // decryptSettingValue: Giải mã giá trị cấu hình hệ thống.
  decryptSettingValue,
  // readStoredSettingValue: Đọc và giải mã/chuẩn hóa giá trị cấu hình đã lưu.
  readStoredSettingValue,
  // createSystemSetting: Tạo cấu hình hệ thống.
  createSystemSetting,
  // listSystemSettings: Liệt kê cấu hình hệ thống.
  listSystemSettings,
  // listSystemSettingsGrouped: Liệt kê cấu hình hệ thống được nhóm theo phân hệ.
  listSystemSettingsGrouped,
  // getSystemSetting: Lấy cấu hình hệ thống.
  getSystemSetting,
  // getSystemSettingDetail: Lấy hệ thống cấu hình chi tiết.
  getSystemSettingDetail,
  // updateSystemSetting: Cập nhật cấu hình hệ thống.
  updateSystemSetting,
  // getPublicSettings: Lấy các cấu hình công khai.
  getPublicSettings,
};
