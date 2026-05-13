function toMoney(value = 0, options = {}) {
  const { fieldName = 'amount', allowZero = true } = options;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a finite integer minor-unit amount.`);
  }
  if (!Number.isInteger(number)) {
    throw new Error(`${fieldName} must use integer minor units.`);
  }
  if (allowZero ? number < 0 : number <= 0) {
    throw new Error(`${fieldName} must be ${allowZero ? '>= 0' : '> 0'}.`);
  }
  return number;
}

function calculateLineTotal({
  quantity = 1,
  unitPrice = 0,
  discountAmount = 0,
  taxAmount = 0,
}) {
  const normalizedQuantity = Number(quantity);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0 || !Number.isInteger(normalizedQuantity)) {
    throw new Error('quantity must be a positive integer for money calculations.');
  }
  const subtotal = toMoney(normalizedQuantity * toMoney(unitPrice, { fieldName: 'unitPrice' }), { fieldName: 'subtotal' });
  const total = subtotal - toMoney(discountAmount) + toMoney(taxAmount);
  return Math.max(total, 0);
}

function calculateInvoiceTotals(items = []) {
  const subtotalAmount = items.reduce((sum, item) => sum + toMoney(item.quantity * item.unit_price), 0);
  const discountAmount = items.reduce((sum, item) => sum + toMoney(item.discount_amount), 0);
  const taxAmount = items.reduce((sum, item) => sum + toMoney(item.tax_amount), 0);
  const totalAmount = items.reduce((sum, item) => sum + toMoney(item.line_total), 0);

  return {
    subtotal_amount: subtotalAmount,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
  };
}

function calculateBalanceDue(totalAmount, paidAmount, insuranceAmount = 0) {
  return Math.max(toMoney(totalAmount) - toMoney(paidAmount) - toMoney(insuranceAmount), 0);
}

module.exports = {
  toMoney,
  calculateLineTotal,
  calculateInvoiceTotals,
  calculateBalanceDue,
};
