const express = require('express');
const recordsController = require('../controllers/records.controller');
const portalController = require('../controllers/portal.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { createAuthRateLimit } = require('../middleware/auth-rate-limit');
const { createActionRateLimit } = require('../middleware/action-rate-limit');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('recordId', validateObjectIdParam);
router.param('attachmentId', validateObjectIdParam);
router.param('documentId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('entityId', validateObjectIdParam);

const recordReadPermissions = [
  PERMISSION.MEDICAL_RECORDS.READ,
  PERMISSION.MEDICAL_RECORDS.READ_OWN,
  PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT,
  PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED,
];

const recordCreatePermissions = [
  PERMISSION.MEDICAL_RECORDS.CREATE,
  PERMISSION.MEDICAL_RECORDS.CREATE_SUMMARY,
];

const recordFinalizePermissions = [
  PERMISSION.MEDICAL_RECORDS.FINALIZE,
  PERMISSION.MEDICAL_RECORDS.FINALIZE_OWN,
  PERMISSION.MEDICAL_RECORDS.FINALIZE_BY_POLICY,
];

const recordUpdatePermissions = [
  PERMISSION.MEDICAL_RECORDS.UPDATE,
  PERMISSION.MEDICAL_RECORDS.AMEND,
  PERMISSION.MEDICAL_RECORDS.AMEND_BY_POLICY,
];

const attachmentReadPermissions = [
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_DEPARTMENT,
  PERMISSION.ATTACHMENTS.READ_BY_ENTITY,
  PERMISSION.ATTACHMENTS.READ_CLINICAL,
  PERMISSION.ATTACHMENTS.READ_LAB,
  PERMISSION.ATTACHMENTS.READ_IMAGING,
  PERMISSION.ATTACHMENTS.READ_PROCEDURE,
  PERMISSION.ATTACHMENTS.READ_INSURANCE,
];

const patientAttachmentReadPermissions = [
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_DEPARTMENT,
];

const attachmentUploadPermissions = [
  PERMISSION.ATTACHMENTS.CREATE,
  PERMISSION.ATTACHMENTS.UPLOAD,
  PERMISSION.ATTACHMENTS.UPLOAD_CLINICAL,
  PERMISSION.ATTACHMENTS.UPLOAD_LAB,
  PERMISSION.ATTACHMENTS.UPLOAD_IMAGING,
  PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT,
  PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE,
  PERMISSION.ATTACHMENTS.UPLOAD_INSURANCE,
];

const timelineReadPermissions = [
  PERMISSION.DOCUMENTS.TIMELINE_READ,
  PERMISSION.DOCUMENTS.TIMELINE_READ_OWN,
  PERMISSION.DOCUMENTS.TIMELINE_READ_DEPARTMENT,
  PERMISSION.MEDICAL_RECORDS.READ,
  PERMISSION.MEDICAL_RECORDS.READ_OWN,
  PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT,
  PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED,
];

const signedDownloadLimit = createAuthRateLimit({
  scope: 'records-signed-download',
  limit: 120,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.query.token || req.params.attachmentId || req.ip,
  message: 'Quá nhiều yêu cầu signed download. Vui lòng thử lại sau.',
});
const staffDocumentUploadLimit = createActionRateLimit({
  action: 'staff-document-upload',
  limit: 200,
  windowMs: 24 * 60 * 60 * 1000,
  message: 'Tài khoản đã tải lên quá nhiều tài liệu trong ngày. Vui lòng thử lại sau.',
});

router.get('/attachments/:attachmentId/signed-download', signedDownloadLimit, recordsController.signedDownloadAttachment);

router.use(authenticate);

router.get('/me/medical-records', authorize({
  actorTypes: ['patient', 'patient_relative'],
  anyPermissions: [PERMISSION.MEDICAL_RECORDS.SELF_READ_RELEASED, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED],
}), recordsController.getMyMedicalRecords);
router.get('/me/medical-records/:recordId', authorize({
  actorTypes: ['patient', 'patient_relative'],
  anyPermissions: [PERMISSION.MEDICAL_RECORDS.SELF_READ_RELEASED, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED],
}), recordsController.getMedicalRecordDetail);
router.get('/me/attachments', authorize({
  actorTypes: ['patient', 'patient_relative'],
  anyPermissions: [PERMISSION.ATTACHMENTS.SELF_READ_RELEASED, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED],
}), recordsController.getMyAttachments);
router.get('/me/attachments/:attachmentId/download', authorize({
  actorTypes: ['patient', 'patient_relative'],
  anyPermissions: [PERMISSION.ATTACHMENTS.SELF_DOWNLOAD_RELEASED, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED],
}), recordsController.downloadAttachment);
router.get('/me/attachments/:attachmentId', authorize({
  actorTypes: ['patient', 'patient_relative'],
  anyPermissions: [PERMISSION.ATTACHMENTS.SELF_READ_RELEASED, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED],
}), recordsController.getAttachmentDetail);
router.get('/me/document-timeline', authorize({
  actorTypes: ['patient', 'patient_relative'],
  anyPermissions: [PERMISSION.DOCUMENTS.TIMELINE_READ_OWN, PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED],
}), recordsController.getMyDocumentTimeline);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/medical-records', authorize({ anyPermissions: recordReadPermissions }), recordsController.listMedicalRecords);
router.get('/patients/:patientId/medical-records', authorize({ anyPermissions: recordReadPermissions }), recordsController.listPatientMedicalRecords);
router.get('/encounters/:encounterId/medical-record', authorize({ anyPermissions: recordReadPermissions }), recordsController.getMedicalRecordByEncounter);
router.post('/encounters/:encounterId/medical-record', authorize({ anyPermissions: recordCreatePermissions }), idempotencyRequired({ route: '/api/records/encounters/:encounterId/medical-record' }), recordsController.createMedicalRecordFromEncounter);

router.get('/medical-records/:recordId/export', authorize({ anyPermissions: [PERMISSION.MEDICAL_RECORDS.EXPORT] }), recordsController.exportMedicalRecord);
router.get('/medical-records/:recordId/attachments', authorize({ anyPermissions: attachmentReadPermissions }), recordsController.listMedicalRecordAttachments);
router.post('/medical-records/:recordId/attachments', authorize({ anyPermissions: attachmentUploadPermissions }), staffDocumentUploadLimit, recordsController.uploadMedicalRecordAttachment);
router.post('/medical-records/:recordId/finalize', authorize({ anyPermissions: recordFinalizePermissions }), recordsController.finalizeMedicalRecord);
router.post('/medical-records/:recordId/seal', authorize({ anyPermissions: [PERMISSION.MEDICAL_RECORDS.SEAL] }), recordsController.sealMedicalRecord);
router.post('/medical-records/:recordId/archive', authorize({ anyPermissions: [PERMISSION.MEDICAL_RECORDS.ARCHIVE] }), recordsController.archiveMedicalRecord);
router.post('/medical-records/:recordId/void', authorize({ anyPermissions: [PERMISSION.MEDICAL_RECORDS.VOID] }), recordsController.voidMedicalRecord);
router.post('/medical-records/:recordId/release-to-patient', authorize({ anyPermissions: [PERMISSION.MEDICAL_RECORDS.RELEASE_TO_PATIENT] }), recordsController.releaseMedicalRecordToPatient);
router.get('/medical-records/:recordId', authorize({ anyPermissions: recordReadPermissions }), recordsController.getMedicalRecordDetail);
router.patch('/medical-records/:recordId', authorize({ anyPermissions: recordUpdatePermissions }), recordsController.updateMedicalRecord);

router.post('/attachments', authorize({ anyPermissions: attachmentUploadPermissions }), staffDocumentUploadLimit, recordsController.uploadAttachment);
router.get('/attachments/by-entity/:entityType/:entityId', authorize({ anyPermissions: attachmentReadPermissions }), recordsController.getAttachmentsByEntity);
router.get('/attachments/:attachmentId/download', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.DOWNLOAD, ...attachmentReadPermissions] }), recordsController.downloadAttachment);
router.get('/attachments/:attachmentId', authorize({ anyPermissions: attachmentReadPermissions }), recordsController.getAttachmentDetail);
router.post('/attachments/:attachmentId/archive', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.ARCHIVE] }), recordsController.archiveAttachment);
router.post('/attachments/:attachmentId/restore', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RESTORE] }), recordsController.restoreAttachment);
router.post('/attachments/:attachmentId/release-to-patient', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT] }), recordsController.releaseAttachmentToPatient);
router.post('/attachments/:attachmentId/revoke-release', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT] }), recordsController.revokeAttachmentRelease);
router.delete('/attachments/:attachmentId', authorize({ anyPermissions: [PERMISSION.ATTACHMENTS.DELETE_SOFT] }), recordsController.softDeleteAttachment);
router.post('/documents/:documentId/approve', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.APPROVE, PERMISSION.DOCUMENTS.REVIEW] }), portalController.approvePatientDocument);
router.post('/documents/:documentId/reject', authorize({ anyPermissions: [PERMISSION.DOCUMENTS.REJECT, PERMISSION.DOCUMENTS.REVIEW] }), portalController.rejectPatientDocument);

router.get('/patients/:patientId/attachments', authorize({ anyPermissions: patientAttachmentReadPermissions }), recordsController.listPatientAttachments);
router.get('/patients/:patientId/document-timeline', authorize({ anyPermissions: timelineReadPermissions }), recordsController.getPatientDocumentTimeline);

module.exports = router;
