const ApiError = require('../common/errors/api-error');
const { normalizePagination, buildPaginationMeta } = require('../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../common/helpers/query.helper');
const { isValidObjectId } = require('../common/helpers/object-id.helper');
const {
  AuditLog,
  AuthSession,
  BreakGlassAccess,
  ConsentRecord,
  PatientAccount,
  PatientAuthorization,
  PatientRelative,
  SecurityDataAccessPolicy,
  SecurityRateLimitEvent,
  User,
} = require('../models');
const {
  AUTHORIZATION_STATUS,
  AUDIT_SEVERITY,
  AUDIT_STATUS,
  BREAK_GLASS_STATUS,
  CONSENT_STATUS,
} = require('../constants/statuses');
const auditPolicy = require('./audit-policy.service');
const auditService = require('./audit.service');
const authSessionService = require('./auth/auth-session.service');
const patientService = require('./patient.service');
const rateLimitEventService = require('./security-rate-limit-event.service');

const LOGIN_ACTIONS = ['auth.login', 'auth.login_failed', 'auth.account_locked', 'auth.staff.login', 'auth.patient.login'];
const TOKEN_RISK_ACTIONS = ['auth.refresh_token_replay', 'auth.session_family.revoked', 'auth.sessions.invalidate_all'];
const ACCESS_DECISION_ACTIONS = ['access.denied', 'access.granted', 'access.sensitive_granted', 'access.break_glass_granted'];
const BREAK_GLASS_ACTIONS = ['break_glass.start', 'break_glass.end', 'break_glass.started', 'break_glass.ended'];
const SENSITIVE_ACTIONS = [
  ...auditPolicy.SENSITIVE_READ_ACTIONS,
  ...auditPolicy.SENSITIVE_WRITE_ACTIONS,
];

const DEFAULT_DATA_ACCESS_POLICIES = [
  {
    policy_key: 'medical_record.view',
    resource_type: 'medical_record',
    action: 'view',
    required_permissions: ['medical_records.read'],
    require_consent: false,
    require_patient_authorization: true,
    authorization_types: ['view_records', 'medical_record.read'],
    allow_break_glass: true,
    require_reason: true,
    audit_required: true,
    review_required: false,
    retention_days: 3650,
    status: 'published',
    version: 1,
  },
  {
    policy_key: 'attachment.download',
    resource_type: 'attachment',
    action: 'download',
    required_permissions: ['attachments.download'],
    require_consent: false,
    require_patient_authorization: true,
    authorization_types: ['view_records'],
    allow_break_glass: true,
    require_reason: true,
    audit_required: true,
    review_required: true,
    retention_days: 3650,
    status: 'published',
    version: 1,
  },
  {
    policy_key: 'invoice.view',
    resource_type: 'invoice',
    action: 'view',
    required_permissions: ['invoices.read', 'payments.read'],
    require_consent: false,
    require_patient_authorization: true,
    authorization_types: ['billing', 'billing.read'],
    allow_break_glass: false,
    require_reason: false,
    audit_required: true,
    review_required: false,
    retention_days: 2555,
    status: 'published',
    version: 1,
  },
];

function now() {
  return new Date();
}

function startOfHours(hours = 24) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskLevel(score) {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function getActorId(auth = {}) {
  return auth.userId || auth.actorId || auth.actor_id || auth.patientAccountId || auth.relativeId || null;
}

function buildDateFilter(field, query = {}) {
  const range = {};
  if (query.from || query.date_from) range.$gte = new Date(query.from || query.date_from);
  if (query.to || query.date_to) range.$lte = new Date(query.to || query.date_to);
  return Object.keys(range).length ? { [field]: range } : {};
}

function buildSessionFilter(query = {}) {
  const filter = {};
  if (query.actor_type) filter.actor_type = query.actor_type;
  if (query.actor_id && isValidObjectId(query.actor_id)) filter.actor_id = query.actor_id;
  if (query.ip_address) {
    filter.$or = [
      { ip_address: query.ip_address },
      { last_ip: query.ip_address },
      { created_ip: query.ip_address },
    ];
  }
  if (query.device_id) filter.device_id = query.device_id;
  if (query.browser) filter.browser = query.browser;
  if (query.os) filter.os = query.os;
  if (query.login_method) filter.login_method = query.login_method;
  if (query.token_family_id) filter.token_family_id = query.token_family_id;
  Object.assign(filter, buildDateFilter('created_at', query));

  if (query.status === 'active') {
    filter.revoked_at = null;
    filter.expires_at = { $gt: now() };
  }
  if (query.status === 'revoked') filter.revoked_at = { $ne: null };
  if (query.status === 'expired') filter.expires_at = { $lte: now() };

  const keyword = query.keyword || query.search || query.q;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [
      ...(filter.$or || []),
      { device_name: regex },
      { device_id: regex },
      { browser: regex },
      { os: regex },
      { ip_address: regex },
      { last_ip: regex },
      { user_agent: regex },
      { token_family_id: regex },
    ];
  }
  return filter;
}

function calculateSessionRisk(session = {}, familyStats = {}) {
  let score = 0;
  const reasons = [];
  const replayCount = (session.refresh_token_history || []).filter((item) => item.replayed_at).length;

  if (replayCount > 0) {
    score += 45;
    reasons.push('refresh_token_replay');
  }
  if (session.created_ip && session.last_ip && session.created_ip !== session.last_ip) {
    score += 18;
    reasons.push('ip_drift');
  }
  if (!session.device_id) {
    score += 6;
    reasons.push('missing_device_id');
  }
  if (familyStats.active_count > 3) {
    score += 20;
    reasons.push('large_token_family');
  }
  if (session.revoked_reason === 'refresh_token_reuse') {
    score += 40;
    reasons.push('revoked_after_token_reuse');
  }
  if (!session.revoked_at && session.expires_at > now()) {
    const lastUsed = session.last_used_at ? new Date(session.last_used_at).getTime() : 0;
    if (lastUsed && Date.now() - lastUsed > 30 * 24 * 60 * 60 * 1000) {
      score += 10;
      reasons.push('stale_active_session');
    }
  }

  return {
    risk_score: clampScore(score),
    risk_level: riskLevel(score),
    risk_reasons: reasons,
  };
}

function serializeSession(session = {}, currentSessionId = null, familyStats = {}) {
  const risk = calculateSessionRisk(session, familyStats);
  return {
    session_id: toId(session._id),
    actor_type: session.actor_type,
    actor_id: toId(session.actor_id),
    permission_version: session.permission_version || 1,
    device_id: session.device_id,
    device_name: session.device_name,
    browser: session.browser,
    os: session.os,
    location: session.location,
    login_method: session.login_method,
    created_ip: session.created_ip,
    last_ip: session.last_ip,
    ip_address: session.ip_address,
    user_agent: session.user_agent,
    token_family_id: session.token_family_id,
    parent_session_id: toId(session.parent_session_id),
    refresh_rotation_count: (session.refresh_token_history || []).length,
    refresh_replay_count: (session.refresh_token_history || []).filter((item) => item.replayed_at).length,
    created_at: session.created_at,
    last_used_at: session.last_used_at,
    expires_at: session.expires_at,
    revoked_at: session.revoked_at,
    revoked_reason: session.revoked_reason,
    revoked_by: toId(session.revoked_by),
    is_current: currentSessionId ? toId(session._id) === String(currentSessionId) : false,
    is_active: !session.revoked_at && session.expires_at > now(),
    ...risk,
  };
}

async function familyStatsForSessions(sessions = []) {
  const familyIds = [...new Set(sessions.map((item) => item.token_family_id).filter(Boolean))];
  if (!familyIds.length) return new Map();
  const grouped = await AuthSession.aggregate([
    { $match: { token_family_id: { $in: familyIds } } },
    {
      $group: {
        _id: '$token_family_id',
        session_count: { $sum: 1 },
        active_count: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$revoked_at', null] }, { $gt: ['$expires_at', now()] }] },
              1,
              0,
            ],
          },
        },
        revoked_count: { $sum: { $cond: [{ $ne: ['$revoked_at', null] }, 1, 0] } },
      },
    },
  ]);
  return new Map(grouped.map((item) => [item._id, item]));
}

async function listSessions(query = {}, auth = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = buildSessionFilter(query);
  const [sessions, total] = await Promise.all([
    AuthSession.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuthSession.countDocuments(filter),
  ]);
  const familyStats = await familyStatsForSessions(sessions);
  return {
    items: sessions.map((session) => serializeSession(session, auth.sessionId || auth.session_id, familyStats.get(session.token_family_id))),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function resolveActorProfile(actorType, actorId) {
  if (!actorId || !isValidObjectId(actorId)) return null;
  if (actorType === 'staff') {
    const user = await User.findById(actorId).select('username full_name employee_code email status department_id failed_login_attempts locked_until last_login_at last_login_ip permission_version').lean();
    return user ? { actor_type: 'staff', actor_id: toId(user._id), ...user, _id: undefined } : null;
  }
  if (actorType === 'patient') {
    const account = await PatientAccount.findById(actorId).select('patient_id username email phone status failed_login_attempts locked_until last_login_at last_login_ip').lean();
    return account ? { actor_type: 'patient', actor_id: toId(account._id), ...account, _id: undefined } : null;
  }
  if (actorType === 'patient_relative') {
    const relative = await PatientRelative.findById(actorId).select('patient_id full_name relationship phone email status').lean();
    return relative ? { actor_type: 'patient_relative', actor_id: toId(relative._id), ...relative, _id: undefined } : null;
  }
  return null;
}

async function getSessionDetail(sessionId, auth = {}) {
  const session = await AuthSession.findById(sessionId).lean();
  if (!session) throw ApiError.notFound('Không tìm thấy phiên đăng nhập.');
  const [auditLogs, familySessions, actor] = await Promise.all([
    AuditLog.find({ session_id: session._id }).sort({ created_at: -1 }).limit(80).lean(),
    session.token_family_id
      ? AuthSession.find({ token_family_id: session.token_family_id }).sort({ created_at: 1 }).lean()
      : [],
    resolveActorProfile(session.actor_type, session.actor_id),
  ]);
  const familyStats = await familyStatsForSessions([session]);
  return {
    session: serializeSession(session, auth.sessionId || auth.session_id, familyStats.get(session.token_family_id)),
    actor,
    token_family: familySessions.map((item) => serializeSession(item, auth.sessionId || auth.session_id)),
    audit_logs: auditLogs,
  };
}

async function revokeSession(sessionId, payload = {}, auth = {}, requestMeta = {}) {
  return authSessionService.revokeSessionById(sessionId, auth, {
    ...requestMeta,
    reason: payload.reason || 'security_center_revoke',
  });
}

async function revokeTokenFamily(familyId, payload = {}, auth = {}, requestMeta = {}) {
  const session = await AuthSession.findOne({ token_family_id: familyId });
  if (!session) throw ApiError.notFound('Không tìm thấy token family.');
  return authSessionService.revokeSessionFamily(session, requestMeta, {
    reason: payload.reason || 'security_center_family_revoke',
    revokedBy: getActorId(auth),
  });
}

async function revokeSessionFamilyBySessionId(sessionId, payload = {}, auth = {}, requestMeta = {}) {
  const session = await AuthSession.findById(sessionId);
  if (!session) throw ApiError.notFound('Không tìm thấy phiên đăng nhập.');
  if (!session.token_family_id) throw ApiError.validation('Phiên này không có token family để thu hồi.');
  return authSessionService.revokeSessionFamily(session, requestMeta, {
    reason: payload.reason || 'security_center_family_revoke',
    revokedBy: getActorId(auth),
  });
}

function bulkSessionFilter(scope = {}) {
  return buildSessionFilter({
    actor_type: scope.actor_type,
    actor_id: scope.actor_id,
    ip_address: scope.ip_address,
    device_id: scope.device_id,
    token_family_id: scope.token_family_id,
    from: scope.created_from,
    to: scope.created_to,
    status: scope.status || 'active',
  });
}

async function bulkRevokePreview(payload = {}) {
  const filter = bulkSessionFilter(payload.scope || {});
  const sessions = await AuthSession.find(filter).sort({ created_at: -1 }).limit(500).lean();
  const familyStats = await familyStatsForSessions(sessions);
  const items = sessions.map((session) => serializeSession(session, null, familyStats.get(session.token_family_id)));
  const affectedActors = new Set(items.map((item) => `${item.actor_type}:${item.actor_id}`));
  return {
    matched_sessions: items.length,
    affected_actors: affectedActors.size,
    warnings: [
      ...(items.some((item) => item.actor_type === 'staff') ? ['Có phiên staff bị ảnh hưởng.'] : []),
      ...(items.length >= 500 ? ['Preview bị giới hạn 500 phiên đầu tiên.'] : []),
    ],
    items,
  };
}

async function bulkRevokeSessions(payload = {}, auth = {}, requestMeta = {}) {
  const reason = String(payload.reason || '').trim();
  if (!reason) throw ApiError.validation('reason là bắt buộc khi thu hồi phiên hàng loạt.');
  const filter = bulkSessionFilter(payload.scope || {});
  const preview = await bulkRevokePreview(payload);
  const result = await AuthSession.updateMany(filter, {
    $set: {
      revoked_at: new Date(),
      revoked_reason: reason,
      revoked_by: getActorId(auth),
      last_used_at: new Date(),
    },
  });
  await auditService.recordAuditLog({
    actor: auth,
    action: 'security.sessions.bulk_revoke',
    targetType: 'auth_session',
    status: AUDIT_STATUS.SUCCESS,
    severity: AUDIT_SEVERITY.WARNING,
    message: 'Bulk session revoke executed from Security Center.',
    requestMeta,
    metadata: {
      reason,
      scope: payload.scope,
      matched_sessions: preview.matched_sessions,
      revoked_count: result.modifiedCount || 0,
    },
  });
  return {
    ...preview,
    revoked_count: result.modifiedCount || 0,
  };
}

async function dashboard() {
  const since24h = startOfHours(24);
  const activeSessionFilter = { revoked_at: null, expires_at: { $gt: now() } };
  const [
    activeSessions,
    activeStaffSessions,
    activePatientSessions,
    failedLogins24h,
    lockedStaff,
    lockedPatients,
    tokenReplay24h,
    accessDenied24h,
    activeBreakGlass,
    sensitiveAccess24h,
    rateLimitBlocked24h,
    recentSecurityEvents,
    topSuspiciousIps,
    topRiskyAccounts,
  ] = await Promise.all([
    AuthSession.countDocuments(activeSessionFilter),
    AuthSession.countDocuments({ ...activeSessionFilter, actor_type: 'staff' }),
    AuthSession.countDocuments({ ...activeSessionFilter, actor_type: 'patient' }),
    AuditLog.countDocuments({ action: 'auth.login_failed', created_at: { $gte: since24h } }),
    User.countDocuments({ status: 'locked', is_deleted: false }),
    PatientAccount.countDocuments({ status: 'locked', is_deleted: false }),
    AuditLog.countDocuments({ action: 'auth.refresh_token_replay', created_at: { $gte: since24h } }),
    AuditLog.countDocuments({ action: 'access.denied', created_at: { $gte: since24h } }),
    BreakGlassAccess.countDocuments({ status: BREAK_GLASS_STATUS.ACTIVE }),
    AuditLog.countDocuments({ action: { $in: SENSITIVE_ACTIONS }, created_at: { $gte: since24h } }),
    SecurityRateLimitEvent.countDocuments({ blocked_at: { $gte: since24h } }),
    AuditLog.find({
      $or: [
        { action: { $in: [...LOGIN_ACTIONS, ...TOKEN_RISK_ACTIONS, ...ACCESS_DECISION_ACTIONS, ...BREAK_GLASS_ACTIONS] } },
        { severity: { $in: ['warning', 'error', 'critical'] } },
      ],
    }).sort({ created_at: -1 }).limit(18).lean(),
    listSuspiciousIps({ limit: 8, from: since24h.toISOString() }),
    listRiskyAccounts({ limit: 8 }),
  ]);

  const lockedAccounts = lockedStaff + lockedPatients;
  const scorePenalty = failedLogins24h * 0.4
    + lockedAccounts * 5
    + tokenReplay24h * 20
    + accessDenied24h * 0.6
    + activeBreakGlass * 8
    + rateLimitBlocked24h * 0.8;
  const securityScore = clampScore(100 - scorePenalty);
  return {
    security_score: securityScore,
    risk_level: riskLevel(100 - securityScore),
    summary: {
      active_sessions: activeSessions,
      active_staff_sessions: activeStaffSessions,
      active_patient_sessions: activePatientSessions,
      failed_logins_24h: failedLogins24h,
      locked_accounts: lockedAccounts,
      token_replay_events_24h: tokenReplay24h,
      access_denied_24h: accessDenied24h,
      active_break_glass: activeBreakGlass,
      pending_break_glass_review: activeBreakGlass,
      sensitive_access_24h: sensitiveAccess24h,
      rate_limit_blocked_24h: rateLimitBlocked24h,
    },
    realtime_events: recentSecurityEvents,
    top_suspicious_ips: topSuspiciousIps.items || [],
    top_risky_accounts: topRiskyAccounts.items || [],
    recommended_actions: [
      ...(tokenReplay24h ? ['Thu hồi token family có replay trong 24h.'] : []),
      ...(activeBreakGlass ? ['Review break-glass đang active.'] : []),
      ...(lockedAccounts ? ['Rà soát tài khoản bị khóa và failed login burst.'] : []),
      ...(accessDenied24h > 20 ? ['Kiểm tra access denied tăng cao.'] : []),
    ],
  };
}

function buildAuditListFilter(query = {}, actions = []) {
  const filter = {};
  if (actions.length) filter.action = { $in: actions };
  if (query.action) filter.action = query.action;
  if (query.actor_type) filter.actor_type = query.actor_type;
  if (query.actor_id) filter.actor_id = query.actor_id;
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  if (query.ip_address) filter.ip_address = query.ip_address;
  if (query.session_id && isValidObjectId(query.session_id)) filter.session_id = query.session_id;
  Object.assign(filter, buildDateFilter('created_at', query));
  const keyword = query.keyword || query.search || query.q;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [{ action: regex }, { message: regex }, { request_id: regex }, { ip_address: regex }];
  }
  return filter;
}

async function listAuditLike(query = {}, actions = []) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = buildAuditListFilter(query, actions);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function listLoginHistory(query = {}) {
  return listAuditLike(query, LOGIN_ACTIONS);
}

async function loginSummary(query = {}) {
  const filter = buildAuditListFilter(query, LOGIN_ACTIONS);
  const [success, failed, locked] = await Promise.all([
    AuditLog.countDocuments({ ...filter, action: 'auth.login', status: AUDIT_STATUS.SUCCESS }),
    AuditLog.countDocuments({ ...filter, action: 'auth.login_failed' }),
    AuditLog.countDocuments({ ...filter, action: 'auth.account_locked' }),
  ]);
  return { success, failed, locked, failed_rate: success + failed ? failed / (success + failed) : 0 };
}

async function listSuspiciousIps(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const match = { ip_address: { $nin: [null, ''] } };
  Object.assign(match, buildDateFilter('created_at', query));
  const rows = await AuditLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$ip_address',
        last_seen_at: { $max: '$created_at' },
        first_seen_at: { $min: '$created_at' },
        events: { $sum: 1 },
        failed_logins: { $sum: { $cond: [{ $eq: ['$action', 'auth.login_failed'] }, 1, 0] } },
        access_denied: { $sum: { $cond: [{ $eq: ['$action', 'access.denied'] }, 1, 0] } },
        token_replay: { $sum: { $cond: [{ $eq: ['$action', 'auth.refresh_token_replay'] }, 1, 0] } },
        actors: { $addToSet: { $concat: ['$actor_type', ':', { $toString: '$actor_id' }] } },
        last_user_agent: { $last: '$user_agent' },
      },
    },
    { $sort: { failed_logins: -1, access_denied: -1, events: -1 } },
    { $limit: limit },
  ]);
  return {
    items: rows.map((row) => {
      const score = clampScore(row.failed_logins * 8 + row.access_denied * 4 + row.token_replay * 35 + Math.max(0, (row.actors || []).length - 1) * 8);
      return {
        ip_address: row._id,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        events: row.events,
        failed_logins: row.failed_logins,
        access_denied: row.access_denied,
        token_replay: row.token_replay,
        distinct_actors: (row.actors || []).length,
        last_user_agent: row.last_user_agent,
        risk_score: score,
        risk_level: riskLevel(score),
      };
    }),
  };
}

async function listDevices(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 30), 1), 100);
  const match = {};
  if (query.device_id) match.device_id = query.device_id;
  if (query.actor_type) match.actor_type = query.actor_type;
  const rows = await AuthSession.aggregate([
    { $match: match },
    {
      $group: {
        _id: { device_id: '$device_id', browser: '$browser', os: '$os' },
        first_seen_at: { $min: '$created_at' },
        last_seen_at: { $max: '$last_used_at' },
        sessions: { $sum: 1 },
        revoked_sessions: { $sum: { $cond: [{ $ne: ['$revoked_at', null] }, 1, 0] } },
        ips: { $addToSet: '$ip_address' },
        actors: { $addToSet: { $concat: ['$actor_type', ':', { $toString: '$actor_id' }] } },
      },
    },
    { $sort: { sessions: -1, last_seen_at: -1 } },
    { $limit: limit },
  ]);
  return {
    items: rows.map((row) => {
      const score = clampScore((row.ips || []).length * 5 + (row.actors || []).length * 6 + row.revoked_sessions * 4 + (!row._id.device_id ? 10 : 0));
      return {
        device_id: row._id.device_id || 'unknown',
        browser: row._id.browser,
        os: row._id.os,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        session_count: row.sessions,
        revoked_sessions: row.revoked_sessions,
        ip_count: (row.ips || []).filter(Boolean).length,
        actor_count: (row.actors || []).length,
        risk_score: score,
        risk_level: riskLevel(score),
      };
    }),
  };
}

async function actorSessionCounts(actorType, ids = []) {
  if (!ids.length) return new Map();
  const rows = await AuthSession.aggregate([
    { $match: { actor_type: actorType, actor_id: { $in: ids }, revoked_at: null, expires_at: { $gt: now() } } },
    { $group: { _id: '$actor_id', active_sessions: { $sum: 1 }, ip_count: { $addToSet: '$ip_address' } } },
  ]);
  return new Map(rows.map((row) => [toId(row._id), { active_sessions: row.active_sessions, ip_count: (row.ip_count || []).filter(Boolean).length }]));
}

async function listRiskyAccounts(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 80);
  const [staff, patients] = await Promise.all([
    User.find({ is_deleted: false, $or: [{ status: { $in: ['locked', 'disabled', 'suspended'] } }, { failed_login_attempts: { $gt: 0 } }] })
      .sort({ failed_login_attempts: -1, last_login_at: -1 }).limit(limit).lean(),
    PatientAccount.find({ is_deleted: false, $or: [{ status: { $in: ['locked', 'disabled'] } }, { failed_login_attempts: { $gt: 0 } }] })
      .sort({ failed_login_attempts: -1, last_login_at: -1 }).limit(limit).lean(),
  ]);
  const [staffSessions, patientSessions] = await Promise.all([
    actorSessionCounts('staff', staff.map((item) => item._id)),
    actorSessionCounts('patient', patients.map((item) => item._id)),
  ]);
  const items = [
    ...staff.map((item) => {
      const sessionStats = staffSessions.get(toId(item._id)) || {};
      const score = clampScore((item.failed_login_attempts || 0) * 10 + (item.status === 'locked' ? 35 : 0) + (item.status === 'disabled' ? 20 : 0) + (sessionStats.ip_count || 0) * 5);
      return {
        actor_type: 'staff',
        actor_id: toId(item._id),
        display_name: item.full_name || item.username,
        username: item.username,
        department_id: toId(item.department_id),
        status: item.status,
        failed_login_attempts: item.failed_login_attempts || 0,
        locked_until: item.locked_until,
        last_login_at: item.last_login_at,
        last_login_ip: item.last_login_ip,
        active_sessions: sessionStats.active_sessions || 0,
        risk_score: score,
        risk_level: riskLevel(score),
      };
    }),
    ...patients.map((item) => {
      const sessionStats = patientSessions.get(toId(item._id)) || {};
      const score = clampScore((item.failed_login_attempts || 0) * 10 + (item.status === 'locked' ? 35 : 0) + (item.status === 'disabled' ? 20 : 0) + (sessionStats.ip_count || 0) * 5);
      return {
        actor_type: 'patient',
        actor_id: toId(item._id),
        patient_id: toId(item.patient_id),
        display_name: item.username || item.email || item.phone || toId(item._id),
        username: item.username,
        status: item.status,
        failed_login_attempts: item.failed_login_attempts || 0,
        locked_until: item.locked_until,
        last_login_at: item.last_login_at,
        last_login_ip: item.last_login_ip,
        active_sessions: sessionStats.active_sessions || 0,
        risk_score: score,
        risk_level: riskLevel(score),
      };
    }),
  ].sort((left, right) => right.risk_score - left.risk_score).slice(0, limit);
  return { items };
}

async function listTokenFamilies(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 30), 1), 100);
  const rows = await AuthSession.aggregate([
    { $match: { token_family_id: { $nin: [null, ''] } } },
    {
      $group: {
        _id: '$token_family_id',
        actor_type: { $first: '$actor_type' },
        actor_id: { $first: '$actor_id' },
        session_count: { $sum: 1 },
        active_sessions: { $sum: { $cond: [{ $and: [{ $eq: ['$revoked_at', null] }, { $gt: ['$expires_at', now()] }] }, 1, 0] } },
        revoked_sessions: { $sum: { $cond: [{ $ne: ['$revoked_at', null] }, 1, 0] } },
        rotation_count: { $sum: { $size: { $ifNull: ['$refresh_token_history', []] } } },
        replay_count: {
          $sum: {
            $size: {
              $filter: {
                input: { $ifNull: ['$refresh_token_history', []] },
                as: 'history',
                cond: { $ne: ['$$history.replayed_at', null] },
              },
            },
          },
        },
        first_session_at: { $min: '$created_at' },
        last_rotated_at: { $max: '$last_used_at' },
      },
    },
    { $sort: { replay_count: -1, active_sessions: -1, session_count: -1 } },
    { $limit: limit },
  ]);
  return {
    items: rows.map((row) => {
      const score = clampScore(row.replay_count * 45 + Math.max(0, row.active_sessions - 3) * 12 + row.rotation_count * 1.5);
      return {
        token_family_id: row._id,
        actor_type: row.actor_type,
        actor_id: toId(row.actor_id),
        session_count: row.session_count,
        active_sessions: row.active_sessions,
        revoked_sessions: row.revoked_sessions,
        rotation_count: row.rotation_count,
        replay_count: row.replay_count,
        first_session_at: row.first_session_at,
        last_rotated_at: row.last_rotated_at,
        risk_score: score,
        risk_level: riskLevel(score),
      };
    }),
  };
}

async function getTokenFamily(familyId) {
  const sessions = await AuthSession.find({ token_family_id: familyId }).sort({ created_at: 1 }).lean();
  if (!sessions.length) throw ApiError.notFound('Không tìm thấy token family.');
  return {
    token_family_id: familyId,
    sessions: sessions.map((session) => serializeSession(session)),
  };
}

async function listBreakGlass(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.patient_id && isValidObjectId(query.patient_id)) filter.patient_id = query.patient_id;
  if (query.accessed_by_user_id && isValidObjectId(query.accessed_by_user_id)) filter.accessed_by_user_id = query.accessed_by_user_id;
  Object.assign(filter, buildDateFilter('started_at', query));
  const [items, total] = await Promise.all([
    BreakGlassAccess.find(filter).populate('accessed_by_user_id', 'full_name username employee_code department_id').sort({ started_at: -1 }).skip(skip).limit(limit).lean(),
    BreakGlassAccess.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => {
      const durationMs = (item.ended_at ? new Date(item.ended_at) : now()) - new Date(item.started_at);
      const score = clampScore((item.status === BREAK_GLASS_STATUS.ACTIVE ? 35 : 0) + (durationMs > 60 * 60 * 1000 ? 20 : 0) + (!item.reason ? 30 : 0));
      return {
        break_glass_access_id: toId(item._id),
        ...item,
        _id: undefined,
        duration_minutes: Math.max(0, Math.round(durationMs / 60000)),
        review_status: item.metadata?.review_status || 'pending_review',
        risk_score: score,
        risk_level: riskLevel(score),
      };
    }),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function reviewBreakGlass(accessId, payload = {}, auth = {}, requestMeta = {}) {
  const access = await BreakGlassAccess.findById(accessId);
  if (!access) throw ApiError.notFound('Không tìm thấy break-glass access.');
  access.metadata = {
    ...(access.metadata || {}),
    review_status: payload.review_status || 'reviewed',
    reviewed_by: getActorId(auth),
    reviewed_at: new Date(),
    review_note: payload.review_note || payload.note,
  };
  await access.save();
  await auditService.recordAuditLog({
    actor: auth,
    action: 'security.break_glass.review',
    targetType: 'break_glass_access',
    targetId: access._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Break-glass reviewed in Security Center.',
    requestMeta,
    metadata: access.metadata,
  });
  return access.toObject();
}

async function listConsents(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.consent_type) filter.consent_type = query.consent_type;
  if (query.patient_id && isValidObjectId(query.patient_id)) filter.patient_id = query.patient_id;
  Object.assign(filter, buildDateFilter('created_at', query));
  const [items, total] = await Promise.all([
    ConsentRecord.find(filter).sort({ signed_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    ConsentRecord.countDocuments(filter),
  ]);
  return { items, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function consentSummary() {
  const [active, revoked, expired, expiringSoon] = await Promise.all([
    ConsentRecord.countDocuments({ status: CONSENT_STATUS.ACTIVE }),
    ConsentRecord.countDocuments({ status: CONSENT_STATUS.REVOKED }),
    ConsentRecord.countDocuments({ status: CONSENT_STATUS.EXPIRED }),
    ConsentRecord.countDocuments({ status: CONSENT_STATUS.ACTIVE, expires_at: { $lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), $gte: now() } }),
  ]);
  return { active, revoked, expired, expiring_soon: expiringSoon };
}

async function revokeConsent(consentId, payload = {}, auth = {}, requestMeta = {}) {
  const record = await ConsentRecord.findById(consentId);
  if (!record) throw ApiError.notFound('Không tìm thấy consent.');
  record.status = CONSENT_STATUS.REVOKED;
  record.revoked_at = new Date();
  record.metadata = {
    ...(record.metadata || {}),
    revoked_reason: payload.reason || payload.revoked_reason || 'security_center_revoke',
    revoked_by: getActorId(auth),
  };
  await record.save();
  await auditService.recordAuditLog({
    actor: auth,
    action: 'security.consent.revoke',
    targetType: 'consent_record',
    targetId: record._id,
    status: AUDIT_STATUS.SUCCESS,
    severity: AUDIT_SEVERITY.WARNING,
    message: 'Consent revoked from Security Center.',
    requestMeta,
    metadata: record.metadata,
  });
  return record.toObject();
}

async function listPatientAuthorizations(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.authorization_type) filter.authorization_type = query.authorization_type;
  if (query.patient_id && isValidObjectId(query.patient_id)) filter.patient_id = query.patient_id;
  if (query.relative_id && isValidObjectId(query.relative_id)) filter.relative_id = query.relative_id;
  Object.assign(filter, buildDateFilter('created_at', query));
  const [items, total] = await Promise.all([
    PatientAuthorization.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    PatientAuthorization.countDocuments(filter),
  ]);
  return { items, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function patientAuthorizationSummary() {
  const [pending, active, revoked, expired, expiringSoon] = await Promise.all([
    PatientAuthorization.countDocuments({ status: AUTHORIZATION_STATUS.PENDING, is_deleted: false }),
    PatientAuthorization.countDocuments({ status: AUTHORIZATION_STATUS.ACTIVE, is_deleted: false }),
    PatientAuthorization.countDocuments({ status: AUTHORIZATION_STATUS.REVOKED, is_deleted: false }),
    PatientAuthorization.countDocuments({ status: AUTHORIZATION_STATUS.EXPIRED, is_deleted: false }),
    PatientAuthorization.countDocuments({ status: AUTHORIZATION_STATUS.ACTIVE, is_deleted: false, valid_to: { $lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), $gte: now() } }),
  ]);
  return { pending, active, revoked, expired, expiring_soon: expiringSoon };
}

async function approvePatientAuthorization(authorizationId, auth = {}, requestMeta = {}) {
  return patientService.approvePatientAuthorization(authorizationId, auth, requestMeta);
}

async function revokePatientAuthorization(authorizationId, payload = {}, auth = {}, requestMeta = {}) {
  return patientService.revokePatientAuthorization(authorizationId, payload.reason || payload.revoke_reason, auth, requestMeta);
}

async function listAccessDecisions(query = {}) {
  return listAuditLike(query, ACCESS_DECISION_ACTIONS);
}

async function listSensitiveAccessEvents(query = {}) {
  return listAuditLike(query, SENSITIVE_ACTIONS);
}

async function listRateLimitEvents(query = {}) {
  return rateLimitEventService.listRateLimitEvents(query);
}

async function rateLimitSummary(query = {}) {
  return rateLimitEventService.getRateLimitSummary(query);
}

async function listDataAccessPolicies(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.resource_type) filter.resource_type = query.resource_type;
  const items = await SecurityDataAccessPolicy.find(filter).sort({ resource_type: 1, action: 1 }).lean();
  return {
    items: items.length ? items : DEFAULT_DATA_ACCESS_POLICIES,
  };
}

async function createDataAccessPolicy(payload = {}, auth = {}) {
  if (!payload.policy_key || !payload.resource_type || !payload.action) {
    throw ApiError.validation('policy_key, resource_type và action là bắt buộc.');
  }
  const policy = await SecurityDataAccessPolicy.create({
    ...payload,
    created_by: getActorId(auth),
    updated_by: getActorId(auth),
  });
  return policy.toObject();
}

async function updateDataAccessPolicy(policyId, payload = {}, auth = {}) {
  const policy = await SecurityDataAccessPolicy.findById(policyId);
  if (!policy) throw ApiError.notFound('Không tìm thấy data access policy.');
  Object.assign(policy, payload, { updated_by: getActorId(auth) });
  await policy.save();
  return policy.toObject();
}

async function publishDataAccessPolicy(policyId, auth = {}) {
  return updateDataAccessPolicy(policyId, { status: 'published', published_at: new Date(), version: Date.now() }, auth);
}

async function archiveDataAccessPolicy(policyId, auth = {}) {
  return updateDataAccessPolicy(policyId, { status: 'archived', archived_at: new Date() }, auth);
}

module.exports = {
  dashboard,
  listSessions,
  getSessionDetail,
  revokeSession,
  revokeSessionFamilyBySessionId,
  revokeTokenFamily,
  bulkRevokePreview,
  bulkRevokeSessions,
  listLoginHistory,
  loginSummary,
  listSuspiciousIps,
  listDevices,
  listRiskyAccounts,
  listTokenFamilies,
  getTokenFamily,
  listBreakGlass,
  reviewBreakGlass,
  listConsents,
  consentSummary,
  revokeConsent,
  listPatientAuthorizations,
  patientAuthorizationSummary,
  approvePatientAuthorization,
  revokePatientAuthorization,
  listAccessDecisions,
  listSensitiveAccessEvents,
  listRateLimitEvents,
  rateLimitSummary,
  listDataAccessPolicies,
  createDataAccessPolicy,
  updateDataAccessPolicy,
  publishDataAccessPolicy,
  archiveDataAccessPolicy,
};
