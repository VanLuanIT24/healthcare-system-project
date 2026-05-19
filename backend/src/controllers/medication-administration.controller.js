const medicationAdministrationService = require('../services/nursing-clinical-command.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  listAdministrations: wrap(
    (req) => medicationAdministrationService.listMedicationAdministrations(req.query, req.auth),
    'Lấy danh sách ghi nhận dùng thuốc thành công.',
  ),
  getAdministration: wrap(
    (req) => medicationAdministrationService.getMedicationAdministration(req.params.administrationId, req.auth),
    'Lấy chi tiết ghi nhận dùng thuốc thành công.',
  ),
  createAdministration: wrap(
    (req) => medicationAdministrationService.createMedicationAdministration(req.body, req.auth, requestMeta(req)),
    'Tạo ghi nhận dùng thuốc thành công.',
    201,
  ),
  giveAdministration: wrap(
    (req) => medicationAdministrationService.giveMedicationAdministration(req.params.administrationId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận đã dùng thuốc thành công.',
  ),
  holdAdministration: wrap(
    (req) => medicationAdministrationService.holdMedicationAdministration(req.params.administrationId, req.body, req.auth, requestMeta(req)),
    'Hold thuốc thành công.',
  ),
  refuseAdministration: wrap(
    (req) => medicationAdministrationService.refuseMedicationAdministration(req.params.administrationId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận bệnh nhân từ chối thuốc thành công.',
  ),
  omitAdministration: wrap(
    (req) => medicationAdministrationService.omitMedicationAdministration(req.params.administrationId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận bỏ liều thuốc thành công.',
  ),
  cancelAdministration: wrap(
    (req) => medicationAdministrationService.cancelMedicationAdministration(req.params.administrationId, req.body, req.auth, requestMeta(req)),
    'Hủy ghi nhận dùng thuốc thành công.',
  ),
  markEnteredInError: wrap(
    (req) => medicationAdministrationService.markMedicationAdministrationEnteredInError(req.params.administrationId, req.body, req.auth, requestMeta(req)),
    'Đánh dấu ghi nhận dùng thuốc nhập sai thành công.',
  ),
  addReaction: wrap(
    (req) => medicationAdministrationService.addMedicationReaction(req.params.administrationId, req.body, req.auth, requestMeta(req)),
    'Ghi nhận phản ứng sau dùng thuốc thành công.',
    201,
  ),
};
