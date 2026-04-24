const express = require('express');
const clinicalController = require('../controllers/clinical.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/consultations', authorize({ anyPermissions: ['consultations.write', 'encounters.read'] }), clinicalController.listConsultations);
router.post('/consultations', authorize({ permissions: ['consultations.write'] }), clinicalController.createConsultation);
router.get('/consultations/:consultationId', authorize({ anyPermissions: ['consultations.write', 'encounters.read'] }), clinicalController.getConsultationDetail);
router.patch('/consultations/:consultationId', authorize({ permissions: ['consultations.write'] }), clinicalController.updateConsultation);
router.post('/consultations/:consultationId/start', authorize({ permissions: ['consultations.write'] }), clinicalController.startConsultation);
router.post('/consultations/:consultationId/sign', authorize({ permissions: ['consultations.write'] }), clinicalController.signConsultation);
router.post('/consultations/:consultationId/amend', authorize({ permissions: ['consultations.write'] }), clinicalController.amendConsultation);
router.post('/consultations/:consultationId/cancel', authorize({ permissions: ['consultations.write'] }), clinicalController.cancelConsultation);

router.post('/diagnoses', authorize({ permissions: ['diagnoses.write'] }), clinicalController.addDiagnosis);
router.get('/encounters/:encounterId/diagnoses', authorize({ anyPermissions: ['diagnoses.write', 'encounters.read'] }), clinicalController.listDiagnosesByEncounter);
router.get('/encounters/:encounterId/summary', authorize({ anyPermissions: ['consultations.write', 'encounters.read'] }), clinicalController.getEncounterClinicalSummary);
router.get('/diagnoses/:diagnosisId', authorize({ anyPermissions: ['diagnoses.write', 'encounters.read'] }), clinicalController.getDiagnosisDetail);
router.patch('/diagnoses/:diagnosisId', authorize({ permissions: ['diagnoses.write'] }), clinicalController.updateDiagnosis);
router.post('/diagnoses/:diagnosisId/resolve', authorize({ permissions: ['diagnoses.write'] }), clinicalController.resolveDiagnosis);
router.post('/diagnoses/:diagnosisId/set-primary', authorize({ permissions: ['diagnoses.write'] }), clinicalController.setPrimaryDiagnosis);
router.post('/diagnoses/:diagnosisId/remove', authorize({ permissions: ['diagnoses.write'] }), clinicalController.removeDiagnosis);

router.post('/vital-signs', authorize({ permissions: ['vitals.write'] }), clinicalController.recordVitalSigns);
router.get('/encounters/:encounterId/vital-signs', authorize({ anyPermissions: ['vitals.write', 'encounters.read'] }), clinicalController.listVitalSigns);
router.get('/encounters/:encounterId/vital-signs/latest', authorize({ anyPermissions: ['vitals.write', 'encounters.read'] }), clinicalController.getLatestVitalSigns);
router.get('/vital-signs/:vitalSignId', authorize({ anyPermissions: ['vitals.write', 'encounters.read'] }), clinicalController.getVitalSignDetail);
router.patch('/vital-signs/:vitalSignId', authorize({ permissions: ['vitals.write'] }), clinicalController.updateVitalSigns);
router.post('/vital-signs/:vitalSignId/remove', authorize({ permissions: ['vitals.write'] }), clinicalController.deleteVitalSignsRecord);

router.get('/notes', authorize({ anyPermissions: ['consultations.write', 'encounters.read'] }), clinicalController.listClinicalNotes);
router.post('/notes', authorize({ permissions: ['consultations.write'] }), clinicalController.createClinicalNote);
router.get('/notes/:noteId', authorize({ anyPermissions: ['consultations.write', 'encounters.read'] }), clinicalController.getClinicalNoteDetail);
router.patch('/notes/:noteId', authorize({ permissions: ['consultations.write'] }), clinicalController.updateClinicalNote);
router.post('/notes/:noteId/start', authorize({ permissions: ['consultations.write'] }), clinicalController.startClinicalNote);
router.post('/notes/:noteId/complete', authorize({ permissions: ['consultations.write'] }), clinicalController.completeClinicalNote);
router.post('/notes/:noteId/sign', authorize({ permissions: ['consultations.write'] }), clinicalController.signClinicalNote);
router.post('/notes/:noteId/amend', authorize({ permissions: ['consultations.write'] }), clinicalController.amendClinicalNote);
router.post('/notes/:noteId/cancel', authorize({ permissions: ['consultations.write'] }), clinicalController.cancelClinicalNote);

module.exports = router;
