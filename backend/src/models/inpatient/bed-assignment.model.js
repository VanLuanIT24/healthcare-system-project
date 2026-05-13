const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { BED_ASSIGNMENT_STATUS, BED_ASSIGNMENT_STATUSES } = require('../../constants/statuses');

// Bảng bed_assignments: Lưu lịch sử gán, chuyển và trả giường trong một lần nhập viện.

const bedAssignmentSchema = new Schema(
  {
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission', required: true },
    bed_id: { type: Schema.Types.ObjectId, ref: 'Bed', required: true },
    assigned_by: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_from: { type: Date, required: true },
    assigned_to: { type: Date },
    release_reason: { type: String },
    note: { type: String },
    status: { type: String, enum: BED_ASSIGNMENT_STATUSES, default: BED_ASSIGNMENT_STATUS.ACTIVE, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'bed_assignments' },
);

bedAssignmentSchema.index({ assigned_by: 1 });
bedAssignmentSchema.index({ assigned_from: 1 });
bedAssignmentSchema.index({ assigned_to: 1 });
bedAssignmentSchema.index({ status: 1 });
bedAssignmentSchema.index({ bed_id: 1, status: 1 });
bedAssignmentSchema.index({ bed_id: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
bedAssignmentSchema.index({ admission_id: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
bedAssignmentSchema.index({ admission_id: 1, assigned_from: 1 });

module.exports = model('BedAssignment', bedAssignmentSchema);
