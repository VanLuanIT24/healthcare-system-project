const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

// Bảng imaging_modalities: Danh mục modality/phòng chụp cơ bản.

const imagingModalitySchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    room_required: { type: Boolean, default: true, required: true },
    duration_minutes: { type: Number, min: 1 },
    active: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'imaging_modalities' },
);

imagingModalitySchema.index({ active: 1, name: 1 });

module.exports = model('ImagingModality', imagingModalitySchema);
