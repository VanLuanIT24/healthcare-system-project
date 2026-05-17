const fs = require('fs');
const path = require('path');
const { connectDatabase, mongoose } = require('../config/database');
require('../models');
const {
  Appointment,
  Bed,
  BedAssignment,
  Encounter,
  Invoice,
  LabOrder,
  LabResult,
  Payment,
  ScheduleSlot,
  StockBatch,
  DocumentExportRequest,
} = require('../models');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  BED_ASSIGNMENT_STATUS,
  BED_STATUS,
  DOCUMENT_EXPORT_STATUS,
  INVOICE_STATUS,
  LAB_ORDER_STATUS,
  LAB_RESULT_STATUS,
  PAYMENT_STATUS,
} = require('../constants/statuses');

async function checkInvoiceBalances() {
  const invoices = await Invoice.find({ status: { $ne: INVOICE_STATUS.VOIDED } }).lean();
  return invoices
    .filter((invoice) => Number(invoice.balance_due || 0) !== Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0))
    .map((invoice) => ({
      type: 'invoice_balance_mismatch',
      invoice_id: String(invoice._id),
      expected_balance_due: Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0),
      actual_balance_due: invoice.balance_due,
    }));
}

async function checkSlotBookedCounts() {
  const slots = await ScheduleSlot.find({ is_deleted: false }).select('_id booked_count').lean();
  const issues = [];
  for (const slot of slots) {
    const activeCount = await Appointment.countDocuments({
      schedule_slot_id: slot._id,
      is_deleted: false,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    });
    if (Number(slot.booked_count || 0) !== activeCount) {
      issues.push({
        type: 'slot_booked_count_mismatch',
        schedule_slot_id: String(slot._id),
        expected_booked_count: activeCount,
        actual_booked_count: slot.booked_count || 0,
      });
    }
  }
  return issues;
}

async function checkBedOccupancy() {
  const beds = await Bed.find({ status: BED_STATUS.OCCUPIED }).select('_id bed_code').lean();
  const issues = [];
  for (const bed of beds) {
    const assignment = await BedAssignment.findOne({
      bed_id: bed._id,
      status: BED_ASSIGNMENT_STATUS.ACTIVE,
    }).lean();
    if (!assignment) {
      issues.push({
        type: 'bed_occupied_without_active_assignment',
        bed_id: String(bed._id),
        bed_code: bed.bed_code,
      });
    }
  }
  return issues;
}

async function checkNegativeStock() {
  const batches = await StockBatch.find({ quantity_on_hand: { $lt: 0 } }).lean();
  return batches.map((batch) => ({
    type: 'stock_quantity_negative',
    stock_batch_id: String(batch._id),
    medication_id: String(batch.medication_id),
    quantity_on_hand: batch.quantity_on_hand,
  }));
}

async function checkPaymentInvoiceSync() {
  const payments = await Payment.find({ status: PAYMENT_STATUS.COMPLETED }).lean();
  const issues = [];
  for (const payment of payments) {
    const invoice = await Invoice.findById(payment.invoice_id).lean();
    if (!invoice) continue;
    if (![INVOICE_STATUS.PAID, INVOICE_STATUS.PARTIALLY_PAID].includes(invoice.status)) {
      issues.push({
        type: 'payment_completed_invoice_not_paid_status',
        payment_id: String(payment._id),
        invoice_id: String(invoice._id),
        invoice_status: invoice.status,
      });
    }
  }
  return issues;
}

async function checkLabOrderSync() {
  const results = await LabResult.find({ status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] } }).lean();
  const issues = [];
  for (const result of results) {
    const order = await LabOrder.findById(result.lab_order_id).lean();
    if (order && order.status !== LAB_ORDER_STATUS.COMPLETED) {
      issues.push({
        type: 'lab_finalized_order_not_completed',
        lab_result_id: String(result._id),
        lab_order_id: String(order._id),
        lab_order_status: order.status,
      });
    }
  }
  return issues;
}

async function checkCompletedAppointmentsHaveEncounter() {
  const appointments = await Appointment.find({ status: 'completed', is_deleted: false }).select('_id').lean();
  const issues = [];
  for (const appointment of appointments) {
    const encounter = await Encounter.findOne({ appointment_id: appointment._id, status: { $ne: 'cancelled' } }).lean();
    if (!encounter) {
      issues.push({
        type: 'appointment_completed_without_encounter',
        appointment_id: String(appointment._id),
      });
    }
  }
  return issues;
}

async function checkReadyExportsHaveFile() {
  const exports = await DocumentExportRequest.find({ status: DOCUMENT_EXPORT_STATUS.READY }).lean();
  return exports
    .filter((item) => !item.file_url || (path.isAbsolute(String(item.file_url)) && !fs.existsSync(item.file_url)))
    .map((item) => ({
      type: 'document_export_ready_file_missing',
      export_id: String(item._id),
      file_url: item.file_url || null,
    }));
}

async function main() {
  await connectDatabase();
  const groups = await Promise.all([
    checkInvoiceBalances(),
    checkSlotBookedCounts(),
    checkBedOccupancy(),
    checkNegativeStock(),
    checkPaymentInvoiceSync(),
    checkLabOrderSync(),
    checkCompletedAppointmentsHaveEncounter(),
    checkReadyExportsHaveFile(),
  ]);
  const issues = groups.flat();
  console.log(JSON.stringify({
    success: issues.length === 0,
    issue_count: issues.length,
    issues,
  }, null, 2));
  await mongoose.connection.close();
  if (issues.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
