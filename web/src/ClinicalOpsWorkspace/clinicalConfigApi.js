import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method, body) {
  return request(path, { method, body }).then(unwrap);
}

export const clinicalConfigAPI = {
  overview: (params) => request('/clinical-config/overview', { params }).then(unwrap),
  serviceOptions: (params) => request('/clinical-config/service-options', { params }).then(unwrap),

  labTests: (params) => request('/clinical-config/lab-tests', { params }).then(unwrap),
  createLabTest: (body) => bodyRequest('/clinical-config/lab-tests', 'POST', body),
  updateLabTest: (id, body) => bodyRequest(`/clinical-config/lab-tests/${encodeURIComponent(id)}`, 'PATCH', body),
  cloneLabTest: (id, body = {}) => bodyRequest(`/clinical-config/lab-tests/${encodeURIComponent(id)}/clone`, 'POST', body),
  retireLabTest: (id) => bodyRequest(`/clinical-config/lab-tests/${encodeURIComponent(id)}/retire`, 'POST', {}),
  linkLabTestService: (id, body) => bodyRequest(`/clinical-config/lab-tests/${encodeURIComponent(id)}/link-service`, 'POST', body),

  specimenTypes: (params) => request('/clinical-config/specimen-types', { params }).then(unwrap),
  createSpecimenType: (body) => bodyRequest('/clinical-config/specimen-types', 'POST', body),
  updateSpecimenType: (id, body) => bodyRequest(`/clinical-config/specimen-types/${encodeURIComponent(id)}`, 'PATCH', body),
  cloneSpecimenType: (id, body = {}) => bodyRequest(`/clinical-config/specimen-types/${encodeURIComponent(id)}/clone`, 'POST', body),
  retireSpecimenType: (id) => bodyRequest(`/clinical-config/specimen-types/${encodeURIComponent(id)}/retire`, 'POST', {}),

  imagingModalities: (params) => request('/clinical-config/imaging-modalities', { params }).then(unwrap),
  createImagingModality: (body) => bodyRequest('/clinical-config/imaging-modalities', 'POST', body),
  updateImagingModality: (id, body) => bodyRequest(`/clinical-config/imaging-modalities/${encodeURIComponent(id)}`, 'PATCH', body),
  cloneImagingModality: (id, body = {}) => bodyRequest(`/clinical-config/imaging-modalities/${encodeURIComponent(id)}/clone`, 'POST', body),
  retireImagingModality: (id) => bodyRequest(`/clinical-config/imaging-modalities/${encodeURIComponent(id)}/retire`, 'POST', {}),

  imagingRoomsEquipment: (params) => request('/clinical-config/imaging-rooms-equipment', { params }).then(unwrap),
  createImagingRoom: (body) => bodyRequest('/clinical-config/imaging-rooms', 'POST', body),
  updateImagingRoom: (id, body) => bodyRequest(`/clinical-config/imaging-rooms/${encodeURIComponent(id)}`, 'PATCH', body),
  createImagingEquipment: (body) => bodyRequest('/clinical-config/imaging-equipment', 'POST', body),
  updateImagingEquipment: (id, body) => bodyRequest(`/clinical-config/imaging-equipment/${encodeURIComponent(id)}`, 'PATCH', body),
  markEquipmentDown: (id, body = {}) => bodyRequest(`/clinical-config/imaging-equipment/${encodeURIComponent(id)}/mark-down`, 'POST', body),
  restoreEquipment: (id, body = {}) => bodyRequest(`/clinical-config/imaging-equipment/${encodeURIComponent(id)}/restore`, 'POST', body),

  procedures: (params) => request('/clinical-config/procedures', { params }).then(unwrap),
  createProcedure: (body) => bodyRequest('/clinical-config/procedures', 'POST', body),
  updateProcedure: (id, body) => bodyRequest(`/clinical-config/procedures/${encodeURIComponent(id)}`, 'PATCH', body),
  cloneProcedure: (id, body = {}) => bodyRequest(`/clinical-config/procedures/${encodeURIComponent(id)}/clone`, 'POST', body),
  retireProcedure: (id) => bodyRequest(`/clinical-config/procedures/${encodeURIComponent(id)}/retire`, 'POST', {}),
  linkProcedureService: (id, body) => bodyRequest(`/clinical-config/procedures/${encodeURIComponent(id)}/link-service`, 'POST', body),
  linkProcedureChecklist: (id, body) => bodyRequest(`/clinical-config/procedures/${encodeURIComponent(id)}/link-checklist`, 'POST', body),

  checklistTemplates: (params) => request('/clinical-config/checklist-templates', { params }).then(unwrap),
  createChecklistTemplate: (body) => bodyRequest('/clinical-config/checklist-templates', 'POST', body),
  updateChecklistTemplate: (id, body) => bodyRequest(`/clinical-config/checklist-templates/${encodeURIComponent(id)}`, 'PATCH', body),
  cloneChecklistTemplate: (id, body = {}) => bodyRequest(`/clinical-config/checklist-templates/${encodeURIComponent(id)}/clone`, 'POST', body),
  previewChecklistTemplate: (params) => request('/clinical-config/checklist-templates/preview', { params }).then(unwrap),

  slaDashboard: (params) => request('/clinical-config/sla-dashboard', { params }).then(unwrap),
  slaRules: (params) => request('/clinical-config/sla-rules', { params }).then(unwrap),
  createSlaRule: (body) => bodyRequest('/clinical-config/sla-rules', 'POST', body),
  updateSlaRule: (id, body) => bodyRequest(`/clinical-config/sla-rules/${encodeURIComponent(id)}`, 'PATCH', body),
  activateSlaRule: (id) => bodyRequest(`/clinical-config/sla-rules/${encodeURIComponent(id)}/activate`, 'POST', {}),
  deactivateSlaRule: (id) => bodyRequest(`/clinical-config/sla-rules/${encodeURIComponent(id)}/deactivate`, 'POST', {}),
  simulateSlaRule: (id, body = {}) => bodyRequest(`/clinical-config/sla-rules/${encodeURIComponent(id)}/simulate`, 'POST', body),

  reportTemplates: (params) => request('/clinical-config/report-templates', { params }).then(unwrap),
  createReportTemplate: (body) => bodyRequest('/clinical-config/report-templates', 'POST', body),
  updateReportTemplate: (id, body) => bodyRequest(`/clinical-config/report-templates/${encodeURIComponent(id)}`, 'PATCH', body),
  cloneReportTemplate: (id, body = {}) => bodyRequest(`/clinical-config/report-templates/${encodeURIComponent(id)}/clone`, 'POST', body),
  publishReportTemplate: (id) => bodyRequest(`/clinical-config/report-templates/${encodeURIComponent(id)}/publish`, 'POST', {}),
  retireReportTemplate: (id) => bodyRequest(`/clinical-config/report-templates/${encodeURIComponent(id)}/retire`, 'POST', {}),
  setDefaultReportTemplate: (id) => bodyRequest(`/clinical-config/report-templates/${encodeURIComponent(id)}/set-default`, 'POST', {}),
  previewReportTemplate: (id, body = {}) => bodyRequest(`/clinical-config/report-templates/${encodeURIComponent(id)}/preview`, 'POST', body),
};

export function getClinicalConfigError(error, fallback = 'Không thể tải Clinical Config.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
