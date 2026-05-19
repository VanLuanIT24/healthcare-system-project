const { mongoose } = require('../config/database');
const {
  InternalIssue,
  InternalIssueItem,
  InventoryDisposal,
  InventoryDisposalItem,
  InventoryReceipt,
  InventoryReceiptItem,
  InventoryReturn,
  InventoryReturnItem,
  InventoryTransaction,
  InventoryTransfer,
  InventoryTransferItem,
  MedicationMaster,
  StockBatch,
  StorageLocation,
  Warehouse,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const permissionService = require('./permission.service');
const prescriptionService = require('./prescription.service');
const reportService = require('./report.service');
const { PERMISSION } = require('../constants/permissions');
const {
  INVENTORY_TRANSACTION_DIRECTION,
  INVENTORY_TRANSACTION_TYPE,
  STOCK_BATCH_STATUS,
} = require('../constants/statuses');
const { withOptionalTransaction } = require('../shared/utils/transaction');

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.user?._id || actor.user?.id;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes.filter(Boolean));
}

function assertStaffPermission(actor, permissions, message = 'Bạn không có quyền thao tác kho dược.') {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (!hasAnyPermission(actor, Array.isArray(permissions) ? permissions : [permissions])) {
    throw createError(message, 403);
  }
  return true;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function nonEmpty(value) {
  return normalizeString(value).length > 0;
}

function parsePositiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw createError(`${fieldName} phải lớn hơn 0.`);
  return number;
}

function parseNonNegativeNumber(value, fieldName, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw createError(`${fieldName} không hợp lệ.`);
  return number;
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function toObjectId(value, fieldName) {
  if (!value) return undefined;
  if (!mongoose.Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`);
  return value;
}

function normalizeBatchStatus(quantityOnHand, expiryDate, currentStatus = STOCK_BATCH_STATUS.AVAILABLE) {
  if (expiryDate && expiryDate <= new Date()) return STOCK_BATCH_STATUS.EXPIRED;
  if (quantityOnHand <= 0 && currentStatus === STOCK_BATCH_STATUS.AVAILABLE) return STOCK_BATCH_STATUS.DEPLETED;
  if (currentStatus === STOCK_BATCH_STATUS.DEPLETED && quantityOnHand > 0) return STOCK_BATCH_STATUS.AVAILABLE;
  return currentStatus;
}

function applySearch(filter, query = {}, fields = []) {
  const search = normalizeString(query.search);
  if (!search || !fields.length) return;
  const pattern = escapeRegex(search);
  filter.$or = fields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } }));
}

function applyDateRange(filter, field, query = {}) {
  if (!query.date_from && !query.date_to && !query.from && !query.to) return;
  filter[field] = {};
  if (query.date_from || query.from) filter[field].$gte = parseDate(query.date_from || query.from, 'date_from');
  if (query.date_to || query.to) filter[field].$lte = parseDate(query.date_to || query.to, 'date_to');
}

function cleanObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}

async function generateDocumentNo(type, session = null) {
  return generateBusinessCode(type, { date: new Date(), session });
}

function receiptPopulate(query) {
  return query
    .populate('warehouse_id', 'warehouse_code name type')
    .populate('received_by posted_by created_by', 'full_name username');
}

function issuePopulate(query) {
  return query
    .populate('from_warehouse_id to_warehouse_id', 'warehouse_code name type')
    .populate('to_department_id', 'department_code department_name name')
    .populate('requested_by approved_by picked_by dispatched_by received_by created_by', 'full_name username');
}

function transferPopulate(query) {
  return query
    .populate('from_warehouse_id to_warehouse_id', 'warehouse_code name type')
    .populate('requested_by approved_by dispatched_by received_by created_by', 'full_name username');
}

function disposalPopulate(query) {
  return query
    .populate('warehouse_id', 'warehouse_code name type')
    .populate('requested_by approved_by posted_by witness_user_ids created_by', 'full_name username');
}

function returnPopulate(query) {
  return query
    .populate('warehouse_id', 'warehouse_code name type')
    .populate('returned_by received_by inspected_by posted_by created_by', 'full_name username');
}

function itemPopulate(query) {
  return query
    .populate('medication_id', 'medication_code generic_name brand_name dosage_form strength route_default unit sale_price min_stock_level status')
    .populate('stock_batch_id from_stock_batch_id to_stock_batch_id', 'batch_no lot_no expiry_date quantity_on_hand unit_cost storage_location status')
    .populate('inventory_transaction_id out_transaction_id in_transaction_id', 'transaction_no transaction_type direction quantity balance_after occurred_at');
}

async function listWarehouses(query = {}) {
  assertStaffPermission(query.actor || {}, [PERMISSION.STOCK_BATCHES.READ]);
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  for (const field of ['status', 'type', 'department_id']) {
    if (query[field]) filter[field] = query[field];
  }
  applySearch(filter, query, ['warehouse_code', 'name']);
  const [items, total] = await Promise.all([
    Warehouse.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Warehouse.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listStorageLocations(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  for (const field of ['warehouse_id', 'status', 'zone', 'shelf']) {
    if (query[field]) filter[field] = query[field];
  }
  applySearch(filter, query, ['location_code', 'name', 'zone', 'shelf', 'bin']);
  const [items, total] = await Promise.all([
    StorageLocation.find(filter).populate('warehouse_id', 'warehouse_code name').sort({ location_code: 1 }).skip(skip).limit(limit).lean(),
    StorageLocation.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

function listFilter(query = {}, fields = []) {
  const filter = { is_deleted: false };
  for (const field of fields) {
    if (query[field]) filter[field] = query[field];
  }
  applyDateRange(filter, 'created_at', query);
  return filter;
}

async function listDocuments(Model, query, options = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = listFilter(query, options.fields || ['status', 'warehouse_id']);
  applySearch(filter, query, options.searchFields || []);
  const findQuery = Model.find(filter).sort(options.sort || { created_at: -1 }).skip(skip).limit(limit);
  const [items, total] = await Promise.all([
    options.populate ? options.populate(findQuery).lean() : findQuery.lean(),
    Model.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getReceiptDetail(receiptId) {
  const receipt = await receiptPopulate(InventoryReceipt.findById(receiptId)).lean();
  if (!receipt || receipt.is_deleted) throw createError('Không tìm thấy phiếu nhập.', 404);
  const items = await itemPopulate(InventoryReceiptItem.find({ receipt_id: receiptId })).lean();
  return { receipt, items };
}

async function listReceipts(query = {}) {
  assertStaffPermission(query.actor || {}, [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED]);
  return listDocuments(InventoryReceipt, query, {
    fields: ['status', 'warehouse_id', 'supplier_name'],
    searchFields: ['receipt_no', 'supplier_name', 'invoice_no', 'purchase_order_no', 'note'],
    populate: receiptPopulate,
  });
}

async function createReceipt(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RECEIPT]);
  const items = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload];
  if (!items.length) throw createError('items là bắt buộc.');

  const receiptId = await withOptionalTransaction(async (session) => {
    const receiptNo = payload.receipt_no || await generateDocumentNo(CODE_TYPE.INVENTORY_RECEIPT, session);
    const normalizedItems = items.map((item) => {
      const quantity = parsePositiveNumber(item.quantity || item.quantity_received, 'quantity');
      if (!item.medication_id) throw createError('medication_id là bắt buộc.');
      if (!nonEmpty(item.batch_no)) throw createError('batch_no là bắt buộc.');
      return {
        medication_id: item.medication_id,
        batch_no: normalizeString(item.batch_no),
        lot_no: normalizeString(item.lot_no) || undefined,
        quantity,
        unit_cost: item.unit_cost !== undefined ? parseNonNegativeNumber(item.unit_cost, 'unit_cost') : undefined,
        expiry_date: parseDate(item.expiry_date, 'expiry_date'),
        manufacture_date: parseDate(item.manufacture_date, 'manufacture_date'),
        storage_location_id: item.storage_location_id,
        storage_location: normalizeString(item.storage_location || payload.storage_location) || undefined,
        warning_flags: Array.isArray(item.warning_flags) ? item.warning_flags : [],
        note: item.note,
        created_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      };
    });
    const totalQuantity = normalizedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalValue = normalizedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0);
    const [receipt] = await InventoryReceipt.create([{
      receipt_no: receiptNo,
      supplier_id: payload.supplier_id,
      supplier_name: normalizeString(payload.supplier_name) || normalizeString(items[0]?.supplier_name) || undefined,
      warehouse_id: payload.warehouse_id,
      received_at: parseDate(payload.received_at || payload.received_date, 'received_at') || new Date(),
      received_by: payload.received_by || actorUserId(actor),
      status: payload.status || 'draft',
      invoice_no: normalizeString(payload.invoice_no) || undefined,
      purchase_order_no: normalizeString(payload.purchase_order_no) || undefined,
      total_quantity: totalQuantity,
      total_value: totalValue,
      attachment_ids: payload.attachment_ids || [],
      note: payload.note || payload.reason,
      created_by: actorUserId(actor),
      updated_by: actorUserId(actor),
    }], sessionOptions(session));
    await InventoryReceiptItem.create(normalizedItems.map((item) => ({
      ...item,
      receipt_id: receipt._id,
    })), sessionOptions(session));
    return receipt._id;
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'inventory_receipt.create', targetType: 'inventory_receipt', targetId: receiptId, status: 'success', message: 'Tạo phiếu nhập kho thành công.', requestMeta });
  if (payload.post_now) return postReceipt(receiptId, payload, actor, requestMeta);
  return getReceiptDetail(receiptId);
}

async function postReceipt(receiptId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RECEIPT]);
  const receipt = await InventoryReceipt.findById(receiptId);
  if (!receipt || receipt.is_deleted) throw createError('Không tìm thấy phiếu nhập.', 404);
  if (receipt.status === 'posted') return getReceiptDetail(receipt._id);
  if (receipt.status === 'cancelled') throw createError('Phiếu nhập đã hủy.', 409);
  const items = await InventoryReceiptItem.find({ receipt_id: receipt._id });
  if (!items.length) throw createError('Phiếu nhập chưa có dòng thuốc.', 409);

  for (const item of items) {
    if (item.line_status === 'posted') continue;
    const result = await prescriptionService.receiveInventory({
      medication_id: item.medication_id,
      batch_no: item.batch_no,
      lot_no: item.lot_no,
      supplier_name: receipt.supplier_name,
      manufacture_date: item.manufacture_date,
      expiry_date: item.expiry_date,
      received_date: receipt.received_at,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      warehouse_id: receipt.warehouse_id,
      storage_location_id: item.storage_location_id,
      storage_location: item.storage_location,
      reason: payload.reason || receipt.note || `Post phiếu nhập ${receipt.receipt_no}`,
      reference_type: 'inventory_receipt',
      reference_id: receipt._id,
      document_no: receipt.receipt_no,
      occurred_at: payload.occurred_at || receipt.received_at || new Date(),
      allow_expired_receipt: payload.allow_expired_receipt,
    }, actor, requestMeta);
    item.stock_batch_id = result.stock_batch?._id || result.stock_batch?.id;
    item.inventory_transaction_id = result.transaction?._id || result.transaction?.id;
    item.line_status = 'posted';
    item.updated_by = actorUserId(actor);
    await item.save();
  }
  receipt.status = 'posted';
  receipt.posted_at = new Date();
  receipt.posted_by = actorUserId(actor);
  receipt.updated_by = actorUserId(actor);
  await receipt.save();
  await recordAuditLog({ actor, action: 'inventory_receipt.post', targetType: 'inventory_receipt', targetId: receipt._id, status: 'success', message: 'Post phiếu nhập kho thành công.', requestMeta });
  return getReceiptDetail(receipt._id);
}

async function allocateFefoItems(parentId, ItemModel, idField, sourceItems, actor) {
  const createdItems = [];
  for (const input of sourceItems) {
    const quantityRequested = parsePositiveNumber(input.quantity_requested || input.quantity || input.quantity_dispatched, 'quantity');
    if (!input.medication_id && !input.stock_batch_id && !input.from_stock_batch_id) {
      throw createError('medication_id hoặc stock_batch_id là bắt buộc.');
    }
    if (input.stock_batch_id || input.from_stock_batch_id) {
      const batchId = input.stock_batch_id || input.from_stock_batch_id;
      const batch = await StockBatch.findById(batchId).lean();
      if (!batch || batch.is_deleted) throw createError('Không tìm thấy batch được chọn.', 404);
      createdItems.push({
        [idField]: parentId,
        medication_id: batch.medication_id,
        stock_batch_id: input.stock_batch_id || undefined,
        from_stock_batch_id: input.from_stock_batch_id || undefined,
        quantity_requested: quantityRequested,
        quantity_approved: input.quantity_approved || quantityRequested,
        quantity_dispatched: input.quantity_dispatched || quantityRequested,
        quantity_received: input.quantity_received,
        unit_cost: batch.unit_cost,
        from_location: batch.storage_location,
        to_location: input.to_location,
        to_location_id: input.to_location_id,
        note: input.note,
        warning_flags: [],
        created_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      });
      continue;
    }

    const batches = await StockBatch.find({
      medication_id: input.medication_id,
      is_deleted: false,
      status: STOCK_BATCH_STATUS.AVAILABLE,
      quantity_on_hand: { $gt: 0 },
      $or: [{ expiry_date: { $exists: false } }, { expiry_date: null }, { expiry_date: { $gt: new Date() } }],
    }).sort({ expiry_date: 1, received_date: 1 }).lean();
    let remaining = quantityRequested;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, Number(batch.quantity_on_hand || 0));
      if (quantity <= 0) continue;
      createdItems.push({
        [idField]: parentId,
        medication_id: input.medication_id,
        stock_batch_id: batch._id,
        from_stock_batch_id: batch._id,
        quantity_requested: quantity,
        quantity_approved: quantity,
        quantity_dispatched: quantity,
        quantity_received: input.quantity_received,
        unit_cost: batch.unit_cost,
        from_location: batch.storage_location,
        to_location: input.to_location,
        to_location_id: input.to_location_id,
        note: input.note,
        warning_flags: quantity < remaining ? ['split_fefo'] : [],
        created_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      });
      remaining -= quantity;
    }
    if (remaining > 0) throw createError('Không đủ tồn khả dụng theo FEFO.', 409);
  }
  return ItemModel.create(createdItems);
}

async function createOutTransactionForBatch({ batchId, quantity, transactionType, actor, referenceType, referenceId, documentNo, reason, metadata = {}, session = null }) {
  const batch = await withSession(StockBatch.findOneAndUpdate(
    { _id: batchId, is_deleted: false, quantity_on_hand: { $gte: quantity } },
    { $inc: { quantity_on_hand: -quantity }, $set: { updated_by: actorUserId(actor) } },
    { new: true },
  ), session);
  if (!batch) throw createError('Không đủ tồn batch để xuất.', 409);
  const balanceAfter = Number(batch.quantity_on_hand || 0);
  const balanceBefore = balanceAfter + quantity;
  batch.status = normalizeBatchStatus(balanceAfter, batch.expiry_date, batch.status);
  batch.updated_by = actorUserId(actor);
  await batch.save(sessionOptions(session));
  return prescriptionService.createInventoryTransaction({
    medication_id: batch.medication_id,
    stock_batch_id: batch._id,
    transaction_type: transactionType,
    direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
    quantity,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    unit_cost: batch.unit_cost,
    warehouse_id: batch.warehouse_id,
    storage_location_id: batch.storage_location_id,
    reference_type: referenceType,
    reference_id: referenceId,
    document_no: documentNo,
    occurred_at: new Date(),
    note: reason,
    metadata,
  }, actor, session);
}

async function createInTransactionForBatch({ batchId, quantity, transactionType, actor, referenceType, referenceId, documentNo, reason, metadata = {}, session = null }) {
  const batch = await withSession(StockBatch.findById(batchId), session);
  if (!batch || batch.is_deleted) throw createError('Không tìm thấy batch.', 404);
  if ([STOCK_BATCH_STATUS.EXPIRED, STOCK_BATCH_STATUS.RECALLED].includes(batch.status)) {
    throw createError('Không nhập lại tồn vào batch expired/recalled.', 409);
  }
  const balanceBefore = Number(batch.quantity_on_hand || 0);
  batch.quantity_on_hand = balanceBefore + quantity;
  batch.status = normalizeBatchStatus(batch.quantity_on_hand, batch.expiry_date, batch.status);
  batch.updated_by = actorUserId(actor);
  await batch.save(sessionOptions(session));
  return prescriptionService.createInventoryTransaction({
    medication_id: batch.medication_id,
    stock_batch_id: batch._id,
    transaction_type: transactionType,
    direction: INVENTORY_TRANSACTION_DIRECTION.IN,
    quantity,
    balance_before: balanceBefore,
    balance_after: batch.quantity_on_hand,
    unit_cost: batch.unit_cost,
    warehouse_id: batch.warehouse_id,
    storage_location_id: batch.storage_location_id,
    reference_type: referenceType,
    reference_id: referenceId,
    document_no: documentNo,
    occurred_at: new Date(),
    note: reason,
    metadata,
  }, actor, session);
}

async function getIssueDetail(issueId) {
  const issue = await issuePopulate(InternalIssue.findById(issueId)).lean();
  if (!issue || issue.is_deleted) throw createError('Không tìm thấy phiếu xuất nội bộ.', 404);
  const items = await itemPopulate(InternalIssueItem.find({ issue_id: issueId })).lean();
  return { issue, items };
}

async function listIssues(query = {}) {
  assertStaffPermission(query.actor || {}, [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED]);
  return listDocuments(InternalIssue, query, {
    fields: ['status', 'from_warehouse_id', 'to_warehouse_id', 'to_department_id', 'priority'],
    searchFields: ['issue_no', 'reason', 'note', 'to_location_label'],
    populate: issuePopulate,
  });
}

async function createIssue(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ISSUE]);
  const items = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload];
  if (!nonEmpty(payload.reason)) throw createError('reason là bắt buộc.');
  const issueNo = payload.issue_no || await generateDocumentNo(CODE_TYPE.INTERNAL_ISSUE);
  const totalRequested = items.reduce((sum, item) => sum + Number(item.quantity_requested || item.quantity || 0), 0);
  const issue = await InternalIssue.create({
    issue_no: issueNo,
    from_warehouse_id: payload.from_warehouse_id,
    to_department_id: payload.to_department_id,
    to_warehouse_id: payload.to_warehouse_id,
    to_location_label: payload.to_location_label,
    requested_by: payload.requested_by || actorUserId(actor),
    status: payload.status || 'draft',
    priority: payload.priority || 'routine',
    reason: payload.reason,
    note: payload.note,
    requested_at: parseDate(payload.requested_at, 'requested_at') || new Date(),
    total_quantity_requested: totalRequested,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  const createdItems = await allocateFefoItems(issue._id, InternalIssueItem, 'issue_id', items, actor);
  issue.total_quantity_dispatched = createdItems.reduce((sum, item) => sum + Number(item.quantity_dispatched || 0), 0);
  issue.total_value = createdItems.reduce((sum, item) => sum + Number(item.quantity_dispatched || 0) * Number(item.unit_cost || 0), 0);
  issue.warning_flags = createdItems.some((item) => item.warning_flags?.length) ? ['fefo_split'] : [];
  await issue.save();
  await recordAuditLog({ actor, action: 'internal_issue.create', targetType: 'internal_issue', targetId: issue._id, status: 'success', message: 'Tạo phiếu xuất nội bộ thành công.', requestMeta });
  if (payload.post_now || payload.dispatch_now) return dispatchIssue(issue._id, payload, actor, requestMeta);
  return getIssueDetail(issue._id);
}

async function dispatchIssue(issueId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ISSUE]);
  const issue = await InternalIssue.findById(issueId);
  if (!issue || issue.is_deleted) throw createError('Không tìm thấy phiếu xuất nội bộ.', 404);
  if (issue.status === 'dispatched' || issue.status === 'received') return getIssueDetail(issue._id);
  if (issue.status === 'cancelled') throw createError('Phiếu xuất đã hủy.', 409);
  const items = await InternalIssueItem.find({ issue_id: issue._id });
  await withOptionalTransaction(async (session) => {
    for (const item of items) {
      if (item.line_status === 'dispatched') continue;
      const quantity = parsePositiveNumber(item.quantity_dispatched || item.quantity_approved || item.quantity_requested, 'quantity_dispatched');
      const transaction = await createOutTransactionForBatch({
        batchId: item.stock_batch_id,
        quantity,
        transactionType: INVENTORY_TRANSACTION_TYPE.ISSUE,
        actor,
        referenceType: 'internal_issue',
        referenceId: issue._id,
        documentNo: issue.issue_no,
        reason: payload.reason || issue.reason,
        metadata: { to_department_id: issue.to_department_id, to_warehouse_id: issue.to_warehouse_id, priority: issue.priority },
        session,
      });
      item.inventory_transaction_id = transaction._id;
      item.quantity_dispatched = quantity;
      item.line_status = 'dispatched';
      item.updated_by = actorUserId(actor);
      await item.save(sessionOptions(session));
    }
    issue.status = 'dispatched';
    issue.dispatched_at = new Date();
    issue.dispatched_by = actorUserId(actor);
    issue.total_quantity_dispatched = items.reduce((sum, item) => sum + Number(item.quantity_dispatched || item.quantity_requested || 0), 0);
    issue.updated_by = actorUserId(actor);
    await issue.save(sessionOptions(session));
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'internal_issue.dispatch', targetType: 'internal_issue', targetId: issue._id, status: 'success', message: 'Đã xuất kho nội bộ.', requestMeta });
  return getIssueDetail(issue._id);
}

async function getTransferDetail(transferId) {
  const transfer = await transferPopulate(InventoryTransfer.findById(transferId)).lean();
  if (!transfer || transfer.is_deleted) throw createError('Không tìm thấy phiếu chuyển kho.', 404);
  const items = await itemPopulate(InventoryTransferItem.find({ transfer_id: transferId })).lean();
  return { transfer, items };
}

async function listTransfers(query = {}) {
  assertStaffPermission(query.actor || {}, [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED]);
  return listDocuments(InventoryTransfer, query, {
    fields: ['status', 'from_warehouse_id', 'to_warehouse_id'],
    searchFields: ['transfer_no', 'reason', 'note'],
    populate: transferPopulate,
  });
}

async function createTransfer(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_OUT, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_IN]);
  const items = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload];
  if (!nonEmpty(payload.reason)) throw createError('reason là bắt buộc.');
  const transferNo = payload.transfer_no || await generateDocumentNo(CODE_TYPE.INVENTORY_TRANSFER);
  const transfer = await InventoryTransfer.create({
    transfer_no: transferNo,
    from_warehouse_id: payload.from_warehouse_id,
    to_warehouse_id: payload.to_warehouse_id,
    status: payload.status || 'draft',
    requested_by: payload.requested_by || actorUserId(actor),
    requested_at: parseDate(payload.requested_at, 'requested_at') || new Date(),
    reason: payload.reason,
    note: payload.note,
    total_quantity_requested: items.reduce((sum, item) => sum + Number(item.quantity_requested || item.quantity || 0), 0),
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  const transferItems = await allocateFefoItems(transfer._id, InventoryTransferItem, 'transfer_id', items.map((item) => ({
    ...item,
    from_stock_batch_id: item.from_stock_batch_id || item.stock_batch_id,
    to_location: item.to_location || payload.to_location || payload.to_storage_location,
    to_location_id: item.to_location_id || payload.to_location_id,
  })), actor);
  for (const item of transferItems) {
    item.quantity_dispatched = item.quantity_dispatched || item.quantity_requested;
    item.quantity_received = item.quantity_received || item.quantity_dispatched;
    await item.save();
  }
  transfer.total_quantity_dispatched = transferItems.reduce((sum, item) => sum + Number(item.quantity_dispatched || 0), 0);
  transfer.total_quantity_received = transferItems.reduce((sum, item) => sum + Number(item.quantity_received || 0), 0);
  transfer.total_value = transferItems.reduce((sum, item) => sum + Number(item.quantity_dispatched || 0) * Number(item.unit_cost || 0), 0);
  await transfer.save();
  await recordAuditLog({ actor, action: 'inventory_transfer.create', targetType: 'inventory_transfer', targetId: transfer._id, status: 'success', message: 'Tạo phiếu chuyển kho thành công.', requestMeta });
  if (payload.post_now || payload.dispatch_now) return dispatchTransfer(transfer._id, payload, actor, requestMeta);
  return getTransferDetail(transfer._id);
}

async function dispatchTransfer(transferId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_OUT, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_IN]);
  const transfer = await InventoryTransfer.findById(transferId);
  if (!transfer || transfer.is_deleted) throw createError('Không tìm thấy phiếu chuyển kho.', 404);
  if (['dispatched', 'in_transit', 'received', 'closed'].includes(transfer.status)) return getTransferDetail(transfer._id);
  const items = await InventoryTransferItem.find({ transfer_id: transfer._id });
  await withOptionalTransaction(async (session) => {
    for (const item of items) {
      if (item.status === 'dispatched' || item.status === 'received') continue;
      const batch = await withSession(StockBatch.findById(item.from_stock_batch_id || item.stock_batch_id), session);
      if (!batch || batch.is_deleted) throw createError('Không tìm thấy batch nguồn.', 404);
      const quantity = parsePositiveNumber(item.quantity_dispatched || item.quantity_requested, 'quantity_dispatched');
      if (Number(batch.quantity_on_hand || 0) < quantity) throw createError('Số lượng chuyển vượt tồn batch.', 409);
      const outTx = await prescriptionService.createInventoryTransaction({
        medication_id: batch.medication_id,
        stock_batch_id: batch._id,
        transaction_type: INVENTORY_TRANSACTION_TYPE.TRANSFER,
        direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
        quantity,
        balance_before: batch.quantity_on_hand,
        balance_after: batch.quantity_on_hand,
        unit_cost: batch.unit_cost,
        from_warehouse_id: transfer.from_warehouse_id || batch.warehouse_id,
        to_warehouse_id: transfer.to_warehouse_id,
        from_storage_location_id: batch.storage_location_id,
        to_storage_location_id: item.to_location_id,
        reference_type: 'inventory_transfer',
        reference_id: transfer._id,
        document_no: transfer.transfer_no,
        note: payload.reason || transfer.reason,
        metadata: { from_location: item.from_location || batch.storage_location, to_location: item.to_location },
      }, actor, session);
      const inTx = await prescriptionService.createInventoryTransaction({
        medication_id: batch.medication_id,
        stock_batch_id: batch._id,
        transaction_type: INVENTORY_TRANSACTION_TYPE.TRANSFER,
        direction: INVENTORY_TRANSACTION_DIRECTION.IN,
        quantity,
        balance_before: batch.quantity_on_hand,
        balance_after: batch.quantity_on_hand,
        unit_cost: batch.unit_cost,
        from_warehouse_id: transfer.from_warehouse_id || batch.warehouse_id,
        to_warehouse_id: transfer.to_warehouse_id,
        from_storage_location_id: batch.storage_location_id,
        to_storage_location_id: item.to_location_id,
        reference_type: 'inventory_transfer',
        reference_id: transfer._id,
        document_no: transfer.transfer_no,
        note: payload.reason || transfer.reason,
        metadata: { from_location: item.from_location || batch.storage_location, to_location: item.to_location },
      }, actor, session);
      if (item.to_location) batch.storage_location = item.to_location;
      if (item.to_location_id) batch.storage_location_id = item.to_location_id;
      if (transfer.to_warehouse_id) batch.warehouse_id = transfer.to_warehouse_id;
      batch.last_transaction_id = inTx._id;
      batch.updated_by = actorUserId(actor);
      await batch.save(sessionOptions(session));
      item.out_transaction_id = outTx._id;
      item.in_transaction_id = inTx._id;
      item.status = 'dispatched';
      item.updated_by = actorUserId(actor);
      await item.save(sessionOptions(session));
    }
    transfer.status = payload.receive_now ? 'received' : 'dispatched';
    transfer.dispatched_at = new Date();
    transfer.dispatched_by = actorUserId(actor);
    if (payload.receive_now) {
      transfer.received_at = new Date();
      transfer.received_by = actorUserId(actor);
    }
    transfer.updated_by = actorUserId(actor);
    await transfer.save(sessionOptions(session));
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'inventory_transfer.dispatch', targetType: 'inventory_transfer', targetId: transfer._id, status: 'success', message: 'Đã dispatch phiếu chuyển kho.', requestMeta });
  return getTransferDetail(transfer._id);
}

async function getDisposalDetail(disposalId) {
  const disposal = await disposalPopulate(InventoryDisposal.findById(disposalId)).lean();
  if (!disposal || disposal.is_deleted) throw createError('Không tìm thấy phiếu hủy/hao hụt.', 404);
  const items = await itemPopulate(InventoryDisposalItem.find({ disposal_id: disposalId })).lean();
  return { disposal, items };
}

async function listDisposals(query = {}) {
  assertStaffPermission(query.actor || {}, [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED]);
  return listDocuments(InventoryDisposal, query, {
    fields: ['status', 'warehouse_id', 'disposal_type'],
    searchFields: ['disposal_no', 'reason', 'note'],
    populate: disposalPopulate,
  });
}

async function createDisposal(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_DISPOSAL]);
  const items = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload];
  if (!nonEmpty(payload.reason)) throw createError('reason là bắt buộc.');
  const disposalNo = payload.disposal_no || await generateDocumentNo(CODE_TYPE.INVENTORY_DISPOSAL);
  const normalizedItems = [];
  for (const item of items) {
    const batch = await StockBatch.findById(item.stock_batch_id || item.batch_id).lean();
    if (!batch || batch.is_deleted) throw createError('Không tìm thấy batch hủy.', 404);
    const quantity = parsePositiveNumber(item.quantity, 'quantity');
    normalizedItems.push({
      medication_id: batch.medication_id,
      stock_batch_id: batch._id,
      quantity,
      unit_cost: batch.unit_cost,
      reason_code: item.reason_code || payload.disposal_type,
      note: item.note,
      created_by: actorUserId(actor),
      updated_by: actorUserId(actor),
    });
  }
  const disposal = await InventoryDisposal.create({
    disposal_no: disposalNo,
    disposal_type: payload.disposal_type || 'other',
    status: payload.status || 'draft',
    warehouse_id: payload.warehouse_id,
    requested_by: payload.requested_by || actorUserId(actor),
    reason: payload.reason,
    note: payload.note,
    witness_user_ids: payload.witness_user_ids || [],
    attachment_ids: payload.attachment_ids || [],
    total_quantity: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
    total_value: normalizedItems.reduce((sum, item) => sum + item.quantity * Number(item.unit_cost || 0), 0),
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await InventoryDisposalItem.create(normalizedItems.map((item) => ({ ...item, disposal_id: disposal._id })));
  await recordAuditLog({ actor, action: 'inventory_disposal.create', targetType: 'inventory_disposal', targetId: disposal._id, status: 'success', message: 'Tạo phiếu hủy/hao hụt thành công.', requestMeta });
  if (payload.post_now) return postDisposal(disposal._id, payload, actor, requestMeta);
  return getDisposalDetail(disposal._id);
}

async function postDisposal(disposalId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_DISPOSAL]);
  const disposal = await InventoryDisposal.findById(disposalId);
  if (!disposal || disposal.is_deleted) throw createError('Không tìm thấy phiếu hủy/hao hụt.', 404);
  if (disposal.status === 'posted') return getDisposalDetail(disposal._id);
  const items = await InventoryDisposalItem.find({ disposal_id: disposal._id });
  await withOptionalTransaction(async (session) => {
    for (const item of items) {
      if (item.line_status === 'posted') continue;
      const tx = await createOutTransactionForBatch({
        batchId: item.stock_batch_id,
        quantity: item.quantity,
        transactionType: INVENTORY_TRANSACTION_TYPE.WASTE,
        actor,
        referenceType: 'inventory_disposal',
        referenceId: disposal._id,
        documentNo: disposal.disposal_no,
        reason: payload.reason || disposal.reason,
        metadata: { disposal_type: disposal.disposal_type, reason_code: item.reason_code },
        session,
      });
      item.inventory_transaction_id = tx._id;
      item.line_status = 'posted';
      item.updated_by = actorUserId(actor);
      await item.save(sessionOptions(session));
    }
    disposal.status = 'posted';
    disposal.posted_at = new Date();
    disposal.posted_by = actorUserId(actor);
    disposal.updated_by = actorUserId(actor);
    await disposal.save(sessionOptions(session));
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'inventory_disposal.post', targetType: 'inventory_disposal', targetId: disposal._id, status: 'success', message: 'Đã post phiếu hủy/hao hụt.', requestMeta });
  return getDisposalDetail(disposal._id);
}

async function getReturnDetail(returnId) {
  const inventoryReturn = await returnPopulate(InventoryReturn.findById(returnId)).lean();
  if (!inventoryReturn || inventoryReturn.is_deleted) throw createError('Không tìm thấy phiếu hoàn trả.', 404);
  const items = await itemPopulate(InventoryReturnItem.find({ return_id: returnId })).lean();
  return { return: inventoryReturn, items };
}

async function listReturns(query = {}) {
  assertStaffPermission(query.actor || {}, [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED]);
  return listDocuments(InventoryReturn, query, {
    fields: ['status', 'warehouse_id', 'return_source'],
    searchFields: ['return_no', 'reason', 'note', 'returned_by_name', 'source_reference_type'],
    populate: returnPopulate,
  });
}

async function createReturn(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RETURN_IN]);
  const items = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload];
  if (!nonEmpty(payload.reason)) throw createError('reason là bắt buộc.');
  const returnNo = payload.return_no || await generateDocumentNo(CODE_TYPE.INVENTORY_RETURN);
  const normalizedItems = [];
  for (const item of items) {
    const batch = await StockBatch.findById(item.stock_batch_id || item.batch_id).lean();
    if (!batch || batch.is_deleted) throw createError('Không tìm thấy batch hoàn trả.', 404);
    const returned = parsePositiveNumber(item.quantity_returned || item.quantity, 'quantity_returned');
    const accepted = parseNonNegativeNumber(item.quantity_accepted, 'quantity_accepted', returned);
    if (accepted > returned) throw createError('quantity_accepted không được lớn hơn quantity_returned.', 409);
    normalizedItems.push({
      medication_id: batch.medication_id,
      stock_batch_id: batch._id,
      quantity_returned: returned,
      quantity_accepted: accepted,
      condition_status: item.condition_status || 'sealed',
      decision: item.decision || payload.decision || 'restock',
      unit_cost: batch.unit_cost,
      note: item.note,
      created_by: actorUserId(actor),
      updated_by: actorUserId(actor),
    });
  }
  const inventoryReturn = await InventoryReturn.create({
    return_no: returnNo,
    return_source: payload.return_source || 'department',
    source_reference_type: payload.source_reference_type,
    source_reference_id: payload.source_reference_id,
    warehouse_id: payload.warehouse_id,
    status: payload.status || 'draft',
    returned_by: payload.returned_by,
    returned_by_name: payload.returned_by_name,
    received_by: payload.received_by || actorUserId(actor),
    reason: payload.reason,
    note: payload.note,
    attachment_ids: payload.attachment_ids || [],
    total_quantity_returned: normalizedItems.reduce((sum, item) => sum + item.quantity_returned, 0),
    total_quantity_accepted: normalizedItems.reduce((sum, item) => sum + item.quantity_accepted, 0),
    total_value: normalizedItems.reduce((sum, item) => sum + item.quantity_accepted * Number(item.unit_cost || 0), 0),
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await InventoryReturnItem.create(normalizedItems.map((item) => ({ ...item, return_id: inventoryReturn._id })));
  await recordAuditLog({ actor, action: 'inventory_return.create', targetType: 'inventory_return', targetId: inventoryReturn._id, status: 'success', message: 'Tạo phiếu hoàn trả kho thành công.', requestMeta });
  if (payload.post_now) return postReturn(inventoryReturn._id, payload, actor, requestMeta);
  return getReturnDetail(inventoryReturn._id);
}

async function postReturn(returnId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RETURN_IN]);
  const inventoryReturn = await InventoryReturn.findById(returnId);
  if (!inventoryReturn || inventoryReturn.is_deleted) throw createError('Không tìm thấy phiếu hoàn trả.', 404);
  if (inventoryReturn.status === 'posted') return getReturnDetail(inventoryReturn._id);
  const items = await InventoryReturnItem.find({ return_id: inventoryReturn._id });
  await withOptionalTransaction(async (session) => {
    for (const item of items) {
      if (item.inventory_transaction_id || item.decision !== 'restock') continue;
      const quantity = parsePositiveNumber(item.quantity_accepted || item.quantity_returned, 'quantity_accepted');
      const tx = await createInTransactionForBatch({
        batchId: item.stock_batch_id,
        quantity,
        transactionType: INVENTORY_TRANSACTION_TYPE.RETURN,
        actor,
        referenceType: 'inventory_return',
        referenceId: inventoryReturn._id,
        documentNo: inventoryReturn.return_no,
        reason: payload.reason || inventoryReturn.reason,
        metadata: { return_source: inventoryReturn.return_source, condition_status: item.condition_status, decision: item.decision },
        session,
      });
      item.inventory_transaction_id = tx._id;
      await item.save(sessionOptions(session));
    }
    inventoryReturn.status = 'posted';
    inventoryReturn.posted_at = new Date();
    inventoryReturn.posted_by = actorUserId(actor);
    inventoryReturn.updated_by = actorUserId(actor);
    await inventoryReturn.save(sessionOptions(session));
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'inventory_return.post', targetType: 'inventory_return', targetId: inventoryReturn._id, status: 'success', message: 'Đã post hoàn trả kho.', requestMeta });
  return getReturnDetail(inventoryReturn._id);
}

async function getTransactionDetail(transactionId) {
  const transaction = await InventoryTransaction.findById(transactionId)
    .populate('medication_id', 'medication_code generic_name brand_name strength unit')
    .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location status')
    .populate('performed_by', 'full_name username')
    .lean();
  if (!transaction) throw createError('Không tìm thấy giao dịch kho.', 404);
  return { transaction };
}

async function getInventoryCenter(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED, PERMISSION.STOCK_BATCHES.READ]);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
  const [report, recentTransactions, todayTransactions, batches, receiptQueue, issueQueue, transferQueue, disposalQueue, returnQueue] = await Promise.all([
    reportService.getInventoryReport({ date_from: todayStart.toISOString(), date_to: todayEnd.toISOString(), near_expiry_days: query.near_expiry_days || 60 }, actor),
    InventoryTransaction.find({ occurred_at: { $gte: todayStart, $lte: todayEnd } })
      .sort({ occurred_at: -1, created_at: -1 })
      .limit(Number(query.limit || 20))
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location status')
      .populate('performed_by', 'full_name username')
      .lean(),
    InventoryTransaction.find({ occurred_at: { $gte: todayStart, $lte: todayEnd } }).lean(),
    StockBatch.find({ is_deleted: false })
      .sort({ expiry_date: 1, quantity_on_hand: -1 })
      .limit(120)
      .populate('medication_id', 'medication_code generic_name brand_name strength unit min_stock_level status')
      .lean(),
    InventoryReceipt.find({ is_deleted: false, status: { $in: ['draft', 'pending_review'] } }).sort({ created_at: -1 }).limit(8).lean(),
    InternalIssue.find({ is_deleted: false, status: { $in: ['draft', 'pending_approval', 'approved', 'picking'] } }).sort({ created_at: -1 }).limit(8).lean(),
    InventoryTransfer.find({ is_deleted: false, status: { $in: ['draft', 'pending_approval', 'approved', 'dispatched', 'in_transit'] } }).sort({ created_at: -1 }).limit(8).lean(),
    InventoryDisposal.find({ is_deleted: false, status: { $in: ['draft', 'pending_approval', 'approved'] } }).sort({ created_at: -1 }).limit(8).lean(),
    InventoryReturn.find({ is_deleted: false, status: { $in: ['draft', 'pending_inspection', 'accepted', 'quarantined'] } }).sort({ created_at: -1 }).limit(8).lean(),
  ]);

  const transactionsByType = {};
  const transactionsByDirection = {};
  for (const transaction of todayTransactions) {
    transactionsByType[transaction.transaction_type] = (transactionsByType[transaction.transaction_type] || 0) + 1;
    transactionsByDirection[transaction.direction] = (transactionsByDirection[transaction.direction] || 0) + 1;
  }
  const nearDays = Number(query.near_expiry_days || 60);
  const nearExpiryTo = new Date(now.getTime() + nearDays * 86400000);
  const alerts = [];
  for (const batch of batches) {
    const quantity = Number(batch.quantity_on_hand || 0);
    const minStock = Number(batch.min_stock_level || batch.medication_id?.min_stock_level || 0);
    if (quantity > 0 && batch.expiry_date && new Date(batch.expiry_date) < now) alerts.push({ type: 'expired_on_hand', severity: 'danger', title: 'Batch hết hạn còn tồn', batch });
    if (quantity > 0 && batch.expiry_date && new Date(batch.expiry_date) >= now && new Date(batch.expiry_date) <= nearExpiryTo) alerts.push({ type: 'near_expiry', severity: 'warning', title: 'Batch sắp hết hạn', batch });
    if (quantity > 0 && minStock > 0 && quantity <= minStock) alerts.push({ type: 'low_stock', severity: 'warning', title: 'Batch dưới tồn tối thiểu', batch });
    if (batch.status === STOCK_BATCH_STATUS.RECALLED) alerts.push({ type: 'recall', severity: 'danger', title: 'Batch recalled', batch });
    if (batch.status === STOCK_BATCH_STATUS.QUARANTINED) alerts.push({ type: 'quarantine', severity: 'warning', title: 'Batch cách ly', batch });
    if (alerts.length >= 20) break;
  }

  return {
    report,
    today: {
      transaction_count: todayTransactions.length,
      receipt_count: transactionsByType.receipt || 0,
      issue_count: transactionsByType.issue || 0,
      transfer_count: transactionsByType.transfer || 0,
      adjustment_count: transactionsByType.adjustment || 0,
      waste_count: transactionsByType.waste || 0,
      return_count: transactionsByType.return || 0,
      in_count: transactionsByDirection.in || 0,
      out_count: transactionsByDirection.out || 0,
      affected_batch_count: new Set(todayTransactions.map((item) => String(item.stock_batch_id || '')).filter(Boolean)).size,
    },
    work_queue: {
      receipts: receiptQueue,
      issues: issueQueue,
      transfers: transferQueue,
      disposals: disposalQueue,
      returns: returnQueue,
    },
    recent_transactions: recentTransactions,
    alerts,
    filters: {
      date_from: todayStart.toISOString(),
      date_to: todayEnd.toISOString(),
      near_expiry_days: nearDays,
    },
  };
}

module.exports = {
  listWarehouses,
  listStorageLocations,
  getInventoryCenter,
  listReceipts,
  getReceiptDetail,
  createReceipt,
  postReceipt,
  listIssues,
  getIssueDetail,
  createIssue,
  dispatchIssue,
  listTransfers,
  getTransferDetail,
  createTransfer,
  dispatchTransfer,
  listDisposals,
  getDisposalDetail,
  createDisposal,
  postDisposal,
  listReturns,
  getReturnDetail,
  createReturn,
  postReturn,
  getTransactionDetail,
};

