const { randomInt } = require('crypto');
const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const INPATIENT_HANDOVER_SHIFTS = ['morning', 'afternoon', 'night', 'custom'];
const INPATIENT_HANDOVER_STATUSES = ['draft', 'prepared', 'signed', 'acknowledged', 'closed', 'reopened'];
const INPATIENT_HANDOVER_PRIORITIES = ['low', 'normal', 'high', 'urgent', 'critical'];

function fallbackHandoverCode() {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  return `IPH${datePart}${String(Date.now()).slice(-5)}${randomInt(100, 999)}`;
}

const inpatientHandoverItemSchema = new Schema(
  {
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    bed_assignment_id: { type: Schema.Types.ObjectId, ref: 'BedAssignment' },
    room_id: { type: Schema.Types.ObjectId, ref: 'Room' },
    bed_id: { type: Schema.Types.ObjectId, ref: 'Bed' },

    priority: { type: String, enum: INPATIENT_HANDOVER_PRIORITIES, default: 'normal', required: true },
    situation: { type: String, trim: true },
    background: { type: String, trim: true },
    assessment: { type: String, trim: true },
    recommendation: { type: String, trim: true },

    open_tasks: [{ type: Schema.Types.Mixed }],
    medication_warnings: [{ type: Schema.Types.Mixed }],
    vital_warnings: [{ type: Schema.Types.Mixed }],
    nursing_note: { type: String, trim: true },

    acknowledged: { type: Boolean, default: false },
    acknowledged_at: { type: Date },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, versionKey: false },
);

const inpatientHandoverSchema = new Schema(
  {
    handover_no: { type: String, unique: true, sparse: true, trim: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    shift_date: { type: Date, required: true },
    from_shift: { type: String, enum: INPATIENT_HANDOVER_SHIFTS, required: true },
    to_shift: { type: String, enum: INPATIENT_HANDOVER_SHIFTS, required: true },
    outgoing_nurse_id: { type: Schema.Types.ObjectId, ref: 'User' },
    incoming_nurse_id: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: INPATIENT_HANDOVER_STATUSES, default: 'draft', required: true },
    summary: { type: String, trim: true },

    patient_count: { type: Number, default: 0, min: 0 },
    high_risk_count: { type: Number, default: 0, min: 0 },
    abnormal_vital_count: { type: Number, default: 0, min: 0 },
    overdue_task_count: { type: Number, default: 0, min: 0 },
    medication_due_count: { type: Number, default: 0, min: 0 },

    items: [inpatientHandoverItemSchema],

    signed_at: { type: Date },
    signed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledged_at: { type: Date },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    closed_at: { type: Date },
    closed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reopened_at: { type: Date },
    reopened_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reopen_reason: { type: String, trim: true },

    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'inpatient_handovers' },
);

inpatientHandoverSchema.pre('validate', function ensureHandoverNo(next) {
  if (!this.handover_no) this.handover_no = fallbackHandoverCode();
  next();
});

inpatientHandoverSchema.index({ department_id: 1, shift_date: -1, status: 1 });
inpatientHandoverSchema.index({ outgoing_nurse_id: 1, shift_date: -1 });
inpatientHandoverSchema.index({ incoming_nurse_id: 1, status: 1 });
inpatientHandoverSchema.index({ status: 1, signed_at: -1 });
inpatientHandoverSchema.index({ 'items.admission_id': 1 });
inpatientHandoverSchema.index({ 'items.patient_id': 1 });

module.exports = model('InpatientHandover', inpatientHandoverSchema);
