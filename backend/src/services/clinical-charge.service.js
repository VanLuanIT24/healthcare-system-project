const { Charge, ImagingOrder, LabOrder, Order, ProcedureOrder } = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  ORDER_TYPE,
  SERVICE_TYPE,
} = require('../constants/statuses');
const {
  createError,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const billingService = require('./billing.service');
const clinicalBillingService = require('./clinical-billing.service');

const CLINICAL_SERVICE_TYPES = [
  SERVICE_TYPE.LAB,
  SERVICE_TYPE.IMAGING,
  SERVICE_TYPE.PROCEDURE,
];

const CHARGE_REVIEW_STATUSES = ['none', 'needs_review', 'resolved', 'rejected'];

function hasPermission(actor = {}, permission) {
  const permissions = new Set(actor.permissions || []);
  return permissions.has(permission) || permissions.has('*');
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissions.some((permission) => hasPermission(actor, permission));
}

function assertStaff(actor = {}) {
  if (actor.actorType !== 'staff') throw createError('Chỉ tài khoản nhân sự được dùng clinical charge workspace.', 403);
}

function assertReviewAccess(actor = {}) {
  assertStaff(actor);
  if (!hasAnyPermission(actor, [
    PERMISSION.CHARGES.UPDATE,
    PERMISSION.CHARGES.ADJUST,
    PERMISSION.CHARGES.MANAGE,
    PERMISSION.SYSTEM.FULL_ACCESS,
  ])) {
    throw createError('Bạn không có quyền cập nhật review charge.', 403);
  }
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.id;
}

function totalFrom(items = []) {
  return items.reduce((sum, item) => sum + Number(item.total_amount || item.amount || item.revenue || 0), 0);
}

function resultCount(result) {
  return result?.pagination?.total ?? result?.items?.length ?? 0;
}

function queueItemFromCandidate(row) {
  return {
    id: `missing:${row.order_id || row.order?._id}`,
    type: 'missing_charge',
    severity: 'danger',
    module: row.source_type || row.service?.service_type || row.order?.order_type,
    patient: row.patient,
    encounter: row.encounter,
    order: row.order || {
      order_id: row.order_id,
      order_no: row.order_no,
      status: row.order_status,
    },
    service: row.service,
    charge: null,
    amount: row.suggested_price || row.service?.unit_price || 0,
    detected_at: row.eligible_at,
    suggested_action: 'create_charge',
    reason: row.charge_block_reason || 'Order đủ điều kiện tính phí nhưng chưa có charge active.',
  };
}

function queueItemFromCharge(row, type, severity, suggestedAction) {
  return {
    id: `${type}:${row._id}`,
    type,
    severity,
    module: row.service_type || row.service?.service_type,
    patient: row.patient,
    encounter: row.encounter,
    order: row.order,
    service: row.service,
    charge: row,
    amount: row.total_amount,
    detected_at: row.posted_at || row.charged_at || row.created_at,
    suggested_action: suggestedAction,
    reason: row.review_reason || row.billing_feedback || row.description,
  };
}

function queueItemFromException(row) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    module: row.raw?.service_id?.service_type || row.raw?.order_type || row.raw?.service_type,
    patient: row.patient,
    encounter: row.encounter,
    order: row.entity_type === 'order' ? row.raw : row.raw?.order_id,
    charge: row.entity_type === 'charge' ? row.raw : null,
    invoice: row.entity_type === 'invoice' ? row.raw : null,
    amount: row.amount,
    detected_at: row.detected_at,
    suggested_action: row.suggested_action,
    reason: row.type,
  };
}

async function getDashboard(query = {}, actor = {}) {
  const [billingDashboard, missing, pending, draft, posted, unbilled, billed, voided, review] = await Promise.all([
    clinicalBillingService.getDashboard(query, actor),
    clinicalBillingService.listChargeCandidates({ ...query, only_missing_charge: 'true', limit: 1 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, status: CHARGE_STATUS.PENDING, limit: 1 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, status: CHARGE_STATUS.DRAFT, limit: 1 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, status: CHARGE_STATUS.POSTED, limit: 1 }, actor),
    clinicalBillingService.listUnbilledCharges({ ...query, limit: 1 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, status: CHARGE_STATUS.BILLED, limit: 1 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, status: CHARGE_STATUS.VOIDED, limit: 1 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, review_status: 'needs_review', limit: 1 }, actor),
  ]);

  const byModule = Object.fromEntries((billingDashboard.by_service_type || []).map((row) => [row.service_type, {
    completed_orders: row.orders || 0,
    charges_created: row.charges || 0,
    missing_charge_count: 0,
    posted_amount: row.revenue || 0,
    unbilled_amount: 0,
    unbilled_count: row.unbilled_charges || 0,
  }]));

  return {
    date: query.date_from || new Date().toISOString().slice(0, 10),
    summary: {
      orders_completed: billingDashboard.kpis?.total_orders || 0,
      charges_created: billingDashboard.kpis?.orders_with_charge || 0,
      missing_charge_count: resultCount(missing),
      pending_charge_count: resultCount(pending),
      draft_charge_count: resultCount(draft),
      posted_charge_count: resultCount(posted),
      billed_charge_count: resultCount(billed),
      unbilled_charge_count: resultCount(unbilled),
      voided_charge_count: resultCount(voided),
      exception_count: billingDashboard.kpis?.billing_exceptions || 0,
      review_count: resultCount(review),
      total_charge_amount: totalFrom(billingDashboard.by_service_type || []),
    },
    by_module: byModule,
    source_dashboard: billingDashboard,
  };
}

async function getActionQueue(query = {}, actor = {}) {
  const limit = query.limit || 25;
  const [missing, pending, draft, review, exceptions] = await Promise.all([
    clinicalBillingService.listChargeCandidates({ ...query, only_missing_charge: 'true', limit: 10 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, status: CHARGE_STATUS.PENDING, limit: 10 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, status: CHARGE_STATUS.DRAFT, limit: 10 }, actor),
    clinicalBillingService.listClinicalCharges({ ...query, review_status: 'needs_review', limit: 10 }, actor),
    clinicalBillingService.listExceptions({ ...query, limit: 20 }, actor),
  ]);

  let items = [
    ...(missing.items || []).map(queueItemFromCandidate),
    ...(pending.items || []).map((row) => queueItemFromCharge(row, 'charge_waiting_post', 'warning', 'post_charge')),
    ...(draft.items || []).map((row) => queueItemFromCharge(row, 'draft_charge_waiting_post', 'info', 'post_charge')),
    ...(review.items || []).map((row) => queueItemFromCharge(row, 'manual_review_required', 'warning', 'send_billing_review')),
    ...(exceptions.items || []).map(queueItemFromException),
  ];

  const type = normalizeString(query.type);
  const severity = normalizeString(query.severity);
  if (type) items = items.filter((item) => item.type === type);
  if (severity) items = items.filter((item) => item.severity === severity);
  items = items.slice(0, Number(limit || 25));

  return {
    items,
    counters: {
      missing_charge: resultCount(missing),
      pending_charge: resultCount(pending),
      draft_charge: resultCount(draft),
      review: resultCount(review),
      exceptions: resultCount(exceptions),
    },
  };
}

function listMissing(query = {}, actor = {}) {
  return clinicalBillingService.listChargeCandidates({ ...query, only_missing_charge: 'true' }, actor);
}

function listByOrder(query = {}, actor = {}) {
  return clinicalBillingService.getReconciliation(query, actor);
}

function listCharges(query = {}, actor = {}) {
  return clinicalBillingService.listClinicalCharges(query, actor);
}

function listLabCharges(query = {}, actor = {}) {
  return listCharges({ ...query, service_type: SERVICE_TYPE.LAB }, actor);
}

function listImagingCharges(query = {}, actor = {}) {
  return listCharges({ ...query, service_type: SERVICE_TYPE.IMAGING }, actor);
}

function listProcedureCharges(query = {}, actor = {}) {
  return listCharges({ ...query, service_type: SERVICE_TYPE.PROCEDURE }, actor);
}

function listPosted(query = {}, actor = {}) {
  return listCharges({ ...query, status: CHARGE_STATUS.POSTED }, actor);
}

function listUnbilled(query = {}, actor = {}) {
  return clinicalBillingService.listUnbilledCharges(query, actor);
}

function listBilled(query = {}, actor = {}) {
  return listCharges({ ...query, status: CHARGE_STATUS.BILLED }, actor);
}

function listExceptions(query = {}, actor = {}) {
  return clinicalBillingService.listExceptions(query, actor);
}

function getReconciliation(query = {}, actor = {}) {
  return clinicalBillingService.getReconciliation(query, actor);
}

async function bulkCreateFromOrders(payload = {}, actor = {}, requestMeta = {}) {
  const orderIds = Array.isArray(payload.order_ids) ? payload.order_ids.filter(Boolean) : [];
  if (!orderIds.length) throw createError('order_ids không được rỗng.', 400);
  const results = [];
  for (const orderId of orderIds) {
    try {
      const result = await clinicalBillingService.createChargeForClinicalOrder(orderId, payload.charge || payload, actor, requestMeta);
      results.push({ order_id: orderId, status: 'success', result });
    } catch (error) {
      results.push({ order_id: orderId, status: 'failed', message: error.message });
    }
  }
  return {
    success_count: results.filter((item) => item.status === 'success').length,
    failed_count: results.filter((item) => item.status === 'failed').length,
    results,
  };
}

async function bulkPost(payload = {}, actor = {}, requestMeta = {}) {
  const chargeIds = Array.isArray(payload.charge_ids) ? payload.charge_ids.filter(Boolean) : [];
  if (!chargeIds.length) throw createError('charge_ids không được rỗng.', 400);
  const results = [];
  for (const chargeId of chargeIds) {
    try {
      const result = await billingService.postCharge(chargeId, actor, requestMeta);
      results.push({ charge_id: chargeId, status: 'success', result });
    } catch (error) {
      results.push({ charge_id: chargeId, status: 'failed', message: error.message });
    }
  }
  return {
    success_count: results.filter((item) => item.status === 'success').length,
    failed_count: results.filter((item) => item.status === 'failed').length,
    results,
  };
}

async function bulkVoid(payload = {}, actor = {}, requestMeta = {}) {
  const chargeIds = Array.isArray(payload.charge_ids) ? payload.charge_ids.filter(Boolean) : [];
  const reason = normalizeString(payload.reason || payload.void_reason);
  if (!chargeIds.length) throw createError('charge_ids không được rỗng.', 400);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const results = [];
  for (const chargeId of chargeIds) {
    try {
      const result = await billingService.voidCharge(chargeId, { reason }, actor, requestMeta);
      results.push({ charge_id: chargeId, status: 'success', result });
    } catch (error) {
      results.push({ charge_id: chargeId, status: 'failed', message: error.message });
    }
  }
  return {
    success_count: results.filter((item) => item.status === 'success').length,
    failed_count: results.filter((item) => item.status === 'failed').length,
    results,
  };
}

async function ensureClinicalCharge(chargeId) {
  const charge = await Charge.findById(chargeId)
    .populate('service_id', 'service_code service_name service_type unit_price is_billable status department_id')
    .lean();
  if (!charge) throw createError('Không tìm thấy charge.', 404);
  if (!CLINICAL_SERVICE_TYPES.includes(charge.service_id?.service_type)) {
    throw createError('Charge không thuộc cận lâm sàng/thủ thuật.', 409);
  }
  return charge;
}

async function updateChargeReview(chargeId, payload = {}, actor = {}, requestMeta = {}, status) {
  assertReviewAccess(actor);
  const charge = await ensureClinicalCharge(chargeId);
  const reviewStatus = status || payload.review_status || 'needs_review';
  if (!CHARGE_REVIEW_STATUSES.includes(reviewStatus)) throw createError('review_status không hợp lệ.', 400);
  const update = {
    review_status: reviewStatus,
    review_reason: normalizeString(payload.review_reason || payload.reason) || charge.review_reason,
    review_notes: normalizeString(payload.review_notes || payload.notes) || charge.review_notes,
    billing_feedback: normalizeString(payload.billing_feedback) || charge.billing_feedback,
    exception_codes: Array.isArray(payload.exception_codes) ? payload.exception_codes.filter(Boolean) : charge.exception_codes,
    reviewed_by: actorUserId(actor),
    reviewed_at: new Date(),
    updated_by: actorUserId(actor),
  };
  if (reviewStatus === 'resolved' || reviewStatus === 'rejected') {
    update.resolved_by = actorUserId(actor);
    update.resolved_at = new Date();
  }
  await Charge.updateOne({ _id: chargeId }, { $set: update });
  await recordAuditLog({
    actor,
    action: `clinical_charge.${reviewStatus}`,
    targetType: 'charge',
    targetId: chargeId,
    status: 'success',
    message: 'Cập nhật review charge cận lâm sàng thành công.',
    requestMeta,
    metadata: { review_status: reviewStatus },
  });
  return billingService.getChargeDetail(chargeId, actor);
}

function markReview(chargeId, payload = {}, actor = {}, requestMeta = {}) {
  return updateChargeReview(chargeId, payload, actor, requestMeta, 'needs_review');
}

function resolveReview(chargeId, payload = {}, actor = {}, requestMeta = {}) {
  return updateChargeReview(chargeId, payload, actor, requestMeta, 'resolved');
}

function sendToBillingReview(chargeId, payload = {}, actor = {}, requestMeta = {}) {
  return updateChargeReview(chargeId, {
    ...payload,
    review_reason: payload.review_reason || payload.reason || 'billing_review',
    billing_feedback: payload.billing_feedback || payload.notes || 'Gửi Billing review từ clinical charge workspace.',
  }, actor, requestMeta, 'needs_review');
}

async function createReplacement(chargeId, payload = {}, actor = {}, requestMeta = {}) {
  assertReviewAccess(actor);
  const original = await ensureClinicalCharge(chargeId);
  const serviceId = original.service_id?._id || original.service_id;
  const replacement = await billingService.createCharge({
    patient_id: original.patient_id,
    encounter_id: original.encounter_id,
    admission_id: original.admission_id,
    service_id: payload.service_id || serviceId,
    order_id: original.order_id,
    source_module: 'clinical_charge_replacement',
    source_id: original._id,
    description: payload.description || `${original.description || original.service_id?.service_name || 'Clinical charge'} - replacement`,
    quantity: payload.quantity || original.quantity || 1,
    unit_price: payload.unit_price ?? original.unit_price,
    discount_amount: payload.discount_amount ?? original.discount_amount ?? 0,
    tax_amount: payload.tax_amount ?? original.tax_amount ?? 0,
    status: payload.status || CHARGE_STATUS.DRAFT,
    review_status: payload.review_status || 'needs_review',
    review_reason: payload.review_reason || payload.reason || 'replacement_charge',
    allow_duplicate: true,
  }, actor, requestMeta);
  await recordAuditLog({
    actor,
    action: 'clinical_charge.replacement_created',
    targetType: 'charge',
    targetId: original._id,
    status: 'success',
    message: 'Tạo replacement charge cận lâm sàng thành công.',
    requestMeta,
    metadata: { replacement_charge_id: replacement?._id },
  });
  return replacement;
}

async function listLabOrderCharges(labOrderId, actor = {}) {
  const labOrder = await LabOrder.findById(labOrderId).lean();
  if (!labOrder) throw createError('Không tìm thấy lab order.', 404);
  const trace = await clinicalBillingService.loadOrderTrace(labOrder.order_id, actor);
  return { items: trace.charges || [], trace };
}

async function listImagingOrderCharges(imagingOrderId, actor = {}) {
  const imagingOrder = await ImagingOrder.findById(imagingOrderId).lean();
  if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);
  const trace = await clinicalBillingService.loadOrderTrace(imagingOrder.order_id, actor);
  return { items: trace.charges || [], trace };
}

async function getOrderChargeContext(orderId, actor = {}) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw createError('Không tìm thấy order.', 404);
  if (![ORDER_TYPE.LAB, ORDER_TYPE.IMAGING, ORDER_TYPE.PROCEDURE].includes(order.order_type)) {
    throw createError('Order không thuộc workspace Charge cận lâm sàng.', 409);
  }
  return clinicalBillingService.loadOrderTrace(orderId, actor);
}

async function listProcedureOrderCharges(procedureOrderId, actor = {}) {
  const procedureOrder = await ProcedureOrder.findById(procedureOrderId).lean();
  if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);
  const trace = await clinicalBillingService.loadOrderTrace(procedureOrder.order_id, actor);
  return { items: trace.charges || [], trace };
}

module.exports = {
  getDashboard,
  getActionQueue,
  listMissing,
  listByOrder,
  listCharges,
  listLabCharges,
  listImagingCharges,
  listProcedureCharges,
  listPosted,
  listUnbilled,
  listBilled,
  listExceptions,
  getReconciliation,
  bulkCreateFromOrders,
  bulkPost,
  bulkVoid,
  markReview,
  resolveReview,
  sendToBillingReview,
  createReplacement,
  listLabOrderCharges,
  listImagingOrderCharges,
  listProcedureOrderCharges,
  getOrderChargeContext,
};
