const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const {
  FACILITY_LOCATION_STATUSES,
  FACILITY_LOCATION_STATUS,
  FACILITY_LOCATION_TYPES,
  FACILITY_LOCATION_TYPE,
} = require('../../constants/statuses');

// Bảng facility_locations: Địa điểm public/internal như clinic, pharmacy, lab, imaging.

const facilityLocationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: FACILITY_LOCATION_TYPES, default: FACILITY_LOCATION_TYPE.CLINIC, required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    address: { type: String },
    phone: { type: String, trim: true },
    opening_hours: { type: Schema.Types.Mixed },
    status: { type: String, enum: FACILITY_LOCATION_STATUSES, default: FACILITY_LOCATION_STATUS.ACTIVE, required: true },
    public_visible: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'facility_locations' },
);

facilityLocationSchema.index({ type: 1, status: 1 });
facilityLocationSchema.index({ department_id: 1 });
facilityLocationSchema.index({ public_visible: 1, status: 1 });
facilityLocationSchema.index({ name: 1 });

module.exports = model('FacilityLocation', facilityLocationSchema);
