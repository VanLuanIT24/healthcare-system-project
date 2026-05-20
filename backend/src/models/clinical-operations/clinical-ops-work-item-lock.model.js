const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CLINICAL_OPS_WORK_ITEM_LOCK_STATUS = {
  ACTIVE: 'active',
  RELEASED: 'released',
  EXPIRED: 'expired',
};

const clinicalOpsWorkItemLockSchema = new Schema(
  {
    item_key: { type: String, required: true, trim: true },
    item_type: {
      type: String,
      enum: ['order', 'lab_order', 'specimen', 'lab_result', 'imaging_order', 'imaging_report', 'procedure_order'],
      required: true,
      trim: true,
    },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    module: { type: String, enum: ['lab', 'imaging', 'procedure', 'orders'], required: true, trim: true },
    claimed_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    claimed_at: { type: Date, default: Date.now, required: true },
    lock_expires_at: { type: Date, required: true },
    released_by: { type: Schema.Types.ObjectId, ref: 'User' },
    released_at: { type: Date },
    release_reason: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(CLINICAL_OPS_WORK_ITEM_LOCK_STATUS),
      default: CLINICAL_OPS_WORK_ITEM_LOCK_STATUS.ACTIVE,
      required: true,
    },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_ops_work_item_locks' },
);

clinicalOpsWorkItemLockSchema.index(
  { item_key: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: CLINICAL_OPS_WORK_ITEM_LOCK_STATUS.ACTIVE } },
);
clinicalOpsWorkItemLockSchema.index({ claimed_by: 1, status: 1, claimed_at: -1 });
clinicalOpsWorkItemLockSchema.index({ lock_expires_at: 1, status: 1 });
clinicalOpsWorkItemLockSchema.index({ item_type: 1, entity_id: 1, status: 1 });

module.exports = model('ClinicalOpsWorkItemLock', clinicalOpsWorkItemLockSchema);
