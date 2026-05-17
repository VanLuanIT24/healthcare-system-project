const { NotificationTemplate } = require('../models');

function valueAtPath(source = {}, path = '') {
  return String(path).split('.').reduce((value, key) => (
    value && value[key] !== undefined ? value[key] : undefined
  ), source);
}

function renderTemplate(template = '', context = {}) {
  return String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = valueAtPath(context, key);
    return value === undefined || value === null ? '' : String(value);
  });
}

async function findTemplate(eventType, language = 'vi') {
  if (!eventType) return null;
  return NotificationTemplate.findOne({
    event_type: eventType,
    language,
    active: true,
    is_deleted: false,
  }).lean();
}

async function renderNotificationContent({ eventType, payload = {}, language = 'vi', fallback = {} } = {}) {
  const template = await findTemplate(eventType, language);
  if (!template) {
    return {
      title: fallback.title,
      body: fallback.body || fallback.message,
      priority: fallback.priority,
      channels: fallback.channels || ['in_app', 'socket'],
      template: null,
    };
  }
  const context = { event_type: eventType, payload, data: payload };
  return {
    title: renderTemplate(template.title_template, context),
    body: renderTemplate(template.body_template, context),
    priority: fallback.priority || template.priority,
    channels: fallback.channels || template.channels || ['in_app', 'socket'],
    template,
  };
}

module.exports = {
  renderTemplate,
  findTemplate,
  renderNotificationContent,
};
