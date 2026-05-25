const chatbotService = require('../services/chatbot.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

function chatMeta(req) {
  return {
    ...requestMeta(req),
    origin: req.get('origin'),
    widgetToken: req.get('x-chatbot-widget-token') || req.body?.widget_token || req.query?.widget_token,
  };
}

module.exports = {
  createSession: wrap((req) => chatbotService.createSession(req.body, req.auth, chatMeta(req)), 'Tạo phiên chatbot thành công.', 201),
  getSession: wrap((req) => chatbotService.getSession(req.params.sessionId), 'Lấy phiên chatbot thành công.'),
  listMessages: wrap((req) => chatbotService.listMessages(req.params.sessionId, req.query), 'Lấy tin nhắn chatbot thành công.'),
  sendMessage: wrap((req) => chatbotService.handleMessage(req.params.sessionId, req.body, req.auth, chatMeta(req)), 'Gửi tin nhắn chatbot thành công.', 201),
  escalateSession: wrap((req) => chatbotService.escalateSession(req.params.sessionId, req.body, req.auth, chatMeta(req)), 'Chuyển nhân viên thành công.'),
  closeSession: wrap((req) => chatbotService.closeSession(req.params.sessionId), 'Đóng phiên chatbot thành công.'),
};
