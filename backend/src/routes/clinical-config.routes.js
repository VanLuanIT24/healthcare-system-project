const express = require('express');
const clinicalConfigController = require('../controllers/clinical-config.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('id', validateObjectIdParam);

const configReadPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.LAB_TEST_CATALOG.READ,
  PERMISSION.SPECIMEN_TYPE_CATALOG.READ,
  PERMISSION.IMAGING_MODALITY_CATALOG.READ,
  PERMISSION.IMAGING_EQUIPMENT.READ,
  PERMISSION.PROCEDURE_CATALOG.READ,
  PERMISSION.CLINICAL_SLA_RULES.READ,
  PERMISSION.RESULT_REPORT_TEMPLATES.READ,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.SERVICE_CATALOG.READ,
  PERMISSION.SETTINGS.READ,
].filter(Boolean);

const configWritePermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.LAB_TEST_CATALOG.CREATE,
  PERMISSION.LAB_TEST_CATALOG.UPDATE,
  PERMISSION.LAB_TEST_CATALOG.RETIRE,
  PERMISSION.SPECIMEN_TYPE_CATALOG.CREATE,
  PERMISSION.SPECIMEN_TYPE_CATALOG.UPDATE,
  PERMISSION.SPECIMEN_TYPE_CATALOG.RETIRE,
  PERMISSION.IMAGING_MODALITY_CATALOG.CREATE,
  PERMISSION.IMAGING_MODALITY_CATALOG.UPDATE,
  PERMISSION.IMAGING_MODALITY_CATALOG.RETIRE,
  PERMISSION.IMAGING_EQUIPMENT.CREATE,
  PERMISSION.IMAGING_EQUIPMENT.UPDATE,
  PERMISSION.IMAGING_EQUIPMENT.MAINTENANCE,
  PERMISSION.IMAGING_EQUIPMENT.DISABLE,
  PERMISSION.PROCEDURE_CATALOG.CREATE,
  PERMISSION.PROCEDURE_CATALOG.UPDATE,
  PERMISSION.PROCEDURE_CATALOG.RETIRE,
  PERMISSION.CLINICAL_SLA_RULES.CREATE,
  PERMISSION.CLINICAL_SLA_RULES.UPDATE,
  PERMISSION.CLINICAL_SLA_RULES.ACTIVATE,
  PERMISSION.CLINICAL_SLA_RULES.DEACTIVATE,
  PERMISSION.RESULT_REPORT_TEMPLATES.CREATE,
  PERMISSION.RESULT_REPORT_TEMPLATES.UPDATE,
  PERMISSION.RESULT_REPORT_TEMPLATES.PUBLISH,
  PERMISSION.RESULT_REPORT_TEMPLATES.RETIRE,
  PERMISSION.LAB_RESULTS.WRITE,
  PERMISSION.LAB_RESULTS.FINALIZE,
  PERMISSION.IMAGING_ORDERS.UPDATE_STATUS,
  PERMISSION.IMAGING_REPORTS.WRITE,
  PERMISSION.IMAGING_REPORTS.FINALIZE,
  PERMISSION.PROCEDURE_ORDERS.UPDATE,
  PERMISSION.SETTINGS.UPDATE,
].filter(Boolean);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/overview', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.overview);
router.get('/service-options', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.serviceOptions);

router.get('/lab-tests', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.listLabTests);
router.post('/lab-tests', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createLabTest);
router.get('/lab-tests/:id', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.getLabTest);
router.patch('/lab-tests/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateLabTest);
router.post('/lab-tests/:id/clone', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.cloneLabTest);
router.post('/lab-tests/:id/retire', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.retireLabTest);
router.post('/lab-tests/:id/link-service', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.linkLabTestService);

router.get('/specimen-types', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.listSpecimenTypes);
router.post('/specimen-types', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createSpecimenType);
router.get('/specimen-types/:id', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.getSpecimenType);
router.patch('/specimen-types/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateSpecimenType);
router.post('/specimen-types/:id/clone', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.cloneSpecimenType);
router.post('/specimen-types/:id/retire', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.retireSpecimenType);

router.get('/imaging-modalities', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.listImagingModalities);
router.post('/imaging-modalities', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createImagingModality);
router.patch('/imaging-modalities/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateImagingModality);
router.post('/imaging-modalities/:id/clone', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.cloneImagingModality);
router.post('/imaging-modalities/:id/retire', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.retireImagingModality);

router.get('/imaging-rooms-equipment', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.listImagingRoomsEquipment);
router.post('/imaging-rooms', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createImagingRoom);
router.patch('/imaging-rooms/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateImagingRoom);
router.post('/imaging-equipment', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createImagingEquipment);
router.patch('/imaging-equipment/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateImagingEquipment);
router.post('/imaging-equipment/:id/mark-down', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.markEquipmentDown);
router.post('/imaging-equipment/:id/restore', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.restoreEquipment);

router.get('/procedures', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.listProcedures);
router.post('/procedures', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createProcedure);
router.get('/procedures/:id', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.getProcedure);
router.patch('/procedures/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateProcedure);
router.post('/procedures/:id/clone', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.cloneProcedure);
router.post('/procedures/:id/retire', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.retireProcedure);
router.post('/procedures/:id/link-service', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.linkProcedureService);
router.post('/procedures/:id/link-checklist', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.linkProcedureChecklist);

router.get('/checklist-templates/preview', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.previewChecklistTemplate);
router.get('/checklist-templates', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.listChecklistTemplates);
router.post('/checklist-templates', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createChecklistTemplate);
router.patch('/checklist-templates/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateChecklistTemplate);
router.post('/checklist-templates/:id/clone', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.cloneChecklistTemplate);

router.get('/sla-dashboard', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.slaDashboard);
router.get('/sla-rules', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.listSlaRules);
router.post('/sla-rules', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createSlaRule);
router.patch('/sla-rules/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateSlaRule);
router.post('/sla-rules/:id/activate', authorize({ anyPermissions: configWritePermissions }), (req, res, next) => {
  req.body = { ...req.body, active: true };
  return clinicalConfigController.updateSlaRule(req, res, next);
});
router.post('/sla-rules/:id/deactivate', authorize({ anyPermissions: configWritePermissions }), (req, res, next) => {
  req.body = { ...req.body, active: false };
  return clinicalConfigController.updateSlaRule(req, res, next);
});
router.post('/sla-rules/:id/simulate', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.simulateSlaRule);

router.get('/report-templates', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.listReportTemplates);
router.post('/report-templates', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.createReportTemplate);
router.patch('/report-templates/:id', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.updateReportTemplate);
router.post('/report-templates/:id/clone', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.cloneReportTemplate);
router.post('/report-templates/:id/publish', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.publishReportTemplate);
router.post('/report-templates/:id/retire', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.retireReportTemplate);
router.post('/report-templates/:id/set-default', authorize({ anyPermissions: configWritePermissions }), clinicalConfigController.setDefaultReportTemplate);
router.post('/report-templates/:id/preview', authorize({ anyPermissions: configReadPermissions }), clinicalConfigController.previewReportTemplate);

module.exports = router;
