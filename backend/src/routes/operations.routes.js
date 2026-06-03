const express = require('express');
const operationsController = require('../controllers/operations.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

const readPermissions = [
  PERMISSION.OPERATIONS?.READ,
  PERMISSION.COMMAND_CENTER?.READ,
  PERMISSION.COMMAND_CENTER?.VIEW_OPS,
  PERMISSION.AUDIT_LOGS.READ,
  PERMISSION.SETTINGS.READ,
  PERMISSION.SYSTEM.HEALTH_READ,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

const managePermissions = [
  PERMISSION.OPERATIONS?.MANAGE,
  PERMISSION.COMMAND_CENTER?.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

const retryPermissions = [
  PERMISSION.OPERATIONS?.RETRY,
  PERMISSION.OPERATIONS?.REPLAY,
  PERMISSION.COMMAND_CENTER?.RETRY_OPS,
  PERMISSION.NOTIFICATIONS.RETRY,
  PERMISSION.NOTIFICATIONS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

const realtimePermissions = [
  PERMISSION.OPERATIONS?.REALTIME_MANAGE,
  PERMISSION.COMMAND_CENTER?.VIEW_OPS,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

const schedulingReadPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.SCHEDULES.READ,
  PERMISSION.SCHEDULES.READ_DEPARTMENT,
  PERMISSION.SCHEDULES.READ_OWN,
  PERMISSION.APPOINTMENTS.READ,
  PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
  PERMISSION.APPOINTMENTS.READ_OWN,
  PERMISSION.QUEUE.READ,
  PERMISSION.QUEUE.READ_DEPARTMENT,
  PERMISSION.QUEUE.READ_OWN,
  PERMISSION.REPORTS.APPOINTMENTS_READ,
  PERMISSION.REPORTS.QUEUE_READ,
].filter(Boolean);

const fileScanPermissions = [
  PERMISSION.OPERATIONS?.FILE_SCAN_MANAGE,
  PERMISSION.ATTACHMENTS.MANAGE,
  PERMISSION.DOCUMENTS.REVIEW,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

const diagnosticsPermissions = [
  PERMISSION.OPERATIONS?.DIAGNOSTICS_RUN,
  PERMISSION.COMMAND_CENTER?.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

const maintenancePermissions = [
  PERMISSION.OPERATIONS?.MAINTENANCE_MANAGE,
  PERMISSION.COMMAND_CENTER?.MAINTENANCE,
  PERMISSION.SETTINGS.UPDATE,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

router.get('/dashboard', authorize({ anyPermissions: readPermissions }), operationsController.getDashboard);
router.get('/dashboard/today', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getSchedulingDashboardToday);
router.get('/hourly-flow', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getSchedulingHourlyFlow);
router.get('/queue/current', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueCurrent);
router.get('/queue/board', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueBoard);
router.get('/queue/today', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueToday);
router.get('/queue/call-console', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueCallConsole);
router.get('/queue/transfer-candidates', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueTransferCandidates);
router.get('/queue/missed-no-show', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueMissedNoShow);
router.get('/queue/:ticketId/context', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueTicketContext);
router.get('/queue/:ticketId/available-actions', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueAvailableActions);
router.get('/patient-flow/today', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getPatientFlowToday);
router.get('/patient-flow/check-in-monitor', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getPatientFlowCheckInMonitor);
router.get('/patient-flow/waiting', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getPatientFlowWaiting);
router.get('/patient-flow/in-consultation', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getPatientFlowInConsultation);
router.get('/patient-flow/needs-action', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getPatientFlowNeedsAction);
router.get('/patient-flow/completed', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getPatientFlowCompleted);
router.get('/patient-flow/:flowId/context', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getPatientFlowContext);
router.post('/patient-flow/actions/:alertId/acknowledge', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.acknowledgePatientFlowAlert);
router.post('/patient-flow/actions/:alertId/assign-to-me', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.assignPatientFlowAlertToMe);
router.post('/patient-flow/actions/:alertId/resolve', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.resolvePatientFlowAlert);
router.get('/resources/load', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsResourcesLoad);
router.get('/resources/departments', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsResourceDepartments);
router.get('/resources/doctors', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsResourceDoctors);
router.get('/resources/rooms', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsResourceRooms);
router.get('/resources/doctor-load', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsDoctorLoad);
router.get('/resources/room-status', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsRoomStatus);
router.get('/resources/attention', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsResourceAttention);
router.post('/resources/attention/:attentionId/acknowledge', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.acknowledgeResourceAttention);
router.post('/resources/attention/:attentionId/assign', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.assignResourceAttention);
router.post('/resources/attention/:attentionId/resolve', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.resolveResourceAttention);
router.get('/slots/capacity', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsSlotsCapacity);
router.get('/alerts/summary', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsAlertsSummary);
router.get('/alerts/action-center', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsAlertActionCenter);
router.get('/alerts/schedule-slot', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsScheduleSlotAlerts);
router.get('/alerts/queue', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsQueueAlerts);
router.get('/alerts/doctor-department', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsDoctorDepartmentAlerts);
router.get('/alerts/no-show', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsNoShowAlerts);
router.get('/alerts/:alertId', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsAlertDetail);
router.post('/alerts/:alertId/acknowledge', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.acknowledgeOperationAlert);
router.post('/alerts/:alertId/assign', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.assignOperationAlert);
router.post('/alerts/:alertId/escalate', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.escalateOperationAlert);
router.post('/alerts/:alertId/resolve', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.resolveOperationAlert);
router.post('/alerts/:alertId/dismiss', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.dismissOperationAlert);
router.post('/alerts/:alertId/execute-action', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.executeOperationAlertAction);
router.get('/alerts', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsAlerts);
router.get('/activity/doctor-schedules', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsActivityDoctorSchedules);
router.get('/activity/appointments', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsActivityAppointments);
router.get('/activity/slots', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsActivitySlots);
router.get('/activity/queue', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsActivityQueue);
router.get('/activity/check-in', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsActivityCheckIn);
router.get('/activity/export', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.exportOperationsActivity);
router.get('/activity/:activityId', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsActivityDetail);
router.get('/activity', authorize({ anyPermissions: schedulingReadPermissions }), operationsController.getOperationsActivity);
router.get('/health', authorize({ anyPermissions: readPermissions }), operationsController.getHealth);

router.get('/jobs', authorize({ anyPermissions: readPermissions }), operationsController.getJobs);
router.post('/jobs/:jobName/run-now', authorize({ anyPermissions: managePermissions }), operationsController.runJobNow);
router.get('/job-runs', authorize({ anyPermissions: readPermissions }), operationsController.listJobRuns);
router.get('/job-runs/:runId', authorize({ anyPermissions: readPermissions }), operationsController.getJobRun);
router.post('/job-runs/:runId/retry', authorize({ anyPermissions: managePermissions }), operationsController.retryJobRun);
router.get('/queues', authorize({ anyPermissions: readPermissions }), operationsController.listQueues);
router.get('/queues/:queueName/stats', authorize({ anyPermissions: readPermissions }), operationsController.getQueueStats);
router.post('/queues/:queueName/pause', authorize({ anyPermissions: managePermissions }), operationsController.pauseQueue);
router.post('/queues/:queueName/resume', authorize({ anyPermissions: managePermissions }), operationsController.resumeQueue);
router.post('/queues/:queueName/drain', authorize({ anyPermissions: managePermissions }), operationsController.drainQueue);

router.get('/event-outbox/summary', authorize({ anyPermissions: readPermissions }), operationsController.getEventOutboxSummary);
router.post('/event-outbox/bulk-retry', authorize({ anyPermissions: retryPermissions }), operationsController.bulkRetryEvents);
router.get('/event-outbox', authorize({ anyPermissions: readPermissions }), operationsController.listEventOutbox);
router.get('/event-outbox/:eventId', authorize({ anyPermissions: readPermissions }), operationsController.getEventOutboxDetail);
router.post('/event-outbox/:eventId/retry', authorize({ anyPermissions: retryPermissions }), operationsController.retryEvent);
router.post('/event-outbox/:eventId/replay', authorize({ anyPermissions: retryPermissions }), operationsController.replayEvent);
router.post('/event-outbox/:eventId/unlock', authorize({ anyPermissions: retryPermissions }), operationsController.unlockEvent);
router.post('/event-outbox/:eventId/mark-dead-letter', authorize({ anyPermissions: retryPermissions }), operationsController.markEventDeadLetter);
router.get('/dead-letter-events', authorize({ anyPermissions: readPermissions }), operationsController.listDeadLetterEvents);
router.post('/dead-letter-events/:eventId/retry', authorize({ anyPermissions: retryPermissions }), operationsController.retryEvent);
router.post('/dead-letter-events/:eventId/replay', authorize({ anyPermissions: retryPermissions }), operationsController.replayEvent);
router.post('/events/retry-preview', authorize({ anyPermissions: readPermissions }), operationsController.retryPreview);
router.post('/events/retry', authorize({ anyPermissions: retryPermissions }), operationsController.retryConsole);
router.post('/events/replay', authorize({ anyPermissions: retryPermissions }), operationsController.replayConsole);
router.post('/events/dry-run', authorize({ anyPermissions: readPermissions }), operationsController.dryRunEvent);

router.get('/notification-deliveries/summary', authorize({ anyPermissions: readPermissions }), operationsController.getNotificationDeliveriesSummary);
router.post('/notification-deliveries/bulk-retry', authorize({ anyPermissions: retryPermissions }), operationsController.bulkRetryNotificationDeliveries);
router.get('/notification-deliveries', authorize({ anyPermissions: readPermissions }), operationsController.listNotificationDeliveries);
router.get('/notification-deliveries/:deliveryId', authorize({ anyPermissions: readPermissions }), operationsController.getNotificationDeliveryDetail);
router.post('/notification-deliveries/:deliveryId/retry', authorize({ anyPermissions: retryPermissions }), operationsController.retryNotificationDelivery);
router.post('/notification-deliveries/:deliveryId/mark-skipped', authorize({ anyPermissions: retryPermissions }), operationsController.markNotificationDeliverySkipped);
router.get('/notification-failures/groups', authorize({ anyPermissions: readPermissions }), operationsController.getNotificationFailureGroups);
router.post('/notification-failures/groups/:groupKey/retry', authorize({ anyPermissions: retryPermissions }), operationsController.retryNotificationFailureGroup);

router.get('/realtime/status', authorize({ anyPermissions: readPermissions }), operationsController.getRealtimeStatus);
router.get('/realtime/rooms', authorize({ anyPermissions: readPermissions }), operationsController.listRealtimeRooms);
router.post('/realtime/resolve-rooms', authorize({ anyPermissions: readPermissions }), operationsController.resolveRealtimeRooms);
router.post('/realtime/test-emit', authorize({ anyPermissions: realtimePermissions }), operationsController.testRealtimeEmit);
router.get('/socket-presence', authorize({ anyPermissions: readPermissions }), operationsController.listSocketPresence);
router.get('/socket-presence/:actorType/:actorId', authorize({ anyPermissions: readPermissions }), operationsController.getSocketPresenceActor);
router.post('/socket-presence/:socketId/disconnect', authorize({ anyPermissions: realtimePermissions }), operationsController.disconnectSocket);
router.post('/socket-presence/prune-stale', authorize({ anyPermissions: realtimePermissions }), operationsController.pruneSocketPresence);

router.get('/idempotency-records/summary', authorize({ anyPermissions: readPermissions }), operationsController.getIdempotencySummary);
router.post('/idempotency-records/cleanup-expired', authorize({ anyPermissions: managePermissions }), operationsController.cleanupExpiredIdempotencyRecords);
router.get('/idempotency-records', authorize({ anyPermissions: readPermissions }), operationsController.listIdempotencyRecords);
router.get('/idempotency-records/:recordId', authorize({ anyPermissions: readPermissions }), operationsController.getIdempotencyRecord);
router.post('/idempotency-records/:recordId/unlock', authorize({ anyPermissions: managePermissions }), operationsController.unlockIdempotencyRecord);
router.post('/idempotency-records/:recordId/expire', authorize({ anyPermissions: managePermissions }), operationsController.expireIdempotencyRecord);

router.get('/qr-tokens/summary', authorize({ anyPermissions: readPermissions }), operationsController.getQrTokensSummary);
router.post('/qr-tokens/bulk-revoke', authorize({ anyPermissions: managePermissions }), operationsController.bulkRevokeQrTokens);
router.post('/qr-tokens/cleanup-expired', authorize({ anyPermissions: managePermissions }), operationsController.cleanupExpiredQrTokens);
router.get('/qr-tokens', authorize({ anyPermissions: readPermissions }), operationsController.listQrTokens);
router.get('/qr-tokens/:qrTokenId', authorize({ anyPermissions: readPermissions }), operationsController.getQrToken);
router.post('/qr-tokens/:qrTokenId/revoke', authorize({ anyPermissions: managePermissions }), operationsController.revokeQrToken);

router.get('/file-scans/summary', authorize({ anyPermissions: readPermissions }), operationsController.getFileScansSummary);
router.get('/file-scans/provider-health', authorize({ anyPermissions: readPermissions }), operationsController.getFileScanProviderHealth);
router.post('/file-scans/bulk-rescan', authorize({ anyPermissions: fileScanPermissions }), operationsController.bulkRescanFiles);
router.post('/file-scans/bulk-quarantine', authorize({ anyPermissions: fileScanPermissions }), operationsController.bulkQuarantineFiles);
router.get('/file-scans', authorize({ anyPermissions: readPermissions }), operationsController.listFileScans);

router.get('/diagnostics/runs', authorize({ anyPermissions: readPermissions }), operationsController.listDiagnosticRuns);
router.get('/diagnostics/runs/:runId', authorize({ anyPermissions: readPermissions }), operationsController.getDiagnosticRun);
router.get('/diagnostics', authorize({ anyPermissions: readPermissions }), operationsController.getDiagnostics);
router.post('/diagnostics/run', authorize({ anyPermissions: diagnosticsPermissions }), operationsController.runDiagnostics);
router.post('/diagnostics/run/:checkName', authorize({ anyPermissions: diagnosticsPermissions }), operationsController.runDiagnosticCheck);

router.get('/maintenance', authorize({ anyPermissions: readPermissions }), operationsController.getMaintenance);
router.post('/maintenance/start', authorize({ anyPermissions: maintenancePermissions }), operationsController.startMaintenance);
router.post('/maintenance/end', authorize({ anyPermissions: maintenancePermissions }), operationsController.endMaintenance);
router.patch('/maintenance/:maintenanceId', authorize({ anyPermissions: maintenancePermissions }), operationsController.updateMaintenance);
router.post('/maintenance/:maintenanceId/end', authorize({ anyPermissions: maintenancePermissions }), operationsController.endMaintenance);
router.post('/maintenance/preview', authorize({ anyPermissions: readPermissions }), operationsController.previewMaintenance);

module.exports = router;
