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

router.use(authenticate);

router.get('/me/admissions', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.ADMISSIONS.SELF_READ] }), inpatientController.getMyAdmissions);
router.get('/me/admissions/:admissionId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.ADMISSIONS.SELF_READ] }), inpatientController.getAdmissionDetail);

router.use(authorize({ actorTypes: ['staff'] }));

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
router.post('/admissions/:admissionId/room-bed-charge', authorize({ anyPermissions: [PERMISSION.INPATIENT_CHARGES.CREATE, PERMISSION.CHARGES.CREATE] }), inpatientController.createRoomBedCharge);
router.post('/admissions/:admissionId/bed-assignments', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.CREATE] }), inpatientController.assignBed);
router.post('/admissions/:admissionId/transfer-bed', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.TRANSFER, PERMISSION.ADMISSIONS.TRANSFER] }), inpatientController.transferBedByAdmission);

router.get('/bed-assignments', authorize({ anyPermissions: bedAssignmentReadPermissions }), inpatientController.listBedAssignments);
router.get('/bed-assignments/:assignmentId', authorize({ anyPermissions: bedAssignmentReadPermissions }), inpatientController.getBedAssignmentDetail);
router.post('/bed-assignments/:assignmentId/transfer', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.TRANSFER, PERMISSION.ADMISSIONS.TRANSFER] }), inpatientController.transferBedByAssignment);
router.post('/bed-assignments/:assignmentId/release', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.RELEASE] }), inpatientController.releaseBedAssignment);
router.post('/bed-assignments/:assignmentId/cancel', authorize({ anyPermissions: [PERMISSION.BED_ASSIGNMENTS.CANCEL] }), inpatientController.cancelBedAssignment);

module.exports = router;
