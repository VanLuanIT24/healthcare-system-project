function normalizeString(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

function normalizeLowercase(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

function normalizeUppercase(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : undefined;
}

function normalizePhone(value) {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  return normalized.replace(/\s+/g, '');
}

module.exports = {
  normalizeString,
  normalizeLowercase,
  normalizeUppercase,
  normalizePhone,
};
