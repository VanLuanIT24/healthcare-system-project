const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { BED_STATUS, BED_STATUSES, BED_TYPE, BED_TYPES } = require('../../constants/statuses');

// Bảng beds: Lưu danh mục giường bệnh, loại giường và trạng thái sử dụng.

const bedSchema = new Schema(
  {
    room_id: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    bed_code: { type: String, required: true, trim: true },
    bed_name: { type: String, trim: true },
    bed_type: { type: String, enum: BED_TYPES, default: BED_TYPE.STANDARD, required: true },
    status: { type: String, enum: BED_STATUSES, default: BED_STATUS.AVAILABLE, required: true },
    notes: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'beds' },
);

bedSchema.index({ bed_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
bedSchema.index({ room_id: 1 });
bedSchema.index({ bed_type: 1 });
bedSchema.index({ status: 1 });
bedSchema.index({ room_id: 1, status: 1 });

module.exports = model('Bed', bedSchema);
