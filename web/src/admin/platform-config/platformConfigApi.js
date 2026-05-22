import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function request(path, options = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể xử lý cấu hình nền tảng.');
  }

  return payload?.data;
}

export function getPlatformConfigOverview() {
  return request('/platform-config/overview');
}

export function getPlatformConfigModule(moduleKey) {
  return request(`/platform-config/modules/${encodeURIComponent(moduleKey)}`);
}

export function validatePlatformConfig(payload = {}) {
  return request('/platform-config/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function testPlatformConfigModule(moduleKey, payload = {}) {
  return request(`/platform-config/test/${encodeURIComponent(moduleKey)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function applyPlatformConfig(changes, changeReason = '') {
  return request('/platform-config/apply', {
    method: 'POST',
    body: JSON.stringify({ changes, change_reason: changeReason }),
  });
}

export function reloadPlatformConfig() {
  return request('/platform-config/reload', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getPlatformConfigDrift() {
  return request('/platform-config/drift');
}

export function getPlatformSecretsStatus() {
  return request('/platform-config/secrets/status');
}

export function getSettingRevisions(settingKey) {
  return request(`/platform-config/settings/${encodeURIComponent(settingKey)}/revisions`);
}

export function rollbackSetting(settingKey, revisionNo, changeReason = '') {
  return request(`/platform-config/settings/${encodeURIComponent(settingKey)}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ revision_no: revisionNo, change_reason: changeReason }),
  });
}
