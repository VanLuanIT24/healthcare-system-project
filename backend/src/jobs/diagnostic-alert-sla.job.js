const diagnosticAlertService = require('../services/diagnostic-alert.service');

async function runCriticalAckSlaJob(actor = {}) {
  const systemActor = {
    actorType: 'staff',
    actor_type: 'staff',
    permissions: ['system.full_access'],
    ...actor,
  };
  return diagnosticAlertService.runDiagnosticAlertSlaSweep(systemActor);
}

module.exports = {
  runCriticalAckSlaJob,
};
