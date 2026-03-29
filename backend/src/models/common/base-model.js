const { Schema } = require('mongoose');

const baseSchemaOptions = {
  versionKey: false,
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

function auditFields() {
  return {
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  };
}

function softDeleteFields() {
  return {
    deleted_at: { type: Date },
    deleted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    is_deleted: { type: Boolean, default: false },
  };
}

module.exports = {
  Schema,
  baseSchemaOptions,
  auditFields,
  softDeleteFields,
};
