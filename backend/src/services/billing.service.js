const { Types } = require('mongoose');
const {
  Admission,
  Attachment,
  AuditLog,
  Charge,
  Department,
  DoctorProfile,
  Encounter,
  InsuranceClaim,
  InsurancePolicy,
  Invoice,
  InvoiceItem,
  Order,
  Patient,
  Payment,
  PaymentRefund,
  PaymentIntent,
  ServiceCatalog,
  ServicePriceVersion,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  ENCOUNTER_STATUS,
  INVOICE_STATUS,
  INSURANCE_CLAIM_STATUS,
  INSURANCE_POLICY_STATUS,
  INSURANCE_VERIFICATION_STATUS,
  PATIENT_STATUS,
  PAYMENT_INTENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_METHODS,
  PAYMENT_REFUND_METHOD,
  PAYMENT_REFUND_REQUEST_SOURCE,
  PAYMENT_REFUND_STATUS,
  PAYMENT_REFUND_TYPE,
  PAYMENT_STATUS,
  REALTIME_EVENT_TYPE,
  SERVICE_PRICE_CHANGE_TYPE,
  SERVICE_PRICE_VERSION_STATUS,
  SERVICE_STATUS,
  SERVICE_TYPE,
  SERVICE_TYPES,
  SERVICE_STATUSES,
} = require('../constants/statuses');
const {
  CHARGE_TRANSITIONS,
  INSURANCE_CLAIM_TRANSITIONS,
  INVOICE_TRANSITIONS,
  PAYMENT_TRANSITIONS,
} = require('../constants/transitions');
const {
  assertValidStatusTransition,
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const eventBus = require('../events/event-bus.service');
const { withOptionalTransaction } = require('../shared/utils/transaction');
const {
  calculateBalanceDue,
  calculateLineTotal,
  toMoney,
} = require('../common/helpers/money.helper');
const actorContext = require('../common/actors');

const ACTIVE_CHARGE_STATUSES = [
  CHARGE_STATUS.PENDING,
  CHARGE_STATUS.DRAFT,
  CHARGE_STATUS.POSTED,
  CHARGE_STATUS.BILLED,
];

const INVOICE_PAYABLE_STATUSES = [
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
];

const INVOICE_CLAIMABLE_STATUSES = [
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
  INVOICE_STATUS.PAID,
];

const ACTIVE_CLAIM_STATUSES = [
  INSURANCE_CLAIM_STATUS.DRAFT,
  INSURANCE_CLAIM_STATUS.SUBMITTED,
  INSURANCE_CLAIM_STATUS.UNDER_REVIEW,
  INSURANCE_CLAIM_STATUS.APPROVED,
  INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED,
  INSURANCE_CLAIM_STATUS.SETTLED,
];

const CLINICAL_SERVICE_TYPES = [
  SERVICE_TYPE.LAB,
  SERVICE_TYPE.IMAGING,
  SERVICE_TYPE.PROCEDURE,
];

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function sameId(left, right) {
  if (!left || !right) return false;
  return String(left) === String(right);
}

function toObjectId(value) {
  if (!value || !Types.ObjectId.isValid(value)) return value;
  return new Types.ObjectId(value);
}

function actorId(actor = {}) {
  return actor.userId || actor.patientAccountId || actor.actorId || actor.id || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function actorPermissions(actor = {}) {
  return new Set(actor.permissions || []);
}

function hasPermission(actor = {}, permission) {
  const permissions = actorPermissions(actor);
  return permissions.has(permission) || permissions.has('*');
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissions.some((permission) => hasPermission(actor, permission));
}

function assertStaffPermission(actor = {}, permissions = [], message = 'Tài khoản hiện tại không có quyền thực hiện thao tác này.') {
  if (actorContext.isSystem(actor)) return true;
  if (actor.actorType !== 'staff') throw createError(message, 403);
  if (!hasAnyPermission(actor, permissions)) throw createError(message, 403);
  return true;
}

function assertPatientSelf(actor = {}, patientId, permission) {
  if (actor.actorType !== 'patient') return false;
  if (!hasPermission(actor, permission)) throw createError('Tài khoản bệnh nhân không có quyền xem dữ liệu này.', 403);
  if (!sameId(actor.patientId || actor.patient_id, patientId)) throw createError('Bạn chỉ được xem dữ liệu của chính mình.', 403);
  return true;
}

function normalizePositiveNumber(value, fieldName, { allowZero = false, defaultValue } = {}) {
  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw createError(`${fieldName} là bắt buộc.`, 400);
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw createError(`${fieldName} không hợp lệ.`, 400);
  if (allowZero ? numberValue < 0 : numberValue <= 0) {
    throw createError(`${fieldName} phải ${allowZero ? '>= 0' : '> 0'}.`, 400);
  }
  return numberValue;
}

function normalizePositiveInteger(value, fieldName, options = {}) {
  const numberValue = normalizePositiveNumber(value, fieldName, options);
  if (!Number.isInteger(numberValue)) throw createError(`${fieldName} phải là số nguyên.`, 400);
  return numberValue;
}

function normalizeMoneyAmount(value, fieldName, { allowZero = false, defaultValue } = {}) {
  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) return normalizeMoneyAmount(defaultValue, fieldName, { allowZero: true });
    throw createError(`${fieldName} là bắt buộc.`, 400);
  }
  try {
    return toMoney(value, { fieldName, allowZero });
  } catch (error) {
    throw createError(`${fieldName} phải dùng integer minor units.`, 400);
  }
}

function normalizeDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function roundMoney(value) {
  try {
    return toMoney(value, { fieldName: 'amount', allowZero: true });
  } catch (error) {
    throw createError('amount phải dùng integer minor units.', 400);
  }
}

function assertTransition(transitions, currentStatus, nextStatus, label) {
  if (currentStatus === nextStatus) return true;
  return assertValidStatusTransition(transitions, currentStatus, nextStatus, label);
}

function assertDateRange(start, end, label = 'Khoảng thời gian') {
  if (start && end && start > end) {
    throw createError(`${label} không hợp lệ.`, 400);
  }
}

async function assertPatientActive(patientId, session = null) {
  const patient = await withSession(Patient.findById(patientId), session);
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy patient.', 404);
  if (patient.status !== PATIENT_STATUS.ACTIVE) {
    throw createError('Patient không ở trạng thái active, không thể xử lý viện phí.', 409);
  }
  return patient;
}

async function assertEncounterMatchesPatient(encounterId, patientId, session = null) {
  if (!encounterId) return null;
  const encounter = await withSession(Encounter.findById(encounterId), session);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (!sameId(encounter.patient_id, patientId)) {
    throw createError('Encounter không thuộc patient này.', 409);
  }
  return encounter;
}

async function assertAdmissionMatchesPatient(admissionId, patientId, session = null) {
  if (!admissionId) return null;
  const admission = await withSession(Admission.findById(admissionId), session);
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  if (!sameId(admission.patient_id, patientId)) {
    throw createError('Admission không thuộc patient này.', 409);
  }
  return admission;
}

async function assertDepartmentActive(departmentId, session = null) {
  if (!departmentId) return null;
  const department = await withSession(Department.findById(departmentId), session);
  if (!department || department.is_deleted) throw createError('Không tìm thấy department.', 404);
  if (department.status && department.status !== 'active') {
    throw createError('Department không active.', 409);
  }
  return department;
}

function buildEffectiveDateFilter(date) {
  return {
    $and: [
      { $or: [{ effective_from: { $exists: false } }, { effective_from: null }, { effective_from: { $lte: date } }] },
      { $or: [{ effective_to: { $exists: false } }, { effective_to: null }, { effective_to: { $gte: date } }] },
    ],
  };
}

function normalizeServiceTypeQuery(query = {}) {
  const raw = query.service_types || query.service_type;
  const values = Array.isArray(raw)
    ? raw
    : String(raw || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  if (query.workspace === 'clinical' || query.source_group === 'clinical') {
    return values.length ? values.filter((item) => CLINICAL_SERVICE_TYPES.includes(item)) : CLINICAL_SERVICE_TYPES;
  }
  return values;
}

async function assertServiceBillable(serviceId, chargedAt = new Date(), session = null) {
  if (!serviceId) return null;
  const service = await withSession(ServiceCatalog.findById(serviceId), session);
  if (!service || service.is_deleted) throw createError('Không tìm thấy service catalog.', 404);
  if (service.status !== SERVICE_STATUS.ACTIVE) throw createError('Service catalog không active.', 409);
  if (!service.is_billable) throw createError('Service catalog không billable.', 409);
  if (service.effective_from && service.effective_from > chargedAt) {
    throw createError('Service chưa hiệu lực tại thời điểm tính phí.', 409);
  }
  if (service.effective_to && service.effective_to < chargedAt) {
    throw createError('Service đã hết hiệu lực tại thời điểm tính phí.', 409);
  }
  return service;
}

function hasGlobalBillingScope(actor = {}) {
  return actorContext.isSystem(actor)
    || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
    || !actorDepartmentId(actor);
}

async function encounterIdsForActorDepartment(actor = {}, session = null) {
  const departmentId = actorDepartmentId(actor);
  if (!departmentId || hasGlobalBillingScope(actor)) return null;
  const encounters = await withSession(Encounter.find({ department_id: departmentId }).select('_id').lean(), session);
  return encounters.map((encounter) => encounter._id);
}

async function applyEncounterDepartmentScope(filter, actor = {}, session = null) {
  if (actor.actorType !== 'staff' || hasGlobalBillingScope(actor)) return filter;
  const encounterIds = await encounterIdsForActorDepartment(actor, session);
  if (filter.encounter_id) {
    filter.encounter_id = encounterIds.some((id) => sameId(id, filter.encounter_id))
      ? filter.encounter_id
      : { $in: [] };
  } else {
    filter.encounter_id = { $in: encounterIds };
  }
  return filter;
}

async function assertInvoiceDepartmentScope(invoice, actor = {}, session = null) {
  if (actor.actorType !== 'staff' || hasGlobalBillingScope(actor)) return true;
  if (!invoice.encounter_id) throw createError('Invoice không có encounter để kiểm tra scope khoa.', 403);
  const encounter = await withSession(Encounter.findById(invoice.encounter_id).lean(), session);
  if (!encounter || !sameId(encounter.department_id, actorDepartmentId(actor))) {
    throw createError('Bạn không có quyền thao tác invoice ngoài khoa.', 403);
  }
  return true;
}

async function applyInvoiceDepartmentScope(filter, actor = {}, session = null) {
  if (actor.actorType !== 'staff' || hasGlobalBillingScope(actor)) return filter;
  const encounterIds = await encounterIdsForActorDepartment(actor, session);
  const invoices = await withSession(Invoice.find({ encounter_id: { $in: encounterIds } }).select('_id').lean(), session);
  const invoiceIds = invoices.map((invoice) => invoice._id);
  if (filter.invoice_id) {
    filter.invoice_id = invoiceIds.some((id) => sameId(id, filter.invoice_id))
      ? filter.invoice_id
      : { $in: [] };
  } else {
    filter.invoice_id = { $in: invoiceIds };
  }
  return filter;
}

async function generateChargeNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.CHARGE, options);
}

async function generateInvoiceNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.INVOICE, options);
}

async function generatePaymentNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.PAYMENT, options);
}

async function generateRefundNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.PAYMENT_REFUND, options);
}

function actorSnapshot(actor = {}) {
  return {
    actor_type: actorContext.getActorType(actor) || actor.actorType || 'system',
    actor_id: actorContext.getActorId(actor) || actor.userId || actor.user_id || actor.patientId || actor.patient_id || actor.id || null,
  };
}

function legacyPaymentRefundStatus(status) {
  if ([PAYMENT_REFUND_STATUS.REQUESTED, PAYMENT_REFUND_STATUS.UNDER_REVIEW, PAYMENT_REFUND_STATUS.PROCESSING, PAYMENT_REFUND_STATUS.FAILED].includes(status)) {
    return 'requested';
  }
  if (status === PAYMENT_REFUND_STATUS.APPROVED) return 'approved';
  if ([PAYMENT_REFUND_STATUS.REJECTED, PAYMENT_REFUND_STATUS.CANCELLED].includes(status)) return 'rejected';
  if (status === PAYMENT_REFUND_STATUS.PROCESSED) return 'processed';
  return 'none';
}

function appendRefundAuditLog(refund, action, actor = {}, { reason, metadata } = {}) {
  refund.audit_logs = [
    ...(refund.audit_logs || []),
    {
      action,
      ...actorSnapshot(actor),
      at: new Date(),
      reason,
      metadata,
    },
  ];
}

function appendPaymentAuditLog(payment, action, actor = {}, { reason, metadata } = {}) {
  payment.audit_logs = [
    ...(payment.audit_logs || []),
    {
      action,
      ...actorSnapshot(actor),
      at: new Date(),
      reason,
      metadata,
    },
  ];
}

async function publishBillingEvent({ eventType, aggregateType, aggregateId, actor, patientId, payload = {}, requestMeta = {} }) {
  try {
    await eventBus.publishDomainEvent({
      eventType,
      aggregateType,
      aggregateId,
      actor: actorSnapshot(actor),
      recipientScope: {
        patient_id: patientId,
        recipients: patientId ? [{ recipient_type: 'patient', recipient_id: patientId, patient_id: patientId }] : [],
      },
      payload,
      requestId: requestMeta?.requestId || requestMeta?.request_id,
      correlationId: requestMeta?.correlationId || requestMeta?.correlation_id,
    });
  } catch (_) {
    // Realtime delivery is best-effort; audit logs remain the source of truth.
  }
}

function normalizeRefundSource(value, actor = {}) {
  const source = normalizeString(value);
  if (source) return source;
  if (actorContext.getActorType(actor) === 'patient') return PAYMENT_REFUND_REQUEST_SOURCE.PATIENT_PORTAL;
  return PAYMENT_REFUND_REQUEST_SOURCE.CASHIER;
}

function normalizeRefundType(value, amount, paymentAmount) {
  const type = normalizeString(value);
  if (type) return type;
  return Number(amount) >= Number(paymentAmount) ? PAYMENT_REFUND_TYPE.FULL : PAYMENT_REFUND_TYPE.PARTIAL;
}

function normalizeRefundMethod(value, payment = {}) {
  const method = normalizeString(value);
  if (method) return method;
  if (payment.payment_method === PAYMENT_METHOD.CASH) return PAYMENT_REFUND_METHOD.CASH;
  if (payment.payment_method === PAYMENT_METHOD.BANK_TRANSFER || payment.payment_method === PAYMENT_METHOD.QR) {
    return PAYMENT_REFUND_METHOD.BANK_TRANSFER;
  }
  return PAYMENT_REFUND_METHOD.ORIGINAL_METHOD;
}

async function getPaymentRefundUsage(paymentId, options = {}) {
  const match = {
    payment_id: toObjectId(paymentId),
    refund_status: { $in: options.statuses || [
      PAYMENT_REFUND_STATUS.REQUESTED,
      PAYMENT_REFUND_STATUS.UNDER_REVIEW,
      PAYMENT_REFUND_STATUS.APPROVED,
      PAYMENT_REFUND_STATUS.PROCESSING,
      PAYMENT_REFUND_STATUS.PROCESSED,
    ] },
  };
  if (options.excludeRefundId) match._id = { $ne: toObjectId(options.excludeRefundId) };
  let aggregate = PaymentRefund.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        requested_amount: { $sum: '$requested_amount' },
        approved_amount: { $sum: '$approved_amount' },
        processed_amount: { $sum: '$processed_amount' },
        count: { $sum: 1 },
      },
    },
  ]);
  if (options.session) aggregate = aggregate.session(options.session);
  const [row] = await aggregate;
  return {
    requested_amount: Number(row?.requested_amount || 0),
    approved_amount: Number(row?.approved_amount || 0),
    processed_amount: Number(row?.processed_amount || 0),
    count: Number(row?.count || 0),
  };
}

async function buildRefundRisk(payment, invoice, { amount, requestSource, excludeRefundId, session } = {}) {
  const [usage, claimCount, invoicePaymentCount] = await Promise.all([
    getPaymentRefundUsage(payment._id, { excludeRefundId, session }),
    withSession(InsuranceClaim.countDocuments({ invoice_id: invoice._id }), session),
    withSession(Payment.countDocuments({ invoice_id: invoice._id }), session),
  ]);
  const flags = [];
  const paidAt = payment.paid_at ? new Date(payment.paid_at) : null;
  if (Number(amount || 0) >= 5000000) flags.push('amount_over_threshold');
  if (paidAt && Date.now() - paidAt.getTime() < 24 * 60 * 60 * 1000) flags.push('payment_age_under_24h');
  if (!payment.receipt_image_url && !payment.receipt_file_name) flags.push('payment_has_no_receipt');
  if (['bank_qr_manual', 'momo_personal_qr', 'cash_manual'].includes(payment.payment_provider || payment.provider)) flags.push('manual_provider');
  if (claimCount > 0) flags.push('invoice_has_insurance_claim');
  if (invoicePaymentCount > 1) flags.push('invoice_has_multiple_payments');
  if (usage.count > 0) flags.push('same_payment_has_existing_refund');
  if (Number(amount || 0) + Number(usage.processed_amount || 0) > Number(payment.amount || 0)) flags.push('refund_amount_exceeds_paid_amount');
  if (requestSource === PAYMENT_REFUND_REQUEST_SOURCE.PATIENT_PORTAL && !payment.transaction_ref && payment.payment_method !== PAYMENT_METHOD.CASH) {
    flags.push('missing_transaction_reference');
  }
  const score = Math.min(100, flags.reduce((sum, flag) => {
    if (['refund_amount_exceeds_paid_amount', 'same_payment_has_existing_refund'].includes(flag)) return sum + 28;
    if (['amount_over_threshold', 'invoice_has_insurance_claim', 'manual_provider'].includes(flag)) return sum + 18;
    return sum + 10;
  }, 0));
  return { risk_score: score, risk_flags: flags };
}

async function generateClaimNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.INSURANCE_CLAIM, options);
}

function calculateLineAmounts({ quantity = 1, unitPrice = 0, discountAmount = 0, taxAmount = 0 }) {
  const subtotal = normalizeMoneyAmount(quantity * unitPrice, 'subtotal', { allowZero: true });
  const total = calculateLineTotal({ quantity, unitPrice, discountAmount, taxAmount });
  if (total < 0) throw createError('Tổng tiền không được âm.', 400);
  return { subtotal, total };
}

function normalizeBooleanQuery(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

function normalizeEnumList(value, allowed = [], label = 'enum') {
  if (value === undefined || value === null || value === '') return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  const normalized = items.map((item) => normalizeString(item)).filter(Boolean);
  const invalid = normalized.find((item) => !allowed.includes(item));
  if (invalid) throw createError(`${label} không hợp lệ.`, 422);
  return normalized;
}

function serviceCatalogSort(query = {}) {
  const allowed = new Set(['service_code', 'service_name', 'service_type', 'unit_price', 'created_at', 'updated_at', 'effective_from', 'effective_to', 'status']);
  const sortBy = allowed.has(normalizeString(query.sort_by)) ? normalizeString(query.sort_by) : 'service_type';
  const direction = String(query.sort_order || query.sort_direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  return { [sortBy]: direction, service_code: 1 };
}

function serviceRiskFlags(service = {}, usage = {}) {
  const flags = [];
  const now = new Date();
  if (Number(service.unit_price || 0) === 0) flags.push('zero_price');
  if (!service.is_billable) flags.push('non_billable');
  if (!service.department_id) flags.push('missing_department');
  if (Number(usage.charge_count || 0) > 0) flags.push('has_charges');
  if (service.status === SERVICE_STATUS.ACTIVE && service.effective_to) {
    const diffDays = Math.ceil((new Date(service.effective_to).getTime() - now.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays <= 30) flags.push('expiring_soon');
    if (diffDays < 0) flags.push('expired_but_active');
  }
  if (service.status === SERVICE_STATUS.RETIRED && service.effective_to && new Date(service.effective_to) > now) {
    flags.push('retired_with_future_effective_to');
  }
  return flags;
}

async function enrichServiceCatalogRows(items = []) {
  const ids = items.map((item) => item._id).filter(Boolean);
  if (!ids.length) return items;
  const stats = await Charge.aggregate([
    { $match: { service_id: { $in: ids } } },
    {
      $group: {
        _id: '$service_id',
        charge_count: { $sum: 1 },
        total_amount: { $sum: '$total_amount' },
        last_charge_at: { $max: '$charged_at' },
      },
    },
  ]);
  const usageMap = new Map(stats.map((row) => [String(row._id), row]));
  return items.map((item) => {
    const usage = usageMap.get(String(item._id)) || {};
    return {
      ...item,
      charge_count: usage.charge_count || 0,
      charge_total_amount: usage.total_amount || 0,
      last_charge_at: usage.last_charge_at || null,
      risk_flags: serviceRiskFlags(item, usage),
    };
  });
}

async function applyServiceCatalogAdvancedFilters(filter = {}, query = {}) {
  const isBillable = normalizeBooleanQuery(query.is_billable);
  if (isBillable !== undefined) filter.is_billable = isBillable;

  const serviceTypes = normalizeEnumList(query.service_types || query.service_type, SERVICE_TYPES, 'service_type');
  if (serviceTypes.length === 1) filter.service_type = serviceTypes[0];
  if (serviceTypes.length > 1) filter.service_type = { $in: serviceTypes };

  const statuses = normalizeEnumList(query.statuses || query.status, SERVICE_STATUSES, 'status');
  if (statuses.length === 1) filter.status = statuses[0];
  if (statuses.length > 1) filter.status = { $in: statuses };

  if (query.department_id) filter.department_id = query.department_id;

  const priceRange = {};
  if (query.price_min !== undefined && query.price_min !== '') priceRange.$gte = normalizeMoneyAmount(query.price_min, 'price_min', { allowZero: true });
  if (query.price_max !== undefined && query.price_max !== '') priceRange.$lte = normalizeMoneyAmount(query.price_max, 'price_max', { allowZero: true });
  if (Object.keys(priceRange).length) filter.unit_price = priceRange;

  const zeroPrice = normalizeBooleanQuery(query.zero_price);
  if (zeroPrice === true) filter.unit_price = 0;
  if (zeroPrice === false) filter.unit_price = { ...(filter.unit_price || {}), $gt: 0 };

  const effectiveDate = normalizeDate(query.effective_date, 'effective_date');
  if (effectiveDate) Object.assign(filter, buildEffectiveDateFilter(effectiveDate));

  const expiringInDays = query.expiring_in_days !== undefined && query.expiring_in_days !== ''
    ? Number(query.expiring_in_days)
    : null;
  if (Number.isFinite(expiringInDays)) {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + expiringInDays);
    filter.effective_to = { $gte: now, $lte: end };
  }

  const keyword = normalizeString(query.keyword || query.search || query.q);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { service_code: { $regex: pattern, $options: 'i' } },
      { service_name: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ];
  }

  const hasCharges = normalizeBooleanQuery(query.has_charges);
  if (hasCharges !== undefined) {
    const serviceIdsWithCharges = await Charge.distinct('service_id', {});
    filter._id = hasCharges ? { $in: serviceIdsWithCharges } : { $nin: serviceIdsWithCharges };
  }

  return filter;
}

async function generateServicePriceVersionCode(options = {}) {
  return generateBusinessCode(CODE_TYPE.SERVICE_PRICE_VERSION, { separator: '-', ...options });
}

function servicePriceAudit(action, actor = {}, metadata = {}) {
  return {
    action,
    actor_type: actorContext.getActorType(actor) || actor.actorType || 'staff',
    actor_id: actorId(actor),
    at: new Date(),
    metadata,
  };
}

async function createServicePriceVersion(service, payload = {}, actor = {}, requestMeta = {}) {
  const effectiveFrom = normalizeDate(payload.effective_from || payload.effectiveFrom, 'effective_from') || new Date();
  const effectiveTo = normalizeDate(payload.effective_to || payload.effectiveTo, 'effective_to');
  assertDateRange(effectiveFrom, effectiveTo, 'Hiệu lực phiên bản giá');
  const unitPrice = normalizeMoneyAmount(payload.unit_price, 'unit_price', { allowZero: true });
  const latest = await ServicePriceVersion.findOne({ service_id: service._id }).sort({ version_no: -1 }).lean();
  const versionNo = Number(latest?.version_no || 0) + 1;
  const oldPrice = Number(service.unit_price || 0);
  const changeType = payload.change_type
    || (unitPrice > oldPrice
      ? SERVICE_PRICE_CHANGE_TYPE.PRICE_INCREASE
      : unitPrice < oldPrice
        ? SERVICE_PRICE_CHANGE_TYPE.PRICE_DECREASE
        : SERVICE_PRICE_CHANGE_TYPE.NEW);

  if (payload.retire_old !== false) {
    const previousEffectiveTo = new Date(effectiveFrom.getTime() - 1);
    await ServicePriceVersion.updateMany(
      {
        service_id: service._id,
        status: SERVICE_PRICE_VERSION_STATUS.ACTIVE,
        $or: [{ effective_to: null }, { effective_to: { $exists: false } }, { effective_to: { $gte: effectiveFrom } }],
      },
      { $set: { effective_to: previousEffectiveTo, status: SERVICE_PRICE_VERSION_STATUS.EXPIRED, updated_by: actorId(actor) } },
    );
  }

  const version = await ServicePriceVersion.create({
    service_id: service._id,
    version_code: await generateServicePriceVersionCode(),
    version_no: versionNo,
    unit_price: unitPrice,
    currency: normalizeString(payload.currency || service.currency || 'VND').toUpperCase(),
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    status: payload.status || SERVICE_PRICE_VERSION_STATUS.ACTIVE,
    change_type: changeType,
    reason: normalizeString(payload.reason || payload.note),
    approved_by: actorId(actor),
    approved_at: new Date(),
    created_by: actorId(actor),
    updated_by: actorId(actor),
    audit_logs: [servicePriceAudit('service_price_version.created', actor, { old_price: oldPrice, new_price: unitPrice })],
  });

  if (version.status === SERVICE_PRICE_VERSION_STATUS.ACTIVE && effectiveFrom <= new Date()) {
    service.unit_price = unitPrice;
    service.currency = version.currency;
    service.updated_by = actorId(actor);
    await service.save();
  }

  await recordAuditLog({
    actor,
    action: 'service_price_version.create',
    targetType: 'service_catalog',
    targetId: service._id,
    status: 'success',
    message: 'Tạo phiên bản giá dịch vụ thành công.',
    requestMeta,
    metadata: {
      version_id: version._id,
      version_code: version.version_code,
      old_price: oldPrice,
      new_price: unitPrice,
      reason: version.reason,
    },
  });

  return version;
}

async function ensureInitialServicePriceVersion(service, actor = {}, requestMeta = {}) {
  const exists = await ServicePriceVersion.exists({ service_id: service._id });
  if (exists) return null;
  return createServicePriceVersion(service, {
    unit_price: service.unit_price,
    currency: service.currency,
    effective_from: service.effective_from || service.created_at || new Date(),
    effective_to: service.effective_to,
    change_type: SERVICE_PRICE_CHANGE_TYPE.NEW,
    reason: 'Initial service catalog price.',
    retire_old: false,
  }, actor, requestMeta);
}

async function resolveServicePrice(service, chargedAt = new Date(), session = null) {
  if (!service?._id) return { unit_price: service?.unit_price || 0, currency: service?.currency || 'VND', price_source: 'service_catalog' };
  let query = ServicePriceVersion.findOne({
    service_id: service._id,
    status: SERVICE_PRICE_VERSION_STATUS.ACTIVE,
    effective_from: { $lte: chargedAt },
    $or: [{ effective_to: null }, { effective_to: { $exists: false } }, { effective_to: { $gte: chargedAt } }],
  }).sort({ effective_from: -1, version_no: -1 });
  query = withSession(query, session);
  const version = await query.lean();
  if (!version) {
    return {
      unit_price: service.unit_price || 0,
      currency: service.currency || 'VND',
      price_source: 'service_catalog',
      price_version_id: null,
      price_version_code: null,
    };
  }
  return {
    unit_price: version.unit_price,
    currency: version.currency,
    price_source: 'service_price_version',
    price_version_id: version._id,
    price_version_code: version.version_code,
  };
}

async function createServiceCatalog(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.CREATE]);
  const serviceCode = normalizeString(payload.service_code).toUpperCase();
  const serviceName = normalizeString(payload.service_name);
  if (!serviceCode) throw createError('service_code là bắt buộc.', 400);
  if (!serviceName) throw createError('service_name là bắt buộc.', 400);
  if (!SERVICE_TYPES.includes(payload.service_type)) throw createError('service_type không hợp lệ.', 400);
  if (payload.status && !SERVICE_STATUSES.includes(payload.status)) throw createError('status không hợp lệ.', 400);
  const effectiveFrom = normalizeDate(payload.effective_from, 'effective_from');
  const effectiveTo = normalizeDate(payload.effective_to, 'effective_to');
  assertDateRange(effectiveFrom, effectiveTo, 'Hiệu lực service catalog');
  await assertDepartmentActive(payload.department_id);
  const exists = await ServiceCatalog.exists({ service_code: serviceCode, is_deleted: false });
  if (exists) throw createError('service_code đã tồn tại.', 409);

  const service = await ServiceCatalog.create({
    service_code: serviceCode,
    service_name: serviceName,
    service_type: payload.service_type,
    department_id: payload.department_id,
    description: normalizeString(payload.description),
    unit: normalizeString(payload.unit) || 'service',
    unit_price: normalizeMoneyAmount(payload.unit_price, 'unit_price', { allowZero: true }),
    currency: normalizeString(payload.currency || 'VND').toUpperCase(),
    is_billable: normalizeBooleanQuery(payload.is_billable) !== false,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    status: payload.status || SERVICE_STATUS.ACTIVE,
    created_by: actor.userId,
    updated_by: actor.userId,
  });
  service.version_group_id = service._id;
  await service.save();
  await ensureInitialServicePriceVersion(service, actor, requestMeta);

  await recordAuditLog({
    actor,
    action: 'service_catalog.create',
    targetType: 'service_catalog',
    targetId: service._id,
    status: 'success',
    message: 'Tạo service catalog thành công.',
    requestMeta,
  });
  return service;
}

async function listServiceCatalog(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.READ]);
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  await applyServiceCatalogAdvancedFilters(filter, query);

  const [rawItems, total] = await Promise.all([
    ServiceCatalog.find(filter)
      .sort(serviceCatalogSort(query))
      .skip(skip)
      .limit(limit)
      .populate('department_id', 'department_name department_code')
      .lean(),
    ServiceCatalog.countDocuments(filter),
  ]);
  const items = await enrichServiceCatalogRows(rawItems);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getServiceCatalogDetail(serviceId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.READ]);
  const [service, usage, versions] = await Promise.all([
    ServiceCatalog.findOne({ _id: serviceId, is_deleted: false })
      .populate('department_id', 'department_name department_code')
      .lean(),
    getServiceCatalogUsage(serviceId, { ...actor, internal: true }),
    ServicePriceVersion.find({ service_id: serviceId }).sort({ effective_from: -1, version_no: -1 }).lean(),
  ]);
  if (!service) throw createError('Không tìm thấy service catalog.', 404);
  return {
    ...service,
    ...usage,
    price_versions: versions,
    risk_flags: serviceRiskFlags(service, { charge_count: usage.charge_count_total }),
  };
}

async function updateServiceCatalog(serviceId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.UPDATE]);
  const service = await ServiceCatalog.findOne({ _id: serviceId, is_deleted: false });
  if (!service) throw createError('Không tìm thấy service catalog.', 404);
  const before = service.toObject();
  const changingPrice = payload.unit_price !== undefined && Number(payload.unit_price) !== Number(service.unit_price);
  if (changingPrice) {
    const hasCharges = await Charge.exists({ service_id: service._id });
    if (hasCharges && !payload.allow_price_update) {
      throw createError('Service đã phát sinh charge. Nếu cần đổi giá, hãy tạo phiên bản giá mới hoặc gửi allow_price_update=true để audit rõ.', 409);
    }
    await createServicePriceVersion(service, {
      unit_price: payload.unit_price,
      currency: payload.currency || service.currency,
      effective_from: payload.price_effective_from || payload.effective_from || new Date(),
      effective_to: payload.price_effective_to,
      reason: payload.price_change_reason || payload.reason || 'Direct service catalog price update.',
      retire_old: true,
    }, actor, requestMeta);
  }

  if (payload.service_name !== undefined) service.service_name = normalizeString(payload.service_name);
  if (payload.service_type !== undefined) {
    if (!SERVICE_TYPES.includes(payload.service_type)) throw createError('service_type không hợp lệ.', 400);
    service.service_type = payload.service_type;
  }
  if (payload.description !== undefined) service.description = normalizeString(payload.description);
  if (payload.department_id !== undefined) {
    await assertDepartmentActive(payload.department_id);
    service.department_id = payload.department_id || undefined;
  }
  if (payload.unit !== undefined) service.unit = normalizeString(payload.unit);
  if (payload.currency !== undefined) service.currency = normalizeString(payload.currency).toUpperCase();
  if (payload.is_billable !== undefined) service.is_billable = normalizeBooleanQuery(payload.is_billable) === true;
  if (payload.effective_from !== undefined) service.effective_from = normalizeDate(payload.effective_from, 'effective_from');
  if (payload.effective_to !== undefined) service.effective_to = normalizeDate(payload.effective_to, 'effective_to');
  assertDateRange(service.effective_from, service.effective_to, 'Hiệu lực service catalog');
  if (payload.status !== undefined) {
    if (!SERVICE_STATUSES.includes(payload.status)) throw createError('status không hợp lệ.', 400);
    service.status = payload.status;
  }
  service.updated_by = actor.userId;
  await service.save();

  await recordAuditLog({
    actor,
    action: 'service_catalog.update',
    targetType: 'service_catalog',
    targetId: service._id,
    status: 'success',
    message: 'Cập nhật service catalog thành công.',
    requestMeta,
    before,
    after: service.toObject(),
  });
  return getServiceCatalogDetail(service._id, actor);
}

async function retireServiceCatalog(serviceId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.UPDATE, PERMISSION.SERVICE_CATALOG.DELETE]);
  const reason = normalizeString(payload.reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const service = await ServiceCatalog.findOne({ _id: serviceId, is_deleted: false });
  if (!service) throw createError('Không tìm thấy service catalog.', 404);
  const before = service.toObject();
  service.status = SERVICE_STATUS.RETIRED;
  service.effective_to = service.effective_to && service.effective_to < new Date() ? service.effective_to : new Date();
  service.retired_at = new Date();
  service.retired_by = actor.userId;
  service.retire_reason = reason;
  service.updated_by = actor.userId;
  await service.save();
  await ServicePriceVersion.updateMany(
    { service_id: service._id, status: SERVICE_PRICE_VERSION_STATUS.ACTIVE },
    { $set: { status: SERVICE_PRICE_VERSION_STATUS.EXPIRED, effective_to: service.effective_to, updated_by: actor.userId } },
  );
  await recordAuditLog({
    actor,
    action: 'service_catalog.retire',
    targetType: 'service_catalog',
    targetId: service._id,
    status: 'success',
    message: 'Retire service catalog thành công.',
    requestMeta,
    before,
    after: service.toObject(),
    metadata: { reason },
  });
  return getServiceCatalogDetail(service._id, actor);
}

async function reactivateServiceCatalog(serviceId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.REACTIVATE, PERMISSION.SERVICE_CATALOG.UPDATE]);
  const reason = normalizeString(payload.reason || payload.reactivate_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const service = await ServiceCatalog.findOne({ _id: serviceId, is_deleted: false });
  if (!service) throw createError('Không tìm thấy service catalog.', 404);
  const before = service.toObject();
  service.status = payload.status && payload.status !== SERVICE_STATUS.RETIRED ? payload.status : SERVICE_STATUS.ACTIVE;
  service.effective_from = normalizeDate(payload.effective_from, 'effective_from') || new Date();
  service.effective_to = normalizeDate(payload.effective_to, 'effective_to');
  assertDateRange(service.effective_from, service.effective_to, 'Hiệu lực service catalog');
  service.reactivated_at = new Date();
  service.reactivated_by = actor.userId;
  service.reactivate_reason = reason;
  service.updated_by = actor.userId;
  await service.save();
  await createServicePriceVersion(service, {
    unit_price: payload.unit_price ?? service.unit_price,
    currency: payload.currency || service.currency,
    effective_from: service.effective_from,
    effective_to: service.effective_to,
    reason,
    change_type: SERVICE_PRICE_CHANGE_TYPE.REACTIVATE,
    retire_old: false,
  }, actor, requestMeta);
  await recordAuditLog({
    actor,
    action: 'service_catalog.reactivate',
    targetType: 'service_catalog',
    targetId: service._id,
    status: 'success',
    message: 'Reactivate service catalog thành công.',
    requestMeta,
    before,
    after: service.toObject(),
    metadata: { reason },
  });
  return getServiceCatalogDetail(service._id, actor);
}

async function cloneServiceCatalog(serviceId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.CREATE]);
  const source = await ServiceCatalog.findOne({ _id: serviceId, is_deleted: false }).lean();
  if (!source) throw createError('Không tìm thấy service catalog.', 404);
  const body = {
    service_code: payload.service_code || `${source.service_code}-COPY`,
    service_name: payload.service_name || `${source.service_name} (copy)`,
    service_type: payload.service_type || source.service_type,
    department_id: payload.department_id !== undefined ? payload.department_id : source.department_id,
    description: payload.description !== undefined ? payload.description : source.description,
    unit: payload.unit || source.unit,
    unit_price: payload.unit_price !== undefined ? payload.unit_price : source.unit_price,
    currency: payload.currency || source.currency,
    is_billable: payload.is_billable !== undefined ? payload.is_billable : source.is_billable,
    effective_from: payload.effective_from || new Date(),
    effective_to: payload.effective_to,
    status: payload.status || SERVICE_STATUS.ACTIVE,
  };
  const clone = await createServiceCatalog(body, actor, requestMeta);
  await ServiceCatalog.findByIdAndUpdate(clone._id || clone.id, {
    $set: {
      parent_service_id: source._id,
      version_group_id: source.version_group_id || source._id,
    },
  });
  await recordAuditLog({
    actor,
    action: 'service_catalog.clone',
    targetType: 'service_catalog',
    targetId: clone._id || clone.id,
    status: 'success',
    message: 'Clone service catalog thành công.',
    requestMeta,
    metadata: { source_service_id: source._id },
  });
  return getServiceCatalogDetail(clone._id || clone.id, actor);
}

async function createServiceCatalogNewVersion(serviceId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.UPDATE, PERMISSION.SERVICE_CATALOG.APPROVE_PRICE_CHANGE]);
  const service = await ServiceCatalog.findOne({ _id: serviceId, is_deleted: false });
  if (!service) throw createError('Không tìm thấy service catalog.', 404);
  const reason = normalizeString(payload.reason || payload.note);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const version = await createServicePriceVersion(service, {
    unit_price: payload.unit_price,
    currency: payload.currency || service.currency,
    effective_from: payload.effective_from || payload.effectiveFrom,
    effective_to: payload.effective_to || payload.effectiveTo,
    status: payload.status || SERVICE_PRICE_VERSION_STATUS.ACTIVE,
    reason,
    retire_old: payload.retire_old !== false,
  }, actor, requestMeta);
  return {
    service: await getServiceCatalogDetail(service._id, actor),
    price_version: version.toObject ? version.toObject() : version,
  };
}

async function getServiceCatalogUsage(serviceId, actor = {}) {
  if (!actor.internal) assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.READ]);
  const serviceObjectId = toObjectId(serviceId);
  const now = new Date();
  const d7 = new Date(now);
  d7.setDate(d7.getDate() - 7);
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const [totalCharges, charges7d, charges30d, revenue30dAgg, lastCharge, invoiceItemCount] = await Promise.all([
    Charge.countDocuments({ service_id: serviceObjectId }),
    Charge.countDocuments({ service_id: serviceObjectId, charged_at: { $gte: d7 } }),
    Charge.countDocuments({ service_id: serviceObjectId, charged_at: { $gte: d30 } }),
    Charge.aggregate([
      {
        $match: {
          service_id: serviceObjectId,
          charged_at: { $gte: d30 },
          status: { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.BILLED] },
        },
      },
      { $group: { _id: null, revenue: { $sum: '$total_amount' } } },
    ]),
    Charge.findOne({ service_id: serviceObjectId }).sort({ charged_at: -1 }).lean(),
    InvoiceItem.countDocuments({ service_id: serviceObjectId }),
  ]);
  return {
    service_id: serviceId,
    charge_count_total: totalCharges,
    charge_count: totalCharges,
    charge_count_7d: charges7d,
    charge_count_30d: charges30d,
    revenue_30d: revenue30dAgg[0]?.revenue || 0,
    last_charge_at: lastCharge?.charged_at || null,
    invoice_item_count: invoiceItemCount,
  };
}

async function getServiceCatalogSummary(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.READ]);
  const filter = { is_deleted: false };
  await applyServiceCatalogAdvancedFilters(filter, query);
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + Number(query.expiring_window_days || 30));
  const [statusRows, billableRows, zeroPrice, expiringSoon, total, chargeServiceIds, byType, byDepartment] = await Promise.all([
    ServiceCatalog.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ServiceCatalog.aggregate([{ $match: filter }, { $group: { _id: '$is_billable', count: { $sum: 1 } } }]),
    ServiceCatalog.countDocuments({ ...filter, unit_price: 0 }),
    ServiceCatalog.countDocuments({ ...filter, effective_to: { $gte: now, $lte: soon } }),
    ServiceCatalog.countDocuments(filter),
    Charge.distinct('service_id', {}),
    ServiceCatalog.aggregate([
      { $match: filter },
      { $group: { _id: '$service_type', count: { $sum: 1 }, avg_price: { $avg: '$unit_price' }, min_price: { $min: '$unit_price' }, max_price: { $max: '$unit_price' } } },
      { $sort: { count: -1 } },
    ]),
    ServiceCatalog.aggregate([
      { $match: filter },
      { $group: { _id: '$department_id', count: { $sum: 1 }, avg_price: { $avg: '$unit_price' } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    ]),
  ]);
  const byStatus = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  const byBillable = Object.fromEntries(billableRows.map((row) => [String(row._id), row.count]));
  const withCharges = chargeServiceIds.length
    ? await ServiceCatalog.countDocuments({ ...filter, _id: { $in: chargeServiceIds } })
    : 0;
  return {
    total,
    active: byStatus[SERVICE_STATUS.ACTIVE] || 0,
    inactive: byStatus[SERVICE_STATUS.INACTIVE] || 0,
    retired: byStatus[SERVICE_STATUS.RETIRED] || 0,
    billable: byBillable.true || 0,
    non_billable: byBillable.false || 0,
    zero_price: zeroPrice,
    expiring_soon: expiringSoon,
    with_charges: withCharges,
    without_charges: Math.max(0, total - withCharges),
    by_service_type: byType.map((row) => ({ service_type: row._id, count: row.count, avg_price: Math.round(row.avg_price || 0), min_price: row.min_price || 0, max_price: row.max_price || 0 })),
    by_department: byDepartment.map((row) => ({
      department_id: row._id,
      department_name: row.department?.department_name || 'Không có khoa',
      department_code: row.department?.department_code,
      count: row.count,
      avg_price: Math.round(row.avg_price || 0),
    })),
  };
}

async function getServiceCatalogDepartmentSummary(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.READ]);
  const filter = { is_deleted: false };
  if (query.department_id) filter.department_id = toObjectId(query.department_id);
  await applyServiceCatalogAdvancedFilters(filter, { ...query, department_id: undefined });
  const d30 = new Date();
  d30.setDate(d30.getDate() - 30);
  const rows = await ServiceCatalog.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$department_id',
        total_services: { $sum: 1 },
        active_services: { $sum: { $cond: [{ $eq: ['$status', SERVICE_STATUS.ACTIVE] }, 1, 0] } },
        billable_services: { $sum: { $cond: ['$is_billable', 1, 0] } },
        zero_price_services: { $sum: { $cond: [{ $eq: ['$unit_price', 0] }, 1, 0] } },
        retired_services: { $sum: { $cond: [{ $eq: ['$status', SERVICE_STATUS.RETIRED] }, 1, 0] } },
        avg_price: { $avg: '$unit_price' },
        min_price: { $min: '$unit_price' },
        max_price: { $max: '$unit_price' },
        service_ids: { $push: '$_id' },
      },
    },
    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    { $sort: { total_services: -1 } },
  ]);
  const enriched = [];
  for (const row of rows) {
    const [charges30d, revenue30d] = await Promise.all([
      Charge.countDocuments({ service_id: { $in: row.service_ids }, charged_at: { $gte: d30 } }),
      Charge.aggregate([
        { $match: { service_id: { $in: row.service_ids }, charged_at: { $gte: d30 }, status: { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.BILLED] } } },
        { $group: { _id: null, total: { $sum: '$total_amount' } } },
      ]),
    ]);
    enriched.push({
      department_id: row._id,
      department_name: row.department?.department_name || 'Không có khoa',
      department_code: row.department?.department_code,
      total_services: row.total_services,
      active_services: row.active_services,
      billable_services: row.billable_services,
      zero_price_services: row.zero_price_services,
      retired_services: row.retired_services,
      avg_price: Math.round(row.avg_price || 0),
      min_price: row.min_price || 0,
      max_price: row.max_price || 0,
      total_charges_30d: charges30d,
      revenue_30d: revenue30d[0]?.total || 0,
    });
  }
  return { items: enriched };
}

async function listEffectiveServiceCatalog(query = {}, actor = {}) {
  return listServiceCatalog({
    ...query,
    status: SERVICE_STATUS.ACTIVE,
    is_billable: true,
    effective_date: query.effective_date || new Date().toISOString(),
  }, actor);
}

async function listServiceCatalogTimeline(serviceId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.READ, PERMISSION.SERVICE_CATALOG.READ_AUDIT]);
  const serviceObjectId = toObjectId(serviceId);
  const [versions, audits] = await Promise.all([
    ServicePriceVersion.find({ service_id: serviceObjectId }).sort({ effective_from: -1, version_no: -1 }).lean(),
    AuditLog.find({ target_type: 'service_catalog', target_id: serviceObjectId }).sort({ created_at: -1 }).limit(100).lean(),
  ]);
  return { price_versions: versions, audit_logs: audits };
}

async function listServiceCatalogCharges(serviceId, query = {}, actor = {}) {
  return listCharges({ ...query, service_id: serviceId }, actor);
}

async function listServiceCatalogInvoiceItems(serviceId, query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.READ, PERMISSION.INVOICES.READ]);
  const { page, limit, skip } = getPagination(query);
  const filter = { service_id: toObjectId(serviceId) };
  const [items, total] = await Promise.all([
    InvoiceItem.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('invoice_id', 'invoice_no status issued_at total_amount')
      .lean(),
    InvoiceItem.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function bulkUpdateServiceCatalog(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.BULK_UPDATE, PERMISSION.SERVICE_CATALOG.UPDATE]);
  const ids = Array.isArray(payload.service_ids) ? payload.service_ids : [];
  if (!ids.length) throw createError('service_ids là bắt buộc.', 400);
  const patch = {};
  if (payload.status !== undefined) {
    if (!SERVICE_STATUSES.includes(payload.status)) throw createError('status không hợp lệ.', 400);
    patch.status = payload.status;
  }
  if (payload.is_billable !== undefined) patch.is_billable = normalizeBooleanQuery(payload.is_billable) === true;
  if (payload.effective_from !== undefined) patch.effective_from = normalizeDate(payload.effective_from, 'effective_from');
  if (payload.effective_to !== undefined) patch.effective_to = normalizeDate(payload.effective_to, 'effective_to');
  if (payload.department_id !== undefined) {
    await assertDepartmentActive(payload.department_id);
    patch.department_id = payload.department_id || undefined;
  }
  if (!Object.keys(patch).length) throw createError('Không có dữ liệu bulk update.', 400);
  patch.updated_by = actor.userId;
  const result = await ServiceCatalog.updateMany({ _id: { $in: ids.map((id) => toObjectId(id)) }, is_deleted: false }, { $set: patch });
  await recordAuditLog({
    actor,
    action: 'service_catalog.bulk_update',
    targetType: 'service_catalog',
    status: 'success',
    message: 'Bulk update service catalog thành công.',
    requestMeta,
    metadata: { service_ids: ids, patch, matched_count: result.matchedCount, modified_count: result.modifiedCount },
  });
  return { matched_count: result.matchedCount, modified_count: result.modifiedCount };
}

async function bulkRetireServiceCatalog(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.BULK_UPDATE, PERMISSION.SERVICE_CATALOG.UPDATE, PERMISSION.SERVICE_CATALOG.DELETE]);
  const ids = Array.isArray(payload.service_ids) ? payload.service_ids : [];
  const reason = normalizeString(payload.reason);
  if (!ids.length) throw createError('service_ids là bắt buộc.', 400);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const now = new Date();
  const result = await ServiceCatalog.updateMany(
    { _id: { $in: ids.map((id) => toObjectId(id)) }, is_deleted: false },
    {
      $set: {
        status: SERVICE_STATUS.RETIRED,
        effective_to: now,
        retired_at: now,
        retired_by: actor.userId,
        retire_reason: reason,
        updated_by: actor.userId,
      },
    },
  );
  await ServicePriceVersion.updateMany(
    { service_id: { $in: ids.map((id) => toObjectId(id)) }, status: SERVICE_PRICE_VERSION_STATUS.ACTIVE },
    { $set: { status: SERVICE_PRICE_VERSION_STATUS.EXPIRED, effective_to: now, updated_by: actor.userId } },
  );
  await recordAuditLog({
    actor,
    action: 'service_catalog.bulk_retire',
    targetType: 'service_catalog',
    status: 'success',
    message: 'Bulk retire service catalog thành công.',
    requestMeta,
    metadata: { service_ids: ids, reason, matched_count: result.matchedCount, modified_count: result.modifiedCount },
  });
  return { matched_count: result.matchedCount, modified_count: result.modifiedCount };
}

async function findDuplicateCharge(payload = {}, session = null) {
  const baseFilter = { status: { $in: ACTIVE_CHARGE_STATUSES } };
  if (payload.dispense_item_id) return withSession(Charge.findOne({ ...baseFilter, dispense_item_id: payload.dispense_item_id }).lean(), session);
  const sourceModule = normalizeString(payload.source_module || payload.source_type);
  if (sourceModule && payload.source_id) {
    return withSession(Charge.findOne({ ...baseFilter, source_module: sourceModule, source_id: payload.source_id }).lean(), session);
  }
  if (payload.order_id && payload.service_id) {
    return withSession(Charge.findOne({ ...baseFilter, order_id: payload.order_id, service_id: payload.service_id }).lean(), session);
  }
  return null;
}

async function createCharge(payload = {}, actor = {}, requestMeta = {}, options = {}) {
  if (!options.internal) {
    assertStaffPermission(actor, [PERMISSION.CHARGES.CREATE, PERMISSION.CHARGES.REQUEST_CREATE, PERMISSION.CHARGES.MANAGE]);
  }
  const chargedAt = normalizeDate(payload.charged_at, 'charged_at') || new Date();
  const patient = await assertPatientActive(payload.patient_id);
  const encounter = await assertEncounterMatchesPatient(payload.encounter_id, patient._id);
  await assertAdmissionMatchesPatient(payload.admission_id, patient._id);
  const service = await assertServiceBillable(payload.service_id, chargedAt);
  if (actor.actorType === 'staff' && !hasGlobalBillingScope(actor)) {
    const departmentId = actorDepartmentId(actor);
    if (encounter && !sameId(encounter.department_id, departmentId)) {
      throw createError('Bạn không có quyền tạo charge cho encounter ngoài khoa.', 403);
    }
    if (service?.department_id && !sameId(service.department_id, departmentId)) {
      throw createError('Bạn không có quyền tạo charge dịch vụ ngoài khoa.', 403);
    }
  }
  const quantity = normalizePositiveInteger(payload.quantity, 'quantity', { defaultValue: 1 });
  const canOverridePrice = hasAnyPermission(actor, [PERMISSION.CHARGES.MANAGE, PERMISSION.CHARGES.UPDATE]) || options.internal;
  const resolvedPrice = await resolveServicePrice(service, chargedAt);
  const unitPrice = payload.unit_price !== undefined && canOverridePrice
    ? normalizeMoneyAmount(payload.unit_price, 'unit_price', { allowZero: true })
    : normalizeMoneyAmount(resolvedPrice.unit_price ?? service?.unit_price ?? payload.unit_price ?? 0, 'unit_price', { allowZero: true });
  const discountAmount = normalizeMoneyAmount(payload.discount_amount, 'discount_amount', { allowZero: true, defaultValue: 0 });
  const taxAmount = normalizeMoneyAmount(payload.tax_amount, 'tax_amount', { allowZero: true, defaultValue: 0 });
  const { total } = calculateLineAmounts({ quantity, unitPrice, discountAmount, taxAmount });
  const status = payload.status || (payload.post_immediately ? CHARGE_STATUS.POSTED : CHARGE_STATUS.PENDING);
  if (![CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT, CHARGE_STATUS.POSTED].includes(status)) {
    throw createError('Charge mới chỉ được tạo ở pending/draft/posted.', 409);
  }
  const description = normalizeString(payload.description) || service?.service_name;
  if (!description) throw createError('description là bắt buộc nếu không có service_id.', 400);

  let chargeId;
  await withOptionalTransaction(async (session) => {
    const duplicate = payload.allow_duplicate ? null : await findDuplicateCharge(payload, session);
    if (duplicate) {
      chargeId = duplicate._id;
      return;
    }
    const chargeNo = payload.charge_no || await generateChargeNumber({ session });
    try {
      const [charge] = await Charge.create([{
        patient_id: patient._id,
        encounter_id: payload.encounter_id,
        admission_id: payload.admission_id,
        service_id: service?._id,
        price_version_id: payload.unit_price !== undefined && canOverridePrice ? undefined : resolvedPrice.price_version_id,
        price_source: payload.unit_price !== undefined && canOverridePrice ? 'manual_override' : resolvedPrice.price_source,
        base_unit_price: resolvedPrice.unit_price ?? service?.unit_price,
        order_id: payload.order_id,
        source_module: normalizeString(payload.source_module || payload.source_type),
        source_id: payload.source_id,
        dispense_id: payload.dispense_id,
        dispense_item_id: payload.dispense_item_id,
        medication_id: payload.medication_id,
        charge_no: chargeNo,
        description,
        quantity,
        unit_price: unitPrice,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: total,
        charged_at: chargedAt,
        posted_by: status === CHARGE_STATUS.POSTED ? actor.userId : undefined,
        posted_at: status === CHARGE_STATUS.POSTED ? new Date() : undefined,
        status,
        created_by: actor.userId,
        updated_by: actor.userId,
      }], sessionOptions(session));
      chargeId = charge._id;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const duplicateAfterRace = await findDuplicateCharge({
        ...payload,
        source_module: normalizeString(payload.source_module || payload.source_type),
      }, session);
      if (!duplicateAfterRace) throw createError('Charge active đã tồn tại cho nghiệp vụ này.', 409);
      chargeId = duplicateAfterRace._id;
    }
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'charges.create',
    targetType: 'charge',
    targetId: chargeId,
    status: 'success',
    message: 'Tạo charge thành công.',
    requestMeta,
  });
  return getChargeDetail(chargeId, { ...actor, internal: options.internal });
}

async function postCharge(chargeId, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.CHARGES.POST, PERMISSION.CHARGES.MANAGE]);
  const charge = await Charge.findById(chargeId);
  if (!charge) throw createError('Không tìm thấy charge.', 404);
  if (charge.invoice_id) throw createError('Charge đã thuộc invoice, không thể post lại.', 409);
  if (![CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT].includes(charge.status)) {
    throw createError('Charge phải pending/draft trước khi post.', 409);
  }
  assertTransition(CHARGE_TRANSITIONS, charge.status, CHARGE_STATUS.POSTED, 'charge');
  charge.status = CHARGE_STATUS.POSTED;
  charge.posted_by = actor.userId;
  charge.posted_at = new Date();
  charge.updated_by = actor.userId;
  await charge.save();
  await recordAuditLog({
    actor,
    action: 'charges.post',
    targetType: 'charge',
    targetId: charge._id,
    status: 'success',
    message: 'Post charge thành công.',
    requestMeta,
  });
  return getChargeDetail(charge._id, actor);
}

async function voidCharge(chargeId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.CHARGES.VOID, PERMISSION.CHARGES.MANAGE]);
  const reason = normalizeString(payload.reason || payload.void_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const charge = await Charge.findById(chargeId);
  if (!charge) throw createError('Không tìm thấy charge.', 404);
  if (charge.invoice_id || charge.status === CHARGE_STATUS.BILLED) {
    throw createError('Charge đã lên invoice, phải xử lý invoice adjustment/void thay vì void trực tiếp.', 409);
  }
  if (![CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT, CHARGE_STATUS.POSTED].includes(charge.status)) {
    throw createError('Charge không ở trạng thái có thể void.', 409);
  }
  assertTransition(CHARGE_TRANSITIONS, charge.status, CHARGE_STATUS.VOIDED, 'charge');
  charge.status = CHARGE_STATUS.VOIDED;
  charge.voided_by = actor.userId;
  charge.voided_at = new Date();
  charge.void_reason = reason;
  charge.updated_by = actor.userId;
  await charge.save();
  await recordAuditLog({
    actor,
    action: 'charges.void',
    targetType: 'charge',
    targetId: charge._id,
    status: 'success',
    message: 'Void charge thành công.',
    requestMeta,
    metadata: { reason },
  });
  return getChargeDetail(charge._id, actor);
}

function applyPatientScope(filter, actor, selfPermission) {
  if (actor.actorType !== 'patient') return filter;
  assertPatientSelf(actor, actor.patientId || actor.patient_id, selfPermission);
  return { ...filter, patient_id: actor.patientId || actor.patient_id };
}

async function listCharges(query = {}, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id, PERMISSION.INVOICES.SELF_READ);
  } else {
    assertStaffPermission(actor, [PERMISSION.CHARGES.READ, PERMISSION.CHARGES.MANAGE]);
  }
  const { page, limit, skip } = getPagination(query);
  let filter = {};
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'order_id', 'invoice_id', 'service_id', 'status', 'source_module', 'source_id']) {
    if (query[field]) filter[field] = query[field];
  }
  for (const field of ['posted_by', 'voided_by', 'billed_by', 'created_by', 'review_status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.charge_no) {
    filter.charge_no = { $regex: escapeRegex(query.charge_no), $options: 'i' };
  }
  const serviceTypes = normalizeServiceTypeQuery(query);
  if (serviceTypes.length > 0) {
    const services = await ServiceCatalog.find({ service_type: { $in: serviceTypes }, is_deleted: false }).select('_id').lean();
    const serviceIds = services.map((service) => service._id);
    if (filter.service_id) {
      filter.service_id = serviceIds.some((id) => sameId(id, filter.service_id)) ? filter.service_id : { $in: [] };
    } else {
      filter.service_id = { $in: serviceIds };
    }
  }
  if (query.department_id) {
    const [services, orders] = await Promise.all([
      ServiceCatalog.find({ department_id: query.department_id, is_deleted: false }).select('_id').limit(2000).lean(),
      Order.find({ department_id: query.department_id }).select('_id').limit(4000).lean(),
    ]);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { service_id: { $in: services.map((service) => service._id) } },
          { order_id: { $in: orders.map((order) => order._id) } },
        ],
      },
    ];
  }
  if (query.order_type) {
    const orders = await Order.find({ order_type: query.order_type }).select('_id').limit(4000).lean();
    const orderIds = orders.map((order) => order._id);
    filter.order_id = filter.order_id
      ? (orderIds.some((id) => sameId(id, filter.order_id)) ? filter.order_id : { $in: [] })
      : { $in: orderIds };
  }
  if (query.has_invoice === true || query.has_invoice === 'true') {
    filter.invoice_id = { $exists: true, $ne: null };
  }
  if (query.has_invoice === false || query.has_invoice === 'false') {
    filter.$or = [
      ...(filter.$or || []),
      { invoice_id: { $exists: false } },
      { invoice_id: null },
    ];
  }
  if (query.billable_only === true || query.billable_only === 'true') {
    const billableServices = await ServiceCatalog.find({ is_billable: true, is_deleted: false }).select('_id').lean();
    const billableIds = billableServices.map((service) => service._id);
    filter.service_id = filter.service_id?.$in
      ? { $in: filter.service_id.$in.filter((id) => billableIds.some((billableId) => sameId(billableId, id))) }
      : filter.service_id
        ? (billableIds.some((id) => sameId(id, filter.service_id)) ? filter.service_id : { $in: [] })
        : { $in: billableIds };
  }
  if (query.amount_min !== undefined && query.amount_min !== '') {
    filter.total_amount = { ...(filter.total_amount || {}), $gte: normalizeMoneyAmount(query.amount_min, 'amount_min', { allowZero: true }) };
  }
  if (query.amount_max !== undefined && query.amount_max !== '') {
    filter.total_amount = { ...(filter.total_amount || {}), $lte: normalizeMoneyAmount(query.amount_max, 'amount_max', { allowZero: true }) };
  }
  if (query.order_status) {
    const orders = await Order.find({ status: query.order_status }).select('_id').limit(2000).lean();
    const orderIds = orders.map((order) => order._id);
    filter.order_id = filter.order_id
      ? (orderIds.some((id) => sameId(id, filter.order_id)) ? filter.order_id : { $in: [] })
      : { $in: orderIds };
  }
  if (query.patient_code || query.patient_name || query.patient_keyword) {
    const patientPattern = escapeRegex(query.patient_code || query.patient_name || query.patient_keyword);
    const patients = await Patient.find({
      $or: [
        { patient_code: { $regex: patientPattern, $options: 'i' } },
        { full_name: { $regex: patientPattern, $options: 'i' } },
        { phone: { $regex: patientPattern, $options: 'i' } },
      ],
    }).select('_id').limit(500).lean();
    filter.patient_id = { $in: patients.map((patient) => patient._id) };
  }
  if (query.encounter_code) {
    const encounters = await Encounter.find({ encounter_code: { $regex: escapeRegex(query.encounter_code), $options: 'i' } }).select('_id').limit(500).lean();
    filter.encounter_id = { $in: encounters.map((encounter) => encounter._id) };
  }
  if (query.invoice_no) {
    const invoices = await Invoice.find({ invoice_no: { $regex: escapeRegex(query.invoice_no), $options: 'i' } }).select('_id').limit(500).lean();
    filter.invoice_id = { $in: invoices.map((invoice) => invoice._id) };
  }
  const keyword = normalizeString(query.keyword || query.q || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const [patients, orders, invoices, services] = await Promise.all([
      Patient.find({
        $or: [
          { patient_code: { $regex: pattern, $options: 'i' } },
          { full_name: { $regex: pattern, $options: 'i' } },
          { phone: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
      Order.find({ order_no: { $regex: pattern, $options: 'i' } }).select('_id').limit(500).lean(),
      Invoice.find({ invoice_no: { $regex: pattern, $options: 'i' } }).select('_id').limit(500).lean(),
      ServiceCatalog.find({
        is_deleted: false,
        $or: [
          { service_code: { $regex: pattern, $options: 'i' } },
          { service_name: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
    ]);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { charge_no: { $regex: pattern, $options: 'i' } },
          { description: { $regex: pattern, $options: 'i' } },
          ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
          ...(orders.length ? [{ order_id: { $in: orders.map((order) => order._id) } }] : []),
          ...(invoices.length ? [{ invoice_id: { $in: invoices.map((invoice) => invoice._id) } }] : []),
          ...(services.length ? [{ service_id: { $in: services.map((service) => service._id) } }] : []),
        ],
      },
    ];
  }
  if (query.date_from || query.date_to) {
    filter.charged_at = {};
    const from = normalizeDate(query.date_from, 'date_from');
    const to = normalizeDate(query.date_to, 'date_to');
    if (from) filter.charged_at.$gte = from;
    if (to) filter.charged_at.$lte = to;
  }
  for (const range of [
    ['posted_at', 'posted_from', 'posted_to'],
    ['voided_at', 'voided_from', 'voided_to'],
    ['billed_at', 'billed_from', 'billed_to'],
    ['created_at', 'created_from', 'created_to'],
  ]) {
    const [field, fromKey, toKey] = range;
    if (query[fromKey] || query[toKey]) {
      filter[field] = { ...(filter[field] || {}) };
      const from = normalizeDate(query[fromKey], fromKey);
      const to = normalizeDate(query[toKey], toKey);
      if (from) filter[field].$gte = from;
      if (to) filter[field].$lte = to;
    }
  }
  filter = applyPatientScope(filter, actor, PERMISSION.INVOICES.SELF_READ);
  filter = await applyEncounterDepartmentScope(filter, actor);
  const sortField = ['charged_at', 'posted_at', 'billed_at', 'voided_at', 'created_at', 'total_amount', 'charge_no', 'status'].includes(query.sort_by)
    ? query.sort_by
    : 'charged_at';
  const sortDirection = String(query.sort_order || '').toLowerCase() === 'asc' ? 1 : -1;
  const sort = sortField === 'created_at' ? { created_at: sortDirection } : { [sortField]: sortDirection, created_at: -1 };
  const [items, total] = await Promise.all([
    Charge.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('service_id', 'service_code service_name service_type unit_price is_billable status department_id')
      .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
      .populate('order_id', 'order_no order_type priority status ordered_at department_id')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
      .lean(),
    Charge.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getChargeDetail(chargeId, actor = {}, session = null) {
  if (actorContext.isSystem(actor)) {
    // Internal callers already completed their business validation.
  } else if (actor.actorType === 'patient') {
    const charge = await withSession(Charge.findById(chargeId).lean(), session);
    if (!charge) throw createError('Không tìm thấy charge.', 404);
    assertPatientSelf(actor, charge.patient_id, PERMISSION.INVOICES.SELF_READ);
  } else if (actor.actorType === 'staff') {
    assertStaffPermission(actor, [PERMISSION.CHARGES.READ, PERMISSION.CHARGES.MANAGE]);
  }
  const charge = await withSession(Charge.findById(chargeId)
    .populate('service_id', 'service_code service_name service_type unit')
    .populate('patient_id', 'patient_code full_name')
    .populate('invoice_id', 'invoice_no status')
    .lean(), session);
  if (!charge) throw createError('Không tìm thấy charge.', 404);
  if (actor.actorType === 'staff' && !hasGlobalBillingScope(actor)) {
    const scoped = await applyEncounterDepartmentScope({ _id: charge._id, encounter_id: charge.encounter_id }, actor, session);
    if (scoped.encounter_id?.$in && scoped.encounter_id.$in.length === 0) {
      throw createError('Bạn không có quyền xem charge ngoài khoa.', 403);
    }
  }
  return charge;
}

async function createInvoiceItemsSnapshot(invoice, charges, actor = {}, session = null) {
  const serviceIds = charges.map((charge) => charge.service_id).filter(Boolean);
  const services = await withSession(ServiceCatalog.find({ _id: { $in: serviceIds } }).lean(), session);
  const serviceMap = new Map(services.map((service) => [String(service._id), service]));
  const docs = charges.map((charge, index) => {
    const service = charge.service_id ? serviceMap.get(String(charge.service_id)) : null;
    return {
      invoice_id: invoice._id,
      charge_id: charge._id,
      service_id: charge.service_id,
      price_version_id: charge.price_version_id,
      price_source: charge.price_source,
      charge_no: charge.charge_no,
      service_code: service?.service_code,
      service_name: service?.service_name,
      description: charge.description,
      quantity: charge.quantity,
      unit_price: charge.unit_price,
      discount_amount: charge.discount_amount,
      tax_amount: charge.tax_amount,
      line_total: charge.total_amount,
      display_order: index + 1,
      created_by: actor.userId,
      updated_by: actor.userId,
    };
  });
  return InvoiceItem.create(docs, sessionOptions(session));
}

async function createInvoiceFromCharges(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVOICES.CREATE]);
  const chargeIds = Array.isArray(payload.charge_ids) ? payload.charge_ids.filter(Boolean) : [];
  if (chargeIds.length === 0) throw createError('charge_ids không được rỗng.', 400);
  let invoiceId;
  await withOptionalTransaction(async (session) => {
    const charges = await withSession(Charge.find({ _id: { $in: chargeIds } }), session);
    if (charges.length !== chargeIds.length) throw createError('Một hoặc nhiều charge không tồn tại.', 404);
    const patientId = payload.patient_id || charges[0].patient_id;
    await assertPatientActive(patientId, session);
    await assertEncounterMatchesPatient(payload.encounter_id, patientId, session);
    await assertAdmissionMatchesPatient(payload.admission_id, patientId, session);
    const allowedStatuses = payload.allow_pending_charges
      ? [CHARGE_STATUS.POSTED, CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT]
      : [CHARGE_STATUS.POSTED];
    for (const charge of charges) {
      if (!sameId(charge.patient_id, patientId)) throw createError('Không thể gom charges của nhiều patient vào một invoice.', 409);
      if (payload.encounter_id && !sameId(charge.encounter_id, payload.encounter_id)) throw createError('Charge không thuộc encounter của invoice.', 409);
      if (payload.admission_id && !sameId(charge.admission_id, payload.admission_id)) throw createError('Charge không thuộc admission của invoice.', 409);
      if (actor.actorType === 'staff' && !hasGlobalBillingScope(actor)) {
        const scoped = await applyEncounterDepartmentScope({ encounter_id: charge.encounter_id }, actor, session);
        if (scoped.encounter_id?.$in && scoped.encounter_id.$in.length === 0) {
          throw createError('Bạn không có quyền tạo invoice từ charge ngoài khoa.', 403);
        }
      }
      if (charge.invoice_id) throw createError('Có charge đã thuộc invoice khác.', 409);
      if (!allowedStatuses.includes(charge.status)) {
        throw createError('Chỉ charge posted mới được đưa vào invoice, trừ khi allow_pending_charges=true.', 409);
      }
    }
    const subtotalAmount = charges.reduce((sum, charge) => sum + normalizeMoneyAmount(charge.total_amount || 0, 'charge.total_amount', { allowZero: true }), 0);
    const discountAmount = normalizeMoneyAmount(payload.discount_amount, 'discount_amount', { allowZero: true, defaultValue: 0 });
    const insuranceAmount = normalizeMoneyAmount(payload.insurance_amount, 'insurance_amount', { allowZero: true, defaultValue: 0 });
    const taxAmount = normalizeMoneyAmount(payload.tax_amount, 'tax_amount', { allowZero: true, defaultValue: 0 });
    const totalAmount = subtotalAmount - discountAmount - insuranceAmount + taxAmount;
    if (totalAmount < 0) throw createError('total_amount của invoice không được âm.', 400);
    const invoiceNo = payload.invoice_no || await generateInvoiceNumber({ session });
    const [invoice] = await Invoice.create([{
      patient_id: patientId,
      encounter_id: payload.encounter_id || charges.find((charge) => charge.encounter_id)?.encounter_id,
      admission_id: payload.admission_id || charges.find((charge) => charge.admission_id)?.admission_id,
      invoice_no: invoiceNo,
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      insurance_amount: insuranceAmount,
      total_amount: totalAmount,
      paid_amount: 0,
      balance_due: totalAmount,
      currency: normalizeString(payload.currency || 'VND').toUpperCase(),
      due_at: normalizeDate(payload.due_at, 'due_at'),
      status: INVOICE_STATUS.DRAFT,
      created_by: actor.userId,
      updated_by: actor.userId,
    }], sessionOptions(session));
    await createInvoiceItemsSnapshot(invoice, charges, actor, session);
    await Charge.updateMany(
      { _id: { $in: charges.map((charge) => charge._id) } },
      {
        $set: {
          invoice_id: invoice._id,
          status: CHARGE_STATUS.BILLED,
          billed_by: actor.userId,
          billed_at: new Date(),
          updated_by: actor.userId,
        },
      },
      sessionOptions(session),
    );
    invoiceId = invoice._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'invoices.create_from_charges',
    targetType: 'invoice',
    targetId: invoiceId,
    status: 'success',
    message: 'Tạo invoice từ charges thành công.',
    requestMeta,
    metadata: { charge_ids: chargeIds },
  });
  return getInvoiceDetail(invoiceId, actor);
}

async function issueInvoice(invoiceId, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVOICES.ISSUE]);
  let updatedInvoiceId;
  await withOptionalTransaction(async (session) => {
    const invoice = await withSession(Invoice.findById(invoiceId), session);
    if (!invoice) throw createError('Không tìm thấy invoice.', 404);
    await assertInvoiceDepartmentScope(invoice, actor, session);
    if (invoice.status !== INVOICE_STATUS.DRAFT) throw createError('Invoice phải draft trước khi issue.', 409);
    const items = await withSession(InvoiceItem.find({ invoice_id: invoice._id }), session);
    if (items.length === 0) throw createError('Không thể issue invoice rỗng.', 409);
    const subtotal = items.reduce((sum, item) => sum + normalizeMoneyAmount(item.line_total || 0, 'invoice_item.line_total', { allowZero: true }), 0);
    if (subtotal !== invoice.subtotal_amount) {
      throw createError('Subtotal invoice không khớp invoice_items.', 409);
    }
    const expectedTotal = invoice.subtotal_amount - invoice.discount_amount - invoice.insurance_amount + invoice.tax_amount;
    if (expectedTotal !== invoice.total_amount) {
      throw createError('Total invoice không khớp snapshot.', 409);
    }
    assertTransition(INVOICE_TRANSITIONS, invoice.status, INVOICE_STATUS.ISSUED, 'invoice');
    invoice.status = INVOICE_STATUS.ISSUED;
    invoice.issued_at = new Date();
    invoice.issued_by = actor.userId;
    invoice.updated_by = actor.userId;
    await invoice.save(sessionOptions(session));
    updatedInvoiceId = invoice._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'invoices.issue',
    targetType: 'invoice',
    targetId: updatedInvoiceId,
    status: 'success',
    message: 'Issue invoice thành công.',
    requestMeta,
  });
  return getInvoiceDetail(updatedInvoiceId, actor);
}

async function findConsultationServiceForEncounter(encounter, chargedAt = new Date()) {
  const effectiveFilter = buildEffectiveDateFilter(chargedAt);
  const services = await ServiceCatalog.find({
    service_type: SERVICE_TYPE.CONSULTATION,
    is_billable: true,
    is_deleted: false,
    status: SERVICE_STATUS.ACTIVE,
    $and: effectiveFilter.$and,
    $or: [
      { department_id: encounter.department_id },
      { department_id: { $exists: false } },
      { department_id: null },
    ],
  })
    .sort({ service_code: 1, service_name: 1 })
    .limit(20)
    .lean();

  return services.find((service) => sameId(service.department_id, encounter.department_id))
    || services.find((service) => !service.department_id)
    || services[0]
    || null;
}

async function createConsultationInvoiceForEncounter(encounterId, actor = {}, requestMeta = {}) {
  const systemActor = actorContext.isSystem(actor)
    ? actor
    : actorContext.buildSystemActor({
        serviceName: 'encounter-auto-billing',
        requestMeta,
      });
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter để tạo hóa đơn.', 404);

  const existingInvoice = await Invoice.findOne({
    encounter_id: encounter._id,
    status: { $nin: [INVOICE_STATUS.VOIDED, INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED] },
  })
    .sort({ issued_at: -1, created_at: -1 })
    .lean();
  if (existingInvoice) return getInvoiceDetail(existingInvoice._id, systemActor);

  const chargedAt = encounter.end_time || new Date();
  const existingCharge = await Charge.findOne({
    encounter_id: encounter._id,
    source_module: 'consultation',
    source_id: encounter._id,
    status: { $in: ACTIVE_CHARGE_STATUSES },
  }).lean();

  let charge = existingCharge;
  if (!charge) {
    const [service, doctorProfile] = await Promise.all([
      findConsultationServiceForEncounter(encounter, chargedAt),
      DoctorProfile.findOne({ user_id: encounter.attending_doctor_id, is_deleted: false })
        .select('consultation_fee specialty')
        .lean(),
    ]);
    const consultationFee = Number(doctorProfile?.consultation_fee || service?.unit_price || 220000);
    charge = await createCharge({
      patient_id: encounter.patient_id,
      encounter_id: encounter._id,
      service_id: service?._id,
      source_module: 'consultation',
      source_id: encounter._id,
      description: service?.service_name || `Phí khám ${doctorProfile?.specialty || 'bác sĩ'}`,
      quantity: 1,
      unit_price: consultationFee,
      charged_at: chargedAt,
      post_immediately: true,
    }, systemActor, requestMeta, { internal: true });
  }

  if (charge.invoice_id) return getInvoiceDetail(charge.invoice_id, systemActor);

  const invoice = await createInvoiceFromCharges({
    charge_ids: [String(charge._id || charge.id)],
    encounter_id: encounter._id,
    patient_id: encounter.patient_id,
    due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }, systemActor, requestMeta);
  const invoiceId = invoice?._id || invoice?.id || invoice?.invoice_id;
  return issueInvoice(invoiceId, systemActor, requestMeta);
}

async function ensureConsultationInvoicesForCompletedPatientEncounters(patientId, requestMeta = {}) {
  if (!patientId) return { created_count: 0, failed_count: 0 };
  const completedEncounters = await Encounter.find({
    patient_id: patientId,
    status: ENCOUNTER_STATUS.COMPLETED,
  })
    .select('_id')
    .sort({ end_time: -1, updated_at: -1, created_at: -1 })
    .limit(25)
    .lean();
  if (!completedEncounters.length) return { created_count: 0, failed_count: 0 };

  const encounterIds = completedEncounters.map((encounter) => encounter._id);
  const existingInvoiceEncounterIds = await Invoice.distinct('encounter_id', {
    encounter_id: { $in: encounterIds },
    status: { $nin: [INVOICE_STATUS.VOIDED, INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED] },
  });
  const existing = new Set(existingInvoiceEncounterIds.map((id) => String(id)));
  const missingEncounterIds = encounterIds.filter((id) => !existing.has(String(id)));
  if (!missingEncounterIds.length) return { created_count: 0, failed_count: 0 };

  const results = await Promise.allSettled(
    missingEncounterIds.map((encounterId) => createConsultationInvoiceForEncounter(encounterId, {}, requestMeta)),
  );
  return {
    created_count: results.filter((result) => result.status === 'fulfilled').length,
    failed_count: results.filter((result) => result.status === 'rejected').length,
  };
}

async function updateInvoiceBalance(invoiceId, actor = {}, session = null, options = {}) {
  const invoice = await withSession(Invoice.findById(invoiceId), session);
  if (!invoice) throw createError('Không tìm thấy invoice.', 404);
  if ([INVOICE_STATUS.VOIDED, INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED].includes(invoice.status) && !options.force) {
    return invoice;
  }
  const completedPayments = await withSession(Payment.find({
    invoice_id: invoice._id,
    status: PAYMENT_STATUS.COMPLETED,
  }).lean(), session);
  const completedPaymentIds = completedPayments.map((payment) => payment._id);
  let refundAggregate = PaymentRefund.aggregate([
    {
      $match: {
        payment_id: { $in: completedPaymentIds },
        refund_status: PAYMENT_REFUND_STATUS.PROCESSED,
      },
    },
    { $group: { _id: null, processed_amount: { $sum: '$processed_amount' } } },
  ]);
  if (session) refundAggregate = refundAggregate.session(session);
  const [refundTotals] = completedPaymentIds.length ? await refundAggregate : [];
  const completedAmount = completedPayments.reduce((sum, payment) => sum + normalizeMoneyAmount(payment.amount || 0, 'payment.amount', { allowZero: true }), 0);
  const processedRefundAmount = normalizeMoneyAmount(refundTotals?.processed_amount || 0, 'refund.processed_amount', { allowZero: true });
  const paidAmount = Math.max(0, completedAmount - processedRefundAmount);
  invoice.paid_amount = paidAmount;
  invoice.balance_due = calculateBalanceDue(invoice.total_amount, paidAmount);
  let nextStatus = invoice.status;
  if (invoice.total_amount === 0 || invoice.balance_due <= 0) {
    nextStatus = INVOICE_STATUS.PAID;
    invoice.balance_due = 0;
  } else if (paidAmount > 0) {
    nextStatus = INVOICE_STATUS.PARTIALLY_PAID;
  } else if ([INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID].includes(invoice.status)) {
    nextStatus = INVOICE_STATUS.ISSUED;
  }
  if (nextStatus !== invoice.status) {
    invoice.status = nextStatus;
  }
  invoice.updated_by = actor.userId;
  await invoice.save(sessionOptions(session));
  return invoice;
}

async function reserveInvoiceBalanceForCompletedPayment(invoiceId, amount, actor = {}, session = null) {
  const invoice = await withSession(Invoice.findOneAndUpdate(
    {
      _id: invoiceId,
      status: { $in: INVOICE_PAYABLE_STATUSES },
      balance_due: { $gte: amount },
    },
    {
      $inc: { paid_amount: amount, balance_due: -amount },
      $set: { updated_by: actor.userId },
    },
    { new: true },
  ), session);
  if (!invoice) throw createError('Payment amount không được vượt balance_due.', 409);
  const nextStatus = invoice.balance_due <= 0 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIALLY_PAID;
  if (invoice.status !== nextStatus) {
    assertTransition(INVOICE_TRANSITIONS, invoice.status, nextStatus, 'invoice');
    invoice.status = nextStatus;
    if (invoice.balance_due < 0) invoice.balance_due = 0;
    await invoice.save(sessionOptions(session));
  }
  return invoice;
}

async function voidInvoice(invoiceId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVOICES.VOID, PERMISSION.INVOICES.VOID_BY_POLICY, PERMISSION.INVOICES.CANCEL]);
  const reason = normalizeString(payload.reason || payload.void_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  await withOptionalTransaction(async (session) => {
    const invoice = await withSession(Invoice.findById(invoiceId), session);
    if (!invoice) throw createError('Không tìm thấy invoice.', 404);
    await assertInvoiceDepartmentScope(invoice, actor, session);
    if ([INVOICE_STATUS.VOIDED, INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED].includes(invoice.status)) {
      throw createError('Invoice đã ở trạng thái terminal.', 409);
    }
    const completedPayment = await withSession(Payment.exists({
      invoice_id: invoice._id,
      status: PAYMENT_STATUS.COMPLETED,
    }), session);
    if (completedPayment) throw createError('Invoice đã có payment completed. Cần refund/void payment trước khi void invoice.', 409);
    const nextStatus = payload.cancel === true ? INVOICE_STATUS.CANCELLED : INVOICE_STATUS.VOIDED;
    assertTransition(INVOICE_TRANSITIONS, invoice.status, nextStatus, 'invoice');
    invoice.status = nextStatus;
    invoice.voided_by = actor.userId;
    invoice.voided_at = new Date();
    invoice.void_reason = reason;
    invoice.void_category = normalizeString(payload.reason_category || payload.void_category);
    invoice.void_evidence_files = Array.isArray(payload.evidence_files || payload.void_evidence_files)
      ? (payload.evidence_files || payload.void_evidence_files)
      : invoice.void_evidence_files;
    invoice.void_notify_patient = Boolean(payload.notify_patient);
    invoice.replacement_invoice_id = payload.replacement_invoice_id || invoice.replacement_invoice_id;
    invoice.updated_by = actor.userId;
    await invoice.save(sessionOptions(session));
    if (payload.release_charges !== false) {
      await Charge.updateMany(
        { invoice_id: invoice._id, status: CHARGE_STATUS.BILLED },
        {
          $set: { status: CHARGE_STATUS.POSTED, updated_by: actor.userId },
          $unset: { invoice_id: '', billed_by: '', billed_at: '' },
        },
        sessionOptions(session),
      );
    }
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'invoices.void',
    targetType: 'invoice',
    targetId: invoiceId,
    status: 'success',
    message: 'Void invoice thành công.',
    requestMeta,
    metadata: { reason },
  });
  const detail = await getInvoiceDetail(invoiceId, actor);
  await publishBillingEvent({
    eventType: detail.status === INVOICE_STATUS.CANCELLED ? REALTIME_EVENT_TYPE.INVOICE_CANCELLED : REALTIME_EVENT_TYPE.INVOICE_VOIDED,
    aggregateType: 'invoice',
    aggregateId: invoiceId,
    actor,
    patientId: detail.patient_id?._id || detail.patient_id,
    requestMeta,
    payload: {
      invoice_id: String(invoiceId),
      invoice_no: detail.invoice_no,
      status: detail.status,
      reason,
    },
  });
  return detail;
}

async function listInvoices(query = {}, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id, PERMISSION.INVOICES.SELF_READ);
    await ensureConsultationInvoicesForCompletedPatientEncounters(actor.patientId || actor.patient_id);
  } else {
    assertStaffPermission(actor, [PERMISSION.INVOICES.READ]);
  }
  const { page, limit, skip } = getPagination(query);
  let filter = {};
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  const serviceTypes = normalizeServiceTypeQuery(query);
  if (serviceTypes.length > 0) {
    const services = await ServiceCatalog.find({ service_type: { $in: serviceTypes }, is_deleted: false }).select('_id').lean();
    const chargeFilter = {
      service_id: { $in: services.map((service) => service._id) },
      invoice_id: { $exists: true, $ne: null },
    };
    if (query.patient_id) chargeFilter.patient_id = query.patient_id;
    if (query.encounter_id) chargeFilter.encounter_id = query.encounter_id;
    if (query.admission_id) chargeFilter.admission_id = query.admission_id;
    if (query.order_id) chargeFilter.order_id = query.order_id;
    const invoiceIds = await Charge.distinct('invoice_id', chargeFilter);
    filter._id = { $in: invoiceIds };
  }
  if (query.payment_status || query.payment_state) {
    const paymentStatus = normalizeString(query.payment_state || query.payment_status);
    if (paymentStatus === 'unpaid') {
      filter.status = INVOICE_STATUS.ISSUED;
      filter.paid_amount = 0;
      filter.balance_due = { ...(filter.balance_due || {}), $gt: 0 };
    }
    if (paymentStatus === 'partial' || paymentStatus === 'partially_paid') {
      filter.status = INVOICE_STATUS.PARTIALLY_PAID;
      filter.balance_due = { ...(filter.balance_due || {}), $gt: 0 };
    }
    if (paymentStatus === 'paid') {
      filter.status = INVOICE_STATUS.PAID;
      filter.balance_due = 0;
    }
  }
  if (query.balance_due_gt !== undefined && query.balance_due_gt !== '') {
    filter.balance_due = { ...(typeof filter.balance_due === 'object' ? filter.balance_due : {}), $gt: normalizeMoneyAmount(query.balance_due_gt, 'balance_due_gt', { allowZero: true }) };
  }
  if (query.balance_due_lt !== undefined && query.balance_due_lt !== '') {
    filter.balance_due = { ...(typeof filter.balance_due === 'object' ? filter.balance_due : {}), $lt: normalizeMoneyAmount(query.balance_due_lt, 'balance_due_lt', { allowZero: true }) };
  }
  if (query.overdue === true || query.overdue === 'true') {
    filter.status = filter.status || { $in: INVOICE_PAYABLE_STATUSES };
    filter.balance_due = { ...(typeof filter.balance_due === 'object' ? filter.balance_due : {}), $gt: 0 };
    filter.due_at = { ...(filter.due_at || {}), $lt: new Date() };
  }
  if (query.due_before) {
    filter.due_at = { ...(filter.due_at || {}), $lte: normalizeDate(query.due_before, 'due_before') };
  }
  if (query.department_id) {
    if (actor.actorType === 'staff' && !hasGlobalBillingScope(actor) && !sameId(query.department_id, actorDepartmentId(actor))) {
      throw createError('Bạn không có quyền xem invoice ngoài khoa.', 403);
    }
    const encounters = await Encounter.find({ department_id: query.department_id }).select('_id').lean();
    const encounterIds = encounters.map((encounter) => encounter._id);
    if (filter.encounter_id) {
      filter.encounter_id = encounterIds.some((id) => sameId(id, filter.encounter_id)) ? filter.encounter_id : { $in: [] };
    } else {
      filter.encounter_id = { $in: encounterIds };
    }
  }
  if (query.date_from || query.date_to) {
    filter.issued_at = {};
    const from = normalizeDate(query.date_from, 'date_from');
    const to = normalizeDate(query.date_to, 'date_to');
    if (from) filter.issued_at.$gte = from;
    if (to) filter.issued_at.$lte = to;
  }
  const keyword = normalizeString(query.keyword || query.search || query.q);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const patients = await Patient.find({
      $or: [
        { patient_code: { $regex: pattern, $options: 'i' } },
        { full_name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
      ],
    }).select('_id').limit(200).lean();
    filter.$or = [
      { invoice_no: { $regex: pattern, $options: 'i' } },
      ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
    ];
  }
  filter = applyPatientScope(filter, actor, PERMISSION.INVOICES.SELF_READ);
  filter = await applyEncounterDepartmentScope(filter, actor);
  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ issued_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name')
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getInvoiceDetail(invoiceId, actor = {}, session = null) {
  const invoice = await withSession(Invoice.findById(invoiceId)
    .populate('patient_id', 'patient_code full_name phone gender date_of_birth national_id insurance_number')
    .populate({
      path: 'encounter_id',
      select: 'encounter_code encounter_type status start_time department_id attending_doctor_id',
      populate: [
        { path: 'department_id', select: 'department_code department_name' },
        { path: 'attending_doctor_id', select: 'full_name username employee_code' },
      ],
    })
    .populate({
      path: 'admission_id',
      select: 'admission_no admission_type status admitted_at department_id attending_doctor_id',
      populate: [
        { path: 'department_id', select: 'department_code department_name' },
        { path: 'attending_doctor_id', select: 'full_name username employee_code' },
      ],
    })
    .populate('issued_by', 'full_name username employee_code')
    .lean(), session);
  if (!invoice) throw createError('Không tìm thấy invoice.', 404);
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, invoice.patient_id?._id || invoice.patient_id, PERMISSION.INVOICES.SELF_READ);
  } else if (actor.actorType === 'staff') {
    assertStaffPermission(actor, [PERMISSION.INVOICES.READ]);
    await assertInvoiceDepartmentScope(invoice, actor, session);
  }
  const [items, payments, claims, paymentIntents] = await Promise.all([
    withSession(InvoiceItem.find({ invoice_id: invoice._id })
      .sort({ display_order: 1 })
      .populate('service_id', 'service_code service_name service_type')
      .populate({
        path: 'charge_id',
        select: 'charge_no order_id source_module source_id status total_amount charged_at posted_at voided_at',
        populate: { path: 'order_id', select: 'order_no order_type status priority ordered_at' },
      })
      .lean(), session),
    withSession(Payment.find({ invoice_id: invoice._id })
      .sort({ paid_at: -1, created_at: -1 })
      .lean(), session),
    withSession(InsuranceClaim.find({ invoice_id: invoice._id })
      .sort({ created_at: -1 })
      .lean(), session),
    withSession(PaymentIntent.find({ invoice_id: invoice._id })
      .sort({ created_at: -1 })
      .lean(), session),
  ]);
  const clinicalSources = items.reduce((acc, item) => {
    const charge = item.charge_id;
    const sourceOrder = charge?.order_id && typeof charge.order_id === 'object' ? charge.order_id : null;
    const serviceType = item.service_id?.service_type || sourceOrder?.order_type || charge?.source_module || 'other';
    if (CLINICAL_SERVICE_TYPES.includes(serviceType)) {
      acc.charge_count += 1;
      acc.total_amount += Number(item.line_total || 0);
      acc.by_service_type[serviceType] = (acc.by_service_type[serviceType] || 0) + Number(item.line_total || 0);
      if (sourceOrder?._id) {
        acc.orders.push({
          _id: sourceOrder._id,
          order_no: sourceOrder.order_no,
          order_type: sourceOrder.order_type,
          status: sourceOrder.status,
          priority: sourceOrder.priority,
          ordered_at: sourceOrder.ordered_at,
          charge_no: charge.charge_no,
          charge_status: charge.status,
        });
      }
    }
    return acc;
  }, { charge_count: 0, total_amount: 0, by_service_type: {}, orders: [] });
  const completedPaymentTotal = payments
    .filter((payment) => payment.status === PAYMENT_STATUS.COMPLETED)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return {
    ...invoice,
    items,
    payments,
    payment_intents: paymentIntents,
    insurance_claims: claims,
    clinical_sources: {
      ...clinicalSources,
      orders: Array.from(new Map(clinicalSources.orders.map((order) => [String(order._id), order])).values()),
    },
    reconciliation_status: {
      subtotal_matches_items: items.reduce((sum, item) => sum + Number(item.line_total || 0), 0) === invoice.subtotal_amount,
      paid_matches_completed_payments: completedPaymentTotal === invoice.paid_amount,
      has_payment_intent: paymentIntents.length > 0,
      has_submitted_receipt: paymentIntents.some((intent) => intent.status === PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT),
    },
  };
}

async function createPayment(invoiceId, payload = {}, actor = {}, requestMeta = {}, options = {}) {
  if (!options.internal) assertStaffPermission(actor, [PERMISSION.PAYMENTS.CREATE]);
  const amount = normalizeMoneyAmount(payload.amount, 'amount');
  const method = payload.payment_method || PAYMENT_METHOD.CASH;
  if (!PAYMENT_METHODS.includes(method)) throw createError('payment_method không hợp lệ.', 400);
  const paymentIntentId = payload.payment_intent_id || payload.paymentIntentId;
  const paymentProvider = normalizeString(payload.payment_provider || payload.provider);
  const provider = normalizeString(payload.provider);
  const providerMethod = normalizeString(payload.method);
  const providerTransactionId = normalizeString(payload.provider_transaction_id || payload.providerTransactionId);
  const idempotencyKey = normalizeString(payload.idempotency_key || payload.idempotencyKey);
  const transactionRef = normalizeString(payload.transaction_ref) || providerTransactionId;
  const transactionReference = normalizeString(payload.transaction_reference || payload.transactionReference);
  const receiptFileSize = payload.receipt_file_size === undefined && payload.receiptFileSize === undefined
    ? undefined
    : normalizePositiveNumber(payload.receipt_file_size ?? payload.receiptFileSize, 'receipt_file_size', { allowZero: true });
  const confirmedAt = normalizeDate(payload.confirmed_at, 'confirmed_at');
  const confirmedBy = payload.confirmed_by || payload.confirmedBy || actor.userId;
  const cashReceivedAmount = payload.cash_received_amount === undefined && payload.cashReceivedAmount === undefined
    ? undefined
    : normalizeMoneyAmount(payload.cash_received_amount ?? payload.cashReceivedAmount, 'cash_received_amount', { allowZero: true });
  const cashChangeAmount = payload.cash_change_amount === undefined && payload.cashChangeAmount === undefined
    ? (cashReceivedAmount === undefined ? undefined : normalizeMoneyAmount(cashReceivedAmount - amount, 'cash_change_amount', { allowZero: true }))
    : normalizeMoneyAmount(payload.cash_change_amount ?? payload.cashChangeAmount, 'cash_change_amount', { allowZero: true });
  if (cashReceivedAmount !== undefined && cashReceivedAmount < amount) {
    throw createError('cash_received_amount không được nhỏ hơn amount.', 400);
  }
  if (![PAYMENT_METHOD.CASH, PAYMENT_METHOD.OTHER].includes(method) && !transactionRef) {
    throw createError('transaction_ref là bắt buộc với phương thức thanh toán không phải cash.', 400);
  }
  let paymentId;
  let idempotentPayment = false;
  await withOptionalTransaction(async (session) => {
    const duplicateFilter = [];
    if (paymentIntentId) duplicateFilter.push({ payment_intent_id: paymentIntentId });
    if (paymentProvider && providerTransactionId) {
      duplicateFilter.push({ payment_provider: paymentProvider, provider_transaction_id: providerTransactionId });
    }
    if (idempotencyKey) duplicateFilter.push({ idempotency_key: idempotencyKey });
    if (duplicateFilter.length > 0) {
      const existingPayment = await withSession(Payment.findOne({
        $or: duplicateFilter,
        status: { $ne: PAYMENT_STATUS.VOIDED },
      }), session);
      if (existingPayment) {
        paymentId = existingPayment._id;
        idempotentPayment = true;
        return;
      }
    }
    const invoice = await withSession(Invoice.findById(invoiceId), session);
    if (!invoice) throw createError('Không tìm thấy invoice.', 404);
    if (!INVOICE_PAYABLE_STATUSES.includes(invoice.status)) {
      throw createError('Chỉ invoice issued/partially_paid mới được thanh toán.', 409);
    }
    await assertInvoiceDepartmentScope(invoice, actor, session);
    const paymentNo = payload.payment_no || await generatePaymentNumber({ session });
    const paymentStatus = payload.status || PAYMENT_STATUS.COMPLETED;
    if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.COMPLETED].includes(paymentStatus)) {
      throw createError('Payment mới chỉ được tạo ở pending/completed.', 409);
    }
    if (paymentStatus === PAYMENT_STATUS.COMPLETED) {
      await reserveInvoiceBalanceForCompletedPayment(invoice._id, amount, actor, session);
    }
    const [payment] = await Payment.create([{
      invoice_id: invoice._id,
      patient_id: invoice.patient_id,
      payment_intent_id: paymentIntentId ? toObjectId(paymentIntentId) : undefined,
      provider,
      method: providerMethod,
      payment_provider: paymentProvider,
      provider_transaction_id: providerTransactionId,
      idempotency_key: idempotencyKey,
      payment_no: paymentNo,
      amount,
      currency: invoice.currency,
      payment_method: method,
      intent_code: normalizeString(payload.intent_code || payload.intentCode),
      payment_note: normalizeString(payload.payment_note || payload.paymentNote),
      qr_image_url: normalizeString(payload.qr_image_url || payload.qrImageUrl),
      receipt_image_url: normalizeString(payload.receipt_image_url || payload.receiptImageUrl),
      receipt_file_name: normalizeString(payload.receipt_file_name || payload.receiptFileName),
      receipt_mime_type: normalizeString(payload.receipt_mime_type || payload.receiptMimeType),
      receipt_file_size: receiptFileSize,
      transaction_reference: transactionReference,
      transaction_ref: transactionRef,
      cash_received_amount: cashReceivedAmount,
      cash_change_amount: cashChangeAmount,
      cashier_shift_id: payload.cashier_shift_id || payload.cashierShiftId ? toObjectId(payload.cashier_shift_id || payload.cashierShiftId) : undefined,
      counter_id: normalizeString(payload.counter_id || payload.counterId),
      counter_code: normalizeString(payload.counter_code || payload.counterCode),
      payment_source: normalizeString(payload.payment_source || payload.paymentSource),
      collection_note: normalizeString(payload.collection_note || payload.collectionNote),
      receipt_print_requested: Boolean(payload.receipt_print_requested || payload.receiptPrintRequested || payload.print_receipt || payload.printReceipt),
      paid_at: normalizeDate(payload.paid_at, 'paid_at') || new Date(),
      received_by: actor.userId,
      confirmed_by: confirmedBy ? toObjectId(confirmedBy) : undefined,
      confirmed_at: confirmedAt,
      status: paymentStatus,
      note: normalizeString(payload.note),
      created_by: actor.userId,
      updated_by: actor.userId,
    }], sessionOptions(session));
    paymentId = payment._id;
  }, { fallbackToNoTransaction: false });
  if (!idempotentPayment) {
    await recordAuditLog({
      actor,
      action: 'payments.create',
      targetType: 'payment',
      targetId: paymentId,
      status: 'success',
      message: 'Tạo payment thành công.',
      requestMeta,
      metadata: { payment_intent_id: paymentIntentId ? String(paymentIntentId) : undefined, idempotency_key: idempotencyKey },
    });
  }
  const detail = await getPaymentDetail(paymentId, actor);
  await publishBillingEvent({
    eventType: REALTIME_EVENT_TYPE.PAYMENT_CREATED,
    aggregateType: 'payment',
    aggregateId: paymentId,
    actor,
    patientId: detail.patient_id?._id || detail.patient_id,
    requestMeta,
    payload: {
      payment_id: String(paymentId),
      payment_no: detail.payment_no,
      invoice_id: detail.invoice_id?._id || detail.invoice_id,
      amount: detail.amount,
      status: detail.status,
    },
  });
  return detail;
}

async function voidPayment(paymentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.PAYMENTS.CANCEL_PENDING, PERMISSION.PAYMENTS.REVERSE, PERMISSION.PAYMENTS.REFUND]);
  const reason = normalizeString(payload.reason || payload.void_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  await withOptionalTransaction(async (session) => {
    const payment = await withSession(Payment.findById(paymentId), session);
    if (!payment) throw createError('Không tìm thấy payment.', 404);
    const invoice = await withSession(Invoice.findById(payment.invoice_id), session);
    if (!invoice) throw createError('Không tìm thấy invoice của payment.', 404);
    await assertInvoiceDepartmentScope(invoice, actor, session);
    if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.COMPLETED].includes(payment.status)) {
      throw createError('Payment không ở trạng thái có thể void.', 409);
    }
    assertTransition(PAYMENT_TRANSITIONS, payment.status, PAYMENT_STATUS.VOIDED, 'payment');
    const voidedPayment = await withSession(Payment.findOneAndUpdate(
      { _id: payment._id, status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.COMPLETED] } },
      {
        $set: {
          status: PAYMENT_STATUS.VOIDED,
          voided_by: actor.userId,
          voided_at: new Date(),
          void_reason: reason,
          void_category: normalizeString(payload.reason_category || payload.void_category),
          void_type: normalizeString(payload.void_type) || (payment.status === PAYMENT_STATUS.COMPLETED ? 'reverse_completed' : 'void_pending'),
          void_evidence_files: Array.isArray(payload.evidence_files || payload.void_evidence_files) ? (payload.evidence_files || payload.void_evidence_files) : [],
          void_notify_patient: Boolean(payload.notify_patient),
          updated_by: actor.userId,
        },
      },
      { new: true },
    ), session);
    if (!voidedPayment) throw createError('Payment đã được void/refund bởi request khác.', 409);
    await updateInvoiceBalance(payment.invoice_id, actor, session);
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'payments.void',
    targetType: 'payment',
    targetId: paymentId,
    status: 'success',
    message: 'Void payment thành công.',
    requestMeta,
    metadata: { reason },
  });
  const detail = await getPaymentDetail(paymentId, actor);
  await publishBillingEvent({
    eventType: REALTIME_EVENT_TYPE.PAYMENT_VOIDED,
    aggregateType: 'payment',
    aggregateId: paymentId,
    actor,
    patientId: detail.patient_id?._id || detail.patient_id,
    requestMeta,
    payload: {
      payment_id: String(paymentId),
      payment_no: detail.payment_no,
      status: detail.status,
      reason,
    },
  });
  return detail;
}

async function refundPayment(paymentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.PAYMENTS.REFUND]);
  const reason = normalizeString(payload.reason || payload.refund_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  let refundId;
  let patientId;
  await withOptionalTransaction(async (session) => {
    const payment = await withSession(Payment.findById(paymentId), session);
    if (!payment) throw createError('Không tìm thấy payment.', 404);
    if (payment.status !== PAYMENT_STATUS.COMPLETED) throw createError('Chỉ payment completed mới được refund.', 409);
    const amount = normalizeMoneyAmount(payload.amount ?? payment.amount, 'amount');
    if (amount !== payment.amount) {
      throw createError('Phase hiện tại chỉ hỗ trợ refund toàn bộ payment. Refund một phần cần payment_refunds riêng.', 409);
    }
    const invoice = await withSession(Invoice.findById(payment.invoice_id), session);
    if (!invoice) throw createError('Không tìm thấy invoice của payment.', 404);
    await assertInvoiceDepartmentScope(invoice, actor, session);
    patientId = payment.patient_id;
    const wasPaid = invoice && invoice.status === INVOICE_STATUS.PAID;
    if (!payload.skip_refund_record) {
      const refundNo = payload.refund_no || await generateRefundNumber({ session });
      const [refund] = await PaymentRefund.create([{
        refund_no: refundNo,
        payment_id: payment._id,
        invoice_id: invoice._id,
        patient_id: payment.patient_id,
        original_payment_amount: payment.amount,
        requested_amount: amount,
        approved_amount: amount,
        processed_amount: amount,
        currency: payment.currency || invoice.currency || 'VND',
        refund_type: PAYMENT_REFUND_TYPE.FULL,
        refund_method: normalizeRefundMethod(payload.refund_method, payment),
        refund_status: PAYMENT_REFUND_STATUS.PROCESSED,
        request_source: normalizeRefundSource(payload.request_source, actor),
        reason_category: normalizeString(payload.reason_category),
        reason_detail: reason,
        requested_by: actorSnapshot(actor),
        requested_at: new Date(),
        approved_by: actor.userId,
        approved_at: new Date(),
        processed_by: actor.userId,
        processed_at: new Date(),
        payout_transaction_ref: normalizeString(payload.payout_transaction_ref || payload.transaction_ref),
        payout_provider: normalizeString(payload.payout_provider || payload.provider),
        payout_at: normalizeDate(payload.payout_at, 'payout_at'),
        created_by: actor.userId,
        updated_by: actor.userId,
      }], sessionOptions(session));
      appendRefundAuditLog(refund, 'refund.processed', actor, { reason, metadata: { direct_refund: true, processed_amount: amount } });
      await refund.save(sessionOptions(session));
      refundId = refund._id;
    }
    assertTransition(PAYMENT_TRANSITIONS, payment.status, PAYMENT_STATUS.REFUNDED, 'payment');
    const refundedPayment = await withSession(Payment.findOneAndUpdate(
      { _id: payment._id, status: PAYMENT_STATUS.COMPLETED },
      {
        $set: {
          status: PAYMENT_STATUS.REFUNDED,
          refunded_by: actor.userId,
          refunded_at: new Date(),
          refund_reason: reason,
          refund_status: 'processed',
          refund_amount: amount,
          updated_by: actor.userId,
        },
      },
      { new: true },
    ), session);
    if (!refundedPayment) throw createError('Payment đã được refund/void bởi request khác.', 409);
    const updatedInvoice = await updateInvoiceBalance(payment.invoice_id, actor, session, { force: true });
    if (wasPaid && updatedInvoice.paid_amount === 0) {
      updatedInvoice.status = INVOICE_STATUS.REFUNDED;
      updatedInvoice.balance_due = 0;
      await updatedInvoice.save(sessionOptions(session));
    }
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'payments.refund',
    targetType: 'payment',
    targetId: paymentId,
    status: 'success',
    message: 'Refund payment thành công.',
    requestMeta,
    metadata: { reason },
  });
  return getPaymentDetail(paymentId, actor);
}

async function listPayments(query = {}, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id, PERMISSION.PAYMENTS.SELF_READ);
  } else {
    assertStaffPermission(actor, [PERMISSION.PAYMENTS.READ]);
  }
  const { page, limit, skip } = getPagination(query);
  let filter = {};
  for (const field of ['invoice_id', 'patient_id', 'payment_method', 'payment_provider', 'provider', 'method', 'received_by', 'confirmed_by', 'refund_status', 'cashier_shift_id', 'counter_code']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.status) {
    const statuses = String(query.status).split(',').map((item) => item.trim()).filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  for (const field of ['payment_no', 'transaction_ref', 'transaction_reference', 'provider_transaction_id', 'intent_code']) {
    if (query[field]) filter[field] = { $regex: escapeRegex(query[field]), $options: 'i' };
  }
  for (const [field, minKey, maxKey] of [
    ['amount', 'amount_min', 'amount_max'],
    ['amount', 'min_amount', 'max_amount'],
  ]) {
    if (query[minKey] !== undefined && query[minKey] !== '') {
      filter[field] = { ...(filter[field] || {}), $gte: normalizeMoneyAmount(query[minKey], minKey, { allowZero: true }) };
    }
    if (query[maxKey] !== undefined && query[maxKey] !== '') {
      filter[field] = { ...(filter[field] || {}), $lte: normalizeMoneyAmount(query[maxKey], maxKey, { allowZero: true }) };
    }
  }
  for (const [field, fromKey, toKey] of [
    ['paid_at', 'paid_from', 'paid_to'],
    ['created_at', 'created_from', 'created_to'],
    ['confirmed_at', 'confirmed_from', 'confirmed_to'],
  ]) {
    if (query[fromKey] || query[toKey]) {
      filter[field] = { ...(filter[field] || {}) };
      const from = normalizeDate(query[fromKey], fromKey);
      const to = normalizeDate(query[toKey], toKey);
      if (from) filter[field].$gte = from;
      if (to) filter[field].$lte = to;
    }
  }
  if (query.has_receipt_file === 'true') filter.receipt_image_url = { $exists: true, $ne: null };
  if (query.has_receipt_file === 'false') {
    filter.$or = [
      ...(filter.$or || []),
      { receipt_image_url: { $exists: false } },
      { receipt_image_url: null },
    ];
  }
  if (query.has_transaction_ref === 'true') filter.transaction_ref = { $exists: true, $ne: null };
  if (query.has_transaction_ref === 'false') {
    filter.$or = [
      ...(filter.$or || []),
      { transaction_ref: { $exists: false } },
      { transaction_ref: null },
      { transaction_ref: '' },
    ];
  }
  if (query.invoice_no) {
    const invoices = await Invoice.find({ invoice_no: { $regex: escapeRegex(query.invoice_no), $options: 'i' } }).select('_id').limit(500).lean();
    filter.invoice_id = { $in: invoices.map((invoice) => invoice._id) };
  }
  if (query.patient_code || query.patient_name) {
    const pattern = escapeRegex(query.patient_code || query.patient_name);
    const patients = await Patient.find({
      $or: [
        { patient_code: { $regex: pattern, $options: 'i' } },
        { full_name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
      ],
    }).select('_id').limit(500).lean();
    filter.patient_id = { $in: patients.map((patient) => patient._id) };
  }
  const keyword = normalizeString(query.keyword || query.q || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const [patients, invoices] = await Promise.all([
      Patient.find({
        $or: [
          { patient_code: { $regex: pattern, $options: 'i' } },
          { full_name: { $regex: pattern, $options: 'i' } },
          { phone: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
      Invoice.find({ invoice_no: { $regex: pattern, $options: 'i' } }).select('_id').limit(500).lean(),
    ]);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { payment_no: { $regex: pattern, $options: 'i' } },
          { transaction_ref: { $regex: pattern, $options: 'i' } },
          { transaction_reference: { $regex: pattern, $options: 'i' } },
          { provider_transaction_id: { $regex: pattern, $options: 'i' } },
          { intent_code: { $regex: pattern, $options: 'i' } },
          { note: { $regex: pattern, $options: 'i' } },
          ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
          ...(invoices.length ? [{ invoice_id: { $in: invoices.map((invoice) => invoice._id) } }] : []),
        ],
      },
    ];
  }
  filter = applyPatientScope(filter, actor, PERMISSION.PAYMENTS.SELF_READ);
  filter = await applyInvoiceDepartmentScope(filter, actor);
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ paid_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('patient_id', 'patient_code full_name phone')
      .populate('payment_intent_id', 'intent_code status provider method payment_note qr_image_url receipt_image_url receipt_file_name receipt_mime_type receipt_file_size transaction_reference')
      .populate('received_by', 'full_name username employee_code')
      .populate('confirmed_by', 'full_name username employee_code')
      .lean(),
    Payment.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getPaymentDetail(paymentId, actor = {}) {
  const payment = await Payment.findById(paymentId)
    .populate('invoice_id', 'invoice_no status total_amount balance_due')
    .populate('patient_id', 'patient_code full_name')
    .lean();
  if (!payment) throw createError('Không tìm thấy payment.', 404);
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, payment.patient_id?._id || payment.patient_id, PERMISSION.PAYMENTS.SELF_READ);
  } else if (actor.actorType === 'staff') {
    assertStaffPermission(actor, [PERMISSION.PAYMENTS.READ]);
    if (payment.invoice_id?._id || payment.invoice_id) {
      const invoice = await Invoice.findById(payment.invoice_id?._id || payment.invoice_id).lean();
      if (invoice) await assertInvoiceDepartmentScope(invoice, actor);
    }
  }
  return payment;
}

async function buildPaymentRefundFilter(query = {}, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id, PERMISSION.PAYMENTS.SELF_READ);
  } else {
    assertStaffPermission(actor, [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND]);
  }
  let filter = {};
  for (const field of ['payment_id', 'invoice_id', 'patient_id', 'request_source', 'refund_type', 'refund_method', 'reason_category', 'approved_by', 'processed_by', 'reviewed_by']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.refund_status || query.status) {
    const statuses = String(query.refund_status || query.status).split(',').map((item) => item.trim()).filter(Boolean);
    filter.refund_status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (query.bucket) {
    const bucketStatusMap = {
      requests: [PAYMENT_REFUND_STATUS.REQUESTED],
      pending: [
        PAYMENT_REFUND_STATUS.REQUESTED,
        PAYMENT_REFUND_STATUS.UNDER_REVIEW,
        PAYMENT_REFUND_STATUS.APPROVED,
        PAYMENT_REFUND_STATUS.PROCESSING,
        PAYMENT_REFUND_STATUS.FAILED,
      ],
      processed: [
        PAYMENT_REFUND_STATUS.PROCESSED,
        PAYMENT_REFUND_STATUS.REJECTED,
        PAYMENT_REFUND_STATUS.CANCELLED,
      ],
    };
    if (bucketStatusMap[query.bucket]) filter.refund_status = { $in: bucketStatusMap[query.bucket] };
  }
  for (const [field, minKey, maxKey] of [
    ['requested_amount', 'amount_min', 'amount_max'],
    ['requested_amount', 'requested_amount_min', 'requested_amount_max'],
    ['processed_amount', 'processed_amount_min', 'processed_amount_max'],
    ['risk_score', 'risk_score_min', 'risk_score_max'],
  ]) {
    if (query[minKey] !== undefined && query[minKey] !== '') {
      const value = field === 'risk_score'
        ? normalizePositiveNumber(query[minKey], minKey, { allowZero: true })
        : normalizeMoneyAmount(query[minKey], minKey, { allowZero: true });
      filter[field] = { ...(filter[field] || {}), $gte: value };
    }
    if (query[maxKey] !== undefined && query[maxKey] !== '') {
      const value = field === 'risk_score'
        ? normalizePositiveNumber(query[maxKey], maxKey, { allowZero: true })
        : normalizeMoneyAmount(query[maxKey], maxKey, { allowZero: true });
      filter[field] = { ...(filter[field] || {}), $lte: value };
    }
  }
  for (const [field, fromKey, toKey] of [
    ['requested_at', 'date_from', 'date_to'],
    ['requested_at', 'requested_from', 'requested_to'],
    ['approved_at', 'approved_from', 'approved_to'],
    ['processed_at', 'processed_from', 'processed_to'],
  ]) {
    if (query[fromKey] || query[toKey]) {
      filter[field] = { ...(filter[field] || {}) };
      const from = normalizeDate(query[fromKey], fromKey);
      const to = normalizeDate(query[toKey], toKey);
      if (from) filter[field].$gte = from;
      if (to) filter[field].$lte = to;
    }
  }
  if (query.risk_flag) filter.risk_flags = query.risk_flag;
  const keyword = normalizeString(query.keyword || query.q || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const [patients, invoices, payments] = await Promise.all([
      Patient.find({
        $or: [
          { patient_code: { $regex: pattern, $options: 'i' } },
          { full_name: { $regex: pattern, $options: 'i' } },
          { phone: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
      Invoice.find({ invoice_no: { $regex: pattern, $options: 'i' } }).select('_id').limit(500).lean(),
      Payment.find({
        $or: [
          { payment_no: { $regex: pattern, $options: 'i' } },
          { transaction_ref: { $regex: pattern, $options: 'i' } },
          { transaction_reference: { $regex: pattern, $options: 'i' } },
          { provider_transaction_id: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
    ]);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { refund_no: { $regex: pattern, $options: 'i' } },
          { reason_detail: { $regex: pattern, $options: 'i' } },
          { payout_transaction_ref: { $regex: pattern, $options: 'i' } },
          ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
          ...(invoices.length ? [{ invoice_id: { $in: invoices.map((invoice) => invoice._id) } }] : []),
          ...(payments.length ? [{ payment_id: { $in: payments.map((payment) => payment._id) } }] : []),
        ],
      },
    ];
  }
  filter = applyPatientScope(filter, actor, PERMISSION.PAYMENTS.SELF_READ);
  filter = await applyInvoiceDepartmentScope(filter, actor);
  return filter;
}

function populateRefundQuery(query) {
  return query
    .populate('payment_id', 'payment_no status amount currency payment_method payment_provider provider transaction_ref transaction_reference provider_transaction_id paid_at receipt_image_url receipt_file_name confirmed_by received_by refund_status refund_amount')
    .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at')
    .populate('patient_id', 'patient_code full_name phone')
    .populate('reviewed_by', 'full_name username employee_code')
    .populate('approved_by', 'full_name username employee_code')
    .populate('processed_by', 'full_name username employee_code')
    .populate('rejected_by', 'full_name username employee_code')
    .populate('cancelled_by', 'full_name username employee_code');
}

async function listRefunds(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildPaymentRefundFilter(query, actor);
  const sort = query.sort === 'processed_at_desc'
    ? { processed_at: -1, requested_at: -1, created_at: -1 }
    : query.sort === 'risk_desc'
      ? { risk_score: -1, requested_at: 1 }
      : { requested_at: -1, created_at: -1 };
  const [items, total] = await Promise.all([
    populateRefundQuery(PaymentRefund.find(filter))
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    PaymentRefund.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getRefundDetail(refundId, actor = {}) {
  const refund = await populateRefundQuery(PaymentRefund.findById(refundId)).lean();
  if (!refund) throw createError('Không tìm thấy refund request.', 404);
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, refund.patient_id?._id || refund.patient_id, PERMISSION.PAYMENTS.SELF_READ);
  } else if (actor.actorType === 'staff') {
    assertStaffPermission(actor, [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND]);
    const invoice = await Invoice.findById(refund.invoice_id?._id || refund.invoice_id).lean();
    if (invoice) await assertInvoiceDepartmentScope(invoice, actor);
  }
  const [payment, invoice] = await Promise.all([
    Payment.findById(refund.payment_id?._id || refund.payment_id)
      .populate('received_by', 'full_name username employee_code')
      .populate('confirmed_by', 'full_name username employee_code')
      .lean(),
    Invoice.findById(refund.invoice_id?._id || refund.invoice_id).lean(),
  ]);
  return {
    ...refund,
    payment,
    invoice,
    audit_timeline: [
      ...(payment?.audit_logs || []).map((log) => ({ ...log, source: 'payment' })),
      ...(refund.audit_logs || []).map((log) => ({ ...log, source: 'refund' })),
    ].sort((left, right) => new Date(right.at || right.created_at || 0) - new Date(left.at || left.created_at || 0)),
  };
}

async function createRefundForPayment(paymentId, payload = {}, actor = {}, requestMeta = {}) {
  const actorType = actorContext.getActorType(actor) || actor.actorType;
  if (actorType === 'patient') {
    assertStaffPermission({ ...actor, actorType: 'staff', permissions: actor.permissions || [] }, [PERMISSION.PAYMENTS.REFUND_REQUEST], 'Tài khoản bệnh nhân không có quyền yêu cầu refund.');
  } else {
    assertStaffPermission(actor, [PERMISSION.PAYMENTS.REFUND, PERMISSION.PAYMENTS.READ]);
  }
  let refundId;
  await withOptionalTransaction(async (session) => {
    const payment = await withSession(Payment.findById(paymentId), session);
    if (!payment) throw createError('Không tìm thấy payment.', 404);
    if (actorType === 'patient') assertPatientSelf(actor, payment.patient_id, PERMISSION.PAYMENTS.REFUND_REQUEST);
    if (payment.status !== PAYMENT_STATUS.COMPLETED) throw createError('Chỉ payment completed mới được tạo refund request.', 409);
    const invoice = await withSession(Invoice.findById(payment.invoice_id), session);
    if (!invoice) throw createError('Không tìm thấy invoice của payment.', 404);
    if (actorType === 'staff') await assertInvoiceDepartmentScope(invoice, actor, session);
    const amount = normalizeMoneyAmount(payload.requested_amount ?? payload.refund_amount ?? payload.amount ?? payment.amount, 'requested_amount');
    if (amount > payment.amount) throw createError('requested_amount không được vượt payment amount.', 409);
    const usage = await getPaymentRefundUsage(payment._id, { session });
    if (amount + usage.requested_amount > payment.amount) {
      throw createError('Tổng số tiền refund đang yêu cầu/xử lý vượt payment amount.', 409);
    }
    const requestSource = normalizeRefundSource(payload.request_source || payload.source, actor);
    const risk = await buildRefundRisk(payment, invoice, { amount, requestSource, session });
    const refundNo = payload.refund_no || await generateRefundNumber({ session });
    const reason = normalizeString(payload.reason_detail || payload.reason || payload.refund_reason);
    const [refund] = await PaymentRefund.create([{
      refund_no: refundNo,
      payment_id: payment._id,
      invoice_id: invoice._id,
      patient_id: payment.patient_id,
      original_payment_amount: payment.amount,
      requested_amount: amount,
      approved_amount: undefined,
      processed_amount: 0,
      currency: payment.currency || invoice.currency || 'VND',
      refund_type: normalizeRefundType(payload.refund_type, amount, payment.amount),
      refund_method: normalizeRefundMethod(payload.refund_method, payment),
      refund_status: PAYMENT_REFUND_STATUS.REQUESTED,
      request_source: requestSource,
      reason_category: normalizeString(payload.reason_category || payload.category),
      reason_detail: reason,
      patient_bank_account: payload.patient_bank_account || payload.bank_account,
      receiver_name: normalizeString(payload.receiver_name),
      receiver_phone: normalizeString(payload.receiver_phone),
      requested_by: actorSnapshot(actor),
      requested_at: new Date(),
      evidence_files: Array.isArray(payload.evidence_files) ? payload.evidence_files : [],
      risk_score: risk.risk_score,
      risk_flags: risk.risk_flags,
      created_by: actor.userId,
      updated_by: actor.userId,
    }], sessionOptions(session));
    appendRefundAuditLog(refund, 'refund.requested', actor, { reason, metadata: { amount, request_source: requestSource } });
    await refund.save(sessionOptions(session));

    payment.refund_status = 'requested';
    payment.refund_amount = amount;
    payment.refund_reason = reason;
    payment.refund_requested_by = actorSnapshot(actor);
    payment.refund_requested_at = refund.requested_at;
    payment.updated_by = actor.userId;
    appendPaymentAuditLog(payment, 'payment.refund_requested', actor, { reason, metadata: { refund_id: refund._id, refund_no: refund.refund_no } });
    await payment.save(sessionOptions(session));
    refundId = refund._id;
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({
    actor,
    action: 'refund.requested',
    targetType: 'payment_refund',
    targetId: refundId,
    status: 'success',
    message: 'Tạo refund request thành công.',
    requestMeta,
    metadata: { payment_id: String(paymentId) },
  });
  const refund = await getRefundDetail(refundId, actor);
  await publishBillingEvent({
    eventType: REALTIME_EVENT_TYPE.REFUND_REQUESTED,
    aggregateType: 'payment_refund',
    aggregateId: refundId,
    actor,
    patientId: refund.patient_id?._id || refund.patient_id,
    requestMeta,
    payload: {
      refund_id: String(refundId),
      refund_no: refund.refund_no,
      payment_id: String(paymentId),
      refund_status: refund.refund_status,
      refund_amount: refund.requested_amount,
      notification: {
        title: 'Đã ghi nhận yêu cầu hoàn tiền',
        body: 'Yêu cầu hoàn tiền đã được gửi đến bộ phận thanh toán.',
        priority: 'normal',
      },
    },
  });
  return refund;
}

async function loadRefundForAction(refundId, actor = {}, session = null) {
  assertStaffPermission(actor, [PERMISSION.PAYMENTS.REFUND]);
  const refund = await withSession(PaymentRefund.findById(refundId), session);
  if (!refund) throw createError('Không tìm thấy refund request.', 404);
  const invoice = await withSession(Invoice.findById(refund.invoice_id), session);
  if (!invoice) throw createError('Không tìm thấy invoice của refund.', 404);
  await assertInvoiceDepartmentScope(invoice, actor, session);
  return { refund, invoice };
}

async function reviewRefund(refundId, payload = {}, actor = {}, requestMeta = {}) {
  await withOptionalTransaction(async (session) => {
    const { refund } = await loadRefundForAction(refundId, actor, session);
    if (![PAYMENT_REFUND_STATUS.REQUESTED, PAYMENT_REFUND_STATUS.FAILED].includes(refund.refund_status)) {
      throw createError('Refund không ở trạng thái có thể review.', 409);
    }
    refund.refund_status = PAYMENT_REFUND_STATUS.UNDER_REVIEW;
    refund.reviewed_by = actor.userId;
    refund.reviewed_at = new Date();
    refund.updated_by = actor.userId;
    appendRefundAuditLog(refund, 'refund.reviewed', actor, { reason: normalizeString(payload.note || payload.reason) });
    await refund.save(sessionOptions(session));
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'refund.reviewed', targetType: 'payment_refund', targetId: refundId, status: 'success', message: 'Review refund request thành công.', requestMeta });
  return getRefundDetail(refundId, actor);
}

async function approveRefund(refundId, payload = {}, actor = {}, requestMeta = {}) {
  let patientId;
  await withOptionalTransaction(async (session) => {
    const { refund } = await loadRefundForAction(refundId, actor, session);
    if (![PAYMENT_REFUND_STATUS.REQUESTED, PAYMENT_REFUND_STATUS.UNDER_REVIEW, PAYMENT_REFUND_STATUS.FAILED].includes(refund.refund_status)) {
      throw createError('Refund không ở trạng thái có thể approve.', 409);
    }
    const approvedAmount = normalizeMoneyAmount(payload.approved_amount ?? payload.amount ?? refund.requested_amount, 'approved_amount');
    if (approvedAmount <= 0 || approvedAmount > refund.requested_amount) throw createError('approved_amount không hợp lệ.', 400);
    refund.refund_status = PAYMENT_REFUND_STATUS.APPROVED;
    refund.approved_amount = approvedAmount;
    refund.approved_by = actor.userId;
    refund.approved_at = new Date();
    refund.updated_by = actor.userId;
    if (payload.approval_step) refund.approval_steps = [...(refund.approval_steps || []), payload.approval_step];
    appendRefundAuditLog(refund, 'refund.approved', actor, { reason: normalizeString(payload.reason || payload.note), metadata: { approved_amount: approvedAmount } });
    await refund.save(sessionOptions(session));

    await Payment.findByIdAndUpdate(refund.payment_id, {
      $set: {
        refund_status: legacyPaymentRefundStatus(PAYMENT_REFUND_STATUS.APPROVED),
        refund_amount: approvedAmount,
        refund_approved_by: actor.userId,
        updated_by: actor.userId,
      },
      $push: {
        audit_logs: {
          action: 'payment.refund_approved',
          ...actorSnapshot(actor),
          at: new Date(),
          metadata: { refund_id: refund._id, refund_no: refund.refund_no, approved_amount: approvedAmount },
        },
      },
    }, sessionOptions(session));
    patientId = refund.patient_id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'refund.approved', targetType: 'payment_refund', targetId: refundId, status: 'success', message: 'Approve refund thành công.', requestMeta });
  await publishBillingEvent({ eventType: REALTIME_EVENT_TYPE.REFUND_APPROVED, aggregateType: 'payment_refund', aggregateId: refundId, actor, patientId, requestMeta, payload: { refund_id: String(refundId) } });
  return getRefundDetail(refundId, actor);
}

async function rejectRefund(refundId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.reject_reason || payload.reason || payload.note);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  let patientId;
  await withOptionalTransaction(async (session) => {
    const { refund } = await loadRefundForAction(refundId, actor, session);
    if ([PAYMENT_REFUND_STATUS.PROCESSED, PAYMENT_REFUND_STATUS.REJECTED, PAYMENT_REFUND_STATUS.CANCELLED].includes(refund.refund_status)) {
      throw createError('Refund đã ở trạng thái terminal.', 409);
    }
    refund.refund_status = PAYMENT_REFUND_STATUS.REJECTED;
    refund.rejected_by = actor.userId;
    refund.rejected_at = new Date();
    refund.reject_reason = reason;
    refund.updated_by = actor.userId;
    appendRefundAuditLog(refund, 'refund.rejected', actor, { reason });
    await refund.save(sessionOptions(session));
    await Payment.findByIdAndUpdate(refund.payment_id, {
      $set: {
        refund_status: legacyPaymentRefundStatus(PAYMENT_REFUND_STATUS.REJECTED),
        updated_by: actor.userId,
      },
      $push: {
        audit_logs: {
          action: 'payment.refund_rejected',
          ...actorSnapshot(actor),
          at: new Date(),
          reason,
          metadata: { refund_id: refund._id, refund_no: refund.refund_no },
        },
      },
    }, sessionOptions(session));
    patientId = refund.patient_id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'refund.rejected', targetType: 'payment_refund', targetId: refundId, status: 'success', message: 'Reject refund thành công.', requestMeta, metadata: { reason } });
  await publishBillingEvent({ eventType: REALTIME_EVENT_TYPE.REFUND_REJECTED, aggregateType: 'payment_refund', aggregateId: refundId, actor, patientId, requestMeta, payload: { refund_id: String(refundId), reason } });
  return getRefundDetail(refundId, actor);
}

async function processRefund(refundId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.reason || payload.note || payload.payout_note);
  let patientId;
  await withOptionalTransaction(async (session) => {
    const { refund } = await loadRefundForAction(refundId, actor, session);
    if (![PAYMENT_REFUND_STATUS.REQUESTED, PAYMENT_REFUND_STATUS.UNDER_REVIEW, PAYMENT_REFUND_STATUS.APPROVED, PAYMENT_REFUND_STATUS.PROCESSING].includes(refund.refund_status)) {
      throw createError('Refund không ở trạng thái có thể process.', 409);
    }
    const payment = await withSession(Payment.findById(refund.payment_id), session);
    if (!payment) throw createError('Không tìm thấy payment của refund.', 404);
    if (![PAYMENT_STATUS.COMPLETED, PAYMENT_STATUS.REFUNDED].includes(payment.status)) {
      throw createError('Chỉ payment completed mới được process refund.', 409);
    }
    const processedAmount = normalizeMoneyAmount(payload.processed_amount ?? payload.amount ?? refund.approved_amount ?? refund.requested_amount, 'processed_amount');
    if (processedAmount <= 0) throw createError('processed_amount phải lớn hơn 0.', 400);
    const usage = await getPaymentRefundUsage(payment._id, { excludeRefundId: refund._id, session, statuses: [PAYMENT_REFUND_STATUS.PROCESSED] });
    if (usage.processed_amount + processedAmount > payment.amount) {
      throw createError('Tổng số tiền refund processed vượt payment amount.', 409);
    }
    refund.refund_status = PAYMENT_REFUND_STATUS.PROCESSED;
    refund.approved_amount = refund.approved_amount || processedAmount;
    refund.processed_amount = processedAmount;
    refund.processed_by = actor.userId;
    refund.processed_at = new Date();
    refund.payout_transaction_ref = normalizeString(payload.payout_transaction_ref || payload.transaction_ref) || refund.payout_transaction_ref;
    refund.payout_provider = normalizeString(payload.payout_provider || payload.provider) || refund.payout_provider;
    refund.payout_at = normalizeDate(payload.payout_at, 'payout_at') || refund.payout_at || new Date();
    refund.updated_by = actor.userId;
    appendRefundAuditLog(refund, 'refund.processed', actor, { reason, metadata: { processed_amount: processedAmount, payout_transaction_ref: refund.payout_transaction_ref } });
    await refund.save(sessionOptions(session));

    const cumulativeRefunded = usage.processed_amount + processedAmount;
    const fullRefund = cumulativeRefunded >= payment.amount;
    const wasPaid = await withSession(Invoice.exists({ _id: payment.invoice_id, status: INVOICE_STATUS.PAID }), session);
    payment.status = fullRefund ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.COMPLETED;
    payment.refund_status = legacyPaymentRefundStatus(PAYMENT_REFUND_STATUS.PROCESSED);
    payment.refund_amount = cumulativeRefunded;
    payment.refunded_by = actor.userId;
    payment.refunded_at = refund.processed_at;
    payment.refund_reason = refund.reason_detail || reason;
    payment.updated_by = actor.userId;
    appendPaymentAuditLog(payment, fullRefund ? 'payment.refunded' : 'payment.partially_refunded', actor, {
      reason,
      metadata: { refund_id: refund._id, refund_no: refund.refund_no, processed_amount: processedAmount, cumulative_refunded: cumulativeRefunded },
    });
    await payment.save(sessionOptions(session));

    const updatedInvoice = await updateInvoiceBalance(payment.invoice_id, actor, session, { force: true });
    if (fullRefund && wasPaid && updatedInvoice.paid_amount === 0) {
      updatedInvoice.status = INVOICE_STATUS.REFUNDED;
      updatedInvoice.balance_due = 0;
      updatedInvoice.updated_by = actor.userId;
      await updatedInvoice.save(sessionOptions(session));
    }
    patientId = refund.patient_id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'refund.processed', targetType: 'payment_refund', targetId: refundId, status: 'success', message: 'Process refund thành công.', requestMeta });
  await publishBillingEvent({ eventType: REALTIME_EVENT_TYPE.REFUND_PROCESSED, aggregateType: 'payment_refund', aggregateId: refundId, actor, patientId, requestMeta, payload: { refund_id: String(refundId) } });
  return getRefundDetail(refundId, actor);
}

async function markRefundPaid(refundId, payload = {}, actor = {}, requestMeta = {}) {
  const detail = await getRefundDetail(refundId, actor);
  if (detail.refund_status !== PAYMENT_REFUND_STATUS.PROCESSED) {
    return processRefund(refundId, payload, actor, requestMeta);
  }
  const payoutAt = normalizeDate(payload.payout_at, 'payout_at') || new Date();
  await PaymentRefund.findByIdAndUpdate(refundId, {
    $set: {
      payout_transaction_ref: normalizeString(payload.payout_transaction_ref || payload.transaction_ref) || detail.payout_transaction_ref,
      payout_provider: normalizeString(payload.payout_provider || payload.provider) || detail.payout_provider,
      payout_at: payoutAt,
      updated_by: actor.userId,
    },
    $push: {
      audit_logs: {
        action: 'refund.mark_paid',
        ...actorSnapshot(actor),
        at: new Date(),
        reason: normalizeString(payload.reason || payload.note),
      },
    },
  });
  await recordAuditLog({ actor, action: 'refund.mark_paid', targetType: 'payment_refund', targetId: refundId, status: 'success', message: 'Mark refund paid thành công.', requestMeta });
  return getRefundDetail(refundId, actor);
}

async function cancelRefund(refundId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.cancel_reason || payload.reason || payload.note);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  await withOptionalTransaction(async (session) => {
    const { refund } = await loadRefundForAction(refundId, actor, session);
    if ([PAYMENT_REFUND_STATUS.PROCESSED, PAYMENT_REFUND_STATUS.REJECTED, PAYMENT_REFUND_STATUS.CANCELLED].includes(refund.refund_status)) {
      throw createError('Refund đã ở trạng thái terminal.', 409);
    }
    refund.refund_status = PAYMENT_REFUND_STATUS.CANCELLED;
    refund.cancelled_by = actor.userId;
    refund.cancelled_at = new Date();
    refund.cancel_reason = reason;
    refund.updated_by = actor.userId;
    appendRefundAuditLog(refund, 'refund.cancelled', actor, { reason });
    await refund.save(sessionOptions(session));
    await Payment.findByIdAndUpdate(refund.payment_id, {
      $set: { refund_status: legacyPaymentRefundStatus(PAYMENT_REFUND_STATUS.CANCELLED), updated_by: actor.userId },
    }, sessionOptions(session));
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'refund.cancelled', targetType: 'payment_refund', targetId: refundId, status: 'success', message: 'Cancel refund thành công.', requestMeta, metadata: { reason } });
  return getRefundDetail(refundId, actor);
}

async function addRefundEvidence(refundId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.PAYMENTS.REFUND, PERMISSION.PAYMENTS.READ]);
  const files = Array.isArray(payload.evidence_files) ? payload.evidence_files : [payload].filter((item) => item.file_url || item.file_id || item.file_name);
  if (!files.length) throw createError('evidence_files là bắt buộc.', 400);
  const evidence = files.map((file) => ({
    file_id: file.file_id,
    file_url: normalizeString(file.file_url || file.url),
    file_name: normalizeString(file.file_name || file.name),
    file_type: normalizeString(file.file_type || file.mime_type),
    evidence_type: normalizeString(file.evidence_type || file.type),
    uploaded_by: actor.userId,
    uploaded_at: new Date(),
    note: normalizeString(file.note),
  }));
  const refund = await PaymentRefund.findByIdAndUpdate(refundId, {
    $push: {
      evidence_files: { $each: evidence },
      audit_logs: {
        action: 'refund.evidence_added',
        ...actorSnapshot(actor),
        at: new Date(),
        metadata: { evidence_count: evidence.length },
      },
    },
    $set: { updated_by: actor.userId },
  }, { new: true });
  if (!refund) throw createError('Không tìm thấy refund request.', 404);
  await recordAuditLog({ actor, action: 'refund.evidence_added', targetType: 'payment_refund', targetId: refundId, status: 'success', message: 'Thêm chứng từ refund thành công.', requestMeta, metadata: { evidence_count: evidence.length } });
  return getRefundDetail(refundId, actor);
}

async function getPaymentRefundPreview(paymentId, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id, PERMISSION.PAYMENTS.SELF_READ);
  } else {
    assertStaffPermission(actor, [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND]);
  }
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw createError('Không tìm thấy payment.', 404);
  if (actor.actorType === 'patient') assertPatientSelf(actor, payment.patient_id, PERMISSION.PAYMENTS.SELF_READ);
  const invoice = await Invoice.findById(payment.invoice_id).lean();
  if (!invoice) throw createError('Không tìm thấy invoice của payment.', 404);
  if (actor.actorType === 'staff') await assertInvoiceDepartmentScope(invoice, actor);
  const usage = await getPaymentRefundUsage(payment._id);
  const refundableAmount = Math.max(0, Number(payment.amount || 0) - Number(usage.processed_amount || 0) - Math.max(0, Number(usage.requested_amount || 0) - Number(usage.processed_amount || 0)));
  const risk = await buildRefundRisk(payment, invoice, { amount: refundableAmount, requestSource: normalizeRefundSource(null, actor) });
  const blockers = [];
  const warnings = [];
  if (payment.status !== PAYMENT_STATUS.COMPLETED) blockers.push({ code: 'PAYMENT_NOT_COMPLETED', message: 'Chỉ payment completed mới được refund.' });
  if (refundableAmount <= 0) blockers.push({ code: 'NO_REFUNDABLE_AMOUNT', message: 'Payment không còn số tiền có thể refund.' });
  if (risk.risk_flags.includes('same_payment_has_existing_refund')) warnings.push({ code: 'EXISTING_REFUND', message: 'Payment đã có refund request/processed.' });
  return {
    can_refund: blockers.length === 0,
    refundable_amount: refundableAmount,
    requested_or_processing_amount: Math.max(0, Number(usage.requested_amount || 0) - Number(usage.processed_amount || 0)),
    processed_refund_amount: usage.processed_amount,
    blockers,
    warnings,
    required_approvals: refundableAmount >= 5000000 ? ['accountant', 'finance_manager'] : ['accountant'],
    risk_score: risk.risk_score,
    risk_flags: risk.risk_flags,
    payment_before: {
      status: payment.status,
      amount: payment.amount,
      refund_status: payment.refund_status,
      refund_amount: payment.refund_amount || 0,
    },
    invoice_before: {
      status: invoice.status,
      paid_amount: invoice.paid_amount,
      balance_due: invoice.balance_due,
    },
  };
}

async function getPaymentVoidPreview(paymentId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.CANCEL_PENDING, PERMISSION.PAYMENTS.REVERSE, PERMISSION.PAYMENTS.REFUND]);
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw createError('Không tìm thấy payment.', 404);
  const invoice = await Invoice.findById(payment.invoice_id).lean();
  if (!invoice) throw createError('Không tìm thấy invoice của payment.', 404);
  await assertInvoiceDepartmentScope(invoice, actor);
  const blockers = [];
  const warnings = [];
  if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.COMPLETED].includes(payment.status)) blockers.push({ code: 'PAYMENT_NOT_VOIDABLE', message: 'Payment không ở trạng thái có thể void.' });
  if (payment.status === PAYMENT_STATUS.COMPLETED) warnings.push({ code: 'COMPLETED_PAYMENT', message: 'Payment đã completed, nên dùng refund/reversal nếu tiền đã thực nhận.' });
  const netPaidAfter = payment.status === PAYMENT_STATUS.COMPLETED ? Math.max(0, Number(invoice.paid_amount || 0) - Number(payment.amount || 0)) : Number(invoice.paid_amount || 0);
  return {
    can_void: blockers.length === 0,
    recommended_action: payment.status === PAYMENT_STATUS.PENDING ? 'void_pending' : 'reverse_completed',
    blocking_reasons: blockers,
    warnings,
    payment_before: {
      status: payment.status,
      amount: payment.amount,
      payment_method: payment.payment_method,
      transaction_ref: payment.transaction_ref || payment.transaction_reference,
    },
    payment_after: {
      status: PAYMENT_STATUS.VOIDED,
      amount: payment.amount,
    },
    invoice_before: {
      status: invoice.status,
      paid_amount: invoice.paid_amount,
      balance_due: invoice.balance_due,
    },
    invoice_after: {
      status: netPaidAfter <= 0 ? INVOICE_STATUS.ISSUED : INVOICE_STATUS.PARTIALLY_PAID,
      paid_amount: netPaidAfter,
      balance_due: Math.max(0, Number(invoice.total_amount || 0) - netPaidAfter),
    },
  };
}

async function getInvoiceVoidPreview(invoiceId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.INVOICES.READ, PERMISSION.INVOICES.VOID, PERMISSION.INVOICES.CANCEL]);
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw createError('Không tìm thấy invoice.', 404);
  await assertInvoiceDepartmentScope(invoice, actor);
  const [payments, chargeCount, billedChargeCount, claimCount] = await Promise.all([
    Payment.find({ invoice_id: invoice._id }).select('payment_no status amount payment_method paid_at').lean(),
    Charge.countDocuments({ invoice_id: invoice._id }),
    Charge.countDocuments({ invoice_id: invoice._id, status: CHARGE_STATUS.BILLED }),
    InsuranceClaim.countDocuments({ invoice_id: invoice._id }),
  ]);
  const completedPayments = payments.filter((payment) => payment.status === PAYMENT_STATUS.COMPLETED);
  const terminal = [INVOICE_STATUS.VOIDED, INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED].includes(invoice.status);
  const blockers = [];
  const warnings = [];
  if (terminal) blockers.push({ code: 'INVOICE_TERMINAL', message: 'Invoice đã ở trạng thái terminal.' });
  if (completedPayments.length) blockers.push({ code: 'HAS_COMPLETED_PAYMENT', message: 'Invoice đã có payment completed. Cần refund/void payment trước khi hủy invoice.' });
  if (claimCount > 0) warnings.push({ code: 'HAS_INSURANCE_CLAIM', message: 'Invoice có claim bảo hiểm, cần kiểm tra ảnh hưởng đối soát.' });
  return {
    can_void: blockers.length === 0,
    blocking_reasons: blockers,
    warnings,
    recommended_action: completedPayments.length ? 'refund_or_void_payment_first' : 'void_invoice',
    invoice_before: {
      status: invoice.status,
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount,
      balance_due: invoice.balance_due,
    },
    invoice_after: {
      status: INVOICE_STATUS.VOIDED,
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount,
      balance_due: invoice.balance_due,
    },
    payment_impact: {
      payment_count: payments.length,
      completed_payment_count: completedPayments.length,
      payments,
    },
    charge_release_preview: {
      charge_count: chargeCount,
      billed_charge_count: billedChargeCount,
      will_release_to_status: CHARGE_STATUS.POSTED,
    },
    claim_impact: { claim_count: claimCount },
  };
}

async function getRefundVoidSummary(query = {}, actor = {}) {
  const refundFilter = await buildPaymentRefundFilter(query, actor);
  const dateField = query.processed_only === 'true' ? 'processed_at' : 'requested_at';
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const todayFilter = { ...refundFilter, [dateField]: { $gte: todayStart, $lt: todayEnd } };

  let paymentVoidFilter = { status: PAYMENT_STATUS.VOIDED };
  let invoiceVoidFilter = { status: { $in: [INVOICE_STATUS.VOIDED, INVOICE_STATUS.CANCELLED] } };
  if (query.date_from || query.date_to) {
    const from = normalizeDate(query.date_from, 'date_from');
    const to = normalizeDate(query.date_to, 'date_to');
    paymentVoidFilter.voided_at = {};
    invoiceVoidFilter.voided_at = {};
    if (from) {
      paymentVoidFilter.voided_at.$gte = from;
      invoiceVoidFilter.voided_at.$gte = from;
    }
    if (to) {
      paymentVoidFilter.voided_at.$lte = to;
      invoiceVoidFilter.voided_at.$lte = to;
    }
  }
  paymentVoidFilter = await applyInvoiceDepartmentScope(paymentVoidFilter, actor);
  invoiceVoidFilter = await applyEncounterDepartmentScope(invoiceVoidFilter, actor);

  const [byStatus, totals, todayTotals, voidPaymentTotals, voidInvoiceTotals] = await Promise.all([
    PaymentRefund.aggregate([{ $match: refundFilter }, { $group: { _id: '$refund_status', count: { $sum: 1 }, amount: { $sum: '$requested_amount' }, processed_amount: { $sum: '$processed_amount' } } }]),
    PaymentRefund.aggregate([{ $match: refundFilter }, { $group: { _id: null, count: { $sum: 1 }, requested_amount: { $sum: '$requested_amount' }, processed_amount: { $sum: '$processed_amount' }, high_risk: { $sum: { $cond: [{ $gte: ['$risk_score', 60] }, 1, 0] } } } }]),
    PaymentRefund.aggregate([{ $match: todayFilter }, { $group: { _id: null, count: { $sum: 1 }, requested_amount: { $sum: '$requested_amount' }, processed_amount: { $sum: '$processed_amount' } } }]),
    Payment.aggregate([{ $match: paymentVoidFilter }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
    Invoice.aggregate([{ $match: invoiceVoidFilter }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$total_amount' } } }]),
  ]);
  const statusCounts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
  const total = totals[0] || {};
  const today = todayTotals[0] || {};
  const paymentVoid = voidPaymentTotals[0] || {};
  const invoiceVoid = voidInvoiceTotals[0] || {};
  return {
    refund_request_today: today.count || 0,
    refund_amount_pending: byStatus
      .filter((row) => [PAYMENT_REFUND_STATUS.REQUESTED, PAYMENT_REFUND_STATUS.UNDER_REVIEW, PAYMENT_REFUND_STATUS.APPROVED, PAYMENT_REFUND_STATUS.PROCESSING].includes(row._id))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    refund_processed_amount: total.processed_amount || 0,
    refund_count: total.count || 0,
    pending_count: (statusCounts[PAYMENT_REFUND_STATUS.REQUESTED] || 0) + (statusCounts[PAYMENT_REFUND_STATUS.UNDER_REVIEW] || 0) + (statusCounts[PAYMENT_REFUND_STATUS.APPROVED] || 0) + (statusCounts[PAYMENT_REFUND_STATUS.PROCESSING] || 0),
    processed_count: statusCounts[PAYMENT_REFUND_STATUS.PROCESSED] || 0,
    rejected_count: statusCounts[PAYMENT_REFUND_STATUS.REJECTED] || 0,
    high_risk_count: total.high_risk || 0,
    void_payment_count: paymentVoid.count || 0,
    void_payment_amount: paymentVoid.amount || 0,
    void_invoice_count: invoiceVoid.count || 0,
    void_invoice_amount: invoiceVoid.amount || 0,
    by_status: byStatus,
  };
}

async function getRefundVoidHistory(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND, PERMISSION.INVOICES.READ]);
  const { page, limit, skip } = getPagination(query);
  const refundFilter = await buildPaymentRefundFilter(query, actor);
  let paymentVoidFilter = { status: PAYMENT_STATUS.VOIDED };
  let invoiceVoidFilter = { status: { $in: [INVOICE_STATUS.VOIDED, INVOICE_STATUS.CANCELLED] } };
  if (query.event_type) {
    const eventTypes = String(query.event_type).split(',').map((item) => item.trim()).filter(Boolean);
    if (!eventTypes.some((type) => type.startsWith('refund.'))) refundFilter._id = { $in: [] };
    if (!eventTypes.includes('payment.voided')) paymentVoidFilter._id = { $in: [] };
    if (!eventTypes.some((type) => ['invoice.voided', 'invoice.cancelled'].includes(type))) invoiceVoidFilter._id = { $in: [] };
  }
  if (query.date_from || query.date_to) {
    const from = normalizeDate(query.date_from, 'date_from');
    const to = normalizeDate(query.date_to, 'date_to');
    paymentVoidFilter.voided_at = {};
    invoiceVoidFilter.voided_at = {};
    if (from) {
      paymentVoidFilter.voided_at.$gte = from;
      invoiceVoidFilter.voided_at.$gte = from;
    }
    if (to) {
      paymentVoidFilter.voided_at.$lte = to;
      invoiceVoidFilter.voided_at.$lte = to;
    }
  }
  paymentVoidFilter = await applyInvoiceDepartmentScope(paymentVoidFilter, actor);
  invoiceVoidFilter = await applyEncounterDepartmentScope(invoiceVoidFilter, actor);
  const fetchLimit = Math.min(300, skip + limit);
  const [refunds, voidPayments, voidInvoices] = await Promise.all([
    populateRefundQuery(PaymentRefund.find(refundFilter)).sort({ updated_at: -1, created_at: -1 }).limit(fetchLimit).lean(),
    Payment.find(paymentVoidFilter)
      .sort({ voided_at: -1, updated_at: -1 })
      .limit(fetchLimit)
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due')
      .populate('patient_id', 'patient_code full_name phone')
      .populate('voided_by', 'full_name username employee_code')
      .lean(),
    Invoice.find(invoiceVoidFilter)
      .sort({ voided_at: -1, updated_at: -1 })
      .limit(fetchLimit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('voided_by', 'full_name username employee_code')
      .lean(),
  ]);
  const items = [
    ...refunds.map((refund) => ({
      id: refund._id || refund.id,
      event_type: `refund.${refund.refund_status}`,
      target_type: 'payment_refund',
      target_no: refund.refund_no,
      target_id: refund._id || refund.id,
      patient: refund.patient_id,
      payment: refund.payment_id,
      invoice: refund.invoice_id,
      amount: refund.processed_amount || refund.approved_amount || refund.requested_amount,
      actor: refund.processed_by || refund.approved_by || refund.reviewed_by || refund.rejected_by || refund.requested_by,
      reason: refund.reject_reason || refund.reason_detail,
      before_status: null,
      after_status: refund.refund_status,
      evidence_count: refund.evidence_files?.length || 0,
      risk_score: refund.risk_score || 0,
      happened_at: refund.processed_at || refund.approved_at || refund.reviewed_at || refund.rejected_at || refund.requested_at || refund.updated_at,
      raw: refund,
    })),
    ...voidPayments.map((payment) => ({
      id: payment._id || payment.id,
      event_type: 'payment.voided',
      target_type: 'payment',
      target_no: payment.payment_no,
      target_id: payment._id || payment.id,
      patient: payment.patient_id,
      payment,
      invoice: payment.invoice_id,
      amount: payment.amount,
      actor: payment.voided_by,
      reason: payment.void_reason,
      before_status: PAYMENT_STATUS.COMPLETED,
      after_status: PAYMENT_STATUS.VOIDED,
      evidence_count: 0,
      happened_at: payment.voided_at || payment.updated_at,
      raw: payment,
    })),
    ...voidInvoices.map((invoice) => ({
      id: invoice._id || invoice.id,
      event_type: invoice.status === INVOICE_STATUS.CANCELLED ? 'invoice.cancelled' : 'invoice.voided',
      target_type: 'invoice',
      target_no: invoice.invoice_no,
      target_id: invoice._id || invoice.id,
      patient: invoice.patient_id,
      invoice,
      amount: invoice.total_amount,
      actor: invoice.voided_by,
      reason: invoice.void_reason,
      before_status: null,
      after_status: invoice.status,
      evidence_count: 0,
      happened_at: invoice.voided_at || invoice.updated_at,
      raw: invoice,
    })),
  ].sort((left, right) => new Date(right.happened_at || 0) - new Date(left.happened_at || 0));
  return {
    items: items.slice(skip, skip + limit),
    pagination: buildPagination(page, limit, items.length),
  };
}

async function createInsurancePolicy(patientId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_POLICIES.CREATE, PERMISSION.INSURANCE_POLICIES.CREATE_BASIC]);
  await assertPatientActive(patientId);
  const policyNo = normalizeString(payload.policy_no);
  if (!policyNo) throw createError('policy_no là bắt buộc.', 400);
  const validFrom = normalizeDate(payload.valid_from, 'valid_from');
  const validTo = normalizeDate(payload.valid_to, 'valid_to');
  assertDateRange(validFrom, validTo, 'Hiệu lực insurance policy');
  const coveragePercent = payload.coverage_percent === undefined || payload.coverage_percent === null
    ? undefined
    : normalizePositiveNumber(payload.coverage_percent, 'coverage_percent', { allowZero: true });
  if (coveragePercent !== undefined && coveragePercent > 100) throw createError('coverage_percent phải từ 0 đến 100.', 400);
  let policyId;
  await withOptionalTransaction(async (session) => {
    const duplicate = await withSession(InsurancePolicy.exists({ patient_id: patientId, policy_no: policyNo, is_deleted: false }), session);
    if (duplicate) throw createError('Policy number đã tồn tại cho patient này.', 409);
    if (payload.is_primary) {
      await InsurancePolicy.updateMany({ patient_id: patientId, is_deleted: false }, { $set: { is_primary: false } }, sessionOptions(session));
    }
    const [policy] = await InsurancePolicy.create([{
      patient_id: patientId,
      payer_name: normalizeString(payload.payer_name),
      payer_code: normalizeString(payload.payer_code),
      policy_no: policyNo,
      member_no: normalizeString(payload.member_no),
      coverage_type: normalizeString(payload.coverage_type),
      coverage_percent: coveragePercent,
      valid_from: validFrom,
      valid_to: validTo,
      is_primary: Boolean(payload.is_primary),
      status: payload.status || INSURANCE_POLICY_STATUS.ACTIVE,
      created_by: actor.userId,
      updated_by: actor.userId,
    }], sessionOptions(session));
    policyId = policy._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'insurance_policy.create',
    targetType: 'insurance_policy',
    targetId: policyId,
    status: 'success',
    message: 'Tạo insurance policy thành công.',
    requestMeta,
  });
  return getInsurancePolicyDetail(policyId, actor);
}

async function listInsurancePolicies(patientId, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, patientId, PERMISSION.INSURANCE_POLICIES.SELF_READ);
  } else {
    assertStaffPermission(actor, [PERMISSION.INSURANCE_POLICIES.READ]);
  }
  return InsurancePolicy.find({ patient_id: patientId, is_deleted: false })
    .sort({ is_primary: -1, valid_to: -1, created_at: -1 })
    .lean();
}

async function buildInsurancePolicyFilter(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_POLICIES.READ]);
  const filter = { is_deleted: false };
  for (const field of ['patient_id', 'payer_code', 'coverage_type', 'verification_status', 'status', 'source']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.payer_name) filter.payer_name = { $regex: escapeRegex(query.payer_name), $options: 'i' };
  if (query.policy_no) filter.policy_no = { $regex: escapeRegex(query.policy_no), $options: 'i' };
  if (query.member_no) filter.member_no = { $regex: escapeRegex(query.member_no), $options: 'i' };
  if (query.is_primary !== undefined && query.is_primary !== '') {
    filter.is_primary = query.is_primary === true || query.is_primary === 'true';
  }
  if (query.coverage_percent_min !== undefined && query.coverage_percent_min !== '') {
    filter.coverage_percent = {
      ...(filter.coverage_percent || {}),
      $gte: normalizePositiveNumber(query.coverage_percent_min, 'coverage_percent_min', { allowZero: true }),
    };
  }
  if (query.coverage_percent_max !== undefined && query.coverage_percent_max !== '') {
    filter.coverage_percent = {
      ...(filter.coverage_percent || {}),
      $lte: normalizePositiveNumber(query.coverage_percent_max, 'coverage_percent_max', { allowZero: true }),
    };
  }
  if (query.valid_from || query.valid_to) {
    filter.valid_to = { ...(filter.valid_to || {}) };
    const from = normalizeDate(query.valid_from, 'valid_from');
    const to = normalizeDate(query.valid_to, 'valid_to');
    if (from) filter.valid_to.$gte = from;
    if (to) filter.valid_to.$lte = to;
  }
  if (query.expiring_within_days) {
    const days = normalizePositiveInteger(query.expiring_within_days, 'expiring_within_days', { allowZero: true });
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400000);
    filter.status = filter.status || INSURANCE_POLICY_STATUS.ACTIVE;
    filter.valid_to = { ...(filter.valid_to || {}), $gte: now, $lte: until };
  }
  if (query.has_front_card === 'true') filter.front_card_attachment_id = { $exists: true, $ne: null };
  if (query.has_front_card === 'false') filter.$or = [...(filter.$or || []), { front_card_attachment_id: { $exists: false } }, { front_card_attachment_id: null }];
  if (query.has_back_card === 'true') filter.back_card_attachment_id = { $exists: true, $ne: null };
  if (query.has_back_card === 'false') filter.$or = [...(filter.$or || []), { back_card_attachment_id: { $exists: false } }, { back_card_attachment_id: null }];
  if (query.has_any_card === 'true') {
    filter.$or = [
      ...(filter.$or || []),
      { front_card_attachment_id: { $exists: true, $ne: null } },
      { back_card_attachment_id: { $exists: true, $ne: null } },
    ];
  }
  if (query.missing_card === 'true') {
    filter.$or = [
      ...(filter.$or || []),
      { front_card_attachment_id: { $exists: false } },
      { front_card_attachment_id: null },
      { back_card_attachment_id: { $exists: false } },
      { back_card_attachment_id: null },
    ];
  }
  const keyword = normalizeString(query.keyword || query.q || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const patients = await Patient.find({
      $or: [
        { patient_code: { $regex: pattern, $options: 'i' } },
        { full_name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
      ],
    }).select('_id').limit(500).lean();
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { payer_name: { $regex: pattern, $options: 'i' } },
          { payer_code: { $regex: pattern, $options: 'i' } },
          { policy_no: { $regex: pattern, $options: 'i' } },
          { member_no: { $regex: pattern, $options: 'i' } },
          ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
        ],
      },
    ];
  }
  return filter;
}

async function listAllInsurancePolicies(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildInsurancePolicyFilter(query, actor);
  const sort = query.sort === 'valid_to_asc'
    ? { valid_to: 1, created_at: -1 }
    : { submitted_at: -1, created_at: -1 };
  const [items, total] = await Promise.all([
    InsurancePolicy.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
      .populate('reviewed_by', 'full_name username employee_code email')
      .populate('front_card_attachment_id', 'file_name original_name mime_type storage_path file_url status review_status scan_status')
      .populate('back_card_attachment_id', 'file_name original_name mime_type storage_path file_url status review_status scan_status')
      .lean(),
    InsurancePolicy.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getInsurancePolicySummary(query = {}, actor = {}) {
  const filter = await buildInsurancePolicyFilter(query, actor);
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 86400000);
  const inThirtyDays = new Date(now.getTime() + 30 * 86400000);
  const [byStatus, byVerification, bySource, byPayer, expiring7, expiring30, missingCard, total] = await Promise.all([
    InsurancePolicy.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    InsurancePolicy.aggregate([{ $match: filter }, { $group: { _id: '$verification_status', count: { $sum: 1 } } }]),
    InsurancePolicy.aggregate([{ $match: filter }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    InsurancePolicy.aggregate([
      { $match: filter },
      { $group: { _id: '$payer_name', count: { $sum: 1 }, verified_count: { $sum: { $cond: [{ $eq: ['$verification_status', INSURANCE_VERIFICATION_STATUS.VERIFIED] }, 1, 0] } } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
    InsurancePolicy.countDocuments({ ...filter, status: INSURANCE_POLICY_STATUS.ACTIVE, valid_to: { $gte: now, $lte: inSevenDays } }),
    InsurancePolicy.countDocuments({ ...filter, status: INSURANCE_POLICY_STATUS.ACTIVE, valid_to: { $gte: now, $lte: inThirtyDays } }),
    InsurancePolicy.countDocuments({
      ...filter,
      $or: [
        { front_card_attachment_id: { $exists: false } },
        { front_card_attachment_id: null },
        { back_card_attachment_id: { $exists: false } },
        { back_card_attachment_id: null },
      ],
    }),
    InsurancePolicy.countDocuments(filter),
  ]);
  const statusCounts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
  const verificationCounts = Object.fromEntries(byVerification.map((row) => [row._id, row.count]));
  const sourceCounts = Object.fromEntries(bySource.map((row) => [row._id, row.count]));
  return {
    total_policies: total,
    active: statusCounts[INSURANCE_POLICY_STATUS.ACTIVE] || 0,
    inactive: statusCounts[INSURANCE_POLICY_STATUS.INACTIVE] || 0,
    expired: statusCounts[INSURANCE_POLICY_STATUS.EXPIRED] || 0,
    cancelled: statusCounts[INSURANCE_POLICY_STATUS.CANCELLED] || 0,
    verified: verificationCounts[INSURANCE_VERIFICATION_STATUS.VERIFIED] || 0,
    submitted: verificationCounts[INSURANCE_VERIFICATION_STATUS.SUBMITTED] || 0,
    rejected: verificationCounts[INSURANCE_VERIFICATION_STATUS.REJECTED] || 0,
    patient_submitted: sourceCounts.patient_submitted || 0,
    staff_created: sourceCounts.staff_created || 0,
    by_status: byStatus,
    by_verification: byVerification,
    by_source: bySource,
    by_payer: byPayer.map((row) => ({ payer_name: row._id || 'Không rõ', count: row.count, verified_count: row.verified_count })),
    expiring_7_days: expiring7,
    expiring_30_days: expiring30,
    missing_card_image: missingCard,
  };
}

async function getInsurancePolicyDetail(policyId, actor = {}) {
  const policy = await InsurancePolicy.findOne({ _id: policyId, is_deleted: false })
    .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
    .populate('reviewed_by', 'full_name username employee_code email')
    .populate('front_card_attachment_id', 'file_name original_name mime_type storage_path file_url status review_status scan_status')
    .populate('back_card_attachment_id', 'file_name original_name mime_type storage_path file_url status review_status scan_status')
    .lean();
  if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
  if (actor.actorType === 'patient') assertPatientSelf(actor, policy.patient_id?._id || policy.patient_id, PERMISSION.INSURANCE_POLICIES.SELF_READ);
  else if (actor.actorType === 'staff') assertStaffPermission(actor, [PERMISSION.INSURANCE_POLICIES.READ]);
  return policy;
}

async function updateInsurancePolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_POLICIES.UPDATE]);
  let updatedId;
  await withOptionalTransaction(async (session) => {
    const policy = await withSession(InsurancePolicy.findOne({ _id: policyId, is_deleted: false }), session);
    if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
    if (payload.is_primary === true) {
      await InsurancePolicy.updateMany(
        { patient_id: policy.patient_id, _id: { $ne: policy._id }, is_deleted: false },
        { $set: { is_primary: false } },
        sessionOptions(session),
      );
      policy.is_primary = true;
    }
    if (payload.payer_name !== undefined) policy.payer_name = normalizeString(payload.payer_name);
    if (payload.payer_code !== undefined) policy.payer_code = normalizeString(payload.payer_code);
    if (payload.member_no !== undefined) policy.member_no = normalizeString(payload.member_no);
    if (payload.coverage_type !== undefined) policy.coverage_type = normalizeString(payload.coverage_type);
    if (payload.coverage_percent !== undefined) {
      policy.coverage_percent = normalizePositiveNumber(payload.coverage_percent, 'coverage_percent', { allowZero: true });
      if (policy.coverage_percent > 100) throw createError('coverage_percent phải từ 0 đến 100.', 400);
    }
    if (payload.valid_from !== undefined) policy.valid_from = normalizeDate(payload.valid_from, 'valid_from');
    if (payload.valid_to !== undefined) policy.valid_to = normalizeDate(payload.valid_to, 'valid_to');
    assertDateRange(policy.valid_from, policy.valid_to, 'Hiệu lực insurance policy');
    if (payload.status !== undefined) policy.status = payload.status;
    policy.updated_by = actor.userId;
    await policy.save(sessionOptions(session));
    updatedId = policy._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'insurance_policy.update',
    targetType: 'insurance_policy',
    targetId: updatedId,
    status: 'success',
    message: 'Cập nhật insurance policy thành công.',
    requestMeta,
  });
  return getInsurancePolicyDetail(updatedId, actor);
}

async function attachInsurancePolicyCard(policyId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_POLICIES.UPDATE, PERMISSION.ATTACHMENTS.UPLOAD_INSURANCE]);
  const attachmentId = payload.attachment_id || payload.attachmentId;
  const side = normalizeString(payload.side || payload.card_side || payload.cardSide);
  if (!attachmentId) throw createError('attachment_id là bắt buộc.', 400);
  if (!['front', 'back'].includes(side)) throw createError('side phải là front hoặc back.', 422);
  const policy = await InsurancePolicy.findOne({ _id: policyId, is_deleted: false });
  if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
  const attachment = await Attachment.findOne({ _id: attachmentId, patient_id: policy.patient_id }).lean();
  if (!attachment) throw createError('Không tìm thấy attachment thẻ bảo hiểm của patient.', 404);
  if (side === 'front') policy.front_card_attachment_id = attachment._id;
  if (side === 'back') policy.back_card_attachment_id = attachment._id;
  policy.updated_by = actor.userId;
  await policy.save();
  await recordAuditLog({
    actor,
    action: 'insurance_policy.attach_card',
    targetType: 'insurance_policy',
    targetId: policy._id,
    status: 'success',
    message: 'Gắn ảnh thẻ bảo hiểm cho policy thành công.',
    requestMeta,
    metadata: { attachment_id: String(attachment._id), side },
  });
  return getInsurancePolicyDetail(policy._id, actor);
}

async function cancelInsurancePolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_POLICIES.DEACTIVATE, PERMISSION.INSURANCE_POLICIES.UPDATE]);
  const reason = normalizeString(payload.reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const policy = await InsurancePolicy.findOne({ _id: policyId, is_deleted: false });
  if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
  policy.status = INSURANCE_POLICY_STATUS.CANCELLED;
  policy.updated_by = actor.userId;
  await policy.save();
  await recordAuditLog({
    actor,
    action: 'insurance_policy.cancel',
    targetType: 'insurance_policy',
    targetId: policy._id,
    status: 'success',
    message: 'Cancel insurance policy thành công.',
    requestMeta,
    metadata: { reason },
  });
  return getInsurancePolicyDetail(policy._id, actor);
}

function assertPolicyEffective(policy, date = new Date()) {
  if (policy.status !== INSURANCE_POLICY_STATUS.ACTIVE) throw createError('Insurance policy không active.', 409);
  if (policy.valid_from && policy.valid_from > date) throw createError('Insurance policy chưa hiệu lực.', 409);
  if (policy.valid_to && policy.valid_to < date) throw createError('Insurance policy đã hết hiệu lực.', 409);
}

async function createInsuranceClaim(invoiceId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.CREATE]);
  let claimId;
  await withOptionalTransaction(async (session) => {
    const invoice = await withSession(Invoice.findById(invoiceId), session);
    if (!invoice) throw createError('Không tìm thấy invoice.', 404);
    await assertInvoiceDepartmentScope(invoice, actor, session);
    if (!INVOICE_CLAIMABLE_STATUSES.includes(invoice.status)) throw createError('Invoice chưa ở trạng thái claimable.', 409);
    const policy = await withSession(InsurancePolicy.findOne({ _id: payload.policy_id, is_deleted: false }), session);
    if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
    if (!sameId(policy.patient_id, invoice.patient_id)) throw createError('Policy không thuộc patient của invoice.', 409);
    assertPolicyEffective(policy, invoice.issued_at || new Date());
    const duplicate = await withSession(InsuranceClaim.exists({
      invoice_id: invoice._id,
      policy_id: policy._id,
      status: { $in: ACTIVE_CLAIM_STATUSES },
    }), session);
    if (duplicate) throw createError('Invoice/policy đã có claim active.', 409);
    const defaultSubmitted = policy.coverage_percent !== undefined && policy.coverage_percent !== null
      ? Math.round(invoice.total_amount * Number(policy.coverage_percent) / 100)
      : invoice.total_amount;
    const submittedAmount = normalizeMoneyAmount(payload.submitted_amount ?? defaultSubmitted, 'submitted_amount');
    if (submittedAmount > invoice.total_amount) throw createError('submitted_amount không được vượt total_amount invoice.', 409);
    const claimNo = payload.claim_no || await generateClaimNumber({ session });
    const [claim] = await InsuranceClaim.create([{
      policy_id: policy._id,
      patient_id: invoice.patient_id,
      invoice_id: invoice._id,
      claim_no: claimNo,
      submitted_amount: submittedAmount,
      approved_amount: 0,
      paid_amount: 0,
      external_claim_ref: normalizeString(payload.external_claim_ref),
      status: INSURANCE_CLAIM_STATUS.DRAFT,
      created_by: actor.userId,
      updated_by: actor.userId,
    }], sessionOptions(session));
    claimId = claim._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'insurance_claim.create',
    targetType: 'insurance_claim',
    targetId: claimId,
    status: 'success',
    message: 'Tạo insurance claim thành công.',
    requestMeta,
  });
  return getInsuranceClaimDetail(claimId, actor);
}

async function transitionClaim(claimId, nextStatus, payload = {}, actor = {}, requestMeta = {}) {
  let updatedId;
  await withOptionalTransaction(async (session) => {
    const claim = await withSession(InsuranceClaim.findById(claimId), session);
    if (!claim) throw createError('Không tìm thấy insurance claim.', 404);
    const invoiceForScope = await withSession(Invoice.findById(claim.invoice_id), session);
    if (invoiceForScope) await assertInvoiceDepartmentScope(invoiceForScope, actor, session);
    assertTransition(INSURANCE_CLAIM_TRANSITIONS, claim.status, nextStatus, 'insurance claim');
    if (nextStatus === INSURANCE_CLAIM_STATUS.APPROVED || nextStatus === INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED) {
      const approvedAmount = normalizeMoneyAmount(payload.approved_amount, 'approved_amount', { allowZero: true });
      if (approvedAmount > claim.submitted_amount) throw createError('approved_amount không được vượt submitted_amount.', 409);
      claim.approved_amount = approvedAmount;
      claim.approved_at = new Date();
      claim.reviewed_by = actor.userId;
      claim.external_claim_ref = normalizeString(payload.external_claim_ref || claim.external_claim_ref);
      claim.status = approvedAmount >= claim.submitted_amount
        ? INSURANCE_CLAIM_STATUS.APPROVED
        : INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED;
    } else if (nextStatus === INSURANCE_CLAIM_STATUS.REJECTED) {
      const reason = normalizeString(payload.reason || payload.rejection_reason);
      if (!reason) throw createError('reason là bắt buộc.', 400);
      claim.status = INSURANCE_CLAIM_STATUS.REJECTED;
      claim.rejection_reason = reason;
      claim.reviewed_by = actor.userId;
    } else if (nextStatus === INSURANCE_CLAIM_STATUS.CANCELLED) {
      const reason = normalizeString(payload.reason || payload.cancel_reason);
      if (!reason) throw createError('reason là bắt buộc.', 400);
      claim.status = INSURANCE_CLAIM_STATUS.CANCELLED;
      claim.cancelled_by = actor.userId;
      claim.cancelled_at = new Date();
      claim.cancel_reason = reason;
    } else {
      claim.status = nextStatus;
      if (nextStatus === INSURANCE_CLAIM_STATUS.SUBMITTED) claim.submitted_at = new Date();
    }
    claim.updated_by = actor.userId;
    await claim.save(sessionOptions(session));
    updatedId = claim._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: `insurance_claim.${nextStatus}`,
    targetType: 'insurance_claim',
    targetId: updatedId,
    status: 'success',
    message: 'Cập nhật insurance claim thành công.',
    requestMeta,
  });
  return getInsuranceClaimDetail(updatedId, actor);
}

async function submitClaim(claimId, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.SUBMIT]);
  return transitionClaim(claimId, INSURANCE_CLAIM_STATUS.SUBMITTED, {}, actor, requestMeta);
}

async function markClaimUnderReview(claimId, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.MARK_UNDER_REVIEW, PERMISSION.INSURANCE_CLAIMS.UPDATE]);
  return transitionClaim(claimId, INSURANCE_CLAIM_STATUS.UNDER_REVIEW, {}, actor, requestMeta);
}

async function approveClaim(claimId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.APPROVE, PERMISSION.INSURANCE_CLAIMS.PARTIALLY_APPROVE]);
  return transitionClaim(claimId, INSURANCE_CLAIM_STATUS.APPROVED, payload, actor, requestMeta);
}

async function rejectClaim(claimId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.REJECT]);
  return transitionClaim(claimId, INSURANCE_CLAIM_STATUS.REJECTED, payload, actor, requestMeta);
}

async function settleClaim(claimId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.SETTLE]);
  const paidAmount = normalizeMoneyAmount(payload.paid_amount, 'paid_amount');
  let paymentId;
  await withOptionalTransaction(async (session) => {
    const claim = await withSession(InsuranceClaim.findById(claimId), session);
    if (!claim) throw createError('Không tìm thấy insurance claim.', 404);
    if (![INSURANCE_CLAIM_STATUS.APPROVED, INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED].includes(claim.status)) {
      throw createError('Claim phải approved/partially_approved trước khi settle.', 409);
    }
    const remainingApproved = claim.approved_amount - claim.paid_amount;
    if (paidAmount > remainingApproved) throw createError('paid_amount không được vượt approved_amount còn lại.', 409);
    const invoice = await withSession(Invoice.findById(claim.invoice_id), session);
    if (!invoice) throw createError('Không tìm thấy invoice của claim.', 404);
    await assertInvoiceDepartmentScope(invoice, actor, session);
    await reserveInvoiceBalanceForCompletedPayment(invoice._id, paidAmount, actor, session);
    const updatedClaim = await withSession(InsuranceClaim.findOneAndUpdate(
      {
        _id: claim._id,
        status: { $in: [INSURANCE_CLAIM_STATUS.APPROVED, INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED] },
        $expr: { $gte: [{ $subtract: ['$approved_amount', '$paid_amount'] }, paidAmount] },
      },
      {
        $inc: { paid_amount: paidAmount },
        $set: { updated_by: actor.userId },
      },
      { new: true },
    ), session);
    if (!updatedClaim) throw createError('paid_amount không được vượt approved_amount còn lại.', 409);
    if (updatedClaim.paid_amount >= updatedClaim.approved_amount) {
      assertTransition(INSURANCE_CLAIM_TRANSITIONS, updatedClaim.status, INSURANCE_CLAIM_STATUS.SETTLED, 'insurance claim');
      updatedClaim.status = INSURANCE_CLAIM_STATUS.SETTLED;
      updatedClaim.settled_at = normalizeDate(payload.settled_at, 'settled_at') || new Date();
      updatedClaim.updated_by = actor.userId;
      await updatedClaim.save(sessionOptions(session));
    }
    const paymentNo = payload.payment_no || await generatePaymentNumber({ session });
    const [payment] = await Payment.create([{
      invoice_id: invoice._id,
      patient_id: invoice.patient_id,
      insurance_claim_id: claim._id,
      payment_no: paymentNo,
      amount: paidAmount,
      currency: invoice.currency,
      payment_method: PAYMENT_METHOD.INSURANCE,
      transaction_ref: normalizeString(payload.transaction_ref || payload.external_claim_ref || claim.external_claim_ref),
      paid_at: normalizeDate(payload.settled_at, 'settled_at') || new Date(),
      received_by: actor.userId,
      status: PAYMENT_STATUS.COMPLETED,
      note: normalizeString(payload.note || `Insurance claim ${claim.claim_no}`),
      created_by: actor.userId,
      updated_by: actor.userId,
    }], sessionOptions(session));
    paymentId = payment._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'insurance_claim.settle',
    targetType: 'insurance_claim',
    targetId: claimId,
    status: 'success',
    message: 'Settle insurance claim thành công.',
    requestMeta,
    metadata: { payment_id: paymentId },
  });
  return getInsuranceClaimDetail(claimId, actor);
}

async function cancelClaim(claimId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.CANCEL, PERMISSION.INSURANCE_CLAIMS.MANAGE]);
  return transitionClaim(claimId, INSURANCE_CLAIM_STATUS.CANCELLED, payload, actor, requestMeta);
}

async function updateInsuranceClaim(claimId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.UPDATE]);
  let updatedId;
  await withOptionalTransaction(async (session) => {
    const claim = await withSession(InsuranceClaim.findById(claimId), session);
    if (!claim) throw createError('Không tìm thấy insurance claim.', 404);
    if (![INSURANCE_CLAIM_STATUS.DRAFT, INSURANCE_CLAIM_STATUS.SUBMITTED].includes(claim.status)) {
      throw createError('Chỉ claim draft/submitted được cập nhật thông tin cơ bản.', 409);
    }
    const invoice = await withSession(Invoice.findById(claim.invoice_id), session);
    if (invoice) await assertInvoiceDepartmentScope(invoice, actor, session);
    if (payload.policy_id !== undefined && !sameId(payload.policy_id, claim.policy_id)) {
      const policy = await withSession(InsurancePolicy.findOne({ _id: payload.policy_id, is_deleted: false }), session);
      if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
      if (!sameId(policy.patient_id, claim.patient_id)) throw createError('Policy không thuộc patient của claim.', 409);
      if (invoice) assertPolicyEffective(policy, invoice.issued_at || new Date());
      claim.policy_id = policy._id;
    }
    if (payload.submitted_amount !== undefined) {
      const submittedAmount = normalizeMoneyAmount(payload.submitted_amount, 'submitted_amount', { allowZero: true });
      if (invoice && submittedAmount > invoice.total_amount) throw createError('submitted_amount không được vượt total_amount invoice.', 409);
      claim.submitted_amount = submittedAmount;
    }
    if (payload.external_claim_ref !== undefined) claim.external_claim_ref = normalizeString(payload.external_claim_ref);
    claim.updated_by = actor.userId;
    await claim.save(sessionOptions(session));
    updatedId = claim._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'insurance_claim.update',
    targetType: 'insurance_claim',
    targetId: updatedId,
    status: 'success',
    message: 'Cập nhật insurance claim thành công.',
    requestMeta,
  });
  return getInsuranceClaimDetail(updatedId, actor);
}

async function buildInsuranceClaimFilter(query = {}, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id, PERMISSION.INSURANCE_CLAIMS.SELF_READ);
  } else {
    assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.READ]);
  }
  const filter = {};
  for (const field of ['policy_id', 'patient_id', 'invoice_id']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.status) {
    const statuses = String(query.status).split(',').map((item) => item.trim()).filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (query.claim_no) filter.claim_no = { $regex: escapeRegex(query.claim_no), $options: 'i' };
  if (query.external_claim_ref) filter.external_claim_ref = { $regex: escapeRegex(query.external_claim_ref), $options: 'i' };
  for (const [field, minKey, maxKey] of [
    ['submitted_amount', 'min_submitted_amount', 'max_submitted_amount'],
    ['approved_amount', 'min_approved_amount', 'max_approved_amount'],
    ['paid_amount', 'min_paid_amount', 'max_paid_amount'],
  ]) {
    if (query[minKey] !== undefined && query[minKey] !== '') {
      filter[field] = { ...(filter[field] || {}), $gte: normalizeMoneyAmount(query[minKey], minKey, { allowZero: true }) };
    }
    if (query[maxKey] !== undefined && query[maxKey] !== '') {
      filter[field] = { ...(filter[field] || {}), $lte: normalizeMoneyAmount(query[maxKey], maxKey, { allowZero: true }) };
    }
  }
  for (const [field, fromKey, toKey] of [
    ['submitted_at', 'submitted_from', 'submitted_to'],
    ['approved_at', 'approved_from', 'approved_to'],
    ['settled_at', 'settled_from', 'settled_to'],
  ]) {
    if (query[fromKey] || query[toKey]) {
      filter[field] = { ...(filter[field] || {}) };
      const from = normalizeDate(query[fromKey], fromKey);
      const to = normalizeDate(query[toKey], toKey);
      if (from) filter[field].$gte = from;
      if (to) filter[field].$lte = to;
    }
  }
  if (query.has_outstanding === 'true') {
    filter.$expr = { $gt: ['$approved_amount', '$paid_amount'] };
  }
  const keyword = normalizeString(query.keyword || query.q || query.search);
  const policyQuery = {};
  if (query.payer_name) policyQuery.payer_name = { $regex: escapeRegex(query.payer_name), $options: 'i' };
  if (query.payer_code) policyQuery.payer_code = query.payer_code;
  if (query.policy_no) policyQuery.policy_no = { $regex: escapeRegex(query.policy_no), $options: 'i' };
  if (Object.keys(policyQuery).length) {
    const policies = await InsurancePolicy.find({ ...policyQuery, is_deleted: false }).select('_id').limit(1000).lean();
    filter.policy_id = { $in: policies.map((policy) => policy._id) };
  }
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const [patients, invoices, policies] = await Promise.all([
      Patient.find({
        $or: [
          { patient_code: { $regex: pattern, $options: 'i' } },
          { full_name: { $regex: pattern, $options: 'i' } },
          { phone: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
      Invoice.find({ invoice_no: { $regex: pattern, $options: 'i' } }).select('_id').limit(500).lean(),
      InsurancePolicy.find({
        is_deleted: false,
        $or: [
          { payer_name: { $regex: pattern, $options: 'i' } },
          { payer_code: { $regex: pattern, $options: 'i' } },
          { policy_no: { $regex: pattern, $options: 'i' } },
          { member_no: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
    ]);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { claim_no: { $regex: pattern, $options: 'i' } },
          { external_claim_ref: { $regex: pattern, $options: 'i' } },
          ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
          ...(invoices.length ? [{ invoice_id: { $in: invoices.map((invoice) => invoice._id) } }] : []),
          ...(policies.length ? [{ policy_id: { $in: policies.map((policy) => policy._id) } }] : []),
        ],
      },
    ];
  }
  if (actor.actorType === 'patient') filter.patient_id = actor.patientId || actor.patient_id;
  return applyInvoiceDepartmentScope(filter, actor);
}

async function listInsuranceClaims(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildInsuranceClaimFilter(query, actor);
  const sort = query.sort === 'approved_at_desc'
    ? { approved_at: -1, created_at: -1 }
    : query.sort === 'settled_at_desc'
      ? { settled_at: -1, created_at: -1 }
      : { submitted_at: -1, created_at: -1 };
  const [items, total] = await Promise.all([
    InsuranceClaim.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('policy_id', 'payer_name payer_code policy_no member_no coverage_percent verification_status status')
      .populate('patient_id', 'patient_code full_name phone')
      .lean(),
    InsuranceClaim.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getInsuranceClaimSummary(query = {}, actor = {}) {
  const filter = await buildInsuranceClaimFilter(query, actor);
  const [byStatus, totals, byPayer] = await Promise.all([
    InsuranceClaim.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 }, submitted_amount: { $sum: '$submitted_amount' }, approved_amount: { $sum: '$approved_amount' }, paid_amount: { $sum: '$paid_amount' } } }]),
    InsuranceClaim.aggregate([{ $match: filter }, { $group: { _id: null, count: { $sum: 1 }, submitted_amount: { $sum: '$submitted_amount' }, approved_amount: { $sum: '$approved_amount' }, paid_amount: { $sum: '$paid_amount' } } }]),
    InsuranceClaim.aggregate([
      { $match: filter },
      { $lookup: { from: 'insurance_policies', localField: 'policy_id', foreignField: '_id', as: 'policy' } },
      { $unwind: { path: '$policy', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$policy.payer_name', count: { $sum: 1 }, submitted_amount: { $sum: '$submitted_amount' }, approved_amount: { $sum: '$approved_amount' }, paid_amount: { $sum: '$paid_amount' } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
  ]);
  const total = totals[0] || { count: 0, submitted_amount: 0, approved_amount: 0, paid_amount: 0 };
  const statusCounts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
  return {
    total_claims: total.count,
    draft: statusCounts[INSURANCE_CLAIM_STATUS.DRAFT] || 0,
    submitted: statusCounts[INSURANCE_CLAIM_STATUS.SUBMITTED] || 0,
    under_review: statusCounts[INSURANCE_CLAIM_STATUS.UNDER_REVIEW] || 0,
    approved: statusCounts[INSURANCE_CLAIM_STATUS.APPROVED] || 0,
    partially_approved: statusCounts[INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED] || 0,
    rejected: statusCounts[INSURANCE_CLAIM_STATUS.REJECTED] || 0,
    settled: statusCounts[INSURANCE_CLAIM_STATUS.SETTLED] || 0,
    cancelled: statusCounts[INSURANCE_CLAIM_STATUS.CANCELLED] || 0,
    submitted_amount_total: total.submitted_amount || 0,
    approved_amount_total: total.approved_amount || 0,
    paid_amount_total: total.paid_amount || 0,
    by_status: byStatus,
    total,
    outstanding_amount: Math.max(0, Number(total.approved_amount || 0) - Number(total.paid_amount || 0)),
    by_payer: byPayer.map((row) => ({ payer_name: row._id || 'Không rõ', count: row.count, submitted_amount: row.submitted_amount, approved_amount: row.approved_amount, paid_amount: row.paid_amount })),
  };
}

async function getInsuranceClaimReadiness(claimId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.READ]);
  const claim = await InsuranceClaim.findById(claimId).lean();
  if (!claim) throw createError('Không tìm thấy insurance claim.', 404);
  const [invoice, policy] = await Promise.all([
    Invoice.findById(claim.invoice_id).lean(),
    InsurancePolicy.findOne({ _id: claim.policy_id, is_deleted: false }).lean(),
  ]);
  if (invoice) await assertInvoiceDepartmentScope(invoice, actor);
  const blockers = [];
  const warnings = [];
  if (!invoice) blockers.push({ code: 'INVOICE_NOT_FOUND', message: 'Không tìm thấy invoice.' });
  if (!policy) blockers.push({ code: 'POLICY_NOT_FOUND', message: 'Không tìm thấy policy.' });
  if (invoice && !INVOICE_CLAIMABLE_STATUSES.includes(invoice.status)) blockers.push({ code: 'INVOICE_NOT_CLAIMABLE', message: 'Invoice chưa ở trạng thái claimable.' });
  if (policy) {
    if (policy.status !== INSURANCE_POLICY_STATUS.ACTIVE) blockers.push({ code: 'POLICY_NOT_ACTIVE', message: 'Policy không active.' });
    if (policy.verification_status !== INSURANCE_VERIFICATION_STATUS.VERIFIED) blockers.push({ code: 'POLICY_NOT_VERIFIED', message: 'Policy chưa được xác minh.' });
    if (policy.valid_from && invoice?.issued_at && policy.valid_from > invoice.issued_at) blockers.push({ code: 'POLICY_NOT_EFFECTIVE', message: 'Policy chưa hiệu lực tại ngày invoice.' });
    if (policy.valid_to && policy.valid_to < (invoice?.issued_at || new Date())) blockers.push({ code: 'POLICY_EXPIRED', message: 'Policy đã hết hạn.' });
    if (!policy.front_card_attachment_id) warnings.push({ code: 'MISSING_FRONT_CARD', message: 'Thiếu ảnh mặt trước thẻ bảo hiểm.' });
    if (!policy.back_card_attachment_id) warnings.push({ code: 'MISSING_BACK_CARD', message: 'Thiếu ảnh mặt sau thẻ bảo hiểm.' });
  }
  if (invoice && claim.submitted_amount > invoice.total_amount) blockers.push({ code: 'SUBMITTED_EXCEEDS_INVOICE', message: 'Số tiền claim vượt tổng invoice.' });
  if (!claim.submitted_amount) blockers.push({ code: 'SUBMITTED_AMOUNT_ZERO', message: 'submitted_amount phải lớn hơn 0.' });
  return { ready: blockers.length === 0, blockers, warnings };
}

async function getInsuranceClaimSettlements(claimId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.READ, PERMISSION.PAYMENTS.READ]);
  const claim = await InsuranceClaim.findById(claimId).lean();
  if (!claim) throw createError('Không tìm thấy insurance claim.', 404);
  const invoice = await Invoice.findById(claim.invoice_id).lean();
  if (invoice) await assertInvoiceDepartmentScope(invoice, actor);
  const fallbackRef = normalizeString(claim.external_claim_ref || claim.claim_no);
  const paymentFilter = {
    payment_method: PAYMENT_METHOD.INSURANCE,
    $or: [
      { insurance_claim_id: claim._id },
      ...(fallbackRef ? [{ transaction_ref: fallbackRef }, { note: { $regex: escapeRegex(claim.claim_no), $options: 'i' } }] : []),
    ],
  };
  const payments = await Payment.find(paymentFilter)
    .sort({ paid_at: -1, created_at: -1 })
    .populate('received_by', 'full_name username employee_code email')
    .lean();
  return {
    claim,
    payments,
    approved_amount: claim.approved_amount,
    paid_amount: claim.paid_amount,
    remaining_amount: Math.max(0, Number(claim.approved_amount || 0) - Number(claim.paid_amount || 0)),
  };
}

async function getInsuranceClaimDetail(claimId, actor = {}) {
  const claim = await InsuranceClaim.findById(claimId)
    .populate('invoice_id', 'invoice_no status total_amount balance_due')
    .populate('policy_id', 'payer_name payer_code policy_no member_no coverage_percent')
    .populate('patient_id', 'patient_code full_name phone')
    .populate('reviewed_by', 'full_name username employee_code email')
    .populate('cancelled_by', 'full_name username employee_code email')
    .lean();
  if (!claim) throw createError('Không tìm thấy insurance claim.', 404);
  if (actor.actorType === 'patient') assertPatientSelf(actor, claim.patient_id?._id || claim.patient_id, PERMISSION.INSURANCE_CLAIMS.SELF_READ);
  else if (actor.actorType === 'staff') {
    assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.READ]);
    const invoice = await Invoice.findById(claim.invoice_id?._id || claim.invoice_id).lean();
    if (invoice) await assertInvoiceDepartmentScope(invoice, actor);
  }
  return claim;
}

async function getPatientBillingSummary(patientId, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, patientId, PERMISSION.INVOICES.SELF_READ);
    await ensureConsultationInvoicesForCompletedPatientEncounters(patientId);
  } else {
    assertStaffPermission(actor, [PERMISSION.INVOICES.READ, PERMISSION.CHARGES.READ, PERMISSION.PAYMENTS.READ]);
  }
  if (actor.actorType === 'staff' && !hasGlobalBillingScope(actor)) {
    const encounterExists = await Encounter.exists({ patient_id: patientId, department_id: actorDepartmentId(actor) });
    if (!encounterExists) throw createError('Bạn không có quyền xem billing summary ngoài khoa.', 403);
  }
  const [chargeAgg, invoiceAgg, paymentAgg] = await Promise.all([
    Charge.aggregate([
      { $match: { patient_id: toObjectId(patientId), status: { $in: ACTIVE_CHARGE_STATUSES } } },
      { $group: { _id: '$status', count: { $sum: 1 }, total_amount: { $sum: '$total_amount' } } },
    ]),
    Invoice.aggregate([
      { $match: { patient_id: toObjectId(patientId) } },
      { $group: { _id: '$status', count: { $sum: 1 }, total_amount: { $sum: '$total_amount' }, balance_due: { $sum: '$balance_due' } } },
    ]),
    Payment.aggregate([
      { $match: { patient_id: toObjectId(patientId), status: PAYMENT_STATUS.COMPLETED } },
      { $group: { _id: '$payment_method', count: { $sum: 1 }, total_amount: { $sum: '$amount' } } },
    ]),
  ]);
  return { patient_id: patientId, charges: chargeAgg, invoices: invoiceAgg, payments: paymentAgg };
}

function validateRevenueReportScope(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.REPORTS.REVENUE_READ, PERMISSION.REPORTS.BILLING_READ, PERMISSION.REPORTS.READ]);
  const from = normalizeDate(query.date_from, 'date_from');
  const to = normalizeDate(query.date_to, 'date_to');
  if (!from || !to) throw createError('date_from và date_to là bắt buộc cho revenue report/export.', 400);
  assertDateRange(from, to, 'Khoảng thời gian revenue report');
  const maxRangeDays = 366;
  if ((to.getTime() - from.getTime()) / 86400000 > maxRangeDays) {
    throw createError('Revenue report/export chỉ cho phép tối đa 366 ngày.', 400);
  }
  const requestedDepartmentId = query.department_id;
  if (actor.actorType === 'staff' && !hasGlobalBillingScope(actor)) {
    if (requestedDepartmentId && !sameId(requestedDepartmentId, actorDepartmentId(actor))) {
      throw createError('Staff department A không được xem revenue department B.', 403);
    }
    return { date_from: from, date_to: to, department_id: actorDepartmentId(actor), max_range_days: maxRangeDays };
  }
  return { date_from: from, date_to: to, department_id: requestedDepartmentId, max_range_days: maxRangeDays };
}

async function recordBillingFailure({ actor, action, targetId, requestMeta, error }) {
  try {
    await recordAuditLog({
      actor,
      action,
      targetType: 'billing',
      targetId,
      status: 'failure',
      message: error?.message || 'Billing action failed.',
      requestMeta,
      metadata: { error_name: error?.name, error_code: error?.code },
    });
  } catch (_) {
    // Best-effort audit must not mask the original business error.
  }
}

function billingFailureAuditContext(methodName, args = []) {
  const configs = {
    createCharge: { action: 'charges.create', actorIndex: 1, requestMetaIndex: 2, targetIndex: null },
    postCharge: { action: 'charges.post', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    voidCharge: { action: 'charges.void', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    createInvoiceFromCharges: { action: 'invoices.create_from_charges', actorIndex: 1, requestMetaIndex: 2, targetIndex: null },
    issueInvoice: { action: 'invoices.issue', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    voidInvoice: { action: 'invoices.void', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    createPayment: { action: 'payments.create', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    voidPayment: { action: 'payments.void', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    refundPayment: { action: 'payments.refund', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    createRefundForPayment: { action: 'refund.requested', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    reviewRefund: { action: 'refund.reviewed', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    approveRefund: { action: 'refund.approved', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    rejectRefund: { action: 'refund.rejected', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    processRefund: { action: 'refund.processed', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    markRefundPaid: { action: 'refund.mark_paid', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    cancelRefund: { action: 'refund.cancelled', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    addRefundEvidence: { action: 'refund.evidence_added', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    createInsuranceClaim: { action: 'insurance_claim.create', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    submitClaim: { action: 'insurance_claim.submitted', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    markClaimUnderReview: { action: 'insurance_claim.under_review', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    approveClaim: { action: 'insurance_claim.approved', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    rejectClaim: { action: 'insurance_claim.rejected', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    settleClaim: { action: 'insurance_claim.settle', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    cancelClaim: { action: 'insurance_claim.cancelled', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
  };
  const config = configs[methodName];
  if (!config) return null;
  return {
    action: config.action,
    actor: args[config.actorIndex],
    requestMeta: args[config.requestMetaIndex],
    targetId: config.targetIndex === null ? null : args[config.targetIndex],
  };
}

function withBillingFailureAudits(serviceExports) {
  return Object.fromEntries(Object.entries(serviceExports).map(([methodName, method]) => {
    if (typeof method !== 'function') return [methodName, method];
    if (!billingFailureAuditContext(methodName, [])) return [methodName, method];
    return [methodName, async (...args) => {
      try {
        return await method(...args);
      } catch (error) {
        const context = billingFailureAuditContext(methodName, args);
        await recordBillingFailure({ ...context, error });
        throw error;
      }
    }];
  }));
}

const billingServiceExports = {
  // createServiceCatalog: Tạo danh mục dịch vụ.
  createServiceCatalog,
  // listServiceCatalog: Liệt kê danh mục dịch vụ.
  listServiceCatalog,
  // getServiceCatalogSummary: Tổng hợp bảng giá.
  getServiceCatalogSummary,
  // getServiceCatalogDepartmentSummary: Tổng hợp bảng giá theo khoa.
  getServiceCatalogDepartmentSummary,
  // listEffectiveServiceCatalog: Liệt kê dịch vụ đang hiệu lực.
  listEffectiveServiceCatalog,
  // getServiceCatalogDetail: Lấy chi tiết danh mục dịch vụ.
  getServiceCatalogDetail,
  // getServiceCatalogUsage: Lấy usage của service catalog.
  getServiceCatalogUsage,
  // listServiceCatalogTimeline: Lấy timeline/audit service catalog.
  listServiceCatalogTimeline,
  // listServiceCatalogCharges: Lấy charges theo service catalog.
  listServiceCatalogCharges,
  // listServiceCatalogInvoiceItems: Lấy invoice items theo service catalog.
  listServiceCatalogInvoiceItems,
  // updateServiceCatalog: Cập nhật danh mục dịch vụ.
  updateServiceCatalog,
  // createServiceCatalogNewVersion: Tạo phiên bản giá mới.
  createServiceCatalogNewVersion,
  // retireServiceCatalog: Ngừng sử dụng danh mục dịch vụ.
  retireServiceCatalog,
  // reactivateServiceCatalog: Kích hoạt lại dịch vụ.
  reactivateServiceCatalog,
  // cloneServiceCatalog: Clone dịch vụ.
  cloneServiceCatalog,
  // bulkUpdateServiceCatalog: Bulk update bảng giá.
  bulkUpdateServiceCatalog,
  // bulkRetireServiceCatalog: Bulk retire bảng giá.
  bulkRetireServiceCatalog,
  // resolveServicePrice: Resolve giá dịch vụ theo ngày.
  resolveServicePrice,
  // generateChargeNumber: Sinh/tạo mã khoản phí.
  generateChargeNumber,
  // createCharge: Tạo khoản phí.
  createCharge,
  // postCharge: Ghi nhận phát sinh khoản phí.
  postCharge,
  // voidCharge: Hủy hiệu lực khoản phí.
  voidCharge,
  // listCharges: Liệt kê khoản phí.
  listCharges,
  // getChargeDetail: Lấy chi tiết khoản phí.
  getChargeDetail,
  // generateInvoiceNumber: Sinh/tạo mã hóa đơn.
  generateInvoiceNumber,
  // createInvoiceFromCharges: Tạo hóa đơn từ các khoản phí.
  createInvoiceFromCharges,
  // createInvoiceItemsSnapshot: Tạo bản chụp các dòng hóa đơn.
  createInvoiceItemsSnapshot,
  // issueInvoice: Kiểm tra sue hóa đơn.
  issueInvoice,
  createConsultationInvoiceForEncounter,
  // updateInvoiceBalance: Cập nhật số dư hóa đơn.
  updateInvoiceBalance,
  // voidInvoice: Hủy hiệu lực hóa đơn.
  voidInvoice,
  // listInvoices: Liệt kê hóa đơn.
  listInvoices,
  // getInvoiceDetail: Lấy chi tiết hóa đơn.
  getInvoiceDetail,
  // generatePaymentNumber: Sinh/tạo mã thanh toán.
  generatePaymentNumber,
  // generateRefundNumber: Sinh/tạo mã refund.
  generateRefundNumber,
  // createPayment: Tạo thanh toán.
  createPayment,
  // voidPayment: Hủy hiệu lực thanh toán.
  voidPayment,
  // refundPayment: Hoàn tiền thanh toán.
  refundPayment,
  // listRefunds: Liệt kê workflow refund.
  listRefunds,
  // getRefundDetail: Lấy chi tiết workflow refund.
  getRefundDetail,
  // createRefundForPayment: Tạo refund request từ payment.
  createRefundForPayment,
  // reviewRefund: Đưa refund vào trạng thái review.
  reviewRefund,
  // approveRefund: Duyệt refund.
  approveRefund,
  // rejectRefund: Từ chối refund.
  rejectRefund,
  // processRefund: Xử lý chi tiền refund.
  processRefund,
  // markRefundPaid: Ghi nhận refund đã chi.
  markRefundPaid,
  // cancelRefund: Hủy refund request.
  cancelRefund,
  // addRefundEvidence: Thêm chứng từ refund.
  addRefundEvidence,
  // getPaymentRefundPreview: Preview refund payment.
  getPaymentRefundPreview,
  // getPaymentVoidPreview: Preview void payment.
  getPaymentVoidPreview,
  // getInvoiceVoidPreview: Preview void invoice.
  getInvoiceVoidPreview,
  // getRefundVoidSummary: Tổng hợp refund/void.
  getRefundVoidSummary,
  // getRefundVoidHistory: Lịch sử refund/void.
  getRefundVoidHistory,
  // listPayments: Liệt kê thanh toán.
  listPayments,
  // getPaymentDetail: Lấy chi tiết thanh toán.
  getPaymentDetail,
  // createInsurancePolicy: Tạo hợp đồng bảo hiểm.
  createInsurancePolicy,
  // listInsurancePolicies: Liệt kê hợp đồng bảo hiểm.
  listInsurancePolicies,
  // listAllInsurancePolicies: Liệt kê toàn bộ hợp đồng bảo hiểm.
  listAllInsurancePolicies,
  // getInsurancePolicySummary: Tổng hợp trạng thái chính sách bảo hiểm.
  getInsurancePolicySummary,
  // getInsurancePolicyDetail: Lấy chi tiết hợp đồng bảo hiểm.
  getInsurancePolicyDetail,
  // updateInsurancePolicy: Cập nhật hợp đồng bảo hiểm.
  updateInsurancePolicy,
  // attachInsurancePolicyCard: Gắn ảnh thẻ bảo hiểm cho policy.
  attachInsurancePolicyCard,
  // cancelInsurancePolicy: Hủy hợp đồng bảo hiểm.
  cancelInsurancePolicy,
  // generateClaimNumber: Sinh/tạo mã yêu cầu bảo hiểm.
  generateClaimNumber,
  // createInsuranceClaim: Tạo yêu cầu bảo hiểm.
  createInsuranceClaim,
  // submitClaim: Gửi/nộp yêu cầu bảo hiểm.
  submitClaim,
  // markClaimUnderReview: Đánh dấu yêu cầu bảo hiểm đang được xem xét.
  markClaimUnderReview,
  // approveClaim: Phê duyệt yêu cầu bảo hiểm.
  approveClaim,
  // rejectClaim: Từ chối yêu cầu bảo hiểm.
  rejectClaim,
  // settleClaim: Thiết lập tle yêu cầu bảo hiểm.
  settleClaim,
  // cancelClaim: Hủy yêu cầu bảo hiểm.
  cancelClaim,
  // updateInsuranceClaim: Cập nhật thông tin cơ bản của yêu cầu bảo hiểm.
  updateInsuranceClaim,
  // listInsuranceClaims: Liệt kê yêu cầu bảo hiểm.
  listInsuranceClaims,
  // getInsuranceClaimSummary: Tổng hợp claim bảo hiểm.
  getInsuranceClaimSummary,
  // getInsuranceClaimReadiness: Kiểm tra điều kiện submit claim.
  getInsuranceClaimReadiness,
  // getInsuranceClaimSettlements: Lịch sử settlement của claim.
  getInsuranceClaimSettlements,
  // getInsuranceClaimDetail: Lấy chi tiết yêu cầu bảo hiểm.
  getInsuranceClaimDetail,
  // getPatientBillingSummary: Lấy tổng hợp viện phí của bệnh nhân.
  getPatientBillingSummary,
  // validateRevenueReportScope: Validate scope/date range cho revenue report/export.
  validateRevenueReportScope,
};

module.exports = withBillingFailureAudits(billingServiceExports);
