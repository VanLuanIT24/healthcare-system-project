const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ADMISSION_STATUS, ADMISSION_STATUSES, ADMISSION_TYPE, ADMISSION_TYPES } = require('../../constants/statuses');

// Bảng admissions: Lưu hồ sơ nhập viện, khoa điều trị, bác sĩ phụ trách và ra viện.

const admissionSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    attending_doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    admission_no: { type: String, required: true, unique: true, trim: true },
    admission_type: { type: String, enum: ADMISSION_TYPES, default: ADMISSION_TYPE.ELECTIVE, required: true },
    admitted_at: { type: Date },
    admitted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    discharged_at: { type: Date },
    discharged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    reason: { type: String },
    discharge_disposition: { type: String, trim: true },
    discharge_summary: { type: String },
    status: { type: String, enum: ADMISSION_STATUSES, default: ADMISSION_STATUS.PLANNED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'admissions' },
);

admissionSchema.index({ patient_id: 1 });
admissionSchema.index({ encounter_id: 1 }, { unique: true, sparse: true });
admissionSchema.index({ department_id: 1 });
admissionSchema.index({ attending_doctor_id: 1 });
admissionSchema.index({ admitted_at: 1 });
admissionSchema.index({ discharged_at: 1 });
admissionSchema.index({ status: 1 });
admissionSchema.index({ patient_id: 1, admitted_at: 1 });

module.exports = model('Admission', admissionSchema);
