const appointmentService = require('./appointment.service');
const encounterService = require('./encounter.service');
const qrTokenService = require('./qr-token.service');
const queueService = require('./queue.service');
const { createError, recordAuditLog } = require('./core.service');
const { QueueTicket } = require('../models');
const {
  APPOINTMENT_STATUS,
  QR_TOKEN_TYPE,
  QUEUE_STATUS,
} = require('../constants/statuses');
const {
  getCheckinErrors,
  getRecentCheckins,
} = require('./reception-dashboard.service');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || null;
}

function queueTicketId(value = {}) {
  return toId(value.queue_ticket_id || value.ticket_id || value._id || value.id);
}

function buildQueueTicketPrintPayload(queueTicket) {
  const ticket = queueTicket?.queue_ticket || queueTicket;
  const ticketId = queueTicketId(ticket);
  if (!ticketId) return null;
  return {
    type: 'queue_ticket',
    queue_ticket_id: ticketId,
    queue_number: ticket.display_number || ticket.queue_number || null,
  };
}

async function buildCurrentQueueSnapshot(queueTicket) {
  const ticketId = queueTicketId(queueTicket);
  if (!ticketId) return null;

  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) return null;

  const queueScope = {
    doctor_id: ticket.doctor_id,
    department_id: ticket.department_id,
    queue_date: ticket.queue_date,
  };
  const checkinTime = ticket.checkin_time || ticket.created_at || new Date();
  const [waitingBefore, currentServing] = await Promise.all([
    QueueTicket.countDocuments({
      ...queueScope,
      status: QUEUE_STATUS.WAITING,
      _id: { $ne: ticket._id },
      checkin_time: { $lt: checkinTime },
    }),
    QueueTicket.findOne({
      ...queueScope,
      status: { $in: [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.IN_SERVICE] },
    }).sort({ called_time: -1, checkin_time: 1 }).lean(),
  ]);

  return {
    queue_ticket_id: toId(ticket._id),
    queue_date: ticket.queue_date,
    queue_number: ticket.display_number || ticket.queue_number,
    status: ticket.status,
    waiting_before: waitingBefore,
    estimated_position: ticket.status === QUEUE_STATUS.WAITING ? waitingBefore + 1 : 0,
    current_serving: currentServing
      ? {
        queue_ticket_id: toId(currentServing._id),
        queue_number: currentServing.display_number || currentServing.queue_number,
        status: currentServing.status,
      }
      : null,
  };
}

function assertAppointmentCheckinQr(verification) {
  if (!verification.valid) {
    throw createError(`QR token không hợp lệ: ${verification.reason || 'invalid'}.`, 409);
  }
  if (verification.token?.type !== QR_TOKEN_TYPE.APPOINTMENT_CHECKIN || verification.token?.target_type !== 'appointment') {
    throw createError('QR này không phải QR check-in lịch hẹn.', 409);
  }
  if (!verification.token?.target_id) {
    throw createError('QR check-in không có appointment target.', 409);
  }
}

async function quickCheckin(payload = {}, actor = {}, requestMeta = {}) {
  const appointmentId = payload.appointment_id || payload.appointmentId;
  if (!appointmentId) throw createError('appointment_id là bắt buộc.', 400);

  const readiness = await appointmentService.checkAppointmentCanBeCheckedIn(appointmentId);
  const checkedIn = await appointmentService.checkInAppointment(appointmentId, actor, requestMeta);
  let queueTicket = null;
  let encounter = null;

  if (payload.create_queue !== false && payload.create_queue_ticket !== false) {
    queueTicket = await queueService.createQueueTicketFromAppointment(appointmentId, actor, requestMeta)
      .catch((error) => {
        if (error.statusCode === 409) return null;
        throw error;
      });
  }

  if (payload.create_encounter === true) {
    encounter = await encounterService.createEncounterFromAppointment(appointmentId, actor, requestMeta)
      .catch((error) => {
        if (error.statusCode === 409) return null;
        throw error;
      });
  }

  const currentQueue = await buildCurrentQueueSnapshot(queueTicket?.queue_ticket || queueTicket).catch(() => null);

  await recordAuditLog({
    actor,
    action: 'reception.checkin.quick',
    targetType: 'appointment',
    targetId: appointmentId,
    status: 'success',
    message: 'Quick check-in tại lễ tân.',
    requestMeta,
    metadata: {
      create_queue: payload.create_queue !== false,
      create_encounter: payload.create_encounter === true,
      print_ticket: payload.print_ticket === true,
    },
  });

  return {
    appointment_id: toId(appointmentId),
    readiness,
    appointment: checkedIn.appointment || checkedIn,
    queue_ticket: queueTicket?.queue_ticket || queueTicket || null,
    current_queue: currentQueue,
    encounter: encounter?.encounter || encounter || null,
    print_payload: payload.print_ticket === true ? buildQueueTicketPrintPayload(queueTicket) : null,
    next_step: encounter ? 'send_to_doctor' : 'send_to_queue',
  };
}

async function walkInCheckin(payload = {}, actor = {}, requestMeta = {}) {
  const requiredFields = ['patient_id', 'department_id', 'doctor_id'];
  const missing = requiredFields.filter((field) => !payload[field]);
  if (missing.length) throw createError(`${missing.join(', ')} là bắt buộc.`, 400);

  const queueTicket = payload.create_queue_ticket === false
    ? null
    : await queueService.checkInPatientToQueue({
      patient_id: payload.patient_id,
      department_id: payload.department_id,
      doctor_id: payload.doctor_id,
      queue_type: payload.priority === 'vip' ? 'vip' : payload.priority === 'priority' ? 'priority' : 'normal',
      reason: payload.reason,
      skip_service_preparation: payload.skip_service_preparation,
    }, actor, requestMeta);

  const createdTicket = queueTicket?.queue_ticket || queueTicket || null;
  let encounter = null;
  const ticketId = queueTicketId(createdTicket);
  if (payload.create_encounter === true && ticketId) {
    encounter = await encounterService.createEncounterFromQueueTicket(ticketId, actor, requestMeta)
      .catch((error) => {
        if (error.statusCode === 409) return null;
        throw error;
      });
  }
  const currentQueue = await buildCurrentQueueSnapshot(createdTicket).catch(() => null);
  const nextStep = encounter ? 'send_to_doctor' : 'send_to_nursing';

  await recordAuditLog({
    actor,
    action: 'reception.checkin.walk_in',
    targetType: 'patient',
    targetId: payload.patient_id,
    status: 'success',
    message: 'Check-in vãng lai tại lễ tân.',
    requestMeta,
    metadata: {
      department_id: payload.department_id,
      doctor_id: payload.doctor_id,
      reason: payload.reason,
      priority: payload.priority || 'normal',
    },
  });

  return {
    patient_id: toId(payload.patient_id),
    queue_ticket: createdTicket,
    current_queue: currentQueue,
    encounter: encounter?.encounter || encounter || null,
    print_payload: payload.print_ticket === true ? buildQueueTicketPrintPayload(createdTicket) : null,
    routing_hint: {
      destination: encounter ? 'doctor' : 'nursing',
      queue_ticket_id: ticketId,
      department_id: toId(payload.department_id),
      doctor_id: toId(payload.doctor_id),
      next_step: nextStep,
    },
    next_step: nextStep,
  };
}

async function qrCheckin(payload = {}, actor = {}, requestMeta = {}) {
  const token = payload.token || payload.qr_token;
  if (!token) throw createError('token là bắt buộc.', 400);

  const verification = await qrTokenService.verifyQrToken(token, actor, requestMeta);
  assertAppointmentCheckinQr(verification);
  const readiness = await appointmentService.checkAppointmentCanBeCheckedIn(verification.token.target_id);
  if (!readiness.can_checkin && !readiness.active_queue_ticket_id) {
    throw createError(readiness.reasons?.[0] || 'Lịch hẹn hiện không thể check-in.', 409);
  }
  await qrTokenService.consumeQrToken(token, actor, requestMeta);
  const result = await quickCheckin({
    ...payload,
    appointment_id: verification.token.target_id,
    create_queue: payload.create_queue !== false,
  }, actor, requestMeta);

  return {
    token_status: 'consumed',
    token_type: verification.token.type,
    entity: verification.token,
    ...result,
  };
}

async function previewQrCheckin(payload = {}, actor = {}, requestMeta = {}) {
  const token = payload.token || payload.qr_token;
  if (!token) throw createError('token là bắt buộc.', 400);

  const verification = await qrTokenService.verifyQrToken(token, actor, requestMeta);
  if (!verification.valid) {
    throw createError(`QR token không hợp lệ: ${verification.reason || 'invalid'}.`, 409);
  }

  const isAppointmentCheckin = verification.token?.type === QR_TOKEN_TYPE.APPOINTMENT_CHECKIN
    && verification.token?.target_type === 'appointment'
    && verification.token?.target_id;

  if (!isAppointmentCheckin) {
    return {
      token_status: 'valid',
      token_type: verification.token?.type,
      entity: verification.token,
      can_checkin: false,
      reasons: ['QR hợp lệ nhưng không phải QR check-in lịch hẹn.'],
      supported_checkin_type: QR_TOKEN_TYPE.APPOINTMENT_CHECKIN,
    };
  }

  const [readiness, detail] = await Promise.all([
    appointmentService.checkAppointmentCanBeCheckedIn(verification.token.target_id).catch((error) => ({
      can_checkin: false,
      reasons: [error.message || 'Không kiểm tra được điều kiện check-in.'],
      error_status: error.statusCode || error.status,
    })),
    appointmentService.getAppointmentDetail(verification.token.target_id, actor),
  ]);

  return {
    token_status: 'valid',
    token_type: verification.token.type,
    entity: verification.token,
    appointment_id: toId(verification.token.target_id),
    readiness,
    can_checkin: Boolean(readiness.can_checkin || readiness.active_queue_ticket_id),
    reasons: readiness.reasons || [],
    appointment: detail.appointment,
    queue_ticket: detail.queue_ticket,
    encounter: detail.encounter,
    current_queue: await buildCurrentQueueSnapshot(detail.queue_ticket).catch(() => null),
  };
}

async function recentCheckins(query = {}, actor = {}) {
  return getRecentCheckins(query, actor);
}

async function checkinErrors(query = {}, actor = {}) {
  return getCheckinErrors(query, actor);
}

async function retryCheckinError(errorId, payload = {}, actor = {}, requestMeta = {}) {
  await recordAuditLog({
    actor,
    action: 'reception.checkin_error.retry',
    targetType: 'audit_log',
    targetId: errorId,
    status: 'success',
    message: 'Reception requested check-in retry.',
    requestMeta,
  });
  if (payload.appointment_id) {
    return quickCheckin(payload, actor, requestMeta);
  }
  return {
    retried: false,
    checkin_error_id: toId(errorId),
    message: 'Cần truyền appointment_id hoặc xử lý thủ công từ entity gốc.',
  };
}

async function resolveCheckinError(errorId, payload = {}, actor = {}, requestMeta = {}) {
  await recordAuditLog({
    actor,
    action: 'reception.checkin_error.resolve',
    targetType: 'audit_log',
    targetId: errorId,
    status: 'success',
    message: payload.note || 'Reception resolved check-in error.',
    requestMeta,
  });
  return {
    resolved: true,
    checkin_error_id: toId(errorId),
  };
}

module.exports = {
  quickCheckin,
  walkInCheckin,
  qrCheckin,
  previewQrCheckin,
  recentCheckins,
  checkinErrors,
  retryCheckinError,
  resolveCheckinError,
};
