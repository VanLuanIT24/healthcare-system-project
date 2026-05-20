const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { IMAGING_MODALITIES } = require('../../constants/statuses');

const imagingRoomSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    modality: { type: String, enum: IMAGING_MODALITIES, required: true },
    location_id: { type: Schema.Types.ObjectId, ref: 'FacilityLocation' },
    equipment_id: { type: Schema.Types.ObjectId, ref: 'ImagingEquipment' },
    default_duration_minutes: { type: Number, min: 1, default: 30 },
    active: { type: Boolean, default: true, required: true },
    maintenance_status: {
      type: String,
      enum: ['available', 'maintenance', 'out_of_service'],
      default: 'available',
      required: true,
    },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'imaging_rooms' },
);

imagingRoomSchema.index({ modality: 1, active: 1 });
imagingRoomSchema.index({ equipment_id: 1 });

module.exports = model('ImagingRoom', imagingRoomSchema);
