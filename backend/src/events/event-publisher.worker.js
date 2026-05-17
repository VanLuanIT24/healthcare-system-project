const eventBus = require('./event-bus.service');

async function runOnce(options = {}) {
  return eventBus.publishPendingEvents(options);
}

module.exports = {
  runOnce,
};
