const recordsService = require('../services/records.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');
const { ATTACHMENT_ENTITY_TYPE } = require('../constants/statuses');

module.exports = {
  createMedicalRecordFromEncounter: wrap((req) => recordsService.createMedicalRecordFromEncounter(req.params.encounterId, req.body, req.auth, requestMeta(req)), 'Tạo medical record thành công.', 201),
  getMedicalRecordByEncounter: wrap((req) => recordsService.getMedicalRecordByEncounter(req.params.encounterId, req.auth), 'Lấy medical record theo encounter thành công.'),
  listMedicalRecords: wrap((req) => recordsService.listMedicalRecords(req.query, req.auth), 'Lấy danh sách medical record thành công.'),
  listPatientMedicalRecords: wrap((req) => recordsService.listPatientMedicalRecords(req.params.patientId, req.query, req.auth), 'Lấy medical records của patient thành công.'),
  getMedicalRecordDetail: wrap((req) => recordsService.getMedicalRecordDetail(req.params.recordId, req.auth), 'Lấy chi tiết medical record thành công.'),
  updateMedicalRecord: wrap((req) => recordsService.updateMedicalRecord(req.params.recordId, req.body, req.auth, requestMeta(req)), 'Cập nhật medical record thành công.'),
  finalizeMedicalRecord: wrap((req) => recordsService.finalizeMedicalRecord(req.params.recordId, req.body, req.auth, requestMeta(req)), 'Finalize medical record thành công.'),
  sealMedicalRecord: wrap((req) => recordsService.sealMedicalRecord(req.params.recordId, req.auth, requestMeta(req)), 'Seal medical record thành công.'),
  archiveMedicalRecord: wrap((req) => recordsService.archiveMedicalRecord(req.params.recordId, req.body, req.auth, requestMeta(req)), 'Archive medical record thành công.'),
  voidMedicalRecord: wrap((req) => recordsService.voidMedicalRecord(req.params.recordId, req.body, req.auth, requestMeta(req)), 'Void medical record thành công.'),
  releaseMedicalRecordToPatient: wrap((req) => recordsService.releaseMedicalRecordToPatient(req.params.recordId, req.auth, requestMeta(req)), 'Release medical record to patient thành công.'),
  exportMedicalRecord: wrap((req) => recordsService.exportMedicalRecord(req.params.recordId, req.query, req.auth, requestMeta(req)), 'Export medical record thành công.'),
  getMyMedicalRecords: wrap((req) => recordsService.listPatientMedicalRecords(req.auth.patientId || req.auth.patient_id, req.query, req.auth), 'Lấy medical records của tôi thành công.'),

  uploadAttachment: wrap((req) => recordsService.uploadAttachment(req.body, req.file || null, req.auth, requestMeta(req)), 'Upload attachment thành công.', 201),
  uploadMedicalRecordAttachment: wrap((req) => recordsService.uploadAttachment({
    ...req.body,
    entity_type: ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD,
    entity_id: req.params.recordId,
    medical_record_id: req.params.recordId,
  }, req.file || null, req.auth, requestMeta(req)), 'Upload medical record attachment thành công.', 201),
  getAttachmentDetail: wrap((req) => recordsService.getAttachmentDetail(req.params.attachmentId, req.auth), 'Lấy chi tiết attachment thành công.'),
  downloadAttachment: wrap((req) => recordsService.downloadAttachment(req.params.attachmentId, req.auth, requestMeta(req)), 'Download attachment metadata thành công.'),
  signedDownloadAttachment: wrap((req) => recordsService.signedDownloadAttachment(req.params.attachmentId, req.query.token, requestMeta(req)), 'Signed download attachment thành công.'),
  getAttachmentsByEntity: wrap((req) => recordsService.getAttachmentsByEntity(req.params.entityType, req.params.entityId, req.query, req.auth), 'Lấy attachments theo entity thành công.'),
  listPatientAttachments: wrap((req) => recordsService.listPatientAttachments(req.params.patientId, req.query, req.auth), 'Lấy attachments của patient thành công.'),
  listMedicalRecordAttachments: wrap((req) => recordsService.getAttachmentsByEntity(ATTACHMENT_ENTITY_TYPE.MEDICAL_RECORD, req.params.recordId, req.query, req.auth), 'Lấy medical record attachments thành công.'),
  archiveAttachment: wrap((req) => recordsService.archiveAttachment(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Archive attachment thành công.'),
  softDeleteAttachment: wrap((req) => recordsService.softDeleteAttachment(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Soft delete attachment thành công.'),
  restoreAttachment: wrap((req) => recordsService.restoreAttachment(req.params.attachmentId, req.auth, requestMeta(req)), 'Restore attachment thành công.'),
  releaseAttachmentToPatient: wrap((req) => recordsService.releaseAttachmentToPatient(req.params.attachmentId, req.auth, requestMeta(req)), 'Release attachment to patient thành công.'),
  getMyAttachments: wrap((req) => recordsService.listPatientAttachments(req.auth.patientId || req.auth.patient_id, req.query, req.auth), 'Lấy attachments của tôi thành công.'),

  getPatientDocumentTimeline: wrap((req) => recordsService.getPatientDocumentTimeline(req.params.patientId, req.query, req.auth), 'Lấy document timeline thành công.'),
  getMyDocumentTimeline: wrap((req) => recordsService.getPatientDocumentTimeline(req.auth.patientId || req.auth.patient_id, req.query, req.auth), 'Lấy document timeline của tôi thành công.'),
};
