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
const { SystemSetting, SystemSettingRevision } = require('../../models');
const auditService = require('../audit.service');
const { getActorId, isSuperAdmin } = require('../auth/auth.policy');
const permissionService = require('../permission.service');

const SETTING_KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const ENCRYPTION_PREFIX = 'enc:v1:';
const SNAPSHOT_FIELDS = [
  'setting_key',
  'setting_name',
  'module_key',
  'value_type',
  'setting_value',
  'default_value',
  'description',
  'is_public',
  'is_sensitive',
  'is_encrypted',
  'requires_restart',
  'runtime_reloadable',
  'risk_level',
  'affected_services',
  'last_applied_at',
  'status',
];

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
    requires_restart: Boolean(plain.requires_restart),
    runtime_reloadable: plain.runtime_reloadable !== false,
    risk_level: plain.risk_level || 'medium',
    affected_services: plain.affected_services || [],
    last_applied_at: plain.last_applied_at,
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

function normalizeAffectedServices(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((item) => normalizeString(item)).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeSettingSnapshot(setting = {}) {
  const plain = typeof setting.toObject === 'function' ? setting.toObject() : setting;
  return SNAPSHOT_FIELDS.reduce((snapshot, field) => {
    if (plain[field] !== undefined) snapshot[field] = plain[field];
    return snapshot;
  }, {});
}

function changedSettingFields(before = {}, after = {}) {
  const left = before || {};
  const right = after || {};
  const fields = new Set([...Object.keys(left), ...Object.keys(right)]);

  return [...fields].filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]));
}

function redactSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const safe = { ...snapshot };
  if (safe.is_sensitive || safe.is_encrypted) {
    if (Object.prototype.hasOwnProperty.call(safe, 'setting_value')) {
      safe.setting_value = safe.setting_value === undefined || safe.setting_value === null ? safe.setting_value : '[REDACTED]';
    }
    if (Object.prototype.hasOwnProperty.call(safe, 'default_value')) {
      safe.default_value = safe.default_value === undefined || safe.default_value === null ? safe.default_value : '[REDACTED]';
    }
  }
  return safe;
}

async function getNextRevisionNo(settingKey) {
  const latest = await SystemSettingRevision.findOne({ setting_key: settingKey })
    .sort({ revision_no: -1 })
    .select('revision_no')
    .lean();
  return Number(latest?.revision_no || 0) + 1;
}

function serializeRevision(revision) {
  const plain = typeof revision.toObject === 'function' ? revision.toObject() : revision;
  return {
    revision_id: String(plain._id || plain.id),
    setting_id: String(plain.setting_id),
    setting_key: plain.setting_key,
    revision_no: plain.revision_no,
    action: plain.action,
    before_snapshot: redactSnapshot(plain.before_snapshot),
    after_snapshot: redactSnapshot(plain.after_snapshot),
    changed_fields: plain.changed_fields || [],
    change_reason: plain.change_reason,
    changed_by: plain.changed_by,
    request_meta: plain.request_meta,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

async function recordSettingRevision({
  setting,
  beforeSnapshot,
  afterSnapshot,
  action = 'update',
  actor = {},
  requestMeta = {},
  changeReason,
} = {}) {
  const after = afterSnapshot || normalizeSettingSnapshot(setting);
  const settingKey = after.setting_key || beforeSnapshot?.setting_key || setting?.setting_key;
  if (!settingKey) return null;

  const revision = await SystemSettingRevision.create({
    setting_id: setting?._id || setting?.id,
    setting_key: settingKey,
    revision_no: await getNextRevisionNo(settingKey),
    action,
    before_snapshot: beforeSnapshot || null,
    after_snapshot: after || null,
    changed_fields: changedSettingFields(beforeSnapshot || {}, after || {}),
    change_reason: normalizeString(changeReason || requestMeta?.reason),
    changed_by: getActorId(actor),
    request_meta: {
      ip_address: requestMeta.ipAddress,
      user_agent: requestMeta.userAgent,
      request_id: requestMeta.requestId,
      session_id: requestMeta.sessionId,
    },
  });

  return revision;
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
    requires_restart: Boolean(payload.requires_restart),
    runtime_reloadable: payload.runtime_reloadable !== undefined ? Boolean(payload.runtime_reloadable) : true,
    risk_level: payload.risk_level || 'medium',
    affected_services: normalizeAffectedServices(payload.affected_services) || [],
    last_applied_at: payload.last_applied_at,
    status: payload.status || SYSTEM_SETTING_STATUS.ACTIVE,
    created_by: getActorId(actor),
  });

  await recordSettingRevision({
    setting,
    beforeSnapshot: null,
    afterSnapshot: normalizeSettingSnapshot(setting),
    action: 'create',
    actor,
    requestMeta,
    changeReason: payload.change_reason,
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
  if (payload.requires_restart !== undefined) setting.requires_restart = Boolean(payload.requires_restart);
  if (payload.runtime_reloadable !== undefined) setting.runtime_reloadable = Boolean(payload.runtime_reloadable);
  if (payload.risk_level !== undefined) setting.risk_level = payload.risk_level || 'medium';
  if (payload.affected_services !== undefined) setting.affected_services = normalizeAffectedServices(payload.affected_services);
  if (payload.last_applied_at !== undefined) setting.last_applied_at = payload.last_applied_at;
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

  await recordSettingRevision({
    setting,
    beforeSnapshot: normalizeSettingSnapshot(before),
    afterSnapshot: normalizeSettingSnapshot(setting),
    action: payload.rollback_from_revision ? 'rollback' : 'update',
    actor,
    requestMeta,
    changeReason: payload.change_reason,
  });

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

async function listSystemSettingRevisions(settingKey, query = {}) {
  validateSettingKey(settingKey);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const revisions = await SystemSettingRevision.find({ setting_key: settingKey })
    .sort({ revision_no: -1 })
    .limit(limit)
    .lean();

  return { items: revisions.map(serializeRevision) };
}

function applyRawSnapshotToSetting(setting, snapshot = {}) {
  SNAPSHOT_FIELDS.forEach((field) => {
    if (field === 'setting_key') return;
    if (Object.prototype.hasOwnProperty.call(snapshot, field)) {
      setting[field] = snapshot[field];
    }
  });
}

async function rollbackSystemSetting(settingKey, payload = {}, actor = {}, requestMeta = {}) {
  const setting = await findSetting(settingKey);
  assertCanManageSensitiveSetting(setting, actor);

  const revisionNo = Number(payload.revision_no || payload.revisionNo);
  if (!Number.isFinite(revisionNo) || revisionNo <= 0) {
    throw ApiError.validation('revision_no là bắt buộc để rollback.');
  }

  const revision = await SystemSettingRevision.findOne({ setting_key: settingKey, revision_no: revisionNo }).lean();
  if (!revision) throw ApiError.notFound('Không tìm thấy revision để rollback.');

  const targetSnapshot = payload.target === 'after'
    ? revision.after_snapshot
    : revision.before_snapshot;
  if (!targetSnapshot) {
    throw ApiError.conflict('Revision này không có snapshot phù hợp để rollback.');
  }

  const before = setting.toObject();
  applyRawSnapshotToSetting(setting, targetSnapshot);
  setting.updated_by = getActorId(actor);
  await setting.save();

  await recordSettingRevision({
    setting,
    beforeSnapshot: normalizeSettingSnapshot(before),
    afterSnapshot: normalizeSettingSnapshot(setting),
    action: 'rollback',
    actor,
    requestMeta,
    changeReason: payload.change_reason || `Rollback to revision ${revisionNo}`,
  });

  await auditService.recordAuditLog({
    actor,
    action: 'settings.rollback',
    targetType: 'system_setting',
    targetId: setting._id,
    before,
    after: setting,
    message: `System setting rolled back to revision ${revisionNo}.`,
    requestMeta,
    metadata: {
      revision_no: revisionNo,
      target: payload.target || 'before',
    },
  });

  return { setting: serializeSetting(setting, { includeSensitive: canUpdateSensitiveSetting(actor) }) };
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
  // listSystemSettingRevisions: Liệt kê revision của setting.
  listSystemSettingRevisions,
  // rollbackSystemSetting: Rollback setting về snapshot revision.
  rollbackSystemSetting,
};
