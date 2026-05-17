const env = require('../config/env');
const {
  Appointment,
  ConversationParticipant,
  EmergencyCase,
  PaymentIntent,
  QueueTicket,
  SupportTicket,
} = require('../models');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const realtimeService = require('./realtime.service');
const presenceService = require('./presence.service');
const { authenticateSocket } = require('./socket-auth.middleware');
const { buildRoomsFromScope } = require('./room-naming');

const MAX_SOCKET_PAYLOAD_BYTES = 4096;
const MAX_SUBSCRIBE_ROOMS_PER_EVENT = 25;
const SOCKET_EVENT_LIMITS = {
  'room.subscribe': { limit: 20, windowMs: 60 * 1000, maxBytes: MAX_SOCKET_PAYLOAD_BYTES },
  'room.unsubscribe': { limit: 30, windowMs: 60 * 1000, maxBytes: MAX_SOCKET_PAYLOAD_BYTES },
  'presence.ping': { limit: 30, windowMs: 60 * 1000, maxBytes: 512 },
  'typing.started': { limit: 20, windowMs: 10 * 1000, maxBytes: 1024 },
  'typing.stopped': { limit: 20, windowMs: 10 * 1000, maxBytes: 1024 },
};

function hasPermission(auth = {}, permission) {
  return (auth.permissions || []).includes(PERMISSION.SYSTEM.FULL_ACCESS)
    || (auth.permissions || []).includes(permission);
}

function payloadSizeBytes(payload) {
  try {
    return Buffer.byteLength(JSON.stringify(payload || {}), 'utf8');
  } catch (error) {
    return MAX_SOCKET_PAYLOAD_BYTES + 1;
  }
}

function createSocketGuard(socket) {
  const buckets = new Map();
  let violations = 0;

  return function guardSocketEvent(eventName, payload = {}) {
    const config = SOCKET_EVENT_LIMITS[eventName];
    if (!config) return true;

    if (payloadSizeBytes(payload) > config.maxBytes) {
      violations += 1;
      socket.emit('realtime.payload_too_large', { event: eventName });
      if (violations >= 5) socket.disconnect(true);
      return false;
    }

    const now = Date.now();
    const bucket = buckets.get(eventName) || [];
    const fresh = bucket.filter((at) => now - at < config.windowMs);
    if (fresh.length >= config.limit) {
      violations += 1;
      socket.emit('realtime.rate_limited', {
        event: eventName,
        retry_after_ms: Math.max(1000, config.windowMs - (now - fresh[0])),
      });
      if (violations >= 10) socket.disconnect(true);
      buckets.set(eventName, fresh);
      return false;
    }

    fresh.push(now);
    buckets.set(eventName, fresh);
    return true;
  };
}

function hasFullAccess(auth = {}) {
  return hasPermission(auth, PERMISSION.SYSTEM.FULL_ACCESS);
}

function hasAnyPermission(auth = {}, permissions = []) {
  return permissions.filter(Boolean).some((permission) => hasPermission(auth, permission));
}

function hasRole(auth = {}, role) {
  return (auth.roles || []).includes(role);
}

function hasAnyRole(auth = {}, roles = []) {
  return roles.filter(Boolean).some((role) => hasRole(auth, role));
}

function isAdminStaff(auth = {}) {
  return hasAnyRole(auth, [ROLE_CODE.SUPER_ADMIN, ROLE_CODE.ADMIN]) || hasFullAccess(auth);
}

function canAccessPaymentIntentRooms(auth = {}) {
  return isAdminStaff(auth)
    || hasAnyRole(auth, [ROLE_CODE.CASHIER, ROLE_CODE.BILLING_STAFF])
    || hasAnyPermission(auth, [
      PERMISSION.PAYMENTS.CREATE,
      PERMISSION.PAYMENTS.REFUND,
      PERMISSION.PAYMENT_RECONCILIATION.READ,
    ]);
}

function canAccessEmergencyTeamRooms(auth = {}) {
  return isAdminStaff(auth)
    || hasAnyRole(auth, [ROLE_CODE.NURSE])
    || hasAnyPermission(auth, [
      PERMISSION.EMERGENCY.TRIAGE,
      PERMISSION.EMERGENCY.RESOLVE,
    ]);
}

function canAccessReceptionAppointmentRooms(auth = {}) {
  return isAdminStaff(auth) || hasPermission(auth, PERMISSION.REPORTS.APPOINTMENTS_READ);
}

function ownRooms(auth = {}) {
  return new Set(realtimeService.roomsForActor(auth));
}

async function canJoinRoom(auth = {}, room = '') {
  if (ownRooms(auth).has(room)) return true;

  const [, id] = room.split(':');
  if (!id) return false;
  if (room.startsWith('conversation:')) {
    if (auth.actorType === 'staff' && hasPermission(auth, PERMISSION.MESSAGES.MANAGE)) return true;
    return Boolean(await ConversationParticipant.exists({
      conversation_id: id,
      actor_type: auth.actorType,
      actor_id: auth.actorId,
      $or: [{ left_at: null }, { left_at: { $exists: false } }],
    }));
  }
  if (room.startsWith('payment_intent:')) {
    if (auth.actorType === 'staff') {
      if (!canAccessPaymentIntentRooms(auth)) {
        return false;
      }
      return Boolean(await PaymentIntent.exists({ _id: id }));
    }
    return Boolean(await PaymentIntent.exists({ _id: id, patient_id: auth.patientId }));
  }
  if (room.startsWith('support_ticket:')) {
    if (auth.actorType === 'staff') {
      if (hasPermission(auth, PERMISSION.SUPPORT_TICKETS.MANAGE)) return true;
      return Boolean(await SupportTicket.exists({
        _id: id,
        $or: [
          { assigned_user_id: auth.userId },
          ...(auth.departmentId ? [{ assigned_department_id: auth.departmentId }] : []),
        ],
      }));
    }
    return Boolean(await SupportTicket.exists({ _id: id, patient_id: auth.patientId }));
  }
  if (room.startsWith('appointment:')) {
    if (auth.actorType === 'staff') {
      const appointmentClauses = [
        { doctor_id: auth.userId },
        ...(auth.departmentId && (hasAnyRole(auth, [ROLE_CODE.RECEPTIONIST, ROLE_CODE.SCHEDULER]) || hasAnyPermission(auth, [
          PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
          PERMISSION.APPOINTMENTS.READ,
          PERMISSION.APPOINTMENTS.CREATE,
          PERMISSION.APPOINTMENTS.CHECKIN,
        ])) ? [{ department_id: auth.departmentId }] : []),
      ];
      if (canAccessReceptionAppointmentRooms(auth)) {
        return Boolean(await Appointment.exists({ _id: id }));
      }
      return Boolean(await Appointment.exists({
        _id: id,
        $or: appointmentClauses,
      }));
    }
    return Boolean(await Appointment.exists({ _id: id, patient_id: auth.patientId }));
  }
  if (room.startsWith('queue:')) {
    if (auth.actorType === 'staff') {
      if (isAdminStaff(auth)) return Boolean(await QueueTicket.exists({ _id: id }));
      const queueClauses = [
        ...(hasAnyPermission(auth, [PERMISSION.QUEUE.READ_OWN, PERMISSION.QUEUE.CALL_OWN, PERMISSION.QUEUE.START_SERVICE_OWN])
          ? [{ doctor_id: auth.userId }]
          : []),
        ...(auth.departmentId && hasAnyPermission(auth, [
          PERMISSION.QUEUE.READ_DEPARTMENT,
          PERMISSION.QUEUE.READ,
          PERMISSION.QUEUE.UPDATE,
        ]) ? [{ department_id: auth.departmentId }] : []),
        ...(auth.counterId ? [{ counter_id: auth.counterId }] : []),
      ];
      if (queueClauses.length === 0) return false;
      return Boolean(await QueueTicket.exists({
        _id: id,
        $or: queueClauses,
      }));
    }
    return Boolean(await QueueTicket.exists({ _id: id, patient_id: auth.patientId }));
  }
  if (room.startsWith('emergency:')) {
    if (auth.actorType === 'staff') {
      if (canAccessEmergencyTeamRooms(auth)) {
        return true;
      }
      return Boolean(await EmergencyCase.exists({
        _id: id,
        $or: [
          { assigned_to_user_id: auth.userId },
          ...(auth.departmentId ? [{ assigned_department_id: auth.departmentId }] : []),
        ],
      }));
    }
    return Boolean(await EmergencyCase.exists({ _id: id, patient_id: auth.patientId }));
  }
  return false;
}

async function authorizedRooms(auth = {}, requestedRooms = []) {
  const checks = await Promise.all(requestedRooms.map(async (room) => ({
    room,
    allowed: await canJoinRoom(auth, room),
  })));
  return checks.filter((item) => item.allowed).map((item) => item.room);
}

async function canUseConversationRealtime(auth = {}, conversationId) {
  if (!conversationId) return false;
  return canJoinRoom(auth, `conversation:${conversationId}`);
}

function loadSocketIo() {
  try {
    return require('socket.io');
  } catch (error) {
    return null;
  }
}

function loadRedisAdapterDeps() {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const Redis = require('ioredis');
    return { createAdapter, Redis };
  } catch (error) {
    return null;
  }
}

async function configureRedisAdapter(io) {
  if (!io || !env.redisUrl || !env.realtimeRedisEnabled) return null;
  const deps = loadRedisAdapterDeps();
  if (!deps) {
    console.warn('Socket.IO Redis adapter dependencies are not installed; using local socket adapter.');
    return null;
  }

  const { createAdapter, Redis } = deps;
  const redisOptions = { lazyConnect: true, maxRetriesPerRequest: null };
  let pubClient;
  let subClient;

  try {
    pubClient = new Redis(env.redisUrl, redisOptions);
    subClient = pubClient.duplicate();
    pubClient.on('error', (error) => console.warn(`Socket.IO Redis pub client error: ${error.message}`));
    subClient.on('error', (error) => console.warn(`Socket.IO Redis sub client error: ${error.message}`));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    io.redisClients = { pubClient, subClient };
    console.info('Socket.IO Redis adapter enabled.');
    return io.redisClients;
  } catch (error) {
    console.warn(`Socket.IO Redis adapter disabled: ${error.message}`);
    pubClient?.disconnect();
    subClient?.disconnect();
    return null;
  }
}

function initializeSocketServer(httpServer) {
  const socketIo = loadSocketIo();
  if (!socketIo) {
    console.warn('Socket.IO is not installed; realtime socket server is disabled but event outbox remains active.');
    return null;
  }

  const { Server } = socketIo;
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : env.nodeEnv === 'production' ? false : true,
      credentials: true,
    },
  });

  io.use(authenticateSocket);
  realtimeService.setSocketServer(io);
  configureRedisAdapter(io).catch((error) => {
    console.warn(`Socket.IO Redis adapter setup failed: ${error.message}`);
  });

  io.on('connection', async (socket) => {
    const guardSocketEvent = createSocketGuard(socket);
    const joinedRooms = await realtimeService.joinRoomsForSocket(socket, socket.auth);
    socket.emit('realtime.connected', {
      actor_type: socket.auth.actorType,
      actor_id: socket.auth.actorId,
      rooms: joinedRooms,
      connected_at: new Date().toISOString(),
    });

    socket.on('room.subscribe', async (scope = {}) => {
      if (!guardSocketEvent('room.subscribe', scope)) return;
      const requested = buildRoomsFromScope(scope);
      if (requested.length > MAX_SUBSCRIBE_ROOMS_PER_EVENT) {
        socket.emit('room.subscribe_denied', {
          reason: 'too_many_rooms',
          max_rooms: MAX_SUBSCRIBE_ROOMS_PER_EVENT,
        });
        return;
      }
      const rooms = await authorizedRooms(socket.auth, requested);
      await Promise.all(rooms.map((room) => socket.join(room)));
      socket.emit('room.subscribed', { rooms, rejected: requested.filter((room) => !rooms.includes(room)) });
    });

    socket.on('room.unsubscribe', async (scope = {}) => {
      if (!guardSocketEvent('room.unsubscribe', scope)) return;
      const rooms = buildRoomsFromScope(scope);
      await Promise.all(rooms.map((room) => socket.leave(room)));
      socket.emit('room.unsubscribed', { rooms });
    });

    socket.on('presence.ping', (payload = {}) => {
      if (!guardSocketEvent('presence.ping', payload)) return;
      presenceService.touch({ socketId: socket.id });
      socket.emit('presence.pong', { at: new Date().toISOString() });
    });

    socket.on('typing.started', async (payload = {}) => {
      if (!guardSocketEvent('typing.started', payload)) return;
      const conversationId = payload.conversation_id || payload.conversationId;
      if (!(await canUseConversationRealtime(socket.auth, conversationId))) {
        socket.emit('typing.denied', { conversation_id: conversationId });
        return;
      }
      realtimeService.emitToScope('typing.started', {
        ...payload,
        actor_type: socket.auth.actorType,
        actor_id: socket.auth.actorId,
      }, { conversation_id: conversationId });
    });

    socket.on('typing.stopped', async (payload = {}) => {
      if (!guardSocketEvent('typing.stopped', payload)) return;
      const conversationId = payload.conversation_id || payload.conversationId;
      if (!(await canUseConversationRealtime(socket.auth, conversationId))) {
        socket.emit('typing.denied', { conversation_id: conversationId });
        return;
      }
      realtimeService.emitToScope('typing.stopped', {
        ...payload,
        actor_type: socket.auth.actorType,
        actor_id: socket.auth.actorId,
      }, { conversation_id: conversationId });
    });

    socket.on('disconnect', () => {
      realtimeService.disconnectSocket(socket.id);
    });
  });

  return io;
}

module.exports = {
  initializeSocketServer,
};
