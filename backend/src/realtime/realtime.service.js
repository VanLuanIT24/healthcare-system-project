const actorContext = require('../common/actors');
const presenceService = require('./presence.service');
const rooms = require('./room-naming');

let socketServer = null;
const localListeners = new Set();

function setSocketServer(io) {
  socketServer = io || null;
  return socketServer;
}

function getSocketServer() {
  return socketServer;
}

function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  localListeners.add(listener);
  return () => localListeners.delete(listener);
}

function notifyLocalListeners(eventEnvelope) {
  localListeners.forEach((listener) => {
    Promise.resolve()
      .then(() => listener(eventEnvelope))
      .catch(() => {});
  });
}

function roomsForActor(actor = {}) {
  const context = actorContext.buildActorContext(actor, { requireActorId: false });
  const result = [
    rooms.actorRoom(context.actor_type, context.actor_id),
    rooms.userRoom(context.user_id),
    rooms.patientRoom(context.patient_id),
    rooms.departmentRoom(context.department_id),
    ...(context.roles || []).map(rooms.roleRoom),
  ].filter(Boolean);
  return [...new Set(result)];
}

async function joinRoomsForSocket(socket, actor = {}, extraRooms = []) {
  if (!socket || typeof socket.join !== 'function') return [];
  const roomList = [...new Set([...roomsForActor(actor), ...extraRooms.filter(Boolean)])];
  await Promise.all(roomList.map((room) => socket.join(room)));
  const context = actorContext.buildActorContext(actor, { requireActorId: false });
  presenceService.markOnline({
    actorType: context.actor_type,
    actorId: context.actor_id,
    socketId: socket.id,
    rooms: roomList,
  });
  return roomList;
}

function emitToRooms(event, payload = {}, roomList = [], options = {}) {
  const uniqueRooms = [...new Set((roomList || []).filter(Boolean))];
  const envelope = {
    event,
    data: payload,
    emitted_at: new Date().toISOString(),
    rooms: uniqueRooms,
    request_id: options.request_id || options.requestId,
  };
  notifyLocalListeners(envelope);
  if (!socketServer || uniqueRooms.length === 0) {
    return { delivered: false, rooms: uniqueRooms, reason: socketServer ? 'no_rooms' : 'socket_unavailable' };
  }
  uniqueRooms.forEach((room) => socketServer.to(room).emit(event, envelope));
  return { delivered: true, rooms: uniqueRooms };
}

function emitToScope(event, payload = {}, recipientScope = {}, options = {}) {
  return emitToRooms(event, payload, rooms.buildRoomsFromScope(recipientScope), options);
}

function disconnectSocket(socketId) {
  return presenceService.markOffline(socketId);
}

module.exports = {
  setSocketServer,
  getSocketServer,
  subscribe,
  roomsForActor,
  joinRoomsForSocket,
  emitToRooms,
  emitToScope,
  disconnectSocket,
};
