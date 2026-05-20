import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method = 'POST', body = {}) {
  return request(path, { method, body }).then(unwrap);
}

export const imagingApi = {
  dashboard: (params) => request('/imaging/dashboard', { params }).then(unwrap),
  worklistCounts: (params) => request('/imaging/worklist-counts', { params }).then(unwrap),
  slaBoard: (params) => request('/imaging/sla-board', { params }).then(unwrap),
  scheduleBoard: (params) => request('/imaging/schedule/board', { params }).then(unwrap),
  slotSuggestions: (params) => request('/imaging/slots/suggestions', { params }).then(unwrap),

  listOrders: (params) => request('/imaging/orders', { params }).then(unwrap),
  orderDetail: (id) => request(`/imaging/orders/${encodeURIComponent(id)}`).then(unwrap),
  orderTimeline: (id) => request(`/imaging/orders/${encodeURIComponent(id)}/timeline`).then(unwrap),
  scheduleOrder: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/schedule`, 'POST', body),
  rescheduleOrder: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/reschedule`, 'POST', body),
  assignTechnician: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/assign-technician`, 'POST', body),
  assignRadiologist: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/assign-radiologist`, 'POST', body),
  markArrived: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/mark-arrived`, 'POST', body),
  markReady: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/mark-ready`, 'POST', body),
  markNotReady: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/mark-not-ready`, 'POST', body),
  startOrder: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/start`, 'POST', body),
  completeOrder: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/complete`, 'POST', body),
  cancelOrder: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/cancel`, 'POST', body),
  markNoShow: (id, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(id)}/no-show`, 'POST', body),

  listAttachments: (orderId) => request(`/imaging/orders/${encodeURIComponent(orderId)}/attachments`).then(unwrap),
  uploadAttachment: (orderId, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(orderId)}/attachments`, 'POST', body),
  createUploadUrl: (orderId, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(orderId)}/files/upload-url`, 'POST', body),
  completeUpload: (orderId, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(orderId)}/files/complete-upload`, 'POST', body),
  deleteAttachment: (attachmentId) => bodyRequest(`/imaging/attachments/${encodeURIComponent(attachmentId)}`, 'DELETE', {}),

  listFiles: (params) => request('/imaging/files', { params }).then(unwrap),
  reviewFile: (id, body = {}) => bodyRequest(`/imaging/files/${encodeURIComponent(id)}/review`, 'POST', body),
  releaseFile: (id, body = {}) => bodyRequest(`/imaging/files/${encodeURIComponent(id)}/release-to-patient`, 'POST', body),
  archiveFile: (id, body = {}) => bodyRequest(`/imaging/files/${encodeURIComponent(id)}/archive`, 'POST', body),
  restoreFile: (id, body = {}) => bodyRequest(`/imaging/files/${encodeURIComponent(id)}/restore`, 'POST', body),

  createReport: (orderId, body = {}) => bodyRequest(`/imaging/orders/${encodeURIComponent(orderId)}/reports`, 'POST', body),
  listReports: (params) => request('/imaging/reports', { params }).then(unwrap),
  reportDetail: (id) => request(`/imaging/reports/${encodeURIComponent(id)}`).then(unwrap),
  updateReport: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}`, 'PATCH', body),
  finalizeReport: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/finalize`, 'POST', body),
  amendReport: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/amend`, 'POST', body),
  cancelReport: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/cancel`, 'POST', body),
  releaseReport: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/release-to-patient`, 'POST', body),
  acknowledgeCritical: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/acknowledge-critical`, 'POST', body),
  notifyCritical: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/notify-critical`, 'POST', body),
  escalateCritical: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/escalate-critical`, 'POST', body),
  reportPdf: (id) => request(`/imaging/reports/${encodeURIComponent(id)}/pdf`).then(unwrap),
  renderReportPdf: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/render-pdf`, 'POST', body),
  requestCorrection: (id, body = {}) => bodyRequest(`/imaging/reports/${encodeURIComponent(id)}/correction-requests`, 'POST', body),

  listCorrections: (params) => request('/imaging/report-correction-requests', { params }).then(unwrap),
  assignCorrection: (id, body = {}) => bodyRequest(`/imaging/report-correction-requests/${encodeURIComponent(id)}/assign`, 'POST', body),
  resolveCorrection: (id, body = {}) => bodyRequest(`/imaging/report-correction-requests/${encodeURIComponent(id)}/resolve`, 'POST', body),
  cancelCorrection: (id, body = {}) => bodyRequest(`/imaging/report-correction-requests/${encodeURIComponent(id)}/cancel`, 'POST', body),

  listRooms: (params) => request('/imaging/rooms', { params }).then(unwrap),
  createRoom: (body = {}) => bodyRequest('/imaging/rooms', 'POST', body),
  updateRoom: (id, body = {}) => bodyRequest(`/imaging/rooms/${encodeURIComponent(id)}`, 'PATCH', body),
  listEquipment: (params) => request('/imaging/equipment', { params }).then(unwrap),
  createEquipment: (body = {}) => bodyRequest('/imaging/equipment', 'POST', body),
  updateEquipment: (id, body = {}) => bodyRequest(`/imaging/equipment/${encodeURIComponent(id)}`, 'PATCH', body),
  listTemplates: (params) => request('/imaging/report-templates', { params }).then(unwrap),
  createTemplate: (body = {}) => bodyRequest('/imaging/report-templates', 'POST', body),
  updateTemplate: (id, body = {}) => bodyRequest(`/imaging/report-templates/${encodeURIComponent(id)}`, 'PATCH', body),
};

export function getImagingErrorMessage(error, fallback = 'Không thể tải dữ liệu chẩn đoán hình ảnh.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
