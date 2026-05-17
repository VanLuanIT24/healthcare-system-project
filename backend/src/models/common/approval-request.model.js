const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('./base-model');
const {
  APPROVAL_REQUEST_STATUS,
  APPROVAL_REQUEST_STATUSES,
  APPROVAL_REQUEST_TYPE,
  APPROVAL_REQUEST_TYPES,
} = require('../../constants/statuses');

const approvalRequestSchema = new Schema(
  {
    request_code: { type: String, required: true, unique: true, trim: true },
    request_type: {
      type: String,
      enum: APPROVAL_REQUEST_TYPES,
      default: APPROVAL_REQUEST_TYPE.LARGE_DISCOUNT,
      required: true,
    },
    target_type: { type: String, required: true, trim: true },
    target_id: { type: Schema.Types.Mixed, required: true },
    requested_by_actor_type: { type: String, required: true, trim: true },
    requested_by_actor_id: { type: Schema.Types.Mixed, required: true },
    assigned_to_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_to_role_code: { type: String, trim: true },
    reason: { type: String, required: true },
    payload: { type: Schema.Types.Mixed },
    decision_note: { type: String },
    decided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    decided_at: { type: Date },
    expires_at: { type: Date },
    status: {
      type: String,
      enum: APPROVAL_REQUEST_STATUSES,
      default: APPROVAL_REQUEST_STATUS.PENDING,
      required: true,
    },
  },
  { ...baseSchemaOptions, collection: 'approval_requests' },
);

approvalRequestSchema.index({ request_type: 1, status: 1, created_at: -1 });
approvalRequestSchema.index({ target_type: 1, target_id: 1, status: 1 });
approvalRequestSchema.index({ assigned_to_user_id: 1, status: 1 });
approvalRequestSchema.index({ assigned_to_role_code: 1, status: 1 });
approvalRequestSchema.index({ expires_at: 1, status: 1 });

module.exports = model('ApprovalRequest', approvalRequestSchema);
