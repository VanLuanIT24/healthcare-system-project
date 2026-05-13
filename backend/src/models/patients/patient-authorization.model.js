const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { AUTHORIZATION_STATUS, AUTHORIZATION_STATUSES, AUTHORIZATION_TYPES } = require('../../constants/statuses');

// Bảng patient_authorizations: Lưu phạm vi ủy quyền người nhà được truy cập/thực hiện thay bệnh nhân.

const patientAuthorizationSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    relative_id: { type: Schema.Types.ObjectId, ref: 'PatientRelative', required: true },
    authorization_type: { type: String, enum: AUTHORIZATION_TYPES, required: true },
    permissions: [{ type: String, trim: true }],
    valid_from: { type: Date, required: true },
    valid_to: { type: Date },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    revoked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    revoked_at: { type: Date },
    revoke_reason: { type: String },
    status: { type: String, enum: AUTHORIZATION_STATUSES, default: AUTHORIZATION_STATUS.PENDING, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'patient_authorizations' },
);

patientAuthorizationSchema.index({ patient_id: 1 });
patientAuthorizationSchema.index({ relative_id: 1 });
patientAuthorizationSchema.index({ authorization_type: 1 });
patientAuthorizationSchema.index({ status: 1 });
patientAuthorizationSchema.index({ valid_from: 1, valid_to: 1 });
patientAuthorizationSchema.index({ patient_id: 1, relative_id: 1, authorization_type: 1 });

module.exports = model('PatientAuthorization', patientAuthorizationSchema);
