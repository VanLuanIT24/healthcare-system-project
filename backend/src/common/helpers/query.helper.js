function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegexSearch(value) {
  if (!value) return null;
  return new RegExp(escapeRegex(value), 'i');
}

function buildDateRangeFilter(field, from, to) {
  if (!from && !to) return {};

  const filter = {
    [field]: {},
  };

  if (from) filter[field].$gte = new Date(from);
  if (to) filter[field].$lte = new Date(to);

  return filter;
}

function buildSort(sortBy = 'created_at', sortOrder = 'desc', allowedFields = []) {
  const safeSortBy = allowedFields.length && !allowedFields.includes(sortBy)
    ? 'created_at'
    : sortBy;

  return {
    [safeSortBy]: sortOrder === 'asc' ? 1 : -1,
  };
}

function removeEmptyFields(obj = {}) {
  const result = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    result[key] = value;
  });

  return result;
}

module.exports = {
  escapeRegex,
  buildRegexSearch,
  buildDateRangeFilter,
  buildSort,
  removeEmptyFields,
};
