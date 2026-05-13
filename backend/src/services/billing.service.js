const { Types } = require('mongoose');
const {
  Admission,
  Charge,
  Department,
  Encounter,
  InsuranceClaim,
  InsurancePolicy,
  Invoice,
  InvoiceItem,
  Patient,
  Payment,
  ServiceCatalog,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  INVOICE_STATUS,
  INSURANCE_CLAIM_STATUS,
  INSURANCE_POLICY_STATUS,
  PATIENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  SERVICE_STATUS,
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
const { withOptionalTransaction } = require('../shared/utils/transaction');
const {
  calculateBalanceDue,
  calculateLineTotal,
  toMoney,
} = require('../common/helpers/money.helper');

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
  if (actor.internal === true || actor.system === true) return true;
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
  return actor.internal === true
    || actor.system === true
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

async function generateClaimNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.INSURANCE_CLAIM, options);
}

function calculateLineAmounts({ quantity = 1, unitPrice = 0, discountAmount = 0, taxAmount = 0 }) {
  const subtotal = normalizeMoneyAmount(quantity * unitPrice, 'subtotal', { allowZero: true });
  const total = calculateLineTotal({ quantity, unitPrice, discountAmount, taxAmount });
  if (total < 0) throw createError('Tổng tiền không được âm.', 400);
  return { subtotal, total };
}

async function createServiceCatalog(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.CREATE]);
  const serviceCode = normalizeString(payload.service_code).toUpperCase();
  const serviceName = normalizeString(payload.service_name);
  if (!serviceCode) throw createError('service_code là bắt buộc.', 400);
  if (!serviceName) throw createError('service_name là bắt buộc.', 400);
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
    is_billable: payload.is_billable !== false,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    status: payload.status || SERVICE_STATUS.ACTIVE,
    created_by: actor.userId,
    updated_by: actor.userId,
  });

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
  for (const field of ['service_type', 'department_id', 'status', 'is_billable']) {
    if (query[field] !== undefined && query[field] !== '') filter[field] = query[field];
  }
  const keyword = normalizeString(query.keyword || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { service_code: { $regex: pattern, $options: 'i' } },
      { service_name: { $regex: pattern, $options: 'i' } },
    ];
  }
  const effectiveDate = normalizeDate(query.effective_date, 'effective_date');
  if (effectiveDate) Object.assign(filter, buildEffectiveDateFilter(effectiveDate));

  const [items, total] = await Promise.all([
    ServiceCatalog.find(filter)
      .sort({ service_type: 1, service_code: 1 })
      .skip(skip)
      .limit(limit)
      .populate('department_id', 'department_name department_code')
      .lean(),
    ServiceCatalog.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getServiceCatalogDetail(serviceId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.SERVICE_CATALOG.READ]);
  const [service, chargeCount] = await Promise.all([
    ServiceCatalog.findOne({ _id: serviceId, is_deleted: false })
      .populate('department_id', 'department_name department_code')
      .lean(),
    Charge.countDocuments({ service_id: serviceId }),
  ]);
  if (!service) throw createError('Không tìm thấy service catalog.', 404);
  return { ...service, charge_count: chargeCount };
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
    service.unit_price = normalizeMoneyAmount(payload.unit_price, 'unit_price', { allowZero: true });
  }

  if (payload.service_name !== undefined) service.service_name = normalizeString(payload.service_name);
  if (payload.description !== undefined) service.description = normalizeString(payload.description);
  if (payload.department_id !== undefined) {
    await assertDepartmentActive(payload.department_id);
    service.department_id = payload.department_id || undefined;
  }
  if (payload.unit !== undefined) service.unit = normalizeString(payload.unit);
  if (payload.currency !== undefined) service.currency = normalizeString(payload.currency).toUpperCase();
  if (payload.is_billable !== undefined) service.is_billable = Boolean(payload.is_billable);
  if (payload.effective_from !== undefined) service.effective_from = normalizeDate(payload.effective_from, 'effective_from');
  if (payload.effective_to !== undefined) service.effective_to = normalizeDate(payload.effective_to, 'effective_to');
  assertDateRange(service.effective_from, service.effective_to, 'Hiệu lực service catalog');
  if (payload.status !== undefined) service.status = payload.status;
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
  service.status = SERVICE_STATUS.RETIRED;
  service.effective_to = service.effective_to && service.effective_to < new Date() ? service.effective_to : new Date();
  service.updated_by = actor.userId;
  await service.save();
  await recordAuditLog({
    actor,
    action: 'service_catalog.retire',
    targetType: 'service_catalog',
    targetId: service._id,
    status: 'success',
    message: 'Retire service catalog thành công.',
    requestMeta,
    metadata: { reason },
  });
  return getServiceCatalogDetail(service._id, actor);
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
  const unitPrice = payload.unit_price !== undefined && canOverridePrice
    ? normalizeMoneyAmount(payload.unit_price, 'unit_price', { allowZero: true })
    : normalizeMoneyAmount(service?.unit_price ?? payload.unit_price ?? 0, 'unit_price', { allowZero: true });
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
  if (query.date_from || query.date_to) {
    filter.charged_at = {};
    const from = normalizeDate(query.date_from, 'date_from');
    const to = normalizeDate(query.date_to, 'date_to');
    if (from) filter.charged_at.$gte = from;
    if (to) filter.charged_at.$lte = to;
  }
  filter = applyPatientScope(filter, actor, PERMISSION.INVOICES.SELF_READ);
  filter = await applyEncounterDepartmentScope(filter, actor);
  const [items, total] = await Promise.all([
    Charge.find(filter)
      .sort({ charged_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('service_id', 'service_code service_name service_type')
      .populate('patient_id', 'patient_code full_name')
      .populate('invoice_id', 'invoice_no status')
      .lean(),
    Charge.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getChargeDetail(chargeId, actor = {}, session = null) {
  if (actor.internal === true || actor.system === true) {
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
  const paidAmount = completedPayments.reduce((sum, payment) => sum + normalizeMoneyAmount(payment.amount || 0, 'payment.amount', { allowZero: true }), 0);
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
    invoice.updated_by = actor.userId;
    await invoice.save(sessionOptions(session));
    if (payload.release_charges !== false) {
      await Charge.updateMany(
        { invoice_id: invoice._id, status: CHARGE_STATUS.BILLED },
        {
          $set: { status: CHARGE_STATUS.POSTED, updated_by: actor.userId },
          $unset: { invoice_id: '' },
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
  return getInvoiceDetail(invoiceId, actor);
}

async function listInvoices(query = {}, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id, PERMISSION.INVOICES.SELF_READ);
  } else {
    assertStaffPermission(actor, [PERMISSION.INVOICES.READ]);
  }
  const { page, limit, skip } = getPagination(query);
  let filter = {};
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.date_from || query.date_to) {
    filter.issued_at = {};
    const from = normalizeDate(query.date_from, 'date_from');
    const to = normalizeDate(query.date_to, 'date_to');
    if (from) filter.issued_at.$gte = from;
    if (to) filter.issued_at.$lte = to;
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
    .populate('patient_id', 'patient_code full_name')
    .populate('issued_by', 'full_name username employee_code')
    .lean(), session);
  if (!invoice) throw createError('Không tìm thấy invoice.', 404);
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, invoice.patient_id?._id || invoice.patient_id, PERMISSION.INVOICES.SELF_READ);
  } else if (actor.actorType === 'staff') {
    assertStaffPermission(actor, [PERMISSION.INVOICES.READ]);
    await assertInvoiceDepartmentScope(invoice, actor, session);
  }
  const [items, payments, claims] = await Promise.all([
    withSession(InvoiceItem.find({ invoice_id: invoice._id })
      .sort({ display_order: 1 })
      .populate('service_id', 'service_code service_name service_type')
      .lean(), session),
    withSession(Payment.find({ invoice_id: invoice._id })
      .sort({ paid_at: -1, created_at: -1 })
      .lean(), session),
    withSession(InsuranceClaim.find({ invoice_id: invoice._id })
      .sort({ created_at: -1 })
      .lean(), session),
  ]);
  return { ...invoice, items, payments, insurance_claims: claims };
}

async function createPayment(invoiceId, payload = {}, actor = {}, requestMeta = {}, options = {}) {
  if (!options.internal) assertStaffPermission(actor, [PERMISSION.PAYMENTS.CREATE]);
  const amount = normalizeMoneyAmount(payload.amount, 'amount');
  const method = payload.payment_method || PAYMENT_METHOD.CASH;
  if (!PAYMENT_METHODS.includes(method)) throw createError('payment_method không hợp lệ.', 400);
  if (![PAYMENT_METHOD.CASH, PAYMENT_METHOD.OTHER].includes(method) && !normalizeString(payload.transaction_ref)) {
    throw createError('transaction_ref là bắt buộc với phương thức thanh toán không phải cash.', 400);
  }
  let paymentId;
  await withOptionalTransaction(async (session) => {
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
      payment_no: paymentNo,
      amount,
      currency: invoice.currency,
      payment_method: method,
      transaction_ref: normalizeString(payload.transaction_ref),
      paid_at: normalizeDate(payload.paid_at, 'paid_at') || new Date(),
      received_by: actor.userId,
      status: paymentStatus,
      note: normalizeString(payload.note),
      created_by: actor.userId,
      updated_by: actor.userId,
    }], sessionOptions(session));
    paymentId = payment._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'payments.create',
    targetType: 'payment',
    targetId: paymentId,
    status: 'success',
    message: 'Tạo payment thành công.',
    requestMeta,
  });
  return getPaymentDetail(paymentId, actor);
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
  return getPaymentDetail(paymentId, actor);
}

async function refundPayment(paymentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.PAYMENTS.REFUND]);
  const reason = normalizeString(payload.reason || payload.refund_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
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
    const wasPaid = invoice && invoice.status === INVOICE_STATUS.PAID;
    assertTransition(PAYMENT_TRANSITIONS, payment.status, PAYMENT_STATUS.REFUNDED, 'payment');
    const refundedPayment = await withSession(Payment.findOneAndUpdate(
      { _id: payment._id, status: PAYMENT_STATUS.COMPLETED },
      {
        $set: {
          status: PAYMENT_STATUS.REFUNDED,
          refunded_by: actor.userId,
          refunded_at: new Date(),
          refund_reason: reason,
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
  for (const field of ['invoice_id', 'patient_id', 'payment_method', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  filter = applyPatientScope(filter, actor, PERMISSION.PAYMENTS.SELF_READ);
  filter = await applyInvoiceDepartmentScope(filter, actor);
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ paid_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
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

async function getInsurancePolicyDetail(policyId, actor = {}) {
  const policy = await InsurancePolicy.findOne({ _id: policyId, is_deleted: false }).lean();
  if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
  if (actor.actorType === 'patient') assertPatientSelf(actor, policy.patient_id, PERMISSION.INSURANCE_POLICIES.SELF_READ);
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

async function listInsuranceClaims(query = {}, actor = {}) {
  if (actor.actorType === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id, PERMISSION.INSURANCE_CLAIMS.SELF_READ);
  } else {
    assertStaffPermission(actor, [PERMISSION.INSURANCE_CLAIMS.READ]);
  }
  const { page, limit, skip } = getPagination(query);
  let filter = {};
  for (const field of ['policy_id', 'patient_id', 'invoice_id', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (actor.actorType === 'patient') filter.patient_id = actor.patientId || actor.patient_id;
  filter = await applyInvoiceDepartmentScope(filter, actor);
  const [items, total] = await Promise.all([
    InsuranceClaim.find(filter)
      .sort({ submitted_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('policy_id', 'payer_name policy_no member_no')
      .lean(),
    InsuranceClaim.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getInsuranceClaimDetail(claimId, actor = {}) {
  const claim = await InsuranceClaim.findById(claimId)
    .populate('invoice_id', 'invoice_no status total_amount balance_due')
    .populate('policy_id', 'payer_name payer_code policy_no member_no coverage_percent')
    .populate('patient_id', 'patient_code full_name')
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
  if (actor.actorType === 'patient') assertPatientSelf(actor, patientId, PERMISSION.INVOICES.SELF_READ);
  else assertStaffPermission(actor, [PERMISSION.INVOICES.READ, PERMISSION.CHARGES.READ, PERMISSION.PAYMENTS.READ]);
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
  // getServiceCatalogDetail: Lấy chi tiết danh mục dịch vụ.
  getServiceCatalogDetail,
  // updateServiceCatalog: Cập nhật danh mục dịch vụ.
  updateServiceCatalog,
  // retireServiceCatalog: Ngừng sử dụng danh mục dịch vụ.
  retireServiceCatalog,
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
  // createPayment: Tạo thanh toán.
  createPayment,
  // voidPayment: Hủy hiệu lực thanh toán.
  voidPayment,
  // refundPayment: Hoàn tiền thanh toán.
  refundPayment,
  // listPayments: Liệt kê thanh toán.
  listPayments,
  // getPaymentDetail: Lấy chi tiết thanh toán.
  getPaymentDetail,
  // createInsurancePolicy: Tạo hợp đồng bảo hiểm.
  createInsurancePolicy,
  // listInsurancePolicies: Liệt kê hợp đồng bảo hiểm.
  listInsurancePolicies,
  // getInsurancePolicyDetail: Lấy chi tiết hợp đồng bảo hiểm.
  getInsurancePolicyDetail,
  // updateInsurancePolicy: Cập nhật hợp đồng bảo hiểm.
  updateInsurancePolicy,
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
  // listInsuranceClaims: Liệt kê yêu cầu bảo hiểm.
  listInsuranceClaims,
  // getInsuranceClaimDetail: Lấy chi tiết yêu cầu bảo hiểm.
  getInsuranceClaimDetail,
  // getPatientBillingSummary: Lấy tổng hợp viện phí của bệnh nhân.
  getPatientBillingSummary,
  // validateRevenueReportScope: Validate scope/date range cho revenue report/export.
  validateRevenueReportScope,
};

module.exports = withBillingFailureAudits(billingServiceExports);
