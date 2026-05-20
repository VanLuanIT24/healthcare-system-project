const express = require('express');
const userPreferenceController = require('../controllers/user-preference.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff', 'patient', 'patient_relative'] }));

router.get('/me', userPreferenceController.getMyPreferences);
router.patch('/me', userPreferenceController.updateMyPreferences);
router.patch('/me/current-workspace', userPreferenceController.updateCurrentWorkspace);

module.exports = router;
