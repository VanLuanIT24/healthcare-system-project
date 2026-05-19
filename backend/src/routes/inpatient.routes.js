const express = require('express');
const inpatientController = require('../controllers/inpatient.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('admissionId', validateObjectIdParam);
router.param('roomId', validateObjectIdParam);
router.param('bedId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('assignmentId', validateObjectIdParam);
router.param('taskId', validateObjectIdParam);
router.param('administrationId', validateObjectIdParam);
router.param('handoverId', validateObjectIdParam);
router.param('itemId', validateObjectIdParam);

const roomReadPermissions = [PERMISSION.ROOMS.READ, PERMISSION.ROOMS.READ_DEPARTMENT, PERMISSION.ROOMS.MANAGE];
const bedReadPermissions = [PERMISSION.BEDS.READ, PERMISSION.BEDS.READ_DEPARTMENT, PERMISSION.BEDS.MANAGE];
const bedAvailabilityPermissions = [
  PERMISSION.BEDS.AVAILABLE_READ,
  PERMISSION.BEDS.AVAILABLE_READ_DEPARTMENT,
  PERMISSION.BEDS.READ,
  PERMISSION.BEDS.READ_DEPARTMENT,
];
const admissionReadPermissions = [
  PERMISSION.ADMISSIONS.READ,
  PERMISSION.ADMISSIONS.READ_OWN,
  PERMISSION.ADMISSIONS.READ_DEPARTMENT,
];
const bedAssignmentReadPermissions = [
  PERMISSION.BED_ASSIGNMENTS.READ,
  PERMISSION.BED_ASSIGNMENTS.READ_DEPARTMENT,
];
const wardBoardReadPermissions = [PERMISSION.WARD_BOARD.READ, PERMISSION.ADMISSIONS.READ, PERMISSION.ADMISSIONS.READ_DEPARTMENT];
const wardMapReadPermissions = [PERMISSION.ROOMS.READ, PERMISSION.ROOMS.READ_DEPARTMENT, PERMISSION.BEDS.READ, PERMISSION.BEDS.READ_DEPARTMENT];
const inpatientTaskReadPermissions = [PERMISSION.INPATIENT_TASKS.READ, PERMISSION.INPATIENT_TASKS.READ_DEPARTMENT, PERMISSION.INPATIENT_TASKS.MANAGE];
const inpatientTaskWritePermissions = [
  PERMISSION.INPATIENT_TASKS.CREATE,
  PERMISSION.INPATIENT_TASKS.UPDATE,
  PERMISSION.INPATIENT_TASKS.ASSIGN,
  PERMISSION.INPATIENT_TASKS.START,
  PERMISSION.INPATIENT_TASKS.COMPLETE,
  PERMISSION.INPATIENT_TASKS.CANCEL,
  PERMISSION.INPATIENT_TASKS.MANAGE,
];
const medicationAdministrationReadPermissions = [PERMISSION.MEDICATION_ADMINISTRATIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PRESCRIPTIONS.READ];
const medicationAdministrationWritePermissions = [
  PERMISSION.MEDICATION_ADMINISTRATIONS.ADMINISTER,
  PERMISSION.MEDICATION_ADMINISTRATIONS.HOLD,
  PERMISSION.MEDICATION_ADMINISTRATIONS.REFUSE,
  PERMISSION.MEDICATION_ADMINISTRATIONS.OMIT,
];
const inpatientHandoverReadPermissions = [PERMISSION.INPATIENT_HANDOVERS.READ, PERMISSION.INPATIENT_HANDOVERS.READ_DEPARTMENT, PERMISSION.INPATIENT_HANDOVERS.MANAGE];
const inpatientHandoverWritePermissions = [
  PERMISSION.INPATIENT_HANDOVERS.CREATE,
  PERMISSION.INPATIENT_HANDOVERS.UPDATE,
  PERMISSION.INPATIENT_HANDOVERS.SIGN,
  PERMISSION.INPATIENT_HANDOVERS.ACKNOWLEDGE,
  PERMISSION.INPATIENT_HANDOVERS.CLOSE,
  PERMISSION.INPATIENT_HANDOVERS.REOPEN,
  PERMISSION.INPATIENT_HANDOVERS.MANAGE,
];

router.use(authenticate);

router.get('/me/admissions', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.ADMISSIONS.SELF_READ] }), inpatientController.getMyAdmissions);
router.get('/me/admissions/:admissionId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.ADMISSIONS.SELF_READ] }), inpatientController.getAdmissionDetail);

router.use(authorize({ actorTypes: ['staff'] }));

router.get('/ward-board', authorize({ anyPermissions: wardBoardReadPermissions }), inpatientController.getWardBoard);
router.get('/ward-map', authorize({ anyPermissions: wardMapReadPermissions }), inpatientController.getWardMap);
router.post('/bed-suggestions', authorize({ anyPermissions: [PERMISSION.BED_SUGGESTIONS.READ, PERMISSION.BED_SUGGESTIONS.CREATE, PERMISSION.BEDS.AVAILABLE_READ, PERMISSION.BEDS.AVAILABLE_READ_DEPARTMENT] }), inpatientController.getBedSuggestions);

router.get('/rooms', authorize({ anyPermissions: roomReadPermissions }), inpatientController.listRooms);
router.post('/rooms', authorize({ anyPermissions: [PERMISSION.ROOMS.CREATE, PERMISSION.ROOMS.MANAGE] }), inpatientController.createRoom);
router.get('/rooms/:roomId', authorize({ anyPermissions: roomReadPermissions }), inpatientController.getRoomDetail);
router.patch('/rooms/:roomId', authorize({ anyPermissions: [PERMISSION.ROOMS.UPDATE, PERMISSION.ROOMS.MANAGE] }), inpatientController.updateRoom);
router.delete('/rooms/:roomId', authorize({ anyPermissions: [PERMISSION.ROOMS.DELETE, PERMISSION.ROOMS.MANAGE] }), inpatientController.deleteRoomSoft);

router.get('/beds/available', authorize({ anyPermissions: bedAvailabilityPermissions }), inpatientController.getAvailableBeds);
router.get('/beds/availability-summary', authorize({ anyPermissions: bedAvailabilityPermissions }), inpatientController.getBedAvailability);
router.get('/beds', authorize({ anyPermissions: bedReadPermissions }), inpatientController.listBeds);
router.post('/beds', authorize({ anyPermissions: [PERMISSION.BEDS.CREATE, PERMISSION.BEDS.MANAGE] }), inpatientController.createBed);
router.get('/beds/:bedId', authorize({ anyPermissions: bedReadPermissions }), inpatientController.getBedDetail);
router.patch('/beds/:bedId', authorize({ anyPermissions: [PERMISSION.BEDS.UPDATE, PERMISSION.BEDS.STATUS_UPDATE, PERMISSION.BEDS.MANAGE] }), inpatientController.updateBed);

router.post('/encounters/:encounterId/admission', authorize({ anyPermissions: [PERMISSION.ADMISSIONS.CREATE, PERMISSION.ADMISSIONS.CREATE_OWN] }), inpatientController.createAdmissionFromEncounter);

router.get('/admissions', authorize({ anyPermissions: admissionReadPermissions }), inpatientController.listAdmissions);
router.get('/admissions/:admissionId', authorize({ anyPermissions: admissionReadPermissions }), inpatientController.getAdmissionDetail);
router.post('/admissions/:admissionId/admit', authorize({ anyPermissions: [PERMISSION.ADMISSIONS.ADMIT] }), inpatientController.admitPatient);
router.post('/admissions/:admissionId/cancel', authorize({ anyPermissions: [PERMISSION.ADMISSIONS.CANCEL] }), inpatientController.cancelAdmission);
router.post('/admissions/:admissionId/discharge', authorize({ anyPermissions: [PERMISSION.ADMISSIONS.DISCHARGE, PERMISSION.ADMISSIONS.DISCHARGE_OWN] }), inpatientController.dischargeAdmission);
router.get('/admissions/:admissionId/bed-history', authorize({ anyPermissions: admissionReadPermissions }), inpatientController.getAdmissionBedHistory);
router.get('/admissions/:admissionId/charges', authorize({ anyPermissions: [PERMISSION.INPATIENT_CHARGES.READ, PERMISSION.CHARGES.READ, ...admissionReadPermissions] }), inpatientController.listAdmissionCharges);
router.get('/admissions/:admissionId/discharge-readiness', authorize({ anyPermissions: [PERMISSION.DISCHARGE_READINESS.READ, ...admissionReadPermissions] }), inpatientController.getDischargeReadiness);
router.get('/admissions/:admissionId/tasks', authorize({ anyPermissions: inpatientTaskReadPermissions }), (req, res, next) => {
  req.query.admission_id = req.params.admissionId;
  return inpatientController.listInpatientTasks(req, res, next);
});
router.post('/admissions/:admissionId/room-bed-charge', authorize({ anyPermissions: [PERMISSION.INPATIENT_CHARGES.CREATE, PERMISSION.CHARGES.CREATE] }), inpatientController.createRoomBedCharge);
router.post('/admissions/:admissionId/bed-assignment/validate', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.CREATE, PERMISSION.BED_ASSIGNMENTS.TRANSFER] }), inpatientController.validateBedAssignmentPreview);
router.post('/admissions/:admissionId/bed-assignments', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.CREATE] }), inpatientController.assignBed);
router.post('/admissions/:admissionId/transfer-bed', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.TRANSFER, PERMISSION.ADMISSIONS.TRANSFER] }), inpatientController.transferBedByAdmission);

router.get('/tasks', authorize({ anyPermissions: inpatientTaskReadPermissions }), inpatientController.listInpatientTasks);
router.post('/tasks', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.CREATE, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.createInpatientTask);
router.post('/tasks/bulk-create', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.CREATE, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.bulkCreateInpatientTasks);
router.post('/tasks/bulk-assign', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.ASSIGN, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.bulkAssignInpatientTasks);
router.post('/tasks/bulk-complete', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.COMPLETE, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.bulkCompleteInpatientTasks);
router.get('/tasks/:taskId', authorize({ anyPermissions: inpatientTaskReadPermissions }), inpatientController.getInpatientTaskDetail);
router.patch('/tasks/:taskId', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.UPDATE, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.updateInpatientTask);
router.post('/tasks/:taskId/start', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.START, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.startInpatientTask);
router.post('/tasks/:taskId/complete', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.COMPLETE, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.completeInpatientTask);
router.post('/tasks/:taskId/cancel', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.CANCEL, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.cancelInpatientTask);
router.post('/tasks/:taskId/assign', authorize({ anyPermissions: [PERMISSION.INPATIENT_TASKS.ASSIGN, PERMISSION.INPATIENT_TASKS.MANAGE] }), inpatientController.assignInpatientTask);

router.get('/medication-administrations', authorize({ anyPermissions: medicationAdministrationReadPermissions }), inpatientController.listMedicationAdministrations);
router.post('/medication-administrations/generate-from-prescription', authorize({ anyPermissions: medicationAdministrationWritePermissions }), inpatientController.generateMedicationScheduleFromPrescription);
router.post('/medication-administrations/verify-scan', authorize({ anyPermissions: medicationAdministrationReadPermissions }), inpatientController.verifyMedicationScan);
router.get('/medication-administrations/:administrationId', authorize({ anyPermissions: medicationAdministrationReadPermissions }), inpatientController.getMedicationAdministrationDetail);
router.post('/medication-administrations/:administrationId/administer', authorize({ anyPermissions: [PERMISSION.MEDICATION_ADMINISTRATIONS.ADMINISTER] }), inpatientController.administerMedication);
router.post('/medication-administrations/:administrationId/hold', authorize({ anyPermissions: [PERMISSION.MEDICATION_ADMINISTRATIONS.HOLD] }), inpatientController.holdMedication);
router.post('/medication-administrations/:administrationId/refuse', authorize({ anyPermissions: [PERMISSION.MEDICATION_ADMINISTRATIONS.REFUSE] }), inpatientController.refuseMedication);
router.post('/medication-administrations/:administrationId/omit', authorize({ anyPermissions: [PERMISSION.MEDICATION_ADMINISTRATIONS.OMIT] }), inpatientController.omitMedication);
router.post('/medication-administrations/:administrationId/reschedule', authorize({ anyPermissions: medicationAdministrationWritePermissions }), inpatientController.rescheduleMedicationAdministration);
router.post('/medication-administrations/:administrationId/entered-in-error', authorize({ anyPermissions: medicationAdministrationWritePermissions }), inpatientController.markMedicationEnteredInError);

router.get('/admissions/:admissionId/medication-administrations', authorize({ anyPermissions: medicationAdministrationReadPermissions }), (req, res, next) => {
  req.query.admission_id = req.params.admissionId;
  return inpatientController.listMedicationAdministrations(req, res, next);
});

router.get('/handovers', authorize({ anyPermissions: inpatientHandoverReadPermissions }), inpatientController.listInpatientHandovers);
router.post('/handovers', authorize({ anyPermissions: [PERMISSION.INPATIENT_HANDOVERS.CREATE, PERMISSION.INPATIENT_HANDOVERS.MANAGE] }), inpatientController.createInpatientHandover);
router.get('/handovers/:handoverId', authorize({ anyPermissions: inpatientHandoverReadPermissions }), inpatientController.getInpatientHandoverDetail);
router.patch('/handovers/:handoverId', authorize({ anyPermissions: [PERMISSION.INPATIENT_HANDOVERS.UPDATE, PERMISSION.INPATIENT_HANDOVERS.MANAGE] }), inpatientController.updateInpatientHandover);
router.post('/handovers/:handoverId/generate', authorize({ anyPermissions: inpatientHandoverWritePermissions }), inpatientController.generateInpatientHandover);
router.post('/handovers/:handoverId/sign', authorize({ anyPermissions: [PERMISSION.INPATIENT_HANDOVERS.SIGN, PERMISSION.INPATIENT_HANDOVERS.MANAGE] }), inpatientController.signInpatientHandover);
router.post('/handovers/:handoverId/acknowledge', authorize({ anyPermissions: [PERMISSION.INPATIENT_HANDOVERS.ACKNOWLEDGE, PERMISSION.INPATIENT_HANDOVERS.MANAGE] }), inpatientController.acknowledgeInpatientHandover);
router.post('/handovers/:handoverId/close', authorize({ anyPermissions: [PERMISSION.INPATIENT_HANDOVERS.CLOSE, PERMISSION.INPATIENT_HANDOVERS.MANAGE] }), inpatientController.closeInpatientHandover);
router.post('/handovers/:handoverId/reopen', authorize({ anyPermissions: [PERMISSION.INPATIENT_HANDOVERS.REOPEN, PERMISSION.INPATIENT_HANDOVERS.MANAGE] }), inpatientController.reopenInpatientHandover);
router.patch('/handovers/:handoverId/items/:itemId', authorize({ anyPermissions: [PERMISSION.INPATIENT_HANDOVERS.UPDATE, PERMISSION.INPATIENT_HANDOVERS.MANAGE] }), inpatientController.updateHandoverItem);
router.post('/handovers/:handoverId/items/:itemId/acknowledge', authorize({ anyPermissions: [PERMISSION.INPATIENT_HANDOVERS.ACKNOWLEDGE, PERMISSION.INPATIENT_HANDOVERS.MANAGE] }), inpatientController.acknowledgeHandoverItem);

router.get('/bed-assignments', authorize({ anyPermissions: bedAssignmentReadPermissions }), inpatientController.listBedAssignments);
router.get('/bed-assignments/:assignmentId', authorize({ anyPermissions: bedAssignmentReadPermissions }), inpatientController.getBedAssignmentDetail);
router.post('/bed-assignments/:assignmentId/transfer', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.TRANSFER, PERMISSION.ADMISSIONS.TRANSFER] }), inpatientController.transferBedByAssignment);
router.post('/bed-assignments/:assignmentId/release', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.RELEASE] }), inpatientController.releaseBedAssignment);
router.post('/bed-assignments/:assignmentId/cancel', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.CANCEL] }), inpatientController.cancelBedAssignment);

module.exports = router;
