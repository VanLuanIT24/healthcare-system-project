const {
  AdministrationRoute,
  AuditLog,
  Charge,
  Counter,
  DosageForm,
  ImagingEquipment,
  ImagingModality,
  ImagingRoom,
  InvoiceItem,
  LabTestCatalog,
  MedicationMaster,
  MedicationUnit,
  ProcedureCatalog,
  ResultReportTemplate,
  ServiceCatalog,
  ServicePriceVersion,
  SpecimenTypeCatalog,
  StockBatch,
  StorageLocation,
  Supplier,
  Warehouse,
} = require('../models');
const { buildPagination, escapeRegex, getPagination } = require('./core.service');
const { getScheduleTypeCatalog } = require('../constants/catalogs/schedule-types');

const USER_SELECT = 'full_name username employee_code';
const DEPARTMENT_SELECT = 'department_code department_name code name department_type status';
const SERVICE_SELECT = 'service_code service_name service_type unit_price currency is_billable status effective_from effective_to';

function nowIso() {
  return new Date().toISOString();
}

function toId(value) {
  return String(value?._id || value?.id || value || '');
}

function baseFilter(config = {}) {
  return config.softDelete ? { is_deleted: false } : {};
}

function regex(value) {
  const text = String(value || '').trim();
  return text ? { $regex: escapeRegex(text), $options: 'i' } : null;
}

function normalizeActiveStatus(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (['active', 'true', '1', 'yes'].includes(normalized)) return true;
  if (['inactive', 'retired', 'false', '0', 'no'].includes(normalized)) return false;
  return undefined;
}

function applySearch(filter, query = {}, fields = []) {
  const pattern = regex(query.search || query.q || query.keyword);
  if (!pattern || !fields.length) return filter;
  return {
    ...filter,
    $or: fields.map((field) => ({ [field]: pattern })),
  };
}

function applyStatus(filter, query = {}, config = {}) {
  if (!query.status) return filter;
  if (config.activeField) {
    const active = normalizeActiveStatus(query.status);
    return active === undefined ? filter : { ...filter, [config.activeField]: active };
  }
  return { ...filter, [config.statusField || 'status']: query.status };
}

function statusLabel(item = {}, config = {}) {
  if (config.activeField) return item[config.activeField] === false ? 'inactive' : 'active';
  return item[config.statusField || 'status'] || 'active';
}

function issue(severity, domain, entity, title, detail, target = {}, suggestedAction = 'Kiểm tra và cập nhật cấu hình liên quan.') {
  return {
    severity,
    domain,
    entity,
    title,
    detail,
    target,
    suggested_action: suggestedAction,
  };
}

function getEntityConfigs() {
  return {
    services: {
      key: 'services',
      title: 'Dịch vụ y tế',
      domain: 'billing',
      model: ServiceCatalog,
      softDelete: true,
      statusField: 'status',
      searchFields: ['service_code', 'service_name', 'service_type', 'description', 'unit'],
      sort: { status: 1, service_type: 1, service_name: 1 },
      populate: [
        { path: 'department_id', select: DEPARTMENT_SELECT },
        { path: 'created_by updated_by', select: USER_SELECT },
      ],
      identity: ['service_code', 'service_name'],
      route_hint: '/api/billing/service-catalog',
      primary_action: 'create_service',
    },
    'service-prices': {
      key: 'service-prices',
      title: 'Phiên bản giá dịch vụ',
      domain: 'billing',
      model: ServicePriceVersion,
      statusField: 'status',
      searchFields: ['version_code', 'reason', 'change_type'],
      sort: { effective_from: -1, version_no: -1 },
      populate: [
        { path: 'service_id', select: SERVICE_SELECT },
        { path: 'approved_by cancelled_by created_by updated_by', select: USER_SELECT },
      ],
      identity: ['version_code', 'service_id.service_name'],
      route_hint: '/api/billing/service-catalog/:serviceId/new-version',
      primary_action: 'new_price_version',
    },
    medications: {
      key: 'medications',
      title: 'Danh mục thuốc',
      domain: 'pharmacy',
      model: MedicationMaster,
      softDelete: true,
      statusField: 'status',
      searchFields: ['medication_code', 'generic_name', 'brand_name', 'strength', 'dosage_form', 'route_default', 'unit'],
      sort: { status: 1, generic_name: 1 },
      populate: [
        { path: 'unit_id', select: 'code name symbol status' },
        { path: 'dosage_form_id', select: 'code name form_group status high_risk' },
        { path: 'route_default_id', select: 'code name route_group risk_level status' },
        { path: 'service_id', select: SERVICE_SELECT },
      ],
      identity: ['medication_code', 'generic_name', 'brand_name'],
      route_hint: '/api/admin/master-data/medications',
      primary_action: 'create_medication',
      backend_status: 'facade_readiness',
    },
    'medication-units': {
      key: 'medication-units',
      title: 'Đơn vị thuốc',
      domain: 'pharmacy',
      model: MedicationUnit,
      softDelete: true,
      statusField: 'status',
      searchFields: ['code', 'name', 'symbol', 'english_name', 'aliases'],
      sort: { status: 1, unit_type: 1, name: 1 },
      populate: [{ path: 'deprecated_replacement_id', select: 'code name symbol status' }],
      identity: ['code', 'name'],
      route_hint: '/api/pharmacy-config/units',
      primary_action: 'create_unit',
    },
    'dosage-forms': {
      key: 'dosage-forms',
      title: 'Dạng bào chế',
      domain: 'pharmacy',
      model: DosageForm,
      softDelete: true,
      statusField: 'status',
      searchFields: ['code', 'name', 'english_name', 'form_group', 'aliases'],
      sort: { status: 1, form_group: 1, name: 1 },
      populate: [
        { path: 'default_unit_id', select: 'code name symbol status' },
        { path: 'default_route_id allowed_route_ids deprecated_replacement_id', select: 'code name route_group risk_level status' },
      ],
      identity: ['code', 'name'],
      route_hint: '/api/pharmacy-config/dosage-forms',
      primary_action: 'create_dosage_form',
    },
    'administration-routes': {
      key: 'administration-routes',
      title: 'Đường dùng thuốc',
      domain: 'pharmacy',
      model: AdministrationRoute,
      softDelete: true,
      statusField: 'status',
      searchFields: ['code', 'name', 'english_name', 'route_group', 'aliases'],
      sort: { status: 1, route_group: 1, risk_level: -1, name: 1 },
      populate: [{ path: 'allowed_dosage_form_ids deprecated_replacement_id', select: 'code name form_group status' }],
      identity: ['code', 'name'],
      route_hint: '/api/pharmacy-config/routes',
      primary_action: 'create_route',
    },
    suppliers: {
      key: 'suppliers',
      title: 'Nhà cung cấp',
      domain: 'pharmacy',
      model: Supplier,
      softDelete: true,
      statusField: 'status',
      searchFields: ['code', 'name', 'supplier_type', 'tax_code', 'license_no', 'phone', 'email', 'contact_person'],
      sort: { status: 1, risk_level: -1, name: 1 },
      identity: ['code', 'name'],
      route_hint: '/api/pharmacy-config/suppliers',
      primary_action: 'create_supplier',
    },
    warehouses: {
      key: 'warehouses',
      title: 'Kho dược',
      domain: 'pharmacy',
      model: Warehouse,
      softDelete: true,
      statusField: 'status',
      searchFields: ['warehouse_code', 'name', 'type', 'note'],
      sort: { status: 1, type: 1, name: 1 },
      populate: [{ path: 'department_id', select: DEPARTMENT_SELECT }],
      identity: ['warehouse_code', 'name'],
      route_hint: '/api/admin/master-data/warehouses',
      primary_action: 'create_warehouse',
      backend_status: 'missing_admin_crud',
    },
    'storage-locations': {
      key: 'storage-locations',
      title: 'Vị trí lưu kho',
      domain: 'pharmacy',
      model: StorageLocation,
      softDelete: true,
      statusField: 'status',
      searchFields: ['location_code', 'code', 'name', 'zone', 'shelf', 'bin', 'temperature_zone'],
      sort: { status: 1, location_type: 1, location_code: 1 },
      populate: [
        { path: 'warehouse_id', select: 'warehouse_code name type status' },
        { path: 'parent_id', select: 'location_code code name location_type status' },
      ],
      identity: ['location_code', 'name'],
      route_hint: '/api/pharmacy-config/storage-locations',
      primary_action: 'create_storage_location',
    },
    'lab-tests': {
      key: 'lab-tests',
      title: 'Danh mục xét nghiệm',
      domain: 'clinical',
      model: LabTestCatalog,
      activeField: 'active',
      searchFields: ['code', 'name', 'category', 'specimen_type', 'container_type', 'unit'],
      sort: { active: -1, category: 1, name: 1 },
      populate: [
        { path: 'specimen_type_id', select: 'code name category container_type tube_color active' },
        { path: 'price_service_id', select: SERVICE_SELECT },
      ],
      identity: ['code', 'name'],
      route_hint: '/api/clinical-config/lab-tests',
      primary_action: 'create_lab_test',
    },
    'specimen-types': {
      key: 'specimen-types',
      title: 'Loại mẫu bệnh phẩm',
      domain: 'clinical',
      model: SpecimenTypeCatalog,
      activeField: 'active',
      searchFields: ['code', 'name', 'category', 'container_type', 'tube_color', 'barcode_prefix'],
      sort: { active: -1, category: 1, name: 1 },
      identity: ['code', 'name'],
      route_hint: '/api/clinical-config/specimen-types',
      primary_action: 'create_specimen_type',
    },
    'imaging-catalog': {
      key: 'imaging-catalog',
      title: 'Danh mục CĐHA',
      domain: 'clinical',
      model: ImagingModality,
      activeField: 'active',
      searchFields: ['code', 'name'],
      sort: { active: -1, name: 1 },
      identity: ['code', 'name'],
      route_hint: '/api/clinical-config/imaging-modalities',
      primary_action: 'create_modality',
      backend_status: 'modality_only_missing_imaging_catalog_model',
    },
    'imaging-equipment': {
      key: 'imaging-equipment',
      title: 'Thiết bị CĐHA',
      domain: 'clinical',
      model: ImagingEquipment,
      statusField: 'status',
      searchFields: ['code', 'name', 'modality', 'manufacturer', 'model', 'serial_no'],
      sort: { status: 1, modality: 1, name: 1 },
      identity: ['code', 'name'],
      route_hint: '/api/clinical-config/imaging-rooms-equipment',
      primary_action: 'create_imaging_equipment',
    },
    'imaging-rooms': {
      key: 'imaging-rooms',
      title: 'Phòng CĐHA',
      domain: 'clinical',
      model: ImagingRoom,
      activeField: 'active',
      searchFields: ['code', 'name', 'modality', 'maintenance_status'],
      sort: { active: -1, modality: 1, name: 1 },
      populate: [{ path: 'equipment_id', select: 'code name modality status' }],
      identity: ['code', 'name'],
      route_hint: '/api/clinical-config/imaging-rooms-equipment',
      primary_action: 'create_imaging_room',
    },
    procedures: {
      key: 'procedures',
      title: 'Danh mục thủ thuật',
      domain: 'clinical',
      model: ProcedureCatalog,
      activeField: 'active',
      searchFields: ['code', 'name', 'category', 'patient_instructions'],
      sort: { active: -1, category: 1, name: 1 },
      populate: [
        { path: 'department_id', select: DEPARTMENT_SELECT },
        { path: 'default_service_id', select: SERVICE_SELECT },
        { path: 'checklist_template_id', select: 'template_code name version is_active is_default' },
      ],
      identity: ['code', 'name'],
      route_hint: '/api/clinical-config/procedures',
      primary_action: 'create_procedure',
    },
    'report-templates': {
      key: 'report-templates',
      title: 'Mẫu báo cáo kết quả',
      domain: 'clinical',
      model: ResultReportTemplate,
      statusField: 'status',
      searchFields: ['template_code', 'name', 'domain', 'modality', 'test_code', 'procedure_code'],
      sort: { domain: 1, is_default: -1, version: -1 },
      populate: [
        { path: 'department_id', select: DEPARTMENT_SELECT },
        { path: 'published_by retired_by', select: USER_SELECT },
      ],
      identity: ['template_code', 'name'],
      route_hint: '/api/clinical-config/report-templates',
      primary_action: 'create_report_template',
    },
  };
}

async function countActive(Model, config = {}) {
  const filter = baseFilter(config);
  if (config.activeField) return Model.countDocuments({ ...filter, [config.activeField]: true });
  return Model.countDocuments({ ...filter, [config.statusField || 'status']: 'active' });
}

async function countTotal(Model, config = {}) {
  return Model.countDocuments(baseFilter(config));
}

async function summarizeEntity(config = {}) {
  const filter = baseFilter(config);
  const total = await config.model.countDocuments(filter);
  if (config.activeField) {
    const active = await config.model.countDocuments({ ...filter, [config.activeField]: true });
    return {
      total,
      active,
      inactive: Math.max(total - active, 0),
    };
  }

  const statusRows = await config.model.aggregate([
    { $match: filter },
    { $group: { _id: `$${config.statusField || 'status'}`, count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(statusRows.map((row) => [row._id || 'unknown', row.count]));
  return {
    total,
    active: byStatus.active || byStatus.available || 0,
    inactive: byStatus.inactive || 0,
    retired: byStatus.retired || byStatus.deprecated || 0,
    by_status: byStatus,
  };
}

function enrichItemQuality(item = {}, entity) {
  const flags = [];
  const warnings = [];

  if (entity === 'services') {
    if (item.is_billable && Number(item.unit_price || 0) <= 0) flags.push('missing_price');
    if (!item.department_id) flags.push('missing_department');
    if (item.effective_to && new Date(item.effective_to).getTime() < Date.now()) flags.push('expired_effective_date');
  }
  if (entity === 'medications') {
    if (!item.unit_id && !item.unit) flags.push('missing_unit');
    if (!item.dosage_form_id && !item.dosage_form) flags.push('missing_dosage_form');
    if (!item.route_default_id && !item.route_default) flags.push('missing_route');
    if (!item.service_id) flags.push('missing_service_mapping');
    if ((item.controlled_drug || item.is_controlled_drug) && !item.controlled_drug_policy_id) flags.push('controlled_without_policy');
  }
  if (entity === 'medication-units' && item.status === 'deprecated' && !item.deprecated_replacement_id) flags.push('deprecated_without_replacement');
  if (entity === 'dosage-forms') {
    if (!item.default_unit_id) flags.push('missing_default_unit');
    if (!item.default_route_id) flags.push('missing_default_route');
    if (item.high_risk && !item.label_instruction_template) flags.push('high_risk_missing_instruction');
  }
  if (entity === 'administration-routes') {
    if (item.risk_level === 'high' && !item.default_instruction_template) flags.push('high_risk_missing_instruction');
    if (item.requires_site && !item.default_instruction_template) flags.push('site_required_missing_instruction');
  }
  if (entity === 'suppliers') {
    if (item.status === 'blocked') flags.push('supplier_blocked');
    if (item.license_expiry_date && new Date(item.license_expiry_date).getTime() < Date.now() + 30 * 86400000) flags.push('license_expiring');
    if (item.risk_level === 'high') flags.push('high_risk_supplier');
  }
  if (entity === 'storage-locations') {
    if (item.is_locked || item.status === 'locked') flags.push('locked_location');
    if (!item.qr_code) flags.push('missing_qr');
    if (['fridge', 'controlled_cabinet'].includes(item.location_type) && (item.temperature_min === undefined || item.temperature_max === undefined)) flags.push('missing_temperature_range');
  }
  if (entity === 'lab-tests') {
    if (!item.specimen_type_id && !item.specimen_type) flags.push('missing_specimen_type');
    if (!item.price_service_id) flags.push('missing_service_mapping');
    if (!item.turnaround_minutes) flags.push('missing_tat');
    if (!item.result_items?.length) flags.push('missing_result_items');
  }
  if (entity === 'specimen-types') {
    if (!item.container_type) flags.push('missing_container');
    if (!item.label_template) flags.push('missing_label_template');
    if (!item.reject_reasons?.length) flags.push('missing_reject_rules');
  }
  if (entity === 'imaging-catalog' && item.room_required && !item.duration_minutes) flags.push('missing_duration');
  if (entity === 'imaging-equipment') {
    if (item.status === 'maintenance') flags.push('maintenance');
    if (item.status === 'out_of_service') flags.push('out_of_service');
    if (item.next_maintenance_at && new Date(item.next_maintenance_at).getTime() < Date.now() + 14 * 86400000) flags.push('maintenance_due');
  }
  if (entity === 'procedures') {
    if (!item.default_duration_minutes) flags.push('missing_duration');
    if (!item.default_service_id) flags.push('missing_service_mapping');
    if (item.requires_preparation && !item.checklist_template_id) flags.push('missing_checklist');
    if (item.requires_consent && !item.consent_template_id) flags.push('missing_consent_template');
  }
  if (entity === 'report-templates') {
    if (!item.sections?.length) flags.push('missing_sections');
    if (item.is_default && item.status !== 'active') flags.push('default_not_active');
    if (!item.patient_release_layout) flags.push('missing_patient_release_layout');
  }

  if (flags.length) warnings.push(...flags.map((flag) => ({ code: flag, severity: flag.includes('missing') ? 'warning' : 'info' })));
  return {
    ...item,
    status_resolved: item.status || (item.active === false ? 'inactive' : 'active'),
    quality_flags: flags,
    warning_count: warnings.length,
    warnings,
  };
}

async function listEntity(entity, query = {}) {
  if (entity === 'schedule-types') return listScheduleTypes(query);
  if (entity === 'identifier-rules') return listIdentifierRules(query);

  const configs = getEntityConfigs();
  const config = configs[entity];
  if (!config) {
    const known = [...Object.keys(configs), 'schedule-types', 'identifier-rules'];
    return {
      entity,
      items: [],
      pagination: buildPagination(1, 0, 0),
      summary: { total: 0 },
      backend_status: 'not_registered',
      known_entities: known,
    };
  }

  const { page, limit, skip } = getPagination(query, 40, 200);
  let filter = baseFilter(config);
  filter = applySearch(filter, query, config.searchFields);
  filter = applyStatus(filter, query, config);
  if (query.domain && entity === 'report-templates') filter.domain = query.domain;
  if (query.category && ['lab-tests', 'specimen-types', 'procedures'].includes(entity)) filter.category = query.category;
  if (query.service_type && entity === 'services') filter.service_type = query.service_type;
  if (query.type && entity === 'warehouses') filter.type = query.type;
  if (query.risk_level && entity === 'suppliers') filter.risk_level = query.risk_level;

  const findQuery = config.model.find(filter).sort(config.sort || { updated_at: -1 }).skip(skip).limit(limit);
  (config.populate || []).forEach((populate) => findQuery.populate(populate));

  const [items, total, summary] = await Promise.all([
    findQuery.lean(),
    config.model.countDocuments(filter),
    summarizeEntity(config),
  ]);

  const enriched = items.map((item) => enrichItemQuality(item, entity));
  return {
    entity,
    meta: {
      title: config.title,
      domain: config.domain,
      identity: config.identity,
      route_hint: config.route_hint,
      primary_action: config.primary_action,
      backend_status: config.backend_status || 'available',
    },
    summary: {
      ...summary,
      filtered_total: total,
      warning_items: enriched.filter((item) => item.warning_count > 0).length,
    },
    items: enriched,
    pagination: buildPagination(page, limit, total),
  };
}

function listScheduleTypes(query = {}) {
  const search = String(query.search || query.q || '').toLowerCase();
  const items = getScheduleTypeCatalog()
    .map((item, index) => ({
      id: `schedule-type:${item.value}`,
      code: item.value,
      name: item.label,
      description: item.description,
      badge: item.badge,
      default_price: item.price,
      patient_portal_enabled: item.patient_portal_enabled,
      staff_only: item.staff_only,
      return_visit_priority: item.return_visit_priority,
      suggested_duration_minutes: item.suggested_duration_minutes,
      status: 'active',
      source: 'hard_coded_catalog',
      sort_order: index + 1,
      quality_flags: ['dynamic_db_model_missing'],
      warning_count: 1,
    }))
    .filter((item) => !search || `${item.code} ${item.name} ${item.description}`.toLowerCase().includes(search));

  return {
    entity: 'schedule-types',
    meta: {
      title: 'Loại lịch / slot',
      domain: 'scheduling',
      route_hint: '/api/schedules/options',
      primary_action: 'read_only_until_schedule_type_model',
      backend_status: 'hard_coded_catalog',
    },
    summary: {
      total: items.length,
      active: items.length,
      patient_portal_enabled: items.filter((item) => item.patient_portal_enabled).length,
      staff_only: items.filter((item) => item.staff_only).length,
      warning_items: items.length,
    },
    items,
    pagination: buildPagination(1, items.length, items.length),
  };
}

async function listIdentifierRules(query = {}) {
  const search = String(query.search || query.q || '').toLowerCase();
  const counters = await Counter.find({}).sort({ key: 1 }).lean();
  const defaultCodeTypes = [
    'PATIENT',
    'APPOINTMENT',
    'ENCOUNTER',
    'ORDER',
    'LAB_ORDER',
    'SPECIMEN',
    'LAB_RESULT',
    'IMAGING_ORDER',
    'PROCEDURE_ORDER',
    'PRESCRIPTION',
    'DISPENSE',
    'INVOICE',
    'PAYMENT',
  ];
  const counterByKey = new Map(counters.map((counter) => [counter.key, counter]));
  const items = defaultCodeTypes.map((codeType) => {
    const counter = counterByKey.get(codeType) || counterByKey.get(codeType.toLowerCase());
    return {
      id: `identifier-rule:${codeType}`,
      code_type: codeType,
      display_name: codeType.replace(/_/g, ' '),
      prefix: codeType.split('_').map((part) => part[0]).join(''),
      format: '[PREFIX]-[DATE:YYYYMMDD]-[SEQ:000000]',
      scope_type: 'global_or_code_generator_service',
      reset_policy: 'service_defined',
      counter_key: counter?.key || null,
      counter_seq: counter?.seq || 0,
      next_preview: `${codeType.split('_').map((part) => part[0]).join('')}-YYYYMMDD-${String((counter?.seq || 0) + 1).padStart(6, '0')}`,
      status: counter ? 'active' : 'hard_coded',
      source: 'code_generator_service',
      quality_flags: ['identifier_rule_model_missing'],
      warning_count: 1,
    };
  }).filter((item) => !search || `${item.code_type} ${item.display_name} ${item.prefix}`.toLowerCase().includes(search));

  return {
    entity: 'identifier-rules',
    meta: {
      title: 'Quy tắc mã định danh',
      domain: 'platform',
      route_hint: '/api/admin/master-data/identifier-rules',
      primary_action: 'preview_identifier_rule',
      backend_status: 'counter_only_missing_identifier_rule_model',
    },
    summary: {
      total: items.length,
      active: items.filter((item) => item.counter_key).length,
      counters: counters.length,
      hard_coded: items.filter((item) => !item.counter_key).length,
      warning_items: items.length,
    },
    items,
    counters,
    pagination: buildPagination(1, items.length, items.length),
  };
}

async function getBillingQuality() {
  const now = new Date();
  const in30Days = new Date(Date.now() + 30 * 86400000);
  const serviceFilter = { is_deleted: false };
  const [
    services,
    activeServices,
    missingPrice,
    missingDepartment,
    expiring,
    activePriceVersions,
    pendingPriceVersions,
    servicesWithCharges,
    servicesWithInvoiceItems,
  ] = await Promise.all([
    ServiceCatalog.countDocuments(serviceFilter),
    ServiceCatalog.countDocuments({ ...serviceFilter, status: 'active' }),
    ServiceCatalog.countDocuments({ ...serviceFilter, status: 'active', is_billable: true, unit_price: { $lte: 0 } }),
    ServiceCatalog.countDocuments({ ...serviceFilter, status: 'active', $or: [{ department_id: null }, { department_id: { $exists: false } }] }),
    ServiceCatalog.countDocuments({ ...serviceFilter, status: 'active', effective_to: { $gte: now, $lte: in30Days } }),
    ServicePriceVersion.countDocuments({ status: 'active' }),
    ServicePriceVersion.countDocuments({ status: { $in: ['draft', 'pending', 'pending_approval'] } }),
    Charge.distinct('service_id', {}).then((ids) => ids.filter(Boolean).length),
    InvoiceItem.distinct('service_id', {}).then((ids) => ids.filter(Boolean).length),
  ]);

  const issues = [];
  if (missingPrice) issues.push(issue('critical', 'billing', 'services', 'Dịch vụ active/billable chưa có giá', `${missingPrice} dịch vụ có unit_price bằng 0 hoặc thiếu giá.`, { count: missingPrice }, 'Mở Dịch vụ y tế và tạo version giá hợp lệ.'));
  if (missingDepartment) issues.push(issue('warning', 'billing', 'services', 'Dịch vụ chưa gắn khoa/phòng', `${missingDepartment} dịch vụ active thiếu department_id.`, { count: missingDepartment }, 'Gắn department để báo cáo doanh thu và mapping vận hành đúng.'));
  if (expiring) issues.push(issue('warning', 'billing', 'service-prices', 'Dịch vụ sắp hết hiệu lực', `${expiring} dịch vụ hết hiệu lực trong 30 ngày.`, { count: expiring }, 'Chuẩn bị version thay thế hoặc gia hạn hiệu lực.'));

  return {
    domain: 'billing',
    label: 'Billing Catalog',
    score: Math.max(0, 100 - missingPrice * 8 - missingDepartment * 3 - expiring * 2),
    summary: {
      services,
      active_services: activeServices,
      missing_price: missingPrice,
      missing_department: missingDepartment,
      expiring,
      active_price_versions: activePriceVersions,
      pending_price_versions: pendingPriceVersions,
      services_with_charges: servicesWithCharges,
      services_with_invoice_items: servicesWithInvoiceItems,
    },
    issues,
  };
}

async function getPharmacyQuality() {
  const medFilter = { is_deleted: false };
  const supplierNearExpiry = new Date(Date.now() + 30 * 86400000);
  const [
    medications,
    activeMedications,
    missingUnit,
    missingDosageForm,
    missingRoute,
    missingService,
    controlledWithoutPolicy,
    highAlert,
    controlled,
    units,
    dosageForms,
    routes,
    suppliers,
    blockedSuppliers,
    licenseExpiring,
    warehouses,
    storageLocations,
    lockedLocations,
    missingQr,
    coldChainMissingRange,
    nearExpiryBatches,
  ] = await Promise.all([
    MedicationMaster.countDocuments(medFilter),
    MedicationMaster.countDocuments({ ...medFilter, status: 'active' }),
    MedicationMaster.countDocuments({ ...medFilter, status: 'active', $or: [{ unit_id: null }, { unit_id: { $exists: false } }, { unit: { $in: [null, ''] } }] }),
    MedicationMaster.countDocuments({ ...medFilter, status: 'active', $or: [{ dosage_form_id: null }, { dosage_form_id: { $exists: false } }, { dosage_form: { $in: [null, ''] } }] }),
    MedicationMaster.countDocuments({ ...medFilter, status: 'active', $or: [{ route_default_id: null }, { route_default_id: { $exists: false } }, { route_default: { $in: [null, ''] } }] }),
    MedicationMaster.countDocuments({ ...medFilter, status: 'active', $or: [{ service_id: null }, { service_id: { $exists: false } }] }),
    MedicationMaster.countDocuments({
      ...medFilter,
      status: 'active',
      $and: [
        { $or: [{ controlled_drug: true }, { is_controlled_drug: true }] },
        { $or: [{ controlled_drug_policy_id: null }, { controlled_drug_policy_id: { $exists: false } }] },
      ],
    }),
    MedicationMaster.countDocuments({ ...medFilter, status: 'active', high_alert_medication: true }),
    MedicationMaster.countDocuments({ ...medFilter, status: 'active', $or: [{ controlled_drug: true }, { is_controlled_drug: true }] }),
    MedicationUnit.countDocuments({ is_deleted: false }),
    DosageForm.countDocuments({ is_deleted: false }),
    AdministrationRoute.countDocuments({ is_deleted: false }),
    Supplier.countDocuments({ is_deleted: false }),
    Supplier.countDocuments({ is_deleted: false, status: 'blocked' }),
    Supplier.countDocuments({ is_deleted: false, license_expiry_date: { $lte: supplierNearExpiry } }),
    Warehouse.countDocuments({ is_deleted: false }),
    StorageLocation.countDocuments({ is_deleted: false }),
    StorageLocation.countDocuments({ is_deleted: false, $or: [{ is_locked: true }, { status: 'locked' }] }),
    StorageLocation.countDocuments({ is_deleted: false, $or: [{ qr_code: null }, { qr_code: '' }, { qr_code: { $exists: false } }] }),
    StorageLocation.countDocuments({ is_deleted: false, location_type: { $in: ['fridge', 'controlled_cabinet'] }, $or: [{ temperature_min: { $exists: false } }, { temperature_max: { $exists: false } }] }),
    StockBatch.countDocuments({ is_deleted: false, expiry_date: { $lte: supplierNearExpiry }, quantity_on_hand: { $gt: 0 } }),
  ]);

  const issues = [];
  if (missingUnit) issues.push(issue('critical', 'pharmacy', 'medications', 'Thuốc thiếu đơn vị chuẩn', `${missingUnit} thuốc active thiếu unit_id hoặc unit text.`, { count: missingUnit }, 'Chuẩn hóa qua Đơn vị thuốc và bulk assign.'));
  if (missingDosageForm) issues.push(issue('critical', 'pharmacy', 'medications', 'Thuốc thiếu dạng bào chế', `${missingDosageForm} thuốc active thiếu dosage_form_id.`, { count: missingDosageForm }, 'Gắn dạng bào chế để kiểm tra route và nhãn thuốc.'));
  if (missingRoute) issues.push(issue('warning', 'pharmacy', 'medications', 'Thuốc thiếu đường dùng mặc định', `${missingRoute} thuốc active thiếu route_default_id.`, { count: missingRoute }, 'Chạy compatibility check rồi bulk assign route.'));
  if (controlledWithoutPolicy) issues.push(issue('critical', 'pharmacy', 'medications', 'Controlled drug chưa có policy', `${controlledWithoutPolicy} thuốc kiểm soát thiếu controlled_drug_policy_id.`, { count: controlledWithoutPolicy }, 'Gắn controlled policy và yêu cầu double check/locked storage.'));
  if (blockedSuppliers) issues.push(issue('warning', 'pharmacy', 'suppliers', 'Nhà cung cấp đang bị block', `${blockedSuppliers} nhà cung cấp bị block.`, { count: blockedSuppliers }, 'Kiểm tra batches/transactions trước khi nhập hàng.'));
  if (coldChainMissingRange) issues.push(issue('warning', 'pharmacy', 'storage-locations', 'Vị trí lạnh thiếu ngưỡng nhiệt', `${coldChainMissingRange} vị trí fridge/controlled cabinet thiếu nhiệt độ min/max.`, { count: coldChainMissingRange }, 'Bổ sung temperature range để cảnh báo cold chain.'));
  if (nearExpiryBatches) issues.push(issue('warning', 'pharmacy', 'warehouses', 'Lô thuốc sắp hết hạn', `${nearExpiryBatches} lô còn tồn sắp hết hạn trong 30 ngày.`, { count: nearExpiryBatches }, 'Chạy FEFO/expiry quality và xử lý quarantine/discount/return.'));

  return {
    domain: 'pharmacy',
    label: 'Pharmacy Catalog',
    score: Math.max(0, 100 - missingUnit * 4 - missingDosageForm * 4 - missingRoute * 2 - controlledWithoutPolicy * 8 - coldChainMissingRange * 3),
    summary: {
      medications,
      active_medications: activeMedications,
      high_alert: highAlert,
      controlled,
      missing_unit: missingUnit,
      missing_dosage_form: missingDosageForm,
      missing_route: missingRoute,
      missing_service: missingService,
      controlled_without_policy: controlledWithoutPolicy,
      units,
      dosage_forms: dosageForms,
      routes,
      suppliers,
      blocked_suppliers: blockedSuppliers,
      license_expiring: licenseExpiring,
      warehouses,
      storage_locations: storageLocations,
      locked_locations: lockedLocations,
      missing_qr: missingQr,
      cold_chain_missing_range: coldChainMissingRange,
      near_expiry_batches: nearExpiryBatches,
    },
    issues,
  };
}

async function getClinicalQuality() {
  const [
    labTests,
    activeLabTests,
    labMissingSpecimen,
    labMissingService,
    labMissingTat,
    specimenTypes,
    specimenMissingLabel,
    specimenMissingContainer,
    modalities,
    rooms,
    equipment,
    equipmentDown,
    equipmentMaintenanceDue,
    procedures,
    activeProcedures,
    proceduresMissingService,
    proceduresMissingChecklist,
    reportTemplates,
    activeTemplates,
    templatesMissingSections,
    defaultTemplatesNotActive,
  ] = await Promise.all([
    LabTestCatalog.countDocuments({}),
    LabTestCatalog.countDocuments({ active: true }),
    LabTestCatalog.countDocuments({ active: true, $or: [{ specimen_type_id: null }, { specimen_type_id: { $exists: false } }] }),
    LabTestCatalog.countDocuments({ active: true, $or: [{ price_service_id: null }, { price_service_id: { $exists: false } }] }),
    LabTestCatalog.countDocuments({ active: true, $or: [{ turnaround_minutes: null }, { turnaround_minutes: { $exists: false } }] }),
    SpecimenTypeCatalog.countDocuments({}),
    SpecimenTypeCatalog.countDocuments({ active: true, $or: [{ label_template: null }, { label_template: '' }, { label_template: { $exists: false } }] }),
    SpecimenTypeCatalog.countDocuments({ active: true, $or: [{ container_type: null }, { container_type: '' }, { container_type: { $exists: false } }] }),
    ImagingModality.countDocuments({}),
    ImagingRoom.countDocuments({}),
    ImagingEquipment.countDocuments({}),
    ImagingEquipment.countDocuments({ status: 'out_of_service' }),
    ImagingEquipment.countDocuments({ next_maintenance_at: { $lte: new Date(Date.now() + 14 * 86400000) } }),
    ProcedureCatalog.countDocuments({}),
    ProcedureCatalog.countDocuments({ active: true }),
    ProcedureCatalog.countDocuments({ active: true, $or: [{ default_service_id: null }, { default_service_id: { $exists: false } }] }),
    ProcedureCatalog.countDocuments({ active: true, requires_preparation: true, $or: [{ checklist_template_id: null }, { checklist_template_id: { $exists: false } }] }),
    ResultReportTemplate.countDocuments({}),
    ResultReportTemplate.countDocuments({ status: 'active' }),
    ResultReportTemplate.countDocuments({ status: { $ne: 'retired' }, $or: [{ sections: { $size: 0 } }, { sections: { $exists: false } }] }),
    ResultReportTemplate.countDocuments({ is_default: true, status: { $ne: 'active' } }),
  ]);

  const issues = [];
  if (labMissingSpecimen) issues.push(issue('critical', 'clinical', 'lab-tests', 'Xét nghiệm thiếu loại mẫu', `${labMissingSpecimen} xét nghiệm active chưa gắn specimen_type_id.`, { count: labMissingSpecimen }, 'Gắn loại mẫu bệnh phẩm và container phù hợp.'));
  if (labMissingService) issues.push(issue('critical', 'clinical', 'lab-tests', 'Xét nghiệm chưa gắn billing service', `${labMissingService} xét nghiệm active thiếu price_service_id.`, { count: labMissingService }, 'Link service billing để phát sinh charge đúng.'));
  if (proceduresMissingChecklist) issues.push(issue('critical', 'clinical', 'procedures', 'Thủ thuật thiếu checklist', `${proceduresMissingChecklist} thủ thuật cần preparation nhưng chưa gắn checklist.`, { count: proceduresMissingChecklist }, 'Link checklist template trước khi mở vận hành.'));
  if (equipmentDown) issues.push(issue('warning', 'clinical', 'imaging-equipment', 'Thiết bị CĐHA out of service', `${equipmentDown} thiết bị đang out_of_service.`, { count: equipmentDown }, 'Điều chỉnh lịch/phòng hoặc restore sau bảo trì.'));
  if (templatesMissingSections) issues.push(issue('warning', 'clinical', 'report-templates', 'Template báo cáo thiếu section', `${templatesMissingSections} template không có sections.`, { count: templatesMissingSections }, 'Mở builder và bổ sung section/ký số/patient release layout.'));
  if (defaultTemplatesNotActive) issues.push(issue('critical', 'clinical', 'report-templates', 'Default template không active', `${defaultTemplatesNotActive} template đặt default nhưng chưa active.`, { count: defaultTemplatesNotActive }, 'Publish hoặc bỏ default để tránh lấy sai mẫu.'));

  return {
    domain: 'clinical',
    label: 'Clinical Catalog',
    score: Math.max(0, 100 - labMissingSpecimen * 5 - labMissingService * 5 - proceduresMissingChecklist * 6 - equipmentDown * 3 - templatesMissingSections * 2),
    summary: {
      lab_tests: labTests,
      active_lab_tests: activeLabTests,
      lab_missing_specimen: labMissingSpecimen,
      lab_missing_service: labMissingService,
      lab_missing_tat: labMissingTat,
      specimen_types: specimenTypes,
      specimen_missing_label: specimenMissingLabel,
      specimen_missing_container: specimenMissingContainer,
      imaging_modalities: modalities,
      imaging_rooms: rooms,
      imaging_equipment: equipment,
      equipment_down: equipmentDown,
      equipment_maintenance_due: equipmentMaintenanceDue,
      procedures,
      active_procedures: activeProcedures,
      procedures_missing_service: proceduresMissingService,
      procedures_missing_checklist: proceduresMissingChecklist,
      report_templates: reportTemplates,
      active_templates: activeTemplates,
      templates_missing_sections: templatesMissingSections,
      default_templates_not_active: defaultTemplatesNotActive,
    },
    issues,
  };
}

async function getSchedulingQuality() {
  const scheduleTypes = getScheduleTypeCatalog();
  const issues = [
    issue('warning', 'scheduling', 'schedule-types', 'Loại lịch đang hard-code', 'Schedule type hiện lấy từ constants/catalogs/schedule-types.js, chưa có model động để admin version/approve.', { count: scheduleTypes.length }, 'Bổ sung ScheduleType model khi cần quản trị động từ UI.'),
  ];
  return {
    domain: 'scheduling',
    label: 'Scheduling Catalog',
    score: 72,
    summary: {
      schedule_types: scheduleTypes.length,
      patient_portal_enabled: scheduleTypes.filter((item) => item.patient_portal_enabled).length,
      staff_only: scheduleTypes.filter((item) => item.staff_only).length,
      dynamic_model: false,
    },
    issues,
  };
}

async function getIdentifierQuality() {
  const counters = await Counter.find({}).lean();
  const issues = [
    issue('warning', 'platform', 'identifier-rules', 'Quy tắc mã định danh chưa động', 'Backend có Counter và code-generator service, nhưng chưa có IdentifierRule model để admin quản lý format/reset/scope.', { counters: counters.length }, 'Bổ sung IdentifierRule model cho preview/test-generate/reset-counter.'),
  ];
  return {
    domain: 'platform',
    label: 'Identifier Rules',
    score: counters.length ? 62 : 50,
    summary: {
      counters: counters.length,
      dynamic_rules: 0,
      hard_coded_rules: 13,
      counter_near_max: counters.filter((item) => Number(item.seq || 0) > 900000).length,
    },
    issues,
  };
}

async function getQualityDashboard() {
  const domains = await Promise.all([
    getBillingQuality(),
    getPharmacyQuality(),
    getClinicalQuality(),
    getSchedulingQuality(),
    getIdentifierQuality(),
  ]);
  const allIssues = domains.flatMap((domain) => domain.issues);
  return {
    generated_at: nowIso(),
    score: Math.round(domains.reduce((sum, domain) => sum + domain.score, 0) / Math.max(domains.length, 1)),
    domains,
    summary: {
      domains: domains.length,
      critical: allIssues.filter((item) => item.severity === 'critical').length,
      warning: allIssues.filter((item) => item.severity === 'warning').length,
      info: allIssues.filter((item) => item.severity === 'info').length,
      issues: allIssues.length,
    },
    issues: allIssues.sort((a, b) => {
      const weight = { critical: 3, warning: 2, info: 1 };
      return (weight[b.severity] || 0) - (weight[a.severity] || 0);
    }),
  };
}

async function getOverview() {
  const configs = getEntityConfigs();
  const [
    quality,
    services,
    medications,
    labTests,
    procedures,
    reportTemplates,
    recentChanges,
  ] = await Promise.all([
    getQualityDashboard(),
    summarizeEntity(configs.services),
    summarizeEntity(configs.medications),
    summarizeEntity(configs['lab-tests']),
    summarizeEntity(configs.procedures),
    summarizeEntity(configs['report-templates']),
    getRecentChanges({ limit: 8 }),
  ]);

  const entityTotal = services.total + medications.total + labTests.total + procedures.total + reportTemplates.total;
  return {
    generated_at: nowIso(),
    title: 'Master Data Control Center',
    summary: {
      total_entities: entityTotal,
      active_records: services.active + medications.active + labTests.active + procedures.active + reportTemplates.active,
      inactive_or_retired: (services.retired || 0) + (medications.inactive || 0) + labTests.inactive + procedures.inactive + (reportTemplates.retired || 0),
      data_quality_score: quality.score,
      critical_issues: quality.summary.critical,
      warning_issues: quality.summary.warning,
      changes_24h: recentChanges.summary.changes_24h,
      pending_approvals: quality.domains.find((item) => item.domain === 'billing')?.summary.pending_price_versions || 0,
    },
    domains: quality.domains,
    issue_board: {
      critical: quality.issues.filter((item) => item.severity === 'critical').slice(0, 20),
      warning: quality.issues.filter((item) => item.severity === 'warning').slice(0, 20),
      info: quality.issues.filter((item) => item.severity === 'info').slice(0, 20),
    },
    recent_changes: recentChanges.items,
    dependency_graph: getDependencyGraphSync(),
  };
}

async function getIssues(query = {}) {
  const dashboard = await getQualityDashboard();
  const severity = query.severity;
  const domain = query.domain;
  return {
    summary: dashboard.summary,
    items: dashboard.issues.filter((item) =>
      (!severity || item.severity === severity) && (!domain || item.domain === domain),
    ),
  };
}

async function getRecentChanges(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const actionPatterns = [
    /^billing\.service_catalog/i,
    /^pharmacy_config\./i,
    /^clinical_config\./i,
    /^master_data\./i,
    /^service_catalog\./i,
  ];
  const filter = {
    $or: [
      { module_key: { $in: ['billing', 'pharmacy', 'clinical_config', 'master_data'] } },
      { action: { $in: actionPatterns } },
      { target_type: { $in: ['service_catalog', 'service_price_version', 'medication_master', 'medication_unit', 'dosage_form', 'administration_route', 'supplier', 'storage_location', 'lab_test_catalog', 'specimen_type_catalog', 'procedure_catalog', 'result_report_template'] } },
    ],
  };
  const [items, changes24h] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).limit(limit).lean(),
    AuditLog.countDocuments({ ...filter, created_at: { $gte: since24h } }),
  ]);
  return {
    summary: {
      changes_24h: changes24h,
      returned: items.length,
    },
    items: items.map((item) => ({
      id: toId(item),
      time: item.created_at,
      actor_type: item.actor_type,
      actor_id: item.actor_id,
      action: item.action,
      module_key: item.module_key,
      target_type: item.target_type,
      target_id: item.target_id,
      status: item.status,
      severity: item.severity,
      message: item.message,
      ip_address: item.ip_address,
      request_id: item.request_id,
      before: item.before,
      after: item.after,
      metadata: item.metadata,
    })),
  };
}

function getDependencyGraphSync() {
  return {
    generated_at: nowIso(),
    nodes: [
      { id: 'service_catalog', label: 'ServiceCatalog', domain: 'billing', criticality: 'critical' },
      { id: 'service_price_versions', label: 'ServicePriceVersion', domain: 'billing', criticality: 'high' },
      { id: 'medication_master', label: 'MedicationMaster', domain: 'pharmacy', criticality: 'critical' },
      { id: 'medication_units', label: 'MedicationUnit', domain: 'pharmacy', criticality: 'high' },
      { id: 'dosage_forms', label: 'DosageForm', domain: 'pharmacy', criticality: 'high' },
      { id: 'administration_routes', label: 'AdministrationRoute', domain: 'pharmacy', criticality: 'high' },
      { id: 'suppliers', label: 'Supplier', domain: 'pharmacy', criticality: 'medium' },
      { id: 'warehouses', label: 'Warehouse', domain: 'pharmacy', criticality: 'medium' },
      { id: 'storage_locations', label: 'StorageLocation', domain: 'pharmacy', criticality: 'high' },
      { id: 'lab_test_catalogs', label: 'LabTestCatalog', domain: 'clinical', criticality: 'critical' },
      { id: 'specimen_type_catalogs', label: 'SpecimenTypeCatalog', domain: 'clinical', criticality: 'high' },
      { id: 'imaging_modalities', label: 'ImagingModality', domain: 'clinical', criticality: 'medium' },
      { id: 'imaging_equipment', label: 'ImagingEquipment', domain: 'clinical', criticality: 'high' },
      { id: 'procedure_catalogs', label: 'ProcedureCatalog', domain: 'clinical', criticality: 'critical' },
      { id: 'result_report_templates', label: 'ResultReportTemplate', domain: 'clinical', criticality: 'high' },
      { id: 'schedule_types', label: 'Schedule Types', domain: 'scheduling', criticality: 'medium' },
      { id: 'identifier_rules', label: 'Identifier Rules', domain: 'platform', criticality: 'critical' },
    ],
    edges: [
      { from: 'service_catalog', to: 'service_price_versions', relation: 'has_price_versions' },
      { from: 'service_catalog', to: 'lab_test_catalogs', relation: 'price_service_id' },
      { from: 'service_catalog', to: 'procedure_catalogs', relation: 'default_service_id' },
      { from: 'service_catalog', to: 'medication_master', relation: 'service_id' },
      { from: 'medication_units', to: 'medication_master', relation: 'unit_id' },
      { from: 'dosage_forms', to: 'medication_master', relation: 'dosage_form_id' },
      { from: 'administration_routes', to: 'medication_master', relation: 'route_default_id' },
      { from: 'administration_routes', to: 'dosage_forms', relation: 'allowed_route_ids' },
      { from: 'specimen_type_catalogs', to: 'lab_test_catalogs', relation: 'specimen_type_id' },
      { from: 'imaging_modalities', to: 'imaging_equipment', relation: 'modality' },
      { from: 'imaging_equipment', to: 'imaging_modalities', relation: 'requires_modality' },
      { from: 'imaging_equipment', to: 'imaging_modalities', relation: 'room_ready_modality' },
      { from: 'imaging_equipment', to: 'result_report_templates', relation: 'template_modality' },
      { from: 'procedure_catalogs', to: 'result_report_templates', relation: 'procedure_code' },
      { from: 'schedule_types', to: 'service_catalog', relation: 'future_default_service_id' },
      { from: 'identifier_rules', to: 'service_catalog', relation: 'generated_service_codes' },
    ],
  };
}

async function getDependencyGraph() {
  return getDependencyGraphSync();
}

async function getEntityDependencies(entity, id) {
  const result = {
    entity,
    id,
    generated_at: nowIso(),
    references: [],
    impacts: [],
    retire_blockers: [],
  };

  if (entity === 'services') {
    const [labTests, procedures, medications, charges, invoiceItems, versions] = await Promise.all([
      LabTestCatalog.find({ price_service_id: id }).select('code name active').limit(50).lean(),
      ProcedureCatalog.find({ default_service_id: id }).select('code name active').limit(50).lean(),
      MedicationMaster.find({ service_id: id, is_deleted: false }).select('medication_code generic_name status').limit(50).lean(),
      Charge.countDocuments({ service_id: id }),
      InvoiceItem.countDocuments({ service_id: id }),
      ServicePriceVersion.find({ service_id: id }).sort({ version_no: -1 }).limit(20).lean(),
    ]);
    result.references.push(
      { type: 'lab_tests', count: labTests.length, items: labTests },
      { type: 'procedures', count: procedures.length, items: procedures },
      { type: 'medications', count: medications.length, items: medications },
      { type: 'price_versions', count: versions.length, items: versions },
      { type: 'charges', count: charges },
      { type: 'invoice_items', count: invoiceItems },
    );
    if (labTests.some((item) => item.active)) result.retire_blockers.push('active_lab_tests_linked');
    if (procedures.some((item) => item.active)) result.retire_blockers.push('active_procedures_linked');
    if (medications.some((item) => item.status === 'active')) result.retire_blockers.push('active_medications_linked');
    if (charges || invoiceItems) result.impacts.push('historical_billing_rows_exist');
  }

  if (entity === 'medication-units') {
    const medications = await MedicationMaster.find({ is_deleted: false, unit_id: id }).select('medication_code generic_name brand_name status').limit(100).lean();
    result.references.push({ type: 'medications', count: medications.length, items: medications });
    if (medications.some((item) => item.status === 'active')) result.retire_blockers.push('active_medications_use_unit');
  }

  if (entity === 'dosage-forms') {
    const medications = await MedicationMaster.find({ is_deleted: false, dosage_form_id: id }).select('medication_code generic_name brand_name status').limit(100).lean();
    const routes = await AdministrationRoute.find({ is_deleted: false, allowed_dosage_form_ids: id }).select('code name status').limit(100).lean();
    result.references.push({ type: 'medications', count: medications.length, items: medications }, { type: 'routes', count: routes.length, items: routes });
    if (medications.some((item) => item.status === 'active')) result.retire_blockers.push('active_medications_use_dosage_form');
  }

  if (entity === 'administration-routes') {
    const medications = await MedicationMaster.find({ is_deleted: false, route_default_id: id }).select('medication_code generic_name brand_name status').limit(100).lean();
    const dosageForms = await DosageForm.find({ is_deleted: false, allowed_route_ids: id }).select('code name status').limit(100).lean();
    result.references.push({ type: 'medications', count: medications.length, items: medications }, { type: 'dosage_forms', count: dosageForms.length, items: dosageForms });
    if (medications.some((item) => item.status === 'active')) result.retire_blockers.push('active_medications_use_route');
  }

  if (entity === 'specimen-types') {
    const labTests = await LabTestCatalog.find({ specimen_type_id: id }).select('code name active').limit(100).lean();
    result.references.push({ type: 'lab_tests', count: labTests.length, items: labTests });
    if (labTests.some((item) => item.active)) result.retire_blockers.push('active_lab_tests_use_specimen_type');
  }

  return result;
}

async function runQualityCheck() {
  const dashboard = await getQualityDashboard();
  return {
    ...dashboard,
    run: {
      status: 'completed',
      mode: 'facade_scan',
      completed_at: nowIso(),
      checked_domains: dashboard.domains.map((item) => item.domain),
    },
  };
}

module.exports = {
  getDependencyGraph,
  getEntityDependencies,
  getIssues,
  getOverview,
  getQualityDashboard,
  getRecentChanges,
  listEntity,
  runQualityCheck,
};
