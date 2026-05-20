const {
  ClinicalOpsSlaEvent,
  ClinicalOpsSlaRule,
  EquipmentDowntime,
  ImagingEquipment,
  ImagingModality,
  ImagingOrder,
  ImagingReportTemplate,
  ImagingRoom,
  LabOrder,
  LabResult,
  LabTestCatalog,
  PreparationChecklistTemplate,
  ProcedureCatalog,
  ProcedureOrder,
  ResultReportTemplate,
  ServiceCatalog,
  Specimen,
  SpecimenTypeCatalog,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const USER_SELECT = 'full_name employee_code username';
const SERVICE_SELECT = 'service_code service_name service_type unit_price currency is_billable status effective_from effective_to';
const DEPARTMENT_SELECT = 'code name department_code department_name';

function toId(value) {
  if (!value) return null;
  return String(value._id || value.id || value);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || actor.user?._id || null;
}

function parseBoolean(value, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'active'].includes(String(value).toLowerCase());
}

function parseNumber(value, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const number = Number(value);
  if (Number.isNaN(number)) return defaultValue;
  return number;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function upper(value) {
  return normalizeString(value).toUpperCase();
}

function searchRegex(value) {
  const normalized = normalizeString(value);
  return normalized ? { $regex: escapeRegex(normalized), $options: 'i' } : null;
}

function compactService(service) {
  if (!service || typeof service !== 'object') return null;
  return {
    id: toId(service),
    service_code: service.service_code,
    service_name: service.service_name,
    service_type: service.service_type,
    unit_price: service.unit_price,
    currency: service.currency,
    is_billable: service.is_billable,
    status: service.status,
  };
}

function compactUser(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    id: toId(user),
    name: user.full_name || user.username || user.employee_code,
    code: user.employee_code,
  };
}

function warning(code, label, severity = 'warning', impact = 'medium') {
  return { code, label, severity, impact };
}

function labWarnings(item) {
  const warnings = [];
  if (!item.specimen_type && !item.specimen_type_id) warnings.push(warning('missing_specimen_type', 'Chưa gắn loại mẫu', 'high', 'order_entry'));
  if (!item.price_service_id) warnings.push(warning('missing_service_price', 'Chưa gắn giá dịch vụ', 'high', 'billing'));
  if (!item.reference_ranges?.length && !item.result_items?.some((row) => row.reference_range)) warnings.push(warning('missing_reference_range', 'Thiếu reference range', 'warning', 'result_entry'));
  if (!item.result_items?.length) warnings.push(warning('missing_result_items', 'Chưa có item template', 'warning', 'result_entry'));
  return warnings;
}

function specimenWarnings(item, testCount = 0) {
  const warnings = [];
  if (!item.container_type) warnings.push(warning('missing_container', 'Thiếu container/tube', 'high', 'collection'));
  if (!item.reject_reasons?.length) warnings.push(warning('missing_reject_rules', 'Thiếu reject criteria', 'warning', 'quality'));
  if (!item.storage_temperature && !item.transport_max_minutes) warnings.push(warning('missing_transport_policy', 'Thiếu điều kiện vận chuyển', 'warning', 'transport'));
  if (testCount === 0) warnings.push(warning('unused_specimen_type', 'Chưa có xét nghiệm sử dụng', 'info', 'catalog'));
  return warnings;
}

function modalityWarnings(item, rooms = [], templates = []) {
  const warnings = [];
  if (!item.duration_minutes) warnings.push(warning('missing_duration', 'Thiếu duration mặc định', 'warning', 'scheduling'));
  if (item.room_required && !rooms.some((room) => room.active)) warnings.push(warning('missing_active_room', 'Chưa có phòng active', 'high', 'scheduling'));
  if (!templates.some((template) => template.active)) warnings.push(warning('missing_report_template', 'Thiếu report template active', 'warning', 'reporting'));
  return warnings;
}

function procedureWarnings(item) {
  const warnings = [];
  if (!item.default_duration_minutes) warnings.push(warning('missing_duration', 'Thiếu duration mặc định', 'warning', 'scheduling'));
  if (!item.default_service_id) warnings.push(warning('missing_service_price', 'Chưa gắn giá dịch vụ', 'high', 'billing'));
  if (item.requires_preparation && !item.checklist_template_id) warnings.push(warning('missing_checklist', 'Chưa gắn checklist', 'high', 'patient_safety'));
  if (item.requires_consent && !item.consent_template_id) warnings.push(warning('missing_consent_template', 'Chưa gắn consent template', 'warning', 'consent'));
  return warnings;
}

function checklistWarnings(item) {
  const warnings = [];
  if (!item.items?.length) warnings.push(warning('empty_checklist', 'Checklist chưa có item', 'high', 'patient_safety'));
  if (!item.items?.some((row) => row.required)) warnings.push(warning('no_required_item', 'Không có required item', 'warning', 'quality'));
  if (item.is_default && !item.is_active) warnings.push(warning('inactive_default', 'Default nhưng inactive', 'critical', 'automation'));
  return warnings;
}

function templateWarnings(item) {
  const warnings = [];
  if (!item.sections?.length) warnings.push(warning('missing_sections', 'Template chưa có section', 'high', 'reporting'));
  if (item.is_default && item.status !== 'active') warnings.push(warning('default_not_active', 'Default nhưng chưa active', 'critical', 'reporting'));
  return warnings;
}

function addWarnings(items, fn) {
  return items.map((item) => {
    const config_warnings = fn(item);
    return { ...item, config_warnings, warning_count: config_warnings.length };
  });
}

async function pagedFind(Model, query = {}, { filter = {}, searchFields = [], sort = { created_at: -1 }, populate = [] } = {}) {
  const { page, limit, skip } = getPagination(query, 50, 200);
  const finalFilter = { ...filter };
  const regex = searchRegex(query.search || query.keyword);
  if (regex && searchFields.length) finalFilter.$or = searchFields.map((field) => ({ [field]: regex }));
  if (query.active !== undefined) finalFilter.active = parseBoolean(query.active);
  if (query.is_active !== undefined) finalFilter.is_active = parseBoolean(query.is_active);
  if (query.status) finalFilter.status = query.status;
  const findQuery = Model.find(finalFilter).sort(sort).skip(skip).limit(limit);
  populate.forEach((item) => findQuery.populate(item));
  const [items, total] = await Promise.all([findQuery.lean(), Model.countDocuments(finalFilter)]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function recordConfigAudit({ actor, action, targetType, targetId, message, requestMeta, before, after, metadata }) {
  return recordAuditLog({
    actor,
    action,
    targetType,
    targetId,
    status: 'success',
    message,
    requestMeta,
    before,
    after,
    metadata,
  });
}

function assignPayload(doc, payload, fields) {
  fields.forEach((field) => {
    if (payload[field] !== undefined) doc[field] = payload[field];
  });
}

async function updateById(Model, id, payload, fields, actor, requestMeta, audit) {
  const doc = await Model.findById(id);
  if (!doc) throw createError('Không tìm thấy cấu hình.', 404);
  const before = doc.toObject();
  assignPayload(doc, payload, fields);
  doc.updated_by = actorUserId(actor);
  await doc.save();
  await recordConfigAudit({ actor, ...audit, targetId: doc._id, requestMeta, before, after: doc.toObject() });
  return doc.toObject();
}

async function overview() {
  const [
    labTests,
    specimenTypes,
    modalities,
    rooms,
    equipment,
    procedures,
    checklists,
    slaRules,
    imagingTemplates,
    reportTemplates,
  ] = await Promise.all([
    LabTestCatalog.find({}).populate('price_service_id', SERVICE_SELECT).lean(),
    SpecimenTypeCatalog.find({}).lean(),
    ImagingModality.find({}).lean(),
    ImagingRoom.find({}).lean(),
    ImagingEquipment.find({}).lean(),
    ProcedureCatalog.find({}).populate('default_service_id', SERVICE_SELECT).populate('checklist_template_id', 'template_code name is_active is_default').lean(),
    PreparationChecklistTemplate.find({}).lean(),
    ClinicalOpsSlaRule.find({}).lean(),
    ImagingReportTemplate.find({}).lean(),
    ResultReportTemplate.find({}).lean(),
  ]);

  const roomsByModality = new Map();
  rooms.forEach((room) => {
    const key = room.modality;
    if (!roomsByModality.has(key)) roomsByModality.set(key, []);
    roomsByModality.get(key).push(room);
  });
  const templatesByModality = new Map();
  imagingTemplates.forEach((template) => {
    const key = template.modality;
    if (!templatesByModality.has(key)) templatesByModality.set(key, []);
    templatesByModality.get(key).push(template);
  });
  const testsBySpecimen = new Map();
  labTests.forEach((test) => {
    const key = toId(test.specimen_type_id) || test.specimen_type;
    if (!key) return;
    testsBySpecimen.set(key, (testsBySpecimen.get(key) || 0) + 1);
  });

  const issueRows = [
    ...labTests.flatMap((item) => labWarnings(item).map((issue) => ({ type: 'lab_test', code: item.code, name: item.name, item_id: toId(item), ...issue }))),
    ...specimenTypes.flatMap((item) => specimenWarnings(item, testsBySpecimen.get(toId(item)) || testsBySpecimen.get(item.name) || 0).map((issue) => ({ type: 'specimen_type', code: item.code, name: item.name, item_id: toId(item), ...issue }))),
    ...modalities.flatMap((item) => modalityWarnings(item, roomsByModality.get(item.code) || [], templatesByModality.get(item.code) || []).map((issue) => ({ type: 'imaging_modality', code: item.code, name: item.name, item_id: toId(item), ...issue }))),
    ...rooms.filter((room) => room.active && room.maintenance_status !== 'available').map((room) => ({ type: 'imaging_room', code: room.code, name: room.name, item_id: toId(room), ...warning('room_unavailable', 'Phòng đang maintenance/offline', 'high', 'scheduling') })),
    ...equipment.filter((item) => item.status !== 'available').map((item) => ({ type: 'imaging_equipment', code: item.code, name: item.name, item_id: toId(item), ...warning('equipment_unavailable', 'Thiết bị không available', 'high', 'scheduling') })),
    ...procedures.flatMap((item) => procedureWarnings(item).map((issue) => ({ type: 'procedure_catalog', code: item.code, name: item.name, item_id: toId(item), ...issue }))),
    ...checklists.flatMap((item) => checklistWarnings(item).map((issue) => ({ type: 'checklist_template', code: item.template_code, name: item.name, item_id: toId(item), ...issue }))),
    ...reportTemplates.flatMap((item) => templateWarnings(item).map((issue) => ({ type: 'report_template', code: item.template_code, name: item.name, item_id: toId(item), ...issue }))),
  ];

  function score(total, issueCount) {
    if (!total) return 100;
    return Math.max(0, Math.round(100 - (issueCount / total) * 22));
  }

  return {
    summary: {
      lab_tests_active: labTests.filter((item) => item.active).length,
      specimen_types_active: specimenTypes.filter((item) => item.active).length,
      imaging_modalities_active: modalities.filter((item) => item.active).length,
      imaging_rooms_active: rooms.filter((item) => item.active).length,
      imaging_equipment_active: equipment.filter((item) => item.status === 'available').length,
      procedure_catalog_active: procedures.filter((item) => item.active).length,
      checklist_templates_active: checklists.filter((item) => item.is_active).length,
      sla_rules_active: slaRules.filter((item) => item.active).length,
      report_templates_active: reportTemplates.filter((item) => item.status === 'active').length + imagingTemplates.filter((item) => item.active).length,
      config_issues: issueRows.length,
    },
    health: [
      { key: 'lab_catalog', label: 'Lab catalog completeness', score: score(labTests.length, issueRows.filter((item) => item.type === 'lab_test').length) },
      { key: 'specimen_mapping', label: 'Specimen mapping', score: score(specimenTypes.length || labTests.length, issueRows.filter((item) => item.type === 'specimen_type' || item.code === 'missing_specimen_type').length) },
      { key: 'imaging_readiness', label: 'Imaging scheduling readiness', score: score(modalities.length + rooms.length, issueRows.filter((item) => item.type?.startsWith('imaging')).length) },
      { key: 'procedure_billing', label: 'Procedure billing readiness', score: score(procedures.length, issueRows.filter((item) => item.type === 'procedure_catalog').length) },
      { key: 'sla_coverage', label: 'SLA coverage', score: score(8, Math.max(0, 8 - slaRules.filter((item) => item.active).length)) },
      { key: 'template_coverage', label: 'Report template coverage', score: score(reportTemplates.length + imagingTemplates.length, issueRows.filter((item) => item.type === 'report_template').length) },
    ],
    issues: issueRows.slice(0, 120),
  };
}

async function listLabTests(query = {}) {
  const data = await pagedFind(LabTestCatalog, query, {
    searchFields: ['code', 'name', 'category', 'specimen_type'],
    filter: {
      ...(query.category ? { category: query.category } : {}),
      ...(query.specimen_type ? { specimen_type: query.specimen_type } : {}),
    },
    sort: { active: -1, category: 1, name: 1 },
    populate: [
      { path: 'price_service_id', select: SERVICE_SELECT },
      { path: 'specimen_type_id', select: 'code name container_type tube_color active' },
    ],
  });
  return { ...data, items: addWarnings(data.items, labWarnings) };
}

async function getLabTest(id) {
  const item = await LabTestCatalog.findById(id)
    .populate('price_service_id', SERVICE_SELECT)
    .populate('specimen_type_id', 'code name category container_type tube_color additive active reject_reasons')
    .populate('created_by updated_by', USER_SELECT)
    .lean();
  if (!item) throw createError('Không tìm thấy lab test catalog.', 404);
  return { item: { ...item, config_warnings: labWarnings(item) }, usage: await labTestUsage(id, item.code) };
}

async function createLabTest(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.code || !payload.name) throw createError('code và name là bắt buộc.', 400);
  if (await LabTestCatalog.exists({ code: upper(payload.code) })) throw createError('Mã xét nghiệm đã tồn tại.', 409);
  const item = await LabTestCatalog.create({
    ...payload,
    code: upper(payload.code),
    name: normalizeString(payload.name),
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordConfigAudit({ actor, action: 'clinical_config.lab_test.created', targetType: 'lab_test_catalog', targetId: item._id, message: 'Tạo lab test catalog.', requestMeta, after: item.toObject() });
  return getLabTest(item._id);
}

async function updateLabTest(id, payload = {}, actor = {}, requestMeta = {}) {
  if (payload.code) {
    const exists = await LabTestCatalog.exists({ code: upper(payload.code), _id: { $ne: id } });
    if (exists) throw createError('Mã xét nghiệm đã tồn tại.', 409);
    payload.code = upper(payload.code);
  }
  await updateById(LabTestCatalog, id, payload, [
    'code',
    'name',
    'category',
    'specimen_type',
    'specimen_type_id',
    'container_type',
    'collection_instruction',
    'unit',
    'reference_ranges',
    'result_items',
    'turnaround_minutes',
    'price_service_id',
    'active',
    'metadata',
  ], actor, requestMeta, { action: 'clinical_config.lab_test.updated', targetType: 'lab_test_catalog', message: 'Cập nhật lab test catalog.' });
  return getLabTest(id);
}

async function cloneLabTest(id, payload = {}, actor = {}, requestMeta = {}) {
  const source = await LabTestCatalog.findById(id).lean();
  if (!source) throw createError('Không tìm thấy lab test catalog.', 404);
  return createLabTest({
    ...source,
    _id: undefined,
    code: payload.code || `${source.code}_COPY_${Date.now()}`,
    name: payload.name || `${source.name} - bản sao`,
    active: payload.active ?? false,
  }, actor, requestMeta);
}

async function retireLabTest(id, actor = {}, requestMeta = {}) {
  return updateLabTest(id, { active: false }, actor, requestMeta);
}

async function linkLabTestService(id, payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.service_id && !payload.price_service_id) throw createError('service_id là bắt buộc.', 400);
  return updateLabTest(id, { price_service_id: payload.service_id || payload.price_service_id }, actor, requestMeta);
}

async function labTestUsage(id, code) {
  const [orders7d, orders30d, resultCount, specimenRejected] = await Promise.all([
    LabOrder.countDocuments({ test_code: code, ordered_at: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    LabOrder.countDocuments({ test_code: code, ordered_at: { $gte: new Date(Date.now() - 30 * 86400000) } }),
    LabResult.countDocuments({ lab_order_id: { $in: await LabOrder.distinct('_id', { test_code: code }) } }),
    Specimen.countDocuments({ status: 'rejected', lab_order_id: { $in: await LabOrder.distinct('_id', { test_code: code }) } }),
  ]);
  return { orders_7d: orders7d, orders_30d: orders30d, result_count: resultCount, rejected_specimens: specimenRejected };
}

async function listSpecimenTypes(query = {}) {
  const data = await pagedFind(SpecimenTypeCatalog, query, {
    searchFields: ['code', 'name', 'category', 'container_type', 'tube_color'],
    filter: { ...(query.category ? { category: query.category } : {}) },
    sort: { active: -1, category: 1, name: 1 },
  });
  const usageMap = new Map((await LabTestCatalog.aggregate([{ $group: { _id: '$specimen_type_id', count: { $sum: 1 } } }])).map((row) => [toId(row._id), row.count]));
  return {
    ...data,
    items: data.items.map((item) => {
      const testCount = usageMap.get(toId(item)) || 0;
      return { ...item, test_count: testCount, config_warnings: specimenWarnings(item, testCount) };
    }),
  };
}

async function createSpecimenType(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.code || !payload.name) throw createError('code và name là bắt buộc.', 400);
  const item = await SpecimenTypeCatalog.create({
    ...payload,
    code: upper(payload.code),
    name: normalizeString(payload.name),
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordConfigAudit({ actor, action: 'clinical_config.specimen_type.created', targetType: 'specimen_type_catalog', targetId: item._id, message: 'Tạo specimen type catalog.', requestMeta, after: item.toObject() });
  return { item };
}

async function getSpecimenType(id) {
  const item = await SpecimenTypeCatalog.findById(id).populate('created_by updated_by', USER_SELECT).lean();
  if (!item) throw createError('Không tìm thấy loại mẫu.', 404);
  const tests = await LabTestCatalog.find({ $or: [{ specimen_type_id: id }, { specimen_type: item.name }, { specimen_type: item.code }] }).select('code name category active').lean();
  return { item: { ...item, test_count: tests.length, config_warnings: specimenWarnings(item, tests.length) }, tests };
}

async function updateSpecimenType(id, payload = {}, actor = {}, requestMeta = {}) {
  if (payload.code) payload.code = upper(payload.code);
  await updateById(SpecimenTypeCatalog, id, payload, [
    'code',
    'name',
    'category',
    'description',
    'container_type',
    'tube_color',
    'additive',
    'min_volume_ml',
    'max_volume_ml',
    'storage_temperature',
    'transport_max_minutes',
    'stability_minutes',
    'barcode_prefix',
    'label_template',
    'reject_reasons',
    'disposal_policy',
    'active',
    'metadata',
  ], actor, requestMeta, { action: 'clinical_config.specimen_type.updated', targetType: 'specimen_type_catalog', message: 'Cập nhật specimen type catalog.' });
  return getSpecimenType(id);
}

async function cloneSpecimenType(id, payload = {}, actor = {}, requestMeta = {}) {
  const source = await SpecimenTypeCatalog.findById(id).lean();
  if (!source) throw createError('Không tìm thấy loại mẫu.', 404);
  return createSpecimenType({
    ...source,
    _id: undefined,
    code: payload.code || `${source.code}_COPY_${Date.now()}`,
    name: payload.name || `${source.name} - bản sao`,
    active: payload.active ?? false,
  }, actor, requestMeta);
}

async function retireSpecimenType(id, actor = {}, requestMeta = {}) {
  return updateSpecimenType(id, { active: false }, actor, requestMeta);
}

async function listImagingModalities(query = {}) {
  const data = await pagedFind(ImagingModality, query, {
    searchFields: ['code', 'name'],
    sort: { active: -1, code: 1 },
  });
  const [rooms, templates] = await Promise.all([ImagingRoom.find({}).lean(), ImagingReportTemplate.find({}).lean()]);
  return {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      room_count: rooms.filter((room) => room.modality === item.code && room.active).length,
      template_count: templates.filter((template) => template.modality === item.code && template.active).length,
      config_warnings: modalityWarnings(item, rooms.filter((room) => room.modality === item.code), templates.filter((template) => template.modality === item.code)),
    })),
  };
}

async function createImagingModality(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.code || !payload.name) throw createError('code và name là bắt buộc.', 400);
  const item = await ImagingModality.create({
    ...payload,
    code: upper(payload.code),
    name: normalizeString(payload.name),
    room_required: payload.room_required !== undefined ? parseBoolean(payload.room_required) : true,
    active: payload.active !== undefined ? parseBoolean(payload.active) : true,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordConfigAudit({ actor, action: 'clinical_config.imaging_modality.created', targetType: 'imaging_modality', targetId: item._id, message: 'Tạo imaging modality.', requestMeta, after: item.toObject() });
  return { item };
}

async function updateImagingModality(id, payload = {}, actor = {}, requestMeta = {}) {
  if (payload.code) payload.code = upper(payload.code);
  if (payload.room_required !== undefined) payload.room_required = parseBoolean(payload.room_required);
  if (payload.active !== undefined) payload.active = parseBoolean(payload.active);
  await updateById(ImagingModality, id, payload, ['code', 'name', 'room_required', 'duration_minutes', 'active', 'metadata'], actor, requestMeta, { action: 'clinical_config.imaging_modality.updated', targetType: 'imaging_modality', message: 'Cập nhật imaging modality.' });
  return { item: await ImagingModality.findById(id).lean() };
}

async function cloneImagingModality(id, payload = {}, actor = {}, requestMeta = {}) {
  const source = await ImagingModality.findById(id).lean();
  if (!source) throw createError('Không tìm thấy modality.', 404);
  return createImagingModality({ ...source, _id: undefined, code: payload.code || `${source.code}_COPY_${Date.now()}`, name: payload.name || `${source.name} - bản sao`, active: false }, actor, requestMeta);
}

async function retireImagingModality(id, actor = {}, requestMeta = {}) {
  return updateImagingModality(id, { active: false }, actor, requestMeta);
}

async function listImagingRoomsEquipment(query = {}) {
  const [rooms, equipment, downtime] = await Promise.all([
    ImagingRoom.find({ ...(query.modality ? { modality: query.modality } : {}) }).populate('equipment_id', 'code name status manufacturer model serial_no next_maintenance_at').sort({ modality: 1, code: 1 }).lean(),
    ImagingEquipment.find({ ...(query.modality ? { modality: query.modality } : {}) }).sort({ modality: 1, code: 1 }).lean(),
    EquipmentDowntime.find({ end_at: { $exists: false } }).lean(),
  ]);
  const downtimeByEquipment = new Set(downtime.map((item) => toId(item.equipment_id)));
  return {
    rooms: rooms.map((room) => ({
      ...room,
      config_warnings: [
        ...(!room.equipment_id ? [warning('missing_equipment', 'Chưa gắn thiết bị', 'warning', 'scheduling')] : []),
        ...(room.maintenance_status !== 'available' ? [warning('room_unavailable', 'Phòng không available', 'high', 'scheduling')] : []),
      ],
    })),
    equipment: equipment.map((item) => ({
      ...item,
      downtime_open: downtimeByEquipment.has(toId(item)),
      config_warnings: [
        ...(item.status !== 'available' ? [warning('equipment_unavailable', 'Thiết bị không available', 'high', 'scheduling')] : []),
        ...(parseDate(item.next_maintenance_at) && parseDate(item.next_maintenance_at) < new Date() ? [warning('maintenance_overdue', 'Quá hạn bảo trì', 'high', 'maintenance')] : []),
      ],
    })),
  };
}

async function createImagingRoom(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.code || !payload.name || !payload.modality) throw createError('code, name, modality là bắt buộc.', 400);
  const item = await ImagingRoom.create({
    ...payload,
    code: upper(payload.code),
    active: payload.active !== undefined ? parseBoolean(payload.active) : true,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordConfigAudit({ actor, action: 'clinical_config.imaging_room.created', targetType: 'imaging_room', targetId: item._id, message: 'Tạo phòng CĐHA.', requestMeta, after: item.toObject() });
  return { item };
}

async function updateImagingRoom(id, payload = {}, actor = {}, requestMeta = {}) {
  if (payload.code) payload.code = upper(payload.code);
  if (payload.active !== undefined) payload.active = parseBoolean(payload.active);
  await updateById(ImagingRoom, id, payload, ['code', 'name', 'modality', 'location_id', 'equipment_id', 'default_duration_minutes', 'active', 'maintenance_status', 'metadata'], actor, requestMeta, { action: 'clinical_config.imaging_room.updated', targetType: 'imaging_room', message: 'Cập nhật phòng CĐHA.' });
  return { item: await ImagingRoom.findById(id).lean() };
}

async function createImagingEquipment(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.code || !payload.name || !payload.modality) throw createError('code, name, modality là bắt buộc.', 400);
  const item = await ImagingEquipment.create({
    ...payload,
    code: upper(payload.code),
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordConfigAudit({ actor, action: 'clinical_config.imaging_equipment.created', targetType: 'imaging_equipment', targetId: item._id, message: 'Tạo thiết bị CĐHA.', requestMeta, after: item.toObject() });
  return { item };
}

async function updateImagingEquipment(id, payload = {}, actor = {}, requestMeta = {}) {
  if (payload.code) payload.code = upper(payload.code);
  await updateById(ImagingEquipment, id, payload, ['code', 'name', 'modality', 'manufacturer', 'model', 'serial_no', 'status', 'last_maintenance_at', 'next_maintenance_at', 'metadata'], actor, requestMeta, { action: 'clinical_config.imaging_equipment.updated', targetType: 'imaging_equipment', message: 'Cập nhật thiết bị CĐHA.' });
  return { item: await ImagingEquipment.findById(id).lean() };
}

async function markEquipmentDown(id, payload = {}, actor = {}, requestMeta = {}) {
  await updateImagingEquipment(id, { status: 'out_of_service' }, actor, requestMeta);
  const item = await EquipmentDowntime.create({
    equipment_id: id,
    room_id: payload.room_id,
    start_at: payload.start_at || new Date(),
    reason: payload.reason,
    impact_level: payload.impact_level || 'high',
    affected_orders: payload.affected_orders || [],
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  return { item };
}

async function restoreEquipment(id, payload = {}, actor = {}, requestMeta = {}) {
  await updateImagingEquipment(id, { status: 'available' }, actor, requestMeta);
  await EquipmentDowntime.updateMany({ equipment_id: id, end_at: { $exists: false } }, { $set: { end_at: payload.end_at || new Date(), updated_by: actorUserId(actor) } });
  return { item: await ImagingEquipment.findById(id).lean() };
}

async function listProcedures(query = {}) {
  const data = await pagedFind(ProcedureCatalog, query, {
    searchFields: ['code', 'name', 'category'],
    filter: { ...(query.category ? { category: query.category } : {}), ...(query.department_id ? { department_id: query.department_id } : {}) },
    sort: { active: -1, category: 1, name: 1 },
    populate: [
      { path: 'department_id', select: DEPARTMENT_SELECT },
      { path: 'default_service_id', select: SERVICE_SELECT },
      { path: 'checklist_template_id', select: 'template_code name version is_active is_default' },
    ],
  });
  return { ...data, items: addWarnings(data.items, procedureWarnings) };
}

async function getProcedure(id) {
  const item = await ProcedureCatalog.findById(id)
    .populate('department_id', DEPARTMENT_SELECT)
    .populate('default_service_id', SERVICE_SELECT)
    .populate('checklist_template_id', 'template_code name version is_active is_default items')
    .populate('created_by updated_by', USER_SELECT)
    .lean();
  if (!item) throw createError('Không tìm thấy procedure catalog.', 404);
  const usage = await ProcedureOrder.countDocuments({ procedure_code: item.code, ordered_at: { $gte: new Date(Date.now() - 30 * 86400000) } });
  return { item: { ...item, config_warnings: procedureWarnings(item), usage_30d: usage } };
}

async function createProcedure(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.code || !payload.name) throw createError('code và name là bắt buộc.', 400);
  if (await ProcedureCatalog.exists({ code: upper(payload.code) })) throw createError('Mã thủ thuật đã tồn tại.', 409);
  const item = await ProcedureCatalog.create({
    ...payload,
    code: upper(payload.code),
    name: normalizeString(payload.name),
    active: payload.active !== undefined ? parseBoolean(payload.active) : true,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordConfigAudit({ actor, action: 'clinical_config.procedure.created', targetType: 'procedure_catalog', targetId: item._id, message: 'Tạo procedure catalog.', requestMeta, after: item.toObject() });
  return getProcedure(item._id);
}

async function updateProcedure(id, payload = {}, actor = {}, requestMeta = {}) {
  if (payload.code) payload.code = upper(payload.code);
  if (payload.active !== undefined) payload.active = parseBoolean(payload.active);
  await updateById(ProcedureCatalog, id, payload, [
    'code',
    'name',
    'category',
    'department_id',
    'default_duration_minutes',
    'default_service_id',
    'requires_consent',
    'consent_template_id',
    'requires_preparation',
    'checklist_template_id',
    'requires_post_observation',
    'post_observation_minutes',
    'allowed_locations',
    'required_equipment',
    'required_materials',
    'indications',
    'contraindications',
    'patient_instructions',
    'performer_role_codes',
    'active',
    'version',
    'metadata',
  ], actor, requestMeta, { action: 'clinical_config.procedure.updated', targetType: 'procedure_catalog', message: 'Cập nhật procedure catalog.' });
  return getProcedure(id);
}

async function cloneProcedure(id, payload = {}, actor = {}, requestMeta = {}) {
  const source = await ProcedureCatalog.findById(id).lean();
  if (!source) throw createError('Không tìm thấy procedure catalog.', 404);
  return createProcedure({ ...source, _id: undefined, code: payload.code || `${source.code}_COPY_${Date.now()}`, name: payload.name || `${source.name} - bản sao`, active: false }, actor, requestMeta);
}

async function retireProcedure(id, actor = {}, requestMeta = {}) {
  return updateProcedure(id, { active: false }, actor, requestMeta);
}

async function linkProcedureService(id, payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.service_id && !payload.default_service_id) throw createError('service_id là bắt buộc.', 400);
  return updateProcedure(id, { default_service_id: payload.service_id || payload.default_service_id }, actor, requestMeta);
}

async function linkProcedureChecklist(id, payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.checklist_template_id) throw createError('checklist_template_id là bắt buộc.', 400);
  return updateProcedure(id, { checklist_template_id: payload.checklist_template_id, requires_preparation: true }, actor, requestMeta);
}

async function listChecklistTemplates(query = {}) {
  const data = await pagedFind(PreparationChecklistTemplate, query, {
    searchFields: ['template_code', 'name', 'procedure_code', 'test_code', 'specimen_type'],
    filter: {
      ...(query.source_type ? { source_type: query.source_type } : {}),
      ...(query.procedure_code ? { procedure_code: upper(query.procedure_code) } : {}),
      ...(query.modality ? { modality: query.modality } : {}),
    },
    sort: { source_type: 1, is_default: -1, version: -1 },
    populate: [{ path: 'department_id', select: DEPARTMENT_SELECT }, { path: 'service_id', select: SERVICE_SELECT }],
  });
  return { ...data, items: data.items.map((item) => ({ ...item, item_count: item.items?.length || 0, required_count: item.items?.filter((row) => row.required).length || 0, critical_count: item.items?.filter((row) => row.critical).length || 0, config_warnings: checklistWarnings(item) })) };
}

async function createChecklistTemplate(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.template_code || !payload.name || !payload.source_type) throw createError('template_code, name, source_type là bắt buộc.', 400);
  const item = await PreparationChecklistTemplate.create({ ...payload, created_by: actorUserId(actor), updated_by: actorUserId(actor) });
  await recordConfigAudit({ actor, action: 'clinical_config.checklist_template.created', targetType: 'preparation_checklist_template', targetId: item._id, message: 'Tạo checklist template.', requestMeta, after: item.toObject() });
  return { item };
}

async function updateChecklistTemplate(id, payload = {}, actor = {}, requestMeta = {}) {
  await updateById(PreparationChecklistTemplate, id, payload, ['template_code', 'name', 'source_type', 'order_type', 'modality', 'procedure_code', 'test_code', 'specimen_type', 'service_id', 'department_id', 'version', 'is_default', 'is_active', 'items'], actor, requestMeta, { action: 'clinical_config.checklist_template.updated', targetType: 'preparation_checklist_template', message: 'Cập nhật checklist template.' });
  return { item: await PreparationChecklistTemplate.findById(id).lean() };
}

async function cloneChecklistTemplate(id, payload = {}, actor = {}, requestMeta = {}) {
  const source = await PreparationChecklistTemplate.findById(id).lean();
  if (!source) throw createError('Không tìm thấy checklist template.', 404);
  return createChecklistTemplate({ ...source, _id: undefined, template_code: payload.template_code || `${source.template_code}_COPY_${Date.now()}`, name: payload.name || `${source.name} - bản sao`, version: payload.version || 1, is_active: payload.is_active ?? false }, actor, requestMeta);
}

async function previewChecklistTemplate(query = {}) {
  const sourceType = query.source_type || 'procedure';
  const filter = { source_type: sourceType, is_active: true };
  if (query.procedure_code) filter.procedure_code = upper(query.procedure_code);
  if (query.modality) filter.modality = query.modality;
  if (query.test_code) filter.test_code = upper(query.test_code);
  const template = await PreparationChecklistTemplate.findOne(filter).sort({ is_default: -1, version: -1 }).lean();
  return { source_type: sourceType, template, items: template?.items || [] };
}

async function listSlaRules(query = {}) {
  return pagedFind(ClinicalOpsSlaRule, query, {
    searchFields: ['module', 'stage', 'description'],
    filter: { ...(query.module ? { module: query.module } : {}), ...(query.stage ? { stage: query.stage } : {}) },
    sort: { active: -1, module: 1, stage: 1, priority: 1 },
  });
}

async function createSlaRule(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.module || !payload.stage || !payload.threshold_minutes) throw createError('module, stage, threshold_minutes là bắt buộc.', 400);
  const item = await ClinicalOpsSlaRule.create({
    module: payload.module,
    stage: payload.stage,
    priority: payload.priority || 'routine',
    threshold_minutes: Number(payload.threshold_minutes),
    warning_minutes: Number(payload.warning_minutes || 15),
    active: payload.active !== undefined ? parseBoolean(payload.active) : true,
    description: payload.description,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordConfigAudit({ actor, action: 'clinical_config.sla_rule.created', targetType: 'clinical_ops_sla_rule', targetId: item._id, message: 'Tạo SLA rule.', requestMeta, after: item.toObject() });
  return { item };
}

async function updateSlaRule(id, payload = {}, actor = {}, requestMeta = {}) {
  if (payload.active !== undefined) payload.active = parseBoolean(payload.active);
  await updateById(ClinicalOpsSlaRule, id, payload, ['module', 'stage', 'priority', 'threshold_minutes', 'warning_minutes', 'active', 'description'], actor, requestMeta, { action: 'clinical_config.sla_rule.updated', targetType: 'clinical_ops_sla_rule', message: 'Cập nhật SLA rule.' });
  return { item: await ClinicalOpsSlaRule.findById(id).lean() };
}

async function simulateSlaRule(id, payload = {}) {
  const item = await ClinicalOpsSlaRule.findById(id).lean();
  if (!item) throw createError('Không tìm thấy SLA rule.', 404);
  const start = parseDate(payload.started_at) || new Date();
  const warningDue = new Date(start.getTime() + Math.max(item.threshold_minutes - item.warning_minutes, 0) * 60000);
  const breachDue = new Date(start.getTime() + item.threshold_minutes * 60000);
  return { rule: item, simulation: { started_at: start, warning_due_at: warningDue, breach_due_at: breachDue, escalation_after_minutes: payload.escalation_after_minutes || item.threshold_minutes } };
}

async function slaDashboard() {
  const [rules, events] = await Promise.all([
    ClinicalOpsSlaRule.find({}).lean(),
    ClinicalOpsSlaEvent.find({ state: { $in: ['warning', 'breached', 'normal'] } }).sort({ due_at: 1 }).limit(100).lean(),
  ]);
  return {
    summary: {
      active_rules: rules.filter((item) => item.active).length,
      running_instances: events.filter((item) => item.state === 'normal').length,
      warning: events.filter((item) => item.state === 'warning').length,
      breached: events.filter((item) => item.state === 'breached').length,
    },
    rules,
    events,
  };
}

async function listReportTemplates(query = {}) {
  const data = await pagedFind(ResultReportTemplate, query, {
    searchFields: ['template_code', 'name', 'modality', 'test_code', 'procedure_code'],
    filter: { ...(query.domain ? { domain: query.domain } : {}) },
    sort: { domain: 1, is_default: -1, version: -1 },
    populate: [{ path: 'department_id', select: DEPARTMENT_SELECT }, { path: 'published_by', select: USER_SELECT }],
  });
  return { ...data, items: data.items.map((item) => ({ ...item, section_count: item.sections?.length || 0, structured_field_count: item.structured_fields?.length || 0, config_warnings: templateWarnings(item) })) };
}

async function createReportTemplate(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.template_code || !payload.name || !payload.domain) throw createError('template_code, name, domain là bắt buộc.', 400);
  const item = await ResultReportTemplate.create({
    ...payload,
    template_code: upper(payload.template_code),
    status: payload.status || 'draft',
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordConfigAudit({ actor, action: 'clinical_config.report_template.created', targetType: 'result_report_template', targetId: item._id, message: 'Tạo report template.', requestMeta, after: item.toObject() });
  return { item };
}

async function updateReportTemplate(id, payload = {}, actor = {}, requestMeta = {}) {
  if (payload.template_code) payload.template_code = upper(payload.template_code);
  await updateById(ResultReportTemplate, id, payload, ['template_code', 'name', 'domain', 'modality', 'test_code', 'procedure_code', 'department_id', 'version', 'status', 'is_default', 'sections', 'structured_fields', 'print_layout', 'patient_release_layout', 'metadata', 'published_by', 'published_at', 'retired_by', 'retired_at'], actor, requestMeta, { action: 'clinical_config.report_template.updated', targetType: 'result_report_template', message: 'Cập nhật report template.' });
  return { item: await ResultReportTemplate.findById(id).lean() };
}

async function cloneReportTemplate(id, payload = {}, actor = {}, requestMeta = {}) {
  const source = await ResultReportTemplate.findById(id).lean();
  if (!source) throw createError('Không tìm thấy report template.', 404);
  return createReportTemplate({ ...source, _id: undefined, template_code: payload.template_code || `${source.template_code}_COPY_${Date.now()}`, name: payload.name || `${source.name} - bản sao`, status: 'draft', is_default: false, version: 1 }, actor, requestMeta);
}

async function publishReportTemplate(id, actor = {}, requestMeta = {}) {
  return updateReportTemplate(id, { status: 'active', published_by: actorUserId(actor), published_at: new Date() }, actor, requestMeta);
}

async function retireReportTemplate(id, actor = {}, requestMeta = {}) {
  return updateReportTemplate(id, { status: 'retired', retired_by: actorUserId(actor), retired_at: new Date(), is_default: false }, actor, requestMeta);
}

async function setDefaultReportTemplate(id, actor = {}, requestMeta = {}) {
  const item = await ResultReportTemplate.findById(id);
  if (!item) throw createError('Không tìm thấy report template.', 404);
  await ResultReportTemplate.updateMany({ domain: item.domain, modality: item.modality, test_code: item.test_code, procedure_code: item.procedure_code, _id: { $ne: item._id } }, { $set: { is_default: false } });
  return updateReportTemplate(id, { is_default: true, status: item.status === 'draft' ? 'active' : item.status }, actor, requestMeta);
}

async function previewReportTemplate(id, payload = {}) {
  const item = await ResultReportTemplate.findById(id).lean();
  if (!item) throw createError('Không tìm thấy report template.', 404);
  const variables = {
    '{{patient.name}}': payload.patient_name || 'Nguyễn Văn A',
    '{{patient.age}}': payload.patient_age || '62',
    '{{patient.gender}}': payload.patient_gender || 'Nam',
    '{{encounter.code}}': payload.encounter_code || 'ENC-DEMO',
    '{{order.priority}}': payload.priority || 'STAT',
    '{{order.clinical_indication}}': payload.clinical_indication || 'Theo dõi cận lâm sàng',
    '{{reported_by.name}}': payload.reported_by || 'BS Demo',
  };
  const sections = (item.sections || []).map((section) => {
    let content = section.default_content || '';
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replaceAll(key, value);
    });
    return { ...section, rendered_content: content };
  });
  return { template: item, sections, variables };
}

async function serviceOptions(query = {}) {
  const filter = { is_deleted: false };
  if (query.service_type) filter.service_type = query.service_type;
  if (query.status) filter.status = query.status;
  const regex = searchRegex(query.search || query.keyword);
  if (regex) filter.$or = [{ service_code: regex }, { service_name: regex }];
  const items = await ServiceCatalog.find(filter).sort({ service_type: 1, service_name: 1 }).limit(Number(query.limit || 50)).lean();
  return { items: items.map(compactService) };
}

module.exports = {
  overview,
  listLabTests,
  getLabTest,
  createLabTest,
  updateLabTest,
  cloneLabTest,
  retireLabTest,
  linkLabTestService,
  listSpecimenTypes,
  getSpecimenType,
  createSpecimenType,
  updateSpecimenType,
  cloneSpecimenType,
  retireSpecimenType,
  listImagingModalities,
  createImagingModality,
  updateImagingModality,
  cloneImagingModality,
  retireImagingModality,
  listImagingRoomsEquipment,
  createImagingRoom,
  updateImagingRoom,
  createImagingEquipment,
  updateImagingEquipment,
  markEquipmentDown,
  restoreEquipment,
  listProcedures,
  getProcedure,
  createProcedure,
  updateProcedure,
  cloneProcedure,
  retireProcedure,
  linkProcedureService,
  linkProcedureChecklist,
  listChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  cloneChecklistTemplate,
  previewChecklistTemplate,
  listSlaRules,
  createSlaRule,
  updateSlaRule,
  simulateSlaRule,
  slaDashboard,
  listReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  cloneReportTemplate,
  publishReportTemplate,
  retireReportTemplate,
  setDefaultReportTemplate,
  previewReportTemplate,
  serviceOptions,
};
