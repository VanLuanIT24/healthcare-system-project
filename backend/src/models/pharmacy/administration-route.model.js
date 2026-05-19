const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const ADMINISTRATION_ROUTE_GROUPS = ['enteral', 'parenteral', 'topical', 'inhalation', 'ophthalmic', 'otic', 'nasal', 'other'];
const ADMINISTRATION_ROUTE_RISK_LEVELS = ['low', 'medium', 'high'];
const ADMINISTRATION_ROUTE_STATUSES = ['active', 'inactive', 'deprecated'];

const administrationRouteSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    english_name: { type: String, trim: true },
    route_group: { type: String, enum: ADMINISTRATION_ROUTE_GROUPS, default: 'other', required: true },
    requires_site: { type: Boolean, default: false },
    requires_nurse_administration: { type: Boolean, default: false },
    outpatient_allowed: { type: Boolean, default: true },
    inpatient_allowed: { type: Boolean, default: true },
    allowed_dosage_form_ids: [{ type: Schema.Types.ObjectId, ref: 'DosageForm' }],
    default_instruction_template: { type: String },
    risk_level: { type: String, enum: ADMINISTRATION_ROUTE_RISK_LEVELS, default: 'low', required: true },
    status: { type: String, enum: ADMINISTRATION_ROUTE_STATUSES, default: 'active', required: true },
    description: { type: String },
    aliases: [{ type: String, trim: true }],
    deprecated_replacement_id: { type: Schema.Types.ObjectId, ref: 'AdministrationRoute' },
    deprecated_at: { type: Date },
    deprecated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'administration_routes' },
);

administrationRouteSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
administrationRouteSchema.index({ name: 1, status: 1 });
administrationRouteSchema.index({ route_group: 1, status: 1 });
administrationRouteSchema.index({ risk_level: 1, status: 1 });

module.exports = model('AdministrationRoute', administrationRouteSchema);
