const { createHash } = require('crypto');
const ApiError = require('../common/errors/api-error');
const { normalizePagination, buildPaginationMeta } = require('../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../common/helpers/query.helper');
const { isValidObjectId } = require('../common/helpers/object-id.helper');
const {
  AuditExportRequest,
  AuditLog,
  AuditReview,
  BreakGlassAccess,
  ComplianceReport,
  ConsentRecord,
  PatientAuthorization,
} = require('../models');
const { AUDIT_SEVERITY, AUDIT_STATUS, BREAK_GLASS_STATUS, CONSENT_STATUS, AUTHORIZATION_STATUS } = require('../constants/statuses');
const auditPolicy = require('./audit-policy.service');
const auditService = require('./audit.service');

const BREAK_GLASS_ACTIONS = ['break_glass.start', 'break_glass.end', 'break_glass.started', 'break_glass.ended'];
const SENSITIVE_ACTIONS = [...auditPolicy.SENSITIVE_READ_ACTIONS, ...auditPolicy.SENSITIVE_WRITE_ACTIONS];
const PAYMENT_ACTIONS = [
  ...auditPolicy.PAYMENT_ACTIONS,
  'charges.create',
  'charges.post',
  'charges.void',
  'invoices.create_from_charges',
  'invoices.issue',
  'invoices.void',
  'payments.create',
  'payments.void',
  'payments.refund',
  'refund.requested',
  'refund.approved',
  'refund.rejected',
  'receipt.print_log',
  'receipt.viewed',
  'manual_payment.confirmed',
  'manual_payment.rejected',
];
const IAM_PREFIXES = ['iam.', 'role.', 'roles.', 'permission.', 'permissions.', 'user_role.', 'access_control.'];
const SYSTEM_CONFIG_FILTER = { $or: [{ target_type: 'system_setting' }, { module_key: 'settings' }, { action: { $regex: '^(system_setting|clinical_config)\\.' } }] };

function now() {
  return new Date();
}

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function getActorId(auth = {}) {
  return auth.userId || auth.actorId || auth.actor_id || auth.patientAccountId || auth.relativeId || null;
}

function dateFilter(field, query = {}) {
  const range = {};
  const from = query.from || query.date_from || query.period_from;
  const to = query.to || query.date_to || query.period_to;
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? { [field]: range } : {};
}

function andFilter(...filters) {
  const usable = filters.filter((filter) => filter && Object.keys(filter).length);
  if (!usable.length) return {};
  if (usable.length === 1) return usable[0];
  return { $and: usable };
}

function actionPrefixFilter(prefixes = []) {
  return { $or: prefixes.map((prefix) => ({ action: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } })) };
}

function baseAuditFilter(query = {}) {
  const filter = { ...dateFilter('created_at', query) };
  for (const field of ['actor_type', 'actor_id', 'action', 'module_key', 'target_type', 'target_id', 'status', 'severity', 'request_id', 'session_id', 'ip_address']) {
    if (query[field]) filter[field] = query[field];
  }
  if (!filter.action && query.action_prefix) filter.action = { $regex: `^${String(query.action_prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.` };
  const keyword = query.keyword || query.search || query.q;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [{ action: regex }, { module_key: regex }, { target_type: regex }, { message: regex }, { request_id: regex }, { ip_address: regex }];
  }
  return filter;
}

function exportTypeFilter(exportType = 'general', filters = {}) {
  if (exportType === 'sensitive_access') return andFilter(baseAuditFilter(filters), { action: { $in: SENSITIVE_ACTIONS } });
  if (exportType === 'break_glass') return andFilter(baseAuditFilter(filters), { action: { $in: BREAK_GLASS_ACTIONS } });
  if (exportType === 'payment') return andFilter(baseAuditFilter(filters), { action: { $in: PAYMENT_ACTIONS } });
  if (exportType === 'iam') return andFilter(baseAuditFilter(filters), actionPrefixFilter(IAM_PREFIXES));
  if (exportType === 'system_config') return andFilter(baseAuditFilter(filters), SYSTEM_CONFIG_FILTER);
  if (exportType === 'patient_access' && filters.patient_id) return patientAuditFilter(filters.patient_id, filters);
  return baseAuditFilter(filters);
}

function riskLevel(score) {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function calculateAuditRisk(log = {}, review = null) {
  let score = 0;
  const reasons = [];
  if (log.severity === AUDIT_SEVERITY.CRITICAL) {
    score += 30;
    reasons.push('critical_severity');
  }
  if (log.status === AUDIT_STATUS.FAILURE) {
    score += 20;
    reasons.push('failed_event');
  }
  if (SENSITIVE_ACTIONS.includes(log.action)) {
    score += 18;
    reasons.push('sensitive_access');
  }
  if (BREAK_GLASS_ACTIONS.includes(log.action)) {
    score += 22;
    reasons.push('break_glass');
  }
  if (String(log.action || '').includes('download') || String(log.action || '').includes('export')) {
    score += 16;
    reasons.push('download_or_export');
  }
  const hour = log.created_at ? new Date(log.created_at).getHours() : 12;
  if (hour < 6 || hour >= 22) {
    score += 10;
    reasons.push('outside_business_hours');
  }
  if (!review && (SENSITIVE_ACTIONS.includes(log.action) || BREAK_GLASS_ACTIONS.includes(log.action))) {
    score += 8;
    reasons.push('pending_review');
  }
  return { risk_score: Math.max(0, Math.min(100, Math.round(score))), risk_level: riskLevel(score), risk_reasons: reasons };
}

async function withReviews(logs = [], reviewType) {
  const ids = logs.map((item) => item._id).filter(Boolean);
  const reviews = ids.length
    ? await AuditReview.find({ audit_log_id: { $in: ids }, ...(reviewType ? { review_type: reviewType } : {}) }).lean()
    : [];
  const reviewMap = new Map(reviews.map((review) => [toId(review.audit_log_id), review]));
  return logs.map((log) => {
    const review = reviewMap.get(toId(log._id));
    const risk = calculateAuditRisk(log, review);
    return {
      audit_log_id: toId(log._id),
      ...log,
      _id: undefined,
      review_status: review?.review_status || (risk.risk_score >= 35 ? 'pending' : 'not_required'),
      review,
      ...risk,
    };
  });
}

async function listAudit(query = {}, filter = {}, reviewType) {
  const { page, limit, skip } = normalizePagination(query);
  const finalFilter = andFilter(baseAuditFilter(query), filter);
  const [items, total] = await Promise.all([
    AuditLog.find(finalFilter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(finalFilter),
  ]);
  return {
    items: await withReviews(items, reviewType),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function countBy(filter, field, limit = 10) {
  return AuditLog.aggregate([
    { $match: filter },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { _id: { $nin: [null, ''] } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

async function complianceDashboard(query = {}) {
  const since = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const base = { created_at: { $gte: since } };
  const [
    total,
    failed,
    critical,
    sensitive,
    breakGlass,
    payment,
    iam,
    config,
    pendingReviews,
    activeBreakGlass,
    activeConsents,
    activeAuthorizations,
    recentReports,
  ] = await Promise.all([
    AuditLog.countDocuments(base),
    AuditLog.countDocuments({ ...base, status: AUDIT_STATUS.FAILURE }),
    AuditLog.countDocuments({ ...base, severity: AUDIT_SEVERITY.CRITICAL }),
    AuditLog.countDocuments(andFilter(base, { action: { $in: SENSITIVE_ACTIONS } })),
    AuditLog.countDocuments(andFilter(base, { action: { $in: BREAK_GLASS_ACTIONS } })),
    AuditLog.countDocuments(andFilter(base, { action: { $in: PAYMENT_ACTIONS } })),
    AuditLog.countDocuments(andFilter(base, actionPrefixFilter(IAM_PREFIXES))),
    AuditLog.countDocuments(andFilter(base, SYSTEM_CONFIG_FILTER)),
    AuditReview.countDocuments({ review_status: 'pending' }),
    BreakGlassAccess.countDocuments({ status: BREAK_GLASS_STATUS.ACTIVE }),
    ConsentRecord.countDocuments({ status: CONSENT_STATUS.ACTIVE }),
    PatientAuthorization.countDocuments({ status: AUTHORIZATION_STATUS.ACTIVE, is_deleted: false }),
    ComplianceReport.find().sort({ generated_at: -1 }).limit(5).lean(),
  ]);
  const scorePenalty = failed * 0.6 + critical * 8 + pendingReviews * 2 + activeBreakGlass * 4;
  const score = Math.max(0, Math.min(100, Math.round(100 - scorePenalty)));
  return {
    compliance_score: score,
    risk_level: riskLevel(100 - score),
    metrics: {
      audit_events: total,
      failed_events: failed,
      critical_events: critical,
      sensitive_access: sensitive,
      break_glass: breakGlass,
      payment_events: payment,
      iam_changes: iam,
      system_config_changes: config,
      pending_reviews: pendingReviews,
      active_break_glass: activeBreakGlass,
      active_consents: activeConsents,
      active_authorizations: activeAuthorizations,
    },
    task_queue: [
      { task_key: 'sensitive_access_review', label: 'Sensitive access cần review', count: pendingReviews, severity: pendingReviews ? 'warning' : 'info' },
      { task_key: 'active_break_glass', label: 'Break-glass đang active', count: activeBreakGlass, severity: activeBreakGlass ? 'critical' : 'info' },
      { task_key: 'critical_audit_events', label: 'Critical audit events', count: critical, severity: critical ? 'critical' : 'info' },
      { task_key: 'failed_audit_events', label: 'Failed audit events', count: failed, severity: failed ? 'warning' : 'info' },
    ],
    reports: recentReports,
  };
}

async function sensitiveAccess(query = {}) {
  return listAudit(query, { action: { $in: SENSITIVE_ACTIONS } }, 'sensitive_access');
}

async function sensitiveAccessSummary(query = {}) {
  const filter = andFilter(baseAuditFilter(query), { action: { $in: SENSITIVE_ACTIONS } });
  const [total, reads, writes, downloads, pendingReview, topActors, topPatients] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.countDocuments(andFilter(filter, { action: { $in: [...auditPolicy.SENSITIVE_READ_ACTIONS] } })),
    AuditLog.countDocuments(andFilter(filter, { action: { $in: [...auditPolicy.SENSITIVE_WRITE_ACTIONS] } })),
    AuditLog.countDocuments(andFilter(filter, { action: { $regex: '(download|export)' } })),
    AuditReview.countDocuments({ review_type: 'sensitive_access', review_status: 'pending' }),
    countBy(filter, 'actor_id', 10),
    AuditLog.aggregate([
      { $match: filter },
      { $group: { _id: '$metadata.patient_id', count: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);
  return { total, reads, writes, downloads, pending_review: pendingReview, top_actors: topActors, top_patients: topPatients };
}

async function sensitiveAccessRiskQueue(query = {}) {
  const result = await sensitiveAccess({ ...query, limit: query.limit || 100 });
  const items = result.items
    .filter((item) => item.risk_score >= 35 || item.review_status === 'pending')
    .sort((left, right) => right.risk_score - left.risk_score);
  return { items, pagination: result.pagination };
}

async function reviewAuditLog(auditLogId, payload = {}, auth = {}, requestMeta = {}) {
  if (!isValidObjectId(auditLogId)) throw ApiError.validation('auditLogId không hợp lệ.');
  const log = await AuditLog.findById(auditLogId).lean();
  if (!log) throw ApiError.notFound('Không tìm thấy audit log.');
  const risk = calculateAuditRisk(log);
  const review = await AuditReview.findOneAndUpdate(
    { audit_log_id: auditLogId, review_type: payload.review_type || 'sensitive_access' },
    {
      $set: {
        review_status: payload.review_status || 'reviewed',
        reviewed_by: getActorId(auth),
        reviewed_at: new Date(),
        note: payload.note,
        risk_score: payload.risk_score ?? risk.risk_score,
        risk_reasons: payload.risk_reasons || risk.risk_reasons,
        metadata: payload.metadata,
      },
      $setOnInsert: { assigned_to: payload.assigned_to },
    },
    { new: true, upsert: true },
  );
  await auditService.recordAuditLog({
    actor: auth,
    action: 'compliance.audit_review',
    targetType: 'audit_log',
    targetId: auditLogId,
    status: AUDIT_STATUS.SUCCESS,
    severity: AUDIT_SEVERITY.INFO,
    message: 'Audit event reviewed by compliance.',
    requestMeta,
    metadata: { review_type: review.review_type, review_status: review.review_status },
  });
  return review.toObject();
}

async function breakGlassSummary(query = {}) {
  const [active, ended, pendingReview, missingReason, longActive] = await Promise.all([
    BreakGlassAccess.countDocuments({ status: BREAK_GLASS_STATUS.ACTIVE }),
    BreakGlassAccess.countDocuments({ status: BREAK_GLASS_STATUS.ENDED, ...dateFilter('ended_at', query) }),
    BreakGlassAccess.countDocuments({ 'metadata.review_status': { $in: [null, 'pending_review', 'pending'] } }),
    BreakGlassAccess.countDocuments({ $or: [{ reason: null }, { reason: '' }] }),
    BreakGlassAccess.countDocuments({ status: BREAK_GLASS_STATUS.ACTIVE, started_at: { $lte: new Date(Date.now() - 60 * 60 * 1000) } }),
  ]);
  return { active, ended, pending_review: pendingReview, missing_reason: missingReason, long_active: longActive };
}

async function breakGlassList(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = { ...dateFilter('started_at', query) };
  if (query.status) filter.status = query.status;
  if (query.patient_id) filter.patient_id = query.patient_id;
  const [items, total] = await Promise.all([
    BreakGlassAccess.find(filter).populate('accessed_by_user_id', 'full_name username employee_code department_id').sort({ started_at: -1 }).skip(skip).limit(limit).lean(),
    BreakGlassAccess.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => {
      const duration = (item.ended_at ? new Date(item.ended_at) : now()) - new Date(item.started_at);
      const score = Math.min(100, Math.round((item.status === BREAK_GLASS_STATUS.ACTIVE ? 35 : 0) + (duration > 60 * 60 * 1000 ? 20 : 0) + (!item.reason ? 25 : 0)));
      return {
        break_glass_access_id: toId(item._id),
        ...item,
        _id: undefined,
        duration_minutes: Math.max(0, Math.round(duration / 60000)),
        review_status: item.metadata?.review_status || 'pending_review',
        risk_score: score,
        risk_level: riskLevel(score),
      };
    }),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function breakGlassTimeline(accessId, query = {}) {
  if (!isValidObjectId(accessId)) throw ApiError.validation('accessId không hợp lệ.');
  const access = await BreakGlassAccess.findById(accessId).lean();
  if (!access) throw ApiError.notFound('Không tìm thấy break-glass access.');
  const auditIds = access.audit_log_ids || [];
  const filter = andFilter(baseAuditFilter(query), {
    $or: [
      { target_type: 'break_glass_access', target_id: access._id },
      { _id: { $in: auditIds } },
      { 'metadata.break_glass_access_id': toId(access._id) },
      { 'metadata.patient_id': toId(access.patient_id), created_at: { $gte: access.started_at, ...(access.ended_at ? { $lte: access.ended_at } : {}) } },
    ],
  });
  const items = await AuditLog.find(filter).sort({ created_at: 1 }).limit(300).lean();
  return { access, items: await withReviews(items, 'break_glass') };
}

async function reviewBreakGlass(accessId, payload = {}, auth = {}, requestMeta = {}) {
  const access = await BreakGlassAccess.findById(accessId);
  if (!access) throw ApiError.notFound('Không tìm thấy break-glass access.');
  access.metadata = {
    ...(access.metadata || {}),
    review_status: payload.review_status || 'reviewed',
    reviewed_by: getActorId(auth),
    reviewed_at: new Date(),
    review_note: payload.note || payload.review_note,
  };
  await access.save();
  await auditService.recordAuditLog({
    actor: auth,
    action: 'break_glass.review',
    targetType: 'break_glass_access',
    targetId: access._id,
    status: AUDIT_STATUS.SUCCESS,
    severity: AUDIT_SEVERITY.INFO,
    message: 'Break-glass reviewed by compliance.',
    requestMeta,
    metadata: access.metadata,
  });
  return access.toObject();
}

function patientAuditFilter(patientId, query = {}) {
  const idFilter = isValidObjectId(patientId) ? [{ target_id: patientId }] : [];
  return andFilter(baseAuditFilter(query), {
    $or: [
      { 'metadata.patient_id': toId(patientId) },
      { target_type: 'patient', ...idFilter[0] },
      { 'metadata.patientId': toId(patientId) },
    ],
  });
}

async function patientAccessTimeline(patientId, query = {}) {
  const result = await listAudit({ ...query, sort_by: 'created_at', limit: query.limit || 100 }, patientAuditFilter(patientId, query), 'sensitive_access');
  return result;
}

async function patientAccessSummary(patientId, query = {}) {
  const filter = patientAuditFilter(patientId, query);
  const [total, sensitive, downloads, breakGlass, consents, authorizations] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.countDocuments(andFilter(filter, { action: { $in: SENSITIVE_ACTIONS } })),
    AuditLog.countDocuments(andFilter(filter, { action: { $regex: '(download|export)' } })),
    BreakGlassAccess.countDocuments({ patient_id: patientId }),
    ConsentRecord.countDocuments({ patient_id: patientId, status: CONSENT_STATUS.ACTIVE }),
    PatientAuthorization.countDocuments({ patient_id: patientId, status: AUTHORIZATION_STATUS.ACTIVE, is_deleted: false }),
  ]);
  return { patient_id: patientId, total_events: total, sensitive_access: sensitive, downloads, break_glass: breakGlass, active_consents: consents, active_authorizations: authorizations };
}

async function billingSummary(query = {}) {
  const filter = andFilter(baseAuditFilter(query), { action: { $in: PAYMENT_ACTIONS } });
  const [total, failed, refunds, voids, receipts, topActions] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.countDocuments(andFilter(filter, { status: AUDIT_STATUS.FAILURE })),
    AuditLog.countDocuments(andFilter(filter, { action: { $regex: 'refund' } })),
    AuditLog.countDocuments(andFilter(filter, { action: { $regex: 'void' } })),
    AuditLog.countDocuments(andFilter(filter, { action: { $regex: 'receipt' } })),
    countBy(filter, 'action', 12),
  ]);
  return { total, failed, refunds, voids, receipts, top_actions: topActions };
}

async function billingAudit(query = {}) {
  return listAudit(query, { action: { $in: PAYMENT_ACTIONS } }, 'billing');
}

async function iamSummary(query = {}) {
  const filter = andFilter(baseAuditFilter(query), actionPrefixFilter(IAM_PREFIXES));
  const [total, failed, highPrivilege, accessDenied, topActions] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.countDocuments(andFilter(filter, { status: AUDIT_STATUS.FAILURE })),
    AuditLog.countDocuments(andFilter(filter, { $or: [{ action: { $regex: '(assign|grant|full_access|super_admin)' } }, { 'after.permissions': { $regex: 'full_access' } }] })),
    AuditLog.countDocuments({ action: 'access.denied', ...dateFilter('created_at', query) }),
    countBy(filter, 'action', 12),
  ]);
  return { total, failed, high_privilege_grants: highPrivilege, access_denied: accessDenied, top_actions: topActions };
}

async function iamAudit(query = {}) {
  return listAudit(query, actionPrefixFilter(IAM_PREFIXES), 'iam');
}

async function settingsSummary(query = {}) {
  const filter = andFilter(baseAuditFilter(query), SYSTEM_CONFIG_FILTER);
  const [total, sensitive, failed, topModules, topActors] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.countDocuments(andFilter(filter, { $or: [{ 'metadata.is_sensitive': true }, { 'metadata.is_encrypted': true }, { message: /sensitive/i }] })),
    AuditLog.countDocuments(andFilter(filter, { status: AUDIT_STATUS.FAILURE })),
    countBy(filter, 'module_key', 10),
    countBy(filter, 'actor_id', 10),
  ]);
  return { total, sensitive_changes: sensitive, failed, top_modules: topModules, top_actors: topActors };
}

async function settingsAudit(query = {}) {
  return listAudit(query, SYSTEM_CONFIG_FILTER, 'system_config');
}

async function previewExportCount(payload = {}) {
  const filter = exportTypeFilter(payload.export_type, payload.filters || {});
  const total = await AuditLog.countDocuments(filter);
  return { total_records: total };
}

async function previewExportSample(payload = {}) {
  const filter = exportTypeFilter(payload.export_type, payload.filters || {});
  const items = await AuditLog.find(filter).sort({ created_at: -1 }).limit(Math.min(Number(payload.limit) || 20, 50)).lean();
  return { items };
}

async function createAuditExport(payload = {}, auth = {}, requestMeta = {}) {
  const reason = String(payload.reason || '').trim();
  if (!reason) throw ApiError.validation('reason là bắt buộc khi tạo audit export.');
  const count = await previewExportCount(payload);
  const checksum = createHash('sha256')
    .update(JSON.stringify({ export_type: payload.export_type, filters: payload.filters, format: payload.format, total: count.total_records, at: Date.now() }))
    .digest('hex');
  const request = await AuditExportRequest.create({
    requested_by: getActorId(auth),
    export_type: payload.export_type || 'general',
    filters: payload.filters || {},
    format: payload.format || 'json',
    include_options: payload.include_options || {},
    reason,
    status: 'completed',
    total_records: count.total_records,
    checksum,
    completed_at: new Date(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await auditService.recordAuditLog({
    actor: auth,
    action: 'audit_export.requested',
    targetType: 'audit_export_request',
    targetId: request._id,
    status: AUDIT_STATUS.SUCCESS,
    severity: AUDIT_SEVERITY.WARNING,
    message: 'Audit export request created.',
    requestMeta,
    metadata: { export_type: request.export_type, filters: request.filters, total_records: request.total_records, checksum },
  });
  return request.toObject();
}

async function listAuditExports(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {};
  if (query.export_type) filter.export_type = query.export_type;
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    AuditExportRequest.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditExportRequest.countDocuments(filter),
  ]);
  return { items, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function generateComplianceReport(payload = {}, auth = {}, requestMeta = {}) {
  const periodFrom = payload.period_from ? new Date(payload.period_from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const periodTo = payload.period_to ? new Date(payload.period_to) : new Date();
  const metrics = await complianceDashboard({ from: periodFrom.toISOString(), to: periodTo.toISOString() });
  const checksum = createHash('sha256').update(JSON.stringify({ report_type: payload.report_type, periodFrom, periodTo, metrics })).digest('hex');
  const report = await ComplianceReport.create({
    report_type: payload.report_type || 'daily_audit',
    period_from: periodFrom,
    period_to: periodTo,
    scope: payload.scope || {},
    generated_by: getActorId(auth),
    status: 'generated',
    metrics,
    findings: metrics.task_queue || [],
    recommendations: [
      ...(metrics.metrics.pending_reviews ? ['Rà soát các audit event đang chờ review.'] : []),
      ...(metrics.metrics.active_break_glass ? ['Review và đóng break-glass đang active nếu không còn cần thiết.'] : []),
      ...(metrics.metrics.failed_events ? ['Kiểm tra các audit failure trong kỳ báo cáo.'] : []),
    ],
    checksum,
  });
  await auditService.recordAuditLog({
    actor: auth,
    action: 'compliance.report.generate',
    targetType: 'compliance_report',
    targetId: report._id,
    status: AUDIT_STATUS.SUCCESS,
    severity: AUDIT_SEVERITY.INFO,
    message: 'Compliance report generated.',
    requestMeta,
    metadata: { report_type: report.report_type, checksum },
  });
  return report.toObject();
}

async function listComplianceReports(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {};
  if (query.report_type) filter.report_type = query.report_type;
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    ComplianceReport.find(filter).sort({ generated_at: -1 }).skip(skip).limit(limit).lean(),
    ComplianceReport.countDocuments(filter),
  ]);
  return { items, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getComplianceReport(reportId) {
  const report = await ComplianceReport.findById(reportId).lean();
  if (!report) throw ApiError.notFound('Không tìm thấy compliance report.');
  return report;
}

module.exports = {
  complianceDashboard,
  sensitiveAccess,
  sensitiveAccessSummary,
  sensitiveAccessRiskQueue,
  reviewAuditLog,
  breakGlassSummary,
  breakGlassList,
  breakGlassTimeline,
  reviewBreakGlass,
  patientAccessTimeline,
  patientAccessSummary,
  billingSummary,
  billingAudit,
  iamSummary,
  iamAudit,
  settingsSummary,
  settingsAudit,
  previewExportCount,
  previewExportSample,
  createAuditExport,
  listAuditExports,
  generateComplianceReport,
  listComplianceReports,
  getComplianceReport,
};
