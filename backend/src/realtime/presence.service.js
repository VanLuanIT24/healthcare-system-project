const DEFAULT_TTL_MS = 30000;

const presenceByActor = new Map();
const socketToActor = new Map();

function keyFor(actorType, actorId) {
  if (!actorType || !actorId) return null;
  return `${actorType}:${actorId}`;
}

function nowMs() {
  return Date.now();
}

function pruneExpired() {
  const now = nowMs();
  for (const [key, state] of presenceByActor.entries()) {
    if (state.expires_at <= now || state.socket_ids.size === 0) {
      presenceByActor.delete(key);
    }
  }
}

function markOnline({ actorType, actorId, socketId, rooms = [], ttlMs = DEFAULT_TTL_MS } = {}) {
  const key = keyFor(actorType, actorId);
  if (!key || !socketId) return null;
  const existing = presenceByActor.get(key) || {
    actor_type: actorType,
    actor_id: String(actorId),
    socket_ids: new Set(),
    rooms: new Set(),
  };
  existing.socket_ids.add(socketId);
  rooms.forEach((room) => existing.rooms.add(room));
  existing.expires_at = nowMs() + ttlMs;
  existing.last_seen_at = new Date();
  presenceByActor.set(key, existing);
  socketToActor.set(socketId, key);
  return serializePresence(existing);
}

function touch({ actorType, actorId, socketId, ttlMs = DEFAULT_TTL_MS } = {}) {
  const key = keyFor(actorType, actorId) || socketToActor.get(socketId);
  if (!key) return null;
  const state = presenceByActor.get(key);
  if (!state) return null;
  state.expires_at = nowMs() + ttlMs;
  state.last_seen_at = new Date();
  return serializePresence(state);
}

function markOffline(socketId) {
  const key = socketToActor.get(socketId);
  if (!key) return null;
  socketToActor.delete(socketId);
  const state = presenceByActor.get(key);
  if (!state) return null;
  state.socket_ids.delete(socketId);
  if (state.socket_ids.size === 0) {
    state.expires_at = nowMs();
    presenceByActor.delete(key);
  }
  return serializePresence(state);
}

function isOnline(actorType, actorId) {
  pruneExpired();
  const state = presenceByActor.get(keyFor(actorType, actorId));
  return Boolean(state && state.socket_ids.size > 0);
}

function serializePresence(state) {
  if (!state) return null;
  return {
    actor_type: state.actor_type,
    actor_id: state.actor_id,
    socket_count: state.socket_ids.size,
    socket_ids: [...state.socket_ids],
    rooms: [...state.rooms],
    last_seen_at: state.last_seen_at,
    expires_at: new Date(state.expires_at),
  };
}

function getPresence(actorType, actorId) {
  pruneExpired();
  return serializePresence(presenceByActor.get(keyFor(actorType, actorId)));
}

function getAllPresence() {
  pruneExpired();
  return [...presenceByActor.values()].map(serializePresence).filter(Boolean);
}

module.exports = {
  markOnline,
  touch,
  markOffline,
  isOnline,
  getPresence,
  getAllPresence,
  pruneExpired,
};
