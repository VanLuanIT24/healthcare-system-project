const mongoose = require('mongoose');

const { Schema } = mongoose;

function serializeDocument(_, ret) {
  if (ret._id) {
    ret.id = typeof ret._id.toString === 'function' ? ret._id.toString() : ret._id;
    delete ret._id;
  }
  return ret;
}

function optionalString(value) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

const baseSchemaOptions = {
  versionKey: false,
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  toJSON: {
    virtuals: true,
    transform: serializeDocument,
  },
  toObject: {
    virtuals: true,
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

function softDeletePlugin(schema) {
  schema.query.notDeleted = function notDeleted() {
    return this.where({ is_deleted: false });
  };

  schema.statics.notDeletedFilter = function notDeletedFilter(filter = {}) {
    return { ...filter, is_deleted: false };
  };
}

mongoose.plugin(softDeletePlugin);

module.exports = {
  Schema,
  baseSchemaOptions,
  auditFields,
  softDeleteFields,
  optionalString,
  softDeletePlugin,
};
