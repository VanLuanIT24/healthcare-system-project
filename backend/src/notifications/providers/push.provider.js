const httpChannelProvider = require('./http-channel.provider');

async function send(notification, delivery) {
  return httpChannelProvider.send('push', notification, delivery);
}

module.exports = {
  isEnabled: () => httpChannelProvider.isEnabled('push'),
  send,
};
