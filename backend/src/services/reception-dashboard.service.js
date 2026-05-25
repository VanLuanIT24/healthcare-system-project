const {
  Appointment,
  AuditLog,
  Department,
  Encounter,
  Invoice,
  MissingDocumentTask,
  Notification,
  Patient,
  PatientAccount,
  PatientIdentifier,
  PatientProfileChangeRequest,
  PaymentIntent,
  QueueTicket,
  SupportTicket,
  User,
} = require('../models');
const appointmentService = require('./appointment.service');
const patientService = require('./patient.service');
const queueService = require('./queue.service');
const userPreferenceService = require('./user-preference.service');
const {
  ACTIVE_QUEUE_STATUSES,
  APPOINTMENT_STATUS,
  INVOICE_STATUS,
  PATIENT_PROFILE_CHANGE_STATUS,
  QUEUE_STATUS,
} = require('../constants/statuses');
const { PERMISSION } = require('../constants/permissions');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
} = require('./core.service');

const OPEN_INVOICE_STATUSES = [
  INVOICE_STATUS.DRAFT,
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
];

const PAYMENT_REVIEW_STATUSES = ['created', 'pending', 'pending_manual_confirmation', 'requires_review', 'manual_review'];
const OPEN_SUPPORT_STATUSES = ['open', 'pending', 'in_progress', 'waiting_patient'];
const ACTIVE_APPOINTMENT_STATUS_LIST = [
  APPOINTMENT_STATUS.BOOKED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.IN_CONSULTATION,
];

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.user?._id || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions);
}

function hasGlobalFrontdeskScope(actor = {}) {
  const roles = actor.roles || [];
  return roles.some((role) => ['super_admin', 'admin', 'manager'].includes(role))
    || hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.REPORTS.READ_ALL]);
}

function scopedDepartmentFilter(filter = {}, actor = {}) {
  if (hasGlobalFrontdeskScope(actor)) return { ...filter };
  const departmentId = actorDepartmentId(actor);
  if (!departmentId) return { ...filter, _id: null };
  return { ...filter, department_id: departmentId };
}

function buildDateFilter(dateValue) {
  const date = dateValue || new Date();
  return {
    $gte: getStartOfDay(date),
    $lte: getEndOfDay(date),
  };
}

function sanitizePatient(patient = {}) {
  if (!patient) return null;
  return {
    patient_id: toId(patient._id || patient.patient_id || patient.id),
    patient_code: patient.patient_code || null,
    full_name: patient.full_name || patient.patient_name || null,
    date_of_birth: patient.date_of_birth || null,
    gender: patient.gender || null,
    phone: patient.phone || patient.patient_phone || null,
    email: patient.email || null,
    national_id: patient.national_id || null,
    status: patient.status || null,
  };
}

function sanitizeDepartment(department = {}) {
  if (!department) return null;
  return {
    department_id: toId(department._id || department.department_id || department.id),
    department_code: department.department_code || null,
    department_name: department.department_name || department.name || null,
  };
}

function sanitizeUser(user = {}) {
  if (!user) return null;
  return {
    user_id: toId(user._id || user.user_id || user.id),
    employee_code: user.employee_code || null,
    full_name: user.full_name || user.name || null,
  };
}

async function patientMapFor(items = [], field = 'patient_id') {
  const ids = [...new Set(items.map((item) => toId(item[field])).filter(Boolean))];
  if (!ids.length) return new Map();
  const patients = await Patient.find({ _id: { $in: ids }, is_deleted: false })
    .select('patient_code full_name phone email national_id date_of_birth gender status')
    .lean();
  return new Map(patients.map((patient) => [toId(patient._id), patient]));
}

async function departmentMapFor(items = [], field = 'department_id') {
  const ids = [...new Set(items.map((item) => toId(item[field])).filter(Boolean))];
  if (!ids.length) return new Map();
  const departments = await Department.find({ _id: { $in: ids }, is_deleted: false })
    .select('department_name department_code')
    .lean();
  return new Map(departments.map((department) => [toId(department._id), department]));
}

async function userMapFor(items = [], field = 'doctor_id') {
  const ids = [...new Set(items.map((item) => toId(item[field])).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await User.find({ _id: { $in: ids }, is_deleted: false })
    .select('full_name employee_code')
    .lean();
  return new Map(users.map((user) => [toId(user._id), user]));
}

function mapAppointment(item = {}, maps = {}) {
  const patient = maps.patientMap?.get(toId(item.patient_id));
  const department = maps.departmentMap?.get(toId(item.department_id));
  const doctor = maps.doctorMap?.get(toId(item.doctor_id));
  return {
    appointment_id: toId(item._id || item.appointment_id),
    appointment_time: item.appointment_time,
    appointment_type: item.appointment_type,
    source: item.source,
    status: item.status,
    reason: item.reason,
    patient_id: toId(item.patient_id),
    patient_code: item.patient_code || patient?.patient_code || null,
    patient_name: item.patient_name || patient?.full_name || null,
    patient_phone: item.patient_phone || patient?.phone || null,
    patient: sanitizePatient(patient || {
      _id: item.patient_id,
      patient_code: item.patient_code,
      full_name: item.patient_name,
      phone: item.patient_phone,
    }),
    doctor_id: toId(item.doctor_id),
    doctor_name: item.doctor_name || doctor?.full_name || null,
    doctor: sanitizeUser(doctor || { _id: item.doctor_id, full_name: item.doctor_name }),
    department_id: toId(item.department_id),
    department_name: item.department_name || department?.department_name || null,
    department: sanitizeDepartment(department || { _id: item.department_id, department_name: item.department_name }),
  };
}

function mapQueueTicket(item = {}, maps = {}) {
  const patient = maps.patientMap?.get(toId(item.patient_id));
  const department = maps.departmentMap?.get(toId(item.department_id));
  const doctor = maps.doctorMap?.get(toId(item.doctor_id));
  const waitMinutes = item.checkin_time
    ? Math.max(0, Math.round((Date.now() - new Date(item.checkin_time).getTime()) / 60000))
    : null;
  return {
    queue_ticket_id: toId(item._id || item.queue_ticket_id),
    queue_number: item.queue_number,
    display_number: item.display_number || item.queue_number,
    queue_type: item.queue_type,
    status: item.status,
    checkin_time: item.checkin_time,
    called_time: item.called_time,
    waiting_minutes: waitMinutes,
    waiting_time_label: waitMinutes === null ? null : `${waitMinutes} phút`,
    appointment_id: toId(item.appointment_id),
    encounter_id: toId(item.encounter_id),
    patient_id: toId(item.patient_id),
    patient_code: item.patient_code || patient?.patient_code || null,
    patient_name: item.patient_name || patient?.full_name || null,
    patient_phone: item.patient_phone || patient?.phone || null,
    patient: sanitizePatient(patient || {
      _id: item.patient_id,
      patient_code: item.patient_code,
      full_name: item.patient_name,
      phone: item.patient_phone,
    }),
    doctor_id: toId(item.doctor_id),
    doctor_name: item.doctor_name || doctor?.full_name || null,
    doctor: sanitizeUser(doctor || { _id: item.doctor_id, full_name: item.doctor_name }),
    department_id: toId(item.department_id),
    department_name: item.department_name || department?.department_name || null,
    department: sanitizeDepartment(department || { _id: item.department_id, department_name: item.department_name }),
  };
}

function mapInvoice(item = {}, patient = null) {
  return {
    invoice_id: toId(item._id || item.invoice_id),
    invoice_no: item.invoice_no || item.invoice_code || null,
    patient_id: toId(item.patient_id),
    patient_name: patient?.full_name || item.patient_name || null,
    total_amount: item.total_amount || 0,
    paid_amount: item.paid_amount || 0,
    balance_due: item.balance_due || 0,
    currency: item.currency || 'VND',
    status: item.status,
    issued_at: item.issued_at || item.created_at,
    due_at: item.due_at,
  };
}

function notificationFilter(actor = {}) {
  const userId = actorUserId(actor);
  if (!userId || hasGlobalFrontdeskScope(actor)) return {};
  return {
    $or: [
      { recipient_user_id: userId },
      { recipient_id: userId },
      { recipient_actor_id: userId },
    ],
  };
}

function mapNotification(item = {}) {
  return {
    notification_id: toId(item._id || item.notification_id),
    title: item.title,
    message: item.message || item.body,
    type: item.notification_type || item.event_type || item.channel,
    priority: item.priority,
    status: item.status,
    read_at: item.read_at,
    patient_id: toId(item.patient_id),
    action_url: item.action_url,
    created_at: item.created_at,
  };
}

async function getBootstrap(actor = {}) {
  const [preferencesPayload, departments] = await Promise.all([
    userPreferenceService.getPreferences(actor).catch(() => ({ preferences: null })),
    Department.find({ is_deleted: false, status: 'active' })
      .select('department_name department_code')
      .sort({ department_name: 1 })
      .limit(200)
      .lean(),
  ]);

  return {
    workspace: {
      code: 'reception',
      name: 'Le tan & Tiep don',
      route: '/reception/dashboard',
    },
    current_user: {
      user_id: toId(actorUserId(actor)),
      roles: actor.roles || [],
      department_id: toId(actorDepartmentId(actor)),
    },
    permissions: actor.permissions || [],
    counter: {
      department_id: toId(actorDepartmentId(actor)),
      label: actorDepartmentId(actor) ? 'Theo khoa phu trach' : 'Toan he thong',
      shift_status: 'open',
    },
    quick_actions: [
      'create_patient',
      'create_appointment',
      'quick_checkin',
      'scan_qr',
      'print_queue_ticket',
      'create_support_ticket',
    ],
    print_settings: preferencesPayload.preferences?.workspace_preferences?.reception?.print_settings || {},
    notification_preferences: preferencesPayload.preferences?.notification_channels || ['in_app'],
    available_departments: departments.map(sanitizeDepartment),
    available_rooms: [],
  };
}

async function getUpcomingAppointments(query = {}, actor = {}) {
  const payload = await appointmentService.listUpcomingAppointments({
    ...query,
    limit: query.limit || 12,
    page: query.page || 1,
  }, actor);
  return {
    items: (payload.items || []).map((item) => ({
      ...item,
      patient_profile_status: item.patient_phone ? 'complete' : 'needs_contact',
      missing_documents_count: 0,
      payment_status: 'unknown',
      queue_status: null,
      can_checkin: [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED].includes(item.status),
      risk_flags: [],
    })),
    pagination: payload.pagination,
  };
}

async function getWaitingPatients(query = {}, actor = {}) {
  const payload = await queueService.listQueueTickets({
    ...query,
    date: query.date || new Date(),
    limit: query.limit || 20,
    page: query.page || 1,
  }, actor);
  return {
    items: (payload.items || []).filter((item) => ACTIVE_QUEUE_STATUSES.includes(item.status)),
    pagination: payload.pagination,
  };
}

async function getQueueBoard(query = {}, actor = {}) {
  const payload = await queueService.listQueueTickets({
    ...query,
    date: query.date || new Date(),
    limit: query.limit || 100,
    page: query.page || 1,
  }, actor);
  const items = payload.items || [];
  const byStatus = {
    waiting: items.filter((item) => item.status === QUEUE_STATUS.WAITING),
    called: items.filter((item) => [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED].includes(item.status)),
    missed: items.filter((item) => [QUEUE_STATUS.SKIPPED, QUEUE_STATUS.NO_SHOW].includes(item.status)),
    in_service: items.filter((item) => item.status === QUEUE_STATUS.IN_SERVICE),
    completed: items.filter((item) => item.status === QUEUE_STATUS.COMPLETED),
    transferred: [],
    cancelled: items.filter((item) => item.status === QUEUE_STATUS.CANCELLED),
  };
  return {
    date: query.date || new Date().toISOString().slice(0, 10),
    items,
    columns: byStatus,
    pagination: payload.pagination,
  };
}

async function getNotifications(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = notificationFilter(actor);
  if (query.status) filter.status = query.status;
  if (query.type) {
    const typeFilter = {
      $or: [
        { notification_type: query.type },
        { event_type: query.type },
      ],
    };
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, typeFilter];
      delete filter.$or;
    } else {
      Object.assign(filter, typeFilter);
    }
  }
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return {
    items: items.map(mapNotification),
    pagination: buildPagination(page, limit, total),
  };
}

async function getSidebarCounters(query = {}, actor = {}) {
  const date = query.date || new Date();
  const appointmentFilter = scopedDepartmentFilter({
    is_deleted: false,
    appointment_time: buildDateFilter(date),
  }, actor);
  const queueFilter = scopedDepartmentFilter({
    queue_date: getStartOfDay(date),
  }, actor);
  const [
    appointmentsToday,
    waitingQueue,
    missedQueue,
    missingDocuments,
    profileChanges,
    unpaidInvoices,
    paymentReviews,
    supportTickets,
    notificationsUnread,
  ] = await Promise.all([
    Appointment.countDocuments(appointmentFilter),
    QueueTicket.countDocuments({ ...queueFilter, status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED] } }),
    QueueTicket.countDocuments({ ...queueFilter, status: { $in: [QUEUE_STATUS.SKIPPED, QUEUE_STATUS.NO_SHOW] } }),
    MissingDocumentTask.countDocuments({ status: { $in: ['open', 'overdue'] } }),
    PatientProfileChangeRequest.countDocuments({ status: PATIENT_PROFILE_CHANGE_STATUS.PENDING }),
    Invoice.countDocuments({ status: { $in: OPEN_INVOICE_STATUSES }, balance_due: { $gt: 0 } }),
    PaymentIntent.countDocuments({ $or: [{ status: { $in: PAYMENT_REVIEW_STATUSES } }, { review_status: { $in: ['open', 'assigned'] } }] }),
    SupportTicket.countDocuments({ status: { $in: OPEN_SUPPORT_STATUSES } }),
    Notification.countDocuments({ ...notificationFilter(actor), read_at: null, status: { $ne: 'archived' } }),
  ]);

  return {
    appointments_today: appointmentsToday,
    worklist: missingDocuments + profileChanges + paymentReviews + supportTickets,
    waiting_patients: waitingQueue,
    checkin_errors: 0,
    missed_call: missedQueue,
    missing_documents: missingDocuments,
    profile_change_requests: profileChanges,
    payment_reviews: paymentReviews,
    unpaid_invoices: unpaidInvoices,
    support_tickets: supportTickets,
    notifications_unread: notificationsUnread,
  };
}

async function getActivityFeed(query = {}, actor = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const departmentId = !hasGlobalFrontdeskScope(actor) ? actorDepartmentId(actor) : null;
  const targetTypes = ['appointment', 'queue_ticket', 'patient', 'invoice', 'payment_intent', 'support_ticket'];
  const filter = { target_type: { $in: targetTypes } };
  if (query.since) {
    const since = new Date(query.since);
    if (!Number.isNaN(since.getTime())) filter.created_at = { $gte: since };
  }
  const logs = await AuditLog.find(filter).sort({ created_at: -1 }).limit(limit * 2).lean();
  const items = logs
    .filter((item) => {
      if (!departmentId) return true;
      const metadataDepartment = item.metadata?.department_id || item.after?.department_id || item.before?.department_id;
      return !metadataDepartment || String(metadataDepartment) === String(departmentId);
    })
    .slice(0, limit)
    .map((item) => ({
      activity_id: toId(item._id),
      action: item.action,
      target_type: item.target_type,
      target_id: toId(item.target_id),
      status: item.status,
      title: item.message || item.action,
      actor_type: item.actor_type,
      created_at: item.created_at,
    }));
  return { items };
}

async function getDashboard(query = {}, actor = {}) {
  const date = query.date || new Date();
  const [
    appointmentSummary,
    queueSummary,
    upcomingAppointments,
    waitingPatients,
    worklist,
    sidebarCounters,
    notifications,
    activityFeed,
    unpaidInvoices,
  ] = await Promise.all([
    appointmentService.getAppointmentSummary({ date }, actor),
    queueService.getTodayQueueSummary({ date }, actor),
    getUpcomingAppointments({ date, limit: 8, page: 1 }, actor),
    getWaitingPatients({ date, limit: 8, page: 1 }, actor),
    require('./reception-worklist.service').getWorklist({ limit: 8, page: 1 }, actor),
    getSidebarCounters({ date }, actor),
    getNotifications({ limit: 6, page: 1 }, actor),
    getActivityFeed({ limit: 12 }, actor),
    Invoice.find({ status: { $in: OPEN_INVOICE_STATUSES }, balance_due: { $gt: 0 } })
      .sort({ due_at: 1, created_at: -1 })
      .limit(6)
      .lean(),
  ]);
  const invoicePatientMap = await patientMapFor(unpaidInvoices);

  return {
    date: getStartOfDay(date),
    counters: sidebarCounters,
    kpis: {
      appointments_today: appointmentSummary.total || 0,
      appointments_confirmed: appointmentSummary.confirmed || 0,
      appointments_no_show_risk: appointmentSummary.no_show || 0,
      waiting_checkin: appointmentSummary.booked || 0,
      checked_in: appointmentSummary.checked_in || 0,
      queue_waiting: queueSummary.waiting || 0,
      queue_called: queueSummary.called || 0,
      queue_missed: (queueSummary.skipped || 0) + (queueSummary.no_show || 0),
      missing_profile: sidebarCounters.missing_documents + sidebarCounters.profile_change_requests,
      unpaid_invoices: sidebarCounters.unpaid_invoices,
      payment_reviews: sidebarCounters.payment_reviews,
      support_open: sidebarCounters.support_tickets,
      notifications_unread: sidebarCounters.notifications_unread,
    },
    appointments: upcomingAppointments.items,
    waiting_patients: waitingPatients.items,
    queue_summary: queueSummary,
    worklist: worklist.items,
    notifications: notifications.items,
    activity_feed: activityFeed.items,
    payment_alerts: unpaidInvoices.map((invoice) => mapInvoice(invoice, invoicePatientMap.get(toId(invoice.patient_id)))),
  };
}

async function getPatientCard(patientId, query = {}, actor = {}) {
  if (!patientId) throw createError('patientId là bắt buộc.', 400);
  const [
    detailPayload,
    summaryPayload,
    appointmentsPayload,
    activeQueue,
    missingDocuments,
    supportTickets,
    openInvoices,
    timeline,
    identifiers,
    account,
  ] = await Promise.all([
    patientService.getPatientDetail(patientId, actor),
    patientService.getPatientSummary(patientId, actor),
    patientService.getPatientAppointmentHistory(patientId, { limit: 5, page: 1, sort_order: 'desc' }, actor).catch(() => ({ items: [] })),
    QueueTicket.findOne({ patient_id: patientId, status: { $in: ACTIVE_QUEUE_STATUSES } }).sort({ created_at: -1 }).lean(),
    MissingDocumentTask.find({ patient_id: patientId, status: { $in: ['open', 'overdue'] } }).sort({ due_at: 1, created_at: -1 }).limit(8).lean(),
    SupportTicket.find({ patient_id: patientId, status: { $in: OPEN_SUPPORT_STATUSES } }).sort({ created_at: -1 }).limit(5).lean(),
    Invoice.find({ patient_id: patientId, status: { $in: OPEN_INVOICE_STATUSES }, balance_due: { $gt: 0 } }).sort({ due_at: 1, created_at: -1 }).limit(5).lean(),
    patientService.getPatientTimeline(patientId, { limit: Number(query.timeline_limit || 12) }, actor).catch(() => ({ items: [] })),
    PatientIdentifier.find({ patient_id: patientId, is_deleted: false }).sort({ is_primary: -1, created_at: -1 }).limit(10).lean(),
    PatientAccount.findOne({ patient_id: patientId, is_deleted: false }).lean(),
  ]);

  const queuePatientMap = activeQueue ? await patientMapFor([activeQueue]) : new Map();
  const queueDepartmentMap = activeQueue ? await departmentMapFor([activeQueue]) : new Map();
  const queueDoctorMap = activeQueue ? await userMapFor([activeQueue]) : new Map();
  const patient = detailPayload.patient || summaryPayload.patient;
  const profileWarnings = [];
  if (!patient?.phone) profileWarnings.push('missing_phone');
  if (!patient?.date_of_birth) profileWarnings.push('missing_date_of_birth');
  if (!patient?.national_id && !identifiers.length) profileWarnings.push('missing_identifier');
  if (!patient?.emergency_contact_phone) profileWarnings.push('missing_emergency_contact');

  return {
    patient,
    detail: detailPayload,
    summary: {
      ...(summaryPayload || {}),
      account_status: account?.status || summaryPayload.account_status || null,
      missing_documents_count: missingDocuments.length,
      support_ticket_count: supportTickets.length,
      unpaid_invoices_count: openInvoices.length,
      balance_due: openInvoices.reduce((sum, item) => sum + Number(item.balance_due || 0), 0),
      profile_status: profileWarnings.length ? 'incomplete' : 'complete',
      profile_warnings: profileWarnings,
    },
    appointments: appointmentsPayload.items || [],
    queue_ticket: activeQueue
      ? mapQueueTicket(activeQueue, { patientMap: queuePatientMap, departmentMap: queueDepartmentMap, doctorMap: queueDoctorMap })
      : null,
    missing_documents: missingDocuments.map((item) => ({
      task_id: toId(item._id),
      required_category: item.required_category,
      expected_file_label: item.expected_file_label,
      severity: item.severity,
      status: item.status,
      due_at: item.due_at,
    })),
    support_tickets: supportTickets.map((item) => ({
      ticket_id: toId(item._id),
      ticket_code: item.ticket_code,
      subject: item.subject,
      priority: item.priority,
      status: item.status,
      sla_due_at: item.sla_due_at,
    })),
    billing: {
      open_invoices: openInvoices.map((invoice) => mapInvoice(invoice, patient)),
      balance_due: openInvoices.reduce((sum, item) => sum + Number(item.balance_due || 0), 0),
    },
    timeline: timeline.items || [],
    allowed_actions: [
      'edit_profile',
      'create_appointment',
      'checkin',
      'print_queue_ticket',
      'route_patient',
      'send_notification',
      'create_support_ticket',
    ],
  };
}

async function getRecentCheckins(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = scopedDepartmentFilter({
    status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.IN_SERVICE, QUEUE_STATUS.COMPLETED] },
    checkin_time: { $exists: true },
  }, actor);
  if (query.date) filter.queue_date = getStartOfDay(query.date);
  const [items, total] = await Promise.all([
    QueueTicket.find(filter).sort({ checkin_time: -1 }).skip(skip).limit(limit).lean(),
    QueueTicket.countDocuments(filter),
  ]);
  const maps = {
    patientMap: await patientMapFor(items),
    departmentMap: await departmentMapFor(items),
    doctorMap: await userMapFor(items),
  };
  return {
    items: items.map((item) => ({
      ...mapQueueTicket(item, maps),
      checkin_type: item.appointment_id ? 'appointment' : 'walk_in',
      source: item.appointment_id ? 'appointment' : 'frontdesk',
      result: 'success',
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getCheckinErrors(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {
    action: { $in: ['appointment.checkin', 'queue.create', 'qr_tokens.verify', 'qr_tokens.consume'] },
    status: 'failure',
  };
  if (query.date) filter.created_at = buildDateFilter(query.date);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      checkin_error_id: toId(item._id),
      action: item.action,
      target_type: item.target_type,
      target_id: toId(item.target_id),
      error: item.message,
      created_at: item.created_at,
      status: 'open',
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getDailyOverviewReport(query = {}, actor = {}) {
  const date = query.date || new Date();
  const [appointmentSummary, queueSummary, recentCheckins, counters] = await Promise.all([
    appointmentService.getAppointmentSummary({ date }, actor),
    queueService.getTodayQueueSummary({ date }, actor),
    getRecentCheckins({ date, limit: 100, page: 1 }, actor),
    getSidebarCounters({ date }, actor),
  ]);
  const checkins = recentCheckins.items || [];
  const averageWait = checkins.length
    ? Math.round(checkins.reduce((sum, item) => sum + Number(item.waiting_minutes || 0), 0) / checkins.length)
    : 0;
  return {
    date: getStartOfDay(date),
    kpis: {
      appointments: appointmentSummary.total || 0,
      checkins: checkins.length,
      walk_in_checkins: checkins.filter((item) => item.checkin_type === 'walk_in').length,
      appointment_checkins: checkins.filter((item) => item.checkin_type === 'appointment').length,
      no_show: appointmentSummary.no_show || 0,
      average_wait_minutes: averageWait,
      support_open: counters.support_tickets,
      payment_guidance: counters.unpaid_invoices,
    },
    appointment_summary: appointmentSummary,
    queue_summary: queueSummary,
    counters,
  };
}

module.exports = {
  getBootstrap,
  getDashboard,
  getSidebarCounters,
  getActivityFeed,
  getUpcomingAppointments,
  getWaitingPatients,
  getQueueBoard,
  getNotifications,
  getPatientCard,
  getRecentCheckins,
  getCheckinErrors,
  getDailyOverviewReport,
  mapAppointment,
  mapQueueTicket,
  mapInvoice,
  patientMapFor,
  departmentMapFor,
  userMapFor,
  sanitizePatient,
  scopedDepartmentFilter,
  buildDateFilter,
};
