const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('./base-model');
const { IDEMPOTENCY_STATUS, IDEMPOTENCY_STATUSES } = require('../../constants/statuses');

// Bảng idempotency_records: Lưu snapshot response cho các API POST nguy hiểm.

const idempotencyRecordSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    actor_type: { type: String, trim: true },
    actor_id: { type: String, trim: true },
    actor_fingerprint: { type: String, required: true, trim: true },
    route: { type: String, required: true, trim: true },
    method: { type: String, required: true, trim: true, uppercase: true },
    request_hash: { type: String, required: true, trim: true },
    response_snapshot: { type: Schema.Types.Mixed },
    status_code: { type: Number },
    status: {
      type: String,
      enum: IDEMPOTENCY_STATUSES,
      default: IDEMPOTENCY_STATUS.PROCESSING,
      required: true,
    },
    expires_at: { type: Date, required: true },
    locked_at: { type: Date },
    completed_at: { type: Date },
    failed_at: { type: Date },
  },
  { ...baseSchemaOptions, collection: 'idempotency_records' },
);

idempotencyRecordSchema.index(
  { key: 1, actor_fingerprint: 1, route: 1, method: 1 },
  { unique: true },
);
idempotencyRecordSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
idempotencyRecordSchema.index({ status: 1, locked_at: 1 });

module.exports = model('IdempotencyRecord', idempotencyRecordSchema);
