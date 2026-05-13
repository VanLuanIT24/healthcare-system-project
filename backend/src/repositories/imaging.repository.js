const { ImagingOrder, ImagingReport } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  imagingOrderRepository: ImagingOrder,
  imagingReportRepository: ImagingReport,
});
