const { LabOrder, LabResultItem, LabResult, Specimen } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  labOrderRepository: LabOrder,
  labResultItemRepository: LabResultItem,
  labResultRepository: LabResult,
  specimenRepository: Specimen,
});
