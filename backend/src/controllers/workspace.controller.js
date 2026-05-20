const workspaceAccessService = require('../services/workspace-access.service');
const userPreferenceService = require('../services/user-preference.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  getAvailableWorkspaces: wrap(async (req) => {
    const preferencePayload = await userPreferenceService.getPreferences(req.auth);
    const currentWorkspace = preferencePayload.preferences?.current_workspace || 'nursing';
    return workspaceAccessService.getAvailableWorkspaces(req.auth, { current_workspace: currentWorkspace });
  }, 'Lấy danh sách workspace khả dụng thành công.'),
};
