import { request, unwrapData } from '../utils/api';

function listOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.table)) return value.table;
  return [];
}

function flattenBoard(board = {}) {
  return Object.values(board || {}).flatMap((items) => (Array.isArray(items) ? items : []));
}

const mongoObjectIdPattern = /^[a-f\d]{24}$/i;

function requireMongoId(value, fieldName = 'id') {
  const id = String(value || '');
  if (!mongoObjectIdPattern.test(id)) {
    throw new Error(`Chưa có ${fieldName} hợp lệ từ hệ thống.`);
  }
  return id;
}

function sanitizeClinicalContextBody(body = {}) {
  const next = { ...body };
  for (const field of ['encounter_id', 'queue_ticket_id', 'appointment_id', 'related_task_id', 'related_alert_id']) {
    if (next[field] && !mongoObjectIdPattern.test(String(next[field]))) delete next[field];
  }
  if (!next.encounter_id && !next.queue_ticket_id && !next.appointment_id) {
    throw new Error('Chưa có lượt khám, số hàng đợi hoặc lịch hẹn hợp lệ từ hệ thống.');
  }
  return next;
}

function normalizeQueueBoardPayload(payload = {}) {
  const table = listOf(payload.table).length ? listOf(payload.table) : flattenBoard(payload.board);
  const summary = payload.summary || {};
  const checkedIn = summary.total ?? table.length;
  const waitingNurse = table.filter((item) => ['waiting_nurse', 'not_started', undefined, null].includes(item?.nursing_stage)).length;
  const triageItems = table.filter((item) => ['triage_pending', 'triage_in_progress'].includes(item?.nursing_stage));
  const readyItems = table.filter((item) => item?.nursing_stage === 'ready_for_doctor');
  const vitalPending = table.filter((item) => ['vital_pending', 'waiting_nurse', 'not_started', undefined, null].includes(item?.nursing_stage)).length;

  return {
    meta: payload.meta || {},
    intake: {
      summary: {
        checked_in: checkedIn,
        waiting_nurse: waitingNurse,
        nurse_in_progress: table.filter((item) => item?.nursing_stage === 'nurse_in_progress').length,
        triage_waiting: triageItems.length,
        triage_in_progress: table.filter((item) => item?.nursing_stage === 'triage_in_progress').length,
        vital_pending: vitalPending,
        abnormal_vitals: payload.metrics?.abnormal_vitals || 0,
        ready_for_doctor: readyItems.length,
        sla_breached: payload.metrics?.sla_breached || summary.sla_breached || 0,
      },
      checked_in_items: table,
      ready_items: readyItems,
      triage_items: triageItems.length ? triageItems : table.filter((item) => item?.queue_type === 'priority'),
      priority_lane: {
        immediate: table.filter((item) => ['priority', 'vip'].includes(item?.queue_type)).slice(0, 8),
        longest_waiting: [...table].sort((a, b) => (b?.waiting_minutes || 0) - (a?.waiting_minutes || 0)).slice(0, 8),
        unassigned: table.filter((item) => !item?.assigned_nurse_id).slice(0, 8),
      },
    },
    queue: {
      ...summary,
      table,
      board: payload.board || {},
      total: summary.total ?? table.length,
      waiting: summary.waiting ?? table.filter((item) => item?.status === 'waiting').length,
      called: summary.called ?? table.filter((item) => item?.status === 'called').length,
      in_service: summary.in_service ?? table.filter((item) => item?.status === 'in_service').length,
      skipped: summary.skipped ?? table.filter((item) => item?.status === 'skipped').length,
      completed: summary.completed ?? table.filter((item) => item?.status === 'completed').length,
      no_show: summary.no_show ?? table.filter((item) => item?.status === 'no_show').length,
    },
    vitals: {
      pending: vitalPending,
      abnormal: payload.metrics?.abnormal_vitals || 0,
      pending_items: table.filter((item) => ['vital_pending', 'waiting_nurse', 'not_started', undefined, null].includes(item?.nursing_stage)),
      abnormal_items: [],
    },
    triage: {
      pending: triageItems.length,
      in_progress: table.filter((item) => item?.nursing_stage === 'triage_in_progress').length,
      completed: table.filter((item) => item?.nursing_stage === 'triage_done').length,
      high_priority: table.filter((item) => ['priority', 'vip'].includes(item?.queue_type)).length,
      pending_items: triageItems.length ? triageItems : table.filter((item) => item?.queue_type === 'priority'),
    },
    activity_feed: [],
    priority_alerts: [],
  };
}

function buildIntakeWorklist(payload = {}) {
  const dashboard = normalizeQueueBoardPayload(payload);
  const items = dashboard.intake.checked_in_items;
  return {
    meta: dashboard.meta,
    summary: dashboard.intake.summary,
    items,
    lanes: {
      waiting_nurse: items.filter((item) => ['waiting_nurse', 'not_started', undefined, null].includes(item?.nursing_stage)),
      in_progress: items.filter((item) => item?.nursing_stage === 'nurse_in_progress'),
      vital_pending: dashboard.vitals.pending_items,
      triage_pending: dashboard.triage.pending_items,
      ready_for_doctor: dashboard.intake.ready_items,
    },
  };
}

async function getQueueBoardPayload(params = {}) {
  return unwrapData(await request('/nursing/queue/board', { params }));
}

export const nurseDashboardApi = {
  getOverview: async (params = {}) =>
    unwrapData(await request('/nursing/dashboard/overview', { params })),
  getWorklist: async (params = {}) =>
    unwrapData(await request('/nursing/dashboard/worklist', { params })),
  getPriorityAlerts: async (params = {}) =>
    unwrapData(await request('/nursing/dashboard/priority-alerts', { params })),
  getPendingVitals: async (params = {}) =>
    unwrapData(await request('/nursing/vitals/pending', { params })),
  getAbnormalVitals: async (params = {}) =>
    unwrapData(await request('/nursing/vitals/abnormal', { params })),
};

export const nurseTopbarApi = {
  bootstrap: async (params = {}) =>
    unwrapData(await request('/nursing/topbar/bootstrap', { params })),
  search: async (params = {}) =>
    unwrapData(await request('/nursing/search', { params })),
  shiftSummary: async (params = {}) =>
    unwrapData(await request('/nursing/shift-summary', { params })),
  availableWorkspaces: async () =>
    unwrapData(await request('/workspaces/available')),
  setCurrentWorkspace: async (workspace) =>
    unwrapData(await request('/preferences/me/current-workspace', { method: 'PATCH', body: { current_workspace: workspace } })),
};

export const nurseOperationsApi = {
  getIntakeDashboard: async (params = {}) =>
    normalizeQueueBoardPayload(await getQueueBoardPayload(params)),
  getIntakeWorklist: async (params = {}) =>
    buildIntakeWorklist(await getQueueBoardPayload(params)),
  getQueueContext: async (ticketId) =>
    unwrapData(await request(`/nursing/intake/queue/${encodeURIComponent(ticketId)}/context`)),
  claimIntake: async (ticketId) =>
    unwrapData(await request(`/nursing/intake/${encodeURIComponent(ticketId)}/claim`, { method: 'POST', body: {} })),
  releaseIntake: async (ticketId) =>
    unwrapData(await request(`/nursing/intake/${encodeURIComponent(ticketId)}/release`, { method: 'POST', body: {} })),
  startIntake: async (ticketId) =>
    unwrapData(await request(`/nursing/intake/${encodeURIComponent(ticketId)}/start`, { method: 'POST', body: {} })),
  completeIntake: async (ticketId, body = {}) =>
    unwrapData(await request(`/nursing/intake/${encodeURIComponent(ticketId)}/complete`, { method: 'POST', body })),
  getPendingPatients: async (params = {}) =>
    unwrapData(await request('/nursing/pending-patients', { params })),
  assignWorkItemToMe: async (workItemId) =>
    unwrapData(await request(`/nursing/work-items/${encodeURIComponent(workItemId)}/assign-to-me`, { method: 'POST', body: {} })),
  completeWorkItem: async (workItemId, body = {}) =>
    unwrapData(await request(`/nursing/work-items/${encodeURIComponent(workItemId)}/complete`, { method: 'POST', body })),
  getTasksBoard: async (params = {}) =>
    unwrapData(await request('/nursing/tasks/board', { params })),
  assignTaskToMe: async (taskId) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/assign-to-me`, { method: 'POST', body: {} })),
  startTask: async (taskId) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/start`, { method: 'POST', body: {} })),
  completeTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST', body })),
  getPriorityAlerts: async (params = {}) =>
    unwrapData(await request('/nursing/priority-alerts', { params })),
  acknowledgeAlert: async (alertId) =>
    unwrapData(await request(`/nursing/priority-alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body: {} })),
  notifyDoctorAlert: async (alertId) =>
    unwrapData(await request(`/nursing/priority-alerts/${encodeURIComponent(alertId)}/notify-doctor`, { method: 'POST', body: {} })),
  resolveAlert: async (alertId, body = {}) =>
    unwrapData(await request(`/nursing/priority-alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body })),
  getQueueBoard: async (params = {}) =>
    unwrapData(await request('/nursing/queue/board', { params })),
  getQueueMetrics: async (params = {}) =>
    unwrapData(await request('/nursing/queue/metrics', { params })),
  callNextQueue: async (body = {}) =>
    unwrapData(await request('/queue/call-next', { method: 'POST', body })),
  callQueue: async (ticketId, body = {}) =>
    unwrapData(await request(`/queue/${encodeURIComponent(ticketId)}/call`, { method: 'POST', body })),
  recallQueue: async (ticketId) =>
    unwrapData(await request(`/queue/${encodeURIComponent(ticketId)}/recall`, { method: 'POST', body: {} })),
  skipQueue: async (ticketId, body = {}) =>
    unwrapData(await request(`/queue/${encodeURIComponent(ticketId)}/skip`, { method: 'POST', body })),
  markNoShow: async (ticketId, body = {}) =>
    unwrapData(await request(`/queue/${encodeURIComponent(ticketId)}/mark-no-show`, { method: 'POST', body })),
  cancelQueue: async (ticketId, body = {}) =>
    unwrapData(await request(`/queue/${encodeURIComponent(ticketId)}/cancel`, { method: 'POST', body })),
  startService: async (ticketId) =>
    unwrapData(await request(`/queue/${encodeURIComponent(ticketId)}/start-service`, { method: 'POST', body: {} })),
  reorderPriority: async (ticketId, body = {}) =>
    unwrapData(await request(`/queue/${encodeURIComponent(ticketId)}/reorder-priority`, { method: 'POST', body })),
  transferQueue: async (ticketId, body = {}) =>
    unwrapData(await request(`/queue/${encodeURIComponent(ticketId)}/transfer`, { method: 'POST', body })),
  getTriageWorklist: async (params = {}) => {
    const payload = unwrapData(await request('/nursing/triage/pending', { params }));
    return {
      meta: payload.meta || {},
      summary: payload.summary || payload,
      items: payload.items || payload.pending_items || [],
    };
  },
  createTriage: async (body = {}) =>
    unwrapData(await request('/nursing/triage', { method: 'POST', body })),
  updateTriage: async (triageId, body = {}) =>
    unwrapData(await request(`/nursing/triage/${encodeURIComponent(triageId)}`, { method: 'PATCH', body })),
  startTriage: async (triageId) =>
    unwrapData(await request(`/nursing/triage/${encodeURIComponent(triageId)}/start`, { method: 'POST', body: {} })),
  completeTriage: async (triageId, body = {}) =>
    unwrapData(await request(`/nursing/triage/${encodeURIComponent(triageId)}/complete`, { method: 'POST', body })),
  getReadyForDoctor: async (params = {}) => {
    const dashboard = normalizeQueueBoardPayload(await getQueueBoardPayload(params));
    const items = dashboard.intake.ready_items.length
      ? dashboard.intake.ready_items
      : dashboard.intake.checked_in_items.filter((item) => ['called', 'waiting', 'recalled'].includes(item?.status));
    return {
      meta: dashboard.meta,
      summary: {
        total: items.length,
        priority: items.filter((item) => ['priority', 'vip'].includes(item?.queue_type)).length,
        called: items.filter((item) => item?.status === 'called').length,
        in_service: items.filter((item) => item?.status === 'in_service').length,
        waiting_after_ready: items.filter((item) => (item?.waiting_minutes || 0) >= 10).length,
      },
      items,
    };
  },
  markReadyForDoctor: async (ticketId) =>
    unwrapData(await request(`/nursing/queue/${encodeURIComponent(ticketId)}/mark-ready-for-doctor`, { method: 'POST', body: {} })),
  unmarkReadyForDoctor: async (ticketId) =>
    unwrapData(await request(`/nursing/queue/${encodeURIComponent(ticketId)}/unmark-ready-for-doctor`, { method: 'POST', body: {} })),
  notifyDoctor: async (ticketId, body = {}) =>
    unwrapData(await request(`/nursing/queue/${encodeURIComponent(ticketId)}/notify-doctor`, { method: 'POST', body })),
  recordVitalSigns: async (body = {}) =>
    unwrapData(await request('/clinical/vital-signs', { method: 'POST', body: sanitizeClinicalContextBody(body) })),
};

export const nurseVitalsApi = {
  getWaitingVitals: async (params = {}) =>
    unwrapData(await request('/nursing/vitals/pending', { params })),
  getAbnormalVitals: async (params = {}) =>
    unwrapData(await request('/nursing/vitals/abnormal', { params })),
  acknowledgeVital: async (vitalSignId) =>
    unwrapData(await request(`/nursing/vitals/${encodeURIComponent(requireMongoId(vitalSignId, 'vital_sign_id'))}/acknowledge`, { method: 'POST', body: {} })),
  notifyDoctorOfVital: async (vitalSignId) =>
    unwrapData(await request(`/nursing/vitals/${encodeURIComponent(requireMongoId(vitalSignId, 'vital_sign_id'))}/notify-doctor`, { method: 'POST', body: {} })),
  previewVitalSigns: async (body = {}) =>
    unwrapData(await request('/clinical/vital-signs/preview', { method: 'POST', body: sanitizeClinicalContextBody(body) })),
  recordVitalSigns: async (body = {}) =>
    unwrapData(await request('/clinical/vital-signs', { method: 'POST', body: sanitizeClinicalContextBody(body) })),
  updateVitalSigns: async (vitalSignId, body = {}) =>
    unwrapData(await request(`/clinical/vital-signs/${encodeURIComponent(requireMongoId(vitalSignId, 'vital_sign_id'))}`, { method: 'PATCH', body })),
  markVitalEnteredInError: async (vitalSignId, body = {}) =>
    unwrapData(await request(`/clinical/vital-signs/${encodeURIComponent(requireMongoId(vitalSignId, 'vital_sign_id'))}/entered-in-error`, { method: 'POST', body })),
  requestCorrection: async (vitalSignId, body = {}) =>
    unwrapData(await request(`/clinical/vital-signs/${encodeURIComponent(requireMongoId(vitalSignId, 'vital_sign_id'))}/correction-request`, { method: 'POST', body })),
  getVitalChangeHistory: async (vitalSignId) =>
    unwrapData(await request(`/clinical/vital-signs/${encodeURIComponent(requireMongoId(vitalSignId, 'vital_sign_id'))}/change-history`)),
  getEncounterVitals: async (encounterId, params = {}) =>
    unwrapData(await request(`/clinical/encounters/${encodeURIComponent(requireMongoId(encounterId, 'encounter_id'))}/vital-signs`, { params })),
  getEncounterLatestVitals: async (encounterId) =>
    unwrapData(await request(`/clinical/encounters/${encodeURIComponent(requireMongoId(encounterId, 'encounter_id'))}/vital-signs/latest`)),
  getEncounterVitalTrends: async (encounterId, params = {}) =>
    unwrapData(await request(`/clinical/encounters/${encodeURIComponent(requireMongoId(encounterId, 'encounter_id'))}/vital-signs/trends`, { params })),
  getPatientVitals: async (patientId, params = {}) =>
    unwrapData(await request(`/clinical/patients/${encodeURIComponent(requireMongoId(patientId, 'patient_id'))}/vital-signs`, { params })),
  getPatientVitalTrends: async (patientId, params = {}) =>
    unwrapData(await request(`/clinical/patients/${encodeURIComponent(requireMongoId(patientId, 'patient_id'))}/vital-signs/trends`, { params })),
  getQueueContext: async (ticketId) =>
    unwrapData(await request(`/nursing/intake/queue/${encodeURIComponent(ticketId)}/context`)),
  createNursingNote: async (encounterId, body = {}) =>
    unwrapData(await request(`/clinical/encounters/${encodeURIComponent(requireMongoId(encounterId, 'encounter_id'))}/notes`, { method: 'POST', body })),
  getNursingNotes: async (encounterId, params = {}) =>
    unwrapData(await request(`/clinical/encounters/${encodeURIComponent(requireMongoId(encounterId, 'encounter_id'))}/notes`, { params })),
  updateNursingNote: async (noteId, body = {}) =>
    unwrapData(await request(`/clinical/notes/${encodeURIComponent(noteId)}`, { method: 'PATCH', body })),
  signNursingNote: async (noteId) =>
    unwrapData(await request(`/clinical/notes/${encodeURIComponent(noteId)}/sign`, { method: 'POST', body: {} })),
  getCorrections: async (params = {}) =>
    unwrapData(await request('/nursing/vital-corrections', { params })),
  approveCorrection: async (requestId, body = {}) =>
    unwrapData(await request(`/nursing/vital-corrections/${encodeURIComponent(requestId)}/approve`, { method: 'POST', body })),
  rejectCorrection: async (requestId, body = {}) =>
    unwrapData(await request(`/nursing/vital-corrections/${encodeURIComponent(requestId)}/reject`, { method: 'POST', body })),
  applyCorrection: async (requestId, body = {}) =>
    unwrapData(await request(`/nursing/vital-corrections/${encodeURIComponent(requestId)}/apply`, { method: 'POST', body })),
  cancelCorrection: async (requestId, body = {}) =>
    unwrapData(await request(`/nursing/vital-corrections/${encodeURIComponent(requestId)}/cancel`, { method: 'POST', body })),
};

export const nursePatientLookupApi = {
  searchPatients: async (params = {}) =>
    unwrapData(await request('/patients/search', { params })),
  getSnapshot: async (patientId) =>
    unwrapData(await request(`/nursing/patients/${encodeURIComponent(patientId)}/snapshot`)),
  getProfileCenter: async (patientId) =>
    unwrapData(await request(`/nursing/patients/${encodeURIComponent(patientId)}/profile-center`)),
  getEncounterHistory: async (patientId, params = {}) =>
    unwrapData(await request(`/nursing/patients/${encodeURIComponent(patientId)}/encounter-history`, { params })),
  getVitalHistory: async (patientId, params = {}) =>
    unwrapData(await request(`/nursing/patients/${encodeURIComponent(patientId)}/vital-history`, { params })),
  getVitalTrends: async (patientId, params = {}) =>
    unwrapData(await request(`/clinical/patients/${encodeURIComponent(patientId)}/vital-signs/trends`, { params })),
  getClinicalRisks: async (patientId) =>
    unwrapData(await request(`/nursing/patients/${encodeURIComponent(patientId)}/clinical-risks`)),
  getDocumentCenter: async (patientId, params = {}) =>
    unwrapData(await request(`/nursing/patients/${encodeURIComponent(patientId)}/document-center`, { params })),
  getEncounterSnapshot: async (encounterId) =>
    unwrapData(await request(`/nursing/encounters/${encodeURIComponent(encounterId)}/snapshot`)),
  checkDuplicateAllergy: async (patientId, body = {}) =>
    unwrapData(await request(`/nursing/patients/${encodeURIComponent(patientId)}/allergies/check-duplicate`, { method: 'POST', body })),
  checkDuplicateProblem: async (patientId, body = {}) =>
    unwrapData(await request(`/nursing/patients/${encodeURIComponent(patientId)}/problems/check-duplicate`, { method: 'POST', body })),
};

export const nursePreparationApi = {
  getWorklist: async (params = {}) =>
    unwrapData(await request('/nursing/preparations/worklist', { params })),
  getSummary: async (params = {}) =>
    unwrapData(await request('/nursing/preparations/dashboard/summary', { params })),
  getDetail: async (preparationId) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}`)),
  getChecklist: async (preparationId) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/checklist`)),
  getTimeline: async (preparationId) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/timeline`)),
  getContext: async (preparationId) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/context`)),
  createFromOrder: async (orderId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/from-order/${encodeURIComponent(orderId)}`, { method: 'POST', body })),
  createPreExamFromEncounter: async (encounterId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/pre-exam/from-encounter/${encodeURIComponent(encounterId)}`, { method: 'POST', body })),
  assign: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/assign`, { method: 'POST', body })),
  start: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/start`, { method: 'POST', body })),
  block: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/block`, { method: 'POST', body })),
  unblock: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/unblock`, { method: 'POST', body })),
  ready: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/ready`, { method: 'POST', body })),
  transfer: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/transfer`, { method: 'POST', body })),
  complete: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/complete`, { method: 'POST', body })),
  cancel: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/cancel`, { method: 'POST', body })),
  notifyDoctor: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/notify-doctor`, { method: 'POST', body })),
  notifyDestination: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/notify-destination`, { method: 'POST', body })),
  addNote: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/add-note`, { method: 'POST', body })),
  updateChecklistItem: async (preparationId, itemId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/checklist/${encodeURIComponent(itemId)}`, { method: 'PATCH', body })),
  doneChecklistItem: async (preparationId, itemId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/checklist/${encodeURIComponent(itemId)}/done`, { method: 'POST', body })),
  failChecklistItem: async (preparationId, itemId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/checklist/${encodeURIComponent(itemId)}/fail`, { method: 'POST', body })),
  waiveChecklistItem: async (preparationId, itemId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/checklist/${encodeURIComponent(itemId)}/waive`, { method: 'POST', body })),
  printSpecimenLabel: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/print-specimen-label`, { method: 'POST', body })),
  scanSpecimenLabel: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/scan-specimen-label`, { method: 'POST', body })),
  handoffLab: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/handoff-lab`, { method: 'POST', body })),
  requestRecollect: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/request-recollect`, { method: 'POST', body })),
  linkConsent: async (preparationId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/${encodeURIComponent(preparationId)}/link-consent`, { method: 'POST', body })),
  bulkAssign: async (body = {}) =>
    unwrapData(await request('/nursing/preparations/bulk-assign', { method: 'POST', body })),
  bulkStart: async (body = {}) =>
    unwrapData(await request('/nursing/preparations/bulk-start', { method: 'POST', body })),
  bulkReady: async (body = {}) =>
    unwrapData(await request('/nursing/preparations/bulk-ready', { method: 'POST', body })),
  bulkNotify: async (body = {}) =>
    unwrapData(await request('/nursing/preparations/bulk-notify', { method: 'POST', body })),
  bulkTransfer: async (body = {}) =>
    unwrapData(await request('/nursing/preparations/bulk-transfer', { method: 'POST', body })),
  bulkPrint: async (body = {}) =>
    unwrapData(await request('/nursing/preparations/bulk-print', { method: 'POST', body })),
  getTemplates: async (params = {}) =>
    unwrapData(await request('/nursing/preparations/checklist-templates', { params })),
  previewTemplate: async (params = {}) =>
    unwrapData(await request('/nursing/preparations/checklist-templates/preview', { params })),
  createTemplate: async (body = {}) =>
    unwrapData(await request('/nursing/preparations/checklist-templates', { method: 'POST', body })),
  updateTemplate: async (templateId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/checklist-templates/${encodeURIComponent(templateId)}`, { method: 'PATCH', body })),
  cloneTemplate: async (templateId, body = {}) =>
    unwrapData(await request(`/nursing/preparations/checklist-templates/${encodeURIComponent(templateId)}/clone`, { method: 'POST', body })),
};

export const nurseMonitoringApi = {
  getCommandCenter: async (params = {}) =>
    unwrapData(await request('/nursing/clinical-command', { params })),
  getMonitoring: async (params = {}) =>
    unwrapData(await request('/nursing/monitoring', { params })),
  createMonitoring: async (body = {}) =>
    unwrapData(await request('/nursing/monitoring', { method: 'POST', body })),
  getMonitoringDetail: async (monitoringId) =>
    unwrapData(await request(`/nursing/monitoring/${encodeURIComponent(monitoringId)}`)),
  addMonitoringCheck: async (monitoringId, body = {}) =>
    unwrapData(await request(`/nursing/monitoring/${encodeURIComponent(monitoringId)}/check`, { method: 'POST', body })),
  notifyDoctorFromMonitoring: async (monitoringId, body = {}) =>
    unwrapData(await request(`/nursing/monitoring/${encodeURIComponent(monitoringId)}/notify-doctor`, { method: 'POST', body })),
  escalateMonitoring: async (monitoringId, body = {}) =>
    unwrapData(await request(`/nursing/monitoring/${encodeURIComponent(monitoringId)}/escalate`, { method: 'POST', body })),
  markMonitoringStable: async (monitoringId, body = {}) =>
    unwrapData(await request(`/nursing/monitoring/${encodeURIComponent(monitoringId)}/mark-stable`, { method: 'POST', body })),
  resolveMonitoring: async (monitoringId, body = {}) =>
    unwrapData(await request(`/nursing/monitoring/${encodeURIComponent(monitoringId)}/resolve`, { method: 'POST', body })),
  getMonitoringTimeline: async (monitoringId) =>
    unwrapData(await request(`/nursing/monitoring/${encodeURIComponent(monitoringId)}/timeline`)),

  getPostProcedure: async (params = {}) =>
    unwrapData(await request('/nursing/post-procedure', { params })),
  getPostProcedureDetail: async (procedureOrderId) =>
    unwrapData(await request(`/nursing/post-procedure/${encodeURIComponent(procedureOrderId)}`)),
  addPostProcedureObservation: async (procedureOrderId, body = {}) =>
    unwrapData(await request(`/nursing/post-procedure/${encodeURIComponent(procedureOrderId)}/observations`, { method: 'POST', body })),
  markPostProcedureStable: async (procedureOrderId, body = {}) =>
    unwrapData(await request(`/nursing/post-procedure/${encodeURIComponent(procedureOrderId)}/mark-stable`, { method: 'POST', body })),
  notifyDoctorPostProcedure: async (procedureOrderId, body = {}) =>
    unwrapData(await request(`/nursing/post-procedure/${encodeURIComponent(procedureOrderId)}/notify-doctor`, { method: 'POST', body })),
  escalatePostProcedure: async (procedureOrderId, body = {}) =>
    unwrapData(await request(`/nursing/post-procedure/${encodeURIComponent(procedureOrderId)}/escalate`, { method: 'POST', body })),
  createEmergencyFromPostProcedure: async (procedureOrderId, body = {}) =>
    unwrapData(await request(`/nursing/post-procedure/${encodeURIComponent(procedureOrderId)}/create-emergency`, { method: 'POST', body })),

  getPostMedication: async (params = {}) =>
    unwrapData(await request('/nursing/post-medication', { params })),
  addMedicationReaction: async (administrationId, body = {}) =>
    unwrapData(await request(`/nursing/post-medication/${encodeURIComponent(administrationId)}/reactions`, { method: 'POST', body })),

  getClinicalAlerts: async (params = {}) =>
    unwrapData(await request('/nursing/clinical-alerts', { params })),
  acknowledgeClinicalAlert: async (alertId, body = {}) =>
    unwrapData(await request(`/nursing/clinical-alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body })),
  notifyDoctorClinicalAlert: async (alertId, body = {}) =>
    unwrapData(await request(`/nursing/clinical-alerts/${encodeURIComponent(alertId)}/notify-doctor`, { method: 'POST', body })),
  escalateClinicalAlert: async (alertId, body = {}) =>
    unwrapData(await request(`/nursing/clinical-alerts/${encodeURIComponent(alertId)}/escalate`, { method: 'POST', body })),
  resolveClinicalAlert: async (alertId, body = {}) =>
    unwrapData(await request(`/nursing/clinical-alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body })),
  dismissClinicalAlert: async (alertId, body = {}) =>
    unwrapData(await request(`/nursing/clinical-alerts/${encodeURIComponent(alertId)}/dismiss`, { method: 'POST', body })),

  getEmergencyCases: async (params = {}) =>
    unwrapData(await request('/emergency/cases', { params })),
  getEmergencyOpenSummary: async (params = {}) =>
    unwrapData(await request('/emergency/dashboard/open-summary', { params })),
  getEmergencyOpenCases: async (params = {}) =>
    unwrapData(await request('/emergency/cases/open', { params })),
  getEmergencyClosedCases: async (params = {}) =>
    unwrapData(await request('/emergency/cases/closed', { params })),
  getEmergencyDetail: async (caseId) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}`)),
  createEmergencyCase: async (body = {}) =>
    unwrapData(await request('/emergency/cases', { method: 'POST', body })),
  acknowledgeEmergency: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/acknowledge`, { method: 'POST', body })),
  triageEmergency: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/triage`, { method: 'POST', body })),
  getEmergencyTriageQueue: async (params = {}) =>
    unwrapData(await request('/emergency/triage-queue', { params })),
  getEmergencyTriage: async (caseId) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/triage`)),
  startEmergencyTriage: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/triage/start`, { method: 'POST', body })),
  saveEmergencyTriageDraft: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/triage/save-draft`, { method: 'POST', body })),
  completeEmergencyTriage: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/triage/complete`, { method: 'POST', body })),
  updateEmergencyTriage: async (triageId, body = {}) =>
    unwrapData(await request(`/emergency/triages/${encodeURIComponent(triageId)}`, { method: 'PATCH', body })),
  signEmergencyTriage: async (triageId) =>
    unwrapData(await request(`/emergency/triages/${encodeURIComponent(triageId)}/sign`, { method: 'POST', body: {} })),
  dispatchEmergency: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/dispatch`, { method: 'POST', body })),
  getEmergencyDispatchBoard: async (params = {}) =>
    unwrapData(await request('/emergency/dispatch-board', { params })),
  escalateEmergency: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/escalate`, { method: 'POST', body })),
  getEmergencyEscalations: async (params = {}) =>
    unwrapData(await request('/emergency/escalations/open', { params })),
  getEmergencySlaBoard: async (params = {}) =>
    unwrapData(await request('/emergency/sla/board', { params })),
  assignEmergency: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/assignment`, { method: 'PATCH', body })),
  updateEmergencyPriority: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/priority`, { method: 'PATCH', body })),
  updateEmergencyLocation: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/update-location`, { method: 'POST', body })),
  addEmergencyNote: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/add-note`, { method: 'POST', body })),
  notifyEmergencyDoctor: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/notify-doctor`, { method: 'POST', body })),
  resolveEmergency: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/resolve`, { method: 'POST', body })),
  cancelEmergency: async (caseId, body = {}) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/cancel`, { method: 'POST', body })),
  getEmergencyTimeline: async (caseId) =>
    unwrapData(await request(`/emergency/cases/${encodeURIComponent(caseId)}/timeline`)),

  getDoctorNotifications: async (params = {}) =>
    unwrapData(await request('/nursing/doctor-notifications', { params })),
  createDoctorNotification: async (body = {}) =>
    unwrapData(await request('/nursing/doctor-notifications', { method: 'POST', body })),
  sendDoctorNotification: async (requestId, body = {}) =>
    unwrapData(await request(`/nursing/doctor-notifications/${encodeURIComponent(requestId)}/send`, { method: 'POST', body })),
  escalateDoctorNotification: async (requestId, body = {}) =>
    unwrapData(await request(`/nursing/doctor-notifications/${encodeURIComponent(requestId)}/escalate`, { method: 'POST', body })),
  closeDoctorNotification: async (requestId, body = {}) =>
    unwrapData(await request(`/nursing/doctor-notifications/${encodeURIComponent(requestId)}/close`, { method: 'POST', body })),
  respondDoctorNotification: async (requestId, body = {}) =>
    unwrapData(await request(`/nursing/doctor-notifications/${encodeURIComponent(requestId)}/respond`, { method: 'POST', body })),
};

export const nurseTaskHandoverApi = {
  getTasks: async (params = {}) =>
    unwrapData(await request('/nursing/tasks', { params })),
  getSummary: async (params = {}) =>
    unwrapData(await request('/nursing/tasks/summary', { params })),
  getMyTasks: async (params = {}) =>
    unwrapData(await request('/nursing/tasks/my', { params })),
  getOverdueTasks: async (params = {}) =>
    unwrapData(await request('/nursing/tasks/overdue', { params })),
  getCompletedTasks: async (params = {}) =>
    unwrapData(await request('/nursing/tasks/completed', { params })),
  getTasksByPatient: async (params = {}) =>
    unwrapData(await request('/nursing/tasks/by-patient', { params })),
  getPatientMatrix: async (params = {}) =>
    unwrapData(await request('/nursing/tasks/patient-matrix', { params })),
  getWorkload: async (params = {}) =>
    unwrapData(await request('/nursing/tasks/workload', { params })),
  getTask: async (taskId) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}`)),
  acceptTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/accept`, { method: 'POST', body })),
  startTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/start`, { method: 'POST', body })),
  blockTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/block`, { method: 'POST', body })),
  resumeTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/resume`, { method: 'POST', body })),
  completeTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST', body })),
  reassignTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/reassign`, { method: 'POST', body })),
  escalateTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/escalate`, { method: 'POST', body })),
  remindTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/remind`, { method: 'POST', body })),
  extendTask: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/extend`, { method: 'POST', body })),
  addTaskNote: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/add-note`, { method: 'POST', body })),
  createClinicalNote: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/create-clinical-note`, { method: 'POST', body })),
  reportDoctor: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/report-doctor`, { method: 'POST', body })),
  addToHandoff: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/add-to-handoff`, { method: 'POST', body })),
  checkChecklistItem: async (taskId, itemId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/checklist/${encodeURIComponent(itemId)}/check`, { method: 'POST', body })),
  skipChecklistItem: async (taskId, itemId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/checklist/${encodeURIComponent(itemId)}/skip`, { method: 'POST', body })),
  bulkComplete: async (body = {}) =>
    unwrapData(await request('/nursing/tasks/bulk-complete', { method: 'POST', body })),
  bulkReassign: async (body = {}) =>
    unwrapData(await request('/nursing/tasks/bulk-reassign', { method: 'POST', body })),
  bulkAddToHandoff: async (body = {}) =>
    unwrapData(await request('/nursing/tasks/bulk-add-to-handoff', { method: 'POST', body })),
  createFollowUp: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/create-follow-up`, { method: 'POST', body })),
  requestReview: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/request-review`, { method: 'POST', body })),
  approveReview: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/approve-review`, { method: 'POST', body })),
  rejectReview: async (taskId, body = {}) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/reject-review`, { method: 'POST', body })),
  getTaskAuditTrail: async (taskId) =>
    unwrapData(await request(`/nursing/tasks/${encodeURIComponent(taskId)}/audit-trail`)),

  getHandoffs: async (params = {}) =>
    unwrapData(await request('/nursing/handoffs', { params })),
  createHandoff: async (body = {}) =>
    unwrapData(await request('/nursing/handoffs', { method: 'POST', body })),
  generateDraft: async (body = {}) =>
    unwrapData(await request('/nursing/handoffs/generate-draft', { method: 'POST', body })),
  getActiveHandoffs: async (params = {}) =>
    unwrapData(await request('/nursing/handoffs/active', { params })),
  getHandoffHistory: async (params = {}) =>
    unwrapData(await request('/nursing/handoffs/history', { params })),
  getHandoff: async (handoffId) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}`)),
  updateHandoff: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}`, { method: 'PATCH', body })),
  addHandoffPatient: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/add-patient`, { method: 'POST', body })),
  removeHandoffPatient: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/remove-patient`, { method: 'POST', body })),
  attachHandoffTask: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/attach-task`, { method: 'POST', body })),
  submitHandoff: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/submit`, { method: 'POST', body })),
  acceptHandoff: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/accept`, { method: 'POST', body })),
  rejectHandoff: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/reject`, { method: 'POST', body })),
  reopenHandoff: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/reopen`, { method: 'POST', body })),
  acknowledgePatient: async (handoffId, itemId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/patient-items/${encodeURIComponent(itemId)}/ack`, { method: 'POST', body })),
  exportHandoffPdf: async (handoffId) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/export-pdf`, { method: 'POST', body: {} })),
  getHandoffAuditTrail: async (handoffId) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/audit-trail`)),
  cloneHandoff: async (handoffId, body = {}) =>
    unwrapData(await request(`/nursing/handoffs/${encodeURIComponent(handoffId)}/clone`, { method: 'POST', body })),
};

export const nurseInpatientApi = {
  getWardBoard: async (params = {}) =>
    unwrapData(await request('/inpatient/ward-board', { params })),
  getWardMap: async (params = {}) =>
    unwrapData(await request('/inpatient/ward-map', { params })),

  listRooms: async (params = {}) =>
    unwrapData(await request('/inpatient/rooms', { params })),
  createRoom: async (body = {}) =>
    unwrapData(await request('/inpatient/rooms', { method: 'POST', body })),
  updateRoom: async (roomId, body = {}) =>
    unwrapData(await request(`/inpatient/rooms/${encodeURIComponent(roomId)}`, { method: 'PATCH', body })),

  listBeds: async (params = {}) =>
    unwrapData(await request('/inpatient/beds', { params })),
  getAvailableBeds: async (params = {}) =>
    unwrapData(await request('/inpatient/beds/available', { params })),
  getBedAvailability: async (params = {}) =>
    unwrapData(await request('/inpatient/beds/availability-summary', { params })),
  createBed: async (body = {}) =>
    unwrapData(await request('/inpatient/beds', { method: 'POST', body })),
  updateBed: async (bedId, body = {}) =>
    unwrapData(await request(`/inpatient/beds/${encodeURIComponent(bedId)}`, { method: 'PATCH', body })),

  listAdmissions: async (params = {}) =>
    unwrapData(await request('/inpatient/admissions', { params })),
  getAdmission: async (admissionId) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}`)),
  createAdmissionFromEncounter: async (encounterId, body = {}) =>
    unwrapData(await request(`/inpatient/encounters/${encodeURIComponent(encounterId)}/admission`, { method: 'POST', body })),
  admitAdmission: async (admissionId, body = {}) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/admit`, { method: 'POST', body })),
  cancelAdmission: async (admissionId, body = {}) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/cancel`, { method: 'POST', body })),
  dischargeAdmission: async (admissionId, body = {}) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/discharge`, { method: 'POST', body })),
  getDischargeReadiness: async (admissionId) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/discharge-readiness`)),
  getAdmissionCharges: async (admissionId) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/charges`)),
  createRoomBedCharge: async (admissionId, body = {}) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/room-bed-charge`, { method: 'POST', body })),

  listBedAssignments: async (params = {}) =>
    unwrapData(await request('/inpatient/bed-assignments', { params })),
  assignBed: async (admissionId, body = {}) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/bed-assignments`, { method: 'POST', body })),
  transferBedByAdmission: async (admissionId, body = {}) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/transfer-bed`, { method: 'POST', body })),
  validateBedAssignment: async (admissionId, body = {}) =>
    unwrapData(await request(`/inpatient/admissions/${encodeURIComponent(admissionId)}/bed-assignment/validate`, { method: 'POST', body })),
  getBedSuggestions: async (body = {}) =>
    unwrapData(await request('/inpatient/bed-suggestions', { method: 'POST', body })),
  transferBedAssignment: async (assignmentId, body = {}) =>
    unwrapData(await request(`/inpatient/bed-assignments/${encodeURIComponent(assignmentId)}/transfer`, { method: 'POST', body })),
  releaseBedAssignment: async (assignmentId, body = {}) =>
    unwrapData(await request(`/inpatient/bed-assignments/${encodeURIComponent(assignmentId)}/release`, { method: 'POST', body })),
  cancelBedAssignment: async (assignmentId, body = {}) =>
    unwrapData(await request(`/inpatient/bed-assignments/${encodeURIComponent(assignmentId)}/cancel`, { method: 'POST', body })),

  listTasks: async (params = {}) =>
    unwrapData(await request('/inpatient/tasks', { params })),
  createTask: async (body = {}) =>
    unwrapData(await request('/inpatient/tasks', { method: 'POST', body })),
  updateTask: async (taskId, body = {}) =>
    unwrapData(await request(`/inpatient/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body })),
  assignTask: async (taskId, body = {}) =>
    unwrapData(await request(`/inpatient/tasks/${encodeURIComponent(taskId)}/assign`, { method: 'POST', body })),
  startTask: async (taskId, body = {}) =>
    unwrapData(await request(`/inpatient/tasks/${encodeURIComponent(taskId)}/start`, { method: 'POST', body })),
  completeTask: async (taskId, body = {}) =>
    unwrapData(await request(`/inpatient/tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST', body })),
  cancelTask: async (taskId, body = {}) =>
    unwrapData(await request(`/inpatient/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST', body })),
  bulkCreateTasks: async (body = {}) =>
    unwrapData(await request('/inpatient/tasks/bulk-create', { method: 'POST', body })),
  bulkAssignTasks: async (body = {}) =>
    unwrapData(await request('/inpatient/tasks/bulk-assign', { method: 'POST', body })),
  bulkCompleteTasks: async (body = {}) =>
    unwrapData(await request('/inpatient/tasks/bulk-complete', { method: 'POST', body })),

  listMedicationAdministrations: async (params = {}) =>
    unwrapData(await request('/inpatient/medication-administrations', { params })),
  generateMedicationSchedule: async (body = {}) =>
    unwrapData(await request('/inpatient/medication-administrations/generate-from-prescription', { method: 'POST', body })),
  verifyMedicationScan: async (body = {}) =>
    unwrapData(await request('/inpatient/medication-administrations/verify-scan', { method: 'POST', body })),
  administerMedication: async (administrationId, body = {}) =>
    unwrapData(await request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/administer`, { method: 'POST', body })),
  holdMedication: async (administrationId, body = {}) =>
    unwrapData(await request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/hold`, { method: 'POST', body })),
  refuseMedication: async (administrationId, body = {}) =>
    unwrapData(await request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/refuse`, { method: 'POST', body })),
  omitMedication: async (administrationId, body = {}) =>
    unwrapData(await request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/omit`, { method: 'POST', body })),
  rescheduleMedication: async (administrationId, body = {}) =>
    unwrapData(await request(`/inpatient/medication-administrations/${encodeURIComponent(administrationId)}/reschedule`, { method: 'POST', body })),

  listHandovers: async (params = {}) =>
    unwrapData(await request('/inpatient/handovers', { params })),
  createHandover: async (body = {}) =>
    unwrapData(await request('/inpatient/handovers', { method: 'POST', body })),
  getHandover: async (handoverId) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}`)),
  updateHandover: async (handoverId, body = {}) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}`, { method: 'PATCH', body })),
  generateHandover: async (handoverId, body = {}) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}/generate`, { method: 'POST', body })),
  signHandover: async (handoverId, body = {}) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}/sign`, { method: 'POST', body })),
  acknowledgeHandover: async (handoverId, body = {}) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}/acknowledge`, { method: 'POST', body })),
  closeHandover: async (handoverId, body = {}) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}/close`, { method: 'POST', body })),
  reopenHandover: async (handoverId, body = {}) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}/reopen`, { method: 'POST', body })),
  acknowledgeHandoverItem: async (handoverId, itemId, body = {}) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}/items/${encodeURIComponent(itemId)}/acknowledge`, { method: 'POST', body })),
  updateHandoverItem: async (handoverId, itemId, body = {}) =>
    unwrapData(await request(`/inpatient/handovers/${encodeURIComponent(handoverId)}/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body })),
};
