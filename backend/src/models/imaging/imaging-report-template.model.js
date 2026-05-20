const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { IMAGING_MODALITIES } = require('../../constants/statuses');

const imagingReportTemplateSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    modality: { type: String, enum: IMAGING_MODALITIES, trim: true },
    body_part: { type: String, trim: true },
    findings_template: { type: String },
    impression_template: { type: String },
    recommendation_template: { type: String },
    active: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'imaging_report_templates' },
);

imagingReportTemplateSchema.index({ modality: 1, body_part: 1, active: 1 });

module.exports = model('ImagingReportTemplate', imagingReportTemplateSchema);
