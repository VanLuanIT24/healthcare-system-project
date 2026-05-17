const crypto = require('crypto');
const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../models/common/base-model');
const { EVENT_OUTBOX_STATUS, EVENT_OUTBOX_STATUSES } = require('../constants/statuses');

// Bảng event_outbox: Lưu domain events cần publish realtime/notification theo outbox pattern.

const eventOutboxSchema = new Schema(
  {
    event_id: { type: String, required: true, default: () => crypto.randomUUID(), trim: true },
    event_type: { type: String, required: true, trim: true },
    aggregate_type: { type: String, required: true, trim: true },
    aggregate_id: { type: Schema.Types.Mixed, required: true },
    actor: { type: Schema.Types.Mixed },
    recipients: [{ type: Schema.Types.Mixed }],
    recipient_scope: { type: Schema.Types.Mixed },
    payload: { type: Schema.Types.Mixed, default: {} },
    occurred_at: { type: Date, default: Date.now, required: true },
    correlation_id: { type: String, trim: true },
    request_id: { type: String, trim: true },
    status: { type: String, enum: EVENT_OUTBOX_STATUSES, default: EVENT_OUTBOX_STATUS.PENDING, required: true },
    retry_count: { type: Number, default: 0, min: 0 },
    max_retry_count: { type: Number, default: 10, min: 0 },
    next_retry_at: { type: Date },
    last_attempt_at: { type: Date },
    published_at: { type: Date },
    published_channels: [{ type: String, trim: true }],
    dead_letter_at: { type: Date },
    last_error: { type: String },
    locked_at: { type: Date },
    locked_by: { type: String, trim: true },
    idempotency_key: { type: String, trim: true },
  },
  { ...baseSchemaOptions, collection: 'event_outbox' },
);

eventOutboxSchema.index({ status: 1, next_retry_at: 1, created_at: 1 });
eventOutboxSchema.index({ status: 1, locked_at: 1 });
eventOutboxSchema.index({ event_id: 1 }, { unique: true });
eventOutboxSchema.index({ event_type: 1, created_at: -1 });
eventOutboxSchema.index({ aggregate_type: 1, aggregate_id: 1, created_at: -1 });
eventOutboxSchema.index({ correlation_id: 1, created_at: -1 });
eventOutboxSchema.index({ idempotency_key: 1 }, { unique: true, sparse: true });

module.exports = model('EventOutbox', eventOutboxSchema);
