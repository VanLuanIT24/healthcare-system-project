const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const procedureCatalogSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    default_duration_minutes: { type: Number, min: 1 },
    default_service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    requires_consent: { type: Boolean, default: false },
    consent_template_id: { type: Schema.Types.ObjectId },
    requires_preparation: { type: Boolean, default: true },
    checklist_template_id: { type: Schema.Types.ObjectId, ref: 'PreparationChecklistTemplate' },
    requires_post_observation: { type: Boolean, default: false },
    post_observation_minutes: { type: Number, min: 0 },
    allowed_locations: [{ type: Schema.Types.ObjectId, ref: 'FacilityLocation' }],
    required_equipment: [{ type: String, trim: true }],
    required_materials: [{ type: String, trim: true }],
    indications: [{ type: String, trim: true }],
    contraindications: [{ type: String, trim: true }],
    patient_instructions: { type: String, trim: true },
    performer_role_codes: [{ type: String, trim: true }],
    active: { type: Boolean, default: true, required: true },
    version: { type: Number, default: 1, min: 1 },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'procedure_catalogs' },
);

procedureCatalogSchema.index({ active: 1, name: 1 });
procedureCatalogSchema.index({ category: 1, active: 1 });
procedureCatalogSchema.index({ department_id: 1, active: 1 });
procedureCatalogSchema.index({ default_service_id: 1 });
procedureCatalogSchema.index({ checklist_template_id: 1 });

module.exports = model('ProcedureCatalog', procedureCatalogSchema);
