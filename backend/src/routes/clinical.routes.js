const express = require('express');
const clinicalController = require('../controllers/clinical.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('encounterId', validateObjectIdParam);
router.param('consultationId', validateObjectIdParam);
router.param('diagnosisId', validateObjectIdParam);
router.param('vitalSignId', validateObjectIdParam);
router.param('noteId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);
router.param('allergyId', validateObjectIdParam);
router.param('problemId', validateObjectIdParam);
router.param('carePlanId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/consultations', authorize({ anyPermissions: [PERMISSION.CONSULTATIONS.READ, PERMISSION.CONSULTATIONS.READ_OWN, PERMISSION.CONSULTATIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), clinicalController.listConsultations);
router.post('/consultations', authorize({ permissions: [PERMISSION.CONSULTATIONS.CREATE] }), idempotencyRequired({ route: '/api/clinical/consultations' }), clinicalController.createConsultation);
router.get('/encounters/:encounterId/consultations', authorize({ anyPermissions: [PERMISSION.CONSULTATIONS.READ, PERMISSION.CONSULTATIONS.READ_OWN, PERMISSION.CONSULTATIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return clinicalController.listConsultations(req, res, next);
});
router.post('/encounters/:encounterId/consultations', authorize({ permissions: [PERMISSION.CONSULTATIONS.CREATE] }), idempotencyRequired({ route: '/api/clinical/encounters/:encounterId/consultations' }), (req, res, next) => {
  req.body.encounter_id = req.params.encounterId;
  return clinicalController.createConsultation(req, res, next);
});
router.get('/consultations/:consultationId', authorize({ anyPermissions: [PERMISSION.CONSULTATIONS.READ, PERMISSION.CONSULTATIONS.READ_OWN, PERMISSION.CONSULTATIONS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ] }), clinicalController.getConsultationDetail);
router.patch('/consultations/:consultationId', authorize({ anyPermissions: [PERMISSION.CONSULTATIONS.UPDATE, PERMISSION.CONSULTATIONS.UPDATE_OWN] }), clinicalController.updateConsultation);
router.post('/consultations/:consultationId/start', authorize({ anyPermissions: [PERMISSION.CONSULTATIONS.UPDATE, PERMISSION.CONSULTATIONS.UPDATE_OWN] }), clinicalController.startConsultation);
router.post('/consultations/:consultationId/sign', authorize({ anyPermissions: [PERMISSION.CONSULTATIONS.SIGN, PERMISSION.CONSULTATIONS.SIGN_OWN] }), clinicalController.signConsultation);
router.post('/consultations/:consultationId/amend', authorize({ anyPermissions: [PERMISSION.CONSULTATIONS.AMEND, PERMISSION.CONSULTATIONS.AMEND_OWN] }), clinicalController.amendConsultation);
router.post('/consultations/:consultationId/cancel', authorize({ permissions: [PERMISSION.CONSULTATIONS.CANCEL] }), clinicalController.cancelConsultation);

router.post('/diagnoses', authorize({ permissions: [PERMISSION.DIAGNOSES.CREATE] }), clinicalController.addDiagnosis);
router.post('/encounters/:encounterId/diagnoses', authorize({ permissions: [PERMISSION.DIAGNOSES.CREATE] }), (req, res, next) => {
  req.body.encounter_id = req.params.encounterId;
  return clinicalController.addDiagnosis(req, res, next);
});
router.get('/encounters/:encounterId/diagnoses', authorize({ anyPermissions: [PERMISSION.DIAGNOSES.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), clinicalController.listDiagnosesByEncounter);
router.get('/encounters/:encounterId/summary', authorize({ anyPermissions: [PERMISSION.CONSULTATIONS.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), clinicalController.getEncounterClinicalSummary);
router.get('/diagnoses/:diagnosisId', authorize({ anyPermissions: [PERMISSION.DIAGNOSES.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), clinicalController.getDiagnosisDetail);
router.patch('/diagnoses/:diagnosisId', authorize({ anyPermissions: [PERMISSION.DIAGNOSES.UPDATE, PERMISSION.DIAGNOSES.UPDATE_OWN] }), clinicalController.updateDiagnosis);
router.post('/diagnoses/:diagnosisId/resolve', authorize({ anyPermissions: [PERMISSION.DIAGNOSES.UPDATE, PERMISSION.DIAGNOSES.UPDATE_OWN] }), clinicalController.resolveDiagnosis);
router.post('/diagnoses/:diagnosisId/set-primary', authorize({ permissions: [PERMISSION.DIAGNOSES.SET_PRIMARY] }), clinicalController.setPrimaryDiagnosis);
router.post('/diagnoses/:diagnosisId/entered-in-error', authorize({ anyPermissions: [PERMISSION.DIAGNOSES.ENTERED_IN_ERROR, PERMISSION.DIAGNOSES.MANAGE] }), clinicalController.removeDiagnosis);
router.post('/diagnoses/:diagnosisId/remove', authorize({ anyPermissions: [PERMISSION.DIAGNOSES.ENTERED_IN_ERROR, PERMISSION.DIAGNOSES.MANAGE] }), clinicalController.removeDiagnosis);

router.post('/vital-signs', authorize({ permissions: [PERMISSION.VITAL_SIGNS.CREATE] }), clinicalController.recordVitalSigns);
router.post('/encounters/:encounterId/vital-signs', authorize({ permissions: [PERMISSION.VITAL_SIGNS.CREATE] }), (req, res, next) => {
  req.body.encounter_id = req.params.encounterId;
  return clinicalController.recordVitalSigns(req, res, next);
});
router.get('/encounters/:encounterId/vital-signs', authorize({ anyPermissions: [PERMISSION.VITAL_SIGNS.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), clinicalController.listVitalSigns);
router.get('/encounters/:encounterId/vital-signs/latest', authorize({ anyPermissions: [PERMISSION.VITAL_SIGNS.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), clinicalController.getLatestVitalSigns);
router.get('/vital-signs/:vitalSignId', authorize({ anyPermissions: [PERMISSION.VITAL_SIGNS.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), clinicalController.getVitalSignDetail);
router.patch('/vital-signs/:vitalSignId', authorize({ permissions: [PERMISSION.VITAL_SIGNS.UPDATE_OWN] }), clinicalController.updateVitalSigns);
router.post('/vital-signs/:vitalSignId/entered-in-error', authorize({ permissions: [PERMISSION.VITAL_SIGNS.ENTERED_IN_ERROR] }), clinicalController.deleteVitalSignsRecord);
router.post('/vital-signs/:vitalSignId/remove', authorize({ permissions: [PERMISSION.VITAL_SIGNS.ENTERED_IN_ERROR] }), clinicalController.deleteVitalSignsRecord);

router.get('/notes', authorize({ anyPermissions: [PERMISSION.CLINICAL_NOTES.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), clinicalController.listClinicalNotes);
router.post('/notes', authorize({ anyPermissions: [PERMISSION.CLINICAL_NOTES.CREATE, PERMISSION.CLINICAL_NOTES.CREATE_NURSING] }), idempotencyRequired({ route: '/api/clinical/notes' }), clinicalController.createClinicalNote);
router.get('/encounters/:encounterId/notes', authorize({ anyPermissions: [PERMISSION.CLINICAL_NOTES.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), (req, res, next) => {
  req.query.encounter_id = req.params.encounterId;
  return clinicalController.listClinicalNotes(req, res, next);
});
router.post('/encounters/:encounterId/notes', authorize({ anyPermissions: [PERMISSION.CLINICAL_NOTES.CREATE, PERMISSION.CLINICAL_NOTES.CREATE_NURSING] }), idempotencyRequired({ route: '/api/clinical/encounters/:encounterId/notes' }), (req, res, next) => {
  req.body.encounter_id = req.params.encounterId;
  return clinicalController.createClinicalNote(req, res, next);
});
router.get('/notes/:noteId', authorize({ anyPermissions: [PERMISSION.CLINICAL_NOTES.READ, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_OWN] }), clinicalController.getClinicalNoteDetail);
router.patch('/notes/:noteId', authorize({ permissions: [PERMISSION.CLINICAL_NOTES.UPDATE_OWN] }), clinicalController.updateClinicalNote);
router.post('/notes/:noteId/start', authorize({ permissions: [PERMISSION.CLINICAL_NOTES.UPDATE_OWN] }), clinicalController.startClinicalNote);
router.post('/notes/:noteId/complete', authorize({ permissions: [PERMISSION.CLINICAL_NOTES.UPDATE_OWN] }), clinicalController.completeClinicalNote);
router.post('/notes/:noteId/sign', authorize({ permissions: [PERMISSION.CLINICAL_NOTES.SIGN] }), clinicalController.signClinicalNote);
router.post('/notes/:noteId/amend', authorize({ permissions: [PERMISSION.CLINICAL_NOTES.AMEND] }), clinicalController.amendClinicalNote);
router.post('/notes/:noteId/cancel', authorize({ anyPermissions: [PERMISSION.CLINICAL_NOTES.WRITE, PERMISSION.CLINICAL_NOTES.UPDATE_OWN] }), clinicalController.cancelClinicalNote);

router.get('/patients/:patientId/allergies', authorize({ anyPermissions: [PERMISSION.ALLERGIES.READ, PERMISSION.PATIENTS.READ, PERMISSION.ENCOUNTERS.READ] }), clinicalController.getPatientLatestAllergies);
router.post('/patients/:patientId/allergies', authorize({ permissions: [PERMISSION.ALLERGIES.CREATE] }), clinicalController.addPatientAllergy);
router.patch('/allergies/:allergyId', authorize({ permissions: [PERMISSION.ALLERGIES.UPDATE] }), clinicalController.updatePatientAllergy);
router.post('/allergies/:allergyId/resolve', authorize({ anyPermissions: [PERMISSION.ALLERGIES.RESOLVE, PERMISSION.ALLERGIES.UPDATE] }), clinicalController.resolvePatientAllergy);
router.post('/allergies/:allergyId/entered-in-error', authorize({ permissions: [PERMISSION.ALLERGIES.UPDATE] }), clinicalController.markAllergyEnteredInError);

router.get('/patients/:patientId/problems', authorize({ anyPermissions: [PERMISSION.PROBLEMS.READ, PERMISSION.PATIENTS.READ, PERMISSION.ENCOUNTERS.READ] }), clinicalController.getPatientLatestProblems);
router.post('/patients/:patientId/problems', authorize({ permissions: [PERMISSION.PROBLEMS.CREATE] }), clinicalController.addPatientProblem);
router.patch('/problems/:problemId', authorize({ permissions: [PERMISSION.PROBLEMS.UPDATE] }), clinicalController.updatePatientProblem);
router.post('/problems/:problemId/resolve', authorize({ anyPermissions: [PERMISSION.PROBLEMS.RESOLVE, PERMISSION.PROBLEMS.UPDATE] }), clinicalController.resolvePatientProblem);
router.post('/problems/:problemId/entered-in-error', authorize({ permissions: [PERMISSION.PROBLEMS.UPDATE] }), clinicalController.markProblemEnteredInError);

router.get('/care-plans', authorize({ anyPermissions: [PERMISSION.CARE_PLANS.READ, PERMISSION.ENCOUNTERS.READ] }), clinicalController.listCarePlans);
router.post('/care-plans', authorize({ permissions: [PERMISSION.CARE_PLANS.CREATE] }), clinicalController.createCarePlan);
router.get('/care-plans/:carePlanId', authorize({ anyPermissions: [PERMISSION.CARE_PLANS.READ, PERMISSION.ENCOUNTERS.READ] }), clinicalController.getCarePlanDetail);
router.patch('/care-plans/:carePlanId', authorize({ anyPermissions: [PERMISSION.CARE_PLANS.UPDATE, PERMISSION.CARE_PLANS.MANAGE] }), clinicalController.updateCarePlan);
router.post('/care-plans/:carePlanId/complete', authorize({ anyPermissions: [PERMISSION.CARE_PLANS.COMPLETE_TASK, PERMISSION.CARE_PLANS.MANAGE] }), clinicalController.completeCarePlan);
router.post('/care-plans/:carePlanId/cancel', authorize({ anyPermissions: [PERMISSION.CARE_PLANS.UPDATE, PERMISSION.CARE_PLANS.MANAGE] }), clinicalController.cancelCarePlan);

module.exports = router;
