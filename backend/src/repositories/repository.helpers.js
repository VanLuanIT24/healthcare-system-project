function normalizeUpdatePayload(payload = {}) {
  const hasOperator = Object.keys(payload).some((key) => key.startsWith('$'));
  return hasOperator ? payload : { $set: payload };
}

function normalizeLeanOption(lean = true) {
  return lean !== false;
}

function normalizePopulate(populate = null) {
  if (!populate) return [];
  return Array.isArray(populate) ? populate : [populate];
}

module.exports = {
  normalizeUpdatePayload,
  normalizeLeanOption,
  normalizePopulate,
};
