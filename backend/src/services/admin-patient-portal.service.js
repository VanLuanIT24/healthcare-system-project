const { Types } = require('mongoose');
const {
  Attachment,
  AttachmentAccessLog,
  AuditLog,
  AuthSession,
  DocumentExportRequest,
  InsurancePolicy,
  NotificationDelivery,
  Patient,
  PatientAccount,
  PatientAuthorization,
  PatientProfileChangeRequest,
  PatientRelative,
  PortalFeatureFlag,
  PortalProfileFieldPolicy,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ACTOR_TYPE,
  ATTACHMENT_STATUS,
  AUTHORIZATION_STATUS,
  DOCUMENT_EXPORT_STATUS,
  DOCUMENT_REVIEW_STATUS,
  DOCUMENT_SOURCE,
  INSURANCE_POLICY_SOURCE,
  INSURANCE_VERIFICATION_STATUS,
  PATIENT_ACCOUNT_STATUS,
  PATIENT_PROFILE_CHANGE_STATUS,
  RELATIVE_STATUS,
} = require('../constants/statuses');
const actorContext = require('../common/actors');
const authSessionService = require('./auth/auth-session.service');
const insuranceSelfService = require('./insurance-self-service.service');
const patientService = require('./patient.service');
const portalService = require('./portal.service');
const recordsService = require('./records.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const PROFILE_FIELD_POLICY_DEFAULTS = [
  ['full_name', 'basic_info', 'Họ và tên', true, true, true, true, 'critical', [PERMISSION.PATIENTS.UPDATE_SENSITIVE], 24],
  ['date_of_birth', 'basic_info', 'Ngày sinh', true, true, true, true, 'critical', [PERMISSION.PATIENTS.UPDATE_SENSITIVE], 24],
  ['gender', 'basic_info', 'Giới tính', true, true, false, false, 'medium', [PERMISSION.PATIENTS.UPDATE], 24],
  ['phone', 'contact', 'Số điện thoại', true, true, false, false, 'medium', [PERMISSION.PATIENTS.UPDATE_BASIC], 12],
  ['email', 'contact', 'Email', true, true, false, false, 'medium', [PERMISSION.PATIENTS.UPDATE_BASIC], 12],
  ['address', 'address', 'Địa chỉ', true, true, false, false, 'low', [PERMISSION.PATIENTS.UPDATE_BASIC], 24],
  ['national_id', 'identity', 'CCCD/CMND', true, true, true, true, 'critical', [PERMISSION.PATIENTS.UPDATE_SENSITIVE], 24],
  ['insurance_number', 'identity', 'Số bảo hiểm', true, true, true, true, 'high', [PERMISSION.PATIENTS.UPDATE_SENSITIVE], 24],
  ['emergency_contact_name', 'emergency_contact', 'Người liên hệ khẩn cấp', true, true, false, false, 'medium', [PERMISSION.PATIENTS.UPDATE_BASIC], 12],
  ['emergency_contact_phone', 'emergency_contact', 'SĐT liên hệ khẩn cấp', true, true, false, false, 'medium', [PERMISSION.PATIENTS.UPDATE_BASIC], 12],
];

const FEATURE_FLAG_DEFAULTS = [
  ['portal.account.registration', 'Cho bệnh nhân đăng ký tài khoản', 'account_login', true, 'medium'],
  ['portal.account.google_oauth', 'Cho Google OAuth', 'account_login', true, 'high'],
  ['portal.account.require_email_verified', 'Bắt buộc email verified', 'account_login', false, 'medium'],
  ['portal.account.require_phone_verified', 'Bắt buộc phone verified', 'account_login', false, 'medium'],
  ['portal.profile.change_requests', 'Cho gửi yêu cầu đổi hồ sơ', 'profile', true, 'high'],
  ['portal.profile.identity_change', 'Cho đổi thông tin định danh', 'profile', true, 'critical'],
  ['portal.documents.upload', 'Cho upload tài liệu', 'documents', true, 'high'],
  ['portal.documents.export_zip', 'Cho xuất ZIP hồ sơ', 'documents', true, 'high'],
  ['portal.documents.require_clean_scan', 'Bắt buộc virus scan clean', 'documents', true, 'critical'],
  ['portal.relatives.manage', 'Cho thêm người thân', 'relatives_authorization', true, 'high'],
  ['portal.authorizations.staff_approval_required', 'Bắt buộc duyệt ủy quyền', 'relatives_authorization', true, 'critical'],
  ['portal.insurance.self_submit', 'Cho gửi bảo hiểm', 'insurance', true, 'high'],
  ['portal.communication.email_notification', 'Email notification', 'communication', true, 'medium'],
  ['portal.communication.push_notification', 'Push notification', 'communication', false, 'medium'],
];

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function isObjectId(value) {
  return Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value, field = 'id') {
  if (!isObjectId(value)) throw createError(`${field} không hợp lệ.`, 400);
  return new Types.ObjectId(String(value));
}

function actorId(actor = {}) {
  return actorContext.getActorId(actor) || actor.userId || actor.user_id || actor.id || null;
}

function nowMinus(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function dateRange(query = {}, field = 'created_at') {
  const range = {};
  const from = query.date_from || query.from;
  const to = query.date_to || query.to;
  if (from) {
    const parsed = new Date(from);
    if (Number.isNaN(parsed.getTime())) throw createError('date_from không hợp lệ.', 400);
    range.$gte = parsed;
  }
  if (to) {
    const parsed = new Date(to);
    if (Number.isNaN(parsed.getTime())) throw createError('date_to không hợp lệ.', 400);
    range.$lte = parsed;
  }
  return Object.keys(range).length ? { [field]: range } : {};
}

function buildKeywordOr(keyword, fields = []) {
  const normalized = normalizeString(keyword);
  if (!normalized) return null;
  const pattern = escapeRegex(normalized);
  return fields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } }));
}

function sortFromQuery(query = {}, allowed = ['created_at', 'updated_at'], fallback = 'created_at') {
  const requested = normalizeString(query.sort_by || query.sortBy);
  const field = allowed.includes(requested) ? requested : fallback;
  const direction = String(query.sort_direction || query.sortDirection || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  return { [field]: direction };
}

function compact(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function mask(value, visible = 4) {
  if (!value) return null;
  const text = String(value);
  if (text.length <= visible) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(text.length - visible, 4))}${text.slice(-visible)}`;
}

function patientSummary(patient = {}) {
  if (!patient) return null;
  return {
    id: toId(patient._id || patient.id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    status: patient.status,
    identity_verified_at: patient.identity_verified_at,
  };
}

function relativeSummary(relative = {}) {
  if (!relative) return null;
  return {
    id: toId(relative._id || relative.id),
    full_name: relative.full_name,
    relationship: relative.relationship,
    phone: relative.phone,
    email: relative.email,
    national_id_masked: mask(relative.national_id),
    status: relative.status,
    relationship_verified: Boolean(relative.relationship_verified),
  };
}

function computeAccountRisk(account = {}, activeSessionCount = 0) {
  const reasons = [];
  let score = 0;
  const now = new Date();

  if ((account.failed_login_attempts || 0) >= 5) {
    score += 30;
    reasons.push('failed_login_attempts_high');
  }
  if (account.locked_until && account.locked_until > now) {
    score += 30;
    reasons.push('currently_locked');
  }
  if (!account.email_verified) {
    score += 10;
    reasons.push('email_unverified');
  }
  if (!account.phone_verified_at) {
    score += 10;
    reasons.push('phone_unverified');
  }
  if (account.password_expired_at && account.password_expired_at < now) {
    score += 20;
    reasons.push('password_expired');
  }
  if (account.last_login_at && account.last_login_at < nowMinus(90)) {
    score += 15;
    reasons.push('dormant_over_90_days');
  }
  if (!account.last_login_at) {
    score += 10;
    reasons.push('never_logged_in');
  }
  if (account.google_id && !account.email_verified) {
    score += 20;
    reasons.push('google_linked_email_unverified');
  }
  if (activeSessionCount > 5) {
    score += 15;
    reasons.push('many_active_sessions');
  }

  let level = 'low';
  if (score >= 75) level = 'critical';
  else if (score >= 45) level = 'high';
  else if (score >= 20) level = 'medium';

  return { risk_score: score, risk_level: level, risk_reasons: reasons };
}

async function countByStatus(Model, field, baseFilter = {}, statuses = []) {
  const rows = await Model.aggregate([
    { $match: baseFilter },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);
  const result = Object.fromEntries(statuses.map((status) => [status, 0]));
  rows.forEach((row) => {
    result[row._id || 'unknown'] = row.count;
  });
  return result;
}

async function sessionCountsForAccounts(accountIds = []) {
  const ids = accountIds.filter(Boolean).map((id) => toObjectId(id, 'account_id'));
  if (!ids.length) return new Map();
  const rows = await AuthSession.aggregate([
    {
      $match: {
        actor_type: ACTOR_TYPE.PATIENT,
        actor_id: { $in: ids },
        revoked_at: null,
        expires_at: { $gt: new Date() },
      },
    },
    { $group: { _id: '$actor_id', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [toId(row._id), row.count]));
}

async function serializeAccount(account = {}, activeSessionCount = 0) {
  const risk = computeAccountRisk(account, activeSessionCount);
  const now = new Date();
  return {
    id: toId(account._id || account.id),
    patient_id: toId(account.patient_id?._id || account.patient_id),
    patient: patientSummary(account.patient_id),
    username: account.username,
    email: account.email,
    phone: account.phone,
    status: account.status,
    last_login_at: account.last_login_at,
    last_login_ip: account.last_login_ip,
    password_changed_at: account.password_changed_at,
    password_expired_at: account.password_expired_at,
    failed_login_attempts: account.failed_login_attempts || 0,
    locked_until: account.locked_until,
    auth_provider: account.auth_provider,
    google_linked: Boolean(account.google_id),
    google_id_masked: mask(account.google_id, 6),
    avatar_url: account.avatar_url,
    email_verified: Boolean(account.email_verified),
    email_verified_at: account.email_verified_at,
    phone_verified_at: account.phone_verified_at,
    is_deleted: Boolean(account.is_deleted),
    created_at: account.created_at,
    updated_at: account.updated_at,
    password_history_count: Array.isArray(account.password_history) ? account.password_history.length : 0,
    active_session_count: activeSessionCount,
    days_since_last_login: account.last_login_at
      ? Math.floor((now.getTime() - new Date(account.last_login_at).getTime()) / (24 * 60 * 60 * 1000))
      : null,
    is_password_expired: Boolean(account.password_expired_at && account.password_expired_at < now),
    is_dormant: Boolean(!account.last_login_at || account.last_login_at < nowMinus(90)),
    ...risk,
  };
}

async function listAccounts(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.auth_provider) filter.auth_provider = query.auth_provider;
  if (query.email_verified !== undefined) filter.email_verified = String(query.email_verified) === 'true';
  if (query.phone_verified !== undefined) {
    filter.phone_verified_at = String(query.phone_verified) === 'true' ? { $ne: null } : { $in: [null, undefined] };
  }
  if (query.locked_only === 'true') filter.locked_until = { $gt: new Date() };
  if (query.failed_login_min) filter.failed_login_attempts = { $gte: Number(query.failed_login_min) || 0 };
  Object.assign(filter, dateRange(query));

  const keywordOr = buildKeywordOr(query.search || query.keyword || query.q, ['username', 'email', 'phone']);
  const patientFilter = {};
  if (keywordOr) {
    const patientKeywordOr = buildKeywordOr(query.search || query.keyword || query.q, ['full_name', 'patient_code', 'phone', 'email']);
    const patients = await Patient.find({ is_deleted: false, $or: patientKeywordOr }).select('_id').limit(200).lean();
    filter.$or = [...keywordOr, { patient_id: { $in: patients.map((patient) => patient._id) } }];
  }
  if (query.patient_id && isObjectId(query.patient_id)) filter.patient_id = toObjectId(query.patient_id, 'patient_id');

  const [items, total] = await Promise.all([
    PatientAccount.find({ ...filter, ...patientFilter })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status identity_verified_at')
      .sort(sortFromQuery(query, ['created_at', 'updated_at', 'last_login_at', 'failed_login_attempts'], 'created_at'))
      .skip(skip)
      .limit(limit)
      .lean(),
    PatientAccount.countDocuments({ ...filter, ...patientFilter }),
  ]);
  const sessions = await sessionCountsForAccounts(items.map((item) => item._id));
  const serialized = await Promise.all(items.map((item) => serializeAccount(item, sessions.get(toId(item._id)) || 0)));
  return { items: serialized, pagination: buildPagination(page, limit, total) };
}

async function getAccountsSummary() {
  const now = new Date();
  const base = { is_deleted: false };
  const [total, byStatus, emailUnverified, phoneUnverified, google, local, dormant, failedHigh] = await Promise.all([
    PatientAccount.countDocuments(base),
    countByStatus(PatientAccount, 'status', base, Object.values(PATIENT_ACCOUNT_STATUS)),
    PatientAccount.countDocuments({ ...base, email_verified: false }),
    PatientAccount.countDocuments({ ...base, $or: [{ phone_verified_at: null }, { phone_verified_at: { $exists: false } }] }),
    PatientAccount.countDocuments({ ...base, auth_provider: { $in: ['google', 'mixed'] } }),
    PatientAccount.countDocuments({ ...base, auth_provider: 'local' }),
    PatientAccount.countDocuments({ ...base, $or: [{ last_login_at: null }, { last_login_at: { $lt: nowMinus(90) } }] }),
    PatientAccount.countDocuments({ ...base, failed_login_attempts: { $gte: 5 } }),
  ]);
  return {
    total,
    active: byStatus.active || 0,
    pending_verification: byStatus.pending_verification || 0,
    locked: byStatus.locked || 0,
    disabled: byStatus.disabled || 0,
    email_unverified: emailUnverified,
    phone_unverified: phoneUnverified,
    google_oauth: google,
    local_password: local,
    dormant_over_90_days: dormant,
    failed_login_high: failedHigh,
    checked_at: now,
  };
}

async function getAccount(accountId) {
  const account = await PatientAccount.findOne({ _id: accountId, is_deleted: false })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status identity_verified_at')
    .lean();
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  const sessions = await sessionCountsForAccounts([account._id]);
  return serializeAccount(account, sessions.get(toId(account._id)) || 0);
}

async function updateAccount(accountId, payload = {}, actor = {}, requestMeta = {}) {
  const account = await PatientAccount.findOne({ _id: accountId, is_deleted: false });
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  const before = account.toObject();
  for (const field of ['username', 'email', 'phone']) {
    if (payload[field] !== undefined) account[field] = normalizeString(payload[field]) || undefined;
  }
  if (payload.email_verified !== undefined) {
    account.email_verified = Boolean(payload.email_verified);
    account.email_verified_at = account.email_verified ? new Date() : undefined;
  }
  if (payload.phone_verified !== undefined) {
    account.phone_verified_at = payload.phone_verified ? new Date() : undefined;
  }
  account.updated_by = actorId(actor);
  await account.save();
  await recordAuditLog({
    actor,
    action: 'patient_portal.account.update',
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Admin cập nhật tài khoản bệnh nhân.',
    requestMeta,
    before,
    after: account.toObject(),
  });
  return getAccount(account._id);
}

async function updateAccountStatus(accountId, status, actor = {}, requestMeta = {}, options = {}) {
  const account = await PatientAccount.findOne({ _id: accountId, is_deleted: false });
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  const before = account.toObject();
  account.status = status;
  account.updated_by = actorId(actor);
  if (status === PATIENT_ACCOUNT_STATUS.LOCKED) {
    const minutes = Number(options.lock_minutes || options.lockMinutes || 30);
    account.locked_until = new Date(Date.now() + Math.max(minutes, 1) * 60 * 1000);
  }
  if (status === PATIENT_ACCOUNT_STATUS.ACTIVE) {
    account.locked_until = undefined;
    account.failed_login_attempts = 0;
  }
  await account.save();
  if ([PATIENT_ACCOUNT_STATUS.LOCKED, PATIENT_ACCOUNT_STATUS.DISABLED].includes(status)) {
    await authSessionService.invalidateAllUserSessions(ACTOR_TYPE.PATIENT, account._id, requestMeta, {
      actorType: actor.actorType || actor.actor_type || ACTOR_TYPE.STAFF,
      actorId: actorId(actor),
      reason: `patient_portal_account_${status}`,
    });
  }
  await recordAuditLog({
    actor,
    action: `patient_portal.account.${status}`,
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: `Admin đổi trạng thái tài khoản bệnh nhân sang ${status}.`,
    requestMeta,
    before,
    after: account.toObject(),
    metadata: { reason: options.reason },
  });
  return getAccount(account._id);
}

async function resetAccountPassword(accountId, payload = {}, actor = {}, requestMeta = {}) {
  const account = await PatientAccount.findOne({ _id: accountId, is_deleted: false });
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  const before = account.toObject();
  account.password_expired_at = new Date();
  account.updated_by = actorId(actor);
  await account.save();
  const revoked = await authSessionService.invalidateAllUserSessions(ACTOR_TYPE.PATIENT, account._id, requestMeta, {
    actorType: actor.actorType || actor.actor_type || ACTOR_TYPE.STAFF,
    actorId: actorId(actor),
    reason: 'patient_portal_password_reset_required',
  });
  await recordAuditLog({
    actor,
    action: 'patient_portal.account.reset_password',
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Admin đánh dấu tài khoản bệnh nhân cần reset mật khẩu.',
    requestMeta,
    before,
    after: account.toObject(),
    metadata: { revoked_count: revoked.revoked_count || 0, reason: payload.reason },
  });
  return { account: await getAccount(account._id), revoked_count: revoked.revoked_count || 0 };
}

async function forceLogoutAccount(accountId, payload = {}, actor = {}, requestMeta = {}) {
  const account = await PatientAccount.findOne({ _id: accountId, is_deleted: false }).lean();
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  const result = await authSessionService.invalidateAllUserSessions(ACTOR_TYPE.PATIENT, account._id, requestMeta, {
    actorType: actor.actorType || actor.actor_type || ACTOR_TYPE.STAFF,
    actorId: actorId(actor),
    reason: payload.reason || 'patient_portal_force_logout',
  });
  await recordAuditLog({
    actor,
    action: 'patient_portal.account.force_logout',
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Admin force logout tài khoản bệnh nhân.',
    requestMeta,
    metadata: { revoked_count: result.revoked_count || 0, reason: payload.reason },
  });
  return { account_id: toId(account._id), revoked_count: result.revoked_count || 0 };
}

async function listAccountSessions(accountId, query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = { actor_type: ACTOR_TYPE.PATIENT, actor_id: toObjectId(accountId, 'account_id') };
  if (query.active === 'true') {
    filter.revoked_at = null;
    filter.expires_at = { $gt: new Date() };
  }
  const [items, total] = await Promise.all([
    AuthSession.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuthSession.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listAccountAudit(accountId, query = {}) {
  return listAudit({ ...query, actor_type: ACTOR_TYPE.PATIENT, actor_id: accountId, target_id: query.target_id || accountId });
}

function relativeFilter(query = {}) {
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.relationship) filter.relationship = query.relationship;
  if (query.relationship_verified !== undefined) filter.relationship_verified = String(query.relationship_verified) === 'true';
  if (query.patient_id && isObjectId(query.patient_id)) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  const keywordOr = buildKeywordOr(query.search || query.keyword || query.q, ['full_name', 'relationship', 'phone', 'email', 'national_id']);
  if (keywordOr) filter.$or = keywordOr;
  Object.assign(filter, dateRange(query));
  return filter;
}

async function listRelatives(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = relativeFilter(query);
  const [items, total] = await Promise.all([
    PatientRelative.find(filter)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
      .sort(sortFromQuery(query, ['created_at', 'updated_at', 'full_name'], 'created_at'))
      .skip(skip)
      .limit(limit)
      .lean(),
    PatientRelative.countDocuments(filter),
  ]);
  const authorizationCounts = await PatientAuthorization.aggregate([
    { $match: { relative_id: { $in: items.map((item) => item._id) }, is_deleted: false } },
    { $group: { _id: '$relative_id', active: { $sum: { $cond: [{ $eq: ['$status', AUTHORIZATION_STATUS.ACTIVE] }, 1, 0] } }, total: { $sum: 1 } } },
  ]);
  const countMap = new Map(authorizationCounts.map((row) => [toId(row._id), row]));
  return {
    items: items.map((item) => ({
      id: toId(item._id),
      patient_id: toId(item.patient_id?._id || item.patient_id),
      patient: patientSummary(item.patient_id),
      full_name: item.full_name,
      relationship: item.relationship,
      phone: item.phone,
      email: item.email,
      national_id_masked: mask(item.national_id),
      address: item.address,
      is_emergency_contact: Boolean(item.is_emergency_contact),
      is_primary_contact: Boolean(item.is_primary_contact),
      relationship_verified: Boolean(item.relationship_verified),
      verified_by: toId(item.verified_by),
      verified_at: item.verified_at,
      status: item.status,
      authorization_active_count: countMap.get(toId(item._id))?.active || 0,
      authorization_total_count: countMap.get(toId(item._id))?.total || 0,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getRelativesSummary() {
  const base = { is_deleted: false };
  const [total, byStatus, unverified, verified, emergency, primary, activeAuth, duplicatePhones, duplicateNationalIds] = await Promise.all([
    PatientRelative.countDocuments(base),
    countByStatus(PatientRelative, 'status', base, Object.values(RELATIVE_STATUS)),
    PatientRelative.countDocuments({ ...base, relationship_verified: false }),
    PatientRelative.countDocuments({ ...base, relationship_verified: true }),
    PatientRelative.countDocuments({ ...base, is_emergency_contact: true }),
    PatientRelative.countDocuments({ ...base, is_primary_contact: true }),
    PatientAuthorization.distinct('relative_id', { is_deleted: false, status: AUTHORIZATION_STATUS.ACTIVE }).then((ids) => ids.length),
    PatientRelative.aggregate([
      { $match: { ...base, phone: { $nin: [null, ''] } } },
      { $group: { _id: '$phone', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'count' },
    ]).then((rows) => rows[0]?.count || 0),
    PatientRelative.aggregate([
      { $match: { ...base, national_id: { $nin: [null, ''] } } },
      { $group: { _id: '$national_id', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'count' },
    ]).then((rows) => rows[0]?.count || 0),
  ]);
  return {
    total,
    active: byStatus.active || 0,
    inactive: byStatus.inactive || 0,
    blocked: byStatus.blocked || 0,
    relationship_unverified: unverified,
    relationship_verified: verified,
    emergency_contact: emergency,
    primary_contact: primary,
    has_active_authorization: activeAuth,
    duplicate_phone_groups: duplicatePhones,
    duplicate_national_id_groups: duplicateNationalIds,
  };
}

async function getRelative(relativeId) {
  const relative = await PatientRelative.findOne({ _id: relativeId, is_deleted: false })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
    .lean();
  if (!relative) throw createError('Không tìm thấy người thân bệnh nhân.', 404);
  const authorizations = await PatientAuthorization.find({ relative_id: relative._id, is_deleted: false }).sort({ created_at: -1 }).limit(20).lean();
  return { ...relativeSummary(relative), patient: patientSummary(relative.patient_id), authorizations };
}

async function updateRelative(relativeId, payload = {}, actor = {}, requestMeta = {}) {
  const relative = await PatientRelative.findOne({ _id: relativeId, is_deleted: false });
  if (!relative) throw createError('Không tìm thấy người thân bệnh nhân.', 404);
  const before = relative.toObject();
  for (const field of ['full_name', 'relationship', 'phone', 'email', 'national_id', 'address']) {
    if (payload[field] !== undefined) relative[field] = normalizeString(payload[field]) || undefined;
  }
  for (const field of ['is_emergency_contact', 'is_primary_contact']) {
    if (payload[field] !== undefined) relative[field] = Boolean(payload[field]);
  }
  relative.updated_by = actorId(actor);
  await relative.save();
  await recordAuditLog({ actor, action: 'patient_portal.relative.update', targetType: 'patient_relative', targetId: relative._id, status: 'success', message: 'Admin cập nhật người thân.', requestMeta, before, after: relative.toObject() });
  return getRelative(relative._id);
}

async function verifyRelative(relativeId, payload = {}, actor = {}, requestMeta = {}, verified = true) {
  const relative = await PatientRelative.findOne({ _id: relativeId, is_deleted: false });
  if (!relative) throw createError('Không tìm thấy người thân bệnh nhân.', 404);
  const before = relative.toObject();
  relative.relationship_verified = verified;
  relative.verified_by = verified ? actorId(actor) : undefined;
  relative.verified_at = verified ? new Date() : undefined;
  relative.updated_by = actorId(actor);
  await relative.save();
  await recordAuditLog({
    actor,
    action: verified ? 'patient_portal.relative.verify_relationship' : 'patient_portal.relative.unverify_relationship',
    targetType: 'patient_relative',
    targetId: relative._id,
    status: 'success',
    message: verified ? 'Admin xác minh quan hệ người thân.' : 'Admin hủy xác minh quan hệ người thân.',
    requestMeta,
    before,
    after: relative.toObject(),
    metadata: { note: payload.note, method: payload.verification_method },
  });
  return getRelative(relative._id);
}

async function setRelativeStatus(relativeId, status, actor = {}, requestMeta = {}, payload = {}) {
  const relative = await PatientRelative.findOne({ _id: relativeId, is_deleted: false });
  if (!relative) throw createError('Không tìm thấy người thân bệnh nhân.', 404);
  const before = relative.toObject();
  relative.status = status;
  relative.updated_by = actorId(actor);
  await relative.save();
  await recordAuditLog({ actor, action: `patient_portal.relative.${status}`, targetType: 'patient_relative', targetId: relative._id, status: 'success', message: `Admin đổi trạng thái người thân sang ${status}.`, requestMeta, before, after: relative.toObject(), metadata: { reason: payload.reason } });
  return getRelative(relative._id);
}

async function getRelativeDuplicates(query = {}) {
  const field = ['national_id', 'email'].includes(query.field) ? query.field : 'phone';
  const rows = await PatientRelative.aggregate([
    { $match: { is_deleted: false, [field]: { $nin: [null, ''] } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 }, relative_ids: { $push: '$_id' }, patient_ids: { $addToSet: '$patient_id' } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: Math.min(Number(query.limit || 50), 100) },
  ]);
  return { field, groups: rows };
}

async function authorizationFilter(query = {}) {
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.authorization_type) filter.authorization_type = query.authorization_type;
  if (query.patient_id && isObjectId(query.patient_id)) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.relative_id && isObjectId(query.relative_id)) filter.relative_id = toObjectId(query.relative_id, 'relative_id');
  if (query.expiring_days) {
    filter.valid_to = { $gte: new Date(), $lte: new Date(Date.now() + Number(query.expiring_days) * 24 * 60 * 60 * 1000) };
  }
  Object.assign(filter, dateRange(query));
  return filter;
}

async function listAuthorizations(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = await authorizationFilter(query);
  const [items, total] = await Promise.all([
    PatientAuthorization.find(filter)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
      .populate('relative_id', 'full_name relationship phone email national_id relationship_verified status')
      .sort(sortFromQuery(query, ['created_at', 'updated_at', 'valid_from', 'valid_to'], 'created_at'))
      .skip(skip)
      .limit(limit)
      .lean(),
    PatientAuthorization.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      id: toId(item._id),
      patient_id: toId(item.patient_id?._id || item.patient_id),
      relative_id: toId(item.relative_id?._id || item.relative_id),
      patient: patientSummary(item.patient_id),
      relative: relativeSummary(item.relative_id),
      authorization_type: item.authorization_type,
      permissions: item.permissions || [],
      valid_from: item.valid_from,
      valid_to: item.valid_to,
      approved_by: toId(item.approved_by),
      approved_at: item.approved_at,
      revoked_by: toId(item.revoked_by),
      revoked_at: item.revoked_at,
      revoke_reason: item.revoke_reason,
      status: item.status,
      is_expiring_soon: Boolean(item.valid_to && item.valid_to >= new Date() && item.valid_to <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getAuthorizationsSummary() {
  const base = { is_deleted: false };
  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [byStatus, expiring, full, billing, record, appointment] = await Promise.all([
    countByStatus(PatientAuthorization, 'status', base, Object.values(AUTHORIZATION_STATUS)),
    PatientAuthorization.countDocuments({ ...base, status: AUTHORIZATION_STATUS.ACTIVE, valid_to: { $gte: now, $lte: in7 } }),
    PatientAuthorization.countDocuments({ ...base, status: AUTHORIZATION_STATUS.ACTIVE, authorization_type: 'full_access' }),
    PatientAuthorization.countDocuments({ ...base, status: AUTHORIZATION_STATUS.ACTIVE, $or: [{ authorization_type: 'billing' }, { permissions: { $in: ['billing.read', 'billing.pay'] } }] }),
    PatientAuthorization.countDocuments({ ...base, status: AUTHORIZATION_STATUS.ACTIVE, $or: [{ authorization_type: 'view_records' }, { permissions: { $in: ['record.read', 'lab_result.read', 'imaging_report.read'] } }] }),
    PatientAuthorization.countDocuments({ ...base, status: AUTHORIZATION_STATUS.ACTIVE, $or: [{ authorization_type: 'book_appointments' }, { permissions: { $in: ['appointment.read', 'appointment.manage'] } }] }),
  ]);
  return {
    active: byStatus.active || 0,
    pending: byStatus.pending || 0,
    expiring_soon_7d: expiring,
    expired: byStatus.expired || 0,
    revoked: byStatus.revoked || 0,
    rejected: byStatus.rejected || 0,
    full_access: full,
    billing_access: billing,
    medical_record_access: record,
    appointment_access: appointment,
  };
}

async function getAuthorization(authorizationId) {
  const item = await PatientAuthorization.findOne({ _id: authorizationId, is_deleted: false })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
    .populate('relative_id', 'full_name relationship phone email national_id relationship_verified status')
    .lean();
  if (!item) throw createError('Không tìm thấy ủy quyền người thân.', 404);
  return item;
}

async function rejectAuthorization(authorizationId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.reason || payload.reject_reason);
  if (!reason) throw createError('reason là bắt buộc khi từ chối ủy quyền.', 422);
  const authorization = await PatientAuthorization.findOne({ _id: authorizationId, is_deleted: false });
  if (!authorization) throw createError('Không tìm thấy ủy quyền người thân.', 404);
  if (authorization.status !== AUTHORIZATION_STATUS.PENDING) throw createError('Chỉ ủy quyền pending mới được từ chối.', 409);
  const before = authorization.toObject();
  authorization.status = AUTHORIZATION_STATUS.REJECTED;
  authorization.revoked_by = actorId(actor);
  authorization.revoked_at = new Date();
  authorization.revoke_reason = reason;
  authorization.updated_by = actorId(actor);
  await authorization.save();
  await recordAuditLog({ actor, action: 'patient_portal.authorization.reject', targetType: 'patient_authorization', targetId: authorization._id, status: 'success', message: 'Admin từ chối ủy quyền người thân.', requestMeta, before, after: authorization.toObject(), metadata: { reason } });
  return getAuthorization(authorization._id);
}

async function extendAuthorization(authorizationId, payload = {}, actor = {}, requestMeta = {}) {
  const validTo = payload.valid_to || payload.validTo;
  if (!validTo) throw createError('valid_to là bắt buộc.', 422);
  const parsed = new Date(validTo);
  if (Number.isNaN(parsed.getTime())) throw createError('valid_to không hợp lệ.', 422);
  const authorization = await PatientAuthorization.findOne({ _id: authorizationId, is_deleted: false });
  if (!authorization) throw createError('Không tìm thấy ủy quyền người thân.', 404);
  const before = authorization.toObject();
  authorization.valid_to = parsed;
  if (authorization.status === AUTHORIZATION_STATUS.EXPIRED && parsed > new Date()) authorization.status = AUTHORIZATION_STATUS.ACTIVE;
  authorization.updated_by = actorId(actor);
  await authorization.save();
  await recordAuditLog({ actor, action: 'patient_portal.authorization.extend', targetType: 'patient_authorization', targetId: authorization._id, status: 'success', message: 'Admin gia hạn ủy quyền người thân.', requestMeta, before, after: authorization.toObject(), metadata: { reason: payload.reason } });
  return getAuthorization(authorization._id);
}

async function updateAuthorizationScopes(authorizationId, payload = {}, actor = {}, requestMeta = {}) {
  const permissions = Array.isArray(payload.permissions) ? payload.permissions.map(normalizeString).filter(Boolean) : null;
  if (!permissions) throw createError('permissions phải là mảng.', 422);
  const authorization = await PatientAuthorization.findOne({ _id: authorizationId, is_deleted: false });
  if (!authorization) throw createError('Không tìm thấy ủy quyền người thân.', 404);
  const before = authorization.toObject();
  authorization.permissions = permissions;
  if (payload.authorization_type) authorization.authorization_type = normalizeString(payload.authorization_type);
  authorization.updated_by = actorId(actor);
  await authorization.save();
  await recordAuditLog({ actor, action: 'patient_portal.authorization.update_scopes', targetType: 'patient_authorization', targetId: authorization._id, status: 'success', message: 'Admin cập nhật scope ủy quyền.', requestMeta, before, after: authorization.toObject(), metadata: { reason: payload.reason } });
  return getAuthorization(authorization._id);
}

async function getAuthorizationEffectiveAccess(authorizationId) {
  const authorization = await getAuthorization(authorizationId);
  const now = new Date();
  return {
    authorization_id: toId(authorization._id),
    status: authorization.status,
    active_now: authorization.status === AUTHORIZATION_STATUS.ACTIVE
      && authorization.valid_from <= now
      && (!authorization.valid_to || authorization.valid_to >= now),
    scopes: [...new Set([authorization.authorization_type, ...(authorization.permissions || [])].filter(Boolean))],
    valid_from: authorization.valid_from,
    valid_to: authorization.valid_to,
    patient: patientSummary(authorization.patient_id),
    relative: relativeSummary(authorization.relative_id),
  };
}

async function getAuthorizationAccessLogs(authorizationId, query = {}) {
  const authorization = await getAuthorization(authorizationId);
  return listAudit({
    ...query,
    actor_type: ACTOR_TYPE.PATIENT_RELATIVE,
    actor_id: toId(authorization.relative_id?._id || authorization.relative_id),
  });
}

async function bulkRevokeAuthorizations(payload = {}, actor = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.authorization_ids || payload.ids) ? (payload.authorization_ids || payload.ids) : [];
  const reason = normalizeString(payload.reason);
  if (!ids.length) throw createError('authorization_ids không được rỗng.', 422);
  if (!reason) throw createError('reason là bắt buộc khi bulk revoke.', 422);
  const results = [];
  for (const id of ids) {
    try {
      const item = await patientService.revokePatientAuthorization(id, reason, actor, requestMeta);
      results.push({ id, ok: true, item });
    } catch (error) {
      results.push({ id, ok: false, error: error.message });
    }
  }
  return { results };
}

function profileChangeRisk(request = {}) {
  const fields = Object.keys(request.new_value || {});
  const reasons = [];
  let score = 0;
  if (request.change_type === 'identity') {
    score += 60;
    reasons.push('identity_change');
  }
  if (fields.includes('date_of_birth') || fields.includes('national_id')) {
    score += 30;
    reasons.push('sensitive_identifier_changed');
  }
  if (fields.includes('phone') || fields.includes('email')) {
    score += 15;
    reasons.push('contact_channel_changed');
  }
  if (request.status === PATIENT_PROFILE_CHANGE_STATUS.PENDING && request.created_at < nowMinus(3)) {
    score += 15;
    reasons.push('sla_overdue');
  }
  let level = 'low';
  if (score >= 80) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 20) level = 'medium';
  return { risk_score: score, risk_level: level, risk_reasons: reasons, changed_fields: fields };
}

async function listProfileChangeRequests(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.change_type) filter.change_type = query.change_type;
  if (query.patient_id && isObjectId(query.patient_id)) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  Object.assign(filter, dateRange(query));
  const [items, total] = await Promise.all([
    PatientProfileChangeRequest.find(filter)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
      .sort(sortFromQuery(query, ['created_at', 'updated_at', 'reviewed_at'], 'created_at'))
      .skip(skip)
      .limit(limit)
      .lean(),
    PatientProfileChangeRequest.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      id: toId(item._id),
      patient_id: toId(item.patient_id?._id || item.patient_id),
      patient: patientSummary(item.patient_id),
      requested_by_actor: item.requested_by_actor,
      change_type: item.change_type,
      old_value_snapshot: item.old_value_snapshot,
      new_value: item.new_value,
      status: item.status,
      reviewed_by: item.reviewed_by,
      reviewed_at: item.reviewed_at,
      reason: item.reason,
      created_at: item.created_at,
      updated_at: item.updated_at,
      sla_due_at: new Date(new Date(item.created_at).getTime() + 24 * 60 * 60 * 1000),
      ...profileChangeRisk(item),
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getProfileChangeSummary() {
  const today = nowMinus(1);
  const base = {};
  const [byStatus, approvedToday, rejectedToday, overdue, identity, contact] = await Promise.all([
    countByStatus(PatientProfileChangeRequest, 'status', base, Object.values(PATIENT_PROFILE_CHANGE_STATUS)),
    PatientProfileChangeRequest.countDocuments({ status: PATIENT_PROFILE_CHANGE_STATUS.APPROVED, reviewed_at: { $gte: today } }),
    PatientProfileChangeRequest.countDocuments({ status: PATIENT_PROFILE_CHANGE_STATUS.REJECTED, reviewed_at: { $gte: today } }),
    PatientProfileChangeRequest.countDocuments({ status: PATIENT_PROFILE_CHANGE_STATUS.PENDING, created_at: { $lt: nowMinus(1) } }),
    PatientProfileChangeRequest.countDocuments({ change_type: 'identity', status: PATIENT_PROFILE_CHANGE_STATUS.PENDING }),
    PatientProfileChangeRequest.countDocuments({ change_type: 'contact', status: PATIENT_PROFILE_CHANGE_STATUS.PENDING }),
  ]);
  return {
    pending: byStatus.pending || 0,
    approved_today: approvedToday,
    rejected_today: rejectedToday,
    cancelled: byStatus.cancelled || 0,
    overdue_sla: overdue,
    identity_changes: identity,
    contact_changes: contact,
  };
}

async function getProfileChangeRequest(requestId) {
  const item = await PatientProfileChangeRequest.findById(requestId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone email address national_id insurance_number status')
    .lean();
  if (!item) throw createError('Không tìm thấy yêu cầu cập nhật hồ sơ.', 404);
  return { ...item, patient: patientSummary(item.patient_id), ...profileChangeRisk(item) };
}

async function reviewProfileChangeRequest(requestId, decision, payload = {}, actor = {}, requestMeta = {}) {
  const request = await PatientProfileChangeRequest.findById(requestId).lean();
  if (!request) throw createError('Không tìm thấy yêu cầu cập nhật hồ sơ.', 404);
  if (decision === 'approve') return portalService.approveProfileChangeRequest(request.patient_id, request._id, actor, payload, requestMeta);
  if (decision === 'reject') return portalService.rejectProfileChangeRequest(request.patient_id, request._id, actor, payload, requestMeta);
  throw createError('decision không hợp lệ.', 422);
}

async function requestMoreInfoForProfileChange(requestId, payload = {}, actor = {}, requestMeta = {}) {
  const request = await PatientProfileChangeRequest.findById(requestId);
  if (!request) throw createError('Không tìm thấy yêu cầu cập nhật hồ sơ.', 404);
  const before = request.toObject();
  request.reason = normalizeString(payload.message || payload.reason || 'Cần bổ sung thông tin trước khi duyệt.');
  await request.save();
  await recordAuditLog({ actor, action: 'patient_portal.profile_change.request_more_info', targetType: 'patient_profile_change_request', targetId: request._id, status: 'success', message: 'Admin yêu cầu bổ sung thông tin cho profile change.', requestMeta, before, after: request.toObject() });
  return getProfileChangeRequest(request._id);
}

async function assignProfileChangeRequest(requestId, payload = {}, actor = {}, requestMeta = {}) {
  const request = await PatientProfileChangeRequest.findById(requestId);
  if (!request) throw createError('Không tìm thấy yêu cầu cập nhật hồ sơ.', 404);
  await recordAuditLog({
    actor,
    action: 'patient_portal.profile_change.assign',
    targetType: 'patient_profile_change_request',
    targetId: request._id,
    status: 'success',
    message: 'Admin assign profile change request.',
    requestMeta,
    metadata: { assigned_to: payload.assigned_to || payload.assignedTo, note: payload.note },
  });
  return getProfileChangeRequest(request._id);
}

async function bulkReviewProfileChanges(payload = {}, decision, actor = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.request_ids || payload.ids) ? (payload.request_ids || payload.ids) : [];
  if (!ids.length) throw createError('request_ids không được rỗng.', 422);
  const results = [];
  for (const id of ids) {
    try {
      const item = await reviewProfileChangeRequest(id, decision, payload, actor, requestMeta);
      results.push({ id, ok: true, item });
    } catch (error) {
      results.push({ id, ok: false, error: error.message });
    }
  }
  return { results };
}

function documentFilter(query = {}) {
  const filter = {};
  if (query.patient_upload_only !== 'false') filter.source = DOCUMENT_SOURCE.PATIENT_UPLOAD;
  if (query.review_status) filter.review_status = query.review_status;
  if (query.scan_status) filter.scan_status = query.scan_status;
  if (query.category) filter.category = query.category;
  if (query.visibility) filter.visibility = query.visibility;
  if (query.status) filter.status = query.status;
  if (query.patient_id && isObjectId(query.patient_id)) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.released_to_patient !== undefined) filter.released_to_patient = String(query.released_to_patient) === 'true';
  const keywordOr = buildKeywordOr(query.search || query.keyword || query.q, ['file_name', 'original_name', 'category', 'description', 'mime_type', 'checksum', 'checksum_sha256']);
  if (keywordOr) filter.$or = keywordOr;
  Object.assign(filter, dateRange(query));
  return filter;
}

async function listDocuments(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = documentFilter(query);
  const [items, total] = await Promise.all([
    Attachment.find(filter)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
      .sort(sortFromQuery(query, ['created_at', 'updated_at', 'submitted_for_review_at', 'reviewed_at', 'file_size', 'download_count'], 'created_at'))
      .skip(skip)
      .limit(limit)
      .lean(),
    Attachment.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      id: toId(item._id),
      patient_id: toId(item.patient_id?._id || item.patient_id),
      patient: patientSummary(item.patient_id),
      entity_type: item.entity_type,
      entity_id: toId(item.entity_id),
      uploaded_by: toId(item.uploaded_by),
      file_name: item.file_name,
      original_name: item.original_name,
      mime_type: item.mime_type,
      file_size: item.file_size,
      storage_provider: item.storage_provider,
      storage_key_masked: mask(item.storage_key, 6),
      checksum: item.checksum,
      checksum_sha256: item.checksum_sha256,
      scan_status: item.scan_status,
      scan_result: item.scan_result,
      preview_url: item.preview_url,
      thumbnail_url: item.thumbnail_url,
      download_count: item.download_count,
      last_downloaded_at: item.last_downloaded_at,
      category: item.category,
      description: item.description,
      source: item.source,
      review_status: item.review_status,
      review_note: item.review_note,
      reviewed_by: toId(item.reviewed_by),
      reviewed_at: item.reviewed_at,
      submitted_for_review_at: item.submitted_for_review_at,
      visibility: item.visibility,
      released_to_patient: item.released_to_patient,
      released_at: item.released_at,
      status: item.status,
      archived_by_patient: item.archived_by_patient,
      archived_by_staff: item.archived_by_staff,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getDocumentsSummary() {
  const base = { source: DOCUMENT_SOURCE.PATIENT_UPLOAD };
  const [today, byReview, scanPending, scanFailed, scanInfected, archivedByPatient, deletedByPatient, insuranceDocs, identityDocs, externalDocs] = await Promise.all([
    Attachment.countDocuments({ ...base, created_at: { $gte: nowMinus(1) } }),
    countByStatus(Attachment, 'review_status', base, Object.values(DOCUMENT_REVIEW_STATUS)),
    Attachment.countDocuments({ ...base, scan_status: 'pending' }),
    Attachment.countDocuments({ ...base, scan_status: 'failed' }),
    Attachment.countDocuments({ ...base, scan_status: 'infected' }),
    Attachment.countDocuments({ ...base, archived_by_patient: true }),
    Attachment.countDocuments({ ...base, deleted_by: { $ne: null }, status: ATTACHMENT_STATUS.DELETED }),
    Attachment.countDocuments({ ...base, category: 'insurance_card' }),
    Attachment.countDocuments({ ...base, category: 'identity_card' }),
    Attachment.countDocuments({ ...base, category: { $in: ['external_lab_result', 'external_imaging_result', 'external_prescription'] } }),
  ]);
  return {
    uploaded_today: today,
    pending_review: byReview.pending || 0,
    accepted: byReview.accepted || 0,
    rejected: byReview.rejected || 0,
    scan_pending: scanPending,
    scan_failed: scanFailed,
    scan_infected: scanInfected,
    archived_by_patient: archivedByPatient,
    deleted_by_patient: deletedByPatient,
    insurance_documents: insuranceDocs,
    identity_documents: identityDocs,
    external_results: externalDocs,
  };
}

async function getDocument(documentId) {
  const document = await Attachment.findById(documentId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
    .lean();
  if (!document) throw createError('Không tìm thấy tài liệu.', 404);
  const [accessLogs, audit] = await Promise.all([
    AttachmentAccessLog.find({ attachment_id: document._id }).sort({ occurred_at: -1 }).limit(20).lean(),
    AuditLog.find({ target_type: 'attachment', target_id: document._id }).sort({ created_at: -1 }).limit(20).lean(),
  ]);
  return { ...document, patient: patientSummary(document.patient_id), access_logs: accessLogs, audit_logs: audit };
}

async function reviewDocument(documentId, accepted, payload = {}, actor = {}, requestMeta = {}) {
  return portalService.reviewPatientDocument(documentId, accepted, payload, actor, requestMeta);
}

async function rescanDocument(documentId, payload = {}, actor = {}, requestMeta = {}) {
  const document = await Attachment.findById(documentId);
  if (!document) throw createError('Không tìm thấy tài liệu.', 404);
  const before = document.toObject();
  document.scan_status = 'pending';
  document.scan_result = {
    requested_by: actorId(actor),
    requested_at: new Date(),
    reason: payload.reason,
    previous_scan_status: before.scan_status,
    previous_scan_result: before.scan_result,
  };
  document.updated_by = actorId(actor);
  await document.save();
  await AttachmentAccessLog.create({
    attachment_id: document._id,
    patient_id: document.patient_id,
    actor_type: ACTOR_TYPE.STAFF,
    actor_id: actorId(actor),
    action: 'rescan',
    result: 'success',
    ip: requestMeta.ipAddress || requestMeta.ip,
    user_agent: requestMeta.userAgent || requestMeta.user_agent,
    reason: payload.reason,
  });
  await recordAuditLog({ actor, action: 'patient_portal.document.rescan', targetType: 'attachment', targetId: document._id, status: 'success', message: 'Admin yêu cầu rescan tài liệu portal.', requestMeta, before, after: document.toObject() });
  return getDocument(document._id);
}

async function updateDocumentMetadata(documentId, payload = {}, actor = {}, requestMeta = {}) {
  const document = await Attachment.findById(documentId);
  if (!document) throw createError('Không tìm thấy tài liệu.', 404);
  const before = document.toObject();
  for (const field of ['category', 'description', 'visibility', 'review_note']) {
    if (payload[field] !== undefined) document[field] = normalizeString(payload[field]) || undefined;
  }
  if (payload.released_to_patient !== undefined) document.released_to_patient = Boolean(payload.released_to_patient);
  document.updated_by = actorId(actor);
  await document.save();
  await recordAuditLog({ actor, action: 'patient_portal.document.update_metadata', targetType: 'attachment', targetId: document._id, status: 'success', message: 'Admin cập nhật metadata tài liệu portal.', requestMeta, before, after: document.toObject() });
  return getDocument(document._id);
}

async function bulkReviewDocuments(payload = {}, accepted, actor = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.document_ids || payload.ids) ? (payload.document_ids || payload.ids) : [];
  if (!ids.length) throw createError('document_ids không được rỗng.', 422);
  const results = [];
  for (const id of ids) {
    try {
      const item = await reviewDocument(id, accepted, payload, actor, requestMeta);
      results.push({ id, ok: true, item });
    } catch (error) {
      results.push({ id, ok: false, error: error.message });
    }
  }
  return { results };
}

async function bulkRescanDocuments(payload = {}, actor = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.document_ids || payload.ids) ? (payload.document_ids || payload.ids) : [];
  if (!ids.length) throw createError('document_ids không được rỗng.', 422);
  const results = [];
  for (const id of ids) {
    try {
      const item = await rescanDocument(id, payload, actor, requestMeta);
      results.push({ id, ok: true, item });
    } catch (error) {
      results.push({ id, ok: false, error: error.message });
    }
  }
  return { results };
}

async function getDocumentAccessLogs(documentId, query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = { attachment_id: toObjectId(documentId, 'document_id') };
  const [items, total] = await Promise.all([
    AttachmentAccessLog.find(filter).sort({ occurred_at: -1 }).skip(skip).limit(limit).lean(),
    AttachmentAccessLog.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listDocumentExports(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.export_type) filter.export_type = query.export_type;
  if (query.patient_id && isObjectId(query.patient_id)) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  const keywordOr = buildKeywordOr(query.search || query.keyword || query.q, ['request_code']);
  if (keywordOr) filter.$or = keywordOr;
  Object.assign(filter, dateRange(query));
  const [items, total] = await Promise.all([
    DocumentExportRequest.find(filter)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
      .sort(sortFromQuery(query, ['created_at', 'updated_at', 'expires_at'], 'created_at'))
      .skip(skip)
      .limit(limit)
      .lean(),
    DocumentExportRequest.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      id: toId(item._id),
      request_code: item.request_code,
      patient_id: toId(item.patient_id?._id || item.patient_id),
      patient: patientSummary(item.patient_id),
      requested_by_actor_type: item.requested_by_actor_type,
      requested_by_actor_id: item.requested_by_actor_id,
      export_type: item.export_type,
      attachment_count: (item.selected_attachment_ids || []).length,
      selected_attachment_ids: item.selected_attachment_ids,
      status: item.status,
      file_url: item.file_url,
      expires_at: item.expires_at,
      metadata: item.metadata,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getDocumentExportsSummary() {
  const [today, byStatus, avgRows] = await Promise.all([
    DocumentExportRequest.countDocuments({ created_at: { $gte: nowMinus(1) } }),
    countByStatus(DocumentExportRequest, 'status', {}, Object.values(DOCUMENT_EXPORT_STATUS)),
    DocumentExportRequest.aggregate([
      { $match: { status: DOCUMENT_EXPORT_STATUS.READY, created_at: { $exists: true }, updated_at: { $exists: true } } },
      { $project: { duration_ms: { $subtract: ['$updated_at', '$created_at'] } } },
      { $group: { _id: null, avg_duration_ms: { $avg: '$duration_ms' } } },
    ]),
  ]);
  return {
    requests_today: today,
    pending: byStatus.pending || 0,
    processing: byStatus.processing || 0,
    ready: byStatus.ready || 0,
    failed: byStatus.failed || 0,
    expired: byStatus.expired || 0,
    average_processing_ms: Math.round(avgRows[0]?.avg_duration_ms || 0),
  };
}

async function getDocumentExport(exportId) {
  const item = await DocumentExportRequest.findById(exportId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
    .lean();
  if (!item) throw createError('Không tìm thấy yêu cầu xuất hồ sơ.', 404);
  const attachments = await Attachment.find({ _id: { $in: item.selected_attachment_ids || [] } }).select('file_name original_name category review_status scan_status file_size').lean();
  const logs = await AuditLog.find({ target_type: 'document_export_request', target_id: item._id }).sort({ created_at: -1 }).limit(30).lean();
  return { ...item, patient: patientSummary(item.patient_id), selected_attachments: attachments, logs };
}

async function updateDocumentExport(exportId, action, payload = {}, actor = {}, requestMeta = {}) {
  const item = await DocumentExportRequest.findById(exportId);
  if (!item) throw createError('Không tìm thấy yêu cầu xuất hồ sơ.', 404);
  const before = item.toObject();
  if (action === 'retry') {
    item.status = DOCUMENT_EXPORT_STATUS.PROCESSING;
    item.metadata = { ...(item.metadata || {}), admin_retry_at: new Date(), admin_retry_by: actorId(actor), admin_retry_reason: payload.reason };
  } else if (action === 'expire') {
    item.status = DOCUMENT_EXPORT_STATUS.EXPIRED;
    item.expires_at = new Date();
  } else if (action === 'extend') {
    const hours = Math.max(Number(payload.hours || payload.extend_hours || 72), 1);
    item.expires_at = new Date(Date.now() + hours * 60 * 60 * 1000);
    if (item.status === DOCUMENT_EXPORT_STATUS.EXPIRED) item.status = DOCUMENT_EXPORT_STATUS.READY;
  } else if (action === 'revoke') {
    item.status = DOCUMENT_EXPORT_STATUS.EXPIRED;
    item.file_url = undefined;
    item.expires_at = new Date();
    item.metadata = { ...(item.metadata || {}), revoked_at: new Date(), revoked_by: actorId(actor), revoke_reason: payload.reason };
  } else {
    throw createError('action không hợp lệ.', 422);
  }
  await item.save();
  await recordAuditLog({ actor, action: `patient_portal.document_export.${action}`, targetType: 'document_export_request', targetId: item._id, status: 'success', message: `Admin ${action} yêu cầu xuất hồ sơ.`, requestMeta, before, after: item.toObject() });
  return getDocumentExport(item._id);
}

async function getDocumentExportLogs(exportId, query = {}) {
  return listAudit({ ...query, target_type: 'document_export_request', target_id: exportId });
}

async function listInsuranceSubmissions(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = { source: INSURANCE_POLICY_SOURCE.PATIENT_SUBMITTED, is_deleted: false };
  if (query.verification_status) filter.verification_status = query.verification_status;
  if (query.patient_id && isObjectId(query.patient_id)) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  const keywordOr = buildKeywordOr(query.search || query.keyword || query.q, ['payer_name', 'payer_code', 'policy_no', 'member_no']);
  if (keywordOr) filter.$or = keywordOr;
  Object.assign(filter, dateRange(query));
  const [items, total] = await Promise.all([
    InsurancePolicy.find(filter)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
      .populate('front_card_attachment_id', 'file_name original_name preview_url thumbnail_url scan_status review_status')
      .populate('back_card_attachment_id', 'file_name original_name preview_url thumbnail_url scan_status review_status')
      .sort(sortFromQuery(query, ['created_at', 'updated_at', 'submitted_at', 'reviewed_at', 'valid_to'], 'created_at'))
      .skip(skip)
      .limit(limit)
      .lean(),
    InsurancePolicy.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      id: toId(item._id),
      patient_id: toId(item.patient_id?._id || item.patient_id),
      patient: patientSummary(item.patient_id),
      payer_name: item.payer_name,
      payer_code: item.payer_code,
      policy_no_masked: mask(item.policy_no, 4),
      member_no_masked: mask(item.member_no, 4),
      coverage_type: item.coverage_type,
      coverage_percent: item.coverage_percent,
      valid_from: item.valid_from,
      valid_to: item.valid_to,
      is_primary: item.is_primary,
      source: item.source,
      verification_status: item.verification_status,
      submitted_by_actor_type: item.submitted_by_actor_type,
      submitted_by_actor_id: item.submitted_by_actor_id,
      submitted_at: item.submitted_at,
      reviewed_by: toId(item.reviewed_by),
      reviewed_at: item.reviewed_at,
      rejection_reason: item.rejection_reason,
      front_card_attachment: item.front_card_attachment_id,
      back_card_attachment: item.back_card_attachment_id,
      missing_front_card: !item.front_card_attachment_id,
      missing_back_card: !item.back_card_attachment_id,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getInsuranceSubmissionsSummary() {
  const base = { source: INSURANCE_POLICY_SOURCE.PATIENT_SUBMITTED, is_deleted: false };
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [total, byStatus, expiring, missingFront, missingBack, duplicates] = await Promise.all([
    InsurancePolicy.countDocuments(base),
    countByStatus(InsurancePolicy, 'verification_status', base, Object.values(INSURANCE_VERIFICATION_STATUS)),
    InsurancePolicy.countDocuments({ ...base, valid_to: { $gte: new Date(), $lte: soon } }),
    InsurancePolicy.countDocuments({ ...base, $or: [{ front_card_attachment_id: null }, { front_card_attachment_id: { $exists: false } }] }),
    InsurancePolicy.countDocuments({ ...base, $or: [{ back_card_attachment_id: null }, { back_card_attachment_id: { $exists: false } }] }),
    InsurancePolicy.aggregate([
      { $match: { ...base, policy_no: { $nin: [null, ''] } } },
      { $group: { _id: '$policy_no', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'count' },
    ]).then((rows) => rows[0]?.count || 0),
  ]);
  return {
    total,
    draft: byStatus.draft || 0,
    submitted: byStatus.submitted || 0,
    pending_review: byStatus.pending_review || 0,
    verified: byStatus.verified || 0,
    rejected: byStatus.rejected || 0,
    expired: byStatus.expired || 0,
    expiring_30d: expiring,
    missing_front_card: missingFront,
    missing_back_card: missingBack,
    duplicate_policy_no_groups: duplicates,
  };
}

async function getInsuranceSubmission(policyId) {
  const policy = await InsurancePolicy.findById(policyId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone email status')
    .populate('front_card_attachment_id')
    .populate('back_card_attachment_id')
    .lean();
  if (!policy) throw createError('Không tìm thấy hồ sơ bảo hiểm.', 404);
  return { ...policy, patient: patientSummary(policy.patient_id) };
}

async function requestMoreInfoInsurance(policyId, payload = {}, actor = {}, requestMeta = {}) {
  const policy = await InsurancePolicy.findById(policyId);
  if (!policy) throw createError('Không tìm thấy hồ sơ bảo hiểm.', 404);
  await recordAuditLog({ actor, action: 'patient_portal.insurance.request_more_info', targetType: 'insurance_policy', targetId: policy._id, status: 'success', message: 'Admin yêu cầu bổ sung thông tin bảo hiểm.', requestMeta, metadata: { message: payload.message || payload.reason } });
  return getInsuranceSubmission(policy._id);
}

async function duplicateCheckInsurance(policyId) {
  const policy = await InsurancePolicy.findById(policyId).lean();
  if (!policy) throw createError('Không tìm thấy hồ sơ bảo hiểm.', 404);
  const duplicates = await InsurancePolicy.find({
    _id: { $ne: policy._id },
    is_deleted: false,
    $or: [
      { policy_no: policy.policy_no },
      ...(policy.member_no ? [{ member_no: policy.member_no }] : []),
    ],
  }).populate('patient_id', 'patient_code full_name date_of_birth gender phone email status').limit(20).lean();
  return { policy_id: toId(policy._id), duplicate_count: duplicates.length, duplicates };
}

async function ensureDefaultProfileFieldPolicies(actor = {}, requestMeta = {}) {
  const results = [];
  for (const [fieldName, group, label, patientEditable, requiresReview, requiresAttachment, sensitive, riskLevel, reviewerPermissions, slaHours] of PROFILE_FIELD_POLICY_DEFAULTS) {
    const updated = await PortalProfileFieldPolicy.findOneAndUpdate(
      { field_name: fieldName },
      {
        $setOnInsert: {
          field_name: fieldName,
          group,
          label,
          patient_editable: patientEditable,
          requires_review: requiresReview,
          requires_attachment: requiresAttachment,
          sensitive,
          risk_level: riskLevel,
          reviewer_permissions: reviewerPermissions,
          sla_hours: slaHours,
          enabled: true,
          created_by: actorId(actor),
        },
      },
      { upsert: true, new: true },
    ).lean();
    results.push(updated);
  }
  await recordAuditLog({ actor, action: 'patient_portal.profile_field_policy.rebuild_defaults', targetType: 'portal_profile_field_policy', status: 'success', message: 'Rebuild default portal profile field policies.', requestMeta });
  return { items: results };
}

async function listProfileFieldPolicies(query = {}) {
  if (query.rebuild_defaults === 'true') await ensureDefaultProfileFieldPolicies();
  const filter = {};
  if (query.group) filter.group = query.group;
  if (query.enabled !== undefined) filter.enabled = String(query.enabled) === 'true';
  if (query.sensitive !== undefined) filter.sensitive = String(query.sensitive) === 'true';
  return { items: await PortalProfileFieldPolicy.find(filter).sort({ group: 1, field_name: 1 }).lean() };
}

async function getProfileFieldPolicy(fieldName) {
  const policy = await PortalProfileFieldPolicy.findOne({ field_name: normalizeString(fieldName).toLowerCase() }).lean();
  if (!policy) throw createError('Không tìm thấy policy field hồ sơ.', 404);
  return policy;
}

async function updateProfileFieldPolicy(fieldName, payload = {}, actor = {}, requestMeta = {}) {
  const key = normalizeString(fieldName).toLowerCase();
  const policy = await PortalProfileFieldPolicy.findOne({ field_name: key });
  if (!policy) throw createError('Không tìm thấy policy field hồ sơ.', 404);
  const before = policy.toObject();
  const patch = compact({
    label: payload.label,
    group: payload.group,
    patient_editable: payload.patient_editable,
    requires_review: payload.requires_review,
    requires_attachment: payload.requires_attachment,
    sensitive: payload.sensitive,
    reviewer_permissions: payload.reviewer_permissions,
    sla_hours: payload.sla_hours,
    lock_when_verified: payload.lock_when_verified,
    enabled: payload.enabled,
    notification_template_key: payload.notification_template_key,
    risk_level: payload.risk_level,
  });
  Object.assign(policy, patch);
  policy.updated_by = actorId(actor);
  await policy.save();
  await recordAuditLog({ actor, action: 'patient_portal.profile_field_policy.update', targetType: 'portal_profile_field_policy', targetId: policy._id, status: 'success', message: 'Admin cập nhật portal profile field policy.', requestMeta, before, after: policy.toObject() });
  return policy.toObject();
}

async function ensureDefaultFeatureFlags(actor = {}, requestMeta = {}) {
  const results = [];
  for (const [key, name, group, enabled, riskLevel] of FEATURE_FLAG_DEFAULTS) {
    const updated = await PortalFeatureFlag.findOneAndUpdate(
      { key },
      {
        $setOnInsert: {
          key,
          name,
          group,
          enabled,
          rollout_percentage: enabled ? 100 : 0,
          risk_level: riskLevel,
          created_by: actorId(actor),
        },
      },
      { upsert: true, new: true },
    ).lean();
    results.push(updated);
  }
  await recordAuditLog({ actor, action: 'patient_portal.feature_flag.rebuild_defaults', targetType: 'portal_feature_flag', status: 'success', message: 'Rebuild default portal feature flags.', requestMeta });
  return { items: results };
}

async function listFeatureFlags(query = {}) {
  if (query.rebuild_defaults === 'true') await ensureDefaultFeatureFlags();
  const filter = {};
  if (query.group) filter.group = query.group;
  if (query.enabled !== undefined) filter.enabled = String(query.enabled) === 'true';
  if (query.risk_level) filter.risk_level = query.risk_level;
  return { items: await PortalFeatureFlag.find(filter).sort({ group: 1, key: 1 }).lean() };
}

async function getFeatureFlag(key) {
  const flag = await PortalFeatureFlag.findOne({ key: normalizeString(key).toLowerCase() }).lean();
  if (!flag) throw createError('Không tìm thấy portal feature flag.', 404);
  return flag;
}

async function updateFeatureFlag(key, payload = {}, actor = {}, requestMeta = {}) {
  const normalizedKey = normalizeString(key).toLowerCase();
  const flag = await PortalFeatureFlag.findOne({ key: normalizedKey });
  if (!flag) throw createError('Không tìm thấy portal feature flag.', 404);
  const before = flag.toObject();
  flag.last_value_snapshot = before;
  for (const field of ['name', 'description', 'group', 'enabled', 'value', 'rollout_percentage', 'scopes', 'dependencies', 'risk_level']) {
    if (payload[field] !== undefined) flag[field] = payload[field];
  }
  flag.updated_by = actorId(actor);
  flag.updated_at = new Date();
  await flag.save();
  await recordAuditLog({ actor, action: 'patient_portal.feature_flag.update', targetType: 'portal_feature_flag', targetId: flag._id, status: 'success', message: 'Admin cập nhật portal feature flag.', requestMeta, before, after: flag.toObject() });
  return flag.toObject();
}

async function rollbackFeatureFlag(key, actor = {}, requestMeta = {}) {
  const flag = await PortalFeatureFlag.findOne({ key: normalizeString(key).toLowerCase() });
  if (!flag) throw createError('Không tìm thấy portal feature flag.', 404);
  if (!flag.last_value_snapshot) throw createError('Feature flag chưa có snapshot để rollback.', 409);
  const before = flag.toObject();
  for (const field of ['name', 'description', 'group', 'enabled', 'value', 'rollout_percentage', 'scopes', 'dependencies', 'risk_level']) {
    if (flag.last_value_snapshot[field] !== undefined) flag[field] = flag.last_value_snapshot[field];
  }
  flag.updated_by = actorId(actor);
  flag.updated_at = new Date();
  await flag.save();
  await recordAuditLog({ actor, action: 'patient_portal.feature_flag.rollback', targetType: 'portal_feature_flag', targetId: flag._id, status: 'success', message: 'Rollback portal feature flag.', requestMeta, before, after: flag.toObject() });
  return flag.toObject();
}

async function importFeatureFlags(payload = {}, actor = {}, requestMeta = {}) {
  const flags = Array.isArray(payload.flags || payload.items) ? (payload.flags || payload.items) : [];
  if (!flags.length) throw createError('flags không được rỗng.', 422);
  const results = [];
  for (const flag of flags) {
    if (!flag.key) continue;
    const updated = await PortalFeatureFlag.findOneAndUpdate(
      { key: normalizeString(flag.key).toLowerCase() },
      {
        $set: {
          ...flag,
          key: normalizeString(flag.key).toLowerCase(),
          updated_by: actorId(actor),
          updated_at: new Date(),
        },
      },
      { upsert: true, new: true },
    ).lean();
    results.push(updated);
  }
  await recordAuditLog({ actor, action: 'patient_portal.feature_flag.import', targetType: 'portal_feature_flag', status: 'success', message: 'Import portal feature flags.', requestMeta, metadata: { count: results.length } });
  return { items: results };
}

async function exportFeatureFlags() {
  return { items: await PortalFeatureFlag.find({}).sort({ group: 1, key: 1 }).lean(), exported_at: new Date() };
}

function portalAuditFilter(query = {}) {
  const filter = {};
  Object.assign(filter, dateRange(query));
  if (query.actor_type) filter.actor_type = query.actor_type;
  if (query.actor_id) filter.actor_id = query.actor_id;
  if (query.action) filter.action = query.action;
  if (query.target_type) filter.target_type = query.target_type;
  if (query.target_id && isObjectId(query.target_id)) filter.target_id = toObjectId(query.target_id, 'target_id');
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  if (query.request_id) filter.request_id = query.request_id;
  if (query.sensitive_only === 'true') filter.severity = { $in: ['warning', 'critical'] };
  if (query.failed_only === 'true') filter.status = { $ne: 'success' };
  const keywordOr = buildKeywordOr(query.search || query.keyword || query.q, ['action', 'module_key', 'target_type', 'message', 'request_id', 'ip_address', 'user_agent']);
  if (keywordOr) filter.$or = keywordOr;
  if (!filter.action && !filter.target_type && query.portal_only !== 'false') {
    filter.$or = [
      ...(filter.$or || []),
      { action: { $regex: '^portal\\.', $options: 'i' } },
      { action: { $regex: '^patient_portal\\.', $options: 'i' } },
      { action: { $regex: '^patient_account\\.', $options: 'i' } },
      { action: { $regex: '^attachment\\.', $options: 'i' } },
      { action: { $regex: '^insurance_policy\\.', $options: 'i' } },
      { action: { $regex: '^auth\\.', $options: 'i' } },
      { target_type: { $in: ['patient_account', 'patient_relative', 'patient_authorization', 'patient_profile_change_request', 'attachment', 'document_export_request', 'insurance_policy'] } },
    ];
  }
  return filter;
}

async function listAudit(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = portalAuditFilter(query);
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort(sortFromQuery(query, ['created_at', 'action', 'actor_type', 'target_type', 'status', 'severity'], 'created_at'))
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getAuditSummary(query = {}) {
  const base = portalAuditFilter({ ...query, portal_only: query.portal_only || 'true' });
  const [today, loginSuccess, loginFailed, profile, uploads, downloads, insurance, relative, sensitive, suspicious] = await Promise.all([
    AuditLog.countDocuments({ ...base, created_at: { $gte: nowMinus(1) } }),
    AuditLog.countDocuments({ ...base, action: 'auth.login', actor_type: ACTOR_TYPE.PATIENT }),
    AuditLog.countDocuments({ ...base, action: 'auth.login_failed' }),
    AuditLog.countDocuments({ ...base, action: { $regex: 'profile_change', $options: 'i' } }),
    AuditLog.countDocuments({ ...base, action: { $regex: 'document|attachment.*upload', $options: 'i' } }),
    AttachmentAccessLog.countDocuments({ action: { $in: ['download', 'view'] }, occurred_at: { $gte: nowMinus(1) } }),
    AuditLog.countDocuments({ ...base, action: { $regex: 'insurance_policy', $options: 'i' } }),
    AuditLog.countDocuments({ ...base, action: { $regex: 'relative|authorization', $options: 'i' } }),
    AuditLog.countDocuments({ ...base, severity: { $in: ['warning', 'critical'] } }),
    AuditLog.countDocuments({ ...base, $or: [{ action: { $regex: 'suspicious|risk', $options: 'i' } }, { severity: 'critical' }] }),
  ]);
  return {
    portal_events_today: today,
    login_success: loginSuccess,
    login_failed: loginFailed,
    profile_changes: profile,
    document_uploads: uploads,
    document_downloads: downloads,
    insurance_submissions: insurance,
    relative_access_events: relative,
    sensitive_access_events: sensitive,
    suspicious_events: suspicious,
  };
}

async function getAudit(auditLogId) {
  const log = await AuditLog.findById(auditLogId).lean();
  if (!log) throw createError('Không tìm thấy audit log.', 404);
  return log;
}

async function exportAudit(query = {}, actor = {}, requestMeta = {}) {
  const result = await listAudit({ ...query, limit: query.limit || 1000 });
  await recordAuditLog({ actor, action: 'patient_portal.audit.export', targetType: 'audit_log', status: 'success', message: 'Export portal audit.', requestMeta, metadata: { count: result.items.length } });
  return { ...result, exported_at: new Date() };
}

async function getPatientAccessTimeline(patientId, query = {}) {
  const patientObjectId = toObjectId(patientId, 'patient_id');
  const [attachmentLogs, auditLogs] = await Promise.all([
    AttachmentAccessLog.find({ patient_id: patientObjectId }).sort({ occurred_at: -1 }).limit(Number(query.limit || 50)).lean(),
    AuditLog.find({ $or: [{ target_id: patientObjectId }, { 'metadata.patient_id': toId(patientObjectId) }] }).sort({ created_at: -1 }).limit(Number(query.limit || 50)).lean(),
  ]);
  return {
    patient_id: toId(patientObjectId),
    items: [
      ...attachmentLogs.map((item) => ({ type: 'attachment_access', occurred_at: item.occurred_at, item })),
      ...auditLogs.map((item) => ({ type: 'audit', occurred_at: item.created_at, item })),
    ].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)),
  };
}

async function getRelativeAccessHistory(relativeId, query = {}) {
  return listAudit({ ...query, actor_type: ACTOR_TYPE.PATIENT_RELATIVE, actor_id: relativeId });
}

async function getHealth() {
  const now = new Date();
  const [scanPending, scanFailed, exportFailed, exportProcessing, deliveryFailed, accountLocked, profilePending] = await Promise.all([
    Attachment.countDocuments({ source: DOCUMENT_SOURCE.PATIENT_UPLOAD, scan_status: 'pending' }),
    Attachment.countDocuments({ source: DOCUMENT_SOURCE.PATIENT_UPLOAD, scan_status: 'failed' }),
    DocumentExportRequest.countDocuments({ status: DOCUMENT_EXPORT_STATUS.FAILED }),
    DocumentExportRequest.countDocuments({ status: DOCUMENT_EXPORT_STATUS.PROCESSING }),
    NotificationDelivery.countDocuments({ status: 'failed' }),
    PatientAccount.countDocuments({ is_deleted: false, status: PATIENT_ACCOUNT_STATUS.LOCKED }),
    PatientProfileChangeRequest.countDocuments({ status: PATIENT_PROFILE_CHANGE_STATUS.PENDING }),
  ]);
  const components = [
    { code: 'portal_api', label: 'Portal API health', status: 'healthy', signal: 'Routes active' },
    { code: 'document_upload', label: 'Document upload', status: scanFailed > 0 ? 'warning' : 'healthy', signal: `${scanPending} pending scan, ${scanFailed} failed scan` },
    { code: 'notification_delivery', label: 'Notification delivery', status: deliveryFailed > 0 ? 'warning' : 'healthy', signal: `${deliveryFailed} failed deliveries` },
    { code: 'export_zip_worker', label: 'Export ZIP worker', status: exportFailed > 0 ? 'critical' : exportProcessing > 0 ? 'warning' : 'healthy', signal: `${exportProcessing} processing, ${exportFailed} failed` },
    { code: 'account_security', label: 'Account security', status: accountLocked > 0 ? 'warning' : 'healthy', signal: `${accountLocked} locked accounts` },
    { code: 'profile_review_queue', label: 'Profile review queue', status: profilePending > 20 ? 'warning' : 'healthy', signal: `${profilePending} pending requests` },
    { code: 'audit_logging', label: 'Audit logging', status: 'healthy', signal: 'AuditLog available' },
  ];
  const status = components.some((item) => item.status === 'critical')
    ? 'critical'
    : components.some((item) => item.status === 'warning')
      ? 'degraded'
      : 'healthy';
  return { status, components, checked_at: now };
}

async function getWorkQueue() {
  const [profile, documents, insurance, authorizations, exportsFailed, riskAccounts] = await Promise.all([
    PatientProfileChangeRequest.countDocuments({ status: PATIENT_PROFILE_CHANGE_STATUS.PENDING }),
    Attachment.countDocuments({ source: DOCUMENT_SOURCE.PATIENT_UPLOAD, review_status: DOCUMENT_REVIEW_STATUS.PENDING }),
    InsurancePolicy.countDocuments({ source: INSURANCE_POLICY_SOURCE.PATIENT_SUBMITTED, is_deleted: false, verification_status: { $in: [INSURANCE_VERIFICATION_STATUS.SUBMITTED, INSURANCE_VERIFICATION_STATUS.PENDING_REVIEW] } }),
    PatientAuthorization.countDocuments({ is_deleted: false, status: AUTHORIZATION_STATUS.PENDING }),
    DocumentExportRequest.countDocuments({ status: DOCUMENT_EXPORT_STATUS.FAILED }),
    PatientAccount.countDocuments({ is_deleted: false, $or: [{ failed_login_attempts: { $gte: 5 } }, { status: PATIENT_ACCOUNT_STATUS.LOCKED }] }),
  ]);
  return {
    items: [
      { type: 'profile_change_pending', label: 'Profile change pending', count: profile, sla_overdue: await PatientProfileChangeRequest.countDocuments({ status: PATIENT_PROFILE_CHANGE_STATUS.PENDING, created_at: { $lt: nowMinus(1) } }), route: '/admin/patient-portal/profile-change-requests' },
      { type: 'document_review_pending', label: 'Document review pending', count: documents, sla_overdue: await Attachment.countDocuments({ source: DOCUMENT_SOURCE.PATIENT_UPLOAD, review_status: DOCUMENT_REVIEW_STATUS.PENDING, submitted_for_review_at: { $lt: nowMinus(1) } }), route: '/admin/patient-portal/documents' },
      { type: 'insurance_submitted', label: 'Insurance submitted', count: insurance, sla_overdue: await InsurancePolicy.countDocuments({ source: INSURANCE_POLICY_SOURCE.PATIENT_SUBMITTED, is_deleted: false, verification_status: { $in: [INSURANCE_VERIFICATION_STATUS.SUBMITTED, INSURANCE_VERIFICATION_STATUS.PENDING_REVIEW] }, submitted_at: { $lt: nowMinus(1) } }), route: '/admin/patient-portal/insurance-submissions' },
      { type: 'authorization_pending', label: 'Authorization pending', count: authorizations, sla_overdue: await PatientAuthorization.countDocuments({ is_deleted: false, status: AUTHORIZATION_STATUS.PENDING, created_at: { $lt: nowMinus(1) } }), route: '/admin/patient-portal/authorizations' },
      { type: 'export_failed', label: 'Export failed', count: exportsFailed, sla_overdue: 0, route: '/admin/patient-portal/document-exports' },
      { type: 'risk_account', label: 'Risk account', count: riskAccounts, sla_overdue: 0, route: '/admin/patient-portal/accounts' },
    ],
  };
}

async function getDashboard() {
  const [
    accountSummary,
    profileSummary,
    documentSummary,
    insuranceSummary,
    authorizationSummary,
    exportSummary,
    auditSummary,
    workQueue,
    health,
  ] = await Promise.all([
    getAccountsSummary(),
    getProfileChangeSummary(),
    getDocumentsSummary(),
    getInsuranceSubmissionsSummary(),
    getAuthorizationsSummary(),
    getDocumentExportsSummary(),
    getAuditSummary({ portal_only: 'true' }),
    getWorkQueue(),
    getHealth(),
  ]);
  const recentAudit = await AuditLog.find(portalAuditFilter({ portal_only: 'true' })).sort({ created_at: -1 }).limit(12).lean();
  return {
    kpis: {
      active_accounts: accountSummary.active,
      locked_accounts: accountSummary.locked,
      risk_accounts: accountSummary.failed_login_high,
      profile_change_pending: profileSummary.pending,
      document_review_pending: documentSummary.pending_review,
      insurance_pending_review: insuranceSummary.submitted + insuranceSummary.pending_review,
      authorization_pending: authorizationSummary.pending,
      export_processing: exportSummary.processing,
      export_failed: exportSummary.failed,
      sensitive_access_today: auditSummary.sensitive_access_events,
    },
    account_summary: accountSummary,
    profile_summary: profileSummary,
    document_summary: documentSummary,
    insurance_summary: insuranceSummary,
    authorization_summary: authorizationSummary,
    export_summary: exportSummary,
    audit_summary: auditSummary,
    work_queue: workQueue.items,
    portal_health: health,
    realtime_activity: recentAudit,
    checked_at: new Date(),
  };
}

module.exports = {
  getDashboard,
  getWorkQueue,
  getHealth,

  listAccounts,
  getAccountsSummary,
  getAccount,
  updateAccount,
  lockAccount: (id, payload, actor, meta) => updateAccountStatus(id, PATIENT_ACCOUNT_STATUS.LOCKED, actor, meta, payload),
  unlockAccount: (id, actor, meta) => updateAccountStatus(id, PATIENT_ACCOUNT_STATUS.ACTIVE, actor, meta),
  disableAccount: (id, actor, meta) => updateAccountStatus(id, PATIENT_ACCOUNT_STATUS.DISABLED, actor, meta),
  enableAccount: (id, actor, meta) => updateAccountStatus(id, PATIENT_ACCOUNT_STATUS.ACTIVE, actor, meta),
  resetAccountPassword,
  forceLogoutAccount,
  resendVerification: async (id, payload = {}, actor = {}, meta = {}) => {
    await recordAuditLog({ actor, action: 'patient_portal.account.resend_verification', targetType: 'patient_account', targetId: id, status: 'success', message: 'Admin yêu cầu gửi lại xác thực tài khoản bệnh nhân.', requestMeta: meta, metadata: payload });
    return getAccount(id);
  },
  unlinkGoogle: async (id, payload = {}, actor = {}, meta = {}) => {
    const account = await PatientAccount.findOne({ _id: id, is_deleted: false });
    if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
    const before = account.toObject();
    account.google_id = undefined;
    account.auth_provider = account.password_hash ? 'local' : account.auth_provider;
    account.updated_by = actorId(actor);
    await account.save();
    await recordAuditLog({ actor, action: 'patient_portal.account.unlink_google', targetType: 'patient_account', targetId: account._id, status: 'success', message: 'Admin gỡ liên kết Google OAuth tài khoản bệnh nhân.', requestMeta: meta, before, after: account.toObject(), metadata: payload });
    return getAccount(account._id);
  },
  listAccountSessions,
  listAccountAudit,

  listRelatives,
  getRelativesSummary,
  getRelative,
  updateRelative,
  verifyRelative,
  unverifyRelative: (id, payload, actor, meta) => verifyRelative(id, payload, actor, meta, false),
  blockRelative: (id, payload, actor, meta) => setRelativeStatus(id, RELATIVE_STATUS.BLOCKED, actor, meta, payload),
  unblockRelative: (id, payload, actor, meta) => setRelativeStatus(id, RELATIVE_STATUS.ACTIVE, actor, meta, payload),
  getRelativeDuplicates,

  listAuthorizations,
  getAuthorizationsSummary,
  getAuthorization,
  approveAuthorization: (id, actor, meta) => patientService.approvePatientAuthorization(id, actor, meta),
  rejectAuthorization,
  revokeAuthorization: (id, payload, actor, meta) => patientService.revokePatientAuthorization(id, payload.reason || payload.revoke_reason, actor, meta),
  extendAuthorization,
  updateAuthorizationScopes,
  getAuthorizationEffectiveAccess,
  getAuthorizationAccessLogs,
  bulkRevokeAuthorizations,

  listProfileFieldPolicies,
  getProfileFieldPolicy,
  updateProfileFieldPolicy,
  ensureDefaultProfileFieldPolicies,
  listProfileFieldPoliciesAudit: (query) => listAudit({ ...query, target_type: 'portal_profile_field_policy' }),

  listProfileChangeRequests,
  getProfileChangeSummary,
  getProfileChangeRequest,
  approveProfileChangeRequest: (id, payload, actor, meta) => reviewProfileChangeRequest(id, 'approve', payload, actor, meta),
  rejectProfileChangeRequest: (id, payload, actor, meta) => reviewProfileChangeRequest(id, 'reject', payload, actor, meta),
  requestMoreInfoForProfileChange,
  assignProfileChangeRequest,
  bulkApproveProfileChanges: (payload, actor, meta) => bulkReviewProfileChanges(payload, 'approve', actor, meta),
  bulkRejectProfileChanges: (payload, actor, meta) => bulkReviewProfileChanges(payload, 'reject', actor, meta),

  listDocuments,
  getDocumentsSummary,
  getDocument,
  approveDocument: (id, payload, actor, meta) => reviewDocument(id, true, payload, actor, meta),
  rejectDocument: (id, payload, actor, meta) => reviewDocument(id, false, payload, actor, meta),
  rescanDocument,
  updateDocumentMetadata,
  getDocumentAccessLogs,
  bulkApproveDocuments: (payload, actor, meta) => bulkReviewDocuments(payload, true, actor, meta),
  bulkRejectDocuments: (payload, actor, meta) => bulkReviewDocuments(payload, false, actor, meta),
  bulkRescanDocuments,
  releaseDocument: (id, actor, meta) => recordsService.releaseAttachmentToPatient(id, actor, meta),
  revokeDocumentRelease: (id, payload, actor, meta) => recordsService.revokeAttachmentRelease(id, payload, actor, meta),

  listDocumentExports,
  getDocumentExportsSummary,
  getDocumentExport,
  retryDocumentExport: (id, payload, actor, meta) => updateDocumentExport(id, 'retry', payload, actor, meta),
  expireDocumentExport: (id, payload, actor, meta) => updateDocumentExport(id, 'expire', payload, actor, meta),
  extendDocumentExport: (id, payload, actor, meta) => updateDocumentExport(id, 'extend', payload, actor, meta),
  revokeDocumentExport: (id, payload, actor, meta) => updateDocumentExport(id, 'revoke', payload, actor, meta),
  getDocumentExportLogs,

  listInsuranceSubmissions,
  getInsuranceSubmissionsSummary,
  getInsuranceSubmission,
  verifyInsuranceSubmission: (id, payload, actor, meta) => insuranceSelfService.verifyInsurancePolicy(id, payload, actor, meta),
  rejectInsuranceSubmission: (id, payload, actor, meta) => insuranceSelfService.rejectInsurancePolicy(id, payload, actor, meta),
  requestMoreInfoInsurance,
  duplicateCheckInsurance,

  listFeatureFlags,
  getFeatureFlag,
  updateFeatureFlag,
  rollbackFeatureFlag,
  ensureDefaultFeatureFlags,
  importFeatureFlags,
  exportFeatureFlags,
  listFeatureFlagAudit: (key, query) => listAudit({ ...query, target_type: 'portal_feature_flag', keyword: key }),

  listAudit,
  getAuditSummary,
  getAudit,
  exportAudit,
  getPatientAccessTimeline,
  getRelativeAccessHistory,
};
