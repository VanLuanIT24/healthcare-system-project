const {
  Appointment,
  Department,
  Dispense,
  DoctorSchedule,
  Encounter,
  ImagingOrder,
  ImagingReport,
  Invoice,
  LabOrder,
  LabResult,
  MedicalRecord,
  Notification,
  Patient,
  PatientAccount,
  PatientAuthorization,
  PatientRelative,
  Prescription,
  QueueTicket,
  Role,
  User,
  UserRole,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const permissionService = require('./permission.service');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const {
  INVOICE_STATUS,
  AUTHORIZATION_STATUS,
  AUTHORIZATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_RECIPIENT_TYPE,
  NOTIFICATION_RECIPIENT_TYPES,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_TYPES,
  PATIENT_ACCOUNT_STATUS,
  PATIENT_STATUS,
  RELATIVE_STATUS,
  ROLE_STATUS,
  USER_STATUS,
} = require('../constants/statuses');

const SENSITIVE_NOTIFICATION_FIELDS = new Set([
  'password',
  'password_hash',
  'token',
  'token_hash',
  'access_token',
  'refresh_token',
  'refresh_token_hash',
  'reset_token',
  'reset_token_hash',
  'reset_code',
  'reset_code_hash',
  'otp',
  'otp_code',
  'secret',
  'api_key',
  'apikey',
]);

const READABLE_STATUSES = [
  NOTIFICATION_STATUS.QUEUED,
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.DELIVERED,
  NOTIFICATION_STATUS.READ,
  NOTIFICATION_STATUS.FAILED,
];

const UNREAD_STATUSES = [
  NOTIFICATION_STATUS.QUEUED,
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.DELIVERED,
];

function normalizeString(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function sameId(left, right) {
  if (!left || !right) return false;
  return String(left?._id || left) === String(right?._id || right);
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions.filter(Boolean));
}

function isInternalActor(actor = {}) {
  return actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS);
}

function isRelativeActor(actor = {}) {
  return [ 'relative', 'patient_relative' ].includes(actorType(actor));
}

function isDuplicateKeyError(error) {
  return Boolean(error && (error.code === 11000 || error.code === 11001));
}

function sanitizeSensitivePayload(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value.toHexString === 'function') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value.map((item) => sanitizeSensitivePayload(item, seen));
    seen.delete(value);
    return items;
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = String(key || '').trim().toLowerCase();
    if (SENSITIVE_NOTIFICATION_FIELDS.has(normalized) || normalized.endsWith('_token') || normalized.endsWith('_secret') || normalized.includes('password')) {
      continue;
    }
    output[key] = sanitizeSensitivePayload(item, seen);
  }
  seen.delete(value);
  return output;
}

function buildFallbackDedupeKey(payload = {}, recipient = {}) {
  const notificationType = normalizeString(payload.notification_type) || NOTIFICATION_TYPE.SYSTEM;
  const recipientType = normalizeString(recipient.recipient_type || payload.recipient_type || 'system');
  const recipientId = normalizeString(recipient.recipient_id || payload.recipient_id);
  const entityType = normalizeString(payload.payload?.entity_type || payload.entity_type);
  const entityId = normalizeString(payload.payload?.entity_id || payload.entity_id);
  const channel = normalizeString(payload.channel) || NOTIFICATION_CHANNEL.IN_APP;
  return [notificationType, recipientType, recipientId, entityType, entityId, channel].filter(Boolean).join(':') || undefined;
}

async function hasActiveRelativeAuthorization(relativeId, patientId, authorizationType = AUTHORIZATION_TYPE.RECEIVE_NOTIFICATIONS, session = null) {
  if (!relativeId || !patientId) return false;
  const now = new Date();
  const allowedAuthorizationTypes = authorizationType === AUTHORIZATION_TYPE.RECEIVE_NOTIFICATIONS
    ? [AUTHORIZATION_TYPE.FULL_ACCESS, AUTHORIZATION_TYPE.RECEIVE_NOTIFICATIONS, AUTHORIZATION_TYPE.VIEW_RECORDS]
    : [AUTHORIZATION_TYPE.FULL_ACCESS, authorizationType];
  return Boolean(await withSession(PatientAuthorization.exists({
    patient_id: patientId,
    relative_id: relativeId,
    status: AUTHORIZATION_STATUS.ACTIVE,
    is_deleted: false,
    valid_from: { $lte: now },
    $and: [
      {
        $or: [
          { valid_to: null },
          { valid_to: { $exists: false } },
          { valid_to: { $gte: now } },
        ],
      },
      {
        $or: [
          { authorization_type: { $in: allowedAuthorizationTypes } },
          { permissions: authorizationType },
        ],
      },
    ],
  }), session));
}

function assertStaffAnyPermission(actor = {}, permissions = [], message = 'Bạn không có quyền thao tác notification.') {
  if (isInternalActor(actor)) return true;
  if (actorType(actor) !== 'staff') throw createError(message, 403);
  if (!hasAnyPermission(actor, permissions)) throw createError(message, 403);
  return true;
}

function internalActor(actor = {}, createdByModule = 'notifications') {
  return {
    ...actor,
    internal: true,
    createdByModule: actor.createdByModule || actor.created_by_module || createdByModule,
  };
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function formatVnd(amount) {
  const number = Number(amount || 0);
  return `${number.toLocaleString('vi-VN')} VND`;
}

function getActorRecipientFilter(actor = {}) {
  if (actorType(actor) === 'staff') {
    const userId = actor.userId || actor.user_id || actor.actorId || actor.actor_id;
    return {
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
      $or: [
        { recipient_id: userId },
        { recipient_user_id: userId },
      ],
    };
  }

  if (actorType(actor) === 'patient') {
    const accountId = actor.patientAccountId || actor.patient_account_id || actor.actorId || actor.actor_id;
    return {
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.PATIENT,
      $or: [
        { recipient_id: accountId },
        { patient_account_id: accountId },
      ],
    };
  }

  if (isRelativeActor(actor)) {
    const relativeId = actor.relativeId || actor.relative_id || actor.actorId || actor.actor_id;
    return {
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.RELATIVE,
      $or: [
        { recipient_id: relativeId },
        { relative_id: relativeId },
      ],
    };
  }

  throw createError('Loại tài khoản không hỗ trợ notification.', 403);
}

async function notificationBelongsToActor(notification, actor = {}, session = null) {
  if (actorType(actor) === 'staff') {
    const userId = actor.userId || actor.user_id || actor.actorId || actor.actor_id;
    return notification.recipient_type === NOTIFICATION_RECIPIENT_TYPE.STAFF
      && (sameId(notification.recipient_id, userId) || sameId(notification.recipient_user_id, userId));
  }

  if (actorType(actor) === 'patient') {
    const accountId = actor.patientAccountId || actor.patient_account_id || actor.actorId || actor.actor_id;
    return notification.recipient_type === NOTIFICATION_RECIPIENT_TYPE.PATIENT
      && (sameId(notification.recipient_id, accountId) || sameId(notification.patient_account_id, accountId));
  }

  if (isRelativeActor(actor)) {
    const relativeId = actor.relativeId || actor.relative_id || actor.actorId || actor.actor_id;
    if (notification.recipient_type !== NOTIFICATION_RECIPIENT_TYPE.RELATIVE) return false;
    if (!sameId(notification.recipient_id, relativeId) && !sameId(notification.relative_id, relativeId)) return false;
    if (!notification.patient_id) return true;
    return hasActiveRelativeAuthorization(relativeId, notification.patient_id, AUTHORIZATION_TYPE.RECEIVE_NOTIFICATIONS, session);
  }

  return false;
}

async function assertNotificationOwnership(notification, actor = {}, session = null) {
  if (isInternalActor(actor)) return true;
  if (await notificationBelongsToActor(notification, actor, session)) return true;
  if (actorType(actor) === 'staff' && hasAnyPermission(actor, [PERMISSION.NOTIFICATIONS.READ, PERMISSION.NOTIFICATIONS.MANAGE])) return true;
  throw createError('Bạn không có quyền truy cập notification này.', 403);
}

async function resolveActiveUser(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) throw createError('Không tìm thấy recipient staff.', 404);
  if (user.status !== USER_STATUS.ACTIVE) throw createError('Recipient staff không active.', 409);
  if (user.locked_until && user.locked_until > new Date()) throw createError('Recipient staff đang bị khóa.', 409);
  return user;
}

async function resolvePatientAccount(patientId) {
  if (!patientId) return null;
  return PatientAccount.findOne({
    patient_id: patientId,
    status: PATIENT_ACCOUNT_STATUS.ACTIVE,
    is_deleted: false,
  }).lean();
}

async function resolveActivePatientAccount(accountId) {
  const account = await PatientAccount.findById(accountId).lean();
  if (!account || account.is_deleted) throw createError('Không tìm thấy patient account.', 404);
  if (account.status !== PATIENT_ACCOUNT_STATUS.ACTIVE) throw createError('Patient account không active.', 409);
  if (account.locked_until && account.locked_until > new Date()) throw createError('Patient account đang bị khóa.', 409);
  const patient = await Patient.findById(account.patient_id).lean();
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy patient của account.', 404);
  if (patient.status !== PATIENT_STATUS.ACTIVE) throw createError('Patient không active.', 409);
  return { account, patient };
}

async function resolveActiveRelative(relativeId) {
  const relative = await PatientRelative.findById(relativeId).lean();
  if (!relative || relative.is_deleted) throw createError('Không tìm thấy patient relative.', 404);
  if (relative.status !== RELATIVE_STATUS.ACTIVE) throw createError('Patient relative không active.', 409);
  return relative;
}

async function resolveNotificationRecipient(input = {}) {
  const recipientType = normalizeString(input.recipient_type);

  if (input.recipient_user_id || recipientType === NOTIFICATION_RECIPIENT_TYPE.STAFF) {
    const userId = input.recipient_user_id || input.recipient_id;
    if (!userId) throw createError('recipient_user_id là bắt buộc với staff notification.', 400);
    const user = await resolveActiveUser(userId);
    return {
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
      recipient_id: user._id,
      recipient_user_id: user._id,
      patient_id: input.patient_id,
      department_id: user.department_id || undefined,
    };
  }

  if (input.patient_account_id || recipientType === NOTIFICATION_RECIPIENT_TYPE.PATIENT) {
    const accountId = input.patient_account_id || input.recipient_id;
    if (!accountId) throw createError('patient_account_id là bắt buộc với patient notification.', 400);
    const { account } = await resolveActivePatientAccount(accountId);
    if (input.patient_id && !sameId(input.patient_id, account.patient_id)) {
      throw createError('patient_id không khớp patient account.', 409);
    }
    return {
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.PATIENT,
      recipient_id: account._id,
      patient_account_id: account._id,
      patient_id: input.patient_id || account.patient_id,
    };
  }

  if (input.relative_id || recipientType === NOTIFICATION_RECIPIENT_TYPE.RELATIVE) {
    const relativeId = input.relative_id || input.recipient_id;
    if (!relativeId) throw createError('relative_id là bắt buộc với relative notification.', 400);
    const relative = await resolveActiveRelative(relativeId);
    const patientId = input.patient_id || relative.patient_id;
    if (input.patient_id && !sameId(input.patient_id, relative.patient_id)) {
      throw createError('patient_id không khớp relative.', 409);
    }
    const authorized = await hasActiveRelativeAuthorization(relative._id, patientId, AUTHORIZATION_TYPE.RECEIVE_NOTIFICATIONS);
    if (!authorized) throw createError('Relative không còn ủy quyền nhận notification cho patient này.', 403);
    return {
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.RELATIVE,
      recipient_id: relative._id,
      relative_id: relative._id,
      patient_id: patientId,
    };
  }

  if (recipientType === NOTIFICATION_RECIPIENT_TYPE.SYSTEM) {
    if (!input.recipient_id) throw createError('recipient_id là bắt buộc với system notification.', 400);
    return {
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.SYSTEM,
      recipient_id: input.recipient_id,
      patient_id: input.patient_id,
    };
  }

  throw createError('Notification phải có recipient hợp lệ.', 400);
}

function normalizeNotificationType(type) {
  const normalized = normalizeString(type) || NOTIFICATION_TYPE.SYSTEM;
  if (!NOTIFICATION_TYPES.includes(normalized)) return normalized;
  return normalized;
}

function normalizePriority(priority) {
  const normalized = normalizeString(priority) || NOTIFICATION_PRIORITY.NORMAL;
  if (!NOTIFICATION_PRIORITIES.includes(normalized)) throw createError('priority notification không hợp lệ.', 400);
  return normalized;
}

function normalizeChannel(channel) {
  const normalized = normalizeString(channel) || NOTIFICATION_CHANNEL.IN_APP;
  if (!NOTIFICATION_CHANNELS.includes(normalized)) throw createError('channel notification không hợp lệ.', 400);
  return normalized;
}

function buildActionUrl(type, payload = {}) {
  if (payload.route) return payload.route;
  const entityId = payload.entity_id || payload.appointment_id || payload.result_id || payload.report_id || payload.invoice_id;
  if (!entityId) return undefined;
  if (type?.startsWith('appointment.')) return `/appointments/${entityId}`;
  if (type?.startsWith('lab.')) return `/lab/results/${entityId}`;
  if (type?.startsWith('imaging.')) return `/imaging/reports/${entityId}`;
  if (type?.startsWith('invoice.') || type?.startsWith('payment.')) return `/billing/invoices/${entityId}`;
  if (type?.startsWith('dispense.')) return `/pharmacy/dispenses/${entityId}`;
  if (type?.startsWith('schedule.')) return `/schedules/${entityId}`;
  if (type?.startsWith('medical_record.')) return `/medical-records/${entityId}`;
  if (type?.startsWith('procedure_order.')) return `/procedures/orders/${entityId}`;
  return undefined;
}

function buildNotificationMessage(type, data = {}) {
  const patientName = data.patient_name || data.patientName || 'bệnh nhân';
  const appointmentTime = data.appointment_time ? new Date(data.appointment_time).toLocaleString('vi-VN') : '';
  const templates = {
    [NOTIFICATION_TYPE.APPOINTMENT_CONFIRMED]: {
      title: 'Lịch hẹn đã được xác nhận',
      message: appointmentTime ? `Lịch hẹn lúc ${appointmentTime} đã được xác nhận.` : 'Lịch hẹn của bạn đã được xác nhận.',
    },
    [NOTIFICATION_TYPE.APPOINTMENT_CANCELLED]: {
      title: 'Lịch hẹn đã bị hủy',
      message: 'Lịch hẹn đã được hủy. Vui lòng liên hệ bệnh viện nếu cần hỗ trợ.',
    },
    [NOTIFICATION_TYPE.PATIENT_CHECKED_IN]: {
      title: 'Bệnh nhân đã check-in',
      message: `${patientName} đã check-in và đang chờ khám.`,
    },
    [NOTIFICATION_TYPE.LAB_RESULT_FINAL]: {
      title: 'Có kết quả xét nghiệm mới',
      message: `Kết quả xét nghiệm ${data.result_no || ''} đã hoàn tất.`.trim(),
    },
    [NOTIFICATION_TYPE.LAB_RESULT_AMENDED]: {
      title: 'Kết quả xét nghiệm đã được cập nhật',
      message: `Kết quả xét nghiệm ${data.result_no || ''} đã được cập nhật.`.trim(),
    },
    [NOTIFICATION_TYPE.LAB_RESULT_CRITICAL]: {
      title: 'Có kết quả xét nghiệm critical',
      message: `Kết quả xét nghiệm ${data.result_no || ''} có cảnh báo critical.`.trim(),
    },
    [NOTIFICATION_TYPE.LAB_RESULT_RELEASED]: {
      title: 'Kết quả xét nghiệm đã sẵn sàng',
      message: 'Bạn có kết quả xét nghiệm mới. Vui lòng đăng nhập hệ thống để xem chi tiết.',
    },
    [NOTIFICATION_TYPE.IMAGING_REPORT_FINAL]: {
      title: 'Có kết quả chẩn đoán hình ảnh',
      message: `Báo cáo CĐHA ${data.report_no || ''} đã hoàn tất.`.trim(),
    },
    [NOTIFICATION_TYPE.IMAGING_REPORT_AMENDED]: {
      title: 'Kết quả CĐHA đã được cập nhật',
      message: `Báo cáo CĐHA ${data.report_no || ''} đã được cập nhật.`.trim(),
    },
    [NOTIFICATION_TYPE.IMAGING_REPORT_CRITICAL]: {
      title: 'Có kết quả CĐHA critical',
      message: `Báo cáo CĐHA ${data.report_no || ''} có cảnh báo critical.`.trim(),
    },
    [NOTIFICATION_TYPE.IMAGING_REPORT_RELEASED]: {
      title: 'Kết quả chẩn đoán hình ảnh đã sẵn sàng',
      message: 'Bạn có kết quả chẩn đoán hình ảnh mới. Vui lòng đăng nhập hệ thống để xem chi tiết.',
    },
    [NOTIFICATION_TYPE.INVOICE_UNPAID]: {
      title: 'Hóa đơn chưa thanh toán',
      message: `Hóa đơn ${data.invoice_no || ''} còn ${formatVnd(data.balance_due)}.`.trim(),
    },
    [NOTIFICATION_TYPE.DISPENSE_COMPLETED]: {
      title: 'Thuốc đã được cấp phát',
      message: `Phiếu cấp phát ${data.dispense_no || ''} đã hoàn tất.`.trim(),
    },
    [NOTIFICATION_TYPE.SCHEDULE_PUBLISHED]: {
      title: 'Lịch làm việc đã được publish',
      message: data.work_date ? `Lịch làm việc ngày ${new Date(data.work_date).toLocaleDateString('vi-VN')} đã được publish.` : 'Lịch làm việc mới đã được publish.',
    },
    [NOTIFICATION_TYPE.MEDICAL_RECORD_RELEASED]: {
      title: 'Hồ sơ bệnh án đã sẵn sàng',
      message: 'Một hồ sơ bệnh án đã được phát hành cho bạn.',
    },
  };
  const fallback = templates[type] || {
    title: data.title || 'Thông báo hệ thống',
    message: data.message || 'Bạn có thông báo mới.',
  };
  return {
    title: normalizeString(data.title) || fallback.title,
    message: normalizeString(data.message) || fallback.message,
  };
}

function buildNotificationDocument(payload, recipient, actor = {}) {
  const channel = normalizeChannel(payload.channel);
  const notificationType = normalizeNotificationType(payload.notification_type);
  const scheduledAt = parseDate(payload.scheduled_at, 'scheduled_at');
  const now = new Date();
  const isScheduledFuture = scheduledAt && scheduledAt > now;
  const initialStatus = payload.status
    || (channel === NOTIFICATION_CHANNEL.IN_APP && !isScheduledFuture ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.QUEUED);
  const message = buildNotificationMessage(notificationType, {
    ...sanitizeSensitivePayload(payload.template_data || {}),
    title: payload.title,
    message: payload.message,
  });
  const notificationPayload = sanitizeSensitivePayload(payload.payload || {});
  const dedupeKey = normalizeString(payload.dedupe_key) || buildFallbackDedupeKey({ ...payload, payload: notificationPayload }, recipient);

  if (!message.title || !message.message) throw createError('title và message là bắt buộc.', 400);

  return {
    ...recipient,
    channel,
    notification_type: notificationType,
    priority: normalizePriority(payload.priority),
    dedupe_key: dedupeKey,
    title: message.title,
    message: message.message,
    payload: notificationPayload,
    action_url: normalizeString(payload.action_url) || buildActionUrl(notificationType, notificationPayload),
    expires_at: parseDate(payload.expires_at, 'expires_at'),
    created_by_module: normalizeString(payload.created_by_module || actor.createdByModule || actor.created_by_module),
    scheduled_at: scheduledAt,
    status: initialStatus,
    sent_at: initialStatus === NOTIFICATION_STATUS.SENT ? now : payload.sent_at,
    delivered_at: initialStatus === NOTIFICATION_STATUS.SENT && channel === NOTIFICATION_CHANNEL.IN_APP ? now : payload.delivered_at,
    failed_at: initialStatus === NOTIFICATION_STATUS.FAILED ? now : undefined,
    failure_reason: normalizeString(payload.failure_reason),
    created_by: actor.userId,
    updated_by: actor.userId,
  };
}

function assertNotificationSenderScope(actor = {}, recipient = {}, payload = {}) {
  if (isInternalActor(actor) || hasPermission(actor, PERMISSION.NOTIFICATIONS.MANAGE)) return true;
  if (actorType(actor) !== 'staff') throw createError('Bạn không có quyền tạo notification.', 403);

  const actorDept = actorDepartmentId(actor);
  if (!actorDept) return true;

  const payloadDepartmentId = payload.department_id || payload.payload?.department_id || recipient.department_id;
  if (payloadDepartmentId && !sameId(payloadDepartmentId, actorDept)) {
    throw createError('Bạn không có quyền gửi notification cho department này.', 403);
  }

  if (recipient.recipient_type === NOTIFICATION_RECIPIENT_TYPE.STAFF && recipient.department_id && !sameId(recipient.department_id, actorDept)) {
    throw createError('Bạn không có quyền gửi notification cho staff department khác.', 403);
  }

  return true;
}

async function createNotification(payload = {}, actor = {}, requestMeta = {}, options = {}) {
  if (!isInternalActor(actor)) {
    assertStaffAnyPermission(actor, [
      PERMISSION.NOTIFICATIONS.CREATE,
      PERMISSION.NOTIFICATIONS.CREATE_SYSTEM,
      PERMISSION.NOTIFICATIONS.MANAGE,
    ]);
  }

  const recipient = await resolveNotificationRecipient(payload);
  assertNotificationSenderScope(actor, recipient, payload);
  const notificationDoc = buildNotificationDocument(payload, recipient, actor);
  let idempotent = false;
  if (notificationDoc.dedupe_key) {
    const existing = await Notification.findOne({ dedupe_key: notificationDoc.dedupe_key }).lean();
    if (existing) {
      idempotent = true;
      if (!options.skipAudit) {
        await recordAuditLog({
          actor,
          action: 'notification.created',
          targetType: 'notification',
          targetId: existing._id,
          status: 'success',
          message: 'Tạo notification thành công (idempotent).',
          requestMeta,
          metadata: {
            notification_type: existing.notification_type,
            channel: existing.channel,
            recipient_type: existing.recipient_type,
            idempotent: true,
          },
        });
      }
      if (normalizeBoolean(payload.send_immediately) && existing.status === NOTIFICATION_STATUS.QUEUED) {
        const dispatched = await dispatchNotification(existing._id, internalActor(actor, existing.created_by_module), requestMeta);
        Object.defineProperty(dispatched, '__idempotent', { value: true, enumerable: false });
        return dispatched;
      }
      const result = { ...existing };
      Object.defineProperty(result, '__idempotent', { value: true, enumerable: false });
      return result;
    }
  }

  let notification;
  try {
    notification = await Notification.create(notificationDoc);
  } catch (error) {
    if (!isDuplicateKeyError(error) || !notificationDoc.dedupe_key) throw error;
    const existing = await Notification.findOne({ dedupe_key: notificationDoc.dedupe_key }).lean();
    if (!existing) throw error;
    idempotent = true;
    if (!options.skipAudit) {
      await recordAuditLog({
        actor,
        action: 'notification.created',
        targetType: 'notification',
        targetId: existing._id,
        status: 'success',
        message: 'Tạo notification thành công (idempotent).',
        requestMeta,
        metadata: {
          notification_type: existing.notification_type,
          channel: existing.channel,
          recipient_type: existing.recipient_type,
          idempotent: true,
        },
      });
    }
    notification = existing;
  }

  if (!options.skipAudit) {
    await recordAuditLog({
      actor,
      action: 'notification.created',
      targetType: 'notification',
      targetId: notification._id,
      status: 'success',
      message: 'Tạo notification thành công.',
      requestMeta,
      metadata: {
        notification_type: notification.notification_type,
        channel: notification.channel,
        recipient_type: notification.recipient_type,
        idempotent: false,
      },
    });
  }

  if (normalizeBoolean(payload.send_immediately) && notification.status === NOTIFICATION_STATUS.QUEUED) {
    const dispatched = await dispatchNotification(notification._id, internalActor(actor, notification.created_by_module), requestMeta);
    Object.defineProperty(dispatched, '__idempotent', { value: idempotent, enumerable: false });
    return dispatched;
  }

  const result = notification.toObject ? notification.toObject() : { ...notification };
  Object.defineProperty(result, '__idempotent', { value: idempotent, enumerable: false });
  return result;
}

async function createBulkNotifications(recipients = [], payload = {}, actor = {}, requestMeta = {}) {
  if (!isInternalActor(actor)) {
    assertStaffAnyPermission(actor, [
      PERMISSION.NOTIFICATIONS.CREATE,
      PERMISSION.NOTIFICATIONS.CREATE_SYSTEM,
      PERMISSION.NOTIFICATIONS.BROADCAST,
      PERMISSION.NOTIFICATIONS.MANAGE,
    ]);
  }
  if (!Array.isArray(recipients) || recipients.length === 0) throw createError('recipients không được rỗng.', 400);

  const seen = new Set();
  const created = [];
  let createdCount = 0;
  let skippedDedupeCount = 0;
  for (const recipientPayload of recipients) {
    const recipient = await resolveNotificationRecipient(recipientPayload);
    const key = `${recipient.recipient_type}:${recipient.recipient_id}`;
    if (seen.has(key)) {
      skippedDedupeCount += 1;
      continue;
    }
    seen.add(key);
    const baseDedupeKey = normalizeString(payload.dedupe_key);
    const result = await createNotification({
      ...payload,
      ...recipientPayload.payload_overrides,
      recipient_type: recipient.recipient_type,
      recipient_id: recipient.recipient_id,
      recipient_user_id: recipient.recipient_user_id,
      patient_account_id: recipient.patient_account_id,
      relative_id: recipient.relative_id,
      patient_id: recipient.patient_id,
      dedupe_key: baseDedupeKey ? `${baseDedupeKey}:${key}` : normalizeString(recipientPayload.dedupe_key),
    }, actor, requestMeta, { skipAudit: true });
    created.push(result);
    if (result.__idempotent) skippedDedupeCount += 1;
    else createdCount += 1;
  }
  await recordAuditLog({
    actor,
    action: 'notification.bulk_created',
    targetType: 'notification',
    status: 'success',
    message: 'Tạo bulk notifications thành công.',
    requestMeta,
    metadata: { created_count: createdCount, skipped_dedupe_count: skippedDedupeCount },
  });
  return {
    created_count: createdCount,
    skipped_dedupe_count: skippedDedupeCount,
    notification_ids: created.map((item) => String(item._id)),
  };
}

function applyNotificationQueryFilters(filter, query = {}) {
  for (const field of ['status', 'channel', 'notification_type', 'priority', 'patient_id']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.unread_only === true || query.unread_only === 'true') {
    filter.status = { $in: UNREAD_STATUSES };
    filter.read_at = null;
  }
  if (query.search) {
    const pattern = escapeRegex(query.search);
    const searchFilter = [
      { title: { $regex: pattern, $options: 'i' } },
      { message: { $regex: pattern, $options: 'i' } },
    ];
    if (filter.$or) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: filter.$or }, { $or: searchFilter });
      delete filter.$or;
    } else {
      filter.$or = searchFilter;
    }
  }
  if (query.date_from || query.date_to) {
    filter.created_at = {};
    const from = parseDate(query.date_from, 'date_from');
    const to = parseDate(query.date_to, 'date_to');
    if (from) filter.created_at.$gte = from;
    if (to) filter.created_at.$lte = to;
  }
  return filter;
}

async function getMyNotifications(query = {}, actor = {}) {
  if (actorType(actor) === 'patient') {
    if (!hasPermission(actor, PERMISSION.NOTIFICATIONS.SELF_READ)) throw createError('Patient không có quyền xem notifications.', 403);
  } else if (isRelativeActor(actor)) {
    if (!hasPermission(actor, PERMISSION.NOTIFICATIONS.RELATIVE_READ)) throw createError('Người nhà không có quyền xem notifications.', 403);
  } else {
    assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.READ_OWN, PERMISSION.NOTIFICATIONS.READ, PERMISSION.NOTIFICATIONS.MARK_READ]);
  }
  const { page, limit, skip } = getPagination(query);
  const filter = applyNotificationQueryFilters(getActorRecipientFilter(actor), query);
  if (!query.status && !normalizeBoolean(query.unread_only)) filter.status = { $in: READABLE_STATUSES };
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getNotificationDetail(notificationId, actor = {}) {
  const notification = await Notification.findById(notificationId).lean();
  if (!notification) throw createError('Không tìm thấy notification.', 404);
  await assertNotificationOwnership(notification, actor);
  return notification;
}

async function getUnreadCount(actor = {}) {
  if (actorType(actor) === 'patient') {
    if (!hasPermission(actor, PERMISSION.NOTIFICATIONS.SELF_READ)) throw createError('Patient không có quyền xem notifications.', 403);
  } else if (isRelativeActor(actor)) {
    if (!hasPermission(actor, PERMISSION.NOTIFICATIONS.RELATIVE_READ)) throw createError('Người nhà không có quyền xem notifications.', 403);
  } else {
    assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.READ_OWN, PERMISSION.NOTIFICATIONS.READ, PERMISSION.NOTIFICATIONS.MARK_READ]);
  }
  const filter = {
    ...getActorRecipientFilter(actor),
    status: { $in: UNREAD_STATUSES },
    read_at: null,
  };
  const unread_count = await Notification.countDocuments(filter);
  return { unread_count };
}

async function markNotificationRead(notificationId, actor = {}, requestMeta = {}) {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw createError('Không tìm thấy notification.', 404);
  await assertNotificationOwnership(notification, actor);
  if (actorType(actor) === 'patient') {
    if (!hasPermission(actor, PERMISSION.NOTIFICATIONS.SELF_MARK_READ)) throw createError('Patient không có quyền mark read.', 403);
  } else if (isRelativeActor(actor)) {
    if (!hasPermission(actor, PERMISSION.NOTIFICATIONS.RELATIVE_READ)) throw createError('Người nhà không có quyền mark read.', 403);
  } else {
    assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.MARK_READ, PERMISSION.NOTIFICATIONS.READ_OWN]);
  }
  if ([NOTIFICATION_STATUS.FAILED, NOTIFICATION_STATUS.CANCELLED].includes(notification.status)) {
    throw createError('Không mark read notification failed/cancelled.', 409);
  }
  if (notification.status !== NOTIFICATION_STATUS.READ || !notification.read_at) {
    notification.status = NOTIFICATION_STATUS.READ;
    notification.read_at = new Date();
    notification.updated_by = actor.userId;
    await notification.save();
    await recordAuditLog({
      actor,
      action: 'notification.read',
      targetType: 'notification',
      targetId: notification._id,
      status: 'success',
      message: 'Notification đã được đánh dấu read.',
      requestMeta,
    });
  }
  return notification.toObject ? notification.toObject() : notification;
}

async function markAllNotificationsRead(actor = {}, query = {}, requestMeta = {}) {
  if (actorType(actor) === 'patient') {
    if (!hasPermission(actor, PERMISSION.NOTIFICATIONS.SELF_MARK_ALL_READ)) throw createError('Patient không có quyền mark all read.', 403);
  } else if (isRelativeActor(actor)) {
    if (!hasPermission(actor, PERMISSION.NOTIFICATIONS.RELATIVE_READ)) throw createError('Người nhà không có quyền mark all read.', 403);
  } else {
    assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.MARK_ALL_READ, PERMISSION.NOTIFICATIONS.READ_OWN]);
  }
  const filter = {
    ...getActorRecipientFilter(actor),
    status: { $in: UNREAD_STATUSES },
    read_at: null,
  };
  if (query.channel) filter.channel = query.channel;
  if (query.notification_type) filter.notification_type = query.notification_type;
  if (query.created_before) filter.created_at = { $lte: parseDate(query.created_before, 'created_before') };
  const now = new Date();
  const result = await Notification.updateMany(filter, {
    $set: {
      status: NOTIFICATION_STATUS.READ,
      read_at: now,
      updated_by: actor.userId,
    },
  });
  await recordAuditLog({
    actor,
    action: 'notification.read_all',
    targetType: 'notification',
    status: 'success',
    message: 'Mark all notifications read thành công.',
    requestMeta,
    metadata: { modified_count: result.modifiedCount || 0 },
  });
  return { modified_count: result.modifiedCount || 0 };
}

async function listNotifications(query = {}, actor = {}) {
  assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.READ, PERMISSION.NOTIFICATIONS.MANAGE]);
  const { page, limit, skip } = getPagination(query);
  const filter = applyNotificationQueryFilters({}, query);
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listFailedNotifications(query = {}, actor = {}) {
  assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.READ_FAILED, PERMISSION.NOTIFICATIONS.MANAGE]);
  return listNotifications({ ...query, status: NOTIFICATION_STATUS.FAILED }, { ...actor, permissions: [...(actor.permissions || []), PERMISSION.NOTIFICATIONS.READ] });
}

async function cancelNotification(notificationId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.CANCEL, PERMISSION.NOTIFICATIONS.MANAGE]);
  const notification = await Notification.findById(notificationId);
  if (!notification) throw createError('Không tìm thấy notification.', 404);
  if (![NOTIFICATION_STATUS.QUEUED, NOTIFICATION_STATUS.FAILED].includes(notification.status)) {
    throw createError('Chỉ queued/failed notification mới được cancel.', 409);
  }
  notification.status = NOTIFICATION_STATUS.CANCELLED;
  notification.failure_reason = normalizeString(payload.reason || payload.cancel_reason);
  notification.updated_by = actor.userId;
  await notification.save();
  await recordAuditLog({
    actor,
    action: 'notification.cancelled',
    targetType: 'notification',
    targetId: notification._id,
    status: 'success',
    message: 'Cancel notification thành công.',
    requestMeta,
    metadata: { reason: notification.failure_reason },
  });
  return notification.toObject ? notification.toObject() : notification;
}

async function dispatchNotification(notificationId, actor = {}, requestMeta = {}) {
  if (!isInternalActor(actor)) assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.DISPATCH, PERMISSION.NOTIFICATIONS.MANAGE]);
  const now = new Date();
  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      status: { $in: [NOTIFICATION_STATUS.QUEUED, NOTIFICATION_STATUS.FAILED] },
      $or: [
        { scheduled_at: null },
        { scheduled_at: { $exists: false } },
        { scheduled_at: { $lte: now } },
      ],
    },
    {
      $set: {
        status: NOTIFICATION_STATUS.SENT,
        sent_at: now,
        updated_by: actor.userId,
      },
      $unset: {
        failed_at: '',
        failure_reason: '',
      },
    },
    { new: true },
  );
  if (!notification) {
    const existing = await Notification.findById(notificationId).lean();
    if (!existing) throw createError('Không tìm thấy notification.', 404);
    if (existing.scheduled_at && existing.scheduled_at > now) {
      return { skipped: true, reason: 'scheduled_in_future', notification: existing };
    }
    if (![NOTIFICATION_STATUS.QUEUED, NOTIFICATION_STATUS.FAILED].includes(existing.status)) {
      throw createError('Chỉ queued/failed notification mới dispatch được.', 409);
    }
    return { skipped: true, reason: 'already_claimed', notification: existing };
  }

  try {
    if (notification.channel !== NOTIFICATION_CHANNEL.IN_APP) {
      throw new Error(`Provider cho channel ${notification.channel} chưa được cấu hình.`);
    }
    await Notification.updateOne(
      { _id: notification._id, status: NOTIFICATION_STATUS.SENT },
      {
        $set: {
          status: NOTIFICATION_STATUS.DELIVERED,
          delivered_at: new Date(),
          updated_by: actor.userId,
        },
        $unset: {
          failed_at: '',
          failure_reason: '',
        },
      },
    );
    notification.status = NOTIFICATION_STATUS.DELIVERED;
    notification.delivered_at = new Date();
    await recordAuditLog({
      actor,
      action: 'notification.dispatched',
      targetType: 'notification',
      targetId: notification._id,
      status: 'success',
      message: 'Dispatch notification thành công.',
      requestMeta,
      metadata: { channel: notification.channel },
    });
    return notification.toObject ? notification.toObject() : notification;
  } catch (error) {
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: NOTIFICATION_STATUS.FAILED,
          failed_at: new Date(),
          failure_reason: error.message,
          updated_by: actor.userId,
        },
        $unset: {
          delivered_at: '',
        },
      },
    );
    notification.status = NOTIFICATION_STATUS.FAILED;
    notification.failed_at = new Date();
    notification.failure_reason = error.message;
    await recordAuditLog({
      actor,
      action: 'notification.dispatch_failed',
      targetType: 'notification',
      targetId: notification._id,
      status: 'failed',
      message: 'Dispatch notification thất bại.',
      requestMeta,
      metadata: { channel: notification.channel, reason: error.message },
    });
    return notification.toObject ? notification.toObject() : notification;
  }
}

async function dispatchQueuedNotifications(limit = 50, actor = {}) {
  if (!isInternalActor(actor)) assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.DISPATCH, PERMISSION.NOTIFICATIONS.MANAGE]);
  const notifications = await Notification.find({
    status: NOTIFICATION_STATUS.QUEUED,
    $or: [
      { scheduled_at: null },
      { scheduled_at: { $lte: new Date() } },
      { scheduled_at: { $exists: false } },
    ],
  }).sort({ priority: -1, scheduled_at: 1, created_at: 1 }).limit(Number(limit) || 50).lean();
  let success_count = 0;
  let failed_count = 0;
  const notification_ids = [];
  for (const notification of notifications) {
    try {
      const dispatched = await dispatchNotification(notification._id, internalActor(actor, 'notifications.dispatcher'));
      if (dispatched?.skipped) continue;
      notification_ids.push(String(notification._id));
      if (dispatched?.status === NOTIFICATION_STATUS.FAILED) failed_count += 1;
      else success_count += 1;
    } catch (error) {
      if (error.statusCode === 409) continue;
      throw error;
    }
  }
  return { success_count, failed_count, notification_ids };
}

async function retryFailedNotification(notificationId, actor = {}, requestMeta = {}) {
  assertStaffAnyPermission(actor, [PERMISSION.NOTIFICATIONS.RETRY, PERMISSION.NOTIFICATIONS.MANAGE]);
  const notification = await Notification.findById(notificationId);
  if (!notification) throw createError('Không tìm thấy notification.', 404);
  if (notification.status !== NOTIFICATION_STATUS.FAILED) throw createError('Chỉ failed notification mới retry được.', 409);
  notification.status = NOTIFICATION_STATUS.QUEUED;
  notification.sent_at = undefined;
  notification.delivered_at = undefined;
  notification.failed_at = undefined;
  notification.failure_reason = undefined;
  notification.updated_by = actor.userId;
  await notification.save();
  await recordAuditLog({
    actor,
    action: 'notification.retry_queued',
    targetType: 'notification',
    targetId: notification._id,
    status: 'success',
    message: 'Retry notification đã đưa về queued.',
    requestMeta,
  });
  return notification.toObject ? notification.toObject() : notification;
}

async function resolveDoctorForEncounter(encounterId) {
  if (!encounterId) return null;
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter?.attending_doctor_id) return null;
  return resolveActiveUser(encounter.attending_doctor_id);
}

async function resolveStaffByRole(roleCode, departmentId = null) {
  const role = await Role.findOne({ role_code: roleCode, status: ROLE_STATUS.ACTIVE, is_deleted: false }).lean();
  if (!role) return [];
  const userRoles = await UserRole.find({ role_id: role._id, is_active: true }).select('user_id').lean();
  const userIds = userRoles.map((item) => item.user_id);
  if (userIds.length === 0) return [];
  return User.find({
    _id: { $in: userIds },
    status: USER_STATUS.ACTIVE,
    is_deleted: false,
    ...(departmentId ? { department_id: departmentId } : {}),
  }).lean();
}

async function resolveDepartmentHead(departmentId) {
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted) return null;
  if (department.head_user_id) {
    try {
      return await resolveActiveUser(department.head_user_id);
    } catch (_) {
      return null;
    }
  }
  const [head] = await resolveStaffByRole(ROLE_CODE.DEPARTMENT_HEAD, departmentId);
  return head || null;
}

async function resolveAuthorizedRelativeRecipients(patientId, authorizationType = AUTHORIZATION_TYPE.RECEIVE_NOTIFICATIONS) {
  if (!patientId) return [];
  const now = new Date();
  const authorizations = await PatientAuthorization.find({
    patient_id: patientId,
    status: AUTHORIZATION_STATUS.ACTIVE,
    is_deleted: false,
    valid_from: { $lte: now },
    $and: [
      {
        $or: [
          { valid_to: null },
          { valid_to: { $exists: false } },
          { valid_to: { $gte: now } },
        ],
      },
      {
        $or: [
          { authorization_type: AUTHORIZATION_TYPE.FULL_ACCESS },
          { authorization_type: authorizationType },
          { authorization_type: AUTHORIZATION_TYPE.VIEW_RECORDS },
          { permissions: authorizationType },
        ],
      },
    ],
  }).populate('relative_id').lean();
  return authorizations
    .map((authorization) => authorization.relative_id)
    .filter((relative) => relative && !relative.is_deleted && relative.status === RELATIVE_STATUS.ACTIVE);
}

async function createRelativeNotification(relativeId, payload, actor = {}) {
  if (!relativeId) return null;
  const relative = await PatientRelative.findById(relativeId).lean();
  if (!relative || relative.is_deleted || relative.status !== RELATIVE_STATUS.ACTIVE) return null;
  try {
    return await createNotification({
      ...payload,
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.RELATIVE,
      relative_id: relative._id,
      patient_id: payload.patient_id || relative.patient_id,
    }, internalActor(actor, payload.created_by_module || 'notifications'));
  } catch (error) {
    return null;
  }
}

async function createPatientNotification(patientId, payload, actor = {}) {
  const account = await resolvePatientAccount(patientId);
  if (!account) return null;
  try {
    return await createNotification({
      ...payload,
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.PATIENT,
      patient_account_id: account._id,
      patient_id: patientId,
    }, internalActor(actor, payload.created_by_module || 'notifications'));
  } catch (error) {
    return null;
  }
}

async function createStaffNotification(userId, payload, actor = {}) {
  if (!userId) return null;
  try {
    return await createNotification({
      ...payload,
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
      recipient_user_id: userId,
    }, internalActor(actor, payload.created_by_module || 'notifications'));
  } catch (error) {
    return null;
  }
}

async function notifyAppointmentConfirmed(appointmentId, actor = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) return null;
  const patient = await Patient.findById(appointment.patient_id).lean();
  const patientNotification = await createPatientNotification(appointment.patient_id, {
    notification_type: NOTIFICATION_TYPE.APPOINTMENT_CONFIRMED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: `appointment.confirmed:${appointment._id}:patient`,
    template_data: {
      appointment_time: appointment.appointment_time,
      patient_name: patient?.full_name,
    },
    payload: {
      entity_type: 'appointment',
      entity_id: String(appointment._id),
      appointment_id: String(appointment._id),
      patient_id: String(appointment.patient_id),
      doctor_id: String(appointment.doctor_id),
      route: `/appointments/${appointment._id}`,
      action: 'view_appointment',
    },
    created_by_module: 'appointments',
  }, actor);
  const doctorNotification = appointment.doctor_id
    ? await createStaffNotification(appointment.doctor_id, {
      notification_type: NOTIFICATION_TYPE.APPOINTMENT_CONFIRMED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      dedupe_key: `appointment.confirmed:${appointment._id}:doctor:${appointment.doctor_id}`,
      payload: {
        entity_type: 'appointment',
        entity_id: String(appointment._id),
        appointment_id: String(appointment._id),
        patient_id: String(appointment.patient_id),
        route: `/appointments/${appointment._id}`,
        action: 'view_appointment',
      },
      created_by_module: 'appointments',
    }, actor)
    : null;
  return { patient_notification: patientNotification, doctor_notification: doctorNotification };
}

async function notifyAppointmentCancelled(appointmentId, reason = null, actor = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) return null;
  const patientNotification = await createPatientNotification(appointment.patient_id, {
    notification_type: NOTIFICATION_TYPE.APPOINTMENT_CANCELLED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    dedupe_key: `appointment.cancelled:${appointment._id}:patient`,
    payload: {
      entity_type: 'appointment',
      entity_id: String(appointment._id),
      appointment_id: String(appointment._id),
      patient_id: String(appointment.patient_id),
      doctor_id: String(appointment.doctor_id),
      cancel_reason: reason,
      route: `/appointments/${appointment._id}`,
      action: 'view_appointment',
    },
    created_by_module: 'appointments',
  }, actor);
  const doctorNotification = await createStaffNotification(appointment.doctor_id, {
    notification_type: NOTIFICATION_TYPE.APPOINTMENT_CANCELLED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: `appointment.cancelled:${appointment._id}:doctor:${appointment.doctor_id}`,
    title: 'Lịch hẹn đã bị hủy',
    message: `Lịch hẹn ${appointment._id} đã bị hủy.`,
    payload: {
      entity_type: 'appointment',
      entity_id: String(appointment._id),
      appointment_id: String(appointment._id),
      patient_id: String(appointment.patient_id),
      reason,
      route: `/appointments/${appointment._id}`,
      action: 'view_appointment',
    },
    created_by_module: 'appointments',
  }, actor);
  return { patient_notification: patientNotification, doctor_notification: doctorNotification };
}

async function notifyPatientCheckedInToDoctor(referenceId, actor = {}, options = {}) {
  const queueTicket = options.queue_ticket_id || options.queueTicketId
    ? await QueueTicket.findById(options.queue_ticket_id || options.queueTicketId).lean()
    : await QueueTicket.findOne({ $or: [{ _id: referenceId }, { appointment_id: referenceId }] }).sort({ created_at: -1 }).lean();
  const appointment = queueTicket?.appointment_id
    ? await Appointment.findById(queueTicket.appointment_id).lean()
    : await Appointment.findById(referenceId).lean();
  const doctorId = queueTicket?.doctor_id || appointment?.doctor_id;
  if (!doctorId) return null;
  const patientId = queueTicket?.patient_id || appointment?.patient_id;
  const patient = patientId ? await Patient.findById(patientId).lean() : null;
  const departmentHead = queueTicket?.department_id ? await resolveDepartmentHead(queueTicket.department_id) : null;
  const departmentNotification = departmentHead && !sameId(departmentHead._id, doctorId)
    ? await createStaffNotification(departmentHead._id, {
      notification_type: NOTIFICATION_TYPE.PATIENT_CHECKED_IN,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      dedupe_key: `patient.checked_in:${queueTicket?._id || appointment?._id}:department:${queueTicket.department_id}`,
      template_data: { patient_name: patient?.full_name },
      payload: {
        entity_type: queueTicket ? 'queue_ticket' : 'appointment',
        entity_id: String(queueTicket?._id || appointment?._id || referenceId),
        department_id: queueTicket.department_id ? String(queueTicket.department_id) : undefined,
        patient_id: patientId ? String(patientId) : undefined,
        route: queueTicket ? `/queue/${queueTicket._id}` : `/appointments/${appointment?._id || referenceId}`,
        action: 'view_queue',
      },
      created_by_module: 'queue',
    }, actor)
    : null;
  const doctorNotification = await createStaffNotification(doctorId, {
    notification_type: NOTIFICATION_TYPE.PATIENT_CHECKED_IN,
    priority: NOTIFICATION_PRIORITY.HIGH,
    dedupe_key: `patient.checked_in:${queueTicket?._id || appointment?._id}:doctor:${doctorId}`,
    template_data: { patient_name: patient?.full_name },
    payload: {
      entity_type: queueTicket ? 'queue_ticket' : 'appointment',
      entity_id: String(queueTicket?._id || appointment?._id || referenceId),
      appointment_id: appointment?._id ? String(appointment._id) : undefined,
      queue_ticket_id: queueTicket?._id ? String(queueTicket._id) : undefined,
      encounter_id: queueTicket?.encounter_id ? String(queueTicket.encounter_id) : undefined,
      patient_id: patientId ? String(patientId) : undefined,
      route: queueTicket ? `/queue/${queueTicket._id}` : `/appointments/${appointment?._id || referenceId}`,
      action: 'view_queue',
    },
    created_by_module: 'queue',
  }, actor);
  return { doctor_notification: doctorNotification, department_notification: departmentNotification };
}

async function notifyLabResultFinal(resultId, actor = {}, options = {}) {
  const result = await LabResult.findById(resultId).lean();
  if (!result) return null;
  const labOrder = await LabOrder.findById(result.lab_order_id).lean();
  if (!labOrder) return null;
  const encounter = labOrder.encounter_id ? await Encounter.findById(labOrder.encounter_id).lean() : null;
  const doctorId = labOrder.ordered_by || encounter?.attending_doctor_id;
  const type = options.critical
    ? NOTIFICATION_TYPE.LAB_RESULT_CRITICAL
    : options.amended ? NOTIFICATION_TYPE.LAB_RESULT_AMENDED : NOTIFICATION_TYPE.LAB_RESULT_FINAL;
  const staffNotification = options.patient_only ? null : await createStaffNotification(doctorId, {
    notification_type: type,
    priority: options.critical ? NOTIFICATION_PRIORITY.CRITICAL : NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: `${type}:${result._id}:doctor:${doctorId}`,
    template_data: { result_no: result.result_no },
    payload: {
      entity_type: 'lab_result',
      entity_id: String(result._id),
      result_id: String(result._id),
      lab_order_id: String(labOrder._id),
      encounter_id: labOrder.encounter_id ? String(labOrder.encounter_id) : undefined,
      patient_id: String(labOrder.patient_id),
      critical: Boolean(options.critical),
      route: `/lab/results/${result._id}`,
      action: 'view_lab_result',
    },
    created_by_module: 'laboratory',
  }, actor);
  const patientNotification = result.released_to_patient
    ? await createPatientNotification(result.patient_id, {
      notification_type: NOTIFICATION_TYPE.LAB_RESULT_RELEASED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      dedupe_key: `lab.result_released:${result._id}:patient`,
      payload: {
        entity_type: 'lab_result',
        entity_id: String(result._id),
        result_id: String(result._id),
        route: `/lab/results/${result._id}`,
        action: 'view_lab_result',
      },
      created_by_module: 'laboratory',
    }, actor)
    : null;
  return { staff_notification: staffNotification, patient_notification: patientNotification };
}

async function notifyImagingReportFinal(reportId, actor = {}, options = {}) {
  const report = await ImagingReport.findById(reportId).lean();
  if (!report) return null;
  const imagingOrder = await ImagingOrder.findById(report.imaging_order_id).lean();
  if (!imagingOrder) return null;
  const encounter = imagingOrder.encounter_id ? await Encounter.findById(imagingOrder.encounter_id).lean() : null;
  const doctorId = imagingOrder.ordered_by || encounter?.attending_doctor_id;
  const type = options.critical
    ? NOTIFICATION_TYPE.IMAGING_REPORT_CRITICAL
    : options.amended ? NOTIFICATION_TYPE.IMAGING_REPORT_AMENDED : NOTIFICATION_TYPE.IMAGING_REPORT_FINAL;
  const staffNotification = options.patient_only ? null : await createStaffNotification(doctorId, {
    notification_type: type,
    priority: options.critical ? NOTIFICATION_PRIORITY.CRITICAL : NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: `${type}:${report._id}:doctor:${doctorId}`,
    template_data: { report_no: report.report_no },
    payload: {
      entity_type: 'imaging_report',
      entity_id: String(report._id),
      report_id: String(report._id),
      imaging_order_id: String(imagingOrder._id),
      encounter_id: imagingOrder.encounter_id ? String(imagingOrder.encounter_id) : undefined,
      patient_id: String(imagingOrder.patient_id),
      critical: Boolean(options.critical),
      route: `/imaging/reports/${report._id}`,
      action: 'view_imaging_report',
    },
    created_by_module: 'imaging',
  }, actor);
  const patientNotification = report.released_to_patient
    ? await createPatientNotification(report.patient_id, {
      notification_type: NOTIFICATION_TYPE.IMAGING_REPORT_RELEASED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      dedupe_key: `imaging.report_released:${report._id}:patient`,
      payload: {
        entity_type: 'imaging_report',
        entity_id: String(report._id),
        report_id: String(report._id),
        route: `/imaging/reports/${report._id}`,
        action: 'view_imaging_report',
      },
      created_by_module: 'imaging',
    }, actor)
    : null;
  return { staff_notification: staffNotification, patient_notification: patientNotification };
}

async function notifyInvoiceUnpaid(invoiceId, actor = {}) {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) return null;
  if (![INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID].includes(invoice.status)) return null;
  if (Number(invoice.balance_due || 0) <= 0) return null;
  return createPatientNotification(invoice.patient_id, {
    notification_type: NOTIFICATION_TYPE.INVOICE_UNPAID,
    priority: invoice.due_at && invoice.due_at < new Date() ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: `invoice.unpaid:${invoice._id}:patient`,
    template_data: { invoice_no: invoice.invoice_no, balance_due: invoice.balance_due },
    payload: {
      entity_type: 'invoice',
      entity_id: String(invoice._id),
      invoice_id: String(invoice._id),
      patient_id: String(invoice.patient_id),
      encounter_id: invoice.encounter_id ? String(invoice.encounter_id) : undefined,
      admission_id: invoice.admission_id ? String(invoice.admission_id) : undefined,
      balance_due: invoice.balance_due,
      route: `/billing/invoices/${invoice._id}`,
      action: 'pay_invoice',
    },
    created_by_module: 'billing',
  }, actor);
}

async function notifyDispenseCompleted(dispenseId, actor = {}) {
  const dispense = await Dispense.findById(dispenseId).lean();
  if (!dispense) return null;
  const prescription = dispense.prescription_id ? await Prescription.findById(dispense.prescription_id).lean() : null;
  const patientNotification = await createPatientNotification(dispense.patient_id, {
    notification_type: NOTIFICATION_TYPE.DISPENSE_COMPLETED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: `dispense.completed:${dispense._id}:patient`,
    template_data: { dispense_no: dispense.dispense_no },
    payload: {
      entity_type: 'dispense',
      entity_id: String(dispense._id),
      dispense_id: String(dispense._id),
      prescription_id: prescription?._id ? String(prescription._id) : undefined,
      patient_id: String(dispense.patient_id),
      route: `/pharmacy/dispenses/${dispense._id}`,
      action: 'view_dispense',
    },
    created_by_module: 'pharmacy',
  }, actor);
  const doctorNotification = prescription?.prescribed_by
    ? await createStaffNotification(prescription.prescribed_by, {
      notification_type: NOTIFICATION_TYPE.DISPENSE_COMPLETED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      dedupe_key: `dispense.completed:${dispense._id}:doctor:${prescription.prescribed_by}`,
      template_data: { dispense_no: dispense.dispense_no },
      payload: {
        entity_type: 'dispense',
        entity_id: String(dispense._id),
        dispense_id: String(dispense._id),
        patient_id: String(dispense.patient_id),
        route: `/pharmacy/dispenses/${dispense._id}`,
        action: 'view_dispense',
      },
      created_by_module: 'pharmacy',
    }, actor)
    : null;
  return { patient_notification: patientNotification, doctor_notification: doctorNotification };
}

async function notifySchedulePublished(scheduleId, actor = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule) return null;
  const doctorNotification = await createStaffNotification(schedule.doctor_id, {
    notification_type: NOTIFICATION_TYPE.SCHEDULE_PUBLISHED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: `schedule.published:${schedule._id}:doctor:${schedule.doctor_id}`,
    template_data: { work_date: schedule.work_date },
    payload: {
      entity_type: 'doctor_schedule',
      entity_id: String(schedule._id),
      schedule_id: String(schedule._id),
      doctor_id: String(schedule.doctor_id),
      department_id: String(schedule.department_id),
      work_date: schedule.work_date,
      route: `/schedules/${schedule._id}`,
      action: 'view_schedule',
    },
    created_by_module: 'scheduling',
  }, actor);
  const departmentHead = schedule.department_id ? await resolveDepartmentHead(schedule.department_id) : null;
  const departmentNotification = departmentHead && !sameId(departmentHead._id, schedule.doctor_id)
    ? await createStaffNotification(departmentHead._id, {
      notification_type: NOTIFICATION_TYPE.SCHEDULE_PUBLISHED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      dedupe_key: `schedule.published:${schedule._id}:department:${schedule.department_id}`,
      template_data: { work_date: schedule.work_date },
      payload: {
        entity_type: 'doctor_schedule',
        entity_id: String(schedule._id),
        schedule_id: String(schedule._id),
        doctor_id: String(schedule.doctor_id),
        department_id: String(schedule.department_id),
        work_date: schedule.work_date,
        route: `/schedules/${schedule._id}`,
        action: 'view_schedule',
      },
      created_by_module: 'scheduling',
    }, actor)
    : null;
  return { doctor_notification: doctorNotification, department_notification: departmentNotification };
}

async function notifyMedicalRecordReleased(recordId, actor = {}) {
  const record = await MedicalRecord.findById(recordId).lean();
  if (!record || !record.released_to_patient) return null;
  const patientNotification = await createPatientNotification(record.patient_id, {
    notification_type: NOTIFICATION_TYPE.MEDICAL_RECORD_RELEASED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: `medical_record.released:${record._id}:patient`,
    payload: {
      entity_type: 'medical_record',
      entity_id: String(record._id),
      record_id: String(record._id),
      patient_id: String(record.patient_id),
      route: `/medical-records/${record._id}`,
      action: 'view_medical_record',
    },
    created_by_module: 'records',
  }, actor);
  const relatives = await resolveAuthorizedRelativeRecipients(record.patient_id, AUTHORIZATION_TYPE.RECEIVE_NOTIFICATIONS);
  const relativeNotifications = [];
  for (const relative of relatives) {
    const notification = await createRelativeNotification(relative._id, {
      notification_type: NOTIFICATION_TYPE.MEDICAL_RECORD_RELEASED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      dedupe_key: `medical_record.released:${record._id}:relative:${relative._id}`,
      payload: {
        entity_type: 'medical_record',
        entity_id: String(record._id),
        record_id: String(record._id),
        patient_id: String(record.patient_id),
        route: `/medical-records/${record._id}`,
        action: 'view_medical_record',
      },
      created_by_module: 'records',
    }, actor);
    if (notification) relativeNotifications.push(notification);
  }
  return { patient_notification: patientNotification, relative_notifications: relativeNotifications };
}

module.exports = {
  // buildNotificationMessage: Xây dựng nội dung thông báo.
  buildNotificationMessage,
  // resolveNotificationRecipient: Xác định/xử lý người nhận thông báo.
  resolveNotificationRecipient,
  // resolvePatientAccount: Xác định/xử lý tài khoản bệnh nhân.
  resolvePatientAccount,
  // resolveDoctorForEncounter: Xác định/xử lý bác sĩ phụ trách lượt khám.
  resolveDoctorForEncounter,
  // resolveStaffByRole: Xác định/xử lý nhân sự theo vai trò.
  resolveStaffByRole,
  // resolveDepartmentHead: Xác định/xử lý trưởng khoa/phòng ban.
  resolveDepartmentHead,
  // createNotification: Tạo thông báo.
  createNotification,
  // createBulkNotifications: Tạo hàng loạt thông báo.
  createBulkNotifications,
  // getMyNotifications: Lấy thông báo của người dùng hiện tại.
  getMyNotifications,
  // getNotificationDetail: Lấy chi tiết thông báo.
  getNotificationDetail,
  // getUnreadCount: Lấy số thông báo chưa đọc.
  getUnreadCount,
  // markNotificationRead: Đánh dấu thông báo đọc.
  markNotificationRead,
  // markAllNotificationsRead: Đánh dấu đếnàn bộ thông báo đọc.
  markAllNotificationsRead,
  // listNotifications: Liệt kê thông báo.
  listNotifications,
  // listFailedNotifications: Liệt kê thông báo gửi thất bại.
  listFailedNotifications,
  // cancelNotification: Hủy thông báo.
  cancelNotification,
  // dispatchNotification: Điều phối/gửi thông báo.
  dispatchNotification,
  // dispatchQueuedNotifications: Điều phối/gửi thông báo đang chờ gửi.
  dispatchQueuedNotifications,
  // retryFailedNotification: Thử lại thông báo gửi thất bại.
  retryFailedNotification,
  // notifyAppointmentConfirmed: Gửi thông báo về lịch hẹn confirmed.
  notifyAppointmentConfirmed,
  // notifyAppointmentCancelled: Gửi thông báo về lịch hẹn cancelled.
  notifyAppointmentCancelled,
  // notifyPatientCheckedInToDoctor: Gửi thông báo cho bác sĩ khi bệnh nhân đã check-in.
  notifyPatientCheckedInToDoctor,
  // notifyLabResultFinal: Gửi thông báo về kết quả xét nghiệm cuối cùng.
  notifyLabResultFinal,
  // notifyImagingReportFinal: Gửi thông báo về chẩn đoán hình ảnh báo cáo cuối cùng.
  notifyImagingReportFinal,
  // notifyInvoiceUnpaid: Gửi thông báo hóa đơn chưa thanh toán.
  notifyInvoiceUnpaid,
  // notifyDispenseCompleted: Gửi thông báo hoàn tất cấp phát thuốc.
  notifyDispenseCompleted,
  // notifySchedulePublished: Gửi thông báo lịch làm việc đã được công bố.
  notifySchedulePublished,
  // notifyMedicalRecordReleased: Gửi thông báo hồ sơ bệnh án đã phát hành.
  notifyMedicalRecordReleased,
};
