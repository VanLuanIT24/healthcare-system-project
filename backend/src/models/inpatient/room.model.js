const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { ROOM_STATUS, ROOM_STATUSES, ROOM_TYPE, ROOM_TYPES } = require('../../constants/statuses');

// Bảng rooms: Lưu danh mục phòng khám/phòng bệnh/phòng chức năng theo khoa.

const roomSchema = new Schema(
  {
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    room_code: { type: String, required: true, trim: true },
    room_name: { type: String, required: true, trim: true },
    room_type: { type: String, enum: ROOM_TYPES, default: ROOM_TYPE.WARD, required: true },
    floor: { type: String, trim: true },
    building: { type: String, trim: true },
    capacity: { type: Number, min: 0 },
    notes: { type: String },
    status: { type: String, enum: ROOM_STATUSES, default: ROOM_STATUS.ACTIVE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'rooms' },
);

roomSchema.index({ room_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
roomSchema.index({ department_id: 1 });
roomSchema.index({ service_id: 1 });
roomSchema.index({ room_name: 1 });
roomSchema.index({ room_type: 1 });
roomSchema.index({ floor: 1 });
roomSchema.index({ status: 1 });
roomSchema.index({ department_id: 1, room_type: 1 });

module.exports = model('Room', roomSchema);
