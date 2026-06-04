import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function request(url, options) {
  const response = await fetchWithAuth(url, options);
  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    payload = { message: text || 'Backend trả về response không phải JSON.' };
  }

  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể xử lý yêu cầu Master Data.');
  }

  return payload?.data ?? payload;
}

export function getMasterDataOverview() {
  return request(`${API_BASE_URL}/admin/master-data/overview`);
}

export function getMasterDataQualityDashboard() {
  return request(`${API_BASE_URL}/admin/master-data/quality-dashboard`);
}

export function runMasterDataQualityCheck() {
  return request(`${API_BASE_URL}/admin/master-data/quality-check/run`, { method: 'POST' });
}

export function getMasterDataIssues(query = '') {
  return request(`${API_BASE_URL}/admin/master-data/issues${query ? `?${query}` : ''}`);
}

export function getMasterDataRecentChanges(query = 'limit=30') {
  return request(`${API_BASE_URL}/admin/master-data/recent-changes?${query}`);
}

export function getMasterDataDependencyGraph() {
  return request(`${API_BASE_URL}/admin/master-data/dependency-graph`);
}

export function listMasterDataEntity(entity, query = 'limit=60') {
  return request(`${API_BASE_URL}/admin/master-data/entities/${entity}${query ? `?${query}` : ''}`);
}

export function getMasterDataEntityDependencies(entity, id) {
  return request(`${API_BASE_URL}/admin/master-data/entities/${entity}/${id}/dependencies`);
}
