import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function id(value) {
  return encodeURIComponent(value);
}

export const billingPriceListAPI = {
  summary: (params) => request('/billing/service-catalog/summary', { params }).then(unwrap),
  departmentSummary: (params) => request('/billing/service-catalog/department-summary', { params }).then(unwrap),
  services: (params) => request('/billing/service-catalog', { params }).then(unwrap),
  effective: (params) => request('/billing/service-catalog/effective', { params }).then(unwrap),
  detail: (serviceId) => request(`/billing/service-catalog/${id(serviceId)}`).then(unwrap),
  usage: (serviceId) => request(`/billing/service-catalog/${id(serviceId)}/usage`).then(unwrap),
  timeline: (serviceId) => request(`/billing/service-catalog/${id(serviceId)}/timeline`).then(unwrap),
  charges: (serviceId, params) => request(`/billing/service-catalog/${id(serviceId)}/charges`, { params }).then(unwrap),
  invoiceItems: (serviceId, params) => request(`/billing/service-catalog/${id(serviceId)}/invoice-items`, { params }).then(unwrap),
  create: (body) => request('/billing/service-catalog', { method: 'POST', body }).then(unwrap),
  update: (serviceId, body) => request(`/billing/service-catalog/${id(serviceId)}`, { method: 'PATCH', body }).then(unwrap),
  newVersion: (serviceId, body) =>
    request(`/billing/service-catalog/${id(serviceId)}/new-version`, { method: 'POST', body }).then(unwrap),
  retire: (serviceId, body) => request(`/billing/service-catalog/${id(serviceId)}/retire`, { method: 'POST', body }).then(unwrap),
  reactivate: (serviceId, body) =>
    request(`/billing/service-catalog/${id(serviceId)}/reactivate`, { method: 'POST', body }).then(unwrap),
  clone: (serviceId, body) => request(`/billing/service-catalog/${id(serviceId)}/clone`, { method: 'POST', body }).then(unwrap),
  bulkUpdate: (body) => request('/billing/service-catalog/bulk-update', { method: 'POST', body }).then(unwrap),
  bulkRetire: (body) => request('/billing/service-catalog/bulk-retire', { method: 'POST', body }).then(unwrap),
};

export function getPriceListErrorMessage(error, fallback = 'Không thể xử lý dữ liệu bảng giá.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
