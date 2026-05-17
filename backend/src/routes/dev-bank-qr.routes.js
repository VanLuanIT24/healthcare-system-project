const express = require('express');
const { randomBytes } = require('crypto');
const ApiResponse = require('../common/responses/api-response');
const actorContext = require('../common/actors');
const env = require('../config/env');
const { Invoice, InvoiceItem, Patient, PaymentIntent } = require('../models');
const paymentIntentService = require('../services/payment-intent.service');
const { requestMeta } = require('../common/controllers');
const {
  INVOICE_STATUS,
  PATIENT_STATUS,
  PAYMENT_INTENT_STATUS,
  PAYMENT_PROVIDER,
} = require('../constants/statuses');
const { resolveBankQrConfig } = require('../payments/providers/bank-qr.provider');

const router = express.Router();

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function devOnly(req, res, next) {
  if (env.nodeEnv === 'production') {
    return res.status(404).json({
      success: false,
      message: 'Dev bank QR routes are disabled in production.',
    });
  }
  return next();
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0) {
    const error = new Error('amount phải là số nguyên VND và > 0.');
    error.statusCode = 400;
    throw error;
  }
  return amount;
}

function maskAccountNo(accountNo) {
  return String(accountNo || '').replace(/.(?=.{4})/g, '*');
}

function buildSystemActor(req) {
  return actorContext.buildSystemActor({
    serviceName: 'dev-bank-qr-test',
    permissions: ['system.full_access'],
    requestMeta: requestMeta(req),
  });
}

function providerOptionsFromBody(body = {}) {
  return {
    bank_bin: normalizeString(body.bank_bin || body.bankBin),
    account_no: normalizeString(body.account_no || body.accountNo),
    account_name: normalizeString(body.account_name || body.accountName),
    template: normalizeString(body.template),
  };
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ''));
}

function derivedIntent(item) {
  const expired = item.status === PAYMENT_INTENT_STATUS.PENDING
    && item.expires_at
    && new Date(item.expires_at) <= new Date();
  return {
    ...item,
    derived_status: expired ? PAYMENT_INTENT_STATUS.EXPIRED : item.status,
  };
}

router.use(devOnly);

router.get('/config', (req, res) => {
  const config = resolveBankQrConfig();
  return ApiResponse.success(res, {
    node_env: env.nodeEnv,
    configured: Boolean(config.bankBin && config.accountNo),
    bank_bin: config.bankBin,
    account_no_masked: maskAccountNo(config.accountNo),
    account_name: config.accountName,
    template: config.template,
    ttl_minutes: env.bankQrIntentTtlMinutes,
  }, 'Lấy cấu hình bank QR test thành công.');
});

router.get('/intents', asyncRoute(async (req, res) => {
  const status = normalizeString(req.query.status);
  const filter = {
    provider: PAYMENT_PROVIDER.BANK_QR,
    'metadata.dev_bank_qr_test': true,
  };
  if (status && status !== 'all') {
    filter.status = status.includes(',') ? { $in: status.split(',').map((item) => item.trim()).filter(Boolean) } : status;
  }
  const items = await PaymentIntent.find(filter)
    .sort({ created_at: -1 })
    .limit(Math.min(Number(req.query.limit) || 25, 100))
    .populate('invoice_id', 'invoice_no status total_amount balance_due paid_amount')
    .populate('patient_id', 'patient_code full_name')
    .populate('payment_id', 'payment_no amount status transaction_ref paid_at')
    .lean();

  return ApiResponse.success(res, {
    items: items.map(derivedIntent),
  }, 'Lấy danh sách bank QR test thành công.');
}));

router.post('/intents', asyncRoute(async (req, res) => {
  const amount = normalizeAmount(req.body.amount);
  const actor = buildSystemActor(req);
  const now = new Date();
  const suffix = `${Date.now()}${randomBytes(2).toString('hex').toUpperCase()}`;
  const patientName = normalizeString(req.body.patient_name || req.body.patientName) || 'Bank QR Test Patient';
  const patient = await Patient.create({
    patient_code: `DEV-PAY-${suffix}`,
    full_name: patientName,
    phone: normalizeString(req.body.patient_phone || req.body.patientPhone),
    status: PATIENT_STATUS.ACTIVE,
  });
  const invoiceNo = `DEV-INV-${suffix}`;
  const invoice = await Invoice.create({
    patient_id: patient._id,
    invoice_no: invoiceNo,
    subtotal_amount: amount,
    discount_amount: 0,
    tax_amount: 0,
    insurance_amount: 0,
    total_amount: amount,
    paid_amount: 0,
    balance_due: amount,
    issued_at: now,
    due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    status: INVOICE_STATUS.ISSUED,
  });
  await InvoiceItem.create({
    invoice_id: invoice._id,
    description: normalizeString(req.body.description) || 'Dev bank QR test invoice',
    quantity: 1,
    unit_price: amount,
    discount_amount: 0,
    tax_amount: 0,
    line_total: amount,
    display_order: 1,
  });

  const ttlMinutes = Number(req.body.ttl_minutes || req.body.ttlMinutes || env.bankQrIntentTtlMinutes);
  const intent = await paymentIntentService.createPaymentIntent(invoice._id, {
    provider: PAYMENT_PROVIDER.BANK_QR,
    method: 'qr',
    force_new: true,
    expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000),
    provider_options: compactObject(providerOptionsFromBody(req.body)),
    metadata: {
      dev_bank_qr_test: true,
      created_from: 'bank-qr-test-page',
    },
  }, actor, requestMeta(req));

  return ApiResponse.created(res, {
    invoice,
    patient,
    payment_intent: derivedIntent(intent),
  }, 'Tạo bank QR test intent thành công.');
}));

router.post('/intents/:intentId/confirm', asyncRoute(async (req, res) => {
  const result = await paymentIntentService.confirmBankTransfer(req.params.intentId, req.body, buildSystemActor(req), requestMeta(req));
  return ApiResponse.success(res, result, 'Xác nhận bank QR test thành công.');
}));

router.post('/intents/:intentId/reject', asyncRoute(async (req, res) => {
  const result = await paymentIntentService.rejectBankTransfer(req.params.intentId, req.body, buildSystemActor(req), requestMeta(req));
  return ApiResponse.success(res, result, 'Từ chối bank QR test thành công.');
}));

module.exports = router;
