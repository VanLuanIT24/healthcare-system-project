function normalizeId(value) {
  if (value === undefined || value === null || value === '') return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function actorRoom(actorType, actorId) {
  const id = normalizeId(actorId);
  return actorType && id ? `actor:${actorType}:${id}` : null;
}

function userRoom(userId) {
  const id = normalizeId(userId);
  return id ? `user:${id}` : null;
}

function patientRoom(patientId) {
  const id = normalizeId(patientId);
  return id ? `patient:${id}` : null;
}

function departmentRoom(departmentId) {
  const id = normalizeId(departmentId);
  return id ? `department:${id}` : null;
}

function roleRoom(roleCode) {
  const id = normalizeId(roleCode);
  return id ? `role:${id}` : null;
}

function conversationRoom(conversationId) {
  const id = normalizeId(conversationId);
  return id ? `conversation:${id}` : null;
}

function supportTicketRoom(ticketId) {
  const id = normalizeId(ticketId);
  return id ? `support_ticket:${id}` : null;
}

function appointmentRoom(appointmentId) {
  const id = normalizeId(appointmentId);
  return id ? `appointment:${id}` : null;
}

function queueRoom(queueId) {
  const id = normalizeId(queueId);
  return id ? `queue:${id}` : null;
}

function emergencyRoom(caseId) {
  const id = normalizeId(caseId);
  return id ? `emergency:${id}` : null;
}

function paymentIntentRoom(intentId) {
  const id = normalizeId(intentId);
  return id ? `payment_intent:${id}` : null;
}

function systemRoom(systemKey) {
  const id = normalizeId(systemKey);
  return id ? `system:${id}` : null;
}

function addRooms(rooms, values, mapper) {
  const list = Array.isArray(values) ? values : [values];
  list.forEach((value) => {
    const room = mapper(value);
    if (room) rooms.add(room);
  });
}

function buildRoomsFromScope(scope = {}) {
  const rooms = new Set();
  if (!scope) return [];
  if (Array.isArray(scope)) {
    scope.filter(Boolean).forEach((room) => rooms.add(String(room)));
    return [...rooms];
  }
  addRooms(rooms, scope.rooms, (room) => room);
  addRooms(rooms, scope.user_id || scope.userId || scope.user_ids || scope.userIds, userRoom);
  addRooms(rooms, scope.patient_id || scope.patientId || scope.patient_ids || scope.patientIds, patientRoom);
  addRooms(rooms, scope.department_id || scope.departmentId || scope.department_ids || scope.departmentIds, departmentRoom);
  addRooms(rooms, scope.role || scope.role_code || scope.roleCode || scope.roles || scope.role_codes || scope.roleCodes, roleRoom);
  addRooms(rooms, scope.conversation_id || scope.conversationId || scope.conversation_ids || scope.conversationIds, conversationRoom);
  addRooms(rooms, scope.support_ticket_id || scope.supportTicketId || scope.ticket_id || scope.ticketId, supportTicketRoom);
  addRooms(rooms, scope.appointment_id || scope.appointmentId, appointmentRoom);
  addRooms(rooms, scope.queue_id || scope.queueId || scope.queue_ticket_id || scope.queueTicketId, queueRoom);
  addRooms(rooms, scope.emergency_case_id || scope.emergencyCaseId || scope.case_id || scope.caseId, emergencyRoom);
  addRooms(rooms, scope.payment_intent_id || scope.paymentIntentId, paymentIntentRoom);
  addRooms(rooms, scope.system || scope.system_room || scope.systemRoom || scope.system_rooms || scope.systemRooms, systemRoom);

  const actors = scope.actors || scope.actor || [];
  (Array.isArray(actors) ? actors : [actors]).filter(Boolean).forEach((actor) => {
    const room = actorRoom(actor.actor_type || actor.actorType, actor.actor_id || actor.actorId);
    if (room) rooms.add(room);
  });

  return [...rooms];
}

module.exports = {
  normalizeId,
  actorRoom,
  userRoom,
  patientRoom,
  departmentRoom,
  roleRoom,
  conversationRoom,
  supportTicketRoom,
  appointmentRoom,
  queueRoom,
  emergencyRoom,
  paymentIntentRoom,
  systemRoom,
  buildRoomsFromScope,
};
