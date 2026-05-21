const {
  Attachment,
  AttachmentAccessLog,
  AuditLog,
  DocumentExportRequest,
  MedicalRecord,
  MissingDocumentTask,
} = require('../models');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const MS_PER_HOUR = 3600000;
const FINALIZED_STATUSES = new Set(['finalized', 'sealed']);

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

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  return addDays(date, -((date.getDay() + 6) % 7));
}

function startOfMonth(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

function isoDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(normalizeNumber(value) * factor) / factor;
}

function percentage(part, total) {
  return total > 0 ? round((normalizeNumber(part) / normalizeNumber(total)) * 100, 2) : 0;
}

function average(values = []) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function buildRange(query = {}, fallback = '30d') {
  const now = new Date();
  if (query.date_from || query.from || query.date_to || query.to) {
    return {
      start: startOfDay(query.date_from || query.from || now),
      end: endOfDay(query.date_to || query.to || query.date_from || query.from || now),
    };
  }
  const range = String(query.period || query.range || fallback).toLowerCase();
  if (range === 'today') return { start: startOfDay(now), end: endOfDay(now) };
  if (range === '7d') return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (range === '30d') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (range === 'week') return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
  if (range === 'month') return { start: startOfMonth(now), end: endOfDay(now) };
  return { start: startOfDay(query.date || now), end: endOfDay(query.date || now) };
}

function buildPagination(query = {}, total = 0, defaultLimit = 30) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || defaultLimit), 1), 200);
  return { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) };
}

function paginate(rows = [], query = {}, defaultLimit = 30) {
  const pagination = buildPagination(query, rows.length, defaultLimit);
  const start = (pagination.page - 1) * pagination.limit;
  return { items: rows.slice(start, start + pagination.limit), pagination };
}

function stringifyId(value) {
  return value ? String(value?._id || value) : null;
}

function patientName(value) {
  if (!value) return 'Chưa rõ';
  return value.full_name || value.name || value.patient_name || value.patient_code || 'Chưa rõ';
}

function userName(value) {
  if (!value) return 'Chưa rõ';
  return value.full_name || value.name || value.username || value.email || 'Chưa rõ';
}

function departmentName(value) {
  if (!value) return 'Chưa rõ';
  return value.department_name || value.name || value.department_code || value.code || 'Chưa rõ';
}

function groupCount(rows = [], key, fallback = 'unknown') {
  const map = new Map();
  rows.forEach((row) => {
    const value = row?.[key] ?? fallback;
    map.set(value, (map.get(value) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, [key]: label, count, value: count }));
}

function groupSum(rows = [], key, valueKey, fallback = 'unknown') {
  const map = new Map();
  rows.forEach((row) => {
    const value = row?.[key] ?? fallback;
    map.set(value, (map.get(value) || 0) + normalizeNumber(row?.[valueKey]));
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, [key]: label, value: round(value, 2) }));
}

function dayTrend(rows = [], dateKey = 'created_at') {
  const map = new Map();
  rows.forEach((row) => {
    const date = isoDate(row?.[dateKey]);
    if (!date) return;
    map.set(date, (map.get(date) || 0) + 1);
  });
  return Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, label: date, count, value: count }));
}

function filterSearch(rows = [], query = {}, fields = []) {
  const term = String(query.search || '').trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) => fields.some((field) => String(row?.[field] || '').toLowerCase().includes(term)));
}

function recordsMatch(range, query = {}) {
  const match = {};
  const dateField = query.date_field || 'opened_at';
  match[dateField] = { $gte: range.start, $lte: range.end };
  if (query.patient_id) match.patient_id = query.patient_id;
  if (query.encounter_id) match.encounter_id = query.encounter_id;
  if (query.admission_id) match.admission_id = query.admission_id;
  if (query.department_id || query.custodian_department_id) match.custodian_department_id = query.department_id || query.custodian_department_id;
  if (query.record_type) match.record_type = query.record_type;
  if (query.status) match.status = query.status;
  if (query.released_to_patient !== undefined && query.released_to_patient !== '') match.released_to_patient = query.released_to_patient === true || query.released_to_patient === 'true';
  return match;
}

function attachmentMatch(range, query = {}) {
  const match = { created_at: { $gte: range.start, $lte: range.end } };
  for (const field of ['patient_id', 'encounter_id', 'medical_record_id', 'entity_type', 'entity_id', 'category', 'source', 'review_status', 'scan_status', 'visibility', 'status', 'mime_type']) {
    if (query[field]) match[field] = query[field];
  }
  if (query.released_to_patient !== undefined && query.released_to_patient !== '') match.released_to_patient = query.released_to_patient === true || query.released_to_patient === 'true';
  return match;
}

function recordDto(record, counts = {}) {
  const opened = record.opened_at || record.created_at;
  const finalizedHours = record.finalized_at && opened ? round((new Date(record.finalized_at) - new Date(opened)) / MS_PER_HOUR, 1) : null;
  return {
    id: stringifyId(record._id),
    record_id: stringifyId(record._id),
    record_no: record.record_no,
    title: record.title,
    patient_id: stringifyId(record.patient_id),
    patient_name: patientName(record.patient_id),
    encounter_id: stringifyId(record.encounter_id),
    admission_id: stringifyId(record.admission_id),
    department_id: stringifyId(record.custodian_department_id),
    department_name: departmentName(record.custodian_department_id),
    record_type: record.record_type,
    status: record.status,
    opened_at: opened,
    closed_at: record.closed_at,
    finalized_at: record.finalized_at,
    finalized_by_name: userName(record.finalized_by),
    sealed_at: record.sealed_at,
    archived_at: record.archived_at,
    archive_reason: record.archive_reason,
    voided_at: record.voided_at,
    void_reason: record.void_reason,
    released_to_patient: Boolean(record.released_to_patient),
    released_at: record.released_at,
    released_by_name: userName(record.released_by),
    attachment_count: counts.attachments?.get(stringifyId(record._id)) || 0,
    missing_document_count: counts.missing?.get(stringifyId(record._id)) || 0,
    time_to_finalize_hours: finalizedHours,
    risk_level: record.status === 'voided' || (record.status === 'finalized' && !record.released_to_patient) ? 'warning' : 'good',
  };
}

function attachmentDto(file, accessCounts = new Map()) {
  return {
    id: stringifyId(file._id),
    attachment_id: stringifyId(file._id),
    file_name: file.file_name,
    original_name: file.original_name,
    patient_id: stringifyId(file.patient_id),
    patient_name: patientName(file.patient_id),
    entity_type: file.entity_type,
    entity_id: stringifyId(file.entity_id),
    medical_record_id: stringifyId(file.medical_record_id),
    category: file.category,
    source: file.source,
    review_status: file.review_status,
    scan_status: file.scan_status,
    visibility: file.visibility,
    status: file.status,
    mime_type: file.mime_type,
    file_size: normalizeNumber(file.file_size),
    file_size_mb: round(normalizeNumber(file.file_size) / 1048576, 2),
    released_to_patient: Boolean(file.released_to_patient),
    released_at: file.released_at,
    release_revoked_at: file.release_revoked_at,
    archived_at: file.archived_at,
    archive_reason: file.archive_reason,
    deleted_at: file.deleted_at,
    delete_reason: file.delete_reason,
    download_count: normalizeNumber(file.download_count) + (accessCounts.get(stringifyId(file._id)) || 0),
    last_downloaded_at: file.last_downloaded_at,
    uploaded_by_name: userName(file.uploaded_by),
    created_at: file.created_at,
    risk_level: ['infected', 'failed'].includes(file.scan_status) || file.status === 'quarantined' ? 'danger' : file.review_status === 'pending' || file.scan_status === 'pending' ? 'warning' : 'good',
  };
}

function missingDto(task) {
  const overdue = task.due_at && ['open', 'overdue'].includes(task.status) && new Date(task.due_at) < new Date();
  return {
    id: stringifyId(task._id),
    task_id: stringifyId(task._id),
    module: task.module,
    entity_type: task.entity_type,
    entity_id: stringifyId(task.entity_id),
    entity_code: task.entity_code,
    entity_title: task.entity_title,
    patient_id: stringifyId(task.patient_id),
    patient_name: patientName(task.patient_id),
    required_category: task.required_category,
    expected_file_label: task.expected_file_label,
    severity: task.severity,
    status: overdue ? 'overdue' : task.status,
    responsible_role: task.responsible_role,
    assigned_to_name: userName(task.assigned_to),
    due_at: task.due_at,
    resolved_at: task.resolved_at,
    waived_at: task.waived_at,
    created_at: task.created_at,
    risk_level: overdue || task.severity === 'critical' ? 'danger' : task.severity === 'high' ? 'warning' : 'neutral',
  };
}

async function loadRecordCounts(recordIds = []) {
  if (!recordIds.length) return { attachments: new Map(), missing: new Map() };
  const [attachmentAgg, missingAgg] = await Promise.all([
    Attachment.aggregate([
      { $match: { medical_record_id: { $in: recordIds }, status: { $ne: 'deleted' } } },
      { $group: { _id: '$medical_record_id', count: { $sum: 1 } } },
    ]),
    MissingDocumentTask.aggregate([
      { $match: { entity_type: 'medical_record', entity_id: { $in: recordIds }, status: { $in: ['open', 'overdue'] } } },
      { $group: { _id: '$entity_id', count: { $sum: 1 } } },
    ]),
  ]);
  return {
    attachments: new Map(attachmentAgg.map((item) => [stringifyId(item._id), item.count])),
    missing: new Map(missingAgg.map((item) => [stringifyId(item._id), item.count])),
  };
}

async function loadRecords(query = {}, extraMatch = {}) {
  const range = buildRange(query);
  const match = { ...recordsMatch(range, query), ...extraMatch };
  const docs = await MedicalRecord.find(match)
    .populate('patient_id', 'full_name name patient_code')
    .populate('custodian_department_id', 'department_name department_code name code')
    .populate('finalized_by', 'full_name username email')
    .populate('released_by', 'full_name username email')
    .sort({ opened_at: -1, created_at: -1 })
    .limit(2000)
    .lean();
  const counts = await loadRecordCounts(docs.map((item) => item._id));
  return filterSearch(docs.map((item) => recordDto(item, counts)), query, ['record_no', 'title', 'patient_name', 'department_name', 'record_type', 'status']);
}

function recordSummary(rows = []) {
  return {
    total_records: rows.length,
    draft_count: rows.filter((row) => row.status === 'draft').length,
    active_count: rows.filter((row) => row.status === 'active').length,
    finalized_count: rows.filter((row) => row.status === 'finalized').length,
    sealed_count: rows.filter((row) => row.status === 'sealed').length,
    archived_count: rows.filter((row) => row.status === 'archived').length,
    voided_count: rows.filter((row) => row.status === 'voided').length,
    released_to_patient: rows.filter((row) => row.released_to_patient).length,
    not_released: rows.filter((row) => !row.released_to_patient).length,
    records_with_attachment: rows.filter((row) => row.attachment_count > 0).length,
    missing_document_records: rows.filter((row) => row.missing_document_count > 0).length,
    opened_in_period: rows.length,
  };
}

async function getMedicalRecordsReport(query = {}) {
  const rows = await loadRecords(query);
  const { items, pagination } = paginate(rows, query);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: recordSummary(rows),
    charts: {
      by_status: groupCount(rows, 'status'),
      by_type: groupCount(rows, 'record_type'),
      by_department: groupCount(rows, 'department_name'),
      opened_by_day: dayTrend(rows, 'opened_at'),
      finalized_by_day: dayTrend(rows.filter((row) => row.finalized_at), 'finalized_at'),
      released_by_day: dayTrend(rows.filter((row) => row.released_at), 'released_at'),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/records-documents/medical-records nen tra last_activity_at, attachment_count va missing_count backend-side theo permission scope.'],
  };
}

async function getFinalizedRecordsReport(query = {}) {
  const rows = await loadRecords({ ...query, date_field: 'finalized_at' }, { status: { $in: ['finalized', 'sealed'] } });
  const { items, pagination } = paginate(rows, query);
  const notReleased = rows.filter((row) => !row.released_to_patient);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_finalized_records: rows.length,
      finalized_today: rows.filter((row) => isoDate(row.finalized_at) === isoDate(new Date())).length,
      sealed_records: rows.filter((row) => row.status === 'sealed').length,
      finalized_not_released: notReleased.length,
      finalized_with_missing_attachments: rows.filter((row) => row.missing_document_count > 0).length,
      average_time_to_finalize_hours: round(average(rows.map((row) => row.time_to_finalize_hours)), 1),
      top_department_finalized: groupCount(rows, 'department_name').sort((a, b) => b.count - a.count)[0]?.count || 0,
    },
    charts: {
      finalized_trend: dayTrend(rows, 'finalized_at'),
      by_department: groupCount(rows, 'department_name'),
      by_type: groupCount(rows, 'record_type'),
      finalized_vs_sealed: groupCount(rows, 'status'),
      finalize_time_buckets: groupCount(rows.map((row) => ({ bucket: row.time_to_finalize_hours == null ? 'unknown' : row.time_to_finalize_hours <= 24 ? '<=24h' : row.time_to_finalize_hours <= 72 ? '1-3 ngay' : '>3 ngay' })), 'bucket'),
    },
    insights: [
      notReleased.length ? `${notReleased.length} ho so finalized/sealed chua release.` : 'Tat ca ho so finalized trong ky da duoc release hoac khong co backlog.',
    ],
    items,
    pagination,
    backend_todo: ['GET /api/reports/records-documents/finalized-records nen tra finalized_by_day, finalized_by_user va avg_time_to_finalize chuan.'],
  };
}

async function getReleasedRecordsReport(query = {}) {
  const [recordRows, attachmentRows] = await Promise.all([
    loadRecords({ ...query, date_field: 'released_at', released_to_patient: true }),
    loadAttachments({ ...query, released_to_patient: true }),
  ]);
  const rows = [
    ...recordRows.map((row) => ({ ...row, item_type: 'medical_record', code: row.record_no, name: row.title, visibility: 'patient_visible', download_count: 0 })),
    ...attachmentRows.map((row) => ({ ...row, item_type: 'attachment', code: row.attachment_id, name: row.original_name || row.file_name })),
  ].sort((a, b) => new Date(b.released_at || b.created_at || 0) - new Date(a.released_at || a.created_at || 0));
  const { items, pagination } = paginate(rows, query);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      records_released_to_patient: recordRows.length,
      attachments_released_to_patient: attachmentRows.length,
      released_today: rows.filter((row) => isoDate(row.released_at) === isoDate(new Date())).length,
      release_revoked_attachments: attachmentRows.filter((row) => row.release_revoked_at).length,
      patient_visible_documents: rows.filter((row) => row.visibility === 'patient_visible').length,
      downloads_after_release: attachmentRows.reduce((sum, row) => sum + normalizeNumber(row.download_count), 0),
      not_released_but_finalized: (await MedicalRecord.countDocuments({ status: { $in: ['finalized', 'sealed'] }, released_to_patient: false })).valueOf(),
    },
    charts: {
      released_records_by_day: dayTrend(recordRows, 'released_at'),
      released_attachments_by_day: dayTrend(attachmentRows, 'released_at'),
      released_by_department: groupCount(recordRows, 'department_name'),
      visibility_breakdown: groupCount(rows, 'visibility'),
      download_trend: dayTrend(attachmentRows.filter((row) => row.last_downloaded_at), 'last_downloaded_at'),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/records-documents/released-records nen gom medical records + attachments + access/download logs.'],
  };
}

async function getVoidArchiveReport(query = {}) {
  const [records, attachments, auditLogs] = await Promise.all([
    loadRecords({ ...query, date_field: 'updated_at' }, { status: { $in: ['voided', 'archived'] } }),
    loadAttachments({ ...query, status: query.status || undefined }),
    AuditLog.find({ created_at: { $gte: buildRange(query).start, $lte: buildRange(query).end }, action: { $regex: '(void|archive|restore|delete)', $options: 'i' } }).sort({ created_at: -1 }).limit(600).lean(),
  ]);
  const affectedAttachments = attachments.filter((row) => ['archived', 'deleted', 'quarantined'].includes(row.status) || row.archived_at || row.deleted_at);
  const rows = [
    ...records.map((row) => ({
      ...row,
      item_type: 'medical_record',
      code: row.record_no,
      name: row.title,
      reason: row.void_reason || row.archive_reason,
      event_at: row.voided_at || row.archived_at || row.opened_at,
    })),
    ...affectedAttachments.map((row) => ({
      ...row,
      item_type: 'attachment',
      code: row.attachment_id,
      name: row.original_name || row.file_name,
      reason: row.delete_reason || row.archive_reason,
      event_at: row.deleted_at || row.archived_at || row.created_at,
    })),
  ].sort((a, b) => new Date(b.event_at || 0) - new Date(a.event_at || 0));
  const { items, pagination } = paginate(rows, query);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      voided_records: records.filter((row) => row.status === 'voided').length,
      archived_records: records.filter((row) => row.status === 'archived').length,
      archived_attachments: affectedAttachments.filter((row) => row.status === 'archived').length,
      deleted_attachments: affectedAttachments.filter((row) => row.status === 'deleted').length,
      void_today: records.filter((row) => isoDate(row.voided_at) === isoDate(new Date())).length,
      archive_today: rows.filter((row) => isoDate(row.archived_at) === isoDate(new Date())).length,
      reason_missing: rows.filter((row) => !row.reason).length,
      audit_actions: auditLogs.length,
    },
    charts: {
      by_day: dayTrend(rows, 'event_at'),
      by_type: groupCount(rows, 'item_type'),
      by_status: groupCount(rows, 'status'),
      reason_breakdown: groupCount(rows, 'reason'),
      attachment_entity_type: groupCount(affectedAttachments, 'entity_type'),
    },
    risk_panel: rows.filter((row) => !row.reason || row.status === 'voided').slice(0, 20),
    items,
    pagination,
    backend_todo: ['GET /api/reports/records-documents/void-archive nen tra unified ledger cua record void/archive va attachment archive/delete/restore.'],
  };
}

async function loadAccessCounts(attachmentIds = []) {
  if (!attachmentIds.length) return new Map();
  const rows = await AttachmentAccessLog.aggregate([
    { $match: { attachment_id: { $in: attachmentIds }, action: { $in: ['download', 'signed_download', 'view', 'preview'] } } },
    { $group: { _id: '$attachment_id', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [stringifyId(row._id), row.count]));
}

async function loadAttachments(query = {}) {
  const range = buildRange(query);
  const match = attachmentMatch(range, query);
  const docs = await Attachment.find(match)
    .populate('patient_id', 'full_name name patient_code')
    .populate('uploaded_by', 'full_name username email')
    .sort({ created_at: -1 })
    .limit(2500)
    .lean();
  const accessCounts = await loadAccessCounts(docs.map((item) => item._id));
  return filterSearch(docs.map((item) => attachmentDto(item, accessCounts)), query, ['file_name', 'original_name', 'patient_name', 'entity_type', 'category', 'mime_type', 'source']);
}

async function loadMissingTasks(query = {}) {
  const range = buildRange(query);
  const match = { created_at: { $gte: range.start, $lte: range.end } };
  for (const field of ['module', 'entity_type', 'status', 'severity', 'patient_id', 'assigned_to']) {
    if (query[field]) match[field] = query[field];
  }
  const docs = await MissingDocumentTask.find(match)
    .populate('patient_id', 'full_name name patient_code')
    .populate('assigned_to', 'full_name username email')
    .sort({ created_at: -1 })
    .limit(1200)
    .lean();
  return filterSearch(docs.map(missingDto), query, ['entity_code', 'entity_title', 'patient_name', 'required_category', 'expected_file_label']);
}

async function getAttachmentReport(query = {}) {
  const [rows, missingRows] = await Promise.all([loadAttachments(query), loadMissingTasks(query)]);
  const { items, pagination } = paginate(rows, query);
  const totalSize = rows.reduce((sum, row) => sum + normalizeNumber(row.file_size), 0);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_attachments: rows.length,
      active: rows.filter((row) => row.status === 'active').length,
      archived: rows.filter((row) => row.status === 'archived').length,
      deleted: rows.filter((row) => row.status === 'deleted').length,
      quarantined: rows.filter((row) => row.status === 'quarantined').length,
      review_pending: rows.filter((row) => row.review_status === 'pending').length,
      review_accepted: rows.filter((row) => row.review_status === 'accepted').length,
      review_rejected: rows.filter((row) => row.review_status === 'rejected').length,
      scan_pending: rows.filter((row) => row.scan_status === 'pending').length,
      scan_clean: rows.filter((row) => row.scan_status === 'clean').length,
      scan_infected: rows.filter((row) => row.scan_status === 'infected').length,
      scan_failed: rows.filter((row) => row.scan_status === 'failed').length,
      released_to_patient: rows.filter((row) => row.released_to_patient).length,
      missing_document_tasks: missingRows.length,
      total_storage_size: totalSize,
      total_storage_mb: round(totalSize / 1048576, 2),
    },
    charts: {
      by_status: groupCount(rows, 'status'),
      review_status: groupCount(rows, 'review_status'),
      scan_status: groupCount(rows, 'scan_status'),
      source: groupCount(rows, 'source'),
      entity_type: groupCount(rows, 'entity_type'),
      category: groupCount(rows, 'category'),
      mime_type: groupCount(rows, 'mime_type'),
      size_buckets: groupCount(rows.map((row) => ({ bucket: row.file_size_mb <= 1 ? '<=1MB' : row.file_size_mb <= 10 ? '1-10MB' : row.file_size_mb <= 100 ? '10-100MB' : '>100MB' })), 'bucket'),
      upload_trend: dayTrend(rows),
    },
    missing_documents: missingRows.slice(0, 50),
    items,
    pagination,
    backend_todo: ['GET /api/reports/records-documents/attachments nen tra analytics theo source/entity/category/scan/review/storage/download.'],
  };
}

function exportDto(row, accessDownloads = new Map()) {
  const selectedCount = Array.isArray(row.selected_attachment_ids) ? row.selected_attachment_ids.length : 0;
  return {
    id: stringifyId(row._id),
    export_id: stringifyId(row._id),
    request_code: row.request_code,
    patient_id: stringifyId(row.patient_id),
    patient_name: patientName(row.patient_id),
    requested_by_actor_type: row.requested_by_actor_type,
    requested_by_actor_id: stringifyId(row.requested_by_actor_id),
    export_type: row.export_type,
    selected_attachment_count: selectedCount,
    status: row.status,
    file_url: row.file_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    downloads: accessDownloads.get(stringifyId(row._id)) || 0,
    failure_reason: row.metadata?.failure_reason || row.metadata?.error_message,
    processing_hours: row.status === 'ready' && row.updated_at ? round((new Date(row.updated_at) - new Date(row.created_at)) / MS_PER_HOUR, 2) : null,
    metadata: row.metadata || {},
    risk_level: row.status === 'failed' ? 'danger' : row.status === 'processing' || row.status === 'pending' ? 'warning' : 'good',
  };
}

async function getRecordExportReport(query = {}) {
  const range = buildRange(query);
  const match = { created_at: { $gte: range.start, $lte: range.end } };
  if (query.status) match.status = query.status;
  if (query.patient_id) match.patient_id = query.patient_id;
  if (query.export_type) match.export_type = query.export_type;
  const docs = await DocumentExportRequest.find(match)
    .populate('patient_id', 'full_name name patient_code')
    .sort({ created_at: -1 })
    .limit(1500)
    .lean();
  let rows = docs.map((row) => exportDto(row));
  rows = filterSearch(rows, query, ['request_code', 'patient_name', 'export_type', 'status', 'failure_reason']);
  const { items, pagination } = paginate(rows, query);
  const failed = rows.filter((row) => row.status === 'failed');
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_exports: rows.length,
      pending: rows.filter((row) => row.status === 'pending').length,
      processing: rows.filter((row) => row.status === 'processing').length,
      ready: rows.filter((row) => row.status === 'ready').length,
      failed: failed.length,
      expired: rows.filter((row) => row.status === 'expired').length,
      downloads: rows.reduce((sum, row) => sum + normalizeNumber(row.downloads), 0),
      average_processing_hours: round(average(rows.map((row) => row.processing_hours)), 2),
      exports_today: rows.filter((row) => isoDate(row.created_at) === isoDate(new Date())).length,
      failed_export_rate: percentage(failed.length, rows.length),
    },
    charts: {
      by_status: groupCount(rows, 'status'),
      by_type: groupCount(rows, 'export_type'),
      by_day: dayTrend(rows),
      processing_buckets: groupCount(rows.map((row) => ({ bucket: row.processing_hours == null ? 'unknown' : row.processing_hours <= 1 ? '<=1h' : row.processing_hours <= 24 ? '1-24h' : '>24h' })), 'bucket'),
    },
    command_center: [
      { label: 'Export medical record package', status: 'available' },
      { label: 'Export attachments ZIP', status: 'available' },
      { label: 'Export selected attachments', status: 'backend_todo' },
      { label: 'Export audit trail', status: 'backend_todo' },
    ],
    items,
    pagination,
    backend_todo: ['GET /api/reports/records-documents/exports nen bo sung staff export history, retry/cancel/download endpoints.'],
  };
}

function auditTimelineDto(row) {
  return {
    id: stringifyId(row._id),
    event_id: stringifyId(row._id),
    time: row.created_at || row.occurred_at,
    patient_id: stringifyId(row.patient_id),
    patient_name: patientName(row.patient_id),
    module: row.module_key || row.module || 'records',
    entity_type: row.target_type || row.entity_type || 'attachment',
    entity_id: stringifyId(row.target_id || row.entity_id || row.attachment_id),
    entity_code: row.target_id || row.entity_code || stringifyId(row.attachment_id),
    action: row.action,
    actor_type: row.actor_type,
    actor_id: stringifyId(row.actor_id),
    status: row.status || row.result || 'success',
    message: row.message || row.reason,
    risk_flag: ['failure', 'failed', 'denied'].includes(row.status || row.result) || /(void|delete|archive|download|export)/i.test(row.action || ''),
    before: row.before,
    after: row.after,
    metadata: row.metadata,
  };
}

async function getDocumentTimelineReport(query = {}) {
  const range = buildRange(query);
  const auditMatch = {
    created_at: { $gte: range.start, $lte: range.end },
    $or: [
      { module_key: { $in: ['records', 'documents', 'attachments', 'medical_records'] } },
      { target_type: { $in: ['medical_record', 'attachment', 'document_export_request'] } },
      { action: { $regex: '(medical_records|attachment|document|export|download|release)', $options: 'i' } },
    ],
  };
  if (query.actor_id) auditMatch.actor_id = query.actor_id;
  if (query.entity_type) auditMatch.target_type = query.entity_type;
  const [auditRows, accessRows] = await Promise.all([
    AuditLog.find(auditMatch).sort({ created_at: -1 }).limit(1500).lean(),
    AttachmentAccessLog.find({ occurred_at: { $gte: range.start, $lte: range.end } }).sort({ occurred_at: -1 }).limit(1000).lean(),
  ]);
  let rows = [
    ...auditRows.map(auditTimelineDto),
    ...accessRows.map((row) => auditTimelineDto({ ...row, created_at: row.occurred_at, target_type: 'attachment', target_id: row.attachment_id, status: row.result, module_key: 'attachments' })),
  ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  if (query.patient_id) rows = rows.filter((row) => row.patient_id === query.patient_id);
  if (query.action) rows = rows.filter((row) => String(row.action || '').includes(query.action));
  rows = filterSearch(rows, query, ['module', 'entity_type', 'entity_code', 'action', 'actor_id', 'status', 'message']);
  const { items, pagination } = paginate(rows, query);
  return {
    generated_at: new Date().toISOString(),
    filters: { ...query, timezone: query.timezone || DEFAULT_TIMEZONE },
    summary: {
      total_timeline_events: rows.length,
      medical_record_events: rows.filter((row) => row.entity_type === 'medical_record' || String(row.action || '').includes('medical_records')).length,
      attachment_events: rows.filter((row) => row.entity_type === 'attachment' || String(row.action || '').includes('attachment')).length,
      upload_events: rows.filter((row) => String(row.action || '').includes('upload')).length,
      release_events: rows.filter((row) => String(row.action || '').includes('release')).length,
      download_events: rows.filter((row) => String(row.action || '').includes('download')).length,
      archive_void_events: rows.filter((row) => /(archive|void|delete)/i.test(row.action || '')).length,
      risk_events: rows.filter((row) => row.risk_flag).length,
    },
    charts: {
      by_day: dayTrend(rows, 'time'),
      by_module: groupCount(rows, 'module'),
      by_action: groupCount(rows, 'action'),
      by_actor: groupCount(rows, 'actor_id'),
      by_entity_type: groupCount(rows, 'entity_type'),
      release_download_trend: dayTrend(rows.filter((row) => /(release|download)/i.test(row.action || '')), 'time'),
    },
    items,
    pagination,
    backend_todo: ['GET /api/reports/records-documents/timeline nen ho tro timeline toan he thong co filter patient/department/entity/action/actor.'],
  };
}

module.exports = {
  getMedicalRecordsReport,
  getFinalizedRecordsReport,
  getReleasedRecordsReport,
  getVoidArchiveReport,
  getAttachmentReport,
  getRecordExportReport,
  getDocumentTimelineReport,
};
