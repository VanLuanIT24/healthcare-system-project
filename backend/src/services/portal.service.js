const {
  Allergy,
  Appointment,
  Attachment,
  AuditLog,
  Conversation,
  ConversationParticipant,
  Diagnosis,
  DocumentExportRequest,
  Department,
  DoctorProfile,
  DoctorSchedule,
  Encounter,
  ImagingOrder,
  ImagingReport,
  InsurancePolicy,
  Invoice,
  LabOrder,
  LabResult,
  Message,
  MedicalRecord,
  Notification,
  Patient,
  PatientAccount,
  PatientAuthorization,
  PatientProfileChangeRequest,
  PatientRelative,
  PaymentIntent,
  ProblemList,
  ProcedureResult,
  Prescription,
  QueueTicket,
  SupportTicket,
  User,
  VitalSign,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  ACTIVE_QUEUE_STATUSES,
  ACTOR_TYPE,
  ALLERGY_STATUS,
  APPOINTMENT_STATUS,
  ATTACHMENT_ENTITY_TYPE,
  ATTACHMENT_STATUS,
  AUTHORIZATION_STATUS,
  AUTHORIZATION_TYPE,
  CONVERSATION_STATUS,
  CONVERSATION_TYPE,
  DIAGNOSIS_STATUS,
  DOCUMENT_EXPORT_STATUS,
  DOCUMENT_EXPORT_TYPE,
  DOCUMENT_REVIEW_STATUS,
  DOCUMENT_SOURCE,
  DOCUMENT_VISIBILITY,
  ENCOUNTER_STATUS,
  REALTIME_EVENT_TYPE,
  RELATIVE_STATUS,
  GENDERS,
  IMAGING_REPORT_STATUS,
  INSURANCE_POLICY_STATUS,
  INVOICE_STATUS,
  LAB_RESULT_STATUS,
  MESSAGE_STATUS,
  MEDICAL_RECORD_STATUS,
  NOTIFICATION_STATUS,
  PAYMENT_INTENT_STATUS,
  PATIENT_PROFILE_CHANGE_STATUS,
  PATIENT_PROFILE_CHANGE_TYPE,
  PATIENT_PROFILE_CHANGE_TYPES,
  PROBLEM_STATUS,
  PROCEDURE_RESULT_STATUS,
  PRESCRIPTION_STATUS,
  QUEUE_STATUS,
  SCHEDULE_STATUS,
  SUPPORT_TICKET_STATUS,
  VITAL_SIGN_STATUS,
} = require('../constants/statuses');
const { buildPagination, createError, getPagination, normalizeString, recordAuditLog } = require('./core.service');
const { generateDateCode } = require('./code-generator.service');
const actorContext = require('../common/actors');
const eventBus = require('../events/event-bus.service');
const permissionService = require('./permission.service');
const patientService = require('./patient.service');
const scheduleService = require('./schedule.service');
const { isValidObjectId, toObjectId } = require('../common/helpers/object-id.helper');

const UNREAD_NOTIFICATION_STATUSES = [
  NOTIFICATION_STATUS.UNREAD,
  NOTIFICATION_STATUS.QUEUED,
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.DELIVERED,
];

const OPEN_CONVERSATION_STATUSES = [
  CONVERSATION_STATUS.OPEN,
  CONVERSATION_STATUS.PENDING,
];

const ACTIVE_PRESCRIPTION_STATUSES = [
  PRESCRIPTION_STATUS.ACTIVE,
  PRESCRIPTION_STATUS.VERIFIED,
  PRESCRIPTION_STATUS.PARTIALLY_DISPENSED,
];

const RELEASED_LAB_RESULT_STATUSES = [
  LAB_RESULT_STATUS.FINAL,
  LAB_RESULT_STATUS.AMENDED,
];

const RELEASED_IMAGING_REPORT_STATUSES = [
  IMAGING_REPORT_STATUS.FINAL,
  IMAGING_REPORT_STATUS.AMENDED,
];

const PROFILE_CHANGE_FIELDS = {
  [PATIENT_PROFILE_CHANGE_TYPE.BASIC_INFO]: ['full_name', 'date_of_birth', 'gender'],
  [PATIENT_PROFILE_CHANGE_TYPE.CONTACT]: ['phone', 'email'],
  [PATIENT_PROFILE_CHANGE_TYPE.ADDRESS]: ['address'],
  [PATIENT_PROFILE_CHANGE_TYPE.IDENTITY]: ['national_id', 'insurance_number'],
  [PATIENT_PROFILE_CHANGE_TYPE.EMERGENCY_CONTACT]: ['emergency_contact_name', 'emergency_contact_phone'],
};

const ACCESS_LOG_TARGET_TYPES = [
  'patient',
  'appointment',
  'encounter',
  'lab_result',
  'imaging_report',
  'prescription',
  'medical_record',
  'attachment',
  'invoice',
  'payment',
  'insurance_claim',
];

const RELATIVE_AUTHORIZATION_SCOPE_ALIASES = {
  [AUTHORIZATION_TYPE.VIEW_RECORDS]: [
    AUTHORIZATION_TYPE.VIEW_RECORDS,
    AUTHORIZATION_TYPE.RECORD_READ,
    AUTHORIZATION_TYPE.LAB_RESULT_READ,
    AUTHORIZATION_TYPE.IMAGING_REPORT_READ,
    AUTHORIZATION_TYPE.PRESCRIPTION_READ,
  ],
  [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]: [
    AUTHORIZATION_TYPE.BOOK_APPOINTMENTS,
    AUTHORIZATION_TYPE.APPOINTMENT_READ,
    AUTHORIZATION_TYPE.APPOINTMENT_MANAGE,
  ],
  [AUTHORIZATION_TYPE.BILLING]: [
    AUTHORIZATION_TYPE.BILLING,
    AUTHORIZATION_TYPE.BILLING_READ,
    AUTHORIZATION_TYPE.BILLING_PAY,
  ],
};

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function hasOwn(payload, field) {
  return Object.prototype.hasOwnProperty.call(payload || {}, field);
}

function compactObject(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function normalizeScope(value) {
  return value ? String(value).trim() : value;
}

function expandAuthorizationScopes(scopeOrScopes = AUTHORIZATION_TYPE.VIEW_RECORDS) {
  const requested = Array.isArray(scopeOrScopes) ? scopeOrScopes : [scopeOrScopes];
  const scopes = new Set([AUTHORIZATION_TYPE.FULL_ACCESS]);
  requested.map(normalizeScope).filter(Boolean).forEach((scope) => {
    scopes.add(scope);
    (RELATIVE_AUTHORIZATION_SCOPE_ALIASES[scope] || []).forEach((alias) => scopes.add(alias));
  });
  return [...scopes];
}

function actorType(actor = {}) {
  return actorContext.getActorType(actor);
}

function actorId(actor = {}) {
  return actorContext.getActorId(actor);
}

function isRelativeActor(actor = {}) {
  return actorType(actor) === ACTOR_TYPE.PATIENT_RELATIVE;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function buildActorSnapshot(actor = {}) {
  const context = actorContext.buildActorContext(actor);
  return {
    actor_type: context.actor_type,
    actor_id: context.actor_id,
    session_id: isValidObjectId(context.session_id) ? context.session_id : undefined,
  };
}

async function hasRelativeAuthorization(relativeId, patientId, authorizationTypes = [AUTHORIZATION_TYPE.VIEW_RECORDS]) {
  if (!relativeId || !patientId) return false;
  const now = new Date();
  const types = expandAuthorizationScopes(authorizationTypes);

  return Boolean(await PatientAuthorization.exists({
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
          { authorization_type: { $in: types } },
          { permissions: { $in: types } },
        ],
      },
    ],
  }));
}

async function resolvePortalPatient(actor = {}, authorizationTypes = [AUTHORIZATION_TYPE.VIEW_RECORDS]) {
  const type = actorType(actor);
  const patientId = actor.patientId || actor.patient_id;

  if (!patientId) {
    throw createError('Không xác định được hồ sơ bệnh nhân của phiên portal.', 403);
  }

  const patient = await Patient.findOne({ _id: patientId, is_deleted: false }).lean();
  if (!patient) throw createError('Không tìm thấy hồ sơ bệnh nhân.', 404);

  if (type === ACTOR_TYPE.PATIENT) {
    return patient;
  }

  if (type === ACTOR_TYPE.PATIENT_RELATIVE) {
    const relativeId = actor.relativeId || actor.relative_id || actorId(actor);
    const authorized = await hasRelativeAuthorization(relativeId, patient._id, authorizationTypes);
    if (!authorized) {
      throw createError('Người nhà chưa có ủy quyền phù hợp để truy cập portal của bệnh nhân này.', 403);
    }
    return patient;
  }

  throw createError('Chỉ tài khoản bệnh nhân/người nhà được dùng portal cá nhân.', 403);
}

function notificationRecipientFilter(actor = {}) {
  if (actorType(actor) === ACTOR_TYPE.PATIENT) {
    const accountId = actor.patientAccountId || actor.patient_account_id || actorId(actor);
    return {
      recipient_type: 'patient',
      $or: [
        { recipient_id: accountId },
        { patient_account_id: accountId },
      ],
    };
  }

  if (isRelativeActor(actor)) {
    const relativeId = actor.relativeId || actor.relative_id || actorId(actor);
    return {
      recipient_type: 'relative',
      $or: [
        { recipient_id: relativeId },
        { relative_id: relativeId },
      ],
    };
  }

  return { _id: null };
}

async function countUnreadMessages(actor = {}) {
  const snapshot = buildActorSnapshot(actor);
  const participants = await ConversationParticipant.find({
    actor_type: snapshot.actor_type,
    actor_id: snapshot.actor_id,
    archived: false,
    $or: [
      { left_at: null },
      { left_at: { $exists: false } },
    ],
  }).lean();

  if (participants.length === 0) return 0;

  const counts = await Promise.all(participants.map((participant) => {
    const filter = {
      conversation_id: participant.conversation_id,
      status: { $ne: MESSAGE_STATUS.DELETED },
      sender_actor_type: { $ne: snapshot.actor_type },
      is_internal_note: false,
    };
    if (participant.last_read_at) filter.created_at = { $gt: participant.last_read_at };
    return Message.countDocuments(filter);
  }));

  return counts.reduce((sum, count) => sum + count, 0);
}

function dashboardLimit(value, fallback = 5) {
  const limit = Number(value || fallback);
  return Math.min(Math.max(limit || fallback, 1), 20);
}

async function getMyDashboard(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor);
  const patientId = patient._id;
  const now = new Date();
  const limit = dashboardLimit(query.limit);
  const insuranceExpiryTo = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

  const [
    upcomingAppointments,
    currentQueueTicket,
    unpaidInvoices,
    newLabResults,
    newImagingReports,
    activePrescriptions,
    unreadNotifications,
    openSupportConversations,
    unreadMessagesCount,
    expiringInsurancePolicies,
  ] = await Promise.all([
    Appointment.find({
      patient_id: patientId,
      is_deleted: false,
      appointment_time: { $gte: now },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }).sort({ appointment_time: 1 }).limit(limit).lean(),
    QueueTicket.findOne({
      patient_id: patientId,
      status: { $in: ACTIVE_QUEUE_STATUSES },
    }).sort({ queue_date: -1, created_at: -1 }).lean(),
    Invoice.find({
      patient_id: patientId,
      balance_due: { $gt: 0 },
      status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] },
    }).sort({ due_at: 1, issued_at: -1 }).limit(limit).lean(),
    LabResult.find({
      patient_id: patientId,
      released_to_patient: true,
      status: { $in: RELEASED_LAB_RESULT_STATUSES },
    }).sort({ released_at: -1, reported_at: -1, created_at: -1 }).limit(limit).lean(),
    ImagingReport.find({
      patient_id: patientId,
      released_to_patient: true,
      status: { $in: RELEASED_IMAGING_REPORT_STATUSES },
    }).sort({ released_at: -1, reported_at: -1, created_at: -1 }).limit(limit).lean(),
    Prescription.find({
      patient_id: patientId,
      is_current: true,
      status: { $in: ACTIVE_PRESCRIPTION_STATUSES },
    }).sort({ prescribed_at: -1 }).limit(limit).lean(),
    Notification.countDocuments({
      ...notificationRecipientFilter(actor),
      status: { $in: UNREAD_NOTIFICATION_STATUSES },
      read_at: null,
    }),
    Conversation.countDocuments({
      patient_id: patientId,
      type: CONVERSATION_TYPE.SUPPORT,
      status: { $in: OPEN_CONVERSATION_STATUSES },
    }),
    countUnreadMessages(actor),
    InsurancePolicy.find({
      patient_id: patientId,
      is_deleted: false,
      status: INSURANCE_POLICY_STATUS.ACTIVE,
      valid_to: { $gte: now, $lte: insuranceExpiryTo },
    }).sort({ valid_to: 1 }).limit(limit).lean(),
  ]);

  return {
    patient_id: toId(patientId),
    generated_at: now,
    upcoming_appointments: upcomingAppointments,
    current_queue_ticket: currentQueueTicket,
    unpaid_invoices: unpaidInvoices,
    new_lab_results: newLabResults,
    new_imaging_reports: newImagingReports,
    active_prescriptions: activePrescriptions,
    unread_notifications_count: unreadNotifications,
    open_support_tickets_count: openSupportConversations,
    open_support_conversations_count: openSupportConversations,
    unread_messages_count: unreadMessagesCount,
    expiring_insurance_policies: expiringInsurancePolicies,
  };
}

function startOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function buildPortalUrl(section, extra = {}) {
  const params = new URLSearchParams({ section, ...compactObject(extra) });
  return `/portal?${params.toString()}`;
}

function activeAppointmentFilter(patientId, now = new Date()) {
  return {
    patient_id: patientId,
    is_deleted: false,
    appointment_time: { $gte: now },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
  };
}

function releasedLabResultFilter(patientId) {
  return {
    patient_id: patientId,
    released_to_patient: true,
    release_revoked_at: { $exists: false },
    status: { $in: RELEASED_LAB_RESULT_STATUSES },
  };
}

function releasedImagingReportFilter(patientId) {
  return {
    patient_id: patientId,
    released_to_patient: true,
    release_revoked_at: { $exists: false },
    status: { $in: RELEASED_IMAGING_REPORT_STATUSES },
  };
}

function releasedProcedureResultFilter(patientId) {
  return {
    patient_id: patientId,
    released_to_patient: true,
    release_revoked_at: { $exists: false },
    status: { $in: [PROCEDURE_RESULT_STATUS.FINAL, PROCEDURE_RESULT_STATUS.AMENDED] },
  };
}

function activePrescriptionFilter(patientId) {
  return {
    patient_id: patientId,
    is_current: true,
    status: { $in: ACTIVE_PRESCRIPTION_STATUSES },
  };
}

function unpaidInvoiceFilter(patientId) {
  return {
    patient_id: patientId,
    balance_due: { $gt: 0 },
    status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] },
  };
}

function countByStatus(items = []) {
  return items.reduce((acc, item) => {
    const status = item.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

async function getMyCounters(actor = {}) {
  const patient = await resolvePortalPatient(actor);
  const patientId = patient._id;
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);
  const insuranceExpiryTo = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

  const [
    appointmentsUpcoming,
    appointmentsToday,
    appointmentsPending,
    appointmentsConfirmed,
    queueActive,
    labResultsNew,
    imagingResultsNew,
    procedureResultsNew,
    prescriptionsActive,
    unpaidInvoices,
    paymentIntentsPending,
    insuranceExpiring,
    notificationsUnread,
    supportOpen,
    supportWaitingPatient,
    unreadMessages,
    documentReviewPending,
    profileChangesPending,
  ] = await Promise.all([
    Appointment.countDocuments(activeAppointmentFilter(patientId, now)),
    Appointment.countDocuments({
      patient_id: patientId,
      is_deleted: false,
      appointment_time: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }),
    Appointment.countDocuments({
      patient_id: patientId,
      is_deleted: false,
      status: APPOINTMENT_STATUS.BOOKED,
      appointment_time: { $gte: now },
    }),
    Appointment.countDocuments({
      patient_id: patientId,
      is_deleted: false,
      status: APPOINTMENT_STATUS.CONFIRMED,
      appointment_time: { $gte: now },
    }),
    QueueTicket.countDocuments({ patient_id: patientId, status: { $in: ACTIVE_QUEUE_STATUSES } }),
    LabResult.countDocuments({ ...releasedLabResultFilter(patientId), patient_viewed_at: null }),
    ImagingReport.countDocuments({ ...releasedImagingReportFilter(patientId), patient_viewed_at: null }),
    ProcedureResult.countDocuments({ ...releasedProcedureResultFilter(patientId), patient_viewed_at: null }),
    Prescription.countDocuments(activePrescriptionFilter(patientId)),
    Invoice.countDocuments(unpaidInvoiceFilter(patientId)),
    PaymentIntent.countDocuments({
      patient_id: patientId,
      status: {
        $in: [
          PAYMENT_INTENT_STATUS.CREATED,
          PAYMENT_INTENT_STATUS.PENDING,
          PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
          PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
          PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
          PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
        ],
      },
    }),
    InsurancePolicy.countDocuments({
      patient_id: patientId,
      is_deleted: false,
      status: INSURANCE_POLICY_STATUS.ACTIVE,
      valid_to: { $gte: now, $lte: insuranceExpiryTo },
    }),
    Notification.countDocuments({
      ...notificationRecipientFilter(actor),
      status: { $in: UNREAD_NOTIFICATION_STATUSES },
      read_at: null,
    }),
    SupportTicket.countDocuments({
      patient_id: patientId,
      status: { $in: [SUPPORT_TICKET_STATUS.OPEN, SUPPORT_TICKET_STATUS.WAITING_STAFF] },
    }),
    SupportTicket.countDocuments({
      patient_id: patientId,
      status: SUPPORT_TICKET_STATUS.WAITING_PATIENT,
    }),
    countUnreadMessages(actor),
    Attachment.countDocuments({
      patient_id: patientId,
      source: DOCUMENT_SOURCE.PATIENT_UPLOAD,
      status: ATTACHMENT_STATUS.ACTIVE,
      review_status: DOCUMENT_REVIEW_STATUS.PENDING,
    }),
    PatientProfileChangeRequest.countDocuments({
      patient_id: patientId,
      status: PATIENT_PROFILE_CHANGE_STATUS.PENDING,
    }),
  ]);

  const careTotal =
    appointmentsUpcoming +
    queueActive +
    labResultsNew +
    imagingResultsNew +
    procedureResultsNew +
    prescriptionsActive;
  const financeTotal = unpaidInvoices + paymentIntentsPending + insuranceExpiring;
  const contactTotal = notificationsUnread + supportOpen + supportWaitingPatient + unreadMessages;
  const recordsTotal = documentReviewPending + profileChangesPending;

  return {
    generated_at: now,
    overview_total: careTotal + financeTotal + contactTotal + recordsTotal,
    appointments_upcoming: appointmentsUpcoming,
    appointments_today: appointmentsToday,
    appointments_pending: appointmentsPending,
    appointments_confirmed: appointmentsConfirmed,
    queue_active: queueActive,
    lab_results_new: labResultsNew,
    imaging_results_new: imagingResultsNew,
    procedure_results_new: procedureResultsNew,
    results_new: labResultsNew + imagingResultsNew + procedureResultsNew,
    prescriptions_active: prescriptionsActive,
    unpaid_invoices: unpaidInvoices,
    payment_intents_pending: paymentIntentsPending,
    insurance_expiring: insuranceExpiring,
    notifications_unread: notificationsUnread,
    support_open: supportOpen,
    support_waiting_patient: supportWaitingPatient,
    unread_messages: unreadMessages,
    documents_pending_review: documentReviewPending,
    profile_changes_pending: profileChangesPending,
    groups: {
      care: careTotal,
      records: recordsTotal,
      finance: financeTotal,
      contact: contactTotal,
    },
  };
}

function profileCompleteness(patient = {}) {
  const requiredFields = [
    ['full_name', 'Họ tên'],
    ['date_of_birth', 'Ngày sinh'],
    ['gender', 'Giới tính'],
    ['phone', 'Số điện thoại'],
    ['email', 'Email'],
    ['address', 'Địa chỉ'],
    ['national_id', 'Giấy tờ định danh'],
    ['insurance_number', 'Số bảo hiểm'],
    ['emergency_contact_name', 'Người liên hệ khẩn cấp'],
    ['emergency_contact_phone', 'Số điện thoại khẩn cấp'],
  ];
  const missing = requiredFields
    .filter(([field]) => {
      if (field === 'gender') return !patient[field] || patient[field] === 'unknown';
      return !patient[field];
    })
    .map(([field, label]) => ({ field, label }));
  const score = Math.round(((requiredFields.length - missing.length) / requiredFields.length) * 100);
  return { score, missing };
}

function makeTodo(type, title, priority, targetSection, extras = {}) {
  return compactObject({
    type,
    title,
    priority,
    target_section: targetSection,
    target_url: buildPortalUrl(targetSection),
    due_at: extras.due_at,
    badge: extras.badge,
    entity_id: extras.entity_id,
    entity_type: extras.entity_type,
    metadata: extras.metadata,
  });
}

async function getMyTodos(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor);
  const patientId = patient._id;
  const now = new Date();
  const limit = dashboardLimit(query.limit, 10);
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);
  const insuranceExpiryTo = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

  const [
    todayAppointments,
    currentQueueTicket,
    unpaidInvoices,
    newLabResults,
    newImagingReports,
    newProcedureResults,
    activePrescriptions,
    expiringInsurancePolicies,
    supportWaitingPatient,
    profileChangePending,
  ] = await Promise.all([
    Appointment.find({
      patient_id: patientId,
      is_deleted: false,
      appointment_time: { $gte: todayStart, $lte: todayEnd },
      status: { $in: [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED] },
    }).sort({ appointment_time: 1 }).limit(3).lean(),
    QueueTicket.findOne({ patient_id: patientId, status: { $in: ACTIVE_QUEUE_STATUSES } })
      .sort({ queue_date: -1, created_at: -1 })
      .lean(),
    Invoice.find(unpaidInvoiceFilter(patientId)).sort({ due_at: 1, issued_at: -1 }).limit(3).lean(),
    LabResult.find({ ...releasedLabResultFilter(patientId), patient_viewed_at: null })
      .sort({ released_at: -1, reported_at: -1, created_at: -1 })
      .limit(3)
      .lean(),
    ImagingReport.find({ ...releasedImagingReportFilter(patientId), patient_viewed_at: null })
      .sort({ released_at: -1, reported_at: -1, created_at: -1 })
      .limit(3)
      .lean(),
    ProcedureResult.find({ ...releasedProcedureResultFilter(patientId), patient_viewed_at: null })
      .sort({ released_to_patient_at: -1, reported_at: -1, created_at: -1 })
      .limit(3)
      .lean(),
    Prescription.find(activePrescriptionFilter(patientId)).sort({ prescribed_at: -1 }).limit(3).lean(),
    InsurancePolicy.find({
      patient_id: patientId,
      is_deleted: false,
      status: INSURANCE_POLICY_STATUS.ACTIVE,
      valid_to: { $gte: now, $lte: insuranceExpiryTo },
    }).sort({ valid_to: 1 }).limit(3).lean(),
    SupportTicket.find({ patient_id: patientId, status: SUPPORT_TICKET_STATUS.WAITING_PATIENT })
      .sort({ updated_at: -1 })
      .limit(3)
      .lean(),
    PatientProfileChangeRequest.countDocuments({
      patient_id: patientId,
      status: PATIENT_PROFILE_CHANGE_STATUS.PENDING,
    }),
  ]);

  const items = [];

  for (const appointment of todayAppointments) {
    items.push(makeTodo(
      'appointment_checkin',
      `Bạn có lịch khám hôm nay lúc ${new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(appointment.appointment_time))}`,
      'high',
      'checkin-queue',
      {
        due_at: appointment.appointment_time,
        entity_type: 'appointment',
        entity_id: toId(appointment._id),
        badge: appointment.status === APPOINTMENT_STATUS.CONFIRMED ? 'Đã xác nhận' : 'Chờ xác nhận',
      },
    ));
  }

  if (currentQueueTicket) {
    items.push(makeTodo(
      'queue_active',
      `Bạn đang có số thứ tự ${currentQueueTicket.display_number || currentQueueTicket.queue_number}`,
      currentQueueTicket.status === QUEUE_STATUS.CALLED ? 'high' : 'normal',
      'checkin-queue',
      {
        entity_type: 'queue_ticket',
        entity_id: toId(currentQueueTicket._id),
        badge: currentQueueTicket.status,
      },
    ));
  }

  for (const invoice of unpaidInvoices) {
    items.push(makeTodo(
      'invoice_unpaid',
      `Hóa đơn ${invoice.invoice_no || toId(invoice._id)} còn cần thanh toán`,
      invoice.due_at && invoice.due_at < now ? 'high' : 'normal',
      'billing',
      {
        due_at: invoice.due_at,
        entity_type: 'invoice',
        entity_id: toId(invoice._id),
        badge: invoice.balance_due ? `${invoice.balance_due} ${invoice.currency || 'VND'}` : undefined,
      },
    ));
  }

  if (newLabResults.length > 0) {
    items.push(makeTodo('lab_result_new', `Bạn có ${newLabResults.length} kết quả xét nghiệm mới`, 'normal', 'lab-results', {
      entity_type: 'lab_result',
      entity_id: toId(newLabResults[0]._id),
      badge: newLabResults.some((item) => item.is_critical) ? 'Có cảnh báo' : 'Mới',
    }));
  }

  if (newImagingReports.length > 0) {
    items.push(makeTodo('imaging_report_new', `Bạn có ${newImagingReports.length} báo cáo chẩn đoán hình ảnh mới`, 'normal', 'imaging', {
      entity_type: 'imaging_report',
      entity_id: toId(newImagingReports[0]._id),
      badge: newImagingReports.some((item) => item.is_critical) ? 'Có cảnh báo' : 'Mới',
    }));
  }

  if (newProcedureResults.length > 0) {
    items.push(makeTodo('procedure_result_new', `Bạn có ${newProcedureResults.length} kết quả thủ thuật mới`, 'normal', 'procedures', {
      entity_type: 'procedure_result',
      entity_id: toId(newProcedureResults[0]._id),
      badge: newProcedureResults.some((item) => item.is_critical) ? 'Có cảnh báo' : 'Mới',
    }));
  }

  if (activePrescriptions.length > 0) {
    items.push(makeTodo('prescription_active', `Bạn có ${activePrescriptions.length} đơn thuốc đang hiệu lực`, 'normal', 'medications', {
      entity_type: 'prescription',
      entity_id: toId(activePrescriptions[0]._id),
      badge: 'Đang hiệu lực',
    }));
  }

  for (const policy of expiringInsurancePolicies) {
    items.push(makeTodo(
      'insurance_expiring',
      `Bảo hiểm ${policy.policy_no || policy.insurance_number || ''}`.trim() || 'Bảo hiểm sắp hết hạn',
      'normal',
      'insurance',
      {
        due_at: policy.valid_to,
        entity_type: 'insurance_policy',
        entity_id: toId(policy._id),
        badge: 'Sắp hết hạn',
      },
    ));
  }

  for (const ticket of supportWaitingPatient) {
    items.push(makeTodo('support_waiting_patient', `Ticket ${ticket.ticket_code || ''} đang chờ bạn phản hồi`.trim(), 'normal', 'support', {
      entity_type: 'support_ticket',
      entity_id: toId(ticket._id),
      badge: 'Cần phản hồi',
    }));
  }

  const completeness = profileCompleteness(patient);
  if (completeness.score < 100 && profileChangePending === 0) {
    items.push(makeTodo('profile_incomplete', 'Hồ sơ cá nhân còn thiếu thông tin', 'low', 'profile', {
      badge: `${completeness.score}%`,
      metadata: { missing: completeness.missing.slice(0, 3) },
    }));
  }

  const priorityWeight = { high: 0, normal: 1, low: 2 };
  items.sort((a, b) => {
    const byPriority = (priorityWeight[a.priority] ?? 9) - (priorityWeight[b.priority] ?? 9);
    if (byPriority !== 0) return byPriority;
    const aTime = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return {
    generated_at: now,
    items: items.slice(0, limit),
    total: items.length,
  };
}

async function getMyHealthSummary(actor = {}) {
  const patient = await resolvePortalPatient(actor);
  const patientId = patient._id;

  const recentEncounters = await Encounter.find({ patient_id: patientId })
    .sort({ start_time: -1 })
    .limit(6)
    .lean();
  const encounterIds = recentEncounters.map((item) => item._id);

  const [
    allergies,
    problemList,
    recentDiagnoses,
    activePrescriptions,
    releasedRecordsCount,
    recentVitals,
  ] = await Promise.all([
    Allergy.find({ patient_id: patientId, status: ALLERGY_STATUS.ACTIVE })
      .sort({ severity: -1, created_at: -1 })
      .limit(12)
      .lean(),
    ProblemList.find({ patient_id: patientId, status: PROBLEM_STATUS.ACTIVE })
      .sort({ onset_date: -1, created_at: -1 })
      .limit(12)
      .lean(),
    encounterIds.length
      ? Diagnosis.find({
        encounter_id: { $in: encounterIds },
        status: DIAGNOSIS_STATUS.ACTIVE,
      }).sort({ is_primary: -1, created_at: -1 }).limit(12).lean()
      : [],
    Prescription.find(activePrescriptionFilter(patientId)).sort({ prescribed_at: -1 }).limit(8).lean(),
    MedicalRecord.countDocuments({
      patient_id: patientId,
      released_to_patient: true,
      status: { $in: [MEDICAL_RECORD_STATUS.ACTIVE, MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED] },
    }),
    VitalSign.find({ patient_id: patientId, status: { $in: [VITAL_SIGN_STATUS.RECORDED, VITAL_SIGN_STATUS.AMENDED] } })
      .sort({ recorded_at: -1 })
      .limit(8)
      .lean(),
  ]);

  return {
    patient: {
      patient_id: toId(patient._id),
      patient_code: patient.patient_code,
      full_name: patient.full_name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      national_id: patient.national_id,
      insurance_number: patient.insurance_number,
      emergency_contact_name: patient.emergency_contact_name,
      emergency_contact_phone: patient.emergency_contact_phone,
      identity_verified_at: patient.identity_verified_at,
      status: patient.status,
    },
    profile_completeness: profileCompleteness(patient),
    allergies,
    problem_list: problemList,
    recent_diagnoses: recentDiagnoses,
    recent_encounters: recentEncounters,
    active_prescriptions: activePrescriptions,
    released_records_count: releasedRecordsCount,
    recent_vitals: recentVitals,
  };
}

async function buildVisitItems(encounters = [], patientId) {
  const encounterIds = encounters.map((item) => item._id);
  const appointmentIds = encounters.map((item) => item.appointment_id).filter(Boolean);
  if (encounterIds.length === 0) return [];

  const [
    appointments,
    records,
    diagnoses,
    labOrders,
    imagingOrders,
    procedureResults,
    prescriptions,
    invoices,
  ] = await Promise.all([
    appointmentIds.length
      ? Appointment.find({ _id: { $in: appointmentIds }, patient_id: patientId, is_deleted: false }).lean()
      : [],
    MedicalRecord.find({
      patient_id: patientId,
      encounter_id: { $in: encounterIds },
      released_to_patient: true,
      status: { $in: [MEDICAL_RECORD_STATUS.ACTIVE, MEDICAL_RECORD_STATUS.FINALIZED, MEDICAL_RECORD_STATUS.SEALED] },
    }).lean(),
    Diagnosis.find({ encounter_id: { $in: encounterIds }, status: { $ne: DIAGNOSIS_STATUS.ENTERED_IN_ERROR } }).lean(),
    LabOrder.find({ patient_id: patientId, encounter_id: { $in: encounterIds } }).select('_id encounter_id').lean(),
    ImagingOrder.find({ patient_id: patientId, encounter_id: { $in: encounterIds } }).select('_id encounter_id').lean(),
    ProcedureResult.find({ ...releasedProcedureResultFilter(patientId), encounter_id: { $in: encounterIds } }).lean(),
    Prescription.find({ patient_id: patientId, encounter_id: { $in: encounterIds }, is_current: true }).lean(),
    Invoice.find({ patient_id: patientId, encounter_id: { $in: encounterIds } }).lean(),
  ]);

  const labOrderById = new Map(labOrders.map((item) => [toId(item._id), item]));
  const imagingOrderById = new Map(imagingOrders.map((item) => [toId(item._id), item]));
  const [labResults, imagingReports] = await Promise.all([
    labOrders.length
      ? LabResult.find({ ...releasedLabResultFilter(patientId), lab_order_id: { $in: labOrders.map((item) => item._id) } }).lean()
      : [],
    imagingOrders.length
      ? ImagingReport.find({ ...releasedImagingReportFilter(patientId), imaging_order_id: { $in: imagingOrders.map((item) => item._id) } }).lean()
      : [],
  ]);

  const byEncounter = (rows, field = 'encounter_id') => rows.reduce((map, row) => {
    const key = toId(row[field]);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());

  const appointmentsById = new Map(appointments.map((item) => [toId(item._id), item]));
  const recordsByEncounter = byEncounter(records);
  const diagnosesByEncounter = byEncounter(diagnoses);
  const labByEncounter = labResults.reduce((map, row) => {
    const order = labOrderById.get(toId(row.lab_order_id));
    const key = toId(order?.encounter_id);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
  const imagingByEncounter = imagingReports.reduce((map, row) => {
    const order = imagingOrderById.get(toId(row.imaging_order_id));
    const key = toId(order?.encounter_id);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
  const procedureByEncounter = byEncounter(procedureResults);
  const prescriptionsByEncounter = byEncounter(prescriptions);
  const invoicesByEncounter = byEncounter(invoices);

  return encounters.map((encounter) => {
    const encounterId = toId(encounter._id);
    const visitDiagnoses = diagnosesByEncounter.get(encounterId) || [];
    const visitRecords = recordsByEncounter.get(encounterId) || [];
    const visitLabResults = labByEncounter.get(encounterId) || [];
    const visitImagingReports = imagingByEncounter.get(encounterId) || [];
    const visitProcedureResults = procedureByEncounter.get(encounterId) || [];
    const visitPrescriptions = prescriptionsByEncounter.get(encounterId) || [];
    const visitInvoices = invoicesByEncounter.get(encounterId) || [];

    return {
      visit_id: encounterId,
      encounter,
      appointment: encounter.appointment_id ? appointmentsById.get(toId(encounter.appointment_id)) || null : null,
      primary_diagnosis: visitDiagnoses.find((item) => item.is_primary) || visitDiagnoses[0] || null,
      diagnoses: visitDiagnoses,
      released_records: visitRecords,
      lab_results: visitLabResults,
      imaging_reports: visitImagingReports,
      procedure_results: visitProcedureResults,
      prescriptions: visitPrescriptions,
      invoices: visitInvoices,
      counters: {
        released_records: visitRecords.length,
        lab_results: visitLabResults.length,
        imaging_reports: visitImagingReports.length,
        procedure_results: visitProcedureResults.length,
        prescriptions: visitPrescriptions.length,
        invoices: visitInvoices.length,
        unpaid_invoices: visitInvoices.filter((invoice) => Number(invoice.balance_due || 0) > 0).length,
      },
      visit_source: 'encounter',
      visit_date: encounter.start_time || encounter.created_at,
    };
  });
}

async function buildAppointmentVisitItems(appointments = [], patientId) {
  if (!appointments.length) return [];

  const doctorIds = [...new Set(appointments.map((item) => toId(item.doctor_id)).filter(Boolean))];
  const departmentIds = [...new Set(appointments.map((item) => toId(item.department_id)).filter(Boolean))];
  const [doctors, departments, queueTickets] = await Promise.all([
    doctorIds.length
      ? User.find({ _id: { $in: doctorIds }, is_deleted: false })
        .select('full_name employee_code avatar_url')
        .lean()
      : [],
    departmentIds.length
      ? Department.find({ _id: { $in: departmentIds }, is_deleted: false })
        .select('department_name department_code location room floor building')
        .lean()
      : [],
    QueueTicket.find({
      patient_id: patientId,
      appointment_id: { $in: appointments.map((item) => item._id) },
    })
      .sort({ created_at: -1 })
      .lean(),
  ]);

  const doctorMap = new Map(doctors.map((item) => [toId(item._id), item]));
  const departmentMap = new Map(departments.map((item) => [toId(item._id), item]));
  const queueMap = queueTickets.reduce((map, item) => {
    const key = toId(item.appointment_id);
    if (key && !map.has(key)) map.set(key, item);
    return map;
  }, new Map());

  return appointments.map((appointment) => {
    const doctor = doctorMap.get(toId(appointment.doctor_id));
    const department = departmentMap.get(toId(appointment.department_id));
    const queueTicket = queueMap.get(toId(appointment._id)) || null;
    const enrichedAppointment = {
      ...appointment,
      doctor_name: doctor?.full_name || appointment.doctor_name || '',
      doctor_code: doctor?.employee_code || '',
      doctor_avatar_url: doctor?.avatar_url || '',
      department_name: department?.department_name || appointment.department_name || '',
      department_code: department?.department_code || '',
      location:
        appointment.location ||
        department?.location ||
        department?.room ||
        [department?.building, department?.floor].filter(Boolean).join(' - '),
    };

    return {
      visit_id: toId(appointment._id),
      visit_source: 'appointment',
      visit_date: appointment.appointment_time || appointment.start_time || appointment.created_at,
      encounter: null,
      appointment: enrichedAppointment,
      primary_diagnosis: null,
      diagnoses: [],
      released_records: [],
      lab_results: [],
      imaging_reports: [],
      procedure_results: [],
      prescriptions: [],
      invoices: [],
      queue_ticket: queueTicket,
      counters: {
        released_records: 0,
        lab_results: 0,
        imaging_reports: 0,
        procedure_results: 0,
        prescriptions: 0,
        invoices: 0,
        unpaid_invoices: 0,
      },
    };
  });
}

function visitSortTime(item = {}) {
  return new Date(item.visit_date || item.encounter?.start_time || item.appointment?.appointment_time || 0).getTime() || 0;
}

async function getMyVisits(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor);
  const patientId = patient._id;
  const { page, limit, skip } = getPagination(query);
  const encounterFilter = { patient_id: patientId };
  if (query.status) encounterFilter.status = normalizeString(query.status);
  if (query.encounter_type) encounterFilter.encounter_type = normalizeString(query.encounter_type);
  if (query.released_only === true || query.released_only === 'true') {
    const releasedEncounterIds = await MedicalRecord.distinct('encounter_id', {
      patient_id: patientId,
      released_to_patient: true,
      encounter_id: { $ne: null },
    });
    encounterFilter._id = { $in: releasedEncounterIds };
  }

  const includeAppointmentOnly = !(query.released_only === true || query.released_only === 'true');
  const now = new Date();
  const candidateLimit = Math.min(skip + limit + 50, 200);
  const encounterAppointmentIds = includeAppointmentOnly
    ? await Encounter.distinct('appointment_id', {
      patient_id: patientId,
      appointment_id: { $ne: null },
    })
    : [];
  const appointmentFilter = {
    patient_id: patientId,
    is_deleted: false,
    _id: { $nin: encounterAppointmentIds.filter(Boolean) },
  };
  if (query.status) {
    appointmentFilter.status = normalizeString(query.status);
  } else {
    appointmentFilter.$or = [
      { appointment_time: { $lt: now } },
      { status: { $in: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.RESCHEDULED] } },
    ];
  }
  if (query.encounter_type) appointmentFilter.appointment_type = normalizeString(query.encounter_type);

  const [encounters, encounterTotal, appointments, appointmentTotal] = await Promise.all([
    Encounter.find(encounterFilter).sort({ start_time: -1, created_at: -1 }).limit(candidateLimit).lean(),
    Encounter.countDocuments(encounterFilter),
    includeAppointmentOnly
      ? Appointment.find(appointmentFilter).sort({ appointment_time: -1, created_at: -1 }).limit(candidateLimit).lean()
      : [],
    includeAppointmentOnly ? Appointment.countDocuments(appointmentFilter) : 0,
  ]);
  const [encounterItems, appointmentItems] = await Promise.all([
    buildVisitItems(encounters, patientId),
    buildAppointmentVisitItems(appointments, patientId),
  ]);
  const items = [...encounterItems, ...appointmentItems]
    .sort((left, right) => visitSortTime(right) - visitSortTime(left))
    .slice(skip, skip + limit);

  return {
    items,
    pagination: buildPagination(page, limit, encounterTotal + appointmentTotal),
  };
}

async function getMyVisitDetail(actor = {}, visitId) {
  const patient = await resolvePortalPatient(actor);
  const encounter = await Encounter.findOne({ _id: visitId, patient_id: patient._id }).lean();
  if (encounter) {
    const [item] = await buildVisitItems([encounter], patient._id);
    return item;
  }

  const appointment = await Appointment.findOne({ _id: visitId, patient_id: patient._id, is_deleted: false }).lean();
  if (!appointment) throw createError('Không tìm thấy lượt khám.', 404);
  const [item] = await buildAppointmentVisitItems([appointment], patient._id);
  return item;
}

const PORTAL_BOOKING_SCHEDULE_STATUSES = [SCHEDULE_STATUS.PUBLISHED, SCHEDULE_STATUS.ACTIVE];

function escapeRegex(value) {
  return String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addPortalDays(value, days) {
  const date = startOfLocalDay(value || new Date());
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function portalBookingLimit(value, fallback = 12, max = 50) {
  const parsed = Number(value || fallback);
  return Math.min(Math.max(parsed || fallback, 1), max);
}

function parsePortalBookingDate(value, field = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${field} không hợp lệ.`, 400);
  return date;
}

function portalBookingScheduleFilter(query = {}) {
  const now = new Date();
  const date = parsePortalBookingDate(query.date, 'date');
  const dateFrom = parsePortalBookingDate(query.date_from || query.from, 'date_from');
  const dateTo = parsePortalBookingDate(query.date_to || query.to, 'date_to');
  const filter = {
    is_deleted: false,
    status: { $in: PORTAL_BOOKING_SCHEDULE_STATUSES },
    patient_portal_enabled: { $ne: false },
    staff_only: { $ne: true },
    shift_end: { $gte: now },
  };

  if (query.department_id && isValidObjectId(query.department_id)) filter.department_id = toObjectId(query.department_id);
  if (query.doctor_id && isValidObjectId(query.doctor_id)) filter.doctor_id = toObjectId(query.doctor_id);

  if (date) {
    filter.work_date = { $gte: startOfLocalDay(date), $lte: endOfLocalDay(date) };
  } else if (dateFrom || dateTo) {
    filter.work_date = {};
    if (dateFrom) filter.work_date.$gte = startOfLocalDay(dateFrom);
    if (dateTo) filter.work_date.$lte = endOfLocalDay(dateTo);
  }

  return filter;
}

function parsePortalBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function formatPortalDepartment(department = {}, extra = {}) {
  return {
    department_id: toId(department._id || department.department_id || department.id),
    department_code: department.department_code,
    department_name: department.department_name,
    department_type: department.department_type,
    location_note: department.location_note,
    status: department.status,
    ...extra,
  };
}

function formatPortalDoctor(profile = {}, user = {}, department = {}, extra = {}) {
  return {
    doctor_profile_id: toId(profile._id || profile.doctor_profile_id || profile.id),
    doctor_id: toId(user._id || profile.user_id),
    doctor_code: user.employee_code || '',
    name: user.full_name || user.username || 'Bác sĩ',
    full_name: user.full_name || user.username || 'Bác sĩ',
    specialty: profile.specialty,
    subspecialty: profile.subspecialty || '',
    qualification: profile.qualification || '',
    academic_title: profile.academic_title || '',
    years_of_experience: profile.years_of_experience || 0,
    consultation_duration_minutes: profile.consultation_duration_minutes || 15,
    consultation_fee: profile.consultation_fee || 0,
    avatar_url: profile.avatar_url || user.avatar_url || '',
    department_id: toId(department?._id || profile.department_id),
    department_name: department?.department_name || '',
    department_code: department?.department_code || '',
    ...extra,
  };
}

async function buildPortalBookingReferenceMaps(schedules = []) {
  const doctorIds = [...new Set(schedules.map((item) => toId(item.doctor_id)).filter(Boolean))];
  const departmentIds = [...new Set(schedules.map((item) => toId(item.department_id)).filter(Boolean))];
  const [users, departments, profiles] = await Promise.all([
    doctorIds.length
      ? User.find({ _id: { $in: doctorIds }, is_deleted: false, status: 'active' })
        .select('full_name username employee_code avatar_url')
        .lean()
      : [],
    departmentIds.length
      ? Department.find({ _id: { $in: departmentIds }, is_deleted: false, status: 'active' })
        .select('department_code department_name department_type location_note status')
        .lean()
      : [],
    doctorIds.length
      ? DoctorProfile.find({ user_id: { $in: doctorIds }, is_deleted: false, status: 'active' })
        .select('user_id department_id specialty subspecialty qualification academic_title years_of_experience consultation_duration_minutes consultation_fee avatar_url')
        .lean()
      : [],
  ]);

  return {
    userMap: new Map(users.map((item) => [toId(item._id), item])),
    departmentMap: new Map(departments.map((item) => [toId(item._id), item])),
    profileMap: new Map(profiles.map((item) => [toId(item.user_id), item])),
  };
}

function formatPortalBookingSlot(schedule = {}, slot = {}, refs = {}) {
  const user = refs.userMap?.get(toId(schedule.doctor_id)) || {};
  const department = refs.departmentMap?.get(toId(schedule.department_id)) || {};
  const profile = refs.profileMap?.get(toId(schedule.doctor_id)) || {};
  const fee = Number(profile.consultation_fee || 0);

  return {
    schedule_id: toId(schedule._id),
    doctor_schedule_id: toId(schedule._id),
    doctor_id: toId(schedule.doctor_id),
    doctor_name: user.full_name || user.username || '',
    doctor_code: user.employee_code || '',
    department_id: toId(schedule.department_id),
    department_name: department.department_name || '',
    department_code: department.department_code || '',
    specialty: profile.specialty || department.department_name || '',
    slot_time: slot.slot_time,
    slot_end: slot.slot_end,
    is_available: Boolean(slot.is_available),
    is_booked: Boolean(slot.is_booked),
    is_blocked: Boolean(slot.is_blocked),
    estimated_fee: fee,
    requires_prepayment: fee > 0 && fee >= 500000,
    preparation_conditions: [
      'Đến sớm 15 phút để làm thủ tục.',
      'Mang theo giấy tờ tùy thân và thẻ bảo hiểm nếu có.',
    ],
    reschedule_policy: 'Có thể dời/hủy trước giờ khám theo chính sách của bệnh viện.',
  };
}

async function getPortalBookingDepartments(actor = {}, query = {}) {
  await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]);
  const { page, limit, skip } = getPagination(query);
  const scheduleFilter = portalBookingScheduleFilter(query);
  const departmentIds = await DoctorSchedule.distinct('department_id', scheduleFilter);
  const filter = {
    _id: { $in: departmentIds },
    is_deleted: false,
    status: 'active',
  };
  const keyword = escapeRegex(query.search || query.keyword || query.q);
  if (keyword) {
    filter.$or = [
      { department_name: { $regex: keyword, $options: 'i' } },
      { department_code: { $regex: keyword, $options: 'i' } },
      { department_type: { $regex: keyword, $options: 'i' } },
    ];
  }

  const [items, total, counts] = await Promise.all([
    Department.find(filter).sort({ department_name: 1 }).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
    DoctorSchedule.aggregate([
      { $match: scheduleFilter },
      { $group: { _id: '$department_id', available_schedule_count: { $sum: 1 }, doctor_count: { $addToSet: '$doctor_id' } } },
      { $project: { available_schedule_count: 1, doctor_count: { $size: '$doctor_count' } } },
    ]),
  ]);
  const countMap = new Map(counts.map((item) => [toId(item._id), item]));

  return {
    items: items.map((department) => {
      const count = countMap.get(toId(department._id)) || {};
      return formatPortalDepartment(department, {
        available_schedule_count: count.available_schedule_count || 0,
        doctor_count: count.doctor_count || 0,
      });
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function getPortalBookingDoctors(actor = {}, query = {}) {
  await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]);
  const { page, limit, skip } = getPagination(query);
  const scheduleFilter = portalBookingScheduleFilter(query);
  const includeUnavailable = parsePortalBoolean(query.include_unavailable || query.include_unavailable_doctors);
  const doctorIds = includeUnavailable ? [] : await DoctorSchedule.distinct('doctor_id', scheduleFilter);
  const profileFilter = {
    is_deleted: false,
    status: 'active',
    public_profile_enabled: { $ne: false },
  };
  if (!includeUnavailable) {
    profileFilter.user_id = { $in: doctorIds };
  } else if (query.doctor_id && isValidObjectId(query.doctor_id)) {
    profileFilter.user_id = toObjectId(query.doctor_id);
  }
  if (query.department_id && isValidObjectId(query.department_id)) {
    profileFilter.department_id = toObjectId(query.department_id);
  }
  const keyword = escapeRegex(query.search || query.keyword || query.q);
  if (keyword) {
    profileFilter.$or = [
      { specialty: { $regex: keyword, $options: 'i' } },
      { subspecialty: { $regex: keyword, $options: 'i' } },
      { qualification: { $regex: keyword, $options: 'i' } },
    ];
  }

  const [profiles, total] = await Promise.all([
    DoctorProfile.find(profileFilter)
      .sort({ specialty: 1, years_of_experience: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorProfile.countDocuments(profileFilter),
  ]);
  const selectedDoctorIds = profiles.map((item) => item.user_id).filter(Boolean);
  const departmentIds = profiles.map((item) => item.department_id).filter(Boolean);
  const [users, departments, nextSchedules] = await Promise.all([
    selectedDoctorIds.length
      ? User.find({ _id: { $in: selectedDoctorIds }, is_deleted: false, status: 'active' })
        .select('full_name username employee_code avatar_url')
        .lean()
      : [],
    departmentIds.length
      ? Department.find({ _id: { $in: departmentIds }, is_deleted: false })
        .select('department_code department_name department_type location_note status')
        .lean()
      : [],
    selectedDoctorIds.length
      ? DoctorSchedule.find({ ...scheduleFilter, doctor_id: { $in: selectedDoctorIds } })
        .sort({ work_date: 1, shift_start: 1 })
        .select('_id doctor_id work_date shift_start shift_end')
        .lean()
      : [],
  ]);
  const userMap = new Map(users.map((item) => [toId(item._id), item]));
  const departmentMap = new Map(departments.map((item) => [toId(item._id), item]));
  const nextScheduleMap = new Map();
  nextSchedules.forEach((schedule) => {
    const key = toId(schedule.doctor_id);
    if (!nextScheduleMap.has(key)) nextScheduleMap.set(key, schedule);
  });

  return {
    items: profiles
      .filter((profile) => userMap.has(toId(profile.user_id)))
      .map((profile) => {
        const user = userMap.get(toId(profile.user_id));
        const department = departmentMap.get(toId(profile.department_id));
        const nextSchedule = nextScheduleMap.get(toId(profile.user_id));
        return formatPortalDoctor(profile, user, department, {
          next_available_at: nextSchedule?.shift_start || nextSchedule?.work_date || null,
          next_schedule_id: nextSchedule ? toId(nextSchedule._id) : null,
        });
      }),
    pagination: buildPagination(page, limit, total),
  };
}

async function getPortalBookingSlots(actor = {}, query = {}) {
  await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]);
  const limit = portalBookingLimit(query.limit, 30, 100);
  const scheduleFilter = portalBookingScheduleFilter({
    ...query,
    date_from: query.date ? undefined : query.date_from,
    date_to: query.date ? undefined : query.date_to,
  });
  if (!query.date && !query.date_from && !query.date_to) {
    scheduleFilter.work_date = { $gte: startOfLocalDay(new Date()), $lte: addPortalDays(new Date(), 7) };
  }
  const schedules = await DoctorSchedule.find(scheduleFilter)
    .sort({ work_date: 1, shift_start: 1 })
    .limit(50)
    .lean();
  const refs = await buildPortalBookingReferenceMaps(schedules);
  const now = new Date();
  const items = [];

  for (const schedule of schedules) {
    if (items.length >= limit) break;
    // eslint-disable-next-line no-await-in-loop
    const slots = await scheduleService.getAvailableSlots(schedule._id, { publicView: true, onlyAvailable: true });
    for (const slot of slots.items || []) {
      if (items.length >= limit) break;
      const slotTime = new Date(slot.slot_time);
      if (Number.isNaN(slotTime.getTime()) || slotTime <= now) continue;
      items.push(formatPortalBookingSlot(schedule, slot, refs));
    }
  }

  return {
    items: items.sort((left, right) => new Date(left.slot_time) - new Date(right.slot_time)),
    pagination: {
      page: 1,
      limit,
      total: items.length,
    },
  };
}

async function getPortalBookingRecentDoctors(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]);
  const limit = portalBookingLimit(query.limit, 6, 20);
  const appointments = await Appointment.find({
    patient_id: patient._id,
    is_deleted: false,
    doctor_id: { $ne: null },
  })
    .sort({ appointment_time: -1, created_at: -1 })
    .select('doctor_id department_id appointment_time status')
    .limit(50)
    .lean();
  const doctorIds = [...new Set(appointments.map((item) => toId(item.doctor_id)).filter(Boolean))].slice(0, limit);
  if (!doctorIds.length) return { items: [], pagination: { page: 1, limit, total: 0 } };

  const [profiles, users, departments] = await Promise.all([
    DoctorProfile.find({ user_id: { $in: doctorIds }, is_deleted: false, status: 'active' }).lean(),
    User.find({ _id: { $in: doctorIds }, is_deleted: false, status: 'active' })
      .select('full_name username employee_code avatar_url')
      .lean(),
    Department.find({ _id: { $in: appointments.map((item) => item.department_id).filter(Boolean) }, is_deleted: false })
      .select('department_code department_name department_type location_note status')
      .lean(),
  ]);
  const profileMap = new Map(profiles.map((item) => [toId(item.user_id), item]));
  const userMap = new Map(users.map((item) => [toId(item._id), item]));
  const departmentMap = new Map(departments.map((item) => [toId(item._id), item]));
  const lastAppointmentMap = new Map();
  appointments.forEach((appointment) => {
    const key = toId(appointment.doctor_id);
    if (!lastAppointmentMap.has(key)) lastAppointmentMap.set(key, appointment);
  });

  const items = doctorIds
    .map((doctorId) => {
      const profile = profileMap.get(doctorId);
      const user = userMap.get(doctorId);
      const lastAppointment = lastAppointmentMap.get(doctorId);
      if (!profile || !user) return null;
      return formatPortalDoctor(profile, user, departmentMap.get(toId(profile.department_id || lastAppointment?.department_id)), {
        last_appointment_at: lastAppointment?.appointment_time || null,
        last_appointment_status: lastAppointment?.status || null,
      });
    })
    .filter(Boolean);

  return { items, pagination: { page: 1, limit, total: items.length } };
}

async function getPortalBookingRecommendedSlots(actor = {}, query = {}) {
  return getPortalBookingSlots(actor, {
    ...query,
    date_from: query.date_from || new Date().toISOString(),
    date_to: query.date_to || addPortalDays(new Date(), Number(query.days || 14)).toISOString(),
    limit: query.limit || 8,
  });
}

function normalizeProfileChangeValue(changeType, payload = {}) {
  if (!PATIENT_PROFILE_CHANGE_TYPES.includes(changeType)) {
    throw createError('change_type không hợp lệ.', 422);
  }

  const source = payload.new_value && typeof payload.new_value === 'object'
    ? payload.new_value
    : payload;
  const allowedFields = PROFILE_CHANGE_FIELDS[changeType] || [];
  const value = {};

  for (const field of allowedFields) {
    if (hasOwn(source, field)) value[field] = source[field];
  }

  if (changeType === PATIENT_PROFILE_CHANGE_TYPE.BASIC_INFO && hasOwn(value, 'gender') && !GENDERS.includes(value.gender)) {
    throw createError('gender không hợp lệ.', 422);
  }

  if (Object.keys(value).length === 0) {
    throw createError('new_value không có trường hợp lệ cho change_type đã chọn.', 422);
  }

  return value;
}

function pickPatientFields(patient = {}, fields = []) {
  return compactObject(Object.fromEntries(fields.map((field) => [field, patient[field]])));
}

async function createProfileChangeRequest(actor = {}, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const changeType = payload.change_type || payload.changeType;
  const newValue = normalizeProfileChangeValue(changeType, payload);
  const oldValueSnapshot = pickPatientFields(patient, PROFILE_CHANGE_FIELDS[changeType]);
  const changedFields = Object.keys(newValue);

  const pendingRequests = await PatientProfileChangeRequest.find({
    patient_id: patient._id,
    change_type: changeType,
    status: PATIENT_PROFILE_CHANGE_STATUS.PENDING,
  }).select('_id new_value').lean();
  const duplicate = pendingRequests.find((request) => {
    const pendingValue = request.new_value || {};
    return changedFields.some((field) => hasOwn(pendingValue, field));
  });
  if (duplicate) {
    throw createError('Đã có yêu cầu thay đổi pending cho một trong các trường này.', 409);
  }

  const request = await PatientProfileChangeRequest.create({
    patient_id: patient._id,
    requested_by_actor: buildActorSnapshot(actor),
    change_type: changeType,
    old_value_snapshot: oldValueSnapshot,
    new_value: newValue,
    status: PATIENT_PROFILE_CHANGE_STATUS.PENDING,
    reason: payload.reason,
  });

  await recordAuditLog({
    actor,
    action: 'portal.profile_change_request.create',
    targetType: 'patient_profile_change_request',
    targetId: request._id,
    status: 'success',
    message: 'Tạo yêu cầu thay đổi hồ sơ bệnh nhân.',
    requestMeta,
    metadata: {
      patient_id: toId(patient._id),
      change_type: changeType,
    },
    after: request.toObject(),
  });

  return request.toObject();
}

async function listProfileChangeRequests(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patient._id };
  if (query.status) filter.status = query.status;
  if (query.change_type) filter.change_type = query.change_type;

  const [items, total] = await Promise.all([
    PatientProfileChangeRequest.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    PatientProfileChangeRequest.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
}

function assertCanReviewProfileChange(changeRequest, actor = {}) {
  if (changeRequest.change_type === PATIENT_PROFILE_CHANGE_TYPE.IDENTITY) {
    if (!hasPermission(actor, PERMISSION.PATIENTS.UPDATE_SENSITIVE)) {
      throw createError('Duyệt thay đổi định danh cần quyền patients.update_sensitive.', 403);
    }
    return;
  }

  if (!permissionService.hasAnyPermission(actor.permissions || [], [
    PERMISSION.PATIENTS.UPDATE,
    PERMISSION.PATIENTS.UPDATE_BASIC,
    PERMISSION.PATIENTS.UPDATE_SENSITIVE,
  ])) {
    throw createError('Tài khoản hiện tại không có quyền duyệt thay đổi hồ sơ bệnh nhân.', 403);
  }
}

async function approveProfileChangeRequest(patientId, requestId, actor = {}, payload = {}, requestMeta = {}) {
  const changeRequest = await PatientProfileChangeRequest.findOne({
    _id: requestId,
    patient_id: patientId,
  });

  if (!changeRequest) throw createError('Không tìm thấy yêu cầu thay đổi hồ sơ.', 404);
  if (changeRequest.status !== PATIENT_PROFILE_CHANGE_STATUS.PENDING) {
    throw createError('Chỉ yêu cầu pending mới được duyệt.', 409);
  }

  assertCanReviewProfileChange(changeRequest, actor);

  const before = changeRequest.toObject();
  await patientService.updatePatient(patientId, changeRequest.new_value, {
    ...actor,
    allowVerifiedIdentityOverride: true,
  }, requestMeta);

  changeRequest.status = PATIENT_PROFILE_CHANGE_STATUS.APPROVED;
  changeRequest.reviewed_by = buildActorSnapshot(actor);
  changeRequest.reviewed_at = new Date();
  changeRequest.reason = payload.reason || changeRequest.reason;
  await changeRequest.save();

  await recordAuditLog({
    actor,
    action: 'portal.profile_change_request.approve',
    targetType: 'patient_profile_change_request',
    targetId: changeRequest._id,
    status: 'success',
    message: 'Duyệt yêu cầu thay đổi hồ sơ bệnh nhân.',
    requestMeta,
    before,
    after: changeRequest.toObject(),
    metadata: {
      patient_id: toId(patientId),
      change_type: changeRequest.change_type,
    },
  });

  return changeRequest.toObject();
}

async function rejectProfileChangeRequest(patientId, requestId, actor = {}, payload = {}, requestMeta = {}) {
  const changeRequest = await PatientProfileChangeRequest.findOne({
    _id: requestId,
    patient_id: patientId,
  });

  if (!changeRequest) throw createError('Không tìm thấy yêu cầu thay đổi hồ sơ.', 404);
  if (changeRequest.status !== PATIENT_PROFILE_CHANGE_STATUS.PENDING) {
    throw createError('Chỉ yêu cầu pending mới được từ chối.', 409);
  }

  assertCanReviewProfileChange(changeRequest, actor);
  const reason = payload.reason || payload.reject_reason;
  if (!reason) {
    throw createError('reject_reason là bắt buộc khi từ chối yêu cầu thay đổi hồ sơ.', 422);
  }

  const before = changeRequest.toObject();
  changeRequest.status = PATIENT_PROFILE_CHANGE_STATUS.REJECTED;
  changeRequest.reviewed_by = buildActorSnapshot(actor);
  changeRequest.reviewed_at = new Date();
  changeRequest.reason = reason;
  await changeRequest.save();

  await recordAuditLog({
    actor,
    action: 'portal.profile_change_request.reject',
    targetType: 'patient_profile_change_request',
    targetId: changeRequest._id,
    status: 'success',
    message: 'Từ chối yêu cầu thay đổi hồ sơ bệnh nhân.',
    requestMeta,
    before,
    after: changeRequest.toObject(),
    metadata: {
      patient_id: toId(patientId),
      change_type: changeRequest.change_type,
    },
  });

  return changeRequest.toObject();
}

async function cancelProfileChangeRequest(actor = {}, requestId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const changeRequest = await PatientProfileChangeRequest.findOne({
    _id: requestId,
    patient_id: patient._id,
  });

  if (!changeRequest) throw createError('Không tìm thấy yêu cầu thay đổi hồ sơ.', 404);
  if (changeRequest.status !== PATIENT_PROFILE_CHANGE_STATUS.PENDING) {
    throw createError('Chỉ yêu cầu pending mới được hủy.', 409);
  }

  const before = changeRequest.toObject();
  changeRequest.status = PATIENT_PROFILE_CHANGE_STATUS.CANCELLED;
  changeRequest.reviewed_by = buildActorSnapshot(actor);
  changeRequest.reviewed_at = new Date();
  changeRequest.reason = payload.reason || payload.cancel_reason || changeRequest.reason;
  await changeRequest.save();

  await recordAuditLog({
    actor,
    action: 'portal.profile_change_request.cancel',
    targetType: 'patient_profile_change_request',
    targetId: changeRequest._id,
    status: 'success',
    message: 'Hủy yêu cầu thay đổi hồ sơ bệnh nhân.',
    requestMeta,
    before,
    after: changeRequest.toObject(),
    metadata: {
      patient_id: toId(patient._id),
      change_type: changeRequest.change_type,
    },
  });

  return changeRequest.toObject();
}

function buildPatientAccessLogFilter(patientId) {
  const objectId = isValidObjectId(patientId) ? toObjectId(patientId, 'patientId') : patientId;
  const ids = [...new Set([patientId, objectId].filter(Boolean))];

  return {
    $or: [
      { target_type: 'patient', target_id: objectId },
      { target_type: { $in: ACCESS_LOG_TARGET_TYPES }, 'metadata.patient_id': { $in: ids } },
      { target_type: { $in: ACCESS_LOG_TARGET_TYPES }, 'metadata.patientId': { $in: ids } },
      { 'metadata.patient_id': { $in: ids } },
      { 'metadata.patientId': { $in: ids } },
    ],
  };
}

function inferAccessVerb(action = '') {
  if (action.includes('download')) return 'downloaded';
  if (action.includes('export')) return 'exported';
  if (action.includes('read') || action.includes('view') || action.includes('detail')) return 'viewed';
  if (action.includes('create')) return 'created';
  if (action.includes('update')) return 'updated';
  return 'accessed';
}

function humanizeTarget(targetType = 'record') {
  return String(targetType || 'record').replace(/_/g, ' ');
}

async function buildActorLabelMaps(logs = []) {
  const staffIds = [];
  const patientAccountIds = [];
  const relativeIds = [];

  logs.forEach((log) => {
    const id = toId(log.actor_id);
    if (!id || !isValidObjectId(id)) return;
    if (log.actor_type === ACTOR_TYPE.STAFF) staffIds.push(id);
    if (log.actor_type === ACTOR_TYPE.PATIENT) patientAccountIds.push(id);
    if (log.actor_type === ACTOR_TYPE.PATIENT_RELATIVE) relativeIds.push(id);
  });

  const [staff, accounts, relatives] = await Promise.all([
    staffIds.length ? User.find({ _id: { $in: [...new Set(staffIds)] } }).select('full_name employee_code').lean() : [],
    patientAccountIds.length ? PatientAccount.find({ _id: { $in: [...new Set(patientAccountIds)] } }).select('username email phone').lean() : [],
    relativeIds.length ? PatientRelative.find({ _id: { $in: [...new Set(relativeIds)] } }).select('full_name relationship').lean() : [],
  ]);

  return {
    staff: new Map(staff.map((item) => [toId(item._id), item])),
    patient_accounts: new Map(accounts.map((item) => [toId(item._id), item])),
    relatives: new Map(relatives.map((item) => [toId(item._id), item])),
  };
}

function actorLabel(log, maps) {
  const id = toId(log.actor_id);
  if (log.actor_type === ACTOR_TYPE.STAFF) {
    const staff = maps.staff.get(id);
    return staff?.full_name || staff?.employee_code || `staff ${id}`;
  }
  if (log.actor_type === ACTOR_TYPE.PATIENT) {
    const account = maps.patient_accounts.get(id);
    return account?.username || account?.email || account?.phone || 'patient';
  }
  if (log.actor_type === ACTOR_TYPE.PATIENT_RELATIVE) {
    const relative = maps.relatives.get(id);
    return relative?.full_name || 'relative';
  }
  return log.actor_type || 'system';
}

function serializeAccessLog(log, maps) {
  const label = actorLabel(log, maps);
  const verb = inferAccessVerb(log.action);
  const target = humanizeTarget(log.target_type);

  return {
    log_id: toId(log._id),
    occurred_at: log.created_at,
    actor_type: log.actor_type,
    actor_id: toId(log.actor_id),
    actor_label: label,
    action: log.action,
    target_type: log.target_type,
    target_id: toId(log.target_id),
    summary: `${label} ${verb} ${target}`.trim(),
    message: log.message,
  };
}

async function getMyAccessLogs(actor = {}, query = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor);
  const { page, limit, skip } = getPagination(query);
  const filter = buildPatientAccessLogFilter(toId(patient._id));
  if (query.action) filter.action = String(query.action).trim();
  if (query.target_type) filter.target_type = String(query.target_type).trim();

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const maps = await buildActorLabelMaps(logs);

  await recordAuditLog({
    actor,
    action: 'portal.access_logs.read',
    targetType: 'patient',
    targetId: patient._id,
    status: 'success',
    message: 'Bệnh nhân xem nhật ký truy cập hồ sơ.',
    requestMeta,
    metadata: { patient_id: toId(patient._id) },
  });

  return {
    items: logs.map((log) => serializeAccessLog(log, maps)),
    pagination: buildPagination(page, limit, total),
  };
}

function requirePatientUploadAttachment(attachment = {}, patientId) {
  if (!attachment) throw createError('Không tìm thấy document.', 404);
  if (toId(attachment.patient_id) !== toId(patientId)) throw createError('Document không thuộc patient hiện tại.', 403);
  if (attachment.source !== DOCUMENT_SOURCE.PATIENT_UPLOAD) {
    throw createError('Patient chỉ được archive/delete document do chính mình upload.', 403);
  }
}

function normalizeDocumentUploadPayload(payload = {}) {
  const fileName = normalizeString(payload.file_name || payload.fileName || payload.original_name || payload.originalName);
  const storagePath = normalizeString(payload.storage_path || payload.storagePath || payload.url || payload.file_url);
  if (!fileName) throw createError('file_name là bắt buộc.', 422);
  if (!storagePath) throw createError('storage_path là bắt buộc.', 422);
  return {
    file_name: fileName,
    original_name: normalizeString(payload.original_name || payload.originalName) || fileName,
    mime_type: normalizeString(payload.mime_type || payload.mimeType),
    file_size: payload.file_size || payload.fileSize,
    storage_path: storagePath,
    storage_provider: normalizeString(payload.storage_provider || payload.storageProvider) || 'local',
    storage_key: normalizeString(payload.storage_key || payload.storageKey) || storagePath,
    checksum: normalizeString(payload.checksum),
    checksum_sha256: normalizeString(payload.checksum_sha256 || payload.checksumSha256 || payload.sha256),
    scan_status: 'pending',
    category: normalizeString(payload.category) || 'other',
    description: payload.description,
  };
}

async function uploadMyDocument(actor = {}, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const normalized = normalizeDocumentUploadPayload(payload);
  const attachment = await Attachment.create({
    patient_id: patient._id,
    entity_type: ATTACHMENT_ENTITY_TYPE.PATIENT,
    entity_id: patient._id,
    ...normalized,
    source: DOCUMENT_SOURCE.PATIENT_UPLOAD,
    review_status: DOCUMENT_REVIEW_STATUS.PENDING,
    submitted_for_review_at: new Date(),
    visibility: DOCUMENT_VISIBILITY.PATIENT_VISIBLE,
    released_to_patient: true,
    released_at: new Date(),
    status: ATTACHMENT_STATUS.ACTIVE,
  });
  await recordAuditLog({
    actor,
    action: 'attachment.upload_patient',
    targetType: 'attachment',
    targetId: attachment._id,
    status: 'success',
    message: 'Patient upload document.',
    requestMeta,
    metadata: { patient_id: toId(patient._id), category: attachment.category },
  });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.DOCUMENT_UPLOADED,
    aggregateType: 'attachment',
    aggregateId: attachment._id,
    recipientScope: {
      patient_id: patient._id,
      recipients: [{ recipient_type: 'patient', recipient_id: patient._id, patient_id: patient._id }],
    },
    payload: {
      attachment_id: toId(attachment._id),
      category: attachment.category,
      notification: {
        title: 'Tài liệu đã được tải lên',
        body: attachment.original_name || attachment.file_name,
        priority: 'normal',
      },
    },
  });
  return attachment.toObject();
}

async function listMyDocuments(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor);
  const { page, limit, skip } = getPagination(query);
  const filter = {
    patient_id: patient._id,
    status: query.include_archived ? { $in: [ATTACHMENT_STATUS.ACTIVE, ATTACHMENT_STATUS.ARCHIVED] } : ATTACHMENT_STATUS.ACTIVE,
    $or: [
      { released_to_patient: true },
      { source: DOCUMENT_SOURCE.PATIENT_UPLOAD },
    ],
  };
  for (const field of ['category', 'review_status', 'source', 'visibility']) {
    if (query[field]) filter[field] = query[field];
  }
  const [items, total] = await Promise.all([
    Attachment.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Attachment.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getMyDocument(actor = {}, attachmentId) {
  const patient = await resolvePortalPatient(actor);
  const attachment = await Attachment.findOne({
    _id: attachmentId,
    patient_id: patient._id,
    status: { $ne: ATTACHMENT_STATUS.DELETED },
    $or: [{ released_to_patient: true }, { source: DOCUMENT_SOURCE.PATIENT_UPLOAD }],
  }).lean();
  if (!attachment) throw createError('Không tìm thấy document.', 404);
  return attachment;
}

async function archiveMyDocument(actor = {}, attachmentId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const attachment = await Attachment.findById(attachmentId);
  requirePatientUploadAttachment(attachment, patient._id);
  attachment.status = ATTACHMENT_STATUS.ARCHIVED;
  attachment.archived_by_patient = true;
  attachment.archived_at = new Date();
  attachment.archive_reason = payload.reason || payload.archive_reason;
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachment.archive_patient', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Patient archive document.', requestMeta });
  return attachment.toObject();
}

async function restoreMyDocument(actor = {}, attachmentId, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const attachment = await Attachment.findById(attachmentId);
  requirePatientUploadAttachment(attachment, patient._id);
  attachment.status = ATTACHMENT_STATUS.ACTIVE;
  attachment.archived_by_patient = false;
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachment.restore_patient', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Patient restore document.', requestMeta });
  return attachment.toObject();
}

async function deleteMyDocument(actor = {}, attachmentId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const attachment = await Attachment.findById(attachmentId);
  requirePatientUploadAttachment(attachment, patient._id);
  attachment.status = ATTACHMENT_STATUS.DELETED;
  attachment.deleted_at = new Date();
  attachment.delete_reason = payload.reason || payload.delete_reason || 'patient_deleted';
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachment.delete_patient', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Patient soft-delete document.', requestMeta });
  return { deleted: true, attachment_id: toId(attachment._id) };
}

async function submitMyDocumentReview(actor = {}, attachmentId, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const attachment = await Attachment.findById(attachmentId);
  requirePatientUploadAttachment(attachment, patient._id);
  attachment.review_status = DOCUMENT_REVIEW_STATUS.PENDING;
  attachment.submitted_for_review_at = new Date();
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachment.submit_review', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Patient submit document for review.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.DOCUMENT_REVIEW_REQUESTED,
    aggregateType: 'attachment',
    aggregateId: attachment._id,
    recipientScope: {
      patient_id: patient._id,
      role: ['medical_record_staff', 'admin'],
    },
    payload: {
      attachment_id: toId(attachment._id),
      patient_id: toId(patient._id),
      category: attachment.category,
    },
  });
  return attachment.toObject();
}

async function reviewPatientDocument(attachmentId, accepted, payload = {}, actor = {}, requestMeta = {}) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy document.', 404);
  attachment.review_status = accepted ? DOCUMENT_REVIEW_STATUS.ACCEPTED : DOCUMENT_REVIEW_STATUS.REJECTED;
  attachment.review_note = payload.review_note || payload.reason || payload.note;
  attachment.reviewed_by = actor.userId;
  attachment.reviewed_at = new Date();
  attachment.archived_by_staff = false;
  if (accepted) {
    attachment.visibility = payload.visibility || DOCUMENT_VISIBILITY.PATIENT_VISIBLE;
  }
  await attachment.save();
  await recordAuditLog({
    actor,
    action: accepted ? 'attachment.approve' : 'attachment.reject',
    targetType: 'attachment',
    targetId: attachment._id,
    status: 'success',
    message: accepted ? 'Approve patient document.' : 'Reject patient document.',
    requestMeta,
    metadata: { patient_id: toId(attachment.patient_id) },
  });
  await eventBus.publishDomainEvent({
    eventType: accepted ? REALTIME_EVENT_TYPE.DOCUMENT_APPROVED : REALTIME_EVENT_TYPE.DOCUMENT_REJECTED,
    aggregateType: 'attachment',
    aggregateId: attachment._id,
    recipientScope: {
      patient_id: attachment.patient_id,
      recipients: [{ recipient_type: 'patient', recipient_id: attachment.patient_id, patient_id: attachment.patient_id }],
    },
    payload: {
      attachment_id: toId(attachment._id),
      review_status: attachment.review_status,
      review_note: attachment.review_note,
      notification: {
        title: accepted ? 'Tài liệu đã được duyệt' : 'Tài liệu bị từ chối',
        body: attachment.review_note || attachment.original_name || attachment.file_name,
        priority: accepted ? 'normal' : 'high',
      },
    },
  });
  return attachment.toObject();
}

async function createDocumentExport(actor = {}, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor);
  const attachmentIds = Array.isArray(payload.selected_attachment_ids || payload.selectedAttachmentIds)
    ? (payload.selected_attachment_ids || payload.selectedAttachmentIds)
    : [];
  if (attachmentIds.length === 0) throw createError('selected_attachment_ids không được rỗng.', 422);
  const attachments = await Attachment.find({
    _id: { $in: attachmentIds },
    patient_id: patient._id,
    status: ATTACHMENT_STATUS.ACTIVE,
    $or: [{ released_to_patient: true }, { source: DOCUMENT_SOURCE.PATIENT_UPLOAD }],
  }).lean();
  if (attachments.length !== attachmentIds.length) {
    throw createError('Có document không thuộc quyền tải của patient.', 403);
  }
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const request = await DocumentExportRequest.create({
    request_code: generateDateCode('DEX'),
    patient_id: patient._id,
    requested_by_actor_type: actorType(actor),
    requested_by_actor_id: actorId(actor),
    export_type: payload.export_type || DOCUMENT_EXPORT_TYPE.ATTACHMENTS_ZIP,
    selected_attachment_ids: attachmentIds,
    status: payload.file_url ? DOCUMENT_EXPORT_STATUS.READY : DOCUMENT_EXPORT_STATUS.PROCESSING,
    file_url: payload.file_url,
    expires_at: expiresAt,
    metadata: {
      attachment_count: attachments.length,
      mode: payload.file_url ? 'external_file' : 'zip_worker_required',
    },
  });
  await recordAuditLog({ actor, action: 'record.export_zip', targetType: 'document_export_request', targetId: request._id, status: 'success', message: 'Patient request document export zip.', requestMeta, metadata: { patient_id: toId(patient._id), attachment_count: attachments.length } });
  await eventBus.publishDomainEvent({
    eventType: payload.file_url ? REALTIME_EVENT_TYPE.DOCUMENT_EXPORT_READY : REALTIME_EVENT_TYPE.DOCUMENT_EXPORT_REQUESTED,
    aggregateType: 'document_export_request',
    aggregateId: request._id,
    recipientScope: {
      patient_id: patient._id,
      recipients: [{ recipient_type: 'patient', recipient_id: patient._id, patient_id: patient._id }],
    },
    payload: {
      export_id: toId(request._id),
      status: request.status,
      attachment_count: attachments.length,
      notification: {
        title: payload.file_url ? 'Gói tài liệu đã sẵn sàng' : 'Đang chuẩn bị gói tài liệu',
        body: payload.file_url ? 'Bạn có thể tải file ZIP tài liệu.' : 'Hệ thống đang xử lý yêu cầu xuất ZIP.',
        priority: 'normal',
      },
    },
  });
  return request.toObject();
}

async function getDocumentExport(actor = {}, requestId) {
  const patient = await resolvePortalPatient(actor);
  const request = await DocumentExportRequest.findOne({ _id: requestId, patient_id: patient._id }).lean();
  if (!request) throw createError('Không tìm thấy document export.', 404);
  return request;
}

async function downloadDocumentExport(actor = {}, requestId, requestMeta = {}) {
  const request = await getDocumentExport(actor, requestId);
  if (request.expires_at && request.expires_at < new Date()) throw createError('Document export đã hết hạn.', 410);
  if (request.status !== DOCUMENT_EXPORT_STATUS.READY) throw createError('Document export chưa ready.', 409);
  await recordAuditLog({ actor, action: 'record.download', targetType: 'document_export_request', targetId: request._id, status: 'success', message: 'Download document export zip.', requestMeta, metadata: { patient_id: toId(request.patient_id) } });
  return { export: request, download_url: request.file_url };
}

function serializeRelative(relative = {}, authorizationCount = {}) {
  return {
    relative_id: toId(relative._id || relative.relative_id || relative.id),
    patient_id: toId(relative.patient_id),
    full_name: relative.full_name,
    relationship: relative.relationship,
    phone: relative.phone || '',
    email: relative.email || '',
    address: relative.address || '',
    is_emergency_contact: Boolean(relative.is_emergency_contact),
    is_primary_contact: Boolean(relative.is_primary_contact),
    relationship_verified: Boolean(relative.relationship_verified),
    status: relative.status,
    created_at: relative.created_at,
    updated_at: relative.updated_at,
    authorization_active_count: authorizationCount.active || 0,
    authorization_pending_count: authorizationCount.pending || 0,
    authorization_total_count: authorizationCount.total || 0,
  };
}

function serializeAuthorization(authorization = {}) {
  const relative = authorization.relative_id && typeof authorization.relative_id === 'object'
    ? authorization.relative_id
    : null;

  return {
    authorization_id: toId(authorization._id || authorization.authorization_id || authorization.id),
    patient_id: toId(authorization.patient_id),
    relative_id: toId(relative?._id || authorization.relative_id),
    relative: relative
      ? {
          relative_id: toId(relative._id),
          full_name: relative.full_name,
          relationship: relative.relationship,
          phone: relative.phone || '',
          email: relative.email || '',
          status: relative.status,
          relationship_verified: Boolean(relative.relationship_verified),
        }
      : null,
    authorization_type: authorization.authorization_type,
    permissions: authorization.permissions || [],
    valid_from: authorization.valid_from,
    valid_to: authorization.valid_to,
    approved_at: authorization.approved_at,
    revoked_at: authorization.revoked_at,
    revoke_reason: authorization.revoke_reason || '',
    status: authorization.status,
    created_at: authorization.created_at,
    updated_at: authorization.updated_at,
  };
}

function normalizePortalDate(value, field) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError(`${field} không hợp lệ.`, 422);
  }
  return date;
}

function normalizeRelativePayload(payload = {}, { partial = false } = {}) {
  const fullName = normalizeString(payload.full_name || payload.fullName);
  const relationship = normalizeString(payload.relationship);

  if (!partial && !fullName) throw createError('full_name là bắt buộc.', 422);
  if (!partial && !relationship) throw createError('relationship là bắt buộc.', 422);

  return compactObject({
    ...(fullName ? { full_name: fullName } : {}),
    ...(relationship ? { relationship } : {}),
    phone: hasOwn(payload, 'phone') ? normalizeString(payload.phone) || undefined : undefined,
    email: hasOwn(payload, 'email') ? normalizeString(payload.email).toLowerCase() || undefined : undefined,
    address: hasOwn(payload, 'address') ? normalizeString(payload.address) || undefined : undefined,
    national_id: hasOwn(payload, 'national_id') || hasOwn(payload, 'nationalId')
      ? normalizeString(payload.national_id || payload.nationalId) || undefined
      : undefined,
    is_emergency_contact: hasOwn(payload, 'is_emergency_contact') || hasOwn(payload, 'isEmergencyContact')
      ? Boolean(payload.is_emergency_contact ?? payload.isEmergencyContact)
      : undefined,
    is_primary_contact: hasOwn(payload, 'is_primary_contact') || hasOwn(payload, 'isPrimaryContact')
      ? Boolean(payload.is_primary_contact ?? payload.isPrimaryContact)
      : undefined,
  });
}

function normalizeAuthorizationPayload(payload = {}) {
  const relativeId = payload.relative_id || payload.relativeId;
  if (!isValidObjectId(relativeId)) throw createError('relative_id không hợp lệ.', 422);

  const authorizationType = normalizeString(payload.authorization_type || payload.authorizationType || AUTHORIZATION_TYPE.VIEW_RECORDS);
  if (!Object.values(AUTHORIZATION_TYPE).includes(authorizationType)) {
    throw createError('authorization_type không hợp lệ.', 422);
  }

  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions.map(normalizeString).filter(Boolean)
    : [];
  const validFrom = normalizePortalDate(payload.valid_from || payload.validFrom, 'valid_from') || new Date();
  const validTo = normalizePortalDate(payload.valid_to || payload.validTo, 'valid_to');

  if (validTo && validTo <= validFrom) {
    throw createError('valid_to phải sau valid_from.', 422);
  }

  return {
    relative_id: relativeId,
    authorization_type: authorizationType,
    permissions,
    valid_from: validFrom,
    valid_to: validTo,
  };
}

async function listMyRelatives(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patient._id, is_deleted: false };
  if (query.status) filter.status = normalizeString(query.status);
  const keyword = normalizeString(query.keyword || query.search || query.q);
  if (keyword) {
    const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { full_name: { $regex: pattern, $options: 'i' } },
      { relationship: { $regex: pattern, $options: 'i' } },
      { phone: { $regex: pattern, $options: 'i' } },
      { email: { $regex: pattern, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    PatientRelative.find(filter).sort({ is_primary_contact: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    PatientRelative.countDocuments(filter),
  ]);
  const relativeIds = items.map((item) => item._id);
  const authorizationCounts = relativeIds.length
    ? await PatientAuthorization.aggregate([
        { $match: { relative_id: { $in: relativeIds }, patient_id: patient._id, is_deleted: false } },
        {
          $group: {
            _id: '$relative_id',
            active: { $sum: { $cond: [{ $eq: ['$status', AUTHORIZATION_STATUS.ACTIVE] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', AUTHORIZATION_STATUS.PENDING] }, 1, 0] } },
            total: { $sum: 1 },
          },
        },
      ])
    : [];
  const countMap = new Map(authorizationCounts.map((row) => [toId(row._id), row]));

  return {
    items: items.map((item) => serializeRelative(item, countMap.get(toId(item._id)) || {})),
    pagination: buildPagination(page, limit, total),
  };
}

async function createMyRelative(actor = {}, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const normalized = normalizeRelativePayload(payload);
  const relative = await PatientRelative.create({
    patient_id: patient._id,
    ...normalized,
    relationship_verified: false,
    status: RELATIVE_STATUS.ACTIVE,
  });

  await recordAuditLog({
    actor,
    action: 'portal.relative.create',
    targetType: 'patient_relative',
    targetId: relative._id,
    status: 'success',
    message: 'Bệnh nhân thêm người thân từ portal.',
    requestMeta,
    metadata: { patient_id: toId(patient._id) },
  });

  return serializeRelative(relative.toObject(), {});
}

async function updateMyRelative(actor = {}, relativeId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const normalized = normalizeRelativePayload(payload, { partial: true });
  const relative = await PatientRelative.findOne({ _id: relativeId, patient_id: patient._id, is_deleted: false });
  if (!relative) throw createError('Không tìm thấy người thân.', 404);
  Object.assign(relative, normalized);
  await relative.save();

  await recordAuditLog({
    actor,
    action: 'portal.relative.update',
    targetType: 'patient_relative',
    targetId: relative._id,
    status: 'success',
    message: 'Bệnh nhân cập nhật người thân từ portal.',
    requestMeta,
    metadata: { patient_id: toId(patient._id) },
  });

  return serializeRelative(relative.toObject(), {});
}

async function deleteMyRelative(actor = {}, relativeId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const relative = await PatientRelative.findOne({ _id: relativeId, patient_id: patient._id, is_deleted: false });
  if (!relative) throw createError('Không tìm thấy người thân.', 404);
  relative.is_deleted = true;
  relative.deleted_at = new Date();
  relative.status = RELATIVE_STATUS.INACTIVE;
  await relative.save();

  await PatientAuthorization.updateMany(
    { patient_id: patient._id, relative_id: relative._id, status: { $in: [AUTHORIZATION_STATUS.PENDING, AUTHORIZATION_STATUS.ACTIVE] }, is_deleted: false },
    { $set: { status: AUTHORIZATION_STATUS.REVOKED, revoked_at: new Date(), revoke_reason: payload.reason || 'relative_deleted_from_portal' } },
  );

  await recordAuditLog({
    actor,
    action: 'portal.relative.delete',
    targetType: 'patient_relative',
    targetId: relative._id,
    status: 'success',
    message: 'Bệnh nhân xóa người thân từ portal.',
    requestMeta,
    metadata: { patient_id: toId(patient._id) },
  });

  return { deleted: true, relative_id: toId(relative._id) };
}

async function listMyAuthorizations(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patient._id, is_deleted: false };
  if (query.status) filter.status = normalizeString(query.status);
  if (query.relative_id && isValidObjectId(query.relative_id)) filter.relative_id = toObjectId(query.relative_id);

  const [items, total] = await Promise.all([
    PatientAuthorization.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('relative_id', 'full_name relationship phone email status relationship_verified')
      .lean(),
    PatientAuthorization.countDocuments(filter),
  ]);

  return {
    items: items.map(serializeAuthorization),
    pagination: buildPagination(page, limit, total),
  };
}

async function createMyAuthorization(actor = {}, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const normalized = normalizeAuthorizationPayload(payload);
  const relative = await PatientRelative.findOne({
    _id: normalized.relative_id,
    patient_id: patient._id,
    is_deleted: false,
  }).lean();
  if (!relative) throw createError('Người thân không thuộc hồ sơ bệnh nhân hiện tại.', 404);

  const authorization = await PatientAuthorization.create({
    patient_id: patient._id,
    relative_id: relative._id,
    authorization_type: normalized.authorization_type,
    permissions: normalized.permissions,
    valid_from: normalized.valid_from,
    valid_to: normalized.valid_to,
    status: AUTHORIZATION_STATUS.PENDING,
  });

  await recordAuditLog({
    actor,
    action: 'portal.authorization.request',
    targetType: 'patient_authorization',
    targetId: authorization._id,
    status: 'success',
    message: 'Bệnh nhân tạo yêu cầu ủy quyền từ portal.',
    requestMeta,
    metadata: { patient_id: toId(patient._id), relative_id: toId(relative._id) },
  });

  return serializeAuthorization({ ...authorization.toObject(), relative_id: relative });
}

async function revokeMyAuthorization(actor = {}, authorizationId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const authorization = await PatientAuthorization.findOne({ _id: authorizationId, patient_id: patient._id, is_deleted: false })
    .populate('relative_id', 'full_name relationship phone email status relationship_verified');
  if (!authorization) throw createError('Không tìm thấy ủy quyền.', 404);
  if (![AUTHORIZATION_STATUS.PENDING, AUTHORIZATION_STATUS.ACTIVE].includes(authorization.status)) {
    throw createError('Chỉ có thể thu hồi ủy quyền đang chờ hoặc đang hoạt động.', 409);
  }

  authorization.status = AUTHORIZATION_STATUS.REVOKED;
  authorization.revoked_at = new Date();
  authorization.revoke_reason = normalizeString(payload.reason || payload.revoke_reason) || 'revoked_from_patient_portal';
  await authorization.save();

  await recordAuditLog({
    actor,
    action: 'portal.authorization.revoke',
    targetType: 'patient_authorization',
    targetId: authorization._id,
    status: 'success',
    message: 'Bệnh nhân thu hồi ủy quyền từ portal.',
    requestMeta,
    metadata: { patient_id: toId(patient._id), relative_id: toId(authorization.relative_id?._id || authorization.relative_id) },
  });

  return serializeAuthorization(authorization.toObject());
}

module.exports = {
  // getMyDashboard: Tổng hợp dashboard portal từ các module hiện có.
  getMyDashboard,
  getMyCounters,
  getMyTodos,
  getMyHealthSummary,
  getMyVisits,
  getMyVisitDetail,
  getPortalBookingDepartments,
  getPortalBookingDoctors,
  getPortalBookingSlots,
  getPortalBookingRecentDoctors,
  getPortalBookingRecommendedSlots,
  // createProfileChangeRequest: Tạo yêu cầu thay đổi hồ sơ bệnh nhân chờ duyệt.
  createProfileChangeRequest,
  // listProfileChangeRequests: Liệt kê yêu cầu thay đổi hồ sơ của bệnh nhân hiện tại.
  listProfileChangeRequests,
  // approveProfileChangeRequest: Duyệt yêu cầu thay đổi hồ sơ bệnh nhân.
  approveProfileChangeRequest,
  // rejectProfileChangeRequest: Từ chối yêu cầu thay đổi hồ sơ bệnh nhân.
  rejectProfileChangeRequest,
  // cancelProfileChangeRequest: Bệnh nhân/người nhà hủy yêu cầu thay đổi hồ sơ đang pending.
  cancelProfileChangeRequest,
  // getMyAccessLogs: Trả về nhật ký truy cập hồ sơ ở dạng đơn giản cho portal.
  getMyAccessLogs,
  uploadMyDocument,
  listMyDocuments,
  getMyDocument,
  archiveMyDocument,
  restoreMyDocument,
  deleteMyDocument,
  submitMyDocumentReview,
  reviewPatientDocument,
  createDocumentExport,
  getDocumentExport,
  downloadDocumentExport,
  listMyRelatives,
  createMyRelative,
  updateMyRelative,
  deleteMyRelative,
  listMyAuthorizations,
  createMyAuthorization,
  revokeMyAuthorization,
};
