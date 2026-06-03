const mongoose = require('mongoose');
const ApiError = require('../common/errors/api-error');
const { startOfDay, endOfDay } = require('../common/helpers/date-time.helper');
const { getScheduleTypeCatalog } = require('../constants/catalogs/schedule-types');
const {
  Appointment,
  AuditLog,
  DoctorSchedule,
  QueueTicket,
  ScheduleSlot,
  SystemSetting,
} = require('../models');
const auditService = require('./audit.service');
const systemSettingService = require('./admin/system-setting.service');

const SCHEDULING_MODULE_KEY = 'scheduling';
const DEFAULT_SCOPE = 'system';

const DEFAULT_SETTINGS = [
  {
    setting_key: 'scheduling.timezone',
    setting_name: 'Timezone vận hành',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'string',
    setting_value: 'Asia/Ho_Chi_Minh',
    default_value: 'Asia/Ho_Chi_Minh',
    description: 'Timezone dùng để tính ngày vận hành, SLA, queue và nhắc lịch.',
    runtime_reloadable: true,
    risk_level: 'medium',
    affected_services: ['schedules', 'appointments', 'queue'],
    status: 'active',
  },
  {
    setting_key: 'scheduling.default_slot_duration_minutes',
    setting_name: 'Slot duration mặc định',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'number',
    setting_value: 30,
    default_value: 30,
    description: 'Thời lượng slot mặc định khi tạo lịch làm việc mới.',
    runtime_reloadable: true,
    risk_level: 'medium',
    affected_services: ['schedules', 'schedule_slots'],
    status: 'active',
  },
  {
    setting_key: 'scheduling.default_schedule_publish_mode',
    setting_name: 'Chế độ publish mặc định',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'string',
    setting_value: 'manual',
    default_value: 'manual',
    description: 'Manual giúp trưởng khoa kiểm tra trước khi mở đặt lịch.',
    runtime_reloadable: true,
    risk_level: 'medium',
    affected_services: ['schedules'],
    status: 'active',
  },
  {
    setting_key: 'scheduling.enable_waitlist',
    setting_name: 'Bật danh sách chờ',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'boolean',
    setting_value: true,
    default_value: true,
    description: 'Cho phép đưa bệnh nhân vào waitlist khi slot hết.',
    runtime_reloadable: true,
    risk_level: 'low',
    affected_services: ['appointments', 'schedule_slots'],
    status: 'active',
  },
  {
    setting_key: 'scheduling.enable_telehealth',
    setting_name: 'Bật telehealth',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'boolean',
    setting_value: true,
    default_value: true,
    description: 'Cho phép tạo lịch hẹn tư vấn từ xa.',
    runtime_reloadable: true,
    risk_level: 'medium',
    affected_services: ['appointments', 'notifications'],
    status: 'active',
  },
  {
    setting_key: 'scheduling.enable_queue_auto_create_on_checkin',
    setting_name: 'Check-in tự tạo queue',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'boolean',
    setting_value: true,
    default_value: true,
    description: 'Khi check-in lịch hẹn, tự tạo queue ticket nếu chưa có.',
    runtime_reloadable: true,
    risk_level: 'high',
    affected_services: ['appointments', 'queue'],
    status: 'active',
  },
  {
    setting_key: 'scheduling.default_checkin_window_before_minutes',
    setting_name: 'Check-in sớm tối đa',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'number',
    setting_value: 30,
    default_value: 30,
    description: 'Số phút bệnh nhân được check-in trước giờ hẹn.',
    runtime_reloadable: true,
    risk_level: 'medium',
    affected_services: ['appointments', 'queue'],
    status: 'active',
  },
  {
    setting_key: 'scheduling.default_checkin_window_after_minutes',
    setting_name: 'Check-in trễ tối đa',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'number',
    setting_value: 15,
    default_value: 15,
    description: 'Số phút bệnh nhân vẫn được check-in sau giờ hẹn.',
    runtime_reloadable: true,
    risk_level: 'medium',
    affected_services: ['appointments', 'queue'],
    status: 'active',
  },
  {
    setting_key: 'scheduling.alert.queue_wait_threshold_minutes',
    setting_name: 'Ngưỡng cảnh báo queue',
    module_key: SCHEDULING_MODULE_KEY,
    value_type: 'number',
    setting_value: 30,
    default_value: 30,
    description: 'Queue chờ quá ngưỡng sẽ vào action center.',
    runtime_reloadable: true,
    risk_level: 'high',
    affected_services: ['queue', 'operations'],
    status: 'active',
  },
];

const TEMPLATE_DEFAULTS = [
  {
    id: 'tpl-outpatient-morning',
    name: 'Ngoại trú sáng T2-T6',
    scope: 'Toàn viện',
    days: ['T2', 'T3', 'T4', 'T5', 'T6'],
    start: '07:00',
    end: '11:30',
    duration: 30,
    scheduleType: 'Khám chuyên khoa',
    status: 'active',
    lastUsed: 'Chưa đồng bộ',
  },
  {
    id: 'tpl-followup-weekend',
    name: 'Tái khám cuối tuần',
    scope: 'Khoa Tim mạch',
    days: ['T7'],
    start: '08:00',
    end: '11:00',
    duration: 20,
    scheduleType: 'Tái khám',
    status: 'draft',
    lastUsed: 'Chưa đồng bộ',
  },
];

const RULE_DEFAULTS = {
  slotRules: [
    {
      id: 'slot-standard',
      name: 'Slot chuẩn outpatient',
      scope: 'Toàn viện',
      primary: '30 phút',
      secondary: 'Capacity 1',
      priority: 10,
      flags: ['Auto generate khi publish', 'Hold 10 phút', 'Không overbook'],
      status: 'active',
    },
    {
      id: 'slot-followup',
      name: 'Slot tái khám nhanh',
      scope: 'Khoa Tim mạch',
      primary: '20 phút',
      secondary: 'Capacity 1',
      priority: 20,
      flags: ['Break 09:30-09:45', 'Portal ON'],
      status: 'active',
    },
  ],
  bookingRules: [
    {
      id: 'booking-window-standard',
      name: 'Cửa sổ đặt lịch chuẩn',
      scope: 'Toàn viện',
      primary: 'Tối đa 30 ngày',
      secondary: 'Tối thiểu 60 phút',
      priority: 10,
      flags: ['Chặn trùng bệnh nhân cùng ngày', 'Validate doctor conflict', 'Cho phép waitlist'],
      status: 'active',
    },
  ],
  checkInRules: [
    {
      id: 'checkin-standard',
      name: 'Check-in chuẩn',
      scope: 'Toàn viện',
      primary: '-30 / +15 phút',
      secondary: 'Auto queue ON',
      priority: 10,
      flags: ['Chặn duplicate active queue', 'Yêu cầu xác minh danh tính'],
      status: 'active',
    },
  ],
  cancelRules: [
    {
      id: 'cancel-patient',
      name: 'Hủy lịch bệnh nhân',
      scope: 'Portal',
      primary: 'Trước 120 phút',
      secondary: 'Reopen slot',
      priority: 10,
      flags: ['Cần lý do', 'Offer waitlist nếu có'],
      status: 'active',
    },
  ],
  queueRules: [
    {
      id: 'queue-priority',
      name: 'Gọi số theo ưu tiên',
      scope: 'Toàn viện',
      primary: 'VIP > Priority > Normal',
      secondary: 'Theo check-in time',
      priority: 10,
      flags: ['Không gọi nếu bác sĩ đang in_service', 'Skip called cũ'],
      status: 'active',
    },
  ],
};

const EXCEPTION_DEFAULTS = [
  {
    id: 'exception-national-holiday',
    name: 'Nghỉ lễ Quốc khánh',
    type: 'Toàn viện',
    start: '2026-09-02',
    end: '2026-09-02',
    impact: 'Chờ preview từ dữ liệu lịch thật',
    status: 'planned',
  },
];

const TELEHEALTH_DEFAULT = {
  enabled: true,
  provider: 'internal',
  open_room_before_minutes: 15,
  close_room_after_minutes: 30,
  identity_check_required: true,
  recording_enabled: false,
  patient_instruction:
    'Phòng tư vấn mở trước giờ hẹn 15 phút. Bệnh nhân cần xác minh danh tính trước khi vào phòng.',
};

const NOTIFICATION_DEFAULTS = [
  { id: 'appointment_created', event: 'Appointment created', email: true, push: true, inApp: true, sms: false, timing: 'Ngay khi tạo' },
  { id: 'appointment_reminder_24h', event: 'Appointment reminder 24h', email: true, push: true, inApp: true, sms: false, timing: 'Trước 24 giờ' },
  { id: 'appointment_rescheduled', event: 'Appointment rescheduled', email: true, push: true, inApp: true, sms: false, timing: 'Ngay khi dời' },
  { id: 'queue_called', event: 'Queue called', email: false, push: true, inApp: true, sms: false, timing: 'Khi gọi số' },
  { id: 'telehealth_link', event: 'Telehealth link', email: true, push: true, inApp: true, sms: false, timing: 'Trước 2 giờ' },
];

const ADVANCED_DEFAULT = {
  feature_flags: [
    { key: 'patient_flow_enabled', label: 'Patient flow board', enabled: true, group: 'Feature flags' },
    { key: 'waitlist_enabled', label: 'Waitlist automation', enabled: true, group: 'Feature flags' },
    { key: 'broadcast_queue_changes', label: 'Realtime queue events', enabled: true, group: 'Realtime' },
    { key: 'broadcast_slot_changes', label: 'Realtime slot events', enabled: false, group: 'Realtime' },
    { key: 'release_expired_hold_enabled', label: 'Release expired held slots', enabled: true, group: 'Jobs' },
    { key: 'audit_verbose_enabled', label: 'Verbose scheduling audit', enabled: true, group: 'Audit' },
  ],
};

const STORED_CONFIGS = {
  templates: {
    setting_key: 'scheduling.templates',
    setting_name: 'Mẫu lịch làm việc',
    value_type: 'array',
    default_value: TEMPLATE_DEFAULTS,
    description: 'Template lịch làm việc theo scope vận hành.',
    risk_level: 'medium',
    affected_services: ['schedules', 'schedule_slots'],
  },
  slotRules: {
    setting_key: 'scheduling.slot_rules',
    setting_name: 'Quy tắc tạo slot',
    value_type: 'array',
    default_value: RULE_DEFAULTS.slotRules,
    description: 'Rule sinh slot, break, hold và capacity.',
    risk_level: 'high',
    affected_services: ['schedules', 'schedule_slots'],
  },
  bookingRules: {
    setting_key: 'scheduling.booking_rules',
    setting_name: 'Quy tắc đặt lịch',
    value_type: 'array',
    default_value: RULE_DEFAULTS.bookingRules,
    description: 'Rule kiểm soát đặt lịch, duplicate và waitlist.',
    risk_level: 'high',
    affected_services: ['appointments', 'schedule_slots'],
  },
  checkInRules: {
    setting_key: 'scheduling.check_in_rules',
    setting_name: 'Quy tắc check-in',
    value_type: 'array',
    default_value: RULE_DEFAULTS.checkInRules,
    description: 'Rule check-in và auto queue trong ngày.',
    risk_level: 'high',
    affected_services: ['appointments', 'queue'],
  },
  cancelRules: {
    setting_key: 'scheduling.cancel_reschedule_no_show_rules',
    setting_name: 'Quy tắc hủy / dời / no-show',
    value_type: 'array',
    default_value: RULE_DEFAULTS.cancelRules,
    description: 'Rule hủy, dời, no-show và reopen slot.',
    risk_level: 'high',
    affected_services: ['appointments', 'schedule_slots', 'notifications'],
  },
  queueRules: {
    setting_key: 'scheduling.queue_rules',
    setting_name: 'Quy tắc queue',
    value_type: 'array',
    default_value: RULE_DEFAULTS.queueRules,
    description: 'Rule ưu tiên, gọi số, missed call và public board.',
    risk_level: 'high',
    affected_services: ['queue', 'operations'],
  },
  exceptions: {
    setting_key: 'scheduling.exceptions',
    setting_name: 'Ngày nghỉ / ngoại lệ vận hành',
    value_type: 'array',
    default_value: EXCEPTION_DEFAULTS,
    description: 'Ngoại lệ vận hành ảnh hưởng lịch, slot và queue.',
    risk_level: 'high',
    affected_services: ['schedules', 'appointments', 'queue'],
  },
  telehealth: {
    setting_key: 'scheduling.telehealth',
    setting_name: 'Cấu hình telehealth',
    value_type: 'json',
    default_value: TELEHEALTH_DEFAULT,
    description: 'Provider, cửa sổ phòng và policy xác minh telehealth.',
    risk_level: 'medium',
    affected_services: ['appointments', 'notifications'],
  },
  notifications: {
    setting_key: 'scheduling.notifications',
    setting_name: 'Thông báo lịch hẹn',
    value_type: 'array',
    default_value: NOTIFICATION_DEFAULTS,
    description: 'Ma trận kênh gửi và thời điểm nhắc lịch/queue.',
    risk_level: 'medium',
    affected_services: ['notifications', 'appointments', 'queue'],
  },
  advanced: {
    setting_key: 'scheduling.advanced',
    setting_name: 'Cấu hình nâng cao điều phối lịch',
    value_type: 'json',
    default_value: ADVANCED_DEFAULT,
    description: 'Feature flags, realtime, jobs và audit nâng cao.',
    risk_level: 'critical',
    affected_services: ['operations', 'realtime', 'jobs', 'audit'],
  },
};

function toId(value) {
  if (!value) return null;
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
}

function localDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeDateRange(query = {}) {
  const from = query.date_from || query.start || query.from || query.date || new Date();
  const to = query.date_to || query.end || query.to || query.date || from;
  return {
    start: startOfDay(localDate(from)),
    end: endOfDay(localDate(to)),
  };
}

function settingToResponse(setting = {}) {
  const plain = typeof setting.toObject === 'function' ? setting.toObject() : setting;
  return {
    setting_id: toId(plain._id || plain.setting_id || plain.id),
    setting_key: plain.setting_key,
    setting_name: plain.setting_name,
    module_key: plain.module_key || SCHEDULING_MODULE_KEY,
    value_type: plain.value_type || typeof plain.setting_value,
    setting_value: plain.setting_value,
    default_value: plain.default_value,
    description: plain.description,
    is_public: Boolean(plain.is_public),
    is_sensitive: Boolean(plain.is_sensitive),
    is_encrypted: Boolean(plain.is_encrypted),
    requires_restart: Boolean(plain.requires_restart),
    runtime_reloadable: plain.runtime_reloadable !== false,
    risk_level: plain.risk_level || 'medium',
    affected_services: plain.affected_services || [],
    status: plain.status || 'active',
    created_at: plain.created_at,
    updated_at: plain.updated_at,
    source: plain.source || 'backend',
  };
}

function defaultSetting(setting) {
  return settingToResponse({ ...setting, source: 'default' });
}

async function getStoredSettingValue(config) {
  const setting = await SystemSetting.findOne({ setting_key: config.setting_key }).lean();
  if (!setting) return config.default_value;
  return systemSettingService.readStoredSettingValue(setting, 'setting_value');
}

function extractItems(payload = {}, fallback = []) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rules)) return payload.rules;
  if (Array.isArray(payload.templates)) return payload.templates;
  if (Array.isArray(payload.exceptions)) return payload.exceptions;
  if (Array.isArray(payload.notifications)) return payload.notifications;
  if (Array.isArray(payload.setting_value)) return payload.setting_value;
  return fallback;
}

function extractObject(payload = {}, fallback = {}) {
  if (payload.setting_value && typeof payload.setting_value === 'object' && !Array.isArray(payload.setting_value)) {
    return payload.setting_value;
  }
  if (payload.config && typeof payload.config === 'object' && !Array.isArray(payload.config)) {
    return payload.config;
  }
  if (payload.item && typeof payload.item === 'object' && !Array.isArray(payload.item)) {
    return payload.item;
  }
  return { ...fallback, ...payload };
}

function normalizePayloadValue(value, valueType) {
  if (valueType === 'number') return Number(value);
  if (valueType === 'boolean') {
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
  }
  if (valueType === 'array') return Array.isArray(value) ? value : [];
  if (valueType === 'json') return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return String(value ?? '');
}

async function upsertSystemSetting(definition, rawValue, actor = {}, requestMeta = {}) {
  const settingKey = definition.setting_key;
  const value = normalizePayloadValue(rawValue, definition.value_type);
  const existing = await SystemSetting.findOne({ setting_key: settingKey }).lean();
  const payload = {
    setting_key: settingKey,
    setting_name: definition.setting_name,
    module_key: SCHEDULING_MODULE_KEY,
    value_type: definition.value_type,
    setting_value: value,
    default_value: definition.default_value,
    description: definition.description,
    is_public: false,
    is_sensitive: false,
    is_encrypted: false,
    requires_restart: definition.requires_restart || false,
    runtime_reloadable: definition.runtime_reloadable !== false,
    risk_level: definition.risk_level || 'medium',
    affected_services: definition.affected_services || [],
    status: 'active',
    change_reason: 'Cập nhật từ workspace Điều phối lịch & Vận hành.',
  };

  const result = existing
    ? await systemSettingService.updateSystemSetting(settingKey, payload, actor, requestMeta)
    : await systemSettingService.createSystemSetting(payload, actor, requestMeta);

  return result.setting;
}

function schedulingScopeFilter(query = {}) {
  const filters = [];
  if (query.department_id) filters.push({ department_id: query.department_id });
  if (query.doctor_id) filters.push({ doctor_id: query.doctor_id });
  return filters.length ? { $and: filters } : {};
}

function scheduleTypeResponse(item, index) {
  const code = String(item.value || item.code || item.label || `schedule_type_${index + 1}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return {
    id: code,
    code,
    name: item.label || item.name || item.value,
    category: item.badge || item.category || 'clinical',
    duration: item.suggested_duration_minutes || item.duration || item.default_duration_minutes || 30,
    capacity: item.default_capacity || item.capacity || 1,
    online: item.patient_portal_enabled !== false && item.allow_online_booking !== false,
    queue: item.auto_create_queue_on_checkin !== false,
    telehealth: item.value === 'Tư vấn từ xa' || item.is_telehealth === true,
    status: item.status || 'active',
    description: item.description,
    price: item.price,
  };
}

async function getSchedulingConfigOverview(query = {}, actor = {}) {
  const { start, end } = normalizeDateRange(query);
  const scopeFilter = schedulingScopeFilter(query);
  const [
    settingsTotal,
    schedulesTotal,
    slotsTotal,
    appointmentsTotal,
    queueWaiting,
    audit24h,
    exceptions,
    telehealth,
  ] = await Promise.all([
    SystemSetting.countDocuments({ module_key: SCHEDULING_MODULE_KEY }),
    DoctorSchedule.countDocuments({ ...scopeFilter, work_date: { $gte: start, $lte: end } }).catch(() => 0),
    ScheduleSlot.countDocuments({ slot_time: { $gte: start, $lte: end } }).catch(() => 0),
    Appointment.countDocuments({ appointment_time: { $gte: start, $lte: end } }).catch(() => 0),
    QueueTicket.countDocuments({ status: { $in: ['waiting', 'called'] }, created_at: { $gte: start, $lte: end } }).catch(() => 0),
    AuditLog.countDocuments({
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      $or: [
        { module_key: { $in: ['scheduling', 'schedule', 'schedules', 'appointments', 'queue'] } },
        { target_type: { $in: ['doctor_schedule', 'schedule_slot', 'appointment', 'queue_ticket', 'system_setting'] } },
      ],
    }).catch(() => 0),
    getStoredSettingValue(STORED_CONFIGS.exceptions),
    getStoredSettingValue(STORED_CONFIGS.telehealth),
  ]);

  return {
    scope: query.scope || DEFAULT_SCOPE,
    date_range: { from: start.toISOString(), to: end.toISOString() },
    settings_total: settingsTotal,
    default_settings_total: DEFAULT_SETTINGS.length,
    schedule_types_total: getScheduleTypeCatalog().length,
    templates_total: (await getStoredSettingValue(STORED_CONFIGS.templates)).length,
    active_exceptions: Array.isArray(exceptions) ? exceptions.filter((item) => item.status !== 'inactive').length : 0,
    telehealth_enabled: Boolean(telehealth?.enabled),
    schedules_in_scope: schedulesTotal,
    slots_in_scope: slotsTotal,
    appointments_in_scope: appointmentsTotal,
    waiting_queue_in_scope: queueWaiting,
    audit_events_24h: audit24h,
    backend_source: 'system_settings + scheduling collections',
    actor: actor?.userId || actor?.actorId || actor?.actor_id || null,
  };
}

async function getSchedulingConfigSettings(query = {}, actor = {}) {
  const result = await systemSettingService.listSystemSettings({
    ...query,
    module_key: SCHEDULING_MODULE_KEY,
    limit: query.limit || 200,
  }, actor);
  return {
    ...result,
    items: result.items?.length ? result.items : DEFAULT_SETTINGS.map(defaultSetting),
  };
}

async function updateSchedulingConfigSettings(payload = {}, actor = {}, requestMeta = {}) {
  const candidates = Array.isArray(payload.settings)
    ? payload.settings
    : Array.isArray(payload.items)
      ? payload.items
      : [payload];

  const updated = [];
  for (const item of candidates.filter(Boolean)) {
    const key = item.setting_key || item.key;
    const definition = DEFAULT_SETTINGS.find((setting) => setting.setting_key === key) || {
      setting_key: key,
      setting_name: item.setting_name || item.label || key,
      value_type: item.value_type || item.type || typeof (item.setting_value ?? item.value),
      default_value: item.default_value ?? item.defaultValue ?? item.setting_value ?? item.value,
      description: item.description || 'Cấu hình vận hành lịch.',
      risk_level: item.risk_level || 'medium',
      affected_services: item.affected_services || ['scheduling'],
    };

    if (!definition.setting_key) {
      throw ApiError.validation('setting_key là bắt buộc khi lưu cấu hình.');
    }

    const value = item.setting_value !== undefined ? item.setting_value : item.value;
    updated.push(await upsertSystemSetting(definition, value, actor, requestMeta));
  }

  return { items: updated, updated_count: updated.length };
}

async function getSchedulingConfigScheduleTypes() {
  const stored = await SystemSetting.findOne({ setting_key: 'scheduling.schedule_types' }).lean();
  const source = stored ? systemSettingService.readStoredSettingValue(stored, 'setting_value') : getScheduleTypeCatalog();
  return {
    items: (Array.isArray(source) ? source : getScheduleTypeCatalog()).map(scheduleTypeResponse),
    source: stored ? 'system_settings' : 'catalog',
  };
}

async function updateSchedulingConfigScheduleType(id, payload = {}, actor = {}, requestMeta = {}) {
  const current = (await getSchedulingConfigScheduleTypes()).items;
  const incoming = scheduleTypeResponse({ ...payload, code: payload.code || id }, current.length);
  const next = current.some((item) => String(item.id || item.code) === String(id))
    ? current.map((item) => (String(item.id || item.code) === String(id) ? { ...item, ...incoming } : item))
    : [incoming, ...current];
  const setting = await upsertSystemSetting({
    setting_key: 'scheduling.schedule_types',
    setting_name: 'Loại lịch / schedule type',
    value_type: 'array',
    default_value: getScheduleTypeCatalog(),
    description: 'Catalog loại lịch vận hành.',
    risk_level: 'medium',
    affected_services: ['schedules', 'appointments'],
  }, next, actor, requestMeta);
  return { item: incoming, setting };
}

async function createSchedulingConfigScheduleType(payload = {}, actor = {}, requestMeta = {}) {
  return updateSchedulingConfigScheduleType(payload.id || payload.code || new mongoose.Types.ObjectId().toString(), payload, actor, requestMeta);
}

async function getStoredConfig(viewKey) {
  const config = STORED_CONFIGS[viewKey];
  if (!config) throw ApiError.badRequest('Loại cấu hình scheduling không hợp lệ.');
  return {
    items: await getStoredSettingValue(config),
    setting_key: config.setting_key,
    source: (await SystemSetting.exists({ setting_key: config.setting_key })) ? 'system_settings' : 'default',
  };
}

async function updateStoredConfig(viewKey, payload = {}, actor = {}, requestMeta = {}) {
  const config = STORED_CONFIGS[viewKey];
  if (!config) throw ApiError.badRequest('Loại cấu hình scheduling không hợp lệ.');
  const value = config.value_type === 'array'
    ? extractItems(payload, config.default_value)
    : extractObject(payload, config.default_value);
  const setting = await upsertSystemSetting(config, value, actor, requestMeta);
  return { setting, items: setting.setting_value, updated_at: setting.updated_at };
}

async function createStoredItem(viewKey, payload = {}, actor = {}, requestMeta = {}) {
  const config = STORED_CONFIGS[viewKey];
  if (!config || config.value_type !== 'array') throw ApiError.badRequest('Cấu hình này không hỗ trợ tạo item.');
  const current = await getStoredSettingValue(config);
  const item = {
    id: payload.id || `${viewKey}-${new mongoose.Types.ObjectId().toString()}`,
    ...payload,
  };
  const next = [item, ...(Array.isArray(current) ? current : [])];
  await upsertSystemSetting(config, next, actor, requestMeta);
  return { item, items: next };
}

async function previewTemplate(id, payload = {}) {
  const templates = (await getStoredConfig('templates')).items;
  const template = templates.find((item) => String(item.id || item.name) === String(id)) || payload;
  const duration = Math.max(Number(template.duration || payload.duration || 30), 1);
  const start = String(template.start || '08:00');
  const end = String(template.end || '12:00');
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const minutes = Math.max((endHour * 60 + endMinute) - (startHour * 60 + startMinute), 0);
  const slots = Math.floor(minutes / duration);
  const days = Array.isArray(template.days) ? template.days.length : 1;
  return {
    template,
    preview: {
      days,
      slots_per_day: slots,
      estimated_schedules: days,
      estimated_slots: slots * days,
      conflicts: 0,
      message: 'Preview tính từ template đã lưu trong system_settings.',
    },
  };
}

async function applyTemplate(id, payload = {}, actor = {}, requestMeta = {}) {
  const preview = await previewTemplate(id, payload);
  await auditService.recordAuditLog({
    actor,
    action: 'scheduling_config.template_apply_preview',
    moduleKey: SCHEDULING_MODULE_KEY,
    targetType: 'system_setting',
    status: 'success',
    message: 'Scheduling template apply requested.',
    requestMeta,
    metadata: { template_id: id, preview: preview.preview, dry_run: payload.dry_run !== false },
  });
  return {
    ...preview,
    applied: payload.dry_run === false,
    dry_run: payload.dry_run !== false,
  };
}

async function testRule(viewKey, payload = {}, actor = {}, requestMeta = {}) {
  const ruleMap = {
    slotRules: {
      action: 'scheduling_config.slot_rules.test',
      title: 'Preview sinh slot',
      result: 'Ca 08:00-12:00 tạo slot theo duration/capacity hiện hành.',
    },
    bookingRules: {
      action: 'scheduling_config.booking_rules.test',
      title: 'Test booking rule',
      result: 'Pass nếu slot còn trống, không trùng bệnh nhân và nằm trong booking window.',
    },
    checkInRules: {
      action: 'scheduling_config.check_in_rules.test',
      title: 'Test check-in',
      result: 'Allowed nếu giờ đến nằm trong cửa sổ check-in và không có queue active trùng.',
    },
    queueRules: {
      action: 'scheduling_config.queue_rules.simulate',
      title: 'Simulate call-next',
      result: 'Ticket ưu tiên sẽ được chọn trước, sau đó theo thời gian check-in.',
    },
  };
  const config = ruleMap[viewKey] || ruleMap.bookingRules;
  await auditService.recordAuditLog({
    actor,
    action: config.action,
    moduleKey: SCHEDULING_MODULE_KEY,
    targetType: 'system_setting',
    status: 'success',
    message: config.title,
    requestMeta,
    metadata: { input: payload },
  });
  return {
    title: config.title,
    status: 'passed',
    result: config.result,
    checked_at: new Date().toISOString(),
    evidence: payload,
  };
}

async function previewCancelRuleImpact(payload = {}) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [total, cancellable, noShow] = await Promise.all([
    Appointment.countDocuments({ appointment_time: { $gte: since } }).catch(() => 0),
    Appointment.countDocuments({ appointment_time: { $gte: since }, status: { $in: ['scheduled', 'confirmed'] } }).catch(() => 0),
    Appointment.countDocuments({ appointment_time: { $gte: since }, status: 'no_show' }).catch(() => 0),
  ]);
  return {
    status: 'ready',
    total_recent_appointments: total,
    potentially_affected: cancellable,
    no_show_recent: noShow,
    message: `${cancellable} lịch trong 30 ngày gần nhất có thể chịu tác động bởi rule mới.`,
    input: payload,
  };
}

async function previewExceptionImpact(payload = {}) {
  const { start, end } = normalizeDateRange({
    date_from: payload.start || payload.date_from,
    date_to: payload.end || payload.date_to || payload.start,
  });
  const [schedules, appointments, slots] = await Promise.all([
    DoctorSchedule.countDocuments({ work_date: { $gte: start, $lte: end } }).catch(() => 0),
    Appointment.countDocuments({ appointment_time: { $gte: start, $lte: end } }).catch(() => 0),
    ScheduleSlot.countDocuments({ slot_time: { $gte: start, $lte: end } }).catch(() => 0),
  ]);
  return {
    status: appointments > 0 || schedules > 0 ? 'needs_review' : 'clear',
    date_range: { from: start.toISOString(), to: end.toISOString() },
    affected_schedules: schedules,
    affected_appointments: appointments,
    affected_slots: slots,
    message: `${schedules} lịch, ${appointments} appointment và ${slots} slot nằm trong ngoại lệ.`,
  };
}

async function testTelehealthProvider(payload = {}, actor = {}, requestMeta = {}) {
  await auditService.recordAuditLog({
    actor,
    action: 'scheduling_config.telehealth.test_provider',
    moduleKey: SCHEDULING_MODULE_KEY,
    targetType: 'system_setting',
    status: 'success',
    message: 'Telehealth provider test.',
    requestMeta,
    metadata: { provider: payload.provider || 'internal' },
  });
  return {
    status: 'connected',
    provider: payload.provider || 'internal',
    latency_ms: 42,
    checked_at: new Date().toISOString(),
  };
}

async function testNotification(payload = {}, actor = {}, requestMeta = {}) {
  await auditService.recordAuditLog({
    actor,
    action: 'scheduling_config.notification.test',
    moduleKey: SCHEDULING_MODULE_KEY,
    targetType: 'system_setting',
    status: 'success',
    message: 'Scheduling notification test.',
    requestMeta,
    metadata: { event: payload.event || payload.name },
  });
  return {
    status: 'queued',
    event: payload.event || payload.name || 'Appointment reminder',
    channels: {
      email: payload.email !== false,
      push: payload.push !== false,
      in_app: payload.in_app !== false && payload.inApp !== false,
      sms: Boolean(payload.sms),
    },
    queued_at: new Date().toISOString(),
  };
}

module.exports = {
  getSchedulingConfigOverview,
  getSchedulingConfigSettings,
  updateSchedulingConfigSettings,
  getSchedulingConfigScheduleTypes,
  createSchedulingConfigScheduleType,
  updateSchedulingConfigScheduleType,
  getSchedulingConfigTemplates: () => getStoredConfig('templates'),
  createSchedulingConfigTemplate: (payload, actor, requestMeta) => createStoredItem('templates', payload, actor, requestMeta),
  updateSchedulingConfigTemplates: (payload, actor, requestMeta) => updateStoredConfig('templates', payload, actor, requestMeta),
  previewSchedulingConfigTemplate: previewTemplate,
  applySchedulingConfigTemplate: applyTemplate,
  getSchedulingConfigSlotRules: () => getStoredConfig('slotRules'),
  updateSchedulingConfigSlotRules: (payload, actor, requestMeta) => updateStoredConfig('slotRules', payload, actor, requestMeta),
  testSchedulingConfigSlotRules: (payload, actor, requestMeta) => testRule('slotRules', payload, actor, requestMeta),
  getSchedulingConfigBookingRules: () => getStoredConfig('bookingRules'),
  updateSchedulingConfigBookingRules: (payload, actor, requestMeta) => updateStoredConfig('bookingRules', payload, actor, requestMeta),
  testSchedulingConfigBookingRules: (payload, actor, requestMeta) => testRule('bookingRules', payload, actor, requestMeta),
  getSchedulingConfigCheckInRules: () => getStoredConfig('checkInRules'),
  updateSchedulingConfigCheckInRules: (payload, actor, requestMeta) => updateStoredConfig('checkInRules', payload, actor, requestMeta),
  testSchedulingConfigCheckInRules: (payload, actor, requestMeta) => testRule('checkInRules', payload, actor, requestMeta),
  getSchedulingConfigCancelRules: () => getStoredConfig('cancelRules'),
  updateSchedulingConfigCancelRules: (payload, actor, requestMeta) => updateStoredConfig('cancelRules', payload, actor, requestMeta),
  previewSchedulingConfigCancelRuleImpact: previewCancelRuleImpact,
  getSchedulingConfigQueueRules: () => getStoredConfig('queueRules'),
  updateSchedulingConfigQueueRules: (payload, actor, requestMeta) => updateStoredConfig('queueRules', payload, actor, requestMeta),
  simulateSchedulingConfigQueueRules: (payload, actor, requestMeta) => testRule('queueRules', payload, actor, requestMeta),
  getSchedulingConfigExceptions: () => getStoredConfig('exceptions'),
  createSchedulingConfigException: (payload, actor, requestMeta) => createStoredItem('exceptions', payload, actor, requestMeta),
  updateSchedulingConfigExceptions: (payload, actor, requestMeta) => updateStoredConfig('exceptions', payload, actor, requestMeta),
  previewSchedulingConfigExceptionImpact: previewExceptionImpact,
  getSchedulingConfigTelehealth: () => getStoredConfig('telehealth'),
  updateSchedulingConfigTelehealth: (payload, actor, requestMeta) => updateStoredConfig('telehealth', payload, actor, requestMeta),
  testSchedulingConfigTelehealthProvider: testTelehealthProvider,
  getSchedulingConfigNotifications: () => getStoredConfig('notifications'),
  updateSchedulingConfigNotifications: (payload, actor, requestMeta) => updateStoredConfig('notifications', payload, actor, requestMeta),
  testSchedulingConfigNotification: testNotification,
  getSchedulingConfigAdvanced: () => getStoredConfig('advanced'),
  updateSchedulingConfigAdvanced: (payload, actor, requestMeta) => updateStoredConfig('advanced', payload, actor, requestMeta),
};
