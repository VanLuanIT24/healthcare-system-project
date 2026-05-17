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

function isSafeSortField(field) {
  return /^[A-Za-z0-9_]+$/.test(String(field || ''));
}

function buildSort(sortBy = 'created_at', sortOrder = 'desc', allowedFields = []) {
  const requested = String(sortBy || '').trim();
  const safeSortBy = !isSafeSortField(requested) || (allowedFields.length && !allowedFields.includes(requested))
    ? 'created_at'
    : requested;

  return {
    [safeSortBy]: sortOrder === 'asc' ? 1 : -1,
  };
}

function castFilterValue(value, spec = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const type = spec.type || 'string';

  if (type === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  if (type === 'boolean') {
    if (value === true || value === 'true' || value === '1' || value === 1) return true;
    if (value === false || value === 'false' || value === '0' || value === 0) return false;
    return undefined;
  }

  if (type === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  if (type === 'array') {
    const values = Array.isArray(value) ? value : String(value).split(',');
    const cleaned = values.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length ? { $in: cleaned } : undefined;
  }

  if (type === 'regex') {
    return buildRegexSearch(value);
  }

  if (spec.enum && !spec.enum.includes(value)) return undefined;
  return String(value).trim();
}

function normalizeFilterSpec(field, spec = {}) {
  if (typeof spec === 'string') {
    return { field: spec, queryKey: spec };
  }
  return {
    field,
    queryKey: field,
    ...spec,
  };
}

function buildSafeQuery(query = {}, allowedFilters = {}, options = {}) {
  const filter = { ...(options.baseFilter || {}) };
  const entries = Array.isArray(allowedFilters)
    ? allowedFilters.map((field) => [field, { field, queryKey: field }])
    : Object.entries(allowedFilters);

  for (const [field, rawSpec] of entries) {
    const spec = normalizeFilterSpec(field, rawSpec);
    const key = spec.queryKey || field;
    const targetField = spec.field || field;

    if (spec.type === 'dateRange') {
      const fromKey = spec.fromKey || `${key}_from`;
      const toKey = spec.toKey || `${key}_to`;
      const range = buildDateRangeFilter(targetField, query[fromKey], query[toKey]);
      Object.assign(filter, range);
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(query, key)) continue;
    const value = castFilterValue(query[key], spec);
    if (value !== undefined) filter[targetField] = value;
  }

  const keyword = String(query.keyword || query.search || '').trim();
  const keywordFields = options.keywordFields || [];
  if (keyword && keywordFields.length) {
    const regex = buildRegexSearch(keyword);
    filter.$or = keywordFields.map((field) => ({ [field]: regex }));
  }

  return filter;
}

function buildSafeSort(sort = null, allowedSortFields = [], defaultSort = { created_at: -1 }) {
  const sortText = String(sort || '').trim();
  if (!sortText) return defaultSort;

  const output = {};
  const fields = sortText.split(',').map((field) => field.trim()).filter(Boolean);
  for (const rawField of fields) {
    const direction = rawField.startsWith('-') ? -1 : 1;
    const field = rawField.replace(/^-/, '').split(':')[0];
    const explicitDirection = rawField.includes(':')
      ? String(rawField.split(':')[1]).toLowerCase()
      : null;
    if (!isSafeSortField(field)) continue;
    if (allowedSortFields.length && !allowedSortFields.includes(field)) continue;
    output[field] = explicitDirection === 'desc' ? -1 : explicitDirection === 'asc' ? 1 : direction;
  }

  return Object.keys(output).length ? output : defaultSort;
}

function applyActorScopeFilter(actor = {}, resource = {}, filter = {}) {
  const actorType = actor.actorType || actor.actor_type;
  const scopedFilter = { ...filter };

  if (actorType === 'patient' && resource.patientField) {
    scopedFilter[resource.patientField] = actor.patientId || actor.patient_id;
    return scopedFilter;
  }

  if ((actorType === 'patient_relative' || actorType === 'relative') && resource.patientField) {
    scopedFilter[resource.patientField] = actor.patientId || actor.patient_id;
    return scopedFilter;
  }

  if (actorType === 'staff' && resource.departmentField && resource.departmentScoped) {
    const departmentId = actor.departmentId || actor.department_id || actor.user?.department_id;
    if (!departmentId) {
      scopedFilter._id = null;
      return scopedFilter;
    }
    scopedFilter[resource.departmentField] = departmentId;
  }

  if (actorType === 'staff' && resource.ownerField && resource.ownScoped) {
    scopedFilter[resource.ownerField] = actor.userId || actor.user_id;
  }

  return scopedFilter;
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
  buildSafeQuery,
  buildSafeSort,
  applyActorScopeFilter,
  isSafeSortField,
  removeEmptyFields,
};
