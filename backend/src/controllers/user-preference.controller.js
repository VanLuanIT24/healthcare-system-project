const userPreferenceService = require('../services/user-preference.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  getMyPreferences: wrap((req) => userPreferenceService.getPreferences(req.auth), 'Lấy user preferences thành công.'),
  updateMyPreferences: wrap((req) => userPreferenceService.updatePreferences(req.body, req.auth), 'Cập nhật user preferences thành công.'),
};
