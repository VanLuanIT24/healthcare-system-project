const directoryService = require('../services/directory.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  listDepartments: wrap((req) => directoryService.listDepartments(req.query), 'Lấy directory departments thành công.'),
  listDoctors: wrap((req) => directoryService.listDoctors(req.query), 'Lấy directory doctors thành công.'),
  getDoctor: wrap((req) => directoryService.getDoctor(req.params.doctorId), 'Lấy directory doctor thành công.'),
  listServices: wrap((req) => directoryService.listServices(req.query), 'Lấy directory services thành công.'),
  listServicePrices: wrap((req) => directoryService.listServicePrices(req.query), 'Lấy service prices thành công.'),
  listClinics: wrap((req) => directoryService.listLocations('clinic', req.query), 'Lấy clinics thành công.'),
  listPharmacies: wrap((req) => directoryService.listLocations('pharmacy', req.query), 'Lấy pharmacies thành công.'),
  listAvailableSlots: wrap((req) => directoryService.listAvailableSlots(req.query), 'Lấy available slots thành công.'),
};
