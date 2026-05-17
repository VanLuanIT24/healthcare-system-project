const { REALTIME_EVENT_TYPE, REALTIME_EVENT_TYPES } = require('../constants/statuses');
const {
  DOMAIN_EVENT_TYPE,
  DOMAIN_EVENT_TYPES,
  isCanonicalEventType,
  buildDomainEventEnvelope,
} = require('./domain-event-taxonomy');

module.exports = {
  REALTIME_EVENT_TYPE,
  REALTIME_EVENT_TYPES,
  DOMAIN_EVENT_TYPE,
  DOMAIN_EVENT_TYPES,
  isCanonicalEventType,
  buildDomainEventEnvelope,
};
