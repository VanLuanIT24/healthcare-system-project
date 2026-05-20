const express = require('express');
const workspaceController = require('../controllers/workspace.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/available', workspaceController.getAvailableWorkspaces);

module.exports = router;
