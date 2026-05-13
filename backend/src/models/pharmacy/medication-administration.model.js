const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ADMINISTRATION_STATUS, ADMINISTRATION_STATUSES } = require('../../constants/statuses');

// Bảng medication_administrations: Lưu ghi nhận dùng thuốc thực tế, phù hợp nội trú/eMAR.

const medicationAdministrationSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    prescription_item_id: { type: Schema.Types.ObjectId, ref: 'PrescriptionItem', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    administered_by: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduled_at: { type: Date },
    administered_at: { type: Date },
    dose: { type: String, trim: true },
    route: { type: String, trim: true },
    site: { type: String, trim: true },
    note: { type: String },
    reason_not_given: { type: String },
    status: { type: String, enum: ADMINISTRATION_STATUSES, default: ADMINISTRATION_STATUS.SCHEDULED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'medication_administrations' },
);

medicationAdministrationSchema.index({ patient_id: 1 });
medicationAdministrationSchema.index({ encounter_id: 1 });
medicationAdministrationSchema.index({ admission_id: 1 });
medicationAdministrationSchema.index({ prescription_item_id: 1 });
medicationAdministrationSchema.index({ medication_id: 1 });
medicationAdministrationSchema.index({ administered_by: 1 });
medicationAdministrationSchema.index({ scheduled_at: 1 });
medicationAdministrationSchema.index({ administered_at: 1 });
medicationAdministrationSchema.index({ status: 1 });
medicationAdministrationSchema.index({ patient_id: 1, administered_at: 1 });

module.exports = model('MedicationAdministration', medicationAdministrationSchema);
