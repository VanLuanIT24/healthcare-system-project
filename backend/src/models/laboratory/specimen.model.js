const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { SPECIMEN_STATUS, SPECIMEN_STATUSES } = require('../../constants/statuses');

// Bảng specimens: Lưu mẫu bệnh phẩm, trạng thái thu nhận và lưu trữ mẫu xét nghiệm.

const specimenSchema = new Schema(
  {
    lab_order_id: { type: Schema.Types.ObjectId, ref: 'LabOrder', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    specimen_no: { type: String, required: true, unique: true, trim: true },
    barcode: { type: String, trim: true },
    barcode_value: { type: String, trim: true },
    specimen_type: { type: String, required: true, trim: true },
    container_type: { type: String, trim: true },
    tube_count: { type: Number, min: 1, default: 1 },
    collection_site: { type: String, trim: true },
    collection_condition: { type: String, trim: true },
    collected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    collected_at: { type: Date },
    received_by: { type: Schema.Types.ObjectId, ref: 'User' },
    received_at: { type: Date },
    rejected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    rejected_at: { type: Date },
    rejection_reason: { type: String },
    rejection_reason_code: { type: String, trim: true },
    rejection_stage: { type: String, trim: true },
    rejection_severity: { type: String, trim: true },
    need_recollection: { type: Boolean, default: false },
    reject_notify_doctor: { type: Boolean, default: false },
    reject_notify_nurse: { type: Boolean, default: false },
    rejection_evidence_attachment_ids: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    quality_check: {
      label_verified: { type: Boolean },
      patient_identity_verified: { type: Boolean },
      container_intact: { type: Boolean },
      volume_adequate: { type: Boolean },
      sample_quality: { type: String, trim: true },
      temperature_celsius: { type: Number },
      hemolysis_level: { type: String, trim: true },
      clot_detected: { type: Boolean },
      leak_detected: { type: Boolean },
      note: { type: String, trim: true },
    },
    testing_started_by: { type: Schema.Types.ObjectId, ref: 'User' },
    testing_started_at: { type: Date },
    testing_completed_at: { type: Date },
    instrument_id: { type: String, trim: true },
    workstation_id: { type: String, trim: true },
    assay_run_id: { type: String, trim: true },
    testing_note: { type: String, trim: true },
    storage_location: { type: String, trim: true },
    stored_by: { type: Schema.Types.ObjectId, ref: 'User' },
    stored_at: { type: Date },
    storage_unit: { type: String, trim: true },
    storage_rack: { type: String, trim: true },
    storage_box: { type: String, trim: true },
    storage_slot: { type: String, trim: true },
    retention_policy_code: { type: String, trim: true },
    retention_until: { type: Date },
    storage_temperature: { type: Number },
    storage_note: { type: String, trim: true },
    label_print_count: { type: Number, default: 0, min: 0 },
    label_printed_at: { type: Date },
    label_printed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    last_label_printed_at: { type: Date },
    last_label_printed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    disposed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    disposed_at: { type: Date },
    dispose_reason: { type: String },
    dispose_method: { type: String, trim: true },
    dispose_witness_by: { type: Schema.Types.ObjectId, ref: 'User' },
    dispose_document_no: { type: String, trim: true },
    dispose_attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
    status: { type: String, enum: SPECIMEN_STATUSES, default: SPECIMEN_STATUS.PLANNED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'specimens' },
);

specimenSchema.index({ lab_order_id: 1 });
specimenSchema.index({ patient_id: 1 });
specimenSchema.index({ barcode: 1 }, { sparse: true });
specimenSchema.index({ barcode_value: 1 }, { sparse: true });
specimenSchema.index({ specimen_type: 1 });
specimenSchema.index({ collected_at: 1 });
specimenSchema.index({ received_at: 1 });
specimenSchema.index({ rejected_at: 1 });
specimenSchema.index({ stored_at: 1 });
specimenSchema.index({ disposed_at: 1 });
specimenSchema.index({ retention_until: 1 });
specimenSchema.index({ status: 1 });
specimenSchema.index({ lab_order_id: 1, status: 1 });

module.exports = model('Specimen', specimenSchema);
