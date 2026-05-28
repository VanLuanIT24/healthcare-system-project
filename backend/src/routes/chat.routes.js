const express = require('express');
const chatController = require('../controllers/chat.controller');
const authenticate = require('../middleware/authenticate');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('sessionId', validateObjectIdParam);

function optionalAuthenticate(req, res, next) {
  if (!req.get('authorization')) return next();
  return authenticate(req, res, next);
}

router.use(optionalAuthenticate);

router.post('/sessions', chatController.createSession);
router.get('/sessions/:sessionId', chatController.getSession);
router.get('/sessions/:sessionId/messages', chatController.listMessages);
router.post('/sessions/:sessionId/messages', chatController.sendMessage);
router.post('/sessions/:sessionId/escalate', chatController.escalateSession);
router.post('/sessions/:sessionId/handoff/accept', authenticate, chatController.acceptHandoff);
router.patch('/sessions/:sessionId/close', chatController.closeSession);

module.exports = router;
