const express = require('express');
const portalController = require('../controllers/portal.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');
const { createActionRateLimit } = require('../middleware/action-rate-limit');

const router = express.Router();

router.param('documentId', validateObjectIdParam);
router.param('exportId', validateObjectIdParam);
router.param('profileChangeRequestId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['patient', 'patient_relative'] }));

const documentUploadLimit = createActionRateLimit({
  action: 'document-upload',
  limit: 50,
  windowMs: 24 * 60 * 60 * 1000,
  message: 'Bạn đã tải lên quá nhiều tài liệu trong ngày. Vui lòng thử lại sau.',
});

router.get('/me/dashboard', portalController.getMyDashboard);
router.get('/me/access-logs', portalController.getMyAccessLogs);
router.post('/me/profile-change-requests', portalController.createProfileChangeRequest);
router.get('/me/profile-change-requests', portalController.listProfileChangeRequests);
router.post('/me/profile-change-requests/:profileChangeRequestId/cancel', portalController.cancelProfileChangeRequest);
router.post('/me/documents', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.SELF_UPLOAD, PERMISSION.ATTACHMENTS.SELF_UPLOAD_BASIC] }), documentUploadLimit, portalController.uploadMyDocument);
router.get('/me/documents', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.SELF_READ, PERMISSION.ATTACHMENTS.SELF_READ_RELEASED] }), portalController.listMyDocuments);
router.get('/me/documents/:documentId', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.SELF_READ, PERMISSION.ATTACHMENTS.SELF_READ_RELEASED] }), portalController.getMyDocument);
router.post('/me/documents/:documentId/archive', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.SELF_ARCHIVE] }), portalController.archiveMyDocument);
router.post('/me/documents/:documentId/restore', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.SELF_ARCHIVE] }), portalController.restoreMyDocument);
router.delete('/me/documents/:documentId', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.SELF_ARCHIVE] }), portalController.deleteMyDocument);
router.post('/me/documents/:documentId/submit-review', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.SELF_UPLOAD] }), portalController.submitMyDocumentReview);
router.post('/me/documents/export-zip', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.SELF_EXPORT_ZIP] }), idempotencyRequired({ route: '/api/portal/me/documents/export-zip' }), portalController.createDocumentExport);
router.get('/me/document-exports/:exportId', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.SELF_EXPORT_ZIP] }), portalController.getDocumentExport);
router.get('/me/document-exports/:exportId/download', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.SELF_EXPORT_ZIP] }), portalController.downloadDocumentExport);

module.exports = router;
