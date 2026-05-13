const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('./base-model');

// Bảng counters lưu bộ đếm tuần tự để sinh mã nghiệp vụ an toàn theo từng ngày/phạm vi.
const counterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    seq: { type: Number, default: 0, required: true, min: 0 },
  },
  { ...baseSchemaOptions, collection: 'counters' },
);
module.exports = model('Counter', counterSchema);