const express = require('express');
const billingController = require('../controllers/billing.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('invoiceId', validateObjectIdParam);
router.param('paymentId', validateObjectIdParam);
router.param('policyId', validateObjectIdParam);
router.param('claimId', validateObjectIdParam);
router.param('serviceId', validateObjectIdParam);
router.param('chargeId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);

const chargeReadPermissions = [PERMISSION.CHARGES.READ, PERMISSION.CHARGES.MANAGE];
const invoiceReadPermissions = [PERMISSION.INVOICES.READ, PERMISSION.INVOICES.READ_UNPAID];
const paymentVoidPermissions = [PERMISSION.PAYMENTS.CANCEL_PENDING, PERMISSION.PAYMENTS.REVERSE, PERMISSION.PAYMENTS.REFUND];

router.use(authenticate);

router.get('/me/invoices', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INVOICES.SELF_READ] }), billingController.getMyInvoices);
router.get('/me/invoices/:invoiceId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INVOICES.SELF_READ] }), billingController.getInvoiceDetail);
router.get('/me/payments', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENTS.SELF_READ] }), billingController.getMyPayments);
router.get('/me/payments/:paymentId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENTS.SELF_READ] }), billingController.getPaymentDetail);
router.get('/me/insurance-policies', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_POLICIES.SELF_READ] }), billingController.getMyInsurancePolicies);
router.get('/me/insurance-policies/:policyId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_POLICIES.SELF_READ] }), billingController.getInsurancePolicyDetail);
router.get('/me/insurance-claims', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_CLAIMS.SELF_READ] }), billingController.getMyInsuranceClaims);
router.get('/me/insurance-claims/:claimId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_CLAIMS.SELF_READ] }), billingController.getInsuranceClaimDetail);
router.get('/me/summary', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INVOICES.SELF_READ] }), billingController.getMyBillingSummary);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/service-catalog', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ] }), billingController.listServiceCatalog);
router.post('/service-catalog', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.CREATE] }), billingController.createServiceCatalog);
router.get('/service-catalog/:serviceId', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ] }), billingController.getServiceCatalogDetail);
router.patch('/service-catalog/:serviceId', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.UPDATE] }), billingController.updateServiceCatalog);
router.post('/service-catalog/:serviceId/retire', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.UPDATE, PERMISSION.SERVICE_CATALOG.DELETE] }), billingController.retireServiceCatalog);

router.get('/charges', authorize({ anyPermissions: chargeReadPermissions }), billingController.listCharges);
router.post('/charges', authorize({ anyPermissions: [PERMISSION.CHARGES.CREATE, PERMISSION.CHARGES.REQUEST_CREATE, PERMISSION.CHARGES.MANAGE] }), billingController.createCharge);
router.get('/charges/:chargeId', authorize({ anyPermissions: chargeReadPermissions }), billingController.getChargeDetail);
router.post('/charges/:chargeId/post', authorize({ anyPermissions: [PERMISSION.CHARGES.POST, PERMISSION.CHARGES.MANAGE] }), billingController.postCharge);
router.post('/charges/:chargeId/void', authorize({ anyPermissions: [PERMISSION.CHARGES.VOID, PERMISSION.CHARGES.MANAGE] }), billingController.voidCharge);

router.get('/invoices', authorize({ anyPermissions: invoiceReadPermissions }), billingController.listInvoices);
router.post('/invoices/from-charges', authorize({ anyPermissions: [PERMISSION.INVOICES.CREATE] }), billingController.createInvoiceFromCharges);
router.get('/invoices/:invoiceId/items', authorize({ anyPermissions: invoiceReadPermissions }), billingController.getInvoiceDetail);
router.get('/invoices/:invoiceId', authorize({ anyPermissions: invoiceReadPermissions }), billingController.getInvoiceDetail);
router.post('/invoices/:invoiceId/issue', authorize({ anyPermissions: [PERMISSION.INVOICES.ISSUE] }), billingController.issueInvoice);
router.post('/invoices/:invoiceId/void', authorize({ anyPermissions: [PERMISSION.INVOICES.VOID, PERMISSION.INVOICES.VOID_BY_POLICY, PERMISSION.INVOICES.CANCEL] }), billingController.voidInvoice);
router.post('/invoices/:invoiceId/payments', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE] }), billingController.createPayment);
router.post('/invoices/:invoiceId/insurance-claims', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.CREATE] }), billingController.createInsuranceClaim);

router.get('/payments', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ] }), billingController.listPayments);
router.get('/payments/:paymentId', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ] }), billingController.getPaymentDetail);
router.post('/payments/:paymentId/void', authorize({ anyPermissions: paymentVoidPermissions }), billingController.voidPayment);
router.post('/payments/:paymentId/refund', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), billingController.refundPayment);

router.get('/patients/:patientId/summary', authorize({ anyPermissions: [PERMISSION.INVOICES.READ, PERMISSION.CHARGES.READ, PERMISSION.PAYMENTS.READ] }), billingController.getPatientBillingSummary);
router.get('/patients/:patientId/insurance-policies', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.READ] }), billingController.listInsurancePolicies);
router.post('/patients/:patientId/insurance-policies', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.CREATE, PERMISSION.INSURANCE_POLICIES.CREATE_BASIC] }), billingController.createInsurancePolicy);

router.get('/insurance-policies/:policyId', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.READ] }), billingController.getInsurancePolicyDetail);
router.patch('/insurance-policies/:policyId', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.UPDATE] }), billingController.updateInsurancePolicy);
router.post('/insurance-policies/:policyId/cancel', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.DEACTIVATE, PERMISSION.INSURANCE_POLICIES.UPDATE] }), billingController.cancelInsurancePolicy);

router.get('/insurance-claims', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.READ] }), billingController.listInsuranceClaims);
router.get('/insurance-claims/:claimId', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.READ] }), billingController.getInsuranceClaimDetail);
router.post('/insurance-claims/:claimId/submit', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.SUBMIT] }), billingController.submitClaim);
router.post('/insurance-claims/:claimId/under-review', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.MARK_UNDER_REVIEW, PERMISSION.INSURANCE_CLAIMS.UPDATE] }), billingController.markClaimUnderReview);
router.post('/insurance-claims/:claimId/approve', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.APPROVE, PERMISSION.INSURANCE_CLAIMS.PARTIALLY_APPROVE] }), billingController.approveClaim);
router.post('/insurance-claims/:claimId/reject', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.REJECT] }), billingController.rejectClaim);
router.post('/insurance-claims/:claimId/settle', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.SETTLE] }), billingController.settleClaim);
router.post('/insurance-claims/:claimId/cancel', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.CANCEL, PERMISSION.INSURANCE_CLAIMS.MANAGE] }), billingController.cancelClaim);

module.exports = router;
