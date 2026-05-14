const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function assertIncludes(relativePath, expected, message) {
  if (!read(relativePath).includes(expected)) {
    throw new Error(`${message} (${relativePath})`);
  }
}

function main() {
  assertIncludes('src/services/prescription.service.js', 'PRESCRIPTION_EDITABLE_STATUSES = [\n  PRESCRIPTION_STATUS.DRAFT', 'Signed/verified prescriptions must not be directly editable.');
  assertIncludes('src/services/prescription.service.js', 'Không được tạo prescription thay bác sĩ khác.', 'Prescription create must reject prescribed_by spoofing.');
  assertIncludes('src/services/prescription.service.js', 'Bạn không có quyền kê đơn cho encounter này.', 'Doctor/staff outside encounter department must be rejected.');
  assertIncludes('src/services/prescription.service.js', 'Prescription item thiếu medication_id/dosage/route/frequency/duration/quantity/unit.', 'Prescription verification must enforce complete item payload.');
  assertIncludes('src/services/prescription.service.js', 'Payload có thuốc bị trùng.', 'Duplicate medication in one prescription must be detected.');
  assertIncludes('src/services/prescription.service.js', 'status: ALLERGY_STATUS.ACTIVE', 'Only active allergies should trigger allergy warnings.');
  assertIncludes('src/services/prescription.service.js', 'drug_interaction_engine_unavailable_manual_review_required', 'Missing drug interaction engine must have explicit manual-review override policy.');
  assertIncludes('src/services/prescription.service.js', 'Prescription phải verified/partially_dispensed trước khi dispense.', 'Unverified prescriptions must not be dispensed.');
  assertIncludes('src/services/prescription.service.js', 'quantity_on_hand: { $gte: quantity }', 'Dispense must decrement stock with an atomic available_quantity guard.');
  assertIncludes('src/services/prescription.service.js', 'Dispense đã cấp phát phải dùng return_to_stock=true', 'Dispensed orders must use return workflow for stock restoration.');
  assertIncludes('src/services/prescription.service.js', 'Charge thuốc đã lên invoice; cần refund/void invoice trước khi return dispense.', 'Return/cancel dispense must not silently void billed medication charges.');
  assertIncludes('src/services/prescription.service.js', 'source_module: \'dispense_item\'', 'Medication charges must carry a unique source module/id.');
  assertIncludes('src/services/prescription.service.js', 'Dispense item đã được complete bởi request khác', 'Concurrent/double dispense completion must fail clearly without double stock decrement.');
  assertIncludes('src/services/prescription.service.js', 'withPrescriptionFailureAudits', 'Prescription/pharmacy mutating failures must be audited.');
  assertIncludes('src/models/pharmacy/prescription-item.model.js', 'unit: { type: String, required: true', 'Prescription items must persist required unit.');
  assertIncludes('src/models/pharmacy/prescription-item.model.js', 'unique: true', 'Prescription item duplicate medication must be prevented by an index.');
  assertIncludes('src/models/pharmacy/dispense-item.model.js', 'partialFilterExpression: { status: DISPENSE_ITEM_STATUS.DISPENSED }', 'Dispense item duplicates must be prevented for completed dispense rows.');

  assertIncludes('src/common/helpers/money.helper.js', 'integer minor units', 'Money helper must enforce integer minor units.');
  assertIncludes('src/services/billing.service.js', 'normalizeMoneyAmount', 'Billing service must normalize money through integer minor units.');
  assertIncludes('src/services/billing.service.js', 'reserveInvoiceBalanceForCompletedPayment', 'Payment must reserve invoice balance atomically.');
  assertIncludes('src/services/billing.service.js', 'balance_due: { $gte: amount }', 'Payment must not overpay even under concurrent requests.');
  assertIncludes('src/services/billing.service.js', 'Payment amount không được vượt balance_due.', 'Payment over balance must be rejected clearly.');
  assertIncludes('src/services/billing.service.js', 'Payment đã được refund/void bởi request khác.', 'Refund/void payment must be idempotency/race guarded.');
  assertIncludes('src/services/billing.service.js', 'Invoice đã có payment completed. Cần refund/void payment trước khi void invoice.', 'Paid invoices must not be voided directly.');
  assertIncludes('src/services/billing.service.js', 'source_module: normalizeString(payload.source_module || payload.source_type)', 'Charges must normalize source_type/source_module for idempotency.');
  assertIncludes('src/services/billing.service.js', 'if (duplicate) {\n      chargeId = duplicate._id;', 'Charge creation retry must return existing active charge instead of duplicating.');
  assertIncludes('src/services/billing.service.js', 'createInvoiceItemsSnapshot', 'Invoice items must snapshot charge/service data at invoice creation.');
  assertIncludes('src/services/billing.service.js', 'Bạn không có quyền thao tác invoice ngoài khoa.', 'Billing invoice/payment actions must enforce department scope.');
  assertIncludes('src/services/billing.service.js', 'Staff department A không được xem revenue department B.', 'Revenue report/export must enforce department scope.');
  assertIncludes('src/services/billing.service.js', 'date_from và date_to là bắt buộc cho revenue report/export.', 'Revenue report/export must validate date range.');
  assertIncludes('src/services/report.service.js', 'applyRevenueDepartmentScope', 'Actual revenue report endpoint must enforce department scope.');
  assertIncludes('src/services/report.service.js', 'assertExplicitRevenueDateRange', 'Actual revenue report/export must require explicit bounded dates.');
  assertIncludes('src/services/report.service.js', 'Staff department A không được xem revenue department B.', 'Revenue report must reject cross-department access.');
  assertIncludes('src/services/billing.service.js', 'paid_amount không được vượt approved_amount còn lại.', 'Insurance settlement must not exceed approved remaining amount.');
  assertIncludes('src/services/billing.service.js', 'withBillingFailureAudits', 'Billing mutating failures must be audited.');
  assertIncludes('src/constants/transitions/billing-transitions.js', '[INSURANCE_CLAIM_STATUS.SUBMITTED]: [\n    INSURANCE_CLAIM_STATUS.UNDER_REVIEW', 'Insurance claim must go from submit to review before approval.');
  assertIncludes('src/models/billing/charge.model.js', 'partialFilterExpression', 'Charge source uniqueness must be backed by a partial unique index.');
  assertIncludes('src/models/billing/invoice.model.js', 'status: 1, balance_due: 1', 'Invoice must have an index supporting atomic balance updates.');
  assertIncludes('src/models/billing/payment.model.js', 'invoice_id: 1, status: 1, amount: 1', 'Payment must have an index supporting refund/payment balance checks.');

  console.log('Prescription/Pharmacy and Billing hardening checks passed.');
}

main();
