const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { IMAGING_MODALITIES, IMAGING_ORDER_STATUS, IMAGING_ORDER_STATUSES, ORDER_PRIORITY, ORDER_PRIORITIES } = require('../../constants/statuses');

// Bảng imaging_orders: Lưu chỉ định chẩn đoán hình ảnh như X-quang, CT, MRI, siêu âm.

const imagingOrderSchema = new Schema(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    ordered_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    imaging_order_no: { type: String, required: true, unique: true, trim: true },
    modality: { type: String, enum: IMAGING_MODALITIES, required: true },
    body_part: { type: String, required: true, trim: true },
    contrast_required: { type: Boolean, default: false, required: true },
    clinical_indication: { type: String },
    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE, required: true },
    ordered_at: { type: Date, required: true },
    scheduled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduled_at: { type: Date },
    started_by: { type: Schema.Types.ObjectId, ref: 'User' },
    started_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    no_show_at: { type: Date },
    no_show_reason: { type: String },
    room_id: { type: Schema.Types.ObjectId, ref: 'Room' },
    status: { type: String, enum: IMAGING_ORDER_STATUSES, default: IMAGING_ORDER_STATUS.ORDERED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'imaging_orders' },
);

imagingOrderSchema.index({ order_id: 1 }, { unique: true });
imagingOrderSchema.index({ patient_id: 1 });
imagingOrderSchema.index({ encounter_id: 1 });
imagingOrderSchema.index({ ordered_by: 1 });
imagingOrderSchema.index({ modality: 1 });
imagingOrderSchema.index({ priority: 1 });
imagingOrderSchema.index({ scheduled_by: 1 });
imagingOrderSchema.index({ scheduled_at: 1 });
imagingOrderSchema.index({ started_at: 1 });
imagingOrderSchema.index({ status: 1 });
imagingOrderSchema.index({ room_id: 1 });
imagingOrderSchema.index({ patient_id: 1, ordered_at: 1 });

module.exports = model('ImagingOrder', imagingOrderSchema);
