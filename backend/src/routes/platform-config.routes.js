const express = require('express');
const platformConfigController = require('../controllers/platform-config.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

const readAccess = authorize({
  anyPermissions: [PERMISSION.SETTINGS.READ, PERMISSION.SYSTEM.HEALTH_READ, PERMISSION.SYSTEM.FULL_ACCESS],
});
const writeAccess = authorize({
  anyPermissions: [PERMISSION.SETTINGS.UPDATE, PERMISSION.SETTINGS.UPDATE_SENSITIVE, PERMISSION.SYSTEM.FULL_ACCESS],
});

router.get('/overview', readAccess, platformConfigController.getOverview);
router.get('/modules', readAccess, platformConfigController.getModules);
router.get('/modules/:moduleKey', readAccess, platformConfigController.getModule);
router.get('/effective', readAccess, platformConfigController.getEffectiveConfigs);
router.get('/effective/:settingKey', readAccess, platformConfigController.getEffectiveConfig);
router.post('/validate', readAccess, platformConfigController.validateConfig);
router.post('/test/:moduleKey', readAccess, platformConfigController.testModule);
router.post('/apply', writeAccess, platformConfigController.applyConfig);
router.post('/reload', writeAccess, platformConfigController.reloadConfig);
router.get('/drift', readAccess, platformConfigController.getDrift);
router.get('/secrets/status', readAccess, platformConfigController.getSecretsStatus);
router.get('/settings/:settingKey/revisions', readAccess, platformConfigController.getSettingRevisions);
router.post('/settings/:settingKey/rollback', writeAccess, platformConfigController.rollbackSetting);

module.exports = router;
