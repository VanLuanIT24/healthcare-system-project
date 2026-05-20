const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const RESULT_DELIVERY_TYPES = ['lab_result', 'imaging_report', 'procedure_result', 'procedure_order'];
const RESULT_DELIVERY_RECIPIENT_TYPES = ['doctor', 'patient', 'relative', 'staff'];
const RESULT_DELIVERY_CHANNELS = ['in_app', 'email', 'sms', 'push', 'portal', 'other'];
const RESULT_DELIVERY_STATUSES = ['queued', 'sent', 'delivered', 'read', 'acknowledged', 'failed', 'revoked'];

const resultDeliverySchema = new Schema(
  {
    result_type: { type: String, enum: RESULT_DELIVERY_TYPES, required: true, trim: true },
    result_id: { type: Schema.Types.ObjectId, required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },

    recipient_type: { type: String, enum: RESULT_DELIVERY_RECIPIENT_TYPES, required: true, trim: true },
    recipient_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    recipient_patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },

    channel: { type: String, enum: RESULT_DELIVERY_CHANNELS, default: 'in_app', required: true },
    delivery_status: { type: String, enum: RESULT_DELIVERY_STATUSES, default: 'queued', required: true },

    queued_at: { type: Date },
    sent_at: { type: Date },
    delivered_at: { type: Date },
    read_at: { type: Date },
    acknowledged_at: { type: Date },
    revoked_at: { type: Date },

    critical_ack_required: { type: Boolean, default: false },
    failure_reason: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'result_deliveries' },
);

resultDeliverySchema.index({ result_type: 1, result_id: 1, recipient_type: 1, delivery_status: 1 });
resultDeliverySchema.index({ recipient_user_id: 1, delivery_status: 1, sent_at: -1 });
resultDeliverySchema.index({ recipient_patient_id: 1, delivery_status: 1, sent_at: -1 });
resultDeliverySchema.index({ patient_id: 1, sent_at: -1 });
resultDeliverySchema.index({ encounter_id: 1, sent_at: -1 });
resultDeliverySchema.index({ critical_ack_required: 1, acknowledged_at: 1 });
resultDeliverySchema.index({ created_at: -1 });

module.exports = model('ResultDelivery', resultDeliverySchema);
