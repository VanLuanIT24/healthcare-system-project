const { Notification } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  notificationRepository: Notification,
});
