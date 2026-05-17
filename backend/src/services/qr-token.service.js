const { randomBytes } = require('crypto');
const { Appointment, Invoice, QrToken, QueueTicket } = require('../models');
const { QR_TOKEN_TYPE, QR_TOKEN_TYPES } = require('../constants/statuses');
const { createError, recordAuditLog } = require('./core.service');
const actorContext = require('../common/actors');
const { isValidObjectId } = require('../common/helpers/object-id.helper');

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function sanitizeQrToken(qr = {}, { includeToken = false, includeMetadata = false } = {}) {
  return {
    qr_token_id: toId(qr._id || qr.id),
    token: includeToken ? qr.token : undefined,
    type: qr.type,
    target_type: qr.target_type,
    target_id: toId(qr.target_id),
    expires_at: qr.expires_at,
    used_at: qr.used_at,
    revoked_at: qr.revoked_at,
    metadata: includeMetadata ? qr.metadata : undefined,
  };
}

function actorSnapshot(actor = {}) {
  if (!actor || !actorContext.getActorType(actor)) return {};
  const context = actorContext.buildActorContext(actor);
  return {
    actor_type: context.actor_type,
    actor_id: context.actor_id,
  };
}

function expiryDate(payload = {}, fallbackMinutes = 15) {
  const value = payload.expires_at || payload.expiresAt;
  if (value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw createError('expires_at không hợp lệ.', 422);
    return date;
  }
  return new Date(Date.now() + fallbackMinutes * 60 * 1000);
}

async function generateToken() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const token = randomBytes(24).toString('base64url');
    const exists = await QrToken.exists({ token });
    if (!exists) return token;
  }
  throw createError('Không thể sinh QR token.', 409);
}

async function createQrToken({
  type,
  targetType,
  targetId,
  actor = {},
  expiresAt,
  metadata,
}) {
  if (!QR_TOKEN_TYPES.includes(type)) throw createError('type QR không hợp lệ.', 422);
  if (!targetType || !targetId || !isValidObjectId(targetId)) throw createError('target QR không hợp lệ.', 422);
  const snapshot = actorSnapshot(actor);
  return QrToken.create({
    token: await generateToken(),
    type,
    target_type: targetType,
    target_id: targetId,
    actor_type: snapshot.actor_type,
    actor_id: snapshot.actor_id,
    expires_at: expiresAt,
    metadata,
  });
}

async function createPaymentQr(invoiceId, payload = {}, actor = {}, requestMeta = {}) {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw createError('Không tìm thấy invoice.', 404);
  if (actorContext.getActorType(actor) === 'patient' && toId(actorContext.getPatientId(actor)) !== toId(invoice.patient_id)) {
    throw createError('Bạn chỉ được tạo QR payment cho invoice của chính mình.', 403);
  }
  const qr = await createQrToken({
    type: QR_TOKEN_TYPE.PAYMENT,
    targetType: 'invoice',
    targetId: invoice._id,
    actor,
    expiresAt: expiryDate(payload, 15),
    metadata: {
      invoice_no: invoice.invoice_no,
      amount: invoice.balance_due,
      currency: invoice.currency,
      ...(payload.metadata || {}),
    },
  });
  await recordAuditLog({ actor, action: 'qr_tokens.create', targetType: 'qr_token', targetId: qr._id, status: 'success', message: 'Tạo QR payment.', requestMeta });
  return sanitizeQrToken(qr, { includeToken: true, includeMetadata: true });
}

async function createAppointmentCheckinQr(appointmentId, payload = {}, actor = {}, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment) throw createError('Không tìm thấy appointment.', 404);
  if (actorContext.getActorType(actor) === 'patient' && toId(actorContext.getPatientId(actor)) !== toId(appointment.patient_id)) {
    throw createError('Bạn chỉ được tạo QR check-in cho lịch hẹn của chính mình.', 403);
  }
  const qr = await createQrToken({
    type: QR_TOKEN_TYPE.APPOINTMENT_CHECKIN,
    targetType: 'appointment',
    targetId: appointment._id,
    actor,
    expiresAt: expiryDate(payload, 24 * 60),
    metadata: payload.metadata,
  });
  await recordAuditLog({ actor, action: 'qr_tokens.create', targetType: 'qr_token', targetId: qr._id, status: 'success', message: 'Tạo QR check-in appointment.', requestMeta });
  return sanitizeQrToken(qr, { includeToken: true, includeMetadata: true });
}

async function createQueueTicketQr(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  const qr = await createQrToken({
    type: QR_TOKEN_TYPE.QUEUE_TICKET,
    targetType: 'queue_ticket',
    targetId: ticket._id,
    actor,
    expiresAt: expiryDate(payload, 24 * 60),
    metadata: payload.metadata,
  });
  ticket.qr_token_id = qr._id;
  await ticket.save();
  await recordAuditLog({ actor, action: 'qr_tokens.create', targetType: 'qr_token', targetId: qr._id, status: 'success', message: 'Tạo QR queue ticket.', requestMeta });
  return sanitizeQrToken(qr, { includeToken: true, includeMetadata: true });
}

async function verifyQrToken(tokenValue, actor = {}, requestMeta = {}) {
  const token = normalizeString(tokenValue);
  if (!token) throw createError('token là bắt buộc.', 422);
  const qr = await QrToken.findOne({ token }).lean();
  if (!qr) throw createError('QR token không tồn tại.', 404);
  const now = new Date();
  const valid = !qr.revoked_at && (!qr.expires_at || qr.expires_at >= now);
  await recordAuditLog({ actor, action: 'qr_tokens.verify', targetType: 'qr_token', targetId: qr._id, status: valid ? 'success' : 'failure', message: 'Verify QR token.', requestMeta });
  return {
    valid,
    reason: valid ? null : (qr.revoked_at ? 'revoked' : 'expired'),
    token: sanitizeQrToken(qr, { includeMetadata: Boolean(actorContext.getActorType(actor)) }),
  };
}

async function consumeQrToken(tokenValue, actor = {}, requestMeta = {}) {
  const token = normalizeString(tokenValue);
  if (!token) throw createError('token là bắt buộc.', 422);
  const qr = await QrToken.findOneAndUpdate(
    {
      token,
      revoked_at: null,
      used_at: null,
      $or: [
        { expires_at: null },
        { expires_at: { $exists: false } },
        { expires_at: { $gte: new Date() } },
      ],
    },
    { $set: { used_at: new Date() } },
    { new: true },
  );
  if (!qr) throw createError('QR token không hợp lệ, đã dùng hoặc đã hết hạn.', 409);
  await recordAuditLog({ actor, action: 'qr_tokens.consume', targetType: 'qr_token', targetId: qr._id, status: 'success', message: 'Consume QR token.', requestMeta });
  return sanitizeQrToken(qr, { includeMetadata: Boolean(actorContext.getActorType(actor)) });
}

async function revokeQrToken(tokenValue, payload = {}, actor = {}, requestMeta = {}) {
  const qr = await QrToken.findOne({ token: tokenValue });
  if (!qr) throw createError('QR token không tồn tại.', 404);
  if (!qr.revoked_at) qr.revoked_at = new Date();
  qr.metadata = {
    ...(qr.metadata || {}),
    revoked_reason: payload.reason || payload.revoked_reason,
  };
  await qr.save();
  await recordAuditLog({ actor, action: 'qr_tokens.revoke', targetType: 'qr_token', targetId: qr._id, status: 'success', message: 'Revoke QR token.', requestMeta });
  return sanitizeQrToken(qr, { includeMetadata: true });
}

module.exports = {
  createPaymentQr,
  createAppointmentCheckinQr,
  createQueueTicketQr,
  verifyQrToken,
  consumeQrToken,
  revokeQrToken,
};
