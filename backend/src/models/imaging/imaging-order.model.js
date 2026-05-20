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
    assigned_technician_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_radiologist_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_by: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_at: { type: Date },
    duration_minutes: { type: Number, min: 1 },
    patient_arrival_at: { type: Date },
    preparation_instruction: { type: String },
    internal_note: { type: String },
    rescheduled_from: { type: Date },
    rescheduled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    rescheduled_at: { type: Date },
    reschedule_reason: { type: String },
    arrival_status: {
      type: String,
      enum: ['not_arrived', 'arrived', 'ready', 'not_ready'],
      default: 'not_arrived',
    },
    arrival_at: { type: Date },
    ready_at: { type: Date },
    not_ready_reason: { type: String },
    started_by: { type: Schema.Types.ObjectId, ref: 'User' },
    started_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    technical_note: { type: String },
    repeat_requested: { type: Boolean, default: false },
    repeat_reason: { type: String },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    no_show_at: { type: Date },
    no_show_reason: { type: String },
    room_id: { type: Schema.Types.ObjectId, ref: 'ImagingRoom' },
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
imagingOrderSchema.index({ assigned_technician_id: 1 });
imagingOrderSchema.index({ assigned_radiologist_id: 1 });
imagingOrderSchema.index({ scheduled_at: 1 });
imagingOrderSchema.index({ completed_at: 1 });
imagingOrderSchema.index({ arrival_status: 1 });
imagingOrderSchema.index({ started_at: 1 });
imagingOrderSchema.index({ status: 1 });
imagingOrderSchema.index({ room_id: 1 });
imagingOrderSchema.index({ patient_id: 1, ordered_at: 1 });

module.exports = model('ImagingOrder', imagingOrderSchema);
