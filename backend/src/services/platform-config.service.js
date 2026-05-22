const crypto = require('crypto');
const mongoose = require('mongoose');
const ApiError = require('../common/errors/api-error');
const env = require('../config/env');
const { SYSTEM_SETTING_STATUS, SYSTEM_SETTING_VALUE_TYPE } = require('../constants/statuses');
const {
  AuditLog,
  AuthSession,
  Notification,
  NotificationDelivery,
  PaymentIntent,
  QrToken,
  SupportTicket,
  SystemSetting,
} = require('../models');
const paymentProviderRegistry = require('../payments/payment-provider.registry');
const presenceService = require('../realtime/presence.service');
const realtimeService = require('../realtime/realtime.service');
const systemSettingService = require('./admin/system-setting.service');

let lastReloadAt = null;

const MODULES = [
  {
    module_key: 'general',
    route_key: 'general',
    title: 'Cau hinh chung',
    subtitle: 'App identity, runtime, CORS, request body va bootstrap.',
    icon: 'settings',
    risk_level: 'medium',
    affected_services: ['api', 'web'],
  },
  {
    module_key: 'features',
    route_key: 'feature-flags',
    title: 'Feature flags',
    subtitle: 'Cong tac bat/tat tinh nang theo module van hanh.',
    icon: 'sparkles',
    risk_level: 'high',
    affected_services: ['api', 'web', 'workers'],
  },
  {
    module_key: 'login',
    route_key: 'login',
    title: 'Cau hinh dang nhap',
    subtitle: 'Token TTL, session, password reset va login policy.',
    icon: 'key',
    risk_level: 'high',
    affected_services: ['api', 'auth'],
  },
  {
    module_key: 'security',
    route_key: 'security',
    title: 'Cau hinh bao mat',
    subtitle: 'JWT, rate limit, break-glass va sensitive access.',
    icon: 'shield',
    risk_level: 'critical',
    affected_services: ['api', 'auth', 'audit'],
  },
  {
    module_key: 'google_oauth',
    route_key: 'google-oauth',
    title: 'Cau hinh Google OAuth',
    subtitle: 'Client, callback, redirect va audit dang nhap OAuth.',
    icon: 'globe',
    risk_level: 'high',
    affected_services: ['api', 'auth', 'web'],
  },
  {
    module_key: 'notifications',
    route_key: 'notifications',
    title: 'Cau hinh thong bao',
    subtitle: 'Kenh delivery, retry, template va failed console.',
    icon: 'bell',
    risk_level: 'medium',
    affected_services: ['api', 'workers', 'realtime'],
  },
  {
    module_key: 'email_smtp',
    route_key: 'email-smtp',
    title: 'Cau hinh email / SMTP',
    subtitle: 'SMTP provider, sender, password rotation va test email.',
    icon: 'mail',
    risk_level: 'high',
    affected_services: ['api', 'notification-worker'],
  },
  {
    module_key: 'push_notification',
    route_key: 'push-notification',
    title: 'Cau hinh push notification',
    subtitle: 'HTTP/Firebase provider, token, TTL va payload validator.',
    icon: 'smartphone',
    risk_level: 'medium',
    affected_services: ['api', 'notification-worker'],
  },
  {
    module_key: 'realtime',
    route_key: 'realtime',
    title: 'Cau hinh realtime',
    subtitle: 'Socket server, Redis adapter, rooms va event rate limit.',
    icon: 'radio',
    risk_level: 'high',
    affected_services: ['api', 'socket', 'redis'],
  },
  {
    module_key: 'file_upload',
    route_key: 'file-upload',
    title: 'Cau hinh file / upload',
    subtitle: 'Upload size, MIME policy, scan queue va quarantine.',
    icon: 'upload',
    risk_level: 'high',
    affected_services: ['api', 'storage', 'portal'],
  },
  {
    module_key: 'qr_token',
    route_key: 'qr-token',
    title: 'Cau hinh QR token',
    subtitle: 'TTL, type policy, verify/consume/revoke va console.',
    icon: 'scan',
    risk_level: 'high',
    affected_services: ['api', 'portal', 'billing'],
  },
  {
    module_key: 'payments',
    route_key: 'payments',
    title: 'Cau hinh thanh toan',
    subtitle: 'Manual, Bank QR, MoMo QR, receipt va reconciliation.',
    icon: 'banknote',
    risk_level: 'critical',
    affected_services: ['api', 'billing', 'portal'],
  },
  {
    module_key: 'patient_portal',
    route_key: 'patient-portal',
    title: 'Cau hinh patient portal',
    subtitle: 'Portal feature, document, profile change va relative policy.',
    icon: 'heart',
    risk_level: 'high',
    affected_services: ['api', 'portal', 'records'],
  },
  {
    module_key: 'support_sla',
    route_key: 'support-sla',
    title: 'Cau hinh support SLA',
    subtitle: 'SLA priority, routing, warning va escalation.',
    icon: 'ticket',
    risk_level: 'medium',
    affected_services: ['api', 'support', 'notifications'],
  },
  {
    module_key: 'audit_retention',
    route_key: 'audit-retention',
    title: 'Cau hinh audit retention',
    subtitle: 'Retention, export policy, cleanup preview va archive.',
    icon: 'archive',
    risk_level: 'critical',
    affected_services: ['api', 'audit', 'compliance'],
  },
];

const defs = [];

function setting(definition) {
  defs.push({
    runtime_reloadable: true,
    requires_restart: false,
    risk_level: 'medium',
    affected_services: [],
    is_public: false,
    is_sensitive: false,
    is_encrypted: false,
    status: SYSTEM_SETTING_STATUS.ACTIVE,
    ...definition,
  });
}

setting({
  setting_key: 'general.app_name',
  setting_name: 'Ten ung dung',
  module_key: 'general',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: 'Aura Lumina Medical Center',
  description: 'Ten hien thi tren control plane va portal.',
  is_public: true,
  risk_level: 'low',
  affected_services: ['web', 'portal'],
});
setting({
  setting_key: 'general.app_short_name',
  setting_name: 'Ten ngan',
  module_key: 'general',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: 'AuraCare',
  is_public: true,
  risk_level: 'low',
  affected_services: ['web'],
});
setting({
  setting_key: 'general.app_base_url',
  setting_name: 'Frontend base URL',
  module_key: 'general',
  env_key: 'APP_BASE_URL',
  env_prop: 'appBaseUrl',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: 'http://localhost:5173',
  requires_restart: true,
  runtime_reloadable: false,
  affected_services: ['api', 'web'],
});
setting({
  setting_key: 'general.api_base_url',
  setting_name: 'API base URL',
  module_key: 'general',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: 'http://localhost:3000/api',
  affected_services: ['web'],
});
setting({
  setting_key: 'general.default_timezone',
  setting_name: 'Mui gio mac dinh',
  module_key: 'general',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: 'Asia/Ho_Chi_Minh',
  is_public: true,
  risk_level: 'low',
});
setting({
  setting_key: 'general.default_language',
  setting_name: 'Ngon ngu mac dinh',
  module_key: 'general',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: 'vi',
  is_public: true,
  risk_level: 'low',
});
setting({
  setting_key: 'general.support_email',
  setting_name: 'Email ho tro',
  module_key: 'general',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: 'support@auralumina.vn',
  is_public: true,
  affected_services: ['web', 'portal'],
});
setting({
  setting_key: 'general.cors_origins',
  setting_name: 'CORS origins',
  module_key: 'general',
  env_key: 'CORS_ORIGINS',
  env_prop: 'corsOrigins',
  value_type: SYSTEM_SETTING_VALUE_TYPE.ARRAY,
  default_value: [],
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'high',
  affected_services: ['api'],
});
setting({
  setting_key: 'general.request_body_limit',
  setting_name: 'Request body limit',
  module_key: 'general',
  env_key: 'REQUEST_BODY_LIMIT',
  env_prop: 'requestBodyLimit',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: '1mb',
  requires_restart: true,
  runtime_reloadable: false,
  affected_services: ['api'],
});
setting({
  setting_key: 'general.logo_url',
  setting_name: 'Logo URL',
  module_key: 'general',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: '',
  is_public: true,
  risk_level: 'low',
});

[
  ['features.enable_online_payment', 'Bat thanh toan online', 'billing', true, 'critical', ['billing', 'portal']],
  ['features.enable_patient_chat', 'Bat chat benh nhan', 'portal', true, 'medium', ['portal', 'messaging', 'realtime']],
  ['features.enable_emergency_sos', 'Bat nut SOS khan cap', 'emergency', true, 'critical', ['portal', 'emergency', 'notifications']],
  ['features.enable_voice_call_recording', 'Ghi am cuoc goi', 'messaging', false, 'high', ['messaging', 'storage']],
].forEach(([settingKey, name, domain, defaultValue, riskLevel, services]) => setting({
  setting_key: settingKey,
  setting_name: name,
  module_key: 'features',
  value_type: SYSTEM_SETTING_VALUE_TYPE.BOOLEAN,
  default_value: defaultValue,
  description: `Feature flag cho ${domain}.`,
  risk_level: riskLevel,
  affected_services: services,
}));

setting({
  setting_key: 'login.staff_login_enabled',
  setting_name: 'Staff login enabled',
  module_key: 'login',
  value_type: SYSTEM_SETTING_VALUE_TYPE.BOOLEAN,
  default_value: true,
  risk_level: 'critical',
  affected_services: ['auth', 'admin'],
});
setting({
  setting_key: 'login.patient_login_enabled',
  setting_name: 'Patient login enabled',
  module_key: 'login',
  value_type: SYSTEM_SETTING_VALUE_TYPE.BOOLEAN,
  default_value: true,
  risk_level: 'high',
  affected_services: ['auth', 'portal'],
});
setting({
  setting_key: 'login.patient_register_enabled',
  setting_name: 'Patient register enabled',
  module_key: 'login',
  value_type: SYSTEM_SETTING_VALUE_TYPE.BOOLEAN,
  default_value: true,
  risk_level: 'medium',
  affected_services: ['auth', 'portal'],
});
setting({
  setting_key: 'login.access_token_ttl',
  setting_name: 'Access token TTL',
  module_key: 'login',
  env_key: 'JWT_ACCESS_EXPIRES_IN',
  env_prop: 'jwtAccessExpiresIn',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: '15m',
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'high',
  affected_services: ['auth', 'api'],
});
setting({
  setting_key: 'login.refresh_token_ttl',
  setting_name: 'Refresh token TTL',
  module_key: 'login',
  env_key: 'JWT_REFRESH_EXPIRES_IN',
  env_prop: 'jwtRefreshExpiresIn',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: '7d',
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'high',
  affected_services: ['auth', 'api'],
});
setting({
  setting_key: 'login.password_reset_ttl_minutes',
  setting_name: 'Password reset TTL',
  module_key: 'login',
  env_key: 'PASSWORD_RESET_EXPIRES_IN_MINUTES',
  env_prop: 'passwordResetExpiresInMinutes',
  value_type: SYSTEM_SETTING_VALUE_TYPE.NUMBER,
  default_value: 15,
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'high',
  affected_services: ['auth'],
});
setting({
  setting_key: 'login.expose_reset_secrets',
  setting_name: 'Expose reset secrets',
  module_key: 'login',
  env_key: 'AUTH_EXPOSE_RESET_SECRETS',
  env_prop: 'exposeResetSecrets',
  value_type: SYSTEM_SETTING_VALUE_TYPE.BOOLEAN,
  default_value: false,
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'critical',
  affected_services: ['auth'],
});
setting({
  setting_key: 'login.password_policy',
  setting_name: 'Password policy',
  module_key: 'login',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_number: true,
    require_symbol: true,
    failed_login_threshold: 5,
    lock_duration_minutes: 15,
  },
  risk_level: 'high',
  affected_services: ['auth'],
});

setting({
  setting_key: 'security.jwt_issuer',
  setting_name: 'JWT issuer',
  module_key: 'security',
  env_key: 'JWT_ISSUER',
  env_prop: 'jwtIssuer',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: '',
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'high',
  affected_services: ['auth'],
});
setting({
  setting_key: 'security.jwt_audience',
  setting_name: 'JWT audience',
  module_key: 'security',
  env_key: 'JWT_AUDIENCE',
  env_prop: 'jwtAudience',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: '',
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'high',
  affected_services: ['auth'],
});
setting({
  setting_key: 'security.jwt_access_secret',
  setting_name: 'JWT access secret',
  module_key: 'security',
  env_key: 'JWT_ACCESS_SECRET',
  env_prop: 'jwtAccessSecret',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: '',
  is_sensitive: true,
  is_encrypted: true,
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'critical',
  affected_services: ['auth', 'api'],
});
setting({
  setting_key: 'security.jwt_refresh_secret',
  setting_name: 'JWT refresh secret',
  module_key: 'security',
  env_key: 'JWT_REFRESH_SECRET',
  env_prop: 'jwtRefreshSecret',
  value_type: SYSTEM_SETTING_VALUE_TYPE.STRING,
  default_value: '',
  is_sensitive: true,
  is_encrypted: true,
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: 'critical',
  affected_services: ['auth', 'api'],
});
setting({
  setting_key: 'security.qr_expiry_minutes',
  setting_name: 'QR expiry minutes',
  module_key: 'security',
  value_type: SYSTEM_SETTING_VALUE_TYPE.NUMBER,
  default_value: 10,
  risk_level: 'high',
  affected_services: ['api', 'qr'],
});
setting({
  setting_key: 'access.break_glass_duration_minutes',
  setting_name: 'Break-glass duration minutes',
  module_key: 'security',
  value_type: SYSTEM_SETTING_VALUE_TYPE.NUMBER,
  default_value: 60,
  risk_level: 'critical',
  affected_services: ['access', 'audit'],
});
setting({
  setting_key: 'security.rate_limit_policy',
  setting_name: 'Rate limit policy',
  module_key: 'security',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    staff_login: { limit: 5, window_minutes: 15 },
    patient_login: { limit: 5, window_minutes: 15 },
    forgot_password: { limit: 3, window_minutes: 60 },
    socket_room_subscribe: { limit: 20, window_seconds: 60 },
  },
  risk_level: 'high',
  affected_services: ['auth', 'socket'],
});

[
  ['google_oauth.enabled', 'Google OAuth enabled', 'GOOGLE_AUTH_ENABLED', 'googleAuthEnabled', 'boolean', false, false],
  ['google_oauth.client_id', 'Google client ID', 'GOOGLE_CLIENT_ID', 'googleClientId', 'string', '', false],
  ['google_oauth.client_secret', 'Google client secret', 'GOOGLE_CLIENT_SECRET', 'googleClientSecret', 'string', '', true],
  ['google_oauth.callback_url', 'Google callback URL', 'GOOGLE_CALLBACK_URL', 'googleCallbackUrl', 'string', 'http://localhost:3000/api/auth/google/callback', false],
  ['google_oauth.success_url', 'Frontend success URL', 'FRONTEND_AUTH_SUCCESS_URL', 'frontendAuthSuccessUrl', 'string', 'http://localhost:5173/auth/success', false],
  ['google_oauth.failure_url', 'Frontend failure URL', 'FRONTEND_AUTH_FAILURE_URL', 'frontendAuthFailureUrl', 'string', 'http://localhost:5173/auth/failure', false],
].forEach(([settingKey, name, envKey, envProp, valueType, defaultValue, sensitive]) => setting({
  setting_key: settingKey,
  setting_name: name,
  module_key: 'google_oauth',
  env_key: envKey,
  env_prop: envProp,
  value_type: valueType,
  default_value: defaultValue,
  is_sensitive: Boolean(sensitive),
  is_encrypted: Boolean(sensitive),
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: sensitive ? 'critical' : 'high',
  affected_services: ['auth', 'api', 'web'],
}));
setting({
  setting_key: 'google_oauth.policy',
  setting_name: 'OAuth login policy',
  module_key: 'google_oauth',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    allow_patient_login: true,
    allow_staff_login: true,
    auto_link_by_email: true,
    require_verified_email: true,
    allowed_hosted_domains: [],
  },
  risk_level: 'high',
  affected_services: ['auth'],
});

setting({
  setting_key: 'notifications.delivery_policy',
  setting_name: 'Notification delivery policy',
  module_key: 'notifications',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    in_app_enabled: true,
    realtime_enabled: true,
    email_enabled: true,
    push_enabled: false,
    max_attempts: 3,
    retry_backoff_seconds: [60, 300, 900],
    batch_size: 50,
  },
  risk_level: 'medium',
  affected_services: ['notifications', 'workers'],
});
setting({
  setting_key: 'notifications.channel_matrix',
  setting_name: 'Notification channel matrix',
  module_key: 'notifications',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    'payment_intent.paid': { in_app: true, realtime: true, email: false, push: false, priority: 'high' },
    'support_ticket.created': { in_app: true, realtime: true, email: true, push: true, priority: 'normal' },
    'emergency.created': { in_app: true, realtime: true, email: true, push: true, priority: 'urgent' },
    'appointment.reminder': { in_app: true, realtime: false, email: true, push: true, priority: 'normal' },
  },
  risk_level: 'medium',
  affected_services: ['notifications'],
});

[
  ['email_smtp.enabled', 'SMTP enabled', 'SMTP_ENABLED', 'smtpEnabled', 'boolean', false, false],
  ['email_smtp.host', 'SMTP host', 'SMTP_HOST', 'smtpHost', 'string', '', false],
  ['email_smtp.port', 'SMTP port', 'SMTP_PORT', 'smtpPort', 'number', 587, false],
  ['email_smtp.secure', 'SMTP secure', 'SMTP_SECURE', 'smtpSecure', 'boolean', false, false],
  ['email_smtp.username', 'SMTP username', 'SMTP_USER', 'smtpUser', 'string', '', false],
  ['email_smtp.password', 'SMTP password', 'SMTP_PASS', 'smtpPass', 'string', '', true],
  ['email_smtp.from_name', 'From name', 'SMTP_FROM_NAME', 'smtpFromName', 'string', 'MedCare Portal', false],
  ['email_smtp.from_email', 'From email', 'SMTP_FROM_EMAIL', 'smtpFromEmail', 'string', '', false],
  ['email_smtp.reply_to', 'Reply-to', 'SMTP_REPLY_TO', 'smtpReplyTo', 'string', '', false],
].forEach(([settingKey, name, envKey, envProp, valueType, defaultValue, sensitive]) => setting({
  setting_key: settingKey,
  setting_name: name,
  module_key: 'email_smtp',
  env_key: envKey,
  env_prop: envProp,
  value_type: valueType,
  default_value: defaultValue,
  is_sensitive: Boolean(sensitive),
  is_encrypted: Boolean(sensitive),
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: sensitive ? 'critical' : 'high',
  affected_services: ['api', 'notification-worker'],
}));
setting({
  setting_key: 'email_smtp.pool_policy',
  setting_name: 'SMTP pool policy',
  module_key: 'email_smtp',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    connection_timeout_ms: 10000,
    pool_enabled: false,
    max_connections: 3,
    max_messages_per_connection: 100,
  },
  risk_level: 'medium',
  affected_services: ['notification-worker'],
});

[
  ['push_notification.provider_url', 'Push provider URL', 'PUSH_PROVIDER_URL', 'pushProviderUrl', 'string', '', false],
  ['push_notification.provider_token', 'Push provider token', 'PUSH_PROVIDER_TOKEN', 'pushProviderToken', 'string', '', true],
].forEach(([settingKey, name, envKey, envProp, valueType, defaultValue, sensitive]) => setting({
  setting_key: settingKey,
  setting_name: name,
  module_key: 'push_notification',
  env_key: envKey,
  env_prop: envProp,
  value_type: valueType,
  default_value: defaultValue,
  is_sensitive: Boolean(sensitive),
  is_encrypted: Boolean(sensitive),
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: sensitive ? 'critical' : 'medium',
  affected_services: ['notification-worker'],
}));
setting({
  setting_key: 'push_notification.policy',
  setting_name: 'Push policy',
  module_key: 'push_notification',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    enabled: false,
    provider_type: 'http',
    default_ttl_seconds: 3600,
    default_click_action: '/portal/notifications',
    dry_run: true,
  },
  risk_level: 'medium',
  affected_services: ['notification-worker', 'portal'],
});

[
  ['realtime.redis_url', 'Redis URL', 'REDIS_URL', 'redisUrl', 'string', '', true],
  ['realtime.redis_enabled', 'Realtime Redis enabled', 'REALTIME_REDIS_ENABLED', 'realtimeRedisEnabled', 'boolean', false, false],
].forEach(([settingKey, name, envKey, envProp, valueType, defaultValue, sensitive]) => setting({
  setting_key: settingKey,
  setting_name: name,
  module_key: 'realtime',
  env_key: envKey,
  env_prop: envProp,
  value_type: valueType,
  default_value: defaultValue,
  is_sensitive: Boolean(sensitive),
  is_encrypted: Boolean(sensitive),
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: sensitive ? 'critical' : 'high',
  affected_services: ['socket', 'redis'],
}));
setting({
  setting_key: 'realtime.socket_policy',
  setting_name: 'Socket policy',
  module_key: 'realtime',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    max_payload_bytes: 4096,
    max_subscribe_rooms_per_event: 25,
    event_limits: {
      'room.subscribe': { limit: 20, window_seconds: 60, max_bytes: 4096 },
      'room.unsubscribe': { limit: 30, window_seconds: 60, max_bytes: 4096 },
      'presence.ping': { limit: 30, window_seconds: 60, max_bytes: 512 },
      'typing.started': { limit: 20, window_seconds: 10, max_bytes: 1024 },
      'typing.stopped': { limit: 20, window_seconds: 10, max_bytes: 1024 },
    },
  },
  risk_level: 'high',
  affected_services: ['socket'],
});

setting({
  setting_key: 'files.max_upload_size_bytes',
  setting_name: 'Max upload size bytes',
  module_key: 'file_upload',
  value_type: SYSTEM_SETTING_VALUE_TYPE.NUMBER,
  default_value: 10 * 1024 * 1024,
  risk_level: 'high',
  affected_services: ['api', 'storage'],
});
setting({
  setting_key: 'messaging.attachment_allowed_types',
  setting_name: 'Attachment allowed MIME types',
  module_key: 'file_upload',
  value_type: SYSTEM_SETTING_VALUE_TYPE.ARRAY,
  default_value: ['image/jpeg', 'image/png', 'application/pdf'],
  risk_level: 'medium',
  affected_services: ['messaging', 'storage'],
});
setting({
  setting_key: 'file_upload.receipt_upload_enabled',
  setting_name: 'Receipt upload enabled',
  module_key: 'file_upload',
  env_key: 'PAYMENT_RECEIPT_UPLOAD_ENABLED',
  env_prop: 'paymentReceiptUploadEnabled',
  value_type: SYSTEM_SETTING_VALUE_TYPE.BOOLEAN,
  default_value: true,
  risk_level: 'high',
  affected_services: ['billing', 'portal'],
});
setting({
  setting_key: 'file_upload.receipt_max_size_bytes',
  setting_name: 'Receipt max size bytes',
  module_key: 'file_upload',
  env_key: 'PAYMENT_RECEIPT_MAX_SIZE_BYTES',
  env_prop: 'paymentReceiptMaxSizeBytes',
  value_type: SYSTEM_SETTING_VALUE_TYPE.NUMBER,
  default_value: 5 * 1024 * 1024,
  risk_level: 'high',
  affected_services: ['billing', 'portal'],
});
setting({
  setting_key: 'file_upload.policy_matrix',
  setting_name: 'Upload policy matrix',
  module_key: 'file_upload',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    patient_portal_document: { enabled: true, max_size_mb: 10, types: ['application/pdf', 'image/jpeg', 'image/png'], scan_required: true, release_rule: 'clean_only' },
    payment_receipt: { enabled: true, max_size_mb: 5, types: ['application/pdf', 'image/jpeg', 'image/png'], scan_required: true, release_rule: 'manual_review' },
    clinical_result_file: { enabled: true, max_size_mb: 20, types: ['application/pdf', 'image/jpeg', 'image/png'], scan_required: true, release_rule: 'clean_only' },
    message_attachment: { enabled: true, max_size_mb: 10, types: ['application/pdf', 'image/jpeg', 'image/png'], scan_required: false, release_rule: 'clean_or_skipped' },
  },
  risk_level: 'high',
  affected_services: ['storage', 'portal', 'messaging'],
});

setting({
  setting_key: 'qr_token.default_expiry_minutes',
  setting_name: 'Default QR expiry minutes',
  module_key: 'qr_token',
  value_type: SYSTEM_SETTING_VALUE_TYPE.NUMBER,
  default_value: 10,
  risk_level: 'high',
  affected_services: ['qr', 'billing', 'portal'],
});
setting({
  setting_key: 'qr_token.policy_matrix',
  setting_name: 'QR policy matrix',
  module_key: 'qr_token',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    payment: { ttl_minutes: 30, one_time: true, auth_required: false, revoke_allowed: true, status: 'active' },
    appointment_checkin: { ttl_minutes: 10, one_time: true, auth_required: false, revoke_allowed: true, status: 'active' },
    queue_ticket: { ttl_minutes: 10, one_time: true, auth_required: false, revoke_allowed: true, status: 'active' },
    prescription_verify: { ttl_minutes: 1440, one_time: false, auth_required: false, revoke_allowed: true, status: 'active' },
    lab_result_verify: { ttl_minutes: 1440, one_time: false, auth_required: false, revoke_allowed: true, status: 'active' },
    receipt_verify: { ttl_minutes: 1440, one_time: false, auth_required: false, revoke_allowed: true, status: 'active' },
    patient_card: { ttl_minutes: 43200, one_time: false, auth_required: 'optional', revoke_allowed: true, status: 'active' },
  },
  risk_level: 'high',
  affected_services: ['qr'],
});

[
  ['payments.manual_payment_enabled', 'Manual payment enabled', 'MANUAL_PAYMENT_ENABLED', 'manualPaymentEnabled', 'boolean', true, false],
  ['payments.bank_qr_bank_bin', 'Bank QR bank BIN', 'BANK_QR_BANK_BIN', 'bankQrBankBin', 'string', '', false],
  ['payments.bank_qr_account_no', 'Bank QR account no', 'BANK_QR_ACCOUNT_NO', 'bankQrAccountNo', 'string', '', true],
  ['payments.bank_qr_account_name', 'Bank QR account name', 'BANK_QR_ACCOUNT_NAME', 'bankQrAccountName', 'string', '', false],
  ['payments.bank_qr_template', 'Bank QR template', 'BANK_QR_TEMPLATE', 'bankQrTemplate', 'string', 'compact2', false],
  ['payments.bank_qr_intent_ttl_minutes', 'Bank QR intent TTL', 'BANK_QR_INTENT_TTL_MINUTES', 'bankQrIntentTtlMinutes', 'number', 30, false],
  ['payments.momo_personal_qr_enabled', 'MoMo personal QR enabled', 'MOMO_PERSONAL_QR_ENABLED', 'momoPersonalQrEnabled', 'boolean', false, false],
  ['payments.momo_personal_qr_image_url', 'MoMo QR image URL', 'MOMO_PERSONAL_QR_IMAGE_URL', 'momoPersonalQrImageUrl', 'string', '', false],
  ['payments.momo_personal_qr_image_path', 'MoMo QR image path', 'MOMO_PERSONAL_QR_IMAGE_PATH', 'momoPersonalQrImagePath', 'string', 'uploads/payment/momo-qr.png', false],
  ['payments.momo_personal_phone', 'MoMo phone', 'MOMO_PERSONAL_PHONE', 'momoPersonalPhone', 'string', '', true],
  ['payments.momo_personal_account_name', 'MoMo account name', 'MOMO_PERSONAL_ACCOUNT_NAME', 'momoPersonalAccountName', 'string', '', false],
  ['payments.momo_personal_note_prefix', 'MoMo note prefix', 'MOMO_PERSONAL_NOTE_PREFIX', 'momoPersonalNotePrefix', 'string', 'MEDCARE', false],
].forEach(([settingKey, name, envKey, envProp, valueType, defaultValue, sensitive]) => setting({
  setting_key: settingKey,
  setting_name: name,
  module_key: 'payments',
  env_key: envKey,
  env_prop: envProp,
  value_type: valueType,
  default_value: defaultValue,
  is_sensitive: Boolean(sensitive),
  is_encrypted: Boolean(sensitive),
  requires_restart: true,
  runtime_reloadable: false,
  risk_level: sensitive ? 'critical' : 'high',
  affected_services: ['billing', 'portal'],
}));
setting({
  setting_key: 'billing.payment_intent_expiry_minutes',
  setting_name: 'Payment intent expiry minutes',
  module_key: 'payments',
  value_type: SYSTEM_SETTING_VALUE_TYPE.NUMBER,
  default_value: 15,
  risk_level: 'high',
  affected_services: ['billing', 'portal'],
});
setting({
  setting_key: 'payments.reconciliation_policy',
  setting_name: 'Reconciliation policy',
  module_key: 'payments',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    auto_match_by_intent_code: true,
    auto_match_by_amount: true,
    amount_tolerance_vnd: 0,
    allow_manual_match: true,
    require_two_person_approval: false,
    statement_import_provider: 'manual',
  },
  risk_level: 'critical',
  affected_services: ['billing', 'reconciliation'],
});

setting({
  setting_key: 'records.document_export_expiry_hours',
  setting_name: 'Document export expiry hours',
  module_key: 'patient_portal',
  value_type: SYSTEM_SETTING_VALUE_TYPE.NUMBER,
  default_value: 24,
  risk_level: 'high',
  affected_services: ['portal', 'records'],
});
setting({
  setting_key: 'patient_portal.feature_matrix',
  setting_name: 'Portal feature matrix',
  module_key: 'patient_portal',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    patient_login: true,
    profile_change_request: true,
    document_upload: true,
    document_archive_restore: true,
    document_zip_export: true,
    insurance_self_service: true,
    relative_authorization: true,
    patient_chat: true,
    access_log_visible: true,
  },
  risk_level: 'high',
  affected_services: ['portal'],
});
setting({
  setting_key: 'patient_portal.document_policy',
  setting_name: 'Portal document policy',
  module_key: 'patient_portal',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    max_upload_size_mb: 10,
    allowed_file_types: ['application/pdf', 'image/jpeg', 'image/png'],
    allow_archive: true,
    allow_restore: true,
    allow_hard_delete: false,
    require_scan_clean: true,
    require_staff_review: false,
    zip_export_expiry_hours: 24,
    max_files_per_zip: 100,
  },
  risk_level: 'high',
  affected_services: ['portal', 'records'],
});
setting({
  setting_key: 'patient_portal.relative_policy',
  setting_name: 'Relative authorization policy',
  module_key: 'patient_portal',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    allow_relative_accounts: true,
    max_relatives_per_patient: 5,
    require_patient_approval: true,
    require_expiry_date: false,
    allow_revoke: true,
    notify_on_relative_access: true,
    show_relative_access_log: true,
  },
  risk_level: 'high',
  affected_services: ['portal', 'access'],
});

setting({
  setting_key: 'support.sla_by_priority_minutes',
  setting_name: 'Support SLA by priority',
  module_key: 'support_sla',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    urgent: 15,
    high: 120,
    normal: 1440,
    low: 4320,
  },
  risk_level: 'medium',
  affected_services: ['support'],
});
setting({
  setting_key: 'support_sla.policy_table',
  setting_name: 'Support SLA policy table',
  module_key: 'support_sla',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    urgent: { first_response_minutes: 15, resolution_minutes: 120, warning_before_minutes: 5, escalation: ['admin', 'security'] },
    high: { first_response_minutes: 120, resolution_minutes: 480, warning_before_minutes: 30, escalation: ['support_manager'] },
    normal: { first_response_minutes: 1440, resolution_minutes: 4320, warning_before_minutes: 240, escalation: ['department'] },
    low: { first_response_minutes: 4320, resolution_minutes: 10080, warning_before_minutes: 720, escalation: ['support_queue'] },
  },
  risk_level: 'medium',
  affected_services: ['support', 'notifications'],
});
setting({
  setting_key: 'support_sla.routing_policy',
  setting_name: 'Support routing policy',
  module_key: 'support_sla',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    technical: { default_department: 'IT/Admin', default_priority: 'high', auto_assign: true },
    account: { default_department: 'Admin/Reception', default_priority: 'normal', auto_assign: true },
    billing: { default_department: 'Billing', default_priority: 'high', auto_assign: true },
    insurance: { default_department: 'Billing/Insurance', default_priority: 'high', auto_assign: true },
    pharmacy: { default_department: 'Pharmacy', default_priority: 'normal', auto_assign: true },
    complaint: { default_department: 'Operation manager', default_priority: 'high', auto_assign: false },
  },
  risk_level: 'medium',
  affected_services: ['support'],
});

setting({
  setting_key: 'audit_retention.retention_matrix',
  setting_name: 'Audit retention matrix',
  module_key: 'audit_retention',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    general_audit: { retention_days: 365, archive_after_days: 90, export_allowed: true, delete_allowed: false },
    login_history: { retention_days: 365, archive_after_days: 90, export_allowed: true, delete_allowed: false },
    permission_changes: { retention_days: 2555, archive_after_days: null, export_allowed: true, delete_allowed: false },
    payment_audit: { retention_days: 2555, archive_after_days: null, export_allowed: true, delete_allowed: false },
    medical_record_access: { retention_days: 3650, archive_after_days: null, export_allowed: true, delete_allowed: false },
    break_glass_audit: { retention_days: 3650, archive_after_days: null, export_allowed: true, delete_allowed: false },
    sensitive_access: { retention_days: 3650, archive_after_days: null, export_allowed: true, delete_allowed: false },
  },
  risk_level: 'critical',
  affected_services: ['audit', 'compliance'],
});
setting({
  setting_key: 'audit_retention.export_policy',
  setting_name: 'Audit export policy',
  module_key: 'audit_retention',
  value_type: SYSTEM_SETTING_VALUE_TYPE.JSON,
  default_value: {
    allow_audit_export: true,
    require_reason: true,
    require_approval_for_sensitive_export: true,
    max_export_range_days: 31,
    export_expiry_hours: 24,
    watermark_export: true,
    notify_security_center: true,
    allowed_formats: ['csv', 'json', 'xlsx'],
  },
  risk_level: 'critical',
  affected_services: ['audit', 'reports'],
});

const MODULE_BY_ROUTE = new Map(MODULES.flatMap((module) => [
  [module.module_key, module],
  [module.route_key, module],
]));
const DEFINITIONS_BY_KEY = new Map(defs.map((definition) => [definition.setting_key, definition]));

function normalizeModuleKey(moduleKey = '') {
  const normalized = String(moduleKey || 'general').trim().toLowerCase().replace(/-/g, '_');
  const direct = MODULE_BY_ROUTE.get(normalized);
  if (direct) return direct.module_key;
  const routeStyle = normalized.replace(/_/g, '-');
  return MODULE_BY_ROUTE.get(routeStyle)?.module_key || normalized;
}

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function fingerprint(value) {
  if (!hasValue(value)) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function maskValue(value) {
  return {
    configured: hasValue(value),
    fingerprint: fingerprint(value),
  };
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function displayValue(value, definition = {}) {
  if (definition.is_sensitive || definition.is_encrypted) return maskValue(value);
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return value;
  return value;
}

function readSettingValue(setting) {
  try {
    return systemSettingService.readStoredSettingValue(setting, 'setting_value');
  } catch (error) {
    return null;
  }
}

function parseFallbackByType(value, valueType) {
  if (value === undefined) return value;
  if (valueType === SYSTEM_SETTING_VALUE_TYPE.NUMBER) return Number(value);
  if (valueType === SYSTEM_SETTING_VALUE_TYPE.BOOLEAN) return Boolean(value);
  if (valueType === SYSTEM_SETTING_VALUE_TYPE.ARRAY) return Array.isArray(value) ? value : [];
  if (valueType === SYSTEM_SETTING_VALUE_TYPE.JSON) return value && typeof value === 'object' ? value : {};
  return value === null ? '' : String(value);
}

function getEnvValue(definition) {
  if (!definition.env_prop) return undefined;
  return env[definition.env_prop];
}

function isEnvExplicit(definition) {
  if (!definition.env_key) return false;
  return process.env[definition.env_key] !== undefined && process.env[definition.env_key] !== '';
}

function resolveEffectiveValue(definition, setting, overrides = {}) {
  const hasOverride = Object.prototype.hasOwnProperty.call(overrides, definition.setting_key);
  if (hasOverride) {
    return {
      value: overrides[definition.setting_key],
      source: 'runtime',
      db_setting: setting || null,
    };
  }

  if (setting && setting.status === SYSTEM_SETTING_STATUS.ACTIVE && setting.setting_value !== undefined && setting.setting_value !== null) {
    return {
      value: readSettingValue(setting),
      source: 'db',
      db_setting: setting,
    };
  }

  const envValue = getEnvValue(definition);
  if (definition.env_prop && (isEnvExplicit(definition) || hasValue(envValue))) {
    return {
      value: envValue,
      source: isEnvExplicit(definition) ? 'env' : 'runtime',
      db_setting: setting || null,
    };
  }

  return {
    value: parseFallbackByType(definition.default_value, definition.value_type),
    source: 'default',
    db_setting: setting || null,
  };
}

function serializeEffective(definition, setting, overrides = {}) {
  const effective = resolveEffectiveValue(definition, setting, overrides);
  const currentValue = effective.value;

  return {
    ...definition,
    setting_id: setting?._id ? String(setting._id) : null,
    setting_value: definition.is_sensitive || definition.is_encrypted ? null : currentValue,
    effective_value: displayValue(currentValue, definition),
    effective_source: effective.source,
    db_configured: Boolean(setting),
    env_configured: isEnvExplicit(definition),
    secret_status: definition.is_sensitive || definition.is_encrypted ? maskValue(currentValue) : null,
    last_changed_at: setting?.updated_at || setting?.created_at || null,
    last_applied_at: setting?.last_applied_at || null,
    status: setting?.status || definition.status,
  };
}

function genericDefinitionFromSetting(setting) {
  return {
    setting_key: setting.setting_key,
    setting_name: setting.setting_name,
    module_key: setting.module_key,
    value_type: setting.value_type,
    default_value: setting.default_value,
    description: setting.description,
    is_public: Boolean(setting.is_public),
    is_sensitive: Boolean(setting.is_sensitive),
    is_encrypted: Boolean(setting.is_encrypted),
    requires_restart: Boolean(setting.requires_restart),
    runtime_reloadable: setting.runtime_reloadable !== false,
    risk_level: setting.risk_level || 'medium',
    affected_services: setting.affected_services || [],
    status: setting.status,
  };
}

async function loadSettingsMap() {
  const settings = await SystemSetting.find({}).lean();
  return new Map(settings.map((setting) => [setting.setting_key, setting]));
}

async function getEffectiveConfigs(options = {}) {
  const moduleKey = options.module_key ? normalizeModuleKey(options.module_key) : null;
  const settingsMap = await loadSettingsMap();
  const definitions = defs.filter((definition) => !moduleKey || definition.module_key === moduleKey);
  const items = definitions.map((definition) => serializeEffective(definition, settingsMap.get(definition.setting_key), options.overrides));
  const knownKeys = new Set(definitions.map((definition) => definition.setting_key));

  for (const setting of settingsMap.values()) {
    if (knownKeys.has(setting.setting_key)) continue;
    if (moduleKey && setting.module_key !== moduleKey) continue;
    items.push(serializeEffective(genericDefinitionFromSetting(setting), setting, options.overrides));
  }

  return items.sort((left, right) => left.setting_key.localeCompare(right.setting_key));
}

async function getEffectiveConfig(settingKey) {
  const definition = DEFINITIONS_BY_KEY.get(settingKey);
  const setting = await SystemSetting.findOne({ setting_key: settingKey }).lean();
  if (!definition && !setting) throw ApiError.notFound('Khong tim thay cau hinh.');
  return serializeEffective(definition || genericDefinitionFromSetting(setting), setting);
}

function issue(severity, moduleKey, settingKey, message, recommendation = null) {
  return {
    severity,
    module_key: moduleKey,
    setting_key: settingKey,
    message,
    recommendation,
  };
}

function valueByKey(effectiveItems, settingKey) {
  const item = effectiveItems.find((candidate) => candidate.setting_key === settingKey);
  if (!item) return undefined;
  if (item.secret_status) return item.secret_status.configured ? '__configured_secret__' : '';
  return item.setting_value ?? item.effective_value;
}

function boolValue(effectiveItems, settingKey) {
  const value = valueByKey(effectiveItems, settingKey);
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function numberValue(effectiveItems, settingKey) {
  const value = valueByKey(effectiveItems, settingKey);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectValue(effectiveItems, settingKey) {
  const value = valueByKey(effectiveItems, settingKey);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function validateItems(effectiveItems) {
  const issues = [];
  const nodeEnv = env.nodeEnv;
  const corsOrigins = valueByKey(effectiveItems, 'general.cors_origins') || [];

  if (nodeEnv === 'production' && (!Array.isArray(corsOrigins) || corsOrigins.length === 0)) {
    issues.push(issue('critical', 'general', 'general.cors_origins', 'Production can cau hinh CORS_ORIGINS ro rang.'));
  }
  if (nodeEnv === 'production' && Array.isArray(corsOrigins) && corsOrigins.includes('*')) {
    issues.push(issue('critical', 'general', 'general.cors_origins', 'Production khong duoc dung wildcard CORS.'));
  }
  if (boolValue(effectiveItems, 'login.expose_reset_secrets') && nodeEnv === 'production') {
    issues.push(issue('critical', 'login', 'login.expose_reset_secrets', 'AUTH_EXPOSE_RESET_SECRETS phai tat o production.'));
  }
  if (!hasValue(env.jwtAccessSecret)) {
    issues.push(issue('critical', 'security', 'security.jwt_access_secret', 'JWT access secret chua duoc cau hinh.'));
  }
  if (!hasValue(env.jwtRefreshSecret)) {
    issues.push(issue('critical', 'security', 'security.jwt_refresh_secret', 'JWT refresh secret chua duoc cau hinh.'));
  }
  if (hasValue(env.jwtAccessSecret) && env.jwtAccessSecret === env.jwtRefreshSecret) {
    issues.push(issue('critical', 'security', 'security.jwt_refresh_secret', 'JWT access secret va refresh secret khong duoc trung nhau.'));
  }

  if (boolValue(effectiveItems, 'google_oauth.enabled')) {
    ['google_oauth.client_id', 'google_oauth.client_secret', 'google_oauth.callback_url'].forEach((settingKey) => {
      if (!hasValue(valueByKey(effectiveItems, settingKey))) {
        issues.push(issue('critical', 'google_oauth', settingKey, `${settingKey} la bat buoc khi Google OAuth dang bat.`));
      }
    });
  }

  if (boolValue(effectiveItems, 'email_smtp.enabled')) {
    ['email_smtp.host', 'email_smtp.from_email'].forEach((settingKey) => {
      if (!hasValue(valueByKey(effectiveItems, settingKey))) {
        issues.push(issue('critical', 'email_smtp', settingKey, `${settingKey} la bat buoc khi SMTP dang bat.`));
      }
    });
    const port = numberValue(effectiveItems, 'email_smtp.port');
    if (!port || port < 1 || port > 65535) {
      issues.push(issue('critical', 'email_smtp', 'email_smtp.port', 'SMTP port phai nam trong khoang 1-65535.'));
    }
  }

  const pushPolicy = objectValue(effectiveItems, 'push_notification.policy');
  if (pushPolicy?.enabled && !hasValue(valueByKey(effectiveItems, 'push_notification.provider_url'))) {
    issues.push(issue('critical', 'push_notification', 'push_notification.provider_url', 'Push provider URL la bat buoc khi push dang bat.'));
  }

  if (boolValue(effectiveItems, 'realtime.redis_enabled') && !hasValue(valueByKey(effectiveItems, 'realtime.redis_url'))) {
    issues.push(issue('warning', 'realtime', 'realtime.redis_url', 'Realtime Redis dang bat nhung REDIS_URL chua cau hinh.'));
  }

  const maxUpload = numberValue(effectiveItems, 'files.max_upload_size_bytes');
  if (!maxUpload || maxUpload < 1024) {
    issues.push(issue('critical', 'file_upload', 'files.max_upload_size_bytes', 'Max upload size qua nho hoac khong hop le.'));
  }
  const qrExpiry = numberValue(effectiveItems, 'qr_token.default_expiry_minutes');
  if (!qrExpiry || qrExpiry <= 0) {
    issues.push(issue('critical', 'qr_token', 'qr_token.default_expiry_minutes', 'QR expiry phai lon hon 0.'));
  }

  if (boolValue(effectiveItems, 'features.enable_online_payment')) {
    const manualPaymentEnabled = boolValue(effectiveItems, 'payments.manual_payment_enabled');
    if (!manualPaymentEnabled) {
      issues.push(issue('warning', 'payments', 'payments.manual_payment_enabled', 'Online payment dang bat nhung manual payment dang tat.'));
    }
  }

  if (boolValue(effectiveItems, 'payments.momo_personal_qr_enabled')) {
    const hasMomoImage = hasValue(valueByKey(effectiveItems, 'payments.momo_personal_qr_image_url'))
      || hasValue(valueByKey(effectiveItems, 'payments.momo_personal_qr_image_path'));
    if (!hasMomoImage) {
      issues.push(issue('critical', 'payments', 'payments.momo_personal_qr_image_url', 'MoMo personal QR can image URL hoac image path.'));
    }
  }

  const sla = objectValue(effectiveItems, 'support.sla_by_priority_minutes');
  ['urgent', 'high', 'normal', 'low'].forEach((priority) => {
    if (!sla || !Number.isFinite(Number(sla[priority])) || Number(sla[priority]) <= 0) {
      issues.push(issue('critical', 'support_sla', 'support.sla_by_priority_minutes', `SLA ${priority} phai co so phut hop le.`));
    }
  });

  const retention = objectValue(effectiveItems, 'audit_retention.retention_matrix');
  if (retention?.medical_record_access?.retention_days && Number(retention.medical_record_access.retention_days) < 3650) {
    issues.push(issue('warning', 'audit_retention', 'audit_retention.retention_matrix', 'Medical record access audit nen giu toi thieu 10 nam.'));
  }

  return {
    ok: !issues.some((item) => item.severity === 'critical'),
    counts: {
      critical: issues.filter((item) => item.severity === 'critical').length,
      warning: issues.filter((item) => item.severity === 'warning').length,
      info: issues.filter((item) => item.severity === 'info').length,
    },
    issues,
  };
}

async function validateConfig(payload = {}) {
  const overrides = payload.settings || payload.overrides || {};
  const items = await getEffectiveConfigs({ overrides });
  const validation = validateItems(items);
  const moduleKey = payload.module_key ? normalizeModuleKey(payload.module_key) : null;

  return {
    ...validation,
    issues: moduleKey ? validation.issues.filter((item) => item.module_key === moduleKey) : validation.issues,
  };
}

function healthFromIssues(issues = []) {
  if (issues.some((item) => item.severity === 'critical')) return 'critical';
  if (issues.some((item) => item.severity === 'warning')) return 'warning';
  return 'healthy';
}

async function collectStats() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [
    activeSessions,
    notificationsQueued,
    notificationsFailed,
    notificationsToday,
    paymentIntentsPending,
    qrActive,
    qrConsumedToday,
    supportOverSla,
    auditLogsTotal,
  ] = await Promise.all([
    AuthSession.countDocuments({ revoked_at: null, expires_at: { $gt: now } }),
    Notification.countDocuments({ status: 'queued' }),
    NotificationDelivery.countDocuments({ status: 'failed' }),
    Notification.countDocuments({ created_at: { $gte: startOfDay } }),
    PaymentIntent.countDocuments({ status: { $in: ['pending', 'requires_confirmation'] } }),
    QrToken.countDocuments({ revoked_at: null, used_at: null, expires_at: { $gt: now } }),
    QrToken.countDocuments({ used_at: { $gte: startOfDay } }),
    SupportTicket.countDocuments({ sla_due_at: { $lt: now }, status: { $nin: ['resolved', 'closed'] } }),
    AuditLog.estimatedDocumentCount(),
  ]);

  const presence = presenceService.getAllPresence();
  return {
    active_sessions: activeSessions,
    notifications_queued: notificationsQueued,
    notifications_failed: notificationsFailed,
    notifications_today: notificationsToday,
    payment_intents_pending: paymentIntentsPending,
    qr_active: qrActive,
    qr_consumed_today: qrConsumedToday,
    support_over_sla: supportOverSla,
    audit_logs_total: auditLogsTotal,
    connected_actors: presence.length,
    connected_sockets: presence.reduce((sum, item) => sum + Number(item.socket_count || 0), 0),
  };
}

async function getModules() {
  const [items, validation] = await Promise.all([
    getEffectiveConfigs(),
    validateConfig(),
  ]);

  return {
    items: MODULES.map((module) => {
      const settings = items.filter((item) => item.module_key === module.module_key);
      const issues = validation.issues.filter((item) => item.module_key === module.module_key);
      return {
        ...module,
        setting_count: settings.length,
        db_setting_count: settings.filter((item) => item.db_configured).length,
        env_setting_count: settings.filter((item) => item.effective_source === 'env').length,
        sensitive_count: settings.filter((item) => item.is_sensitive || item.is_encrypted).length,
        requires_restart_count: settings.filter((item) => item.requires_restart).length,
        health: healthFromIssues(issues),
        issue_count: issues.length,
      };
    }),
  };
}

async function getModule(moduleKey) {
  const normalized = normalizeModuleKey(moduleKey);
  const module = MODULES.find((item) => item.module_key === normalized);
  if (!module) throw ApiError.notFound('Khong tim thay module cau hinh.');
  const [settings, validation] = await Promise.all([
    getEffectiveConfigs({ module_key: normalized }),
    validateConfig({ module_key: normalized }),
  ]);
  return {
    module,
    settings,
    validation,
  };
}

async function getOverview() {
  const [modules, validation, stats, settings] = await Promise.all([
    getModules(),
    validateConfig(),
    collectStats(),
    getEffectiveConfigs(),
  ]);

  const connectionState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
  const sourceCounts = settings.reduce((counts, item) => ({
    ...counts,
    [item.effective_source]: Number(counts[item.effective_source] || 0) + 1,
  }), {});

  return {
    environment: {
      node_env: env.nodeEnv,
      port: env.port,
      app_base_url: env.appBaseUrl,
      cors_origins: env.corsOrigins,
      request_body_limit: env.requestBodyLimit,
      last_reload_at: lastReloadAt,
      database_state: connectionState,
      database_name: env.mongodbDbName || mongoose.connection.name || null,
    },
    health: {
      status: healthFromIssues(validation.issues),
      validation,
      source_counts: sourceCounts,
      total_settings: settings.length,
      db_settings: settings.filter((item) => item.db_configured).length,
      sensitive_settings: settings.filter((item) => item.is_sensitive || item.is_encrypted).length,
      restart_required_settings: settings.filter((item) => item.requires_restart).length,
    },
    stats,
    modules: modules.items,
  };
}

async function applyConfig(payload = {}, actor = {}, requestMeta = {}) {
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  if (changes.length === 0) throw ApiError.validation('Danh sach changes la bat buoc.');

  const results = [];
  for (const change of changes) {
    const settingKey = String(change.setting_key || '').trim();
    const definition = DEFINITIONS_BY_KEY.get(settingKey);
    if (!definition) throw ApiError.notFound(`Khong tim thay metadata cho setting ${settingKey}.`);
    if (definition.read_only) throw ApiError.forbidden(`Setting ${settingKey} la read-only.`);

    const hasSettingValue = Object.prototype.hasOwnProperty.call(change, 'setting_value')
      || Object.prototype.hasOwnProperty.call(change, 'value');
    const value = Object.prototype.hasOwnProperty.call(change, 'setting_value') ? change.setting_value : change.value;
    const existing = await SystemSetting.findOne({ setting_key: settingKey }).lean();
    const settingPayload = {
      setting_key: settingKey,
      setting_name: definition.setting_name,
      module_key: definition.module_key,
      value_type: definition.value_type,
      default_value: definition.default_value,
      description: definition.description,
      is_public: definition.is_public,
      is_sensitive: definition.is_sensitive,
      is_encrypted: definition.is_encrypted,
      requires_restart: definition.requires_restart,
      runtime_reloadable: definition.runtime_reloadable,
      risk_level: definition.risk_level,
      affected_services: definition.affected_services,
      last_applied_at: new Date(),
      change_reason: change.change_reason || payload.change_reason,
    };

    if (hasSettingValue) settingPayload.setting_value = value;

    const result = existing
      ? await systemSettingService.updateSystemSetting(settingKey, settingPayload, actor, requestMeta)
      : await systemSettingService.createSystemSetting(settingPayload, actor, requestMeta);
    results.push(result.setting);
  }

  return {
    applied_at: new Date().toISOString(),
    items: results,
    validation: await validateConfig(),
  };
}

async function getDrift() {
  const settingsMap = await loadSettingsMap();
  const items = defs
    .filter((definition) => definition.env_prop)
    .map((definition) => {
      const setting = settingsMap.get(definition.setting_key);
      const dbValue = setting ? readSettingValue(setting) : undefined;
      const envValue = getEnvValue(definition);
      const hasDb = setting && setting.setting_value !== undefined && setting.setting_value !== null;
      const hasEnv = isEnvExplicit(definition) || hasValue(envValue);
      const comparableDb = definition.is_sensitive || definition.is_encrypted ? fingerprint(dbValue) : safeJson(dbValue);
      const comparableEnv = definition.is_sensitive || definition.is_encrypted ? fingerprint(envValue) : safeJson(envValue);

      return {
        setting_key: definition.setting_key,
        module_key: definition.module_key,
        env_key: definition.env_key,
        db_configured: Boolean(hasDb),
        env_configured: Boolean(hasEnv),
        drifted: Boolean(hasDb && hasEnv && comparableDb !== comparableEnv),
        db_value: definition.is_sensitive || definition.is_encrypted ? maskValue(dbValue) : dbValue,
        env_value: definition.is_sensitive || definition.is_encrypted ? maskValue(envValue) : envValue,
      };
    });

  return {
    items,
    drift_count: items.filter((item) => item.drifted).length,
  };
}

async function getSecretsStatus() {
  const effective = await getEffectiveConfigs();
  return {
    items: effective
      .filter((item) => item.is_sensitive || item.is_encrypted)
      .map((item) => ({
        setting_key: item.setting_key,
        setting_name: item.setting_name,
        module_key: item.module_key,
        source: item.effective_source,
        configured: Boolean(item.secret_status?.configured),
        fingerprint: item.secret_status?.fingerprint || null,
        requires_restart: item.requires_restart,
        risk_level: item.risk_level,
        last_changed_at: item.last_changed_at,
      })),
  };
}

async function reloadConfig(actor = {}, requestMeta = {}) {
  lastReloadAt = new Date().toISOString();
  return {
    reloaded_at: lastReloadAt,
    actor_id: actor.userId || actor.actorId || null,
    request_id: requestMeta.requestId || null,
    note: 'Runtime reload marker updated. Services that read env at startup still require process restart.',
  };
}

function buildGoogleAuthUrl(items) {
  const clientId = valueByKey(items, 'google_oauth.client_id');
  const callbackUrl = valueByKey(items, 'google_oauth.callback_url');
  if (!hasValue(clientId) || !hasValue(callbackUrl)) return null;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

async function testModule(moduleKey, payload = {}) {
  const normalized = normalizeModuleKey(moduleKey);
  const settings = await getEffectiveConfigs({ module_key: normalized, overrides: payload.settings || {} });
  const validation = validateItems(await getEffectiveConfigs({ overrides: payload.settings || {} }));
  const moduleIssues = validation.issues.filter((item) => item.module_key === normalized);
  const base = {
    module_key: normalized,
    status: moduleIssues.some((item) => item.severity === 'critical') ? 'failed' : moduleIssues.length ? 'warning' : 'passed',
    checked_at: new Date().toISOString(),
    validation: {
      ok: !moduleIssues.some((item) => item.severity === 'critical'),
      issues: moduleIssues,
    },
  };

  if (normalized === 'email_smtp') {
    return {
      ...base,
      diagnostics: [
        { step: 'config.enabled', status: boolValue(settings, 'email_smtp.enabled') ? 'passed' : 'warning', detail: 'SMTP enabled flag evaluated.' },
        { step: 'config.host', status: hasValue(valueByKey(settings, 'email_smtp.host')) ? 'passed' : 'failed', detail: 'SMTP host configured.' },
        { step: 'config.sender', status: hasValue(valueByKey(settings, 'email_smtp.from_email')) ? 'passed' : 'failed', detail: 'SMTP from email configured.' },
        { step: 'config.secret', status: hasValue(valueByKey(settings, 'email_smtp.password')) || hasValue(valueByKey(settings, 'email_smtp.username')) ? 'passed' : 'warning', detail: 'SMTP auth is optional when provider allows IP relay.' },
      ],
      dry_run: true,
    };
  }

  if (normalized === 'google_oauth') {
    return {
      ...base,
      generated_auth_url: buildGoogleAuthUrl(settings),
      diagnostics: [
        { step: 'oauth.enabled', status: boolValue(settings, 'google_oauth.enabled') ? 'passed' : 'warning' },
        { step: 'oauth.client_id', status: hasValue(valueByKey(settings, 'google_oauth.client_id')) ? 'passed' : 'failed' },
        { step: 'oauth.callback', status: hasValue(valueByKey(settings, 'google_oauth.callback_url')) ? 'passed' : 'failed' },
      ],
    };
  }

  if (normalized === 'payments') {
    return {
      ...base,
      providers: paymentProviderRegistry.listProviders({ includeDisabled: true, includePrivate: true }),
      bank_qr_preview: {
        bank_bin: valueByKey(settings, 'payments.bank_qr_bank_bin') || null,
        account_name: valueByKey(settings, 'payments.bank_qr_account_name') || null,
        account_no: maskValue(valueByKey(settings, 'payments.bank_qr_account_no')),
        template: valueByKey(settings, 'payments.bank_qr_template') || 'compact2',
      },
    };
  }

  if (normalized === 'realtime') {
    const io = realtimeService.getSocketServer();
    const presence = presenceService.getAllPresence();
    return {
      ...base,
      socket_online: Boolean(io),
      adapter_mode: env.realtimeRedisEnabled && env.redisUrl ? 'redis' : 'local',
      connected_actors: presence.length,
      connected_sockets: presence.reduce((sum, item) => sum + Number(item.socket_count || 0), 0),
      rooms: [...new Set(presence.flatMap((item) => item.rooms || []))].slice(0, 50),
    };
  }

  if (normalized === 'push_notification') {
    const policy = objectValue(settings, 'push_notification.policy') || {};
    return {
      ...base,
      payload_validation: {
        title_present: hasValue(payload.title || 'Test push'),
        body_present: hasValue(payload.body || 'Test body'),
        data_json_valid: !payload.data || typeof payload.data === 'object',
        dry_run: policy.dry_run !== false,
      },
    };
  }

  return {
    ...base,
    diagnostics: [
      { step: 'metadata.loaded', status: settings.length > 0 ? 'passed' : 'failed' },
      { step: 'validation', status: moduleIssues.length ? 'warning' : 'passed' },
    ],
  };
}

module.exports = {
  MODULES,
  SETTING_DEFINITIONS: defs,
  normalizeModuleKey,
  getOverview,
  getModules,
  getModule,
  getEffectiveConfigs,
  getEffectiveConfig,
  validateConfig,
  testModule,
  applyConfig,
  reloadConfig,
  getDrift,
  getSecretsStatus,
};
