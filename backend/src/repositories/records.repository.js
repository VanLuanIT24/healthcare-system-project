const { Attachment, MedicalRecord } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  attachmentRepository: Attachment,
  medicalRecordRepository: MedicalRecord,
});
