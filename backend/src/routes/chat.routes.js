const express = require('express');
const chatController = require('../controllers/chat.controller');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('sessionId', validateObjectIdParam);

router.post('/sessions', chatController.createSession);
router.get('/sessions/:sessionId', chatController.getSession);
router.get('/sessions/:sessionId/messages', chatController.listMessages);
router.post('/sessions/:sessionId/messages', chatController.sendMessage);
router.post('/sessions/:sessionId/escalate', chatController.escalateSession);
router.patch('/sessions/:sessionId/close', chatController.closeSession);

module.exports = router;
