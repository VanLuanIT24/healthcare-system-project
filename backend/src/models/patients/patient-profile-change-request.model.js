const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const {
  ACTOR_TYPES,
  PATIENT_PROFILE_CHANGE_STATUSES,
  PATIENT_PROFILE_CHANGE_STATUS,
  PATIENT_PROFILE_CHANGE_TYPES,
} = require('../../constants/statuses');

// Bảng patient_profile_change_requests: Lưu yêu cầu bệnh nhân/người nhà đề nghị đổi thông tin nhạy cảm chờ nhân sự duyệt.

const actorSnapshotSchema = new Schema(
  {
    actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    actor_id: { type: Schema.Types.Mixed, required: true },
    session_id: { type: Schema.Types.ObjectId, ref: 'AuthSession' },
  },
  { _id: false },
);

const patientProfileChangeRequestSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    requested_by_actor: { type: actorSnapshotSchema, required: true },
    change_type: { type: String, enum: PATIENT_PROFILE_CHANGE_TYPES, required: true },
    old_value_snapshot: { type: Schema.Types.Mixed },
    new_value: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: PATIENT_PROFILE_CHANGE_STATUSES,
      default: PATIENT_PROFILE_CHANGE_STATUS.PENDING,
      required: true,
    },
    reviewed_by: { type: actorSnapshotSchema },
    reviewed_at: { type: Date },
    reason: { type: String, trim: true },
  },
  { ...baseSchemaOptions, collection: 'patient_profile_change_requests' },
);

patientProfileChangeRequestSchema.index({ patient_id: 1, created_at: -1 });
patientProfileChangeRequestSchema.index({ status: 1, created_at: -1 });
patientProfileChangeRequestSchema.index({ change_type: 1, status: 1 });
patientProfileChangeRequestSchema.index({ 'requested_by_actor.actor_type': 1, 'requested_by_actor.actor_id': 1 });
patientProfileChangeRequestSchema.index({ patient_id: 1, status: 1, change_type: 1 });

module.exports = model('PatientProfileChangeRequest', patientProfileChangeRequestSchema);
