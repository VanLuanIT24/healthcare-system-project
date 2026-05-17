const messageService = require('../services/message.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  listConversations: wrap(
    (req) => messageService.listConversations(req.query, req.auth),
    'Lấy danh sách conversations thành công.',
  ),
  createConversation: wrap(
    (req) => messageService.createConversation(req.body, req.auth, requestMeta(req)),
    'Tạo conversation thành công.',
    201,
  ),
  getConversation: wrap(
    (req) => messageService.getConversation(req.params.conversationId, req.auth),
    'Lấy chi tiết conversation thành công.',
  ),
  listMessages: wrap(
    (req) => messageService.listMessages(req.params.conversationId, req.query, req.auth),
    'Lấy messages thành công.',
  ),
  sendMessage: wrap(
    (req) => messageService.sendMessage(req.params.conversationId, req.body, req.auth, requestMeta(req)),
    'Gửi message thành công.',
    201,
  ),
  markRead: wrap(
    (req) => messageService.markConversationRead(req.params.conversationId, req.body, req.auth, requestMeta(req)),
    'Đánh dấu conversation đã đọc thành công.',
  ),
  archiveConversation: wrap(
    (req) => messageService.archiveConversation(req.params.conversationId, req.auth, requestMeta(req)),
    'Archive conversation thành công.',
  ),
  closeConversation: wrap(
    (req) => messageService.closeConversation(req.params.conversationId, req.body, req.auth, requestMeta(req)),
    'Đóng conversation thành công.',
  ),
  reopenConversation: wrap(
    (req) => messageService.reopenConversation(req.params.conversationId, req.body, req.auth, requestMeta(req)),
    'Mở lại conversation thành công.',
  ),
  assignConversation: wrap(
    (req) => messageService.assignConversation(req.params.conversationId, req.body, req.auth, requestMeta(req)),
    'Assign conversation thành công.',
  ),
  escalateConversation: wrap(
    (req) => messageService.escalateConversation(req.params.conversationId, req.body, req.auth, requestMeta(req)),
    'Escalate conversation thành công.',
  ),
  addAttachments: wrap(
    (req) => messageService.addConversationAttachments(req.params.conversationId, req.body, req.auth, requestMeta(req)),
    'Thêm attachment message thành công.',
    201,
  ),
  createCall: wrap(
    (req) => messageService.createConversationCall(req.params.conversationId, req.body, req.auth, requestMeta(req)),
    'Tạo conversation call thành công.',
    201,
  ),
  startCall: wrap(
    (req) => messageService.startConversationCall(req.params.conversationId, req.params.callId, req.body, req.auth, requestMeta(req)),
    'Bắt đầu conversation call thành công.',
  ),
  endCall: wrap(
    (req) => messageService.endConversationCall(req.params.conversationId, req.params.callId, req.body, req.auth, requestMeta(req)),
    'Kết thúc conversation call thành công.',
  ),
  updateCallTranscript: wrap(
    (req) => messageService.updateConversationCallTranscript(req.params.conversationId, req.params.callId, req.body, req.auth, requestMeta(req)),
    'Cập nhật transcript conversation call thành công.',
  ),
  getCall: wrap(
    (req) => messageService.getConversationCall(req.params.conversationId, req.params.callId, req.auth),
    'Lấy chi tiết conversation call thành công.',
  ),
  saveCallAsClinicalNote: wrap(
    (req) => messageService.saveConversationCallAsClinicalNote(req.params.conversationId, req.params.callId, req.body, req.auth, requestMeta(req)),
    'Lưu conversation call thành clinical note thành công.',
    201,
  ),
};
