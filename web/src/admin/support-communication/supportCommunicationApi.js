import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error?.message || 'Không thể tải Support & Communication.');
  }
  return payload?.data;
}

export async function supportCommGet(path, params) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/support-communication${path}${buildQuery(params)}`);
  return parseResponse(response);
}

export async function supportCommPost(path, body = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/support-communication${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function supportCommPatch(path, body = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/support-communication${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function supportCommDelete(path) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/support-communication${path}`, {
    method: 'DELETE',
  });
  return parseResponse(response);
}
