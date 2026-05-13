const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ABNORMAL_FLAG, ABNORMAL_FLAGS, RESULT_ITEM_STATUS, RESULT_ITEM_STATUSES } = require('../../constants/statuses');

// Bảng lab_result_items: Lưu từng chỉ số xét nghiệm, giá trị, đơn vị và khoảng tham chiếu.

const labResultItemSchema = new Schema(
  {
    lab_result_id: { type: Schema.Types.ObjectId, ref: 'LabResult', required: true },
    item_code: { type: String, trim: true },
    item_name: { type: String, required: true, trim: true },
    result_value: { type: String, trim: true },
    numeric_value: { type: Number },
    unit: { type: String, trim: true },
    reference_range: { type: String, trim: true },
    abnormal_flag: { type: String, enum: ABNORMAL_FLAGS, default: ABNORMAL_FLAG.UNKNOWN },
    is_critical: { type: Boolean, default: false },
    critical_notified_at: { type: Date },
    comment: { type: String },
    display_order: { type: Number, default: 0 },
    status: { type: String, enum: RESULT_ITEM_STATUSES, default: RESULT_ITEM_STATUS.PRELIMINARY, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'lab_result_items' },
);

labResultItemSchema.index({ lab_result_id: 1 });
labResultItemSchema.index({ item_code: 1 });
labResultItemSchema.index({ abnormal_flag: 1 });
labResultItemSchema.index({ is_critical: 1 });
labResultItemSchema.index({ status: 1 });
labResultItemSchema.index({ lab_result_id: 1, display_order: 1 });

module.exports = model('LabResultItem', labResultItemSchema);
