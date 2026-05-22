const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

// Persistent security evidence for requests blocked by in-memory rate limiters.

const rateLimitEventSchema = new Schema(
  {
    scope: { type: String, required: true, trim: true, index: true },
    key_hash: { type: String, required: true, trim: true, index: true },
    actor_type: { type: String, trim: true },
    actor_id: { type: Schema.Types.Mixed },
    ip_address: { type: String, trim: true, index: true },
    method: { type: String, trim: true },
    path: { type: String, trim: true, index: true },
    user_agent: { type: String },
    request_id: { type: String, trim: true },
    limit: { type: Number },
    window_ms: { type: Number },
    retry_after_seconds: { type: Number },
    blocked_at: { type: Date, default: Date.now, index: true },
    reviewed_at: { type: Date },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'security_rate_limit_events' },
);

rateLimitEventSchema.index({ blocked_at: -1 });
rateLimitEventSchema.index({ scope: 1, blocked_at: -1 });
rateLimitEventSchema.index({ actor_type: 1, actor_id: 1, blocked_at: -1 });

module.exports = model('SecurityRateLimitEvent', rateLimitEventSchema);
