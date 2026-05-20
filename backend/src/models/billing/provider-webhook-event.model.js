const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const providerWebhookEventSchema = new Schema(
  {
    provider: { type: String, required: true, trim: true },
    event_id: { type: String, required: true, trim: true },
    event_type: { type: String, trim: true },
    status: { type: String, enum: ['received', 'processed', 'ignored', 'failed'], default: 'received' },
    received_at: { type: Date, default: Date.now },
    processed_at: { type: Date },
    payment_intent_id: { type: Schema.Types.ObjectId, ref: 'PaymentIntent' },
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment' },
    bank_transaction_id: { type: Schema.Types.ObjectId, ref: 'BankStatementTransaction' },
    transaction_ref: { type: String, trim: true },
    amount: { type: Number },
    signature_valid: { type: Boolean },
    error_message: { type: String },
    raw_payload: { type: Schema.Types.Mixed },
    audit_logs: [{ type: Schema.Types.Mixed }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'provider_webhook_events' },
);

providerWebhookEventSchema.index({ provider: 1, event_id: 1 }, { unique: true });
providerWebhookEventSchema.index({ status: 1, received_at: -1 });
providerWebhookEventSchema.index({ transaction_ref: 1 });

module.exports = model('ProviderWebhookEvent', providerWebhookEventSchema);
