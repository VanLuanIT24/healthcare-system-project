const DEMO_INVOICE_NO_PATTERN = /^(HD-2026|INV-DUOC-|DEV-INV-|INV\d{6}-)/i;
const DEMO_CHARGE_NO_PATTERN = /^(PHI-2026|CHG-DUOC-)/i;

function isQueryFlagTruthy(value) {
  return value === true || value === 1 || ['true', '1', 'yes', 'y'].includes(String(value || '').trim().toLowerCase());
}

function shouldIncludeDemoBillingData(source = {}) {
  const scope = String(source.data_scope || source.dataScope || source.scope || '').trim().toLowerCase();
  return isQueryFlagTruthy(source.include_demo)
    || isQueryFlagTruthy(source.includeDemo)
    || ['all', 'demo', 'seed', 'with_demo'].includes(scope);
}

function appendAndFilter(match = {}, condition = null) {
  if (!condition) return match;
  return {
    ...match,
    $and: [
      ...(Array.isArray(match.$and) ? match.$and : []),
      condition,
    ],
  };
}

function applyRealInvoiceFilter(match = {}, source = {}) {
  if (shouldIncludeDemoBillingData(source)) return match;
  return appendAndFilter(match, { invoice_no: { $not: DEMO_INVOICE_NO_PATTERN } });
}

function applyRealChargeFilter(match = {}, source = {}) {
  if (shouldIncludeDemoBillingData(source)) return match;
  return appendAndFilter(match, { charge_no: { $not: DEMO_CHARGE_NO_PATTERN } });
}

function restrictToInvoiceIds(match = {}, invoiceIds = null, field = 'invoice_id') {
  if (!Array.isArray(invoiceIds)) return match;
  return appendAndFilter(match, { [field]: { $in: invoiceIds } });
}

module.exports = {
  DEMO_CHARGE_NO_PATTERN,
  DEMO_INVOICE_NO_PATTERN,
  appendAndFilter,
  applyRealChargeFilter,
  applyRealInvoiceFilter,
  restrictToInvoiceIds,
  shouldIncludeDemoBillingData,
};
