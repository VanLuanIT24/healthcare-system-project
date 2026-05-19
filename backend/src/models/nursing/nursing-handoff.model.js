const { randomInt } = require('crypto');
const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const HANDOFF_SHIFTS = ['morning', 'afternoon', 'night', 'custom'];
const HANDOFF_STATUSES = ['draft', 'submitted', 'accepted', 'rejected', 'reopened', 'archived'];
const ACUITY_LEVELS = ['low', 'medium', 'high', 'critical'];

function fallbackHandoffCode() {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  return `NH${datePart}${String(Date.now()).slice(-5)}${randomInt(100, 999)}`;
}

const patientItemSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    bed_id: { type: Schema.Types.ObjectId, ref: 'Bed' },

    situation: { type: String, trim: true },
    background: { type: String, trim: true },
    assessment: { type: String, trim: true },
    recommendation: { type: String, trim: true },

    acuity_level: { type: String, enum: ACUITY_LEVELS, default: 'medium', required: true },
    flags: {
      allergy: { type: Boolean, default: false },
      fall_risk: { type: Boolean, default: false },
      isolation: { type: Boolean, default: false },
      critical_vitals: { type: Boolean, default: false },
      post_procedure: { type: Boolean, default: false },
      medication_attention: { type: Boolean, default: false },
      doctor_report_needed: { type: Boolean, default: false },
    },

    latest_vitals_snapshot: { type: Schema.Types.Mixed },
    active_problems_snapshot: { type: Schema.Types.Mixed },
    allergies_snapshot: { type: Schema.Types.Mixed },

    pending_task_ids: [{ type: Schema.Types.ObjectId, ref: 'NursingTask' }],
    overdue_task_ids: [{ type: Schema.Types.ObjectId, ref: 'NursingTask' }],
    pending_medication_ids: [{ type: Schema.Types.ObjectId, ref: 'MedicationAdministration' }],
    pending_order_ids: [{ type: Schema.Types.ObjectId, ref: 'Order' }],

    receiver_acknowledged: { type: Boolean, default: false },
    acknowledged_at: { type: Date },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },

    note: { type: String, trim: true },
  },
  { _id: true, versionKey: false },
);

const nursingHandoffSchema = new Schema(
  {
    handoff_code: { type: String, unique: true, sparse: true, trim: true },

    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    ward_id: { type: Schema.Types.ObjectId, ref: 'Department' },

    shift_date: { type: Date, required: true },
    from_shift: { type: String, enum: HANDOFF_SHIFTS, required: true },
    to_shift: { type: String, enum: HANDOFF_SHIFTS, required: true },

    from_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    to_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    to_team_role: { type: String, trim: true },

    status: { type: String, enum: HANDOFF_STATUSES, default: 'draft', required: true },
    summary: { type: String, trim: true },
    risk_summary: { type: String, trim: true },

    patient_items: [patientItemSchema],
    task_ids: [{ type: Schema.Types.ObjectId, ref: 'NursingTask' }],

    submitted_at: { type: Date },
    accepted_at: { type: Date },
    accepted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    rejected_at: { type: Date },
    rejected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    rejection_reason: { type: String, trim: true },

    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'nursing_handoffs' },
);

nursingHandoffSchema.pre('validate', function ensureHandoffCode(next) {
  if (!this.handoff_code) this.handoff_code = fallbackHandoffCode();
  next();
});

nursingHandoffSchema.index({ department_id: 1, shift_date: -1, status: 1 });
nursingHandoffSchema.index({ from_user_id: 1, shift_date: -1 });
nursingHandoffSchema.index({ to_user_id: 1, status: 1, submitted_at: -1 });
nursingHandoffSchema.index({ status: 1, submitted_at: -1 });
nursingHandoffSchema.index({ 'patient_items.patient_id': 1 });
nursingHandoffSchema.index({ task_ids: 1 });

module.exports = model('NursingHandoff', nursingHandoffSchema);
