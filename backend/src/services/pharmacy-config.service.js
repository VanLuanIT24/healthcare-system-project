const { mongoose } = require('../config/database');
const {
  AdministrationRoute,
  ControlledDrugLedger,
  ControlledDrugPolicy,
  DosageForm,
  InventoryTransaction,
  MedicationMaster,
  MedicationUnit,
  PharmacyAlertRule,
  PharmacyExpiryPolicy,
  StockBatch,
  StorageLocation,
  Supplier,
  Warehouse,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const { generateSequenceCode } = require('./code-generator.service');
const permissionService = require('./permission.service');
const prescriptionService = require('./prescription.service');
const { PERMISSION } = require('../constants/permissions');
const {
  INVENTORY_TRANSACTION_DIRECTION,
  INVENTORY_TRANSACTION_TYPE,
  STOCK_BATCH_STATUS,
} = require('../constants/statuses');

const CONFIG_READ_PERMISSIONS = [
  PERMISSION.PHARMACY_CONFIG?.READ,
  PERMISSION.PHARMACY_POLICY?.READ,
  PERMISSION.CONTROLLED_DRUG_POLICY?.READ,
  PERMISSION.MEDICATIONS.READ,
  PERMISSION.STOCK_BATCHES.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ,
  PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
  PERMISSION.PHARMACY_REPORTS?.DASHBOARD_READ,
].filter(Boolean);

const CONFIG_WRITE_PERMISSIONS = [
  PERMISSION.PHARMACY_CONFIG?.CREATE,
  PERMISSION.PHARMACY_CONFIG?.UPDATE,
  PERMISSION.PHARMACY_CONFIG?.MERGE,
  PERMISSION.PHARMACY_POLICY?.CREATE,
  PERMISSION.PHARMACY_POLICY?.UPDATE,
  PERMISSION.CONTROLLED_DRUG_POLICY?.MANAGE,
  PERMISSION.MEDICATIONS.MANAGE,
  PERMISSION.MEDICATIONS.UPDATE,
  PERMISSION.STOCK_BATCHES.UPDATE,
].filter(Boolean);

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.user?._id || actor.user?.id;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes.filter(Boolean));
}

function assertPermission(actor = {}, permissions = CONFIG_READ_PERMISSIONS, message = 'Bạn không có quyền cấu hình dược.') {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (!hasAnyPermission(actor, permissions)) throw createError(message, 403);
  return true;
}

function assertConfigRead(actor = {}) {
  return assertPermission(actor, CONFIG_READ_PERMISSIONS, 'Bạn không có quyền xem cấu hình dược.');
}

function assertConfigWrite(actor = {}) {
  return assertPermission(actor, CONFIG_WRITE_PERMISSIONS, 'Bạn không có quyền thay đổi cấu hình dược.');
}

function normalizeString(value) {
  return String(value || '').trim();
}

function nonEmpty(value) {
  return normalizeString(value).length > 0;
}

function normalizeCode(value, fallback = '') {
  return normalizeString(value || fallback).replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
}

function normalizeKey(value) {
  return normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function booleanQuery(value) {
  return value === true || String(value || '').toLowerCase() === 'true' || String(value || '') === '1';
}

function parseNonNegativeNumber(value, fieldName, fallback = undefined) {
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

function toObjectId(value, fieldName = 'id') {
  if (!value) return undefined;
  if (!mongoose.Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`);
  return new mongoose.Types.ObjectId(value);
}

function itemId(item) {
  return String(item?._id || item?.id || item || '');
}

function applySearch(filter, query = {}, fields = []) {
  const search = normalizeString(query.search || query.q);
  if (!search || !fields.length) return;
  const pattern = escapeRegex(search);
  filter.$or = fields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } }));
}

function addStatusFilter(filter, query = {}) {
  if (query.status) filter.status = query.status;
}

async function generateConfigCode(Model, fieldName, prefix) {
  return generateSequenceCode(Model, fieldName, prefix, { includeDate: false, sequenceWidth: 4, separator: '-' });
}

function formatMedicationName(medication = {}) {
  return [
    medication.brand_name || medication.generic_name,
    medication.strength,
    medication.dosage_form,
  ].filter(Boolean).join(' ');
}

function valueAliases(doc = {}, fields = ['code', 'name', 'symbol', 'english_name']) {
  const aliases = new Set();
  for (const field of fields) {
    if (doc[field]) aliases.add(normalizeKey(doc[field]));
  }
  for (const alias of doc.aliases || []) {
    if (alias) aliases.add(normalizeKey(alias));
  }
  return aliases;
}

function groupValues(values = []) {
  const groups = new Map();
  for (const raw of values.filter(nonEmpty)) {
    const key = normalizeKey(raw);
    if (!groups.has(key)) groups.set(key, { key, labels: new Set(), count: 0 });
    const current = groups.get(key);
    current.labels.add(normalizeString(raw));
    current.count += 1;
  }
  return [...groups.values()].map((item) => ({
    key: item.key,
    labels: [...item.labels],
    count: item.count,
  }));
}

function findNearDuplicateGroups(values = []) {
  const exact = groupValues(values).filter((item) => item.labels.length > 1);
  const synonymBuckets = [
    ['viên', 'vien', 'tab', 'tablet'],
    ['ống', 'ong', 'amp', 'ampoule', 'ampule'],
    ['chai', 'bottle', 'lọ', 'lo'],
    ['uống', 'oral', 'po'],
    ['tiêm tĩnh mạch', 'intravenous', 'iv'],
    ['tiêm bắp', 'intramuscular', 'im'],
  ];
  const normalizedValues = groupValues(values);
  const fuzzy = synonymBuckets.map((bucket) => {
    const keys = new Set(bucket.map(normalizeKey));
    const labels = normalizedValues
      .filter((item) => keys.has(item.key))
      .flatMap((item) => item.labels);
    return labels.length > 1 ? { key: bucket[0], labels: [...new Set(labels)], count: labels.length } : null;
  }).filter(Boolean);
  return [...exact, ...fuzzy].filter((item, index, array) =>
    array.findIndex((other) => other.labels.join('|') === item.labels.join('|')) === index,
  );
}

async function countMedicationUsage({ textField, refField, doc }) {
  const or = [];
  if (refField && doc?._id) or.push({ [refField]: doc._id });
  const aliases = [...valueAliases(doc)];
  if (aliases.length) {
    const rawAliases = [doc.code, doc.name, doc.symbol, doc.english_name, ...(doc.aliases || [])].filter(nonEmpty);
    or.push({ [textField]: { $in: rawAliases } });
  }
  if (!or.length) return 0;
  return MedicationMaster.countDocuments({ is_deleted: false, $or: or });
}

async function countBatchUsage({ textField, refField, doc }) {
  const or = [];
  if (refField && doc?._id) or.push({ [refField]: doc._id });
  const rawAliases = [doc.code, doc.location_code, doc.name, doc.symbol, ...(doc.aliases || [])].filter(nonEmpty);
  if (rawAliases.length) or.push({ [textField]: { $in: rawAliases } });
  if (!or.length) return 0;
  return StockBatch.countDocuments({ is_deleted: false, $or: or });
}

async function buildDerivedMedicationCatalog({ docs, textField, labelField = textField, refField, query = {}, mapItem }) {
  const existingAliases = new Set();
  for (const doc of docs) {
    for (const key of valueAliases(doc)) existingAliases.add(key);
  }
  const usageRows = await MedicationMaster.aggregate([
    { $match: { is_deleted: false, [textField]: { $nin: [null, ''] } } },
    { $group: { _id: `$${textField}`, medication_count: { $sum: 1 } } },
    { $sort: { medication_count: -1, _id: 1 } },
  ]);
  return usageRows
    .filter((row) => !existingAliases.has(normalizeKey(row._id)))
    .filter((row) => {
      if (!query.search && !query.q) return true;
      return normalizeKey(row._id).includes(normalizeKey(query.search || query.q));
    })
    .map((row) => ({
      id: `derived:${textField}:${row._id}`,
      _derived: true,
      code: normalizeCode(row._id).slice(0, 28) || 'UNMAPPED',
      name: row._id,
      [labelField]: row._id,
      status: 'unmapped',
      medication_count: row.medication_count,
      linked_count: row.medication_count,
      quality_flags: ['text_only'],
      missing_standard_mapping: true,
      ...(mapItem ? mapItem(row) : {}),
      refField,
    }));
}

async function listMedicationUnits(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = { is_deleted: false };
  addStatusFilter(filter, query);
  if (query.unit_type) filter.unit_type = query.unit_type;
  applySearch(filter, query, ['code', 'name', 'symbol', 'english_name', 'aliases']);

  const [docs, total] = await Promise.all([
    MedicationUnit.find(filter).sort({ status: 1, name: 1 }).skip(skip).limit(limit).lean(),
    MedicationUnit.countDocuments(filter),
  ]);
  const items = await Promise.all(docs.map(async (doc) => ({
    ...doc,
    medication_count: await countMedicationUsage({ textField: 'unit', refField: 'unit_id', doc }),
    linked_count: await countMedicationUsage({ textField: 'unit', refField: 'unit_id', doc }),
  })));
  const derived = booleanQuery(query.include_derived) || query.include_derived === undefined
    ? await buildDerivedMedicationCatalog({ docs, textField: 'unit', query })
    : [];
  const missing = await MedicationMaster.countDocuments({ is_deleted: false, $or: [{ unit: { $exists: false } }, { unit: null }, { unit: '' }] });
  return {
    items: [...items, ...derived],
    pagination: buildPagination(page, limit, total + derived.length),
    summary: {
      total_config: total + derived.length,
      active: items.filter((item) => item.status === 'active').length,
      linked: items.filter((item) => Number(item.linked_count || 0) > 0).length + derived.length,
      missing_mapping: missing,
      duplicates: findNearDuplicateGroups((await MedicationMaster.distinct('unit', { is_deleted: false })).filter(Boolean)).length,
    },
  };
}

async function createMedicationUnit(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!nonEmpty(payload.name)) throw createError('name là bắt buộc.');
  const code = normalizeCode(payload.code) || await generateConfigCode(MedicationUnit, 'code', 'UNIT');
  const created = await MedicationUnit.create({
    code,
    name: normalizeString(payload.name),
    symbol: normalizeString(payload.symbol) || undefined,
    english_name: normalizeString(payload.english_name) || undefined,
    unit_type: payload.unit_type || 'count',
    allow_decimal: Boolean(payload.allow_decimal),
    decimal_precision: parseNonNegativeNumber(payload.decimal_precision, 'decimal_precision', 0),
    is_prescribable: payload.is_prescribable !== false,
    is_dispensable: payload.is_dispensable !== false,
    is_inventory_unit: payload.is_inventory_unit !== false,
    status: payload.status || 'active',
    description: payload.description,
    aliases: Array.isArray(payload.aliases) ? payload.aliases.map(normalizeString).filter(Boolean) : [],
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_config.unit.create', targetType: 'medication_unit', targetId: created._id, status: 'success', message: 'Tạo đơn vị thuốc.', requestMeta });
  return getMedicationUnitDetail(created._id, actor);
}

async function getMedicationUnitDetail(unitId, actor = {}) {
  assertConfigRead(actor);
  const unit = await MedicationUnit.findById(unitId).lean();
  if (!unit || unit.is_deleted) throw createError('Không tìm thấy đơn vị thuốc.', 404);
  return {
    unit: {
      ...unit,
      medication_count: await countMedicationUsage({ textField: 'unit', refField: 'unit_id', doc: unit }),
    },
  };
}

async function updateMedicationUnit(unitId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const unit = await MedicationUnit.findById(unitId);
  if (!unit || unit.is_deleted) throw createError('Không tìm thấy đơn vị thuốc.', 404);
  const before = unit.toObject();
  for (const field of ['name', 'symbol', 'english_name', 'unit_type', 'description', 'status']) {
    if (payload[field] !== undefined) unit[field] = typeof payload[field] === 'string' ? normalizeString(payload[field]) : payload[field];
  }
  for (const field of ['allow_decimal', 'is_prescribable', 'is_dispensable', 'is_inventory_unit']) {
    if (payload[field] !== undefined) unit[field] = Boolean(payload[field]);
  }
  if (payload.decimal_precision !== undefined) unit.decimal_precision = parseNonNegativeNumber(payload.decimal_precision, 'decimal_precision', 0);
  if (Array.isArray(payload.aliases)) unit.aliases = payload.aliases.map(normalizeString).filter(Boolean);
  unit.updated_by = actorUserId(actor);
  await unit.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.unit.update', targetType: 'medication_unit', targetId: unit._id, status: 'success', message: 'Cập nhật đơn vị thuốc.', requestMeta, before, after: unit.toObject() });
  return getMedicationUnitDetail(unit._id, actor);
}

async function getUnitMedications(unitId, query = {}, actor = {}) {
  assertConfigRead(actor);
  const unit = await MedicationUnit.findById(unitId).lean();
  if (!unit || unit.is_deleted) throw createError('Không tìm thấy đơn vị thuốc.', 404);
  return listMedicationsByCatalogValue({ query, refField: 'unit_id', textField: 'unit', doc: unit });
}

async function mergeMedicationUnits(unitId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const target = await MedicationUnit.findById(unitId);
  if (!target || target.is_deleted) throw createError('Không tìm thấy đơn vị đích.', 404);
  const sourceIds = (payload.source_ids || payload.source_unit_ids || []).filter(Boolean);
  const sourceUnits = sourceIds.length ? await MedicationUnit.find({ _id: { $in: sourceIds }, is_deleted: false }) : [];
  const sourceValues = [
    ...(payload.source_values || []),
    ...sourceUnits.flatMap((unit) => [unit.code, unit.name, unit.symbol, ...(unit.aliases || [])]),
  ].filter(nonEmpty);
  const replacement = payload.replacement_value || target.symbol || target.name;
  const filter = {
    is_deleted: false,
    $or: [
      ...(sourceIds.length ? [{ unit_id: { $in: sourceIds } }] : []),
      ...(sourceValues.length ? [{ unit: { $in: sourceValues } }] : []),
    ],
  };
  const result = filter.$or.length
    ? await MedicationMaster.updateMany(filter, { $set: { unit: replacement, unit_id: target._id, updated_by: actorUserId(actor) } })
    : { modifiedCount: 0 };
  if (sourceUnits.length) {
    await MedicationUnit.updateMany(
      { _id: { $in: sourceIds } },
      { $set: { status: 'deprecated', deprecated_replacement_id: target._id, deprecated_at: new Date(), deprecated_by: actorUserId(actor), updated_by: actorUserId(actor) } },
    );
  }
  await recordAuditLog({ actor, action: 'pharmacy_config.unit.merge', targetType: 'medication_unit', targetId: target._id, status: 'success', message: 'Gộp đơn vị thuốc.', requestMeta, metadata: { source_ids: sourceIds, source_values: sourceValues, modified_count: result.modifiedCount || result.nModified || 0 } });
  return { target_id: target._id, modified_count: result.modifiedCount || result.nModified || 0 };
}

async function bulkAssignUnits(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const medicationIds = payload.medication_ids || [];
  if (!medicationIds.length) throw createError('medication_ids là bắt buộc.');
  const unit = payload.unit_id ? await MedicationUnit.findById(payload.unit_id).lean() : null;
  const unitValue = payload.unit || unit?.symbol || unit?.name;
  if (!nonEmpty(unitValue)) throw createError('unit hoặc unit_id là bắt buộc.');
  const result = await MedicationMaster.updateMany(
    { _id: { $in: medicationIds }, is_deleted: false },
    { $set: { unit: normalizeString(unitValue), unit_id: unit?._id, updated_by: actorUserId(actor) } },
  );
  await recordAuditLog({ actor, action: 'pharmacy_config.unit.bulk_assign', targetType: 'medication_unit', targetId: unit?._id, status: 'success', message: 'Gán đơn vị hàng loạt.', requestMeta, metadata: { medication_ids: medicationIds, unit: unitValue } });
  return { modified_count: result.modifiedCount || result.nModified || 0 };
}

async function listDosageForms(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = { is_deleted: false };
  addStatusFilter(filter, query);
  if (query.form_group) filter.form_group = query.form_group;
  applySearch(filter, query, ['code', 'name', 'english_name', 'aliases']);
  const [docs, total] = await Promise.all([
    DosageForm.find(filter)
      .populate('default_unit_id', 'code name symbol')
      .populate('default_route_id allowed_route_ids', 'code name english_name route_group risk_level')
      .sort({ status: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DosageForm.countDocuments(filter),
  ]);
  const items = await Promise.all(docs.map(async (doc) => ({
    ...doc,
    medication_count: await countMedicationUsage({ textField: 'dosage_form', refField: 'dosage_form_id', doc }),
    linked_count: await countMedicationUsage({ textField: 'dosage_form', refField: 'dosage_form_id', doc }),
  })));
  const derived = booleanQuery(query.include_derived) || query.include_derived === undefined
    ? await buildDerivedMedicationCatalog({ docs, textField: 'dosage_form', query })
    : [];
  const missing = await MedicationMaster.countDocuments({ is_deleted: false, $or: [{ dosage_form: { $exists: false } }, { dosage_form: null }, { dosage_form: '' }] });
  return {
    items: [...items, ...derived],
    pagination: buildPagination(page, limit, total + derived.length),
    summary: {
      total_config: total + derived.length,
      active: items.filter((item) => item.status === 'active').length,
      linked: items.filter((item) => Number(item.linked_count || 0) > 0).length + derived.length,
      missing_mapping: missing,
      duplicates: findNearDuplicateGroups((await MedicationMaster.distinct('dosage_form', { is_deleted: false })).filter(Boolean)).length,
    },
  };
}

async function createDosageForm(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!nonEmpty(payload.name)) throw createError('name là bắt buộc.');
  const code = normalizeCode(payload.code) || await generateConfigCode(DosageForm, 'code', 'FORM');
  const created = await DosageForm.create({
    code,
    name: normalizeString(payload.name),
    english_name: normalizeString(payload.english_name) || undefined,
    form_group: payload.form_group || 'other',
    default_unit_id: payload.default_unit_id || undefined,
    default_route_id: payload.default_route_id || undefined,
    allowed_route_ids: payload.allowed_route_ids || [],
    sterile_required: Boolean(payload.sterile_required),
    high_risk: Boolean(payload.high_risk),
    label_instruction_template: payload.label_instruction_template,
    status: payload.status || 'active',
    description: payload.description,
    aliases: Array.isArray(payload.aliases) ? payload.aliases.map(normalizeString).filter(Boolean) : [],
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_config.dosage_form.create', targetType: 'dosage_form', targetId: created._id, status: 'success', message: 'Tạo dạng bào chế.', requestMeta });
  return getDosageFormDetail(created._id, actor);
}

async function getDosageFormDetail(formId, actor = {}) {
  assertConfigRead(actor);
  const dosage_form = await DosageForm.findById(formId)
    .populate('default_unit_id', 'code name symbol')
    .populate('default_route_id allowed_route_ids', 'code name english_name route_group risk_level')
    .lean();
  if (!dosage_form || dosage_form.is_deleted) throw createError('Không tìm thấy dạng bào chế.', 404);
  return {
    dosage_form: {
      ...dosage_form,
      medication_count: await countMedicationUsage({ textField: 'dosage_form', refField: 'dosage_form_id', doc: dosage_form }),
    },
  };
}

async function updateDosageForm(formId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const form = await DosageForm.findById(formId);
  if (!form || form.is_deleted) throw createError('Không tìm thấy dạng bào chế.', 404);
  const before = form.toObject();
  for (const field of ['name', 'english_name', 'form_group', 'label_instruction_template', 'status', 'description', 'default_unit_id', 'default_route_id']) {
    if (payload[field] !== undefined) form[field] = typeof payload[field] === 'string' ? normalizeString(payload[field]) : payload[field];
  }
  for (const field of ['sterile_required', 'high_risk']) {
    if (payload[field] !== undefined) form[field] = Boolean(payload[field]);
  }
  if (Array.isArray(payload.allowed_route_ids)) form.allowed_route_ids = payload.allowed_route_ids;
  if (Array.isArray(payload.aliases)) form.aliases = payload.aliases.map(normalizeString).filter(Boolean);
  form.updated_by = actorUserId(actor);
  await form.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.dosage_form.update', targetType: 'dosage_form', targetId: form._id, status: 'success', message: 'Cập nhật dạng bào chế.', requestMeta, before, after: form.toObject() });
  return getDosageFormDetail(form._id, actor);
}

async function getDosageFormMedications(formId, query = {}, actor = {}) {
  assertConfigRead(actor);
  const form = await DosageForm.findById(formId).lean();
  if (!form || form.is_deleted) throw createError('Không tìm thấy dạng bào chế.', 404);
  return listMedicationsByCatalogValue({ query, refField: 'dosage_form_id', textField: 'dosage_form', doc: form });
}

async function mergeDosageForms(formId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const target = await DosageForm.findById(formId);
  if (!target || target.is_deleted) throw createError('Không tìm thấy dạng bào chế đích.', 404);
  const sourceIds = (payload.source_ids || []).filter(Boolean);
  const sourceForms = sourceIds.length ? await DosageForm.find({ _id: { $in: sourceIds }, is_deleted: false }) : [];
  const sourceValues = [
    ...(payload.source_values || []),
    ...sourceForms.flatMap((item) => [item.code, item.name, item.english_name, ...(item.aliases || [])]),
  ].filter(nonEmpty);
  const filter = {
    is_deleted: false,
    $or: [
      ...(sourceIds.length ? [{ dosage_form_id: { $in: sourceIds } }] : []),
      ...(sourceValues.length ? [{ dosage_form: { $in: sourceValues } }] : []),
    ],
  };
  const result = filter.$or.length
    ? await MedicationMaster.updateMany(filter, { $set: { dosage_form: target.name, dosage_form_id: target._id, updated_by: actorUserId(actor) } })
    : { modifiedCount: 0 };
  if (sourceIds.length) {
    await DosageForm.updateMany(
      { _id: { $in: sourceIds } },
      { $set: { status: 'deprecated', deprecated_replacement_id: target._id, deprecated_at: new Date(), deprecated_by: actorUserId(actor), updated_by: actorUserId(actor) } },
    );
  }
  await recordAuditLog({ actor, action: 'pharmacy_config.dosage_form.merge', targetType: 'dosage_form', targetId: target._id, status: 'success', message: 'Gộp dạng bào chế.', requestMeta, metadata: { source_ids: sourceIds, source_values: sourceValues } });
  return { target_id: target._id, modified_count: result.modifiedCount || result.nModified || 0 };
}

async function mapDosageFormRoutes(formId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const form = await DosageForm.findById(formId);
  if (!form || form.is_deleted) throw createError('Không tìm thấy dạng bào chế.', 404);
  if (payload.default_route_id !== undefined) form.default_route_id = payload.default_route_id || undefined;
  if (Array.isArray(payload.allowed_route_ids)) form.allowed_route_ids = payload.allowed_route_ids;
  form.updated_by = actorUserId(actor);
  await form.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.dosage_form.route_mapping', targetType: 'dosage_form', targetId: form._id, status: 'success', message: 'Cập nhật mapping route cho dạng bào chế.', requestMeta });
  return getDosageFormDetail(form._id, actor);
}

async function listAdministrationRoutes(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = { is_deleted: false };
  addStatusFilter(filter, query);
  if (query.route_group) filter.route_group = query.route_group;
  if (query.risk_level) filter.risk_level = query.risk_level;
  applySearch(filter, query, ['code', 'name', 'english_name', 'aliases']);
  const [docs, total] = await Promise.all([
    AdministrationRoute.find(filter)
      .populate('allowed_dosage_form_ids', 'code name form_group')
      .sort({ status: 1, code: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdministrationRoute.countDocuments(filter),
  ]);
  const items = await Promise.all(docs.map(async (doc) => ({
    ...doc,
    medication_count: await countMedicationUsage({ textField: 'route_default', refField: 'route_default_id', doc }),
    linked_count: await countMedicationUsage({ textField: 'route_default', refField: 'route_default_id', doc }),
  })));
  const derived = booleanQuery(query.include_derived) || query.include_derived === undefined
    ? await buildDerivedMedicationCatalog({ docs, textField: 'route_default', query })
    : [];
  const missing = await MedicationMaster.countDocuments({ is_deleted: false, $or: [{ route_default: { $exists: false } }, { route_default: null }, { route_default: '' }] });
  return {
    items: [...items, ...derived],
    pagination: buildPagination(page, limit, total + derived.length),
    summary: {
      total_config: total + derived.length,
      active: items.filter((item) => item.status === 'active').length,
      linked: items.filter((item) => Number(item.linked_count || 0) > 0).length + derived.length,
      missing_mapping: missing,
      duplicates: findNearDuplicateGroups((await MedicationMaster.distinct('route_default', { is_deleted: false })).filter(Boolean)).length,
    },
  };
}

async function createAdministrationRoute(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!nonEmpty(payload.name)) throw createError('name là bắt buộc.');
  const code = normalizeCode(payload.code) || await generateConfigCode(AdministrationRoute, 'code', 'ROUTE');
  const created = await AdministrationRoute.create({
    code,
    name: normalizeString(payload.name),
    english_name: normalizeString(payload.english_name) || undefined,
    route_group: payload.route_group || 'other',
    requires_site: Boolean(payload.requires_site),
    requires_nurse_administration: Boolean(payload.requires_nurse_administration),
    outpatient_allowed: payload.outpatient_allowed !== false,
    inpatient_allowed: payload.inpatient_allowed !== false,
    allowed_dosage_form_ids: payload.allowed_dosage_form_ids || [],
    default_instruction_template: payload.default_instruction_template,
    risk_level: payload.risk_level || 'low',
    status: payload.status || 'active',
    description: payload.description,
    aliases: Array.isArray(payload.aliases) ? payload.aliases.map(normalizeString).filter(Boolean) : [],
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_config.route.create', targetType: 'administration_route', targetId: created._id, status: 'success', message: 'Tạo đường dùng thuốc.', requestMeta });
  return getAdministrationRouteDetail(created._id, actor);
}

async function getAdministrationRouteDetail(routeId, actor = {}) {
  assertConfigRead(actor);
  const route = await AdministrationRoute.findById(routeId)
    .populate('allowed_dosage_form_ids', 'code name form_group sterile_required high_risk')
    .lean();
  if (!route || route.is_deleted) throw createError('Không tìm thấy đường dùng.', 404);
  return {
    route: {
      ...route,
      medication_count: await countMedicationUsage({ textField: 'route_default', refField: 'route_default_id', doc: route }),
    },
  };
}

async function updateAdministrationRoute(routeId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const route = await AdministrationRoute.findById(routeId);
  if (!route || route.is_deleted) throw createError('Không tìm thấy đường dùng.', 404);
  const before = route.toObject();
  for (const field of ['name', 'english_name', 'route_group', 'default_instruction_template', 'risk_level', 'status', 'description']) {
    if (payload[field] !== undefined) route[field] = typeof payload[field] === 'string' ? normalizeString(payload[field]) : payload[field];
  }
  for (const field of ['requires_site', 'requires_nurse_administration', 'outpatient_allowed', 'inpatient_allowed']) {
    if (payload[field] !== undefined) route[field] = Boolean(payload[field]);
  }
  if (Array.isArray(payload.allowed_dosage_form_ids)) route.allowed_dosage_form_ids = payload.allowed_dosage_form_ids;
  if (Array.isArray(payload.aliases)) route.aliases = payload.aliases.map(normalizeString).filter(Boolean);
  route.updated_by = actorUserId(actor);
  await route.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.route.update', targetType: 'administration_route', targetId: route._id, status: 'success', message: 'Cập nhật đường dùng.', requestMeta, before, after: route.toObject() });
  return getAdministrationRouteDetail(route._id, actor);
}

async function getRouteMedications(routeId, query = {}, actor = {}) {
  assertConfigRead(actor);
  const route = await AdministrationRoute.findById(routeId).lean();
  if (!route || route.is_deleted) throw createError('Không tìm thấy đường dùng.', 404);
  return listMedicationsByCatalogValue({ query, refField: 'route_default_id', textField: 'route_default', doc: route });
}

async function mergeAdministrationRoutes(routeId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const target = await AdministrationRoute.findById(routeId);
  if (!target || target.is_deleted) throw createError('Không tìm thấy đường dùng đích.', 404);
  const sourceIds = (payload.source_ids || []).filter(Boolean);
  const sourceRoutes = sourceIds.length ? await AdministrationRoute.find({ _id: { $in: sourceIds }, is_deleted: false }) : [];
  const sourceValues = [
    ...(payload.source_values || []),
    ...sourceRoutes.flatMap((item) => [item.code, item.name, item.english_name, ...(item.aliases || [])]),
  ].filter(nonEmpty);
  const filter = {
    is_deleted: false,
    $or: [
      ...(sourceIds.length ? [{ route_default_id: { $in: sourceIds } }] : []),
      ...(sourceValues.length ? [{ route_default: { $in: sourceValues } }] : []),
    ],
  };
  const result = filter.$or.length
    ? await MedicationMaster.updateMany(filter, { $set: { route_default: target.name, route_default_id: target._id, updated_by: actorUserId(actor) } })
    : { modifiedCount: 0 };
  if (sourceIds.length) {
    await AdministrationRoute.updateMany(
      { _id: { $in: sourceIds } },
      { $set: { status: 'deprecated', deprecated_replacement_id: target._id, deprecated_at: new Date(), deprecated_by: actorUserId(actor), updated_by: actorUserId(actor) } },
    );
  }
  await recordAuditLog({ actor, action: 'pharmacy_config.route.merge', targetType: 'administration_route', targetId: target._id, status: 'success', message: 'Gộp đường dùng.', requestMeta, metadata: { source_ids: sourceIds, source_values: sourceValues } });
  return { target_id: target._id, modified_count: result.modifiedCount || result.nModified || 0 };
}

async function bulkAssignRoutes(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const medicationIds = payload.medication_ids || [];
  if (!medicationIds.length) throw createError('medication_ids là bắt buộc.');
  const route = payload.route_id ? await AdministrationRoute.findById(payload.route_id).lean() : null;
  const routeValue = payload.route || route?.name;
  if (!nonEmpty(routeValue)) throw createError('route hoặc route_id là bắt buộc.');
  const result = await MedicationMaster.updateMany(
    { _id: { $in: medicationIds }, is_deleted: false },
    { $set: { route_default: normalizeString(routeValue), route_default_id: route?._id, updated_by: actorUserId(actor) } },
  );
  await recordAuditLog({ actor, action: 'pharmacy_config.route.bulk_assign', targetType: 'administration_route', targetId: route?._id, status: 'success', message: 'Gán đường dùng hàng loạt.', requestMeta, metadata: { medication_ids: medicationIds, route: routeValue } });
  return { modified_count: result.modifiedCount || result.nModified || 0 };
}

async function listMedicationsByCatalogValue({ query = {}, refField, textField, doc }) {
  const { page, limit, skip } = getPagination(query, 30, 100);
  const rawAliases = [doc.code, doc.name, doc.symbol, doc.english_name, ...(doc.aliases || [])].filter(nonEmpty);
  const filter = {
    is_deleted: false,
    $or: [
      { [refField]: doc._id },
      ...(rawAliases.length ? [{ [textField]: { $in: rawAliases } }] : []),
    ],
  };
  applySearch(filter, query, ['medication_code', 'generic_name', 'brand_name', 'strength']);
  const [items, total] = await Promise.all([
    MedicationMaster.find(filter)
      .sort({ generic_name: 1, brand_name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MedicationMaster.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function routeCompatibilityCheck(payload = {}, actor = {}) {
  assertConfigRead(actor);
  const medication = payload.medication_id ? await MedicationMaster.findById(payload.medication_id).lean() : null;
  const route = payload.route_id ? await AdministrationRoute.findById(payload.route_id).lean() : null;
  const form = payload.dosage_form_id ? await DosageForm.findById(payload.dosage_form_id).lean() : null;
  const routeText = normalizeKey(route?.name || payload.route || medication?.route_default);
  const formText = normalizeKey(form?.name || payload.dosage_form || medication?.dosage_form);
  const warnings = [];
  const hardBlocks = [];
  if (form?.allowed_route_ids?.length && route && !form.allowed_route_ids.map(String).includes(String(route._id))) {
    hardBlocks.push('Đường dùng không nằm trong mapping được phép của dạng bào chế.');
  }
  if ((formText.includes('tiem') || formText.includes('inj')) && (routeText.includes('uong') || routeText.includes('oral') || routeText === 'po')) {
    hardBlocks.push('Dạng thuốc tiêm không tương thích với đường uống.');
  }
  if ((formText.includes('vien') || formText.includes('tablet') || formText.includes('cap')) && (routeText.includes('iv') || routeText.includes('tinh mach'))) {
    warnings.push('Dạng viên/nang đang gắn với route tiêm, cần rà soát.');
  }
  if (route?.requires_site) warnings.push('Route này yêu cầu nhập vị trí dùng thuốc khi eMAR.');
  if (route?.risk_level === 'high') warnings.push('Route rủi ro cao, nên yêu cầu double-check.');
  return {
    compatible: hardBlocks.length === 0,
    hard_blocks: hardBlocks,
    warnings,
    medication,
    route,
    dosage_form: form,
  };
}

async function listStorageLocations(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = { is_deleted: false };
  addStatusFilter(filter, query);
  for (const field of ['warehouse_id', 'parent_id', 'location_type', 'zone', 'shelf']) {
    if (query[field]) filter[field] = query[field];
  }
  applySearch(filter, query, ['location_code', 'code', 'name', 'zone', 'shelf', 'bin', 'temperature_zone']);
  const [docs, total] = await Promise.all([
    StorageLocation.find(filter)
      .populate('warehouse_id', 'warehouse_code name type')
      .populate('parent_id', 'location_code code name location_type')
      .sort({ location_code: 1, code: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StorageLocation.countDocuments(filter),
  ]);
  const items = await Promise.all(docs.map(async (doc) => ({
    ...doc,
    code: doc.code || doc.location_code,
    batch_count: await countBatchUsage({ textField: 'storage_location', refField: 'storage_location_id', doc: { ...doc, code: doc.code || doc.location_code } }),
    inventory_value: await calculateLocationInventoryValue(doc),
    near_expiry_count: await countNearExpiryBatches({ storage_location_id: doc._id, storage_location: doc.location_code || doc.code || doc.name }),
  })));
  const derived = booleanQuery(query.include_derived) || query.include_derived === undefined
    ? await buildDerivedBatchCatalog({ docs, textField: 'storage_location', query, mapItem: (row) => ({ batch_count: row.batch_count, location_type: 'unmapped', status: 'unmapped' }) })
    : [];
  const missing = await StockBatch.countDocuments({ is_deleted: false, $or: [{ storage_location_id: { $exists: false } }, { storage_location_id: null }], $and: [{ $or: [{ storage_location: { $exists: false } }, { storage_location: null }, { storage_location: '' }] }] });
  return {
    items: [...items, ...derived],
    pagination: buildPagination(page, limit, total + derived.length),
    summary: {
      total_config: total + derived.length,
      active: items.filter((item) => item.status === 'active').length,
      linked: items.filter((item) => Number(item.batch_count || 0) > 0).length + derived.length,
      missing_mapping: missing,
      duplicates: findNearDuplicateGroups((await StockBatch.distinct('storage_location', { is_deleted: false })).filter(Boolean)).length,
    },
  };
}

async function buildDerivedBatchCatalog({ docs, textField, query = {}, mapItem }) {
  const existingAliases = new Set();
  for (const doc of docs) {
    for (const key of valueAliases({ ...doc, code: doc.code || doc.location_code }, ['code', 'location_code', 'name'])) existingAliases.add(key);
  }
  const usageRows = await StockBatch.aggregate([
    { $match: { is_deleted: false, [textField]: { $nin: [null, ''] } } },
    { $group: { _id: `$${textField}`, batch_count: { $sum: 1 }, quantity_on_hand: { $sum: '$quantity_on_hand' }, inventory_value: { $sum: { $multiply: ['$quantity_on_hand', { $ifNull: ['$unit_cost', 0] }] } } } },
    { $sort: { batch_count: -1, _id: 1 } },
  ]);
  return usageRows
    .filter((row) => !existingAliases.has(normalizeKey(row._id)))
    .filter((row) => !query.search && !query.q ? true : normalizeKey(row._id).includes(normalizeKey(query.search || query.q)))
    .map((row) => ({
      id: `derived:${textField}:${row._id}`,
      _derived: true,
      code: normalizeCode(row._id).slice(0, 28) || 'UNMAPPED',
      name: row._id,
      status: 'unmapped',
      batch_count: row.batch_count,
      quantity_on_hand: row.quantity_on_hand,
      inventory_value: row.inventory_value,
      quality_flags: ['text_only'],
      missing_standard_mapping: true,
      ...(mapItem ? mapItem(row) : {}),
    }));
}

async function calculateLocationInventoryValue(location) {
  const aliases = [location.location_code, location.code, location.name].filter(nonEmpty);
  const match = {
    is_deleted: false,
    $or: [
      { storage_location_id: location._id },
      ...(aliases.length ? [{ storage_location: { $in: aliases } }] : []),
    ],
  };
  const [row] = await StockBatch.aggregate([
    { $match: match },
    { $group: { _id: null, value: { $sum: { $multiply: ['$quantity_on_hand', { $ifNull: ['$unit_cost', 0] }] } } } },
  ]);
  return row?.value || 0;
}

async function countNearExpiryBatches(filter = {}, days = 30) {
  const now = new Date();
  const until = new Date(now.getTime() + days * 86400000);
  const or = [];
  if (filter.storage_location_id) or.push({ storage_location_id: filter.storage_location_id });
  if (filter.storage_location) or.push({ storage_location: filter.storage_location });
  return StockBatch.countDocuments({
    is_deleted: false,
    ...(or.length ? { $or: or } : {}),
    quantity_on_hand: { $gt: 0 },
    expiry_date: { $gte: now, $lte: until },
  });
}

async function createStorageLocation(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!payload.warehouse_id && !payload.warehouse_code) {
    const fallbackWarehouse = await ensureDefaultWarehouse(actor);
    payload.warehouse_id = fallbackWarehouse._id;
  }
  const locationCode = normalizeCode(payload.location_code || payload.code) || await generateConfigCode(StorageLocation, 'location_code', 'LOC');
  const created = await StorageLocation.create({
    warehouse_id: payload.warehouse_id,
    location_code: locationCode,
    code: normalizeCode(payload.code || locationCode),
    name: normalizeString(payload.name) || locationCode,
    parent_id: payload.parent_id || undefined,
    location_type: payload.location_type || 'shelf',
    zone: normalizeString(payload.zone) || undefined,
    shelf: normalizeString(payload.shelf) || undefined,
    bin: normalizeString(payload.bin) || undefined,
    temperature_zone: normalizeString(payload.temperature_zone) || undefined,
    temperature_min: parseNonNegativeNumber(payload.temperature_min, 'temperature_min'),
    temperature_max: parseNonNegativeNumber(payload.temperature_max, 'temperature_max'),
    humidity_min: parseNonNegativeNumber(payload.humidity_min, 'humidity_min'),
    humidity_max: parseNonNegativeNumber(payload.humidity_max, 'humidity_max'),
    capacity: parseNonNegativeNumber(payload.capacity, 'capacity'),
    qr_code: payload.qr_code || `LOC:${locationCode}`,
    is_locked: Boolean(payload.is_locked),
    allow_controlled_drug: Boolean(payload.allow_controlled_drug),
    allow_quarantine: Boolean(payload.allow_quarantine),
    allow_recalled_stock: Boolean(payload.allow_recalled_stock),
    status: payload.status || 'active',
    note: payload.note || payload.description,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_config.storage_location.create', targetType: 'storage_location', targetId: created._id, status: 'success', message: 'Tạo vị trí lưu kho.', requestMeta });
  return getStorageLocationDetail(created._id, actor);
}

async function ensureDefaultWarehouse(actor = {}) {
  let warehouse = await Warehouse.findOne({ is_deleted: false, status: 'active' });
  if (warehouse) return warehouse;
  warehouse = await Warehouse.create({
    warehouse_code: 'PHARMACY',
    name: 'Kho dược',
    type: 'pharmacy',
    status: 'active',
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  return warehouse;
}

async function getStorageLocationDetail(locationId, actor = {}) {
  assertConfigRead(actor);
  const location = await StorageLocation.findById(locationId)
    .populate('warehouse_id', 'warehouse_code name type')
    .populate('parent_id', 'location_code code name location_type')
    .lean();
  if (!location || location.is_deleted) throw createError('Không tìm thấy vị trí lưu kho.', 404);
  return {
    storage_location: {
      ...location,
      code: location.code || location.location_code,
      batch_count: await countBatchUsage({ textField: 'storage_location', refField: 'storage_location_id', doc: { ...location, code: location.code || location.location_code } }),
      inventory_value: await calculateLocationInventoryValue(location),
      near_expiry_count: await countNearExpiryBatches({ storage_location_id: location._id, storage_location: location.location_code }),
    },
  };
}

async function updateStorageLocation(locationId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const location = await StorageLocation.findById(locationId);
  if (!location || location.is_deleted) throw createError('Không tìm thấy vị trí lưu kho.', 404);
  const before = location.toObject();
  for (const field of ['name', 'parent_id', 'location_type', 'zone', 'shelf', 'bin', 'temperature_zone', 'status', 'note', 'qr_code']) {
    if (payload[field] !== undefined) location[field] = typeof payload[field] === 'string' ? normalizeString(payload[field]) : payload[field];
  }
  for (const field of ['temperature_min', 'temperature_max', 'humidity_min', 'humidity_max', 'capacity']) {
    if (payload[field] !== undefined) location[field] = parseNonNegativeNumber(payload[field], field);
  }
  for (const field of ['is_locked', 'allow_controlled_drug', 'allow_quarantine', 'allow_recalled_stock']) {
    if (payload[field] !== undefined) location[field] = Boolean(payload[field]);
  }
  location.updated_by = actorUserId(actor);
  await location.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.storage_location.update', targetType: 'storage_location', targetId: location._id, status: 'success', message: 'Cập nhật vị trí lưu kho.', requestMeta, before, after: location.toObject() });
  return getStorageLocationDetail(location._id, actor);
}

async function setStorageLocationLock(locationId, locked, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const location = await StorageLocation.findById(locationId);
  if (!location || location.is_deleted) throw createError('Không tìm thấy vị trí lưu kho.', 404);
  location.is_locked = locked;
  location.status = locked ? 'locked' : (payload.status || 'active');
  location.note = payload.reason || payload.note || location.note;
  location.updated_by = actorUserId(actor);
  await location.save();
  await recordAuditLog({ actor, action: locked ? 'pharmacy_config.storage_location.lock' : 'pharmacy_config.storage_location.unlock', targetType: 'storage_location', targetId: location._id, status: 'success', message: locked ? 'Khóa vị trí lưu kho.' : 'Mở khóa vị trí lưu kho.', requestMeta });
  return getStorageLocationDetail(location._id, actor);
}

async function getStorageLocationBatches(locationId, query = {}, actor = {}) {
  assertConfigRead(actor);
  const location = await StorageLocation.findById(locationId).lean();
  if (!location || location.is_deleted) throw createError('Không tìm thấy vị trí lưu kho.', 404);
  const aliases = [location.location_code, location.code, location.name].filter(nonEmpty);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = {
    is_deleted: false,
    $or: [
      { storage_location_id: location._id },
      ...(aliases.length ? [{ storage_location: { $in: aliases } }] : []),
    ],
  };
  if (query.status) filter.status = query.status;
  applySearch(filter, query, ['batch_no', 'lot_no', 'supplier_name']);
  const [items, total] = await Promise.all([
    StockBatch.find(filter).populate('medication_id', 'medication_code generic_name brand_name strength unit status controlled_drug is_controlled_drug').sort({ expiry_date: 1 }).skip(skip).limit(limit).lean(),
    StockBatch.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getStorageLocationTransactions(locationId, query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = {
    $or: [
      { storage_location_id: locationId },
      { from_storage_location_id: locationId },
      { to_storage_location_id: locationId },
    ],
  };
  const [items, total] = await Promise.all([
    InventoryTransaction.find(filter).populate('medication_id', 'medication_code generic_name brand_name strength unit').populate('stock_batch_id', 'batch_no lot_no expiry_date status').sort({ occurred_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    InventoryTransaction.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function printStorageLocationQr(locationId, actor = {}) {
  assertConfigRead(actor);
  const detail = await getStorageLocationDetail(locationId, actor);
  const location = detail.storage_location;
  return {
    qr_code: location.qr_code || `LOC:${location.location_code || location.code}`,
    label: location.name || location.location_code || location.code,
    payload: {
      type: 'storage_location',
      storage_location_id: location._id || location.id,
      code: location.location_code || location.code,
    },
  };
}

async function bulkMoveBatches(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const batchIds = payload.batch_ids || [];
  if (!batchIds.length) throw createError('batch_ids là bắt buộc.');
  const location = payload.to_storage_location_id ? await StorageLocation.findById(payload.to_storage_location_id).lean() : null;
  const storageLocation = payload.to_storage_location || location?.location_code || location?.name;
  if (!nonEmpty(storageLocation) && !location) throw createError('to_storage_location hoặc to_storage_location_id là bắt buộc.');
  const results = [];
  for (const batchId of batchIds) {
    const result = await prescriptionService.transferStockBatchLocation(batchId, {
      to_storage_location_id: location?._id,
      to_storage_location: storageLocation,
      quantity: payload.quantity,
      reason: payload.reason || 'Chuyển vị trí hàng loạt từ Cấu hình dược.',
    }, actor, requestMeta);
    results.push(result);
  }
  return { moved_count: results.length, results };
}

async function startLocationCount(locationId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const detail = await getStorageLocationDetail(locationId, actor);
  await recordAuditLog({ actor, action: 'pharmacy_config.storage_location.start_count', targetType: 'storage_location', targetId: locationId, status: 'success', message: 'Bắt đầu kiểm kê theo vị trí.', requestMeta, metadata: payload });
  return {
    storage_location: detail.storage_location,
    count_session: {
      code: `COUNT-${detail.storage_location.location_code || detail.storage_location.code}-${Date.now()}`,
      status: 'draft',
      started_at: new Date(),
      note: payload.note,
    },
  };
}

async function listSuppliers(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = { is_deleted: false };
  addStatusFilter(filter, query);
  if (query.risk_level) filter.risk_level = query.risk_level;
  if (query.supplier_type) filter.supplier_type = query.supplier_type;
  applySearch(filter, query, ['code', 'name', 'tax_code', 'license_no', 'contact_person', 'phone', 'email', 'aliases']);
  const [docs, total] = await Promise.all([
    Supplier.find(filter).sort({ status: 1, name: 1 }).skip(skip).limit(limit).lean(),
    Supplier.countDocuments(filter),
  ]);
  const items = await Promise.all(docs.map(async (doc) => ({
    ...doc,
    batch_count: await countBatchUsage({ textField: 'supplier_name', refField: 'supplier_id', doc }),
    inventory_value: await calculateSupplierInventoryValue(doc),
    recall_count: await countSupplierBatches(doc, { status: STOCK_BATCH_STATUS.RECALLED }),
  })));
  const derived = booleanQuery(query.include_derived) || query.include_derived === undefined
    ? await buildDerivedBatchCatalog({ docs, textField: 'supplier_name', query, mapItem: (row) => ({ supplier_type: 'unmapped', status: 'unmapped', risk_level: 'medium' }) })
    : [];
  const missing = await StockBatch.countDocuments({ is_deleted: false, $or: [{ supplier_id: { $exists: false } }, { supplier_id: null }], $and: [{ $or: [{ supplier_name: { $exists: false } }, { supplier_name: null }, { supplier_name: '' }] }] });
  return {
    items: [...items, ...derived],
    pagination: buildPagination(page, limit, total + derived.length),
    summary: {
      total_config: total + derived.length,
      active: items.filter((item) => item.status === 'active').length,
      linked: items.filter((item) => Number(item.batch_count || 0) > 0).length + derived.length,
      missing_mapping: missing,
      duplicates: findNearDuplicateGroups((await StockBatch.distinct('supplier_name', { is_deleted: false })).filter(Boolean)).length,
    },
  };
}

async function calculateSupplierInventoryValue(supplier) {
  const aliases = [supplier.code, supplier.name, ...(supplier.aliases || [])].filter(nonEmpty);
  const match = {
    is_deleted: false,
    $or: [
      { supplier_id: supplier._id },
      ...(aliases.length ? [{ supplier_name: { $in: aliases } }] : []),
    ],
  };
  const [row] = await StockBatch.aggregate([
    { $match: match },
    { $group: { _id: null, value: { $sum: { $multiply: ['$quantity_on_hand', { $ifNull: ['$unit_cost', 0] }] } } } },
  ]);
  return row?.value || 0;
}

async function countSupplierBatches(supplier, extra = {}) {
  const aliases = [supplier.code, supplier.name, ...(supplier.aliases || [])].filter(nonEmpty);
  return StockBatch.countDocuments({
    is_deleted: false,
    ...extra,
    $or: [
      { supplier_id: supplier._id },
      ...(aliases.length ? [{ supplier_name: { $in: aliases } }] : []),
    ],
  });
}

async function createSupplier(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!nonEmpty(payload.name)) throw createError('name là bắt buộc.');
  const code = normalizeCode(payload.code) || await generateConfigCode(Supplier, 'code', 'SUP');
  const created = await Supplier.create({
    code,
    name: normalizeString(payload.name),
    supplier_type: payload.supplier_type || 'distributor',
    tax_code: normalizeString(payload.tax_code) || undefined,
    license_no: normalizeString(payload.license_no) || undefined,
    license_expiry_date: parseDate(payload.license_expiry_date, 'license_expiry_date'),
    phone: normalizeString(payload.phone) || undefined,
    email: normalizeString(payload.email) || undefined,
    address: normalizeString(payload.address) || undefined,
    contact_person: normalizeString(payload.contact_person) || undefined,
    status: payload.status || 'active',
    risk_level: payload.risk_level || 'low',
    note: payload.note,
    aliases: Array.isArray(payload.aliases) ? payload.aliases.map(normalizeString).filter(Boolean) : [],
    attachments: payload.attachments || [],
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_config.supplier.create', targetType: 'supplier', targetId: created._id, status: 'success', message: 'Tạo nhà cung cấp.', requestMeta });
  return getSupplierDetail(created._id, actor);
}

async function getSupplierDetail(supplierId, actor = {}) {
  assertConfigRead(actor);
  const supplier = await Supplier.findById(supplierId).lean();
  if (!supplier || supplier.is_deleted) throw createError('Không tìm thấy nhà cung cấp.', 404);
  return {
    supplier: {
      ...supplier,
      batch_count: await countSupplierBatches(supplier),
      inventory_value: await calculateSupplierInventoryValue(supplier),
      recall_count: await countSupplierBatches(supplier, { status: STOCK_BATCH_STATUS.RECALLED }),
      expired_count: await countSupplierBatches(supplier, { status: STOCK_BATCH_STATUS.EXPIRED }),
    },
  };
}

async function updateSupplier(supplierId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const supplier = await Supplier.findById(supplierId);
  if (!supplier || supplier.is_deleted) throw createError('Không tìm thấy nhà cung cấp.', 404);
  const before = supplier.toObject();
  for (const field of ['name', 'supplier_type', 'tax_code', 'license_no', 'phone', 'email', 'address', 'contact_person', 'status', 'risk_level', 'note']) {
    if (payload[field] !== undefined) supplier[field] = typeof payload[field] === 'string' ? normalizeString(payload[field]) : payload[field];
  }
  if (payload.license_expiry_date !== undefined) supplier.license_expiry_date = parseDate(payload.license_expiry_date, 'license_expiry_date');
  if (Array.isArray(payload.aliases)) supplier.aliases = payload.aliases.map(normalizeString).filter(Boolean);
  if (Array.isArray(payload.attachments)) supplier.attachments = payload.attachments;
  supplier.updated_by = actorUserId(actor);
  await supplier.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.supplier.update', targetType: 'supplier', targetId: supplier._id, status: 'success', message: 'Cập nhật nhà cung cấp.', requestMeta, before, after: supplier.toObject() });
  return getSupplierDetail(supplier._id, actor);
}

async function setSupplierBlocked(supplierId, blocked, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const supplier = await Supplier.findById(supplierId);
  if (!supplier || supplier.is_deleted) throw createError('Không tìm thấy nhà cung cấp.', 404);
  supplier.status = blocked ? 'blocked' : 'active';
  supplier.blocked_at = blocked ? new Date() : undefined;
  supplier.blocked_by = blocked ? actorUserId(actor) : undefined;
  supplier.block_reason = blocked ? payload.reason || payload.note : undefined;
  supplier.updated_by = actorUserId(actor);
  await supplier.save();
  await recordAuditLog({ actor, action: blocked ? 'pharmacy_config.supplier.block' : 'pharmacy_config.supplier.unblock', targetType: 'supplier', targetId: supplier._id, status: 'success', message: blocked ? 'Block nhà cung cấp.' : 'Mở block nhà cung cấp.', requestMeta });
  return getSupplierDetail(supplier._id, actor);
}

async function mergeSuppliers(supplierId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const target = await Supplier.findById(supplierId);
  if (!target || target.is_deleted) throw createError('Không tìm thấy NCC đích.', 404);
  const sourceIds = (payload.source_ids || []).filter(Boolean);
  const sourceSuppliers = sourceIds.length ? await Supplier.find({ _id: { $in: sourceIds }, is_deleted: false }) : [];
  const sourceValues = [
    ...(payload.source_values || []),
    ...sourceSuppliers.flatMap((item) => [item.code, item.name, ...(item.aliases || [])]),
  ].filter(nonEmpty);
  const filter = {
    is_deleted: false,
    $or: [
      ...(sourceIds.length ? [{ supplier_id: { $in: sourceIds } }] : []),
      ...(sourceValues.length ? [{ supplier_name: { $in: sourceValues } }] : []),
    ],
  };
  const result = filter.$or.length
    ? await StockBatch.updateMany(filter, { $set: { supplier_name: target.name, supplier_id: target._id, updated_by: actorUserId(actor) } })
    : { modifiedCount: 0 };
  if (sourceIds.length) {
    await Supplier.updateMany({ _id: { $in: sourceIds } }, { $set: { status: 'inactive', updated_by: actorUserId(actor) } });
  }
  await recordAuditLog({ actor, action: 'pharmacy_config.supplier.merge', targetType: 'supplier', targetId: target._id, status: 'success', message: 'Gộp nhà cung cấp.', requestMeta, metadata: { source_ids: sourceIds, source_values: sourceValues } });
  return { target_id: target._id, modified_count: result.modifiedCount || result.nModified || 0 };
}

async function getSupplierBatches(supplierId, query = {}, actor = {}) {
  assertConfigRead(actor);
  const supplier = await Supplier.findById(supplierId).lean();
  if (!supplier || supplier.is_deleted) throw createError('Không tìm thấy nhà cung cấp.', 404);
  const aliases = [supplier.code, supplier.name, ...(supplier.aliases || [])].filter(nonEmpty);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = {
    is_deleted: false,
    $or: [
      { supplier_id: supplier._id },
      ...(aliases.length ? [{ supplier_name: { $in: aliases } }] : []),
    ],
  };
  if (query.status) filter.status = query.status;
  applySearch(filter, query, ['batch_no', 'lot_no', 'storage_location']);
  const [items, total] = await Promise.all([
    StockBatch.find(filter).populate('medication_id', 'medication_code generic_name brand_name strength unit status').sort({ received_date: -1, expiry_date: 1 }).skip(skip).limit(limit).lean(),
    StockBatch.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getSupplierTransactions(supplierId, query = {}, actor = {}) {
  assertConfigRead(actor);
  const batches = await getSupplierBatches(supplierId, { limit: 100 }, actor);
  const batchIds = batches.items.map((item) => item._id);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = { stock_batch_id: { $in: batchIds } };
  const [items, total] = await Promise.all([
    InventoryTransaction.find(filter).populate('medication_id', 'medication_code generic_name brand_name strength unit').populate('stock_batch_id', 'batch_no lot_no expiry_date status supplier_name').sort({ occurred_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    InventoryTransaction.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getSupplierRiskDashboard(supplierId, actor = {}) {
  assertConfigRead(actor);
  const detail = await getSupplierDetail(supplierId, actor);
  const supplier = detail.supplier;
  const batches = await getSupplierBatches(supplierId, { limit: 500 }, actor);
  const now = new Date();
  const near = new Date(now.getTime() + 60 * 86400000);
  const rows = batches.items;
  return {
    supplier,
    quality: {
      total_batches: rows.length,
      recalled_batches: rows.filter((item) => item.status === STOCK_BATCH_STATUS.RECALLED).length,
      expired_batches: rows.filter((item) => item.status === STOCK_BATCH_STATUS.EXPIRED || (item.expiry_date && new Date(item.expiry_date) < now)).length,
      near_expiry_batches: rows.filter((item) => item.expiry_date && new Date(item.expiry_date) >= now && new Date(item.expiry_date) <= near).length,
      waste_signal: rows.filter((item) => item.status === STOCK_BATCH_STATUS.DEPLETED && Number(item.quantity_received || 0) > 0).length,
      inventory_value: supplier.inventory_value,
    },
  };
}

async function getQualityDashboard(query = {}, actor = {}) {
  assertConfigRead(actor);
  const now = new Date();
  const nearDays = Math.min(Math.max(Number(query.near_expiry_days || 30), 1), 365);
  const near = new Date(now.getTime() + nearDays * 86400000);
  const [
    totalMedications,
    totalBatches,
    missingUnit,
    missingDosageForm,
    missingRoute,
    missingLocation,
    missingSupplier,
    missingExpiry,
    expiredAvailable,
    availableZeroStock,
    depletedWithStock,
    nearExpiry,
    lowStockBatches,
    units,
    dosageForms,
    routes,
    locations,
    suppliers,
  ] = await Promise.all([
    MedicationMaster.countDocuments({ is_deleted: false }),
    StockBatch.countDocuments({ is_deleted: false }),
    MedicationMaster.countDocuments({ is_deleted: false, $or: [{ unit: { $exists: false } }, { unit: null }, { unit: '' }] }),
    MedicationMaster.countDocuments({ is_deleted: false, $or: [{ dosage_form: { $exists: false } }, { dosage_form: null }, { dosage_form: '' }] }),
    MedicationMaster.countDocuments({ is_deleted: false, $or: [{ route_default: { $exists: false } }, { route_default: null }, { route_default: '' }] }),
    StockBatch.countDocuments({ is_deleted: false, $or: [{ storage_location: { $exists: false } }, { storage_location: null }, { storage_location: '' }] }),
    StockBatch.countDocuments({ is_deleted: false, $or: [{ supplier_name: { $exists: false } }, { supplier_name: null }, { supplier_name: '' }] }),
    StockBatch.countDocuments({ is_deleted: false, $or: [{ expiry_date: { $exists: false } }, { expiry_date: null }] }),
    StockBatch.countDocuments({ is_deleted: false, status: STOCK_BATCH_STATUS.AVAILABLE, quantity_on_hand: { $gt: 0 }, expiry_date: { $lt: now } }),
    StockBatch.countDocuments({ is_deleted: false, status: STOCK_BATCH_STATUS.AVAILABLE, quantity_on_hand: 0 }),
    StockBatch.countDocuments({ is_deleted: false, status: STOCK_BATCH_STATUS.DEPLETED, quantity_on_hand: { $gt: 0 } }),
    StockBatch.countDocuments({ is_deleted: false, quantity_on_hand: { $gt: 0 }, expiry_date: { $gte: now, $lte: near } }),
    StockBatch.countDocuments({ is_deleted: false, quantity_on_hand: { $gt: 0 }, $expr: { $lte: ['$quantity_on_hand', '$min_stock_level'] } }),
    MedicationMaster.distinct('unit', { is_deleted: false }),
    MedicationMaster.distinct('dosage_form', { is_deleted: false }),
    MedicationMaster.distinct('route_default', { is_deleted: false }),
    StockBatch.distinct('storage_location', { is_deleted: false }),
    StockBatch.distinct('supplier_name', { is_deleted: false }),
  ]);
  const duplicateUnits = findNearDuplicateGroups(units);
  const duplicateDosageForms = findNearDuplicateGroups(dosageForms);
  const duplicateRoutes = findNearDuplicateGroups(routes);
  const duplicateLocations = findNearDuplicateGroups(locations);
  const duplicateSuppliers = findNearDuplicateGroups(suppliers);
  const issueCount = missingUnit + missingDosageForm + missingRoute + missingLocation + missingSupplier + expiredAvailable + availableZeroStock + depletedWithStock + duplicateUnits.length + duplicateDosageForms.length + duplicateRoutes.length + duplicateLocations.length + duplicateSuppliers.length;
  const denominator = Math.max(totalMedications * 3 + totalBatches * 2, 1);
  const score = Math.max(0, Math.min(100, Math.round(100 - (issueCount / denominator) * 100)));
  const recommendations = [
    expiredAvailable ? { severity: 'critical', title: `${expiredAvailable} lô đã hết hạn nhưng vẫn available`, action: 'mark_expired_bulk', to: '/pharmacy/config/expiry-policies' } : null,
    missingLocation ? { severity: 'high', title: `${missingLocation} lô thiếu vị trí lưu kho`, action: 'assign_location', to: '/pharmacy/config/storage-locations' } : null,
    lowStockBatches ? { severity: 'high', title: `${lowStockBatches} lô dưới ngưỡng tối thiểu`, action: 'review_threshold', to: '/pharmacy/config/alert-thresholds' } : null,
    duplicateUnits.length ? { severity: 'medium', title: `${duplicateUnits.length} nhóm đơn vị nghi trùng`, action: 'merge_units', to: '/pharmacy/config/units' } : null,
    missingSupplier ? { severity: 'medium', title: `${missingSupplier} lô thiếu nhà cung cấp`, action: 'assign_supplier', to: '/pharmacy/config/suppliers' } : null,
  ].filter(Boolean);
  return {
    score,
    total_medications: totalMedications,
    total_batches: totalBatches,
    medication_missing_unit: missingUnit,
    medication_missing_dosage_form: missingDosageForm,
    medication_missing_route: missingRoute,
    batch_missing_location: missingLocation,
    batch_missing_supplier: missingSupplier,
    batch_missing_expiry_date: missingExpiry,
    duplicate_units: duplicateUnits,
    duplicate_dosage_forms: duplicateDosageForms,
    duplicate_routes: duplicateRoutes,
    duplicate_storage_locations: duplicateLocations,
    duplicate_suppliers: duplicateSuppliers,
    expired_available_batches: expiredAvailable,
    available_zero_stock_batches: availableZeroStock,
    depleted_with_stock_batches: depletedWithStock,
    near_expiry_batches: nearExpiry,
    low_stock_batches: lowStockBatches,
    recommendations,
    generated_at: new Date(),
  };
}

async function runQualityCheck(query = {}, actor = {}, requestMeta = {}) {
  assertConfigRead(actor);
  const dashboard = await getQualityDashboard(query, actor);
  await recordAuditLog({ actor, action: 'pharmacy_config.quality_check.run', targetType: 'pharmacy_config', targetId: null, status: 'success', message: 'Chạy kiểm tra chất lượng cấu hình dược.', requestMeta, metadata: { score: dashboard.score } });
  return dashboard;
}

async function listAlertRules(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = { is_deleted: false };
  addStatusFilter(filter, query);
  if (query.alert_type) filter.alert_type = query.alert_type;
  if (query.scope_type) filter.scope_type = query.scope_type;
  if (query.enabled !== undefined) filter.enabled = booleanQuery(query.enabled);
  applySearch(filter, query, ['rule_code', 'code', 'name', 'alert_type', 'storage_location', 'supplier_name']);
  const [items, total] = await Promise.all([
    PharmacyAlertRule.find(filter)
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .populate('warehouse_id', 'warehouse_code name')
      .populate('storage_location_id', 'location_code code name')
      .populate('supplier_id', 'code name status risk_level')
      .sort({ enabled: -1, severity: 1, alert_type: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PharmacyAlertRule.countDocuments(filter),
  ]);
  return {
    items: items.map(normalizeAlertRuleOutput),
    pagination: buildPagination(page, limit, total),
    summary: {
      total_config: total,
      active: items.filter((item) => item.enabled && item.status !== 'inactive').length,
      inactive: items.filter((item) => !item.enabled || item.status === 'inactive').length,
      critical: items.filter((item) => item.severity === 'critical').length,
    },
  };
}

function normalizeAlertRuleOutput(item = {}) {
  return {
    ...item,
    code: item.code || item.rule_code,
    name: item.name || item.rule_code || item.alert_type,
    status: item.status || (item.enabled ? 'active' : 'inactive'),
    threshold_value: item.threshold_value ?? item.threshold_quantity ?? item.threshold_days ?? item.threshold_ratio,
    threshold_unit: item.threshold_unit || (item.threshold_days !== undefined ? 'day' : item.threshold_ratio !== undefined ? 'percent' : 'quantity'),
    recipient_roles: item.recipient_roles?.length ? item.recipient_roles : item.notify_roles,
    channels: item.channels?.length ? item.channels : ['in_app', ...(item.is_realtime_enabled === false ? [] : ['realtime']), ...(item.is_email_enabled ? ['email'] : [])],
  };
}

async function createAlertRule(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!nonEmpty(payload.alert_type)) throw createError('alert_type là bắt buộc.');
  const ruleCode = normalizeCode(payload.rule_code || payload.code) || await generateConfigCode(PharmacyAlertRule, 'rule_code', 'AR');
  const thresholdUnit = payload.threshold_unit || 'quantity';
  const thresholdValue = parseNonNegativeNumber(payload.threshold_value, 'threshold_value', payload.threshold_quantity || payload.threshold_days || payload.threshold_ratio);
  const created = await PharmacyAlertRule.create({
    rule_code: ruleCode,
    code: ruleCode,
    name: normalizeString(payload.name) || ruleCode,
    alert_type: payload.alert_type,
    enabled: payload.enabled !== false && payload.status !== 'inactive',
    status: payload.status || 'active',
    severity: payload.severity || 'medium',
    scope_type: payload.scope_type || 'global',
    scope_id: payload.scope_id,
    medication_id: payload.medication_id,
    warehouse_id: payload.warehouse_id,
    storage_location_id: payload.storage_location_id,
    supplier_id: payload.supplier_id,
    storage_location: payload.storage_location,
    supplier_name: payload.supplier_name,
    condition_operator: payload.condition_operator || 'lte',
    threshold_value: thresholdValue,
    threshold_unit: thresholdUnit,
    threshold_quantity: thresholdUnit === 'quantity' ? thresholdValue : payload.threshold_quantity,
    threshold_days: thresholdUnit === 'day' ? thresholdValue : payload.threshold_days,
    threshold_ratio: thresholdUnit === 'percent' ? thresholdValue : payload.threshold_ratio,
    window_days: payload.window_days,
    sla_minutes: payload.sla_minutes,
    recipient_roles: payload.recipient_roles || payload.notify_roles || ['pharmacist', 'inventory_staff', 'admin'],
    notify_roles: payload.notify_roles || payload.recipient_roles || ['pharmacist', 'inventory_staff', 'admin'],
    notify_users: payload.notify_users || [],
    channels: payload.channels || ['in_app', 'realtime'],
    is_realtime_enabled: payload.is_realtime_enabled !== false,
    is_email_enabled: Boolean(payload.is_email_enabled),
    cooldown_minutes: parseNonNegativeNumber(payload.cooldown_minutes, 'cooldown_minutes', 60),
    auto_create_alert: payload.auto_create_alert !== false,
    auto_resolve: Boolean(payload.auto_resolve),
    metadata: payload.metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_config.alert_rule.create', targetType: 'pharmacy_alert_rule', targetId: created._id, status: 'success', message: 'Tạo rule cảnh báo dược.', requestMeta });
  return getAlertRuleDetail(created._id, actor);
}

async function getAlertRuleDetail(ruleId, actor = {}) {
  assertConfigRead(actor);
  const rule = await PharmacyAlertRule.findById(ruleId)
    .populate('medication_id', 'medication_code generic_name brand_name strength')
    .populate('warehouse_id', 'warehouse_code name')
    .populate('storage_location_id', 'location_code code name')
    .populate('supplier_id', 'code name status risk_level')
    .lean();
  if (!rule || rule.is_deleted) throw createError('Không tìm thấy rule cảnh báo.', 404);
  return { alert_rule: normalizeAlertRuleOutput(rule) };
}

async function updateAlertRule(ruleId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const rule = await PharmacyAlertRule.findById(ruleId);
  if (!rule || rule.is_deleted) throw createError('Không tìm thấy rule cảnh báo.', 404);
  const before = rule.toObject();
  for (const field of ['name', 'alert_type', 'status', 'severity', 'scope_type', 'scope_id', 'medication_id', 'warehouse_id', 'storage_location_id', 'supplier_id', 'storage_location', 'supplier_name', 'condition_operator', 'threshold_unit', 'window_days', 'sla_minutes']) {
    if (payload[field] !== undefined) rule[field] = payload[field];
  }
  if (payload.enabled !== undefined) rule.enabled = Boolean(payload.enabled);
  if (payload.status !== undefined) rule.enabled = payload.status !== 'inactive';
  if (payload.threshold_value !== undefined) {
    rule.threshold_value = parseNonNegativeNumber(payload.threshold_value, 'threshold_value');
    if ((payload.threshold_unit || rule.threshold_unit) === 'quantity') rule.threshold_quantity = rule.threshold_value;
    if ((payload.threshold_unit || rule.threshold_unit) === 'day') rule.threshold_days = rule.threshold_value;
    if ((payload.threshold_unit || rule.threshold_unit) === 'percent') rule.threshold_ratio = rule.threshold_value;
  }
  if (Array.isArray(payload.recipient_roles)) rule.recipient_roles = payload.recipient_roles;
  if (Array.isArray(payload.notify_roles)) rule.notify_roles = payload.notify_roles;
  if (Array.isArray(payload.notify_users)) rule.notify_users = payload.notify_users;
  if (Array.isArray(payload.channels)) rule.channels = payload.channels;
  if (payload.is_realtime_enabled !== undefined) rule.is_realtime_enabled = Boolean(payload.is_realtime_enabled);
  if (payload.is_email_enabled !== undefined) rule.is_email_enabled = Boolean(payload.is_email_enabled);
  if (payload.cooldown_minutes !== undefined) rule.cooldown_minutes = parseNonNegativeNumber(payload.cooldown_minutes, 'cooldown_minutes', 60);
  if (payload.metadata !== undefined) rule.metadata = payload.metadata;
  rule.updated_by = actorUserId(actor);
  await rule.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.alert_rule.update', targetType: 'pharmacy_alert_rule', targetId: rule._id, status: 'success', message: 'Cập nhật rule cảnh báo.', requestMeta, before, after: rule.toObject() });
  return getAlertRuleDetail(rule._id, actor);
}

async function setAlertRuleActive(ruleId, active, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const rule = await PharmacyAlertRule.findById(ruleId);
  if (!rule || rule.is_deleted) throw createError('Không tìm thấy rule cảnh báo.', 404);
  rule.enabled = active;
  rule.status = active ? 'active' : 'inactive';
  rule.updated_by = actorUserId(actor);
  await rule.save();
  await recordAuditLog({ actor, action: active ? 'pharmacy_config.alert_rule.activate' : 'pharmacy_config.alert_rule.deactivate', targetType: 'pharmacy_alert_rule', targetId: rule._id, status: 'success', message: active ? 'Bật rule cảnh báo.' : 'Tắt rule cảnh báo.', requestMeta });
  return getAlertRuleDetail(rule._id, actor);
}

async function previewAlertRules(query = {}, actor = {}) {
  assertConfigRead(actor);
  const rules = await PharmacyAlertRule.find({ is_deleted: false, enabled: true, status: { $ne: 'inactive' } }).limit(50).lean();
  const previews = await Promise.all(rules.map((rule) => testAlertRule(rule._id, query, actor).catch((error) => ({ rule_id: rule._id, error: error.message }))));
  return { items: previews, total: previews.length };
}

async function testAlertRule(ruleId, payload = {}, actor = {}) {
  assertConfigRead(actor);
  const rule = await PharmacyAlertRule.findById(ruleId).lean();
  if (!rule || rule.is_deleted) throw createError('Không tìm thấy rule cảnh báo.', 404);
  const normalized = normalizeAlertRuleOutput(rule);
  const now = new Date();
  let impacted = [];
  if (normalized.alert_type === 'low_stock' || normalized.alert_type === 'out_of_stock') {
    const threshold = normalized.alert_type === 'out_of_stock' ? 0 : Number(normalized.threshold_value ?? normalized.threshold_quantity ?? 0);
    const operator = normalized.alert_type === 'out_of_stock' ? '$lte' : '$lte';
    impacted = await StockBatch.find({
      is_deleted: false,
      ...(rule.medication_id ? { medication_id: rule.medication_id } : {}),
      ...(rule.storage_location_id ? { storage_location_id: rule.storage_location_id } : {}),
      ...(rule.storage_location ? { storage_location: rule.storage_location } : {}),
      quantity_on_hand: { [operator]: threshold },
    }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(Number(payload.limit || 25)).lean();
  } else if (normalized.alert_type === 'near_expiry' || normalized.alert_type === 'expired') {
    const days = normalized.alert_type === 'expired' ? 0 : Number(normalized.threshold_value ?? normalized.threshold_days ?? 30);
    const until = new Date(now.getTime() + days * 86400000);
    impacted = await StockBatch.find({
      is_deleted: false,
      quantity_on_hand: { $gt: 0 },
      ...(normalized.alert_type === 'expired' ? { expiry_date: { $lt: now } } : { expiry_date: { $gte: now, $lte: until } }),
    }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(Number(payload.limit || 25)).lean();
  } else if (normalized.alert_type === 'recall') {
    impacted = await StockBatch.find({ is_deleted: false, status: STOCK_BATCH_STATUS.RECALLED }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(Number(payload.limit || 25)).lean();
  }
  return {
    alert_rule: normalized,
    impacted_count: impacted.length,
    impacted_items: impacted,
    would_notify_roles: normalized.recipient_roles || normalized.notify_roles || [],
    tested_at: new Date(),
  };
}

async function listExpiryPolicies(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = { is_deleted: false };
  addStatusFilter(filter, query);
  if (query.scope_type) filter.scope_type = query.scope_type;
  if (query.picking_strategy) filter.picking_strategy = query.picking_strategy;
  applySearch(filter, query, ['code', 'name', 'description']);
  const [items, total] = await Promise.all([
    PharmacyExpiryPolicy.find(filter)
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .populate('dosage_form_id', 'code name form_group')
      .populate('storage_location_id', 'location_code code name')
      .populate('warehouse_id', 'warehouse_code name')
      .sort({ status: 1, scope_type: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PharmacyExpiryPolicy.countDocuments(filter),
  ]);
  const quality = await getExpiryQualityCheck(query, actor);
  return {
    items,
    pagination: buildPagination(page, limit, total),
    summary: {
      total_config: total,
      active: items.filter((item) => item.status === 'active').length,
      strict_fefo: items.filter((item) => item.picking_strategy === 'FEFO' && item.block_expired_batch).length,
      ...quality.summary,
    },
  };
}

async function createExpiryPolicy(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!nonEmpty(payload.name)) throw createError('name là bắt buộc.');
  const code = normalizeCode(payload.code) || await generateConfigCode(PharmacyExpiryPolicy, 'code', 'EXP');
  const created = await PharmacyExpiryPolicy.create({
    code,
    name: normalizeString(payload.name),
    scope_type: payload.scope_type || 'global',
    scope_id: payload.scope_id,
    medication_id: payload.medication_id,
    dosage_form_id: payload.dosage_form_id,
    storage_location_id: payload.storage_location_id,
    warehouse_id: payload.warehouse_id,
    picking_strategy: payload.picking_strategy || 'FEFO',
    block_expired_batch: payload.block_expired_batch !== false,
    block_near_expiry_days: parseNonNegativeNumber(payload.block_near_expiry_days, 'block_near_expiry_days'),
    allow_no_expiry_date: payload.allow_no_expiry_date !== false,
    allow_override: Boolean(payload.allow_override),
    override_requires_reason: payload.override_requires_reason !== false,
    override_requires_approval: Boolean(payload.override_requires_approval),
    near_expiry_alert_days: parseNonNegativeNumber(payload.near_expiry_alert_days, 'near_expiry_alert_days', 30),
    auto_mark_expired: Boolean(payload.auto_mark_expired),
    status: payload.status || 'active',
    description: payload.description,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_config.expiry_policy.create', targetType: 'pharmacy_expiry_policy', targetId: created._id, status: 'success', message: 'Tạo chính sách FEFO/expiry.', requestMeta });
  return getExpiryPolicyDetail(created._id, actor);
}

async function getExpiryPolicyDetail(policyId, actor = {}) {
  assertConfigRead(actor);
  const expiry_policy = await PharmacyExpiryPolicy.findById(policyId)
    .populate('medication_id', 'medication_code generic_name brand_name strength')
    .populate('dosage_form_id', 'code name form_group')
    .populate('storage_location_id', 'location_code code name')
    .populate('warehouse_id', 'warehouse_code name')
    .lean();
  if (!expiry_policy || expiry_policy.is_deleted) throw createError('Không tìm thấy chính sách expiry.', 404);
  return { expiry_policy };
}

async function updateExpiryPolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const policy = await PharmacyExpiryPolicy.findById(policyId);
  if (!policy || policy.is_deleted) throw createError('Không tìm thấy chính sách expiry.', 404);
  const before = policy.toObject();
  for (const field of ['name', 'scope_type', 'scope_id', 'medication_id', 'dosage_form_id', 'storage_location_id', 'warehouse_id', 'picking_strategy', 'status', 'description']) {
    if (payload[field] !== undefined) policy[field] = typeof payload[field] === 'string' ? normalizeString(payload[field]) : payload[field];
  }
  for (const field of ['block_expired_batch', 'allow_no_expiry_date', 'allow_override', 'override_requires_reason', 'override_requires_approval', 'auto_mark_expired']) {
    if (payload[field] !== undefined) policy[field] = Boolean(payload[field]);
  }
  for (const field of ['block_near_expiry_days', 'near_expiry_alert_days']) {
    if (payload[field] !== undefined) policy[field] = parseNonNegativeNumber(payload[field], field);
  }
  policy.updated_by = actorUserId(actor);
  await policy.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.expiry_policy.update', targetType: 'pharmacy_expiry_policy', targetId: policy._id, status: 'success', message: 'Cập nhật chính sách expiry.', requestMeta, before, after: policy.toObject() });
  return getExpiryPolicyDetail(policy._id, actor);
}

async function setExpiryPolicyActive(policyId, active, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const policy = await PharmacyExpiryPolicy.findById(policyId);
  if (!policy || policy.is_deleted) throw createError('Không tìm thấy chính sách expiry.', 404);
  policy.status = active ? 'active' : 'inactive';
  policy.updated_by = actorUserId(actor);
  await policy.save();
  await recordAuditLog({ actor, action: active ? 'pharmacy_config.expiry_policy.activate' : 'pharmacy_config.expiry_policy.deactivate', targetType: 'pharmacy_expiry_policy', targetId: policy._id, status: 'success', message: active ? 'Bật chính sách expiry.' : 'Tắt chính sách expiry.', requestMeta });
  return getExpiryPolicyDetail(policy._id, actor);
}

async function testExpiryPolicy(policyId, payload = {}, actor = {}) {
  assertConfigRead(actor);
  const policy = await PharmacyExpiryPolicy.findById(policyId).lean();
  if (!policy || policy.is_deleted) throw createError('Không tìm thấy chính sách expiry.', 404);
  if (!payload.medication_id && !policy.medication_id) {
    const sample = await MedicationMaster.findOne({ is_deleted: false, status: 'active' }).lean();
    if (sample) payload.medication_id = sample._id;
  }
  const simulator = await getFefoSimulator({
    medication_id: payload.medication_id || policy.medication_id,
    quantity: payload.quantity || 1,
    storage_location: payload.storage_location,
    storage_location_id: payload.storage_location_id || policy.storage_location_id,
    allow_partial: payload.allow_partial,
  }, actor);
  return {
    expiry_policy: policy,
    simulator,
    compliance: {
      strategy_applied: policy.picking_strategy || 'FEFO',
      blocked_expired: policy.block_expired_batch,
      override_required_reason: policy.allow_override && policy.override_requires_reason,
      warnings: simulator.warnings || [],
    },
  };
}

async function getFefoSimulator(query = {}, actor = {}) {
  assertConfigRead(actor);
  const medicationId = query.medication_id || query.medicationId;
  if (!medicationId) throw createError('medication_id là bắt buộc.');
  const quantity = parseNonNegativeNumber(query.quantity, 'quantity', 1) || 1;
  const options = {
    storage_location: query.storage_location,
    allowPartial: booleanQuery(query.allow_partial || query.allowPartial),
  };
  if (query.storage_location_id && !options.storage_location) {
    const location = await StorageLocation.findById(query.storage_location_id).lean();
    options.storage_location = location?.location_code || location?.code || location?.name;
  }
  const allocations = await prescriptionService.selectStockBatch(medicationId, quantity, options);
  const batchIds = allocations.map((item) => item.stock_batch_id).filter(Boolean);
  const batchDocs = batchIds.length
    ? await StockBatch.find({ _id: { $in: batchIds } }).lean()
    : [];
  const batchById = new Map(batchDocs.map((item) => [String(item._id), item]));
  const warnings = [];
  const selectedQuantity = allocations.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (selectedQuantity < quantity) warnings.push('Không đủ tồn theo FEFO với bộ lọc hiện tại.');
  return {
    requested_quantity: quantity,
    selected_quantity: selectedQuantity,
    shortage_quantity: Math.max(quantity - selectedQuantity, 0),
    allocations,
    strategy: 'FEFO',
    rows: allocations.map((allocation, index) => {
      const batch = batchById.get(String(allocation.stock_batch_id)) || {};
      return {
      order: index + 1,
      stock_batch_id: allocation.stock_batch_id,
      batch_no: batch.batch_no,
      lot_no: batch.lot_no,
      expiry_date: batch.expiry_date,
      received_date: batch.received_date,
      storage_location: batch.storage_location,
      quantity_on_hand: batch.quantity_on_hand,
      suggested_quantity: allocation.quantity,
      reason: index === 0 ? 'Hết hạn sớm nhất còn khả dụng' : 'Cần thêm tồn để đủ số lượng yêu cầu',
      };
    }),
    warnings,
  };
}

async function getExpiryQualityCheck(query = {}, actor = {}) {
  assertConfigRead(actor);
  const now = new Date();
  const days = Math.min(Math.max(Number(query.near_expiry_days || 30), 1), 365);
  const near = new Date(now.getTime() + days * 86400000);
  const [
    expiredAvailable,
    noExpiry,
    depletedWithStock,
    availableZero,
    nearExpiryHighStock,
    recalled,
  ] = await Promise.all([
    StockBatch.find({ is_deleted: false, status: STOCK_BATCH_STATUS.AVAILABLE, quantity_on_hand: { $gt: 0 }, expiry_date: { $lt: now } }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(50).lean(),
    StockBatch.find({ is_deleted: false, $or: [{ expiry_date: { $exists: false } }, { expiry_date: null }] }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(50).lean(),
    StockBatch.find({ is_deleted: false, status: STOCK_BATCH_STATUS.DEPLETED, quantity_on_hand: { $gt: 0 } }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(50).lean(),
    StockBatch.find({ is_deleted: false, status: STOCK_BATCH_STATUS.AVAILABLE, quantity_on_hand: 0 }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(50).lean(),
    StockBatch.find({ is_deleted: false, quantity_on_hand: { $gt: 0 }, expiry_date: { $gte: now, $lte: near } }).sort({ quantity_on_hand: -1 }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(50).lean(),
    StockBatch.find({ is_deleted: false, status: STOCK_BATCH_STATUS.RECALLED }).populate('medication_id', 'medication_code generic_name brand_name strength unit').limit(50).lean(),
  ]);
  return {
    summary: {
      expired_available_batches: expiredAvailable.length,
      no_expiry_batches: noExpiry.length,
      depleted_with_stock_batches: depletedWithStock.length,
      available_zero_stock_batches: availableZero.length,
      near_expiry_high_stock_batches: nearExpiryHighStock.length,
      recalled_batches: recalled.length,
    },
    groups: {
      expired_available: expiredAvailable,
      no_expiry: noExpiry,
      depleted_with_stock: depletedWithStock,
      available_zero_stock: availableZero,
      near_expiry_high_stock: nearExpiryHighStock,
      recalled,
    },
  };
}

async function markExpiredBulk(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  let batchIds = payload.batch_ids || [];
  if (!batchIds.length && payload.only_available !== false) {
    const now = new Date();
    const rows = await StockBatch.find({ is_deleted: false, status: STOCK_BATCH_STATUS.AVAILABLE, quantity_on_hand: { $gt: 0 }, expiry_date: { $lt: now } }).select('_id').limit(Number(payload.limit || 100)).lean();
    batchIds = rows.map((item) => item._id);
  }
  const results = [];
  for (const batchId of batchIds) {
    try {
      results.push(await prescriptionService.markBatchExpired(batchId, { reason: payload.reason || 'Đánh dấu hết hạn hàng loạt từ Cấu hình dược.' }, actor, requestMeta));
    } catch (error) {
      results.push({ batch_id: batchId, error: error.message });
    }
  }
  return { requested_count: batchIds.length, processed_count: results.filter((item) => !item.error).length, results };
}

async function listControlledDrugPolicies(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = { is_deleted: false };
  addStatusFilter(filter, query);
  if (query.controlled_type) filter.controlled_type = query.controlled_type;
  applySearch(filter, query, ['code', 'name', 'description']);
  const [items, total, controlledMedicationCount] = await Promise.all([
    ControlledDrugPolicy.find(filter).populate('medication_ids', 'medication_code generic_name brand_name strength unit status').sort({ status: 1, name: 1 }).skip(skip).limit(limit).lean(),
    ControlledDrugPolicy.countDocuments(filter),
    MedicationMaster.countDocuments({ is_deleted: false, $or: [{ controlled_drug: true }, { is_controlled_drug: true }, { high_alert_medication: true }] }),
  ]);
  return {
    items: items.map((item) => ({ ...item, medication_count: item.medication_ids?.length || 0 })),
    pagination: buildPagination(page, limit, total),
    summary: {
      total_config: total,
      active: items.filter((item) => item.status === 'active').length,
      controlled_medications: controlledMedicationCount,
      double_check_required: items.filter((item) => item.requires_double_check).length,
      locked_storage_required: items.filter((item) => item.requires_locked_storage).length,
    },
  };
}

async function createControlledDrugPolicy(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!nonEmpty(payload.name)) throw createError('name là bắt buộc.');
  const code = normalizeCode(payload.code) || await generateConfigCode(ControlledDrugPolicy, 'code', 'CDP');
  const created = await ControlledDrugPolicy.create({
    code,
    name: normalizeString(payload.name),
    controlled_type: payload.controlled_type || 'high_alert',
    medication_ids: payload.medication_ids || [],
    requires_double_check: payload.requires_double_check !== false,
    requires_witness: Boolean(payload.requires_witness),
    requires_locked_storage: Boolean(payload.requires_locked_storage),
    requires_shift_count: Boolean(payload.requires_shift_count),
    requires_reason_for_adjustment: payload.requires_reason_for_adjustment !== false,
    requires_approval_for_waste: payload.requires_approval_for_waste !== false,
    outpatient_dispense_allowed: payload.outpatient_dispense_allowed !== false,
    inpatient_administration_allowed: payload.inpatient_administration_allowed !== false,
    max_dispense_quantity: parseNonNegativeNumber(payload.max_dispense_quantity, 'max_dispense_quantity'),
    status: payload.status || 'active',
    description: payload.description,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  if (payload.apply_now) await applyControlledDrugPolicy(created._id, { medication_ids: created.medication_ids }, actor, requestMeta);
  await recordAuditLog({ actor, action: 'pharmacy_config.controlled_policy.create', targetType: 'controlled_drug_policy', targetId: created._id, status: 'success', message: 'Tạo chính sách thuốc kiểm soát.', requestMeta });
  return getControlledDrugPolicyDetail(created._id, actor);
}

async function getControlledDrugPolicyDetail(policyId, actor = {}) {
  assertConfigRead(actor);
  const controlled_drug_policy = await ControlledDrugPolicy.findById(policyId)
    .populate('medication_ids', 'medication_code generic_name brand_name strength unit status controlled_drug is_controlled_drug high_alert_medication')
    .lean();
  if (!controlled_drug_policy || controlled_drug_policy.is_deleted) throw createError('Không tìm thấy chính sách thuốc kiểm soát.', 404);
  return { controlled_drug_policy };
}

async function updateControlledDrugPolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const policy = await ControlledDrugPolicy.findById(policyId);
  if (!policy || policy.is_deleted) throw createError('Không tìm thấy chính sách thuốc kiểm soát.', 404);
  const before = policy.toObject();
  for (const field of ['name', 'controlled_type', 'status', 'description']) {
    if (payload[field] !== undefined) policy[field] = typeof payload[field] === 'string' ? normalizeString(payload[field]) : payload[field];
  }
  if (Array.isArray(payload.medication_ids)) policy.medication_ids = payload.medication_ids;
  for (const field of ['requires_double_check', 'requires_witness', 'requires_locked_storage', 'requires_shift_count', 'requires_reason_for_adjustment', 'requires_approval_for_waste', 'outpatient_dispense_allowed', 'inpatient_administration_allowed']) {
    if (payload[field] !== undefined) policy[field] = Boolean(payload[field]);
  }
  if (payload.max_dispense_quantity !== undefined) policy.max_dispense_quantity = parseNonNegativeNumber(payload.max_dispense_quantity, 'max_dispense_quantity');
  policy.updated_by = actorUserId(actor);
  await policy.save();
  if (payload.apply_now) await applyControlledDrugPolicy(policy._id, { medication_ids: policy.medication_ids }, actor, requestMeta);
  await recordAuditLog({ actor, action: 'pharmacy_config.controlled_policy.update', targetType: 'controlled_drug_policy', targetId: policy._id, status: 'success', message: 'Cập nhật chính sách thuốc kiểm soát.', requestMeta, before, after: policy.toObject() });
  return getControlledDrugPolicyDetail(policy._id, actor);
}

async function applyControlledDrugPolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  const policy = await ControlledDrugPolicy.findById(policyId);
  if (!policy || policy.is_deleted) throw createError('Không tìm thấy chính sách thuốc kiểm soát.', 404);
  const medicationIds = payload.medication_ids || policy.medication_ids || [];
  if (!medicationIds.length) throw createError('medication_ids là bắt buộc.');
  const result = await MedicationMaster.updateMany(
    { _id: { $in: medicationIds }, is_deleted: false },
    {
      $set: {
        controlled_drug: true,
        is_controlled_drug: true,
        controlled_drug_type: policy.controlled_type,
        controlled_drug_policy_id: policy._id,
        high_alert_medication: policy.controlled_type === 'high_alert' ? true : undefined,
        requires_double_check: policy.requires_double_check,
        requires_witness: policy.requires_witness,
        requires_locked_storage: policy.requires_locked_storage,
        updated_by: actorUserId(actor),
      },
    },
  );
  policy.medication_ids = [...new Set([...policy.medication_ids.map(String), ...medicationIds.map(String)])];
  policy.updated_by = actorUserId(actor);
  await policy.save();
  await recordAuditLog({ actor, action: 'pharmacy_config.controlled_policy.apply_medications', targetType: 'controlled_drug_policy', targetId: policy._id, status: 'success', message: 'Áp dụng chính sách thuốc kiểm soát.', requestMeta, metadata: { medication_ids: medicationIds } });
  return { modified_count: result.modifiedCount || result.nModified || 0, policy_id: policy._id };
}

async function listControlledDrugLedger(query = {}, actor = {}) {
  assertConfigRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const filter = {};
  for (const field of ['medication_id', 'stock_batch_id', 'transaction_id', 'prescription_id', 'dispense_id', 'patient_id', 'action_type', 'performed_by']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.date_from || query.date_to) {
    filter.occurred_at = {};
    if (query.date_from) filter.occurred_at.$gte = parseDate(query.date_from, 'date_from');
    if (query.date_to) filter.occurred_at.$lte = parseDate(query.date_to, 'date_to');
  }
  const [items, total] = await Promise.all([
    ControlledDrugLedger.find(filter)
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location status')
      .populate('performed_by witnessed_by approved_by', 'full_name username')
      .sort({ occurred_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ControlledDrugLedger.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function createControlledLedgerEntry(payload = {}, actor = {}, requestMeta = {}) {
  assertConfigWrite(actor);
  if (!payload.medication_id) throw createError('medication_id là bắt buộc.');
  if (!payload.action_type) throw createError('action_type là bắt buộc.');
  const created = await ControlledDrugLedger.create({
    medication_id: payload.medication_id,
    stock_batch_id: payload.stock_batch_id,
    transaction_id: payload.transaction_id,
    prescription_id: payload.prescription_id,
    dispense_id: payload.dispense_id,
    patient_id: payload.patient_id,
    action_type: payload.action_type,
    quantity: parseNonNegativeNumber(payload.quantity, 'quantity', 0),
    balance_after: parseNonNegativeNumber(payload.balance_after, 'balance_after'),
    performed_by: payload.performed_by || actorUserId(actor),
    witnessed_by: payload.witnessed_by,
    approved_by: payload.approved_by,
    reason: payload.reason,
    occurred_at: parseDate(payload.occurred_at, 'occurred_at') || new Date(),
    metadata: payload.metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: `pharmacy_config.controlled_ledger.${payload.action_type}`, targetType: 'controlled_drug_ledger', targetId: created._id, status: 'success', message: 'Ghi sổ thuốc kiểm soát.', requestMeta });
  return { ledger: created };
}

function shiftCountControlledLedger(payload = {}, actor = {}, requestMeta = {}) {
  return createControlledLedgerEntry({ ...payload, action_type: 'count' }, actor, requestMeta);
}

function wasteApprovalControlledLedger(payload = {}, actor = {}, requestMeta = {}) {
  return createControlledLedgerEntry({ ...payload, action_type: 'waste_approval', approved_by: payload.approved_by || actorUserId(actor) }, actor, requestMeta);
}

function doubleCheckControlledLedger(payload = {}, actor = {}, requestMeta = {}) {
  return createControlledLedgerEntry({ ...payload, action_type: 'double_check', witnessed_by: payload.witnessed_by || actorUserId(actor) }, actor, requestMeta);
}

async function listCatalogQuality(type, actor = {}) {
  assertConfigRead(actor);
  const dashboard = await getQualityDashboard({}, actor);
  const map = {
    units: dashboard.duplicate_units,
    'dosage-forms': dashboard.duplicate_dosage_forms,
    routes: dashboard.duplicate_routes,
    'storage-locations': dashboard.duplicate_storage_locations,
    suppliers: dashboard.duplicate_suppliers,
  };
  return { duplicate_groups: map[type] || [], dashboard };
}

module.exports = {
  bulkAssignRoutes,
  bulkAssignUnits,
  bulkMoveBatches,
  createAdministrationRoute,
  createAlertRule,
  createControlledDrugPolicy,
  createControlledLedgerEntry,
  createDosageForm,
  createExpiryPolicy,
  createMedicationUnit,
  createStorageLocation,
  createSupplier,
  doubleCheckControlledLedger,
  getAdministrationRouteDetail,
  getDosageFormDetail,
  getDosageFormMedications,
  getExpiryPolicyDetail,
  getExpiryQualityCheck,
  getFefoSimulator,
  getMedicationUnitDetail,
  getQualityDashboard,
  getRouteMedications,
  getStorageLocationBatches,
  getStorageLocationDetail,
  getStorageLocationTransactions,
  getSupplierBatches,
  getSupplierDetail,
  getSupplierRiskDashboard,
  getSupplierTransactions,
  getUnitMedications,
  getControlledDrugPolicyDetail,
  listAdministrationRoutes,
  listAlertRules,
  listCatalogQuality,
  listControlledDrugLedger,
  listControlledDrugPolicies,
  listDosageForms,
  listExpiryPolicies,
  listMedicationUnits,
  listStorageLocations,
  listSuppliers,
  mapDosageFormRoutes,
  markExpiredBulk,
  mergeAdministrationRoutes,
  mergeDosageForms,
  mergeMedicationUnits,
  mergeSuppliers,
  previewAlertRules,
  printStorageLocationQr,
  routeCompatibilityCheck,
  runQualityCheck,
  setAlertRuleActive,
  setExpiryPolicyActive,
  setStorageLocationLock,
  setSupplierBlocked,
  shiftCountControlledLedger,
  startLocationCount,
  testAlertRule,
  testExpiryPolicy,
  updateAdministrationRoute,
  updateAlertRule,
  updateControlledDrugPolicy,
  updateDosageForm,
  updateExpiryPolicy,
  updateMedicationUnit,
  updateStorageLocation,
  updateSupplier,
  applyControlledDrugPolicy,
};
