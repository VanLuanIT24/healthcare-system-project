const mongoose = require('mongoose');
const {
  Attachment,
  AttachmentAccessLog,
  AuditLog,
  Encounter,
  ImagingOrder,
  ImagingReport,
  LabOrder,
  LabResult,
  MedicalRecord,
  MissingDocumentTask,
  Order,
  Patient,
  ProcedureOrder,
  RequiredDocumentRule,
} = require('../models');
const recordsService = require('./records.service');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const fileScanService = require('../files/file-scan.service');
const {
  ATTACHMENT_ENTITY_TYPE,
  ATTACHMENT_STATUS,
  DOCUMENT_REVIEW_STATUS,
  DOCUMENT_SOURCE,
  DOCUMENT_VISIBILITY,
  IMAGING_ORDER_STATUS,
  IMAGING_REPORT_STATUS,
  LAB_RESULT_STATUS,
  PROCEDURE_STATUS,
} = require('../constants/statuses');
const { PERMISSION } = require('../constants/permissions');

const CLINICAL_ENTITY_TYPES = [
  ATTACHMENT_ENTITY_TYPE.LAB_RESULT,
  ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER,
  ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT,
  ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER,
  ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD,
  ATTACHMENT_ENTITY_TYPE.PATIENT,
  ATTACHMENT_ENTITY_TYPE.ENCOUNTER,
  ATTACHMENT_ENTITY_TYPE.ORDER,
];

const MODULE_ENTITY_TYPES = {
  lab: [ATTACHMENT_ENTITY_TYPE.LAB_RESULT, ATTACHMENT_ENTITY_TYPE.SPECIMEN],
  imaging: [ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER, ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT],
  procedure: [ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER],
  medical_record: [ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD, ATTACHMENT_ENTITY_TYPE.PATIENT, ATTACHMENT_ENTITY_TYPE.ENCOUNTER],
  other: [ATTACHMENT_ENTITY_TYPE.ORDER, ATTACHMENT_ENTITY_TYPE.OTHER],
};

const READ_PERMISSIONS = [
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_CLINICAL,
  PERMISSION.ATTACHMENTS.READ_BY_ENTITY,
  PERMISSION.ATTACHMENTS.READ_LAB,
  PERMISSION.ATTACHMENTS.READ_IMAGING,
  PERMISSION.ATTACHMENTS.READ_PROCEDURE,
  PERMISSION.ATTACHMENTS.READ_DEPARTMENT,
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
];

const WRITE_PERMISSIONS = [
  PERMISSION.ATTACHMENTS.MANAGE,
  PERMISSION.ATTACHMENTS.UPLOAD,
  PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL,
  PERMISSION.DOCUMENTS.REVIEW,
  PERMISSION.DOCUMENTS.APPROVE,
  PERMISSION.DOCUMENTS.REJECT,
];

const DEFAULT_REQUIRED_RULES = [
  {
    module: 'imaging',
    entity_type: ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER,
    trigger_status: IMAGING_ORDER_STATUS.COMPLETED,
    required_category: 'imaging_file',
    expected_file_label: 'File hình ảnh / DICOM',
    sla_minutes: 30,
    severity: 'high',
    responsible_role: 'imaging_technician',
  },
  {
    module: 'imaging',
    entity_type: ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT,
    trigger_status: IMAGING_REPORT_STATUS.FINAL,
    required_category: 'imaging_report_pdf',
    expected_file_label: 'PDF báo cáo CĐHA',
    sla_minutes: 15,
    severity: 'high',
    responsible_role: 'radiologist',
  },
  {
    module: 'procedure',
    entity_type: ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER,
    trigger_status: PROCEDURE_STATUS.SCHEDULED,
    required_category: 'procedure_consent',
    expected_file_label: 'Consent thủ thuật',
    sla_minutes: 120,
    severity: 'critical',
    responsible_role: 'procedure_staff',
  },
  {
    module: 'procedure',
    entity_type: ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER,
    trigger_status: PROCEDURE_STATUS.COMPLETED,
    required_category: 'procedure_report',
    expected_file_label: 'Biên bản thủ thuật',
    sla_minutes: 30,
    severity: 'high',
    responsible_role: 'procedure_staff',
  },
  {
    module: 'lab',
    entity_type: ATTACHMENT_ENTITY_TYPE.LAB_RESULT,
    trigger_status: LAB_RESULT_STATUS.FINAL,
    required_category: 'lab_result_pdf',
    expected_file_label: 'PDF kết quả xét nghiệm',
    sla_minutes: 15,
    severity: 'medium',
    responsible_role: 'lab_manager',
  },
];

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.id || actor._id || null;
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type || (actor.userId ? 'staff' : 'system');
}

function toId(value) {
  if (!value) return null;
  return String(value._id || value.id || value);
}

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(normalizeString).filter(Boolean);
  return String(value || '')
    .split(',')
    .map(normalizeString)
    .filter(Boolean);
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function assertRead(actor = {}) {
  permissionService.assertAnyPermission(actor, READ_PERMISSIONS);
}

function assertWrite(actor = {}) {
  permissionService.assertAnyPermission(actor, [
    PERMISSION.ATTACHMENTS.MANAGE,
    PERMISSION.ATTACHMENTS.UPLOAD,
    PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL,
    PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT,
    PERMISSION.ATTACHMENTS.ARCHIVE,
    PERMISSION.ATTACHMENTS.RESTORE,
    PERMISSION.ATTACHMENTS.DELETE_SOFT,
    ...WRITE_PERMISSIONS,
  ]);
}

function moduleFromEntityType(entityType) {
  if (MODULE_ENTITY_TYPES.lab.includes(entityType)) return 'lab';
  if (MODULE_ENTITY_TYPES.imaging.includes(entityType)) return 'imaging';
  if (MODULE_ENTITY_TYPES.procedure.includes(entityType)) return 'procedure';
  if (MODULE_ENTITY_TYPES.medical_record.includes(entityType)) return 'medical_record';
  return 'other';
}

function buildEntityTypesFromModule(moduleValue) {
  const modules = normalizeList(moduleValue).filter((item) => item !== 'all');
  if (!modules.length) return [];
  return modules.flatMap((moduleKey) => MODULE_ENTITY_TYPES[moduleKey] || []).filter(Boolean);
}

function buildAttachmentFilter(query = {}) {
  const filter = {};
  const entityTypes = [
    ...normalizeList(query.entity_type || query.entity_types),
    ...buildEntityTypesFromModule(query.module),
  ].filter((value) => value && value !== 'all');
  if (entityTypes.length) filter.entity_type = { $in: [...new Set(entityTypes)] };
  else if (query.clinical_only !== 'false') filter.entity_type = { $in: CLINICAL_ENTITY_TYPES };

  for (const field of ['patient_id', 'encounter_id', 'order_id', 'uploaded_by', 'category', 'source', 'review_status', 'scan_status', 'visibility', 'mime_type']) {
    if (query[field]) {
      const values = normalizeList(query[field]);
      filter[field] = values.length > 1 ? { $in: values } : values[0];
    }
  }
  if (query.entity_id) filter.entity_id = query.entity_id;
  if (query.status) filter.status = query.status;
  else filter.status = { $ne: ATTACHMENT_STATUS.DELETED };

  const released = parseBoolean(query.released_to_patient);
  if (released !== undefined) filter.released_to_patient = released;

  const hasPreview = parseBoolean(query.has_preview);
  if (hasPreview !== undefined) filter.preview_url = hasPreview ? { $exists: true, $ne: '' } : { $in: [null, ''] };
  const hasThumbnail = parseBoolean(query.has_thumbnail);
  if (hasThumbnail !== undefined) filter.thumbnail_url = hasThumbnail ? { $exists: true, $ne: '' } : { $in: [null, ''] };

  if (query.date_from || query.date_to) {
    filter.created_at = {};
    if (query.date_from) filter.created_at.$gte = new Date(query.date_from);
    if (query.date_to) filter.created_at.$lte = new Date(query.date_to);
  }

  const search = normalizeString(query.q || query.search);
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [
      { file_name: regex },
      { original_name: regex },
      { category: regex },
      { description: regex },
      { mime_type: regex },
    ];
  }
  return filter;
}

function buildSort(query = {}) {
  const allowed = new Set(['created_at', 'updated_at', 'released_at', 'last_downloaded_at', 'file_size', 'original_name']);
  const sortBy = allowed.has(query.sort_by) ? query.sort_by : 'created_at';
  const direction = String(query.sort_direction || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  return { [sortBy]: direction };
}

function filePermissions(actor = {}) {
  const canManage = permissionService.hasPermission(actor, PERMISSION.ATTACHMENTS.MANAGE);
  return {
    canPreview: permissionService.hasAnyPermission(actor, READ_PERMISSIONS),
    canDownload: permissionService.hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.DOWNLOAD, PERMISSION.ATTACHMENTS.READ, PERMISSION.ATTACHMENTS.MANAGE]),
    canUpload: permissionService.hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL, PERMISSION.ATTACHMENTS.CREATE, PERMISSION.ATTACHMENTS.MANAGE]),
    canRelease: permissionService.hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.ATTACHMENTS.MANAGE]),
    canRevokeRelease: permissionService.hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.ATTACHMENTS.MANAGE]),
    canArchive: permissionService.hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.ATTACHMENTS.MANAGE]),
    canRestore: permissionService.hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.RESTORE, PERMISSION.ATTACHMENTS.MANAGE]),
    canDelete: permissionService.hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.MANAGE]),
    canReview: permissionService.hasAnyPermission(actor, [PERMISSION.DOCUMENTS.REVIEW, PERMISSION.DOCUMENTS.APPROVE, PERMISSION.DOCUMENTS.REJECT, PERMISSION.ATTACHMENTS.MANAGE]),
    canRescan: canManage || permissionService.hasAnyPermission(actor, [PERMISSION.DOCUMENTS.REVIEW, PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL]),
    canEditMetadata: canManage || permissionService.hasAnyPermission(actor, [PERMISSION.DOCUMENTS.REVIEW, PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL]),
    canViewAudit: permissionService.hasAnyPermission(actor, [PERMISSION.AUDIT_LOGS.READ, PERMISSION.AUDIT_LOGS.READ_ENTITY, PERMISSION.ATTACHMENTS.MANAGE]),
  };
}

function slimUser(user) {
  if (!user) return null;
  return {
    id: toId(user),
    full_name: user.full_name,
    name: user.full_name || user.username || user.employee_code,
    username: user.username,
    employee_code: user.employee_code,
  };
}

function ageFromDob(value) {
  if (!value) return null;
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function slimPatient(patient) {
  if (!patient) return null;
  return {
    id: toId(patient),
    code: patient.patient_code,
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    name: patient.full_name,
    gender: patient.gender,
    date_of_birth: patient.date_of_birth,
    age: ageFromDob(patient.date_of_birth),
  };
}

function entityKey(type, id) {
  return `${type}:${String(id || '')}`;
}

async function loadRelatedEntityMap(attachments = []) {
  const idsByType = new Map();
  for (const attachment of attachments) {
    if (!idsByType.has(attachment.entity_type)) idsByType.set(attachment.entity_type, []);
    idsByType.get(attachment.entity_type).push(attachment.entity_id);
  }
  const map = new Map();
  const tasks = [];
  if (idsByType.has(ATTACHMENT_ENTITY_TYPE.LAB_RESULT)) {
    tasks.push(LabResult.find({ _id: { $in: idsByType.get(ATTACHMENT_ENTITY_TYPE.LAB_RESULT) } })
      .populate({ path: 'lab_order_id', select: 'lab_order_no test_name test_code priority status order_id' })
      .lean()
      .then((rows) => rows.forEach((row) => map.set(entityKey(ATTACHMENT_ENTITY_TYPE.LAB_RESULT, row._id), {
        type: ATTACHMENT_ENTITY_TYPE.LAB_RESULT,
        id: toId(row),
        code: row.result_no,
        title: row.lab_order_id?.test_name || row.result_no,
        status: row.status,
        priority: row.lab_order_id?.priority,
        order_id: toId(row.lab_order_id?.order_id),
      }))));
  }
  if (idsByType.has(ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER)) {
    tasks.push(ImagingOrder.find({ _id: { $in: idsByType.get(ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER) } }).lean()
      .then((rows) => rows.forEach((row) => map.set(entityKey(ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER, row._id), {
        type: ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER,
        id: toId(row),
        code: row.imaging_order_no,
        title: [row.modality?.toUpperCase(), row.body_part].filter(Boolean).join(' '),
        status: row.status,
        priority: row.priority,
        order_id: toId(row.order_id),
      }))));
  }
  if (idsByType.has(ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT)) {
    tasks.push(ImagingReport.find({ _id: { $in: idsByType.get(ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT) } })
      .populate({ path: 'imaging_order_id', select: 'imaging_order_no modality body_part priority order_id' })
      .lean()
      .then((rows) => rows.forEach((row) => map.set(entityKey(ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT, row._id), {
        type: ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT,
        id: toId(row),
        code: row.report_no,
        title: [row.imaging_order_id?.modality?.toUpperCase(), row.imaging_order_id?.body_part].filter(Boolean).join(' '),
        status: row.status,
        priority: row.imaging_order_id?.priority,
        order_id: toId(row.imaging_order_id?.order_id),
        critical: Boolean(row.is_critical),
      }))));
  }
  if (idsByType.has(ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER)) {
    tasks.push(ProcedureOrder.find({ _id: { $in: idsByType.get(ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER) } }).lean()
      .then((rows) => rows.forEach((row) => map.set(entityKey(ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER, row._id), {
        type: ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER,
        id: toId(row),
        code: row.procedure_order_no,
        title: row.procedure_name,
        status: row.status,
        priority: row.priority,
        order_id: toId(row.order_id),
      }))));
  }
  if (idsByType.has(ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD)) {
    tasks.push(MedicalRecord.find({ _id: { $in: idsByType.get(ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD) } }).lean()
      .then((rows) => rows.forEach((row) => map.set(entityKey(ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD, row._id), {
        type: ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD,
        id: toId(row),
        code: row.record_no,
        title: row.title,
        status: row.status,
      }))));
  }
  await Promise.all(tasks);
  return map;
}

function serializeFile(attachment, relatedMap, actor = {}) {
  const entity = relatedMap.get(entityKey(attachment.entity_type, attachment.entity_id)) || {
    type: attachment.entity_type,
    id: toId(attachment.entity_id),
  };
  return {
    id: toId(attachment),
    fileName: attachment.file_name,
    file_name: attachment.file_name,
    originalName: attachment.original_name,
    original_name: attachment.original_name,
    mimeType: attachment.mime_type,
    mime_type: attachment.mime_type,
    fileSize: attachment.file_size,
    file_size: attachment.file_size,
    patient: slimPatient(attachment.patient_id),
    encounter_id: toId(attachment.encounter_id),
    order_id: toId(attachment.order_id),
    module: moduleFromEntityType(attachment.entity_type),
    entity,
    category: attachment.category,
    description: attachment.description,
    source: attachment.source,
    scanStatus: attachment.scan_status,
    scan_status: attachment.scan_status,
    scan_result: attachment.scan_result,
    reviewStatus: attachment.review_status,
    review_status: attachment.review_status,
    review_note: attachment.review_note,
    reviewed_by: slimUser(attachment.reviewed_by),
    reviewed_at: attachment.reviewed_at,
    visibility: attachment.visibility,
    releasedToPatient: Boolean(attachment.released_to_patient),
    released_to_patient: Boolean(attachment.released_to_patient),
    releasedAt: attachment.released_at,
    released_at: attachment.released_at,
    released_by: slimUser(attachment.released_by),
    release_revoked_at: attachment.release_revoked_at,
    release_revoke_reason: attachment.release_revoke_reason,
    previewUrl: attachment.preview_url,
    preview_url: attachment.preview_url,
    thumbnailUrl: attachment.thumbnail_url,
    thumbnail_url: attachment.thumbnail_url,
    downloadCount: attachment.download_count || 0,
    download_count: attachment.download_count || 0,
    lastDownloadedAt: attachment.last_downloaded_at,
    last_downloaded_at: attachment.last_downloaded_at,
    uploaded_by: slimUser(attachment.uploaded_by),
    archived_by: slimUser(attachment.archived_by),
    deleted_by: slimUser(attachment.deleted_by),
    createdAt: attachment.created_at,
    created_at: attachment.created_at,
    updatedAt: attachment.updated_at,
    updated_at: attachment.updated_at,
    status: attachment.status,
    permissions: filePermissions(actor),
  };
}

async function listFiles(query = {}, actor = {}) {
  assertRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = buildAttachmentFilter(query);
  const [items, total] = await Promise.all([
    Attachment.find(filter)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('uploaded_by released_by reviewed_by archived_by deleted_by', 'full_name username employee_code')
      .sort(buildSort(query))
      .skip(skip)
      .limit(limit)
      .lean(),
    Attachment.countDocuments(filter),
  ]);
  const relatedMap = await loadRelatedEntityMap(items);
  return {
    items: items.map((attachment) => serializeFile(attachment, relatedMap, actor)),
    pagination: buildPagination(page, limit, total),
  };
}

async function getSummary(query = {}, actor = {}) {
  assertRead(actor);
  const filter = buildAttachmentFilter({ ...query, status: query.status || undefined });
  const today = { $gte: startOfDay(), $lte: endOfDay() };
  const [total, todayCount, pendingScan, scanErrors, pendingReview, released, unreleased, archived, deleted, patientUploads, externalImports, downloadsToday, missingOpen] = await Promise.all([
    Attachment.countDocuments(filter),
    Attachment.countDocuments({ ...filter, created_at: today }),
    Attachment.countDocuments({ ...filter, scan_status: 'pending' }),
    Attachment.countDocuments({ ...filter, scan_status: { $in: ['infected', 'failed'] } }),
    Attachment.countDocuments({ ...filter, review_status: DOCUMENT_REVIEW_STATUS.PENDING }),
    Attachment.countDocuments({ ...filter, released_to_patient: true }),
    Attachment.countDocuments({ ...filter, released_to_patient: { $ne: true } }),
    Attachment.countDocuments({ ...filter, status: ATTACHMENT_STATUS.ARCHIVED }),
    Attachment.countDocuments({ ...filter, status: ATTACHMENT_STATUS.DELETED }),
    Attachment.countDocuments({ ...filter, source: DOCUMENT_SOURCE.PATIENT_UPLOAD }),
    Attachment.countDocuments({ ...filter, source: DOCUMENT_SOURCE.EXTERNAL_IMPORT }),
    Attachment.countDocuments({ ...filter, last_downloaded_at: today }),
    MissingDocumentTask.countDocuments({ status: { $in: ['open', 'overdue'] } }),
  ]);
  return {
    total_files: total,
    files_today: todayCount,
    pending_scan: pendingScan,
    scan_errors: scanErrors,
    pending_review: pendingReview,
    released_to_patient: released,
    unreleased,
    missing_files: missingOpen,
    archived,
    deleted,
    patient_uploads: patientUploads,
    external_imports: externalImports,
    downloads_today: downloadsToday,
  };
}

async function getDetail(attachmentId, actor = {}) {
  assertRead(actor);
  const attachment = await Attachment.findById(attachmentId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('uploaded_by released_by reviewed_by archived_by deleted_by release_revoked_by', 'full_name username employee_code')
    .lean();
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  await recordsService.getAttachmentDetail(attachmentId, actor);
  const [relatedMap, audit, accessLogs] = await Promise.all([
    loadRelatedEntityMap([attachment]),
    AuditLog.find({ target_type: 'attachment', target_id: attachment._id }).sort({ created_at: -1 }).limit(50).lean(),
    AttachmentAccessLog.find({ attachment_id: attachment._id }).sort({ occurred_at: -1 }).limit(50).lean(),
  ]);
  await recordsService.recordAttachmentAccess({ attachment, actor, action: 'view' });
  return {
    file: serializeFile(attachment, relatedMap, actor),
    audit,
    access_logs: accessLogs,
    related: relatedMap.get(entityKey(attachment.entity_type, attachment.entity_id)) || null,
  };
}

async function getAccessLogs(attachmentId, query = {}, actor = {}) {
  assertRead(actor);
  await recordsService.getAttachmentDetail(attachmentId, actor);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const [items, total] = await Promise.all([
    AttachmentAccessLog.find({ attachment_id: attachmentId }).sort({ occurred_at: -1 }).skip(skip).limit(limit).lean(),
    AttachmentAccessLog.countDocuments({ attachment_id: attachmentId }),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getAudit(attachmentId, query = {}, actor = {}) {
  assertRead(actor);
  await recordsService.getAttachmentDetail(attachmentId, actor);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const [items, total] = await Promise.all([
    AuditLog.find({ target_type: 'attachment', target_id: attachmentId }).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments({ target_type: 'attachment', target_id: attachmentId }),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function updateMetadata(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  assertWrite(actor);
  await recordsService.getAttachmentDetail(attachmentId, actor);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const before = attachment.toObject();
  for (const field of ['category', 'description', 'visibility', 'preview_url', 'thumbnail_url']) {
    if (payload[field] !== undefined) attachment[field] = payload[field];
  }
  if (payload.source && Object.values(DOCUMENT_SOURCE).includes(payload.source)) attachment.source = payload.source;
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordsService.recordAttachmentAccess({ attachment, actor, action: 'metadata_update', requestMeta });
  await recordAuditLog({ actor, action: 'attachments.metadata_updated', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Cập nhật metadata attachment thành công.', requestMeta, before, after: attachment.toObject() });
  return getDetail(attachmentId, actor);
}

async function reviewAttachment(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  permissionService.assertAnyPermission(actor, [PERMISSION.DOCUMENTS.REVIEW, PERMISSION.DOCUMENTS.APPROVE, PERMISSION.DOCUMENTS.REJECT, PERMISSION.ATTACHMENTS.MANAGE]);
  await recordsService.getAttachmentDetail(attachmentId, actor);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const decision = payload.decision || payload.review_status;
  if (![DOCUMENT_REVIEW_STATUS.ACCEPTED, DOCUMENT_REVIEW_STATUS.REJECTED, DOCUMENT_REVIEW_STATUS.PENDING].includes(decision)) {
    throw createError('decision/review_status không hợp lệ.', 400);
  }
  const before = attachment.toObject();
  attachment.review_status = decision;
  attachment.review_note = payload.review_note || payload.reason || payload.note;
  attachment.reviewed_by = actorUserId(actor);
  attachment.reviewed_at = new Date();
  if (payload.category) attachment.category = payload.category;
  if (payload.visibility) attachment.visibility = payload.visibility;
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordsService.recordAttachmentAccess({ attachment, actor, action: 'review', requestMeta, metadata: { decision } });
  await recordAuditLog({ actor, action: `attachments.review.${decision}`, targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Review attachment thành công.', requestMeta, before, after: attachment.toObject() });
  return getDetail(attachmentId, actor);
}

async function releaseFile(attachmentId, actor = {}, requestMeta = {}) {
  const result = await recordsService.releaseAttachmentToPatient(attachmentId, actor, requestMeta);
  return result;
}

async function revokeRelease(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  return recordsService.revokeAttachmentRelease(attachmentId, payload, actor, requestMeta);
}

async function archiveFile(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  const result = await recordsService.archiveAttachment(attachmentId, payload, actor, requestMeta);
  const attachment = await Attachment.findById(attachmentId).lean();
  await recordsService.recordAttachmentAccess({ attachment, actor, action: 'archive', requestMeta });
  return result;
}

async function restoreFile(attachmentId, actor = {}, requestMeta = {}) {
  const result = await recordsService.restoreAttachment(attachmentId, actor, requestMeta);
  const attachment = await Attachment.findById(attachmentId).lean();
  await recordsService.recordAttachmentAccess({ attachment, actor, action: 'restore', requestMeta });
  return result;
}

async function deleteFile(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  const result = await recordsService.softDeleteAttachment(attachmentId, payload, actor, requestMeta);
  const attachment = await Attachment.findById(attachmentId).lean();
  await recordsService.recordAttachmentAccess({ attachment, actor, action: 'delete', requestMeta, reason: payload.reason || payload.delete_reason });
  return result;
}

async function rescanFile(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  assertWrite(actor);
  await recordsService.getAttachmentDetail(attachmentId, actor);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const before = attachment.toObject();
  const attemptCount = Number(attachment.scan_result?.attempt_count || 0) + 1;
  attachment.scan_status = 'pending';
  attachment.scan_result = {
    ...(attachment.scan_result || {}),
    provider: payload.provider || attachment.scan_result?.provider || process.env.FILE_SCAN_PROVIDER || 'manual',
    queued_at: new Date(),
    attempt_count: attemptCount,
    requested_reason: payload.reason,
  };
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordsService.recordAttachmentAccess({ attachment, actor, action: 'rescan', requestMeta, reason: payload.reason });
  await recordAuditLog({ actor, action: 'attachments.scan.rescan_requested', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Yêu cầu rescan attachment thành công.', requestMeta, before, after: attachment.toObject() });
  return getDetail(attachmentId, actor);
}

async function quarantineFile(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  assertWrite(actor);
  await recordsService.getAttachmentDetail(attachmentId, actor);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const before = attachment.toObject();
  attachment.status = ATTACHMENT_STATUS.QUARANTINED;
  attachment.scan_status = payload.scan_status || attachment.scan_status || 'failed';
  attachment.scan_result = {
    ...(attachment.scan_result || {}),
    quarantined_at: new Date(),
    quarantine_reason: payload.reason || payload.quarantine_reason,
    threat_name: payload.threat_name || attachment.scan_result?.threat_name,
  };
  attachment.released_to_patient = false;
  attachment.signed_download_token_version = Number(attachment.signed_download_token_version || 1) + 1;
  attachment.signed_download_revoked_at = new Date();
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachments.scan.quarantined', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Quarantine attachment thành công.', requestMeta, before, after: attachment.toObject() });
  return getDetail(attachmentId, actor);
}

async function markScanSkipped(attachmentId, payload = {}, actor = {}, requestMeta = {}) {
  assertWrite(actor);
  await recordsService.getAttachmentDetail(attachmentId, actor);
  const reason = normalizeString(payload.reason || payload.scan_skip_reason);
  if (!reason) throw createError('reason là bắt buộc khi bỏ qua scan.', 400);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const before = attachment.toObject();
  attachment.scan_status = 'skipped';
  attachment.scan_result = {
    ...(attachment.scan_result || {}),
    skipped_at: new Date(),
    skipped_by: actorUserId(actor),
    skip_reason: reason,
  };
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachments.scan.skipped', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Đánh dấu scan skipped thành công.', requestMeta, before, after: attachment.toObject(), metadata: { reason } });
  return getDetail(attachmentId, actor);
}

async function activeRules() {
  const rules = await RequiredDocumentRule.find({ active: true }).lean();
  return rules.length ? rules : DEFAULT_REQUIRED_RULES;
}

async function hasRequiredAttachment(entityType, entityId, category) {
  return Attachment.exists({
    entity_type: entityType,
    entity_id: entityId,
    category,
    status: ATTACHMENT_STATUS.ACTIVE,
  });
}

function dueAtFrom(baseDate, minutes = 60) {
  const base = baseDate ? new Date(baseDate) : new Date();
  return new Date(base.getTime() + Number(minutes || 0) * 60000);
}

function missingTaskFromEntity(rule, entity) {
  const baseTime = entity.completed_at || entity.verified_at || entity.reported_at || entity.scheduled_start || entity.updated_at || entity.created_at;
  return {
    module: rule.module,
    entity_type: rule.entity_type,
    entity_id: entity._id,
    patient_id: entity.patient_id,
    encounter_id: entity.encounter_id,
    order_id: entity.order_id,
    rule_id: rule._id,
    required_category: rule.required_category,
    expected_file_label: rule.expected_file_label || rule.required_category,
    entity_code: entity.lab_order_no || entity.result_no || entity.imaging_order_no || entity.report_no || entity.procedure_order_no || entity.record_no,
    entity_title: entity.test_name || entity.procedure_name || [entity.modality?.toUpperCase(), entity.body_part].filter(Boolean).join(' ') || entity.title,
    trigger_status: rule.trigger_status,
    severity: rule.severity || 'medium',
    responsible_role: rule.responsible_role,
    due_at: dueAtFrom(baseTime, rule.sla_minutes),
    last_checked_at: new Date(),
  };
}

async function computeMissingCandidates(query = {}) {
  const rules = (await activeRules()).filter((rule) => !query.module || query.module === 'all' || rule.module === query.module);
  const candidates = [];
  for (const rule of rules) {
    let rows = [];
    if (rule.entity_type === ATTACHMENT_ENTITY_TYPE.LAB_RESULT) {
      rows = await LabResult.find({ status: { $in: [rule.trigger_status, LAB_RESULT_STATUS.AMENDED] } })
        .populate({ path: 'lab_order_id', select: 'order_id encounter_id test_name test_code lab_order_no priority' })
        .limit(300)
        .lean();
      rows = rows.map((row) => ({
        ...row,
        encounter_id: row.lab_order_id?.encounter_id,
        order_id: row.lab_order_id?.order_id,
        test_name: row.lab_order_id?.test_name,
        lab_order_no: row.lab_order_id?.lab_order_no,
      }));
    }
    if (rule.entity_type === ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER) {
      rows = await ImagingOrder.find({ status: rule.trigger_status }).limit(300).lean();
    }
    if (rule.entity_type === ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT) {
      rows = await ImagingReport.find({ status: { $in: [rule.trigger_status, IMAGING_REPORT_STATUS.AMENDED] } })
        .populate({ path: 'imaging_order_id', select: 'order_id encounter_id modality body_part imaging_order_no priority' })
        .limit(300)
        .lean();
      rows = rows.map((row) => ({
        ...row,
        encounter_id: row.imaging_order_id?.encounter_id,
        order_id: row.imaging_order_id?.order_id,
        modality: row.imaging_order_id?.modality,
        body_part: row.imaging_order_id?.body_part,
      }));
    }
    if (rule.entity_type === ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER) {
      rows = await ProcedureOrder.find({ status: rule.trigger_status }).limit(300).lean();
    }
    if (rule.entity_type === ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD) {
      rows = await MedicalRecord.find({ status: rule.trigger_status }).limit(300).lean();
    }
    for (const row of rows) {
      const exists = await hasRequiredAttachment(rule.entity_type, row._id, rule.required_category);
      if (!exists) candidates.push(missingTaskFromEntity(rule, row));
    }
  }
  return candidates;
}

async function recomputeMissingDocuments(query = {}, actor = {}, requestMeta = {}) {
  assertWrite(actor);
  const candidates = await computeMissingCandidates(query);
  const openKeys = new Set();
  for (const candidate of candidates) {
    const key = entityKey(`${candidate.entity_type}:${candidate.required_category}`, candidate.entity_id);
    openKeys.add(key);
    const currentStatus = new Date(candidate.due_at).getTime() < Date.now() ? 'overdue' : 'open';
    await MissingDocumentTask.findOneAndUpdate(
      {
        entity_type: candidate.entity_type,
        entity_id: candidate.entity_id,
        required_category: candidate.required_category,
        status: { $in: ['open', 'overdue'] },
      },
      {
        $set: {
          ...candidate,
          status: currentStatus,
          updated_by: actorUserId(actor),
        },
        $setOnInsert: { created_by: actorUserId(actor) },
      },
      { upsert: true, new: true },
    );
  }
  const openTasks = await MissingDocumentTask.find({ status: { $in: ['open', 'overdue'] } }).lean();
  for (const task of openTasks) {
    const key = entityKey(`${task.entity_type}:${task.required_category}`, task.entity_id);
    if (openKeys.has(key)) continue;
    const attachment = await Attachment.findOne({
      entity_type: task.entity_type,
      entity_id: task.entity_id,
      category: task.required_category,
      status: ATTACHMENT_STATUS.ACTIVE,
    }).lean();
    if (!attachment) continue;
    await MissingDocumentTask.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'resolved',
          resolved_at: new Date(),
          resolved_by: actorUserId(actor),
          resolved_attachment_id: attachment._id,
          updated_by: actorUserId(actor),
        },
      },
    );
  }
  await recordAuditLog({ actor, action: 'clinical_document_files.missing.recomputed', targetType: 'missing_document_task', status: 'success', message: 'Recompute missing document tasks thành công.', requestMeta, metadata: { generated: candidates.length } });
  return { generated: candidates.length, candidates };
}

async function listMissingDocuments(query = {}, actor = {}) {
  assertRead(actor);
  const live = parseBoolean(query.live) === true;
  const { page, limit, skip } = getPagination(query, 30, 100);
  if (live) {
    const items = await computeMissingCandidates(query);
    return { items: items.slice(skip, skip + limit), pagination: buildPagination(page, limit, items.length), live: true };
  }
  const filter = {};
  if (query.module) filter.module = query.module;
  if (query.status) filter.status = query.status;
  else filter.status = { $in: ['open', 'overdue'] };
  if (query.severity) filter.severity = query.severity;
  const [items, total] = await Promise.all([
    MissingDocumentTask.find(filter)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('assigned_to resolved_by waived_by', 'full_name username employee_code')
      .sort({ severity: -1, due_at: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MissingDocumentTask.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function waiveMissingTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  assertWrite(actor);
  const reason = normalizeString(payload.reason || payload.waive_reason);
  if (!reason) throw createError('reason là bắt buộc khi waive missing file.', 400);
  const task = await MissingDocumentTask.findById(taskId);
  if (!task) throw createError('Không tìm thấy missing document task.', 404);
  if (!['open', 'overdue'].includes(task.status)) throw createError('Task không còn open/overdue.', 409);
  task.status = 'waived';
  task.waived_by = actorUserId(actor);
  task.waived_at = new Date();
  task.waive_reason = reason;
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({ actor, action: 'clinical_document_files.missing.waived', targetType: 'missing_document_task', targetId: task._id, status: 'success', message: 'Waive missing document task thành công.', requestMeta, metadata: { reason } });
  return task.toObject();
}

async function resolveMissingTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  assertWrite(actor);
  const task = await MissingDocumentTask.findById(taskId);
  if (!task) throw createError('Không tìm thấy missing document task.', 404);
  const attachmentId = payload.attachment_id || payload.resolved_attachment_id;
  if (attachmentId) {
    const attachment = await Attachment.findById(attachmentId).lean();
    if (!attachment) throw createError('Không tìm thấy attachment resolve task.', 404);
    task.resolved_attachment_id = attachment._id;
  }
  task.status = 'resolved';
  task.resolved_by = actorUserId(actor);
  task.resolved_at = new Date();
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({ actor, action: 'clinical_document_files.missing.resolved', targetType: 'missing_document_task', targetId: task._id, status: 'success', message: 'Resolve missing document task thành công.', requestMeta });
  return task.toObject();
}

async function assignMissingTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  assertWrite(actor);
  const task = await MissingDocumentTask.findById(taskId);
  if (!task) throw createError('Không tìm thấy missing document task.', 404);
  task.assigned_to = payload.assigned_to || payload.assigned_user_id;
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({ actor, action: 'clinical_document_files.missing.assigned', targetType: 'missing_document_task', targetId: task._id, status: 'success', message: 'Assign missing document task thành công.', requestMeta, metadata: { assigned_to: toId(task.assigned_to) } });
  return task.toObject();
}

async function bulkAction(payload = {}, actor = {}, requestMeta = {}) {
  const action = normalizeString(payload.action);
  const ids = Array.isArray(payload.attachment_ids) ? payload.attachment_ids : Array.isArray(payload.ids) ? payload.ids : [];
  if (!action) throw createError('action là bắt buộc.', 400);
  if (!ids.length) throw createError('attachment_ids là bắt buộc.', 400);
  const results = [];
  for (const id of ids) {
    try {
      let data;
      if (action === 'release') data = await releaseFile(id, actor, requestMeta);
      else if (action === 'revoke_release') data = await revokeRelease(id, payload, actor, requestMeta);
      else if (action === 'archive') data = await archiveFile(id, payload, actor, requestMeta);
      else if (action === 'restore') data = await restoreFile(id, actor, requestMeta);
      else if (action === 'delete') data = await deleteFile(id, payload, actor, requestMeta);
      else if (action === 'rescan') data = await rescanFile(id, payload, actor, requestMeta);
      else if (action === 'review') data = await reviewAttachment(id, payload, actor, requestMeta);
      else throw createError('bulk action không hỗ trợ.', 400);
      results.push({ id, ok: true, data });
    } catch (error) {
      results.push({ id, ok: false, message: error.message || 'Không thể xử lý file.' });
    }
  }
  return {
    action,
    total: results.length,
    success: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}

module.exports = {
  listFiles,
  getSummary,
  getDetail,
  getAccessLogs,
  getAudit,
  updateMetadata,
  reviewAttachment,
  releaseFile,
  revokeRelease,
  archiveFile,
  restoreFile,
  deleteFile,
  rescanFile,
  quarantineFile,
  markScanSkipped,
  listMissingDocuments,
  recomputeMissingDocuments,
  waiveMissingTask,
  resolveMissingTask,
  assignMissingTask,
  bulkAction,
};
