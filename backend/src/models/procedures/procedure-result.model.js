const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { PROCEDURE_RESULT_STATUS, PROCEDURE_RESULT_STATUSES } = require('../../constants/statuses');

// Bảng procedure_results: Lưu kết quả thủ thuật có cấu trúc, ký, phát hành và amend.

const procedureResultSchema = new Schema(
  {
    procedure_order_id: { type: Schema.Types.ObjectId, ref: 'ProcedureOrder', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    result_no: { type: String, required: true, unique: true, trim: true },

    template_id: { type: Schema.Types.ObjectId },
    technique: { type: String },
    findings: { type: String },
    conclusion: { type: String },
    complications: [{ type: String, trim: true }],
    blood_loss: { type: String, trim: true },
    anesthesia_type: { type: String, trim: true },
    specimens_collected: [{ type: String, trim: true }],
    post_procedure_instruction: { type: String },
    recommendation: { type: String },

    performer_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assistant_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    reported_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reported_at: { type: Date },
    signed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    signed_at: { type: Date },

    released_to_doctor: { type: Boolean, default: false },
    released_to_doctor_at: { type: Date },
    released_to_doctor_by: { type: Schema.Types.ObjectId, ref: 'User' },
    doctor_viewed_at: { type: Date },
    doctor_acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    doctor_acknowledged_at: { type: Date },

    released_to_patient: { type: Boolean, default: false },
    released_to_patient_at: { type: Date },
    released_to_patient_by: { type: Schema.Types.ObjectId, ref: 'User' },
    release_revoked_at: { type: Date },
    release_revoked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    release_revoke_reason: { type: String },
    patient_viewed_at: { type: Date },
    patient_downloaded_at: { type: Date },
    patient_download_count: { type: Number, default: 0, min: 0 },

    amended_by: { type: Schema.Types.ObjectId, ref: 'User' },
    amended_at: { type: Date },
    amendment_reason: { type: String },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },

    is_critical: { type: Boolean, default: false },
    critical_note: { type: String },
    critical_notified_at: { type: Date },
    critical_acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    critical_acknowledged_at: { type: Date },

    metadata: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: PROCEDURE_RESULT_STATUSES,
      default: PROCEDURE_RESULT_STATUS.DRAFT,
      required: true,
    },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'procedure_results' },
);

procedureResultSchema.index({ procedure_order_id: 1 }, { unique: true });
procedureResultSchema.index({ patient_id: 1, reported_at: -1 });
procedureResultSchema.index({ encounter_id: 1 });
procedureResultSchema.index({ performer_id: 1 });
procedureResultSchema.index({ signed_by: 1 });
procedureResultSchema.index({ signed_at: 1 });
procedureResultSchema.index({ released_to_doctor: 1 });
procedureResultSchema.index({ doctor_viewed_at: 1 });
procedureResultSchema.index({ doctor_acknowledged_at: 1 });
procedureResultSchema.index({ released_to_patient: 1 });
procedureResultSchema.index({ release_revoked_at: 1 });
procedureResultSchema.index({ patient_viewed_at: 1 });
procedureResultSchema.index({ is_critical: 1 });
procedureResultSchema.index({ status: 1 });

module.exports = model('ProcedureResult', procedureResultSchema);
