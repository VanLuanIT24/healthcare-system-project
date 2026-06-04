import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => search.append(key, item));
      return;
    }
    search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function parseResponse(response, fallbackMessage = 'Không thể tải Trung tâm vận hành.') {
  const contentType = response.headers?.get?.('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().then((text) => (text ? { message: text } : null)).catch(() => null);

  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || payload?.error || fallbackMessage;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data;
  return payload ?? null;
}

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
      'Idempotency-Key': idempotencyKey(),
    },
    body: JSON.stringify(body || {}),
  });
  return parseResponse(response, 'Không thể thực hiện thao tác vận hành.');
}

export async function opsPatch(path, body = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}/ops${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return parseResponse(response, 'Không thể cập nhật bản ghi vận hành.');
}
