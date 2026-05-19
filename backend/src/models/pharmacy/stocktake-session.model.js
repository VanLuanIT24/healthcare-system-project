const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { STOCKTAKE_STATUSES, STOCKTAKE_STATUS } = require('../../constants/statuses');

const STOCKTAKE_SCOPE_TYPES = ['full', 'location', 'medication_group', 'selected_batches'];

const stocktakeSessionSchema = new Schema(
  {
    stocktake_no: { type: String, required: true, unique: true, trim: true },
    scope_type: { type: String, enum: STOCKTAKE_SCOPE_TYPES, default: 'full', required: true },
    scope_value: { type: Schema.Types.Mixed },
    status: { type: String, enum: STOCKTAKE_STATUSES, default: STOCKTAKE_STATUS.DRAFT, required: true },
    started_at: { type: Date },
    ended_at: { type: Date },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    posted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    posted_at: { type: Date },
    item_count: { type: Number, default: 0, min: 0 },
    counted_count: { type: Number, default: 0, min: 0 },
    variance_count: { type: Number, default: 0, min: 0 },
    variance_value: { type: Number, default: 0 },
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'stocktake_sessions' },
);

stocktakeSessionSchema.index({ status: 1, started_at: -1 });
stocktakeSessionSchema.index({ assigned_to: 1, status: 1 });

module.exports = model('StocktakeSession', stocktakeSessionSchema);
