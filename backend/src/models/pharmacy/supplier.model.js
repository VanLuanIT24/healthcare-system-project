const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const SUPPLIER_TYPES = ['manufacturer', 'distributor', 'wholesaler', 'pharmacy_partner', 'other'];
const SUPPLIER_STATUSES = ['active', 'inactive', 'blocked'];
const SUPPLIER_RISK_LEVELS = ['low', 'medium', 'high'];

const supplierSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    supplier_type: { type: String, enum: SUPPLIER_TYPES, default: 'distributor', required: true },
    tax_code: { type: String, trim: true },
    license_no: { type: String, trim: true },
    license_expiry_date: { type: Date },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    contact_person: { type: String, trim: true },
    status: { type: String, enum: SUPPLIER_STATUSES, default: 'active', required: true },
    risk_level: { type: String, enum: SUPPLIER_RISK_LEVELS, default: 'low', required: true },
    note: { type: String },
    aliases: [{ type: String, trim: true }],
    attachments: [{
      name: { type: String, trim: true },
      type: { type: String, trim: true },
      url: { type: String, trim: true },
      attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
      expires_at: { type: Date },
    }],
    blocked_at: { type: Date },
    blocked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    block_reason: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'suppliers' },
);

supplierSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
supplierSchema.index({ name: 1, status: 1 });
supplierSchema.index({ tax_code: 1 });
supplierSchema.index({ license_no: 1 });
supplierSchema.index({ risk_level: 1, status: 1 });

module.exports = model('Supplier', supplierSchema);
