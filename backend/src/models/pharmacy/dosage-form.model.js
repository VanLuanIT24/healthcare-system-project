const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const DOSAGE_FORM_GROUPS = ['oral', 'injection', 'topical', 'ophthalmic', 'otic', 'nasal', 'inhalation', 'rectal', 'vaginal', 'other'];
const DOSAGE_FORM_STATUSES = ['active', 'inactive', 'deprecated'];

const dosageFormSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    english_name: { type: String, trim: true },
    form_group: { type: String, enum: DOSAGE_FORM_GROUPS, default: 'other', required: true },
    default_unit_id: { type: Schema.Types.ObjectId, ref: 'MedicationUnit' },
    default_route_id: { type: Schema.Types.ObjectId, ref: 'AdministrationRoute' },
    allowed_route_ids: [{ type: Schema.Types.ObjectId, ref: 'AdministrationRoute' }],
    sterile_required: { type: Boolean, default: false },
    high_risk: { type: Boolean, default: false },
    label_instruction_template: { type: String },
    status: { type: String, enum: DOSAGE_FORM_STATUSES, default: 'active', required: true },
    description: { type: String },
    aliases: [{ type: String, trim: true }],
    deprecated_replacement_id: { type: Schema.Types.ObjectId, ref: 'DosageForm' },
    deprecated_at: { type: Date },
    deprecated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'dosage_forms' },
);

dosageFormSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
dosageFormSchema.index({ name: 1, status: 1 });
dosageFormSchema.index({ form_group: 1, status: 1 });
dosageFormSchema.index({ default_route_id: 1 });
dosageFormSchema.index({ default_unit_id: 1 });

module.exports = model('DosageForm', dosageFormSchema);
