const { Types } = require('mongoose');
const {
  BankStatementTransaction,
  Invoice,
  Payment,
  PaymentIntent,
  ReconciliationBatch,
  ReconciliationException,
  ReconciliationMatch,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  PAYMENT_INTENT_STATUS,
  PAYMENT_PROVIDER,
  RECONCILIATION_BATCH_STATUS,
  RECONCILIATION_MATCH_STATUS,
  RECONCILIATION_MATCH_TYPE,
  RECONCILIATION_TRANSACTION_STATUS,
} = require('../constants/statuses');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const actorContext = require('../common/actors');
const paymentIntentService = require('./payment-intent.service');

const MANUAL_RECONCILIATION_PROVIDERS = [
  PAYMENT_PROVIDER.BANK_QR_MANUAL,
  PAYMENT_PROVIDER.BANK_QR,
  PAYMENT_PROVIDER.MOMO_PERSONAL_QR,
  PAYMENT_PROVIDER.CASH_MANUAL,
];

const ACTIVE_MATCH_INTENT_STATUSES = [
  PAYMENT_INTENT_STATUS.CREATED,
  PAYMENT_INTENT_STATUS.PENDING,
  PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
  PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
  PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
];

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function actorId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.id || null;
}

function actorPermissions(actor = {}) {
  return new Set(actor.permissions || []);
}

function hasPermission(actor = {}, permission) {
  const permissions = actorPermissions(actor);
  return permissions.has(permission) || permissions.has('*');
}

function assertReconciliationPermission(actor = {}, permissions = [], message = 'Tai khoan hien tai khong co quyen doi soat.') {
  if (actorContext.isSystem(actor)) return true;
  if (actorContext.getActorType(actor) !== 'staff') throw createError(message, 403);
  if (!permissions.some((permission) => hasPermission(actor, permission))) throw createError(message, 403);
  return true;
}

function toObjectId(value, fieldName = 'id') {
  if (!value || !Types.ObjectId.isValid(value)) throw createError(`${fieldName} khong hop le.`, 422);
  return new Types.ObjectId(value);
}

function normalizeOptionalDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} khong hop le.`, 422);
  return date;
}

function normalizeMoney(value, fieldName = 'amount', { allowZero = false } = {}) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw createError(`${fieldName} phai la integer minor units va ${allowZero ? '>= 0' : '> 0'}.`, 422);
  }
  return amount;
}

function auditEntry(action, actor = {}, metadata = {}) {
  return {
    action,
    actor_type: actorContext.getActorType(actor) || actor.actorType || 'system',
    actor_id: actorContext.getActorId(actor) || actorId(actor),
    at: new Date(),
    metadata,
  };
}

function serialize(document) {
  if (!document) return null;
  if (typeof document.toObject === 'function') return document.toObject();
  return document;
}

function addDateRange(filter, field, fromValue, toValue, label) {
  const from = normalizeOptionalDate(fromValue, `${label}_from`);
  const to = normalizeOptionalDate(toValue, `${label}_to`);
  if (from && to && from > to) throw createError(`${label} khong hop le.`, 422);
  if (from || to) {
    filter[field] = {};
    if (from) filter[field].$gte = from;
    if (to) filter[field].$lte = to;
  }
}

function transactionFilter(query = {}) {
  const filter = {};
  if (query.provider) filter.provider = query.provider;
  if (query.account_no) filter.account_no = query.account_no;
  if (query.match_status || query.status) filter.match_status = query.match_status || query.status;
  if (query.imported_batch_id || query.batch_id) {
    filter.imported_batch_id = toObjectId(query.imported_batch_id || query.batch_id, 'batch_id');
  }
  if (query.direction) filter.direction = query.direction;
  if (query.transaction_ref) filter.transaction_ref = new RegExp(escapeRegex(query.transaction_ref), 'i');
  if (query.detected_intent_code) filter.detected_intent_code = new RegExp(escapeRegex(query.detected_intent_code), 'i');
  const amountRange = {};
  if (query.amount_min !== undefined) amountRange.$gte = Number(query.amount_min);
  if (query.amount_max !== undefined) amountRange.$lte = Number(query.amount_max);
  if (Object.keys(amountRange).length) filter.amount = amountRange;
  addDateRange(filter, 'transaction_at', query.from_at || query.date_from, query.to_at || query.date_to, 'transaction_at');
  const keyword = normalizeString(query.keyword || query.q || query.search);
  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i');
    filter.$or = [
      { transaction_id: regex },
      { transaction_ref: regex },
      { description: regex },
      { counterparty_account_name: regex },
      { counterparty_account_no: regex },
      { detected_intent_code: regex },
      { detected_invoice_no: regex },
      { detected_patient_code: regex },
    ];
  }
  return filter;
}

function extractDetectedCodes(description = '') {
  const text = normalizeString(description).toUpperCase();
  const detected = {
    intent_code: undefined,
    invoice_no: undefined,
    patient_code: undefined,
  };
  const exactIntent = text.match(/MEDCARE-INV-\d{8}-\d{4}/);
  if (exactIntent) detected.intent_code = exactIntent[0];
  const noteIntent = text.match(/MEDCARE\s+(\d{8}-\d{4})/);
  if (!detected.intent_code && noteIntent) detected.intent_code = `MEDCARE-INV-${noteIntent[1]}`;
  const invoice = text.match(/\bINV[-A-Z0-9]{4,}\b/);
  if (invoice) detected.invoice_no = invoice[0];
  const patient = text.match(/\b(?:PAT|BN)[-A-Z0-9]{3,}\b/);
  if (patient) detected.patient_code = patient[0];
  return detected;
}

function normalizeImportedTransaction(item = {}, defaults = {}, index = 0) {
  const provider = normalizeString(item.provider || defaults.provider) || PAYMENT_PROVIDER.BANK_QR_MANUAL;
  const accountNo = normalizeString(item.account_no || item.accountNo || defaults.account_no);
  const transactionAt = normalizeOptionalDate(
    item.transaction_at || item.transactionAt || item.transacted_at || item.date || defaults.transaction_at,
    `transactions[${index}].transaction_at`,
  ) || new Date();
  const amount = normalizeMoney(item.amount, `transactions[${index}].amount`);
  const transactionRef = normalizeString(item.transaction_ref || item.transactionRef || item.reference || item.ref);
  const description = normalizeString(item.description || item.content || item.note || item.raw_description);
  const transactionId = normalizeString(
    item.transaction_id
    || item.transactionId
    || item.bank_transaction_id
    || item.bankTransactionId
    || transactionRef,
  ) || `${provider}:${accountNo || 'unknown'}:${transactionAt.getTime()}:${amount}:${index + 1}`;
  const detected = extractDetectedCodes(description || transactionRef);

  return {
    provider,
    bank_bin: normalizeString(item.bank_bin || item.bankBin || defaults.bank_bin),
    account_no: accountNo,
    transaction_id: transactionId,
    transaction_ref: transactionRef,
    amount,
    currency: normalizeString(item.currency || defaults.currency || 'VND').toUpperCase(),
    direction: normalizeString(item.direction || defaults.direction || 'credit') || 'credit',
    transaction_at: transactionAt,
    value_date: normalizeOptionalDate(item.value_date || item.valueDate, `transactions[${index}].value_date`),
    description,
    counterparty_account_no: normalizeString(item.counterparty_account_no || item.counterpartyAccountNo),
    counterparty_account_name: normalizeString(item.counterparty_account_name || item.counterpartyAccountName),
    raw_payload: item.raw_payload || item.rawPayload || item,
    detected_intent_code: normalizeString(item.detected_intent_code || item.detectedIntentCode || detected.intent_code),
    detected_invoice_no: normalizeString(item.detected_invoice_no || item.detectedInvoiceNo || detected.invoice_no),
    detected_patient_code: normalizeString(item.detected_patient_code || item.detectedPatientCode || detected.patient_code),
  };
}

async function refreshBatchTotals(batchId) {
  if (!batchId) return null;
  const batchObjectId = toObjectId(batchId, 'batch_id');
  const [summary] = await BankStatementTransaction.aggregate([
    { $match: { imported_batch_id: batchObjectId } },
    {
      $group: {
        _id: null,
        total_transactions: { $sum: 1 },
        total_amount: { $sum: '$amount' },
        matched_count: {
          $sum: { $cond: [{ $in: ['$match_status', [RECONCILIATION_TRANSACTION_STATUS.MATCHED, RECONCILIATION_TRANSACTION_STATUS.PARTIAL_MATCHED]] }, 1, 0] },
        },
        matched_amount: {
          $sum: { $cond: [{ $in: ['$match_status', [RECONCILIATION_TRANSACTION_STATUS.MATCHED, RECONCILIATION_TRANSACTION_STATUS.PARTIAL_MATCHED]] }, '$amount', 0] },
        },
        unmatched_count: {
          $sum: { $cond: [{ $eq: ['$match_status', RECONCILIATION_TRANSACTION_STATUS.UNMATCHED] }, 1, 0] },
        },
        unmatched_amount: {
          $sum: { $cond: [{ $eq: ['$match_status', RECONCILIATION_TRANSACTION_STATUS.UNMATCHED] }, '$amount', 0] },
        },
        mismatch_count: {
          $sum: { $cond: [{ $in: ['$match_status', [RECONCILIATION_TRANSACTION_STATUS.DISPUTED, RECONCILIATION_TRANSACTION_STATUS.PARTIAL_MATCHED]] }, 1, 0] },
        },
      },
    },
  ]);

  const update = summary || {
    total_transactions: 0,
    total_amount: 0,
    matched_count: 0,
    matched_amount: 0,
    unmatched_count: 0,
    unmatched_amount: 0,
    mismatch_count: 0,
  };
  return ReconciliationBatch.findByIdAndUpdate(batchObjectId, { $set: update }, { new: true }).lean();
}

async function createBatch(payload = {}, actor = {}, requestMeta = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.IMPORT, PERMISSION.PAYMENT_RECONCILIATION.MATCH]);
  const provider = normalizeString(payload.provider) || PAYMENT_PROVIDER.BANK_QR_MANUAL;
  const batch = await ReconciliationBatch.create({
    batch_no: await generateBusinessCode(CODE_TYPE.RECONCILIATION_BATCH, { separator: '-' }),
    provider,
    account_no: normalizeString(payload.account_no || payload.accountNo),
    from_at: normalizeOptionalDate(payload.from_at || payload.fromAt, 'from_at'),
    to_at: normalizeOptionalDate(payload.to_at || payload.toAt, 'to_at'),
    status: RECONCILIATION_BATCH_STATUS.DRAFT,
    notes: normalizeString(payload.notes || payload.note),
    created_by: actorId(actor),
    audit_logs: [auditEntry('reconciliation.batch_created', actor)],
  });
  await recordAuditLog({
    actor,
    action: 'reconciliation.batch_created',
    targetType: 'reconciliation_batch',
    targetId: batch._id,
    status: 'success',
    message: 'Tao batch doi soat thanh cong.',
    requestMeta,
  });
  return serialize(batch);
}

async function listBatches(query = {}, actor = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.provider) filter.provider = query.provider;
  if (query.account_no) filter.account_no = query.account_no;
  if (query.status) filter.status = query.status;
  addDateRange(filter, 'from_at', query.from_at || query.date_from, query.to_at || query.date_to, 'from_at');
  const keyword = normalizeString(query.keyword || query.q || query.search);
  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i');
    filter.$or = [{ batch_no: regex }, { provider: regex }, { account_no: regex }, { notes: regex }];
  }
  const [items, total] = await Promise.all([
    ReconciliationBatch.find(filter).sort({ from_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    ReconciliationBatch.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getBatchDetail(batchId, actor = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const batch = await ReconciliationBatch.findById(batchId).lean();
  if (!batch) throw createError('Khong tim thay batch doi soat.', 404);
  const latest_transactions = await BankStatementTransaction.find({ imported_batch_id: batch._id })
    .sort({ transaction_at: -1 })
    .limit(20)
    .lean();
  return { ...batch, latest_transactions };
}

async function importTransactions(payload = {}, actor = {}, requestMeta = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.IMPORT]);
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  if (!transactions.length) throw createError('transactions la bat buoc.', 400);

  let batch;
  if (payload.batch_id || payload.batchId) {
    batch = await ReconciliationBatch.findById(payload.batch_id || payload.batchId);
    if (!batch) throw createError('Khong tim thay batch doi soat.', 404);
  } else {
    batch = await ReconciliationBatch.create({
      batch_no: await generateBusinessCode(CODE_TYPE.RECONCILIATION_BATCH, { separator: '-' }),
      provider: normalizeString(payload.provider) || PAYMENT_PROVIDER.BANK_QR_MANUAL,
      account_no: normalizeString(payload.account_no || payload.accountNo),
      from_at: normalizeOptionalDate(payload.from_at || payload.fromAt, 'from_at'),
      to_at: normalizeOptionalDate(payload.to_at || payload.toAt, 'to_at'),
      status: RECONCILIATION_BATCH_STATUS.IMPORTED,
      notes: normalizeString(payload.notes || payload.note),
      created_by: actorId(actor),
      audit_logs: [auditEntry('reconciliation.batch_created_from_import', actor)],
    });
  }

  const defaults = {
    provider: payload.provider || batch.provider,
    account_no: payload.account_no || payload.accountNo || batch.account_no,
    bank_bin: payload.bank_bin || payload.bankBin,
    currency: payload.currency || 'VND',
  };
  const imported = [];
  const duplicates = [];

  for (let index = 0; index < transactions.length; index += 1) {
    const normalized = normalizeImportedTransaction(transactions[index], defaults, index);
    const existing = await BankStatementTransaction.findOne({ provider: normalized.provider, transaction_id: normalized.transaction_id });
    if (existing) {
      duplicates.push(serialize(existing));
      continue;
    }
    const transaction = await BankStatementTransaction.create({
      ...normalized,
      imported_batch_id: batch._id,
      imported_by: actorId(actor),
      imported_at: new Date(),
      audit_logs: [auditEntry('reconciliation.transaction_imported', actor, { batch_id: toId(batch._id) })],
    });
    imported.push(serialize(transaction));
  }

  batch.status = RECONCILIATION_BATCH_STATUS.IMPORTED;
  batch.audit_logs.push(auditEntry('reconciliation.transactions_imported', actor, {
    imported_count: imported.length,
    duplicate_count: duplicates.length,
  }));
  await batch.save();
  const updatedBatch = await refreshBatchTotals(batch._id);

  await recordAuditLog({
    actor,
    action: 'reconciliation.transactions_imported',
    targetType: 'reconciliation_batch',
    targetId: batch._id,
    status: 'success',
    message: 'Import sao ke doi soat thanh cong.',
    requestMeta,
    metadata: { imported_count: imported.length, duplicate_count: duplicates.length },
  });

  return {
    batch: updatedBatch || serialize(batch),
    imported,
    duplicates,
    summary: {
      requested: transactions.length,
      imported: imported.length,
      duplicates: duplicates.length,
    },
  };
}

async function listTransactions(query = {}, actor = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const { page, limit, skip } = getPagination(query);
  const filter = transactionFilter(query);
  const [items, total] = await Promise.all([
    BankStatementTransaction.find(filter)
      .sort({ transaction_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('matched_payment_intent_id', 'intent_code status amount payment_note provider method')
      .populate('matched_payment_id', 'payment_no status amount transaction_ref')
      .populate('matched_invoice_id', 'invoice_no status total_amount balance_due')
      .lean(),
    BankStatementTransaction.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getTransactionDetail(transactionId, actor = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const transaction = await BankStatementTransaction.findById(transactionId)
    .populate('matched_payment_intent_id')
    .populate('matched_payment_id')
    .populate('matched_invoice_id')
    .lean();
  if (!transaction) throw createError('Khong tim thay giao dich sao ke.', 404);
  const [matches, candidates] = await Promise.all([
    ReconciliationMatch.find({ bank_transaction_id: transaction._id }).sort({ created_at: -1 }).lean(),
    getTransactionCandidates(transaction._id, actor),
  ]);
  return { ...transaction, matches, candidates: candidates.items };
}

async function isTransactionRefUsed(transactionRef, transactionId = null) {
  if (!transactionRef) return false;
  const filter = {
    $or: [
      { transaction_ref: transactionRef },
      { transaction_reference: transactionRef },
      { provider_transaction_id: transactionRef },
    ],
  };
  const payment = await Payment.findOne(filter).select('_id payment_no').lean();
  if (payment) return true;
  const matched = await BankStatementTransaction.findOne({
    _id: { $ne: transactionId },
    match_status: { $in: [RECONCILIATION_TRANSACTION_STATUS.MATCHED, RECONCILIATION_TRANSACTION_STATUS.PARTIAL_MATCHED] },
    transaction_ref: transactionRef,
  }).select('_id').lean();
  return Boolean(matched);
}

function scoreIntentCandidate(transaction = {}, intent = {}, duplicateRef = false) {
  let score = 0;
  const reasons = [];
  const description = normalizeString(transaction.description).toUpperCase();
  const txRef = normalizeString(transaction.transaction_ref).toUpperCase();
  const intentCode = normalizeString(intent.intent_code).toUpperCase();
  const paymentNote = normalizeString(intent.payment_note).toUpperCase();

  if (intentCode && (description.includes(intentCode) || txRef.includes(intentCode))) {
    score += 50;
    reasons.push('description_contains_intent_code');
  } else if (paymentNote && description.includes(paymentNote)) {
    score += 50;
    reasons.push('description_contains_payment_note');
  } else if (transaction.detected_intent_code && intentCode === normalizeString(transaction.detected_intent_code).toUpperCase()) {
    score += 50;
    reasons.push('detected_intent_code_match');
  }

  if (Number(transaction.amount) === Number(intent.amount)) {
    score += 20;
    reasons.push('exact_amount');
  } else {
    score -= 30;
    reasons.push('amount_mismatch');
  }

  const transactionAt = transaction.transaction_at ? new Date(transaction.transaction_at).getTime() : null;
  const createdAt = intent.created_at ? new Date(intent.created_at).getTime() : null;
  const expiresAt = intent.expires_at ? new Date(intent.expires_at).getTime() : null;
  if (transactionAt && createdAt && (!expiresAt || transactionAt <= expiresAt + 60 * 60 * 1000) && transactionAt >= createdAt - 60 * 60 * 1000) {
    score += 10;
    reasons.push('within_payment_window');
  }

  if (transaction.account_no && intent.receiver_account_no && String(transaction.account_no) === String(intent.receiver_account_no)) {
    score += 10;
    reasons.push('receiver_account_match');
  }

  if (intent.invoice_id?.invoice_no && description.includes(String(intent.invoice_id.invoice_no).toUpperCase())) {
    score += 5;
    reasons.push('description_contains_invoice_no');
  }
  if (intent.patient_id?.patient_code && description.includes(String(intent.patient_id.patient_code).toUpperCase())) {
    score += 5;
    reasons.push('description_contains_patient_code');
  }
  if (duplicateRef) {
    score -= 50;
    reasons.push('duplicate_transaction_ref');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    difference_amount: Number(transaction.amount || 0) - Number(intent.amount || 0),
  };
}

async function getTransactionCandidates(transactionId, actor = {}) {
  assertReconciliationPermission(actor, [
    PERMISSION.PAYMENT_RECONCILIATION.READ,
    PERMISSION.PAYMENT_RECONCILIATION.MATCH,
    PERMISSION.PAYMENT_RECONCILIATION.AUTO_MATCH,
  ]);
  const transaction = await BankStatementTransaction.findById(transactionId).lean();
  if (!transaction) throw createError('Khong tim thay giao dich sao ke.', 404);

  const or = [
    { amount: transaction.amount },
    { transaction_reference: transaction.transaction_ref },
    { provider_transaction_id: transaction.transaction_ref },
  ];
  if (transaction.detected_intent_code) {
    or.push({ intent_code: transaction.detected_intent_code });
  }
  const description = normalizeString(transaction.description);
  if (description) {
    const detected = extractDetectedCodes(description);
    if (detected.intent_code) or.push({ intent_code: detected.intent_code });
    const compact = description.replace(/\s+/g, ' ').slice(0, 80);
    or.push({ payment_note: new RegExp(escapeRegex(compact), 'i') });
  }

  const intents = await PaymentIntent.find({
    provider: { $in: MANUAL_RECONCILIATION_PROVIDERS },
    status: { $in: ACTIVE_MATCH_INTENT_STATUSES },
    $or: or,
  })
    .sort({ created_at: -1 })
    .limit(30)
    .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due')
    .populate('patient_id', 'patient_code full_name phone')
    .lean();

  const duplicateRef = await isTransactionRefUsed(transaction.transaction_ref, transaction._id);
  const items = intents
    .map((intent) => {
      const score = scoreIntentCandidate(transaction, intent, duplicateRef);
      return {
        candidate_type: 'payment_intent',
        payment_intent: intent,
        invoice: intent.invoice_id,
        patient: intent.patient_id,
        confidence_score: score.score,
        reasons: score.reasons,
        difference_amount: score.difference_amount,
        recommended_action: score.score >= 90 && score.difference_amount === 0 ? 'confirm_match' : 'manual_review',
      };
    })
    .sort((left, right) => right.confidence_score - left.confidence_score);

  return { transaction, items };
}

async function createReconciliationException({ transaction, intent, type, severity = 'medium', reason }, actor = {}) {
  return ReconciliationException.create({
    exception_no: await generateBusinessCode(CODE_TYPE.RECONCILIATION_EXCEPTION, { separator: '-' }),
    batch_id: transaction.imported_batch_id,
    bank_transaction_id: transaction._id,
    payment_intent_id: intent?._id,
    invoice_id: intent?.invoice_id?._id || intent?.invoice_id,
    type,
    severity,
    expected_amount: Number(intent?.amount || 0),
    received_amount: Number(transaction.amount || 0),
    difference_amount: Number(transaction.amount || 0) - Number(intent?.amount || 0),
    reason,
    created_by: actorId(actor),
    audit_logs: [auditEntry('reconciliation.exception_created', actor, { reason })],
  });
}

async function matchTransactionToIntent(transactionId, payload = {}, actor = {}, requestMeta = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.MATCH, PERMISSION.PAYMENT_RECONCILIATION.APPROVE]);
  const transaction = await BankStatementTransaction.findById(transactionId);
  if (!transaction) throw createError('Khong tim thay giao dich sao ke.', 404);
  if (
    transaction.match_status !== RECONCILIATION_TRANSACTION_STATUS.UNMATCHED
    && !payload.force
  ) {
    throw createError('Giao dich da duoc xu ly. Bat force=true neu muon ghi de.', 409);
  }

  const intentId = payload.payment_intent_id || payload.intent_id || payload.intentId;
  const intent = await PaymentIntent.findById(intentId)
    .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due')
    .populate('patient_id', 'patient_code full_name phone');
  if (!intent) throw createError('Khong tim thay payment intent.', 404);

  const duplicateRef = await isTransactionRefUsed(transaction.transaction_ref, transaction._id);
  const score = scoreIntentCandidate(serialize(transaction), serialize(intent), duplicateRef);
  const match = await ReconciliationMatch.create({
    bank_transaction_id: transaction._id,
    payment_intent_id: intent._id,
    invoice_id: intent.invoice_id?._id || intent.invoice_id,
    match_type: payload.match_type || RECONCILIATION_MATCH_TYPE.MANUAL,
    match_status: payload.confirm_payment === false ? RECONCILIATION_MATCH_STATUS.PROPOSED : RECONCILIATION_MATCH_STATUS.CONFIRMED,
    confidence_score: payload.confidence_score ?? score.score,
    matched_amount: Number(transaction.amount || 0),
    difference_amount: score.difference_amount,
    reasons: payload.reasons || score.reasons,
    confirmed_by: payload.confirm_payment === false ? undefined : actorId(actor),
    confirmed_at: payload.confirm_payment === false ? undefined : new Date(),
    audit_logs: [auditEntry('reconciliation.match_created', actor, { transaction_id: toId(transaction._id), intent_id: toId(intent._id) })],
    created_by: actorId(actor),
  });

  let confirmation = null;
  let matchStatus = score.difference_amount === 0
    ? RECONCILIATION_TRANSACTION_STATUS.MATCHED
    : RECONCILIATION_TRANSACTION_STATUS.DISPUTED;
  if (payload.confirm_payment !== false) {
    const confirmationPayload = {
      transaction_ref: transaction.transaction_ref || transaction.transaction_id,
      received_amount: transaction.amount,
      received_at: transaction.transaction_at,
      note: normalizeString(payload.note) || `Reconciliation match ${transaction.transaction_id}`,
      mismatch_type: score.difference_amount < 0 ? 'amount_short' : (score.difference_amount > 0 ? 'amount_over' : undefined),
    };
    confirmation = [PAYMENT_PROVIDER.BANK_QR, PAYMENT_PROVIDER.BANK_QR_MANUAL].includes(intent.provider)
      ? await paymentIntentService.confirmBankTransfer(intent._id, confirmationPayload, actor, requestMeta)
      : await paymentIntentService.confirmManualPayment(intent._id, confirmationPayload, actor, requestMeta);
    if (confirmation.payment) {
      match.payment_id = confirmation.payment._id || confirmation.payment.id;
      await match.save();
    }
    if (confirmation.manual_review) {
      matchStatus = RECONCILIATION_TRANSACTION_STATUS.DISPUTED;
      await createReconciliationException({
        transaction,
        intent,
        type: score.difference_amount < 0 ? 'amount_short' : 'amount_over',
        severity: Math.abs(score.difference_amount) > 0 ? 'high' : 'medium',
        reason: confirmation.reason || 'Amount mismatch',
      }, actor);
    }
  }

  transaction.match_status = matchStatus;
  transaction.matched_payment_intent_id = intent._id;
  transaction.matched_invoice_id = intent.invoice_id?._id || intent.invoice_id;
  transaction.matched_payment_id = match.payment_id;
  transaction.confidence_score = payload.confidence_score ?? score.score;
  transaction.mismatch_reason = score.difference_amount === 0 ? undefined : 'amount_mismatch';
  transaction.reviewed_by = actorId(actor);
  transaction.reviewed_at = new Date();
  transaction.audit_logs.push(auditEntry('reconciliation.transaction_matched_intent', actor, {
    intent_id: toId(intent._id),
    confidence_score: transaction.confidence_score,
    difference_amount: score.difference_amount,
  }));
  await transaction.save();
  await refreshBatchTotals(transaction.imported_batch_id);

  await recordAuditLog({
    actor,
    action: 'reconciliation.transaction_matched_intent',
    targetType: 'bank_statement_transaction',
    targetId: transaction._id,
    status: 'success',
    message: 'Match giao dich sao ke voi payment intent thanh cong.',
    requestMeta,
    metadata: { payment_intent_id: toId(intent._id), difference_amount: score.difference_amount },
  });

  return {
    transaction: serialize(transaction),
    match: serialize(match),
    confirmation,
  };
}

async function matchTransactionToInvoice(transactionId, payload = {}, actor = {}, requestMeta = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.MATCH]);
  const transaction = await BankStatementTransaction.findById(transactionId);
  if (!transaction) throw createError('Khong tim thay giao dich sao ke.', 404);
  const invoice = await Invoice.findById(payload.invoice_id || payload.invoiceId).lean();
  if (!invoice) throw createError('Khong tim thay invoice.', 404);
  const differenceAmount = Number(transaction.amount || 0) - Number(invoice.balance_due || invoice.total_amount || 0);
  const match = await ReconciliationMatch.create({
    bank_transaction_id: transaction._id,
    invoice_id: invoice._id,
    match_type: payload.match_type || RECONCILIATION_MATCH_TYPE.MANUAL,
    match_status: RECONCILIATION_MATCH_STATUS.PROPOSED,
    confidence_score: Number(payload.confidence_score || 0),
    matched_amount: Number(transaction.amount || 0),
    difference_amount: differenceAmount,
    reasons: payload.reasons || ['manual_invoice_match'],
    created_by: actorId(actor),
    audit_logs: [auditEntry('reconciliation.invoice_match_proposed', actor, { invoice_id: toId(invoice._id) })],
  });
  transaction.match_status = differenceAmount === 0
    ? RECONCILIATION_TRANSACTION_STATUS.PARTIAL_MATCHED
    : RECONCILIATION_TRANSACTION_STATUS.DISPUTED;
  transaction.matched_invoice_id = invoice._id;
  transaction.confidence_score = Number(payload.confidence_score || 0);
  transaction.mismatch_reason = differenceAmount === 0 ? undefined : 'invoice_amount_difference';
  transaction.reviewed_by = actorId(actor);
  transaction.reviewed_at = new Date();
  transaction.audit_logs.push(auditEntry('reconciliation.transaction_matched_invoice', actor, { invoice_id: toId(invoice._id) }));
  await transaction.save();
  await refreshBatchTotals(transaction.imported_batch_id);
  await recordAuditLog({
    actor,
    action: 'reconciliation.transaction_matched_invoice',
    targetType: 'bank_statement_transaction',
    targetId: transaction._id,
    status: 'success',
    message: 'De xuat match giao dich sao ke voi invoice thanh cong.',
    requestMeta,
    metadata: { invoice_id: toId(invoice._id) },
  });
  return { transaction: serialize(transaction), match: serialize(match), invoice };
}

async function setTransactionStatus(transactionId, status, payload = {}, actor = {}, requestMeta = {}) {
  const permission = status === RECONCILIATION_TRANSACTION_STATUS.UNMATCHED
    ? PERMISSION.PAYMENT_RECONCILIATION.UNMATCH
    : PERMISSION.PAYMENT_RECONCILIATION.MATCH;
  assertReconciliationPermission(actor, [permission, PERMISSION.PAYMENT_RECONCILIATION.REJECT]);
  const transaction = await BankStatementTransaction.findById(transactionId);
  if (!transaction) throw createError('Khong tim thay giao dich sao ke.', 404);
  transaction.match_status = status;
  if (status === RECONCILIATION_TRANSACTION_STATUS.UNMATCHED) {
    transaction.matched_payment_intent_id = undefined;
    transaction.matched_payment_id = undefined;
    transaction.matched_invoice_id = undefined;
    transaction.confidence_score = 0;
  }
  transaction.mismatch_reason = normalizeString(payload.reason || payload.note) || transaction.mismatch_reason;
  transaction.reviewed_by = actorId(actor);
  transaction.reviewed_at = new Date();
  transaction.audit_logs.push(auditEntry(`reconciliation.transaction_${status}`, actor, { reason: transaction.mismatch_reason }));
  await transaction.save();
  await refreshBatchTotals(transaction.imported_batch_id);
  await recordAuditLog({
    actor,
    action: `reconciliation.transaction_${status}`,
    targetType: 'bank_statement_transaction',
    targetId: transaction._id,
    status: 'success',
    message: 'Cap nhat trang thai giao dich doi soat thanh cong.',
    requestMeta,
    metadata: { match_status: status },
  });
  return serialize(transaction);
}

async function autoMatch(payload = {}, actor = {}, requestMeta = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.AUTO_MATCH, PERMISSION.PAYMENT_RECONCILIATION.MATCH]);
  const threshold = Number(payload.threshold || payload.auto_confirm_threshold || 90);
  const reviewThreshold = Number(payload.review_threshold || 70);
  const limit = Math.min(Number(payload.limit || 50), 200);
  const filter = transactionFilter({
    ...payload,
    match_status: RECONCILIATION_TRANSACTION_STATUS.UNMATCHED,
  });
  const transactions = await BankStatementTransaction.find(filter).sort({ transaction_at: -1 }).limit(limit).lean();
  const proposed = [];
  const confirmed = [];
  const manual_review = [];

  for (const transaction of transactions) {
    const candidates = await getTransactionCandidates(transaction._id, actor);
    const best = candidates.items[0];
    if (!best) {
      manual_review.push({ transaction, reason: 'no_candidate' });
      continue;
    }
    if (best.confidence_score >= threshold && best.difference_amount === 0 && payload.confirm !== false) {
      const result = await matchTransactionToIntent(
        transaction._id,
        { payment_intent_id: best.payment_intent._id || best.payment_intent.id, match_type: RECONCILIATION_MATCH_TYPE.AUTO },
        actor,
        requestMeta,
      );
      confirmed.push(result);
    } else if (best.confidence_score >= reviewThreshold) {
      const match = await ReconciliationMatch.create({
        bank_transaction_id: transaction._id,
        payment_intent_id: best.payment_intent._id || best.payment_intent.id,
        invoice_id: best.invoice?._id || best.invoice?.id,
        match_type: RECONCILIATION_MATCH_TYPE.AUTO,
        match_status: RECONCILIATION_MATCH_STATUS.PROPOSED,
        confidence_score: best.confidence_score,
        matched_amount: Number(transaction.amount || 0),
        difference_amount: best.difference_amount,
        reasons: best.reasons,
        created_by: actorId(actor),
        audit_logs: [auditEntry('reconciliation.auto_match_proposed', actor)],
      });
      await BankStatementTransaction.findByIdAndUpdate(transaction._id, {
        $set: {
          confidence_score: best.confidence_score,
          matched_payment_intent_id: best.payment_intent._id || best.payment_intent.id,
          matched_invoice_id: best.invoice?._id || best.invoice?.id,
        },
        $push: { audit_logs: auditEntry('reconciliation.auto_match_proposed', actor, { confidence_score: best.confidence_score }) },
      });
      proposed.push({ transaction, match: serialize(match), candidate: best });
    } else {
      manual_review.push({ transaction, candidate: best, reason: 'low_confidence' });
    }
  }

  await recordAuditLog({
    actor,
    action: 'reconciliation.auto_match',
    targetType: 'reconciliation',
    status: 'success',
    message: 'Auto match doi soat thanh cong.',
    requestMeta,
    metadata: { confirmed: confirmed.length, proposed: proposed.length, manual_review: manual_review.length },
  });

  return { confirmed, proposed, manual_review };
}

async function closeBatch(batchId, payload = {}, actor = {}, requestMeta = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.APPROVE, PERMISSION.PAYMENT_RECONCILIATION.MATCH]);
  const batch = await ReconciliationBatch.findById(batchId);
  if (!batch) throw createError('Khong tim thay batch doi soat.', 404);
  await refreshBatchTotals(batch._id);
  const fresh = await ReconciliationBatch.findById(batch._id);
  fresh.status = RECONCILIATION_BATCH_STATUS.CLOSED;
  fresh.closed_by = actorId(actor);
  fresh.closed_at = new Date();
  fresh.notes = normalizeString(payload.notes || payload.note) || fresh.notes;
  fresh.audit_logs.push(auditEntry('reconciliation.batch_closed', actor));
  await fresh.save();
  await recordAuditLog({ actor, action: 'reconciliation.batch_closed', targetType: 'reconciliation_batch', targetId: fresh._id, status: 'success', message: 'Dong batch doi soat thanh cong.', requestMeta });
  return serialize(fresh);
}

async function lockBatch(batchId, payload = {}, actor = {}, requestMeta = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.LOCK_PERIOD]);
  const batch = await ReconciliationBatch.findById(batchId);
  if (!batch) throw createError('Khong tim thay batch doi soat.', 404);
  if (![RECONCILIATION_BATCH_STATUS.CLOSED, RECONCILIATION_BATCH_STATUS.IMPORTED, RECONCILIATION_BATCH_STATUS.REVIEWING].includes(batch.status)) {
    throw createError('Chi duoc khoa batch da import/review/close.', 409);
  }
  batch.status = RECONCILIATION_BATCH_STATUS.LOCKED;
  batch.locked_by = actorId(actor);
  batch.locked_at = new Date();
  batch.notes = normalizeString(payload.notes || payload.note) || batch.notes;
  batch.audit_logs.push(auditEntry('reconciliation.batch_locked', actor));
  await batch.save();
  await recordAuditLog({ actor, action: 'reconciliation.batch_locked', targetType: 'reconciliation_batch', targetId: batch._id, status: 'success', message: 'Khoa batch doi soat thanh cong.', requestMeta });
  return serialize(batch);
}

async function getOverview(query = {}, actor = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const provider = query.provider;
  const intentFilter = { provider: { $in: MANUAL_RECONCILIATION_PROVIDERS } };
  if (provider) intentFilter.provider = provider;
  addDateRange(intentFilter, 'updated_at', query.from_at || query.date_from, query.to_at || query.date_to, 'updated_at');

  const txFilter = {};
  if (provider) txFilter.provider = provider;
  addDateRange(txFilter, 'transaction_at', query.from_at || query.date_from, query.to_at || query.date_to, 'transaction_at');

  const [
    intentStatus,
    transactionStatus,
    mismatchCount,
    confirmedToday,
    rejectedToday,
  ] = await Promise.all([
    PaymentIntent.aggregate([
      { $match: intentFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    BankStatementTransaction.aggregate([
      { $match: txFilter },
      { $group: { _id: '$match_status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    PaymentIntent.countDocuments({ ...intentFilter, status: PAYMENT_INTENT_STATUS.MANUAL_REVIEW }),
    PaymentIntent.countDocuments({
      ...intentFilter,
      confirmed_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      status: { $in: [PAYMENT_INTENT_STATUS.CONFIRMED, PAYMENT_INTENT_STATUS.PAID] },
    }),
    PaymentIntent.countDocuments({
      ...intentFilter,
      manual_rejected_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  const byIntentStatus = Object.fromEntries(intentStatus.map((row) => [row._id, { count: row.count, amount: row.amount }]));
  const byTransactionStatus = Object.fromEntries(transactionStatus.map((row) => [row._id, { count: row.count, amount: row.amount }]));
  const pendingStatuses = [
    PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
    PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
    PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
  ];
  const totalPending = pendingStatuses.reduce((sum, status) => sum + (byIntentStatus[status]?.count || 0), 0);
  const pendingAmount = pendingStatuses.reduce((sum, status) => sum + (byIntentStatus[status]?.amount || 0), 0);
  const matched = byTransactionStatus[RECONCILIATION_TRANSACTION_STATUS.MATCHED]?.count || 0;
  const unmatched = byTransactionStatus[RECONCILIATION_TRANSACTION_STATUS.UNMATCHED]?.count || 0;
  const totalTransactions = transactionStatus.reduce((sum, row) => sum + row.count, 0);

  return {
    mode: {
      provider_mode: 'manual_qr_reconciliation',
      message: 'Provider bank QR hien tai khong co webhook/query API; UI can import sao ke hoac xac nhan thu cong.',
      manual_providers: MANUAL_RECONCILIATION_PROVIDERS,
    },
    kpi: {
      total_pending: totalPending,
      pending_amount: pendingAmount,
      submitted_receipt: byIntentStatus[PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT]?.count || 0,
      manual_review: mismatchCount,
      confirmed_today: confirmedToday,
      rejected_today: rejectedToday,
      imported_transactions: totalTransactions,
      matched_transactions: matched,
      unmatched_transactions: unmatched,
      match_rate: totalTransactions ? Math.round((matched / totalTransactions) * 100) : 0,
    },
    by_intent_status: byIntentStatus,
    by_transaction_status: byTransactionStatus,
  };
}

async function getDailyReport(query = {}, actor = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const filter = {};
  if (query.provider) filter.provider = query.provider;
  addDateRange(filter, 'transaction_at', query.from_at || query.date_from, query.to_at || query.date_to, 'transaction_at');
  const rows = await BankStatementTransaction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$transaction_at', timezone: 'Asia/Ho_Chi_Minh' } },
          provider: '$provider',
        },
        imported_transactions: { $sum: 1 },
        received_amount: { $sum: '$amount' },
        matched_transactions: { $sum: { $cond: [{ $eq: ['$match_status', RECONCILIATION_TRANSACTION_STATUS.MATCHED] }, 1, 0] } },
        unmatched_transactions: { $sum: { $cond: [{ $eq: ['$match_status', RECONCILIATION_TRANSACTION_STATUS.UNMATCHED] }, 1, 0] } },
        mismatch_transactions: { $sum: { $cond: [{ $in: ['$match_status', [RECONCILIATION_TRANSACTION_STATUS.DISPUTED, RECONCILIATION_TRANSACTION_STATUS.PARTIAL_MATCHED]] }, 1, 0] } },
      },
    },
    { $sort: { '_id.date': -1, '_id.provider': 1 } },
  ]);
  return {
    items: rows.map((row) => ({
      date: row._id.date,
      provider: row._id.provider,
      ...row,
      _id: undefined,
    })),
  };
}

async function getProviderReport(query = {}, actor = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const filter = {};
  if (query.provider) filter.provider = query.provider;
  addDateRange(filter, 'transaction_at', query.from_at || query.date_from, query.to_at || query.date_to, 'transaction_at');
  const rows = await BankStatementTransaction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$provider',
        transaction_count: { $sum: 1 },
        statement_amount: { $sum: '$amount' },
        matched_count: { $sum: { $cond: [{ $eq: ['$match_status', RECONCILIATION_TRANSACTION_STATUS.MATCHED] }, 1, 0] } },
        unmatched_count: { $sum: { $cond: [{ $eq: ['$match_status', RECONCILIATION_TRANSACTION_STATUS.UNMATCHED] }, 1, 0] } },
        mismatch_count: { $sum: { $cond: [{ $in: ['$match_status', [RECONCILIATION_TRANSACTION_STATUS.DISPUTED, RECONCILIATION_TRANSACTION_STATUS.PARTIAL_MATCHED]] }, 1, 0] } },
      },
    },
    { $sort: { statement_amount: -1 } },
  ]);
  return { items: rows.map((row) => ({ provider: row._id, ...row, _id: undefined })) };
}

async function exportReport(query = {}, actor = {}, requestMeta = {}) {
  assertReconciliationPermission(actor, [PERMISSION.PAYMENT_RECONCILIATION.EXPORT, PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const [overview, daily, provider] = await Promise.all([
    getOverview(query, actor),
    getDailyReport(query, actor),
    getProviderReport(query, actor),
  ]);
  await recordAuditLog({
    actor,
    action: 'reconciliation.report_exported',
    targetType: 'reconciliation_report',
    status: 'success',
    message: 'Export bao cao doi soat thanh cong.',
    requestMeta,
    metadata: { format: query.format || 'json' },
  });
  return {
    format: query.format || 'json',
    generated_at: new Date(),
    overview,
    daily: daily.items,
    provider: provider.items,
  };
}

module.exports = {
  autoMatch,
  closeBatch,
  createBatch,
  getBatchDetail,
  getDailyReport,
  getOverview,
  getProviderReport,
  getTransactionCandidates,
  getTransactionDetail,
  importTransactions,
  listBatches,
  listTransactions,
  lockBatch,
  matchTransactionToIntent,
  matchTransactionToInvoice,
  markTransactionUnmatched: (transactionId, payload, actor, requestMeta) => setTransactionStatus(transactionId, RECONCILIATION_TRANSACTION_STATUS.UNMATCHED, payload, actor, requestMeta),
  ignoreTransaction: (transactionId, payload, actor, requestMeta) => setTransactionStatus(transactionId, RECONCILIATION_TRANSACTION_STATUS.IGNORED, payload, actor, requestMeta),
  disputeTransaction: (transactionId, payload, actor, requestMeta) => setTransactionStatus(transactionId, RECONCILIATION_TRANSACTION_STATUS.DISPUTED, payload, actor, requestMeta),
  exportReport,
};
