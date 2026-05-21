import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error?.message || 'Không thể tải Command Center.');
  }
  return payload?.data;
}

export async function commandCenterGet(path) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/command-center${path}`);
  return parseResponse(response);
}

export async function commandCenterPost(path, body = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/command-center${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}
