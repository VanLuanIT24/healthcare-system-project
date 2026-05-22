const platformConfigService = require('../services/platform-config.service');
const systemSettingService = require('../services/admin/system-setting.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getOverview: wrap(() => platformConfigService.getOverview(), 'Lay tong quan cau hinh nen tang thanh cong.'),
  getModules: wrap(() => platformConfigService.getModules(), 'Lay danh sach module cau hinh thanh cong.'),
  getModule: wrap((req) => platformConfigService.getModule(req.params.moduleKey), 'Lay module cau hinh thanh cong.'),
  getEffectiveConfigs: wrap((req) => platformConfigService.getEffectiveConfigs(req.query), 'Lay effective config thanh cong.'),
  getEffectiveConfig: wrap((req) => platformConfigService.getEffectiveConfig(req.params.settingKey), 'Lay effective config detail thanh cong.'),
  validateConfig: wrap((req) => platformConfigService.validateConfig(req.body || {}), 'Validate cau hinh thanh cong.'),
  testModule: wrap((req) => platformConfigService.testModule(req.params.moduleKey, req.body || {}), 'Test cau hinh module thanh cong.'),
  applyConfig: wrap((req) => platformConfigService.applyConfig(req.body || {}, req.auth, requestMeta(req)), 'Ap dung cau hinh thanh cong.'),
  reloadConfig: wrap((req) => platformConfigService.reloadConfig(req.auth, requestMeta(req)), 'Reload cau hinh thanh cong.'),
  getDrift: wrap(() => platformConfigService.getDrift(), 'Lay drift cau hinh thanh cong.'),
  getSecretsStatus: wrap(() => platformConfigService.getSecretsStatus(), 'Lay trang thai secrets thanh cong.'),
  getSettingRevisions: wrap((req) => systemSettingService.listSystemSettingRevisions(req.params.settingKey, req.query), 'Lay revisions setting thanh cong.'),
  rollbackSetting: wrap((req) => systemSettingService.rollbackSystemSetting(req.params.settingKey, req.body || {}, req.auth, requestMeta(req)), 'Rollback setting thanh cong.'),
};
