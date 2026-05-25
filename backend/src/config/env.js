const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPlaceholderSecret(value) {
  const text = String(value || '').trim().toLowerCase();
  return !text || text.includes('replace_with') || text.includes('change_me') || text === 'secret';
}

function validateConfig(config) {
  const errors = [];
  const isProduction = config.nodeEnv === 'production';

  if (!config.mongodbUri) errors.push('MONGODB_URI is required.');
  if (!config.jwtAccessSecret) errors.push('JWT_ACCESS_SECRET is required.');
  if (!config.jwtRefreshSecret) errors.push('JWT_REFRESH_SECRET is required.');
  if (config.jwtAccessSecret && config.jwtAccessSecret === config.jwtRefreshSecret) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
  }

  if (isProduction) {
    if (isPlaceholderSecret(config.jwtAccessSecret)) {
      errors.push('JWT_ACCESS_SECRET must be a strong production secret.');
    }
    if (isPlaceholderSecret(config.jwtRefreshSecret)) {
      errors.push('JWT_REFRESH_SECRET must be a strong production secret.');
    }
    if (isPlaceholderSecret(config.superAdminPassword)) {
      errors.push('SUPER_ADMIN_PASSWORD must be set to a strong production password.');
    }
    if (config.exposeResetSecrets) {
      errors.push('AUTH_EXPOSE_RESET_SECRETS must be false in production.');
    }
    if (!config.corsOrigins.length) {
      errors.push('CORS_ORIGINS must contain at least one origin in production.');
    }
    if (config.corsOrigins.includes('*')) {
      errors.push('CORS_ORIGINS must not contain wildcard "*" in production.');
    }
    if (config.googleAuthEnabled) {
      if (!config.googleClientId) errors.push('GOOGLE_CLIENT_ID is required when GOOGLE_AUTH_ENABLED=true.');
      if (!config.googleClientSecret) errors.push('GOOGLE_CLIENT_SECRET is required when GOOGLE_AUTH_ENABLED=true.');
      if (!config.googleCallbackUrl) errors.push('GOOGLE_CALLBACK_URL is required when GOOGLE_AUTH_ENABLED=true.');
    }
    if (config.momoPersonalQrEnabled && !config.momoPersonalQrImageUrl && !config.momoPersonalQrImagePath) {
      errors.push('MOMO_PERSONAL_QR_IMAGE_URL or MOMO_PERSONAL_QR_IMAGE_PATH is required when MOMO_PERSONAL_QR_ENABLED=true.');
    }
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }
}

const env = {
  port: parsePositiveNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || '',
  mongodbMaxPoolSize: parsePositiveNumber(process.env.MONGODB_MAX_POOL_SIZE, 20),
  mongodbMinPoolSize: parseNumber(process.env.MONGODB_MIN_POOL_SIZE, 0),
  mongodbServerSelectionTimeoutMs: parsePositiveNumber(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 5000),
  mongodbConnectTimeoutMs: parsePositiveNumber(process.env.MONGODB_CONNECT_TIMEOUT_MS, 10000),
  mongodbSocketTimeoutMs: parsePositiveNumber(process.env.MONGODB_SOCKET_TIMEOUT_MS, 45000),
  mongooseAutoIndex: parseBoolean(process.env.MONGOOSE_AUTO_INDEX, false),
  mongooseAutoCreate: parseBoolean(process.env.MONGOOSE_AUTO_CREATE, false),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtIssuer: process.env.JWT_ISSUER || '',
  jwtAudience: process.env.JWT_AUDIENCE || '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  passwordResetExpiresInMinutes: parsePositiveNumber(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES, 15),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  corsOrigins: parseList(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
  redisUrl: process.env.REDIS_URL || '',
  realtimeRedisEnabled: parseBoolean(process.env.REALTIME_REDIS_ENABLED, Boolean(process.env.REDIS_URL)),
  jobsRedisEnabled: parseBoolean(process.env.JOBS_REDIS_ENABLED, Boolean(process.env.REDIS_URL)),
  jobWorkerConcurrency: parsePositiveNumber(process.env.JOB_WORKER_CONCURRENCY, 5),
  exposeResetSecrets: parseBoolean(process.env.AUTH_EXPOSE_RESET_SECRETS, false),
  smtpEnabled: parseBoolean(
    process.env.SMTP_ENABLED,
    Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM_EMAIL),
  ),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parsePositiveNumber(process.env.SMTP_PORT, 587),
  smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFromName: process.env.SMTP_FROM_NAME || 'MedCare Portal',
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || '',
  smtpReplyTo: process.env.SMTP_REPLY_TO || '',
  pushProviderUrl: process.env.PUSH_PROVIDER_URL || '',
  pushProviderToken: process.env.PUSH_PROVIDER_TOKEN || '',
  bankQrBankBin: process.env.BANK_QR_BANK_BIN || '',
  bankQrAccountNo: process.env.BANK_QR_ACCOUNT_NO || '',
  bankQrAccountName: process.env.BANK_QR_ACCOUNT_NAME || '',
  bankQrTemplate: process.env.BANK_QR_TEMPLATE || 'compact2',
  bankQrIntentTtlMinutes: parsePositiveNumber(process.env.BANK_QR_INTENT_TTL_MINUTES, 30),
  googleAuthEnabled: parseBoolean(process.env.GOOGLE_AUTH_ENABLED, false),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  frontendAuthSuccessUrl: process.env.FRONTEND_AUTH_SUCCESS_URL || 'http://localhost:5173/auth/success',
  frontendAuthFailureUrl: process.env.FRONTEND_AUTH_FAILURE_URL || 'http://localhost:5173/auth/failure',
  manualPaymentEnabled: parseBoolean(process.env.MANUAL_PAYMENT_ENABLED, true),
  paymentReceiptUploadEnabled: parseBoolean(process.env.PAYMENT_RECEIPT_UPLOAD_ENABLED, true),
  paymentReceiptMaxSizeBytes: parsePositiveNumber(process.env.PAYMENT_RECEIPT_MAX_SIZE_BYTES, 5 * 1024 * 1024),
  momoPersonalQrEnabled: parseBoolean(process.env.MOMO_PERSONAL_QR_ENABLED, false),
  momoPersonalQrImageUrl: process.env.MOMO_PERSONAL_QR_IMAGE_URL || '',
  momoPersonalQrImagePath: process.env.MOMO_PERSONAL_QR_IMAGE_PATH || 'uploads/payment/momo-qr.png',
  momoPersonalPhone: process.env.MOMO_PERSONAL_PHONE || '',
  momoPersonalAccountName: process.env.MOMO_PERSONAL_ACCOUNT_NAME || '',
  momoPersonalNotePrefix: process.env.MOMO_PERSONAL_NOTE_PREFIX || 'MEDCARE',
  aiProvider: process.env.AI_PROVIDER || 'local',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiFastModel: process.env.GEMINI_FAST_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiReasoningModel: process.env.GEMINI_REASONING_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiTimeoutMs: parsePositiveNumber(process.env.GEMINI_TIMEOUT_MS, 15000),
  geminiMaxRetries: parseNumber(process.env.GEMINI_MAX_RETRIES, 2),
  geminiRetryDelayMs: parsePositiveNumber(process.env.GEMINI_RETRY_DELAY_MS, 800),
  geminiTemperature: parseNumber(process.env.GEMINI_TEMPERATURE, 0.2),
  geminiTopP: parseNumber(process.env.GEMINI_TOP_P, 0.8),
  geminiTopK: parseNumber(process.env.GEMINI_TOP_K, 40),
  geminiMaxOutputTokens: parsePositiveNumber(process.env.GEMINI_MAX_OUTPUT_TOKENS, 2048),
  chatbot: {
    enabled: parseBoolean(process.env.CHATBOT_ENABLED, true),
    aiEnabled: parseBoolean(process.env.CHATBOT_AI_ENABLED, true),
    defaultLanguage: process.env.CHATBOT_DEFAULT_LANGUAGE || 'vi',
    supportedLanguages: parseList(process.env.CHATBOT_SUPPORTED_LANGUAGES || 'vi,en'),
    botDisplayName: process.env.CHATBOT_BOT_DISPLAY_NAME || 'Trợ lý tư vấn & đặt lịch',
    sessionTtlMinutes: parsePositiveNumber(process.env.CHATBOT_SESSION_TTL_MINUTES, 60),
    maxHistoryMessages: parsePositiveNumber(process.env.CHATBOT_MAX_HISTORY_MESSAGES, 12),
    saveMessages: parseBoolean(process.env.CHATBOT_SAVE_MESSAGES, true),
    saveAiTrace: parseBoolean(process.env.CHATBOT_SAVE_AI_TRACE, true),
    saveToolCalls: parseBoolean(process.env.CHATBOT_SAVE_TOOL_CALLS, true),
    saveFallbacks: parseBoolean(process.env.CHATBOT_SAVE_FALLBACKS, true),
    medicalSafetyEnabled: parseBoolean(process.env.CHATBOT_MEDICAL_SAFETY_ENABLED, true),
    medicalDisclaimerEnabled: parseBoolean(process.env.CHATBOT_MEDICAL_DISCLAIMER_ENABLED, true),
    emergencyDetectionEnabled: parseBoolean(process.env.CHATBOT_EMERGENCY_DETECTION_ENABLED, true),
    redFlagDetectionEnabled: parseBoolean(process.env.CHATBOT_RED_FLAG_DETECTION_ENABLED, true),
    blockDiagnosis: parseBoolean(process.env.CHATBOT_BLOCK_DIAGNOSIS, true),
    blockPrescription: parseBoolean(process.env.CHATBOT_BLOCK_PRESCRIPTION, true),
    blockDrugDosage: parseBoolean(process.env.CHATBOT_BLOCK_DRUG_DOSAGE, true),
    blockLabResultInterpretation: parseBoolean(process.env.CHATBOT_BLOCK_LAB_RESULT_INTERPRETATION, true),
    blockTreatmentPlan: parseBoolean(process.env.CHATBOT_BLOCK_TREATMENT_PLAN, true),
    blockStopMedicationAdvice: parseBoolean(process.env.CHATBOT_BLOCK_STOP_MEDICATION_ADVICE, true),
    allowMedicalAdvice: parseBoolean(process.env.CHATBOT_ALLOW_MEDICAL_ADVICE, false),
    allowDrugDosage: parseBoolean(process.env.CHATBOT_ALLOW_DRUG_DOSAGE, false),
    allowGeneralHealthEducation: parseBoolean(process.env.CHATBOT_ALLOW_GENERAL_HEALTH_EDUCATION, true),
    emergencyPhone: process.env.CHATBOT_EMERGENCY_PHONE || '115',
    emergencyHotline: process.env.CHATBOT_EMERGENCY_HOTLINE || process.env.EMERGENCY_HOTLINE || '',
    humanHandoffEnabled: parseBoolean(process.env.CHATBOT_HUMAN_HANDOFF_ENABLED, true),
    maxFallbackBeforeHandoff: parsePositiveNumber(process.env.CHATBOT_MAX_FALLBACK_BEFORE_HANDOFF, 2),
    handoffQueueDefault: process.env.CHATBOT_HANDOFF_QUEUE_DEFAULT || 'support_general',
    handoffQueueAppointment: process.env.CHATBOT_HANDOFF_QUEUE_APPOINTMENT || 'support_appointment',
    handoffQueueBilling: process.env.CHATBOT_HANDOFF_QUEUE_BILLING || 'support_billing',
    handoffQueueEmergency: process.env.CHATBOT_HANDOFF_QUEUE_EMERGENCY || 'support_emergency',
    handoffOutOfHoursCreateTicket: parseBoolean(process.env.CHATBOT_HANDOFF_OUT_OF_HOURS_CREATE_TICKET, true),
    handoffSummaryEnabled: parseBoolean(process.env.CHATBOT_HANDOFF_SUMMARY_ENABLED, true),
    handoffExpectedWaitMinutes: parsePositiveNumber(process.env.CHATBOT_HANDOFF_EXPECTED_WAIT_MINUTES, 5),
    requireLoginForPersonalData: parseBoolean(process.env.CHATBOT_REQUIRE_LOGIN_FOR_PERSONAL_DATA, true),
    requirePhoneVerificationForAppointmentLookup: parseBoolean(process.env.CHATBOT_REQUIRE_PHONE_VERIFICATION_FOR_APPOINTMENT_LOOKUP, true),
    maskPhoneInLogs: parseBoolean(process.env.CHATBOT_MASK_PHONE_IN_LOGS, true),
    maskEmailInLogs: parseBoolean(process.env.CHATBOT_MASK_EMAIL_IN_LOGS, true),
    maskPersonalIdInLogs: parseBoolean(process.env.CHATBOT_MASK_PERSONAL_ID_IN_LOGS, true),
    maskInsuranceIdInLogs: parseBoolean(process.env.CHATBOT_MASK_INSURANCE_ID_IN_LOGS, true),
    dataRetentionDays: parsePositiveNumber(process.env.CHATBOT_DATA_RETENTION_DAYS, 180),
    anonymousSessionRetentionDays: parsePositiveNumber(process.env.CHATBOT_ANONYMOUS_SESSION_RETENTION_DAYS, 30),
    allowedOrigins: parseList(process.env.CHATBOT_ALLOWED_ORIGINS || process.env.CORS_ORIGINS),
    corsStrict: parseBoolean(process.env.CHATBOT_CORS_STRICT, false),
    widgetTokenRequired: parseBoolean(process.env.CHATBOT_WIDGET_TOKEN_REQUIRED, false),
    widgetToken: process.env.CHATBOT_WIDGET_TOKEN || '',
    rateLimitEnabled: parseBoolean(process.env.CHATBOT_RATE_LIMIT_ENABLED, false),
    rateLimitWindowMs: parsePositiveNumber(process.env.CHATBOT_RATE_LIMIT_WINDOW_MS, 60000),
    rateLimitMaxMessages: parsePositiveNumber(process.env.CHATBOT_RATE_LIMIT_MAX_MESSAGES, 20),
    rateLimitMaxSessionsPerIp: parsePositiveNumber(process.env.CHATBOT_RATE_LIMIT_MAX_SESSIONS_PER_IP, 5),
    rateLimitMaxAiCallsPerSession: parsePositiveNumber(process.env.CHATBOT_RATE_LIMIT_MAX_AI_CALLS_PER_SESSION, 30),
    ragEnabled: parseBoolean(process.env.CHATBOT_RAG_ENABLED, false),
    requireSourceForFaq: parseBoolean(process.env.CHATBOT_REQUIRE_SOURCE_FOR_FAQ, false),
    kbTopK: parsePositiveNumber(process.env.CHATBOT_KB_TOP_K, 5),
    kbMinScore: parseNumber(process.env.CHATBOT_KB_MIN_SCORE, 0.72),
    kbMaxContextChars: parsePositiveNumber(process.env.CHATBOT_KB_MAX_CONTEXT_CHARS, 6000),
    kbAnswerOnlyFromSources: parseBoolean(process.env.CHATBOT_KB_ANSWER_ONLY_FROM_SOURCES, true),
    kbShowSourceToAdmin: parseBoolean(process.env.CHATBOT_KB_SHOW_SOURCE_TO_ADMIN, true),
    kbShowSourceToPatient: parseBoolean(process.env.CHATBOT_KB_SHOW_SOURCE_TO_PATIENT, false),
    vectorStoreProvider: process.env.VECTOR_STORE_PROVIDER || 'mongodb',
    vectorIndexName: process.env.VECTOR_INDEX_NAME || 'chatbot_knowledge_vector',
    appointmentBookingEnabled: parseBoolean(process.env.CHATBOT_APPOINTMENT_BOOKING_ENABLED, true),
    appointmentDraftTtlMinutes: parsePositiveNumber(process.env.CHATBOT_APPOINTMENT_DRAFT_TTL_MINUTES, 10),
    appointmentSlotHoldEnabled: parseBoolean(process.env.CHATBOT_APPOINTMENT_SLOT_HOLD_ENABLED, false),
    appointmentSlotHoldTtlMinutes: parsePositiveNumber(process.env.CHATBOT_APPOINTMENT_SLOT_HOLD_TTL_MINUTES, 5),
    appointmentConfirmationRequired: parseBoolean(process.env.CHATBOT_APPOINTMENT_CONFIRMATION_REQUIRED, true),
    appointmentAllowReschedule: parseBoolean(process.env.CHATBOT_APPOINTMENT_ALLOW_RESCHEDULE, false),
    appointmentAllowCancel: parseBoolean(process.env.CHATBOT_APPOINTMENT_ALLOW_CANCEL, false),
    appointmentCancelCutoffHours: parsePositiveNumber(process.env.CHATBOT_APPOINTMENT_CANCEL_CUTOFF_HOURS, 2),
    appointmentRequirePhone: parseBoolean(process.env.CHATBOT_APPOINTMENT_REQUIRE_PHONE, true),
    appointmentRequirePatientName: parseBoolean(process.env.CHATBOT_APPOINTMENT_REQUIRE_PATIENT_NAME, true),
    appointmentRequireDob: parseBoolean(process.env.CHATBOT_APPOINTMENT_REQUIRE_DOB, false),
    notifyAfterBooking: parseBoolean(process.env.CHATBOT_NOTIFY_AFTER_BOOKING, true),
    notifyChannels: parseList(process.env.CHATBOT_NOTIFY_CHANNELS || 'website'),
    reminder24hEnabled: parseBoolean(process.env.CHATBOT_REMINDER_24H_ENABLED, false),
    reminder2hEnabled: parseBoolean(process.env.CHATBOT_REMINDER_2H_ENABLED, false),
    sendCheckinQrEnabled: parseBoolean(process.env.CHATBOT_SEND_CHECKIN_QR_ENABLED, false),
    sendPaymentLinkEnabled: parseBoolean(process.env.CHATBOT_SEND_PAYMENT_LINK_ENABLED, false),
    sendPreparationGuideEnabled: parseBoolean(process.env.CHATBOT_SEND_PREPARATION_GUIDE_ENABLED, true),
    promptVersion: process.env.CHATBOT_PROMPT_VERSION || 'v1.0.0',
    promptStrictMode: parseBoolean(process.env.CHATBOT_PROMPT_STRICT_MODE, true),
    promptInjectionDetection: parseBoolean(process.env.CHATBOT_PROMPT_INJECTION_DETECTION, true),
    promptLogEnabled: parseBoolean(process.env.CHATBOT_PROMPT_LOG_ENABLED, true),
    promptAbTestEnabled: parseBoolean(process.env.CHATBOT_PROMPT_AB_TEST_ENABLED, false),
    metricsEnabled: parseBoolean(process.env.CHATBOT_METRICS_ENABLED, true),
    analyticsEnabled: parseBoolean(process.env.CHATBOT_ANALYTICS_ENABLED, true),
    auditLogEnabled: parseBoolean(process.env.CHATBOT_AUDIT_LOG_ENABLED, true),
    errorLogEnabled: parseBoolean(process.env.CHATBOT_ERROR_LOG_ENABLED, true),
    latencyLogEnabled: parseBoolean(process.env.CHATBOT_LATENCY_LOG_ENABLED, true),
    aiUsageLogEnabled: parseBoolean(process.env.CHATBOT_AI_USAGE_LOG_ENABLED, true),
    conversationQualityReviewEnabled: parseBoolean(process.env.CHATBOT_CONVERSATION_QUALITY_REVIEW_ENABLED, true),
  },
  superAdminUsername: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
  superAdminFullName: process.env.SUPER_ADMIN_FULL_NAME || 'System Super Admin',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || '',
};

validateConfig(env);

module.exports = env;
