const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const PREPARATION_CHECKLIST_ITEM_STATUS = {
  PENDING: 'pending',
  DONE: 'done',
  FAILED: 'failed',
  NOT_APPLICABLE: 'not_applicable',
  WAIVED: 'waived',
};

const PREPARATION_CHECKLIST_ITEM_STATUSES = Object.values(PREPARATION_CHECKLIST_ITEM_STATUS);
const PREPARATION_VALUE_TYPES = ['boolean', 'text', 'number', 'datetime', 'select', 'file', 'signature'];

const preparationChecklistItemSchema = new Schema(
  {
    preparation_id: { type: Schema.Types.ObjectId, ref: 'ServicePreparation', required: true },

    template_code: { type: String, trim: true },
    template_item_code: { type: String, trim: true },

    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    category: { type: String, trim: true },
    required: { type: Boolean, default: false },
    critical: { type: Boolean, default: false },

    status: {
      type: String,
      enum: PREPARATION_CHECKLIST_ITEM_STATUSES,
      default: PREPARATION_CHECKLIST_ITEM_STATUS.PENDING,
    },

    value_type: { type: String, enum: PREPARATION_VALUE_TYPES, default: 'boolean' },
    value: { type: Schema.Types.Mixed },

    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },

    failed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    failed_at: { type: Date },
    failed_reason: { type: String, trim: true },

    waived_by: { type: Schema.Types.ObjectId, ref: 'User' },
    waived_at: { type: Date },
    waived_reason: { type: String, trim: true },

    requires_doctor_confirmation: { type: Boolean, default: false },
    doctor_confirmed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    doctor_confirmed_at: { type: Date },

    evidence_attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
    note: { type: String, trim: true },
    sort_order: { type: Number, default: 0 },
  },
  { ...baseSchemaOptions, collection: 'preparation_checklist_items' },
);

preparationChecklistItemSchema.index({ preparation_id: 1, sort_order: 1 });
preparationChecklistItemSchema.index({ preparation_id: 1, status: 1 });
preparationChecklistItemSchema.index({ preparation_id: 1, required: 1, status: 1 });
preparationChecklistItemSchema.index({ preparation_id: 1, code: 1 }, { unique: true });
preparationChecklistItemSchema.index({ evidence_attachment_id: 1 });

preparationChecklistItemSchema.statics.STATUS = PREPARATION_CHECKLIST_ITEM_STATUS;
preparationChecklistItemSchema.statics.STATUSES = PREPARATION_CHECKLIST_ITEM_STATUSES;

module.exports = model('PreparationChecklistItem', preparationChecklistItemSchema);
