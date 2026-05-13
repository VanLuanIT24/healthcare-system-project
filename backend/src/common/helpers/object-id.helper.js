const { mongoose } = require('../../config/database');
const ApiError = require('../errors/api-error');

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function assertValidObjectId(value, fieldName = 'id') {
  if (!isValidObjectId(value)) {
    throw ApiError.badRequest(`Invalid ${fieldName}`, {
      field: fieldName,
      value,
    });
  }
}

function toObjectId(value, fieldName = 'id') {
  assertValidObjectId(value, fieldName);
  return new mongoose.Types.ObjectId(value);
}

function sameObjectId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

module.exports = {
  isValidObjectId,
  assertValidObjectId,
  toObjectId,
  sameObjectId,
};
