const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { DISPENSE_STATUS, DISPENSE_STATUSES } = require('../../constants/statuses');

// Bảng dispenses: Lưu phiếu cấp phát thuốc theo đơn và thông tin dược sĩ cấp phát.

const DISPENSE_WORKFLOW_STAGES = [
  'created',
  'assigned',
  'picking',
  'checking',
  'ready_to_handover',
  'blocked',
];

const DISPENSE_PRIORITIES = ['critical', 'high', 'medium', 'low'];

const DISPENSE_CHECKLIST_STATUSES = ['pending', 'checked', 'skipped', 'failed'];

const dispenseChecklistItemSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: DISPENSE_CHECKLIST_STATUSES,
      default: 'pending',
      required: true,
    },
    checked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    checked_at: { type: Date },
    note: { type: String },
  },
  { _id: false },
);

const dispenseSchema = new Schema(
  {
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    dispense_no: { type: String, required: true, unique: true, trim: true },
    dispensed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    dispensed_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    note: { type: String },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_at: { type: Date },
    preparation_started_at: { type: Date },
    preparation_completed_at: { type: Date },
    workflow_stage: {
      type: String,
      enum: DISPENSE_WORKFLOW_STAGES,
      default: 'created',
      required: true,
    },
    locked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    locked_at: { type: Date },
    priority: {
      type: String,
      enum: DISPENSE_PRIORITIES,
      default: 'medium',
      required: true,
    },
    sla_due_at: { type: Date },
    checklist: { type: [dispenseChecklistItemSchema], default: undefined },
    checklist_status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
      required: true,
    },
    checklist_completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    checklist_completed_at: { type: Date },
    hold_count: { type: Number, default: 0, min: 0 },
    active_hold_count: { type: Number, default: 0, min: 0 },
    last_hold_reason: { type: String },
    last_hold_at: { type: Date },
    status: { type: String, enum: DISPENSE_STATUSES, default: DISPENSE_STATUS.DRAFT, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'dispenses' },
);

dispenseSchema.index({ prescription_id: 1 });
dispenseSchema.index({ patient_id: 1 });
dispenseSchema.index({ encounter_id: 1 });
dispenseSchema.index({ dispensed_by: 1 });
dispenseSchema.index({ dispensed_at: 1 });
dispenseSchema.index({ status: 1 });
dispenseSchema.index({ workflow_stage: 1, status: 1 });
dispenseSchema.index({ assigned_to: 1, status: 1 });
dispenseSchema.index({ locked_by: 1, locked_at: 1 });
dispenseSchema.index({ priority: 1, sla_due_at: 1 });
dispenseSchema.index({ patient_id: 1, dispensed_at: 1 });

module.exports = model('Dispense', dispenseSchema);
