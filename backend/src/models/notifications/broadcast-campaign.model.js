const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_PRIORITY,
} = require('../../constants/statuses');

const BROADCAST_CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  SENDING: 'sending',
  SENT: 'sent',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

const BROADCAST_CAMPAIGN_STATUSES = Object.values(BROADCAST_CAMPAIGN_STATUS);

const broadcastCampaignSchema = new Schema(
  {
    campaign_code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    audience_type: { type: String, default: 'custom', trim: true },
    audience_query: { type: Schema.Types.Mixed },
    resolved_recipients: [{ type: Schema.Types.Mixed }],
    resolved_recipient_count: { type: Number, default: 0, min: 0 },
    channels: [{ type: String, enum: NOTIFICATION_CHANNELS }],
    title_template: { type: String, required: true, trim: true },
    body_template: { type: String, required: true },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: NOTIFICATION_PRIORITY.NORMAL, required: true },
    action_url: { type: String, trim: true },
    payload: { type: Schema.Types.Mixed },
    dedupe_key: { type: String, trim: true },
    status: {
      type: String,
      enum: BROADCAST_CAMPAIGN_STATUSES,
      default: BROADCAST_CAMPAIGN_STATUS.DRAFT,
      required: true,
    },
    scheduled_at: { type: Date },
    started_at: { type: Date },
    completed_at: { type: Date },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    approval_status: { type: String, default: 'not_required', trim: true },
    result_summary: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'broadcast_campaigns' },
);

broadcastCampaignSchema.index({ status: 1, scheduled_at: 1 });
broadcastCampaignSchema.index({ audience_type: 1, created_at: -1 });
broadcastCampaignSchema.index({ created_by: 1, created_at: -1 });

module.exports = model('BroadcastCampaign', broadcastCampaignSchema);
module.exports.BROADCAST_CAMPAIGN_STATUS = BROADCAST_CAMPAIGN_STATUS;
module.exports.BROADCAST_CAMPAIGN_STATUSES = BROADCAST_CAMPAIGN_STATUSES;
