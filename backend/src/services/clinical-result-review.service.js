const mongoose = require('mongoose');
const {
  Attachment,
  AuditLog,
  ImagingOrder,
  ImagingReport,
  LabOrder,
  LabResult,
  LabResultItem,
  ProcedureOrder,
  ProcedureResult,
  ResultDelivery,
} = require('../models');
const laboratoryService = require('./laboratory.service');
const imagingService = require('./imaging.service');
const procedureService = require('./procedure.service');
const approvalRequestService = require('./approval-request.service');
const notificationService = require('./notification.service');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const {
  APPROVAL_REQUEST_TYPE,
  ATTACHMENT_STATUS,
  IMAGING_REPORT_STATUS,
  LAB_RESULT_STATUS,
  PROCEDURE_RESULT_STATUS,
  PROCEDURE_STATUS,
} = require('../constants/statuses');
const { PERMISSION } = require('../constants/permissions');

const REVIEW_TYPES = ['lab_result', 'imaging_report', 'procedure_result', 'procedure_order'];
const FINAL_LAB_STATUSES = [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED];
const FINAL_IMAGING_STATUSES = [IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED];
const FINAL_PROCEDURE_STATUSES = [PROCEDURE_RESULT_STATUS.FINAL, PROCEDURE_RESULT_STATUS.AMENDED];
const ACTIVE_ATTACHMENT_FILTER = { status: ATTACHMENT_STATUS.ACTIVE };

const READ_PERMISSIONS = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ,
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
];

function assertReviewRead(actor = {}) {
  permissionService.assertAnyPermission(actor, READ_PERMISSIONS);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.id || actor._id || null;
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
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = value ? new Date(value) : new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function applyDateRange(filter, query = {}, fields = ['reported_at', 'verified_at', 'created_at']) {
  const from = query.date_from || query.from;
  const to = query.date_to || query.to;
  const quickRange = normalizeString(query.range);
  let start = from ? new Date(from) : null;
  let end = to ? new Date(to) : null;

  if (!start && !end && quickRange) {
    const now = new Date();
    if (quickRange === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (quickRange === '24h') {
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      end = now;
    } else if (quickRange === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
    }
  }

  if (!start && !end) return;
  const range = {};
  if (start && !Number.isNaN(start.getTime())) range.$gte = start;
  if (end && !Number.isNaN(end.getTime())) range.$lte = end;
  filter.$or = [
    ...(filter.$or || []),
    ...fields.map((field) => ({ [field]: range })),
  ];
}

function safeRegex(value) {
  const text = normalizeString(value);
  return text ? { $regex: escapeRegex(text), $options: 'i' } : null;
}

function ageFromDob(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
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
    phone: patient.phone,
  };
}

function slimEncounter(encounter) {
  if (!encounter) return null;
  return {
    id: toId(encounter),
    encounter_code: encounter.encounter_code,
    encounter_type: encounter.encounter_type,
    status: encounter.status,
    start_time: encounter.start_time,
  };
}

function groupById(items = [], keyGetter) {
  const map = new Map();
  for (const item of items) {
    const key = String(keyGetter(item) || '');
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function summarizeAttachments(attachments = []) {
  return {
    attachment_count: attachments.length,
    has_attachment: attachments.length > 0,
    pending_scan_count: attachments.filter((item) => item.scan_status === 'pending').length,
    scan_issue_count: attachments.filter((item) => ['infected', 'failed'].includes(item.scan_status)).length,
    pending_review_count: attachments.filter((item) => ['pending', 'submitted'].includes(item.review_status)).length,
    released_to_patient_count: attachments.filter((item) => item.released_to_patient).length,
  };
}

function normalizeDeliveryStatus(result = {}, deliveries = []) {
  const latestDoctorDelivery = deliveries.find((item) => item.recipient_type === 'doctor');
  const latestPatientDelivery = deliveries.find((item) => item.recipient_type === 'patient');
  return {
    latest_doctor_delivery: latestDoctorDelivery || null,
    latest_patient_delivery: latestPatientDelivery || null,
    doctor_delivery_status: latestDoctorDelivery?.delivery_status || (result.released_to_doctor ? 'sent' : 'not_sent'),
    patient_delivery_status: latestPatientDelivery?.delivery_status || (result.released_to_patient ? 'sent' : 'not_sent'),
  };
}

function resultRisk(result = {}, attachmentSummary = {}, extra = {}) {
  return {
    is_critical: Boolean(result.is_critical || result.critical_finding),
    critical_acknowledged_at: result.critical_acknowledged_at || null,
    critical_unacknowledged: Boolean((result.is_critical || result.critical_finding) && !result.critical_acknowledged_at),
    missing_file: Boolean(extra.requires_file && !attachmentSummary.has_attachment),
    file_scan_issue: attachmentSummary.scan_issue_count > 0,
    file_pending_review: attachmentSummary.pending_review_count > 0,
    amend_after_release: Boolean((result.amendment_version > 0 || result.amended_at) && result.released_to_patient),
    overdue_sla: Boolean(extra.overdue_sla),
  };
}

function normalizeLabReviewItem(result, options = {}) {
  const labOrder = result.lab_order_id || {};
  const order = labOrder.order_id || {};
  const attachmentSummary = summarizeAttachments(options.attachments || []);
  const delivery = normalizeDeliveryStatus(result, options.deliveries || []);
  const itemCounts = options.item_counts || {};
  const serviceName = labOrder.test_name || order.service_name || 'Xet nghiem';
  return {
    type: 'lab_result',
    id: toId(result),
    result_no: result.result_no,
    title: serviceName,
    status: result.status,
    priority: labOrder.priority || order.priority || 'routine',
    patient: slimPatient(result.patient_id || labOrder.patient_id || order.patient_id),
    encounter: slimEncounter(labOrder.encounter_id || order.encounter_id),
    order: {
      id: toId(order) || toId(labOrder.order_id),
      child_id: toId(labOrder),
      order_no: order.order_no,
      child_no: labOrder.lab_order_no,
      service_name: serviceName,
      ordered_by: slimUser(labOrder.ordered_by || order.ordered_by),
      ordered_at: labOrder.ordered_at || order.ordered_at,
      clinical_indication: order.clinical_indication || labOrder.clinical_note,
    },
    review: {
      performed_by: slimUser(result.performed_by),
      verified_by: slimUser(result.verified_by),
      verified_at: result.verified_at,
      reported_at: result.reported_at,
      released_to_doctor: Boolean(result.released_to_doctor),
      released_to_doctor_at: result.released_to_doctor_at,
      doctor_read_at: result.doctor_viewed_at,
      doctor_acknowledged_at: result.doctor_acknowledged_at,
      released_to_patient: Boolean(result.released_to_patient),
      released_at: result.released_at,
      patient_viewed_at: result.patient_viewed_at,
      ...delivery,
    },
    risk: resultRisk(result, attachmentSummary, { requires_file: false }),
    counts: {
      abnormal_items: itemCounts.abnormal_items || 0,
      critical_items: itemCounts.critical_items || 0,
      attachments: attachmentSummary.attachment_count,
    },
    attachment_summary: attachmentSummary,
  };
}

function normalizeImagingReviewItem(report, options = {}) {
  const imagingOrder = report.imaging_order_id || {};
  const order = imagingOrder.order_id || {};
  const attachmentSummary = summarizeAttachments(options.attachments || []);
  const delivery = normalizeDeliveryStatus(report, options.deliveries || []);
  const serviceName = [imagingOrder.modality?.toUpperCase(), imagingOrder.body_part].filter(Boolean).join(' ') || 'Chan doan hinh anh';
  return {
    type: 'imaging_report',
    id: toId(report),
    result_no: report.report_no,
    title: serviceName,
    status: report.status,
    priority: imagingOrder.priority || order.priority || 'routine',
    patient: slimPatient(report.patient_id || imagingOrder.patient_id || order.patient_id),
    encounter: slimEncounter(imagingOrder.encounter_id || order.encounter_id),
    order: {
      id: toId(order) || toId(imagingOrder.order_id),
      child_id: toId(imagingOrder),
      order_no: order.order_no,
      child_no: imagingOrder.imaging_order_no,
      service_name: serviceName,
      ordered_by: slimUser(imagingOrder.ordered_by || order.ordered_by),
      ordered_at: imagingOrder.ordered_at || order.ordered_at,
      clinical_indication: imagingOrder.clinical_indication || order.clinical_indication,
      completed_at: imagingOrder.completed_at,
    },
    review: {
      radiologist: slimUser(report.radiologist_id),
      technician: slimUser(report.technician_id),
      verified_by: slimUser(report.verified_by),
      verified_at: report.verified_at,
      reported_at: report.reported_at,
      released_to_doctor: Boolean(report.released_to_doctor),
      released_to_doctor_at: report.released_to_doctor_at,
      doctor_read_at: report.doctor_viewed_at,
      doctor_acknowledged_at: report.doctor_acknowledged_at,
      released_to_patient: Boolean(report.released_to_patient),
      released_at: report.released_at,
      patient_viewed_at: report.patient_viewed_at,
      ...delivery,
    },
    risk: resultRisk(report, attachmentSummary, { requires_file: true }),
    counts: {
      abnormal_items: 0,
      critical_items: report.is_critical ? 1 : 0,
      attachments: attachmentSummary.attachment_count,
    },
    attachment_summary: attachmentSummary,
    report: {
      pacs_url: report.pacs_url,
      findings: report.findings,
      impression: report.impression,
      recommendation: report.recommendation,
      critical_finding: report.critical_finding,
      critical_note: report.critical_note,
    },
  };
}

function normalizeProcedureResultItem(result, options = {}) {
  const procedureOrder = result.procedure_order_id || {};
  const attachmentSummary = summarizeAttachments(options.attachments || []);
  const delivery = normalizeDeliveryStatus(result, options.deliveries || []);
  return {
    type: 'procedure_result',
    id: toId(result),
    result_no: result.result_no,
    title: procedureOrder.procedure_name || 'Thu thuat',
    status: result.status,
    priority: procedureOrder.priority || 'routine',
    patient: slimPatient(result.patient_id || procedureOrder.patient_id),
    encounter: slimEncounter(result.encounter_id || procedureOrder.encounter_id),
    order: {
      id: toId(procedureOrder.order_id),
      child_id: toId(procedureOrder),
      child_no: procedureOrder.procedure_order_no,
      service_name: procedureOrder.procedure_name,
      ordered_by: slimUser(procedureOrder.requested_by),
      ordered_at: procedureOrder.created_at,
      clinical_indication: procedureOrder.clinical_indication,
      completed_at: procedureOrder.completed_at,
    },
    review: {
      performer: slimUser(result.performer_id),
      verified_by: slimUser(result.signed_by),
      verified_at: result.signed_at,
      reported_at: result.reported_at,
      released_to_doctor: Boolean(result.released_to_doctor),
      released_to_doctor_at: result.released_to_doctor_at,
      doctor_read_at: result.doctor_viewed_at,
      doctor_acknowledged_at: result.doctor_acknowledged_at,
      released_to_patient: Boolean(result.released_to_patient),
      released_at: result.released_to_patient_at,
      patient_viewed_at: result.patient_viewed_at,
      ...delivery,
    },
    risk: resultRisk(result, attachmentSummary, { requires_file: true }),
    counts: {
      abnormal_items: 0,
      critical_items: result.is_critical ? 1 : 0,
      attachments: attachmentSummary.attachment_count,
    },
    attachment_summary: attachmentSummary,
    result: {
      conclusion: result.conclusion,
      findings: result.findings,
      technique: result.technique,
      complications: result.complications || [],
      recommendation: result.recommendation,
    },
  };
}

function normalizeProcedureOrderFallback(procedureOrder, options = {}) {
  const attachmentSummary = summarizeAttachments(options.attachments || []);
  return {
    type: 'procedure_order',
    id: toId(procedureOrder),
    result_no: procedureOrder.procedure_order_no,
    title: procedureOrder.procedure_name || 'Thu thuat',
    status: 'pending_confirmation',
    priority: procedureOrder.priority || 'routine',
    patient: slimPatient(procedureOrder.patient_id),
    encounter: slimEncounter(procedureOrder.encounter_id),
    order: {
      id: toId(procedureOrder.order_id),
      child_id: toId(procedureOrder),
      child_no: procedureOrder.procedure_order_no,
      service_name: procedureOrder.procedure_name,
      ordered_by: slimUser(procedureOrder.requested_by),
      ordered_at: procedureOrder.created_at,
      clinical_indication: procedureOrder.clinical_indication,
      completed_at: procedureOrder.completed_at,
    },
    review: {
      performer: slimUser(procedureOrder.performer_id),
      verified_by: slimUser(procedureOrder.completed_by),
      verified_at: procedureOrder.completed_at,
      reported_at: procedureOrder.completed_at,
      released_to_doctor: Boolean(procedureOrder.released_to_doctor),
      released_to_doctor_at: procedureOrder.released_to_doctor_at,
      doctor_read_at: procedureOrder.doctor_viewed_at,
      doctor_acknowledged_at: procedureOrder.doctor_acknowledged_at,
      released_to_patient: false,
    },
    risk: {
      ...resultRisk({}, attachmentSummary, { requires_file: true }),
      missing_result: !procedureOrder.result_note,
      missing_charge: Boolean(options.missing_charge),
    },
    counts: {
      abnormal_items: 0,
      critical_items: 0,
      attachments: attachmentSummary.attachment_count,
    },
    attachment_summary: attachmentSummary,
    result: {
      result_note: procedureOrder.result_note,
      procedure_status: procedureOrder.status,
    },
  };
}

async function loadAttachmentMapForLabResults(resultIds = []) {
  if (!resultIds.length) return new Map();
  const attachments = await Attachment.find({
    ...ACTIVE_ATTACHMENT_FILTER,
    entity_type: 'lab_result',
    entity_id: { $in: resultIds },
  }).sort({ created_at: -1 }).lean();
  return groupById(attachments, (item) => item.entity_id);
}

async function loadAttachmentMapForImaging(reports = []) {
  const reportIds = reports.map((item) => item._id).filter(Boolean);
  const orderIds = reports.map((item) => item.imaging_order_id?._id || item.imaging_order_id).filter(Boolean);
  if (!reportIds.length && !orderIds.length) return new Map();
  const attachments = await Attachment.find({
    ...ACTIVE_ATTACHMENT_FILTER,
    $or: [
      { entity_type: 'imaging_report', entity_id: { $in: reportIds } },
      { entity_type: 'imaging_order', entity_id: { $in: orderIds } },
    ],
  }).sort({ created_at: -1 }).lean();
  const map = new Map();
  for (const report of reports) {
    const reportId = String(report._id);
    const orderId = String(report.imaging_order_id?._id || report.imaging_order_id || '');
    map.set(reportId, attachments.filter((item) => String(item.entity_id) === reportId || String(item.entity_id) === orderId));
  }
  return map;
}

async function loadAttachmentMapForProcedureOrders(orderIds = []) {
  if (!orderIds.length) return new Map();
  const attachments = await Attachment.find({
    ...ACTIVE_ATTACHMENT_FILTER,
    entity_type: 'procedure_order',
    entity_id: { $in: orderIds },
  }).sort({ created_at: -1 }).lean();
  return groupById(attachments, (item) => item.entity_id);
}

async function loadDeliveryMap(resultType, resultIds = []) {
  if (!resultIds.length) return new Map();
  const deliveries = await ResultDelivery.find({
    result_type: resultType,
    result_id: { $in: resultIds },
  }).sort({ sent_at: -1, created_at: -1 }).lean();
  return groupById(deliveries, (item) => item.result_id);
}

async function loadLabItemCounts(resultIds = []) {
  if (!resultIds.length) return new Map();
  const rows = await LabResultItem.aggregate([
    { $match: { lab_result_id: { $in: resultIds } } },
    {
      $group: {
        _id: '$lab_result_id',
        total_items: { $sum: 1 },
        critical_items: { $sum: { $cond: [{ $eq: ['$is_critical', true] }, 1, 0] } },
        abnormal_items: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$abnormal_flag', null] }, { $not: [{ $in: ['$abnormal_flag', ['normal', 'unknown']] }] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

function applyResultFilters(filter, query = {}, numberField) {
  const statuses = normalizeList(query.status || query.result_status);
  if (statuses.length && !statuses.includes('all')) filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  const critical = parseBoolean(query.is_critical || query.critical);
  if (critical !== undefined) filter.is_critical = critical;
  const criticalUnack = parseBoolean(query.critical_unacknowledged);
  if (criticalUnack) {
    filter.is_critical = true;
    filter.critical_acknowledged_at = null;
  }
  const releasedToDoctor = parseBoolean(query.released_to_doctor);
  if (releasedToDoctor !== undefined) filter.released_to_doctor = releasedToDoctor;
  const releasedToPatient = parseBoolean(query.released_to_patient);
  if (releasedToPatient !== undefined) filter.released_to_patient = releasedToPatient;
  const search = safeRegex(query.search || query.keyword);
  if (search && numberField) filter[numberField] = search;
  applyDateRange(filter, query);
}

async function loadLabItems(query = {}, { skip = 0, limit = 30, noPagination = false } = {}) {
  const filter = {};
  const tab = normalizeString(query.tab);
  if (tab === 'lab-pending') filter.status = LAB_RESULT_STATUS.PRELIMINARY;
  if (tab === 'released-to-doctor') filter.released_to_doctor = true;
  if (tab === 'released-to-patient') filter.released_to_patient = true;
  if (tab === 'amend-needed') filter.status = { $in: [LAB_RESULT_STATUS.AMENDED, LAB_RESULT_STATUS.ENTERED_IN_ERROR] };
  applyResultFilters(filter, query, 'result_no');

  const baseQuery = LabResult.find(filter)
    .sort({ verified_at: -1, reported_at: -1, created_at: -1 })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('performed_by', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .populate({
      path: 'lab_order_id',
      select: 'order_id lab_order_no test_name test_code priority ordered_at clinical_note status encounter_id ordered_by patient_id',
      populate: [
        { path: 'ordered_by', select: 'full_name username employee_code' },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time' },
        { path: 'order_id', select: 'order_no order_type priority status clinical_indication ordered_at ordered_by', populate: { path: 'ordered_by', select: 'full_name username employee_code' } },
      ],
    });
  if (!noPagination) baseQuery.skip(skip).limit(limit);
  const [rows, total] = await Promise.all([
    baseQuery.lean(),
    LabResult.countDocuments(filter),
  ]);
  const ids = rows.map((item) => item._id);
  const [attachmentMap, deliveryMap, itemCounts] = await Promise.all([
    loadAttachmentMapForLabResults(ids),
    loadDeliveryMap('lab_result', ids),
    loadLabItemCounts(ids),
  ]);
  return {
    items: rows.map((result) => normalizeLabReviewItem(result, {
      attachments: attachmentMap.get(String(result._id)) || [],
      deliveries: deliveryMap.get(String(result._id)) || [],
      item_counts: itemCounts.get(String(result._id)) || {},
    })),
    total,
  };
}

async function loadImagingItems(query = {}, { skip = 0, limit = 30, noPagination = false } = {}) {
  const filter = {};
  const tab = normalizeString(query.tab);
  if (tab === 'imaging-signing') filter.status = { $in: [IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY] };
  if (tab === 'released-to-doctor') filter.released_to_doctor = true;
  if (tab === 'released-to-patient') filter.released_to_patient = true;
  if (tab === 'amend-needed') filter.status = IMAGING_REPORT_STATUS.AMENDED;
  applyResultFilters(filter, query, 'report_no');

  const baseQuery = ImagingReport.find(filter)
    .sort({ verified_at: -1, reported_at: -1, created_at: -1 })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('radiologist_id', 'full_name username employee_code')
    .populate('technician_id', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .populate({
      path: 'imaging_order_id',
      select: 'order_id imaging_order_no modality body_part contrast_required priority ordered_at clinical_indication status completed_at encounter_id ordered_by patient_id',
      populate: [
        { path: 'ordered_by', select: 'full_name username employee_code' },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time' },
        { path: 'order_id', select: 'order_no order_type priority status clinical_indication ordered_at ordered_by', populate: { path: 'ordered_by', select: 'full_name username employee_code' } },
      ],
    });
  if (!noPagination) baseQuery.skip(skip).limit(limit);
  const [rows, total] = await Promise.all([
    baseQuery.lean(),
    ImagingReport.countDocuments(filter),
  ]);
  const ids = rows.map((item) => item._id);
  const [attachmentMap, deliveryMap] = await Promise.all([
    loadAttachmentMapForImaging(rows),
    loadDeliveryMap('imaging_report', ids),
  ]);
  return {
    items: rows.map((report) => normalizeImagingReviewItem(report, {
      attachments: attachmentMap.get(String(report._id)) || [],
      deliveries: deliveryMap.get(String(report._id)) || [],
    })),
    total,
  };
}

async function loadProcedureResultItems(query = {}, { skip = 0, limit = 30, noPagination = false } = {}) {
  const filter = {};
  const tab = normalizeString(query.tab);
  if (tab === 'procedure-confirmation') filter.status = { $in: [PROCEDURE_RESULT_STATUS.DRAFT, PROCEDURE_RESULT_STATUS.PRELIMINARY] };
  if (tab === 'released-to-doctor') filter.released_to_doctor = true;
  if (tab === 'released-to-patient') filter.released_to_patient = true;
  if (tab === 'amend-needed') filter.status = PROCEDURE_RESULT_STATUS.AMENDED;
  applyResultFilters(filter, query, 'result_no');

  const baseQuery = ProcedureResult.find(filter)
    .sort({ signed_at: -1, reported_at: -1, created_at: -1 })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('performer_id', 'full_name username employee_code')
    .populate('signed_by', 'full_name username employee_code')
    .populate({
      path: 'procedure_order_id',
      select: 'order_id procedure_order_no procedure_name procedure_code priority clinical_indication status completed_at performed_start performed_end requested_by performer_id patient_id encounter_id released_to_doctor released_to_doctor_at',
      populate: [
        { path: 'requested_by', select: 'full_name username employee_code' },
        { path: 'patient_id', select: 'patient_code full_name date_of_birth gender phone' },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time' },
      ],
    });
  if (!noPagination) baseQuery.skip(skip).limit(limit);
  const [rows, total] = await Promise.all([
    baseQuery.lean(),
    ProcedureResult.countDocuments(filter),
  ]);
  const ids = rows.map((item) => item._id);
  const procedureOrderIds = rows.map((item) => item.procedure_order_id?._id || item.procedure_order_id).filter(Boolean);
  const [attachmentMap, deliveryMap] = await Promise.all([
    loadAttachmentMapForProcedureOrders(procedureOrderIds),
    loadDeliveryMap('procedure_result', ids),
  ]);
  return {
    items: rows.map((result) => normalizeProcedureResultItem(result, {
      attachments: attachmentMap.get(String(result.procedure_order_id?._id || result.procedure_order_id)) || [],
      deliveries: deliveryMap.get(String(result._id)) || [],
    })),
    total,
  };
}

async function loadProcedureFallbackItems(query = {}, { noPagination = false, skip = 0, limit = 30 } = {}) {
  const tab = normalizeString(query.tab);
  if (!['procedure-confirmation', 'all', ''].includes(tab)) return { items: [], total: 0 };
  const resultOrderIds = await ProcedureResult.distinct('procedure_order_id');
  const filter = {
    status: PROCEDURE_STATUS.COMPLETED,
    _id: { $nin: resultOrderIds },
  };
  const search = safeRegex(query.search || query.keyword);
  if (search) filter.$or = [{ procedure_order_no: search }, { procedure_name: search }, { procedure_code: search }];
  const baseQuery = ProcedureOrder.find(filter)
    .sort({ completed_at: -1, updated_at: -1 })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('requested_by', 'full_name username employee_code')
    .populate('performer_id', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code');
  if (!noPagination) baseQuery.skip(skip).limit(limit);
  const [rows, total] = await Promise.all([
    baseQuery.lean(),
    ProcedureOrder.countDocuments(filter),
  ]);
  const ids = rows.map((item) => item._id);
  const attachmentMap = await loadAttachmentMapForProcedureOrders(ids);
  return {
    items: rows.map((procedureOrder) => normalizeProcedureOrderFallback(procedureOrder, {
      attachments: attachmentMap.get(String(procedureOrder._id)) || [],
    })),
    total,
  };
}

function typeFilterForQuery(query = {}) {
  const raw = normalizeList(query.type || query.result_type || query.module).filter((item) => item !== 'all');
  if (!raw.length) return ['lab_result', 'imaging_report', 'procedure_result'];
  return raw.flatMap((type) => {
    if (type === 'lab') return ['lab_result'];
    if (type === 'imaging') return ['imaging_report'];
    if (type === 'procedure') return ['procedure_result'];
    return type;
  }).filter((type) => REVIEW_TYPES.includes(type));
}

async function getReviewSummary(query = {}, actor = {}) {
  assertReviewRead(actor);
  const today = new Date();
  const todayFilter = { $gte: startOfDay(today), $lte: endOfDay(today) };
  const [procedureResultOrderIds, counts] = await Promise.all([
    ProcedureResult.distinct('procedure_order_id'),
    Promise.all([
      LabResult.countDocuments({ status: LAB_RESULT_STATUS.PRELIMINARY }),
      ImagingReport.countDocuments({ status: { $in: [IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY] } }),
      ProcedureResult.countDocuments({ status: { $in: [PROCEDURE_RESULT_STATUS.DRAFT, PROCEDURE_RESULT_STATUS.PRELIMINARY] } }),
      LabResult.countDocuments({ is_critical: true, critical_acknowledged_at: null }),
      ImagingReport.countDocuments({ is_critical: true, critical_acknowledged_at: null }),
      ProcedureResult.countDocuments({ is_critical: true, critical_acknowledged_at: null }),
      LabResult.countDocuments({ released_to_doctor: true, released_to_doctor_at: todayFilter }),
      ImagingReport.countDocuments({ released_to_doctor: true, released_to_doctor_at: todayFilter }),
      ProcedureResult.countDocuments({ released_to_doctor: true, released_to_doctor_at: todayFilter }),
      LabResult.countDocuments({ released_to_patient: true, released_at: todayFilter }),
      ImagingReport.countDocuments({ released_to_patient: true, released_at: todayFilter }),
      ProcedureResult.countDocuments({ released_to_patient: true, released_to_patient_at: todayFilter }),
      LabResult.countDocuments({ status: LAB_RESULT_STATUS.AMENDED }),
      ImagingReport.countDocuments({ status: IMAGING_REPORT_STATUS.AMENDED }),
      ProcedureResult.countDocuments({ status: PROCEDURE_RESULT_STATUS.AMENDED }),
    ]),
  ]);
  const procedureFallbackCount = await ProcedureOrder.countDocuments({
    status: PROCEDURE_STATUS.COMPLETED,
    _id: { $nin: procedureResultOrderIds },
  });
  const [
    labPending,
    imagingPending,
    procedurePending,
    labCritical,
    imagingCritical,
    procedureCritical,
    labReleasedDoctor,
    imagingReleasedDoctor,
    procedureReleasedDoctor,
    labReleasedPatient,
    imagingReleasedPatient,
    procedureReleasedPatient,
    labAmended,
    imagingAmended,
    procedureAmended,
  ] = counts;

  return {
    lab_pending: labPending,
    imaging_signing: imagingPending,
    procedure_confirmation: procedurePending + procedureFallbackCount,
    critical_unacknowledged: labCritical + imagingCritical + procedureCritical,
    released_to_doctor_today: labReleasedDoctor + imagingReleasedDoctor + procedureReleasedDoctor,
    released_to_patient_today: labReleasedPatient + imagingReleasedPatient + procedureReleasedPatient,
    amend_needed: labAmended + imagingAmended + procedureAmended,
    by_type: {
      lab_result: { pending: labPending, critical_unacknowledged: labCritical, amended: labAmended },
      imaging_report: { pending: imagingPending, critical_unacknowledged: imagingCritical, amended: imagingAmended },
      procedure_result: { pending: procedurePending + procedureFallbackCount, critical_unacknowledged: procedureCritical, amended: procedureAmended },
    },
  };
}

async function getReviewWorklist(query = {}, actor = {}) {
  assertReviewRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const requestedTypes = typeFilterForQuery(query);
  const tab = normalizeString(query.tab || 'all');
  const typeSpecific = requestedTypes.length === 1 && ['lab-pending', 'imaging-signing', 'procedure-confirmation'].includes(tab);

  if (typeSpecific && requestedTypes[0] === 'lab_result') {
    const result = await loadLabItems({ ...query, tab: 'lab-pending' }, { skip, limit });
    return { items: result.items, pagination: buildPagination(page, limit, result.total) };
  }
  if (typeSpecific && requestedTypes[0] === 'imaging_report') {
    const result = await loadImagingItems({ ...query, tab: 'imaging-signing' }, { skip, limit });
    return { items: result.items, pagination: buildPagination(page, limit, result.total) };
  }
  if (typeSpecific && requestedTypes[0] === 'procedure_result') {
    const [resultItems, fallbackItems] = await Promise.all([
      loadProcedureResultItems({ ...query, tab: 'procedure-confirmation' }, { noPagination: true }),
      loadProcedureFallbackItems({ ...query, tab: 'procedure-confirmation' }, { noPagination: true }),
    ]);
    const all = [...resultItems.items, ...fallbackItems.items].sort((a, b) => new Date(b.review.reported_at || 0) - new Date(a.review.reported_at || 0));
    return { items: all.slice(skip, skip + limit), pagination: buildPagination(page, limit, all.length) };
  }

  const jobs = [];
  if (requestedTypes.includes('lab_result')) jobs.push(loadLabItems(query, { noPagination: true }));
  if (requestedTypes.includes('imaging_report')) jobs.push(loadImagingItems(query, { noPagination: true }));
  if (requestedTypes.includes('procedure_result')) {
    jobs.push(loadProcedureResultItems(query, { noPagination: true }));
    if (tab === 'procedure-confirmation' || tab === 'all' || tab === '') jobs.push(loadProcedureFallbackItems(query, { noPagination: true }));
  }
  const results = await Promise.all(jobs);
  let items = results.flatMap((result) => result.items);

  if (tab === 'lab-pending') items = items.filter((item) => item.type === 'lab_result' && item.status === LAB_RESULT_STATUS.PRELIMINARY);
  if (tab === 'imaging-signing') items = items.filter((item) => item.type === 'imaging_report' && [IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY].includes(item.status));
  if (tab === 'procedure-confirmation') items = items.filter((item) => ['procedure_result', 'procedure_order'].includes(item.type));
  if (tab === 'released-to-doctor') items = items.filter((item) => item.review.released_to_doctor);
  if (tab === 'released-to-patient') items = items.filter((item) => item.review.released_to_patient);
  if (tab === 'amend-needed') items = items.filter((item) => item.status === 'amended' || item.risk.amend_after_release);

  items.sort((a, b) => {
    const priorityRank = { stat: 3, urgent: 2, routine: 1 };
    const criticalDiff = Number(Boolean(b.risk.critical_unacknowledged)) - Number(Boolean(a.risk.critical_unacknowledged));
    if (criticalDiff) return criticalDiff;
    const priorityDiff = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
    if (priorityDiff) return priorityDiff;
    return new Date(b.review.reported_at || b.order.completed_at || b.order.ordered_at || 0) - new Date(a.review.reported_at || a.order.completed_at || a.order.ordered_at || 0);
  });

  return { items: items.slice(skip, skip + limit), pagination: buildPagination(page, limit, items.length) };
}

function ensureReviewType(type) {
  if (!REVIEW_TYPES.includes(type)) throw createError('Loại kết quả không hợp lệ.', 400);
}

async function getReviewDetail(type, id, actor = {}) {
  assertReviewRead(actor);
  ensureReviewType(type);
  if (type === 'lab_result') {
    const detail = await laboratoryService.getLabResultDetail(id, actor);
    const [attachments, deliveries, audit] = await Promise.all([
      Attachment.find({ ...ACTIVE_ATTACHMENT_FILTER, entity_type: 'lab_result', entity_id: id }).sort({ created_at: -1 }).lean(),
      ResultDelivery.find({ result_type: 'lab_result', result_id: id }).sort({ created_at: -1 }).lean(),
      AuditLog.find({ target_type: 'lab_result', target_id: id }).sort({ created_at: -1 }).limit(30).lean(),
    ]);
    return { type, detail, attachments, deliveries, audit };
  }
  if (type === 'imaging_report') {
    const detail = await imagingService.getImagingReportDetail(id, actor);
    const report = detail.report || {};
    const imagingOrderId = report.imaging_order_id?._id || report.imaging_order_id;
    const [attachments, deliveries, audit] = await Promise.all([
      Attachment.find({
        ...ACTIVE_ATTACHMENT_FILTER,
        $or: [
          { entity_type: 'imaging_report', entity_id: id },
          ...(imagingOrderId ? [{ entity_type: 'imaging_order', entity_id: imagingOrderId }] : []),
        ],
      }).sort({ created_at: -1 }).lean(),
      ResultDelivery.find({ result_type: 'imaging_report', result_id: id }).sort({ created_at: -1 }).lean(),
      AuditLog.find({ target_type: 'imaging_report', target_id: id }).sort({ created_at: -1 }).limit(30).lean(),
    ]);
    return { type, detail, attachments, deliveries, audit };
  }
  if (type === 'procedure_result') {
    const detail = await procedureService.getProcedureResultDetail(id, actor);
    const result = detail.result || {};
    const procedureOrderId = result.procedure_order_id?._id || result.procedure_order_id;
    const [attachments, deliveries, audit] = await Promise.all([
      Attachment.find({ ...ACTIVE_ATTACHMENT_FILTER, entity_type: 'procedure_order', entity_id: procedureOrderId }).sort({ created_at: -1 }).lean(),
      ResultDelivery.find({ result_type: 'procedure_result', result_id: id }).sort({ created_at: -1 }).lean(),
      AuditLog.find({ target_type: 'procedure_result', target_id: id }).sort({ created_at: -1 }).limit(30).lean(),
    ]);
    return { type, detail, attachments, deliveries, audit };
  }
  const detail = await procedureService.getProcedureOrderDetail(id, actor);
  const [deliveries, audit] = await Promise.all([
      ResultDelivery.find({
        $or: [
          { result_type: 'procedure_order', result_id: id },
          { result_type: 'procedure_result', 'metadata.procedure_order_id': id },
        ],
      }).sort({ created_at: -1 }).lean(),
    AuditLog.find({ target_type: 'procedure_order', target_id: id }).sort({ created_at: -1 }).limit(30).lean(),
  ]);
  return { type, detail, deliveries, audit };
}

function publicValidationPayload(validation, type) {
  if (type === 'lab_result') {
    return {
      can_finalize: true,
      blocking_errors: [],
      warnings: validation.warnings || [],
      checklist: {
        specimen_valid: true,
        has_items: validation.items?.length > 0,
        numeric_unit_valid: true,
        reference_range_valid: true,
        no_existing_final_result: true,
        critical_flagged: Boolean(validation.hasCritical),
      },
    };
  }
  if (type === 'imaging_report') {
    return {
      can_finalize: true,
      blocking_errors: [],
      warnings: validation.warnings || [],
      checklist: {
        imaging_order_completed: true,
        impression_present: true,
        critical_note_present: !validation.report?.is_critical || Boolean(validation.report?.critical_note),
      },
    };
  }
  return {
    can_finalize: true,
    blocking_errors: [],
    warnings: [],
    checklist: {
      procedure_completed: true,
      conclusion_present: true,
      performer_present: true,
    },
  };
}

async function validateFinalize(type, id, actor = {}) {
  ensureReviewType(type);
  try {
    if (type === 'lab_result') {
      return publicValidationPayload(await laboratoryService.validateLabResultBeforeFinalize(id, actor), type);
    }
    if (type === 'imaging_report') {
      return publicValidationPayload(await imagingService.validateImagingReportBeforeFinalize(id, actor), type);
    }
    if (type === 'procedure_result') {
      const detail = await procedureService.getProcedureResultDetail(id, actor);
      const result = detail.result || {};
      const errors = [];
      if (!FINAL_PROCEDURE_STATUSES.includes(result.status) && !['draft', 'preliminary', 'amended'].includes(result.status)) errors.push({ code: 'invalid_status', message: 'Procedure result không ở trạng thái có thể finalize.' });
      if (!normalizeString(result.conclusion)) errors.push({ code: 'missing_conclusion', message: 'conclusion là bắt buộc khi finalize procedure result.' });
      return errors.length
        ? { can_finalize: false, blocking_errors: errors, warnings: [], checklist: { conclusion_present: false } }
        : publicValidationPayload(null, type);
    }
    const detail = await procedureService.getProcedureOrderDetail(id, actor);
    const order = detail.procedure_order || detail;
    const errors = [];
    if (order.status !== PROCEDURE_STATUS.COMPLETED) errors.push({ code: 'procedure_not_completed', message: 'Procedure order phải completed trước khi xác nhận kết quả.' });
    if (!normalizeString(order.result_note)) errors.push({ code: 'missing_result_note', message: 'Procedure order chưa có result_note.' });
    return {
      can_finalize: errors.length === 0,
      blocking_errors: errors,
      warnings: [],
      checklist: {
        procedure_completed: order.status === PROCEDURE_STATUS.COMPLETED,
        result_note_present: Boolean(normalizeString(order.result_note)),
      },
    };
  } catch (error) {
    return {
      can_finalize: false,
      blocking_errors: [{ code: error.code || 'validation_failed', message: error.message || 'Không thể validate kết quả.' }],
      warnings: [],
      checklist: {},
    };
  }
}

async function createDeliveryRecord({
  type,
  id,
  patientId,
  encounterId,
  recipientType,
  recipientUserId,
  recipientPatientId,
  status = 'sent',
  criticalAckRequired = false,
  actor = {},
  metadata = {},
}) {
  const now = new Date();
  return ResultDelivery.create({
    result_type: type,
    result_id: id,
    patient_id: patientId,
    encounter_id: encounterId,
    recipient_type: recipientType,
    recipient_user_id: recipientUserId,
    recipient_patient_id: recipientPatientId,
    channel: metadata.channel || 'in_app',
    delivery_status: status,
    queued_at: now,
    sent_at: status !== 'queued' ? now : undefined,
    delivered_at: ['delivered', 'read', 'acknowledged'].includes(status) ? now : undefined,
    read_at: ['read', 'acknowledged'].includes(status) ? now : undefined,
    acknowledged_at: status === 'acknowledged' ? now : undefined,
    critical_ack_required: criticalAckRequired,
    metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
}

async function getResultDocument(type, id) {
  ensureReviewType(type);
  if (type === 'lab_result') {
    const result = await LabResult.findById(id);
    if (!result) throw createError('Không tìm thấy lab result.', 404);
    const labOrder = await LabOrder.findById(result.lab_order_id).lean();
    return { result, order: labOrder, patientId: result.patient_id, encounterId: labOrder?.encounter_id, doctorId: labOrder?.ordered_by, finalStatuses: FINAL_LAB_STATUSES };
  }
  if (type === 'imaging_report') {
    const result = await ImagingReport.findById(id);
    if (!result) throw createError('Không tìm thấy imaging report.', 404);
    const imagingOrder = await ImagingOrder.findById(result.imaging_order_id).lean();
    return { result, order: imagingOrder, patientId: result.patient_id, encounterId: imagingOrder?.encounter_id, doctorId: imagingOrder?.ordered_by, finalStatuses: FINAL_IMAGING_STATUSES };
  }
  if (type === 'procedure_result') {
    const result = await ProcedureResult.findById(id);
    if (!result) throw createError('Không tìm thấy procedure result.', 404);
    const procedureOrder = await ProcedureOrder.findById(result.procedure_order_id).lean();
    return { result, order: procedureOrder, patientId: result.patient_id, encounterId: result.encounter_id, doctorId: procedureOrder?.requested_by, finalStatuses: FINAL_PROCEDURE_STATUSES };
  }
  const procedureOrder = await ProcedureOrder.findById(id);
  if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);
  return { result: procedureOrder, order: procedureOrder, patientId: procedureOrder.patient_id, encounterId: procedureOrder.encounter_id, doctorId: procedureOrder.requested_by, finalStatuses: [PROCEDURE_STATUS.COMPLETED] };
}

async function finalizeResult(type, id, actor = {}, requestMeta = {}) {
  ensureReviewType(type);
  if (type === 'lab_result') return laboratoryService.finalizeLabResult(id, actor, requestMeta);
  if (type === 'imaging_report') return imagingService.finalizeImagingReport(id, actor, requestMeta);
  if (type === 'procedure_result') return procedureService.finalizeProcedureResult(id, actor, requestMeta);
  const detail = await procedureService.getProcedureOrderDetail(id, actor);
  const procedureOrder = detail.procedure_order || detail;
  if (procedureOrder?.result?.id || procedureOrder?.result?._id) return procedureService.finalizeProcedureResult(procedureOrder.result.id || procedureOrder.result._id, actor, requestMeta);
  return procedureService.createProcedureResult(id, {
    conclusion: procedureOrder.result_note || 'Thủ thuật đã hoàn tất.',
    findings: procedureOrder.result_note,
    status: PROCEDURE_RESULT_STATUS.PRELIMINARY,
  }, actor, requestMeta);
}

async function releaseToDoctor(type, id, actor = {}, requestMeta = {}) {
  ensureReviewType(type);
  if (type === 'procedure_result') await procedureService.releaseProcedureResult(id, { target: 'doctor' }, actor, requestMeta);
  const { result, order, patientId, encounterId, doctorId, finalStatuses } = await getResultDocument(type, id);
  if (!finalStatuses.includes(result.status)) throw createError('Chỉ final/amended/completed result mới được trả bác sĩ.', 409);
  const before = result.toObject ? result.toObject() : { ...result };
  const now = new Date();
  result.released_to_doctor = true;
  result.released_to_doctor_at = result.released_to_doctor_at || now;
  result.released_to_doctor_by = actorUserId(actor);
  result.updated_by = actorUserId(actor);
  await result.save();

  await createDeliveryRecord({
    type,
    id: result._id,
    patientId,
    encounterId,
    recipientType: 'doctor',
    recipientUserId: doctorId,
    status: 'sent',
    criticalAckRequired: Boolean(result.is_critical),
    actor,
    metadata: {
      result_type: type,
      procedure_order_id: type === 'procedure_order' ? String(result._id) : undefined,
      order_id: toId(order?.order_id),
    },
  });

  if (type === 'lab_result') await notificationService.notifyLabResultFinal(result._id, actor, { critical: Boolean(result.is_critical) });
  if (type === 'imaging_report') await notificationService.notifyImagingReportFinal(result._id, actor, { critical: Boolean(result.is_critical) });
  if (type === 'procedure_order') await procedureService.notifyDoctorProcedureLifecycle(result, actor, { event: 'completed' });

  await recordAuditLog({
    actor,
    action: `${type}.released_to_doctor`,
    targetType: type,
    targetId: result._id,
    status: 'success',
    message: 'Release result cho bác sĩ thành công.',
    requestMeta,
    before,
    after: result.toObject ? result.toObject() : result,
  });
  return getReviewDetail(type, id, actor);
}

async function releaseToPatient(type, id, actor = {}, requestMeta = {}) {
  ensureReviewType(type);
  let result;
  if (type === 'lab_result') result = await laboratoryService.releaseLabResultToPatient(id, actor, requestMeta);
  else if (type === 'imaging_report') result = await imagingService.releaseImagingReportToPatient(id, actor, requestMeta);
  else if (type === 'procedure_result') result = await procedureService.releaseProcedureResult(id, { target: 'patient' }, actor, requestMeta);
  else throw createError('Procedure order cần tạo ProcedureResult trước khi trả bệnh nhân.', 409);

  const context = await getResultDocument(type, id);
  await createDeliveryRecord({
    type,
    id: context.result._id,
    patientId: context.patientId,
    encounterId: context.encounterId,
    recipientType: 'patient',
    recipientPatientId: context.patientId,
    status: 'sent',
    actor,
    metadata: { result_type: type },
  });
  return result;
}

async function revokePatientRelease(type, id, payload = {}, actor = {}, requestMeta = {}) {
  ensureReviewType(type);
  if (type === 'procedure_order') throw createError('Procedure order không có patient release trực tiếp.', 409);
  const { result } = await getResultDocument(type, id);
  if (!result.released_to_patient) throw createError('Result chưa được release cho patient.', 409);
  const reason = normalizeString(payload.reason || payload.release_revoke_reason);
  if (!reason) throw createError('reason là bắt buộc khi thu hồi release patient.');
  const before = result.toObject();
  if (type === 'procedure_result') {
    result.released_to_patient = false;
    result.released_to_patient_at = null;
    result.released_to_patient_by = null;
  } else {
    result.released_to_patient = false;
    result.released_at = null;
    result.released_by = null;
  }
  result.release_revoked_at = new Date();
  result.release_revoked_by = actorUserId(actor);
  result.release_revoke_reason = reason;
  result.updated_by = actorUserId(actor);
  await result.save();
  await ResultDelivery.updateMany(
    { result_type: type, result_id: result._id, recipient_type: 'patient', delivery_status: { $ne: 'revoked' } },
    { $set: { delivery_status: 'revoked', revoked_at: new Date(), updated_by: actorUserId(actor) } },
  );
  await recordAuditLog({
    actor,
    action: `${type}.patient_release_revoked`,
    targetType: type,
    targetId: result._id,
    status: 'success',
    message: 'Thu hồi release patient thành công.',
    requestMeta,
    before,
    after: result.toObject(),
    metadata: { reason },
  });
  return getReviewDetail(type, id, actor);
}

async function markDoctorRead(type, id, actor = {}, requestMeta = {}) {
  const { result } = await getResultDocument(type, id);
  const before = result.toObject();
  result.doctor_viewed_at = result.doctor_viewed_at || new Date();
  result.updated_by = actorUserId(actor);
  await result.save();
  await ResultDelivery.updateMany(
    { result_type: type, result_id: result._id, recipient_type: 'doctor' },
    { $set: { delivery_status: 'read', read_at: result.doctor_viewed_at, updated_by: actorUserId(actor) } },
  );
  await recordAuditLog({ actor, action: `${type}.doctor_read`, targetType: type, targetId: result._id, status: 'success', message: 'Ghi nhận bác sĩ đã xem result.', requestMeta, before, after: result.toObject() });
  return getReviewDetail(type, id, actor);
}

async function doctorAcknowledge(type, id, actor = {}, requestMeta = {}) {
  const { result } = await getResultDocument(type, id);
  const before = result.toObject();
  result.doctor_acknowledged_by = actorUserId(actor);
  result.doctor_acknowledged_at = new Date();
  if (!result.doctor_viewed_at) result.doctor_viewed_at = result.doctor_acknowledged_at;
  result.updated_by = actorUserId(actor);
  await result.save();
  await ResultDelivery.updateMany(
    { result_type: type, result_id: result._id, recipient_type: 'doctor' },
    { $set: { delivery_status: 'acknowledged', read_at: result.doctor_viewed_at, acknowledged_at: result.doctor_acknowledged_at, updated_by: actorUserId(actor) } },
  );
  await recordAuditLog({ actor, action: `${type}.doctor_acknowledged`, targetType: type, targetId: result._id, status: 'success', message: 'Ghi nhận bác sĩ acknowledged result.', requestMeta, before, after: result.toObject() });
  return getReviewDetail(type, id, actor);
}

async function acknowledgeCritical(type, id, actor = {}, requestMeta = {}) {
  ensureReviewType(type);
  if (type === 'lab_result') return laboratoryService.acknowledgeCriticalLabResult(id, actor, requestMeta);
  if (type === 'imaging_report') return imagingService.acknowledgeCriticalImagingReport(id, actor, requestMeta);
  const { result } = await getResultDocument(type, id);
  if (!result.is_critical) throw createError('Result không phải critical.', 409);
  const before = result.toObject();
  result.critical_acknowledged_by = actorUserId(actor);
  result.critical_acknowledged_at = new Date();
  result.updated_by = actorUserId(actor);
  await result.save();
  await recordAuditLog({ actor, action: `${type}.critical_acknowledged`, targetType: type, targetId: result._id, status: 'success', message: 'Acknowledge critical result thành công.', requestMeta, before, after: result.toObject() });
  return getReviewDetail(type, id, actor);
}

async function requestAmend(type, id, payload = {}, actor = {}, requestMeta = {}) {
  ensureReviewType(type);
  if (type === 'procedure_order') throw createError('Procedure order cần tạo ProcedureResult trước khi request amend.', 409);
  const reason = normalizeString(payload.reason || payload.amend_reason);
  if (!reason) throw createError('reason là bắt buộc khi request amend.');
  const requestTypeByResult = {
    lab_result: APPROVAL_REQUEST_TYPE.LAB_RESULT_AMEND,
    imaging_report: APPROVAL_REQUEST_TYPE.IMAGING_REPORT_AMEND,
    procedure_result: APPROVAL_REQUEST_TYPE.PROCEDURE_RESULT_AMEND,
  };
  const { result } = await getResultDocument(type, id);
  const approval = await approvalRequestService.createApprovalRequest({
    request_type: requestTypeByResult[type],
    target_type: type,
    target_id: result._id,
    reason,
    assigned_to_user_id: payload.assigned_to_user_id,
    assigned_to_role_code: payload.assigned_to_role_code,
    payload: {
      severity: payload.severity || 'minor',
      proposed_changes: payload.proposed_changes,
      doctor_already_released: Boolean(result.released_to_doctor),
      patient_already_released: Boolean(result.released_to_patient),
      critical: Boolean(result.is_critical),
      before_snapshot: result.toObject ? result.toObject() : result,
    },
  }, actor);
  await recordAuditLog({
    actor,
    action: `${type}.amend_requested`,
    targetType: type,
    targetId: result._id,
    status: 'success',
    message: 'Tạo request amend result thành công.',
    requestMeta,
    metadata: { approval_request_id: toId(approval.approval_request), reason },
  });
  return approval;
}

async function bulkAction(payload = {}, actor = {}, requestMeta = {}) {
  const action = normalizeString(payload.action);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!action) throw createError('action là bắt buộc.');
  if (!items.length) throw createError('items là bắt buộc.');
  const results = [];
  for (const item of items) {
    const type = item.type || item.result_type;
    const id = item.id || item.result_id;
    try {
      let data;
      if (action === 'finalize') data = await finalizeResult(type, id, actor, requestMeta);
      else if (action === 'release_to_doctor') data = await releaseToDoctor(type, id, actor, requestMeta);
      else if (action === 'release_to_patient') data = await releaseToPatient(type, id, actor, requestMeta);
      else if (action === 'acknowledge_critical') data = await acknowledgeCritical(type, id, actor, requestMeta);
      else if (action === 'request_amend') data = await requestAmend(type, id, payload.reason ? { ...payload, reason: payload.reason } : payload, actor, requestMeta);
      else if (action === 'revoke_patient_release') data = await revokePatientRelease(type, id, payload, actor, requestMeta);
      else throw createError('bulk action không được hỗ trợ.', 400);
      results.push({ type, id, ok: true, data });
    } catch (error) {
      results.push({ type, id, ok: false, message: error.message || 'Không thể xử lý item.' });
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

async function getAuditTrail(query = {}, actor = {}) {
  assertReviewRead(actor);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = {};
  const types = typeFilterForQuery(query);
  if (types.length) filter.target_type = { $in: types };
  const actions = normalizeList(query.action);
  if (actions.length) {
    filter.action = { $in: actions.map((action) => (action.includes('.') ? action : new RegExp(escapeRegex(action), 'i'))) };
  } else {
    filter.action = {
      $regex: 'lab_result|imaging_report|procedure_result|procedure_order',
      $options: 'i',
    };
  }
  const patientId = toObjectId(query.patient_id);
  if (patientId) filter['metadata.patient_id'] = String(patientId);
  if (query.from || query.to || query.date_from || query.date_to) {
    const createdRange = {};
    const from = query.from || query.date_from;
    const to = query.to || query.date_to;
    if (from) createdRange.$gte = new Date(from);
    if (to) createdRange.$lte = new Date(to);
    filter.created_at = createdRange;
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      event_id: toId(item),
      event_time: item.created_at,
      result_type: item.target_type,
      result_id: toId(item.target_id),
      action: item.action,
      actor: {
        id: String(item.actor_id || ''),
        actor_type: item.actor_type,
      },
      before: item.before,
      after: item.after,
      metadata: item.metadata,
      ip_address: item.ip_address,
      user_agent: item.user_agent,
      status: item.status,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

module.exports = {
  getReviewSummary,
  getReviewWorklist,
  getReviewDetail,
  validateFinalize,
  finalizeResult,
  releaseToDoctor,
  markDoctorRead,
  doctorAcknowledge,
  releaseToPatient,
  revokePatientRelease,
  acknowledgeCritical,
  requestAmend,
  bulkAction,
  getAuditTrail,
};
