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
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense' },
    dispense_item_id: { type: Schema.Types.ObjectId, ref: 'DispenseItem' },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    batch_no_snapshot: { type: String, trim: true },
    lot_no_snapshot: { type: String, trim: true },
    expiry_date_snapshot: { type: Date },
    dispensed_quantity_snapshot: { type: Number, min: 0 },
    dispensed_unit_snapshot: { type: String, trim: true },
    administered_by: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduled_at: { type: Date },
    administered_at: { type: Date },
    dose: { type: String, trim: true },
    route: { type: String, trim: true },
    route_id: { type: Schema.Types.ObjectId, ref: 'AdministrationRoute' },
    site: { type: String, trim: true },
    verified_patient_scan_at: { type: Date },
    verified_medication_scan_at: { type: Date },
    verified_stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    scan_result: { type: String, enum: ['pass', 'warning', 'fail'] },
    scan_warnings: [{ type: String, trim: true }],
    double_check_required: { type: Boolean, default: false },
    double_checked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    double_checked_at: { type: Date },
    administered_late_reason: { type: String, trim: true },
    administered_early_reason: { type: String, trim: true },
    exception_type: { type: String, enum: ['held', 'refused', 'omitted', 'entered_in_error'] },
    reason_code: { type: String, trim: true },
    reason_detail: { type: String, trim: true },
    requires_doctor_review: { type: Boolean, default: false },
    doctor_notified_at: { type: Date },
    doctor_notification_request_id: { type: Schema.Types.ObjectId, ref: 'DoctorNotificationRequest' },
    requires_pharmacist_review: { type: Boolean, default: false },
    pharmacist_review_status: { type: String, enum: ['pending', 'reviewed', 'not_required'] },
    pharmacist_reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    pharmacist_review_note: { type: String, trim: true },
    rescheduled_from_id: { type: Schema.Types.ObjectId, ref: 'MedicationAdministration' },
    replacement_administration_id: { type: Schema.Types.ObjectId, ref: 'MedicationAdministration' },
    resolved_at: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
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
medicationAdministrationSchema.index({ route_id: 1 });
medicationAdministrationSchema.index({ dispense_id: 1 });
medicationAdministrationSchema.index({ dispense_item_id: 1 });
medicationAdministrationSchema.index({ stock_batch_id: 1 });
medicationAdministrationSchema.index({ administered_by: 1 });
medicationAdministrationSchema.index({ scheduled_at: 1 });
medicationAdministrationSchema.index({ administered_at: 1 });
medicationAdministrationSchema.index({ status: 1 });
medicationAdministrationSchema.index({ exception_type: 1, status: 1 });
medicationAdministrationSchema.index({ requires_pharmacist_review: 1, pharmacist_review_status: 1 });
medicationAdministrationSchema.index({ patient_id: 1, administered_at: 1 });

module.exports = model('MedicationAdministration', medicationAdministrationSchema);
