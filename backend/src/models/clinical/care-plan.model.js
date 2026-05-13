const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { CARE_PLAN_STATUS, CARE_PLAN_STATUSES } = require('../../constants/statuses');

// Bảng care_plans: Lưu kế hoạch chăm sóc, mục tiêu và can thiệp cho bệnh nhân.

const carePlanSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan_no: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    goals: [
      {
        goal: { type: String, required: true },
        target_date: { type: Date },
        status: { type: String, trim: true },
      },
    ],
    interventions: [
      {
        description: { type: String, required: true },
        responsible_role: { type: String, trim: true },
        frequency: { type: String, trim: true },
      },
    ],
    start_date: { type: Date },
    end_date: { type: Date },
    notes: { type: String },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    status: { type: String, enum: CARE_PLAN_STATUSES, default: CARE_PLAN_STATUS.DRAFT, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'care_plans' },
);

carePlanSchema.index({ patient_id: 1 });
carePlanSchema.index({ encounter_id: 1 });
carePlanSchema.index({ admission_id: 1 });
carePlanSchema.index({ created_by: 1 });
carePlanSchema.index({ status: 1 });
carePlanSchema.index({ patient_id: 1, status: 1 });

module.exports = model('CarePlan', carePlanSchema);
