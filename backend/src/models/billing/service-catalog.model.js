const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { SERVICE_STATUS, SERVICE_STATUSES, SERVICE_TYPES } = require('../../constants/statuses');

// Bảng service_catalog: Lưu danh mục dịch vụ, giá tiền và khả năng tính phí.
const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const serviceCatalogSchema = new Schema(
  {
    service_code: { type: String, required: true, trim: true },
    service_name: { type: String, required: true, trim: true },
    service_type: { type: String, enum: SERVICE_TYPES, required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    description: { type: String },
    unit: { type: String, trim: true },
    unit_price: { type: Number, required: true, min: 0, validate: integerMoneyValidator },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },
    is_billable: { type: Boolean, default: true, required: true },
    effective_from: { type: Date },
    effective_to: { type: Date },
    status: { type: String, enum: SERVICE_STATUSES, default: SERVICE_STATUS.ACTIVE, required: true },
    version_group_id: { type: Schema.Types.ObjectId },
    version_no: { type: Number, default: 1, min: 1 },
    parent_service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    replaced_by_service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    retired_at: { type: Date },
    retired_by: { type: Schema.Types.ObjectId, ref: 'User' },
    retire_reason: { type: String, trim: true },
    reactivated_at: { type: Date },
    reactivated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reactivate_reason: { type: String, trim: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'service_catalog' },
);

serviceCatalogSchema.index({ service_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
serviceCatalogSchema.index({ service_name: 1 });
serviceCatalogSchema.index({ service_type: 1 });
serviceCatalogSchema.index({ department_id: 1 });
serviceCatalogSchema.index({ status: 1 });
serviceCatalogSchema.index({ service_type: 1, status: 1 });
serviceCatalogSchema.index({ version_group_id: 1, version_no: -1 });
serviceCatalogSchema.index({ effective_to: 1, status: 1 });

module.exports = model('ServiceCatalog', serviceCatalogSchema);
