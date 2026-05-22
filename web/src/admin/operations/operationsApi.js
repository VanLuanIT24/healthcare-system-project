import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error?.message || 'Không thể tải Operations Center.');
  }
  return payload?.data;
}

export async function opsGet(path, params) {
  const response = await fetchWithAuth(`${API_BASE_URL}/ops${path}${buildQuery(params)}`);
  return parseResponse(response);
}

export async function opsPost(path, body = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}/ops${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function opsPatch(path, body = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}/ops${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}
