const { StockBatch } = require('../models');
const { REALTIME_EVENT_TYPE, STOCK_BATCH_STATUS } = require('../constants/statuses');
const { ROLE_CODE } = require('../constants/permissions');
const eventBus = require('../events/event-bus.service');

const EXPIRY_WINDOW_DAYS = Number(process.env.DRUG_EXPIRY_ALERT_DAYS || 30);

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

async function lowStockAlert({ limit = 100 } = {}) {
  const batches = await StockBatch.find({
    status: STOCK_BATCH_STATUS.AVAILABLE,
    quantity_on_hand: { $gt: 0 },
    $expr: { $lte: ['$quantity_on_hand', '$min_stock_level'] },
  }).sort({ quantity_on_hand: 1 }).limit(Number(limit) || 100).populate('medication_id', 'medication_code generic_name brand_name').lean();

  for (const batch of batches) {
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.INVENTORY_LOW_STOCK,
      aggregateType: 'stock_batch',
      aggregateId: batch._id,
      recipientScope: {
        roles: [ROLE_CODE.PHARMACIST, ROLE_CODE.INVENTORY_STAFF, ROLE_CODE.ADMIN],
      },
      payload: {
        stock_batch_id: toId(batch._id),
        medication_id: toId(batch.medication_id?._id || batch.medication_id),
        medication_code: batch.medication_id?.medication_code,
        quantity_on_hand: batch.quantity_on_hand,
        min_stock_level: batch.min_stock_level,
        notification: {
          dedupe_key: `low_stock:${toId(batch._id)}`,
          title: 'Cảnh báo tồn kho thấp',
          body: `${batch.medication_id?.generic_name || batch.batch_no} đang dưới ngưỡng tồn kho.`,
          priority: 'high',
        },
      },
      idempotencyKey: `low_stock:${toId(batch._id)}:${batch.quantity_on_hand}`,
    }, { publishImmediately: false });
  }

  return { low_stock_count: batches.length, stock_batch_ids: batches.map((item) => toId(item._id)) };
}

async function drugExpiryAlert({ limit = 100 } = {}) {
  const now = new Date();
  const until = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const batches = await StockBatch.find({
    status: STOCK_BATCH_STATUS.AVAILABLE,
    quantity_on_hand: { $gt: 0 },
    expiry_date: { $gte: now, $lte: until },
  }).sort({ expiry_date: 1 }).limit(Number(limit) || 100).populate('medication_id', 'medication_code generic_name brand_name').lean();

  for (const batch of batches) {
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.INVENTORY_DRUG_EXPIRING,
      aggregateType: 'stock_batch',
      aggregateId: batch._id,
      recipientScope: {
        roles: [ROLE_CODE.PHARMACIST, ROLE_CODE.INVENTORY_STAFF, ROLE_CODE.ADMIN],
      },
      payload: {
        stock_batch_id: toId(batch._id),
        medication_id: toId(batch.medication_id?._id || batch.medication_id),
        expiry_date: batch.expiry_date,
        quantity_on_hand: batch.quantity_on_hand,
        notification: {
          dedupe_key: `drug_expiring:${toId(batch._id)}`,
          title: 'Cảnh báo thuốc sắp hết hạn',
          body: `${batch.medication_id?.generic_name || batch.batch_no} sắp hết hạn.`,
          priority: 'high',
        },
      },
      idempotencyKey: `drug_expiring:${toId(batch._id)}:${new Date(batch.expiry_date).toISOString().slice(0, 10)}`,
    }, { publishImmediately: false });
  }

  return { expiring_count: batches.length, stock_batch_ids: batches.map((item) => toId(item._id)) };
}

module.exports = {
  lowStockAlert,
  drugExpiryAlert,
};
