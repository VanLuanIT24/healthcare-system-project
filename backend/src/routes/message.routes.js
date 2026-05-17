const express = require('express');
const messageController = require('../controllers/message.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { createActionRateLimit } = require('../middleware/action-rate-limit');

const router = express.Router();

router.param('conversationId', validateObjectIdParam);
router.param('callId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff', 'patient', 'patient_relative'] }));

const readMessagePermissions = [
  PERMISSION.MESSAGES.SELF_READ,
  PERMISSION.MESSAGES.STAFF_READ,
  PERMISSION.MESSAGES.INTERNAL_READ,
  PERMISSION.MESSAGES.MANAGE,
];

const sendMessagePermissions = [
  PERMISSION.MESSAGES.SELF_SEND,
  PERMISSION.MESSAGES.STAFF_SEND,
  PERMISSION.MESSAGES.INTERNAL_SEND,
  PERMISSION.MESSAGES.MANAGE,
];

const moderateMessagePermissions = [
  PERMISSION.MESSAGES.ASSIGN,
  PERMISSION.MESSAGES.CLOSE,
  PERMISSION.MESSAGES.MANAGE,
];

const messageSendLimit = createActionRateLimit({
  action: 'message-send',
  limit: 30,
  windowMs: 60 * 1000,
  keyGenerator: (req) => req.params.conversationId,
  message: 'Gửi tin nhắn quá nhanh. Vui lòng thử lại sau.',
});

router.get('/conversations', authorize({ anyPermissions: readMessagePermissions }), messageController.listConversations);
router.post('/conversations', authorize({ anyPermissions: sendMessagePermissions }), messageController.createConversation);
router.get('/conversations/:conversationId', authorize({ anyPermissions: readMessagePermissions }), messageController.getConversation);
router.post('/conversations/:conversationId/calls', authorize({ anyPermissions: sendMessagePermissions }), messageController.createCall);
router.get('/conversations/:conversationId/calls/:callId', authorize({ anyPermissions: readMessagePermissions }), messageController.getCall);
router.post('/conversations/:conversationId/calls/:callId/start', authorize({ anyPermissions: sendMessagePermissions }), messageController.startCall);
router.post('/conversations/:conversationId/calls/:callId/end', authorize({ anyPermissions: sendMessagePermissions }), messageController.endCall);
router.post('/conversations/:conversationId/calls/:callId/transcript', authorize({ anyPermissions: sendMessagePermissions }), messageController.updateCallTranscript);
router.post('/conversations/:conversationId/calls/:callId/save-as-clinical-note', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.MESSAGES.STAFF_SEND, PERMISSION.MESSAGES.MANAGE] }), messageController.saveCallAsClinicalNote);
router.get('/conversations/:conversationId/messages', authorize({ anyPermissions: readMessagePermissions }), messageController.listMessages);
router.post('/conversations/:conversationId/messages', authorize({ anyPermissions: sendMessagePermissions }), messageSendLimit, messageController.sendMessage);
router.post('/conversations/:conversationId/read', authorize({ anyPermissions: readMessagePermissions }), messageController.markRead);
router.post('/conversations/:conversationId/archive', authorize({ anyPermissions: readMessagePermissions }), messageController.archiveConversation);
router.post('/conversations/:conversationId/close', authorize({ anyPermissions: [PERMISSION.MESSAGES.CLOSE, PERMISSION.MESSAGES.MANAGE] }), messageController.closeConversation);
router.post('/conversations/:conversationId/reopen', authorize({ anyPermissions: moderateMessagePermissions }), messageController.reopenConversation);
router.post('/conversations/:conversationId/assign', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.MESSAGES.ASSIGN, PERMISSION.MESSAGES.MANAGE] }), messageController.assignConversation);
router.post('/conversations/:conversationId/escalate', authorize({ actorTypes: ['staff'], anyPermissions: moderateMessagePermissions }), messageController.escalateConversation);
router.post('/conversations/:conversationId/attachments', authorize({ anyPermissions: sendMessagePermissions }), messageController.addAttachments);

module.exports = router;
