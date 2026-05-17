const env = require('../../config/env');

const CHANNEL_CONFIG = {
  push: {
    url: () => env.pushProviderUrl,
    token: () => env.pushProviderToken,
  },
};

async function postJson(url, token, body) {
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`provider_http_${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return response.json().catch(() => ({}));
}

async function send(channel, notification = {}, delivery = {}) {
  const config = CHANNEL_CONFIG[channel];
  const url = config?.url();
  if (!url) throw new Error(`${channel}_provider_not_configured`);
  const result = await postJson(url, config.token(), {
    notification_id: String(notification._id || notification.id),
    recipient_type: notification.recipient_type,
    recipient_id: String(notification.recipient_id),
    title: notification.title,
    body: notification.body || notification.message,
    data: notification.data || notification.payload || {},
    delivery_payload: delivery.payload || {},
  });
  return {
    provider: delivery.provider || channel,
    provider_message_id: result.id || result.message_id || result.messageId,
    delivered: Boolean(result.delivered),
    sent: true,
    raw: result,
  };
}

function isEnabled(channel) {
  const config = CHANNEL_CONFIG[channel];
  if (!config) return false;
  const url = config.url();
  const token = config.token();
  return Boolean(url && token);
}

module.exports = {
  isEnabled,
  send,
};
