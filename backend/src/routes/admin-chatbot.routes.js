const express = require('express');
const controller = require('../controllers/admin-chatbot.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { validateObjectIdParam } = require('../common/validators');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

router.param('sessionId', validateObjectIdParam);
router.param('intentId', validateObjectIdParam);
router.param('entityId', validateObjectIdParam);
router.param('articleId', validateObjectIdParam);
router.param('fallbackId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.SUPPORT_COMMUNICATION.READ,
  PERMISSION.SUPPORT_COMMUNICATION.ANALYTICS_READ,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.MESSAGES.MANAGE,
];

const managePermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.SUPPORT_COMMUNICATION.MANAGE,
  PERMISSION.SUPPORT_COMMUNICATION.TEMPLATE_MANAGE,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.MESSAGES.MANAGE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'], anyPermissions: readPermissions }));

router.get('/dashboard', controller.getDashboard);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:sessionId', controller.getConversation);
router.post('/test', controller.testChatbot);

router.get('/intents', controller.listIntents);
router.post('/intents', authorize({ anyPermissions: managePermissions }), controller.createIntent);
router.patch('/intents/:intentId', authorize({ anyPermissions: managePermissions }), controller.updateIntent);

router.get('/entities', controller.listEntities);
router.post('/entities', authorize({ anyPermissions: managePermissions }), controller.createEntity);
router.patch('/entities/:entityId', authorize({ anyPermissions: managePermissions }), controller.updateEntity);

router.get('/knowledge/articles', controller.listKnowledgeArticles);
router.post('/knowledge/articles', authorize({ anyPermissions: managePermissions }), controller.createKnowledgeArticle);
router.patch('/knowledge/articles/:articleId', authorize({ anyPermissions: managePermissions }), controller.updateKnowledgeArticle);
router.post('/knowledge/articles/:articleId/publish', authorize({ anyPermissions: managePermissions }), controller.publishKnowledgeArticle);
router.post('/knowledge/articles/:articleId/archive', authorize({ anyPermissions: managePermissions }), controller.archiveKnowledgeArticle);
router.post('/knowledge/reindex', authorize({ anyPermissions: managePermissions }), controller.reindexKnowledge);

router.get('/fallbacks', controller.listFallbacks);
router.patch('/fallbacks/:fallbackId/resolve', authorize({ anyPermissions: managePermissions }), controller.resolveFallback);

module.exports = router;
