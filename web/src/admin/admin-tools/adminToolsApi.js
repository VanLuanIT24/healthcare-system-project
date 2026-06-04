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
  const text = await response.text().catch(() => '');
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = { message: text };
    }
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || payload?.error || response.statusText || 'Không thể tải Admin Tools.';
    throw new Error(typeof message === 'string' ? message : 'Không thể tải Admin Tools.');
  }
  if (response.status === 204) return null;
  return payload?.data ?? payload ?? null;
}

export async function adminToolsGet(path = '', params) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin-tools${path}${buildQuery(params)}`);
  return parseResponse(response);
}

export async function adminToolsPost(path = '', body = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin-tools${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}
