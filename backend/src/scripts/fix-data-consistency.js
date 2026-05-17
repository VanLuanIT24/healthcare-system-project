const { connectDatabase, mongoose } = require('../config/database');
require('../models');
const {
  Appointment,
  Bed,
  BedAssignment,
  Invoice,
  Payment,
  ScheduleSlot,
} = require('../models');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  BED_ASSIGNMENT_STATUS,
  BED_STATUS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
} = require('../constants/statuses');

const apply = process.argv.includes('--apply');

async function fixInvoiceBalances() {
  const invoices = await Invoice.find({ status: { $ne: INVOICE_STATUS.VOIDED } });
  const updates = [];
  for (const invoice of invoices) {
    const paid = await Payment.aggregate([
      { $match: { invoice_id: invoice._id, status: PAYMENT_STATUS.COMPLETED } },
      { $group: { _id: '$invoice_id', amount: { $sum: '$amount' } } },
    ]);
    const paidAmount = Number(paid[0]?.amount || 0);
    const balanceDue = Math.max(0, Number(invoice.total_amount || 0) - paidAmount);
    const nextStatus = balanceDue === 0 && invoice.status !== INVOICE_STATUS.DRAFT
      ? INVOICE_STATUS.PAID
      : paidAmount > 0 && invoice.status !== INVOICE_STATUS.DRAFT
        ? INVOICE_STATUS.PARTIALLY_PAID
        : invoice.status;
    if (Number(invoice.paid_amount || 0) !== paidAmount || Number(invoice.balance_due || 0) !== balanceDue || invoice.status !== nextStatus) {
      updates.push({
        invoice_id: String(invoice._id),
        paid_amount: paidAmount,
        balance_due: balanceDue,
        status: nextStatus,
      });
      if (apply) {
        invoice.paid_amount = paidAmount;
        invoice.balance_due = balanceDue;
        invoice.status = nextStatus;
        await invoice.save();
      }
    }
  }
  return updates;
}

async function fixSlotBookedCounts() {
  const slots = await ScheduleSlot.find({ is_deleted: false });
  const updates = [];
  for (const slot of slots) {
    const activeCount = await Appointment.countDocuments({
      schedule_slot_id: slot._id,
      is_deleted: false,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    });
    if (Number(slot.booked_count || 0) !== activeCount) {
      updates.push({
        schedule_slot_id: String(slot._id),
        from: slot.booked_count || 0,
        to: activeCount,
      });
      if (apply) {
        slot.booked_count = activeCount;
        await slot.save();
      }
    }
  }
  return updates;
}

async function fixBedOccupancy() {
  const beds = await Bed.find({ status: BED_STATUS.OCCUPIED });
  const updates = [];
  for (const bed of beds) {
    const activeAssignment = await BedAssignment.findOne({
      bed_id: bed._id,
      status: BED_ASSIGNMENT_STATUS.ACTIVE,
    }).lean();
    if (!activeAssignment) {
      updates.push({
        bed_id: String(bed._id),
        from: bed.status,
        to: BED_STATUS.AVAILABLE,
      });
      if (apply) {
        bed.status = BED_STATUS.AVAILABLE;
        await bed.save();
      }
    }
  }
  return updates;
}

async function main() {
  await connectDatabase();
  const [invoice_updates, slot_updates, bed_updates] = await Promise.all([
    fixInvoiceBalances(),
    fixSlotBookedCounts(),
    fixBedOccupancy(),
  ]);
  console.log(JSON.stringify({
    success: true,
    mode: apply ? 'apply' : 'dry_run',
    invoice_updates,
    slot_updates,
    bed_updates,
  }, null, 2));
  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
