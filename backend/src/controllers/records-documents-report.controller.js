const recordsDocumentsReportService = require('../services/records-documents-report.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  medicalRecords: wrap(
    (req) => recordsDocumentsReportService.getMedicalRecordsReport(req.query, req.auth),
    'Lay bao cao ho so benh an thanh cong.',
  ),
  finalizedRecords: wrap(
    (req) => recordsDocumentsReportService.getFinalizedRecordsReport(req.query, req.auth),
    'Lay bao cao ho so da finalize thanh cong.',
  ),
  releasedRecords: wrap(
    (req) => recordsDocumentsReportService.getReleasedRecordsReport(req.query, req.auth),
    'Lay bao cao ho so da release thanh cong.',
  ),
  voidArchive: wrap(
    (req) => recordsDocumentsReportService.getVoidArchiveReport(req.query, req.auth),
    'Lay bao cao void/archive thanh cong.',
  ),
  attachments: wrap(
    (req) => recordsDocumentsReportService.getAttachmentReport(req.query, req.auth),
    'Lay bao cao attachment thanh cong.',
  ),
  exports: wrap(
    (req) => recordsDocumentsReportService.getRecordExportReport(req.query, req.auth),
    'Lay bao cao export ho so thanh cong.',
  ),
  timeline: wrap(
    (req) => recordsDocumentsReportService.getDocumentTimelineReport(req.query, req.auth),
    'Lay bao cao timeline tai lieu thanh cong.',
  ),
};
