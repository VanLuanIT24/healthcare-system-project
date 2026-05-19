const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const DISPENSE_PRINT_TYPES = ['label', 'instruction', 'handover', 'return_slip'];
const DISPENSE_PRINT_STATUSES = ['queued', 'printed', 'failed', 'cancelled'];

const dispensePrintJobSchema = new Schema(
  {
    print_job_no: { type: String, required: true, unique: true, trim: true },
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense', required: true },
    print_type: { type: String, enum: DISPENSE_PRINT_TYPES, required: true },
    template_code: { type: String, trim: true },
    status: { type: String, enum: DISPENSE_PRINT_STATUSES, default: 'queued', required: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User' },
    requested_at: { type: Date },
    printed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    printed_at: { type: Date },
    copy_count: { type: Number, default: 1, min: 1 },
    payload_snapshot: { type: Schema.Types.Mixed },
    error_message: { type: String },
    reprint_reason: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'dispense_print_jobs' },
);

dispensePrintJobSchema.index({ dispense_id: 1, print_type: 1, created_at: -1 });
dispensePrintJobSchema.index({ status: 1, requested_at: -1 });
dispensePrintJobSchema.index({ requested_by: 1, requested_at: -1 });

module.exports = model('DispensePrintJob', dispensePrintJobSchema);
