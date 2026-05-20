const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { IMAGING_MODALITIES } = require('../../constants/statuses');

const imagingEquipmentSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    modality: { type: String, enum: IMAGING_MODALITIES, required: true },
    manufacturer: { type: String, trim: true },
    model: { type: String, trim: true },
    serial_no: { type: String, trim: true },
    status: {
      type: String,
      enum: ['available', 'maintenance', 'out_of_service'],
      default: 'available',
      required: true,
    },
    last_maintenance_at: { type: Date },
    next_maintenance_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'imaging_equipment' },
);

imagingEquipmentSchema.index({ modality: 1, status: 1 });
imagingEquipmentSchema.index({ serial_no: 1 }, { sparse: true });

module.exports = model('ImagingEquipment', imagingEquipmentSchema);
