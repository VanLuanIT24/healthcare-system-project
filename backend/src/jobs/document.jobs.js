const fs = require('fs/promises');
const path = require('path');
const { DocumentExportRequest } = require('../models');
const { DOCUMENT_EXPORT_STATUS, REALTIME_EVENT_TYPE } = require('../constants/statuses');
const eventBus = require('../events/event-bus.service');

async function expireDocumentExports({ limit = 100 } = {}) {
  const exports = await DocumentExportRequest.find({
    status: DOCUMENT_EXPORT_STATUS.READY,
    expires_at: { $lte: new Date() },
  }).sort({ expires_at: 1 }).limit(limit);

  for (const request of exports) {
    request.status = DOCUMENT_EXPORT_STATUS.EXPIRED;
    await request.save();
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.DOCUMENT_EXPORT_EXPIRED,
      aggregateType: 'document_export_request',
      aggregateId: request._id,
      recipientScope: {
        patient_id: request.patient_id,
        recipients: [{ recipient_type: 'patient', recipient_id: request.patient_id, patient_id: request.patient_id }],
      },
      payload: {
        export_id: String(request._id),
        notification: {
          title: 'Gói tài liệu đã hết hạn',
          body: 'Vui lòng tạo yêu cầu xuất ZIP mới nếu cần tải lại.',
          priority: 'normal',
        },
      },
    });
  }

  return { expired_count: exports.length, export_ids: exports.map((item) => String(item._id)) };
}

async function markDocumentExportReady(exportId, { fileUrl, expiresAt } = {}) {
  const request = await DocumentExportRequest.findById(exportId);
  if (!request) return null;
  request.status = DOCUMENT_EXPORT_STATUS.READY;
  request.file_url = fileUrl || request.file_url;
  request.expires_at = expiresAt || request.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000);
  await request.save();
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.DOCUMENT_EXPORT_READY,
    aggregateType: 'document_export_request',
    aggregateId: request._id,
    recipientScope: {
      patient_id: request.patient_id,
      recipients: [{ recipient_type: 'patient', recipient_id: request.patient_id, patient_id: request.patient_id }],
    },
    payload: {
      export_id: String(request._id),
      file_url: request.file_url,
      notification: {
        title: 'Gói tài liệu đã sẵn sàng',
        body: 'Bạn có thể tải file ZIP tài liệu.',
        priority: 'normal',
      },
    },
  });
  return request.toObject();
}

async function purgeTemporaryExportFiles({ limit = 100 } = {}) {
  const exports = await DocumentExportRequest.find({
    status: DOCUMENT_EXPORT_STATUS.EXPIRED,
    file_url: { $exists: true, $ne: '' },
  }).limit(limit);

  let purged_count = 0;
  for (const request of exports) {
    if (path.isAbsolute(String(request.file_url || ''))) {
      try {
        await fs.unlink(request.file_url);
        purged_count += 1;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    request.file_url = undefined;
    await request.save();
  }

  return { purged_count };
}

module.exports = {
  expireDocumentExports,
  markDocumentExportReady,
  purgeTemporaryExportFiles,
};
