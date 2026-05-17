const os = require('os');
const EventOutbox = require('./event-outbox.model');
const notificationDispatcher = require('../notifications/notification-dispatcher.service');
const {
  EVENT_OUTBOX_STATUS,
} = require('../constants/statuses');
const { buildDomainEventEnvelope } = require('./domain-event-taxonomy');

const DEFAULT_PROCESSING_LOCK_MS = 5 * 60 * 1000;

function sessionOptions(session) {
  return session ? { session } : {};
}

function nextRetryDate(retryCount) {
  const seconds = Math.min(300, 2 ** Math.min(Number(retryCount || 0), 8));
  return new Date(Date.now() + seconds * 1000);
}

async function dispatchOutboxEvent(eventDoc) {
  const event = eventDoc.toObject ? eventDoc.toObject() : eventDoc;
  return notificationDispatcher.dispatchDomainEvent(event);
}

async function publishDomainEvent({
  eventType,
  event_type,
  aggregateType,
  aggregate_type,
  aggregateId,
  aggregate_id,
  actor,
  recipients,
  recipientScope,
  recipient_scope,
  payload = {},
  correlationId,
  correlation_id,
  requestId,
  request_id,
  idempotencyKey,
  idempotency_key,
} = {}, options = {}) {
  const type = eventType || event_type;
  const aggregate = aggregateType || aggregate_type;
  const id = aggregateId || aggregate_id;
  if (!type || !aggregate || !id) {
    throw new Error('eventType, aggregateType and aggregateId are required.');
  }
  const requestContext = options.requestContext || options.context || {};
  const resolvedCorrelationId = correlationId || correlation_id || requestContext.correlation_id;
  const resolvedRequestId = requestId || request_id || requestContext.request_id;
  const resolvedActor = actor || requestContext.actor || null;
  const scopedRecipients = recipientScope?.recipients || recipient_scope?.recipients || [];
  const resolvedRecipients = Array.isArray(recipients) && recipients.length
    ? recipients
    : Array.isArray(scopedRecipients) ? scopedRecipients : [];

  let event;
  try {
    [event] = await EventOutbox.create([{
      event_type: type,
      aggregate_type: aggregate,
      aggregate_id: id,
      actor: resolvedActor,
      recipients: resolvedRecipients,
      recipient_scope: recipientScope || recipient_scope || {},
      payload,
      occurred_at: new Date(),
      correlation_id: resolvedCorrelationId,
      request_id: resolvedRequestId,
      status: EVENT_OUTBOX_STATUS.PENDING,
      next_retry_at: new Date(),
      idempotency_key: idempotencyKey || idempotency_key,
    }], sessionOptions(options.session));
  } catch (error) {
    if (error?.code === 11000 && (idempotencyKey || idempotency_key)) {
      const existing = await EventOutbox.findOne({ idempotency_key: idempotencyKey || idempotency_key }).lean();
      if (existing) return { event: existing, dispatch: null, idempotent: true };
    }
    throw error;
  }

  if (options.publishImmediately !== false && !options.session) {
    try {
      const dispatch = await publishOutboxEvent(event._id, options.workerId);
      return { event: dispatch.event, dispatch: dispatch.result };
    } catch (error) {
      return { event: event.toObject(), dispatch: { delivered: false, error: error.message } };
    }
  }

  return { event: event.toObject(), dispatch: null };
}

async function claimPendingEvent(workerId = `${os.hostname()}:${process.pid}`) {
  const now = new Date();
  const staleLockedBefore = new Date(now.getTime() - DEFAULT_PROCESSING_LOCK_MS);
  return EventOutbox.findOneAndUpdate(
    {
      $or: [
        {
          status: { $in: [EVENT_OUTBOX_STATUS.PENDING, EVENT_OUTBOX_STATUS.FAILED] },
          $or: [
            { next_retry_at: null },
            { next_retry_at: { $exists: false } },
            { next_retry_at: { $lte: now } },
          ],
        },
        {
          status: EVENT_OUTBOX_STATUS.PROCESSING,
          locked_at: { $lte: staleLockedBefore },
        },
      ],
    },
    {
      $set: {
        status: EVENT_OUTBOX_STATUS.PROCESSING,
        locked_at: now,
        locked_by: workerId,
        last_attempt_at: now,
      },
    },
    { sort: { created_at: 1 }, new: true },
  );
}

async function publishOutboxEvent(eventId, workerId = `${os.hostname()}:${process.pid}`) {
  const now = new Date();
  const staleLockedBefore = new Date(now.getTime() - DEFAULT_PROCESSING_LOCK_MS);
  const event = await EventOutbox.findOneAndUpdate(
    {
      _id: eventId,
      $or: [
        { status: { $in: [EVENT_OUTBOX_STATUS.PENDING, EVENT_OUTBOX_STATUS.FAILED] } },
        { status: EVENT_OUTBOX_STATUS.PROCESSING, locked_by: workerId },
        { status: EVENT_OUTBOX_STATUS.PROCESSING, locked_at: { $lte: staleLockedBefore } },
      ],
    },
    {
      $set: {
        status: EVENT_OUTBOX_STATUS.PROCESSING,
        locked_at: now,
        locked_by: workerId,
        last_attempt_at: now,
      },
    },
    { new: true },
  );
  if (!event) return { event: null, result: { skipped: true } };
  try {
    const result = await dispatchOutboxEvent(event);
    event.status = EVENT_OUTBOX_STATUS.PUBLISHED;
    event.published_at = new Date();
    event.published_channels = result?.delivery_channels || [];
    event.last_error = undefined;
    event.locked_at = undefined;
    event.locked_by = undefined;
    await event.save();
    return { event: event.toObject(), result };
  } catch (error) {
    event.retry_count = Number(event.retry_count || 0) + 1;
    if (event.retry_count >= Number(event.max_retry_count || 10)) {
      event.status = EVENT_OUTBOX_STATUS.DEAD_LETTER;
      event.dead_letter_at = new Date();
      event.next_retry_at = undefined;
    } else {
      event.status = EVENT_OUTBOX_STATUS.FAILED;
      event.next_retry_at = nextRetryDate(event.retry_count);
    }
    event.last_error = error.message;
    event.locked_at = undefined;
    event.locked_by = undefined;
    await event.save();
    throw error;
  }
}

async function publishPendingEvents({ limit = 50, workerId = `${os.hostname()}:${process.pid}` } = {}) {
  let processed = 0;
  let published = 0;
  let failed = 0;
  let dead_letter = 0;
  const event_ids = [];

  while (processed < limit) {
    const event = await claimPendingEvent(workerId);
    if (!event) break;
    processed += 1;
    try {
      const result = await publishOutboxEvent(event._id, workerId);
      if (!result?.result?.skipped) {
        published += 1;
        event_ids.push(String(event._id));
      }
    } catch (error) {
      failed += 1;
      const failedEvent = await EventOutbox.findById(event._id).select('status').lean();
      if (failedEvent?.status === EVENT_OUTBOX_STATUS.DEAD_LETTER) dead_letter += 1;
    }
  }

  return { processed, published, failed, dead_letter, event_ids };
}

module.exports = {
  buildDomainEventEnvelope,
  publishDomainEvent,
  publishOutboxEvent,
  publishPendingEvents,
};
