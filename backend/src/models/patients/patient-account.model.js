const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const patientAccountStatuses = ['active', 'pending_verification', 'locked', 'disabled'];

const patientAccountSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true },
    username: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    password_hash: { type: String, required: true },
    status: { type: String, enum: patientAccountStatuses, default: 'active', required: true },
    last_login_at: { type: Date },
    password_changed_at: { type: Date },
    failed_login_attempts: { type: Number, default: 0, required: true },
    locked_until: { type: Date },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'patient_accounts' },
);

patientAccountSchema.index({ status: 1 });
patientAccountSchema.index({ last_login_at: 1 });

module.exports = model('PatientAccount', patientAccountSchema);
