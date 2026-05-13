const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { SPECIMEN_STATUS, SPECIMEN_STATUSES } = require('../../constants/statuses');

// Bảng specimens: Lưu mẫu bệnh phẩm, trạng thái thu nhận và lưu trữ mẫu xét nghiệm.

const specimenSchema = new Schema(
  {
    lab_order_id: { type: Schema.Types.ObjectId, ref: 'LabOrder', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    specimen_no: { type: String, required: true, unique: true, trim: true },
    specimen_type: { type: String, required: true, trim: true },
    container_type: { type: String, trim: true },
    collected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    collected_at: { type: Date },
    received_by: { type: Schema.Types.ObjectId, ref: 'User' },
    received_at: { type: Date },
    rejected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    rejected_at: { type: Date },
    rejection_reason: { type: String },
    storage_location: { type: String, trim: true },
    disposed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    disposed_at: { type: Date },
    dispose_reason: { type: String },
    status: { type: String, enum: SPECIMEN_STATUSES, default: SPECIMEN_STATUS.PLANNED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'specimens' },
);

specimenSchema.index({ lab_order_id: 1 });
specimenSchema.index({ patient_id: 1 });
specimenSchema.index({ specimen_type: 1 });
specimenSchema.index({ collected_at: 1 });
specimenSchema.index({ received_at: 1 });
specimenSchema.index({ disposed_at: 1 });
specimenSchema.index({ status: 1 });
specimenSchema.index({ lab_order_id: 1, status: 1 });

module.exports = model('Specimen', specimenSchema);
