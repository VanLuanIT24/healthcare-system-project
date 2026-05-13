const inpatientService = require('../services/inpatient.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  createRoom: wrap((req) => inpatientService.createRoom(req.body, req.auth, requestMeta(req)), 'Tạo room thành công.', 201),
  listRooms: wrap((req) => inpatientService.listRooms(req.query, req.auth), 'Lấy danh sách room thành công.'),
  getRoomDetail: wrap((req) => inpatientService.getRoomDetail(req.params.roomId, req.auth), 'Lấy chi tiết room thành công.'),
  updateRoom: wrap((req) => inpatientService.updateRoom(req.params.roomId, req.body, req.auth, requestMeta(req)), 'Cập nhật room thành công.'),
  deleteRoomSoft: wrap((req) => inpatientService.deleteRoomSoft(req.params.roomId, req.auth, requestMeta(req)), 'Xóa room thành công.'),

  createBed: wrap((req) => inpatientService.createBed(req.body, req.auth, requestMeta(req)), 'Tạo bed thành công.', 201),
  listBeds: wrap((req) => inpatientService.listBeds(req.query, req.auth), 'Lấy danh sách bed thành công.'),
  getAvailableBeds: wrap((req) => inpatientService.getAvailableBeds(req.query, req.auth), 'Lấy danh sách bed available thành công.'),
  getBedAvailability: wrap((req) => inpatientService.getBedAvailability(req.query, req.auth), 'Lấy bed availability thành công.'),
  getBedDetail: wrap((req) => inpatientService.getBedDetail(req.params.bedId, req.auth), 'Lấy chi tiết bed thành công.'),
  updateBed: wrap((req) => inpatientService.updateBed(req.params.bedId, req.body, req.auth, requestMeta(req)), 'Cập nhật bed thành công.'),

  createAdmissionFromEncounter: wrap((req) => inpatientService.createAdmissionFromEncounter(req.params.encounterId, req.body, req.auth, requestMeta(req)), 'Tạo admission từ encounter thành công.', 201),
  listAdmissions: wrap((req) => inpatientService.listAdmissions(req.query, req.auth), 'Lấy danh sách admission thành công.'),
  getAdmissionDetail: wrap((req) => inpatientService.getAdmissionDetail(req.params.admissionId, req.auth), 'Lấy chi tiết admission thành công.'),
  admitPatient: wrap((req) => inpatientService.admitPatient(req.params.admissionId, req.body, req.auth, requestMeta(req)), 'Admit patient thành công.'),
  cancelAdmission: wrap((req) => inpatientService.cancelAdmission(req.params.admissionId, req.body, req.auth, requestMeta(req)), 'Cancel admission thành công.'),
  dischargeAdmission: wrap((req) => inpatientService.dischargeAdmission(req.params.admissionId, req.body, req.auth, requestMeta(req)), 'Discharge admission thành công.'),
  getAdmissionBedHistory: wrap((req) => inpatientService.getAdmissionBedHistory(req.params.admissionId, req.auth), 'Lấy bed history thành công.'),
  listAdmissionCharges: wrap((req) => inpatientService.listAdmissionCharges(req.params.admissionId, req.auth), 'Lấy admission charges thành công.'),
  createRoomBedCharge: wrap((req) => inpatientService.createRoomBedCharge(req.params.admissionId, req.body, req.auth, requestMeta(req)), 'Tạo room/bed charge thành công.', 201),
  getMyAdmissions: wrap((req) => inpatientService.listAdmissions({ ...req.query, patient_id: req.auth.patientId || req.auth.patient_id }, req.auth), 'Lấy admission của tôi thành công.'),

  assignBed: wrap((req) => inpatientService.assignBed(req.params.admissionId, req.body, req.auth, requestMeta(req)), 'Assign bed thành công.', 201),
  transferBedByAdmission: wrap((req) => inpatientService.transferBed(req.params.admissionId, req.body, req.auth, requestMeta(req)), 'Transfer bed thành công.'),
  listBedAssignments: wrap((req) => inpatientService.listBedAssignments(req.query, req.auth), 'Lấy danh sách bed assignment thành công.'),
  getBedAssignmentDetail: wrap((req) => inpatientService.getBedAssignmentDetail(req.params.assignmentId, req.auth), 'Lấy chi tiết bed assignment thành công.'),
  transferBedByAssignment: wrap((req) => inpatientService.transferBedAssignment(req.params.assignmentId, req.body, req.auth, requestMeta(req)), 'Transfer bed thành công.'),
  releaseBedAssignment: wrap((req) => inpatientService.releaseBedAssignment(req.params.assignmentId, req.body, req.auth, requestMeta(req)), 'Release bed assignment thành công.'),
  cancelBedAssignment: wrap((req) => inpatientService.cancelBedAssignment(req.params.assignmentId, req.body, req.auth, requestMeta(req)), 'Cancel bed assignment thành công.'),
};
