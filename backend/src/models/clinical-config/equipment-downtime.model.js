const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const equipmentDowntimeSchema = new Schema(
  {
    equipment_id: { type: Schema.Types.ObjectId, ref: 'ImagingEquipment', required: true },
    room_id: { type: Schema.Types.ObjectId, ref: 'ImagingRoom' },
    start_at: { type: Date, required: true },
    end_at: { type: Date },
    reason: { type: String, trim: true },
    impact_level: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    affected_orders: [{ type: Schema.Types.ObjectId, ref: 'ImagingOrder' }],
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'equipment_downtime' },
);

equipmentDowntimeSchema.index({ equipment_id: 1, start_at: -1 });
equipmentDowntimeSchema.index({ room_id: 1, start_at: -1 });
equipmentDowntimeSchema.index({ end_at: 1 });

module.exports = model('EquipmentDowntime', equipmentDowntimeSchema);
