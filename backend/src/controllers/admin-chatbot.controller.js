const chatbotService = require('../services/chatbot.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  getDashboard: wrap(() => chatbotService.getDashboard(), 'Lấy dashboard chatbot thành công.'),
  listConversations: wrap((req) => chatbotService.listConversations(req.query), 'Lấy hội thoại chatbot thành công.'),
  getConversation: wrap((req) => chatbotService.getConversation(req.params.sessionId), 'Lấy chi tiết hội thoại chatbot thành công.'),
  listIntents: wrap((req) => chatbotService.listIntents(req.query), 'Lấy intent chatbot thành công.'),
  createIntent: wrap((req) => chatbotService.createIntent(req.body, req.auth), 'Tạo intent chatbot thành công.', 201),
  updateIntent: wrap((req) => chatbotService.updateIntent(req.params.intentId, req.body, req.auth), 'Cập nhật intent chatbot thành công.'),
  listEntities: wrap((req) => chatbotService.listEntities(req.query), 'Lấy entity dictionary thành công.'),
  createEntity: wrap((req) => chatbotService.createEntity(req.body, req.auth), 'Tạo entity dictionary thành công.', 201),
  updateEntity: wrap((req) => chatbotService.updateEntity(req.params.entityId, req.body, req.auth), 'Cập nhật entity dictionary thành công.'),
  listKnowledgeArticles: wrap((req) => chatbotService.listKnowledgeArticles(req.query), 'Lấy knowledge base thành công.'),
  createKnowledgeArticle: wrap((req) => chatbotService.createKnowledgeArticle(req.body, req.auth), 'Tạo knowledge article thành công.', 201),
  updateKnowledgeArticle: wrap((req) => chatbotService.updateKnowledgeArticle(req.params.articleId, req.body, req.auth), 'Cập nhật knowledge article thành công.'),
  publishKnowledgeArticle: wrap((req) => chatbotService.publishKnowledgeArticle(req.params.articleId, req.auth), 'Publish knowledge article thành công.'),
  archiveKnowledgeArticle: wrap((req) => chatbotService.archiveKnowledgeArticle(req.params.articleId, req.auth), 'Archive knowledge article thành công.'),
  reindexKnowledge: wrap(() => chatbotService.reindexKnowledge(), 'Re-index knowledge base thành công.'),
  listFallbacks: wrap((req) => chatbotService.listFallbacks(req.query), 'Lấy fallback chatbot thành công.'),
  resolveFallback: wrap((req) => chatbotService.resolveFallback(req.params.fallbackId, req.body, req.auth), 'Resolve fallback chatbot thành công.'),
  testChatbot: wrap((req) => chatbotService.testChatbot(req.body), 'Test chatbot thành công.'),
};
