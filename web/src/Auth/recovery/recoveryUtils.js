import { parseRecoveryActor } from './recoveryConfig';

export function parseRetryAfterSeconds(response, payload) {
  const headerValue = Number(response.headers.get('Retry-After'));
  if (Number.isFinite(headerValue) && headerValue > 0) return headerValue;

  const retryAfter = Number(payload?.details?.retry_after_seconds);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;

  return 0;
}

export async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

export function resolveRecoveryActorFromPath(pathname = '', searchParams = new URLSearchParams()) {
  if (String(pathname).startsWith('/staff/')) return 'staff';
  if (String(pathname).startsWith('/patient/')) return 'patient';
  return parseRecoveryActor(searchParams.get('actorType') || searchParams.get('actor_type'));
}

export function buildRecoveryPath(actorType, type, query = {}) {
  const normalizedActorType = parseRecoveryActor(actorType);
  const basePath = type === 'reset'
    ? `/${normalizedActorType}/reset-password`
    : `/${normalizedActorType}/forgot-password`;

  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });

  const text = search.toString();
  return text ? `${basePath}?${text}` : basePath;
}
