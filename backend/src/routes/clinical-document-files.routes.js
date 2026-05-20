const express = require('express');
const clinicalDocumentFilesController = require('../controllers/clinical-document-files.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('attachmentId', validateObjectIdParam);
router.param('taskId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_DEPARTMENT,
  PERMISSION.ATTACHMENTS.READ_BY_ENTITY,
  PERMISSION.ATTACHMENTS.READ_CLINICAL,
  PERMISSION.ATTACHMENTS.READ_LAB,
  PERMISSION.ATTACHMENTS.READ_IMAGING,
  PERMISSION.ATTACHMENTS.READ_PROCEDURE,
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
];

const managePermissions = [
  PERMISSION.ATTACHMENTS.MANAGE,
  PERMISSION.ATTACHMENTS.UPLOAD,
  PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL,
  PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT,
  PERMISSION.ATTACHMENTS.ARCHIVE,
  PERMISSION.ATTACHMENTS.RESTORE,
  PERMISSION.ATTACHMENTS.DELETE_SOFT,
  PERMISSION.DOCUMENTS.REVIEW,
  PERMISSION.DOCUMENTS.APPROVE,
  PERMISSION.DOCUMENTS.REJECT,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/summary', authorize({ anyPermissions: readPermissions }), clinicalDocumentFilesController.getSummary);
router.get('/missing', authorize({ anyPermissions: readPermissions }), clinicalDocumentFilesController.listMissing);
router.post('/missing/recompute', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.recomputeMissing);
router.post('/missing/:taskId/assign', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.assignMissing);
router.post('/missing/:taskId/waive', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.waiveMissing);
router.post('/missing/:taskId/resolve', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.resolveMissing);
router.get('/scan-errors', authorize({ anyPermissions: readPermissions }), (req, res, next) => {
  req.query.scan_status = 'infected,failed';
  return clinicalDocumentFilesController.listFiles(req, res, next);
});
router.get('/scan-queue', authorize({ anyPermissions: readPermissions }), (req, res, next) => {
  req.query.scan_status = 'pending';
  return clinicalDocumentFilesController.listFiles(req, res, next);
});
router.get('/review-queue', authorize({ anyPermissions: readPermissions }), (req, res, next) => {
  req.query.review_status = 'pending';
  return clinicalDocumentFilesController.listFiles(req, res, next);
});
router.get('/released', authorize({ anyPermissions: readPermissions }), (req, res, next) => {
  req.query.released_to_patient = 'true';
  return clinicalDocumentFilesController.listFiles(req, res, next);
});
router.post('/bulk-action', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.bulkAction);
router.get('/', authorize({ anyPermissions: readPermissions }), clinicalDocumentFilesController.listFiles);

router.get('/:attachmentId/audit', authorize({ anyPermissions: readPermissions }), clinicalDocumentFilesController.getAudit);
router.get('/:attachmentId/access-logs', authorize({ anyPermissions: readPermissions }), clinicalDocumentFilesController.getAccessLogs);
router.get('/:attachmentId', authorize({ anyPermissions: readPermissions }), clinicalDocumentFilesController.getDetail);
router.patch('/:attachmentId/metadata', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.updateMetadata);
router.post('/:attachmentId/review', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.REVIEW, PERMISSION.DOCUMENTS.APPROVE, PERMISSION.DOCUMENTS.REJECT, PERMISSION.ATTACHMENTS.MANAGE] }), clinicalDocumentFilesController.reviewAttachment);
router.post('/:attachmentId/release', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.ATTACHMENTS.MANAGE] }), clinicalDocumentFilesController.releaseFile);
router.post('/:attachmentId/revoke-release', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.ATTACHMENTS.MANAGE] }), clinicalDocumentFilesController.revokeRelease);
router.post('/:attachmentId/archive', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.ATTACHMENTS.MANAGE] }), clinicalDocumentFilesController.archiveFile);
router.post('/:attachmentId/restore', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RESTORE, PERMISSION.ATTACHMENTS.MANAGE] }), clinicalDocumentFilesController.restoreFile);
router.delete('/:attachmentId', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.MANAGE] }), clinicalDocumentFilesController.deleteFile);
router.post('/:attachmentId/rescan', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.rescanFile);
router.post('/:attachmentId/quarantine', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.quarantineFile);
router.post('/:attachmentId/mark-scan-skipped', authorize({ anyPermissions: managePermissions }), clinicalDocumentFilesController.markScanSkipped);

module.exports = router;
